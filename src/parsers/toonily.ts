import Chapter from "../struct/chapter";
import Manga from "../struct/manga";
import Parser from "../struct/parser";
import { Toonily } from "../../site-libs/extensions-generic/madara/src/Toonily/Toonily";
import cheerio from "cheerio";
import {APIWrapper, Source} from "paperback-extensions-common";
import "paperback-extensions-common/dist/models/impl_export"
import {log} from "../utils";
import chalk from "chalk";

export default class ToonilyParser extends Parser {
    name = "toonily";
    globalHeaders = {
        "Referer": "https://toonily.com/",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36"
    }
    wrapper: APIWrapper = new APIWrapper()
    source: Source = new Toonily(cheerio)

    private readonly mangaIdRegex = /https:\/\/toonily\.com\/webtoon\/([^/]+)/;
    private readonly chapterIdRegex = /https:\/\/toonily\.com\/webtoon\/[^/]+\/chapter-(\d+)/;

    async parseManga(url: string): Promise<Manga> {
        const mangaId = url.match(this.mangaIdRegex)![1]
        log("Toonily", chalk.yellow(`Fetching manga details for ${mangaId}`))
        const paperbackManga = await this.wrapper.getMangaDetails(this.source, mangaId)
        log("Toonily", chalk.yellow(`Fetching chapter list for ${mangaId}`))
        const paperbackChapters = await this.wrapper.getChapters(this.source, mangaId)
        return {
            name: paperbackManga.titles[0],
            altNames: {en: paperbackManga.titles.splice(1)},
            artist: paperbackManga.artist!,
            author: paperbackManga.author!,
            coverUrl: paperbackManga.image,
            description: paperbackManga.desc,
            isDoujinshi: false,
            isOneshot: paperbackChapters.length === 1,
            originalLanguage: paperbackManga.langFlag,
        };
    }

    async parseMangaChapters(url: string): Promise<Chapter[]> {
        const mangaId = url.match(this.mangaIdRegex)![1]
        const paperbackChapters = await this.wrapper.getChapters(this.source, mangaId)
        return await Promise.all(paperbackChapters.map(async (chapter) => {
            log("Toonily", chalk.yellow(`Fetching chapter details for ${chapter.id}`))
            const paperbackChapterDetails = await this.wrapper.getChapterDetails(this.source, mangaId, chapter.id)
            if (paperbackChapters.length === 1){
                return {
                    pages: paperbackChapterDetails.pages
                }
            } else {
                return {
                    pages: paperbackChapterDetails.pages,
                    volume: chapter.volume,
                    chapterNum: chapter.chapNum,
                    title: chapter.name,
                }
            }
        }))
    }

    async parseChapter(url: string): Promise<Chapter> {
        const chapterId = url.match(this.chapterIdRegex)![1]
        log("Toonily", chalk.yellow(`Fetching chapter details for ${chapterId}`))
        const paperbackChapterDetails = await this.wrapper.getChapterDetails(this.source, "fake", chapterId)
        return {
            pages: paperbackChapterDetails.pages,
        }
    }


    async downloadPage(url: string): Promise<Buffer> {
        while (true) {
            try {
                return await super.downloadPage(url);
            } catch (e: any) {
                if (e.response?.status === 403){
                    log("Toonily", chalk.yellow(`Fetching page ${url} failed, retrying`))
                } else {
                    throw e;
                }
            }
        }
    }
}