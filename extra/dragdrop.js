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
    CTRL_PRESSED = false,
    Z_INDEX = 'z-index',
    PREV_Z = '_prevZ',
    DRAGGABLE = 'draggable',
    DD_DRAGGING_CLASS = 'dd-dragging',
    CONSTRAIN_ATTR = 'xy-constrain',
    PROXY = 'proxy',
    MOUSE = 'mouse',
    DATA_KEY = 'dragDrop',
    DATA_KEY_DROPZONE = 'dropZone',
    DD_EFFECT_ALLOWED = 'dd-effect-allowed',
    DD_DROPZONE = 'dd-dropzone',
    NO_TRANS_CLASS = 'el-notrans', // delivered by `dom-ext`
    INVISIBLE_CLASS = 'el-invisible', // delivered by `dom-ext`
    DD_TRANSITION_CLASS = 'dd-transition',
    DD_OPACITY_CLASS = 'dd-opacity',
    HIGH_Z_CLASS = 'dd-high-z',
    DD_DROPACTIVE_CLASS = 'dropactive',
    REGEXP_MOVE = /\bmove\b/i,
    REGEXP_COPY = /\bcopy\b/i,
    LATER = require('utils').later;

require('polyfill/polyfill-base.js');
require('js-ext');
require('../css/dragdrop.css');
require('./hover.js');

