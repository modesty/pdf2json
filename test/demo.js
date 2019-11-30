'use strict';

const path = require('path');
const PDFParser = require('..');

const filepath = path.join(__dirname, 'target/demo2.pdf');

const pdfParser = new PDFParser(this, 1);
// require('util').verbosity(0);

pdfParser.on('pdfParser_dataReady', () => {
  let text = pdfParser.getRawTextContent() || '';
  console.log('pdfParser_dataReady, rawTextContent:%j', text);
  // replace page info
  // ----------------Page (37) Break----------------
  text = text.replace(/----------------Page \(\d+\) Break----------------\r\n/gi, '')
    .replace(/ {0,100}(?:\r\n){1,100}/g, ' ');
  // pdfParser.destroy();
  console.log(text);
});

pdfParser.on('pdfParser_dataError', errData => {
  console.log('pdfParser_dataError', errData);
  let err = errData.parserError;
  if (typeof err === 'string') {
    err = new Error(err);
    err.name = 'PDFParserDataError';
  }
  console.error(err);
});

console.log('loadPDF', filepath);
pdfParser.loadPDF(filepath);
