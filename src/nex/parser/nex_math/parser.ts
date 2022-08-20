/**
 * Parsing extension for NeX math syntax.
 *
 * The NeX math parser and the main NeX syntax parser have been separated
 * for readability.
 *
 * The main NeX parser contains an instance of `NexMathParser` and both
 * share the same `TokenStream` instance. The NeX math parser can therefore
 * be only invoked when needed and can be kept "up-to-date" with the
 * current source location of the main parser.
 */

import { LexingMode, TokenStream } from "../lexer";
import { Token, TokenType } from "../token";
import { NexSyntaxError, userFriendlyCharacterRepresentation } from "../errors";
import { ParserBase } from "../parser_base";
import { NexMathKeywords } from "./keywords";

const MODE_NEX_MATH = new LexingMode(
    [
        TokenType.NMMatrixDecl,
        TokenType.NMKeyword,
        TokenType.NMFrac,
        TokenType.NMExponent,
        TokenType.NMSubscript,
        TokenType.NMParenLeft,
        TokenType.NMAlphanumeric,
        TokenType.NMQuotationMark,
    ],
    {
        skipWhitespace: true,
    }
);

const MODE_NEX_MATH_CHARACTER = new LexingMode(
    [
        TokenType.NMMatrixDecl,
        TokenType.NMFrac,
        TokenType.NMExponent,
        TokenType.NMSubscript,
        TokenType.NMParenLeft,
        TokenType.NMAlphanumeric,
        TokenType.NMKeyword,
        TokenType.NMQuotationMark,
    ],
    {
        skipWhitespace: true,
    }
);

const MODE_NEX_TEXT_ENV = new LexingMode([TokenType.NMQuotationMark, TokenType.NMTextCharacter], {
    skipWhitespace: false,
});

const MODE_NEX_MATH_MATRIX = new LexingMode(
    [TokenType.NMBracketLeft, TokenType.NMParenRight, TokenType.EOL],
    {
        skipWhitespace: true,
    }
);

/**
 * A generic math object that can be written as a LaTeX expression.
 */
export abstract class MathNode {
    abstract asLatex(): string;
}

/**
 * Given an unsafe text string (a string to be enclosed in a `\text{}` environment),
 * escape special characters such as `_` and `$`.
 */
function latexTextEscape(unsafeText: string): string {
    return unsafeText
        .replaceAll("&", "\\&")
        .replaceAll("%", "\\%")
        .replaceAll("$", "\\$")
        .replaceAll("#", "\\#")
        .replaceAll("_", "\\_")
        .replaceAll("{", "\\{")
        .replaceAll("}", "\\}")
        .replaceAll("~", "\\~")
        .replaceAll("^", "\\^")
        .replaceAll("\\", "\\\\");
}

/**
 * A MathNode containing LaTeX code verbatim.
 */
export class VerbatimLatex extends MathNode {
    content: string;

    constructor(content: string) {
        super();
        this.content = content;
    }

    asLatex(): string {
        return this.content;
    }
}

export class Text extends MathNode {
    content: string;

    constructor(content: string) {
        super();
        this.content = content;
    }

    asLatex(): string {
        return `\\text{${latexTextEscape(this.content)}}`;
    }
}

/**
 * A collection of MathNodes.
 *
 * Example: `x + cos y` would be an expression with nodes
 * - `x`
 * - `+`
 * - `cos`
 * - `y`
 */
export class Expression extends MathNode {
    children: MathNode[];

    constructor(children: MathNode[]) {
        super();
        this.children = children;
    }

    asLatex(): string {
        return this.children.map((child) => child.asLatex()).join(" ");
    }
}

/**
 * An expression of the form `A/B` where `A` and `B` are MathNodes.
 */
export class Fraction extends MathNode {
    numerator: MathNode;
    denominator: MathNode;

    constructor(numerator: MathNode, denominator: MathNode) {
        super();

        this.numerator = numerator;
        this.denominator = denominator;
    }

    asLatex(): string {
        return `\\frac{${this.numerator.asLatex()}}{${this.denominator.asLatex()}}`;
    }
}

/**
 * An expression of the form `A^B` where `A` and `B` are MathNodes.
 */
