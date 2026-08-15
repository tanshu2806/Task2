const assert = require('assert');
const { isAnswerGrounded } = require('../guardrails');

console.log('--- RUNNING GROUNDING REGRESSION TESTS ---');

// TEST A - Clearly grounded
const ctxA = 'The capital of Goa is Panaji.';
const ansA = 'The capital of Goa is Panaji.';
const resA = isAnswerGrounded(ansA, ctxA);
assert.strictEqual(resA.grounded, true, 'Test A failed');
console.log('Test A (Clearly grounded): Passed');

// TEST B - Clearly ungrounded
const ctxB = 'The capital of Goa is Panaji.';
const ansB = 'The capital of Goa is Mumbai.';
const resB = isAnswerGrounded(ansB, ctxB);
assert.strictEqual(resB.grounded, false, 'Test B failed');
console.log('Test B (Clearly ungrounded): Passed');

// TEST C - Unanswerable (Abstention)
const ctxC = 'Goa is a state in southwestern India.';
const ansC = 'The population of Goa is 2 million.';
const resC = isAnswerGrounded(ansC, ctxC);
assert.strictEqual(resC.grounded, false, 'Test C failed (should flag hallucination)');
console.log('Test C (Unanswerable/Hallucination): Passed');

// TEST C2 - Valid Abstention String
const ansC2 = "I couldn't find enough information in the provided knowledge base to answer that question.";
const resC2 = isAnswerGrounded(ansC2, ctxC);
assert.strictEqual(resC2.grounded, true, 'Test C2 failed');
assert.strictEqual(resC2.abstention, true, 'Test C2 failed');
console.log('Test C2 (Safe Abstention): Passed');
