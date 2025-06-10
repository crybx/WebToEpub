/*
    User settings for how extension should behave
*/

"use strict";

/** Holds a single preference value for user  */
class UserPreference {
    constructor(storageName, uiElementName, defaultValue) {
        this.storageName = storageName;
        this.uiElementName = uiElementName;
        this.value = defaultValue;
    }

    getUiElement() {
        return document.getElementById(this.uiElementName);
    }

    writeToLocalStorage() {
        window.localStorage.setItem(this.storageName, this.value);
    }
}

class BoolUserPreference extends UserPreference {
    constructor(storageName, uiElementName, defaultValue) {
        super(storageName, uiElementName, defaultValue);
    }

    readFromLocalStorage() {
        let test = window.localStorage.getItem(this.storageName);
        if (test !== null) {
            this.value = (test === "true");
        }
    }

    readFromUi() {
        let element = this.getUiElement();
        if (element) {
            this.value = element.checked;
        }
    }

    writeToUi() {
        let element = this.getUiElement();
        if (element) {
            element.checked = this.value;
        }
    }

    hookupUi(readFromUi) {
        let element = this.getUiElement();
        if (element) {
            element.onclick = readFromUi;
        }
    }
}

class StringUserPreference extends UserPreference {
    constructor(storageName, uiElementName, defaultValue) {
        super(storageName, uiElementName, defaultValue);
    }

    readFromLocalStorage() {
        let test = window.localStorage.getItem(this.storageName);
        if (test !== null) {
            this.value = test;
        }
    }

    readFromUi() {
        let element = this.getUiElement();
        if (element) {
            this.value = element.value;
        }
    }

    writeToUi() {
        let element = this.getUiElement();
        if (element) {
            element.value = this.value;
        }
    }

    hookupUi(readFromUi) {
        let uiElement = this.getUiElement();
        if (uiElement) {
            if (uiElement.tagName === "SELECT") {
                uiElement.onchange = readFromUi;
            } else {
                uiElement.addEventListener("blur", readFromUi, true);
            }
        }
    }
}

/** The collection of all preferences for user  */
class UserPreferences {
    constructor() {
        this.preferences = [];
        this.addPreference("removeDuplicateImages", "removeDuplicateImages", false);
        this.addPreference("includeImageSourceUrl", "includeImageSourceUrlCheckboxInput", true);
        this.addPreference("higestResolutionImages", "higestResolutionImagesCheckboxInput", true);
        this.addPreference("unSuperScriptAlternateTranslations", "unSuperScriptCheckboxInput", false);
        this.addPreference("styleSheet", "stylesheetInput", EpubMetaInfo.getDefaultStyleSheet());
        this.addPreference("CustomFilename", "CustomFilenameInput", "%Filename%");
        this.addPreference("useSvgForImages", "useSvgForImagesInput", true);
        this.addPreference("removeNextAndPreviousChapterHyperlinks", "removeNextAndPreviousChapterHyperlinksInput", true);
        this.addPreference("advancedOptionsVisibleByDefault", "advancedOptionsVisibleByDefaultCheckbox", false);
        this.addPreference("noDownloadPopup", "noDownloadPopupCheckbox", false);
        this.addPreference("writeErrorHistoryToFile", "writeErrorHistoryToFileCheckbox", false);
        this.addPreference("createEpub3", "createEpub3Checkbox", false);
        this.addPreference("epubInternalStructure", "epubInternalStructureSelect", "OEBPS");
        this.addPreference("chaptersPageInChapterList", "chaptersPageInChapterListCheckbox", false);
        this.addPreference("autoSelectBTSeriesPage", "autoParserSelectIncludesBTSeriesPageCheckbox", false);
        this.addPreference("removeAuthorNotes", "removeAuthorNotesCheckbox", false);
        this.addPreference("removeChapterNumber", "removeChapterNumberCheckbox", false);
        this.addPreference("removeOriginal", "removeOriginalCheckbox", true);
        this.addPreference("selectTranslationAi", "selectTranslationAiCheckbox", false);
        this.addPreference("removeTranslated", "removeTranslatedCheckbox", false);
        this.addPreference("skipChaptersThatFailFetch", "skipChaptersThatFailFetchCheckbox", false);
        this.addPreference("maxChaptersPerEpub", "maxChaptersPerEpubTag", "10,000");
        this.addPreference("manualDelayPerChapter", "manualDelayPerChapterTag", "0");
        this.addPreference("overrideMinimumDelay", "overrideMinimumDelayCheckbox", false);
        this.addPreference("skipImages", "skipImagesCheckbox", false);
        this.addPreference("compressImages", "compressImagesCheckbox", false);
        this.addPreference("compressImagesMaxResolution", "compressImagesMaxResolutionTag", "1080");
        this.addPreference("overwriteExistingEpub", "overwriteEpubWhenDuplicateFilenameCheckbox", false);
        this.addPreference("themeColor", "themeColorTag", "");
        this.addPreference("useFullTitle", "useFullTitleAsFileNameCheckbox", false);
        this.addPreference("addInformationPage", "addInformationPageToEpubCheckbox", true);
        this.addPreference("lesstags", "lesstagsCheckbox", true);
        this.addPreference("autosearchmetadata", "autosearchmetadataCheckbox", false);
        this.addPreference("noAdditionalMetadata", "noAdditionalMetadataCheckbox", true);
        this.addPreference("ShowMoreMetadataOptions", "ShowMoreMetadataOptionsCheckbox", false);
        this.addPreference("LibShowAdvancedOptions", "LibShowAdvancedOptionsCheckbox", false);
        this.addPreference("LibShowCompactView", "LibShowCompactViewCheckbox", false);
        this.addPreference("LibDownloadEpubAfterUpdate", "LibDownloadEpubAfterUpdateCheckbox", false);
        this.addPreference("disableShiftClickAlert", "disableShiftClickAlertCheckbox", false);
        this.addPreference("defaultAuthorName", "defaultAuthorNameInput", "<unknown>");
        this.observers = [];
        this.readingList = new ReadingList();

        document.getElementById("themeColorTag").addEventListener("change", UserPreferences.SetTheme);
    }

