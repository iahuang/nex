export interface Version {
    major: number;
    minor: number;
    patch: number;
}

/**
 * Return `true` if version `a` is newer than or the same as `b`.
 */
export function versionAtOrNewerThan(a: Version, b: Version): boolean {
    if (a.major < b.major) {
        return false;
    }

    if (a.major > b.major) {
        return true;
    }

    if (a.minor < b.minor) {
        return false;
    }

    if (a.minor > b.minor) {
        return true;
    }

    return a.patch >= b.patch;
}

export function asVersionString(version: Version): string {
    return `${version.major}.${version.major}.${version.patch}`;
}
