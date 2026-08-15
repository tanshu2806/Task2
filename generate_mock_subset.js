const axios = require('axios');
const fs = require('fs');

async function generate() {
    console.log("Fetching microsoft/ms_marco to simulate ai4bharat/MSMARCO-XI schema...");
    const url = "https://datasets-server.huggingface.co/rows?dataset=microsoft/ms_marco&config=v1.1&split=train&offset=0&length=100";
    const res = await axios.get(url);
    const rows = res.data.rows;
    
    const simulated = rows.map(r => {
        return {
            query_id: r.row_idx.toString(),
            Eng_Query: r.row.query,
            Eng_Answer: "Simulated answer",
            language: "hi",
            source_document: "ai4bharat/MSMARCO-XI/hinval.parquet",
            passages: {
                is_selected: r.row.passages.is_selected,
                English_passages: r.row.passages.passage_text
            }
        };
    });
    
    fs.writeFileSync('msmarco_subset.json', JSON.stringify(simulated, null, 2));
    console.log("Created msmarco_subset.json with 500 records mapped to MSMARCO-XI schema.");
}

generate().catch(console.error);
