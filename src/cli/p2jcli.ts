import fs from "node:fs";
import path from "node:path";

import { yargs } from "./p2jcliarg.js";
import PDFParser from "../../dist/pdfparser.js";

// Type definitions for CLI operations
type PDFParserError = { parserError: Error };
type PDFParserData = Record<string, unknown>;
type PromiseResolve<T> = (value: T) => void;
type PromiseReject = (reason: Error) => void;
type ProcessingResult = PromiseSettledResult<unknown>[];

const { ParserStream, StringifyStream, pkInfo, _PARSER_SIG: _PRO_TIMER } = PDFParser;

const { argv } = yargs;
const ONLY_SHOW_VERSION = "v" in argv;
const ONLY_SHOW_HELP = "h" in argv;
const VERBOSITY_LEVEL = "s" in argv ? 0 : 5;
const HAS_INPUT_DIR_OR_FILE = "f" in argv;

const PROCESS_RAW_TEXT_CONTENT = "c" in argv;
const PROCESS_FIELDS_CONTENT = "t" in argv;
const PROCESS_MERGE_BROKEN_TEXT_BLOCKS = "m" in argv;
const PROCESS_WITH_STREAM = "r" in argv;
const SINGLETON_PDF_PARSER= "si" in argv;

const INPUT_DIR_OR_FILE = argv.f;

class PDFProcessor {
	private inputDir = '';
	private inputFile = '';
	private inputPath = '';

	private outputDir = '';
	private outputFile = '';
	private outputPath = '';

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private pdfParser: any = null;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private curCLI : any = null;

	// constructor
	constructor(inputDir: string, inputFile: string, curCLI: PDFCLI) {
		// public, this instance copies
		this.inputDir = path.normalize(inputDir);
		this.inputFile = inputFile;
		this.inputPath = path.join(this.inputDir, this.inputFile);

		this.outputDir = path.normalize(argv.o || inputDir);

		this.pdfParser = null;
		this.curCLI = curCLI;
	}

