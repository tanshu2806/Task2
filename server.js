require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const { initPipeline, runPipeline } = require('./rag_pipeline');

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
    const { retrieveFromQdrant } = require('./src/retrieval/qdrant_retriever');
    const axios = require('axios');
    
    if (!query) {
        throw new Error('Missing query');
    }
    
    const results = await retrieveFromQdrant(query);
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
                    maxScore: r.score
                };
            }
            groups[r.query_id].passages.push(r.passage);
        });
        
        groupedRecords = Object.values(groups).sort((a, b) => b.maxScore - a.maxScore);
        context = groupedRecords[0].passages.map((p, i) => `EVIDENCE ${i+1}:\n${p}`).join("\n\n");
    }

    const apiKey = process.env.GROQ_API_KEY;
    const prompt = `Use ONLY the supplied evidence.\n\nAnswer the question directly.\n\nDo not use outside knowledge.\n\nIf the evidence does not contain enough information to answer the\nquestion, say:\n\n"I couldn't find enough information in the provided knowledge base\nto answer that question."\n\nDo NOT explain why you cannot answer.\n\nDo NOT produce numbered lists unless the question explicitly asks\nfor a list.\n\nKeep the answer to 1–2 concise sentences.\n\nQuestion:\n${query}\n\n${context}`;
    
    let answer = "";
    let groqCalled = false;
    
    if (bestScore >= 0.50) {
        retrievalGate = "PASS";
    }
    
    if (apiKey && retrievalGate === "PASS") {
        groqCalled = true;
        const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
            model: "llama-3.1-8b-instant",
            messages: [{ role: "user", content: prompt }],
            max_tokens: 150,
            temperature: 0
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 5000
        });
        answer = response.data.choices[0].message.content.trim();
    } else {
        answer = "I couldn't find enough information in the provided knowledge base\nto answer that question.";
    }

    return {
        query: query,
        results: results,
        grouped_records: groupedRecords,
        context: context,
        best_score: bestScore,
        retrieval_gate: retrievalGate,
        groq_called: groqCalled,
        answer: answer
    };
}

app.post('/ask', async (req, res) => {
    try {
        const query = req.body.query;
        if (!query) {
            return res.status(400).json({ error: 'Missing query' });
        }
        
        const result = await processAskQuery(query);
        res.json(result);
    } catch (e) {
        console.error("Ask endpoint error:", e.message);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/ask', upload.single('audio'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No audio file uploaded' });
    }

    try {
        console.log(`\n📁 Received audio file: ${req.file.filename} (${req.file.size} bytes)`);
        const { performSTTSarvam } = require('./rag_pipeline');
        const sttResult = await performSTTSarvam(req.file.path);
        
        if (!sttResult.text || sttResult.text.trim() === '') {
            return res.status(400).json({ error: 'Could not transcribe audio' });
        }
        
        console.log(`🎤 STT Transcript: ${sttResult.text}`);
        const result = await processAskQuery(sttResult.text);
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
