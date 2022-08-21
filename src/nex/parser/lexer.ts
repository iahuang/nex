import { SourceLocation, SourceReference } from "../source";
import { TokenType, Token } from "./token";
import { sum } from "../util";
import { userFriendlyCharacterRepresentation } from "./errors";
import { NexMathKeywords } from "./nex_math/keywords";

export interface LexingModeOptions {
    skipWhitespace: boolean;
    skipNewlines?: boolean;
}

export class LexingMode {
    validTokenTypes: TokenType[];
    options: LexingModeOptions;

    constructor(validTokenTypes: TokenType[], options: LexingModeOptions) {
        this.validTokenTypes = validTokenTypes;
        this.options = options;
    }
}

type MatchFunction = (remainingContent: string) => string | null;

/**
 * Provides information on how to match a given token in a string.
 */
class TokenPattern {
    private _regexPattern: RegExp | null;
    private _exactPattern: string | null;
    private _matchFunction: MatchFunction | null;
    tokenType: TokenType;

    private constructor(
        token: TokenType,
        regex: RegExp | null,
        matcher: MatchFunction | null,
        exact: string | null
    ) {
        this.tokenType = token;
        this._regexPattern = regex;
        this._matchFunction = matcher;
        this._exactPattern = exact;
    }

    /**
     * Create a token pattern via a regex.
     *
     * **NOTE: The provided regex should match only at the start of the string
     * (i.e. the regex should start with `^`), and also be global.
     * Example: `/^abc/g`**
     */
    static createWithRegex(type: TokenType, pattern: RegExp): TokenPattern {
        if (!pattern.global) {
            throw new Error("Provided pattern must be global");
        }

        return new TokenPattern(type, pattern, null, null);
    }

    static createWithMatcher(type: TokenType, matcher: MatchFunction): TokenPattern {
        return new TokenPattern(type, null, matcher, null);
    }

    static createWithStringPattern(type: TokenType, pattern: string): TokenPattern {
        return new TokenPattern(type, null, null, pattern);
    }

    /**
     * Attempt to match the provided string to this token pattern.
     * If successful, return the matched token content string.
     */
    match(remainingContent: string): string | null {
        if (this._regexPattern) {
            let match = remainingContent.match(this._regexPattern);

            if (match) {
                return match[0];
            }
        }

        if (this._matchFunction) {
            return this._matchFunction(remainingContent);
        }

        if (this._exactPattern) {
            if (remainingContent.startsWith(this._exactPattern)) {
                return this._exactPattern;
            }
        }

        return null;
    }

    /**
     * If this token pattern matches an exact string, return that string. Otherwise, return `null`.
     */
    getExpectedTokenContent(): string | null {
        if (this._exactPattern) {
            return this._exactPattern;
        }

        return null;
    }
}

/**
 * Provides patterns for all token types and enables token matching.
 *
 * Call `TokenMatcher.create()` to create a `TokenMatcher` instance fully populated
 * with patterns for all token types.
 */
export class TokenMatcher {
    private _tokenPatterns: Map<TokenType, TokenPattern>;

    private constructor() {
        this._tokenPatterns = new Map();
    }

    addTokenPattern(
        tokenType: TokenType,
        opts: { regex?: RegExp; matcher?: MatchFunction; string?: string }
    ): TokenMatcher {
        if (this._tokenPatterns.has(tokenType)) {
            throw new Error(`Token type ${TokenType[tokenType]} already has a pattern`);
        }

        if (sum([opts.matcher, opts.regex, opts.string].map((n) => (n ? 1 : 0))) !== 1) {
            throw new Error(
                "Token pattern must have exactly one of a regex pattern OR a matching function"
            );
        }

        if (opts.regex) {
            this._tokenPatterns.set(tokenType, TokenPattern.createWithRegex(tokenType, opts.regex));
        }

        if (opts.matcher) {
            this._tokenPatterns.set(
                tokenType,
                TokenPattern.createWithMatcher(tokenType, opts.matcher)
            );
        }

        if (opts.string) {
            this._tokenPatterns.set(
                tokenType,
                TokenPattern.createWithStringPattern(tokenType, opts.string)
            );
        }

        return this;
    }

    getPattern(tokenType: TokenType): TokenPattern {
        let pattern = this._tokenPatterns.get(tokenType);

        if (!pattern) {
            throw new Error(`Token type ${TokenType[tokenType]} does not have a pattern`);
        }

        return pattern;
    }

    /**
     * Attempt to match each token type to the string `remainingContent` in the order
     * given in `tokenTypes`. Return the token content matched by the first matching
     * token type in `tokenTypes` as well as the type of token matched.
     */
    matchToken(
        remainingContent: string,
        tokenTypes: TokenType[]
    ): { tokenContent: string; type: TokenType } | null {
        for (let tokenType of tokenTypes) {
            let matchedTokenString = this.getPattern(tokenType).match(remainingContent);

            if (matchedTokenString !== null) {
                return { tokenContent: matchedTokenString, type: tokenType };
            }
        }

        return null;
    }

