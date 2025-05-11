/*
  EpubUpdater class - handles modifications to existing EPUB files
  Separate from EpubPacker.js which is for initial EPUB creation
  
  Separates pure string processing (testable) from browser ZIP operations
*/
"use strict";

class EpubUpdater { // eslint-disable-line no-unused-vars
    constructor() {
        // Initialize with common EPUB manipulation utilities
    }

    // ==================== PURE STRING PROCESSING (TESTABLE) ====================

    /**
     * Remove chapter references from content.opf file
     * @param {string} contentOpf - Original content.opf content
     * @param {string} chapterNumberStr - Chapter number as 4-digit string (e.g., "0001")
     * @param {Object} epubPaths - EPUB structure paths
     * @returns {string} Updated content.opf
     */
    static removeChapterFromContentOpf(contentOpf, chapterNumberStr, epubPaths) {
        let updated = contentOpf;

        // Remove dc:source for the chapter
        let sourceRegex = new RegExp(`\\s*<dc:source id="id\\.xhtml${chapterNumberStr}"[^>]*>[^<]*<\\/dc:source>`, "g");
        updated = updated.replace(sourceRegex, "");

        // Remove manifest item for the chapter
        let manifestRegex = new RegExp(`\\s*<item href="${epubPaths.textDirRel}\\/${chapterNumberStr}\\.xhtml"[^>]*\\/>`, "g");
        updated = updated.replace(manifestRegex, "");

        // Remove spine itemref for the chapter
        let spineRegex = new RegExp(`\\s*<itemref idref="xhtml${chapterNumberStr}"\\/>`, "g");
        updated = updated.replace(spineRegex, "");

        return updated;
    }

    /**
     * Remove chapter references from toc.ncx file
     * @param {string} tocNcx - Original toc.ncx content
     * @param {number} chapterNumber - Chapter number (1-based)
     * @param {string} chapterNumberStr - Chapter number as 4-digit string
     * @returns {string} Updated toc.ncx
     */
    static removeChapterFromTocNcx(tocNcx, chapterNumber, chapterNumberStr) {
        let updated = tocNcx;

        // Remove the navPoint for the deleted chapter
        let navPointRegex = new RegExp(`\\s*<navPoint id="body${chapterNumberStr}"[^>]*>.*?<\\/navPoint>`, "gs");
        updated = updated.replace(navPointRegex, "");

        // Update playOrder for subsequent chapters (decrement by 1)
        // Find all playOrder values greater than the deleted chapter
        let playOrderUpdates = 0;
        updated = updated.replace(/playOrder="(\d+)"/g, (match, playOrderStr) => {
            let playOrder = parseInt(playOrderStr);
            if (playOrder > chapterNumber) {
                playOrderUpdates++;
                return `playOrder="${playOrder - 1}"`;
            }
            return match;
        });

        return updated;
    }

    /**
     * Remove chapter references from nav.xhtml file (EPUB 3)
     * @param {string} navXhtml - Original nav.xhtml content
     * @param {string} chapterNumberStr - Chapter number as 4-digit string
     * @param {Object} epubPaths - EPUB structure paths
     * @returns {string} Updated nav.xhtml
     */
    static removeChapterFromNavXhtml(navXhtml, chapterNumberStr, epubPaths) {
        let updated = navXhtml;

        // Remove the list item for the deleted chapter
        let listItemRegex = new RegExp(`\\s*<li><a href="${epubPaths.textDirRel}\\/${chapterNumberStr}\\.xhtml"[^>]*>[^<]*<\\/a><\\/li>`, "g");
        updated = updated.replace(listItemRegex, "");
        return updated;
    }

    /**
     * Remove chapter references from content.opf file by actual filename
     * @param {string} contentOpf - Original content.opf content
     * @param {string} chapterRelativePath - Relative path to chapter file
     * @param {string} chapterBasename - Chapter filename without extension
     * @returns {string} Updated content.opf
     */
    static removeChapterFromContentOpfByFilename(contentOpf, chapterRelativePath, chapterBasename) {
        let updated = contentOpf;

        // Remove dc:source for the chapter (may have various id formats)
        let sourceRegex = new RegExp(`\\s*<dc:source[^>]*>[^<]*${chapterBasename}[^<]*<\\/dc:source>`, "gi");
        updated = updated.replace(sourceRegex, "");

        // Remove manifest item for the chapter by href
        let manifestRegex = new RegExp(`\\s*<item href="${chapterRelativePath.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}"[^>]*\\/>`, "g");
        updated = updated.replace(manifestRegex, "");

        // Remove spine itemref by finding the id from manifest and removing spine reference
        let idMatch = contentOpf.match(new RegExp(`<item href="${chapterRelativePath.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}"[^>]*id="([^"]+)"`));
        if (idMatch) {
            let itemId = idMatch[1];
            let spineRegex = new RegExp(`\\s*<itemref idref="${itemId}"[^>]*\\/>`, "g");
            updated = updated.replace(spineRegex, "");
        }

        return updated;
    }

