#!/usr/bin/env node

/**
 * Tests for chapter inclusion logic
 * 
 * This test suite covers the core logic for determining which chapters
 * should be included by default when downloading/updating EPUBs in library mode.
 * 
 * The logic has had repeated bugs, so these tests ensure it works correctly
 * across all scenarios.
 */

require('./node-setup');
require('./test-framework');

// Load the ChapterInclusionLogic module
const ChapterInclusionLogic = require('../plugin/js/ChapterInclusionLogic');

testModule("Chapter Inclusion Logic - Core Functions");

test("normalizeUrl - handles various URL formats", function (assert) {
    // Basic URLs
    assert.equal(
        ChapterInclusionLogic.normalizeUrl('https://example.com/chapter/1'), 
        'https://example.com/chapter/1',
        "Basic URL should remain unchanged"
    );
    
    // URLs with trailing slashes
    assert.equal(
        ChapterInclusionLogic.normalizeUrl('https://example.com/chapter/1/'), 
        'https://example.com/chapter/1',
        "Trailing slash should be removed"
    );
    
    // URLs with fragments
    assert.equal(
        ChapterInclusionLogic.normalizeUrl('https://example.com/chapter/1#section2'), 
        'https://example.com/chapter/1',
        "Fragment should be removed"
    );
    
    // URLs with both trailing slash and fragment
    assert.equal(
        ChapterInclusionLogic.normalizeUrl('https://example.com/chapter/1/#section2'), 
        'https://example.com/chapter/1',
        "Both trailing slash and fragment should be removed"
    );
    
    // Root path should not remove trailing slash
    assert.equal(
        ChapterInclusionLogic.normalizeUrl('https://example.com/'), 
        'https://example.com/',
        "Root path trailing slash should be preserved"
    );
    
    // Empty or null URLs
    assert.equal(
        ChapterInclusionLogic.normalizeUrl(''), 
        '',
        "Empty string should return empty string"
    );
    
    assert.equal(
        ChapterInclusionLogic.normalizeUrl(null), 
        '',
        "Null should return empty string"
    );
    
    // Invalid URLs should still be processed
    assert.equal(
        ChapterInclusionLogic.normalizeUrl('not-a-url#fragment'), 
        'not-a-url',
        "Invalid URLs should still have fragments removed"
    );
});

test("determineChapterSource - classifies chapters correctly", function (assert) {
    const websiteUrls = new Set([
        'https://example.com/chapter/1',
        'https://example.com/chapter/2',
        'https://example.com/chapter/3'
    ]);
    
    // Library-only: generated content
    assert.equal(
        ChapterInclusionLogic.determineChapterSource(
            { sourceUrl: 'library://info', title: 'Information' }, 
            websiteUrls
        ),
        'library-only',
        "Library URLs should be classified as library-only"
    );
    
    // Library-only: no source URL
    assert.equal(
        ChapterInclusionLogic.determineChapterSource(
            { sourceUrl: null, title: 'Information' }, 
            websiteUrls
        ),
        'library-only',
        "Chapters with no source URL should be classified as library-only"
    );
    
    // Both: chapter exists on website and in book
    assert.equal(
        ChapterInclusionLogic.determineChapterSource(
            { sourceUrl: 'https://example.com/chapter/1', title: 'Chapter 1' }, 
            websiteUrls
        ),
        'both',
        "Chapters that exist on both website and in book should be classified as both"
    );
    
    // Library-only: chapter removed from website
    assert.equal(
        ChapterInclusionLogic.determineChapterSource(
            { sourceUrl: 'https://example.com/chapter/removed', title: 'Removed Chapter' }, 
            websiteUrls
        ),
        'library-only',
        "Chapters removed from website should be classified as library-only"
    );
    
    // Both: with URL normalization
    assert.equal(
        ChapterInclusionLogic.determineChapterSource(
            { sourceUrl: 'https://example.com/chapter/1/', title: 'Chapter 1' }, 
            websiteUrls
        ),
        'both',
        "URL normalization should work for classification"
    );
});

