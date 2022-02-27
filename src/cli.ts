import sade from 'sade';
import {version} from '../package.json';
import parserMapping from "./parsers";
import Client from "./client";
import {Manga} from "mangadex-full-api";
import {getFilteredChapters, getMultiChapterCliOptions, getSingleChapterCliOptions} from "./cliParsers";
import {homedir} from "os";
import {uuid} from "../site-libs/extensions-gamefuzzy/src/MangaPlus/Utility";
import {mkdir, writeFile} from "fs/promises"

const auth = require("mangadex-full-api/src/auth");

const prog = sade("mangadex-importer")
prog.version(version);

parserMapping.forEach((parser) => {
    let place = prog.command(`${parser.name} manga <url>`)
        .describe(`Import a manga from the ${parser.name} parser.`)
    place.action(async (url) => {
        const client = new Client(parserMapping.get(parser.name)!);
        const manga = await client.parseManga(url)
        await client.login();
        await client.submitManga(manga)
    });

    prog.command(`${parser.name} chapter <mangaId> <url>`)
        .describe(`Import a chapter from the ${parser.name} parser.`)
        .option('-g, --group', 'Groups to import as, seperated by commas (defaults to no-group).')
	.option('-l, --language', 'The language code to set the chapter as (defaults to en).')
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
        .describe(`Import multiple chapters from the ${parser.name} parser.`)
        .option('-g, --group', 'Groups to import as, seperated by commas (defaults to no-group).')
	.option('-l, --language', 'The language code to set the chapter as (defaults to en).')
        .option('-r, --range', 'Chapters to import, seperated by commas (defaults to all). Ranges can be defined using "-".')
        .action(async (mangaId, url, opts) => {
            const client = new Client(parserMapping.get(parser.name)!);
            await client.login();
            const mdManga = await Manga.get(mangaId, false)
            const multiChapterOptions = getMultiChapterCliOptions(opts)
            let chapters = getFilteredChapters(await client.parseMangaChapters(url), multiChapterOptions)
            let startTime = Date.now().valueOf()
            for (const chapter of chapters) {
                if (Date.now().valueOf() - startTime > 1000 * 60 * 10) {
                    startTime = Date.now().valueOf()
                    await auth.refreshToken()
                }
                await client.submitChapter(chapter, mdManga, multiChapterOptions)
            }
        });

    prog.command(`${parser.name} download <url>`)
        .describe(`Download multiple chapters.`)
        .option('-r, --range', 'Chapters to import, seperated by commas (defaults to all). Ranges can be defined using "-".')
        .action(async (url, opts) => {
            const client = new Client(parserMapping.get(parser.name)!);
            const downloadFolder = homedir() + "/Downloads/MangaDex Importer/" + uuid().replace(/-/g, "");
            await mkdir(downloadFolder, {recursive: true})
            const multiChapterOptions = getMultiChapterCliOptions(opts)
            let chapters = getFilteredChapters(await client.parseMangaChapters(url), multiChapterOptions)
            for (let i = 0; i < chapters.length; i++) {
                await mkdir(downloadFolder + "/" + i, {recursive: true})
                const pages = await client.downloadChapter(chapters[i])
                const promises = [];
                for (let j = 0; j < pages.length; j++) {
                    promises.push(writeFile(downloadFolder + "/" + i + "/" + j + ".jpg", pages[j]))
                }
                await Promise.all(promises)
            }
        });
})

prog.parse(process.argv);
