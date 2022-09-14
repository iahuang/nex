import chalk from "chalk";
import { LiveServer } from "../live_server";
import { ThemeManager } from "../theme";

const DEFAULT_PORT = 3000;

export async function startLiveServer(inputDirectory: string, port: number | null): Promise<void> {
    let liveServer = new LiveServer();
    liveServer.setCurrentPath(inputDirectory);
    
    console.clear();
    console.log(chalk.cyanBright("Starting live server..."));
    await liveServer.serve(port ?? DEFAULT_PORT);
    console.clear();
    console.log(
        chalk.greenBright(`Started live server at http://localhost:${port ?? DEFAULT_PORT}/`)
    );
}
