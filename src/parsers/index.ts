import Parser from "../struct/parser";
import Batoto from "./batoto";
import Madaradex from "./madaradex";

const parserMapping: Map<string, Parser> = new Map<string, Parser>();
parserMapping.set("batoto", new Batoto());
parserMapping.set("madaradex", new Madaradex())

export default parserMapping;