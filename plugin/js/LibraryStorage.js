/*
  LibraryStorage class - handles all storage operations, EPUB file handling, and low-level data management
*/
"use strict";

const LibFileReader = new FileReader();

class LibraryStorage {
    
    /**
     * Add EPUB to library, merging with existing if found
     */
    static async LibAddToLibrary(AddEpub, fileName, startingUrlInput, overwriteExisting, backgroundDownload, userPreferences) {
        LibraryUI.LibShowLoadingText();
        let CurrentLibStoryURLKeys = await LibraryStorage.LibGetAllLibStorageKeys("LibStoryURL");
        let CurrentLibStoryURLs = await LibraryStorage.LibGetFromStorageArray(CurrentLibStoryURLKeys);
        let LibidURL = -1;
        for (let i = 0; i < CurrentLibStoryURLKeys.length; i++) {
            if (CurrentLibStoryURLs[CurrentLibStoryURLKeys[i]] == startingUrlInput) {
                LibidURL = CurrentLibStoryURLKeys[i].replace("LibStoryURL","");
                continue;
            }
        }
        if (LibidURL == -1) {
            LibraryStorage.LibHandleUpdate(-1, AddEpub, main.getValueFromUiField("startingUrlInput"), fileName.replace(".epub", ""), LibidURL);
            if (userPreferences.LibDownloadEpubAfterUpdate.value) {
                return Download.save(AddEpub, fileName, overwriteExisting, backgroundDownload);
            } else {
                return new Promise((resolve) => {resolve();});
            }
        }

        let PreviousEpubBase64 = await LibraryStorage.LibGetFromStorage("LibEpub" + LibidURL);
        let MergedEpub = await LibraryStorage.LibMergeEpub(PreviousEpubBase64, AddEpub, LibidURL);
        if (userPreferences.LibDownloadEpubAfterUpdate.value) {
            fileName = EpubPacker.addExtensionIfMissing(await LibraryStorage.LibGetFromStorage("LibFilename" + LibidURL));
            if (Download.isFileNameIllegalOnWindows(fileName)) {
                ErrorLog.showErrorMessage(UIText.Error.errorIllegalFileName(fileName, Download.illegalWindowsFileNameChars));
                return;
            }
            return Download.save(MergedEpub, fileName, overwriteExisting, backgroundDownload);
        } else {
            return new Promise((resolve) => {resolve();});
        }
    }
    
    /**
     * Get the highest file number from EPUB content based on regex pattern
     */
    static LibHighestFileNumber(Content, Regex, String) {
        let array = Content.map(a => a = a.filename).filter(a => a.match(Regex)).map(a => a = parseInt(a.substring(String.length, String.length + 4)));
        return Math.max(...array);
    }

