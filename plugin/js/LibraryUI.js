/*
  LibraryUI class - handles all UI rendering, user interactions, and display logic
*/
"use strict";

class LibraryUI {
    
    /**
     * Render all saved EPUBs in the library UI
     */
    static async LibRenderSavedEpubs() {
        let LibRenderResult = document.getElementById("LibRenderResult");
        if (!LibRenderResult) {
            return; // Library section not available/initialized
        }
        
        let LibArray = await LibraryStorage.LibGetStorageIDs();
        let userPreferences = main.getUserPreferences();
        let ShowAdvancedOptions = userPreferences.LibShowAdvancedOptions.value;
        let ShowCompactView = userPreferences.LibShowCompactView.value;
        let CurrentLibKeys = LibArray;
        let LibRenderString = "";

        // Calculate library usage once for both views
        let LibraryUsesHTML = "";
        if (ShowAdvancedOptions && !util.isFirefox()) {
            LibraryUsesHTML = await LibraryUI.LibBytesInUse();
        }

        // Library Header
        LibRenderString += "<div class='library-header'>";
        LibRenderString += "<div class='library-title-column'>Library</div>";
        LibRenderString += "<div class='library-controls-column'>";
        LibRenderString += "<button id='libupdateall'>"+UIText.Library.updateAll+"</button>";
        let viewToggleText = ShowCompactView ? UIText.Library.viewListMode : UIText.Library.viewCompactMode;
        LibRenderString += "<button id='libViewToggle'>" + viewToggleText + "</button>";
        LibRenderString += "<button id='libraryOptionsButton'>Library Options</button>";
        LibRenderString += "</div>";
        LibRenderString += "</div>";
        
        if (ShowCompactView) {
            // Library Compact View Container
            LibRenderString += "<div class='lib-compact-view-container'>";
            if (CurrentLibKeys.length === 0) {
                LibRenderString += "<div class='lib-empty-message'>" + UIText.Library.noBooksMessage + "</div>";
            } else {
                LibRenderString += "<div class='lib-compact-spacer' id='lib-compact-spacer'></div>";
                LibRenderString += "<div class='lib-compact-wrapper' id='lib-compact-wrapper'>";
                LibRenderString += "<div class='lib-compact-grid'>";
            }
            for (let i = 0; i < CurrentLibKeys.length; i++) {
                LibRenderString += "<div class='lib-compact-item' data-libepubid='"+CurrentLibKeys[i]+"'>";
                LibRenderString += "<div class='lib-compact-badge-container'>";
                LibRenderString += "<span class='new-chapter-badge new-chapter-compact' id='LibNewChapterCount"+CurrentLibKeys[i]+"'></span>";
                LibRenderString += "</div>";
                LibRenderString += "<div class='lib-compact-cover-container'>";
                LibRenderString += "<img data-libepubid="+CurrentLibKeys[i]+" class='LibCoverCompact cover-compact-clickable' id='LibCover"+CurrentLibKeys[i]+"'>";
                LibRenderString += "</div>";
                LibRenderString += "</div>";
            }
            if (CurrentLibKeys.length > 0) {
                LibRenderString += "</div>";
                LibRenderString += "</div>";
            }
            LibRenderString += "</div>";
            // Clear existing content and add both controls and library sections
            LibRenderResult.innerHTML = LibRenderString;
            document.getElementById("libupdateall").addEventListener("click", function() {LibraryUI.Libupdateall();});
            document.getElementById("libViewToggle").addEventListener("click", function() {LibraryUI.LibToggleView();});
            document.getElementById("libraryOptionsButton").addEventListener("click", function() {LibraryUI.LibShowOptionsModal();});
            for (let i = 0; i < CurrentLibKeys.length; i++) {
                document.getElementById("LibCover"+CurrentLibKeys[i]).addEventListener("click", function() {LibraryUI.LibCompactCoverClick(this);});
            }
            for (let i = 0; i < CurrentLibKeys.length; i++) {
                document.getElementById("LibCover"+CurrentLibKeys[i]).src = await LibraryStorage.LibGetFromStorage("LibCover" + CurrentLibKeys[i]);
                let newChapterCount = await LibraryStorage.LibGetFromStorage("LibNewChapterCount"+CurrentLibKeys[i]) || 0;
                let newChapterText = (newChapterCount == 0) ? "" : newChapterCount + UIText.Library.newChapter;
                let newChapterElement = document.getElementById("LibNewChapterCount"+CurrentLibKeys[i]);
                if (newChapterElement) {
                    newChapterElement.textContent = newChapterText;
                }
            }
            // Resize spacer to match the height of the absolutely positioned compact wrapper
            LibraryUI.resizeCompactSpacer();
        } else {
            // Library List View Container (flex-based)
            LibRenderString += "<div class='lib-list-view-container'>";
            if (CurrentLibKeys.length === 0) {
                LibRenderString += "<div class='lib-empty-message'>" + UIText.Library.noBooksMessage + "</div>";
            }
            for (let i = 0; i < CurrentLibKeys.length; i++) {
                LibRenderString += "<div class='lib-list-item'>";
                
                // Cover image section
                LibRenderString += "<div class='lib-list-cover'>";
                LibRenderString += "<img class='LibCover' id='LibCover"+CurrentLibKeys[i]+"'>";
                LibRenderString += "</div>";
                
                // Content section
                LibRenderString += "<div class='lib-list-content'>";
                
                // Title row (no more actions menu)
                LibRenderString += "<div class='lib-title-row'>";
                LibRenderString += "<div class='lib-title-display' id='LibTitleDisplay"+CurrentLibKeys[i]+"'></div>";
                LibRenderString += "</div>";
                
                // More actions menu (positioned absolutely within lib-list-item)
                LibRenderString += "<div class='lib-more-actions-wrapper' id='LibMoreActionsWrapper"+CurrentLibKeys[i]+"'>";
                LibRenderString += "<button class='lib-more-actions-icon' id='LibMoreActionsIcon"+CurrentLibKeys[i]+"'></button>";
                LibRenderString += "<div class='lib-more-actions-menu' id='LibMoreActionsMenu"+CurrentLibKeys[i]+"'>";
                // 1. Download EPUB
                LibRenderString += "<div class='menu-item' id='LibDownloadEpubMenuItem"+CurrentLibKeys[i]+"' data-libepubid='"+CurrentLibKeys[i]+"'>";
                LibRenderString += "<span id='LibDownloadEpubIcon"+CurrentLibKeys[i]+"'></span>";
                LibRenderString += "<span>"+UIText.Library.download+"</span>";
                LibRenderString += "</div>";
                // 2. Open Story URL
                LibRenderString += "<div class='menu-item' id='LibOpenStoryUrlMenuItem"+CurrentLibKeys[i]+"' data-libepubid='"+CurrentLibKeys[i]+"'>";
                LibRenderString += "<span id='LibOpenStoryUrlIcon"+CurrentLibKeys[i]+"'></span>";
                LibRenderString += "<span>"+UIText.Library.openStoryURL+"</span>";
                LibRenderString += "</div>";
                // 3. Delete EPUB
                LibRenderString += "<div class='menu-item' id='LibDeleteEpubMenuItem"+CurrentLibKeys[i]+"' data-libepubid='"+CurrentLibKeys[i]+"'>";
                LibRenderString += "<span id='LibDeleteIcon"+CurrentLibKeys[i]+"'></span>";
                LibRenderString += "<span>"+UIText.Library.deleteEpub+"</span>";
                LibRenderString += "</div>";
                // Hidden Clear New Chapters option (shown conditionally)
                LibRenderString += "<div class='menu-item' id='LibClearNewChaptersMenuItem"+CurrentLibKeys[i]+"' data-libepubid='"+CurrentLibKeys[i]+"' style='display: none;'>";
                LibRenderString += "<span id='LibClearNewChaptersIcon"+CurrentLibKeys[i]+"'></span>";
                LibRenderString += "<span>"+UIText.Library.clearNewChaptersAlert+"</span>";
                LibRenderString += "</div>";
                if (ShowAdvancedOptions) {
                    // 4. Add Chapter from different EPUB
                    LibRenderString += "<div class='menu-item' id='LibMergeUploadMenuItem"+CurrentLibKeys[i]+"' data-libepubid='"+CurrentLibKeys[i]+"'>";
                    LibRenderString += "<span id='LibMergeIcon"+CurrentLibKeys[i]+"'></span>";
                    LibRenderString += "<span>"+UIText.Library.mergeUpload+"</span>";
                    LibRenderString += "</div>";
                    // 5. Edit Metadata
                    LibRenderString += "<div class='menu-item' id='LibEditMetadataMenuItem"+CurrentLibKeys[i]+"' data-libepubid='"+CurrentLibKeys[i]+"'>";
                    LibRenderString += "<span id='LibEditIcon"+CurrentLibKeys[i]+"'></span>";
                    LibRenderString += "<span>"+UIText.Library.editMetadata+"</span>";
                    LibRenderString += "</div>";
                }
                LibRenderString += "</div>";
                LibRenderString += "</div>";
                
                // Controls row
                LibRenderString += "<div class='lib-list-controls'>";
                if (ShowAdvancedOptions) {
                    LibRenderString += "<button data-libepubid="+CurrentLibKeys[i]+" id='LibChangeOrderUp"+CurrentLibKeys[i]+"'>↑</button>";
                    LibRenderString += "<button data-libepubid="+CurrentLibKeys[i]+" id='LibChangeOrderDown"+CurrentLibKeys[i]+"'>↓</button>";
                }
                LibRenderString += "<button data-libepubid="+CurrentLibKeys[i]+" id='LibLoadBook"+CurrentLibKeys[i]+"'>"+UIText.Library.selectBook+"</button>";
                LibRenderString += "<button data-libepubid="+CurrentLibKeys[i]+" id='LibUpdateNewChapter"+CurrentLibKeys[i]+"'>"+UIText.Library.updateNewChapter+"</button>";
                
                LibRenderString += "<span class='new-chapter-badge new-chapter-normal' id='LibNewChapterCount"+CurrentLibKeys[i]+"'></span>";
                LibRenderString += "</div>";
                
                // Hidden file input for merge upload functionality
                if (ShowAdvancedOptions) {
                    LibRenderString += "<input type='file' data-libepubid="+CurrentLibKeys[i]+" id='LibMergeUpload"+CurrentLibKeys[i]+"' hidden>";
                }
                
                // URL warning row (hidden by default)
                LibRenderString += "<div class='lib-list-field' id='LibURLWarningField"+CurrentLibKeys[i]+"' style='display: none;'>";
                LibRenderString += "<label class='lib-list-label'></label>";
                LibRenderString += "<div class='lib-list-input-container'>";
                LibRenderString += "<div class='lib-url-warning' id='LibURLWarning"+CurrentLibKeys[i]+"'></div>";
                LibRenderString += "</div>";
                LibRenderString += "</div>";
                LibRenderString += "<div class='lib-list-field'>";
                LibRenderString += "<label class='lib-list-label'>"+UIText.Library.storyURL+"</label>";
                LibRenderString += "<div class='lib-list-input-container'>";
                LibRenderString += "<input data-libepubid="+CurrentLibKeys[i]+" id='LibStoryURL"+CurrentLibKeys[i]+"' type='url' value=''>";
                LibRenderString += "</div>";
                LibRenderString += "</div>";
                
                // Filename section
                LibRenderString += "<div class='lib-list-field'>";
                LibRenderString += "<label class='lib-list-label'>"+UIText.Library.filename+"</label>";
                LibRenderString += "<div class='lib-list-input-container'>";
                LibRenderString += "<input id='LibFilename"+CurrentLibKeys[i]+"' type='text' value=''>";
                LibRenderString += "</div>";
                LibRenderString += "</div>";
                
                // Optional metadata section (moved inside content)
                if (ShowAdvancedOptions) {
                    LibRenderString += "<div id='LibRenderMetadata"+CurrentLibKeys[i]+"'></div>";
                }
                
                LibRenderString += "</div>";
                
                LibRenderString += "</div>";
            }
            LibRenderString += "</div>";
            // Clear existing content and add both controls and library sections
            LibRenderResult.innerHTML = LibRenderString;
            document.getElementById("libupdateall").addEventListener("click", function() {LibraryUI.Libupdateall();});
            document.getElementById("libViewToggle").addEventListener("click", function() {LibraryUI.LibToggleView();});
            document.getElementById("libraryOptionsButton").addEventListener("click", function() {LibraryUI.LibShowOptionsModal();});
            for (let i = 0; i < CurrentLibKeys.length; i++) {
                // Standard event handlers
                document.getElementById("LibUpdateNewChapter"+CurrentLibKeys[i]).addEventListener("click", function() {LibraryUI.LibUpdateNewChapter(this);});
                document.getElementById("LibLoadBook"+CurrentLibKeys[i]).addEventListener("click", function() {LibraryUI.loadLibraryBook(this);});
                document.getElementById("LibStoryURL"+CurrentLibKeys[i]).addEventListener("change", function() {LibraryUI.LibSaveTextURLChange(this);});
                document.getElementById("LibStoryURL"+CurrentLibKeys[i]).addEventListener("focusin", function() {LibraryUI.LibShowTextURLWarning(this);});
                document.getElementById("LibStoryURL"+CurrentLibKeys[i]).addEventListener("focusout", function() {LibraryUI.LibHideTextURLWarning(this);});
                document.getElementById("LibFilename"+CurrentLibKeys[i]).addEventListener("change", function() {LibraryUI.LibSaveTextURLChange(this);});
                
                // Setup three dots menu
                LibraryUI.setupLibraryMoreActionsMenu(CurrentLibKeys[i], ShowAdvancedOptions);
                
                if (ShowAdvancedOptions) {
                    document.getElementById("LibChangeOrderUp"+CurrentLibKeys[i]).addEventListener("click", function() {LibraryUI.LibChangeOrderUp(this);});
                    document.getElementById("LibChangeOrderDown"+CurrentLibKeys[i]).addEventListener("click", function() {LibraryUI.LibChangeOrderDown(this);});
                    document.getElementById("LibMergeUpload"+CurrentLibKeys[i]).addEventListener("change", function() {LibraryUI.LibMergeUpload(this);});
                }
            }
            for (let i = 0; i < CurrentLibKeys.length; i++) {
                let coverElement = document.getElementById("LibCover"+CurrentLibKeys[i]);
                coverElement.src = await LibraryStorage.LibGetFromStorage("LibCover" + CurrentLibKeys[i]);
                
                // Add click handler to cover in list view to show full size cover
                coverElement.style.cursor = "pointer";
                coverElement.dataset.libepubid = CurrentLibKeys[i];
                coverElement.addEventListener("click", function() {
                    LibraryUI.LibListCoverClick(this);
                });
                
                let newChapterCount = await LibraryStorage.LibGetFromStorage("LibNewChapterCount"+CurrentLibKeys[i]) || 0;
                let newChapterText = (newChapterCount == 0) ? "" : newChapterCount + UIText.Library.newChapter;
                let newChapterElement = document.getElementById("LibNewChapterCount"+CurrentLibKeys[i]);
                if (newChapterElement) {
                    newChapterElement.textContent = newChapterText;
                }
                
                // Show/hide the clear new chapters menu item based on whether there are new chapters
                let clearMenuItem = document.getElementById("LibClearNewChaptersMenuItem" + CurrentLibKeys[i]);
                if (clearMenuItem) {
                    clearMenuItem.style.display = (newChapterCount > 0) ? "flex" : "none";
                }
                
                let storyUrl = await LibraryStorage.LibGetFromStorage("LibStoryURL"+CurrentLibKeys[i]);
                let filename = await LibraryStorage.LibGetFromStorage("LibFilename"+CurrentLibKeys[i]);
                let storyUrlElement = document.getElementById("LibStoryURL"+CurrentLibKeys[i]);
                let filenameElement = document.getElementById("LibFilename"+CurrentLibKeys[i]);
                if (storyUrl && storyUrlElement) storyUrlElement.value = storyUrl;
                if (filename && filenameElement) filenameElement.value = filename;
                
                // Set the title display
                try {
                    let metadata = await LibraryStorage.LibGetMetadata(CurrentLibKeys[i]);
                    let title = metadata && metadata[0] ? metadata[0] : (filename || "Untitled");
                    document.getElementById("LibTitleDisplay"+CurrentLibKeys[i]).textContent = title;
                } catch (error) {
                    // Fallback to filename if metadata fetch fails
                    document.getElementById("LibTitleDisplay"+CurrentLibKeys[i]).textContent = filename || "Untitled";
                }
            }
        }
    }

