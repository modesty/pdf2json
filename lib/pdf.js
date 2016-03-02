'use strict';

let nodeUtil = require("util"),
    nodeEvents = require("events"),
    fs = require('fs'),
    _ = require('underscore'),
    DOMParser = require('xmldom').DOMParser,
    PDFCanvas = require('./pdfcanvas.js'),
    PDFUnit = require('./pdfunit.js'),
    PDFField = require('./pdffield.js'),
    PDFAnno = require('./pdfanno.js'),
    Image = require('./pdfimage.js'),
    pkInfo = require('../package.json');

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
_.each(_pdfjsFiles, function(fielName, idx) {
    _fileContent += fs.readFileSync(_basePath + fielName, 'utf8');
});

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

        let self = this;
        function pageViewDrawCallback(error) {
            self.renderingState = RenderingStates.FINISHED;

            if (error) {
                let errMsg = 'An error occurred while rendering the page ' + (self.id + 1) +
                    ':\n' + error.message +
                    ':\n' + error.stack;
                errorCallBack(errMsg);
            }
            else {
                if (self.ptiParser) {
                    let extraFields = self.ptiParser.getFields(parseInt(self.id) + 1);
                    _.each(extraFields, _addField, self);
                }

                _.extend(self, ctx.canvas);
                self.stats = self.pdfPage.stats;

                nodeUtil.p2jinfo('page ' + (self.id + 1) + ' is rendered successfully.');
                callback();
            }
        }

        let renderContext = {
            canvasContext:ctx,
            viewport:this.viewport
        };

        self.pdfPage.render(renderContext).then(
            function pdfPageRenderCallback() {
                self.pdfPage.getAnnotations().then(function(fields){
                    _.each(fields, _addField, self);
                    pageViewDrawCallback(null);
                });
            },
            function pdfPageRenderError(error) {
                pageViewDrawCallback(error);
            }
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

    cls.prototype.parsePDFData = function(arrayBuffer) {
        this.pdfDocument = null;

        let parameters = {password: '', data: arrayBuffer};
        let self = this;
        PDFJS.getDocument(parameters).then(
            function getDocumentCallback(pdfDocument) {
                self.load(pdfDocument, 1);
            },
            function getDocumentError(message, exception) {
                let errMsg = "An error occurred while parsing the PDF: " + message;
                nodeUtil.p2jwarn(errMsg);
                self.emit("pdfjs_parseDataError", errMsg);
            },
            function getDocumentProgress(progressData) {
                nodeUtil.p2jinfo("Loading progress: " + progressData.loaded / progressData.total + "%");
            }
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
        this.ptiParser.parseXml(fieldInfoXMLPath, _.bind(function(err) {
            if (err) {
                nodeUtil.p2jwarn("fieldInfo XML Error: " + JSON.stringify(err));
                this.ptiParser = null;
            }
            else {
                nodeUtil.p2jinfo("fieldInfo XML loaded.");
            }
        }, this));
    };

    cls.prototype.load = function(pdfDocument, scale) {
        this.pdfDocument = pdfDocument;

        let pagesCount = pdfDocument.numPages;
        let pagePromises = [];
        for (let i = 1; i <= pagesCount; i++)
          pagePromises.push(pdfDocument.getPage(i));

        let pagesPromise = PDFJS.Promise.all(pagePromises);

        nodeUtil.p2jinfo("PDF loaded. pagesCount = " + pagesCount);

        let self = this;
        pagesPromise.then(function(promisedPages) {
            self.parsePage(promisedPages, 0, 1.5);
        });

        pdfDocument.getMetadata().then(function(data) {
            self.documentInfo = data.info;
            self.metadata = data.metadata;

            self.parseMetaData();
        });
    };

    cls.prototype.parseMetaData = function() {
        let self = this;

        let info = self.documentInfo;
        let metadata = self.metadata;

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

        self.emit("pdfjs_parseDataReady", {Transcoder: _PARSER_SIG, Agency:pdfTile, Id: formAttr});
    };

    cls.prototype.parsePage = function(promisedPages, id, scale) {
        nodeUtil.p2jinfo("start to parse page:" + (id+1));
        let self = this;
        let pdfPage = promisedPages[id];
        let pageParser = new PDFPageParser(pdfPage, id, scale, this.ptiParser);

        function continueOnNextPage() {
            nodeUtil.p2jinfo("complete parsing page:" + (id+1));
            if (id === (self.pdfDocument.numPages - 1) ) {
                self.emit("pdfjs_parseDataReady", {Pages:self.pages, Width: self.pageWidth});
            }
            else {
                process.nextTick(function(){
                    self.parsePage(promisedPages, ++id, scale);
                });
            }
        };

        pageParser.parsePage(function() {
            if (!self.pageWidth)  //get PDF width
                self.pageWidth = pageParser.width;

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

            self.pages.push(page);

            if (self.needRawText) {
                pdfPage.getTextContent().then(function(textContent){
                    self.rawTextContents.push(textContent);
                    nodeUtil.p2jinfo("complete parsing raw text content:" + (id+1));
                    continueOnNextPage();
                });
            }
            else {
                continueOnNextPage();
            }
        }, function(errMsg) {
            self.emit("pdfjs_parseDataError", errMsg);
        });
    };

    cls.prototype.getRawTextContent = function() {
        let retVal = "";
        if (!this.needRawText)
            return retVal;

        _.each(this.rawTextContents, function(textContent, index) {
            _.each(textContent.bidiTexts, function(textObj, idx) {
                retVal += textObj.str + "\r\n";
            });
            retVal += "----------------Page (" + index + ") Break----------------\r\n";
        });

        return retVal;
    };

	cls.prototype.getAllFieldsTypes = function() {
		return PDFField.getAllFieldsTypes({Pages:this.pages || [], Width: this.pageWidth});
	};

	cls.prototype.getMergedTextBlocksIfNeeded = function() {
		let X_SPACE_DELTA = 6.6;
		let Y_LINE_DELTA = 0.1;

		/** sort text blocks by y then x */
		let _textOrder = function(t1, t2) {
			if (t1.y < t2.y - Y_LINE_DELTA) {
				return -1;
			}
			if (Math.abs(t1.y - t2.y) <= Y_LINE_DELTA) {
				if (t1.x < t2.x - Y_LINE_DELTA) {
					return -1;
				}
				if (Math.abs(t1.x - t2.x) <= Y_LINE_DELTA) {
					return 0;
				}
			}
			return 1;
		};

		let _haveSameStyle = function(t1, t2) {
			let retVal = t1.R[0].S === t2.R[0].S;
			if (retVal && t1.R[0].S >= 0) {
				for (let key in t1.R[0].TS) {
					if (t1.R[0].TS[key] !== t2.R[0].TS[key]) {
						retVal = false;
						break;
					}
				}
			}
			if (retVal) { // make sure both block are not rotated
				retVal = (typeof t1.R[0].RA === 'undefined') && (typeof t2.R[0].RA === 'undefined');
			}

			return retVal;
		};

		let _isAdjacentBlocks = function(t1, t2) {
			let isInSameLine = Math.abs(t1.y - t2.y) <= Y_LINE_DELTA;
			let isDistanceSmallerThanASpace = (t2.x - t1.x - t1.w) < X_SPACE_DELTA;

			return isInSameLine && isDistanceSmallerThanASpace;
		};

		let _isSameBlock = function(t1, t2) {
			return t1.x == t2.x && t1.y == t2.y && t1.R[0].T == t2.R[0].T;
		};

		for (let p = 0; p < this.pages.length; p++) {
			let prevText = null;
			let page = this.pages[p];

			page.Texts.sort(_textOrder);

			for (let i = 0; i < page.Texts.length; i++) {
				//about the text object, see more details in pdffont.js  
				let text = page.Texts[i];

				if (prevText) {
					if (_isAdjacentBlocks(prevText, text) && _haveSameStyle(prevText, text)) {
						if (_isSameBlock(prevText, text)) {
							prevText.merged = true;
							prevText = text;
							nodeUtil.p2jinfo("skipped duplicate text block: " + decodeURIComponent(text.R[0].T) + " => " + decodeURIComponent(prevText.R[0].T));
						}
						else {
							prevText.R[0].T += text.R[0].T;
							prevText.w += text.w;
							text.merged = true;
							nodeUtil.p2jinfo("merged text block: " + decodeURIComponent(text.R[0].T) + " => " + decodeURIComponent(prevText.R[0].T));
						}
					}
					else {
						prevText = null;
					}
				}
				else {
					prevText = text;
				}
			}

			page.Texts = page.Texts.filter( t => !t.merged);
		}

		return this.pages;
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

