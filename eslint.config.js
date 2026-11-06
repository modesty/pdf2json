import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

// Node stream subclass hooks are framework contracts, not privacy markers.
const STREAM_HOOKS = "^_(transform|flush|destroy|final|read|write|writev|construct)$";

const noUnusedVarsOptions = {
	args: "after-used",
	argsIgnorePattern: "^_",
	destructuredArrayIgnorePattern: "^_",
	ignoreRestSiblings: true,
};

const sharedRules = {
	"arrow-body-style": ["error", "as-needed"],
	"dot-notation": "error",
	eqeqeq: ["error", "always"],
	"no-duplicate-imports": "error",
	"no-else-return": ["error", { allowElseIf: true }],
	"no-eval": ["error", { allowIndirect: false }],
	"no-iterator": "error",
	"no-multi-assign": "error",
	"no-new-func": "error",
	"no-new-wrappers": "error",
	"no-object-constructor": "error",
	"no-restricted-globals": [
		"error",
		{ name: "isNaN", message: "Use Number.isNaN() — the global coerces its argument." },
		{ name: "isFinite", message: "Use Number.isFinite() — the global coerces its argument." },
	],
	"no-restricted-syntax": [
		"error",
		{
			selector: "PrivateIdentifier[name=/^_/]",
			message: "`#` already marks the member private; drop the leading underscore.",
		},
	],
	"no-throw-literal": "error",
	"no-unused-vars": ["error", noUnusedVarsOptions],
	"no-useless-call": "error",
	"no-var": "error",
	"object-shorthand": ["error", "always", { avoidExplicitReturnArrows: true }],
	"prefer-arrow-callback": ["error", { allowNamedFunctions: true }],
	"prefer-const": "error",
	"prefer-destructuring": ["error", { object: true, array: false }],
	"prefer-object-has-own": "error",
	"prefer-object-spread": "error",
	"prefer-rest-params": "error",
	"prefer-spread": "error",
	"prefer-template": "error",
};

export default defineConfig([
	globalIgnores([
		".mosey/**",
		"base/**",
		"bin/cli/**",
		"coverage/**",
		"dist/**",
		"lib/pdfjs-code.js",
		"test/data/**",
		"test/pdf/**",
		"test/target/**",
	]),
	{
		files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
		extends: [js.configs.recommended],
		languageOptions: { globals: globals.nodeBuiltin },
		rules: sharedRules,
	},
	{
		files: ["**/*.cjs"],
		languageOptions: { sourceType: "commonjs", globals: globals.node },
	},
	{
		files: ["**/*.{ts,mts,cts}"],
		extends: [tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
		languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
		rules: {
			"no-unused-vars": "off",
			"@typescript-eslint/no-unused-vars": ["error", noUnusedVarsOptions],
			"@typescript-eslint/no-unused-expressions": [
				"error",
				{ allowShortCircuit: true, allowTernary: true, allowTaggedTemplates: true },
			],
			"@typescript-eslint/explicit-member-accessibility": ["error", { accessibility: "no-public" }],
			"@typescript-eslint/prefer-promise-reject-errors": ["error", { allowThrowingUnknown: true }],
			"@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
			"no-restricted-syntax": [
				"error",
				...sharedRules["no-restricted-syntax"].slice(1),
				{
					selector:
						":matches(PropertyDefinition, MethodDefinition, TSAbstractPropertyDefinition)[accessibility='private']",
					message: "Use an ECMAScript `#private` member instead of the TypeScript `private` modifier.",
				},
			],
			"@typescript-eslint/naming-convention": [
				"error",
				{ selector: "variable", format: ["camelCase", "PascalCase", "UPPER_CASE"], leadingUnderscore: "forbid" },
				{ selector: "function", format: ["camelCase", "PascalCase"] },
				{ selector: "parameter", format: ["camelCase", "PascalCase"], leadingUnderscore: "allow" },
				{ selector: "classMethod", filter: { regex: STREAM_HOOKS, match: true }, format: null },
				{ selector: "typeMethod", filter: { regex: `${STREAM_HOOKS}|^pdfParser_`, match: true }, format: null },
				{
					selector: ["classProperty", "classMethod", "accessor", "typeProperty", "typeMethod"],
					format: ["camelCase", "PascalCase", "UPPER_CASE"],
					leadingUnderscore: "forbid",
				},
				{ selector: "enumMember", format: ["camelCase", "PascalCase", "UPPER_CASE"] },
				{ selector: "typeLike", format: ["PascalCase"] },
			],
		},
	},
	{
		// Hand-maintained public declarations: keep their published shapes until B1.4 generates them from source.
		files: ["src/types/**"],
		rules: {
			"@typescript-eslint/consistent-indexed-object-style": "off",
			"@typescript-eslint/consistent-type-definitions": "off",
		},
	},
	{
		// Hand-rolled argv parser, replaced by util.parseArgs in B6 — delete this block with the file.
		files: ["src/cli/p2jcliarg.ts"],
		extends: [tseslint.configs.disableTypeChecked],
	},
]);
