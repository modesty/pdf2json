const nodeUtil = require("util"),
    PDFLine = require('./pdfline'),
    PDFFill = require('./pdffill'),
    PDFFont = require('./pdffont');

// alias some functions to make (compiled) code shorter
const {round: mr, sin: ms, cos: mc, abs, sqrt} = Math;    

// precompute "00" to "FF"
const dec2hex = [];
for (let i = 0; i < 16; i++) {
    for (let j = 0; j < 16; j++) {
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
    let result = createMatrixIdentity();

    for (let x = 0; x < 3; x++) {
        for (let y = 0; y < 3; y++) {
            let sum = 0;

            for (let z = 0; z < 3; z++) {
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
    let str, alpha = 1;

    styleString = String(styleString);
    if (styleString.substring(0, 3) == 'rgb') {
        let start = styleString.indexOf('(', 3);
        let end = styleString.indexOf(')', start + 1);
        let guts = styleString.substring(start + 1, end).split(',');

        str = '#';
        for (let i = 0; i < 3; i++) {
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

// Helper function that takes the already fixed cordinates.
function bezierCurveToHelper(self, cp1, cp2, p) {
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

function matrixIsFinite(m) {
    for (let j = 0; j < 3; j++) {
        for (let k = 0; k < 2; k++) {
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
        let det = m[0][0] * m[1][1] - m[0][1] * m[1][0];
        ctx.lineScale_ = sqrt(abs(det));
    }
}

class CanvasPattern_ {
    constructor() {        
    }
}

// Gradient / Pattern Stubs
class CanvasGradient_ {
    constructor(aType) {
        this.type_ = aType;
        this.x0_ = 0;
        this.y0_ = 0;
        this.r0_ = 0;
        this.x1_ = 0;
        this.y1_ = 0;
        this.r1_ = 0;
        this.colors_ = [];
    }
    addColorStop(aOffset, aColor) {
        aColor = processStyle(aColor);
        this.colors_.push({offset:aOffset,
            color:aColor.color,
            alpha:aColor.alpha});
    }    
}


/**
 * This class implements CanvasRenderingContext2D interface as described by
 * the WHATWG.
 * @param {HTMLElement} surfaceElement The element that the 2D context should
 * be associated with
 */
class CanvasRenderingContext2D_ {
    constructor(canvasTarget, scaledWidth, scaledHeight) {
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

        if (!("HLines" in canvasTarget) || !Array.isArray(canvasTarget.HLines))
            canvasTarget.HLines = [];
        if (!("VLines" in canvasTarget) || !Array.isArray(canvasTarget.VLines))
            canvasTarget.VLines = [];
        if (!("Fills" in canvasTarget) || !Array.isArray(canvasTarget.Fills))
            canvasTarget.Fills = [];
        if (!("Texts" in canvasTarget) || !Array.isArray(canvasTarget.Texts))
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
    #drawPDFLine(p1, p2, lineWidth, color) {
        let dashedLine = Array.isArray(this.dashArray) && (this.dashArray.length > 1);
        let pL = new PDFLine(p1.x, p1.y, p2.x, p2.y, lineWidth, color, dashedLine);
        pL.processLine(this.canvas);
    }

    #drawPDFFill(cp, min, max, color) {
        let width = max.x - min.x;
        let height = max.y - min.y;
        let pF = new PDFFill(cp.x, cp.y, width, height, color);
        pF.processFill(this.canvas);
    }

    #needRemoveRect(x, y, w, h) {
        let retVal = (Math.abs(w - Math.abs(h)) < 1 && w < 13);
        if (retVal) {
            nodeUtil.p2jinfo("Skipped: tiny rect: w=" + w + ", h=" + h);
        }
        return retVal;
    }

    getContext(ctxType) {
        return (ctxType === "2d") ? this : null;
    }

    setLineDash(lineDash) {
        this.dashArray = lineDash;
    }

    getLineDash() {
        return this.dashArray;
    }

    fillText(text, x, y, maxWidth, fontSize) {
        if (!text || text.trim().length < 1)
            return;
        let p = this.getCoords_(x, y);

        let a = processStyle(this.fillStyle || this.strokeStyle);
        let color = (!!a) ? a.color : '#000000';

        this.currentFont.processText(p, text, maxWidth, color, fontSize, this.canvas, this.m_);
    };

    strokeText(text, x, y, maxWidth) {
        //MQZ. 10/23/2012, yeah, no hollow text for now
        this.fillText(text, x, y, maxWidth);
    }

    measureText(text) {
        console.warn("to be implemented: contextPrototype.measureText - ", text);
        let chars = text.length || 1;
        return {width: chars * (this.currentFont.spaceWidth || 5)};
    }

    setFont(fontObj) {
        if ((!!this.currentFont) && typeof(this.currentFont.clean) === "function") {
            this.currentFont.clean();
            this.currentFont = null;
        }

        this.currentFont = new PDFFont(fontObj);
    }

    clearRect() {
        console.warn("to be implemented: contextPrototype.clearRect");
    }

    beginPath() {
        // TODO: Branch current matrix so that save/restore has no effect
        //       as per safari docs.
        this.currentPath_ = [];
    }

    moveTo(aX, aY) {
        let p = this.getCoords_(aX, aY);
        this.currentPath_.push({type:'moveTo', x:p.x, y:p.y});
        this.currentX_ = p.x;
        this.currentY_ = p.y;
    }

    lineTo(aX, aY) {
        let p = this.getCoords_(aX, aY);
        this.currentPath_.push({type:'lineTo', x:p.x, y:p.y});

        this.currentX_ = p.x;
        this.currentY_ = p.y;
    }

    bezierCurveTo(aCP1x, aCP1y, aCP2x, aCP2y, aX, aY) {
        let p = this.getCoords_(aX, aY);
        let cp1 = this.getCoords_(aCP1x, aCP1y);
        let cp2 = this.getCoords_(aCP2x, aCP2y);
        bezierCurveToHelper(this, cp1, cp2, p);
    }

    quadraticCurveTo(aCPx, aCPy, aX, aY) {
        // the following is lifted almost directly from
        // http://developer.mozilla.org/en/docs/Canvas_tutorial:Drawing_shapes

        let cp = this.getCoords_(aCPx, aCPy);
        let p = this.getCoords_(aX, aY);

        let cp1 = {
            x:this.currentX_ + 2.0 / 3.0 * (cp.x - this.currentX_),
            y:this.currentY_ + 2.0 / 3.0 * (cp.y - this.currentY_)
        };
        let cp2 = {
            x:cp1.x + (p.x - this.currentX_) / 3.0,
            y:cp1.y + (p.y - this.currentY_) / 3.0
        };

        bezierCurveToHelper(this, cp1, cp2, p);
    }

    arc(aX, aY, aRadius, aStartAngle, aEndAngle, aClockwise) {
        let arcType = aClockwise ? 'at' : 'wa';

        let xStart = aX + mc(aStartAngle) * aRadius;
        let yStart = aY + ms(aStartAngle) * aRadius;

        let xEnd = aX + mc(aEndAngle) * aRadius;
        let yEnd = aY + ms(aEndAngle) * aRadius;

        // IE won't render arches drawn counter clockwise if xStart == xEnd.
        if (xStart == xEnd && !aClockwise) {
            xStart += 0.125; // Offset xStart by 1/80 of a pixel. Use something
            // that can be represented in binary
        }

        let p = this.getCoords_(aX, aY);
        let pStart = this.getCoords_(xStart, yStart);
        let pEnd = this.getCoords_(xEnd, yEnd);

        this.currentPath_.push({type:arcType,
            x:p.x,
            y:p.y,
            radius:aRadius,
            xStart:pStart.x,
            yStart:pStart.y,
            xEnd:pEnd.x,
            yEnd:pEnd.y});
    }

    rect(aX, aY, aWidth, aHeight) {
        if (this.#needRemoveRect(aX, aY, aWidth, aHeight)) {
            return;//try to remove the rectangle behind radio buttons and checkboxes
        }

        this.moveTo(aX, aY);
        this.lineTo(aX + aWidth, aY);
        this.lineTo(aX + aWidth, aY + aHeight);
        this.lineTo(aX, aY + aHeight);
        this.closePath();
    }

    strokeRect(aX, aY, aWidth, aHeight) {
        if (this.#needRemoveRect(aX, aY, aWidth, aHeight)) {
            return;//try to remove the rectangle behind radio buttons and checkboxes
        }

        let oldPath = this.currentPath_;
        this.beginPath();

        this.moveTo(aX, aY);
        this.lineTo(aX + aWidth, aY);
        this.lineTo(aX + aWidth, aY + aHeight);
        this.lineTo(aX, aY + aHeight);
        this.closePath();
        this.stroke();

        this.currentPath_ = oldPath;
    }

    fillRect(aX, aY, aWidth, aHeight) {
        if (this.#needRemoveRect(aX, aY, aWidth, aHeight)) {
            return;//try to remove the rectangle behind radio buttons and checkboxes
        }

        let oldPath = this.currentPath_;
        this.beginPath();

        this.moveTo(aX, aY);
        this.lineTo(aX + aWidth, aY);
        this.lineTo(aX + aWidth, aY + aHeight);
        this.lineTo(aX, aY + aHeight);
        this.closePath();
        this.fill();

        this.currentPath_ = oldPath;
    }

    createLinearGradient(aX0, aY0, aX1, aY1) {
        let gradient = new CanvasGradient_('gradient');
        gradient.x0_ = aX0;
        gradient.y0_ = aY0;
        gradient.x1_ = aX1;
        gradient.y1_ = aY1;
        return gradient;
    }

    createRadialGradient(aX0, aY0, aR0, aX1, aY1, aR1) {
        let gradient = new CanvasGradient_('gradientradial');
        gradient.x0_ = aX0;
        gradient.y0_ = aY0;
        gradient.r0_ = aR0;
        gradient.x1_ = aX1;
        gradient.y1_ = aY1;
        gradient.r1_ = aR1;
        return gradient;
    }

    drawImage(image, var_args) {
        //MQZ. no image drawing support for now
    }

    getImageData(x, y, w, h) {
        //MQZ. returns empty data buffer for now
        return {
            width:w,
            height:h,
            data:new Uint8Array(w * h * 4)
        };
    }

    stroke(aFill) {
        if (this.currentPath_.length < 2) {
            return;
        }

        let a = processStyle(aFill ? this.fillStyle : this.strokeStyle);
        let color = a.color;
//        let opacity = a.alpha * this.globalAlpha;
        let lineWidth = this.lineScale_ * this.lineWidth;

        let min = {x:null, y:null};
        let max = {x:null, y:null};

        for (let i = 0; i < this.currentPath_.length; i++) {
            let p = this.currentPath_[i];

            switch (p.type) {
                case 'moveTo':
                    break;
                case 'lineTo':
                    if (!aFill) { //lines
                        if (i > 0) {
                            this.#drawPDFLine(this.currentPath_[i-1], p, lineWidth, color);
                        }
                    }
                    break;
                case 'close':
                    if (!aFill) { //lines
                        if (i > 0) {
                            this.#drawPDFLine(this.currentPath_[i-1], this.currentPath_[0], lineWidth, color);
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
            this.#drawPDFFill(min, min, max, color);
        }
    }

    fill() {
        this.stroke(true);
    }

    closePath() {
        this.currentPath_.push({type:'close'});
    }

    /**
     * @private
     */
    getCoords_ (aX, aY) {
        let m = this.m_;
        return {
            x: (aX * m[0][0] + aY * m[1][0] + m[2][0]),
            y: (aX * m[0][1] + aY * m[1][1] + m[2][1])
        };
    }

    save() {
        let o = {};
        copyState(this, o);
        this.aStack_.push(o);
        this.mStack_.push(this.m_);
        this.m_ = matrixMultiply(createMatrixIdentity(), this.m_);
    }

    restore() {
        copyState(this.aStack_.pop(), this);
        this.m_ = this.mStack_.pop();
    }

    translate(aX, aY) {
        let m1 = [
            [1, 0, 0],
            [0, 1, 0],
            [aX, aY, 1]
        ];

        setM(this, matrixMultiply(m1, this.m_), false);
    }

    rotate(aRot) {
        let c = mc(aRot);
        let s = ms(aRot);

        let m1 = [
            [c, s, 0],
            [-s, c, 0],
            [0, 0, 1]
        ];

        setM(this, matrixMultiply(m1, this.m_), false);
    }

    scale(aX, aY) {
        this.arcScaleX_ *= aX;
        this.arcScaleY_ *= aY;
        let m1 = [
            [aX, 0, 0],
            [0, aY, 0],
            [0, 0, 1]
        ];

        setM(this, matrixMultiply(m1, this.m_), true);
    }

    transform(m11, m12, m21, m22, dx, dy) {
        let m1 = [
            [m11, m12, 0],
            [m21, m22, 0],
            [dx, dy, 1]
        ];

        setM(this, matrixMultiply(m1, this.m_), true);
    }

    setTransform(m11, m12, m21, m22, dx, dy) {
        let m = [
            [m11, m12, 0],
            [m21, m22, 0],
            [dx, dy, 1]
        ];

        setM(this, m, true);
    }

    /******** STUBS ********/
    clip() {
        // TODO: Implement
    }

    arcTo() {
        // TODO: Implement
    }

    createPattern() {
        return new CanvasPattern_();
    }
}

// set up externs
module.exports = CanvasRenderingContext2D_;
//  CanvasRenderingContext2D = CanvasRenderingContext2D_;
//  CanvasGradient = CanvasGradient_;
//  CanvasPattern = CanvasPattern_;