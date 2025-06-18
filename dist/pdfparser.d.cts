/* eslint-disable @typescript-eslint/no-explicit-any */
import { EventEmitter } from "node:events";
import { Transform, Readable, TransformOptions, TransformCallback } from "node:stream";
import fs from "node:fs";

export declare class StringifyStream extends Transform {
	constructor(options?: TransformOptions);
	_transform(obj: any, encoding: string, callback: TransformCallback): void;
}

export declare class ParserStream{
	static createContentStream(jsonObj): Readable
	static createOutputStream(outputPath, resolve, reject): fs.WriteStream
}

export declare class PDFParser extends EventEmitter{
	static get ParserStream(): typeof ParserStream
	static get StringifyStream(): typeof StringifyStream
	static get pkInfo(): { version: string; name: string; description: string; author: string; license: string; }
	// eslint-disable-next-line @typescript-eslint/naming-convention
	static get _PARSER_SIG(): string

	constructor(context?: any, needRawText?: boolean, password?: string);

	parseBuffer(buffer: Buffer, verbosity?: number): void;
    loadPDF(pdfFilePath: string, verbosity?: number):Promise<void>
    createParserStream(): ParserStream
    getRawTextContent(): string
	on<K extends keyof EventMap>(eventName: K, listener: EventMap[K]): this
    getAllFieldsTypes(): FieldType[]
    getAllFieldData(): FieldType[]
}

export type EventMap = {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    "pdfParser_dataError": (errMsg: Record<"parserError", Error>) => void;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    "pdfParser_dataReady": (pdfData: Output) => void;
    "readable": (meta: Output["Meta"]) => void;
    "data": (data: Output["Pages"][number]|null) => void;
}

export interface Output{
    Transcoder: string,
    Meta: Record<string, object>
    Pages: Page[]
}

export declare interface Page{
    Width: number,
    Height: number,
    HLines: Line[],
    VLines: Line[],
    Fills: Fill[],
    Texts: Text[],
    Fields: Field[],
    Boxsets: Boxset[]
}

export declare interface Fill {
    x: number,
    y: number,
    w: number,
    h: number,
    oc?: string,
    clr?: number
}

export declare interface Line {
    x: number,
    y: number,
    w: number,
    l: number,
    oc?: string,
    clr?:number
}

export declare interface Text {
    x: number,
    y: number,
    w: number,
    sw: number,
    A: 'left' | 'center' | 'right',
    R: TextRun[]
    oc?:string;
    clr?: number;
}

export declare interface TextRun {
    T: string,
    S: number,
    TS: [number, number, 0|1, 0|1]
    RA?: number
}

export declare interface Boxset {
    boxes: Box[],
    id : {
        Id: string,
        EN?: number
    }
}

export declare interface Field {
    id: {
        Id: string,
        EN?: number
    },
    style: number,
    TI: number,
    AM: number,
    TU: string,
    x: number,
    y: number,
    w: number,
    h: number,
    T: {
        Name: 'alpha' | 'link',
        TypeInfo: object
    }
}

export declare interface FieldType {
    id: string,
    type: 'alpha' | 'box' | 'radio' | 'date' | 'link' | 'signature',
    calc: boolean,
    value: string | boolean
}

export declare interface Box {
    x: number,
    y: number,
    w: number,
    h: number,
    oc?: string,
    clr?: number
}

export declare interface Box {
    id : {
        Id : string,
        EN? : number
    }
    T: {
        Name : string,
        TypeInfo? : object
    }
    x: number,
    y: number,
    w: number,
    h: number,
    TI: number;
    AM: number;
    checked?: boolean;
    style: number
}

export = PDFParser
