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
}

module.exports = PDFUnit;

