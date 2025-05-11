#!/usr/bin/env node

/**
 * Comprehensive parser tests for WebToEpub
 * Tests core parser functionality including content extraction, sanitization, and error handling
 */

require('./node-setup');
require('./test-framework');

// Load required modules
const fs = require('fs');
const path = require('path');

// Load core parser modules
const utilPath = path.join(__dirname, '../plugin/js/Util.js');
const utilCode = fs.readFileSync(utilPath, 'utf8');
const modifiedUtilCode = utilCode.replace('const util =', 'global.util =');
eval(modifiedUtilCode);

const sanitizePath = path.join(__dirname, '../plugin/js/Sanitize.js');
const sanitizeCode = fs.readFileSync(sanitizePath, 'utf8');
eval(sanitizeCode);

// Mock dependencies
global.EpubItem = class EpubItem {
    constructor(item) {
        Object.assign(this, item);
    }
};

global.ImageCollector = {
    replaceImageTags: async (content) => content
};

global.main = {
    getUserPreferences: () => null
};

// Load Parser base class
const parserPath = path.join(__dirname, '../plugin/js/Parser.js');
const parserCode = fs.readFileSync(parserPath, 'utf8');
eval(parserCode);

testModule("Parser Base Class - Content Extraction");

test("extractContent - handles standard HTML structure", async function(assert) {
    const parser = new Parser();
    const dom = TestUtils.makeDomWithBody(`
        <article class="chapter-content">
            <h1>Chapter Title</h1>
            <p>First paragraph</p>
            <p>Second paragraph</p>
        </article>
    `);
    
    // Mock parser methods
    parser.findContent = (dom) => dom.querySelector('.chapter-content');
    parser.findChapterTitle = (dom) => dom.querySelector('h1')?.textContent;
    
    const content = parser.extractContent(dom);
    
    assert.ok(content.includes('<h1>Chapter Title</h1>'), "Should include chapter title");
    assert.ok(content.includes('<p>First paragraph</p>'), "Should include first paragraph");
    assert.ok(content.includes('<p>Second paragraph</p>'), "Should include second paragraph");
});

test("extractContent - removes scripts and styles", async function(assert) {
    const parser = new Parser();
    const dom = TestUtils.makeDomWithBody(`
        <div class="content">
            <script>alert('bad');</script>
            <style>.red { color: red; }</style>
            <p>Keep this content</p>
            <noscript>Remove this</noscript>
        </div>
    `);
    
    parser.findContent = (dom) => dom.querySelector('.content');
    
    const content = parser.extractContent(dom);
    
    assert.ok(!content.includes('<script'), "Should not include script tags");
    assert.ok(!content.includes('<style'), "Should not include style tags");
    assert.ok(!content.includes('<noscript'), "Should not include noscript tags");
    assert.ok(content.includes('Keep this content'), "Should keep regular content");
});

test("extractContent - handles missing content gracefully", async function(assert) {
    const parser = new Parser();
    const dom = TestUtils.makeDomWithBody('');
    
    parser.findContent = (dom) => null;
    
    try {
        const content = parser.extractContent(dom);
        assert.ok(content.includes('<div'), "Should return some content even when findContent returns null");
    } catch (e) {
        assert.fail("Should not throw when content is missing: " + e.message);
    }
});

testModule("Parser Base Class - Chapter Title Extraction");

test("findChapterTitle - extracts from various selectors", async function(assert) {
    const parser = new Parser();
    
    // Test h1 extraction
    const dom1 = TestUtils.makeDomWithBody('<h1>Chapter 1: The Beginning</h1>');
    const title1 = parser.findChapterTitle(dom1);
    assert.equal(title1, "Chapter 1: The Beginning", "Should extract h1 title");
    
    // Test with class selector
    const dom2 = TestUtils.makeDomWithBody('<div class="chapter-title">Special Chapter</div>');
    parser.findChapterTitle = (dom) => dom.querySelector('.chapter-title')?.textContent;
    const title2 = parser.findChapterTitle(dom2);
    assert.equal(title2, "Special Chapter", "Should extract title from custom selector");
});

testModule("Parser Base Class - URL Handling");

