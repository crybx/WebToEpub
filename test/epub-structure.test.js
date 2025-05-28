#!/usr/bin/env node

/**
 * Tests for EPUB structure preferences and path generation
 * Ensures both OEBPS and EPUB formats work correctly
 * These tests verify that changes like commit dd599b4 won't break functionality
 */

require('./node-setup');
require('./test-framework');

// Load the real Util.js to get actual constants
const fs = require('fs');
const path = require('path');
const utilPath = path.join(__dirname, '../plugin/js/Util.js');
const utilCode = fs.readFileSync(utilPath, 'utf8');

// Execute Util.js to get the real util object with constants
const modifiedUtilCode = utilCode.replace('const util =', 'global.util =');
eval(modifiedUtilCode);

testModule("EPUB Structure Preferences");

test("getEpubStructure - OEBPS format", function (assert) {
    const paths = util.getEpubStructure("OEBPS");
    
    assert.equal(paths.contentDir, "OEBPS", "Content directory should be OEBPS");
    assert.equal(paths.textDir, "OEBPS/Text", "Text directory should be OEBPS/Text");
    assert.equal(paths.imagesDir, "OEBPS/Images", "Images directory should be OEBPS/Images");
    assert.equal(paths.stylesDir, "OEBPS/Styles", "Styles directory should be OEBPS/Styles");
    assert.equal(paths.navFile, "OEBPS/toc.xhtml", "Nav file should be OEBPS/toc.xhtml");
    
    // Test relative paths
    assert.equal(paths.textDirRel, "Text", "Relative text dir should be Text");
    assert.equal(paths.imagesDirRel, "Images", "Relative images dir should be Images");
    assert.equal(paths.stylesDirRel, "Styles", "Relative styles dir should be Styles");
});

test("getEpubStructure - EPUB format", function (assert) {
    const paths = util.getEpubStructure("EPUB");
    
    assert.equal(paths.contentDir, "EPUB", "Content directory should be EPUB");
    assert.equal(paths.textDir, "EPUB/text", "Text directory should be EPUB/text");
    assert.equal(paths.imagesDir, "EPUB/images", "Images directory should be EPUB/images");
    assert.equal(paths.stylesDir, "EPUB/styles", "Styles directory should be EPUB/styles");
    assert.equal(paths.navFile, "EPUB/nav.xhtml", "Nav file should be EPUB/nav.xhtml");
    
    // Test relative paths
    assert.equal(paths.textDirRel, "text", "Relative text dir should be text");
    assert.equal(paths.imagesDirRel, "images", "Relative images dir should be images");
    assert.equal(paths.stylesDirRel, "styles", "Relative styles dir should be styles");
});

testModule("File Path Generation");

test("makeStorageFileName - OEBPS structure", function (assert) {
    const paths = util.getEpubStructure("OEBPS");
    
    assert.equal(
        util.makeStorageFileName(paths.textDir + "/", 1, "Chapter1", "xhtml"),
        "OEBPS/Text/0001_Chapter1.xhtml",
        "Should generate OEBPS text file path"
    );
    
    assert.equal(
        util.makeStorageFileName(paths.imagesDir + "/", 5, "cover", "jpg"),
        "OEBPS/Images/0005_cover.jpg",
        "Should generate OEBPS image file path"
    );
});

test("makeStorageFileName - EPUB structure", function (assert) {
    const paths = util.getEpubStructure("EPUB");
    
    assert.equal(
        util.makeStorageFileName(paths.textDir + "/", 1, "Chapter1", "xhtml"),
        "EPUB/text/0001_Chapter1.xhtml",
        "Should generate EPUB text file path"
    );
    
    assert.equal(
        util.makeStorageFileName(paths.imagesDir + "/", 5, "cover", "jpg"),
        "EPUB/images/0005_cover.jpg",
        "Should generate EPUB image file path"
    );
});

