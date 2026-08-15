require('dotenv').config();
const { initPipeline, runPipeline } = require('../rag_pipeline');

const QUERIES = [
    'What is the capital of Goa?',
    'When was Goa liberated?',
    'What is the population of Goa?',
    'Tell me about the beaches in Goa.',
    'Is Goa a state or union territory?',
    'What language is spoken in Goa?',
    'What is the main industry in Goa?',
    'Name a popular festival in Goa.',
    'Who ruled Goa before 1961?',
    'What is the climate like in Goa?'
];

async function runBenchmark() {
    await initPipeline();
    console.log('Running 50-query benchmark (10 queries x 5 iterations)...');
    
    const results = [];
    
    for (let iter = 0; iter < 5; iter++) {
        for (let i = 0; i < QUERIES.length; i++) {
            const result = await runPipeline('./dummy.webm', QUERIES[i]);
            results.push(result);
            process.stdout.write('.');
        }
    }
    
    console.log('\n\nBenchmark Complete.');
    
    const latencies = results.map(r => r.latencyMs ? r.latencyMs.rag_pipeline : 0).filter(l => l > 0).sort((a, b) => a - b);
    
    if (latencies.length === 0) {
        console.log("No valid latencies recorded. Did the API rate limit?");
        return;
    }

    const p50 = latencies[Math.floor(latencies.length * 0.50)];
    const p70 = latencies[Math.floor(latencies.length * 0.70)];
    const p100 = latencies[latencies.length - 1];
    
    console.log('\n--- LATENCY PERCENTILES ---');
    console.log(`P50: ${p50.toFixed(2)} ms`);
    console.log(`P70: ${p70.toFixed(2)} ms`);
    console.log(`P100: ${p100.toFixed(2)} ms`);
    
    const avg = (key) => {
        const validResults = results.filter(r => r.latencyMs && r.latencyMs[key]);
        if (validResults.length === 0) return "0.00";
        return (validResults.reduce((sum, r) => sum + r.latencyMs[key], 0) / validResults.length).toFixed(2);
    };
    
    console.log('\n--- AVERAGE LATENCY BREAKDOWN ---');
    console.log('Query processing:     ' + avg('query_processing') + ' ms');
    console.log('Embedding:            ' + avg('embedding') + ' ms');
    console.log('Vector retrieval:     ' + avg('vector_retrieval') + ' ms');
    console.log('Context construction: ' + avg('context_construction') + ' ms');
    console.log('LLM:                 ' + avg('llm') + ' ms');
    console.log('Grounding:            ' + avg('grounding') + ' ms');
    console.log('Serialization:        ' + avg('serialization') + ' ms');
    console.log('-------------------------');
    console.log('RAG Pipeline (Avg):   ' + avg('rag_pipeline') + ' ms');
    console.log('Total E2E (Avg):      ' + avg('total') + ' ms');
    
}

runBenchmark().catch(console.error);
