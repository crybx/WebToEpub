
"use strict";


/** Functions specific to Firefox version of plug-in */
class Firefox {
    constructor () {
    }

    /** fetch() calls on Firefox include an origin header.
        Which makes some sites fail with a CORS violation.
        Need to use a webRequest to remove origin from header.
    */    
    static filterHeaders(e) {
        return {requestHeaders: e.requestHeaders.filter(
            h => ((h.name.toLowerCase() !== "origin")
                || !h.value.startsWith("moz-extension://"))
        )};
    }

    static startWebRequestListeners() {
        browser.webRequest.onBeforeSendHeaders.addListener(
            Firefox.filterHeaders,
            {urls: ["<all_urls>"]},
            ["blocking", "requestHeaders"]
        );
    }
}