test("stylesheet path - both structures", function (assert) {
    assert.equal(util.getEpubStructure("OEBPS").stylesheet, "OEBPS/Styles/stylesheet.css", "OEBPS stylesheet path");
    assert.equal(util.getEpubStructure("EPUB").stylesheet, "EPUB/styles/stylesheet.css", "EPUB stylesheet path");
});

testModule("Relative Path Helpers");

test("relative path constants", function (assert) {
    assert.equal(util.getEpubStructure("OEBPS").relativeImagePath, "../Images/", "OEBPS relative image path");
    assert.equal(util.getEpubStructure("EPUB").relativeImagePath, "../images/", "EPUB relative image path");
    
    assert.equal(util.getEpubStructure("OEBPS").relativeStylePath, "../Styles/", "OEBPS relative style path");
    assert.equal(util.getEpubStructure("EPUB").relativeStylePath, "../styles/", "EPUB relative style path");
    
    assert.equal(util.getEpubStructure("OEBPS").relativeTextPath, "../Text/", "OEBPS relative text path");
    assert.equal(util.getEpubStructure("EPUB").relativeTextPath, "../text/", "EPUB relative text path");
});

testModule("Manifest Generation Patterns");

test("manifest item generation", function (assert) {
    function generateManifestItem(structure, type, filename, id, mediaType) {
        let paths = util.getEpubStructure(structure);
        let dir = paths[type + "DirRel"]; // textDirRel, imagesDirRel, etc.
        return `<item href="${dir}/${filename}" id="${id}" media-type="${mediaType}"/>`;
    }
    
    assert.equal(
        generateManifestItem("OEBPS", "text", "0001_Chapter1.xhtml", "xhtml0001", "application/xhtml+xml"),
        '<item href="Text/0001_Chapter1.xhtml" id="xhtml0001" media-type="application/xhtml+xml"/>',
        "OEBPS manifest item"
    );
    
    assert.equal(
        generateManifestItem("EPUB", "text", "0001_Chapter1.xhtml", "xhtml0001", "application/xhtml+xml"),
        '<item href="text/0001_Chapter1.xhtml" id="xhtml0001" media-type="application/xhtml+xml"/>',
        "EPUB manifest item"
    );
});

test("image reference generation", function (assert) {
    function generateImageReference(structure, filename) {
        let paths = util.getEpubStructure(structure);
        return `xlink:href="${paths.relativeImagePath}${filename}"`;
    }
    
    assert.equal(
        generateImageReference("OEBPS", "cover.jpg"),
        'xlink:href="../Images/cover.jpg"',
        "OEBPS image reference"
    );
    
    assert.equal(
        generateImageReference("EPUB", "cover.jpg"),
        'xlink:href="../images/cover.jpg"',
        "EPUB image reference"
    );
});

testModule("Container.xml Generation");

test("container.xml content", function (assert) {
    function generateContainerXml(structure) {
        let paths = util.getEpubStructure(structure);
        return `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
    <rootfiles>
        <rootfile full-path="${paths.contentOpf}" media-type="application/oebps-package+xml"/>
    </rootfiles>
</container>`;
    }
    
    const oebpsContainer = generateContainerXml("OEBPS");
    assert.ok(oebpsContainer.includes('full-path="OEBPS/content.opf"'), "OEBPS container.xml path");
    
    const epubContainer = generateContainerXml("EPUB");
    assert.ok(epubContainer.includes('full-path="EPUB/content.opf"'), "EPUB container.xml path");
});

testModule("Navigation File Handling");

test("navigation file paths", function (assert) {
    let paths = util.getEpubStructure("OEBPS");
    assert.equal(paths.navFile, "OEBPS/toc.xhtml", "OEBPS navigation file");
    
    paths = util.getEpubStructure("EPUB");
    assert.equal(paths.navFile, "EPUB/nav.xhtml", "EPUB navigation file (note filename change too)");
});

