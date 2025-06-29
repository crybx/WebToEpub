#!/usr/bin/env node

/**
 * Comprehensive test runner for CI
 * Runs all Node.js tests to validate WebToEpub functionality
 */

const { spawn } = require('child_process');
const path = require('path');

async function runTest(testFile) {
    return new Promise((resolve) => {
        console.log(`\n${'='.repeat(80)}`);
        console.log(`Running: ${testFile}`);
        console.log('='.repeat(80));
        
        const testPath = path.join(__dirname, testFile);
        let output = '';
        
        const child = spawn('node', [testPath], {
            stdio: ['inherit', 'pipe', 'inherit']
        });
        
        // Capture stdout to extract test counts
        child.stdout.on('data', (data) => {
            const chunk = data.toString();
            output += chunk;
            process.stdout.write(chunk); // Still display output in real-time
        });
        
        child.on('close', (code) => {
            // Extract test counts from output
            const totalMatch = output.match(/Total: (\d+)/);
            const passedMatch = output.match(/Passed: (\d+)/);
            const failedMatch = output.match(/Failed: (\d+)/);
            
            const counts = {
                total: totalMatch ? parseInt(totalMatch[1]) : 0,
                passed: passedMatch ? parseInt(passedMatch[1]) : 0,
                failed: failedMatch ? parseInt(failedMatch[1]) : 0
            };
            
            resolve({ success: code === 0, counts });
        });
        
        child.on('error', (error) => {
            console.error(`Failed to start test ${testFile}:`, error);
            resolve({ success: false, counts: { total: 0, passed: 0, failed: 1 } });
        });
    });
}

async function main() {
    console.log('WebToEpub CI Test Suite');
    console.log('='.repeat(80));
    console.log('This test suite validates:');
    console.log('• Core utility functions');
    console.log('• EPUB structure preferences (OEBPS/EPUB)');
    console.log('• Path generation logic');
    console.log('• Chapter inclusion logic for library mode');
    console.log('• EPUB modification and chapter reordering');
    console.log('• Regression prevention for structure changes');
    console.log('• Test framework compatibility');
    
    const tests = [
        'simple.test.js',
        'util.test.js',
        'epub-structure.test.js',
        'chapter-inclusion.test.js',
        'epub-updater.test.js'
    ];
    
    let allPassed = true;
    const results = [];
    let totalCounts = { total: 0, passed: 0, failed: 0 };
    
    for (const test of tests) {
        const result = await runTest(test);
        results.push({ test, passed: result.success, counts: result.counts });
        allPassed = allPassed && result.success;
        
        // Aggregate counts
        totalCounts.total += result.counts.total;
        totalCounts.passed += result.counts.passed;
        totalCounts.failed += result.counts.failed;
    }

    // Summary
    console.log(`\n${'='.repeat(80)}`);
    console.log('FINAL SUMMARY');
    console.log('='.repeat(80));

    for (const result of results) {
        const status = result.passed ? '✅ PASSED' : '❌ FAILED';
        console.log(`${status} - ${result.test}`);
    }

    console.log('='.repeat(80));
    console.log(`📊: TEST TOTALS: ${totalCounts.total} tests, ${totalCounts.passed} passed, ${totalCounts.failed} failed`);

    // Use actual failed count instead of exit codes - a test suite can "pass" but still have failing individual tests
    const hasFailures = totalCounts.failed > 0;
    
    if (hasFailures) {
        console.log('❌: SOME TESTS FAILED! Please review the failed tests above.');
    } else {
        console.log('🎉: ALL TESTS PASSED!');
    }

    console.log('='.repeat(80));
    process.exit(hasFailures ? 1 : 0);
}

main().catch(error => {
    console.error('Test runner failed:', error);
    process.exit(1);
});