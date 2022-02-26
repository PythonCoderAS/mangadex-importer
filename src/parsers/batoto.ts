import Chapter from "../struct/chapter";
import Manga from "../struct/manga";
import Parser from "../struct/parser";
import {BatoTo} from "../../site-libs/extensions-gamefuzzy/src/BatoTo/BatoTo";
import cheerio from "cheerio";
import {APIWrapper, Source} from "paperback-extensions-common";
import "paperback-extensions-common/dist/models/impl_export"
import {log} from "../utils";
import chalk from "chalk";

export default class Batoto extends Parser {
    name = "batoto";
    wrapper: APIWrapper = new APIWrapper()
    source: Source = new BatoTo(cheerio)

    private readonly mangaIdRegex = new RegExp("https://batotoo.com/series/(\\d+)");
    private readonly chapterIdRegex = new RegExp("https://batotoo.com/chapter/(\\d+)");
    private readonly volumeChapterRegex = /^Vol(?:ume|\.|)\s*(\d+)\s*(?:Chap|Chapter|Ch\.)\s*([\d.]+)(\s*[:\- ]\s*([\S][\S ]+)|)/i
    private readonly chapterRegex = /^(?:Chap|Chapter|Ch\.)\s*([\d.]+)(\s*[:\- ]\s*([\S][\S ]+)|)/i


    constructor() {
        super();
    }

    async parseManga(url: string): Promise<Manga> {
        const mangaId = url.match(this.mangaIdRegex)![1]
        log("Batoto", chalk.yellow(`Fetching manga details for ${mangaId}`))
        const paperbackManga = await this.wrapper.getMangaDetails(this.source, mangaId)
        log("Batoto", chalk.yellow(`Fetching chapter list for ${mangaId}`))
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
        return await Promise.all(paperbackChapters.map<Promise<Chapter>>(async (chapter) => {
            log("Batoto", chalk.yellow(`Fetching chapter details for ${chapter.id}`))
            const paperbackChapterDetails = await this.wrapper.getChapterDetails(this.source, mangaId, chapter.id)
            const volumeMatch = chapter.name?.match(this.volumeChapterRegex)
            const chapterMatch = chapter.name?.match(this.chapterRegex)
            if (paperbackChapters.length === 1){
                return {
                    pages: paperbackChapterDetails.pages
                }
            } else if (volumeMatch) {
                return {
                    pages: paperbackChapterDetails.pages,
                    volume: Number(volumeMatch[1]),
                    chapterNum: Number(volumeMatch[2]),
                    title: volumeMatch[4],
                }
            } else if (chapterMatch) {
                return {
                    pages: paperbackChapterDetails.pages,
                    volume: chapter.volume,
                    chapterNum: Number(chapterMatch[1]),
                    title: chapterMatch[3]
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
        log("Batoto", chalk.yellow(`Fetching chapter details for ${chapterId}`))
        const paperbackChapterDetails = await this.wrapper.getChapterDetails(this.source, "fake", chapterId)
        return {
            pages: paperbackChapterDetails.pages,
        }
    }
}