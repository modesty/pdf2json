
export default class PDFImage {
	#_src = '';
	#_onload = null;

	set onload(val) {
		this.#_onload = typeof val === 'function' ? val : null;
	}

	get onload() {
		return this.#_onload;
	}

	set src(val) {
		this.#_src = val;
		if (this.#_onload) this.#_onload();
	}

	get src() {
		return this.#_src;
	}

    btoa(val) {
        if (typeof window === 'undefined') {
            return (new Buffer.from(val, 'ascii')).toString('base64');
        }
        else if (typeof window.btoa === 'function')
            return window.btoa(val);

        return "";
    }

}