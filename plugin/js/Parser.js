/*
  Base class that all parsers build from.
*/
"use strict";

/**
 * For sites that have multiple chapters per web page, this can minimize HTTP calls
 */
class FetchCache { // eslint-disable-line no-unused-vars
    constructor() {
        this.path = null;
        this.dom = null;
    }

    async fetch(url) {
        if  (!this.inCache(url)) {
            this.dom = (await HttpClient.wrapFetch(url)).responseXML;
            this.path = new URL(url).pathname;
        }
        return this.dom.cloneNode(true);
    }

    inCache(url) {
        return (((new URL(url).pathname) === this.path) 
        && (this.dom !== null));
    }
}

/**
 * A Parser's state variables
*/
class ParserState {
    constructor() {
        this.webPages = new Map();
        this.chapterListUrl = null;
    }

    setPagesToFetch(urls) {
        let nextPrevChapters = new Set();
        this.webPages = new Map();
        for (let i = 0; i < urls.length; ++i) {
            let page = urls[i];
            if (i < urls.length - 1) {
                nextPrevChapters.add(util.normalizeUrlForCompare(urls[i + 1].sourceUrl));
            }
            page.nextPrevChapters = nextPrevChapters;
            this.webPages.set(page.sourceUrl, page);
            nextPrevChapters = new Set();
            nextPrevChapters.add(util.normalizeUrlForCompare(page.sourceUrl));
        }
    }
}

class Parser {    
    constructor(imageCollector) {
        this.minimumThrottle = 500;
        this.maxSimultanousFetchSize = 1;
        this.state = new ParserState();
        this.imageCollector = imageCollector || new ImageCollector();
        this.userPreferences = null;
    }

    copyState(otherParser) {
        this.state = otherParser.state;
        this.imageCollector.copyState(otherParser.imageCollector);
        this.userPreferences = otherParser.userPreferences;
    }

    setPagesToFetch(urls) {
        this.state.setPagesToFetch(urls);
    }

    getPagesToFetch() {
        return this.state.webPages;
    }
    
    //Use this option if the parser isn't sending the correct HTTP header
    isCustomError(response) {  // eslint-disable-line no-unused-vars
        return false;
    }

    setCustomErrorResponse(url, wrapOptions, checkedresponse) {
        //example
        let ret = {};
        ret.url = url;
        ret.wrapOptions = wrapOptions;
        ret.response = {};
        //URL that's get opened on 'Open URL for Captcha' click
        ret.response.url = checkedresponse.response.url;
        ret.response.status = 403;
        //How often should it be retried and with how much delay in between
        ret.response.retryDelay = [80,40,20,10,5];
        ret.errorMessage = "This is a custom error message that will be displayed should all retries fail";
        //return empty to throw error
        return {};
    }

    onUserPreferencesUpdate(userPreferences) {
        this.userPreferences = userPreferences;
        this.imageCollector.onUserPreferencesUpdate(userPreferences);
    }

    isWebPagePackable(webPage) {
        return ((webPage.isIncludeable)
         && ((webPage.rawDom != null) || (webPage.error != null) || (webPage.isInBook === true)));
    }

    convertRawDomToContent(webPage) {
        let content = this.findContent(webPage.rawDom);
        if (content == null) {
            return null;
        }
        this.customRawDomToContentStep(webPage, content);
        util.decodeCloudflareProtectedEmails(content);
        if (this.userPreferences.removeNextAndPreviousChapterHyperlinks.value) {
            this.removeNextAndPreviousChapterHyperlinks(webPage, content);
        }
        this.removeUnwantedElementsFromContentElement(content);
        this.addTitleToContent(webPage, content);
        util.fixBlockTagsNestedInInlineTags(content);
        util.removeUnusedHeadingLevels(content);
        util.makeHyperlinksRelative(webPage.rawDom.baseURI, content);
        util.setStyleToDefault(content);
        util.prepForConvertToXhtml(content);
        util.removeEmptyAttributes(content);
        util.removeSpansWithNoAttributes(content);
        util.removeEmptyDivElements(content);
        util.removeTrailingWhiteSpace(content);
        if (util.isElementWhiteSpace(content)) {
            let errorMsg = UIText.Warning.warningNoVisibleContent(webPage.sourceUrl);
            ErrorLog.showErrorMessage(errorMsg);
        }

        // Cache the processed content (uses session only, persistent or library book storage based on settings)
        if (webPage.sourceUrl) {
            // Fire and forget - don't wait for cache write
            ChapterCache.set(webPage.sourceUrl, content).then(async () => {
                // Update UI with the visual changes to the chapter's status
                if (webPage.row) {
                    ChapterUrlsUI.setChapterStatusVisuals(webPage.row, ChapterUrlsUI.CHAPTER_STATUS_DOWNLOADED, webPage.sourceUrl, webPage.title);
                }
            }).catch(e =>
                console.error("Failed to cache chapter:", e)
            );
        }

        return content;
    }