test("shouldChapterBeIncluded - normal mode behavior", function (assert) {
    // Normal mode: all chapters should be included by default
    assert.equal(
        ChapterInclusionLogic.shouldChapterBeIncluded('library-only', false),
        true,
        "Normal mode: library-only chapters should be included"
    );
    
    assert.equal(
        ChapterInclusionLogic.shouldChapterBeIncluded('both', false),
        true,
        "Normal mode: both chapters should be included"
    );
    
    assert.equal(
        ChapterInclusionLogic.shouldChapterBeIncluded('website', false),
        true,
        "Normal mode: website chapters should be included"
    );
    
    assert.equal(
        ChapterInclusionLogic.shouldChapterBeIncluded('unknown', false),
        true,
        "Normal mode: unknown source chapters should be included"
    );
});

test("shouldChapterBeIncluded - library mode behavior", function (assert) {
    // Library mode: only new website chapters should be included by default
    assert.equal(
        ChapterInclusionLogic.shouldChapterBeIncluded('library-only', true),
        false,
        "Library mode: library-only chapters should NOT be included (already in book)"
    );
    
    assert.equal(
        ChapterInclusionLogic.shouldChapterBeIncluded('both', true),
        false,
        "Library mode: both chapters should NOT be included (already in book)"
    );
    
    assert.equal(
        ChapterInclusionLogic.shouldChapterBeIncluded('website', true),
        true,
        "Library mode: website chapters should be included (new chapters)"
    );
    
    assert.equal(
        ChapterInclusionLogic.shouldChapterBeIncluded('unknown', true),
        false,
        "Library mode: unknown source chapters should NOT be included"
    );
});

test("shouldChapterBeIncluded - preserves existing selections", function (assert) {
    // Existing true selections should be preserved
    assert.equal(
        ChapterInclusionLogic.shouldChapterBeIncluded('library-only', true, true),
        true,
        "Should preserve existing true selection for library-only in library mode"
    );
    
    assert.equal(
        ChapterInclusionLogic.shouldChapterBeIncluded('website', false, true),
        true,
        "Should preserve existing true selection for website in normal mode"
    );
    
    // Existing false selections should be preserved
    assert.equal(
        ChapterInclusionLogic.shouldChapterBeIncluded('website', true, false),
        false,
        "Should preserve existing false selection for website in library mode"
    );
    
    assert.equal(
        ChapterInclusionLogic.shouldChapterBeIncluded('both', false, false),
        false,
        "Should preserve existing false selection for both in normal mode"
    );
});

test("shouldChapterBeIncluded - normal mode defaults with unknown source", function (assert) {
    // Normal mode should default to true for unknown sources
    assert.equal(
        ChapterInclusionLogic.shouldChapterBeIncluded('unknown', false),
        true,
        "Normal mode: unknown source chapters should be included by default"
    );
    
    assert.equal(
        ChapterInclusionLogic.shouldChapterBeIncluded(undefined, false),
        true,
        "Normal mode: undefined source chapters should be included by default"
    );
    
    // Library mode should be conservative with unknown sources
    assert.equal(
        ChapterInclusionLogic.shouldChapterBeIncluded('unknown', true),
        false,
        "Library mode: unknown source chapters should NOT be included by default"
    );
});

testModule("Chapter Inclusion Logic - Library Mode Scenarios");

