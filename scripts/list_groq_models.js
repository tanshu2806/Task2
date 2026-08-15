require('dotenv').config();
const axios = require('axios');

async function listModels() {
    try {
        const apiKey = process.env.GROQ_API_KEY;
        const response = await axios.get('https://api.groq.com/openai/v1/models', {
            headers: {
                'Authorization': `Bearer ${apiKey}`
            }
        });
        
        console.log("=== AVAILABLE GROQ MODELS ===");
        const models = response.data.data;
        models.forEach(m => console.log(`- ${m.id} (owned by ${m.owned_by})`));
    } catch (e) {
        console.error("Error fetching models:", e.message);
    }
}

listModels();
