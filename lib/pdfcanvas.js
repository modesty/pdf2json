'use strict';
var nodeUtil = require("util"),
    _ = require('underscore'),
    PDFLine = require('./pdfline'),
    PDFFill = require('./pdffill'),
    PDFFont = require('./pdffont');

(function () {
    // private static
    var _nextId = 1;
    var _name = 'PDFCanvas';

    // alias some functions to make (compiled) code shorter
    var m = Math;
    var mr = m.round;
    var ms = m.sin;
    var mc = m.cos;
    var abs = m.abs;
    var sqrt = m.sqrt;

    // precompute "00" to "FF"
    var dec2hex = [];
    for (var i = 0; i < 16; i++) {
        for (var j = 0; j < 16; j++) {
            dec2hex[i * 16 + j] = i.toString(16) + j.toString(16);
        }
    }

    function createMatrixIdentity() {
        return [
            [1, 0, 0],
            [0, 1, 0],
            [0, 0, 1]
        ];
    }

    function matrixMultiply(m1, m2) {
        var result = createMatrixIdentity();

        for (var x = 0; x < 3; x++) {
            for (var y = 0; y < 3; y++) {
                var sum = 0;

                for (var z = 0; z < 3; z++) {
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
        var str, alpha = 1;

        styleString = String(styleString);
        if (styleString.substring(0, 3) == 'rgb') {
            var start = styleString.indexOf('(', 3);
            var end = styleString.indexOf(')', start + 1);
            var guts = styleString.substring(start + 1, end).split(',');

            str = '#';
            for (var i = 0; i < 3; i++) {
                str += dec2hex[Number(guts[i])];
            }

            if (guts.length == 4 && styleString.substr(3, 1) == 'a') {
                alpha = guts[3];
            }
        } else {
            str = styleString;
        }

        return {color:str, alpha:alpha};
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

    /**
     * This class implements CanvasRenderingContext2D interface as described by
     * the WHATWG.
     * @param {HTMLElement} surfaceElement The element that the 2D context should
     * be associated with
     */
    function CanvasRenderingContext2D_(canvasTarget, scaledWidth, scaledHeight) {
        // private
        var _id = _nextId++;

        // public (every instance will have their own copy of these methods, needs to be lightweight)
        this.get_id = function() { return _id; };
        this.get_name = function() { return _name + _id; };

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

        if (!_.has(canvasTarget, "HLines") || !_.isArray(canvasTarget.HLines))
            canvasTarget.HLines = [];
        if (!_.has(canvasTarget, "VLines") || !_.isArray(canvasTarget.VLines))
            canvasTarget.VLines = [];
        if (!_.has(canvasTarget, "Fills") || !_.isArray(canvasTarget.Fills))
            canvasTarget.Fills = [];
        if (!_.has(canvasTarget, "Texts") || !_.isArray(canvasTarget.Texts))
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
    var _drawPDFLine = function(p1, p2, lineWidth, color) {
        var dashedLine = _.isArray(this.dashArray) && (this.dashArray.length > 1);
        var pL = new PDFLine(p1.x, p1.y, p2.x, p2.y, lineWidth, color, dashedLine);
        pL.processLine(this.canvas);
    };

    var _drawPDFFill = function(cp, min, max, color) {
        var width = max.x - min.x;
        var height = max.y - min.y;
        var pF = new PDFFill(cp.x, cp.y, width, height, color);
        pF.processFill(this.canvas);
    };

    var _needRemoveRect = function(x, y, w, h) {
        var retVal = (Math.abs(w - Math.abs(h)) < 1 && w < 13);
        if (retVal) {
            nodeUtil.p2jinfo("Skipped: tiny rect: w=" + w + ", h=" + h);
        }
        return retVal;
    };

    var contextPrototype = CanvasRenderingContext2D_.prototype;

    contextPrototype.getContext = function(ctxType) {
        return (ctxType === "2d") ? this : null;
    };

    contextPrototype.setLineDash = function(lineDash) {
        this.dashArray = lineDash;
    };

    contextPrototype.getLineDash= function() {
        return this.dashArray;
    };

    contextPrototype.fillText = function(text, x, y, maxWidth, fontSize) {
        if (!text || text.trim().length < 1)
            return;
        var p = this.getCoords_(x, y);

        var a = processStyle(this.fillStyle || this.strokeStyle);
        var color = (!!a) ? a.color : '#000000';

        this.currentFont.processText(p, text, maxWidth, color, fontSize, this.canvas, this.m_);
    };

    contextPrototype.strokeText = function(text, x, y, maxWidth) {
        //MQZ. 10/23/2012, yeah, no hollow text for now
        this.fillText(text, x, y, maxWidth);
    };

    contextPrototype.setFont = function(fontObj) {
        if ((!!this.currentFont) && _.isFunction(this.currentFont.clean)) {
            this.currentFont.clean();
            this.currentFont = null;
        }

        this.currentFont = new PDFFont(fontObj);
    };

    contextPrototype.clearRect = function () {
    };

    contextPrototype.beginPath = function () {
        // TODO: Branch current matrix so that save/restore has no effect
        //       as per safari docs.
        this.currentPath_ = [];
    };

    contextPrototype.moveTo = function (aX, aY) {
        var p = this.getCoords_(aX, aY);
        this.currentPath_.push({type:'moveTo', x:p.x, y:p.y});
        this.currentX_ = p.x;
        this.currentY_ = p.y;
    };

    contextPrototype.lineTo = function (aX, aY) {
        var p = this.getCoords_(aX, aY);
        this.currentPath_.push({type:'lineTo', x:p.x, y:p.y});

        this.currentX_ = p.x;
        this.currentY_ = p.y;
    };

    contextPrototype.bezierCurveTo = function (aCP1x, aCP1y, aCP2x, aCP2y, aX, aY) {
        var p = this.getCoords_(aX, aY);
        var cp1 = this.getCoords_(aCP1x, aCP1y);
        var cp2 = this.getCoords_(aCP2x, aCP2y);
        bezierCurveTo(this, cp1, cp2, p);
    };

    // Helper function that takes the already fixed cordinates.
    function bezierCurveTo(self, cp1, cp2, p) {
        self.currentPath_.push({
            type:'bezierCurveTo',
            cp1x:cp1.x,
            cp1y:cp1.y,
            cp2x:cp2.x,
            cp2y:cp2.y,
            x:p.x,
            y:p.y
        });
        self.currentX_ = p.x;
        self.currentY_ = p.y;
    }

    contextPrototype.quadraticCurveTo = function (aCPx, aCPy, aX, aY) {
        // the following is lifted almost directly from
        // http://developer.mozilla.org/en/docs/Canvas_tutorial:Drawing_shapes

        var cp = this.getCoords_(aCPx, aCPy);
        var p = this.getCoords_(aX, aY);

        var cp1 = {
            x:this.currentX_ + 2.0 / 3.0 * (cp.x - this.currentX_),
            y:this.currentY_ + 2.0 / 3.0 * (cp.y - this.currentY_)
        };
        var cp2 = {
            x:cp1.x + (p.x - this.currentX_) / 3.0,
            y:cp1.y + (p.y - this.currentY_) / 3.0
        };

        bezierCurveTo(this, cp1, cp2, p);
    };

    contextPrototype.arc = function (aX, aY, aRadius, aStartAngle, aEndAngle, aClockwise) {
        var arcType = aClockwise ? 'at' : 'wa';

        var xStart = aX + mc(aStartAngle) * aRadius;
        var yStart = aY + ms(aStartAngle) * aRadius;

        var xEnd = aX + mc(aEndAngle) * aRadius;
        var yEnd = aY + ms(aEndAngle) * aRadius;

        // IE won't render arches drawn counter clockwise if xStart == xEnd.
        if (xStart == xEnd && !aClockwise) {
            xStart += 0.125; // Offset xStart by 1/80 of a pixel. Use something
            // that can be represented in binary
        }

        var p = this.getCoords_(aX, aY);
        var pStart = this.getCoords_(xStart, yStart);
        var pEnd = this.getCoords_(xEnd, yEnd);

        this.currentPath_.push({type:arcType,
            x:p.x,
            y:p.y,
            radius:aRadius,
            xStart:pStart.x,
            yStart:pStart.y,
            xEnd:pEnd.x,
            yEnd:pEnd.y});

    };

    contextPrototype.rect = function (aX, aY, aWidth, aHeight) {
        if (_needRemoveRect.call(this, aX, aY, aWidth, aHeight)) {
            return;//try to remove the rectangle behind radio buttons and checkboxes
        }

        this.moveTo(aX, aY);
        this.lineTo(aX + aWidth, aY);
        this.lineTo(aX + aWidth, aY + aHeight);
        this.lineTo(aX, aY + aHeight);
        this.closePath();
    };

    contextPrototype.strokeRect = function (aX, aY, aWidth, aHeight) {
        if (_needRemoveRect.call(this, aX, aY, aWidth, aHeight)) {
            return;//try to remove the rectangle behind radio buttons and checkboxes
        }

        var oldPath = this.currentPath_;
        this.beginPath();

        this.moveTo(aX, aY);
        this.lineTo(aX + aWidth, aY);
        this.lineTo(aX + aWidth, aY + aHeight);
        this.lineTo(aX, aY + aHeight);
        this.closePath();
        this.stroke();

        this.currentPath_ = oldPath;
    };

    contextPrototype.fillRect = function (aX, aY, aWidth, aHeight) {
        if (_needRemoveRect.call(this, aX, aY, aWidth, aHeight)) {
            return;//try to remove the rectangle behind radio buttons and checkboxes
        }

        var oldPath = this.currentPath_;
        this.beginPath();

        this.moveTo(aX, aY);
        this.lineTo(aX + aWidth, aY);
        this.lineTo(aX + aWidth, aY + aHeight);
        this.lineTo(aX, aY + aHeight);
        this.closePath();
        this.fill();

        this.currentPath_ = oldPath;
    };

    contextPrototype.createLinearGradient = function (aX0, aY0, aX1, aY1) {
        var gradient = new CanvasGradient_('gradient');
        gradient.x0_ = aX0;
        gradient.y0_ = aY0;
        gradient.x1_ = aX1;
        gradient.y1_ = aY1;
        return gradient;
    };

    contextPrototype.createRadialGradient = function (aX0, aY0, aR0, aX1, aY1, aR1) {
        var gradient = new CanvasGradient_('gradientradial');
        gradient.x0_ = aX0;
        gradient.y0_ = aY0;
        gradient.r0_ = aR0;
        gradient.x1_ = aX1;
        gradient.y1_ = aY1;
        gradient.r1_ = aR1;
        return gradient;
    };

    contextPrototype.drawImage = function (image, var_args) {
        //MQZ. no image drawing support for now
    };

    contextPrototype.getImageData = function (x, y, w, h) {
        //MQZ. returns empty data buffer for now
        return {
            width:w,
            height:h,
            data:new Uint8Array(w * h * 4)
        };
    };

    contextPrototype.stroke = function (aFill) {
        if (this.currentPath_.length < 2) {
            return;
        }

        var a = processStyle(aFill ? this.fillStyle : this.strokeStyle);
        var color = a.color;
//        var opacity = a.alpha * this.globalAlpha;
        var lineWidth = this.lineScale_ * this.lineWidth;

        var min = {x:null, y:null};
        var max = {x:null, y:null};

        for (var i = 0; i < this.currentPath_.length; i++) {
            var p = this.currentPath_[i];

            switch (p.type) {
                case 'moveTo':
                    break;
                case 'lineTo':
                    if (!aFill) { //lines
                        if (i > 0) {
                            _drawPDFLine.call(this, this.currentPath_[i-1], p, lineWidth, color);
                        }
                    }
                    break;
                case 'close':
                    if (!aFill) { //lines
                        if (i > 0) {
                            _drawPDFLine.call(this, this.currentPath_[i-1], this.currentPath_[0], lineWidth, color);
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

        if (aFill) { //fill
            _drawPDFFill.call(this, min, min, max, color);
        }
    };

    contextPrototype.fill = function () {
        this.stroke(true);
    };

    contextPrototype.closePath = function () {
        this.currentPath_.push({type:'close'});
    };

    /**
     * @private
     */
    contextPrototype.getCoords_ = function (aX, aY) {
        var m = this.m_;
        return {
            x: (aX * m[0][0] + aY * m[1][0] + m[2][0]),
            y: (aX * m[0][1] + aY * m[1][1] + m[2][1])
        };
    };

    contextPrototype.save = function () {
        var o = {};
        copyState(this, o);
        this.aStack_.push(o);
        this.mStack_.push(this.m_);
        this.m_ = matrixMultiply(createMatrixIdentity(), this.m_);
    };

    contextPrototype.restore = function () {
        copyState(this.aStack_.pop(), this);
        this.m_ = this.mStack_.pop();
    };

    function matrixIsFinite(m) {
        for (var j = 0; j < 3; j++) {
            for (var k = 0; k < 2; k++) {
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
            var det = m[0][0] * m[1][1] - m[0][1] * m[1][0];
            ctx.lineScale_ = sqrt(abs(det));
        }
    }

    contextPrototype.translate = function (aX, aY) {
        var m1 = [
            [1, 0, 0],
            [0, 1, 0],
            [aX, aY, 1]
        ];

        setM(this, matrixMultiply(m1, this.m_), false);
    };

    contextPrototype.rotate = function (aRot) {
        var c = mc(aRot);
        var s = ms(aRot);

        var m1 = [
            [c, s, 0],
            [-s, c, 0],
            [0, 0, 1]
        ];

        setM(this, matrixMultiply(m1, this.m_), false);
    };

    contextPrototype.scale = function (aX, aY) {
        this.arcScaleX_ *= aX;
        this.arcScaleY_ *= aY;
        var m1 = [
            [aX, 0, 0],
            [0, aY, 0],
            [0, 0, 1]
        ];

        setM(this, matrixMultiply(m1, this.m_), true);
    };

    contextPrototype.transform = function (m11, m12, m21, m22, dx, dy) {
        var m1 = [
            [m11, m12, 0],
            [m21, m22, 0],
            [dx, dy, 1]
        ];

        setM(this, matrixMultiply(m1, this.m_), true);
    };

    contextPrototype.setTransform = function (m11, m12, m21, m22, dx, dy) {
        var m = [
            [m11, m12, 0],
            [m21, m22, 0],
            [dx, dy, 1]
        ];

        setM(this, m, true);
    };

    /******** STUBS ********/
    contextPrototype.clip = function () {
        // TODO: Implement
    };

    contextPrototype.arcTo = function () {
        // TODO: Implement
    };

    contextPrototype.createPattern = function () {
        return new CanvasPattern_;
    };

    // Gradient / Pattern Stubs
    function CanvasGradient_(aType) {
        this.type_ = aType;
        this.x0_ = 0;
        this.y0_ = 0;
        this.r0_ = 0;
        this.x1_ = 0;
        this.y1_ = 0;
        this.r1_ = 0;
        this.colors_ = [];
    }

    CanvasGradient_.prototype.addColorStop = function (aOffset, aColor) {
        aColor = processStyle(aColor);
        this.colors_.push({offset:aOffset,
            color:aColor.color,
            alpha:aColor.alpha});
    };

    function CanvasPattern_() {
    }

    // set up externs
    module.exports = CanvasRenderingContext2D_;
//  CanvasRenderingContext2D = CanvasRenderingContext2D_;
//  CanvasGradient = CanvasGradient_;
//  CanvasPattern = CanvasPattern_;

})();
