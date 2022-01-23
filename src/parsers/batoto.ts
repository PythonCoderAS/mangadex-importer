import Chapter from "../struct/chapter";
import Manga from "../struct/manga";
import Parser from "../struct/parser";
import {BatoTo} from "../../site-libs/extensions-gamefuzzy/src/BatoTo/BatoTo";
import cheerio from "cheerio";
import {APIWrapper, Source} from "paperback-extensions-common";
import "paperback-extensions-common/dist/models/impl_export"

export default class Batoto extends Parser {
    name = "batoto";
    wrapper: APIWrapper = new APIWrapper()
    source: Source = new BatoTo(cheerio)

    private readonly mangaIdRegex = new RegExp("https://bato.to/series/(\\d+)");
    private readonly chapterIdRegex = new RegExp("https://bato.to/chapter/(\\d+)");


    constructor() {
        super();
    }

    async parseManga(url: string): Promise<Manga> {
        const mangaId = url.match(this.mangaIdRegex)![1]
        const paperbackManga = await this.wrapper.getMangaDetails(this.source, mangaId)
        const paperbackChapters = await this.wrapper.getChapters(this.source, mangaId)
        return {
            name: paperbackManga.titles[0],
            altNames: {en: paperbackManga.titles.splice(1)},
            artist: paperbackManga.artist!,
            author: paperbackManga.author!,
            coverUrl: paperbackManga.covers![0],
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
            const paperbackChapterDetails = await this.wrapper.getChapterDetails(this.source, mangaId, chapter.id)
            if (paperbackChapters.length === 1){
                return {
                    pages: paperbackChapterDetails.pages
                }
            } else {
                return {
                    pages: paperbackChapterDetails.pages,
                    volume: chapter.volume,
                    chapter: chapter.chapNum,
                    title: chapter.name,
                }
            }
        }))
    }

    async parseChapter(url: string): Promise<Chapter> {
        const chapterId = url.match(this.chapterIdRegex)![1]
        const paperbackChapterDetails = await this.wrapper.getChapterDetails(this.source, "fake", chapterId)
        return {
            pages: paperbackChapterDetails.pages,
        }
    }
}