export class DocumentMetadata {
    private _data: Map<string, string>;

    constructor() {
        this._data = new Map();
    }

    setKey(key: string, value: any): void {
        this._data.set(key, JSON.stringify(value));
    }

    getKey<T>(key: string): T {
        let v = this._data.get(key);

        if (v === undefined) {
            throw new Error(`No entry in document metadata with key "${key}"`);
        }

        return JSON.parse(v);
    }

    asJSONString(): string {
        let output: {[k: string]: any} = {};

        for (let [k, v] of this._data.entries()) {
            output[k] = JSON.parse(v);
        }

        return JSON.stringify(output);
    }
}
