import { FsUtil } from "./util";

class Resources {
    static resourcesDirectory = "";
}

export function setResourcesDirectory(path: string): void {
    Resources.resourcesDirectory = FsUtil.resolvePath(path);
}

export function getResourcesDirectory(): string {
    return Resources.resourcesDirectory;
}

/**
 * Resolve relative resource path such as `themes` into an absolute
 * path starting with the absolute path of the resources folder, e.g.
 * `/[...]/nex/resources/themes`. If the path resolves outside
 * of the resource folder, throw an error.
 */
export function resolveResourcePath(path: string): string {
    let fullPath = FsUtil.joinPath(getResourcesDirectory(), path);

    if (!fullPath.startsWith(getResourcesDirectory())) {
        throw new Error(
            `Resource path "${path}" does not resolve to a path within the resource directory`
        );
    }

    return fullPath;
}
