const fs = require('fs');
const path = require('path');
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

	test('should successfully parse Type3 glyph font PDF', async () => {
		return new Promise((resolve, reject) => {
			// Set up event handlers
			pdfParser.on('pdfParser_dataError', (errData) => {
				reject(new Error(`PDF parsing failed: ${errData.parserError}`));
			});

			pdfParser.on('pdfParser_dataReady', (pdfData) => {
				try {
					// Basic structure assertions
					expect(pdfData).toBeDefined();
					expect(pdfData.Pages).toBeDefined();
					expect(pdfData.Pages.length).toBe(1);
					const page = pdfData.Pages[0];
					expect(page.Texts).toBeDefined();
					expect(page.Texts.length).toBe(2); // Should have both Type3 and regular text
					
					// Check for Type3 text "CONTENT"
					const type3Text = page.Texts.find(text => 
						text.R && text.R[0] && text.R[0].T === 'CONTENT'
					);
					expect(type3Text).toBeDefined();
					expect((type3Text.R[0].T)).toBe('CONTENT');
					
					// Check for regular text "Added Text from Acrobat"
					const regularText = page.Texts.find(text => 
						text.R && text.R[0] && text.R[0].T === 'Added Text from Acrobat'
					);
					expect(regularText).toBeDefined();
					expect(regularText.R[0].T).toBe('Added Text from Acrobat');
					
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
	}, 30000); // 30 second timeout

	test('should generate correct output files with both texts', async () => {
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
					expect(fs.existsSync(jsonOutputPath)).toBe(true);
					const jsonContent = fs.readFileSync(jsonOutputPath, 'utf8');
					const parsedJson = JSON.parse(jsonContent);
					
					expect(parsedJson.Pages[0].Texts.length).toBe(2);
					expect(jsonContent).toContain('CONTENT');
					expect(jsonContent).toContain('Added Text from Acrobat');
					
					// Verify content file exists and contains both texts
					expect(fs.existsSync(contentOutputPath)).toBe(true);
					const contentFileContent = fs.readFileSync(contentOutputPath, 'utf8');
					expect(contentFileContent).toContain('CONTENT');
					expect(contentFileContent).toContain('Added Text from Acrobat');
					
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
	}, 30000); // 30 second timeout

	test('should handle Type3 font metadata correctly', async () => {
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
					expect(type3Text.x).toBeDefined();
					expect(type3Text.y).toBeDefined();
					expect(typeof type3Text.x).toBe('number');
					expect(typeof type3Text.y).toBe('number');
					
					// Verify text run structure
					expect(type3Text.R).toBeDefined();
					expect(type3Text.R.length).toBe(1);
					expect(type3Text.R[0].T).toBe('CONTENT');
					expect(type3Text.R[0].S).toBeDefined(); // Style index
					expect(type3Text.R[0].TS).toBeDefined(); // Text style array
					
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
	}, 30000); // 30 second timeout
});
