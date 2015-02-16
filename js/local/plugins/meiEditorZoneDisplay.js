require(['meiEditor', 'https://x2js.googlecode.com/hg/xml2json.js'], function(){

(function ($)
{
    window.meiEditorPlugins.push((function()
    {
        var retval = 
            {
            divName: "zone-display",
            title: 'Diva page manager',
            dropdownOptions: 
            {
                "Link files to Diva images...": "file-link-dropdown",
                "Unlink files from Diva images...": "file-unlink-dropdown",
                "Auto-link files by filename": "auto-link-dropdown",
                "Update Diva": "update-diva-dropdown",
                "Clear selection": "clear-selection-dropdown"
            },
            init: function(meiEditor, meiEditorSettings)
            {
                /*
                Required settings:
                    divaInstance: A reference to the Diva object created from initializing Diva.
                    jsonFileLocation: A link to the .json file retrieved from Diva's process/generateJson.py files
                    oneToOneMEI: A boolean flag, true if one MEI file refers to one Diva page, false if one MEI file contains multiple surfaces where each surface refers to a Diva page.
                */
                if (!("divaInstance" in meiEditorSettings) || !("jsonFileLocation" in meiEditorSettings) || !("oneToOneMEI" in meiEditorSettings))
                {
                    console.error("MEI Editor error: The 'Diva Manager' plugin requires the 'divaInstance', 'jsonFileLocation', 'currentSite', and 'siglum_slug' settings present on intialization.");
                    return false;
                }

                /*var globals = 
                {
                    divaPageList: [],           //list of active pages in Diva
                    divaImagesToMeiFiles: {},   //keeps track of linked files
                    neumeObjects: {},           //keeps track of neume objects
                    initDragTop: "",            //when a drag-div is being created, this stores the mouse's initial Y coordinate
                    initDragLeft: "",           //when a drag-div is being created, this stores the mouse's initial X coordinate
                    dragActive: false,          //prevents .overlay-box objects from appearing on mouseover while a drag is occuring
                    editModeActive: false,      //determines if the shift key is being held down
                    createModeActive: false,    //determines if the meta key is being held down
                    boxSingleTimeout: "",       //stores the timeout object for determining if a box was double-clicked or single-clicked
                    boxClickHandler: "",        //stores the current function to be called when a box is single-clicked; this changes depending on whether or not shift is down
                    lastClicked: "",            //determines which delete listener to use by storing which side was last clicked on
                    highlightHandle: "",        //handler for the highlight event, needs to be committed to memory
                    activeNeumeChoices: [],      //list of neumes present on the active page to choose from when creating new zones
                    foreignPageNames: [],
                    pageLoadedByScrolling: false,
                };*/

                var globals = 
                {
                    zoneDict: {},              //dict of zones to highlight represented as {'UUID'(surface): [['ulx': ulx, 'uly': uly, 'lrx': lrx, 'lry': lry, 'divID': uuid(zone)}, {'ulx'...}]}
                    zoneIDs: [],               //an array of IDs for faster lookup
                    selectedCache: [],       //cache of highlighted items used to reload display once createHighlights is called
                    resizableCache: [],         //cache of resizable items used to reload display once createHighlights is called
                    selectedClass: "editorSelected", //class to identify selected highlights. NOT a selector.
                    resizableClass: "editorResizable", //class to identify resizable highlights. NOT a selector.
                    divaPages: []
                };

                $.extend(meiEditorSettings, globals);

                selectedSelector = "." + meiEditorSettings.selectedClass;
                resizableSelector = "." + meiEditorSettings.resizableClass;

                meiEditor.addToNavbar("Zone Display", "zone-display");
                $("#dropdown-zone-display").append("<li><a id='file-link-dropdown'>Link files to Diva images...</a></li>" +
                    "<li><a id='file-unlink-dropdown'>Unlink files from Diva images...</a></li>" +
                    "<li><a id='update-diva-dropdown'>Update Diva</a></li>" +
                    "<li><a id='clear-selection-dropdown'>Clear selection</a></li>");
                $("#dropdown-file-upload").append("<li><a id='default-mei-dropdown'>Create default MEI file</a></li>" +
                    "<li><a id='server-load-dropdown'>Load file from server...</a></li>" + 
                    "<li><a id='manuscript-dropdown'>Close project</a></li>");
                $("#help-dropdown").append("<li><a id='zone-display-help'>Diva page manager</a></li>");

                $("#file-link-dropdown").on('click', function()
                {
                    $('#fileLinkModal').modal();
                });

                $("#file-unlink-dropdown").on('click', function()
                {
                    $('#fileUnlinkModal').modal();
                });

                $("#update-diva-dropdown").on('click', function()
                {
                    meiEditor.createHighlights();
                });

                $("#clear-selection-dropdown").on('click', function()
                {
                    meiEditor.deselectAllHighlights();
                    meiEditor.deselectResizable(resizableSelector);
                });

                $("#estimateBox").on('click', function(e){
                    e.stopPropagation();
                });

                $("#server-load-dropdown").on('click', function(e){
                    $("#serverLoadModal").modal();
                });

                $("#zone-display-help").on('click', function()
                {
                    $("#zoneHelpModal").modal();
                });

                $("#manuscript-dropdown").on('click', function()
                {
                    window.location = document.URL.split("?")[0];
                });

                $("#default-mei-dropdown").on('click', function()
                {
                    meiEditor.addDefaultPage(createDefaultMEIString());
                });

                createModal(meiEditorSettings.element, "fileLinkModal", false, 
                    "<span class='modalSubLeft'>" +
                    "Select an MEI file:<br>" +
                    createSelect("file-link", meiEditorSettings.pageData) +
                    "</span>" +
                    "<span class='modalSubRight'>" +
                    "Select a Diva image:<br>" + 
                    createSelect("diva-link", meiEditorSettings.divaPageList, true) + 
                    "</span>" + 
                    "<div class='clear'></div>" + 
                    "<div class='centeredAccept'>" + 
                    "<button id='link-files'>Link selected files</button>" + 
                    "</div>");

                createModal(meiEditorSettings.element, "fileUnlinkModal", false, 
                    "<div id='unlink-wrapper'>" + 
                    "Unlink an MEI file from a Diva file:<br>" + 
                    "<select id='selectUnlink'></select><br>" + 
                    "<button id='unlink-files'>Unlink selected files</button>" + 
                    "</div>");

                createModal(meiEditorSettings.element, "zoneHelpModal", false,
                    "<h4>Help for 'Zone Display' menu:</h4>" + 
                    "<li>To get highlights from a file to show up in the Diva pane, click 'Link files to Diva images...' from the dropdown menu and select the files you want to link.</li>" + 
                    "<br><li>'Auto-link files by filename' will automatically strip file extensions and try to match files so that '001.mei' and '001.tiff' become linked.</li>" + 
                    "<br><li>Changes you make to the MEI document will not automatically transfer over; click the 'Update Diva' dropdown option to reload the highlighted objects in the image viewer.</li>" + 
                    "<br><li>Clicking on a highlight will select it and move the MEI editor to its line.</li>" +
                    "<li>Holding shift and clicking will select additional highlights.</li>" +
                    "<li>Holding shift and click-dragging the mouse will select everything within a box.</li>" + 
                    "<li>To deselect a single highlight, hold shift and click on a selected highlight.</li>" +
                    "<li>To deselect all highlights, choose the 'Clear selection' option of this dropdown.</li>" + 
                    "<br><li>To create a new highlight, ctrl+click (Windows) or cmd+click (Mac) on empty space on the image. </li>" +
                    "<li style='margin-left:0.25in'>Only clicking will create a default box that can be resized later.</li>" +
                    "<li style='margin-left:0.25in'>Clicking and dragging will create a box with a specific size.</li>" +
                    "<li style='margin-left:0.25in'>If the 'Estimate line numbers' checkbox is checked in the Diva Page Manager dropdown menu, the program will insert a 'zone' object immediately after the 'surface' object and a 'neume' object immediately after the first 'layer' object. Use this at your own discretion.</li>" +
                    "<br><li>To resize or move a highlight, double-click on it.</li>" +
                    "<li style='margin-left:0.25in'>Click and drag on the edge of the highlight to resize it.</li>" +
                    "<li style='margin-left:0.25in'>Click and drag on the centre of the highlight or with the shift key down to move it.</li>" +
                    "<li style='margin-left:0.25in'>Pressing an arrow key will move a box slightly in the direction of the arrow.</li>" +
                    "<li style='margin-left:0.25in'>Press the 'Escape' key to leave resize/move mode.</li>" +
                    "<br><li>Press the 'delete' key on your keyboard to delete all selected highlights and the MEI lines associated with them.</li>");
                
                /*
                    Reloads highlights/resizable IDs after highlights have been reloaded.
                */
                meiEditor.reloadFromCaches = function()
                {
                    var curselectedCached = meiEditorSettings.selectedCache.length;
                    while(curselectedCached--)
                    {
                        meiEditor.selectHighlight($('#' + meiEditorSettings.selectedCache[curselectedCached]));
                    }
                    var curResizableCached = meiEditorSettings.resizableCache.length;
                    while(curResizableCached--)
                    {
                        meiEditor.selectResizable('#' + meiEditorSettings.resizableCache[curResizableCached]);
                    }
                };

                meiEditor.cursorUpdate = function(a, selection)
                {
                    /*var curRow = selection.getCursor().row;
                    var UUIDs = selection.doc.getLine(curRow).match(/m-[\dabcdef]{8}-([\dabcdef]{4})-([\dabcdef]{4})-([\dabcdef]{4})-([\dabcdef]{12})/gi);
                    if(!UUIDs) return;

                    var curFacs = UUIDs.length;
                    meiEditor.deselectAllHighlights();
                    while(curFacs--)
                    {
                        meiEditor.selectHighlight($("#" + UUIDs[curFacs]));
                    }*/
                };

                meiEditor.reapplyEditorClickListener = function()
                {
                    //commented out as per issue #36
                    $(".aceEditorPane").on('click', function()
                    {
                        var activeTab = meiEditor.getActivePanel().text();
                        if (true) //(meiEditor.meiIsLinked(activeTab))
                        {
                            //if only one is selected, don't multiselect
                            if($(selectedSelector).length == 1)
                            {
                                meiEditor.deselectAllHighlights();
                            }
                            var row = meiEditorSettings.pageData[activeTab].getSelectionRange().start.row;
                            var rowText = meiEditorSettings.pageData[activeTab].session.doc.getLine(row);
                            var matchArr = rowText.match(/m-[(0-9|a-f)]{8}(-[(0-9|a-f)]{4}){3}-[(0-9|a-f)]{12}/g);
                            if (!matchArr) return false;
                            var curMatch = matchArr.length;
                            while (curMatch--)
                            {
                                if ($("#"+matchArr[curMatch]).length)
                                {
                                    meiEditor.selectHighlight($("#"+matchArr[curMatch]), true);
                                }
                            }
                        }
                    });
                };

                /*
                    Highlight reloading code:
                */
                var reloadOneToOneZones = function()
                {
                    if(!meiEditorSettings.oneToOneMEI) 
                    {
                        meiEditor.localError("Multiple surfaces found. Can not reload zones.");
                        return false;
                    }

                    zoneDict = {}; //reset this
                    zoneIDs = []; //and this
                    var curPage;

                    for (curTitle in meiEditorSettings.pageData)
                    {
                        var divaIdx = getDivaIndexForPage(curTitle);
                        if (divaIdx !== false)
                        {
                            zoneDict[divaIdx] = [];
                            var linesArr = meiEditorSettings.pageData[curTitle].session.doc.getAllLines();
                            for(line in linesArr)
                            {
                                var lineDict = parseXMLLine(linesArr[line]);
                             
                                //if there's no XML in the current line, we don't care    
                                if (!lineDict) continue;
                                else if (lineDict.hasOwnProperty('zone'))
                                {
                                    //assemble that dict in Diva highlight format
                                    var highlightInfo = {'width': lineDict['zone']['lrx'] - lineDict['zone']['ulx'], 'height': lineDict['zone']['lry'] - lineDict['zone']['uly'], 'ulx':lineDict['zone']['ulx'], 'uly': lineDict['zone']['uly'], 'divID': lineDict['zone']['xml:id']};
                                    zoneDict[divaIdx].push(highlightInfo);
                                    zoneIDs.push(lineDict['zone']['xml:id']);
                                }
                            }
                        }
                    }

                    //clear any existing highlights
                    meiEditorSettings.divaInstance.resetHighlights();
                    // iterate through the pages (by index) and feed them into diva
                    for (page in zoneDict)
                    {
                        meiEditorSettings.divaInstance.highlightOnPage(page, zoneDict[page]);
                    } 

                    //publish an event that sends out the zone dict
                    meiEditor.events.publish('ZonesWereUpdated', [zoneDict]);
                    return true;
                };

                var reloadMultiPageZones = function()
                {
                    if(meiEditorSettings.oneToOneMEI) 
                    {
                        meiEditor.localError("Multiple surfaces not found. Can not reload zones.");
                        return false;
                    }

                    var activePage = meiEditor.getActivePageTitle();
                    var linesArr = meiEditorSettings.pageData[activePage].session.doc.getAllLines();
                    zoneDict = {}; //reset this
                    zoneIDs = []; //and this
                    var curPage;

                    // iterate through each line
                    for(line in linesArr)
                    {
                        var lineDict = parseXMLLine(linesArr[line]);
                     
                        //if there's no XML in the current line, we don't care    
                        if (!lineDict) continue;
                        //if it's a surface, treat that as the "current page" as all zones are inside that
                        else if (lineDict.hasOwnProperty('surface'))
                        {
                            //set current page
                            curPage = lineDict['surface']['n'];

                            //initialize that key of the dictionary
                            zoneDict[curPage] = [];
                        }
                        else if (lineDict.hasOwnProperty('zone'))
                        {
                            //assemble that dict in Diva highlight format
                            var highlightInfo = {'width': lineDict['zone']['lrx'] - lineDict['zone']['ulx'], 'height': lineDict['zone']['lry'] - lineDict['zone']['uly'], 'ulx':lineDict['zone']['ulx'], 'uly': lineDict['zone']['uly'], 'divID': lineDict['zone']['xml:id']};
                            zoneDict[curPage].push(highlightInfo);
                            zoneIDs.push(lineDict['zone']['xml:id']);
                        }
                    }
                    
                    //clear any existing highlights
                    meiEditorSettings.divaInstance.resetHighlights();
                    // iterate through the pages (by index) and feed them into diva
                    for (page in zoneDict)
                    {
                        meiEditorSettings.divaInstance.highlightOnPage(page, zoneDict[page]);
                    } 

                    //publish an event that sends out the zone dict
                    meiEditor.events.publish('ZonesWereUpdated', [zoneDict]);
                    return true;
                };

                //public function to re-parse XML
                meiEditor.reloadZones = (meiEditorSettings.oneToOneMEI ? reloadOneToOneZones : reloadMultiPageZones);
                //so zone reloading can be triggered
                meiEditor.events.subscribe("ZonesWereUpdated", meiEditor.reloadFromCaches);             
                meiEditor.events.subscribe('UpdateZones', meiEditor.reloadZones); 
                
                /*
                    Highlight selection code:
                */
                /*
                    Selects a highlight.
                    @param divToSelect The highlight to select.
                    @param findOverride Overrides jumping to the div in the editor pane.
                */
                meiEditor.selectHighlight = function(divToSelect, findOverride)
                {
                    if(!findOverride)
                    {
                        var searchNeedle = new RegExp(divToSelect.id, "g");

                        //searches for the facs ID that is also the ID of the highlighted panel
                        var pageTitle = meiEditor.getActivePanel().text();
                        var pageRef = meiEditor.getPageData(pageTitle);
                        var facsSearch = pageRef.find(searchNeedle, 
                        {
                            wrap: true,
                            range: null
                        });

                        var initRow = facsSearch.start.row;
                        var lineText, newRow = initRow;

                        do {
                            //gets the full text from the search result row
                            lineText = pageRef.session.doc.getLine(newRow);

                            //if it doesn't include "zone" it's what we want
                            if (!lineText.match(/zone/g))
                            {
                                break;
                            }

                            //if we didn't break, find the next one
                            pageRef.findNext();
                            newRow = pageRef.getSelectionRange().start.row;
                        } while (newRow != initRow); //safety to make sure we wrap only once and not infinitely
                    }
                    
                    $(divToSelect).addClass(meiEditorSettings.selectedClass);
                    $(divToSelect).css('background-color', 'rgba(0, 255, 0, 0.1)');
                    updateCaches();
                };

                //shortcut to deselect all highlights
                meiEditor.deselectAllHighlights = function()
                {
                    meiEditor.deselectHighlight(selectedSelector);
                };

                //deselects highlights.
                meiEditor.deselectHighlight = function(divToDeselect)
                {
                    $(divToDeselect).css('background-color', 'rgba(255, 0, 0, 0.2)');
                    $(divToDeselect).toggleClass(meiEditorSettings.selectedClass);
                    updateCaches();
                };

                /*
                    Saves highlights/resizable IDs while highlights are being reloaded.
                */
                var updateCaches = function()
                {
                    meiEditorSettings.selectedCache = [];
                    meiEditorSettings.resizableCache = [];
                    var curHighlight = $(selectedSelector).length;
                    while(curHighlight--)
                    {
                        meiEditorSettings.selectedCache.push($($(selectedSelector)[curHighlight]).attr('id'));
                    }
                    var curResizable = $(resizableSelector).length;
                    while(curResizable--)
                    {
                        meiEditorSettings.resizableCache.push($($(resizableSelector)[curResizable]).attr('id'));
                    }
                };

                /*
                    Gets the diva page index for a specific page title by stripping extensions.
                    MAKE SURE to === compare to false the result of this - 0 is a valid page index!
                */
                var getDivaIndexForPage = function(pageTitle)
                {
                    var splitName = pageTitle.split(".")[0];
                    var divaIndex = meiEditorSettings.divaPages.length;
                    while(divaIndex--)
                    {
                        splitImage = meiEditorSettings.divaPages[divaIndex].split(".")[0];
                        if (splitName == splitImage)
                        {
                            return divaIndex;
                        }
                    }
                    return false;
                };

                var pageTitleForDivaFilename = function(filename)
                {
                    var splitName = filename.split(".")[0];
                    for (curPage in meiEditorSettings.pageData)
                    {
                        splitPage = curPage.split(".")[0];
                        if (splitName == splitPage)
                        {
                            return curPage;
                        }
                    }
                    return false;
                };

                //Various editor listeners for filename changes
                meiEditor.events.subscribe("NewFile", function(a, fileName)
                {
                    //if the page is in Diva...
                    var divaIdx = getDivaIndexForPage(fileName);
                    if (divaIdx === false) return;
                    
                    //scroll to it
                    meiEditorSettings.divaInstance.gotoPageByIndex(divaIdx);
                    meiEditorSettings.pageData[fileName].selection.on('changeCursor', meiEditor.cursorUpdate);           
                    meiEditor.events.publish('UpdateZones');
                });

                meiEditor.events.subscribe("ActivePageChanged", function(fileName)
                {
                    //if the page is in Diva...
                    var divaIdx = getDivaIndexForPage(fileName);
                    if (divaIdx === false) return;
                    
                    //scroll to it
                    meiEditorSettings.divaInstance.gotoPageByIndex(divaIdx);
                    meiEditorSettings.pageData[fileName].selection.on('changeCursor', meiEditor.cursorUpdate);           
                    meiEditor.events.publish('UpdateZones');
                });

                meiEditor.events.subscribe("PageWasDeleted", function(pageName)
                {           
                    meiEditor.events.publish('UpdateZones');
                });

                meiEditor.events.subscribe("PageEdited", meiEditor.reloadZones);

                meiEditor.events.subscribe("PageWasRenamed", function(originalName, newName)
                {
                    //if the page is in Diva...
                    var divaIdx = getDivaIndexForPage(newName);
                    if (divaIdx === false) return;
                    
                    //scroll to it
                    meiEditorSettings.divaInstance.gotoPageByIndex(divaIdx);
                    meiEditorSettings.pageData[newName].selection.on('changeCursor', meiEditor.cursorUpdate);           
                    meiEditor.events.publish('UpdateZones');
                });

                //if diva scrolls to a new page that's loaded, switch to it in the tabs
                diva.Events.subscribe("VisiblePageDidChange", function(pageNumber, fileName)
                {
                    var splitImage = fileName.split(".")[0];
                    for(pageTitle in meiEditorSettings.pageData)
                    {
                        splitPage = pageTitle.split(".")[0];
                        if(splitImage == splitPage)
                        {
                            for(curIdx in meiEditorSettings.tabTitlesByIndex)
                            {
                                if (pageTitle == meiEditorSettings.tabTitlesByIndex[curIdx])
                                {
                                    $("#openPages").tabs("option", "active", curIdx);
                                    return true;
                                }
                            }
                        } 
                    }
                    return false;
                });

                //to get default editor pages
                meiEditor.reapplyEditorClickListener();
                for(fileName in meiEditorSettings.pageData)
                {
                    meiEditorSettings.pageData[fileName].selection.on('changeCursor', meiEditor.cursorUpdate);
                }

                //click listener on diva; if the target is a highlight we want it. this will take all possible highlights.
                $(meiEditorSettings.divaInstance.getSettings().parentObject).on('click', function(e)
                {
                    if ($(e.target).hasClass(meiEditorSettings.divaInstance.getSettings().ID + "highlight"))
                    {
                        //index of the page clicked on
                        var clickedIdx = $(e.target).parent().attr('data-index');
                        var clickedTitle = pageTitleForDivaFilename(meiEditorSettings.divaPages[clickedIdx]);
                        
                        //if the clicked page is not linked, return and do nothing
                        if (clickedTitle === false)
                        {
                            meiEditor.deselectAllHighlights();
                            return false;
                        } 

                        //diva index of the page currently clicked on
                        var currentTitle = meiEditorSettings.activePageTitle;
                        var currentIdx = meiEditorSettings.divaPages.indexOf(currentTitle.split(".")[0]);
                        
                        //if the two indices are not the same
                        if (clickedIdx != currentIdx)
                        {
                            meiEditor.switchToPage(clickedTitle);
                        }

                        meiEditor.deselectAllHighlights();
                        meiEditor.selectHighlight(e.target);
                    }
                    else
                    {
                        meiEditor.deselectAllHighlights();
                    }
                });

                for(curIdx in meiEditorSettings.divaInstance.getSettings().pages)
                {
                    //add all diva image filenames (without extension)
                    meiEditorSettings.divaPages.push(meiEditorSettings.divaInstance.getSettings().pages[curIdx].f);
                }

                return true;
            }
        };
        return retval;
    })());
    window.pluginLoader.pluginLoaded();
})(jQuery);

});