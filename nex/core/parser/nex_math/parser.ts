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

import { LexingMode, TokenStream } from "../../lexer";
import { TokenType } from "../../token";
import { NexSyntaxError } from "../errors";
import { ParserBase } from "../parser_base";
import { NexMathKeywords } from "./keywords";

const MODE_NEX_MATH = new LexingMode(
    [
        TokenType.NMKeyword,
        TokenType.NMFrac,
        TokenType.NMExponent,
        TokenType.NMSubscript,
        TokenType.NMParenLeft,
        TokenType.NMCharacter,
    ],
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
 * A MathNode containing LaTeX code verbatim.
 */
export class Verbatim extends MathNode {
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
        return `\\text{${this.content}}`;
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
 */
export class LatexTemplate extends MathNode {
    children: MathNode[];
    template: string;

    constructor(children: MathNode[], template: string) {
        super();
        this.children = children;
        this.template = template;
    }

    asLatex(): string {
        let output = this.template;
        for (let i = 0; i < this.children.length; i++) {
            output = output.replaceAll("$" + i, this.children[i].asLatex());
        }

        return output;
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

    private _parseCharacters(starting: string): Verbatim {
        let content = starting;

        while (true) {
            let token = this.tokenStream.nextToken(MODE_NEX_MATH, { peek: true });

            if (!token) {
                return new Verbatim(content);
            }

            // console.log("PC",token,token.tokenTypeName(),"\n");

            if (token.type === TokenType.NMCharacter) {
                content += token.content;
                this.tokenStream.consumeToken(token);
            } else {
                return new Verbatim(content);
            }
        }
    }

    private _parseNextNode(previousNode: MathNode | null): MathNode {
        while (true) {
            let token = this.tokenStream.nextToken(MODE_NEX_MATH);

            if (!token) {
                this._unexpectedTokenError();
            }

            switch (token.type) {
                case TokenType.NMKeyword:
                    return new Verbatim(this.keywords.getLatexCode(token.content));
                case TokenType.NMCharacter:
                    return this._parseCharacters(token.content);
                case TokenType.NMParenLeft:
                    return new Bracketed(
                        this._parseExpression(TokenType.NMParenRight),
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
                default:
                    this._debug_unhandledTokenError(token);
            }
        }
    }

    private _parseExpression(stopOnTokenType: TokenType): Expression {
        let currentExpression = new Expression([]);

        while (true) {
            this.tokenStream.consumeWhitespace(true);
            let test = this.tokenStream.nextToken(
                new LexingMode([stopOnTokenType], { skipWhitespace: false }),
                { peek: true }
            );

            if (test !== null) {
                this.tokenStream.consumeToken(test);
                return currentExpression;
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
     * To be invoked directly following a `${` or math block start token (`{`).
     *
     * Return the content converted to LaTeX code
     */
    parse(): string {
        return this._parseExpression(TokenType.BlockEnd).asLatex();
    }
}