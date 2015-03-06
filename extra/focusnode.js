"use strict";

/**
 * Adds the `focusnode` event as a DOM-event to event-dom. more about DOM-events:
 * http://www.smashingmagazine.com/2013/11/12/an-introduction-to-dom-events/
 *
 *
 * <i>Copyright (c) 2014 ITSA - https://github.com/itsa</i>
 * New BSD License - http://choosealicense.com/licenses/bsd-3-clause/
 *
 * @example
 * Event = require('event-dom/focusnode.js')(window);
 *
 * or
 *
 * @example
 * Event = require('event-dom')(window);
 * require('event-dom/event-focusnode.js')(window);
 *
 * @module event
 * @submodule event-focusnode
 * @class Event
 * @since 0.0.2
*/


var NAME = '[event-focusnode]: ',
    createHashMap = require('js-ext/extra/hashmap.js').createMap;

require('js-ext/lib/object.js');

module.exports = function (window) {

    window._ITSAmodules || Object.protectedProp(window, '_ITSAmodules', createHashMap());

    if (window._ITSAmodules.EventFocusNode) {
        return window._ITSAmodules.EventFocusNode; // EventFocusNode was already created
    }

    var Event = require('../event-dom.js')(window),
        subscriber, previousVnode,

    /*
     * Creates the `focisnode` event.
     *
     * @method setupFocusNode
     * @private
     * @since 0.0.2
     */
    setupFocusNode = function() {
        // create only after subscribing to the `hover`-event
        subscriber = Event.after('focus', function(e) {
            var targetVnode = e.target.vnode,
                vnode = targetVnode,
                alreadyFocussed;
            if (vnode) {
                do {
                    alreadyFocussed = previousVnode && vnode.contains(previousVnode);
                    alreadyFocussed || Event.emit(vnode.domNode, 'UI:focusnode', e);
/*jshint boss:true */
                } while (!alreadyFocussed && (vnode=vnode.vParent));
/*jshint boss:false */
            }
            previousVnode = targetVnode;
        });
    },

    /*
     * Removes the `focusnode` event. Because there are no subscribers anymore.
     *
     * @method teardownFocusNode
     * @private
     * @since 0.0.2
     */
    teardownFocusNode = function() {
        // check if there aren't any subscribers anymore.
        // in that case, we detach the `mouseover` lister because we don't want to
        // loose performance.
        if (!Event._subs['UI:focusnode']) {
            console.log(NAME, 'teardownFocusNode: stop listening for blur-event');
            subscriber.detach();
            // reinit notifier, because it is a one-time notifier:
            Event.notify('UI:focusnode', setupFocusNode, Event, true);
        }
    };

    Event.defineEvent('UI:focusnode').unPreventable();

    Event.notify('UI:focusnode', setupFocusNode, Event, true);
    Event.notifyDetach('UI:focusnode', teardownFocusNode, Event);

    Event.noDeepDomEvt('UI:focusnode');

    window._ITSAmodules.EventFocusNode = Event;

    return Event;
};
