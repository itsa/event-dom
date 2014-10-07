"use strict";

/**
 * Adds the `hover` event as a DOM-event to event-dom. more about DOM-events:
 * http://www.smashingmagazine.com/2013/11/12/an-introduction-to-dom-events/
 *
 * More about drag and drop: https://dev.opera.com/articles/drag-and-drop/
 *
 *
 * <i>Copyright (c) 2014 ITSA - https://github.com/itsa</i>
 * New BSD License - http://choosealicense.com/licenses/bsd-3-clause/
 *
 * @example
 * Event = require('event-dom/dragdrop.js')(window);
 *
 * or
 *
 * @example
 * Event = require('event-dom')(window);
 * require('event-dom/event-dragdrop.js')(window);
 *
 * @module event
 * @submodule event-dragdrop
 * @class Event
 * @since 0.0.2
*/


var NAME = '[event-dragdrop]: ',
    ZINDEX_DURING_DRAG = 999,
    Z_INDEX = 'z-index',
    DRAG_OPACITY = '0.6',
    PREV_Z = '_prevZ',
    DRAGGABLE = 'draggable',
    PROXY = 'proxy',
    MOUSE = 'mouse',
    DATA_KEY = 'dragDrop',
    DD_TRANSITION_CLASS = 'dd-transition',
    LATER = require('utils').later;

require('polyfill/polyfill-base.js');
require('js-ext');
require('window-ext');
require('../css/dragdrop.css');

module.exports = function (window) {
    var Event = require('../event-dom.js')(window),
        UA = window.navigator.userAgent,
        iOS = !!UA.match('iPhone OS') || !!UA.match('iPad'),
        featureDetect_DD, supportsDD, setupDD, teardownDD, handleMove, handleDrop, handleDragStart;

    featureDetect_DD = function() {
        var div = window.document.createElement('div');
        return (DRAGGABLE in div) || ('ondragstart' in div && 'ondrop' in div);
    };

    supportsDD = featureDetect_DD();

    // if supportsDD && !iOS, then we can use native HTML5 drag and drop
    // no polyfill needed

    // iOS claims that draggable is in the element but doesn't allow drag and drop:
    // https://developer.apple.com/library/safari/documentation/AppleApplications/Reference/SafariWebContent/HandlingEvents/HandlingEvents.html

    if (iOS || !supportsDD) {
        // we need a custom drag and drop solution
    }

    /*
     * Creates the `hover` event. The eventobject has the property `e.hover` which is a `Promise`.
     * You can use this Promise to get notification of the end of hover. The Promise e.hover gets resolved with
     * `relatedTarget` as argument: the node where the mouse went into when leaving a.target.
     *
     * @method setupHover
     * @private
     * @since 0.0.2
     */
    setupDD = function() {
        // create only after subscribing to the `hover`-event
        Event.after([MOUSE+'down', 'panstart'], function(e) {
            console.log(NAME, 'setupHover: setting up mouseover event');
            var node = e.target,
                moveEv, evtType, x, y;

            // because we listen to 2 eventypes, but we don't want to setup twice, we need to store
            // data on the node that tells whether dragging already started

            if (node.getData(DATA_KEY)) {
                return;
            }

            // we set data to the node: key='dragDrop' value=xy-position, which we may need
            // to return a proxy on drop-fail
            x = node.getX();
            y = node.getY();
            node.setXY(x, y);
            // now we can read their current inline values
            node.setData(DATA_KEY, {
                x: x,
                y: y,
                xStart: node.getInlineStyle('left'),
                yStart: node.getInlineStyle('top'),
                mousex: e.clientX+window.getScrollLeft(),
                mousey: e.clientY+window.getScrollTop()
            });
console.warn('STORE '+x+' | '+y);

            evtType = (e.type===MOUSE+'down') ? MOUSE : 'pan';

            e.drag = Promise.manage();

            e.setOnDrag = function(callbackFn) {
                e.drag.setCallback(callbackFn);
            };

            moveEv = Event.after(evtType+'move', function(ev) {
                // move the object
                handleMove(e, ev);
                e.drag.callback(e);
            });

            Event.onceAfter((evtType===MOUSE) ? MOUSE+'up' : 'panend', function(ev) {
                moveEv.detach();
                // handle drop
                handleDrop(e, ev);
                node.removeData(DATA_KEY);
                e.drag.fulfill(e);
            });

            handleDragStart(e, node, x, y);

            Event.emit(node, 'UI:dragdrop', e);
        }, '[draggable="true"], [draggable="proxy"]');
    };

    handleDragStart = function(e, node, x, y) {
console.info('handleDragStart '+node.id);
        var proxy = (node.getAttr(DRAGGABLE)===PROXY),
            movableNode = e.movableNode = proxy ? node.clone(true) : node;

        movableNode.setXY(x, y);
        movableNode.setData(PREV_Z, movableNode.getInlineStyle(Z_INDEX));
        movableNode.setInlineStyle(Z_INDEX, ZINDEX_DURING_DRAG);

        if (proxy) {
            movableNode.setInlineStyle('opacity', DRAG_OPACITY);
            node.parentNode.insertAfter(movableNode, node);
        }
    };

    handleMove = function(e, ev) {
console.info('DragMove '+e.movableNode.id);
        var node = e.movableNode,
            data = node.getData(DATA_KEY);
        node.setXY(data.x+ev.clientX+window.getScrollLeft()-data.mousex, data.y+ev.clientY+window.getScrollTop()-data.mousey);
    };

    handleDrop = function(e, ev) {
console.info('DragDrop '+e.movableNode.id);
        var node = e.movableNode,
            prevZ = node.getData(PREV_Z),
            proxy = (node.getAttr(DRAGGABLE)===PROXY),
            data = node.getData(DATA_KEY),
            removeClass;
        removeClass = function() {
            node.removeClass(DD_TRANSITION_CLASS);
            node.removeEventListener && node.removeEventListener('transitionend', removeClass, true);
        };
        prevZ ? node.setInlineStyle(Z_INDEX, prevZ) : node.removeInlineStyle(Z_INDEX);

        if (proxy) {
            node.remove();
        }
        else {
console.warn('SETTING TO '+data.x+' | '+data.y);
            node.addClass(DD_TRANSITION_CLASS);
            // transitions only work with IE10+, and that browser has addEventListener
            // when it doesn't have, it doesn;t harm to leave the transitionclass on: it would work anyway
            // nevertheless we will remove it with a timeout
            if (node.addEventListener) {
                node.addEventListener('transitionend', removeClass, true);
            }
            else {
                LATER(removeClass, 1000);
            }
            node.setXY(data.xStart, data.yStart, true);
        }
    };

    setupDD();

    // also extend window.Element:
    window.Element && (function(ElementPrototype) {
       /**
        * Makes the HtmlElement draggable
        *
        * @method setDraggable
        * @param [proxy] {Boolean} whether the HtmlElement is a proxy-node during drag
        * @chainable
        * @since 0.0.1
        */
        ElementPrototype.setDraggable = function(proxy) {
            this.setAttr(DRAGGABLE, proxy ? PROXY : "true");
            return this;
        };
       /**
        * Removes draggability of the HtmlElement
        *
        * @method removeDraggable
        * @chainable
        * @since 0.0.1
        */
        ElementPrototype.removeDraggable = function() {
            this.removeAttr(DRAGGABLE);
            return this;
        };
    }(window.Element.prototype));

    return Event;
};