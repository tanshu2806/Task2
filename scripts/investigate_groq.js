require('dotenv').config();
const axios = require('axios');
const http = require('http');
const https = require('https');
const { processAskQuery } = require('../server');

const queries = [
    "What is a corporation?",
    "What is Rachel Carson's essay about?",
    "How fast do eagles fly?",
    "What is barter?",
    "What causes styes in the eyelid?"
];

const keepAliveAgent = new https.Agent({ keepAlive: true });

async function measureGroq() {
    console.log("=== GROQ INVESTIGATION ===\n");
    let totalPromptChars = 0;
    let totalOutputChars = 0;
    let totalTokensUsed = 0;
    let totalPromptTokens = 0;
    
    // We will hook axios to measure TTFB
    const originalPost = axios.post;
    let ttfb = 0;
    
    // Wrap axios.post to intercept the raw request if possible, but easier is to just do a manual request
    // to measure TTFB accurately using https.request.
    
    const apiKey = process.env.GROQ_API_KEY;

    for (let q of queries) {
        console.log(`Query: ${q}`);
        // 1. Process query to get context (run standard pipeline)
        const result = await processAskQuery(q);
        
        // 2. Measure actual sizes
        const prompt = `Use ONLY the supplied evidence.\n\nAnswer the question directly.\n\nDo not use outside knowledge.\n\nIf the evidence does not contain enough information to answer the\nquestion, say:\n\n"I couldn't find enough information in the provided knowledge base\nto answer that question."\n\nDo NOT explain why you cannot answer.\n\nDo NOT produce numbered lists unless the question explicitly asks\nfor a list.\n\nKeep the answer to 1–2 concise sentences.\n\nQuestion:\n${q}\n\n${result.context}`;
        
        totalPromptChars += prompt.length;
        totalOutputChars += result.answer.length;
        
        // 3. Measure TTFB and total using raw HTTP request to bypass axios overhead and get socket timings
        const payload = JSON.stringify({
            model: "llama-3.1-8b-instant",
            messages: [{ role: "user", content: prompt }],
            max_tokens: 150,
            temperature: 0
        });

        const options = {
            hostname: 'api.groq.com',
            path: '/openai/v1/chat/completions',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            },
            agent: keepAliveAgent
        };

        const metrics = await new Promise((resolve, reject) => {
            let reqStart = performance.now();
            let dnsStart, dnsEnd, tcpStart, tcpEnd, tlsStart, tlsEnd;

            const req = https.request(options, (res) => {
                let firstByte = false;
                let ttfbMs = performance.now() - reqStart;
                
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    const totalMs = performance.now() - reqStart;
                    const parsed = JSON.parse(data);
                    resolve({
                        ttfb: ttfbMs,
                        total: totalMs,
                        promptTokens: parsed.usage?.prompt_tokens || 0,
                        completionTokens: parsed.usage?.completion_tokens || 0
                    });
                });
            });
            
            req.on('socket', (socket) => {
                socket.on('lookup', () => { /* DNS resolved */ });
                socket.on('connect', () => { /* TCP connected */ });
                socket.on('secureConnect', () => { /* TLS connected */ });
            });

            req.on('error', reject);
            req.write(payload);
            req.end();
        });

        console.log(`- Prompt Chars: ${prompt.length}`);
        console.log(`- Prompt Tokens: ${metrics.promptTokens}`);
        console.log(`- Output Tokens: ${metrics.completionTokens}`);
        console.log(`- TTFB: ${metrics.ttfb.toFixed(2)}ms`);
        console.log(`- Total HTTP: ${metrics.total.toFixed(2)}ms\n`);
        
        totalPromptTokens += metrics.promptTokens;
        totalTokensUsed += metrics.completionTokens;
        
        await new Promise(r => setTimeout(r, 1000));
    }
    
    console.log("=== AVERAGES ===");
    console.log(`Avg Prompt Chars: ${(totalPromptChars / queries.length).toFixed(0)}`);
    console.log(`Avg Prompt Tokens: ${(totalPromptTokens / queries.length).toFixed(0)}`);
    console.log(`Avg Output Chars: ${(totalOutputChars / queries.length).toFixed(0)}`);
    console.log(`Avg Output Tokens: ${(totalTokensUsed / queries.length).toFixed(0)}`);
}

measureGroq().catch(console.error);
