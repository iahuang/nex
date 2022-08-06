/**
 * Short JSON schema library designed for validating JSON data. Objects
 * prefixed by "ST" are schema types and should not be instantiated directly.
 */

import { StringBuffer } from "./util";

/**
 * Object returned by `STBaseType.validate`
 */
export class ValidationResult<T> {
    private _value: T | null;
    ok: boolean;
    errors: string[];

    constructor(value: T | null, errors: string[]) {
        this._value = value;
        this.ok = errors.length === 0;
        this.errors = errors;
    }

    /**
     * If the validation that returned this object succeeded, then this
     * method returns the validated value. Otherwise, this function returns an error.
     */
    unwrap(): T {
        if (!this.ok) {
            throw new Error(`Cannot unwrap invalid value! Reason: ${this.formatErrorString()}`);
        }

        return this._value as T;
    }

    static ok<T>(value: T): ValidationResult<T> {
        return new ValidationResult(value, []);
    }

    static errors<T>(errors: string[]): ValidationResult<T> {
        return new ValidationResult<T>(null, errors);
    }

    static error<T>(error: string): ValidationResult<T> {
        return new ValidationResult<T>(null, [error]);
    }

    formatErrorString(): string {
        return this.errors.map((err) => '"' + err + '"').join(", ");
    }
}

/**
 * Defines a named member of a JSON object and its type.
 */
export class ObjectMember<T> {
    /**
     * The name of the member
     */
    name: string;
    /**
     * The type of the member
     */
    type: STBaseType<T>;
    /**
     * If `defaultValue` is specified, then this entry is considered optional.
     */
    defaultValue: T | undefined;

    constructor(keyName: string, keyType: STBaseType<T>, defaultValue: T | undefined = undefined) {
        this.name = keyName;
        this.type = keyType;
        this.defaultValue = defaultValue;
    }
}

/**
 * Base class for all type definition objects. These should not be instantiated directly.
 */
export abstract class STBaseType<T> {
    /**
     * Return a validation result with `ValidationResult.ok` set to true
     * if and only if the passed value matches the respective type. Otherwise,
     * `ValidationType.errors` will contain error messages.
     */
    abstract validate(withValue: any): ValidationResult<T>;
    /**
     * Types should have a "type default value", i.e. if we were to construct
     * the most "basic" or "fundamental" value of this type, what would it be?
     */
    abstract get typeDefaultValue(): T;
    /**
     * This method should return the name of the type being represented.
     * For instance, if the subclass represents a string type, then return `"string"`.
     */
    abstract get typeName(): string;

    /**
     * Return this type as a Typescript-style string, e.g. `"boolean"` or `"number[]"`
     */
    abstract getTypeExpression(expanded?: boolean): string;
}

export class STAny extends STBaseType<any> {
    validate(withValue: any): ValidationResult<any> {
        return ValidationResult.ok(withValue);
    }

    get typeDefaultValue(): any {
        return null;
    }

    get typeName(): string {
        return "any";
    }

    getTypeExpression(): string {
        return "any";
    }
}

export class STExactValue<T> extends STBaseType<T> {
    value: T;

    constructor(value: T) {
        super();
        this.value = value;
    }

    validate(withValue: any): ValidationResult<T> {
        if (withValue !== this.value) {
            return ValidationResult.error(
                `"${withValue.toString()}" does not match required value: ${JSON.stringify(
                    this.value
                )} (got ${JSON.stringify(withValue)})`
            );
        }

        return ValidationResult.ok(withValue);
    }

    get typeDefaultValue(): T {
        return this.value;
    }

    get typeName(): string {
        return "(" + JSON.stringify(this.value) + ")";
    }

    getTypeExpression(): string {
        return JSON.stringify(this.value);
    }
}

export class STString extends STBaseType<string> {
    validate(withValue: any): ValidationResult<string> {
        if (typeof withValue === "string") {
            return ValidationResult.ok(withValue);
        }
        return ValidationResult.error(
            `Expected value of type string, got ${JSON.stringify(withValue)}`
        );
    }

    get typeDefaultValue(): string {
        return "";
    }

