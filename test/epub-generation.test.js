#!/usr/bin/env node

/**
 * Tests for EPUB generation correctness
 * Validates that EPUBs are created with proper structure and content
 */

require('./node-setup');
require('./test-framework');

// Load required modules
const fs = require('fs');
const path = require('path');

// Load dependencies
const utilPath = path.join(__dirname, '../plugin/js/Util.js');
eval(fs.readFileSync(utilPath, 'utf8').replace('const util =', 'global.util ='));

const epubStructurePath = path.join(__dirname, '../plugin/js/EpubStructure.js');
const epubStructureCode = fs.readFileSync(epubStructurePath, 'utf8');
global.main = { getUserPreferences: () => null };
global.LibraryStorage = {};
global.chrome = { storage: { local: { set: () => {} } } };
global.zip = {};
eval(epubStructureCode.replace('class EpubStructure', 'global.EpubStructure = class EpubStructure'));

// Mock EpubMetaInfo
global.EpubMetaInfo = class EpubMetaInfo {
    constructor() {
        this.uuid = 'test-uuid-12345';
        this.title = 'Test Story';
        this.author = 'Test Author';
        this.language = 'en';
        this.fileName = 'test-story';
        this.seriesName = '';
        this.seriesIndex = '';
    }
    
    getFileName() {
        return this.fileName;
    }
};

// Mock EpubItem
global.EpubItem = class EpubItem {
    constructor(item) {
        Object.assign(this, item);
    }
    
    static makeHtmlElement(content) {
        const dom = TestUtils.makeDomWithBody('');
        dom.documentElement.innerHTML = content;
        return dom.documentElement;
    }
};

// Load EpubPacker
const epubPackerPath = path.join(__dirname, '../plugin/js/EpubPacker.js');
const epubPackerCode = fs.readFileSync(epubPackerPath, 'utf8');
eval(epubPackerCode);

testModule("EPUB Structure Generation");

test("generates correct OEBPS structure", function(assert) {
    const metaInfo = new EpubMetaInfo();
    const structure = EpubStructure.get("OEBPS");
    
    assert.equal(structure.contentDir, "OEBPS", "Content directory should be OEBPS");
    assert.equal(structure.textDir, "OEBPS/Text", "Text directory should be OEBPS/Text");
    assert.equal(structure.imagesDir, "OEBPS/Images", "Images directory should be OEBPS/Images");
    assert.equal(structure.stylesDir, "OEBPS/Styles", "Styles directory should be OEBPS/Styles");
    assert.equal(structure.contentOpf, "OEBPS/content.opf", "Content.opf should be in OEBPS");
    assert.equal(structure.tocNcx, "OEBPS/toc.ncx", "toc.ncx should be in OEBPS");
});

test("generates correct EPUB structure", function(assert) {
    const structure = EpubStructure.get("EPUB");
    
    assert.equal(structure.contentDir, "EPUB", "Content directory should be EPUB");
    assert.equal(structure.textDir, "EPUB/text", "Text directory should be EPUB/text");
    assert.equal(structure.imagesDir, "EPUB/images", "Images directory should be EPUB/images");
    assert.equal(structure.stylesDir, "EPUB/styles", "Styles directory should be EPUB/styles");
    assert.equal(structure.contentOpf, "EPUB/content.opf", "Content.opf should be in EPUB");
    assert.equal(structure.tocNcx, "EPUB/toc.ncx", "toc.ncx should be in EPUB");
});

testModule("EPUB Content Generation");

test("creates valid container.xml", function(assert) {
    const packer = new EpubPacker(new EpubMetaInfo());
    const structure = EpubStructure.get("OEBPS");
    
    const containerXml = packer.buildContainerXml(structure);
    
    assert.ok(containerXml.includes('<?xml version="1.0"'), "Should include XML declaration");
    assert.ok(containerXml.includes('<container version="1.0"'), "Should include container element");
    assert.ok(containerXml.includes('OEBPS/content.opf'), "Should reference correct content.opf path");
    assert.ok(containerXml.includes('application/oebps-package+xml'), "Should have correct media type");
});

