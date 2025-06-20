/**
 * Chapter inclusion logic utilities
 * Extracted from LibraryBookData.js and ChapterUrlsUI.js for better testability
 * 
 * This module contains the core logic for determining which chapters should be
 * included by default when downloading/updating EPUBs in both normal mode and library mode.
 * 
 * It provides fallback logic when chapters don't have explicit isIncludeable values,
 * but respects existing values set by parsers, Reading List, or user selections.
 * 
 * Note: This does NOT override parser-specific logic (paywalls, scheduling) or 
 * Reading List logic (continuation downloads). Those systems set initial values
 * that this module only provides defaults for when no value is set.
 */

"use strict";

var ChapterInclusionLogic = (function() {

    /**
     * Determine the source type of a library chapter based on its URL and website presence
     * @param {object} bookChapter - Chapter from the EPUB book
     * @param {Set} normalizedWebsiteUrls - Set of normalized URLs from the website
     * @returns {string} Source type: 'library-only', 'both', or 'website'
     */
    function determineChapterSource(bookChapter, normalizedWebsiteUrls) {
        if (!bookChapter.sourceUrl || bookChapter.sourceUrl.startsWith("library://")) {
            return "library-only"; // Generated content like Information pages
        }
        
        let normalizedBookUrl = normalizeUrl(bookChapter.sourceUrl);
        let isOnWebsite = normalizedWebsiteUrls.has(normalizedBookUrl);
        
        if (isOnWebsite) {
            return "both"; // Available on both website and in book
        } else {
            return "library-only"; // Only in book (removed from website or historical)
        }
    }

    /**
     * Determine if a chapter should be included by default in downloads
     * 
     * This function provides fallback logic for chapters that don't have explicit
     * isIncludeable values. It respects existing values set by:
     * - Parsers (site-specific rules like paywalls)
     * - Reading List (continuation downloads) 
     * - Error handling (failed chapters)
     * - User selections (checkbox interactions)
     * 
     * @param {string} source - Chapter source type ('library-only', 'both', 'website', 'unknown')
     * @param {boolean} isLibraryMode - Whether we're in library mode
     * @param {boolean} existingIncludeable - Existing isIncludeable value if any
     * @returns {boolean} Whether chapter should be included by default
     */
    function shouldChapterBeIncluded(source, isLibraryMode = false, existingIncludeable = undefined) {
        // ALWAYS preserve existing values - this is critical to avoid overriding
        // parser logic, Reading List logic, error handling, or user selections
        if (existingIncludeable !== undefined) {
            return existingIncludeable;
        }
        
        if (isLibraryMode) {
            // Library mode: only include new website chapters by default
            // Chapters already in the book (library-only or both) start unchecked
            switch (source) {
                case "website":
                    return true;  // New chapters from website should be included
                case "library-only":
                case "both":
                    return false; // Existing chapters start unchecked
                case "unknown":
                default:
                    return false; // Conservative default for library mode
            }
        } else {
            // Normal mode: include all chapters by default
            // This is the fallback when parsers don't specify and Reading List doesn't apply
            switch (source) {
                case "unknown":
                case undefined:
                    return true;  // Default to including chapters in normal mode
                default:
                    return true;  // Normal mode is inclusive by default
            }
        }
    }

    /**
     * Validate that existing chapter inclusion values are being preserved
     * This helps catch bugs where one system overrides another inappropriately
     * 
     * @param {Array} chapters - Array of chapter objects
     * @param {string} context - Description of where this validation is called from
     * @returns {Array} Array of warnings about potential issues
     */
    function validateChapterInclusionValues(chapters, context = "unknown") {
        let warnings = [];
        
        chapters.forEach((chapter, index) => {
            // Check for chapters that have been processed by multiple systems
            if (Object.hasOwn(chapter, "isIncludeable") && 
                Object.hasOwn(chapter, "previousDownload") && 
                Object.hasOwn(chapter, "source")) {
                
                // Warning: Library chapters marked as includeable might be incorrect
                if (chapter.source === "library-only" && chapter.isIncludeable === true) {
                    warnings.push(`${context}: Chapter ${index} (${chapter.title}) is library-only but marked includeable`);
                }
                
                // Warning: Previously downloaded chapters marked as includeable might be incorrect
                if (chapter.previousDownload === true && chapter.isIncludeable === true) {
                    warnings.push(`${context}: Chapter ${index} (${chapter.title}) was previously downloaded but marked includeable`);
                }
            }
        });
        
        return warnings;
    }

    /**
     * Process library chapters and determine their inclusion state
     * @param {Array} bookChapters - Chapters from the EPUB book
     * @param {Set} normalizedWebsiteUrls - Set of normalized URLs from the website
     * @param {string} bookId - Library book ID
     * @returns {Array} Processed chapters with inclusion states
     */
    function processLibraryChapters(bookChapters, normalizedWebsiteUrls, bookId) {
        return bookChapters.map((bookChapter, index) => {
            let source = determineChapterSource(bookChapter, normalizedWebsiteUrls);
            let isIncludeable = shouldChapterBeIncluded(source, true);
            
            return {
                sourceUrl: bookChapter.sourceUrl,
                title: bookChapter.title,
                isInBook: true,
                previousDownload: true,
                epubSpineIndex: bookChapter.epubSpineIndex, // Preserve original spine position
                libraryBookId: bookId,
                libraryFilePath: bookChapter.libraryFilePath,
                source: source,
                chapterIndex: index,
                rawDom: null,
                isValid: true,
                isIncludeable: isIncludeable
            };
        });
    }

    /**
     * Process website chapters and determine their inclusion state
     * @param {Array} websiteChapters - Chapters from the website
     * @param {Array} bookChapters - Chapters from the EPUB book (for comparison)
     * @param {string} bookId - Library book ID
     * @returns {Array} Processed website chapters not already in book
     */
    function processWebsiteChapters(websiteChapters, bookChapters, bookId) {
        // Create set of normalized book URLs for comparison
        let normalizedBookUrls = new Set(
            bookChapters
                .filter(ch => ch.sourceUrl && !ch.sourceUrl.startsWith("library://"))
                .map(ch => normalizeUrl(ch.sourceUrl))
        );
        
        return websiteChapters
            .filter(websiteChapter => {
                // Skip if this URL already appears in the book
                let normalizedWebsiteUrl = normalizeUrl(websiteChapter.sourceUrl);
                return !normalizedBookUrls.has(normalizedWebsiteUrl);
            })
            .map(websiteChapter => {
                let isIncludeable = shouldChapterBeIncluded("website", true, websiteChapter.isIncludeable);
                
                return {
                    ...websiteChapter,
                    isInBook: false,
                    previousDownload: false,
                    libraryBookId: bookId,
                    source: "website",
                    isIncludeable: isIncludeable
                };
            });
    }

    /**
     * Normalize URL for comparison (remove trailing slashes, fragments, etc.)
     * @param {string} url - URL to normalize
     * @returns {string} Normalized URL
     */
    function normalizeUrl(url) {
        if (!url) return "";
        
        try {
            let normalizedUrl = new URL(url);
            // Remove fragment and trailing slash
            normalizedUrl.hash = "";
            if (normalizedUrl.pathname.endsWith("/") && normalizedUrl.pathname.length > 1) {
                normalizedUrl.pathname = normalizedUrl.pathname.slice(0, -1);
            }
            return normalizedUrl.toString();
        } catch (e) {
            // If URL parsing fails, just trim and remove fragment
            return url.replace(/#.*$/, "").replace(/\/$/, "");
        }
    }

    /**
     * Merge library chapters and website chapters with proper inclusion logic
     * @param {Array} bookChapters - Chapters from the EPUB book
     * @param {Array} websiteChapters - Chapters from the website
     * @param {string} bookId - Library book ID
     * @returns {Array} All chapters merged with proper inclusion states
     */
    function mergeChaptersForLibrary(bookChapters, websiteChapters, bookId) {
        // Create set of normalized website URLs for comparison
        let normalizedWebsiteUrls = new Set(websiteChapters.map(ch => normalizeUrl(ch.sourceUrl)));
        
        // Process library chapters
        let processedLibraryChapters = processLibraryChapters(bookChapters, normalizedWebsiteUrls, bookId);
        
        // Process website chapters (only those not in book)
        let processedWebsiteChapters = processWebsiteChapters(websiteChapters, bookChapters, bookId);
        
        // Return library chapters first (in book order), then new website chapters
        return [...processedLibraryChapters, ...processedWebsiteChapters];
    }

    // Public API
    return {
        determineChapterSource,
        shouldChapterBeIncluded,
        validateChapterInclusionValues,
        processLibraryChapters,
        processWebsiteChapters,
        normalizeUrl,
        mergeChaptersForLibrary
    };

})();

if (typeof module !== "undefined") {
    module.exports = ChapterInclusionLogic;
}