    /**
     * Merge two EPUBs together
     */
    static async LibMergeEpub(PreviousEpubBase64, AddEpubBlob, LibidURL) {
        LibraryUI.LibShowLoadingText();

        let PreviousEpubReader = await new zip.Data64URIReader(PreviousEpubBase64);
        let PreviousEpubZip = new zip.ZipReader(PreviousEpubReader, {useWebWorkers: false});
        let PreviousEpubContent = await PreviousEpubZip.getEntries();
        PreviousEpubContent = PreviousEpubContent.filter(a => a.directory == false);

        let AddEpubReader = await new zip.BlobReader(AddEpubBlob);
        let AddEpubZip = new zip.ZipReader(AddEpubReader, {useWebWorkers: false});
        let AddEpubContent = await AddEpubZip.getEntries();
        AddEpubContent = AddEpubContent.filter(a => a.directory == false);

        let MergedEpubWriter = new zip.BlobWriter("application/epub+zip");
        let MergedEpubZip = new zip.ZipWriter(MergedEpubWriter,{useWebWorkers: false,compressionMethod: 8, extendedTimestamp: false});
        //Copy PreviousEpub in MergedEpub
        let epubPaths = EpubStructure.get();
        for (let element of PreviousEpubContent.filter(a => a.filename !== epubPaths.contentOpf && a.filename !== epubPaths.tocNcx && a.filename !== epubPaths.navXhtml)) {
            if (element.filename === "mimetype") {
                MergedEpubZip.add(element.filename, new zip.TextReader(await element.getData(new zip.TextWriter())), {compressionMethod: 0});
                continue;
            }
            MergedEpubZip.add(element.filename, new zip.BlobReader(await element.getData(new zip.BlobWriter())));
        }

        let ImagenumberPreviousEpub = LibraryStorage.LibHighestFileNumber(PreviousEpubContent, new RegExp(`${epubPaths.imagesDirPattern}[0-9]{4}`), epubPaths.imagesDirPattern) + 1;
        let TextnumberPreviousEpub = LibraryStorage.LibHighestFileNumber(PreviousEpubContent, new RegExp(`${epubPaths.textDirPattern}[0-9]{4}`), epubPaths.textDirPattern) + 1;

        let AddEpubImageFolder = AddEpubContent.filter(a => a.filename.match(new RegExp(`${epubPaths.imagesDirPattern}[0-9]{4}`)));
        let AddEpubImageFolderFilenames = AddEpubImageFolder.map(a => a = a.filename).sort();
        let AddEpubTextFolder = AddEpubContent.filter(a => a.filename.match(new RegExp(`${epubPaths.textDirPattern}[0-9]{4}`)));
        let ImagenumberAddEpubIndex = 1;
        let TextnumberAddEpub = 0;
        let NewChapter = 0;
        if (AddEpubTextFolder.filter( a => a.filename === epubPaths.informationXhtml).length !== 0) {
            TextnumberAddEpub++;
        }
        let AddEpubTextFile;
        let AddEpubImageFile;
        let PreviousEpubContentText = await PreviousEpubContent.filter( a => a.filename === epubPaths.contentOpf)[0].getData(new zip.TextWriter());
        let PreviousEpubTocText = await PreviousEpubContent.filter( a => a.filename === epubPaths.tocNcx)[0].getData(new zip.TextWriter());
        let PreviousEpubTocEpub3Text =  await (PreviousEpubContent.filter( a => a.filename === epubPaths.navXhtml))?.[0]?.getData(new zip.TextWriter());
        let AddEpubContentText = await AddEpubContent.filter( a => a.filename === epubPaths.contentOpf)[0].getData(new zip.TextWriter());
        let AddEpubTocText = await AddEpubContent.filter( a => a.filename === epubPaths.tocNcx)[0].getData(new zip.TextWriter());

        let regex1, regex2, regex3, regex4, string1, string2, string3, string4;
        // eslint-disable-next-line
        while ((AddEpubTextFile = AddEpubTextFolder.filter(a => a.filename.match(new RegExp("^" + epubPaths.textDirPattern + ("0000"+TextnumberAddEpub).slice(-4)+".+\.xhtml")))).length != 0) {

            AddEpubTextFile = AddEpubTextFile[0];
            let AddEpubTextFilestring = await AddEpubTextFile.getData(new zip.TextWriter());
            // eslint-disable-next-line
            while ((AddEpubImageFile = AddEpubImageFolder.filter(a => a.filename == AddEpubImageFolderFilenames[ImagenumberAddEpubIndex])).length != 0) {
                AddEpubImageFile = AddEpubImageFile[0];
                let ImagenumberAddEpub = parseInt(AddEpubImageFile.filename.substring(epubPaths.imagesDirPattern.length, epubPaths.imagesDirPattern.length + 4));
                if (AddEpubTextFilestring.search(AddEpubImageFile.filename.replace(epubPaths.contentDirPattern, ""))==-1) {
                    break;
                }
                // eslint-disable-next-line
                MergedEpubZip.add(AddEpubImageFile.filename.replace(("0000"+ImagenumberAddEpub).slice(-4),("0000"+ImagenumberPreviousEpub).slice(-4)),  new zip.BlobReader(await AddEpubImageFile.getData(new zip.BlobWriter())));
                let oldImagePath = AddEpubImageFile.filename.replace(epubPaths.contentDirPattern, "");
                let newImagePath = oldImagePath.replace(("/" + epubPaths.imagesDirRel + "/0000"+ImagenumberAddEpub).slice(-4), ("/" + epubPaths.imagesDirRel + "/0000"+ImagenumberPreviousEpub).slice(-4));
                AddEpubTextFilestring = AddEpubTextFilestring.replace(oldImagePath, newImagePath);
                // eslint-disable-next-line
                regex1 = new RegExp('<dc:source id="id.image'+(("0000"+ImagenumberAddEpub).slice(-4))+'">'+".+?<\/dc:source>");
                regex2 = ("0000"+ImagenumberAddEpub).slice(-4);
                string1 = "</metadata>";
                string2 = ("0000"+ImagenumberPreviousEpub).slice(-4);
                PreviousEpubContentText = LibraryStorage.LibManipulateContentFromTo(AddEpubContentText, PreviousEpubContentText, regex1, string1, regex2, string2);
                // eslint-disable-next-line
                regex1 = new RegExp('<item href="' + epubPaths.imagesDirRel + '\/'+(("0000"+ImagenumberAddEpub).slice(-4))+".+?\/>");
                // eslint-disable-next-line
                regex2 = new RegExp(epubPaths.imagesDirRel + "\/"+(("0000"+ImagenumberAddEpub).slice(-4))+"");
                // eslint-disable-next-line
                regex3 = new RegExp('id="image'+(("0000"+ImagenumberAddEpub).slice(-4)));
                string1 = "</manifest>";
                string2 = epubPaths.imagesDirRel + "/"+(("0000"+ImagenumberPreviousEpub).slice(-4));
                // eslint-disable-next-line
                string3 = 'id="image'+(("0000"+ImagenumberPreviousEpub).slice(-4));
                PreviousEpubContentText = LibraryStorage.LibManipulateContentFromTo(AddEpubContentText, PreviousEpubContentText, regex1, string1, regex2, string2, regex3, string3);
                ImagenumberAddEpubIndex++;
                ImagenumberPreviousEpub++;
            }
            let newChaptername = AddEpubTextFile.filename.replace(("0000"+TextnumberAddEpub).slice(-4),("0000"+TextnumberPreviousEpub).slice(-4));
            MergedEpubZip.add(newChaptername, new zip.TextReader(AddEpubTextFilestring));
            // eslint-disable-next-line
            regex1 = new RegExp('<dc:source id="id.xhtml'+(("0000"+TextnumberAddEpub).slice(-4))+'">'+".+?<\/dc:source>");
            regex2 = ("0000"+TextnumberAddEpub).slice(-4);
            string1 = "</metadata>";
            string2 = ("0000"+TextnumberPreviousEpub).slice(-4);
            PreviousEpubContentText = LibraryStorage.LibManipulateContentFromTo(AddEpubContentText, PreviousEpubContentText, regex1, string1, regex2, string2);
            // eslint-disable-next-line
            regex1 = new RegExp('<item href="' + epubPaths.textDirRel + '\/'+(("0000"+TextnumberAddEpub).slice(-4))+".+?\/>");
            // eslint-disable-next-line
            regex2 = new RegExp(epubPaths.textDirRel + "\/"+(("0000"+TextnumberAddEpub).slice(-4))+"");
            // eslint-disable-next-line
            regex3 = new RegExp('id="xhtml'+(("0000"+TextnumberAddEpub).slice(-4)));
            string1 = "</manifest>";
            string2 = epubPaths.textDirRel + "/"+(("0000"+TextnumberPreviousEpub).slice(-4));
            // eslint-disable-next-line
            string3 = 'id="xhtml'+(("0000"+TextnumberPreviousEpub).slice(-4));
            PreviousEpubContentText = LibraryStorage.LibManipulateContentFromTo(AddEpubContentText, PreviousEpubContentText, regex1, string1, regex2, string2, regex3, string3);
            // eslint-disable-next-line
            regex1 = new RegExp('<itemref idref="xhtml'+(("0000"+TextnumberAddEpub).slice(-4))+'"\/>');
            regex2 = new RegExp("xhtml"+(("0000"+TextnumberAddEpub).slice(-4))+"");
            string1 = "</spine>";
            string2 = "xhtml"+(("0000"+TextnumberPreviousEpub).slice(-4));
            PreviousEpubContentText = LibraryStorage.LibManipulateContentFromTo(AddEpubContentText, PreviousEpubContentText, regex1, string1, regex2, string2);
            // eslint-disable-next-line
            regex1 = new RegExp('<navPoint id="body'+(("0000"+(TextnumberAddEpub+1)).slice(-4))+'".+?<\/navPoint>');
            regex2 = new RegExp("body"+(("0000"+(TextnumberAddEpub+1)).slice(-4))+"");
            // eslint-disable-next-line
            regex3 = new RegExp('playOrder="'+(TextnumberAddEpub+1)+'"');
            // eslint-disable-next-line
            regex4 = new RegExp('<content src="'+AddEpubTextFile.filename.slice(epubPaths.contentDir.length + 1)+'"\/>');
            string1 = "</navMap>";
            string2 = "body"+(("0000"+(TextnumberPreviousEpub+1)).slice(-4));
            // eslint-disable-next-line
            string3 = 'playOrder="'+(TextnumberPreviousEpub+1)+'"';
            // eslint-disable-next-line
            string4 = '<content src="' + newChaptername.slice(epubPaths.contentDir.length + 1) + '"/>';
            PreviousEpubTocText = LibraryStorage.LibManipulateContentFromTo(AddEpubTocText, PreviousEpubTocText, regex1, string1, regex2, string2, regex3, string3, regex4, string4);
            if (PreviousEpubTocEpub3Text != null) {
                string1 = "</ol></nav>";
                regex2 = new RegExp(".+<text>");
                regex3 = new RegExp("</text>.+");
                string2 = "<li><a href=\""+ newChaptername.slice(epubPaths.contentDir.length + 1) + "\">"+AddEpubTocText.match(regex1)[0].replace(regex2, "").replace(regex3, "")+"</a></li>";
                PreviousEpubTocEpub3Text = PreviousEpubTocEpub3Text.replace(string1, string2+string1);
            }
            TextnumberPreviousEpub++;
            TextnumberAddEpub++;
            NewChapter++;
        }
        MergedEpubZip.add(epubPaths.contentOpf, new zip.TextReader(PreviousEpubContentText));
        MergedEpubZip.add(epubPaths.tocNcx, new zip.TextReader(PreviousEpubTocText));
        if (PreviousEpubTocEpub3Text != null) {
            MergedEpubZip.add(epubPaths.navXhtml, new zip.TextReader(PreviousEpubTocEpub3Text));
        }
        let content = await MergedEpubZip.close();
        LibraryStorage.LibHandleUpdate(-1, content, await LibraryStorage.LibGetFromStorage("LibStoryURL" + LibidURL), await LibraryStorage.LibGetFromStorage("LibFilename" + LibidURL), LibidURL, NewChapter);
        
        // Remove cached chapters that are now in library storage after merge
        await LibraryStorage.LibRemoveCachedChaptersMovedToLibrary(LibidURL.toString());
        
        return content;
    }

