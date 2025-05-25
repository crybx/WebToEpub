"use strict";

/** Class that handles UI for selecting (chapter) URLs to fetch */
class ChaptersUI {
    constructor(parser) {
        this.parser = parser;
        ChaptersUI.getPleaseWaitMessageRow().hidden = false;
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
        document.getElementById("selectAllUrlsButton").onclick = ChaptersUI.setAllUrlsSelectState.bind(null, true);
        document.getElementById("unselectAllUrlsButton").onclick = ChaptersUI.setAllUrlsSelectState.bind(null, false);
        document.getElementById("reverseChapterUrlsOrderButton").onclick = this.reverseUrls.bind(this);
        document.getElementById("editChaptersUrlsButton").onclick = this.setEditInputMode.bind(this);
        document.getElementById("copyUrlsToClipboardButton").onclick = this.copyUrlsToClipboard.bind(this);
        document.getElementById("showChapterUrlsCheckbox").onclick = this.toggleShowUrlsForChapterRanges.bind(this);
        ChaptersUI.modifyApplyChangesButtons(button => button.onclick = this.setTableMode.bind(this));
    }

    populateChapterUrlsTable(chapters) {
        ChaptersUI.getPleaseWaitMessageRow().hidden = true;
        ChaptersUI.clearChapterUrlsTable();
        let linksTable = ChaptersUI.getChapterUrlsTable();
        let index = 0;
        let rangeStart = ChaptersUI.getRangeStartChapterSelect();
        let rangeEnd = ChaptersUI.getRangeEndChapterSelect();
        let memberForTextOption = ChaptersUI.textToShowInRange();
        chapters.forEach(function(chapter) {
            let row = document.createElement("tr");
            ChaptersUI.appendCheckBoxToRow(row, chapter);
            ChaptersUI.appendInputTextToRow(row, chapter);
            chapter.row = row;
            ChaptersUI.appendColumnDataToRow(row, chapter.sourceUrl);
            ChaptersUI.appendViewCacheButtonToRow(row, chapter).then(async () => {
                await ChaptersUI.updateDeleteCacheButtonVisibility();
            });
            linksTable.appendChild(row);
            ChaptersUI.appendOptionToSelect(rangeStart, index, chapter, memberForTextOption);
            ChaptersUI.appendOptionToSelect(rangeEnd, index, chapter, memberForTextOption);
            ++index;
        });
        ChaptersUI.setRangeOptionsToFirstAndLastChapters();
        
        // Set up delete cache handler
        let deleteButton = document.getElementById("deleteAllCachedChapters");
        let deleteWrapper = deleteButton.parentElement;
        deleteWrapper.onclick = () => ChapterCache.deleteAllCachedChapters(chapters);
        this.showHideChapterUrlsColumn();
        ChaptersUI.resizeTitleColumnToFit(linksTable);
    }

    showTocProgress(chapters) {
        let linksTable = ChaptersUI.getChapterUrlsTable();
        chapters.forEach(function(chapter) {
            let row = document.createElement("tr");
            linksTable.appendChild(row);
            row.appendChild(document.createElement("td"));
            let col = document.createElement("td");
            col.className = "disabled";
            col.appendChild(document.createTextNode(chapter.title));
            row.appendChild(col);
            row.appendChild(document.createElement("td"));
        });
    }

    static showChapterStatus(row, state, sourceUrl = "", title = "") {
        if (row != null) {
            let chapterStatusColumn = row.querySelector(".chapterStatusColumn");
            ChaptersUI.setChapterStatusIcon(chapterStatusColumn, state, sourceUrl, title);
        }
    }


    static resetChapterStatusIcons() {
        let linksTable = ChaptersUI.getChapterUrlsTable();
        
        for (let chapterStatusColumn of linksTable.querySelectorAll(".chapterStatusColumn")) {
            // Restore normal chapter status content
            ChaptersUI.restoreChapterStatus(chapterStatusColumn);
        }
    }

    static clearChapterUrlsTable() {
        util.removeElements(ChaptersUI.getTableRowsWithChapters());
        util.removeElements([...ChaptersUI.getRangeStartChapterSelect().options]);
        util.removeElements([...ChaptersUI.getRangeEndChapterSelect().options]);
    }

