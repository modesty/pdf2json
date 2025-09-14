/* eslint-disable @typescript-eslint/no-explicit-any */

// Type declarations for the PDFJS runtime API exposed by base/shared/util.js
// This provides typings for the logging helpers and verbosity controller that
// are attached to the global PDFJS object and also exported via ./pdfjs-code.js

export interface PDFJSAPI {
  /** Low-level log function (usually console.log) */
  log: (...args: any[]) => void;
  /** Info-level logging helper (respects current verbosity) */
  info: (...args: any[]) => void;
  /** Warning-level logging helper (respects current verbosity) */
  warn: (...args: any[]) => void;
  /** Error-level logging helper; may throw internally */
  error: (...args: any[]) => void;
  /**
   * Set the global verbosity level.
   * Levels typically are: ERRORS = 0, WARNINGS = 1, INFOS = 5
   * Passing no value initializes to default.
   */
  verbosity: (level?: number) => void;
  /** PDF document loader function */
  getDocument: (params: any) => any;
  /** Promise implementation used by PDF.js */
  Promise: any;
}

// Global variable when PDFJS core is loaded in the runtime
declare global {
  // eslint-disable-next-line no-var
  var PDFJS: PDFJSAPI;
}

// Module form used by the generated bundle that re-exports the global PDFJS
declare module "../../lib/pdfjs-code.js" {
  export const PDFJS: PDFJSAPI;
}
