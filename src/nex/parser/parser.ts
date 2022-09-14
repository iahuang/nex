import { SourceReference } from "../source";
import {
    Text,
    Paragraph,
    Document,
    Textual,
    Italic,
    Header,
    CodeBlock,
    InlineMath,
    BlockMath,
    InlineCode,
    Element,
    List,
    ListItem,
    ListOrdering,
    Callout,
    Bold,
    DesmosElement,
    Row,
    Table,
    Group,
} from "./ast";
import { NexMathParser } from "./nex_math/parser";
import { Setting, SettingHandler } from "./setting_handler";
import { TokenType } from "./token";
import { TokenStream } from "./token_stream";
import {
    NEWLINE,
    END_OF_FILE,
    ITALIC_START,
    TEXT_CHARACTER,
    ITALIC_END,
    HEADER,
    SETTING_VALUE,
    SETTING_DECLARATION,
    LANG_CODE_BLOCK_START,
    WHITESPACE,
    CODE_BLOCK_LINE,
    CODE_BLOCK_END,
    INLINE_MATH_START,
    INLINE_MATH_END,
    BLOCK_MATH_START,
    BLOCK_MATH_END,
    INLINE_CODE_START,
    INLINE_CODE_END,
    CODE_BLOCK_START,
    SHORTHAND_INLINE_MATH,
    LIST_ITEM,
    LIST_ORDERING,
    LIST_ORDERING_VALUE,
    WHITESPACE_INCL_NEWLINES,
    BLOCK_DECLARATION,
    BLOCK_START,
    BLOCK_END,
    BOLD_START,
    BOLD_END,
} from "./token_types";

function getListIndentFromListItemTokenContent(content: string): number {
    let i = 0;

    for (let c of content) {
        if (c === "-") {
            i += 1;
        }
    }

    return i;
}

const TITLE_SETTING_HANDLER: Setting = {
    name: "title",
    allowDuplicates: false,
    requiresArgument: true,
    handler: (tokenStream) => {
        return tokenStream.grabToken([SETTING_VALUE]).content;
    },
};

export class Parser {
    source: SourceReference;
    tokenStream: TokenStream;
    nexMathParser: NexMathParser;

    constructor(source: SourceReference) {
        this.source = source;
        this.tokenStream = new TokenStream(source);
        this.nexMathParser = new NexMathParser(this.tokenStream);
    }

    parseText(end: TokenType | null = null): Text {
        let text = "";

        while (true) {
            let token = this.tokenStream.matchTokenStrict([
                NEWLINE,
                END_OF_FILE,
                BOLD_START,
                ITALIC_START,
                end,
                INLINE_CODE_START,
                INLINE_MATH_START,
                SHORTHAND_INLINE_MATH,
                TEXT_CHARACTER,
            ]);

            if (token.type === TEXT_CHARACTER) {
                this.tokenStream.consumeToken(token);
                text += token.content;
            } else {
                return new Text(text);
            }
        }
    }

    parseNextTextualElement(end: TokenType | null = null): Element | null {
        return this.tokenStream.matchTokenAndBranch<Element | null>({
            branches: [
                end !== null && {
                    tokenType: end,
                    handler: () => {
                        return null;
                    },
                },
                {
                    tokenType: BOLD_START,
                    consumeToken: true,
                    handler: () => {
                        let content: Element[] = [];

                        while (true) {
                            let nextElement = this.parseNextTextualElement(BOLD_END);

                            if (!nextElement) {
                                this.tokenStream.throwSyntaxError(`Invalid character`);
                            }

                            content.push(nextElement);

                            if (this.tokenStream.grabOptionalToken(BOLD_END)) {
                                return new Bold(content);
                            }
                        }
                    },
                },
                {
                    tokenType: ITALIC_START,
                    consumeToken: true,
                    handler: () => {
                        let content: Element[] = [];

                        while (true) {
                            let nextElement = this.parseNextTextualElement(ITALIC_END);

                            if (!nextElement) {
                                this.tokenStream.throwSyntaxError(`Invalid character`);
                            }

                            content.push(nextElement);

                            if (this.tokenStream.grabOptionalToken(ITALIC_END)) {
                                return new Italic(content);
                            }
                        }
                    },
                },
                {
                    tokenType: SHORTHAND_INLINE_MATH,
                    consumeToken: true,
                    handler: () => {
                        return new InlineMath(
                            this.nexMathParser.parseNextNode(null, true).asLatex()
                        );
                    },
                },
                {
                    tokenType: INLINE_MATH_START,
                    consumeToken: true,
                    handler: () => {
                        return new InlineMath(
                            this.nexMathParser
                                .parseExpression([INLINE_MATH_END], true)
                                .expression.asLatex()
                        );
                    },
                },
                {
                    tokenType: INLINE_CODE_START,
                    consumeToken: true,
                    handler: () => {
                        return this.parseInlineCode();
                    },
                },
                {
                    tokenType: TEXT_CHARACTER,
                    handler: () => {
                        return this.parseText(end);
                    },
                },
            ],
            default: () => {
                return null;
            },
        });
    }

