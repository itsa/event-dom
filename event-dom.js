/* globals window:true, document:true, Element:true */

"use strict";

/**
 * Integrates DOM-events to core-event-base. more about DOM-events:
 * http://www.smashingmagazine.com/2013/11/12/an-introduction-to-dom-events/
 *
 * Should be called using  the provided `mergeInto`-method like this:
 *
 * @example
 * Event = require('event');
 * DOMEvent = require('event-dom');
 * DOMEvent.mergeInto(Event);
 *
 * @module event
 * @submodule event-dom
 * @class Event
 * @since 0.0.1
 *
 * <i>Copyright (c) 2014 Parcela - https://github.com/Parcela</i>
 * New BSD License - https://github.com/ItsAsbreuk/itsa-library/blob/master/LICENSE
 *
*/


var NAME = '[event-dom]: ',
    Event = require('event'),
    async = require('utils').async,
    OUTSIDE = 'outside',
    REGEXP_UI = /^UI:/,
    REGEXP_NODE_ID = /^#\S+$/,
    REGEXP_EXTRACT_NODE_ID = /#(\S+)/,
    REGEXP_UI_OUTSIDE = /^.+outside$/,
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
    DOCUMENT_POSITION_CONTAINED_BY = 16,
    DOMEvents = {};

module.exports = function (window) {
    var DOCUMENT = window.document,
        NEW_EVENTSYSTEM = DOCUMENT.addEventListener,
        OLD_EVENTSYSTEM = !NEW_EVENTSYSTEM && DOCUMENT.attachEvent,
        DOM_Events, _bubbleIE8, _domSelToFunc, _evCallback, _findCurrentTargets, _preProcessor,
        _filter, _setupDomListener, SORT, _sortFunc, _sortFuncReversed, _getSubscribers, _selToFunc;

    window.Parcela || (window.Parcela={});
    window.Parcela.modules || (window.Parcela.modules={});

    if (window.Parcela.modules.EventDom) {
        return Event; // Event was already extended
    }

    // polyfill for Element.matchesSelector
    // based upon https://gist.github.com/jonathantneal/3062955
    window.Element && function(ElementPrototype) {
        ElementPrototype.matchesSelector = ElementPrototype.matchesSelector ||
        ElementPrototype.mozMatchesSelector ||
        ElementPrototype.msMatchesSelector ||
        ElementPrototype.oMatchesSelector ||
        ElementPrototype.webkitMatchesSelector ||
        function (selector) {
            var node = this,
                nodes = (node.parentNode || DOCUMENT).querySelectorAll(selector),
                i = -1;
            while (nodes[++i] && (nodes[i] !== node));
            return !!nodes[i];
        };
    }(window.Element.prototype);

    // polyfill for Node.contains
    window.Node && !window.Node.prototype.contains && function(NodePrototype) {
        NodePrototype.contains = function(child) {
            var comparison = this.compareDocumentPosition(child);
            return !!((comparison===0) || (comparison & DOCUMENT_POSITION_CONTAINED_BY));
        };
    }(window.Node.prototype);

    /*
     * Polyfill for bubbling the `focus` and `blur` events in IE8.
     *
     * IE>8 we can use delegating on ALL events, because we use the capture-phase.
     * Unfortunatly this cannot be done with IE<9. But we can simulate focus and blur
     * delegation bu monitoring the focussed node.
     *
     * This means the IE<9 will miss the events: 'error', 'load', 'resize' and 'scroll'
     * However, if you need one of these to work in IE8, then you can `activate` this event on the
     * single node that you want to minotor. You activate it and then you use the eventsystem
     * like like you are used to. (delegated). Only activated nodes will bubble their non-bubbling events up
     * Activation is not done manually, but automaticly: whenever there is a subscriber on a node (or an id-selector)
     * and IE<9 is the environment, then a listener for that node is set up.
     * Side-effect is that we cannot controll when the listener isn't needed anymore. This might lead to memory-leak - but its IE<9...
     *
     * @method _bubbleIE8
     * @private
     * @since 0.0.1
     */
    _bubbleIE8 = function() {
        console.log(NAME, '_bubbleIE8');
        // we wil emulate focus and blur by subscribing to the keyup and mouseup events:
        // when they happen, we'll ask for the current focussed Node --> if there is a
        // change compared to the previous, then we fire both a blur and a focus-event
        Event._focussedNode = DOCUMENT.activeElement;
        Event.after(['keyup', 'mouseup'], function(e) {
            var newFocussed = DOCUMENT.activeElement,
                prevFocussed = Event._focussedNode;
            if (prevFocussed !== newFocussed) {
                Event._focussedNode = newFocussed;
                Event.emit(prevFocussed, 'UI:blur', e);
                Event.emit(newFocussed, 'UI:focus', e);
            }
        });
    };

    _selToFunc = function(customEvent, subscriber) {
        Event._sellist.some(function(selFn) {
            return selFn(customEvent, subscriber);
        });
    },

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
                match = false;
            // e.target is the most deeply node in the dom-tree that caught the event
            // our listener uses `selector` which might be a node higher up the tree.
            // we will reset e.target to this node (if there is a match)
            // note that e.currentTarget will always be `document` --> we're not interested in that
            // also, we don't check for `node`, but for node.matchesSelector: the highest level `document`
            // is not null, yet it doesn;t have .matchesSelector so it would fail
            while (node.matchesSelector && !match) {
                console.log(NAME, '_domSelToFunc inside filter check match');
                match = byExactId ? (node.id===selector.substr(1)) : node.matchesSelector(selector);
                // if there is a match, then set
                // e.target to the target that matches the selector
                if (match && !outsideEvent) {
                    subscriber.t = node;
                }
                node = node.parentNode;
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
        if ((eventobject.status.halted || eventobject.status.defaultPrevented) && e.preventDefault) {
            e.preventDefault();
        }

        if (eventobject.status.ok) {
            // last step: invoke the aftersubscribers
            // we need to do this asynchronous: this way we pass them AFTER the DOM-event's defaultFn
            // also make sure to paas-in the payload of the manipulated eventobject
            subscribers = _getSubscribers(e, false, subs, wildcard_named_subs, named_wildcard_subs, wildcard_wildcard_subs);
            (subscribers.length>0) && async(Event._emit.bind(Event, e.target, customEvent, eventobject, [], subscribers, _preProcessor, true), false);

            // now check outside subscribers
            subscribers = _getSubscribers(e, false, subsOutside, wildcard_named_subsOutside);
            (subscribers.length>0) && async(Event._emit.bind(Event, e.target, customEvent+OUTSIDE, eventobjectOutside, [], subscribers, _preProcessor, true), false);
        }
    };

    /*
     * Filters a list of subscribers to only those subscribers that match the filter.
     *
     * @method _filter
     * @param subscriber {Object} subscriber
     * @param subscriber.o {Object} context
     * @param subscriber.cb {Function} callbackFn
     * @param subscriber.f {Function|String} filter
     * @param e {Object} eventobject
     * @private
     * @return {Array} sublist of the subscribers: only those who match the filter.
     * @since 0.0.1
     */
    _filter = function(subscribers, e) {
        console.log(NAME, '_filter');
        var filtered = [];
        subscribers.forEach(
            function(subscriber) {
                console.log(NAME, '_filter for subscriber');
                if (!subscriber.f || subscriber.f.call(subscriber.o, e)) {
                    filtered.push(subscriber);
                }
            }
        );
        return filtered;
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
            subscribers=_filter(subscribers, e);
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

        if (NEW_EVENTSYSTEM) {
            // important: set the third argument `true` so we listen to the capture-phase.
            DOCUMENT.addEventListener(eventName, _evCallback, true);
        }
        else if (OLD_EVENTSYSTEM) {
            DOCUMENT.attachEvent('on'+eventName, _evCallback);
        }
        DOMEvents[eventName] = true;
        outsideEvent && (DOMEvents[eventName+OUTSIDE]=true);
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

    // Now a very tricky one:
    // Some browsers do an array.sort down-top instead of top-down.
    // In those cases we need another sortFn, for the position on an equal match should fall
    // behind instead of before (which is the case on top-down sort)
    [1,2].sort(function(a, b) {
        SORT || (SORT=(a===2) ? _sortFuncReversed : _sortFunc);
    });

    // Now we do some initialization in order to make DOM-events work:

    // Notify when someone subscriber to an UI:* event
    // if so: then we might need to define a customEvent for it:
    // alse define the specific DOM-methods that can be called on the eventobject: `stopPropagation` and `stopImmediatePropagation`
    Event.notify('UI:*', _setupDomListener, Event)
         ._setEventObjProperty('stopPropagation', function() {this.status.ok || (this.status.propagationStopped = this.target);})
         ._setEventObjProperty('stopImmediatePropagation', function() {this.status.ok || (this.status.immediatePropagationStopped = this.target);});


    Event._sellist = [_domSelToFunc];

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

    // next: bubble-polyfill for IE8:
    OLD_EVENTSYSTEM && _bubbleIE8();

    // store module:
    window.Parcela.modules.EventDom = Event;
    return Event;
};
