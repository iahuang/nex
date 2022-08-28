import { TokenStream } from "./token_stream";
import { SETTING_DECLARATION, SETTING_NAME } from "./token_types";

interface Setting {
    name: string;
    allowDuplicates: boolean;
    requiresArgument: boolean;
    handler: () => string;
}

export class SettingHandler {
    schema: Setting[];
    private _settings: Map<string, string[]>;
    tokenStream: TokenStream;

    constructor(schema: Setting[], tokenStream: TokenStream) {
        this.schema = schema;
        this._settings = new Map();
        this.tokenStream = tokenStream;

        for (let setting of schema) {
            this._settings.set(setting.name, []);
        }
    }

    getSettingInfo(settingName: string): Setting | null {
        for (let setting of this.schema) {
            if (setting.name === settingName) {
                return setting;
            }
        }

        return null;
    }

    getSettingValue(settingName: string): string | null {
        return this._settings.get(settingName)![0] ?? null;
    }

    getSettingValues(settingName: string): string[] {
        return this._settings.get(settingName)!;
    }

    // /**
    //  * To be used as a value for `Setting.handler`. Asserts that no text follows the setting
    //  * declaration and name.
    //  */
    // static noArgumentHandlerFunction(parser: ParserBase): string {
    //     parser.expectToken(TokenType.EOL, { skipWhitespace: false });

    //     return "";
    // }
    
    handleSettingDeclaration(): void {
        this.tokenStream.grabToken([SETTING_DECLARATION]);

        let settingNameToken = this.tokenStream.grabToken([SETTING_NAME]);

        let settingName = settingNameToken.content;
        let setting = this.getSettingInfo(settingName);

        if (!setting) {
            this.tokenStream.throwSyntaxError(
                `Unrecognized setting name "${settingName}"`,
                settingNameToken
            );
        }

        let settingContent = setting.handler();

        // If a setting of this name already exists, confirm that duplicates are allowed
        if (this._settings.get(settingName)!.length > 0 && !setting.allowDuplicates) {
            this.tokenStream.throwSyntaxError(
                `Cannot invoke setting "${settingName}" more than once`,
                settingNameToken
            );
        }

        // Confirm that setting argument is specified, if needed
        if (setting.requiresArgument && !settingContent.trim()) {
            this.tokenStream.throwSyntaxError(
                `Argument for setting "${setting.name}" is required, but none was specified`
            );
        }

        this._settings.get(settingName)!.push(settingContent);
    }
}
