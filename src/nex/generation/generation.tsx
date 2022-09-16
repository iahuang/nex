import { generateSyntaxErrorPrintout } from "../cli/cli_utils";
import { ScriptDependency, StylesheetDependency } from "../dependency";
import { Document } from "../parser/ast";
import { NexSyntaxError } from "../parser/errors";
import { resolveResourcePath } from "../resources";
import { ThemeData } from "../theme";
import { FsUtil, stripAnsi } from "../util";
import { ElementBuilder } from "./element_templates";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { createElement, HTMLNode, HTMLVerbatim } from "./jsx";

const KATEX_FONTS = [
    "fonts/KaTeX_AMS-Regular.woff2",
    "fonts/KaTeX_Caligraphic-Bold.woff2",
    "fonts/KaTeX_Caligraphic-Regular.woff2",
    "fonts/KaTeX_Fraktur-Bold.woff2",
    "fonts/KaTeX_Fraktur-Regular.woff2",
    "fonts/KaTeX_Main-Bold.woff2",
    "fonts/KaTeX_Main-BoldItalic.woff2",
    "fonts/KaTeX_Main-Italic.woff2",
    "fonts/KaTeX_Main-Regular.woff2",
    "fonts/KaTeX_Math-BoldItalic.woff2",
    "fonts/KaTeX_Math-Italic.woff2",
    "fonts/KaTeX_SansSerif-Bold.woff2",
    "fonts/KaTeX_SansSerif-Italic.woff2",
    "fonts/KaTeX_SansSerif-Regular.woff2",
    "fonts/KaTeX_Script-Regular.woff2",
    "fonts/KaTeX_Size1-Regular.woff2",
    "fonts/KaTeX_Size2-Regular.woff2",
    "fonts/KaTeX_Size3-Regular.woff2",
    "fonts/KaTeX_Size4-Regular.woff2",
    "fonts/KaTeX_Typewriter-Regular.woff2",
];

export interface DocumentUpdateData {
    bodyHTML: string;
    javascriptCodeFragment: string;
}

export class DocumentHTMLGenerator {
    katexStylesheet: StylesheetDependency;
    katexScript: ScriptDependency;

    desmosScript: ScriptDependency;

    highlightScript: ScriptDependency;
    highlightStylesheet: StylesheetDependency;

    googleMaterialSymbols: StylesheetDependency;

    constructor() {
        // KATEX

        this.katexStylesheet = new StylesheetDependency({
            url: "https://cdn.jsdelivr.net/npm/katex@0.16.0/dist/katex.min.css",
        });

        for (let fontFile of KATEX_FONTS) {
            this.katexStylesheet.addExternalFontDependency(fontFile, {
                url: "https://cdn.jsdelivr.net/npm/katex@0.16.0/dist/" + fontFile,
            });
        }

        this.katexScript = new ScriptDependency({
            url: "https://cdn.jsdelivr.net/npm/katex@0.16.0/dist/katex.min.js",
        });

        // DESMOS

        this.desmosScript = new ScriptDependency({
            url: "https://www.desmos.com/api/v1.7/calculator.js?apiKey=dcb31709b452b1cf9dc26972add0fda6",
        });

        // HIGHLIGHT JS

        this.highlightStylesheet = new StylesheetDependency({
            url: "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.6.0/styles/default.min.css",
        });

        this.highlightScript = new ScriptDependency({
            path: resolveResourcePath("lib/highlight.min.js")
        });

        // MATERIAL SYMBOLS

        this.googleMaterialSymbols = new StylesheetDependency({
            path: resolveResourcePath("material_symbols.css"),
        });

        this.googleMaterialSymbols.addExternalFontDependency("symbols_font", {
            url: "https://fonts.gstatic.com/s/materialsymbolsoutlined/v52/kJEhBvYX7BgnkSrUwT8OhrdQw4oELdPIeeII9v6oFsLjBuVY.woff2",
        });
    }

