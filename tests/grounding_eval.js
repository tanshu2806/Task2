const { isAnswerGrounded, ABSTENTION_PREFIX } = require('../guardrails');

let extractor;

const cases = [
    {
        name: 'Directly supported statement',
        context: 'The capital of Goa is Panaji.',
        answer: 'The capital of Goa is Panaji.',
        expected: true
    },
    {
        name: 'Supported paraphrase',
        context: 'Panaji serves as the capital of the Indian state of Goa.',
        answer: "Panaji is Goa's capital.",
        expected: true
    },
    {
        name: 'Supported number',
        context: 'Goa has 2 districts.',
        answer: 'Goa has 2 districts.',
        expected: true
    },
    {
        name: 'Incorrect place',
        context: 'The capital of Goa is Panaji.',
        answer: 'The capital of Goa is Mumbai.',
        expected: false
    },
    {
        name: 'Invented number',
        context: 'Goa is visited by 5 million tourists.',
        answer: 'Goa is visited by 8 million tourists.',
        expected: false
    },
    {
        name: 'Supported fact with extra claim',
        context: 'The capital of Goa is Panaji.',
        answer: 'The capital of Goa is Panaji, and Mumbai is its largest city.',
        expected: false
    },
    {
        name: 'Unsupported named entity',
        context: 'Goa is a state in western India.',
        answer: 'Goa is a state in western India near London.',
        expected: false
    },
    {
        name: 'No evidence',
        context: '',
        answer: 'The capital of Goa is Panaji.',
        expected: false
    },
    {
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

        if (!passed) failures.push({ name: test.name, expected: test.expected, actual: result.grounded });
        console.log(`${passed ? 'PASS' : 'FAIL'}  ${test.name}: expected ${test.expected}, got ${result.grounded} (${result.method})`);
    }

    const total = tp + fp + tn + fn;
    const precision = tp + fp ? tp / (tp + fp) : 0;
    const recall = tp + fn ? tp / (tp + fn) : 0;
    const specificity = tn + fp ? tn / (tn + fp) : 0;
    const f1 = precision + recall ? 2 * precision * recall / (precision + recall) : 0;

    console.log('\nConfusion matrix (actual rows, predicted columns)');
    console.log('                  grounded  ungrounded');
    console.log(`grounded          ${String(tp).padEnd(10)}${fn}`);
    console.log(`ungrounded        ${String(fp).padEnd(10)}${tn}`);
    console.log(`\nCases: ${total} | Precision: ${(precision * 100).toFixed(1)}% | Recall: ${(recall * 100).toFixed(1)}% | Specificity: ${(specificity * 100).toFixed(1)}% | F1: ${(f1 * 100).toFixed(1)}%`);

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
