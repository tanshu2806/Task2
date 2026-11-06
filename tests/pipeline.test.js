const assert = require('assert');
const { isQuerySafe, normalizeQuery, isAnswerGrounded, ABSTENTION_PREFIX } = require('../guardrails');

function run(name, check) {
    check();
    console.log(`PASS ${name}`);
}

run('accepts a non-empty safe query', () => {
    assert.strictEqual(isQuerySafe('Tell me about Goa').safe, true);
});

run('rejects empty and inappropriate queries', () => {
    assert.strictEqual(isQuerySafe('').safe, false);
    assert.strictEqual(isQuerySafe('you are stupid').safe, false);
});

run('normalizes whitespace', () => {
    assert.strictEqual(normalizeQuery('  hello   world  '), 'hello world');
});

run('accepts a supported answer when its embeddings match', () => {
    const result = isAnswerGrounded(
        'Goa is a beautiful state.',
        'Goa is a beautiful state.',
        [1, 0],
        [{ embedding: [1, 0] }]
    );
    assert.strictEqual(result.grounded, true);
    assert.strictEqual(result.method, 'semantic');
});

run('rejects a conflicting named entity before semantic comparison', () => {
    const result = isAnswerGrounded(
        'The capital of Goa is Mumbai.',
        'The capital of Goa is Panaji.',
        [1, 0],
        [{ embedding: [1, 0] }]
    );
    assert.strictEqual(result.grounded, false);
    assert.strictEqual(result.method, 'lexical_claims_failed');
});

run('rejects an answer without evidence', () => {
    assert.strictEqual(isAnswerGrounded('A claim', '').grounded, false);
});

run('treats the configured abstention as a safe result', () => {
    const result = isAnswerGrounded(ABSTENTION_PREFIX + ' in the knowledge base.', '');
    assert.strictEqual(result.grounded, true);
    assert.strictEqual(result.abstention, true);
});

console.log('All offline guardrail checks passed.');