    /**
     * Remove chapter references from toc.ncx file by actual filename
     * @param {string} tocNcx - Original toc.ncx content
     * @param {string} chapterRelativePath - Relative path to chapter file
     * @returns {string} Updated toc.ncx
     */
    static removeChapterFromTocNcxByFilename(tocNcx, chapterRelativePath) {
        let updated = tocNcx;

        // Remove the navPoint for the deleted chapter by content src
        let navPointRegex = new RegExp(`\\s*<navPoint[^>]*>.*?<content src="${chapterRelativePath.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}"[^/>]*/>.*?<\\/navPoint>`, "gs");
        updated = updated.replace(navPointRegex, "");

        return updated;
    }

    /**
     * Remove chapter references from nav.xhtml file by actual filename
     * @param {string} navXhtml - Original nav.xhtml content
     * @param {string} chapterRelativePath - Relative path to chapter file
     * @returns {string} Updated nav.xhtml
     */
    static removeChapterFromNavXhtmlByFilename(navXhtml, chapterRelativePath) {
        let updated = navXhtml;

        // Remove the list item for the deleted chapter by href
        let listItemRegex = new RegExp(`\\s*<li><a href="${chapterRelativePath.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}"[^>]*>[^<]*<\\/a><\\/li>`, "g");
        updated = updated.replace(listItemRegex, "");

        return updated;
    }

    // ==================== HELPER METHODS ====================

    /**
     * Load EPUB and return entries and zip reader
     * @param {string} epubBase64 - Base64 encoded EPUB data
     * @returns {Promise<{entries: Array, epubZip: ZipReader}>} EPUB entries and zip reader
     */
    static async loadEpub(epubBase64) {
        let epubReader = new zip.Data64URIReader(epubBase64);
        let epubZip = new zip.ZipReader(epubReader, {useWebWorkers: false});
        let entries = await epubZip.getEntries();
        entries = entries.filter(a => !a.directory);
        return {entries, epubZip};
    }

    /**
     * Find all chapter files in the EPUB text directory
     * @param {Array} entries - EPUB entries
     * @param {Object} epubPaths - EPUB structure paths
     * @returns {Array} Sorted chapter files
     */
    static findChapterFiles(entries, epubPaths) {
        return entries.filter(e => 
            e.filename.startsWith(epubPaths.textDir) && 
            e.filename.endsWith(".xhtml") &&
            !e.filename.includes("Cover")
        ).sort((a, b) => a.filename.localeCompare(b.filename));
    }

    /**
     * Validate chapter index against available chapters (in the chapter list UI, not valid against spine order)
     * @param {number} chapterIndex - Index to validate
     * @param {Array} chapterFiles - Available chapter files
     * @param {boolean} allowAppend - Whether to allow index at end for appending
     * @returns {Object} Validated chapter file or null
     */
    static validateChapterIndex(chapterIndex, chapterFiles, allowAppend = false) {
        let maxIndex = allowAppend ? chapterFiles.length : chapterFiles.length - 1;
        if (chapterIndex < 0 || chapterIndex > maxIndex) {
            throw new Error(`Chapter index ${chapterIndex} out of range (0-${maxIndex})`);
        }
        return chapterIndex < chapterFiles.length ? chapterFiles[chapterIndex] : null;
    }

    /**
     * Create new EPUB writer
     * @returns {{newEpubWriter: BlobWriter, newEpubZip: ZipWriter}} New EPUB writer and zip
     */
    static createEpubWriter() {
        let newEpubWriter = new zip.BlobWriter("application/epub+zip");
        let newEpubZip = new zip.ZipWriter(newEpubWriter, {useWebWorkers: false, compressionMethod: 8, extendedTimestamp: false});
        return {newEpubWriter, newEpubZip};
    }

    /**
     * Copy entry to new EPUB with appropriate compression
     * @param {ZipWriter} newEpubZip - Destination zip writer
     * @param {Object} entry - Entry to copy
     */
    static async copyEntry(newEpubZip, entry) {
        if (entry.filename === "mimetype") {
            await newEpubZip.add(entry.filename, new zip.TextReader(await entry.getData(new zip.TextWriter())), {compressionMethod: 0});
        } else {
            await newEpubZip.add(entry.filename, new zip.BlobReader(await entry.getData(new zip.BlobWriter())));
        }
    }

