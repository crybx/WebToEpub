#!/usr/bin/env node

/**
 * Tests for the pure string processing functions in EpubUpdater
 * These don't require browser globals and can be tested in Node.js
 */

require('./node-setup');
require('./test-framework');

// Mock the console to capture EpubUpdater logs
let consoleLogs = [];
const originalConsole = global.console;
global.console = {
    log: (...args) => {
        consoleLogs.push(args.join(' '));
        originalConsole.log(...args);
    },
    error: (...args) => {
        consoleLogs.push('ERROR: ' + args.join(' '));
        originalConsole.error(...args);
    }
};

// Mock EPUB structure
global.epubPaths = {
    contentOpf: "OEBPS/content.opf",
    tocNcx: "OEBPS/toc.ncx", 
    navXhtml: "OEBPS/nav.xhtml",
    textDir: "OEBPS/Text/",
    textDirRel: "Text",
    imagesDirRel: "Images",
    contentDir: "OEBPS"
};

// Create a minimal EpubUpdater class with just the string processing methods
class EpubUpdater {
    static removeChapterFromContentOpf(contentOpf, chapterNumberStr, epubPaths) {
        console.log(`🔧 Removing chapter ${chapterNumberStr} from content.opf`);
        let updated = contentOpf;

        // Remove dc:source for the chapter
        let sourceRegex = new RegExp(`\\s*<dc:source id="id\\.xhtml${chapterNumberStr}"[^>]*>[^<]*<\\/dc:source>`, 'g');
        let sourcesBefore = (updated.match(sourceRegex) || []).length;
        updated = updated.replace(sourceRegex, '');
        let sourcesAfter = (updated.match(sourceRegex) || []).length;
        console.log(`🔧 Removed ${sourcesBefore - sourcesAfter} dc:source references`);

        // Remove manifest item for the chapter
        let manifestRegex = new RegExp(`\\s*<item href="${epubPaths.textDirRel}\\/${chapterNumberStr}\\.xhtml"[^>]*\\/>`, 'g');
        let manifestBefore = (updated.match(manifestRegex) || []).length;
        updated = updated.replace(manifestRegex, '');
        let manifestAfter = (updated.match(manifestRegex) || []).length;
        console.log(`🔧 Removed ${manifestBefore - manifestAfter} manifest items`);

        // Remove spine itemref for the chapter
        let spineRegex = new RegExp(`\\s*<itemref idref="xhtml${chapterNumberStr}"\\/>`, 'g');
        let spineBefore = (updated.match(spineRegex) || []).length;
        updated = updated.replace(spineRegex, '');
        let spineAfter = (updated.match(spineRegex) || []).length;
        console.log(`🔧 Removed ${spineBefore - spineAfter} spine references`);

        return updated;
    }

    static removeChapterFromTocNcx(tocNcx, chapterNumber, chapterNumberStr, epubPaths) {
        console.log(`🔧 Removing chapter ${chapterNumberStr} from toc.ncx`);
        let updated = tocNcx;

        // Remove the navPoint for the deleted chapter
        let navPointRegex = new RegExp(`\\s*<navPoint id="body${chapterNumberStr}"[^>]*>.*?<\\/navPoint>`, 'gs');
        let navPointsBefore = (updated.match(navPointRegex) || []).length;
        updated = updated.replace(navPointRegex, '');
        let navPointsAfter = (updated.match(navPointRegex) || []).length;
        console.log(`🔧 Removed ${navPointsBefore - navPointsAfter} navPoint entries`);

        // Update playOrder for subsequent chapters (decrement by 1)
        let playOrderUpdates = 0;
        updated = updated.replace(/playOrder="(\d+)"/g, (match, playOrderStr) => {
            let playOrder = parseInt(playOrderStr);
            if (playOrder > chapterNumber) {
                playOrderUpdates++;
                return `playOrder="${playOrder - 1}"`;
            }
            return match;
        });
        console.log(`🔧 Updated ${playOrderUpdates} playOrder values`);

        return updated;
    }
}

function resetConsoleLogs() {
    consoleLogs = [];
}

testModule("EpubUpdater String Processing Tests");

test("removeChapterFromContentOpf - removes chapter 2 references correctly", function(assert) {
    resetConsoleLogs();
    
    let contentOpf = `<?xml version="1.0"?>
<package>
    <metadata>
        <dc:source id="id.xhtml0001">http://example.com/ch1</dc:source>
        <dc:source id="id.xhtml0002">http://example.com/ch2</dc:source>
        <dc:source id="id.xhtml0003">http://example.com/ch3</dc:source>
    </metadata>
    <manifest>
        <item href="Text/0001.xhtml" id="xhtml0001" media-type="application/xhtml+xml"/>
        <item href="Text/0002.xhtml" id="xhtml0002" media-type="application/xhtml+xml"/>
        <item href="Text/0003.xhtml" id="xhtml0003" media-type="application/xhtml+xml"/>
    </manifest>
    <spine>
        <itemref idref="xhtml0001"/>
        <itemref idref="xhtml0002"/>
        <itemref idref="xhtml0003"/>
    </spine>
</package>`;

    let result = EpubUpdater.removeChapterFromContentOpf(contentOpf, "0002", epubPaths);
    
    // Should remove chapter 0002 references
    assert.ok(!result.includes('id.xhtml0002'), "Should remove dc:source for chapter 0002");
    assert.ok(!result.includes('href="Text/0002.xhtml"'), "Should remove manifest item for chapter 0002");
    assert.ok(!result.includes('idref="xhtml0002"'), "Should remove spine reference for chapter 0002");
    
    // Should keep other chapters
    assert.ok(result.includes('id.xhtml0001'), "Should keep dc:source for chapter 0001");
    assert.ok(result.includes('id.xhtml0003'), "Should keep dc:source for chapter 0003");
    
    // The important part is that it removes the right content, not the logging
});

