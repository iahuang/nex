export interface CLISchema {
    globalOptions: Option[];
    modes: Mode[];
}

export interface Mode {
    name: string;
    description: string;
    options: Option[];
    requiresInput: boolean;
    inputDescription?: string;
}

export interface Option {
    name: string;
    requiresArgument: boolean;
    allowDuplicates: boolean;
    shortcut?: string;
    description?: string;
    argumentDescription?: string;
    validator?: (value: string, reject: (reason: string) => never) => void;
}

export interface ArgvParseResult {
    mode: string;
    input: string | null;
    optionSettings: OptionSettings;
}

/**
 * Given a list of options and a query such as `"--help"` or `"-h", return
 * the corresponding option, or `null` if one could not be found of the provided options.
 */
function obtainOptionFromQuery(options: Option[], query: string): Option | null {
    if (query.startsWith("--")) {
        let optionName = query.slice(2);

        for (let opt of options) {
            if (opt.name === optionName) {
                return opt;
            }
        }
    } else if (query.startsWith("-")) {
        let optionShortcut = query.slice(1);

        for (let opt of options) {
            if (opt.shortcut === optionShortcut) {
                return opt;
            }
        }
    }

    return null;
}

/**
 * Parse the value of `process.argv` into an object containing an `ArgvParseResult` if
 * successful, otherwise, return an error.
 *
 * If no arguments were passed, return `null`.
 */
export function parseArgv(
    argv: string[],
    schema: CLISchema
): { result: ArgvParseResult; error: null } | { result: null; error: string } | null {
    // We start at 2, since the first two elements of argv are `node` and the
    // filename.
    let argIndex = 2;

    if (argv.length === 2) {
        return null;
    }

    let input: string | null = null;
    let modeName = argv[argIndex];
    let selectedMode: Mode | null = null;
    let settings = new OptionSettings();

    // validate that provided mode is a valid mode
    for (let mode of schema.modes) {
        if (mode.name === modeName) {
            selectedMode = mode;
        }
    }

    if (selectedMode === null) {
        return {
            result: null,
            error: `Invalid mode "${modeName}". Use "nex help" for more information`,
        };
    }

    argIndex += 1;

    while (argIndex < argv.length) {
        let arg = argv[argIndex];
        // if the argument isn't prefixed with "-", it's assumed to be the input to the mode,
        // if the mode has one
        if (!arg.startsWith("-") && selectedMode.requiresInput) {
            input = arg;
            argIndex += 1;
            continue;
        }

        let option = obtainOptionFromQuery(selectedMode.options, arg);

        if (!option) {
            option = obtainOptionFromQuery(schema.globalOptions, arg);
        }

        if (!option) {
            return {
                result: null,
                error: `Invalid option "${arg}". Use "nex help" for a list of options`,
            };
        }

        let optionValue: string | null = null;

        if (option.requiresArgument) {
            argIndex += 1;

            optionValue = argv[argIndex];

            if (optionValue === undefined) {
                return {
                    result: null,
                    error: `Option "--${option.name}" requires an value, but no value was provided.`,
                };
            }

            // validate option value
            if (option.validator) {
                try {
                    option.validator(optionValue, (reason: string) => {
                        throw new ValidationRejection(reason);
                    });
                } catch (e) {
                    if (e instanceof ValidationRejection) {
                        return {
                            result: null,
                            error: `Value "${optionValue}" for option "--${option.name}" is invalid; reason: ${e.reason}`,
                        };
                    } else {
                        throw e;
                    }
                }
            }
        }

        // ensure duplicates are allowed, if this is a duplicate
        if (!option.allowDuplicates && settings.hasOption(option.name)) {
            return {
                result: null,
                error: `Option "--${option.name}" does not allow more than one usage`,
            };
        }

        settings.addOptionSetting({
            optionName: option.name,
            setting: optionValue,
        });

        argIndex += 1;
    }

    // ensure input is present, if required
    if (selectedMode.requiresInput) {
        if (!input) {
            return {
                result: null,
                error: `Mode "${modeName}" requires an input: [${selectedMode.inputDescription ?? ""}]`
            }
        }
    }

    // Return completed result

    return {
        result: {
            mode: modeName,
            input: input,
            optionSettings: settings,
        },
        error: null,
    };
}

class ValidationRejection extends Error {
    reason: string;

    constructor(reason: string) {
        super(reason);

        this.reason = reason;
    }
}

interface OptionSetting {
    optionName: string;
    setting: string | null;
}

export class OptionSettings {
    private _optionSettings: OptionSetting[];

    constructor() {
        this._optionSettings = [];
    }

    addOptionSetting(optionSetting: OptionSetting): void {
        this._optionSettings.push(optionSetting);
    }

    hasOption(name: string): boolean {
        for (let setting of this._optionSettings) {
            if (setting.optionName === name) {
                return true;
            }
        }

        return false;
    }

    getOptionSetting(name: string): string | null {
        for (let setting of this._optionSettings) {
            if (setting.optionName === name) {
                return setting.setting;
            }
        }

        return null;
    }
}
