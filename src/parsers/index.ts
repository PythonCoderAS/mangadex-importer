import Parser from "../struct/parser";
import Batoto from "./batoto";

const parserMapping: Map<string, Parser> = new Map<string, Parser>();
parserMapping.set("batoto", new Batoto());

export default parserMapping;