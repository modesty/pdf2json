import nodeUtil from "util";
import PDFUnit from "./pdfunit.js";
import {kFontFaces, kFontStyles} from "./pdfconst.js";

const _boldSubNames = ["bd", "bold", "demi", "black"];
const _stdFonts = ["arial", "helvetica", "sans-serif ", "courier ","monospace ", "ocr "];
const DISTANCE_DELTA = 0.1;

export default class PDFFont {
    #initTypeName() {
        let typeName = (this.fontObj.name || this.fontObj.fallbackName);
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
            subType = nameArray[1].split("-");
            if (Array.isArray(subType) && subType.length > 1) {
                let subName = subType[1].toLowerCase();
                bold = _boldSubNames.indexOf(subName) >= 0;
                subType = subType[0];
            }
        }
        return {subType, bold};
    }

    #initSymbol() {
        let isSymbol = this.typeName.indexOf("symbol") > 0 || kFontFaces[2].indexOf(this.subType) >= 0;
        if (this.fontObj.isSymbolicFont) {
            let mFonts = _stdFonts.filter( (oneName) => (this.typeName.indexOf(oneName) >= 0) );

            if (mFonts.length > 0) {
                this.fontObj.isSymbolicFont = false; //lots of Arial-based font is detected as symbol in VA forms (301, 76-c, etc.) reset the flag for now
                nodeUtil.p2jinfo("Reset: isSymbolicFont (false) for " + this.fontObj.name);
            }
        }
        else {
            if (isSymbol) {
                this.fontObj.isSymbolicFont = true; //text pdf: va_ind_760c
                nodeUtil.p2jinfo("Reset: isSymbolicFont (true) for " + this.fontObj.name);
            }
        }  
        return isSymbol;
    }

    #initSpaceWidth() {
        let spaceWidth = this.fontObj.spaceWidth;
	    if (!spaceWidth) {
		    var spaceId = Array.isArray(this.fontObj.toFontChar) ? this.fontObj.toFontChar.indexOf(32) : -1;
		    spaceWidth = (spaceId >= 0 && Array.isArray(this.fontObj.widths)) ? this.fontObj.widths[spaceId] : 250;
	    }
	    spaceWidth = PDFUnit.toFormX(spaceWidth) / 32;
        return spaceWidth;
    }

    // constructor
    constructor(fontObj) {
        this.fontObj = fontObj;

        this.typeName = this.#initTypeName();

        const {subType, bold} = this.#initSubType();
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
        if (retVal) { // make sure both block are not rotated
            retVal = (typeof t1.R[0].RA === 'undefined') && (typeof t2.R[0].RA === 'undefined');
        }

        return retVal;
    }

    static getSpaceThreshHold(t1) {
        return (PDFFont.getFontSize(t1)/12) * t1.sw;
    }

    static areAdjacentBlocks(t1, t2) {
        const isInSameLine = Math.abs(t1.y - t2.y) <= DISTANCE_DELTA;
        const isDistanceSmallerThanASpace = ((t2.x - t1.x - t1.w) < PDFFont.getSpaceThreshHold(t1));

        return isInSameLine && isDistanceSmallerThanASpace;
    }

	static getFontSize(textBlock) {
		const sId = textBlock.R[0].S;
		return (sId < 0) ? textBlock.R[0].TS[1] : kFontStyles[sId][1];
	}

    static areDuplicateBlocks(t1, t2) {
        return t1.x == t2.x && t1.y == t2.y && t1.R[0].T == t2.R[0].T && PDFFont.haveSameStyle(t1, t2);
    }

    // private
    #setFaceIndex() {
        const fontObj = this.fontObj;

        this.bold = fontObj.bold;
        if (!this.bold) {
            this.bold = this.typeName.indexOf("bold") >= 0 || this.typeName.indexOf("black") >= 0;
        }
        this.italic = fontObj.italic; // fix https://github.com/modesty/pdf2json/issues/42
        // Extended the fix for https://github.com/modesty/pdf2json/issues/42
        if (!this.italic) {
            this.italic = this.typeName.indexOf("italic") >= 0 || this.typeName.indexOf("oblique") >= 0;
        }
        // Added detection of hybrid dual bolditalic fonts
        if (((!this.bold) || (!this.italic)) && (this.typeName.indexOf("boldobl") >= 0)) {
            this.bold = true;
            this.italic = true;
        }

        let typeName = this.subType;
        if (fontObj.isSerifFont) {
            if (kFontFaces[1].indexOf(typeName) >= 0)
                this.faceIdx = 1;
        }
        else if (kFontFaces[2].indexOf(this.subType) >= 0) {
            this.faceIdx = 2;
        }
        else if (fontObj.isMonospace) {
            this.faceIdx = 3;

            if (kFontFaces[4].indexOf(typeName) >= 0)
                this.faceIdx = 4;
            else if (kFontFaces[5].indexOf(typeName) >= 0)
                this.faceIdx = 5;
        }
        else if (fontObj.isSymbolicFont) {
            this.faceIdx = 2;
        }

        if (this.faceIdx == 0) {
            if (this.typeName.indexOf("narrow") > 0)
                this.faceIdx = 1;
        }

