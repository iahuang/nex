import { LexingMode, LexingModeOptions, TokenStream } from "../lexer";
import { SourceLocation, SourceReference } from "../source";
import { Token, TokenType } from "../token";
import { Callout, ContainerElement, Document, Paragraph, Text } from "./ast";

// lexing modes
const MODE_TOPLEVEL = new LexingMode(
    [
        TokenType.BlockDeclaration,
        TokenType.SettingDeclaration,
        TokenType.H1,
        TokenType.H2,
        TokenType.H3,
        TokenType.H4,
        TokenType.BlockMathModeBegin,
        TokenType.LangCodeBegin,
        TokenType.CodeBegin,
        TokenType.InlineMathModeBegin,
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
        TokenType.BlockMathModeBegin,
        TokenType.LangCodeBegin,
        TokenType.CodeBegin,
        TokenType.InlineMathModeBegin,
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
    ],
    {
        skipWhitespace: false,
    }
);

export class SyntaxError {
    location: SourceLocation;
    message: string;

    constructor(location: SourceLocation, message: string) {
        this.location = location;
        this.message = message;
    }
}

export class Warning {
    location: SourceLocation;
    message: string;

    constructor(location: SourceLocation, message: string) {
        this.location = location;
        this.message = message;
    }
}

export class Parser {
    source: SourceReference;
    tokenStream: TokenStream;
    private _warnings: Warning[];

    constructor(source: SourceReference) {
        this.source = source;
        this._warnings = [];
        this.tokenStream = new TokenStream(source);
    }

    getCurrentSourceLocation(): SourceLocation {
        return this.tokenStream.getCurrentSourceLocation();
    }

    /**
     * Throw an unexpected token error at the current location.
     */
    private _unexpectedTokenError(): never {
        throw new SyntaxError(
            this.getCurrentSourceLocation(),
            this.tokenStream.unexpectedTokenError()
        );
    }

    /**
     * To be invoked after a `BlockDeclaration` token is encountered
     */
    private _parseBlock(parent: ContainerElement): void {
        let blockNameToken = this._expectToken(TokenType.BlockName, { skipWhitespace: false });

        // Allowing newlines allows for the following syntax, where the bracket is on
        // the next line (not very pretty, but technically allowed):
        // | #blockname
        // | {
        // |     ...
        // | }
        this._expectToken(TokenType.BlockBegin, {
            skipWhitespace: true,
            allowNewlines: true,
        });

        let blockName = blockNameToken.content;

        // Determine type of block and parse accordingly
        switch (blockName) {
            case "callout":
                this._parseCallout(parent);
                break;
            case "diagram":
                break;
            default:
                throw new SyntaxError(
                    this.getCurrentSourceLocation(),
                    `Unknown block type "${blockName}"`
                );
        }
    }

    /**
     * To be invoked after a `BlockName` token is encountered with content `"callout"`
     * (in the `_parseBlock` method)
     */
    private _parseCallout(parent: ContainerElement): void {
        let callout = new Callout();

        while (true) {
            let token = this.tokenStream.nextToken(MODE_TOPLEVELCALLOUT);

            if (!token) {
                this._unexpectedTokenError();
            }

            this._handleGenericTopLevelToken(token, callout, MODE_TOPLEVELCALLOUT);

            if (token.type === TokenType.BlockEnd) {
                parent.children.push(callout);
                return;
            }
        }
    }