export class Exponent extends MathNode {
    base: MathNode;
    exponent: MathNode;

    constructor(base: MathNode, exponent: MathNode) {
        super();

        this.base = base;
        this.exponent = exponent;
    }

    asLatex(): string {
        return `{${this.base.asLatex()}}^{${this.exponent.asLatex()}}`;
    }
}

/**
 * An expression of the form `A_B` where `A` and `B` are MathNodes.
 */
export class Subscript extends MathNode {
    base: MathNode;
    sub: MathNode;

    constructor(base: MathNode, sub: MathNode) {
        super();

        this.base = base;
        this.sub = sub;
    }

    asLatex(): string {
        return `{${this.base.asLatex()}}_{${this.sub.asLatex()}}`;
    }
}

/**
 * A node representing an argumented Latex expression such as
 * `\frac{A}{B}`, `\sum_{A}^{B}`, `\int_{A}^{B}`, where
 * `A` and `B` are MathNodes.
 *
 * `LatexTemplate.template` defines where the arguments should
 * be placed. For instance, the templace `\frac{$0}{$1}` indicates that
 * the first (zeroth) argument should be placed in the numerator of a,
 * LaTeX fraction, and the second argument in the denominator.
 *
 * This type of MathNode is used to represent NeX math functions.
 */
export class LatexTemplate extends MathNode {
    children: (MathNode | null)[];
    template: string;

    constructor(children: (MathNode | null)[], template: string) {
        super();
        this.children = children;
        this.template = template;
    }

    asLatex(): string {
        let output = this.template;
        for (let i = 0; i < this.children.length; i++) {
            output = output.replaceAll(
                "$" + i,
                this.children[i] ? this.children[i]!.asLatex() : ""
            );
        }

        return output;
    }
}

export class Matrix extends MathNode {
    rows: MathNode[][];

    constructor(rows: MathNode[][]) {
        super();
        this.rows = rows;
    }

    asLatex(): string {
        let content = this.rows
            .map((row) => row.map((cell) => cell.asLatex()).join(" & "))
            .join("\\\\");

        return `\\begin{bmatrix}${content}\\end{bmatrix}`;
    }
}

enum BracketType {
    Parentheses,
    Square,
    Curly,
}

/**
 * Any MathNode enclosed in brackets such as parentheses, square brackets,
 * or curly brackets. Automatically scales the brackets to fit the contents
 * via `\left` and `\right`.
 */
export class Bracketed extends MathNode {
    content: MathNode;
    bracketType: BracketType;

    constructor(content: MathNode, type: BracketType) {
        super();

        this.content = content;
        this.bracketType = type;
    }

    asLatex(): string {
        switch (this.bracketType) {
            case BracketType.Parentheses:
                return `\\left(${this.content.asLatex()}\\right)`;
            case BracketType.Square:
                return `\\left[${this.content.asLatex()}\\right]`;
            case BracketType.Curly:
                return `\\left\\{${this.content.asLatex()}\\right\\}`;
        }
    }
}

function stripParentheses(node: MathNode): MathNode {
    if (node instanceof Bracketed) {
        if (node.bracketType === BracketType.Parentheses) {
            return node.content;
        }
    }

    return node;
}

export class NexMathParser extends ParserBase {
    tokenStream: TokenStream;
    keywords: NexMathKeywords;

    constructor(tokenStream: TokenStream) {
        super();

        this.tokenStream = tokenStream;
        this.keywords = NexMathKeywords.populated();
    }

    private _parseCharacters(starting: string): VerbatimLatex {
        let content = starting;

        while (true) {
            let token = this.tokenStream.nextToken(MODE_NEX_MATH_CHARACTER, { peek: true });

            if (!token) {
                return new VerbatimLatex(content);
            }

            // console.log("PC",token,token.tokenTypeName(),"\n");

            if (token.type === TokenType.NMAlphanumeric) {
                content += token.content;
                this.tokenStream.consumeToken(token);
            } else {
                return new VerbatimLatex(content);
            }
        }
    }

