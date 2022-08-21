import { FsUtil, md5Hash } from "./util";

/**
 * Very simple file system cache/storage utility.
 */
export class Cache {
    directory: string;

    constructor(cacheDirectory: string) {
        this.directory = cacheDirectory;

        FsUtil.makeDir(this.directory);
    }

    clear(): void {
        FsUtil.remove(this.directory);
        FsUtil.makeDir(this.directory);
    }

    objectIDToCacheFilePath(objectID: string): string {
        return FsUtil.joinPath(this.directory, md5Hash(objectID));
    }

    setBytes(objectID: string, data: Buffer): void {
        FsUtil.write(this.objectIDToCacheFilePath(objectID), data);
    }

    getBytes(objectID: string): Buffer | null {
        let cacheFile = this.objectIDToCacheFilePath(objectID);

        if (!FsUtil.exists(cacheFile)) {
            return null;
        }

        return FsUtil.readBytes(cacheFile);
    }

    set(objectID: string, data: string): void {
        FsUtil.write(this.objectIDToCacheFilePath(objectID), data);
    }

    get(objectID: string): string | null {
        let cacheFile = this.objectIDToCacheFilePath(objectID);

        if (!FsUtil.exists(cacheFile)) {
            return null;
        }

        return FsUtil.readText(cacheFile);
    }
}