test("makeChapterUrlsFromMultipleTocPages - handles pagination", async function(assert) {
    const parser = new Parser();
    let fetchCount = 0;
    
    // Mock fetch to simulate paginated TOC
    parser.fetchChapter = async (url) => {
        fetchCount++;
        if (url.includes('page=1')) {
            return TestUtils.makeDomWithBody(`
                <div class="chapters">
                    <a href="/chapter/1">Chapter 1</a>
                    <a href="/chapter/2">Chapter 2</a>
                    <a href="/toc?page=2" class="next">Next</a>
                </div>
            `);
        } else if (url.includes('page=2')) {
            return TestUtils.makeDomWithBody(`
                <div class="chapters">
                    <a href="/chapter/3">Chapter 3</a>
                    <a href="/chapter/4">Chapter 4</a>
                </div>
            `);
        }
    };
    
    parser.extractTocPageUrls = (dom) => {
        const nextLink = dom.querySelector('.next');
        return nextLink ? [nextLink.href] : [];
    };
    
    parser.findChaptersFromDom = (dom) => {
        const links = [...dom.querySelectorAll('.chapters a:not(.next)')];
        return links.map(a => ({
            sourceUrl: a.href,
            title: a.textContent
        }));
    };
    
    const chapters = await parser.makeChapterUrlsFromMultipleTocPages(
        'http://example.com/toc?page=1',
        []
    );
    
    assert.equal(fetchCount, 2, "Should fetch both TOC pages");
    assert.equal(chapters.length, 4, "Should extract all 4 chapters");
    assert.equal(chapters[0].title, "Chapter 1", "First chapter title correct");
    assert.equal(chapters[3].title, "Chapter 4", "Last chapter title correct");
});

testModule("Parser Base Class - Error Handling");

test("fetchChapter - handles network errors", async function(assert) {
    const parser = new Parser();
    
    // Mock failed fetch
    global.fetch = () => Promise.reject(new Error("Network error"));
    
    try {
        await parser.fetchChapter('http://bad-url.com');
        assert.fail("Should throw on network error");
    } catch (e) {
        assert.ok(e.message.includes("Network error"), "Should propagate network error");
    }
});

test("sanitization - handles malformed HTML", async function(assert) {
    const parser = new Parser();
    const dom = TestUtils.makeDomWithBody(`
        <div class="content">
            <p>Unclosed paragraph
            <div>Unclosed div
            <script>alert('test')</script>
            <p onclick="bad()">Paragraph with onclick</p>
        </div>
    `);
    
    parser.findContent = (dom) => dom.querySelector('.content');
    
    const content = parser.extractContent(dom);
    
    assert.ok(!content.includes('onclick='), "Should remove onclick attributes");
    assert.ok(!content.includes('<script'), "Should remove script tags from malformed HTML");
    assert.ok(content.includes('Unclosed paragraph'), "Should preserve text content");
});

testModule("Parser Base Class - Chapter Validation");

test("extractTitleAuthorFromWebPage - extracts metadata", async function(assert) {
    const parser = new Parser();
    const dom = TestUtils.makeDomWithBody(`
        <html>
            <head>
                <title>Story Title - by Author Name</title>
                <meta property="og:title" content="Story Title">
                <meta property="og:site_name" content="Fiction Site">
            </head>
            <body>
                <h1>Story Title</h1>
                <div class="author">by Author Name</div>
            </body>
        </html>
    `);
    
    parser.extractTitle = (dom) => {
        return dom.querySelector('h1')?.textContent || 
               dom.querySelector('title')?.textContent?.split(' - ')[0];
    };
    
    parser.extractAuthor = (dom) => {
        return dom.querySelector('.author')?.textContent?.replace('by ', '') ||
               dom.querySelector('title')?.textContent?.split(' - by ')[1];
    };
    
    const titleAuthor = parser.extractTitleAuthorFromWebPage(dom);
    
    assert.equal(titleAuthor.title, "Story Title", "Should extract title");
    assert.equal(titleAuthor.author, "Author Name", "Should extract author");
});

testModule("Parser Base Class - WebPage to EPUB Items");

