require('dotenv').config();
const { processAskQuery } = require('../server');

const queries = [
    // --- 20 SUPPORTED QUERIES ---
    { q: "What is a corporation?", cat: "supported" },
    { q: "What is Rachel Carson's essay about?", cat: "supported" },
    { q: "Does Rachel Carson think eliminating insects helps the environment?", cat: "supported" },
    { q: "What is the definition of honesty?", cat: "supported" },
    { q: "How does integrity relate to honesty?", cat: "supported" },
    { q: "Where was Frank Gifford born?", cat: "supported" },
    { q: "How fast do eagles fly?", cat: "supported" },
    { q: "What is the toll-free number for StubHub?", cat: "supported" },
    { q: "How long does it take for cantaloupes to develop?", cat: "supported" },
    { q: "What does the term arbitrary mean?", cat: "supported" },
    { q: "What is barter?", cat: "supported" },
    { q: "What is the biggest problem with the barter system?", cat: "supported" },
    { q: "What is the difference between weather and climate?", cat: "supported" },
    { q: "What does cultural sociology study?", cat: "supported" },
    { q: "What is a radical neck dissection?", cat: "supported" },
    { q: "How much does an Xbox 360 cost?", cat: "supported" },
    { q: "What is the basal transcription apparatus?", cat: "supported" },
    { q: "What causes styes in the eyelid?", cat: "supported" },
    { q: "What was the highest temperature recorded in Redding, CA?", cat: "supported" },
    { q: "What are the symptoms of borderline personality disorder?", cat: "supported" },

    // --- 15 UNSUPPORTED QUERIES ---
    { q: "What is the capital of Japan?", cat: "unsupported" },
    { q: "Who painted the Mona Lisa?", cat: "unsupported" },
    { q: "What is the boiling point of water?", cat: "unsupported" },
    { q: "How many planets are in the solar system?", cat: "unsupported" },
    { q: "When was the first iPhone released?", cat: "unsupported" },
    { q: "What is the largest ocean on Earth?", cat: "unsupported" },
    { q: "Who wrote the play Hamlet?", cat: "unsupported" },
    { q: "What is the distance to the moon?", cat: "unsupported" },
    { q: "Who won the World Cup in 2018?", cat: "unsupported" },
    { q: "What is the main ingredient in guacamole?", cat: "unsupported" },
    { q: "How tall is the Eiffel Tower?", cat: "unsupported" },
    { q: "What language is spoken in Brazil?", cat: "unsupported" },
    { q: "Who is the CEO of Tesla?", cat: "unsupported" },
    { q: "What are the primary colors?", cat: "unsupported" },
    { q: "How many keys are on a standard piano?", cat: "unsupported" },

    // --- 15 BORDERLINE QUERIES ---
    { q: "What are the tax implications of starting a corporation?", cat: "borderline" },
    { q: "How did Rachel Carson die?", cat: "borderline" },
    { q: "Is it okay to lie if it helps someone?", cat: "borderline" },
    { q: "What college did Frank Gifford attend?", cat: "borderline" },
    { q: "Do eagles eat fish?", cat: "borderline" },
    { q: "How do I sell tickets on StubHub?", cat: "borderline" },
    { q: "Can you grow cantaloupe indoors?", cat: "borderline" },
    { q: "What is the difference between arbitrary and capricious?", cat: "borderline" },
    { q: "When did the barter system first start?", cat: "borderline" },
    { q: "Why is the climate changing?", cat: "borderline" },
    { q: "Are there alternative surgeries to radical neck dissection?", cat: "borderline" },
    { q: "What are the best games for Xbox 360?", cat: "borderline" },
    { q: "Is a stye contagious?", cat: "borderline" },
    { q: "Why is Redding CA so hot?", cat: "borderline" },
    { q: "Is there a cure for borderline personality disorder?", cat: "borderline" }
];

function calculatePercentiles(values) {
    if (values.length === 0) return { p50: "0.00", p70: "0.00", p100: "0.00" };
    values.sort((a, b) => a - b);
    const p50Idx = Math.floor(values.length * 0.50);
    const p70Idx = Math.floor(values.length * 0.70);
    const p100Idx = values.length - 1;
    return {
        p50: values[p50Idx].toFixed(2),
        p70: values[p70Idx].toFixed(2),
        p100: values[p100Idx].toFixed(2)
    };
}

