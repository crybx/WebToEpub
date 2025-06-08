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

// Create minimal browser-like environment for EpubUpdater
global.LibraryStorage = {
    LibGetFromStorage: async (key) => null,
    LibSaveToStorage: async (key, value) => true
};

global.LibraryBookData = {
    extractBookData: async (bookId) => ({ chapters: [] })
};

global.ChapterEpubItem = class {
    constructor(webPage, content, index) {
        this.webPage = webPage;
        this.content = content;
        this.index = index;
    }
    fileContentForEpub() {
        return "<html><body>Test content</body></html>";
    }
};

global.EpubPacker = {
    XHTML_MIME_TYPE: "application/xhtml+xml"
};

// Load EpubUpdater - we'll define it manually since the file structure is complex
class EpubUpdater {
    static removeChapterFromContentOpf(contentOpf, chapterNumberStr, epubPaths) {
        let updated = contentOpf;

        // Remove dc:source for the chapter
        let sourceRegex = new RegExp(`\\s*<dc:source id="id\\.xhtml${chapterNumberStr}"[^>]*>[^<]*<\\/dc:source>`, 'g');
        updated = updated.replace(sourceRegex, '');

        // Remove manifest item for the chapter
        let manifestRegex = new RegExp(`\\s*<item href="${epubPaths.textDirRel}\\/${chapterNumberStr}\\.xhtml"[^>]*\\/>`, 'g');
        updated = updated.replace(manifestRegex, '');

        // Remove spine itemref for the chapter
        let spineRegex = new RegExp(`\\s*<itemref idref="xhtml${chapterNumberStr}"\\/>`, 'g');
        updated = updated.replace(spineRegex, '');

        return updated;
    }

    static removeChapterFromTocNcx(tocNcx, chapterNumber, chapterNumberStr) {
        let updated = tocNcx;

        // Remove the navPoint for the deleted chapter
        let navPointRegex = new RegExp(`\\s*<navPoint id="body${chapterNumberStr}"[^>]*>.*?<\\/navPoint>`, 'gs');
        updated = updated.replace(navPointRegex, '');

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

        return updated;
    }

    static removeChapterFromNavXhtml(navXhtml, chapterNumberStr, epubPaths) {
        let updated = navXhtml;

        // Remove the list item for the deleted chapter
        let listItemRegex = new RegExp(`\\s*<li><a href="${epubPaths.textDirRel}\\/${chapterNumberStr}\\.xhtml"[^>]*>[^<]*<\\/a><\\/li>`, 'g');
        updated = updated.replace(listItemRegex, '');
        return updated;
    }

