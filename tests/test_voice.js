const fs = require('fs');
const FormData = require('form-data');
const axios = require('axios');

async function testVoice(filename) {
    console.log(`\nTesting Voice File: ${filename}`);
    const form = new FormData();
    form.append('audio', fs.createReadStream(filename));

    try {
        const response = await axios.post('http://localhost:3000/api/ask', form, {
            headers: {
                ...form.getHeaders()
            }
        });
        console.log("Sarvam Transcript:", response.data.transcript);
        console.log("Processed Query:", response.data.query);
        console.log("RAG Answer:", response.data.answer);
        console.log("Grounded?", response.data.grounded);
        console.log("LLM Called?", response.data.llm_called);
    } catch (err) {
        console.error("FAILED:");
        if (err.response) console.error(err.response.data);
        else console.error(err.message);
    }
}

async function run() {
    await testVoice('tests/voice1.wav');
    await testVoice('tests/voice2.wav');
}

run();
