import express from "express";
import expressWs from "express-ws";
import { Server } from "http";
import { generateSyntaxErrorPrintout } from "./cli/cli_utils";
import { DocumentHTMLGenerator, DocumentUpdateData } from "./generation/generation";
import { Document } from "./parser/ast";
import { NexSyntaxError } from "./parser/errors";
import { Parser } from "./parser/parser";
import { SourceReference } from "./source";
import { DEFAULT_THEME, ThemeManager } from "./theme";
import { FsUtil } from "./util";
import chokidar from "chokidar";
import { WebSocket } from "ws";
import chalk from "chalk";

export class LiveServer {
    app: expressWs.Application;
    private _server: Server | null;
    private _currentPath: string;
    htmlGenerator: DocumentHTMLGenerator;
    themeManager: ThemeManager;
    watcher: chokidar.FSWatcher | null;

    clients: WebSocket[];

    constructor() {
        this.themeManager = new ThemeManager();

        // https://stackoverflow.com/a/51476990
        this.app = expressWs(express()).app;

        this._server = null;
        this._currentPath = FsUtil.getHomeDirectory();
        this.watcher = null;

        this.clients = [];

        this.htmlGenerator = new DocumentHTMLGenerator();

        this.app.get("/", async (req, res) => {
            res.contentType("html");

            res.send(await this.htmlGenerator.generateLiveHTMLTemplate());
        });

        this.app.ws("/ws", async (client) => {
            this.clients.push(client);
            client.on("close", () => {
                // remove closed clients from clients list
                this.clients = this.clients.filter((c) => c !== client);
            });

            client.on("message", async (data) => {
                this.setCurrentPath(data.toString());
            });

            this.updateClient(client);
        });

        this.setCurrentPath(this._currentPath);
    }

    async updateClient(client: WebSocket): Promise<void> {
        client.send(JSON.stringify(await this.generatePageData()));
    }

    async generatePageData(): Promise<DocumentUpdateData> {
        if (this.isCurrentPathDirectory()) {
            return this.htmlGenerator.generateLiveDirectoryBody(this.getCurrentPath());
        } else {
            return this._generateDocumentData(this.getCurrentPath());
        }
    }

    private async _generateDocumentData(documentPath: string): Promise<DocumentUpdateData> {
        let theme = this.themeManager.loadTheme(DEFAULT_THEME);
        let startTimeMs = Date.now();
        let parser = new Parser(SourceReference.fromPath(documentPath));
        let document: Document;
        let doumentParentDirectory = FsUtil.dirname(documentPath);

        try {
            document = parser.parse();
        } catch (e) {
            if (e instanceof NexSyntaxError) {
                console.clear();
                console.log(generateSyntaxErrorPrintout(e));

                return this.htmlGenerator.generateLiveErrorBody(e, doumentParentDirectory);
            }

            throw e;
        }

        let html = this.htmlGenerator.generateLiveDocumentUpdateData(
            document,
            theme,
            doumentParentDirectory
        );
        console.clear();
        let elapsedTimeMs = Date.now() - startTimeMs;
        console.log(
            chalk.greenBright(`Successfully rendered document in ${Math.round(elapsedTimeMs)} ms`)
        );

        return html;
    }

    getCurrentPath(): string {
        return this._currentPath;
    }

    setCurrentPath(to: string): void {
        // Remove previous filesystem watcher
        if (this.watcher) {
            this.watcher.close();
        }

        this.watcher = null;

        if (!FsUtil.isDirectory(to)) {
            // Create new filesystem watcher for new file
            this.watcher = chokidar.watch(to);

            // When a change is detected, update clients
            this.watcher.on("change", () => {
                for (let client of this.clients) {
                    this.updateClient(client);
                }
            });
        }

        this._currentPath = FsUtil.resolvePath(to);

        // Update clients to the new current path
        for (let client of this.clients) {
            this.updateClient(client);
        }
    }

    isCurrentPathDirectory(): boolean {
        return FsUtil.isDirectory(this._currentPath);
    }

    /**
     * Start the server; non-blocking method, but will prevent the program from exiting normally.
     * Call the `stop` method to stop the server.
     */
    async serve(port: number): Promise<void> {
        return new Promise((resolve) => {
            this._server = this.app.listen(port, () => {
                resolve();
            });
        });
    }

    async stop(): Promise<void> {
        return new Promise((resolve) => {
            if (!this._server) {
                throw new Error("Server has not started yet!");
            }

            this._server.close(() => {
                resolve();
            });
        });
    }
}
