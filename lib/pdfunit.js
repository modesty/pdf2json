var nodeUtil = require("util"),
    _ = require("underscore");

var PDFUnit = (function PFPUnitClosure() {
    'use strict';
    // private static
    var _nextId = 1;
    var _name = 'PDFUnit';

    var dpi = 96.0;
    var gridXPerInch = 11.0;
    var gridYPerInch = 4.0;

    var _pixelXPerGrid = dpi/gridXPerInch;
    var _pixelYPerGrid = dpi/gridYPerInch;
    var _pixelPerPoint = dpi/72;

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

    // constructor
    var cls = function () {
        // private
        var _id = _nextId++;

        // public (every instance will have their own copy of these methods, needs to be lightweight)
        this.get_id = function() { return _id; };
        this.get_name = function() { return _name + _id; };
    };

    // public static
    cls.get_nextId = function () {
        return _name + _nextId;
    };

    cls.toFixedFloat = function(fNum) {
        return parseFloat(fNum.toFixed(3))
    };

    cls.colorCount = function() {
        return kColors.length;
    };

    cls.toPixelX = function(formX) {
        return Math.round(formX * _pixelXPerGrid);
    };

    cls.toPixelY = function(formY) {
        return Math.round(formY * _pixelYPerGrid);
    };

    cls.pointToPixel = function(point) {// Point unit (1/72 an inch) to pixel units
        return point * _pixelPerPoint;
    };

    cls.getColorByIndex = function(clrId) {
        return this.kColors[clrId];
    };

    cls.toFormPoint = function(viewportX, viewportY) {
        return [(viewportX / _pixelXPerGrid), (viewportY / _pixelYPerGrid)];
    };

    cls.toFormX = function(viewportX) {
        return cls.toFixedFloat(viewportX / _pixelXPerGrid);
    };

    cls.toFormY = function(viewportY) {
        return cls.toFixedFloat(viewportY / _pixelYPerGrid);
    };

    cls.findColorIndex = function(color) {
        if (color.length === 4)
            color += "000";
        //MQZ. 07/29/2013: if color is not in dictionary, just return -1. The caller (pdffont, pdffill) will set the actual color
        return kColors.indexOf(color);
    };

    return cls;
})();

module.exports = PDFUnit;

