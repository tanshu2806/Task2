const { isAnswerGrounded, ABSTENTION_PREFIX } = require('../guardrails');
const fs = require('fs');
const path = require('path');

let extractor;

const cases = [
    {
        category: 'supported_answer',
        name: 'Directly supported statement',
        context: 'The capital of Goa is Panaji.',
        answer: 'The capital of Goa is Panaji.',
        expected: true
    },
    {
        category: 'supported_answer',
        name: 'Supported paraphrase',
        context: 'Panaji serves as the capital of the Indian state of Goa.',
        answer: "Panaji is Goa's capital.",
        expected: true
    },
    {
        category: 'supported_answer',
        name: 'Supported number',
        context: 'Goa has 2 districts.',
        answer: 'Goa has 2 districts.',
        expected: true
    },
    {
        category: 'unsupported_claim',
        name: 'Incorrect place',
        context: 'The capital of Goa is Panaji.',
        answer: 'The capital of Goa is Mumbai.',
        expected: false
    },
    {
        category: 'unsupported_claim',
        name: 'Invented number',
        context: 'Goa is visited by 5 million tourists.',
        answer: 'Goa is visited by 8 million tourists.',
        expected: false
    },
    {
        category: 'unsupported_addition',
        name: 'Supported fact with extra claim',
        context: 'The capital of Goa is Panaji.',
        answer: 'The capital of Goa is Panaji, and Mumbai is its largest city.',
        expected: false
    },
    {
        category: 'unsupported_addition',
        name: 'Unsupported named entity',
        context: 'Goa is a state in western India.',
        answer: 'Goa is a state in western India near London.',
        expected: false
    },
    {
        category: 'negation_counterfactual',
        name: 'Negation reversal with shared wording',
        context: 'The treatment did not reduce pain.',
        answer: 'The treatment reduced pain.',
        expected: false
    },
    {
        category: 'no_evidence',
        name: 'No evidence',
        context: '',
        answer: 'The capital of Goa is Panaji.',
        expected: false
    },
    {
        category: 'abstention',
        name: 'Explicit abstention',
        context: 'The capital of Goa is Panaji.',
        answer: ABSTENTION_PREFIX + ' in the knowledge base.',
        expected: true
    }
];

async function getEmbedding(text) {
    if (!extractor) {
        const { pipeline } = await import('@xenova/transformers');
        extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    }
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
}

async function evaluate() {
    let tp = 0;
    let fp = 0;
    let tn = 0;
    let fn = 0;
    const failures = [];
    const caseResults = [];

    console.log('Grounding diagnostic cases (illustrative, not a benchmark)\n');

    for (const test of cases) {
        let answerEmbedding = null;
        let contextEmbeddings = [];

        if (test.context && !test.answer.startsWith(ABSTENTION_PREFIX)) {
            answerEmbedding = await getEmbedding(test.answer);
            contextEmbeddings = [{
                embedding: await getEmbedding(test.context)
            }];
        }

        const result = isAnswerGrounded(
            test.answer,
            test.context,
            answerEmbedding,
            contextEmbeddings
        );
        const passed = result.grounded === test.expected;

        if (test.expected && result.grounded) tp++;
        else if (!test.expected && result.grounded) fp++;
        else if (!test.expected) tn++;
        else fn++;

        const caseResult = {
            name: test.name,
            category: test.category,
            expected: test.expected,
            actual: result.grounded,
            passed,
            method: result.method,
            confidence: Number.isFinite(result.confidence) ? result.confidence : null
        };
        caseResults.push(caseResult);
        if (!passed) failures.push({ name: test.name, expected: test.expected, actual: result.grounded });
        const score = Number.isFinite(result.confidence)
            ? `, score ${result.confidence.toFixed(3)}`
            : '';
        console.log(`${passed ? 'PASS' : 'FAIL'}  ${test.name}: expected ${test.expected}, got ${result.grounded} (${result.method}${score})`);
    }

    const total = tp + fp + tn + fn;
    const accuracy = total ? (tp + tn) / total : 0;
    const byCategory = {};
    for (const result of caseResults) {
        const summary = byCategory[result.category] || { cases: 0, passed: 0, failed: 0, failures: [] };
        summary.cases++;
        if (result.passed) summary.passed++;
        else {
            summary.failed++;
            summary.failures.push(result.name);
        }
        byCategory[result.category] = summary;
    }
    const precision = tp + fp ? tp / (tp + fp) : 0;
    const recall = tp + fn ? tp / (tp + fn) : 0;
    const specificity = tn + fp ? tn / (tn + fp) : 0;
    const f1 = precision + recall ? 2 * precision * recall / (precision + recall) : 0;

    console.log('\nCase results by behavior');
    for (const [category, summary] of Object.entries(byCategory)) {
        console.log(`  ${category}: ${summary.passed}/${summary.cases} passed, ${summary.failed} failed`);
    }

    console.log('\nConfusion matrix (actual rows, predicted columns)');
    console.log('                  grounded  ungrounded');
    console.log(`grounded          ${String(tp).padEnd(10)}${fn}`);
    console.log(`ungrounded        ${String(fp).padEnd(10)}${tn}`);
    console.log(`\nCases: ${total} | Accuracy: ${(accuracy * 100).toFixed(1)}% | Precision: ${(precision * 100).toFixed(1)}% | Recall: ${(recall * 100).toFixed(1)}% | Specificity: ${(specificity * 100).toFixed(1)}% | F1: ${(f1 * 100).toFixed(1)}%`);

    const jsonOutIndex = process.argv.indexOf('--json-out');
    if (jsonOutIndex !== -1) {
        const outputPath = process.argv[jsonOutIndex + 1];
        if (!outputPath || outputPath.startsWith('--')) {
            throw new Error('Usage: npm run eval:grounding -- --json-out <path>');
        }
        const report = {
            evaluation: 'illustrative_grounding_diagnostic',
            note: 'Small synthetic cases; not a representative accuracy benchmark.',
            confusion_matrix: { true_positive: tp, false_positive: fp, true_negative: tn, false_negative: fn },
            metrics: { accuracy, precision, recall, specificity, f1 },
            by_category: byCategory,
            cases: caseResults
        };
        const resolvedPath = path.resolve(outputPath);
        fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
        fs.writeFileSync(resolvedPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
        console.log(`\nDiagnostic JSON saved to ${resolvedPath}`);
    }

    if (failures.length) {
        console.log('\nMisclassified cases:');
        for (const failure of failures) {
            console.log(`- ${failure.name}: expected ${failure.expected}, got ${failure.actual}`);
        }
        process.exitCode = 1;
    }
}

evaluate().catch(error => {
    console.error('Grounding evaluation could not complete:', error.message);
    process.exitCode = 1;
});
