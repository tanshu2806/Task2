require('dotenv').config();
const { pipeline } = require('@xenova/transformers');
const hnswlib = require('hnswlib-node');
const fs = require('fs');

async function testRetrieval() {
    console.log("Loading MSMARCO-XI index...");
    const docsStore = JSON.parse(fs.readFileSync('docs_store.json', 'utf8'));
    const index = new hnswlib.HierarchicalNSW('l2', 384);
    index.readIndexSync('vector_index.bin');
    
    console.log("Loading embedding model...");
    const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    
    const queries = [
        "What is the capital of Goa?",
        "What is the capital of Bihar?",
        "What is the capital of India?",
        "What is machine learning?",
        "What is a conifer?",
        "What is the cost to get a patent?",
        "Was Ronald Reagan a Democrat?"
    ];
    
    for (const q of queries) {
        console.log(`\n======================================================`);
        console.log(`Testing query: "${q}"`);
        const output = await extractor(q, { pooling: 'mean', normalize: true });
        const vector = Array.from(output.data);
        
        const result = index.searchKnn(vector, 5);
        const distances = result.distances;
        
        let confidence = 0.0;
        if (distances && distances.length > 0 && Number.isFinite(distances[0])) {
            confidence = Math.max(0, 1 - (distances[0] / 2.0));
        }
        
        console.log(`Confidence: ${(confidence * 100).toFixed(1)}%`);
        console.log(`Status: ${confidence >= 0.50 ? 'PASSED GATE (Retrieval Successful)' : 'ABSTAINED'}`);
        console.log(`Top 5 Retrieved Passages:`);
        
        for (let i = 0; i < result.neighbors.length; i++) {
            const docId = result.neighbors[i];
            const doc = docsStore[docId];
            const dist = distances[i];
            const conf = Math.max(0, 1 - (dist / 2.0));
            console.log(`\n  [${i+1}] Confidence: ${(conf * 100).toFixed(1)}% | Source: ${doc ? doc.source_document : 'Unknown'}`);
            console.log(`  Text: ${doc ? doc.text.substring(0, 150) + "..." : 'None'}`);
        }
    }
}
testRetrieval().catch(console.error);
