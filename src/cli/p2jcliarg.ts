/* eslint-disable @typescript-eslint/no-explicit-any */
import PDFParser from "../../dist/pdfparser.js";
const { pkInfo, _PARSER_SIG: _PRO_TIMER } = PDFParser;

type Alias = {
	[key: string]: AliasEntry;
};

type AliasEntry = {
	name: string;
	description: string;
};

export type Argv = {
	[key: string]: string | boolean | number | (string | boolean | number)[];
};

export class CLIArgParser {
	args : string[] = [];
	private aliases: Alias = {};

	private usageMsg = "";
	private examplesMsg = "";
	private parsedArgv : Argv | null = null;

	// constructor
	constructor(args: string[]) {
		if (Array.isArray(args)) this.args = args;
	}

	usage(usageMsg:string) {
		this.usageMsg = `${usageMsg}\n\nOptions:\n`;
		return this;
	}

	alias(key:string, name:string, description:string) {
		this.aliases[key] = { name, description };
		return this;
	}

	examples(msg: string) {
		this.examplesMsg = msg;
		return this;
	}

	showHelp() {
		let helpMsg = this.usageMsg;
		for (const [key, value] of Object.entries(this.aliases)) {
			const { name, description } = value;
			helpMsg += `  -${key}, --${name}\t${description}\n`;
		}
		if (this.examplesMsg) {
			helpMsg += this.examplesMsg;
		}
		console.log(helpMsg);
	}

	get argv() : Argv {
		return this.parsedArgv ? this.parsedArgv : this.parseArgv();
	}

	static isNumber(x: any): boolean {
		if (typeof x === "number") return true;
		if (/^0x[0-9a-f]+$/i.test(x)) return true;
		return /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(e[-+]?\d+)?$/.test(x);
	}

	private setArg(key: string, val: any, argv: Argv) {
		const value = CLIArgParser.isNumber(val) ? Number(val) : val;
		this.setKey(argv, key.split("."), value);

		const aliasKey = key in this.aliases ? [this.aliases[key].name] : [];
		if (aliasKey.length < 1) {
			for (const [akey, avalue] of Object.entries(this.aliases)) {
				if (key === avalue.name) {
					aliasKey.push(akey);
					break;
				}
			}
		}
		aliasKey.forEach((x) => this.setKey(argv, x.split("."), value));
	}

	private setKey(obj: object, keys: string[], value: any) {
		let o: any = obj;
		for (let i = 0; i < keys.length - 1; i++) {
			const key = keys[i];
			if (key === "__proto__") return;
			if (o[key] === undefined) o[key] = {};
			if (
				o[key] === Object.prototype ||
				o[key] === Number.prototype ||
				o[key] === String.prototype
			)
				o[key] = {};
			if (o[key] === Array.prototype) o[key] = [];
			o = o[key];
		}

		const key = keys[keys.length - 1];
		if (key === "__proto__") return;
		if (
			o === Object.prototype ||
			o === Number.prototype ||
			o === String.prototype
		)
			o = {};
		if (o === Array.prototype) o = [];
		if (o[key] === undefined) {
			o[key] = value;
		} else if (Array.isArray(o[key])) {
			o[key].push(value);
		} else {
			o[key] = [o[key], value];
		}
	}

	// Resolve a short flag string (after the leading '-') to its alias key.
	// Handles multi-char short flags like "si" by checking the alias table first.
	private resolveShortFlag(letters: string): string | null {
		// Check if the full multi-char string is a known alias key
		if (letters in this.aliases) return letters;
		// Check if it matches a known alias name
		for (const [akey, avalue] of Object.entries(this.aliases)) {
			if (letters === avalue.name) return akey;
		}
		// Fall back to last character (single-char flag)
		if (letters.length > 0) return letters.slice(-1);
		return null;
	}

