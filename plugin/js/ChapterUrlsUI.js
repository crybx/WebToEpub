"use strict";

/** Class that handles UI for selecting (chapter) URLs to fetch */
class ChapterUrlsUI {
    // Localized text strings for chapter UI
    static UIText = {
        menuRefreshChapter: chrome.i18n.getMessage("__MSG_menu_Refresh_Chapter__"),
        menuOpenChapterURL: chrome.i18n.getMessage("__MSG_menu_Open_Chapter_URL__"),
        menuDeleteChapter: chrome.i18n.getMessage("__MSG_menu_Delete_Chapter__"),
        menuDownloadChapter: chrome.i18n.getMessage("__MSG_menu_Download_Chapter__"),
        tooltipDeleteAllCached: chrome.i18n.getMessage("__MSG_tooltip_Delete_All_Cached__"),
        tooltipDownloadChapter: chrome.i18n.getMessage("__MSG_tooltip_Download_Chapter__"),
        tooltipChapterDownloading: chrome.i18n.getMessage("__MSG_Tooltip_chapter_downloading__"),
        tooltipViewChapter: chrome.i18n.getMessage("__MSG_tooltip_View_Chapter__"),
        tooltipChapterSleeping: chrome.i18n.getMessage("__MSG_Tooltip_chapter_sleeping__"),
        maxChaptersSelected: chrome.i18n.getMessage("__MSG_More_than_max_chapters_selected__"),
        shiftClickMessage: chrome.i18n.getMessage("__MSG_Shift_Click__")
    };
    constructor(parser) {
        this.parser = parser;
        ChapterUrlsUI.getPleaseWaitMessageRow().hidden = false;
        if (this.parser)
        {
            let nameElement = document.getElementById("spanParserName");
            if (nameElement) nameElement.textContent = this.parser.constructor.name;

            let delayMsElement = document.getElementById("spanDelayMs");
            if (delayMsElement) delayMsElement.textContent = `${this.parser.getRateLimit()} ms`;
        }

        let formElement = document.getElementById("sbFiltersForm");
        if (formElement) {
            document.getElementById("sbFiltersForm").onsubmit = function(event) {
                event.preventDefault();
            };
        }
    }

    connectButtonHandlers() {
        document.getElementById("selectAllUrlsCheckbox").onclick = ChapterUrlsUI.handleSelectAllCheckbox.bind(this);
        document.getElementById("reverseChapterUrlsOrderButton").onclick = this.reverseUrls.bind(this);
        document.getElementById("editChaptersUrlsButton").onclick = this.setEditInputMode.bind(this);
        document.getElementById("copyUrlsToClipboardButton").onclick = this.copyUrlsToClipboard.bind(this);
        document.getElementById("showChapterUrlsCheckbox").onclick = this.toggleShowUrlsForChapterRanges.bind(this);
        ChapterUrlsUI.modifyApplyChangesButtons(button => button.onclick = this.setTableMode.bind(this));
    }

    populateChapterUrlsTable(chapters) {
        ChapterUrlsUI.getPleaseWaitMessageRow().hidden = true;
        ChapterUrlsUI.clearChapterUrlsTable();
        let chapterList = ChapterUrlsUI.getChapterUrlsTable();
        let index = 0;
        let rangeStart = ChapterUrlsUI.getRangeStartChapterSelect();
        let rangeEnd = ChapterUrlsUI.getRangeEndChapterSelect();
        let memberForTextOption = ChapterUrlsUI.textToShowInRange();
        chapters.forEach(function(chapter) {
            let row = document.createElement("div");
            row.className = "chapter-row";
            row.rowIndex = index;  // Set rowIndex for shift-click range selection
            ChapterUrlsUI.appendCheckBoxToRow(row, chapter);
            ChapterUrlsUI.appendInputTextToRow(row, chapter);
            chapter.row = row;
            ChapterUrlsUI.appendColumnDataToRow(row, chapter);
            ChapterUrlsUI.appendChapterStatusColumnToRow(row, chapter).then(async () => {
                await ChapterUrlsUI.updateDeleteCacheButtonVisibility();
            });
            chapterList.appendChild(row);
            ChapterUrlsUI.appendOptionToSelect(rangeStart, index, chapter, memberForTextOption);
            ChapterUrlsUI.appendOptionToSelect(rangeEnd, index, chapter, memberForTextOption);
            ++index;
        });
        ChapterUrlsUI.setRangeOptionsToFirstAndLastChapters();
        
        // Set up chapter select info icon
        let chapterSelectInfo = document.getElementById("chapterSelectInfo");
        if (chapterSelectInfo && chapterSelectInfo.children.length === 0) {
            chapterSelectInfo.appendChild(SvgIcons.createSvgElement(SvgIcons.INFO_FILL));
        }
        
        // Set up header more actions menu
        ChapterUrlsUI.setupHeaderMoreActions(chapters);
        this.showHideChapterUrlsColumn();
        
        // Update select all checkbox state after populating table
        ChapterUrlsUI.updateSelectAllCheckboxState();
    }

    /**
     * Update chapter table incrementally instead of full re-render
     * @param {Array} newChapters - New or updated chapters to merge
     */
    updateChapterTableIncremental(newChapters) {
        ChapterUrlsUI.getPleaseWaitMessageRow().hidden = true;
        let chapterList = ChapterUrlsUI.getChapterUrlsTable();
        let existingRows = Array.from(chapterList.querySelectorAll('.chapter-row'));
        let rangeStart = ChapterUrlsUI.getRangeStartChapterSelect();
        let rangeEnd = ChapterUrlsUI.getRangeEndChapterSelect();
        let memberForTextOption = ChapterUrlsUI.textToShowInRange();
        
        // Clear existing range options
        rangeStart.innerHTML = '';
        rangeEnd.innerHTML = '';
        
        // Update existing rows and add new ones
        newChapters.forEach((chapter, index) => {
            let existingRow = existingRows[index];
            
            if (existingRow) {
                // Update existing row
                this.updateExistingChapterRow(existingRow, chapter, index);
            } else {
                // Create new row
                let row = document.createElement("div");
                row.className = "chapter-row";
                row.rowIndex = index;
                ChapterUrlsUI.appendCheckBoxToRow(row, chapter);
                ChapterUrlsUI.appendInputTextToRow(row, chapter);
                chapter.row = row;
                ChapterUrlsUI.appendColumnDataToRow(row, chapter);
                ChapterUrlsUI.appendChapterStatusColumnToRow(row, chapter).then(async () => {
                    // Set checkbox state after creation - preserve existing selections, set defaults for new chapters
                    let checkbox = row.querySelector('input[type="checkbox"]');
                    if (checkbox) {
                        // Preserve existing user selections (don't override if user has already made a choice)
                        if (chapter.isIncludeable === undefined) {
                            // Use ChapterInclusionLogic for consistent inclusion logic
                            let isLibraryMode = chapter.source !== undefined; // Library mode chapters have source property
                            chapter.isIncludeable = ChapterInclusionLogic.shouldChapterBeIncluded(
                                chapter.source || 'unknown', 
                                isLibraryMode, 
                                chapter.isIncludeable
                            );
                        }
                        checkbox.checked = chapter.isIncludeable;
                        checkbox.disabled = false; // All chapters are selectable
                    }

                    await ChapterUrlsUI.updateDeleteCacheButtonVisibility();
                });
                chapterList.appendChild(row);
            }
            
            // Add to range selectors
            ChapterUrlsUI.appendOptionToSelect(rangeStart, index, chapter, memberForTextOption);
            ChapterUrlsUI.appendOptionToSelect(rangeEnd, index, chapter, memberForTextOption);
        });
        
        // Remove extra rows if we have fewer chapters now
        for (let i = newChapters.length; i < existingRows.length; i++) {
            existingRows[i].remove();
        }
        
        ChapterUrlsUI.setRangeOptionsToFirstAndLastChapters();
        this.showHideChapterUrlsColumn();
        ChapterUrlsUI.updateSelectAllCheckboxState();
    }

