/**
 * NeX main parser.
 */

import { SourceLocation, SourceReference } from "../source";
import {
    BlockMath,
    Callout,
    CodeBlock,
    DesmosElement,
    Document,
    Element,
    Header,
    InlineMath,
    Paragraph,
    Text,
} from "./ast";
import { LexingMode, TokenStream } from "./lexer";
import { NexMathParser } from "./nex_math/parser";
import { ParserBase, SettingHandler } from "./parser_base";
import { TokenType, Token } from "./token";

// lexing modes
const MODE_TOPLEVEL = new LexingMode(
    [
        TokenType.BlockDeclaration,
        TokenType.SettingDeclaration,
        TokenType.H1,
        TokenType.H2,
        TokenType.H3,
        TokenType.H4,
        TokenType.NexMathBlockStart,
        TokenType.LangCodeBegin,
        TokenType.CodeBegin,
        TokenType.EOF,
        TokenType.EOL,
        TokenType.TextCharacter,
    ],
    {
        skipWhitespace: true,
    }
);

const MODE_TOPLEVELCALLOUT = new LexingMode(
    [
        TokenType.BlockDeclaration,
        TokenType.SettingDeclaration,
        TokenType.H1,
        TokenType.H2,
        TokenType.H3,
        TokenType.H4,
        TokenType.NexMathBlockStart,
        TokenType.LangCodeBegin,
        TokenType.CodeBegin,
        TokenType.BlockEnd,
        TokenType.EOL,
        TokenType.TextCharacter,
    ],
    {
        skipWhitespace: true,
    }
);

const MODE_INLINE = new LexingMode(
    [
        TokenType.ItalicBegin,
        TokenType.InlineMathModeBegin,
        TokenType.ShorthandInlineMath,
        TokenType.TextCharacter,
        TokenType.EOL,
        TokenType.EOF,
    ],
    {
        skipWhitespace: false,
    }
);

const MODE_DESMOS_BLOCK = new LexingMode([TokenType.BlockEnd, TokenType.EOL], {
    skipWhitespace: true,
});

const MODE_CODE_BLOCK = new LexingMode(
    [TokenType.CodeEnd, TokenType.EOL, TokenType.TextCharacter],
    {
        skipWhitespace: false,
    }
);

export class Warning {
    location: SourceLocation;
    message: string;

    constructor(location: SourceLocation, message: string) {
        this.location = location;
        this.message = message;
    }
}

export class Parser extends ParserBase {
    source: SourceReference;
    tokenStream: TokenStream;
    nexMathParser: NexMathParser;
    private _warnings: Warning[];

    constructor(source: SourceReference) {
        super();

        this.source = source;
        this._warnings = [];
        this.tokenStream = new TokenStream(source);
        this.nexMathParser = new NexMathParser(this.tokenStream);
    }

    /**
     * To be invoked after a `BlockDeclaration` token is encountered
     */
    private _parseBlock(): Element {
        let blockNameToken = this.expectToken(TokenType.BlockName, { skipWhitespace: false });

        // Allowing newlines allows for the following syntax, where the bracket is on
        // the next line (not very pretty, but technically allowed):
        // | #blockname
        // | {
        // |     ...
        // | }
        this.expectToken(TokenType.BlockBegin, {
            skipWhitespace: true,
            skipNewlines: true,
        });

        let blockName = blockNameToken.content;

        // Determine type of block and parse accordingly
        switch (blockName) {
            case "callout":
                return this._parseCallout();
            case "desmos":
                return this._parseDesmos();
            default:
                this.throwSyntaxError(`Unknown block type "${blockName}"`, blockNameToken);
        }
    }

    /**
     * To be invoked after a `BlockName` token is encountered with content `"callout"`
     * (in the `_parseBlock` method)
     */
    private _parseCallout(): Callout {
        let callout = new Callout();

        while (true) {
            this.tokenStream.consumeWhitespace(false);
            let token = this.tokenStream.nextToken(MODE_TOPLEVELCALLOUT);

            if (!token) {
                this.unexpectedTokenError();
            }

            let setting = this._parseSetting(token);

            if (setting) {
                switch (setting.name) {
                    case "title":
                        callout.title = setting.settingValue;
                        break;
                    default:
                        this.addWarning(`Unknown setting name "${setting.name}"`);
                        break;
                }
            }

            let element = this._parseTopLevelToken(token, MODE_TOPLEVELCALLOUT);

            if (element) {
                callout.children.push(element);
            }

            if (token.type === TokenType.BlockEnd) {
                return callout;
            }
        }
    }

