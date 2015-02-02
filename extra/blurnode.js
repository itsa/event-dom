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


var NAME = '[event-blurnode]: ',
    createHashMap = require('js-ext/extra/hashmap.js').createMap;

require('js-ext/lib/object.js');

module.exports = function (window) {

    window._ITSAmodules || Object.protectedProp(window, '_ITSAmodules', createHashMap());

    if (window._ITSAmodules.EventBlurNode) {
        return window._ITSAmodules.EventBlurNode; // EventBlurNode was already created
    }

    var Event = require('../event-dom.js')(window),
        blurNodes = [],
        subscriber, focusEvent,

    /*
     * Creates the `hover` event. The eventobject has the property `e.hover` which is a `Promise`.
     * You can use this Promise to get notification of the end of hover. The Promise e.hover gets resolved with
     * `relatedTarget` as argument: the node where the mouse went into when leaving a.target.
     *
     * @method setupHover
     * @private
     * @since 0.0.2
     */
    setupBlurNode = function() {
        // create only after subscribing to the `hover`-event
        subscriber = Event.after('blur', function(e) {
            console.log(NAME, 'making list of blur-nodes');
            blurNodes[blurNodes.length] = e.target;
            focusEvent || (focusEvent=Event.onceAfter('focus', function(e2) {
                var focusNode = e2.target,
                    len = blurNodes.length,
                    i;
                // remove blurnode when the new focusnode lies within:
                for (i=len-1; i>=0; i--) {
                    blurNode = blurNodes[i];
                    blurNode.contains(focusNode) && blurNodes.splice(i, 1);
                }
                // every item that remains: fire a blurnode-event with the first blur-event object:
                len = blurNodes.length;
                for (i=0; i<len; i++) {
                    Event.emit(blurNodes[i], 'UI:blurnode', e);
                }
                blurNodes.length = 0;
                focusEvent = 0;
            }));
        });
    },

    /*
     * Removes the `hover` event. Because there are no subscribers anymore.
     *
     * @method teardownHover
     * @private
     * @since 0.0.2
     */
    teardownBlurNode = function() {
        // check if there aren't any subscribers anymore.
        // in that case, we detach the `mouseover` lister because we don't want to
        // loose performance.
        if (!Event._subs['UI:blurnode']) {
            console.log(NAME, 'teardownBlurNode: stop listening for blur-event');
            subscriber.detach();
            // reinit notifier, because it is a one-time notifier:
            Event.notify('UI:blurnode', setupBlurNode, Event, true);
        }
    };

    Event.defineEvent('UI:blurnode')
         .unPreventable()
         .noRender();

    Event.notify('UI:blurnode', setupBlurNode, Event, true);
    Event.notifyDetach('UI:blurnode', teardownBlurNode, Event);

    window._ITSAmodules.EventBlurNode = Event;

    return Event;
};