    /**
     * Read metadata files from EPUB entries
     * @param {Array} entries - EPUB entries
     * @param {Object} epubPaths - EPUB structure paths
     * @returns {Promise<Object>} Object containing metadata content and entries
     */
    static async readMetadataFiles(entries, epubPaths) {
        let contentOpfEntry = entries.find(e => e.filename === epubPaths.contentOpf);
        let tocNcxEntry = entries.find(e => e.filename === epubPaths.tocNcx);
        let navXhtmlEntry = entries.find(e => e.filename === epubPaths.navXhtml);

        if (!contentOpfEntry || !tocNcxEntry) {
            throw new Error("Required metadata files not found in EPUB");
        }

        // Read metadata content
        let contentOpfText = await contentOpfEntry.getData(new zip.TextWriter());
        let tocNcxText = await tocNcxEntry.getData(new zip.TextWriter());
        let navXhtmlText = navXhtmlEntry ? await navXhtmlEntry.getData(new zip.TextWriter()) : null;

        return {
            navXhtmlEntry,
            contentOpfText,
            tocNcxText,
            navXhtmlText
        };
    }

    /**
     * Add updated metadata files to EPUB and close
     * @param {ZipWriter} newEpubZip - New EPUB zip writer
     * @param {ZipReader} epubZip - Original EPUB zip reader
     * @param {Object} epubPaths - EPUB structure paths
     * @param {string} updatedContentOpf - Updated content.opf content
     * @param {string} updatedTocNcx - Updated toc.ncx content
     * @param {string|null} updatedNavXhtml - Updated nav.xhtml content (optional)
     * @returns {Promise<Blob>} Final EPUB blob
     */
    static async addMetadataFilesAndClose(newEpubZip, epubZip, epubPaths, updatedContentOpf, updatedTocNcx, updatedNavXhtml) {
        // Add updated metadata files
        await newEpubZip.add(epubPaths.contentOpf, new zip.TextReader(updatedContentOpf));
        await newEpubZip.add(epubPaths.tocNcx, new zip.TextReader(updatedTocNcx));
        if (updatedNavXhtml) {
            await newEpubZip.add(epubPaths.navXhtml, new zip.TextReader(updatedNavXhtml));
        }

        // Close and return the new EPUB
        return await EpubUpdater.closeEpub(newEpubZip, epubZip);
    }

    /**
     * Close EPUB readers and writers
     * @param {ZipWriter} newEpubZip - New EPUB zip writer
     * @param {ZipReader} epubZip - Original EPUB zip reader
     * @returns {Promise<Blob>} Final EPUB blob
     */
    static async closeEpub(newEpubZip, epubZip) {
        let newEpubBlob = await newEpubZip.close();
        await epubZip.close();
        return newEpubBlob;
    }

    // ==================== BROWSER ZIP OPERATIONS ====================

    /**
     * Delete a chapter from an existing EPUB
     * @returns {Promise<boolean>} True if chapter was deleted successfully
     */
    static async deleteChapter(chapter) {
        try {
            let bookId = chapter.libraryBookId;
            // Get the book data before changes
            let bookData = await LibraryBookData.extractBookData(bookId);

            // Get the stored EPUB data
            let epubBase64 = await LibraryStorage.LibGetFromStorage("LibEpub" + bookId);
            if (!epubBase64) {
                throw new Error("Book not found in library");
            }

            // Load the EPUB using helper
            let {entries, epubZip} = await EpubUpdater.loadEpub(epubBase64);
            let epubPaths = EpubStructure.get();

            // Read metadata files using helper
            let {navXhtmlEntry, contentOpfText, tocNcxText, navXhtmlText} = await EpubUpdater.readMetadataFiles(entries, epubPaths);

            // Create new EPUB writer using helper
            let {newEpubZip} = EpubUpdater.createEpubWriter();

            // Copy all entries except the deleted chapter and metadata files (we'll regenerate those)
            for (let entry of entries) {
                if (entry.filename === chapter.libraryFilePath ||
                    entry.filename === epubPaths.contentOpf ||
                    entry.filename === epubPaths.tocNcx ||
                    (navXhtmlEntry && entry.filename === epubPaths.navXhtml)) {
                    continue; // Skip these files
                }

                await EpubUpdater.copyEntry(newEpubZip, entry);
            }

            // Extract chapter identifier from the actual filename for metadata processing
            let chapterRelativePath = chapter.libraryFilePath.replace(epubPaths.contentDir + "/", "");
            let chapterBasename = chapter.libraryFilePath.split("/").pop().replace(".xhtml", "");
            
            let updatedContentOpf = EpubUpdater.removeChapterFromContentOpfByFilename(contentOpfText, chapterRelativePath, chapterBasename);
            let updatedTocNcx = EpubUpdater.removeChapterFromTocNcxByFilename(tocNcxText, chapterRelativePath);
            let updatedNavXhtml = navXhtmlText ? EpubUpdater.removeChapterFromNavXhtmlByFilename(navXhtmlText, chapterRelativePath) : null;

            // Add metadata files and close EPUB using helper
            let updatedEpubBlob = await EpubUpdater.addMetadataFilesAndClose(newEpubZip, epubZip, epubPaths, updatedContentOpf, updatedTocNcx, updatedNavXhtml);
            let newEpubBase64 = await EpubUpdater.blobToBase64(updatedEpubBlob);

            await LibraryStorage.LibSaveToStorage("LibEpub" + bookId, newEpubBase64);

            // Verify the deletion worked
            let verificationData = await LibraryBookData.extractBookData(bookId);
            return !(verificationData.chapters.length === bookData.chapters.length);
        } catch (error) {
            console.error("Error deleting chapter from EPUB:", error);
            throw error;
        }
    }


