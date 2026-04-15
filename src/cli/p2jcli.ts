import fs from "node:fs";
import path from "node:path";

import { yargs } from "./p2jcliarg.js";
import PDFParser from "../../dist/pdfparser.js";

// Type definitions for CLI operations
type PDFParserError = { parserError: Error };
type PDFParserData = Record<string, unknown>;
type ProcessingResult = PromiseSettledResult<unknown>[];

// Exit codes
const EXIT_SUCCESS = 0;
const EXIT_PARSE_ERROR = 1;
const EXIT_ARG_ERROR = 2;
const EXIT_IO_ERROR = 3;

const { ParserStream, StringifyStream, pkInfo, _PARSER_SIG: _PRO_TIMER } = PDFParser;

const { argv } = yargs;
const ONLY_SHOW_VERSION = "v" in argv;
const ONLY_SHOW_HELP = "h" in argv;
const VERBOSITY_LEVEL = ("s" in argv || "q" in argv || "j" in argv) ? 0 : 5;
const HAS_INPUT_DIR_OR_FILE = "f" in argv;

const PROCESS_RAW_TEXT_CONTENT = "c" in argv;
const PROCESS_FIELDS_CONTENT = "t" in argv;
const PROCESS_MERGE_BROKEN_TEXT_BLOCKS = "m" in argv;
const PROCESS_WITH_STREAM = "r" in argv;
const SINGLETON_PDF_PARSER = "si" in argv;
const JSON_OUTPUT = "j" in argv;
const QUIET_MODE = "q" in argv;

const INPUT_DIR_OR_FILE = argv.f;

// Conditionally log based on quiet/json mode
const SUPPRESS_LOG = QUIET_MODE || JSON_OUTPUT;
function logInfo(...args: unknown[]) {
	if (!SUPPRESS_LOG) console.log(...args);
}
function logWarn(...args: unknown[]) {
	if (!SUPPRESS_LOG) console.warn(...args);
}

class PDFProcessor {
	private inputDir = '';
	private inputFile = '';
	private inputPath = '';

	private outputDir = '';
	private outputFile = '';
	private outputPath = '';

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private pdfParser: any = null;
	private curCLI: PDFCLI;

	constructor(inputDir: string, inputFile: string, curCLI: PDFCLI, sharedParser?: unknown) {
		this.inputDir = path.normalize(inputDir);
		this.inputFile = inputFile;
		this.inputPath = path.join(this.inputDir, this.inputFile);
		this.outputDir = path.normalize((argv.o as string) || inputDir);
		this.pdfParser = sharedParser || null;
		this.curCLI = curCLI;
	}

	private generateMergedTextBlocksStream() {
		return new Promise((resolve, reject) => {
			if (!this.pdfParser) {
				reject(new Error("PDFParser instance is not available."));
				return;
			}
			const outputStream = ParserStream.createOutputStream(
				this.outputPath.replace(".json", ".merged.json"),
				resolve,
				reject
			);
			this.pdfParser
				.getMergedTextBlocksStream()
				.pipe(new StringifyStream())
				.pipe(outputStream);
		});
	}

	private generateRawTextContentStream() {
		return new Promise((resolve, reject) => {
			const outputStream = ParserStream.createOutputStream(
				this.outputPath.replace(".json", ".content.txt"),
				resolve,
				reject
			);
			this.pdfParser.getRawTextContentStream().pipe(outputStream);
		});
	}

	private generateFieldsTypesStream() {
		return new Promise((resolve, reject) => {
			const outputStream = ParserStream.createOutputStream(
				this.outputPath.replace(".json", ".fields.json"),
				resolve,
				reject
			);
			this.pdfParser
				.getAllFieldsTypesStream()
				.pipe(new StringifyStream())
				.pipe(outputStream);
		});
	}

	private processAdditionalStreams() {
		const outputTasks: Promise<unknown>[] = [];
		if (PROCESS_FIELDS_CONTENT) {
			outputTasks.push(this.generateFieldsTypesStream());
		}
		if (PROCESS_RAW_TEXT_CONTENT) {
			outputTasks.push(this.generateRawTextContentStream());
		}
		if (PROCESS_MERGE_BROKEN_TEXT_BLOCKS) {
			outputTasks.push(this.generateMergedTextBlocksStream());
		}
		return Promise.allSettled(outputTasks);
	}

