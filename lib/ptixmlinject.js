'use strict';

var nodeUtil = require("util"),
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

var xmlData;

var PTIXmlParser = (function () {
	'use strict';

	var ptiPageArray = new Array();

	var _continue = function(callback, err) {
		if (err)
			console.log(err);
		if (_.isFunction(callback))
			callback(err);
	};

	// constructor
	var cls = function () {

	};
	
	cls.prototype.parseXml = function (filePath,callback) {

		fs.readFile(filePath, 'utf8', function (err,data) {
			if (err) {
				return console.log(err);
			}
			else {

				xmlData = data;

				var parser = new DOMParser();
				var dom = parser.parseFromString(xmlData);
				var root = dom.documentElement;

				var xmlFields = root.getElementsByTagName("field");
				var fields = new Array();

				for(var i=0;i<xmlFields.length;i++){
					var id = xmlFields[i].getAttribute('id');
					var xPos = xmlFields[i].getAttribute('x');
					var yPos = xmlFields[i].getAttribute('y');
					var width = xmlFields[i].getAttribute('width');
					var height = xmlFields[i].getAttribute('height');
					var type = xmlFields[i].getAttribute('xsi:type');
					var page = xmlFields[i].getAttribute('page');
					var fontName = xmlFields[i].getAttribute('fontName');
					var fontSize = xmlFields[i].getAttribute('fontSize');

					var item = {};
					
					var rectLeft = parseInt(xPos) - 21; //was 23.5
					var rectTop = parseInt(yPos) - 20;//was 23
					var rectRight = parseInt(rectLeft) + parseInt(width) - 4;
					var rectBottom = parseInt(rectTop) + parseInt(height) - 4;
					
					item.fieldType="Tx";
					if (type == "Boolean") {
						item.fieldType="Btn";
					}
					else  if (type=="SSN" ||  type=="Phone" || type=="zip") {
						item.TName = type.toLowerCase();
					}
					item.alternativeText = "";
					item.fullName = id;
					item.fontSize = fontSize;
					item.type = "Widget";

					var rect = new Array();
					rect.push(rectLeft);
					rect.push(rectTop);
					rect.push(rectRight);
					rect.push(rectBottom);
					
					//console.log("id:" + id + " type:" + type + " width:" + width + " height:" + height + " x:" + rect[0] + " y:" + rect[1] + " totX:" + rect[2] + " totY:" + rect[3]);

					item.rect = rect;

					fields.push(item);
					
					ptiPageArray[parseInt(page)]=fields;
				}
				
			}
			_continue(callback,err);
		});
	};

	cls.prototype.getFields = function(pageNum) {
		//console.log("pageNum:" + pageNum);
		//console.log("pageNum:" + ptiPageArray[pageNum]);
		return ptiPageArray[pageNum];
	};
	return cls;
})();

module.exports = PTIXmlParser;


