require('dotenv').config();
const axios = require('axios');
const { isAnswerGrounded } = require('../guardrails');

const API_KEY = process.env.GROQ_API_KEY;
const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

const modelsToTest = [
    'llama-3.1-8b-instant',
    'gemma2-9b-it',
    'mixtral-8x7b-32768'
];

const context = "The capital of Goa is Panaji, while its largest city is Vasco da Gama. Goa is a state in southwestern India, known for its beaches.";
const query = "What is the capital of Goa?";

const prompt = `Context information is below.\n---------------------\n${context}\n---------------------\nGiven the context information and not prior knowledge, answer the query concisely. Answer in a few words or a short sentence only. Do not add any filler words.\nQuery: ${query}\nAnswer:`;

// Helper for delays
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function runStreamingTest(model) {
    try {
        const start = performance.now();
        const response = await axios.post(ENDPOINT, {
            model: model,
            messages: [{ role: "user", content: prompt }],
            max_tokens: 150,
            temperature: 0.1,
            stream: true
        }, {
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            },
            responseType: 'stream'
        });
        
        return new Promise((resolve, reject) => {
            let ttft = null;
            let fullText = '';
            
            response.data.on('data', chunk => {
                const lines = chunk.toString().split('\n').filter(line => line.trim() !== '');
                for (const line of lines) {
                    if (line.includes('[DONE]')) continue;
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            if (data.choices[0].delta.content) {
                                if (ttft === null) {
                                    ttft = performance.now() - start;
                                }
                                fullText += data.choices[0].delta.content;
                            }
                        } catch (e) {
                            // ignore
                        }
                    }
                }
            });
            
            response.data.on('end', () => {
                const totalTime = performance.now() - start;
                resolve({ ttft, totalTime, fullText: fullText.trim() });
            });
            
            response.data.on('error', reject);
        });
    } catch (e) {
        console.error(`Streaming failed for ${model}:`, e.message);
        return null;
    }
}

async function runStandardTest(model) {
    try {
        const start = performance.now();
        const response = await axios.post(ENDPOINT, {
            model: model,
            messages: [{ role: "user", content: prompt }],
            max_tokens: 150,
            temperature: 0.1
        }, {
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        
        const totalTime = performance.now() - start;
        return {
            totalTime,
            answer: response.data.choices[0].message.content.trim(),
            usage: response.data.usage
        };
    } catch (e) {
        console.error(`Standard request failed for ${model}:`, e.message);
        return null;
    }
}

async function benchmark() {
    console.log("=== LLM BENCHMARK ===");
    
    for (const model of modelsToTest) {
        console.log(`\nTesting Model: ${model}`);
        
        // Standard Request
        const std = await runStandardTest(model);
        if (std) {
            console.log(`  [Standard] Total Generation: ${std.totalTime.toFixed(2)} ms`);
            console.log(`  [Standard] Answer: "${std.answer}"`);
            console.log(`  [Standard] Prompt Tokens: ${std.usage.prompt_tokens}`);
            console.log(`  [Standard] Output Tokens: ${std.usage.completion_tokens}`);
            
            const groundRes = isAnswerGrounded(std.answer, context);
            console.log(`  [Standard] Grounding: ${groundRes.grounded} (Score: ${groundRes.confidence.toFixed(2)})`);
        }
        
        await sleep(1500); // Rate limit buffer
        
        // Streaming Request
        const stream = await runStreamingTest(model);
        if (stream) {
            console.log(`  [Streaming] TTFT (Time to First Token): ${stream.ttft ? stream.ttft.toFixed(2) : 'N/A'} ms`);
            console.log(`  [Streaming] Total Generation: ${stream.totalTime.toFixed(2)} ms`);
        }
        
        await sleep(1500);
    }
    
    console.log("\nDone.");
}

benchmark().catch(console.error);