	private initParser() {
		if (!this.pdfParser) {
			this.pdfParser = new PDFParser(null, PROCESS_RAW_TEXT_CONTENT);
		}
	}

	private parseOnePDFStream(): Promise<ProcessingResult> {
		return new Promise((resolve, reject) => {
			this.initParser();

			this.pdfParser.on("pdfParser_dataError", (evtData: PDFParserError) => {
				this.curCLI.addResultCount(true);
				reject(evtData.parserError);
			});

			const outputStream = fs.createWriteStream(this.outputPath, { encoding: 'utf8' });
			outputStream.on("finish", () => {
				this.curCLI.addResultCount(false);
				this.processAdditionalStreams()
					.then((retVal) => resolve(retVal))
					.catch((err) => reject(err));
			});
			outputStream.on("error", (err) => {
				this.curCLI.addResultCount(true);
				reject(err);
			});

			logInfo(`Transcoding Stream ${this.inputFile} to - ${this.outputPath}`);
			const inputStream = fs.createReadStream(this.inputPath);
			inputStream
				.pipe(this.pdfParser.createParserStream())
				.pipe(new StringifyStream())
				.pipe(outputStream);
		});
	}

	private parseOnePDF(): Promise<ProcessingResult> {
		return new Promise((resolve, reject) => {
			this.initParser();

			this.pdfParser.on("pdfParser_dataError", (evtData: PDFParserError) => {
				this.curCLI.addResultCount(true);
				reject(evtData.parserError);
			});

			this.pdfParser.on("pdfParser_dataReady", async (evtData: PDFParserData) => {
				try {
					await fs.promises.writeFile(this.outputPath, JSON.stringify(evtData), 'utf8');
					this.curCLI.addResultCount(false);
					const result = await this.processAdditionalStreams();
					resolve(result);
				} catch (err) {
					this.curCLI.addResultCount(true);
					reject(err);
				}
			});

			logInfo(`Transcoding File ${this.inputFile} to - ${this.outputPath}`);
			this.pdfParser.loadPDF(this.inputPath, VERBOSITY_LEVEL);
		});
	}

	async validateParams() {
		let retVal = '';

		if (!fs.existsSync(this.inputDir))
			retVal = `Input error: input directory doesn't exist - ${this.inputDir}.`;
		else if (!fs.existsSync(this.inputPath))
			retVal = `Input error: input file doesn't exist - ${this.inputPath}.`;
		else if (!fs.existsSync(this.outputDir)) {
			try {
				await fs.promises.mkdir(this.outputDir, { recursive: true });
			} finally {
				if (!fs.existsSync(this.outputDir))
					retVal = `Input error: output directory doesn't exist and fails to create - ${this.outputDir}.`;
			}
		}

		if (retVal !== '') {
			this.curCLI.addResultCount(true);
			return retVal;
		}

		const inExtName = path.extname(this.inputFile).toLowerCase();
		if (inExtName !== ".pdf") {
			retVal = `Input error: input file name doesn't have pdf extension - ${this.inputFile}.`;
		} else {
			this.outputFile = `${path.basename(this.inputPath, inExtName)}.json`;
			this.outputPath = path.normalize(`${this.outputDir}/${this.outputFile}`);
			if (fs.existsSync(this.outputPath)) {
				logWarn(`Output file will be replaced - ${this.outputPath}`);
			}
		}
		return retVal;
	}

	destroy() {
		this.inputDir = '';
		this.inputFile = '';
		this.inputPath = '';
		this.outputDir = '';
		this.outputPath = '';

		if (this.pdfParser && !SINGLETON_PDF_PARSER) {
			this.pdfParser.destroy();
		}
		this.pdfParser = null;
	}

