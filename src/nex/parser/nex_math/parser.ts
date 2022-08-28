import { Token, TokenType } from "../token";
import { TokenStream } from "../token_stream";
import { TEXT_CHARACTER, WHITESPACE, WHITESPACE_INCL_NEWLINES } from "../token_types";
import {
    Bracketed,
    BracketType,
    Case,
    Cases,
    Exponent,
    Expression,
    Fraction,
    KeywordNode,
    MathNode,
    Matrix,
    Subscript,
    MathText,
    VerbatimLatex,
} from "./ast";
import { NexMathKeywords } from "./keywords";
import {
    NM_ALPHANUMERIC,
    NM_ARGUMENT_SEPARATOR,
    NM_BRACKET_LEFT,
    NM_BRACKET_RIGHT,
    NM_CASES_START,
    NM_CASES_WHEN,
    NM_CURLY_LEFT,
    NM_CURLY_RIGHT,
    NM_EXPONENT,
    NM_FRAC,
    NM_KEYWORD,
    NM_MATRIX_START,
    NM_PAREN_LEFT,
    NM_PAREN_RIGHT,
    NM_SUBSCRIPT,
    NM_TEXT_END,
    NM_TEXT_START,
} from "./token_types";

export class NexMathParser {
    tokenStream: TokenStream;

    constructor(tokenStream: TokenStream) {
        this.tokenStream = tokenStream;
    }

    parseAlphanumeric(): VerbatimLatex {
        let content = "";

        while (true) {
            let previousCharacterIsLetter =
                "abcdefghijklmnopqrstuvwxyZABCDEFGHIJKLMNOPQRSTUVWXYZ".includes(
                    content[content.length - 1]
                );
            let nextToken = this.tokenStream.matchToken([
                !previousCharacterIsLetter && NM_KEYWORD,
                !previousCharacterIsLetter && NM_MATRIX_START,
                !previousCharacterIsLetter && NM_CASES_START,
                NM_ALPHANUMERIC,
            ]);

            if (!nextToken || nextToken.type !== NM_ALPHANUMERIC) {
                return new VerbatimLatex(content);
            }

            if (nextToken.type === NM_ALPHANUMERIC) {
                this.tokenStream.consumeToken(nextToken);
                content += nextToken.content;
            }
        }
    }

