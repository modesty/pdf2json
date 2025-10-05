import { PJS } from "./pdf.js";
import PDFUnit from './pdfunit.js';
import { kFontFaces, kFontStyles } from './pdfconst.js';

const _boldSubNames = ['bd', 'bold', 'demi', 'black', 'medi'];
const _stdFonts = [
   'arial',
   'helvetica',
   'sans-serif ',
   'courier ',
   'monospace ',
   'ocr ',
];
const DISTANCE_DELTA = 0.1;

export default class PDFFont {
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

      const nameArray = this.typeName.split('+');
      if (Array.isArray(nameArray) && nameArray.length > 1) {
         subType = nameArray[1].split('-');
         if (Array.isArray(subType) && subType.length > 1) {
            const subName = subType[1].toLowerCase();
            bold = _boldSubNames.indexOf(subName) >= 0;
            subType = subType[0];
         }
      }
      return { subType, bold };
   }

   #initSymbol() {
      const isSymbol =
         this.typeName.indexOf('symbol') > 0 ||
         kFontFaces[2].indexOf(this.subType) >= 0;
      if (this.fontObj.isSymbolicFont) {
         const mFonts = _stdFonts.filter(
            (oneName) => this.typeName.indexOf(oneName) >= 0
         );

         if (mFonts.length > 0) {
            this.fontObj.isSymbolicFont = false; //lots of Arial-based font is detected as symbol in VA forms (301, 76-c, etc.) reset the flag for now
            PJS.info(
               `Reset: isSymbolicFont (false) for ${this.fontObj.name}`
            );
         }
      } else {
         if (isSymbol) {
            this.fontObj.isSymbolicFont = true; //text pdf: va_ind_760c
            PJS.info(
               `Reset: isSymbolicFont (true) for ${this.fontObj.name}`
            );
         }
      }
      return isSymbol;
   }

   #initSpaceWidth() {
      let { spaceWidth } = this.fontObj;
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
         t1.x === t2.x &&
         t1.y === t2.y &&
         t1.R[0].T === t2.R[0].T &&
         PDFFont.haveSameStyle(t1, t2)
      );
   }

   // private
   #setFaceIndex() {
      const { fontObj } = this;

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

      const typeName = this.subType;
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

      if (this.faceIdx === 0) {
         if (this.typeName.indexOf('narrow') > 0) this.faceIdx = 1;
      }

      PJS.info(`typeName = ${typeName} => faceIdx = ${this.faceIdx}`);
   }

   #getFontStyleIndex(fontSize) {
      this.#setFaceIndex();

      //MQZ Feb.28.2013. Adjust bold text fontsize to work around word spacing issue
      this.fontSize = this.bold && fontSize > 12 ? fontSize + 1 : fontSize;

      const fsa = [
         this.faceIdx,
         this.fontSize,
         this.bold ? 1 : 0,
         this.italic ? 1 : 0,
      ];
      let retVal = -1;

      kFontStyles.forEach((element, index, list) => {
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
         if (retVal === 'C' || retVal === 'G') {
            //prevent symbolic encoding from the client
            retVal = ` ${retVal} `; //sample: va_ind_760c
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
            PJS.info(`${this.fontObj.type} - SymbolicFont - (${this.fontObj.name}) : ${str.charCodeAt(0)}::${str.charCodeAt(1)} => ${retVal}`);
      }

      return retVal;
   }

   #processType3Font(str) {
      // Special handling for Type3 fonts
      if (!str || str.length !== 1 || this.fontObj.type !== 'Type3') {
         return str;
      }

      // Debug info
      PJS.info(`Processing Type3 font: char code = ${str.charCodeAt(0)}, char = '${str}'`);
      if (this.fontObj.charProcMapping) {
         PJS.info(`charProcMapping available with ${Object.keys(this.fontObj.charProcMapping).length} entries`);
      } else {
         PJS.info(`No charProcMapping available for this Type3 font`);
         
         // If no mapping is available, try to use the character directly
         if (str && str.length === 1) {
            const code = str.charCodeAt(0);
            if (code >= 65 && code <= 90) { // A-Z
               PJS.info(`Using direct uppercase letter: ${str}`);
               return str;
            } else if (code >= 97 && code <= 122) { // a-z
               PJS.info(`Using direct lowercase letter: ${str}`);
               return str;
            } else if (code >= 48 && code <= 57) { // 0-9
               PJS.info(`Using direct digit: ${str}`);
               return str;
            }
         }
      }

      // Use the charProcMapping if available to map character code to glyph name
      if (this.fontObj.charProcMapping) {
         const charCode = str.charCodeAt(0);
         const glyphName = this.fontObj.charProcMapping[charCode];
         
         if (glyphName) {
            PJS.info(`Found glyph name in mapping: ${glyphName}`);
            // Map common Type3 glyph names to Unicode characters
            const glyphToUnicode = {
               'bullet': '\u2022',
               'checkbox': '\u2610',
               'checkmark': '\u2713',
               'check': '\u2713',
               'circle': '\u25CB',
               'square': '\u25A1',
               'triangle': '\u25B2',
               'triangledown': '\u25BC',
               'triangleleft': '\u25C0',
               'triangleright': '\u25B6',
               'star': '\u2605',
               'diamond': '\u25C6',
               'heart': '\u2665',
               'club': '\u2663',
               'spade': '\u2660',
               'filledcircle': '\u25CF',
               'filledsquare': '\u25A0',
               'filledtriangle': '\u25B2',
               'filledtriangledown': '\u25BC',
               'filledtriangleright': '\u25B6',
               'filledtriangleleft': '\u25C0',
               'arrowleft': '\u2190',
               'arrowright': '\u2192',
               'arrowup': '\u2191',
               'arrowdown': '\u2193',
               'cross': '\u2717'
            };
            
            // Check for direct match
            const glyphNameLower = typeof glyphName === 'string' ? glyphName.toLowerCase() : '';
            if (glyphNameLower in glyphToUnicode) {
               const unicodeChar = glyphToUnicode[/** @type {keyof typeof glyphToUnicode} */ (glyphNameLower)];
               PJS.info(`Mapped ${glyphNameLower} to Unicode ${unicodeChar}`);
               return unicodeChar;
            }
            
            // Check for letters in the glyph name (g0, g1, etc.)
            if (typeof glyphName === 'string' && glyphName.length > 1) {
               const letterMatch = glyphName.match(/[A-Za-z]/g);
               if (letterMatch && letterMatch.length === 1) {
                  const letter = letterMatch[0].toUpperCase();
                  PJS.info(`Extracted letter ${letter} from glyph name ${glyphName}`);
                  return letter;
               }
            }
            
            // Check for partial match (glyph name contains known keyword)
            for (const key in glyphToUnicode) {
               if (glyphNameLower.indexOf(key) >= 0) {
                  const unicodeChar = glyphToUnicode[/** @type {keyof typeof glyphToUnicode} */ (key)];
                  PJS.info(`Partial match: ${glyphNameLower} contains ${key}, mapped to ${unicodeChar}`);
                  return unicodeChar;
               }
            }
            
            // Try to match letters in the glyph name (e.g. g26 -> "C", g28 -> "O", etc.)
            // Look for letter patterns in the glyph name 
            if (typeof glyphName === 'string') {
               // Try to extract letter from glyph name
               const letterMatch = glyphName.match(/[A-Za-z]/g);
               if (letterMatch && letterMatch.length === 1) {
                  const letter = letterMatch[0].toUpperCase();
                  PJS.info(`Extracted letter ${letter} from glyph name ${glyphName}`);
                  return letter;
               }
               
               // Handle number in glyph name to suggest possible letter
               const numberMatch = glyphName.match(/\d+/);
               if (numberMatch && numberMatch.length === 1) {
                  const num = parseInt(numberMatch[0], 10);
                  // Map numbers to alphabet (1=A, 2=B, etc.)
                  if (num >= 1 && num <= 26) {
                     const letter = String.fromCharCode(64 + num); // ASCII 'A' is 65
                     PJS.info(`Mapped number ${num} in glyph name ${glyphName} to letter ${letter}`);
                     return letter;
                  }
               }
            }
            
            // Handle uniXXXX format glyph names
            if (typeof glyphName === 'string' && glyphName.startsWith('uni')) {
               const hex = glyphName.substring(3);
               if (/^[0-9A-F]{4,6}$/i.test(hex)) {
                  PJS.info(`Mapped uni${hex} to Unicode character`);
                  return String.fromCharCode(parseInt(hex, 16));
               }
            }
         }
      }
      
      // If we reach here, try direct character code mapping
      const charCode = str.charCodeAt(0);
      
      // No hard-coded directMappings, rely on charProcMapping from the font object
      PJS.info(`No direct mapping for character code ${charCode}, checking general mappings`);
      
      
      // Direct mapping for common Type3 glyph character codes
      let result = str;
      switch (charCode) {
         case 18: result = '\u2713'; break; // Check mark
         case 19: result = '\u2610'; break; // Ballot box
         case 20: result = '\u2611'; break; // Ballot box with check
         case 108: result = '\u2022'; break; // Bullet
         case 109: result = '\u25CF'; break; // Black circle
         case 110: result = '\u25CB'; break; // White circle
         case 111: result = '\u25A0'; break; // Black square
         case 112: result = '\u25A1'; break; // White square
         case 113: result = '\u25B2'; break; // Black up-pointing triangle
         case 114: result = '\u25BC'; break; // Black down-pointing triangle
         case 117: result = '\u2190'; break; // Left arrow
         case 118: result = '\u2192'; break; // Right arrow
         case 119: result = '\u2191'; break; // Up arrow
         case 120: result = '\u2193'; break; // Down arrow
         case 128: result = '\u221E'; break; // Infinity
         case 129: result = '\u2260'; break; // Not equal
         case 130: result = '\u2264'; break; // Less than or equal
         case 131: result = '\u2265'; break; // Greater than or equal
      }
      
      if (result !== str) {
         PJS.info(`Mapped char code ${charCode} to Unicode ${result}`);
      } else {
         PJS.info(`No mapping found for char code ${charCode}, returning original character`);
      }
      
      return result;
   }

   /**
    * Calculate the rotation angle from a 2D transformation matrix
    * @param {number[][]} matrix2D - The 2D transformation matrix
    * @returns {number} - The rotation angle in degrees
    */
   #textRotationAngle(matrix2D) {
      let retVal = 0;
      if (matrix2D[0][0] === 0 && matrix2D[1][1] === 0) {
         if (matrix2D[0][1] !== 0 && matrix2D[1][0] !== 0) {
            if (matrix2D[0][1] / matrix2D[1][0] + 1 < 0.0001) retVal = 90;
         }
      } else if (matrix2D[0][0] !== 0 && matrix2D[1][1] !== 0) {
         const r1 = Math.atan(-matrix2D[0][1] / matrix2D[0][0]);
         const r2 = Math.atan(matrix2D[1][0] / matrix2D[1][1]);
         if (Math.abs(r1) > 0.0001 && r1 - r2 < 0.0001) {
            retVal = (r1 * 180) / Math.PI;
         }
      }
      return retVal;
   }

   // public instance methods
   /**
    * Process text for rendering
    * @param {{x: number, y: number}} p - The position
    * @param {string} str - The text string
    * @param {number} maxWidth - Maximum width
    * @param {string} color - Color value
    * @param {number} fontSize - Font size
    * @param {{Texts: Array<any>}} targetData - Target data object
    * @param {number[][]} matrix2D - 2D transformation matrix
    */
   processText(p, str, maxWidth, color, fontSize, targetData, matrix2D) {
      // Debug the incoming text processing
      PJS.info(`Processing text: '${str}', font type: ${this.fontObj.type || 'unknown'}, char code: ${str ? str.charCodeAt(0) : 'none'}`);

      // Save original text for fallback
      const originalStr = str;
      
      // First try to process Type3 fonts, then fall back to symbolic fonts
      let text = this.fontObj.type === 'Type3' ? 
                 this.#processType3Font(str) : 
                 this.#processSymbolicFont(str);
                 
      if (!text) {
         PJS.info('Text processing returned null or empty, falling back to original text');
         text = originalStr; // Use original text as fallback
      }
      
      PJS.info(`Processed text: '${str}' -> '${text}'`);
      
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
         T: this.flashEncode(text),
         S: this.fontStyleId,
         TS,
      };
      const rAngle = this.#textRotationAngle(matrix2D);
      if (rAngle !== 0) {
         PJS.info(`${str}: rotated ${rAngle} degree.`);
         // Add RA property safely
         textRun = Object.assign({}, textRun, { RA: rAngle });
      }

      const oneText = {
         x: PDFUnit.toFormX(p.x) - 0.25,
         y: PDFUnit.toFormY(p.y) - 0.75,
         w: PDFUnit.toFixedFloat(maxWidth),
         ...colorObj, //MQZ.07/29/2013: when color is not in color dictionary, set the original color (oc)
         sw: this.spaceWidth, //font space width, use to merge adjacent text blocks
         A: 'left',
         R: [textRun],
         // TT: this.fontObj.isSymbolicFont || this.fontObj.type === 'Type3' ? 1 : 0, // Add TT flag for symbolic and Type3 fonts
      };

      PJS.info(`Adding text to output: '${text}'`);
      targetData.Texts.push(oneText);
   }

   /**
    * Encode text for output - preserves UTF-8 multi-byte characters
    * NOTE: Breaking change in v3.3.0 - removed URI encoding to fix issue #385
    * Chinese/Japanese/Korean and other multi-byte characters now output as UTF-8
    * @param {string} str - The string to encode
    * @returns {string} - The encoded string with legacy character replacements
    */
   flashEncode(str) {
      if (!str) return str;
      
      let retVal = str;
      
      // Apply legacy Flash-specific character replacements
      // These handle problematic characters from old PDF encodings
      retVal = retVal.replace(/\u0096/g, '-');      // En dash
      retVal = retVal.replace(/\u0091/g, "'");      // Left single quote
      retVal = retVal.replace(/\u0092/g, "'");      // Right single quote
      retVal = retVal.replace(/\u0082/g, "'");      // Low single quote
      retVal = retVal.replace(/\u0093/g, '"');      // Left double quote
      retVal = retVal.replace(/\u0094/g, '"');      // Right double quote
      retVal = retVal.replace(/\u0084/g, '"');      // Low double quote
      retVal = retVal.replace(/\u008B/g, '«');      // Left guillemet
      retVal = retVal.replace(/\u009B/g, '»');      // Right guillemet
      
      return retVal;
   }

   clean() {
      this.fontObj = null;
      delete this.fontObj;
   }
}
