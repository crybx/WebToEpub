#!/usr/bin/env node

/**
 * Tests for RoyalRoadParser - one of the most popular parser implementations
 * Tests specific parsing logic for royalroad.com
 */

require('./node-setup');
require('./test-framework');

// Load required modules
const fs = require('fs');
const path = require('path');

// Load dependencies
const utilPath = path.join(__dirname, '../plugin/js/Util.js');
const utilCode = fs.readFileSync(utilPath, 'utf8');
eval(utilCode.replace('const util =', 'global.util ='));

const sanitizePath = path.join(__dirname, '../plugin/js/Sanitize.js');
eval(fs.readFileSync(sanitizePath, 'utf8'));

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
eval(fs.readFileSync(parserPath, 'utf8'));

// Load RoyalRoadParser
const royalRoadPath = path.join(__dirname, '../plugin/js/parsers/RoyalRoadParser.js');
eval(fs.readFileSync(royalRoadPath, 'utf8'));

testModule("RoyalRoadParser - Content Extraction");

test("extracts chapter content correctly", function(assert) {
    const parser = new RoyalRoadParser();
    const dom = TestUtils.makeDomWithBody(`
        <div class="chapter-inner chapter-content">
            <h1>Chapter 1: The Beginning</h1>
            <p>This is the first paragraph of the story.</p>
            <p>This is the second paragraph with <em>emphasis</em>.</p>
            <div class="author-note">Author's Note: Thanks for reading!</div>
        </div>
    `);
    
    const content = parser.findContent(dom);
    assert.ok(content, "Should find chapter content");
    assert.equal(content.className, "chapter-inner chapter-content", "Should find correct content div");
    assert.ok(content.querySelector('h1'), "Should include chapter heading");
    assert.equal(content.querySelectorAll('p').length, 2, "Should include all paragraphs");
});

test("extracts story metadata", function(assert) {
    const parser = new RoyalRoadParser();
    const dom = TestUtils.makeDomWithBody(`
        <html>
            <head>
                <meta property="books:author" content="TestAuthor">
                <title>Epic Fantasy Story | Royal Road</title>
            </head>
            <body>
                <div class="fic-header">
                    <h1 property="name">Epic Fantasy Story</h1>
                </div>
            </body>
        </html>
    `);
    
    const title = parser.extractTitle(dom);
    const author = parser.extractAuthor(dom);
    
    assert.equal(title, "Epic Fantasy Story", "Should extract story title");
    assert.equal(author, "TestAuthor", "Should extract author from meta tag");
});

test("handles missing metadata gracefully", function(assert) {
    const parser = new RoyalRoadParser();
    const dom = TestUtils.makeDomWithBody(`
        <html>
            <head>
                <title>Royal Road</title>
            </head>
            <body>
                <div>No metadata here</div>
            </body>
        </html>
    `);
    
    const title = parser.extractTitle(dom);
    const author = parser.extractAuthor(dom);
    
    assert.ok(title === null || title === "", "Should handle missing title");
    assert.ok(author === null || author === "", "Should handle missing author");
});

testModule("RoyalRoadParser - Chapter List Extraction");

test("extracts chapter URLs from fiction page", function(assert) {
    const parser = new RoyalRoadParser();
    const dom = TestUtils.makeDomWithBody(`
        <div id="chapters">
            <tbody>
                <tr>
                    <td><a href="/fiction/12345/story/chapter/67890/chapter-1-beginning">Chapter 1: Beginning</a></td>
                    <td><time datetime="2023-01-01">Jan 1, 2023</time></td>
                </tr>
                <tr>
                    <td><a href="/fiction/12345/story/chapter/67891/chapter-2-journey">Chapter 2: Journey</a></td>
                    <td><time datetime="2023-01-02">Jan 2, 2023</time></td>
                </tr>
            </tbody>
        </div>
    `);
    
    const chapterUrls = parser.findChapterUrls(dom);
    
    assert.equal(chapterUrls.length, 2, "Should find 2 chapters");
    assert.equal(chapterUrls[0].sourceUrl, "/fiction/12345/story/chapter/67890/chapter-1-beginning", "First chapter URL correct");
    assert.equal(chapterUrls[0].title, "Chapter 1: Beginning", "First chapter title correct");
    assert.equal(chapterUrls[1].sourceUrl, "/fiction/12345/story/chapter/67891/chapter-2-journey", "Second chapter URL correct");
});

test("handles empty chapter list", function(assert) {
    const parser = new RoyalRoadParser();
    const dom = TestUtils.makeDomWithBody(`
        <div id="chapters">
            <tbody>
                <!-- No chapters yet -->
            </tbody>
        </div>
    `);
    
    const chapterUrls = parser.findChapterUrls(dom);
    assert.equal(chapterUrls.length, 0, "Should return empty array for no chapters");
});

testModule("RoyalRoadParser - Special Elements");

