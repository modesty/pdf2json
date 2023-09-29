'use strict';

var fs = require('fs');
var nodeUtil = require('util');
var promises = require('fs/promises');
var events = require('events');
var path = require('path');
var url = require('url');
var { Blob } = require('buffer');
var xmldom = require('@xmldom/xmldom');
var DOMParser = xmldom.DOMParser;
var stream = require('stream');

var _documentCurrentScript = typeof document !== 'undefined' ? document.currentScript : null;
const kColors = [
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
    '#008000'		// Last + 6
];

const kFontFaces = [
    "quicktype,arial,helvetica,sans-serif",							// 00 - QuickType - sans-serif variable font
    "quicktype condensed,arial narrow,arial,helvetica,sans-serif",	// 01 - QuickType Condensed - thin sans-serif variable font
    "quicktypepi,quicktypeiipi",									// 02 - QuickType Pi
    "quicktype mono,courier new,courier,monospace",					// 03 - QuickType Mono - san-serif fixed font
    "ocr-a,courier new,courier,monospace",							// 04 - OCR-A - OCR readable san-serif fixed font
    "ocr b mt,courier new,courier,monospace"						// 05 - OCR-B MT - OCR readable san-serif fixed font
 ];

 const kFontStyles = [
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
        [2,		18,		0,		0],			//46
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

const dpi = 96.0;
const gridXPerInch = 4.0;
const gridYPerInch = 4.0;

const _pixelXPerGrid = dpi/gridXPerInch;
const _pixelYPerGrid = dpi/gridYPerInch;
const _pixelPerPoint = dpi/72;
    
class PDFUnit {
    static toFixedFloat(fNum) {
        return parseFloat(fNum.toFixed(3));
    }

    static colorCount() {
        return kColors.length;
    }

    static toPixelX(formX) {
        return Math.round(formX * _pixelXPerGrid);
    }

    static toPixelY(formY) {
        return Math.round(formY * _pixelYPerGrid);
    }

    static pointToPixel(point) {// Point unit (1/72 an inch) to pixel units
        return point * _pixelPerPoint;
    }

    static getColorByIndex(clrId) {
        return kColors[clrId];
    }

    static toFormPoint(viewportX, viewportY) {
        return [(viewportX / _pixelXPerGrid), (viewportY / _pixelYPerGrid)];
    }

    static toFormX(viewportX) {
        return PDFUnit.toFixedFloat(viewportX / _pixelXPerGrid);
    }

    static toFormY(viewportY) {
        return PDFUnit.toFixedFloat(viewportY / _pixelYPerGrid);
    }

    static findColorIndex(color) {
        if (color.length === 4)
            color += "000";
        //MQZ. 07/29/2013: if color is not in dictionary, just return -1. The caller (pdffont, pdffill) will set the actual color
        return kColors.indexOf(color);
    }

    static dateToIso8601(date) {
        // PDF spec p.160
        if (date.slice(0, 2) === 'D:') { // D: prefix is optional
            date = date.slice(2);
        }
        let tz = 'Z';
        let idx = date.search(/[Z+-]/); // timezone is optional
        if (idx >= 0) {
            tz = date.slice(idx);
            if (tz !== 'Z') { // timezone format OHH'mm'
                tz = tz.slice(0, 3) + ':' + tz.slice(4, 6);
            }
            date = date.slice(0, idx);
        }
        let yr = date.slice(0, 4); // everything after year is optional
        let mth = date.slice(4, 6) || '01';
        let day = date.slice(6, 8) || '01';
        let hr = date.slice(8, 10) || '00';
        let min = date.slice(10, 12) || '00';
        let sec = date.slice(12, 14) || '00';
        return yr + '-' + mth + '-' + day + 'T' + hr + ':' + min + ':' + sec + tz;
    }
}

class PDFLine {
    constructor(x1, y1, x2, y2, lineWidth, color, dashed) {
        this.x1 = x1;
        this.y1 = y1;
        this.x2 = x2;
        this.y2 = y2;
        this.lineWidth = lineWidth || 1.0;
        this.color = color;
        this.dashed = dashed;
    }

    #setStartPoint(oneLine, x, y) {
        oneLine.x = PDFUnit.toFormX(x);
        oneLine.y = PDFUnit.toFormY(y);
    }

    processLine(targetData) {
        const xDelta = Math.abs(this.x2 - this.x1);
        const yDelta = Math.abs(this.y2 - this.y1);
        const minDelta = this.lineWidth;

        let oneLine = {x:0, y:0, w: PDFUnit.toFixedFloat(this.lineWidth), l:0};

        //MQZ Aug.28.2013, adding color support, using color dictionary and default to black
        const clrId = PDFUnit.findColorIndex(this.color);
        const colorObj = (clrId > 0 && clrId < PDFUnit.colorCount()) ? {clr: clrId} : {oc: this.color};
        oneLine = {...oneLine, ...colorObj};

        //MQZ Aug.29 dashed line support
        if (this.dashed) {
            oneLine = oneLine = {...oneLine, dsh: 1};
        }

        if ((yDelta < this.lineWidth) && (xDelta > minDelta)) { //HLine
            if (this.lineWidth < 4 && (xDelta / this.lineWidth < 4)) {
                nodeUtil.p2jinfo("Skipped: short thick HLine: lineWidth = " + this.lineWidth + ", xDelta = " + xDelta);
                return; //skip short thick lines, like PA SPP lines behinds checkbox
            }

            oneLine.l = PDFUnit.toFormX(xDelta);
            if (this.x1 > this.x2)
                this.#setStartPoint(oneLine, this.x2, this.y2);
            else
                this.#setStartPoint(oneLine, this.x1, this.y1);
            targetData.HLines.push(oneLine);
        }
        else if ((xDelta < this.lineWidth) && (yDelta > minDelta)) {//VLine
            if (this.lineWidth < 4 && (yDelta / this.lineWidth < 4)) {
                nodeUtil.p2jinfo("Skipped: short thick VLine: lineWidth = " + this.lineWidth + ", yDelta = " + yDelta);
                return; //skip short think lines, like PA SPP lines behinds checkbox
            }

            oneLine.l = PDFUnit.toFormY(yDelta);
            if (this.y1 > this.y2)
                this.#setStartPoint(oneLine, this.x2, this.y2);
            else
                this.#setStartPoint(oneLine, this.x1, this.y1);
            targetData.VLines.push(oneLine);
        }
    }
}

class PDFFill{
    // constructor
    constructor(x, y, width, height, color) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.color = color;
    }

    processFill(targetData) {
        //MQZ.07/29/2013: when color is not in color dictionary, set the original color (oc)
        const clrId = PDFUnit.findColorIndex(this.color);
        const colorObj = (clrId > 0 && clrId < PDFUnit.colorCount()) ? {clr: clrId} : {oc: this.color};

        const oneFill = {x:PDFUnit.toFormX(this.x),
                       y:PDFUnit.toFormY(this.y),
                       w:PDFUnit.toFormX(this.width),
                       h:PDFUnit.toFormY(this.height),
                       ...colorObj};

        
        if (oneFill.w < 2 && oneFill.h < 2) {
            nodeUtil.p2jinfo("Skipped: tiny fill: " + oneFill.w + " x " + oneFill.h);
            return; //skip short thick lines, like PA SPP lines behinds checkbox
        }

        targetData.Fills.push(oneFill);
    }
}

const _boldSubNames = ['bd', 'bold', 'demi', 'black'];
const _stdFonts = [
   'arial',
   'helvetica',
   'sans-serif ',
   'courier ',
   'monospace ',
   'ocr ',
];
const DISTANCE_DELTA = 0.1;

