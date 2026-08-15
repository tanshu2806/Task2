import pyarrow.dataset as ds
import json
import pyarrow as pa
import pandas as pd
import numpy as np

URL = "hf://datasets/ai4bharat/MSMARCO-XI/validation/hinval.parquet"
print(f"Streaming from {URL}...")

dataset = ds.dataset(URL, format="parquet")
scanner = dataset.scanner(batch_size=100)

for batch in scanner.to_batches():
    df = batch.to_pandas()
    break  # Just get the first batch

print("Extracting records...")
records = df.to_dict(orient="records")

def default_converter(o):
    if isinstance(o, np.ndarray):
        return o.tolist()
    raise TypeError(f"Object of type {o.__class__.__name__} is not JSON serializable")

with open("msmarco_subset.json", "w", encoding="utf-8") as f:
    json.dump(records, f, ensure_ascii=False, indent=2, default=default_converter)

print(f"Saved {len(records)} records!")
