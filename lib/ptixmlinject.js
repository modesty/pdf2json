import fs from "node:fs";
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
		fs.readFile(filePath, "utf8", (err, data) => {
			if (err) {
				callback(err);
			} else {
				/** @type {string} */
				this.xmlData = data;

				const parser = new DOMParser();
				const dom = parser.parseFromString(this.xmlData);
				const root = dom.documentElement;

				const xmlFields = root ? root.getElementsByTagName("field") : [];
				const fields = [];

				for (let i = 0; i < xmlFields.length; i++) {
					const id = xmlFields[i].getAttribute("id");
					const xPos = xmlFields[i].getAttribute("x");
					const yPos = xmlFields[i].getAttribute("y");
					const width = xmlFields[i].getAttribute("width");
					const height = xmlFields[i].getAttribute("height");
					const type = xmlFields[i].getAttribute("xsi:type");
					const page = xmlFields[i].getAttribute("page");
					const fontName = xmlFields[i].getAttribute("fontName");
					const fontSize = xmlFields[i].getAttribute("fontSize");

					/** @type {Record<string, any>} */
					const item = {};

					const rectLeft = parseInt(xPos || "0") - 21; //was 23.5
					const rectTop = parseInt(yPos || "0") - 20; //was 23
					const rectRight = parseInt(String(rectLeft)) + parseInt(width || "0") - 4;
					const rectBottom = parseInt(String(rectTop)) + parseInt(height || "0") - 4;

					item.fieldType = "Tx";
					if (type === "Boolean") {
						item.fieldType = "Btn";
					} else if (type === "SSN" || type === "Phone" || type === "zip") {
						item.TName = type ? type.toLowerCase() : "";
					}
					item.alternativeText = "";
					item.fullName = id || "";
					item.fontSize = fontSize || "";
					item.fontName = fontName || "";
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