    processImagesAndLinks(webPage, content) {
        if (content == null) {
            return null;
        }

        // Important: Fix any protocol-relative URLs (//domain.com) to absolute URLs
        // so ImageCollector can process them properly
        for (let img of content.querySelectorAll("img")) {
            let srcAttr = img.getAttribute("src");
            if (srcAttr && srcAttr.startsWith("//")) {
                let newSrc = "https:" + srcAttr;
                img.setAttribute("src", newSrc);
            }
        }

        this.imageCollector.findImagesUsedInDocument(content);
        this.imageCollector.replaceImageTags(content);
        util.makeHyperlinksRelative(webPage.rawDom ? webPage.rawDom.baseURI : webPage.sourceUrl, content);

        return content;
    }

    addTitleToContent(webPage, content) {
        // Skip title extraction for cached content - title is already processed and embedded
        if (webPage.isCachedContent) {
            return;
        }

        let title = this.findChapterTitle(webPage.rawDom, webPage);
        if (title != null) {
            if (title instanceof HTMLElement) {
                title = title.textContent;
            }
            if (webPage.title == "[placeholder]") {
                webPage.title = title.trim();
            }
            if (!this.titleAlreadyPresent(title, content)) {
                let titleElement = webPage.rawDom.createElement("h1");
                titleElement.appendChild(webPage.rawDom.createTextNode(title.trim()));
                content.insertBefore(titleElement, content.firstChild);
            }
        } else {
            if (webPage.title == "[placeholder]") {
                webPage.title = webPage.rawDom.title;
            }
        }
    }

    titleAlreadyPresent(title, content) {
        let existingTitle = content.querySelector("h1, h2, h3, h4, h5, h6");
        return (existingTitle != null)
            && (title.trim() === existingTitle.textContent.trim());
    }

    /**
     * Element with title of an individual chapter
     * Override when chapter title not in content element
    */
    findChapterTitle(dom) {   // eslint-disable-line no-unused-vars
        return null;
    }

    removeUnwantedElementsFromContentElement(element) {
        util.removeScriptableElements(element);
        util.removeComments(element);
        util.removeElements(element.querySelectorAll("noscript, input"));
        util.removeUnwantedWordpressElements(element);
        util.removeMicrosoftWordCrapElements(element);
        util.removeShareLinkElements(element);
        util.removeLeadingWhiteSpace(element);
    }

    customRawDomToContentStep(chapter, content) { // eslint-disable-line no-unused-vars
        // override for any custom processing
    }

    populateUI(dom) {
        CoverImageUI.showCoverImageUrlInput(true);
        let coverUrl = this.findCoverImageUrl(dom);
        CoverImageUI.setCoverImageUrl(coverUrl);
        this.populateUIImpl();
    }

    populateUIImpl() {
        // default implementation is do nothing more
    }

    /**
     * Default implementation, take first image in content section
    */
    findCoverImageUrl(dom) {
        if (dom != null) {
            let content = this.findContent(dom);
            if (content != null) {
                let cover = content.querySelector("img");
                if (cover != null) {
                    return cover.src;
                }
            }
        }
        return null;
    }

