import { SourceReference, SourceLocation } from "./source";

export enum TokenType {
    // #diagram
    DiagramBlock,

    // a "#" followed by a letter (not included)
    BlockDeclaration,

    // The name of the block (string following a "#" character)
    BlockName,

    // :
    Setting,

    // <name>
    SettingName,

    // Content following an setting ":setting"
    SettingExpression,

    // # <text>
    H1,

    // ## <text>
    H2,

    // ### <text>
    H3,

    // #### <text>
    H4,

    // Any non-semantic text.
    TextLiteral,

    // *
    ItalicBegin,

    // *
    ItalicEnd,

    // $
    InlineMathModeBegin,

    // $
    InlineMathModeEnd,

    // $$
    BlockMathModeBegin,

    // $$
    BlockMathModeEnd,

    // \n
    EOL,

    // End of file
    EOF,

    // {
    BlockBegin,

    // }
    BlockEnd,

    // ```
    CodeBegin,

    // ```<lang>
    LangCodeBegin,

    // ```
    CodeEnd,

    // stuff inside #script blocks and the like
    EmbeddedText,

    // !<content>
    ShorthandInlineMath,

    // //
    Comment,
}

export class Token {
    readonly source: SourceReference;
    readonly type: TokenType;
    readonly pos: SourceLocation;
    readonly content: string;

    constructor(source: SourceReference, type: TokenType, pos: SourceLocation, content: string) {
        this.source = source;
        this.type = type;
        this.pos = pos;
        this.content = content;
    }

    /**
     * Return the name of the token type as a string, e.g. `"DiagramBlock"`.
     */
    tokenTypeName(): string {
        return TokenType[this.type];
    }
}
