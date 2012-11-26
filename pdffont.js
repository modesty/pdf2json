var nodeUtil = require("util"),
    _ = require("underscore"),
    PDFUnit = require('./pdfunit.js');

var PDFFont = (function PFPFontClosure() {
    'use strict';
    // private static
    var _nextId = 1;
    var _name = 'PDFFont';

    var _boldSubNames = ["bd", "bold", "demi"];

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


    // constructor
    var cls = function (fontObj) {
        // private
        var _id = _nextId++;

        // public (every instance will have their own copy of these methods, needs to be lightweight)
        this.get_id = function() { return _id; };
        this.get_name = function() { return _name + _id; };

        this.fontObj = fontObj;
        this.fontSize = 1;

        this.faceIdx = 0;
        this.bold = false;
        this.italic = false;
        this.faceName = null;
        this.faceSubName = null;

        this.fontStyleId = -1;
    };

    // public static
    cls.get_nextId = function () {
        return _name + _nextId;
    };

    var _setFaceIndex = function() {
        var fontObj = this.fontObj;

        this.bold = fontObj.bold;
        var typeName = fontObj.name || fontObj.fallbackName;
        var nameArray = typeName.split('+');
        if (_.isArray(nameArray) && nameArray.length > 1) {
            typeName = nameArray[1].split("-");
            if (_.isArray(typeName) && typeName.length > 1) {
                if (!this.bold) {
                    var subName = typeName[1].toLowerCase();
                    this.bold = _boldSubNames.indexOf(subName) >= 0;
                    this.faceSubName = subName;
                }
                typeName = typeName[0];
            }
        }
        this.faceName = typeName;

        if (fontObj.isSerifFont) {
            if (_kFontFaces[1].indexOf(typeName) >= 0)
                this.faceIdx = 1;
        }
        else if (fontObj.isMonospace) {
            this.faceIdx = 3;

            if (_kFontFaces[4].indexOf(typeName) >= 0)
                this.faceIdx = 4;
            else if (_kFontFaces[5].indexOf(typeName) >= 0)
                this.faceIdx = 5;
        }
        else if (fontObj.isSymbolicFont) {
            this.faceIdx = 2;
        }

//        nodeUtil._logN.call(this, "faceIdx = " + this.faceIdx);
    };

    var _getFontStyleIndex = function(fontSize) {
        _setFaceIndex.call(this);

        this.fontSize = fontSize;
        var fsa = [this.faceIdx, this.fontSize, this.bold?1:0, this.italic?1:0];
        var retVal = -1;

        _.each(_kFontStyles, function(element, index, list){
            if (retVal === -1) {
                if (element[0] === fsa[0] && element[1] === fsa[1] &&
                    element[2] === fsa[2] && element[3] === fsa[3]) {
                        retVal = index;
                }
            }
        });

        if (retVal === -1) {
            _.each(_kFontStyles, function(element, index, list){
                if (retVal === -1) {
                    if (element[0] === fsa[0] &&
                        element[2] === fsa[2] && element[3] === fsa[3]) {
                        if (element[1] >= fsa[1]) {
                            retVal = index;
                        }
                    }
                }
            });
        }

        if (retVal === -1) {
            retVal = 2;
        }

        return retVal;
    };

    var _processSymbolicFont = function(str) {
        if (!this.fontObj.isSymbolicFont)
            return str;

        if (!str || str.length !== 2)
            return str;

        var retVal = "G";
        switch(str.charCodeAt(1)) {
            case 99: retVal = 'C'; break; //up triangle
            case 97: retVal = 'G'; break; //right triangle
            case 20: retVal = 'M'; break; //check mark
            default:
                retVal = "";
                nodeUtil._logN.call(this, "Default - SymbolicFont - (" + this.fontObj.name + ") : " + str.charCodeAt(1) + " => " + retVal);
        }

        return retVal;
    };

    // public (every instance will share the same method, but has no access to private fields defined in constructor)
    cls.prototype.processText = function (p, str, maxWidth, color, fontSize, targetData) {
//        nodeUtil._logN.call(this, "processText - " + JSON.stringify(p) + ", str = " + str + ", maxWidth = " + maxWidth);

        this.fontStyleId = _getFontStyleIndex.call(this, fontSize);
        var text = _processSymbolicFont.call(this, str);

        var oneText = {x: PDFUnit.toFormX(p.x) - 0.25,
            y: PDFUnit.toFormY(p.y) - 0.75,
            w: PDFUnit.toFormX(maxWidth),
            clr: PDFUnit.findColorIndex(color),
            A: "left",
            R: [{
                T: text,
                S: this.fontStyleId
            }]
        };

        targetData.Texts.push(oneText);
    };

    cls.prototype.clean = function() {
        this.fontObj = null;
        delete this.fontObj;
    };

    return cls;
})();

module.exports = PDFFont;

