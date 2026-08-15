const assert = require('assert');
const { isQuerySafe, normalizeQuery, isAnswerGrounded } = require('../guardrails');

console.log('Running Tests...');

// 1. Guardrails
assert.strictEqual(isQuerySafe('tell me about goa').safe, true);
assert.strictEqual(isQuerySafe('you are stupid').safe, false);

assert.strictEqual(normalizeQuery('  hello   world  '), 'hello world');

assert.strictEqual(isAnswerGrounded('Goa is beautiful', 'Goa is a beautiful state.').grounded, true);
assert.strictEqual(isAnswerGrounded('Mars is red', 'Goa is a beautiful state.').grounded, false);

console.log('All guardrails tests passed.');
