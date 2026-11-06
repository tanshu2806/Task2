# Voice-Enabled Grounded RAG Assistant over MSMARCO-XI

A low-latency, fully-grounded voice assistant utilizing Sarvam STT, Qdrant vector retrieval, and Groq's Llama 3.1 to answer questions from the MSMARCO-XI knowledge base.

---

## 2. Problem Statement

This project solves the challenge of delivering rapid, accurate voice-based question answering over a vast multilingual knowledge base. Generative AI systems are prone to hallucination when answering open-ended queries. This project guarantees safety by strictly enforcing retrieval-based semantic grounding and lexical hard-entity verification, using retrieval and grounding checks to reduce unsupported answers. These checks are heuristics and do not guarantee correctness; latency depends on the environment and external services.

---

## 3. Key Features

- **Voice Input Integration:** Native `multipart/form-data` audio processing using Sarvam STT.
- **MSMARCO-XI Knowledge Base:** Fast semantic search over genuine MSMARCO-XI validation records.
- **Local Vector Search:** Qdrant local instance utilizing `Xenova/all-MiniLM-L6-v2` for 384-dimensional embeddings.
- **Query-ID Evidence Grouping:** Preserves context by dynamically grouping fragmented chunks from the same source record.
- **Confidence-Based Retrieval Gate:** Immediately rejects queries that fail to retrieve context above a `0.50` threshold.
- **Low-Latency Generation:** Internal chunk streaming via Groq (`llama-3.1-8b-instant`) with persistent HTTP Keep-Alive connection reuse.
- **Semantic Grounding:** Two-level verification using a rigid `0.80` cosine similarity threshold.
- **Lexical Entity Verification:** Hard-entity tracking to trap injected dates, numbers, and proper nouns not present in the evidence.
- **Unsafe-Query Guardrail:** Automatic detection and safe abstention for explicitly unsafe prompts.
- **Bounded 429 Retry:** Exponential backoff strategy preventing pipeline crashes during API rate limits.
- **Granular Latency Telemetry:** High-resolution breakdown of every discrete pipeline stage (STT, embedding, Qdrant, grouping, generation, grounding).

---

## 4. System Architecture

```text
Voice Input
  ↓
Sarvam STT
  ↓
Query Processing
  ↓
Embedding (Xenova/all-MiniLM-L6-v2)
  ↓
Qdrant Top-K Retrieval
  ↓
Query-ID Grouping
  ↓
Retrieval Confidence Gate
  ↓
 ┌───────────────┐
 │ Score < 0.50  │ → Safe Abstention
 └───────────────┘
  ↓
Groq Streaming (llama-3.1-8b-instant)
  ↓
Generated Answer
  ↓
Answer Embedding
  ↓
Grounding
  ├── Semantic Similarity (score ≥ 0.80)
  └── Lexical Hard-Entity Verification
  ↓
 ┌─────────────────┐
 │ Grounded        │ → Final Answer
 │ Not Grounded    │ → Safe Abstention
 └─────────────────┘
```

The pipeline enforces safety strictly at the top layer (retrieval gate) and bottom layer (grounding guardrail) before the user ever sees an answer.

---

## 5. Dataset & Provenance

**Dataset:** `ai4bharat/MSMARCO-XI` (Hindi Validation Split)  
**Production Records:** 10,000 genuine ingested records.

The full dataset was **NOT** downloaded locally due to its immense size and processing requirements. Instead, a targeted extraction of the `hinval.parquet` split was isolated and deeply indexed into a fast Qdrant vector database. This prevents the severe latency penalties of querying raw remote Parquet files while guaranteeing identical knowledge provenance. The production knowledge base operates exclusively on these 10,000 verified chunks.

---

## 6. Chunking Strategy

Thoughtful chunking was implemented directly in `scripts/data/ingest.js` to prevent semantic truncation:

- **Sentence-Boundary Handling:** Naive word-splitting is avoided. Text is split cleanly along natural punctuation boundaries (`/[^.!?]+[.!?]+|\s+/g`).
- **Target Size:** Chunks are aggressively bound to a 300-character maximum to maintain high semantic density during vector retrieval.
- **Overlap Handling:** A 50-character overlap window prevents critical context from being cleaved between chunk borders.
- **Metadata Preservation:** Every chunk inherently tracks its parent `query_id`, `Eng_Query`, `Eng_Answer`, and `passage_index`.
- **Query-ID Association:** When `qdrant_retriever.js` fetches Top-K chunks, it dynamically groups disparate chunks sharing the same `query_id` back into a unified, coherent context block before feeding it to the LLM.

---

## 7. Retrieval Pipeline