    /** @private */
    addPreference(storageName, uiElementName, defaultValue) {
        if (this[storageName] !== undefined) {
            throw new Error("Preference " + storageName + " already created.");
        }

        let preference = null;
        if (typeof(defaultValue) === "boolean") {
            preference = new BoolUserPreference(storageName, uiElementName, defaultValue);
        } else if (typeof(defaultValue) === "string") {
            preference = new StringUserPreference(storageName, uiElementName, defaultValue);
        } else {
            throw new Error("Unknown preference type");
        }
        this.preferences.push(preference);
        this[storageName] = preference;
    }

    static readFromLocalStorage() {
        let newPreferences = new UserPreferences();
        for (let p of newPreferences.preferences) {
            p.readFromLocalStorage();
        }
        newPreferences.readingList.readFromLocalStorage();
        return newPreferences;
    }

    writeToLocalStorage() {
        for (let p of this.preferences) {
            p.writeToLocalStorage();
        }
        this.readingList.writeToLocalStorage();
    }

    addObserver(observer) {
        this.observers.push(observer);
        this.notifyObserversOfChange();
    }

    readFromUi() {
        for (let p of this.preferences) {
            p.readFromUi();
        }

        this.writeToLocalStorage();
        this.notifyObserversOfChange();
    }

    notifyObserversOfChange() {
        for (let observer of this.observers) {
            observer.onUserPreferencesUpdate(this);
        }
    }

    writeToUi() {
        for (let p of this.preferences) {
            p.writeToUi();
        }
        UserPreferences.SetTheme();
    }

    async handleEpubStructureChange(event) {
        let newStructure = event.target.value;
        let epubStructurePref = this.getPreference("epubInternalStructure");
        let currentStructure = epubStructurePref.value;
        
        if (newStructure === currentStructure) {
            return; // No change
        }

        try {
            // Check if user has library books
            let bookCount = await LibraryStorage.getLibraryBookCount();
            
            if (bookCount === 0) {
                // No library books, just update the preference
                epubStructurePref.value = newStructure;
                this.writeToLocalStorage();
                this.notifyObserversOfChange();
                return;
            }

            // Show confirmation dialog
            let confirmMessage = `You have ${bookCount} book${bookCount > 1 ? "s" : ""} in your library that need${bookCount === 1 ? "s" : ""} to be converted to the new EPUB structure.\n\nThis conversion will update all your library books to use the new internal file structure. This process may take a few moments.\n\nDo you want to proceed with the conversion?`;
            
            if (!confirm(confirmMessage)) {
                // User cancelled, revert the dropdown
                event.target.value = currentStructure;
                return;
            }

            // Show progress indication
            let statusElement = document.createElement("span");
            statusElement.textContent = " (Converting library books...)";
            statusElement.style.color = "orange";
            event.target.parentElement.appendChild(statusElement);
            
            // Disable the dropdown during conversion
            event.target.disabled = true;

            // Perform the conversion
            let result = await EpubStructure.convertAllLibraryBooks(newStructure);
            
            // Remove status indication
            statusElement.remove();
            event.target.disabled = false;

            if (result.success) {
                // Update the preference
                epubStructurePref.value = newStructure;
                this.writeToLocalStorage();
                this.notifyObserversOfChange();
                
                alert(`Successfully converted ${result.converted} library book${result.converted > 1 ? "s" : ""} to the new EPUB structure.`);
            } else {
                // Conversion failed, revert dropdown
                event.target.value = currentStructure;
                let errorMsg = `Failed to convert library books. ${result.converted} succeeded, ${result.failed} failed.`;
                if (result.error) {
                    errorMsg += `\n\nError: ${result.error}`;
                }
                alert(errorMsg);
            }

        } catch (error) {
            // Error during conversion, revert dropdown
            event.target.value = currentStructure;
            event.target.disabled = false;
            
            // Remove any status elements
            let statusElements = event.target.parentElement.querySelectorAll("span[style*='color: orange']");
            statusElements.forEach(el => el.remove());
            
            console.error("Error handling EPUB structure change:", error);
            alert(`Error during conversion: ${error.message}\n\nYour EPUB structure setting has been reverted.`);
        }
    }

