/**
 * Unit tests for EpubUpdater.js
 * Tests the EPUB modification functionality including delete, refresh, and merge operations
 */

// Mock zip.js
global.zip = {
    Data64URIReader: class {
        constructor(data) { this.data = data; }
    },
    ZipReader: class {
        constructor(reader, options) { 
            this.reader = reader; 
            this.options = options;
        }
        async getEntries() {
            // Return mock EPUB entries for testing
            return [
                { 
                    filename: "mimetype", 
                    directory: false,
                    getData: async (writer) => "application/epub+zip"
                },
                { 
                    filename: "META-INF/container.xml", 
                    directory: false,
                    getData: async (writer) => '<?xml version="1.0"?><container/>'
                },
                { 
                    filename: "OEBPS/content.opf", 
                    directory: false,
                    getData: async (writer) => `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="BookId">
    <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
        <dc:title>Test Book</dc:title>
        <dc:creator>Test Author</dc:creator>
        <dc:identifier id="BookId" opf:scheme="URI">http://example.com</dc:identifier>
        <dc:source id="id.xhtml0001">http://example.com/chapter1</dc:source>
        <dc:source id="id.xhtml0002">http://example.com/chapter2</dc:source>
        <dc:source id="id.xhtml0003">http://example.com/chapter3</dc:source>
    </metadata>
    <manifest>
        <item href="Text/0001.xhtml" id="xhtml0001" media-type="application/xhtml+xml"/>
        <item href="Text/0002.xhtml" id="xhtml0002" media-type="application/xhtml+xml"/>
        <item href="Text/0003.xhtml" id="xhtml0003" media-type="application/xhtml+xml"/>
        <item href="toc.ncx" id="ncx" media-type="application/x-dtbncx+xml"/>
        <item href="Styles/stylesheet.css" id="stylesheet" media-type="text/css"/>
    </manifest>
    <spine toc="ncx">
        <itemref idref="xhtml0001"/>
        <itemref idref="xhtml0002"/>
        <itemref idref="xhtml0003"/>
    </spine>
</package>`
                },
                { 
                    filename: "OEBPS/toc.ncx", 
                    directory: false,
                    getData: async (writer) => `<?xml version="1.0" encoding="utf-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
    <head/>
    <docTitle><text>Test Book</text></docTitle>
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
</ncx>`
                },
                { 
                    filename: "OEBPS/Text/0001.xhtml", 
                    directory: false,
                    getData: async (writer) => `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Chapter 1</title></head>
<body><h1>Chapter 1</h1><p>Content of chapter 1</p></body>
</html>`
                },
                { 
                    filename: "OEBPS/Text/0002.xhtml", 
                    directory: false,
                    getData: async (writer) => `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Chapter 2</title></head>
<body><h1>Chapter 2</h1><p>Content of chapter 2</p></body>
</html>`
                },
                { 
                    filename: "OEBPS/Text/0003.xhtml", 
                    directory: false,
                    getData: async (writer) => `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Chapter 3</title></head>
<body><h1>Chapter 3</h1><p>Content of chapter 3</p></body>
</html>`
                },
                { 
                    filename: "OEBPS/Styles/stylesheet.css", 
                    directory: false,
                    getData: async (writer) => "body { font-family: serif; }"
                }
            ];
        }
        async close() {}
    },
    BlobWriter: class {
        constructor(mimeType) { this.mimeType = mimeType; }
    },
    ZipWriter: class {
        constructor(writer, options) { 
            this.writer = writer; 
            this.options = options;
            this.entries = [];
        }
        async add(filename, reader, options) {
            this.entries.push({ filename, reader, options });
        }
        async close() {
            // Return mock blob
            return new Blob(["mock epub content"], { type: "application/epub+zip" });
        }
    },
    TextReader: class {
        constructor(text) { this.text = text; }
    },
    BlobReader: class {
        constructor(blob) { this.blob = blob; }
    },
    TextWriter: class {},
    BlobWriter: class {}
};

// Mock util object
global.util = {
    getEpubStructure: () => ({
        contentOpf: "OEBPS/content.opf",
        tocNcx: "OEBPS/toc.ncx",
        navXhtml: "OEBPS/nav.xhtml",
        textDir: "OEBPS/Text/",
        textDirRel: "Text",
        imagesDirRel: "Images",
        contentDir: "OEBPS"
    })
};

// Mock console for testing
const originalConsole = global.console;
let consoleLogs = [];
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

// Load the test framework
require('./node-setup');
require('./test-framework');

