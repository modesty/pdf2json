
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
      	preferBuiltins: true,  // Prefer Node.js built-in modules
      	browser: false         // Set to true only if targeting browsers
    	}),
			terser()
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
      	preferBuiltins: true,  // Prefer Node.js built-in modules
      	browser: false         // Set to true only if targeting browsers
    	}),
			terser()
		]
	}
];