    static populated(): TokenMatcher {
        let pattern = new TokenMatcher();
        let keywords = NexMathKeywords.populated();

        return (
            pattern
                .addTokenPattern(TokenType.BlockDeclaration, { regex: /^#(?=\w)/g })
                .addTokenPattern(TokenType.BlockName, { regex: /^\w+/g })
                .addTokenPattern(TokenType.SettingDeclaration, { regex: /^:(?=\w)\b/g })
                .addTokenPattern(TokenType.SettingName, { regex: /^\w+/g })
                // Matches the remaining string to the end of the line
                .addTokenPattern(TokenType.SettingExpression, { regex: /^(.+)?$/gm })
                .addTokenPattern(TokenType.H1, { string: "# " })
                .addTokenPattern(TokenType.H2, { string: "## " })
                .addTokenPattern(TokenType.H3, { string: "### " })
                .addTokenPattern(TokenType.H4, { string: "#### " })
                .addTokenPattern(TokenType.TextCharacter, { regex: /^./g })
                .addTokenPattern(TokenType.ItalicBegin, { regex: /^\*(?! |\n)/g })
                .addTokenPattern(TokenType.ItalicEnd, { regex: /^\*(?! |\n)/g })
                .addTokenPattern(TokenType.BlockMathModeBegin, { string: "$$" })
                .addTokenPattern(TokenType.BlockMathModeEnd, { string: "$$" })
                .addTokenPattern(TokenType.InlineMathModeBegin, { string: "$" })
                .addTokenPattern(TokenType.InlineMathModeEnd, { string: "$" })
                .addTokenPattern(TokenType.EOL, { string: "\n" })
                .addTokenPattern(TokenType.EOF, {
                    matcher: (content) => (content.length === 0 ? "" : null),
                })
                .addTokenPattern(TokenType.BlockBegin, { string: "{" })
                .addTokenPattern(TokenType.BlockEnd, { string: "}" })
                .addTokenPattern(TokenType.CodeBegin, { regex: /^```/g })
                .addTokenPattern(TokenType.LangCodeBegin, { regex: /^```\w+/g })
                .addTokenPattern(TokenType.CodeEnd, { string: "```" })
                .addTokenPattern(TokenType.ShorthandInlineMath, { regex: /^!(?=\w+)/g })
                .addTokenPattern(TokenType.Comment, { string: "//" })
                .addTokenPattern(TokenType.Whitespace, { string: " " })
                .addTokenPattern(TokenType.LatexTextStart, { string: "\\text{" })
                .addTokenPattern(TokenType.LatexEscapedBackslash, { string: "\\\\" })
                .addTokenPattern(TokenType.LatexEscapedCurly, {
                    matcher: (content) => {
                        if (content.startsWith("\\{")) {
                            return "\\{";
                        }

                        if (content.startsWith("\\}")) {
                            return "\\}";
                        }

                        return null;
                    },
                })
                .addTokenPattern(TokenType.LatexEscapedDollarSign, { string: "\\$" })
                .addTokenPattern(TokenType.LatexCurlyStart, { string: "{" })
                .addTokenPattern(TokenType.LatexCurlyEnd, { string: "}" })
                .addTokenPattern(TokenType.LatexCharacter, { regex: /^./g })
                .addTokenPattern(TokenType.NMKeyword, {
                    matcher: (content) => {
                        for (let keyword of keywords.getKeywords()) {
                            if (content.startsWith(keyword.keyword)) {
                                return keyword.keyword;
                            }
                        }

                        return null;
                    },
                })
                .addTokenPattern(TokenType.NMExponent, { string: "^" })
                .addTokenPattern(TokenType.NMSubscript, { string: "_" })
                .addTokenPattern(TokenType.NMFrac, { string: "/" })
                .addTokenPattern(TokenType.NMParenLeft, { string: "(" })
                .addTokenPattern(TokenType.NMParenRight, { string: ")" })
                .addTokenPattern(TokenType.NMBracketLeft, { string: "[" })
                .addTokenPattern(TokenType.NMBracketRight, { string: "]" })
                .addTokenPattern(TokenType.NMCurlyLeft, { string: "{" })
                .addTokenPattern(TokenType.NMCurlyRight, { string: "}" })
                .addTokenPattern(TokenType.NMArgumentSeparator, { string: "," })
                .addTokenPattern(TokenType.NMAlphanumeric, { regex: /^[a-zA-Z.0-9]/g })
                .addTokenPattern(TokenType.NexMathBlockStart, { string: "${" })
                .addTokenPattern(TokenType.NexMathBlockEnd, { string: "}" })
                .addTokenPattern(TokenType.NMQuotationMark, { string: '"' })
                .addTokenPattern(TokenType.NMTextCharacter, { regex: /^./g })
                .addTokenPattern(TokenType.NMMatrixDecl, { string: "mat(" })
        );
    }
}

export class LexingError extends Error {
    location: SourceLocation;
    message: string;

    constructor(location: SourceLocation, message: string) {
        super(message);
        this.location = location;
        this.message = message;
    }
}

export class TokenStream {
    private _content: string;
    readonly source: SourceReference;
    private _lines: string[];
    private _cursor: number;
    tokenMatcher: TokenMatcher;

    private _currentLocation: {
        line: number;
        col: number;
    };

    constructor(source: SourceReference) {
        this._content = source.getContent();
        this._lines = this._content.split("\n");
        this._cursor = 0;
        this.source = source;

        this.tokenMatcher = TokenMatcher.populated();

        this._currentLocation = {
            line: 1,
            col: 1,
        };
    }

    /**
     * Return the length of the loaded content in characters.
     */
    get contentLength(): number {
        return this._content.length;
    }

    /**
     * Return the remaining portion of the loaded content that has not yet been
     * consumed.
     */
    getRemainingContent(): string {
        return this._content.slice(this._cursor);
    }

    /**
     * Given a matched token type and token content, return a token instance
     * and update current source location.
     */
    private _buildToken(tokenType: TokenType, content: string, peek: boolean): Token {
        let token = new Token(
            this.source,
            tokenType,
            new SourceLocation(this.source, this._currentLocation.line, this._currentLocation.col),
            content
        );

        if (!peek) {
            this.consumeToken(token);
        }

        return token;
    }

    /**
     * Consider that on encountering a `TextCharacter` token, we should begin a paragraph.
     * However, the `TextCharacter` token we just consumed should also be part of that
     * paragraph. This method will reverse the consumption process for the passed token,
     * essentially moving the stream location to before the token.
     */
    unconsumeToken(token: Token): void {
        let reverseTokenContent = token.content.split("").reverse();

        for (let c of reverseTokenContent) {
            if (c === "\n") {
                this._currentLocation.col = 1;
                this._currentLocation.line -= 1;
            } else {
                this._currentLocation.col -= 1;
            }

            this._cursor -= 1;
        }
    }

    /**
     * Move the stream location ahead by the length of the token.
     *
     * Update stream location `line` and `col` respectively.
     */
    consumeToken(token: Token): void {
        if (token.type === TokenType.EOL) {
            this._currentLocation.line += 1;
            this._currentLocation.col = 1;
        } else if (token.content.includes("\n")) {
            for (let char of token.content) {
                this._currentLocation.col += 1;

                if (char === "\n") {
                    this._currentLocation.col = 1;
                    this._currentLocation.line += 1;
                }
            }
        } else {
            this._currentLocation.col += token.content.length;
        }

        this._cursor += token.content.length;
    }

    getCurrentSourceLocation(): SourceLocation {
        return new SourceLocation(
            this.source,
            this._currentLocation.line,
            this._currentLocation.col
        );
    }

    /**
     * In certain lexing contexts, whitespace should be ignored.
     *
     * If `remainingContent` is prefixed by whitespace (optionally including newline characters), consume it.
     */
    consumeWhitespace(consumeNewlines: boolean): void {
        while (this.getRemainingContent().length) {
            let nextCharacter = this.getRemainingContent()[0];

            if (nextCharacter === " ") {
                this._currentLocation.col += 1;
                this._cursor += 1;
            } else if (nextCharacter === "\n" && consumeNewlines) {
                this._currentLocation.col = 1;
                this._currentLocation.line += 1;
                this._cursor += 1;
            } else {
                break;
            }
        }
    }

    /**
     * Return the next token in the token stream using the specified lexing mode.
     *
     * If no token was successfully matched, the stream location will not change, and
     * this method will return `null`.
     *
     * If `opts.peek` is `true`, then the stream location will not change.
     */
    nextToken(mode: LexingMode, opts: { peek?: boolean } = {}): Token | null {
        // Attempt to match token before removing whitespace
        let match = this.tokenMatcher.matchToken(this.getRemainingContent(), mode.validTokenTypes);
        let savedPositon = this.getCurrentSourceLocation();
        let savedCursor = this._cursor;
        let peek = opts.peek ?? false;

        if (match) {
            return this._buildToken(match.type, match.tokenContent, peek);
        }

        // Otherwise remove whitespace and try again
        if (mode.options.skipWhitespace) {
            this.consumeWhitespace(Boolean(mode.options.skipNewlines));

            match = this.tokenMatcher.matchToken(this.getRemainingContent(), mode.validTokenTypes);
            if (match) {
                return this._buildToken(match.type, match.tokenContent, peek);
            }
        }

        this._cursor = savedCursor;
        this._currentLocation.col = savedPositon.col;
        this._currentLocation.line = savedPositon.line;

        return null;
    }

    /**
     * Return an error message for use by the parser if the parser is unable
     * to match any tokens (i.e. we assume that the first character of the remaining content
     * is invalid).
     */
    unexpectedTokenErrorMessage(expectedCharacter?: string): string {
        let offendingCharacter = this.getRemainingContent()[0];

        let message = `Unexpected character ${userFriendlyCharacterRepresentation(
            offendingCharacter
        )}`;

        if (expectedCharacter) {
            message += `; expected ${userFriendlyCharacterRepresentation(expectedCharacter)}`;
        }

        if (offendingCharacter === "[EOF]") {
            message += " (missing closing bracket?)";
        }

        return message;
    }
}
