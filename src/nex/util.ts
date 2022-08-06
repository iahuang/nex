import fs from "fs";
import { join, resolve } from "path";

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
    export function write(path: string, content: FileWriteable): void {
        fs.writeFileSync(path, content);
    }

    export function readText(path: string): string {
        return withUnixEndlines(fs.readFileSync(path, "utf-8"));
    }

    export function readBytes(path: string): Buffer {
        return fs.readFileSync(path);
    }

    export function readLines(path: string): string[] {
        return readText(path).split("\n");
    }

    export function resolvePath(path: string): string {
        return resolve(path);
    }

    export function joinPath(...path: string[]): string {
        return join(...path);
    }
}
