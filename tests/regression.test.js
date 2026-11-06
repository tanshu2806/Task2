const assert = require('assert');
const { isAnswerGrounded, ABSTENTION_PREFIX } = require('../guardrails');

console.log('--- GROUNDING REGRESSION CHECKS ---');

const matchingEmbedding = [1, 0];
const matchingContext = [{ embedding: [1, 0] }];

// Grounded answers need both supported hard claims and semantic evidence.
const supported = isAnswerGrounded(
    'The capital of Goa is Panaji.',
    'The capital of Goa is Panaji.',
    matchingEmbedding,
    matchingContext
);
assert.strictEqual(supported.grounded, true, 'Supported answer should pass');
assert.strictEqual(supported.method, 'semantic');
console.log('Supported answer: passed');

// A conflicting entity must fail even if the supplied semantic score is high.
const conflict = isAnswerGrounded(
    'The capital of Goa is Mumbai.',
    'The capital of Goa is Panaji.',
    matchingEmbedding,
    matchingContext
);
assert.strictEqual(conflict.grounded, false, 'Conflicting entity should fail');
assert.strictEqual(conflict.method, 'lexical_claims_failed');
console.log('Conflicting entity: rejected');

// A claim with no evidence must not be treated as grounded.
const noEvidence = isAnswerGrounded(
    'The population of Goa is 2 million.',
    'Goa is a state in southwestern India.'
);
assert.strictEqual(noEvidence.grounded, false, 'Unsupported claim should fail');
console.log('Unsupported claim: rejected');

// Abstention is a safe outcome, including when no evidence was retrieved.
const abstention = isAnswerGrounded(
    ABSTENTION_PREFIX + ' in the provided knowledge base.',
    ''
);
assert.strictEqual(abstention.grounded, true, 'Abstention should pass');
assert.strictEqual(abstention.abstention, true, 'Abstention should be identified');
console.log('Safe abstention: passed');

console.log('All grounding regression checks passed.');
