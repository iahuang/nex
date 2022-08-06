import { Version } from "./version";

interface NexBuildMetadata {
    version: Version;
}

export let NEX_META: NexBuildMetadata = {
    version: {
        major: 0,
        minor: 0,
        patch: 0
    }
};