	private parseArgv() {
		const { args } = this;
		const argv: Argv = {};

		for (let i = 0; i < args.length; i++) {
			const arg = args[i];

			if (/^--.+/.test(arg)) {
				const extractKey = arg.match(/^--(.+)/);
				if (!Array.isArray(extractKey)) {
					console.warn("Unknown CLI options:", arg);
					continue;
				}
				const key = extractKey[1];
				const next = args[i + 1];
				if (next !== undefined && !/^-/.test(next)) {
					this.setArg(key, next, argv);
					i++;
				} else if (/^(true|false)$/.test(next)) {
					this.setArg(key, next === "true", argv);
					i++;
				} else {
					this.setArg(key, true, argv);
				}
			} else if (/^-[^-]+/.test(arg)) {
				const letters = arg.slice(1);
				const key = this.resolveShortFlag(letters);
				if (key && key !== "-") {
					if (args[i + 1] && !/^(-|--)[^-]/.test(args[i + 1])) {
						this.setArg(key, args[i + 1], argv);
						i++;
					} else if (args[i + 1] && /^(true|false)$/.test(args[i + 1])) {
						this.setArg(key, args[i + 1] === "true", argv);
						i++;
					} else {
						this.setArg(key, true, argv);
					}
				}
			} else {
				console.warn("Unknown CLI options:", arg);
			}
		}

		this.parsedArgv = argv;
		return argv;
	}
}

export const yargs = new CLIArgParser(process.argv.slice(2))
	.usage(`\n${_PRO_TIMER}\n\nUsage: ${pkInfo.name} -f <file_or_dir> [options]`)
	.alias("f", "file",
		"(required) Path to a PDF file or a directory of PDF files to parse.")
	.alias("o", "output",
		"Output directory for generated files. Created automatically if it\n\t\t\tdoes not exist. Defaults to the same directory as the input file.")
	.alias("s", "silent",
		"Suppress informational output; only errors are printed.")
	.alias("t", "fieldTypes",
		"Generate a .fields.json file with form field ids and types.")
	.alias("c", "content",
		"Generate a .content.txt file with extracted text content.")
	.alias("m", "merge",
		"Generate a .merged.json file with auto-merged broken text blocks.")
	.alias("r", "stream",
		"Use stream-based parsing (read/transform/write pipeline)\n\t\t\tinstead of loading the entire file into memory first.")
	.alias("si", "singleton",
		"Reuse a single PDFParser instance across all files in a\n\t\t\tdirectory (reduces memory allocation for batch processing).")
	.alias("j", "json",
		"Output a structured JSON summary to stdout with version, file\n\t\t\tpaths, stats, and errors. Implies -s. Note: the PDF engine may\n\t\t\tprint warnings to stdout; pipe through `grep '^{'` to isolate JSON.")
	.alias("q", "quiet",
		"Suppress all non-error output, including the timer and status\n\t\t\tmessages. Stricter than -s.")
	.alias("v", "version",
		"Print the version number and exit.")
	.alias("h", "help",
		"Print this help message and exit.")
	.examples(`
Examples:

  Parse a single PDF to JSON:
    pdf2json -f input.pdf

  Parse with a specific output directory:
    pdf2json -f input.pdf -o ./output

  Parse and generate all output formats (JSON + fields + text + merged):
    pdf2json -f input.pdf -o ./output -t -c -m

  Parse an entire directory of PDFs:
    pdf2json -f ./pdf_folder -o ./output -s

  Parse using stream mode (lower memory for large files):
    pdf2json -f input.pdf -o ./output -r

  Get structured JSON summary for scripting:
    pdf2json -f input.pdf -o ./output --json

  Batch directory parse, silent, all outputs:
    pdf2json -f ./pdf_folder -o ./output -s -t -c -m -r

Exit Codes:
  0  All files parsed successfully
  1  One or more files failed to parse
  2  Invalid arguments or usage error
  3  I/O error (file not found, permission denied)
`);
