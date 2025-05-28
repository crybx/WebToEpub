#!/usr/bin/env node

/**
 * Simple demonstration test to show Node.js testing works
 */

require('./node-setup');
require('./test-framework');

testModule("Simple Tests");

test("basic math", function (assert) {
    assert.equal(2 + 2, 4, "Basic addition should work");
    assert.ok(true, "This should always pass");
    assert.notEqual(1, 2, "1 should not equal 2");
});

test("string operations", function (assert) {
    const str = "Hello World";
    assert.equal(str.length, 11, "String length should be 11");
    assert.ok(str.includes("World"), "String should contain 'World'");
});

test("array operations", function (assert) {
    const arr = [1, 2, 3, 4, 5];
    assert.equal(arr.length, 5, "Array should have 5 elements");
    assert.deepEqual(arr.slice(0, 3), [1, 2, 3], "First 3 elements should be [1, 2, 3]");
});

test("DOM manipulation", function (assert) {
    const dom = TestUtils.makeDomWithBody('<div id="test">Hello</div>');
    const element = dom.querySelector('#test');
    
    assert.ok(element, "Element should exist");
    assert.equal(element.textContent, "Hello", "Element should contain 'Hello'");
    
    element.textContent = "Modified";
    assert.equal(element.textContent, "Modified", "Element text should be modified");
});

test("localStorage mock", function (assert) {
    localStorage.clear();
    
    localStorage.setItem("test", "value");
    assert.equal(localStorage.getItem("test"), "value", "localStorage should store and retrieve values");
    
    localStorage.removeItem("test");
    assert.equal(localStorage.getItem("test"), null, "Removed item should return null");
});

// Run tests if this file is executed directly
if (require.main === module) {
    global.TestRunner.run().then(success => {
        console.log(`\nTests ${success ? 'PASSED' : 'FAILED'}`);
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('Test execution failed:', error);
        process.exit(1);
    });
}