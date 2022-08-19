import { SourceLocation } from "../source";
import { NexSyntaxError } from "./errors";
import { TokenStream, LexingModeOptions, LexingMode } from "./lexer";
import { TokenType, Token } from "./token";

/**
 * Provides various basic parser utilities for the
 * various parsing modules
 */
export abstract class ParserBase {
    abstract tokenStream: TokenStream;

    getCurrentSourceLocation(): SourceLocation {
        return { ...this.tokenStream.getCurrentSourceLocation() };
    }

    /**
     * Throw an unexpected token error at the current location.
     */
    unexpectedTokenError(): never {
        this.throwSyntaxError(this.tokenStream.unexpectedTokenErrorMessage());
    }

    /**
     * Expect the following token type and return the corresponding Token object.
     *
     * If the token stream is unable to match the specified token type, throw a `SyntaxError`.
     */
    expectToken(expectedTokenType: TokenType, options: LexingModeOptions): Token {
        let mode = new LexingMode([expectedTokenType], options);
        let token = this.tokenStream.nextToken(mode);

        if (!token) {
            let expectedPattern = this.tokenStream.tokenMatcher.getPattern(expectedTokenType);
            let expected = expectedPattern.getExpectedTokenContent();

            this.tokenStream.consumeWhitespace(false);

            // If able to provide the expected token content, provide that in the error message.
            if (expected) {
                this.throwSyntaxError(this.tokenStream.unexpectedTokenErrorMessage(expected));
            } else {
                this.throwSyntaxError(this.tokenStream.unexpectedTokenErrorMessage());
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
    protected debug_unhandledTokenError(token: Token): never {
        this.throwSyntaxError(
            `Unhandled token "${token.content}" with type ${token.tokenTypeName()}`,
            token
        );
    }

    createSettingHandler(schema: Setting[]): SettingHandler {
        return new SettingHandler(schema, this);
    }

    throwSyntaxError(message: string, at?: SourceLocation | Token): never {
        if (!at) {
            throw new NexSyntaxError(this.getCurrentSourceLocation(), message);
        } else if (at instanceof Token) {
            throw new NexSyntaxError({ ...at.pos }, message);
        } else {
            throw new NexSyntaxError(at, message);
        }
    }
}

interface Setting {
    name: string;
    allowDuplicates: boolean;
    requiresArgument: boolean;
    handler: (parser: ParserBase) => string;
}

export class SettingHandler {
    schema: Setting[];
    private _settings: Map<string, string[]>;
    private _parser: ParserBase;

    constructor(schema: Setting[], parser: ParserBase) {
        this.schema = schema;
        this._settings = new Map();
        this._parser = parser;

        for (let setting of schema) {
            this._settings.set(setting.name, []);
        }
    }

    getSettingInfo(settingName: string): Setting | null {
        for (let setting of this.schema) {
            if (setting.name === settingName) {
                return setting;
            }
        }

        return null;
    }

    getSettingValue(settingName: string): string | null {
        return this._settings.get(settingName)![0] ?? null;
    }

    getSettingValues(settingName: string): string[] {
        return this._settings.get(settingName)!;
    }

    /**
     * To be used as a value for `Setting.handler`. Simply returns the text following
     * the setting declaration and name as a string.
     */
    static basicHandlerFunction(parser: ParserBase): string {
        parser.tokenStream.consumeWhitespace(false);

        return parser.expectToken(TokenType.SettingExpression, { skipWhitespace: false }).content;
    }

    /**
     * To be used as a value for `Setting.handler`. Asserts that no text follows the setting
     * declaration and name.
     */
    static noArgumentHandlerFunction(parser: ParserBase): string {
        parser.expectToken(TokenType.EOL, { skipWhitespace: false });

        return "";
    }

    /**
     * Peek the current token; if it's a setting declaration, handle it accordingly
     * and consume all associated tokens (the ":" token, the token name token, and
     * the contents of the setting name)
     *
     * If a setting declaration was found, return the token corresponding to the setting name.
     */
    parseSettingDeclaration(): Token | null {
        let nextToken = this._parser.tokenStream.nextToken(
            new LexingMode([TokenType.SettingDeclaration], { skipWhitespace: true }),
            { peek: true }
        );

        if (!nextToken) {
            return null;
        }

        this._parser.tokenStream.consumeToken(nextToken);

        let settingName = this._parser.expectToken(TokenType.SettingName, {
            skipWhitespace: false,
        });

        return settingName;
    }

    handle(): void {
        let settingNameToken = this.parseSettingDeclaration();

        if (!settingNameToken) {
            return;
        }

        let settingName = settingNameToken.content;
        let setting = this.getSettingInfo(settingName);

        if (!setting) {
            this._parser.throwSyntaxError(
                `Unrecognized setting name "${settingName}"`,
                settingNameToken
            );
        }

        let settingContent = setting.handler(this._parser);

        // If a setting of this name already exists, confirm that duplicates are allowed
        if (this._settings.get(settingName)!.length > 0 && !setting.allowDuplicates) {
            this._parser.throwSyntaxError(
                `Cannot invoke setting "${settingName}" more than once`,
                settingNameToken
            );
        }

        // Confirm that setting argument is specified, if needed
        if (setting.requiresArgument && !settingContent.trim()) {
            this._parser.throwSyntaxError("Setting argument is required, but none was specified");
        }

        this._settings.get(settingName)!.push(settingContent);
    }
}
