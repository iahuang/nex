import chalk from "chalk";

export function logWarning(message: string): void {
    console.warn(chalk.yellowBright("warning: " + message));
}

export function panic(message: string): never {
    console.error(chalk.redBright("error: " + message));
    process.exit(1);
}
