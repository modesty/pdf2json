import nodeUtil from "util";
import fs from "fs";
import path from 'path';
import {fileURLToPath} from 'url';

import {EventEmitter} from "events";
import {Blob} from "buffer";
import {DOMParser} from "@xmldom/xmldom";

import PDFCanvas from "./pdfcanvas.js";
import PDFUnit from "./pdfunit.js";
import PDFField from "./pdffield.js";
import PDFAnno from "./pdfanno.js";
import Image from "./pdfimage.js";    
import PDFFont from "./pdffont.js";
import PTIXmlParser from "./ptixmlinject.js";

import { pkInfo, _PARSER_SIG } from "../pkinfo.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const _pdfjsFiles = [
    'shared/util.js',
    'shared/colorspace.js',
    'shared/pattern.js',
    'shared/function.js',
    'shared/annotation.js',

    'core/core.js',
    'core/obj.js',
    'core/charsets.js',
    'core/crypto.js',
    'core/evaluator.js',
    'core/fonts.js',
    'core/font_renderer.js',
    'core/glyphlist.js',
    'core/image.js',
    'core/metrics.js',
    'core/parser.js',
    'core/stream.js',
    'core/worker.js',
    'core/jpx.js',
    'core/jbig2.js',
    'core/bidi.js',
    'core/jpg.js',
    'core/chunked_stream.js',
    'core/pdf_manager.js',
    'core/cmap.js',
    'core/cidmaps.js',

    'display/canvas.js',
    'display/font_loader.js',
    'display/metadata.js',
    'display/api.js'
];

//////replacing HTML5 canvas with PDFCanvas (in-memory canvas)
function createScratchCanvas(width, height) { return new PDFCanvas({}, width, height); }

const PDFJS = {};
const globalScope = {console};

const baseDir = `${__dirname}/../base/`;
const _baseCode = _pdfjsFiles.reduce( (preContent, fileName, idx, arr) => preContent += fs.readFileSync(baseDir + fileName, 'utf8'), "");
eval(_baseCode);

////////////////////////////////start of helper classes
class PDFPageParser {
    //static
    static RenderingStates = {
        INITIAL: 0,
        RUNNING: 1,
        PAUSED: 2,
        FINISHED: 3
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

    #_addField (field) {
        if (!PDFField.isFormElement(field)) {
            nodeUtil.p2jwarn("NOT valid form element", field);
            return;
        }

        const oneField = new PDFField(field, this.viewport, this.Fields, this.Boxsets);
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
    
    get width() { return PDFUnit.toFormX(this.viewport.width); }
    get height() { return PDFUnit.toFormY(this.viewport.height); }
    get HLines() { return this.ctxCanvas.HLines; }
    get VLines() { return this.ctxCanvas.VLines; }
    get Fills() { return this.ctxCanvas.Fills; }
    get Texts() { return this.ctxCanvas.Texts; }

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
            errorCallBack('Must be in new state before drawing');
            return;
        }

        this.renderingState = PDFPageParser.RenderingStates.RUNNING;

        const canvas = createScratchCanvas(1, 1);
        const ctx = canvas.getContext('2d');

