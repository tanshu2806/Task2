const fs = require('fs');

function audit() {
    console.log("--- KNOWLEDGE BASE AUDIT ---");
    
    // 1. Check docs_store.json
    let docs = {};
    try {
        const data = fs.readFileSync('docs_store.json', 'utf8');
        docs = JSON.parse(data);
    } catch (e) {
        console.error("Could not read docs_store.json", e);
        return;
    }
    
    const keys = Object.keys(docs);
    console.log(`Number of chunks in docs_store.json: ${keys.length}`);
    
    let totalChars = 0;
    const sourceMap = new Set();
    
    keys.forEach(k => {
        const text = docs[k].text;
        totalChars += text.length;
        // In ingest.js, what is the ID format?
        // Let's just collect lengths and maybe source if available.
        // Actually, ingest.js does:
        // docsStore[globalId] = { sourceId: item.id, text: chunk };
        sourceMap.add(docs[k].sourceId);
    });
    
    console.log(`Number of unique source documents: ${sourceMap.size}`);
    console.log(`Total characters indexed: ${totalChars}`);
    
    // 2. Output some chunks
    console.log("\n--- EXAMPLES OF CHUNKS ---");
    const sampleSize = Math.min(20, keys.length);
    for (let i = 0; i < sampleSize; i++) {
        console.log(`Chunk ${i+1}: ${docs[keys[i]].text}`);
    }
    
    // 3. Keyword Search
    console.log("\n--- KEYWORD SEARCH ---");
    const keywords = ["Bihar", "Patna", "India", "Mumbai", "Delhi", "Maharashtra", "technology", "science", "history", "sports", "Goa"];
    
    for (const kw of keywords) {
        const count = keys.filter(k => docs[k].text.toLowerCase().includes(kw.toLowerCase())).length;
        console.log(`Keyword "${kw}": found in ${count} chunks.`);
    }
}

audit();