    /**
     * Similar to `unexpectedTokenError`, but with a clearer, NeX math focused error message
     */
    private _unsupportedCharacterError(): never {
        this.tokenStream.consumeWhitespace(false);
        let offendingChracter = this.tokenStream.getRemainingContent()[0];
        this.throwSyntaxError(
            `Character ${userFriendlyCharacterRepresentation(
                offendingChracter
            )} is invalid in NeX math`
        );
    }

    private _parseMatrixRow(): Expression[] {
        let row: Expression[] = [];

        while (true) {
            let nextCell = this._parseExpression([
                TokenType.NMBracketRight,
                TokenType.NMArgumentSeparator,
            ]);

            row.push(nextCell.expression);

            // Check whether we encountered a "]", indicating
            // the end of the passed row cells
            if (nextCell.stoppedOn.type === TokenType.NMBracketRight) {
                break;
            }
        }

        return row;
    }

    private _parseMatrix(): Matrix {
        let rows: Expression[][] = [];

        while (true) {
            let token = this.tokenStream.nextToken(MODE_NEX_MATH_MATRIX);

            if (!token) {
                this.unexpectedTokenError();
            }

            if (token.type === TokenType.NMBracketLeft) {
                let newRow = this._parseMatrixRow();

                // validate that this row has at least one element
                if (newRow.length === 1 && newRow[0].children.length === 0) {
                    this.throwSyntaxError(`Cannot create empty matrix row`, token);
                }

                // validate that this row is the same length as all previous rows
                for (let existingRow of rows) {
                    if (newRow.length !== existingRow.length) {
                        this.throwSyntaxError(
                            `All matrix rows must have the same size; incompatible new row of length ${newRow.length} with existing row(s) of length ${existingRow.length}`,
                            token
                        );
                    }
                }
                rows.push(newRow);
            } else if (token.type === TokenType.NMParenRight) {
                // validate that this matrix has at least one row
                if (rows.length === 0) {
                    this.throwSyntaxError(`Cannot create empty matrix`, token);
                }

                return new Matrix(rows);
            }
        }
    }

    private _parseText(): Text {
        let text = "";

        while (true) {
            let token = this.tokenStream.nextToken(MODE_NEX_TEXT_ENV);

            if (!token) {
                this._unsupportedCharacterError();
            }

            switch (token.type) {
                case TokenType.NMQuotationMark:
                    return new Text(text);
                case TokenType.NMTextCharacter:
                    text += token.content;
                    break;
                default:
                    this.debug_unhandledTokenError(token);
            }
        }
    }