console.log("Loading EpubUpdater.js for testing...");

// Make sure globals are set before loading EpubUpdater
global.EpubUpdater = undefined; // Clear any existing

// Import EpubUpdater
require('../plugin/js/EpubUpdater.js');

// Check if EpubUpdater was defined
if (typeof global.EpubUpdater === 'undefined' && typeof EpubUpdater === 'undefined') {
    console.error("❌ EpubUpdater class was not defined after loading the file");
} else {
    console.log("✅ EpubUpdater class loaded successfully");
}

testModule("EpubUpdater Tests");

// Test helper functions
function createMockEpubBase64() {
    return "data:application/epub+zip;base64,UEsDBAoAAAAAADVGWk4AAAAAAAAAAAAAAAAIAAAAbWltZXR5cGU=";
}

function resetConsoleLogs() {
    consoleLogs = [];
}

test("EpubUpdater class exists", function(assert) {
    assert.ok(typeof EpubUpdater !== 'undefined', "EpubUpdater class should be defined");
    assert.ok(typeof EpubUpdater.deleteChapter === 'function', "deleteChapter method should exist");
    assert.ok(typeof EpubUpdater.refreshChapter === 'function', "refreshChapter method should exist");
    assert.ok(typeof EpubUpdater.validateEpub === 'function', "validateEpub method should exist");
    assert.ok(typeof EpubUpdater.blobToBase64 === 'function', "blobToBase64 method should exist");
});

test("removeChapterFromContentOpf - removes correct chapter references", function(assert) {
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

    let epubPaths = util.getEpubStructure();
    let result = EpubUpdater.removeChapterFromContentOpf(contentOpf, "0002", epubPaths);
    
    // Should remove chapter 0002 references
    assert.false(result.includes('id.xhtml0002'), "Should remove dc:source for chapter 0002");
    assert.false(result.includes('href="Text/0002.xhtml"'), "Should remove manifest item for chapter 0002");
    assert.false(result.includes('idref="xhtml0002"'), "Should remove spine reference for chapter 0002");
    
    // Should keep other chapters
    assert.true(result.includes('id.xhtml0001'), "Should keep dc:source for chapter 0001");
    assert.true(result.includes('id.xhtml0003'), "Should keep dc:source for chapter 0003");
    assert.true(result.includes('href="Text/0001.xhtml"'), "Should keep manifest item for chapter 0001");
    assert.true(result.includes('href="Text/0003.xhtml"'), "Should keep manifest item for chapter 0003");
});

test("removeChapterFromTocNcx - removes navPoint and updates playOrder", function(assert) {
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

    let epubPaths = util.getEpubStructure();
    let result = EpubUpdater.removeChapterFromTocNcx(tocNcx, 2, "0002", epubPaths);
    
    // Should remove chapter 0002 navPoint
    assert.false(result.includes('id="body0002"'), "Should remove navPoint for chapter 0002");
    assert.false(result.includes('playOrder="2"'), "Should remove original playOrder 2");
    
    // Should keep other chapters but update playOrder
    assert.true(result.includes('id="body0001"'), "Should keep navPoint for chapter 0001");
    assert.true(result.includes('id="body0003"'), "Should keep navPoint for chapter 0003");
    assert.true(result.includes('playOrder="1"'), "Should keep playOrder 1");
    assert.true(result.includes('playOrder="2"'), "Should renumber chapter 3 to playOrder 2");
});

test("removeChapterFromNavXhtml - removes list item", function(assert) {
    let navXhtml = `<?xml version="1.0"?>
<html>
    <body>
        <nav>
            <ol>
                <li><a href="Text/0001.xhtml">Chapter 1</a></li>
                <li><a href="Text/0002.xhtml">Chapter 2</a></li>
                <li><a href="Text/0003.xhtml">Chapter 3</a></li>
            </ol>
        </nav>
    </body>
</html>`;

    let epubPaths = util.getEpubStructure();
    let result = EpubUpdater.removeChapterFromNavXhtml(navXhtml, "0002", epubPaths);
    
    // Should remove chapter 0002 list item
    assert.false(result.includes('href="Text/0002.xhtml"'), "Should remove list item for chapter 0002");
    
    // Should keep other chapters
    assert.true(result.includes('href="Text/0001.xhtml"'), "Should keep list item for chapter 0001");
    assert.true(result.includes('href="Text/0003.xhtml"'), "Should keep list item for chapter 0003");
});

