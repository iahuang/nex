import { LexingMode, LexingModeOptions, TokenStream } from "../lexer";
import { SourceLocation, SourceReference } from "../source";
import { Token, TokenType } from "../token";
import { Callout, ContainerElement, Document } from "./ast";

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
        allowWhitespace: true,
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
        allowWhitespace: true,
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
        let blockNameToken = this._expectToken(TokenType.BlockName, { allowWhitespace: false });

        this._expectToken(TokenType.BlockBegin, {
            allowWhitespace: true,
            allowNewlines: true,
        });

        let blockName = blockNameToken.content;

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

    /*
     * To be invoked after a `BlockName` token is encountered with content `"callout"`
     */
    private _parseCallout(parent: ContainerElement): void {
        let callout = new Callout();

        while (true) {
            let token = this.tokenStream.nextToken(MODE_TOPLEVELCALLOUT);

            if (!token) {
                this._unexpectedTokenError();
            }

            this._handleGenericTopLevelToken(token, callout);

            if (token.type === TokenType.BlockEnd) {
                parent.children.push(callout);
                return;
            }
        }
    }

    /**
     * Handles parsing of setting declarations (e.g. `title: My Document Title`)
     *
     * If the provided token is of type `SettingDeclaration`, then parse
     * the following setting expression and return it; otherwise, return `null`.
     */
    private _handleSetting(token: Token): { name: string; settingValue: string } | null {
        if (token.type === TokenType.SettingDeclaration) {
            this.tokenStream.consumeWhitespace(false);

            let settingName = this._expectToken(TokenType.SettingName, {
                allowWhitespace: false,
            });

            let settingExpression = this._expectToken(TokenType.SettingExpression, {
                allowWhitespace: true,
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
    private _handleGenericTopLevelToken(token: Token, container: ContainerElement): void {
        switch (token.type) {
            case TokenType.BlockDeclaration:
                this._parseBlock(container);
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

            this._handleGenericTopLevelToken(token, document);

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
            new LexingMode([TokenType.EOL, TokenType.EOF], { allowWhitespace: true })
        );

        if (!token) {
            let found = this.tokenStream.getRemainingContent()[0];
            let message = `Expected end of line or end of file, but found "${found}"`;

            throw new SyntaxError(this.getCurrentSourceLocation(), message);
        }
    }
}