    /**
     * Update an existing chapter row with new data
     * @param {HTMLElement} row - Existing row element
     * @param {Object} chapter - Chapter data
     * @param {number} index - Chapter index
     */
    updateExistingChapterRow(row, chapter, index) {
        row.rowIndex = index;
        chapter.row = row;
        
        // Update checkbox state - preserve existing user selections, only set defaults for new chapters
        let checkbox = row.querySelector('input[type="checkbox"]');
        if (checkbox) {
            // Preserve existing user selections (don't override if user has already made a choice)
            if (chapter.isIncludeable === undefined) {
                // Use ChapterInclusionLogic for consistent inclusion logic
                let isLibraryMode = chapter.source !== undefined; // Library mode chapters have source property
                chapter.isIncludeable = ChapterInclusionLogic.shouldChapterBeIncluded(
                    chapter.source || 'unknown', 
                    isLibraryMode, 
                    chapter.isIncludeable
                );
            }
            checkbox.checked = chapter.isIncludeable;
            checkbox.disabled = false; // All chapters are selectable
        }
        
        // Update title
        let titleInput = row.querySelector('.chapter-title-column input');
        if (titleInput) {
            titleInput.value = chapter.title;
        }
        
        // Update source URL display - use input field like normal mode but disabled
        let urlColumn = row.querySelector('.chapter-url-column');
        if (urlColumn) {
            let urlInput = urlColumn.querySelector('input[type="url"]');
            if (urlInput) {
                // Update existing input
                urlInput.value = chapter.sourceUrl || '';
                urlInput.disabled = true; // Disable editing in library mode
            } else {
                // Create input if it doesn't exist (should match normal mode structure)
                urlColumn.textContent = ''; // Clear any existing text content
                let input = document.createElement("input");
                input.type = "url";
                input.value = chapter.sourceUrl || '';
                input.disabled = true; // Disable editing in library mode
                urlColumn.appendChild(input);
            }
        }
        
        // Update status column with library indicators
        this.updateChapterStatusColumn(row, chapter);
    }

    /**
     * Update chapter status column with library-specific indicators and interactive functionality
     * @param {HTMLElement} row - Chapter row element
     * @param {Object} chapter - Chapter data
     */
    updateChapterStatusColumn(row, chapter) {
        // Remove all existing status columns from the row
        let statusColumns = row.querySelectorAll('.chapter-status-column');
        statusColumns.forEach(col => col.remove());
        
        // Re-create the status column using existing method
        ChapterUrlsUI.appendChapterStatusColumnToRow(row, chapter).then(async () => {
            await ChapterUrlsUI.updateDeleteCacheButtonVisibility();
        });
    }

    /**
     * Add library chapter indicators to the chapter list UI
     * @param {string} bookId - The Library book ID  
     * @param {Array} chapters - Enhanced chapters array
     */
    static async addLibraryChapterIndicators(bookId, chapters) {
        try {
            // Wait a moment for the chapter table to be fully rendered
            await new Promise(resolve => setTimeout(resolve, 200));
            
            chapters.forEach((chapter, index) => {
                // Find row by rowIndex property
                let rows = document.querySelectorAll('.chapter-row');
                let row = Array.from(rows).find(r => r.rowIndex === index);

                if (row && chapter.isInBook) {
                    // Replace cache eye icon with library book icon for chapters that exist in book
                    let statusColumn = row.querySelector(".chapter-status-column");
                    if (statusColumn) {
                        // Remove existing cache icon and its tooltip wrapper if present
                        let existingWrapper = statusColumn.querySelector(".tooltip-wrapper");
                        if (existingWrapper) {
                            existingWrapper.remove();
                        }
                        
                        // Add library book icon with tooltip wrapper (same structure as cache icon)
                        if (!statusColumn.querySelector(".library-chapter-view-icon")) {
                            let tooltipWrapper = document.createElement("div");
                            tooltipWrapper.classList.add("tooltip-wrapper", "clickable-icon");
                            
                            let bookIcon = SvgIcons.createSvgElement(SvgIcons.BOOK);
                            bookIcon.classList.add("library-chapter-view-icon", "chapter-status-icon");
                            
                            let tooltip = document.createElement("span");
                            tooltip.classList.add("tooltipText");
                            tooltip.textContent = "View chapter from library book";
                            
                            tooltipWrapper.onclick = (e) => {
                                e.stopPropagation();
                                ChapterViewer.openLibraryChapter(bookId, chapter.libraryChapterIndex);
                            };
                            
                            tooltipWrapper.appendChild(bookIcon);
                            tooltipWrapper.appendChild(tooltip);
                            statusColumn.insertBefore(tooltipWrapper, statusColumn.firstChild);
                        }
                    }
                    
                    // Mark row as "in library" for CSS styling
                    row.classList.add("chapter-in-library");
                } else if (row && !chapter.isInBook) {
                    // Mark new chapters for visual distinction
                    row.classList.add("chapter-new-on-website");
                }
            });
            
        } catch (error) {
            console.error("Error adding library chapter indicators:", error);
        }
    }

    showTocProgress(chapters) {
        let chapterList = ChapterUrlsUI.getChapterUrlsTable();
        chapters.forEach(function(chapter) {
            let row = document.createElement("div");
            row.className = "chapter-row";
            chapterList.appendChild(row);
            row.appendChild(document.createElement("div"));
            let col = document.createElement("div");
            col.className = "chapter-title-column disabled";
            col.appendChild(document.createTextNode(chapter.title));
            row.appendChild(col);
            row.appendChild(document.createElement("div"));
        });
    }

    static showChapterStatus(row, state, sourceUrl = "", title = "") {
        if (row != null) {
            ChapterUrlsUI.setChapterStatusVisuals(row, state, sourceUrl, title);
        }
    }


    static async resetChapterStatusIcons() {
        let linksTable = ChapterUrlsUI.getChapterUrlsTable();
        
        for (let chapterStatusColumn of linksTable.querySelectorAll(".chapter-status-column")) {
            // Restore normal chapter status content
            await ChapterUrlsUI.restoreChapterStatus(chapterStatusColumn);
        }
    }

    static clearChapterUrlsTable() {
        util.removeElements(ChapterUrlsUI.getTableRowsWithChapters());
        util.removeElements([...ChapterUrlsUI.getRangeStartChapterSelect().options]);
        util.removeElements([...ChapterUrlsUI.getRangeEndChapterSelect().options]);
    }

    static limitNumOfChapterS(maxChapters) {
        let max = util.isNullOrEmpty(maxChapters) ? 10000 : parseInt(maxChapters.replace(",", ""));
        let selectedRows = [...ChapterUrlsUI.getChapterUrlsTable().querySelectorAll("[type=\"checkbox\"]")]
            .filter(c => c.checked)
            .map(c => c.closest(".chapter-row"));
        if (max< selectedRows.length ) {
            let message = ChapterUrlsUI.UIText.maxChaptersSelected.replace("$1", 
                selectedRows.length).replace("$2", max);
            if (confirm(message) === false) {
                for (let row of selectedRows.slice(max)) {
                    ChapterUrlsUI.setRowCheckboxState(row, false);
                }
            }
        }
    }

    /** @private */
    static setRangeOptionsToFirstAndLastChapters()
    {
        let rangeStart = ChapterUrlsUI.getRangeStartChapterSelect();
        let rangeEnd = ChapterUrlsUI.getRangeEndChapterSelect();

        rangeStart.onchange = null;
        rangeEnd.onchange = null;
        
        rangeStart.selectedIndex = 0;
        rangeEnd.selectedIndex = rangeEnd.length - 1;
        ChapterUrlsUI.setChapterCount(rangeStart.selectedIndex, rangeEnd.selectedIndex);
        
        rangeStart.onchange = ChapterUrlsUI.onRangeChanged;
        rangeEnd.onchange = ChapterUrlsUI.onRangeChanged;
    }
 
    /** @private */
    static onRangeChanged() {
        let startIndex = ChapterUrlsUI.getRangeStartChapterSelect().selectedIndex;
        let endIndex = ChapterUrlsUI.getRangeEndChapterSelect().selectedIndex;
        let rc = new ChapterUrlsUI.RangeCalculator();

        for (let row of ChapterUrlsUI.getTableRowsWithChapters()) {
            let inRange = rc.rowInRange(row);
            ChapterUrlsUI.setRowCheckboxState(row, rc.rowInRange(row));
            row.hidden = !inRange;
        }
        ChapterUrlsUI.setChapterCount(startIndex, endIndex);
    }

    /** @private */
    static setChapterCount(startIndex, endIndex) {
        let count = Math.max(0, 1 + endIndex - startIndex);
        document.getElementById("spanChapterCount").textContent = count;
    }
    
    /** 
    * @private
    */
    static getChapterUrlsTable() {
        return document.getElementById("chapterUrlsTable");
    }

    /** @private */
    static getRangeStartChapterSelect() {
        return document.getElementById("selectRangeStartChapter");
    }

