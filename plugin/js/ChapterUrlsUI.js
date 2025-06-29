"use strict";

/** Class that handles UI for selecting (chapter) URLs to fetch */
class ChapterUrlsUI {
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
        ChapterUrlsUI.modifyCancelEditButtons(button => button.onclick = this.cancelEditMode.bind(this));
    }

    populateChapterUrlsTable(chapters) {
        ChapterUrlsUI.clearChapterUrlsTable();
        ChapterUrlsUI.setupHeaderMoreActions(chapters);

        this.updateChapterListIncrementally(chapters);

        // Set up chapter select info icon
        let chapterSelectInfo = document.getElementById("chapterSelectInfo");
        if (chapterSelectInfo && chapterSelectInfo.children.length === 0) {
            chapterSelectInfo.appendChild(SvgIcons.createSvgElement(SvgIcons.INFO_FILL));
        }
    }

    static addChapterToList(chapter, index) {
        let chapterList = ChapterUrlsUI.getChapterUrlsTable();
        let row = document.createElement("div");
        row.className = "chapter-row";
        row.rowIndex = index;
        
        // Ensure chapterListIndex is set to track UI list position
        chapter.chapterListIndex = index;
        
        ChapterUrlsUI.appendCheckBoxToRow(row, chapter);
        ChapterUrlsUI.appendInputTextToRow(row, chapter);
        chapter.row = row;
        ChapterUrlsUI.appendColumnDataToRow(row, chapter);
        ChapterUrlsUI.appendChapterStatusColumnToRow(row, chapter).then();
        ChapterUrlsUI.updateChapterSelected(chapter, row);
        chapterList.appendChild(row);
        return row;
    }

    static updateChapterSelected(chapter, row) {
        // Update checkbox state - preserve existing user selections,
        // only set defaults for new chapters
        let checkbox = row.querySelector("input[type=\"checkbox\"]");
        if (checkbox) {
            // Preserve existing user selections (don't override if user has already made a choice)
            if (chapter.isIncludeable === undefined) {
                // Use ChapterInclusionLogic for consistent inclusion logic
                // Library mode chapters have source property
                let isLibraryMode = chapter.source !== undefined;
                chapter.isIncludeable = ChapterInclusionLogic.shouldChapterBeIncluded(
                    chapter.source || "unknown",
                    isLibraryMode,
                    chapter.isIncludeable
                );
            }
            checkbox.checked = chapter.isIncludeable;
            checkbox.disabled = false; // All chapters are selectable
        }
    }

    /**
     * Update chapter table incrementally instead of full re-render
     * @param {Array} newChapters - New or updated chapters to merge
     */
    updateChapterListIncrementally(newChapters) {
        ChapterUrlsUI.getPleaseWaitMessageRow().hidden = true;
        let chapterList = ChapterUrlsUI.getChapterUrlsTable();
        let existingRows = Array.from(chapterList.querySelectorAll(".chapter-row"));

        // Update existing rows and add new ones
        newChapters.forEach((chapter, index) => {
            // Add chapterListIndex to track UI list position (distinct from epubSpineIndex spine position)
            chapter.chapterListIndex = index;
            
            let existingRow = existingRows[index];
            
            if (existingRow) {
                // Update existing row
                this.updateExistingChapterRow(existingRow, chapter, index);
            } else {
                // Create new row
                ChapterUrlsUI.addChapterToList(chapter, index);
            }
        });

        // Remove extra rows if we have fewer chapters now
        for (let i = newChapters.length; i < existingRows.length; i++) {
            existingRows[i].remove();
        }

        ChapterUrlsUI.updateChapterSelectRange(newChapters);

        this.showHideChapterUrlsColumn();
        ChapterUrlsUI.updateSelectAllCheckboxState();
    }

    static updateChapterSelectRange(chapterList) {
        let rangeStart = ChapterUrlsUI.getRangeStartChapterSelect();
        let rangeEnd = ChapterUrlsUI.getRangeEndChapterSelect();
        let memberForTextOption = ChapterUrlsUI.textToShowInRange();

        // Clear existing range options
        rangeStart.innerHTML = "";
        rangeEnd.innerHTML = "";

        chapterList.forEach(function(chapter, index) {
            // Add to range selectors
            ChapterUrlsUI.appendOptionToSelect(rangeStart, index, chapter, memberForTextOption);
            ChapterUrlsUI.appendOptionToSelect(rangeEnd, index, chapter, memberForTextOption);
        });
        ChapterUrlsUI.setRangeOptionsToFirstAndLastChapters();
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
        ChapterUrlsUI.updateChapterSelected(chapter, row);

        // Update title
        let titleInput = row.querySelector(".chapter-title-column input");
        if (titleInput) {
            titleInput.value = chapter.title;
        }
        
        // Update source URL display - use input field like normal mode but disabled
        let urlColumn = row.querySelector(".chapter-url-column");
        if (urlColumn) {
            let urlInput = urlColumn.querySelector("input[type=\"url\"]");
            if (urlInput) {
                // Update existing input
                urlInput.value = chapter.sourceUrl || "";
                urlInput.disabled = true; // Disable editing in library mode
            } else {
                // Create input if it doesn't exist (should match normal mode structure)
                urlColumn.textContent = ""; // Clear any existing text content
                let input = document.createElement("input");
                input.type = "url";
                input.value = chapter.sourceUrl || "";
                input.disabled = true; // Disable editing in library mode
                urlColumn.appendChild(input);
            }
        }

        this.updateChapterStatusColumn(row, chapter);
    }

    /**
     * Update chapter status column with library-specific indicators and interactive functionality
     * @param {HTMLElement} row - Chapter row element
     * @param {Object} chapter - Chapter data
     */
    updateChapterStatusColumn(row, chapter) {
        // Remove all existing status columns from the row
        let statusColumns = row.querySelectorAll(".chapter-status-column");
        statusColumns.forEach(col => col.remove());
        
        // Re-create the status column using existing method
        ChapterUrlsUI.appendChapterStatusColumnToRow(row, chapter).then();
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
                let rows = document.querySelectorAll(".chapter-row");
                let row = Array.from(rows).find(r => r.rowIndex === index);

                if (row && chapter.isInBook) {
                    // Use setChapterStatusVisuals to handle library chapters properly
                    ChapterUrlsUI.setChapterStatusVisuals(row, ChapterUrlsUI.CHAPTER_STATUS_LIBRARY, chapter.sourceUrl, chapter.title);
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
            let message = UIText.Chapter.maxChaptersSelected.replace("$1", 
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
        document.getElementById("spanChapterCount").textContent = count.toString();
    }
    
    /** @private */
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

    /** @private */
    static modifyApplyChangesButtons(mutator) {
        mutator(document.getElementById("applyChangesButton"));
        mutator(document.getElementById("applyChangesButton2"));
    }

    /** @private */
    static modifyCancelEditButtons(mutator) {
        mutator(document.getElementById("cancelEditButton"));
        mutator(document.getElementById("cancelEditButton2"));
    }

    /** @private */
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

        let allRows = ChapterUrlsUI.getTableRowsWithChapters();
        
        for (let i = 0; i < allRows.length; i++) {
            let row = allRows[i];
            ChapterUrlsUI.setRowCheckboxState(row, select);
            row.hidden = false;
        }
        
        ChapterUrlsUI.setRangeOptionsToFirstAndLastChapters();

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

        let allRows = ChapterUrlsUI.getTableRowsWithChapters();
        
        // Only affect chapters in the current range
        let rc = new ChapterUrlsUI.RangeCalculator();
        for (let i = 0; i < allRows.length; i++) {
            let row = allRows[i];
            if (rc.rowInRange(row)) {
                ChapterUrlsUI.setRowCheckboxState(row, newState);
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
                chapter.source || "unknown", 
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
        let urlInput = urlCell.querySelector("input[type=\"url\"]");
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

    /** @private */
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

    /** @private */
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
    * Update visibility of header more actions menu items
    */
    static updateHeaderMoreActionsVisibility() {
        let headerMoreActions = document.getElementById("headerMoreActionsWrapper");
        let headerMoreActionsMenu = document.getElementById("headerMoreActionsMenu");
        
        if (headerMoreActions && headerMoreActionsMenu) {
            // Always show the menu
            headerMoreActions.style.display = "block";
            
            // Check for library mode first
            let isLibraryMode = window.currentLibraryBook && window.currentLibraryBook.id;
            
            // Check for cached chapters by looking at visual state (much faster than cache queries)
            let hasCachedChapters = false;
            if (!isLibraryMode) {
                // Look for checkboxes with successBox class (indicates cached content)
                // or rows with error-state class (indicates cached error content)
                let cachedCheckboxes = document.querySelectorAll(".chapterSelectCheckbox.successBox");
                let errorRows = document.querySelectorAll(".chapter-row.error-state");
                hasCachedChapters = cachedCheckboxes.length > 0 || errorRows.length > 0;
            }
            
            // Show/hide cache-dependent items based on whether we have cached chapters
            let showCacheItems = isLibraryMode || hasCachedChapters;
            if (showCacheItems) {
                headerMoreActionsMenu.classList.remove("cache-items-hidden");
            } else {
                headerMoreActionsMenu.classList.add("cache-items-hidden");
            }
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
        refreshText.textContent = UIText.Chapter.menuRefreshChapter;
        refreshItem.appendChild(refreshIcon);
        refreshItem.appendChild(refreshText);
        refreshItem.onclick = async (e) => {
            e.stopPropagation();
            // Check if this is a library chapter and handle accordingly
            if (chapter && chapter.isInBook && chapter.libraryBookId && chapter.epubSpineIndex !== undefined) {
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
        openUrlText.textContent = UIText.Chapter.menuOpenChapterURL;
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
        deleteText.textContent = UIText.Chapter.menuDeleteChapter;
        deleteItem.appendChild(deleteIcon);
        deleteItem.appendChild(deleteText);
        deleteItem.onclick = async (e) => {
            e.stopPropagation();
            await ChapterUrlsUI.deleteChapter(chapter, row);
            ChapterUrlsUI.hideMoreActionsMenu(menu);
        };
        
        // DOWNLOAD HTML FILE option
        let downloadItem = document.createElement("div");
        downloadItem.className = "menu-item";
        let downloadIcon = SvgIcons.createSvgElement(SvgIcons.DOWNLOAD);
        let downloadText = document.createElement("span");
        downloadText.textContent = UIText.Chapter.menuDownloadChapter;
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
            [ChapterUrlsUI.CHAPTER_STATUS_ERROR]: SvgIcons.EYE_FILL,
            [ChapterUrlsUI.CHAPTER_STATUS_LIBRARY]: SvgIcons.BOOK
        };
        
        let iconElement = SvgIcons.createSvgElement(svgConstants[state]);
        iconElement.classList.add("chapter-status-icon");
        if (state === ChapterUrlsUI.CHAPTER_STATUS_LIBRARY) {
            iconElement.classList.add("library-chapter-view-icon");
        }
        return iconElement;
    }

    /**
     * Find a chapter row by sourceUrl
     */
    static findRowBySourceUrl(sourceUrl) {
        const rows = document.querySelectorAll(".chapter-row");
        for (let row of rows) {
            const urlInput = row.querySelector("input[type=\"url\"]");
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
        
        // Remove all state-specific classes before applying new state
        row.classList.remove("error-state", "chapter-in-library", "chapter-new-on-website");
        
        // Apply state-specific behavior and styling
        switch (state) {
            case ChapterUrlsUI.CHAPTER_STATUS_DOWNLOADED: // Chapter is cached - show eye icon
                wrapper.className += " clickable-icon";
                wrapper.onclick = () => ChapterViewer.viewChapter(sourceUrl, title);
                ChapterUrlsUI.addMoreActionsMenu(row, sourceUrl, title);
                break;

            case ChapterUrlsUI.CHAPTER_STATUS_NONE: // Chapter not cached - show download icon
                wrapper.className += " clickable-icon";
                wrapper.onclick = async () => {
                    await ChapterCache.downloadChapter(sourceUrl, title, row);
                };
                break;

            case ChapterUrlsUI.CHAPTER_STATUS_ERROR: // Chapter failed to download - show error icon
                wrapper.className += " clickable-icon error-state";
                wrapper.onclick = () => ChapterViewer.viewChapter(sourceUrl, title);
                row.classList.add("error-state");
                ChapterUrlsUI.addMoreActionsMenu(row, sourceUrl, title);
                break;

            case ChapterUrlsUI.CHAPTER_STATUS_LIBRARY: // Chapter is in library - show book icon
                wrapper.className += " clickable-icon";
                wrapper.onclick = (e) => {
                    e.stopPropagation();
                    // Find the chapter data to get library information
                    let chapter = null;
                    if (window.parser && window.parser.state && window.parser.state.webPages) {
                        chapter = [...window.parser.state.webPages.values()].find(ch => ch.sourceUrl === sourceUrl);
                    }
                    if (chapter && chapter.libraryBookId && chapter.epubSpineIndex !== undefined) {
                        ChapterViewer.openLibraryChapter(chapter.libraryBookId, chapter.epubSpineIndex);
                    }
                };
                row.classList.add("chapter-in-library");
                ChapterUrlsUI.addMoreActionsMenu(row, sourceUrl, title);
                break;
        }

        this.updateHeaderMoreActionsVisibility();
    }

    static setVisibleUI(toTable) {
        if (toTable) {
            // Table mode - restore normal UI sections
            if (ChapterUrlsUI.restoreSections) {
                ChapterUrlsUI.restoreSections();
                ChapterUrlsUI.restoreSections = null;
            }
        } else {
            ChapterUrlsUI.restoreSections = main.hideAllSectionsExcept("bulkEditSection");
        }
    }

    /** @private */
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
            ChapterUrlsUI.setVisibleUI(this.usingTable);
        } catch (err) {
            ErrorLog.showErrorMessage(err);
        }
    }

    /** @private */
    cancelEditMode() {
        // Switch back to table mode without saving changes
        this.usingTable = true;
        ChapterUrlsUI.setVisibleUI(this.usingTable);
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

    /** @private */
    htmlToChapters(innerHtml) {
        let html = "<html><head><title></title><body>" + innerHtml + "</body></html>";
        let doc = util.sanitize(html);
        return [...doc.body.querySelectorAll("a")].map(a => util.hyperLinkToChapter(a));
    }

    /** @private */
    URLsToChapters(URLs) {
        return URLs.map(e => ({
            sourceUrl: e,
            title: "[placeholder]"
        }));
    }

    /** @private */
    copyUrlsToClipboard() {
        let text = this.chaptersToHTML([...this.parser.getPagesToFetch().values()]);
        navigator.clipboard.writeText(text).then();
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

    /** @private */
    setEditInputMode() {
        this.usingTable = false;
        ChapterUrlsUI.setVisibleUI(this.usingTable);
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

        for (let rowIndex = startRowIndex; rowIndex !== endRowIndex; rowIndex += direction) {
            if (rowIndex >= 0 && rowIndex < allRows.length) {
                let row = allRows[rowIndex];
                ChapterUrlsUI.setRowCheckboxState(row, state);
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
        let userPreferences = main.getUserPreferences();
        if (userPreferences && userPreferences.disableShiftClickAlert.value) {
            return;
        }
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
            alert(UIText.Chapter.shiftClickMessage);
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

            let calcValue = function(filterTerm) {
                return filterTerm.value * filterTerm.key.length;
            };

            this.filterTermsFrequency = filterTermsFrequency.sort((a, b) => {
                let hasHigherValue = calcValue(a) < calcValue(b);
                let hasEqualValue = calcValue(a) === calcValue(b);
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
                if (!event) { return; }

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

    /** @private */
    static setupHeaderMoreActions(chapters) {
        let headerMoreActionsIcon = document.getElementById("headerMoreActionsIcon");
        let headerMoreActionsMenu = document.getElementById("headerMoreActionsMenu");
        let downloadSelectedHtmlIcon = document.getElementById("downloadSelectedHtmlIcon");
        let deleteSelectedChaptersIcon = document.getElementById("deleteSelectedChaptersIcon");
        let deleteAllChaptersIcon = document.getElementById("deleteAllChaptersIcon");
        
        // Set up icons if not already done
        if (headerMoreActionsIcon && headerMoreActionsIcon.children.length === 0) {
            headerMoreActionsIcon.appendChild(SvgIcons.createSvgElement(SvgIcons.THREE_DOTS_VERTICAL));
        }
        
        
        if (deleteSelectedChaptersIcon && deleteSelectedChaptersIcon.children.length === 0) {
            deleteSelectedChaptersIcon.appendChild(SvgIcons.createSvgElement(SvgIcons.TRASH3_FILL));
        }
        
        if (deleteAllChaptersIcon && deleteAllChaptersIcon.children.length === 0) {
            deleteAllChaptersIcon.appendChild(SvgIcons.createSvgElement(SvgIcons.TRASH3_FILL));
        }

        if (downloadSelectedHtmlIcon && downloadSelectedHtmlIcon.children.length === 0) {
            downloadSelectedHtmlIcon.appendChild(SvgIcons.createSvgElement(SvgIcons.DOWNLOAD));
        }

        // Set up reorder chapters icon
        let reorderChaptersIcon = document.getElementById("reorderChaptersIcon");
        if (reorderChaptersIcon && reorderChaptersIcon.children.length === 0) {
            reorderChaptersIcon.appendChild(SvgIcons.createSvgElement(SvgIcons.FILTER));
        }

        // Set up download library book icon
        let downloadLibraryBookIcon = document.getElementById("downloadLibraryBookIcon");
        if (downloadLibraryBookIcon && downloadLibraryBookIcon.children.length === 0) {
            downloadLibraryBookIcon.appendChild(SvgIcons.createSvgElement(SvgIcons.DOWNLOAD));
        }

        // Set up toggle library chapters icon and initialize its state
        let toggleLibraryChaptersIcon = document.getElementById("toggleLibraryChaptersIcon");
        if (toggleLibraryChaptersIcon && toggleLibraryChaptersIcon.children.length === 0) {
            // Initialize the toggle menu state (this will set the correct icon and text)
            ChapterUrlsUI.initializeLibraryChaptersToggle();
        }

        // Set up delete library book icon
        let deleteLibraryBookIcon = document.getElementById("deleteLibraryBookIcon");
        if (deleteLibraryBookIcon && deleteLibraryBookIcon.children.length === 0) {
            deleteLibraryBookIcon.appendChild(SvgIcons.createSvgElement(SvgIcons.TRASH3_FILL));
        }

        // Set up export JSON icon
        let exportJsonIcon = document.getElementById("exportJsonIcon");
        if (exportJsonIcon && exportJsonIcon.children.length === 0) {
            exportJsonIcon.appendChild(SvgIcons.createSvgElement(SvgIcons.FILE_EARMARK_CHECK));
        }
        
        // Set up click handler for the three dots icon
        let headerMoreActionsWrapper = document.getElementById("headerMoreActionsWrapper");
        if (headerMoreActionsWrapper) {
            headerMoreActionsWrapper.onclick = (e) => {
                e.stopPropagation();
                ChapterUrlsUI.toggleHeaderMoreActionsMenu(headerMoreActionsMenu);
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
        let deleteSelectedCachedItem = document.getElementById("deleteSelectedChaptersMenuItem");
        if (deleteSelectedCachedItem) {
            deleteSelectedCachedItem.onclick = async (e) => {
                e.stopPropagation();
                await ChapterUrlsUI.deleteSelectedCachedChapters(chapters);
                ChapterUrlsUI.hideHeaderMoreActionsMenu(headerMoreActionsMenu);
            };
        }
        
        // Set up delete all cached chapters handler
        let deleteAllCachedItem = document.getElementById("deleteAllChaptersMenuItem");
        if (deleteAllCachedItem) {
            deleteAllCachedItem.onclick = async (e) => {
                e.stopPropagation();
                await ChapterCache.deleteAllCachedChapters(chapters);
                ChapterUrlsUI.hideHeaderMoreActionsMenu(headerMoreActionsMenu);
            };
        }

        // Set up reorder chapters handler
        let reorderChaptersItem = document.getElementById("reorderChaptersMenuItem");
        if (reorderChaptersItem) {
            reorderChaptersItem.onclick = async (e) => {
                e.stopPropagation();
                await ChapterUrlsUI.openChapterReorderModal(chapters);
                ChapterUrlsUI.hideHeaderMoreActionsMenu(headerMoreActionsMenu);
            };
        }

        // Set up download library book handler
        let downloadLibraryBookItem = document.getElementById("downloadLibraryBookMenuItem");
        if (downloadLibraryBookItem) {
            downloadLibraryBookItem.onclick = async (e) => {
                e.stopPropagation();
                ChapterUrlsUI.hideHeaderMoreActionsMenu(headerMoreActionsMenu);
                
                // Download the current library book using the existing LibDownload function
                if (window.currentLibraryBook) {
                    LibraryUI.LibDownload({ dataset: { libepubid: window.currentLibraryBook.id } });
                }
            };
        }

        // Set up toggle library chapters handler
        let toggleLibraryChaptersItem = document.getElementById("toggleLibraryChaptersMenuItem");
        if (toggleLibraryChaptersItem) {
            toggleLibraryChaptersItem.onclick = async (e) => {
                e.stopPropagation();
                ChapterUrlsUI.hideHeaderMoreActionsMenu(headerMoreActionsMenu);
                
                // Toggle visibility of library chapters
                ChapterUrlsUI.toggleLibraryChaptersVisibility();
            };
        }

        // Set up delete library book handler
        let deleteLibraryBookItem = document.getElementById("deleteLibraryBookMenuItem");
        if (deleteLibraryBookItem) {
            deleteLibraryBookItem.onclick = async (e) => {
                e.stopPropagation();
                ChapterUrlsUI.hideHeaderMoreActionsMenu(headerMoreActionsMenu);
                
                // Confirm deletion since this is a destructive action
                if (window.currentLibraryBook && confirm(UIText.Confirm.deleteLibraryBook)) {
                    // Use the existing LibDeleteEpub function with the current library book ID
                    LibraryUI.LibDeleteEpub({ dataset: { libepubid: window.currentLibraryBook.id } });
                }
            };
        }

        // Set up export JSON handler
        let exportJsonItem = document.getElementById("exportJsonMenuItem");
        if (exportJsonItem) {
            exportJsonItem.onclick = async (e) => {
                e.stopPropagation();
                ChapterUrlsUI.hideHeaderMoreActionsMenu(headerMoreActionsMenu);
                await ChapterUrlsUI.exportStoryAsJson(chapters);
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
                let message = `Errors occurred while downloading chapters:\n${errors.join("\n")}`;
                alert(message);
            }
            
        } catch (error) {
            console.error("Error downloading selected chapters:", error);
            alert("Failed to download selected chapters: " + error.message);
        }
    }

    /**
     * Export story information as JSON file
     */
    static async exportStoryAsJson(chapters) {
        try {
            // Get title and starting URL from main UI
            let title = document.getElementById("titleInput")?.value || "Untitled Story";
            let mainStoryUrl = document.getElementById("startingUrlInput")?.value || "";
            
            // Get selected chapters to find the last one
            let selectedChapters = ChapterUrlsUI.getSelectedChapters(chapters);
            
            // Get last selected chapter (fallback to last chapter in list if no selection)
            let lastChapter = null;
            if (selectedChapters.length > 0) {
                lastChapter = selectedChapters[selectedChapters.length - 1];
            } else if (chapters && chapters.length > 0) {
                lastChapter = chapters[chapters.length - 1];
            }
            
            // Build JSON structure
            let jsonData = {
                "stories": [
                    {
                        "title": title,
                        "mainStoryUrl": mainStoryUrl,
                        "lastChapterUrl": lastChapter?.sourceUrl || "",
                        "lastChapterTitle": lastChapter?.title || "",
                        "secondaryUrlMatches": [],
                        "tags": [],
                        "dateLastGrabbed": null,
                        "dateAdded": new Date().toISOString()
                    }
                ]
            };
            
            // Create and download JSON file
            let jsonString = JSON.stringify(jsonData, null, 2);
            let blob = new Blob([jsonString], { type: "application/json" });
            let url = URL.createObjectURL(blob);
            
            // Generate filename from title
            let filename = title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
            if (filename.length === 0) filename = "story";
            filename += "_export.json";
            
            // Download the file
            let a = document.createElement("a");
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
        } catch (error) {
            console.error("Error exporting story as JSON:", error);
            alert("Failed to export story as JSON: " + error.message);
        }
    }

    /**
     * Get selected chapters from the chapter list
     */
    static getSelectedChapters(chapters) {
        let selected = [];
        let rows = document.querySelectorAll(".chapter-row");
        
        rows.forEach((row, index) => {
            let checkbox = row.querySelector("input[type=\"checkbox\"]");
            if (checkbox && checkbox.checked && chapters[index]) {
                selected.push(chapters[index]);
            }
        });
        
        return selected;
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
            let confirmMessage = `Delete ${cachedChapters.length} cached chapter${cachedChapters.length > 1 ? "s" : ""}?`;
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
                        ChapterUrlsUI.setChapterStatusVisuals(row, ChapterUrlsUI.CHAPTER_STATUS_NONE, chapter.sourceUrl, chapter.title);
                    }
                } catch (error) {
                    console.error(`Failed to delete cached chapter "${chapter.title}":`, error);
                    errors.push(`${chapter.title}: ${error.message}`);
                }
            }

            // Show errors if any occurred
            if (errors.length > 0) {
                let message = `Errors occurred while deleting cached chapters:\n${errors.join("\n")}`;
                alert(message);
            }
            
        } catch (error) {
            console.error("Error deleting selected cached chapters:", error);
            alert("Failed to delete selected cached chapters: " + error.message);
        }
    }

    /**
     * Refresh a library chapter by updating its content in the actual library book
     * @param {Object} chapter - Chapter object with libraryBookId and epubSpineIndex
     * @param {HTMLElement} row - The table row element
     */
    static async refreshLibraryChapter(chapter, row) {
        try {
            if (!chapter.sourceUrl || chapter.sourceUrl.startsWith("library://")) {
                alert("Cannot refresh library-only chapters (no source URL)");
                return;
            }

            // Update UI to show refreshing state
            ChapterUrlsUI.setChapterStatusVisuals(row, ChapterUrlsUI.CHAPTER_STATUS_DOWNLOADING, chapter.sourceUrl, chapter.title);

            // Do the refresh
            await EpubUpdater.refreshChapterInBook(chapter);

            // Update UI to show success - keep the eye icon since it's still in the library
            ChapterUrlsUI.setChapterStatusVisuals(row, ChapterUrlsUI.CHAPTER_STATUS_LIBRARY, chapter.sourceUrl, chapter.title);
        } catch (error) {
            console.error("Failed to refresh library chapter:", error);
            ChapterUrlsUI.setChapterStatusVisuals(row, ChapterUrlsUI.CHAPTER_STATUS_ERROR, chapter.sourceUrl, chapter.title);
            alert("Failed to refresh library chapter: " + error.message);
        }
    }

    /**
     * Delete a single chapter and update UI
     */
    static async deleteChapter(chapter, row) {
        try {
            // Check if this is a library chapter or a cached chapter
            if (chapter && chapter.isInBook && chapter.libraryBookId && chapter.epubSpineIndex !== undefined) {
                // Store the deleted index before we modify the chapter object
                let deletedIndex = chapter.epubSpineIndex;
                // Use the LibraryBookData method to delete
                let isDeleted = await EpubUpdater.deleteChapter(chapter);
                if (isDeleted) {
                    // Update this chapter's status (no longer in library) without moving it
                    chapter.isInBook = false;
                    chapter.epubSpineIndex = undefined;

                    // Update visual status to show it's no longer in library
                    ChapterUrlsUI.setChapterStatusVisuals(row, ChapterUrlsUI.CHAPTER_STATUS_NONE, chapter.sourceUrl, chapter.title);

                    // Update epubSpineIndex for remaining chapters without UI re-render
                    if (window.parser && window.parser.state && window.parser.state.webPages) {
                        // Update all chapters that had a higher epubSpineIndex (shift them down by 1)
                        for (let [key, chapterObj] of window.parser.state.webPages.entries()) {
                            if (chapterObj.isInBook &&
                                chapterObj.libraryBookId === chapter.libraryBookId &&
                                chapterObj.epubSpineIndex !== undefined &&
                                chapterObj.epubSpineIndex > deletedIndex) {
                                chapterObj.epubSpineIndex--;
                            }
                        }
                    }
                }
            } else {
                // Use the ChapterCache method to delete
                await ChapterCache.deleteChapter(chapter.sourceUrl);
                await ChapterCache.refreshCacheStats();
                ChapterUrlsUI.setChapterStatusVisuals(row, ChapterUrlsUI.CHAPTER_STATUS_NONE, chapter.sourceUrl, chapter.title);
            }

        } catch (error) {
            console.error("Failed to delete chapter:", error);
            ChapterUrlsUI.setChapterStatusVisuals(row, ChapterUrlsUI.CHAPTER_STATUS_ERROR, chapter.sourceUrl, chapter.title);
            alert("Failed to delete chapter: " + error.message);
        }
    }

    /**
     * Open the chapter reordering modal for library books
     * @param {Array} chapters - Array of chapter objects (optional, will get from parser state if not provided)
     */
    static async openChapterReorderModal(chapters) {
        try {
            // Get chapters from parser state if not provided, as these should have library properties
            let currentChapters = chapters;
            if (!currentChapters || currentChapters.length === 0 || !Object.hasOwn(currentChapters[0], "isInBook")) {
                if (window.parser && window.parser.state && window.parser.state.webPages) {
                    currentChapters = [...window.parser.state.webPages.values()];
                } else {
                    alert("No chapters available for reordering.");
                    return;
                }
            }
            
            // Only show reordering for library chapters
            let libraryChapters = currentChapters.filter(chapter => chapter.isInBook && chapter.libraryBookId);
            console.log("Total chapters:", currentChapters.length);
            console.log("Library chapters found:", libraryChapters.length);
            console.log("First chapter isInBook:", currentChapters[0]?.isInBook);
            console.log("First chapter libraryBookId:", currentChapters[0]?.libraryBookId);
            
            if (libraryChapters.length === 0) {
                alert("No library chapters found to reorder.");
                return;
            }

            // Sort chapters by their current order in the book (epubSpineIndex)
            libraryChapters.sort((a, b) => (a.epubSpineIndex || 0) - (b.epubSpineIndex || 0));

            // Store the original order for comparison
            ChapterUrlsUI._originalChapterOrder = libraryChapters.map(ch => ({...ch}));
            ChapterUrlsUI._currentReorderChapters = libraryChapters.map(ch => ({...ch}));

            // Populate the modal
            ChapterUrlsUI.populateReorderModal(ChapterUrlsUI._currentReorderChapters);

            // Show the modal
            let modal = document.getElementById("chapterReorderModal");
            document.body.classList.add("modal-open");
            modal.style.display = "flex";

            // Set up modal event handlers
            ChapterUrlsUI.setupReorderModalHandlers();

        } catch (error) {
            console.error("Error opening chapter reorder modal:", error);
            alert("Failed to open chapter reordering interface: " + error.message);
        }
    }

    /**
     * Populate the reorder modal with chapter items
     * @param {Array} chapters - Array of library chapters
     */
    static populateReorderModal(chapters) {
        let container = document.getElementById("reorderChapterList");
        container.innerHTML = "";

        chapters.forEach((chapter, index) => {
            let item = document.createElement("div");
            item.className = "reorder-chapter-item";
            item.dataset.originalIndex = index;

            // Chapter number
            let chapterNumber = document.createElement("div");
            chapterNumber.className = "reorder-chapter-number";
            chapterNumber.textContent = (index + 1).toString();

            // Chapter title
            let chapterTitle = document.createElement("div");
            chapterTitle.className = "reorder-chapter-title";
            chapterTitle.textContent = chapter.title;
            chapterTitle.title = chapter.title; // Tooltip for long titles

            // Move buttons (side by side like library cards)
            let moveButtons = document.createElement("div");
            moveButtons.className = "reorder-move-buttons";

            let moveUpBtn = document.createElement("button");
            moveUpBtn.className = "reorder-move-up";
            moveUpBtn.appendChild(SvgIcons.createSvgElement(SvgIcons.ARROW_UP));
            moveUpBtn.disabled = index === 0;
            moveUpBtn.onclick = () => ChapterUrlsUI.moveChapterUp(index);

            let moveDownBtn = document.createElement("button");
            moveDownBtn.className = "reorder-move-down"; 
            let downArrow = SvgIcons.createSvgElement(SvgIcons.ARROW_UP);
            downArrow.style.transform = "rotate(180deg)";
            moveDownBtn.appendChild(downArrow);
            moveDownBtn.disabled = index === chapters.length - 1;
            moveDownBtn.onclick = () => ChapterUrlsUI.moveChapterDown(index);

            moveButtons.appendChild(moveUpBtn);
            moveButtons.appendChild(moveDownBtn);

            // Assemble the item
            item.appendChild(chapterNumber);
            item.appendChild(chapterTitle);
            item.appendChild(moveButtons);

            container.appendChild(item);
        });
    }

    /**
     * Move chapter up in the reorder list
     * @param {number} index - Index of chapter to move up
     */
    static moveChapterUp(index) {
        if (index > 0) {
            // Swap with previous chapter
            let temp = ChapterUrlsUI._currentReorderChapters[index];
            ChapterUrlsUI._currentReorderChapters[index] = ChapterUrlsUI._currentReorderChapters[index - 1];
            ChapterUrlsUI._currentReorderChapters[index - 1] = temp;

            // Re-populate the modal and flash the moved item
            ChapterUrlsUI.populateReorderModal(ChapterUrlsUI._currentReorderChapters);
            ChapterUrlsUI.flashMovedItem(index - 1); // Flash the item at its new position
        }
    }

    /**
     * Move chapter down in the reorder list
     * @param {number} index - Index of chapter to move down
     */
    static moveChapterDown(index) {
        if (index < ChapterUrlsUI._currentReorderChapters.length - 1) {
            // Swap with next chapter  
            let temp = ChapterUrlsUI._currentReorderChapters[index];
            ChapterUrlsUI._currentReorderChapters[index] = ChapterUrlsUI._currentReorderChapters[index + 1];
            ChapterUrlsUI._currentReorderChapters[index + 1] = temp;

            // Re-populate the modal and flash the moved item
            ChapterUrlsUI.populateReorderModal(ChapterUrlsUI._currentReorderChapters);
            ChapterUrlsUI.flashMovedItem(index + 1); // Flash the item at its new position
        }
    }

    /**
     * Apply a brief flash effect to a moved chapter item
     * @param {number} itemIndex - Index of the item to flash
     */
    static flashMovedItem(itemIndex) {
        // Wait a moment for the DOM to update after re-population
        setTimeout(() => {
            let container = document.getElementById("reorderChapterList");
            let items = container.querySelectorAll(".reorder-chapter-item");
            if (items[itemIndex]) {
                items[itemIndex].classList.add("flash");
                // Remove the class after animation completes
                setTimeout(() => {
                    items[itemIndex].classList.remove("flash");
                }, 600); // Match the animation duration
            }
        }, 10);
    }

    /**
     * Set up event handlers for the reorder modal
     */
    static setupReorderModalHandlers() {
        // Close button
        document.getElementById("closeChapterReorder").onclick = () => {
            ChapterUrlsUI.closeReorderModal();
        };

        // Cancel button
        document.getElementById("cancelChapterOrderButton").onclick = () => {
            ChapterUrlsUI.closeReorderModal();
        };

        // Save button
        document.getElementById("saveChapterOrderButton").onclick = async () => {
            await ChapterUrlsUI.saveChapterOrder();
        };

        // Close on background click
        document.getElementById("chapterReorderModal").onclick = (e) => {
            if (e.target.id === "chapterReorderModal") {
                ChapterUrlsUI.closeReorderModal();
            }
        };
    }

    /**
     * Close the reorder modal
     */
    static closeReorderModal() {
        let modal = document.getElementById("chapterReorderModal");
        modal.style.display = "none";
        document.body.classList.remove("modal-open");

        // Clean up
        ChapterUrlsUI._originalChapterOrder = null;
        ChapterUrlsUI._currentReorderChapters = null;
    }

    /**
     * Save the new chapter order to the EPUB
     */
    static async saveChapterOrder() {
        try {
            // Check if order has changed
            let hasChanged = ChapterUrlsUI.hasChapterOrderChanged();
            if (!hasChanged) {
                ChapterUrlsUI.closeReorderModal();
                return;
            }

            // Get the library book ID
            let bookId = ChapterUrlsUI._currentReorderChapters[0].libraryBookId;

            // Update the EPUB with new chapter order
            await EpubUpdater.reorderChapters(bookId, ChapterUrlsUI._currentReorderChapters);

            // Reload the library book to reflect new order
            await LibraryUI.loadLibraryBookInMainUI(bookId);
            
            ChapterUrlsUI.closeReorderModal();

        } catch (error) {
            console.error("Error saving chapter order:", error);
            alert("Failed to save chapter order: " + error.message);
        }
    }

    /**
     * Check if the chapter order has changed
     * @returns {boolean} True if order has changed
     */
    static hasChapterOrderChanged() {
        if (!ChapterUrlsUI._originalChapterOrder || !ChapterUrlsUI._currentReorderChapters) {
            return false;
        }

        if (ChapterUrlsUI._originalChapterOrder.length !== ChapterUrlsUI._currentReorderChapters.length) {
            return true;
        }

        for (let i = 0; i < ChapterUrlsUI._originalChapterOrder.length; i++) {
            if (ChapterUrlsUI._originalChapterOrder[i].sourceUrl !== ChapterUrlsUI._currentReorderChapters[i].sourceUrl) {
                return true;
            }
        }

        return false;
    }

    /**
     * Toggle visibility of library chapters and update menu text
     */
    static toggleLibraryChaptersVisibility() {
        try {
            // Get the current state from window property (default: show chapters)
            let hideLibraryChapters = window.hideLibraryChapters === true;
            
            // Toggle the state
            hideLibraryChapters = !hideLibraryChapters;
            window.hideLibraryChapters = hideLibraryChapters;
            
            // Update the menu text and icon based on new state
            let toggleMenuItem = document.getElementById("toggleLibraryChaptersMenuItem");
            let toggleText = document.getElementById("toggleLibraryChaptersText");
            let toggleIcon = document.getElementById("toggleLibraryChaptersIcon");
            
            if (toggleText && toggleIcon) {
                if (hideLibraryChapters) {
                    // Currently hiding chapters, so show "Show" option
                    toggleText.textContent = UIText.Toggle.showLibraryChapters;
                    toggleIcon.innerHTML = "";
                    let iconElement = SvgIcons.createSvgElement(SvgIcons.EYE_FILL);
                    iconElement.style.opacity = "0.5"; // Make it dimmed to indicate hidden state
                    toggleIcon.appendChild(iconElement);
                } else {
                    // Currently showing chapters, so show "Hide" option
                    toggleText.textContent = UIText.Toggle.hideLibraryChapters;
                    toggleIcon.innerHTML = "";
                    let iconElement = SvgIcons.createSvgElement(SvgIcons.EYE_FILL);
                    iconElement.style.opacity = "1"; // Normal opacity for visible state
                    toggleIcon.appendChild(iconElement);
                }
            }
            
            // Apply the visibility changes to library chapters
            ChapterUrlsUI.updateLibraryChaptersVisibility(hideLibraryChapters);
            
        } catch (error) {
            console.error("Error toggling library chapters visibility:", error);
        }
    }

    /**
     * Update visibility of library chapters based on the hide state
     * @param {boolean} hideLibraryChapters - Whether to hide library chapters
     */
    static updateLibraryChaptersVisibility(hideLibraryChapters) {
        try {
            // Find all chapter rows that are in the library
            let libraryChapterRows = document.querySelectorAll(".chapter-row.chapter-in-library");
            
            libraryChapterRows.forEach(row => {
                if (hideLibraryChapters) {
                    row.style.display = "none";
                    
                    // Uncheck the checkbox for hidden chapters
                    let checkbox = row.querySelector(".chapterSelectCheckbox");
                    if (checkbox && checkbox.checked) {
                        checkbox.checked = false;
                        // Trigger the onclick handler to update the chapter's isIncludeable property
                        if (checkbox.onclick) {
                            checkbox.onclick();
                        }
                    }
                } else {
                    row.style.display = "";
                    // Note: We don't re-check the checkbox when showing chapters again
                }
            });
            
            // Update the chapter count display to reflect visible chapters
            ChapterUrlsUI.updateVisibleChapterCount();
            
        } catch (error) {
            console.error("Error updating library chapters visibility:", error);
        }
    }

    /**
     * Update the chapter count display to show only visible chapters
     */
    static updateVisibleChapterCount() {
        try {
            let allRows = document.querySelectorAll(".chapter-row");
            let visibleRows = Array.from(allRows).filter(row => 
                row.style.display !== "none" && !row.hidden
            );
            
            let spanChapterCount = document.getElementById("spanChapterCount");
            if (spanChapterCount) {
                spanChapterCount.textContent = visibleRows.length.toString();
            }
            
        } catch (error) {
            console.error("Error updating visible chapter count:", error);
        }
    }

    /**
     * Initialize the library chapters visibility toggle menu state
     */
    static initializeLibraryChaptersToggle() {
        try {
            // Reset state to default (show chapters) when initializing
            window.hideLibraryChapters = false;
            
            // Get the current state from window property (default: show chapters)
            let hideLibraryChapters = window.hideLibraryChapters === true;
            
            // Update the menu text and icon to reflect current state
            let toggleText = document.getElementById("toggleLibraryChaptersText");
            let toggleIcon = document.getElementById("toggleLibraryChaptersIcon");
            
            if (toggleText && toggleIcon) {
                if (hideLibraryChapters) {
                    toggleText.textContent = UIText.Toggle.showLibraryChapters;
                    toggleIcon.innerHTML = "";
                    let iconElement = SvgIcons.createSvgElement(SvgIcons.EYE_FILL);
                    iconElement.style.opacity = "0.5";
                    toggleIcon.appendChild(iconElement);
                } else {
                    toggleText.textContent = UIText.Toggle.hideLibraryChapters;
                    toggleIcon.innerHTML = "";
                    let iconElement = SvgIcons.createSvgElement(SvgIcons.EYE_FILL);
                    iconElement.style.opacity = "1";
                    toggleIcon.appendChild(iconElement);
                }
            }
            
            // Apply the visibility changes if we should hide chapters
            if (hideLibraryChapters) {
                ChapterUrlsUI.updateLibraryChaptersVisibility(hideLibraryChapters);
            }
            
        } catch (error) {
            console.error("Error initializing library chapters toggle:", error);
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
ChapterUrlsUI.CHAPTER_STATUS_LIBRARY = 5;
ChapterUrlsUI.TooltipForState = [
    UIText.Chapter.tooltipDownloadChapter,
    UIText.Chapter.tooltipChapterDownloading,
    UIText.Chapter.tooltipViewChapter,
    UIText.Chapter.tooltipChapterSleeping,
    "Download failed - click to view error",
    "View chapter from library book"
];

ChapterUrlsUI.lastSelectedRow = null;
ChapterUrlsUI.ConsecutiveRowClicks = 0;
