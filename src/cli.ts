import sade from 'sade';
import {version} from '../package.json';
import parserMapping from "./parsers";
import Client from "./client";
import {Manga} from "mangadex-full-api";

const prog = sade("mangadex-importer")
prog.version(version);

parserMapping.forEach((parser) => {
    let place = prog.command(`${parser.name} manga <url>`)
        .describe(`Import a manga from the ${parser.name} parser.`)
    if (parser.parseMangaChapters) {
        place = place.option('-c, --chapter', 'Import chapters as well as the manga.')
    }
    place.action(async (url, opts) => {
        const client = new Client(parserMapping.get(parser.name)!);
        await client.login();
        // @ts-ignore
        console.log(client)
        const manga = await client.parseManga(url)
        const mdManga = await client.submitManga(manga)
        if (opts.chapter) {
            const chapters = await client.parseMangaChapters(url)
            Promise.all(chapters.map(async (chapter) => {
                await client.submitChapter(chapter, mdManga)
            }))
        }
    });

    prog.command(`${parser.name} chapter <mangaId> <url>`)
        .describe(`Import a chapter from the ${parser.name} parser.`)
        .action(async (mangaId, url) => {
            const client = new Client(parserMapping.get(parser.name)!);
            await client.login();
            const mdManga = await Manga.get(mangaId, false)
            const chapter = await client.parseChapter(url)
            await client.submitChapter(chapter, mdManga)
        });
})

prog.parse(process.argv);