export abstract class Element {}

export abstract class ContainerElement extends Element {
    children: Element[];

    constructor() {
        super();

        this.children = [];
    }
}

export class Header extends Element {
    depth: number;
    name: string;

    constructor(depth: number, headerName: string) {
        super();

        this.depth = depth;
        this.name = headerName;
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

export class Paragraph extends ContainerElement {}

/**
 * Valid only as a child element of `Paragraph`.
 */
export class Text extends Element {
    content: string;

    constructor() {
        super();

        this.content = "";
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