    /**
     * Insert a new chapter at a specific position in an existing EPUB
     * @param {string} epubBase64 - Base64 encoded EPUB data
     * @param {number} insertIndex - EPUB spine index where to insert the new chapter (0-based)
     * @param {string} newChapterXhtml - XHTML content for the new chapter
     * @param {string} chapterTitle - Title of the new chapter
     * @param {string} chapterSourceUrl - Source URL of the chapter (optional)
     * @returns {Promise<Blob>} Updated EPUB as blob
     */
    static async insertChapter(epubBase64, insertIndex, newChapterXhtml, chapterTitle, chapterSourceUrl = "") {
        try {
            // Load the EPUB using helper
            let {entries, epubZip} = await EpubUpdater.loadEpub(epubBase64);
            let epubPaths = EpubStructure.get();

            // Find and validate chapter files using helpers
            let chapterFiles = EpubUpdater.findChapterFiles(entries, epubPaths);

            // Generate new chapter filename - use next available number
            let newChapterNumber = chapterFiles.length + 1;
            let newChapterNumberStr = ("0000" + newChapterNumber).slice(-4);
            let newChapterFilename = `${epubPaths.textDir}/${newChapterNumberStr}.xhtml`;

            // Read metadata files using helper
            let {navXhtmlEntry, contentOpfText, tocNcxText, navXhtmlText} = await EpubUpdater.readMetadataFiles(entries, epubPaths);

            // Update metadata files with new chapter at the correct position
            let updatedContentOpf = EpubUpdater.insertChapterInContentOpf(contentOpfText, newChapterNumberStr, chapterTitle, chapterSourceUrl, insertIndex, epubPaths);
            let updatedTocNcx = EpubUpdater.insertChapterInTocNcx(tocNcxText, newChapterNumber, newChapterNumberStr, chapterTitle, insertIndex, epubPaths);
            let updatedNavXhtml = navXhtmlText ? EpubUpdater.insertChapterInNavXhtml(navXhtmlText, newChapterNumberStr, chapterTitle, insertIndex, epubPaths) : null;

            // Create new EPUB writer using helper
            let {newEpubZip} = EpubUpdater.createEpubWriter();

            // Copy all existing entries except metadata files
            for (let entry of entries) {
                if (entry.filename === epubPaths.contentOpf ||
                    entry.filename === epubPaths.tocNcx ||
                    (navXhtmlEntry && entry.filename === epubPaths.navXhtml)) {
                    continue; // Skip these files - we'll add updated versions
                }

                await EpubUpdater.copyEntry(newEpubZip, entry);
            }

            // Add the new chapter file
            await newEpubZip.add(newChapterFilename, new zip.TextReader(newChapterXhtml));

            // Add metadata files and close EPUB using helper
            return await EpubUpdater.addMetadataFilesAndClose(newEpubZip, epubZip, epubPaths, updatedContentOpf, updatedTocNcx, updatedNavXhtml);

        } catch (error) {
            console.error("Error inserting chapter into EPUB:", error);
            throw error;
        }
    }

    /**
     * Insert chapter references into content.opf file at specific position
     * @param {string} contentOpf - Original content.opf content
     * @param {string} chapterNumberStr - Chapter number as 4-digit string
     * @param {string} chapterTitle - Title of the chapter
     * @param {string} chapterSourceUrl - Source URL of the chapter (optional)
     * @param {number} insertIndex - Position to insert at (0-based)
     * @param {Object} epubPaths - EPUB structure paths
     * @returns {string} Updated content.opf
     */
    static insertChapterInContentOpf(contentOpf, chapterNumberStr, chapterTitle, chapterSourceUrl, insertIndex, epubPaths) {
        let updated = contentOpf;

        // Add dc:source for the chapter if source URL is provided
        if (chapterSourceUrl && chapterSourceUrl.trim() !== "") {
            let sourceElement = `\n        <dc:source id="id.xhtml${chapterNumberStr}">${chapterSourceUrl}</dc:source>`;
            updated = updated.replace("</metadata>", sourceElement + "\n    </metadata>");
        }

        // For manifest, we can append since file order doesn't matter
        let manifestItem = `\n        <item href="${epubPaths.textDirRel}/${chapterNumberStr}.xhtml" id="xhtml${chapterNumberStr}" media-type="application/xhtml+xml"/>`;
        updated = updated.replace("</manifest>", manifestItem + "\n    </manifest>");

        // For spine, we need to insert at the correct position
        let spineItem = `\n        <itemref idref="xhtml${chapterNumberStr}"/>`;
        
        // Find all existing itemref elements to determine insertion point
        let itemrefRegex = /<itemref[^>]*\/>/g;
        let itemrefs = [...updated.matchAll(itemrefRegex)];
        
        if (insertIndex >= itemrefs.length) {
            // Insert at end
            updated = updated.replace("</spine>", spineItem + "\n    </spine>");
        } else {
            // Insert before the itemref at insertIndex
            let targetItemref = itemrefs[insertIndex][0];
            updated = updated.replace(targetItemref, spineItem + "\n        " + targetItemref);
        }

        return updated;
    }