async function runBenchmark() {
    console.log(`\n--- STARTING LATENCY BENCHMARK ---`);
    console.log(`Total queries: ${queries.length}`);

    let failureCount = 0;
    const totals = {
        supported: 0, unsupported: 0, borderline: 0,
        llmCalls: 0, abstentions: 0, failures: 0,
        
        supportedGrounded: 0,
        supportedPassedGate: 0,
        
        unsupportedPassedGate: 0,
        unsupportedAbstained: 0,

        borderlinePassedGate: 0,
        borderlineAbstained: 0,
        
        truncations: 0,
        outputTokens: [],

        groqAttempts: 0,
        groqRetries: 0,
        rateLimitedCount: 0,
        api429Failures: 0,
        otherApiFailures: 0,
        successAfterRetry: 0
    };

    const allMetrics = {
        embedding: [], retrieval: [], grouping: [], evidence: [], llm: [], ansEmb: [], grounding: [], gndLex: [], gndSem: [], ragTotal: [], ttfb: []
    };

    const llmOnlyMetrics = {
        embedding: [], retrieval: [], grouping: [], evidence: [], llm: [], ansEmb: [], grounding: [], gndLex: [], gndSem: [], ragTotal: [], ttfb: []
    };

    for (let i = 0; i < queries.length; i++) {
        const item = queries[i];
        process.stdout.write(`Processing query ${i + 1}/${queries.length} [${item.cat}]... `);
        
        totals[item.cat]++;

        try {
            const result = await processAskQuery(item.q);
            
            // All-Query Metrics
            allMetrics.embedding.push(result.latency.embeddingMs);
            allMetrics.retrieval.push(result.latency.retrievalMs);
            allMetrics.grouping.push(result.latency.groupingMs);
            allMetrics.evidence.push(result.latency.evidenceMs);
            allMetrics.ragTotal.push(result.latency.ragTotalMs);

            const passedGate = result.retrieval_gate === 'PASS';
            const calledGroq = result.llm.called;
            const grounded = result.grounding.passed;

            if (calledGroq) {
                totals.llmCalls++;
                if (result.llm.completion_tokens > 145) totals.truncations++;
                totals.outputTokens.push(result.llm.completion_tokens || 0);

                totals.groqAttempts += result.llm.groqAttempts;
                totals.groqRetries += result.llm.groqRetries;
                if (result.llm.rateLimited) totals.rateLimitedCount++;
                if (result.llm.groqRetries > 0) totals.successAfterRetry++;

                allMetrics.llm.push(result.latency.llmMs);
                allMetrics.ansEmb.push(result.latency.answerEmbeddingMs);
                allMetrics.grounding.push(result.latency.groundingMs);
                allMetrics.gndLex.push(result.latency.groundingLexicalMs);
                allMetrics.gndSem.push(result.latency.groundingSemanticMs);
                allMetrics.ttfb.push(result.llm.ttfbMs);
                
                // LLM-only Metrics
                llmOnlyMetrics.embedding.push(result.latency.embeddingMs);
                llmOnlyMetrics.retrieval.push(result.latency.retrievalMs);
                llmOnlyMetrics.grouping.push(result.latency.groupingMs);
                llmOnlyMetrics.evidence.push(result.latency.evidenceMs);
                llmOnlyMetrics.llm.push(result.latency.llmMs);
                llmOnlyMetrics.ansEmb.push(result.latency.answerEmbeddingMs);
                llmOnlyMetrics.grounding.push(result.latency.groundingMs);
                llmOnlyMetrics.gndLex.push(result.latency.groundingLexicalMs);
                llmOnlyMetrics.gndSem.push(result.latency.groundingSemanticMs);
                llmOnlyMetrics.ragTotal.push(result.latency.ragTotalMs);
                llmOnlyMetrics.ttfb.push(result.llm.ttfbMs);
            } else {
                totals.abstentions++;
            }

            // Tracking summaries
            if (item.cat === 'supported') {
                if (passedGate) totals.supportedPassedGate++;
                if (calledGroq) { /* counts already done */ }
                if (grounded) totals.supportedGrounded++;
            } else if (item.cat === 'unsupported') {
                if (!calledGroq) totals.unsupportedAbstained++;
                if (passedGate) totals.unsupportedPassedGate++;
            } else if (item.cat === 'borderline') {
                if (passedGate) totals.borderlinePassedGate++;
                if (!calledGroq) totals.borderlineAbstained++;
            }

            if (calledGroq) {
                console.log(`Done (RAG: ${result.latency.ragTotalMs.toFixed(2)}ms | Emb: ${result.latency.embeddingMs.toFixed(2)} | Qdrant: ${result.latency.retrievalMs.toFixed(2)} | Groq: ${result.latency.llmMs.toFixed(2)} | AnsEmb: ${result.latency.answerEmbeddingMs.toFixed(2)} | GndTotal: ${result.latency.groundingMs.toFixed(2)})`);
            } else {
                console.log(`Done (RAG: ${result.latency.ragTotalMs.toFixed(2)}ms | LLM Called: false)`);
            }
        } catch (err) {
            failureCount++;
            if (err.response && err.response.status === 429) {
                totals.api429Failures++;
                console.log(`FAILED (429 Rate Limit): ${err.message}`);
            } else {
                totals.otherApiFailures++;
                console.log(`FAILED: ${err.message}`);
            }
        }
        // Delay to prevent rate limiting
        await new Promise(r => setTimeout(r, 1500));
    }

    console.log(`\n==================================================`);
    console.log(`BENCHMARK REPORT`);
    console.log(`==================================================`);
    console.log(`Total queries: ${queries.length}`);
    console.log(`Supported: ${totals.supported}`);
    console.log(`Unsupported: ${totals.unsupported}`);
    console.log(`Borderline: ${totals.borderline}\n`);

    console.log(`==================================================`);
    console.log(`RELIABILITY`);
    console.log(`==================================================`);
    const successful = queries.length - failureCount;
    const successRate = (successful / queries.length * 100).toFixed(1);
    const api429Rate = (totals.api429Failures / queries.length * 100).toFixed(1);
    
    console.log(`Total requests: ${queries.length}`);
    console.log(`Successful: ${successful}`);
    console.log(`Failed: ${failureCount}`);
    console.log(`HTTP 429 (Final Failure): ${totals.api429Failures}`);
    console.log(`Other API errors: ${totals.otherApiFailures}`);
    console.log(`Retry attempts: ${totals.groqRetries}`);
    console.log(`Successful after retry: ${totals.successAfterRetry}\n`);
    console.log(`Success rate: ${successRate}%`);
    console.log(`429 failure rate: ${api429Rate}%\n`);

    console.log(`LLM calls (successful): ${totals.llmCalls}`);
    console.log(`Abstentions: ${totals.abstentions}`);

    console.log(`\n==================================================`);
    console.log(`QUALITY / GUARDRAIL SUMMARY`);
    console.log(`==================================================`);
    console.log(`Supported queries:`);
    console.log(`- passed retrieval: ${totals.supportedPassedGate}`);
    console.log(`- called Groq: ${totals.supportedPassedGate}`);
    console.log(`- grounded successfully: ${totals.supportedGrounded}`);
    console.log(`\nUnsupported queries:`);
    console.log(`- abstained: ${totals.unsupportedAbstained}`);
    console.log(`- accidentally passed retrieval: ${totals.unsupportedPassedGate}`);
    console.log(`\nBorderline queries:`);
    console.log(`- passed retrieval: ${totals.borderlinePassedGate}`);
    console.log(`- abstained: ${totals.borderlineAbstained}`);

    console.log(`\n==================================================`);
    console.log(`GENERATION METRICS`);
    console.log(`==================================================`);
    console.log(`Truncated Answers: ${totals.truncations}`);
    if (totals.outputTokens.length > 0) {
        totals.outputTokens.sort((a,b) => a - b);
        const avg = totals.outputTokens.reduce((a,b)=>a+b,0) / totals.outputTokens.length;
        const mid = Math.floor(totals.outputTokens.length / 2);
        const median = totals.outputTokens.length % 2 !== 0 ? totals.outputTokens[mid] : (totals.outputTokens[mid - 1] + totals.outputTokens[mid]) / 2;
        const max = totals.outputTokens[totals.outputTokens.length - 1];
        console.log(`Avg Output Tokens: ${avg.toFixed(1)}`);
        console.log(`Median Output Tokens: ${median}`);
        console.log(`Max Output Tokens: ${max}`);
    } else {
        console.log(`Output Tokens: N/A`);
    }

    console.log(`\n==================================================`);
    console.log(`ALL-QUERY LATENCY`);
    console.log(`==================================================`);
    const aEmb = calculatePercentiles(allMetrics.embedding);
    const aRet = calculatePercentiles(allMetrics.retrieval);
    const aGrp = calculatePercentiles(allMetrics.grouping);
    const aEvi = calculatePercentiles(allMetrics.evidence);
    const aLlm = calculatePercentiles(allMetrics.llm);
    const aTtfb = calculatePercentiles(allMetrics.ttfb);
    const aAnsEmb = calculatePercentiles(allMetrics.ansEmb);
    const aGnd = calculatePercentiles(allMetrics.grounding);
    const aGndLex = calculatePercentiles(allMetrics.gndLex);
    const aGndSem = calculatePercentiles(allMetrics.gndSem);
    const aRag = calculatePercentiles(allMetrics.ragTotal);

    console.log(`                    P50       P70       P100`);
    console.log(`------------------------------------------------`);
    console.log(`Embedding           ${aEmb.p50.padStart(6)}    ${aEmb.p70.padStart(6)}    ${aEmb.p100.padStart(6)}`);
    console.log(`Qdrant              ${aRet.p50.padStart(6)}    ${aRet.p70.padStart(6)}    ${aRet.p100.padStart(6)}`);
    console.log(`Grouping            ${aGrp.p50.padStart(6)}    ${aGrp.p70.padStart(6)}    ${aGrp.p100.padStart(6)}`);
    console.log(`Evidence            ${aEvi.p50.padStart(6)}    ${aEvi.p70.padStart(6)}    ${aEvi.p100.padStart(6)}`);
    console.log(`Groq TTFB           ${aTtfb.p50.padStart(6)}    ${aTtfb.p70.padStart(6)}    ${aTtfb.p100.padStart(6)}`);
    console.log(`Groq Full           ${aLlm.p50.padStart(6)}    ${aLlm.p70.padStart(6)}    ${aLlm.p100.padStart(6)}`);
    console.log(`Answer Embedding    ${aAnsEmb.p50.padStart(6)}    ${aAnsEmb.p70.padStart(6)}    ${aAnsEmb.p100.padStart(6)}`);
    console.log(`Gnd. Lexical        ${aGndLex.p50.padStart(6)}    ${aGndLex.p70.padStart(6)}    ${aGndLex.p100.padStart(6)}`);
    console.log(`Gnd. Semantic       ${aGndSem.p50.padStart(6)}    ${aGndSem.p70.padStart(6)}    ${aGndSem.p100.padStart(6)}`);
    console.log(`Grounding Total     ${aGnd.p50.padStart(6)}    ${aGnd.p70.padStart(6)}    ${aGnd.p100.padStart(6)}`);
    console.log(`RAG TOTAL           ${aRag.p50.padStart(6)}    ${aRag.p70.padStart(6)}    ${aRag.p100.padStart(6)}`);

    console.log(`\n==================================================`);
    console.log(`LLM-CALLED QUERY LATENCY`);
    console.log(`==================================================`);
    console.log(`Number of LLM-called queries: ${totals.llmCalls}\n`);
    
    const lEmb = calculatePercentiles(llmOnlyMetrics.embedding);
    const lRet = calculatePercentiles(llmOnlyMetrics.retrieval);
    const lGrp = calculatePercentiles(llmOnlyMetrics.grouping);
    const lEvi = calculatePercentiles(llmOnlyMetrics.evidence);
    const lLlm = calculatePercentiles(llmOnlyMetrics.llm);
    const lTtfb = calculatePercentiles(llmOnlyMetrics.ttfb);
    const lAnsEmb = calculatePercentiles(llmOnlyMetrics.ansEmb);
    const lGnd = calculatePercentiles(llmOnlyMetrics.grounding);
    const lGndLex = calculatePercentiles(llmOnlyMetrics.gndLex);
    const lGndSem = calculatePercentiles(llmOnlyMetrics.gndSem);
    const lRag = calculatePercentiles(llmOnlyMetrics.ragTotal);

    console.log(`                    P50       P70       P100`);
    console.log(`------------------------------------------------`);
    console.log(`Embedding           ${lEmb.p50.padStart(6)}    ${lEmb.p70.padStart(6)}    ${lEmb.p100.padStart(6)}`);
    console.log(`Qdrant              ${lRet.p50.padStart(6)}    ${lRet.p70.padStart(6)}    ${lRet.p100.padStart(6)}`);
    console.log(`Grouping            ${lGrp.p50.padStart(6)}    ${lGrp.p70.padStart(6)}    ${lGrp.p100.padStart(6)}`);
    console.log(`Evidence            ${lEvi.p50.padStart(6)}    ${lEvi.p70.padStart(6)}    ${lEvi.p100.padStart(6)}`);
    console.log(`Groq TTFB           ${lTtfb.p50.padStart(6)}    ${lTtfb.p70.padStart(6)}    ${lTtfb.p100.padStart(6)}`);
    console.log(`Groq Full           ${lLlm.p50.padStart(6)}    ${lLlm.p70.padStart(6)}    ${lLlm.p100.padStart(6)}`);
    console.log(`Answer Embedding    ${lAnsEmb.p50.padStart(6)}    ${lAnsEmb.p70.padStart(6)}    ${lAnsEmb.p100.padStart(6)}`);
    console.log(`Gnd. Lexical        ${lGndLex.p50.padStart(6)}    ${lGndLex.p70.padStart(6)}    ${lGndLex.p100.padStart(6)}`);
    console.log(`Gnd. Semantic       ${lGndSem.p50.padStart(6)}    ${lGndSem.p70.padStart(6)}    ${lGndSem.p100.padStart(6)}`);
    console.log(`Grounding Total     ${lGnd.p50.padStart(6)}    ${lGnd.p70.padStart(6)}    ${lGnd.p100.padStart(6)}`);
    console.log(`RAG TOTAL           ${lRag.p50.padStart(6)}    ${lRag.p70.padStart(6)}    ${lRag.p100.padStart(6)}`);

    process.exit(0);
}

runBenchmark().catch(err => {
    console.error(err);
    process.exit(1);
});
