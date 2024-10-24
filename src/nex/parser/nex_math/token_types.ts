import { TokenType } from "../token";
import { NexMathKeyword, NexMathKeywords } from "./keywords";

export const NM_ALPHANUMERIC = new TokenType("alphanumeric", { regex: /^[a-zA-Z.0-9]/g });
export const NM_PAREN_LEFT = new TokenType("left parentheses", { pattern: "(" });
export const NM_PAREN_RIGHT = new TokenType("right parentheses", { pattern: ")" });
export const NM_BRACKET_LEFT = new TokenType("left square bracket", { pattern: "[" });
export const NM_BRACKET_RIGHT = new TokenType("right square bracket", { pattern: "]" });
export const NM_CURLY_LEFT = new TokenType("left curly brace", { pattern: "{" });
export const NM_CURLY_RIGHT = new TokenType("right curly brace", { pattern: "}" });
export const NM_FRAC = new TokenType("fraction", { pattern: "/" });
export const NM_EXPONENT = new TokenType("exponent", { pattern: "^" });
export const NM_SUBSCRIPT = new TokenType("subscript", { pattern: "_" });

export const NM_KEYWORD = new TokenType("keyword", {
    matchFunction: (content) => {
        let bestMatch: NexMathKeyword | null = null;

        for (let keyword of NexMathKeywords.getInstance().getKeywords()) {
            if (content.startsWith(keyword.keyword)) {
                if (!bestMatch) {
                    bestMatch = keyword;
                } else if (bestMatch.keyword.length < keyword.keyword.length) {
                    bestMatch = keyword;
                }
            }
        }

        return bestMatch ? bestMatch.keyword : null;
    },
});

export const NM_ARGUMENT_SEPARATOR = new TokenType("argument separator", { pattern: "," });

export const NM_BMATRIX_START = new TokenType("matrix", { pattern: "mat[" });
export const NM_BMATRIX_END = new TokenType("matrix", { pattern: "]" });

export const NM_PMATRIX_START = new TokenType("matrix", { pattern: "mat(" });
export const NM_PMATRIX_END = new TokenType("matrix", { pattern: ")" });

export const NM_CMATRIX_START = new TokenType("matrix", { pattern: "mat{" });
export const NM_CMATRIX_END = new TokenType("matrix", { pattern: "}" });

export const NM_VMATRIX_START = new TokenType("matrix", { pattern: "mat|" });
export const NM_VMATRIX_END = new TokenType("matrix", { pattern: "|" });

export const NM_CASES_START = new TokenType("cases", { pattern: "cases(" });
export const NM_CASES_WHEN = new TokenType("when", { regex: /^when(?= )/g });

export const NM_TEXT_START = new TokenType("text start", { regex: /^"(?=.+")/g });
export const NM_TEXT_END = new TokenType("text end", { pattern: '"' });
