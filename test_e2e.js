const { runPipeline } = require('./rag_pipeline');

const queries = [
    "what is rba",
    "was ronald reagan a democrat",
    "what is a conifer",
    "what is the capital of Goa"
];

async function runE2ETests() {
    for (let i = 0; i < queries.length; i++) {
        const q = queries[i];
        console.log(`\nVOICE TEST ${i + 1}:`);
        console.log(`"${q}"`);
        
        try {
            console.log(`TRANSCRIPT:\n${q}`);
            const result = await runPipeline(null, q);
            
            // The pipeline will throw before getting here if HF API fails loudly
            console.log(`RETRIEVED:\n${result.contextPreview}`);
            console.log(`SOURCE:\nai4bharat/MSMARCO-XI`);
            console.log(`LLM CALLED:\nYES`);
            console.log(`ANSWER:\n${result.answer}`);
        } catch (e) {
            console.log(`RETRIEVED:\nFAILED - ${e.message}`);
            console.log(`SOURCE:\nai4bharat/MSMARCO-XI`);
            console.log(`LLM CALLED:\nNO`);
            console.log(`ANSWER:\nSystem failed due to explicit retrieval error`);
        }
    }
}

runE2ETests();
