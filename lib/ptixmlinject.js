const fs = require("fs"),
    DOMParser = require("@xmldom/xmldom").DOMParser;

class PTIXmlParser {
    xmlData = null;
	ptiPageArray = [];

	// constructor
	constructor() {
        this.xmlData = null;
        this.ptiPageArray = [];
    }
	
	parseXml(filePath, callback) {
		fs.readFile(filePath, 'utf8', (err, data) => {
			if (err) {
                callback(err);
			}
			else {
				this.xmlData = data;

				var parser = new DOMParser();
				var dom = parser.parseFromString(this.xmlData);
				var root = dom.documentElement;

				var xmlFields = root.getElementsByTagName("field");
				var fields = [];

				for(var i=0;i<xmlFields.length;i++){
					var id = xmlFields[i].getAttribute('id');
					var xPos = xmlFields[i].getAttribute('x');
					var yPos = xmlFields[i].getAttribute('y');
					var width = xmlFields[i].getAttribute('width');
					var height = xmlFields[i].getAttribute('height');
					var type = xmlFields[i].getAttribute('xsi:type');
					var page = xmlFields[i].getAttribute('page');
					var fontName = xmlFields[i].getAttribute('fontName');
					var fontSize = xmlFields[i].getAttribute('fontSize');

					var item = {};
					
					var rectLeft = parseInt(xPos) - 21; //was 23.5
					var rectTop = parseInt(yPos) - 20;//was 23
					var rectRight = parseInt(rectLeft) + parseInt(width) - 4;
					var rectBottom = parseInt(rectTop) + parseInt(height) - 4;
					
					item.fieldType="Tx";
					if (type == "Boolean") {
						item.fieldType="Btn";
					}
					else  if (type=="SSN" ||  type=="Phone" || type=="zip") {
						item.TName = type.toLowerCase();
					}
					item.alternativeText = "";
					item.fullName = id;
					item.fontSize = fontSize;
					item.subtype = "Widget";

					item.rect = [rectLeft, rectTop, rectRight, rectBottom];;

					fields.push(item);
					
					this.ptiPageArray[parseInt(page)]=fields;
				}
				
			}
			callback();
		});
	}

	getFields(pageNum) {
		return this.ptiPageArray[pageNum];
	}
}

module.exports = PTIXmlParser;