test("creates valid content.opf with manifest", function(assert) {
    const packer = new EpubPacker(new EpubMetaInfo());
    const structure = EpubStructure.get("OEBPS");
    
    // Create sample EPUB items
    const epubItems = [
        new EpubItem({
            id: "xhtml0001",
            href: "Text/0001_Chapter1.xhtml",
            mediaType: "application/xhtml+xml",
            content: "<html><head><title>Chapter 1</title></head><body><h1>Chapter 1</h1><p>Content</p></body></html>"
        }),
        new EpubItem({
            id: "xhtml0002", 
            href: "Text/0002_Chapter2.xhtml",
            mediaType: "application/xhtml+xml",
            content: "<html><head><title>Chapter 2</title></head><body><h1>Chapter 2</h1><p>More content</p></body></html>"
        })
    ];
    
    const contentOpf = packer.buildContentOpf(epubItems, structure, []);
    
    assert.ok(contentOpf.includes('<?xml version="1.0"'), "Should include XML declaration");
    assert.ok(contentOpf.includes('<package xmlns="http://www.idpf.org/2007/opf"'), "Should include package element");
    assert.ok(contentOpf.includes('<dc:title>Test Story</dc:title>'), "Should include story title");
    assert.ok(contentOpf.includes('<dc:creator>Test Author</dc:creator>'), "Should include author");
    assert.ok(contentOpf.includes('<item href="Text/0001_Chapter1.xhtml"'), "Should include first chapter in manifest");
    assert.ok(contentOpf.includes('<item href="Text/0002_Chapter2.xhtml"'), "Should include second chapter in manifest");
    assert.ok(contentOpf.includes('<itemref idref="xhtml0001"'), "Should include first chapter in spine");
    assert.ok(contentOpf.includes('<itemref idref="xhtml0002"'), "Should include second chapter in spine");
});

test("creates valid toc.ncx navigation", function(assert) {
    const packer = new EpubPacker(new EpubMetaInfo());
    const structure = EpubStructure.get("OEBPS");
    
    const epubItems = [
        new EpubItem({
            id: "xhtml0001",
            href: "Text/0001_Chapter1.xhtml",
            title: "Chapter 1: The Beginning"
        }),
        new EpubItem({
            id: "xhtml0002",
            href: "Text/0002_Chapter2.xhtml", 
            title: "Chapter 2: The Journey"
        })
    ];
    
    const tocNcx = packer.buildTocNcx(epubItems, structure);
    
    assert.ok(tocNcx.includes('<?xml version="1.0"'), "Should include XML declaration");
    assert.ok(tocNcx.includes('<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/"'), "Should include NCX namespace");
    assert.ok(tocNcx.includes('<docTitle><text>Test Story</text></docTitle>'), "Should include document title");
    assert.ok(tocNcx.includes('Chapter 1: The Beginning'), "Should include first chapter title");
    assert.ok(tocNcx.includes('Chapter 2: The Journey'), "Should include second chapter title");
    assert.ok(tocNcx.includes('playOrder="1"'), "Should include correct play order");
    assert.ok(tocNcx.includes('src="Text/0001_Chapter1.xhtml"'), "Should reference correct chapter files");
});

testModule("EPUB File Path Generation");

test("generates correct file paths for chapters", function(assert) {
    const structure = EpubStructure.get("OEBPS");
    
    const fileName1 = util.makeStorageFileName(structure.textDir + "/", 1, "Chapter 1", "xhtml");
    const fileName2 = util.makeStorageFileName(structure.textDir + "/", 2, "Chapter 2: The Adventure", "xhtml");
    
    assert.equal(fileName1, "OEBPS/Text/0001_Chapter_1.xhtml", "Should generate correct path for simple title");
    assert.equal(fileName2, "OEBPS/Text/0002_Chapter_2_The_Adventure.xhtml", "Should generate correct path for complex title");
});

test("handles special characters in chapter titles", function(assert) {
    const structure = EpubStructure.get("EPUB");
    
    const fileName1 = util.makeStorageFileName(structure.textDir + "/", 1, "Chapter 1: The \"Hero's\" Journey", "xhtml");
    const fileName2 = util.makeStorageFileName(structure.textDir + "/", 2, "Chapter 2 - Attack & Defense", "xhtml");
    
    assert.ok(!fileName1.includes('"'), "Should remove quotes from filename");
    assert.ok(!fileName1.includes("'"), "Should remove apostrophes from filename");
    assert.ok(!fileName2.includes('&'), "Should remove ampersands from filename");
    assert.ok(fileName1.includes('EPUB/text/'), "Should use correct EPUB structure");
});

testModule("EPUB Content Validation");

test("chapter content includes proper XHTML structure", function(assert) {
    const packer = new EpubPacker(new EpubMetaInfo());
    const structure = EpubStructure.get("OEBPS");
    
    const epubItem = new EpubItem({
        id: "xhtml0001",
        href: "Text/0001_Chapter1.xhtml",
        title: "Chapter 1",
        content: "<h1>Chapter 1</h1><p>This is the content of the chapter.</p>"
    });
    
    const xhtmlContent = packer.buildChapterXhtml(epubItem, structure);
    
    assert.ok(xhtmlContent.includes('<?xml version="1.0"'), "Should include XML declaration");
    assert.ok(xhtmlContent.includes('<html xmlns="http://www.w3.org/1999/xhtml"'), "Should include XHTML namespace");
    assert.ok(xhtmlContent.includes('<head>'), "Should include head section");
    assert.ok(xhtmlContent.includes('<title>Chapter 1</title>'), "Should include chapter title in head");
    assert.ok(xhtmlContent.includes('<link rel="stylesheet"'), "Should include stylesheet reference");
    assert.ok(xhtmlContent.includes('<body>'), "Should include body section");
    assert.ok(xhtmlContent.includes('<h1>Chapter 1</h1>'), "Should include chapter content");
});

