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

// Enhanced chrome extension API mocks
class ChromeStorageArea {
    constructor() {
        this._data = {};
        this._listeners = [];
    }
    
    get(keys, callback) {
        if (typeof keys === 'function') {
            callback = keys;
            keys = null;
        }
        
        setTimeout(() => {
            let result = {};
            
            if (keys === null) {
                result = { ...this._data };
            } else if (typeof keys === 'string') {
                if (keys in this._data) {
                    result[keys] = this._data[keys];
                }
            } else if (Array.isArray(keys)) {
                keys.forEach(key => {
                    if (key in this._data) {
                        result[key] = this._data[key];
                    }
                });
            } else if (typeof keys === 'object') {
                // keys is an object with defaults
                Object.keys(keys).forEach(key => {
                    result[key] = key in this._data ? this._data[key] : keys[key];
                });
            }
            
            if (callback) callback(result);
        }, 0);
    }
    
    set(items, callback) {
        setTimeout(() => {
            Object.assign(this._data, items);
            
            // Notify listeners
            const changes = {};
            Object.keys(items).forEach(key => {
                changes[key] = { newValue: items[key] };
                if (key in this._data) {
                    changes[key].oldValue = this._data[key];
                }
            });
            
            this._listeners.forEach(listener => {
                listener(changes, 'local');
            });
            
            if (callback) callback();
        }, 0);
    }
    
    remove(keys, callback) {
        setTimeout(() => {
            const keysArray = Array.isArray(keys) ? keys : [keys];
            keysArray.forEach(key => {
                delete this._data[key];
            });
            if (callback) callback();
        }, 0);
    }
    
    clear(callback) {
        setTimeout(() => {
            this._data = {};
            if (callback) callback();
        }, 0);
    }
    
    getBytesInUse(keys, callback) {
        setTimeout(() => {
            // Simplified - just return a mock size
            callback(JSON.stringify(this._data).length);
        }, 0);
    }
}