testModule("Test Pattern Validation");

test("test helper functions work with both structures", function (assert) {
    function getExpectedManifestItem(structure, type, filename, id, mediaType) {
        let paths = util.getEpubStructure(structure);
        let dir = paths[type + "DirRel"];
        return `<item href="${dir}/${filename}" id="${id}" media-type="${mediaType}"/>`;
    }
    
    function getExpectedRelativePath(structure, type, filename) {
        let paths = util.getEpubStructure(structure);
        let dir = paths[type + "DirRel"];
        return `../${dir}/${filename}`;
    }
    
    // Test OEBPS
    assert.equal(
        getExpectedManifestItem("OEBPS", "text", "0000_Title0.xhtml", "xhtml0000", "application/xhtml+xml"),
        '<item href="Text/0000_Title0.xhtml" id="xhtml0000" media-type="application/xhtml+xml"/>',
        "OEBPS test helper"
    );
    assert.equal(
        getExpectedRelativePath("OEBPS", "images", "0000_cover.png"),
        "../Images/0000_cover.png",
        "OEBPS relative path helper"
    );
    
    // Test EPUB
    assert.equal(
        getExpectedManifestItem("EPUB", "text", "0000_Title0.xhtml", "xhtml0000", "application/xhtml+xml"),
        '<item href="text/0000_Title0.xhtml" id="xhtml0000" media-type="application/xhtml+xml"/>',
        "EPUB test helper"
    );
    assert.equal(
        getExpectedRelativePath("EPUB", "images", "0000_cover.png"),
        "../images/0000_cover.png",
        "EPUB relative path helper"
    );
});

testModule("Regression Prevention");

test("changes from structure change commit patterns", function (assert) {
    // Test the specific patterns that were changed in commit dd599b4
    
    // Cover image href pattern - now uses constants directly
    assert.equal(util.getEpubStructure("OEBPS").coverXhtml, "OEBPS/Text/Cover.xhtml", "OEBPS cover image href");
    assert.equal(util.getEpubStructure("EPUB").coverXhtml, "EPUB/text/Cover.xhtml", "EPUB cover image href");
    
    // Navigation document patterns
    let paths = util.getEpubStructure("OEBPS");
    assert.equal(paths.navFile, "OEBPS/toc.xhtml", "OEBPS nav file (toc.xhtml)");
    
    paths = util.getEpubStructure("EPUB");
    assert.equal(paths.navFile, "EPUB/nav.xhtml", "EPUB nav file (nav.xhtml)");
    
    // Test that structure-specific paths work correctly
    // These patterns verify the constants are properly defined
    assert.equal(util.getEpubStructure("OEBPS").textDirPattern, "OEBPS/Text/", "OEBPS text dir pattern");
    assert.equal(util.getEpubStructure("EPUB").textDirPattern, "EPUB/text/", "EPUB text dir pattern");
    
    assert.equal(util.getEpubStructure("OEBPS").imagesDirPattern, "OEBPS/Images/", "OEBPS images dir pattern");
    assert.equal(util.getEpubStructure("EPUB").imagesDirPattern, "EPUB/images/", "EPUB images dir pattern");
});

// Run tests if this file is executed directly
if (require.main === module) {
    (async () => {
        console.log('Testing both OEBPS and EPUB structures for CI validation...\n');
        
        const success = await global.TestRunner.run();
        
        if (success) {
            console.log('\n🎉 All EPUB structure tests passed!');
            console.log('✅ Both OEBPS and EPUB formats are working correctly');
            console.log('✅ Path generation is structure-agnostic');
            console.log('✅ Test helpers work with both formats');
        } else {
            console.log('\n❌ EPUB structure tests failed!');
            console.log('This indicates potential issues with structure preferences.');
        }
        
        process.exit(success ? 0 : 1);
    })().catch(error => {
        console.error('Test execution failed:', error);
        process.exit(1);
    });
}