    parseParagraph(terminatingToken: TokenType | null = null): Paragraph {
        let paragraph = new Paragraph();

        while (true) {
            let textElement = this.parseNextTextualElement();

            if (textElement) {
                paragraph.children.push(textElement);
            } else {
                // If the `parseNextTextualElement` token was unable to match, it means
                // there was either a newline or an EOF.
                //
                // If the next token is a newline, see if the following line
                // indicates that the paragraph should end, i.e. the next line
                // starts a block element such as a code block, or whether
                // the paragraph should continue.
                let newline = this.tokenStream.grabOptionalToken(NEWLINE);

                if (newline) {
                    this.tokenStream.grabOptionalToken(WHITESPACE);
                    let nextToken = this.tokenStream.matchToken([
                        NEWLINE,
                        END_OF_FILE,
                        BLOCK_MATH_START,
                        LANG_CODE_BLOCK_START,
                        CODE_BLOCK_START,
                        LIST_ITEM,
                        LIST_ORDERING,
                        SETTING_DECLARATION,
                        BLOCK_DECLARATION,
                        terminatingToken,
                    ]);

                    //console.log(nextToken, JSON.stringify(this.tokenStream.getRemainingSourceContent()))

                    if (nextToken) {
                        return paragraph;
                    }
                    paragraph.children.push(new Text(" "));
                } else {
                    return paragraph;
                }
            }
        }
    }

    parseInlineCode(): InlineCode {
        let text = "";

        while (true) {
            let match = this.tokenStream.grabToken([INLINE_CODE_END, TEXT_CHARACTER]);

            if (match.type === INLINE_CODE_END) {
                return new InlineCode(text);
            }

            text += match.content;
        }
    }

    parseCodeBlock(lang: string | null): CodeBlock {
        this.tokenStream.grabOptionalToken(WHITESPACE);
        this.tokenStream.grabToken([NEWLINE]);

        let lines: string[] = [];

        while (true) {
            let end = this.tokenStream.matchTokenAndBranch<void | boolean>({
                branches: [
                    {
                        tokenType: CODE_BLOCK_END,
                        consumeToken: true,
                        handler: () => {
                            this.tokenStream.grabToken([NEWLINE, END_OF_FILE]);
                            return true;
                        },
                    },
                    {
                        tokenType: CODE_BLOCK_LINE,
                        consumeToken: true,
                        handler: (token) => {
                            lines.push(token.content);
                            this.tokenStream.grabToken([NEWLINE]);
                        },
                    },
                ],
            });

            if (end) {
                return new CodeBlock(lines.join("\n"), lang);
            }
        }
    }

    parseList(indent: number, ordering: ListOrdering[], terminatingToken: TokenType | null): List {
        let listItems: ListItem[] = [];

        while (true) {
            let orderingToken = this.tokenStream.matchToken([LIST_ORDERING]);
            if (orderingToken) {
                this.tokenStream.throwSyntaxError(
                    `List ordering directives are only allowed at the start of a list`,
                    orderingToken,
                    "If two separate lists were intended, insert a blank line between them."
                );
            }

            let listItemToken = this.tokenStream.matchToken([LIST_ITEM]);

            if (!listItemToken) {
                return new List(listItems, indent, ordering);
            }

            let nextIndent = getListIndentFromListItemTokenContent(listItemToken.content);

            if (nextIndent > indent) {
                if (nextIndent > indent + 1) {
                    this.tokenStream.throwSyntaxError(
                        `Cannot skip indentation from level ${indent} to ${nextIndent}`,
                        listItemToken
                    );
                }

                let sublist = this.parseList(nextIndent, ordering, terminatingToken);
                listItems.push(new ListItem(indent, sublist));
                continue;
            } else if (nextIndent < indent) {
                return new List(listItems, indent, ordering);
            }

            this.tokenStream.consumeToken(listItemToken);

            let element = this.parseNextBlockLevelElement(null, terminatingToken);
            if (!element) {
                this.tokenStream.throwSyntaxError(`Empty list item`, listItemToken);
            }

            listItems.push(new ListItem(indent, element));
        }
    }