    private async _generateDependencyHeader(
        theme: ThemeData,
        title: string | null
    ): Promise<HTMLNode> {
        let baseCSS = FsUtil.readText(resolveResourcePath("base.css"));

        return (
            <head>
                {new HTMLVerbatim("<style>" + baseCSS + "</style>")}
                {new HTMLVerbatim(await this.katexStylesheet.generateEmbedding())}
                {new HTMLVerbatim(await this.katexScript.generateEmbedding())}
                {new HTMLVerbatim(await this.desmosScript.generateEmbedding())}
                {new HTMLVerbatim(await this.highlightStylesheet.generateEmbedding())}
                {new HTMLVerbatim(await this.highlightScript.generateEmbedding())}
                {new HTMLVerbatim("<style>" + theme.getPackedCSS() + "</style>")}
                {title && <title>{title}</title>}
            </head>
        );
    }

    private async _generateLiveDependencyHeader(): Promise<HTMLNode> {
        let baseCSS = FsUtil.readText(resolveResourcePath("base.css"));

        return (
            <head>
                {new HTMLVerbatim("<style>" + baseCSS + "</style>")}
                {new HTMLVerbatim(await this.katexStylesheet.generateEmbedding())}
                {new HTMLVerbatim(await this.katexScript.generateEmbedding())}
                {new HTMLVerbatim(await this.desmosScript.generateEmbedding())}
                {new HTMLVerbatim(await this.highlightStylesheet.generateEmbedding())}
                {new HTMLVerbatim(await this.highlightScript.generateEmbedding())}
                {new HTMLVerbatim(await this.googleMaterialSymbols.generateEmbedding())}
            </head>
        );
    }

    async generateLiveHTMLTemplate(): Promise<string> {
        let launchScript = FsUtil.readText(resolveResourcePath("document_renderer.js"));
        let clientScript = FsUtil.readText(resolveResourcePath("live_client.js"));
        let htmlRoot: HTMLNode = (
            <html>
                {await this._generateLiveDependencyHeader()}

                <body>
                    <noscript>
                        <div class="noscript-overlay">
                            JavaScript must be enabled to view this document.
                        </div>
                    </noscript>
                </body>
                {new HTMLVerbatim("<script>" + launchScript + "</script>")}
                {new HTMLVerbatim("<script>" + clientScript + "</script>")}
            </html>
        );

        return "<!DOCTYPE html>\n" + htmlRoot.asHTML();
    }

    /**
     * Convert the provided document to a standalone HTML
     * and return an HTML string.
     */
    async generateStandaloneHTML(document: Document, themeData: ThemeData): Promise<string> {
        let rendererScript = FsUtil.readText(resolveResourcePath("document_renderer.js"));
        let elementBuilder = new ElementBuilder();

        let htmlRoot: HTMLNode = (
            <html>
                {await this._generateDependencyHeader(themeData, document.title)}

                <body>
                    <noscript>
                        <div class="noscript-overlay">
                            JavaScript must be enabled to view this document.
                        </div>
                    </noscript>

                    {elementBuilder.elementAsHTMLNode(document)}
                </body>
                {
                    new HTMLVerbatim(
                        "<script>" +
                            "window.documentMetadata=" +
                            elementBuilder.metadata.asJSONString() +
                            "</script>"
                    )
                }
                {new HTMLVerbatim("<script>" + rendererScript + "</script>")}
                {new HTMLVerbatim("<script>renderDocument();</script>")}
            </html>
        );

        return "<!DOCTYPE html>\n" + htmlRoot.asHTML();
    }

    private _generateBackButtonHeader(parentDirectory: string): HTMLNode {
        return (
            <div class="dir-header" onclick={`requestOpen('${parentDirectory}')`}>
                <span class="dir-vcenter">
                    <span class="material-symbols-outlined">arrow_back</span>
                    Return to parent directory
                </span>
            </div>
        );
    }

    async generateLiveDocumentUpdateData(
        document: Document,
        themeData: ThemeData,
        parentDirectory: string
    ): Promise<DocumentUpdateData> {
        let elementBuilder = new ElementBuilder();
        let themeStylesheet = "<style>" + themeData.getPackedCSS() + "</style>";
        let header: HTMLNode = this._generateBackButtonHeader(parentDirectory);
        return {
            bodyHTML:
                header.asHTML() +
                themeStylesheet +
                elementBuilder.elementAsHTMLNode(document).asHTML(),
            javascriptCodeFragment:
                "window.documentMetadata=" +
                elementBuilder.metadata.asJSONString() +
                "; renderDocument();",
        };
    }

