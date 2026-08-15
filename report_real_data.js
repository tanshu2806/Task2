const fs = require('fs');
const data = JSON.parse(fs.readFileSync('msmarco_subset.json', 'utf8'));

console.log("Real records from subset:");
console.log(JSON.stringify(data.slice(0, 10).map(r => ({
  query_id: r.query_id,
  query: r.query,
  Eng_Query: r.Eng_Query,
  answer: r.Answer || r.Eng_Answer,
  passages: r.passages.English_passages[0] ? r.passages.English_passages[0].substring(0, 50) + "..." : "",
  original_id: r.query_id,
  source_file: "ai4bharat/MSMARCO-XI/hinval.parquet"
})), null, 2));
