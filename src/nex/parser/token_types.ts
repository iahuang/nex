import { TokenType } from "./token";

export const WHITESPACE = new TokenType("whitespace", { regex: /^[ \t]+/g });
export const WHITESPACE_INCL_NEWLINES = new TokenType("whitespace and/or newlines", {
    regex: /^\s+/g,
});
export const NEWLINE = new TokenType("newline", { pattern: "\n" });
export const DOUBLE_NEWLINE = new TokenType("double newline", { pattern: "\n\n" });
export const END_OF_FILE = new TokenType("end of file", { regex: /^$/g });

export const TEXT_CHARACTER = new TokenType("character", { regex: /^./g });

export const SETTING_DECLARATION = new TokenType("setting declaration", { pattern: ":" });
export const SETTING_NAME = new TokenType("setting name", { regex: /^\w+/g });
export const SETTING_VALUE = new TokenType("setting value", { regex: /^.+/g });

export const ITALIC_START = new TokenType("italic start", { regex: /^\*(?=\S.{0,}\S\*)/g });
export const ITALIC_END = new TokenType("italic end", { pattern: "*" });
export const BOLD_START = new TokenType("italic start", { regex: /^\*\*(?=\S.{0,}\S\*\*)/g });
export const BOLD_END = new TokenType("italic end", { pattern: "**" });

export const HEADER = new TokenType("header declaration", { regex: /^#{1,4}(?= \S)/g });
export const HR = new TokenType("horizontal line", { regex: /^---$/gm });

export const LIST_ITEM = new TokenType("list item", { regex: /^-+ /g });
export const LIST_ORDERING = new TokenType("list ordering", { pattern: ".ordering" });
export const LIST_ORDERING_VALUE = new TokenType("list ordering value", { regex: /^.+/g });

export const SHORTHAND_INLINE_MATH = new TokenType("shorthand inline math", {
    regex: /^!(?=[a-zA-Z]+\b)/g,
});

export const LANG_CODE_BLOCK_START = new TokenType("language code block", { regex: /^```\w+/g });
export const CODE_BLOCK_START = new TokenType("code block", { regex: /^```/g });
export const CODE_BLOCK_END = new TokenType("code block end", { regex: /^\s{0,}```/g });
export const CODE_BLOCK_LINE = new TokenType("code block line", { regex: /^.{0,}/g });

export const INLINE_CODE_START = new TokenType("inline code start", { regex: /^`(?=.+`)/g });
export const INLINE_CODE_END = new TokenType("inline code end", { pattern: "`" });

export const INLINE_MATH_START = new TokenType("inline math start", { regex: /^\$(?=.+\$)/g });
export const INLINE_MATH_END = new TokenType("inline math end", { pattern: "$" });

export const BLOCK_MATH_START = new TokenType("block math start", { regex: /^%{/g });
export const BLOCK_MATH_END = new TokenType("block math end", { regex: /^}/g });

export const BLOCK_DECLARATION = new TokenType("block declaration", { regex: /^@\w+/g });
export const BLOCK_START = new TokenType("block start", { pattern: "{" });
export const BLOCK_END = new TokenType("block end", { pattern: "}" });

export const NEVER = new TokenType("never", { matchFunction: () => null });

export const URL = new TokenType("url", { regex: /\b(https?:\/\/)[\w.-]+\.\w+(\/\S{0,})?\b/g });
