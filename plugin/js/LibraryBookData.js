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

            // Parse the HTML content and extract the body
            let parser = new DOMParser();
            let doc = parser.parseFromString(chapterContent, "application/xhtml+xml");
            let body = doc.querySelector("body");
            
            if (!body) {
                throw new Error("No body content found in chapter");
            }

            return body;
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
        let libraryButton = document.getElementById("libButton");
        if (libraryButton && document.getElementById("librarySection").style.display !== "none") {
            libraryButton.click();
        }
        
        // Ensure input section is visible
        let inputSection = document.getElementById("inputSection");
        if (inputSection) {
            inputSection.classList.remove("hidden");
            inputSection.classList.add("visible");
        }
    }
}