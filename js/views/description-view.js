/* Description View
 *
 * Handles the display of a video item description
 * Creates a new view every time
 */

(function(exports) {
  "use strict";

  //global constants
  var ID_DESCRIPTION_TITLE = "descriptionTitle",
    ID_DESCRIPTION_DATE = "descriptionDate",
    ID_DESCRIPTION_TEXT = "descriptionText";

  /**
   * @class DescView
   * @desc The Description view object, this handles a video item description
   */
  var DescView = function() {

    // mixin inheritance, initialize this as an event handler for these events;
    Events.call(this, ['loadComplete', 'exit', 'bounce']);

    // jquery global variables
    this.$parentEle = null;
    this.$el = null;
    this.el = null;

    this.on('exit', function() {
      this.remove();
    }, this);

    this.on('bounce', function() {
      this.remove();
    }, this);

    /**
     * Removes the element from dom
     */
    this.remove = function() {
      if (this.$el) {
        this.$el.remove();
      }
    };

    /**
     * Hides the desc view
     */
    this.hide = function() {
      this.$el.hide();
    };

    /**
     * Shows the desc view
     */
    this.show = function() {
      this.$el.show();
    };

    /**
     * Creates the description view and attaches it to the application container
     * @param {Element} $el application container
     * @param {Object} data object for the description
     */
    this.render = function(el, data) {
      // remove the previous rendered view if it does exist
      this.remove();

      // Build the main content template and add it
      var html = utils.buildTemplate($("#description-template"), {
        title: data.title,
        seconds: utils.parseTime(data.seconds),
        text: data.description
      });

      el.append(html);
      this.$el = el.children().last();

      //hide the element until we are done with layout
      this.hide();
    };

    this.handleControls = function(e) {
      if (e.type === 'buttonpress') {
        switch (e.keyCode) {
          default: this.trigger('bounce');
        }
      }
    };

  };

  exports.DescView = DescView;
}(window));
