'use strict';

let nodeUtil = require("util"),
    nodeEvents = require("events"),
    fs = require('fs'),
    _ = require('lodash'),
    DOMParser = require('xmldom').DOMParser,
    PDFCanvas = require('./pdfcanvas.js'),
    PDFUnit = require('./pdfunit.js'),
    PDFField = require('./pdffield.js'),
    PDFAnno = require('./pdfanno.js'),
    Image = require('./pdfimage.js'),
    pkInfo = require('../package.json'),
    PDFFont = require('./pdffont');

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

const _PARSER_SIG = `${pkInfo.name}@${pkInfo.version} [${pkInfo.homepage}]`;

//////replacing HTML5 canvas with PDFCanvas (in-memory canvas)
function createScratchCanvas(width, height) { return new PDFCanvas({}, width, height); }

let PDFJS = {};
let globalScope = {console: console};

let _basePath = __dirname + "/../base/";
let _fileContent = '';

_pdfjsFiles.forEach( (fieldName, idx, arr) => _fileContent += fs.readFileSync(_basePath + fieldName, 'utf8') );

eval(_fileContent);

////////////////////////////////start of helper classes
let PDFPageParser = (function () {
    // private static
    let _nextId = 1;
    let _name = 'PDFPageParser';

    let RenderingStates = {
      INITIAL: 0,
      RUNNING: 1,
      PAUSED: 2,
      FINISHED: 3
    };

    let _addField = function(field) {
        if (!PDFField.isFormElement(field))
            return;

        let oneField = new PDFField(field, this.viewport, this.Fields, this.Boxsets);
        oneField.processField();
    };

    // constructor
    let cls = function (pdfPage, id, scale, ptiParser) {
        nodeEvents.EventEmitter.call(this);
        // private
        let _id = _nextId++;

        // public (every instance will have their own copy of these methods, needs to be lightweight)
        this.get_id = () => _id;
        this.get_name = () => _name + _id;

        // public, this instance copies
        this.id = id;
        this.pdfPage = pdfPage;
        this.ptiParser = ptiParser;

        this.scale = scale || 1.0;

        //leave out the 2nd parameter in order to use page's default rotation (for both portrait and landscape form)
        this.viewport = this.pdfPage.getViewport(this.scale);

        this.renderingState = RenderingStates.INITIAL;

        //form elements other than radio buttons and check boxes
        this.Fields = [];
        //form elements: radio buttons and check boxes
        this.Boxsets = [];

        //public properties
        Object.defineProperty(this, 'width', {
            get:function () {
                return PDFUnit.toFormX(this.viewport.width);
            },
            enumerable:true
        });

        Object.defineProperty(this, 'height', {
            get:function () {
                return PDFUnit.toFormY(this.viewport.height);
            },
            enumerable:true
        });
    };
    // inherit from event emitter
	nodeUtil.inherits(cls, nodeEvents.EventEmitter);

    cls.prototype.destroy = function() {
        this.pdfPage.destroy();
	    this.pdfPage = null;

	    this.ptiParser = null;
	    this.Fields = null;
	    this.Boxsets = null;
    };

    cls.prototype.getPagePoint = function(x, y) {
        return this.viewport.convertToPdfPoint(x, y);
    };

    cls.prototype.parsePage = function(callback, errorCallBack) {
        if (this.renderingState !== RenderingStates.INITIAL)
          error('Must be in new state before drawing');

        this.renderingState = RenderingStates.RUNNING;

        let canvas = createScratchCanvas(1, 1);
        let ctx = canvas.getContext('2d');

        function pageViewDrawCallback(error) {
            this.renderingState = RenderingStates.FINISHED;

            if (error) {
                let errMsg = 'An error occurred while rendering the page ' + (this.id + 1) +
                    ':\n' + error.message +
                    ':\n' + error.stack;
                errorCallBack(errMsg);
            }
            else {
                if (this.ptiParser) {
                    let extraFields = this.ptiParser.getFields(parseInt(this.id) + 1);
                    _.each(extraFields, _.bind(_addField, this));
                }

                _.extend(this, ctx.canvas);
                this.stats = this.pdfPage.stats;

                nodeUtil.p2jinfo('page ' + (this.id + 1) + ' is rendered successfully.');
                callback();
            }
        }

        let renderContext = {
            canvasContext:ctx,
            viewport:this.viewport
        };

        this.pdfPage.render(renderContext).then(
            data => {
                this.pdfPage.getAnnotations().then(
                    fields => {
                        _.each(fields, _.bind(_addField, this));
                        pageViewDrawCallback.call(this, null);
                    },
                    err => console.error("pdfPage.getAnnotations error:" + err));
            },
            err => pageViewDrawCallback.call(this, err)
        );
    };

    return cls;

})();

