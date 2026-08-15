import sys
sys.stdout.reconfigure(encoding="utf-8")
import os
import time
from datasets import load_dataset
from sentence_transformers import SentenceTransformer
from qdrant_client import QdrantClient
from qdrant_client.http import models

URL = "https://huggingface.co/datasets/ai4bharat/MSMARCO-XI/resolve/main/validation/hinval.parquet"
COLLECTION_NAME = "msmarco_xi"
LIMIT = 10000

def main():
    print("Loading embedding model...")
    model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
    
    print("Connecting to local Qdrant...")
    client = QdrantClient("http://localhost:6333")
    
    # Recreate collection
    print(f"Recreating collection {COLLECTION_NAME}...")
    try:
        client.delete_collection(collection_name=COLLECTION_NAME)
    except Exception:
        pass
        
    client.create_collection(
        collection_name=COLLECTION_NAME,
        vectors_config=models.VectorParams(size=384, distance=models.Distance.COSINE),
    )
    
    print("Connecting to remote Parquet via HF streaming...")
    ds = load_dataset("parquet", data_files={"validation": URL}, split="validation", streaming=True)
    
    print(f"Streaming and indexing up to {LIMIT} records...")
    
    count = 0
    batch_points = []
    
    for record in ds:
        passages = record.get('passages', {})
        is_selected = passages.get('is_selected', [])
        eng_passages = passages.get('English_passages', [])
        
        # Only extract the passage where is_selected == 1
        for i, selected in enumerate(is_selected):
            if selected == 1 and i < len(eng_passages):
                passage_text = eng_passages[i]
                
                # Bundle metadata exactly as requested
                metadata = {
                    "query_id": str(record.get('query_id', '')),
                    "query": str(record.get('query', '')),
                    "eng_query": str(record.get('Eng_Query', '')),
                    "answer": str(record.get('Answer', '')),
                    "eng_answer": str(record.get('Eng_Answer', '')),
                    "passage": str(passage_text),
                    "language": "hi",
                    "source_lang": str(record.get('source_lang', '')),
                    "target_lang": str(record.get('target_lang', '')),
                    "source_document": "ai4bharat/MSMARCO-XI",
                    "is_selected": 1
                }
                
                # Create vector
                embedding = model.encode(passage_text).tolist()
                
                # We need a unique ID for Qdrant (uuid or int). We'll use a sequential ID.
                # query_id from dataset is numeric for MSMARCO, but might have duplicates if multiple passages.
                # So we combine with index.
                uid = int(str(record.get('query_id', count)) + str(i))
                # Qdrant requires unsigned integer or UUID string.
                # Just use an auto-increment counter to avoid hash collisions
                point_id = count * 100 + i
                
                batch_points.append(
                    models.PointStruct(
                        id=point_id,
                        vector=embedding,
                        payload=metadata
                    )
                )
                
        count += 1
        
        if len(batch_points) >= 100:
            client.upsert(
                collection_name=COLLECTION_NAME,
                points=batch_points
            )
            print(f"Upserted {count} records...")
            batch_points = []
            
        if count >= LIMIT:
            break
            
    # Upsert remaining
    if len(batch_points) > 0:
        client.upsert(
            collection_name=COLLECTION_NAME,
            points=batch_points
        )
        print(f"Upserted final records. Total processed: {count}")
        
    print(f"Successfully ingested {count} real records into Qdrant!")

if __name__ == "__main__":
    main()
