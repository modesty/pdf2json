import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// const _pdfjsFiles = [];
const baseDir = `${__dirname}/../base/`;

// function scanPdfJsBaseFiles(directory) {
// 	fs.readdirSync(directory).forEach((file) => {
// 		const filePath = path.join(directory, file);
// 		if (fs.statSync(filePath).isDirectory()) {
// 			scanPdfJsBaseFiles(filePath);
// 		} else if (filePath.endsWith(".js")) {
// 			_pdfjsFiles.push(filePath);
// 		}
// 	});
// }

// scanPdfJsBaseFiles(baseDir); // order matters, will revisit this later

const _pdfjsFiles = [
	"shared/util.js",
	"shared/colorspace.js",
	"shared/pattern.js",
	"shared/function.js",
	"shared/annotation.js",

	"core/core.js",
	"core/obj.js",
	"core/charsets.js",
	"core/crypto.js",
	"core/evaluator.js",
	"core/fonts.js",
	"core/font_renderer.js",
	"core/glyphlist.js",
	"core/image.js",
	"core/metrics.js",
	"core/parser.js",
	"core/stream.js",
	"core/worker.js",
	"core/jpx.js",
	"core/jbig2.js",
	"core/bidi.js",
	"core/jpg.js",
	"core/chunked_stream.js",
	"core/pdf_manager.js",
	"core/cmap.js",
	"core/cidmaps.js",

	"display/canvas.js",
	"display/font_loader.js",
	"display/metadata.js",
	"display/api.js",
];

const _baseCode = _pdfjsFiles.reduce(
	(preContent, fileName) =>
		(preContent += fs.readFileSync(path.join(baseDir, fileName), "utf8")),
	""
);

fs.writeFileSync(path.join(__dirname, "../lib/pdfjs-code.js"),
	`
  ${"import nodeUtil from 'util';import { Blob } from 'buffer';import { DOMParser } from './simpleXmlParser.js';import PDFAnno from './pdfanno.js';import Image from './pdfimage.js';import { createScratchCanvas } from './pdfcanvas.js';"}
  ${"export const PDFJS = {};"}
  ${"const globalScope = { console };"}
  ${_baseCode}
  `,
	{
		encoding: "utf8",
		mode: 0o666,
	}
);

const targetDir = path.join(__dirname, "../dist");
if (!fs.existsSync(targetDir)) {
	fs.mkdirSync(targetDir);
}
fs.copyFileSync(path.join(__dirname, "../pdfparser.d.ts"), path.join(targetDir, "pdfparser.d.ts"));
// .d.cts should have "export =" instead of "export default"
const typeDefContent = fs.readFileSync(path.join(__dirname, "../pdfparser.d.ts"), "utf8");
fs.writeFileSync(
	path.join(targetDir, "pdfparser.d.cts"),
	typeDefContent.replace("export default", "export =")
);
