
import json from "@rollup/plugin-json";
import eslint from "@rollup/plugin-eslint";
import nodeResolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";

const external = [
	"process",
	"console",
	"fs",
	"util",
	"fs/promises",
	"events",
	"path",
	"url",
	"buffer",
	"stream",
];

export default [
	// Build 1: Main library bundle (pdfparser.js -> dist/)
	// Must complete before Build 2, as the CLI imports from dist/pdfparser.js
	{
		input: "./pdfparser.js",
		external,
		output: [
			{
				file: "dist/pdfparser.cjs",
				format: "cjs",
				sourcemap: true,
			},
			{
				file: "dist/pdfparser.js",
				format: "es",
				sourcemap: true,
			},
		],
		treeshake: false, // Required: PDF.js base has global side effects that tree-shaking would break
		plugins: [
			json(),
			eslint({
				throwOnError: true,
			}),
			nodeResolve({
				preferBuiltins: true,
				browser: false,
			}),
			terser(),
		],
	},
	// Build 2: CLI bundle (src/cli/ -> bin/cli/)
	// Depends on Build 1: imports dist/pdfparser.js as external at runtime
	{
		input: "./src/cli/p2jcli.ts",
		external: [...external, "../../dist/pdfparser.js"],
		output: [
			{
				file: "bin/cli/pdfparser_cli.js",
				format: "es",
				sourcemap: true,
			},
		],
		treeshake: true,
		plugins: [
			typescript({ tsconfig: "./tsconfig.json" }),
			json(),
			eslint({
				throwOnError: true,
			}),
			nodeResolve({
				preferBuiltins: true,
				browser: false,
			}),
			terser(),
		],
	},
];
