export abstract class Element {

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

export class Document {
    /**
     * Specified by the `:title` option
     */
    title: string | null;
    elements: Element[];

    constructor() {
        this.title = null;
        this.elements = [];
    }
}

export class Callout {
    /**
     * Specified by the `:title` option
     */
    title: string | null;
    elements: Element[];

    constructor() {
        this.title = null;
        this.elements = [];
    }
}