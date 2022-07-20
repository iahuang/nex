module.exports = {
    root: true,
    parser: "@typescript-eslint/parser",
    plugins: ["@typescript-eslint"],
    extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
    rules: {
        "prefer-const": "off",
        "no-constant-condition": "off",
        "@typescript-eslint/no-non-null-assertion": "off",
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-namespace": "off",
        "no-undef": "off",
        "@typescript-eslint/explicit-function-return-type": [
            "error",
            {
                "allowExpressions": true
            }
        ],
        "@typescript-eslint/no-empty-function": 1
    },

};
