const fs = require('fs');
const path = require('path');
const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");

const PDFParser = require("../dist/pdfparser.cjs");

describe('Type3 Glyph Font Tests', () => {
	let pdfParser;
	const testPdfPath = path.join(__dirname, 'pdf/misc/i389_type3_glyph.pdf');
	const outputDir = path.join(__dirname, 'target/misc');
	const jsonOutputPath = path.join(outputDir, 'i389_type3_glyph.json');
	const contentOutputPath = path.join(outputDir, 'i389_type3_glyph.content.txt');

	beforeEach(() => {
		pdfParser = new PDFParser(null, 1);
	});

	afterEach(() => {
		if (pdfParser) {
			pdfParser.destroy();
		}
	});

	it('should successfully parse Type3 glyph font PDF', { timeout: 30000 }, async () => {
		return new Promise((resolve, reject) => {
			// Set up event handlers
			pdfParser.on('pdfParser_dataError', (errData) => {
				reject(new Error(`PDF parsing failed: ${errData.parserError}`));
			});

			pdfParser.on('pdfParser_dataReady', (pdfData) => {
				try {
					// Basic structure assertions
					assert.ok(pdfData);
					assert.ok(pdfData.Pages);
					assert.strictEqual(pdfData.Pages.length, 1);
					const page = pdfData.Pages[0];
					assert.ok(page.Texts);
					assert.strictEqual(page.Texts.length, 2); // Should have both Type3 and regular text
					
					// Check for Type3 text "CONTENT"
					const type3Text = page.Texts.find(text => 
						text.R && text.R[0] && text.R[0].T === 'CONTENT'
					);
					assert.ok(type3Text);
					assert.strictEqual(type3Text.R[0].T, 'CONTENT');
					
					// Check for regular text "Added Text from Acrobat"
					const regularText = page.Texts.find(text => 
						text.R && text.R[0] && text.R[0].T === 'Added Text from Acrobat'
					);
					assert.ok(regularText);
					assert.strictEqual(regularText.R[0].T, 'Added Text from Acrobat');
					
					console.log('✓ Type3 glyph font parsing successful');
					console.log(`✓ Found Type3 text: "${type3Text.R[0].T}"`);
					console.log(`✓ Found regular text: "${regularText.R[0].T}"`);
					
					resolve();
				} catch (error) {
					reject(error);
				}
			});

			// Load and parse the PDF
			pdfParser.loadPDF(testPdfPath);
		});
	});

	it('should generate correct output files with both texts', { timeout: 30000 }, async () => {
		// Ensure output directory exists
		if (!fs.existsSync(outputDir)) {
			fs.mkdirSync(outputDir, { recursive: true });
		}

		return new Promise((resolve, reject) => {
			pdfParser.on('pdfParser_dataError', (errData) => {
				reject(new Error(`PDF parsing failed: ${errData.parserError}`));
			});

			pdfParser.on('pdfParser_dataReady', (pdfData) => {
				try {
					// Write JSON output
					const jsonOutput = JSON.stringify(pdfData, null, 2);
					fs.writeFileSync(jsonOutputPath, jsonOutput);
					
					// Write content output
					let contentOutput = '';
					pdfData.Pages.forEach((page, pageIndex) => {
						page.Texts.forEach(text => {
							if (text.R) {
								text.R.forEach(run => {
									contentOutput += run.T + '\n';
								});
							}
						});
						contentOutput += `----------------Page (${pageIndex}) Break----------------\n`;
					});
					fs.writeFileSync(contentOutputPath, contentOutput);
					
					// Verify JSON file exists and contains both texts
					assert.ok(fs.existsSync(jsonOutputPath));
					const jsonContent = fs.readFileSync(jsonOutputPath, 'utf8');
					const parsedJson = JSON.parse(jsonContent);
					
					assert.strictEqual(parsedJson.Pages[0].Texts.length, 2);
					assert.ok(jsonContent.includes('CONTENT'));
					assert.ok(jsonContent.includes('Added Text from Acrobat'));
					
					// Verify content file exists and contains both texts
					assert.ok(fs.existsSync(contentOutputPath));
					const contentFileContent = fs.readFileSync(contentOutputPath, 'utf8');
					assert.ok(contentFileContent.includes('CONTENT'));
					assert.ok(contentFileContent.includes('Added Text from Acrobat'));
					
					console.log('✓ JSON output file created successfully');
					console.log('✓ Content output file created successfully');
					console.log('✓ Both files contain expected Type3 and regular text');
					
					resolve();
				} catch (error) {
					reject(error);
				}
			});

			// Load and parse the PDF
			pdfParser.loadPDF(testPdfPath);
		});
	});

	it('should handle Type3 font metadata correctly', { timeout: 30000 }, async () => {
		return new Promise((resolve, reject) => {
			pdfParser.on('pdfParser_dataError', (errData) => {
				reject(new Error(`PDF parsing failed: ${errData.parserError}`));
			});

			pdfParser.on('pdfParser_dataReady', (pdfData) => {
				try {
					const page = pdfData.Pages[0];
					
					// Find Type3 text
					const type3Text = page.Texts.find(text => 
						text.R && text.R[0] && text.R[0].T === 'CONTENT'
					);
					
					// Verify Type3 text has proper positioning
					assert.ok(type3Text.x !== undefined);
					assert.ok(type3Text.y !== undefined);
					assert.strictEqual(typeof type3Text.x, 'number');
					assert.strictEqual(typeof type3Text.y, 'number');
					
					// Verify text run structure
					assert.ok(type3Text.R);
					assert.strictEqual(type3Text.R.length, 1);
					assert.strictEqual(type3Text.R[0].T, 'CONTENT');
					assert.ok(type3Text.R[0].S !== undefined); // Style index
					assert.ok(type3Text.R[0].TS !== undefined); // Text style array
					
					console.log('✓ Type3 font metadata validation successful');
					console.log(`✓ Type3 text position: (${type3Text.x}, ${type3Text.y})`);
					console.log(`✓ Type3 text style: S=${type3Text.R[0].S}, TS=[${type3Text.R[0].TS.join(',')}]`);
					
					resolve();
				} catch (error) {
					reject(error);
				}
			});

			// Load and parse the PDF
			pdfParser.loadPDF(testPdfPath);
		});
	});
});
