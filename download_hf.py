import os
import json
import numpy as np
import pandas as pd
import pyarrow.parquet as pq
from huggingface_hub import hf_hub_download

print("Downloading ai4bharat/MSMARCO-XI validation/hinval.parquet...")
file_path = hf_hub_download(repo_id="ai4bharat/MSMARCO-XI", filename="validation/hinval.parquet", repo_type="dataset")

print(f"Downloaded to {file_path}")
print("Extracting 500 records...")

pf = pq.ParquetFile(file_path)
table = pf.read_row_group(0)
df = table.slice(0, 500).to_pandas()

records = df.to_dict(orient="records")
def default_converter(o):
    if isinstance(o, np.ndarray):
        return o.tolist()
    return str(o)

with open("msmarco_subset.json", "w", encoding="utf-8") as f:
    json.dump(records, f, ensure_ascii=False, indent=2, default=default_converter)

print("Saved real records to msmarco_subset.json!")
