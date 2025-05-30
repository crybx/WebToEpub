"use strict";

/** Class that handles chapter viewing in a modal popup */
class ChapterViewer {
    /**
     * View chapter in a popup
     * @param {string} sourceUrl - The URL of the chapter
     * @param {string} title - The title of the chapter
     */
    static async viewChapter(sourceUrl, title) {
        try {
            let chapterContent = null;
            let contentSource = "unknown";
            
            console.log(`📖 ChapterViewer: Opening chapter "${title}" from URL: ${sourceUrl}`);
            
            // Check if this is a library chapter or a chapter from a library book
            if (sourceUrl.startsWith("library://")) {
                console.log("🏛️ Loading chapter content from EPUB library (library:// URL)");
                chapterContent = await ChapterViewer.getLibraryChapterContent(sourceUrl);
                contentSource = "EPUB Library";
            } else {
                // Try to get from cache for regular web chapters
                console.log("🔍 Checking cache for chapter content...");
                chapterContent = await ChapterCache.get(sourceUrl);
                
                if (chapterContent) {
                    console.log("💾 ✅ Chapter content found in CACHE");
                    contentSource = "Cache";
                } else {
                    console.log("💾 ❌ Chapter not found in cache");
                    
                    // If not in cache, check if this might be a library chapter with original URL
                    if (window.parser && window.parser.constructor.name === "LibraryParser") {
                        console.log("🏛️ Parser is LibraryParser, attempting to load from EPUB library...");
                        chapterContent = await ChapterViewer.getLibraryChapterByOriginalUrl(sourceUrl);
                        if (chapterContent) {
                            console.log("🏛️ ✅ Chapter content found in EPUB library");
                            contentSource = "EPUB Library";
                        } else {
                            console.log("🏛️ ❌ Chapter not found in EPUB library");
                        }
                    }
                }
                
                // If still no content, check if there's an error message
                if (!chapterContent) {
                    console.log("❗ No content found, checking for error messages...");
                    let errorMessage = await ChapterCache.getChapterError(sourceUrl);
                    if (errorMessage) {
                        console.log("❌ Chapter has error message:", errorMessage);
                        // Create error content for display
                        let errorElement = document.createElement("div");
                        errorElement.className = "chapter-error";
                        errorElement.innerHTML = `<h3>Chapter Download Failed</h3><p><strong>Error:</strong> ${errorMessage}</p><p class="error-details">Click the refresh icon in the chapter list to retry downloading this chapter.</p>`;
                        chapterContent = errorElement;
                        contentSource = "Error Message";
                    }
                }
            }
            
            if (chapterContent) {
                console.log(`✅ CHAPTER LOADED SUCCESSFULLY from: ${contentSource}`);
                console.log(`📊 Content source summary: "${title}" loaded from ${contentSource}`);
                
                // Show the viewer
                let viewer = document.getElementById("chapterViewer");
                let contentDiv = document.getElementById("chapterViewerContent");
                let titleElement = document.getElementById("chapterViewerTitle");
                
                // Clear previous content
                contentDiv.innerHTML = "";
                
                // Set title in the title bar
                titleElement.textContent = title;
                
                // Add chapter content
                contentDiv.appendChild(chapterContent.cloneNode(true));
                
                // Apply custom stylesheet if available
                this.applyCustomStylesheet();
                
                // Show viewer
                viewer.style.display = "flex";
                document.body.classList.add("modal-open");
                
                // Set up scroll percentage tracking
                ChapterViewer.setupScrollPercentage(contentDiv);
                
                // Set up close button
                document.getElementById("closeChapterViewer").onclick = () => {
                    viewer.style.display = "none";
                    document.body.classList.remove("modal-open");
                    // Remove custom stylesheet when closing viewer
                    let customStyle = document.getElementById("chapterViewerCustomStyle");
                    if (customStyle) {
                        customStyle.remove();
                    }
                };
                
                // Close on background click
                viewer.onclick = (e) => {
                    if (e.target === viewer) {
                        viewer.style.display = "none";
                        document.body.classList.remove("modal-open");
                        // Remove custom stylesheet when closing viewer
                        let customStyle = document.getElementById("chapterViewerCustomStyle");
                        if (customStyle) {
                            customStyle.remove();
                        }
                    }
                };
            } else {
                let errorMsg = sourceUrl.startsWith("library://") ? 
                    "Library chapter not found or failed to load" : 
                    "Chapter not found in cache";
                alert(errorMsg);
            }
        } catch (err) {
            console.error("Error viewing chapter:", err);
            let errorMsg = sourceUrl.startsWith("library://") ? 
                "Error loading library chapter: " + err.message : 
                "Error loading chapter";
            alert(errorMsg);
        }
    }