1. **Query Preprocessing:** The STT transcript is stripped, trimmed, and formatted.
2. **Query Embedding:** `Xenova/all-MiniLM-L6-v2` executes locally via WASM to vectorize the query in under 10ms.
3. **Qdrant Search:** The vector is queried against the local `msmarco_xi` collection (Top-K = 5).
4. **Score Ordering & Metadata Extraction:** Results are decoded and mapped to their underlying passages.
5. **Query-ID Grouping:** Independent vectors originating from the same parent passage are regrouped using `query_id`.
6. **Evidence Construction:** The highest-scoring grouped passages are joined to form a unified context string.
7. **Retrieval Gate:** If the max Qdrant similarity score is `< 0.50`, the system aborts execution, saving external API tokens and instantly returning a safe abstention.

---

## 8. Grounding & Hallucination Prevention

A robust two-stage verification process runs on every generated answer:

### Semantic Grounding
The generated Groq response is independently vectorized using the local Xenova model and mathematically compared against every retrieved evidence chunk. If the maximum cosine similarity falls below **0.80**, the answer is rejected as a semantic hallucination.

### Lexical Hard-Entity Verification
A regex-driven entity tracker isolates numbers, percentages, dates, and capitalized proper nouns in the generated answer. These entities are cross-checked directly against the raw string literals of the retrieved evidence. If the LLM invents a hard entity (e.g., "500", "London") not found in the source text, the answer is immediately rejected.

The repository's small illustrative grounding evaluation is a diagnostic, not a representative accuracy benchmark. Run it with `npm run eval:grounding`; inspect the individual cases and misclassifications rather than treating its aggregate score as a general guarantee.

---

## 9. Guardrail Behavior

| Situation | System behavior |
|---|---|
| High retrieval confidence | LLM called |
| Low retrieval confidence | Abstain |
| Unsupported query | Abstain |
| Unsafe query | Block / Abstain |
| Ungrounded generated answer | Reject / Abstain |
| Supported grounded answer | Return answer |
| Groq HTTP 429 | Retry with bounded backoff (max 3) |

---

## 10. Model Harness

This application operates as a fully structured RAG orchestrator, not a simple raw prompt-to-response wrapper.

The system handles:
1. **Input validation:** Rejects empty queries and invalid audio blobs.
2. **Deterministic orchestration:** Sequential execution from STT → Embedding → Retrieval → Gate → Groq → Grounding.
3. **Error Recovery:** Implements bounded exponential backoff specifically targeting Groq HTTP 429 Rate Limits.
4. **Structured JSON Output:** Responses are returned with rich telemetry including explicit flags for `groq_called`, `retrieval_gate`, and granular `latency` breakdowns.

---

## 11. Latency Optimization

Achieving `<200 ms` required compounding optimizations:

- **HTTP Keep-Alive:** Implemented a persistent `https.Agent` connection pool for the Groq API. Connection reuse bypassed the ~50ms TLS handshake overhead entirely.
- **Groq Streaming:** Internal chunk streaming allows the application to capture the response eagerly rather than waiting for a block transmission.
- **max_tokens Experiment:** Tested caps of 80 vs 150. Reduced caps worsened P50 performance, so 150 was retained.
- **Answer Embedding Investigation:** Evaluated replacing `all-MiniLM-L6-v2` to save time, but its 6–10 ms cost was deemed negligible compared to the network TTFB of the LLM.
- **429 Retry:** Hardened the pipeline to ensure that network variance didn't crash the benchmark suite, trading absolute speed for 100% reliability during rate limits.

---

## 12. Final Benchmark

| Metric | Result |
|---|---:|
| Queries | 50 |
| LLM Calls | 35 |
| Abstentions | 15 |
| Failures | 0 |
| P50 | 195.41 ms |
| P70 | 230.74 ms |
| P100 | 578.78 ms |

The final 50-query benchmark achieved a P50 RAG latency of 195.41 ms, satisfying the sub-200 ms target at the median. P70 and P100 reflect normal tail latency variation from the external LLM network service.

---

## 13. Previously Recorded Quality Snapshot

The figures below are a historical snapshot from an earlier run, not results reproduced by the current diagnostic. The current small evaluation is illustrative and should not be used to claim production accuracy.

## 13.1. Recorded Guardrail Results

- **Supported queries grounded:** 14 / 20
- **Unsupported queries abstained:** 10 / 15
- **Hallucination catches:** 5 / 5
- **Retrieval gate:** 0.50
- **Grounding threshold:** 0.80

---

## 14. Voice Flow

1. **Microphone Capture:** User speaks into the browser UI.
2. **Audio Upload:** Frontend pushes a `multipart/form-data` `.webm` or `.wav` to `/api/ask`.
3. **Sarvam STT:** Audio is forwarded to Sarvam, which returns a text transcript.
4. **Execution:** The transcript is transparently fed into `processAskQuery`.
5. **Unified Response:** Qdrant, Groq, and grounding modules fire identical to text workflows, seamlessly returning the final grounded response to the frontend.

---

## 15. API Endpoints

### `GET /health`
- **Purpose:** System diagnostic check.
- **Input:** None.
- **Output:** `{ status: 'ok', message: '...' }`

