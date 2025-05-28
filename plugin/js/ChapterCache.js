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
    static SESSION_CLEANUP_INTERVAL = 4 * 60 * 60 * 1000; // 4 hours
    static SESSION_MAX_ENTRIES = 3000; // Maximum entries to keep in session storage
    static SESSION_MIN_AGE_HOURS = 2; // Minimum age before entries can be cleaned up

    // Localized text strings for cache functionality
    static CacheText = {
        buttonEnabled: chrome.i18n.getMessage("__MSG_button_cache_status_Enabled__"),
        buttonDisabled: chrome.i18n.getMessage("__MSG_button_cache_status_Disabled__"),
        toggleOn: chrome.i18n.getMessage("__MSG_toggle_state_On__"),
        toggleOff: chrome.i18n.getMessage("__MSG_toggle_state_Off__"),
        statusError: chrome.i18n.getMessage("__MSG_status_Error__"),
        confirmClearAll: chrome.i18n.getMessage("__MSG_confirm_Clear_All_Cache__"),
        downloadSuccess: chrome.i18n.getMessage("__MSG_download_Success__"),
        downloadError: chrome.i18n.getMessage("__MSG_download_Error__"),
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

    // Get active storage type based on cache settings
    static getActiveStorage() {
        let storage = this.storage;
        
        if (this.isEnabled()) {
            // Use persistent local storage when caching is enabled
            return storage.local;
        } else {
            // Use session storage when caching is disabled for privacy
            // Falls back to local storage if session storage is not available
            let sessionStorage = storage.session || storage.local;
            
            // Initialize session cleanup if using session storage
            if (storage.session && !this.isEnabled()) {
                this.initSessionCleanup();
            }
            
            return sessionStorage;
        }
    }

    // Initialize session storage cleanup for long-running sessions
    static initSessionCleanup() {
        // Only initialize once
        if (this.sessionCleanupInitialized) {
            return;
        }
        this.sessionCleanupInitialized = true;
        
        // Run cleanup every 4 hours
        setInterval(() => {
            this.cleanupSessionStorage();
        }, this.SESSION_CLEANUP_INTERVAL);
        
        console.log("Session storage cleanup initialized (4 hour intervals)");
    }

    // Clean up session storage when it gets too large
    static async cleanupSessionStorage() {
        try {
            // Only cleanup if we're using session storage (cache disabled)
            if (this.isEnabled() || !this.storage.session) {
                return;
            }
            
            let storage = await this.storage.session.get();
            let cacheKeys = Object.keys(storage).filter(key => key.startsWith(this.CACHE_PREFIX));
            
            // If we have more than the maximum allowed entries, remove oldest eligible ones
            if (cacheKeys.length > this.SESSION_MAX_ENTRIES) {
                let now = Date.now();
                let minAgeMs = this.SESSION_MIN_AGE_HOURS * 60 * 60 * 1000;
                
                // Sort by timestamp (oldest first) and filter by minimum age
                let entries = cacheKeys.map(key => ({
                    key: key,
                    timestamp: storage[key]?.timestamp || 0
                })).filter(entry => {
                    // Only consider entries older than minimum age for removal
                    return (now - entry.timestamp) >= minAgeMs;
                }).sort((a, b) => a.timestamp - b.timestamp);
                
                // Calculate how many entries we need to remove
                let entriesToRemove = cacheKeys.length - this.SESSION_MAX_ENTRIES;
                
                if (entries.length > 0 && entriesToRemove > 0) {
                    // Remove oldest eligible entries up to the required count
                    let toRemove = entries.slice(0, Math.min(entriesToRemove, entries.length));
                    let keysToRemove = toRemove.map(entry => entry.key);
                    
                    if (keysToRemove.length > 0) {
                        await this.storage.session.remove(keysToRemove);
                        console.log(`Cleaned up ${keysToRemove.length} old session cache entries (minimum age: ${this.SESSION_MIN_AGE_HOURS}h)`);
                    }
                } else if (entriesToRemove > 0) {
                    console.log(`Session storage over limit (${cacheKeys.length}/${this.SESSION_MAX_ENTRIES}) but no entries older than ${this.SESSION_MIN_AGE_HOURS}h to remove`);
                }
            }
        } catch (e) {
            console.error("Error cleaning up session storage:", e);
        }
    }

    static getCacheKey(url) {
        return this.CACHE_PREFIX + url;
    }

    static async get(url) {
        try {
            let key = this.getCacheKey(url);
            let result = await this.getActiveStorage().get(key);
            let cached = result[key];
            
            if (cached) {
                let data = cached;
                // Check if cache is expired using current retention setting
                let retentionDays = this.getRetentionDays();
                let ageInDays = (Date.now() - data.timestamp) / (1000 * 60 * 60 * 24);
                if (ageInDays < retentionDays && data.version === this.CACHE_VERSION) {
                    // If this is an error entry (no HTML content), return null so error handling can proceed
                    if (!data.html && data.hasOwnProperty("error")) {
                        return null;
                    }
                    // Convert the HTML string back to DOM
                    let doc = new DOMParser().parseFromString(data.html, "text/html");
                    return doc.body.firstChild;
                }
                // Remove expired cache
                await this.getActiveStorage().remove(key);
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
                version: this.CACHE_VERSION,
                error: null
            };
            
            let storageObject = {};
            storageObject[key] = data;
            await this.getActiveStorage().set(storageObject);
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
            let storage = await this.getActiveStorage().get();
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
                        // If it can't parse, remove it
                        keysToRemove.push(key);
                    }
                }
            }
            
            if (keysToRemove.length > 0) {
                await this.getActiveStorage().remove(keysToRemove);
            }
        } catch (e) {
            console.error("Error clearing old cache entries:", e);
        }
    }

    static async clearAll() {
        try {
            let storage = await this.getActiveStorage().get();
            let keysToRemove = [];
            
            for (let key in storage) {
                if (key.startsWith(this.CACHE_PREFIX)) {
                    keysToRemove.push(key);
                }
            }
            
            if (keysToRemove.length > 0) {
                await this.getActiveStorage().remove(keysToRemove);
            }
        } catch (e) {
            console.error("Error clearing cache:", e);
        }
    }

    static async deleteChapter(url) {
        try {
            let key = this.getCacheKey(url);
            await this.getActiveStorage().remove([key]);
        } catch (e) {
            console.error("Error deleting cached chapter:", e);
            throw e;
        }
    }

    static async getCacheStats() {
        try {
            let storage = await this.getActiveStorage().get();
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
                sizeFormatted: this.formatBytes(totalSize),
                storageType: this.isEnabled() ? "persistent" : "session"
            };
        } catch (e) {
            console.error("Error getting cache stats:", e);
            return { count: 0, sizeBytes: 0, sizeFormatted: "0 B", storageType: "unknown" };
        }
    }

    static formatBytes(bytes) {
        if (bytes === 0) return "0 B";
        const k = 1024;
        const sizes = ["B", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    }

    /**
     * Store an error message for a failed chapter download
     */
    static async storeChapterError(sourceUrl, errorMessage) {
        try {
            let key = this.getCacheKey(sourceUrl);
            let data = {
                html: null,
                timestamp: Date.now(),
                version: this.CACHE_VERSION,
                error: errorMessage
            };
            
            let storageObject = {};
            storageObject[key] = data;
            await this.getActiveStorage().set(storageObject);
        } catch (e) {
            console.error("Error storing chapter error:", e);
        }
    }

    /**
     * Get error message for a chapter, returns null if no error stored
     */
    static async getChapterError(sourceUrl) {
        try {
            let key = this.getCacheKey(sourceUrl);
            let storage = await this.getActiveStorage().get(key);
            let cached = storage[key];
            
            if (cached && cached.hasOwnProperty("error") && cached.error !== null) {
                // Check if cache is expired using current retention setting
                let retentionDays = this.getRetentionDays();
                let ageInDays = (Date.now() - cached.timestamp) / (1000 * 60 * 60 * 24);
                if (ageInDays < retentionDays && cached.version === this.CACHE_VERSION) {
                    return cached.error;
                }
                // Remove expired cache
                await this.getActiveStorage().remove(key);
            }
        } catch (e) {
            console.error("Error reading chapter error from cache:", e);
        }
        return null;
    }

    // Migrate chapters between storage types when cache setting changes
    static async migrateChapters(fromEnabled, toEnabled) {
        try {
            if (fromEnabled === toEnabled) {
                return; // No migration needed
            }

            let sourceStorage, targetStorage;
            
            if (toEnabled) {
                // Migrating from session to persistent (cache being enabled)
                sourceStorage = this.storage.session;
                targetStorage = this.storage.local;
                console.log("Migrating chapters from session to persistent storage...");
            } else {
                // Migrating from persistent to session (cache being disabled)
                sourceStorage = this.storage.local;
                targetStorage = this.storage.session || this.storage.local;
                console.log("Migrating chapters from persistent to session storage...");
            }

            if (!sourceStorage || !targetStorage) {
                console.log("Migration skipped: storage API not available");
                return;
            }

            // Get all chapters from source storage
            let sourceData = await sourceStorage.get();
            let chapterKeys = Object.keys(sourceData).filter(key => key.startsWith(this.CACHE_PREFIX));
            
            if (chapterKeys.length === 0) {
                console.log("No chapters to migrate");
                return;
            }

            let chaptersToMigrate = {};
            let keysToRemove = [];

            if (!toEnabled && sourceStorage !== targetStorage) {
                // Migrating from persistent to session - respect session storage limits
                console.log("Applying session storage limits during migration...");
                
                // Sort chapters by timestamp (newest first) and apply limits
                let chaptersWithTimestamp = chapterKeys.map(key => ({
                    key: key,
                    data: sourceData[key],
                    timestamp: sourceData[key]?.timestamp || 0
                })).sort((a, b) => b.timestamp - a.timestamp); // Newest first
                
                // Only migrate up to SESSION_MAX_ENTRIES newest chapters
                let chaptersToKeep = chaptersWithTimestamp.slice(0, this.SESSION_MAX_ENTRIES);
                let chaptersToDiscard = chaptersWithTimestamp.slice(this.SESSION_MAX_ENTRIES);
                
                // Prepare chapters for migration
                for (let chapter of chaptersToKeep) {
                    chaptersToMigrate[chapter.key] = chapter.data;
                }
                
                // All chapters will be removed from source (kept ones are migrated, excess ones are discarded)
                keysToRemove = chapterKeys;
                
                console.log("Migration summary: keeping " + chaptersToKeep.length + " newest chapters, discarding " + chaptersToDiscard.length + " oldest chapters due to session storage limits");
                
            } else {
                // Migrating from session to persistent - no limits, migrate everything
                for (let key of chapterKeys) {
                    chaptersToMigrate[key] = sourceData[key];
                }
                keysToRemove = chapterKeys;
            }

            // Copy chapters to target storage
            if (Object.keys(chaptersToMigrate).length > 0) {
                await targetStorage.set(chaptersToMigrate);
            }
            
            // Remove chapters from source storage (only if different storage types)
            if (sourceStorage !== targetStorage && keysToRemove.length > 0) {
                await sourceStorage.remove(keysToRemove);
            }

            console.log("Successfully migrated " + Object.keys(chaptersToMigrate).length + " chapters to " + (toEnabled ? "persistent" : "session") + " storage");
            
        } catch (e) {
            console.error("Error migrating chapters:", e);
            // Don't throw - migration failure shouldn't break the setting change
        }
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
            let storageTypeText = stats.storageType === "persistent" ? "Persistent" : "Session";
            
            document.getElementById("cachedChapterCount").textContent = stats.count + " (" + storageTypeText + ")";
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
                    await ChapterUrlsUI.updateDeleteCacheButtonVisibility();
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

    static async saveCacheSettings() {
        try {
            let previouslyEnabled = this.isEnabled();
            let enabled = document.getElementById("enableChapterCachingCheckbox").checked;
            let retentionDays = parseInt(document.getElementById("cacheRetentionDays").value);
            
            // Trigger migration if cache setting changed
            if (previouslyEnabled !== enabled) {
                await this.migrateChapters(previouslyEnabled, enabled);
            }
            
            this.setEnabled(enabled);
            this.setRetentionDays(retentionDays);
            
            // Update the toggle state text and main cache button text
            this.updateToggleStateText(enabled);
            this.updateCacheButtonText();
            
            // Refresh cache stats to show new storage type
            await this.refreshCacheStats();
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
    * Download a chapter and cache it
    */
    static async downloadChapter(sourceUrl, title, row) {
        try {
            // Find the parser and webPage for this URL
            let parser = ChapterCache.getCurrentParser();
            if (!parser) {
                throw new Error("No parser available for download");
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
            
            // Ensure webPage has parser reference (it may be missing in some cases)
            if (!webPage.parser) {
                webPage.parser = parser;
            }
            
            // Trigger the download using the existing download system
            await parser.fetchWebPageContent(webPage);
            
            // Process and cache the downloaded content (this step is normally done during EPUB creation)
            if (webPage.rawDom && !webPage.error) {
                let content = parser.convertRawDomToContent(webPage);
                if (content && row) {
                    ChapterUrlsUI.setChapterStatusVisuals(row, ChapterUrlsUI.CHAPTER_STATUS_DOWNLOADED, sourceUrl, title);
                } else {
                    throw new Error("Could not find content element for web page '" + sourceUrl + "'.");
                }
            } else {
                throw new Error(webPage.error || "Failed to fetch web page content");
            }
            
            await ChapterUrlsUI.updateDeleteCacheButtonVisibility();
        } catch (error) {
            console.log("Failed to download chapter:", error);
            // Store error message in cache
            await ChapterCache.storeChapterError(sourceUrl, error.message);
            // Set UI to error state
            if (row) {
                ChapterUrlsUI.setChapterStatusVisuals(row, ChapterUrlsUI.CHAPTER_STATUS_ERROR, sourceUrl, title);
            }
            await ChapterUrlsUI.updateDeleteCacheButtonVisibility();
        }
    }

    /**
    * Refresh a cached chapter (delete and redownload)
    */
    static async refreshChapter(sourceUrl, title, row) {
        try {
            // Delete the cached chapter first
            await ChapterCache.deleteChapter(sourceUrl);

            // Remove the chapter status icons for the row immediately
            ChapterUrlsUI.setChapterStatusVisuals(row, ChapterUrlsUI.CHAPTER_STATUS_NONE, sourceUrl, title);
            
            // Download the chapter again using the shared download logic
            await ChapterCache.downloadChapter(sourceUrl, title, row);
        } catch (error) {
            console.error("Failed to refresh chapter:", error);
            alert("Failed to refresh chapter: " + error.message);
        }
    }

    /**
    * Delete a single cached chapter and update UI
    */
    static async deleteSingleChapter(sourceUrl, title, row) {
        try {
            await ChapterCache.deleteChapter(sourceUrl);
            
            // Add download icon since chapter is no longer cached
            if (row) {
                ChapterUrlsUI.setChapterStatusVisuals(row, ChapterUrlsUI.CHAPTER_STATUS_NONE, sourceUrl, title);
            } else {
                console.log("no row");
            }
            
            // Update UI elements
            await ChapterUrlsUI.updateDeleteCacheButtonVisibility();
            
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
            // Use ChapterCache's active storage API for compatibility
            await ChapterCache.getActiveStorage().remove(keysToDelete);
            
            // Update UI - remove all cache icons and add download icons
            chapters.forEach(chapter => {
                if (chapter.row) {
                    // Add download icon since chapter is no longer cached
                    ChapterUrlsUI.setChapterStatusVisuals(chapter.row, ChapterUrlsUI.CHAPTER_STATUS_NONE, chapter.sourceUrl, chapter.title);
                }
            });
            
            // Update delete button visibility
            await ChapterUrlsUI.updateDeleteCacheButtonVisibility();
            
            console.log(`Deleted ${keysToDelete.length} cached chapters`);
        } catch (err) {
            console.error("Error deleting cached chapters:", err);
            alert("Error deleting cached chapters");
        }
    }

    /**
    * Download chapters to cache (for Download Chapters button)
    */
    static async downloadChaptersToCache() {
        let parser = ChapterCache.getCurrentParser();
        if (!parser) {
            throw new Error("No parser available");
        }
        
        let webPages = [...parser.state.webPages.values()].filter(c => c.isIncludeable);
        
        // Set up progress bar
        ProgressBar.setMax(webPages.length + 1);
        ProgressBar.setValue(1);
        
        await parser.addParsersToPages(webPages);
        let index = 0;
        try {
            let group = parser.groupPagesToFetch(webPages, index);
            while (0 < group.length) {
                await Promise.all(group.map(async (webPage) => {
                    await parser.fetchWebPageContent(webPage);

                    if (webPage.rawDom && !webPage.error) {
                        // convertRawDomToContent handles both processing and caching automatically
                        parser.convertRawDomToContent(webPage);
                        console.log(`Downloaded and cached chapter: ${webPage.title}`);
                    }
                }));
                index += group.length;
                group = parser.groupPagesToFetch(webPages, index);
            }
        } catch (err) {
            ErrorLog.log(err);
        }
        
        // Update UI to show cached icons
        await ChapterUrlsUI.updateDeleteCacheButtonVisibility();
    }

    /**
    * Check if any chapters on the current page are actually cached
    */
    static async hasAnyCachedChaptersOnPage() {
        try {
            let parser = ChapterCache.getCurrentParser();
            if (!parser) {
                return false;
            }
            
            // Get all chapter URLs from the current page
            let webPages = [...parser.state.webPages.values()].filter(c => c.isIncludeable);
            
            // Check if any of these chapters are cached
            for (let webPage of webPages) {
                let cachedContent = await ChapterCache.get(webPage.sourceUrl);
                if (cachedContent) {
                    return true;
                }
            }
            
            return false;
        } catch (error) {
            console.error("Error checking cached chapters:", error);
            return false;
        }
    }

    /**
    * Download a single chapter as HTML file
    */
    static async downloadSingleChapterAsFile(sourceUrl, title) {
        try {
            let parser = ChapterCache.getCurrentParser();
            if (!parser) {
                throw new Error("No parser available");
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
            
            let content;
            // Check if we have content in cache first
            let cachedContent = await ChapterCache.get(sourceUrl);
            if (cachedContent) {
                content = cachedContent;
            } else {
                // Check if we have a cached error message
                let errorMessage = await ChapterCache.getChapterError(sourceUrl);
                if (errorMessage) {
                    // Create error content element
                    let errorElement = document.createElement("div");
                    errorElement.className = "chapter-error";
                    errorElement.innerHTML = `<h3>Chapter Download Failed</h3><p><strong>Error:</strong> ${errorMessage}</p><p class="error-details">This chapter could not be downloaded from the source website.</p>`;
                    content = errorElement;
                } else if (webPage.rawDom) {
                    // Use existing content from memory
                    content = parser.convertRawDomToContent(webPage);
                } else {
                    // Need to fetch the content
                    if (!webPage.parser) {
                        webPage.parser = parser;
                    }
                    await parser.fetchWebPageContent(webPage);
                    if (webPage.rawDom && !webPage.error) {
                        content = parser.convertRawDomToContent(webPage);
                    }
                }
            }
            
            if (!content) {
                throw new Error("No content available for download");
            }
            
            // Create HTML file with proper structure
            let htmlContent = ChapterCache.createChapterHtml(title, content);
            
            // Generate safe filename
            let fileName = ChapterCache.sanitizeFilename(title || "Chapter") + ".html";
            
            // Download the file
            let blob = new Blob([htmlContent], {type: "text/html"});
            let overwriteExisting = true; // Allow overwrite for individual downloads
            let backgroundDownload = false; // Show download dialog for individual files
            
            // Use the Download utility from the main codebase
            if (typeof Download !== "undefined" && Download.save) {
                await Download.save(blob, fileName, overwriteExisting, backgroundDownload);
            } else {
                // Fallback download method
                let url = URL.createObjectURL(blob);
                let a = document.createElement("a");
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }
            
            console.log(`Downloaded chapter as file: ${fileName}`);
        } catch (error) {
            console.error("Failed to download chapter as file:", error);
            alert("Failed to download chapter as file: " + error.message);
        }
    }

    /**
    * Create HTML content for a chapter download
    */
    static createChapterHtml(title, contentElement) {
        // Use the content element's HTML directly
        let content = contentElement ? contentElement.outerHTML : "No content available";
        
        return `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
    <title>${ChapterCache.escapeHtml(title)}</title>
    <link type="text/css" rel="stylesheet" href="../styles/stylesheet.css"/>
</head>
<body>
    <div class="chapter-content">
        <h1>${ChapterCache.escapeHtml(title)}</h1>
        ${content}
    </div>
</body>
</html>`;
    }

    /**
    * Sanitize filename for safe file system usage
    */
    static sanitizeFilename(filename) {
        // Remove or replace characters that are invalid in filenames
        return filename.replace(/[<>:"/\\|?*]/g, "_").trim();
    }

    /**
    * Escape HTML to prevent XSS
    */
    static escapeHtml(text) {
        let div = document.createElement("div");
        div.textContent = text;
        return div.innerHTML;
    }
}