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
            let epubPaths = util.getEpubStructure();
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
     * @returns {Array} Array of chapter objects for UI
     */
    static async extractChapterList(epubContent, bookId) {
        try {
            // Get content.opf to find chapter order
            let epubPaths = util.getEpubStructure();
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

            // Build chapter list
            let chapters = [];
            let chapterIndex = 0;
            
            for (let i = 0; i < itemrefMatches.length; i++) {
                let idrefMatch = itemrefMatches[i].match(/idref="([^"]+)"/);
                if (!idrefMatch) continue;

                let idref = idrefMatch[1];
                let href = manifest[idref];
                if (!href) continue;

                // Skip cover and non-chapter files
                if (href.includes("Cover") || href.includes("nav.xhtml") || href.includes("toc")) {
                    continue;
                }

                let fullPath = epubPaths.contentDir + "/" + href;
                let chapterFile = epubContent.find(entry => entry.filename === fullPath);
                if (!chapterFile) continue;
                
                // Try to extract chapter title from the file
                let chapterContent = await chapterFile.getData(new zip.TextWriter());
                let titleMatch = chapterContent.match(/<title[^>]*>([^<]+)<\/title>/) || 
                                chapterContent.match(/<h[1-6][^>]*>([^<]+)<\/h[1-6]>/);
                
                let title = titleMatch ? titleMatch[1] : `Chapter ${chapterIndex + 1}`;

                // Use original source URL if available, otherwise use library URL
                // The source URLs are keyed by "id.{idref}" format
                let sourceUrlKey = `id.${idref}`;
                let sourceUrl = sourceUrls[sourceUrlKey] || `library://${bookId}/${chapterIndex}`;
                
                chapters.push({
                    sourceUrl: sourceUrl,
                    title: title,
                    libraryBookId: bookId,
                    libraryChapterIndex: chapterIndex,
                    libraryFilePath: fullPath
                });
                
                chapterIndex++;
            }

            return chapters;
        } catch (error) {
            console.error("Error extracting chapter list:", error);
            throw error;
        }
    }

    /**
     * Get individual chapter content from Library EPUB
     * @param {string} bookId - The Library book ID
     * @param {number} chapterIndex - The chapter index
     * @returns {Element} Chapter content as DOM element
     */
    static async getChapterContent(bookId, chapterIndex) {
        try {
            // First extract book data to get chapter info
            let bookData = await LibraryBookData.extractBookData(bookId);
            let chapter = bookData.chapters[chapterIndex];
            if (!chapter) {
                throw new Error("Chapter not found");
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
     * Select Library book for editing in main UI
     * @param {HTMLElement} objbtn - The select button element
     */
    static async LibSelectBook(objbtn) {
        try {
            let bookId = objbtn.dataset.libepubid;
            
            // Extract book data from stored EPUB
            let bookData = await LibraryBookData.extractBookData(bookId);
            
            // Populate main UI with book data
            LibraryBookData.populateMainUIWithBookData(bookData);
            
            // Switch to main tab/section
            LibraryBookData.switchToMainUI();
            
        } catch (error) {
            console.error("Error selecting library book:", error);
            ErrorLog.showErrorMessage("Failed to load library book: " + error.message);
        }
    }

    /**
     * Populate main UI with library book data
     * @param {Object} bookData - Extracted book data with metadata and chapters
     */
    static populateMainUIWithBookData(bookData) {
        // Populate main metadata fields using main.js API
        if (bookData.metadata.sourceUrl) {
            main.setUiFieldToValue("startingUrlInput", bookData.metadata.sourceUrl);
        }
        if (bookData.metadata.title) {
            main.setUiFieldToValue("titleInput", bookData.metadata.title);
        }
        if (bookData.metadata.author) {
            main.setUiFieldToValue("authorInput", bookData.metadata.author);
        }
        if (bookData.metadata.language) {
            main.setUiFieldToValue("languageInput", bookData.metadata.language);
        }
        if (bookData.metadata.filename) {
            main.setUiFieldToValue("fileNameInput", bookData.metadata.filename);
        }
        if (bookData.metadata.coverUrl) {
            main.setUiFieldToValue("coverImageUrlInput", bookData.metadata.coverUrl);
        }
        
        // Populate advanced metadata fields (only visible when "Show more Metadata options" is checked)
        if (bookData.metadata.subject) {
            main.setUiFieldToValue("subjectInput", bookData.metadata.subject);
        }
        if (bookData.metadata.description) {
            main.setUiFieldToValue("descriptionInput", bookData.metadata.description);
        }
        if (bookData.metadata.seriesName) {
            main.setUiFieldToValue("seriesNameInput", bookData.metadata.seriesName);
        }
        if (bookData.metadata.seriesIndex) {
            main.setUiFieldToValue("seriesIndexInput", bookData.metadata.seriesIndex);
        }
        
        // Create a mock parser to work with existing UI
        let libraryParser = {
            getPagesToFetch: () => new Map(bookData.chapters.map((ch, i) => [i, ch])),
            setPagesToFetch: (chapters) => {
                // Store updated chapter list if needed
            },
            getRateLimit: () => 0, // Library chapters don't need rate limiting
            constructor: { name: "LibraryParser" },
            
            // Mock state.webPages property for cache checking
            state: {
                webPages: new Map(bookData.chapters.map((ch, i) => [i, {...ch, isIncludeable: true}]))
            },
            
            // Mock fetchWebPageContent for download functionality
            async fetchWebPageContent(sourceUrl) {
                try {
                    // Ensure sourceUrl is a string
                    let urlString = typeof sourceUrl === 'string' ? sourceUrl : sourceUrl?.sourceUrl || String(sourceUrl);
                    
                    // Check if this is a library chapter
                    if (urlString.startsWith("library://")) {
                        // Parse library URL: library://bookId/chapterIndex
                        let urlParts = urlString.replace("library://", "").split("/");
                        let bookId = urlParts[0];
                        let chapterIndex = parseInt(urlParts[1]);
                        
                        // Get chapter content from Library
                        return await LibraryBookData.getChapterContent(bookId, chapterIndex);
                    } else {
                        // For original URLs, find the matching library chapter
                        let chapter = bookData.chapters.find(ch => ch.sourceUrl === urlString);
                        if (chapter) {
                            return await LibraryBookData.getChapterContent(chapter.libraryBookId, chapter.libraryChapterIndex);
                        }
                        throw new Error("Chapter not found in library book");
                    }
                } catch (error) {
                    console.error("Error fetching library chapter content:", error);
                    throw error;
                }
            }
        };
        
        // Store the parser globally for ChapterUrlsUI to access
        window.parser = libraryParser;
        
        // Use existing ChapterUrlsUI to display chapters
        let chapterUrlsUI = new ChapterUrlsUI(libraryParser);
        chapterUrlsUI.populateChapterUrlsTable(bookData.chapters);
        
        // Connect button handlers for the library chapters
        chapterUrlsUI.connectButtonHandlers();
    }

    /**
     * Switch to main UI section
     */
    static switchToMainUI() {
        // Hide library section if visible
        let librarySection = document.getElementById("libraryExpandableSection");
        if (librarySection && !librarySection.hidden) {
            let libraryButton = document.getElementById("libraryButton");
            if (libraryButton) {
                libraryButton.click();
            }
        }
        
        // Ensure input section is visible
        let inputSection = document.getElementById("inputSection");
        if (inputSection) {
            inputSection.classList.remove("hidden");
            inputSection.classList.add("visible");
        }
    }

    /**
     * Get chapter URLs that exist in a library book (RELIABLE - uses actual EPUB content)
     * @param {string} bookId - The Library book ID
     * @returns {Array<string>} Array of chapter URLs found in the book
     */
    static async getChapterUrlsInBook(bookId) {
        try {
            let bookData = await LibraryBookData.extractBookData(bookId);
            // Return only real URLs (not library:// URLs) that exist in the book
            return bookData.chapters
                .map(ch => ch.sourceUrl)
                .filter(url => url && !url.startsWith('library://'));
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
        if (!url || typeof url !== 'string') {
            return url;
        }
        
        // Decode HTML entities
        return url
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'");
    }

    /**
     * Compare website chapters against actual book content to show ALL chapters in book order
     * REPLACES BRITTLE READING LIST DEPENDENCY
     * @param {string} bookId - The Library book ID
     * @param {Array} websiteChapters - Chapters found on the website
     * @returns {Array} All chapters in book order with website chapters added at end
     */
    static async detectNewChapters(bookId, websiteChapters) {
        try {
            // Get full book data to show all chapters in order
            let bookData = await LibraryBookData.extractBookData(bookId);
            
            // Normalize URLs for comparison
            let normalizedWebsiteUrls = new Set(websiteChapters.map(ch => LibraryBookData.normalizeUrl(ch.sourceUrl)));
            let finalChapters = [];
            
            // Track URL occurrences to detect duplicates (using normalized URLs)
            let urlCounts = new Map();
            let urlFirstOccurrence = new Map();
            
            // First pass: count URL occurrences and track first occurrence
            bookData.chapters.forEach((bookChapter, index) => {
                if (bookChapter.sourceUrl && !bookChapter.sourceUrl.startsWith('library://')) {
                    let normalizedUrl = LibraryBookData.normalizeUrl(bookChapter.sourceUrl);
                    let count = urlCounts.get(normalizedUrl) || 0;
                    urlCounts.set(normalizedUrl, count + 1);
                    
                    // Track first occurrence index
                    if (!urlFirstOccurrence.has(normalizedUrl)) {
                        urlFirstOccurrence.set(normalizedUrl, index);
                    }
                }
            });
            
            // 1. Add ALL library chapters in book order (including duplicates with detection)
            bookData.chapters.forEach((bookChapter, index) => {
                let normalizedBookUrl = LibraryBookData.normalizeUrl(bookChapter.sourceUrl);
                let isOnWebsite = normalizedWebsiteUrls.has(normalizedBookUrl);
                
                // Determine source type
                let source;
                if (!bookChapter.sourceUrl || bookChapter.sourceUrl.startsWith('library://')) {
                    source = 'library-only'; // Generated content like Information pages
                } else if (isOnWebsite) {
                    source = 'both'; // Available on both website and in book
                } else {
                    source = 'library-only'; // Only in book (removed from website or historical)
                }
                
                // Check if this is a duplicate (using normalized URLs)
                let isDuplicate = false;
                let duplicateInfo = null;
                if (bookChapter.sourceUrl && !bookChapter.sourceUrl.startsWith('library://')) {
                    let normalizedUrl = LibraryBookData.normalizeUrl(bookChapter.sourceUrl);
                    let totalCount = urlCounts.get(normalizedUrl) || 1;
                    let isFirstOccurrence = urlFirstOccurrence.get(normalizedUrl) === index;
                    
                    if (totalCount > 1) {
                        isDuplicate = true;
                        duplicateInfo = {
                            totalCount: totalCount,
                            isFirstOccurrence: isFirstOccurrence,
                            occurrenceNumber: [...bookData.chapters].slice(0, index + 1)
                                .filter(ch => LibraryBookData.normalizeUrl(ch.sourceUrl) === normalizedUrl).length
                        };
                    }
                }
                
                finalChapters.push({
                    sourceUrl: bookChapter.sourceUrl,
                    title: bookChapter.title,
                    isInBook: true,
                    previousDownload: true,
                    libraryChapterIndex: index,
                    libraryBookId: bookId,
                    source: source,
                    // Duplicate detection properties
                    isDuplicate: isDuplicate,
                    duplicateInfo: duplicateInfo,
                    // Add library-specific properties for ChapterViewer compatibility
                    chapterIndex: index,
                    rawDom: null, // Will be loaded on demand
                    // Add properties needed for normal chapter UI functionality
                    isValid: true,
                    isIncludeable: source === 'library-only' // Library-only chapters start unchecked
                });
            });
            
            // 2. Add website-only chapters at the end (new chapters not in book)
            websiteChapters.forEach(websiteChapter => {
                // Skip if this URL already appears in the book (using normalized URLs)
                let normalizedWebsiteUrl = LibraryBookData.normalizeUrl(websiteChapter.sourceUrl);
                let alreadyInBook = bookData.chapters.some(bookCh => 
                    LibraryBookData.normalizeUrl(bookCh.sourceUrl) === normalizedWebsiteUrl
                );
                if (!alreadyInBook) {
                    finalChapters.push({
                        ...websiteChapter,
                        isInBook: false,
                        previousDownload: false,
                        libraryBookId: bookId,
                        source: 'website',
                        // New website chapters start checked for inclusion
                        isIncludeable: websiteChapter.isIncludeable !== undefined ? websiteChapter.isIncludeable : true
                    });
                }
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
                source: 'website'
            }));
        }
    }

    /**
     * COMBINED LIBRARY BOOK LOADING - Replaces separate "Search new Chapters" and "Select" actions
     * @param {string} bookId - The Library book ID
     */
    static async loadLibraryBookInMainUI(bookId) {
        try {
            // Show loading indicator
            LibraryUI.LibShowLoadingText();

            // 1. Extract EPUB metadata and populate UI with it
            let bookData = await LibraryBookData.extractBookData(bookId);
            main.resetUI();
            LibraryBookData.populateMainUIWithBookData(bookData);
            
            // 2. Load library chapters with mock parser
            await LibraryBookData.loadBookWithMockParser(bookId);
            
            // 3. Clear loading indicator and switch to main UI early
            LibraryUI.LibRenderSavedEpubs();
            LibraryBookData.switchToMainUI();
            
            // 4. Fetch website chapters in background and merge when ready (preserving EPUB metadata)
            try {
                // Store actual EPUB metadata (not defaults) before website fetch
                let epubMetadata = bookData.metadata;
                
                // Try to load real parser for website
                await main.onLoadAndAnalyseButtonClick();
                
                // Restore only non-empty EPUB metadata after website parsing
                // Only override website data if we have actual EPUB metadata values
                if (epubMetadata.title && epubMetadata.title.trim() !== "") {
                    main.setUiFieldToValue("titleInput", epubMetadata.title);
                }
                if (epubMetadata.author && epubMetadata.author.trim() !== "") {
                    main.setUiFieldToValue("authorInput", epubMetadata.author);
                }
                if (epubMetadata.language && epubMetadata.language.trim() !== "") {
                    main.setUiFieldToValue("languageInput", epubMetadata.language);
                }
                if (epubMetadata.filename && epubMetadata.filename.trim() !== "") {
                    main.setUiFieldToValue("fileNameInput", epubMetadata.filename);
                }
                if (epubMetadata.coverUrl && epubMetadata.coverUrl.trim() !== "") {
                    main.setUiFieldToValue("coverImageUrlInput", epubMetadata.coverUrl);
                }
                if (epubMetadata.subject && epubMetadata.subject.trim() !== "") {
                    main.setUiFieldToValue("subjectInput", epubMetadata.subject);
                }
                if (epubMetadata.description && epubMetadata.description.trim() !== "") {
                    main.setUiFieldToValue("descriptionInput", epubMetadata.description);
                }
                if (epubMetadata.seriesName && epubMetadata.seriesName.trim() !== "") {
                    main.setUiFieldToValue("seriesNameInput", epubMetadata.seriesName);
                }
                if (epubMetadata.seriesIndex && epubMetadata.seriesIndex.trim() !== "") {
                    main.setUiFieldToValue("seriesIndexInput", epubMetadata.seriesIndex);
                }
                
                // Get chapters from website using real parser
                if (window.parser && window.parser.state && window.parser.state.webPages) {
                    let websiteChapters = [...window.parser.state.webPages.values()];
                    
                    // Compare and merge with library chapters
                    let updatedChapters = await LibraryBookData.detectNewChapters(bookId, websiteChapters);
                    
                    // Update parser state with enhanced chapter data
                    window.parser.state.webPages.clear();
                    updatedChapters.forEach((chapter, index) => {
                        window.parser.state.webPages.set(index, chapter);
                    });
                    
                    // Update chapter table incrementally with merged data
                    let chapterUrlsUI = new ChapterUrlsUI(window.parser);
                    await chapterUrlsUI.updateChapterTableIncremental(updatedChapters);
                    
                    // Add library-specific visual indicators
                    await ChapterUrlsUI.addLibraryChapterIndicators(bookId, updatedChapters);
                }
                
            } catch (parserError) {
                // Library chapters are already displayed, so this is graceful degradation
            }
            
        } catch (error) {
            console.error("Error loading library book in main UI:", error);
            LibraryUI.LibRenderSavedEpubs();
            alert("Failed to load library book: " + error.message);
        }
    }

    /**
     * Add visual indicators for chapters that exist in the library book
     * @param {string} bookId - The Library book ID  
     * @param {Array} chapters - Enhanced chapters array
     */

    /**
     * Fallback method when real parser fails - uses mock parser with library content
     * @param {string} bookId - The Library book ID
     */
    static async loadBookWithMockParser(bookId) {
        try {
            // Use existing LibSelectBook logic as fallback
            await LibraryBookData.LibSelectBook({dataset: {libepubid: bookId}});
            
        } catch (error) {
            console.error("Error loading book with mock parser:", error);
            throw error;
        }
    }
}