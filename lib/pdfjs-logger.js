/**
 * PDF.js Logger Module
 * 
 * Provides logging functionality for all PDF processing modules.
 * This module has no dependencies and can be imported by any module
 * that needs logging without creating circular dependencies.
 * 
 * The actual implementation lives in base/shared/util.js and is injected
 * via initLogger() when pdf.js loads. Fallback implementations are provided
 * for use before initialization.
 */

import console from "node:console";

/**
 * Logger instance that modules import
 * Delegates to PDFJS implementation from base/shared/util.js after initLogger() is called
 */
export const PJS = {
  log: console.log.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error(msg) { throw new Error(msg); },
  verbosity() {},
  LogManager: {
    addLogger() {},
    notify() {},
  },
  // Verbosity constants (matching base/shared/util.js lines 26-28)
  ERRORS: 0,
  WARNINGS: 1,
  INFOS: 5,
};

/**
 * Initialize the logger with the actual PDFJS implementation from base/shared/util.js
 * This is called by pdf.js after pdfjs-code.js is loaded
 * 
 * Delegates all methods to the pdfjsInstance which has the full implementation
 */
export function initLogger(pdfjsInstance) {
  if (pdfjsInstance) {
    // Delegate all methods to the actual PDFJS implementation
    PJS.log = pdfjsInstance.log;
    PJS.info = pdfjsInstance.info;
    PJS.warn = pdfjsInstance.warn;
    PJS.error = pdfjsInstance.error;
    PJS.verbosity = pdfjsInstance.verbosity;
    PJS.LogManager = pdfjsInstance.LogManager;

    // Initialize default verbosity
    if (typeof pdfjsInstance.verbosity === 'function') {
      pdfjsInstance.verbosity();
    }
  }
}