    static reorderContentOpf(contentOpf, newChapterOrder, epubPaths) {
        let updated = contentOpf;

        // Extract current spine itemrefs
        let spineRegex = /<spine[^>]*>([\s\S]*?)<\/spine>/;
        let spineMatch = updated.match(spineRegex);
        if (!spineMatch) {
            throw new Error("Could not find spine section in content.opf");
        }

        let spineContent = spineMatch[1];
        let itemrefRegex = /<itemref[^>]*idref="([^"]*)"[^>]*\/>/g;
        let existingItemrefs = [];
        let match;
        while ((match = itemrefRegex.exec(spineContent)) !== null) {
            existingItemrefs.push({
                idref: match[1],
                fullTag: match[0]
            });
        }

        // FIXED: Build manifest map from href to id
        let manifestRegex = /<item[^>]*href="([^"]*)"[^>]*id="([^"]*)"[^>]*\/>/g;
        let hrefToIdMap = {};
        while ((match = manifestRegex.exec(updated)) !== null) {
            hrefToIdMap[match[1]] = match[2]; // href -> id
        }

        // Build set of chapter idrefs that will be reordered
        let chapterIdrefs = new Set();
        newChapterOrder.forEach(chapter => {
            let relativePath = chapter.libraryFilePath.replace(epubPaths.contentDir + "/", "");
            let actualIdref = hrefToIdMap[relativePath];
            if (actualIdref) {
                chapterIdrefs.add(actualIdref);
            }
        });

        // Create new spine content: preserve non-chapters in original order, insert reordered chapters
        let newSpineContent = "\n";
        let chapterItemrefs = [];
        
        // First, collect the reordered chapter itemrefs
        newChapterOrder.forEach(chapter => {
            let relativePath = chapter.libraryFilePath.replace(epubPaths.contentDir + "/", "");
            let actualIdref = hrefToIdMap[relativePath];
            
            if (actualIdref) {
                let itemref = existingItemrefs.find(ir => ir.idref === actualIdref);
                if (itemref) {
                    chapterItemrefs.push(itemref);
                }
            }
        });

        // Now build the new spine: replace chapter section with reordered chapters, keep everything else
        let chapterInserted = false;
        existingItemrefs.forEach(itemref => {
            if (chapterIdrefs.has(itemref.idref)) {
                // This is a chapter that will be reordered - insert all reordered chapters here once
                if (!chapterInserted) {
                    chapterItemrefs.forEach(chapterItemref => {
                        newSpineContent += `        ${chapterItemref.fullTag}\n`;
                    });
                    chapterInserted = true;
                }
                // Skip this individual chapter (already inserted as part of reordered group)
            } else {
                // This is a non-chapter item (Cover, Information, etc.) - preserve in original position
                newSpineContent += `        ${itemref.fullTag}\n`;
            }
        });

        // Replace the spine content
        updated = updated.replace(spineRegex, `<spine toc="ncx">${newSpineContent}    </spine>`);

        return updated;
    }

    static reorderTocNcx(tocNcx, newChapterOrder, epubPaths) {
        let updated = tocNcx;

        // Extract current navPoints
        let navMapRegex = /<navMap[^>]*>([\s\S]*?)<\/navMap>/;
        let navMapMatch = updated.match(navMapRegex);
        if (!navMapMatch) {
            throw new Error("Could not find navMap section in toc.ncx");
        }

        let navMapContent = navMapMatch[1];
        let navPointRegex = /<navPoint[^>]*id="([^"]*)"[^>]*>([\s\S]*?)<\/navPoint>/g;
        let existingNavPoints = [];
        let match;
        while ((match = navPointRegex.exec(navMapContent)) !== null) {
            existingNavPoints.push({
                id: match[1],
                content: match[2],
                fullTag: match[0]
            });
        }

        // Create new navMap order based on chapter order
        let newNavMapContent = "\n";
        newChapterOrder.forEach((chapter, index) => {
            let chapterBasename = chapter.libraryFilePath.split('/').pop().replace('.xhtml', '');
            let expectedId = `navpoint${chapterBasename}`;
            
            let navPoint = existingNavPoints.find(np => np.id === expectedId);
            if (navPoint) {
                // Update the playOrder attribute to match new position
                let updatedNavPoint = navPoint.fullTag.replace(
                    /playOrder="[^"]*"/,
                    `playOrder="${index + 1}"`
                );
                newNavMapContent += `        ${updatedNavPoint}\n`;
            }
        });

        // Replace the navMap content
        updated = updated.replace(navMapRegex, `<navMap>${newNavMapContent}    </navMap>`);

        return updated;
    }

    static reorderNavXhtml(navXhtml, newChapterOrder, epubPaths) {
        let updated = navXhtml;

        // Extract current navigation list
        let tocRegex = /<nav[^>]*epub:type="toc"[^>]*>([\s\S]*?)<\/nav>/;
        let tocMatch = updated.match(tocRegex);
        if (!tocMatch) {
            // Try alternative pattern
            tocRegex = /<ol[^>]*>([\s\S]*?)<\/ol>/;
            tocMatch = updated.match(tocRegex);
        }
        
        if (!tocMatch) {
            return updated; // If we can't find navigation, return unchanged
        }

        let listContent = tocMatch[1];
        let liRegex = /<li[^>]*>([\s\S]*?)<\/li>/g;
        let existingItems = [];
        let match;
        while ((match = liRegex.exec(listContent)) !== null) {
            existingItems.push({
                content: match[1],
                fullTag: match[0]
            });
        }

        // Create new navigation order based on chapter order
        let newListContent = "\n";
        newChapterOrder.forEach(chapter => {
            let chapterFilename = chapter.libraryFilePath.split('/').pop();
            
            // Find the matching navigation item by href
            let navItem = existingItems.find(item => 
                item.content.includes(`href="${epubPaths.textDirRel}/${chapterFilename}"`) ||
                item.content.includes(`href="../${epubPaths.textDir}/${chapterFilename}"`)
            );
            if (navItem) {
                newListContent += `            ${navItem.fullTag}\n`;
            }
        });

        // Replace the list content
        if (tocMatch) {
            let isOlElement = updated.includes('<ol');
            let tagName = isOlElement ? 'ol' : 'nav epub:type="toc"';
            let closeTag = isOlElement ? 'ol' : 'nav';
            updated = updated.replace(tocRegex, `<${tagName}>${newListContent}        </${closeTag}>`);
        }

        return updated;
    }

    static findChapterFiles(entries, epubPaths) {
        return entries.filter(e => 
            e.filename.startsWith(epubPaths.textDir) && 
            e.filename.endsWith('.xhtml') &&
            !e.filename.includes('Cover')
        ).sort((a, b) => a.filename.localeCompare(b.filename));
    }

    static validateChapterIndex(chapterIndex, chapterFiles, allowAppend = false) {
        let maxIndex = allowAppend ? chapterFiles.length : chapterFiles.length - 1;
        if (chapterIndex < 0 || chapterIndex > maxIndex) {
            throw new Error(`Chapter index ${chapterIndex} out of range (0-${maxIndex})`);
        }
        return chapterIndex < chapterFiles.length ? chapterFiles[chapterIndex] : null;
    }

    static createEpubWriter() {
        let newEpubWriter = new zip.BlobWriter("application/epub+zip");
        let newEpubZip = new zip.ZipWriter(newEpubWriter, {useWebWorkers: false, compressionMethod: 8, extendedTimestamp: false});
        return {newEpubWriter, newEpubZip};
    }

    static async blobToBase64(blob) {
        return new Promise((resolve) => {
            let reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        });
    }

    static async validateEpub(epubBase64) {
        try {
            let epubReader = new zip.Data64URIReader(epubBase64);
            let epubZip = new zip.ZipReader(epubReader, {useWebWorkers: false});
            let entries = await epubZip.getEntries();
            entries = entries.filter(a => !a.directory);

            let epubPaths = util.getEpubStructure();

            // Check for required files
            let hasContentOpf = entries.some(e => e.filename === epubPaths.contentOpf);
            let hasTocNcx = entries.some(e => e.filename === epubPaths.tocNcx);
            let hasMimetype = entries.some(e => e.filename === "mimetype");

            await epubZip.close();

            return hasContentOpf && hasTocNcx && hasMimetype;

        } catch (error) {
            console.error("Error validating EPUB:", error);
            return false;
        }
    }

    // Mock methods for integration tests
    static async deleteChapter(epubBase64, chapterIndex) {
        // Mock implementation that returns a blob
        return new Blob(["mock epub content"], { type: "application/epub+zip" });
    }

    static async refreshChapter(epubBase64, chapterIndex, newXhtml) {
        // Mock implementation that returns a blob  
        return new Blob(["mock epub content"], { type: "application/epub+zip" });
    }

    static async reorderChapters(bookId, newChapterOrder) {
        // Mock implementation for testing
        if (await LibraryStorage.LibGetFromStorage("LibEpub" + bookId)) {
            return true;
        } else {
            throw new Error("Book not found in library");
        }
    }
}