    static limitNumOfChapterS(maxChapters) {
        let max = util.isNullOrEmpty(maxChapters) ? 10000 : parseInt(maxChapters.replace(",", ""));
        let selectedRows = [...ChaptersUI.getChapterUrlsTable().querySelectorAll("[type=\"checkbox\"]")]
            .filter(c => c.checked)
            .map(c => c.parentElement.parentElement);
        if (max< selectedRows.length ) {
            let message = chrome.i18n.getMessage("__MSG_More_than_max_chapters_selected__", 
                [selectedRows.length, max]);
            if (confirm(message) === false) {
                for (let row of selectedRows.slice(max)) {
                    ChaptersUI.setRowCheckboxState(row, false);
                }
            }
        }
    }

    /** @private */
    static setRangeOptionsToFirstAndLastChapters()
    {
        let rangeStart = ChaptersUI.getRangeStartChapterSelect();
        let rangeEnd = ChaptersUI.getRangeEndChapterSelect();

        rangeStart.onchange = null;
        rangeEnd.onchange = null;
        
        rangeStart.selectedIndex = 0;
        rangeEnd.selectedIndex = rangeEnd.length - 1;
        ChaptersUI.setChapterCount(rangeStart.selectedIndex, rangeEnd.selectedIndex);
        
        rangeStart.onchange = ChaptersUI.onRangeChanged;
        rangeEnd.onchange = ChaptersUI.onRangeChanged;
    }
 
    /** @private */
    static onRangeChanged() {
        let startIndex = ChaptersUI.selectionToRowIndex(ChaptersUI.getRangeStartChapterSelect());
        let endIndex = ChaptersUI.selectionToRowIndex(ChaptersUI.getRangeEndChapterSelect());
        let rc = new ChaptersUI.RangeCalculator();

        for (let row of ChaptersUI.getTableRowsWithChapters()) {
            let inRange = rc.rowInRange(row);
            ChaptersUI.setRowCheckboxState(row, rc.rowInRange(row));
            row.hidden = !inRange;
        }
        ChaptersUI.setChapterCount(startIndex, endIndex);
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
        for (let row of ChaptersUI.getTableRowsWithChapters()) {
            ChaptersUI.setRowCheckboxState(row, select);
            row.hidden = false;
        }
        ChaptersUI.setRangeOptionsToFirstAndLastChapters();
    }

    /** @private */
    static setRowCheckboxState(row, checked) {
        let input = row.querySelector("input[type=\"checkbox\"]");
        if (input.checked !== checked) {
            input.checked = checked;
            input.onclick();
        }
    }

    static getTableRowsWithChapters() {
        let linksTable = ChaptersUI.getChapterUrlsTable();
        return [...linksTable.querySelectorAll("tr")]
            .filter(r => r.querySelector("th") === null);
    }

    /**
    * @private
    */
    static appendCheckBoxToRow(row, chapter) {
        chapter.isIncludeable = chapter.isIncludeable ?? true;
        chapter.previousDownload = chapter.previousDownload ?? false;

        const col = document.createElement("td");
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = chapter.isIncludeable;
        checkbox.onclick = function(event) { 
            chapter.isIncludeable = checkbox.checked;
            if (!event) return;

            ChaptersUI.tellUserAboutShiftClick(event, row);

            if (event.shiftKey && (ChaptersUI.lastSelectedRow !== null)) {
                ChaptersUI.updateRange(ChaptersUI.lastSelectedRow, row.rowIndex, checkbox.checked);
            } else {
                ChaptersUI.lastSelectedRow = row.rowIndex;
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
                let col = row.querySelector(".chapterStatusColumn");
                ChaptersUI.setChapterStatusIcon(col, ChaptersUI.CHAPTER_STATUS_DOWNLOADED, sourceUrl, title);
            } else {
                let col = row.querySelector(".chapterStatusColumn");
                ChaptersUI.setChapterStatusIcon(col, ChaptersUI.CHAPTER_STATUS_NONE, sourceUrl, title);
            }
        } catch (err) {
            console.error("Error restoring chapter status content:", err);
            // Fallback to download icon
            let col = row.querySelector(".chapterStatusColumn");
            ChaptersUI.setChapterStatusIcon(col, ChaptersUI.CHAPTER_STATUS_NONE, sourceUrl, title);
        }
    }

    /** 
    * @private
    */
    static appendInputTextToRow(row, chapter) {
        let col = document.createElement("td");
        let input = document.createElement("input");
        input.type = "text";
        input.value = chapter.title;
        input.className = "fullWidth";
        input.addEventListener("blur", function() { chapter.title = input.value; },  true);
        col.appendChild(input);
        row.appendChild(col);
    }

    static appendOptionToSelect(select, value, chapter, memberForTextOption) {
        let option = new Option(chapter[memberForTextOption], value);
        select.add(option);
    }

