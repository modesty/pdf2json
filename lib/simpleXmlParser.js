// A simple XML parser to replace @xmldom/xmldom dependency
// This implements just enough functionality to support the existing code

/**
 * A simple XML Element implementation
 * @class
 */
class Element {
  /**
   * Create a new Element
   * @param {string} nodeName - The name of the node/tag
   */
  constructor(nodeName) {
    /** @type {string} */
    this.nodeName = nodeName;
    /** @type {Array<Element>} */
    this.childNodes = [];
    /** @type {Object.<string, string>} */
    this.attributes = {};
    /** @type {string} */
    this.textContent = "";
  }

  /**
   * Get attribute value by name
   * @param {string} name - The attribute name
   * @returns {string|null} The attribute value or null
   */
  getAttribute(name) {
    return this.attributes[name] || null;
  }

  /**
   * Get elements by tag name
   * @param {string} tagName - The tag name to search for
   * @returns {Array<Element>} The matching elements
   */
  getElementsByTagName(tagName) {
    /** @type {Array<Element>} */
    let results = [];

    // Check if this element matches
    if (this.nodeName === tagName) {
      results.push(this);
    }

    // Check child elements recursively
    for (const child of this.childNodes) {
      if (child instanceof Element) {
        if (tagName === "*" || child.nodeName === tagName) {
          results.push(child);
        }

        // Add matching descendants
        const childMatches = child.getElementsByTagName(tagName);
        results = results.concat(childMatches);
      }
    }

    return results;
  }
}

/**
 * A simple XML Document implementation
 * @class
 */
class Document {
  constructor() {
    /** @type {Element|null} */
    this.documentElement = null;
  }
}

/**
 * A minimal DOMParser implementation that supports the basic features needed
 * @class
 */
class SimpleDOMParser {
  /**
   * Parse XML string into a Document
   * @param {string} xmlString - The XML string to parse
   * @returns {Document} The parsed document
   */
  parseFromString(xmlString) {
    const doc = new Document();

    // Remove XML declaration if present
    xmlString = xmlString.replace(/<\?xml[^?]*\?>/, "").trim();

    // Parse the document
    doc.documentElement = this.parseElement(xmlString);

    return doc;
  }

  /**
   * Parse an XML element
   * @param {string} xmlString - The XML string to parse
   * @returns {Element|null} The parsed element or null
   */
  parseElement(xmlString) {
    // Regular expressions for parsing XML
    const startTagRegex = /<([^\s/>]+)([^>]*)>/;
    const attributeRegex = /([^\s=]+)=(?:"([^"]*)"|'([^']*)')/g;

    // Find the start tag
    const startMatch = xmlString.match(startTagRegex);
    if (!startMatch) {
      return null;
    }

    const tagName = startMatch[1];
    const attributeString = startMatch[2];

    // Create the element
    const element = new Element(tagName);

    // Parse attributes
    let attributeMatch;
    while ((attributeMatch = attributeRegex.exec(attributeString)) !== null) {
      const attrName = attributeMatch[1];
      const attrValue = attributeMatch[2] || attributeMatch[3]; // Use whichever capture group matched
      element.attributes[attrName] = attrValue;
    }

    // Find the content between start and end tags
    const startTagEnd = startMatch[0].length;
    const endTagSearch = new RegExp(`</${tagName}>`);
    const endMatch = xmlString.slice(startTagEnd).search(endTagSearch);

    if (endMatch === -1) {
      // Self-closing or malformed tag
      return element;
    }

    const contentString = xmlString.slice(startTagEnd, startTagEnd + endMatch);

    // Parse child elements
    let remainingContent = contentString.trim();
    while (remainingContent.length > 0) {
      // Check if there's a child element
      if (remainingContent.startsWith("<") && !remainingContent.startsWith("</")) {
        // Find the next child element
        const childStartMatch = remainingContent.match(startTagRegex);
        if (childStartMatch) {
          const childTagName = childStartMatch[1];
          const childEndTagSearch = new RegExp(`</${childTagName}>`);
          const childEndIndex = remainingContent.search(childEndTagSearch);

          if (childEndIndex !== -1) {
            // Extract the complete child element string (including its end tag)
            const childEndTagLength = childTagName.length + 3; // "</tag>"
            const childXmlString = remainingContent.slice(0, childEndIndex + childEndTagLength);

            // Parse the child element and add it to parent
            const childElement = this.parseElement(childXmlString);
            if (childElement) {
              element.childNodes.push(childElement);
            }

            // Remove the processed child from remaining content
            remainingContent = remainingContent.slice(childXmlString.length).trim();
            continue;
          }
        }
      }

      // Handle text content
      const nextTagIndex = remainingContent.indexOf("<");
      if (nextTagIndex === -1) {
        // The rest is all text
        element.textContent += remainingContent.trim();
        break;
      } else if (nextTagIndex > 0) {
        // There's some text before the next tag
        element.textContent += remainingContent.slice(0, nextTagIndex).trim();
        remainingContent = remainingContent.slice(nextTagIndex).trim();
      } else {
        // Can't parse further, just break
        break;
      }
    }

    return element;
  }
}

// Export DOMParser as a class
export { SimpleDOMParser as DOMParser };