    /**
     * Show loading text in library UI
     */
    static LibShowLoadingText() {
        let LibRenderResult = document.getElementById("LibRenderResult");
        let LibRenderString = "";
        LibRenderString += "<div class='LibDivRenderWrapper'>";
        LibRenderString += "<div class='warning'>";
        LibRenderString += UIText.Library.warningInProgress;
        LibRenderString += "</div>";
        LibRenderString += "</div>";
        LibraryUI.AppendHtmlInDiv(LibRenderString, LibRenderResult, "LibDivRenderWrapper");
    }

    /**
     * Append HTML content to a div element
     */
    static AppendHtmlInDiv(HTMLstring, DivObjectInject, DivClassWraper ) {
        let parser = new DOMParser();
        let parsed = parser.parseFromString(HTMLstring, "text/html");
        let tags = parsed.getElementsByClassName(DivClassWraper);
        DivObjectInject.innerHTML = "";
        for (let  tag of tags) {
            DivObjectInject.appendChild(tag);
        }
    }

    /**
     * Delete all library items
     */
    static LibDeleteAll() {
        if (!confirm(UIText.Library.confirmClearLibrary)) {
            return;
        }
        LibraryUI.LibShowLoadingText();
        chrome.storage.local.get(null, async function(items) {
            let CurrentLibKeys = await LibraryStorage.LibGetAllLibStorageKeys("LibEpub", Object.keys(items));
            let storyurls = [];
            for (let i = 0; i < CurrentLibKeys.length; i++) {
                CurrentLibKeys[i] = CurrentLibKeys[i].replace("LibEpub","");
            }
            for (let i = 0; i < CurrentLibKeys.length; i++) {
                storyurls[i] = items["LibStoryURL" + CurrentLibKeys[i]];
            }
            for (let i = 0; i < storyurls.length; i++) {
                UserPreferences.readFromLocalStorage().readingList.tryDeleteEpubAndSave(storyurls[i]);
            }
            
            // Selectively remove only library-specific keys instead of clearing all storage
            let libraryKeysToRemove = [];
            for (let key in items) {
                if (key.startsWith("Lib")) {
                    libraryKeysToRemove.push(key);
                }
            }
            
            if (libraryKeysToRemove.length > 0) {
                chrome.storage.local.remove(libraryKeysToRemove);
            }
            
            LibraryUI.LibRenderSavedEpubs();
        });
    }