    /** @private */
    static getRangeEndChapterSelect() {
        return document.getElementById("selectRangeEndChapter");
    }

    /** @private */
    static textToShowInRange() {
        return document.getElementById("showChapterUrlsCheckbox").checked
            ? "sourceUrl"
            : "title";
    }

    /** 
    * @private
    */
    static modifyApplyChangesButtons(mutator) {
        mutator(document.getElementById("applyChangesButton"));
        mutator(document.getElementById("applyChangesButton2"));
    }

    /** 
    * @private
    */
    static getEditChaptersUrlsInput() {
        return document.getElementById("editChaptersUrlsInput");
    }

    /** @private */
    static getPleaseWaitMessageRow() {
        return document.getElementById("findingChapterUrlsMessageRow");
    }

    /** @private */
    static async setAllUrlsSelectState(select) {
        // Set flag to prevent recursive updates
        ChapterUrlsUI._updatingSelectAll = true;
        
        // Collect library chapters for bulk caching
        let libraryChaptersToCache = [];
        let allRows = ChapterUrlsUI.getTableRowsWithChapters();
        
        for (let i = 0; i < allRows.length; i++) {
            let row = allRows[i];
            ChapterUrlsUI.setRowCheckboxState(row, select);
            row.hidden = false;
            
            // If selecting library chapters, collect them for bulk caching
            if (select && window.parser && window.parser.state && window.parser.state.webPages) {
                let chapter = [...window.parser.state.webPages.values()][i];
                if (chapter && chapter.isInBook && chapter.libraryBookId && chapter.libraryChapterIndex !== undefined) {
                    libraryChaptersToCache.push({chapter, row});
                }
            }
        }
        
        ChapterUrlsUI.setRangeOptionsToFirstAndLastChapters();
        
        // Bulk cache library chapters if selecting all
        if (libraryChaptersToCache.length > 0) {
            try {
                await Promise.all(libraryChaptersToCache.map(async ({chapter, row}) => {
                    try {
                        // Check if already cached
                        let cachedContent = await ChapterCache.get(chapter.sourceUrl);
                        if (!cachedContent) {
                            // Get library chapter content and cache it
                            let content = await LibraryBookData.getChapterContent(chapter.libraryBookId, chapter.libraryChapterIndex);
                            if (content) {
                                await ChapterCache.set(chapter.sourceUrl, content);
                                // Update visual status
                                ChapterUrlsUI.setChapterStatusVisuals(row, ChapterUrlsUI.CHAPTER_STATUS_DOWNLOADED, chapter.sourceUrl, chapter.title);
                            }
                        }
                    } catch (error) {
                        console.error("Failed to cache library chapter in select all:", error);
                    }
                }));
            } catch (error) {
                console.error("Error in select all bulk caching:", error);
            }
        }
        
        // Update select all checkbox state and clear flag
        ChapterUrlsUI._updatingSelectAll = false;
        ChapterUrlsUI.updateSelectAllCheckboxState();
    }

    /** Handle the select all checkbox click */
    static async handleSelectAllCheckbox() {
        const selectAllCheckbox = document.getElementById("selectAllUrlsCheckbox");
        const newState = selectAllCheckbox.checked;
        
        // Set flag to prevent recursive updates
        ChapterUrlsUI._updatingSelectAll = true;
        
        // Collect library chapters for bulk caching
        let libraryChaptersToCache = [];
        let allRows = ChapterUrlsUI.getTableRowsWithChapters();
        
        // Only affect chapters in the current range
        let rc = new ChapterUrlsUI.RangeCalculator();
        for (let i = 0; i < allRows.length; i++) {
            let row = allRows[i];
            if (rc.rowInRange(row)) {
                ChapterUrlsUI.setRowCheckboxState(row, newState);
                
                // If selecting library chapters, collect them for bulk caching
                if (newState && window.parser && window.parser.state && window.parser.state.webPages) {
                    let chapter = [...window.parser.state.webPages.values()][i];
                    if (chapter && chapter.isInBook && chapter.libraryBookId && chapter.libraryChapterIndex !== undefined) {
                        libraryChaptersToCache.push({chapter, row});
                    }
                }
            }
        }
        
        // Bulk cache library chapters if selecting
        if (libraryChaptersToCache.length > 0) {
            try {
                await Promise.all(libraryChaptersToCache.map(async ({chapter, row}) => {
                    try {
                        // Check if already cached
                        let cachedContent = await ChapterCache.get(chapter.sourceUrl);
                        if (!cachedContent) {
                            // Get library chapter content and cache it
                            let content = await LibraryBookData.getChapterContent(chapter.libraryBookId, chapter.libraryChapterIndex);
                            if (content) {
                                await ChapterCache.set(chapter.sourceUrl, content);
                                // Update visual status
                                ChapterUrlsUI.setChapterStatusVisuals(row, ChapterUrlsUI.CHAPTER_STATUS_DOWNLOADED, chapter.sourceUrl, chapter.title);
                            }
                        }
                    } catch (error) {
                        console.error("Failed to cache library chapter in select all range:", error);
                    }
                }));
            } catch (error) {
                console.error("Error in select all range bulk caching:", error);
            }
        }
        
        // Clear flag
        ChapterUrlsUI._updatingSelectAll = false;
    }

    /** Update the select all checkbox state based on individual checkbox states */
    static updateSelectAllCheckboxState() {
        const selectAllCheckbox = document.getElementById("selectAllUrlsCheckbox");
        if (!selectAllCheckbox) return;
        
        const allCheckboxes = [...document.querySelectorAll(".chapterSelectCheckbox")];
        if (allCheckboxes.length === 0) return;
        
        const checkedCount = allCheckboxes.filter(cb => cb.checked).length;
        
        if (checkedCount === 0) {
            // All unchecked
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
        } else if (checkedCount === allCheckboxes.length) {
            // All checked
            selectAllCheckbox.checked = true;
            selectAllCheckbox.indeterminate = false;
        } else {
            // Some checked (indeterminate state)
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = true;
        }
    }

    /** @private */
    static setRowCheckboxState(row, checked) {
        let input = row.querySelector(".chapterSelectCheckbox");
        if (input.checked !== checked) {
            input.checked = checked;
            input.onclick();
        }
    }

    static getTableRowsWithChapters() {
        let linksTable = ChapterUrlsUI.getChapterUrlsTable();
        return [...linksTable.querySelectorAll(".chapter-row")];
    }

    /**
    * @private
    */
    static appendCheckBoxToRow(row, chapter) {
        // Use ChapterInclusionLogic for default inclusion state
        if (chapter.isIncludeable === undefined) {
            let isLibraryMode = chapter.source !== undefined;
            chapter.isIncludeable = ChapterInclusionLogic.shouldChapterBeIncluded(
                chapter.source || 'unknown', 
                isLibraryMode
            );
        }
        chapter.previousDownload = chapter.previousDownload ?? false;

        const col = document.createElement("div");
        col.className = "chapter-checkbox-column";
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.classList.add("chapterSelectCheckbox");
        checkbox.checked = chapter.isIncludeable;
        checkbox.onclick = async function(event) { 
            chapter.isIncludeable = checkbox.checked;
            if (!event) return;

            ChapterUrlsUI.tellUserAboutShiftClick(event, row);

            if (event.shiftKey && (ChapterUrlsUI.lastSelectedRow !== null)) {
                ChapterUrlsUI.updateRange(ChapterUrlsUI.lastSelectedRow, row.rowIndex, checkbox.checked);
            } else {
                ChapterUrlsUI.lastSelectedRow = row.rowIndex;
            }
            
            // Pre-cache library chapter content when selected for inclusion
            if (checkbox.checked && chapter.isInBook && chapter.libraryBookId && chapter.libraryChapterIndex !== undefined) {
                try {
                    // Check if already cached to avoid redundant work
                    let cachedContent = await ChapterCache.get(chapter.sourceUrl);
                    if (!cachedContent) {
                        // Get library chapter content and cache it
                        let content = await LibraryBookData.getChapterContent(chapter.libraryBookId, chapter.libraryChapterIndex);
                        if (content) {
                            await ChapterCache.set(chapter.sourceUrl, content);
                            // Update visual status to show it's cached
                            ChapterUrlsUI.setChapterStatusVisuals(row, ChapterUrlsUI.CHAPTER_STATUS_DOWNLOADED, chapter.sourceUrl, chapter.title);
                        }
                    }
                } catch (error) {
                    console.error("Failed to cache library chapter:", error);
                }
            }
            
            // Update the select all checkbox state (only if not in bulk update mode)
            if (!ChapterUrlsUI._updatingSelectAll) {
                ChapterUrlsUI.updateSelectAllCheckboxState();
            }
        };
        col.appendChild(checkbox);
        row.appendChild(col);
    }

