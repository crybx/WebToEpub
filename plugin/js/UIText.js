"use strict";

/**
 * Centralized UI text constants for WebToEpub
 * All user-facing text should be defined here for easier translation management
 */
class UIText {
    // Chapter-related text
    static Chapter = {
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
    
    // Library-related text
    static Library = {
        deleteEpub: chrome.i18n.getMessage("__MSG_button_Lib_Template_Delete_EPUB__"),
        searchNewChapter: chrome.i18n.getMessage("__MSG_button_Lib_Template_Search_new_Chapters__"),
        updateNewChapter: chrome.i18n.getMessage("__MSG_button_Lib_Template_Update_new_Chapters__"),
        download: chrome.i18n.getMessage("__MSG_button_Lib_Template_Download_EPUB__"),
        selectBook: chrome.i18n.getMessage("__MSG_button_Lib_Template_Select_Book__"),
        loadBook: chrome.i18n.getMessage("__MSG_button_Lib_Template_Load_Book__"),
        newChapter: chrome.i18n.getMessage("__MSG_label_Lib_Template_New_Chapter__"),
        storyURL: chrome.i18n.getMessage("__MSG_label_Lib_Template_Story_URL__"),
        filename: chrome.i18n.getMessage("__MSG_label_Lib_Template_Filename__"),
        updateAll: chrome.i18n.getMessage("__MSG_button_Lib_Template_Update_All__"),
        clearLibrary: chrome.i18n.getMessage("__MSG_button_Lib_Template_Clear_Library__"),
        exportLibrary: chrome.i18n.getMessage("__MSG_button_Lib_Template_Export_Library__"),
        importLibrary: chrome.i18n.getMessage("__MSG_button_Lib_Template_Import_Library__"),
        addToLibrary: chrome.i18n.getMessage("__MSG_button_Lib_Template_Add_List_To_Library__"),
        mergeUpload: chrome.i18n.getMessage("__MSG_button_Lib_Template_Add_Chapter_from_different_EPUB__"),
        editMetadata: chrome.i18n.getMessage("__MSG_button_Lib_Template_Edit_Metadata__"),
        warningURLChange: chrome.i18n.getMessage("__MSG_label_Lib_Template_Warning_URL_Change__"),
        warningInProgress: chrome.i18n.getMessage("__MSG_label_Lib_Warning_In_Progress___"),
        viewListMode: chrome.i18n.getMessage("__MSG_button_View_Library_List__"),
        viewCompactMode: chrome.i18n.getMessage("__MSG_button_View_Compact_Library__"),
        noBooksMessage: chrome.i18n.getMessage("__MSG_label_library_no_books__"),
        openStoryURL: chrome.i18n.getMessage("__MSG_menu_Open_Story_URL__"),
        clearNewChaptersAlert: chrome.i18n.getMessage("__MSG_menu_Clear_New_Chapters_Alert__"),
        confirmClearLibrary: chrome.i18n.getMessage("__MSG_confirm_Clear_Library__")
    };
    
    // Metadata-related text
    static Metadata = {
        title: chrome.i18n.getMessage("__MSG_label_Title__"),
        author: chrome.i18n.getMessage("__MSG_label_Author__"),
        language: chrome.i18n.getMessage("__MSG_label_Language__"),
        subject: chrome.i18n.getMessage("__MSG_label_Metadata_subject__"),
        description: chrome.i18n.getMessage("__MSG_label_Metadata_description__"),
        save: chrome.i18n.getMessage("__MSG_label_Metadata_Save__")
    };
    
    // Common UI elements
    static Common = {
        ok: chrome.i18n.getMessage("__MSG_button_error_OK__"),
        cancel: chrome.i18n.getMessage("__MSG_button_error_Cancel__"),
        retry: chrome.i18n.getMessage("__MSG_button_error_Retry__"),
        close: chrome.i18n.getMessage("__MSG_button_Close__"),
        save: chrome.i18n.getMessage("__MSG_button_Save__"),
        download: chrome.i18n.getMessage("__MSG_button_Download__"),
        help: chrome.i18n.getMessage("__MSG_button_Help__"),
        remove: chrome.i18n.getMessage("__MSG_button_Remove__"),
        skip: chrome.i18n.getMessage("__MSG_button_error_Skip__"),
        stopDownload: chrome.i18n.getMessage("__MSG_button_Stop_Download__"),
        addToLibrary: chrome.i18n.getMessage("__MSG_button_Add_to_Library__"),
        updateLibraryBook: chrome.i18n.getMessage("__MSG_button_Update_Library_Book__")
    };
    
    // Cache-related text
    static Cache = {
        buttonEnabled: chrome.i18n.getMessage("__MSG_button_cache_status_Enabled__"),
        buttonDisabled: chrome.i18n.getMessage("__MSG_button_cache_status_Disabled__"),
        toggleOn: chrome.i18n.getMessage("__MSG_toggle_state_On__"),
        toggleOff: chrome.i18n.getMessage("__MSG_toggle_state_Off__"),
        statusError: chrome.i18n.getMessage("__MSG_status_Error__"),
        confirmClearAll: chrome.i18n.getMessage("__MSG_confirm_Clear_All_Cache__"),
        downloadSuccess: chrome.i18n.getMessage("__MSG_download_Success__"),
        downloadError: chrome.i18n.getMessage("__MSG_download_Error__"),
        errorClearCache: chrome.i18n.getMessage("__MSG_error_Failed_Clear_Cache__"),
        errorSaveSettings: chrome.i18n.getMessage("__MSG_error_Failed_Save_Cache_Settings__")
    };
    
    // Error messages
    static Error = {
        noParserFound: chrome.i18n.getMessage("noParserFound"),
        noChaptersFound: chrome.i18n.getMessage("noChaptersFound"),
        noChaptersFoundAndFetchClicked: chrome.i18n.getMessage("noChaptersFoundAndFetchClicked"),
        noImagesFound: chrome.i18n.getMessage("noImagesFound"),
        unhandledFieldTypeError: chrome.i18n.getMessage("unhandledFieldTypeError"),
        errorContentNotFound: (url) => chrome.i18n.getMessage("errorContentNotFound", [url]),
        errorIllegalFileName: (filename, illegalChars) => chrome.i18n.getMessage("errorIllegalFileName", [filename, illegalChars]),
        errorEditMetadata: chrome.i18n.getMessage("errorEditMetadata"),
        errorAddToLibraryLibraryAddPageWithChapters: chrome.i18n.getMessage("errorAddToLibraryLibraryAddPageWithChapters"),
        htmlFetchFailed: (url, error) => chrome.i18n.getMessage("htmlFetchFailed", [url, error]),
        imageFetchFailed: (url, parentUrl, error) => chrome.i18n.getMessage("imageFetchFailed", [url, parentUrl, error]),
        imgurFetchFailed: (url, error) => chrome.i18n.getMessage("imgurFetchFailed", [url, error]),
        gotHtmlExpectedImageWarning: (url) => chrome.i18n.getMessage("gotHtmlExpectedImageWarning", [url]),
        convertToXhtmlWarning: (filename, url, errorMessage) => chrome.i18n.getMessage("convertToXhtmlWarning", [filename, url, errorMessage])
    };
    
    // Warning messages
    static Warning = {
        warningNoChapterUrl: chrome.i18n.getMessage("warningNoChapterUrl"),
        warningNoVisibleContent: (url) => chrome.i18n.getMessage("warningNoVisibleContent", [url]),
        warning403ErrorResponse: (hostname) => chrome.i18n.getMessage("warning403ErrorResponse", [hostname]),
        warning429ErrorResponse: (hostname) => chrome.i18n.getMessage("warning429ErrorResponse", [hostname]),
        warningParserDisabledComradeMao: chrome.i18n.getMessage("warningParserDisabledComradeMao"),
        parserDisabledNotification: chrome.i18n.getMessage("parserDisabledNotification"),
        httpFetchCanRetry: chrome.i18n.getMessage("httpFetchCanRetry"),
        warningWebpImage: (relativeHref) => chrome.i18n.getMessage("warningWebpImage", [relativeHref])
    };

    // Default/Placeholder text
    static Default = {
        uuid: chrome.i18n.getMessage("defaultUUID"),
        title: chrome.i18n.getMessage("defaultTitle"),
        author: chrome.i18n.getMessage("defaultAuthor"),
        chapterPlaceholderMessage: (title, url) => chrome.i18n.getMessage("chapterPlaceholderMessage", [title, url]),
        informationPageTitle: chrome.i18n.getMessage("informationPageTitle"),
        tableOfContentsUrl: chrome.i18n.getMessage("tableOfContentsUrl")
    };

    // Cover image related text
    static CoverImage = {
        noImagesFoundLabel: chrome.i18n.getMessage("noImagesFoundLabel"),
        setCover: chrome.i18n.getMessage("setCover")
    };

    // Library/Chapter toggle text
    static Toggle = {
        showLibraryChapters: chrome.i18n.getMessage("__MSG_menu_Show_Library_Chapters__"),
        hideLibraryChapters: chrome.i18n.getMessage("__MSG_menu_Hide_Library_Chapters__")
    };

    // Confirmation messages
    static Confirm = {
        deleteLibraryBook: chrome.i18n.getMessage("__MSG_confirm_delete_library_book__")
    };

    // HTTP Client specific messages
    static HttpClient = {
        makeFailCanRetryMessage: chrome.i18n.getMessage("httpFetchCanRetry")
    };

    // Utility method for localizing UI elements (from main.js)
    static localizeElement(element) {
        let localized = chrome.i18n.getMessage(element.textContent.trim());
        if (localized && localized !== element.textContent.trim()) {
            element.textContent = localized;
        }
    }
}