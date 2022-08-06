/**
 * NeX main parser.
 */

import { LexingMode, TokenStream } from "../lexer";
import { SourceLocation, SourceReference } from "../source";
import { Token, TokenType } from "../token";
import {
    BlockMath,
    Callout,
    CodeBlock,
    ContainerElement,
    Document,
    Header,
    InlineMath,
    Paragraph,
    Text,
} from "./ast";
import { NexSyntaxError } from "./errors";
import { NexMathParser } from "./nex_math/parser";
import { ParserBase } from "./parser_base";

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

const MODE_INLINE_MATH = new LexingMode(
    [
        TokenType.LatexTextStart,
        TokenType.LatexCurlyStart,
        TokenType.LatexEscapedBackslash,
        TokenType.LatexEscapedCurly,
        TokenType.LatexEscapedDollarSign,
        TokenType.LatexCurlyEnd,
        TokenType.InlineMathModeEnd,
        TokenType.LatexCharacter,
    ],
    {
        skipWhitespace: false,
    }
);

const MODE_BLOCK_MATH = new LexingMode(
    [
        TokenType.LatexEscapedBackslash,
        TokenType.LatexEscapedDollarSign,
        TokenType.BlockMathModeEnd,
        TokenType.EOL,
        TokenType.LatexCharacter,
    ],
    {
        skipWhitespace: false,
    }
);

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
            case "m":
                parent.children.push(new BlockMath(this.nexMathParser.parse()));
                break;
            default:
                throw new NexSyntaxError(
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
            this.tokenStream.consumeWhitespace(false);
            let token = this.tokenStream.nextToken(MODE_TOPLEVELCALLOUT);

            if (!token) {
                this._unexpectedTokenError();
            }

            let setting = this._handleSetting(token);

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
        this.tokenStream.consumeWhitespace(false);

        while (true) {
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
                case TokenType.InlineMathModeBegin:
                    this.tokenStream.consumeToken(token);
                    this._parseInlineMath(paragraph);
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

                        // otherwise, trim leading whitespace and keep parsing the paragraph
                        this.tokenStream.consumeWhitespace(false);

                        // add a space character
                        paragraph.children.push(new Text(" "));
                    }
                    break;
                case TokenType.ShorthandInlineMath:
                    this.tokenStream.consumeToken(token);
                    paragraph.children.push(new InlineMath(token.content.slice(1)));
                    break;
                case TokenType.EOF:
                    parent.children.push(paragraph);
                    return;
                default:
                    this._debug_unhandledTokenError(token);
            }
        }
    }

    private _parseInlineMath(parent: Paragraph): void {
        let latex = "";

        enum Environment {
            Text,
            Curly,
            Math,
        }

        // Parsing inline math is not so simple because nested dollar signs are allowed
        // inside of \text{} blocks.

        // Create a stack; when we enter text mode via \text{}, add Environment.Text
        // to the stack. When we leave text mode via }, pop the last item off the stack,
        // ensuring that it is Environment.Text or Environment.Curly.
        //
        // Similarly, when we encounter a "$" character, if the last item on the stack
        // is an Environment.Math, pop that item off. If there are no items on the stack,
        // return, and otherwise, throw an error.
        //
        // Finally, if we encounter a non-"\text{" "{" character, push Environment.Curly to the
        // stack.
        let stack: Environment[] = [];

        while (true) {
            let token = this.tokenStream.nextToken(MODE_INLINE_MATH);

            if (!token) {
                this._unexpectedTokenError();
            }

            switch (token.type) {
                case TokenType.LatexTextStart:
                    latex += token.content;
                    stack.push(Environment.Text);
                    break;
                case TokenType.LatexCurlyStart:
                    latex += token.content;
                    stack.push(Environment.Curly);
                    break;
                case TokenType.LatexCurlyEnd:
                    latex += token.content;

                    {
                        let popped = stack.pop();

                        if (popped === undefined) {
                            throw new NexSyntaxError(
                                this.getCurrentSourceLocation(),
                                `Unexpected "}"`
                            );
                        } else if (popped === Environment.Math) {
                            throw new NexSyntaxError(
                                this.getCurrentSourceLocation(),
                                `Unexpected "}"`
                            );
                        } else {
                            // ok
                        }
                    }

                    break;
                case TokenType.InlineMathModeEnd:
                    // this case matches a dollar sign token ("$"). this only signifies the end
                    // of the inline math element if the stack is empty. otherwise, this
                    // token may only be terminating an inline math statement.
                    //
                    // In the context of a \text{} environment, this token denotes
                    // the *start* of a math environment.

                    {
                        let currentEnvironment = stack[stack.length - 1];

                        if (currentEnvironment === undefined) {
                            let mathElement = new InlineMath(latex);
                            parent.children.push(mathElement);
                            return;
                        } else if (currentEnvironment === Environment.Text) {
                            latex += token.content;
                            stack.push(Environment.Math);
                        } else if (currentEnvironment === Environment.Math) {
                            latex += token.content;
                            stack.pop();
                        }
                    }
                    break;
                case TokenType.LatexEscapedBackslash:
                    latex += token.content;
                    break;
                case TokenType.LatexEscapedDollarSign:
                    latex += token.content;
                    break;
                case TokenType.LatexEscapedCurly:
                    latex += token.content;
                    break;
                case TokenType.LatexCharacter:
                    latex += token.content;
                    break;
                default:
                    this._debug_unhandledTokenError(token);
            }
        }
    }

    private _parseBlockMath(parent: ContainerElement): void {
        let latex = "";

        while (true) {
            let token = this.tokenStream.nextToken(MODE_BLOCK_MATH);

            if (!token) {
                this._unexpectedTokenError();
            }

            switch (token.type) {
                case TokenType.LatexEscapedBackslash:
                    latex += token.content;
                    break;
                case TokenType.LatexEscapedDollarSign:
                    latex += token.content;
                    break;
                case TokenType.LatexCharacter:
                    latex += token.content;
                    break;
                case TokenType.EOL:
                    latex += token.content;
                    this.tokenStream.consumeWhitespace(false);
                    break;
                case TokenType.BlockMathModeEnd: {
                    let mathElement = new BlockMath(latex);
                    parent.children.push(mathElement);
                    return;
                }
                default:
                    this._debug_unhandledTokenError(token);
            }
        }
    }

    private _parseCodeBlock(parent: Paragraph, language: string | null): void {
        let code = "";

        while (true) {
            let token = this.tokenStream.nextToken(MODE_CODE_BLOCK);

            if (!token) {
                this._unexpectedTokenError();
            }

            switch (token.type) {
                case TokenType.TextCharacter:
                    code += token.content;
                    break;
                case TokenType.EOL:
                    code += token.content;
                    break;
                case TokenType.CodeEnd: {
                    let codeElement = new CodeBlock(code, language);
                    parent.children.push(codeElement);
                    return;
                }
                default:
                    this._debug_unhandledTokenError(token);
            }
        }
    }

    private _parseHeader(parent: ContainerElement, depth: number): void {
        let content = new Paragraph();
        this.tokenStream.consumeWhitespace(false);

        while (true) {
            // Peek the next token
            let token = this.tokenStream.nextToken(MODE_INLINE, { peek: true });

            if (!token) {
                this._unexpectedTokenError();
            }

            switch (token.type) {
                case TokenType.TextCharacter:
                    this._parseText(content);
                    break;
                case TokenType.InlineMathModeBegin:
                    this.tokenStream.consumeToken(token);
                    this._parseInlineMath(content);
                    break;
                case TokenType.EOF:
                    parent.children.push(new Header(depth, content));
                    return;
                case TokenType.EOL:
                    parent.children.push(new Header(depth, content));
                    return;
                default:
                    this._debug_unhandledTokenError(token);
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

                let textElement = new Text(text);

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
     */
    private _handleSetting(token: Token): { name: string; settingValue: string } | null {
        if (token.type === TokenType.SettingDeclaration) {
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
            case TokenType.BlockMathModeBegin:
                this._parseBlockMath(container);
                break;
            case TokenType.CodeBegin:
                this._parseCodeBlock(container, null);
                break;
            case TokenType.LangCodeBegin:
                this._parseCodeBlock(container, token.content.substring(3));
                break;
            case TokenType.TextCharacter:
                this._parseParagraph(container, parentMode, token);
                break;
            case TokenType.H1:
                this._parseHeader(container, 1);
                break;
            case TokenType.H2:
                this._parseHeader(container, 2);
                break;
            case TokenType.H3:
                this._parseHeader(container, 3);
                break;
            case TokenType.H4:
                this._parseHeader(container, 4);
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

            throw new NexSyntaxError(this.getCurrentSourceLocation(), message);
        }
    }
}
