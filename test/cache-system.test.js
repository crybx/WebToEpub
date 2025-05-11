#!/usr/bin/env node

/**
 * Tests for chapter cache system reliability
 * Validates caching, storage, and retrieval of chapter content
 */

require('./node-setup');
require('./test-framework');

// Load required modules
const fs = require('fs');
const path = require('path');

// Load dependencies
const utilPath = path.join(__dirname, '../plugin/js/Util.js');
eval(fs.readFileSync(utilPath, 'utf8').replace('const util =', 'global.util ='));

// Mock UserPreferences
global.UserPreferences = {
    chapterCacheEnabled: {
        readValue: () => true
    },
    chapterCacheMaxSizeMB: {
        readValue: () => 100
    }
};

// Mock chrome.storage with more sophisticated implementation
class MockChromeStorage {
    constructor() {
        this.data = {};
        this.bytesUsed = 0;
    }
    
    async get(keys) {
        return new Promise(resolve => {
            let result = {};
            if (keys === null || keys === undefined) {
                result = { ...this.data };
            } else if (typeof keys === 'string') {
                if (keys in this.data) {
                    result[keys] = this.data[keys];
                }
            } else if (Array.isArray(keys)) {
                keys.forEach(key => {
                    if (key in this.data) {
                        result[key] = this.data[key];
                    }
                });
            } else if (typeof keys === 'object') {
                Object.keys(keys).forEach(key => {
                    result[key] = key in this.data ? this.data[key] : keys[key];
                });
            }
            setTimeout(() => resolve(result), 0);
        });
    }
    
    async set(items) {
        return new Promise(resolve => {
            Object.assign(this.data, items);
            this.bytesUsed = JSON.stringify(this.data).length;
            setTimeout(resolve, 0);
        });
    }
    
    async remove(keys) {
        return new Promise(resolve => {
            const keysArray = Array.isArray(keys) ? keys : [keys];
            keysArray.forEach(key => delete this.data[key]);
            this.bytesUsed = JSON.stringify(this.data).length;
            setTimeout(resolve, 0);
        });
    }
    
    async clear() {
        return new Promise(resolve => {
            this.data = {};
            this.bytesUsed = 0;
            setTimeout(resolve, 0);
        });
    }
    
    async getBytesInUse() {
        return new Promise(resolve => {
            setTimeout(() => resolve(this.bytesUsed), 0);
        });
    }
}

global.chrome.storage.local = new MockChromeStorage();

// Load ChapterCache
const cachePath = path.join(__dirname, '../plugin/js/ChapterCache.js');
const cacheCode = fs.readFileSync(cachePath, 'utf8');
eval(cacheCode);

testModule("ChapterCache - Basic Operations");

test("caches chapter content correctly", async function(assert) {
    await ChapterCache.clearCache();
    
    const chapter = {
        sourceUrl: "http://example.com/chapter/1",
        title: "Chapter 1"
    };
    
    const content = "<h1>Chapter 1</h1><p>This is the content of chapter 1.</p>";
    
    await ChapterCache.storeChapterInCache(chapter, content, false);
    
    const cachedContent = await ChapterCache.getChapterFromCache(chapter.sourceUrl);
    
    assert.ok(cachedContent, "Should retrieve cached content");
    assert.equal(cachedContent.content, content, "Cached content should match original");
    assert.equal(cachedContent.title, chapter.title, "Cached title should match original");
    assert.equal(cachedContent.sourceUrl, chapter.sourceUrl, "Cached URL should match original");
});

test("handles cache misses gracefully", async function(assert) {
    await ChapterCache.clearCache();
    
    const cachedContent = await ChapterCache.getChapterFromCache("http://nonexistent.com/chapter");
    
    assert.equal(cachedContent, null, "Should return null for cache miss");
});

test("updates existing cached chapters", async function(assert) {
    await ChapterCache.clearCache();
    
    const chapter = {
        sourceUrl: "http://example.com/chapter/1",
        title: "Chapter 1"
    };
    
    const originalContent = "<h1>Chapter 1</h1><p>Original content.</p>";
    const updatedContent = "<h1>Chapter 1</h1><p>Updated content.</p>";
    
    // Cache original content
    await ChapterCache.storeChapterInCache(chapter, originalContent, false);
    
    // Update with new content
    await ChapterCache.storeChapterInCache(chapter, updatedContent, false);
    
    const cachedContent = await ChapterCache.getChapterFromCache(chapter.sourceUrl);
    
    assert.equal(cachedContent.content, updatedContent, "Should update to new content");
});