	async processFile(): Promise<ProcessingResult> {
		const validateMsg = await this.validateParams();
		if (validateMsg !== '') {
			throw new Error(validateMsg);
		}
		return PROCESS_WITH_STREAM ? this.parseOnePDFStream() : this.parseOnePDF();
	}

	getOutputFile = () => path.join(this.outputDir, this.outputFile);
}

// Structured result for --json output
interface JsonOutput {
	version: string;
	input: string;
	outputs: { type: string; path: string }[];
	stats: { input: number; success: number; failed: number };
	errors: string[];
	elapsedMs: number;
}

export default class PDFCLI {
	inputCount = 0;
	successCount = 0;
	failedCount = 0;
	statusMsgs: string[] = [];
	private outputPaths: { type: string; path: string }[] = [];
	private errorMessages: string[] = [];
	private startTime = 0;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private sharedParser: any = null;

	constructor() {
		this.inputCount = 0;
		this.successCount = 0;
		this.failedCount = 0;
		this.statusMsgs = [];
		this.outputPaths = [];
		this.errorMessages = [];
	}

	initialize(): { success: boolean; error?: string } {
		try {
			if (ONLY_SHOW_VERSION) {
				console.log(pkInfo.version);
				return { success: false };
			}

			if (ONLY_SHOW_HELP) {
				yargs.showHelp();
				return { success: false };
			}

			if (!HAS_INPUT_DIR_OR_FILE) {
				return {
					success: false,
					error: "-f|--file parameter is required to specify input directory or file."
				};
			}

			if (typeof INPUT_DIR_OR_FILE !== 'string' || (INPUT_DIR_OR_FILE as string).trim() === '') {
				return {
					success: false,
					error: "-f|--file parameter must have a valid path value."
				};
			}

			if (Array.isArray(INPUT_DIR_OR_FILE)) {
				return {
					success: false,
					error: `-f|--file parameter can only be specified once. Received multiple values: ${INPUT_DIR_OR_FILE.join(", ")}`
				};
			}

			if (!fs.existsSync(INPUT_DIR_OR_FILE as string)) {
				return {
					success: false,
					error: `Input path does not exist: ${INPUT_DIR_OR_FILE}`
				};
			}

			return { success: true };
		} catch (e: unknown) {
			const error = e instanceof Error ? e : new Error(String(e));
			return {
				success: false,
				error: `Exception during initialization: ${error.message}`
			};
		}
	}

	async start() {
		const initResult = this.initialize();
		if (!initResult.success) {
			if (initResult.error) {
				yargs.showHelp();
				console.error(`\nError: ${initResult.error}`);
				process.exit(EXIT_ARG_ERROR);
			}
			process.exit(EXIT_SUCCESS);
		}

		this.startTime = Date.now();
		logInfo(_PRO_TIMER);
		if (!SUPPRESS_LOG) console.time(_PRO_TIMER);

		if (SINGLETON_PDF_PARSER) {
			this.sharedParser = new PDFParser(null, PROCESS_RAW_TEXT_CONTENT);
		}

		let hasError = false;
		let errorMessage: string | undefined;
		let exitCode = EXIT_SUCCESS;

		try {
			const inputStatus = fs.statSync(INPUT_DIR_OR_FILE as string);
			if (inputStatus.isFile()) {
				this.inputCount = 1;
				await this.processOneFile(
					path.dirname(INPUT_DIR_OR_FILE as string),
					path.basename(INPUT_DIR_OR_FILE as string)
				);
			} else if (inputStatus.isDirectory()) {
				await this.processOneDirectory(path.normalize(INPUT_DIR_OR_FILE as string));
			}
		} catch (e) {
			hasError = true;
			const error = e instanceof Error ? e : new Error(String(e));
			errorMessage = `Exception during processing: ${error.message}`;
			this.addStatusMsg(true, errorMessage);
			this.errorMessages.push(errorMessage);
			this.failedCount++;

			if (error.message.includes("ENOENT") || error.message.includes("EACCES") || error.message.includes("EPERM")) {
				exitCode = EXIT_IO_ERROR;
			} else {
				exitCode = EXIT_PARSE_ERROR;
			}
		} finally {
			if (exitCode === EXIT_SUCCESS && this.failedCount > 0) {
				exitCode = EXIT_PARSE_ERROR;
			}
			this.complete(hasError, errorMessage, exitCode);
		}
	}

