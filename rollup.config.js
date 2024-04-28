import nodeResolve from "@rollup/plugin-node-resolve";
import replace from "@rollup/plugin-replace";
import builtins from "rollup-plugin-node-builtins";
import path from "path";
import inject from "rollup-plugin-inject";
import sourcemaps from "rollup-plugin-sourcemaps";

export default [
	{
		input: "./pdfparser.js",
		external: [
			"fs",
			"util",
			"fs/promises",
			"events",
			"path",
			"url",
			"buffer",
			"stream",
			"@xmldom/xmldom",
		],
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
			nodeResolve({
				preferBuiltins: true,
			}),
			replace({
				"../base": "/base/",
				preventAssignment: true,
				delimiters: ["/", "/"],
			}),
			builtins(),
			inject({
				createScratchCanvas: [
					path.resolve("lib/pdfcanvas.js"),
					"createScratchCanvas",
				],
			}),
			sourcemaps(),
		],
	},
];
