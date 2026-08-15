const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { pipeline } = require('@xenova/transformers');
const hnswlib = require('hnswlib-node');

const INDEX_PATH = path.join(__dirname, 'vector_index.bin');
const DOCS_PATH = path.join(__dirname, 'docs_store.json');
const EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';

// 384 dimensions for all-MiniLM-L6-v2
const numDimensions = 384; 
const maxElements = 10000;

async function fetchMSMARCOSubset() {
    console.log("Loading MSMARCO-XI subset...");
    const dataPath = path.join(__dirname, 'msmarco_subset.json');
    if (!fs.existsSync(dataPath)) {
        throw new Error("msmarco_subset.json not found. Run fetch_parquet.py first.");
    }
    const rawData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    // We only need MAX_RECORDS = 500
    const MAX_RECORDS = 500;
    const subset = rawData.slice(0, MAX_RECORDS);
    
    console.log(`Loaded ${subset.length} records from msmarco_subset.json.`);
    
    return subset.map(r => {
        let selectedPassages = [];
        
        if (r.passages && r.passages.English_passages && r.passages.is_selected) {
            for (let i = 0; i < r.passages.English_passages.length; i++) {
                if (r.passages.is_selected[i] === 1) {
                    selectedPassages.push(r.passages.English_passages[i]);
                }
            }
            // Fallback to first passage if none selected, to ensure some retrieval context
            if (selectedPassages.length === 0 && r.passages.English_passages.length > 0) {
                selectedPassages.push(r.passages.English_passages[0]);
            }
        }
        
        return {
            id: r.query_id,
            query: r.Eng_Query,
            passage: selectedPassages.join(' '),
            answer: r.Eng_Answer,
            language: 'hi', // Hardcoded since we chose 'hi' subset
            source_document: 'ai4bharat/MSMARCO-XI/hinval.parquet'
        };
    });
}

// Advanced chunking: sentence based with overlap
function chunkText(text, maxChars = 300, overlapChars = 50) {
    // Thoughtful chunking: split by natural sentence boundaries rather than naive word count
    // The PS explicitly requires thoughtful chunking rather than a single fixed-size strategy.
    const sentenceRegex = /[^.!?]+[.!?]+|\s+/g;
    const sentences = text.match(sentenceRegex) || [text];
    
    const chunks = [];
    let currentChunk = "";
    
    for (const sentence of sentences) {
        if (currentChunk.length + sentence.length <= maxChars) {
            currentChunk += sentence;
        } else {
            if (currentChunk.trim().length > 0) {
                chunks.push(currentChunk.trim());
            }
            // For overlap, take the end of the current chunk
            let overlapText = "";
            if (currentChunk.length > overlapChars) {
                overlapText = currentChunk.slice(currentChunk.length - overlapChars);
                const lastSpace = overlapText.indexOf(' ');
                if (lastSpace !== -1 && lastSpace < overlapText.length - 1) {
                    overlapText = overlapText.slice(lastSpace + 1);
                }
            } else {
                overlapText = currentChunk;
            }
            currentChunk = overlapText + sentence;
        }
    }
    if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk.trim());
    }
    return chunks;
}

async function ingest() {
    const data = await fetchMSMARCOSubset();
    console.log("Loading embedding model...");
    const extractor = await pipeline('feature-extraction', EMBEDDING_MODEL);

    const index = new hnswlib.HierarchicalNSW('l2', numDimensions);
    index.initIndex(maxElements);

    const docsStore = {};
    let docId = 0;

    console.log("Chunking and generating embeddings...");
    for (const item of data) {
        const chunks = chunkText(item.passage || "");
        for (const chunk of chunks) {
            if (chunk.trim().length === 0) continue;
            
            // Extract features
            const output = await extractor(chunk, { pooling: 'mean', normalize: true });
            const vector = Array.from(output.data);
            
            index.addPoint(vector, docId);
            docsStore[docId] = {
                text: chunk,
                original_id: item.id,
                query: item.query,
                Eng_Query: item.query, // It's English natively in this field
                answer: item.answer,
                language: item.language,
                source_document: item.source_document,
                passage_index: chunks.indexOf(chunk)
            };
            docId++;
        }
    }

    console.log(`Indexed ${docId} chunks.`);
    index.writeIndexSync(INDEX_PATH);
    fs.writeFileSync(DOCS_PATH, JSON.stringify(docsStore, null, 2));
    console.log("Ingestion complete. Index saved.");
}

ingest().catch(console.error);
