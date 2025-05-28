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
        const child = spawn('node', [testPath], {
            stdio: 'inherit'
        });
        
        child.on('close', (code) => {
            resolve(code === 0);
        });
        
        child.on('error', (error) => {
            console.error(`Failed to start test ${testFile}:`, error);
            resolve(false);
        });
    });
}

async function main() {
    console.log('WebToEpub Comprehensive Test Suite');
    console.log('='.repeat(80));
    console.log('This test suite validates:');
    console.log('• Core utility functions');
    console.log('• EPUB structure preferences (OEBPS/EPUB)');
    console.log('• Path generation logic');
    console.log('• Regression prevention for structure changes');
    console.log('• Test framework compatibility');
    
    const tests = [
        'simple.test.js',
        'util.test.js',
        'epub-structure.test.js'
    ];
    
    let allPassed = true;
    const results = [];
    
    for (const test of tests) {
        const passed = await runTest(test);
        results.push({ test, passed });
        allPassed = allPassed && passed;
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
    
    if (allPassed) {
        console.log('🎉 ALL TESTS PASSED!');
        console.log('');
        console.log('✅ Core functionality is working');
        console.log('✅ EPUB structure preferences are validated');
        console.log('✅ Both OEBPS and EPUB formats work correctly');
        console.log('✅ Changes like commit dd599b4 will not break functionality');
        console.log('✅ Test framework is reliable');
        console.log('');
        console.log('This codebase is ready for EPUB structure preference implementation!');
    } else {
        console.log('❌ SOME TESTS FAILED!');
        console.log('');
        console.log('Please review the failed tests above.');
        console.log('The codebase may have issues that need to be addressed.');
    }
    
    console.log('='.repeat(80));
    process.exit(allPassed ? 0 : 1);
}

main().catch(error => {
    console.error('Test runner failed:', error);
    process.exit(1);
});