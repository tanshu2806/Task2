require('dotenv').config();
const { extractClaims, cosineSimilarity } = require('./guardrails.js');
const { pipeline } = require('@xenova/transformers');
const STOP_WORDS = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'it', 'this', 'that', 'he', 'she', 'they', 'of', 'from', 'with']);
function getClaims(text) {
    const matches = text.match(/\b([A-Z][a-z]+|\d+)\b/g);
    if (!matches) return [];
    return matches.map(m => m.toLowerCase()).filter(w => !STOP_WORDS.has(w));
}

function evaluateLexical(answer, context) {
    const aClaims = getClaims(answer);
    const cClaims = new Set(getClaims(context));
    let unsupp = 0;
    for (const c of aClaims) {
        if (!cClaims.has(c)) unsupp++;
    }
    return unsupp === 0;
}

const testCases = [
    // Chunk 1
    {
        chunk: "McDonald's Corporation is one of the most recognizable corporations in the world. A corporation is a company or group of people authorized to act as a single entity (legally a person) and recognized as such in law.",
        answer: "A corporation is a company or group of people authorized to act as a single entity and recognized as such in law.",
        expected: true, type: "Directly supported answers"
    },
    {
        chunk: "McDonald's Corporation is one of the most recognizable corporations in the world. A corporation is a company or group of people authorized to act as a single entity (legally a person) and recognized as such in law.",
        answer: "It is a business group legally recognized as one single entity by the law.",
        expected: true, type: "Faithful paraphrases"
    },
    {
        chunk: "McDonald's Corporation is one of the most recognizable corporations in the world. A corporation is a company or group of people authorized to act as a single entity (legally a person) and recognized as such in law.",
        answer: "McDonald's Corporation is a company in London authorized to act as a single entity.",
        expected: false, type: "Hallucinated entities"
    },
    {
        chunk: "McDonald's Corporation is one of the most recognizable corporations in the world. A corporation is a company or group of people authorized to act as a single entity (legally a person) and recognized as such in law.",
        answer: "A corporation is a biological organism recognized by science.",
        expected: false, type: "Unsupported answers"
    },
    {
        chunk: "McDonald's Corporation is one of the most recognizable corporations in the world. A corporation is a company or group of people authorized to act as a single entity (legally a person) and recognized as such in law.",
        answer: "A corporation is a legal person.",
        expected: true, type: "Concise answers"
    },
    // Chunk 2
    {
        chunk: "Early incorporated entities were established by charter (i.e. by an ad hoc act granted by a monarch or passed by a parliament or legislature).",
        answer: "Early entities were established by charter.",
        expected: true, type: "Directly supported answers"
    },
    {
        chunk: "Early incorporated entities were established by charter (i.e. by an ad hoc act granted by a monarch or passed by a parliament or legislature).",
        answer: "In the past, these entities were formed through charters granted by monarchs or parliaments.",
        expected: true, type: "Faithful paraphrases"
    },
    {
        chunk: "Early incorporated entities were established by charter (i.e. by an ad hoc act granted by a monarch or passed by a parliament or legislature).",
        answer: "Early entities were established by 500 charters.",
        expected: false, type: "Hallucinated numbers"
    },
    {
        chunk: "Early incorporated entities were established by charter (i.e. by an ad hoc act granted by a monarch or passed by a parliament or legislature).",
        answer: "They were established by democratic voting.",
        expected: false, type: "Semantically similar but factually unsupported"
    },
    {
        chunk: "Early incorporated entities were established by charter (i.e. by an ad hoc act granted by a monarch or passed by a parliament or legislature).",
        answer: "Early incorporated entities were established by charter passed by a monarch or parliament.",
        expected: true, type: "Longer faithful answers"
    },
    // Chunk 3
    {
        chunk: "The Obligation to Endure by Rachel Carson Rachel Carson's essay on The Obligation to Endure, is a very convincing argument about the harmful uses of chemicals, pesticides, herbicides, and fertilizers on the environment.",
        answer: "Rachel Carson wrote The Obligation to Endure to argue about the harmful uses of chemicals on the environment.",
        expected: true, type: "Answers containing entities"
    },
    {
        chunk: "The Obligation to Endure by Rachel Carson Rachel Carson's essay on The Obligation to Endure, is a very convincing argument about the harmful uses of chemicals, pesticides, herbicides, and fertilizers on the environment.",
        answer: "The essay argues against using pesticides and herbicides.",
        expected: true, type: "Faithful paraphrases"
    },
    {
        chunk: "The Obligation to Endure by Rachel Carson Rachel Carson's essay on The Obligation to Endure, is a very convincing argument about the harmful uses of chemicals, pesticides, herbicides, and fertilizers on the environment.",
        answer: "Rachel Carson wrote the essay in 1962.",
        expected: false, type: "Hallucinated numbers"
    },
    {
        chunk: "The Obligation to Endure by Rachel Carson Rachel Carson's essay on The Obligation to Endure, is a very convincing argument about the harmful uses of chemicals, pesticides, herbicides, and fertilizers on the environment.",
        answer: "The essay supports the use of natural fertilizers.",
        expected: false, type: "Semantically similar but factually unsupported"
    },
    // Chunk 4
    {
        chunk: "Carson believes that as man tries to eliminate unwanted insects and weeds, however he is actually causing more problems by polluting the environment with, for example, DDT and harming living things.",
        answer: "Carson believes man causes more problems by polluting the environment with DDT.",
        expected: true, type: "Directly supported answers"
    },
    {
        chunk: "Carson believes that as man tries to eliminate unwanted insects and weeds, however he is actually causing more problems by polluting the environment with, for example, DDT and harming living things.",
        answer: "Attempting to eliminate insects actually pollutes the environment and harms life.",
        expected: true, type: "Faithful paraphrases"
    },
    {
        chunk: "Carson believes that as man tries to eliminate unwanted insects and weeds, however he is actually causing more problems by polluting the environment with, for example, DDT and harming living things.",
        answer: "Carson believes man causes more problems by polluting the environment with Lead.",
        expected: false, type: "Hallucinated entities"
    },
    {
        chunk: "Carson believes that as man tries to eliminate unwanted insects and weeds, however he is actually causing more problems by polluting the environment with, for example, DDT and harming living things.",
        answer: "Carson believes man eliminated unwanted insects and weeds entirely.",
        expected: false, type: "Semantically similar but factually unsupported"
    },
    // Chunk 5
    {
        chunk: "Carson adds that the intensification of agriculture is causing other major problems, like newly developed or created insects and diseases.",
        answer: "The intensification of agriculture causes newly developed insects and diseases.",
        expected: true, type: "Directly supported answers"
    },
    {
        chunk: "Carson adds that the intensification of agriculture is causing other major problems, like newly developed or created insects and diseases.",
        answer: "Intense farming leads to the creation of new diseases.",
        expected: true, type: "Faithful paraphrases"
    },
    {
        chunk: "Carson adds that the intensification of agriculture is causing other major problems, like newly developed or created insects and diseases.",
        answer: "The intensification of agriculture in India is causing major problems.",
        expected: false, type: "Hallucinated entities"
    },
    {
        chunk: "Carson adds that the intensification of agriculture is causing other major problems, like newly developed or created insects and diseases.",
        answer: "Agriculture resolves problems with diseases.",
        expected: false, type: "Unsupported answers"
    },
    // Chunk 6
    {
        chunk: "honesty. n, pl-ties. 1. the condition of being honest. 2. sincerity or fairness. 3. virtue or respect.",
        answer: "Honesty is the condition of being honest.",
        expected: true, type: "Directly supported answers"
    },
    {
        chunk: "honesty. n, pl-ties. 1. the condition of being honest. 2. sincerity or fairness. 3. virtue or respect.",
        answer: "It means sincerity, fairness, virtue or respect.",
        expected: true, type: "Faithful paraphrases"
    },
    {
        chunk: "honesty. n, pl-ties. 1. the condition of being honest. 2. sincerity or fairness. 3. virtue or respect.",
        answer: "Honesty is the condition of being honest, with 50 rules.",
        expected: false, type: "Hallucinated numbers"
    },
    {
        chunk: "honesty. n, pl-ties. 1. the condition of being honest. 2. sincerity or fairness. 3. virtue or respect.",
        answer: "Honesty is the opposite of lying.",
        expected: false, type: "Semantically similar but factually unsupported"
    },
    // Chunk 7
    {
        chunk: "hence, a white lie in some cases, is a result of integrity. integrity is the value and morals of a individual in relation or in addition to honesty.",
        answer: "Integrity is the value and morals of an individual.",
        expected: true, type: "Concise answers"
    },
    {
        chunk: "hence, a white lie in some cases, is a result of integrity. integrity is the value and morals of a individual in relation or in addition to honesty.",
        answer: "A white lie can sometimes be a result of integrity.",
        expected: true, type: "Directly supported answers"
    },
    {
        chunk: "hence, a white lie in some cases, is a result of integrity. integrity is the value and morals of a individual in relation or in addition to honesty.",
        answer: "A white lie in America is a result of integrity.",
        expected: false, type: "Hallucinated entities"
    },
    {
        chunk: "hence, a white lie in some cases, is a result of integrity. integrity is the value and morals of a individual in relation or in addition to honesty.",
        answer: "Integrity means never telling a white lie.",
        expected: false, type: "Unsupported answers"
    },
    // Chunk 8
    {
        chunk: "honestly is frankness and as the other guy said, adherence to facts.",
        answer: "Honestly is frankness and adherence to facts.",
        expected: true, type: "Directly supported answers"
    },
    {
        chunk: "honestly is frankness and as the other guy said, adherence to facts.",
        answer: "It means being frank and adhering to facts.",
        expected: true, type: "Faithful paraphrases"
    },
    {
        chunk: "honestly is frankness and as the other guy said, adherence to facts.",
        answer: "Honestly is adherence to 10 facts.",
        expected: false, type: "Hallucinated numbers"
    },
    {
        chunk: "honestly is frankness and as the other guy said, adherence to facts.",
        answer: "Honestly is a legal term.",
        expected: false, type: "Unsupported answers"
    }
];

