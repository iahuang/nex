import axios from "axios";
import chalk from "chalk";
import mime from "mime-types";
import { Cache } from "./cache";
import { resolveResourcePath } from "./resources";
import { createDataURL, FsUtil } from "./util";

export interface DependencySource {
    url?: string;
    path?: string;
}

export abstract class Dependency {
    source: DependencySource;

    constructor(source: DependencySource) {
        this.source = source;
    }

    async loadSource(): Promise<string> {
        return (await this.loadSourceBytes()).toString("utf-8");
    }

    async loadSourceBytes(): Promise<Buffer> {
        let dependencyCache = new Cache(resolveResourcePath("_cache/"));

        if (this.source.url) {
            // check whether data at URL exists in cache
            let cached = dependencyCache.getBytes(this.source.url);

            // if so, return it
            if (cached) {
                return cached;
            }

            console.log(`Downloading dependency ${chalk.cyanBright(this.source.url)}...`);

            // otherwise, perform a HTTP request
            let fetchedData = Buffer.from(
                (await axios.get(this.source.url, { responseType: "arraybuffer" })).data
            );

            dependencyCache.setBytes(this.source.url, fetchedData);

            return fetchedData;
        } else if (this.source.path) {
            return FsUtil.readBytes(this.source.path);
        }

        throw new Error("Dependency source not specified");
    }

    abstract generateEmbedding(): Promise<string>;
}

export class ScriptDependency extends Dependency {
    async generateEmbedding(): Promise<string> {
        return `<script>${await this.loadSource()}</script>`;
    }
}

export class StylesheetDependency extends Dependency {
    private _externalFonts: Map<string, FontDependency>;

    constructor(source: DependencySource) {
        super(source);

        this._externalFonts = new Map();
    }

    /**
     * Add external font dependency, i.e. font files referenced
     * via `url()` directive in this stylesheet that need to be
     * bundled. `cssURL` should be the URL as used in the stylesheet, and
     * `source` should be a reference to where the corresponding data can
     * actually be found.
     */
    addExternalFontDependency(cssURL: string, source: DependencySource): void {
        this._externalFonts.set(cssURL, new FontDependency(source));
    }

    async generateEmbedding(): Promise<string> {
        let styleData = await this.loadSource();

        // inject external font dependencies
        for (let [url, font] of this._externalFonts.entries()) {
            styleData = styleData.replaceAll(`url(${url})`, await font.generateEmbedding());
        }

        return `<style>${styleData}</style>`;
    }
}

export class FontDependency extends Dependency {
    async generateEmbedding(): Promise<string> {
        // Find source path or URL to determine MIME type of font file
        let source = this.source.url ?? this.source.path ?? "";
        let mimeType = mime.lookup(source) || "application/octet-stream";

        let dataURL = createDataURL(await this.loadSourceBytes(), mimeType);

        return `url(${dataURL})`;
    }
}
