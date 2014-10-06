"use strict";

/**
 * Adds the `hover` event as a DOM-event to event-dom. more about DOM-events:
 * http://www.smashingmagazine.com/2013/11/12/an-introduction-to-dom-events/
 *
 * Should be called using  the provided `mergeInto`-method like this:
 *
 *
 * <i>Copyright (c) 2014 ITSA - https://github.com/itsa</i>
 * New BSD License - http://choosealicense.com/licenses/bsd-3-clause/
 *
 * @example
 * Event = require('event-dom/hover.js')(window);
 *
 * or
 *
 * @example
 * Event = require('event-dom')(window);
 * require('event-dom/event-hover.js')(window);
 *
 * @module event
 * @submodule event-hover
 * @class Event
 * @since 0.0.2
*/


var NAME = '[event-drag]: ';

module.exports = function (window) {
    var Event = require('../event-dom.js')(window),

    /**
    Check to see if a node has editable content or not.

    TODO: Add additional checks to get it to work for child nodes
    that inherit "contenteditable" from parent nodes. This may be
    too computationally intensive to be placed inside of the `_poll`
    loop, however.

    @method _isEditable
    @param {Node} node
    @protected
    @static
    **/
    _isEditable = function (node) {
        // Performance cheat because this is used inside `_poll`
        var domNode = node._node;
        return domNode.contentEditable === 'true' ||
               domNode.contentEditable === '';
    },


    /*
     * Creates the `hover` event. The eventobject has the property `e.hover` which is a `Promise`.
     * You can use this Promise to get notification of the end of hover. The Promise e.hover gets resolved with
     * `relatedTarget` as argument: the node where the mouse went into when leaving a.target.
     *
     * @method _setupValueChange
     * @private
     * @since 0.0.2
     */
    _setupValueChange = function() {
        // create only after subscribing to the `hover`-event
        Event.after('mouseover', function(e) {
            console.info(NAME, 'setting up mouseover event');
            var node = e.target;
            e.hover = new Promise(function(fulfill, reject) {
                Event.after(
                    'mouseout',
                    function(e) {
                        fulfill(e.relatedTarget);
                    },
                    function(ev) {
                        return (ev.target===node);
                    }
                );
            });
            Event.emit(node, 'UI:hover', e);
        });
    };

    // Event.notify('UI:valuechange', _setupValueChange, Event);

    return Event;
};
