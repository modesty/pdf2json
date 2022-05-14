import nodeUtil from "util";
import fs from "fs";
import path from "path";

import {ParserStream, StringifyStream} from "./parserstream.js";
import PDFParser from "../pdfparser.js";

import { pkInfo, _PARSER_SIG as _PRO_TIMER } from "../pkinfo.js";

import { yargs } from "./p2jcmdarg.js";

const argv = yargs.argv;
const ONLY_SHOW_VERSION = ('v' in argv);
const ONLY_SHOW_HELP = ('h' in argv);
const VERBOSITY_LEVEL = (('s' in argv) ? 0 : 5);
const HAS_INPUT_DIR_OR_FILE = ('f' in argv);

const PROCESS_RAW_TEXT_CONTENT = ('c' in argv);
const PROCESS_FIELDS_CONTENT = ('t' in argv);
const PROCESS_MERGE_BROKEN_TEXT_BLOCKS = ('m' in argv);
const PROCESS_WITH_STREAM = ('r' in argv);

const INPUT_DIR_OR_FILE = argv.f;

class PDFProcessor {
    inputDir = null;
    inputFile = null;
    inputPath = null;
    
    outputDir = null;
    outputFile = null;
    outputPath = null;
    
    pdfParser = null;
    curCLI = null;

    // constructor
    constructor(inputDir, inputFile, curCLI) {
        // public, this instance copies
        this.inputDir = path.normalize(inputDir);
        this.inputFile = inputFile;
        this.inputPath = path.join(this.inputDir, this.inputFile);

        this.outputDir = path.normalize(argv.o || inputDir);
        this.outputFile = null;
        this.outputPath = null;

        this.pdfParser = null;
        this.curCLI = curCLI;
    }

