require('dotenv').config();
const { isAnswerGrounded } = require('./guardrails.js');
const { pipeline } = require('@xenova/transformers');
const { initPipeline, runPipeline } = require('./rag_pipeline.js');

async function testManual(name, answer, contextChunks) {
    const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    const aOut = await extractor(answer, { pooling: 'mean', normalize: true });
    const answerEmbedding = Array.from(aOut.data);
    
    let chunkEmbeddings = [];
    for (const ctx of contextChunks) {
        const cOut = await extractor(ctx, { pooling: 'mean', normalize: true });
        chunkEmbeddings.push({ text: ctx, embedding: Array.from(cOut.data) });
    }
    
    const res = isAnswerGrounded(answer, contextChunks, answerEmbedding, chunkEmbeddings);
    
    console.log(`\nTEST: ${name}`);
    console.log(`answer: ${answer}`);
    // console.log(`max_similarity: ${res.confidence.toFixed(4)}`);
    console.log(`final_grounding: ${res.grounded ? 'PASS' : 'FAIL'} (${res.method})`);
    
    return res.grounded;
}

async function run() {
    await initPipeline();
    
    console.log("OLD GROUNDING METHOD:");
    console.log("Computed semantic similarity against a single concatenated string of all retrieved passages. Lexical fallback strictly limited to answers <= 4 words.");
    
    console.log("\nNEW GROUNDING METHOD:");
    console.log("Computes semantic similarity independently against EACH retrieved chunk and takes the MAX similarity. Removed arbitrary 4-word restriction on lexical claim checks, while still enforcing that all hard entities (capitalized words and numbers) in the answer must appear in the retrieved context.");
    
    console.log("\nTHRESHOLD:");
    console.log("0.80");
    
    console.log("\nCORPORATION TEST:");
    const res1 = await runPipeline('./dummy.webm', "What is a corporation?");
    console.log(`Query: What is a corporation? -> Grounding: ${res1.grounded ? 'PASS' : 'FAIL'}`);
    
    console.log("\nPARAPHRASE TEST:");
    const res2 = await runPipeline('./dummy.webm', "Explain what a corporation is.");
    console.log(`Query: Explain what a corporation is. -> Grounding: ${res2.grounded ? 'PASS' : 'FAIL'}`);
    
    console.log("\n--- SYNTHETIC TESTS ---");
    const ctx = [
        "A corporation is a company or group of people authorized to act as a single entity (legally a person) and recognized as such in law.",
        "Early incorporated entities were established by charter.",
        "Irrelevant padding chunk for dilution test."
    ];
    
    const t3 = await testManual("Direct answer", "A corporation is a company or group of people authorized to act as a single entity.", ctx);
    const t4 = await testManual("Paraphrased answer", "A corporation is legally recognized as a single entity by law.", ctx);
    const t5 = await testManual("Hallucinated entity", "A corporation in London is a company authorized to act as a single entity.", ctx);
    const t6 = await testManual("Hallucinated number", "A corporation is a company of 500 people authorized to act as a single entity.", ctx);
    const t7 = await testManual("Unsupported answer", "A corporation is a type of biological organism.", ctx);
    
    const total = 7;
    // Expected:
    // 1 (corporation test): PASS
    // 2 (paraphrase test): PASS
    // 3 (direct): PASS
    // 4 (paraphrase): PASS
    // 5 (hallu entity): FAIL
    // 6 (hallu num): FAIL
    // 7 (unsupported): FAIL
    
    let tp = 0, tn = 0, fp = 0, fn = 0;
    
    // Check results vs expected
    if (res1.grounded) tp++; else fn++;
    if (res2.grounded) tp++; else fn++;
    if (t3) tp++; else fn++;
    if (t4) tp++; else fn++;
    
    if (!t5) tn++; else fp++;
    if (!t6) tn++; else fp++;
    if (!t7) tn++; else fp++;
    
    const precision = tp / (tp + fp);
    const recall = tp / (tp + fn);
    
    console.log(`\nFINAL GROUNDING PRECISION:`);
    console.log(`${(precision * 100).toFixed(1)}%`);
    console.log(`FINAL GROUNDING RECALL:`);
    console.log(`${(recall * 100).toFixed(1)}%`);
}

run().catch(console.error);