        function pageViewDrawCallback(error) {
            this.renderingState = PDFPageParser.RenderingStates.FINISHED;

            if (error) {
                console.error(error);
                errorCallBack(`Error: Page ${this.id + 1}: ${error.message}`);
            }
            else {
                if (this.ptiParser) {
                    const extraFields = this.ptiParser.getFields(parseInt(this.id) + 1);
                    extraFields.forEach( field => this.#_addField(field) );
                }
                
                this.ctxCanvas = ctx.canvas;
                this.stats = this.pdfPage.stats;

                nodeUtil.p2jinfo(`Success: Page ${this.id + 1}`);
                callback();
            }
        }

        const renderContext = {
            canvasContext:ctx,
            viewport:this.viewport
        };

        this.pdfPage.render(renderContext).then(
            data => {
                this.pdfPage.getAnnotations().then(
                    fields => {
                        fields.forEach(field => this.#_addField(field));
                        pageViewDrawCallback.call(this, null);
                    },
                    err => errorCallBack("pdfPage.getAnnotations error:" + err));
            },
            err => pageViewDrawCallback.call(this, err)
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
        process.nextTick( () => this.emit("pdfjs_parseDataError", errMsg));
        // this.emit("error", errMsg);
        return errMsg;
    }

    raiseReadyEvent(data) {
        process.nextTick( () => this.emit("pdfjs_parseDataReady", data) );
        return data;
    }


    parsePDFData(arrayBuffer, password) {
        this.pdfDocument = null;

        const parameters = {password: password, data: arrayBuffer};
        PDFJS.getDocument(parameters).then(
            pdfDocument => this.load(pdfDocument, 1),
            error => this.raiseErrorEvent(error)
        );
    };

    tryLoadFieldInfoXML(pdfFilePath) {
        const _sufInfo = "_fieldInfo.xml";
        const fieldInfoXMLPath = pdfFilePath.replace(".pdf", _sufInfo);
        if ((fieldInfoXMLPath.indexOf(_sufInfo) < 1) || (!fs.existsSync(fieldInfoXMLPath))) {
            return;
        }
        nodeUtil.p2jinfo("About to load fieldInfo XML : " + fieldInfoXMLPath);

        this.ptiParser = new PTIXmlParser();
        this.ptiParser.parseXml(fieldInfoXMLPath, err => {
            if (err) {
                nodeUtil.p2jwarn("fieldInfo XML Error: " + JSON.stringify(err));
                this.ptiParser = null;
            }
            else {
                nodeUtil.p2jinfo("fieldInfo XML loaded.");
            }
        });
    }

    load(pdfDocument, scale) {
        this.pdfDocument = pdfDocument;

	    return this.loadMetaData().then(
		    () => this.loadPages(),
			error => this.raiseErrorEvent("loadMetaData error: " + error)
	    );
    }

	loadMetaData() {
		return this.pdfDocument.getMetadata().then(
			data => {
				this.documentInfo = data.info;
				this.metadata = data.metadata?.metadata ?? {};
				this.parseMetaData();
			},
			error => this.raiseErrorEvent("pdfDocument.getMetadata error: " + error)
		);
	}

    parseMetaData() {
        const meta = {Transcoder: _PARSER_SIG, Meta: {...this.documentInfo, Metadata: this.metadata}};
        this.raiseReadyEvent(meta);
        this.emit("readable", meta);
    }

	loadPages() {
		const pagesCount = this.pdfDocument.numPages;
		const pagePromises = [];
		for (let i = 1; i <= pagesCount; i++)
			pagePromises.push(this.pdfDocument.getPage(i));

		const pagesPromise = PDFJS.Promise.all(pagePromises);

		nodeUtil.p2jinfo("PDF loaded. pagesCount = " + pagesCount);

		return pagesPromise.then(
			promisedPages => this.parsePage(promisedPages, 0, 1.5),
			error => this.raiseErrorEvent("pagesPromise error: " + error)
		);
	}

    parsePage(promisedPages, id, scale) {
        nodeUtil.p2jinfo("start to parse page:" + (id+1));

        const pdfPage = promisedPages[id];
        const pageParser = new PDFPageParser(pdfPage, id, scale, this.ptiParser);

        function continueOnNextPage() {
            nodeUtil.p2jinfo("complete parsing page:" + (id+1));
            if (id === (this.pdfDocument.numPages - 1) ) {
	            this.raiseReadyEvent({Pages:this.pages});                
	            //v1.1.2: signal end of parsed data with null
	            process.nextTick(() => this.raiseReadyEvent(null));
                this.emit("data", null);
            }
            else {
                process.nextTick(() => this.parsePage(promisedPages, ++id, scale));
            }
        }

        pageParser.parsePage(
	        data => {
	            const page = {
                    Width:  pageParser.width,
                    Height: pageParser.height,
	                HLines: pageParser.HLines,
	                VLines: pageParser.VLines,
	                Fills:  pageParser.Fills,
	//needs to keep current default output format, text content will output to a separate file if '-c' command line argument is set
	//                Content:pdfPage.getTextContent(),
	                Texts: pageParser.Texts,
	                Fields: pageParser.Fields,
	                Boxsets: pageParser.Boxsets
	            };

	            this.pages.push(page);
                this.emit("data", page);

	            if (this.needRawText) {
	                pdfPage.getTextContent().then(
			            textContent => {
	                        this.rawTextContents.push(textContent);
	                        nodeUtil.p2jinfo("complete parsing raw text content:" + (id+1));
	                        continueOnNextPage.call(this);
	                    },
                        error => this.raiseErrorEvent("pdfPage.getTextContent error: " + error)
	                );
	            }
	            else {
		            continueOnNextPage.call(this);
	            }
	        },
	        errMsg => this.raiseErrorEvent(errMsg)
        );
    }

    getRawTextContent() {
        let retVal = "";
        if (!this.needRawText)
            return retVal;

        this.rawTextContents.forEach( (textContent, index) => {
            let prevText = null;
            textContent.bidiTexts.forEach( (textObj, idx) => {
	            if (prevText) {
		            if (Math.abs(textObj.y - prevText.y) <= 9) {
			            prevText.str += textObj.str;
		            }
		            else {
			            retVal += prevText.str  + "\r\n";
			            prevText = textObj;
		            }
	            }
	            else {
		            prevText = textObj;
	            }

            });
	        if (prevText) {
		        retVal += prevText.str;
	        }
            retVal += "\r\n----------------Page (" + index + ") Break----------------\r\n";
        });

        return retVal;
    }

	getAllFieldsTypes() {
		return PDFField.getAllFieldsTypes({Pages:this.pages || []});
	}

	getMergedTextBlocksIfNeeded() {
		for (let p = 0; p < this.pages.length; p++) {
			let prevText = null;
			let page = this.pages[p];

			page.Texts.sort(PDFFont.compareBlockPos);
			page.Texts = page.Texts.filter( (t, j) => {
				let isDup = (j > 0) && PDFFont.areDuplicateBlocks(page.Texts[j-1], t);
				if (isDup) {
					nodeUtil.p2jinfo("skipped: dup text block: " + decodeURIComponent(t.R[0].T));
				}
				return !isDup;
			});

			for (let i = 0; i < page.Texts.length; i++) {
				let text = page.Texts[i];

				if (prevText) {
					if (PDFFont.areAdjacentBlocks(prevText, text) && PDFFont.haveSameStyle(prevText, text)) {
						let preT = decodeURIComponent(prevText.R[0].T);
						let curT = decodeURIComponent(text.R[0].T);

						prevText.R[0].T += text.R[0].T;
                        prevText.w += text.w;
                        text.merged = true;

						let mergedText = decodeURIComponent(prevText.R[0].T);
                        nodeUtil.p2jinfo(`merged text block: ${preT} + ${curT} => ${mergedText}`);
						prevText = null; //yeah, only merge two blocks for now
					}
					else {
						prevText = text;
					}
				}
				else {
					prevText = text;
				}
			}

			page.Texts = page.Texts.filter( t => !t.merged);
		}

		return {Pages:this.pages};
	}

    destroy() {
        this.removeAllListeners();

        if (this.pdfDocument)
            this.pdfDocument.destroy();
        this.pdfDocument = null;

        this.pages = null;
        this.rawTextContents = null;
    }

}