const { execSync } = require('child_process');

console.log("=============================================");
console.log("  FINAL EVALUATION SUITE");
console.log("=============================================\n");

try {
    console.log("--- 1. GROUNDING & RETRIEVAL EVALUATION ---\n");
    execSync('node tests/grounding_eval.js', { stdio: 'inherit' });
    
    console.log("\n--- 2. LATENCY & PERFORMANCE BENCHMARK ---\n");
    execSync('node scripts/benchmark_voice_e2e.js', { stdio: 'inherit' });
    
} catch (error) {
    console.error("Evaluation suite failed:", error.message);
    process.exit(1);
}
