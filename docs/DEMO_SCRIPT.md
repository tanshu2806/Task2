# Live Demo Script

**Duration:** 90–120 seconds  
**Goal:** Show one supported answer, one uncertain query, and the evidence/telemetry the app actually returns.

## Before recording

- Start the app with `npm start` and open `http://localhost:3000`.
- Confirm the configured API keys and retrieval service are available. Do not show a terminal containing secrets.
- Use the text box for a repeatable demo. Use the microphone only when Sarvam STT is configured.
- The indexed knowledge base is the source of truth. Results and latency vary with retrieval, model responses, and network conditions.

## 1. Introduce the project (0:00–0:15)

**Say:** “This is a voice-enabled RAG assistant. It retrieves passages from its indexed knowledge base, asks a language model to answer from those passages, then applies grounding checks.”

**Show:** The app and, briefly, the pipeline diagram in the README.

## 2. Ask a question (0:15–0:45)

**Try:** “What is the capital of Goa?”

**Show:** The transcript or query, retrieved evidence, answer, retrieval score/gate, grounding result, and latency details when those fields are available.

**Say:** “The answer is useful only when the retrieved evidence supports it. These scores and timings are observations for this request, not a guaranteed latency or accuracy target.”

## 3. Probe the knowledge boundary (0:45–1:10)

**Try:** A question clearly outside the indexed collection, such as “What is the recipe for chocolate cake?”

**Show:** The evidence, retrieval gate, and resulting answer. The system may abstain when evidence is insufficient; if it answers, inspect the grounding status instead of presenting the result as automatically correct.

## 4. Explain grounding checks (1:10–1:35)

**Show:** `node tests/pipeline.test.js` for fast offline guardrail checks, or `npm run eval:grounding` for model-backed diagnostic cases. Point out the negation-reversal case: its answer repeats the evidence wording but flips the claim. If it is reported as grounded, treat that as a false positive and a limitation to investigate.

**Say:** “These cases probe specific behaviors and report scores and errors. They are a small diagnostic suite, not a statistically representative accuracy claim.”

## 5. Close (1:35–1:45)

**Say:** “This demo shows retrieval and grounding behavior on a few prompts. Broader quality and latency claims need repeatable evaluations on a documented dataset and environment.”