    /**
    * Restore normal chapter status content after status changes
    */
    static async restoreChapterStatus(chapterStatusColumn) {
        if (!chapterStatusColumn) return;
        
        // Get the chapter info from the row
        let row = chapterStatusColumn.parentElement;
        let titleInput = row.querySelector("input[type=\"text\"]");
        let urlCell = row.querySelector("td:nth-child(3)");
        
        if (!titleInput || !urlCell) return;
        
        let title = titleInput.value;
        // Handle both input field (normal/library mode) and text content (legacy)
        let urlInput = urlCell.querySelector('input[type="url"]');
        let sourceUrl = urlInput ? urlInput.value.trim() : urlCell.textContent.trim();
        
        // Check if chapter is cached
        try {
            let cachedContent = await ChapterCache.get(sourceUrl);
            if (cachedContent) {
                ChapterUrlsUI.setChapterStatusVisuals(row, ChapterUrlsUI.CHAPTER_STATUS_DOWNLOADED, sourceUrl, title);
            } else {
                ChapterUrlsUI.setChapterStatusVisuals(row, ChapterUrlsUI.CHAPTER_STATUS_NONE, sourceUrl, title);
            }
        } catch (err) {
            console.error("Error restoring chapter status content:", err);
            // Fallback to download icon
            ChapterUrlsUI.setChapterStatusVisuals(row, ChapterUrlsUI.CHAPTER_STATUS_NONE, sourceUrl, title);
        }
    }

    /** 
    * @private
    */
    static appendInputTextToRow(row, chapter) {
        let col = document.createElement("div");
        col.className = "chapter-title-column";
        let input = document.createElement("input");
        input.type = "text";
        input.value = chapter.title;
        input.addEventListener("blur", function() { chapter.title = input.value; },  true);
        col.appendChild(input);
        row.appendChild(col);
    }

    static appendOptionToSelect(select, value, chapter, memberForTextOption) {
        let option = new Option(chapter[memberForTextOption], value);
        select.add(option);
    }

    /** 
    * @private
    */
    static appendColumnDataToRow(row, chapter) {
        let col = document.createElement("div");
        col.className = "chapter-url-column";
        
        let input = document.createElement("input");
        input.type = "url";
        input.value = chapter.sourceUrl;
        input.addEventListener("blur", function() { 
            chapter.sourceUrl = input.value; 
        }, true);
        
        col.appendChild(input);
        row.appendChild(col);
        return col;
    }

    /**
    * @private
    * Add chapter status column with appropriate icon and functionality:
    * - Eye icon for cached chapters (clickable to view)
    * - Download icon for uncached chapters (clickable to download)
    * - Red eye icon for error chapters (clickable to view error)
    * Also adds three-dots menu for additional actions
    * @param {HTMLElement} row - The table row to add the status column to
    * @param {Object} chapter - Chapter object with sourceUrl and title
    * @returns {Promise<boolean>} true if chapter is downloaded or has error
    */
    static async appendChapterStatusColumnToRow(row, chapter) {
        let col = document.createElement("div");
        col.className = "chapter-status-column";
        row.appendChild(col);
        
        // Check if chapter is cached or has an error
        return Promise.all([
            ChapterCache.get(chapter.sourceUrl),
            ChapterCache.getChapterError(chapter.sourceUrl)
        ]).then(async ([cachedContent, errorMessage]) => {
            if (cachedContent) {
                // Chapter is cached - show eye icon
                ChapterUrlsUI.setChapterStatusVisuals(row, ChapterUrlsUI.CHAPTER_STATUS_DOWNLOADED, chapter.sourceUrl, chapter.title);
                return true;
            } else if (errorMessage) {
                // Chapter has error - show error icon
                ChapterUrlsUI.setChapterStatusVisuals(row, ChapterUrlsUI.CHAPTER_STATUS_ERROR, chapter.sourceUrl, chapter.title);
                return true;
            } else {
                // Chapter is not cached - show download icon
                ChapterUrlsUI.setChapterStatusVisuals(row, ChapterUrlsUI.CHAPTER_STATUS_NONE, chapter.sourceUrl, chapter.title);
                return false;
            }
        }).catch(err => {
            console.error("Error checking cache:", err);
            return false;
        });
    }

    /**
    * Update visibility of delete cache button and header more actions based on whether any chapters are cached
    */
    static async updateDeleteCacheButtonVisibility() {
        // Check if there are actually cached chapters for the current page's URLs
        let hasCache = await ChapterCache.hasAnyCachedChaptersOnPage();
        let headerMoreActions = document.getElementById("headerMoreActionsWrapper");
        
        if (headerMoreActions) {
            headerMoreActions.style.display = hasCache ? "block" : "none";
        }
    }

    /**
    * @private
    * Add more actions menu (three dots) next to chapter status icon
    */
    static addMoreActionsMenu(row, sourceUrl, title) {
        // Try to find the full chapter data to determine if this is a library chapter
        let chapter = null;
        if (window.parser && window.parser.state && window.parser.state.webPages) {
            chapter = [...window.parser.state.webPages.values()].find(ch => ch.sourceUrl === sourceUrl);
        }
        let col = row.querySelector(".chapter-status-column");
        if (!col) return;
        // Create more actions wrapper
        let moreWrapper = document.createElement("div");
        moreWrapper.className = "more-actions-wrapper clickable-icon";
        
        // Create three dots icon (inline SVG for color control)
        let moreIcon = SvgIcons.createSvgElement(SvgIcons.THREE_DOTS_VERTICAL);
        moreIcon.classList.add("menu-icon");
        
        // Create dropdown menu
        let menu = document.createElement("div");
        menu.className = "more-actions-menu";
        
        // REFRESH CHAPTER option
        let refreshItem = document.createElement("div");
        refreshItem.className = "menu-item";
        let refreshIcon = SvgIcons.createSvgElement(SvgIcons.ARROW_CLOCKWISE);
        let refreshText = document.createElement("span");
        refreshText.textContent = ChapterUrlsUI.UIText.menuRefreshChapter;
        refreshItem.appendChild(refreshIcon);
        refreshItem.appendChild(refreshText);
        refreshItem.onclick = async (e) => {
            e.stopPropagation();
            // Check if this is a library chapter and handle accordingly
            if (chapter && chapter.isInBook && chapter.libraryBookId && chapter.libraryChapterIndex !== undefined) {
                await ChapterUrlsUI.refreshLibraryChapter(chapter, row);
            } else {
                await ChapterCache.refreshChapter(sourceUrl, title, row);
            }
            ChapterUrlsUI.hideMoreActionsMenu(menu);
        };
        
        // OPEN CHAPTER URL option
        let openUrlItem = document.createElement("div");
        openUrlItem.className = "menu-item";
        let openUrlIcon = SvgIcons.createSvgElement(SvgIcons.BOX_ARROW_RIGHT);
        let openUrlText = document.createElement("span");
        openUrlText.textContent = ChapterUrlsUI.UIText.menuOpenChapterURL;
        openUrlItem.appendChild(openUrlIcon);
        openUrlItem.appendChild(openUrlText);
        openUrlItem.onclick = (e) => {
            e.stopPropagation();
            window.open(sourceUrl, "_blank");
            ChapterUrlsUI.hideMoreActionsMenu(menu);
        };
        
        // DELETE CHAPTER option
        let deleteItem = document.createElement("div");
        deleteItem.className = "menu-item";
        let deleteIcon = SvgIcons.createSvgElement(SvgIcons.TRASH3_FILL);
        let deleteText = document.createElement("span");
        deleteText.textContent = ChapterUrlsUI.UIText.menuDeleteChapter;
        deleteItem.appendChild(deleteIcon);
        deleteItem.appendChild(deleteText);
        deleteItem.onclick = async (e) => {
            e.stopPropagation();
            // Check if this is a library chapter and handle accordingly
            if (chapter && chapter.isInBook && chapter.libraryBookId && chapter.libraryChapterIndex !== undefined) {
                await ChapterUrlsUI.deleteLibraryChapter(chapter, row);
            } else {
                await ChapterCache.deleteSingleChapter(sourceUrl, title, row);
            }
            ChapterUrlsUI.hideMoreActionsMenu(menu);
        };
        
        // DOWNLOAD HTML FILE option
        let downloadItem = document.createElement("div");
        downloadItem.className = "menu-item";
        let downloadIcon = SvgIcons.createSvgElement(SvgIcons.DOWNLOAD);
        let downloadText = document.createElement("span");
        downloadText.textContent = ChapterUrlsUI.UIText.menuDownloadChapter;
        downloadItem.appendChild(downloadIcon);
        downloadItem.appendChild(downloadText);
        downloadItem.onclick = async (e) => {
            e.stopPropagation();
            await ChapterCache.downloadSingleChapterAsFile(sourceUrl, title);
            ChapterUrlsUI.hideMoreActionsMenu(menu);
        };
        
        // Add items to menu
        menu.appendChild(refreshItem);
        menu.appendChild(openUrlItem);
        menu.appendChild(deleteItem);
        menu.appendChild(downloadItem);
        
        // Add click handler to show/hide menu
        moreWrapper.onclick = (e) => {
            e.stopPropagation();
            ChapterUrlsUI.toggleMoreActionsMenu(menu);
        };
        
        // Assemble more actions
        moreWrapper.appendChild(moreIcon);
        moreWrapper.appendChild(menu);
        col.appendChild(moreWrapper);
        
        // Close menu when clicking outside
        document.addEventListener("click", () => ChapterUrlsUI.hideMoreActionsMenu(menu));
    }

