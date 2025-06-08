/* eslint-disable */
/*
    SVG Icon constants for WebToEpub
    These store the exact SVG content from the original .svg files
*/

"use strict";

class SvgIcons {
    static ARROW_BAR_RIGHT = `
<!-- source: https://icons.getbootstrap.com/icons/arrow-bar-right/ -->
<svg xmlns="http://www.w3.org/2000/svg"
     fill="currentColor"
     class="bi bi-arrow-bar-right"
     viewBox="0 0 16 16">
  <path fill-rule="evenodd" d="M6 8a.5.5 0 0 0 .5.5h5.793l-2.147 2.146a.5.5 0 0 0 .708.708l3-3a.5.5 0 0 0 0-.708l-3-3a.5.5 0 0 0-.708.708L12.293 7.5H6.5A.5.5 0 0 0 6 8m-2.5 7a.5.5 0 0 1-.5-.5v-13a.5.5 0 0 1 1 0v13a.5.5 0 0 1-.5.5"/>
</svg>`

    static ARROW_CLOCKWISE = `
<!-- source: https://icons.getbootstrap.com/icons/arrow-clockwise/ -->
<svg xmlns="http://www.w3.org/2000/svg"
     fill="currentColor"
     class="bi bi-arrow-clockwise"
     viewBox="0 0 16 16">
    <path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2z"/>
    <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466"/>
</svg>`;

    static ARROW_UP = `
<!-- source: https://icons.getbootstrap.com/icons/arrow-up/ -->
<svg xmlns="http://www.w3.org/2000/svg"
     fill="currentColor"
     class="bi bi-arrow-up"
     viewBox="0 0 16 16">
  <path fill-rule="evenodd" d="M8 15a.5.5 0 0 0 .5-.5V2.707l3.146 3.147a.5.5 0 0 0 .708-.708l-4-4a.5.5 0 0 0-.708 0l-4 4a.5.5 0 1 0 .708.708L7.5 2.707V14.5a.5.5 0 0 0 .5.5"/>
</svg>`

    static ARROW_DOWN = `
<!-- source: https://icons.getbootstrap.com/icons/arrow-down/ -->
<svg xmlns="http://www.w3.org/2000/svg"
     fill="currentColor"
     class="bi bi-arrow-down"
     viewBox="0 0 16 16">
  <path fill-rule="evenodd" d="M8 1a.5.5 0 0 1 .5.5v11.793l3.146-3.147a.5.5 0 0 1 .708.708l-4 4a.5.5 0 0 1-.708 0l-4-4a.5.5 0 0 1 .708-.708L7.5 13.293V1.5A.5.5 0 0 1 8 1"/>
</svg>`

    static BOOK = `
<!-- source: https://icons.getbootstrap.com/icons/book/ -->
<svg xmlns="http://www.w3.org/2000/svg" 
     fill="currentColor"
     class="bi bi-book"
     viewBox="0 0 16 16">
  <path d="M1 2.828c.885-.37 2.154-.769 3.388-.893 1.33-.134 2.458.063 3.112.752v9.746c-.935-.53-2.12-.603-3.213-.493-1.18.12-2.37.461-3.287.811zm7.5-.141c.654-.689 1.782-.886 3.112-.752 1.234.124 2.503.523 3.388.893v9.923c-.918-.35-2.107-.692-3.287-.81-1.094-.111-2.278-.039-3.213.492zM8 1.783C7.015.936 5.587.81 4.287.94c-1.514.153-3.042.672-3.994 1.105A.5.5 0 0 0 0 2.5v11a.5.5 0 0 0 .707.455c.882-.4 2.303-.881 3.68-1.02 1.409-.142 2.59.087 3.223.877a.5.5 0 0 0 .78 0c.633-.79 1.814-1.019 3.222-.877 1.378.139 2.8.62 3.681 1.02A.5.5 0 0 0 16 13.5v-11a.5.5 0 0 0-.293-.455c-.952-.433-2.48-.952-3.994-1.105C10.413.809 8.985.936 8 1.783"/>
</svg>`

    static BOX_ARROW_RIGHT = `
<!-- source: https://icons.getbootstrap.com/icons/box-arrow-right/ -->
<svg xmlns="http://www.w3.org/2000/svg"
     fill="currentColor"
     class="bi bi-box-arrow-right"
     viewBox="0 0 16 16">
  <path fill-rule="evenodd" d="M10 12.5a.5.5 0 0 1-.5.5h-8a.5.5 0 0 1-.5-.5v-9a.5.5 0 0 1 .5-.5h8a.5.5 0 0 1 .5.5v2a.5.5 0 0 0 1 0v-2A1.5 1.5 0 0 0 9.5 2h-8A1.5 1.5 0 0 0 0 3.5v9A1.5 1.5 0 0 0 1.5 14h8a1.5 1.5 0 0 0 1.5-1.5v-2a.5.5 0 0 0-1 0z"/>
  <path fill-rule="evenodd" d="M15.854 8.354a.5.5 0 0 0 0-.708l-3-3a.5.5 0 0 0-.708.708L14.293 7.5H5.5a.5.5 0 0 0 0 1h8.793l-2.147 2.146a.5.5 0 0 0 .708.708z"/>
</svg>`

