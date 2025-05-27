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
        
        // Set up delete cache handler
        let deleteButton = document.getElementById("deleteAllCachedChapters");
        if (deleteButton.children.length == 0) {
            deleteButton.appendChild(SvgIcons.createSvgElement(SvgIcons.TRASH3_FILL));
        }
        let deleteWrapper = deleteButton.parentElement;
        deleteWrapper.onclick = () => ChapterCache.deleteAllCachedChapters(chapters);
        this.showHideChapterUrlsColumn();
        
        // Update select all checkbox state after populating table
        ChapterUrlsUI.updateSelectAllCheckboxState();
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
        let startIndex = ChapterUrlsUI.selectionToRowIndex(ChapterUrlsUI.getRangeStartChapterSelect());
        let endIndex = ChapterUrlsUI.selectionToRowIndex(ChapterUrlsUI.getRangeEndChapterSelect());
        let rc = new ChapterUrlsUI.RangeCalculator();

        for (let row of ChapterUrlsUI.getTableRowsWithChapters()) {
            let inRange = rc.rowInRange(row);
            ChapterUrlsUI.setRowCheckboxState(row, rc.rowInRange(row));
            row.hidden = !inRange;
        }
        ChapterUrlsUI.setChapterCount(startIndex, endIndex);
    }

    static selectionToRowIndex(selectElement) {
        let selectedIndex = selectElement.selectedIndex;
        return selectedIndex + 1;
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
    static setAllUrlsSelectState(select) {
        // Set flag to prevent recursive updates
        ChapterUrlsUI._updatingSelectAll = true;
        
        for (let row of ChapterUrlsUI.getTableRowsWithChapters()) {
            ChapterUrlsUI.setRowCheckboxState(row, select);
            row.hidden = false;
        }
        ChapterUrlsUI.setRangeOptionsToFirstAndLastChapters();
        
        // Update select all checkbox state and clear flag
        ChapterUrlsUI._updatingSelectAll = false;
        ChapterUrlsUI.updateSelectAllCheckboxState();
    }

    /** Handle the select all checkbox click */
    static handleSelectAllCheckbox() {
        const selectAllCheckbox = document.getElementById("selectAllUrlsCheckbox");
        const newState = selectAllCheckbox.checked;
        
        // Set flag to prevent recursive updates
        ChapterUrlsUI._updatingSelectAll = true;
        
        // Set all chapter checkboxes to the new state
        for (let row of ChapterUrlsUI.getTableRowsWithChapters()) {
            ChapterUrlsUI.setRowCheckboxState(row, newState);
            row.hidden = false;
        }
        ChapterUrlsUI.setRangeOptionsToFirstAndLastChapters();
        
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
        chapter.isIncludeable = chapter.isIncludeable ?? true;
        chapter.previousDownload = chapter.previousDownload ?? false;

        const col = document.createElement("div");
        col.className = "chapter-checkbox-column";
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.classList.add("chapterSelectCheckbox");
        checkbox.checked = chapter.isIncludeable;
        checkbox.onclick = function(event) { 
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
        let sourceUrl = urlCell.textContent.trim();
        
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
    * Update visibility of delete cache button based on whether any chapters are cached
    */
    static async updateDeleteCacheButtonVisibility() {
        // Check if there are actually cached chapters for the current page's URLs
        let hasCache = await ChapterCache.hasAnyCachedChaptersOnPage();
        let deleteButton = document.getElementById("deleteAllCachedChapters");
        if (deleteButton) {
            deleteButton.style.display = hasCache ? "block" : "none";
        }
    }

    /**
    * @private
    * Add more actions menu (three dots) next to chapter status icon
    */
    static addMoreActionsMenu(row, sourceUrl, title) {
        let col = row.querySelector(".chapter-status-column");
        if (!col) return;
        // Create more actions wrapper
        let moreWrapper = document.createElement("div");
        moreWrapper.className = "more-actions-wrapper clickable-icon";
        
        // Create three dots icon (inline SVG for color control)
        let moreIcon = SvgIcons.createSvgElement(SvgIcons.THREE_DOTS_VERTICAL);
        
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
            await ChapterCache.refreshChapter(sourceUrl, title, row);
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
            await ChapterCache.deleteSingleChapter(sourceUrl, title, row);
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
        
        return SvgIcons.createSvgElement(svgConstants[state]);
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
        
        // Handle greenBox class for checkbox in row
        let checkbox = row.querySelector(".chapterSelectCheckbox");
        if (checkbox) {
            if (state === ChapterUrlsUI.CHAPTER_STATUS_DOWNLOADED) {
                checkbox.classList.add("greenBox");
            } else {
                checkbox.classList.remove("greenBox");
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
    static updateRange(startRowIndex, endRowIndex, state) {
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
                col.setAttribute("width", "10px");
                
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
                el.setAttribute("width", "100%");
                col.appendChild(el);
                row.appendChild(col);

                retVal.appendChild(row);
            });
            retVal.setAttribute("width", "100%");
            return retVal;
        }
    };
}
ChapterUrlsUI.RangeCalculator = class {
    constructor()
    {
        this.startIndex = ChapterUrlsUI.selectionToRowIndex(ChapterUrlsUI.getRangeStartChapterSelect());
        this.endIndex = ChapterUrlsUI.selectionToRowIndex(ChapterUrlsUI.getRangeEndChapterSelect());
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
