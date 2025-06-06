/*
  EpubUpdater class - handles modifications to existing EPUB files
  Separate from EpubPacker.js which is for initial EPUB creation
  
  Separates pure string processing (testable) from browser ZIP operations
*/
"use strict";

class EpubUpdater {
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
        let sourceRegex = new RegExp(`\\s*<dc:source id="id\\.xhtml${chapterNumberStr}"[^>]*>[^<]*<\\/dc:source>`, 'g');
        updated = updated.replace(sourceRegex, '');

        // Remove manifest item for the chapter
        let manifestRegex = new RegExp(`\\s*<item href="${epubPaths.textDirRel}\\/${chapterNumberStr}\\.xhtml"[^>]*\\/>`, 'g');
        updated = updated.replace(manifestRegex, '');

        // Remove spine itemref for the chapter
        let spineRegex = new RegExp(`\\s*<itemref idref="xhtml${chapterNumberStr}"\\/>`, 'g');
        updated = updated.replace(spineRegex, '');

        return updated;
    }

    /**
     * Remove chapter references from toc.ncx file
     * @param {string} tocNcx - Original toc.ncx content
     * @param {number} chapterNumber - Chapter number (1-based)
     * @param {string} chapterNumberStr - Chapter number as 4-digit string
     * @param {Object} epubPaths - EPUB structure paths
     * @returns {string} Updated toc.ncx
     */
    static removeChapterFromTocNcx(tocNcx, chapterNumber, chapterNumberStr, epubPaths) {
        let updated = tocNcx;

        // Remove the navPoint for the deleted chapter
        let navPointRegex = new RegExp(`\\s*<navPoint id="body${chapterNumberStr}"[^>]*>.*?<\\/navPoint>`, 'gs');
        updated = updated.replace(navPointRegex, '');

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
        let listItemRegex = new RegExp(`\\s*<li><a href="${epubPaths.textDirRel}\\/${chapterNumberStr}\\.xhtml"[^>]*>[^<]*<\\/a><\\/li>`, 'g');
        updated = updated.replace(listItemRegex, '');
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
        let sourceRegex = new RegExp(`\\s*<dc:source[^>]*>[^<]*${chapterBasename}[^<]*<\\/dc:source>`, 'gi');
        updated = updated.replace(sourceRegex, '');

        // Remove manifest item for the chapter by href
        let manifestRegex = new RegExp(`\\s*<item href="${chapterRelativePath.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}"[^>]*\\/>`, 'g');
        updated = updated.replace(manifestRegex, '');

        // Remove spine itemref by finding the id from manifest and removing spine reference
        let idMatch = contentOpf.match(new RegExp(`<item href="${chapterRelativePath.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}"[^>]*id="([^"]+)"`));
        if (idMatch) {
            let itemId = idMatch[1];
            let spineRegex = new RegExp(`\\s*<itemref idref="${itemId}"[^>]*\\/>`, 'g');
            updated = updated.replace(spineRegex, '');
        }

        return updated;
    }

    /**
     * Remove chapter references from toc.ncx file by actual filename
     * @param {string} tocNcx - Original toc.ncx content
     * @param {string} chapterRelativePath - Relative path to chapter file
     * @param {string} chapterBasename - Chapter filename without extension
     * @returns {string} Updated toc.ncx
     */
    static removeChapterFromTocNcxByFilename(tocNcx, chapterRelativePath, chapterBasename) {
        let updated = tocNcx;

        // Remove the navPoint for the deleted chapter by content src
        let navPointRegex = new RegExp(`\\s*<navPoint[^>]*>.*?<content src="${chapterRelativePath.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}"[^/>]*/>.*?<\\/navPoint>`, 'gs');
        updated = updated.replace(navPointRegex, '');

        return updated;
    }

    /**
     * Remove chapter references from nav.xhtml file by actual filename
     * @param {string} navXhtml - Original nav.xhtml content
     * @param {string} chapterRelativePath - Relative path to chapter file
     * @param {string} chapterBasename - Chapter filename without extension
     * @returns {string} Updated nav.xhtml
     */
    static removeChapterFromNavXhtmlByFilename(navXhtml, chapterRelativePath, chapterBasename) {
        let updated = navXhtml;

        // Remove the list item for the deleted chapter by href
        let listItemRegex = new RegExp(`\\s*<li><a href="${chapterRelativePath.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}"[^>]*>[^<]*<\\/a><\\/li>`, 'g');
        updated = updated.replace(listItemRegex, '');

        return updated;
    }

    // ==================== BROWSER ZIP OPERATIONS ====================

    /**
     * Delete a chapter from an existing EPUB
     * @param {string} epubBase64 - Base64 encoded EPUB data
     * @param {number} chapterIndex - Index of chapter to delete (0-based)
     * @returns {Promise<Blob>} Updated EPUB as blob
     */
    static async deleteChapter(epubBase64, chapterIndex) {
        try {
            // Load the EPUB
            let epubReader = new zip.Data64URIReader(epubBase64);
            let epubZip = new zip.ZipReader(epubReader, {useWebWorkers: false});
            let entries = await epubZip.getEntries();
            entries = entries.filter(a => !a.directory);

            // Get EPUB structure paths
            let epubPaths = util.getEpubStructure();

            // Find all chapter files in the text directory
            let chapterFiles = entries.filter(e => 
                e.filename.startsWith(epubPaths.textDir) && 
                e.filename.endsWith('.xhtml') &&
                !e.filename.includes('Cover')
            ).sort((a, b) => a.filename.localeCompare(b.filename));
            
            // Get the target chapter file by index
            if (chapterIndex < 0 || chapterIndex >= chapterFiles.length) {
                throw new Error(`Chapter index ${chapterIndex} out of range (0-${chapterFiles.length - 1})`);
            }
            
            let targetChapterFile = chapterFiles[chapterIndex];
            let chapterFilename = targetChapterFile.filename;

            // Get metadata files for updating
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

            // Create new EPUB writer
            let newEpubWriter = new zip.BlobWriter("application/epub+zip");
            let newEpubZip = new zip.ZipWriter(newEpubWriter, {useWebWorkers: false, compressionMethod: 8, extendedTimestamp: false});

            // Copy all entries except the deleted chapter and metadata files (we'll regenerate those)
            for (let entry of entries) {
                if (entry.filename === chapterFilename ||
                    entry.filename === epubPaths.contentOpf ||
                    entry.filename === epubPaths.tocNcx ||
                    (navXhtmlEntry && entry.filename === epubPaths.navXhtml)) {
                    continue; // Skip these files
                }

                if (entry.filename === "mimetype") {
                    await newEpubZip.add(entry.filename, new zip.TextReader(await entry.getData(new zip.TextWriter())), {compressionMethod: 0});
                } else {
                    await newEpubZip.add(entry.filename, new zip.BlobReader(await entry.getData(new zip.BlobWriter())));
                }
            }

            // Extract chapter identifier from the actual filename for metadata processing
            let chapterRelativePath = chapterFilename.replace(epubPaths.contentDir + "/", "");
            let chapterBasename = chapterFilename.split('/').pop().replace('.xhtml', '');
            
            let updatedContentOpf = EpubUpdater.removeChapterFromContentOpfByFilename(contentOpfText, chapterRelativePath, chapterBasename);
            let updatedTocNcx = EpubUpdater.removeChapterFromTocNcxByFilename(tocNcxText, chapterRelativePath, chapterBasename);
            let updatedNavXhtml = navXhtmlText ? EpubUpdater.removeChapterFromNavXhtmlByFilename(navXhtmlText, chapterRelativePath, chapterBasename) : null;

            // Add updated metadata files
            await newEpubZip.add(epubPaths.contentOpf, new zip.TextReader(updatedContentOpf));
            await newEpubZip.add(epubPaths.tocNcx, new zip.TextReader(updatedTocNcx));
            if (updatedNavXhtml) {
                await newEpubZip.add(epubPaths.navXhtml, new zip.TextReader(updatedNavXhtml));
            }

            // Close and return the new EPUB
            let newEpubBlob = await newEpubZip.close();
            await epubZip.close();

            return newEpubBlob;

        } catch (error) {
            console.error("Error deleting chapter from EPUB:", error);
            throw error;
        }
    }


    /**
     * Refresh a chapter in an existing EPUB by replacing its content
     * @param {string} epubBase64 - Base64 encoded EPUB data
     * @param {number} chapterIndex - Index of chapter to refresh (0-based)
     * @param {string} newChapterXhtml - New XHTML content for the chapter
     * @returns {Promise<Blob>} Updated EPUB as blob
     */
    static async refreshChapter(epubBase64, chapterIndex, newChapterXhtml) {
        try {
            // Load the EPUB
            let epubReader = new zip.Data64URIReader(epubBase64);
            let epubZip = new zip.ZipReader(epubReader, {useWebWorkers: false});
            let entries = await epubZip.getEntries();
            entries = entries.filter(a => !a.directory);

            // Get EPUB structure paths
            let epubPaths = util.getEpubStructure();

            // Find all chapter files in the text directory (same logic as delete)
            let chapterFiles = entries.filter(e => 
                e.filename.startsWith(epubPaths.textDir) && 
                e.filename.endsWith('.xhtml') &&
                !e.filename.includes('Cover')
            ).sort((a, b) => a.filename.localeCompare(b.filename));
            
            // Get the target chapter file by index
            if (chapterIndex < 0 || chapterIndex >= chapterFiles.length) {
                throw new Error(`Chapter index ${chapterIndex} out of range (0-${chapterFiles.length - 1})`);
            }
            
            let targetChapterFile = chapterFiles[chapterIndex];
            let chapterFilename = targetChapterFile.filename;

            // Create new EPUB writer
            let newEpubWriter = new zip.BlobWriter("application/epub+zip");
            let newEpubZip = new zip.ZipWriter(newEpubWriter, {useWebWorkers: false, compressionMethod: 8, extendedTimestamp: false});

            // Copy all entries, replacing the target chapter
            for (let entry of entries) {
                if (entry.filename === chapterFilename) {
                    // Replace with new content
                    await newEpubZip.add(entry.filename, new zip.TextReader(newChapterXhtml));
                } else if (entry.filename === "mimetype") {
                    await newEpubZip.add(entry.filename, new zip.TextReader(await entry.getData(new zip.TextWriter())), {compressionMethod: 0});
                } else {
                    await newEpubZip.add(entry.filename, new zip.BlobReader(await entry.getData(new zip.BlobWriter())));
                }
            }

            // Close and return the new EPUB
            let newEpubBlob = await newEpubZip.close();
            await epubZip.close();

            return newEpubBlob;

        } catch (error) {
            console.error("Error refreshing chapter in EPUB:", error);
            throw error;
        }
    }

    /**
     * Add a new chapter to an existing EPUB
     * @param {string} epubBase64 - Base64 encoded EPUB data
     * @param {number} chapterIndex - Index where to insert the new chapter (0-based)
     * @param {string} newChapterXhtml - XHTML content for the new chapter
     * @param {string} chapterTitle - Title of the new chapter
     * @param {string} chapterSourceUrl - Source URL of the chapter (optional)
     * @returns {Promise<Blob>} Updated EPUB as blob
     */
    static async addChapter(epubBase64, chapterIndex, newChapterXhtml, chapterTitle, chapterSourceUrl = "") {
        try {
            // Load the EPUB
            let epubReader = new zip.Data64URIReader(epubBase64);
            let epubZip = new zip.ZipReader(epubReader, {useWebWorkers: false});
            let entries = await epubZip.getEntries();
            entries = entries.filter(a => !a.directory);

            // Get EPUB structure paths
            let epubPaths = util.getEpubStructure();

            // Find all chapter files in the text directory (same logic as refresh)
            let chapterFiles = entries.filter(e => 
                e.filename.startsWith(epubPaths.textDir) && 
                e.filename.endsWith('.xhtml') &&
                !e.filename.includes('Cover')
            ).sort((a, b) => a.filename.localeCompare(b.filename));
            
            // Validate chapter index (can be at the end for appending)
            if (chapterIndex < 0 || chapterIndex > chapterFiles.length) {
                throw new Error(`Chapter index ${chapterIndex} out of range (0-${chapterFiles.length})`);
            }

            // Generate new chapter filename
            let newChapterNumber = chapterFiles.length + 1; // Next available number
            let newChapterNumberStr = ("0000" + newChapterNumber).slice(-4);
            let newChapterFilename = `${epubPaths.textDir}/${newChapterNumberStr}.xhtml`;

            // Get metadata files for updating
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

            // Update metadata files with new chapter
            let updatedContentOpf = EpubUpdater.addChapterToContentOpf(contentOpfText, newChapterNumberStr, chapterTitle, chapterSourceUrl, epubPaths);
            let updatedTocNcx = EpubUpdater.addChapterToTocNcx(tocNcxText, newChapterNumber, newChapterNumberStr, chapterTitle, epubPaths);
            let updatedNavXhtml = navXhtmlText ? EpubUpdater.addChapterToNavXhtml(navXhtmlText, newChapterNumberStr, chapterTitle, epubPaths) : null;

            // Create new EPUB writer
            let newEpubWriter = new zip.BlobWriter("application/epub+zip");
            let newEpubZip = new zip.ZipWriter(newEpubWriter, {useWebWorkers: false, compressionMethod: 8, extendedTimestamp: false});

            // Copy all existing entries
            for (let entry of entries) {
                if (entry.filename === epubPaths.contentOpf ||
                    entry.filename === epubPaths.tocNcx ||
                    (navXhtmlEntry && entry.filename === epubPaths.navXhtml)) {
                    continue; // Skip these files - we'll add updated versions
                }

                if (entry.filename === "mimetype") {
                    await newEpubZip.add(entry.filename, new zip.TextReader(await entry.getData(new zip.TextWriter())), {compressionMethod: 0});
                } else {
                    await newEpubZip.add(entry.filename, new zip.BlobReader(await entry.getData(new zip.BlobWriter())));
                }
            }

            // Add the new chapter file
            await newEpubZip.add(newChapterFilename, new zip.TextReader(newChapterXhtml));

            // Add updated metadata files
            await newEpubZip.add(epubPaths.contentOpf, new zip.TextReader(updatedContentOpf));
            await newEpubZip.add(epubPaths.tocNcx, new zip.TextReader(updatedTocNcx));
            if (updatedNavXhtml) {
                await newEpubZip.add(epubPaths.navXhtml, new zip.TextReader(updatedNavXhtml));
            }

            // Close and return the new EPUB
            let newEpubBlob = await newEpubZip.close();
            await epubZip.close();

            return newEpubBlob;

        } catch (error) {
            console.error("Error adding chapter to EPUB:", error);
            throw error;
        }
    }

    /**
     * Add chapter references to content.opf file
     * @param {string} contentOpf - Original content.opf content
     * @param {string} chapterNumberStr - Chapter number as 4-digit string (e.g., "0001")
     * @param {string} chapterTitle - Title of the chapter
     * @param {string} chapterSourceUrl - Source URL of the chapter (optional)
     * @param {Object} epubPaths - EPUB structure paths
     * @returns {string} Updated content.opf
     */
    static addChapterToContentOpf(contentOpf, chapterNumberStr, chapterTitle, chapterSourceUrl, epubPaths) {
        let updated = contentOpf;

        // Add dc:source for the chapter if source URL is provided
        if (chapterSourceUrl && chapterSourceUrl.trim() !== "") {
            let sourceElement = `\n        <dc:source id="id.xhtml${chapterNumberStr}">${chapterSourceUrl}</dc:source>`;
            updated = updated.replace('</metadata>', sourceElement + '\n    </metadata>');
        }

        // Add manifest item for the chapter
        let manifestItem = `\n        <item href="${epubPaths.textDirRel}/${chapterNumberStr}.xhtml" id="xhtml${chapterNumberStr}" media-type="application/xhtml+xml"/>`;
        updated = updated.replace('</manifest>', manifestItem + '\n    </manifest>');

        // Add spine itemref for the chapter
        let spineItem = `\n        <itemref idref="xhtml${chapterNumberStr}"/>`;
        updated = updated.replace('</spine>', spineItem + '\n    </spine>');

        return updated;
    }

    /**
     * Add chapter references to toc.ncx file
     * @param {string} tocNcx - Original toc.ncx content
     * @param {number} chapterNumber - Chapter number (1-based)
     * @param {string} chapterNumberStr - Chapter number as 4-digit string
     * @param {string} chapterTitle - Title of the chapter
     * @param {Object} epubPaths - EPUB structure paths
     * @returns {string} Updated toc.ncx
     */
    static addChapterToTocNcx(tocNcx, chapterNumber, chapterNumberStr, chapterTitle, epubPaths) {
        let updated = tocNcx;

        // Add navPoint for the new chapter
        let navPointElement = `\n        <navPoint id="body${chapterNumberStr}" playOrder="${chapterNumber}">
            <navLabel>
                <text>${chapterTitle}</text>
            </navLabel>
            <content src="${epubPaths.textDirRel}/${chapterNumberStr}.xhtml"/>
        </navPoint>`;

        updated = updated.replace('</navMap>', navPointElement + '\n    </navMap>');

        return updated;
    }

    /**
     * Add chapter references to nav.xhtml file (EPUB 3)
     * @param {string} navXhtml - Original nav.xhtml content
     * @param {string} chapterNumberStr - Chapter number as 4-digit string
     * @param {string} chapterTitle - Title of the chapter
     * @param {Object} epubPaths - EPUB structure paths
     * @returns {string} Updated nav.xhtml
     */
    static addChapterToNavXhtml(navXhtml, chapterNumberStr, chapterTitle, epubPaths) {
        let updated = navXhtml;

        // Add list item for the new chapter
        let listItem = `\n            <li><a href="${epubPaths.textDirRel}/${chapterNumberStr}.xhtml">${chapterTitle}</a></li>`;
        updated = updated.replace('</ol></nav>', listItem + '\n        </ol></nav>');

        return updated;
    }

    /**
     * Merge two EPUBs together - delegates to existing LibraryStorage.LibMergeEpub
     * @param {string} baseEpubBase64 - Base EPUB in base64 format
     * @param {Blob} newEpubBlob - New EPUB to merge as blob
     * @param {string} libraryId - Library ID for the book
     * @returns {Promise<Blob>} Merged EPUB as blob
     */
    static async mergeEpubs(baseEpubBase64, newEpubBlob, libraryId) {
        // Delegate to existing proven merge logic in LibraryStorage
        return await LibraryStorage.LibMergeEpub(baseEpubBase64, newEpubBlob, libraryId);
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

            let epubPaths = util.getEpubStructure();

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
}