    private _parseDesmos(): DesmosElement {
        let start = this.getCurrentSourceLocation();
        let settingHandler = this.createSettingHandler([
            {
                name: "equation",
                allowDuplicates: true,
                requiresArgument: true,
                handler: () => {
                    this.expectToken(TokenType.InlineMathModeBegin, { skipWhitespace: true });
                    return this.nexMathParser.parseInline();
                },
            },
        ]);

        while (true) {
            settingHandler.handle();

            let token = this.tokenStream.nextToken(MODE_DESMOS_BLOCK);

            if (!token) {
                this.unexpectedTokenError();
            }

            switch (token.type) {
                case TokenType.BlockEnd: {
                    let equation = settingHandler.getSettingValue("equation");

                    if (!equation) {
                        this.throwSyntaxError("Desmos block must have an equation", start);
                    }
                    return new DesmosElement(equation);
                }
            }
        }
    }

    /**
     * To be invoked when any inline element is encountered.
     */
    private _parseParagraph(parentMode: LexingMode, startingToken: Token): Paragraph {
        let paragraph = new Paragraph();
        this.tokenStream.unconsumeToken(startingToken);
        this.tokenStream.consumeWhitespace(false);

        while (true) {
            // Peek the next token
            let token = this.tokenStream.nextToken(MODE_INLINE, { peek: true });

            // if the next token can't be matched (e.g. EOF, let the parent environment handle it)
            if (!token) {
                return paragraph;
            }

            switch (token.type) {
                case TokenType.TextCharacter:
                    paragraph.children.push(this._parseText());
                    break;
                case TokenType.InlineMathModeBegin: {
                    this.tokenStream.consumeToken(token);
                    let latex = this.nexMathParser.parseInline();
                    paragraph.children.push(new InlineMath(latex));
                    break;
                }
                case TokenType.EOL:
                    // consume the token we peeked so we can peek the token after that
                    this.tokenStream.consumeToken(token);

                    // Paragraphs can potentially span multiple lines.
                    //
                    // Peek next token in the context of the containing block;
                    // if the next token would end the paragraph,
                    // (i.e. the next token is another EOL, an EOF, a the start of a block, etc.)
                    // then return.
                    {
                        // enclosed in a block (https://eslint.org/docs/latest/rules/no-case-declarations)

                        let nextToken = this.tokenStream.nextToken(parentMode, { peek: true });

                        // If, for whatever reason, we can't match any tokens,
                        // end the paragraph.
                        if (!nextToken) {
                            return paragraph;
                        }

                        // If the next token is another EOL, i.e. the paragraph
                        // is followed by a blank line, end the paragraph
                        if (nextToken.type === TokenType.EOL) {
                            return paragraph;
                        }

                        // If the next token isn't valid as an inline token, then
                        // we assume that the next token should end the current paragraph
                        // block.
                        if (!MODE_INLINE.validTokenTypes.includes(nextToken.type)) {
                            return paragraph;
                        }

                        // otherwise, trim leading whitespace and keep parsing the paragraph
                        this.tokenStream.consumeWhitespace(false);

                        // add a space character
                        paragraph.children.push(new Text(" "));
                    }
                    break;
                case TokenType.ShorthandInlineMath:
                    this.tokenStream.consumeToken(token);
                    paragraph.children.push(new InlineMath(this.nexMathParser.parseShorthand()));
                    break;
                case TokenType.EOF:
                    return paragraph;
                default:
                    this.debug_unhandledTokenError(token);
            }
        }
    }

    private _parseCodeBlock(language: string | null): CodeBlock {
        let code = "";

        while (true) {
            let token = this.tokenStream.nextToken(MODE_CODE_BLOCK);

            if (!token) {
                this.unexpectedTokenError();
            }

            switch (token.type) {
                case TokenType.TextCharacter:
                    code += token.content;
                    break;
                case TokenType.EOL:
                    code += token.content;
                    break;
                case TokenType.CodeEnd: {
                    return new CodeBlock(code, language);
                }
                default:
                    this.debug_unhandledTokenError(token);
            }
        }
    }

    private _parseHeader(depth: number): Header {
        let content = new Paragraph();
        this.tokenStream.consumeWhitespace(false);

        while (true) {
            // Peek the next token
            let token = this.tokenStream.nextToken(MODE_INLINE, { peek: true });

            if (!token) {
                this.unexpectedTokenError();
            }

            switch (token.type) {
                case TokenType.TextCharacter:
                    content.children.push(this._parseText());
                    break;
                case TokenType.InlineMathModeBegin:
                    this.tokenStream.consumeToken(token);
                    content.children.push(new InlineMath(this.nexMathParser.parseInline()));
                    break;
                case TokenType.EOF:
                    return new Header(depth, content);
                case TokenType.EOL:
                    return new Header(depth, content);
                default:
                    this.debug_unhandledTokenError(token);
            }
        }
    }

