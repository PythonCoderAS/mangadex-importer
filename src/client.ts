import Manga from "./struct/manga";
import Parser from "./struct/parser";
import {Author as MDAuthor, Cover as MDCover, login, Manga as MDManga} from 'mangadex-full-api';
import {password, username} from '../config.json'
import {downloadFile, log} from "./utils";
import Chapter from "./struct/chapter";
import chalk from "chalk";
import {BaseOptionalCliOptions, SingleChapterCliOptions} from "./struct/optionalCliOptions";
import ConcurrentPriorityWorkerQueue from "concurrent-priority-worker-queue";

// const MDUtil = require("mangadex-full-api/src/util")
const MDUploadSession = require("mangadex-full-api/src/internal/uploadsession")

function sleep(milliseconds: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, milliseconds))
}

export default class Client {
    private readonly parser: Parser;

    constructor(parser: Parser) {
        this.parser = parser;
    }

    async login() {
        log("MangaDex - Login", chalk.yellow("Logging in..."));
        await login(username, password)
        log("MangaDex - Login", chalk.green("Logged in!"));
    }


    async parseManga(url: string) {
        return await this.parser.parseManga(url);
    }

    private async findOrCreateAuthor(name: string) {
        log("MangaDex - Author", chalk.yellow(`Searching for author ${name}...`));
        let authorResolved = (await MDAuthor.search({name})).filter(author => author.name === name)[0]
        if (!authorResolved) {
            log("MangaDex - Author", chalk.red(`Author ${name} not found, creating...`));
            authorResolved = await MDAuthor.create(name)
        }
        log("MangaDex - Author", chalk.green(`Author ${name} found. Author ID: ${authorResolved.id}`));
        return authorResolved;
    }

    async submitManga(manga: Manga) {
        let authorResolved: MDAuthor = await this.findOrCreateAuthor(manga.author)
        let artistResolved: MDAuthor
        if (manga.artist === manga.author) {
            artistResolved = authorResolved
        } else {
            artistResolved = await this.findOrCreateAuthor(manga.artist)
        }
        const tags = []
        if (manga.isDoujinshi) {
            tags.push('b13b2a48-c720-44a9-9c77-39c9979373fb')
        }
        if (manga.isOneshot) {
            tags.push('0234a31e-a729-4e28-9d6a-3f87c4966b9e')
        }
        log("MangaDex - Manga", chalk.yellow(`Submitting ${manga.name}...`));
        const mdManga = await MDManga.create({en: manga.name}, manga.originalLanguage ?? "ja", "ongoing", manga.rating ?? "pornographic", {
            altTitles: Object.entries(manga.altNames ?? {}).reduce<{ [locale: string]: string }[]>((prev, [locale, items]) => {
                return prev.concat(items.map((value) => {
                    const obj: { [key: string]: string } = {};
                    obj[locale] = value;
                    return obj;
                }));
            }, []),
            authors: [authorResolved.id],
            artists: [artistResolved.id],
            tags
        })
        log("MangaDex - Manga", chalk.green(`Submitted ${manga.name}. Manga ID: ${mdManga.id}`));
        log("MangaDex - Manga", chalk.yellow(`Uploading cover...`));
        // @ts-ignore Declerations are broken.
        mdManga.mainCover = await MDCover.create(mdManga.id, {
            name: "cover.png",
            type: "png",
            data: await downloadFile(manga.coverUrl, this.parser.globalHeaders)
        }, {volume: "1"});
        log("MangaDex - Manga", chalk.green(`Uploaded cover. Cover ID: ${mdManga.mainCover.id}`));
        // log("MangaDex - Manga", chalk.yellow(`Attaching new cover to manga...`));
        // const updatedManga = await mdManga.update();
        // log("MangaDex - Manga", chalk.green(`Attached new cover to manga.`));
        // log("MangaDex - Manga", chalk.yellow(`Submitting draft...`));
        // await MDUtil.apiRequest(`/manga/draft/${updatedManga.id}/commit`, "POST", {version: updatedManga.version})
        // log("MangaDex - Manga", chalk.green(`Submitted draft.`));
        return mdManga;
    }

    async parseMangaChapters(url: string) {
        if (!this.parser.parseMangaChapters) {
            throw new Error("Parser does not support parsing chapters.");
        }
        return await this.parser.parseMangaChapters(url);
    }

    async parseChapter(url: string) {
        return await this.parser.parseChapter(url);
    }

    async downloadChapter(chapter: Chapter) {
        return await Promise.all(chapter.pages.map(async (page) => {
            return await this.parser.downloadPage(page);
        }))

    }

