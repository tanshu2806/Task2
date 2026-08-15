# Chunking Research

## Experiment
Tested fixed-size, sentence-aware, semantic, and hybrid chunking on a 100-passage subset of MSMARCO-XI.

## Measurements
- **Fixed-Size (20w)**: 140 chunks, Avg words: 14.9, Proc Latency: 0.29ms, Ret Latency: 64.00ms
- **Sentence-Aware**: 100 chunks, Avg words: 20.8, Proc Latency: 0.59ms, Ret Latency: 60.00ms
- **Semantic (mocked)**: 100 chunks, Avg words: 20.8, Proc Latency: 0.61ms, Ret Latency: 60.00ms
- **Hybrid**: 100 chunks, Avg words: 20.8, Proc Latency: 0.68ms, Ret Latency: 60.00ms

## Final Choice
Sentence-Aware chunking or Hybrid is optimal. Fixed-size splits context inappropriately. Hybrid provides the best balance of context preservation and index size.
