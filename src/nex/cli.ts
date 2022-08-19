import chalk from "chalk";
import { CLISchema, Option, parseArgv } from "./argv_parser";
import { HTMLBuilder } from "./generation/html";
import { panic } from "./logging";
import { NexSyntaxError } from "./parser/errors";
import { Parser } from "./parser/parser";
import { SourceReference } from "./source";
import { ThemeManager } from "./theme";
import { FsUtil, StringBuffer } from "./util";

function _makeOptionString(option: Option): string {
    let first = option.shortcut ? `--${option.name}, -${option.shortcut}` : `--${option.name}`;

    if (option.requiresArgument) {
        return `${first} [${option.argumentDescription ?? "value"}]`;
    }

    return first;
}

function _makeColoredOptionString(option: Option): string {
    let first = option.shortcut ? `--${option.name}, -${option.shortcut}` : `--${option.name}`;

    if (option.requiresArgument) {
        return (
            `${chalk.magentaBright(first)}` +
            chalk.dim(chalk.magentaBright(` [${option.argumentDescription ?? "value"}]`))
        );
    }

    return chalk.magentaBright(first);
}

function printHelpMessage(schema: CLISchema): void {
    let output = new StringBuffer();

    output.writeln("Usage:", "nex", chalk.cyanBright("[mode]"), chalk.magentaBright("[options]"));
    output.writeln();

    let optionStrings: string[] = [];

    for (let mode of schema.modes) {
        optionStrings.push(...mode.options.map((opt) => _makeOptionString(opt)));
    }

    let maxOptionStringLength = Math.max(...optionStrings.map((s) => s.length));

    output.writeln("Modes:");

    const indentMode = " ".repeat(4);
    const indentOption = " ".repeat(8);

    for (let mode of schema.modes) {
        output.writeln(indentMode + chalk.bold(mode.name.toUpperCase()) + "\n");
        output.writeln(indentMode + mode.description);
        output.write(indentMode + chalk.dim("Usage:"), "nex", chalk.cyanBright(mode.name));

        if (mode.options.length > 0) {
            output.write(" " + chalk.magentaBright("[options]"));
        }

        if (mode.requiresInput) {
            output.write(" " + chalk.greenBright(`[${mode.inputDescription}]`));
        }

        output.write("\n");

        for (let option of mode.options) {
            let optionString = _makeOptionString(option);
            output.write(indentOption + " ".repeat(maxOptionStringLength - optionString.length));
            output.write(_makeColoredOptionString(option));
            output.write("  ");
            output.writeln(option.description ?? "(No description provided)");
        }

        output.writeln("\n");
    }

    process.stdout.write(output.read());
}

export function runCLI(argv: string[], resourcesPath: string): void {
    let themeManager = new ThemeManager(FsUtil.joinPath(resourcesPath, "themes"));
    let themeList = themeManager.loadThemeList();

    let cliSchema: CLISchema = {
        globalOptions: [],
        modes: [
            {
                name: "build",
                description: "Builds the provided nex file to a standalone HTML file",
                requiresInput: true,
                inputDescription: "file or directory",
                options: [
                    {
                        name: "out",
                        shortcut: "o",
                        description: "Specify output HTML path",
                        argumentDescription: "path",
                        requiresArgument: true,
                        allowDuplicates: false,
                    },
                    {
                        name: "theme",
                        description: "Specify theme (default: latex)",
                        argumentDescription: "theme",
                        requiresArgument: true,
                        allowDuplicates: false,
                        validator: (theme, reject) => {
                            if (!themeList.includes(theme)) {
                                reject(`No such theme "${theme}" exists`);
                            }
                        },
                    },
                    {
                        name: "debug",
                        description: "Output additional information for debug purposes",
                        requiresArgument: false,
                        allowDuplicates: false,
                    },
                ],
            },
            {
                name: "list-themes",
                description: "Lists all available themes",
                requiresInput: false,
                options: [],
            },
            {
                name: "help",
                description: "Displays this message",
                requiresInput: false,
                options: [],
            },
        ],
    };

    let result = parseArgv(argv, cliSchema);

    if (!result) {
        printHelpMessage(cliSchema);
        return;
    }

    if (result.error) {
        panic(result.error);
    }

    let parseResult = result.result!;

    let settings = parseResult.optionSettings;

    switch (parseResult.mode) {
        case "build": {
            let parts = FsUtil.entityName(parseResult.input!).split(".");
            let defaultOutputFile =
                (parts.slice(0, parts.length - 1).join(".") || "untitled_nex_document") + ".html";

            build({
                inputFile: parseResult.input!,
                outputFile: settings.getOptionSetting("out") ?? defaultOutputFile,
                theme: settings.getOptionSetting("theme") ?? "latex",
                themeManager: themeManager,
                debug: settings.hasOption("debug"),
            });
            break;
        }
        case "list-themes":
            listThemes(themeManager);
            break;
        case "help":
            printHelpMessage(cliSchema);
            break;
    }
}

function listThemes(themeManager: ThemeManager): void {
    let output = new StringBuffer();

    output.writeln("Themes:");

    let indent = " ".repeat(4);

    for (let name of themeManager.loadThemeList()) {
        let theme = themeManager.loadThemeManifest(name);

        output.writeln(indent + chalk.bold(chalk.cyanBright(name)), "-", theme.displayName);
        output.writeln(indent + chalk.dim("description:"), theme.description);
        output.writeln(indent + chalk.dim("author:     "), theme.author);
        output.writeln();
    }

    process.stdout.write(output.read());
}

function displaySyntaxError(error: NexSyntaxError): void {
    let output = new StringBuffer();

    output.writeln(
        "at",
        chalk.cyanBright(
            (error.location.source.getPath() ?? "<anonymous>") +
                ":" +
                error.location.line +
                ":" +
                error.location.col
        )
    );
    output.writeln(chalk.bold(chalk.redBright("error:"), error.message));
    // subtract 1, since source location lines start at 1.
    let offendingLine = error.location.source.getContent().split("\n")[error.location.line - 1];

    output.writeln(chalk.dim(" | ") + offendingLine);
    output.writeln(chalk.redBright("   " + " ".repeat(error.location.col - 1) + "^"));

    process.stderr.write(output.read());
}

function build(args: {
    inputFile: string;
    outputFile: string;
    theme: string;
    themeManager: ThemeManager;
    debug: boolean;
}): void {
    if (!FsUtil.exists(args.inputFile)) {
        panic("No such file or directory");
    }

    let parser = new Parser(SourceReference.fromPath(args.inputFile));
    let generator = new HTMLBuilder();

    try {
        let document = parser.parse();

        generator.generateStandaloneHTML(
            document,
            args.outputFile,
            args.themeManager.loadTheme(args.theme)
        );
    } catch (e) {
        if (e instanceof NexSyntaxError) {
            displaySyntaxError(e);

            if (args.debug) {
                console.error(chalk.dim(chalk.redBright(e.stack)));
            }

            process.exit(1);
        } else {
            throw e;
        }
    }
}
