import PDFParser from "../dist/pdfparser.js";
const { pkInfo, _PARSER_SIG: _PRO_TIMER } = PDFParser;

class CLIArgParser {
	args = [];
	#aliases = {};

	#usage = "";
	#argv = null;

	// constructor
	constructor(args) {
		if (Array.isArray(args)) this.args = args;
	}

	usage(usageMsg) {
		this.#usage = usageMsg + "\n\nOptions:\n";
		return this;
	}

	alias(key, name, description) {
		this.#aliases[key] = { name, description };
		return this;
	}

	showHelp() {
		let helpMsg = this.#usage;
		for (const [key, value] of Object.entries(this.#aliases)) {
			helpMsg += `-${key},--${value.name}\t ${value.description}\n`;
		}
		console.log(helpMsg);
	}

	get argv() {
		return this.#argv ? this.#argv : this.#parseArgv();
	}

	static isNumber(x) {
		if (typeof x === "number") return true;
		if (/^0x[0-9a-f]+$/i.test(x)) return true;
		return /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(e[-+]?\d+)?$/.test(x);
	}

	#setArg(key, val, argv) {
		const value = CLIArgParser.isNumber(val) ? Number(val) : val;
		this.#setKey(argv, key.split("."), value);

		const aliasKey = key in this.#aliases ? [this.#aliases[key].name] : [];
		if (aliasKey.length < 1) {
			for (const [akey, avalue] of Object.entries(this.#aliases)) {
				if (key === avalue.name) {
					aliasKey.push(akey);
					break;
				}
			}
		}
		aliasKey.forEach((x) => this.#setKey(argv, x.split("."), value));
	}

	#setKey(obj, keys, value) {
		let o = obj;
		for (let i = 0; i < keys.length - 1; i++) {
			let key = keys[i];
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

		let key = keys[keys.length - 1];
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

	#parseArgv() {
		let aliases = this.#aliases,
			args = this.args;
		let argv = {};

		for (let i = 0; i < args.length; i++) {
			let arg = args[i];

			if (/^--.+/.test(arg)) {
				let key = arg.match(/^--(.+)/)[1];
				let next = args[i + 1];
				if (next !== undefined && !/^-/.test(next)) {
					this.#setArg(key, next, argv);
					i++;
				} else if (/^(true|false)$/.test(next)) {
					this.#setArg(key, next === "true", argv);
					i++;
				} else {
					this.#setArg(key, true, argv);
				}
			} else if (/^-[^-]+/.test(arg)) {
				let key = arg.slice(-1)[0];
				if (key !== "-") {
					if (args[i + 1] && !/^(-|--)[^-]/.test(args[i + 1])) {
						this.#setArg(key, args[i + 1], argv);
						i++;
					} else if (args[i + 1] && /^(true|false)$/.test(args[i + 1])) {
						this.#setArg(key, args[i + 1] === "true", argv);
						i++;
					} else {
						this.#setArg(key, true, argv);
					}
				}
			} else {
				console.warn("Unknow CLI options:", arg);
			}
		}

		this.#argv = argv;
		return argv;
	}
}

export const yargs = new CLIArgParser(process.argv.slice(2))
	.usage(`\n${_PRO_TIMER}\n\nUsage: ${pkInfo.name} -f|--file [-o|output_dir]`)
	.alias("v", "version", "Display version.")
	.alias("h", "help", "Display brief help information.")
	.alias(
		"f",
		"file",
		"(required) Full path of input PDF file or a directory to scan for all PDF files.\n\t\t When specifying a PDF file name, it must end with .PDF, otherwise it would be treated as a input directory."
	)
	.alias(
		"o",
		"output",
		"(optional) Full path of output directory, must already exist.\n\t\t Current JSON file in the output folder will be replaced when file name is same."
	)
	.alias(
		"s",
		"silent",
		"(optional) when specified, will only log errors, otherwise verbose."
	)
	.alias(
		"t",
		"fieldTypes",
		"(optional) when specified, will generate .fields.json that includes fields ids and types."
	)
	.alias(
		"c",
		"content",
		"(optional) when specified, will generate .content.txt that includes text content from PDF."
	)
	.alias(
		"m",
		"merge",
		"(optional) when specified, will generate .merged.json that includes auto-merged broken text blocks from PDF."
	)
	.alias(
		"r",
		"stream",
		"(optional) when specified, will process and parse with buffer/object transform stream rather than file system."
	);
