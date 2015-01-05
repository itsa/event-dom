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


var NAME = '[event-hover]: ';

module.exports = function (window) {

    window._ITSAmodules || window.protectedProp('_ITSAmodules', {});

    if (window._ITSAmodules.EventHover) {
        return window._ITSAmodules.EventHover; // EventHover was already created
    }

    var Event = require('../event-dom.js')(window),

    subscriber,

    /*
     * Creates the `hover` event. The eventobject has the property `e.hover` which is a `Promise`.
     * You can use this Promise to get notification of the end of hover. The Promise e.hover gets resolved with
     * `relatedTarget` as argument: the node where the mouse went into when leaving a.target.
     *
     * @method setupHover
     * @private
     * @since 0.0.2
     */
    setupHover = function() {
        // create only after subscribing to the `hover`-event
        subscriber = Event.after('mouseover', function(e) {
            console.log(NAME, 'setupHover: setting up mouseover event');
            var node = e.target;
            e.hover = new Promise(function(fulfill) {
                Event.onceAfter(
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
    },

    /*
     * Removes the `hover` event. Because there are no subscribers anymore.
     *
     * @method teardownHover
     * @private
     * @since 0.0.2
     */
    teardownHover = function() {
        // check if there aren't any subscribers anymore.
        // in that case, we detach the `mouseover` lister because we don't want to
        // loose performance.
        if (!Event._subs['UI:hover']) {
            console.log(NAME, 'teardownHover: stop setting up mouseover event');
            subscriber.detach();
            // reinit notifier, because it is a one-time notifier:
            Event.notify('UI:hover', setupHover, Event, true);
        }
    };

    Event.notify('UI:hover', setupHover, Event, true);
    Event.notifyDetach('UI:hover', teardownHover, Event);

    window._ITSAmodules.EventHover = Event;

    return Event;
};
