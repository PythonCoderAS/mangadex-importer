import Manga from "./struct/manga";
import Parser from "./struct/parser";
import {Author as MDAuthor, Cover as MDCover, login, Manga as MDManga} from 'mangadex-full-api';
import {password, username} from '../config.json'
import {downloadFile} from "./utils";
import Chapter from "./struct/chapter";

export default class Client {
    private readonly parser: Parser;

    constructor(parser: Parser) {
        this.parser = parser;
    }

    async login(){
        await login(username, password)
    }


    async parseManga(url: string) {
        return await this.parser.parseManga(url);
    }

    private async findOrCreateAuthor(name: string){
        let authorResolved = (await MDAuthor.search({name})).filter(author => author.name === name)[0]
        if (!authorResolved) {
            authorResolved = await MDAuthor.create(name)
        }
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
        const mdManga = await MDManga.create({en: manga.name}, manga.originalLanguage || "jp", "ongoing", manga.rating || "pornographic", {
            altTitles: Object.entries(manga.altNames || {}).reduce<{[locale: string]: string}[]>((prev, [locale, items]) => {
                return prev.concat(items.map((value) => {
                    const obj: {[key: string]: string} = {};
                    obj[locale] = value;
                    return obj;
                }));
            }, []),
            authors: [authorResolved],
            artists: [artistResolved],
            tags
        })
        // @ts-ignore Declerations are broken.
        mdManga.mainCover = await MDCover.create(mdManga.id, {
            name: "cover.png",
            type: "png",
            data: await downloadFile(manga.coverUrl)
        }, {volume: "1"});
        return await mdManga.update();
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

    async submitChapter(chapter: Chapter, mdManga: MDManga){
        let chapterData: Object = {volume: chapter.volNum, number: chapter.chapterNum, title: chapter.title}
        if (mdManga.tags.map((tag) => tag.id).includes('0234a31e-a729-4e28-9d6a-3f87c4966b9e')){ // Oneshot tag
            chapterData = {volume: null, number: null, title: null}
        }
        const session = await mdManga.createUploadSession();
        const pages = chapter.pages;
        const pageIDs = [];
        while (pages.length > 0){
            const buffers = await Promise.all(pages.splice(0, 10).map((page) => this.parser.downloadPage(page)))
            const pageIDsResolved = await session.uploadPages(buffers.map((buffer) => {
                return {
                    name: "page.png",
                    type: "png",
                    data: buffer
                }
            }))
            pageIDs.push(...pageIDsResolved)
            await session.commit(chapterData as any, pageIDs)
        }
        await session.close()
    }
}