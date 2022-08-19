import {
    BlockMath,
    Callout,
    CodeBlock,
    DesmosElement,
    Document,
    Element,
    Header,
    InlineMath,
    Paragraph,
    Text,
} from "../parser/ast";
import { ThemeData } from "../theme";
import { FsUtil } from "../util";

const POSTPROC_SCRIPT = `
for (let element of document.querySelectorAll(".inline-math")) {
    katex.render(element.textContent, element, {
        throwOnError: false
    });
}

for (let element of document.querySelectorAll(".block-math")) {
    katex.render(element.textContent, element, {
        throwOnError: false,
        displayMode: true
    });
}

for (let element of document.querySelectorAll(".calculator")) {
    let calculator = Desmos.GraphingCalculator(element, {expressions: false});
    calculator.setExpression({id: "graph1", latex: element.dataset.equation});
}
`;

function escape(htmlStr: string): string {
    return htmlStr
        .replace(/&/g, "&amp;")
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

export class HTMLVerbatim extends HTMLNode {
    innerHTML: string;

    constructor(innerHTML: string) {
        super();
        this.innerHTML = innerHTML;
    }

    asHTML(): string {
        return this.innerHTML;
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
        let childContent = this.children.map((child) => child.asHTML()).join("");
        let attrs = Object.keys(this.attrs)
            .map((attr) => {
                return `${attr}="${this.attrs[attr]}"`;
            })
            .join(" ");
        return `<${this.tagName} ${attrs}>${childContent}</${this.tagName}>`;
    }
}

export function makeElement(
    tagName: string,
    attrs: { [key: string]: string },
    children: HTMLNode[] = []
): HTMLElement {
    let el = new HTMLElement(tagName);
    el.attrs = { ...attrs };
    el.children = [...children];

    return el;
}

export function div(attrs: { [key: string]: string }, children: HTMLNode[] = []): HTMLElement {
    return makeElement("div", attrs, children);
}

export function span(attrs: { [key: string]: string }, children: HTMLNode[] = []): HTMLElement {
    return makeElement("span", attrs, children);
}

export function img(attrs: { [key: string]: string }, children: HTMLNode[] = []): HTMLElement {
    return makeElement("img", attrs, children);
}

export function body(attrs: { [key: string]: string }, children: HTMLNode[] = []): HTMLElement {
    return makeElement("body", attrs, children);
}

export function textNode(content: string): TextNode {
    return new TextNode(content);
}

/**
 * Object for converting NeX documents into HTML
 */
export class HTMLBuilder {
    private _convertDocumentElement(element: Element): HTMLNode {
        if (element instanceof Header) {
            return makeElement("h" + element.depth, {}, [
                ...element.content.children.map((child) => this._convertDocumentElement(child)),
            ]);
        } else if (element instanceof Callout) {
            let callout = div({ class: "callout" });

            if (element.title) {
                callout.children.push(span({ class: "callout-title" }, [textNode(element.title)]));
            }

            for (let child of element.children) {
                callout.children.push(this._convertDocumentElement(child));
            }

            return callout;
        } else if (element instanceof DesmosElement) {
            let desmos = div({
                class: "calculator",
                "data-equation": element.latexEquation,
                style: "width: 600px; height: 400px;",
            });
            return desmos;
        } else if (element instanceof CodeBlock) {
            let codeBlock = makeElement("code", { class: "language-" + element.language }, [
                textNode(element.content),
            ]);

            return makeElement("pre", {}, [codeBlock]);
        } else if (element instanceof BlockMath) {
            let mathBlock = makeElement("div", { class: "block-math" }, [
                textNode(element.content),
            ]);

            return mathBlock;
        } else if (element instanceof Paragraph) {
            let paragraph = makeElement("p", {});

            for (let child of element.children) {
                paragraph.children.push(this._convertDocumentElement(child));
            }

            return paragraph;
        } else if (element instanceof Text) {
            return textNode(element.content);
        } else if (element instanceof InlineMath) {
            return span({ class: "inline-math" }, [textNode(element.content)]);
        }

        throw new Error(`Unsupported semantic element type ${element.constructor.name}`);
    }

    /**
     * Generate a `div` element containing the contents of the provided `Document` instance as HTML.
     *
     * The generated HTML does not represent a complete HTML file, as it does not contain a body or
     * header.
     */
    generateContentsAsHTML(document: Document): HTMLElement {
        let main = div({ class: "main" });

        if (document.title) {
            main.children.push(span({ class: "document-title" }, [textNode(document.title)]));
        }

        for (let child of document.children) {
            main.children.push(this._convertDocumentElement(child));
        }

        return main;
    }

    /**
     * Convert the provided document to a standalone HTML
     * and write its contents to `path`.
     */
    generateStandaloneHTML(document: Document, path: string, themeData: ThemeData): void {
        let stylesheetElement = `<style>${themeData.getPackedCSS()}</style>`;
        let katexStyleElement = `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.0/dist/katex.min.css" crossorigin="anonymous">`;
        let katexSrcElement = `<script src="https://cdn.jsdelivr.net/npm/katex@0.16.0/dist/katex.min.js" integrity="sha384-X/XCfMm41VSsqRNQgDerQczD69XqmjOOOwYQvr/uuC+j4OPoNhVgjdGFwhvN02Ja" crossorigin="anonymous"></script>`;
        let desmosSrcElement = `<script src="https://www.desmos.com/api/v1.7/calculator.js?apiKey=dcb31709b452b1cf9dc26972add0fda6"></script>`;

        let htmlRoot = makeElement("html", {}, [
            new HTMLVerbatim(
                `<head>${katexStyleElement}${katexSrcElement}${stylesheetElement}${desmosSrcElement}</head>`
            ),
            makeElement("body", {}, [
                this.generateContentsAsHTML(document),
                new HTMLVerbatim(`<script>${POSTPROC_SCRIPT}</script>`),
            ]),
        ]);

        FsUtil.write(path, "<!DOCTYPE html>\n" + htmlRoot.asHTML());
    }
}
