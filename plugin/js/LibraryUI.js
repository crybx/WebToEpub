/*
  LibraryUI class - handles all UI rendering, user interactions, and display logic
*/
"use strict";

class LibraryUI {
    
    /**
     * Render all saved EPUBs in the library UI
     */
    static async LibRenderSavedEpubs() {
        let LibArray = await LibraryStorage.LibGetStorageIDs();
        let ShowAdvancedOptions = document.getElementById("LibShowAdvancedOptionsCheckbox").checked;
        let ShowCompactView = document.getElementById("LibShowCompactViewCheckbox").checked;
        let CurrentLibKeys = LibArray;
        let LibRenderResult = document.getElementById("LibRenderResult");
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

        LibRenderString += "<div class='LibDivRenderWraper'>";
        document.getElementById("LibShowCompactViewRow").hidden = !ShowAdvancedOptions;
        document.getElementById("LibDownloadEpubAfterUpdateRow").hidden = !ShowAdvancedOptions;
        if (ShowAdvancedOptions) {
            if (!util.isFirefox()) {
                let LibTemplateLibraryUses = document.getElementById("LibTemplateLibraryUses").innerHTML;
                LibRenderString += "<span>" + LibTemplateLibraryUses + "</span>";
                LibRenderString += "<span id='LibLibraryUses'></span>";
                LibRenderString += "<br>";
            }
            LibTemplateMergeUploadButton = document.getElementById("LibTemplateMergeUploadButton").innerHTML;
            LibTemplateEditMetadataButton = document.getElementById("LibTemplateEditMetadataButton").innerHTML;
            LibRenderString += "<button id='libdeleteall'>"+document.getElementById("LibTemplateClearLibrary").innerHTML+"</button>";
            LibRenderString += "<button id='libexportall'>"+document.getElementById("LibTemplateExportLibrary").innerHTML+"</button>";
            LibRenderString += "<label data-libbuttonid='LibImportLibraryButton' data-libepubid='' id='LibImportLibraryLabel' for='LibImportLibraryFile' class='file-upload-label'>";
            LibRenderString += "<button id='LibImportLibraryButton' class='disabled-button'>"+document.getElementById("LibTemplateImportEpubButton").innerHTML+"</button></label>";
            LibRenderString += "<input type='file' data-libepubid='LibImportLibrary' id='LibImportLibraryFile' hidden>";
            LibRenderString += "<br>";
            LibRenderString += "<p>"+document.getElementById("LibTemplateUploadEpubFileLabel").innerHTML+"</p>";
            LibRenderString += "<label data-libbuttonid='LibUploadEpubButton' data-libepubid='' id='LibUploadEpubLabel' for='LibEpubNewUploadFile' class='file-upload-label'>";
            LibRenderString += "<button id='LibUploadEpubButton' class='disabled-button'>"+document.getElementById("LibTemplateUploadEpubButton").innerHTML+"</button></label>";
            LibRenderString += "<input type='file' data-libepubid='LibEpubNew' id='LibEpubNewUploadFile' hidden>";
            LibRenderString += "<br>";
            LibRenderString += "<textarea id='LibAddListToLibraryInput' type='text'>Add one novel per line</textarea>";
            LibRenderString += "<br>";
            LibRenderString += "<button id='LibAddListToLibraryButton'>"+document.getElementById("LibTemplateAddListToLibrary").innerHTML+"</button>";
            
        }
        LibRenderString += "<div class='center-flex'>";
        LibRenderString += "<button id='libupdateall'>"+document.getElementById("LibTemplateUpdateAll").innerHTML+"</button>";
        LibRenderString += "</div>";
        if (ShowCompactView) {
            LibRenderString += "<table>";
            LibRenderString += "<tbody>";
            let column = 5;
            for (let i = 0; i < CurrentLibKeys.length; i = i + column) {
                LibRenderString += "<tr>";
                for (let j = i; j < CurrentLibKeys.length && j < column + i; j++) {
                    LibRenderString += "<td class='chapter-indicator-cell'>";
                    LibRenderString += "<div class='center-flex'>";
                    LibRenderString += "<span class='new-chapter-badge new-chapter-compact' id='LibNewChapterCount"+CurrentLibKeys[j]+"'></span>";
                    LibRenderString += "</div>";
                    LibRenderString += "</td>";
                }
                LibRenderString += "</tr>";
                LibRenderString += "<tr>";
                for (let j = i; j < CurrentLibKeys.length && j < column + i; j++) {
                    LibRenderString += "<td>";
                    LibRenderString += "<img data-libepubid="+CurrentLibKeys[j]+" style='max-height: "+(772/column)+"px; max-width: "+(603/column)+"px;' class='LibCoverCompact cover-compact-clickable' id='LibCover"+CurrentLibKeys[j]+"'>";
                    LibRenderString += "</td>";
                }
                LibRenderString += "</tr>";
            }
            LibRenderString += "</tbody>";
            LibRenderString += "</table>";
            LibRenderString += "</div>";
            LibraryUI.AppendHtmlInDiv(LibRenderString, LibRenderResult, "LibDivRenderWraper");
            document.getElementById("libupdateall").addEventListener("click", function() {LibraryUI.Libupdateall();});
            for (let i = 0; i < CurrentLibKeys.length; i++) {
                document.getElementById("LibCover"+CurrentLibKeys[i]).addEventListener("click", function() {LibraryUI.LibLoadBook(this);});
            }
            for (let i = 0; i < CurrentLibKeys.length; i++) {
                document.getElementById("LibCover"+CurrentLibKeys[i]).src = await LibraryStorage.LibGetFromStorage("LibCover" + CurrentLibKeys[i]);
                let newChapterHTML = (((await LibraryStorage.LibGetFromStorage("LibNewChapterCount"+CurrentLibKeys[i]) || 0) == 0)? "" : await LibraryStorage.LibGetFromStorage("LibNewChapterCount"+CurrentLibKeys[i]) + LibTemplateNewChapter);
                newChapterHTML = "<span class=\"newChapterWraper\">"+newChapterHTML+"</span>";
                LibraryUI.AppendHtmlInDiv(newChapterHTML, document.getElementById("LibNewChapterCount"+CurrentLibKeys[i]), "newChapterWraper");
            }
        } else {
            for (let i = 0; i < CurrentLibKeys.length; i++) {
                LibRenderString += "<br>";
                LibRenderString += "<table>";
                LibRenderString += "<tbody>";
                LibRenderString += "<tr>";
                LibRenderString += "<td class='cover-image-cell' rowspan='4'>   <img class='LibCover' id='LibCover"+CurrentLibKeys[i]+"'></td>";
                LibRenderString += "<td colspan='2'>";
                if (ShowAdvancedOptions) {
                    LibRenderString += "<button data-libepubid="+CurrentLibKeys[i]+" id='LibChangeOrderUp"+CurrentLibKeys[i]+"'>↑</button>";
                    LibRenderString += "<button data-libepubid="+CurrentLibKeys[i]+" id='LibChangeOrderDown"+CurrentLibKeys[i]+"'>↓</button>";
                }
                LibRenderString += "<button data-libepubid="+CurrentLibKeys[i]+" id='LibDeleteEpub"+CurrentLibKeys[i]+"'>"+LibTemplateDeleteEpub+"</button>";
                LibRenderString += "<button data-libepubid="+CurrentLibKeys[i]+" id='LibUpdateNewChapter"+CurrentLibKeys[i]+"'>"+LibTemplateUpdateNewChapter+"</button>";
                LibRenderString += "<button data-libepubid="+CurrentLibKeys[i]+" id='LibDownload"+CurrentLibKeys[i]+"'>"+LibTemplateDownload+"</button>";
                LibRenderString += "<button data-libepubid="+CurrentLibKeys[i]+" id='LibLoadBook"+CurrentLibKeys[i]+"'>Load Book</button>";
                LibRenderString += "<span class='new-chapter-badge new-chapter-normal' id='LibNewChapterCount"+CurrentLibKeys[i]+"'></span>";
                if (ShowAdvancedOptions) {
                    LibRenderString += "</td>";
                    LibRenderString += "</tr>";
                    LibRenderString += "<tr>";
                    LibRenderString += "<td colspan='2'>";
                    LibRenderString += "<label id='LibMergeUploadLabel"+CurrentLibKeys[i]+"' data-libbuttonid='LibMergeUploadButton' data-libepubid="+CurrentLibKeys[i]+" for='LibMergeUpload"+CurrentLibKeys[i]+"' class='file-upload-label'>";
                    LibRenderString += "<button id='LibMergeUploadButton"+CurrentLibKeys[i]+"' class='disabled-button'>"+LibTemplateMergeUploadButton+"</button></label>";
                    LibRenderString += "<input type='file' data-libepubid="+CurrentLibKeys[i]+" id='LibMergeUpload"+CurrentLibKeys[i]+"' hidden>";
                    LibRenderString += "<button data-libepubid="+CurrentLibKeys[i]+" id='LibEditMetadata"+CurrentLibKeys[i]+"'>"+LibTemplateEditMetadataButton+"</button>";
                }
                LibRenderString += "</td>";
                LibRenderString += "</tr>";
                LibRenderString += "<tr>";
                LibRenderString += "<td>"+LibTemplateURL+"</td>";
                LibRenderString += "<td class='library-url-table'>";
                LibRenderString += "<table class='no-border-spacing'>";
                LibRenderString += "<tbody id='LibURLWarning"+CurrentLibKeys[i]+"'>";
                LibRenderString += "<tr><td></td></tr>";
                LibRenderString += "</tbody>";
                LibRenderString += "<tbody>";
                LibRenderString += "<tr><td class='library-url-input-cell'>";
                LibRenderString += "<input data-libepubid="+CurrentLibKeys[i]+" id='LibStoryURL"+CurrentLibKeys[i]+"' type='url' value=''>";
                LibRenderString += "</td></tr>";
                LibRenderString += "</tbody>";
                LibRenderString += "</table>";
                LibRenderString += "</td>";
                LibRenderString += "</tr>";
                LibRenderString += "<tr>";
                LibRenderString += "<td>"+LibTemplateFilename+"</td>";
                LibRenderString += "<td><input id='LibFilename"+CurrentLibKeys[i]+"' type='text' value=''></td>";
                LibRenderString += "</tr>";
                LibRenderString += "</tbody>";
                LibRenderString += "</table>";
                if (ShowAdvancedOptions) {
                    LibRenderString += "<div id='LibRenderMetadata"+CurrentLibKeys[i]+"'></div>";
                }
            }
            LibRenderString += "</div>";
            LibraryUI.AppendHtmlInDiv(LibRenderString, LibRenderResult, "LibDivRenderWraper");
            document.getElementById("libupdateall").addEventListener("click", function() {LibraryUI.Libupdateall();});
            if (ShowAdvancedOptions) {
                document.getElementById("libdeleteall").addEventListener("click", function() {LibraryUI.Libdeleteall();});
                document.getElementById("libexportall").addEventListener("click", function() {LibraryUI.Libexportall();});
                document.getElementById("LibImportLibraryLabel").addEventListener("mouseover", function() {LibraryUI.LibMouseoverButtonUpload(this);});
                document.getElementById("LibImportLibraryLabel").addEventListener("mouseout", function() {LibraryUI.LibMouseoutButtonUpload(this);});
                document.getElementById("LibImportLibraryFile").addEventListener("change", function() {LibraryStorage.LibHandelImport(this);});
                document.getElementById("LibUploadEpubLabel").addEventListener("mouseover", function() {LibraryUI.LibMouseoverButtonUpload(this);});
                document.getElementById("LibUploadEpubLabel").addEventListener("mouseout", function() {LibraryUI.LibMouseoutButtonUpload(this);});
                document.getElementById("LibEpubNewUploadFile").addEventListener("change", function() {LibraryStorage.LibHandelUpdate(this, -1, "", "", -1);});
                document.getElementById("LibAddListToLibraryButton").addEventListener("click", function() {LibraryUI.LibAddListToLibrary();});
            }
            for (let i = 0; i < CurrentLibKeys.length; i++) {
                document.getElementById("LibDeleteEpub"+CurrentLibKeys[i]).addEventListener("click", function() {LibraryUI.LibDeleteEpub(this);});
                document.getElementById("LibUpdateNewChapter"+CurrentLibKeys[i]).addEventListener("click", function() {LibraryUI.LibUpdateNewChapter(this);});
                document.getElementById("LibDownload"+CurrentLibKeys[i]).addEventListener("click", function() {LibraryUI.LibDownload(this);});
                document.getElementById("LibLoadBook"+CurrentLibKeys[i]).addEventListener("click", function() {LibraryUI.LibLoadBook(this);});
                document.getElementById("LibStoryURL"+CurrentLibKeys[i]).addEventListener("change", function() {LibraryUI.LibSaveTextURLChange(this);});
                document.getElementById("LibStoryURL"+CurrentLibKeys[i]).addEventListener("focusin", function() {LibraryUI.LibShowTextURLWarning(this);});
                document.getElementById("LibStoryURL"+CurrentLibKeys[i]).addEventListener("focusout", function() {LibraryUI.LibHideTextURLWarning(this);});
                document.getElementById("LibFilename"+CurrentLibKeys[i]).addEventListener("change", function() {LibraryUI.LibSaveTextURLChange(this);});
                if (ShowAdvancedOptions) {
                    document.getElementById("LibChangeOrderUp"+CurrentLibKeys[i]).addEventListener("click", function() {LibraryUI.LibChangeOrderUp(this);});
                    document.getElementById("LibChangeOrderDown"+CurrentLibKeys[i]).addEventListener("click", function() {LibraryUI.LibChangeOrderDown(this);});
                    document.getElementById("LibMergeUpload"+CurrentLibKeys[i]).addEventListener("change", function() {LibraryUI.LibMergeUpload(this);});
                    document.getElementById("LibMergeUploadLabel"+CurrentLibKeys[i]).addEventListener("mouseover", function() {LibraryUI.LibMouseoverButtonUpload(this);});
                    document.getElementById("LibMergeUploadLabel"+CurrentLibKeys[i]).addEventListener("mouseout", function() {LibraryUI.LibMouseoutButtonUpload(this);});
                    document.getElementById("LibEditMetadata"+CurrentLibKeys[i]).addEventListener("click", function() {LibraryUI.LibEditMetadata(this);});
                }
            }
            for (let i = 0; i < CurrentLibKeys.length; i++) {
                document.getElementById("LibCover"+CurrentLibKeys[i]).src = await LibraryStorage.LibGetFromStorage("LibCover" + CurrentLibKeys[i]);                
                let newChapterHTML = (((await LibraryStorage.LibGetFromStorage("LibNewChapterCount"+CurrentLibKeys[i]) || 0) == 0)? "" : await LibraryStorage.LibGetFromStorage("LibNewChapterCount"+CurrentLibKeys[i]) + LibTemplateNewChapter);
                newChapterHTML = "<span class=\"newChapterWraper\">"+newChapterHTML+"</span>";
                LibraryUI.AppendHtmlInDiv(newChapterHTML, document.getElementById("LibNewChapterCount"+CurrentLibKeys[i]), "newChapterWraper");
                let storyUrl = await LibraryStorage.LibGetFromStorage("LibStoryURL"+CurrentLibKeys[i]);
                let filename = await LibraryStorage.LibGetFromStorage("LibFilename"+CurrentLibKeys[i]);
                if (storyUrl) document.getElementById("LibStoryURL"+CurrentLibKeys[i]).value = storyUrl;
                if (filename) document.getElementById("LibFilename"+CurrentLibKeys[i]).value = filename;
            }
            if (ShowAdvancedOptions) {
                if (!util.isFirefox()) {
                    let LibraryUsesHTML = await LibraryUI.LibBytesInUse();
                    LibraryUsesHTML = "<span class=\"LibraryUsesWraper\">"+LibraryUsesHTML+"</span>";
                    LibraryUI.AppendHtmlInDiv(LibraryUsesHTML, document.getElementById("LibLibraryUses"), "LibraryUsesWraper");
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
        LibRenderString += "<div class='LibDivRenderWraper'>";
        LibRenderString += "<div class='warning'>";
        LibRenderString += document.getElementById("LibTemplateWarningInProgress").innerHTML;
        LibRenderString += "</div>";
        LibRenderString += "</div>";
        LibraryUI.AppendHtmlInDiv(LibRenderString, LibRenderResult, "LibDivRenderWraper");
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
        for (let i = 0; i < LibArray.length; i++) {
            if (LibArray[i] == libepubid) {
                if (i+change < 0 || i+change >= LibArray.length) {
                    return;
                }
                let temp1 = LibArray[i];
                LibArray[i] = LibArray[i+change];
                LibArray[i+change] = temp1;
                break;
            }
        }
        chrome.storage.local.set({
            ["LibArray"]: LibArray
        });
        LibraryUI.LibRenderSavedEpubs();
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
        LibRenderString += "<div class='LibDivRenderWraper'>";
        LibRenderString += "<table>";
        LibRenderString += "<tbody>";
        LibRenderString += "<tr id='LibRenderMetadataSave"+objbtn.dataset.libepubid+"'>";
        LibRenderString += "<td></td>";
        LibRenderString += "<td></td>";
        LibRenderString += "<td>";
        LibRenderString += "<button data-libepubid="+objbtn.dataset.libepubid+" id='LibMetadataSave"+objbtn.dataset.libepubid+"'>"+LibTemplateMetadataSave+"</button>";
        LibRenderString += "</td>";
        LibRenderString += "</tr>";
        LibRenderString += "<tr id='LibRenderMetadataTitle"+objbtn.dataset.libepubid+"'>";
        LibRenderString += "<td>"+LibTemplateMetadataTitle+"</td>";
        LibRenderString += "<td colspan='2'><input id='LibTitleInput"+objbtn.dataset.libepubid+"' type='text' value='"+LibMetadata[0]+"'></input></td>";
        LibRenderString += "</tr>";
        LibRenderString += "</tr>";
        LibRenderString += "<tr id='LibTemplateMetadataAuthor"+objbtn.dataset.libepubid+"'>";
        LibRenderString += "<td>"+LibTemplateMetadataAuthor+"</td>";
        LibRenderString += "<td colspan='2'><input id='LibAutorInput"+objbtn.dataset.libepubid+"' type='text' value='"+LibMetadata[1]+"'></input></td>";
        LibRenderString += "</tr>";
        LibRenderString += "<tr id='LibTemplateMetadataLanguage"+objbtn.dataset.libepubid+"'>";
        LibRenderString += "<td>"+LibTemplateMetadataLanguage+"</td>";
        LibRenderString += "<td colspan='2'><input id='LibLanguageInput"+objbtn.dataset.libepubid+"' type='text' value='"+LibMetadata[2]+"'></input></td>";
        LibRenderString += "</tr>";
        LibRenderString += "<tr id='LibRenderMetadataSubject"+objbtn.dataset.libepubid+"'>";
        LibRenderString += "<td>"+LibTemplateMetadataSubject+"</td>";
        LibRenderString += "<td colspan='2'><textarea rows='2' cols='60' id='LibSubjectInput"+objbtn.dataset.libepubid+"' type='text' name='subjectInput'>"+LibMetadata[3]+"</textarea></td>";
        LibRenderString += "</tr>";
        LibRenderString += "<tr id='LibRenderMetadataDescription" + objbtn.dataset.libepubid + "'>";
        LibRenderString += "<td>"+LibTemplateMetadataDescription+"</td>";
        LibRenderString += "<td colspan='2'><textarea  rows='2' cols='60' id='LibDescriptionInput"+objbtn.dataset.libepubid+"' type='text' name='descriptionInput'>"+LibMetadata[4]+"</textarea></td>";
        LibRenderString += "</tr>";
        LibRenderString += "</tbody>";
        LibRenderString += "</table>";
        LibRenderString += "</div>";
        LibraryUI.AppendHtmlInDiv(LibRenderString, LibRenderResult, "LibDivRenderWraper");
        document.getElementById("LibMetadataSave"+objbtn.dataset.libepubid).addEventListener("click", function() {LibraryStorage.LibSaveMetadataChange(this);});
    }

    /**
     * Delete an EPUB from library
     */
    static async LibDeleteEpub(objbtn) {
        await LibraryStorage.LibRemoveStorageIDs(objbtn.dataset.libepubid);
        let LibRemove = ["LibEpub" + objbtn.dataset.libepubid, "LibStoryURL" + objbtn.dataset.libepubid, "LibFilename" + objbtn.dataset.libepubid, "LibCover" + objbtn.dataset.libepubid, "LibNewChapterCount" + objbtn.dataset.libepubid];
        UserPreferences.readFromLocalStorage().readingList.tryDeleteEpubAndSave(document.getElementById("LibStoryURL" + objbtn.dataset.libepubid).value);
        chrome.storage.local.remove(LibRemove);
        LibraryUI.LibRenderSavedEpubs();
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
            document.getElementById("LibNewChapterCount"+objbtn.dataset.libepubid).innerHTML = "";
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
        if (document.getElementById("LibDownloadEpubAfterUpdateCheckbox").checked == true) {
            document.getElementById("LibDownloadEpubAfterUpdateCheckbox").click();
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
        if (document.getElementById("LibDownloadEpubAfterUpdateCheckbox").checked == true) {
            document.getElementById("LibDownloadEpubAfterUpdateCheckbox").click();
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
        LibWarningElement.innerHTML = "<tr><td class='warning-text'></td></tr>";
        LibWarningElement.firstChild.firstChild.textContent = LibTemplateWarningURLChange;
    }

    /**
     * Hide URL change warning
     */
    static LibHideTextURLWarning(obj) {
        document.getElementById("LibURLWarning"+obj.dataset.libepubid).innerHTML = "<tr><td></td></tr>";
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
            let titleElement = document.getElementById("libraryBookTitle");
            
            // Always update the title text (for when switching between books)
            titleElement.textContent = bookTitle || `Book ${bookId}`;
            indicator.hidden = false;
            
            // Store current library book for reference
            window.currentLibraryBook = { id: bookId, title: bookTitle };
            
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
    }
}