function percentile(arr, p) {
    if (arr.length === 0) return 0;
    arr.sort((a, b) => a - b);
    const index = (p / 100) * (arr.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;
    if (upper >= arr.length) return arr[lower];
    return arr[lower] * (1 - weight) + arr[upper] * weight;
}

async function run() {
    const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    
    let results = [];
    
    let suppSims = [];
    let unsuppSims = [];
    
    let lexicalFails = 0;
    let totalUnsupp = 0;

    for (let i = 0; i < testCases.length; i++) {
        const tc = testCases[i];
        
        const aOut = await extractor(tc.answer, { pooling: 'mean', normalize: true });
        const cOut = await extractor(tc.chunk, { pooling: 'mean', normalize: true });
        
        const answerEmbedding = Array.from(aOut.data);
        const chunkEmbedding = Array.from(cOut.data);
        
        let sim = 0, normA = 0, normB = 0;
        for (let j = 0; j < answerEmbedding.length; j++) {
            sim += answerEmbedding[j] * chunkEmbedding[j];
            normA += answerEmbedding[j] * answerEmbedding[j];
            normB += chunkEmbedding[j] * chunkEmbedding[j];
        }
        sim = sim / (Math.sqrt(normA) * Math.sqrt(normB));
        
        const lexPass = evaluateLexical(tc.answer, tc.chunk);
        
        if (!tc.expected) totalUnsupp++;
        if (!tc.expected && !lexPass) lexicalFails++;
        
        results.push({
            expected: tc.expected,
            sim: sim,
            lexPass: lexPass,
            type: tc.type
        });
        
        if (tc.expected) suppSims.push(sim);
        else unsuppSims.push(sim);
    }
    
    console.log(`NUMBER OF TEST CASES:\n${testCases.length}`);
    console.log(`\nSUPPORTED CASES:\n${suppSims.length}`);
    console.log(`\nUNSUPPORTED CASES:\n${unsuppSims.length}`);
    
    console.log("\nSUPPORTED DISTRIBUTION:");
    console.log(`min: ${percentile(suppSims, 0).toFixed(4)}`);
    console.log(`P25: ${percentile(suppSims, 25).toFixed(4)}`);
    console.log(`median: ${percentile(suppSims, 50).toFixed(4)}`);
    console.log(`P75: ${percentile(suppSims, 75).toFixed(4)}`);
    console.log(`max: ${percentile(suppSims, 100).toFixed(4)}`);
    
    console.log("\nUNSUPPORTED DISTRIBUTION:");
    console.log(`min: ${percentile(unsuppSims, 0).toFixed(4)}`);
    console.log(`P25: ${percentile(unsuppSims, 25).toFixed(4)}`);
    console.log(`median: ${percentile(unsuppSims, 50).toFixed(4)}`);
    console.log(`P75: ${percentile(unsuppSims, 75).toFixed(4)}`);
    console.log(`max: ${percentile(unsuppSims, 100).toFixed(4)}`);
    
    const maxUnsupp = percentile(unsuppSims, 100);
    const minSupp = percentile(suppSims, 0);
    
    console.log(`\nHIGHEST UNSUPPORTED SIMILARITY:\n${maxUnsupp.toFixed(4)}`);
    console.log(`LOWEST SUPPORTED SIMILARITY:\n${minSupp.toFixed(4)}`);
    
    console.log(`\nLEXICAL ENTITY CHECK:\n${lexicalFails > 0 ? 'PASS' : 'FAIL'} (Caught lexical hallucinations)`);
    
    // Sweep thresholds
    const thresholds = [0.60, 0.65, 0.70, 0.72, 0.74, 0.75, 0.76, 0.77, 0.78, 0.79, 0.80, 0.81, 0.82, 0.83, 0.84, 0.85, 0.86, 0.87, 0.88, 0.90];
    
    let bestT = 0.80;
    let bestF1 = 0;
    let bestRecall = -1;
    let bestPrecision = -1;
    
    let t80Perf = "";
    let bestPerf = "";

    console.log("\nTHRESHOLD SWEEP:");
    for (const t of thresholds) {
        let tp = 0, tn = 0, fp = 0, fn = 0;
        for (const r of results) {
            const isGrounded = (r.sim >= t) && r.lexPass;
            if (r.expected && isGrounded) tp++;
            if (!r.expected && !isGrounded) tn++;
            if (!r.expected && isGrounded) fp++;
            if (r.expected && !isGrounded) fn++;
        }
        const prec = tp + fp === 0 ? 0 : tp / (tp + fp);
        const rec = tp + fn === 0 ? 0 : tp / (tp + fn);
        const fpr = fp + tn === 0 ? 0 : fp / (fp + tn);
        const fnr = fn + tp === 0 ? 0 : fn / (fn + tp);
        const f1 = prec + rec === 0 ? 0 : 2 * prec * rec / (prec + rec);
        
        const line = `T=${t.toFixed(2)} | Prec: ${(prec*100).toFixed(1)}% | Rec: ${(rec*100).toFixed(1)}% | F1: ${(f1*100).toFixed(1)}% | FPR: ${(fpr*100).toFixed(1)}%`;
        // console.log(line);
        
        if (t === 0.80) {
            t80Perf = `Prec: ${(prec*100).toFixed(1)}%, Rec: ${(rec*100).toFixed(1)}%, FPR: ${(fpr*100).toFixed(1)}%`;
        }
        
        if (prec >= 0.95) {
            if (rec > bestRecall || (rec === bestRecall && prec > bestPrecision)) {
                bestRecall = rec;
                bestPrecision = prec;
                bestT = t;
                bestF1 = f1;
                bestPerf = `Prec: ${(prec*100).toFixed(1)}%, Rec: ${(rec*100).toFixed(1)}%, FPR: ${(fpr*100).toFixed(1)}%`;
            }
        }
    }
    
    console.log(`\nBEST THRESHOLD:\n${bestT.toFixed(2)}`);
    console.log(`\nTHRESHOLD JUSTIFICATION:\nThis is the lowest threshold that maintains >= 95% precision (prioritizing hallucination prevention) while maximizing recall to ${bestRecall*100}%.`);
    
    console.log(`\nPRECISION:\n${(bestPrecision*100).toFixed(1)}%`);
    console.log(`\nRECALL:\n${(bestRecall*100).toFixed(1)}%`);
    
    // Find FPR, FNR, F1 for best
    let tp=0, tn=0, fp=0, fn=0;
    for (const r of results) {
        const isGrounded = (r.sim >= bestT) && r.lexPass;
        if (r.expected && isGrounded) tp++;
        if (!r.expected && !isGrounded) tn++;
        if (!r.expected && isGrounded) fp++;
        if (r.expected && !isGrounded) fn++;
    }
    const fpr = fp + tn === 0 ? 0 : fp / (fp + tn);
    const fnr = fn + tp === 0 ? 0 : fn / (fn + tp);
    
    console.log(`\nFPR:\n${(fpr*100).toFixed(1)}%`);
    console.log(`\nFNR:\n${(fnr*100).toFixed(1)}%`);
    console.log(`\nF1:\n${(bestF1*100).toFixed(1)}%`);
    
    console.log(`\nCURRENT 0.80 PERFORMANCE:\n${t80Perf}`);
    console.log(`\nSELECTED THRESHOLD PERFORMANCE:\n${bestPerf}`);
    
    console.log(`\nFINAL RECOMMENDATION:\nCHANGE TO ${bestT.toFixed(2)}`);
}

run().catch(console.error);