    async submitChapter(chapter: Chapter, mdManga: MDManga, opts: BaseOptionalCliOptions & SingleChapterCliOptions): Promise<void> {
        let chapterData: any = {
            volume: chapter.volNum ?? null,
            chapter: chapter.chapterNum ?? null,
            title: chapter.title ?? null,
            translatedLanguage: opts.language ?? "en"
        }
        if (mdManga.tags.map((tag) => tag.id).includes('0234a31e-a729-4e28-9d6a-3f87c4966b9e')) { // Oneshot tag
            log("MangaDex - Chapter", chalk.yellow(`The manga has the oneshot tag, this chapter will be uploaded as a oneshot...`));
            chapterData = {volume: null, chapter: null, title: null, translatedLanguage: "en"}
        }
        if (opts.volumeNum) {
            chapterData["volume"] = opts.volumeNum
        }
        if (opts.chapterNum) {
            chapterData["chapter"] = opts.chapterNum
        }
        if (typeof chapterData.volume === "number") {
            chapterData["volume"] = String(chapterData.volume)
        }
        if (typeof chapterData.chapter === "number") {
            chapterData["chapter"] = String(chapterData.chapter)
        }
        log("MangaDex - Chapter", chalk.yellow(`Checking for active upload sessions...`));
        const currentSession = await MDUploadSession.getCurrentSession()
        if (currentSession) {
            log("MangaDex - Chapter", chalk.red(`Found active upload session with ID ${currentSession.id}. Deleting...`));
            await currentSession.close()
            log("MangaDex - Chapter", chalk.green(`Deleted active upload session.`));
        }
        log("MangaDex - Chapter", chalk.yellow(`Starting upload session for Volume ${chapterData.volume} Chapter ${chapterData.chapter} (${chapterData.title}) [Language: ${chapterData.translatedLanguage}] ...`));
        const session = await mdManga.createUploadSession(...(opts.groupIds ?? []))
        log("MangaDex - Chapter", chalk.green(`Upload session started. Session ID: ${session.id}`));
        const pages = chapter.pages;
        const buffers = await Promise.all(pages.map((page) => this.parser.downloadPage(page)));
        const sets: Buffer[][] = [];
        let currentSet: Buffer[] = [];
        for (const buffer of buffers) {
            const bufferLength = buffer.length;
            if (currentSet.reduce((acc, cur) => acc + cur.length, 0) + bufferLength > 1024 * 1024 * 5 || currentSet.length === 10 || currentSet.length >= (buffers.length / 5) ) { // > 5 MB
                sets.push(currentSet);
                currentSet = [];
            }
            currentSet.push(buffer);
        }
        if (currentSet.length > 0) {
            sets.push(currentSet);
        }
        const pageIDs: string[] = [];
        let pagesRemaining = pages.length;
        const queue = new ConcurrentPriorityWorkerQueue({
            worker: async (toUpload: Buffer[]) => {
                log("MangaDex - Chapter", chalk.yellow(`Uploading ${toUpload.length} pages...`));
                let pageIDsResolved: string[] = [];
                while (true) {
                    try {
                        pageIDsResolved = await session.uploadPages(toUpload.map((buffer) => {
                            return {
                                name: "page.png",
                                type: "png",
                                data: buffer
                            }
                        }))
                    } catch (e) {
                        const errorStr = String(e);
                        if (errorStr.includes("EPIPE")
                            || errorStr.includes("ECONNRESET")
                            || errorStr.includes("ECONNREFUSED")
                            || errorStr.includes("upload_service_exception")
                            || errorStr.includes("socket hang up")
                            || errorStr.includes("Backend fetch failed")) {
                            log("MangaDex - Chapter", chalk.red(`Page upload stopped unexpectedly. Retrying.`));
                            continue;
                        } else {
                            throw e;
                        }
                    }
                    break;
                }
                pagesRemaining -= toUpload.length;
                log("MangaDex - Chapter", chalk.green(`Finished uploading pages. ${pagesRemaining} pages remaining.`));
                return pageIDsResolved;
            },
            limit: 5
        });
        (await Promise.all(sets.map((set) => queue.enqueue(set, 0)))).reduce((acc, cur) => acc.concat(cur), []).forEach((pageID) => pageIDs.push(pageID));
        log("MangaDex - Chapter", chalk.yellow(`Finishing upload session...`));
        // log("MangaDex - Chapter - Debug", chalk.gray(`Chapter Data: ${JSON.stringify(chapterData, null, 4)}`));
        try {
            await sleep(1000);
            await session.commit(chapterData as any, pageIDs)
        } catch (e) {
            if (String(e).includes("Provided too many page ids that do not exist in the session (400: bad_request_http_exception)")) {
                log("MangaDex - Chapter", chalk.red(`Chapter comit stopped unexpectedly. Re-uploading.`));
                return await this.submitChapter(chapter, mdManga, opts)
            }
        }
        await sleep(1000);
        log("MangaDex - Chapter", chalk.green(`Finished upload session.`));
    }
}