    static CHAPTER_STATE_DOWNLOADING = `
<svg version="1.1"
     baseProfile="full"
     viewBox="0 0 32 32"
     fill="currentColor"
     class="downloading-icon"
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
     stroke-width="2" stroke="currentColor"
     class="sleeping-icon"
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

    static CHECK_CIRCLE = `
<!-- source: https://icons.getbootstrap.com/icons/check-circle/ -->
<svg xmlns="http://www.w3.org/2000/svg"
     fill="currentColor"
     class="bi bi-check-circle"
     viewBox="0 0 16 16">
  <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"/>
  <path d="m10.97 4.97-.02.022-3.473 4.425-2.093-2.094a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-1.071-1.05"/>
</svg>`

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
     fill="currentColor"
     class="bi bi-eye-fill"
     viewBox="0 0 16 16">
    <path d="M10.5 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0"/>
    <path d="M0 8s3-5.5 8-5.5S16 8 16 8s-3 5.5-8 5.5S0 8 0 8m8 3.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7"/>
</svg>`;

    static FILE_EARMARK_CHECK = `
<!-- source: https://icons.getbootstrap.com/icons/file-earmark-check/ -->
<svg xmlns="http://www.w3.org/2000/svg"
     fill="currentColor"
     class="bi bi-file-earmark-check"
     viewBox="0 0 16 16">
    <path d="M10.854 7.854a.5.5 0 0 0-.708-.708L7.5 9.793 6.354 8.646a.5.5 0 1 0-.708.708l1.5 1.5a.5.5 0 0 0 .708 0z"/>
    <path d="M14 14V4.5L9.5 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2M9.5 3A1.5 1.5 0 0 0 11 4.5h2V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h5.5z"/>
</svg>`

    static FILE_EARMARK_CHECK_FILL = `
<!-- source: https://icons.getbootstrap.com/icons/file-earmark-check-fill/ -->
<svg xmlns="http://www.w3.org/2000/svg"
     fill="currentColor"
     class="bi bi-file-earmark-check-fill"
     viewBox="0 0 16 16">
    <path d="M9.293 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4.707A1 1 0 0 0 13.707 4L10 .293A1 1 0 0 0 9.293 0M9.5 3.5v-2l3 3h-2a1 1 0 0 1-1-1m1.354 4.354-3 3a.5.5 0 0 1-.708 0l-1.5-1.5a.5.5 0 1 1 .708-.708L7.5 9.793l2.646-2.647a.5.5 0 0 1 .708.708"/>
</svg>`

    static FILTER = `
<!-- https://icons.getbootstrap.com/icons/filter/ -->
<svg xmlns="http://www.w3.org/2000/svg"
     fill="currentColor"
     class="bi bi-filter"
     viewBox="0 0 16 16">
  <path d="M6 10.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5m-2-3a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5m-2-3a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5"/>
</svg>`

    static INFO_FILL = `
<!-- source: https://icons.getbootstrap.com/icons/info-circle-fill/ -->
<svg xmlns="http://www.w3.org/2000/svg"
     fill="currentColor"
     class="bi bi-info-circle-fill"
     viewBox="0 0 16 16">
  <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16m.93-9.412-1 4.705c-.07.34.029.533.304.533.194 0 .487-.07.686-.246l-.088.416c-.287.346-.92.598-1.465.598-.703 0-1.002-.422-.808-1.319l.738-3.468c.064-.293.006-.399-.287-.47l-.451-.081.082-.381 2.29-.287zM8 5.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2"/>
</svg>`

    static STOP_CIRCLE_FILL = `
<!-- source: https://icons.getbootstrap.com/icons/stop-circle-fill/ -->
<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-stop-circle-fill" viewBox="0 0 16 16">
  <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0M6.5 5A1.5 1.5 0 0 0 5 6.5v3A1.5 1.5 0 0 0 6.5 11h3A1.5 1.5 0 0 0 11 9.5v-3A1.5 1.5 0 0 0 9.5 5z"/>
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

    static X_CIRCLE = `
<!-- source: https://icons.getbootstrap.com/icons/x-circle/ -->
<svg xmlns="http://www.w3.org/2000/svg"
     fill="currentColor"
     class="bi bi-x-circle"
     viewBox="0 0 16 16">
  <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"/>
  <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708"/>
</svg>`


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