class PDFFont {
   #initTypeName() {
      let typeName = this.fontObj.name || this.fontObj.fallbackName;
      if (!typeName) {
         typeName = kFontFaces[0]; //default font family name
      }
      typeName = typeName.toLowerCase();
      return typeName;
   }

   #initSubType() {
      let subType = this.typeName;
      let bold = false;

      let nameArray = this.typeName.split('+');
      if (Array.isArray(nameArray) && nameArray.length > 1) {
         subType = nameArray[1].split('-');
         if (Array.isArray(subType) && subType.length > 1) {
            let subName = subType[1].toLowerCase();
            bold = _boldSubNames.indexOf(subName) >= 0;
            subType = subType[0];
         }
      }
      return { subType, bold };
   }

   #initSymbol() {
      let isSymbol =
         this.typeName.indexOf('symbol') > 0 ||
         kFontFaces[2].indexOf(this.subType) >= 0;
      if (this.fontObj.isSymbolicFont) {
         let mFonts = _stdFonts.filter(
            (oneName) => this.typeName.indexOf(oneName) >= 0
         );

         if (mFonts.length > 0) {
            this.fontObj.isSymbolicFont = false; //lots of Arial-based font is detected as symbol in VA forms (301, 76-c, etc.) reset the flag for now
            nodeUtil.p2jinfo(
               'Reset: isSymbolicFont (false) for ' + this.fontObj.name
            );
         }
      } else {
         if (isSymbol) {
            this.fontObj.isSymbolicFont = true; //text pdf: va_ind_760c
            nodeUtil.p2jinfo(
               'Reset: isSymbolicFont (true) for ' + this.fontObj.name
            );
         }
      }
      return isSymbol;
   }

   #initSpaceWidth() {
      let spaceWidth = this.fontObj.spaceWidth;
      if (!spaceWidth) {
         var spaceId = Array.isArray(this.fontObj.toFontChar)
            ? this.fontObj.toFontChar.indexOf(32)
            : -1;
         spaceWidth =
            spaceId >= 0 && Array.isArray(this.fontObj.widths)
               ? this.fontObj.widths[spaceId]
               : 250;
      }
      spaceWidth = PDFUnit.toFormX(spaceWidth) / 32;
      return spaceWidth;
   }

   // constructor
   constructor(fontObj) {
      this.fontObj = fontObj;

      this.typeName = this.#initTypeName();

      const { subType, bold } = this.#initSubType();
      this.subType = subType;
      this.bold = bold;

      this.isSymbol = this.#initSymbol();
      this.spaceWidth = this.#initSpaceWidth();

      this.fontSize = 1;
      this.faceIdx = 0;
      this.italic = false;
      this.fontStyleId = -1;
   }

   /** sort text blocks by y then x */
   static compareBlockPos(t1, t2) {
      if (t1.y < t2.y - DISTANCE_DELTA) {
         return -1;
      }
      if (Math.abs(t1.y - t2.y) <= DISTANCE_DELTA) {
         if (t1.x < t2.x - DISTANCE_DELTA) {
            return -1;
         }
         if (Math.abs(t1.x - t2.x) <= DISTANCE_DELTA) {
            return 0;
         }
      }
      return 1;
   }

   static haveSameStyle(t1, t2) {
      let retVal = t1.R[0].S === t2.R[0].S;
      if (retVal && t1.R[0].S < 0) {
         for (let i = 0; i < t1.R[0].TS.length; i++) {
            if (t1.R[0].TS[i] !== t2.R[0].TS[i]) {
               retVal = false;
               break;
            }
         }
      }
      if (retVal) {
         // make sure both block are not rotated
         retVal =
            typeof t1.R[0].RA === 'undefined' &&
            typeof t2.R[0].RA === 'undefined';
      }

      return retVal;
   }

   static getSpaceThreshHold(t1) {
      return (PDFFont.getFontSize(t1) / 12) * t1.sw;
   }

   static areAdjacentBlocks(t1, t2) {
      const isInSameLine = Math.abs(t1.y - t2.y) <= DISTANCE_DELTA;
      const isDistanceSmallerThanASpace =
         t2.x - t1.x - t1.w < PDFFont.getSpaceThreshHold(t1);

      return isInSameLine && isDistanceSmallerThanASpace;
   }

   static getFontSize(textBlock) {
      const sId = textBlock.R[0].S;
      return sId < 0 ? textBlock.R[0].TS[1] : kFontStyles[sId][1];
   }

   static areDuplicateBlocks(t1, t2) {
      return (
         t1.x == t2.x &&
         t1.y == t2.y &&
         t1.R[0].T == t2.R[0].T &&
         PDFFont.haveSameStyle(t1, t2)
      );
   }

   // private
   #setFaceIndex() {
      const fontObj = this.fontObj;

      this.bold = fontObj.bold;
      if (!this.bold) {
         this.bold =
            this.typeName.indexOf('bold') >= 0 ||
            this.typeName.indexOf('black') >= 0;
      }
      this.italic = fontObj.italic; // fix https://github.com/modesty/pdf2json/issues/42
      // Extended the fix for https://github.com/modesty/pdf2json/issues/42
      if (!this.italic) {
         this.italic =
            this.typeName.indexOf('italic') >= 0 ||
            this.typeName.indexOf('oblique') >= 0;
      }
      // Added detection of hybrid dual bolditalic fonts
      if (
         (!this.bold || !this.italic) &&
         this.typeName.indexOf('boldobl') >= 0
      ) {
         this.bold = true;
         this.italic = true;
      }

      let typeName = this.subType;
      if (fontObj.isSerifFont) {
         if (kFontFaces[1].indexOf(typeName) >= 0) this.faceIdx = 1;
      } else if (kFontFaces[2].indexOf(this.subType) >= 0) {
         this.faceIdx = 2;
      } else if (fontObj.isMonospace) {
         this.faceIdx = 3;

         if (kFontFaces[4].indexOf(typeName) >= 0) this.faceIdx = 4;
         else if (kFontFaces[5].indexOf(typeName) >= 0) this.faceIdx = 5;
      } else if (fontObj.isSymbolicFont) {
         this.faceIdx = 2;
      }

      if (this.faceIdx == 0) {
         if (this.typeName.indexOf('narrow') > 0) this.faceIdx = 1;
      }

      //        nodeUtil.p2jinfo"typeName = " + typeName + " => faceIdx = " + this.faceIdx);
   }

   #getFontStyleIndex(fontSize) {
      this.#setFaceIndex();

      //MQZ Feb.28.2013. Adjust bold text fontsize to work around word spacing issue
      this.fontSize = this.bold && fontSize > 12 ? fontSize + 1 : fontSize;

      let fsa = [
         this.faceIdx,
         this.fontSize,
         this.bold ? 1 : 0,
         this.italic ? 1 : 0,
      ];
      let retVal = -1;

      kFontStyles.forEach(function (element, index, list) {
         if (retVal === -1) {
            if (
               element[0] === fsa[0] &&
               element[1] === fsa[1] &&
               element[2] === fsa[2] &&
               element[3] === fsa[3]
            ) {
               retVal = index;
            }
         }
      });

      return retVal;
   }

   #processSymbolicFont(str) {
      let retVal = str;

      if (!str || str.length !== 1) return retVal;

      if (!this.fontObj.isSymbolicFont || !this.isSymbol) {
         if (retVal == 'C' || retVal == 'G') {
            //prevent symbolic encoding from the client
            retVal = ' ' + retVal + ' '; //sample: va_ind_760c
         }
         return retVal;
      }

      switch (str.charCodeAt(0)) {
         case 20:
            retVal = '\u2713';
            break; //check mark
         case 70:
            retVal = this.fontObj.type === 'CIDFontType0' ? '\u26A0' : '\u007D';
            break; //exclaimation in triangle OR right curly bracket
         case 71:
            retVal = '\u25b6';
            break; //right triangle
         case 97:
            retVal = '\u25b6';
            break; //right triangle
         case 99:
            retVal = this.isSymbol ? '\u2022' : '\u25b2';
            break; //up triangle. set to Bullet Dot for VA SchSCR
         case 100:
            retVal = '\u25bc';
            break; //down triangle
         case 103:
            retVal = '\u27A8';
            break; //right arrow. sample: va_ind_760pff and pmt
         case 106:
            retVal = '';
            break; //VA 301: string j character by the checkbox, hide it for now
         case 114:
            retVal = '\u2022';
            break; //Bullet dot
         case 115:
            retVal = '\u25b2';
            break; //up triangle
         case 116:
            retVal = '\u2022';
            break; //Bullet dot
         case 118:
            retVal = '\u2022';
            break; //Bullet dot
         default:
            nodeUtil.p2jinfo(
               this.fontObj.type +
                  ' - SymbolicFont - (' +
                  this.fontObj.name +
                  ') : ' +
                  str.charCodeAt(0) +
                  '::' +
                  str.charCodeAt(1) +
                  ' => ' +
                  retVal
            );
      }

      return retVal;
   }

   #textRotationAngle(matrix2D) {
      let retVal = 0;
      if (matrix2D[0][0] === 0 && matrix2D[1][1] === 0) {
         if (matrix2D[0][1] != 0 && matrix2D[1][0] != 0) {
            if (matrix2D[0][1] / matrix2D[1][0] + 1 < 0.0001) retVal = 90;
         }
      } else if (matrix2D[0][0] !== 0 && matrix2D[1][1] !== 0) {
         let r1 = Math.atan(-matrix2D[0][1] / matrix2D[0][0]);
         let r2 = Math.atan(matrix2D[1][0] / matrix2D[1][1]);
         if (Math.abs(r1) > 0.0001 && r1 - r2 < 0.0001) {
            retVal = (r1 * 180) / Math.PI;
         }
      }
      return retVal;
   }

   // public instance methods
   processText(p, str, maxWidth, color, fontSize, targetData, matrix2D) {
      const text = this.#processSymbolicFont(str);
      if (!text) {
         return;
      }
      this.fontStyleId = this.#getFontStyleIndex(fontSize);

      // when this.fontStyleId === -1, it means the text style doesn't match any entry in the dictionary
      // adding TS to better describe text style [fontFaceId, fontSize, 1/0 for bold, 1/0 for italic];
      const TS = [
         this.faceIdx,
         this.fontSize,
         this.bold ? 1 : 0,
         this.italic ? 1 : 0,
      ];

      const clrId = PDFUnit.findColorIndex(color);
      const colorObj =
         clrId >= 0 && clrId < PDFUnit.colorCount()
            ? { clr: clrId }
            : { oc: color };

      let textRun = {
         T: this.flash_encode(text),
         S: this.fontStyleId,
         TS: TS,
      };
      const rAngle = this.#textRotationAngle(matrix2D);
      if (rAngle != 0) {
         nodeUtil.p2jinfo(str + ': rotated ' + rAngle + ' degree.');
         textRun = { ...textRun, RA: rAngle };
      }

      const oneText = {
         x: PDFUnit.toFormX(p.x) - 0.25,
         y: PDFUnit.toFormY(p.y) - 0.75,
         w: PDFUnit.toFixedFloat(maxWidth),
         ...colorObj, //MQZ.07/29/2013: when color is not in color dictionary, set the original color (oc)
         sw: this.spaceWidth, //font space width, use to merge adjacent text blocks
         A: 'left',
         R: [textRun],
      };

      targetData.Texts.push(oneText);
   }

   flash_encode(str) {
      let retVal = encodeURIComponent(str);
      retVal = retVal.replace('%C2%96', '-');
      retVal = retVal.replace('%C2%91', '%27');
      retVal = retVal.replace('%C2%92', '%27');
      retVal = retVal.replace('%C2%82', '%27');
      retVal = retVal.replace('%C2%93', '%22');
      retVal = retVal.replace('%C2%94', '%22');
      retVal = retVal.replace('%C2%84', '%22');
      retVal = retVal.replace('%C2%8B', '%C2%AB');
      retVal = retVal.replace('%C2%9B', '%C2%BB');

      return retVal;
   }

   clean() {
      this.fontObj = null;
      delete this.fontObj;
   }
}

