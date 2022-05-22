import { SourceLocation, SourceReference } from "./source";

enum TokenType {
    // #diagram
    DiagramBlock,
    // #callout
    CalloutBlock,
    // #ul
    ListBlock,
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
    // Any non-semantic text.
    TextLiteral,
    // *
    BoldBegin,
    // *
    BoldEnd,
    // $
    InlineMathModeBegin,
    // $
    InlineMathModeEnd,
    // $$
    BlockMathModeBegin,
    // $$
    BlockMathModeEnd,
    // \n
    Newline,
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

enum LexerContext {
    TopLevel,
}

class Token {
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
}

class TokenStream {
    _content: string;
    readonly source: SourceReference;
    _lines: string[];
    _cursor: number;
    _contextStack: LexerContext[];

    constructor(source: SourceReference) {
        this._content = source.getContent();
        this._lines = this._content.split("\n");
        this._cursor = 0;
        this.source = source;
        this._contextStack = [];
    }

    get _currentContext() {
        return this._contextStack[this._contextStack.length - 1];
    }

    _popContext() {
        return this._contextStack.pop();
    }

    _pushContext(context: LexerContext) {
        this._contextStack.push(context);
    }

    get length() {
        return this._content.length;
    }

    get remainingContent() {
        return this._content.slice(this._cursor);
    }

    nextToken() {
        switch (this._currentContext) {
            case LexerContext.TopLevel: {
                this.handleContext_topLevel();
                break;
            }
            default: {
                throw new Error("Unhandled lexer context: " + LexerContext[this._currentContext]);
            }
        }
    }

    handleContext_topLevel() {}
}
