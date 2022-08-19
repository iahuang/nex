import { LexingMode, TokenStream } from "../lexer";
import { TokenType } from "../token";
import { Paragraph, InlineMath, ContainerElement, BlockMath } from "../ast";
import { ParserBase } from "../parser_base";

const MODE_INLINE_MATH = new LexingMode(
    [
        TokenType.LatexTextStart,
        TokenType.LatexCurlyStart,
        TokenType.LatexEscapedBackslash,
        TokenType.LatexEscapedCurly,
        TokenType.LatexEscapedDollarSign,
        TokenType.LatexCurlyEnd,
        TokenType.InlineMathModeEnd,
        TokenType.LatexCharacter,
    ],
    {
        skipWhitespace: false,
    }
);

const MODE_BLOCK_MATH = new LexingMode(
    [
        TokenType.LatexEscapedBackslash,
        TokenType.LatexEscapedDollarSign,
        TokenType.BlockMathModeEnd,
        TokenType.EOL,
        TokenType.LatexCharacter,
    ],
    {
        skipWhitespace: false,
    }
);

export class NexMathParser extends ParserBase {
    tokenStream: TokenStream;

    constructor(tokenStream: TokenStream) {
        super();

        this.tokenStream = tokenStream;
    }

    private _parseInlineMath(parent: Paragraph): void {
        let latex = "";

        enum Environment {
            Text,
            Curly,
            Math,
        }

        // Parsing inline math is not so simple because nested dollar signs are allowed
        // inside of \text{} blocks.

        // Create a stack; when we enter text mode via \text{}, add Environment.Text
        // to the stack. When we leave text mode via }, pop the last item off the stack,
        // ensuring that it is Environment.Text or Environment.Curly.
        //
        // Similarly, when we encounter a "$" character, if the last item on the stack
        // is an Environment.Math, pop that item off. If there are no items on the stack,
        // return, and otherwise, throw an error.
        //
        // Finally, if we encounter a non-"\text{" "{" character, push Environment.Curly to the
        // stack.
        let stack: Environment[] = [];

        while (true) {
            let token = this.tokenStream.nextToken(MODE_INLINE_MATH);

            if (!token) {
                this.unexpectedTokenError();
            }

            switch (token.type) {
                case TokenType.LatexTextStart:
                    latex += token.content;
                    stack.push(Environment.Text);
                    break;
                case TokenType.LatexCurlyStart:
                    latex += token.content;
                    stack.push(Environment.Curly);
                    break;
                case TokenType.LatexCurlyEnd:
                    latex += token.content;

                    {
                        let popped = stack.pop();

                        if (popped === undefined) {
                            this.throwSyntaxError(`Unexpected "}"`, token);
                        } else if (popped === Environment.Math) {
                            this.throwSyntaxError(`Unexpected "}"`, token);
                        } else {
                            // ok
                        }
                    }

                    break;
                case TokenType.InlineMathModeEnd:
                    // this case matches a dollar sign token ("$"). this only signifies the end
                    // of the inline math element if the stack is empty. otherwise, this
                    // token may only be terminating an inline math statement.
                    //
                    // In the context of a \text{} environment, this token denotes
                    // the *start* of a math environment.

                    {
                        let currentEnvironment = stack[stack.length - 1];

                        if (currentEnvironment === undefined) {
                            let mathElement = new InlineMath(latex);
                            parent.children.push(mathElement);
                            return;
                        } else if (currentEnvironment === Environment.Text) {
                            latex += token.content;
                            stack.push(Environment.Math);
                        } else if (currentEnvironment === Environment.Math) {
                            latex += token.content;
                            stack.pop();
                        }
                    }
                    break;
                case TokenType.LatexEscapedBackslash:
                    latex += token.content;
                    break;
                case TokenType.LatexEscapedDollarSign:
                    latex += token.content;
                    break;
                case TokenType.LatexEscapedCurly:
                    latex += token.content;
                    break;
                case TokenType.LatexCharacter:
                    latex += token.content;
                    break;
                default:
                    this.debug_unhandledTokenError(token);
            }
        }
    }

    private _parseBlockMath(parent: ContainerElement): void {
        let latex = "";

        while (true) {
            let token = this.tokenStream.nextToken(MODE_BLOCK_MATH);

            if (!token) {
                this.unexpectedTokenError();
            }

            switch (token.type) {
                case TokenType.LatexEscapedBackslash:
                    latex += token.content;
                    break;
                case TokenType.LatexEscapedDollarSign:
                    latex += token.content;
                    break;
                case TokenType.LatexCharacter:
                    latex += token.content;
                    break;
                case TokenType.EOL:
                    latex += token.content;
                    this.tokenStream.consumeWhitespace(false);
                    break;
                case TokenType.BlockMathModeEnd: {
                    let mathElement = new BlockMath(latex);
                    parent.children.push(mathElement);
                    return;
                }
                default:
                    this.debug_unhandledTokenError(token);
            }
        }
    }
}
