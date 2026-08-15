const axios = require('axios');

const queries = [
    "What is a corporation?",
    "Why did Rachel Carson write The Obligation to Endure?",
    "What is honesty or integrity?",
    "What is the capital of Goa?"
];

async function runTests() {
    for (const q of queries) {
        console.log("================================");
        console.log(`QUERY:\n${q}\n`);
        
        try {
            const res = await axios.post('http://localhost:3001/ask', { query: q });
            const data = res.data;
            
            console.log("TOP RESULTS:\n");
            if (data.results && data.results.length > 0) {
                data.results.forEach((r, idx) => {
                    console.log(`${idx + 1}.`);
                    console.log(`score:\n${r.score}`);
                    console.log(`query_id:\n${r.query_id}`);
                    console.log(`Eng_Query:\n${r.Eng_Query}`);
                    console.log(`passage:\n${r.passage}\n`);
                });
            } else {
                console.log("None\n");
            }
            
            console.log(`GROUPED RECORDS:\n${JSON.stringify(data.grouped_records, null, 2)}\n`);
            console.log(`SELECTED EVIDENCE:\n${data.context}\n`);
            console.log(`BEST SCORE:\n${data.best_score}\n`);
            console.log(`RETRIEVAL GATE:\n${data.retrieval_gate}\n`);
            console.log(`LLM CALLED:\n${data.groq_called ? 'YES' : 'NO'}\n`);
            console.log(`FINAL ANSWER:\n${data.answer}\n`);
            
            if (data.grouped_records && data.grouped_records.length > 0) {
                console.log(`query_id:\n${data.grouped_records[0].query_id}`);
                console.log(`Eng_Query:\n${data.grouped_records[0].Eng_Query}`);
                console.log(`Eng_Answer:\n${data.grouped_records[0].Eng_Answer}\n`);
            }
            
        } catch (e) {
            console.error("Test failed:", e.message);
            if (e.response && e.response.data) {
                console.error(e.response.data);
            }
        }
    }
}

runTests();
