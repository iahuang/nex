import axios from "axios";
import chalk from "chalk";
import { Cache } from "../cache";
import { panic } from "../logging";
import { resolveResourcePath } from "../resources";
import { FsUtil } from "../util";

export class DependencyManager {
    private _cache: Cache;
    private _dependencies: Map<string, Dependency>;

    constructor() {
        this._cache = new Cache(resolveResourcePath("_cache/dependencies"));
        this._dependencies = new Map();
    }

    addStylesheetDependency(dependencyName: string, source: DependencySource): void {
        this._dependencies.set(
            dependencyName,
            new Dependency(DependencyType.Stylesheet, source, dependencyName)
        );
    }

    addScriptDependency(dependencyName: string, source: DependencySource): void {
        this._dependencies.set(
            dependencyName,
            new Dependency(DependencyType.Script, source, dependencyName)
        );
    }

    getDependency(name: string): Dependency | null {
        return this._dependencies.get(name) ?? null;
    }

    /**
     * Get the dependency with the appropriate name and return an HTML string representing it
     * as a single `script` or `style` element.
     */
    async generateDependencyEmbedding(name: string, preserveURLs: boolean): Promise<string> {
        let dep = this.getDependency(name);

        if (!dep) {
            throw new Error(`No such dependency with name "${name}"`);
        }

        return await dep.generateEmbedding(this._cache, preserveURLs);
    }

    async generateAllDependencyEmbeddings(preserveURLs: boolean): Promise<string[]> {
        let embeddings: string[] = [];

        for (let name of this._dependencies.keys()) {
            embeddings.push(await this.generateDependencyEmbedding(name, preserveURLs));
        }

        return embeddings;
    }
}

export enum DependencyType {
    Stylesheet,
    Script,
}

export type DependencySource =
    | { url: string; resourcePath?: undefined }
    | { resourcePath: string; url?: undefined };

export class Dependency {
    type: DependencyType;
    source: DependencySource;
    name: string;

    constructor(type: DependencyType, source: DependencySource, name: string) {
        this.type = type;
        this.source = source;
        this.name = name;
    }

    /**
     * Return an HTML string representing this dependency as a single `script` or `style` element
     * with its content embedded. If `preserveURLs` is set to `true`, keep dependencies
     * for which the source is an external URL as a URL rather than including its data.
     */
    async generateEmbedding(dependencyCache: Cache, preserveURLs: boolean): Promise<string> {
        let cachedData = dependencyCache.get(this.name);
        let data;

        if (cachedData !== null) {
            data = cachedData;
        } else {
            let sourceData = await this._loadSourceData();
            dependencyCache.set(this.name, sourceData);
            data = sourceData;
        }

        if (preserveURLs && this.source.url) {
            if (this.type === DependencyType.Script) {
                return `<script src="${this.source.url}"></script>`;
            } else {
                return `<link rel="stylesheet" href="${this.source.url}"></link>`;
            }
        }

        if (this.type === DependencyType.Script) {
            return `<script>${data}</script>`;
        } else {
            return `<style>${data}</style>`;
        }
    }

    private async _loadSourceData(): Promise<string> {
        if (this.source.url !== undefined) {
            return new Promise((resolve) => {
                console.log(chalk.cyanBright(`Downloading dependency ${this.source.url}...`));

                axios
                    .get(this.source.url!)
                    .then((response) => {
                        resolve(response.data);
                    })
                    .catch((error) => {
                        panic(`Request to ${this.source.url} failed: ` + error);
                    });
            });
        } else {
            return FsUtil.readText(resolveResourcePath(this.source.resourcePath));
        }
    }
}
