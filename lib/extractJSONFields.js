'use strict';

var JSONSelect = require('JSONSelect'),
    fs = require('fs');

var extractJsonFields = (function(){
    var extract = {};
    extract.content;
    extract.find = function(filepath,field)   {

        fs.readFile(filepath, 'utf8', function (err, data) {
            if (err) throw err;
            extract.content = data;
            console.log(extract.content);
        });
    };
    return extract;
})();

module.exports = extractJsonFields;