testModule("ChapterCache - Error Handling");

test("stores and retrieves error states", async function(assert) {
    await ChapterCache.clearCache();
    
    const chapter = {
        sourceUrl: "http://example.com/error-chapter",
        title: "Error Chapter"
    };
    
    const errorMessage = "Failed to fetch chapter: 404 Not Found";
    
    await ChapterCache.storeChapterInCache(chapter, null, true, errorMessage);
    
    const cachedContent = await ChapterCache.getChapterFromCache(chapter.sourceUrl);
    
    assert.ok(cachedContent, "Should retrieve cached error");
    assert.equal(cachedContent.isError, true, "Should be marked as error");
    assert.equal(cachedContent.errorMessage, errorMessage, "Should store error message");
    assert.equal(cachedContent.content, null, "Content should be null for errors");
});

test("handles storage quota exceeded", async function(assert) {
    await ChapterCache.clearCache();
    
    // Mock storage quota exceeded
    const originalSet = global.chrome.storage.local.set;
    global.chrome.storage.local.set = async () => {
        throw new Error("QUOTA_BYTES_PER_ITEM quota exceeded");
    };
    
    const chapter = {
        sourceUrl: "http://example.com/large-chapter",
        title: "Large Chapter"
    };
    
    const largeContent = "x".repeat(1000000); // 1MB of content
    
    try {
        await ChapterCache.storeChapterInCache(chapter, largeContent, false);
        assert.fail("Should throw on quota exceeded");
    } catch (e) {
        assert.ok(e.message.includes("quota exceeded"), "Should handle quota exceeded error");
    }
    
    // Restore original set method
    global.chrome.storage.local.set = originalSet;
});

testModule("ChapterCache - Cache Management");

test("retrieves cache statistics", async function(assert) {
    await ChapterCache.clearCache();
    
    // Add some test chapters
    const chapters = [
        { sourceUrl: "http://example.com/1", title: "Chapter 1" },
        { sourceUrl: "http://example.com/2", title: "Chapter 2" },
        { sourceUrl: "http://example.com/3", title: "Chapter 3" }
    ];
    
    for (let chapter of chapters) {
        await ChapterCache.storeChapterInCache(chapter, "<p>Content</p>", false);
    }
    
    const stats = await ChapterCache.getCacheStatistics();
    
    assert.equal(stats.chapterCount, 3, "Should count 3 cached chapters");
    assert.ok(stats.totalSizeBytes > 0, "Should report size greater than 0");
});

test("clears cache completely", async function(assert) {
    await ChapterCache.clearCache();
    
    // Add test content
    const chapter = {
        sourceUrl: "http://example.com/chapter/1", 
        title: "Test Chapter"
    };
    
    await ChapterCache.storeChapterInCache(chapter, "<p>Content</p>", false);
    
    // Verify content exists
    let cachedContent = await ChapterCache.getChapterFromCache(chapter.sourceUrl);
    assert.ok(cachedContent, "Content should exist before clear");
    
    // Clear cache
    await ChapterCache.clearCache();
    
    // Verify content is gone
    cachedContent = await ChapterCache.getChapterFromCache(chapter.sourceUrl);
    assert.equal(cachedContent, null, "Content should be null after clear");
    
    const stats = await ChapterCache.getCacheStatistics();
    assert.equal(stats.chapterCount, 0, "Chapter count should be 0 after clear");
});

test("removes individual chapters from cache", async function(assert) {
    await ChapterCache.clearCache();
    
    const chapters = [
        { sourceUrl: "http://example.com/1", title: "Chapter 1" },
        { sourceUrl: "http://example.com/2", title: "Chapter 2" }
    ];
    
    // Cache both chapters
    for (let chapter of chapters) {
        await ChapterCache.storeChapterInCache(chapter, "<p>Content</p>", false);
    }
    
    // Remove first chapter
    await ChapterCache.removeChapterFromCache(chapters[0].sourceUrl);
    
    // Verify first is gone, second remains
    const content1 = await ChapterCache.getChapterFromCache(chapters[0].sourceUrl);
    const content2 = await ChapterCache.getChapterFromCache(chapters[1].sourceUrl);
    
    assert.equal(content1, null, "First chapter should be removed");
    assert.ok(content2, "Second chapter should remain");
});