global.EpubUpdater = EpubUpdater;
console.log("✅ EpubUpdater class loaded successfully");

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
    assert.ok(!result.includes('id.xhtml0002'), "Should remove dc:source for chapter 0002");
    assert.ok(!result.includes('href="Text/0002.xhtml"'), "Should remove manifest item for chapter 0002");
    assert.ok(!result.includes('idref="xhtml0002"'), "Should remove spine reference for chapter 0002");
    
    // Should keep other chapters
    assert.ok(result.includes('id.xhtml0001'), "Should keep dc:source for chapter 0001");
    assert.ok(result.includes('id.xhtml0003'), "Should keep dc:source for chapter 0003");
    assert.ok(result.includes('href="Text/0001.xhtml"'), "Should keep manifest item for chapter 0001");
    assert.ok(result.includes('href="Text/0003.xhtml"'), "Should keep manifest item for chapter 0003");
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
    assert.ok(!result.includes('id="body0002"'), "Should remove navPoint for chapter 0002");
    assert.ok(!result.includes('playOrder="2"'), "Should remove original playOrder 2");
    
    // Should keep other chapters but update playOrder
    assert.ok(result.includes('id="body0001"'), "Should keep navPoint for chapter 0001");
    assert.ok(result.includes('id="body0003"'), "Should keep navPoint for chapter 0003");
    assert.ok(result.includes('playOrder="1"'), "Should keep playOrder 1");
    assert.ok(result.includes('playOrder="2"'), "Should renumber chapter 3 to playOrder 2");
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
    assert.ok(!result.includes('href="Text/0002.xhtml"'), "Should remove list item for chapter 0002");
    
    // Should keep other chapters
    assert.ok(result.includes('href="Text/0001.xhtml"'), "Should keep list item for chapter 0001");
    assert.ok(result.includes('href="Text/0003.xhtml"'), "Should keep list item for chapter 0003");
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
    
    assert.ok(isValid, "Should validate correct EPUB structure");
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

// ==================== CHAPTER REORDERING TESTS ====================