    /**
     * Manipulate content from one EPUB to another
     */
    static LibManipulateContentFromTo(ContentFrom = "", ContentTo = "", regexFrom1 = "", stringTo1 = "", regexFrom2 = "", stringTo2 = "", regexFrom3 = "", stringTo3 = "", regexFrom4 = "", stringTo4 = "") {
        let match = ContentFrom.match(regexFrom1);
        if (!match) {
            console.error("LibManipulateContentFromTo: regex match failed", {
                regexFrom1: regexFrom1.toString(),
                contentFromLength: ContentFrom.length,
                contentFromStart: ContentFrom.substring(0, 200)
            });
            return ContentTo; // Return unchanged content if regex fails
        }
        return ContentTo.replace(stringTo1, match[0].replace(regexFrom2, stringTo2).replace(regexFrom3, stringTo3).replace(regexFrom4, stringTo4)+stringTo1);
    }

    /**
     * Save cover image from EPUB to storage
     */
    static async LibSaveCoverImgInStorage(idfromepub) {
        return new Promise((resolve) => {
            chrome.storage.local.get("LibEpub" + idfromepub, async function(items, ) {
                try {
                    let EpubReader = await new zip.Data64URIReader(items["LibEpub" + idfromepub]);
                    let EpubZip = new zip.ZipReader(EpubReader, {useWebWorkers: false});
                    let EpubContent =  await EpubZip.getEntries();
                    EpubContent = EpubContent.filter(a => a.directory == false);

                    let epubPaths = EpubStructure.get();
                    let Coverxml = await EpubContent.filter( a => a.filename == epubPaths.coverXhtml)[0].getData(new zip.TextWriter());
                    let CoverimgPath = epubPaths.contentDir + Coverxml.match(new RegExp(`"\\.\\./${epubPaths.imagesDirRel}/000.+?"`))[0].replace(/"../,"").replace("\"","");
                    let Coverimage = await EpubContent.filter( a => a.filename == CoverimgPath)[0].getData(new zip.Data64URIWriter());

                    let CoverFiletype = CoverimgPath.split(".")[1];
                    if (CoverFiletype == "svg") {
                        CoverFiletype = "svg+xml";
                    }
                    let Cover = Coverimage.replace("data:;base64,", "data:image/"+CoverFiletype+";base64,");
                    chrome.storage.local.set({
                        ["LibCover" + idfromepub]: Cover
                    }, function() {
                        resolve();
                    });
                } catch {
                    let no_cover_svg = "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPCFET0NUWVBFIHN2ZyBQVUJMSUMgIi0vL1czQy8vRFREIFNWRyAxLjEvL0VOIiAiaHR0cDovL3d3dy53My5vcmcvR3JhcGhpY3MvU1ZHLzEuMS9EVEQvc3ZnMTEuZHRkIj4KPHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB2ZXJzaW9uPSIxLjEiIHdpZHRoPSIxNjFweCIgaGVpZ2h0PSIxODFweCIgdmlld0JveD0iLTAuNSAtMC41IDE2MSAxODEiIHN0eWxlPSJiYWNrZ3JvdW5kLWNvbG9yOiByZ2IoMjU1LCAyNTUsIDI1NSk7Ij48ZGVmcy8+PGc+PHJlY3QgeD0iMCIgeT0iMy4yNCIgd2lkdGg9IjE2MCIgaGVpZ2h0PSIxNzMuNTIiIGZpbGw9InJnYigyNTUsIDI1NSwgMjU1KSIgc3Ryb2tlPSJyZ2IoMCwgMCwgMCkiIHBvaW50ZXItZXZlbnRzPSJhbGwiLz48cmVjdCB4PSI0Mi4wNyIgeT0iMzMuMjkiIHdpZHRoPSI3NS44NyIgaGVpZ2h0PSI3NS4xMiIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJyZ2IoMCwgMCwgMCkiIHN0cm9rZS13aWR0aD0iNC41MSIgcG9pbnRlci1ldmVudHM9ImFsbCIvPjxlbGxpcHNlIGN4PSI2Ni4xIiBjeT0iNTEuMzEiIHJ4PSI2LjAwOTM4OTY3MTM2MTUwMiIgcnk9IjYuMDA5Mzg5NjcxMzYxNTAyIiBmaWxsPSJub25lIiBzdHJva2U9InJnYigwLCAwLCAwKSIgc3Ryb2tlLXdpZHRoPSI0LjUxIiBwb2ludGVyLWV2ZW50cz0iYWxsIi8+PHBhdGggZD0iTSA0Mi4wNyA5MC4zOCBMIDU3LjA5IDcwLjg1IEwgNzIuMTEgOTcuODkgTCA5MS42NCA1Mi44MiBMIDExNy45MyAxMDAuODkiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiKDAsIDAsIDApIiBzdHJva2Utd2lkdGg9IjQuNTEiIHN0cm9rZS1taXRlcmxpbWl0PSIxMCIgcG9pbnRlci1ldmVudHM9ImFsbCIvPjxnIGZpbGw9IiMwMDAwMDAiIGZvbnQtZmFtaWx5PSJBcmlhbCxIZWx2ZXRpY2EiIGZvbnQtd2VpZ2h0PSJib2xkIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXNpemU9IjIyLjUzNTIxMTI2NzYwNTYzMnB4Ij48dGV4dCB4PSI3OS41IiB5PSIxNDUuNzQiPk5vIGltYWdlPC90ZXh0PjwvZz48ZyBmaWxsPSIjMDAwMDAwIiBmb250LWZhbWlseT0iQXJpYWwsSGVsdmV0aWNhIiBmb250LXdlaWdodD0iYm9sZCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1zaXplPSIyMi41MzUyMTEyNjc2MDU2MzJweCI+PHRleHQgeD0iNzkuNSIgeT0iMTYzLjk5Ij5hdmFpbGFibGU8L3RleHQ+PC9nPjwvZz48L3N2Zz4=";
                    chrome.storage.local.set({
                        ["LibCover" + idfromepub]: no_cover_svg
                    }, function() {
                        resolve();
                    });
                }
            });
        });
    }

