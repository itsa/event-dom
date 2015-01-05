"use strict";

/**
 * Integrates DOM-events to event. more about DOM-events:
 * http://www.smashingmagazine.com/2013/11/12/an-introduction-to-dom-events/
 *
 *
 * <i>Copyright (c) 2014 ITSA - https://github.com/itsa</i>
 * New BSD License - http://choosealicense.com/licenses/bsd-3-clause/
 *
 * @example
 * Event = require('event-dom')(window);
 *
 * @module event
 * @submodule event-dom
 * @class Event
 * @since 0.0.1
*/


var NAME = '[event-dom]: ',
    Event = require('event'),
    later = require('utils').later,
    OUTSIDE = 'outside',
    REGEXP_NODE_ID = /^#\S+$/,
    REGEXP_EXTRACT_NODE_ID = /#(\S+)/,
    REGEXP_UI_OUTSIDE = /^.+outside$/,
    TIME_BTN_PRESSED = 200,
    PURE_BUTTON_ACTIVE = 'pure-button-active',
    UI = 'UI:',
    NODE = 'node',
    REMOVE = 'remove',
    INSERT = 'insert',
    CHANGE = 'change',
    ATTRIBUTE = 'attribute',
    EV_REMOVED = UI+NODE+REMOVE,
    EV_INSERTED = UI+NODE+INSERT,
    EV_CONTENT_CHANGE = UI+NODE+'content'+CHANGE,
    EV_ATTRIBUTE_REMOVED = UI+ATTRIBUTE+REMOVE,
    EV_ATTRIBUTE_CHANGED = UI+ATTRIBUTE+CHANGE,
    EV_ATTRIBUTE_INSERTED = UI+ATTRIBUTE+INSERT,

    /*
     * Internal hash containing all DOM-events that are listened for (at `document`).
     *
     * DOMEvents = {
     *     'click': callbackFn,
     *     'mousemove': callbackFn,
     *     'keypress': callbackFn
     * }
     *
     * @property DOMEvents
     * @default {}
     * @type Object
     * @private
     * @since 0.0.1
    */
    DOMEvents = {};

    require('js-ext/lib/string.js');
    require('js-ext/lib/array.js');
    require('js-ext/lib/object.js');
    require('polyfill/polyfill-base.js');

