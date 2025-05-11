/*
  EpubStructure class - handles EPUB internal structure constants and conversion between formats
*/
"use strict";

class EpubStructure {
    
    // EPUB structure constants
    static EPUB_STRUCTURE_OEBPS = {
        contentDir: "OEBPS",
        textDir: "OEBPS/Text",
        imagesDir: "OEBPS/Images",
        stylesDir: "OEBPS/Styles",
        navFile: "OEBPS/toc.xhtml",
        // Relative paths for content (used in manifests/TOC)
        textDirRel: "Text",
        imagesDirRel: "Images",
        stylesDirRel: "Styles",
        // Computed paths for convenience
        contentOpf: "OEBPS/content.opf",
        tocNcx: "OEBPS/toc.ncx",
        coverXhtml: "OEBPS/Text/Cover.xhtml",
        stylesheet: "OEBPS/Styles/stylesheet.css",
        textDirPattern: "OEBPS/Text/",
        imagesDirPattern: "OEBPS/Images/",
        stylesDirPattern: "OEBPS/Styles/",
        // Relative paths with separators
        relativeImagePath: "../Images/",
        relativeStylePath: "../Styles/",
        relativeTextPath: "../Text/"
    };

    static EPUB_STRUCTURE_EPUB = {
        contentDir: "EPUB",
        textDir: "EPUB/text",
        imagesDir: "EPUB/images",
        stylesDir: "EPUB/styles",
        navFile: "EPUB/nav.xhtml",
        // Relative paths for content (used in manifests/TOC)
        textDirRel: "text",
        imagesDirRel: "images",
        stylesDirRel: "styles",
        // Computed paths for convenience
        contentOpf: "EPUB/content.opf",
        tocNcx: "EPUB/toc.ncx",
        coverXhtml: "EPUB/text/Cover.xhtml",
        stylesheet: "EPUB/styles/stylesheet.css",
        textDirPattern: "EPUB/text/",
        imagesDirPattern: "EPUB/images/",
        stylesDirPattern: "EPUB/styles/",
        // Relative paths with separators
        relativeImagePath: "../images/",
        relativeStylePath: "../styles/",
        relativeTextPath: "../text/"
    };

    /**
     * Get EPUB structure based on preference
     * @param {string} [preferenceValue] - "OEBPS" or "EPUB" (optional, defaults to user preference)
     * @returns {Object} Structure constants
     */
    static get(preferenceValue) {
        if (preferenceValue === undefined) {
            let userPreferences = main.getUserPreferences();
            preferenceValue = userPreferences ? userPreferences.epubInternalStructure.value : "OEBPS";
        }
        return (preferenceValue === "EPUB") ? 
            EpubStructure.EPUB_STRUCTURE_EPUB : 
            EpubStructure.EPUB_STRUCTURE_OEBPS;
    }

    /**
     * Convert library book from one EPUB structure to another
     * @param {string} bookId - Library book ID
     * @param {string} fromStructure - Source structure ("OEBPS" or "EPUB")
     * @param {string} toStructure - Target structure ("OEBPS" or "EPUB")
     * @returns {Promise<boolean>} Success status
     */
    static async convertLibraryBookStructure(bookId, fromStructure, toStructure) {
        if (fromStructure === toStructure) {
            return true; // No conversion needed
        }

        try {
            console.log(`Converting library book ${bookId} from ${fromStructure} to ${toStructure}`);
            
            // Get the stored EPUB
            let epubBase64 = await LibraryStorage.LibGetFromStorage("LibEpub" + bookId);
            if (!epubBase64) {
                throw new Error(`Book ${bookId} not found in library`);
            }

            // Read the EPUB ZIP file
            let epubReader = new zip.Data64URIReader(epubBase64);
            let epubZip = new zip.ZipReader(epubReader, {useWebWorkers: false});
            let entries = await epubZip.getEntries();

            // Create new ZIP for converted EPUB
            let zipFileWriter = new zip.BlobWriter("application/epub+zip");
            let zipWriter = new zip.ZipWriter(zipFileWriter, {
                useWebWorkers: false,
                compressionMethod: 8,
                extendedTimestamp: false
            });

            // Get structure mappings
            let fromPaths = EpubStructure.get(fromStructure);
            let toPaths = EpubStructure.get(toStructure);

            // Convert each file
            for (let entry of entries) {
                if (entry.directory) continue;

                let newPath = EpubStructure.convertFilePath(entry.filename, fromPaths, toPaths);
                let content;

                // Handle different file types
                if (entry.filename === "META-INF/container.xml") {
                    // Special handling for container.xml - update content.opf path
                    content = await entry.getData(new zip.TextWriter());
                    content = EpubStructure.updateContainerXml(content, fromPaths, toPaths);
                    zipWriter.add(newPath, new zip.TextReader(content));
                } else if (entry.filename.endsWith(".opf") || entry.filename.endsWith(".ncx") || 
                    entry.filename.endsWith(".xhtml") || entry.filename.endsWith(".html")) {
                    // Text content that may need path updates
                    content = await entry.getData(new zip.TextWriter());
                    content = EpubStructure.updateContentPaths(content, fromPaths, toPaths);
                    zipWriter.add(newPath, new zip.TextReader(content));
                } else {
                    // Binary content (images, etc.)
                    content = await entry.getData(new zip.Uint8ArrayWriter());
                    zipWriter.add(newPath, new zip.Uint8ArrayReader(content));
                }
            }

            await epubZip.close();

            // Generate new EPUB
            let convertedBlob = await zipWriter.close();
            let arrayBuffer = await convertedBlob.arrayBuffer();
            let uint8Array = new Uint8Array(arrayBuffer);
            let base64String = EpubStructure.arrayBufferToBase64(uint8Array);
            let dataUrl = "data:application/epub+zip;base64," + base64String;

            // Update storage with converted EPUB
            await chrome.storage.local.set({
                ["LibEpub" + bookId]: dataUrl
            });

            console.log(`Successfully converted library book ${bookId}`);
            return true;

        } catch (error) {
            console.error(`Error converting library book ${bookId}:`, error);
            return false;
        }
    }

