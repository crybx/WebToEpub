/*
    Main processing handler for popup.html

*/
const main = (function() {
    "use strict";

    // this will be called when message listener fires
    function onMessageListener(message, sender, sendResponse) {  // eslint-disable-line no-unused-vars
        if (message.messageType == "ParseResults") {
            chrome.runtime.onMessage.removeListener(onMessageListener);
            util.log("addListener");
            util.log(message);
            // convert the string returned from content script back into a DOM
            let dom = new DOMParser().parseFromString(message.document, "text/html");
            populateControlsWithDom(message.url, dom);
        }
    }

    // details
    let initalWebPage = null;
    let parser = null;
    let userPreferences = null;

    // register listener that is invoked when script injected into HTML sends its results
    function addMessageListener() {
        try {
            // note, this will throw if not running as an extension.
            if (!chrome.runtime.onMessage.hasListener(onMessageListener)) {
                chrome.runtime.onMessage.addListener(onMessageListener);
            }
        } catch (chromeError) {
            util.log(chromeError);
        }
    }

    // extract urls from DOM and populate control
    async function processInitialHtml(url, dom) {
        if (setParser(url, dom)) {
            try {
                userPreferences.addObserver(parser);
            } catch (error) {
                ErrorLog.showErrorMessage(error);
                return;
            }
            try {
                await parser.loadEpubMetaInfo(dom);
                let metaInfo = parser.getEpubMetaInfo(dom, userPreferences.useFullTitle.value);
                populateMetaInfo(metaInfo);
                setUiToDefaultState();
                parser.populateUI(dom);
            } catch (error) {
                ErrorLog.showErrorMessage(error);
            }
            try {
                await parser.onLoadFirstPage(url, dom);
            } catch (error) {
                ErrorLog.showErrorMessage(error);
            }
        }
    }

    function setUiToDefaultState() {
        document.getElementById("highestResolutionImageRow").hidden = true;
        document.getElementById("unSuperScriptAlternateTranslations").hidden = true;
        document.getElementById("imageSection").hidden = true;
        document.getElementById("chapterSelectionOptionsSection").hidden = false;
        document.getElementById("chapterListSection").hidden = false;
        document.getElementById("translatorRow").hidden = true;
        document.getElementById("fileAuthorAsRow").hidden = true;
        document.getElementById("defaultParserSection").hidden = true;
    }

    function populateMetaInfo(metaInfo) {
        setUiFieldToValue("startingUrlInput", metaInfo.uuid);
        setUiFieldToValue("titleInput", metaInfo.title);
        setUiFieldToValue("authorInput", metaInfo.author);
        setUiFieldToValue("languageInput", metaInfo.language);
        setUiFieldToValue("fileNameInput", metaInfo.fileName);
        setUiFieldToValue("subjectInput", metaInfo.subject);
        setUiFieldToValue("descriptionInput", metaInfo.description);
        if (metaInfo.seriesName !== null) {
            document.getElementById("seriesRow").hidden = false;
            document.getElementById("volumeRow").hidden = false;
            setUiFieldToValue("seriesNameInput", metaInfo.seriesName);
            setUiFieldToValue("seriesIndexInput", metaInfo.seriesIndex);
        }

        setUiFieldToValue("translatorInput", metaInfo.translator);
        setUiFieldToValue("fileAuthorAsInput", metaInfo.fileAuthorAs);
    }

    function setUiFieldToValue(elementId, value) {
        let element = document.getElementById(elementId);
        if (util.isTextInputField(element) || util.isTextAreaField(element)) {
            element.value = (value == null) ? "" : value;
        } else {
            throw new Error(UIText.Error.unhandledFieldTypeError);
        }
    }

    function metaInfoFromControls() {
        let metaInfo = new EpubMetaInfo();
        metaInfo.uuid = getValueFromUiField("startingUrlInput");
        metaInfo.title = getValueFromUiField("titleInput");
        metaInfo.author = getValueFromUiField("authorInput");
        metaInfo.language = getValueFromUiField("languageInput");
        metaInfo.fileName = getValueFromUiField("fileNameInput");
        metaInfo.subject = getValueFromUiField("subjectInput");
        metaInfo.description = getValueFromUiField("descriptionInput");

        if (document.getElementById("seriesRow").hidden === false) {
            metaInfo.seriesName = getValueFromUiField("seriesNameInput");
            metaInfo.seriesIndex = getValueFromUiField("seriesIndexInput");
        }

        metaInfo.translator = getValueFromUiField("translatorInput");
        metaInfo.fileAuthorAs = getValueFromUiField("fileAuthorAsInput");
        metaInfo.styleSheet = userPreferences.styleSheet.value;

        return metaInfo;
    }

    function getValueFromUiField(elementId) {
        let element = document.getElementById(elementId);
        if (util.isTextInputField(element) || util.isTextAreaField(element)) {
            return (element.value === "") ? null : element.value;
        } else {
            throw new Error(UIText.Error.unhandledFieldTypeError);
        }
    }

    function setProcessingButtonsState(disabled) {
        window.workInProgress = disabled;
        main.getPackEpubButton().disabled = disabled;
        document.getElementById("downloadChaptersButton").disabled = disabled;
        document.getElementById("LibAddToLibrary").disabled = disabled;
        
        // Enable/disable stop button based on processing state
        let stopBtn = document.getElementById("stopDownloadButton");
        if (stopBtn) {
            stopBtn.disabled = !disabled;
            // Reset button text when processing completes
            if (!disabled) {
                stopBtn.textContent = UIText.Common.stopDownload;
            }
        }

        window.workInProgress = disabled;
    }

    function setMetadataButtonsState(disabled) {
        main.getPackEpubButton().disabled = disabled;
        document.getElementById("LibAddToLibrary").disabled = disabled;
    }

    function syncCheckboxStatesToParser() {
        if (!parser || !parser.state || !parser.state.webPages) {
            return;
        }

        // Get all checkbox elements from the UI
        let checkboxes = document.querySelectorAll(".chapterSelectCheckbox");
        let chapters = [...parser.state.webPages.values()];
        
        // Sync checkbox states to corresponding chapters in parser state
        checkboxes.forEach((checkbox, index) => {
            if (index < chapters.length) {
                chapters[index].isIncludeable = checkbox.checked;
            }
        });
    }

    async function fetchContentAndPackEpub() {
        let libclick = this;
        if (document.getElementById("noAdditionalMetadataCheckbox")?.checked) {
            setUiFieldToValue("subjectInput", "");
            setUiFieldToValue("descriptionInput", "");
        }
        let metaInfo = metaInfoFromControls();

        if (libclick.dataset.libclick === "yes") {
            if (document.getElementById("chaptersPageInChapterListCheckbox")?.checked) {
                ErrorLog.showErrorMessage(UIText.Error.errorAddToLibraryLibraryAddPageWithChapters);
                return;
            }
        }

        ChapterUrlsUI.limitNumOfChapterS(userPreferences.maxChaptersPerEpub.value);
        await ChapterUrlsUI.resetChapterStatusIcons();
        ErrorLog.clearHistory();
        setProcessingButtonsState(true);
        parser.onStartCollecting();
        
        // Sync current checkbox states from UI back to parser state before EPUB generation
        syncCheckboxStatesToParser();
        
        await parser.fetchContent().then(async function() {
            return await packEpub(metaInfo);
        }).then(function(content) {
            // Enable button here.  If user cancels save dialog
            // the promise never returns
            setProcessingButtonsState(false);
            let overwriteExisting = userPreferences.overwriteExistingEpub.value;
            let backgroundDownload = userPreferences.noDownloadPopup.value;
            let fileName = Download.CustomFilename();
            if (libclick.dataset.libclick === "yes") {
                return LibraryStorage.LibAddToLibrary(content, fileName, document.getElementById("startingUrlInput").value, overwriteExisting, backgroundDownload, userPreferences);
            }
            return Download.save(content, fileName, overwriteExisting, backgroundDownload);
        }).then(function() {
            // Update Reading List if user has manually checked the checkbox
            if (document.getElementById("includeInReadingListCheckbox")?.checked) {
                parser.updateReadingList();
            }
            if (util.sleepController.signal.aborted) {
                util.sleepController = new AbortController;
                // Don't reset UI completely - just update button states
                setProcessingButtonsState(false);
            }
            if (libclick.dataset.libsuppressErrorLog == true) {
                return;
            } else {
                ErrorLog.showLogToUser();
                dumpErrorLogToFile();
            }
        }).catch(function(err) {
            setProcessingButtonsState(false);
            if (util.sleepController.signal.aborted) {
                util.sleepController = new AbortController;
                // Operation was cancelled, don't show error
                return;
            }
            ErrorLog.showErrorMessage(err);
        });
    }

    async function downloadChapters() {
        ChapterUrlsUI.limitNumOfChapterS(userPreferences.maxChaptersPerEpub.value);
        await ChapterUrlsUI.resetChapterStatusIcons();
        ErrorLog.clearHistory();
        setProcessingButtonsState(true);
        parser.onStartCollecting();

        // Sync current checkbox states from UI back to parser state before download
        syncCheckboxStatesToParser();
        
        // Check if any chapters are selected after syncing
        let selectedCount = [...parser.state.webPages.values()].filter(chapter => chapter.isIncludeable).length;
        if (selectedCount === 0) {
            alert("No chapters selected for download.");
            setProcessingButtonsState(false);
            return;
        }

        // Check if we're in Library Mode with a library book loaded
        let isInLibraryMode = window.currentLibraryBook && window.currentLibraryBook.id;
        
        if (isInLibraryMode) {
            // In Library Mode: use the same logic as "Update Library Book"
            // This will download chapters and add them to the existing EPUB via merge logic
            let obj = {};
            obj.dataset = {};
            obj.dataset.libclick = "yes";  // Mark as library operation
            
            try {
                await fetchContentAndPackEpub.call(obj);
            } catch (err) {
                setProcessingButtonsState(false);
                if (!util.sleepController.signal.aborted) {
                    ErrorLog.showErrorMessage(err);
                }
                util.sleepController = new AbortController();
            }
        } else {
            // Normal Mode: download chapters to cache
            await ChapterCache.downloadChaptersToCache().then(function() {
                setProcessingButtonsState(false);
                if (util.sleepController.signal.aborted) {
                    util.sleepController = new AbortController;
                    return;
                }
                parser.updateReadingList();
                ErrorLog.showLogToUser();
                dumpErrorLogToFile();
            }).catch(function(err) {
                setProcessingButtonsState(false);
                if (util.sleepController.signal.aborted) {
                    util.sleepController = new AbortController;
                    return;
                }
                ErrorLog.showErrorMessage(err);
            });
        }
    }

    function stopDownload() {
        // Immediately update button to show stopping state
        let stopBtn = document.getElementById("stopDownloadButton");
        if (stopBtn) {
            stopBtn.disabled = true;
            stopBtn.textContent = "Stopping...";
        }
        
        util.sleepController.abort();
    }

    function epubVersionFromPreferences() {
        return userPreferences.createEpub3.value ?
            EpubPacker.EPUB_VERSION_3 : EpubPacker.EPUB_VERSION_2;
    }

    async function packEpub(metaInfo) {
        let epubVersion = epubVersionFromPreferences();
        let epubPacker = new EpubPacker(metaInfo, epubVersion);
        return epubPacker.assemble(await parser.epubItemSupplier());
    }

    function dumpErrorLogToFile() {
        let errors = ErrorLog.dumpHistory();
        if (userPreferences.writeErrorHistoryToFile.value &&
            !util.isNullOrEmpty(errors)) {
            let fileName = metaInfoFromControls().fileName + ".ErrorLog.txt";
            let blob = new Blob([errors], {type: "text"});
            return Download.save(blob, fileName)
                .catch(err => ErrorLog.showErrorMessage(err));
        }
    }

    function getActiveTabDOM(tabId) {
        addMessageListener();
        injectContentScript(tabId);
    }

    function injectContentScript(tabId) {
        if (util.isFirefox()) {
            Firefox.injectContentScript(tabId);
        } else {
            chromeInjectContentScript(tabId);
        }
    }

    function chromeInjectContentScript(tabId) {
        try {
            chrome.scripting.executeScript({
                target: {tabId: tabId},
                files: ["js/ContentScript.js"]
            });
        } catch {
            if (chrome.runtime.lastError) {
                util.log(chrome.runtime.lastError.message);
            }
        }
    }

    function populateControls() {
        loadUserPreferences();
        parserFactory.populateManualParserSelectionTag(getManuallySelectParserTag());
        configureForTabMode();
    }

    function loadUserPreferences() {
        userPreferences = UserPreferences.readFromLocalStorage();
        userPreferences.writeToUi();
        userPreferences.hookupUi();
        BakaTsukiSeriesPageParser.registerBakaParsers(userPreferences.autoSelectBTSeriesPage.value);
    }

    function isRunningInTabMode() {
        // if query string supplied, we're running in Tab mode.
        let search = window.location.search;
        return !util.isNullOrEmpty(search);
    }

    // Detect if URL matches any library book
    async function detectLibraryBook(url) {
        try {
            // Get all book IDs efficiently
            let bookIds = await LibraryStorage.LibGetStorageIDs();
            if (!bookIds || bookIds.length === 0) {
                return null;
            }

            // Build array of URL keys
            let urlKeys = bookIds.map(id => `LibStoryURL${id}`);

            // Get all URLs in one storage call
            let urlData = await LibraryStorage.LibGetFromStorageArray(urlKeys);

            // Check for matches
            for (let key of urlKeys) {
                if (urlData[key] === url) {
                    let bookId = key.replace("LibStoryURL", "");
                    return bookId;
                }
            }
            return null;
        } catch (error) {
            console.error("Error detecting library book:", error);
            return null;
        }
    }


    async function populateControlsWithDom(url, dom) {
        initalWebPage = dom;
        setUiFieldToValue("startingUrlInput", url);

        // Check for matching library book first (but not if we're already loading/in library mode or bypassing)
        if (!window.currentLibraryBook && !window.isLoadingLibraryBook && !window.bypassLibraryDetection) {
            let libraryBookId = await detectLibraryBook(url);
            if (libraryBookId) {
                // Set flag to prevent re-entry during loading
                window.isLoadingLibraryBook = true;
                try {
                    await LibraryUI.LibShowBookIndicator(libraryBookId);
                    await LibraryUI.loadLibraryBookInMainUI(libraryBookId);
                } finally {
                    // Clear loading flag
                    window.isLoadingLibraryBook = false;
                }
                return;
            }
        }
        
        // Clear bypass flag after processing (one-time use)
        if (window.bypassLibraryDetection) {
            window.bypassLibraryDetection = false;
        }

        // set the base tag, in case server did not supply it
        util.setBaseTag(url, initalWebPage);
        await processInitialHtml(url, initalWebPage);
        if (document.getElementById("autosearchmetadataCheckbox")?.checked) {
            autosearchadditionalmetadata();
        }
    }

    function setParser(url, dom) {
        let manualSelect = getManuallySelectParserTag().value;
        if (util.isNullOrEmpty(manualSelect)) {
            parser = parserFactory.fetch(url, dom);
        } else {
            parser = parserFactory.manuallySelectParser(manualSelect);
        }
        if (parser === undefined) {
            ErrorLog.showErrorMessage(UIText.Error.noParserFound);
            return false;
        }

        // Make parser globally accessible for refresh functionality
        window.parser = parser;
        getLoadAndAnalyseButton().hidden = true;
        let disabledMessage = parser.disabled();
        if (disabledMessage !== null) {
            ErrorLog.showErrorMessage(disabledMessage);
            return false;
        }
        return true;
    }

    // called when the "Diagnostics" check box is ticked or unticked
    function onDiagnosticsClick() {
        let enable = document.getElementById("diagnosticsCheckBoxInput").checked;
        document.getElementById("reloadButton").hidden = !enable;
    }

    function onAdvancedOptionsClick() {
        let section = getAdvancedOptionsSection();
        section.hidden = !section.hidden;
        section = getAdditionalMetadataSection();
        section.hidden = !userPreferences.ShowMoreMetadataOptions.value;
        section = getLibrarySection();
        section.hidden = true;
    }

    function onShowMoreMetadataOptionsClick() {
        let section = getAdditionalMetadataSection();
        section.hidden = !section.hidden;
    }

    function onLibraryClick() {
        let section = getLibrarySection();
        section.hidden = !section.hidden;
        if (!section.hidden) {
            LibraryUI.LibRenderSavedEpubs();
        }
        section = getAdvancedOptionsSection();
        section.hidden = true;
        // Hide cache options modal if it's open
        document.getElementById("cacheOptionsModal").style.display = "none";
        document.body.classList.remove("modal-open");
    }

    async function onCacheOptionsClick() {
        // Show the cache options modal
        let modal = document.getElementById("cacheOptionsModal");
        modal.style.display = "flex";
        document.body.classList.add("modal-open");

        // Set up event handlers first
        ChapterCache.setupCacheEventHandlers();

        // Then refresh cache statistics and update button text
        await ChapterCache.refreshCacheStats();
        ChapterCache.updateCacheButtonText();

        // Set up close button
        document.getElementById("closeCacheOptions").onclick = () => {
            modal.style.display = "none";
            document.body.classList.remove("modal-open");
        };

        // Close on background click
        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.style.display = "none";
                document.body.classList.remove("modal-open");
            }
        };
    }

    function onStylesheetToDefaultClick() {
        document.getElementById("stylesheetInput").value = EpubMetaInfo.getDefaultStyleSheet();
        userPreferences.readFromUi();
    }

    function openTabWindow() {
        // open new tab window, passing ID of open tab with content to convert to epub as query parameter.
        getActiveTab().then(function(tabId) {
            let url = chrome.runtime.getURL("popup.html") + "?id=";
            url += tabId;
            try {
                chrome.tabs.create({ url: url, openerTabId: tabId });
            } catch (err) {
                //firefox android catch
                chrome.tabs.create({ url: url });
            }
            window.close();
        });
    }

    function getActiveTab() {
        return new Promise(function(resolve, reject) {
            chrome.tabs.query({ currentWindow: true, active: true }, function(tabs) {
                if ((tabs != null) && (0 < tabs.length)) {
                    resolve(tabs[0].id);
                } else {
                    reject();
                }
            });
        });
    }

    async function onLoadAndAnalyseButtonClick() {
        // load page via XmlHTTPRequest
        let url = getValueFromUiField("startingUrlInput");
        getLoadAndAnalyseButton().disabled = true;
        return HttpClient.wrapFetch(url).then(async function(xhr) {
            await populateControlsWithDom(url, xhr.responseXML);
            getLoadAndAnalyseButton().disabled = false;
        }).catch(function(error) {
            getLoadAndAnalyseButton().disabled = false;
            ErrorLog.showErrorMessage(error);
        });
    }

    function configureForTabMode() {
        getActiveTabDOM(extractTabIdFromQueryParameter());
    }

    function extractTabIdFromQueryParameter() {
        let windowId = window.location.search.split("=")[1];
        if (!util.isNullOrEmpty(windowId)) {
            return parseInt(windowId, 10);
        }
    }

    function getPackEpubButton() {
        return document.getElementById("packEpubButton");
    }

    function getLoadAndAnalyseButton() {
        return document.getElementById("loadAndAnalyseButton");
    }

    function resetUI() {
        initalWebPage = null;
        parser = null;
        let metaInfo = new EpubMetaInfo();
        metaInfo.uuid = "";
        populateMetaInfo(metaInfo);
        getLoadAndAnalyseButton().hidden = false;
        setProcessingButtonsState(false);
        ChapterUrlsUI.clearChapterUrlsTable();
        CoverImageUI.clearUI();
        ProgressBar.setValue(0);
        // Clear the selected value so it doesn't look like a parser is selected
        document.getElementById("manuallySelectParserTag").selectedIndex = -1;
        // Update library button text in case library mode state has changed
        updateLibraryButtonText();
    }

    function localizeHtmlPage() {
        // can't use a single select, because there are buttons in td elements
        for (let selector of ["button, option", "td, th", ".i18n"]) {
            for (let element of [...document.querySelectorAll(selector)]) {
                if (element.textContent.startsWith("__MSG_")) {
                    UIText.localizeElement(element);
                }
            }
        }
    }

    function setupCustomTooltips() {
        // Set up trash icon tooltip with localized text
        let deleteTooltip = document.getElementById("deleteAllTooltip");
        if (deleteTooltip) {
            deleteTooltip.textContent = UIText.Chapter.tooltipDeleteAllCached;
        }
    }

    function clearCoverUrl() {
        CoverImageUI.setCoverImageUrl(null);
    }

    function getManuallySelectParserTag() {
        return document.getElementById("manuallySelectParserTag");
    }

    function getAdditionalMetadataSection() {
        return document.getElementById("AdditionalMetadatatable");
    }

    function getAdvancedOptionsSection() {
        return document.getElementById("advancedOptionsSection");
    }

    function getLibrarySection() {
        return document.getElementById("libraryExpandableSection");
    }

    function onSeriesPageHelp() {
        chrome.tabs.create({ url: "https://github.com/dteviot/WebToEpub/wiki/FAQ#using-baka-tsuki-series-page-parser" });
    }

    function onCustomFilenameHelp() {
        chrome.tabs.create({ url: "https://github.com/dteviot/WebToEpub/wiki/Advanced-Options#custom-filename" });
    }

    function onDefaultParserHelp() {
        chrome.tabs.create({ url: "https://github.com/dteviot/WebToEpub/wiki/FAQ#how-to-convert-a-new-site-using-the-default-parser" });
    }

    function onReadOptionsFromFile(event) {
        userPreferences.readFromFile(event, populateControls);
    }

    function onReadingListCheckboxClicked() {
        let url = parser.state.chapterListUrl;
        let checked = UserPreferences.getReadingListCheckbox().checked;
        userPreferences.readingList.onReadingListCheckboxClicked(checked, url);
    }

    function sbFiltersShow() {
        sbShow();
        ChapterUrlsUI.Filters.init();
        document.getElementById("sbFilters").hidden = false;

        let filtersForm = document.getElementById("sbFiltersForm");
        util.removeElements(filtersForm.children);
        filtersForm.appendChild(ChapterUrlsUI.Filters.generateFiltersTable());
        ChapterUrlsUI.Filters.Filter(); //Run reset filters to clear confusion.
    }

    function sbFiltersToggle() {
        let sidebar = document.getElementById("sbOptions");
        if (sidebar.classList.contains("sidebarOpen")) {
            sbHide();
        } else {
            sbFiltersShow();
        }
    }

    function updateSidebarButtons() {
        let sidebar = document.getElementById("sbOptions");
        let openSidebarButton = document.getElementById("openSidebarButton");

        if (sidebar.classList.contains("sidebarOpen")) {
            // Sidebar is open - hide the top-right open button (close button is in sidebar)
            openSidebarButton.hidden = true;
        } else {
            // Sidebar is closed - show the top-right open button
            openSidebarButton.hidden = false;
        }
    }

    function sbShow() {
        document.getElementById("sbOptions").classList.add("sidebarOpen");
        updateSidebarButtons();
    }

    function sbHide() {
        document.getElementById("sbOptions").classList.remove("sidebarOpen");
        document.getElementById("sbFilters").hidden = true;
        updateSidebarButtons();
    }

    /**
     * Hide all sections and UI elements, show only the specified ones
     * Returns a function to restore previous visibility state
     */
    function hideAllSectionsExcept(...sectionsToShow) {
        let sections = new Map(
            [...document.querySelectorAll("section")]
                .map(s => [s, s.hidden])
        );
        [...sections.keys()].forEach(s => s.hidden = true);
        
        // Also hide the sidebar toggle button (filter controls don't make sense in special modes)
        let sidebarButton = document.getElementById("openSidebarButton");
        let sidebarButtonWasHidden = sidebarButton ? sidebarButton.hidden : true;
        if (sidebarButton) {
            sidebarButton.hidden = true;
        }
        
        sectionsToShow.forEach(sectionId => {
            document.getElementById(sectionId).hidden = false;
        });
        
        return function restoreSections() {
            [...sections].forEach(s => s[0].hidden = s[1]);
            if (sidebarButton) {
                sidebarButton.hidden = sidebarButtonWasHidden;
            }
        };
    }

    function showReadingList() {
        document.getElementById("closeReadingList").onclick = hideAllSectionsExcept("readingListSection");

        let table = document.getElementById("readingListTable");
        userPreferences.readingList.showReadingList(table);
        table.onclick = (event) => userPreferences.readingList.onClickRemove(event);
    }

    /**
     * If work in progress, give user chance to cancel closing the window
     */
    function onUnloadEvent(event) {
        if (window.workInProgress === true) {
            event.preventDefault();
            event.returnValue = "";
        } else {
            delete event["returnValue"];
        }
    }

    function onCoverImageClick() {
        let coverImg = document.getElementById("sampleCoverImg");
        if (coverImg.src && coverImg.src !== "") {
            let modal = document.getElementById("coverImageModal");
            let fullSizeImg = document.getElementById("fullSizeCoverImg");
            let modalTitle = modal.querySelector(".modal-title");

            // Set loading title first
            modalTitle.textContent = "Cover Image (Loading...)";

            fullSizeImg.src = coverImg.src;
            modal.style.display = "flex";
            document.body.classList.add("modal-open");

            // Update title with dimensions once image loads
            fullSizeImg.onload = function() {
                // Extract file extension from URL
                let url = new URL(this.src);
                let pathname = url.pathname;
                let extension = "unknown";

                // Check if pathname has a dot and extract extension
                if (pathname.includes(".")) {
                    let possibleExt = pathname.split(".").pop().toLowerCase();
                    // Validate it's a reasonable image extension
                    if (possibleExt && possibleExt.length <= 4 && /^[a-z0-9]+$/.test(possibleExt)) {
                        extension = possibleExt;
                    }
                }

                // If still unknown, check query parameters for image URLs (like wsrv.nl)
                if (extension === "unknown" && url.searchParams.has("url")) {
                    let embeddedUrl = url.searchParams.get("url");
                    if (embeddedUrl && embeddedUrl.includes(".")) {
                        let possibleExt = embeddedUrl.split(".").pop().toLowerCase();
                        if (possibleExt && possibleExt.length <= 4 && /^[a-z0-9]+$/.test(possibleExt)) {
                            extension = possibleExt;
                        }
                    }
                }

                modalTitle.textContent = `Cover Image (${this.naturalWidth}px × ${this.naturalHeight}px, ${extension})`;
            };

            fullSizeImg.onerror = function() {
                modalTitle.textContent = "Cover Image (Error loading)";
            };

            // Close on background click
            modal.onclick = (e) => {
                if (e.target === modal) {
                    closeCoverImageModal();
                }
            };
        }
    }

    function closeCoverImageModal() {
        let modal = document.getElementById("coverImageModal");
        modal.style.display = "none";
        document.body.classList.remove("modal-open");
    }

    function addEventHandlers() {
        getPackEpubButton().onclick = fetchContentAndPackEpub;
        document.getElementById("downloadChaptersButton").onclick = downloadChapters;
        document.getElementById("diagnosticsCheckBoxInput").onclick = onDiagnosticsClick;
        document.getElementById("reloadButton").onclick = populateControls;
        getManuallySelectParserTag().onchange = populateControls;
        document.getElementById("advancedOptionsButton").onclick = onAdvancedOptionsClick;
        document.getElementById("closeAdvancedOptionsButton").onclick = onAdvancedOptionsClick;
        document.getElementById("libraryButton").onclick = onLibraryClick;
        document.getElementById("closeLibraryButton").onclick = onLibraryClick;
        document.getElementById("cacheOptionsButton").onclick = onCacheOptionsClick;
        document.getElementById("ShowMoreMetadataOptionsCheckbox").addEventListener("change", function() {
            onShowMoreMetadataOptionsClick();
        });
        document.getElementById("LibAddToLibrary").addEventListener("click", fetchContentAndPackEpub);
        
        // Setup library book indicator event handlers
        LibraryUI.LibSetupBookIndicatorHandlers();
        if (document.getElementById("stopDownloadButton")) {
            document.getElementById("stopDownloadButton").addEventListener("click", stopDownload);
        }
        document.getElementById("stylesheetToDefaultButton").onclick = onStylesheetToDefaultClick;
        document.getElementById("resetButton").onclick = resetUI;
        document.getElementById("clearCoverImageUrlButton").onclick = clearCoverUrl;
        document.getElementById("seriesPageHelpButton").onclick = onSeriesPageHelp;
        document.getElementById("CustomFilenameHelpButton").onclick = onCustomFilenameHelp;
        document.getElementById("defaultParserHelpButton").onclick = onDefaultParserHelp;
        getLoadAndAnalyseButton().onclick = onLoadAndAnalyseButtonClick;
        document.getElementById("loadMetadataButton").onclick = onLoadMetadataButtonClick;

        document.getElementById("writeOptionsButton").onclick = () => userPreferences.writeToFile();
        document.getElementById("readOptionsInput").onchange = onReadOptionsFromFile;
        UserPreferences.getReadingListCheckbox().onclick = onReadingListCheckboxClicked;
        document.getElementById("viewFiltersButton").onclick = () => sbFiltersToggle();
        document.getElementById("openSidebarButton").onclick = () => sbFiltersShow();
        document.getElementById("sbClose").onclick = () => sbHide();
        document.getElementById("viewReadingListButton").onclick = () => showReadingList();

        // Cover image modal handlers
        document.getElementById("sampleCoverImg").onclick = onCoverImageClick;
        document.getElementById("closeCoverImage").onclick = closeCoverImageModal;

        window.addEventListener("beforeunload", onUnloadEvent);
    }

    // Additional metadata
    function autosearchadditionalmetadata() {
        setMetadataButtonsState(true);
        let titleName = getValueFromUiField("titleInput");
        let url = "https://www.novelupdates.com/series-finder/?sf=1&sh=" + titleName;
        if (getValueFromUiField("subjectInput") == null) {
            autosearchnovelupdates(url, titleName);
        }
        setMetadataButtonsState(false);
    }

    function autosearchnovelupdates(url, titelname) {
        return HttpClient.wrapFetch(url).then(function(xhr) {
            findnovelupdatesurl(url, xhr.responseXML, titelname);
        }).catch(function(error) {
            getLoadAndAnalyseButton().disabled = false;
            ErrorLog.showErrorMessage(error);
        });
    }

    function findnovelupdatesurl(url, dom, titelname) {
        try {
            let searchurl = [...dom.querySelectorAll("a")].filter(a => a.textContent == titelname)[0];
            setUiFieldToValue("metadataUrlInput", searchurl.href);
            url = getValueFromUiField("metadataUrlInput");
            if (url.includes("novelupdates.com") == true) {
                onLoadMetadataButtonClick();
            }
        } catch {
            //
        }
    }

    function onLoadMetadataButtonClick() {
        setMetadataButtonsState(true);
        let url = getValueFromUiField("metadataUrlInput");
        return HttpClient.wrapFetch(url).then(function(xhr) {
            populateMetadataAddWithDom(url, xhr.responseXML);
        }).catch(function(error) {
            getLoadAndAnalyseButton().disabled = false;
            ErrorLog.showErrorMessage(error);
        });
    }

    function populateMetadataAddWithDom(url, dom) {
        try {
            let allTags = document.getElementById("lesstagsCheckbox").checked == false;
            let metaAddInfo = EpubMetaInfo.getEpubMetaAddInfo(dom, url, allTags);
            setUiFieldToValue("subjectInput", metaAddInfo.subject);
            setUiFieldToValue("descriptionInput", metaAddInfo.description);
            let defaultAuthor = userPreferences ? userPreferences.defaultAuthorName.value : "<unknown>";
            if (getValueFromUiField("authorInput") == defaultAuthor) {
                setUiFieldToValue("authorInput", metaAddInfo.author);
            }
            setMetadataButtonsState(false);
        } catch (error) {
            ErrorLog.showErrorMessage(error);
            setMetadataButtonsState(false);
        }
    }

    function initializeIcons() {
        // Initialize the filter icon
        let viewFiltersIcon = document.getElementById("viewFiltersIcon");
        if (viewFiltersIcon) {
            viewFiltersIcon.appendChild(SvgIcons.createSvgElement(SvgIcons.FILTER));
        }

        // Initialize the sidebar close icon
        let sbCloseIcon = document.getElementById("sbCloseIcon");
        if (sbCloseIcon) {
            sbCloseIcon.appendChild(SvgIcons.createSvgElement(SvgIcons.ARROW_BAR_RIGHT));
        }

        // Initialize the sidebar open icon (flipped version)
        let openSidebarIcon = document.getElementById("openSidebarIcon");
        if (openSidebarIcon) {
            openSidebarIcon.appendChild(SvgIcons.createSvgElement(SvgIcons.ARROW_BAR_RIGHT));
        }
    }

    // actions to do when window opened
    window.onload = function() {
        userPreferences = UserPreferences.readFromLocalStorage();
        if (isRunningInTabMode()) {
            ErrorLog.SuppressErrorLog = false;
            localizeHtmlPage();
            setupCustomTooltips();
            getAdvancedOptionsSection().hidden = !userPreferences.advancedOptionsVisibleByDefault.value;
            getAdditionalMetadataSection().hidden = !userPreferences.ShowMoreMetadataOptions.value;
            initializeIcons();
            addEventHandlers();
            updateSidebarButtons();
            ChapterCache.updateCacheButtonText();
            updateLibraryButtonText();
            ChapterCache.runDailyCleanupIfNeeded().then();
            populateControls();
            if (util.isFirefox()) {
                Firefox.startWebRequestListeners();
            }
        } else {
            openTabWindow();
        }
    };

    function updateLibraryButtonText() {
        let button = document.getElementById("LibAddToLibrary");
        if (!button) return;
        
        // Check if we're in library mode by looking for currentLibraryBook global
        let isInLibraryMode = window.currentLibraryBook && window.currentLibraryBook.id;
        
        button.textContent = isInLibraryMode ? UIText.Common.updateLibraryBook : UIText.Common.addToLibrary;
    }

    return {
        getPackEpubButton: getPackEpubButton,
        onLoadAndAnalyseButtonClick: onLoadAndAnalyseButtonClick,
        fetchContentAndPackEpub: fetchContentAndPackEpub,
        downloadChapters: downloadChapters,
        resetUI: resetUI,
        setUiFieldToValue: setUiFieldToValue,
        getValueFromUiField: getValueFromUiField,
        getUserPreferences: () => userPreferences,
        metaInfoFromControls: metaInfoFromControls,
        updateLibraryButtonText: updateLibraryButtonText,
        hideAllSectionsExcept: hideAllSectionsExcept
    };
})();

