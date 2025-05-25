/*
 * Handles caching of chapter content in chrome.storage.local
 */
"use strict";

class ChapterCache {
    static CACHE_PREFIX = "webtoepub_chapter_";
    static CACHE_VERSION = "1.0";  // Only bump this if cache format changes
    static MAX_CACHE_AGE_DAYS = 30;

    static getCacheKey(url) {
        return this.CACHE_PREFIX + url;
    }

    static async get(url) {
        try {
            let key = this.getCacheKey(url);
            let result = await chrome.storage.local.get(key);
            let cached = result[key];
            
            if (cached) {
                let data = cached;
                // Check if cache is expired
                let ageInDays = (Date.now() - data.timestamp) / (1000 * 60 * 60 * 24);
                if (ageInDays < this.MAX_CACHE_AGE_DAYS && data.version === this.CACHE_VERSION) {
                    // Convert the HTML string back to DOM
                    let doc = new DOMParser().parseFromString(data.html, "text/html");
                    return doc.body.firstChild;
                }
                // Remove expired cache
                await chrome.storage.local.remove(key);
            }
        } catch (e) {
            console.error("Error reading from cache:", e);
        }
        return null;
    }

    static async set(url, contentElement) {
        try {
            let key = this.getCacheKey(url);
            // Clone the element to avoid modifying the original
            let clonedContent = contentElement.cloneNode(true);
            // Convert to HTML string (not XHTML)
            let html = clonedContent.outerHTML;
            
            let data = {
                html: html,
                timestamp: Date.now(),
                version: this.CACHE_VERSION
            };
            
            let storageObject = {};
            storageObject[key] = data;
            await chrome.storage.local.set(storageObject);
        } catch (e) {
            // If storage is full or other error, just log and continue
            console.error("Error writing to cache:", e);
            // Try to clear some old entries if storage is full
            if (e.message && e.message.includes("quota")) {
                await this.clearOldEntries();
            }
        }
    }

    static async clearOldEntries() {
        try {
            let storage = await chrome.storage.local.get();
            let keysToRemove = [];
            
            for (let key in storage) {
                if (key.startsWith(this.CACHE_PREFIX)) {
                    try {
                        let data = storage[key];
                        let ageInDays = (Date.now() - data.timestamp) / (1000 * 60 * 60 * 24);
                        if (ageInDays > this.MAX_CACHE_AGE_DAYS || data.version !== this.CACHE_VERSION) {
                            keysToRemove.push(key);
                        }
                    } catch (e) {
                        // If can't parse, remove it
                        keysToRemove.push(key);
                    }
                }
            }
            
            if (keysToRemove.length > 0) {
                await chrome.storage.local.remove(keysToRemove);
            }
        } catch (e) {
            console.error("Error clearing old cache entries:", e);
        }
    }

    static async clearAll() {
        try {
            let storage = await chrome.storage.local.get();
            let keysToRemove = [];
            
            for (let key in storage) {
                if (key.startsWith(this.CACHE_PREFIX)) {
                    keysToRemove.push(key);
                }
            }
            
            if (keysToRemove.length > 0) {
                await chrome.storage.local.remove(keysToRemove);
            }
        } catch (e) {
            console.error("Error clearing cache:", e);
        }
    }
}