test("processLibraryChapters - basic library chapter processing", function (assert) {
    const bookChapters = [
        { sourceUrl: 'library://info', title: 'Information' },
        { sourceUrl: 'https://example.com/chapter/1', title: 'Chapter 1' },
        { sourceUrl: 'https://example.com/chapter/2', title: 'Chapter 2' },
        { sourceUrl: 'https://example.com/removed-chapter', title: 'Removed Chapter' }
    ];
    
    const websiteUrls = new Set([
        'https://example.com/chapter/1',
        'https://example.com/chapter/2'
    ]);
    
    const processed = ChapterInclusionLogic.processLibraryChapters(bookChapters, websiteUrls, 'book123');
    
    assert.equal(processed.length, 4, "Should process all book chapters");
    
    // Information page
    assert.equal(processed[0].source, 'library-only', "Information page should be library-only");
    assert.equal(processed[0].isIncludeable, false, "Information page should not be included by default");
    assert.equal(processed[0].isInBook, true, "Information page should be marked as in book");
    
    // Chapter 1 (exists on website)
    assert.equal(processed[1].source, 'both', "Chapter 1 should be both");
    assert.equal(processed[1].isIncludeable, false, "Chapter 1 should not be included by default (already in book)");
    assert.equal(processed[1].isInBook, true, "Chapter 1 should be marked as in book");
    
    // Chapter 2 (exists on website) 
    assert.equal(processed[2].source, 'both', "Chapter 2 should be both");
    assert.equal(processed[2].isIncludeable, false, "Chapter 2 should not be included by default (already in book)");
    
    // Removed chapter
    assert.equal(processed[3].source, 'library-only', "Removed chapter should be library-only");
    assert.equal(processed[3].isIncludeable, false, "Removed chapter should not be included by default");
});

test("processWebsiteChapters - filters out chapters already in book", function (assert) {
    const websiteChapters = [
        { sourceUrl: 'https://example.com/chapter/1', title: 'Chapter 1', isIncludeable: undefined },
        { sourceUrl: 'https://example.com/chapter/2', title: 'Chapter 2', isIncludeable: undefined },
        { sourceUrl: 'https://example.com/chapter/3', title: 'Chapter 3', isIncludeable: undefined },
        { sourceUrl: 'https://example.com/chapter/4', title: 'Chapter 4', isIncludeable: undefined }
    ];
    
    const bookChapters = [
        { sourceUrl: 'library://info', title: 'Information' },
        { sourceUrl: 'https://example.com/chapter/1', title: 'Chapter 1' },
        { sourceUrl: 'https://example.com/chapter/2/', title: 'Chapter 2' } // Note trailing slash
    ];
    
    const processed = ChapterInclusionLogic.processWebsiteChapters(websiteChapters, bookChapters, 'book123');
    
    assert.equal(processed.length, 2, "Should only include chapters 3 and 4 (not in book)");
    
    // Chapter 3 (new)
    assert.equal(processed[0].sourceUrl, 'https://example.com/chapter/3', "First new chapter should be chapter 3");
    assert.equal(processed[0].source, 'website', "New chapter should have website source");
    assert.equal(processed[0].isIncludeable, true, "New chapter should be included by default");
    assert.equal(processed[0].isInBook, false, "New chapter should not be marked as in book");
    
    // Chapter 4 (new)
    assert.equal(processed[1].sourceUrl, 'https://example.com/chapter/4', "Second new chapter should be chapter 4");
    assert.equal(processed[1].source, 'website', "New chapter should have website source");
    assert.equal(processed[1].isIncludeable, true, "New chapter should be included by default");
});

test("processWebsiteChapters - preserves existing isIncludeable values", function (assert) {
    const websiteChapters = [
        { sourceUrl: 'https://example.com/chapter/3', title: 'Chapter 3', isIncludeable: false }, // User disabled
        { sourceUrl: 'https://example.com/chapter/4', title: 'Chapter 4', isIncludeable: true },  // User enabled
        { sourceUrl: 'https://example.com/chapter/5', title: 'Chapter 5', isIncludeable: undefined } // Default
    ];
    
    const bookChapters = []; // Empty book
    
    const processed = ChapterInclusionLogic.processWebsiteChapters(websiteChapters, bookChapters, 'book123');
    
    assert.equal(processed.length, 3, "Should process all website chapters");
    
    // User disabled chapter should remain disabled
    assert.equal(processed[0].isIncludeable, false, "User-disabled chapter should remain disabled");
    
    // User enabled chapter should remain enabled
    assert.equal(processed[1].isIncludeable, true, "User-enabled chapter should remain enabled");
    
    // Default chapter should be enabled
    assert.equal(processed[2].isIncludeable, true, "Default chapter should be enabled");
});

