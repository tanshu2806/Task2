require('dotenv').config();
const { initPipeline, runPipeline } = require('./rag_pipeline.js');
const fs = require('fs');

async function debugGrounding(query) {
    console.log(`\n======================================================`);
    console.log(`QUERY:\n${query}\n`);
    
    // We need to run it and then capture logs or modify rag_pipeline temporarily
    // Instead of modifying, we can use the returned context preview, or just re-run retrieval manually here to print the documents.
    const hnswlib = require('hnswlib-node');
    const { pipeline } = require('@xenova/transformers');
    const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    
    const docsStore = JSON.parse(fs.readFileSync('docs_store.json', 'utf8'));
    const index = new hnswlib.HierarchicalNSW('l2', 384);
    index.readIndexSync('vector_index.bin');
    
    const output = await extractor(query, { pooling: 'mean', normalize: true });
    const vector = Array.from(output.data);
    const result = index.searchKnn(vector, 5); // top 5
    
    console.log("TOP 5 RETRIEVED DOCUMENTS:");
    for (let i = 0; i < result.neighbors.length; i++) {
        const docId = result.neighbors[i];
        const doc = docsStore[docId];
        console.log(`${i+1}. score: ${result.distances[i].toFixed(4)}\n   text: ${doc.text}`);
    }
    
    console.log("\n--- Running Pipeline ---");
    const res = await runPipeline('./dummy.webm', query);
    
    // Now simulate the grounding manually to print scores
    const { isAnswerGrounded } = require('./guardrails.js');
    
    // Recreate context from top 3 (which rag pipeline uses)
    let retrievedContexts = [];
    const top3 = index.searchKnn(vector, 3);
    for (let i = 0; i < top3.neighbors.length; i++) {
        retrievedContexts.push(docsStore[top3.neighbors[i]].text);
    }
    const context = retrievedContexts.join('\n\n');
    
    const aOut = await extractor(res.answer, { pooling: 'mean', normalize: true });
    const cOut = await extractor(context, { pooling: 'mean', normalize: true });
    const answerEmbedding = Array.from(aOut.data);
    const contextEmbedding = Array.from(cOut.data);
    
    console.log(`\nLLM ANSWER:\n${res.answer}\n`);
    
    // Run the internal checks of isAnswerGrounded to print intermediate scores
    const STOP_WORDS = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'it', 'this', 'that', 'he', 'she', 'they', 'of', 'from', 'with']);
    const extractClaims = (text) => {
        const matches = text.match(/\b([A-Z][a-z]+|\d+)\b/g);
        if (!matches) return [];
        return matches.map(m => m.toLowerCase()).filter(w => !STOP_WORDS.has(w));
    };
    const answerClaims = extractClaims(res.answer);
    const contextClaims = new Set(extractClaims(context));
    
    let unsupportedClaims = 0;
    for (const claim of answerClaims) {
        if (!contextClaims.has(claim)) {
            unsupportedClaims++;
        }
    }
    
    const sim = (vecA, vecB) => {
        let dotProduct = 0, normA = 0, normB = 0;
        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    };
    
    const semanticScore = sim(answerEmbedding, contextEmbedding);
    
    console.log(`LEXICAL GROUNDING SCORE:\nUnsupported claims: ${unsupportedClaims} / ${answerClaims.length} total claims`);
    console.log(`SEMANTIC GROUNDING SCORE:\n${semanticScore.toFixed(4)}`);
    console.log(`FINAL GROUNDING SCORE:\n${semanticScore.toFixed(4)}`);
    console.log(`GROUNDING THRESHOLD:\n0.80`);
    console.log(`GROUNDING RESULT:\n${res.grounded}`);
}

async function run() {
    await initPipeline();
    await debugGrounding("What is a corporation?");
    await debugGrounding("Explain what a corporation is.");
}

run().catch(console.error);
