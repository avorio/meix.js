require(['meiEditor', window.meiEditorLocation + 'js/lib/UndoStack'], function(){
(function ($)
{
    window.meiEditorPlugins.push((function()
    {
        var retval = 
        {
            divName: "edit-pane", 
            title: "Edit", 
            dropdownOptions: 
            {
                'Undo': 'undo-dropdown',
                'Redo': 'redo-dropdown',
                'Find...': 'find-dropdown',
                'Replace...': 'replace-dropdown',
            },
            init: function(meiEditor, meiEditorSettings)
            {
                $.extend(meiEditorSettings, {
                    undoManager: new UndoStack(),
                    initCursor: "",
                    initDoc: "",
                    editTimeout: "",
                });

                $("#undo-dropdown").on('click', function()
                {
                    var retVal = meiEditorSettings.undoManager.undo();
                    if(!retVal)
                    {
                        meiEditor.localWarn("Nothing to undo.");
                    }
                });

                $("#redo-dropdown").on('click', function()
                {
                    var retVal = meiEditorSettings.undoManager.redo();
                    if(!retVal)
                    {
                        meiEditor.localWarn("Nothing to redo.");
                    }
                });

                $("#find-dropdown").on('click', function()
                {
                    var editor = meiEditorSettings.pageData[meiEditor.getActivePanel().text()];
                    var config = require("ace/config");
                    config.loadModule("ace/ext/searchbox", function(e) {e.Search(editor)});
                });

                $("#replace-dropdown").on('click', function()
                {
                    var editor = meiEditorSettings.pageData[meiEditor.getActivePanel().text()];
                    var config = require("ace/config");
                    config.loadModule("ace/ext/searchbox", function(e) {e.Search(editor, true)});

                });

                $("#edit-pane-help").on('click', function(){
                    $("#editHelpModal").modal();
                });

                createModal(meiEditorSettings.element, 'fileHelpModal', false, '<h4>Help for "Edit" menu:</h4>'  
                + '<li>The undo option (also accessible by pressing ctrl+z on Mac) will undo the last action performed.</li>'
                + '<li>The redo option (also accessible by pressing ctrl+y on Mac) will redo the last action performed.</li>'
                + '<li>The find option (also accessible by pressing ctrl+f on Windows or command+f on Mac) will open a find box based on the currently open page.</li>'
                + '<li>The replace option (also accessible by pressing ctrl+h on Windows or command+option+f on Mac) will open a find/replace box based on the currently open page.</li>');

                meiEditor.reloadUndoListeners = function(fileName)
                {                    
                    //when each document changes
                    meiEditorSettings.pageData[fileName].on('change', function(delta, editor)
                    {
                        //clear the previous doc and get the current cursor/document settings
                        window.clearTimeout(meiEditorSettings.editTimeout);
                        var newText = delta.data.text;

                        if(!/\s/.test(newText))
                        {
                            if(!meiEditorSettings.initCursor)
                            {
                                meiEditorSettings.initCursor = editor.getCursorPosition();
                            }
                            if(!meiEditorSettings.initDoc)
                            {
                                meiEditorSettings.initDoc = $("#openPages").tabs('option', 'active');
                            }    
                        }

                        meiEditorSettings.editTimeout = setTimeout(function(arr)
                        {
                            meiEditorSettings.initCursor = undefined;
                            meiEditorSettings.activeDoc = undefined;
                            //if it's been 500ms since the last change, get the current text, cursor position, and active document number, then save that as an undo
                            var texts = arr[0];
                            var cursorPos = arr[1];
                            var activeDoc = arr[2];
                            meiEditorSettings.undoManager.save('PageEdited', [texts, cursorPos, activeDoc]);
                        }, 500, [meiEditor.getAllTexts(), meiEditorSettings.initCursor, meiEditorSettings.initDoc]); //after no edits have been done for a second, save the page in the undo stack
                    });
                }

                $(document).on('keydown', function(e)
                {
                    if (e.ctrlKey)
                    {
                        if (e.keyCode == 90)
                        {
                            e.preventDefault();

                            //shorthand for triggering an undo
                            $("#undo-dropdown").trigger('click');
                        }
                        else if (e.keyCode == 89)
                        {
                            e.preventDefault();

                            //shorthand for triggering an redo
                            $("#redo-dropdown").trigger('click');
                        }
                    }
                });

                $.each(meiEditorSettings.pageData, function(fileName, pageData)
                {
                    meiEditor.reloadUndoListeners(fileName);
                });

                meiEditor.events.subscribe("NewFile", function(fileData, fileName){
                    meiEditor.reloadUndoListeners(fileName);
                    meiEditorSettings.undoManager.save('PageEdited', [meiEditor.getAllTexts(), [{'row':0, 'column':0}], $("#pagesList li").length - 1]);
                });

                //when editor pane changes are undone
                meiEditorSettings.undoManager.newAction('PageEdited', function(texts, cursor, doc, currentState)
                {
                    //replace the editsession for that title
                    for(curTitle in texts)
                    {
                        meiEditorSettings.pageData[curTitle].setSession(new ace.EditSession(texts[curTitle]));
                        meiEditorSettings.pageData[curTitle].resize();
                        meiEditorSettings.pageData[curTitle].focus();
                    }

                    meiEditor.events.publish("PageEdited");

                    //swap back to that tab
                    $("#openPages").tabs('option', 'active', doc);

                    //move cursor to before first alpha-numberic character of most recent change
                    var title = meiEditor.getActivePanel().text();
                    var newCursor = currentState.parameters[1];
                    meiEditorSettings.pageData[title].gotoLine(newCursor['row'] + 1, newCursor['column'], true); //because 1-indexing is always the right choice
                    meiEditorSettings.pageData[title].resize();
                });

                return true;
            }
        }
        return retval;
    })());
    window.pluginLoader.pluginLoaded();
})(jQuery);

});