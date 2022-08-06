import chalk from "chalk";
import { HTMLGenerator } from "./generation/generator";
import { NEX_META } from "./meta";
import { dump } from "./parser/ast";
import { Parser } from "./parser/parser";
import { SourceReference } from "./source";
import { StringBuffer } from "./util";
import { asVersionString } from "./version";

export interface Option {
    /**
     * Full name of this option (e.g. `"verbose"` for `--verbose`)
     */
    name: string;
    /**
     * A single letter shortcut (e.g. for the option "--verbose", "-v" would
     * work as a shortcut)
     */
    shortcut: string | null;
    /**
     * Description of this option for the help message
     */
    description: string | null;
    /**
     * Whether or not a value is expected following this option
     */
    requiresValue: boolean;
    /**
     * Name of the required value, if applicable (for the help message)
     */
    argumentName: string | null;
    /**
     * if a default is specified (i.e `Argument.default !== null`, then the argument becomes optional.)
     */
    default: string | null;
}

export interface OptionSetting {
    optionName: string;
    value: string | null;
}

export class Settings {
    optionSettings: OptionSetting[];
    inputFile: string | null;

    constructor(settings: OptionSetting[], inputFile: string | null) {
        this.optionSettings = settings;
        this.inputFile = inputFile;
    }

    hasValueForOption(optName: string): boolean {
        return this.getValueForOption(optName) !== null;
    }

    getValueForOption(optName: string): OptionSetting | null {
        return this.getValuesForOption(optName)[0] ?? null;
    }

    getValuesForOption(optNmae: string): OptionSetting[] {
        return this.optionSettings.filter((setting) => setting.optionName === optNmae);
    }
}

export class ArgParser {
    _options: Option[];

    constructor() {
        this._options = [];
    }

    addOption(arg: Option): void {
        this._options.push({ ...arg }); // clone option object, just in case we were passed a mutable reference for some reason
    }

    /**
     * Generate and return the help string, that is, what should be printed to stdout when
     * the CLI is invoked with -h.
     */
    buildHelpString(): string {
        let buffer = new StringBuffer();

        buffer.writeln(
            `Usage: nex ${chalk.cyanBright("[...options]")} ${chalk.magentaBright(
                "[input file or directory]"
            )}`
        );
        buffer.writeln();

        buffer.writeln(chalk.bold("COMMAND LINE OPTIONS"));
        buffer.writeln();

        let leftColumn: { colored: boolean; text: string }[] = [];
        let rightColumn: string[] = [];

        for (let option of this._options) {
            let argumentAppendix = option.argumentName ? ` [${option.argumentName}]` : "";

            if (option.shortcut) {
                leftColumn.push({
                    colored: true,
                    text: `--${option.name}, -${option.shortcut}` + argumentAppendix,
                });
            } else {
                leftColumn.push({
                    colored: true,
                    text: `--${option.name}` + argumentAppendix,
                });
            }

            rightColumn.push(option.description || "(No description provided)");

            if (option.default) {
                leftColumn.push({
                    colored: false,
                    text: "default:",
                });
                rightColumn.push(`${option.default}`);
            }

            leftColumn.push({
                colored: false,
                text: "",
            });

            rightColumn.push("");
        }

        let maxlen = Math.max(...leftColumn.map((col) => col.text.length));
        const leftPadding = 2;
        const separating = 2;

        let i = 0;

        while (i < rightColumn.length) {
            let left = leftColumn[i];
            let right = rightColumn[i];

            buffer.write(" ".repeat(maxlen - left.text.length + leftPadding));
            if (left.colored) {
                buffer.write(chalk.cyanBright(left.text));
            } else {
                buffer.write(left.text);
            }
            buffer.write(" ".repeat(separating));
            buffer.write(right + "\n");

            i += 1;
        }

        return buffer.read();
    }

    private _getOptionByName(optName: string): Option | null {
        for (let option of this._options) {
            if (option.name === optName.toLowerCase()) {
                return option;
            }
        }

        return null;
    }

    private _getOptionByShorthandName(optShorthandName: string): Option | null {
        for (let option of this._options) {
            if (option.shortcut === optShorthandName) {
                return option;
            }
        }

        return null;
    }

    private _throwError(message: string): never {
        console.error(chalk.redBright("error: " + message));
        process.exit(1);
    }