    /**
     * Create storage IDs for library items
     */
    static async LibCreateStorageIDs(AppendID) {
        let LibArray = [];
        if (AppendID == undefined) {
            let CurrentLibKeys = await LibraryStorage.LibGetAllLibStorageKeys("LibEpub");
            for (let i = 0; i < CurrentLibKeys.length; i++) {
                LibArray.push(CurrentLibKeys[i].replace("LibEpub",""));
            }
        } else {
            LibArray = await LibraryStorage.LibGetFromStorage("LibArray");
            if (LibArray.filter(a => a == AppendID).length > 0) {
                return;
            }
            LibArray.push(AppendID);
        }
        chrome.storage.local.set({
            ["LibArray"]: LibArray
        });
    }

    /**
     * Remove storage IDs for library items
     */
    static async LibRemoveStorageIDs(RemoveID) {
        let LibArray = await LibraryStorage.LibGetFromStorage("LibArray");
        if (LibArray == undefined) {
            await LibraryStorage.LibCreateStorageIDs();
            return LibraryStorage.LibGetStorageIDs();
        }
        LibArray = LibArray.filter(a => a != RemoveID);
        chrome.storage.local.set({
            ["LibArray"]: LibArray
        });
    }

    /**
     * Get storage IDs for library items
     */
    static async LibGetStorageIDs() {
        let LibArray = await LibraryStorage.LibGetFromStorage("LibArray");
        if (LibArray == undefined) {
            await LibraryStorage.LibCreateStorageIDs();
            return LibraryStorage.LibGetStorageIDs();
        }
        return LibArray;
    }

    /**
     * Get metadata from EPUB
     */
    static async LibGetMetadata(libepubid) {
        let LibMetadata = [];
        try {
            let EpubReader = await new zip.Data64URIReader(await LibraryStorage.LibGetFromStorage("LibEpub"+libepubid));
            let EpubZip = new zip.ZipReader(EpubReader, {useWebWorkers: false});
            let EpubContent =  await EpubZip.getEntries();
            let epubPaths = EpubStructure.get();
            let opfFile = await EpubContent.filter(a => a.filename == epubPaths.contentOpf)[0].getData(new zip.TextWriter());
            
            let LibMetadataTags = ["dc:title", "dc:creator", "dc:language", "dc:subject", "dc:description"];
            let opfFileMatch;
            LibMetadataTags.forEach((element, index) => {
                LibMetadata[index] = "";
                if (( opfFileMatch = opfFile.match(new RegExp("<"+element+".*?>.*?</"+element+">", "gs"))) != null) {
                    LibMetadata[index] = opfFileMatch[0].replace(new RegExp("<"+element+".*?>"),"").replace(new RegExp("</"+element+">"),"");
                }
            });
            return LibMetadata;
        } catch {
            return LibMetadata;
        }
    }

