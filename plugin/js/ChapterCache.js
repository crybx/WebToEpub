/*
 * Handles caching of chapter content in chrome.storage.local (browser.storage.local in Firefox)
 */
"use strict";

class ChapterCache {
    static CACHE_PREFIX = "webtoepub_chapter_";
    static CACHE_VERSION = "1.0";  // Only bump this if cache format changes
    static MAX_CACHE_AGE_DAYS = 30;
    static CACHE_ENABLED_KEY = "chapterCacheEnabled";
    static CACHE_RETENTION_KEY = "chapterCacheRetentionDays";

    // Localized text strings for cache UI
    static CacheText = {
        buttonEnabled: chrome.i18n.getMessage("__MSG_button_cache_status_Enabled__"),
        buttonDisabled: chrome.i18n.getMessage("__MSG_button_cache_status_Disabled__"),
        toggleOn: chrome.i18n.getMessage("__MSG_toggle_state_On__"),
        toggleOff: chrome.i18n.getMessage("__MSG_toggle_state_Off__"),
        statusError: chrome.i18n.getMessage("__MSG_status_Error__"),
        tooltipViewChapter: chrome.i18n.getMessage("__MSG_tooltip_View_Chapter__"),
        tooltipDeleteAllCached: chrome.i18n.getMessage("__MSG_tooltip_Delete_All_Cached__"),
        menuRefreshChapter: chrome.i18n.getMessage("__MSG_menu_Refresh_Chapter__"),
        menuDeleteChapter: chrome.i18n.getMessage("__MSG_menu_Delete_Chapter__"),
        confirmClearAll: chrome.i18n.getMessage("__MSG_confirm_Clear_All_Cache__"),
        errorClearCache: chrome.i18n.getMessage("__MSG_error_Failed_Clear_Cache__"),
        errorSaveSettings: chrome.i18n.getMessage("__MSG_error_Failed_Save_Cache_Settings__")
    };

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
            let key = this.getCacheKey(url);
            let result = await this.storage.local.get(key);
            let cached = result[key];
            