	//private methods
	 private generateMergedTextBlocksStream() {
		return new Promise((resolve, reject) => {
			if (!this.pdfParser) {
				reject("PDFParser instance is not available.");
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
		const outputTasks : Promise<unknown>[] = [];
		if (PROCESS_FIELDS_CONTENT) {
			//needs to generate fields.json file
			outputTasks.push(this.generateFieldsTypesStream());
		}
		if (PROCESS_RAW_TEXT_CONTENT) {
			//needs to generate content.txt file
			outputTasks.push(this.generateRawTextContentStream());
		}
		if (PROCESS_MERGE_BROKEN_TEXT_BLOCKS) {
			//needs to generate json file with merged broken text blocks
			outputTasks.push(this.generateMergedTextBlocksStream());
		}
		return Promise.allSettled(outputTasks);
	}

	private onPrimarySuccess(resolve: PromiseResolve<ProcessingResult>, reject: PromiseReject): void {
		this.curCLI.addResultCount(false);
		this.processAdditionalStreams()
			.then((retVal: PromiseSettledResult<unknown>[]) => resolve(retVal))
			.catch((err: Error) => reject(err));
	}

	private onPrimaryError(err: Error, reject: PromiseReject): void {
		this.curCLI.addResultCount(err);
		reject(err);
	}

	private parseOnePDFStream() {
		return new Promise((resolve, reject) => {
			if((SINGLETON_PDF_PARSER && !this.pdfParser) || !SINGLETON_PDF_PARSER){
				//initialize the parser if the singleton parameter was not provided, or if the singleton parameter was provided and the parser is not initialized
				this.pdfParser = new PDFParser(null, PROCESS_RAW_TEXT_CONTENT);
				this.pdfParser.on("pdfParser_dataError", (evtData: PDFParserError) =>
					this.onPrimaryError(evtData.parserError, reject)
				);
			}

			const outputStream = fs.createWriteStream(this.outputPath, { encoding: 'utf8' });
			outputStream.on("finish", () => this.onPrimarySuccess(resolve, reject));
			outputStream.on("error", (err) => this.onPrimaryError(err, reject));

			console.info(
				`Transcoding Stream ${this.inputFile} to - ${this.outputPath}`
			);
			const inputStream = fs.createReadStream(this.inputPath);
			inputStream
				.pipe(this.pdfParser.createParserStream())
				.pipe(new StringifyStream())
				.pipe(outputStream);
		});
	}

	private parseOnePDF() {
		return new Promise((resolve, reject) => {
			if((SINGLETON_PDF_PARSER && !this.pdfParser) || !SINGLETON_PDF_PARSER){
				//initialize the parser if the singleton parameter was not provided, or if the singleton parameter was provided and the parser is not initialized
				this.pdfParser = new PDFParser(null, PROCESS_RAW_TEXT_CONTENT);
				this.pdfParser.on("pdfParser_dataError", (evtData: PDFParserError) =>
					this.onPrimaryError(evtData.parserError, reject)
				);
			}

			this.pdfParser.on("pdfParser_dataReady", (evtData: PDFParserData) => {
				fs.writeFile(this.outputPath, JSON.stringify(evtData), 'utf8', (err) => {
					if (err) {
						this.onPrimaryError(err, reject);
					} else {
						this.onPrimarySuccess(resolve, reject);
					}
				});
			});

			console.info(
				`Transcoding File ${this.inputFile} to - ${this.outputPath}`
			);
			this.pdfParser.loadPDF(this.inputPath, VERBOSITY_LEVEL);
		});
	}

	//public methods
	async validateParams() {
		let retVal = '';

		if (!fs.existsSync(this.inputDir))
			retVal =
				`Input error: input directory doesn't exist - ${this.inputDir}.`;
		else if (!fs.existsSync(this.inputPath))
			retVal =
				`Input error: input file doesn't exist - ${this.inputPath}.`;
		else if (!fs.existsSync(this.outputDir)) {
			try {
				await fs.promises.mkdir(this.outputDir, { recursive: true });
			} finally {
				if (!fs.existsSync(this.outputDir))
					retVal = `Input error: output directory doesn't exist and fails to create - ${this.outputDir}.`;
			}
		}

		if (retVal !== '') {
			this.curCLI.addResultCount(retVal);
			return retVal;
		}

		const inExtName = path.extname(this.inputFile).toLowerCase();
		if (inExtName !== ".pdf") {
			retVal =
				`Input error: input file name doesn't have pdf extention  - ${this.inputFile}.`;
		}
		else {
			this.outputFile = `${path.basename(this.inputPath, inExtName)}.json`;
			this.outputPath = path.normalize(`${this.outputDir}/${this.outputFile}`);
			if (fs.existsSync(this.outputPath)) {
				console.warn(`Output file will be replaced - ${this.outputPath}`);
			}
			else {
				const fod = fs.openSync(this.outputPath, "wx");
				if (!fod) retVal = `Input error: can not write to ${this.outputPath}`;
				else {
					fs.closeSync(fod);
					fs.unlinkSync(this.outputPath);
				}
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

		if (this.pdfParser) {
			this.pdfParser.destroy();
		}
		this.pdfParser = null;
		this.curCLI = null;
	}

	processFile() {
		return new Promise((resolve, reject) => {
			this.validateParams()
				.then((validateMsg) => {
					if (validateMsg !== '') {
						reject(validateMsg);
					}
					else {
						const parserFunc = PROCESS_WITH_STREAM
							? this.parseOnePDFStream
							: this.parseOnePDF;
						parserFunc
							.call(this)
							.then((value) => resolve(value))
							.catch((err) => reject(err));
					}
				})
				.catch((err) => reject(err));
		});
	}

	getOutputFile = () => path.join(this.outputDir, this.outputFile);
}

export default class PDFCLI {
	inputCount = 0;
	successCount = 0;
	failedCount = 0;
	warningCount = 0;
	statusMsgs : string[] = [];

	// constructor
	constructor() {
		this.inputCount = 0;
		this.successCount = 0;
		this.failedCount = 0;
		this.warningCount = 0;
		this.statusMsgs = [];
	}

	initialize(): { success: boolean; error?: string } {
		try {
			// Handle version and help flags
			if (ONLY_SHOW_VERSION) {
				console.log(pkInfo.version);
				return { success: false };
			}

			if (ONLY_SHOW_HELP) {
				yargs.showHelp();
				return { success: false };
			}

			// Validate mandatory -f parameter
			if (!HAS_INPUT_DIR_OR_FILE) {
				return {
					success: false,
					error: "-f|--file parameter is required to specify input directory or file."
				};
			}

			// Validate that -f has a value
			if (typeof INPUT_DIR_OR_FILE !== 'string' || INPUT_DIR_OR_FILE.trim() === '') {
				return {
					success: false,
					error: "-f|--file parameter must have a valid path value."
				};
			}

			// Validate that -f is not specified multiple times
			if (Array.isArray(INPUT_DIR_OR_FILE)) {
				return {
					success: false,
					error: `-f|--file parameter can only be specified once. Received multiple values: ${INPUT_DIR_OR_FILE.join(", ")}`
				};
			}

			// Validate input path exists
			if (!fs.existsSync(INPUT_DIR_OR_FILE)) {
				return {
					success: false,
					error: `Input path does not exist: ${INPUT_DIR_OR_FILE}`
				};
			}

			// Validate output directory if specified
			if (argv.o && !fs.existsSync(argv.o)) {
				return {
					success: false,
					error: `Output directory does not exist: ${argv.o}`
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
		// Initialize and validate parameters
		const initResult = this.initialize();
		if (!initResult.success) {
			if (initResult.error) {
				// Show help for parameter errors
				yargs.showHelp();
				console.error(`\nError: ${initResult.error}`);
				process.exit(1);
			}
			// Exit cleanly for -v or -h flags (no error)
			process.exit(0);
		}

		console.log(_PRO_TIMER);
		console.time(_PRO_TIMER);

		let hasError = false;
		let errorMessage: string | undefined;

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
			this.failedCount++;
		} finally {
			this.complete(hasError, errorMessage);
		}
	}

	complete(hasError: boolean = false, errorMessage?: string) {
		const stdioFunc = (hasError || this.failedCount > 0) ? console.error : console.log;

		if (errorMessage) {
			stdioFunc(`\nError: ${errorMessage}`);
		}
		if (this.statusMsgs.length > 0) {
			stdioFunc(this.statusMsgs);
		}
		stdioFunc(
			`\n${this.inputCount} input files\t${this.successCount} success\t${this.failedCount} fail\t${this.warningCount} warning`
		);

		process.nextTick(() => {
			console.timeEnd(_PRO_TIMER);
			if (hasError || this.failedCount > 0) {
				process.exit(1);
			}
		});
	}

	processOneFile(inputDir:string, inputFile:string) {
		return new Promise<ProcessingResult>((resolve, reject) => {
			const p2j = new PDFProcessor(inputDir, inputFile, this);
			p2j
				.processFile()
				.then((retVal: unknown) => {
					const result = retVal as ProcessingResult;
					this.addStatusMsg(
						false,
						`${path.join(inputDir, inputFile)} => ${p2j.getOutputFile()}`
					);
					result.forEach((ret: PromiseSettledResult<unknown>) => {
						if (ret.status === 'fulfilled') {
							this.addStatusMsg(false, `+ ${ret.value}`);
						}
					});
					resolve(result);
				})
				.catch((error) => {
					this.addStatusMsg(
						error,
						`${path.join(inputDir, inputFile)} => ${error}`
					);
					reject(error);
				})
				.finally(() => p2j.destroy());
		});
	}

	processFiles(inputDir: string, files: string[]): Promise<PromiseSettledResult<unknown>[]> {
		const allPromises: Promise<unknown>[] = [];
		files.forEach((file: string, idx: number) =>
			allPromises.push(this.processOneFile(inputDir, file))
		);
		return Promise.allSettled(allPromises);
	}

	processOneDirectory(inputDir:string) {
		return new Promise((resolve, reject) => {
			fs.readdir(inputDir, (err, files) => {
				if (err) {
					this.addStatusMsg(true, `[${inputDir}] - ${err.toString()}`);
					reject(err);
				} else {
					const _iChars = "!@#$%^&*()+=[]\\';,/{}|\":<>?~`.-_  ";
					const pdfFiles = files.filter(
						(file) =>
							file.slice(-4).toLowerCase() === ".pdf" &&
							_iChars.indexOf(file.substring(0, 1)) < 0
					);

					this.inputCount = pdfFiles.length;
					if (this.inputCount > 0) {
						this.processFiles(inputDir, pdfFiles)
							.then((value) => resolve(value))
							.catch((err) => reject(err));
					} else {
						this.addStatusMsg(true, `[${inputDir}] - No PDF files found`);
						resolve('no pdf files found');
					}
				}
			});
		});
	}

	addStatusMsg(error:boolean, oneMsg:string) {
		this.statusMsgs.push(
			error ? `✗ Error : ${oneMsg}` : `✓ Success : ${oneMsg}`
		);
	}

	addResultCount(error:boolean) {
		error ? this.failedCount++ : this.successCount++;
	}
}