    /**
     * Return an object containing each passed option and their corresponding
     * specified value (if applicable), in the order in which they were passed.
     *
     * Options with specified default values will be included at the end
     * of this array.
     *
     * The passed value for `argv` *should* include the input file/directory at the end
     * as well as `node` and the entry js file. In other words, pass `argv` as is
     * from `process.argv`.
     */
    parse(argv: string[]): Settings {
        // skip "node" and entry js path.
        let i = 2;

        let settings: OptionSetting[] = [];
        let inputFile: string | null = null;

        while (i < argv.length) {
            let arg = argv[i];

            let option: Option | null = null;

            // Check if current argv argument is prefixed by "-" or "--"

            if (arg.startsWith("--")) {
                let optionName = arg.slice(2);

                option = this._getOptionByName(optionName);

                if (!option) {
                    this._throwError(`Unknown option "${arg}". Invoke with -h to see options`);
                }
            } else if (arg.startsWith("-")) {
                let argShorthandName = arg.slice(1);

                option = this._getOptionByShorthandName(argShorthandName);

                if (!option) {
                    this._throwError(`Unknown option "${arg}". Invoke with -h to see options`);
                }
            }

            if (option) {
                let argumentValue: string | null = null;

                if (option.requiresValue) {
                    i += 1;

                    argumentValue = argv[i];

                    if (argumentValue === undefined) {
                        this._throwError(
                            `Option "--${option.name}" requires a value. Invoke with -h to see more information.`
                        );
                    }
                }

                settings.push({
                    optionName: option.name,
                    value: argumentValue,
                });
            } else {
                if (inputFile === null) {
                    inputFile = arg;
                } else {
                    this._throwError(`Can only specify one input file or directory`);
                }
            }

            i += 1;
        }

        let settingsObject = new Settings(settings, inputFile);

        // Add defaults
        for (let option of this._options) {
            if (option.default) {
                if (!settingsObject.getValueForOption(option.name)) {
                    settingsObject.optionSettings.push({
                        optionName: option.name,
                        value: option.default,
                    });
                }
            }
        }

        return settingsObject;
    }
}

export class NexCLI {
    argParser: ArgParser;

    constructor() {
        this.argParser = new ArgParser();
    }

    printHelpMessage(): void {
        console.log(this.argParser.buildHelpString());
    }

    run(): void {
        // init argparser
        this.argParser.addOption({
            name: "help",
            shortcut: "h",
            description: "Displays this message",
            requiresValue: false,
            argumentName: null,
            default: null,
        });

        this.argParser.addOption({
            name: "version",
            shortcut: null,
            description: "Display version information",
            requiresValue: false,
            argumentName: null,
            default: null,
        });

        this.argParser.addOption({
            name: "live",
            shortcut: "l",
            description: "Starts NeX in live mode",
            requiresValue: false,
            argumentName: null,
            default: null,
        });

        this.argParser.addOption({
            name: "port",
            shortcut: null,
            description: "Specifies a port to use for live mode",
            requiresValue: true,
            argumentName: "port",
            default: "3000",
        });

        this.argParser.addOption({
            name: "debug",
            shortcut: "d",
            description: "Starts NeX in debug mode",
            requiresValue: false,
            argumentName: null,
            default: null,
        });

        this.argParser.addOption({
            name: "out",
            shortcut: null,
            description: "Specify the name of the outputted HTML file, if using --build",
            requiresValue: true,
            argumentName: "path",
            default: null,
        });

        let argv = process.argv;
        let settings = this.argParser.parse(argv);

        if (settings.hasValueForOption("help")) {
            this.printHelpMessage();
            process.exit(0);
        }

        if (settings.hasValueForOption("version")) {
            console.log("NeX version " + chalk.greenBright(asVersionString(NEX_META.version)));
            process.exit(0);
        }

        if (!settings.inputFile) {
            console.error(chalk.redBright("error: No input file or directory specified\n"));
            this.printHelpMessage();
            process.exit(1);
        }

        let parser = new Parser(SourceReference.fromPath(argv[2]));

        let document = parser.parse();

        console.log(dump(document));

        // let generator = new HTMLGenerator();
        // console.log(generator.generateContentsAsHTML(document).asHTML());
    }
}
