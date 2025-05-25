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
            ChaptersUI.appendViewCacheButtonToRow(row, chapter).then(() => {
                ChaptersUI.updateDeleteCacheButtonVisibility();
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

    static showDownloadState(row, state) {
        if (row != null) {
            let downloadStateDiv = row.querySelector(".downloadStateDiv");
            ChaptersUI.updateDownloadStateImage(downloadStateDiv, state);
        }
    }

    static updateDownloadStateImage(downloadStateDiv, state) {
        let img = downloadStateDiv.querySelector("img");
        if (img) {
            img.src = ChaptersUI.ImageForState[state];

            // Update tooltip
            let tooltipText = ChaptersUI.TooltipForSate[state];
            let tooltipTextSpan = downloadStateDiv.querySelector(".tooltipText");

            if (tooltipText && !tooltipTextSpan) {
                tooltipTextSpan = document.createElement("span");
                tooltipTextSpan.className = "tooltipText";
                tooltipTextSpan.textContent = tooltipText;
                downloadStateDiv.appendChild(tooltipTextSpan);
            } else if (tooltipText) {
                tooltipTextSpan.textContent = tooltipText;
            } else if (tooltipTextSpan) {
                // Remove tooltip text if there is no text to display
                downloadStateDiv.removeChild(tooltipTextSpan);
            }
        }
    }

    static resetDownloadStateImages() {
        let linksTable = ChaptersUI.getChapterUrlsTable();
        let prevDownload = ChaptersUI.ImageForState[ChaptersUI.DOWNLOAD_STATE_PREVIOUS];
        let downloaded = ChaptersUI.ImageForState[ChaptersUI.DOWNLOAD_STATE_LOADED];

        for (let downloadStateDiv of linksTable.querySelectorAll(".downloadStateDiv")) {
            let state = ChaptersUI.DOWNLOAD_STATE_NONE;
            let imgSrc = downloadStateDiv.querySelector("img")?.src;
            if (imgSrc) {
                const imagesIndex = imgSrc.indexOf("images/");
                if (imagesIndex !== -1) {
                    imgSrc = imgSrc.substring(imagesIndex);
                }
            }
            if (imgSrc === prevDownload || imgSrc === downloaded) {
                state = ChaptersUI.DOWNLOAD_STATE_PREVIOUS;
            }
            ChaptersUI.updateDownloadStateImage(downloadStateDiv, state);
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
        ChaptersUI.addDownloadStateToCheckboxColumn(col, chapter.previousDownload);
        row.appendChild(col);
    }

    static addDownloadStateToCheckboxColumn(col, previousDownload) {
        let downloadStateDiv = document.createElement("div");
        downloadStateDiv.className = "downloadStateDiv tooltip-wrapper";
        let img = document.createElement("img");
        img.className = "downloadState";

        downloadStateDiv.appendChild(img);
        ChaptersUI.updateDownloadStateImage(downloadStateDiv,
            previousDownload ? ChaptersUI.DOWNLOAD_STATE_PREVIOUS : ChaptersUI.DOWNLOAD_STATE_NONE
        );
        col.appendChild(downloadStateDiv);
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
        col.className = "cacheViewColumn";
        row.appendChild(col);
        
        // Check if chapter is cached
        return ChapterCache.get(chapter.sourceUrl).then(cachedContent => {
            if (cachedContent) {
                // Use the shared function to add the icon
                ChaptersUI.addCacheIconToRow(row, chapter.sourceUrl, chapter.title);
                
                // Update download state to show as previously downloaded
                let downloadStateDiv = row.querySelector(".downloadStateDiv");
                if (downloadStateDiv) {
                    ChaptersUI.updateDownloadStateImage(downloadStateDiv, ChaptersUI.DOWNLOAD_STATE_PREVIOUS);
                }
                
                return true;
            }
            return false;
        }).catch(err => {
            console.error("Error checking cache:", err);
            return false;
        });
    }

    /**
    * Update visibility of delete cache button based on whether any chapters are cached
    */
    static updateDeleteCacheButtonVisibility() {
        // Only check for cached chapters in the current chapter table, excluding the delete button itself
        let chapterTable = document.getElementById("chapterUrlsTable");
        let hasCache = chapterTable && chapterTable.querySelector(".cacheViewColumn img:not(#deleteAllCachedChapters)") !== null;
        let deleteButton = document.getElementById("deleteAllCachedChapters");
        if (deleteButton) {
            deleteButton.style.display = hasCache ? "block" : "none";
        }
    }

    /**
    * @public
    * Add cache icon to row when chapter is cached (called after successful caching)
    */
    static addCacheIconToRow(row, sourceUrl, title) {
        let col = row.querySelector(".cacheViewColumn");
        if (col && !col.querySelector("img")) {
            // Create wrapper for custom tooltip
            let wrapper = document.createElement("div");
            wrapper.className = "tooltip-wrapper tooltip-right";
            wrapper.onclick = () => ChapterViewer.viewChapter(sourceUrl, title);
            
            // Create the eye icon
            let button = document.createElement("img");
            button.src = "images/EyeFill.svg";
            
            // Create the custom tooltip
            let tooltip = document.createElement("span");
            tooltip.className = "tooltipText";
            tooltip.textContent = ChapterCache.CacheText.tooltipViewChapter;
            
            // Assemble the components
            wrapper.appendChild(button);
            wrapper.appendChild(tooltip);
            col.appendChild(wrapper);
            
            // Create more actions menu
            ChaptersUI.addMoreActionsMenu(col, sourceUrl, title);
            
            // Update delete button visibility
            ChaptersUI.updateDeleteCacheButtonVisibility();
        }
    }

    /**
    * @private
    * Add more actions menu (three dots) next to cache icon
    */
    static addMoreActionsMenu(col, sourceUrl, title) {
        // Create more actions wrapper
        let moreWrapper = document.createElement("div");
        moreWrapper.className = "more-actions-wrapper";
        
        // Create three dots icon
        let moreIcon = document.createElement("img");
        moreIcon.src = "images/ThreeDotsVertical.svg";
        moreIcon.className = "more-actions-icon";
        
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
            await ChapterCache.deleteSingleChapter(sourceUrl, col);
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


ChaptersUI.DOWNLOAD_STATE_NONE = 0;
ChaptersUI.DOWNLOAD_STATE_DOWNLOADING = 1;
ChaptersUI.DOWNLOAD_STATE_LOADED = 2;
ChaptersUI.DOWNLOAD_STATE_SLEEPING = 3;
ChaptersUI.DOWNLOAD_STATE_PREVIOUS = 4;
ChaptersUI.ImageForState = [
    "images/ChapterStateNone.svg",
    "images/ChapterStateDownloading.svg",
    "images/FileEarmarkCheckFill.svg",
    "images/ChapterStateSleeping.svg",
    "images/FileEarmarkCheck.svg"
];
ChaptersUI.TooltipForSate = [
    null,
    chrome.i18n.getMessage("__MSG_Tooltip_chapter_downloading__"),
    chrome.i18n.getMessage("__MSG_Tooltip_chapter_downloaded__"),
    chrome.i18n.getMessage("__MSG_Tooltip_chapter_sleeping__"),
    chrome.i18n.getMessage("__MSG_Tooltip_chapter_previously_downloaded__")
];

ChaptersUI.lastSelectedRow = null;
ChaptersUI.ConsecutiveRowClicks = 0;