// alias some functions to make (compiled) code shorter
const { round: mr, sin: ms, cos: mc, abs, sqrt } = Math;

// precompute "00" to "FF"
const dec2hex = [];
for (let i = 0; i < 16; i++) {
   for (let j = 0; j < 16; j++) {
      dec2hex[i * 16 + j] = i.toString(16) + j.toString(16);
   }
}

function createMatrixIdentity() {
   return [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
   ];
}

function matrixMultiply(m1, m2) {
   let result = createMatrixIdentity();

   for (let x = 0; x < 3; x++) {
      for (let y = 0; y < 3; y++) {
         let sum = 0;

         for (let z = 0; z < 3; z++) {
            sum += m1[x][z] * m2[z][y];
         }

         result[x][y] = sum;
      }
   }
   return result;
}

function copyState(o1, o2) {
   o2.fillStyle = o1.fillStyle;
   o2.lineCap = o1.lineCap;
   o2.lineJoin = o1.lineJoin;
   o2.lineWidth = o1.lineWidth;
   o2.miterLimit = o1.miterLimit;
   o2.shadowBlur = o1.shadowBlur;
   o2.shadowColor = o1.shadowColor;
   o2.shadowOffsetX = o1.shadowOffsetX;
   o2.shadowOffsetY = o1.shadowOffsetY;
   o2.strokeStyle = o1.strokeStyle;
   o2.globalAlpha = o1.globalAlpha;
   o2.arcScaleX_ = o1.arcScaleX_;
   o2.arcScaleY_ = o1.arcScaleY_;
   o2.lineScale_ = o1.lineScale_;
   o2.dashArray = o1.dashArray;
}

function processStyle(styleString) {
   let str,
      alpha = 1;

   styleString = String(styleString);
   if (styleString.substring(0, 3) == 'rgb') {
      let start = styleString.indexOf('(', 3);
      let end = styleString.indexOf(')', start + 1);
      let guts = styleString.substring(start + 1, end).split(',');

      str = '#';
      for (let i = 0; i < 3; i++) {
         str += dec2hex[Number(guts[i])];
      }

      if (guts.length == 4 && styleString.substring(3, 4) == 'a') {
         alpha = guts[3];
      }
   } else {
      str = styleString;
   }

   return { color: str, alpha: alpha };
}

function processLineCap(lineCap) {
   switch (lineCap) {
      case 'butt':
         return 'flat';
      case 'round':
         return 'round';
      case 'square':
      default:
         return 'square';
   }
}

// Helper function that takes the already fixed cordinates.
function bezierCurveToHelper(self, cp1, cp2, p) {
   self.currentPath_.push({
      type: 'bezierCurveTo',
      cp1x: cp1.x,
      cp1y: cp1.y,
      cp2x: cp2.x,
      cp2y: cp2.y,
      x: p.x,
      y: p.y,
   });
   self.currentX_ = p.x;
   self.currentY_ = p.y;
}

function matrixIsFinite(m) {
   for (let j = 0; j < 3; j++) {
      for (let k = 0; k < 2; k++) {
         if (!isFinite(m[j][k]) || isNaN(m[j][k])) {
            return false;
         }
      }
   }
   return true;
}

function setM(ctx, m, updateLineScale) {
   if (!matrixIsFinite(m)) {
      return;
   }
   ctx.m_ = m;

   if (updateLineScale) {
      // Get the line scale.
      // Determinant of this.m_ means how much the area is enlarged by the
      // transformation. So its square root can be used as a scale factor
      // for width.
      let det = m[0][0] * m[1][1] - m[0][1] * m[1][0];
      ctx.lineScale_ = sqrt(abs(det));
   }
}

class CanvasPattern_ {
   constructor() {}
}

// Gradient / Pattern Stubs
class CanvasGradient_ {
   constructor(aType) {
      this.type_ = aType;
      this.x0_ = 0;
      this.y0_ = 0;
      this.r0_ = 0;
      this.x1_ = 0;
      this.y1_ = 0;
      this.r1_ = 0;
      this.colors_ = [];
   }
   addColorStop(aOffset, aColor) {
      aColor = processStyle(aColor);
      this.colors_.push({
         offset: aOffset,
         color: aColor.color,
         alpha: aColor.alpha,
      });
   }
}

/**
 * This class implements CanvasRenderingContext2D interface as described by
 * the WHATWG.
 * @param {HTMLElement} surfaceElement The element that the 2D context should
 * be associated with
 */
class CanvasRenderingContext2D_ {
   constructor(canvasTarget, scaledWidth, scaledHeight) {
      this.m_ = createMatrixIdentity();

      this.mStack_ = [];
      this.aStack_ = [];
      this.currentPath_ = [];

      // Canvas context properties
      this.strokeStyle = '#000';
      this.fillStyle = '#000';

      this.lineWidth = 1;
      this.lineJoin = 'miter';
      this.lineCap = 'butt';
      this.dashArray = [];
      this.miterLimit = 1;
      this.globalAlpha = 1;

      if (!('HLines' in canvasTarget) || !Array.isArray(canvasTarget.HLines))
         canvasTarget.HLines = [];
      if (!('VLines' in canvasTarget) || !Array.isArray(canvasTarget.VLines))
         canvasTarget.VLines = [];
      if (!('Fills' in canvasTarget) || !Array.isArray(canvasTarget.Fills))
         canvasTarget.Fills = [];
      if (!('Texts' in canvasTarget) || !Array.isArray(canvasTarget.Texts))
         canvasTarget.Texts = [];

      this.canvas = canvasTarget;

      this.width = scaledWidth;
      this.height = scaledHeight;

      this.arcScaleX_ = 1;
      this.arcScaleY_ = 1;
      this.lineScale_ = 1;

      this.currentFont = null;
   }

