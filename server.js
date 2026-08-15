require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const https = require('https');
const { initPipeline, runPipeline } = require('./rag_pipeline');

const keepAliveAgent = new https.Agent({ keepAlive: true });

let totalNewConnections = 0;
let totalReusedConnections = 0;

keepAliveAgent.on('keylog', () => {}); // Just in case, standard

keepAliveAgent.on('free', (socket) => {
    // Socket is now free for reuse
});

const app = express();
const port = process.env.PORT || 3000;

// Setup multer for audio file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('audio/') || file.mimetype === 'video/webm' || file.mimetype === 'application/octet-stream') {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only audio uploads are allowed.'));
        }
    }
});

app.use(cors({ origin: '*' }));
app.use(express.static('public'));
app.use(express.json());

app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Voice RAG Server is running, models loaded.' });
});

app.post('/retrieve', async (req, res) => {
    const { retrieveFromQdrant } = require('./src/retrieval/qdrant_retriever');
    try {
        const query = req.body.query;
        if (!query) {
            return res.status(400).json({ error: 'Missing query' });
        }
        
        const results = await retrieveFromQdrant(query);
        res.json({
            query: query,
            results: results
        });
    } catch (e) {
        console.error("Retrieval endpoint error:", e.message);
        res.status(500).json({ error: e.message });
    }
});

