const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const { retrieveFromQdrant } = require('./src/retrieval/qdrant_retriever');

// No more local indexing dependencies

async function initPipeline() {
    console.log("Initializing Remote RAG Pipeline...");
}

async function performSTTSarvam(audioFilePath) {
    const apiKey = process.env.SARVAM_API_KEY;
    if (!apiKey) throw new Error("SARVAM_API_KEY missing");
    
    if (!fs.existsSync(audioFilePath)) {
        throw new Error('Audio file not found');
    }

    const form = new FormData();
    form.append('file', fs.createReadStream(audioFilePath));
    form.append('model', 'saaras:v3');
    
    try {
        const response = await axios.post('https://api.sarvam.ai/speech-to-text', form, {
            headers: {
                ...form.getHeaders(),
                'api-subscription-key': apiKey
            },
            timeout: 10000
        });
        
        let transcript = response.data.transcript || '';
        return { text: transcript.trim() };
    } catch (e) {
        console.error('Sarvam STT failed:', e.message);
        throw e;
    }
}

async function runPipeline(audioFilePath, overrideTextQuery = null) {
    try {
        let rawQuery;
        if (overrideTextQuery) {
            rawQuery = overrideTextQuery;
        } else {
            const sttResult = await performSTTSarvam(audioFilePath);
            rawQuery = sttResult.text;
        }
        
        const query = rawQuery;
        let retrievedContexts = [];
        let sources = [];

        try {
            const results = await retrieveFromQdrant(query);
            retrievedContexts = results.map(r => r.passage).filter(p => p.trim() !== '');
            sources = results.map(r => r.source);
        } catch (e) {
            // Fail loudly
            throw e;
        }

        let context = retrievedContexts.join("\n\n");
        let answer = "";
        
        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            answer = "Missing Groq API Key.";
        } else {
            const prompt = `You are a grounded question-answering assistant.\n\nAnswer the user's question using ONLY the provided retrieved evidence.\n\nIf the evidence does not contain enough information to answer, say:\n\n"I couldn't find enough information in the provided knowledge base to answer that question."\n\nNever use outside knowledge to fill missing information.\n\nRetrieved evidence:\n${context}\n\nQuestion:\n${query}\n\nReturn a concise answer.`;
            
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
        }

        return {
            query,
            answer,
            sources: [...new Set(sources)],
            contextPreview: context.substring(0, 100) + "..."
        };
    } catch (error) {
        console.error('[Pipeline] Error:', error.message);
        throw error;
    }
}

module.exports = { initPipeline, runPipeline, performSTTSarvam };
