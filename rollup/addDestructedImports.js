import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Specify the directory where you want to search for pdfparser.cjs
const directoryToSearch = path.join(__dirname, '..');

// Function to search for pdfparser.cjs and update the file
function updatePdfParser(filePath) {
   // Read the content of the file
   const content = fs.readFileSync(filePath, 'utf8');

   // Check if the file contains the line we want to modify
   if (content.includes("var xmldom = require('@xmldom/xmldom');")) {
      // Add the line underneath
      const updatedContent = content.replace(
         "var xmldom = require('@xmldom/xmldom');",
         "var xmldom = require('@xmldom/xmldom');\nvar DOMParser = xmldom.DOMParser;"
      ).replace(
        "require('buffer');",
        "var { Blob } = require('buffer');"
      ).replace("const PDFJS = {};", "const PDFJS = {};\nvar Image = PDFImage")

      // Write the updated content back to the file
      fs.writeFileSync(filePath, updatedContent, 'utf8');
      console.log(`Updated ${filePath} successfully.`);
   } else {
      console.log(`File ${filePath} does not contain the required line.`);
   }
}

// Function to recursively search for pdfparser.cjs
function searchForPdfParser(directory) {
   fs.readdirSync(directory).forEach((file) => {
      const filePath = path.join(directory, file);
      if (fs.statSync(filePath).isDirectory()) {
         searchForPdfParser(filePath);
      } else if (file === 'pdfparser.cjs') {
         updatePdfParser(filePath);
      }
   });
}

// Start searching from the specified directory
searchForPdfParser(directoryToSearch);