    /**
     * Change order of library items
     */
    static async LibChangeOrder(libepubid, change) {
        let LibArray = [];
        LibArray = await LibraryStorage.LibGetFromStorage("LibArray");
        let currentIndex = -1;
        for (let i = 0; i < LibArray.length; i++) {
            if (LibArray[i] == libepubid) {
                currentIndex = i;
                if (i+change < 0 || i+change >= LibArray.length) {
                    return;
                }
                let temp1 = LibArray[i];
                LibArray[i] = LibArray[i+change];
                LibArray[i+change] = temp1;
                break;
            }
        }
        
        if (currentIndex === -1) {
            return; // Book not found
        }
        
        chrome.storage.local.set({
            ["LibArray"]: LibArray
        });
        
        // Efficiently swap only the two affected DOM elements instead of re-rendering everything
        try {
            LibraryUI.LibSwapBookElements(currentIndex, currentIndex + change);
        } catch (error) {
            console.warn("DOM swapping failed, falling back to full re-render:", error);
            LibraryUI.LibRenderSavedEpubs();
        }
    }

    /**
     * Efficiently swap two book elements in the DOM without full re-render
     */
    static LibSwapBookElements(fromIndex, toIndex) {
        // Check if we're in compact view or list view
        const compactContainer = document.querySelector(".lib-compact-grid");
        const listContainer = document.querySelector(".lib-list-view-container");
        
        let bookElements, container;
        if (compactContainer) {
            // Compact view: books are .lib-compact-item elements
            container = compactContainer;
            bookElements = Array.from(compactContainer.children).filter(child => 
                child.classList.contains("lib-compact-item")
            );
        } else if (listContainer) {
            // List view: books are .lib-list-item elements
            container = listContainer;
            bookElements = Array.from(listContainer.children).filter(child => 
                child.classList.contains("lib-list-item")
            );
        } else {
            return; // No valid container found
        }
        
        if (fromIndex < 0 || toIndex < 0 || fromIndex >= bookElements.length || toIndex >= bookElements.length) {
            return;
        }
        
        const fromElement = bookElements[fromIndex];
        const toElement = bookElements[toIndex];
        
        if (!fromElement || !toElement) {
            return;
        }
        
        // Store original container styles to preserve layout
        const originalStyle = {
            width: container.style.width,
            maxWidth: container.style.maxWidth,
            minWidth: container.style.minWidth
        };
        
        // Use the more reliable insertAdjacentElement method for swapping
        if (fromIndex < toIndex) {
            // Moving down: insert fromElement after toElement
            toElement.insertAdjacentElement("afterend", fromElement);
        } else {
            // Moving up: insert fromElement before toElement
            toElement.insertAdjacentElement("beforebegin", fromElement);
        }
        
        // Restore original container styles if they were changed
        if (originalStyle.width !== container.style.width) container.style.width = originalStyle.width;
        if (originalStyle.maxWidth !== container.style.maxWidth) container.style.maxWidth = originalStyle.maxWidth;
        if (originalStyle.minWidth !== container.style.minWidth) container.style.minWidth = originalStyle.minWidth;
        
        // Trigger a layout reflow to ensure proper positioning
        container.offsetHeight; // Force reflow
    }

    /**
     * Move library item up in order
     */
    static LibChangeOrderUp(objbtn) {
        LibraryUI.LibChangeOrder(objbtn.dataset.libepubid, -1);
    }

    /**
     * Move library item down in order
     */
    static LibChangeOrderDown(objbtn) {
        LibraryUI.LibChangeOrder(objbtn.dataset.libepubid, 1);
    }

    /**
     * Handle button hover effect for upload buttons
     */
    static LibMouseoverButtonUpload(objbtn) {
        let i,j, sel = /button:hover/, aProperties = [];
        for (i = 0; i < document.styleSheets.length; ++i) {
            if (document.styleSheets[i]. cssRules !== null) {
                for (j = 0; j < document.styleSheets[i].cssRules.length; ++j) {    
                    if (sel.test(document.styleSheets[i].cssRules[j].selectorText)) {
                        aProperties.push(document.styleSheets[i].cssRules[j].style.cssText);
                    }
                }
            }
        }
        aProperties.push("pointer-events: none;");
        document.getElementById(objbtn.dataset.libbuttonid+objbtn.dataset.libepubid).style.cssText = aProperties.join(" ");
    }

    /**
     * Handle button mouse out effect for upload buttons
     */
    static LibMouseoutButtonUpload(objbtn) {
        document.getElementById(objbtn.dataset.libbuttonid+objbtn.dataset.libepubid).style.cssText ="pointer-events: none;";
    }
    
    /**
     * Get bytes in use for library storage
     */
    static async LibBytesInUse() {
        return new Promise((resolve) => {
            chrome.storage.local.getBytesInUse(null, function(BytesInUse) {
                resolve(LibraryUI.LibCalcBytesToReadable(BytesInUse) + "Bytes");
            });
        });
    }

    /**
     * Convert bytes to readable format
     */
    static LibCalcBytesToReadable(bytes) {
        let units = ["", "K", "M", "G", "T", "P", "E", "Z", "Y"];
        let l = 0, n = parseInt(bytes, 10) || 0;
        while (n >= 1024 && ++l) {
            n = n/1024;
        }
        return (n.toFixed(n < 10 && l > 0 ? 1 : 0) + " " + units[l]);
    }

    /**
     * Handle merge upload button
     */
    static LibMergeUploadButton(objbtn) {
        document.getElementById("LibMergeUpload"+objbtn.dataset.libepubid).click();
    }
    
    /**
     * Handle merge upload file selection
     */
    static async LibMergeUpload(objbtn) {
        let PreviousEpubBase64 = await LibraryStorage.LibGetFromStorage("LibEpub" + objbtn.dataset.libepubid);
        let AddEpubBlob = objbtn.files[0];
        LibraryStorage.LibMergeEpub(PreviousEpubBase64, AddEpubBlob, objbtn.dataset.libepubid);
    }
    
