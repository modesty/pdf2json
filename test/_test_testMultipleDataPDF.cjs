const assert = require("assert");
const fs = require("fs");

const PDFParser = require("../dist/pdfparser.cjs");
// we want to read two (or more) PDF files without recreating a reference to PDFParser
describe("Multiple PDFs with same structure",()=>{
    test("Read different values",async ()=>{
        // the target PDFs for this test have only 3 values: Name, Surname and BirthDate.
        // you can find the PDFs in test/pdf/mpf
        let parser=new PDFParser();
        const firstPDFLocation=__dirname+"/pdf/mpf/testPDF.pdf";
        const secondPDFLocation=__dirname+"/pdf/mpf/testPDF2.pdf";
        const firstPDFBuffer=fs.readFileSync(firstPDFLocation);
        const secondPDFBuffer=fs.readFileSync(secondPDFLocation);
        //we need to check if buffers are indeed different, otherwise it's useless!
        expect(firstPDFBuffer).not.toBe(secondPDFBuffer);
        const firstData=await new Promise((resolve,reject)=>{
		    parser.parseBuffer(firstPDFBuffer,5);
            parser.on("pdfParser_dataReady", (evtData) => {
                resolve(evtData);
            });
    
            parser.on("pdfParser_dataError", (evtData) => {
                reject(evtData);
            });
        });
        const secondData=await new Promise((resolve,reject)=>{
		    parser.parseBuffer(secondPDFBuffer,5);
            parser.on("pdfParser_dataReady", (evtData) => {
                resolve(evtData);
            });
    
            parser.on("pdfParser_dataError", (evtData) => {
                reject(evtData);
            });
        });
        //first, make sure the files are read
        expect(firstData).toBeDefined();
        expect(firstData.Pages[0]).toBeDefined();
        expect(firstData.Pages[0].Fields).toBeDefined();
        expect(secondData).toBeDefined();
        expect(secondData.Pages[0]).toBeDefined();
        expect(secondData.Pages[0].Fields).toBeDefined();
        //then, we check if the files have the correct values
        expect(firstData.Pages[0].Fields[0].V).toBe("Mario");
        expect(firstData.Pages[0].Fields[1].V).toBe("Rossi");
        expect(firstData.Pages[0].Fields[2].V).toBe("01/01/1990");
        expect(secondData.Pages[0].Fields[0].V).toBe("Luigi");
        expect(secondData.Pages[0].Fields[1].V).toBe("Verdi");
        expect(secondData.Pages[0].Fields[2].V).toBe("01/01/1991");
    });
});