global.chrome = {
    storage: {
        local: new ChromeStorageArea(),
        sync: new ChromeStorageArea(),
        onChanged: {
            addListener(listener) {
                global.chrome.storage.local._listeners.push(listener);
            },
            removeListener(listener) {
                const index = global.chrome.storage.local._listeners.indexOf(listener);
                if (index > -1) {
                    global.chrome.storage.local._listeners.splice(index, 1);
                }
            }
        }
    },
    i18n: {
        getMessage: (key, substitutions) => {
            // Return a more realistic mock that handles substitutions
            if (substitutions) {
                return key + ': ' + (Array.isArray(substitutions) ? substitutions.join(', ') : substitutions);
            }
            return key;
        },
        getUILanguage: () => 'en-US'
    },
    tabs: {
        create: (options, callback) => {
            const mockTab = {
                id: Math.floor(Math.random() * 1000),
                url: options.url || '',
                active: options.active || false
            };
            if (callback) setTimeout(() => callback(mockTab), 0);
        },
        query: (queryInfo, callback) => {
            const mockTab = {
                id: 1,
                url: 'http://example.com',
                active: true
            };
            if (callback) setTimeout(() => callback([mockTab]), 0);
        }
    },
    runtime: {
        getURL: (path) => `chrome-extension://test/${path}`,
        id: 'test-extension-id',
        lastError: null,
        sendMessage: (message, callback) => {
            if (callback) setTimeout(callback, 0);
        }
    },
    downloads: {
        download: (options, callback) => {
            const downloadId = Math.floor(Math.random() * 1000);
            if (callback) setTimeout(() => callback(downloadId), 0);
        }
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

// Polyfill innerText for JSDOM (since it doesn't support it properly)
function addInnerTextPolyfill(window) {
    Object.defineProperty(window.Element.prototype, 'innerText', {
        get() {
            // Simple approximation of innerText behavior
            // This removes hidden elements and collapses whitespace like browsers do
            return this.textContent.replace(/\s+/g, ' ').trim();
        },
        set(value) {
            this.textContent = value;
        }
    });
}

// Enhanced test utils for creating DOM and mocking
global.TestUtils = {
    makeDomWithBody(bodyHtml) {
        const testDom = new JSDOM(`<!DOCTYPE html><html><head></head><body>${bodyHtml}</body></html>`, {
            url: 'http://localhost'
        });
        
        // Add innerText polyfill to this DOM instance
        addInnerTextPolyfill(testDom.window);
        
        return testDom.window.document;
    },
    
    // Mock HTTP responses
    createMockFetchResponse(html, status = 200) {
        return {
            ok: status >= 200 && status < 300,
            status: status,
            statusText: status === 200 ? 'OK' : 'Error',
            text: async () => html,
            clone: function() { return this; }
        };
    },
    
    // Mock fetch for HTTP client testing
    setupMockFetch(responses) {
        global.fetch = (url) => {
            const response = responses[url] || responses.default;
            if (!response) {
                return Promise.reject(new Error('Network error'));
            }
            return Promise.resolve(response);
        };
    },
    
    // Create mock parser instance
    createMockParser(overrides = {}) {
        return {
            getEpubMetaInfo: () => ({
                uuid: 'test-uuid',
                title: 'Test Title',
                author: 'Test Author',
                language: 'en',
                fileName: 'test-file'
            }),
            findContent: (dom) => dom.body,
            extractTitle: (dom) => 'Test Title',
            extractAuthor: (dom) => 'Test Author',
            findChapterTitle: (dom) => 'Chapter Title',
            getInformationEpubItemChildNodes: (dom) => [],
            ...overrides
        };
    },
    
    // Create realistic EPUB file structure
    createMockEpubStructure(type = 'OEBPS') {
        const structure = {
            'mimetype': 'application/epub+zip',
            'META-INF/container.xml': `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
    <rootfiles>
        <rootfile full-path="${type}/content.opf" media-type="application/oebps-package+xml"/>
    </rootfiles>
</container>`
        };
        
        const contentDir = type;
        const textDir = type === 'OEBPS' ? 'Text' : 'text';
        const stylesDir = type === 'OEBPS' ? 'Styles' : 'styles';
        
        structure[`${contentDir}/content.opf`] = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="2.0">
    <metadata/>
    <manifest/>
    <spine/>
</package>`;
        
        structure[`${contentDir}/${textDir}/0001_Chapter1.xhtml`] = `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Chapter 1</title></head>
<body><h1>Chapter 1</h1><p>Content</p></body>
</html>`;
        
        structure[`${contentDir}/${stylesDir}/stylesheet.css`] = 'body { font-family: serif; }';
        
        return structure;
    }
};

// Also add innerText polyfill to the main window
addInnerTextPolyfill(dom.window);

// Add Blob polyfill for Node.js
if (typeof global.Blob === 'undefined') {
    global.Blob = class Blob {
        constructor(parts, options = {}) {
            this.parts = parts || [];
            this.type = options.type || '';
            this.size = this.parts.reduce((acc, part) => {
                if (typeof part === 'string') {
                    return acc + part.length;
                } else if (part instanceof ArrayBuffer) {
                    return acc + part.byteLength;
                }
                return acc;
            }, 0);
        }
        
        async text() {
            return this.parts.join('');
        }
        
        async arrayBuffer() {
            const text = this.parts.join('');
            const buffer = new ArrayBuffer(text.length * 2);
            const view = new Uint16Array(buffer);
            for (let i = 0; i < text.length; i++) {
                view[i] = text.charCodeAt(i);
            }
            return buffer;
        }
    };
}

// Mock FileReader for tests
global.FileReader = class FileReader {
    readAsDataURL(blob) {
        setTimeout(() => {
            this.result = 'data:' + blob.type + ';base64,dGVzdA==';
            if (this.onload) this.onload({ target: this });
        }, 0);
    }
};

module.exports = { dom };