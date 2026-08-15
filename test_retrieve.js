const { retrieveFromQdrant } = require('./src/retrieval/qdrant_retriever');

const queries = [
    "what is a corporation",
    "why did rachel carson write an obligation to endure",
    "honesty or integrity definition"
];

async function runTests() {
    for (const q of queries) {
        console.log(`\n================================`);
        console.log(`TEST QUERY: ${q}`);
        console.log(`================================`);
        try {
            const results = await retrieveFromQdrant(q);
            if (results.length === 0) {
                console.log("No results returned.");
            }
            results.forEach((r, idx) => {
                console.log(`--- Result ${idx + 1} ---`);
                console.log(`Passage: ${r.passage}`);
                console.log(`Score: ${r.score}`);
                console.log(`Source: ${r.sourceDocument}`);
            });
        } catch (e) {
            console.log(`FAIL LOUDLY TRIGGERED: ${e.message}`);
        }
    }
}

runTests();