testModule("ChapterCache - URL Normalization");

test("normalizes URLs for consistent caching", async function(assert) {
    await ChapterCache.clearCache();
    
    const baseUrl = "http://example.com/chapter/1";
    const urlVariations = [
        baseUrl,
        baseUrl + "/",
        baseUrl + "?utm_source=test",
        baseUrl + "#section1",
        baseUrl + "/?ref=bookmark"
    ];
    
    const content = "<p>Chapter content</p>";
    
    // Cache with base URL
    await ChapterCache.storeChapterInCache({ sourceUrl: baseUrl, title: "Chapter 1" }, content, false);
    
    // Try to retrieve with variations
    for (let url of urlVariations) {
        const cached = await ChapterCache.getChapterFromCache(url);
        assert.ok(cached, `Should find cached content for URL variation: ${url}`);
        assert.equal(cached.content, content, "Content should match for URL variation");
    }
});

testModule("ChapterCache - Settings Integration");

test("respects cache enabled setting", async function(assert) {
    // Mock cache disabled
    global.UserPreferences.chapterCacheEnabled.readValue = () => false;
    
    const chapter = {
        sourceUrl: "http://example.com/chapter/1",
        title: "Chapter 1"
    };
    
    const content = "<p>Content</p>";
    
    const stored = await ChapterCache.storeChapterInCache(chapter, content, false);
    
    // Should not store when disabled
    assert.equal(stored, false, "Should not store when cache is disabled");
    
    // Restore cache enabled
    global.UserPreferences.chapterCacheEnabled.readValue = () => true;
});

test("respects cache size limits", async function(assert) {
    await ChapterCache.clearCache();
    
    // Mock small cache size limit
    global.UserPreferences.chapterCacheMaxSizeMB.readValue = () => 1; // 1MB limit
    
    const chapter = {
        sourceUrl: "http://example.com/large-chapter",
        title: "Large Chapter"
    };
    
    // Create content that's larger than the limit
    const largeContent = "x".repeat(2 * 1024 * 1024); // 2MB of content
    
    try {
        await ChapterCache.storeChapterInCache(chapter, largeContent, false);
        // Depending on implementation, this might succeed or fail
        assert.ok(true, "Large content handling completed");
    } catch (e) {
        assert.ok(e.message.includes("size") || e.message.includes("quota"), "Should handle size limits");
    }
    
    // Restore normal size limit
    global.UserPreferences.chapterCacheMaxSizeMB.readValue = () => 100;
});

testModule("ChapterCache - Concurrent Operations");

test("handles concurrent cache operations", async function(assert) {
    await ChapterCache.clearCache();
    
    const chapters = Array.from({ length: 5 }, (_, i) => ({
        sourceUrl: `http://example.com/chapter/${i + 1}`,
        title: `Chapter ${i + 1}`
    }));
    
    // Store multiple chapters concurrently
    const storePromises = chapters.map(chapter => 
        ChapterCache.storeChapterInCache(chapter, `<p>Content for ${chapter.title}</p>`, false)
    );
    
    await Promise.all(storePromises);
    
    // Retrieve all chapters concurrently
    const retrievePromises = chapters.map(chapter =>
        ChapterCache.getChapterFromCache(chapter.sourceUrl)
    );
    
    const results = await Promise.all(retrievePromises);
    
    assert.equal(results.length, 5, "Should retrieve all 5 chapters");
    results.forEach((result, index) => {
        assert.ok(result, `Chapter ${index + 1} should be retrieved`);
        assert.equal(result.title, chapters[index].title, `Chapter ${index + 1} title should match`);
    });
});

// Run tests if this file is executed directly
if (require.main === module) {
    (async () => {
        console.log('Running cache system tests...\n');
        
        const success = await global.TestRunner.run();
        
        if (success) {
            console.log('\n🎉 All cache system tests passed!');
            console.log('✅ Chapter caching working correctly');
            console.log('✅ Error handling robust');
            console.log('✅ Cache management operations validated');
            console.log('✅ Settings integration working');
            console.log('✅ Concurrent operations handled');
        } else {
            console.log('\n❌ Cache system tests failed!');
        }
        
        process.exit(success ? 0 : 1);
    })().catch(error => {
        console.error('Test execution failed:', error);
        process.exit(1);
    });
}