    /** @private */
    static resizeTitleColumnToFit(linksTable) {
        let inputs = [...linksTable.querySelectorAll("input[type=\"text\"]")];
        let width = inputs.reduce((acc, element) => Math.max(acc, element.value.length), 0);
        if (0 < width) {
            inputs.forEach(i => i.size = width); 
        }
    }

    /** 
    * @private
    */
    static appendColumnDataToRow(row, textData) {
        let col = document.createElement("td");
        col.innerText = textData;
        col.style.whiteSpace = "nowrap";
        row.appendChild(col);
        return col;
    }

    /**
    * @private
    * Add view cache button to row if chapter is cached
    * @returns {Promise<boolean>} true if chapter is cached
    */
    static async appendViewCacheButtonToRow(row, chapter) {
        let col = document.createElement("td");
        col.className = "chapterStatusColumn";
        row.appendChild(col);
        
        // Check if chapter is cached
        return ChapterCache.get(chapter.sourceUrl).then(async cachedContent => {
            if (cachedContent) {
                // Chapter is cached - show eye icon
                let col = row.querySelector(".chapterStatusColumn");
                ChaptersUI.setChapterStatusIcon(col, ChaptersUI.CHAPTER_STATUS_DOWNLOADED, chapter.sourceUrl, chapter.title);
                return true;
            } else {
                // Chapter is not cached - show download icon
                let col = row.querySelector(".chapterStatusColumn");
                ChaptersUI.setChapterStatusIcon(col, ChaptersUI.CHAPTER_STATUS_NONE, chapter.sourceUrl, chapter.title);
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
    * Add more actions menu (three dots) next to cache icon
    */
    static addMoreActionsMenu(col, sourceUrl, title) {
        // Create more actions wrapper
        let moreWrapper = document.createElement("div");
        moreWrapper.className = "more-actions-wrapper clickable-icon";
        
        // Create three dots icon
        let moreIcon = document.createElement("img");
        moreIcon.src = "images/ThreeDotsVertical.svg";
        
        // Create dropdown menu
        let menu = document.createElement("div");
        menu.className = "more-actions-menu";
        
        // Refresh menu item
        let refreshItem = document.createElement("div");
        refreshItem.className = "menu-item";
        
        let refreshIcon = document.createElement("img");
        refreshIcon.src = "images/ArrowClockwise.svg";
        
        let refreshText = document.createElement("span");
        refreshText.textContent = ChapterCache.CacheText.menuRefreshChapter;
        
        refreshItem.appendChild(refreshIcon);
        refreshItem.appendChild(refreshText);
        refreshItem.onclick = async (e) => {
            e.stopPropagation();
            await ChapterCache.refreshChapter(sourceUrl, title, col);
            ChaptersUI.hideMoreActionsMenu(menu);
        };
        
        // Delete menu item
        let deleteItem = document.createElement("div");
        deleteItem.className = "menu-item";
        
        let deleteIcon = document.createElement("img");
        deleteIcon.src = "images/Trash3Fill.svg";
        
        let deleteText = document.createElement("span");
        deleteText.textContent = ChapterCache.CacheText.menuDeleteChapter;
        
        deleteItem.appendChild(deleteIcon);
        deleteItem.appendChild(deleteText);
        deleteItem.onclick = async (e) => {
            e.stopPropagation();
            await ChapterCache.deleteSingleChapter(sourceUrl, title, col);
            ChaptersUI.hideMoreActionsMenu(menu);
        };
        
        // Add items to menu
        // Download menu item
        let downloadItem = document.createElement("div");
        downloadItem.className = "menu-item";
        
        let downloadIcon = document.createElement("img");
        downloadIcon.src = "images/Download.svg";
        
        let downloadText = document.createElement("span");
        downloadText.textContent = ChapterCache.CacheText.menuDownloadChapter;
        
        downloadItem.appendChild(downloadIcon);
        downloadItem.appendChild(downloadText);
        downloadItem.onclick = async (e) => {
            e.stopPropagation();
            await ChapterCache.downloadSingleChapterAsFile(sourceUrl, title);
            ChaptersUI.hideMoreActionsMenu(menu);
        };
        
        // Add items to menu
        menu.appendChild(refreshItem);
        menu.appendChild(downloadItem);
        menu.appendChild(deleteItem);
        
        // Add click handler to show/hide menu
        moreWrapper.onclick = (e) => {
            e.stopPropagation();
            ChaptersUI.toggleMoreActionsMenu(menu);
        };
        
        // Assemble more actions
        moreWrapper.appendChild(moreIcon);
        moreWrapper.appendChild(menu);
        col.appendChild(moreWrapper);
        
        // Close menu when clicking outside
        document.addEventListener("click", () => ChaptersUI.hideMoreActionsMenu(menu));
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
     * Handles all chapter states: cached, uncached, downloading, sleeping
     */
    static setChapterStatusIcon(column, state, sourceUrl, title) {
        if (!column) return;
        
        // Clear existing content
        column.innerHTML = "";
        
        // Create common DOM elements
        let wrapper = document.createElement("div");
        wrapper.className = "tooltip-wrapper";
        
        let img = document.createElement("img");
        img.src = ChaptersUI.ImageForState[state];
        
        let tooltip = document.createElement("span");
        tooltip.className = "tooltipText";
        tooltip.textContent = ChaptersUI.TooltipForState[state];
        
        // Assemble components
        wrapper.appendChild(img);
        wrapper.appendChild(tooltip);
        column.appendChild(wrapper);
        
        // Apply state-specific behavior and styling
        switch (state) {
        case ChaptersUI.CHAPTER_STATUS_DOWNLOADED: // Chapter is cached - show eye icon
            wrapper.className += " clickable-icon";
            wrapper.onclick = () => ChapterViewer.viewChapter(sourceUrl, title);
            ChaptersUI.addMoreActionsMenu(column, sourceUrl, title);
            break;
            
        case ChaptersUI.CHAPTER_STATUS_NONE: // Chapter not cached - show download icon
            wrapper.className += " clickable-icon";
            wrapper.onclick = async () => {
                await ChapterCache.downloadChapter(sourceUrl, title, column);
            };
            break;
            
        case ChaptersUI.CHAPTER_STATUS_DOWNLOADING: // Currently downloading - show downloading icon  
        case ChaptersUI.CHAPTER_STATUS_SLEEPING: // Waiting between downloads - show sleeping icon
            // Non-clickable, just tooltip wrapper (no additional classes needed)
            break;
        }
    }

    static setVisibileUI(toTable) {
        // toggle mode
        ChaptersUI.getEditChaptersUrlsInput().hidden = toTable;
        ChaptersUI.getChapterUrlsTable().hidden = !toTable;
        document.getElementById("inputSection").hidden = !toTable;
        document.getElementById("coverUrlSection").hidden = !toTable;
        document.getElementById("chapterSelectControlsDiv").hidden = !toTable;
        ChaptersUI.modifyApplyChangesButtons(button => button.hidden = toTable);
        document.getElementById("editURLsHint").hidden = toTable;
    }

    /** 
    * @private
    */
    setTableMode() {
        try {
            let inputvalue = ChaptersUI.getEditChaptersUrlsInput().value;
            let chapters;
            let lines = inputvalue.split("\n");
            lines = lines.filter(a => a.trim() != "").map(a => a.trim());
            if (URL.canParse(lines[0])) {
                chapters = this.URLsToChapters(lines);
            } else {
                chapters = this.htmlToChapters(inputvalue);
            }
            this.parser.setPagesToFetch(chapters);
            this.populateChapterUrlsTable(chapters);
            this.usingTable = true;
            ChaptersUI.setVisibileUI(this.usingTable);
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
        this.toggleShowUrlsForChapterRange(ChaptersUI.getRangeStartChapterSelect(), chapters);
        this.toggleShowUrlsForChapterRange(ChaptersUI.getRangeEndChapterSelect(), chapters);
        this.showHideChapterUrlsColumn();
    }
    
    showHideChapterUrlsColumn() {
        let hidden = !document.getElementById("showChapterUrlsCheckbox").checked;
        let table = ChaptersUI.getChapterUrlsTable();
        for (let t of table.querySelectorAll("th:nth-of-type(3), td:nth-of-type(3)")) {
            t.hidden = hidden;
        }
    }

    toggleShowUrlsForChapterRange(select, chapters) {
        select.onchange = null;
        let memberForTextOption = ChaptersUI.textToShowInRange();
        for (let o of [...select.querySelectorAll("Option")]) {
            o.text = chapters[o.index][memberForTextOption];
        }
        select.onchange = ChaptersUI.onRangeChanged;
    }

    /** 
    * @private
    */
    setEditInputMode() {
        this.usingTable = false;
        ChaptersUI.setVisibileUI(this.usingTable);
        let input = ChaptersUI.getEditChaptersUrlsInput();
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
        let linkTable = ChaptersUI.getChapterUrlsTable();
        for (let rowIndex = startRowIndex; rowIndex !== endRowIndex; rowIndex += direction) {
            let row = linkTable.rows[rowIndex];
            ChaptersUI.setRowCheckboxState(row, state);
        }
    }

    /** @private */
    static getTargetRow(target) {
        while ((target.tagName.toLowerCase() !== "tr") && (target.parentElement !== null)) {
            target = target.parentElement;
        }
        return target;
    }

    /** @private */
    static tellUserAboutShiftClick(event, row) {
        if (event.shiftKey || (ChaptersUI.lastSelectedRow === null)) {
            return;
        }
        if (ChaptersUI.ConsecutiveRowClicks == 5) {
            return;
        }
        let distance = Math.abs(row.rowIndex - ChaptersUI.lastSelectedRow);
        if (distance !== 1) {
            ChaptersUI.ConsecutiveRowClicks = 0;
            return;
        }
        ++ChaptersUI.ConsecutiveRowClicks;
        if (ChaptersUI.ConsecutiveRowClicks == 5) {
            alert(chrome.i18n.getMessage("__MSG_Shift_Click__"));
        }
    }

    static Filters = {
        filterTermsFrequency: {},
        chapterList: {},
        init() {
            let rc = new ChaptersUI.RangeCalculator();
            let filterTermsFrequency = {};
            let constantTerms = false; // To become a collection of all terms used in every link.
            const chapterList = ChaptersUI.getTableRowsWithChapters().filter(item => rc.rowInRange(item)).map(item => {
                let filterObj =
                    {
                        row: item,
                        values: Array.from(item.querySelectorAll("td")).map(item => item.innerText).join("/").split("/"),
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
            let rc = new ChaptersUI.RangeCalculator();
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

            ChaptersUI.Filters.chapterList.forEach(item =>{
                let showChapter = rc.rowInRange(item.row);
                if (includeChaps)
                {
                    showChapter = showChapter && includeChaps.test(item.valueString);
                }
                if (excludeChaps)
                {
                    showChapter = showChapter && !excludeChaps.test(item.valueString);
                }
                ChaptersUI.setRowCheckboxState(item.row, showChapter);
                item.row.hidden = !showChapter;
            });
            document.getElementById("spanChapterCount").textContent = ChaptersUI.Filters.chapterList.filter(item => !item.row.hidden).length;
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

                ChaptersUI.Filters.Filter();
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
                ChaptersUI.Filters.Filter();
            };
            col.appendChild(el);
            row.appendChild(col);
            col = document.createElement("td");
            el = document.createElement("input");
            el.type = "text";
            el.disabled = true;
            el.id = checkboxId + "Text";
            el.onchange = function(event) { event.target.nextElementSibling.value = event.target.value; ChaptersUI.Filters.Filter(); };
            col.appendChild(el);
            el = document.createElement("input");
            el.type = "hidden";
            el.id = checkboxId + "Hidden";
            el.name = checkboxId + "Hidden";
            col.appendChild(el);
            row.appendChild(col);

            retVal.appendChild(row);

            ChaptersUI.Filters.filterTermsFrequency.forEach((value, id) => {
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
ChaptersUI.RangeCalculator = class {
    constructor()
    {
        this.startIndex = ChaptersUI.selectionToRowIndex(ChaptersUI.getRangeStartChapterSelect());
        this.endIndex = ChaptersUI.selectionToRowIndex(ChaptersUI.getRangeEndChapterSelect());
    }
    rowInRange(row) {
        let index = row.rowIndex;
        return (this.startIndex <= index) && (index <= this.endIndex);
    }
};


ChaptersUI.CHAPTER_STATUS_NONE = 0;
ChaptersUI.CHAPTER_STATUS_DOWNLOADING = 1;
ChaptersUI.CHAPTER_STATUS_DOWNLOADED = 2;
ChaptersUI.CHAPTER_STATUS_SLEEPING = 3;
ChaptersUI.ImageForState = [
    "images/Download.svg",
    "images/ChapterStateDownloading.svg",
    "images/EyeFill.svg",
    "images/ChapterStateSleeping.svg"
];
ChaptersUI.TooltipForState = [
    chrome.i18n.getMessage("__MSG_tooltip_Download_Chapter__"),
    chrome.i18n.getMessage("__MSG_Tooltip_chapter_downloading__"),
    chrome.i18n.getMessage("__MSG_tooltip_View_Chapter__"),
    chrome.i18n.getMessage("__MSG_Tooltip_chapter_sleeping__")
];

ChaptersUI.lastSelectedRow = null;
ChaptersUI.ConsecutiveRowClicks = 0;
