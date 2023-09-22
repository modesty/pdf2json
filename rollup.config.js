import replace from '@rollup/plugin-replace';
import builtins from 'rollup-plugin-node-builtins';

export default [
   {
      input: './pdfparser.js',
      external: [
         'fs',
         'util',
         'fs/promises',
         'events',
         'path',
         'url',
         'buffer',
         '@xmldom/xmldom',
         'stream',
      ],
      output: {
         file: 'pdfparser.cjs',
         format: 'cjs',
         name: 'pdfparser',
         exports: 'default',
      },
      plugins: [
         replace({
            '../base': '/base/',
            delimiters: ['/', '/'],
         }),
         replace({
            'eval(_baseCode);': `(function (globalScope = {}) {
               eval(_baseCode);
            })();`,
            delimiters: ['', ''],
            preventAssignment: false,
         }),
         builtins(),
      ],
   },
   {
      input: './pdfparser.js',
      external: [
         'fs',
         'util',
         'fs/promises',
         'events',
         'path',
         'url',
         'buffer',
         '@xmldom/xmldom',
         'stream',
      ],
      output: {
         file: 'pdfparser.mjs',
         format: 'es',
      },
      plugins: [
         replace({
            '../base': '/base/',
            delimiters: ['/', '/'],
         }),
         builtins(),
      ],
   },
];