   //private helper methods
   #drawPDFLine(p1, p2, lineWidth, color) {
      let dashedLine =
         Array.isArray(this.dashArray) && this.dashArray.length > 1;
      let pL = new PDFLine(
         p1.x,
         p1.y,
         p2.x,
         p2.y,
         lineWidth,
         color,
         dashedLine
      );
      pL.processLine(this.canvas);
   }

   #drawPDFFill(cp, min, max, color) {
      let width = max.x - min.x;
      let height = max.y - min.y;
      let pF = new PDFFill(cp.x, cp.y, width, height, color);
      pF.processFill(this.canvas);
   }

   #needRemoveRect(x, y, w, h) {
      let retVal = Math.abs(w - Math.abs(h)) < 1 && w < 13;
      if (retVal) {
         nodeUtil.p2jinfo('Skipped: tiny rect: w=' + w + ', h=' + h);
      }
      return retVal;
   }

   getContext(ctxType) {
      return ctxType === '2d' ? this : null;
   }

   setLineDash(lineDash) {
      this.dashArray = lineDash;
   }

   getLineDash() {
      return this.dashArray;
   }

   fillText(text, x, y, maxWidth, fontSize) {
      if (!text || (!text.length === 1 && text.trim().length < 1)) return;
      let p = this.getCoords_(x, y);

      let a = processStyle(this.fillStyle || this.strokeStyle);
      let color = !!a ? a.color : '#000000';

      this.currentFont.processText(
         p,
         text,
         maxWidth,
         color,
         fontSize,
         this.canvas,
         this.m_
      );
   }

   strokeText(text, x, y, maxWidth) {
      //MQZ. 10/23/2012, yeah, no hollow text for now
      this.fillText(text, x, y, maxWidth);
   }

   measureText(text) {
      console.warn('to be implemented: contextPrototype.measureText - ', text);
      let chars = text.length || 1;
      return { width: chars * (this.currentFont.spaceWidth || 5) };
   }

   setFont(fontObj) {
      if (!!this.currentFont && typeof this.currentFont.clean === 'function') {
         this.currentFont.clean();
         this.currentFont = null;
      }

      this.currentFont = new PDFFont(fontObj);
   }

   clearRect() {
      console.warn('to be implemented: contextPrototype.clearRect');
   }

   beginPath() {
      // TODO: Branch current matrix so that save/restore has no effect
      //       as per safari docs.
      this.currentPath_ = [];
   }

   moveTo(aX, aY) {
      let p = this.getCoords_(aX, aY);
      this.currentPath_.push({ type: 'moveTo', x: p.x, y: p.y });
      this.currentX_ = p.x;
      this.currentY_ = p.y;
   }

   lineTo(aX, aY) {
      let p = this.getCoords_(aX, aY);
      this.currentPath_.push({ type: 'lineTo', x: p.x, y: p.y });

      this.currentX_ = p.x;
      this.currentY_ = p.y;
   }

   bezierCurveTo(aCP1x, aCP1y, aCP2x, aCP2y, aX, aY) {
      let p = this.getCoords_(aX, aY);
      let cp1 = this.getCoords_(aCP1x, aCP1y);
      let cp2 = this.getCoords_(aCP2x, aCP2y);
      bezierCurveToHelper(this, cp1, cp2, p);
   }

   quadraticCurveTo(aCPx, aCPy, aX, aY) {
      // the following is lifted almost directly from
      // http://developer.mozilla.org/en/docs/Canvas_tutorial:Drawing_shapes

      let cp = this.getCoords_(aCPx, aCPy);
      let p = this.getCoords_(aX, aY);

      let cp1 = {
         x: this.currentX_ + (2.0 / 3.0) * (cp.x - this.currentX_),
         y: this.currentY_ + (2.0 / 3.0) * (cp.y - this.currentY_),
      };
      let cp2 = {
         x: cp1.x + (p.x - this.currentX_) / 3.0,
         y: cp1.y + (p.y - this.currentY_) / 3.0,
      };

      bezierCurveToHelper(this, cp1, cp2, p);
   }

   arc(aX, aY, aRadius, aStartAngle, aEndAngle, aClockwise) {
      let arcType = aClockwise ? 'at' : 'wa';

      let xStart = aX + mc(aStartAngle) * aRadius;
      let yStart = aY + ms(aStartAngle) * aRadius;

      let xEnd = aX + mc(aEndAngle) * aRadius;
      let yEnd = aY + ms(aEndAngle) * aRadius;

      // IE won't render arches drawn counter clockwise if xStart == xEnd.
      if (xStart == xEnd && !aClockwise) {
         xStart += 0.125; // Offset xStart by 1/80 of a pixel. Use something
         // that can be represented in binary
      }

      let p = this.getCoords_(aX, aY);
      let pStart = this.getCoords_(xStart, yStart);
      let pEnd = this.getCoords_(xEnd, yEnd);

      this.currentPath_.push({
         type: arcType,
         x: p.x,
         y: p.y,
         radius: aRadius,
         xStart: pStart.x,
         yStart: pStart.y,
         xEnd: pEnd.x,
         yEnd: pEnd.y,
      });
   }

   rect(aX, aY, aWidth, aHeight) {
      if (this.#needRemoveRect(aX, aY, aWidth, aHeight)) {
         return; //try to remove the rectangle behind radio buttons and checkboxes
      }

      this.moveTo(aX, aY);
      this.lineTo(aX + aWidth, aY);
      this.lineTo(aX + aWidth, aY + aHeight);
      this.lineTo(aX, aY + aHeight);
      this.closePath();
   }

   strokeRect(aX, aY, aWidth, aHeight) {
      if (this.#needRemoveRect(aX, aY, aWidth, aHeight)) {
         return; //try to remove the rectangle behind radio buttons and checkboxes
      }

      let oldPath = this.currentPath_;
      this.beginPath();

      this.moveTo(aX, aY);
      this.lineTo(aX + aWidth, aY);
      this.lineTo(aX + aWidth, aY + aHeight);
      this.lineTo(aX, aY + aHeight);
      this.closePath();
      this.stroke();

      this.currentPath_ = oldPath;
   }

   fillRect(aX, aY, aWidth, aHeight) {
      if (this.#needRemoveRect(aX, aY, aWidth, aHeight)) {
         return; //try to remove the rectangle behind radio buttons and checkboxes
      }

      let oldPath = this.currentPath_;
      this.beginPath();

      this.moveTo(aX, aY);
      this.lineTo(aX + aWidth, aY);
      this.lineTo(aX + aWidth, aY + aHeight);
      this.lineTo(aX, aY + aHeight);
      this.closePath();
      this.fill();

      this.currentPath_ = oldPath;
   }

   createLinearGradient(aX0, aY0, aX1, aY1) {
      let gradient = new CanvasGradient_('gradient');
      gradient.x0_ = aX0;
      gradient.y0_ = aY0;
      gradient.x1_ = aX1;
      gradient.y1_ = aY1;
      return gradient;
   }

   createRadialGradient(aX0, aY0, aR0, aX1, aY1, aR1) {
      let gradient = new CanvasGradient_('gradientradial');
      gradient.x0_ = aX0;
      gradient.y0_ = aY0;
      gradient.r0_ = aR0;
      gradient.x1_ = aX1;
      gradient.y1_ = aY1;
      gradient.r1_ = aR1;
      return gradient;
   }

   drawImage(image, var_args) {
      //MQZ. no image drawing support for now
   }

   getImageData(x, y, w, h) {
      //MQZ. returns empty data buffer for now
      return {
         width: w,
         height: h,
         data: new Uint8Array(w * h * 4),
      };
   }

   stroke(aFill) {
      if (this.currentPath_.length < 2) {
         return;
      }

      let a = processStyle(aFill ? this.fillStyle : this.strokeStyle);
      let color = a.color;
      //        let opacity = a.alpha * this.globalAlpha;
      let lineWidth = this.lineScale_ * this.lineWidth;

      let min = { x: null, y: null };
      let max = { x: null, y: null };

      for (let i = 0; i < this.currentPath_.length; i++) {
         let p = this.currentPath_[i];

         switch (p.type) {
            case 'moveTo':
               break;
            case 'lineTo':
               if (!aFill) {
                  //lines
                  if (i > 0) {
                     this.#drawPDFLine(
                        this.currentPath_[i - 1],
                        p,
                        lineWidth,
                        color
                     );
                  }
               }
               break;
            case 'close':
               if (!aFill) {
                  //lines
                  if (i > 0) {
                     this.#drawPDFLine(
                        this.currentPath_[i - 1],
                        this.currentPath_[0],
                        lineWidth,
                        color
                     );
                  }
               }
               p = null;
               break;
            case 'bezierCurveTo':
               break;
            case 'at':
            case 'wa':
               break;
         }

         // Figure out dimensions so we can set fills' coordinates correctly
         if (aFill && p) {
            if (min.x == null || p.x < min.x) {
               min.x = p.x;
            }
            if (max.x == null || p.x > max.x) {
               max.x = p.x;
            }
            if (min.y == null || p.y < min.y) {
               min.y = p.y;
            }
            if (max.y == null || p.y > max.y) {
               max.y = p.y;
            }
         }
      }

      if (aFill) {
         //fill
         this.#drawPDFFill(min, min, max, color);
      }
   }

   fill() {
      this.stroke(true);
   }

   closePath() {
      this.currentPath_.push({ type: 'close' });
   }

   /**
    * @private
    */
   getCoords_(aX, aY) {
      let m = this.m_;
      return {
         x: aX * m[0][0] + aY * m[1][0] + m[2][0],
         y: aX * m[0][1] + aY * m[1][1] + m[2][1],
      };
   }

   save() {
      let o = {};
      copyState(this, o);
      this.aStack_.push(o);
      this.mStack_.push(this.m_);
      this.m_ = matrixMultiply(createMatrixIdentity(), this.m_);
   }

   restore() {
      copyState(this.aStack_.pop(), this);
      this.m_ = this.mStack_.pop();
   }

   translate(aX, aY) {
      let m1 = [
         [1, 0, 0],
         [0, 1, 0],
         [aX, aY, 1],
      ];

      setM(this, matrixMultiply(m1, this.m_), false);
   }

   rotate(aRot) {
      let c = mc(aRot);
      let s = ms(aRot);

      let m1 = [
         [c, s, 0],
         [-s, c, 0],
         [0, 0, 1],
      ];

      setM(this, matrixMultiply(m1, this.m_), false);
   }

   scale(aX, aY) {
      this.arcScaleX_ *= aX;
      this.arcScaleY_ *= aY;
      let m1 = [
         [aX, 0, 0],
         [0, aY, 0],
         [0, 0, 1],
      ];

      setM(this, matrixMultiply(m1, this.m_), true);
   }

   transform(m11, m12, m21, m22, dx, dy) {
      let m1 = [
         [m11, m12, 0],
         [m21, m22, 0],
         [dx, dy, 1],
      ];

      setM(this, matrixMultiply(m1, this.m_), true);
   }

   setTransform(m11, m12, m21, m22, dx, dy) {
      let m = [
         [m11, m12, 0],
         [m21, m22, 0],
         [dx, dy, 1],
      ];

      setM(this, m, true);
   }

   /******** STUBS ********/
   clip() {
      // TODO: Implement
   }

   arcTo() {
      // TODO: Implement
   }

   createPattern() {
      return new CanvasPattern_();
   }
}

const kFBANotOverridable = 0x00000400; // indicates the field is read only by the user
const kFBARequired = 0x00000010; // indicates the field is required
const kMinHeight = 20;

class PDFField {
    static tabIndex = 0;

    static isWidgetSupported(field) {
        let retVal = false;

        switch(field.fieldType) {
            case 'Tx': retVal = true; break; //text input
            case 'Btn':
                if (field.fieldFlags & 32768) {
                    field.fieldType = 'Rd'; //radio button
                }
                else if (field.fieldFlags & 65536) {
                    field.fieldType = 'Btn'; //push button
                }
                else {
                    field.fieldType = 'Cb'; //checkbox
                }
                retVal = true;
                break;
            case 'Ch': retVal = true; break; //drop down
            case 'Sig': retVal = true; break; //signature
            default:
                nodeUtil.p2jwarn("Unsupported: field.fieldType of " + field.fieldType);
                break;
        }

        return retVal;
    }

    static isFormElement(field) {
        let retVal = false;
        switch(field.subtype) {
            case 'Widget': retVal = PDFField.isWidgetSupported(field); break;
            default:
                nodeUtil.p2jwarn("Unsupported: field.type of " + field.subtype);
                break;
        }
        return retVal;
    }