    /**
     * To be invoked when any inline element is encountered.
     */
    private _parseParagraph(
        parent: ContainerElement,
        parentMode: LexingMode,
        startingToken: Token
    ): void {
        let paragraph = new Paragraph();
        this.tokenStream.unconsumeToken(startingToken);

        while (true) {
            this.tokenStream.consumeWhitespace(false);

            // Peek the next token
            let token = this.tokenStream.nextToken(MODE_INLINE, { peek: true });

            // if the next token can't be matched (e.g. EOF, let the parent environment handle it)
            if (!token) {
                parent.children.push(paragraph);
                return;
            }

            switch (token.type) {
                case TokenType.TextCharacter:
                    this._parseText(paragraph);
                    break;
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
                            parent.children.push(paragraph);
                            return;
                        }

                        // If the next token is another EOL, i.e. the paragraph
                        // is followed by a blank line, end the paragraph
                        if (nextToken.type === TokenType.EOL) {
                            parent.children.push(paragraph);
                            return;
                        }

                        // If the next token isn't valid as an inline token, then
                        // we assume that the next token should end the current paragraph
                        // block.
                        if (!MODE_INLINE.validTokenTypes.includes(nextToken.type)) {
                            parent.children.push(paragraph);
                            return;
                        }
                    }
                    break;
                default:
                    // 
                    throw new SyntaxError(this.getCurrentSourceLocation(), `Unrecognized token ${token.content}`);
            }
        }
    }

    private _parseText(parent: Paragraph): void {
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
                this._unexpectedTokenError();
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

                let textElement = new Text();
                textElement.content = text;

                parent.children.push(textElement);

                break;
            }
        }
    }

    /**
     * Handles parsing of setting declarations (e.g. `title: My Document Title`)
     *
     * If the provided token is of type `SettingDeclaration`, then parse
     * the following setting expression and return it; otherwise, return `null`.
     *
     * The passed token should be *peeked*. This method will consume it if necessary.
     */
    private _handleSetting(token: Token): { name: string; settingValue: string } | null {
        if (token.type === TokenType.SettingDeclaration) {
            this.tokenStream.consumeToken(token);

            let settingName = this._expectToken(TokenType.SettingName, {
                skipWhitespace: false,
            });

            this.tokenStream.consumeWhitespace(false);

            let settingExpression = this._expectToken(TokenType.SettingExpression, {
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
    private _handleGenericTopLevelToken(
        token: Token,
        container: ContainerElement,
        parentMode: LexingMode
    ): void {
        switch (token.type) {
            case TokenType.BlockDeclaration:
                this._parseBlock(container);
                break;
            case TokenType.TextCharacter:
                this._parseParagraph(container, parentMode, token);
                break;
        }
    }

    parse(): Document {
        let document = new Document();

        while (true) {
            let token = this.tokenStream.nextToken(MODE_TOPLEVEL);

            if (!token) {
                this._unexpectedTokenError();
            }

            this._handleGenericTopLevelToken(token, document, MODE_TOPLEVEL);

            let setting = this._handleSetting(token);

            if (setting) {
                switch (setting.name) {
                    case "title":
                        document.title = setting.settingValue;
                        break;
                    default:
                        this.addWarning(`Unknown setting name "${setting.name}"`);
                        break;
                }
            }

            if (token.type === TokenType.EOF) {
                break;
            }
        }

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
     * Expect the following token type and return the corresponding Token object.
     *
     * If the token stream is unable to match the specified token type, throw a `SyntaxError`.
     */
    private _expectToken(expectedTokenType: TokenType, options: LexingModeOptions): Token {
        let mode = new LexingMode([expectedTokenType], options);
        let token = this.tokenStream.nextToken(mode);

        if (!token) {
            let expectedPattern = this.tokenStream.tokenMatcher.getPattern(expectedTokenType);
            let expected = expectedPattern.getExpectedTokenContent();

            // If able to provide the expected token content, provide that in the error message.
            if (expected) {
                throw new SyntaxError(
                    this.getCurrentSourceLocation(),
                    this.tokenStream.unexpectedTokenError(expected)
                );
            } else {
                throw new SyntaxError(
                    this.getCurrentSourceLocation(),
                    this.tokenStream.unexpectedTokenError()
                );
            }
        }

        return token;
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

            throw new SyntaxError(this.getCurrentSourceLocation(), message);
        }
    }
}
