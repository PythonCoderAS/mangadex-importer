import Chapter from "../struct/chapter";
import Manga from "../struct/manga";
import Parser from "../struct/parser";
import { Chapter as PaperbackChapter, ChapterDetails } from 'paperback-extensions-common'
import cheerio from "cheerio";
import {APIWrapper, LanguageCode, Source} from "paperback-extensions-common";
import "paperback-extensions-common/dist/models/impl_export"
import {log} from "../utils";
import chalk from "chalk";
import {Madara} from "../../site-libs/extensions-generic/madara/src/Madara";
import {Parser as MadaraParser} from "../../site-libs/extensions-generic/madara/src/MadaraParser";

class Manga18FXParser extends MadaraParser {

    parseChapterList($: CheerioSelector, mangaId: string, source: any): PaperbackChapter[] {
        const chapters: PaperbackChapter[] = []
        let sortingIndex = 0

        // For each available chapter..
        for (const obj of $('ul.row-content-chapter > li').toArray()) {
            const id = ($('a', $(obj)).first().attr('href') || '').replace(`${source.baseUrl}/${source.sourceTraversalPathName}/`, '').replace(/\/$/, '')
            const chapNum = Number(id.match(/\D*(\d*-?\d*)\D*$/)?.pop()?.replace(/-/g, '.'))
            const chapName = $('a', $(obj)).first().text().trim() ?? ''

            let mangaTime: Date
            const timeSelector = $('span.chapter-release-date > a, span.chapter-release-date > span.c-new-tag > a', obj).attr('title')
            if (typeof timeSelector !== 'undefined') {
                //Firstly check if there is a NEW tag, if so parse the time from this
                mangaTime = source.convertTime(timeSelector ?? '')
            } else {
                //Else get the date from the info box
                mangaTime = source.convertTime($('span.chapter-release-date > i', obj).text().trim())
            }

            //Check if the date is a valid date, else return the current date
            if (!mangaTime.getTime()) mangaTime = new Date()

            if (typeof id === 'undefined') {
                throw new Error(`Could not parse out ID when getting chapters for ${mangaId}`)
            }
            chapters.push(createChapter({
                id: id,
                mangaId: mangaId,
                langCode: source.languageCode ?? LanguageCode.UNKNOWN,
                chapNum: Number.isNaN(chapNum) ? 0 : chapNum,
                name: chapName ? chapName : undefined,
                time: mangaTime,
                // @ts-ignore
                sortingIndex
            }))
            sortingIndex--
        }

        return chapters
    }
}

class Manga18FXSource extends Madara {
    baseUrl: string = "https://manga18fx.com";
    languageCode: LanguageCode = LanguageCode.ENGLISH;


    parser: MadaraParser = new Manga18FXParser();

    async getNumericId(mangaId: string): Promise<string> {
        const request = createRequestObject({
            url: `${this.baseUrl}/${this.sourceTraversalPathName}/${mangaId}/`,
            method: 'GET',
            headers: this.constructHeaders()
        })

        const data = await this.requestManager.schedule(request, 1)
        this.CloudFlareError(data.status)
        const numericId = (data.data.match(/'manga_id': (\d+)/) || [])[1]
        if (!numericId) {
            throw new Error(`Failed to parse the numeric ID for ${mangaId}`)
        }
        return numericId;
    }

    async getChapters(mangaId: string): Promise<PaperbackChapter[]> {
        const request = createRequestObject({
            url: `${this.baseUrl}/${this.sourceTraversalPathName}/${mangaId}/`,
            method: 'GET',
            headers: this.constructHeaders({})
        })

        const data = await this.requestManager.schedule(request, 1)
        this.CloudFlareError(data.status)
        const $ = this.cheerio.load(data.data)

        return this.parser.parseChapterList($, mangaId, this)
    }


    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        return super.getChapterDetails(mangaId, chapterId.replace("/manga/", ""));
    }
}

export default class Manga18FX extends Parser {
    name = "manga18fx";
    globalHeaders = {
        "Referer": "https://manga18fx.com/",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36"
    }
    wrapper: APIWrapper = new APIWrapper()
    source: Source = new Manga18FXSource(cheerio)

    private readonly mangaIdRegex = /https:\/\/manga18fx\.com\/manga\/([^/]+)/;
    private readonly chapterIdRegex = /https:\/\/manga18fx\.com\/manga\/[^/]+\/chapter-(\d+)/;

    async parseManga(url: string): Promise<Manga> {
        const mangaId = url.match(this.mangaIdRegex)![1]
        log("Manga18FX", chalk.yellow(`Fetching manga details for ${mangaId}`))
        const paperbackManga = await this.wrapper.getMangaDetails(this.source, mangaId)
        log("Manga18FX", chalk.yellow(`Fetching chapter list for ${mangaId}`))
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
            log("Manga18FX", chalk.yellow(`Fetching chapter details for ${chapter.id}`))
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
        log("Manga18FX", chalk.yellow(`Fetching chapter details for ${chapterId}`))
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
                    log("Manga18FX", chalk.yellow(`Fetching page ${url} failed, retrying`))
                } else {
                    throw e;
                }
            }
        }
    }
}