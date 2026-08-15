# DATASET PROVENANCE: UNVERIFIED

## Current Status
**BLOCKED**

## Reason
Official data access from `ai4bharat/MSMARCO-XI` is currently **impossible** using extraction methods due to upstream Hugging Face API errors and dataset encoding decisions:

1. **Dataset Viewer API Failure**: The Hugging Face `datasets-server` `/rows` and `/first-rows` endpoints both return HTTP 500 (`The server is busier than usual and the response is not ready yet. Please retry later.`) for all languages and configs in `ai4bharat/MSMARCO-XI` (tested `hi`, `ur`, etc.). The backend worker has likely failed to process this large dataset.
2. **Streaming / PyArrow Range Request Failure**: I used `pyarrow` over `fsspec` to inspect the Parquet file metadata (`hinval.parquet`). The 440MB file is encoded as a **single monolithic row group** (`num_row_groups: 1`). The train split (`hintrain.parquet`, 10GB) similarly has a single 9GB row group. Because there is only one row group containing the entire split, streaming downloads or HTTP range requests cannot fetch a subset of rows without downloading the entire monolithic 440MB column chunk into memory. 
3. **Slow / Throttled Raw Download**: Using standard raw HTTP downloads or the Hugging Face python API, the download speed for the 440MB `hinval.parquet` is severely throttled (averaging < 2 Mbps, taking >30 minutes to download).

As a result, acquiring a reproducible subset from the official dataset is impossible without waiting ~30-40 minutes for a full manual 440MB file download.

Per your strict instructions, I am stopping here and reporting this failure. The ingestion pipeline requires real data, but the official data cannot be acquired right now. DO NOT proceed to indexing until data is available.