    get typeName(): string {
        return "string";
    }

    getTypeExpression(): string {
        return "string";
    }
}

export class STBoolean extends STBaseType<boolean> {
    validate(withValue: any): ValidationResult<boolean> {
        if (typeof withValue === "boolean") {
            return ValidationResult.ok(withValue);
        }
        return ValidationResult.error("Expected value of type boolean");
    }

    get typeDefaultValue(): boolean {
        return false;
    }

    get typeName(): string {
        return "boolean";
    }

    getTypeExpression(): string {
        return "boolean";
    }
}

export class STNumber extends STBaseType<number> {
    validate(withValue: any): ValidationResult<number> {
        if (typeof withValue === "number") {
            return ValidationResult.ok(withValue);
        }
        return ValidationResult.error("Expected value of type number");
    }

    get typeDefaultValue(): number {
        return 0;
    }

    get typeName(): string {
        return "number";
    }

    getTypeExpression(): string {
        return "number";
    }
}

export class STOptional<T> extends STBaseType<T | undefined> {
    type: STBaseType<T>;

    constructor(type: STBaseType<T>) {
        super();
        this.type = type;
    }

    get typeDefaultValue(): T | undefined {
        return undefined;
    }

    validate(withValue: any): ValidationResult<T | undefined> {
        // If the nullable value is undefined, ok
        if (withValue === undefined) return ValidationResult.ok(withValue);
        // Otherwise check that it is the correct type
        return this.type.validate(withValue);
    }

    get typeName(): string {
        return `Optional<${this.type.typeName}>`;
    }

    getTypeExpression(): string {
        return `Optional<${this.type.typeName}>`;
    }
}

export class STNullable<T> extends STBaseType<T | null> {
    type: STBaseType<T>;

    constructor(type: STBaseType<T>) {
        super();
        this.type = type;
    }

    get typeDefaultValue(): T | null {
        return null;
    }

    validate(withValue: any): ValidationResult<T | null> {
        // If the nullable value is null, ok
        if (withValue === null) return ValidationResult.ok(withValue);
        // Otherwise check that it is the correct type
        return this.type.validate(withValue);
    }

    get typeName(): string {
        return `Nullable<${this.type.typeName}>`;
    }

    getTypeExpression(): string {
        return `Nullable<${this.type.typeName}>`;
    }
}

export class STStruct<T> extends STBaseType<T> {
    members: ObjectMember<any>[];
    private _isSubset: boolean;

    constructor(initializer: { [P in keyof T]: STBaseType<any> }) {
        super();

        // Add objects from struct definition
        let members: ObjectMember<any>[] = [];
        for (let [name, type] of Object.entries(initializer)) {
            members.push(new ObjectMember(name, type as any));
        }
        this.members = members;
        this._isSubset = false;
    }

    get typeDefaultValue(): any {
        let object: { [k: string]: any } = {};

        for (let member of this.members) {
            object[member.name] = member.defaultValue ?? member.type.typeDefaultValue;
        }

        return object;
    }

    validate(withValue: any): ValidationResult<T> {
        // make sure that we were passed an object; null counts as type "object"
        if (typeof withValue !== "object" && withValue !== null) {
            return ValidationResult.error("Value is not an object or is null");
        }

        let errors: string[] = [];

        // Validate that all required members are there
        for (let member of this.members) {
            // Verify that this member is non-optional
            if (!(member.type instanceof STOptional)) {
                // validate that this member exists
                if (withValue[member.name] === undefined) {
                    errors.push(`Missing member "${member.name}"`);
                    continue;
                }

                // validate that this member is of the correct type
                let typeValidationResult = member.type.validate(withValue[member.name]);
                if (!typeValidationResult.ok) {
                    let reason = typeValidationResult.formatErrorString();
                    errors.push(`Member "${member.name}" is invalid! Reason: ${reason}`);
                }
            }
        }

        // Check for extraneous members
        if (!this._isSubset) {
            let requiredMemberNames = this.members.map((m) => m.name);

            for (let memberName of Object.keys(withValue)) {
                if (!requiredMemberNames.includes(memberName)) {
                    errors.push(`Extraneous member "${memberName}"`);
                }
            }
        }

        // Construct a validation result object
        return new ValidationResult(withValue, errors);
    }

