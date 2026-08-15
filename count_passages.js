const fs = require('fs');

const data = JSON.parse(fs.readFileSync('msmarco_subset.json', 'utf8'));
const MAX_RECORDS = 500;
const subset = data.slice(0, MAX_RECORDS);

let passageCount = 0;

for (const r of subset) {
    let selectedCount = 0;
    if (r.passages && r.passages.English_passages && r.passages.is_selected) {
        for (let i = 0; i < r.passages.English_passages.length; i++) {
            if (r.passages.is_selected[i] === 1) {
                selectedCount++;
            }
        }
        if (selectedCount === 0 && r.passages.English_passages.length > 0) {
            selectedCount = 1; // Fallback
        }
    }
    passageCount += selectedCount;
}

console.log(`PASSAGES_COUNT: ${passageCount}`);
