import axios from 'axios';
import chalk from "chalk";

export async function downloadFile(url: string): Promise<Buffer> {
    log("Utils - Downloader", chalk.cyan(`Downloading binary file ${url}.`));
    const response = await axios.get(url, {
        responseType: 'arraybuffer'
    })
    return Buffer.from(response.data)
}

export function log(section: string, message: string) {
    console.log(chalk.blueBright(`[${section}]`), message)
}

export function splitOnComma(str: string): string[] {
    return str.split(",").map(s => s.trim())
}

export class Range {
    constructor(public start: number, public end: number) {

    }

    inRange(num: number){
        return num >= this.start && num <= this.end
    }

    inRangeExclusive(num: number){
        return num > this.start && num < this.end
    }

    toString(){
        return `${this.start}-${this.end}`
    }
}