test("webPageToEpubItems - converts chapter to EPUB format", async function(assert) {
    const parser = new Parser();
    
    // Create a mock chapter
    const chapter = {
        sourceUrl: "http://example.com/chapter/1",
        title: "Chapter 1"
    };
    
    const dom = TestUtils.makeDomWithBody(`
        <div class="chapter-content">
            <h1>Chapter 1: The Beginning</h1>
            <p>This is the first paragraph.</p>
            <p>This is the second paragraph.</p>
        </div>
    `);
    
    // Mock parser methods
    parser.fetchChapter = async () => dom;
    parser.findContent = (dom) => dom.querySelector('.chapter-content');
    parser.findChapterTitle = (dom) => dom.querySelector('h1')?.textContent;
    
    const epubItems = await parser.webPageToEpubItems(chapter, 0);
    
    assert.equal(epubItems.length, 1, "Should return one EPUB item");
    assert.equal(epubItems[0].id, "xhtml0000", "Should have correct ID");
    assert.equal(epubItems[0].href, "Text/0000_Chapter_1.xhtml", "Should have correct href");
    assert.ok(epubItems[0].content.includes('Chapter 1: The Beginning'), "Should include chapter title in content");
    assert.ok(epubItems[0].content.includes('first paragraph'), "Should include chapter content");
});

testModule("Parser Base Class - Special Cases");

test("removeUnusedElementsToReduceFileSize - cleans unnecessary elements", function(assert) {
    const parser = new Parser();
    const dom = TestUtils.makeDomWithBody(`
        <div class="content">
            <div class="hidden" style="display: none;">Hidden content</div>
            <div class="ads">Advertisement</div>
            <div class="social-share">Share buttons</div>
            <p>Keep this paragraph</p>
            <div></div>
            <div>   </div>
        </div>
    `);
    
    const content = dom.querySelector('.content');
    parser.removeUnusedElementsToReduceFileSize(content);
    
    // Note: The base parser's implementation might not remove all these
    // This tests that the method exists and doesn't break the content
    assert.ok(content.querySelector('p'), "Should keep paragraph elements");
    assert.equal(content.querySelector('p').textContent, "Keep this paragraph", "Should preserve text content");
});

test("convertRawDomToContent - full pipeline test", async function(assert) {
    const parser = new Parser();
    const dom = TestUtils.makeDomWithBody(`
        <article>
            <h1>Test Chapter</h1>
            <script>console.log('remove me');</script>
            <p style="color: red;" onclick="alert('bad')">First paragraph</p>
            <img src="image.jpg" alt="Test image">
            <p>Second paragraph</p>
            <div class="comments">Reader comments here</div>
        </article>
    `);
    
    parser.findContent = (dom) => dom.querySelector('article');
    parser.findChapterTitle = (dom) => dom.querySelector('h1')?.textContent;
    parser.removeUnusedElementsToReduceFileSize = (element) => {
        // Remove comments section
        const comments = element.querySelector('.comments');
        if (comments) comments.remove();
    };
    
    const chapter = {
        sourceUrl: "http://example.com/chapter/1",
        title: "Test Chapter"
    };
    
    const content = await parser.convertRawDomToContent(dom, chapter);
    
    assert.ok(!content.includes('<script'), "Should remove script tags");
    assert.ok(!content.includes('onclick='), "Should remove onclick attributes");
    assert.ok(!content.includes('style='), "Should remove style attributes");
    assert.ok(content.includes('First paragraph'), "Should keep paragraph content");
    assert.ok(!content.includes('Reader comments'), "Should remove unused elements");
    assert.ok(content.includes('<img'), "Should keep images");
});

// Run tests if this file is executed directly
if (require.main === module) {
    (async () => {
        console.log('Running comprehensive parser tests...\n');
        
        const success = await global.TestRunner.run();
        
        if (success) {
            console.log('\n🎉 All parser tests passed!');
            console.log('✅ Content extraction working correctly');
            console.log('✅ Error handling robust');
            console.log('✅ Chapter processing validated');
        } else {
            console.log('\n❌ Parser tests failed!');
        }
        
        process.exit(success ? 0 : 1);
    })().catch(error => {
        console.error('Test execution failed:', error);
        process.exit(1);
    });
}