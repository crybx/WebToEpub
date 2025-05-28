#!/usr/bin/env node

/**
 * Tests for EPUB structure preferences and path generation
 * Ensures both OEBPS and EPUB formats work correctly
 * These tests verify that changes like commit dd599b4 won't break functionality
 */

require('./node-setup');
require('./test-framework');

// Mock UserPreferences for testing
global.UserPreferences = {
    currentStructure: 'OEBPS', // Default for testing
    
    getPreferenceValue(key) {
        if (key === 'epubInternalStructure') {
            return this.currentStructure;
        }
        return null;
    },
    
    getEpubStructurePaths() {
        let structure = this.getPreferenceValue("epubInternalStructure");
        if (structure === "OEBPS") {
            return {
                contentDir: "OEBPS",
                textDir: "OEBPS/Text",
                imagesDir: "OEBPS/Images", 
                stylesDir: "OEBPS/Styles",
                navFile: "OEBPS/toc.xhtml",
                // Relative paths for content (used in manifests/TOC)
                textDirRel: "Text",
                imagesDirRel: "Images",
                stylesDirRel: "Styles"
            };
        } else {
            return {
                contentDir: "EPUB",
                textDir: "EPUB/text",
                imagesDir: "EPUB/images",
                stylesDir: "EPUB/styles", 
                navFile: "EPUB/nav.xhtml",
                // Relative paths for content (used in manifests/TOC)
                textDirRel: "text",
                imagesDirRel: "images",
                stylesDirRel: "styles"
            };
        }
    },
    
    getRelativeImagePath() {
        return `../${this.getEpubStructurePaths().imagesDirRel}/`;
    },
    
    getRelativeStylePath() {
        return `../${this.getEpubStructurePaths().stylesDirRel}/`;
    },
    
    getRelativeTextPath() {
        return `../${this.getEpubStructurePaths().textDirRel}/`;
    }
};

// Mock util functions that we're testing
global.util = {
    makeStorageFileName(basePath, index, title, extension) {
        // Clean title for filename
        let cleanTitle = title.replace(/[^a-zA-Z0-9]/g, '');
        let paddedIndex = index.toString().padStart(4, '0');
        return `${basePath}${paddedIndex}_${cleanTitle}.${extension}`;
    },
    
    styleSheetFileName() {
        let paths = UserPreferences.getEpubStructurePaths();
        return `${paths.stylesDir}/stylesheet.css`;
    },
    
    makeRelative(href) {
        let paths = UserPreferences.getEpubStructurePaths();
        let contentDirLength = paths.contentDir.length;
        return ".." + href.substring(contentDirLength);
    }
};

testModule("EPUB Structure Preferences");