    removeNextAndPreviousChapterHyperlinks(webPage, element) {
        let elementToRemove = (this.findParentNodeOfChapterLinkToRemoveAt != null) ?
            this.findParentNodeOfChapterLinkToRemoveAt.bind(this)
            : (element) => element;

        let chapterLinks = [...element.querySelectorAll("a")]
            .filter(link => webPage.nextPrevChapters && webPage.nextPrevChapters.has(util.normalizeUrlForCompare(link.href)))
            .map(link => elementToRemove(link));
        util.removeElements(chapterLinks);
    }

    /**
    * default implementation turns each webPage into single epub item
    */
    async webPageToEpubItems(webPage, epubItemIndex) {
        // Check if we have cached, pre-processed content
        let cachedContent = null;
        try {
            cachedContent = await ChapterCache.get(webPage.sourceUrl);
        } catch (e) {
            // Ignore cache read errors, fall back to normal processing
        }

        let content;
        if (cachedContent) {
            content = cachedContent;
            // Process cached content for image URLs and relative linking
            content = this.processImagesAndLinks(webPage, content);
        } else {
            content = this.convertRawDomToContent(webPage);
            content = this.processImagesAndLinks(webPage, content);
        }

        let items = [];
        if (content != null) {
            items.push(new ChapterEpubItem(webPage, content, epubItemIndex));
        }
        return items;
    }

    makePlaceholderEpubItem(webPage, epubItemIndex) {
        let temp = Parser.makeEmptyDocForContent(webPage.sourceUrl);
        temp.content.textContent = UIText.Default.chapterPlaceholderMessage(webPage.sourceUrl, webPage.error);
        util.convertPreTagToPTags(temp.dom, temp.content);
        return [new ChapterEpubItem(webPage, temp.content, epubItemIndex)];
    }

    /**
    * default implementation
    */
    static extractTitleDefault(dom) {
        let title = dom.querySelector("meta[property='og:title']");
        return (title === null) ? dom.title : title.getAttribute("content");
    }

    extractTitleImpl(dom) {
        return Parser.extractTitleDefault(dom);
    }

    extractTitle(dom) {
        let title = this.extractTitleImpl(dom);
        if (title == null) {
            title = Parser.extractTitleDefault(dom);
        }
        if (title.textContent !== undefined) {
            title = title.textContent;
        }
        return title.trim();
    }

    /**
    * default implementation
    */
    extractAuthor(dom) {  // eslint-disable-line no-unused-vars
        // Use user preference for default author name
        return this.userPreferences ? this.userPreferences.defaultAuthorName.value : "<unknown>";
    }

    /**
    * default implementation, 
    * if not available, default to English
    */
    extractLanguage(dom) {
        // try jetpack tag
        let locale = dom.querySelector("meta[property='og:locale']");
        if (locale !== null) {
            return locale.getAttribute("content");
        }

        // try <html>'s lang attribute
        locale = dom.querySelector("html").getAttribute("lang");
        return (locale === null) ? "en" : locale;
    }

    /**
    * default implementation, 
    * if not available, return ''
    */
    extractSubject(dom) {   // eslint-disable-line no-unused-vars
        return "";
    }

    extractDescription(dom) {
        let infoDiv = document.createElement("div");
        if (this.getInformationEpubItemChildNodes !== undefined)
        {
            this.populateInfoDiv(infoDiv, dom);
        }
        return infoDiv.textContent;
    }

    /**
    * default implementation, Derived classes will override
    */
    extractSeriesInfo(dom, metaInfo) {  // eslint-disable-line no-unused-vars
    }

    async loadEpubMetaInfo(dom) {  // eslint-disable-line no-unused-vars
        return;
    }

    safeExtract = (extractFn, defaultValue = "") => {
        try {
            return extractFn();
        } catch (err) {
            return defaultValue;
        }
    };