    /**
     * Insert chapter references into toc.ncx file at specific position
     * @param {string} tocNcx - Original toc.ncx content
     * @param {number} chapterNumber - Chapter number (1-based)
     * @param {string} chapterNumberStr - Chapter number as 4-digit string
     * @param {string} chapterTitle - Title of the chapter
     * @param {number} insertIndex - Position to insert at (0-based)
     * @param {Object} epubPaths - EPUB structure paths
     * @returns {string} Updated toc.ncx
     */
    static insertChapterInTocNcx(tocNcx, chapterNumber, chapterNumberStr, chapterTitle, insertIndex, epubPaths) {
        let updated = tocNcx;

        // Find all existing navPoint elements to determine insertion point
        let navPointRegex = /<navPoint[^>]*>.*?<\/navPoint>/gs;
        let navPoints = [...updated.matchAll(navPointRegex)];

        // Calculate the playOrder - it should be insertIndex + 1 (1-based)
        let playOrder = insertIndex + 1;

        // Update playOrder for subsequent chapters (increment by 1)
        updated = updated.replace(/playOrder="(\d+)"/g, (match, playOrderStr) => {
            let currentPlayOrder = parseInt(playOrderStr);
            if (currentPlayOrder >= playOrder) {
                return `playOrder="${currentPlayOrder + 1}"`;
            }
            return match;
        });

        // Create navPoint for the new chapter
        let navPointElement = `\n        <navPoint id="body${chapterNumberStr}" playOrder="${playOrder}">
            <navLabel>
                <text>${chapterTitle}</text>
            </navLabel>
            <content src="${epubPaths.textDirRel}/${chapterNumberStr}.xhtml"/>
        </navPoint>`;

        if (insertIndex >= navPoints.length) {
            // Insert at end
            updated = updated.replace("</navMap>", navPointElement + "\n    </navMap>");
        } else {
            // Insert before the navPoint at insertIndex
            let targetNavPoint = navPoints[insertIndex][0];
            updated = updated.replace(targetNavPoint, navPointElement + "\n        " + targetNavPoint);
        }

        return updated;
    }

    /**
     * Insert chapter references into nav.xhtml file at specific position (EPUB 3)
     * @param {string} navXhtml - Original nav.xhtml content
     * @param {string} chapterNumberStr - Chapter number as 4-digit string
     * @param {string} chapterTitle - Title of the chapter
     * @param {number} insertIndex - Position to insert at (0-based)
     * @param {Object} epubPaths - EPUB structure paths
     * @returns {string} Updated nav.xhtml
     */
    static insertChapterInNavXhtml(navXhtml, chapterNumberStr, chapterTitle, insertIndex, epubPaths) {
        let updated = navXhtml;

        // Find all existing list items to determine insertion point
        let listItemRegex = /<li><a href="[^"]*"[^>]*>[^<]*<\/a><\/li>/g;
        let listItems = [...updated.matchAll(listItemRegex)];

        // Create list item for the new chapter
        let listItem = `\n            <li><a href="${epubPaths.textDirRel}/${chapterNumberStr}.xhtml">${chapterTitle}</a></li>`;

        if (insertIndex >= listItems.length) {
            // Insert at end
            updated = updated.replace("</ol></nav>", listItem + "\n        </ol></nav>");
        } else {
            // Insert before the list item at insertIndex
            let targetListItem = listItems[insertIndex][0];
            updated = updated.replace(targetListItem, listItem + "\n            " + targetListItem);
        }

