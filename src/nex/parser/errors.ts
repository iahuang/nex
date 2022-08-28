import { SourceLocation } from "../source";
import { Token } from "./token";

export class NexSyntaxError extends Error {
    location: SourceLocation;
    message: string;
    note: string | null;
    offendingToken: Token | null;

    constructor(location: SourceLocation, message: string, offendingToken?: Token, note?: string) {
        super(message);
        this.location = location;
        this.message = message;
        this.offendingToken = offendingToken ?? null;
        this.note = note ?? null;
    }
}

/**
 * **Example**
 * ```
 * > console.log(userFriendlyCharacterRepresentation("A"));
 * character "A"
 * > console.log(userFriendlyCharacterRepresentation(" "));
 * whitespace
 * > console.log(userFriendlyCharacterRepresentation("\n"));
 * newline
 * ```
 */
export function userFriendlyCharacterRepresentation(character: string): string {
    switch (character) {
        case " ":
            return "whitespace";
        case "\t":
            return "tab";
        case "\n":
            return "newline";
        default:
            return `character "${character}"`;
    }
}