test("stylesheet references use correct relative paths", function(assert) {
    const packer = new EpubPacker(new EpubMetaInfo());
    const oebpsStructure = EpubStructure.get("OEBPS");
    const epubStructure = EpubStructure.get("EPUB");
    
    const epubItem = new EpubItem({
        id: "xhtml0001",
        title: "Test Chapter",
        content: "<p>Content</p>"
    });
    
    const oebpsXhtml = packer.buildChapterXhtml(epubItem, oebpsStructure);
    const epubXhtml = packer.buildChapterXhtml(epubItem, epubStructure);
    
    assert.ok(oebpsXhtml.includes('../Styles/stylesheet.css'), "OEBPS should reference ../Styles/stylesheet.css");
    assert.ok(epubXhtml.includes('../styles/stylesheet.css'), "EPUB should reference ../styles/stylesheet.css");
});

testModule("EPUB Error Handling");

test("handles empty chapter list gracefully", function(assert) {
    const packer = new EpubPacker(new EpubMetaInfo());
    const structure = EpubStructure.get("OEBPS");
    
    const contentOpf = packer.buildContentOpf([], structure, []);
    const tocNcx = packer.buildTocNcx([], structure);
    
    assert.ok(contentOpf.includes('<manifest>'), "Should include manifest even with no chapters");
    assert.ok(contentOpf.includes('<spine toc="ncx">'), "Should include spine even with no chapters");
    assert.ok(tocNcx.includes('<navMap>'), "Should include navMap even with no chapters");
});

test("handles missing chapter titles", function(assert) {
    const packer = new EpubPacker(new EpubMetaInfo());
    const structure = EpubStructure.get("OEBPS");
    
    const epubItem = new EpubItem({
        id: "xhtml0001",
        href: "Text/0001_Untitled.xhtml",
        title: null, // Missing title
        content: "<p>Content without title</p>"
    });
    
    const xhtmlContent = packer.buildChapterXhtml(epubItem, structure);
    const tocNcx = packer.buildTocNcx([epubItem], structure);
    
    assert.ok(xhtmlContent.includes('<title>'), "Should include title tag even if title is missing");
    assert.ok(tocNcx.includes('<navLabel>'), "Should include navigation label even if title is missing");
});

testModule("EPUB Structure Compatibility");

test("both OEBPS and EPUB structures produce valid output", function(assert) {
    const metaInfo = new EpubMetaInfo();
    const oebpsPacker = new EpubPacker(metaInfo);
    const epubPacker = new EpubPacker(metaInfo);
    
    const oebpsStructure = EpubStructure.get("OEBPS");
    const epubStructure = EpubStructure.get("EPUB");
    
    const epubItems = [
        new EpubItem({
            id: "xhtml0001",
            href: "Chapter1.xhtml",
            title: "Chapter 1",
            content: "<h1>Chapter 1</h1><p>Content</p>"
        })
    ];
    
    const oebpsContainer = oebpsPacker.buildContainerXml(oebpsStructure);
    const epubContainer = epubPacker.buildContainerXml(epubStructure);
    
    const oebpsContentOpf = oebpsPacker.buildContentOpf(epubItems, oebpsStructure, []);
    const epubContentOpf = epubPacker.buildContentOpf(epubItems, epubStructure, []);
    
    // Both should be valid XML
    assert.ok(oebpsContainer.includes('OEBPS/content.opf'), "OEBPS container should reference OEBPS structure");
    assert.ok(epubContainer.includes('EPUB/content.opf'), "EPUB container should reference EPUB structure");
    
    // Both should contain the same essential metadata
    assert.ok(oebpsContentOpf.includes('<dc:title>Test Story</dc:title>'), "OEBPS should include title");
    assert.ok(epubContentOpf.includes('<dc:title>Test Story</dc:title>'), "EPUB should include title");
    
    // Both should reference chapters correctly within their structure
    assert.ok(oebpsContentOpf.includes('href="Text/'), "OEBPS should use Text/ directory");
    assert.ok(epubContentOpf.includes('href="text/'), "EPUB should use text/ directory");
});

// Run tests if this file is executed directly
if (require.main === module) {
    (async () => {
        console.log('Running EPUB generation tests...\n');
        
        const success = await global.TestRunner.run();
        
        if (success) {
            console.log('\n🎉 All EPUB generation tests passed!');
            console.log('✅ EPUB structure generation working correctly');
            console.log('✅ Content.opf and toc.ncx creation validated');
            console.log('✅ File path generation correct');
            console.log('✅ Both OEBPS and EPUB structures supported');
            console.log('✅ Error handling robust');
        } else {
            console.log('\n❌ EPUB generation tests failed!');
        }
        
        process.exit(success ? 0 : 1);
    })().catch(error => {
        console.error('Test execution failed:', error);
        process.exit(1);
    });
}