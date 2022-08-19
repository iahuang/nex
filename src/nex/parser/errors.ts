import { SourceLocation } from "../source";

export class NexSyntaxError extends Error {
    location: SourceLocation;
    message: string;

    constructor(location: SourceLocation, message: string) {
        super(message);
        this.location = location;
        this.message = message;
    }
}

/**
 * **Example**
 * ```
 * > console.log(userFriendlyCharacterRepresentation("A"));
 * "A"
 * > console.log(userFriendlyCharacterRepresentation(" "));
 * [Space]
 * > console.log(userFriendlyCharacterRepresentation("\n"));
 * [Newline]
 * ```
 */
export function userFriendlyCharacterRepresentation(character: string): string {
    switch (character) {
        case " ":
            return "[Space]";
        case "\t":
            return "[Tab]";
        case "\n":
            return "[Newline]";
        default:
            return `"${character}"`;
    }
}
