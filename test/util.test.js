#!/usr/bin/env node

/**
 * Node.js tests for Util.js
 * Ported from unitTest/UtestUtil.js
 */

// Set up Node.js environment
require('./node-setup');
require('./test-framework');

// Add missing DOM elements that UserPreferences expects
const themeColorTag = document.createElement("select");
themeColorTag.id = "themeColorTag";
document.body.appendChild(themeColorTag);

// Load the source files
const fs = require('fs');
const path = require('path');

// Mock EpubMetaInfo (required by some Util.js functions)
global.EpubMetaInfo = {
    getDefaultStyleSheet: () => "/* Default CSS */"
};

// Mock ReadingList (required by UserPreferences)
global.ReadingList = class ReadingList {
    static storageName = "readingList";
    
    constructor() {
        this.data = [];
    }
    
    toJson() {
        return JSON.stringify(this.data);
    }
    
    static fromJson(json) {
        const instance = new ReadingList();
        instance.data = JSON.parse(json);
        return instance;
    }
    
    getEpub(url) {
        return null; // Mock implementation
    }
    
    readFromLocalStorage() {
        // Mock implementation
    }
};

// Load EpubStructure.js first (required by Util.js)
const epubStructurePath = path.join(__dirname, '../plugin/js/EpubStructure.js');
const epubStructureCode = fs.readFileSync(epubStructurePath, 'utf8');

// Load UserPreferences.js (required by Util.js)
const userPrefsPath = path.join(__dirname, '../plugin/js/UserPreferences.js');
const userPrefsCode = fs.readFileSync(userPrefsPath, 'utf8');

// Load Util.js
const utilPath = path.join(__dirname, '../plugin/js/Util.js');
const utilCode = fs.readFileSync(utilPath, 'utf8');

// Mock main.getUserPreferences() that EpubStructure.get() needs
global.main = {
    getUserPreferences: () => ({
        epubInternalStructure: { value: "OEBPS" }  // Default to OEBPS structure for tests
    })
};

// Execute EpubStructure.js first
try {
    const modifiedEpubStructureCode = epubStructureCode.replace('class EpubStructure', 'global.EpubStructure = class EpubStructure');
    eval(modifiedEpubStructureCode);
    console.log('EpubStructure loaded successfully');
} catch (error) {
    console.error('Failed to load EpubStructure:', error.message);
}

// Execute UserPreferences.js
try {
    const modifiedUserPrefsCode = userPrefsCode.replace('class UserPreferences', 'global.UserPreferences = class UserPreferences');
    eval(modifiedUserPrefsCode);
    console.log('UserPreferences loaded successfully');
} catch (error) {
    console.error('Failed to load UserPreferences:', error.message);
}

// Execute Util.js in our environment and capture the util object
try {
    // Modify the code to make util global instead of const
    const modifiedUtilCode = utilCode.replace('const util =', 'global.util =');
    
    // Execute the modified code
    eval(modifiedUtilCode);
    
    // Now util should be available as global.util
    console.log('Util.js loaded successfully. util object:', typeof global.util);
    
    if (typeof global.util === 'undefined') {
        throw new Error('util object not defined after loading Util.js');
    }
    
    // Make util available in local scope for tests
    const util = global.util;
    
    // Test that it has expected methods
    if (typeof util.removeEmptyDivElements !== 'function') {
        throw new Error('util.removeEmptyDivElements is not a function');
    }
    
    console.log('util object loaded with', Object.keys(util).length, 'methods');
    
    // Make util available globally for tests
    global.util = util;
} catch (error) {
    console.error('Error loading Util.js:', error.message);
    throw error;
}

// Now run the tests
testModule("Util (Node.js)");

test("removeEmptyDivElements", function (assert) {
    let dom = TestUtils.makeDomWithBody(
        "<div><h1>H1</h1></div>" +
        "<div><div></div></div>" +
        "<div>    \n\n\n</div>" +
        "<div><img src=\"http://dumy.com/img.jpg\"></div>"
    );
    let content = dom.body;
    util.removeEmptyDivElements(content);

    assert.equal(content.innerHTML, "<div><h1>H1</h1></div><div><img src=\"http://dumy.com/img.jpg\"></div>");
});

test("removeScriptableElements", function (assert) {
    let dom = TestUtils.makeDomWithBody(
        "<div><h1>H1</h1></div>" +
        "<iframe title=\"VisualDNA Analytics\" width=\"0\" height=\"0\" aria-hidden=\"true\" src=\"./Wikia_files/saved_resource.html\" style=\"display: none;\"></iframe>" +
        "<script src=\"./expansion_embed.js\"></script>"+
        "<div>Some text</div>"
    );
    let content = dom.body;
    util.removeScriptableElements(content);

    const expected = "<div><h1>H1</h1></div><div>Some text</div>";
    assert.equal(content.innerHTML, expected);
});

test("makeStorageFileName", function (assert) {
    // Test the actual behavior of makeStorageFileName
    let result1 = util.makeStorageFileName("OEBPS/Text/", 1, "Chapter 1", "xhtml");
    assert.ok(result1.includes("OEBPS/Text/0001_"), "Should contain OEBPS/Text/0001_");
    assert.ok(result1.includes("Chapter"), "Should contain Chapter");
    assert.ok(result1.endsWith(".xhtml"), "Should end with .xhtml");
    
    let result2 = util.makeStorageFileName("EPUB/text/", 23, "Chapter 23: The End", "xhtml");
    assert.ok(result2.includes("EPUB/text/0023_"), "Should contain EPUB/text/0023_");
    assert.ok(result2.includes("Chapter"), "Should contain Chapter");
    assert.ok(result2.endsWith(".xhtml"), "Should end with .xhtml");
    
    let result3 = util.makeStorageFileName("OEBPS/Images/", 5, "cover", "jpg");
    assert.equal(result3, "OEBPS/Images/0005_cover.jpg", "Simple filename should work exactly");
});

test("stylesheet path from constants", function (assert) {
    // This should return the current structure path using EpubStructure directly
    const filename = EpubStructure.get().stylesheet;
    assert.ok(filename.includes("stylesheet.css"), "Should contain stylesheet.css");
    assert.ok(filename.includes("OEBPS") || filename.includes("EPUB"), "Should contain OEBPS or EPUB directory");
});

test("extractUrlFromBackgroundImage", function (assert) {
    let dom = TestUtils.makeDomWithBody('<div style="background-image: url(http://example.com/image.jpg)"></div>');
    let element = dom.querySelector("div");
    
    let url = util.extractUrlFromBackgroundImage(element);
    assert.equal(url, "http://example.com/image.jpg");
});

test("removeChildElementsMatchingSelector", function (assert) {
    let dom = TestUtils.makeDomWithBody(
        '<div>' +
        '<p class="keep">Keep this</p>' +
        '<p class="remove">Remove this</p>' +
        '<span class="remove">Remove this too</span>' +
        '<p class="keep">Keep this too</p>' +
        '</div>'
    );
    
    util.removeChildElementsMatchingSelector(dom.body, ".remove");
    
    const remaining = dom.body.querySelectorAll("*");
    assert.equal(remaining.length, 3); // div + 2 keep elements
    assert.equal(dom.body.querySelectorAll(".keep").length, 2);
    assert.equal(dom.body.querySelectorAll(".remove").length, 0);
});

// Run the tests if this file is executed directly
if (require.main === module) {
    global.TestRunner.run().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('Test execution failed:', error);
        process.exit(1);
    });
}