import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";

export default [
	{
		ignores: [
			"dist/**",
			"bin/**",
			"test/**",
			"node_modules/**",
			"base/**",
			"lib/pdfjs-code.js",
			"**/*.json",
			"eslint.config.js",
			"rollup.config.js"
		]
	},
	{
		files: ["**/*.js", "**/*.ts"],
		languageOptions: {
			parser: tsparser,
			parserOptions: {
				ecmaVersion: 2022,
				sourceType: "module"
			},
			globals: {
				console: "readonly",
				process: "readonly",
				Buffer: "readonly",
				__dirname: "readonly",
				__filename: "readonly",
				module: "readonly",
				require: "readonly",
				exports: "writable",
				global: "readonly",
				setImmediate: "readonly",
				clearImmediate: "readonly",
				setTimeout: "readonly",
				clearTimeout: "readonly",
				setInterval: "readonly",
				clearInterval: "readonly"
			}
		},
		plugins: {
			"@typescript-eslint": tseslint
		},
		rules: {
			...js.configs.recommended.rules,
			...tseslint.configs.recommended.rules,
			"@typescript-eslint/no-unused-expressions": [
				"error",
				{
					allowShortCircuit: true,
					allowTernary: true,
					allowTaggedTemplates: true
				}
			],
			"no-mixed-spaces-and-tabs": ["error", "smart-tabs"],
			"@typescript-eslint/naming-convention": [
				"error",
				{
					selector: "variable",
					format: ["camelCase", "PascalCase", "UPPER_CASE"],
					filter: {
						regex: "^_",
						match: false
					}
				},
				{
					selector: "function",
					format: ["camelCase", "PascalCase"]
				},
				{
					selector: "parameter",
					format: ["camelCase", "PascalCase"],
					filter: {
						regex: "^_",
						match: false
					}
				},
				{
					selector: "property",
					format: ["camelCase", "PascalCase", "UPPER_CASE"],
					filter: {
						regex: "(x-ide-git-auth|^_|^sys_*|app_id)",
						match: false
					}
				},
				{
					selector: "method",
					format: ["camelCase", "PascalCase"],
					filter: {
						regex: "^_",
						match: false
					}
				},
				{
					selector: "accessor",
					format: ["camelCase", "PascalCase"]
				},
				{
					selector: "enumMember",
					format: ["camelCase", "PascalCase", "UPPER_CASE"]
				},
				{
					selector: "typeLike",
					format: ["PascalCase"]
				}
			],
			"@typescript-eslint/no-unused-vars": [
				"error",
				{
					vars: "all",
					args: "after-used",
					argsIgnorePattern: "(^_?|fs|uri|options|opts|source|signal|destination|Uri$|args)",
					ignoreRestSiblings: true,
					destructuredArrayIgnorePattern: "^_?"
				}
			],
			"@typescript-eslint/no-extra-semi": "off",
			"@typescript-eslint/no-var-requires": "off",
			"arrow-body-style": ["error", "as-needed"],
			"dot-notation": ["error"],
			"eqeqeq": ["error", "always"],
			"no-case-declarations": "error",
			"no-duplicate-imports": ["error"],
			"no-else-return": [
				"error",
				{
					allowElseIf: true
				}
			],
			"no-eval": [
				"error",
				{
					allowIndirect: false
				}
			],
			"no-iterator": ["error"],
			"no-multi-assign": ["error"],
			"no-new-func": ["error"],
			"no-new-wrappers": ["error"],
			"no-object-constructor": ["error"],
			"no-param-reassign": "off",
			"no-restricted-imports": ["error", "lodash", "moment"],
			"no-throw-literal": "warn",
			"no-useless-call": ["error"],
			"object-curly-spacing": ["error", "always"],
			"object-shorthand": [
				"error",
				"always",
				{
					avoidExplicitReturnArrows: true
				}
			],
			"prefer-arrow-callback": [
				"error",
				{
					allowNamedFunctions: true
				}
			],
			"prefer-const": ["error"],
			"prefer-destructuring": [
				"error",
				{
					object: true,
					array: false
				}
			],
			"prefer-rest-params": ["error"],
			"prefer-spread": ["error"],
			"prefer-template": ["error"]
		}
	}
];