    /**
     * Handle metadata editing
     * TODO: update name to editMetadataClick
     */
    static async LibEditMetadata(objbtn) {
        let LibRenderResult = document.getElementById("LibRenderMetadata" + objbtn.dataset.libepubid);
        let LibMetadata = await LibraryStorage.LibGetMetadata(objbtn.dataset.libepubid);
        let LibRenderString = "";
        LibRenderString += "<div class='lib-metadata-wrapper'>";
        
        // Title field
        LibRenderString += "<div class='lib-list-field'>";
        LibRenderString += "<label class='lib-list-label'>"+UIText.Metadata.title+"</label>";
        LibRenderString += "<div class='lib-list-input-container'>";
        LibRenderString += "<input id='LibTitleInput"+objbtn.dataset.libepubid+"' type='text' value='"+LibMetadata[0]+"'>";
        LibRenderString += "</div>";
        LibRenderString += "</div>";
        
        // Author field
        LibRenderString += "<div class='lib-list-field'>";
        LibRenderString += "<label class='lib-list-label'>"+UIText.Metadata.author+"</label>";
        LibRenderString += "<div class='lib-list-input-container'>";
        LibRenderString += "<input id='LibAuthorInput"+objbtn.dataset.libepubid+"' type='text' value='"+LibMetadata[1]+"'>";
        LibRenderString += "</div>";
        LibRenderString += "</div>";
        
        // Language field
        LibRenderString += "<div class='lib-list-field'>";
        LibRenderString += "<label class='lib-list-label'>"+UIText.Metadata.language+"</label>";
        LibRenderString += "<div class='lib-list-input-container'>";
        LibRenderString += "<input id='LibLanguageInput"+objbtn.dataset.libepubid+"' type='text' value='"+LibMetadata[2]+"'>";
        LibRenderString += "</div>";
        LibRenderString += "</div>";
        
        // Subject field
        LibRenderString += "<div class='lib-list-field'>";
        LibRenderString += "<label class='lib-list-label'>"+UIText.Metadata.subject+"</label>";
        LibRenderString += "<div class='lib-list-input-container'>";
        LibRenderString += "<textarea rows='2' id='LibSubjectInput"+objbtn.dataset.libepubid+"' name='subjectInput'>"+LibMetadata[3]+"</textarea>";
        LibRenderString += "</div>";
        LibRenderString += "</div>";
        
        // Description field
        LibRenderString += "<div class='lib-list-field lib-description-field'>";
        LibRenderString += "<label class='lib-list-label'>"+UIText.Metadata.description+"</label>";
        LibRenderString += "<div class='lib-list-input-container'>";
        LibRenderString += "<textarea rows='2' id='LibDescriptionInput"+objbtn.dataset.libepubid+"' name='descriptionInput'>"+LibMetadata[4]+"</textarea>";
        LibRenderString += "</div>";
        LibRenderString += "</div>";
        
        // Close button section at the end
        LibRenderString += "<div class='lib-metadata-save'>";
        LibRenderString += "<button data-libepubid="+objbtn.dataset.libepubid+" id='LibMetadataClose"+objbtn.dataset.libepubid+"'>Close Metadata</button>";
        LibRenderString += "</div>";
        
        LibRenderString += "</div>";
        LibraryUI.AppendHtmlInDiv(LibRenderString, LibRenderResult, "lib-metadata-wrapper");
        
        // Add auto-save event listeners to all metadata input fields
        document.getElementById("LibTitleInput"+objbtn.dataset.libepubid).addEventListener("change", function() {LibraryUI.LibAutoSaveMetadata(this);});
        document.getElementById("LibAuthorInput"+objbtn.dataset.libepubid).addEventListener("change", function() {LibraryUI.LibAutoSaveMetadata(this);});
        document.getElementById("LibLanguageInput"+objbtn.dataset.libepubid).addEventListener("change", function() {LibraryUI.LibAutoSaveMetadata(this);});
        document.getElementById("LibSubjectInput"+objbtn.dataset.libepubid).addEventListener("change", function() {LibraryUI.LibAutoSaveMetadata(this);});
        document.getElementById("LibDescriptionInput"+objbtn.dataset.libepubid).addEventListener("change", function() {LibraryUI.LibAutoSaveMetadata(this);});
        
        document.getElementById("LibMetadataClose"+objbtn.dataset.libepubid).addEventListener("click", function() {LibraryUI.LibCloseMetadata(this);});
    }

    /**
     * Auto-save metadata when input fields change
     */
    static async LibAutoSaveMetadata(inputElement) {
        // Extract the book ID from the input element's ID
        let bookId = inputElement.id.replace(/^Lib\w+Input/, "");
        await LibraryStorage.LibSaveMetadataChange({dataset: {libepubid: bookId}});
        
        // Update the title display if the title was changed
        if (inputElement.id.includes("TitleInput")) {
            let titleDisplay = document.getElementById("LibTitleDisplay" + bookId);
            if (titleDisplay) {
                titleDisplay.textContent = inputElement.value || "Untitled";
            }
        }
    }

    /**
     * Close metadata editing interface and save changes
     * TODO: update name to closeMetadataClick
     */
    static async LibCloseMetadata(objbtn) {
        // Save any pending changes before closing
        await LibraryStorage.LibSaveMetadataChange(objbtn);
        
        let metadataContainer = document.getElementById("LibRenderMetadata" + objbtn.dataset.libepubid);
        if (metadataContainer) {
            metadataContainer.innerHTML = "";
        }
    }

    /**
     * Delete an EPUB from library
     */
    static async LibDeleteEpub(objbtn) {
        let bookId = objbtn.dataset.libepubid;
        
        // Check if the book being deleted is currently selected in the main UI
        let isCurrentlySelected = window.currentLibraryBook && window.currentLibraryBook.id === bookId;
        
        await LibraryStorage.LibRemoveStorageIDs(bookId);
        let LibRemove = ["LibEpub" + bookId, "LibStoryURL" + bookId, "LibFilename" + bookId, "LibCover" + bookId, "LibNewChapterCount" + bookId];
        
        // Get story URL from storage or DOM element (compact view doesn't have DOM elements)
        let storyUrlElement = document.getElementById("LibStoryURL" + bookId);
        let storyUrl = storyUrlElement ? storyUrlElement.value : await LibraryStorage.LibGetFromStorage("LibStoryURL" + bookId);
        
        UserPreferences.readFromLocalStorage().readingList.tryDeleteEpubAndSave(storyUrl);
        chrome.storage.local.remove(LibRemove);
        
        // If the deleted book was currently selected, exit library mode
        if (isCurrentlySelected) {
            LibraryUI.LibExitLibraryMode();
        }
        
        await LibraryUI.LibRenderSavedEpubs();
    }

    /**
     * Open the story URL for a library book in a new tab
     */
    static async LibOpenStoryUrl(bookId) {
        try {
            let storyUrl = await LibraryStorage.LibGetFromStorage("LibStoryURL" + bookId);
            if (storyUrl && storyUrl.trim() !== "") {
                window.open(storyUrl, "_blank");
            } else {
                alert("No story URL found for this book.");
            }
        } catch (error) {
            console.error("Error opening story URL:", error);
            alert("Failed to open story URL: " + error.message);
        }
    }

    /**
     * Update an existing book with new chapters
     */
    static async LibUpdateNewChapter(objbtn) {
        let LibGetURL = ["LibStoryURL" + objbtn.dataset.libepubid];
        LibraryUI.LibClearFields();
        let obj = {};
        obj.dataset = {};
        obj.dataset.libclick = "yes";
        main.setUiFieldToValue("startingUrlInput", await LibraryStorage.LibGetFromStorage(LibGetURL));
        await main.onLoadAndAnalyseButtonClick.call(obj);
        if (document.getElementById("includeInReadingListCheckbox").checked != true) {
            document.getElementById("includeInReadingListCheckbox").click();
        }
        try {
            await main.fetchContentAndPackEpub.call(obj);
        } catch {
            //
        }
        LibraryUI.LibClearFields();
    }

