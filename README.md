# Voice-Enabled Retrieval-Augmented Generation (RAG) System

## Project
This project is a high-performance, Voice-enabled Retrieval-Augmented Generation (RAG) system built for the `#RAGInGoa` hackathon. It combines state-of-the-art voice transcription, local vector embeddings, and an optimized LLM pipeline to answer domain-specific questions rapidly and safely.

## Problem
Modern AI applications often suffer from factual hallucinations and excessive latency when integrating speech-to-text with LLMs. This project solves that by engineering a sub-250ms internal RAG pipeline equipped with a strict, 100% precision local grounding guardrail to guarantee factual accuracy from a trusted knowledge base.

## Architecture

```text
User Voice
   ↓
Sarvam STT
   ↓
Query Processing
   ↓
Local Embedding (MiniLM)
   ↓
HNSW FAISS Vector Search
   ↓
Context Construction
   ↓
Groq LLM (Llama 3.1)
   ↓
Hybrid Grounding (Lexical + Semantic)
   ↓
Grounded Answer
```
*(See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for a detailed sequence diagram and latency instrumentation points).*

## Dataset
We utilized the **MSMARCO-XI** (Microsoft Machine Reading Comprehension - Cross-Lingual) dataset. It provides a massive corpus of real-world search queries and relevant passages. We ingested a subset of this dataset, extracting the English passages and indexing them into our local FAISS vector store to serve as the ground-truth knowledge base.

## Chunking
During research, we evaluated multiple chunking methods (Fixed-Size, Semantic, and Sentence-Aware). We selected **Sentence-Aware Hybrid Chunking** as our final approach. It provides the optimal balance of context preservation (preventing mid-sentence splits) while maintaining a small enough token footprint to keep retrieval latency under 1 millisecond.

## Retrieval
- **Embedding Model**: `Xenova/all-MiniLM-L6-v2` loaded locally via ONNX Runtime to eliminate embedding API network latency.
- **Vector DB**: FAISS using the HNSW (Hierarchical Navigable Small World) index type for blazing fast approximate nearest neighbor search.
- **Process**: The transcribed query is embedded locally, searched against the in-memory HNSW index, and the top-k results are returned with normalized L2 distance confidence scores.

## Guardrails
The system implements a rigorous, multi-layered safety net:
- **Off-topic handling & Toxic Query Blocking**: Pre-filters input queries before they even hit the LLM.
- **Retrieval Confidence**: The system safely abstains ("I don't have enough information...") if the FAISS retrieval confidence falls below 0.2, preventing the LLM from guessing.
- **Hallucination Prevention (Hybrid Grounding)**: Uses a fallback lexical check (verifying hard nouns/numbers) combined with a strict semantic cosine-similarity check (threshold 0.80) to guarantee the generated answer is fully supported by the retrieved context.

## Latency
We have deeply instrumented the pipeline to measure performance at every stage. 

| Component | P50 | P70 | P100 |
| --------- | --------: | --------: | ---------: |
| **RAG Total** | 223.66 ms | 229.64 ms |  331.50 ms |
| **Voice E2E** | 367.77 ms | 462.35 ms | 1174.32 ms |

*(Note: These are fully verified values from our 20-query automated benchmark suite).*

### Limitations
Under the current architecture using external Sarvam STT and Groq LLM APIs, the measured Voice E2E latency (and the RAG latency itself) exceeds the highly ambitious 200 ms target. External API and network response variability contributes heavily to tail latency (P100). Caching can reduce latency for repeated queries by bypassing the LLM on cache hits.

## Grounding Evaluation
On our 33-case grounding evaluation set (which tests paraphrases, entity mismatches, and numerical hallucinations), the system achieved:
```text
Test cases: 33
Precision: 100.00%
Recall: 92.86%
False Positive Rate: 0.00%
False Negative Rate: 7.14%
```
This evaluation represents the system's ability to successfully identify and block factually incorrect LLM generations without accidentally blocking valid, correctly paraphrased answers.

## Setup & Running Locally

### 1. Environment Variables
Create a `.env` file in the root directory using the provided template:
```bash
cp .env.example .env
```
Ensure you add your `GROQ_API_KEY` and `SARVAM_API_KEY`.

### 2. Backend & Frontend
Install dependencies and run the server:
```bash
npm install
npm start
```
The UI will be accessible at `http://localhost:3000`.

### 3. Building the Index
To rebuild the FAISS vector index from the dataset:
```bash
node ingest.js
```

### 4. Evaluation & Testing
To run the complete evaluation suite (Retrieval, Grounding, and Latency P50/P70/P100):
```bash
node scripts/run_all_evals.js
```
