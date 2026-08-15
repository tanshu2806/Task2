const TOXIC_WORDS = ['stupid', 'idiot', 'hate', 'kill', 'destroy', 'fuck', 'shit'];
const ABSTENTION_PREFIX = "I couldn't find enough information";

function isQuerySafe(query) {
    if (!query || query.trim().length === 0) return { safe: false, reason: "Query is empty or unrecognizable." };
    const lowerQuery = query.toLowerCase();
    for (const word of TOXIC_WORDS) {
        if (lowerQuery.includes(word)) return { safe: false, reason: "Query contains inappropriate language." };
    }
    return { safe: true };
}

function normalizeQuery(query) {
    return query.replace(/\s+/g, ' ').trim();
}

const STOP_WORDS = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'it', 'this', 'that', 'he', 'she', 'they', 'of', 'from', 'with']);

function cosineSimilarity(vecA, vecB) {
    let dotProduct = 0, normA = 0, normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

function extractClaims(text) {
    // Only extract hard entities: Capitalized words and numbers
    const matches = text.match(/\b([A-Z][a-z]+|\d+)\b/g);
    if (!matches) return [];
    return matches.map(m => m.toLowerCase()).filter(w => !STOP_WORDS.has(w));
}

function isAnswerGrounded(answer, retrievedContexts, answerEmbedding = null, chunkEmbeddings = []) {
    let t0 = performance.now();
    if (answer.startsWith(ABSTENTION_PREFIX)) {
        return { grounded: true, abstention: true, confidence: 1.0, method: 'abstention', lexicalMs: 0, semanticMs: 0 };
    }
    if (!retrievedContexts || retrievedContexts.length === 0) return { grounded: false, abstention: false, confidence: 0, method: 'no_context', lexicalMs: 0, semanticMs: 0 };
    
    // 1. Lexical Claim Check (Catch explicit entity/numerical hallucinations)
    const fullContext = Array.isArray(retrievedContexts) ? retrievedContexts.join('\n\n') : retrievedContexts;
    const answerClaims = extractClaims(answer);
    const contextClaims = new Set(extractClaims(fullContext));
    
    let unsupportedClaims = 0;
    for (const claim of answerClaims) {
        if (!contextClaims.has(claim)) {
            unsupportedClaims++;
        }
    }
    
    if (unsupportedClaims > 0) {
        let t1 = performance.now();
        return { grounded: false, abstention: false, confidence: 0, method: 'lexical_claims_failed', lexicalMs: t1 - t0, semanticMs: 0 };
    }
    let tLex = performance.now();
    let lexicalMs = tLex - t0;

    // 2. Semantic Similarity Check (Support Paraphrasing) per chunk
    let maxSim = 0;
    if (answerEmbedding && chunkEmbeddings && chunkEmbeddings.length > 0) {
        for (let i = 0; i < chunkEmbeddings.length; i++) {
            const sim = cosineSimilarity(answerEmbedding, chunkEmbeddings[i].embedding);
            if (sim > maxSim) {
                maxSim = sim;
            }
        }
        if (maxSim >= 0.80) {
            let tSem = performance.now();
            return { grounded: true, abstention: false, confidence: maxSim, method: 'semantic', lexicalMs: lexicalMs, semanticMs: tSem - tLex };
        }
    }
    
    let tSem = performance.now();
    return { grounded: false, abstention: false, confidence: maxSim, method: 'semantic_failed', lexicalMs: lexicalMs, semanticMs: tSem - tLex };
}

module.exports = { isQuerySafe, normalizeQuery, isAnswerGrounded, ABSTENTION_PREFIX };
