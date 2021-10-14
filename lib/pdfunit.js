
    const dpi = 96.0;
    const gridXPerInch = 4.0;
    const gridYPerInch = 4.0;

    const _pixelXPerGrid = dpi/gridXPerInch;
    const _pixelYPerGrid = dpi/gridYPerInch;
    const _pixelPerPoint = dpi/72;
    
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

