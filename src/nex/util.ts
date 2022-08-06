import fs from "fs";
import mime from "mime-types";
import { join, parse, resolve } from "path";

type Printable = string | number | boolean | undefined | null;

/**
 * A helper class to generate human-readable strings in a manner similar to stdout
 */
export class StringBuffer {
    private _buffer: string;

    constructor() {
        this._buffer = "";
    }

    writeln(...args: Printable[]): void {
        this._buffer += args.join(" ") + "\n";
    }

    write(...args: Printable[]): void {
        this._buffer += args.join(" ");
    }

    read(): string {
        return this._buffer;
    }
}

export function assert(condition: boolean, message?: string): void | never {
    if (condition) return;

    throw new Error(message ?? "assertion error");
}

export function unwrap<T>(value: T | null): T {
    /*
        Unwrap a nullable value, that is, return
        the value with a definite type if the value is not null.

        If the value is null (not undefined, only null), throw an error.

    */

    if (value === null) {
        throw new Error("tried to unwrap a null value");
    }

    return value;
}

export function sum(array: number[]): number {
    let sum = 0;

    for (let n of array) {
        sum += n;
    }

    return sum;
}

type FileWriteable = string | Buffer | Uint8Array | DataView;

export function withUnixEndlines(content: string): string {
    return content.replace(/\r\n/g, "\n");
}

/**
 * Implements file utility functions with better cross-platform support
 * e.g. forcing Unix endlines. For standardization purposes, refrain from using
 * the built-in `fs` module.
 */
export namespace FsUtil {
    /**
     * Return `content` where `\r\n` is replaced with `\n`.
     */
    export function withUnixEndlines(content: string): string {
        return content.replace(/\r\n/g, "\n");
    }

    /**
     * Write the contents of `content` to the file specified by `path`.
     * If the file at `path` already exists, it is overwritten.
     * If the file does not exist, it is created.
     */
    export function write(path: string, content: FileWriteable): void {
        fs.writeFileSync(path, content);
    }

    /**
     * Write data in JSON format to the file specified by `path`.
     * If `compressed` is `false`, then the resulting JSON data is formatted
     * and indented.
     * If the file at `path` already exists, it is overwritten.
     * If the file does not exist, it is created.
     */
    export function writeJSON<T>(path: string, data: T, compressed = false): void {
        if (compressed) {
            write(path, JSON.stringify(data));
        } else {
            write(path, JSON.stringify(data, null, 4));
        }
    }

    /**
     * Read the contents of the file at `path` as text and return a utf-8 decoded string.
     * Windows newlines will be converted to Unix newlines.
     */
    export function readText(path: string): string {
        return withUnixEndlines(fs.readFileSync(path, "utf-8"));
    }

    /**
     * Attempt to read the contents of the file at `path` as a JSON file.
     */
    export function readJSON(path: string): any {
        return JSON.parse(readText(path));
    }

    /**
     * Read the contents of the file at `path` and return its context as bytes.
     */
    export function readBytes(path: string): Buffer {
        return fs.readFileSync(path);
    }

    /**
     * Read the contents of a file as an array of lines in that file.
     * Optionally, pass `removeBlankLines=true` to filter out blank lines.
     */
    export function readLines(path: string, removeBlankLines = false): string[] {
        let lines = readText(path).split("\n");
        if (removeBlankLines) {
            lines = lines.filter((n) => n.length > 0);
        }
        return lines;
    }

    /**
     * Load file; return contents as HTML base64-encoded data URL.
     *
     * If `mimeType` is not specified, infer based on file name extension.
     * If the MIME type cannot be inferred, use `application/octet-stream`.
     */
    export function fileAsDataURL(path: string, mimeType: string | null = null): string {
        let content = readBytes(path);

        if (!mimeType) {
            mimeType = mime.lookup(path) || "application/octet-stream";
        }

        return "data:" + mimeType + ";base64," + content.toString("base64");
    }

    /**
     * Equivalent to `path.resolve`
     */
    export function resolvePath(path: string): string {
        return resolve(path);
    }

    /**
     * Equivalent to `path.join`
     */
    export function joinPath(...path: string[]): string {
        return join(...path);
    }

    /**
     * Equivalent to `fs.existsSync`
     */
    export function exists(path: string): boolean {
        return fs.existsSync(path);
    }

    /**
     * Creates the directory specified by `path`, including any missing parent directories.
     * If the directory specified already exists, this function will not do anything.
     */
    export function makeDir(path: string): void {
        if (exists(path)) return;

        fs.mkdirSync(path, { recursive: true });
    }

    /**
     *  - `mode`: Specifies whether to look for files, folders or both. Default is `"both"`.
     *  - `includeSymlinks`: Whether to include symbolically linked files in this directory.
     *     Default is `false`.
     */
    export interface ListDirOptions {
        mode?: "files" | "folders" | "both";
        includeSymlinks?: boolean;
    }

    /**
     * Return the entities in a directory. See the documentation for
     * `ListDirOptions` for more options.
     *
     * Each path returned includes the parent directory
     */
    export function listDir(parentDirectory: string, _options?: ListDirOptions): string[] {
        let options: ListDirOptions = _options ?? {};

        let items = fs.readdirSync(parentDirectory);

        // Each item returned by readdirSync is just the name of that item
        // without the rest of the path. In other words, we need
        // to add the parent directory back in.
        items = items.map((path) => {
            return joinPath(parentDirectory, path);
        });

        // Filter according to _options.mode
        if (options.mode === "files") {
            items = items.filter((path) => {
                return !fs.statSync(path).isDirectory();
            });
        }
        if (options.mode === "folders") {
            items = items.filter((path) => {
                return fs.statSync(path).isDirectory();
            });
        }

        // Filter symlinks, if necessary
        if (!options.includeSymlinks) {
            items = items.filter((path) => {
                return !fs.statSync(path).isSymbolicLink();
            });
        }

        return items;
    }

    /**
     * Given a path, return only the name of the file or folder.
     *
     * Example:
     * ```
     * > entityName("/home/Desktop/thing.txt");
     * "thing.txt"
     * ```
     */
    export function entityName(path: string): string {
        return parse(path).base;
    }

    /**
     * Delete a file or folder, empty or not. If it doesn't exist, don't do anything.
     */
    export function remove(path: string): void {
        if (!exists(path)) return;

        if (fs.statSync(path).isDirectory()) {
            fs.rmdirSync(path, { recursive: true });
        } else {
            fs.unlinkSync(path);
        }
    }
}
