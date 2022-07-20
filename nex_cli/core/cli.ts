import { StringBuffer } from "./util";

export interface Argument {
    name: string;
    shortcut: string | null;
    description: string | null;
    requiresValue: boolean;
    default: string | null; // if a default is specified (i.e Arguemnt.default !== null, then the argument becomes optional.)
}

export class ArgParser {
    _argumentSchema: Argument[];

    constructor() {
        this._argumentSchema = [];
    }

    addArgument(arg: Argument): void {
        this._argumentSchema.push({ ...arg }); // clone argument object, just in case we were passed a mutable reference for some reason
    }

    /**
     * Generate and return the help string, that is, what should be printed to stdout when
     * the CLI is invoked with -h.
     */
    buildHelpString(): string {
        let buffer = new StringBuffer();

        buffer.writeln("Usage: nex [...options] [file]");
        buffer.writeln();

        return buffer.read();
    }
}

export class NexCLI {
    argParser: ArgParser;

    constructor() {
        this.argParser = new ArgParser();
    }

    run(): void {
        // init argparser
        this.argParser.addArgument({
            name: "help",
            shortcut: "h",
            description: "Displays this message",
            requiresValue: false,
            default: null,
        });
        this.argParser.addArgument({
            name: "version",
            shortcut: null,
            description: "Display version information",
            requiresValue: false,
            default: null,
        });

        let argv = process.argv;

        
    }
}
