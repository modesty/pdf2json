'use strict';

var fieldsExpo = require('./lib/extractJSONFields.js');
fieldsExpo.select('test/data/my/page1.json','.Texts','test.json');
fieldsExpo.select('test/data/my/page1.json','.Height','height.json');
fieldsExpo.select('test/data/my/page1.json','.Width','width.json');
