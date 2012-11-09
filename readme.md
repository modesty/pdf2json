Introduction
====
A server side PDF parser module that converts PDF binaries to JavaScript objects, which can be easily serialized to
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
                    [2,		12,		0,		0],			//46 MQZ: Changed font size from 18 tp 12
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