    getEpubMetaInfo(dom, useFullTitle) {
        let metaInfo = new EpubMetaInfo();
        metaInfo.uuid = dom.baseURI;

        metaInfo.title = this.safeExtract(() => this.extractTitle(dom));
        metaInfo.author = this.safeExtract(() => this.extractAuthor(dom).trim());
        metaInfo.language = this.safeExtract(() => this.extractLanguage(dom));
        metaInfo.fileName = this.safeExtract(
            () => this.makeSaveAsFileNameWithoutExtension(metaInfo.title, useFullTitle),
            "web.epub"
        );
        metaInfo.subject = this.safeExtract(() => this.extractSubject(dom));
        metaInfo.description = this.safeExtract(() => this.extractDescription(dom));

        this.extractSeriesInfo(dom, metaInfo);
        return metaInfo;
    }

    singleChapterStory(baseUrl, dom) {
        return [{
            sourceUrl: baseUrl,
            title: this.extractTitle(dom)
        }];
    }

    getBaseUrl(dom) {
        return Array.from(dom.getElementsByTagName("base"))[0].href;
    }

    makeSaveAsFileNameWithoutExtension(title, useFullTitle) {
        let maxFileNameLength = useFullTitle ? 512 : 20;
        let fileName = (title == null)  ? "web" : util.safeForFileName(title, maxFileNameLength);
        if (util.isStringWhiteSpace(fileName)) {
            // title is probably not English, so just use it as is
            fileName = title;
        }
        return fileName;
    }

    async epubItemSupplier() {
        let epubItems = await this.webPagesToEpubItems([...this.state.webPages.values()]);
        this.fixupHyperlinksInEpubItems(epubItems);
        return new EpubItemSupplier(this, epubItems, this.imageCollector);
    }

    async webPagesToEpubItems(webPages) {
        let epubItems = [];
        let index = 0;

        // Skip Information page generation when UPDATING an existing library book
        // (but allow it when adding a new book to library if user preference is enabled)
        let isLibraryBookUpdate = false;
        try {
            // Check if this is an update to an existing library book by looking for library chapters
            // that already exist in a book (have isInBook === true)
            let hasExistingLibraryChapters = [...this.state.webPages.values()].some(chapter =>
                chapter.isInBook === true || chapter.source === "library-only"
            );
            isLibraryBookUpdate = hasExistingLibraryChapters;
        } catch (e) {
            // Fallback: assume not a library update if detection fails
            isLibraryBookUpdate = false;
        }

        if (this.userPreferences.addInformationPage.value &&
            this.getInformationEpubItemChildNodes !== undefined &&
            !isLibraryBookUpdate) {
            epubItems.push(this.makeInformationEpubItem(this.state.firstPageDom));
            ++index;
        }

        for (let webPage of webPages.filter(c => this.isWebPagePackable(c))) {
            let newItems = (webPage.error == null)
                ? await webPage.parser.webPageToEpubItems(webPage, index)
                : this.makePlaceholderEpubItem(webPage, index);
            epubItems = epubItems.concat(newItems);
            index += newItems.length;
            delete(webPage.rawDom);
        }
        return epubItems;
    }

    makeInformationEpubItem(dom) {
        let titleText = UIText.Default.informationPageTitle;
        let title = document.createElement("h1");
        title.appendChild(document.createTextNode(titleText));
        let div = document.createElement("div");
        let urlElement = document.createElement("p");
        let bold = document.createElement("b");
        bold.textContent = UIText.Default.tableOfContentsUrl;
        urlElement.appendChild(bold);
        urlElement.appendChild(document.createTextNode(this.state.chapterListUrl));
        div.appendChild(urlElement);
        let infoDiv = document.createElement("div");
        this.populateInfoDiv(infoDiv, dom);    
        let childNodes = [title, div, infoDiv];
        let chapter = {
            sourceUrl: this.state.chapterListUrl,
            title: titleText,
            newArch: null
        };
        return new ChapterEpubItem(chapter, {childNodes: childNodes}, 0);
    }

    populateInfoDiv(infoDiv, dom) {
        for (let n of this.getInformationEpubItemChildNodes(dom).filter(n => n != null)) {
            let clone = util.sanitizeNode(n);
            if (clone) {
                this.cleanInformationNode(clone);
            }
            if (clone != null) {
                infoDiv.appendChild(clone);
            }
        }
        // this "page" doesn't go through image collector, so strip images
        util.removeChildElementsMatchingSelector(infoDiv, "img");
    }

