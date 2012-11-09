//Vows test suite to load and parse 3 PDF in parallel
//12 test cases should be honored

var vows = require('vows'),
    assert = require('assert'),
    nodeEvents = require("events"),
    _ = require('underscore'),
    PFParser = require("../pfparser");

var suite = vows.describe('PDF Node Parser');

function pdfParserPromise(fileName) {
    var promise = new(nodeEvents.EventEmitter);

     var pdfParser = new PFParser();

     pdfParser.on("pdfParser_dataReady", function(evtData) {
         if ((!!evtData) && (!!evtData.data)) {
             promise.emit('success', evtData.data);
         }
         else {
             promise.emit('error', new Error());
         }
     });

     pdfParser.on("pdfParser_dataError", function(evtData) {
         promise.emit('error', evtData.data);
     });

     var pdfFilePath = __dirname + "/data/" + fileName + ".pdf";
     pdfParser.loadPDF(pdfFilePath);

     return promise;
}

function checkResult_parseStatus(err, stat, fileName) {
    assert(_.isNull(err) || _.isUndefined(err), fileName + " has errors!");    // We have no error
    assert(_.isObject(stat), fileName + " parsing result should be JS object");// We have a stat object
}

function checkResult_mainFields(parsedData, fileName) {
    assert(_.has(parsedData, "Agency"), fileName + " parsing error: doesn't have Agency object");
    assert(_.has(parsedData, "Id"), fileName + " parsing error: doesn't have Id object");
    assert(_.has(parsedData, "Pages"), fileName + " parsing error: doesn't have Pages object");
    assert(_.has(parsedData, "Width"), fileName + " parsing error: doesn't have Width object");
}

function checkResult_pageCount(Pages, count, fileName) {
    assert(_.isArray(Pages), fileName + " parsing error: doesn't have Pages array");
    assert(Pages.length === count, fileName + " parsing error: Pages array is empty");
}

function checkResult_pageContent(Pages, fileName) {
    _.each(Pages, function(page, index, list) {
        assert(_.has(page, "Height"), fileName + " page " + index + " : doesn't have Height field");
        assert(_.has(page, "HLines"), fileName + " page " + index + " : doesn't have HLines object");
        assert(_.has(page, "VLines"), fileName + " page " + index + " : doesn't have VLines object");
        assert(_.has(page, "Fills"), fileName + " page " + index + " : doesn't have Fills object");
        assert(_.has(page, "Texts"), fileName + " page " + index + " : doesn't have Texts object");
    });
}


suite.addBatch({
    'Parse 1040ez first':{
        topic:function () {
            return pdfParserPromise("xfa_1040ez");
        },
        'has parsing data':function (err, stat) {
            checkResult_parseStatus(err, stat, "xfa_1040ez");
        },
        'has four main objects': function(err, stat) {
            checkResult_mainFields(stat, "xfa_1040ez");
        },
        'has pages': function(err, stat) {
            checkResult_pageCount(stat.Pages, 1, "xfa_1040ez");
        },
        'has page elements': function(err, stat) {
            checkResult_pageContent(stat.Pages, "xfa_1040ez");
        }
    },
    'Parse 1040a':{
        topic:function () {
            return pdfParserPromise("xfa_1040a");
        },
        'has parsing data':function (err, stat) {
            checkResult_parseStatus(err, stat, "xfa_1040a");
        },
        'has four main objects': function(err, stat) {
            checkResult_mainFields(stat, "xfa_1040a");
        },
        'has pages': function(err, stat) {
            checkResult_pageCount(stat.Pages, 2, "xfa_1040a");
        },
        'has page elements': function(err, stat) {
            checkResult_pageContent(stat.Pages, "xfa_1040a");
        }
    },
    'Parse 1040':{
        topic:function () {
            return pdfParserPromise("xfa_1040");
        },
        'has parsing data':function (err, stat) {
            checkResult_parseStatus(err, stat, "xfa_1040");
        },
        'has four main objects': function(err, stat) {
            checkResult_mainFields(stat, "xfa_1040");
        },
        'has pages': function(err, stat) {
            checkResult_pageCount(stat.Pages, 2, "xfa_1040");
        },
        'has page elements': function(err, stat) {
            checkResult_pageContent(stat.Pages, "xfa_1040");
        }
    }
});

suite.run();

