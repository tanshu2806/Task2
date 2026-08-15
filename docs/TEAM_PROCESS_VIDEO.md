# Team Process Video Script

**Duration:** 90 Seconds
**Format:** Screen recording with voiceover (team members can take turns speaking).
**Goal:** Show the *process* of how the team built the solution, not just the final product.

## 0:00 - 0:10 | Problem & Objective
**Visuals:** Show the hackathon prompt, the initial architecture whiteboard/sketch, or the team's Trello/planning board.
**Voiceover:** "Our goal was to build a Voice-enabled RAG system capable of answering domain-specific queries from the MSMARCO-XI dataset in under 200 milliseconds, with zero hallucinations."

## 0:10 - 0:30 | Dataset & RAG Architecture Work
**Visuals:** Show the terminal running the `ingest.js` script, the FAISS index files being generated, and the raw MSMARCO-XI JSON data.
**Voiceover:** "We started by deeply analyzing the MSMARCO-XI dataset. We built a custom ingestion script to parse the documents, generate embeddings locally using MiniLM to save network overhead, and store them in a highly optimized HNSW FAISS vector database."

## 0:30 - 0:50 | Chunking & Retrieval Experimentation
**Visuals:** Show the `CHUNKING.md` research document or the `benchmark_chunking.py` script. Briefly show the `run_all_evals.js` terminal output.
**Voiceover:** "We benchmarked multiple chunking strategies—fixed size vs. semantic. We discovered that sentence-aware hybrid chunking provided the best balance of context preservation and retrieval latency."

## 0:50 - 0:70 | Voice/STT + Orchestration + Guardrails
**Visuals:** Split screen: Code editor showing `guardrails.js` on one side, and the Web UI recording a voice query on the other.
**Voiceover:** "For Voice, we integrated Sarvam AI's STT endpoint. The core challenge was safety. We engineered a hybrid lexical and semantic grounding pipeline. It extracts claims and verifies them locally without extra LLM calls, achieving 100% precision against hallucinations."

## 0:70 - 0:85 | Latency Benchmarking & Optimization
**Visuals:** Show the latency breakdown table in the README or the `benchmark_voice_e2e.js` terminal output highlighting the P50 and P100 scores.
**Voiceover:** "Performance was our biggest hurdle. By strictly limiting output tokens, using Groq's Llama 3, and keeping embeddings local, we isolated the RAG latency to ~223ms. However, we proved that external STT network handshakes strictly define the Voice E2E floor."

## 0:85 - 0:90 | Final Team Result
**Visuals:** Show the final UI with a successful grounded answer, and the team members waving or a team photo.
**Voiceover:** "We built a robust, hallucination-free pipeline that pushes the limits of current REST APIs. Thanks for watching!"
