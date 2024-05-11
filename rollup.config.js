
import json from "@rollup/plugin-json";
import eslint from "@rollup/plugin-eslint";
import nodeResolve from "@rollup/plugin-node-resolve";
import builtins from "rollup-plugin-node-builtins";
import terser from "@rollup/plugin-terser";
import sourcemaps from "rollup-plugin-sourcemaps";
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
	"@xmldom/xmldom",
];

export default [
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
		treeshake: false,
		plugins: [
			json(),
			eslint({
				throwOnError: true
			}),
			nodeResolve({
				preferBuiltins: true,
			}),
			builtins(),
			terser(),
			sourcemaps(),
		]
	},
	{
		input: "./src/cli/p2jcli.ts",
		external: [...external, "../../dist/pdfparser.js"],
		output: [
			// {
			// 	file: "dist/pdfparser_cli.cjs",
			// 	format: "cjs",
			// 	sourcemap: true,
			// },
			{
				file: "bin/cli/pdfparser_cli.js",
				format: "es",
				sourcemap: true,
			},
		],
		treeshake: false,
		plugins: [
			typescript({ tsconfig: './tsconfig.json' }),
			json(),
			eslint({
				throwOnError: true
			}),
			nodeResolve({
				preferBuiltins: true,
			}),
			builtins(),
			terser(),
			sourcemaps(),
		]
	}
];
