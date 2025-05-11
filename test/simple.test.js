#!/usr/bin/env node

/**
 * Core functionality tests for WebToEpub
 * Tests fundamental operations that the extension relies on
 */

require('./node-setup');
require('./test-framework');

// Load core modules for testing
const fs = require('fs');
const path = require('path');

testModule("Browser Environment Setup");

test("DOM manipulation works correctly", function (assert) {
    const dom = TestUtils.makeDomWithBody('<div id="test">Hello</div>');
    const element = dom.querySelector('#test');
    
    assert.ok(element, "Element should exist");
    assert.equal(element.textContent, "Hello", "Element should contain 'Hello'");
    
    element.textContent = "Modified";
    assert.equal(element.textContent, "Modified", "Element text should be modified");
});

test("localStorage mock functions properly", function (assert) {
    localStorage.clear();
    
    localStorage.setItem("test", "value");
    assert.equal(localStorage.getItem("test"), "value", "localStorage should store and retrieve values");
    
    localStorage.removeItem("test");
    assert.equal(localStorage.getItem("test"), null, "Removed item should return null");
    
    // Test multiple items
    localStorage.setItem("key1", "value1");
    localStorage.setItem("key2", "value2");
    assert.equal(localStorage.length, 2, "Should count multiple items");
    
    localStorage.clear();
    assert.equal(localStorage.length, 0, "Clear should remove all items");
});

test("chrome API mocks work correctly", function (assert) {
    // Test storage.local.get
    chrome.storage.local.set({testKey: "testValue"}, () => {
        chrome.storage.local.get("testKey", (result) => {
            assert.equal(result.testKey, "testValue", "Chrome storage should work");
        });
    });
    
    // Test i18n
    const message = chrome.i18n.getMessage("test_key");
    assert.equal(message, "test_key", "i18n should return key as mock");
});

testModule("HTML Processing Fundamentals");

test("DOM query operations", function (assert) {
    const dom = TestUtils.makeDomWithBody(`
        <div class="content">
            <h1>Title</h1>
            <p class="paragraph">First paragraph</p>
            <p class="paragraph">Second paragraph</p>
            <div class="sidebar">Sidebar content</div>
        </div>
    `);
    
    const content = dom.querySelector('.content');
    assert.ok(content, "Should find content div");
    
    const paragraphs = dom.querySelectorAll('.paragraph');
    assert.equal(paragraphs.length, 2, "Should find both paragraphs");
    
    const title = dom.querySelector('h1');
    assert.equal(title.textContent, "Title", "Should extract title text");
});

test("element creation and manipulation", function (assert) {
    const dom = TestUtils.makeDomWithBody('');
    
    // Create new elements
    const div = dom.createElement('div');
    div.className = 'test-div';
    div.textContent = 'Test content';
    
    const span = dom.createElement('span');
    span.setAttribute('data-test', 'value');
    span.innerHTML = '<em>Emphasis</em>';
    
    div.appendChild(span);
    dom.body.appendChild(div);
    
    assert.equal(dom.body.children.length, 1, "Should have one child");
    assert.equal(dom.querySelector('.test-div').textContent, 'Test contentEmphasis', "Should combine text content");
    assert.equal(dom.querySelector('[data-test]').getAttribute('data-test'), 'value', "Should preserve attributes");
});

testModule("String and URL Processing");

test("URL parsing and manipulation", function (assert) {
    const testUrl = "https://example.com/path/to/resource?param=value#section";
    const url = new URL(testUrl);
    
    assert.equal(url.hostname, "example.com", "Should extract hostname");
    assert.equal(url.pathname, "/path/to/resource", "Should extract pathname");
    assert.equal(url.search, "?param=value", "Should extract search parameters");
    assert.equal(url.hash, "#section", "Should extract hash");
});

test("string cleaning operations", function (assert) {
    const input = "  Title with   spaces\n\nand\r\nlinebreaks  ";
    const cleaned = input.trim().replace(/\s+/g, ' ');
    
    assert.equal(cleaned, "Title with spaces and linebreaks", "Should clean whitespace");
    
    const special = "Title/with\\special:chars?and<more>";
    const sanitized = special.replace(/[/\\:?<>]/g, '');
    
    assert.equal(sanitized, "Titlewithspecialcharsandmore", "Should remove special characters");
});

