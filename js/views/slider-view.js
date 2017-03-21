/**
 *
 * Slider View
 *
 */

(function(exports) {
  "use strict";

  var SLIDER_ROW_ITEM_SELECTED = "slider-rowitem-selected";
  var SLIDER_PAGINATION = "slider-pagination-container"; // @CHANGED for the pagination

  /**
   * @class SliderView
   * @description The slider view object, this handles everything about the slider
   */
  var SliderView = function() {
    // mixins
    Events.call(this, ['loadComplete', 'exit', 'bounce', 'startScroll', 'indexChange', 'stopScroll', 'select']);

    // gloval variables
    this.currSelection = 0;
    this.elementWidths = [];
    this.isScrolling = false;
    this.currScrollDirection = null;
    this.loadingImages = 0;

    // global jquery variables
    this.$parentEle = null;
    this.$el = null;
    this.$rowElements = null;
    this.rowsData = null;

    // constants
    this.MARGIN_WIDTH = 1;
    this.STARTING_SIZE = 500;
    this.transformStyle = utils.vendorPrefix('Transform');

    /**
     * Removes the main view dom
     */
    this.remove = function() {
      this.$el.remove();
    };

    /**
     * Hides the slider view
     */
    this.hide = function() {
      this.$el.hide();
    };

    /**
     * Shows the slider view
     */
    this.show = function() {
      this.$el.show();
    };

    /**
     * Creates the slider view
     */
    this.render = function(el, row) {
      this.parentContainer = el;

      // Build the main content template and add it
      var html = utils.buildTemplate($("#slider-template"), {
        items: row
      });

      this.rowsData = row;
      el.append(html);
      this.$el = el.children().last();

      // hide the element until we are done with layout
      this.$el.css('opacity', 0);

      // select the first element
      this.$rowElements = this.$el.children();

      // gather widths of all the row elemets
      this.initialLayout();
    };

    /**
     * Performs the initial layout of the elements of the row
     */
    this.initialLayout = function() {
      // compute all widths
      this.transformLimit = this.$el.width();
      this.limitTransforms = false;

      //set a callback to make sure all images are loaded
      var imagesLoaded = function(elt, currImage) {
        currImage.on("load", function() {
          elt.children("img.slider-full-img")[0].style.visibility = "visible";
          this.relayoutOnLoadedImages();
        }.bind(this));
        // handle error case for loading screen
        currImage.on("error", function() {
          elt.children("img.slider-full-img")[0].style.visibility = "visible";
          this.relayoutOnLoadedImages();
        }.bind(this));
      }.bind(this);

      for (var i = 0; i < this.$rowElements.length; i++) {
        var $currElt = $(this.$rowElements[i]);
        var $currImage = $currElt.children("img.slider-full-img");
        if ($currImage.length === 0) {
          $currElt.prepend('<img class = "slider-full-img" src="' + this.rowsData[i].imgURL + '" style="visibility:hidden"/>');
          $currImage = $currElt.children("img.slider-full-img");
        }

        // set a callback to make sure all images are loaded
        imagesLoaded($currElt, $currImage);

        this.loadingImages++;
      }
    };

    /**
     * Performs secondary layout of the elements of the row, after images load for the first time
     */
    this.layoutElements = function() {
      for (var i = 0; i < this.$rowElements.length; i++) {
        var $currElt = $(this.$rowElements[i]);
        this.elementWidths[i] = $currElt.width();

        if ($currElt.children("img.slider-full-img").length > 0) {
          $currElt.children("img.slider-full-img")[0].style.visibility = "visible";
        }
      }

      this.setTransforms(0);

      $('#' + SLIDER_PAGINATION).empty();

      // @CHANGED let's add a pagination here
      for (i = 0; i < this.$rowElements.length; i++) {
        $("#" + SLIDER_PAGINATION).append('<div id="circle-' + i + '" class="circle"></div>');
        if (i === 0) {
          $("#circle-" + i).addClass("circle-current");
        }
      }
      $("#" + SLIDER_PAGINATION).append('<div class="circle-clear"></div>');

      window.setTimeout(function() {
        this.$rowElements.css("transition", "");
        this.limitTransforms = true;
        this.finalizeRender();
      }.bind(this), 500);
    };

    /**
     * Images are loaded and positioned so display the slider
     * and send our 'loadComplete' event to stop the spinner
     */
    this.finalizeRender = function() {
      this.$el.css('opacity', '');
      this.trigger('loadComplete');
    };

    /**
     * Callback Function to reposition the images from the placeholder positions once they load
     */
    this.relayoutOnLoadedImages = function() {
      if (--this.loadingImages === 0) {
        this.layoutElements();
      }
    };

    /**
     * Move the slider in either left or right direction
     * @param {Number} dir the direction of the move
     */
    this.shovelMove = function(dir) {
      $(this.$rowElements[this.currSelection]).removeClass(SLIDER_ROW_ITEM_SELECTED);
      this.trigger("startScroll", dir);
      this.selectRowElement(dir);
    }.bind(this);

    /**
     * Handles controls: LEFT: Move to main content if first element, otherwise select previous element
     *                   RIGHT: Select next element
     *                   UP: Return to main content view
     *                   DOWN: Nothing at the moment
     *                   BACK: Back to leftNav State
     * @param {event} the keydown event
     */
    this.handleControls = function(e) {
      if (e.type === 'buttonpress') {
        switch (e.keyCode) {
          case buttons.SELECT:
          case buttons.PLAY_PAUSE:
            this.trigger('select', this.currSelection);
            break;

          case buttons.BACK:
            this.trigger("exit");
            break;

          case buttons.UP:
          case buttons.DOWN:
            this.trigger("bounce");
            break;

          case buttons.LEFT:
            if (this.currSelection !== 0) {
              this.shovelMove(-1);
            } else {
              this.trigger('bounce', e.keyCode);
            }

            break;

          case buttons.RIGHT:
            if (this.currSelection < this.rowsData.length) {
              this.shovelMove(1);
            } else {
              this.trigger('bounce', e.keyCode);
            }
            break;
        }
      } else if (e.type === 'buttonrepeat') {
        switch (e.keyCode) {
          case buttons.LEFT:
            this.selectRowElement(-1);
            break;

          case buttons.RIGHT:
            this.selectRowElement(1);
            break;
        }
      } else if (e.type === 'buttonrelease') {
        switch (e.keyCode) {
          case buttons.LEFT:
          case buttons.RIGHT:
            this.trigger("stopScroll", this.currSelection);
            // add the shiner to the new element
            $(this.$rowElements[this.currSelection]).addClass(SLIDER_ROW_ITEM_SELECTED);

            break;
        }
      }
    }.bind(this);

    /**
     * Moves the row element to the right or left based on the direction given to it
     * @param {number} the direction to scroll, 1 is  right, -1 is left
     */
    this.selectRowElement = function(direction) {

      if ((direction > 0 && (this.$rowElements.length - 1) === this.currSelection) ||
        (direction < 0 && this.currSelection === 0)) {
        return false;
      }

      this.currSelection += direction;

      this.transitionRow();

      return true;
    }.bind(this);

    /**
     * This will manage the transition of the newly
     * selected item to the currently selected item
     */
    this.transitionRow = function() {
      window.requestAnimationFrame(function() {
        this.setTransforms(this.currSelection);

        // @CHANGED for the pagination
        $('#' + SLIDER_PAGINATION + " div").removeClass("circle-current");
        $("#circle-" + this.currSelection).addClass("circle-current");

      }.bind(this));

      this.trigger('indexChange', this.currSelection);
    }.bind(this);

    /**
     * Explicitly set the selected element using the index
     * @param {Number} index the index of the content element
     */
    this.setSelectedElement = function(index) {
      this.currSelection = index;
    }.bind(this);

    /**
     * Set properties for the currently selected element
     * @param {Element} selectedEle they currently selected element
     */
    this.manageSelectedElement = function(selectedEle) {
      selectedEle.style[this.transformStyle] = "translate3d(0, 0, 0)";
      selectedEle.style.opacity = "0.99";
    };

    /**
     * Take down the opacity of the selected while in another view
     */
    this.fadeSelected = function() {
      this.$rowElements[this.currSelection].style.opacity = "0.5";
    };

    /**
     * Set back to full opacity when in the shoveler/oneD view
     */
    this.unfadeSelected = function() {
      this.$rowElements[this.currSelection].style.opacity = "0.99";
    };

    /**
     * Shrink all the elements to the same size while the shoveler is not in focus
     */
    this.shrinkSelected = function() {
      this.setRightItemPositions(this.currSelection, 0);
      this.setLeftItemPositions(this.currSelection - 1, 0 - this.MARGIN_WIDTH);
    };

    /**
     * Set the positions of all elements to the right of the selected item
     * @param {Number} start the starting index
     * @param {Number} currX the current X position
     */
    this.setRightItemPositions = function(start, currX) {
      var i;

      //this for loop handles elements to the right of the selected element
      for (i = start; i < this.$rowElements.length; i++) {
        if (this.elementWidths[i] > 0) {
          this.$rowElements[i].style[this.transformStyle] = "translate3d(" + currX + "px,0,0px)";
          this.$rowElements[i].style.opacity = "0.5";
        } else {
          //keep element offscreen if we have no width yet
          this.$rowElements[i].style[this.transformStyle] = "translate3d(" + this.transformLimit + " +px,0,0px)";
        }

        if (currX > this.transformLimit) {
          if (this.limitTransforms) {
            break;
          }
        } else {
          currX += Math.round(this.elementWidths[i] + this.MARGIN_WIDTH);
        }
      }
    };

    /**
     * Set the positions of all elements to the left of the selected item
     * @param {Number} start the starting index
     * @param {Number} currX the current X position
     */
    this.setLeftItemPositions = function(start, currX) {
      var i;

      for (i = start; i >= 0; i--) {
        var currPosition = (currX - this.elementWidths[i]);
        var itemTrans = "translate3d(" + currPosition + "px,0, 0px)";

        if (this.elementWidths[i] > 0) {
          this.$rowElements[i].style[this.transformStyle] = itemTrans;
          this.$rowElements[i].style.opacity = "0.5";
        } else {
          //keep element offscreen if we have no width yet
          this.$rowElements[i].style[this.transformStyle] = "translate3d(" + (-this.transformLimit) + "px,0,0px)";
          this.$rowElements[i].style.display = "none";
        }

        if (currX < -this.transformLimit + 1000) {
          if (this.limitTransforms) {
            break;
          }
        } else {
          currX -= Math.round(this.elementWidths[i] + this.MARGIN_WIDTH);
        }
      }
    };

    /**
     * This is the method that transitions the element in the row
     * @param {Number} selected the index of the currently selected item
     */
    this.setTransforms = function(selected) {
      var currX = 0;
      selected = selected || this.currSelection;

      //set selected element properties
      this.manageSelectedElement(this.$rowElements[selected]);

      this.setLeftItemPositions(selected - 1, currX);

      currX = Math.round(this.elementWidths[selected]);

      this.setRightItemPositions(selected + 1, currX);
    }.bind(this);
  };

  exports.SliderView = SliderView;
}(window));
