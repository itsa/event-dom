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
require('vdom');

var NAME = '[event-valuechange]: ',
    VALUE = 'value',
    DATA_KEY = 'valueChange',
    UTILS = require('utils'),

    /**
    Interval (in milliseconds) at which to poll for changes to the value of an
    element with one or more `valuechange` subscribers when the user is likely
    to be interacting with it.

    @property POLL_INTERVAL
    @type Number
    @default 50
    @static
    **/
    POLL_INTERVAL = 50;

module.exports = function (window) {

    if (!window._ITSAmodules) {
        Object.defineProperty(window, '_ITSAmodules', {
            configurable: false,
            enumerable: false,
            writable: false,
            value: {} // `writable` is false means we cannot chance the value-reference, but we can change {} its members
        });
    }

    if (window._ITSAmodules.EventValueChange) {
        return window._ITSAmodules.EventValueChange; // EventValueChange was already created
    }

    var Event = require('../event-dom.js')(window),
    DOCUMENT = window.document,
    subscriberBlur,
    subscriberFocus,

    /*
     * Checks if the HtmlElement is editable.
     *
     * @method editableNode
     * @param node {HtmlElement}
     * @private
     * @return {Boolean} whether the HtmlElement is editable.
     * @since 0.0.1
     */
    editableNode = function(node) {
        var editable;
        if (node===DOCUMENT) {
            return false;
        }
        console.log(NAME, 'editableNodes '+DOCUMENT.test(node, 'input, textarea, select') || ((editable=node.getAttr('contenteditable')) && (editable!=='false')));
        return DOCUMENT.test(node, 'input, textarea, select') || ((editable=node.getAttr('contenteditable')) && (editable!=='false'));
    },


    /*
     * Gets invokes when the HtmlElement gets focus. Initializes a `keypress` and `click`/'press' eventlisteners.
     *
     * @method startFocus
     * @param e {Object} eventobject
     * @private
     * @since 0.0.1
     */
    startFocus = function(e) {
        console.log(NAME, 'startFocus');
        var node = e.target,
            editable, valueChangeData;

        if (!editableNode(node)) {
            return;
        }

        // first backup the current value:
        editable = ((editable=node.getAttr('contenteditable')) && (editable!=='false'));
        valueChangeData = node.getData(DATA_KEY);

        if (!valueChangeData) {
            valueChangeData = {
                editable : editable
            };
            node.setData(DATA_KEY, valueChangeData);
        }
        valueChangeData.prevVal = editable ? node.innerHTML : node[VALUE];
        startPolling(e);
    },


    /*
     * Removes the `focus` and `blur` events and ends the polling - if running. Because there are no subscribers anymore.
     *
     * @method endFocus
     * @private
     * @since 0.0.1
     */
    endFocus = function(e) {
        console.log(NAME, 'endFocus');
        stopPolling(e.target);
    },

    /*
     * Creates the `focus` and `blur` events. Also invokes `startFocus` to do inititalization.
     *
     * @method setupValueChange
     * @private
     * @since 0.0.2
     */
    setupValueChange = function() {
        console.log(NAME, 'setupValueChange');
        // create only after subscribing to the `hover`-event
        subscriberBlur = Event.after('blur', endFocus);
        subscriberFocus = Event.after('focus', startFocus);
        startFocus({target: DOCUMENT.activeElement});
    },


    /*
     * Starts polling in case of mouseclicks.
     *
     * @method startPolling
     * @private
     * @since 0.0.1
     */
    startPolling = function(e) {
        var node = e.target,
            valueChangeData;

        if (!editableNode(node)) {
            return;
        }
        console.log(NAME, 'startPolling');

        valueChangeData = node.getData(DATA_KEY);
        // cancel previous timer: we don't want multiple timers:
        valueChangeData._pollTimer && valueChangeData._pollTimer.cancel();
        // setup a new timer:
        valueChangeData._pollTimer = UTILS.later(checkChanged.bind(null, e), POLL_INTERVAL, true);
    },


    /*
     * Stops polling on the specific HtmlElement
     *
     * @method stopPolling
     * @param node {HtmlElement} the HtmlElement that should stop polling.
     * @private
     * @since 0.0.1
     */
    stopPolling = function(node) {
        console.log(NAME, 'stopPolling');
        var valueChangeData;
        if (node && node.getData) {
            valueChangeData = node.getData(DATA_KEY);
            valueChangeData && valueChangeData._pollTimer && valueChangeData._pollTimer.cancel();
        }
    },


    /*
     * Checks e.target if its value has changed. If so, it will fire the `valuechange`-event.
     *
     * @method checkChanged
     * @param e {Object} eventobject
     * @private
     * @since 0.0.1
     */
    checkChanged = function(e) {
        console.log(NAME, 'checkChanged');
        var node = e.target;
        // because of delegating all matched HtmlElements come along: only check the node that has focus:
        if (DOCUMENT.activeElement!==node) {
            return;
        }
        var prevData = node.getData(DATA_KEY),
            editable = ((editable=node.getAttr('contenteditable')) && (editable!=='false')),
            currentData = editable ? node.innerHTML : node[VALUE];
        if (currentData!==prevData.prevVal) {
            console.log(NAME, 'checkChanged --> value has been changed');
            DOCUMENT._emitVC(node, currentData);
            prevData.prevVal = currentData;
        }
    },

    /*
     * Removes the `focus` and `blur` events and ends the polling - if running. Because there are no subscribers anymore.
     *
     * @method teardownValueChange
     * @private
     * @since 0.0.1
     */
    teardownValueChange = function() {
        // check if there aren't any subscribers anymore.
        // in that case, we detach the `mouseover` lister because we don't want to
        // loose performance.
        if (!Event._subs['UI:valuechange']) {
            console.log(NAME, 'teardownValueChange: stop setting up blur and focus-event');
            subscriberBlur.detach();
            subscriberFocus.detach();
            // also stop any possible action/listeners to a current element:
            endFocus({target: DOCUMENT.activeElement});
            // reinit notifier, because it is a one-time notifier:
            Event.notify('UI:valuechange', setupValueChange, Event, true);
        }
    };

    Event.notify('UI:valuechange', setupValueChange, Event, true);
    Event.notifyDetach('UI:valuechange', teardownValueChange, Event);

    /*
     * Emits the `valuechange`-event on the specified node. Also adds e.value with the new value.
     *
     * @method _emitVC
     * @param node {HtmlElement} the HtmlElement that fires the event
     * @param value {String} the new value
     * @private
     * @since 0.0.1
     */
    DOCUMENT._emitVC = function(node, value) {
        console.log(NAME, 'document._emitVC');
        var e = {
            value: value,
            currentTarget: DOCUMENT,
            sourceTarget: node
        };
        /**
        * @event valuechange
        * @param e.value {String} new value
        * @param e.sourceTarget {Element} Element whare the valuechange occured
        */
        Event.emit(node, 'UI:valuechange', e);
    };

    window._ITSAmodules.EventValueChange = Event;

    return Event;
};
