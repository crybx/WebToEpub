/*
 * Handles caching of chapter content in chrome.storage.local (browser.storage.local in Firefox)
 */
"use strict";

class ChapterCache {
    static CACHE_PREFIX = "webtoepub_chapter_";
    static CACHE_VERSION = "1.0";  // Only bump this if cache format changes
    static MAX_CACHE_AGE_DAYS = 30;

    // Get storage API (works for both Chrome and Firefox)
    static get storage() {
        // Firefox supports chrome.storage, but let's ensure compatibility
        if (typeof browser !== "undefined" && browser.storage) {
            return browser.storage;
        }
        return chrome.storage;
    }

    static getCacheKey(url) {
        return this.CACHE_PREFIX + url;
    }

    static async get(url) {
        try {
            // Check if caching is enabled
            if (!(await this.isEnabled())) {
                return null;
            }
            
            let key = this.getCacheKey(url);
            let result = await this.storage.local.get(key);
            let cached = result[key];
            
            if (cached) {
                let data = cached;
                // Check if cache is expired using current retention setting
                let retentionDays = await this.getRetentionDays();
                let ageInDays = (Date.now() - data.timestamp) / (1000 * 60 * 60 * 24);
                if (ageInDays < retentionDays && data.version === this.CACHE_VERSION) {
                    // Convert the HTML string back to DOM
                    let doc = new DOMParser().parseFromString(data.html, "text/html");
                    return doc.body.firstChild;
                }
                // Remove expired cache
                await this.storage.local.remove(key);
            }
        } catch (e) {
            console.error("Error reading from cache:", e);
        }
        return null;
    }

    static async set(url, contentElement) {
        try {
            // Check if caching is enabled
            if (!(await this.isEnabled())) {
                return;
            }
            
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
            await this.storage.local.set(storageObject);
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
            let storage = await this.storage.local.get();
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
                await this.storage.local.remove(keysToRemove);
            }
        } catch (e) {
            console.error("Error clearing old cache entries:", e);
        }
    }

    static async clearAll() {
        try {
            let storage = await this.storage.local.get();
            let keysToRemove = [];
            
            for (let key in storage) {
                if (key.startsWith(this.CACHE_PREFIX)) {
                    keysToRemove.push(key);
                }
            }
            
            if (keysToRemove.length > 0) {
                await this.storage.local.remove(keysToRemove);
            }
        } catch (e) {
            console.error("Error clearing cache:", e);
        }
    }

    static async getCacheStats() {
        try {
            let storage = await this.storage.local.get();
            let cacheKeys = Object.keys(storage).filter(key => key.startsWith(this.CACHE_PREFIX));
            let totalSize = 0;
            
            for (let key of cacheKeys) {
                if (storage[key] && storage[key].html) {
                    totalSize += storage[key].html.length;
                }
            }
            
            return {
                count: cacheKeys.length,
                sizeBytes: totalSize,
                sizeFormatted: this.formatBytes(totalSize)
            };
        } catch (e) {
            console.error("Error getting cache stats:", e);
            return { count: 0, sizeBytes: 0, sizeFormatted: "0 B" };
        }
    }

    static formatBytes(bytes) {
        if (bytes === 0) return "0 B";
        const k = 1024;
        const sizes = ["B", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    }

    // Cache settings management
    static async isEnabled() {
        try {
            let result = await this.storage.local.get("webtoepub_cache_enabled");
            return result.webtoepub_cache_enabled !== false; // Default to true
        } catch (e) {
            console.error("Error reading cache enabled setting:", e);
            return true; // Default to enabled
        }
    }

    static async setEnabled(enabled) {
        try {
            await this.storage.local.set({ "webtoepub_cache_enabled": enabled });
        } catch (e) {
            console.error("Error setting cache enabled:", e);
        }
    }

    static async getRetentionDays() {
        try {
            let result = await this.storage.local.get("webtoepub_cache_retention_days");
            return result.webtoepub_cache_retention_days || this.MAX_CACHE_AGE_DAYS;
        } catch (e) {
            console.error("Error reading cache retention days:", e);
            return this.MAX_CACHE_AGE_DAYS;
        }
    }

    static async setRetentionDays(days) {
        try {
            if (days < 1 || days > 365) {
                throw new Error("Retention days must be between 1 and 365");
            }
            await this.storage.local.set({ "webtoepub_cache_retention_days": days });
            this.MAX_CACHE_AGE_DAYS = days; // Update the current value
        } catch (e) {
            console.error("Error setting cache retention days:", e);
            throw e;
        }
    }
}