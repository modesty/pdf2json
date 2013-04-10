////////////////////////////////start of fake image
var PDFImage = (function() {
	'use strict';

	var _src = '';
	var _onload = null;

	this.__defineSetter__("onload", function(val) {
		_onload = val;
	});

	this.__defineGetter__("onload", function() {
		return _onload;
	});

	this.__defineSetter__("src", function(val) {
		_src = val;
		if (_onload) _onload();
	});

	this.__defineGetter__("src", function() {
		return _src;
	});
});

module.exports = PDFImage;