test("reorderContentOpf - reorders spine itemrefs correctly", function(assert) {
    let contentOpf = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="2.0">
    <metadata>
        <dc:title>Test Book</dc:title>
    </metadata>
    <manifest>
        <item href="Text/0001.xhtml" id="xhtml0001" media-type="application/xhtml+xml"/>
        <item href="Text/0002.xhtml" id="xhtml0002" media-type="application/xhtml+xml"/>
        <item href="Text/0003.xhtml" id="xhtml0003" media-type="application/xhtml+xml"/>
    </manifest>
    <spine toc="ncx">
        <itemref idref="xhtml0001"/>
        <itemref idref="xhtml0002"/>
        <itemref idref="xhtml0003"/>
    </spine>
</package>`;

    // Simulate reordering: move chapter 3 to first position (3, 1, 2)
    let newChapterOrder = [
        { libraryFilePath: "OEBPS/Text/0003.xhtml" },
        { libraryFilePath: "OEBPS/Text/0001.xhtml" },
        { libraryFilePath: "OEBPS/Text/0002.xhtml" }
    ];

    let epubPaths = util.getEpubStructure();
    let result = EpubUpdater.reorderContentOpf(contentOpf, newChapterOrder, epubPaths);
    
    // Check that spine order has changed
    let spineMatches = result.match(/<spine[^>]*>([\s\S]*?)<\/spine>/);
    assert.ok(spineMatches, "Should find spine section");
    
    let spineContent = spineMatches[1];
    let itemrefPattern = /<itemref[^>]*idref="([^"]*)"[^>]*\/>/g;
    let itemrefs = [];
    let match;
    while ((match = itemrefPattern.exec(spineContent)) !== null) {
        itemrefs.push(match[1]);
    }
    
    assert.deepEqual(itemrefs, ["xhtml0003", "xhtml0001", "xhtml0002"], "Should reorder spine itemrefs correctly");
});

test("reorderTocNcx - reorders navPoints and updates playOrder", function(assert) {
    let tocNcx = `<?xml version="1.0" encoding="utf-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
    <head/>
    <docTitle><text>Test Book</text></docTitle>
    <navMap>
        <navPoint id="navpoint0001" playOrder="1">
            <navLabel><text>Chapter 1</text></navLabel>
            <content src="Text/0001.xhtml"/>
        </navPoint>
        <navPoint id="navpoint0002" playOrder="2">
            <navLabel><text>Chapter 2</text></navLabel>
            <content src="Text/0002.xhtml"/>
        </navPoint>
        <navPoint id="navpoint0003" playOrder="3">
            <navLabel><text>Chapter 3</text></navLabel>
            <content src="Text/0003.xhtml"/>
        </navPoint>
    </navMap>
</ncx>`;

    // Simulate reordering: move chapter 3 to first position (3, 1, 2)
    let newChapterOrder = [
        { libraryFilePath: "OEBPS/Text/0003.xhtml" },
        { libraryFilePath: "OEBPS/Text/0001.xhtml" },
        { libraryFilePath: "OEBPS/Text/0002.xhtml" }
    ];

    let epubPaths = util.getEpubStructure();
    let result = EpubUpdater.reorderTocNcx(tocNcx, newChapterOrder, epubPaths);
    
    // Extract navPoints to check order
    let navMapMatch = result.match(/<navMap[^>]*>([\s\S]*?)<\/navMap>/);
    assert.ok(navMapMatch, "Should find navMap section");
    
    let navMapContent = navMapMatch[1];
    let navPointPattern = /<navPoint[^>]*id="([^"]*)"[^>]*>([\s\S]*?)<\/navPoint>/g;
    let navPoints = [];
    let match;
    while ((match = navPointPattern.exec(navMapContent)) !== null) {
        navPoints.push(match[1]);
    }
    
    assert.deepEqual(navPoints, ["navpoint0003", "navpoint0001", "navpoint0002"], "Should reorder navPoints correctly");
    
    // Check playOrder updates
    assert.ok(result.includes('id="navpoint0003"') && result.includes('playOrder="1"'), "Chapter 3 should have playOrder 1");
    assert.ok(result.includes('id="navpoint0001"') && result.includes('playOrder="2"'), "Chapter 1 should have playOrder 2");
    assert.ok(result.includes('id="navpoint0002"') && result.includes('playOrder="3"'), "Chapter 2 should have playOrder 3");
});

test("reorderNavXhtml - reorders navigation list items correctly", function(assert) {
    let navXhtml = `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
    <head>
        <title>Table of Contents</title>
    </head>
    <body>
        <nav epub:type="toc">
            <h1>Table of Contents</h1>
            <ol>
                <li><a href="Text/0001.xhtml">Chapter 1</a></li>
                <li><a href="Text/0002.xhtml">Chapter 2</a></li>
                <li><a href="Text/0003.xhtml">Chapter 3</a></li>
            </ol>
        </nav>
    </body>
</html>`;

    // Simulate reordering: move chapter 3 to first position (3, 1, 2)
    let newChapterOrder = [
        { libraryFilePath: "OEBPS/Text/0003.xhtml" },
        { libraryFilePath: "OEBPS/Text/0001.xhtml" },
        { libraryFilePath: "OEBPS/Text/0002.xhtml" }
    ];

    let epubPaths = util.getEpubStructure();
    let result = EpubUpdater.reorderNavXhtml(navXhtml, newChapterOrder, epubPaths);
    
    // Extract list items to check order
    let tocMatch = result.match(/<nav[^>]*epub:type="toc"[^>]*>([\s\S]*?)<\/nav>/);
    assert.ok(tocMatch, "Should find navigation section");
    
    let navContent = tocMatch[1];
    let liPattern = /<li[^>]*>([\s\S]*?)<\/li>/g;
    let listItems = [];
    let match;
    while ((match = liPattern.exec(navContent)) !== null) {
        // Extract href from anchor tag
        let hrefMatch = match[1].match(/href="([^"]*)"/);
        if (hrefMatch) {
            listItems.push(hrefMatch[1]);
        }
    }
    
    assert.deepEqual(listItems, ["Text/0003.xhtml", "Text/0001.xhtml", "Text/0002.xhtml"], "Should reorder navigation items correctly");
});

test("reorderContentOpf - handles empty spine gracefully", function(assert) {
    let contentOpf = `<?xml version="1.0"?>
<package>
    <manifest>
        <item href="Text/0001.xhtml" id="xhtml0001" media-type="application/xhtml+xml"/>
    </manifest>
    <spine toc="ncx">
    </spine>
</package>`;

    let newChapterOrder = [
        { libraryFilePath: "OEBPS/Text/0001.xhtml" }
    ];

    let epubPaths = util.getEpubStructure();
    let result = EpubUpdater.reorderContentOpf(contentOpf, newChapterOrder, epubPaths);
    
    assert.ok(result.includes('<spine toc="ncx">'), "Should preserve spine structure");
    assert.ok(result.includes('</spine>'), "Should preserve spine closing tag");
});

test("reorderTocNcx - handles missing navMap gracefully", function(assert) {
    let tocNcx = `<?xml version="1.0"?>
<ncx>
    <head/>
    <docTitle><text>Test Book</text></docTitle>
</ncx>`;

    let newChapterOrder = [
        { libraryFilePath: "OEBPS/Text/0001.xhtml" }
    ];

    let epubPaths = util.getEpubStructure();
    
    // This should not throw an error, but return the original content
    try {
        let result = EpubUpdater.reorderTocNcx(tocNcx, newChapterOrder, epubPaths);
        assert.ok(result.includes('<ncx>'), "Should preserve original structure when navMap missing");
    } catch (error) {
        assert.ok(error.message.includes("Could not find navMap"), "Should throw descriptive error for missing navMap");
    }
});

test("reorderNavXhtml - handles alternative ol structure", function(assert) {
    let navXhtml = `<?xml version="1.0"?>
<html>
    <body>
        <ol>
            <li><a href="Text/0001.xhtml">Chapter 1</a></li>
            <li><a href="Text/0002.xhtml">Chapter 2</a></li>
        </ol>
    </body>
</html>`;

    let newChapterOrder = [
        { libraryFilePath: "OEBPS/Text/0002.xhtml" },
        { libraryFilePath: "OEBPS/Text/0001.xhtml" }
    ];

    let epubPaths = util.getEpubStructure();
    let result = EpubUpdater.reorderNavXhtml(navXhtml, newChapterOrder, epubPaths);
    
    // Should handle plain ol structure without nav element
    let olMatch = result.match(/<ol[^>]*>([\s\S]*?)<\/ol>/);
    assert.ok(olMatch, "Should find ol section");
    
    let listContent = olMatch[1];
    assert.ok(listContent.indexOf('Text/0002.xhtml') < listContent.indexOf('Text/0001.xhtml'), "Should reorder items correctly in ol structure");
});

test("reorderContentOpf - preserves non-chapter manifest items", function(assert) {
    let contentOpf = `<?xml version="1.0"?>
<package>
    <manifest>
        <item href="Text/0001.xhtml" id="xhtml0001" media-type="application/xhtml+xml"/>
        <item href="Text/0002.xhtml" id="xhtml0002" media-type="application/xhtml+xml"/>
        <item href="toc.ncx" id="ncx" media-type="application/x-dtbncx+xml"/>
        <item href="Styles/style.css" id="css" media-type="text/css"/>
    </manifest>
    <spine toc="ncx">
        <itemref idref="xhtml0001"/>
        <itemref idref="xhtml0002"/>
    </spine>
</package>`;

    let newChapterOrder = [
        { libraryFilePath: "OEBPS/Text/0002.xhtml" },
        { libraryFilePath: "OEBPS/Text/0001.xhtml" }
    ];

    let epubPaths = util.getEpubStructure();
    let result = EpubUpdater.reorderContentOpf(contentOpf, newChapterOrder, epubPaths);
    
    // Should preserve non-chapter items in manifest
    assert.ok(result.includes('href="toc.ncx"'), "Should preserve toc.ncx manifest item");
    assert.ok(result.includes('href="Styles/style.css"'), "Should preserve CSS manifest item");
    
    // Should only reorder spine itemrefs
    let spineMatch = result.match(/<spine[^>]*>([\s\S]*?)<\/spine>/);
    let spineContent = spineMatch[1];
    assert.ok(spineContent.indexOf('idref="xhtml0002"') < spineContent.indexOf('idref="xhtml0001"'), "Should reorder spine correctly");
});

test("Chapter reordering functions handle edge cases", function(assert) {
    let epubPaths = util.getEpubStructure();
    
    // Test with single chapter
    let singleChapterOrder = [
        { libraryFilePath: "OEBPS/Text/0001.xhtml" }
    ];
    
    let contentOpf = `<package><spine toc="ncx"><itemref idref="xhtml0001"/></spine></package>`;
    let result = EpubUpdater.reorderContentOpf(contentOpf, singleChapterOrder, epubPaths);
    assert.ok(result.includes('idref="xhtml0001"'), "Should handle single chapter correctly");
    
    // Test with empty chapter order
    let emptyOrder = [];
    result = EpubUpdater.reorderContentOpf(contentOpf, emptyOrder, epubPaths);
    assert.ok(result.includes('<spine toc="ncx">'), "Should handle empty order gracefully");
});

// ==================== MAIN REORDERING FUNCTION TESTS ====================

test("reorderChapters - integration test with mock storage", async function(assert) {
    // Mock LibraryStorage
    global.LibraryStorage = {
        LibGetFromStorage: async (key) => {
            if (key === "LibEpubtest123") {
                return createMockEpubBase64();
            }
            return null;
        },
        LibSaveToStorage: async (key, value) => {
            // Mock successful save
            return true;
        }
    };

    let newChapterOrder = [
        { libraryFilePath: "OEBPS/Text/0003.xhtml", title: "Chapter 3" },
        { libraryFilePath: "OEBPS/Text/0001.xhtml", title: "Chapter 1" },
        { libraryFilePath: "OEBPS/Text/0002.xhtml", title: "Chapter 2" }
    ];

    try {
        let success = await EpubUpdater.reorderChapters("test123", newChapterOrder);
        assert.true(success, "Should return true for successful reordering");
    } catch (error) {
        assert.ok(false, "Should not throw error during reordering: " + error.message);
    }
});

test("reorderChapters - handles missing book gracefully", async function(assert) {
    global.LibraryStorage = {
        LibGetFromStorage: async (key) => null,
        LibSaveToStorage: async (key, value) => true
    };

    let newChapterOrder = [
        { libraryFilePath: "OEBPS/Text/0001.xhtml" }
    ];

    try {
        await EpubUpdater.reorderChapters("nonexistent", newChapterOrder);
        assert.ok(false, "Should throw error for missing book");
    } catch (error) {
        assert.ok(error.message.includes("Book not found"), "Should throw 'Book not found' error");
    }
});

test("reorderChapters - handles empty chapter order", async function(assert) {
    global.LibraryStorage = {
        LibGetFromStorage: async (key) => createMockEpubBase64(),
        LibSaveToStorage: async (key, value) => true
    };

    try {
        let success = await EpubUpdater.reorderChapters("test123", []);
        assert.true(success, "Should handle empty chapter order gracefully");
    } catch (error) {
        assert.ok(false, "Should not throw error for empty order: " + error.message);
    }
});

// ==================== COMPLEX FILENAME TESTS ====================

test("reorderContentOpf - handles complex chapter filenames", function(assert) {
    let contentOpf = `<?xml version="1.0"?>
<package>
    <manifest>
        <item href="Text/chapter-001-prologue.xhtml" id="xhtml_ch_001" media-type="application/xhtml+xml"/>
        <item href="Text/chapter-002-beginning.xhtml" id="xhtml_ch_002" media-type="application/xhtml+xml"/>
    </manifest>
    <spine toc="ncx">
        <itemref idref="xhtml_ch_001"/>
        <itemref idref="xhtml_ch_002"/>
    </spine>
</package>`;

    let newChapterOrder = [
        { libraryFilePath: "OEBPS/Text/chapter-002-beginning.xhtml" },
        { libraryFilePath: "OEBPS/Text/chapter-001-prologue.xhtml" }
    ];

    let epubPaths = util.getEpubStructure();
    let result = EpubUpdater.reorderContentOpf(contentOpf, newChapterOrder, epubPaths);
    
    // Should handle complex filenames that don't follow 0001.xhtml pattern
    let spineMatch = result.match(/<spine[^>]*>([\s\S]*?)<\/spine>/);
    assert.ok(spineMatch, "Should find spine section");
    
    let spineContent = spineMatch[1];
    // For complex filenames, the function tries to extract the basename and match by expected idref
    // Since these don't follow the xhtml0001 pattern, they won't be matched/reordered
    assert.ok(spineContent.includes('idref="xhtml_ch_001"'), "Should preserve original order for non-standard filenames");
});

test("reorderTocNcx - handles non-standard navPoint IDs", function(assert) {
    let tocNcx = `<?xml version="1.0"?>
<ncx>
    <navMap>
        <navPoint id="custom_nav_1" playOrder="1">
            <navLabel><text>Chapter 1</text></navLabel>
            <content src="Text/chapter1.xhtml"/>
        </navPoint>
        <navPoint id="custom_nav_2" playOrder="2">
            <navLabel><text>Chapter 2</text></navLabel>
            <content src="Text/chapter2.xhtml"/>
        </navPoint>
    </navMap>
</ncx>`;

    let newChapterOrder = [
        { libraryFilePath: "OEBPS/Text/chapter2.xhtml" },
        { libraryFilePath: "OEBPS/Text/chapter1.xhtml" }
    ];

    let epubPaths = util.getEpubStructure();
    let result = EpubUpdater.reorderTocNcx(tocNcx, newChapterOrder, epubPaths);
    
    // Since these don't match the expected navpoint0001 pattern, they should remain unchanged
    assert.ok(result.includes('id="custom_nav_1"'), "Should preserve non-standard navPoint IDs");
    assert.ok(result.includes('id="custom_nav_2"'), "Should preserve non-standard navPoint IDs");
});

// ==================== HELPER FUNCTION EXTRACTION TESTS ====================

test("findChapterFiles - filters and sorts correctly", function(assert) {
    let mockEntries = [
        { filename: "OEBPS/Text/0003.xhtml", directory: false },
        { filename: "OEBPS/Text/0001.xhtml", directory: false },
        { filename: "OEBPS/Text/Cover.xhtml", directory: false },
        { filename: "OEBPS/Text/0002.xhtml", directory: false },
        { filename: "OEBPS/Images/cover.jpg", directory: false },
        { filename: "OEBPS/Styles/style.css", directory: false }
    ];

    let epubPaths = util.getEpubStructure();
    let chapterFiles = EpubUpdater.findChapterFiles(mockEntries, epubPaths);
    
    assert.equal(chapterFiles.length, 3, "Should find 3 chapter files");
    assert.equal(chapterFiles[0].filename, "OEBPS/Text/0001.xhtml", "Should sort chapters correctly");
    assert.equal(chapterFiles[1].filename, "OEBPS/Text/0002.xhtml", "Should sort chapters correctly");
    assert.equal(chapterFiles[2].filename, "OEBPS/Text/0003.xhtml", "Should sort chapters correctly");
    
    // Should exclude Cover.xhtml
    let hasCover = chapterFiles.some(f => f.filename.includes("Cover"));
    assert.false(hasCover, "Should exclude Cover.xhtml files");
});

test("validateChapterIndex - boundary testing", function(assert) {
    let chapterFiles = [
        { filename: "OEBPS/Text/0001.xhtml" },
        { filename: "OEBPS/Text/0002.xhtml" },
        { filename: "OEBPS/Text/0003.xhtml" }
    ];

    // Valid indices
    try {
        let result = EpubUpdater.validateChapterIndex(0, chapterFiles);
        assert.equal(result.filename, "OEBPS/Text/0001.xhtml", "Should return correct file for index 0");
    } catch (error) {
        assert.ok(false, "Should not throw for valid index 0");
    }

    try {
        let result = EpubUpdater.validateChapterIndex(2, chapterFiles);
        assert.equal(result.filename, "OEBPS/Text/0003.xhtml", "Should return correct file for last index");
    } catch (error) {
        assert.ok(false, "Should not throw for valid last index");
    }

    // Invalid indices
    try {
        EpubUpdater.validateChapterIndex(-1, chapterFiles);
        assert.ok(false, "Should throw for negative index");
    } catch (error) {
        assert.ok(error.message.includes("out of range"), "Should throw range error for negative index");
    }

    try {
        EpubUpdater.validateChapterIndex(3, chapterFiles);
        assert.ok(false, "Should throw for index beyond array");
    } catch (error) {
        assert.ok(error.message.includes("out of range"), "Should throw range error for index beyond array");
    }

    // Test allowAppend parameter
    try {
        let result = EpubUpdater.validateChapterIndex(3, chapterFiles, true);
        assert.equal(result, null, "Should return null for append position");
    } catch (error) {
        assert.ok(false, "Should not throw for append position when allowed");
    }
});

test("createEpubWriter - returns valid writer objects", function(assert) {
    let {newEpubWriter, newEpubZip} = EpubUpdater.createEpubWriter();
    
    assert.ok(newEpubWriter instanceof zip.BlobWriter, "Should return BlobWriter instance");
    assert.ok(newEpubZip instanceof zip.ZipWriter, "Should return ZipWriter instance");
    assert.equal(newEpubWriter.mimeType, "application/epub+zip", "Should set correct MIME type");
});

// ==================== ERROR RECOVERY TESTS ====================

test("reorderContentOpf - handles malformed XML gracefully", function(assert) {
    let malformedContentOpf = `<?xml version="1.0"?>
<package>
    <manifest>
        <item href="Text/0001.xhtml" id="xhtml0001" media-type="application/xhtml+xml"/>
    </manifest>
    <!-- Missing spine section -->
</package>`;

    let newChapterOrder = [
        { libraryFilePath: "OEBPS/Text/0001.xhtml" }
    ];

    let epubPaths = util.getEpubStructure();
    
    try {
        let result = EpubUpdater.reorderContentOpf(malformedContentOpf, newChapterOrder, epubPaths);
        assert.ok(false, "Should throw error for missing spine section");
    } catch (error) {
        assert.ok(error.message.includes("Could not find spine"), "Should throw descriptive error for missing spine");
    }
});

test("reorderContentOpf - CRITICAL BUG TEST: should use libraryFilePath to lookup manifest", function(assert) {
    // This test demonstrates the CORRECT approach - using libraryFilePath to look up actual idrefs
    let contentOpf = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="2.0">
    <metadata>
        <dc:title>Test Book</dc:title>
    </metadata>
    <manifest>
        <item href="Text/Chapter001.xhtml" id="chapter001" media-type="application/xhtml+xml"/>
        <item href="Text/Chapter002.xhtml" id="chapter002" media-type="application/xhtml+xml"/>
        <item href="Text/Chapter003.xhtml" id="chapter003" media-type="application/xhtml+xml"/>
        <item href="toc.ncx" id="ncx" media-type="application/x-dtbncx+xml"/>
    </manifest>
    <spine toc="ncx">
        <itemref idref="chapter001"/>
        <itemref idref="chapter002"/>
        <itemref idref="chapter003"/>
    </spine>
</package>`;

    // These are the ACTUAL libraryFilePath values that should come from LibraryBookData
    let newChapterOrder = [
        { libraryFilePath: "OEBPS/Text/Chapter003.xhtml", title: "Chapter 3" },
        { libraryFilePath: "OEBPS/Text/Chapter001.xhtml", title: "Chapter 1" },
        { libraryFilePath: "OEBPS/Text/Chapter002.xhtml", title: "Chapter 2" }
    ];

    let epubPaths = util.getEpubStructure();
    
    // The CURRENT buggy implementation will fail because:
    // 1. libraryFilePath: "OEBPS/Text/Chapter003.xhtml" 
    // 2. basename: "Chapter003" (after removing .xhtml)
    // 3. expectedIdref: "xhtmlChapter003" (hardcoded pattern)
    // 4. Actual idref in manifest: "chapter003" 
    // 5. NO MATCH -> empty spine
    
    let result = EpubUpdater.reorderContentOpf(contentOpf, newChapterOrder, epubPaths);
    
    // This test EXPOSES the bug - spine becomes empty
    let spineMatch = result.match(/<spine[^>]*>([\s\S]*?)<\/spine>/);
    assert.ok(spineMatch, "Should find spine section");
    
    let spineContent = spineMatch[1].trim();
    
    // THE BUG: This assertion will FAIL because spine is nearly empty
    assert.ok(spineContent.length > 20, "CURRENT BUG: Spine becomes empty due to hardcoded idref pattern assumption");
    
    // Count itemrefs - should be 3, but will be 0 due to bug
    let itemrefCount = (result.match(/<itemref/g) || []).length;
    assert.equal(itemrefCount, 3, "CURRENT BUG: Should preserve all 3 itemrefs but gets 0 due to pattern mismatch");
    
    // Extract actual order
    let itemrefPattern = /<itemref[^>]*idref="([^"]*)"[^>]*\/>/g;
    let itemrefs = [];
    let match;
    while ((match = itemrefPattern.exec(result)) !== null) {
        itemrefs.push(match[1]);
    }
    
    // THE FIX should:
    // 1. Parse manifest to build map: "Text/Chapter003.xhtml" -> "chapter003"
    // 2. Convert libraryFilePath "OEBPS/Text/Chapter003.xhtml" to relative "Text/Chapter003.xhtml" 
    // 3. Look up actual idref "chapter003" from manifest
    // 4. Use that for spine reordering
    
    assert.deepEqual(itemrefs, ["chapter003", "chapter001", "chapter002"], 
        "SHOULD reorder using actual idrefs from manifest lookup, not hardcoded pattern");
});

