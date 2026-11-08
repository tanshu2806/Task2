# System Architecture

This diagram follows the current Express request path. Qdrant is selected with `QDRANT_URL`; the service may be local Docker or Qdrant Cloud.

## Request and answer flow

```mermaid
sequenceDiagram
    actor U as User
    participant F as Browser UI
    participant B as Express server
    participant S as Sarvam STT
    participant E as Xenova MiniLM
    participant Q as Qdrant
    participant G as Groq
    participant C as Grounding checks

    alt Voice question
        U->>F: Speak
        F->>B: POST /api/ask with audio
        B->>S: Transcribe audio
        S-->>B: Transcript
    else Text question
        U->>F: Type question
        F->>B: POST /ask with query
    end

    B->>E: Embed query
    E-->>B: Query vector
    B->>Q: Search msmarco_xi (top 5)
    Q-->>B: Ranked passages, scores, vectors
    B->>B: Group passages by query_id

    alt Best score below 0.50 or Groq key unavailable
        B->>B: Return fixed abstention
    else Retrieval gate passes
        B->>G: Generate draft using selected evidence
        G-->>B: Draft answer
        B->>E: Embed draft
        E-->>B: Draft vector
        B->>C: Check hard claims and semantic similarity
        alt Grounding check passes
            C-->>B: Accept draft
        else Grounding check fails
            C-->>B: Reject draft
            B->>B: Replace draft with fixed abstention
        end
    end

    B-->>F: Answer, evidence, decisions, timing
    F-->>U: Display result and grounding status
```

The retrieval gate and grounding check are safeguards, not proof of correctness. A rejected draft is replaced before it is returned to the browser. The unsafe-query helper currently in `guardrails.js` is not wired into these request routes.

## Grounding decision

- Retrieval is skipped when the best Qdrant score is below `0.50`.
- Grounding checks a draft only after the LLM is called.
- The lexical check rejects capitalized names and numbers absent from retrieved evidence.
- The semantic check compares the answer embedding with retrieved passage embeddings and accepts a maximum cosine similarity of at least `0.80`.
- If either check rejects the answer, the API returns a fixed abstention and reports the grounding method and result.

These thresholds are configurable in code and have not been validated as universal accuracy thresholds.

## Timing fields

The API reports request timings measured with `performance.now()`:

- Text and voice RAG: `queryProcessingMs`, `embeddingMs`, `retrievalMs`, `groupingMs`, `evidenceMs`, `llmMs`, `answerEmbeddingMs`, `groundingMs`, `groundingLexicalMs`, `groundingSemanticMs`, and `ragTotalMs`.
- Voice requests also report `sttMs` and `voiceTotalMs`.

RAG timing excludes speech transcription. Timings vary with model warm-up, network conditions, and external services; historical benchmark numbers are not latency guarantees.
