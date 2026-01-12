import process from "node:process";
import console from "node:console";
import fs from "node:fs";
import { EventEmitter } from "node:events";

import { PDFJS } from "./pdfjs-code.js";
import { initLogger } from "./pdfjs-logger.js";

// Initialize the logger with the actual PDFJS instance
initLogger(PDFJS);

// Create typed wrapper for internal use
const PJS = /** @type {import("../src/types/pdfjs").PDFJSAPI} */ (
  /** @type {any} */ (PDFJS)
);

import { _PARSER_SIG } from "./pkinfo.js";
import PDFField from "./pdffield.js";
import PDFFont from "./pdffont.js";
import PDFUnit from "./pdfunit.js";
import PTIXmlParser from "./ptixmlinject.js";
import { createScratchCanvas } from "./pdfcanvas.js";

//start of helper classes
class PDFPageParser {
  //static
  static RenderingStates = {
    INITIAL: 0,
    RUNNING: 1,
    PAUSED: 2,
    FINISHED: 3,
  };

  //public
  id = -1;
  pdfPage = null;
  ptiParser = null;
  scale = 0;
  viewport = null;
  renderingState = -1;

  Fields = null;
  Boxsets = null;
  ctxCanvas = null;

  #_addField(field) {
    if (!PDFField.isFormElement(field)) {
      PJS.warn("NOT valid form element", field);
      return;
    }

    const oneField = new PDFField(
      field,
      this.viewport,
      this.Fields,
      this.Boxsets
    );
    oneField.processField();
  }

  // constructor
  constructor(pdfPage, id, scale, ptiParser) {
    // public, this instance copies
    this.id = id;
    this.pdfPage = pdfPage;
    this.ptiParser = ptiParser;

    this.scale = scale || 1.0;

    //leave out the 2nd parameter in order to use page's default rotation (for both portrait and landscape form)
    this.viewport = this.pdfPage.getViewport(this.scale);

    this.renderingState = PDFPageParser.RenderingStates.INITIAL;

    //form elements other than radio buttons and check boxes
    this.Fields = [];
    //form elements: radio buttons and check boxes
    this.Boxsets = [];
    this.ctxCanvas = {};
  }

  get width() {
    return PDFUnit.toFormX(this.viewport.width);
  }
  get height() {
    return PDFUnit.toFormY(this.viewport.height);
  }
  get HLines() {
    return this.ctxCanvas.HLines;
  }
  get VLines() {
    return this.ctxCanvas.VLines;
  }
  get Fills() {
    return this.ctxCanvas.Fills;
  }
  get Texts() {
    return this.ctxCanvas.Texts;
  }

  destroy() {
    this.pdfPage.destroy();
    this.pdfPage = null;

    this.ptiParser = null;
    this.Fields = null;
    this.Boxsets = null;
    this.ctxCanvas = null;
  }

  getPagePoint(x, y) {
    return this.viewport.convertToPdfPoint(x, y);
  }

  parsePage(callback, errorCallBack) {
    if (this.renderingState !== PDFPageParser.RenderingStates.INITIAL) {
      errorCallBack("Must be in new state before drawing");
      return;
    }

    this.renderingState = PDFPageParser.RenderingStates.RUNNING;

    const canvas = createScratchCanvas(1, 1);
    const ctx = canvas.getContext("2d");

    const selfAddField = this.#_addField.bind(this);
    function pageViewDrawCallback(error) {
      this.renderingState = PDFPageParser.RenderingStates.FINISHED;

      if (error) {
        console.error(error);
        errorCallBack(`Error: Page ${this.id + 1}: ${error.message}`);
      } else {
        if (this.ptiParser) {
          const extraFields = this.ptiParser.getFields(parseInt(this.id) + 1);
          extraFields.forEach((field) => selfAddField(field));
        }

        this.ctxCanvas = ctx.canvas;
        this.stats = this.pdfPage.stats;

        PJS.info(`Success: Page ${this.id + 1}`);
        callback();
      }
    }

    const renderContext = {
      canvasContext: ctx,
      viewport: this.viewport,
    };

    this.pdfPage.render(renderContext).then(
      (data) => {
        this.pdfPage.getAnnotations().then(
          (fields) => {
            fields.forEach((field) => this.#_addField(field));
            pageViewDrawCallback.call(this, null);
          },
          (err) => errorCallBack(`pdfPage.getAnnotations error:${err}`)
        );
      },
      (err) => pageViewDrawCallback.call(this, err)
    );
  }
}

////////////////////////////////Start of Node.js Module
export default class PDFJSClass extends EventEmitter {
  pdfDocument = null;
  pages = null;
  rawTextContents = null;

  needRawText = null;

  // constructor
  constructor(needRawText) {
    super();

    // public, this instance copies
    this.pdfDocument = null;
    this.pages = [];
    this.rawTextContents = [];

    this.needRawText = needRawText;
  }

