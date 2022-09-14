import {
    BlockMath,
    Bold,
    Callout,
    CodeBlock,
    DesmosElement,
    Document,
    Element,
    Group,
    Header,
    InlineCode,
    InlineMath,
    Italic,
    List,
    ListOrdering,
    Paragraph,
    Row,
    Table,
    Text,
} from "../parser/ast";
import { DocumentMetadata } from "./document_metadata";
import { createElement, HTMLNode, TextNode } from "./jsx";

interface ElementHTMLTemplate<T extends Element> {
    elementName: string;
    generator: (element: T, elementBuilder: ElementBuilder) => HTMLNode;
}

// TEMPLATES

const TEMPLATE_HEADER: ElementHTMLTemplate<Header> = {
    elementName: "header",
    generator: (header, elementBuilder) => {
        // since header.depth only goes up to 4, we don't need to validate anything
        let tagName = "h" + header.depth;

        return createElement(
            tagName,
            {},
            ...header.content.map((child) => elementBuilder.elementAsHTMLNode(child))
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
    generator: (p, elementBuilder) => {
        return <p>{p.children.map((c) => elementBuilder.elementAsHTMLNode(c))}</p>;
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
    generator: (i, elementBuilder) => {
        return <em>{i.children.map((c) => elementBuilder.elementAsHTMLNode(c))}</em>;
    },
};

const TEMPLATE_BOLD: ElementHTMLTemplate<Bold> = {
    elementName: "bold",
    generator: (i, elementBuilder) => {
        return <b>{i.children.map((c) => elementBuilder.elementAsHTMLNode(c))}</b>;
    },
};

const TEMPLATE_DOCUMENT: ElementHTMLTemplate<Document> = {
    elementName: "document",
    generator: (document, elementBuilder) => {
        return (
            <div class="document">
                <div class="document-title">{document.title && document.title}</div>
                {document.children.map((c) => elementBuilder.elementAsHTMLNode(c))}
            </div>
        );
    },
};

const TEMPLATE_LIST: ElementHTMLTemplate<List> = {
    elementName: "list",
    generator: (list, elementBuilder) => {
        let ordering = list.ordering[list.indent - 1] ?? ListOrdering.Bulleted;

        if (ordering === ListOrdering.Bulleted) {
            return (
                <ul style="list-style-type: disc;">
                    {list.items.map((item) => {
                        if (item.content.elementName === "list") {
                            return elementBuilder.elementAsHTMLNode(item.content);
                        } else {
                            return <li>{elementBuilder.elementAsHTMLNode(item.content)}</li>;
                        }
                    })}
                </ul>
            );
        } else {
            return (
                <ol type={ordering}>
                    {list.items.map((item) => {
                        if (item.content.elementName === "list") {
                            return elementBuilder.elementAsHTMLNode(item.content);
                        } else {
                            return <li>{elementBuilder.elementAsHTMLNode(item.content)}</li>;
                        }
                    })}
                </ol>
            );
        }
    },
};

const TEMPLATE_CALLOUT: ElementHTMLTemplate<Callout> = {
    elementName: "callout",
    generator: (callout, elementBuilder) => {
        return (
            <div class="callout">
                {callout.title && <div class="callout-title">{callout.title}</div>}
                <div class="callout-body">
                    {callout.children.map((c) => elementBuilder.elementAsHTMLNode(c))}
                </div>
            </div>
        );
    },
};

const TEMPLATE_GROUP: ElementHTMLTemplate<Group> = {
    elementName: "group",
    generator: (group, elementBuilder) => {
        return (
            <div class="group">
                {group.children.map((c) => elementBuilder.elementAsHTMLNode(c))}
            </div>
        );
    },
};

const TEMPLATE_TABLE: ElementHTMLTemplate<Table> = {
    elementName: "table",
    generator: (table, elementBuilder) => {
        return <table>{table.rows.map((c) => elementBuilder.elementAsHTMLNode(c))}</table>;
    },
};

const TEMPLATE_ROW: ElementHTMLTemplate<Row> = {
    elementName: "row",
    generator: (table, elementBuilder) => {
        return (
            <tr>
                {table.cells.map((c) => (
                    <td>{elementBuilder.elementAsHTMLNode(c)}</td>
                ))}
            </tr>
        );
    },
};

const TEMPLATE_DESMOS: ElementHTMLTemplate<DesmosElement> = {
    elementName: "desmos",
    generator: (desmos, elementBuilder) => {
        let blockID = elementBuilder.newDesmosBlockID();

        elementBuilder.metadata.setKey("desmos-" + blockID, desmos.equations);

        return <div class="calculator" data-id={blockID}></div>;
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
    TEMPLATE_BOLD,
    TEMPLATE_LIST,
    TEMPLATE_DOCUMENT,
    TEMPLATE_CALLOUT,
    TEMPLATE_TABLE,
    TEMPLATE_ROW,
    TEMPLATE_GROUP,
    TEMPLATE_DESMOS,
];

const TEMPLATE_MAP: { [k: string]: ElementHTMLTemplate<Element> } = {};

for (let template of TEMPLATES) {
    TEMPLATE_MAP[template.elementName] = template as ElementHTMLTemplate<Element>;
}

export class ElementBuilder {
    metadata: DocumentMetadata;
    private _desmosBlockNextID: number;

    constructor() {
        this.metadata = new DocumentMetadata();
        this._desmosBlockNextID = 0;
    }

    newDesmosBlockID(): string {
        let id = this._desmosBlockNextID;
        this._desmosBlockNextID += 1;

        return id.toString();
    }

    elementAsHTMLNode(element: Element): HTMLNode {
        let template = TEMPLATE_MAP[element.elementName];

        if (!template) {
            throw new Error(`No template exists for element of type "${element.elementName}"`);
        }

        return template.generator(element, this);
    }
}
