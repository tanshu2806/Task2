import requests
import time
import os
import sys

URL = "https://huggingface.co/datasets/ai4bharat/MSMARCO-XI/resolve/main/validation/hinval.parquet"
filename = "hinval.parquet"

print(f"Downloading {URL}...")
response = requests.get(URL, stream=True)
response.raise_for_status()
total_size = int(response.headers.get('content-length', 0))
block_size = 1024 * 1024 # 1MB

downloaded = 0
start_time = time.time()

with open(filename, "wb") as f:
    for data in response.iter_content(block_size):
        f.write(data)
        downloaded += len(data)
        percent = (downloaded / total_size) * 100 if total_size else 0
        sys.stdout.write(f"\rDownloaded {downloaded / 1024 / 1024:.2f} MB / {total_size / 1024 / 1024:.2f} MB ({percent:.1f}%)")
        sys.stdout.flush()

print(f"\nDownload complete in {time.time() - start_time:.1f}s.")

print("\nExtracting records...")
import pandas as pd
import json
import numpy as np

df = pd.read_parquet(filename)
df_head = df.head(500)
records = df_head.to_dict(orient="records")

def default_converter(o):
    if isinstance(o, np.ndarray):
        return o.tolist()
    return str(o)

with open("msmarco_subset.json", "w", encoding="utf-8") as f:
    json.dump(records, f, ensure_ascii=False, indent=2, default=default_converter)

print("Saved to msmarco_subset.json!")
