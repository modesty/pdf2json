#!/usr/bin/env node

const PDFParser = require('../dist/pdfparser.cjs');
const path = require('node:path');

const pdfPath = path.resolve(__dirname, 'pdf', 'h', 'hidden-action-test.pdf');

const pdfParser = new PDFParser();

pdfParser.on('pdfParser_dataError', (err) => {
  console.error('[PDF Error]', err);
  process.exit(1);
});

pdfParser.on('pdfParser_dataReady', (pdfData) => {
  console.log('\n========== PDF Parsed Successfully ==========\n');
  
  pdfData.Pages.forEach((page, pageIndex) => {
    console.log(`\n--- Page ${pageIndex + 1} ---`);
    
    if (page.Texts && page.Texts.length > 0) {
      console.log(`\nText Elements: ${page.Texts.length}`);
      page.Texts.forEach((text, idx) => {
        console.log(`  [${idx}] x=${text.x}, y=${text.y}, w=${text.w}, rw=${text.rw}, rh=${text.rh}`);
      });
    }
    
    if (page.Fields && page.Fields.length > 0) {
      console.log(`\nFields: ${page.Fields.length}`);
      page.Fields.forEach((field, idx) => {
        console.log(`  [${idx}] id=${field.id.Id}, type=${field.T?.Name}, w=${field.w}, h=${field.h}, x=${field.x}, y=${field.y}`);
      });
    }
    
    if (page.Boxsets && page.Boxsets.length > 0) {
      console.log(`\nBoxsets: ${page.Boxsets.length}`);
      page.Boxsets.forEach((boxset, idx) => {
        console.log(`  [${idx}] id=${boxset.id?.Id}`);
        if (boxset.boxes) {
          boxset.boxes.forEach((box, bidx) => {
            console.log(`    Box [${bidx}]: w=${box.w}, h=${box.h}, x=${box.x}, y=${box.y}`);
          });
        }
      });
    }
  });
  
  process.exit(0);
});

pdfParser.loadPDF(pdfPath);