    parseNextNode(previousNode: MathNode | null, inline: boolean): MathNode {
        if (!inline) {
            this.tokenStream.grabOptionalToken(WHITESPACE_INCL_NEWLINES);
        } else {
            this.tokenStream.grabOptionalToken(WHITESPACE);
        }

        return this.tokenStream.matchTokenAndBranch<MathNode>({
            branches: [
                {
                    tokenType: NM_KEYWORD,
                    consumeToken: true,
                    handler: (token) => {
                        let keyword = NexMathKeywords.getInstance().getKeyword(token.content);

                        // If this keyword takes no arguments, return it as is
                        if (keyword.maxArguments === 0) {
                            return new VerbatimLatex(keyword.latexTemplate);
                        }

                        let providedArguments: (Expression | null)[] = [];

                        for (let i = 0; i < keyword.maxArguments; i++) {
                            providedArguments.push(null);
                        }

                        // this keyword takes arguments; check to see whether if
                        // there are parentheses directly following it, indicating
                        // that there are provided arguments

                        let nextToken = this.tokenStream.matchToken([NM_PAREN_LEFT]);

                        if (nextToken) {
                            // there seem to be provided arguments, parse as necessary

                            this.tokenStream.consumeToken(nextToken);

                            let argIndex = 0;

                            while (true) {
                                if (argIndex >= keyword.maxArguments) {
                                    this.tokenStream.throwSyntaxError(
                                        `Too many arguments provided for NeX math keyword "${keyword.keyword}" (max ${keyword.maxArguments})`
                                    );
                                }

                                let nextArgument = this.parseExpression(
                                    [NM_PAREN_RIGHT, NM_ARGUMENT_SEPARATOR],
                                    inline
                                );

                                providedArguments[argIndex] = nextArgument.expression;

                                // Check whether we encountered a ")", indicating
                                // the end of the passed arguments
                                if (nextArgument.terminatingToken.type === NM_PAREN_RIGHT) {
                                    break;
                                }

                                argIndex += 1;
                            }
                        } else if (keyword.minArguments > 0) {
                            // Make sure that, if the "()" doesn't appear after the keyword
                            // that this keyword doesn't requre arguments

                            this.tokenStream.throwSyntaxError(
                                `Keyword "${keyword.keyword}" requires arguments.`,
                                token
                            );
                        }

                        // Check to make sure that the minimum number of arguments is specified

                        let argsSpecified = 0;

                        for (let arg of providedArguments) {
                            if (arg !== null && !arg.isEmpty()) {
                                argsSpecified += 1;
                            }
                        }

                        if (argsSpecified < keyword.minArguments) {
                            this.tokenStream.throwSyntaxError(
                                `Keyword "${keyword.keyword}" requires arguments, but ${
                                    argsSpecified === 0 ? "none" : "only " + argsSpecified
                                } were specified.`,
                                token
                            );
                        }

                        return new KeywordNode(keyword, providedArguments);
                    },
                },
                {
                    tokenType: NM_MATRIX_START,
                    consumeToken: true,
                    handler: () => {
                        return this.parseMatrix(inline);
                    },
                },
                {
                    tokenType: NM_CASES_START,
                    consumeToken: true,
                    handler: () => {
                        return this.parseCases(inline);
                    },
                },
                {
                    tokenType: NM_TEXT_START,
                    consumeToken: true,
                    handler: ()=>{
                        return this.parseText();
                    }
                },
                {
                    tokenType: NM_PAREN_LEFT,
                    consumeToken: true,
                    handler: () => {
                        return new Bracketed(
                            this.parseExpression([NM_PAREN_RIGHT], inline).expression,
                            BracketType.Parentheses
                        );
                    },
                },
                {
                    tokenType: NM_BRACKET_LEFT,
                    consumeToken: true,
                    handler: () => {
                        return new Bracketed(
                            this.parseExpression([NM_BRACKET_RIGHT], inline).expression,
                            BracketType.Square
                        );
                    },
                },
                {
                    tokenType: NM_CURLY_LEFT,
                    consumeToken: true,
                    handler: () => {
                        return new Bracketed(
                            this.parseExpression([NM_CURLY_RIGHT], inline).expression,
                            BracketType.Curly
                        );
                    },
                },
                {
                    tokenType: NM_FRAC,
                    consumeToken: true,
                    handler: (token) => {
                        if (previousNode === null) {
                            this.tokenStream.throwSyntaxError(
                                `Fraction is missing a numerator`,
                                token
                            );
                        }

                        let denominator = this.parseNextNode(null, inline);

                        return new Fraction(
                            stripParentheses(previousNode),
                            stripParentheses(denominator)
                        );
                    },
                },
                {
                    tokenType: NM_EXPONENT,
                    consumeToken: true,
                    handler: (token) => {
                        if (previousNode === null) {
                            this.tokenStream.throwSyntaxError(`Exponent is missing a base`, token);
                        }

                        let exp = this.parseNextNode(null, inline);

                        return new Exponent(previousNode, stripParentheses(exp));
                    },
                },
                {
                    tokenType: NM_SUBSCRIPT,
                    consumeToken: true,
                    handler: (token) => {
                        if (previousNode === null) {
                            this.tokenStream.throwSyntaxError(`Subscript is missing a base`, token);
                        }

                        let sub = this.parseNextNode(null, inline);

                        return new Subscript(previousNode, stripParentheses(sub));
                    },
                },
                {
                    tokenType: NM_ALPHANUMERIC,
                    handler: () => {
                        return this.parseAlphanumeric();
                    },
                },
            ],
        });
    }

    parseCases(inline: boolean): Cases {
        let cases: Case[] = [];

        while (true) {
            if (!inline) {
                this.tokenStream.grabOptionalToken(WHITESPACE_INCL_NEWLINES);
            } else {
                this.tokenStream.grabOptionalToken(WHITESPACE);
            }

            let nextCase = this.parseExpression(
                [NM_CASES_WHEN, NM_PAREN_RIGHT, NM_ARGUMENT_SEPARATOR],
                inline
            );

            if (nextCase.expression.isEmpty()) {
                this.tokenStream.throwSyntaxError(
                    "Empty case not allowed",
                    nextCase.terminatingToken
                );
            }

            if (nextCase.terminatingToken.type === NM_ARGUMENT_SEPARATOR) {
                cases.push(new Case(nextCase.expression, null));
            } else if (nextCase.terminatingToken.type === NM_CASES_WHEN) {
                let condition = this.parseExpression(
                    [NM_PAREN_RIGHT, NM_ARGUMENT_SEPARATOR],
                    inline
                );

                cases.push(new Case(nextCase.expression, condition.expression));

                if (condition.terminatingToken.type === NM_PAREN_RIGHT) {
                    return new Cases(cases);
                }
            } else {
                return new Cases(cases);
            }
        }
    }