////////////////////////////////Start of Node.js Module
let PDFJSClass = (function () {
    // private static
    let _nextId = 1;
    let _name = 'PDFJSClass';
    let _sufInfo = "_fieldInfo.xml";

    let _getMetaDataString = function(metadata, key){
        let retVal = "unknown";
        if (metadata && metadata.has(key)) {
            retVal = encodeURIComponent(metadata.get(key));
        }
        return retVal;
    };

    let _getMetaDataInt = function(metadata, key){
        let retVal = _getMetaDataString(metadata, key);
        retVal = parseInt(retVal);
        if (retVal == null || isNaN(retVal))
            retVal = -1;
        return retVal;
    };

    // constructor
    let cls = function (needRawText) {
        nodeEvents.EventEmitter.call(this);
        // private
        let _id = _nextId++;

        // public (every instance will have their own copy of these methods, needs to be lightweight)
        this.get_id = () => _id;
        this.get_name = () => _name + _id;

        // public, this instance copies
        this.pdfDocument = null;
        this.pages = [];
        this.pageWidth = 0;
        this.rawTextContents = [];

        this.needRawText = needRawText;
    };
    // inherit from event emitter
	nodeUtil.inherits(cls, nodeEvents.EventEmitter);

    cls.prototype.raiseErrorEvent = function(errMsg) {
        console.error(errMsg);
        process.nextTick( () => this.emit("pdfjs_parseDataError", errMsg));
        return errMsg;
    };

    cls.prototype.raiseReadyEvent = function(data) {
        process.nextTick( () => this.emit("pdfjs_parseDataReady", data) );
        return data;
    };


    cls.prototype.parsePDFData = function(arrayBuffer, password) {
        this.pdfDocument = null;

        let parameters = {password: password, data: arrayBuffer};
        PDFJS.getDocument(parameters).then(
            pdfDocument => this.load(pdfDocument, 1),
            error => this.raiseErrorEvent("An error occurred while parsing the PDF: " + error)
        );
    };

    cls.prototype.tryLoadFieldInfoXML = function(pdfFilePath) {
        let fieldInfoXMLPath = pdfFilePath.replace(".pdf", _sufInfo);
        if ((fieldInfoXMLPath.indexOf(_sufInfo) < 1) || (!fs.existsSync(fieldInfoXMLPath))) {
            return;
        }
        nodeUtil.p2jinfo("About to load fieldInfo XML : " + fieldInfoXMLPath);

        let PTIXmlParser = require('./ptixmlinject');
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
    };

    cls.prototype.load = function(pdfDocument, scale) {
        this.pdfDocument = pdfDocument;

	    return this.loadMetaData().then(
		    () => this.loadPages(),
			error => this.raiseErrorEvent("loadMetaData error: " + error)
	    );
    };

	cls.prototype.loadMetaData = function() {
		return this.pdfDocument.getMetadata().then(
			data => {
				this.documentInfo = data.info;
				this.metadata = data.metadata;
				this.parseMetaData();
			},
			error => this.raiseErrorEvent("pdfDocument.getMetadata error: " + error)
		);
	};

    cls.prototype.parseMetaData = function() {
        let info = this.documentInfo;
        let metadata = this.metadata;

        let pdfTile = "";
        if (metadata && metadata.has('dc:title')) {
            pdfTile = metadata.get('dc:title');
        }
        else if (info && info['Title'])
            pdfTile = info['Title'];

        let formAttr = {AgencyId:"", Name: "", MC: false, Max: 1, Parent:""};
        if (metadata) {
            formAttr.AgencyId = _getMetaDataString(metadata, 'pdfx:agencyid');
            if (formAttr.AgencyId != "unknown")
                pdfTile = formAttr.AgencyId;

            formAttr.Name = _getMetaDataString(metadata, 'pdfx:name');
            formAttr.MC = _getMetaDataString(metadata, 'pdfx:mc') === 'true';
            formAttr.Max = _getMetaDataInt(metadata, 'pdfx:max');
            formAttr.Parent = _getMetaDataInt(metadata, 'pdfx:parent');
        }

        this.raiseReadyEvent({Transcoder: _PARSER_SIG, Agency:pdfTile, Id: formAttr});
    };

	cls.prototype.loadPages = function() {
		let pagesCount = this.pdfDocument.numPages;
		let pagePromises = [];
		for (let i = 1; i <= pagesCount; i++)
			pagePromises.push(this.pdfDocument.getPage(i));

		let pagesPromise = PDFJS.Promise.all(pagePromises);

		nodeUtil.p2jinfo("PDF loaded. pagesCount = " + pagesCount);

		return pagesPromise.then(
			promisedPages => this.parsePage(promisedPages, 0, 1.5),
			error => this.raiseErrorEvent("pagesPromise error: " + error)
		);
	};

    cls.prototype.parsePage = function(promisedPages, id, scale) {
        nodeUtil.p2jinfo("start to parse page:" + (id+1));

        let pdfPage = promisedPages[id];
        let pageParser = new PDFPageParser(pdfPage, id, scale, this.ptiParser);

        function continueOnNextPage() {
            nodeUtil.p2jinfo("complete parsing page:" + (id+1));
            if (id === (this.pdfDocument.numPages - 1) ) {
	            this.raiseReadyEvent({Pages:this.pages, Width: this.pageWidth});

	            //v1.1.2: signal end of parsed data with null
	            process.nextTick(() => this.raiseReadyEvent(null));
            }
            else {
                process.nextTick(() => this.parsePage(promisedPages, ++id, scale));
            }
        }

        pageParser.parsePage(
	        data => {
	            if (!this.pageWidth)  //get PDF width
	                this.pageWidth = pageParser.width;

	            let page = {Height: pageParser.height,
	                HLines: pageParser.HLines,
	                VLines: pageParser.VLines,
	                Fills:pageParser.Fills,
	//needs to keep current default output format, text content will output to a separate file if '-c' command line argument is set
	//                Content:pdfPage.getTextContent(),
	                Texts: pageParser.Texts,
	                Fields: pageParser.Fields,
	                Boxsets: pageParser.Boxsets
	            };

	            this.pages.push(page);

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
	        errMsg => this.raiseErrorEvent("parsePage error:" + errMsg)
        );
    };

    cls.prototype.getRawTextContent = function() {
        let retVal = "";
        if (!this.needRawText)
            return retVal;

        _.each(this.rawTextContents, function(textContent, index) {
            let prevText = null;
            _.each(textContent.bidiTexts, function(textObj, idx) {
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
    };

	cls.prototype.getAllFieldsTypes = function() {
		return PDFField.getAllFieldsTypes({Pages:this.pages || [], Width: this.pageWidth});
	};

	cls.prototype.getMergedTextBlocksIfNeeded = function() {
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

		return {Pages:this.pages, Width: this.pageWidth};
	};

    cls.prototype.destroy = function() {
        this.removeAllListeners();

        if (this.pdfDocument)
            this.pdfDocument.destroy();
        this.pdfDocument = null;

        this.pages = null;
        this.rawTextContents = null;
    };

    return cls;
})();

module.exports = PDFJSClass;

