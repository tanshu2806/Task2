const fs = require('fs');
const hnswlib = require('hnswlib-node');

const binPath = 'vector_index.bin';
const docsPath = 'docs_store.json';

const binStats = fs.statSync(binPath);
console.log(`vector_index.bin size: ${(binStats.size / 1024 / 1024).toFixed(2)} MB`);

const docsStats = fs.statSync(docsPath);
console.log(`docs_store.json size: ${(docsStats.size / 1024 / 1024).toFixed(2)} MB`);

const docsStore = JSON.parse(fs.readFileSync(docsPath, 'utf8'));
const numVectors = Object.keys(docsStore).length;
console.log(`Total vectors: ${numVectors}`);

const sampleDoc = Object.values(docsStore)[0];
console.log("Sample metadata keys:");
console.log(Object.keys(sampleDoc));
console.log("Has query_id:", 'original_id' in sampleDoc); // we kept it as original_id but we could check query too
console.log("Has Eng_Query:", 'Eng_Query' in sampleDoc);

