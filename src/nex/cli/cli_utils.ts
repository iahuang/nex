import chalk from "chalk";
import { NexSyntaxError } from "../parser/errors";
import { SourceReference } from "../source";
import { StringBuffer, stripAnsi } from "../util";
import { Option, CLISchema } from "./argv_parser";

/**
 * Given an `Option` object, return a string such as
 * `"--output, -o [path]"` with ANSI coloring.
 */
function _makeOptionString(option: Option): string {
    let first = option.shortcut ? `--${option.name}, -${option.shortcut}` : `--${option.name}`;

    if (option.requiresArgument) {
        return (
            `${chalk.magentaBright(first)}` +
            chalk.italic(
                chalk.dim(chalk.magentaBright(` [${option.argumentDescription ?? "value"}]`))
            )
        );
    }

    return chalk.magentaBright(first);
}

/**
 * Print CLI help message to stdout; invoked by `nex help`.
 */
export function printHelpMessage(schema: CLISchema): void {
    let output = new StringBuffer();

    output.writeln("Usage:", "nex", chalk.cyanBright("[mode]"), chalk.magentaBright("[options]"));
    output.writeln();

    let optionStrings: string[] = [];

    for (let mode of schema.modes) {
        optionStrings.push(...mode.options.map((opt) => stripAnsi(_makeOptionString(opt))));
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
            output.write(
                indentOption + " ".repeat(maxOptionStringLength - stripAnsi(optionString).length)
            );
            output.write(_makeOptionString(option));
            output.write("  ");

            let i = 0;
            for (let line of (option.description ?? "(No description provided)").split("\n")) {
                if (i > 0) {
                    output.write(indentOption + " ".repeat(maxOptionStringLength) + "  ");
                }

                output.writeln(line);

                i += 1;
            }
        }

        output.writeln("\n");
    }

    process.stdout.write(output.read());
}

/**
 * Given a location in a NeX source, print a preview of that general part of the source, e.g.
 * ```plain
 *  9|
 * 10| abcdefg {
 * 11|     1234567890
 * 12| }
 * ```
 */
function printSourcePreview(
    source: SourceReference,
    line: number,
    lookback: number
): {
    output: string;
    marginWidth: number;
} {
    let output = new StringBuffer();
    let lines = source.getContent().split("\n");
    let lineNumberMaxWidth = line.toString().length;

    for (let lineNumber = Math.max(1, line - lookback); lineNumber <= line; lineNumber++) {
        let lineContent = lines[lineNumber - 1];
        output.write(
            chalk.dim(
                chalk.bold(
                    " ".repeat(lineNumberMaxWidth - lineNumber.toString().length) + lineNumber
                )
            )
        );
        output.write(chalk.dim("| "));
        output.writeln(lineContent);
    }

    return {
        output: output.read(),
        marginWidth: lineNumberMaxWidth + 2,
    };
}

/**
 * Format, color, and return a string representation of a NeX syntax error
 * to be printed to the console
 */
export function generateSyntaxErrorPrintout(error: NexSyntaxError): string {
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
    let sourcePreview = printSourcePreview(error.location.source, error.location.line, 4);
    output.write(sourcePreview.output);

    if (error.offendingToken) {
        output.writeln(
            chalk.redBright(
                " ".repeat(error.location.col - 1 + sourcePreview.marginWidth) +
                    "~".repeat(error.offendingToken.content.length)
            )
        );
    } else {
        output.writeln(
            chalk.redBright(" ".repeat(error.location.col - 1 + sourcePreview.marginWidth) + "^")
        );
    }

    if (error.note) {
        output.writeln(chalk.bold(chalk.yellowBright("note: ")) + error.note);
    }

    return output.read();
}
