'use strict';

let nodeUtil = require("util"),
    _ = require("lodash"),
    PDFUnit = require('./pdfunit.js');

let PDFFill = (function PFPLineClosure() {
    'use strict';
    // private static
    let _nextId = 1;
    let _name = 'PDFFill';

    // constructor
    let cls = function (x, y, width, height, color) {
        // private
        let _id = _nextId++;

        // public (every instance will have their own copy of these methods, needs to be lightweight)
        this.get_id = function() { return _id; };
        this.get_name = function() { return _name + _id; };

        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.color = color;
    };

    // public (every instance will share the same method, but has no access to private fields defined in constructor)
    cls.prototype.processFill = function (targetData) {
        let clrId = PDFUnit.findColorIndex(this.color);

        let oneFill = {x:PDFUnit.toFormX(this.x),
                       y:PDFUnit.toFormY(this.y),
                       w:PDFUnit.toFormX(this.width),
                       h:PDFUnit.toFormY(this.height),
                       clr: clrId};

        //MQZ.07/29/2013: when color is not in color dictionary, set the original color (oc)
        if (clrId < 0) {
            oneFill = _.extend({oc: this.color}, oneFill);
        }

        targetData.Fills.push(oneFill);
    };

    return cls;
})();

module.exports = PDFFill;

