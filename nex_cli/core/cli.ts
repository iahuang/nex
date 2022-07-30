import { HTMLGenerator } from "./generation/generator";
import { dump } from "./parser/ast";
import { Parser } from "./parser/parser";
import { SourceReference } from "./source";
import { StringBuffer } from "./util";

export interface Argument {
    name: string;
    shortcut: string | null;
    description: string | null;
    requiresValue: boolean;
    default: string | null; // if a default is specified (i.e Arguemnt.default !== null, then the argument becomes optional.)
}

export interface ArgumentSetting {
    argumentName: string;
    value: string | null;
}

export class Settings {
    argumentSettings: ArgumentSetting[];
    inputFile: string | null;

    constructor(settings: ArgumentSetting[]) {
        this.argumentSettings = settings;
        this.inputFile = null;
    }

    hasArgument(argName: string): boolean {
        return this.getArgumentSetting(argName) !== null;
    }

    getArgumentSetting(argName: string): ArgumentSetting | null {
        return this.getArgumentSettings(argName)[0] ?? null;
    }

    getArgumentSettings(argName: string): ArgumentSetting[] {
        return this.argumentSettings.filter(setting => setting.argumentName === argName);
    }
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

        buffer.writeln("Usage: nex [...options] [input file or directory]");
        buffer.writeln();

        return buffer.read();
    }

    /**
     * Return an object containing each passed argument and their corresponding
     * specified value (if applicable), in the order in which they were passed.
     * 
     * Arguments with specified default values will be included at the start
     * of this array.
     * 
     * The passed value for `argv` *should*
     */
    parse(argv: string[]): Settings {
        
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

        this.argParser.addArgument({
            name: "build",
            shortcut: null,
            description: "Build the specified nex file to a standalone HTML file",
            requiresValue: false,
            default: null,
        });

        this.argParser.addArgument({
            name: "out",
            shortcut: null,
            description: "Build the specified file",
            requiresValue: true,
            default: null,
        });

        let argv = process.argv;
        let parser = new Parser(SourceReference.fromPath(argv[2]));

        let document = parser.parse();

        let generator = new HTMLGenerator();
        console.log(generator.generateContentsAsHTML(document).asHTML());
    }
}
