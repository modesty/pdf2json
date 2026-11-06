import { Buffer } from "node:buffer";
export default class PDFImage {
	#src = "";
	#onload = null;

	set onload(val) {
		this.#onload = typeof val === "function" ? val : null;
	}

	get onload() {
		return this.#onload;
	}

	set src(val) {
		this.#src = val;
		if (this.#onload) this.#onload();
	}

	get src() {
		return this.#src;
	}

	btoa(val) {
		return new Buffer.from(val, "binary").toString("base64"); // ascii?
	}
}