    cleanInformationNode(node) {     // eslint-disable-line no-unused-vars
        // do nothing, derived class overrides as required
    }

    // called when plugin has obtained the first web page
    async onLoadFirstPage(url, firstPageDom) {
        this.state.firstPageDom = firstPageDom;
        this.state.chapterListUrl = url;
        let chapterUrlsUI = new ChapterUrlsUI(this);
        this.userPreferences.setReadingListCheckbox(url);

        try {
            let chapters = await this.getChapterUrls(firstPageDom, chapterUrlsUI);
            if (this.userPreferences.chaptersPageInChapterList.value) {
                chapters = this.addFirstPageUrlToWebPages(url, firstPageDom, chapters);
            }
            chapters = this.cleanWebPageUrls(chapters);
            chapters?.forEach(chapter => chapter.title = chapter.title?.trim());
            await this.userPreferences.readingList.deselectOldChapters(url, chapters);
            chapterUrlsUI.populateChapterUrlsTable(chapters);
            if (0 < chapters.length) {
                if (chapters[0].sourceUrl === url) {
                    chapters[0].rawDom = firstPageDom;
                    this.updateLoadState(chapters[0]);
                }
                ProgressBar.setValue(0);
            }
            this.state.setPagesToFetch(chapters);
            chapterUrlsUI.connectButtonHandlers();
        } catch (err) {
            ErrorLog.showErrorMessage(err);
        }
    }

    cleanWebPageUrls(webPages) {
        let foundUrls = new Set();
        let isUnique = function(webPage) {
            let unique = !foundUrls.has(webPage.sourceUrl);
            if (unique) {
                foundUrls.add(webPage.sourceUrl);
            }
            return unique;
        };

        return webPages
            .map(this.fixupImgurGalleryUrl)
            .filter(p => util.isUrl(p.sourceUrl))
            .filter(isUnique);
    }

    fixupImgurGalleryUrl(webPage) {
        webPage.sourceUrl = Imgur.fixupImgurGalleryUrl(webPage.sourceUrl);
        return webPage;
    }

    addFirstPageUrlToWebPages(url, firstPageDom, webPages) {
        let present = webPages.find(e => e.sourceUrl === url);
        if (present)
        {
            return webPages;
        } else {
            return [{
                sourceUrl:  url,
                title: this.extractTitle(firstPageDom)
            }].concat(webPages);
        }
    }

    onFetchChaptersClicked() {
        if (0 == this.state.webPages.size) {
            ErrorLog.showErrorMessage(UIText.Error.noChaptersFoundAndFetchClicked);
        } else {
            this.fetchWebPages();
        }
    }

    fetchContent() {
        return this.fetchWebPages();
    }

    setUiToShowLoadingProgress(length) {
        main.getPackEpubButton().disabled = true;
        ProgressBar.setMax(length + 1);
        ProgressBar.setValue(1);
    }

    async fetchWebPages() {
        let pagesToFetch = [...this.state.webPages.values()].filter(c => c.isIncludeable);
        if (pagesToFetch.length === 0) {
            return Promise.reject(new Error("No chapters found."));
        }

        this.setUiToShowLoadingProgress(pagesToFetch.length);

        this.imageCollector.reset();
        this.imageCollector.setCoverImageUrl(CoverImageUI.getCoverImageUrl());

        await this.addParsersToPages(pagesToFetch);
        let index = 0;
        try
        {
            let group = this.groupPagesToFetch(pagesToFetch, index);
            while (0 < group.length) {
                await Promise.all(group.map(async (webPage) => {
                    await this.fetchWebPageContent(webPage);
                    // Process and cache content immediately after download (like Download Chapters does)
                    // Skip processing for cached content to avoid breaking parsers
                    if (webPage.rawDom && !webPage.error && !webPage.isCachedContent) {
                        this.convertRawDomToContent(webPage);
                    }
                }));
                index += group.length;
                group = this.groupPagesToFetch(pagesToFetch, index);
                if (util.sleepController.signal.aborted) {
                    break;
                }
            }
        }
        catch (err)
        {
            ErrorLog.log(err);
        }
    }

