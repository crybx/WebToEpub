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
        let LibTemplateDeleteEpub = document.getElementById("LibTemplateDeleteEpub").innerHTML;
        let LibTemplateSearchNewChapter = document.getElementById("LibTemplateSearchNewChapter").innerHTML;
        let LibTemplateUpdateNewChapter = document.getElementById("LibTemplateUpdateNewChapter").innerHTML;
        let LibTemplateDownload = document.getElementById("LibTemplateDownload").innerHTML;
        let LibTemplateSelectBook = document.getElementById("LibTemplateSelectBook").innerHTML;
        let LibTemplateNewChapter = document.getElementById("LibTemplateNewChapter").innerHTML;
        let LibTemplateURL = document.getElementById("LibTemplateURL").innerHTML;
        let LibTemplateFilename = document.getElementById("LibTemplateFilename").innerHTML;
        let LibTemplateMergeUploadButton = "";
        let LibTemplateEditMetadataButton = "";

        // Calculate library usage once for both views
        let LibraryUsesHTML = "";
        if (ShowAdvancedOptions && !util.isFirefox()) {
            LibraryUsesHTML = await LibraryUI.LibBytesInUse();
        }

        // Library Header
        LibTemplateMergeUploadButton = document.getElementById("LibTemplateMergeUploadButton").innerHTML;
        LibTemplateEditMetadataButton = document.getElementById("LibTemplateEditMetadataButton").innerHTML;
        LibRenderString += "<div class='library-header'>";
        LibRenderString += "<div class='library-title-column'>Library</div>";
        LibRenderString += "<div class='library-controls-column'>";
        LibRenderString += "<button id='libupdateall'>"+document.getElementById("LibTemplateUpdateAll").innerHTML+"</button>";
        let viewToggleText = ShowCompactView ? "View Library List" : "View Compact Library";
        LibRenderString += "<button id='libViewToggle'>" + viewToggleText + "</button>";
        LibRenderString += "<button id='libraryOptionsButton'>Library Options</button>";
        LibRenderString += "</div>";
        LibRenderString += "</div>";
        
        if (ShowCompactView) {
            // Library Compact View Container
            LibRenderString += "<div class='lib-compact-view-container'>";
            if (CurrentLibKeys.length === 0) {
                LibRenderString += "<div class='lib-empty-message'>" + chrome.i18n.getMessage("__MSG_label_library_no_books__") + "</div>";
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
                let newChapterText = (newChapterCount == 0) ? "" : newChapterCount + LibTemplateNewChapter;
                document.getElementById("LibNewChapterCount"+CurrentLibKeys[i]).textContent = newChapterText;
            }
            // Resize spacer to match the height of the absolutely positioned compact wrapper
            LibraryUI.resizeCompactSpacer();
        } else {
            // Library List View Container (flex-based)
            LibRenderString += "<div class='lib-list-view-container'>";
            if (CurrentLibKeys.length === 0) {
                LibRenderString += "<div class='lib-empty-message'>" + chrome.i18n.getMessage("__MSG_label_library_no_books__") + "</div>";
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
                LibRenderString += "<span>"+LibTemplateDownload+"</span>";
                LibRenderString += "</div>";
                // 2. Open Story URL
                LibRenderString += "<div class='menu-item' id='LibOpenStoryUrlMenuItem"+CurrentLibKeys[i]+"' data-libepubid='"+CurrentLibKeys[i]+"'>";
                LibRenderString += "<span id='LibOpenStoryUrlIcon"+CurrentLibKeys[i]+"'></span>";
                LibRenderString += "<span>"+chrome.i18n.getMessage("__MSG_menu_Open_Story_URL__")+"</span>";
                LibRenderString += "</div>";
                // 3. Delete EPUB
                LibRenderString += "<div class='menu-item' id='LibDeleteEpubMenuItem"+CurrentLibKeys[i]+"' data-libepubid='"+CurrentLibKeys[i]+"'>";
                LibRenderString += "<span id='LibDeleteIcon"+CurrentLibKeys[i]+"'></span>";
                LibRenderString += "<span>"+LibTemplateDeleteEpub+"</span>";
                LibRenderString += "</div>";
                // Hidden Clear New Chapters option (shown conditionally)
                LibRenderString += "<div class='menu-item' id='LibClearNewChaptersMenuItem"+CurrentLibKeys[i]+"' data-libepubid='"+CurrentLibKeys[i]+"' style='display: none;'>";
                LibRenderString += "<span id='LibClearNewChaptersIcon"+CurrentLibKeys[i]+"'></span>";
                LibRenderString += "<span>Clear New Chapters Alert</span>";
                LibRenderString += "</div>";
                if (ShowAdvancedOptions) {
                    // 4. Add Chapter from different EPUB
                    LibRenderString += "<div class='menu-item' id='LibMergeUploadMenuItem"+CurrentLibKeys[i]+"' data-libepubid='"+CurrentLibKeys[i]+"'>";
                    LibRenderString += "<span id='LibMergeIcon"+CurrentLibKeys[i]+"'></span>";
                    LibRenderString += "<span>"+LibTemplateMergeUploadButton+"</span>";
                    LibRenderString += "</div>";
                    // 5. Edit Metadata
                    LibRenderString += "<div class='menu-item' id='LibEditMetadataMenuItem"+CurrentLibKeys[i]+"' data-libepubid='"+CurrentLibKeys[i]+"'>";
                    LibRenderString += "<span id='LibEditIcon"+CurrentLibKeys[i]+"'></span>";
                    LibRenderString += "<span>"+LibTemplateEditMetadataButton+"</span>";
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
                LibRenderString += "<button data-libepubid="+CurrentLibKeys[i]+" id='LibLoadBook"+CurrentLibKeys[i]+"'>Select Book</button>";
                LibRenderString += "<button data-libepubid="+CurrentLibKeys[i]+" id='LibUpdateNewChapter"+CurrentLibKeys[i]+"'>"+LibTemplateUpdateNewChapter+"</button>";
                
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
                LibRenderString += "<label class='lib-list-label'>"+LibTemplateURL+"</label>";
                LibRenderString += "<div class='lib-list-input-container'>";
                LibRenderString += "<input data-libepubid="+CurrentLibKeys[i]+" id='LibStoryURL"+CurrentLibKeys[i]+"' type='url' value=''>";
                LibRenderString += "</div>";
                LibRenderString += "</div>";
                
                // Filename section
                LibRenderString += "<div class='lib-list-field'>";
                LibRenderString += "<label class='lib-list-label'>"+LibTemplateFilename+"</label>";
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
                document.getElementById("LibLoadBook"+CurrentLibKeys[i]).addEventListener("click", function() {LibraryUI.LibLoadBook(this);});
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
                let newChapterText = (newChapterCount == 0) ? "" : newChapterCount + LibTemplateNewChapter;
                document.getElementById("LibNewChapterCount"+CurrentLibKeys[i]).textContent = newChapterText;
                
                // Show/hide the clear new chapters menu item based on whether there are new chapters
                let clearMenuItem = document.getElementById("LibClearNewChaptersMenuItem" + CurrentLibKeys[i]);
                if (clearMenuItem) {
                    clearMenuItem.style.display = (newChapterCount > 0) ? "flex" : "none";
                }
                
                let storyUrl = await LibraryStorage.LibGetFromStorage("LibStoryURL"+CurrentLibKeys[i]);
                let filename = await LibraryStorage.LibGetFromStorage("LibFilename"+CurrentLibKeys[i]);
                if (storyUrl) document.getElementById("LibStoryURL"+CurrentLibKeys[i]).value = storyUrl;
                if (filename) document.getElementById("LibFilename"+CurrentLibKeys[i]).value = filename;
                
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
        LibRenderString += document.getElementById("LibTemplateWarningInProgress").innerHTML;
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
    static Libdeleteall() {
        if (!confirm(chrome.i18n.getMessage("__MSG_confirm_Clear_Library__"))) {
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
            chrome.storage.local.clear();
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
     */
    static async LibEditMetadata(objbtn) {
        let LibTemplateMetadataSave = document.getElementById("LibTemplateMetadataSave").innerHTML;
        let LibTemplateMetadataTitle = document.getElementById("LibTemplateMetadataTitle").innerHTML;
        let LibTemplateMetadataAuthor = document.getElementById("LibTemplateMetadataAuthor").innerHTML;
        let LibTemplateMetadataLanguage = document.getElementById("LibTemplateMetadataLanguage").innerHTML;
        let LibTemplateMetadataSubject = document.getElementById("LibTemplateMetadataSubject").innerHTML;
        let LibTemplateMetadataDescription = document.getElementById("LibTemplateMetadataDescription").innerHTML;
        let LibRenderResult = document.getElementById("LibRenderMetadata" + objbtn.dataset.libepubid);
        let LibMetadata = await LibraryStorage.LibGetMetadata(objbtn.dataset.libepubid);
        let LibRenderString = "";
        LibRenderString += "<div class='lib-metadata-wrapper'>";
        
        // Title field
        LibRenderString += "<div class='lib-list-field'>";
        LibRenderString += "<label class='lib-list-label'>"+LibTemplateMetadataTitle+"</label>";
        LibRenderString += "<div class='lib-list-input-container'>";
        LibRenderString += "<input id='LibTitleInput"+objbtn.dataset.libepubid+"' type='text' value='"+LibMetadata[0]+"'>";
        LibRenderString += "</div>";
        LibRenderString += "</div>";
        
        // Author field
        LibRenderString += "<div class='lib-list-field'>";
        LibRenderString += "<label class='lib-list-label'>"+LibTemplateMetadataAuthor+"</label>";
        LibRenderString += "<div class='lib-list-input-container'>";
        LibRenderString += "<input id='LibAutorInput"+objbtn.dataset.libepubid+"' type='text' value='"+LibMetadata[1]+"'>";
        LibRenderString += "</div>";
        LibRenderString += "</div>";
        
        // Language field
        LibRenderString += "<div class='lib-list-field'>";
        LibRenderString += "<label class='lib-list-label'>"+LibTemplateMetadataLanguage+"</label>";
        LibRenderString += "<div class='lib-list-input-container'>";
        LibRenderString += "<input id='LibLanguageInput"+objbtn.dataset.libepubid+"' type='text' value='"+LibMetadata[2]+"'>";
        LibRenderString += "</div>";
        LibRenderString += "</div>";
        
        // Subject field
        LibRenderString += "<div class='lib-list-field'>";
        LibRenderString += "<label class='lib-list-label'>"+LibTemplateMetadataSubject+"</label>";
        LibRenderString += "<div class='lib-list-input-container'>";
        LibRenderString += "<textarea rows='2' id='LibSubjectInput"+objbtn.dataset.libepubid+"' name='subjectInput'>"+LibMetadata[3]+"</textarea>";
        LibRenderString += "</div>";
        LibRenderString += "</div>";
        
        // Description field
        LibRenderString += "<div class='lib-list-field lib-description-field'>";
        LibRenderString += "<label class='lib-list-label'>"+LibTemplateMetadataDescription+"</label>";
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
        document.getElementById("LibAutorInput"+objbtn.dataset.libepubid).addEventListener("change", function() {LibraryUI.LibAutoSaveMetadata(this);});
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
        let bookId = inputElement.id.replace(/^Lib\w+Input/, '');
        await LibraryStorage.LibSaveMetadataChange({dataset: {libepubid: bookId}});
        
        // Update the title display if the title was changed
        if (inputElement.id.includes('TitleInput')) {
            let titleDisplay = document.getElementById("LibTitleDisplay" + bookId);
            if (titleDisplay) {
                titleDisplay.textContent = inputElement.value || "Untitled";
            }
        }
    }

    /**
     * Close metadata editing interface and save changes
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
        
        LibraryUI.LibRenderSavedEpubs();
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
    static async LibLoadBook(objbtn) {
        let bookId = objbtn.dataset.libepubid;
        try {
            await LibraryBookData.loadLibraryBookInMainUI(bookId);
        } catch (error) {
            console.error("Error in LibLoadBook:", error);
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

        // Get template strings
        let LibTemplateDownload = document.getElementById("LibTemplateDownload").innerHTML;
        let LibTemplateUpdateNewChapter = document.getElementById("LibTemplateUpdateNewChapter").innerHTML;
        let LibTemplateSelectBook = "Select Book";

        // Create the menu
        let menu = document.createElement("div");
        menu.className = "compact-more-actions-menu lib-more-actions-menu show";
        menu.innerHTML = `
            <div class="menu-item" data-action="select" data-libepubid="${bookId}">
                <span class="compact-menu-icon" data-icon="select"></span>
                <span>${LibTemplateSelectBook}</span>
            </div>
            <div class="menu-item" data-action="update" data-libepubid="${bookId}">
                <span class="compact-menu-icon" data-icon="update"></span>
                <span>${LibTemplateUpdateNewChapter}</span>
            </div>
            <div class="menu-item" data-action="download" data-libepubid="${bookId}">
                <span class="compact-menu-icon" data-icon="download"></span>
                <span>${LibTemplateDownload}</span>
            </div>
            <div class="menu-item" data-action="open-url" data-libepubid="${bookId}">
                <span class="compact-menu-icon" data-icon="open-url"></span>
                <span>Open Story URL</span>
            </div>
            <div class="menu-item" data-action="delete" data-libepubid="${bookId}">
                <span class="compact-menu-icon" data-icon="delete"></span>
                <span>Delete EPUB</span>
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
                        LibraryUI.LibLoadBook({dataset: {libepubid}});
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
    static Libexportall() {
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
        let LibTemplateWarningURLChange = document.getElementById("LibTemplateWarningURLChange").innerHTML;
        let LibWarningElement = document.getElementById("LibURLWarning"+obj.dataset.libepubid);
        let LibWarningField = document.getElementById("LibURLWarningField"+obj.dataset.libepubid);
        
        LibWarningElement.textContent = LibTemplateWarningURLChange;
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
     * Show library book indicator banner when a library book is automatically detected
     * Note: This should be called AFTER the library book data has been loaded into the UI
     */
    static async LibShowBookIndicator(bookId) {
        try {
            // First try to get the actual book title from the EPUB metadata
            let bookTitle = null;
            try {
                let metadata = await LibraryStorage.LibGetMetadata(bookId);
                if (metadata && metadata[0]) {
                    bookTitle = metadata[0]; // metadata[0] is the title
                }
            } catch (error) {
                console.warn("Could not get metadata for book", bookId, error);
            }
            
            // Fallback to titleInput field if metadata fetch failed
            if (!bookTitle) {
                bookTitle = main.getValueFromUiField("titleInput");
            }
            
            // Final fallback to filename if both above methods failed
            if (!bookTitle) {
                bookTitle = await LibraryStorage.LibGetFromStorage("LibFilename" + bookId);
                // Clean up the title by removing .epub extension if present
                if (bookTitle && bookTitle.endsWith(".epub")) {
                    bookTitle = bookTitle.replace(/\.epub$/, "");
                }
            }
            
            // Show the banner
            let indicator = document.getElementById("libraryBookIndicator");
            indicator.hidden = false;
            
            // Store current library book for reference
            window.currentLibraryBook = { id: bookId, title: bookTitle };
            
            // Update library button text
            if (typeof main !== 'undefined' && main.updateLibraryButtonText) {
                main.updateLibraryButtonText();
            }
            
        } catch (error) {
            console.error("Error showing library book indicator:", error);
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
        
        // Update library button text
        if (typeof main !== 'undefined' && main.updateLibraryButtonText) {
            main.updateLibraryButtonText();
        }
        
        // Set a flag to bypass library detection on next load
        window.bypassLibraryDetection = true;
        
        // Get current URL and reload as website
        let currentUrl = main.getValueFromUiField("startingUrlInput");
        if (currentUrl) {
            // Clear UI and load as normal website
            main.resetUI();
            main.setUiFieldToValue("startingUrlInput", currentUrl);
            main.onLoadAndAnalyseButtonClick();
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
        LibraryUI.LibRenderSavedEpubs();
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
            deleteAllBtn.addEventListener("click", LibraryUI.Libdeleteall);
            deleteAllBtn.dataset.hasListener = "true";
        }
        
        let exportAllBtn = document.getElementById("libexportallModal");
        if (exportAllBtn && !exportAllBtn.dataset.hasListener) {
            exportAllBtn.addEventListener("click", LibraryUI.Libexportall);
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
            importFile.addEventListener("change", function() {LibraryStorage.LibHandelImport(this);});
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
            uploadFile.addEventListener("change", function() {LibraryStorage.LibHandelUpdate(this, -1, "", "", -1);});
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
}