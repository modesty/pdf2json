const {kColors} = require("./pdfconst");

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

module.exports = PDFUnit;

