import pyarrow.parquet as pq
import pyarrow.fs as fs
import time

URL = "https://huggingface.co/datasets/ai4bharat/MSMARCO-XI/resolve/main/validation/hinval.parquet"

import fsspec

def investigate():
    try:
        print("Connecting to remote Parquet via fsspec...")
        t0 = time.time()
        
        try:
            fs = fsspec.filesystem('https')
            f = fs.open(URL, 'rb')
            parquet_file = pq.ParquetFile(f)
            meta = parquet_file.metadata
            print("HTTP Range Requests: SUPPORTED (ParquetFile opened successfully via URL)")
        except Exception as e:
            print(f"Failed to open via fsspec: {e}")
            return
            
        t_meta = time.time() - t0
        print(f"Time to fetch metadata: {t_meta:.2f}s")
        
        print("\nREMOTE FILE SIZE:", meta.serialized_size)
        print("ROWS:", meta.num_rows)
        print("ROW GROUPS:", meta.num_row_groups)
        
        schema = parquet_file.schema
        print("\nCOLUMNS:")
        for i, name in enumerate(schema.names):
            print(f"  - {name}")
            
        print("\nChecking random access...")
        
        # Try reading row group 0
        t1 = time.time()
        rg0 = parquet_file.read_row_group(0)
        t_rg0 = time.time() - t1
        print(f"Read row group 0 in {t_rg0:.2f}s")
        
        # Determine query search feasibility
        # Without an index, Parquet requires scanning row groups.
        # Let's see if there are any statistics/indexes.
        print("\nChecking for indexes/statistics on 'Eng_Query' or 'query'...")
        eng_query_idx = schema.names.index('Eng_Query') if 'Eng_Query' in schema.names else -1
        if eng_query_idx != -1:
            rg_meta = meta.row_group(0)
            col_meta = rg_meta.column(eng_query_idx)
            stats = col_meta.statistics
            if stats and stats.has_min_max:
                print(f"Eng_Query has min/max statistics: {stats.min} - {stats.max}")
            else:
                print("Eng_Query has NO statistics/dictionary index available in metadata.")
        
    except Exception as e:
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    investigate()
