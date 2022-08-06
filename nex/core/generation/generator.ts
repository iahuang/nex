import {
    BlockMath,
    Callout,
    CodeBlock,
    Document,
    Element,
    Header,
    InlineMath,
    Paragraph,
    Text,
} from "../parser/ast";
import { div, HTMLElement, HTMLNode, makeElement, span, textNode } from "./html";

export class HTMLGenerator {
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
}
