const axios = require('axios');

async function retrieveFromHuggingFace(query, config = 'default', split = 'validation') {
    const url = `https://datasets-server.huggingface.co/search`;
    
    try {
        const response = await axios.get(url, {
            params: {
                dataset: 'ai4bharat/MSMARCO-XI',
                config: config,
                split: split,
                query: query
            },
            timeout: 10000
        });

        const rows = response.data.rows || [];
        
        // Normalize
        return rows.map((r, index) => {
            return {
                id: r.row_idx !== undefined ? r.row_idx : index,
                query: r.row.query || r.row.Eng_Query,
                englishQuery: r.row.Eng_Query,
                answer: r.row.Answer || r.row.Eng_Answer,
                passage: r.row.passages && r.row.passages.English_passages ? r.row.passages.English_passages.join('\n') : '',
                language: 'en',
                sourceDocument: 'ai4bharat/MSMARCO-XI',
                score: r.score !== undefined ? r.score : 1.0
            };
        });

    } catch (error) {
        console.error("Hugging Face API Error:", error.response ? error.response.data : error.message);
        // Requirement: If Hugging Face retrieval fails: FAIL LOUDLY. Return an explicit retrieval error.
        throw new Error("Remote MSMARCO-XI retrieval failed. Dataset viewer API is unavailable or returning errors for this dataset.");
    }
}

module.exports = {
    retrieveFromHuggingFace
};