test("mergeChaptersForLibrary - complete integration test", function (assert) {
    const bookChapters = [
        { sourceUrl: 'library://info', title: 'Information' },
        { sourceUrl: 'https://example.com/chapter/1', title: 'Chapter 1' },
        { sourceUrl: 'https://example.com/chapter/2', title: 'Chapter 2' },
        { sourceUrl: 'https://example.com/old-chapter', title: 'Old Chapter' }
    ];
    
    const websiteChapters = [
        { sourceUrl: 'https://example.com/chapter/1', title: 'Chapter 1' },
        { sourceUrl: 'https://example.com/chapter/2', title: 'Chapter 2' },
        { sourceUrl: 'https://example.com/chapter/3', title: 'Chapter 3' },
        { sourceUrl: 'https://example.com/chapter/4', title: 'Chapter 4' }
    ];
    
    const merged = ChapterInclusionLogic.mergeChaptersForLibrary(bookChapters, websiteChapters, 'book123');
    
    assert.equal(merged.length, 6, "Should have 4 book chapters + 2 new website chapters");
    
    // Verify order: library chapters first, then new website chapters
    assert.equal(merged[0].title, 'Information', "Information should be first");
    assert.equal(merged[1].title, 'Chapter 1', "Chapter 1 should be second");
    assert.equal(merged[2].title, 'Chapter 2', "Chapter 2 should be third");
    assert.equal(merged[3].title, 'Old Chapter', "Old Chapter should be fourth");
    assert.equal(merged[4].title, 'Chapter 3', "Chapter 3 (new) should be fifth");
    assert.equal(merged[5].title, 'Chapter 4', "Chapter 4 (new) should be sixth");
    
    // Verify inclusion states
    assert.equal(merged[0].isIncludeable, false, "Information should not be included");
    assert.equal(merged[1].isIncludeable, false, "Chapter 1 should not be included (already in book)");
    assert.equal(merged[2].isIncludeable, false, "Chapter 2 should not be included (already in book)");
    assert.equal(merged[3].isIncludeable, false, "Old Chapter should not be included (already in book)");
    assert.equal(merged[4].isIncludeable, true, "Chapter 3 should be included (new)");
    assert.equal(merged[5].isIncludeable, true, "Chapter 4 should be included (new)");
    
    // Verify sources
    assert.equal(merged[0].source, 'library-only', "Information should be library-only");
    assert.equal(merged[1].source, 'both', "Chapter 1 should be both");
    assert.equal(merged[2].source, 'both', "Chapter 2 should be both");
    assert.equal(merged[3].source, 'library-only', "Old Chapter should be library-only");
    assert.equal(merged[4].source, 'website', "Chapter 3 should be website");
    assert.equal(merged[5].source, 'website', "Chapter 4 should be website");
});

testModule("Chapter Inclusion Logic - Validation");

test("validateChapterInclusionValues - detects potential conflicts", function (assert) {
    const chapters = [
        {
            title: "Good Chapter",
            source: "website", 
            isIncludeable: true,
            previousDownload: false
        },
        {
            title: "Library Chapter Incorrectly Included", 
            source: "library-only",
            isIncludeable: true, // This is potentially wrong
            previousDownload: false
        },
        {
            title: "Previously Downloaded But Still Included",
            source: "both",
            isIncludeable: true, // This is potentially wrong
            previousDownload: true
        },
        {
            title: "Proper Library Chapter",
            source: "library-only", 
            isIncludeable: false,
            previousDownload: true
        }
    ];
    
    const warnings = ChapterInclusionLogic.validateChapterInclusionValues(chapters, "test");
    
    assert.equal(warnings.length, 2, "Should detect 2 potential conflicts");
    assert.ok(
        warnings[0].includes("library-only but marked includeable"), 
        "Should warn about library-only chapter marked includeable"
    );
    assert.ok(
        warnings[1].includes("previously downloaded but marked includeable"),
        "Should warn about previously downloaded chapter marked includeable"
    );
});