    /**
     * Apply custom stylesheet from Advanced Options to the chapter viewer
     */
    static applyCustomStylesheet() {
        try {
            // Remove any existing custom stylesheet for the viewer
            let existingStyle = document.getElementById("chapterViewerCustomStyle");
            if (existingStyle) {
                existingStyle.remove();
            }

            // Get the custom stylesheet from the Advanced Options
            let stylesheetInput = document.getElementById("stylesheetInput");
            if (stylesheetInput && stylesheetInput.value.trim()) {
                // Create a new style element
                let styleElement = document.createElement("style");
                styleElement.id = "chapterViewerCustomStyle";
                
                // Scope the styles to only apply within the cached chapter content
                // Use a proper CSS parsing approach
                let css = stylesheetInput.value;
                
                // First, remove all @-rules from the CSS and store them separately
                let atRules = [];
                let cssWithoutAtRules = css.replace(/@[^;]+;/g, (match) => {
                    atRules.push(match);
                    return ""; // Remove from main CSS
                });
                
                // Now extract regular CSS rules from the cleaned CSS
                let rules = cssWithoutAtRules.match(/([^{}]+)\{([^{}]*)\}/g) || [];
                
                let scopedRules = [];
                
                // Add @-rules (like @charset) at the beginning
                scopedRules.push(...atRules);
                
                let bodyMargins = { top: "0px", right: "0px", bottom: "0px", left: "0px" };
                
                // Process each CSS rule
                for (let rule of rules) {
                    let match = rule.match(/([^{]+)\{([^}]*)\}/);
                    if (match) {
                        let selectorPart = match[1].trim();
                        let declarations = match[2].trim();
                        
                        // Skip empty selectors
                        if (!selectorPart) {
                            continue;
                        }
                        
                        // Handle comma-separated selectors properly
                        let scopedSelectors = selectorPart
                            .split(",")
                            .map(selector => {
                                let trimmedSelector = selector.trim();
                                // Special case: if selector is just "body", map it to the content container
                                if (trimmedSelector === "body") {
                                    // Extract margin values from body styles
                                    bodyMargins = this.extractMargins(declarations);
                                    // Remove margins from body declarations to prevent scrollbar issues
                                    declarations = this.removeMargins(declarations);
                                    return "#chapterViewerContent";
                                }
                                // Otherwise, scope normally
                                return `#chapterViewerContent ${trimmedSelector}`;
                            })
                            .join(", ");
                        
                        scopedRules.push(`${scopedSelectors} {\n  ${declarations}\n}`);
                    }
                }
                
                // Apply extracted body margins as additional padding to the content container
                if (bodyMargins.top || bodyMargins.right || bodyMargins.bottom || bodyMargins.left) {
                    let paddingRule = `#chapterViewerContent {\n  padding: calc(20px + ${bodyMargins.top}) calc(25px + ${bodyMargins.right}) calc(20px + ${bodyMargins.bottom}) calc(25px + ${bodyMargins.left}) !important;\n}`;
                    scopedRules.push(paddingRule);
                }

                styleElement.textContent = scopedRules.join("\n\n");
                document.head.appendChild(styleElement);
            }
        } catch (error) {
            console.error("Error applying custom stylesheet:", error);
        }
    }

    /**
     * Extract margin values from CSS declarations
     * @private
     */
    static extractMargins(declarations) {
        let margins = { top: "0px", right: "0px", bottom: "0px", left: "0px" };
        
        // Split declarations by semicolon and process each
        let decls = declarations.split(";").map(d => d.trim()).filter(d => d);
        
        for (let decl of decls) {
            let [property, value] = decl.split(":").map(s => s.trim());
            if (!property || !value) continue;
            
            if (property === "margin") {
                // Handle shorthand margin property
                let values = value.split(/\s+/);
                if (values.length === 1) {
                    margins.top = margins.right = margins.bottom = margins.left = values[0];
                } else if (values.length === 2) {
                    margins.top = margins.bottom = values[0];
                    margins.right = margins.left = values[1];
                } else if (values.length === 3) {
                    margins.top = values[0];
                    margins.right = margins.left = values[1];
                    margins.bottom = values[2];
                } else if (values.length === 4) {
                    margins.top = values[0];
                    margins.right = values[1];
                    margins.bottom = values[2];
                    margins.left = values[3];
                }
            } else if (property === "margin-top") {
                margins.top = value;
            } else if (property === "margin-right") {
                margins.right = value;
            } else if (property === "margin-bottom") {
                margins.bottom = value;
            } else if (property === "margin-left") {
                margins.left = value;
            }
        }
        
        return margins;
    }

    /**
     * Remove margin properties from CSS declarations
     * @private
     */
    static removeMargins(declarations) {
        // Split declarations by semicolon and filter out margin properties
        let decls = declarations.split(";").map(d => d.trim()).filter(d => d);
        let filteredDecls = decls.filter(decl => {
            let property = decl.split(":")[0].trim();
            return !property.startsWith("margin");
        });
        
        return filteredDecls.join(";\n  ");
    }

