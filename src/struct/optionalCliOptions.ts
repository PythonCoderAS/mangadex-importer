import {Range} from "../utils";

/**
 * Extra optional options that can be given by the cli.
 */
export interface BaseOptionalCliOptions {
    groupIds?: string[];
    language?: string;
}

export interface MultiChapterCliOptions extends BaseOptionalCliOptions {
    /**
     * Single numbers are individual chapter #s.
     */
    chapterRanges?: (number | Range)[];
}

export interface SingleChapterCliOptions extends BaseOptionalCliOptions {
    chapterNum?: number;
    volumeNum?: number;
}
