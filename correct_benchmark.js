require('dotenv').config();
const { initPipeline, runPipeline } = require('./rag_pipeline.js');

function percentile(arr, p) {
    if (arr.length === 0) return 0;
    arr.sort((a, b) => a - b);
    const index = (p / 100) * (arr.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;
    if (upper >= arr.length) return arr[lower];
    return arr[lower] * (1 - weight) + arr[upper] * weight;
}

async function run() {
    await initPipeline();
    
    const queries = [
        "What is the capital of Goa?",
        "Tell me about the history of India.",
        "How do I cook pasta?",
        "Who is the prime minister of India?",
        "What are the benefits of yoga?",
        "Explain machine learning.",
        "What is the population of the world?",
        "How does a combustion engine work?",
        "What is the capital of Bihar?",
        "What is climate change?"
    ];

    let ragTotal = [], llmCalledOnly = [];
    
    for (const q of queries) {
        const res = await runPipeline('./dummy.webm', q);
        
        const abstained = res.retrievalConfidence < 0.5;
        const llmCalled = !abstained;
        const llmLat = llmCalled ? res.latencyMs.llm.toFixed(2) : "N/A";
        
        console.log(`\nquery: ${q}`);
        console.log(`retrieval confidence: ${res.retrievalConfidence.toFixed(2)}`);
        console.log(`abstained: ${abstained}`);
        console.log(`LLM called: ${llmCalled ? 'YES' : 'NO'}`);
        console.log(`LLM latency: ${llmLat} ms`);
        console.log(`grounding latency: ${res.latencyMs.grounding.toFixed(2)} ms`);
        console.log(`RAG total latency: ${res.latencyMs.total.toFixed(2)} ms`);
        console.log(`voice E2E latency: N/A (Text-only run)`);

        ragTotal.push(res.latencyMs.total);
        if (llmCalled) {
            llmCalledOnly.push(res.latencyMs.llm);
        }
    }
    
    console.log(`\nCORRECTED RAG P50: ${percentile(ragTotal, 50).toFixed(2)} ms`);
    console.log(`CORRECTED RAG P70: ${percentile(ragTotal, 70).toFixed(2)} ms`);
    console.log(`CORRECTED RAG P100: ${percentile(ragTotal, 100).toFixed(2)} ms`);
    
    if (llmCalledOnly.length > 0) {
        console.log(`CORRECTED LLM-CALLED P50: ${percentile(llmCalledOnly, 50).toFixed(2)} ms`);
        console.log(`CORRECTED LLM-CALLED P70: ${percentile(llmCalledOnly, 70).toFixed(2)} ms`);
        console.log(`CORRECTED LLM-CALLED P100: ${percentile(llmCalledOnly, 100).toFixed(2)} ms`);
    } else {
        console.log(`CORRECTED LLM-CALLED P50: N/A`);
        console.log(`CORRECTED LLM-CALLED P70: N/A`);
        console.log(`CORRECTED LLM-CALLED P100: N/A`);
    }
}

run().catch(console.error);
