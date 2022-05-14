import nodeUtil from "util";
import PDFUnit from "./pdfunit.js";

export default class PDFFill{
    // constructor
    constructor(x, y, width, height, color) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.color = color;
    }

    processFill(targetData) {
        //MQZ.07/29/2013: when color is not in color dictionary, set the original color (oc)
        const clrId = PDFUnit.findColorIndex(this.color);
        const colorObj = (clrId > 0 && clrId < PDFUnit.colorCount()) ? {clr: clrId} : {oc: this.color};

        const oneFill = {x:PDFUnit.toFormX(this.x),
                       y:PDFUnit.toFormY(this.y),
                       w:PDFUnit.toFormX(this.width),
                       h:PDFUnit.toFormY(this.height),
                       ...colorObj};

        
        if (oneFill.w < 2 && oneFill.h < 2) {
            nodeUtil.p2jinfo("Skipped: tiny fill: " + oneFill.w + " x " + oneFill.h);
            return; //skip short thick lines, like PA SPP lines behinds checkbox
        }

        targetData.Fills.push(oneFill);
    }
}