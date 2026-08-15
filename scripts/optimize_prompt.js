require('dotenv').config();
const axios = require('axios');
const { isAnswerGrounded } = require('../guardrails');
const { initPipeline } = require('../rag_pipeline');

const API_KEY = process.env.GROQ_API_KEY;
const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.1-8b-instant';

const context = "The capital of Goa is Panaji, while its largest city is Vasco da Gama. Goa is a state in southwestern India, known for its beaches.";
const query = "What is the capital of Goa?";

const prompts = [
    {
        name: "Current Strict Prompt",
        prompt: `Context information is below.\n---------------------\n${context}\n---------------------\nGiven the context information and not prior knowledge, answer the query concisely. Answer in a few words or a short sentence only. Do not add any filler words.\nQuery: ${query}\nAnswer:`
    },
    {
        name: "Short Optimized Prompt",
        prompt: `Context: ${context}\nQuery: ${query}\nFactual Answer:`
    },
    {
        name: "Ultra Short",
        prompt: `${context}\nQ: ${query}\nA:`
    }
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function runPromptTest(promptConfig) {
    const times = [];
    let lastAnswer = "";
    let usage = null;
    
    for (let i = 0; i < 5; i++) {
        const start = performance.now();
        const response = await axios.post(ENDPOINT, {
            model: MODEL,
            messages: [{ role: "user", content: promptConfig.prompt }],
            max_tokens: 50,
            temperature: 0
        }, {
            headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' }
        });
        const duration = performance.now() - start;
        times.push(duration);
        lastAnswer = response.data.choices[0].message.content.trim();
        usage = response.data.usage;
        await sleep(1500); // Rate limit buffer
    }
    
    times.sort((a,b) => a-b);
    return {
        name: promptConfig.name,
        p50: times[Math.floor(times.length * 0.50)],
        p70: times[Math.floor(times.length * 0.70)],
        p100: times[times.length - 1],
        answer: lastAnswer,
        inputTokens: usage.prompt_tokens,
        outputTokens: usage.completion_tokens
    };
}

async function benchmarkPrompts() {
    console.log("=== PROMPT OPTIMIZATION BENCHMARK ===\n");
    await initPipeline(); // load semantic extractor
    
    const { pipeline } = await import('@xenova/transformers');
    const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    const getEmb = async (t) => Array.from((await extractor(t, { pooling: 'mean', normalize: true })).data);
    const contextEmb = await getEmb(context);
    
    for (const p of prompts) {
        console.log(`Testing: ${p.name}`);
        const res = await runPromptTest(p);
        
        console.log(`  P50: ${res.p50.toFixed(2)} ms`);
        console.log(`  P70: ${res.p70.toFixed(2)} ms`);
        console.log(`  P100: ${res.p100.toFixed(2)} ms`);
        console.log(`  Answer: "${res.answer}"`);
        console.log(`  Input Tokens: ${res.inputTokens} | Output Tokens: ${res.outputTokens}`);
        
        let ansEmb = null;
        if (res.answer) ansEmb = await getEmb(res.answer);
        
        const grounding = isAnswerGrounded(res.answer, context, ansEmb, contextEmb);
        console.log(`  Grounding: ${grounding.grounded} (Method: ${grounding.method})\n`);
    }
}

benchmarkPrompts().catch(console.error);