    get typeName(): string {
        return "struct";
    }

    getTypeExpression(expanded?: boolean): string {
        let output = new StringBuffer();

        output.write(expanded ? "{\n" : "{ ");
        let i = 0;

        for (let member of this.members) {
            if (expanded) {
                output.write("    ");
            }

            output.write(member.name);
            output.write(": ");
            output.write(member.type.getTypeExpression());
            
            if (i < this.members.length - 1) {
                if (expanded) {
                    output.writeln(",")
                } else {
                    output.write(", ");
                }
            } else {
                if (expanded) {
                    output.writeln();
                }
            }

            i++;
        }

        output.write(expanded ? "}" : " }");

        return output.read();
    }

    /**
     * Call this method to allow extraneous members during validation.
     */
    makeSubset(): STStruct<T> {
        this._isSubset = true;
        return this;
    }
}

export class STArray<T> extends STBaseType<T[]> {
    type: STBaseType<T>;

    constructor(type: STBaseType<T>) {
        super();
        this.type = type;
    }

    get typeDefaultValue(): T[] {
        return [];
    }

    get typeName(): string {
        return `array<${this.type.typeName}>`;
    }

    validate(withValue: any): ValidationResult<T[]> {
        if (!Array.isArray(withValue)) {
            return ValidationResult.error("Expected an array");
        }

        // Check that all elements are of the correct type
        let i = 0;

        for (let item of withValue) {
            let validationResult = this.type.validate(item);

            if (!validationResult.ok) {
                let reason = validationResult.formatErrorString();
                let msg = `Element ${i} returned an error: ${reason}`;
                return ValidationResult.error(msg);
            }

            i++;
        }

        return ValidationResult.ok(withValue);
    }

    getTypeExpression(): string {
        return this.type.getTypeExpression()+"[]";
    }
}

/**
 * A type definition for a generic Javascript object
 * of type {[key: string]: T}.
 */
export class STDictionary<T> extends STBaseType<{ [key: string]: T }> {
    type: STBaseType<T>;

    constructor(type: STBaseType<T>) {
        super();
        this.type = type;
    }

    get typeDefaultValue(): { [key: string]: T } {
        return {};
    }

    get typeName(): string {
        return `dict<${this.type.typeName}>`;
    }

    validate(withValue: any): ValidationResult<{ [key: string]: T }> {
        // make sure that we were passed an object; null counts as type "object"
        if (typeof withValue !== "object" && withValue !== null) {
            return ValidationResult.error("Value is not an object or is null");
        }

        // make sure each value is of the correct type
        for (let [key, value] of Object.entries(withValue)) {
            let validationResult = this.type.validate(value);

            if (!validationResult.ok) {
                let reason = validationResult.formatErrorString();
                let msg = `Key "${key}" returned an error: ${reason}`;
                return ValidationResult.error(msg);
            }
        }

        return ValidationResult.ok(withValue);
    }

    getTypeExpression(): string {
        return `{[key: string]: ${this.type.getTypeExpression()}}`
    }
}

/**
 * Generator functions for type definitions
 */
export namespace SchemaType {
    export const number = new STNumber();
    export const boolean = new STBoolean();
    export const string = new STString();
    export const any = new STAny();
    export function nullable<T>(type: STBaseType<T>): STNullable<T> {
        return new STNullable(type);
    }
    export function optional<T>(type: STBaseType<T>): STOptional<T> {
        return new STOptional(type);
    }
    export function struct<T>(schema: { [P in keyof T]: STBaseType<any> }): STStruct<T> {
        return new STStruct(schema);
    }
    export function array<T>(type: STBaseType<T>): STArray<T> {
        return new STArray(type);
    }
    export function dictionary<T>(type: STBaseType<T>): STDictionary<T> {
        return new STDictionary(type);
    }
    export function exact<T>(value: T): STExactValue<T> {
        return new STExactValue(value);
    }
}