//        nodeUtil.p2jinfo"typeName = " + typeName + " => faceIdx = " + this.faceIdx);
    }

    #getFontStyleIndex(fontSize) {
        this.#setFaceIndex();

        //MQZ Feb.28.2013. Adjust bold text fontsize to work around word spacing issue
        this.fontSize = (this.bold && (fontSize > 12)) ? fontSize + 1 : fontSize;

        let fsa = [this.faceIdx, this.fontSize, this.bold?1:0, this.italic?1:0];
        let retVal = -1;

        kFontStyles.forEach(function(element, index, list){
            if (retVal === -1) {
                if (element[0] === fsa[0] && element[1] === fsa[1] &&
                    element[2] === fsa[2] && element[3] === fsa[3]) {
                        retVal = index;
                }
            }
        });

        return retVal;
    }

    #processSymbolicFont(str) {
        let retVal = str;

        if (!str || str.length !== 1)
            return retVal;

        if (!this.fontObj.isSymbolicFont || !this.isSymbol) {
            if (retVal == "C" || retVal == "G") { //prevent symbolic encoding from the client
                retVal = " " + retVal + " "; //sample: va_ind_760c
            }
            return retVal;
        }

        switch(str.charCodeAt(0)) {
            case 20: retVal = '\u2713'; break; //check mark
            case 70: retVal = (this.fontObj.type === "CIDFontType0") ? '\u26A0' : '\u007D'; break; //exclaimation in triangle OR right curly bracket
            case 71: retVal = '\u25b6'; break; //right triangle
            case 97: retVal = '\u25b6'; break; //right triangle
            case 99: retVal = this.isSymbol ? '\u2022' : '\u25b2'; break; //up triangle. set to Bullet Dot for VA SchSCR
            case 100: retVal = '\u25bc'; break; //down triangle
            case 103: retVal = '\u27A8'; break; //right arrow. sample: va_ind_760pff and pmt
            case 106: retVal = ''; break; //VA 301: string j character by the checkbox, hide it for now
            case 114: retVal = '\u2022'; break; //Bullet dot
            case 115: retVal = '\u25b2'; break; //up triangle
            case 116: retVal = '\u2022'; break; //Bullet dot
            case 118: retVal = '\u2022'; break; //Bullet dot
            default:
                nodeUtil.p2jinfo(this.fontObj.type + " - SymbolicFont - (" + this.fontObj.name + ") : " +
                    str.charCodeAt(0) + "::" + str.charCodeAt(1) + " => " + retVal);
        }

        return retVal;
    }

    #textRotationAngle(matrix2D) {
        let retVal = 0;
        if (matrix2D[0][0] === 0 && matrix2D[1][1] === 0) {
            if (matrix2D[0][1] != 0 && matrix2D[1][0] != 0) {
                if ((matrix2D[0][1] / matrix2D[1][0]) + 1 < 0.0001)
                    retVal = 90;
            }
        }
        else if (matrix2D[0][0] !== 0 && matrix2D[1][1] !== 0) {
            let r1 = Math.atan(-matrix2D[0][1] / matrix2D[0][0]);
            let r2 = Math.atan(matrix2D[1][0] / matrix2D[1][1]);
            if (Math.abs(r1) > 0.0001 && (r1 - r2 < 0.0001)) {
                retVal = r1 * 180 / Math.PI;
            }
        }
        return retVal;
    }

    // public instance methods
    processText(p, str, maxWidth, color, fontSize, targetData, matrix2D) {
        let text = this.#processSymbolicFont(str);
        if (!text) {
            return;
        }
        this.fontStyleId = this.#getFontStyleIndex(fontSize);

        // when this.fontStyleId === -1, it means the text style doesn't match any entry in the dictionary
        // adding TS to better describe text style [fontFaceId, fontSize, 1/0 for bold, 1/0 for italic];
        const TS = [this.faceIdx, this.fontSize, this.bold?1:0, this.italic?1:0];

        const clrId = PDFUnit.findColorIndex(color);
        const colorObj = (clrId > 0 && clrId < PDFUnit.colorCount()) ? {clr: clrId} : {oc: this.color};
        
        let textRun = {
            T: this.flash_encode(text),
            S: this.fontStyleId,
            TS: TS
        };
        const rAngle = this.#textRotationAngle(matrix2D);
        if (rAngle != 0) {
            nodeUtil.p2jinfo(str + ": rotated " + rAngle + " degree.");
            textRun = {...textRun, RA: rAngle};
        }

        let oneText = {x: PDFUnit.toFormX(p.x) - 0.25,
            y: PDFUnit.toFormY(p.y) - 0.75,
            w: PDFUnit.toFixedFloat(maxWidth),
	        sw: this.spaceWidth, //font space width, use to merge adjacent text blocks
            A: "left",
            R: [textRun]
        };

        //MQZ.07/29/2013: when color is not in color dictionary, set the original color (oc)
        oneText = {...oneText, ...colorObj};


	    targetData.Texts.push(oneText);
    }

    flash_encode(str) {
        let retVal = encodeURIComponent(str);
        retVal = retVal.replace("%C2%96", "-");
        retVal = retVal.replace("%C2%91", "%27");
        retVal = retVal.replace("%C2%92", "%27");
        retVal = retVal.replace("%C2%82", "%27");
        retVal = retVal.replace("%C2%93", "%22");
        retVal = retVal.replace("%C2%94", "%22");
        retVal = retVal.replace("%C2%84", "%22");
        retVal = retVal.replace("%C2%8B", "%C2%AB");
        retVal = retVal.replace("%C2%9B", "%C2%BB");

        return retVal;
    }

    clean() {
        this.fontObj = null;
        delete this.fontObj;
    }
}