// Stub for the `canvas` native module.
// pdfjs-dist requires it in its Node.js build for server-side PDF rendering,
// but we only use pdfjs for text extraction so canvas is never called.
module.exports = {};
