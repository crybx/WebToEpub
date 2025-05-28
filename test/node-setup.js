/**
 * Set up Node.js environment to run WebToEpub code
 * Provides browser globals and DOM simulation
 */

const { JSDOM } = require('jsdom');

// Create a JSDOM instance
const dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>', {
    url: 'http://localhost',
    pretendToBeVisual: true,
    resources: 'usable'
});

// Set up global browser objects
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.location = dom.window.location;
global.DOMParser = dom.window.DOMParser;
global.XMLHttpRequest = dom.window.XMLHttpRequest;

// Mock localStorage
global.localStorage = {
    _data: {},
    getItem(key) {
        return this._data[key] || null;
    },
    setItem(key, value) {
        this._data[key] = String(value);
    },
    removeItem(key) {
        delete this._data[key];
    },
    clear() {
        this._data = {};
    },
    get length() {
        return Object.keys(this._data).length;
    },
    key(index) {
        const keys = Object.keys(this._data);
        return keys[index] || null;
    }
};

// Mock chrome extension APIs (minimal)
global.chrome = {
    storage: {
        local: {
            get: (keys, callback) => {
                // Mock implementation
                callback({});
            },
            set: (items, callback) => {
                if (callback) callback();
            }
        }
    },
    i18n: {
        getMessage: (key) => key // Just return the key
    },
    tabs: {
        create: (options, callback) => {
            if (callback) callback({});
        }
    },
    runtime: {
        getURL: (path) => `chrome-extension://test/${path}`
    }
};

// Mock browser API for Firefox compat
global.browser = undefined;

// Add XMLNS constant (found in HTML spec)
global.XMLNS = "http://www.w3.org/1999/xhtml";

// Add Node constants for DOM manipulation
global.Node = {
    ELEMENT_NODE: 1,
    TEXT_NODE: 3,
    COMMENT_NODE: 8,
    DOCUMENT_NODE: 9,
    DOCUMENT_FRAGMENT_NODE: 11
};

// Add NodeFilter constants
global.NodeFilter = {
    FILTER_ACCEPT: 1,
    FILTER_REJECT: 2,
    FILTER_SKIP: 3,
    SHOW_ALL: 0xFFFFFFFF,
    SHOW_ELEMENT: 0x1,
    SHOW_TEXT: 0x4
};

// Create a test utils object for creating DOM
global.TestUtils = {
    makeDomWithBody(bodyHtml) {
        const testDom = new JSDOM(`<!DOCTYPE html><html><head></head><body>${bodyHtml}</body></html>`, {
            url: 'http://localhost'
        });
        return testDom.window.document;
    }
};

module.exports = { dom };