  raiseErrorEvent(errMsg) {
    console.error(errMsg);
    process.nextTick(() => this.emit("pdfjs_parseDataError", errMsg));
    // this.emit("error", errMsg);
    return errMsg;
  }

  raiseReadyEvent(data) {
    process.nextTick(() => this.emit("pdfjs_parseDataReady", data));
    return data;
  }

  parsePDFData(arrayBuffer, password) {
    this.resetCurrentObject();
    const parameters = { password, data: arrayBuffer };
    PJS.getDocument(parameters).then(
      (pdfDocument) => this.load(pdfDocument, 1),
      (error) => this.raiseErrorEvent(error)
    );
  }

  tryLoadFieldInfoXML(pdfFilePath) {
    const _sufInfo = "_fieldInfo.xml";
    const fieldInfoXMLPath = pdfFilePath.replace(".pdf", _sufInfo);
    if (
      fieldInfoXMLPath.indexOf(_sufInfo) < 1 ||
      !fs.existsSync(fieldInfoXMLPath)
    ) {
      return;
    }
    PJS.info(`About to load fieldInfo XML : ${fieldInfoXMLPath}`);

    this.ptiParser = new PTIXmlParser();
    this.ptiParser.parseXml(fieldInfoXMLPath, (err) => {
      if (err) {
        PJS.warn(`fieldInfo XML Error: ${JSON.stringify(err)}`);
        this.ptiParser = null;
      } else {
        PJS.info("fieldInfo XML loaded.");
      }
    });
  }

  load(pdfDocument, scale) {
    this.pdfDocument = pdfDocument;

    return this.loadMetaData().then(
      () => this.loadPages(),
      (error) => this.raiseErrorEvent(`loadMetaData error: ${error}`)
    );
  }

  loadMetaData() {
    return this.pdfDocument.getMetadata().then(
      (data) => {
        this.documentInfo = data.info;
        this.metadata = data.metadata?.metadata ?? {};
        this.parseMetaData();
      },
      (error) => this.raiseErrorEvent(`pdfDocument.getMetadata error: ${error}`)
    );
  }

  parseMetaData() {
    const meta = {
      Transcoder: _PARSER_SIG,
      Meta: { ...this.documentInfo, Metadata: this.metadata },
    };
    this.raiseReadyEvent(meta);
    this.emit("readable", meta);
  }

  loadPages() {
    const pagesCount = this.pdfDocument.numPages;
    const pagePromises = [];
    for (let i = 1; i <= pagesCount; i++)
      pagePromises.push(this.pdfDocument.getPage(i));

    const pagesPromise = PJS.Promise.all(pagePromises);

    PJS.info(`PDF loaded. pagesCount = ${pagesCount}`);

    return pagesPromise.then(
      (promisedPages) => this.parsePage(promisedPages, 0, 1.5),
      (error) => this.raiseErrorEvent(`pagesPromise error: ${error}`)
    );
  }

  parsePage(promisedPages, id, scale) {
    PJS.info(`start to parse page:${id + 1}`);

    const pdfPage = promisedPages[id];
    const pageParser = new PDFPageParser(pdfPage, id, scale, this.ptiParser);

    function continueOnNextPage() {
      PJS.info(`complete parsing page:${id + 1}`);
      if (id === this.pdfDocument.numPages - 1) {
        this.raiseReadyEvent({ Pages: this.pages });
        //v1.1.2: signal end of parsed data with null
        process.nextTick(() => this.raiseReadyEvent(null));
        this.emit("data", null);
      } else {
        process.nextTick(() => this.parsePage(promisedPages, ++id, scale));
      }
    }

    pageParser.parsePage(
      (data) => {
        const page = {
          Width: pageParser.width,
          Height: pageParser.height,
          HLines: pageParser.HLines,
          VLines: pageParser.VLines,
          Fills: pageParser.Fills,
          //needs to keep current default output format, text content will output to a separate file if '-c' command line argument is set
          //                Content:pdfPage.getTextContent(),
          Texts: pageParser.Texts,
          Fields: pageParser.Fields,
          Boxsets: pageParser.Boxsets,
        };

        this.pages.push(page);

        this.emit("data", page);

        if (this.needRawText) {
          pdfPage.getTextContent().then(
            (textContent) => {
              this.rawTextContents.push(textContent);
              PJS.info(`complete parsing raw text content:${id + 1}`);
              continueOnNextPage.call(this);
            },
            (error) =>
              this.raiseErrorEvent(`pdfPage.getTextContent error: ${error}`)
          );
        } else {
          continueOnNextPage.call(this);
        }
      },
      (errMsg) => this.raiseErrorEvent(errMsg)
    );
  }