    /**
     * UNIFIED LOAD BOOK ACTION - Replaces separate "Search new Chapters" and "Select" 
     * Uses reliable EPUB-based chapter detection instead of brittle Reading List
     */
    static async loadLibraryBook(objbtn) {
        let bookId = objbtn.dataset.libepubid;
        try {
            await LibraryUI.loadLibraryBookInMainUI(bookId);
        } catch (error) {
            console.error("Error in loadLibraryBook:", error);
            // Fallback to old behavior if new method fails
            LibraryUI.LibSearchNewChapter(objbtn);
        }
    }

    /**
     * Handle cover click in LIST mode - show full size cover image
     */
    static LibListCoverClick(coverElement) {
        if (coverElement.src && coverElement.src !== "") {
            let modal = document.getElementById("coverImageModal");
            let fullSizeImg = document.getElementById("fullSizeCoverImg");
            let modalTitle = modal.querySelector(".modal-title");

            // Set loading title first
            modalTitle.textContent = "Cover Image (Loading...)";

            fullSizeImg.src = coverElement.src;
            modal.style.display = "flex";
            document.body.classList.add("modal-open");

            // Update title when image loads
            fullSizeImg.onload = function() {
                modalTitle.textContent = "Cover Image";
            };

            fullSizeImg.onerror = function() {
                modalTitle.textContent = "Cover Image (Failed to load)";
            };
        }
    }

    /**
     * Handle cover click in COMPACT mode - show simplified more actions menu
     */
    static LibCompactCoverClick(coverElement) {
        let bookId = coverElement.dataset.libepubid;
        
        // Create a simplified menu for compact mode
        LibraryUI.showCompactMoreActionsMenu(bookId, coverElement);
    }

    /**
     * Show a simplified more actions menu for compact mode (positioned near the clicked cover)
     */
    static showCompactMoreActionsMenu(bookId, coverElement) {
        // Hide any existing menus first
        document.querySelectorAll(".compact-more-actions-menu").forEach(menu => {
            menu.remove();
        });


        // Create the menu
        let menu = document.createElement("div");
        menu.className = "compact-more-actions-menu lib-more-actions-menu show";
        menu.innerHTML = `
            <div class="menu-item" data-action="select" data-libepubid="${bookId}">
                <span class="compact-menu-icon" data-icon="select"></span>
                <span>${UIText.Library.selectBook}</span>
            </div>
            <div class="menu-item" data-action="update" data-libepubid="${bookId}">
                <span class="compact-menu-icon" data-icon="update"></span>
                <span>${UIText.Library.updateNewChapter}</span>
            </div>
            <div class="menu-item" data-action="download" data-libepubid="${bookId}">
                <span class="compact-menu-icon" data-icon="download"></span>
                <span>${UIText.Library.download}</span>
            </div>
            <div class="menu-item" data-action="open-url" data-libepubid="${bookId}">
                <span class="compact-menu-icon" data-icon="open-url"></span>
                <span>${UIText.Library.openStoryURL}</span>
            </div>
            <div class="menu-item" data-action="delete" data-libepubid="${bookId}">
                <span class="compact-menu-icon" data-icon="delete"></span>
                <span>${UIText.Library.deleteEpub}</span>
            </div>
        `;

        // Add SVG icons to the menu items
        menu.querySelectorAll(".compact-menu-icon").forEach(iconSpan => {
            let iconType = iconSpan.dataset.icon;
            let svgElement;
            
            switch (iconType) {
                case "select":
                    svgElement = SvgIcons.createSvgElement(SvgIcons.CHECK_CIRCLE);
                    break;
                case "update":
                    svgElement = SvgIcons.createSvgElement(SvgIcons.ARROW_CLOCKWISE);
                    break;
                case "download":
                    svgElement = SvgIcons.createSvgElement(SvgIcons.DOWNLOAD);
                    break;
                case "open-url":
                    svgElement = SvgIcons.createSvgElement(SvgIcons.BOX_ARROW_RIGHT);
                    break;
                case "delete":
                    svgElement = SvgIcons.createSvgElement(SvgIcons.TRASH3_FILL);
                    break;
            }
            
            if (svgElement) {
                iconSpan.appendChild(svgElement);
            }
        });

        // Position the menu relative to viewport, not constrained by container
        menu.style.position = "fixed";
        menu.style.zIndex = "3001";
        menu.style.width = "180px"; // Fixed width to prevent stretching
        
        // Calculate position relative to the cover in viewport coordinates
        let rect = coverElement.getBoundingClientRect();
        menu.style.top = (rect.bottom - 10) + "px";
        menu.style.left = (rect.left - 10) + "px";

        // Add menu to document body to avoid container constraints
        document.body.appendChild(menu);

        // Add event listeners
        menu.addEventListener("click", function(e) {
            e.stopPropagation();
            let menuItem = e.target.closest(".menu-item");
            if (menuItem) {
                let action = menuItem.dataset.action;
                let libepubid = menuItem.dataset.libepubid;
                
                // Remove the menu
                menu.remove();
                
                // Execute the action
                switch (action) {
                    case "select":
                        LibraryUI.loadLibraryBook({dataset: {libepubid}});
                        break;
                    case "update":
                        LibraryUI.LibUpdateNewChapter({dataset: {libepubid}});
                        break;
                    case "download":
                        LibraryUI.LibDownload({dataset: {libepubid}});
                        break;
                    case "open-url":
                        LibraryUI.LibOpenStoryUrl(libepubid);
                        break;
                    case "delete":
                        LibraryUI.LibDeleteEpub({dataset: {libepubid}});
                        break;
                }
            }
        });

        // Hide menu when clicking elsewhere or scrolling
        setTimeout(() => {
            function hideCompactMenu() {
                menu.remove();
                document.removeEventListener("click", hideCompactMenu);
                document.removeEventListener("scroll", hideCompactMenu, true);
            }
            
            document.addEventListener("click", hideCompactMenu);
            document.addEventListener("scroll", hideCompactMenu, true);
        }, 0);
    }

    /**
     * Legacy method - kept for compatibility and fallback
     * Search for new chapters for a book
     */
    static LibSearchNewChapter(objbtn) {
        let LibGetURL = ["LibStoryURL" + objbtn.dataset.libepubid];
        chrome.storage.local.get(LibGetURL, function(items) {
            LibraryUI.LibClearFields();
            document.getElementById("startingUrlInput").value = items[LibGetURL];
            //document.getElementById("libinvisbutton").click();
            // load page via XmlHTTPRequest
            main.onLoadAndAnalyseButtonClick().then(function() {
                if (document.getElementById("includeInReadingListCheckbox").checked != true) {
                    document.getElementById("includeInReadingListCheckbox").click();
                }
            },function(e) {
                ErrorLog.showErrorMessage(e);
            });
        });
    }

    /**
     * Clear new chapters alert for a library book
     */
    static LibClearNewChapters(objbtn) {
        let LibRemove = ["LibNewChapterCount" + objbtn.dataset.libepubid];
        chrome.storage.local.remove(LibRemove);
        document.getElementById("LibNewChapterCount"+objbtn.dataset.libepubid).textContent = "";
        
        // Hide the clear new chapters menu item since there are no more new chapters
        let clearMenuItem = document.getElementById("LibClearNewChaptersMenuItem" + objbtn.dataset.libepubid);
        if (clearMenuItem) {
            clearMenuItem.style.display = "none";
        }
    }

    /**
     * Download an EPUB from library
     */
    static LibDownload(objbtn) {
        let LibGetFileAndName = ["LibEpub" + objbtn.dataset.libepubid, "LibFilename" + objbtn.dataset.libepubid];
        chrome.storage.local.get(LibGetFileAndName, async function(items) {
            let userPreferences = main.getUserPreferences();
            let overwriteExisting = userPreferences.overwriteExistingEpub.value;
            let backgroundDownload = userPreferences.noDownloadPopup.value;
            let LibRemove = ["LibNewChapterCount" + objbtn.dataset.libepubid];
            chrome.storage.local.remove(LibRemove);
            document.getElementById("LibNewChapterCount"+objbtn.dataset.libepubid).textContent = "";
            
            // Hide the clear new chapters menu item since there are no more new chapters
            let clearMenuItem = document.getElementById("LibClearNewChaptersMenuItem" + objbtn.dataset.libepubid);
            if (clearMenuItem) {
                clearMenuItem.style.display = "none";
            }
            let blobdata = await LibraryStorage.LibConvertDataUrlToBlob(items["LibEpub" + objbtn.dataset.libepubid]);
            return Download.save(blobdata, items["LibFilename" + objbtn.dataset.libepubid] + ".epub", overwriteExisting, backgroundDownload);
        });
    }

