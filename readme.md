Introduction
====

PDF2JSON module is ported from client side PDF.JS to Node.JS, it also extends PDF.JS library with interactive form elements and text content parsing.

The goal is to enable server side PDF parsing with interactive form elements when wrapped in web service, it also enables parsing local PDF files to JSON files when using in a commanline tool.

Install:
====
>npm install pdf2json

Example:
====
```javascript

        var nodeUtil = require("util"),
            _ = require('underscore'),
            PFParser = require("./pdf2json/pfparser");

        var pdfParser = new PFParser();

        pdfParser.on("pdfParser_dataReady", _.bind(_onPFBinDataReady, self));

        pdfParser.on("pdfParser_dataError", _.bind(_onPFBinDataError, self));

        var pdfFilePath = "data/" + taxYear + "/" + stateName + "/" + pdfId + ".pdf";

        pdfParser.loadPDF(pdfFilePath);

```

API Reference
=====

* loadPDF:

        function loadPDF(pdfFilePath);

        load PDF file from specified file path asynchroniously

        if failed, event pdfParser_dataError will be raised with error object

        when success, event pdfParser_dataReady will be raised with JavaScript data object, which can be saved as

        JSON file in test or serialized to JSON when running in web service


Output format Reference
=====

Current parsed data has four main sub objects to describe the PDF document.

* 'Agency': the main text identifier for the PDF document
* 'Id': the XML meta data that embedded in PDF document
* 'Pages': array of 'Page' object that describes each page in the PDF, including sizes, lines, fills and texts within the page. More info about 'Page' object can be found at 'Page Object Reference' section
* 'Width': the PDF page width in page unit

Page object Reference
-----

Each page object within 'Pages' array describes page elements and attributes with 5 main fields:

* 'Height': height of the page in page unit
* 'HLines': horizontal line array, each line has 'x', 'y' in relative coordinates for positioning, and 'w' for width, plus 'l' for length. Both width and length are in page unit
* 'Vline': vetical line array, each line has 'x', 'y' in relative coordinates for positioning, and 'w' for width, plus 'l' for length. Both width and length are in page unit
* 'Fills': an array of rectangular area with solid color fills, same as lines, each 'fill' object has 'x', 'y' in relative coordinates for positioning, 'w' and 'h' for width and height in page unit, plus 'clr' to reference a color with index in color dictionary. More info about 'color dictionary' can be found at 'Dictionary Reference' section.
* 'Texts': an array of text blocks with position, actual text and stylying informations:
    * 'x' and 'y': relative coordinates for positioning
    * 'clr': a color index in color dictionary, same 'clr' field as in 'Fill' object
    * 'A': text alignment, including:
        * left
        * center
        * right
    * 'R': an array of text run, each text run object has two main foelds:
        * 'T': actual text
        * 'S': style index from style dictionary. More info about 'Style Dictionary' can be found at 'Dictionary Reference' section

Dictionary Reference
-----

Same reason to having "HLines" and "VLines" array in 'Page' object, color and style dictionary will help to reduce the size of payload when transporting the parsing object over the wire.
This dictionary data contract design will allow the pageload object just reference a dictionary key (a number), rather than the actual full defintion of the color or font style.
But it does require the consumer of the payload to have the same dictionary definition to make sense out of the color and style reference.

* Color Dictionary


        var kColors = [
                '#000000',		// 0
                '#ffffff',		// 1
                '#4c4c4c',		// 2
                '#808080',		// 3
                '#999999',		// 4
                '#c0c0c0',		// 5
                '#cccccc',		// 6
                '#e5e5e5',		// 7
                '#f2f2f2',		// 8
                '#008000',		// 9
                '#00ff00',		// 10
                '#bfffa0',		// 11
                '#ffd629',		// 12
                '#ff99cc',		// 13
                '#004080',		// 14
                '#9fc0e1',		// 15
                '#5580ff',		// 16
                '#a9c9fa',		// 17
                '#ff0080',		// 18
                '#800080',		// 19
                '#ffbfff',		// 20
                '#e45b21',		// 21
                '#ffbfaa',		// 22
                '#008080',		// 23
                '#ff0000',		// 24
                '#fdc59f',		// 25
                '#808000',		// 26
                '#bfbf00',		// 27
                '#824100',		// 28
                '#007256',		// 29
                '#008000',		// 30
                '#000080',		// Last + 1
                '#008080',		// Last + 2
                '#800080',		// Last + 3
                '#ff0000',		// Last + 4
                '#0000ff',		// Last + 5
                '#008000',		// Last + 6
                '#000000'		// Last + 7
            ];