    /**
    * @private
    * Toggle more actions menu visibility
    */
    static toggleMoreActionsMenu(menu) {
        // Hide all other open menus first
        document.querySelectorAll(".more-actions-menu.show").forEach(m => {
            if (m !== menu) m.classList.remove("show");
        });
        
        menu.classList.toggle("show");
    }

    /**
    * @private
    * Hide more actions menu
    */
    static hideMoreActionsMenu(menu) {
        menu.classList.remove("show");
    }

    /**
     * @public
     * Unified method to set chapter status icon based on state
     * Handles chapter states: cached, uncached, downloading, sleeping
     */
    static createIconElement(state) {
        const svgConstants = {
            [ChapterUrlsUI.CHAPTER_STATUS_NONE]: SvgIcons.DOWNLOAD,
            [ChapterUrlsUI.CHAPTER_STATUS_DOWNLOADING]: SvgIcons.CHAPTER_STATE_DOWNLOADING,
            [ChapterUrlsUI.CHAPTER_STATUS_DOWNLOADED]: SvgIcons.EYE_FILL,
            [ChapterUrlsUI.CHAPTER_STATUS_SLEEPING]: SvgIcons.CHAPTER_STATE_SLEEPING,
            [ChapterUrlsUI.CHAPTER_STATUS_ERROR]: SvgIcons.EYE_FILL
        };
        
        let iconElement = SvgIcons.createSvgElement(svgConstants[state]);
        iconElement.classList.add("chapter-status-icon");
        return iconElement;
    }

    /**
     * Find a chapter row by sourceUrl
     */
    static findRowBySourceUrl(sourceUrl) {
        const rows = document.querySelectorAll('.chapter-row');
        for (let row of rows) {
            const urlInput = row.querySelector('input[type="url"]');
            if (urlInput && urlInput.value === sourceUrl) {
                return row;
            }
        }
        return null;
    }

    static setChapterStatusVisuals(row, state, sourceUrl, title) {
        if (!row) return;

        let column = row.querySelector(".chapter-status-column");
        if (!column) return;

        column.innerHTML = "";

        let wrapper = document.createElement("div");
        wrapper.className = "tooltip-wrapper";
        
        let iconElement = ChapterUrlsUI.createIconElement(state);
        
        let tooltip = document.createElement("span");
        tooltip.className = "tooltipText";
        tooltip.textContent = ChapterUrlsUI.TooltipForState[state];

        wrapper.appendChild(iconElement);
        wrapper.appendChild(tooltip);
        column.appendChild(wrapper);
        
        // Handle successBox class for checkbox in row
        let checkbox = row.querySelector(".chapterSelectCheckbox");
        if (checkbox) {
            if (state === ChapterUrlsUI.CHAPTER_STATUS_DOWNLOADED) {
                checkbox.classList.add("successBox");
            } else {
                checkbox.classList.remove("successBox");
            }
        }
        
        // Apply state-specific behavior and styling
        switch (state) {
            case ChapterUrlsUI.CHAPTER_STATUS_DOWNLOADED: // Chapter is cached - show eye icon
                wrapper.className += " clickable-icon";
                wrapper.onclick = () => ChapterViewer.viewChapter(sourceUrl, title);
                row.classList.remove("error-state");
                ChapterUrlsUI.addMoreActionsMenu(row, sourceUrl, title);
                break;

            case ChapterUrlsUI.CHAPTER_STATUS_NONE: // Chapter not cached - show download icon
                wrapper.className += " clickable-icon";
                wrapper.onclick = async () => {
                    await ChapterCache.downloadChapter(sourceUrl, title, row);
                };
                row.classList.remove("error-state");
                break;

            case ChapterUrlsUI.CHAPTER_STATUS_ERROR: // Chapter failed to download - show error icon
                wrapper.className += " clickable-icon error-state";
                wrapper.onclick = () => ChapterViewer.viewChapter(sourceUrl, title);
                row.classList.add("error-state");
                ChapterUrlsUI.addMoreActionsMenu(row, sourceUrl, title);
                break;
        }
    }

    static setVisibileUI(toTable) {
        // toggle mode
        ChapterUrlsUI.getEditChaptersUrlsInput().hidden = toTable;
        ChapterUrlsUI.getChapterUrlsTable().hidden = !toTable;
        document.getElementById("inputSection").hidden = !toTable;
        document.getElementById("coverUrlSection").hidden = !toTable;
        document.getElementById("chapterSelectControlsDiv").hidden = !toTable;
        ChapterUrlsUI.modifyApplyChangesButtons(button => button.hidden = toTable);
        document.getElementById("editURLsHint").hidden = toTable;
        document.querySelector(".progressSection").hidden = !toTable;
        document.querySelector(".HiddenButtonSection").hidden = !toTable;
    }

    /** 
    * @private
    */
    setTableMode() {
        try {
            let inputValue = ChapterUrlsUI.getEditChaptersUrlsInput().value;
            let chapters;
            let lines = inputValue.split("\n");
            lines = lines.filter(a => a.trim() !== "").map(a => a.trim());
            if (URL.canParse(lines[0])) {
                chapters = this.URLsToChapters(lines);
            } else {
                chapters = this.htmlToChapters(inputValue);
            }
            this.parser.setPagesToFetch(chapters);
            this.populateChapterUrlsTable(chapters);
            this.usingTable = true;
            ChapterUrlsUI.setVisibileUI(this.usingTable);
        } catch (err) {
            ErrorLog.showErrorMessage(err);
        }
    }

    /** @private */
    reverseUrls() {
        try {
            let chapters = [...this.parser.getPagesToFetch().values()];
            chapters.reverse();
            this.populateChapterUrlsTable(chapters);
            this.parser.setPagesToFetch(chapters);
        } catch (err) {
            ErrorLog.showErrorMessage(err);
        }
    }

    /** 
    * @private
    */
    htmlToChapters(innerHtml) {
        let html = "<html><head><title></title><body>" + innerHtml + "</body></html>";
        let doc = util.sanitize(html);
        return [...doc.body.querySelectorAll("a")].map(a => util.hyperLinkToChapter(a));
    }

    /** 
    * @private
    */
    URLsToChapters(URLs) {
        return URLs.map(e => ({
            sourceUrl: e,
            title: "[placeholder]"
        }));
    }

    /** @private */
    copyUrlsToClipboard() {
        let text = this.chaptersToHTML([...this.parser.getPagesToFetch().values()]);
        navigator.clipboard.writeText(text);
    }

    /** @private */
    toggleShowUrlsForChapterRanges() {
        let chapters = [...this.parser.getPagesToFetch().values()];
        this.toggleShowUrlsForChapterRange(ChapterUrlsUI.getRangeStartChapterSelect(), chapters);
        this.toggleShowUrlsForChapterRange(ChapterUrlsUI.getRangeEndChapterSelect(), chapters);
        this.showHideChapterUrlsColumn();
    }
    
    showHideChapterUrlsColumn() {
        let hidden = !document.getElementById("showChapterUrlsCheckbox").checked;
        let table = ChapterUrlsUI.getChapterUrlsTable();
        for (let t of table.querySelectorAll(".chapter-url-column")) {
            t.hidden = hidden;
        }
    }

