import {
    BlockMath,
    Callout,
    CodeBlock,
    Document,
    Element,
    Header,
    InlineCode,
    InlineMath,
    Italic,
    List,
    ListOrdering,
    Paragraph,
    Text,
} from "../parser/ast";
import { createElement, HTMLNode, TextNode } from "./jsx";

interface ElementHTMLTemplate<T extends Element> {
    elementName: string;
    generator: (element: T) => HTMLNode;
}

// TEMPLATES

const TEMPLATE_HEADER: ElementHTMLTemplate<Header> = {
    elementName: "header",
    generator: (header) => {
        // since header.depth only goes up to 4, we don't need to validate anything
        let tagName = "h" + header.depth;

        return createElement(
            tagName,
            {},
            ...header.content.map((child) => elementAsHTMLNode(child))
        );
    },
};

const TEMPLATE_INLINE_CODE: ElementHTMLTemplate<InlineCode> = {
    elementName: "inlineCode",
    generator: (code) => {
        return <code class="inline">{code.content}</code>;
    },
};

const TEMPLATE_CODE_BLOCK: ElementHTMLTemplate<CodeBlock> = {
    elementName: "codeBlock",
    generator: (code) => {
        let language = code.language ?? "text";

        return (
            <pre>
                <code class={"language-" + language}>{code.content}</code>
            </pre>
        );
    },
};

const TEMPLATE_BLOCK_MATH: ElementHTMLTemplate<BlockMath> = {
    elementName: "blockMath",
    generator: (math) => {
        return <div class={"block-math"}>{math.content}</div>;
    },
};

const TEMPLATE_INLINE_MATH: ElementHTMLTemplate<InlineMath> = {
    elementName: "inlineMath",
    generator: (math) => {
        return <span class={"inline-math"}>{math.content}</span>;
    },
};

const TEMPLATE_PARAGRAPH: ElementHTMLTemplate<Paragraph> = {
    elementName: "paragraph",
    generator: (p) => {
        return <p>{p.children.map((c) => elementAsHTMLNode(c))}</p>;
    },
};

const TEMPLATE_TEXT: ElementHTMLTemplate<Text> = {
    elementName: "text",
    generator: (t) => {
        return new TextNode(t.content);
    },
};

const TEMPLATE_ITALIC: ElementHTMLTemplate<Italic> = {
    elementName: "italic",
    generator: (i) => {
        return <em>{i.content}</em>;
    },
};

const TEMPLATE_DOCUMENT: ElementHTMLTemplate<Document> = {
    elementName: "document",
    generator: (document) => {
        return (
            <div class="document">
                <div class="document-title">{document.title && document.title}</div>
                {document.children.map((c) => elementAsHTMLNode(c))}
            </div>
        );
    },
};

const TEMPLATE_LIST: ElementHTMLTemplate<List> = {
    elementName: "list",
    generator: (list) => {
        let ordering = list.ordering[list.indent - 1] ?? ListOrdering.Bulleted;

        if (ordering === ListOrdering.Bulleted) {
            return (
                <ul style="list-style-type: disc;">
                    {list.items.map((item) => {
                        if (item.content.elementName === "list") {
                            return elementAsHTMLNode(item.content);
                        } else {
                            return <li>{elementAsHTMLNode(item.content)}</li>;
                        }
                    })}
                </ul>
            );
        } else {
            return (
                <ol type={ordering}>
                    {list.items.map((item) => {
                        if (item.content.elementName === "list") {
                            return elementAsHTMLNode(item.content);
                        } else {
                            return <li>{elementAsHTMLNode(item.content)}</li>;
                        }
                    })}
                </ol>
            );
        }
    },
};

const TEMPLATE_CALLOUT: ElementHTMLTemplate<Callout> = {
    elementName: "callout",
    generator: (callout) => {
        return (
            <div class="callout">
                {callout.title && <div class="callout-title">{callout.title}</div>}
                <div class="callout-body">{callout.children.map((c) => elementAsHTMLNode(c))}</div>
            </div>
        );
    },
};

// TEMPLATE MAPPING AND GENERATION

const TEMPLATES = [
    TEMPLATE_HEADER,
    TEMPLATE_BLOCK_MATH,
    TEMPLATE_INLINE_MATH,
    TEMPLATE_INLINE_CODE,
    TEMPLATE_CODE_BLOCK,
    TEMPLATE_PARAGRAPH,
    TEMPLATE_TEXT,
    TEMPLATE_ITALIC,
    TEMPLATE_LIST,
    TEMPLATE_DOCUMENT,
    TEMPLATE_CALLOUT
];

const TEMPLATE_MAP: { [k: string]: ElementHTMLTemplate<Element> } = {};

for (let template of TEMPLATES) {
    TEMPLATE_MAP[template.elementName] = template as ElementHTMLTemplate<Element>;
}

export function elementAsHTMLNode(element: Element): HTMLNode {
    let template = TEMPLATE_MAP[element.elementName];

    if (!template) {
        throw new Error(`No template exists for element of type "${element.elementName}"`);
    }

    return template.generator(element);
}