    private _parseText(): Text {
        let text = "";

        while (true) {
            // When we get the next token as an inline token, there are only three possibilities
            // for the type of token we get:
            //  - a TextCharacter token
            //  - a token denoting the start of some inline formatting element such as inline math,
            //    italics, etc.
            //  - EOL
            //
            // we peek this token so we can decide whether to consume it later.
            let token = this.tokenStream.nextToken(MODE_INLINE, { peek: true });

            if (!token) {
                this.unexpectedTokenError();
            }

            if (token.type === TokenType.TextCharacter) {
                // if we encounter a text character, consume it and add it to the text
                // element we're building

                text += token.content;
                this.tokenStream.consumeToken(token);
            } else {
                // otherwise, we assume this token to be the end of the text element.
                // we build the `Text` element object and add it to the parent without
                // consuming the token we just found (we leave it to the parent environment)
                // to deal with.

                let textElement = new Text(text);

                return textElement;
            }
        }
    }

    /**
     * Handles parsing of setting declarations (e.g. `title: My Document Title`)
     *
     * If the provided token is of type `SettingDeclaration`, then parse
     * the following setting expression and return it; otherwise, return `null`.
     *
     */
    private _parseSetting(token: Token): { name: string; settingValue: string } | null {
        if (token.type === TokenType.SettingDeclaration) {
            let settingName = this.expectToken(TokenType.SettingName, {
                skipWhitespace: false,
            });

            this.tokenStream.consumeWhitespace(false);

            let settingExpression = this.expectToken(TokenType.SettingExpression, {
                skipWhitespace: true,
            });

            this._expectEndOfStatement();

            return {
                name: settingName.content,
                settingValue: settingExpression.content,
            };
        }

        return null;
    }

    /**
     * Handle parsing of elements that can exist in any top-level context
     * (callout blocks, block math, etc.). Does not handle context-specific elements,
     * i.e. list item elements inside of list blocks.
     */
    private _parseTopLevelToken(token: Token, parentMode: LexingMode): Element | null {
        switch (token.type) {
            case TokenType.BlockDeclaration:
                return this._parseBlock();
            case TokenType.NexMathBlockStart:
                return new BlockMath(this.nexMathParser.parseBlock());
            case TokenType.CodeBegin:
                return this._parseCodeBlock(null);
            case TokenType.LangCodeBegin:
                return this._parseCodeBlock(token.content.substring(3));
            case TokenType.TextCharacter:
                return this._parseParagraph(parentMode, token);
            case TokenType.H1:
                return this._parseHeader(1);
            case TokenType.H2:
                return this._parseHeader(2);
            case TokenType.H3:
                return this._parseHeader(3);
            case TokenType.H4:
                return this._parseHeader(4);
        }

        return null;
    }

    parse(): Document {
        let settingHandler = this.createSettingHandler([
            {
                name: "title",
                allowDuplicates: false,
                requiresArgument: true,
                handler: SettingHandler.basicHandlerFunction,
            },
        ]);
        let document = new Document();

        while (true) {
            settingHandler.handle();

            let token = this.tokenStream.nextToken(MODE_TOPLEVEL);

            if (!token) {
                this.unexpectedTokenError();
            }

            let element = this._parseTopLevelToken(token, MODE_TOPLEVEL);

            if (element) {
                document.children.push(element);
            }

            if (token.type === TokenType.EOF) {
                break;
            }
        }

        document.title = settingHandler.getSettingValue("title");

        return document;
    }

    /**
     * Add a warning at the specified location (current source location by default)
     */
    addWarning(message: string, location?: SourceLocation): void {
        if (!location) {
            this._warnings.push(new Warning(this.getCurrentSourceLocation(), message));
        } else {
            this._warnings.push(new Warning(location, message));
        }
    }

    /**
     * Expect the next token to be an end of line or end of file token. Trailing whitespace is allowed.
     * Throw a `SyntaxError` if this is not the case.
     */
    private _expectEndOfStatement(): void {
        let token = this.tokenStream.nextToken(
            new LexingMode([TokenType.EOL, TokenType.EOF], { skipWhitespace: true })
        );

        if (!token) {
            let found = this.tokenStream.getRemainingContent()[0];
            let message = `Expected end of line or end of file, but found "${found}"`;

            this.throwSyntaxError(message);
        }
    }
}