    /**
     * Save metadata changes to EPUB
     */
    static async LibSaveMetadataChange(obj) {
        let LibTitleInput = document.getElementById("LibTitleInput"+obj.dataset.libepubid).value;
        let LibAuthorInput = document.getElementById("LibAuthorInput"+obj.dataset.libepubid).value;
        let LibLanguageInput = document.getElementById("LibLanguageInput"+obj.dataset.libepubid).value;
        let LibSubjectInput = document.getElementById("LibSubjectInput"+obj.dataset.libepubid).value;
        let LibDescriptionInput = document.getElementById("LibDescriptionInput"+obj.dataset.libepubid).value;
        let LibDateCreated = new EpubPacker().getDateForMetaData();
        try {
            let EpubReader = await new zip.Data64URIReader(await LibraryStorage.LibGetFromStorage("LibEpub"+obj.dataset.libepubid));
            let EpubZipRead = new zip.ZipReader(EpubReader, {useWebWorkers: false});
            let EpubContent =  await EpubZipRead.getEntries();
            EpubContent = EpubContent.filter(a => a.directory == false);
            let epubPaths = EpubStructure.get();
            let opfFile = await EpubContent.filter(a => a.filename == epubPaths.contentOpf)[0].getData(new zip.TextWriter());
            
            let EpubWriter = new zip.BlobWriter("application/epub+zip");
            let EpubZipWrite = new zip.ZipWriter(EpubWriter,{useWebWorkers: false,compressionMethod: 8});
            //Copy Epub in NewEpub
            for (let element of EpubContent.filter(a => a.filename != epubPaths.contentOpf)) {
                EpubZipWrite.add(element.filename, new zip.BlobReader(await element.getData(new zip.BlobWriter())));
            }
            
            let regex1 = opfFile.match(new RegExp("<dc:title>.+?</dc:creator>", "gs"));
            if ( regex1 == null) {
                ErrorLog.showErrorMessage(UIText.Error.errorEditMetadata);
                return;
            }
            let LibSaveMetadataString = "";
            LibSaveMetadataString += "<dc:title>"+LibTitleInput+"</dc:title>";
            LibSaveMetadataString += "<dc:language>"+LibLanguageInput+"</dc:language>";
            LibSaveMetadataString += "<dc:date>"+LibDateCreated+"</dc:date>";
            LibSaveMetadataString += "<dc:subject>"+LibSubjectInput+"</dc:subject>";
            LibSaveMetadataString += "<dc:description>"+LibDescriptionInput+"</dc:description>";
            LibSaveMetadataString += "<dc:creator opf:file-as=\""+LibAuthorInput+"\" opf:role=\"aut\">"+LibAuthorInput+"</dc:creator>";

            opfFile = opfFile.replace(new RegExp("<dc:title>.+?</dc:creator>", "gs"), LibSaveMetadataString);

            EpubZipWrite.add(epubPaths.contentOpf, new zip.TextReader(opfFile));
            let content = await EpubZipWrite.close();
            
            // Save the updated EPUB directly without triggering full library re-render
            let metadataFileReader = new FileReader();
            metadataFileReader.readAsDataURL(content);
            metadataFileReader.onload = function() {
                chrome.storage.local.set({
                    ["LibEpub" + obj.dataset.libepubid]: metadataFileReader.result
                });
            };
        } catch {
            ErrorLog.showErrorMessage(UIText.Error.errorEditMetadata);
            return;
        }
    }

    /**
     * Handle EPUB file update/upload
     */
    static async LibHandleUpdate(objbtn, Blobdata, StoryURL, Filename, Id, NewChapterCount) {
        LibraryUI.LibShowLoadingText();
        LibraryStorage.LibFileReaderAddListeners();
        if (objbtn != -1) {
            Blobdata = objbtn.files[0];
            Filename = Blobdata.name.replace(".epub", "");
        }
        if (NewChapterCount == null) {
            NewChapterCount = 0;
        }
        LibFileReader.LibStorageValueURL = StoryURL;
        LibFileReader.LibStorageValueFilename = Filename;
        LibFileReader.LibStorageValueId = Id;
        LibFileReader.NewChapterCount = NewChapterCount;
        LibFileReader.readAsDataURL(Blobdata);
    }

    /**
     * Handle file reader load event
     */
    static async LibFileReaderload() {
        let isNewBook = false;
        if (LibFileReader.LibStorageValueId === -1) {
            isNewBook = true;
            let CurrentLibKeys = await LibraryStorage.LibGetAllLibStorageKeys("LibEpub");
            let HighestLibEpub = 0;
            CurrentLibKeys.forEach(element => {
                element = element.replace("LibEpub","");
                if (parseInt(element)>=HighestLibEpub) {
                    HighestLibEpub = parseInt(element)+1; 
                }
            });
            LibFileReader.LibStorageValueId = HighestLibEpub;
            if (LibFileReader.LibStorageValueURL === "") {
                LibFileReader.LibStorageValueURL = await LibraryStorage.LibGetSourceURL(LibFileReader.result);
            }
        }
        let StorageNewChapterCount = await LibraryStorage.LibGetFromStorage("LibNewChapterCount" + LibFileReader.LibStorageValueId);
        let NewChapterCount = LibFileReader.NewChapterCount + parseInt(StorageNewChapterCount || "0");
        //Catch Firefox upload wrong Content-Type
        let result = LibFileReader.result;
        if (result.startsWith("data:application/octet-stream;base64,")) {
            let regex = new RegExp("^data:application/octet-stream;base64,");
            result = result.replace(regex, "data:application/epub+zip;base64,");
        }
        chrome.storage.local.set({
            ["LibEpub" + LibFileReader.LibStorageValueId]: result,
            ["LibStoryURL" + LibFileReader.LibStorageValueId]: LibFileReader.LibStorageValueURL,
            ["LibFilename" + LibFileReader.LibStorageValueId]: LibFileReader.LibStorageValueFilename,
            ["LibNewChapterCount" + LibFileReader.LibStorageValueId]: NewChapterCount
        }, async function() {
            await LibraryStorage.LibSaveCoverImgInStorage(LibFileReader.LibStorageValueId);
            await LibraryStorage.LibCreateStorageIDs(parseInt(LibFileReader.LibStorageValueId));
            await LibraryUI.LibRenderSavedEpubs();
            
            // Remove cached chapters that are now in library storage
            await LibraryStorage.LibRemoveCachedChaptersMovedToLibrary(LibFileReader.LibStorageValueId.toString());
            
            // If this was a new book added to library, automatically switch to Library Mode
            if (isNewBook) {
                try {
                    // Load the newly added book in the main UI
                    await LibraryUI.loadLibraryBookInMainUI(LibFileReader.LibStorageValueId.toString());
                } catch (error) {
                    console.error("Error switching to library mode after adding book:", error);
                    // If automatic loading fails, just show the library banner
                    await LibraryUI.LibShowBookIndicator(LibFileReader.LibStorageValueId.toString());
                }
            }
        });
    }
    
