import Chapter from "./chapter";
import Manga from "./manga";
import {downloadFile} from "../utils";

export default abstract class Parser {

    abstract name: string;

    abstract parseManga(url: string): Promise<Manga>;

    parseMangaChapters?(url: string): Promise<Chapter[]>;

    abstract parseChapter(url: string): Promise<Chapter>;

    async downloadPage(url: string): Promise<Buffer>{
        return await downloadFile(url);
    }
}