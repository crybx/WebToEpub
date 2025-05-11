// polyfill for Chrome functions not available under qunit

"use strict";

class Chrome {
    constructor() {
        this.messages = new Map();
        this.messages.set("defaultUUID", "No UUID supplied");
        this.messages.set("defaultTitle", "No title supplied");
        this.messages.set("defaultAuthor", "No author supplied");
    }
}

Chrome.prototype.i18n = {
    getMessage: id => new Chrome().messages[id]
}

Chrome.prototype.downloads = { 
    onChanged: {
        addListener: () => {}
    }
};

var chrome = new Chrome();

// Mock main object for EpubStructure.js dependency
var main = {
    getUserPreferences: () => null // Return null so EpubStructure.get() uses explicit parameters
};
