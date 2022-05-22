import os from "os";
import path from "path";
import { spawnSync } from "child_process";

const INSTALL_DIR = path.join(os.homedir(), ".nex");
const IS_WINDOWS = process.platform === "win32"; // if !IS_WINDOWS, we assume tht this is a unix machine (linux or mac)
const SHOULD_REINSTALL = process.argv.includes("--reinstall");

interface CommandOutput {
    stdout: string;
    stderr: string;
}

function getNodeMajorVersion() {
    return Number.parseInt(process.version.slice(1).split(".")[0]);
}

function recursiveCopyDirectory(target: string, dest: string) {
    /*
        Copies [target] to a new location given by [dest]. If [dest] exists, it is overwritten.
        For instance,
        
        container/
            folderA/
                thing.txt
            folderB/

        running recursiveCopyDirectory("continer/folderA", "container/folderB") yields

        container/
            folderA/
                thing.txt
            folderB/
                thing.txt
    */

    
}

function toUnixEndl(s: string) {
    return s.replace(/\r\n/g, "\n");
}

function which(cmd: string) {
    if (IS_WINDOWS) {
        return toUnixEndl(runCommand("where", [cmd])).split("\n")[0];
    } else {
        return runCommand("which", [cmd]);
    }
}

function runCommand(cmd: string, args: string[], showOutput: boolean = false): string {
    let result = spawnSync(cmd, args, { encoding: "utf-8", env: { PATH: process.env.PATH } });

    let blockQuoteString = (s: string) => {
        return toUnixEndl(s)
            .split("\n")
            .map((line) => "| " + line)
            .join("\n");
    };

    if (result.status !== 0) {
        if (result.error) {
            console.log(
                `An unexpected error occurred while running this command: "${result.error}"`
            );
            process.exit(1);
        }

        if (result.stderr) {
            console.log("This command returned an unexpected error:");
            console.log(blockQuoteString(result.stderr));
        }
    }
    if (result.stdout && showOutput) {
        console.log(blockQuoteString(result.stdout));
    }
    return result.stdout;
}

function readPathEnv() {
    let pathData = process.env["PATH"];

    if (pathData === undefined) {
        console.log("error: could not read contents of PATH");
        process.exit(1);
    }

    let path;

    // this runs under the assumption that the deliminiters are not part of any paths in PATH
    // even if they are, it shouldn't matter for the purposes of this function.
    if (IS_WINDOWS) {
        path = pathData.split(";");
    } else {
        path = pathData.split(":");
    }
    // return the paths in PATH with empty strings removed
    return path.filter((n) => n.length);
}

function arePathsEqual(a: string, b: string) {
    return path.resolve(a) === path.resolve(b);
}

async function main() {
    let path = readPathEnv();

    // check if this program is already installed, if we aren't meant to reinstall
    if (!SHOULD_REINSTALL) {
        for (let dir of path) {
            if (arePathsEqual(dir, INSTALL_DIR)) {
                console.log("NeX is already installed; to reinstall, run 'npm run reinstall'");
                process.exit(0);
            }
        }
    }

    // install deps
    console.log("Installing Dependencies...");
    await runCommand(IS_WINDOWS ? "npm.cmd" : "npm", ["install"], true);

    // build
    console.log("Compiling...");
    await runCommand(IS_WINDOWS ? "tsc.cmd" : "tsc", []);

    // copy files
    console.log("Copying files...");

    //

    // add to PATH
}

main();
