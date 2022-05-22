import fs from "fs";
import { join, resolve } from "path";

type Printable = string | number | boolean | undefined | null;

export class StringBuffer {
    /*
        A helper class to generate human-readable strings in a manner similar to stdout
    */

    _buffer: string;

    constructor() {
        this._buffer = "";
    }

    println(...args: Printable[]) {
        this._buffer += args.join(" ") + "\n";
    }

    print(...args: Printable[]) {
        this._buffer += args.join(" ");
    }

    read() {
        return this._buffer;
    }
}

export function assert(condition: boolean, message?: string) {
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

type FileWriteable = string | Buffer | Uint8Array | DataView;

export function withUnixEndlines(content: string) {
    return content.replace(/\r\n/g, "\n");
}

export namespace FsUtil {
    /*
        Implements file utility functions with better cross-platform support
        e.g. forcing Unix endlines. For standardization purposes, refrain from using
        the built-in fs module.
    */
    export function write(path: string, content: FileWriteable) {
        fs.writeFileSync(path, content);
    }

    export function readText(path: string) {
        return withUnixEndlines(fs.readFileSync(path, "utf-8"));
    }

    export function readBytes(path: string) {
        return fs.readFileSync(path);
    }

    export function readLines(path: string) {
        return readText(path).split("\n");
    }

    export function resolvePath(path: string) {
        return resolve(path);
    }

    export function joinPath(...path: string[]) {
        return join(...path);
    }
}