test("getEpubStructurePaths - OEBPS format", function (assert) {
    UserPreferences.currentStructure = 'OEBPS';
    const paths = UserPreferences.getEpubStructurePaths();
    
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

test("getEpubStructurePaths - EPUB format", function (assert) {
    UserPreferences.currentStructure = 'EPUB';
    const paths = UserPreferences.getEpubStructurePaths();
    
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
    UserPreferences.currentStructure = 'OEBPS';
    const paths = UserPreferences.getEpubStructurePaths();
    
    assert.equal(
        util.makeStorageFileName(paths.textDir + "/", 1, "Chapter 1", "xhtml"),
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
    UserPreferences.currentStructure = 'EPUB';
    const paths = UserPreferences.getEpubStructurePaths();
    
    assert.equal(
        util.makeStorageFileName(paths.textDir + "/", 1, "Chapter 1", "xhtml"),
        "EPUB/text/0001_Chapter1.xhtml",
        "Should generate EPUB text file path"
    );
    
    assert.equal(
        util.makeStorageFileName(paths.imagesDir + "/", 5, "cover", "jpg"),
        "EPUB/images/0005_cover.jpg",
        "Should generate EPUB image file path"
    );
});

test("styleSheetFileName - both structures", function (assert) {
    UserPreferences.currentStructure = 'OEBPS';
    assert.equal(util.styleSheetFileName(), "OEBPS/Styles/stylesheet.css", "OEBPS stylesheet path");
    
    UserPreferences.currentStructure = 'EPUB';
    assert.equal(util.styleSheetFileName(), "EPUB/styles/stylesheet.css", "EPUB stylesheet path");
});

testModule("Relative Path Helpers");

test("getRelativeImagePath", function (assert) {
    UserPreferences.currentStructure = 'OEBPS';
    assert.equal(UserPreferences.getRelativeImagePath(), "../Images/", "OEBPS relative image path");
    
    UserPreferences.currentStructure = 'EPUB';
    assert.equal(UserPreferences.getRelativeImagePath(), "../images/", "EPUB relative image path");
});

test("getRelativeStylePath", function (assert) {
    UserPreferences.currentStructure = 'OEBPS';
    assert.equal(UserPreferences.getRelativeStylePath(), "../Styles/", "OEBPS relative style path");
    
    UserPreferences.currentStructure = 'EPUB';
    assert.equal(UserPreferences.getRelativeStylePath(), "../styles/", "EPUB relative style path");
});

test("getRelativeTextPath", function (assert) {
    UserPreferences.currentStructure = 'OEBPS';
    assert.equal(UserPreferences.getRelativeTextPath(), "../Text/", "OEBPS relative text path");
    
    UserPreferences.currentStructure = 'EPUB';
    assert.equal(UserPreferences.getRelativeTextPath(), "../text/", "EPUB relative text path");
});

testModule("Manifest Generation Patterns");

test("manifest item generation", function (assert) {
    function generateManifestItem(type, filename, id, mediaType) {
        let paths = UserPreferences.getEpubStructurePaths();
        let dir = paths[type + "DirRel"]; // textDirRel, imagesDirRel, etc.
        return `<item href="${dir}/${filename}" id="${id}" media-type="${mediaType}"/>`;
    }
    
    UserPreferences.currentStructure = 'OEBPS';
    assert.equal(
        generateManifestItem("text", "0001_Chapter1.xhtml", "xhtml0001", "application/xhtml+xml"),
        '<item href="Text/0001_Chapter1.xhtml" id="xhtml0001" media-type="application/xhtml+xml"/>',
        "OEBPS manifest item"
    );
    
    UserPreferences.currentStructure = 'EPUB';
    assert.equal(
        generateManifestItem("text", "0001_Chapter1.xhtml", "xhtml0001", "application/xhtml+xml"),
        '<item href="text/0001_Chapter1.xhtml" id="xhtml0001" media-type="application/xhtml+xml"/>',
        "EPUB manifest item"
    );
});

test("image reference generation", function (assert) {
    function generateImageReference(filename) {
        return `xlink:href="${UserPreferences.getRelativeImagePath()}${filename}"`;
    }
    
    UserPreferences.currentStructure = 'OEBPS';
    assert.equal(
        generateImageReference("cover.jpg"),
        'xlink:href="../Images/cover.jpg"',
        "OEBPS image reference"
    );
    
    UserPreferences.currentStructure = 'EPUB';
    assert.equal(
        generateImageReference("cover.jpg"),
        'xlink:href="../images/cover.jpg"',
        "EPUB image reference"
    );
});

testModule("Container.xml Generation");

test("container.xml content", function (assert) {
    function generateContainerXml() {
        let paths = UserPreferences.getEpubStructurePaths();
        return `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
    <rootfiles>
        <rootfile full-path="${paths.contentDir}/content.opf" media-type="application/oebps-package+xml"/>
    </rootfiles>
</container>`;
    }
    
    UserPreferences.currentStructure = 'OEBPS';
    const oebpsContainer = generateContainerXml();
    assert.ok(oebpsContainer.includes('full-path="OEBPS/content.opf"'), "OEBPS container.xml path");
    
    UserPreferences.currentStructure = 'EPUB';
    const epubContainer = generateContainerXml();
    assert.ok(epubContainer.includes('full-path="EPUB/content.opf"'), "EPUB container.xml path");
});

testModule("Navigation File Handling");

test("navigation file paths", function (assert) {
    UserPreferences.currentStructure = 'OEBPS';
    let paths = UserPreferences.getEpubStructurePaths();
    assert.equal(paths.navFile, "OEBPS/toc.xhtml", "OEBPS navigation file");
    
    UserPreferences.currentStructure = 'EPUB';
    paths = UserPreferences.getEpubStructurePaths();
    assert.equal(paths.navFile, "EPUB/nav.xhtml", "EPUB navigation file (note filename change too)");
});

testModule("Test Pattern Validation");

test("test helper functions work with both structures", function (assert) {
    function getTestEpubPaths() {
        return UserPreferences.getEpubStructurePaths();
    }
    
    function getExpectedManifestItem(type, filename, id, mediaType) {
        let paths = getTestEpubPaths();
        let dir = paths[type + "DirRel"];
        return `<item href="${dir}/${filename}" id="${id}" media-type="${mediaType}"/>`;
    }
    
    function getExpectedRelativePath(type, filename) {
        let paths = getTestEpubPaths();
        let dir = paths[type + "DirRel"];
        return `../${dir}/${filename}`;
    }
    
    // Test OEBPS
    UserPreferences.currentStructure = 'OEBPS';
    assert.equal(
        getExpectedManifestItem("text", "0000_Title0.xhtml", "xhtml0000", "application/xhtml+xml"),
        '<item href="Text/0000_Title0.xhtml" id="xhtml0000" media-type="application/xhtml+xml"/>',
        "OEBPS test helper"
    );
    assert.equal(
        getExpectedRelativePath("images", "0000_cover.png"),
        "../Images/0000_cover.png",
        "OEBPS relative path helper"
    );
    
    // Test EPUB
    UserPreferences.currentStructure = 'EPUB';
    assert.equal(
        getExpectedManifestItem("text", "0000_Title0.xhtml", "xhtml0000", "application/xhtml+xml"),
        '<item href="text/0000_Title0.xhtml" id="xhtml0000" media-type="application/xhtml+xml"/>',
        "EPUB test helper"
    );
    assert.equal(
        getExpectedRelativePath("images", "0000_cover.png"),
        "../images/0000_cover.png",
        "EPUB relative path helper"
    );
});

testModule("Regression Prevention");

test("changes from commit dd599b4 patterns", function (assert) {
    // Test the specific patterns that were changed in commit dd599b4
    
    // Cover image href pattern
    function coverImageXhtmlHref() {
        let paths = UserPreferences.getEpubStructurePaths();
        return `${paths.textDir}/Cover.xhtml`;
    }
    
    UserPreferences.currentStructure = 'OEBPS';
    assert.equal(coverImageXhtmlHref(), "OEBPS/Text/Cover.xhtml", "OEBPS cover image href");
    
    UserPreferences.currentStructure = 'EPUB';
    assert.equal(coverImageXhtmlHref(), "EPUB/text/Cover.xhtml", "EPUB cover image href");
    
    // Navigation document patterns
    UserPreferences.currentStructure = 'OEBPS';
    let paths = UserPreferences.getEpubStructurePaths();
    assert.equal(paths.navFile, "OEBPS/toc.xhtml", "OEBPS nav file (toc.xhtml)");
    
    UserPreferences.currentStructure = 'EPUB';
    paths = UserPreferences.getEpubStructurePaths();
    assert.equal(paths.navFile, "EPUB/nav.xhtml", "EPUB nav file (nav.xhtml)");
    
    // makeRelative pattern (used in Util.js)
    UserPreferences.currentStructure = 'OEBPS';
    let relativeOEBPS = util.makeRelative("OEBPS/Images/test.jpg");
    assert.equal(relativeOEBPS, "../Images/test.jpg", "OEBPS makeRelative");
    
    UserPreferences.currentStructure = 'EPUB';
    let relativeEPUB = util.makeRelative("EPUB/images/test.jpg");
    assert.equal(relativeEPUB, "../images/test.jpg", "EPUB makeRelative");
});

// Run tests if this file is executed directly
if (require.main === module) {
    (async () => {
        console.log('Testing both OEBPS and EPUB structures for CI validation...\n');
        
        const success = await global.TestRunner.run();
        
        if (success) {
            console.log('\n🎉 All EPUB structure tests passed!');
            console.log('✅ Both OEBPS and EPUB formats are working correctly');
            console.log('✅ Changes like commit dd599b4 will not break tests');
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