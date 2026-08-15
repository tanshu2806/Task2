const { isAnswerGrounded, ABSTENTION_PREFIX } = require('../guardrails');

function runTest(name, answer, context, expectedGrounded) {
    const result = isAnswerGrounded(answer, context);
    const passed = result.grounded === expectedGrounded;
    console.log(`Test: ${name}`);
    console.log(`  Answer: "${answer}"`);
    console.log(`  Context: "${context}"`);
    console.log(`  Expected: ${expectedGrounded} | Actual: ${result.grounded} | Confidence: ${result.confidence.toFixed(2)}`);
    console.log(`  Result: ${passed ? '✅ PASS' : '❌ FAIL'}\n`);
    if (!passed) {
        process.exitCode = 1;
    }
}

console.log("=== GROUNDING AUTOMATED TESTS ===\n");

// 1. Grounded
runTest(
    "Grounded Match",
    "The capital of Goa is Panaji.",
    "The capital of Goa is Panaji.",
    true
);

// 2. Ungrounded
runTest(
    "Ungrounded Mismatch",
    "The capital of Goa is Mumbai.",
    "The capital of Goa is Panaji.",
    false
);

// 3. Safe Abstention
runTest(
    "Safe Abstention",
    ABSTENTION_PREFIX + " in the provided knowledge base.",
    "", // No context
    true
);