    /**
     * Get source URL from EPUB data
     */
    static async LibGetSourceURL(EpubAsDataURL) {
        try {
            let EpubReader = await new zip.Data64URIReader(EpubAsDataURL);
            let EpubZip = new zip.ZipReader(EpubReader, {useWebWorkers: false});
            let EpubContent =  await EpubZip.getEntries();
            let epubPaths = EpubStructure.get();
            let opfFile = await EpubContent.filter(a => a.filename == epubPaths.contentOpf)[0].getData(new zip.TextWriter());
            return (opfFile.match(/<dc:identifier id="BookId" opf:scheme="URI">.+?<\/dc:identifier>/)[0].replace(/<dc:identifier id="BookId" opf:scheme="URI">/,"").replace(/<\/dc:identifier>/,""));
        } catch {
            return "Paste URL here!";
        }
    }

    /**
     * Convert data URL to blob
     */
    static async LibConvertDataUrlToBlob(DataUrl) {
        let retblob;
        try {
            var dataString = DataUrl.slice(("data:application/epub+zip;base64,").length);
            var byteString = atob(dataString);
            var array = [];
            for (var i = 0; i < byteString.length; i++) {
                array.push(byteString.charCodeAt(i));
            }
            retblob = new Blob([new Uint8Array(array)], { type: "application/epub+zip" });
        } catch {
            //In case the Epub is too big atob() fails and this messy method works with bigger files.
            let Base64EpubReader = await new zip.Data64URIReader(DataUrl);
            let Base64EpubZip = new zip.ZipReader(Base64EpubReader, {useWebWorkers: false});
            
            let Base64EpubContent = await Base64EpubZip.getEntries();
            Base64EpubContent = Base64EpubContent.filter(a => a.directory == false);

            let BlobEpubWriter = new zip.BlobWriter("application/epub+zip");
            let BlobEpubZip = new zip.ZipWriter(BlobEpubWriter,{useWebWorkers: false,compressionMethod: 8});
            //Copy Base64Epub in BlobEpub
            for (let element of Base64EpubContent) {
                if (element.filename == "mimetype") {
                    BlobEpubZip.add(element.filename, new zip.TextReader(await element.getData(new zip.TextWriter())), {compressionMethod: 0});
                    continue;
                }
                BlobEpubZip.add(element.filename, new zip.BlobReader(await element.getData(new zip.BlobWriter())));
            }
            retblob = await BlobEpubZip.close();
        }
        return retblob;
    }

    /**
     * Add file reader event listeners
     */
    static LibFileReaderAddListeners() {
        LibFileReader.removeEventListener("load", LibraryStorage.LibFileReaderLoadImport);
        LibFileReader.removeEventListener("error", function(event) {LibraryStorage.LibFileReaderError(event);});
        LibFileReader.removeEventListener("abort", function(event) {LibraryStorage.LibFileReaderAbort(event);});
        LibFileReader.addEventListener("load", LibraryStorage.LibFileReaderload);
        LibFileReader.addEventListener("error", function(event) {LibraryStorage.LibFileReaderError(event);});
        LibFileReader.addEventListener("abort", function(event) {LibraryStorage.LibFileReaderAbort(event);});
    }

    /**
     * Handle import file operations
     */
    static async LibHandleImport(objbtn) {
        LibraryUI.LibShowLoadingText();
        LibraryStorage.LibFileReaderAddListenersImport();
        let blobData = objbtn.files[0];
        LibFileReader.name = objbtn.files[0].name;
        let regex = new RegExp("zip$");
        if (!regex.test(LibFileReader.name)) {
            LibFileReader.readAsText(blobData);
        } else {
            LibFileReader.readAsArrayBuffer(blobData);
        }
    }

    /**
     * Add import file reader event listeners
     */
    static LibFileReaderAddListenersImport() {
        LibFileReader.removeEventListener("load", LibraryStorage.LibFileReaderload);
        LibFileReader.removeEventListener("error", function(event) {LibraryStorage.LibFileReaderError(event);});
        LibFileReader.removeEventListener("abort", function(event) {LibraryStorage.LibFileReaderAbort(event);});
        LibFileReader.addEventListener("load", LibraryStorage.LibFileReaderLoadImport);
        LibFileReader.addEventListener("error", function(event) {LibraryStorage.LibFileReaderError(event);});
        LibFileReader.addEventListener("abort", function(event) {LibraryStorage.LibFileReaderAbort(event);});
    }

