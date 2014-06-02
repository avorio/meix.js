(function ($)
{
    var AceMeiEditor = function(element, plugins, options){
        var self = this;
        var settings = {
            editor: "",
            element: $(element)
        }

        $.extend(settings, options);

        //for topbar plugins
        var previousSizes = {};

        this.events = (function (){
            var cache = {},
            /**
             *      Events.publish
             *      e.g.: Events.publish("/Article/added", [article], this);
             *
             *      @class Events
             *      @method publish
             *      @param topic {String}
             *      @param args     {Array}
             *      @param scope {Object} Optional
             */
            publish = function (topic, args, scope) {
                if (cache[topic]) {
                    var thisTopic = cache[topic],
                        i = thisTopic.length;

                    while (i--) {
                        thisTopic[i].apply( scope || this, args || []);
                    }
                }
            },
            /**
             *      Events.subscribe
             *      e.g.: Events.subscribe("/Article/added", Articles.validate)
             *
             *      @class Events
             *      @method subscribe
             *      @param topic {String}
             *      @param callback {Function}
             *      @return Event handler {Array}
             */
            subscribe = function (topic, callback) {
                if (!cache[topic]) {
                    cache[topic] = [];
                }
                cache[topic].push(callback);
                return [topic, callback];
            },
            /**
             *      Events.unsubscribe
             *      e.g.: var handle = Events.subscribe("/Article/added", Articles.validate);
             *              Events.unsubscribe(handle);
             *
             *      @class Events
             *      @method unsubscribe
             *      @param handle {Array}
             *      @param completely {Boolean}
             */
            unsubscribe = function (handle, completely) {
                var t = handle[0],
                    i = cache[t].length;

                if (cache[t]) {
                    while (i--) {
                        if (cache[t][i] === handle[1]) {
                            cache[t].splice(cache[t][i], 1);
                            if(completely){ delete cache[t]; }
                        }
                    }
                }
            };

            return {
                    publish: publish,
                    subscribe: subscribe,
                    unsubscribe: unsubscribe
            };
        }());
        

        /*
            Minimizes an object.
            @param divID The root ID of the object to minimize.
            @param animateOverride Used at initial load and as needed to skip the jQuery animate function.
        */
        var minimizeObject = function(divID, animateOverride)
        {
            if(typeof animateOverride === undefined)
            {
                animateOverride = false;
            }

            var numMinimized = $(".minimized").length;

            previousSizes[divID] = {
                 'left': $("#" + divID).offset().left,
                 'top': $("#" + divID).offset().top,
                 'width': $("#" + divID).width(),
                 'height': $("#" + divID).height(),
                 'margin': $("#" + divID).css('margin'),
                 'padding': $("#" + divID).css('padding'),

            };

            if(!animateOverride)
            {
                $("#" + divID).animate(
                {
                    'left': numMinimized * 300,
                    'margin': '2px',
                    'width': '280px', //300(actual width) - 4(2 for both margins) - 16(7 for both paddings)
                    'height': 'auto',
                    'top': '0px',
                    'padding': '2px 8px 0px 8px',
                }, 500);
            } 
            else 
            {
                $("#" + divID).css(
                {
                    'left': numMinimized * 300,
                    'margin': '2px',
                    'width': '280px',
                    'height': 'auto',
                    'top': '0px',
                    'padding': '2px 8px 0px 8px',
                });

            }

            $("#" + divID + "-minimized-wrapper").css('display', 'block');
            $("#" + divID + "-maximized-wrapper").css('display', 'none');

            //sortable wasn't working the way I wanted it to so I implemented something manually
            $("#" + divID).draggable(
            {
                axis: "x",
                start: function(e, ui)
                {
                    $(e.target).css('z-index', '103');
                },
                stop: function(e, ui)
                {
                    $(e.target).css('z-index', '102');
                    reorderToolbarObjects();
                },
            });

            //it's better to do jQuery built-in events rather than self.events because I have to check for ID with the latter.
            $("#" + divID).trigger('minimize');
            $("#" + divID).addClass('minimized');
        };

        /*
            Maximizes the file list.
            @param divID The root ID of the object to maximize.
        */
        var maximizeObject = function(divID)
        {
            function resetDims()
            {
                $("#" + divID).css('width', 'auto');
                $("#" + divID).css('height', 'auto');
                $("#" + divID + "-maximized-wrapper").css('display', 'block');
                $("#" + divID + "-minimized-wrapper").css('display', 'none');
            }

            //add the difference in -maximized-wrapper heights before animating to avoid a weird glitch thing
            var tempPrevSizes = previousSizes[divID];
            tempPrevSizes['height'] = $("#" + divID + "-maximized-wrapper").height();

            $("#" + divID).animate(tempPrevSizes, 
            {
                duration: 500,
                complete: resetDims,
            });

            //it's better to do jQuery built-in events rather than self.events because I have to check for ID with the latter.
            $("#" + divID).trigger('maximize');
            $("#" + divID).removeClass('minimized');
            reorderToolbarObjects();
            $("#" + divID).draggable(
            {
                axis: "",
                start: "",
                stop: "",
            }); //need to reset axes and start/stop listeners

        };

        /*
            Function called to reorder the toolbar objects.
        */
        var reorderToolbarObjects = function()
        {
            var numMinimized = $(".minimized").length;
            var orderedByLeft = [];

            while(numMinimized--)
            {
                orderedByLeft.push({'id': $($(".minimized")[numMinimized]).attr('id'), 'left': $($(".minimized")[numMinimized]).offset().left});
            }

            var sortedByLeft = jsonSort(orderedByLeft, 'left', true);
            var numMinimized = sortedByLeft.length;
            while(numMinimized--)
            {
                $("#" + sortedByLeft[numMinimized]['id']).animate({'left': numMinimized * 300 + 3}, 500);
            }
        }

        /*
            Stolen with no mercy from http://stackoverflow.com/questions/881510/jquery-sorting-json-by-properties
        */
        var jsonSort = function(jsonObject, prop, asc) 
        {
            newJsonObject = jsonObject.sort(function(a, b) 
            {
                if (asc) return (a[prop] > b[prop]);
                else return (b[prop] > a[prop]);
            });
            return newJsonObject;
        }

        /*
            Function ran on initialization.
        */
        var _init = function()
        {
            settings.element.append('<div id="topbar">'
                + '</div>' //header
                + '<div id="editor"></div>' //ACE editor
                );

            //for each plugin...
            pluginLength = plugins.length;
            while(pluginLength--)
            {
                curPlugin = plugins[pluginLength];
                //append a formattable structure
                $("#topbar").append('<div id="' + curPlugin.divName + '" class="toolbar-object">' //creates toolbar object
                    + '<div id="' + curPlugin.divName + '-maximized-wrapper">'
                    + curPlugin.maximizedAppearance //user-settable
                    + '<button class="minimize" name="' + curPlugin.divName + '">Minimize</button>' //minimize button
                    + '</div>'
                    + '<div id="' + curPlugin.divName + '-minimized-wrapper">'
                    + '<span id="' + curPlugin.divName + '-minimized-title">' + curPlugin.minimizedTitle + '</span>'
                    + curPlugin.minimizedAppearance //also user-settable
                    + '<button class="maximize" name="' + curPlugin.divName + '">Maximize</button>' //maximize button
                    + '</div>'
                    + '</div>'
                    );

                minimizeObject(curPlugin.divName, true);
                $("#"+curPlugin.divName).draggable();

                //call the init function to set up some more stuff
                curPlugin._init(self, settings);
            }            

            settings.editor = ace.edit("editor"); //create the ACE editor
            settings.editor.setTheme("ace/theme/ambiance");
            settings.editor.getSession().setMode("ace/mode/xml");

            //various jQuery listeners that have to be put in after the buttons exist
            $(".minimize").on('click', function(event)
            {
                minimizeObject(event.target.name);
            });
            $(".maximize").on('click', function(event)
            {
                maximizeObject(event.target.name);
            });
        };

        _init();

    }

    $.fn.AceMeiEditor = function (plugins, options)
    {
        return this.each(function ()
        {
            var element = $(this);

            // Return early if this element already has a plugin instance
            if (element.data('AceMeiEditor'))
                return;

            // Save the reference to the container element
            options.parentSelector = element;

            // Otherwise, instantiate the document viewer
            var meiEditor = new AceMeiEditor(this, plugins, options);
            element.data('AceMeiEditor', meiEditor);
        });
    };

})(jQuery);