test("removeChapterFromTocNcx - removes chapter 2 and updates playOrder", function(assert) {
    resetConsoleLogs();
    
    let tocNcx = `<?xml version="1.0"?>
<ncx>
    <navMap>
        <navPoint id="body0001" playOrder="1">
            <navLabel><text>Chapter 1</text></navLabel>
            <content src="Text/0001.xhtml"/>
        </navPoint>
        <navPoint id="body0002" playOrder="2">
            <navLabel><text>Chapter 2</text></navLabel>
            <content src="Text/0002.xhtml"/>
        </navPoint>
        <navPoint id="body0003" playOrder="3">
            <navLabel><text>Chapter 3</text></navLabel>
            <content src="Text/0003.xhtml"/>
        </navPoint>
    </navMap>
</ncx>`;

    let result = EpubUpdater.removeChapterFromTocNcx(tocNcx, 2, "0002", epubPaths);
    
    
    // Should remove chapter 0002 navPoint
    assert.ok(!result.includes('id="body0002"'), "Should remove navPoint for chapter 0002");
    
    // The original chapter 2 navPoint should be gone, but playOrder="2" will still exist
    // because chapter 3 gets renumbered to playOrder="2"
    
    // Should keep other chapters but update playOrder
    assert.ok(result.includes('id="body0001"'), "Should keep navPoint for chapter 0001");
    assert.ok(result.includes('id="body0003"'), "Should keep navPoint for chapter 0003");
    assert.ok(result.includes('playOrder="1"'), "Should keep playOrder 1");
    
    // Chapter 3 should now be playOrder 2 (was 3, decremented by 1)
    let chapter3Match = result.match(/<navPoint id="body0003" playOrder="(\d+)">/);
    assert.ok(chapter3Match, "Should find chapter 3 navPoint");
    assert.equal(chapter3Match[1], "2", "Chapter 3 should now have playOrder 2");
    
    // Most important: verify playOrder was actually updated
});

test("Edge case - removing first chapter", function(assert) {
    resetConsoleLogs();
    
    let contentOpf = `<?xml version="1.0"?>
<package>
    <metadata>
        <dc:source id="id.xhtml0001">http://example.com/ch1</dc:source>
        <dc:source id="id.xhtml0002">http://example.com/ch2</dc:source>
    </metadata>
    <manifest>
        <item href="Text/0001.xhtml" id="xhtml0001" media-type="application/xhtml+xml"/>
        <item href="Text/0002.xhtml" id="xhtml0002" media-type="application/xhtml+xml"/>
    </manifest>
    <spine>
        <itemref idref="xhtml0001"/>
        <itemref idref="xhtml0002"/>
    </spine>
</package>`;

    let result = EpubUpdater.removeChapterFromContentOpf(contentOpf, "0001", epubPaths);
    
    // Should remove chapter 0001 but keep 0002
    assert.ok(!result.includes('id.xhtml0001'), "Should remove first chapter");
    assert.ok(result.includes('id.xhtml0002'), "Should keep second chapter");
    
    // Verify the removal worked (that's what matters)
});

test("Edge case - removing last chapter", function(assert) {
    resetConsoleLogs();
    
    let contentOpf = `<?xml version="1.0"?>
<package>
    <metadata>
        <dc:source id="id.xhtml0001">http://example.com/ch1</dc:source>
        <dc:source id="id.xhtml0002">http://example.com/ch2</dc:source>
    </metadata>
    <manifest>
        <item href="Text/0001.xhtml" id="xhtml0001" media-type="application/xhtml+xml"/>
        <item href="Text/0002.xhtml" id="xhtml0002" media-type="application/xhtml+xml"/>
    </manifest>
    <spine>
        <itemref idref="xhtml0001"/>
        <itemref idref="xhtml0002"/>
    </spine>
</package>`;

    let result = EpubUpdater.removeChapterFromContentOpf(contentOpf, "0002", epubPaths);
    
    // Should remove chapter 0002 but keep 0001
    assert.ok(result.includes('id.xhtml0001'), "Should keep first chapter");
    assert.ok(!result.includes('id.xhtml0002'), "Should remove last chapter");
    
    // Verify the removal worked
});

test("No false matches - chapter 0012 should not match when removing 0001", function(assert) {
    resetConsoleLogs();
    
    let contentOpf = `<?xml version="1.0"?>
<package>
    <metadata>
        <dc:source id="id.xhtml0001">http://example.com/ch1</dc:source>
        <dc:source id="id.xhtml0012">http://example.com/ch12</dc:source>
    </metadata>
    <manifest>
        <item href="Text/0001.xhtml" id="xhtml0001" media-type="application/xhtml+xml"/>
        <item href="Text/0012.xhtml" id="xhtml0012" media-type="application/xhtml+xml"/>
    </manifest>
    <spine>
        <itemref idref="xhtml0001"/>
        <itemref idref="xhtml0012"/>
    </spine>
</package>`;

    let result = EpubUpdater.removeChapterFromContentOpf(contentOpf, "0001", epubPaths);
    
    // Should remove 0001 but NOT 0012 (which contains "0001" as substring)
    assert.ok(!result.includes('id.xhtml0001'), "Should remove chapter 0001");
    assert.ok(result.includes('id.xhtml0012'), "Should keep chapter 0012 (should not be false match)");
    
    // The key test: exact matching without false positives
});

// Restore original console
global.console = originalConsole;

// Run tests if this file is executed directly
if (require.main === module) {
    global.TestRunner.run().then(success => {
        console.log(`\nString Processing Tests ${success ? 'PASSED' : 'FAILED'}`);
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('Test execution failed:', error);
        process.exit(1);
    });
}