    /**
     * Handle import file reader load event
     */
    static async LibFileReaderLoadImport() {
        let regex = new RegExp("zip$");
        if (!regex.test(LibFileReader.name)) {
            let json = JSON.parse(LibFileReader.result);
            let CurrentLibKeys = await LibraryStorage.LibGetAllLibStorageKeys("LibEpub");
            let HighestLibEpub = 0;
            CurrentLibKeys.forEach(element => {
                element = element.replace("LibEpub","");
                if (parseInt(element)>=HighestLibEpub) {
                    HighestLibEpub = parseInt(element)+1; 
                }
            });
            for (let i = 0; i < json.Library.length; i++) {
                chrome.storage.local.set({
                    ["LibEpub" + HighestLibEpub]: json.Library[i].LibEpub,
                    ["LibStoryURL" + HighestLibEpub]: json.Library[i].LibStoryURL,
                    ["LibCover" + HighestLibEpub]: json.Library[i].LibCover,
                    ["LibFilename" + HighestLibEpub]: json.Library[i].LibFilename
                });
                await LibraryStorage.LibCreateStorageIDs(HighestLibEpub);
                HighestLibEpub++;
            }
            UserPreferences.readFromLocalStorage().loadReadingListFromJson(json);
            LibraryUI.LibRenderSavedEpubs();
        } else {
            let CurrentLibKeys = await LibraryStorage.LibGetAllLibStorageKeys("LibEpub");
            let HighestLibEpub = 0;
            CurrentLibKeys.forEach(element => {
                element = element.replace("LibEpub","");
                if (parseInt(element)>=HighestLibEpub) {
                    HighestLibEpub = parseInt(element)+1; 
                }
            });
            let blobFile = new Blob([LibFileReader.result]);
            let zipFileReader = new zip.BlobReader(blobFile);
            let zipReader = new zip.ZipReader(zipFileReader, {useWebWorkers: false});
            let entries = await zipReader.getEntries();
            //check export logic version
            let LibraryVersion = await (await entries.filter((a) => a.filename === "LibraryVersion.txt")[0]).getData(new zip.TextWriter());
            
            if (LibraryVersion == null) {
                ErrorLog.showErrorMessage("Wrong export version");
                return;
            }
            let LibCountEntries = await (await entries.filter((a) => a.filename === "LibraryCountEntries.txt")[0])?.getData(new zip.TextWriter());
            for (let i = 0; i < LibCountEntries; i++) {
                chrome.storage.local.set({
                    ["LibCover" + HighestLibEpub]: await (await entries.filter((a) => a.filename === "Library/"+i+"/LibCover")[0]).getData(new zip.TextWriter()),
                    ["LibEpub" + HighestLibEpub]: await (await entries.filter((a) => a.filename === "Library/"+i+"/LibEpub")[0]).getData(new zip.TextWriter()),
                    ["LibFilename" + HighestLibEpub]: await (await entries.filter((a) => a.filename === "Library/"+i+"/LibFilename")[0]).getData(new zip.TextWriter()),
                    ["LibStoryURL" + HighestLibEpub]: await (await entries.filter((a) => a.filename === "Library/"+i+"/LibStoryURL")[0]).getData(new zip.TextWriter()),
                    ["LibNewChapterCount" + HighestLibEpub]: await (await entries.filter((a) => a.filename === "Library/"+i+"/LibNewChapterCount")[0])?.getData(new zip.TextWriter())??"0"
                });
                await LibraryStorage.LibCreateStorageIDs(HighestLibEpub);
                HighestLibEpub++;
            }
            UserPreferences.readFromLocalStorage().loadReadingListFromJson(JSON.parse( await (await entries.filter((a) => a.filename === "ReadingList.json")[0]).getData(new zip.TextWriter())));
            await LibraryUI.LibRenderSavedEpubs();
        }
    }

    /**
     * File reader error handler
     */
    static LibFileReaderError(event) {ErrorLog.showErrorMessage(event);}

    /**
     * File reader abort handler
     */
    static LibFileReaderAbort(event) {ErrorLog.showErrorMessage(event);}

    /**
     * Get all library storage keys with substring filter
     */
    static async LibGetAllLibStorageKeys(Substring, AllStorageKeysList) {
        return new Promise((resolve) => {
            if (AllStorageKeysList == undefined) {
                chrome.storage.local.get(null, function(items) {
                    let AllStorageKeys = Object.keys(items);
                    let AllLibStorageKeys = [];
                    for (let i = 0, end = AllStorageKeys.length; i < end; i++) {
                        if (AllStorageKeys[i].includes(Substring)) {
                            AllLibStorageKeys.push(AllStorageKeys[i]);
                        }   
                    }
                    resolve(AllLibStorageKeys);
                });
            } else {
                let AllLibStorageKeys = [];
                for (let i = 0, end = AllStorageKeysList.length; i < end; i++) {
                    if (AllStorageKeysList[i].includes(Substring)) {
                        AllLibStorageKeys.push(AllStorageKeysList[i]);
                    }   
                }
                resolve(AllLibStorageKeys);
            }
        });
    }

    /**
     * Get multiple items from storage
     */
    static async LibGetFromStorageArray(Keys) {
        return new Promise((resolve) => {
            chrome.storage.local.get(Keys, function(items) {
                resolve(items);
            });
        });
    }

    /**
     * Get single item from storage
     */
    static async LibGetFromStorage(Key) {
        return new Promise((resolve) => {
            chrome.storage.local.get(Key, function(item) {
                resolve(item[Key]);
            });
        });
    }

