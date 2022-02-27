import Parser from "../struct/parser";
import LocalFS from "./localfs";

const parserMapping: Map<string, Parser> = new Map<string, Parser>();
parserMapping.set("localfs", new LocalFS())

export default parserMapping;