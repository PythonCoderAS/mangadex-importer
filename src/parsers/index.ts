import Parser from "../struct/parser";
import Batoto from "./batoto";
import Madaradex from "./madaradex";
import ToonilyParser from "./toonily";
import Manga18FX from "./manga18fx";
import LocalFS from "./localfs";

const parserMapping: Map<string, Parser> = new Map<string, Parser>();
parserMapping.set("batoto", new Batoto());
parserMapping.set("madaradex", new Madaradex())
parserMapping.set("toonily", new ToonilyParser())
parserMapping.set("manga18fx", new Manga18FX())
parserMapping.set("localfs", new LocalFS())

export default parserMapping;