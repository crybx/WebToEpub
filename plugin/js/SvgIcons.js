/* eslint-disable */
/*
    SVG Icon constants for WebToEpub
    These store the exact SVG content from the original .svg files
*/

"use strict";

class SvgIcons {
    static ARROW_CLOCKWISE = `
<!-- source: https://icons.getbootstrap.com/icons/arrow-clockwise/ -->
<svg xmlns="http://www.w3.org/2000/svg"
     fill="currentColor"
     class="bi bi-arrow-clockwise"
     viewBox="0 0 16 16">
    <path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2z"/>
    <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466"/>
</svg>`;

    static CHAPTER_STATE_DOWNLOADING = `
<svg version="1.1"
     baseProfile="full"
     viewBox="0 0 32 32"
     fill="dodgerblue"
     xmlns="http://www.w3.org/2000/svg">
  <rect x="12" y="4" width="8" height="12" />
  <polygon points="4 16, 28 16, 16 28, 15 28" />
</svg>`;

    static CHAPTER_STATE_LOADED = `
<svg version="1.1"
     baseProfile="full"
     viewBox="0 0 32 32"
     stroke-width="2" stroke="green"
     xmlns="http://www.w3.org/2000/svg">
  <line x1="10" y1="23" x2="15" y2="28" />
  <line x1="15" y1="28" x2="23" y2="4" />
</svg>`;

    static CHAPTER_STATE_NONE = `
<svg version="1.1"
     baseProfile="full"
     viewBox="0 0 32 32"
     xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="transparent" />
</svg>`;

    static CHAPTER_STATE_SLEEPING = `
<svg version="1.1"
     baseProfile="full"
     stroke-width="2" stroke="#965607"
     viewBox="0 0 32 32"
     xmlns="http://www.w3.org/2000/svg">
  <line y2="4.3" x2="15.1" y1="4.3" x1="6.2" />
  <line y2="11.1" x2="15.0" y1="11.1" x1="6.0" />
  <line y2="11.5" x2="6.7" y1="4.4" x1="14.4" stroke-dasharray="null" />
  <line y2="9.0" x2="27.7" y1="9.0" x1="18.7" />
  <line y2="15.8" x2="27.6" y1="15.8" x1="18.6" />
  <line y2="16.2" x2="19.2" y1="9.1" x1="26.9" stroke-dasharray="null" />
  <line y2="20.4" x2="16.3" y1="20.4" x1="7.3" />
  <line y2="27.3" x2="16.2" y1="27.3" x1="7.2" />
  <line y2="27.6" x2="7.9" y1="20.6" x1="15.6" stroke-dasharray="null" />
</svg>`;

    static DOWNLOAD = `
<!-- source: https://icons.getbootstrap.com/icons/download/ -->
<svg xmlns="http://www.w3.org/2000/svg"
     fill="currentColor"
     class="bi bi-download"
     viewBox="0 0 16 16">
    <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"/>
    <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708z"/>
</svg>`;

    static EYE_FILL = `
<!-- source: https://icons.getbootstrap.com/icons/eye-fill/ -->
<svg xmlns="http://www.w3.org/2000/svg"
     fill="dodgerblue"
     class="bi bi-eye-fill"
     viewBox="0 0 16 16">
    <path d="M10.5 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0"/>
    <path d="M0 8s3-5.5 8-5.5S16 8 16 8s-3 5.5-8 5.5S0 8 0 8m8 3.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7"/>
</svg>`;

    static FILE_EARMARK_CHECK = `
<!-- source: https://icons.getbootstrap.com/icons/file-earmark-check/ -->
<svg xmlns="http://www.w3.org/2000/svg"
     fill="dodgerblue"
     class="bi bi-file-earmark-check"
     viewBox="0 0 16 16">
    <path d="M10.854 7.854a.5.5 0 0 0-.708-.708L7.5 9.793 6.354 8.646a.5.5 0 1 0-.708.708l1.5 1.5a.5.5 0 0 0 .708 0z"/>
    <path d="M14 14V4.5L9.5 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2M9.5 3A1.5 1.5 0 0 0 11 4.5h2V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h5.5z"/>
</svg>`

    static FILE_EARMARK_CHECK_FILL = `
<!-- source: https://icons.getbootstrap.com/icons/file-earmark-check-fill/ -->
<svg xmlns="http://www.w3.org/2000/svg"
     fill="green"
     class="bi bi-file-earmark-check-fill"
     viewBox="0 0 16 16">
    <path d="M9.293 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4.707A1 1 0 0 0 13.707 4L10 .293A1 1 0 0 0 9.293 0M9.5 3.5v-2l3 3h-2a1 1 0 0 1-1-1m1.354 4.354-3 3a.5.5 0 0 1-.708 0l-1.5-1.5a.5.5 0 1 1 .708-.708L7.5 9.793l2.646-2.647a.5.5 0 0 1 .708.708"/>
</svg>`

    static THREE_DOTS_VERTICAL = `
<!-- source: https://icons.getbootstrap.com/icons/three-dots-vertical/ -->
<svg xmlns="http://www.w3.org/2000/svg"
     fill="currentColor"
     class="bi bi-three-dots-vertical"
     viewBox="0 0 16 16">
    <path d="M9.5 13a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m0-5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m0-5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0"/>
</svg>`;

    static TRASH3_FILL = `
<!-- source: https://icons.getbootstrap.com/icons/trash3-fill/ -->
<svg xmlns="http://www.w3.org/2000/svg"
     fill="currentColor"
     class="bi bi-trash3-fill"
     viewBox="0 0 16 16">
    <path d="M11 1.5v1h3.5a.5.5 0 0 1 0 1h-.538l-.853 10.66A2 2 0 0 1 11.115 16h-6.23a2 2 0 0 1-1.994-1.84L2.038 3.5H1.5a.5.5 0 0 1 0-1H5v-1A1.5 1.5 0 0 1 6.5 0h3A1.5 1.5 0 0 1 11 1.5m-5 0v1h4v-1a.5.5 0 0 0-.5-.5h-3a.5.5 0 0 0-.5.5M4.5 5.029l.5 8.5a.5.5 0 1 0 .998-.06l-.5-8.5a.5.5 0 1 0-.998.06m6.53-.528a.5.5 0 0 0-.528.47l-.5 8.5a.5.5 0 0 0 .998.058l.5-8.5a.5.5 0 0 0-.47-.528M8 4.5a.5.5 0 0 0-.5.5v8.5a.5.5 0 0 0 1 0V5a.5.5 0 0 0-.5-.5"/>
</svg>`;

    /**
     * Create DOM element from SVG string
     * @param {string} svgString - The SVG string constant
     * @returns {Element} SVG DOM element
     */
    static createSvgElement(svgString) {
        let container = document.createElement("div");
        container.innerHTML = svgString;
        // Find the SVG element (skip any HTML comments)
        for (let child of container.children) {
            if (child.tagName === "svg") {
                return child;
            }
        }
        // Fallback: if no SVG element found, return the first element child
        return container.firstElementChild || container.children[0];
    }
}