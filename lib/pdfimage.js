
import { Buffer } from "buffer";
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
		return (new Buffer.from(val, 'binary')).toString('base64'); // ascii?
    }

}
