import {BaseOptionalCliOptions, MultiChapterCliOptions, SingleChapterCliOptions} from "./struct/optionalCliOptions";
import {Range, splitOnComma} from "./utils";
import Chapter from "./struct/chapter";

function getBaseChapterCliOptions(opts: any): BaseOptionalCliOptions {
    const groupIds = splitOnComma(opts.group || "")
    return {
        groupIds: groupIds.length > 0 ? groupIds : undefined,
    }
}

export function getMultiChapterCliOptions(opts: any): MultiChapterCliOptions {
    const chapterParts = splitOnComma(opts.range || "")
    return {
        ...getBaseChapterCliOptions(opts),
        chapterRanges:
            chapterParts.length > 0
                ? chapterParts.map((value =>
                    value.includes("-")
                        ? new Range(...value.split("-").map((num) => Number.parseInt(num)) as [number, number])
                        : Number.parseInt(value)))
                : undefined,
    }
}

export function getSingleChapterCliOptions(opts: any): SingleChapterCliOptions {
    return {
        ...getBaseChapterCliOptions(opts),
        chapterNum: Number.isNaN(opts.num) ? undefined : Number.parseInt(opts.num),
        volumeNum: Number.isNaN(opts.volume) ? undefined : Number.parseInt(opts.volume),
    }
}

export function getFilteredChapters(chapters: Chapter[], opts: MultiChapterCliOptions): Chapter[] {
    if ((opts.chapterRanges?.length || 0) > 0) {
        return chapters.filter((chapter) => {
            return opts.chapterRanges!.some((range) => {
                return chapter.chapterNum
                    && (typeof range === "number"
                        ? range === chapter.chapterNum
                        : range.inRange(chapter.chapterNum))
            })
        })
    } else {
        return chapters;
    }
}