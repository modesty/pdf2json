# pdf2json

![GitHub stars](https://img.shields.io/github/stars/modesty/pdf2json?style=social)
![GitHub forks](https://img.shields.io/github/forks/modesty/pdf2json?style=social)
![GitHub watchers](https://img.shields.io/github/watchers/modesty/pdf2json?style=social)
![GitHub repo size](https://img.shields.io/github/repo-size/modesty/pdf2json)
![GitHub language count](https://img.shields.io/github/languages/count/modesty/pdf2json)
![GitHub top language](https://img.shields.io/github/languages/top/modesty/pdf2json)
![GitHub last commit](https://img.shields.io/github/last-commit/modesty/pdf2json?color=red)

pdf2json is a [node.js](http://nodejs.org/) module that converts binary PDF to JSON and text. Built with [pdf.js](https://github.com/mozilla/pdf.js/), it extracts text content and interactive form elements for server-side processing and command-line use.

[![Twitter Follow](https://img.shields.io/twitter/follow/modestyqz?style=social)](https://x.com/modestyqz)

## Features

- **PDF text extraction**: extracts textual content of PDF documents into structured JSON.
- **Form element handling**: parses interactive form fields within PDFs for flexible data capture.
- **Server-side and command-line versatility**: Integrate with web services for remote PDF processing or use as a standalone command-line tool for local file conversion.
- **Swift Performance**: fast performance with zero dependencies (since v3.1.6)
- **Community driven**: decade+ long community driven development ensures continuous improvement.
- **Zero dependencies**: completely dependency-free since v3.1.6, only pure JavaScript code.

## Install

> npm i pdf2json

Or, install it globally:

> npm i pdf2json -g

To update with latest version:

> npm update pdf2json -g

To Run in RESTful Web Service or as command line Utility

- More details can be found at the bottom of this document.

## Test

After install, run command line:

> npm test

`pretest` step builds bundles and source maps for both ES Module and CommonJS, output to `./dist` directory. The Jest test suit is defined in `./test/_test_.cjs` with commonJS, test run will also cover `parse-r` and `parse-fd` with ES Modules via command line.

The default Jest test suits are essential tests for all PRs. But it only covers a portion of all testing PDFs, for more broader coverage, run:

> npm run test:forms

It'll scan and parse _260_ PDF AcroForm files under _*./test/pdf*_, runs with _*-s -t -c -m*_ command line options, generates primary output JSON, additional text content JSON, form fields JSON and merged text file for each PDF. It usually takes ~20s in my MacBook Pro to complete, check _*./test/target/*_ for outputs.

_update on 4/27/2024_: parsing 260 PDFs by `npm run test:forms` on M2 Mac takes 7~8s

To run Jest test suits with commonJS bundle only

> npm run test:jest

### Test Exception Handlings

After install, run command line:

> npm run test:misc

It'll scan and parse all PDF files under _*./test/pdf/misc*_, also runs with _*-s -t -c -m*_ command line options, generates primary output JSON, additional text content JSON, form fields JSON and merged text JSON file for 15 PDF fields, 12 are expected to success while the other three's exceptions are expected to catch with stack trace for:

- _bad XRef entry_ for `pdf/misc/i200_test.pdf`
- _unsupported encryption algorithm_ for `pdf/misc/i43_encrypted.pdf`
- _Invalid XRef stream header_ for `pdf/misc/i243_problem_file_anon.pdf`

### Test Streams

After install, run command line:

> npm run parse-r

It scans 165 PDF files under _*./test/pdf/fd/form/*_, parses with [Stream API](https://nodejs.org/dist/latest-v14.x/docs/api/stream.html), then generates output to _*./test/target/fd/form/*_.

More test scripts with different command line options can be found at _*package.json*_.

### Disabling Test logs

For CI/CD, you probably would like to disable unnecessary logs for unit testing.

The code has two types of logs:

- The logs that consume the console.log and console.warn APIs;
- And the logs that consume our own base/shared/util.js log function.

To disable the first type, you could mock the console.log and console.warn APIs, but to disable the second one, you can either set the env variable `PDF2JSON_DISABLE_LOGS` to "1", passes `-s` _(silect)_ in command line, or pass in `VERBOSITY_LEVEL` to be 0 when invoking `PDFParser.loadPDF` _(ex. src/cli/p2jcli.js)_.

## Code Example

- Parse a PDF file then write to a JSON file:

```javascript
import fs from "fs";
import PDFParser from "pdf2json"; 

const pdfParser = new PDFParser();

pdfParser.on("pdfParser_dataError", (errData) =>
 console.error(errData.parserError)
);
pdfParser.on("pdfParser_dataReady", (pdfData) => {
 fs.writeFile(
  "./pdf2json/test/F1040EZ.json",
  JSON.stringify(pdfData),
  (data) => console.log(data)
 );
});

pdfParser.loadPDF("./pdf2json/test/pdf/fd/form/F1040EZ.pdf");
```

Or, call directly with buffer:

```javascript
fs.readFile(pdfFilePath, (err, pdfBuffer) => {
 if (!err) {
  pdfParser.parseBuffer(pdfBuffer);
 }
});
```

Or, use more granular page level parsing events (v2.0.0)

```javascript
pdfParser.on("readable", (meta) => console.log("PDF Metadata", meta));
pdfParser.on("data", (page) =>
 console.log(page ? "One page paged" : "All pages parsed", page)
);
pdfParser.on("error", (err) => console.error("Parser Error", err));
```

- Parse a PDF then write a .txt file (which only contains textual content of the PDF)

```javascript
import fs from "fs";
import PDFParser from "pdf2json"; 

const pdfParser = new PDFParser(this, 1);

pdfParser.on("pdfParser_dataError", (errData) =>
 console.error(errData.parserError)
);
pdfParser.on("pdfParser_dataReady", (pdfData) => {
 fs.writeFile(
  "./pdf2json/test/F1040EZ.content.txt",
  pdfParser.getRawTextContent(),
  () => {
   console.log("Done.");
  }
 );
});

pdfParser.loadPDF("./pdf2json/test/pdf/fd/form/F1040EZ.pdf");
```

- Parse a PDF then write a fields.json file that only contains interactive forms' fields information:

```javascript
import fs from "fs";
import PDFParser from "pdf2json"; 

const pdfParser = new PDFParser();

pdfParser.on("pdfParser_dataError", (errData) =>
 console.error(errData.parserError)
);
pdfParser.on("pdfParser_dataReady", (pdfData) => {
 fs.writeFile(
  "./pdf2json/test/F1040EZ.fields.json",
  JSON.stringify(pdfParser.getAllFieldsTypes()),
  () => {
   console.log("Done.");
  }
 );
});

pdfParser.loadPDF("./pdf2json/test/pdf/fd/form/F1040EZ.pdf");
```

Alternatively, you can pipe input and output streams: (requires v1.1.4)

```javascript
import fs from "fs";
import PDFParser from "pdf2json";

const inputStream = fs.createReadStream(
 "./pdf2json/test/pdf/fd/form/F1040EZ.pdf",
 { bufferSize: 64 * 1024 }
);
const outputStream = fs.createWriteStream(
 "./pdf2json/test/target/fd/form/F1040EZ.json"
);

inputStream
 .pipe(new PDFParser())
 .pipe(new StringifyStream())
 .pipe(outputStream);
```

With v2.0.0, last line above changes to

```javascript
inputStream
 .pipe(this.pdfParser.createParserStream())
 .pipe(new StringifyStream())
 .pipe(outputStream);
```

For additional output streams support:

```javascript
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
```

Note, if primary JSON parsing has exceptions, none of additional stream will be processed.
See [p2jcmd.js](https://github.com/modesty/pdf2json/blob/master/lib/p2jcmd.js) for more details.

## API Reference

- events:

  - pdfParser_dataError: will be raised when parsing failed
  - pdfParser_dataReady: when parsing succeeded

- alternative events: (v2.0.0)

  - readable: first event dispatched after PDF file metadata is parsed and before processing any page
  - data: one parsed page succeeded, null means last page has been processed, single end of data stream
  - error: exception or error occurred

- start to parse PDF file from specified file path asynchronously:

```javascript
        function loadPDF(pdfFilePath);
```

If failed, event "pdfParser_dataError" will be raised with error object: {"parserError": errObj};
If success, event "pdfParser_dataReady" will be raised with output data object: {"formImage": parseOutput}, which can be saved as json file (in command line) or serialized to json when running in web service. **note**: "formImage" is removed from v2.0.0, see breaking changes for details.

- Get all textual content from "pdfParser_dataReady" event handler:

```javascript
        function getRawTextContent();
```

returns text in string.

- Get all input fields information from "pdfParser_dataReady" event handler:

```javascript
        function getAllFieldsTypes();
```

returns an array of field objects.

## Output format Reference

Current parsed data has four main sub objects to describe the PDF document.

- 'Transcoder': pdf2json version number
- 'Agency': the main text identifier for the PDF document. If Id.AgencyId present, it'll be same, otherwise it'll be set as document title; (_deprecated since v2.0.0, see notes below_)
- 'Id': the XML meta data that embedded in PDF document (_deprecated since v2.0.0, see notes below_)

  - all forms attributes metadata are defined in "Custom" tab of "Document Properties" dialog in Acrobat Pro;
  - v0.1.22 added support for the following custom properties:
    - AgencyId: default "unknown";
    - Name: default "unknown";
    - MC: default false;
    - Max: default -1;
    - Parent: parent name, default "unknown";
  - _*v2.0.0*_: 'Agency' and 'Id' are replaced with full metadata, example: for `./test/pdf/fd/form/F1040.pdf`, full metadata is:

```javascript
Meta: {
 PDFFormatVersion: '1.7',
 IsAcroFormPresent: true,
 IsXFAPresent: false,
 Author: 'SE:W:CAR:MP',
 Subject: 'U.S. Individual Income Tax Return',
 Creator: 'Adobe Acrobat Pro 10.1.8',
 Producer: 'Adobe Acrobat Pro 10.1.8',
 CreationDate: "D:20131203133943-08'00'",
 ModDate: "D:20140131180702-08'00'",
 Metadata: {
  'xmp:modifydate': '2014-01-31T18:07:02-08:00',
  'xmp:createdate': '2013-12-03T13:39:43-08:00',
  'xmp:metadatadate': '2014-01-31T18:07:02-08:00',
  'xmp:creatortool': 'Adobe Acrobat Pro 10.1.8',
  'dc:format': 'application/pdf',
  'dc:description': 'U.S. Individual Income Tax Return',
  'dc:creator': 'SE:W:CAR:MP',
  'xmpmm:documentid': 'uuid:4d81e082-7ef2-4df7-b07b-8190e5d3eadf',
  'xmpmm:instanceid': 'uuid:7ea96d1c-3d2f-284a-a469-f0f284a093de',
  'pdf:producer': 'Adobe Acrobat Pro 10.1.8',
  'adhocwf:state': '1',
  'adhocwf:version': '1.1'
 }
}
```

- 'Pages': array of 'Page' object that describes each page in the PDF, including sizes, lines, fills and texts within the page. More info about 'Page' object can be found at 'Page Object Reference' section
- 'Width': the PDF page width in page unit

### Page object Reference

Each page object within 'Pages' array describes page elements and attributes with 5 main fields:

- 'Height': height of the page in page unit
- 'Width': width of the page in page unit, moved from root to page object in v2.0.0
- 'HLines': horizontal line array, each line has 'x', 'y' in relative coordinates for positioning, and 'w' for width, plus 'l' for length. Both width and length are in page unit
- 'Vline': vertical line array, each line has 'x', 'y' in relative coordinates for positioning, and 'w' for width, plus 'l' for length. Both width and length are in page unit;
  - v0.4.3 added Line color support. Default is 'black', other wise set in 'clr' if found in color dictionary, or 'oc' field if not found in dictionary;
  - v0.4.4 added dashed line support. Default is 'solid', if line style is dashed line, {dsh:1} is added to line object;
- 'Fills': an array of rectangular area with solid color fills, same as lines, each 'fill' object has 'x', 'y' in relative coordinates for positioning, 'w' and 'h' for width and height in page unit, plus 'clr' to reference a color with index in color dictionary. More info about 'color dictionary' can be found at 'Dictionary Reference' section.
- 'Texts': an array of text blocks with position, actual text and styling information:
  - 'x' and 'y': relative coordinates for positioning
  - 'clr': a color index in color dictionary, same 'clr' field as in 'Fill' object. If a color can't be found in color dictionary, 'oc' field will be added to the field as 'original color" value.
  - 'A': text alignment, including:
    - left
    - center
    - right
  - 'R': an array of text run, each text run object has two main fields:
    - 'T': actual text
    - 'S': style index from style dictionary. More info about 'Style Dictionary' can be found at 'Dictionary Reference' section
    - 'TS': [fontFaceId, fontSize, 1/0 for bold, 1/0 for italic]

v0.4.5 added support when fields attributes information is defined in external xml file. pdf2json will always try load field attributes xml file based on file name convention (pdfFileName.pdf's field XML file must be named pdfFileName_fieldInfo.xml in the same directory). If found, fields info will be injected.

### Dictionary Reference

Same reason to having "HLines" and "VLines" array in 'Page' object, color and style dictionary will help to reduce the size of payload when transporting the parsing object over the wire.
This dictionary data contract design will allow the output just reference a dictionary key , rather than the actual full definition of color or font style.
It does require the client of the payload to have the same dictionary definition to make sense out of it when render the parser output on to screen.

- Color Dictionary

```javascript
const kColors = [
 "#000000", // 0
 "#ffffff", // 1
 "#4c4c4c", // 2
 "#808080", // 3
 "#999999", // 4
 "#c0c0c0", // 5
 "#cccccc", // 6
 "#e5e5e5", // 7
 "#f2f2f2", // 8
 "#008000", // 9
 "#00ff00", // 10
 "#bfffa0", // 11
 "#ffd629", // 12
 "#ff99cc", // 13
 "#004080", // 14
 "#9fc0e1", // 15
 "#5580ff", // 16
 "#a9c9fa", // 17
 "#ff0080", // 18
 "#800080", // 19
 "#ffbfff", // 20
 "#e45b21", // 21
 "#ffbfaa", // 22
 "#008080", // 23
 "#ff0000", // 24
 "#fdc59f", // 25
 "#808000", // 26
 "#bfbf00", // 27
 "#824100", // 28
 "#007256", // 29
 "#008000", // 30
 "#000080", // Last + 1
 "#008080", // Last + 2
 "#800080", // Last + 3
 "#ff0000", // Last + 4
 "#0000ff", // Last + 5
 "#008000", // Last + 6
 "#000000", // Last + 7
];
```

- Style Dictionary:

```javascript
const kFontFaces = [
 "QuickType,Arial,Helvetica,sans-serif", // 00 - QuickType - sans-serif variable font
 "QuickType Condensed,Arial Narrow,Arial,Helvetica,sans-serif", // 01 - QuickType Condensed - thin sans-serif variable font
 "QuickTypePi", // 02 - QuickType Pi
 "QuickType Mono,Courier New,Courier,monospace", // 03 - QuickType Mono - san-serif fixed font
 "OCR-A,Courier New,Courier,monospace", // 04 - OCR-A - OCR readable san-serif fixed font
 "OCR B MT,Courier New,Courier,monospace", // 05 - OCR-B MT - OCR readable san-serif fixed font
];

const kFontStyles = [
 // Face  Size Bold Italic  StyleID(Comment)
 // ----- ---- ---- -----  -----------------
 [0, 6, 0, 0], //00
 [0, 8, 0, 0], //01
 [0, 10, 0, 0], //02
 [0, 12, 0, 0], //03
 [0, 14, 0, 0], //04
 [0, 18, 0, 0], //05
 [0, 6, 1, 0], //06
 [0, 8, 1, 0], //07
 [0, 10, 1, 0], //08
 [0, 12, 1, 0], //09
 [0, 14, 1, 0], //10
 [0, 18, 1, 0], //11
 [0, 6, 0, 1], //12
 [0, 8, 0, 1], //13
 [0, 10, 0, 1], //14
 [0, 12, 0, 1], //15
 [0, 14, 0, 1], //16
 [0, 18, 0, 1], //17
 [0, 6, 1, 1], //18
 [0, 8, 1, 1], //19
 [0, 10, 1, 1], //20
 [0, 12, 1, 1], //21
 [0, 14, 1, 1], //22
 [0, 18, 1, 1], //23
 [1, 6, 0, 0], //24
 [1, 8, 0, 0], //25
 [1, 10, 0, 0], //26
 [1, 12, 0, 0], //27
 [1, 14, 0, 0], //28
 [1, 18, 0, 0], //29
 [1, 6, 1, 0], //30
 [1, 8, 1, 0], //31
 [1, 10, 1, 0], //32
 [1, 12, 1, 0], //33
 [1, 14, 1, 0], //34
 [1, 18, 1, 0], //35
 [1, 6, 0, 1], //36
 [1, 8, 0, 1], //37
 [1, 10, 0, 1], //38
 [1, 12, 0, 1], //39
 [1, 14, 0, 1], //40
 [1, 18, 0, 1], //41
 [2, 8, 0, 0], //42
 [2, 10, 0, 0], //43
 [2, 12, 0, 0], //44
 [2, 14, 0, 0], //45
 [2, 12, 0, 0], //46
 [3, 8, 0, 0], //47
 [3, 10, 0, 0], //48
 [3, 12, 0, 0], //49
 [4, 12, 0, 0], //50
 [0, 9, 0, 0], //51
 [0, 9, 1, 0], //52
 [0, 9, 0, 1], //53
 [0, 9, 1, 1], //54
 [1, 9, 0, 0], //55
 [1, 9, 1, 0], //56
 [1, 9, 1, 1], //57
 [4, 10, 0, 0], //58
 [5, 10, 0, 0], //59
 [5, 12, 0, 0], //60
];
```

v2.0.0: to access these dictionary programactically, do either

```javascript
import { kColors, kFontFaces, kFontStyles } from "./lib/pdfconst.js"; // <-- pre 3.1.0
import { kColors, kFontFaces, kFontStyles } from "pdf2json"; // <-- since 3.1.0
```

or via public static getters of PDFParser:

```javascript
console.dir(PDFParser.colorDict);
console.dir(PDFParser.fontFaceDict);
console.dir(PDFParser.fontStyleDict);
```

## Interactive Forms Elements

v0.1.5 added interactive forms element parsing, including text input, radio button, check box, link button and drop down list.

Interactive forms can be created and edited in Acrobat Pro for AcroForm, or in LiveCycle Designer ES for XFA forms. Current implementation for buttons only supports "link button": when clicked, it'll launch a URL specified in button properties. Examples can be found at f1040ezt.pdf file under test/data folder.

All interactive form elements parsing output will be part of corresponding 'Page' object where they belong to, radio buttons and check boxes are in 'Boxsets' array while all other elements objects are part of 'Fields' array.

Each object with in 'Boxset' can be either checkbox or radio button, the only difference is that radio button object will have more than one element in 'boxes' array, it indicates it's a radio button group. The following sample output illustrate one checkbox ( Id: F8888 ) and one radio button group ( Id: ACC ) in the 'Boxsets' array:

```Javascript
Boxsets: [
{//first element, check box
 boxes: [ //only one box object object in this array
 {
  x: 47,
  y: 40,
  w: 3,
  h: 1,
  style: 48,
  TI: 39,
  AM: 4,
  id: {
   Id: "F8888",
  },
  T: {
   Name: "box"
  }
  }
  ],
  id: {
  Id: "A446",
  }
},//end of first element
{//second element, radio button group
 boxes: [// has two box elements in boxes array
 {
  x: 54,
  y: 41,
  w: 3,
  h: 1,
  style: 48,
  TI: 43,
  AM: 132,
  id: {
   Id: "ACCC",
  },
  T: {
   Name: "box"
  }
 },
 {
  x: 67,
  y: 41,
  w: 3,
  h: 1,
  style: 48,
  TI: 44,
  AM: 132,
  id: {
   Id: "ACCS",
   EN: 0
  },
  T: {
   Name: "box"
  }
 }
 ],
 id: {
  Id: "ACC",
  EN: 0
 }
}//end of second element
] //end of Boxsets array
```

'Fields' array contains parsed object for text input (Name: 'alpha'), drop down list (Name: 'apha', but has 'PL' object which contains label array in 'PL.D' and value array in 'PL.V'), link button (Name: 'link', linked URL is in 'FL.form.Id' field). Some examples:

Text input box example:

```javascript
{
 style: 48,
 T: {
  Name: "alpha",
  TypeInfo: { }
 },
 id: {
  Id: "p1_t40",
  EN: 0
 },
 TU: "alternative text", //for accessibility, added only when available from PDF stream. (v0.3.6).
 TI: 0,
 x: 6.19,
 y: 5.15,
 w: 30.94,
 h: 0.85,
 V: "field value" //only available when the text input box has value
},
```

Note: v0.7.0 extends TU (Alternative Text) to all interactive fields to better support accessibility.

Drop down list box example:

```javascript
{
 x: 60,
 y: 11,
 w: 4,
 h: 1,
 style: 48,
 TI: 13,
 AM: 388,
 mxL: 2,
 id: {
  Id: "ST",
  EN: 0
 },
 T: {
  Name: "alpha",
  TypeInfo: {
  }
 },
 PL: {
  V: [
   "",
   "AL",
   "AK"
  ],
  D: [
  "%28no%20entry%29",
  "Alabama",
  "Alaska"
  ]
 }
}
```

Link button example:

```javascript
{
 style: 48,
 T: {
  Name: "link"
 },
 FL: {form: {Id:"http://www.github.com"},
 id: {
  Id: "quad8",
  EN: 0
 },
 TI: 0,
 x: 52.35,
 y: 28.35,
 w: 8.88,
 h: 0.85
}
```

v0.2.2 added support for "field attribute mask", it'd be common for all fields, form author can set it in Acrobat Pro's Form Editing mode: if a field is ReadOnly, it's AM field will be set as 0x00000400, otherwise AM will be set as 0.

Another supported field attributes is "required": when form author mark a field is "required" in Acrobat, the parsing result for 'AM' will be set as 0x00000010.

"Read-Only" filed attribute mask example:

```favascript
{
 style: 48,
 T: {
  Name: "alpha",
  TypeInfo: { }
 },
 id: {
  Id: "p1_t40",
  EN: 0
 },
 TI: 0,
 AM: 1024, //If (AM & 0x00000400) set, it indicates this is a read-only filed
 x: 6.19,
 y: 5.15,
 w: 30.94,
 h: 0.85
}
```

v2.X.X added support for the signature form element (Name: 'signature'). If the field has been signed, the 'Sig' property will be present, and will contain any of the following signature details if available:

- 'Name' - Signer's name
- 'M' - Time of signing in [ISO 8601](https://en.wikipedia.org/wiki/ISO_8601) format
- 'Location' - Location of signing
- 'Reason' - Reason for signing
- 'ContactInfo' - Signer's contact information

Signature example:

```javascript
{
 style: 48,
 T: {
  Name: "signature",
  TypeInfo: {}
 },
 id: {
  Id: "SignatureFormField_1",
  EN: 0
 },
 TI: 0,
 AM: 16,
 x: 5.506,
 y: 31.394,
 w: 14.367,
 h: 4.241,
 Sig: {
  Name: "Signer Name",
  M: "2022-03-15T19:17:34-04:00"
 }
}
```

## Text Input Field Formatter Types

v0.1.8 added text input field formatter types detection for

- number
- ssn
- date (tested date formatter: mm/dd/yyyy, mm/dd, mm/yyyy and Custom yyyy)
- zip
- phone
- percent (added v0.5.6)

v0.3.9 added "arbitrary mask" (in "special" format category) support, the input field format type is "mask" and the mask string is added as "MV", its value can be found at Format => Special => Arbitrary Mask in Acrobat;
Some examples of "mask" format including:

- 9999: 4 digit PIN field
- 99999: 5 digit PIN field
- 99-9999999: formatted 9 digit EIN number
- 999999999: 9 digit routing number
- aaa: 3 letters input

Additionally, the "arbitrary mask" length is extended from 1 characters to 64 characters. And when the mask has only one character, it has the following meanings:

- a: alphabet only input, no numeric input allowed
- n: numeric only input, no locale based number formatting, no alphabet or special characters allowed
- d: numeric only input, with locale based number formatting, one decimal point allowed, no rounding expected and no alphabet or special characters allowed
- -: negative number only, with locale based number formatting, no alphabet or special characters allowed
- +: positive number only, with locale based number formatting, no alphabet or special characters allowed

v0.4.1 added more date format detection, these formats are set in Acrobat's field's Properties => Format => Date => Custom:

- yyyy: 4 digit year

Types above are detected only when the widget field type is "Tx" and the additional-actions dictionary 'AA' is set. Like what you see, not all pre-defined formatters and special formatters are supported, if you need more support, you can extend the 'processFieldAttribute' function in core.js file.

For the supported types, the result data is set to the field item's T object. Example of a 'number' field in final json output:

```javascript
{
 style: 48,
 T: {
  Name: "number",
  TypeInfo: { }
 },
 id: {
  Id: "FAGI",
  EN: 0
 },
 TI: 0,
 x: 68.35,
 y: 22.43,
 w: 21.77,
 h: 1.08
},
```

Another example of 'date' field:

```javascript
{
 style: 48,
 T: {
  Name: "date",
  TypeInfo: { }
 },
 id: {
  Id: "Your Birth Date",
  EN: 0
 },
 TI: 0,
 x: 33.43,
 y: 20.78,
 w: 5.99,
 h: 0.89
},
```

## Text Style data without Style Dictionary

v0.1.11 added text style information in addition to style dictionary. As we discussed earlier, the idea of style dictionary is to make the parsing result payload to be compact, but I found out the limited dictionary entries for font (face, size) and style (bold, italic) can not cover majority of text contents in PDFs, because of some styles are matched with closest dictionary entry, the client rendering will have mis-aligned, gapped or overlapped text. To solve this problem, pdf2json v0.1.11 extends the dictionary approach, all previous dictionary entries stay the same, but parsing result will not try to match to a closest style entry, instead, all exact text style will be returned in a TS filed.

When the actual text style doesn't match any pre-defined style dictionary entry, the text style ID (S filed) will be set as -1. The actual text style will be set in a new field (TS) with or without a matched style dictionary entry ID. This means, if your client renderer works with pdf2json v0.1.11 and later, style dictionary ID can be ignored. Otherwise, previous client renderer can still work with style dictionary ID.

The new TS filed is an Array with format as:

- First element in TS Array is Font Face ID (integer)
- Second element is Font Size (px)
- Third is 1 when font weight is bold, otherwise 0
- Forth is 1 when font style is italic, otherwise 0

For example, the following is a text block data in the parsing result:

```javascript
{
 x: 7.11,
 y: 2.47,
 w: 1.6,
 clr: 0,
 A: "left",
 R: [
  {
   T: "Modesty%20PDF%20Parser%20NodeJS",
   S: -1,
   TS: [0, 15, 1, 0]
  }
 ]
},
```

The text is "Modesty PDF Parser NodeJS", text style dictionary entry ID is -1 (S field, meaning no match), and its Font Face ID is 0 (TS[0], "QuickType,Arial,Helvetica,sans-serif"), Font Size is 15px (TS[1]), Font weight is bold (TS[2]) and font style is normal (TS[3]).

Note: (v0.3.7) When a color is not in style dictionary, "clr" value will be set to -1. Item's (fills and text) original color in hex string format will be added to "oc" field. In other word, "oc" only exists if and only if "clr" is -1;

## Rotated Text Support

V0.1.13 added text rotation value (degree) in the R array's object, if and only if the text rotation angle is not 0. For example, if text is not rotated, the parsed output would be the same as above. When the rotation angle is 90 degree, the R array object would be extended with "RA" field:

```javascript
{
 x: 7.11,
 y: 2.47,
 w: 1.6,
 clr: 0,
 A: "left",
 R: [
  {
   T: "Modesty%20PDF%20Parser%20NodeJS",
   S: -1,
   TS: [0, 15, 1, 0],
   RA: 90
  }
 ]
},
```

## Notes

pdf.js is designed and implemented to run within browsers that have HTML5 support, it has some dependencies that's only available from browser's JavaScript runtime, including:

- XHR Level 2 (for Ajax)
- DOMParser (for parsing embedded XML from PDF)
- Web Worker (to enable parsing work run in a separated thread)
- Canvas (to draw lines, fills, colors, shapes in browser)
- Others (like web fonts, canvas image, DOM manipulations, etc.)

In order to run pdf.js in Node.js, we have to address those dependencies and also extend/modify the fork of pdf.js. Here below are some works implemented in this pdf2json module to enable pdf.js running with Node.js:

- Global Variables
  - pdf.js' global objects (like PDFJS and globalScope) need to be wrapped in a node module's scope
- API Dependencies
  - XHR Level 2: I don't need XMLHttpRequest to load PDF asynchronously in node.js, so replaced it with node's fs (File System) to load PDF file based on request parameters;
  - DOMParser: pdf.js instantiates DOMParser to parse XML based PDF meta data, I used xmldom node module to replace this browser JS library dependency. xmldom can be found at <https://github.com/xmldom/xmldom>;
  - Web Worker: pdf.js has "fake worker" code built in, not much works need to be done, only need to stay aware the parsing would occur in the same thread, not in background worker thread;
  - Canvas: in order to keep pdf.js code intact as much as possible, I decided to create a HTML5 Canvas API implementation in a node module. It's named as 'PDFCanvas' and has the same API as HTML5 Canvas does, so no change in pdf.js' canvas.js file, we just need to replace the browser's Canvas API with PDFCanvas. This way, when 2D context API invoked, PDFCanvas just write it to a JS object based on the json format above, rather than drawing graphics on html5 canvas;
- Extend/Modify pdf.js
  - Fonts: no need to call ensureFonts to make sure fonts downloaded, only need to parse out font info in CSS font format to be used in json's texts array.
  - DOM: all DOM manipulation code in pdf.js are commented out, including creating canvas and div for screen rendering and font downloading purpose.
  - Interactive Forms elements: (in process to support them)
  - Leave out the support to embedded images

After the changes and extensions listed above, this pdf2json node.js module will work either in a server environment ( I have a RESTful web service built with resitify and pdf2json, it's been running on an Amazon EC2 instance) or as a standalone command line tool (something similar to the Vows unit tests).

More porting notes can be found at [Porting and Extending PDFJS to NodeJS](http://www.codeproject.com/Articles/568136/Porting-and-Extending-PDFJS-to-NodeJS).

## Known Issues

This pdf2json module's output does not 100% maps from PDF definitions, some of them is because of time limitation I currently have, some others result from the 'dictionary' concept for the output. Given these known issues or unsupported features in current implementation, it allows me to contribute back to the open source community with the most important features implemented while leaving some improvement space for the future. All un-supported features listed below can be resolved technically some way or other, if your use case really requires them:

- Embedded content:
  - All embedded content are igored, current implementation focuses on static contents and interactive forms. Un-supported PDF embedded contents includes 'Images', 'Fonts' and other dynamic contents;
- Text and Form Styles:
  - text and form elements styles has partial support. This means when you have client side renderer (say in HTML5 canvas or SVG renderer), the PDF content may not look exactly the same as how Acrobat renders. The reason is that we've used "style dictionary" in order to reduce the payload size over the wire, while "style dictionary" doesn't have all styles defined. This sort of partial support can be resolved by extending those 'style dictionaries'. Primary text style issues include:
    - Font face: only limit to the font families defined in style dictionary
    - Font size: only limit to 6, 8, 10, 12, 14, 18 that are defined in style dictionary, all other sized font are mapped to the closest size. For example: when a PDF defines a 7px sized font, the size will be mapped to 8px in the output;
    - Color: either font color or fill colors, are limited to the entries in color dictionary
    - Style combinations: when style combination is not supported, say in different size, face, bold and italic, the closest entry will be selected in the output;
  - Note: v0.1.11 started to add support for actual font style (size, bold, italic), but still no full support on font family;
- Text positioning and spacing:
  - Since embedded font and font styles are only honored if they defined in style dictionary, when they are not defined in there, the final output may have word positioning and spacing issues that's noticeable. I also found that even with specific font style support (added in v0.1.11), because of sometimes PDF text object data stream is breaking up into multiple blocks in the middle of a word, and text position is calculated based on the font settings, we still see some word breaking and extra spaces when rendering the parsed json data in browser (HTML5 canvas and IE's SVG).
- User input data in form element:
  - As for interactive forms elements, their type, positions, sizes, limited styles and control data are all parsed and served in output, but user interactive data are not parsed, including radio button selection, checkbox status, text input box value, etc., these values should be handled in client renderer as part of user data, so that we can treat parsed PDF data as form template.

## Run As a Commandline Utility

v0.1.15 added the capability to run pdf2json as command line tool. It enables the use case that when running the parser as a web service is not absolutely necessary while transcoding local pdf files to json format is desired. Because in some use cases, the PDF files are relatively stable with less updates, even though parsing it in a web service, the parsing result will remain the same json payload. In this case, it's better to run pdf2json as a command line tool to pre-process those pdf files, and deploy the parsing result json files onto web server, client side form renderer can work in the same way as before while eliminating server side process to achieve higher scalability.

This command line utility is added as an extension, it doesn't break previous functionalities of running with a web service context. In my real project, I have a web service written in [restify.js to run pdf2json with a RESTful web service interface](https://github.com/modesty/p2jsvc), I also have the needs to pre-process some local static pdfs through the command line tool without changing the actual pdf2json module code.

To use the command line utility to transcode a folder or a file:

```javascript
node pdf2json.js -f [input directory or pdf file]
```

When -f is a PDF file, it'll be converted to json file with the same name and saved in the same directory. If -f is a directory, it'll scan all ".pdf" files within the specified directory to transcode them one by one.

Optionally, you can specify the output directory: -o:

```javascript
node pdf2json.js -f [input directory or pdf file] -o [output directory]
```

The output directory must exist, otherwise, it'll exit with an error.

Additionally, you can also use -v or --version to show version number or to display more help info with -h.

### Note

v0.2.1 added the ability to run pdf2json directly from the command line without specifying "node" and the path of pdf2json. To run this self-executable in command line, first install pdf2json globally:

```javascript
npm install pdf2json -g
```

Then run it in command line:

```javascript
pdf2json -f [input directory or pdf file]
```

or

```javascript
pdf2json -f [input directory or pdf file] -o [output directory]
```

v0.5.4 added "-s" or "--silent" command line argument to suppress informative logging output. When using pdf2json as a command line tool, the default verbosity is 5 (INFOS). While when running as a web service, default verbosity is 9 (ERRORS).
Examples to suppress logging info from command line:

```javascript
pdf2json -f [input directory or pdf file] -o [output directory] -s
```

or

```javascript
pdf2json -f [input directory or pdf file] -o [output directory] --silent
```

Examples to turn on logging info in web service:

```javascript
var pdfParser = new PFParser();
...
pdfParser.loadPDF(pdfFilePath, 5);
```

v0.5.7 added the capability to skip input PDF files if filename begins with any one of "!@#$%^&\*()+=[]\\\';,/{}|\":<>?~`.-\_ ", usually these files are created by PDF authoring tools as backup files.

v0.6.2 added "-t" command line argument to generate fields json file in addition to parsed json. The fields json file will contain one Array which contains fieldInfo object for each field, and each fieldInfo object will have 4 fields:

- id: field ID
- type: string name of field type, like radio, alpha, etc
- calc: true if read only, otherwise false
- value: initial value of the field

Example of fields.json content:

```javascript
[
 {"id":"ADDRCH","type":"alpha","calc":false,"value":"user input data"},
 {"id":"FSRB","type":"radio","calc":false,"value":"Single"},
 {"id":"APPROVED","type":"alpha","calc":true,"value":"Approved Form"}
...
]
```

The fields.json output can be used to validate fields IDs with other data source, and/or to extract data value from user submitted PDFs.

v0.6.8 added "-c" or "--content" command line argument to extract raw text content from PDF. It'll be a separated output file named as (pdf_file_name).content.txt.
If all you need is the textual content of the PDF, "-c" essentially converts PDF to text, of cause, all formatting and styling will be lost.

## Run Unit Test (commandline)

It takes less than 1 minutes for pdf2json to parse 261 PDFs under `test/pdf` directory. Usually, it takes about 40 seconds or so to parses all of them. Besides the primary JSON for each PDF, it also generates text content JSON and form fields JSON file (by `-c` and `-t` parameters) for further testing.

The 265 PDFs are all fill-able tax forms from government agencies for tax year 2013, including 165 federal forms, 23 efile instructions and 9 other state tax forms.

Shell script is current driver for unit test. To parse one agency's PDFs, run the command line:

```terminal
 cd test
 sh p2f.one.sh [2_character_agency_name]
```

For example, to parse and generate all 165 federal forms together with text content and forms fields:

```terminal
 cd test
 sh p2f.one.sh fd
```

To parse and generate all VA forms together with text content and forms fields:

```terminal
 cd test
 sh p2f.one.sh va
```

Additionally, to parse all 261 PDFs from commandline:

```terminal
 cd test
 sh p2f.forms.sh
```

Or, from `npm scripts`:

```terminal
 npm test
```

Some testing PDFs are provided by bug reporters, like the "unsupported encryption" ([#43](https://github.com/modesty/pdf2json/issues/43)), "read property num from undefined" ([#26](https://github.com/modesty/pdf2json/issues/26)), and "excessive line breaks in text content" ([#28](https://github.com/modesty/pdf2json/issues/28)), their PDFs are all stored in `test/pdf/misc` directory. To run tests against these community contributed PDFs, run commandline:

```terminal
 npm run-script test-misc
```

## Upgrade to ~v1.x.x

If you have an early version of pdf2json, please remove your local `node_modules` directory and re-run `npm install` to upgrade to <pdf2json@1.0.x>.

v1.x.x upgraded dependency packages, removed some unnecessary dependencies, started to assumes ES6 / ES2015 with node ~v4.x. More PDFs are added for unit testing.

**Note:**
pdf2json has been in production for over 3 years, it's pretty reliable and solid when parsing hundreds (sometimes tens of thousands) of PDF forms every day, thanks to everybody's help.

Starting v1.0.3, I'm trying to address a long over due annoying problem on [broken text blocks](https://github.com/modesty/pdf2json/issues/18). It's the biggest problem that hinders the efficiency of PDF content creation in our projects. Although the root cause lies in the original PDF streams, since the client doesn't render JSON character by character, it's a problem often appears in final rendered web content. We had to work around it by manually merge those text blocks. With the solution in v1.0.x, the need for manual text block merging is greatly reduced.

The solution is to put to a post-parsing process stage to identify and auto-merge those adjacent blocks. It's not ideal, but works in most of my tests with those 261 PDFs underneath test directory.

The auto merge solution still needs some fine tuning, I keep it as an experimental feature for now, it's off by default, can be turned on by "-m" switch in command line.

In order to support this auto merging capability, text block objects have an additional "sw" (space width of the font) property together with x, y, clr and R. If you have a more effective usage of this new property for merging text blocks, please drop me a line.

**Breaking Changes:**

- v1.1.4 unified event data structure: **only when you handle these top level events, no change if you use commandline**

  - event "pdfParser_dataError": {"parserError": errObj}
  - event "pdfParser_dataReady": {"formImage": parseOutput} **note**: "formImage" is removed from v2.0.0, see breaking changes for details.

- v1.0.8 fixed [issue 27](https://github.com/modesty/pdf2json/issues/27), it converts x coordinate with the same ratio as y, which is 24 (96/4), rather than 8.7 (96/11), please adjust client renderer accordingly when position all elements' x coordinate.

- v2.0.0 output data field, `Agency` and `Id` are replaced with `Meta`, JSON of the PDF's full metadata. (See above for details). Each page object also added `Width` property besides `Height`.

- v3.0.0 converted commonJS to ES Modules, plus dependency update and other minor bug fixes. Please update your project configuration file to enable ES Module before upgrade, ex., in `tsconfig.json`, set `"compilerOptions":{"module":"ESNext"}`

## Major Refactoring

- v2.0.0 has the major refactoring since 2015. Primary updates including:
  - Full PDF metadata support (see page format and breaking changes for details)
  - Simplify root properties, besides the addition of `Meta` as root property, unnecessary "formImage" is removed from v2.0.0, also `Width` is move from root to each page object under `Pages`.
  - Improved Stream support with test _`npm run parse-r`_, plus new events are added to PDF.js, including _`readable`_, _`data`_, _`end`_, _`error`_. These new Readable Stream like events can be optional replacement for customed events (_`pdfjs_parseDataReady`_, and _`pdfjs_parseDataError`_). It offers more granular data chunk flow control, like _`readable`_ with Meta, _`data`_ sequence for each PDF page result, instead of _`pdfjs_parseDataReady`_ combines all pages in one shot. See `./lib/parserstream.js` for more details
  - Object with {clr:-1} (like HLines, VLines, Fills, etc.) is replaced with {oc: "#xxxxxx"}. If `clr` index value is valid, then `oc` (original color) field is removed.
  - Greater performance, near ~20% improvements with PDFs under _test_ directory
  - Better exception handling, fixes a few uncaught exception errors
  - More test coverage, 4 more test scripts added, see _package.json_ for details
  - Easier access to dictionaries, including color, font face and font style, see Dictionary reference section for details
  - Refactor to ES6 class for major entry modules
  - Dependencies removed: lodash, async and yargs
  - Upgrade to Node v14.18.0 LTSs
- v3.0.0 converted commonJS to ES Modules
  - v3.1.0 added build step to output both ES Module and CommonJS bundles
    - `PDFParser` is no longer the default export, it's a named export that requires changes to import statement.
    - test is written in Jest
    - PR will require GitHub work flow check, currently is `npm ci` and `npm test`

### Install on Ubuntu

- Make sure nodejs is installed. Detailed installation steps can be found at <http://stackoverflow.com/a/16303380/433814>.

```terminal
$ nodejs --version
v0.10.22
```

- Create a symbolic link from node to nodejs

```terminal
sudo rm -f /usr/sbin/node
sudo ln -s /usr/bin/nodejs /usr/sbin/node
```

- Verify the version of node and installation

```terminal
$ which node
/usr/sbin/node

$ node --version
v4.5.0
```

- Proceed with the install of pdf2json as described above

```terminal
$ npm install -g pdf2json
npm http GET https://registry.npmjs.org/pdf2json
npm http 304 https://registry.npmjs.org/pdf2json
/usr/bin/pdf2json -> /usr/lib/node_modules/pdf2json/bin/pdf2json
pdf2json@0.6.1 /usr/lib/node_modules/pdf2json

$ which pdf2json
/usr/bin/pdf2json

$ pdf2json --version
0.6.2
```

## Run in a RESTful Web Service

More info can be found at [Restful Web Service for pdf2json.](https://github.com/modesty/p2jsvc)

## Contribution

Participating in this project, you are expected to honor [open code of conduct](https://www.contributor-covenant.org/).

## License

Licensed under the [Apache License Version 2.0](https://github.com/modesty/pdf2json/blob/scratch/quadf-forms/license.txt).

## Support

I'm currently running this project in my spare time. Thanks all for your [stars](https://github.com/modesty/pdf2json/stargazers) and [supports](https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=modestyZ%40gmail%2ecom&lc=GB&item_name=modesty%20zhang&item_number=git%40github%2ecom%3amodesty%2fpdf2json%2egit&currency_code=USD&bn=PP%2dDonationsBF%3abtn_donate_SM%2egif%3aNonHosted).

[![Twitter Follow](https://img.shields.io/twitter/follow/modestyqz?style=social)](https://x.com/modestyqz)
