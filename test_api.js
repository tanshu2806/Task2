const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');

async function testApi() {
    try {
        const form = new FormData();
        form.append('audio', fs.createReadStream('./dummy.webm'));

        console.log("Sending request to http://localhost:3000/api/ask");
        const res = await axios.post('http://localhost:3000/api/ask', form, {
            headers: {
                ...form.getHeaders()
            }
        });
        
        console.log("Response:", JSON.stringify(res.data, null, 2));
    } catch (e) {
        console.error("Error:", e.response ? e.response.data : e.message);
    }
}
testApi();