test("blobToBase64 - converts blob to base64", async function(assert) {
    // Mock FileReader
    global.FileReader = class {
        constructor() {
            this.onload = null;
        }
        readAsDataURL(blob) {
            setTimeout(() => {
                this.result = "data:application/epub+zip;base64,dGVzdCBkYXRh";
                if (this.onload) this.onload();
            }, 0);
        }
    };

    let blob = new Blob(["test data"], { type: "application/epub+zip" });
    let result = await EpubUpdater.blobToBase64(blob);
    
    assert.equal(result, "data:application/epub+zip;base64,dGVzdCBkYXRh", "Should convert blob to base64 data URL");
});

test("validateEpub - validates EPUB structure", async function(assert) {
    let validEpubBase64 = createMockEpubBase64();
    let isValid = await EpubUpdater.validateEpub(validEpubBase64);
    
    assert.true(isValid, "Should validate correct EPUB structure");
});

test("deleteChapter - integration test", async function(assert) {
    resetConsoleLogs();
    
    let epubBase64 = createMockEpubBase64();
    
    // Delete chapter at index 1 (second chapter - 0002.xhtml)
    let result = await EpubUpdater.deleteChapter(epubBase64, 1);
    
    assert.ok(result instanceof Blob, "Should return a Blob");
    assert.equal(result.type, "application/epub+zip", "Should have correct MIME type");
    
    // Check console logs for debugging
    let deleteLog = consoleLogs.find(log => log.includes("Deleting chapter file"));
    assert.ok(deleteLog, "Should log which chapter file is being deleted");
    assert.ok(deleteLog.includes("0002.xhtml"), "Should delete the correct chapter file (0002.xhtml)");
    
    let successLog = consoleLogs.find(log => log.includes("Successfully deleted chapter"));
    assert.ok(successLog, "Should log successful deletion");
});

test("refreshChapter - integration test", async function(assert) {
    resetConsoleLogs();
    
    let epubBase64 = createMockEpubBase64();
    let newXhtml = `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Updated Chapter 2</title></head>
<body><h1>Updated Chapter 2</h1><p>This is the updated content</p></body>
</html>`;
    
    // Refresh chapter at index 1 (second chapter - 0002.xhtml)
    let result = await EpubUpdater.refreshChapter(epubBase64, 1, newXhtml);
    
    assert.ok(result instanceof Blob, "Should return a Blob");
    assert.equal(result.type, "application/epub+zip", "Should have correct MIME type");
    
    // Check console logs
    let refreshLog = consoleLogs.find(log => log.includes("Refreshing chapter file"));
    assert.ok(refreshLog, "Should log which chapter file is being refreshed");
    assert.ok(refreshLog.includes("0002.xhtml"), "Should refresh the correct chapter file (0002.xhtml)");
    
    let successLog = consoleLogs.find(log => log.includes("Successfully refreshed chapter"));
    assert.ok(successLog, "Should log successful refresh");
});

test("deleteChapter - edge cases", async function(assert) {
    let epubBase64 = createMockEpubBase64();
    
    // Test deleting first chapter (index 0)
    try {
        let result = await EpubUpdater.deleteChapter(epubBase64, 0);
        assert.ok(result instanceof Blob, "Should handle deleting first chapter");
    } catch (error) {
        assert.ok(false, "Should not throw error when deleting first chapter: " + error.message);
    }
    
    // Test deleting last chapter (index 2 in our 3-chapter mock)
    try {
        let result = await EpubUpdater.deleteChapter(epubBase64, 2);
        assert.ok(result instanceof Blob, "Should handle deleting last chapter");
    } catch (error) {
        assert.ok(false, "Should not throw error when deleting last chapter: " + error.message);
    }
});

test("Error handling - invalid EPUB data", async function(assert) {
    let invalidEpubBase64 = "data:application/epub+zip;base64,aW52YWxpZA==";
    
    try {
        await EpubUpdater.deleteChapter(invalidEpubBase64, 0);
        assert.ok(false, "Should throw error for invalid EPUB data");
    } catch (error) {
        assert.ok(true, "Should throw error for invalid EPUB data");
        assert.ok(error.message.length > 0, "Error message should not be empty");
    }
});

test("Console logging for debugging", function(assert) {
    // Test that console logging works for debugging delete issues
    resetConsoleLogs();
    
    console.log("Test debug message");
    assert.equal(consoleLogs.length, 1, "Should capture console logs");
    assert.equal(consoleLogs[0], "Test debug message", "Should capture correct log message");
});

// Restore original console
global.console = originalConsole;

console.log("EpubUpdater tests defined successfully");

// Run the tests
TestRunner.run();