    async addParsersToPages(pagesToFetch) {
        parserFactory.addParsersToPages(this, pagesToFetch);
    }

    groupPagesToFetch(webPages, index) {
        return webPages.slice(index, index + this.maxSimultanousFetchSize);
    }

    async fetchWebPageContent(webPage) {
        let pageParser = webPage.parser;

        // Check cache first (checks persistent or session storage based on settings)
        {
            try {
                let cachedContent = await ChapterCache.get(webPage.sourceUrl);
                let cachedError = await ChapterCache.getChapterError(webPage.sourceUrl);

                if (cachedContent) {
                    // Skip the delay for cached content
                    ChapterUrlsUI.showChapterStatus(webPage.row, ChapterUrlsUI.CHAPTER_STATUS_DOWNLOADING, webPage.sourceUrl, webPage.title);

                    // Create a mock DOM with cached content
                    let cachedDom = Parser.makeEmptyDocForContent(webPage.sourceUrl);
                    cachedDom.content.parentNode.replaceChild(cachedContent, cachedDom.content);

                    webPage.rawDom = cachedDom.dom;
                    webPage.isCachedContent = true; // Mark as cached to skip title processing
                    delete webPage.error;

                    // The content is already processed, so we just need to handle images
                    return pageParser.fetchImagesUsedInDocument(cachedContent, webPage);
                } else if (cachedError) {
                    // Chapter has cached error - set error and skip download
                    ChapterUrlsUI.showChapterStatus(webPage.row, ChapterUrlsUI.CHAPTER_STATUS_DOWNLOADING, webPage.sourceUrl, webPage.title);
                    webPage.error = cachedError;
                    webPage.rawDom = null;
                    return Promise.resolve();
                }
            } catch (e) {
                console.error("Error reading from cache:", e);
                // Continue with normal fetch if cache read fails
            }
        }

        // Only apply rate limit delay for actual web fetches
        ChapterUrlsUI.showChapterStatus(webPage.row, ChapterUrlsUI.CHAPTER_STATUS_SLEEPING, webPage.sourceUrl, webPage.title);
        await this.rateLimitDelay();
        ChapterUrlsUI.showChapterStatus(webPage.row, ChapterUrlsUI.CHAPTER_STATUS_DOWNLOADING, webPage.sourceUrl, webPage.title);

        try {
            let webPageDom = await pageParser.fetchChapter(webPage.sourceUrl);
            delete webPage.error;
            webPage.rawDom = webPageDom;
            pageParser.preprocessRawDom(webPageDom);
            pageParser.removeUnusedElementsToReduceMemoryConsumption(webPageDom);
            let content = pageParser.findContent(webPage.rawDom);
            if (content == null) {
                let errorMsg = UIText.Error.errorContentNotFound(webPage.sourceUrl);
                throw new Error(errorMsg);
            }
            return pageParser.fetchImagesUsedInDocument(content, webPage);
        } catch (error) {
            // Always cache the error and update UI regardless of skipChaptersThatFailFetch setting
            webPage.error = error;

            try {
                await ChapterCache.storeChapterError(webPage.sourceUrl, error.message);
                // Update UI to show error state
                let row = ChapterUrlsUI.findRowBySourceUrl(webPage.sourceUrl);
                if (row) {
                    ChapterUrlsUI.setChapterStatusVisuals(
                        row,
                        ChapterUrlsUI.CHAPTER_STATUS_ERROR,
                        webPage.sourceUrl,
                        webPage.title
                    );
                }
            } catch (cacheError) {
                console.log("Failed to cache error:", cacheError);
            }

            // The preference only controls whether to continue or halt the operation
            if (this.userPreferences.skipChaptersThatFailFetch.value) {
                // Log error and continue with other chapters
                ErrorLog.log(error);
            } else {
                webPage.isIncludeable = false;
                throw error; // Halt collecting chapters (error is logged by higher level handler)
            }
        }
    }

