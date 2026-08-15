require('dotenv').config();
const { initPipeline, runPipeline } = require('../rag_pipeline');

async function testQuery(query) {
    const result = await runPipeline(null, query);
    console.log("--------------------------------------------------");
    console.log(`Query: "${query}"`);
    console.log(`Top retrieved document preview: "${result.contextPreview}"`);
    console.log(`Final confidence: ${(result.retrievalConfidence * 100).toFixed(2)}%`);
    console.log(`Abstention: ${result.answer.startsWith("I couldn't find enough information") ? 'YES' : 'NO'}`);
    console.log(`LLM called: ${result.latencyMs.llm_usage ? 'YES' : 'NO'}`);
    console.log(`Grounded: ${result.grounded}`);
}

async function runTests() {
    await initPipeline();
    
    await testQuery("What is the capital of Goa?"); // Test 1 - Relevant
    await testQuery("What is the capital of Bihar?"); // Test 2 - Irrelevant retrieval
    await testQuery("What is the boiling point of water?"); // Test 3 - Completely unrelated
    await testQuery("Which city serves as Goa's capital?"); // Test 4 - Relevant paraphrase
    
    process.exit(0);
}

runTests();