    /**
     * Clear form fields in main UI
     */
    static LibClearFields() {
        main.resetUI();
    }
    
    /**
     * Update all library books
     */
    static async Libupdateall() {
        let userPreferences = main.getUserPreferences();
        if (userPreferences.LibDownloadEpubAfterUpdate.value == true) {
            // Temporarily disable auto-download for batch updates
            userPreferences.LibDownloadEpubAfterUpdate.value = false;
        }
        let LibArray = await LibraryStorage.LibGetFromStorage("LibArray");
        ErrorLog.SuppressErrorLog =  true;
        for (let i = 0; i < LibArray.length; i++) {
            LibraryUI.LibClearFields();
            let obj = {};
            obj.dataset = {};
            obj.dataset.libclick = "yes";
            obj.dataset.libsuppressErrorLog = true;
            document.getElementById("startingUrlInput").value = await LibraryStorage.LibGetFromStorage("LibStoryURL" + LibArray[i]);
            await main.onLoadAndAnalyseButtonClick.call(obj);
            try {
                await main.fetchContentAndPackEpub.call(obj);
            } catch {
                //
            }
        }
        LibraryUI.LibClearFields();
        ErrorLog.SuppressErrorLog =  false;
    }
    
    /**
     * Get URLs from list input
     */
    static getURLsFromList() {
        let inputvalue = document.getElementById("LibAddListToLibraryInput").value;
        let lines = inputvalue.split("\n");
        lines = lines.filter(a => a.trim() != "").map(a => a.trim()).filter(a => URL.canParse(a));
        return lines;
    }
    
    /**
     * Add list of URLs to library
     */
    static async LibAddListToLibrary() {
        let userPreferences = main.getUserPreferences();
        if (userPreferences.LibDownloadEpubAfterUpdate.value == true) {
            // Temporarily disable auto-download for batch updates
            userPreferences.LibDownloadEpubAfterUpdate.value = false;
        }
        let links = LibraryUI.getURLsFromList();
        ErrorLog.SuppressErrorLog =  true;
        for (let i = 0; i < links.length; i++) {
            LibraryUI.LibClearFields();
            let obj = {};
            obj.dataset = {};
            obj.dataset.libclick = "yes";
            obj.dataset.libsuppressErrorLog = true;
            main.setUiFieldToValue("startingUrlInput", links[i]);
            await main.onLoadAndAnalyseButtonClick.call(obj);
            if (document.getElementById("includeInReadingListCheckbox").checked != true) {
                document.getElementById("includeInReadingListCheckbox").click();
            }
            try {
                await main.fetchContentAndPackEpub.call(obj);
            } catch {
                //
            }
        }
        LibraryUI.LibClearFields();
        ErrorLog.SuppressErrorLog =  false;
    }
    
    /**
     * Export all library items
     */
    static LibExportAll() {
        LibraryUI.LibShowLoadingText();
        chrome.storage.local.get(null, async function(items) {
            let CurrentLibKeys = items["LibArray"];
            let storyurls = [];
            for (let i = 0; i < CurrentLibKeys.length; i++) {
                storyurls[i] = items["LibStoryURL" + CurrentLibKeys[i]];
            }
            let readingList = new ReadingList();
            readingList.readFromLocalStorage();
            
            let fileReadingList = {};
            fileReadingList.ReadingList = JSON.parse(readingList.toJson());
            fileReadingList.ReadingList.epubs = fileReadingList.ReadingList.epubs.filter(a => storyurls.includes(a.toc));
            
            let zipFileWriter = new zip.BlobWriter("application/zip");
            let zipWriter = new zip.ZipWriter(zipFileWriter,{useWebWorkers: false,compressionMethod: 8});
            //in case for future changes to differntiate between different export versions
            zipWriter.add("LibraryVersion.txt", new zip.TextReader("2"));
            zipWriter.add("LibraryCountEntries.txt", new zip.TextReader(CurrentLibKeys.length));

            for (let i = 0; i < CurrentLibKeys.length; i++) {
                zipWriter.add("Library/"+i+"/LibCover", new zip.TextReader(items["LibCover" + CurrentLibKeys[i]]));
                zipWriter.add("Library/"+i+"/LibEpub", new zip.TextReader(items["LibEpub" + CurrentLibKeys[i]]));
                zipWriter.add("Library/"+i+"/LibFilename", new zip.TextReader(items["LibFilename" + CurrentLibKeys[i]]));
                zipWriter.add("Library/"+i+"/LibStoryURL", new zip.TextReader(items["LibStoryURL" + CurrentLibKeys[i]]));
                zipWriter.add("Library/"+i+"/LibNewChapterCount", new zip.TextReader(items["LibNewChapterCount"+CurrentLibKeys[i]] ?? "0"));
            }
            zipWriter.add("ReadingList.json", new zip.TextReader(JSON.stringify(fileReadingList)));
            Download.save(await zipWriter.close(), "Libraryexport.zip").catch (err => ErrorLog.showErrorMessage(err));
            LibraryUI.LibRenderSavedEpubs();
        });
    }

    /**
     * Save text or URL changes
     */
    static LibSaveTextURLChange(obj) {
        let LibGetFileAndName = obj.id;
        chrome.storage.local.set({
            [LibGetFileAndName]: obj.value
        });
    }

    /**
     * Show URL change warning
     */
    static LibShowTextURLWarning(obj) {
        let LibWarningElement = document.getElementById("LibURLWarning"+obj.dataset.libepubid);
        let LibWarningField = document.getElementById("LibURLWarningField"+obj.dataset.libepubid);
        
        LibWarningElement.textContent = UIText.Library.warningURLChange;
        LibWarningElement.classList.add("warning-text");
        if (LibWarningField) {
            LibWarningField.style.display = "flex";
        }
    }

    /**
     * Hide URL change warning
     */
    static LibHideTextURLWarning(obj) {
        let LibWarningElement = document.getElementById("LibURLWarning"+obj.dataset.libepubid);
        let LibWarningField = document.getElementById("LibURLWarningField"+obj.dataset.libepubid);
        
        LibWarningElement.textContent = "";
        LibWarningElement.classList.remove("warning-text");
        if (LibWarningField) {
            LibWarningField.style.display = "none";
        }
    }

    /**
     * Show indicator that user is viewing a library book
     */
    static async LibShowBookIndicator(bookId) {
        try {
            // Show the banner
            let indicator = document.getElementById("libraryBookIndicator");
            indicator.hidden = false;
            
            // Store current library book for reference
            window.currentLibraryBook = { id: bookId };

            // Add library-mode class to enable library-only menu items
            document.body.classList.add("library-mode");

            // Update library button text
            if (typeof main !== "undefined" && main.updateLibraryButtonText) {
                main.updateLibraryButtonText();
            }
        } catch (error) {
            console.error("Error showing library book banner:", error);
        }
    }

    /**
     * Hide library book indicator and exit library mode
     * Loads the current URL as a website instead of library book
     */
    static LibExitLibraryMode() {
        let indicator = document.getElementById("libraryBookIndicator");
        indicator.hidden = true;
        window.currentLibraryBook = null;
        window.isLoadingLibraryBook = false;
        
        // Remove library-mode class to hide library-only menu items
        document.body.classList.remove("library-mode");
        
        // Update library button text
        if (typeof main !== "undefined" && main.updateLibraryButtonText) {
            main.updateLibraryButtonText();
        }
        
        // Set a flag to bypass library detection on next load
        window.bypassLibraryDetection = true;
        
        // Update header more actions visibility for normal mode
        ChapterUrlsUI?.updateHeaderMoreActionsVisibility();
        
        // Get current URL and reload as website
        let currentUrl = main.getValueFromUiField("startingUrlInput");
        if (currentUrl) {
            // Clear UI and load as normal website
            main.resetUI();
            main.setUiFieldToValue("startingUrlInput", currentUrl);
            main.onLoadAndAnalyseButtonClick().then();
        } else {
            // Fallback: just reload the page
            location.reload();
        }
    }

