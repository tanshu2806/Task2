const fs = require('fs');

const data = JSON.parse(fs.readFileSync('msmarco_subset.json', 'utf8'));

console.log("Looking for answerable queries...");
let found = 0;
for (let i = 0; i < data.length; i++) {
    const record = data[i];
    if (record.Eng_Answer && record.Eng_Answer.trim() !== 'No Answer Present.' && record.Eng_Answer.trim().length > 10) {
        console.log(`\nRECORD ${i}`);
        console.log(`QUERY: ${record.Eng_Query}`);
        console.log(`ANSWER: ${record.Eng_Answer}`);
        let passages = [];
        if (record.passages && record.passages.English_passages && record.passages.is_selected) {
            for (let j = 0; j < record.passages.English_passages.length; j++) {
                if (record.passages.is_selected[j] === 1) {
                    passages.push(record.passages.English_passages[j]);
                }
            }
        }
        console.log(`PASSAGES: ${passages.join(' ')}`);
        found++;
        if (found >= 3) break;
    }
}