    private _parseNextNode(previousNode: MathNode | null): MathNode {
        while (true) {
            let token = this.tokenStream.nextToken(MODE_NEX_MATH);

            if (!token) {
                this._unsupportedCharacterError();
            }

            switch (token.type) {
                case TokenType.NMKeyword: {
                    let keyword = this.keywords.getKeyword(token.content);

                    // check whether this keyword takes arguments
                    if (keyword.maxArguments > 0) {
                        // this keyword takes arguments; check to see whether if
                        // there are parentheses directly following it, indicating
                        // that there are provided arguments

                        let nextToken = this.tokenStream.nextToken(MODE_NEX_MATH, { peek: true });
                        let providedArguments: (MathNode | null)[] = [];

                        for (let i = 0; i < keyword.maxArguments; i++) {
                            providedArguments.push(null);
                        }

                        if (nextToken && nextToken.type === TokenType.NMParenLeft) {
                            // there seem to be provided arguments, parse as necessary

                            this.tokenStream.consumeToken(nextToken);

                            let argIndex = 0;

                            while (true) {
                                if (argIndex >= keyword.maxArguments) {
                                    throw new NexSyntaxError(
                                        this.getCurrentSourceLocation(),
                                        `Too many arguments provided for NeX math keyword "${keyword.keyword}" (max ${keyword.maxArguments})`
                                    );
                                }

                                let nextArgument = this._parseExpression([
                                    TokenType.NMParenRight,
                                    TokenType.NMArgumentSeparator,
                                ]);

                                providedArguments[argIndex] = nextArgument.expression;

                                // Check whether we encountered a ")", indicating
                                // the end of the passed arguments
                                if (nextArgument.stoppedOn.type === TokenType.NMParenRight) {
                                    break;
                                }

                                argIndex += 1;
                            }
                        }
                        return new LatexTemplate(providedArguments, keyword.latexTemplate);
                    } else {
                        // Otherwise, just return the latex template verbatim
                        return new VerbatimLatex(keyword.latexTemplate);
                    }
                }
                case TokenType.NMAlphanumeric:
                    return this._parseCharacters(token.content);
                case TokenType.NMParenLeft:
                    return new Bracketed(
                        this._parseExpression([TokenType.NMParenRight]).expression,
                        BracketType.Parentheses
                    );
                case TokenType.NMFrac: {
                    if (previousNode === null) {
                        throw new NexSyntaxError(
                            this.getCurrentSourceLocation(),
                            "Missing numerator"
                        );
                    }
                    let denominator = this._parseNextNode(null);

                    return new Fraction(
                        stripParentheses(previousNode),
                        stripParentheses(denominator)
                    );
                }
                case TokenType.NMExponent: {
                    if (previousNode === null) {
                        throw new NexSyntaxError(
                            this.getCurrentSourceLocation(),
                            "Missing base for exponent"
                        );
                    }
                    let exponent = this._parseNextNode(null);

                    return new Exponent(previousNode, stripParentheses(exponent));
                }
                case TokenType.NMSubscript: {
                    if (previousNode === null) {
                        throw new NexSyntaxError(
                            this.getCurrentSourceLocation(),
                            "Missing base for subscript"
                        );
                    }
                    let exponent = this._parseNextNode(null);

                    return new Subscript(previousNode, stripParentheses(exponent));
                }
                case TokenType.NMQuotationMark:
                    return this._parseText();
                case TokenType.NMMatrixDecl:
                    return this._parseMatrix();
                default:
                    this.debug_unhandledTokenError(token);
            }
        }
    }

    /**
     * Sequentially parse MathNodes into an `Expression` MathNode until
     * one of the token types in `stopOnTokenTypes` is reached.
     *
     * Return the compiled `Expression` as well as the token that
     * halted this method.
     */
    private _parseExpression(stopOnTokenTypes: TokenType[]): {
        expression: Expression;
        stoppedOn: Token;
    } {
        let currentExpression = new Expression([]);

        while (true) {
            this.tokenStream.consumeWhitespace(true);
            let test = this.tokenStream.nextToken(
                new LexingMode(stopOnTokenTypes, { skipWhitespace: false }),
                { peek: true }
            );

            if (test !== null) {
                this.tokenStream.consumeToken(test);
                return {
                    expression: currentExpression,
                    stoppedOn: test,
                };
            }

            let nextNode = this._parseNextNode(
                currentExpression.children[currentExpression.children.length - 1] ?? null
            );

            // If the next node is a fraction, exponent, or subscript
            // remove the previous node, since otherwise, for an expression
            // such as `1/x`, we would end up with the nodes `1` and `1/x` separately,
            // where `1` appears twice, both as the numerator of the fraction, and as
            // the node that precedes it.
            if (
                nextNode instanceof Fraction ||
                nextNode instanceof Exponent ||
                nextNode instanceof Subscript
            ) {
                currentExpression.children.pop();
            }

            currentExpression.children.push(nextNode);
        }
    }

    /**
     * To be invoked directly following a `${`.
     *
     * Return the content converted to LaTeX code
     */
    parseBlock(): string {
        return this._parseExpression([TokenType.BlockEnd]).expression.asLatex();
    }

    /**
     * To be invoked directly following a `!`.
     *
     * Return the content converted to LaTeX code
     */
    parseShorthand(): string {
        return this._parseNextNode(null).asLatex();
    }

    /**
     * To be invoked directly following a `$`
     *
     * Return the content converted to LaTeX code
     */
    parseInline(): string {
        return this._parseExpression([TokenType.InlineMathModeEnd]).expression.asLatex();
    }

    /**
     * To be invoked directly following a Desmos `:equation` setting
     *
     * Return the content converted to LaTeX code
     */
    parseSetting(): string {
        return this._parseExpression([TokenType.EOL]).expression.asLatex();
    }
}
