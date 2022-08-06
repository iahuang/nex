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