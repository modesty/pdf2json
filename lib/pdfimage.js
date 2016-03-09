'use strict';
////////////////////////////////start of fake image
let PDFImage = (function() {
	'use strict';

	let _src = '';
	let _onload = null;

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

    this.btoa = function(val) {
        if (typeof window === 'undefined') {
            return (new Buffer(val, 'ascii')).toString('base64');
        }
        else if (typeof window.btoa === 'function')
            return window.btoa(val);

        return "";
    };

});

module.exports = PDFImage;
