import path from "path";
import nodeResolve from "@rollup/plugin-node-resolve";
import builtins from "rollup-plugin-node-builtins";
import inject from "rollup-plugin-inject";
import terser from "@rollup/plugin-terser";
import sourcemaps from "rollup-plugin-sourcemaps";

const external = [
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
			nodeResolve({
				preferBuiltins: true,
			}),
			builtins(),
			inject({
				createScratchCanvas: [
					path.resolve("lib/pdfcanvas.js"),
					"createScratchCanvas",
				],
				PDFAnno: [path.resolve("lib/pdfanno.js"), "PDFAnno"],
				Image: [path.resolve("lib/pdfimage.js"), "Image"],
			}),
			terser(),
			sourcemaps(),
		],
	},
];