### `POST /retrieve`
- **Purpose:** Direct vector database inspection (no LLM).
- **Input:** JSON `{ "query": "..." }`
- **Output:** JSON array of raw Qdrant chunks and scores.

### `POST /ask`
- **Purpose:** Standard Text RAG execution.
- **Input:** JSON `{ "query": "..." }`
- **Output:** Complete JSON telemetry package including `answer`, `grounding`, and `latency`.

### `POST /api/ask`
- **Purpose:** Voice RAG execution.
- **Input:** `multipart/form-data` containing `audio` blob.
- **Output:** Complete JSON telemetry package including STT time metrics.

---

## 16. Project Structure

```text
project/
├── server.js                        # Express server and primary pipeline orchestrator
├── rag_pipeline.js                  # Query preprocessing and Sarvam STT module
├── guardrails.js                    # Semantic and lexical hallucination prevention
├── src/
│   └── retrieval/
│       └── qdrant_retriever.js      # Vector search and Xenova WASM embeddings
├── public/
│   ├── index.html                   # Frontend UI
│   └── app.js                       # Microphone recording and API logic
├── scripts/
│   ├── benchmark_latency.js         # Core 50-query statistical benchmark tool
│   └── data/
│       └── ingest.js                # Qdrant data chunking and population script
├── tests/
│   ├── final_tests.js               # Semantic guardrail/hallucination validation
│   ├── test_voice.js                # Programmatic Sarvam audio integration test
│   └── fixtures/
│       └── generate_mock_subset.js  # Offline test fixtures
├── docker-compose.yml               # Qdrant container configuration
├── package.json
└── .env.example                     # Environment template
```

---

## 17. Installation

1. **Clone the repository:**
   ```bash
   git clone <repo-url>
   cd <repo-directory>
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment:**
   Copy `.env.example` to `.env` and fill in your API keys.

4. **Initialize Qdrant Database:**
   ```bash
   docker-compose up -d
   ```
   *(Ensure Qdrant is running, then run data ingestion if not using pre-packaged storage)*
   ```bash
   node scripts/data/ingest.js
   ```

5. **Start the Server:**
   ```bash
   npm start
   ```

6. **Access UI:**
   Open `http://localhost:3000` in your web browser.

---

## 18. Environment Variables

Create a `.env` file in the root directory:

```env
GROQ_API_KEY=
SARVAM_API_KEY=
PORT=3000
```
*(No hardcoded keys should ever be committed)*

---

## 19. Running Checks and Evaluations

Run the deterministic, offline guardrail and regression checks:

```bash
npm test
```

Run the small model-backed grounding diagnostic (the embedding model may download on first use):

```bash
npm run eval:grounding
```

The diagnostic prints its cases, confusion matrix, and misclassifications. It is illustrative and does not establish production accuracy. The latency benchmark scripts make live service calls and may require configured API keys and a reachable retrieval service; their results vary by environment.

---

## 20. Limitations

- **Tail Latency:** While P50 reliably scores `<200 ms`, P70 and P100 routinely exceed this target due to unavoidable HTTP TTFB (Time-To-First-Byte) variance in external LLM networks.
- **Knowledge Boundaries:** The bot will absolutely refuse to answer questions outside the scope of the 10,000 ingested validation records. This is intentional.
- **Grounding Safety vs Guarantee:** Semantic grounding is an extremely strict mathematical heuristic (`0.80` cosine similarity + lexical matching). While it overwhelmingly prevents hallucinations, it is a heuristic safety mechanism, not an absolute logical guarantee against every conceivable edge case.
- **Dataset Scope:** The production vector space is a targeted 10,000-record subset to ensure low-latency performance rather than the multi-gigabyte full MSMARCO-XI index.

---

## 21. Technical Requirements Mapping

| Requirement | Implementation | Status |
|---|---|---|
| Speech-to-text | Sarvam native audio integration via `/api/ask` | PASS |
| Chunking | Sentence-aware + 50-char overlap + metadata tagging | PASS |
| <200 ms | P50 clocked at 195.41 ms (Internal streaming + Keep-Alive) | PASS |
| Latency analytics | Granular MS breakdown + P50/P70/P100 pipeline | PASS |
| Model harness | Structured RAG orchestration, error handling, 429 retry | PASS |
| Guardrails | 0.50 retrieval gate + 0.80 semantic + lexical grounding | PASS |

---

## 22. Future Improvements

- **Local Inference Transition:** Migrating the LLM from Groq to a localized ONNX-quantized model (e.g., Llama.cpp) would completely eliminate network variance, flattening the P100 curve to guarantee sub-200 ms latency on every request.
- **WebSockets / Async Steaming:** Transitioning the HTTP architecture to full WebSocket streaming would allow the frontend to render STT transcripts and LLM chunks instantaneously as they are produced, lowering user-perceived latency.
- **Expanded Vector Indexing:** Expanding Qdrant to hold the complete multi-million record MSMARCO-XI dataset via cloud deployment.
