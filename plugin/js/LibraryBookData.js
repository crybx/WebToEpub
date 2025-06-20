/*
  LibraryBookData class - handles EPUB content extraction, chapter parsing, and book data operations
*/
"use strict";

class LibraryBookData {
    
    /**
     * Extract book data (chapters and metadata) from stored Library EPUB
     * @param {string} bookId - The Library book ID
     * @returns {Object} Object with chapters array and metadata
     */
    static async extractBookData(bookId) {
        try {
            // Get the stored EPUB data
            let epubBase64 = await LibraryStorage.LibGetFromStorage("LibEpub" + bookId);
            if (!epubBase64) {
                throw new Error("Book not found in library");
            }

            // Read the EPUB ZIP file
            let epubReader = new zip.Data64URIReader(epubBase64);
            let epubZip = new zip.ZipReader(epubReader, {useWebWorkers: false});
            let epubContent = await epubZip.getEntries();
            epubContent = epubContent.filter(a => !a.directory);

            // Get book metadata
            let metadata = await LibraryBookData.extractBookMetadata(epubContent, bookId);
            
            // Get chapter list from content.opf
            let chapters = await LibraryBookData.extractChapterList(epubContent, bookId);

            await epubZip.close();

            return {
                metadata: metadata,
                chapters: chapters
            };
        } catch (error) {
            console.error("Error extracting book data:", error);
            throw error;
        }
    }

