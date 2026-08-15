# System Architecture

This document describes the high-level data flow and architecture of the Voice-Enabled RAG System.

## High-Level Data Flow

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend (UI)
    participant B as FastAPI/Express Backend
    participant S as Sarvam STT API
    participant O as RAG Orchestrator
    participant M as MiniLM (ONNX)
    participant V as FAISS (HNSW)
    participant G as Groq (Llama 3)
    participant C as Guardrails/Grounding

    U->>F: Speak question (Microphone)
    F->>B: POST /api/ask (Audio File)
    
    rect rgb(200, 220, 240)
        note right of B: Voice E2E Timing Starts
        B->>S: Upload audio payload
        S-->>B: Return Transcript
    end

    B->>O: Pass Transcript
    
    rect rgb(220, 240, 200)
        note right of O: RAG Pipeline Timing Starts
        O->>C: Check Off-topic/Toxicity
        
        O->>M: Embed Query text
        M-->>O: Query Vector
        
        O->>V: Search KNN (top_k=3)
        V-->>O: Retrieved Documents & Confidence
        
        O->>G: Generate Answer (Prompt + Context)
        G-->>O: LLM Answer
        
        O->>C: Run Hybrid Grounding (Lexical + Semantic)
        C->>M: Embed Answer + Context
        M-->>C: Vectors for Cosine Sim
        C-->>O: Grounding Status
        note right of O: RAG Pipeline Timing Ends
    end
    
    O-->>B: Final JSON Result
    note right of B: Voice E2E Timing Ends
    
    B-->>F: Display Answer, Sources, Latency
    F-->>U: Read Answer & View UI
```

## Latency Instrumentation Points

Latency is measured using high-resolution monotonic timers (`performance.now()`) to track exact segment durations without network fluctuation skew:

1. **Voice E2E Latency**: Tracks the full duration starting from the moment the backend receives the uploaded file, until the final JSON is dispatched to the frontend. This includes all STT network handshakes.
2. **RAG Pipeline Latency**: Tracks the isolated time spent processing text, retrieving, generating, and grounding. It completely excludes the initial STT network round-trip.
3. **Micro-Timers**: Track exact internal segments:
   - `query_processing`
   - `embedding`
   - `vector_retrieval`
   - `context_construction`
   - `llm_generation`
   - `grounding`
   - `other` (event loop overhead)
