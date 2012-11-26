Introduction
====

A server side PDF parser Node.js module that converts PDF binaries to JavaScript objects, which can be easily serialized to

JSON when running in node.js based web service or web app.

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

Run Unit Test
=====

Test suite for PDF2JSON is created with Vows.js, it'll parse 3 PDF files under 'test/data' directory in parallel and have 12 test cases need to be honored.

            node test/index.js


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