    /**
     * Setup event handlers for library book indicator
     */
    static LibSetupBookIndicatorHandlers() {
        let exitButton = document.getElementById("exitLibraryModeButton");
        if (exitButton) {
            exitButton.addEventListener("click", () => {
                LibraryUI.LibExitLibraryMode();
            });
        }
        
        // Setup library banner icon
        let bannerIcon = document.getElementById("libraryBannerIcon");
        if (bannerIcon && bannerIcon.children.length === 0) {
            bannerIcon.appendChild(SvgIcons.createSvgElement(SvgIcons.BOOK));
        }
    }

    /**
     * Setup three dots menu for library items
     */
    static setupLibraryMoreActionsMenu(bookId, showAdvancedOptions) {
        // Add three dots icon
        let moreActionsIcon = document.getElementById("LibMoreActionsIcon" + bookId);
        if (moreActionsIcon && moreActionsIcon.children.length === 0) {
            moreActionsIcon.appendChild(SvgIcons.createSvgElement(SvgIcons.THREE_DOTS_VERTICAL));
        }

        // Add icons to menu items
        let deleteIcon = document.getElementById("LibDeleteIcon" + bookId);
        if (deleteIcon && deleteIcon.children.length === 0) {
            deleteIcon.appendChild(SvgIcons.createSvgElement(SvgIcons.TRASH3_FILL));
        }

        let openStoryUrlIcon = document.getElementById("LibOpenStoryUrlIcon" + bookId);
        if (openStoryUrlIcon && openStoryUrlIcon.children.length === 0) {
            openStoryUrlIcon.appendChild(SvgIcons.createSvgElement(SvgIcons.BOX_ARROW_RIGHT));
        }

        let downloadEpubIcon = document.getElementById("LibDownloadEpubIcon" + bookId);
        if (downloadEpubIcon && downloadEpubIcon.children.length === 0) {
            downloadEpubIcon.appendChild(SvgIcons.createSvgElement(SvgIcons.DOWNLOAD));
        }

        let clearNewChaptersIcon = document.getElementById("LibClearNewChaptersIcon" + bookId);
        if (clearNewChaptersIcon && clearNewChaptersIcon.children.length === 0) {
            clearNewChaptersIcon.appendChild(SvgIcons.createSvgElement(SvgIcons.X_CIRCLE));
        }

        if (showAdvancedOptions) {
            let mergeIcon = document.getElementById("LibMergeIcon" + bookId);
            if (mergeIcon && mergeIcon.children.length === 0) {
                mergeIcon.appendChild(SvgIcons.createSvgElement(SvgIcons.FILE_EARMARK_CHECK));
            }

            let editIcon = document.getElementById("LibEditIcon" + bookId);
            if (editIcon && editIcon.children.length === 0) {
                editIcon.appendChild(SvgIcons.createSvgElement(SvgIcons.FILE_EARMARK_CHECK_FILL));
            }
        }

        // Setup menu toggle handler
        let moreActionsWrapper = document.getElementById("LibMoreActionsWrapper" + bookId);
        let moreActionsMenu = document.getElementById("LibMoreActionsMenu" + bookId);
        
        if (moreActionsWrapper && moreActionsMenu) {
            moreActionsWrapper.onclick = (e) => {
                e.stopPropagation();
                LibraryUI.toggleLibraryMoreActionsMenu(moreActionsMenu);
            };
        }

        // Setup menu item handlers
        let deleteMenuItem = document.getElementById("LibDeleteEpubMenuItem" + bookId);
        if (deleteMenuItem) {
            deleteMenuItem.onclick = (e) => {
                e.stopPropagation();
                LibraryUI.LibDeleteEpub(deleteMenuItem);
                LibraryUI.hideLibraryMoreActionsMenu(moreActionsMenu);
            };
        }

        let openStoryUrlMenuItem = document.getElementById("LibOpenStoryUrlMenuItem" + bookId);
        if (openStoryUrlMenuItem) {
            openStoryUrlMenuItem.onclick = (e) => {
                e.stopPropagation();
                LibraryUI.LibOpenStoryUrl(bookId);
                LibraryUI.hideLibraryMoreActionsMenu(moreActionsMenu);
            };
        }

        let downloadEpubMenuItem = document.getElementById("LibDownloadEpubMenuItem" + bookId);
        if (downloadEpubMenuItem) {
            downloadEpubMenuItem.onclick = (e) => {
                e.stopPropagation();
                LibraryUI.LibDownload(downloadEpubMenuItem);
                LibraryUI.hideLibraryMoreActionsMenu(moreActionsMenu);
            };
        }

        let clearNewChaptersMenuItem = document.getElementById("LibClearNewChaptersMenuItem" + bookId);
        if (clearNewChaptersMenuItem) {
            clearNewChaptersMenuItem.onclick = (e) => {
                e.stopPropagation();
                LibraryUI.LibClearNewChapters(clearNewChaptersMenuItem);
                LibraryUI.hideLibraryMoreActionsMenu(moreActionsMenu);
            };
        }

        if (showAdvancedOptions) {
            let mergeMenuItem = document.getElementById("LibMergeUploadMenuItem" + bookId);
            if (mergeMenuItem) {
                mergeMenuItem.onclick = (e) => {
                    e.stopPropagation();
                    // Trigger the hidden file input
                    document.getElementById("LibMergeUpload" + bookId).click();
                    LibraryUI.hideLibraryMoreActionsMenu(moreActionsMenu);
                };
            }

            let editMenuItem = document.getElementById("LibEditMetadataMenuItem" + bookId);
            if (editMenuItem) {
                editMenuItem.onclick = (e) => {
                    e.stopPropagation();
                    LibraryUI.LibEditMetadata(editMenuItem);
                    LibraryUI.hideLibraryMoreActionsMenu(moreActionsMenu);
                };
            }
        }

        // Close menu when clicking outside
        document.addEventListener("click", () => LibraryUI.hideLibraryMoreActionsMenu(moreActionsMenu));
    }

    /**
     * Toggle library more actions menu visibility
     */
    static toggleLibraryMoreActionsMenu(menu) {
        if (menu.classList.contains("show")) {
            LibraryUI.hideLibraryMoreActionsMenu(menu);
        } else {
            // Hide any other open menus first
            document.querySelectorAll(".lib-more-actions-menu.show").forEach(m => {
                if (m !== menu) {
                    LibraryUI.hideLibraryMoreActionsMenu(m);
                }
            });
            menu.classList.add("show");
            // Add active class to wrapper for higher z-index
            const wrapper = menu.closest(".lib-more-actions-wrapper");
            if (wrapper) {
                wrapper.classList.add("active");
            }
        }
    }

    /**
     * Hide library more actions menu
     */
    static hideLibraryMoreActionsMenu(menu) {
        if (menu) {
            menu.classList.remove("show");
            // Remove active class from wrapper
            const wrapper = menu.closest(".lib-more-actions-wrapper");
            if (wrapper) {
                wrapper.classList.remove("active");
            }
        }
    }

    /**
     * Resize the compact spacer to match the height of the absolutely positioned compact wrapper
     */
    static resizeCompactSpacer() {
        try {
            let spacer = document.getElementById("lib-compact-spacer");
            let wrapper = document.getElementById("lib-compact-wrapper");
            
            if (spacer && wrapper) {
                // Use a brief delay to ensure images are rendered
                setTimeout(() => {
                    let wrapperHeight = wrapper.offsetHeight;
                    spacer.style.height = wrapperHeight + "px";
                }, 100);
            }
        } catch (error) {
            console.error("Error resizing compact spacer:", error);
        }
    }

    /**
     * Toggle between compact and list view for library
     */
    static LibToggleView() {
        let userPreferences = main.getUserPreferences();
        // Toggle the preference value
        userPreferences.LibShowCompactView.value = !userPreferences.LibShowCompactView.value;
        // Save to localStorage
        userPreferences.LibShowCompactView.writeToLocalStorage();
        // Trigger the re-render
        LibraryUI.LibRenderSavedEpubs().then();
    }