        return updated;
    }

    /**
     * Convert blob to base64 data URL for storage
     * @param {Blob} blob - Blob to convert
     * @returns {Promise<string>} Base64 data URL
     */
    static async blobToBase64(blob) {
        return new Promise((resolve) => {
            let reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        });
    }

    /**
     * Validate EPUB structure after modification
     * @param {string} epubBase64 - EPUB to validate
     * @returns {Promise<boolean>} True if valid
     */
    static async validateEpub(epubBase64) {
        try {
            let epubReader = new zip.Data64URIReader(epubBase64);
            let epubZip = new zip.ZipReader(epubReader, {useWebWorkers: false});
            let entries = await epubZip.getEntries();
            entries = entries.filter(a => !a.directory);

            let epubPaths = EpubStructure.get();

            // Check for required files
            let hasContentOpf = entries.some(e => e.filename === epubPaths.contentOpf);
            let hasTocNcx = entries.some(e => e.filename === epubPaths.tocNcx);
            let hasMimetype = entries.some(e => e.filename === "mimetype");

            await epubZip.close();

            return hasContentOpf && hasTocNcx && hasMimetype;

        } catch (error) {
            console.error("Error validating EPUB:", error);
            return false;
        }
    }

    /**
     * Refresh a specific chapter in a library book by downloading new content from its source URL
     * Combines the entire flow: fetch content → generate XHTML → update EPUB → save to storage
     * @param {Object} chapter - Chapter object containing libraryBookId, chapterListIndex, sourceUrl, and title
     * @returns {Promise<boolean>} True if chapter was refreshed successfully
     */
    static async refreshChapterInBook(chapter) {
        try {
            // Validate chapter object and source URL
            if (!chapter || !chapter.sourceUrl || chapter.sourceUrl.startsWith("library://")) {
                throw new Error("Cannot refresh library-only chapters (no source URL)");
            }
            if (!chapter.libraryBookId || chapter.chapterListIndex === undefined) {
                throw new Error("Chapter must have libraryBookId and chapterListIndex");
            }
            if (!window.parser) {
                throw new Error("No parser available to extract chapter content");
            }

            // STEP 1: Fetch and process web content
            let webPage = {
                sourceUrl: chapter.sourceUrl,
                title: chapter.title,
                rawDom: null,
                isIncludeable: true,
                parser: window.parser
            };

            await window.parser.fetchWebPageContent(webPage);
            if (webPage.error) {
                throw new Error(webPage.error);
            }
            if (!webPage.rawDom) {
                throw new Error("Failed to fetch chapter content");
            }

            let processedContent = window.parser.convertRawDomToContent(webPage);
            if (!processedContent) {
                throw new Error("Failed to process chapter content");
            }

            // STEP 2: Generate XHTML content
            let epubItem = new ChapterEpubItem(webPage, processedContent, chapter.chapterListIndex);
            let emptyDocFactory = window.parser.emptyDocFactory || util.createEmptyXhtmlDoc;
            let contentValidator = window.parser.contentValidator || (xml => util.isXhtmlInvalid(xml, EpubPacker.XHTML_MIME_TYPE));
            let newChapterXhtml = epubItem.fileContentForEpub(emptyDocFactory, contentValidator);

            // STEP 3: Get EPUB from storage
            let epubBase64 = await LibraryStorage.LibGetFromStorage("LibEpub" + chapter.libraryBookId);
            if (!epubBase64) {
                throw new Error("Book not found in library");
            }

            // STEP 4: Update EPUB content (inline the refreshChapter logic)
            let {entries, epubZip} = await EpubUpdater.loadEpub(epubBase64);
            let epubPaths = EpubStructure.get();

            // Find target chapter file
            let chapterFiles = EpubUpdater.findChapterFiles(entries, epubPaths);
            let targetChapterFile = EpubUpdater.validateChapterIndex(chapter.chapterListIndex, chapterFiles);
            let chapterFilename = targetChapterFile.filename;

            // Create new EPUB with updated chapter
            let {newEpubZip} = EpubUpdater.createEpubWriter();

            for (let entry of entries) {
                if (entry.filename === chapterFilename) {
                    // Replace with new content
                    await newEpubZip.add(entry.filename, new zip.TextReader(newChapterXhtml));
                } else {
                    await EpubUpdater.copyEntry(newEpubZip, entry);
                }
            }

            let updatedEpubBlob = await EpubUpdater.closeEpub(newEpubZip, epubZip);

            // STEP 5: Save back to storage
            let newEpubBase64 = await EpubUpdater.blobToBase64(updatedEpubBlob);
            await LibraryStorage.LibSaveToStorage("LibEpub" + chapter.libraryBookId, newEpubBase64);
            
            // Store refresh timestamp for UI indicators
            let refreshTimestamp = new Date().toISOString();
            localStorage.setItem(`LibRefresh_${chapter.libraryBookId}_${chapter.chapterListIndex}`, refreshTimestamp);
            return true;
            
        } catch (error) {
            console.error("Error refreshing chapter in book:", error);
            throw error;
        }
    }

    /**
     * Reorder chapters in an existing EPUB by updating metadata files
     * @param {string} bookId - Library book ID
     * @param {Array} newChapterOrder - Array of chapters in new order
     * @returns {Promise<boolean>} Success status
     */
    static async reorderChapters(bookId, newChapterOrder) {
        try {
            // Get the stored EPUB data
            let epubBase64 = await LibraryStorage.LibGetFromStorage("LibEpub" + bookId);
            if (!epubBase64) {
                throw new Error("Book not found in library");
            }

            // Load the EPUB
            let {entries, epubZip} = await EpubUpdater.loadEpub(epubBase64);
            let epubPaths = EpubStructure.get();

            // Read current metadata files
            let {navXhtmlEntry, contentOpfText, tocNcxText, navXhtmlText} = await EpubUpdater.readMetadataFiles(entries, epubPaths);

            // Create new EPUB writer
            let {newEpubZip} = EpubUpdater.createEpubWriter();

            // Copy all entries except metadata files (we'll regenerate those)
            for (let entry of entries) {
                if (entry.filename === epubPaths.contentOpf ||
                    entry.filename === epubPaths.tocNcx ||
                    (navXhtmlEntry && entry.filename === epubPaths.navXhtml)) {
                    continue; // Skip metadata files - we'll regenerate them
                }
                await EpubUpdater.copyEntry(newEpubZip, entry);
            }

            // Generate new metadata files with reordered chapters
            let updatedContentOpf = EpubUpdater.reorderContentOpf(contentOpfText, newChapterOrder, epubPaths);
            let updatedTocNcx = EpubUpdater.reorderTocNcx(tocNcxText, newChapterOrder, epubPaths);
            let updatedNavXhtml = navXhtmlText ? EpubUpdater.reorderNavXhtml(navXhtmlText, newChapterOrder, epubPaths) : null;

            // Add updated metadata files and close EPUB
            let updatedEpubBlob = await EpubUpdater.addMetadataFilesAndClose(newEpubZip, epubZip, epubPaths, updatedContentOpf, updatedTocNcx, updatedNavXhtml);
            let newEpubBase64 = await EpubUpdater.blobToBase64(updatedEpubBlob);

            // Save updated EPUB back to storage
            await LibraryStorage.LibSaveToStorage("LibEpub" + bookId, newEpubBase64);

            return true;

        } catch (error) {
            console.error("Error reordering chapters:", error);
            throw error;
        }
    }

    /**
     * Reorder spine elements in content.opf based on new chapter order
     * @param {string} contentOpf - Original content.opf content
     * @param {Array} newChapterOrder - Array of chapters in new order
     * @param {Object} epubPaths - EPUB structure paths
     * @returns {string} Updated content.opf
     */
    static reorderContentOpf(contentOpf, newChapterOrder, epubPaths) {
        let updated = contentOpf;

        // Extract current spine itemrefs
        let spineRegex = /<spine[^>]*>([\s\S]*?)<\/spine>/;
        let spineMatch = updated.match(spineRegex);
        if (!spineMatch) {
            throw new Error("Could not find spine section in content.opf");
        }

        let spineContent = spineMatch[1];
        let itemrefRegex = /<itemref[^>]*idref="([^"]*)"[^>]*\/>/g;
        let existingItemrefs = [];
        let match;
        while ((match = itemrefRegex.exec(spineContent)) !== null) {
            existingItemrefs.push({
                idref: match[1],
                fullTag: match[0]
            });
        }

        // Build manifest map from href to id to get actual idrefs
        let manifestRegex = /<item[^>]*href="([^"]*)"[^>]*id="([^"]*)"[^>]*\/>/g;
        let hrefToIdMap = {};
        let manifestMatch;
        while ((manifestMatch = manifestRegex.exec(updated)) !== null) {
            hrefToIdMap[manifestMatch[1]] = manifestMatch[2]; // href -> id
        }

        // Build set of chapter idrefs that will be reordered
        let chapterIdrefs = new Set();
        newChapterOrder.forEach(chapter => {
            let relativePath = chapter.libraryFilePath.replace(epubPaths.contentDir + "/", "");
            let actualIdref = hrefToIdMap[relativePath];
            if (actualIdref) {
                chapterIdrefs.add(actualIdref);
            }
        });

        // Create new spine content: preserve non-chapters in original order, insert reordered chapters
        let newSpineContent = "\n";
        let chapterItemrefs = [];
        
        // First, collect the reordered chapter itemrefs
        newChapterOrder.forEach(chapter => {
            let relativePath = chapter.libraryFilePath.replace(epubPaths.contentDir + "/", "");
            let actualIdref = hrefToIdMap[relativePath];
            
            if (actualIdref) {
                let itemref = existingItemrefs.find(ir => ir.idref === actualIdref);
                if (itemref) {
                    chapterItemrefs.push(itemref);
                }
            }
        });

        // Now build the new spine: replace chapter section with reordered chapters, keep everything else
        let chapterInserted = false;
        existingItemrefs.forEach(itemref => {
            if (chapterIdrefs.has(itemref.idref)) {
                // This is a chapter that will be reordered - insert all reordered chapters here once
                if (!chapterInserted) {
                    chapterItemrefs.forEach(chapterItemref => {
                        newSpineContent += `        ${chapterItemref.fullTag}\n`;
                    });
                    chapterInserted = true;
                }
                // Skip this individual chapter (already inserted as part of reordered group)
            } else {
                // This is a non-chapter item (Cover, Information, etc.) - preserve in original position
                newSpineContent += `        ${itemref.fullTag}\n`;
            }
        });

        // Replace the spine content
        updated = updated.replace(spineRegex, `<spine toc="ncx">${newSpineContent}    </spine>`);

        return updated;
    }

    /**
     * Reorder navigation points in toc.ncx based on new chapter order
     * @param {string} tocNcx - Original toc.ncx content
     * @param {Array} newChapterOrder - Array of chapters in new order
     * @param {Object} epubPaths - EPUB structure paths
     * @returns {string} Updated toc.ncx
     */
    static reorderTocNcx(tocNcx, newChapterOrder, epubPaths) {
        let updated = tocNcx;

        // Extract current navPoints
        let navMapRegex = /<navMap[^>]*>([\s\S]*?)<\/navMap>/;
        let navMapMatch = updated.match(navMapRegex);
        if (!navMapMatch) {
            throw new Error("Could not find navMap section in toc.ncx");
        }

        let navMapContent = navMapMatch[1];
        let navPointRegex = /<navPoint[^>]*id="([^"]*)"[^>]*>([\s\S]*?)<\/navPoint>/g;
        let existingNavPoints = [];
        let match;
        while ((match = navPointRegex.exec(navMapContent)) !== null) {
            existingNavPoints.push({
                id: match[1],
                content: match[2],
                fullTag: match[0]
            });
        }

        // Create new navMap order based on chapter order
        let newNavMapContent = "\n";
        newChapterOrder.forEach((chapter, index) => {
            let chapterBasename = chapter.libraryFilePath.split("/").pop().replace(".xhtml", "");
            let expectedId = `navpoint${chapterBasename}`;
            
            let navPoint = existingNavPoints.find(np => np.id === expectedId);
            if (navPoint) {
                // Update the playOrder attribute to match new position
                let updatedNavPoint = navPoint.fullTag.replace(
                    /playOrder="[^"]*"/,
                    `playOrder="${index + 1}"`
                );
                newNavMapContent += `        ${updatedNavPoint}\n`;
            }
        });

        // Replace the navMap content
        updated = updated.replace(navMapRegex, `<navMap>${newNavMapContent}    </navMap>`);

        return updated;
    }

    /**
     * Reorder navigation in nav.xhtml based on new chapter order (EPUB 3)
     * @param {string} navXhtml - Original nav.xhtml content
     * @param {Array} newChapterOrder - Array of chapters in new order
     * @param {Object} epubPaths - EPUB structure paths
     * @returns {string} Updated nav.xhtml
     */
    static reorderNavXhtml(navXhtml, newChapterOrder, epubPaths) {
        let updated = navXhtml;

        // Extract current navigation list
        let tocRegex = /<nav[^>]*epub:type="toc"[^>]*>([\s\S]*?)<\/nav>/;
        let tocMatch = updated.match(tocRegex);
        if (!tocMatch) {
            // Try alternative pattern
            tocRegex = /<ol[^>]*>([\s\S]*?)<\/ol>/;
            tocMatch = updated.match(tocRegex);
        }
        
        if (!tocMatch) {
            return updated; // If we can't find navigation, return unchanged
        }

        let listContent = tocMatch[1];
        let liRegex = /<li[^>]*>([\s\S]*?)<\/li>/g;
        let existingItems = [];
        let match;
        while ((match = liRegex.exec(listContent)) !== null) {
            existingItems.push({
                content: match[1],
                fullTag: match[0]
            });
        }

        // Create new navigation order based on chapter order
        let newListContent = "\n";
        newChapterOrder.forEach(chapter => {
            let chapterFilename = chapter.libraryFilePath.split("/").pop();
            
            // Find the matching navigation item by href
            let navItem = existingItems.find(item => 
                item.content.includes(`href="${epubPaths.textDirRel}/${chapterFilename}"`) ||
                item.content.includes(`href="../${epubPaths.textDir}/${chapterFilename}"`)
            );
            if (navItem) {
                newListContent += `            ${navItem.fullTag}\n`;
            }
        });

        // Replace the list content
        if (tocMatch) {
            let isOlElement = updated.includes("<ol");
            let tagName = isOlElement ? "ol" : "nav epub:type=\"toc\"";
            let closeTag = isOlElement ? "ol" : "nav";
            updated = updated.replace(tocRegex, `<${tagName}>${newListContent}        </${closeTag}>`);
        }

        return updated;
    }
}