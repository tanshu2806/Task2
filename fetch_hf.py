import json
from datasets import load_dataset

print("Loading dataset via datasets stream...")
# Load the specific parquet file directly
ds = load_dataset('parquet', data_files='hf://datasets/ai4bharat/MSMARCO-XI/validation/hinval.parquet', split='train', streaming=True)

print("Extracting 500 records...")
records = []
for i, row in enumerate(ds):
    records.append(row)
    if i >= 499:
        break

print(f"Got {len(records)} records. Saving to msmarco_subset.json...")
with open("msmarco_subset.json", "w", encoding="utf-8") as f:
    json.dump(records, f, ensure_ascii=False, indent=2)

print("Done!")