    parseDesmos(): DesmosElement {
        let settingHandler = new SettingHandler(
            [
                {
                    name: "equation",
                    allowDuplicates: true,
                    requiresArgument: true,
                    handler: () => {
                        let equation = this.nexMathParser
                            .parseExpression([NEWLINE], true)
                            .expression.asLatex();

                        return equation;
                    },
                },
            ],
            this.tokenStream
        );

        while (true) {
            this.tokenStream.grabOptionalToken(WHITESPACE_INCL_NEWLINES);

            let exit = this.tokenStream.matchTokenAndBranch<boolean>({
                branches: [
                    {
                        tokenType: BLOCK_END,
                        consumeToken: true,
                        handler: () => {
                            this.tokenStream.grabToken([WHITESPACE_INCL_NEWLINES, END_OF_FILE]);

                            return true;
                        },
                    },
                    {
                        tokenType: SETTING_DECLARATION,
                        handler: () => {
                            settingHandler.handleSettingDeclaration();

                            return false;
                        },
                    },
                ],
            });

            if (exit) {
                return new DesmosElement(settingHandler.getSettingValues("equation"));
            }
        }
    }

    parseCallout(): Callout {
        let callout = new Callout();
        let settingHandler = new SettingHandler([TITLE_SETTING_HANDLER], this.tokenStream);

        while (true) {
            this.tokenStream.grabOptionalToken(WHITESPACE);
            if (this.tokenStream.grabOptionalToken(BLOCK_END)) {
                this.tokenStream.grabToken([WHITESPACE_INCL_NEWLINES, END_OF_FILE]);
                callout.title = settingHandler.getSettingValue("title");
                return callout;
            }

            let nextElement = this.parseNextBlockLevelElement(settingHandler, BLOCK_END);

            if (nextElement) {
                callout.children.push(nextElement);
            }
        }
    }

    parseTable(): Table {
        let rows: Row[] = [];

        while (true) {
            this.tokenStream.grabOptionalToken(WHITESPACE);
            if (this.tokenStream.grabOptionalToken(BLOCK_END)) {
                this.tokenStream.grabToken([WHITESPACE_INCL_NEWLINES, END_OF_FILE]);
                return new Table(rows);
            }

            let invalidBlockErrorLocation = this.tokenStream.getCurrentLocation();

            let nextElement = this.parseNextBlockLevelElement(null, BLOCK_END, true);

            if (!nextElement) {
                continue;
            }

            if (nextElement instanceof Row) {
                rows.push(nextElement);
            } else {
                this.tokenStream.throwSyntaxError(
                    `Expected row block, got element of type "${nextElement.elementName}" instead`,
                    invalidBlockErrorLocation,
                    `To create a row, use the @row block declaration`
                );
            }
        }
    }

    parseRow(): Row {
        let cells: Element[] = [];

        while (true) {
            this.tokenStream.grabOptionalToken(WHITESPACE);
            if (this.tokenStream.grabOptionalToken(BLOCK_END)) {
                this.tokenStream.grabToken([WHITESPACE_INCL_NEWLINES, END_OF_FILE]);
                return new Row(cells);
            }

            let nextElement = this.parseNextBlockLevelElement(null, BLOCK_END);

            if (nextElement) {
                cells.push(nextElement);
            }
        }
    }

    parseGroup(): Group {
        let group = new Group();

        while (true) {
            this.tokenStream.grabOptionalToken(WHITESPACE);
            if (this.tokenStream.grabOptionalToken(BLOCK_END)) {
                this.tokenStream.grabToken([WHITESPACE_INCL_NEWLINES, END_OF_FILE]);
                return group;
            }

            let nextElement = this.parseNextBlockLevelElement(null, BLOCK_END);

            if (nextElement) {
                group.children.push(nextElement);
            }
        }
    }

