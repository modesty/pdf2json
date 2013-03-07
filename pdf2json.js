var fs = require('fs'),
    path = require('path'),
    PFParser = require("./pdfparser");

var argv = require('optimist')
    .usage('Usage: $0 -f [full path of input PDF file] -od [optional output path of JSON]')
    .demand(['f'])
    .alias('f', 'file')
    .describe('f', 'Full path of input PDF file or a directory to scan for all PDF files. When specifying a PDF file name, it must end with .PDF, otherwise it would be treated as a input directory.\n')
    .alias('od', 'output_dir')
    .describe('od', 'Full path of output directory, must already exist. Current JSON file in the output folder will be replaced when file name is same.\n')
    .argv;


var inputStatus = fs.statSync(argv.f);
var inputDir = null;
var inputFile = null;
var outputDir = null;
var outputFile = null;

if (inputStatus.isFile()) {
    console.log('File:', argv.f);
    inputDir = path.dirname(argv.f);
    inputFile = path.basename(argv.f);
    console.log('inputFile:', inputFile);
}
else if (inputStatus.isDirectory()) {
    console.log('Directory:', argv.f);
    inputDir = path.normalize(argv.f);
}

console.log('inputDir:', inputDir);

outputDir = argv.od || inputDir;
console.log('outputDir:', outputDir);

//var outputPath = argv.od || __dirname;