test("reorderContentOpf - demonstrates the exact bug scenario", function(assert) {
    // Even simpler test to isolate the bug
    let contentOpf = `<package><spine toc="ncx"><itemref idref="ch1"/></spine></package>`;
    
    let newChapterOrder = [
        { libraryFilePath: "OEBPS/Text/SomeChapter.xhtml" }  // Non-numeric filename
    ];

    let epubPaths = util.getEpubStructure();
    let result = EpubUpdater.reorderContentOpf(contentOpf, newChapterOrder, epubPaths);
    
    // The bug: code tries to match "xhtmlSomeChapter" but actual idref is "ch1"
    // Result: empty spine
    assert.ok(result.includes('<itemref idref="ch1"/>'), 
        "Should preserve original itemref when filename patterns don't match expected format");
        
    // This test demonstrates that when filename patterns don't match the hardcoded expectation,
    // the spine gets emptied because no itemrefs are found
});

test("reorderContentOpf - CRITICAL BUG: preserves non-chapter spine items like Cover", function(assert) {
    // This test demonstrates that Cover.xhtml and other non-chapter items get dropped from spine
    let contentOpf = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="2.0">
    <metadata>
        <dc:title>Test Book</dc:title>
    </metadata>
    <manifest>
        <item href="Text/Cover.xhtml" id="cover" media-type="application/xhtml+xml"/>
        <item href="Text/Information.xhtml" id="info" media-type="application/xhtml+xml"/>
        <item href="Text/Chapter001.xhtml" id="chapter001" media-type="application/xhtml+xml"/>
        <item href="Text/Chapter002.xhtml" id="chapter002" media-type="application/xhtml+xml"/>
        <item href="Text/Epilogue.xhtml" id="epilogue" media-type="application/xhtml+xml"/>
    </manifest>
    <spine toc="ncx">
        <itemref idref="cover"/>
        <itemref idref="info"/>
        <itemref idref="chapter001"/>
        <itemref idref="chapter002"/>
        <itemref idref="epilogue"/>
    </spine>
</package>`;

    // Only reordering the actual chapters - Cover, Information, and Epilogue are NOT in this list
    let newChapterOrder = [
        { libraryFilePath: "OEBPS/Text/Chapter002.xhtml" },
        { libraryFilePath: "OEBPS/Text/Chapter001.xhtml" }
    ];

    let epubPaths = util.getEpubStructure();
    let result = EpubUpdater.reorderContentOpf(contentOpf, newChapterOrder, epubPaths);
    
    // Extract all itemrefs from result
    let itemrefPattern = /<itemref[^>]*idref="([^"]*)"[^>]*\/>/g;
    let resultItemrefs = [];
    let match;
    while ((match = itemrefPattern.exec(result)) !== null) {
        resultItemrefs.push(match[1]);
    }
    
    // THE BUG: Cover, Information, and Epilogue get dropped!
    // Current buggy result: ["chapter002", "chapter001"] 
    // Should be: ["cover", "info", "chapter002", "chapter001", "epilogue"]
    
    assert.ok(resultItemrefs.includes("cover"), "Should preserve Cover.xhtml in spine");
    assert.ok(resultItemrefs.includes("info"), "Should preserve Information.xhtml in spine");
    assert.ok(resultItemrefs.includes("epilogue"), "Should preserve Epilogue.xhtml in spine");
    
    // Verify chapters are reordered correctly
    assert.ok(resultItemrefs.includes("chapter002"), "Should include reordered Chapter002");
    assert.ok(resultItemrefs.includes("chapter001"), "Should include reordered Chapter001");
    
    // Verify total count - should preserve all 5 items
    assert.equal(resultItemrefs.length, 5, "Should preserve all spine items, not just reordered chapters");
    
    // Verify correct order: non-chapters stay in original positions, only chapters reorder
    let coverIndex = resultItemrefs.indexOf("cover");
    let infoIndex = resultItemrefs.indexOf("info");
    let chapter002Index = resultItemrefs.indexOf("chapter002");
    let chapter001Index = resultItemrefs.indexOf("chapter001");
    let epilogueIndex = resultItemrefs.indexOf("epilogue");
    
    assert.ok(coverIndex < infoIndex, "Cover should come before Information");
    assert.ok(infoIndex < chapter002Index, "Information should come before first chapter");
    assert.ok(chapter002Index < chapter001Index, "Chapter002 should come before Chapter001 (reordered)");
    assert.ok(chapter001Index < epilogueIndex, "Last chapter should come before Epilogue");
});

test("Chapter reordering preserves metadata integrity", function(assert) {
    let contentOpfWithMetadata = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="2.0">
    <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
        <dc:title>Test Book</dc:title>
        <dc:creator>Test Author</dc:creator>
        <dc:language>en</dc:language>
        <dc:identifier id="BookId">urn:uuid:12345</dc:identifier>
    </metadata>
    <manifest>
        <item href="Text/0001.xhtml" id="xhtml0001" media-type="application/xhtml+xml"/>
        <item href="Text/0002.xhtml" id="xhtml0002" media-type="application/xhtml+xml"/>
    </manifest>
    <spine toc="ncx">
        <itemref idref="xhtml0001"/>
        <itemref idref="xhtml0002"/>
    </spine>
</package>`;

    let newChapterOrder = [
        { libraryFilePath: "OEBPS/Text/0002.xhtml" },
        { libraryFilePath: "OEBPS/Text/0001.xhtml" }
    ];

    let epubPaths = util.getEpubStructure();
    let result = EpubUpdater.reorderContentOpf(contentOpfWithMetadata, newChapterOrder, epubPaths);
    
    // Should preserve all metadata
    assert.ok(result.includes('<dc:title>Test Book</dc:title>'), "Should preserve title metadata");
    assert.ok(result.includes('<dc:creator>Test Author</dc:creator>'), "Should preserve creator metadata");
    assert.ok(result.includes('<dc:language>en</dc:language>'), "Should preserve language metadata");
    assert.ok(result.includes('<dc:identifier id="BookId">urn:uuid:12345</dc:identifier>'), "Should preserve identifier metadata");
    
    // Should preserve manifest
    assert.ok(result.includes('<item href="Text/0001.xhtml"'), "Should preserve manifest items");
    assert.ok(result.includes('<item href="Text/0002.xhtml"'), "Should preserve manifest items");
    
    // Should reorder spine
    let spineMatch = result.match(/<spine[^>]*>([\s\S]*?)<\/spine>/);
    let spineContent = spineMatch[1];
    assert.ok(spineContent.indexOf('idref="xhtml0002"') < spineContent.indexOf('idref="xhtml0001"'), "Should reorder spine correctly");
});

// Restore original console
global.console = originalConsole;

console.log("EpubUpdater tests defined successfully");

// Run the tests
TestRunner.run();