* Style Dictionary:

            var _kFontFaces = [
               "QuickType,Arial,Helvetica,sans-serif",							// 00 - QuickType - sans-serif variable font
               "QuickType Condensed,Arial Narrow,Arial,Helvetica,sans-serif",	// 01 - QuickType Condensed - thin sans-serif variable font
               "QuickTypePi",													// 02 - QuickType Pi
               "QuickType Mono,Courier New,Courier,monospace",					// 03 - QuickType Mono - san-serif fixed font
               "OCR-A,Courier New,Courier,monospace",							// 04 - OCR-A - OCR readable san-serif fixed font
               "OCR B MT,Courier New,Courier,monospace"							// 05 - OCR-B MT - OCR readable san-serif fixed font
            ];

            var _kFontStyles = [
                // Face		Size	Bold	Italic		StyleID(Comment)
                // -----	----	----	-----		-----------------
                    [0,		6,		0,		0],			//00
                    [0,		8,		0,		0],			//01
                    [0,		10,		0,		0],			//02
                    [0,		12,		0,		0],			//03
                    [0,		14,		0,		0],			//04
                    [0,		18,		0,		0],			//05
                    [0,		6,		1,		0],			//06
                    [0,		8,		1,		0],			//07
                    [0,		10,		1,		0],			//08
                    [0,		12,		1,		0],			//09
                    [0,		14,		1,		0],			//10
                    [0,		18,		1,		0],			//11
                    [0,		6,		0,		1],			//12
                    [0,		8,		0,		1],			//13
                    [0,		10,		0,		1],			//14
                    [0,		12,		0,		1],			//15
                    [0,		14,		0,		1],			//16
                    [0,		18,		0,		1],			//17
                    [0,		6,		1,		1],			//18
                    [0,		8,		1,		1],			//19
                    [0,		10,		1,		1],			//20
                    [0,		12,		1,		1],			//21
                    [0,		14,		1,		1],			//22
                    [0,		18,		1,		1],			//23
                    [1,		6,		0,		0],			//24
                    [1,		8,		0,		0],			//25
                    [1,		10,		0,		0],			//26
                    [1,		12,		0,		0],			//27
                    [1,		14,		0,		0],			//28
                    [1,		18,		0,		0],			//29
                    [1,		6,		1,		0],			//30
                    [1,		8,		1,		0],			//31
                    [1,		10,		1,		0],			//32
                    [1,		12,		1,		0],			//33
                    [1,		14,		1,		0],			//34
                    [1,		18,		1,		0],			//35
                    [1,		6,		0,		1],			//36
                    [1,		8,		0,		1],			//37
                    [1,		10,		0,		1],			//38
                    [1,		12,		0,		1],			//39
                    [1,		14,		0,		1],			//40
                    [1,		18,		0,		1],			//41
                    [2,		8,		0,		0],			//42
                    [2,		10,		0,		0],			//43
                    [2,		12,		0,		0],			//44
                    [2,		14,		0,		0],			//45
                    [2,		12,		0,		0],			//46
                    [3,		8,		0,		0],			//47
                    [3,		10,		0,		0],			//48
                    [3,		12,		0,		0],			//49
                    [4,		12,		0,		0],			//50
                    [0,		9,		0,		0],			//51
                    [0,		9,		1,		0],			//52
                    [0,		9,		0,		1],			//53
                    [0,		9,		1,		1],			//54
                    [1,		9,		0,		0],			//55
                    [1,		9,		1,		0],			//56
                    [1,		9,		1,		1],			//57
                    [4,		10,		0,		0],			//58
                    [5,		10,		0,		0],			//59
                    [5,		12,		0,		0]			//60
            ];


Interactive Forms Elements
=====

v0.1.5 added interactive forms element parsing, including text input, radio button, check box, link button and dropdown list.

Interactive forms can be created and editted in Acrobat Pro for AcroForm, or in LiveCycle Designer ES for XFA forms. Current implementation for buttons only supports "link button": when clicked, it'll launch a URL specified in button properties. Examples can be found at f1040ezt.pdf file under test/data folder.

All interactive form elements parsing output will be part of corresponding 'Page' object where they belong to, radio buttons and check boxes are in 'Boxsets' array while all other elements objects are part of 'Fields' array.

Each object with in 'Boxset' can be either checkbox or radio button, the only difference is that radio button object will have more than one element in 'boxes' array, it indicates it's a radio button group. The following sample output illustrate one checkbox ( Id: F8888 ) and one radio button group ( Id: ACC ) in the 'Boxsets' array:

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