    // constructor
    constructor(field, viewport, Fields, Boxsets) {
        this.field = field;
        this.viewport = viewport;
        this.Fields = Fields;
        this.Boxsets = Boxsets;
    }

    // Normalize rectangle rect=[x1, y1, x2, y2] so that (x1,y1) < (x2,y2)
    // For coordinate systems whose origin lies in the bottom-left, this
    // means normalization to (BL,TR) ordering. For systems with origin in the
    // top-left, this means (TL,BR) ordering.
    static #normalizeRect(rect) {
        const r = rect.slice(0); // clone rect
        if (rect[0] > rect[2]) {
            r[0] = rect[2];
            r[2] = rect[0];
        }
        if (rect[1] > rect[3]) {
            r[1] = rect[3];
            r[3] = rect[1];
        }
        return r;
    }

    #getFieldPosition(field) {
        let viewPort = this.viewport;
        let fieldRect = viewPort.convertToViewportRectangle(field.rect);
        let rect = PDFField.#normalizeRect(fieldRect);

        let height = rect[3] - rect[1];
        if (field.fieldType === 'Tx') {
            if (height > kMinHeight + 2) {
                rect[1] += 2;
                height -= 2;
            }
        }
        else if (field.fieldType !== 'Ch') { //checkbox, radio button, and link button
            rect[1] -= 3;
        }

        height = (height >= kMinHeight) ? height : kMinHeight;

        return {
            x: PDFUnit.toFormX(rect[0]),
            y: PDFUnit.toFormY(rect[1]),
            w: PDFUnit.toFormX(rect[2] - rect[0]),
            h: PDFUnit.toFormY(height)
        };
    }

    #getFieldBaseData(field) {
        let attributeMask = 0;
        //PDF Spec p.676 TABLE 8.70 Field flags common to all field types
        if (field.fieldFlags & 0x00000001) {
            attributeMask |= kFBANotOverridable;
        }
        if (field.fieldFlags & 0x00000002) {
            attributeMask |= kFBARequired;
        }

        let anData = {
            id: { Id: field.fullName, EN: 0},
            TI: field.TI,
            AM: attributeMask
        };
        //PDF Spec p.675: add TU (AlternativeText) fields to provide accessibility info
        if (field.alternativeText && field.alternativeText.length > 1) {
            anData.TU = field.alternativeText;
        }

        if (field.alternativeID && field.alternativeID.length > 1) {
            anData.TM = field.alternativeID;
        }

        return Object.assign(anData, this.#getFieldPosition(field));
    }

    #addAlpha(field) {
        const anData = Object.assign({
            style: 48,
            T: {
                Name: field.TName || "alpha",
                TypeInfo: {}
            }
        }, this.#getFieldBaseData(field));

        if (field.MV) { //field attributes: arbitrary mask value
            anData.MV = field.MV;
        }
        if (field.fieldValue) {
            anData.V = field.fieldValue; //read-only field value, like "self-prepared"
        }

        this.Fields.push(anData);
    }

    #addCheckBox(box) {
        const anData = Object.assign({
            style: 48,
            T: {
                Name: "box",
                TypeInfo: {}
            }
        }, this.#getFieldBaseData(box));
        if(box.fieldValue) {
            anData.checked = box.fieldValue !== 'Off';
          }

        this.Boxsets.push({boxes:[anData]});
    }

    #addRadioButton(box) {
        const anData = Object.assign({
            style: 48,
            T: {
                Name: "box",
                TypeInfo: {}
            }
        }, this.#getFieldBaseData(box));

        anData.id.Id = box.value;
        if ('checked' in box) {
            anData.checked = box.checked;
        }

        const rdGroup = this.Boxsets.filter(boxset => ('id' in boxset) && ('Id' in boxset.id) && (boxset.id.Id === box.fullName))[0];
        if ((!!rdGroup) && ('boxes' in rdGroup)) {
            rdGroup.boxes.push(anData);
        }
        else {
            this.Boxsets.push({boxes:[anData], id: { Id: box.fullName, EN: 0}});
        }
    }

    #addLinkButton(field) {
        const anData = Object.assign({
            style: 48,
            T: {
                Name: "link"
            },
            FL: {
                form: {Id: field.FL}
            }
        }, this.#getFieldBaseData(field));

        this.Fields.push(anData);
    }

    #addSelect(field) {
        const anData = Object.assign({
            style: 48,
            T: {
                Name: "alpha",
                TypeInfo: {}
            }
        }, this.#getFieldBaseData(field));

        anData.w -= 0.5; //adjust combobox width
        anData.PL = {V: [], D: []};
        field.value.forEach( (ele, idx) => {
            if (Array.isArray(ele)) {
                anData.PL.D.push(ele[0]);
                anData.PL.V.push(ele[1]);
            } else {
                anData.PL.D.push(ele);
                anData.PL.V.push(ele);
            }
        });
		
		// add field value to the object 
		if (field.fieldValue) {
			anData.V = field.fieldValue; 
		}
        this.Fields.push(anData);
    };

    #addSignature(field) {
        const anData = Object.assign({
            style: 48,
            T: {
                Name: "signature",
                TypeInfo: {}
            }
        }, this.#getFieldBaseData(field));

        if (field.Sig) {
            anData.Sig = {};
            if (field.Sig.Name) anData.Sig.Name = field.Sig.Name;
            if (field.Sig.M) anData.Sig.M = PDFUnit.dateToIso8601(field.Sig.M);
            if (field.Sig.Location) anData.Sig.Location = field.Sig.Location;
            if (field.Sig.Reason) anData.Sig.Reason = field.Sig.Reason;
            if (field.Sig.ContactInfo) anData.Sig.ContactInfo = field.Sig.ContactInfo;
        }

        this.Fields.push(anData);
    }

    // public instance methods
    processField() {
        this.field.TI = PDFField.tabIndex++;

        switch(this.field.fieldType) {
            case 'Tx': this.#addAlpha(this.field); break;
            case 'Cb': this.#addCheckBox(this.field); break;
            case 'Rd': this.#addRadioButton(this.field);break;
            case 'Btn':this.#addLinkButton(this.field); break;
            case 'Ch': this.#addSelect(this.field); break;
            case 'Sig': this.#addSignature(this.field); break;
        }

        this.clean();
    }

    clean() {
        delete this.field;
        delete this.viewport;
        delete this.Fields;
        delete this.Boxsets;
    }

    //static public method to generate fieldsType object based on parser result
    static getAllFieldsTypes(data) {
        const isFieldReadOnly = field => {
            return (field.AM & kFBANotOverridable) ? true : false;
        };

        const getFieldBase = field => {
            return {id: field.id.Id, type: field.T.Name, calc: isFieldReadOnly(field), value: field.V || ""};
        };

        let retVal = [];
        data.Pages.forEach( page => {
            page.Boxsets.forEach( boxsets => {
                if (boxsets.boxes.length > 1) { //radio button
                    boxsets.boxes.forEach( box => {
                        retVal.push({id: boxsets.id.Id, type: "radio", calc: isFieldReadOnly(box), value: box.id.Id});
                    });
                }
                else { //checkbox
                    retVal.push(getFieldBase(boxsets.boxes[0]));
                }
            });

            page.Fields.forEach(field => retVal.push(getFieldBase(field)));
            
        });
        return retVal;
    }
}

//BEGIN - MQZ 9/19/2012. Helper functions to parse acroForm elements
function setupRadioButton(annotation, item) {
    let asName = '';
    //PDF Spec p.689: parent item's DV holds the item's value that is selected by default
    let po = annotation.get('Parent');
    if (po) {
        po.forEach(function(key, val){
            if (key === 'DV') {
                asName = val.name || '';
            }
            else if (key === 'TU') {
                //radio buttons use the alternative text from the parent
                item.alternativeText = val;
            } else if( key == 'TM') {
                item.alternativeID   = val;
            }
        });
    }

    //PDF Spec p.606: get appearance dictionary
    let ap = annotation.get('AP');
    //PDF Spec p.614 get normal appearance
    let nVal = ap.get('N');
    //PDF Spec p.689
    nVal.forEach(function (key, value) {
        if (key.toLowerCase() != "off") {
            //value if selected
            item.value = key; //export value
            item.checked = (key === asName); //initial selection state
        }
    });

    if (!item.value)
        item.value = "off";
}

function setupPushButton(annotation, item) {
    //button label: PDF Spec p.640
    let mk = annotation.get('MK');
    if(mk) {
        item.value = mk.get('CA') || '';
    }

    //button action: url when mouse up: PDF Spec:p.642
    item.FL = "";
    let ap = annotation.get('A');
    if (ap) {
        let sp = ap.get('S');
        item.FL = ap.get(sp.name);
    }
}

function setupCheckBox(annotation, item) {
    //PDF Spec p.606: get appearance dictionary
    let ap = annotation.get('AP');
    //PDF Spec p.614 get normal appearance
    let nVal = ap.get('N');

    //PDF Spec p.689
    let i = 0;
    nVal.forEach(function (key, value) {
        i++;
        if (i == 1) //initial selection state
            item.value = key;
    });
}

function setupDropDown(annotation, item) {
    //PDF Spec p.688
    item.value = annotation.get('Opt') || [];
}

