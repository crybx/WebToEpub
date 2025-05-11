#!/usr/bin/env node

/**
 * Simple test framework for Node.js testing
 * Provides QUnit-like API for porting existing tests
 */

class TestRunner {
    constructor() {
        this.modules = new Map();
        this.currentModule = null;
        this.totalTests = 0;
        this.passedTests = 0;
        this.failedTests = 0;
        this.failures = [];
    }

    module(name) {
        this.currentModule = {
            name: name,
            tests: []
        };
        this.modules.set(name, this.currentModule);
    }

    test(name, testFunction) {
        if (!this.currentModule) {
            throw new Error('test() called without module()');
        }

        this.currentModule.tests.push({
            name: name,
            fn: testFunction
        });
    }

    async run() {
        console.log('WebToEpub Node.js Test Runner');
        console.log('='.repeat(60));

        for (let [moduleName, module] of this.modules) {
            console.log(`\n📦 ${moduleName}`);
            
            for (let test of module.tests) {
                this.totalTests++;
                
                try {
                    const assert = new TestAssert();
                    await test.fn(assert);
                    
                    if (assert.failures.length === 0) {
                        console.log(`  ✅ ${test.name}`);
                        this.passedTests++;
                    } else {
                        console.log(`  ❌ ${test.name}`);
                        this.failedTests++;
                        this.failures.push({
                            module: moduleName,
                            test: test.name,
                            failures: assert.failures
                        });
                    }
                } catch (error) {
                    console.log(`  ❌ ${test.name} (ERROR)`);
                    this.failedTests++;
                    this.failures.push({
                        module: moduleName,
                        test: test.name,
                        failures: [`Uncaught error: ${error.message}`]
                    });
                }
            }
        }

        this.printSummary();
        return this.failedTests === 0;
    }

    printSummary() {
        console.log('\n' + '='.repeat(60));
        console.log('TEST SUMMARY');
        console.log('='.repeat(60));
        console.log(`Total: ${this.totalTests}`);
        console.log(`Passed: ${this.passedTests}`);
        console.log(`Failed: ${this.failedTests}`);

        if (this.failures.length > 0) {
            console.log('\n' + '='.repeat(60));
            console.log('FAILURES');
            console.log('='.repeat(60));
            
            for (let failure of this.failures) {
                console.log(`\n❌ ${failure.module} → ${failure.test}`);
                for (let msg of failure.failures) {
                    console.log(`   ${msg}`);
                }
            }
        } else {
            console.log('\n✅ All tests passed!');
        }
    }
}

class TestAssert {
    constructor() {
        this.failures = [];
    }

    ok(value, message = 'Expected truthy value') {
        if (!value) {
            this.failures.push(`${message} (got: ${value})`);
        }
    }

    equal(actual, expected, message = 'Values should be equal') {
        if (actual !== expected) {
            this.failures.push(`${message} (expected: ${expected}, actual: ${actual})`);
        }
    }

    notEqual(actual, unexpected, message = 'Values should not be equal') {
        if (actual === unexpected) {
            this.failures.push(`${message} (both values were: ${actual})`);
        }
    }

    deepEqual(actual, expected, message = 'Objects should be deeply equal') {
        if (!this.isDeepEqual(actual, expected)) {
            this.failures.push(`${message} (expected: ${JSON.stringify(expected)}, actual: ${JSON.stringify(actual)})`);
        }
    }

    throws(fn, message = 'Function should throw an error') {
        try {
            fn();
            this.failures.push(`${message} (no error was thrown)`);
        } catch (e) {
            // Expected to throw
        }
    }

    fail(message = 'Test failed') {
        this.failures.push(message);
    }

    true(value, message = 'Expected true') {
        if (value !== true) {
            this.failures.push(`${message} (got: ${value})`);
        }
    }

    false(value, message = 'Expected false') {
        if (value !== false) {
            this.failures.push(`${message} (got: ${value})`);
        }
    }

    isDeepEqual(a, b) {
        if (a === b) return true;
        if (a == null || b == null) return false;
        if (typeof a !== typeof b) return false;
        
        if (typeof a === 'object') {
            const keysA = Object.keys(a);
            const keysB = Object.keys(b);
            
            if (keysA.length !== keysB.length) return false;
            
            for (let key of keysA) {
                if (!keysB.includes(key)) return false;
                if (!this.isDeepEqual(a[key], b[key])) return false;
            }
            
            return true;
        }
        
        return false;
    }
}

// Global test runner instance
const testRunner = new TestRunner();

// Export QUnit-like global functions
global.testModule = (name) => testRunner.module(name);
global.test = (name, fn) => testRunner.test(name, fn);
global.TestRunner = testRunner;

module.exports = { TestRunner, TestAssert };