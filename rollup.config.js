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
         file: 'dist/pdfparser.cjs',
         format: 'cjs',
         name: 'pdfparser',
         exports: 'default',
      },
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
         file: 'dist/pdfparser.mjs',
         format: 'es',
      },
   },
];
