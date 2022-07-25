export abstract class Element {}

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
    content: Paragraph;

    constructor(depth: number, content: Paragraph) {
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

    constructor() {
        super();
        this.title = null;
    }
}


export class CodeBlock extends Element {
    content: string;
    language: string | null;

    constructor(content: string, language: string | null = null) {
        super();
        this.content = content;
        this.language = language;
    }
}


export class BlockMath extends Element {
    content: string;

    constructor(content: string) {
        super();
        this.content = content;
    }
}

export class Paragraph extends ContainerElement {}

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
    constructor(content: string) {
        super(content);
    }
}

export class InlineMath extends Textual {
    constructor(content: string) {
        super(content);
    }
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
export function dump(root: Element): string {
    return _dump(root);
}

function _dump(element: Element): string {
    if (element instanceof Text) {
        return `Text { ${JSON.stringify(element.content)} }`;
    }

    if (element instanceof ContainerElement) {
        let out: string[] = [`${element.constructor.name} [`];

        for (let child of element.children) {
            out.push(_indent(_dump(child), 1) + ",");
        }

        out.push("]");

        return out.join("\n");
    }
    return `${element.constructor.name} ${JSON.stringify(element)}`;
}
