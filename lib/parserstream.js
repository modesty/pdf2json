import { Transform, Readable } from "stream";
import fs from "fs";

export class ParserStream extends Transform {
    static createContentStream(jsonObj) {
		const rStream = new Readable({objectMode: true});
		rStream.push(jsonObj);
		rStream.push(null);
		return rStream;
	}

    static createOutputStream(outputPath, resolve, reject) {
		const outputStream = fs.createWriteStream(outputPath);
		outputStream.on('finish', () => resolve(outputPath));
		outputStream.on('error', err => reject(err) );
		return outputStream;
	}

    #pdfParser = null;
    #chunks = [];
    #parsedData = {Pages:[]};
    #_flush_callback = null; 

    constructor(pdfParser, options) {
        super(options);
        this.#pdfParser = pdfParser;

        this.#chunks = [];

        // this.#pdfParser.on("pdfParser_dataReady", evtData => {
        //     this.push(evtData);
        //     this.#_flush_callback();
        //     this.emit('end', null);
        // });
        this.#pdfParser.on("readable", meta => this.#parsedData = {...meta, Pages:[]});
        this.#pdfParser.on("data", page => {
            if (!page) {
                this.push(this.#parsedData);
                this.#_flush_callback();
            }
            else 
                this.#parsedData.Pages.push(page);
        });
    }

    //implements transform stream
	_transform(chunk, enc, callback) {
		this.#chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, enc));
		callback();
	}

	_flush(callback) {
        this.#_flush_callback = callback;
		this.#pdfParser.parseBuffer(Buffer.concat(this.#chunks));
	}

    _destroy() {
        super.removeAllListeners();
        this.#pdfParser = null;
        this.#chunks = [];         
    }
} 


export class StringifyStream extends Transform {
    constructor(options) {
        super(options);

        this._readableState.objectMode = false;
        this._writableState.objectMode = true;    
    }

    _transform(obj, encoding, callback){
        this.push(JSON.stringify(obj));
        callback();
    }
}
