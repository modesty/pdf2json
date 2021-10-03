const   {Transform, Readable} = require("stream"),
        fs = require('fs');

class ParserStream extends Transform {
    static createContentStream(jsonObj) {
		const rStream = new Readable({objectMode: true});
		rStream.push(jsonObj);
		rStream.push(null);
		return rStream;
	}

    static createOutputStream(outputPath, callback) {
		const outputStream = fs.createWriteStream(outputPath);
		outputStream.on('finish', () => {
			callback(null, outputPath);
		});
		outputStream.on('error', err => {
			callback({"streamError": err}, outputPath);
		});

		return outputStream;
	}

    #pdfParser = null;
    #chunks = [];

    constructor(pdfParser, options) {
        super(options);
        this.#pdfParser = pdfParser;

        this.#chunks = [];
    }

    //implements transform stream
	_transform(chunk, enc, callback) {
		this.#chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, enc));
		callback();
	}

	_flush(callback) {
        this.#pdfParser.on("pdfParser_dataReady", evtData => {
            this.push(evtData);
            callback();
            this.emit('end', null);
        });
		this.#pdfParser.parseBuffer(Buffer.concat(this.#chunks));
	}

    _destroy() {
        super.removeAllListeners();
        this.#pdfParser = null;
        this.#chunks = [];         
    }
} 


class StringifyStream extends Transform {
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

module.exports = {ParserStream, StringifyStream};