test("removes donation buttons and ads", function(assert) {
    const parser = new RoyalRoadParser();
    const dom = TestUtils.makeDomWithBody(`
        <div class="chapter-inner chapter-content">
            <h1>Chapter Title</h1>
            <div class="portlet donate">
                <button>Donate to Author</button>
            </div>
            <p>Story content here.</p>
            <div class="ad-container">
                <ins>Advertisement</ins>
            </div>
            <p>More story content.</p>
        </div>
    `);
    
    const content = parser.findContent(dom);
    parser.removeUnusedElementsToReduceFileSize(content);
    
    assert.equal(content.querySelectorAll('.donate').length, 0, "Should remove donation elements");
    assert.equal(content.querySelectorAll('.ad-container').length, 0, "Should remove ad containers");
    assert.equal(content.querySelectorAll('p').length, 2, "Should keep story paragraphs");
});

test("handles author notes and warnings", function(assert) {
    const parser = new RoyalRoadParser();
    const dom = TestUtils.makeDomWithBody(`
        <div class="chapter-inner chapter-content">
            <div class="author-note-portlet">
                <h4>Author's Note:</h4>
                <p>Thanks for reading! This chapter was hard to write.</p>
            </div>
            <h1>Chapter 5</h1>
            <p>The actual story begins here...</p>
            <div class="spoiler-wrapper">
                <button class="spoiler-button">Show Spoiler</button>
                <div class="spoiler-content">
                    <p>Hidden content that might spoil things.</p>
                </div>
            </div>
        </div>
    `);
    
    const content = parser.findContent(dom);
    
    assert.ok(content.querySelector('.author-note-portlet'), "Should preserve author notes");
    assert.ok(content.querySelector('.spoiler-wrapper'), "Should preserve spoiler sections");
    assert.ok(content.querySelector('h1'), "Should preserve chapter heading");
});

testModule("RoyalRoadParser - Edge Cases");

test("handles chapters with images", function(assert) {
    const parser = new RoyalRoadParser();
    const dom = TestUtils.makeDomWithBody(`
        <div class="chapter-inner chapter-content">
            <h1>Chapter with Images</h1>
            <p>Here's a map of the world:</p>
            <img src="https://royalroad.com/content/map.jpg" alt="World Map">
            <p>And here's the character:</p>
            <img src="/content/character.png" alt="Main Character">
        </div>
    `);
    
    const content = parser.findContent(dom);
    const images = content.querySelectorAll('img');
    
    assert.equal(images.length, 2, "Should preserve all images");
    assert.ok(images[0].src.includes('map.jpg'), "Should preserve absolute image URLs");
    assert.ok(images[1].src.includes('character.png'), "Should preserve relative image URLs");
});

test("handles tables and formatted content", function(assert) {
    const parser = new RoyalRoadParser();
    const dom = TestUtils.makeDomWithBody(`
        <div class="chapter-inner chapter-content">
            <h1>Status Window</h1>
            <table class="status-table">
                <tr><td>Level</td><td>15</td></tr>
                <tr><td>HP</td><td>250/250</td></tr>
                <tr><td>MP</td><td>100/100</td></tr>
            </table>
            <pre class="skill-description">
[Fireball] - Level 3
Deals fire damage to target
MP Cost: 25
            </pre>
        </div>
    `);
    
    const content = parser.findContent(dom);
    
    assert.ok(content.querySelector('table'), "Should preserve tables");
    assert.equal(content.querySelectorAll('tr').length, 3, "Should preserve all table rows");
    assert.ok(content.querySelector('pre'), "Should preserve preformatted text");
    assert.ok(content.querySelector('pre').textContent.includes('[Fireball]'), "Should preserve skill descriptions");
});

test("cleans up unnecessary whitespace", function(assert) {
    const parser = new RoyalRoadParser();
    const dom = TestUtils.makeDomWithBody(`
        <div class="chapter-inner chapter-content">
            <h1>Chapter Title</h1>
            <p>First paragraph</p>
            
            
            
            <p>Second paragraph after many blank lines</p>
            <div>   </div>
            <div>
                
            </div>
            <p>Third paragraph</p>
        </div>
    `);
    
    const content = parser.findContent(dom);
    parser.removeUnusedElementsToReduceFileSize(content);
    
    // RoyalRoadParser should clean up excessive whitespace
    const paragraphs = content.querySelectorAll('p');
    assert.equal(paragraphs.length, 3, "Should preserve all paragraphs");
    
    // Check that empty divs might be removed (depending on implementation)
    const divs = content.querySelectorAll('div');
    assert.ok(divs.length <= 1, "Should remove or minimize empty divs");
});

// Run tests if this file is executed directly
if (require.main === module) {
    (async () => {
        console.log('Running RoyalRoadParser tests...\n');
        
        const success = await global.TestRunner.run();
        
        if (success) {
            console.log('\n🎉 All RoyalRoadParser tests passed!');
            console.log('✅ Content extraction working correctly');
            console.log('✅ Metadata parsing validated');
            console.log('✅ Special elements handled properly');
            console.log('✅ Edge cases covered');
        } else {
            console.log('\n❌ RoyalRoadParser tests failed!');
        }
        
        process.exit(success ? 0 : 1);
    })().catch(error => {
        console.error('Test execution failed:', error);
        process.exit(1);
    });
}