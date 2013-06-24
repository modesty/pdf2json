'use strict';

var fs = require('fs'),
    path = require('path'),
    _ = require('underscore'),
    PFParser = require("../pdfparser"),
    pkInfo = require('../package.json');

var optimist = require('optimist')
    .usage('\nUsage: $0 -f|--file [-o|output_dir]')
    .alias('v', 'version')
    .describe('v', 'Display version.\n')
    .alias('h', 'help')
    .describe('h', 'Display brief help information.\n')
    .alias('f', 'file')
    .describe('f', '(required) Full path of input PDF file or a directory to scan for all PDF files. When specifying a PDF file name, it must end with .PDF, otherwise it would be treated as a input directory.\n')
    .alias('o', 'output_dir')
    .describe('o', '(optional) Full path of output directory, must already exist. Current JSON file in the output folder will be replaced when file name is same.\n');

var argv = optimist.argv;

var PDF2JSONUtil = (function () {

    var _continue = function(callback, err) {
        if (err)
            console.log(err);
        if (_.isFunction(callback))
            callback(err);
    };

    var _writeOneJSON = function(data, callback) {
        var self = this;
        var pJSON = JSON.stringify({"formImage":data});

        fs.writeFile(self.outputPath, pJSON, function(err) {
            if(err) {
                console.log("\n" + self.inputFile + " => " + self.outputFile + " Error: " + err);
                self.curProcessor.failedCount++;
            } else {
                console.log("\n" + self.inputFile + " => " + self.outputFile + " [" + self.outputDir + "] OK");
                self.curProcessor.successCount++;
            }
            _continue.call(self, callback, err);
        });
    };

    var _parseOnePDF = function(callback) {
        var self = this;
        self.pdfParser = new PFParser();

        self.pdfParser.on("pdfParser_dataReady", function (evtData) {
            if ((!!evtData) && (!!evtData.data)) {
                _writeOneJSON.call(self, evtData.data, callback);
            }
            else {
                _continue.call(self, callback, "Transcoder error: empty parsing result - " + self.inputPath);
            }
        });

        self.pdfParser.on("pdfParser_dataError", function (evtData) {
            var errMsg = "Transcoder error:\n" + evtData.data;
            _continue.call(self, callback, errMsg);
        });

        self.pdfParser.loadPDF(self.inputPath);
    };

    // constructor
    var cls = function (inputDir, inputFile, curProcessor) {
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
        var retVal = null;

        if (!fs.existsSync(this.inputDir))
            retVal = "Input error: input directory doesn't exist - " + this.inputDir + ".";
        else if (!fs.existsSync(this.inputPath))
            retVal = "Input error: input file doesn't exist - " + this.inputPath + ".";
        else if (!fs.existsSync(this.outputDir))
            retVal = "Input error: output directory doesn't exist - " + this.outputDir + ".";

        if (retVal != null)
            return retVal;

        var inExtName = path.extname(this.inputFile).toLowerCase();
        if (inExtName !== '.pdf')
            retVal = "Input error: input file name doesn't have pdf extention  - " + this.inputFile + ".";
        else {
            this.outputFile = path.basename(this.inputPath, inExtName) + ".json";
            this.outputPath = this.outputDir + path.sep + this.outputFile;
            if (fs.existsSync(this.outputPath))
                console.log("\n\nOutput file will be replaced - " + this.outputPath);
            else {
                var fod = fs.openSync(this.outputPath, "wx");
                if (!fod)
                    retVal = "Input error: can not write to " + this.outputPath;
                else {
                    console.log("\n\nTranscoding " + this.inputFile + " to - " + this.outputPath);
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

        this.pdfParser.destroy();
        this.pdfParser = null;
        this.curProcessor = null;
    };

    cls.prototype.processFile = function(callback) {
        var validateMsg = this.validateParams();
        if (!!validateMsg) {
            _continue.call(this, callback, validateMsg);
        }
        else {
            _parseOnePDF.call(this, callback);
        }
    };

    return cls;
})();

var PDFProcessor = (function () {
    var _PRO_TIMER = "pdf2json transcoder";

    // constructor
    var cls = function () {
        this.inputCount = 0;
        this.successCount = 0;
        this.failedCount = 0;
        this.warningCount = 0;

        this.p2j = null;
    };

    cls.prototype.initialize = function(){
        console.time(_PRO_TIMER);
        var retVal = true;
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
            console.log(pkInfo._id + " - https://github.com/modesty/pdf2json");

            var inputStatus = fs.statSync(argv.f);

            if (inputStatus.isFile()) {
                this.processOneFile();
            }
            else if (inputStatus.isDirectory()) {
                this.processOneDirectory();
            }
        }
        catch(e) {
            console.log("Exception: " + e.message);
            console.timeEnd(_PRO_TIMER);
        }
    };

    cls.prototype.complete = function(err) {
        var statusMsg = "\n\n%d input files\t%d success\t%d fail\t%d warning.\n";
        console.log(statusMsg, this.inputCount, this.successCount, this.failedCount, this.warningCount);

        var self = this;
        process.nextTick( function() {
            console.timeEnd(_PRO_TIMER);
            var exitCode = (self.inputCount === self.successCount) ? 0 : 1;
            process.exit(exitCode);
        });
    };

    cls.prototype.processOneFile = function () {
        var inputDir = path.dirname(argv.f);
        var inputFile = path.basename(argv.f);

        this.inputCount = 1;
        this.p2j = new PDF2JSONUtil(inputDir, inputFile, this);
        this.p2j.processFile(_.bind(this.complete, this));
    };

    cls.prototype.processFiles = function(inputDir, files) {
        var self = this;
        var fId = 0;

        self.p2j = new PDF2JSONUtil(inputDir, files[fId], self);
        self.p2j.processFile( function processPDFFile(err) {
            if (err) {
                self.complete(err);
            }
            else {
                fId++;
                if (fId >= self.inputCount) {
                    self.complete(null);
                }
                else {
                    if (self.p2j) {
                        self.p2j.destroy();
                        self.p2j = null;
                    }

                    self.p2j = new PDF2JSONUtil(inputDir, files[fId], self);
                    self.p2j.processFile(processPDFFile);
                }
            }
        });
    };

    cls.prototype.processOneDirectory = function () {
        var self = this;
        var inputDir = path.normalize(argv.f);

        fs.readdir(inputDir, function(err, files) {
            var pdfFiles = files.filter(function(file) {
                return file.substr(-4).toLowerCase() === '.pdf';
            });

            self.inputCount = pdfFiles.length;
            if (self.inputCount > 0) {
                self.processFiles(inputDir, pdfFiles);
            }
            else {
                console.log("No PDF files found. [" + inputDir + "].");
                self.complete(null);
            }
        });
    };

    return cls;
})();

module.exports = PDFProcessor;
