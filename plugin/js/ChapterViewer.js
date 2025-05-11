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

            // Check if this is a library chapter or a chapter from a library book
            if (sourceUrl.startsWith("library://")) {
                chapterContent = await ChapterViewer.getLibraryChapterContent(sourceUrl);
                contentSource = "EPUB Library";
            } else {
                // Try to get from cache for regular web chapters
                chapterContent = await ChapterCache.get(sourceUrl);
                
                if (!chapterContent) {
                    // If not in cache, check if this might be a library chapter with original URL
                    if (window.parser && window.parser.constructor.name === "LibraryParser") {
                        chapterContent = await ChapterViewer.getLibraryChapterByOriginalUrl(sourceUrl);
                    }
                }
                
                // If still no content, check if there's an error message
                if (!chapterContent) {
                    let errorMessage = await ChapterCache.getChapterError(sourceUrl);
                    if (errorMessage) {
                        // Create error content for display
                        let errorElement = document.createElement("div");
                        errorElement.className = "chapter-error";
                        errorElement.innerHTML = `<h3>Chapter Download Failed</h3><p><strong>Error:</strong> ${errorMessage}</p><p class="error-details">Click the refresh icon in the chapter list to retry downloading this chapter.</p>`;
                        chapterContent = errorElement;
                    }
                }
            }
            
            if (chapterContent) {
                
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
     * @param {string} sourceUrl - Library URL in format library://bookId/spinePosition
     * @returns {Element} Chapter content DOM element
     */
    static async getLibraryChapterContent(sourceUrl) {
        try {
            // Parse library URL: library://bookId/spinePosition
            let urlParts = sourceUrl.replace("library://", "").split("/");
            if (urlParts.length !== 2) {
                throw new Error("Invalid library URL format");
            }
            
            let bookId = urlParts[0];
            let spinePosition = parseInt(urlParts[1]);
            
            
            // Get chapter content from Library using spine position
            let content = await LibraryBookData.getChapterContent(bookId, spinePosition);
            
            return content;
        } catch (error) {
            console.error("Error getting library chapter content:", error);
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
            
            // Get the current parser's chapter list
            let chapters = Array.from(window.parser.getPagesToFetch().values());
            
            // Find the chapter with matching sourceUrl
            let chapter = chapters.find(ch => ch.sourceUrl === originalUrl);
            if (!chapter) {
                throw new Error("Chapter not found in library book");
            }
            
            
            // Get the content using the library chapter index
            let content = await LibraryBookData.getChapterContent(chapter.libraryBookId, chapter.epubSpineIndex);
            
            return content;
        } catch (error) {
            console.error("Error getting library chapter by original URL:", error);
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

        // Function to update scroll percentage and visibility
        function updateScrollPercentage() {
            let scrollTop = contentDiv.scrollTop;
            let scrollHeight = contentDiv.scrollHeight - contentDiv.clientHeight;
            
            // Only show percentage if content is actually scrollable
            if (scrollHeight <= 0) {
                scrollPercentageElement.style.display = "none";
                return;
            }
            
            scrollPercentageElement.style.display = "block";
            let percentage = Math.round((scrollTop / scrollHeight) * 100);
            percentage = Math.max(0, Math.min(100, percentage)); // Clamp between 0-100
            
            scrollPercentageElement.textContent = percentage + "%";
        }

        // Initial update
        updateScrollPercentage();

        // Add scroll event listener
        contentDiv.addEventListener("scroll", updateScrollPercentage);
        
        // Also listen for resize events in case content size changes
        window.addEventListener("resize", updateScrollPercentage);
    }

    /**
     * Open a library chapter by book ID and spine position
     * @param {string} bookId - The library book ID
     * @param {number} spinePosition - The chapter's position in the EPUB spine (epubSpineIndex)
     */
    static async openLibraryChapter(bookId, spinePosition) {
        try {
            // Validate inputs - this is a spine position, not a UI array index
            if (typeof spinePosition !== "number" || spinePosition < 0) {
                throw new Error("Spine position must be a non-negative number");
            }
            
            // Create library URL format using spine position
            let libraryUrl = `library://${bookId}/${spinePosition}`;
            
            
            // Get the chapter title from library data
            // Find the chapter by spine position in the extracted book data
            let title = `Chapter ${spinePosition + 1}`;
            try {
                let bookData = await LibraryBookData.extractBookData(bookId);
                // Find the chapter with matching spine position
                let chapter = bookData.chapters.find(ch => ch.epubSpineIndex === spinePosition);
                if (chapter) {
                    title = chapter.title || title;
                }
            } catch (error) {
                // Fallback title if we can't get book data
            }
            
            // Use the existing viewChapter method
            await ChapterViewer.viewChapter(libraryUrl, title);
        } catch (error) {
            console.error("Error opening library chapter:", error);
            alert("Failed to open library chapter: " + error.message);
        }
    }
}