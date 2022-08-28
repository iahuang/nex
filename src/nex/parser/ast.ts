export abstract class Element {
    abstract elementName: string;
}

export abstract class ContainerElement extends Element {
    children: Element[];

    constructor() {
        super();

        this.children = [];
    }
}

export class Header extends Element {
    /**
     * H1: `depth=1`
     *
     * H2: `depth=2`
     *
     * etc.
     */
    depth: number;
    content: Textual[];

    elementName = "header";

    constructor(depth: number, content: Textual[]) {
        super();

        this.depth = depth;
        this.content = content;
    }
}

export class Document extends ContainerElement {
    /**
     * Specified by the `:title` option
     */
    title: string | null;

    elementName = "document";

    constructor() {
        super();
        this.title = null;
    }
}

export class Callout extends ContainerElement {
    /**
     * Specified by the `:title` option
     */
    title: string | null;

    elementName = "callout";

    constructor() {
        super();
        this.title = null;
    }
}

export class CodeBlock extends Element {
    content: string;
    language: string | null;

    elementName = "codeBlock";

    constructor(content: string, language: string | null = null) {
        super();
        this.content = content;
        this.language = language;
    }
}

export class BlockMath extends Element {
    content: string;

    elementName = "blockMath";

    constructor(content: string) {
        super();
        this.content = content;
    }
}

export class Paragraph extends ContainerElement {
    elementName = "paragraph";
}

/**
 * Valid only as a child element of `Paragraph`. Represent some inline text semantic element
 * such as italics or inline math.
 */
export abstract class Textual extends Element {
    content: string;

    constructor(content: string) {
        super();

        this.content = content;
    }
}

export class Text extends Textual {
    elementName = "text";
}
export class Italic extends Textual {
    elementName = "italic";
}
export class InlineMath extends Textual {
    elementName = "inlineMath";
}
export class InlineCode extends Textual {
    elementName = "inlineCode";
}

export class DesmosElement extends Element {
    latexEquation: string;

    elementName = "desmos";

    constructor(latexExpression: string) {
        super();

        this.latexEquation = latexExpression;
    }
}

export class ListItem {
    indent: number;
    content: Element;

    constructor(indent: number, content: Element) {
        this.indent = indent;
        this.content = content;
    }
}

export class List extends Element {
    elementName = "list";
    items: ListItem[];
    ordering: ListOrdering[];
    indent: number;

    constructor(items: ListItem[], indent: number, ordering: ListOrdering[]) {
        super();

        this.items = items;
        this.ordering = ordering;
        this.indent = indent;
    }
}

export enum ListOrdering {
    Bulleted = "*",
    UppercaseLetter = "A",
    LowercaseLetter = "a",
    UppercaseRoman = "I",
    LowercaseRoman = "i",
    Numbered = "1",
}

/**
 * Return `text` with all lines indented by `indent * 4` spaces.
 */
function _indent(text: string, indent: number): string {
    return text
        .split("\n")
        .map((line) => " ".repeat(indent * 4) + line)
        .join("\n");
}

/**
 * Export a JSON-like representation of an AST element and its children
 */
export function astDump(root: Element): string {
    return _dump(root);
}

function _dump(element: Element): string {
    if (element instanceof Textual) {
        return `${element.constructor.name} { ${JSON.stringify(element.content)} }`;
    }

    if (element instanceof ContainerElement) {
        let out: string[] = [`${element.constructor.name} [`];

        for (let child of element.children) {
            out.push(_indent(_dump(child), 1) + ",");
        }

        out.push("]");

        return out.join("\n");
    }

    if (element instanceof List) {
        let out: string[] = ["List ["];

        for (let item of element.items) {
            out.push(_indent(_dump(item.content), 1) + ",");
        }
        out.push("]");

        return out.join("\n");
    }
    return `${element.constructor.name} ${JSON.stringify(element)}`;
}
