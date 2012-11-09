var nodeUtil = require("util"),
    _ = require("underscore"),
    PDFUnit = require('./pdfunit.js');

var PDFFill = (function PFPLineClosure() {
    'use strict';
    // private static
    var _nextId = 1;
    var _name = 'PDFFill';

    // constructor
    var cls = function (x, y, width, height, color) {
        // private
        var _id = _nextId++;

        // public (every instance will have their own copy of these methods, needs to be lightweight)
        this.get_id = function() { return _id; };
        this.get_name = function() { return _name + _id; };

        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.color = color;
    };

    // public static
    cls.get_nextId = function () {
        return _name + _nextId;
    };

    var _toFixedFloat = function(num) {
        return parseFloat(num.toFixed(2));
    };

    // public (every instance will share the same method, but has no access to private fields defined in constructor)
    cls.prototype.processFill = function (targetData) {
        var clrId = PDFUnit.findColorIndex(this.color);

        var oneFill = {x:_toFixedFloat(PDFUnit.toFormX(this.x)),
                       y:_toFixedFloat(PDFUnit.toFormY(this.y)),
                       w:_toFixedFloat(PDFUnit.toFormX(this.width)),
                       h:_toFixedFloat(PDFUnit.toFormY(this.height)),
                       clr: clrId};

        targetData.Fills.push(oneFill);
    };

    return cls;
})();

module.exports = PDFFill;

