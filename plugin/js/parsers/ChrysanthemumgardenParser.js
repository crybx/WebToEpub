"use strict";

parserFactory.register("chrysanthemumgarden.com", () => new ChrysanthemumgardenParser());

class ChrysanthemumgardenParser extends WordpressBaseParser {
    constructor() {
        super();
    }

    populateUI(dom) {
        super.populateUI(dom);
        document.getElementById("passwordRow").hidden = false;
        document.getElementById("removeAuthorNotesRow").hidden = false; 
    }

    customRawDomToContentStep(chapter, content) {
        if (!this.userPreferences.removeAuthorNotes.value) {
            let notes = [...chapter.rawDom.querySelectorAll("div.tooltip-container")];
            for (let n of notes) {
                content.appendChild(n);
            }
        }

        let nodes = content.querySelectorAll(".jum");
        for (let node of nodes) {
            this.dejumble(node);
        }

        // get all elements where style contains height of 1px and remove them
        let onePxElements = content.querySelectorAll("[style*='height:1px']");
        util.removeElements(onePxElements);
    }

    dejumble(node) {
        const alphab = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const cypher = 'jymvfoutlpxiwcbqdgraenkzshCDJGSMXLPABOZRYUHEVKFNQWTI';
        let sArray = node.textContent.split("");
        for (let i = 0; i < sArray.length; i++) {
            let index = cypher.indexOf(sArray[i]);
            if (index !== -1) {
                sArray[i] = alphab[index];
            }
        }
        node.textContent = sArray.join("");
        node.classList.remove("jum");
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

    static getInputValue(form, selector) {
        return form.querySelector("input" + selector).getAttribute("value");
    }
}