'Fields' array contains parsed object for text input (Name: 'alpha'), dropdown list (Name: 'apha', but has 'PL' object which contains label array in 'PL.D' and value array in 'PL.V'), link button (Name: 'link', linked URL is in 'FL' field). Some examples:

Text input box example:

                {
                    style: 48,
                    T: {
                        Name: "alpha",
                        TypeInfo: { }
                    },
                    id: {
                        Id: "p1-t4[0]",
                        EN: 0
                    },
                    TI: 0,
                    x: 6.19,
                    y: 5.15,
                    w: 30.94,
                    h: 0.85
                },

Dropdown list box example:

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


Link button example:

                {
                    style: 48,
                    T: {
                        Name: "link"
                    },
                    FL: "http://www.github.com",
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

Text Input Field Formatter Types
=====

v0.1.8 added text input field formatter types detection for

* number
* ssn
* date
* zip
* phone

About 5 types are detected only when the widget field type is "Tx" and the additional-actions dictionary 'AA' is set. Like what you see, not all pre-defined formatters and special formatters are supported, if you need more support, you can extend the 'processFieldAttribute' function in core.js file.

For the supported types, the result data is set to the field item's T object. Example of a 'number' field in final JSON output:

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

Another example of 'date' field:

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


Text Style data without Style Dictionary
=====

v0.1.11 added text style information in addition to style dictionary. As we discussed earlier, the idea of style dictionary is to make the parsing result payload to be compact, but I found out the limited dictionary entries for font (face, size) and style (bold, italic) can not cover majority of text contents in PDFs, because of some styles are matched with closest dictionary entry, the client rendering will have mis-aligned, gapped or overlapped text. To solve this problem, pdf2json v0.1.11 extends the dictionary approach, all previous dictionary entries stay the same, but parsing result will not try to match to a closest style entry, instead, all exact text style will be returned in a TS filed.

When the actual text style doesn't match any pre-defined style dictionary entry, the text style ID (S filed) will be set as -1. The actual text style will be set in a new field (TS) with or without a matched style dictionary entry ID. This means, if your client renderer works with pdf2json v0.1.11 and later, style dictionary ID can be ignored. Otherwise, previous client renderer can still work with style dictionary ID.

The new TS filed is an Array with format as:

* First element in TS Array is Font Face ID (integer)
* Second element is Font Size (px)
* Third is 1 when font weight is bold, otherwise 0
* Forth is 1 when font style is italic, otherwise 0

For example, the following is a text block data in the parsing result:

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

The text is "Modesty PDF Parser NodeJS", text style dictionary entry ID is -1 (S field, meaning no match), and its Font Face ID is 0 (TS[0], "QuickType,Arial,Helvetica,sans-serif"), Font Size is 15px (TS[1]), Font weight is bold (TS[2]) and font style is normal (TS[3]).

Rotated Text Support
=====

V0.1.13 added text rotation value (degree) in the R array's object, if and only if the text rotation angle is not 0. For example, if text is not rotated, the parsed output would be the same as above. When the rotation angle is 90 degree, the R array object would be extended with "RA" field:

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


Notes
=====

PDF.JS is designed and implemented to run within browsers that have HTML5 support, it has some depencies that's only available from browser's JavaScript runtime, including:

* XHR Level 2 (for Ajax)
* DOMParser (for parsing embedded XML from PDF)
* Web Worker (to enable parsing work run in a separated thread)
* Canvas (to draw lines, fills, colors, shapes in browser)
* Others (like web fonts, canvas image, DOM manipulations, etc.)

In order to run PDF.JS in Node.js, we have to address those dependencies and also extend/modify the fork of PDF.JS. Here below are some works implemented in this pdf2json module to enable pdf.js running with node.js:

* Global Variables
    * pdf.js' global objects (like PDFJS and globalScope) need to be wrapped in a node module's scope
* API Dependencies
    * XHR Level 2: I don't need XMLHttpRequest to load PDF asynchronously in node.js, so replaced it with node's fs (File System) to load PDF file based on request parameters;
    * DOMParser: pdf.js instantiates DOMParser to parse XML based PDF meta data, I used xmldom node module to replace this browser JS library dependency. xmldom can be found at https://github.com/jindw/xmldom;
    * Web Wroker: pdf.js has "fake worker" code built in, not much works need to be done, only need to stay aware the parsing would occur in the same thread, not in background worker thread;
    * Canvas: in order to keep pdf.js code intact as much as possible, I decided to create a HTML5 Canvas API implementation in a node module. It's named as 'PDFCanvas' and has the same API as HTML5 Canvas does, so no change in pdf.js' canvas.js file, we just need to replace the browser's Canvas API with PDFCanvas. This way, when 2D context API invoked, PDFCanvas just write it to a JS object based on the JSON format above, rather than drawing graphics on html5 canvas;
* Extend/Modify PDF.JS
    * Fonts: no need to call ensureFonts to make sure fonts downloaded, only need to parse out font info in CSS font format to be used in JSON's texts array.
    * DOM: all DOM manipulation code in pdf.js are commented out, including creating canvas and div for screen rendering and font downloading purpose.
    * Interactive Forms elements: (in process to support them)
    * Leave out the support to embedded images

After the changes and extensions listed above, this pdf2json node.js module will work either in a server environment ( I have a RESTful web service built with resitify and pdf2json, it's been running on an Amazon EC2 instance) or as a standalone commanline tool (something similar to the Vows unit tests).

Known Issues
===

This pdf2json module's output does not 100% maps from PDF definitions, some of them is because of time limitation I currently have, some others result from the 'dictionary' concept for the output. Given these known issues or unsupported features in current implementation, it allows me to contribute back to the open source community with the most important features implemented while leaving some improvement space for the future. All un-supported featurs listed below can be resolved technically some way or other, if your use case really requires them:

* Embedded content:
    * All embedded content are igored, current implementation focuses on static contents and interactive forms. Un-supported PDF embedded contents includes 'Images', 'Fonts' and other dynmatic contents;
* Text and Form Styles:
    * text and form elements styles has partial support. This means when you have client side renderer (say in HTML5 canvas or SVG renderer), the PDF content may not look exactly the same as how Acrobat renders. The reason is that we've used "style dictionary" in order to reduce the payload size over the wire, while "style dictionary" doesn't have all styles defined. This sort of partial support can be resolved by extending those 'style dictionaries'. Primary text style issues include:
        * Font face: only limit to the font families defined in style dictionry
        * Font size: only limit to 6, 8, 10, 12, 14, 18 that are defined in style dictionary, all other sized font are mapped to the closest size. For example: when a PDF defines a 7px sized font, the size will be mapped to 8px in the output;
        * Color: either font color or fill colors, are limited to the entries in color dictionry
        * Style combinations: when style combination is not supported, say in different size, face, bold and italic, the closest entry will be selected in the output;
    * Note: v0.1.11 started to add support for actual font style (size, bold, itlic), but still no full support on font family;
* Text positioning and spacing:
    * Since embedd font and font styles are only honored if they defined in style dictionary, when they are not defined in there, the final output may have word positioning and spacing issues that's noticable. I also found that even with specific font style support (added in v0.1.11), because of sometimes PDF text object data stream is breaking up into multiple blocks in the middle of a word, and text position is calculated based on the font settings, we still see some word breaking and extra spaces when rendering the parsed JSON data in browser (HTML5 canvas and IE's SVG).
* User input data in form element:
    * As for interactive forms elements, their type, poisitions, sizes, limited styles and control data are all parsed and served in output, but user interactive data are not parsed, like which radio button is selected, which checkbox is checked, text in text input box, etc., should be handled in client as part of user data, so that we can treat parsed PDF data as template data.


Run Unit Test
=====

Test suite for PDF2JSON is created with Vows.js, it'll parse 3 PDF files under 'test/data' directory in parallel and have 12 test cases need to be honored.

            node test/index.js

Run As a Commandline Utility
=====

v0.1.15 added the capability to run pdf2json as command line tool, implemented in pdf2json.js file. It enables the use case that when running the parser as a web service is not absolutely necessary while transcoding local pdf files to JSON format is desired. Because in some use cases, the PDF files are relatively stable with less updates, even though parsing it in a web service, the parsing result will remain the same JSON payload. In this case, it's better to run pdf2json as a command line tool to pre-process those pdf files, and deploy the parsing result JSON files onto web server, client side JSON form renderer can work in the same way as before while eliminating server side process to achieve higher scalability.

This command line capability is added as an extension, it doesn't break previous functionalities of running winthin a web service context. In my real project, I have a web service written in restify.js to run pdf2json with a RESTful web service interface, I also have the needs to pre-process some local static pdfs through the command line capability without changing the actual pdf2json module code.

To use the command line utility to transcode a folder or a file:

            node pdf2json.js -f [input directory or pdf file]

When -f is a PDF file, it'll be converted to JSON file with the same name and saved in the same directory. If -f is a directory, it'll scan all ".pdf" files within the specified directory to transcode them one by one.

Optionally, you can specify the output directory: -o:

            node pdf2json.js -f [input directory or pdf file] -o [output directory]

The output directory must exist, otherwise, it'll exit with an error.

Additionally, you can also use -v or --version to show version number or to display more help info with -h.