    hookupUi() {
        let readFromUi = this.readFromUi.bind(this);
        for (let p of this.preferences) {
            if (p.storageName === "epubInternalStructure") {
                // Special handling for EPUB structure changes
                let element = p.getUiElement();
                if (element) {
                    element.onchange = this.handleEpubStructureChange.bind(this);
                }
            } else {
                p.hookupUi(readFromUi);
            }
        }

        this.notifyObserversOfChange();
    }

    writeToFile() {
        let obj = {};
        let serialized = window.localStorage.getItem(DefaultParserSiteSettings.storageName);
        if (serialized != null) {
            obj[DefaultParserSiteSettings.storageName] = JSON.parse(serialized);
        }
        obj[ReadingList.storageName] = JSON.parse(this.readingList.toJson());
        for (let p of this.preferences) {
            obj[p.storageName] = p.value; 
        }
        serialized = JSON.stringify(obj);
        let blob = new Blob([serialized], {type : "text"});
        return Download.save(blob, "Options.json")
            .catch (err => ErrorLog.showErrorMessage(err));
    }

    readFromFile(event, populateControls) {
        if (event.target.files.length == 0) {
            return;
        }
        
        let file = event.target.files[0];
        let reader = new FileReader();
        reader.onload = readerEvent => {
            let content = readerEvent.target.result;

            // reset so triggers if user selects same file again  
            event.target.value = null;
            try {
                let json = JSON.parse(content);
                this.loadOpionsFromJson(json);
                this.loadDefaultParserFromJson(json);
                this.loadReadingListFromJson(json);
                populateControls();
            } catch (err) {
                ErrorLog.showErrorMessage(err);
            }
        };
        reader.readAsText(file);
    }

    loadOpionsFromJson(json) {
        for (let p of this.preferences) {
            let val = json[p.storageName];
            if (val !== undefined && (p.value !== val)) {
                p.value = val;
                p.writeToLocalStorage();
            }
        }
    }

    loadDefaultParserFromJson(json) {
        let val = json[DefaultParserSiteSettings.storageName];
        if (val === undefined) {
            window.localStorage.removeItem(DefaultParserSiteSettings.storageName);
        } else {
            let serialized = JSON.stringify(val);
            window.localStorage.setItem(DefaultParserSiteSettings.storageName, serialized);
        }
    }

    loadReadingListFromJson(json) {
        let val = json[ReadingList.storageName];
        if (val !== undefined) {
            let serialized = JSON.stringify(val);
            this.readingList = ReadingList.fromJson(serialized);
            window.localStorage.setItem(ReadingList.storageName, serialized);
        }
    }

    setReadingListCheckbox(url) {
        let inlist = this.readingList.getEpub(url) != null;
        UserPreferences.getReadingListCheckbox().checked = inlist;
    }

    static getReadingListCheckbox() {
        return document.getElementById("includeInReadingListCheckbox");
    }

    static SetTheme() {
        let theme = document.querySelector("#themeColorTag").value;
        let autodark = document.querySelector("link#autoDark");
        let alwaysDark = document.querySelector("link#alwaysDark");
        let cyberpunk = document.querySelector("link#cyberpunk");
        let sunset = document.querySelector("link#sunset");
        autodark.disabled = true;
        alwaysDark.disabled = true;
        cyberpunk.disabled = true;
        sunset.disabled = true;
        if (theme === "") {
            autodark.disabled = false;
        } else if (theme === "DarkMode") {
            alwaysDark.disabled = false;
        } else if (theme === "CyberpunkMode") {
            cyberpunk.disabled = false;
        } else if (theme === "SunsetMode") {
            sunset.disabled = false;
        }
    }

    /**
     * Get preference object by storage name
     * @param {string} storageName - The storage name of the preference
     * @returns {UserPreference|null} The preference object or null if not found
     */
    getPreference(storageName) {
        return this.preferences.find(p => p.storageName === storageName) || null;
    }

    static getPreferenceValue(key) {
        // Get preference value by storage name
        let userPrefs = UserPreferences.readFromLocalStorage();
        if (userPrefs && userPrefs[key]) {
            return userPrefs[key].value;
        }
        
        // Return default value if not found
        if (key === "epubInternalStructure") {
            return "OEBPS";
        }
        return null;
    }
}