async function processAskQuery(query) {
    const { retrieveFromQdrant, getExtractor } = require('./src/retrieval/qdrant_retriever');
    const { isAnswerGrounded } = require('./guardrails');
    const axios = require('axios');
    
    const ragT0 = performance.now();
    let qpT0 = performance.now();
    
    if (!query) {
        throw new Error('Missing query');
    }
    
    const processedQuery = query.trim();
    let qpT1 = performance.now();
    const queryProcessingMs = qpT1 - qpT0;
    
    const { results, timings: retTimings } = await retrieveFromQdrant(processedQuery);
    
    let grpT0 = performance.now();
    let topResult = null;
    let context = "";
    let bestScore = 0;
    let retrievalGate = "FAIL";
    let groupedRecords = [];

    if (results.length > 0) {
        topResult = results[0];
        bestScore = topResult.score;
        
        const groups = {};
        results.forEach(r => {
            if (!groups[r.query_id]) {
                groups[r.query_id] = {
                    query_id: r.query_id,
                    Eng_Query: r.Eng_Query,
                    Eng_Answer: r.Eng_Answer,
                    passages: [],
                    vectors: [],
                    maxScore: r.score
                };
            }
            groups[r.query_id].passages.push(r.passage);
            groups[r.query_id].vectors.push(r.vector);
        });
        
        groupedRecords = Object.values(groups).sort((a, b) => b.maxScore - a.maxScore);
    }
    let grpT1 = performance.now();
    const groupingMs = grpT1 - grpT0;

    let evT0 = performance.now();
    let chunkEmbeddings = [];
    if (groupedRecords.length > 0) {
        context = groupedRecords[0].passages.map((p, i) => `EVIDENCE ${i+1}:\n${p}`).join("\n\n");
        chunkEmbeddings = groupedRecords[0].passages.map((p, i) => ({ text: p, embedding: groupedRecords[0].vectors[i] }));
    }
    let evT1 = performance.now();
    const evidenceMs = evT1 - evT0;

    const apiKey = process.env.GROQ_API_KEY;
    const prompt = `Use ONLY the supplied evidence.\n\nAnswer the question directly.\n\nDo not use outside knowledge.\n\nIf the evidence does not contain enough information to answer the\nquestion, say:\n\n"I couldn't find enough information in the provided knowledge base\nto answer that question."\n\nDo NOT explain why you cannot answer.\n\nDo NOT produce numbered lists unless the question explicitly asks\nfor a list.\n\nKeep the answer to 1–2 concise sentences.\n\nQuestion:\n${processedQuery}\n\n${context}`;
    
    let answer = "";
    let groqCalled = false;
    let llmMs = null;
    let llmDetails = {
        called: false,
        model: "llama-3.1-8b-instant",
        latencyMs: null,
        ttfbMs: null,
        groqAttempts: 0,
        groqRetries: 0,
        rateLimited: false
    };
    
    if (bestScore >= 0.50) {
        retrievalGate = "PASS";
    }
    
    if (apiKey && retrievalGate === "PASS") {
        groqCalled = true;
        let success = false;
        let lastError = null;
        
        for (let attempt = 1; attempt <= 3; attempt++) {
            llmDetails.groqAttempts++;
            if (attempt > 1) {
                llmDetails.groqRetries++;
                const delayMs = lastError?.response?.headers?.['retry-after'] 
                    ? parseInt(lastError.response.headers['retry-after']) * 1000 
                    : 1500 * Math.pow(2, attempt - 2);
                await new Promise(r => setTimeout(r, delayMs));
            }

            try {
                let llmT0 = performance.now();
                const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
                    model: "llama-3.1-8b-instant",
                    messages: [{ role: "user", content: prompt }],
                    max_tokens: 150,
                    temperature: 0,
                    stream: true
                }, {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json',
                        'Accept': 'text/event-stream'
                    },
                    responseType: 'stream',
                    timeout: 5000,
                    httpsAgent: keepAliveAgent,
                    transport: {
                        request: function(options, callback) {
                            const req = https.request(options, callback);
                            req.on('socket', (socket) => {
                                if (socket.connecting) {
                                    totalNewConnections++;
                                } else {
                                    totalReusedConnections++;
                                }
                            });
                            return req;
                        }
                    }
                });

                let ttfbMs = null;
                let completionTokens = 0;
                let finishReason = null;
                
                answer = await new Promise((resolve, reject) => {
                    let fullText = '';
                    let buffer = '';
                    response.data.on('data', chunk => {
                        if (ttfbMs === null) ttfbMs = performance.now() - llmT0;
                        buffer += chunk.toString();
                        let lines = buffer.split('\n');
                        buffer = lines.pop(); // Keep incomplete line
                        
                        for (const line of lines) {
                            const trimmed = line.trim();
                            if (!trimmed) continue;
                            if (trimmed === 'data: [DONE]') {
                                // Will resolve on 'end'
                            } else if (trimmed.startsWith('data: ')) {
                                try {
                                    const parsed = JSON.parse(trimmed.slice(6));
                                    if (parsed.choices && parsed.choices[0].delta && parsed.choices[0].delta.content) {
                                        fullText += parsed.choices[0].delta.content;
                                        completionTokens++;
                                    }
                                    if (parsed.choices && parsed.choices[0].finish_reason) {
                                        finishReason = parsed.choices[0].finish_reason;
                                    }
                                } catch(e) {}
                            }
                        }
                    });
                    response.data.on('end', () => resolve(fullText.trim()));
                    response.data.on('error', err => reject(err));
                });

                let llmT1 = performance.now();
                llmMs = llmT1 - llmT0;
                
                llmDetails.called = true;
                llmDetails.latencyMs = llmMs;
                llmDetails.ttfbMs = ttfbMs;
                llmDetails.finish_reason = finishReason;
                llmDetails.completion_tokens = completionTokens;
                
                success = true;
                break;
            } catch (err) {
                lastError = err;
                if (err.response && err.response.status === 429) {
                    llmDetails.rateLimited = true;
                } else {
                    throw err;
                }
            }
        }
        
        if (!success) {
            throw lastError;
        }
    } else {
        answer = "I couldn't find enough information in the provided knowledge base\nto answer that question.";
    }

    let groundingResult = { checked: false, passed: false };
    let answerEmbeddingMs = null;
    let groundingTotalMs = 0;
    let groundingLexicalMs = 0;
    let groundingSemanticMs = 0;
    
    if (groqCalled) {
        let ansEmbT0 = performance.now();
        const ext = await getExtractor();
        const out = await ext(answer, { pooling: 'mean', normalize: true });
        const answerEmbedding = Array.from(out.data);
        let ansEmbT1 = performance.now();
        answerEmbeddingMs = ansEmbT1 - ansEmbT0;

        let gndT0 = performance.now();
        const gRes = isAnswerGrounded(answer, context, answerEmbedding, chunkEmbeddings);
        groundingResult = { checked: true, passed: gRes.grounded, confidence: gRes.confidence };
        let gndT1 = performance.now();
        groundingTotalMs = gndT1 - gndT0;
        groundingLexicalMs = gRes.lexicalMs || 0;
        groundingSemanticMs = gRes.semanticMs || 0;
    }

    const ragT1 = performance.now();
    const ragTotalMs = ragT1 - ragT0;

    return {
        query: processedQuery,
        results: results,
        grouped_records: groupedRecords,
        context: context,
        best_score: bestScore,
        retrieval_gate: retrievalGate,
        groq_called: groqCalled,
        answer: answer,
        retrieval: {
            topK: 5,
            bestScore: bestScore,
            gate: retrievalGate
        },
        llm: llmDetails,
        grounding: groundingResult,
        latency: {
            queryProcessingMs,
            embeddingMs: retTimings.embeddingMs,
            retrievalMs: retTimings.retrievalMs,
            groupingMs,
            evidenceMs,
            llmMs,
            answerEmbeddingMs,
            groundingMs: groundingTotalMs,
            groundingLexicalMs,
            groundingSemanticMs,
            ragTotalMs
        }
    };
}

