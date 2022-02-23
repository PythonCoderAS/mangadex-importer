import Parser from "../struct/parser";
import {readdir, readFile} from "fs/promises"
import {resolve, basename} from "path"
import Manga from "../struct/manga";
import Chapter from "../struct/chapter";

export default class LocalFS extends Parser {

    name: string = "localfs";
    private readonly volumeChapterRegex = /^Vol(?:ume|\.|)\s*(\d+)\s*(?:Chap|Chapter|Ch\.)\s*([\d.]+)(\s*[:\- ]\s*([\S][\S ]*)|)/i
    private readonly chapterRegex = /^(?:Chap|Chapter|Ch\.)\s*([\d.]+)(\s*[:\- ]\s*([\S][\S ]*)|)/i

    async parseManga(url: string): Promise<Manga> {
        throw Error("Not implemented.");
    }


    async parseMangaChapters(url: string): Promise<Chapter[]> {
        return await Promise.all((await readdir(url)).filter(subdir => !subdir.startsWith(".")).map(subdir => this.parseChapter(url + "/" + subdir)))
    }

    async parseChapter(url: string): Promise<Chapter> {
        const name = basename(url);
        const volumeMatch = name.match(this.volumeChapterRegex)
        const chapterMatch = name.match(this.chapterRegex)
        const pages = (await readdir(url)).filter(file => !file.startsWith(".")).map(file => resolve(url, file))
        if (volumeMatch){
            return {
                volNum: Number(volumeMatch[1]),
                chapterNum: Number(volumeMatch[2]),
                title: volumeMatch[4],
                pages
            }
        } else if (chapterMatch){
            return {
                chapterNum: Number(chapterMatch[1]),
                title: chapterMatch[3],
                pages
            }
        } else {
            return {
                pages
            }
        }
    }

    async downloadPage(url: string): Promise<Buffer> {
        return await readFile(url)
    }
}