    /**
     * Convert file path from one structure to another
     * @param {string} originalPath - Original file path
     * @param {Object} fromPaths - Source structure paths
     * @param {Object} toPaths - Target structure paths
     * @returns {string} Converted path
     */
    static convertFilePath(originalPath, fromPaths, toPaths) {
        // Handle content directory change
        if (originalPath.startsWith(fromPaths.contentDir + "/")) {
            let relativePath = originalPath.substring(fromPaths.contentDir.length + 1);
            
            // Convert specific subdirectories
            if (relativePath.startsWith(fromPaths.textDirRel + "/")) {
                let filename = relativePath.substring(fromPaths.textDirRel.length + 1);
                return toPaths.textDir + "/" + filename;
            } else if (relativePath.startsWith(fromPaths.imagesDirRel + "/")) {
                let filename = relativePath.substring(fromPaths.imagesDirRel.length + 1);
                return toPaths.imagesDir + "/" + filename;
            } else if (relativePath.startsWith(fromPaths.stylesDirRel + "/")) {
                let filename = relativePath.substring(fromPaths.stylesDirRel.length + 1);
                return toPaths.stylesDir + "/" + filename;
            } else {
                // Other files in content directory
                return toPaths.contentDir + "/" + relativePath;
            }
        }
        
        // Files outside content directory remain unchanged
        return originalPath;
    }

    /**
     * Update content paths within files (OPF, NCX, XHTML)
     * @param {string} content - File content
     * @param {Object} fromPaths - Source structure paths
     * @param {Object} toPaths - Target structure paths
     * @returns {string} Updated content
     */
    static updateContentPaths(content, fromPaths, toPaths) {
        // Update relative paths in content
        content = content.replace(new RegExp(fromPaths.textDirRel + "/", "g"), toPaths.textDirRel + "/");
        content = content.replace(new RegExp(fromPaths.imagesDirRel + "/", "g"), toPaths.imagesDirRel + "/");
        content = content.replace(new RegExp(fromPaths.stylesDirRel + "/", "g"), toPaths.stylesDirRel + "/");
        
        // Update relative path references (../)
        content = content.replace(new RegExp("\\.\\./?" + fromPaths.imagesDirRel + "/", "g"), "../" + toPaths.imagesDirRel + "/");
        content = content.replace(new RegExp("\\.\\./?" + fromPaths.stylesDirRel + "/", "g"), "../" + toPaths.stylesDirRel + "/");
        content = content.replace(new RegExp("\\.\\./?" + fromPaths.textDirRel + "/", "g"), "../" + toPaths.textDirRel + "/");

        return content;
    }

    /**
     * Update META-INF/container.xml to point to new content.opf location
     * @param {string} content - container.xml content
     * @param {Object} fromPaths - Source structure paths
     * @param {Object} toPaths - Target structure paths
     * @returns {string} Updated container.xml content
     */
    static updateContainerXml(content, fromPaths, toPaths) {
        // Update the full-path attribute in container.xml to point to new content.opf location
        content = content.replace(
            new RegExp(`full-path="${fromPaths.contentOpf}"`, "g"),
            `full-path="${toPaths.contentOpf}"`
        );
        
        return content;
    }

    /**
     * Convert all library books to new structure
     * @param {string} newStructure - Target structure ("OEBPS" or "EPUB")
     * @returns {Promise<Object>} Conversion results
     */
    static async convertAllLibraryBooks(newStructure) {
        try {
            let libraryIds = await LibraryStorage.LibGetStorageIDs();
            if (!libraryIds || libraryIds.length === 0) {
                return { success: true, converted: 0, failed: 0 };
            }

            let converted = 0;
            let failed = 0;
            let currentStructure = newStructure === "EPUB" ? "OEBPS" : "EPUB";

            for (let bookId of libraryIds) {
                let success = await EpubStructure.convertLibraryBookStructure(bookId, currentStructure, newStructure);
                if (success) {
                    converted++;
                } else {
                    failed++;
                }
            }

            return { success: failed === 0, converted, failed, total: libraryIds.length };
        } catch (error) {
            console.error("Error converting library books:", error);
            return { success: false, converted: 0, failed: 0, error: error.message };
        }
    }

    /**
     * Convert ArrayBuffer to base64 string
     * @param {Uint8Array} buffer - Buffer to convert
     * @returns {string} Base64 string
     */
    static arrayBufferToBase64(buffer) {
        let binary = "";
        let bytes = new Uint8Array(buffer);
        let len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }
}