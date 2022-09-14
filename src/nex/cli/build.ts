import chalk from "chalk";
import { DocumentHTMLGenerator } from "../generation/generation";
import { panic } from "../logging";
import { astDump } from "../parser/ast";
import { NexSyntaxError } from "../parser/errors";
import { Parser } from "../parser/parser";
import { SourceReference } from "../source";
import { DEFAULT_THEME, ThemeManager } from "../theme";
import { FsUtil } from "../util";
import { generateSyntaxErrorPrintout } from "./cli_utils";

interface BuildArgs {
    inputFile: string;
    outputFile: string | null;
    theme: string | null;
    debugMode: string | null;
}

/**
 * If an output path isn't specified, the output path should default to the input file path, but
 * with the file extension set to `.html` instead of `.nex`.
 *
 * For instance, `nex build ~/test.x.nex` should output to `~/tet.x.html`
 */
function generateDefaultOutputPath(inputFile: string): string {
    let parentDirectory = FsUtil.dirname(inputFile);
    let entityName = FsUtil.entityName(inputFile);
    let parts = entityName.split(".");
    let allButFinalExtension = parts.slice(parts.length - 1).join(".");
    let newFileName = allButFinalExtension + ".nex";

    return FsUtil.joinPath(parentDirectory, newFileName);
}

export async function buildStandalone(args: BuildArgs): Promise<void> {
    let themeManager = new ThemeManager();
    let themeName = args.theme ?? DEFAULT_THEME;
    let outputFile = args.outputFile ?? generateDefaultOutputPath(args.inputFile);

    if (!FsUtil.exists(args.inputFile)) {
        panic("No such file or directory");
    }

    if (!themeManager.doesThemeExist(themeName)) {
        panic(
            `No theme exists with name "${themeName}". To see a list of available themes, run "nex list-themes"`
        );
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
            themeManager.loadTheme(themeName)
        );

        FsUtil.write(outputFile, html);
    } catch (e) {
        if (e instanceof NexSyntaxError) {
            console.log(generateSyntaxErrorPrintout(e));

            if (args.debugMode !== null) {
                console.error(chalk.dim(chalk.redBright(e.stack)));
            }

            process.exit(1);
        } else {
            throw e;
        }
    }
}