  getRawTextContent() {
    let retVal = "";
    if (!this.needRawText) return retVal;

    this.rawTextContents.forEach((textContent, index) => {
      let prevText = null;
      
      textContent.bidiTexts.forEach((textObj, idx) => {
        // Check if on same line
        // Use a tolerance relative to font size for better accuracy
        // Typical line spacing is 120% of font size, so 10-15% tolerance is reasonable
        const tolerance = prevText ? (prevText.fontSize || 12) * 0.15 : 2;
        const sameLine = prevText && Math.abs(textObj.y - prevText.y) <= tolerance;
        
        if (sameLine) {
          // spaceWidth is in unscaled coordinates (no textHScale, matching JSON w property)
          const { spaceWidth, startX, width, textHScale } = prevText;
          
          // Use actual calculated text width (from glyph widths)
          // width is in unscaled coordinates, but startX is in scaled coordinates
          // So we must apply textHScale to width before adding to startX
          // This matches canvas.js: current.x += x * textHScale (line 1267)
          const prevTextEndX = startX + (width * textHScale);
          
          // Calculate gap between end of previous text and start of current text
          // gap is in SCALED coordinates (both textObj.x and prevTextEndX are scaled)
          const gap = textObj.x - prevTextEndX;
          
          // Scale spaceWidth to match gap's coordinate system
          const scaledSpaceWidth = spaceWidth * textHScale;
          
          // Add spaces if gap is positive and significant (> 30% of scaled space width)
          // Also check that scaledSpaceWidth is valid to avoid division by zero
          if (scaledSpaceWidth > 0 && gap > scaledSpaceWidth * 0.3) {
            const numSpaces = Math.round(gap / scaledSpaceWidth);
            prevText.str += ' '.repeat(Math.max(1, numSpaces));
          }
          
          // Append current text
          prevText.str += textObj.str;
          
          // Update prevText to track current text for next iteration
          prevText.startX = textObj.x;
          prevText.width = textObj.width;
          prevText.spaceWidth = textObj.spaceWidth;
          prevText.textHScale = textObj.textHScale;
        } else {
          // Different line or first text
          if (prevText) {
            retVal += `${prevText.str}\r\n`;
          }
          
          // Initialize new text object with font metrics
          prevText = { 
            str: textObj.str, 
            y: textObj.y, 
            startX: textObj.x,
            width: textObj.width,
            spaceWidth: textObj.spaceWidth,
            textHScale: textObj.textHScale,
            fontSize: textObj.fontSize  // Keep for tolerance calculation
          };
        }
      });
      
      if (prevText) {
        retVal += prevText.str;
      }
      retVal += `\r\n----------------Page (${index}) Break----------------\r\n`;
    });

    return retVal;
  }

  getAllFieldsTypes() {
    return PDFField.getAllFieldsTypes({ Pages: this.pages || [] });
  }

  getAllFieldData() {
    return PDFField.getAllFieldData({ Pages: this.pages || [] });
  }

  getMergedTextBlocksIfNeeded() {
    for (let p = 0; p < this.pages.length; p++) {
      let prevText = null;
      const page = this.pages[p];

      page.Texts.sort(PDFFont.compareBlockPos);
      page.Texts = page.Texts.filter((t, j) => {
        const isDup = j > 0 && PDFFont.areDuplicateBlocks(page.Texts[j - 1], t);
        if (isDup) {
          PJS.info(
            `skipped: dup text block: ${t.R[0].T}`
          );
        }
        return !isDup;
      });

      for (let i = 0; i < page.Texts.length; i++) {
        const text = page.Texts[i];

        if (prevText) {
          if (
            PDFFont.areAdjacentBlocks(prevText, text) &&
            PDFFont.haveSameStyle(prevText, text)
          ) {
            const preT = prevText.R[0].T;
            const curT = text.R[0].T;

            prevText.R[0].T += text.R[0].T;
            prevText.w += text.w;
            text.merged = true;

            const mergedText = prevText.R[0].T;
            PJS.info(
              `merged text block: ${preT} + ${curT} => ${mergedText}`
            );
            prevText = null; //yeah, only merge two blocks for now
          } else {
            prevText = text;
          }
        } else {
          prevText = text;
        }
      }

      page.Texts = page.Texts.filter((t) => !t.merged);
    }

    return { Pages: this.pages };
  }

  resetCurrentObject() {
    if (this.pdfDocument) this.pdfDocument.destroy();
    this.pdfDocument = null;

    this.pages = [];
    this.rawTextContents = [];
  }

  destroy() {
    this.removeAllListeners();

    if (this.pdfDocument) this.pdfDocument.destroy();
    this.pdfDocument = null;

    this.pages = null;
    this.rawTextContents = null;
  }
}

// Export typed PJS for backward compatibility
export { PJS };
