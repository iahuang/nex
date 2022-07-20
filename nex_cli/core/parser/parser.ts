import { LexingMode, TokenStream } from "../lexer";
import { SourceLocation, SourceReference } from "../source";
import { Token, TokenType } from "../token";
import { Document } from "./ast";

// lexing modes
const MODE_TOPLEVEL = new LexingMode([
    TokenType.DiagramBlock,
    TokenType.CalloutBlock
], true);

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
        throw new SyntaxError(this.getCurrentSourceLocation(), this.tokenStream.unexpectedTokenError());
    }

    parse(): Document {
        let document = new Document();

        while (true) {
            let token = this.tokenStream.nextToken(MODE_TOPLEVEL);

            if (!token) {
                this._unexpectedTokenError();
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
    private _expectToken(expectedTokenType: TokenType, allowWhitespace = true): Token {
        let mode = new LexingMode([expectedTokenType], allowWhitespace);

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
}
