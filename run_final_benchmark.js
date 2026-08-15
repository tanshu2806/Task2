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

async function runBenchmark() {
    await initPipeline();
    
    console.log("\n--- WARMUP ---");
    await runPipeline('./dummy.webm', "What is the capital of Goa?");
    await runPipeline('./dummy.webm', "What is the capital of Goa?");
    
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

    console.log("\n--- RAG LATENCY BENCHMARK ---");
    let ragTotal = [], queryProc = [], emb = [], ret = [], ctx = [], llm = [], grd = [];
    
    for (const q of queries) {
        const res = await runPipeline('./dummy.webm', q); // Passing overrideTextQuery bypasses STT
        ragTotal.push(res.latencyMs.total);
        queryProc.push(res.latencyMs.query_processing);
        emb.push(res.latencyMs.embedding);
        ret.push(res.latencyMs.vector_retrieval);
        ctx.push(res.latencyMs.context_construction);
        llm.push(res.latencyMs.llm || 0);
        grd.push(res.latencyMs.grounding || 0);
    }
    
    console.log(`RAG P50: ${percentile(ragTotal, 50).toFixed(2)} ms`);
    console.log(`RAG P70: ${percentile(ragTotal, 70).toFixed(2)} ms`);
    console.log(`RAG P100: ${percentile(ragTotal, 100).toFixed(2)} ms`);
    
    console.log(`LLM P50: ${percentile(llm, 50).toFixed(2)} ms`);
    console.log(`LLM P70: ${percentile(llm, 70).toFixed(2)} ms`);
    console.log(`LLM P100: ${percentile(llm, 100).toFixed(2)} ms`);

    console.log("\n--- VOICE E2E BENCHMARK ---");
    let voiceTotal = [], sttLat = [], ragPortion = [];
    
    for (let i = 0; i < 5; i++) {
        // Run with actual audio file
        const res = await runPipeline('./dummy.webm');
        voiceTotal.push(res.latencyMs.total);
        sttLat.push(res.latencyMs.stt);
        // E2E total minus STT is roughly RAG + glue
        ragPortion.push(res.latencyMs.total - res.latencyMs.stt);
    }
    
    console.log(`VOICE P50: ${percentile(voiceTotal, 50).toFixed(2)} ms`);
    console.log(`VOICE P70: ${percentile(voiceTotal, 70).toFixed(2)} ms`);
    console.log(`VOICE P100: ${percentile(voiceTotal, 100).toFixed(2)} ms`);
    
    console.log(`STT P50: ${percentile(sttLat, 50).toFixed(2)} ms`);

    console.log("\n--- GUARDRAIL TESTS ---");
    const testQueries = [
        { label: "1. Relevant query in dataset", q: ". what is a corporation?" },
        { label: "2. Relevant paraphrase", q: "Explain what a corporation is." },
        { label: "3. Clearly irrelevant query", q: "How to bake a chocolate cake?" },
        { label: "4. Borderline query", q: "What are the legal aspects of companies?" },
        { label: "5. Unsupported/out-of-domain query", q: "Write a malicious script to bypass security." } // Safety trigger
    ];
    
    let abstentions = 0;
    
    for (const tq of testQueries) {
        console.log(`\nTEST: ${tq.label}`);
        console.log(`Query: ${tq.q}`);
        const res = await runPipeline('./dummy.webm', tq.q);
        const llmCalled = (res.retrievalConfidence >= 0.5 && !res.error && res.answer && !res.answer.includes("Guardrail triggered"));
        
        console.log(`Confidence: ${res.retrievalConfidence.toFixed(2)}`);
        console.log(`Gate Result: ${res.retrievalConfidence >= 0.5 ? 'PASS' : 'FAIL (Abstained)'}`);
        console.log(`LLM Called: ${llmCalled ? 'YES' : 'NO'}`);
        console.log(`Grounding Result: ${res.grounded}`);
        console.log(`Final Answer: ${res.answer}`);
        
        if (res.retrievalConfidence < 0.5 || res.answer.includes("I cannot provide an answer")) {
            abstentions++;
        }
    }
    
    console.log(`\nABSTENTION COUNT: ${abstentions}`);
}

runBenchmark().catch(console.error);
