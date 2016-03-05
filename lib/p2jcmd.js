'use strict';

let fs = require('fs'),
    path = require('path'),
    _ = require('underscore'),
    PDFParser = require("../pdfparser"),
    pkInfo = require('../package.json'),
    async = require("async");

const _PRO_TIMER = `${pkInfo.name}@${pkInfo.version} [${pkInfo.homepage}]`;

let optimist = require('optimist')
    .usage("\n" + _PRO_TIMER + "\n\nUsage: $0 -f|--file [-o|output_dir]")
    .alias('v', 'version')
    .describe('v', 'Display version.\n')
    .alias('h', 'help')
    .describe('h', 'Display brief help information.\n')
    .alias('f', 'file')
    .describe('f', '(required) Full path of input PDF file or a directory to scan for all PDF files. When specifying a PDF file name, it must end with .PDF, otherwise it would be treated as a input directory.\n')
    .alias('o', 'output_dir')
    .describe('o', '(optional) Full path of output directory, must already exist. Current JSON file in the output folder will be replaced when file name is same.\n')
    .alias('s', 'silent')
    .describe('s', '(optional) when specified, will only log errors, otherwise verbose.\n')
    .alias('t', 'fieldTypes')
    .describe('t', '(optional) when specified, will generate .fields.json that includes fields ids and types.\n')
    .alias('c', 'content')
    .describe('c', '(optional) when specified, will generate .content.txt that includes text content from PDF (Experimental).\n')
    .alias('m', 'merge')
    .describe('m', '(optional) when specified, will generate .merged.json that includes auto-merged broken text blocks from PDF (Experimental).\n');


let argv = optimist.argv;

