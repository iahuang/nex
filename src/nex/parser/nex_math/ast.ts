import { NexMathKeyword } from "./keywords";

/**
 * A generic math object that can be written as a LaTeX expression.
 */
export abstract class MathNode {
    abstract asLatex(): string;
    /**
     * Return `true` if the content contained in this node is vertically large, i.e.
     * will require the brackets to be scalled via `\left` and `\right` such as in the case
     * where this node contains a fraction, etc.
     */
    abstract isVerticallyLarge(): boolean;
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

    isVerticallyLarge(): boolean {
        return false;
    }
}

export class MathText extends MathNode {
    content: string;

    constructor(content: string) {
        super();
        this.content = content;
    }

    asLatex(): string {
        return `\\text{${latexTextEscape(this.content)}}`;
    }

    isVerticallyLarge(): boolean {
        return false;
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

    isEmpty(): boolean {
        return this.children.length === 0;
    }

    isVerticallyLarge(): boolean {
        for (let node of this.children) {
            if (node.isVerticallyLarge()) {
                return true;
            }
        }
        return false;
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

    isVerticallyLarge(): boolean {
        return true;
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

    isVerticallyLarge(): boolean {
        return this.exponent.isVerticallyLarge() || this.exponent.isVerticallyLarge();
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

    isVerticallyLarge(): boolean {
        return this.sub.isVerticallyLarge() || this.base.isVerticallyLarge();
    }
}

export class KeywordNode extends MathNode {
    arguments: (MathNode | null)[];
    keyword: NexMathKeyword;

    constructor(keyword: NexMathKeyword, kwArgs: (MathNode | null)[]) {
        super();

        this.keyword = keyword;
        this.arguments = kwArgs;
    }

    asLatex(): string {
        let output = this.keyword.latexTemplate;

        for (let i = 0; i < this.arguments.length; i++) {
            output = output.replaceAll(
                "$" + i,
                this.arguments[i] ? this.arguments[i]!.asLatex() : ""
            );
        }

        return output;
    }

    isVerticallyLarge(): boolean {
        return this.keyword.isVerticallyLarge;
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

    isVerticallyLarge(): boolean {
        return true;
    }
}

export class Case extends MathNode {
    expression: Expression;
    condition: Expression | null;

    constructor(expression: Expression, condition: Expression | null) {
        super();

        this.expression = expression;
        this.condition = condition;
    }

    asLatex(): string {
        if (this.condition) {
            return this.expression.asLatex() + " & " + this.condition.asLatex();
        }

        return this.expression.asLatex();
    }

    isVerticallyLarge(): boolean {
        return true;
    }
}

export class Cases extends MathNode {
    cases: Case[];

    constructor(cases: Case[]) {
        super();

        this.cases = cases;
    }

    asLatex(): string {
        return `\\begin{cases}${this.cases.map((c) => c.asLatex()).join(" \\\\ ")}\\end{cases}`;
    }

    isVerticallyLarge(): boolean {
        return true;
    }
}

export enum BracketType {
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
        let requiresScaling = this.isVerticallyLarge();
        let left: string;
        let right: string;

        switch (this.bracketType) {
            case BracketType.Parentheses:
                left = "(";
                right = ")";
                break;
            case BracketType.Square:
                left = "[";
                right = "]";
                break;
            case BracketType.Curly:
                left = "\\{";
                right = "\\}";
                break;
        }

        return requiresScaling
            ? `\\left${left}${this.content.asLatex()}\\right${right}`
            : `${left}${this.content.asLatex()}${right}`;
    }

    isVerticallyLarge(): boolean {
        return this.content.isVerticallyLarge();
    }
}
