/*
 * Handles caching of chapter content in chrome.storage.local (browser.storage.local in Firefox)
 */
"use strict";

class ChapterCache {
    static CACHE_PREFIX = "webtoepub_chapter_";
    static CACHE_VERSION = "1.0";  // Only bump this if cache format changes
    static MAX_CACHE_AGE_DAYS = 7;
    static CACHE_ENABLED_KEY = "chapterCacheEnabled";
    static CACHE_RETENTION_KEY = "chapterCacheRetentionDays";
    static SESSION_CLEANUP_INTERVAL = 4 * 60 * 60 * 1000; // 4 hours
    static SESSION_MAX_ENTRIES = 3000; // Maximum entries to keep in session storage
    static SESSION_MIN_AGE_HOURS = 2; // Minimum age before entries can be cleaned up


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
                    // Remove the oldest eligible entries up to the required count
                    let toRemove = entries.slice(0, Math.min(entriesToRemove, entries.length));
                    let keysToRemove = toRemove.map(entry => entry.key);
                    
                    if (keysToRemove.length > 0) {
                        await this.storage.session.remove(keysToRemove);
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
                    if (!data.html && Object.hasOwn(data, "error")) {
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
        const value = bytes / Math.pow(k, i);
        
        // Round KB to nearest whole number, keep 2 decimal places for larger units
        const decimals = (sizes[i] === "KB") ? 0 : 2;
        return parseFloat(value.toFixed(decimals)) + " " + sizes[i];
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
            
            if (cached && Object.hasOwn(cached, "error") && cached.error !== null) {
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
            } else {
                // Migrating from persistent to session (cache being disabled)
                sourceStorage = this.storage.local;
                targetStorage = this.storage.session || this.storage.local;
            }

            if (!sourceStorage || !targetStorage) {
                console.log("Migration skipped: storage API not available");
                return;
            }

            // Get all chapters from source storage
            let sourceData = await sourceStorage.get();
            let chapterKeys = Object.keys(sourceData).filter(key => key.startsWith(this.CACHE_PREFIX));
            
            if (chapterKeys.length === 0) {
                // No chapters to migrate
                return;
            }

            let chaptersToMigrate = {};
            let keysToRemove = [];

            if (!toEnabled && sourceStorage !== targetStorage) {
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

    // Cache Cleanup Functions
    static LAST_CLEANUP_KEY = "chapterCacheLastCleanup";

    static shouldRunDailyCleanup() {
        try {
            let lastCleanup = localStorage.getItem(this.LAST_CLEANUP_KEY);
            if (!lastCleanup) {
                return true; // Never cleaned up before
            }
            let daysSince = (Date.now() - parseInt(lastCleanup)) / (1000 * 60 * 60 * 24);
            return daysSince >= 1; // Run if it's been 24+ hours
        } catch (e) {
            console.error("Error checking cleanup date:", e);
            return true; // Run cleanup on error to be safe
        }
    }

    static async runDailyCleanupIfNeeded() {
        if (!this.shouldRunDailyCleanup()) {
            return;
        }
        
        try {
            let cleanedCount = await this.cleanupExpiredEntries();
            console.log(`Cache cleanup: removed ${cleanedCount} expired entries`);
            
            // Update last cleanup timestamp
            localStorage.setItem(this.LAST_CLEANUP_KEY, Date.now().toString());
        } catch (e) {
            console.error("Error during daily cache cleanup:", e);
        }
    }

    static async cleanupExpiredEntries() {
        try {
            let storage = this.getActiveStorage();
            let allData = await storage.get();
            let retentionDays = this.getRetentionDays();
            let now = Date.now();
            let expiredKeys = [];
            
            // Find all expired cache entries
            for (let key in allData) {
                if (key.startsWith(this.CACHE_PREFIX)) {
                    let cached = allData[key];
                    if (cached && cached.timestamp) {
                        let ageInDays = (now - cached.timestamp) / (1000 * 60 * 60 * 24);
                        if (ageInDays >= retentionDays || cached.version !== this.CACHE_VERSION) {
                            expiredKeys.push(key);
                        }
                    } else {
                        // Remove entries without proper timestamp or structure
                        expiredKeys.push(key);
                    }
                }
            }
            
            if (expiredKeys.length > 0) {
                await storage.remove(expiredKeys);
            }
            
            return expiredKeys.length;
        } catch (e) {
            console.error("Error cleaning up expired cache entries:", e);
            return 0;
        }
    }

    static async cleanupExpiredEntriesButtonHandler() {
        try {
            let cleanedCount = await this.cleanupExpiredEntries();
            if (cleanedCount > 0) {
                alert(`Removed ${cleanedCount} expired entries older than ${this.getRetentionDays()} days.`);
            } else {
                alert("No expired entries found to remove.");
            }
            await this.refreshCacheStats();
            ChapterUrlsUI.updateHeaderMoreActionsVisibility();
        } catch (error) {
            console.error("Failed to cleanup expired entries:", error);
            alert("Error cleaning up expired entries: " + error.message);
        }
    }

    // UI Management Functions
    static updateCacheButtonText() {
        try {
            let enabled = this.isEnabled();
            let button = document.getElementById("cacheOptionsButton");
            if (button) {
                button.textContent = enabled ? UIText.Cache.buttonEnabled : UIText.Cache.buttonDisabled;
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
            document.getElementById("cachedChapterCount").textContent = UIText.Cache.statusError;
            document.getElementById("cacheSize").textContent = UIText.Cache.statusError;
            console.error("Failed to refresh cache stats:", error);
        }
    }

    static setupCacheEventHandlers() {
        // Clear all cache button
        document.getElementById("clearAllCacheButton").onclick = async () => {
            if (confirm(UIText.Cache.confirmClearAll)) {
                try {
                    await this.clearAll();
                    await this.refreshCacheStats();
                    // Update the chapter table to remove cache indicators
                    ChapterUrlsUI.updateHeaderMoreActionsVisibility();
                } catch (error) {
                    console.error("Failed to clear cache:", error);
                    alert(UIText.Cache.errorClearCache.replace("$error$", error.message));
                }
            }
        };
        
        // Cleanup expired entries button
        document.getElementById("cleanupExpiredCacheButton").onclick = this.cleanupExpiredEntriesButtonHandler.bind(this);
        
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
            alert(UIText.Cache.errorSaveSettings.replace("$error$", error.message));
        }
    }

    static updateToggleStateText(enabled) {
        try {
            let toggleText = document.getElementById("toggleStateText");
            if (toggleText) {
                toggleText.textContent = enabled ? UIText.Cache.toggleOn : UIText.Cache.toggleOff;
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
    * Download a chapter and add it to cache or library based on current mode
    */
    static async downloadChapter(sourceUrl, title, row) {
        try {
            // Check if we're in library mode
            let isLibraryMode = window.currentLibraryBook && window.currentLibraryBook.id;
            let chapter = null;
            
            // Find chapter data to check if it should go to library
            if (window.parser && window.parser.state && window.parser.state.webPages) {
                chapter = [...window.parser.state.webPages.values()].find(ch => ch.sourceUrl === sourceUrl);
            }
            
            // If we're in library mode but chapter doesn't have libraryBookId, set it
            if (isLibraryMode && chapter && !chapter.libraryBookId) {
                chapter.libraryBookId = window.currentLibraryBook.id;
            }
            
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
            
            // Ensure webPage has parser reference and nextPrevChapters set (it may be missing in some cases)
            if (!webPage.parser) {
                webPage.parser = parser;
            }
            if (!webPage.nextPrevChapters) {
                webPage.nextPrevChapters = new Set();
            }
            
            // Trigger the download using the existing download system
            await parser.fetchWebPageContent(webPage);
            
            // Process the downloaded content
            if (webPage.rawDom && !webPage.error) {
                let content = parser.convertRawDomToContent(webPage);
                if (!content) {
                    throw new Error("Could not find content element for web page '" + sourceUrl + "'.");
                }

                if (isLibraryMode && chapter && chapter.libraryBookId !== undefined) {
                    // In library mode - add chapter directly to library book (whether it's new or existing)
                    // For new chapters, we need to determine the correct index to insert at
                    if (chapter.epubSpineIndex === undefined) {
                        // This is a new chapter - find the correct position based on UI chapter list
                        chapter.epubSpineIndex = await LibraryBookData.calculateChapterInsertionIndex(chapter, sourceUrl);
                    }
                    await LibraryStorage.addChapterToLibrary(chapter, content, sourceUrl, title, row);
                } else {
                    // Normal mode - add to cache
                    await ChapterCache.set(sourceUrl, content);
                    if (row) {
                        ChapterUrlsUI.setChapterStatusVisuals(row, ChapterUrlsUI.CHAPTER_STATUS_DOWNLOADED, sourceUrl, title);
                    }
                }
            } else {
                throw new Error(webPage.error);
            }
        } catch (error) {
            console.log("Failed to download chapter:", error);
            // Store error message in cache
            await ChapterCache.storeChapterError(sourceUrl, error.message);
            // Set UI to error state
            if (row) {
                ChapterUrlsUI.setChapterStatusVisuals(row, ChapterUrlsUI.CHAPTER_STATUS_ERROR, sourceUrl, title);
            }
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
                    }
                }));
                index += group.length;
                group = parser.groupPagesToFetch(webPages, index);
                if (util.sleepController.signal.aborted) {
                    break;
                }
            }
        } catch (err) {
            ErrorLog.log(err);
        }
        
        // Update UI to show cached icons
        ChapterUrlsUI.updateHeaderMoreActionsVisibility();
    }

    /**
    * Download a single chapter as HTML file
    */
    static async downloadSingleChapterAsFile(sourceUrl, title) {
        try {
            // Get content from appropriate source
            let content = await this.getChapterContentForDownload(sourceUrl);
            
            if (!content) {
                throw new Error("No content available for download");
            }
            
            // Create and download the HTML file
            await this.downloadContentAsHtml(content, title);
            
        } catch (error) {
            console.error("Failed to download chapter as file:", error);
            alert("Failed to download chapter as file: " + error.message);
        }
    }
    
    /**
    * Get chapter content from library, cache, or fetch new
    */
    static async getChapterContentForDownload(sourceUrl) {
        // Try library mode first
        let libraryContent = await this.getLibraryChapterContent(sourceUrl);
        if (libraryContent) {
            return libraryContent;
        }
        
        // Try cache
        let cachedContent = await ChapterCache.get(sourceUrl);
        if (cachedContent) {
            return cachedContent;
        }
        
        // Check for cached error
        let errorContent = await this.getCachedErrorContent(sourceUrl);
        if (errorContent) {
            return errorContent;
        }
        
        // Fetch fresh content
        return this.fetchFreshChapterContent(sourceUrl);
    }
    
    /**
    * Get content from library if in library mode
    */
    static async getLibraryChapterContent(sourceUrl) {
        if (!window.currentLibraryBook?.id) {
            return null;
        }
        
        let parser = this.getCurrentParser();
        if (!parser?.state?.webPages) {
            return null;
        }
        
        let chapter = [...parser.state.webPages.values()].find(ch => ch.sourceUrl === sourceUrl);
        
        if (chapter?.isInBook && chapter.libraryBookId && chapter.epubSpineIndex !== undefined) {
            return LibraryBookData.getChapterContent(chapter.libraryBookId, chapter.epubSpineIndex);
        }
        
        return null;
    }
    
    /**
    * Get cached error content if available
    */
    static async getCachedErrorContent(sourceUrl) {
        let errorMessage = await this.getChapterError(sourceUrl);
        if (!errorMessage) {
            return null;
        }
        
        let errorElement = document.createElement("div");
        errorElement.className = "chapter-error";
        errorElement.innerHTML = `
            <h3>Chapter Download Failed</h3>
            <p><strong>Error:</strong> ${errorMessage}</p>
            <p class="error-details">This chapter could not be downloaded from the source website.</p>`;
        return errorElement;
    }
    
    /**
    * Fetch fresh chapter content from source
    */
    static async fetchFreshChapterContent(sourceUrl) {
        let parser = this.getCurrentParser();
        if (!parser) {
            throw new Error("No parser available");
        }
        
        // Find webPage
        let webPage = this.findWebPageByUrl(parser, sourceUrl);
        if (!webPage) {
            throw new Error(`WebPage not found for URL: ${sourceUrl}`);
        }
        
        // Check if already loaded in memory
        if (webPage.rawDom) {
            return parser.convertRawDomToContent(webPage);
        }
        
        // Fetch fresh content
        if (!webPage.parser) {
            webPage.parser = parser;
        }
        
        await parser.fetchWebPageContent(webPage);
        
        if (webPage.rawDom && !webPage.error) {
            return parser.convertRawDomToContent(webPage);
        }
        
        return null;
    }
    
    /**
    * Find webPage object by URL in parser
    */
    static findWebPageByUrl(parser, sourceUrl) {
        for (let page of parser.getPagesToFetch().values()) {
            if (page.sourceUrl === sourceUrl) {
                return page;
            }
        }
        return null;
    }
    
    /**
    * Download content as HTML file
    */
    static async downloadContentAsHtml(content, title) {
        // Create HTML file
        let htmlContent = this.createChapterHtml(title, content);
        let bookTitle = this.getBookTitle();
        let fileName = this.createHtmlFilename(bookTitle, title);
        
        // Create blob
        let blob = new Blob([htmlContent], {type: "text/html"});
        
        // Get user preferences
        let userPreferences = UserPreferences.readFromLocalStorage();
        let backgroundDownload = userPreferences.noDownloadPopup.value;
        
        // Download file
        if (typeof Download !== "undefined" && Download.save) {
            await Download.save(blob, fileName, true, backgroundDownload);
        } else {
            // Fallback download
            this.fallbackDownload(blob, fileName);
        }
    }
    
    /**
    * Fallback download method using anchor element
    */
    static fallbackDownload(blob, fileName) {
        let url = URL.createObjectURL(blob);
        let a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
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
        ${content}
    </div>
</body>
</html>`;
    }

    /**
    * Get the book title from the UI
    */
    static getBookTitle() {
        try {
            let titleElement = document.getElementById("titleInput");
            if (titleElement && titleElement.value && titleElement.value.trim()) {
                return titleElement.value.trim();
            }
        } catch (error) {
            // Fallback if DOM access fails
        }
        return "Book";
    }

    /**
    * Create HTML filename with format "BookTitle_ChapterTitle.html"
    */
    static createHtmlFilename(bookTitle, chapterTitle) {
        let sanitizedBookTitle = ChapterCache.sanitizeFilename(bookTitle || "Book");
        let sanitizedChapterTitle = ChapterCache.sanitizeFilename(chapterTitle || "Chapter");
        
        return `${sanitizedBookTitle}_${sanitizedChapterTitle}.html`;
    }

    /**
    * Sanitize filename for safe file system usage
    */
    static sanitizeFilename(filename) {
        if (!filename || filename.trim() === "") {
            return "Chapter";
        }
        
        let sanitized = filename.trim();
        
        // First, normalize whitespace - replace any whitespace sequences with single space
        sanitized = sanitized.replace(/\s+/g, " ");
        
        // Use a more conservative approach instead of util.safeForFileName to avoid ellipsis issues
        // Replace problematic characters with underscores, then normalize underscores
        sanitized = sanitized
            .replace(/[<>:"/\\|?*]/g, "_")  // Replace illegal filename chars
            .replace(/[ ]/g, "_")           // Replace spaces with underscores
            .replace(/[^\w\-_.]/g, "_")     // Replace any other non-alphanumeric chars (except dash, underscore, dot)
            .replace(/_+/g, "_")            // Collapse multiple underscores to single
            .replace(/^_+|_+$/g, "");       // Remove leading/trailing underscores
        
        // Limit length to reasonable size (keeping some room for book title + chapter title + extension)
        const maxLength = 80;
        if (sanitized.length > maxLength) {
            sanitized = sanitized.substring(0, maxLength).replace(/_+$/, "");
        }
        
        // If we ended up with empty string, use fallback
        if (!sanitized) {
            sanitized = "Chapter";
        }
        
        // Additional check for Windows reserved names and illegal characters
        if (typeof Download !== "undefined" && Download.isFileNameIllegalOnWindows) {
            if (Download.isFileNameIllegalOnWindows(sanitized)) {
                // If still illegal, create a safe fallback
                sanitized = "Chapter_" + Date.now();
            }
        }
        
        return sanitized;
    }

    /**
    * Escape HTML to prevent XSS
    */
    static escapeHtml(text) {
        let div = document.createElement("div");
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Remove cached chapters from storage (simple cache removal without UI updates)
     * @param {Array<string>} chapterUrls - Array of chapter URLs to remove from cache
     */
    static async removeChaptersFromCache(chapterUrls) {
        if (!chapterUrls || chapterUrls.length === 0) {
            return;
        }

        try {
            // Get cache keys for all chapters
            let keysToRemove = chapterUrls.map(url => this.getCacheKey(url));
            
            // Remove from active storage (either session or persistent based on settings)
            await this.getActiveStorage().remove(keysToRemove);
            
        } catch (error) {
            console.error("Error removing cached chapters:", error);
        }
    }
}