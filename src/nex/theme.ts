import { panic, logWarning } from "./logging";
import { SchemaType } from "./schema";
import { FsUtil } from "./util";


export class ThemeData {
    manifest: ThemeManifest;
    cssData: string;
    private _assets: Map<string, string>;

    constructor(manifest: ThemeManifest, cssData: string) {
        this.manifest = manifest;
        this.cssData = cssData;
        this._assets = new Map();
    }

    /**
     * Add an asset by name and load its data. Asset name is assumed to be valid.
     */
    addAsset(name: string, assetDirectory: string): void {
        let assetPath = FsUtil.joinPath(assetDirectory, name);

        if (this._assets.has(name)) {
            panic(`Duplicate asset name "${name}"`);
        }

        this._assets.set(name, FsUtil.fileAsDataURL(assetPath));
    }

    getAssetAsDataURL(name: string): string {
        return this._assets.get(name)!;
    }

    /**
     * Return the contents of the `theme.css` with `asset://` URLs
     * replaced with their respective data URLs according to the
     * packed assets listed in the manifest.
     */
    getPackedCSS(): string {
        let content = this.cssData;

        for (let [assetName, dataURL] of this._assets.entries()) {
            content = content.replaceAll(`assets://` + assetName, dataURL);
        }

        return content;
    }
}

export interface ThemeManifest {
    displayName: string;
    description: string;
    author: string;
    packAssets: string[];
}

const manifestSchema = SchemaType.struct<ThemeManifest>({
    displayName: SchemaType.string,
    description: SchemaType.string,
    author: SchemaType.string,
    packAssets: SchemaType.array(SchemaType.string),
});

export class ThemeManager {
    themesDirectory: string;

    constructor(themesDirectory: string) {
        this.themesDirectory = themesDirectory;
    }

    /**
     * Return a list of theme names, all of which can be passed
     * as an argument to `loadTheme()`
     */
    loadThemeList(): string[] {
        let foldersInThemeDir = FsUtil.listDir(this.themesDirectory, { mode: "folders" });
        let themes = [];

        for (let folder of foldersInThemeDir) {
            let manifestPath = FsUtil.joinPath(folder, "manifest.json");
            // check for theme manifest
            if (!FsUtil.exists(manifestPath)) {
                logWarning(
                    `Folder in themes directory at ${FsUtil.resolvePath(
                        folder
                    )} does not contain a theme manifest!`
                );
            } else {
                themes.push(FsUtil.entityName(folder));
            }
        }

        return themes;
    }

    private _validatePackedAssets(assets: string[], assetDirectory: string): void {
        for (let asset of assets) {
            // ensure that asset name does not start with "./", "../", etc.
            if (asset.startsWith(".")) {
                panic(`Asset name "${asset}" should not specify a parent directory such as "./"`);
            }

            let assetPath = FsUtil.joinPath(assetDirectory, asset);

            // ensure that asset name resolves to somewhere within the asset directory
            if (!FsUtil.resolvePath(assetPath).startsWith(FsUtil.resolvePath(assetDirectory))) {
                panic(
                    `Asset name "${asset}" resolves to a location outside of the parent directory`
                );
            }

            // ensure that asset name represents an extant file
            if (!FsUtil.exists(assetPath)) {
                panic(`Asset name "${asset}" does not represent a corresponding existing file`);
            }
        }
    }

    loadThemeManifest(themeName: string): ThemeManifest {
        // ensure that theme name is valid
        if (!themeName.match(/^\w+$/g)) {
            panic(`Invalid theme name "${themeName}"`);
        }

        let themePath = FsUtil.joinPath(this.themesDirectory, themeName);
        let manifestPath = FsUtil.joinPath(themePath, "manifest.json");

        // load and validate manifest json data
        if (!FsUtil.exists(manifestPath)) {
            panic(`Theme "${themeName}" lacks a manifest.json file`);
        }

        let manifestData = FsUtil.readJSON(manifestPath) as ThemeManifest;
        let manifestValidation = manifestSchema.validate(manifestData);

        if (!manifestValidation.ok) {
            panic(
                "Invalid manifest file; reasons:\n" +
                    manifestValidation.errors.map((error) => " - " + error).join("\n")
            );
        }

        return manifestData;
    }

    /**
     * Load a theme from a theme name.
     */
    loadTheme(themeName: string): ThemeData {
        // ensure that theme name is valid
        if (!themeName.match(/^\w+$/g)) {
            panic(`Invalid theme name "${themeName}"`);
        }

        let themePath = FsUtil.joinPath(this.themesDirectory, themeName);
        let assetDirectory = FsUtil.joinPath(themePath, "assets");

        let themeCSSPath = FsUtil.joinPath(themePath, "theme.css");

        // ensure theme folder exists
        if (!FsUtil.exists(themePath)) {
            panic(`Theme "${themeName}" does not exist`);
        }

        let manifestData = this.loadThemeManifest(themeName);

        // load theme.css
        if (!FsUtil.exists(themeCSSPath)) {
            panic(`Theme ${themeName} lacks a theme.css file`);
        }

        let themeData = new ThemeData(manifestData, FsUtil.readText(themeCSSPath));

        // validate assets
        this._validatePackedAssets(manifestData.packAssets, assetDirectory);

        for (let asset of manifestData.packAssets) {
            themeData.addAsset(asset, assetDirectory);
        }

        return themeData;
    }
}
