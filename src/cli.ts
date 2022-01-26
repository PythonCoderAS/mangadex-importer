import sade from 'sade';
import {version} from '../package.json';
import parserMapping from "./parsers";
import Client from "./client";
import {Manga} from "mangadex-full-api";
import {getFilteredChapters, getMultiChapterCliOptions, getSingleChapterCliOptions} from "./cliParsers";

const prog = sade("mangadex-importer")
prog.version(version);

parserMapping.forEach((parser) => {
    let place = prog.command(`${parser.name} manga <url>`)
        .describe(`Import a manga from the ${parser.name} parser.`)
    if (parser.parseMangaChapters) {
        place = place
            .option('-c, --chapter', 'Import chapters as well as the manga.')
            .option('-g, --group', 'Groups to import as, seperated by commas (defaults to no-group).')
            .option('-r, --range', 'Chapters to import, seperated by commas (defaults to all). Ranges can be defined using "-".')
    }
    place.example(`${parser.name} manga <url> -c -g "group-uuid-1,group-uuid-2" -r "1-3,5,7,9-11,12.5"`)
    place.action(async (url, opts: any) => {
        const client = new Client(parserMapping.get(parser.name)!);
        const manga = await client.parseManga(url)
        await client.login();
        const mdManga = await client.submitManga(manga)
        if (opts.chapter) {
            const multiChapterOptions = getMultiChapterCliOptions(opts)
            let chapters = getFilteredChapters(await client.parseMangaChapters(url), multiChapterOptions)
            for (const chapter of chapters) {
                await client.submitChapter(chapter, mdManga, multiChapterOptions)
            }
        }
    });

    prog.command(`${parser.name} chapter <mangaId> <url>`)
        .describe(`Import a chapter from the ${parser.name} parser.`)
        .option('-g, --group', 'Groups to import as, seperated by commas (defaults to no-group).')
        .option('-n, --num', 'The chapter number to set on MangaDex (overrides default-selected number).')
        .option('-v, --volume', 'The volume number to set on MangaDex (overrides default-selected number).')
        .action(async (mangaId, url, opts) => {
            const client = new Client(parserMapping.get(parser.name)!);
            await client.login();
            const mdManga = await Manga.get(mangaId, false)
            const chapter = await client.parseChapter(url)
            await client.submitChapter(chapter, mdManga, getSingleChapterCliOptions(opts))
        });

    prog.command(`${parser.name} chapters <mangaId> <url>`)
        .describe(`Import multiple chapter from the ${parser.name} parser.`)
        .option('-g, --group', 'Groups to import as, seperated by commas (defaults to no-group).')
        .option('-r, --range', 'Chapters to import, seperated by commas (defaults to all). Ranges can be defined using "-".')
        .action(async (mangaId, url, opts) => {
            const client = new Client(parserMapping.get(parser.name)!);
            await client.login();
            const mdManga = await Manga.get(mangaId, false)
            const multiChapterOptions = getMultiChapterCliOptions(opts)
            let chapters = getFilteredChapters(await client.parseMangaChapters(url), multiChapterOptions)
            for (const chapter of chapters) {
                await client.submitChapter(chapter, mdManga, multiChapterOptions)
            }
        });
})

prog.parse(process.argv);