    //private methods	
	#generateMergedTextBlocksStream() {
		return new Promise( (resolve, reject) => {
			const outputStream = ParserStream.createOutputStream(this.outputPath.replace(".json", ".merged.json"), resolve, reject);
			this.pdfParser.getMergedTextBlocksStream().pipe(new StringifyStream()).pipe(outputStream);	
		});
	}

    #generateRawTextContentStream() {
		return new Promise( (resolve, reject) => {
			const outputStream = ParserStream.createOutputStream(this.outputPath.replace(".json", ".content.txt"), resolve, reject);
			this.pdfParser.getRawTextContentStream().pipe(outputStream);
		});
    }

    #generateFieldsTypesStream() {
		return new Promise( (resolve, reject) => {
			const outputStream = ParserStream.createOutputStream(this.outputPath.replace(".json", ".fields.json"), resolve, reject);
			this.pdfParser.getAllFieldsTypesStream().pipe(new StringifyStream()).pipe(outputStream);
		});
	}

	#processAdditionalStreams() {
        const outputTasks = [];
        if (PROCESS_FIELDS_CONTENT) {//needs to generate fields.json file
            outputTasks.push(this.#generateFieldsTypesStream());
        }
        if (PROCESS_RAW_TEXT_CONTENT) {//needs to generate content.txt file
            outputTasks.push(this.#generateRawTextContentStream());
        }
        if (PROCESS_MERGE_BROKEN_TEXT_BLOCKS) {//needs to generate json file with merged broken text blocks
            outputTasks.push(this.#generateMergedTextBlocksStream());
        }
		return Promise.allSettled(outputTasks);
	}

	#onPrimarySuccess(resolve, reject) {
		this.curCLI.addResultCount();
		this.#processAdditionalStreams()
			.then( retVal => resolve(retVal))
			.catch( err => reject(err) );			
	}

	#onPrimaryError(err, reject) {
		this.curCLI.addResultCount(err);
		reject(err);
	}

	#parseOnePDFStream() {
		return new Promise( (resolve, reject) => {
			this.pdfParser = new PDFParser(null, PROCESS_RAW_TEXT_CONTENT);
			this.pdfParser.on("pdfParser_dataError", evtData => this.#onPrimaryError(evtData.parserError, reject));
	
			const outputStream = fs.createWriteStream(this.outputPath);
			outputStream.on('finish', () => this.#onPrimarySuccess(resolve, reject));
			outputStream.on('error', err => this.#onPrimaryError(err, reject));
	
			nodeUtil.p2jinfo("Transcoding Stream " + this.inputFile + " to - " + this.outputPath);
			const inputStream = fs.createReadStream(this.inputPath, {bufferSize: 64 * 1024});
			inputStream.pipe(this.pdfParser.createParserStream()).pipe(new StringifyStream()).pipe(outputStream);	
		});
	};

	#parseOnePDF() {
		return new Promise( (resolve, reject) => {
			this.pdfParser = new PDFParser(null, PROCESS_RAW_TEXT_CONTENT);
			this.pdfParser.on("pdfParser_dataError", evtData => this.#onPrimaryError(evtData.parserError, reject));

			this.pdfParser.on("pdfParser_dataReady", evtData => {
				fs.writeFile(this.outputPath, JSON.stringify(evtData), err => {
					if(err) {
						this.#onPrimaryError(err, reject);
					} else {
						this.#onPrimarySuccess(resolve, reject);
					}
				});
			});

			nodeUtil.p2jinfo("Transcoding File " + this.inputFile + " to - " + this.outputPath);
			this.pdfParser.loadPDF(this.inputPath, VERBOSITY_LEVEL);
		});
	}

    //public methods
    validateParams() {
        let retVal = null;

        if (!fs.existsSync(this.inputDir))
            retVal = "Input error: input directory doesn't exist - " + this.inputDir + ".";
        else if (!fs.existsSync(this.inputPath))
            retVal = "Input error: input file doesn't exist - " + this.inputPath + ".";
        else if (!fs.existsSync(this.outputDir))
            retVal = "Input error: output directory doesn't exist - " + this.outputDir + ".";

        if (retVal != null) {
            this.curCLI.addResultCount(retVal);
            return retVal;
        }

        const inExtName = path.extname(this.inputFile).toLowerCase();
        if (inExtName !== '.pdf')
            retVal = "Input error: input file name doesn't have pdf extention  - " + this.inputFile + ".";
        else {
            this.outputFile = path.basename(this.inputPath, inExtName) + ".json";
            this.outputPath = path.normalize(this.outputDir + "/" + this.outputFile);
            if (fs.existsSync(this.outputPath))
                nodeUtil.p2jwarn("Output file will be replaced - " + this.outputPath);
            else {
                let fod = fs.openSync(this.outputPath, "wx");
                if (!fod)
                    retVal = "Input error: can not write to " + this.outputPath;
                else {
                    fs.closeSync(fod);
                    fs.unlinkSync(this.outputPath);
                }
            }
        }

        return retVal;
    }

    destroy() {
        this.inputDir = null;
        this.inputFile = null;
        this.inputPath = null;
        this.outputDir = null;
        this.outputPath = null;

        if (this.pdfParser) {
            this.pdfParser.destroy();
        }
        this.pdfParser = null;
        this.curCLI = null;
    }

    processFile() {
		return new Promise((resolve, reject) => {
			const validateMsg = this.validateParams();
			if (!!validateMsg) {
				reject(validateMsg);
			}
			else {
				const parserFunc = PROCESS_WITH_STREAM ? this.#parseOnePDFStream : this.#parseOnePDF;
				parserFunc.call(this)
					.then( value => resolve(value) ) 
					.catch( err => reject(err) );
			}
		});
    }

    getOutputFile = function() {
        return path.join(this.outputDir, this.outputFile);
    }   
}

export default class PDFCLI {
    inputCount = 0;
    successCount = 0;
    failedCount = 0;
    warningCount = 0;
    statusMsgs = [];

    // constructor
    constructor() {
        this.inputCount = 0;
        this.successCount = 0;
        this.failedCount = 0;
        this.warningCount = 0;
        this.statusMsgs = [];
    }

    initialize() {        
        nodeUtil.verbosity(VERBOSITY_LEVEL);
        let retVal = true;
        try {
            if (ONLY_SHOW_VERSION) {
                console.log(pkInfo.version);
                retVal = false;
            }
            else if (ONLY_SHOW_HELP) {
                yargs.showHelp();
                retVal = false;
            }
            else if (!HAS_INPUT_DIR_OR_FILE) {
                yargs.showHelp();
                console.error("-f is required to specify input directory or file.");
                retVal = false;
            }
        }
        catch(e) {
            console.error("Exception: " + e.message);
            retVal = false;
        }
        return retVal;
    }

    async start() {
        if (!this.initialize())
            return;

		console.log(_PRO_TIMER);
		console.time(_PRO_TIMER);
    
		try {
            const inputStatus = fs.statSync(INPUT_DIR_OR_FILE);			
            if (inputStatus.isFile()) {
				this.inputCount = 1;
                await this.processOneFile(path.dirname(INPUT_DIR_OR_FILE), path.basename(INPUT_DIR_OR_FILE));
            }
            else if (inputStatus.isDirectory()) {				
                await this.processOneDirectory(path.normalize(INPUT_DIR_OR_FILE));
            }
        }
        catch(e) {
            console.error("Exception: ", e);            
        }
		finally {
			this.complete();
		}
    }

    complete() {        
        if (this.statusMsgs.length > 0)
            console.log(this.statusMsgs);
        console.log(`${this.inputCount} input files\t${this.successCount} success\t${this.failedCount} fail\t${this.warningCount} warning`);    
        process.nextTick( () => {
            console.timeEnd(_PRO_TIMER);            
            // process.exit((this.inputCount === this.successCount) ? 0 : 1);
        });
    }

    processOneFile(inputDir, inputFile) {
		return new Promise((resolve, reject) => {
			const p2j = new PDFProcessor(inputDir, inputFile, this);
			p2j.processFile()
				.then( retVal => {					
					this.addStatusMsg(null, `${path.join(inputDir, inputFile)} => ${p2j.getOutputFile()}`);	
					retVal.forEach(ret => this.addStatusMsg(null, `+ ${ret.value}`));
					resolve(retVal);
				})
				.catch(error => {					
					this.addStatusMsg(error, `${path.join(inputDir, inputFile)} => ${error}`);							
					reject(error);
				})
				.finally(() => p2j.destroy()); 
		});
    }

    processFiles(inputDir, files) {
		const allPromises = [];
		files.forEach( (file, idx) => allPromises.push(this.processOneFile(inputDir, file)) );
		return Promise.allSettled(allPromises);
    }

    processOneDirectory(inputDir) {
		return new Promise((resolve, reject) => {			
			fs.readdir(inputDir, (err, files) => {
				if (err) {
					this.addStatusMsg(true, `[${inputDir}] - ${err.toString()}`);
					reject(err);
				}
				else {
					const _iChars = "!@#$%^&*()+=[]\\\';,/{}|\":<>?~`.-_  ";
					const pdfFiles = files.filter( file => file.slice(-4).toLowerCase() === '.pdf' && _iChars.indexOf(file.substring(0,1)) < 0 );

					this.inputCount = pdfFiles.length;
					if (this.inputCount > 0) {
						this.processFiles(inputDir, pdfFiles)
							.then( value => resolve(value) ) 
							.catch( err => reject(err) );
					}
					else {
						this.addStatusMsg(true, `[${inputDir}] - No PDF files found`);
						resolve();
					}
				}
			});
		});
    }

    addStatusMsg(error, oneMsg) {
        this.statusMsgs.push(error ? `✗ Error : ${oneMsg}` : `✓ Success : ${oneMsg}`); 
    }

    addResultCount(error) {
        (error ? this.failedCount++ : this.successCount++);
    }
}
