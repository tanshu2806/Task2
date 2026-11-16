# Latency Measurements

## Current request path

The current application embeds a query with Xenova MiniLM, searches the configured Qdrant collection, groups retrieved passages, may call Groq, and may run answer grounding. Voice requests also call Sarvam speech-to-text. The UI reports per-request timings returned by the server.

Timing depends on model warm-up, hardware, network conditions, and external services. The historical figures in the README are records from earlier runs, not current measurements or latency guarantees.

## Reproduce a measurement

Start the app with the required service credentials and indexed Qdrant collection, then submit text or voice questions in the browser. For the browser's timing breakdown, expand **Technical Details & Latency** after each response.

The existing end-to-end voice benchmark uses a fixed local audio file and external Sarvam, Qdrant, and Groq services. It is not an offline benchmark and can incur service usage:

```sh
node scripts/benchmark_voice_e2e.js
```

Review the script's configured audio path and service setup before running it. Report the sample count, hardware, model warm-up, service configuration, and date alongside any measurements. Do not compare runs unless those conditions are recorded.

## Scope

Latency measurements do not indicate answer quality or grounding correctness. Use the illustrative grounding diagnostic separately, and treat its small synthetic case set as a debugging aid rather than a representative benchmark.