test("validateChapterInclusionValues - handles chapters without full properties", function (assert) {
    const chapters = [
        { title: "Minimal Chapter", sourceUrl: "http://example.com" },
        { title: "Partial Chapter", isIncludeable: true },
        { title: "Normal Chapter", source: "website", isIncludeable: true, previousDownload: false }
    ];
    
    const warnings = ChapterInclusionLogic.validateChapterInclusionValues(chapters, "test");
    
    assert.equal(warnings.length, 0, "Should not warn about chapters without full properties");
});

testModule("Chapter Inclusion Logic - Edge Cases");

test("handles empty inputs gracefully", function (assert) {
    // Empty book chapters
    const result1 = ChapterInclusionLogic.mergeChaptersForLibrary([], [
        { sourceUrl: 'https://example.com/chapter/1', title: 'Chapter 1' }
    ], 'book123');
    
    assert.equal(result1.length, 1, "Should handle empty book chapters");
    assert.equal(result1[0].source, 'website', "Only chapter should be website source");
    assert.equal(result1[0].isIncludeable, true, "Only chapter should be included");
    
    // Empty website chapters
    const result2 = ChapterInclusionLogic.mergeChaptersForLibrary([
        { sourceUrl: 'https://example.com/chapter/1', title: 'Chapter 1' }
    ], [], 'book123');
    
    assert.equal(result2.length, 1, "Should handle empty website chapters");
    assert.equal(result2[0].source, 'library-only', "Only chapter should be library-only source");
    assert.equal(result2[0].isIncludeable, false, "Only chapter should not be included");
    
    // Both empty
    const result3 = ChapterInclusionLogic.mergeChaptersForLibrary([], [], 'book123');
    assert.equal(result3.length, 0, "Should handle both inputs being empty");
});

test("handles chapters with no URLs", function (assert) {
    const bookChapters = [
        { sourceUrl: null, title: 'No URL Chapter' },
        { sourceUrl: '', title: 'Empty URL Chapter' },
        { sourceUrl: undefined, title: 'Undefined URL Chapter' }
    ];
    
    const processed = ChapterInclusionLogic.processLibraryChapters(bookChapters, new Set(), 'book123');
    
    assert.equal(processed.length, 3, "Should process all chapters with missing URLs");
    
    processed.forEach((chapter, index) => {
        assert.equal(chapter.source, 'library-only', `Chapter ${index} should be library-only`);
        assert.equal(chapter.isIncludeable, false, `Chapter ${index} should not be included`);
    });
});

test("handles URL normalization edge cases", function (assert) {
    const bookChapters = [
        { sourceUrl: 'https://example.com/chapter/1/', title: 'Chapter 1' }
    ];
    
    const websiteChapters = [
        { sourceUrl: 'https://example.com/chapter/1', title: 'Chapter 1' }, // No trailing slash
        { sourceUrl: 'https://example.com/chapter/2/', title: 'Chapter 2' }  // With trailing slash
    ];
    
    const merged = ChapterInclusionLogic.mergeChaptersForLibrary(bookChapters, websiteChapters, 'book123');
    
    assert.equal(merged.length, 2, "Should have 1 book chapter + 1 new website chapter");
    assert.equal(merged[0].source, 'both', "Chapter 1 should be recognized as both despite URL differences");
    assert.equal(merged[1].source, 'website', "Chapter 2 should be new website chapter");
});

// Run tests if this file is executed directly
if (require.main === module) {
    global.TestRunner.run().then(success => {
        console.log(`\nChapter Inclusion Tests ${success ? 'PASSED' : 'FAILED'}`);
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('Test execution failed:', error);
        process.exit(1);
    });
}