    /**
     * Get chapter content from Library EPUB
     * @param {string} sourceUrl - Library URL in format library://bookId/chapterIndex
     * @returns {Element} Chapter content DOM element
     */
    static async getLibraryChapterContent(sourceUrl) {
        try {
            // Parse library URL: library://bookId/chapterIndex
            let urlParts = sourceUrl.replace("library://", "").split("/");
            if (urlParts.length !== 2) {
                throw new Error("Invalid library URL format");
            }
            
            let bookId = urlParts[0];
            let chapterIndex = parseInt(urlParts[1]);
            
            console.log(`🏛️ Extracting chapter ${chapterIndex} from EPUB library book ${bookId}`);
            
            // Get chapter content from Library
            let content = await LibraryBookData.getChapterContent(bookId, chapterIndex);
            
            console.log(`🏛️ Successfully extracted chapter from EPUB library`);
            return content;
        } catch (error) {
            console.error("❌ Error getting library chapter content:", error);
            throw new Error("Failed to load library chapter: " + error.message);
        }
    }

    /**
     * Get library chapter content by original URL
     * @param {string} originalUrl - Original web URL of the chapter
     * @returns {Element} Chapter content DOM element
     */
    static async getLibraryChapterByOriginalUrl(originalUrl) {
        try {
            console.log(`🔍 Searching for chapter with original URL: ${originalUrl}`);
            
            // Get the current parser's chapter list
            let chapters = Array.from(window.parser.getPagesToFetch().values());
            
            // Find the chapter with matching sourceUrl
            let chapter = chapters.find(ch => ch.sourceUrl === originalUrl);
            if (!chapter) {
                console.log(`❌ Chapter with URL ${originalUrl} not found in library book`);
                throw new Error("Chapter not found in library book");
            }
            
            console.log(`🏛️ Found chapter in library: bookId=${chapter.libraryBookId}, chapterIndex=${chapter.libraryChapterIndex}`);
            
            // Get the content using the library chapter index
            let content = await LibraryBookData.getChapterContent(chapter.libraryBookId, chapter.libraryChapterIndex);
            
            console.log(`🏛️ Successfully loaded chapter from EPUB library using original URL`);
            return content;
        } catch (error) {
            console.error("❌ Error getting library chapter by original URL:", error);
            throw new Error("Failed to load library chapter: " + error.message);
        }
    }

    /**
     * Set up scroll percentage tracking for the chapter content
     * @param {Element} contentDiv - The scrollable content container
     */
    static setupScrollPercentage(contentDiv) {
        let scrollPercentageElement = document.getElementById("scrollPercentage");
        
        if (!scrollPercentageElement) {
            return;
        }

        // Function to update scroll percentage
        function updateScrollPercentage() {
            let scrollTop = contentDiv.scrollTop;
            let scrollHeight = contentDiv.scrollHeight - contentDiv.clientHeight;
            
            let percentage = scrollHeight > 0 ? Math.round((scrollTop / scrollHeight) * 100) : 0;
            percentage = Math.max(0, Math.min(100, percentage)); // Clamp between 0-100
            
            scrollPercentageElement.textContent = percentage + "%";
        }

        // Initial update
        updateScrollPercentage();

        // Add scroll event listener
        contentDiv.addEventListener("scroll", updateScrollPercentage);
    }

    /**
     * Open a library chapter by book ID and chapter index
     * @param {string} bookId - The library book ID
     * @param {number} chapterIndex - The chapter index within the book
     */
    static async openLibraryChapter(bookId, chapterIndex) {
        try {
            console.log(`👁️ EYE ICON CLICKED: Opening library chapter ${chapterIndex} from book ${bookId}`);
            
            // Create library URL format
            let libraryUrl = `library://${bookId}/${chapterIndex}`;
            
            console.log(`🏛️ Generated library URL: ${libraryUrl}`);
            
            // Get the chapter title from library data if possible
            let title = `Chapter ${chapterIndex + 1}`;
            try {
                let bookData = await LibraryBookData.extractBookData(bookId);
                if (bookData.chapters[chapterIndex]) {
                    title = bookData.chapters[chapterIndex].title || title;
                }
                console.log(`📖 Chapter title: "${title}"`);
            } catch (error) {
                console.log("Could not get chapter title, using default:", error);
            }
            
            // Use the existing viewChapter method
            console.log(`📋 Calling viewChapter() to display the chapter content`);
            await ChapterViewer.viewChapter(libraryUrl, title);
        } catch (error) {
            console.error("❌ Error opening library chapter:", error);
            alert("Failed to open library chapter: " + error.message);
        }
    }
}