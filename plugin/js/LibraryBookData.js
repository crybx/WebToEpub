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
            
            // Try to get additional metadata from content.opf
            let epubPaths = util.getEpubStructure();
            let opfFile = epubContent.find(entry => entry.filename === epubPaths.contentOpf);
            if (opfFile) {
                let opfContent = await opfFile.getData(new zip.TextWriter());
                
                // Extract author if available
                let authorMatch = opfContent.match(/<dc:creator[^>]*>([^<]+)<\/dc:creator>/);
                let author = authorMatch ? authorMatch[1] : "Unknown Author";
                
                // Extract title from OPF if different
                let titleMatch = opfContent.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/);
                if (titleMatch && titleMatch[1]) {
                    title = titleMatch[1];
                }

                return {
                    title: title.replace(".epub", ""),
                    author: author,
                    sourceUrl: storyUrl
                };
            }

            return {
                title: title.replace(".epub", ""),
                author: "Unknown Author", 
                sourceUrl: storyUrl
            };
        } catch (error) {
            console.error("Error extracting metadata:", error);
            return {
                title: "Unknown Title",
                author: "Unknown Author",
                sourceUrl: ""
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
        // Populate metadata fields using main.js API
        if (bookData.metadata.sourceUrl) {
            main.setUiFieldToValue("startingUrlInput", bookData.metadata.sourceUrl);
        }
        if (bookData.metadata.title) {
            main.setUiFieldToValue("titleInput", bookData.metadata.title);
        }
        if (bookData.metadata.author) {
            main.setUiFieldToValue("authorInput", bookData.metadata.author);
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
        let librarySection = document.getElementById("hiddenBibSection");
        if (librarySection && !librarySection.hidden) {
            let libraryButton = document.getElementById("hiddenBibButton");
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
     * Compare website chapters against actual book content to detect new chapters
     * REPLACES BRITTLE READING LIST DEPENDENCY
     * @param {string} bookId - The Library book ID
     * @param {Array} websiteChapters - Chapters found on the website
     * @returns {Array} Chapters with isInBook and isIncludeable flags set
     */
    static async detectNewChapters(bookId, websiteChapters) {
        try {
            // Get full book data to map URLs to library chapter indices
            let bookData = await LibraryBookData.extractBookData(bookId);
            let bookChapterMap = new Map();
            
            bookData.chapters.forEach((bookChapter, index) => {
                if (bookChapter.sourceUrl && !bookChapter.sourceUrl.startsWith('library://')) {
                    bookChapterMap.set(bookChapter.sourceUrl, {
                        libraryChapterIndex: index,
                        title: bookChapter.title
                    });
                }
            });
            
            return websiteChapters.map(chapter => {
                let libraryInfo = bookChapterMap.get(chapter.sourceUrl);
                let isInBook = libraryInfo !== undefined;
                
                return {
                    ...chapter,
                    isInBook: isInBook,
                    isIncludeable: !isInBook, // Only new chapters selectable
                    previousDownload: isInBook, // For compatibility with existing UI
                    libraryChapterIndex: libraryInfo?.libraryChapterIndex,
                    libraryBookId: bookId
                };
            });
        } catch (error) {
            console.error("Error detecting new chapters:", error);
            // Fallback: mark all chapters as new if detection fails
            return websiteChapters.map(chapter => ({
                ...chapter,
                isInBook: false,
                isIncludeable: true,
                previousDownload: false
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

            // 1. Get book metadata and stored URL
            let storyUrl = await LibraryStorage.LibGetFromStorage("LibStoryURL" + bookId);
            if (!storyUrl) {
                throw new Error("No story URL found for this book");
            }

            // 2. Immediately show library chapters with mock parser
            console.log("Loading library chapters immediately...");
            main.resetUI();
            main.setUiFieldToValue("startingUrlInput", storyUrl);
            await LibraryBookData.loadBookWithMockParser(bookId);
            
            // 3. Clear loading indicator and switch to main UI early
            LibraryUI.LibRenderSavedEpubs();
            LibraryBookData.switchToMainUI();
            console.log("Library chapters displayed, now fetching website in background...");
            
            // 4. Fetch website chapters in background and merge when ready
            try {
                // Try to load real parser for website
                await main.onLoadAndAnalyseButtonClick();
                
                // Get chapters from website using real parser
                if (window.parser && window.parser.state && window.parser.state.webPages) {
                    let websiteChapters = [...window.parser.state.webPages.values()];
                    console.log(`Background fetch: loaded ${websiteChapters.length} chapters from website`);
                    
                    // Compare and merge with library chapters
                    let updatedChapters = await LibraryBookData.detectNewChapters(bookId, websiteChapters);
                    
                    // Update parser state with enhanced chapter data
                    window.parser.state.webPages.clear();
                    updatedChapters.forEach((chapter, index) => {
                        window.parser.state.webPages.set(index, chapter);
                    });
                    
                    // Re-populate chapter table with merged data
                    let chapterUrlsUI = new ChapterUrlsUI(window.parser);
                    await chapterUrlsUI.populateChapterUrlsTable(updatedChapters);
                    
                    // Add library-specific visual indicators
                    console.log("Background fetch complete: adding indicators for", updatedChapters.length, "chapters");
                    await LibraryBookData.addLibraryChapterIndicators(bookId, updatedChapters);
                    
                    console.log(`Background fetch complete: merged ${updatedChapters.length} total chapters`);
                } else {
                    console.log("Background fetch: Real parser did not populate chapters, keeping library-only view");
                }
                
            } catch (parserError) {
                console.log("Background fetch failed, keeping library-only view:", parserError);
                // Library chapters are already displayed, so this is graceful degradation
            }
            
            console.log(`Library book ${bookId} loaded successfully in main UI`);
            
        } catch (error) {
            console.error("Error loading library book in main UI:", error);
            // Clear loading indicator on error as well
            LibraryUI.LibRenderSavedEpubs();
            alert("Failed to load library book: " + error.message);
        }
    }

    /**
     * Add visual indicators for chapters that exist in the library book
     * @param {string} bookId - The Library book ID  
     * @param {Array} chapters - Enhanced chapters array
     */
    static async addLibraryChapterIndicators(bookId, chapters) {
        try {
            // Wait a moment for the chapter table to be fully rendered
            await new Promise(resolve => setTimeout(resolve, 200));
            
            chapters.forEach((chapter, index) => {
                // Find row by rowIndex property
                let rows = document.querySelectorAll('.chapter-row');
                let row = Array.from(rows).find(r => r.rowIndex === index);

                if (row && chapter.isInBook) {
                    // Replace cache eye icon with library eye icon for chapters that exist in book
                    let statusColumn = row.querySelector(".chapter-status-column");
                    if (statusColumn) {
                        // Remove existing cache icon and its tooltip wrapper if present
                        let existingWrapper = statusColumn.querySelector(".tooltip-wrapper");
                        if (existingWrapper) {
                            existingWrapper.remove();
                        }
                        
                        // Add library eye icon with tooltip wrapper (same structure as cache icon)
                        if (!statusColumn.querySelector(".library-chapter-view-icon")) {
                            let tooltipWrapper = document.createElement("div");
                            tooltipWrapper.classList.add("tooltip-wrapper", "clickable-icon");
                            
                            let eyeIcon = SvgIcons.createSvgElement(SvgIcons.EYE_FILL);
                            eyeIcon.classList.add("library-chapter-view-icon", "chapter-status-icon");
                            eyeIcon.style.fill = "#28a745"; // Green color for library icon
                            
                            let tooltip = document.createElement("span");
                            tooltip.classList.add("tooltipText");
                            tooltip.textContent = "View chapter from library book";
                            
                            tooltipWrapper.onclick = (e) => {
                                e.stopPropagation();
                                ChapterViewer.openLibraryChapter(bookId, chapter.libraryChapterIndex);
                            };
                            
                            tooltipWrapper.appendChild(eyeIcon);
                            tooltipWrapper.appendChild(tooltip);
                            statusColumn.insertBefore(tooltipWrapper, statusColumn.firstChild);
                        }
                    }
                    
                    // Mark row as "in library" for CSS styling
                    row.classList.add("chapter-in-library");
                } else if (row && !chapter.isInBook) {
                    // Mark new chapters for visual distinction
                    row.classList.add("chapter-new-on-website");
                }
            });
            
        } catch (error) {
            console.error("Error adding library chapter indicators:", error);
        }
    }

    /**
     * Fallback method when real parser fails - uses mock parser with library content
     * @param {string} bookId - The Library book ID
     */
    static async loadBookWithMockParser(bookId) {
        try {
            console.log("Loading library book with mock parser as fallback");
            
            // Use existing LibSelectBook logic as fallback
            await LibraryBookData.LibSelectBook({dataset: {libepubid: bookId}});
            
        } catch (error) {
            console.error("Error loading book with mock parser:", error);
            throw error;
        }
    }
}