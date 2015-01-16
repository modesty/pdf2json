'use strict';

var JSONSelect = require('JSONSelect'),
    fs = require('fs');

var extractJsonFields = (function(){
    var extract = {};
    extract.content = '';
    extract.selected = '';
    extract.select = function(filepath,selector,fileoutput)   {

        fs.readFile(filepath, 'utf8', function (err, data) {
            if (err) throw err;
            extract.content = data;
            var content_parsed = JSON.parse(data);
            extract.selected = JSONSelect.match(selector,content_parsed);
            fs.writeFile(fileoutput,JSON.stringify(extract.selected,null,4),function(err) {
                if (err) throw err;
                console.log('output written');
            });
        });
    };

    return extract;
})();

module.exports = extractJsonFields;