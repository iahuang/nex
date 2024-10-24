import chalk from "chalk";
import { CLISchema, parseArgv } from "./cli/argv_parser";
import { buildStandalone } from "./cli/build";
import { generateSyntaxErrorPrintout, printHelpMessage } from "./cli/cli_utils";
import { generateNeXMathDocumentation } from "./cli/nex_math_doc_generator";
import { DocumentHTMLGenerator } from "./generation/generation";
import { LiveServer } from "./live_server";
import { panic } from "./logging";
import { Parser } from "./parser/parser";
import { resolveResourcePath } from "./resources";
import { SourceReference } from "./source";
import { DEFAULT_THEME, ThemeManager } from "./theme";
import { FsUtil, StringBuffer } from "./util";
import open from "open";
import { NexSyntaxError } from "./parser/errors";

const DEFAULT_PORT = 3000;

const cliSchema: CLISchema = {
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
            name: "live",
            description: "Opens the NeX live file viewer in a new tab",
            requiresInput: true,
            inputDescription: "path",
            defaultInput: ".",
            options: [
                {
                    name: "port",
                    shortcut: "p",
                    description: "Specify live server port (default: 3000)",
                    requiresArgument: true,
                    allowDuplicates: false,
                },
                {
                    name: "theme",
                    description: "Specify theme (default: latex)",
                    argumentDescription: "theme",
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
            name: "nex-math-help",
            description: "Automatically generate and open NeX math documentation in a new tab",
            requiresInput: false,
            options: [],
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
        {
            name: "parse",
            description: "Parse a NeX file and output the AST as JSON",
            requiresInput: true,
            inputDescription: "file",
            options: [
                {
                    name: "debug",
                    description: "Output additional information for debug purposes",
                    argumentDescription: "mode",
                    requiresArgument: true,
                    allowDuplicates: false,
                },
            ],
        },
    ],
};

export async function runCLI(argv: string[]): Promise<void> {
    let themeManager = new ThemeManager(resolveResourcePath("themes"));

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

            buildStandalone({
                inputFile: parseResult.input!,
                outputFile: settings.getOptionSetting("out") ?? defaultOutputFile,
                theme: settings.getOptionSetting("theme") ?? DEFAULT_THEME,
                debugMode: settings.getOptionSetting("debug"),
            });
            break;
        }
        case "build-notebook": {
            let defaultOutputFile = FsUtil.entityName(parseResult.input!) + ".html";
            break;
        }
        case "nex-math-help": {
            const outputPath = resolveResourcePath("/autogenerated_nex_math_docs.html");

            let documentation = generateNeXMathDocumentation();

            let parser = new Parser(SourceReference.asAnonymous(documentation));
            let themeManager = new ThemeManager();
            let generator = new DocumentHTMLGenerator();
            let html = await generator.generateStandaloneHTML(
                parser.parse(),
                themeManager.loadTheme(DEFAULT_THEME)
            );

            FsUtil.write(outputPath, html);
            open(outputPath);

            break;
        }
        case "live": {
            let portSetting = settings.getOptionSetting("port");
            startLiveServer(
                parseResult.input!,
                portSetting ? Number.parseInt(portSetting) : null,
                settings.getOptionSetting("theme") ?? DEFAULT_THEME
            );
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
        case "parse":
            if (!FsUtil.exists(parseResult.input!)) {
                panic("No such file or directory");
            }

            let parser = new Parser(SourceReference.fromPath(parseResult.input!));
            try {
                let document = parser.parse();
                console.log(JSON.stringify(document, null, 2));
            } catch (e) {
                if (e instanceof NexSyntaxError) {
                    console.log(generateSyntaxErrorPrintout(e));

                    if (settings.getOptionSetting("debug") !== null) {
                        console.error(chalk.dim(chalk.redBright(e.stack)));
                    }

                    process.exit(1);
                } else {
                    throw e;
                }
            }
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

async function startLiveServer(
    inputDirectory: string,
    port: number | null,
    theme: string
): Promise<void> {
    let liveServer = new LiveServer(theme);
    liveServer.setCurrentPath(inputDirectory);

    console.clear();
    console.log(chalk.cyanBright("Starting live server..."));
    await liveServer.serve(port ?? DEFAULT_PORT);
    console.clear();
    console.log(
        chalk.greenBright(`Started live server at http://localhost:${port ?? DEFAULT_PORT}/`)
    );
}
