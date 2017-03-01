/* Events
 *
 * A _very_ simple event manager, here only to keep this project framework agnostic, replace with something more robust.
 *
 */

(function(exports) {
  "use strict";

  /**
   * Events provides a VERY simple event manager, with just the minimum needed to support this app, if you're
   * doing anything interesting, replace this with the event system from a framework.
   *
   * @param eventSet : optional, pass an array of event types and the class will throw if an unknown event is
   * mentioned, useful for catching typos in event names
   * @constructor
   */
  var Events = function(eventSet) {

    this.eventSet = eventSet;
    this.eventHandlers = {};

    /**
     * register for an event
     * @param event : the event (string) to listen for
     * @param callback : function to call when event is triggered, args will be whatever is passed to trigger
     * @param context : optional, context for callback function
     */
    this.on = function(event, callback, context) {
      if (this.eventSet && this.eventSet.indexOf(event) === -1) {
        throw "Unknown event: " + event;
      }
      var handlers = this.eventHandlers[event] || (this.eventHandlers[event] = []);
      handlers.push({
        callback: callback,
        context: context
      });
    };

    /**
     * unregister for (an) event(s)
     * @param event : event (string) to stop listening, or undefined to match all events
     * @param callback : function to remove, or undefined to match all functions
     * @param context : context to remove, optional
     * @CHANGED by Huric
     * Note: implication is that calling off() with no args removes all handlers for all events
     */
    this.off = function(event, callback, context) {

      function filterCallback(element) {
        return (callback && callback != element.callback) || (context && context != element.context);
      }

      for (var evt in this.eventHandlers) {
        if (!event || event == evt) {
          this.eventHandlers[evt] = this.eventHandlers[evt].filter(filterCallback);
        }
      }

    };

    /**
     * triggers an event, calling all the handlers
     * @param event : the event (string) to trigger
     * @param args : any/all remaining arguments to trigger will be passed to the handlers
     */
    this.trigger = function(event, args) {
      if (this.eventSet && this.eventSet.indexOf(event) === -1) {
        throw "Unknown event: " + event;
      }
      var handlers = this.eventHandlers[event];
      if (handlers) {
        for (var i = 0; i < handlers.length; i++) {
          handlers[i].callback.apply(handlers[i].context, Array.prototype.slice.call(arguments, 1));
        }
      }
    };
  };

  exports.Events = Events;
}(window));
