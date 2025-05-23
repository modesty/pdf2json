import fs from "fs";
import { DOMParser } from "./simpleXmlParser.js";

/**
 * XML Parser for PTI format
 * @class
 */
export default class PTIXmlParser {
    /** @type {string|null} */
    xmlData = null;
	/** @type {Array<any>} */
	ptiPageArray = [];

	/**
	 * Create a new PTIXmlParser
	 */
	constructor() {
        this.xmlData = null;
        this.ptiPageArray = [];
    }

	/**
	 * Parse an XML file
	 * @param {string} filePath - The path to the XML file
	 * @param {Function} callback - The callback function
	 */
	parseXml(filePath, callback) {
		fs.readFile(filePath, 'utf8', (err, data) => {
			if (err) {
                callback(err);
			}
			else {
				/** @type {string} */
				this.xmlData = data;

				var parser = new DOMParser();
				var dom = parser.parseFromString(this.xmlData);
				var root = dom.documentElement;

				var xmlFields = root ? root.getElementsByTagName("field") : [];
				var fields = [];

				for (var i = 0; i < xmlFields.length; i++) {
					var id = xmlFields[i].getAttribute('id');
					var xPos = xmlFields[i].getAttribute('x');
					var yPos = xmlFields[i].getAttribute('y');
					var width = xmlFields[i].getAttribute('width');
					var height = xmlFields[i].getAttribute('height');
					var type = xmlFields[i].getAttribute('xsi:type');
					var page = xmlFields[i].getAttribute('page');
					var fontName = xmlFields[i].getAttribute('fontName');
					var fontSize = xmlFields[i].getAttribute('fontSize');

					/** @type {Record<string, any>} */
					var item = {};

					var rectLeft = parseInt(xPos || '0') - 21; //was 23.5
					var rectTop = parseInt(yPos || '0') - 20;//was 23
					var rectRight = parseInt(String(rectLeft)) + parseInt(width || '0') - 4;
					var rectBottom = parseInt(String(rectTop)) + parseInt(height || '0') - 4;

					item.fieldType = "Tx";
					if (type === "Boolean") {
						item.fieldType="Btn";
					}
					else if (type === "SSN" ||  type === "Phone" || type === "zip") {
						item.TName = type ? type.toLowerCase() : '';
					}
					item.alternativeText = "";
					item.fullName = id || '';
					item.fontSize = fontSize || '';
					item.fontName = fontName || '';
					item.subtype = "Widget";

					item.rect = [rectLeft, rectTop, rectRight, rectBottom];

					fields.push(item);

					if (page) {
						this.ptiPageArray[parseInt(page)] = fields;
					}
				}

			}
			callback();
		});
	}

	/**
	 * Get fields for a specific page
	 * @param {number} pageNum - The page number
	 * @returns {Array<any>|undefined} The fields for the page
	 */
	getFields(pageNum) {
		return this.ptiPageArray[pageNum];
	}
}
