import pyarrow.parquet as pq
import fsspec
import json
import numpy as np

URL = "hf://datasets/ai4bharat/MSMARCO-XI/validation/hinval.parquet"
print(f"Reading {URL} using PyArrow & fsspec...", flush=True)

try:
    fs, path = fsspec.core.url_to_fs(URL)
    with fs.open(path, "rb") as f:
        pf = pq.ParquetFile(f)
        print("Num row groups:", pf.num_row_groups, flush=True)
        print("Reading first row group...", flush=True)
        table = pf.read_row_group(0)
        print("Slicing 500 rows...", flush=True)
        df = table.slice(0, 500).to_pandas()
        
    records = df.to_dict(orient="records")
    def default_converter(o):
        if isinstance(o, np.ndarray):
            return o.tolist()
        return str(o)

    print("Saving to msmarco_subset.json...", flush=True)
    with open("msmarco_subset.json", "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=2, default=default_converter)
    print("Done!", flush=True)
except Exception as e:
    print(f"Error: {e}")