    /**
     * Show Library Options modal
     */
    static async LibShowOptionsModal() {
        let modal = document.getElementById("libraryOptionsModal");
        let userPreferences = main.getUserPreferences();
        
        // Sync modal checkboxes with UserPreferences values
        let modalAdvancedCheckbox = document.getElementById("LibShowAdvancedOptionsCheckbox");
        if (modalAdvancedCheckbox) {
            modalAdvancedCheckbox.checked = userPreferences.LibShowAdvancedOptions.value;
        }
        
        let modalDownloadCheckbox = document.getElementById("LibDownloadEpubAfterUpdateCheckbox");
        if (modalDownloadCheckbox) {
            modalDownloadCheckbox.checked = userPreferences.LibDownloadEpubAfterUpdate.value;
        }

        // Populate library usage
        if (!util.isFirefox()) {
            let libraryUsage = await LibraryUI.LibBytesInUse();
            document.getElementById("LibraryUsesModal").textContent = libraryUsage;
        } else {
            document.getElementById("LibraryUsesRowModal").style.display = "none";
        }
        
        // Show modal
        modal.style.display = "flex";
        document.body.classList.add("modal-open");
        
        // Close on background click
        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.style.display = "none";
                document.body.classList.remove("modal-open");
            }
        };
        
        // Setup event listeners if not already done
        LibraryUI.setupLibraryOptionsModalHandlers();
    }

    /**
     * Setup event handlers for Library Options modal
     */
    static setupLibraryOptionsModalHandlers() {
        // Close button
        let closeButton = document.getElementById("closeLibraryOptions");
        if (closeButton && !closeButton.dataset.hasListener) {
            closeButton.addEventListener("click", LibraryUI.LibHideOptionsModal);
            closeButton.dataset.hasListener = "true";
        }
        
        // Advanced options checkbox
        let advancedCheckbox = document.getElementById("LibShowAdvancedOptionsCheckbox");
        if (advancedCheckbox && !advancedCheckbox.dataset.hasListener) {
            advancedCheckbox.addEventListener("change", function() {
                let userPreferences = main.getUserPreferences();
                // Update UserPreferences
                userPreferences.LibShowAdvancedOptions.value = this.checked;
                userPreferences.LibShowAdvancedOptions.writeToLocalStorage();
                
                // Re-render library to apply changes
                LibraryUI.LibRenderSavedEpubs();
            });
            advancedCheckbox.dataset.hasListener = "true";
        }
        
        // Download after update checkbox
        let downloadCheckbox = document.getElementById("LibDownloadEpubAfterUpdateCheckbox");
        if (downloadCheckbox && !downloadCheckbox.dataset.hasListener) {
            downloadCheckbox.addEventListener("change", function() {
                let userPreferences = main.getUserPreferences();
                // Update UserPreferences
                userPreferences.LibDownloadEpubAfterUpdate.value = this.checked;
                userPreferences.LibDownloadEpubAfterUpdate.writeToLocalStorage();
            });
            downloadCheckbox.dataset.hasListener = "true";
        }
        
        // Library action buttons
        let deleteAllBtn = document.getElementById("libdeleteallModal");
        if (deleteAllBtn && !deleteAllBtn.dataset.hasListener) {
            deleteAllBtn.addEventListener("click", LibraryUI.LibDeleteAll);
            deleteAllBtn.dataset.hasListener = "true";
        }
        
        let exportAllBtn = document.getElementById("libExportAllModal");
        if (exportAllBtn && !exportAllBtn.dataset.hasListener) {
            exportAllBtn.addEventListener("click", LibraryUI.LibExportAll);
            exportAllBtn.dataset.hasListener = "true";
        }
        
        // File upload handlers
        let importLabel = document.getElementById("LibImportLibraryLabelModal");
        if (importLabel && !importLabel.dataset.hasListener) {
            importLabel.addEventListener("mouseover", function() {LibraryUI.LibMouseoverButtonUpload(this);});
            importLabel.addEventListener("mouseout", function() {LibraryUI.LibMouseoutButtonUpload(this);});
            importLabel.dataset.hasListener = "true";
        }
        
        let importFile = document.getElementById("LibImportLibraryFileModal");
        if (importFile && !importFile.dataset.hasListener) {
            importFile.addEventListener("change", function() {LibraryStorage.LibHandleImport(this);});
            importFile.dataset.hasListener = "true";
        }
        
        let uploadLabel = document.getElementById("LibUploadEpubLabelModal");
        if (uploadLabel && !uploadLabel.dataset.hasListener) {
            uploadLabel.addEventListener("mouseover", function() {LibraryUI.LibMouseoverButtonUpload(this);});
            uploadLabel.addEventListener("mouseout", function() {LibraryUI.LibMouseoutButtonUpload(this);});
            uploadLabel.dataset.hasListener = "true";
        }
        
        let uploadFile = document.getElementById("LibEpubNewUploadFileModal");
        if (uploadFile && !uploadFile.dataset.hasListener) {
            uploadFile.addEventListener("change", function() {LibraryStorage.LibHandleUpdate(this, -1, "", "", -1);});
            uploadFile.dataset.hasListener = "true";
        }
        
        let addListBtn = document.getElementById("LibAddListToLibraryButtonModal");
        if (addListBtn && !addListBtn.dataset.hasListener) {
            addListBtn.addEventListener("click", function() {
                LibraryUI.LibAddListToLibrary();
                // Clear textarea after processing
                let textarea = document.getElementById("LibAddListToLibraryInput");
                if (textarea) {
                    textarea.value = "";
                }
            });
            addListBtn.dataset.hasListener = "true";
        }
    }

    /**
     * Hide Library Options modal
     */
    static LibHideOptionsModal() {
        let modal = document.getElementById("libraryOptionsModal");
        modal.style.display = "none";
        document.body.classList.remove("modal-open");
    }

    /**
     * Library book selection - moved from LibraryBookData.js
     * @param {HTMLElement} objbtn - The select button element
     */
    static async LibSelectBook(objbtn) {
        try {
            let bookId = objbtn.dataset.libepubid;
            
            // Extract book data from stored EPUB
            let bookData = await LibraryBookData.extractBookData(bookId);
            
            // Populate main UI with book data
            LibraryUI.populateMainUIWithBookData(bookData);
            
            // Switch to main tab/section
            LibraryUI.switchToMainUI();
            
        } catch (error) {
            console.error("Error selecting library book:", error);
            ErrorLog.showErrorMessage("Failed to load library book: " + error.message);
        }
    }

    /**
     * Populate main UI with library book data - moved from LibraryBookData.js
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
                    let urlString = typeof sourceUrl === "string" ? sourceUrl : sourceUrl?.sourceUrl || String(sourceUrl);
                    
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
                            return await LibraryBookData.getChapterContent(chapter.libraryBookId, chapter.epubSpineIndex);
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
     * Switch to main UI section - moved from LibraryBookData.js
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
     * Replaces separate "Search new Chapters" and "Select" actions
     * @param {string} bookId - The Library book ID
     */
    static async loadLibraryBookInMainUI(bookId) {
        try {
            // Reset library chapters visibility state when loading a new library book
            window.hideLibraryChapters = false;
            
            // Show loading indicator
            LibraryUI.LibShowLoadingText();

            // 1. Extract EPUB metadata and populate UI with it
            let bookData = await LibraryBookData.extractBookData(bookId);
            main.resetUI();
            LibraryUI.populateMainUIWithBookData(bookData);
            
            // 2. Load library chapters with mock parser
            await LibraryUI.loadBookWithMockParser(bookId);
            
            // 3. Clear loading indicator and switch to main UI early
            await LibraryUI.LibRenderSavedEpubs();
            LibraryUI.switchToMainUI();
            
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
                    await chapterUrlsUI.updateChapterListIncrementally(updatedChapters);
                    
                    // Add library-specific visual indicators
                    await ChapterUrlsUI.addLibraryChapterIndicators(bookId, updatedChapters);
                }
                
            } catch (parserError) {
                // Library chapters are already displayed, so this is graceful degradation
            }

            ChapterUrlsUI?.updateHeaderMoreActionsVisibility();
        } catch (error) {
            console.error("Error loading library book in main UI:", error);
            await LibraryUI.LibRenderSavedEpubs();
            alert("Failed to load library book: " + error.message);
        }
    }

    /**
     * Load book with mock parser fallback - moved from LibraryBookData.js
     * @param {string} bookId - The Library book ID
     */
    static async loadBookWithMockParser(bookId) {
        try {
            // Use existing LibSelectBook logic as fallback
            await LibraryUI.LibSelectBook({dataset: {libepubid: bookId}});
            
        } catch (error) {
            console.error("Error loading book with mock parser:", error);
            throw error;
        }
    }
}