    /**
     * Extract metadata from EPUB content
     * @param {Array} epubContent - EPUB file entries
     * @param {string} bookId - The Library book ID
     * @returns {Object} Book metadata
     */
    static async extractBookMetadata(epubContent, bookId) {
        try {
            // Get stored metadata
            let title = await LibraryStorage.LibGetFromStorage("LibFilename" + bookId) || "Unknown Title";
            let storyUrl = await LibraryStorage.LibGetFromStorage("LibStoryURL" + bookId) || "";
            
            // Initialize metadata with empty defaults
            let metadata = {
                title: title.replace(".epub", ""),
                author: "",
                sourceUrl: storyUrl,
                language: "",
                filename: title.replace(".epub", ""),
                coverUrl: "",
                description: "",
                subject: "",
                seriesName: "",
                seriesIndex: ""
            };
            
            // Try to get additional metadata from content.opf
            let epubPaths = EpubStructure.get();
            let opfFile = epubContent.find(entry => entry.filename === epubPaths.contentOpf);
            if (opfFile) {
                let opfContent = await opfFile.getData(new zip.TextWriter());
                
                // Extract title from OPF
                let titleMatch = opfContent.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/);
                if (titleMatch && titleMatch[1]) {
                    metadata.title = titleMatch[1];
                }
                
                // Extract author
                let authorMatch = opfContent.match(/<dc:creator[^>]*>([^<]+)<\/dc:creator>/);
                if (authorMatch && authorMatch[1]) {
                    metadata.author = authorMatch[1];
                }
                
                // Extract language
                let languageMatch = opfContent.match(/<dc:language[^>]*>([^<]+)<\/dc:language>/);
                if (languageMatch && languageMatch[1]) {
                    metadata.language = languageMatch[1];
                }
                
                // Extract description
                let descriptionMatch = opfContent.match(/<dc:description[^>]*>([^<]+)<\/dc:description>/);
                if (descriptionMatch && descriptionMatch[1]) {
                    metadata.description = descriptionMatch[1];
                }
                
                // Extract subject/tags
                let subjectMatch = opfContent.match(/<dc:subject[^>]*>([^<]+)<\/dc:subject>/);
                if (subjectMatch && subjectMatch[1]) {
                    metadata.subject = subjectMatch[1];
                }
                
                // Extract series information from meta tags
                let seriesMatch = opfContent.match(/<meta name="calibre:series"[^>]*content="([^"]+)"/);
                if (seriesMatch && seriesMatch[1]) {
                    metadata.seriesName = seriesMatch[1];
                }
                
                let seriesIndexMatch = opfContent.match(/<meta name="calibre:series_index"[^>]*content="([^"]+)"/);
                if (seriesIndexMatch && seriesIndexMatch[1]) {
                    metadata.seriesIndex = seriesIndexMatch[1];
                }
            }
            
            // Get cover image from stored data
            try {
                let coverData = await LibraryStorage.LibGetFromStorage("LibCover" + bookId);
                if (coverData && coverData.trim() !== "") {
                    metadata.coverUrl = coverData;
                }
            } catch (error) {
                console.error("Error getting cover data:", error);
            }

            return metadata;
        } catch (error) {
            console.error("Error extracting metadata:", error);
            return {
                title: "",
                author: "",
                sourceUrl: "",
                language: "",
                filename: "",
                coverUrl: "",
                description: "",
                subject: "",
                seriesName: "",
                seriesIndex: ""
            };
        }
    }

    /**
     * Extract chapter list from EPUB content
     * @param {Array} epubContent - EPUB file entries  
     * @param {string} bookId - The Library book ID
     * @returns {Promise<Array>} Promise that resolves to array of chapter objects
     */
    static async extractChapterList(epubContent, bookId) {
        try {
            // Get content.opf to find chapter order
            let epubPaths = EpubStructure.get();
            let opfFile = epubContent.find(entry => entry.filename === epubPaths.contentOpf);
            if (!opfFile) {
                throw new Error("content.opf not found");
            }

            let opfContent = await opfFile.getData(new zip.TextWriter());
            
            // Extract original source URLs from dc:source elements
            let sourceUrls = {};
            let sourceMatches = opfContent.match(/<dc:source[^>]*id="([^"]+)"[^>]*>([^<]+)<\/dc:source>/g);
            if (sourceMatches) {
                sourceMatches.forEach(match => {
                    let idMatch = match.match(/id="([^"]+)"/);
                    let urlMatch = match.match(/>([^<]+)<\/dc:source>/);
                    if (idMatch && urlMatch) {
                        sourceUrls[idMatch[1]] = urlMatch[1];
                    }
                });
            }
            
            // Extract chapter files from spine
            let spineMatches = opfContent.match(/<spine[^>]*>(.*?)<\/spine>/s);
            if (!spineMatches) {
                throw new Error("spine not found in content.opf");
            }

            let itemrefMatches = spineMatches[1].match(/<itemref[^>]*idref="([^"]+)"/g);
            if (!itemrefMatches) {
                throw new Error("No chapters found in spine");
            }

            // Get manifest to map idrefs to filenames
            let manifestMatches = opfContent.match(/<manifest[^>]*>(.*?)<\/manifest>/s);
            let manifest = {};
            if (manifestMatches) {
                let itemMatches = manifestMatches[1].match(/<item[^>]*>/g);
                if (itemMatches) {
                    itemMatches.forEach(match => {
                        let idMatch = match.match(/id="([^"]+)"/);
                        let hrefMatch = match.match(/href="([^"]+)"/);
                        if (idMatch && hrefMatch) {
                            manifest[idMatch[1]] = hrefMatch[1];
                        }
                    });
                }
            }

            // Build chapter list - include ALL spine items to get real spine positions
            let chapters = [];
            
            for (let spinePosition = 0; spinePosition < itemrefMatches.length; spinePosition++) {
                let idrefMatch = itemrefMatches[spinePosition].match(/idref="([^"]+)"/);
                if (!idrefMatch) continue;

                let idref = idrefMatch[1];
                let href = manifest[idref];
                if (!href) continue;

                let fullPath = epubPaths.contentDir + "/" + href;
                let chapterFile = epubContent.find(entry => entry.filename === fullPath);
                if (!chapterFile) continue;
                
                // Try to extract title from the file
                let chapterContent = await chapterFile.getData(new zip.TextWriter());
                let titleMatch = chapterContent.match(/<title[^>]*>([^<]+)<\/title>/) || 
                                chapterContent.match(/<h[1-6][^>]*>([^<]+)<\/h[1-6]>/);
                
                let title = titleMatch ? titleMatch[1] : href; // Use filename if no title found

                // Use original source URL if available, otherwise use library URL
                // The source URLs are keyed by "id.{idref}" format
                let sourceUrlKey = `id.${idref}`;
                let sourceUrl = sourceUrls[sourceUrlKey] || `library://${bookId}/${spinePosition}`;
                
                chapters.push({
                    sourceUrl: sourceUrl,
                    title: title,
                    libraryBookId: bookId,
                    epubSpineIndex: spinePosition, // Use ACTUAL spine position
                    libraryFilePath: fullPath
                });
            }

            // Filter out cover and TOC pages for display, but keep real spine positions
            return chapters.filter(chapter => {
                let href = chapter.libraryFilePath.split("/").pop();
                return !href.includes("Cover") && !href.includes("nav.xhtml") && !href.includes("toc");
            });
        } catch (error) {
            console.error("Error extracting chapter list:", error);
            throw error;
        }
    }

    /**
     * Get individual chapter content from Library EPUB
     * @param {string} bookId - The Library book ID
     * @param {number} spinePosition - The chapter's position in the EPUB spine (epubSpineIndex)
     * @returns {Element} Chapter content as DOM element
     */
    static async getChapterContent(bookId, spinePosition) {
        try {
            // First extract book data to get chapter info
            let bookData = await LibraryBookData.extractBookData(bookId);
            // Find chapter by spine position, not array index
            let chapter = bookData.chapters.find(ch => ch.epubSpineIndex === spinePosition);
            if (!chapter) {
                throw new Error(`Chapter not found at spine position ${spinePosition}`);
            }

            // Get the EPUB content again 
            let epubBase64 = await LibraryStorage.LibGetFromStorage("LibEpub" + bookId);
            let epubReader = new zip.Data64URIReader(epubBase64);
            let epubZip = new zip.ZipReader(epubReader, {useWebWorkers: false});
            let epubContent = await epubZip.getEntries();
            epubContent = epubContent.filter(a => !a.directory);

            // Find and read the specific chapter file
            let chapterFile = epubContent.find(entry => entry.filename === chapter.libraryFilePath);
            if (!chapterFile) {
                throw new Error("Chapter file not found in EPUB");
            }

            let chapterContent = await chapterFile.getData(new zip.TextWriter());
            await epubZip.close();

            // Parse the HTML content and extract the body content (not the body tag itself)
            let parser = new DOMParser();
            let doc = parser.parseFromString(chapterContent, "application/xhtml+xml");
            let body = doc.querySelector("body");
            
            if (!body) {
                throw new Error("No body content found in chapter");
            }

            // Create a div containing only the body's inner content to match cached content structure
            let contentDiv = document.createElement("div");
            contentDiv.innerHTML = body.innerHTML;
            
            return contentDiv;
        } catch (error) {
            console.error("Error getting chapter content:", error);
            throw error;
        }
    }



    /**
     * Get chapter URLs that exist in a library book (RELIABLE - uses actual EPUB content)
     * @param {string} bookId - The Library book ID
     * @returns {Promise<Array<string>>} Array of chapter URLs found in the book
     */
    static async getChapterUrlsInBook(bookId) {
        try {
            let bookData = await LibraryBookData.extractBookData(bookId);
            // Return only real URLs (not library:// URLs) that exist in the book
            return bookData.chapters
                .map(ch => ch.sourceUrl)
                .filter(url => url && !url.startsWith("library://"));
        } catch (error) {
            console.error("Error extracting chapter URLs from book:", error);
            return [];
        }
    }

    /**
     * Normalize URL by decoding HTML entities (e.g., &amp; -> &)
     * @param {string} url - The URL to normalize
     * @returns {string} Normalized URL
     */
    static normalizeUrl(url) {
        if (!url || typeof url !== "string") {
            return url;
        }
        
        // Decode HTML entities
        return url
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, "\"")
            .replace(/&#39;/g, "'");
    }

    /**
     * Compare website chapters against actual book content to show ALL chapters in book order
     * REPLACES BRITTLE READING LIST DEPENDENCY
     * @param {string} bookId - The Library book ID
     * @param {Array} websiteChapters - Chapters found on the website
     * @returns Promise<{Array}> All chapters in book order with website chapters added at end
     */
    static async detectNewChapters(bookId, websiteChapters) {
        try {
            // Get full book data to show all chapters in order
            let bookData = await LibraryBookData.extractBookData(bookId);
            
            // Use the new ChapterInclusionLogic for core merge logic
            let mergedChapters = ChapterInclusionLogic.mergeChaptersForLibrary(
                bookData.chapters, 
                websiteChapters, 
                bookId
            );
            
            // Add duplicate detection logic (kept separate as it's UI-specific)
            let urlCounts = new Map();
            let urlFirstOccurrence = new Map();
            
            // First pass: count URL occurrences and track first occurrence
            bookData.chapters.forEach((bookChapter, index) => {
                if (bookChapter.sourceUrl && !bookChapter.sourceUrl.startsWith("library://")) {
                    let normalizedUrl = LibraryBookData.normalizeUrl(bookChapter.sourceUrl);
                    let count = urlCounts.get(normalizedUrl) || 0;
                    urlCounts.set(normalizedUrl, count + 1);
                    
                    // Track first occurrence index
                    if (!urlFirstOccurrence.has(normalizedUrl)) {
                        urlFirstOccurrence.set(normalizedUrl, index);
                    }
                }
            });
            
            // Add duplicate detection to merged chapters
            let finalChapters = mergedChapters.map((chapter, mergedIndex) => {
                let isDuplicate = false;
                let duplicateInfo = null;
                
                if (chapter.isInBook && chapter.sourceUrl && !chapter.sourceUrl.startsWith("library://")) {
                    let normalizedUrl = LibraryBookData.normalizeUrl(chapter.sourceUrl);
                    let totalCount = urlCounts.get(normalizedUrl) || 1;
                    let bookIndex = chapter.epubSpineIndex;
                    let isFirstOccurrence = urlFirstOccurrence.get(normalizedUrl) === bookIndex;
                    
                    if (totalCount > 1) {
                        isDuplicate = true;
                        duplicateInfo = {
                            totalCount: totalCount,
                            isFirstOccurrence: isFirstOccurrence,
                            occurrenceNumber: [...bookData.chapters].slice(0, bookIndex + 1)
                                .filter(ch => LibraryBookData.normalizeUrl(ch.sourceUrl) === normalizedUrl).length
                        };
                    }
                }
                
                return {
                    ...chapter,
                    isDuplicate: isDuplicate,
                    duplicateInfo: duplicateInfo
                };
            });
            
            return finalChapters;
            
        } catch (error) {
            console.error("Error merging chapters:", error);
            // Fallback: mark all website chapters as new if merging fails
            return websiteChapters.map(chapter => ({
                ...chapter,
                isInBook: false,
                isIncludeable: true,
                previousDownload: false,
                source: "website"
            }));
        }
    }


    /**
     * Simple hash function for content comparison
     * @param {string} str - String to hash
     * @returns {string} Simple hash value
     */
    static simpleHash(str) {
        let hash = 0;
        if (str.length === 0) return hash.toString();
        for (let i = 0; i < str.length; i++) {
            let char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash).toString(16);
    }

    /**
     * Add visual indicators for chapters that exist in the library book
     * @param {string} bookId - The Library book ID  
     * @param {Array} chapters - Enhanced chapters array
     */


    /**
     * Calculate the correct insertion index for a chapter in the EPUB spine based on its position in the UI list
     * Uses the actual epubSpineIndex values of adjacent chapters in the UI to determine correct spine position
     * @param {Object} chapter - Chapter object
     * @param {string} sourceUrl - Chapter source URL
     * @returns {Promise<number>} The index where the chapter should be inserted in the EPUB spine
     */
    static async calculateChapterInsertionIndex(chapter, sourceUrl) {
        try {
            if (!window.parser || !window.parser.state || !window.parser.state.webPages) {
                throw new Error("Parser state not available");
            }

            // Get all chapters from parser state (this preserves UI order)
            let allChapters = [...window.parser.state.webPages.values()];
            
            // Find the position of our target chapter in the UI list
            let targetChapterIndexInUI = allChapters.findIndex(ch => ch.sourceUrl === sourceUrl);
            if (targetChapterIndexInUI === -1) {
                throw new Error("Target chapter not found in UI list");
            }

            // Look backwards in UI to find the previous library chapter with a real spine index
            let previousLibraryChapterIndex = null;
            for (let i = targetChapterIndexInUI - 1; i >= 0; i--) {
                let prevChapter = allChapters[i];
                if (prevChapter.isInBook && prevChapter.epubSpineIndex !== undefined) {
                    previousLibraryChapterIndex = prevChapter.epubSpineIndex;
                    break;
                }
            }

            // Look forwards in UI to find the next library chapter with a real spine index
            let nextLibraryChapterIndex = null;
            for (let i = targetChapterIndexInUI + 1; i < allChapters.length; i++) {
                let nextChapter = allChapters[i];
                if (nextChapter.isInBook && nextChapter.epubSpineIndex !== undefined) {
                    nextLibraryChapterIndex = nextChapter.epubSpineIndex;
                    break;
                }
            }

            let insertionIndex;
            
            // Determine insertion index based on adjacent library chapters
            if (nextLibraryChapterIndex !== null) {
                // We have a next library chapter - insert right before it
                // This will push the next chapter and all subsequent chapters forward by 1
                insertionIndex = nextLibraryChapterIndex;
            } else if (previousLibraryChapterIndex !== null) {
                // We only have a previous library chapter - insert right after it
                // Since insertChapter inserts BEFORE the index, we need previousIndex + 1
                insertionIndex = previousLibraryChapterIndex + 1;
            } else {
                // No adjacent library chapters found - this is either the first chapter
                // or we need to check the current EPUB structure to append at the end
                let hasAnyLibraryChapters = allChapters.some(ch => ch.isInBook && ch.epubSpineIndex !== undefined);
                if (!hasAnyLibraryChapters) {
                    // This shouldn't even be a library book if there are no chapters. How did we get here?
                } else {
                    let bookData = await LibraryBookData.extractBookData(chapter.libraryBookId);
                    // If there are existing chapters, append after the last one
                    let lastChapter = bookData.chapters[bookData.chapters.length - 1];
                    if (lastChapter) {
                        insertionIndex = lastChapter.epubSpineIndex + 1;
                    }
                }
            }
            
            return insertionIndex;

        } catch (error) {
            console.error("Error in calculateChapterInsertionIndex:", error);
            throw error;
        }
    }
}