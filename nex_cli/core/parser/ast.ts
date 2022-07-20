export abstract class Element {

}

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
        super()
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

export class Paragraph extends ContainerElement {

}

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