    toggleShowUrlsForChapterRange(select, chapters) {
        select.onchange = null;
        let memberForTextOption = ChapterUrlsUI.textToShowInRange();
        for (let o of [...select.querySelectorAll("Option")]) {
            o.text = chapters[o.index][memberForTextOption];
        }
        select.onchange = ChapterUrlsUI.onRangeChanged;
    }

    /** 
    * @private
    */
    setEditInputMode() {
        this.usingTable = false;
        ChapterUrlsUI.setVisibileUI(this.usingTable);
        let input = ChapterUrlsUI.getEditChaptersUrlsInput();
        input.rows = Math.max(this.parser.getPagesToFetch().size, 20);
        input.value = this.chaptersToHTML([...this.parser.getPagesToFetch().values()]);
    }

    chaptersToHTML(chapters) {
        let doc = util.sanitize("<html><head><title></title><body></body></html>");
        for (let chapter of chapters.filter(c => c.isIncludeable)) {
            doc.body.appendChild(this.makeLink(doc, chapter));
            doc.body.appendChild(doc.createTextNode("\r"));
        }
        return doc.body.innerHTML;
    }

    makeLink(doc, chapter) {
        let link = doc.createElement("a");
        link.href = chapter.sourceUrl;
        link.appendChild(doc.createTextNode(chapter.title));
        return link;
    }

    /** @private */
    static async updateRange(startRowIndex, endRowIndex, state) {
        let direction = startRowIndex < endRowIndex ? 1 : -1;
        let allRows = ChapterUrlsUI.getTableRowsWithChapters();
        
        // Set flag to prevent individual checkbox updates during bulk update
        ChapterUrlsUI._updatingSelectAll = true;
        
        // Collect library chapters that need caching
        let libraryChaptersToCache = [];
        
        for (let rowIndex = startRowIndex; rowIndex !== endRowIndex; rowIndex += direction) {
            if (rowIndex >= 0 && rowIndex < allRows.length) {
                let row = allRows[rowIndex];
                ChapterUrlsUI.setRowCheckboxState(row, state);
                
                // If selecting library chapters, collect them for bulk caching
                if (state && window.parser && window.parser.state && window.parser.state.webPages) {
                    let chapter = [...window.parser.state.webPages.values()][rowIndex];
                    if (chapter && chapter.isInBook && chapter.libraryBookId && chapter.libraryChapterIndex !== undefined) {
                        libraryChaptersToCache.push({chapter, row});
                    }
                }
            }
        }
        
        // Bulk cache library chapters
        if (libraryChaptersToCache.length > 0) {
            try {
                await Promise.all(libraryChaptersToCache.map(async ({chapter, row}) => {
                    try {
                        // Check if already cached
                        let cachedContent = await ChapterCache.get(chapter.sourceUrl);
                        if (!cachedContent) {
                            // Get library chapter content and cache it
                            let content = await LibraryBookData.getChapterContent(chapter.libraryBookId, chapter.libraryChapterIndex);
                            if (content) {
                                await ChapterCache.set(chapter.sourceUrl, content);
                                // Update visual status
                                ChapterUrlsUI.setChapterStatusVisuals(row, ChapterUrlsUI.CHAPTER_STATUS_DOWNLOADED, chapter.sourceUrl, chapter.title);
                            }
                        }
                    } catch (error) {
                        console.error("Failed to cache library chapter in bulk:", error);
                    }
                }));
            } catch (error) {
                console.error("Error in bulk caching:", error);
            }
        }
        
        // Clear flag and update select all checkbox state
        ChapterUrlsUI._updatingSelectAll = false;
        ChapterUrlsUI.updateSelectAllCheckboxState();
    }

    /** @private */
    static getTargetRow(target) {
        while (!target.classList.contains("chapter-row") && (target.parentElement !== null)) {
            target = target.parentElement;
        }
        return target;
    }

    /** @private */
    static tellUserAboutShiftClick(event, row) {
        if (event.shiftKey || (ChapterUrlsUI.lastSelectedRow === null)) {
            return;
        }
        if (ChapterUrlsUI.ConsecutiveRowClicks === 5) {
            return;
        }
        let distance = Math.abs(row.rowIndex - ChapterUrlsUI.lastSelectedRow);
        if (distance !== 1) {
            ChapterUrlsUI.ConsecutiveRowClicks = 0;
            return;
        }
        ++ChapterUrlsUI.ConsecutiveRowClicks;
        if (ChapterUrlsUI.ConsecutiveRowClicks === 5) {
            // TODO: make this not an alert, it's annoying
            alert(ChapterUrlsUI.UIText.shiftClickMessage);
        }
    }

    static Filters = {
        filterTermsFrequency: {},
        chapterList: {},
        init() {
            let rc = new ChapterUrlsUI.RangeCalculator();
            let filterTermsFrequency = {};
            let constantTerms = false; // To become a collection of all terms used in every link.
            const chapterList = ChapterUrlsUI.getTableRowsWithChapters().filter(item => rc.rowInRange(item)).map(item => {
                let filterObj =
                    {
                        row: item,
                        values: Array.from(item.querySelectorAll(".chapter-title-column, .chapter-url-column")).map(item => item.innerText).join("/").split("/"),
                        valueString: ""
                    };
                filterObj.values.push(item.querySelector("input[type=\"text\"]").value);
                filterObj.values = filterObj.values.filter(item => item.length > 3 && !item.startsWith("http"));
                filterObj.valueString = filterObj.values.join(" ");

                let recordFilterTerms = filterObj.valueString.toLowerCase().split(" ");
                recordFilterTerms.forEach(item => {
                    filterTermsFrequency[item] = (parseInt(filterTermsFrequency[item]) || 0) + 1;
                });

                if (!constantTerms) {
                    constantTerms = recordFilterTerms;
                } else {
                    constantTerms.filter(item => recordFilterTerms.indexOf(item) === -1).forEach(item => {
                        constantTerms.splice(constantTerms.indexOf(item), 1);
                    });
                }

                return filterObj;
            });
            let minFilterTermCount = Math.min( 3, chapterList.length * 0.10 );
            filterTermsFrequency = Object.keys(filterTermsFrequency)
                .filter(key => constantTerms.indexOf(key) === -1 && filterTermsFrequency[key] > minFilterTermCount)
                .map(key => ({ key: key, value: filterTermsFrequency[key] } ));

            var calcValue = function(filterTerm) {
                return filterTerm.value * filterTerm.key.length;
            };

            this.filterTermsFrequency = filterTermsFrequency.sort((a, b) => {
                var hasHigherValue = calcValue(a) < calcValue(b);
                var hasEqualValue = calcValue(a) == calcValue(b);
                return hasHigherValue ? 1 : hasEqualValue ? 0 : -1;
            });
            this.chapterList = chapterList;
        },
        Filter() {
            let rc = new ChapterUrlsUI.RangeCalculator();
            let formResults = Object.fromEntries(new FormData(document.getElementById("sbFiltersForm")));
            let formKeys = Object.keys(formResults);
            formResults = formKeys.filter(key => key.indexOf("Hidden") === -1)
                .map(key => {
                    return {
                        key: key,
                        searchType: formResults[key],
                        value: formResults[`${key}Hidden`]
                    };
                });

            let includeChaps = null;
            let excludeChaps = null;
            if (formResults.filter(item => item.searchType == 1).length > 0)
            {
                includeChaps = new RegExp(formResults.filter(item => item.searchType == 1).map(item => item.value).join("|"), "i");
            }
            if (formResults.filter(item => item.searchType == -1).length > 0)
            {
                excludeChaps = new RegExp(formResults.filter(item => item.searchType == -1).map(item => item.value).join("|"), "i");
            }

            ChapterUrlsUI.Filters.chapterList.forEach(item =>{
                let showChapter = rc.rowInRange(item.row);
                if (includeChaps)
                {
                    showChapter = showChapter && includeChaps.test(item.valueString);
                }
                if (excludeChaps)
                {
                    showChapter = showChapter && !excludeChaps.test(item.valueString);
                }
                ChapterUrlsUI.setRowCheckboxState(item.row, showChapter);
                item.row.hidden = !showChapter;
            });
            document.getElementById("spanChapterCount").textContent = ChapterUrlsUI.Filters.chapterList.filter(item => !item.row.hidden).length;
        },
        generateFiltersTable() {
            let retVal = document.createElement("table");

            let onClickEvent = function(event) {
                if (event == undefined || event == null) {
                    return;
                }

                if (event.target.classList.contains("exclude"))
                {
                    event.target.checked = false;
                    event.target.classList.remove("exclude");
                    event.target.value = 1;
                }
                else if (!event.target.indeterminate && !event.target.checked)
                {
                    event.target.value = -1;
                    event.target.checked = true;
                    event.target.indeterminate = true;
                    event.target.classList.add("exclude");
                }

                ChapterUrlsUI.Filters.Filter();
            };

            let row = document.createElement("tr");
            let col = document.createElement("td");
            let checkboxId = "chkFilterText";
            let el = document.createElement("input");
            el.type = "checkbox";
            el.name = checkboxId;
            el.id = checkboxId;
            el.value = 1;
            el.onclick = onClickEvent;
            el.onchange = function(event) {
                if (event == undefined || event == null) {
                    return;
                }
                event.target.parentElement.nextElementSibling.firstChild.disabled = !event.target.checked;
                ChapterUrlsUI.Filters.Filter();
            };
            col.appendChild(el);
            row.appendChild(col);
            col = document.createElement("td");
            el = document.createElement("input");
            el.type = "text";
            el.disabled = true;
            el.id = checkboxId + "Text";
            el.onchange = function(event) { event.target.nextElementSibling.value = event.target.value; ChapterUrlsUI.Filters.Filter(); };
            col.appendChild(el);
            el = document.createElement("input");
            el.type = "hidden";
            el.id = checkboxId + "Hidden";
            el.name = checkboxId + "Hidden";
            col.appendChild(el);
            row.appendChild(col);

            retVal.appendChild(row);

            ChapterUrlsUI.Filters.filterTermsFrequency.forEach((value, id) => {
                row = document.createElement("tr");
                col = document.createElement("td");
                col.classList.add("filter-checkbox-col");
                
                checkboxId = "chkFilter" + id;
                let el = document.createElement("input");
                el.type = "checkbox";
                el.name = checkboxId;
                el.id = checkboxId;
                el.value = 1;
                el.onclick = onClickEvent;
                col.appendChild(el);
                
                el = document.createElement("input");
                el.type = "hidden";
                el.name = checkboxId+"Hidden";
                el.value = RegExp.escape(value.key);
                col.appendChild(el);
                row.appendChild(col);

                col = document.createElement("td");
                el = document.createElement("label");
                el.innerText = value.key;
                el.id = checkboxId + "Label";
                el.setAttribute("for", checkboxId);
                el.classList.add("filter-label");
                col.appendChild(el);
                row.appendChild(col);

                retVal.appendChild(row);
            });
            retVal.classList.add("filter-table");
            return retVal;
        }
    };

