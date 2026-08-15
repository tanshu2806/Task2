require('dotenv').config();
const { initPipeline, runPipeline } = require('../rag_pipeline');
const hnswlib = require('hnswlib-node');
const { pipeline } = require('@xenova/transformers');
const fs = require('fs');

const INDEX_PATH = require('path').join(__dirname, '..', 'vector_index.bin');

// 1 represents relevant (should answer), 0 represents irrelevant (should abstain)
const testCases = [
    // Clearly relevant
    { query: "What is the capital of Goa?", label: 1, type: "Clearly relevant" },
    { query: "Tell me about Goa's beaches.", label: 1, type: "Clearly relevant" },
    
    // Paraphrases
    { query: "Which city serves as Goa's capital?", label: 1, type: "Paraphrase" },
    { query: "Can you name the capital city of Goa?", label: 1, type: "Paraphrase" },
    
    // Clearly irrelevant
    { query: "What is the capital of Bihar?", label: 0, type: "Clearly irrelevant" },
    { query: "Who is the president of the United States?", label: 0, type: "Clearly irrelevant" },
    { query: "What is the boiling point of water?", label: 0, type: "Clearly irrelevant" },
    
    // Borderline / Partial match
    { query: "Are there beaches in Vasco da Gama?", label: 1, type: "Borderline" },
    { query: "What is the largest city in southwestern India?", label: 1, type: "Borderline" },
    { query: "Is Panaji a state?", label: 1, type: "Borderline" },
    { query: "What is the capital of southwestern India?", label: 0, type: "Borderline" },
    { query: "Tell me about the state of Bihar's beaches.", label: 0, type: "Borderline" },
];

async function runAudit() {
    await initPipeline();
    
    const results = [];
    
    for (const test of testCases) {
        const result = await runPipeline(null, test.query);
        results.push({
            query: test.query,
            label: test.label,
            type: test.type,
            confidence: result.retrievalConfidence,
            distance: (1 - result.retrievalConfidence) * 2 // Reverse transform
        });
        console.log(`[${test.type}] Query: "${test.query}"`);
        console.log(`  Confidence: ${result.retrievalConfidence.toFixed(4)} (Distance: ${((1 - result.retrievalConfidence) * 2).toFixed(4)})`);
    }

    const thresholds = [0.30, 0.40, 0.45, 0.50, 0.55, 0.60, 0.65, 0.70];
    
    console.log("\n--- THRESHOLD ANALYSIS ---");
    for (const t of thresholds) {
        let fn = 0; // Relevant incorrectly rejected
        let fp = 0; // Irrelevant incorrectly answered
        let tp = 0; // Relevant correctly answered
        let tn = 0; // Irrelevant correctly rejected
        
        for (const res of results) {
            const answered = res.confidence >= t;
            if (res.label === 1 && !answered) fn++;
            if (res.label === 0 && answered) fp++;
            if (res.label === 1 && answered) tp++;
            if (res.label === 0 && !answered) tn++;
        }
        
        const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
        const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
        const fpr = fp + tn > 0 ? fp / (fp + tn) : 0;
        const fnr = fn + tp > 0 ? fn / (fn + tp) : 0;
        
        console.log(`\nThreshold: ${t.toFixed(2)}`);
        console.log(`  False Positives (Irrelevant answered): ${fp} (${(fpr*100).toFixed(1)}%)`);
        console.log(`  False Negatives (Relevant rejected): ${fn} (${(fnr*100).toFixed(1)}%)`);
        console.log(`  Precision: ${(precision*100).toFixed(1)}%`);
        console.log(`  Recall: ${(recall*100).toFixed(1)}%`);
    }
}

runAudit().catch(console.error);
