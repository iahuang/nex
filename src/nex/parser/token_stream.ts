import { SourceReference, SourceLocation } from "../source";
import { NexSyntaxError, userFriendlyCharacterRepresentation } from "./errors";
import { TokenType, Token } from "./token";

interface Branch<T> {
    tokenType: TokenType;
    consumeToken?: true;
    handler: (token: Token) => T;
}

interface BranchOptions<T> {
    branches: (false | Branch<T>)[];
    default?: () => T;
}

function expectationName(tokenType: TokenType): string {
    let pattern = tokenType.pattern.pattern;
    if (pattern && pattern !== "\n" && pattern !== "\t") {
        return `${tokenType.name} ("${pattern}")`;
    }

    return tokenType.name;
}

export class TokenStream {
    source: SourceReference;
    sourcePosition: number;
    private _ln: number;
    private _col: number;

    constructor(source: SourceReference) {
        this.source = source;
        this.sourcePosition = 0;
        this._ln = 1;
        this._col = 1;
    }

    /**
     * Return the current source location as a `SourceLocation` object.
     */
    getCurrentLocation(): SourceLocation {
        return {
            source: this.source,
            line: this._ln,
            col: this._col,
        };
    }

    /**
     * Return the contents of the source, but only everything at and past
     * the current source location.
     */
    getRemainingSourceContent(): string {
        return this.source.getContent().slice(this.sourcePosition);
    }

    /**
     * Match the remaining source content against a list of token types, returning
     * a corresponding `Token` object if a match was found. Otherwise, return `null`.
     */
    matchToken(tokenTypes: (TokenType | false | null | undefined)[]): Token | null {
        for (let tokenType of tokenTypes) {
            if (!tokenType) {
                continue;
            }

            let match = tokenType.match(this.getRemainingSourceContent());

            if (match !== null) {
                return new Token(tokenType, match, this.getCurrentLocation());
            }
        }

        return null;
    }

    /**
     * Match the remaining source content against a list of token types, returning
     * a corresponding `Token` object if a match was found. Otherwise, throw a
     * Syntax Error with an optionally specified note.
     */
    matchTokenStrict(tokenTypes: (TokenType | false | null | undefined)[], note?: string): Token {
        let match = this.matchToken(tokenTypes);

        if (!match) {
            this.throwUnmatchedTokenError(
                tokenTypes.filter((n) => Boolean(n)) as TokenType[],
                note
            );
        }

        return match;
    }

    /**
     * Throws a Syntax Error. To be called when a token of one or more specific types was
     * expected, but none were successfully matched. The error message of the syntax error
     *
     */
    throwUnmatchedTokenError(expectedTokenTypes: TokenType[], note?: string): never {
        let nextCharacter = this.getRemainingSourceContent()[0];
        let offendingCharacter = nextCharacter
            ? userFriendlyCharacterRepresentation(nextCharacter)
            : "end of file";
        let expectationMessage = "";

        if (expectedTokenTypes.length === 1) {
            let expectation = expectationName(expectedTokenTypes[0]);

            expectationMessage = `expected ${expectation}`;
        } else if (expectedTokenTypes.length === 2) {
            let expectation1 = expectationName(expectedTokenTypes[0]);
            let expectation2 = expectationName(expectedTokenTypes[1]);
            expectationMessage = `expected ${expectation1} or ${expectation2}`;
        } else {
            let first = expectedTokenTypes
                .slice(0, -1)
                .map((t) => t.name)
                .join(", ");
            let last = expectedTokenTypes[expectedTokenTypes.length - 1].name;
            expectationMessage = `expected ${first}, or ${last}`;
        }

        throw new NexSyntaxError(
            this.getCurrentLocation(),
            `Unexpected ${offendingCharacter}` + "; " + expectationMessage,
            undefined,
            note
        );
    }

    matchTokenAndBranch<T>(opts: BranchOptions<T>): T {
        let tokenTypes = (opts.branches.filter((b) => Boolean(b)) as Branch<T>[]).map(
            (branch) => branch.tokenType
        );

        let match = this.matchToken(tokenTypes);

        if (match) {
            for (let branch of opts.branches) {
                if (!branch) {
                    continue;
                }

                if (branch.tokenType === match.type) {
                    if (branch.consumeToken) {
                        this.consumeToken(match);
                    }

                    return branch.handler(match);
                }
            }
            throw new Error();
        } else {
            if (opts.default) {
                return opts.default();
            }

            this.throwUnmatchedTokenError(tokenTypes);
        }
    }

    /**
     * Match and consume a token of the provided types. If no token was found,
     * throw a Syntax Error with an optionally specified note.
     */
    grabToken(tokenTypes: TokenType[], note?: string): Token {
        let token = this.matchToken(tokenTypes);

        if (!token) {
            this.throwUnmatchedTokenError(tokenTypes, note);
        }

        this.consumeToken(token);

        return token;
    }

    /**
     * Match token; if match was succesful, consume it, and return it, otherwise, do nothing
     * and return null.
     */
    grabOptionalToken(tokenType: TokenType): Token | null {
        let match = this.matchToken([tokenType]);

        if (match) {
            this.consumeToken(match);
            return match;
        }

        return null;
    }

    /**
     * Move source location forward by the length of the token. Throw an error
     * if the token is not located where the current source location is or
     * if the token content does not match the source content.
     *
     * Update `_ln` and `_col` respectively.
     */
    consumeToken(token: Token): void {
        if (this._col !== token.location.col || this._ln !== token.location.line) {
            throw new Error("Cannot consume token; token is not located at current position");
        }

        for (let c of token.content) {
            if (this.source.getContent()[this.sourcePosition] !== c) {
                throw new Error(
                    "Cannot consume token; token content does not match source content"
                );
            }

            this.sourcePosition += 1;
            this._col += 1;

            if (c === "\n") {
                this._ln += 1;
                this._col = 1;
            }
        }
    }

    throwSyntaxError(message: string, where?: Token | SourceLocation, note?: string): never {
        if (where instanceof Token) {
            throw new NexSyntaxError(where.location, message, where, note);
        }
        throw new NexSyntaxError(where ?? this.getCurrentLocation(), message, undefined, note);
    }
}