    /**
     * Set up the header more actions menu
     */
    static setupHeaderMoreActions(chapters) {
        let headerMoreActionsIcon = document.getElementById("headerMoreActionsIcon");
        let headerMoreActionsMenu = document.getElementById("headerMoreActionsMenu");
        let downloadSelectedCacheIcon = document.getElementById("downloadSelectedCacheIcon");
        let downloadSelectedHtmlIcon = document.getElementById("downloadSelectedHtmlIcon");
        let deleteSelectedCachedIcon = document.getElementById("deleteSelectedCachedIcon");
        let deleteAllCachedIcon = document.getElementById("deleteAllCachedIcon");
        
        // Set up icons if not already done
        if (headerMoreActionsIcon && headerMoreActionsIcon.children.length === 0) {
            headerMoreActionsIcon.appendChild(SvgIcons.createSvgElement(SvgIcons.THREE_DOTS_VERTICAL));
        }
        
        if (downloadSelectedCacheIcon && downloadSelectedCacheIcon.children.length === 0) {
            downloadSelectedCacheIcon.appendChild(SvgIcons.createSvgElement(SvgIcons.DOWNLOAD));
        }
        
        if (deleteSelectedCachedIcon && deleteSelectedCachedIcon.children.length === 0) {
            deleteSelectedCachedIcon.appendChild(SvgIcons.createSvgElement(SvgIcons.TRASH3_FILL));
        }
        
        if (deleteAllCachedIcon && deleteAllCachedIcon.children.length === 0) {
            deleteAllCachedIcon.appendChild(SvgIcons.createSvgElement(SvgIcons.TRASH3_FILL));
        }

        if (downloadSelectedHtmlIcon && downloadSelectedHtmlIcon.children.length === 0) {
            downloadSelectedHtmlIcon.appendChild(SvgIcons.createSvgElement(SvgIcons.DOWNLOAD));
        }
        
        // Set up click handler for the three dots icon
        let headerMoreActionsWrapper = document.getElementById("headerMoreActionsWrapper");
        if (headerMoreActionsWrapper) {
            headerMoreActionsWrapper.onclick = (e) => {
                e.stopPropagation();
                ChapterUrlsUI.toggleHeaderMoreActionsMenu(headerMoreActionsMenu);
            };
        }
        
        // Set up download selected chapters to cache handler
        let downloadSelectedCacheItem = document.getElementById("downloadSelectedChaptersCache");
        if (downloadSelectedCacheItem) {
            downloadSelectedCacheItem.onclick = async (e) => {
                e.stopPropagation();
                await ChapterUrlsUI.downloadSelectedChaptersToCache(chapters);
                ChapterUrlsUI.hideHeaderMoreActionsMenu(headerMoreActionsMenu);
            };
        }
        
        // Set up download selected chapters as HTML handler
        let downloadSelectedHtmlItem = document.getElementById("downloadSelectedChaptersHtml");
        if (downloadSelectedHtmlItem) {
            downloadSelectedHtmlItem.onclick = async (e) => {
                e.stopPropagation();
                await ChapterUrlsUI.downloadSelectedChaptersAsHtml(chapters);
                ChapterUrlsUI.hideHeaderMoreActionsMenu(headerMoreActionsMenu);
            };
        }
        
        // Set up delete selected cached chapters handler
        let deleteSelectedCachedItem = document.getElementById("deleteSelectedCachedChaptersMenuItem");
        if (deleteSelectedCachedItem) {
            deleteSelectedCachedItem.onclick = async (e) => {
                e.stopPropagation();
                await ChapterUrlsUI.deleteSelectedCachedChapters(chapters);
                ChapterUrlsUI.hideHeaderMoreActionsMenu(headerMoreActionsMenu);
            };
        }
        
        // Set up delete all cached chapters handler
        let deleteAllCachedItem = document.getElementById("deleteAllCachedChaptersMenuItem");
        if (deleteAllCachedItem) {
            deleteAllCachedItem.onclick = async (e) => {
                e.stopPropagation();
                await ChapterCache.deleteAllCachedChapters(chapters);
                ChapterUrlsUI.hideHeaderMoreActionsMenu(headerMoreActionsMenu);
            };
        }
        
        // Close menu when clicking outside
        document.addEventListener("click", () => ChapterUrlsUI.hideHeaderMoreActionsMenu(headerMoreActionsMenu));
    }

    /**
     * Toggle header more actions menu visibility
     */
    static toggleHeaderMoreActionsMenu(menu) {
        // Hide all other open menus first
        document.querySelectorAll(".more-actions-menu.show, .header-more-actions-menu.show").forEach(m => {
            if (m !== menu) m.classList.remove("show");
        });
        
        menu.classList.toggle("show");
    }

    /**
     * Hide header more actions menu
     */
    static hideHeaderMoreActionsMenu(menu) {
        menu.classList.remove("show");
    }

    /**
     * Download selected chapters as HTML files
     */
    static async downloadSelectedChaptersAsHtml(chapters) {
        try {
            let selectedChapters = ChapterUrlsUI.getSelectedChapters(chapters);
            
            if (selectedChapters.length === 0) {
                alert("No chapters selected for download.");
                return;
            }
            
            let count = 0;
            let errors = [];
            
            for (let chapter of selectedChapters) {
                try {
                    await ChapterCache.downloadSingleChapterAsFile(chapter.sourceUrl, chapter.title);
                    count++;
                } catch (error) {
                    console.error(`Failed to download chapter "${chapter.title}":`, error);
                    errors.push(`${chapter.title}: ${error.message}`);
                }
            }
            
            // Show errors if any occurred
            if (errors.length > 0) {
                let message = `Errors occurred while downloading chapters:\n${errors.join('\n')}`;
                alert(message);
            }
            
        } catch (error) {
            console.error("Error downloading selected chapters:", error);
            alert("Failed to download selected chapters: " + error.message);
        }
    }

