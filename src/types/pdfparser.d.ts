/* eslint-disable @typescript-eslint/no-explicit-any */
import { EventEmitter } from "node:events";
import { Transform, Readable, TransformOptions, TransformCallback } from "node:stream";
import fs from "node:fs";


export declare class StringifyStream extends Transform {
    constructor(options?: TransformOptions);
    _transform(obj: any, encoding: string, callback: TransformCallback): void;
}


export declare class ParserStream extends Transform {
    static createContentStream(jsonObj: any): Readable;
    static createOutputStream(outputPath: string, resolve: (value: string) => void, reject: (reason?: any) => void): fs.WriteStream;
    constructor(pdfParser: any, options?: TransformOptions);
    _transform(chunk: any, enc: string, callback: TransformCallback): void;
    _flush(callback: TransformCallback): void;
    _destroy(): void;
}

export declare class PDFParser extends EventEmitter {
    static get colorDict(): object;
    static get fontFaceDict(): object;
    static get fontStyleDict(): object;
    static get PDFUnit(): any;
    static get ParserStream(): typeof ParserStream;
    static get StringifyStream(): typeof StringifyStream;
    static get pkInfo(): { version: string; name: string; description: string; author: string; license: string; };
    // eslint-disable-next-line @typescript-eslint/naming-convention
    static get _PARSER_SIG(): string;

    constructor(context?: PDFParserContext | null, needRawText?: boolean, password?: string);
    on<K extends keyof EventMap>(eventName: K, listener: EventMap[K]): this;

    readonly data: object | null;
    readonly binBufferKey: string;

    createParserStream(): ParserStream;
    loadPDF(pdfFilePath: string, verbosity?: number): Promise<void>;
    parseBuffer(pdfBuffer: Buffer, verbosity?: number): void;
    getRawTextContent(): string;
    getRawTextContentStream(): Readable;
    getAllFieldsTypes(): FieldType[];
    getAllFieldData(): FieldType[];
    getAllFieldsTypesStream(): Readable;
    getMergedTextBlocksIfNeeded(): object;
    getMergedTextBlocksStream(): Readable;
    resetPDFJS(needRawText?: boolean): void;
    destroy(): void;
}

export type EventMap = {
    /** Emitted when a parsing error occurs */
    "pdfParser_dataError": (errMsg: { parserError: Error } | Error) => void;
    /** Emitted when parsing is complete and data is ready */
    "pdfParser_dataReady": (pdfData: Output) => void;
    /** Emitted when PDFJS emits readable meta info */
    "readable": (meta: Output["Meta"]) => void;
    /** Emitted for each page of parsed data, or null at end */
    "data": (data: Output["Pages"][number] | null) => void;
}

export interface Output {
    Transcoder: string;
    Meta: { [key: string]: any };
    Pages: Page[];
}

export declare interface Page {
    Width: number;
    Height: number;
    HLines: Line[];
    VLines: Line[];
    Fills: Fill[];
    Texts: Text[];
    Fields: Field[];
    Boxsets: Boxset[];
}

export declare interface Fill {
    x: number;
    y: number;
    w: number;
    h: number;
    oc?: string;
    clr?: number;
}

export declare interface Line {
    x: number;
    y: number;
    w: number;
    l: number;
    oc?: string;
    clr?: number;
}

export declare interface Text {
    x: number;
    y: number;
    w: number;
    sw: number;
    A: 'left' | 'center' | 'right';
    R: TextRun[];
    oc?: string;
    clr?: number;
}

export declare interface TextRun {
    T: string;
    S: number;
    TS: [number, number, 0 | 1, 0 | 1];
    RA?: number;
}

export declare interface Boxset {
    boxes: Box[];
    id: {
        Id: string;
        EN?: number;
    };
}

export declare interface Field {
    id: {
        Id: string;
        EN?: number;
    };
    style: number;
    TI: number;
    AM: number;
    TU: string;
    x: number;
    y: number;
    w: number;
    h: number;
    T: {
        Name: 'alpha' | 'link';
        TypeInfo: object;
    };
}

export declare interface FieldType {
    id: string;
    type: 'alpha' | 'box' | 'radio' | 'date' | 'link' | 'signature';
    calc: boolean;
    value: string | boolean;
}

export declare interface Box {
    // Simple box (used in Fills, HLines, VLines, etc.)
    x?: number;
    y?: number;
    w?: number;
    h?: number;
    oc?: string;
    clr?: number;

    // Field/Boxset box (used in Boxsets, Fields)
    id?: {
        Id: string;
        EN?: number;
    };
    T?: {
        Name: string;
        TypeInfo?: object;
    };
    TI?: number;
    AM?: number;
    checked?: boolean;
    style?: number;
}

export interface PDFParserContext {
    destroy?(): void;
}

export default PDFParser