            if (cached) {
                let data = cached;
                // Check if cache is expired using current retention setting
                let retentionDays = this.getRetentionDays();
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

    static async deleteChapter(url) {
        try {
            let key = this.getCacheKey(url);
            await this.storage.local.remove([key]);
        } catch (e) {
            console.error("Error deleting cached chapter:", e);
            throw e;
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

    // Cache settings management (stored in localStorage like UserPreferences)
    static isEnabled() {
        try {
            let value = localStorage.getItem(this.CACHE_ENABLED_KEY);
            return value !== "false"; // Default to true, only false if explicitly set to "false"
        } catch (e) {
            console.error("Error reading cache enabled setting:", e);
            return true; // Default to enabled
        }
    }

    static setEnabled(enabled) {
        try {
            localStorage.setItem(this.CACHE_ENABLED_KEY, enabled.toString());
        } catch (e) {
            console.error("Error setting cache enabled:", e);
        }
    }

    static getRetentionDays() {
        try {
            let value = localStorage.getItem(this.CACHE_RETENTION_KEY);
            return value ? parseInt(value) : this.MAX_CACHE_AGE_DAYS;
        } catch (e) {
            console.error("Error reading cache retention days:", e);
            return this.MAX_CACHE_AGE_DAYS;
        }
    }

    static setRetentionDays(days) {
        try {
            if (days < 1 || days > 365) {
                throw new Error("Retention days must be between 1 and 365");
            }
            localStorage.setItem(this.CACHE_RETENTION_KEY, days.toString());
        } catch (e) {
            console.error("Error setting cache retention days:", e);
            throw e;
        }
    }

    // UI Management Functions
    static updateCacheButtonText() {
        try {
            let enabled = this.isEnabled();
            let button = document.getElementById("cacheOptionsButton");
            if (button) {
                button.textContent = enabled ? this.CacheText.buttonEnabled : this.CacheText.buttonDisabled;
            }
        } catch (error) {
            console.error("Failed to update cache button text:", error);
        }
    }

    static async refreshCacheStats() {
        try {
            let stats = await this.getCacheStats();
            document.getElementById("cachedChapterCount").textContent = stats.count.toString();
            document.getElementById("cacheSize").textContent = stats.sizeFormatted;
        } catch (error) {
            document.getElementById("cachedChapterCount").textContent = this.CacheText.statusError;
            document.getElementById("cacheSize").textContent = this.CacheText.statusError;
            console.error("Failed to refresh cache stats:", error);
        }
    }

    static setupCacheEventHandlers() {
        // Clear all cache button
        document.getElementById("clearAllCacheButton").onclick = async () => {
            if (confirm(ChapterCache.CacheText.confirmClearAll)) {
                try {
                    await this.clearAll();
                    await this.refreshCacheStats();
                    // Update the chapter table to remove cache indicators
                    ChapterUrlsUI.updateDeleteCacheButtonVisibility();
                } catch (error) {
                    console.error("Failed to clear cache:", error);
                    alert(ChapterCache.CacheText.errorClearCache.replace("$error$", error.message));
                }
            }
        };
        
        // Load current settings
        this.loadCacheSettings();
        
        // Save settings when changed
        document.getElementById("enableChapterCachingCheckbox").onchange = this.saveCacheSettings.bind(this);
        document.getElementById("cacheRetentionDays").onchange = this.saveCacheSettings.bind(this);
    }

    static loadCacheSettings() {
        try {
            let enabled = this.isEnabled();
            let retentionDays = this.getRetentionDays();
            
            document.getElementById("enableChapterCachingCheckbox").checked = enabled;
            document.getElementById("cacheRetentionDays").value = retentionDays;
            this.updateToggleStateText(enabled);
        } catch (error) {
            console.error("Failed to load cache settings:", error);
        }
    }

    static saveCacheSettings() {
        try {
            let enabled = document.getElementById("enableChapterCachingCheckbox").checked;
            let retentionDays = parseInt(document.getElementById("cacheRetentionDays").value);
            
            this.setEnabled(enabled);
            this.setRetentionDays(retentionDays);
            
            // Update the toggle state text and main cache button text
            this.updateToggleStateText(enabled);
            this.updateCacheButtonText();
        } catch (error) {
            console.error("Failed to save cache settings:", error);
            alert(ChapterCache.CacheText.errorSaveSettings.replace("$error$", error.message));
        }
    }

    static updateToggleStateText(enabled) {
        try {
            let toggleText = document.getElementById("toggleStateText");
            if (toggleText) {
                toggleText.textContent = enabled ? this.CacheText.toggleOn : this.CacheText.toggleOff;
            }
        } catch (error) {
            console.error("Failed to update toggle state text:", error);
        }
    }

    // Chapter Cache Operations

    /**
    * Get the current parser instance from global scope
    */
    static getCurrentParser() {
        // Access the parser from main.js global scope
        if (typeof window !== "undefined" && window.parser) {
            return window.parser;
        }
        // Fallback: try to get from the global scope
        try {
            return parser; // eslint-disable-line no-undef
        } catch (e) {
            return null;
        }
    }

    /**
    * Refresh a cached chapter (delete and redownload)
    */
    static async refreshChapter(sourceUrl, title, cacheCol) {
        try {
            // Delete the cached chapter first
            await ChapterCache.deleteChapter(sourceUrl);
            
            // Remove the cache icons from the specific column immediately
            if (cacheCol) {
                cacheCol.innerHTML = "";
            }
            
            // Find the parser and webPage for this URL
            let parser = ChapterCache.getCurrentParser();
            if (!parser) {
                throw new Error("No parser available for refresh");
            }
            
            // Find the webPage object for this URL
            let webPage = null;
            for (let page of parser.getPagesToFetch().values()) {
                if (page.sourceUrl === sourceUrl) {
                    webPage = page;
                    break;
                }
            }
            
            if (!webPage) {
                throw new Error(`WebPage not found for URL: ${sourceUrl}`);
            }
            
            // Ensure webPage has parser reference (may be missing in some cases)
            if (!webPage.parser) {
                webPage.parser = parser;
            }
            
            // Trigger the re-download using the existing download system
            console.log(`Refreshing chapter: ${title} from ${sourceUrl}`);
            await parser.fetchWebPageContent(webPage);
            
            // Process and cache the downloaded content (this step is normally done during EPUB creation)
            if (webPage.rawDom && !webPage.error) {
                let content = parser.convertRawDomToContent(webPage);
                if (content) {
                    console.log(`Successfully refreshed and cached chapter: ${title}`);
                }
            }
            
            ChapterUrlsUI.updateDeleteCacheButtonVisibility();
        } catch (error) {
            console.error("Failed to refresh chapter:", error);
            alert("Failed to refresh chapter: " + error.message);
        }
    }

    /**
    * Delete a single cached chapter and update UI
    */
    static async deleteSingleChapter(sourceUrl, cacheCol) {
        try {
            await ChapterCache.deleteChapter(sourceUrl);
            
            // Remove the cache icons from the specific column
            if (cacheCol) {
                cacheCol.innerHTML = "";
            }
            
            // Update UI elements
            ChapterUrlsUI.updateDeleteCacheButtonVisibility();
            
            // Refresh cache stats if ChapterCache has the method
            if (typeof ChapterCache.refreshCacheStats === "function") {
                await ChapterCache.refreshCacheStats();
            }
        } catch (error) {
            console.error("Failed to delete chapter:", error);
            alert("Failed to delete cached chapter: " + error.message);
        }
    }

    /**
    * Delete all cached chapters for the given chapter list
    */
    static async deleteAllCachedChapters(chapters) {
        if (!confirm("Delete all cached chapters on this page?")) {
            return;
        }
        
        try {
            // Get all chapter URLs
            let urls = chapters.map(ch => ch.sourceUrl);
            
            // Delete from cache
            let keysToDelete = urls.map(url => ChapterCache.getCacheKey(url));
            // Use ChapterCache's storage API for compatibility
            await ChapterCache.storage.local.remove(keysToDelete);
            
            // Update UI - remove all eye icons
            document.querySelectorAll(".cacheViewColumn img").forEach(img => img.remove());
            
            // Update delete button visibility
            ChapterUrlsUI.updateDeleteCacheButtonVisibility();
            
            console.log(`Deleted ${keysToDelete.length} cached chapters`);
        } catch (err) {
            console.error("Error deleting cached chapters:", err);
            alert("Error deleting cached chapters");
        }
    }
}