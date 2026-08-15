# PROJECT PLAN

## 1. Task Requirements
Build a Voice-Enabled RAG Model targeting <200ms latency with Sarvam STT and a reliable LLM.

## 2. Architecture
- Frontend: Vanilla HTML/JS with MediaRecorder API.
- Backend: Express.js (Node.js).
- STT: Sarvam API (as primary).
- Embedding: all-MiniLM-L6-v2 (or similar) via ONNX Runtime / Xenova for low-latency dense retrieval.
- Vector DB: hnswlib-node (in-memory loaded) for sub-millisecond similarity search.
- LLM: Groq API (llama-3.1-8b-instant) for low-latency generation.

## 3. Technology Decisions
- Node.js for backend to handle async I/O efficiently.
- Python scripts for dataset inspection and chunking research/benchmarking.
- FAISS/HNSW for index persistence.

## 4. Dataset Pipeline
- Source: ai4bharat/MSMARCO-XI
- Script: `scripts/prepare_dataset.py`

## 5. Chunking Strategies to investigate
- Fixed-size
- Sentence-aware
- Semantic
- Metadata-aware
- Hybrid

## 6. Retrieval Strategy
- Dense retrieval baseline.
- Potential hybrid (lexical + dense) if needed.

## 7. LLM Strategy
- Single direct prompt with strict instructions against hallucination.

## 8. Voice Pipeline
- MediaRecorder -> WAV/WebM -> Backend -> Sarvam API -> text query -> RAG pipeline.

## 9. Guardrails
- Input checks (empty audio, off-topic).
- Retrieval confidence check (distance threshold).
- Grounding check (verify answer against context).

## 10. Latency Strategy
- Async parallelization where possible.
- Precomputed embeddings.
- Groq for ultra-fast generation.
- Target: < 200ms pipeline execution.

## 11. Evaluation Methodology
- Latency P50/P70/P100 measurements.
- Quality/Grounding inspection on subset.

## 12. Deployment
- Provide run scripts and documentation for local startup.

## 13. Milestones
- Phase 0-1: Workspace & Plan
- Phase 2: Dataset inspection
- Phase 3: Baseline RAG setup
- Phase 4: Chunking benchmark
- Phase 5-6: RAG Orchestrator & Guardrails
- Phase 7-8: Voice Integration
- Phase 9-10: Latency Optimization
- Phase 11-15: Evaluation, UI Polish, Final Audit
