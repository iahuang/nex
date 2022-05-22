import { FsUtil, unwrap } from "./util";

export class SourceLocation {
    readonly source: SourceReference;
    readonly line: number;
    readonly col: number;

    constructor(source: SourceReference, line: number, col: number) {
        this.source = source;
        this.line = line;
        this.col = col;
    }
}

export enum SourceType {
    File,
    Anonymous,
}

export class SourceCache {
    /*
        A singleton object that stores the contents of SourceReference objects
    */

    private static _instance: SourceCache | null = null;

    static getInstance() {
        if (this._instance === null) {
            this._instance = new SourceCache();
        }
        return this._instance;
    }

    // _data associates a source ID to its content
    _data: Map<string, string>;
    // current anonymous ID; will be incremented each time a new one is requested
    _anonID: number;

    private constructor() {
        this._data = new Map<string, string>();
        this._anonID = 0;
    }

    _requestNewAnonymousID() {
        this._anonID += 1;
        return "anon:" + this._anonID.toString(16);
    }

    addAnonymousSource(content: string) {
        /*
            Add anonymous source file to cache, assigning it an ID
            for future use
        */
        let id = this._requestNewAnonymousID();
        this._data.set(id, content);

        return id;
    }

    addFileSource(path: string) {
        /*
            Read contents of source file and add to cache, assinging it
            an ID for future use
        */

        let id = "path:" + FsUtil.resolvePath(path);
        this._data.set(id, FsUtil.readText(path));

        return id;
    }

    getSourceContent(id: string) {
        /*
            When an object is added to the cache, it is assigned an ID;
            by providing that ID, return the contents of the corresponding object.
        */

        let content = this._data.get(id);

        if (content === undefined) {
            throw new Error("Invalid source cache ID: " + id);
        }

        return content;
    }
}

export class SourceReference {
    /*
        A reference to a NeX source file.

        The actual content of the source is not stored as part of this object and thus this is a
        light-weight object with a small memory footprint
        and therefore it can be copied and passed around without side-effects. Two copies of the
        same SourceReference refer to the same thing.
    */

    _path: string | null;
    readonly type: SourceType;
    // the actual contents of this source are not stored in-object.
    // instead, we store a reference ID and have the actual contents
    // stored in a cache object.
    _cacheID: string | null;

    private constructor(type: SourceType) {
        this.type = type;
        this._path = null;
        this._cacheID = null;
    }

    static fromPath(path: string) {
        let source = new SourceReference(SourceType.File);
        source._path = FsUtil.resolvePath(path);
        source._cacheID = SourceCache.getInstance().addFileSource(path);
        return source;
    }

    static asAnonymous(content: string) {
        let source = new SourceReference(SourceType.Anonymous);
        source._cacheID = SourceCache.getInstance().addAnonymousSource(content);
        return source;
    }

    getPath() {
        /*
            Get underlying source path; if the source is anonymous
            throw an error
        */

        if (this.isAnonymous()) {
            throw new Error("Cannot get path of anonymous source");
        }

        return unwrap(this._path);
    }

    isAnonymous() {
        return this.type === SourceType.Anonymous;
    }

    getID() {
        return this._cacheID;
    }

    getContent() {
        /*
            Get underlying contents of the entity which this object references;
            if it is a file, returned its cached contents.
        */

        return SourceCache.getInstance().getSourceContent(unwrap(this._cacheID));
    }

    copy(): SourceReference {
        return { ...this };
    }
}
