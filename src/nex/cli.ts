import chalk from "chalk";
import { CLISchema, Option, parseArgv } from "./cli/argv_parser";
import { displaySyntaxError, printHelpMessage } from "./cli/cli_utils";
import { DocumentHTMLGenerator } from "./generation/generation";
import { panic } from "./logging";
import { astDump } from "./parser/ast";
import { NexSyntaxError } from "./parser/errors";
import { Parser } from "./parser/parser";
import { resolveResourcePath } from "./resources";
import { SourceReference } from "./source";
import { ThemeManager } from "./theme";
import { FsUtil, StringBuffer } from "./util";

export function runCLI(argv: string[]): void {
    let themeManager = new ThemeManager(resolveResourcePath("themes"));
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
                                reject(
                                    `No such theme "${theme}" exists. For a list of themes, use "nex list-themes"`
                                );
                            }
                        },
                    },
                    {
                        name: "debug",
                        description: "Output additional information for debug purposes",
                        argumentDescription: "mode",
                        requiresArgument: true,
                        allowDuplicates: false,
                    },
                ],
            },
            {
                name: "build-notebook",
                description: "Builds the provided NeX notebook folder into a standalone HTML file",
                requiresInput: true,
                inputDescription: "notebook path",
                options: [
                    {
                        name: "out",
                        shortcut: "o",
                        description: "Specify output HTML path",
                        argumentDescription: "path",
                        requiresArgument: true,
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
            {
                name: "clear-cache",
                description: "Removes cached dependency files",
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
                debugMode: settings.getOptionSetting("debug"),
                offline: settings.hasOption("offline"),
            });
            break;
        }
        case "build-notebook": {
            let defaultOutputFile = FsUtil.entityName(parseResult.input!) + ".html";
            break;
        }
        case "list-themes":
            listThemes(themeManager);
            break;
        case "help":
            printHelpMessage(cliSchema);
            break;
        case "clear-cache":
            clearCache();
            console.log(chalk.green("Cache cleared"));
            break;
    }
}

function clearCache(): void {
    FsUtil.remove(resolveResourcePath("_cache"));
}

function listThemes(themeManager: ThemeManager): void {
    let output = new StringBuffer();

    output.writeln();

    let indent = " ".repeat(4);

    for (let name of themeManager.loadThemeList()) {
        let theme = themeManager.loadThemeManifest(name);

        output.writeln(indent + chalk.bold(chalk.cyanBright(name)), "-", theme.displayName);
        output.writeln(
            indent + chalk.dim("description:            "),
            chalk.italic(theme.description)
        );
        output.writeln(indent + chalk.dim("author:                 "), theme.author);
        output.writeln(
            indent + chalk.dim("includes custom assets: "),
            theme.packAssets.length > 0 ? chalk.yellowBright("Yes") : chalk.greenBright("No")
        );
        output.writeln();
    }

    process.stdout.write(output.read());
}

async function build(args: {
    inputFile: string;
    outputFile: string;
    theme: string;
    themeManager: ThemeManager;
    debugMode: string | null;
    offline: boolean;
}): Promise<void> {
    if (!FsUtil.exists(args.inputFile)) {
        panic("No such file or directory");
    }

    let parser = new Parser(SourceReference.fromPath(args.inputFile));
    let generator = new DocumentHTMLGenerator();

    try {
        let document = parser.parse();

        if (args.debugMode === "ast") {
            console.log(astDump(document));
        }

        let html = await generator.generateStandaloneHTML(
            document,
            args.themeManager.loadTheme(args.theme)
        );

        FsUtil.write(args.outputFile, html);
    } catch (e) {
        if (e instanceof NexSyntaxError) {
            displaySyntaxError(e);

            if (args.debugMode !== null) {
                console.error(chalk.dim(chalk.redBright(e.stack)));
            }

            process.exit(1);
        } else {
            throw e;
        }
    }
}
