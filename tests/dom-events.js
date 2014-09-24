/*global describe, it */

(function (window) {

    "use strict";

    var expect = require('chai').expect,
        should = require('chai').should(),
        Event = require('../event-dom.js')(window),
        document = window.document,
        EMIT_CLICK_EVENT, EMIT_FOCUS_EVENT, EMIT_KEY_EVENT, buttonnode, divnode, divnode2;

    require('event/event-emitter.js');
    require('event/event-listener.js');

    EMIT_CLICK_EVENT = function(target) {
        // dom.level2.events.MouseEvent('click');
        var customEvent,
            type = 'click',
            bubbles = true, //all mouse events bubble
            cancelable = false,
            view = window,
            detail = 1,  //number of mouse clicks must be at least one
            screenX = 0,
            screenY = 0,
            clientX = 0,
            clientY = 0,
            ctrlKey = false,
            altKey = false,
            shiftKey = false,
            metaKey = false,
            button = 0,
            relatedTarget = null;

        if (document.createEvent) {
            customEvent = document.createEvent('MouseEvents');
            customEvent.initMouseEvent(type, bubbles, cancelable, view, detail,
                                     screenX, screenY, clientX, clientY,
                                     ctrlKey, altKey, shiftKey, metaKey,
                                     button, relatedTarget);
            //fire the event
            target.dispatchEvent(customEvent);

        }
        else if (document.createEventObject) { //IE
            //create an IE event object
            customEvent = document.createEventObject();
            //assign available properties
            customEvent.bubbles = bubbles;
            customEvent.cancelable = cancelable;
            customEvent.view = view;
            customEvent.detail = detail;
            customEvent.screenX = screenX;
            customEvent.screenY = screenY;
            customEvent.clientX = clientX;
            customEvent.clientY = clientY;
            customEvent.ctrlKey = ctrlKey;
            customEvent.altKey = altKey;
            customEvent.metaKey = metaKey;
            customEvent.shiftKey = shiftKey;
            //fix button property for IE's wacky implementation
            switch(button){
                case 0:
                    customEvent.button = 1;
                    break;
                case 1:
                    customEvent.button = 4;
                    break;
                case 2:
                    //leave as is
                    break;
                default:
                    customEvent.button = 0;
            }
            customEvent.relatedTarget = relatedTarget;
            //fire the event
            target.fireEvent('onclick', customEvent);
        }
    };

    describe('Polyfill contains', function () {
        // Code to execute before the tests inside this describegroup.
        before(function() {
            divnode = document.createElement('div');
            divnode.style = 'position: absolute; left: -1000px; top: -1000px;';
            divnode2 = document.createElement('div');
            buttonnode = document.createElement('button');
            divnode2.appendChild(buttonnode);
            divnode.appendChild(divnode2);
            document.body.appendChild(divnode);
        });

        // Code to execute after the tests inside this describegroup.
        after(function() {
            document.body.removeChild(divnode);
        });

        it('contains', function () {
            divnode.contains(divnode2).should.be.true;
            divnode.contains(buttonnode).should.be.true;
            divnode2.contains(divnode).should.be.false;
            divnode2.contains(buttonnode).should.be.true;
            buttonnode.contains(divnode).should.be.false;
            buttonnode.contains(divnode2).should.be.false;
            buttonnode.contains(buttonnode).should.be.true;
            divnode2.contains(divnode2).should.be.true;
            divnode.contains(divnode).should.be.true;
        });

    });

    describe('DOM Events', function () {
        // Code to execute before the tests inside this describegroup.
        before(function() {
            divnode = document.createElement('div');
            divnode.id = 'divcont';
            divnode.className = 'contclass';
            divnode.style = 'position: absolute; left: -1000px; top: -1000px;';
            buttonnode = document.createElement('button');
            buttonnode.id = 'buttongo';
            buttonnode.className = 'buttongoclass';
            divnode.appendChild(buttonnode);
            document.body.appendChild(divnode);
        });

        // Code to execute after the tests inside this describegroup.
        after(function() {
            document.body.removeChild(divnode);
            Event.unNotify('UI:*');
        });

        // Code to execute after every test.
        afterEach(function() {
            Event.detachAll();
            Event.undefAllEvents();
        });

        it('listening event', function (done) {
            Event.after('click', function() {
                done();
            }, '#buttongo');
            EMIT_CLICK_EVENT(buttonnode);
        });

        it('listening event should not happen', function (done) {
            Event.after('click', function() {
                done(new Error('Event should not occur'));
            }, '#buttongo');
            EMIT_CLICK_EVENT(divnode);
            // CAUTIOUS: do not set timeout to 0 --> IE9 puts the after-dom-events
            // a bit later in the js-stack: timeOut of 0 would happen before the after-evens
            setTimeout(done, 50);
        });

        it('listening outside-event', function (done) {
            Event.after('clickoutside', function() {
                done();
            }, '#buttongo');
            EMIT_CLICK_EVENT(divnode);
        });

        it('listening outside-event not happen', function (done) {
            Event.after('clickoutside', function() {
                done(new Error('Event should not occur'));
            }, '#buttongo');
            EMIT_CLICK_EVENT(buttonnode);
            // CAUTIOUS: do not set timeout to 0 --> IE9 puts the after-dom-events
            // a bit later in the js-stack: timeOut of 0 would happen before the after-evens
            setTimeout(done, 50);
        });

        it('preventing event', function (done) {
            Event.after('click', function() {
                done(new Error('event should not happen'));
            }, '#buttongo');
            Event.before('click', function(e) {
                e.preventDefault();
            }, '#buttongo');
            EMIT_CLICK_EVENT(buttonnode);
            // CAUTIOUS: do not set timeout to 0 --> IE9 puts the after-dom-events
            // a bit later in the js-stack: timeOut of 0 would happen before the after-evens
            setTimeout(done, 50);
        });

        it('halt event', function (done) {
            Event.after('click', function() {
                done(new Error('event should not happen'));
            }, '#buttongo');
            Event.before('click', function(e) {
                e.halt();
            }, '#buttongo');
            EMIT_CLICK_EVENT(buttonnode);
            // CAUTIOUS: do not set timeout to 0 --> IE9 puts the after-dom-events
            // a bit later in the js-stack: timeOut of 0 would happen before the after-evens
            setTimeout(done, 50);
        });

        it('delegation on future nodes', function (done) {
            var count = 0,
                buttonnode2, buttonnode3;
            Event.after('click', function() {
                count++;
            }, '#buttongo2');
            Event.after('click', function() {
                count++;
            }, '.go');

            buttonnode2 = document.createElement('button');
            buttonnode2.id = 'buttongo2';
            buttonnode2.style = 'position: absolute; left: -1000px; top: -1000px;';
            buttonnode2.className = 'go';
            document.body.appendChild(buttonnode2);

            buttonnode3 = document.createElement('button');
            buttonnode3.id = 'buttongo3';
            buttonnode3.style = 'position: absolute; left: -1000px; top: -1000px;';
            buttonnode3.className = 'go';
            document.body.appendChild(buttonnode3);

            EMIT_CLICK_EVENT(buttonnode2);
            EMIT_CLICK_EVENT(buttonnode3);
            document.body.removeChild(buttonnode2);
            document.body.removeChild(buttonnode3);
            // CAUTIOUS: do not set timeout to 0 --> IE9 puts the after-dom-events
            // a bit later in the js-stack: timeOut of 0 would happen before the after-evens
            setTimeout(function() {
                expect(count).to.eql(3);
                done();
            }, 50);
        });

        it('e.target', function (done) {
            Event.after('click', function(e) {
                e.target.id.should.be.eql('buttongo');
            }, '#buttongo');
            Event.after('click', function(e) {
                e.target.id.should.be.eql('divcont');
            }, '.contclass');
            Event.after('click', function(e) {
                e.target.id.should.be.eql('buttongo');
            }, '.contclass button');
            EMIT_CLICK_EVENT(buttonnode);
            // CAUTIOUS: do not set timeout to 0 --> IE9 puts the after-dom-events
            // a bit later in the js-stack: timeOut of 0 would happen before the after-evens
            setTimeout(done, 50);
        });

        it('e.target with filterfunction', function (done) {
            Event.after('click', function(e) {
                e.target.id.should.be.eql('buttongo');
            }, function(e) {
                return e.target.id==='buttongo';
            });
            Event.after('click', function(e) {
                // manual filterfunction doesn't reset e.target
                e.target.id.should.be.eql('buttongo');
            }, function(e) {
                return e.target.id==='divcont';
            });
            // a third time again on lowest level, to check if e.target is reset:
            Event.after('click', function(e) {
                e.target.id.should.be.eql('buttongo');
            }, function(e) {
                return e.target.id==='buttongo';
            });
            EMIT_CLICK_EVENT(buttonnode);
            // CAUTIOUS: do not set timeout to 0 --> IE9 puts the after-dom-events
            // a bit later in the js-stack: timeOut of 0 would happen before the after-evens
            setTimeout(done, 50);
        });

        it('e.target with mixed selector and filterfunction', function (done) {
            Event.after('click', function(e) {
                e.target.id.should.be.eql('buttongo');
            }, '#buttongo');
            Event.after('click', function(e) {
                e.target.id.should.be.eql('divcont');
            }, '.contclass');
            // a third time again on lowest level, to check if e.target is reset:
            Event.after('click', function(e) {
                // manual filterfunction doesn't reset e.target
                e.target.id.should.be.eql('buttongo');
            }, function(e) {
                return e.target.id==='buttongo'
            });
            EMIT_CLICK_EVENT(buttonnode);
            // CAUTIOUS: do not set timeout to 0 --> IE9 puts the after-dom-events
            // a bit later in the js-stack: timeOut of 0 would happen before the after-evens
            setTimeout(done, 50);
        });

        it('e.target on multiple subscribers', function (done) {
            var count = 0,
                divnode2 = document.createElement('div'),
                divnode3 = document.createElement('div'),
                deepestbutton = document.createElement('button');
            divnode2.id = 'divnode2';
            divnode3.id = 'divnode3';
            divnode2.className = 'divnode2class';
            divnode3.appendChild(deepestbutton);
            divnode2.appendChild(divnode3);
            divnode.appendChild(divnode2);

            // create subscriber on divnode2:
            Event.after('click', function(e) {
                count++;
                e.target.id.should.be.eql('divnode2');
            }, 'div.divnode2class');
            // create subscriber on containerdiv:
            Event.after('click', function(e) {
                count++;
                e.target.id.should.be.eql('divcont');
            }, 'div.contclass');

            // create subscriber on whatever div:
            Event.after('click', function(e) {
                count++;
                e.target.id.should.be.eql('divnode3');
            }, 'div');
            EMIT_CLICK_EVENT(deepestbutton);
            setTimeout(function() {
                expect(count).to.eql(3);
                divnode.removeChild(divnode2);
                done();
            // CAUTIOUS: do not set timeout to 0 --> IE9 puts the after-dom-events
            // a bit later in the js-stack: timeOut of 0 would happen before the after-evens
            }, 50);
        });

        it('delegation on future nodes with preventDefault', function (done) {
            var count = 0,
                buttonnode2, buttonnode3;
            Event.before('click', function(e) {
                e.preventDefault();
            }, '#buttongo3');
            Event.after('click', function() {
                count++;
            }, '#buttongo2');
            Event.after('click', function() {
                count++;
            }, '.go');

            buttonnode2 = document.createElement('button');
            buttonnode2.id = 'buttongo2';
            buttonnode2.style = 'position: absolute; left: -1000px; top: -1000px;';
            buttonnode2.className = 'go';
            document.body.appendChild(buttonnode2);

            buttonnode3 = document.createElement('button');
            buttonnode3.id = 'buttongo3';
            buttonnode3.style = 'position: absolute; left: -1000px; top: -1000px;';
            buttonnode3.className = 'go';
            document.body.appendChild(buttonnode3);

            EMIT_CLICK_EVENT(buttonnode2);
            EMIT_CLICK_EVENT(buttonnode3);
            document.body.removeChild(buttonnode2);
            document.body.removeChild(buttonnode3);
            // CAUTIOUS: do not set timeout to 0 --> IE9 puts the after-dom-events
            // a bit later in the js-stack: timeOut of 0 would happen before the after-evens
            setTimeout(function() {
                expect(count).to.eql(2);
                done();
            }, 50);
        });

        it('stopPropagation', function (done) {
            var count = 0;

            Event.after('click', function() {
                done(new Error('After-subscriber #divcont should not be invoked'));
            }, '#divcont');

            Event.after('click', function() {
                expect(count).to.eql(15);
                count = count + 16;
            }, '#divcont button.buttongoclass');

            Event.after('click', function() {
                expect(count).to.eql(31);
                count = count + 32;
            }, '#buttongo');

            //====================================================

            Event.before('click', function() {
                done(new Error('Before-subscriber #divcont should not be invoked'));
            }, '#divcont');

            Event.before('click', function() {
                expect(count).to.eql(0);
                count = count + 1;
            }, '#divcont button.buttongoclass');

            Event.before('click', function(e) {
                expect(count).to.eql(1);
                count = count + 2;
                e.stopPropagation();
            }, '#divcont button.buttongoclass');

            Event.before('click', function() {
                expect(count).to.eql(3);
                count = count + 4;
            }, '#divcont button.buttongoclass');

            Event.before('click', function() {
                expect(count).to.eql(7);
                count = count + 8;
            }, '#buttongo');

            //====================================================

            EMIT_CLICK_EVENT(buttonnode);

            // CAUTIOUS: do not set timeout to 0 --> IE9 puts the after-dom-events
            // a bit later in the js-stack: timeOut of 0 would happen before the after-evens
            setTimeout(function() {
                expect(count).to.eql(63);
                done();
            }, 50);
        });

        it('stopPropagation situation 2', function (done) {
            var count = 0,
                divnode2 = document.createElement('div'),
                divnode3 = document.createElement('div'),
                deepestbutton = document.createElement('button');
            divnode2.id = 'divnode2';
            divnode3.id = 'divnode3';
            divnode2.className = 'divnode2class';
            divnode3.appendChild(deepestbutton);
            divnode2.appendChild(divnode3);
            divnode.appendChild(divnode2);


            Event.after('click', function() {
                done(new Error('Before-subscriber button.buttongoglass should not be invoked'));
            }, 'button.buttongoclass');

            Event.after('click', function(e) {
                done(new Error('Before-subscriber .contclass should not be invoked'));
            }, '.contclass');

            Event.after('click', function(e) {
                expect(count).to.eql(31);
                count = count + 32;
            }, '.divnode2class');

            Event.after('click', function() {
                expect(count).to.eql(15);
                count = count + 16;
            }, '#divnode3');

            Event.after('click', function() {
                expect(count).to.eql(7);
                count = count + 8;
            }, 'button');

            //====================================================

            Event.before('click', function() {
                done(new Error('Before-subscriber button.buttongoglass should not be invoked'));
            }, 'button.buttongoclass');

            Event.before('click', function(e) {
                done(new Error('Before-subscriber .contclass should not be invoked'));
            }, '.contclass');

            Event.before('click', function(e) {
                expect(count).to.eql(3);
                count = count + 4;
                e.stopPropagation();
            }, '.divnode2class');

            Event.before('click', function() {
                expect(count).to.eql(1);
                count = count + 2;
            }, '#divnode3');

            Event.before('click', function() {
                expect(count).to.eql(0);
                count = count + 1;
            }, 'button');

            //====================================================

            EMIT_CLICK_EVENT(deepestbutton);

            // CAUTIOUS: do not set timeout to 0 --> IE9 puts the after-dom-events
            // a bit later in the js-stack: timeOut of 0 would happen before the after-evens
            setTimeout(function() {
                expect(count).to.eql(63);
                divnode.removeChild(divnode2);
                done();
            }, 50);
        });

        it('stopPropagation situation 3', function (done) {
            var count = 0,
                divnode2 = document.createElement('div'),
                divnode3 = document.createElement('div'),
                deepestbutton = document.createElement('button');
            divnode2.id = 'divnode2';
            divnode3.id = 'divnode3';
            divnode2.className = 'divnode2class';
            divnode3.appendChild(deepestbutton);
            divnode2.appendChild(divnode3);
            divnode.appendChild(divnode2);


            Event.after('click', function() {
                done(new Error('Before-subscriber button.buttongoglass should not be invoked'));
            }, 'button.buttongoclass');

            Event.after('click', function(e) {
                done(new Error('Before-subscriber .contclass should not be invoked'));
            }, '#divcont');

            Event.after('click', function(e) {
                expect(count).to.eql(31);
                count = count + 32;
            }, '#divnode2');

            Event.after('click', function() {
                expect(count).to.eql(15);
                count = count + 16;
            }, '#divnode3');

            Event.after('click', function() {
                expect(count).to.eql(7);
                count = count + 8;
            }, 'button');

            //====================================================

            Event.before('click', function() {
                done(new Error('Before-subscriber button.buttongoglass should not be invoked'));
            }, 'button.buttongoclass');

            Event.before('click', function(e) {
                done(new Error('Before-subscriber .contclass should not be invoked'));
            }, '#divcont');

            Event.before('click', function(e) {
                expect(count).to.eql(3);
                count = count + 4;
                e.stopPropagation();
            }, '#divnode2');

            Event.before('click', function() {
                expect(count).to.eql(1);
                count = count + 2;
            }, '#divnode3');

            Event.before('click', function() {
                expect(count).to.eql(0);
                count = count + 1;
            }, 'button');

            //====================================================

            EMIT_CLICK_EVENT(deepestbutton);

            // CAUTIOUS: do not set timeout to 0 --> IE9 puts the after-dom-events
            // a bit later in the js-stack: timeOut of 0 would happen before the after-evens
            setTimeout(function() {
                expect(count).to.eql(63);
                divnode.removeChild(divnode2);
                done();
            }, 50);
        });

        it('stopImmediatePropagation', function (done) {
            var count = 0;

            Event.after('click', function() {
                done(new Error('After-subscriber #divcont should not be invoked'));
            }, '#divcont');

            Event.after('click', function() {
                done(new Error('Before-subscriber #divcont button.buttongoclass should not be invoked'));
            }, '#divcont button.buttongoclass');

            Event.after('click', function() {
                done(new Error('Before-subscriber #buttongo should not be invoked'));
            }, '#buttongo');

            //====================================================

            Event.before('click', function() {
                done(new Error('Before-subscriber #divcont should not be invoked'));
            }, '#divcont');

            Event.before('click', function() {
                expect(count).to.eql(0);
                count = count + 1;
            }, '#divcont button.buttongoclass');

            Event.before('click', function(e) {
                expect(count).to.eql(1);
                count = count + 2;
                e.stopImmediatePropagation();
            }, '#divcont button.buttongoclass');

            Event.before('click', function() {
                done(new Error('Before-subscriber #divcont button.buttongoclass should not be invoked'));
            }, '#divcont button.buttongoclass');

            Event.before('click', function() {
                done(new Error('Before-subscriber #buttongo should not be invoked'));
            }, '#buttongo');

            //====================================================

            EMIT_CLICK_EVENT(buttonnode);

            // CAUTIOUS: do not set timeout to 0 --> IE9 puts the after-dom-events
            // a bit later in the js-stack: timeOut of 0 would happen before the after-evens
            setTimeout(function() {
                expect(count).to.eql(3);
                done();
            }, 50);
        });

        it('stopImmediatePropagation situation 2', function (done) {
            var count = 0,
                divnode2 = document.createElement('div'),
                divnode3 = document.createElement('div'),
                deepestbutton = document.createElement('button');
            divnode2.id = 'divnode2';
            divnode3.id = 'divnode3';
            divnode2.className = 'divnode2class';
            divnode3.appendChild(deepestbutton);
            divnode2.appendChild(divnode3);
            divnode.appendChild(divnode2);


            Event.after('click', function() {
                done(new Error('Before-subscriber button.buttongoglass should not be invoked'));
            }, 'button.buttongoclass');

            Event.after('click', function(e) {
                done(new Error('Before-subscriber .contclass should not be invoked'));
            }, '.contclass');

            Event.after('click', function(e) {
                done(new Error('Before-subscriber .divnode2class should not be invoked'));
            }, '.divnode2class');

            Event.after('click', function() {
                expect(count).to.eql(15);
                count = count + 16;
            }, '#divnode3');

            Event.after('click', function() {
                expect(count).to.eql(7);
                count = count + 8;
            }, 'button');

            //====================================================

            Event.before('click', function() {
                done(new Error('Before-subscriber button.buttongoglass should not be invoked'));
            }, 'button.buttongoclass');

            Event.before('click', function(e) {
                done(new Error('Before-subscriber .contclass should not be invoked'));
            }, '.contclass');

            Event.before('click', function(e) {
                expect(count).to.eql(3);
                count = count + 4;
                e.stopImmediatePropagation();
            }, '.divnode2class');

            Event.before('click', function() {
                expect(count).to.eql(1);
                count = count + 2;
            }, '#divnode3');

            Event.before('click', function() {
                expect(count).to.eql(0);
                count = count + 1;
            }, 'button');

            //====================================================

            EMIT_CLICK_EVENT(deepestbutton);

            // CAUTIOUS: do not set timeout to 0 --> IE9 puts the after-dom-events
            // a bit later in the js-stack: timeOut of 0 would happen before the after-evens
            setTimeout(function() {
                expect(count).to.eql(31);
                divnode.removeChild(divnode2);
                done();
            }, 50);
        });

        it('stopImmediatePropagation situation 3', function (done) {
            var count = 0,
                divnode2 = document.createElement('div'),
                divnode3 = document.createElement('div'),
                deepestbutton = document.createElement('button');
            divnode2.id = 'divnode2';
            divnode3.id = 'divnode3';
            divnode2.className = 'divnode2class';
            divnode3.appendChild(deepestbutton);
            divnode2.appendChild(divnode3);
            divnode.appendChild(divnode2);


            Event.after('click', function() {
                done(new Error('Before-subscriber button.buttongoglass should not be invoked'));
            }, 'button.buttongoclass');

            Event.after('click', function(e) {
                done(new Error('Before-subscriber .contclass should not be invoked'));
            }, '#divcont');

            Event.after('click', function(e) {
                done(new Error('Before-subscriber .divnode2class should not be invoked'));
            }, '#divnode2');

            Event.after('click', function() {
                expect(count).to.eql(15);
                count = count + 16;
            }, '#divnode3');

            Event.after('click', function() {
                expect(count).to.eql(7);
                count = count + 8;
            }, 'button');

            //====================================================

            Event.before('click', function() {
                done(new Error('Before-subscriber button.buttongoglass should not be invoked'));
            }, 'button.buttongoclass');

            Event.before('click', function(e) {
                done(new Error('Before-subscriber .contclass should not be invoked'));
            }, '#divcont');

            Event.before('click', function(e) {
                expect(count).to.eql(3);
                count = count + 4;
                e.stopImmediatePropagation();
            }, '#divnode2');

            Event.before('click', function() {
                expect(count).to.eql(1);
                count = count + 2;
            }, '#divnode3');

            Event.before('click', function() {
                expect(count).to.eql(0);
                count = count + 1;
            }, 'button');

            //====================================================

            EMIT_CLICK_EVENT(deepestbutton);

            // CAUTIOUS: do not set timeout to 0 --> IE9 puts the after-dom-events
            // a bit later in the js-stack: timeOut of 0 would happen before the after-evens
            setTimeout(function() {
                expect(count).to.eql(31);
                divnode.removeChild(divnode2);
                done();
            }, 50);
        });

        it('e.target', function (done) {
            var divnode2 = document.createElement('div'),
                divnode3 = document.createElement('div'),
                deepestbutton = document.createElement('button');
            divnode2.id = 'divnode2';
            divnode3.id = 'divnode3';
            divnode2.className = 'divnode2class';
            divnode3.appendChild(deepestbutton);
            divnode2.appendChild(divnode3);
            divnode.appendChild(divnode2);

            Event.after('click', function(e) {
                (e.target===divnode2).should.be.true;
            }, '#divcont .divnode2class');

            EMIT_CLICK_EVENT(deepestbutton);

            // CAUTIOUS: do not set timeout to 0 --> IE9 puts the after-dom-events
            // a bit later in the js-stack: timeOut of 0 would happen before the after-evens
            setTimeout(function() {
                divnode.removeChild(divnode2);
                done();
            }, 50);
        });

        it('e.currentTarget', function (done) {
            var divnode2 = document.createElement('div'),
                divnode3 = document.createElement('div'),
                deepestbutton = document.createElement('button');
            divnode2.id = 'divnode2';
            divnode3.id = 'divnode3';
            divnode2.className = 'divnode2class';
            divnode3.appendChild(deepestbutton);
            divnode2.appendChild(divnode3);
            divnode.appendChild(divnode2);

            Event.after('click', function(e) {
                (e.currentTarget===divnode).should.be.true;
            }, '#divcont .divnode2class');

            Event.after('click', function(e) {
                (e.currentTarget===divnode2).should.be.true;
            }, '#divnode2 button');

            EMIT_CLICK_EVENT(deepestbutton);

            // CAUTIOUS: do not set timeout to 0 --> IE9 puts the after-dom-events
            // a bit later in the js-stack: timeOut of 0 would happen before the after-evens
            setTimeout(function() {
                divnode.removeChild(divnode2);
                done();
            }, 50);
        });

        it('e.sourceTarget', function (done) {
            var divnode2 = document.createElement('div'),
                divnode3 = document.createElement('div'),
                deepestbutton = document.createElement('button');
            divnode2.id = 'divnode2';
            divnode3.id = 'divnode3';
            divnode2.className = 'divnode2class';
            divnode3.appendChild(deepestbutton);
            divnode2.appendChild(divnode3);
            divnode.appendChild(divnode2);

            Event.after('click', function(e) {
                (e.sourceTarget===deepestbutton).should.be.true;
            }, '#divcont .divnode2class');

            Event.after('click', function(e) {
                (e.sourceTarget===deepestbutton).should.be.true;
            }, '#divnode2 button');

            EMIT_CLICK_EVENT(deepestbutton);

            // CAUTIOUS: do not set timeout to 0 --> IE9 puts the after-dom-events
            // a bit later in the js-stack: timeOut of 0 would happen before the after-evens
            setTimeout(function() {
                divnode.removeChild(divnode2);
                done();
            }, 50);
        });

        it('e.target on document', function (done) {
            var divnode2 = document.createElement('div'),
                divnode3 = document.createElement('div'),
                deepestbutton = document.createElement('button');
            divnode2.id = 'divnode2';
            divnode3.id = 'divnode3';
            divnode2.className = 'divnode2class';
            divnode3.appendChild(deepestbutton);
            divnode2.appendChild(divnode3);
            divnode.appendChild(divnode2);

            Event.after('click', function(e) {
                (e.target===divnode2).should.be.true;
            }, '.divnode2class');

            Event.after('click', function(e) {
                (e.target===deepestbutton).should.be.true;
            }, '.divnode2class button');

            EMIT_CLICK_EVENT(deepestbutton);

            // CAUTIOUS: do not set timeout to 0 --> IE9 puts the after-dom-events
            // a bit later in the js-stack: timeOut of 0 would happen before the after-evens
            setTimeout(function() {
                divnode.removeChild(divnode2);
                done();
            }, 50);
        });

        it('e.currentTarget on document', function (done) {
            var divnode2 = document.createElement('div'),
                divnode3 = document.createElement('div'),
                deepestbutton = document.createElement('button');
            divnode2.id = 'divnode2';
            divnode3.id = 'divnode3';
            divnode2.className = 'divnode2class';
            divnode3.appendChild(deepestbutton);
            divnode2.appendChild(divnode3);
            divnode.appendChild(divnode2);

            Event.after('click', function(e) {
                (e.currentTarget===document).should.be.true;
            }, '.divnode2class');

            Event.after('click', function(e) {
                (e.currentTarget===document).should.be.true;
            }, '.divnode2class button');

            EMIT_CLICK_EVENT(deepestbutton);

            // CAUTIOUS: do not set timeout to 0 --> IE9 puts the after-dom-events
            // a bit later in the js-stack: timeOut of 0 would happen before the after-evens
            setTimeout(function() {
                divnode.removeChild(divnode2);
                done();
            }, 50);
        });

        it('e.sourceTarget on document', function (done) {
            var divnode2 = document.createElement('div'),
                divnode3 = document.createElement('div'),
                deepestbutton = document.createElement('button');
            divnode2.id = 'divnode2';
            divnode3.id = 'divnode3';
            divnode2.className = 'divnode2class';
            // divnode3.appendChild(deepestbutton);
            divnode2.appendChild(divnode3);
            divnode.appendChild(divnode2);

            Event.after('click', function(e) {
                (e.sourceTarget===deepestbutton).should.be.true;
            }, '.divnode2class');

            Event.after('click', function(e) {
                (e.sourceTarget===deepestbutton).should.be.true;
            }, '.divnode2class button');

            EMIT_CLICK_EVENT(deepestbutton);

            // CAUTIOUS: do not set timeout to 0 --> IE9 puts the after-dom-events
            // a bit later in the js-stack: timeOut of 0 would happen before the after-evens
            setTimeout(function() {
                divnode.removeChild(divnode2);
                done();
            }, 50);
        });

    });
    //========================================================================================================
    describe('Non-DOM UI:-events', function () {
        it('invoking before-subscriber', function (done) {
            Event.onceBefore('save1', function() {
                done();
            });
            Event.emit('UI:save1');
        });
        it('invoking after-subscriber', function (done) {
            Event.onceAfter('save2', function() {
                done();
            });
            Event.emit('UI:save2');
        });
        it('check order before- vs after-subscriber', function (done) {
            var count = 0;
            Event.onceAfter('save3', function() {
                count++;
                expect(count).to.eql(2);
                done();
            });
            Event.onceBefore('save3', function() {
                count++;
                expect(count).to.eql(1);
            });
            Event.emit('UI:save3');
        });
        it('check order multiple before- vs multiple after-subscriber with prepend subscriber', function (done) {
            var count = 0;
            Event.onceAfter('save4', function() {
                count++;
                expect(count).to.eql(5);
            });
            Event.onceAfter('save4', function() {
                count++;
                expect(count).to.eql(4);
            }, true);
            Event.onceAfter('save4', function() {
                count++;
                expect(count).to.eql(6);
                done();
            });
            Event.onceBefore('save4', function() {
                count++;
                expect(count).to.eql(2);
            });
            Event.onceBefore('save4', function() {
                count++;
                expect(count).to.eql(1);
            }, true);
            Event.onceBefore('save4', function() {
                count++;
                expect(count).to.eql(3);
            });
            Event.emit('UI:save4');
        });
        it('check preventDefault', function (done) {
            setTimeout(done, 200);
            Event.onceAfter('save5', function() {
                throw Error('After-event occured while the event was preventDefaulted');
            });
            Event.onceBefore('save5', function(e) {
                e.preventDefault();
            });
            Event.emit('UI:save5');
        });
        it('check preventRender', function (done) {
            setTimeout(done, 200);
            Event.onceAfter('save5b', function(e) {
                e.status.renderPrevented.should.be.true;
            });
            Event.onceBefore('save5b', function(e) {
                e.preventRender();
            });
            Event.emit('UI:save5b');
        });
        it('check e.halt()', function (done) {
            setTimeout(done, 200);
            Event.onceAfter('save6', function() {
                throw Error('After-event occured while the event was halted');
            });
            Event.onceBefore('save6', function(e) {
                e.halt();
            });
            Event.emit('UI:save6');
        });
        it('check passing through payload inside before-subscriber', function (done) {
            Event.onceBefore('save7', function(e) {
                expect(e.a).to.eql(10);
                done();
            });
            Event.emit('UI:save7', {a: 10});
        });
        it('check passing through payload inside before-subscriber', function (done) {
            Event.onceAfter('save8', function(e) {
                expect(e.a).to.eql(10);
                done();
            });
            Event.emit('UI:save8', {a: 10});
        });
        it('check passing through payload inside before-subscriber', function (done) {
            var count = 0;
            Event.onceAfter('save9', function(e) {
                expect(e.a).to.eql(15);
                done();
            });
            Event.onceBefore('save9', function(e) {
                expect(e.a).to.eql(10);
                e.a = 15;
            });
            Event.emit('UI:save9', {a: 10});
        });
        it('check halt() inside before-subscriber', function (done) {
            Event.onceBefore('save10', function(e) {
                e.halt();
            });
            Event.onceBefore('save10', function() {
                done(new Error('Event was halted, yet came through a next before-subscriber'));
            });
            Event.onceBefore('save10', function() {
                done(new Error('Event was halted, yet came through a next before-subscriber'));
            });
            Event.emit('UI:save10');
            setTimeout(done, 100);
        });
        it('check preventDefault() inside before-subscriber', function (done) {
            var count = 0;
            Event.onceBefore('save11', function(e) {
                count++;
                e.preventDefault();
            });
            Event.onceBefore('save11', function() {
                count++;
            });
            Event.onceAfter('save11', function() {
                done(new Error('Event was halted, yet came through a next before-subscriber'));
            });
            Event.emit('UI:save11');
            setTimeout(function() {
                expect(count).to.eql(2);
                done();
            }, 100);
        });
        it('check returnValue', function (done) {
            Event.onceAfter('save12', function(e) {
                (e.returnValue === undefined).should.be.true;
                done();
            });
            Event.emit('UI:save12');
        });
        it("check returnvalue emit", function () {
            expect(Event.emit('UI:save13')).be.an('object');
        });
        it("check returnvalue emit when halted", function () {
            Event.onceBefore('save13b', function(e) {
                e.halt();
            });
            Event.emit('UI:save13b').status.halted.should.be.true;
        });
        it("check returnvalue emit when defaultPrevented", function () {
            Event.onceBefore('save13c', function(e) {
                e.preventDefault();
            });
            Event.emit('UI:save13c').status.defaultPrevented.should.be.true;
        });
        it('context inside once subscriber', function (done) {
            Event.onceBefore('save', function() {
                (this === Event).should.be.true;
                done();
            });
            Event.emit('UI:save');
        });
        it('context inside subscriber', function (done) {
            var handle = Event.before('save', function() {
                (this === Event).should.be.true;
                done();
            });
            Event.emit('UI:save');
        });
        it('context inside subscriber when overruled', function (done) {
            var b = {},
                fn = function() {
                    (this === b).should.be.true;
                    done();
                };
            Event.before('save15b', fn.bind(b));
            Event.emit('UI:save15b');
        });
        it('e.target inside subscriber', function (done) {
            Event.onceBefore('save16', function(e) {
                (e.target === Event).should.be.true;
                done();
            });
            Event.emit('UI:save16');
        });

    });

}(global.window || require('node-win')));