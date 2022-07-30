function escape(htmlStr: string): string {
    return htmlStr.replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#39;");        
 
 }
 

export abstract class HTMLNode {
    children: HTMLNode[];

    constructor() {
        this.children = [];
    }

    abstract asHTML(): string;
}

export class TextNode extends HTMLNode {
    content: string;

    constructor(content: string) {
        super();

        this.content = content;
    }

    asHTML(): string {
        return escape(this.content);
    }

}

export class HTMLElement extends HTMLNode {
    tagName: string;
    attrs: { [key: string]: string };

    constructor(tagName: string) {
        super();

        this.tagName = tagName;
        this.attrs = {};
    }

    asHTML(): string {
        let childContent = this.children.map((child) => child.asHTML()).join(" ");
        let attrs = Object.keys(this.attrs)
            .map((attr) => {
                return `${attr}=${JSON.stringify(this.attrs[attr])}`;
            })
            .join(" ");
        return `<${this.tagName} ${attrs}>${childContent}</${this.tagName}>`;
    }
}

export function makeElement(tagName: string, attrs: {[key: string]: string}, children: HTMLNode[] = []): HTMLElement {
    let el = new HTMLElement(tagName);
    el.attrs = {...attrs};
    el.children = [...children];

    return el;
}

export function div(attrs: {[key: string]: string}, children: HTMLNode[] = []): HTMLElement {
    return makeElement("div", attrs, children);
}

export function span(attrs: {[key: string]: string}, children: HTMLNode[] = []): HTMLElement {
    return makeElement("span", attrs, children);
}

export function img(attrs: {[key: string]: string}, children: HTMLNode[] = []): HTMLElement {
    return makeElement("img", attrs, children);
}

export function body(attrs: {[key: string]: string}, children: HTMLNode[] = []): HTMLElement {
    return makeElement("body", attrs, children);
}

export function textNode(content: string): TextNode {
    return new TextNode(content);
}