test("filename generation patterns", function (assert) {
    function makeFileName(index, title, extension) {
        const paddedIndex = String(index).padStart(4, '0');
        const cleanTitle = title.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '_');
        return `${paddedIndex}_${cleanTitle}.${extension}`;
    }
    
    assert.equal(makeFileName(1, "Chapter 1", "html"), "0001_Chapter_1.html", "Should create proper filename");
    assert.equal(makeFileName(123, "Special/Chars", "xhtml"), "0123_Special_Chars.xhtml", "Should handle special characters");
    assert.equal(makeFileName(1, "测试", "html"), "0001_测试.html", "Should preserve Unicode");
});

testModule("Error Handling and Edge Cases");

test("handles null and undefined gracefully", function (assert) {
    const dom = TestUtils.makeDomWithBody('');
    
    // Test null queries
    const missing = dom.querySelector('.nonexistent');
    assert.equal(missing, null, "Should return null for missing elements");
    
    // Test empty collections
    const emptyList = dom.querySelectorAll('.nothing');
    assert.equal(emptyList.length, 0, "Should return empty NodeList");
    
    // Test safe property access
    const safeText = dom.querySelector('.missing')?.textContent || 'default';
    assert.equal(safeText, 'default', "Should provide default for missing element");
});

test("handles malformed HTML", function (assert) {
    const malformedHTML = `
        <p>Unclosed paragraph
        <div>Missing closing div
        <span>Nested <em>emphasis
        <script>alert('test')</script>
        <p>Another paragraph</p>
    `;
    
    const dom = TestUtils.makeDomWithBody(malformedHTML);
    
    // DOM should still be queryable
    const paragraphs = dom.querySelectorAll('p');
    assert.ok(paragraphs.length > 0, "Should find paragraphs in malformed HTML");
    
    const scripts = dom.querySelectorAll('script');
    assert.equal(scripts.length, 1, "Should find script tag");
    
    // Should be able to manipulate
    scripts[0].remove();
    const scriptsAfter = dom.querySelectorAll('script');
    assert.equal(scriptsAfter.length, 0, "Should be able to remove script");
});

test("performance with large content", function (assert) {
    // Create a large DOM structure
    let html = '<div>';
    for (let i = 0; i < 1000; i++) {
        html += `<p id="para${i}" class="content">Paragraph ${i} with some content.</p>`;
    }
    html += '</div>';
    
    const startTime = Date.now();
    const dom = TestUtils.makeDomWithBody(html);
    const elements = dom.querySelectorAll('.content');
    const endTime = Date.now();
    
    assert.equal(elements.length, 1000, "Should find all 1000 elements");
    assert.ok(endTime - startTime < 1000, "Should complete within reasonable time");
});

testModule("Mock Infrastructure Validation");

test("TestUtils.createMockFetchResponse works", function (assert) {
    const response = TestUtils.createMockFetchResponse("<html><body>Test</body></html>", 200);
    
    assert.equal(response.status, 200, "Should set status");
    assert.equal(response.ok, true, "Should be ok for 200");
    assert.equal(typeof response.text, 'function', "Should have text method");
});

test("TestUtils.createMockParser works", function (assert) {
    const parser = TestUtils.createMockParser({
        extractTitle: () => "Custom Title"
    });
    
    assert.equal(typeof parser.getEpubMetaInfo, 'function', "Should have getEpubMetaInfo method");
    assert.equal(parser.extractTitle(), "Custom Title", "Should use custom override");
    assert.equal(parser.extractAuthor(), "Test Author", "Should use default value");
});

test("TestUtils.createMockEpubStructure works", function (assert) {
    const structure = TestUtils.createMockEpubStructure("OEBPS");
    
    assert.ok(structure['mimetype'], "Should have mimetype");
    assert.ok(structure['META-INF/container.xml'], "Should have container.xml");
    assert.ok(structure['OEBPS/content.opf'], "Should have content.opf");
    assert.ok(structure['OEBPS/Text/0001_Chapter1.xhtml'], "Should have chapter file");
    
    const epubStructure = TestUtils.createMockEpubStructure("EPUB");
    assert.ok(epubStructure['EPUB/content.opf'], "Should support EPUB structure");
    assert.ok(epubStructure['EPUB/text/0001_Chapter1.xhtml'], "Should use lowercase text dir");
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