    /**
     * Get selected chapters from the chapter list
     */
    static getSelectedChapters(chapters) {
        let selected = [];
        let rows = document.querySelectorAll('.chapter-row');
        
        rows.forEach((row, index) => {
            let checkbox = row.querySelector('input[type="checkbox"]');
            if (checkbox && checkbox.checked && chapters[index]) {
                selected.push(chapters[index]);
            }
        });
        
        return selected;
    }

    /**
     * Download selected chapters to cache
     */
    static async downloadSelectedChaptersToCache(chapters) {
        try {
            let selectedChapters = ChapterUrlsUI.getSelectedChapters(chapters);
            
            if (selectedChapters.length === 0) {
                alert("No chapters selected for download.");
                return;
            }
            
            // Get the parser from main.js global scope
            if (typeof parser === "undefined") {
                throw new Error("Parser not available");
            }
            
            // Temporarily store the original webPages
            let originalWebPages = new Map(parser.state.webPages);
            
            try {
                // Set parser state to only include selected chapters
                parser.state.webPages.clear();
                selectedChapters.forEach((chapter, index) => {
                    // Find the original chapter in the webPages map
                    for (let [key, originalChapter] of originalWebPages) {
                        if (originalChapter.sourceUrl === chapter.sourceUrl) {
                            parser.state.webPages.set(key, originalChapter);
                            break;
                        }
                    }
                });
                
                // Call main.js downloadChapters function which handles proper button state management
                await main.downloadChapters();
                
            } finally {
                // Always restore the original webPages state
                parser.state.webPages = originalWebPages;
            }
            
        } catch (error) {
            console.error("Error downloading selected chapters to cache:", error);
            alert("Failed to download selected chapters: " + error.message);
        }
    }

    /**
     * Delete selected cached chapters
     */
    static async deleteSelectedCachedChapters(chapters) {
        try {
            let selectedChapters = ChapterUrlsUI.getSelectedChapters(chapters);
            
            if (selectedChapters.length === 0) {
                alert("No chapters selected for deletion.");
                return;
            }
            
            // Filter to only cached chapters
            let cachedChapters = [];
            for (let chapter of selectedChapters) {
                let cachedContent = await ChapterCache.get(chapter.sourceUrl);
                if (cachedContent) {
                    cachedChapters.push(chapter);
                }
            }
            
            if (cachedChapters.length === 0) {
                alert("No cached chapters found among selected chapters.");
                return;
            }
            
            // Confirm deletion
            let confirmMessage = `Delete ${cachedChapters.length} cached chapter${cachedChapters.length > 1 ? 's' : ''}?`;
            if (!confirm(confirmMessage)) {
                return;
            }
            
            let deletedCount = 0;
            let errors = [];
            
            for (let chapter of cachedChapters) {
                try {
                    await ChapterCache.deleteChapter(chapter.sourceUrl);
                    deletedCount++;
                    
                    // Update the visual status of the chapter row
                    let row = ChapterUrlsUI.findRowBySourceUrl(chapter.sourceUrl);
                    if (row) {
                        await ChapterUrlsUI.setChapterStatusVisuals(row, ChapterUrlsUI.CHAPTER_STATUS_NONE, chapter.sourceUrl, chapter.title);
                    }
                } catch (error) {
                    console.error(`Failed to delete cached chapter "${chapter.title}":`, error);
                    errors.push(`${chapter.title}: ${error.message}`);
                }
            }
            
            // Update delete button visibility
            await ChapterUrlsUI.updateDeleteCacheButtonVisibility();
            
            // Show errors if any occurred
            if (errors.length > 0) {
                let message = `Errors occurred while deleting cached chapters:\n${errors.join('\n')}`;
                alert(message);
            }
            
        } catch (error) {
            console.error("Error deleting selected cached chapters:", error);
            alert("Failed to delete selected cached chapters: " + error.message);
        }
    }

    /**
     * Refresh a library chapter by updating its content in the actual library book
     * @param {Object} chapter - Chapter object with libraryBookId and libraryChapterIndex
     * @param {HTMLElement} row - The table row element
     */
    static async refreshLibraryChapter(chapter, row) {
        try {
            if (!chapter.sourceUrl || chapter.sourceUrl.startsWith('library://')) {
                alert("Cannot refresh library-only chapters (no source URL)");
                return;
            }

            if (!confirm(`Refresh "${chapter.title}" in the library book with new content from the website?\n\nThis will permanently update the chapter in your library.`)) {
                return;
            }

            console.log(`Refreshing library chapter: ${chapter.title}`);
            
            // Update UI to show refreshing state
            ChapterUrlsUI.setChapterStatusVisuals(row, ChapterUrlsUI.CHAPTER_STATUS_DOWNLOADING, chapter.sourceUrl, chapter.title);

            // Use the LibraryBookData method to refresh the chapter
            await LibraryBookData.refreshChapterInBook(
                chapter.libraryBookId,
                chapter.libraryChapterIndex,
                chapter.sourceUrl
            );

            // Update UI to show success - keep the eye icon since it's still in the library
            ChapterUrlsUI.setChapterStatusVisuals(row, ChapterUrlsUI.CHAPTER_STATUS_DOWNLOADED, chapter.sourceUrl, chapter.title);
            
            alert(`Successfully refreshed "${chapter.title}" in the library book.`);

        } catch (error) {
            console.error("Failed to refresh library chapter:", error);
            ChapterUrlsUI.setChapterStatusVisuals(row, ChapterUrlsUI.CHAPTER_STATUS_ERROR, chapter.sourceUrl, chapter.title);
            alert("Failed to refresh library chapter: " + error.message);
        }
    }

    /**
     * Delete a library chapter from the actual library book
     * @param {Object} chapter - Chapter object with libraryBookId and libraryChapterIndex  
     * @param {HTMLElement} row - The table row element
     */
    static async deleteLibraryChapter(chapter, row) {
        try {
            if (!confirm(`Delete "${chapter.title}" from the library book?\n\nThis will permanently remove the chapter from your library and cannot be undone.`)) {
                return;
            }

            console.log(`Deleting library chapter: ${chapter.title}`);
            
            // Update UI to show deleting state
            ChapterUrlsUI.setChapterStatusVisuals(row, ChapterUrlsUI.CHAPTER_STATUS_DOWNLOADING, chapter.sourceUrl, chapter.title);

            // Use the LibraryBookData method to delete the chapter
            await LibraryBookData.deleteChapterFromBook(
                chapter.libraryBookId,
                chapter.libraryChapterIndex
            );

            // Update the chapter list by reloading the library book
            await LibraryBookData.loadLibraryBookInMainUI(chapter.libraryBookId);
            
            alert(`Successfully deleted "${chapter.title}" from the library book.`);

        } catch (error) {
            console.error("Failed to delete library chapter:", error);
            ChapterUrlsUI.setChapterStatusVisuals(row, ChapterUrlsUI.CHAPTER_STATUS_ERROR, chapter.sourceUrl, chapter.title);
            alert("Failed to delete library chapter: " + error.message);
        }
    }
}
ChapterUrlsUI.RangeCalculator = class {
    constructor()
    {
        this.startIndex = ChapterUrlsUI.getRangeStartChapterSelect().selectedIndex;
        this.endIndex = ChapterUrlsUI.getRangeEndChapterSelect().selectedIndex;
    }
    rowInRange(row) {
        let index = row.rowIndex;
        return (this.startIndex <= index) && (index <= this.endIndex);
    }
};


ChapterUrlsUI.CHAPTER_STATUS_NONE = 0;
ChapterUrlsUI.CHAPTER_STATUS_DOWNLOADING = 1;
ChapterUrlsUI.CHAPTER_STATUS_DOWNLOADED = 2;
ChapterUrlsUI.CHAPTER_STATUS_SLEEPING = 3;
ChapterUrlsUI.CHAPTER_STATUS_ERROR = 4;
ChapterUrlsUI.TooltipForState = [
    ChapterUrlsUI.UIText.tooltipDownloadChapter,
    ChapterUrlsUI.UIText.tooltipChapterDownloading,
    ChapterUrlsUI.UIText.tooltipViewChapter,
    ChapterUrlsUI.UIText.tooltipChapterSleeping,
    "Download failed - click to view error"
];

ChapterUrlsUI.lastSelectedRow = null;
ChapterUrlsUI.ConsecutiveRowClicks = 0;
