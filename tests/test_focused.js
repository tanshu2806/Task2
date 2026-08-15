require('dotenv').config();
const { processAskQuery } = require('../server');
const axios = require('axios');

async function runTests() {
    console.log("=== FOCUSED GROUNDING TESTS ===\n");

    try {
        console.log("--- TEST 1: Corporation ---");
        const res1 = await processAskQuery("What is a corporation?");
        console.log("Retrieval Gate:", res1.retrieval_gate);
        console.log("Groq Called:", res1.llm.called);
        console.log("Grounding Checked:", res1.grounding.checked);
        console.log("Grounded Result:", res1.grounding.passed);
        console.log("Grounding Confidence:", res1.grounding.confidence);
        console.log("Answer:", res1.answer);
        console.log("");

        console.log("--- TEST 2: Honesty/Integrity ---");
        const res2 = await processAskQuery("What is honesty or integrity?");
        console.log("Retrieval Gate:", res2.retrieval_gate);
        console.log("Groq Called:", res2.llm.called);
        console.log("Grounding Checked:", res2.grounding.checked);
        console.log("Grounded Result:", res2.grounding.passed);
        console.log("Grounding Confidence:", res2.grounding.confidence);
        console.log("Answer:", res2.answer);
        console.log("");

        console.log("--- TEST 3: Rachel Carson ---");
        const res3 = await processAskQuery("Why did Rachel Carson write The Obligation to Endure?");
        console.log("Retrieval Gate:", res3.retrieval_gate);
        console.log("Groq Called:", res3.llm.called);
        console.log("Grounding Checked:", res3.grounding.checked);
        console.log("Grounded Result:", res3.grounding.passed);
        console.log("Grounding Confidence:", res3.grounding.confidence);
        console.log("Answer:", res3.answer);
        console.log("");

        console.log("--- TEST 4: Hallucination ---");
        // Monkeypatch axios to force hallucination
        const originalPost = axios.post;
        axios.post = async (url, data, config) => {
            if (url.includes('groq')) {
                return {
                    data: {
                        on: (event, cb) => {
                            if (event === 'data') {
                                cb(Buffer.from('data: {"choices":[{"delta":{"content":"A corporation is legally a person of 500 people located in London."}}]}\n\ndata: [DONE]\n'));
                            }
                            if (event === 'end') {
                                cb();
                            }
                        }
                    }
                };
            }
            return originalPost(url, data, config);
        };

        const res4 = await processAskQuery("What is a corporation?");
        console.log("Retrieval Gate:", res4.retrieval_gate);
        console.log("Groq Called:", res4.llm.called);
        console.log("Grounding Checked:", res4.grounding.checked);
        console.log("Grounded Result:", res4.grounding.passed);
        console.log("Grounding Confidence:", res4.grounding.confidence);
        console.log("Answer:", res4.answer);
        console.log("");

        // Restore axios
        axios.post = originalPost;

        console.log("=== TESTS COMPLETE ===");
    } catch (err) {
        console.error("Test failed:", err);
    }
    process.exit(0);
}

runTests();