	complete(hasError: boolean = false, errorMessage?: string, exitCode: number = EXIT_SUCCESS) {
		if (JSON_OUTPUT) {
			const jsonOutput: JsonOutput = {
				version: pkInfo.version,
				input: INPUT_DIR_OR_FILE as string,
				outputs: this.outputPaths,
				stats: {
					input: this.inputCount,
					success: this.successCount,
					failed: this.failedCount,
				},
				errors: this.errorMessages,
				elapsedMs: Date.now() - this.startTime,
			};
			console.log(JSON.stringify(jsonOutput));
		} else {
			const stdioFunc = (hasError || this.failedCount > 0) ? console.error : logInfo;

			if (errorMessage) {
				stdioFunc(`\nError: ${errorMessage}`);
			}
			if (this.statusMsgs.length > 0) {
				stdioFunc(this.statusMsgs);
			}
			stdioFunc(
				`\n${this.inputCount} input files\t${this.successCount} success\t${this.failedCount} fail`
			);
		}

		if (this.sharedParser) {
			this.sharedParser.destroy();
			this.sharedParser = null;
		}

		process.nextTick(() => {
			if (!SUPPRESS_LOG) console.timeEnd(_PRO_TIMER);
			process.exit(exitCode);
		});
	}

	async processOneFile(inputDir: string, inputFile: string): Promise<ProcessingResult> {
		const p2j = new PDFProcessor(inputDir, inputFile, this, this.sharedParser);
		try {
			const result = await p2j.processFile();
			const outputFile = p2j.getOutputFile();
			this.addStatusMsg(false, `${path.join(inputDir, inputFile)} => ${outputFile}`);
			this.outputPaths.push({ type: "json", path: outputFile });

			result.forEach((ret: PromiseSettledResult<unknown>) => {
				if (ret.status === 'fulfilled' && ret.value) {
					const filePath = String(ret.value);
					this.addStatusMsg(false, `+ ${filePath}`);
					const ext = path.extname(filePath);
					let type = "unknown";
					if (ext === ".json" && filePath.includes(".fields.")) type = "fields";
					else if (ext === ".json" && filePath.includes(".merged.")) type = "merged";
					else if (ext === ".txt") type = "content";
					this.outputPaths.push({ type, path: filePath });
				}
			});
			return result;
		} catch (error) {
			const errMsg = error instanceof Error ? error.message : String(error);
			this.addStatusMsg(true, `${path.join(inputDir, inputFile)} => ${errMsg}`);
			this.errorMessages.push(errMsg);
			throw error;
		} finally {
			p2j.destroy();
		}
	}

	processFiles(inputDir: string, files: string[]): Promise<PromiseSettledResult<unknown>[]> {
		const allPromises: Promise<unknown>[] = [];
		files.forEach((file: string) =>
			allPromises.push(this.processOneFile(inputDir, file))
		);
		return Promise.allSettled(allPromises);
	}

	async processOneDirectory(inputDir: string) {
		const files = await fs.promises.readdir(inputDir);
		const pdfFiles = files.filter((file) => {
			if (file.slice(-4).toLowerCase() !== ".pdf") return false;
			// Skip hidden/dotfiles only
			if (file.startsWith(".")) {
				logWarn(`Skipping hidden file: ${file}`);
				return false;
			}
			return true;
		});

		this.inputCount = pdfFiles.length;
		if (this.inputCount > 0) {
			return this.processFiles(inputDir, pdfFiles);
		}
		this.addStatusMsg(true, `[${inputDir}] - No PDF files found`);
		return 'no pdf files found';
	}

	addStatusMsg(error: boolean, oneMsg: string) {
		this.statusMsgs.push(
			error ? `✗ Error : ${oneMsg}` : `✓ Success : ${oneMsg}`
		);
	}

	addResultCount(isError: boolean) {
		isError ? this.failedCount++ : this.successCount++;
	}
}