module.exports = function (window) {
    var Event = require('../event-dom.js')(window),
        UA = window.navigator.userAgent,
        iOS = !!UA.match('iPhone OS') || !!UA.match('iPad'),
        dragOverPromiseList = [],
        featureDetect_DD, supportsDD, setupDD, teardownDD, handleMove, handleDrop, teardownDragOverEvent, allowSwitch, _getAllowedEffects,
        handleDragStart, currentNode, allowCopy, movableNode, setupDragOverEvent, dragOverEvent, lastMouseOverNode, onlyCopy, dropEffect,
        lastMouseX, lastMouseY, setBack;

    require('window-ext')(window);
    require('dom-ext')(window);

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

    _getAllowedEffects = function(node) {
        var allowedEffects = node.getAttr(DD_EFFECT_ALLOWED);
        allowedEffects && (allowedEffects=allowedEffects.toLowerCase());
        return allowedEffects || 'move';
    };

    allowCopy = function(node) {
        var allowedEffects = _getAllowedEffects(node);
        return (allowedEffects==='all') || (allowedEffects==='copy');
    };

    onlyCopy = function(node) {
        var allowedEffects = _getAllowedEffects(node);
        return (allowedEffects==='copy');
    };

    allowSwitch = function(node) {
        var allowedEffects = _getAllowedEffects(node);
        return (allowedEffects==='all');
    };

    setupDragOverEvent = function() {
        var dropzones = window.document.getAll('[dropzone]');
        if (dropzones.length>0) {
            dragOverEvent = Event.after(['mousemove', 'dd-fake-mousemove'], function(e) {
                if (currentNode) {
                    lastMouseOverNode = e.target;
                    dropzones.forEach(
                        function(dropzone) {
                            if (dropzone.hasData(DATA_KEY_DROPZONE)) {
                                return;
                            }
                            var dropzoneAccept = dropzone.getAttr('dropzone') || '',
                                dropzoneMove = REGEXP_MOVE.test(dropzoneAccept),
                                dropzoneCopy = REGEXP_COPY.test(dropzoneAccept),
                                dragOverPromise, dragOutEvent, eventobject, allowed;

                            if (e.clientX) {
                                lastMouseX = e.clientX+window.getScrollLeft();
                                lastMouseY = e.clientY+window.getScrollTop();
                            }

                            // check if the mouse is inside the dropzone
                            // also check if the mouse is inside the dragged node: the dragged node might have been constrained
                            // and check if the dragged node is allowed to go into the dropzone
                            allowed = (!dropzoneMove && !dropzoneCopy) || (dropzoneCopy && (dropEffect==='copy')) || (dropzoneMove && (dropEffect==='move'));
                            if (dropEffect && allowed && dropzone.insidePos(lastMouseX, lastMouseY) && movableNode.insidePos(lastMouseX, lastMouseY)) {
                                dropzone.setData(DATA_KEY_DROPZONE, true);
                                // mouse is in area of dropzone
                                dragOverPromise = Promise.manage();
                                eventobject = {
                                    target: dropzone,
                                    dragover: dragOverPromise
                                };
                                dragOutEvent = Event.after(
                                    ['mousemove', 'dd-fake-mousemove'],
                                    function(ev) {
                                        dragOverPromise.fulfill(ev.target);
                                    },
                                    function(ev) {
                                        var allowed, dropzoneAccept, dropzoneMove, dropzoneCopy;
                                        if (ev.type==='dd-fake-mousemove') {
                                            dropzoneAccept = dropzone.getAttr('dropzone') || '';
                                            dropzoneMove = REGEXP_MOVE.test(dropzoneAccept);
                                            dropzoneCopy = REGEXP_COPY.test(dropzoneAccept);
                                            allowed = (!dropzoneMove && !dropzoneCopy) || (dropzoneCopy && (dropEffect==='copy')) || (dropzoneMove && (dropEffect==='move'));
                                            return !allowed;
                                        }
                                        return !dropzone.insidePos(ev.clientX+window.getScrollLeft(), ev.clientY+window.getScrollTop());
                                    }
                                );
                                dragOverPromise.finally(
                                    function() {
                                        dragOutEvent.detach();
                                        dropzone.removeData(DATA_KEY_DROPZONE);
                                    }
                                );
                                dragOverPromiseList.push(dragOverPromise);
                                Event.emit(dropzone, 'UI:dd-dragover', eventobject);
                            }
                        }
                    );
                }
            });
        }
    };

    teardownDragOverEvent = function() {
        if (dragOverEvent) {
            dragOverEvent.detach();
            dragOverPromiseList.forEach(function(promise) {
                promise.fulfill(lastMouseOverNode);
            });
            dragOverPromiseList.length = 0;
        }
        dragOverEvent = null;
    };

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

        Event.after(['keydown', 'keyup'], function(e) {
            CTRL_PRESSED = e.ctrlKey || e.metaKey;
            if (currentNode && allowSwitch(currentNode)) {
                dropEffect = CTRL_PRESSED ? 'copy' : 'move';
                if (CTRL_PRESSED) {
                    currentNode.removeClass(INVISIBLE_CLASS);
                    movableNode.setClass(DD_OPACITY_CLASS);
                }
                else {
                    currentNode.setClass(INVISIBLE_CLASS);
                    movableNode.removeClass(DD_OPACITY_CLASS);
                }
                // now, it could be that any droptarget should change its appearance (DD_DROPACTIVE_CLASS).
                // we need to recalculate it for all targets
                // we do this by emitting a 'dd-fake-mousemove' event
                lastMouseOverNode && Event.emit(lastMouseOverNode, 'UI:dd-fake-mousemove');
            }
        });

        // prevent contextmenu on draggable elements that have the ability to copy themselves:
        window.oncontextmenu = function () {
            return currentNode ? !allowCopy(currentNode) : true;
        };

        Event.after('dd-dragover', function(e) {
            console.log(NAME, 'dragged over');
            e.target.setClass(DD_DROPACTIVE_CLASS);
            e.dragover.then(
                function() {
                    e.target.removeClass(DD_DROPACTIVE_CLASS);
                }
            );
        });

        Event.before([MOUSE+'down', 'panstart'], function(e) {
            console.log(NAME, 'setupHover: setting up mouseover event');
            var node = e.target,
                moveEv, evtType, x, y;

            // because we listen to 2 eventypes, but we don't want to setup twice, we need to store
            // data on the node that tells whether dragging already started
            if (currentNode) {
                return;
            }

            currentNode = node;

            // we set data to the node: key='dragDrop' value=xy-position, which we may need
            // to return a proxy on drop-fail
            x = node.getX();
            y = node.getY();
            // now we can read their current inline values
            node.setData(DATA_KEY, {
                x: x,
                y: y,
                xStart: node.getInlineStyle('left'),
                yStart: node.getInlineStyle('top'),
                mousex: e.clientX+window.getScrollLeft(),
                mousey: e.clientY+window.getScrollTop()
            });

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
                movableNode.hasAttr(DD_DROPZONE) && handleDrop(e, ev);
                currentNode = null;
                e.dragFinished = true;
                node.removeData(DATA_KEY);
                teardownDragOverEvent();
                e.drag.fulfill(e);
            });

            setupDragOverEvent();
            handleDragStart(e, x, y);

            Event.emit(node, 'UI:dd-drop', e);
        }, '[draggable="true"]');
    };

    handleDragStart = function(e, x, y) {
        var proxy = currentNode.hasAttr(DD_DROPZONE);

        movableNode = proxy ? currentNode.clone(true) : currentNode;


        movableNode.setClass(NO_TRANS_CLASS).setClass(HIGH_Z_CLASS);

        if (proxy) {
            dropEffect = (onlyCopy(currentNode) || (CTRL_PRESSED && allowCopy(currentNode))) ? 'copy' : 'move';
            (dropEffect==='copy') ? movableNode.setClass(DD_OPACITY_CLASS) : currentNode.setClass(INVISIBLE_CLASS);
            movableNode.setClass(INVISIBLE_CLASS);
            currentNode.parentNode.append(movableNode);
            movableNode.setXY(x, y, true);
            movableNode.removeClass(INVISIBLE_CLASS);
        }
        else {
            dropEffect = null;
            movableNode.setXY(x, y, true);
        }
    };

    handleMove = function(e, ev) {
console.info('DragMove '+movableNode.id);
        if (e.dragFinished) {
            return;
        }
        var data = movableNode.getData(DATA_KEY);
        movableNode.setClass(DD_DRAGGING_CLASS);
        movableNode.setXY(data.x+ev.clientX+window.getScrollLeft()-data.mousex, data.y+ev.clientY+window.getScrollTop()-data.mousey, true);
    };

    handleDrop = function(e, ev) {
console.info('DragDrop '+movableNode.id);
        var targetNode, originalConstrain;

        window.document.getAll('[dropzone]').some(function(dropzone) {
            if (dropzone.hasData(DATA_KEY_DROPZONE)) {
                targetNode = dropzone;
            }
            return targetNode;
        });
        if (targetNode) {
            targetNode.append(currentNode);
            originalConstrain = currentNode.getAttr(CONSTRAIN_ATTR);
            currentNode.setAttr(CONSTRAIN_ATTR, '[dropzone]');
            currentNode.setXY(movableNode.getX(), movableNode.getY());
            currentNode.setAttr(CONSTRAIN_ATTR, originalConstrain);
            currentNode.removeClass(INVISIBLE_CLASS);
            movableNode.remove();
        }
        else {
            setBack(e, ev);
        }
    };

    setBack = function(e, ev) {
console.info('setBack '+movableNode.id);
        var proxy = movableNode.hasAttr(DD_DROPZONE),
            data = movableNode.getData(DATA_KEY),
            tearDown;
        tearDown = function(notransRemoval) {
            notransRemoval || (movableNode.removeEventListener && movableNode.removeEventListener('transitionend', tearDown, true));
            if (proxy) {
                // we must take e.target instead of currentNode --> because asynchronisity, currentNode is already null
                e.target.removeClass(INVISIBLE_CLASS);
                movableNode.remove();
            }
            else {
                movableNode.removeClass(DD_TRANSITION_CLASS).removeClass(HIGH_Z_CLASS);
            }
        };

        movableNode.removeClass(NO_TRANS_CLASS);

        if (movableNode.hasClass(DD_DRAGGING_CLASS)) {
            movableNode.removeClass(DD_DRAGGING_CLASS);
            movableNode.setClass(DD_TRANSITION_CLASS);
            // transitions only work with IE10+, and that browser has addEventListener
            // when it doesn't have, it doesn;t harm to leave the transitionclass on: it would work anyway
            // nevertheless we will remove it with a timeout
            if (movableNode.addEventListener) {
                movableNode.addEventListener('transitionend', tearDown, true);
            }
            else {
                LATER(tearDown, 250);
            }
        }
        else {
            tearDown(true);
        }
        movableNode.setInlineStyle('left', data.xStart);
        movableNode.setInlineStyle('top', data.yStart);

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