    generateLiveDirectoryBody(path: string): DocumentUpdateData {
        let files = FsUtil.listDir(path, {
            includeSymlinks: true,
            mode: "both",
        });

        // remove .DS_Store
        files = files.filter((path) => {
            return FsUtil.entityName(path) !== ".DS_Store";
        });

        let element: HTMLNode = (
            <div class="dir">
                <h1>{path}</h1>
                <div
                    class={"dir-vcenter dir-item dir-clickable"}
                    onclick={`requestOpen('${FsUtil.dirname(path)}');`}
                >
                    <span class="material-symbols-outlined">arrow_upward</span>&nbsp;&nbsp;..
                </div>
                {files.map((filePath) => {
                    let fileIcon = "draft";
                    let entityName = FsUtil.entityName(filePath);
                    let clickable = false;
                    let isNexFile = false;

                    if (FsUtil.isDirectory(filePath)) {
                        fileIcon = "folder";
                        clickable = true;

                        if (entityName.startsWith(".")) {
                            fileIcon = "folder_special";
                        }
                    }

                    let fileExtension = FsUtil.getFileExtension(filePath)?.toLowerCase();

                    // Set custom file icons depending on file extension

                    if ([".zip", ".rar", ".tar", ".gz", ".7z"].includes(fileExtension!)) {
                        fileIcon = "folder_zip";
                    }

                    if ([".jpg", ".png", ".gif", ".bmp", ".tiff"].includes(fileExtension!)) {
                        fileIcon = "image";
                    }

                    if ([".app", ".exe", ".bin", ".o", ".sh", ".bat"].includes(fileExtension!)) {
                        fileIcon = "terminal";
                    }

                    if ([".pdf", ".txt", ".md"].includes(fileExtension!)) {
                        fileIcon = "description";
                    }

                    if (
                        [
                            ".py",
                            ".ts",
                            ".js",
                            ".html",
                            ".c",
                            ".cpp",
                            ".h",
                            ".rb",
                            ".rust",
                            ".go",
                            ".java",
                            ".d",
                            ".cs",
                            ".swift",
                            ".php",
                            ".asm",
                            ".json",
                            ".yml",
                            ".xml",
                        ].includes(fileExtension!)
                    ) {
                        fileIcon = "data_object";
                    }

                    if (
                        [".mov", ".mp4", ".wmv", ".avi", ".webm", ".mkv"].includes(fileExtension!)
                    ) {
                        fileIcon = "movie";
                    }

                    if (fileExtension === ".nex") {
                        fileIcon = "file_open";
                        clickable = true;
                        isNexFile = true;
                    }

                    // Prevent access for items that this process doesn't have permission to read

                    if (!FsUtil.isAccessible(filePath)) {
                        fileIcon = "block";
                        clickable = false;
                    }

                    let classes = ["dir-vcenter", "dir-item"];

                    if (clickable) {
                        classes.push("dir-clickable");
                    } else {
                        classes.push("dir-disabled");
                    }

                    if (isNexFile) {
                        classes.push("dir-nex-file");
                    }

                    return (
                        <div
                            class={classes.join(" ")}
                            onclick={clickable ? `requestOpen('${filePath}');` : ""}
                        >
                            <span class="material-symbols-outlined">{fileIcon}</span>&nbsp;&nbsp;
                            {FsUtil.entityName(filePath)}
                        </div>
                    );
                })}
            </div>
        );

        return {
            bodyHTML: element.asHTML(),
            javascriptCodeFragment: "",
        };
    }

    generateLiveErrorBody(error: NexSyntaxError, parentDirectory: string): DocumentUpdateData {
        let element: HTMLNode = (
            <div>
                {this._generateBackButtonHeader(parentDirectory)}
                <pre>
                    <code>{stripAnsi(generateSyntaxErrorPrintout(error))}</code>
                </pre>
            </div>
        );

        return {
            bodyHTML: element.asHTML(),
            javascriptCodeFragment: "",
        };
    }
}
