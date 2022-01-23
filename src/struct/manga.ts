import Rating from "./rating";

export default interface Manga {
    name: string;
    altNames?: { [language: string]: string[] }
    description?: string;
    author: string
    artist: string
    coverUrl: string
    rating?: Rating
    isDoujinshi?: boolean
    isOneshot?: boolean
    originalLanguage?: string
}