let PDF2JSONUtil = (function () {

    let _continue = function(callback, err) {
        if (err)
            console.warn(err);
        if (_.isFunction(callback))
            callback(err);
    };

    let _generateFieldsTypesFile = function(data, callback) {
        let pJSON = this.pdfParser.getAllFieldsTypes();
        let fieldsTypesPath = this.outputPath.replace(".json", ".fields.json");
        let fieldTypesFile = this.outputFile.replace(".json", ".fields.json");

        fs.writeFile(fieldsTypesPath, JSON.stringify(pJSON), function(err) {
            if (err) {
                console.warn(this.inputFile + " => " + fieldTypesFile + " Exception: " + err);
            } else {
                console.log(this.inputFile + " => " + fieldTypesFile + " [" + this.outputDir + "] OK");
            }
            callback(err, fieldTypesFile);
        }.bind(this));
    };

    let _generateRawTextContentFile = function(data, callback) {
        let contentPath = this.outputPath.replace(".json", ".content.txt");
        let contentFile = this.outputFile.replace(".json", ".content.txt");

        fs.writeFile(contentPath, this.pdfParser.getRawTextContent(), function(err) {
            if (err) {
                console.warn(this.inputFile + " => " + contentFile + " Exception: " + err);
            } else {
                console.log(this.inputFile + " => " + contentFile + " [" + this.outputDir + "] OK");
            }
            callback(err, contentFile);
        }.bind(this));
    };


    let _writeOneJSON = function(data, callback) {
        let pJSON = JSON.stringify({"formImage":data});

        fs.writeFile(this.outputPath, pJSON, function(err) {
            if(err) {
                console.warn(this.inputFile + " => " + this.outputFile + " Exception: " + err);
                this.curProcessor.failedCount++;
            } else {
                console.log(this.inputFile + " => " + this.outputFile + " [" + this.outputDir + "] OK");
                this.curProcessor.successCount++;

            }
            callback(err, this.outputFile);
        }.bind(this));
    };

    let _writeOneJSONWithMergedTextBlocks = function(data, callback) {
        data.Pages = this.pdfParser.getMergedTextBlocksIfNeeded();
        let pJSON = JSON.stringify({"formImage":data});
        let outputPath = this.outputPath.replace(".json", ".merged.json");
        let contentFile = this.outputFile.replace(".json", ".merged.json");

        fs.writeFile(outputPath, pJSON, function(err) {
            if (err) {
                console.warn(err);
            } else {
                console.log(this.inputFile + " => " + this.outputFile + " [" + outputPath + "] OK");
            }
            callback(err, contentFile);
        }.bind(this));
    };

    let _parseOnePDF = function(callback) {
        let processRawTextContent = _.has(argv, 'c');
        let self = this;
        this.pdfParser = new PDFParser(null, processRawTextContent);

        this.pdfParser.on("pdfParser_dataReady", function (evtData) {
            if ((!!evtData) && (!!evtData.data)) {

                let outputTasks = [function(cbFunc) { _writeOneJSON.call(self, evtData.data, cbFunc);}];
                if (_.has(argv, 't')) {//needs to generate fields.json file
                    outputTasks.push(function(cbFunc) {_generateFieldsTypesFile.call(self, evtData.data, cbFunc);});
                }
                if (processRawTextContent) {//needs to generate content.txt file
                    outputTasks.push(function(cbFunc) {_generateRawTextContentFile.call(self, evtData.data, cbFunc);});
                }
                if (_.has(argv, 'm')) {//needs to generate json file with merged broken text blocks
                    outputTasks.push(function(cbFunc) {_writeOneJSONWithMergedTextBlocks.call(self, evtData.data, cbFunc);});
                }

                async.series(outputTasks, function(err, results){
                    if (err) {
                        console.warn("Error: " + err);
                    } else {
                        console.log("Output files OK", results);
                    }

                    _continue.call(self, callback);
                });
            }
            else {
                this.curProcessor.failedCount++;
                _continue.call(this, callback, "Exception: empty parsing result - " + this.inputPath);
            }
        }.bind(this));

        this.pdfParser.on("pdfParser_dataError", function (evtData) {
            this.curProcessor.failedCount++;
            let errMsg = "Exception: " + evtData.data;
            _continue.call(this, callback, errMsg);
        }.bind(this));

        console.log("\nTranscoding " + this.inputFile + " to - " + this.outputPath);
        this.pdfParser.loadPDF(this.inputPath, (_.has(argv, 's') ? 0 : 5));
    };

    // constructor
    let cls = function (inputDir, inputFile, curProcessor) {
        // public, this instance copies
        this.inputDir = path.normalize(inputDir);
        this.inputFile = inputFile;
        this.inputPath = this.inputDir + path.sep + this.inputFile;

        this.outputDir = path.normalize(argv.o || inputDir);
        this.outputFile = null;
        this.outputPath = null;

        this.pdfParser = null;
        this.curProcessor = curProcessor;
    };

    cls.prototype.validateParams = function() {
        let retVal = null;

        if (!fs.existsSync(this.inputDir))
            retVal = "Input error: input directory doesn't exist - " + this.inputDir + ".";
        else if (!fs.existsSync(this.inputPath))
            retVal = "Input error: input file doesn't exist - " + this.inputPath + ".";
        else if (!fs.existsSync(this.outputDir))
            retVal = "Input error: output directory doesn't exist - " + this.outputDir + ".";

        if (retVal != null) {
            this.curProcessor.failedCount += 1;
            return retVal;
        }

        let inExtName = path.extname(this.inputFile).toLowerCase();
        if (inExtName !== '.pdf')
            retVal = "Input error: input file name doesn't have pdf extention  - " + this.inputFile + ".";
        else {
            this.outputFile = path.basename(this.inputPath, inExtName) + ".json";
            this.outputPath = this.outputDir + path.sep + this.outputFile;
            if (fs.existsSync(this.outputPath))
                console.log("Output file will be replaced - " + this.outputPath);
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
    };

    cls.prototype.destroy = function() {
        this.inputDir = null;
        this.inputFile = null;
        this.inputPath = null;
        this.outputDir = null;
        this.outputPath = null;

        if (this.pdfParser) {
            this.pdfParser.destroy();
        }
        this.pdfParser = null;
        this.curProcessor = null;
    };

    cls.prototype.processFile = function(callback) {
        let validateMsg = this.validateParams();
        if (!!validateMsg) {
            _continue.call(this, callback, validateMsg);
        }
        else {
            _parseOnePDF.call(this, callback);
        }
    };

    return cls;
})();

let PDFProcessor = (function () {
    // constructor
    let cls = function () {
        this.inputCount = 0;
        this.successCount = 0;
        this.failedCount = 0;
        this.warningCount = 0;

        this.p2j = null;
    };

    cls.prototype.initialize = function(){
        console.time(_PRO_TIMER);
        let retVal = true;
        try {
            if (_.has(argv, 'v')) {
                console.log(pkInfo.version);
                retVal = false;
            }
            else if (_.has(argv, 'h')) {
                optimist.showHelp();
                retVal = false;
            }
            else if (!_.has(argv, 'f')) {
                optimist.showHelp();
                console.log("-f is required to specify input directory or file.");
                retVal = false;
            }
        }
        catch(e) {
            console.log("Exception: " + e.message);
            retVal = false;
        }
        return retVal;
    };

    cls.prototype.start = function(){
        if (!this.initialize()) {
            console.timeEnd(_PRO_TIMER);
            return;
        }

        try {
            console.log("\n" + _PRO_TIMER);

            let inputStatus = fs.statSync(argv.f);

            if (inputStatus.isFile()) {
                this.processOneFile();
            }
            else if (inputStatus.isDirectory()) {
                this.processOneDirectory();
            }
        }
        catch(e) {
            console.error("Exception: " + e.message);
            console.timeEnd(_PRO_TIMER);
        }
    };

    cls.prototype.complete = function(err) {
        let statusMsg = "\n%d input files\t%d success\t%d fail\t%d warning.";
        console.log(statusMsg, this.inputCount, this.successCount, this.failedCount, this.warningCount);

        process.nextTick( function() {
            console.timeEnd(_PRO_TIMER);
            let exitCode = (this.inputCount === this.successCount) ? 0 : 1;
            process.exit(exitCode);
        }.bind(this));
    };

    cls.prototype.processOneFile = function () {
        let inputDir = path.dirname(argv.f);
        let inputFile = path.basename(argv.f);

        this.inputCount = 1;
        this.p2j = new PDF2JSONUtil(inputDir, inputFile, this);
        this.p2j.processFile(_.bind(this.complete, this));
    };

    cls.prototype.processFiles = function(inputDir, files) {
        let fId = 0;
        this.p2j = new PDF2JSONUtil(inputDir, files[fId], this);
        this.p2j.processFile( function processPDFFile(err) {
            if (err) {
                this.complete(err);
            }
            else {
                fId++;
                if (fId >= this.inputCount) {
                    this.complete(null);
                }
                else {
                    if (this.p2j) {
                        this.p2j.destroy();
                        this.p2j = null;
                    }

                    this.p2j = new PDF2JSONUtil(inputDir, files[fId], this);
                    this.p2j.processFile(processPDFFile.bind(this));
                }
            }
        }.bind(this));
    };

    cls.prototype.processOneDirectory = function () {
        let inputDir = path.normalize(argv.f);

        fs.readdir(inputDir, function(err, files) {
            let _iChars = "!@#$%^&*()+=[]\\\';,/{}|\":<>?~`.-_  ";
            let pdfFiles = files.filter(function(file) {
                return file.substr(-4).toLowerCase() === '.pdf' && _iChars.indexOf(file.substr(0,1)) < 0;
            });

            this.inputCount = pdfFiles.length;
            if (this.inputCount > 0) {
                this.processFiles(inputDir, pdfFiles);
            }
            else {
                console.log("No PDF files found. [" + inputDir + "].");
                this.complete(null);
            }
        }.bind(this));
    };

    return cls;
})();

module.exports = PDFProcessor;