function setupFieldAttributes(annotation, item) {
    //MQZ. Jan.03.2013. additional-actions dictionary
    //PDF Spec P.648. 8.5.2. Trigger Events
    let aa = annotation.get('AA');
    if (!aa) {
        return;
    }

    //PDF Spec p.651 get format dictionary
    let nVal = aa.get('F');
    if (!nVal) {
        nVal = aa.get('K');
        if (!nVal)
            return;
    }

    nVal.forEach(function (key, value) {
        if (key === "JS") {
            processFieldAttribute(value, item);
        }
    });
}

const AFSpecial_Format = ['zip', 'zip', 'phone', 'ssn', ''];
//  let AFNumber_Format = ['nDec', 'sepStyle', 'negStyle', 'currStyle', 'strCurrency', 'bCurrencyPrepend'];
//– nDec is the number of places after the decimal point;
//– sepStyle is an integer denoting whether to use a separator or not. If sepStyle=0, use commas. If sepStyle=1, do not separate.
//– negStyle is the formatting used for negative numbers: 0 = MinusBlack, 1 = Red, 2 = ParensBlack, 3 = ParensRed
//– currStyle is the currency style - not used
//- strCurrency is the currency symbol
//– bCurrencyPrepend
//  let AFDate_FormatEx = ["m/d", "m/d/yy", "mm/dd/yy", "mm/yy", "d-mmm", "d-mmm-yy", "dd-mmm-yy", "yymm-dd", "mmm-yy", "mmmm-yy", "mmm d, yyyy", "mmmm d, yyyy", "m/d/yy h:MM tt", "m/d/yy HH:MM"];

