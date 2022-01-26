import Chapter from "../struct/chapter";
import Manga from "../struct/manga";
import Parser from "../struct/parser";
import {MadaraDex} from "../../site-libs/extensions-generic/madara/src/MadaraDex/MadaraDex";
import cheerio from "cheerio";
import {APIWrapper, Source} from "paperback-extensions-common";
import "paperback-extensions-common/dist/models/impl_export"
import {log} from "../utils";
import chalk from "chalk";

export default class Madaradex extends Parser {
    name = "madaradex";
    wrapper: APIWrapper = new APIWrapper()
    source: Source = new MadaraDex(cheerio)

    private readonly mangaIdRegex = /https:\/\/madaradex\.org\/title\/([^/]+)/;
    private readonly chapterIdRegex = /https:\/\/madaradex\.org\/title\/[^/]+\/chapter-(\d+)/;

    async parseManga(url: string): Promise<Manga> {
        const mangaId = url.match(this.mangaIdRegex)![1]
        log("MadaraDex", chalk.yellow(`Fetching manga details for ${mangaId}`))
        const paperbackManga = await this.wrapper.getMangaDetails(this.source, mangaId)
        log("MadaraDex", chalk.yellow(`Fetching chapter list for ${mangaId}`))
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
            log("MadaraDex", chalk.yellow(`Fetching chapter details for ${chapter.id}`))
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
        log("MadaraDex", chalk.yellow(`Fetching chapter details for ${chapterId}`))
        const paperbackChapterDetails = await this.wrapper.getChapterDetails(this.source, "fake", chapterId)
        return {
            pages: paperbackChapterDetails.pages,
        }
    }
}