    async fetchImagesUsedInDocument(content, webPage) {
        let contentForImageCollection;

        // For cached content, don't apply cleanup again - it was already processed
        if (webPage.isCachedContent) {
            contentForImageCollection = content;
        } else {
            // For fresh content, clone and apply cleanup to ensure we only collect
            // images that will actually be in the final content.
            // Working on a clone because some parsers break if processed multiple times.
            contentForImageCollection = content.cloneNode(true);
            this.customRawDomToContentStep(webPage, contentForImageCollection);
            this.removeUnwantedElementsFromContentElement(contentForImageCollection);
        }

        let revisedContent = await this.imageCollector.preprocessImageTags(contentForImageCollection, webPage.sourceUrl);
        this.imageCollector.findImagesUsedInDocument(revisedContent);
        await this.imageCollector.fetchImages(() => { }, webPage.sourceUrl);
        this.updateLoadState(webPage);
    }

    /**
    * default implementation
    * derived classes override if need to do something to fetched DOM before
    * normal processing steps
    */
    preprocessRawDom(webPageDom) { // eslint-disable-line no-unused-vars
    }

    removeUnusedElementsToReduceMemoryConsumption(webPageDom) {
        util.removeElements(webPageDom.querySelectorAll("select, iframe"));
    }

    // Hook if need to chase hyperlinks in page to get all chapter content
    async fetchChapter(url) {
        return (await HttpClient.wrapFetch(url)).responseXML;
    }

    updateReadingList() {
        this.userPreferences.readingList.update(
            this.state.chapterListUrl,
            [...this.state.webPages.values()]
        );
    }

    updateLoadState(webPage) {
        ChapterUrlsUI.showChapterStatus(webPage.row, ChapterUrlsUI.CHAPTER_STATUS_DOWNLOADED, webPage.sourceUrl, webPage.title);
        ProgressBar.updateValue(1);
    }

    // Hook point, when need to do something when "Pack EPUB" pressed
    onStartCollecting() {
    }    

    fixupHyperlinksInEpubItems(epubItems) {
        let targets = this.sourceUrlToEpubItemUrl(epubItems);
        for (let item of epubItems) {
            for (let link of item.getHyperlinks().filter(this.isUnresolvedHyperlink)) {
                if (!this.hyperlinkToEpubItemUrl(link, targets)) {
                    this.makeHyperlinkAbsolute(link);
                }
            }
        }
    }

    sourceUrlToEpubItemUrl(epubItems) {
        let targets = new Map();
        for (let item of epubItems) {
            let key = util.normalizeUrlForCompare(item.sourceUrl);
            
            // Some source URLs may generate multiple epub items.
            // In that case, want FIRST epub item
            if (!targets.has(key)) {
                targets.set(key, util.makeRelative(item.getZipHref()));
            }
        }
        return targets;
    }

    isUnresolvedHyperlink(link) {
        let href = link.getAttribute("href");
        if (href == null) {
            return false;
        }
        return !href.startsWith("#") &&
            !href.startsWith(EpubStructure.get().relativeTextPath);
    }

    hyperlinkToEpubItemUrl(link, targets) {
        let key = util.normalizeUrlForCompare(link.href);
        let targetInEpub = targets.has(key);
        if (targetInEpub) {
            link.href = targets.get(key) + link.hash;
        }
        return targetInEpub;
    }

    makeHyperlinkAbsolute(link) {
        if (link.href !== link.getAttribute("href")) {
            link.href = link.href;       // eslint-disable-line no-self-assign
        }
    }

    disabled() {
        return null;
    }

    tagAuthorNotes(elements) {
        for (let e of elements) {
            e.classList.add("webToEpub-author-note");
        }
    }

    tagAuthorNotesBySelector(element, selector) {
        let notes = element.querySelectorAll(selector);
        if (this.userPreferences.removeAuthorNotes.value) {
            util.removeElements(notes);
        } else {
            this.tagAuthorNotes(notes);
        }
    }

