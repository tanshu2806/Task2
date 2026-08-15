const { QdrantClient } = require('@qdrant/js-client-rest');
const { pipeline } = require('@xenova/transformers');

const client = new QdrantClient({ host: 'localhost', port: 6333, checkCompatibility: false });

let extractor;

async function getExtractor() {
    if (!extractor) {
        extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    }
    return extractor;
}

async function retrieveFromQdrant(query, collectionName = 'msmarco_xi', limit = 5) {
    const ext = await getExtractor();
    const out = await ext(query, { pooling: 'mean', normalize: true });
    const embedding = Array.from(out.data);
    
    const searchResult = await client.query(collectionName, {
        query: embedding,
        limit: limit,
        with_payload: true,
    });
    
    return searchResult.points.map(res => {
        return {
            score: res.score,
            passage: res.payload.passage,
            query_id: res.payload.query_id,
            query: res.payload.query,
            Eng_Query: res.payload.eng_query,
            answer: res.payload.answer,
            Eng_Answer: res.payload.eng_answer,
            source: res.payload.source_document || 'ai4bharat/MSMARCO-XI',
            sourceDocument: res.payload.source_document || 'ai4bharat/MSMARCO-XI'
        };
    });
}

module.exports = { retrieveFromQdrant };
