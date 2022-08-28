import { SourceLocation } from "../source";

interface TokenPattern {
    pattern?: string;
    regex?: RegExp;
    matchFunction?: (content: string) => string | null;
}

export class TokenType {
    pattern: TokenPattern;
    name: string;

    constructor(name: string, pattern: TokenPattern) {
        this.name = name;
        this.pattern = pattern;
    }

    match(content: string): string | null {
        if (this.pattern.regex) {
            let match = content.match(this.pattern.regex);

            if (match) {
                return match[0];
            }

            return null;
        } else if (this.pattern.pattern) {
            if (content.startsWith(this.pattern.pattern)) {
                return this.pattern.pattern;
            }

            return null;
        } else if (this.pattern.matchFunction) {
            return this.pattern.matchFunction(content);
        } else {
            throw new Error(`Token type "${this.name}" is unmatchable`);
        }
    }
}

export class Token {
    type: TokenType;
    content: string;
    location: SourceLocation;

    constructor(type: TokenType, content: string, location: SourceLocation) {
        this.type = type;
        this.content = content;
        this.location = location;
    }
}