module.exports = function (window) {
    var DOCUMENT = window.document,
        _domSelToFunc, _evCallback, _findCurrentTargets, _preProcessor, _setupEvents, _setupMutationListener, _teardownMutationListener,
        _setupDomListener, _teardownDomListener, SORT, _sortFunc, _sortFuncReversed, _getSubscribers, _selToFunc, MUTATION_EVENTS;

    require('vdom')(window);

    window._ITSAmodules || Object.protectedProp(window, '_ITSAmodules', {});

    if (window._ITSAmodules.EventDom) {
        return Event; // Event was already extended
    }

    MUTATION_EVENTS = [EV_REMOVED, EV_INSERTED, EV_CONTENT_CHANGE, EV_ATTRIBUTE_REMOVED, , EV_ATTRIBUTE_CHANGED, EV_ATTRIBUTE_INSERTED];

    /*
     * Transfprms the selector to a valid function
     *
     * @method _evCallback
     * @param customEvent {String} the customEvent that is transported to the eventsystem
     * @param subscriber {Object} subscriber
     * @param subscriber.o {Object} context
     * @param subscriber.cb {Function} callbackFn
     * @param subscriber.f {Function|String} filter
     * @private
     * @since 0.0.1
     */
    _selToFunc = function(customEvent, subscriber) {
        Event._sellist.some(function(selFn) {
            return selFn(customEvent, subscriber);
        });
    };

    /*
     * Creates a filterfunction out of a css-selector. To be used for catching any dom-element, without restrictions
     * of any context (like Parcels can --> Parcel.Event uses _parcelSelToDom instead)
     * On "non-outside" events, subscriber.t is set to the node that first matches the selector
     * so it can be used to set as e.target in the final subscriber
     *
     * @method _domSelToFunc
     * @param customEvent {String} the customEvent that is transported to the eventsystem
     * @param subscriber {Object} subscriber
     * @param subscriber.o {Object} context
     * @param subscriber.cb {Function} callbackFn
     * @param subscriber.f {Function|String} filter
     * @private
     * @since 0.0.1
     */
    _domSelToFunc = function(customEvent, subscriber) {
        // this stage is runned during subscription
        var outsideEvent = REGEXP_UI_OUTSIDE.test(customEvent),
            selector = subscriber.f,
            nodeid, byExactId;

        console.log(NAME, '_domSelToFunc type of selector = '+typeof selector);
        // note: selector could still be a function: in case another subscriber
        // already changed it.
        if (!selector || (typeof selector === 'function')) {
            subscriber.n || (subscriber.n=DOCUMENT);
            return true;
        }

        nodeid = selector.match(REGEXP_EXTRACT_NODE_ID);
        nodeid ? (subscriber.nId=nodeid[1]) : (subscriber.n=DOCUMENT);

        byExactId = REGEXP_NODE_ID.test(selector);

        subscriber.f = function(e) {
            // this stage is runned when the event happens
            console.log(NAME, '_domSelToFunc inside filter. selector: '+selector);
            var node = e.target,
                vnode = node.vnode,
                character1 = selector.substr(1),
                match = false;
            // e.target is the most deeply node in the dom-tree that caught the event
            // our listener uses `selector` which might be a node higher up the tree.
            // we will reset e.target to this node (if there is a match)
            // note that e.currentTarget will always be `document` --> we're not interested in that
            // also, we don't check for `node`, but for node.matchesSelector: the highest level `document`
            // is not null, yet it doesn;t have .matchesSelector so it would fail
            if (vnode) {
                // we go through the vdom
                while (vnode && !match) {
                    console.log(NAME, '_domSelToFunc inside filter check match using the vdom');
                    match = byExactId ? (vnode.id===character1) : vnode.matchesSelector(selector);
                    // if there is a match, then set
                    // e.target to the target that matches the selector
                    if (match && !outsideEvent) {
                        subscriber.t = vnode.domNode;
                    }
                    vnode = vnode.vParent;
                }
            }
            else {
                // we go through the dom
                while (node.matchesSelector && !match) {
                    console.log(NAME, '_domSelToFunc inside filter check match using the dom');
                    match = byExactId ? (node.id===character1) : node.matchesSelector(selector);
                    // if there is a match, then set
                    // e.target to the target that matches the selector
                    if (match && !outsideEvent) {
                        subscriber.t = node;
                    }
                    node = node.parentNode;
                }
            }
            console.log(NAME, '_domSelToFunc filter returns '+(!outsideEvent ? match : !match));
            return !outsideEvent ? match : !match;
        };
        return true;
    };

    // at this point, we need to find out what are the current node-refs. whenever there is
    // a filter that starts with `#` --> in those cases we have a bubble-chain, because the selector isn't
    // set up with `document` at its root.
    // we couldn't do this at time of subscribtion, for the nodes might not be there at that time.
    // however, we only need to do this once: we store the value if we find them
    // no problem when the nodes leave the dom later: the previous filter wouldn't pass
    _findCurrentTargets = function(subscribers) {
        console.log(NAME, '_findCurrentTargets');
        subscribers.forEach(
            function(subscriber) {
                console.log(NAME, '_findCurrentTargets for single subscriber. nId: '+subscriber.nId);
                subscriber.nId && (subscriber.n=DOCUMENT.getElementById(subscriber.nId));
            }
        );
    };

    /*
     * Generates an event through our Event-system. Does the actual transportation from DOM-events
     * into our Eventsystem. It also looks at the response of our Eventsystem: if our system
     * halts or preventDefaults the customEvent, then the original DOM-event will be preventDefaulted.
     *
     * @method _evCallback
     * @param e {Object} eventobject
     * @private
     * @since 0.0.1
     */
    _evCallback = function(e) {
        console.log(NAME, '_evCallback');
        var allSubscribers = Event._subs,
            eventName = e.type,
            customEvent = 'UI:'+eventName,
            eventobject, subs, wildcard_named_subs, named_wildcard_subs, wildcard_wildcard_subs, subsOutside,
            subscribers, eventobjectOutside, wildcard_named_subsOutside;

        subs = allSubscribers[customEvent];
        wildcard_named_subs = allSubscribers['*:'+eventName];
        named_wildcard_subs = allSubscribers['UI:*'];
        wildcard_wildcard_subs = allSubscribers['*:*'];

        // Emit the dom-event though our eventsystem:
        // NOTE: emit() needs to be synchronous! otherwise we wouldn't be able
        // to preventDefault in time
        //
        // e = eventobject from the DOM-event OR gesture-event
        // eventobject = eventobject from our Eventsystem, which get returned by calling `emit()`

        subscribers = _getSubscribers(e, true, subs, wildcard_named_subs, named_wildcard_subs, wildcard_wildcard_subs);
        eventobject = Event._emit(e.target, customEvent, e, subscribers, [], _preProcessor);

        // now check outside subscribers
        subsOutside = allSubscribers[customEvent+OUTSIDE];
        wildcard_named_subsOutside = allSubscribers['*:'+eventName+OUTSIDE];
        subscribers = _getSubscribers(e, true, subsOutside, wildcard_named_subsOutside);
        eventobjectOutside = Event._emit(e.target, customEvent+OUTSIDE, e, subscribers, [], _preProcessor);

        // if eventobject was preventdefaulted or halted: take appropriate action on
        // the original dom-event. Note: only the original event can caused this, not the outsideevent
        // stopPropagation on the original eventobject has no impact on our eventsystem, but who know who else is watching...
        // be carefull though: not all gesture events have e.stopPropagation
        eventobject.status.halted && e.stopPropagation && e.stopPropagation();
        // now we might need to preventDefault the original event.
        // be carefull though: not all gesture events have e.preventDefault
        if ((eventobject.status.halted || eventobject.status.defaultPrevented || eventobject.status.defaultPreventedContinue) && e.preventDefault) {
            e.preventDefault();
        }

        if (eventobject.status.ok) {
            // last step: invoke the aftersubscribers
            // we need to do this asynchronous: this way we pass them AFTER the DOM-event's defaultFn
            // also make sure to paas-in the payload of the manipulated eventobject
            subscribers = _getSubscribers(e, false, subs, wildcard_named_subs, named_wildcard_subs, wildcard_wildcard_subs);
            (subscribers.length>0) && later(Event._emit.bind(Event, e.target, customEvent, eventobject, [], subscribers, _preProcessor, true), 10, false);

            // now check outside subscribers
            subscribers = _getSubscribers(e, false, subsOutside, wildcard_named_subsOutside);
            (subscribers.length>0) && later(Event._emit.bind(Event, e.target, customEvent+OUTSIDE, eventobjectOutside, [], subscribers, _preProcessor, true), 10, false);
        }
    };

    /*
     * Creates an array of subscribers in the right order, conform their position in the DOM.
     * Only subscribers that match the filter are involved.
     *
     * @method _getSubscribers
     * @param e {Object} eventobject
     * @param before {Boolean} whether it is a before- or after-subscriber
     * @param subs {Array} array with subscribers
     * @param wildcard_named_subs {Array} array with subscribers
     * @param named_wildcard_subs {Array} array with subscribers
     * @param wildcard_wildcard_subs {Array} array with subscribers
     * @private
     * @since 0.0.1
     */
    _getSubscribers = function(e, before, subs, wildcard_named_subs, named_wildcard_subs, wildcard_wildcard_subs) {
        var subscribers = [],
            beforeOrAfter = before ? 'b' : 'a',
            saveConcat = function(extrasubs) {
                extrasubs && extrasubs[beforeOrAfter] && (subscribers=subscribers.concat(extrasubs[beforeOrAfter]));
            };
        saveConcat(subs);
        saveConcat(wildcard_named_subs);
        saveConcat(named_wildcard_subs);
        saveConcat(wildcard_wildcard_subs);
        if (subscribers.length>0) {
            subscribers = function(array, testFunc) {
                // quickest way to filter an array: see http://jsperf.com/array-filter-performance/4
                var filtered = array.slice(0), i;
                for (i=array.length-1; i>=0; i--) {
                    console.log(NAME, 'filtercheck for subscriber');
                    testFunc(array[i]) || filtered.splice(i, 1);
                }
                return filtered;
            }(subscribers, function(subscriber) {return (!subscriber.f || subscriber.f.call(subscriber.o, e));});
            if (subscribers.length>0) {
                _findCurrentTargets(subscribers);
                // sorting, based upon the sortFn
                subscribers.sort(SORT);
            }
        }
        return subscribers;
    };

    /*
     * Sets e.target, e.currentTarget and e.sourceTarget for the single subscriber.
     * Needs to be done for evenry single subscriber, because with a single event, these values change for each subscriber
     *
     * @method _preProcessor
     * @param subscriber {Object} subscriber
     * @param subscriber.o {Object} context
     * @param subscriber.cb {Function} callbackFn
     * @param subscriber.f {Function|String} filter
     * @param e {Object} eventobject
     * @private
     * @since 0.0.1
     */
    _preProcessor = function(subscriber, e) {
        console.log(NAME, '_preProcessor');
        // inside the aftersubscribers, we may need exit right away.
        // this would be the case whenever stopPropagation or stopImmediatePropagation was called
        // in case the subscribernode equals the node on which stopImmediatePropagation was called: return true
        var propagationStopped, immediatePropagationStopped,
            targetnode = (subscriber.t || subscriber.n);

        immediatePropagationStopped = e.status.immediatePropagationStopped;
        if (immediatePropagationStopped && ((immediatePropagationStopped===targetnode) || !immediatePropagationStopped.contains(targetnode))) {
            console.log(NAME, '_preProcessor will return true because of immediatePropagationStopped');
            return true;
        }
        // in case the subscribernode does not fall within or equals the node on which stopPropagation was called: return true
        propagationStopped = e.status.propagationStopped;
        if (propagationStopped && (propagationStopped!==targetnode) && !propagationStopped.contains(targetnode)) {
            console.log(NAME, '_preProcessor will return true because of propagationStopped');
            return true;
        }

        e.currentTarget = subscriber.n;
        // now we might need to set e.target to the right node:
        // the filterfunction might have found the true domnode that should act as e.target
        // and set it at subscriber.t
        // also, we need to backup the original e.target: this one should be reset when
        // we encounter a subscriber with its own filterfunction instead of selector
        if (subscriber.t) {
            e.sourceTarget || (e.sourceTarget=e.target);
            e.target = subscriber.t;
        }
        else {
            e.sourceTarget && (e.target=e.sourceTarget);
        }
        return false;
    };

    /*
     * Transports DOM-events to the Event-system. Catches events at their most early stage:
     * their capture-phase. When these events happen, a new customEvent is generated by our own
     * Eventsystem, by calling _evCallback(). This way we keep DOM-events and our Eventsystem completely separated.
     *
     * @method _setupDomListener
     * @param customEvent {String} the customEvent that is transported to the eventsystem
     * @param subscriber {Object} subscriber
     * @param subscriber.o {Object} context
     * @param subscriber.cb {Function} callbackFn
     * @param subscriber.f {Function|String} filter
     * @private
     * @since 0.0.1
     */
    _setupDomListener = function(customEvent, subscriber) {
        console.log(NAME, '_setupDomListener');
        var eventSplitted = customEvent.split(':'),
            eventName = eventSplitted[1],
            outsideEvent = REGEXP_UI_OUTSIDE.test(eventName);

        // be careful: anyone could also register an `outside`-event.
        // in those cases, the DOM-listener must be set up without `outside`
        outsideEvent && (eventName=eventName.substring(0, eventName.length-7));

        // if eventName equals `mouseover` or `mouseleave` then we quit:
        // people should use `mouseover` and `mouseout`
        if ((eventName==='mouseenter') || (eventName==='mouseleave')) {
            console.warn(NAME, 'Subscription to '+eventName+' not supported, use mouseover and mouseout: this eventsystem uses these non-noisy so they act as mouseenter and mouseleave');
            return;
        }

        // now transform the subscriber's filter from css-string into a filterfunction
        _selToFunc(customEvent, subscriber);

        // already registered? then return, also return if someone registered for UI:*
        if (DOMEvents[eventName] || (eventName==='*')) {
            // cautious: one might have registered the event, but not yet the outsideevent.
            // in that case: save this setting:
            outsideEvent && (DOMEvents[eventName+OUTSIDE]=true);
            return;
        }

        // one exception: windowresize should listen to the window-object
        if (eventName==='resize') {
            window.addEventListener(eventName, _evCallback);
        }
        else {
            // important: set the third argument `true` so we listen to the capture-phase.
            DOCUMENT.addEventListener(eventName, _evCallback, true);
        }
        DOMEvents[eventName] = true;
        outsideEvent && (DOMEvents[eventName+OUTSIDE]=true);
    };

    _setupEvents = function() {

        // make sure disabled buttons don't work:
        Event.before(['click', 'tap'], function(e) {
            e.preventDefault();
        }, '.pure-button-disabled, button[disabled]');

        // make sure that a focussed button which recieves an keypress also fires the `tap`-event
        // note: the `click`-event will always be fired by the browser
        Event.before(
            'keydown',
            function(e) {
                e._buttonPressed = true;
                Event.emit(e.target, 'UI:tap', e);
            },
            function(e) {
                var keyCode = e.keyCode;
                return (e.target.getTagName()==='BUTTON') && ((keyCode===13) || (keyCode===32));
            }
        );

        // make sure that a focussed button which recieves an keypress also fires the `tap`-event
        // note: the `click`-event will always be fired by the browser
        Event.after(
            'tap',
            function(e) {
                var buttonNode = e.target;
                if (e._buttonPressed) {
                    buttonNode.setClass(PURE_BUTTON_ACTIVE);
                    // even if the node isn't in the DOM, we can still try to manipulate it:
                    // the vdom makes sure no errors occur when the node is already removed
                    later(buttonNode.removeClass.bind(buttonNode, PURE_BUTTON_ACTIVE), TIME_BTN_PRESSED);
                }
            }
        );

    };

    _setupMutationListener = function() {
        DOCUMENT.hasMutationSubs = true;
    };

    /*
     *
     * @method _sortFunc
     * @param customEvent {String}
     * @private
     * @return {Function|undefined} sortable function
     * @since 0.0.1
     */
    _sortFunc = function(subscriberOne, subscriberTwo) {
        return (subscriberTwo.t || subscriberTwo.n).contains(subscriberOne.t || subscriberOne.n) ? -1 : 1;
    };

    /*
     *
     * @method _sortFunc
     * @param customEvent {String}
     * @private
     * @return {Function|undefined} sortable function
     * @since 0.0.1
     */
    _sortFuncReversed = function(subscriberOne, subscriberTwo) {
        return (subscriberOne.t || subscriberOne.n).contains(subscriberTwo.t || subscriberTwo.n) ? 1 : -1;
    };

    /*
     * Removes DOM-eventsubscribers from document when they are no longer needed.
     *
     * @method _teardownDomListener
     * @param customEvent {String} the customEvent that is transported to the eventsystem
     * @private
     * @since 0.0.2
     */
    _teardownDomListener = function(customEvent) {
        var customEventWithoutOutside = customEvent.endsWith(OUTSIDE) ? customEvent.substr(0, customEvent.length-7) : customEvent,
            eventSplitted = customEventWithoutOutside.split(':'),
            eventName = eventSplitted[1];

        if (!Event._subs[customEventWithoutOutside] && !Event._subs[customEventWithoutOutside+OUTSIDE]) {
            console.log(NAME, '_teardownDomListener '+customEvent);
            // remove eventlistener from `document`
            // one exeption: windowresize should listen to the window-object
            if (eventName==='resize') {
                window.removeEventListener(eventName, _evCallback);
            }
            else {
                // important: set the third argument `true` so we listen to the capture-phase.
                DOCUMENT.removeEventListener(eventName, _evCallback, true);
            }
            delete DOMEvents[eventName];
        }
    };

    _teardownMutationListener = function() {
        if (!Event._subs[EV_REMOVED] &&
            !Event._subs[EV_INSERTED] &&
            !Event._subs[EV_CONTENT_CHANGE] &&
            !Event._subs[EV_ATTRIBUTE_REMOVED] &&
            !Event._subs[EV_ATTRIBUTE_CHANGED] &&
            !Event._subs[EV_ATTRIBUTE_INSERTED]
        ) {
            DOCUMENT.hasMutationSubs = false;
        }
    };

    // Now a very tricky one:
    // Some browsers do an array.sort down-top instead of top-down.
    // In those cases we need another sortFn, for the position on an equal match should fall
    // behind instead of before (which is the case on top-down sort)
    [1,2].sort(function(a /*, b */) {
        SORT || (SORT=(a===2) ? _sortFuncReversed : _sortFunc);
    });

    // Now we do some initialization in order to make DOM-events work:

    // Notify when someone subscribes to an UI:* event
    // if so: then we might need to define a customEvent for it:
    // alse define the specific DOM-methods that can be called on the eventobject: `stopPropagation` and `stopImmediatePropagation`
    Event.notify(UI+'*', _setupDomListener, Event)
         ._setEventObjProperty('stopPropagation', function() {this.status.ok || (this.status.propagationStopped = this.target);})
         ._setEventObjProperty('stopImmediatePropagation', function() {this.status.ok || (this.status.immediatePropagationStopped = this.target);});

    // Notify when someone detaches an UI:* event
    // if so: then we might need to detach the native listener on `document`
    Event.notifyDetach(UI+'*', _teardownDomListener, Event);

    Event._sellist = [_domSelToFunc];

    _setupEvents();

    // making HTMLElement to be able to emit using event-emitter:
    (function(HTMLElementPrototype) {
        HTMLElementPrototype.merge(Event.Emitter('UI'));
    }(window.HTMLElement.prototype));








    // Notify when someone subscribes to an UI:* event
    // if so: then we might need to define a customEvent for it:
    // alse define the specific DOM-methods that can be called on the eventobject: `stopPropagation` and `stopImmediatePropagation`
    Event.notify(MUTATION_EVENTS, _setupMutationListener, Event);

    // Notify when someone detaches an UI:* event
    // if so: then we might need to detach the native listener on `document`
    Event.notifyDetach(MUTATION_EVENTS, _teardownMutationListener, Event);

    // Note: window.document has no prototype
    DOCUMENT.suppressMutationEvents = function(suppress) {
        this._suppressMutationEvents = suppress;
    };






    // Event._domCallback is the only method that is added to Event.
    // We need to do this, because `event-mobile` needs access to the same method.
    // We could have done without this method and instead listen for a custom-event to handle
    // Mobile events, however, that would lead into 2 eventcycli which isn't performant.

   /**
    * Does the actual transportation from DOM-events into the Eventsystem. It also looks at the response of
    * the Eventsystem: on e.halt() or e.preventDefault(), the original DOM-event will be preventDefaulted.
    *
    * @method _domCallback
    * @param eventName {String} the customEvent that is transported to the eventsystem
    * @param e {Object} eventobject
    * @private
    * @since 0.0.1
    */
    Event._domCallback = function(e) {
        _evCallback(e);
    };

    // store module:
    window._ITSAmodules.EventDom = Event;
    return Event;
};
