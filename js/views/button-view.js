/* Button View
 *
 * Handles the display of buttons under the content description
 *
 */
(function(exports) {
  "use strict";

  // constants
  var CLASS_BUTTON_STATIC   = "detail-item-button-static",
      CLASS_BUTTON_SELECTED = "detail-item-button-selected",
      CLASS_BUTTON_FAVORITE = "btnFavorite";

  /**
   * @class ButtonView
   * @description The Button view object, this handles everything about the buttons
   */
  var ButtonView = function() {

    // mixin inheritance, initialize this as an event handler for these events:
    Events.call(this, ['exit', 'revoke', 'select', 'makeIAP', 'showDesc', 'play', 'browse', 'link', 'videoFavorite', 'watchAVOD']);

    //global variables
    this.selectedButton = -1;

    //jquery global variables
    this.$el = null;
    this.$buttons = null;

    /**
     * Hides the button view
     */
    this.hide = function() {
      this.$el.hide();
    };

    /**
     * Display the button view
     */
    this.show = function() {
      this.$el.show();
    };

    /**
     * Remove the button view
     */
    this.remove = function() {
      if (this.$el) {
        this.$el.remove();
      }
    };

    /**
     * Gets the currently visible buttons
     */
    this.visibleButtons = function() {
      return this.$buttons.filter(":visible");
    };

    /**
     * Change the style of the selected element to selected
     */
    this.setSelectedButton = function() {
      //first make sure we don't already have a selected button
      this.setStaticButton();

      var buttons = this.visibleButtons();

      //apply the selected class to the newly-selected button
      var buttonElement = $(buttons[this.selectedButton]);

      buttonElement.removeClass(CLASS_BUTTON_STATIC);
      buttonElement.addClass(CLASS_BUTTON_SELECTED);
    };

    /**
     * Change the style of the unselected button to static
     */
    this.setStaticButton = function() {
      var buttonElement = $("." + CLASS_BUTTON_SELECTED);

      if (buttonElement) {
        buttonElement.removeClass(CLASS_BUTTON_SELECTED);
        buttonElement.addClass(CLASS_BUTTON_STATIC);
      }
    };

    /**
     * Select the Favorite Button
     */
    this.selectFavoriteButton = function() {
      var buttonElement = $('.' + CLASS_BUTTON_FAVORITE);
      if (buttonElement) {
        buttonElement.removeClass(CLASS_BUTTON_STATIC);
        buttonElement.addClass(CLASS_BUTTON_SELECTED);
      }
    };

    /**
     * Event handler for remote "select" button press
     */
    this.handleButtonEvent = function() {
      var visibleBtns = this.visibleButtons();

      if (this.$buttons[this.selectedButton].classList.contains('btnLink')) {
        this.trigger('link');
      }

      if (this.$buttons[this.selectedButton].classList.contains('btnBrowse')) {
        this.trigger('browse');
      }

      if (this.$buttons[this.selectedButton].classList.contains('btnAVOD')) {
        this.trigger('watchAVOD');
      }

      if (this.$buttons[this.selectedButton].classList.contains('btnIAP')) {
        this.trigger('makeIAP', visibleBtns[this.selectedButton].id);
      }

      if (this.$buttons[this.selectedButton].classList.contains('btnDesc')) {
        this.trigger('showDesc', visibleBtns[this.selectedButton].id);
      }

      if (this.$buttons[this.selectedButton].classList.contains('btnPlay')) {
        this.trigger('play', visibleBtns[this.selectedButton].id);
      }

      if (this.$buttons[this.selectedButton].classList.contains('btnFavorite')) {
        this.trigger('videoFavorite');
      }
    }.bind(this);

    /**
     * Event hander for tap
     * @param {Event} e
     */
    this.handleButtonTap = function(e) {
      this.showAlert(e.target.innerHTML);
    }.bind(this);

    /**
     * Display alert for button press/select
     * @param {String} buttonValue the innerHTML of the button
     */
    this.showAlert = function(buttonValue) {
      alert("You selected the '" + buttonValue + "' button");

      //resync the buttons after the alert
      buttons.resync();
    };

    /**
     * Creates the button view from the template and appends it to the given element
     *
     * @param {Object}  $el        the button container
     * @param {Array}   allButtons the button objects to render the buttons
     * @param {Boolean} favorite   true to select the favorite button
     */
    this.render = function($el, allButtons, favorite) {
      // remove the previous buttons
      this.remove();

      // Build the left nav template and add its
      var html = utils.buildTemplate($("#button-view-template"), {
        "allButtons": allButtons
      });

      $el.append(html);
      this.$el = $el.children().last();
      this.$buttons = $el.find(".detail-item-button-static");

      touches.registerTouchHandler("detail-item-button-static", this.handleButtonTap);

      // Select the Favorite button
      if (favorite) {
        this.selectFavoriteButton();
      }
    };

    /**
     * Key event handler
     * handles controls: LEFT : select button to the left
     *                   RIGHT: select button to the right
     *                   UP:change focus back to 1D view
     *                   DOWN:Nothing
     *                   BACK: Change focus back to 1D view
     * @param {event} the keydown event
     */
    this.handleControls = function(e) {
      if (e.type === 'buttonpress') {

        var visibleBtns = this.visibleButtons();

        switch (e.keyCode) {
          case buttons.UP:
            this.setStaticButton();
            break;
          case buttons.DOWN:
            break;
          case buttons.LEFT:
            if (visibleBtns[this.selectedButton - 1]) {
              this.setCurrentSelectedIndex(this.selectedButton - 1);
              this.setSelectedButton();
            } else {
              // otherwise set button to the last element
              this.setCurrentSelectedIndex(visibleBtns.length - 1);
              this.setSelectedButton();
            }
            break;
          case buttons.BACK:
            this.setStaticButton();
            this.trigger('exit');
            break;
          case buttons.SELECT:
            //do button action
            this.handleButtonEvent();
            break;
          case buttons.RIGHT:
            //check if we are on the right button
            if (visibleBtns[this.selectedButton + 1]) {
              this.setCurrentSelectedIndex(this.selectedButton + 1);
              this.setSelectedButton();
            } else {
              // otherwise set button to the first element
              this.setCurrentSelectedIndex(0);
              this.setSelectedButton();
            }
            break;
        }
      }
    }.bind(this);

    /**
     * Set the index of the currently selected item
     * @param {number} index the index of the selected button
     */
    this.setCurrentSelectedIndex = function(index) {
      this.selectedButton = index;
    };

  };

  exports.ButtonView = ButtonView;

}(window));
