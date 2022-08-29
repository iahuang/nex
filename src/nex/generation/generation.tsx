import { ScriptDependency, StylesheetDependency } from "../dependency";
import { Document } from "../parser/ast";
import { resolveResourcePath } from "../resources";
import { ThemeData } from "../theme";
import { FsUtil } from "../util";
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

export class DocumentHTMLGenerator {
    katexStylesheet: StylesheetDependency;
    katexScript: ScriptDependency;

    desmosScript: ScriptDependency;

    highlightScript: ScriptDependency;
    highlightStylesheet: StylesheetDependency;

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
            url: "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.6.0/highlight.min.js",
        });
    }

    private async _generateHeader(theme: ThemeData, title: string | null): Promise<HTMLNode> {
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

    /**
     * Convert the provided document to a standalone HTML
     * and return an HTML string.
     */
    async generateStandaloneHTML(document: Document, themeData: ThemeData): Promise<string> {
        let launchScript = FsUtil.readText(resolveResourcePath("document_renderer.js"));
        let elementBuilder = new ElementBuilder();

        let htmlRoot: HTMLNode = (
            <html>
                {await this._generateHeader(themeData, document.title)}

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
                {new HTMLVerbatim("<script>" + launchScript + "</script>")}
            </html>
        );

        return "<!DOCTYPE html>\n" + htmlRoot.asHTML();
    }
}
