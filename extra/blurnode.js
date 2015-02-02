"use strict";

/**
 * Adds the `blurnode` event as a DOM-event to event-dom. more about DOM-events:
 * http://www.smashingmagazine.com/2013/11/12/an-introduction-to-dom-events/
 *
 *
 * <i>Copyright (c) 2014 ITSA - https://github.com/itsa</i>
 * New BSD License - http://choosealicense.com/licenses/bsd-3-clause/
 *
 * @example
 * Event = require('event-dom/blurnode.js')(window);
 *
 * or
 *
 * @example
 * Event = require('event-dom')(window);
 * require('event-dom/event-blurnode.js')(window);
 *
 * @module event
 * @submodule event-blurnode
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
        blurVNode, subscriber, focusEvent,

    /*
     * Creates the `blurnode` event.
     *
     * @method setupBlurNode
     * @private
     * @since 0.0.2
     */
    setupBlurNode = function() {
        // create only after subscribing to the `hover`-event
        subscriber = Event.before('blur', function(e) {
            console.log(NAME, 'making list of blur-nodes');
            blurVNode || (blurVNode=e.target.vnode);
            focusEvent || (focusEvent=Event.onceAfter('focus', function(e2) {
                var focusVNode = e2.target.vnode;
                while (focusVNode && blurVNode && !blurVNode.contains(focusVNode)) {
                    Event.emit(blurVNode.domNode, 'UI:blurnode', e);
                    blurVNode = blurVNode.vParent;
                }
                blurVNode = null;
                focusEvent = null;
            }));
        });
    },

    /*
     * Removes the `blurnode` event. Because there are no subscribers anymore.
     *
     * @method teardownBlurNode
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

    Event.noDeepDomEvt('UI:blurnode');

    window._ITSAmodules.EventBlurNode = Event;

    return Event;
};
