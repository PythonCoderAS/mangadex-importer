import Manga from "./struct/manga";
import Parser from "./struct/parser";
import {Author as MDAuthor, Cover as MDCover, login, Manga as MDManga} from 'mangadex-full-api';
import {username, password} from '../config.json'
import {downloadFile, log} from "./utils";
import Chapter from "./struct/chapter";
import chalk from "chalk";
import {BaseOptionalCliOptions, SingleChapterCliOptions} from "./struct/optionalCliOptions";

const MDUtil = require("mangadex-full-api/src/util")
const MDUploadSession = require("mangadex-full-api/src/internal/uploadsession")

export default class Client {
    private readonly parser: Parser;

    constructor(parser: Parser) {
        this.parser = parser;
    }

    async login(){
        log("MangaDex - Login", chalk.yellow("Logging in..."));
        await login(username, password)
        log("MangaDex - Login", chalk.green("Logged in!"));
    }


    async parseManga(url: string) {
        return await this.parser.parseManga(url);
    }

    private async findOrCreateAuthor(name: string){
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
        if (manga.artist === manga.author){
            artistResolved = authorResolved
        } else {
            artistResolved = await this.findOrCreateAuthor(manga.artist)
        }
        const tags = []
        if (manga.isDoujinshi){
            tags.push('b13b2a48-c720-44a9-9c77-39c9979373fb')
        }
        if (manga.isOneshot){
            tags.push('0234a31e-a729-4e28-9d6a-3f87c4966b9e')
        }
        log("MangaDex - Manga", chalk.yellow(`Submitting ${manga.name}...`));
        const mdManga = await MDManga.create({en: manga.name}, manga.originalLanguage || "ja", "ongoing", manga.rating || "pornographic", {
            altTitles: Object.entries(manga.altNames || {}).reduce<{[locale: string]: string}[]>((prev, [locale, items]) => {
                return prev.concat(items.map((value) => {
                    const obj: {[key: string]: string} = {};
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
            data: await downloadFile(manga.coverUrl)
        }, {volume: "1"});
        log("MangaDex - Manga", chalk.green(`Uploaded cover. Cover ID: ${mdManga.mainCover.id}`));
        log("MangaDex - Manga", chalk.yellow(`Attaching new cover to manga...`));
        const updatedManga = await mdManga.update();
        log("MangaDex - Manga", chalk.green(`Attached new cover to manga.`));
        log("MangaDex - Manga", chalk.yellow(`Submitting draft...`));
        await MDUtil.apiRequest(`/manga/draft/${updatedManga.id}/commit`, "POST", {version: updatedManga.version})
        log("MangaDex - Manga", chalk.green(`Submitted draft.`));
        return updatedManga;
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

    async submitChapter(chapter: Chapter, mdManga: MDManga, opts: BaseOptionalCliOptions & SingleChapterCliOptions ){
        let chapterData: Object = {volume: opts.volumeNum || chapter.volNum || null, chapter: opts.chapterNum || chapter.chapterNum || null, title: chapter.title || null, translatedLanguage: "en"}
        if (mdManga.tags.map((tag) => tag.id).includes('0234a31e-a729-4e28-9d6a-3f87c4966b9e')){ // Oneshot tag
            log("MangaDex - Chapter", chalk.yellow(`The manga has the oneshot tag, this chapter will be uploaded as a oneshot...`));
            chapterData = {volume: opts.volumeNum || null, chapter: opts.chapterNum || null, title: null, translatedLanguage: "en"}
        }
        log("MangaDex - Chapter", chalk.yellow(`Checking for active upload sessions...`));
        const currentSession = await MDUploadSession.getCurrentSession()
        if (currentSession){
            log("MangaDex - Chapter", chalk.red(`Found active upload session with ID ${currentSession.id}. Deleting...`));
            await currentSession.close()
            log("MangaDex - Chapter", chalk.green(`Deleted active upload session.`));
        }
        log("MangaDex - Chapter", chalk.yellow(`Starting upload session...`));
        const session = await mdManga.createUploadSession(...(opts.groupIds || []))
        log("MangaDex - Chapter", chalk.green(`Upload session started. Session ID: ${session.id}`));
        const pages = chapter.pages;
        const pageIDs = [];
        while (pages.length > 0){
            const toUpload = pages.splice(0, 10)
            log("MangaDex - Chapter", chalk.yellow(`Uploading ${toUpload.length} pages...`));
            const buffers = await Promise.all(toUpload.map((page) => this.parser.downloadPage(page)))
            const pageIDsResolved = await session.uploadPages(buffers.map((buffer) => {
                return {
                    name: "page.png",
                    type: "png",
                    data: buffer
                }
            }))
            pageIDs.push(...pageIDsResolved)
            log("MangaDex - Chapter", chalk.green(`Finished uploading pages. ${pages.length} pages remaining.`));
        }
        log("MangaDex - Chapter", chalk.yellow(`Finishing upload session...`));
        // log("MangaDex - Chapter - Debug", chalk.gray(`Chapter Data: ${JSON.stringify(chapterData, null, 4)}`));
        await session.commit(chapterData as any, pageIDs)
        log("MangaDex - Chapter", chalk.green(`Finished upload session.`));
    }
}