    parseText(): MathText {
        let text = "";

        while (true) {
            let match = this.tokenStream.grabToken([NM_TEXT_END, TEXT_CHARACTER]);

            if (match.type === NM_TEXT_END) {
                return new MathText(text);
            }

            text += match.content;
        }
    }

    parseMatrixRow(inline: boolean): Expression[] {
        let row: Expression[] = [];

        while (true) {
            if (!inline) {
                this.tokenStream.grabOptionalToken(WHITESPACE_INCL_NEWLINES);
            } else {
                this.tokenStream.grabOptionalToken(WHITESPACE);
            }
            let nextCell = this.parseExpression([NM_BRACKET_RIGHT, NM_ARGUMENT_SEPARATOR], inline);

            row.push(nextCell.expression);

            // Check whether we encountered a "]", indicating
            // the end of the passed row cells
            if (nextCell.terminatingToken.type === NM_BRACKET_RIGHT) {
                break;
            }
        }

        return row;
    }

    parseMatrix(inline: boolean): Matrix {
        let rows: Expression[][] = [];

        while (true) {
            if (!inline) {
                this.tokenStream.grabOptionalToken(WHITESPACE_INCL_NEWLINES);
            } else {
                this.tokenStream.grabOptionalToken(WHITESPACE);
            }

            let matrix = this.tokenStream.matchTokenAndBranch<void | Matrix>({
                branches: [
                    {
                        tokenType: NM_BRACKET_LEFT,
                        consumeToken: true,
                        handler: (token) => {
                            let newRow = this.parseMatrixRow(inline);

                            // validate that this row has at least one element
                            if (newRow.length === 1 && newRow[0].children.length === 0) {
                                this.tokenStream.throwSyntaxError(
                                    `Cannot create empty matrix row`,
                                    token
                                );
                            }

                            // validate that this row is the same length as all previous rows
                            for (let existingRow of rows) {
                                if (newRow.length !== existingRow.length) {
                                    this.tokenStream.throwSyntaxError(
                                        `All matrix rows must have the same size; incompatible new row of length ${newRow.length} with existing row(s) of length ${existingRow.length}`,
                                        token
                                    );
                                }
                            }
                            rows.push(newRow);
                        },
                    },
                    {
                        tokenType: NM_PAREN_RIGHT,
                        consumeToken: true,
                        handler: (token) => {
                            // validate that this matrix has at least one row
                            if (rows.length === 0) {
                                this.tokenStream.throwSyntaxError(
                                    `Cannot create empty matrix`,
                                    token
                                );
                            }

                            return new Matrix(rows);
                        },
                    },
                ],
            });

            if (matrix) {
                return matrix;
            }
        }
    }

    parseExpression(
        closingTokenTypes: TokenType[],
        inline: boolean
    ): {
        expression: Expression;
        terminatingToken: Token;
    } {
        let currentExpression = new Expression([]);

        while (true) {
            if (!inline) {
                this.tokenStream.grabOptionalToken(WHITESPACE_INCL_NEWLINES);
            } else {
                this.tokenStream.grabOptionalToken(WHITESPACE);
            }

            let stopTest = this.tokenStream.matchToken(closingTokenTypes);
            if (stopTest) {
                this.tokenStream.consumeToken(stopTest);
                return {
                    expression: currentExpression,
                    terminatingToken: stopTest,
                };
            }

            let nextNode = this.parseNextNode(
                currentExpression.children[currentExpression.children.length - 1] ?? null,
                inline
            );

            // If the next node is a fraction, exponent, or subscript
            // remove the previous node, since otherwise, for an expression
            // such as `1/x`, we would end up with the nodes `1` and `1/x` separately,
            // where `1` appears twice, both as the numerator of the fraction, and as
            // the node that precedes it.
            if (
                nextNode instanceof Fraction ||
                nextNode instanceof Exponent ||
                nextNode instanceof Subscript
            ) {
                currentExpression.children.pop();
            }

            currentExpression.children.push(nextNode);
        }
    }
}

function stripParentheses(node: MathNode): MathNode {
    if (node instanceof Bracketed) {
        if (node.bracketType === BracketType.Parentheses) {
            return node.content;
        }
    }

    return node;
}
