import { TokenStream } from "../../lexer";
import { ParserBase } from "../parser_base";

export class NexMathParser extends ParserBase {
    tokenStream: TokenStream;

    constructor(tokenStream: TokenStream) {
        super();

        this.tokenStream = tokenStream;
    }
}