app.post('/ask', async (req, res) => {
    try {
        const query = req.body.query;
        if (!query) {
            return res.status(400).json({ error: 'Missing query' });
        }
        
        const result = await processAskQuery(query);
        
        console.log(`\n[Latency] Text Query`);
        console.log(`Query Processing: ${result.latency.queryProcessingMs.toFixed(2)} ms`);
        console.log(`Embedding: ${result.latency.embeddingMs.toFixed(2)} ms`);
        console.log(`Qdrant: ${result.latency.retrievalMs.toFixed(2)} ms`);
        console.log(`Grouping: ${result.latency.groupingMs.toFixed(2)} ms`);
        console.log(`LLM: ${result.latency.llmMs !== null ? result.latency.llmMs.toFixed(2) + ' ms (TTFB: ' + (result.llm.ttfbMs ? result.llm.ttfbMs.toFixed(2) : 'N/A') + ' ms)' : 'NOT CALLED'}`);
        console.log(`Answer Embedding: ${result.latency.answerEmbeddingMs !== null ? result.latency.answerEmbeddingMs.toFixed(2) + ' ms' : 'NOT CALLED'}`);
        console.log(`Grounding: ${result.grounding.checked ? result.latency.groundingMs.toFixed(2) + ' ms' : 'NOT CALLED'}`);
        if (result.latency.llmMs !== null) {
            console.log(`Socket Status: New=${totalNewConnections}, Reused=${totalReusedConnections}`);
        }
        console.log(`RAG TOTAL: ${result.latency.ragTotalMs.toFixed(2)} ms\n`);

        res.json(result);
    } catch (e) {
        console.error("Ask endpoint error:", e.message);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/ask', upload.single('audio'), async (req, res) => {
    const voiceT0 = performance.now();
    if (!req.file) {
        return res.status(400).json({ error: 'No audio file uploaded' });
    }

    try {
        console.log(`\n📁 Received audio file: ${req.file.filename} (${req.file.size} bytes)`);
        const { performSTTSarvam } = require('./rag_pipeline');
        
        const sttT0 = performance.now();
        const sttResult = await performSTTSarvam(req.file.path);
        const sttT1 = performance.now();
        const sttMs = sttT1 - sttT0;
        
        if (!sttResult.text || sttResult.text.trim() === '') {
            return res.status(400).json({ error: 'Could not transcribe audio' });
        }
        
        console.log(`🎤 STT Transcript: ${sttResult.text}`);
        const result = await processAskQuery(sttResult.text);
        
        const voiceT1 = performance.now();
        const voiceTotalMs = voiceT1 - voiceT0;
        
        result.latency.sttMs = sttMs;
        result.latency.voiceTotalMs = voiceTotalMs;
        
        console.log(`\n[Latency] Voice Query`);
        console.log(`STT: ${sttMs.toFixed(2)} ms`);
        console.log(`Query Processing: ${result.latency.queryProcessingMs.toFixed(2)} ms`);
        console.log(`Embedding: ${result.latency.embeddingMs.toFixed(2)} ms`);
        console.log(`Qdrant: ${result.latency.retrievalMs.toFixed(2)} ms`);
        console.log(`Grouping: ${result.latency.groupingMs.toFixed(2)} ms`);
        console.log(`Evidence: ${result.latency.evidenceMs.toFixed(2)} ms`);
        console.log(`LLM: ${result.latency.llmMs !== null ? result.latency.llmMs.toFixed(2) + ' ms' : 'NOT CALLED'}`);
        console.log(`Answer Embedding: ${result.latency.answerEmbeddingMs !== null ? result.latency.answerEmbeddingMs.toFixed(2) + ' ms' : 'NOT CALLED'}`);
        console.log(`Grounding: ${result.grounding.checked ? result.latency.groundingMs.toFixed(2) + ' ms' : 'NOT CALLED'}`);
        console.log(`RAG TOTAL: ${result.latency.ragTotalMs.toFixed(2)} ms`);
        console.log(`VOICE TOTAL: ${voiceTotalMs.toFixed(2)} ms\n`);

        console.log('✅ Pipeline completed successfully\n');
        res.json(result);
    } catch (e) {
        console.error('❌ Pipeline Error:', e.message);
        console.error('Stack:', e.stack);
        
        // Send structured error response
        let statusCode = 500;
        let errorMessage = 'Pipeline failed';
        let errorDetails = {};

        if (e.response?.status === 400) {
            statusCode = 400;
            errorMessage = 'Invalid audio file. Please ensure the audio is clear and at least 1-2 seconds long.';
            errorDetails = e.response?.data || {};
        } else if (e.response?.status === 401) {
            statusCode = 401;
            errorMessage = 'Invalid API key. Check your .env file.';
        } else if (e.response?.status === 429) {
            statusCode = 429;
            errorMessage = 'Rate limited by API. Wait a moment and try again.';
        } else if (e.message.includes('not found')) {
            statusCode = 400;
            errorMessage = 'Audio file processing error.';
        } else if (e.message) {
            errorMessage = e.message;
        }

        res.status(statusCode).json({ 
            error: errorMessage,
            details: errorDetails,
            message: e.message
        });
    } finally {
        // Clean up uploaded file
        if (req.file && req.file.path) {
            const fs = require('fs');
            setTimeout(() => {
                try {
                    fs.unlinkSync(req.file.path);
                    console.log('📁 Cleaned up:', req.file.path);
                } catch (e) {
                    // Ignore cleanup errors
                }
            }, 1000);
        }
    }
});

// Initialize and start server
if (require.main === module) {
    initPipeline().then(() => {
        // Ensure uploads directory exists
        const fs = require('fs');
        if (!fs.existsSync('./uploads')){
            fs.mkdirSync('./uploads');
        }

        app.listen(port, "0.0.0.0", () => {
            console.log(`Voice RAG Server running on port ${port}`);
        });
    });
}

module.exports = { app, processAskQuery };
