import { LexingMode, LexingModeOptions, TokenStream } from "../lexer";
import { SourceLocation } from "../source";
import { NexSyntaxError } from "./errors";
import { TokenType, Token } from "../token";

/**
 * Provides various basic parser utilities for the
 * various parsing modules
 */
export abstract class ParserBase {
    abstract tokenStream: TokenStream;

    getCurrentSourceLocation(): SourceLocation {
        return this.tokenStream.getCurrentSourceLocation();
    }

    /**
     * Throw an unexpected token error at the current location.
     */
    protected _unexpectedTokenError(): never {
        throw new NexSyntaxError(
            this.getCurrentSourceLocation(),
            this.tokenStream.unexpectedTokenError()
        );
    }

    /**
     * Expect the following token type and return the corresponding Token object.
     *
     * If the token stream is unable to match the specified token type, throw a `SyntaxError`.
     */
    protected _expectToken(expectedTokenType: TokenType, options: LexingModeOptions): Token {
        let mode = new LexingMode([expectedTokenType], options);
        let token = this.tokenStream.nextToken(mode);

        if (!token) {
            let expectedPattern = this.tokenStream.tokenMatcher.getPattern(expectedTokenType);
            let expected = expectedPattern.getExpectedTokenContent();

            // If able to provide the expected token content, provide that in the error message.
            if (expected) {
                throw new NexSyntaxError(
                    this.getCurrentSourceLocation(),
                    this.tokenStream.unexpectedTokenError(expected)
                );
            } else {
                throw new NexSyntaxError(
                    this.getCurrentSourceLocation(),
                    this.tokenStream.unexpectedTokenError()
                );
            }
        }

        return token;
    }

    /**
     * To be used by parsing functions under the `default` clause of a switch case
     * statement that matches the type of the matched token to the appropriate action.
     *
     * In practice, the token type matching switch statements should be exhaustive, and
     * this error should never occur in production.
     */
    protected _debug_unhandledTokenError(token: Token): never {
        throw new NexSyntaxError(
            this.getCurrentSourceLocation(),
            `Unhandled token "${token.content}" with type ${token.tokenTypeName()}`
        );
    }
}
