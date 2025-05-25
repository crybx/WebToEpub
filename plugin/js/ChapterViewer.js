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
            let cachedContent = await ChapterCache.get(sourceUrl);
            if (cachedContent) {
                // Show the viewer
                let viewer = document.getElementById("chapterViewer");
                let contentDiv = document.getElementById("chapterViewerContent");
                let titleElement = document.getElementById("chapterViewerTitle");
                
                // Clear previous content
                contentDiv.innerHTML = "";
                
                // Set title in the title bar
                titleElement.textContent = title;
                
                // Add chapter content
                contentDiv.appendChild(cachedContent.cloneNode(true));
                
                // Apply custom stylesheet if available
                this.applyCustomStylesheet();
                
                // Show viewer
                viewer.style.display = "flex";
                
                // Set up close button
                document.getElementById("closeChapterViewer").onclick = () => {
                    viewer.style.display = "none";
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
                        // Remove custom stylesheet when closing viewer
                        let customStyle = document.getElementById("chapterViewerCustomStyle");
                        if (customStyle) {
                            customStyle.remove();
                        }
                    }
                };
            } else {
                alert("Chapter not found");
            }
        } catch (err) {
            console.error("Error viewing chapter:", err);
            alert("Error loading chapter");
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
                    return ''; // Remove from main CSS
                });
                
                // Now extract regular CSS rules from the cleaned CSS
                let rules = cssWithoutAtRules.match(/([^{}]+)\{([^{}]*)\}/g) || [];
                
                let scopedRules = [];
                
                // Add @-rules (like @charset) at the beginning
                scopedRules.push(...atRules);
                
                let bodyMargins = { top: '0px', right: '0px', bottom: '0px', left: '0px' };
                
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
                            .split(',')
                            .map(selector => {
                                let trimmedSelector = selector.trim();
                                // Special case: if selector is just 'body', map it to the content container
                                if (trimmedSelector === 'body') {
                                    // Extract margin values from body styles
                                    bodyMargins = this.extractMargins(declarations);
                                    // Remove margins from body declarations to prevent scrollbar issues
                                    declarations = this.removeMargins(declarations);
                                    return '#chapterViewerContent';
                                }
                                // Otherwise, scope normally
                                return `#chapterViewerContent ${trimmedSelector}`;
                            })
                            .join(', ');
                        
                        scopedRules.push(`${scopedSelectors} {\n  ${declarations}\n}`);
                    }
                }
                
                // Apply extracted body margins as additional padding to the content container
                if (bodyMargins.top || bodyMargins.right || bodyMargins.bottom || bodyMargins.left) {
                    let paddingRule = `#chapterViewerContent {\n  padding: calc(20px + ${bodyMargins.top}) calc(25px + ${bodyMargins.right}) calc(20px + ${bodyMargins.bottom}) calc(25px + ${bodyMargins.left}) !important;\n}`;
                    scopedRules.push(paddingRule);
                }

                styleElement.textContent = scopedRules.join('\n\n');
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
        let margins = { top: '0px', right: '0px', bottom: '0px', left: '0px' };
        
        // Split declarations by semicolon and process each
        let decls = declarations.split(';').map(d => d.trim()).filter(d => d);
        
        for (let decl of decls) {
            let [property, value] = decl.split(':').map(s => s.trim());
            if (!property || !value) continue;
            
            if (property === 'margin') {
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
            } else if (property === 'margin-top') {
                margins.top = value;
            } else if (property === 'margin-right') {
                margins.right = value;
            } else if (property === 'margin-bottom') {
                margins.bottom = value;
            } else if (property === 'margin-left') {
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
        let decls = declarations.split(';').map(d => d.trim()).filter(d => d);
        let filteredDecls = decls.filter(decl => {
            let property = decl.split(':')[0].trim();
            return !property.startsWith('margin');
        });
        
        return filteredDecls.join(';\n  ');
    }
}