function processFieldAttribute(jsFuncName, item) {
    if (item.hasOwnProperty('TName'))
        return;

    if(!jsFuncName.split)
        return;

    let vParts = jsFuncName.split('(');
    if (vParts.length !== 2)
        return;

    let funcName = vParts[0];
    let funcParam = vParts[1].split(')')[0];

    switch (funcName) {
        case 'AFSpecial_Format':
            item.TName = AFSpecial_Format[Number(funcParam)];
            break;
        case 'AFNumber_Format':
//              nfs = funcParam.split(',');
//set the Money fields to use the Number type with no decimal places after, no commas, and bCurrencyPrepend is set as true; (o use a negative sign (fits the PDF layout and our print formatting as well).
//              if (nfs[0] === '0' && nfs[1] === '1' && nfs[5])
//                  item.TName = 'money';
//              else
            item.TName = 'number';
            break;
        case 'AFDate_FormatEx':
            item.TName = 'date';
            item.MV = funcParam.replace(/^'+|^"+|'+$|"+$/g,''); //mask value
            break;
        case 'AFSpecial_KeystrokeEx': //special format: "arbitrary mask"
            let maskValue = funcParam.replace(/^'+|^"+|'+$|"+$/g,''); //mask value
            if ((!!maskValue) && maskValue.length > 0 && maskValue.length < 64) {
                item.TName = 'mask'; //fixed length input
                item.MV = maskValue;
            }
            break;
        case 'AFPercent_Format':
            item.TName = 'percent'; //funcParam => 2, 0, will specified how many decimal places
            break;
    }
}

function setupSignature(annotation, item) {
    //PDF Spec p.695: field value is signature dict if signed
    let sig = annotation.get('V');
    if (!sig) return;

    //PDF Spec p.728: get signature information
    item.Sig = {};
    let name = sig.get('Name');
    if (name) item.Sig.Name = name;
    let time = sig.get('M');
    if (time) item.Sig.M = time;
    let location = sig.get('Location');
    if (location) item.Sig.Location = location;
    let reason = sig.get('Reason');
    if (reason) item.Sig.Reason = reason;
    let contactInfo = sig.get('ContactInfo');
    if (contactInfo) item.Sig.ContactInfo = contactInfo;
}

//END - MQZ 9/19/2012. Helper functions to parse acroForm elements

class PDFAnno {
    static processAnnotation(annotation, item) {
        if (item.fieldType == 'Btn') { //PDF Spec p.675
            if (item.fieldFlags & 32768) {
                setupRadioButton(annotation, item);
            }
            else if (item.fieldFlags & 65536) {
                setupPushButton(annotation, item);
            }
            else {
                setupCheckBox(annotation, item);
            }
        }
        else if (item.fieldType == 'Ch') {
            setupDropDown(annotation, item);
        }
        else if (item.fieldType == 'Tx') {
            setupFieldAttributes(annotation, item);
        }
        else if (item.fieldType === 'Sig') {
            setupSignature(annotation, item);
        }
        else {
            nodeUtil.p2jwarn("Unknown fieldType: ", item);
        }
    }   
}

class PDFImage {
	#_src = '';
	#_onload = null;

	set onload(val) {
		this.#_onload = typeof val === 'function' ? val : null;
	}

	get onload() {
		return this.#_onload;
	}

	set src(val) {
		this.#_src = val;
		if (this.#_onload) this.#_onload();
	}

	get src() {
		return this.#_src;
	}

    btoa(val) {
        if (typeof window === 'undefined') {
            return (new Buffer.from(val, 'ascii')).toString('base64');
        }
        else if (typeof window.btoa === 'function')
            return window.btoa(val);

        return "";
    }

}

class PTIXmlParser {
    xmlData = null;
	ptiPageArray = [];

	// constructor
	constructor() {
        this.xmlData = null;
        this.ptiPageArray = [];
    }
	
	parseXml(filePath, callback) {
		fs.readFile(filePath, 'utf8', (err, data) => {
			if (err) {
                callback(err);
			}
			else {
				this.xmlData = data;

				var parser = new xmldom.DOMParser();
				var dom = parser.parseFromString(this.xmlData);
				var root = dom.documentElement;

				var xmlFields = root.getElementsByTagName("field");
				var fields = [];

				for(var i=0;i<xmlFields.length;i++){
					var id = xmlFields[i].getAttribute('id');
					var xPos = xmlFields[i].getAttribute('x');
					var yPos = xmlFields[i].getAttribute('y');
					var width = xmlFields[i].getAttribute('width');
					var height = xmlFields[i].getAttribute('height');
					var type = xmlFields[i].getAttribute('xsi:type');
					var page = xmlFields[i].getAttribute('page');
					var fontName = xmlFields[i].getAttribute('fontName');
					var fontSize = xmlFields[i].getAttribute('fontSize');

					var item = {};
					
					var rectLeft = parseInt(xPos) - 21; //was 23.5
					var rectTop = parseInt(yPos) - 20;//was 23
					var rectRight = parseInt(rectLeft) + parseInt(width) - 4;
					var rectBottom = parseInt(rectTop) + parseInt(height) - 4;
					
					item.fieldType="Tx";
					if (type == "Boolean") {
						item.fieldType="Btn";
					}
					else  if (type=="SSN" ||  type=="Phone" || type=="zip") {
						item.TName = type.toLowerCase();
					}
					item.alternativeText = "";
					item.fullName = id;
					item.fontSize = fontSize;
					item.subtype = "Widget";

					item.rect = [rectLeft, rectTop, rectRight, rectBottom];;

					fields.push(item);
					
					this.ptiPageArray[parseInt(page)]=fields;
				}
				
			}
			callback();
		});
	}

	getFields(pageNum) {
		return this.ptiPageArray[pageNum];
	}
}

const __filename$2 = url.fileURLToPath((typeof document === 'undefined' ? require('u' + 'rl').pathToFileURL(__filename).href : (_documentCurrentScript && _documentCurrentScript.src || new URL('pdfparser.cjs', document.baseURI).href)));
const __dirname$2 = path.dirname(__filename$2);

const pkInfo = JSON.parse(fs.readFileSync(`${__dirname$2}/package.json`, 'utf8'));
const _PARSER_SIG = `${pkInfo.name}@${pkInfo.version} [${pkInfo.homepage}]`;

const __filename$1 = url.fileURLToPath((typeof document === 'undefined' ? require('u' + 'rl').pathToFileURL(__filename).href : (_documentCurrentScript && _documentCurrentScript.src || new URL('pdfparser.cjs', document.baseURI).href)));
const __dirname$1 = path.dirname(__filename$1);

const _pdfjsFiles = [
   'shared/util.js',
   'shared/colorspace.js',
   'shared/pattern.js',
   'shared/function.js',
   'shared/annotation.js',

   'core/core.js',
   'core/obj.js',
   'core/charsets.js',
   'core/crypto.js',
   'core/evaluator.js',
   'core/fonts.js',
   'core/font_renderer.js',
   'core/glyphlist.js',
   'core/image.js',
   'core/metrics.js',
   'core/parser.js',
   'core/stream.js',
   'core/worker.js',
   'core/jpx.js',
   'core/jbig2.js',
   'core/bidi.js',
   'core/jpg.js',
   'core/chunked_stream.js',
   'core/pdf_manager.js',
   'core/cmap.js',
   'core/cidmaps.js',

   'display/canvas.js',
   'display/font_loader.js',
   'display/metadata.js',
   'display/api.js',
];

//////replacing HTML5 canvas with PDFCanvas (in-memory canvas)
function createScratchCanvas(width, height) {
   return new CanvasRenderingContext2D_({}, width, height);
}

const PDFJS = {};
var Image = PDFImage
const globalScope = { console };

const baseDir = `${__dirname$1}/base/`;
const _baseCode = _pdfjsFiles.reduce(
   (preContent, fileName, idx, arr) =>
      (preContent += fs.readFileSync(baseDir + fileName, 'utf8')),
   ''
);
eval(_baseCode);

////////////////////////////////start of helper classes
class PDFPageParser {
   //static
   static RenderingStates = {
      INITIAL: 0,
      RUNNING: 1,
      PAUSED: 2,
      FINISHED: 3,
   };

   //public
   id = -1;
   pdfPage = null;
   ptiParser = null;
   scale = 0;
   viewport = null;
   renderingState = -1;

   Fields = null;
   Boxsets = null;
   ctxCanvas = null;

   #_addField(field) {
      if (!PDFField.isFormElement(field)) {
         nodeUtil.p2jwarn('NOT valid form element', field);
         return;
      }

      const oneField = new PDFField(
         field,
         this.viewport,
         this.Fields,
         this.Boxsets
      );
      oneField.processField();
   }

   // constructor
   constructor(pdfPage, id, scale, ptiParser) {
      // public, this instance copies
      this.id = id;
      this.pdfPage = pdfPage;
      this.ptiParser = ptiParser;

      this.scale = scale || 1.0;

      //leave out the 2nd parameter in order to use page's default rotation (for both portrait and landscape form)
      this.viewport = this.pdfPage.getViewport(this.scale);

      this.renderingState = PDFPageParser.RenderingStates.INITIAL;

      //form elements other than radio buttons and check boxes
      this.Fields = [];
      //form elements: radio buttons and check boxes
      this.Boxsets = [];
      this.ctxCanvas = {};
   }

   get width() {
      return PDFUnit.toFormX(this.viewport.width);
   }
   get height() {
      return PDFUnit.toFormY(this.viewport.height);
   }
   get HLines() {
      return this.ctxCanvas.HLines;
   }
   get VLines() {
      return this.ctxCanvas.VLines;
   }
   get Fills() {
      return this.ctxCanvas.Fills;
   }
   get Texts() {
      return this.ctxCanvas.Texts;
   }

   destroy() {
      this.pdfPage.destroy();
      this.pdfPage = null;

      this.ptiParser = null;
      this.Fields = null;
      this.Boxsets = null;
      this.ctxCanvas = null;
   }

   getPagePoint(x, y) {
      return this.viewport.convertToPdfPoint(x, y);
   }

   parsePage(callback, errorCallBack) {
      if (this.renderingState !== PDFPageParser.RenderingStates.INITIAL) {
         errorCallBack('Must be in new state before drawing');
         return;
      }

      this.renderingState = PDFPageParser.RenderingStates.RUNNING;

      const canvas = createScratchCanvas(1, 1);
      const ctx = canvas.getContext('2d');

      function pageViewDrawCallback(error) {
         this.renderingState = PDFPageParser.RenderingStates.FINISHED;

         if (error) {
            console.error(error);
            errorCallBack(`Error: Page ${this.id + 1}: ${error.message}`);
         } else {
            if (this.ptiParser) {
               const extraFields = this.ptiParser.getFields(
                  parseInt(this.id) + 1
               );
               extraFields.forEach((field) => this.#_addField(field));
            }

            this.ctxCanvas = ctx.canvas;
            this.stats = this.pdfPage.stats;

            nodeUtil.p2jinfo(`Success: Page ${this.id + 1}`);
            callback();
         }
      }

      const renderContext = {
         canvasContext: ctx,
         viewport: this.viewport,
      };

      this.pdfPage.render(renderContext).then(
         (data) => {
            this.pdfPage.getAnnotations().then(
               (fields) => {
                  fields.forEach((field) => this.#_addField(field));
                  pageViewDrawCallback.call(this, null);
               },
               (err) => errorCallBack('pdfPage.getAnnotations error:' + err)
            );
         },
         (err) => pageViewDrawCallback.call(this, err)
      );
   }
}

////////////////////////////////Start of Node.js Module
class PDFJSClass extends events.EventEmitter {
   pdfDocument = null;
   pages = null;
   rawTextContents = null;

   needRawText = null;

   // constructor
   constructor(needRawText) {
      super();

      // public, this instance copies
      this.pdfDocument = null;
      this.pages = [];
      this.rawTextContents = [];

      this.needRawText = needRawText;
   }

   raiseErrorEvent(errMsg) {
      console.error(errMsg);
      process.nextTick(() => this.emit('pdfjs_parseDataError', errMsg));
      // this.emit("error", errMsg);
      return errMsg;
   }

   raiseReadyEvent(data) {
      process.nextTick(() => this.emit('pdfjs_parseDataReady', data));
      return data;
   }

   parsePDFData(arrayBuffer, password) {
      this.pdfDocument = null;

      const parameters = { password: password, data: arrayBuffer };
      PDFJS.getDocument(parameters).then(
         (pdfDocument) => this.load(pdfDocument, 1),
         (error) => this.raiseErrorEvent(error)
      );
   }

   tryLoadFieldInfoXML(pdfFilePath) {
      const _sufInfo = '_fieldInfo.xml';
      const fieldInfoXMLPath = pdfFilePath.replace('.pdf', _sufInfo);
      if (
         fieldInfoXMLPath.indexOf(_sufInfo) < 1 ||
         !fs.existsSync(fieldInfoXMLPath)
      ) {
         return;
      }
      nodeUtil.p2jinfo('About to load fieldInfo XML : ' + fieldInfoXMLPath);

      this.ptiParser = new PTIXmlParser();
      this.ptiParser.parseXml(fieldInfoXMLPath, (err) => {
         if (err) {
            nodeUtil.p2jwarn('fieldInfo XML Error: ' + JSON.stringify(err));
            this.ptiParser = null;
         } else {
            nodeUtil.p2jinfo('fieldInfo XML loaded.');
         }
      });
   }

   load(pdfDocument, scale) {
      this.pdfDocument = pdfDocument;

      return this.loadMetaData().then(
         () => this.loadPages(),
         (error) => this.raiseErrorEvent('loadMetaData error: ' + error)
      );
   }

   loadMetaData() {
      return this.pdfDocument.getMetadata().then(
         (data) => {
            this.documentInfo = data.info;
            this.metadata = data.metadata?.metadata ?? {};
            this.parseMetaData();
         },
         (error) =>
            this.raiseErrorEvent('pdfDocument.getMetadata error: ' + error)
      );
   }

   parseMetaData() {
      const meta = {
         Transcoder: _PARSER_SIG,
         Meta: { ...this.documentInfo, Metadata: this.metadata },
      };
      this.raiseReadyEvent(meta);
      this.emit('readable', meta);
   }

   loadPages() {
      const pagesCount = this.pdfDocument.numPages;
      const pagePromises = [];
      for (let i = 1; i <= pagesCount; i++)
         pagePromises.push(this.pdfDocument.getPage(i));

      const pagesPromise = PDFJS.Promise.all(pagePromises);

      nodeUtil.p2jinfo('PDF loaded. pagesCount = ' + pagesCount);

      return pagesPromise.then(
         (promisedPages) => this.parsePage(promisedPages, 0, 1.5),
         (error) => this.raiseErrorEvent('pagesPromise error: ' + error)
      );
   }

   parsePage(promisedPages, id, scale) {
      nodeUtil.p2jinfo('start to parse page:' + (id + 1));

      const pdfPage = promisedPages[id];
      const pageParser = new PDFPageParser(pdfPage, id, scale, this.ptiParser);

      function continueOnNextPage() {
         nodeUtil.p2jinfo('complete parsing page:' + (id + 1));
         if (id === this.pdfDocument.numPages - 1) {
            this.raiseReadyEvent({ Pages: this.pages });
            //v1.1.2: signal end of parsed data with null
            process.nextTick(() => this.raiseReadyEvent(null));
            this.emit('data', null);
         } else {
            process.nextTick(() => this.parsePage(promisedPages, ++id, scale));
         }
      }

      pageParser.parsePage(
         (data) => {
            const page = {
               Width: pageParser.width,
               Height: pageParser.height,
               HLines: pageParser.HLines,
               VLines: pageParser.VLines,
               Fills: pageParser.Fills,
               //needs to keep current default output format, text content will output to a separate file if '-c' command line argument is set
               //                Content:pdfPage.getTextContent(),
               Texts: pageParser.Texts,
               Fields: pageParser.Fields,
               Boxsets: pageParser.Boxsets,
            };

            this.pages.push(page);
            this.emit('data', page);

            if (this.needRawText) {
               pdfPage.getTextContent().then(
                  (textContent) => {
                     this.rawTextContents.push(textContent);
                     nodeUtil.p2jinfo(
                        'complete parsing raw text content:' + (id + 1)
                     );
                     continueOnNextPage.call(this);
                  },
                  (error) =>
                     this.raiseErrorEvent(
                        'pdfPage.getTextContent error: ' + error
                     )
               );
            } else {
               continueOnNextPage.call(this);
            }
         },
         (errMsg) => this.raiseErrorEvent(errMsg)
      );
   }

   getRawTextContent() {
      let retVal = '';
      if (!this.needRawText) return retVal;

      this.rawTextContents.forEach((textContent, index) => {
         let prevText = null;
         textContent.bidiTexts.forEach((textObj, idx) => {
            if (prevText) {
               if (Math.abs(textObj.y - prevText.y) <= 9) {
                  prevText.str += textObj.str;
               } else {
                  retVal += prevText.str + '\r\n';
                  prevText = textObj;
               }
            } else {
               prevText = textObj;
            }
         });
         if (prevText) {
            retVal += prevText.str;
         }
         retVal +=
            '\r\n----------------Page (' +
            index +
            ') Break----------------\r\n';
      });

      return retVal;
   }

   getAllFieldsTypes() {
      return PDFField.getAllFieldsTypes({ Pages: this.pages || [] });
   }

   getMergedTextBlocksIfNeeded() {
      for (let p = 0; p < this.pages.length; p++) {
         let prevText = null;
         let page = this.pages[p];

         page.Texts.sort(PDFFont.compareBlockPos);
         page.Texts = page.Texts.filter((t, j) => {
            let isDup =
               j > 0 && PDFFont.areDuplicateBlocks(page.Texts[j - 1], t);
            if (isDup) {
               nodeUtil.p2jinfo(
                  'skipped: dup text block: ' + decodeURIComponent(t.R[0].T)
               );
            }
            return !isDup;
         });

         for (let i = 0; i < page.Texts.length; i++) {
            let text = page.Texts[i];

            if (prevText) {
               if (
                  PDFFont.areAdjacentBlocks(prevText, text) &&
                  PDFFont.haveSameStyle(prevText, text)
               ) {
                  let preT = decodeURIComponent(prevText.R[0].T);
                  let curT = decodeURIComponent(text.R[0].T);

                  prevText.R[0].T += text.R[0].T;
                  prevText.w += text.w;
                  text.merged = true;

                  let mergedText = decodeURIComponent(prevText.R[0].T);
                  nodeUtil.p2jinfo(
                     `merged text block: ${preT} + ${curT} => ${mergedText}`
                  );
                  prevText = null; //yeah, only merge two blocks for now
               } else {
                  prevText = text;
               }
            } else {
               prevText = text;
            }
         }

         page.Texts = page.Texts.filter((t) => !t.merged);
      }

      return { Pages: this.pages };
   }

   destroy() {
      this.removeAllListeners();

      if (this.pdfDocument) this.pdfDocument.destroy();
      this.pdfDocument = null;

      this.pages = null;
      this.rawTextContents = null;
   }
}

class ParserStream extends stream.Transform {
    static createContentStream(jsonObj) {
		const rStream = new stream.Readable({objectMode: true});
		rStream.push(jsonObj);
		rStream.push(null);
		return rStream;
	}

    static createOutputStream(outputPath, resolve, reject) {
		const outputStream = fs.createWriteStream(outputPath);
		outputStream.on('finish', () => resolve(outputPath));
		outputStream.on('error', err => reject(err) );
		return outputStream;
	}

    #pdfParser = null;
    #chunks = [];
    #parsedData = {Pages:[]};
    #_flush_callback = null; 

    constructor(pdfParser, options) {
        super(options);
        this.#pdfParser = pdfParser;

        this.#chunks = [];

        // this.#pdfParser.on("pdfParser_dataReady", evtData => {
        //     this.push(evtData);
        //     this.#_flush_callback();
        //     this.emit('end', null);
        // });
        this.#pdfParser.on("readable", meta => this.#parsedData = {...meta, Pages:[]});
        this.#pdfParser.on("data", page => {
            if (!page) {
                this.push(this.#parsedData);
                this.#_flush_callback();
            }
            else 
                this.#parsedData.Pages.push(page);
        });
    }

    //implements transform stream
	_transform(chunk, enc, callback) {
		this.#chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, enc));
		callback();
	}

	_flush(callback) {
        this.#_flush_callback = callback;
		this.#pdfParser.parseBuffer(Buffer.concat(this.#chunks));
	}

    _destroy() {
        super.removeAllListeners();
        this.#pdfParser = null;
        this.#chunks = [];         
    }
} 


class StringifyStream extends stream.Transform {
    constructor(options) {
        super(options);

        this._readableState.objectMode = false;
        this._writableState.objectMode = true;    
    }

    _transform(obj, encoding, callback){
        this.push(JSON.stringify(obj));
        callback();
    }
}

class PDFParser extends events.EventEmitter { // inherit from event emitter
    //public static
    static get colorDict() {return kColors; }
    static get fontFaceDict() { return kFontFaces; }
    static get fontStyleDict() { return kFontStyles; }

    //private static    
    static #maxBinBufferCount = 10;
    static #binBuffer = {};

    //private 
    #password = "";

    #context = null; // service context object, only used in Web Service project; null in command line
    
    #pdfFilePath = null; //current PDF file to load and parse, null means loading/parsing not started
    #pdfFileMTime = null; // last time the current pdf was modified, used to recognize changes and ignore cache
    #data = null; //if file read success, data is PDF content; if failed, data is "err" object
    #PDFJS = null; //will be initialized in constructor
    #processFieldInfoXML = false;//disable additional _fieldInfo.xml parsing and merging (do NOT set to true)

    // constructor
    constructor(context, needRawText, password) {
        //call constructor for super class
        super();
    
        // private
        // service context object, only used in Web Service project; null in command line
        this.#context = context;

        this.#pdfFilePath = null; //current PDF file to load and parse, null means loading/parsing not started
        this.#pdfFileMTime = null; // last time the current pdf was modified, used to recognize changes and ignore cache
        this.#data = null; //if file read success, data is PDF content; if failed, data is "err" object
        this.#processFieldInfoXML = false;//disable additional _fieldInfo.xml parsing and merging (do NOT set to true)

        this.#PDFJS = new PDFJSClass(needRawText);
        this.#password = password;
    } 
    
	//private methods, needs to invoked by [funcName].call(this, ...)
	#onPDFJSParseDataReady(data) {
		if (!data) { //v1.1.2: data===null means end of parsed data
			nodeUtil.p2jinfo("PDF parsing completed.");
			this.emit("pdfParser_dataReady", this.#data);
		}
		else {
			this.#data = {...this.#data, ...data};            
		}
	}

	#onPDFJSParserDataError(err) {
		this.#data = null;
		this.emit("pdfParser_dataError", {"parserError": err});
        // this.emit("error", err);
	}

	#startParsingPDF(buffer) {
		this.#data = {};

		this.#PDFJS.on("pdfjs_parseDataReady", data => this.#onPDFJSParseDataReady(data));
		this.#PDFJS.on("pdfjs_parseDataError", err => this.#onPDFJSParserDataError(err));

        //v1.3.0 the following Readable Stream-like events are replacement for the top two custom events
        this.#PDFJS.on("readable", meta => this.emit("readable", meta));
        this.#PDFJS.on("data", data => this.emit("data", data));
        this.#PDFJS.on("error", err => this.#onPDFJSParserDataError(err));    

		this.#PDFJS.parsePDFData(buffer || PDFParser.#binBuffer[this.binBufferKey], this.#password);
	}

	#processBinaryCache() {
		if (this.binBufferKey in PDFParser.#binBuffer) {
			this.#startParsingPDF();
			return true;
		}

		const allKeys = Object.keys(PDFParser.#binBuffer);
		if (allKeys.length > PDFParser.#maxBinBufferCount) {
			const idx = this.id % PDFParser.#maxBinBufferCount;
			const key = allKeys[idx];
			PDFParser.#binBuffer[key] = null;
			delete PDFParser.#binBuffer[key];

			nodeUtil.p2jinfo("re-cycled cache for " + key);
		}

		return false;
	}

    //public getter
    get data() { return this.#data; }
    get binBufferKey() { return this.#pdfFilePath + this.#pdfFileMTime; }
        
    //public APIs
    createParserStream() {
        return new ParserStream(this, {objectMode: true, bufferSize: 64 * 1024});
    }

	async loadPDF(pdfFilePath, verbosity) {
		nodeUtil.verbosity(verbosity || 0);
		nodeUtil.p2jinfo("about to load PDF file " + pdfFilePath);

		this.#pdfFilePath = pdfFilePath;

		try {
            this.#pdfFileMTime = fs.statSync(pdfFilePath).mtimeMs;
            if (this.#processFieldInfoXML) {
                this.#PDFJS.tryLoadFieldInfoXML(pdfFilePath);
            }

            if (this.#processBinaryCache())
                return;
        
            PDFParser.#binBuffer[this.binBufferKey] = await promises.readFile(pdfFilePath);
            nodeUtil.p2jinfo(`Load OK: ${pdfFilePath}`);
            this.#startParsingPDF();
        }
        catch(err) {
            nodeUtil.p2jerror(`Load Failed: ${pdfFilePath} - ${err}`);
            this.emit("pdfParser_dataError", err);
        }
	}

	// Introduce a way to directly process buffers without the need to write it to a temporary file
	parseBuffer(pdfBuffer) {
		this.#startParsingPDF(pdfBuffer);
	}

	getRawTextContent() { return this.#PDFJS.getRawTextContent(); }
	getRawTextContentStream() { return ParserStream.createContentStream(this.getRawTextContent()); }

	getAllFieldsTypes() { return this.#PDFJS.getAllFieldsTypes(); };
	getAllFieldsTypesStream() { return ParserStream.createContentStream(this.getAllFieldsTypes()); }

	getMergedTextBlocksIfNeeded() { return this.#PDFJS.getMergedTextBlocksIfNeeded(); }
	getMergedTextBlocksStream() { return ParserStream.createContentStream(this.getMergedTextBlocksIfNeeded()) }

	destroy() { // invoked with stream transform process		
        super.removeAllListeners();

		//context object will be set in Web Service project, but not in command line utility
		if (this.#context) {
			this.#context.destroy();
			this.#context = null;
		}

		this.#pdfFilePath = null;
		this.#pdfFileMTime = null;
		this.#data = null;
        this.#processFieldInfoXML = false;//disable additional _fieldInfo.xml parsing and merging (do NOT set to true)

        this.#PDFJS.destroy();
        this.#PDFJS = null;
	}
}

module.exports = PDFParser;
