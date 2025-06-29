"use strict";

parserFactory.register("chrysanthemumgarden.com", () => new ChrysanthemumgardenParser());

class ChrysanthemumgardenParser extends WordpressBaseParser {
    constructor() {
        super();
    }

    populateUIImpl() {
        document.getElementById("passwordRow").hidden = false;
        document.getElementById("removeAuthorNotesRow").hidden = false;
        
        // Pre-populate password field with saved value for this site
        let passwordInput = document.getElementById("passwordInput");
        if (passwordInput) {
            let hostname = "chrysanthemumgarden.com";
            let savedPassword = this.userPreferences.getSitePassword(hostname);
            passwordInput.value = savedPassword;
            
            // Set up event listener to save password when changed
            passwordInput.addEventListener("input", () => {
                this.userPreferences.setSitePassword(hostname, passwordInput.value);
            });
        }
    }

    customRawDomToContentStep(chapter, content) {
        if (!this.userPreferences.removeAuthorNotes.value) {
            let notes = [...chapter.rawDom.querySelectorAll("div.tooltip-container")];
            for (let n of notes) {
                content.appendChild(n);
            }
        }

        // get all elements where style contains height of 1px and remove them
        let onePxElements = content.querySelectorAll("[style*='height:1px']");
        util.removeElements(onePxElements);
    }

    async fetchChapter(url) {
        let newDom = (await HttpClient.wrapFetch(url)).responseXML;
        let passwordForm = ChrysanthemumgardenParser.getPasswordForm(newDom);
        if (passwordForm) {
            let formData = ChrysanthemumgardenParser.makePasswordFormData(passwordForm);
            let options = {
                method: "POST",
                credentials: "include",
                body: formData
            };
            newDom = (await HttpClient.wrapFetch(url, {fetchOptions: options})).responseXML;
        }
        return newDom;
    }

    static getPasswordForm(dom) {
        return dom.querySelector("form#password-lock");
    }

    static makePasswordFormData(form) {
        let formData = new FormData();
        let password = document.getElementById("passwordInput").value;
        formData.append("site-pass", password);
        formData.append("nonce-site-pass", ChrysanthemumgardenParser.getInputValue(form, "#nonce-site-pass"));
        formData.append("_wp_http_referer", ChrysanthemumgardenParser.getInputValue(form, "[name='_wp_http_referer']"));
        return formData;
    }

    preprocessRawDom(webPageDom) {
        let content = this.findContent(webPageDom);
        if (!this.userPreferences.removeAuthorNotes.value) {
            let notes = [...webPageDom.querySelectorAll("div.tooltip-container")];
            for (let n of notes) {
                content.appendChild(n);
            }
        }
        util.resolveLazyLoadedImages(webPageDom, "img.br-lazy", "data-breeze");
    }

    static getInputValue(form, selector) {
        return form.querySelector("input" + selector).getAttribute("value");
    }

    findCoverImageUrl(dom) {
        let cover = dom.querySelector(".materialboxed");
        if (cover != null) {
            return cover.src;
        }
        return super.findCoverImageUrl(dom);
    }
}