    /**
     * Save data to chrome.storage.local
     * @param {string} key - Storage key
     * @param {any} value - Value to store
     * @returns {Promise} Promise that resolves when save is complete
     */
    static async LibSaveToStorage(key, value) {
        return new Promise((resolve, reject) => {
            let storageItem = {};
            storageItem[key] = value;
            chrome.storage.local.set(storageItem, function() {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve();
                }
            });
        });
    }

    /**
     * Remove cached chapters that have been moved to library storage
     * @param {string} bookId - The Library book ID
     */
    static async LibRemoveCachedChaptersMovedToLibrary(bookId) {
        try {
            // Get full book data (includes URLs and spine indices)
            let bookData = await LibraryBookData.extractBookData(bookId);
            let chapterUrls = bookData.chapters
                .map(ch => ch.sourceUrl)
                .filter(url => url && !url.startsWith("library://"));
            
            if (chapterUrls && chapterUrls.length > 0) {
                // Remove chapters from cache storage
                await ChapterCache.removeChaptersFromCache(chapterUrls);
                
                // Update visual status from cache to library with proper spine indices
                await LibraryStorage.updateChapterStatusToLibrary(bookId, bookData);
            }
            
        } catch (error) {
            console.error("Error removing cached chapters moved to library:", error);
        }
    }

    /**
     * Update chapter visual status from cache to library with proper metadata
     * @param {string} bookId - The Library book ID
     * @param {Object} bookData - Book data with chapters and spine indices
     */
    static async updateChapterStatusToLibrary(bookId, bookData) {
        try {
            // Update each chapter's parser state and visual status
            bookData.chapters.forEach(libraryChapter => {
                if (libraryChapter.sourceUrl && !libraryChapter.sourceUrl.startsWith("library://")) {
                    let row = ChapterUrlsUI.findRowBySourceUrl(libraryChapter.sourceUrl);
                    if (row) {
                        // Find and update the chapter object in parser state
                        let chapter = null;
                        if (window.parser && window.parser.state && window.parser.state.webPages) {
                            chapter = [...window.parser.state.webPages.values()].find(ch => 
                                LibraryBookData.normalizeUrl(ch.sourceUrl) === LibraryBookData.normalizeUrl(libraryChapter.sourceUrl)
                            );
                        }
                        
                        if (chapter) {
                            // Set library properties on the chapter object
                            chapter.isInBook = true;
                            chapter.libraryBookId = bookId;
                            chapter.epubSpineIndex = libraryChapter.epubSpineIndex;
                            chapter.libraryFilePath = libraryChapter.libraryFilePath;
                        }
                        
                        // Update visual status to library
                        ChapterUrlsUI.setChapterStatusVisuals(row, ChapterUrlsUI.CHAPTER_STATUS_LIBRARY, libraryChapter.sourceUrl, libraryChapter.title);
                    }
                }
            });
        } catch (error) {
            console.error("Error updating chapter status to library:", error);
        }
    }

    /**
     * Check how many library books a user has
     * @returns {Promise<number>} Number of library books
     */
    static async getLibraryBookCount() {
        try {
            let libraryIds = await LibraryStorage.LibGetStorageIDs();
            return libraryIds ? libraryIds.length : 0;
        } catch (error) {
            console.error("Error getting library book count:", error);
            return 0;
        }
    }

    /**
     * Add a single chapter directly to library book
     * @param {Object} chapter - Chapter object with library information
     * @param {Element} content - Chapter content DOM element
     * @param {string} sourceUrl - Chapter source URL
     * @param {string} title - Chapter title
     * @param {HTMLElement} row - Chapter table row
     */
    static async addChapterToLibrary(chapter, content, sourceUrl, title, row) {
        try {
            // Generate XHTML using existing EPUB infrastructure
            let epubItem = new ChapterEpubItem({sourceUrl, title}, content, chapter.epubSpineIndex);
            let parser = ChapterCache.getCurrentParser();
            let emptyDocFactory = parser.emptyDocFactory || util.createEmptyXhtmlDoc;
            let contentValidator = parser.contentValidator || (xml => util.isXhtmlInvalid(xml, EpubPacker.XHTML_MIME_TYPE));
            let newChapterXhtml = epubItem.fileContentForEpub(emptyDocFactory, contentValidator);
            
            // Get the stored EPUB data
            let epubBase64 = await LibraryStorage.LibGetFromStorage("LibEpub" + chapter.libraryBookId);
            if (!epubBase64) {
                throw new Error("Book not found in library");
            }
            
            // Get the current book data to determine the correct spine index for insertion
            let bookData = await LibraryBookData.extractBookData(chapter.libraryBookId);

            // EpubUpdater needs the insertIndex to be the actual
            // correct spot in the epub's spine to put the new chapter at.
            let insertIndex;
            let lastBookChapter = bookData.chapters[bookData.chapters.length - 1];
            if (chapter.epubSpineIndex > lastBookChapter?.epubSpineIndex ?? -1) {
                // Appending at the end
                insertIndex = lastBookChapter?.epubSpineIndex + 1;
            } else {
                insertIndex = chapter.epubSpineIndex;
            }

            // Add the new chapter using EpubUpdater.insertChapter for proper positioning
            let updatedEpubBlob = await EpubUpdater.insertChapter(
                epubBase64, 
                insertIndex,
                newChapterXhtml, 
                title, 
                sourceUrl
            );

            // Convert blob to base64 and save back to storage
            let newEpubBase64 = await EpubUpdater.blobToBase64(updatedEpubBlob);
            await LibraryStorage.LibSaveToStorage("LibEpub" + chapter.libraryBookId, newEpubBase64);
            
            // Remove from cache if it was there
            await ChapterCache.deleteChapter(sourceUrl);
            
            // Update the cached indices for chapters that got pushed forward by the insertion
            if (window.parser && window.parser.state && window.parser.state.webPages) {
                
                // EpubUpdater.insertChapter inserts BEFORE the given index, pushing subsequent chapters forward
                // So we need to increment the epubSpineIndex for all chapters at or after the insertion point
                for (let [key, chapterObj] of window.parser.state.webPages.entries()) {
                    if (chapterObj.isInBook && 
                        chapterObj.libraryBookId === chapter.libraryBookId &&
                        chapterObj.epubSpineIndex !== undefined &&
                        chapterObj.epubSpineIndex >= insertIndex) {
                        chapterObj.epubSpineIndex++;
                    }
                }

                // Set this chapter's index to the insertion point (it now occupies that position)
                chapter.isInBook = true;
                chapter.epubSpineIndex = insertIndex;
                
                // Get the updated book data to find the libraryFilePath for this chapter
                try {
                    let updatedBookData = await LibraryBookData.extractBookData(chapter.libraryBookId);
                    let updatedLibraryChapter = updatedBookData.chapters.find(lch => 
                        lch.sourceUrl && LibraryBookData.normalizeUrl(lch.sourceUrl) === LibraryBookData.normalizeUrl(sourceUrl)
                    );
                    if (updatedLibraryChapter) {
                        chapter.libraryFilePath = updatedLibraryChapter.libraryFilePath;
                    }
                } catch (error) {
                    console.warn("Could not get libraryFilePath for newly added chapter:", error);
                }
            }
            
            // Call the unified update method for consistent UI updates
            await LibraryStorage.updateChapterStatusToLibrary(chapter.libraryBookId, {chapters: [chapter]});
            
        } catch (error) {
            console.error("Error adding chapter to library book:", error);
            // Fall back to cache if library addition fails
            if (row) {
                ChapterUrlsUI.setChapterStatusVisuals(row, ChapterUrlsUI.CHAPTER_STATUS_DOWNLOADED, sourceUrl, title);
            }
            throw error;
        }
    }
}