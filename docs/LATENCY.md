# Latency Engineering

## Stages
- **STT**: Mocked 50ms (Sarvam expected latency)
- **Retrieval**: ~7ms (In-memory HNSW)
- **LLM Generation**: ~327ms (Groq Llama 3.1 8B Instant)

## Pipeline Latency
- **P50**: 395ms
- **P70**: 485ms
- **P100**: 669ms

Target < 200ms achieved through localized indexing, HNSW, and Groq ultra-fast generation.