    parseNextBlockLevelElement(
        settingHandler: SettingHandler | null = null,
        terminatingToken: TokenType | null = null,
        tableEnvironment = false
    ): Element | null {
        this.tokenStream.grabOptionalToken(WHITESPACE);

        return this.tokenStream.matchTokenAndBranch<Element | null>({
            branches: [
                {
                    tokenType: HEADER,
                    consumeToken: true,
                    handler: (token) => {
                        let headerDepth = token.content.length;

                        let header = new Header(headerDepth, []);

                        while (true) {
                            let textual = this.parseNextTextualElement(ITALIC_END);

                            if (textual) {
                                header.content.push(textual);
                            } else {
                                break;
                            }
                        }

                        return header;
                    },
                },
                {
                    tokenType: SETTING_DECLARATION,
                    handler: (token) => {
                        if (!settingHandler) {
                            this.tokenStream.throwSyntaxError(
                                `Settings are not valid at this location`,
                                token
                            );
                        } else {
                            settingHandler.handleSettingDeclaration();
                        }

                        return null;
                    },
                },
                {
                    tokenType: LANG_CODE_BLOCK_START,
                    consumeToken: true,
                    handler: (token) => {
                        return this.parseCodeBlock(token.content.slice(3));
                    },
                },
                {
                    tokenType: CODE_BLOCK_START,
                    consumeToken: true,
                    handler: () => {
                        return this.parseCodeBlock(null);
                    },
                },
                {
                    tokenType: BLOCK_MATH_START,
                    consumeToken: true,
                    handler: () => {
                        return new BlockMath(
                            this.nexMathParser
                                .parseExpression([BLOCK_MATH_END], false)
                                .expression.asLatex()
                        );
                    },
                },
                {
                    tokenType: LIST_ITEM,
                    handler: (token) => {
                        let indent = getListIndentFromListItemTokenContent(token.content);

                        if (indent > 1) {
                            this.tokenStream.throwSyntaxError(
                                `Cannot start list with item of indent level ${indent}`,
                                token
                            );
                        }

                        return this.parseList(1, [], terminatingToken);
                    },
                },
                {
                    tokenType: LIST_ORDERING,
                    consumeToken: true,
                    handler: () => {
                        this.tokenStream.grabToken([WHITESPACE]);
                        let orderingToken = this.tokenStream.grabToken([LIST_ORDERING_VALUE]);
                        this.tokenStream.grabToken([NEWLINE]);
                        this.tokenStream.matchTokenStrict(
                            [LIST_ITEM],
                            "A list must directly follow a list ordering directive"
                        );

                        // parse ordering
                        let orderingList: ListOrdering[] = [];

                        for (let ordering of orderingToken.content.split(" ")) {
                            let availableOrderings = [
                                ListOrdering.Bulleted,
                                ListOrdering.LowercaseLetter,
                                ListOrdering.LowercaseRoman,
                                ListOrdering.Numbered,
                                ListOrdering.UppercaseLetter,
                                ListOrdering.UppercaseRoman,
                            ] as string[];

                            if (!availableOrderings.includes(ordering)) {
                                this.tokenStream.throwSyntaxError(
                                    `Invalid list ordering option "${ordering}"`,
                                    orderingToken,
                                    `Valid ordering options: ${availableOrderings
                                        .map((n) => `"${n}"`)
                                        .join(", ")}`
                                );
                            }

                            orderingList.push(ordering as ListOrdering);
                        }

                        return this.parseList(1, orderingList, terminatingToken);
                    },
                },
                {
                    tokenType: BLOCK_DECLARATION,
                    consumeToken: true,
                    handler: (token) => {
                        let blockName = token.content.slice(1);

                        this.tokenStream.grabOptionalToken(WHITESPACE);
                        this.tokenStream.grabToken([BLOCK_START]);

                        switch (blockName) {
                            case "callout":
                                return this.parseCallout();
                            case "desmos":
                                return this.parseDesmos();
                            case "table":
                                return this.parseTable();
                            case "row":
                                if (!tableEnvironment) {
                                    this.tokenStream.throwSyntaxError(
                                        `Row block only valid inside of table blocks`,
                                        token
                                    );
                                }
                                return this.parseRow();
                            case "group":
                                return this.parseGroup();
                            default:
                                this.tokenStream.throwSyntaxError(
                                    `Unrecognized block type "${blockName}"`,
                                    token
                                );
                        }
                    },
                },
                {
                    tokenType: TEXT_CHARACTER,
                    handler: () => {
                        return this.parseParagraph(terminatingToken);
                    },
                },
                {
                    tokenType: NEWLINE,
                    consumeToken: true,
                    handler: () => {
                        return null;
                    },
                },
            ],
        });
    }

    parse(): Document {
        let document = new Document();
        let settingHandler = new SettingHandler([TITLE_SETTING_HANDLER], this.tokenStream);

        while (true) {
            this.tokenStream.grabOptionalToken(WHITESPACE);
            if (this.tokenStream.matchToken([END_OF_FILE])) {
                document.title = settingHandler.getSettingValue("title");
                return document;
            }

            let nextElement = this.parseNextBlockLevelElement(settingHandler);

            if (nextElement) {
                document.children.push(nextElement);
            }
        }
    }
}