    static makeEmptyDocForContent(baseUrl) {
        let dom = document.implementation.createHTMLDocument("");
        if (baseUrl != null) {
            util.setBaseTag(baseUrl, dom);        
        }
        let content = dom.createElement("div");
        content.className = Parser.WEB_TO_EPUB_CLASS_NAME;
        dom.body.appendChild(content);
        return {
            dom: dom,
            content: content 
        };
    }

    static findConstrutedContent(dom) {
        return dom.querySelector("div." + Parser.WEB_TO_EPUB_CLASS_NAME);
    }

    async getChapterUrlsFromMultipleTocPages(dom, extractPartialChapterList, getUrlsOfTocPages, chapterUrlsUI)  {
        let chapters = extractPartialChapterList(dom);
        let urlsOfTocPages = getUrlsOfTocPages(dom);
        return await this.getChaptersFromAllTocPages(chapters, extractPartialChapterList, urlsOfTocPages, chapterUrlsUI);
    }

    getRateLimit()
    {
        let manualDelayPerChapterValue = (!isNaN(parseInt(this.userPreferences.manualDelayPerChapter.value)))?parseInt(this.userPreferences.manualDelayPerChapter.value):this.minimumThrottle;
        if (!this.userPreferences.overrideMinimumDelay.value)
        {
            return Math.max(this.minimumThrottle, manualDelayPerChapterValue);
        }
        return manualDelayPerChapterValue;
    }

    async rateLimitDelay() {
        let manualDelayPerChapterValue = this.getRateLimit();
        await util.sleep(manualDelayPerChapterValue);
    }

    async getChaptersFromAllTocPages(chapters, extractPartialChapterList, urlsOfTocPages, chapterUrlsUI, wrapOptions)  {
        if (0 < chapters.length) {
            chapterUrlsUI.showTocProgress(chapters);
        }
        for (let url of urlsOfTocPages) {
            await this.rateLimitDelay();
            let newDom = (await HttpClient.wrapFetch(url, wrapOptions)).responseXML;
            let partialList = extractPartialChapterList(newDom);
            chapterUrlsUI.showTocProgress(partialList);
            chapters = chapters.concat(partialList);
        }
        return chapters;
    }

    async walkTocPages(dom, chaptersFromDom, nextTocPageUrl, chapterUrlsUI) {
        let chapters = chaptersFromDom(dom);
        chapterUrlsUI.showTocProgress(chapters);
        let url = nextTocPageUrl(dom, chapters, chapters);
        while (url != null) {
            await this.rateLimitDelay();
            dom = (await HttpClient.wrapFetch(url)).responseXML;
            let partialList = chaptersFromDom(dom);
            chapterUrlsUI.showTocProgress(partialList);
            chapters = chapters.concat(partialList);
            url = nextTocPageUrl(dom, chapters, partialList);
        }
        return chapters;
    }

    moveFootnotes(dom, content, footnotes) {
        if (0 < footnotes.length) {
            let list = dom.createElement("ol");
            for (let f of footnotes) {
                let item = dom.createElement("li");
                f.removeAttribute("style");
                item.appendChild(f);
                list.appendChild(item);
            }
            let header = dom.createElement("h2");
            header.appendChild(dom.createTextNode("Footnotes"));
            content.appendChild(header);
            content.appendChild(list);
        }
    }

    async walkPagesOfChapter(url, moreChapterTextUrl) {
        let dom = (await HttpClient.wrapFetch(url)).responseXML;
        let count = 2;
        let nextUrl = moreChapterTextUrl(dom, url, count);
        let oldContent = this.findContent(dom);
        while (nextUrl != null) {
            await this.rateLimitDelay();
            let nextDom = (await HttpClient.wrapFetch(nextUrl)).responseXML;
            let newContent = this.findContent(nextDom);
            nextUrl = moreChapterTextUrl(nextDom, url, ++count);
            oldContent.appendChild(dom.createElement("br"));
            util.moveChildElements(newContent, oldContent);
        }
        return dom;
    }    
}

Parser.WEB_TO_EPUB_CLASS_NAME = "webToEpubContent";
