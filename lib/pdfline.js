'use strict';
let nodeUtil = require("util"),
    _ = require("lodash"),
    PDFUnit = require('./pdfunit.js');

let PDFLine = (function PFPLineClosure() {
    'use strict';
    // private static
    let _nextId = 1;
    let _name = 'PDFLine';

    // constructor
    let cls = function (x1, y1, x2, y2, lineWidth, color, dashed) {
        // private
        let _id = _nextId++;

        // public (every instance will have their own copy of these methods, needs to be lightweight)
        this.get_id = function() { return _id; };
        this.get_name = function() { return _name + _id; };

        this.x1 = x1;
        this.y1 = y1;
        this.x2 = x2;
        this.y2 = y2;
        this.lineWidth = lineWidth || 1.0;
        this.color = color;
        this.dashed = dashed;
    };

    let _setStartPoint = function(oneLine, x, y) {
        oneLine.x = PDFUnit.toFormX(x);
        oneLine.y = PDFUnit.toFormY(y);
    };

    // public (every instance will share the same method, but has no access to private fields defined in constructor)
    cls.prototype.processLine = function (targetData) {
        let xDelta = Math.abs(this.x2 - this.x1);
        let yDelta = Math.abs(this.y2 - this.y1);
        let minDelta = this.lineWidth;

        let oneLine = {x:0, y:0, w: PDFUnit.toFixedFloat(this.lineWidth), l:0};

        //MQZ Aug.28.2013, adding color support, using color dictionary and default to black
        let clrId = PDFUnit.findColorIndex(this.color);
        if (clrId < 0) {
            oneLine = _.extend({oc: this.color}, oneLine);
        }
        else if (clrId > 0 && clrId < (PDFUnit.colorCount() - 1)) {
            oneLine = _.extend({clr: clrId}, oneLine);
        }

        //MQZ Aug.29 dashed line support
        if (this.dashed) {
            oneLine = _.extend({dsh: 1}, oneLine);
        }

        if ((yDelta < this.lineWidth) && (xDelta > minDelta)) { //HLine
            if (this.lineWidth < 4 && (xDelta / this.lineWidth < 4)) {
                nodeUtil.p2jinfo("Skipped: short thick HLine: lineWidth = " + this.lineWidth + ", xDelta = " + xDelta);
                return; //skip short thick lines, like PA SPP lines behinds checkbox
            }

            oneLine.l = PDFUnit.toFormX(xDelta);
            if (this.x1 > this.x2)
                _setStartPoint.call(this, oneLine, this.x2, this.y2);
            else
                _setStartPoint.call(this, oneLine, this.x1, this.y1);
            targetData.HLines.push(oneLine);
        }
        else if ((xDelta < this.lineWidth) && (yDelta > minDelta)) {//VLine
            if (this.lineWidth < 4 && (yDelta / this.lineWidth < 4)) {
                nodeUtil.p2jinfo("Skipped: short thick VLine: lineWidth = " + this.lineWidth + ", yDelta = " + yDelta);
                return; //skip short think lines, like PA SPP lines behinds checkbox
            }

            oneLine.l = PDFUnit.toFormY(yDelta);
            if (this.y1 > this.y2)
                _setStartPoint.call(this, oneLine, this.x2, this.y2);
            else
                _setStartPoint.call(this, oneLine, this.x1, this.y1);
            targetData.VLines.push(oneLine);
        }
    };

    return cls;
})();

module.exports = PDFLine;

