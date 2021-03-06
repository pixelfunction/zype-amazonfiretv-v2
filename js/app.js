/* Main Application
 *
 * This module initializes the application and handles
 * transition between different views
 *
 */

(function(exports) {
  "use strict";

  /**
   * Placeholder - Handle page visibility for voice search button on video
   */
  var visibility = document.getElementById("appstate");

  /**
   * The 'pause' event is fired when the app is sent to the background (app completely hidden) or when its partially obscured
   */
  function onPause() {
    if (app.playerView) {
      app.playerView.pauseVideo();
    }
  }

  /**
   * The 'resume' event is fired when the app is brought to the foreground (app completely visible) including when the Voice Search Dialog is dismissed
   */
  function onResume() {
    if (app.playerView) {
      app.playerView.playVideo();
    }
  }

  /**
   * Add listeners for pause and resume when the platform is ready
   */
  function onAmazonPlatformReady() {
    document.addEventListener("pause", onPause, false);
    document.addEventListener("resume", onResume, false);
  }

  document.addEventListener("amazonPlatformReady", onAmazonPlatformReady, false);
  window.addEventListener('orientationchange', handleDeviceOrientation, false);

  /**
   * Handle device rotation event
   * When in portrait mode put up the app overlay div and notify the user
   * to change back to landscape
   */
  function handleDeviceOrientation() {
    //disregard on FireTV
    if (navigator.userAgent.match(/AFT/i)) {
      return;
    }

    //wrap in a timer to make sure the height and width are updated
    setTimeout(function() {
      if (window.innerWidth < window.innerHeight) {
        $('#overlay-message').html('please rotate your device back to landscpe');
        $('#app-overlay').css('display', 'block');
      } else {
        $('#overlay-message').html('');
        $('#app-overlay').css('display', 'none');
      }
    }, 500);
  }

  /**
   * The app object : the controller for the app, it creates views, manages navigation between views
   *                  routes input to the currently focused view, giving data to the views, and otherwise stitching things together
   * @param {Object} settingsParams settings for the application
   *                 settingsParams.dataURL {String} url of the initial data request
   *                 settingsParams.displayButtons {Boolean} flag that tells the app to display the buttons or not
   */
  var App = function(settingsParams) {
    var _this = this;

    this.settingsParams = settingsParams;
    this.showSearch     = settingsParams.showSearch;
    this.$appContainer  = $("#app-container");

    // mixin inheritance, initialize this as an event handler for these events:
    Events.call(this, ['purchased', 'videoError', 'link']);

    this.on("purchased", function() {
      this.oneDView.onPurchaseSuccess();
    }, this);

    this.on("videoError", function() {
      alert("There was an error playing the video.");
      this.exit();
    }, this);

    /**
     * Callback from XHR to load the data model, this really starts the app UX
     */
    this.dataLoaded = function() {
      var logo = this.settingsParams.icon;
      var html = utils.buildTemplate($("#app-header-template"), {
        img_logo: logo,
      });

      this.$appContainer.append(html);

      /**
       * Handle Monetization Variations
       */

      // Device Linking (U SVOD)
      if (this.settingsParams.device_linking === true && this.settingsParams.IAP === false) {
        // Check PIN Status
        deviceLinkingHandler.getPinStatus(this.settingsParams.device_id, this.getPinStatusCallback);
      }
      // IAP - In App Purchasing (N SVOD / N TVOD)
      else if (this.settingsParams.device_linking === false && this.settingsParams.IAP === true) {
        this.build();
      }
      // Force exit if both USVOD and IAP are enabled
      else if (this.settingsParams.device_linking === true && this.settingsParams.IAP === true) {
        console.log("Device Linking and IAP both enabled. Only one may be enabled at a time.");
        alert("There was an error configuring your Fire TV App.");
        app.exit();
      }
      // AVOD & Free
      else {
        this.build();
      }
    }.bind(this);

    /**
     * Build the app
     */
    this.build = function() {
      // Device Linking
      if (this.deviceLinkingView && this.currentView === this.deviceLinkingView) {
        // Remove Device Linking view
        this.deviceLinkingView.remove();
        this.deviceLinkingView = null;
        
        // If browsing, use existing loaded data from initial app.data.loadData()
        if (this.settingsParams.browse === true || this.settingsParams.watchAVOD === true) {
          this.initializeViews();
        }
        else {
          this.initLinkingSuccess();
        }
      }
      else {
        this.initializeViews();
      }
    };

    /**
     * Initialize App Views
     */
    this.initializeViews = function() {
      this.intializeAboutView();
      this.initializeLeftNavView();
      this.leftNavView.collapse();
      this.initializeNestedCategories();
      this.selectView(this.nestedCategoriesOneDView);
    };

    /**
     * Initialize Device Linking Success
     */
    this.initLinkingSuccess = function() {      
      deviceLinkingHandler.retrieveAccessToken(this.settingsParams.device_id, deviceLinkingHandler.getDevicePin(), this.retrieveAccessTokenCallback);
    }.bind(this);

    /**
     * Get Pin Status callback
     *
     * @param {Object|Boolean} result the response from getPinStatus()
     */
    this.getPinStatusCallback = function(result) {      
      if (result === false || result.linked === false) {
        // Device not linked
        this.settingsParams.linked = false;

        // Device Linking. Acquire PIN.
        this.initializeDeviceLinkingView();
        this.selectView(this.deviceLinkingView);
      }
      // Build App
      else {
        // Device Linking Success
        this.settingsParams.linked = true;

        deviceLinkingHandler.retrieveAccessToken(this.settingsParams.device_id, result.pin, this.retrieveAccessTokenCallback);
      }
    }.bind(this);

    /**
     * Retrieve Access Token callback
     * 
     * @param {Object} result the response from retrieveAccessToken()
     */
    this.retrieveAccessTokenCallback = function(result) {
      if (result) {
        deviceLinkingHandler.setOauthData(result);

        // Entitlements / My Library
        if (this.settingsParams.entitlements) {
          app.data.loadEntitlementData(deviceLinkingHandler.getAccessToken(), this.loadEntitlementDataCallback);
        }
        // Normal Device Linking
        else {
          // Video Favorites
          if (this.settingsParams.video_favorites) {
            app.data.loadVideoFavoritesData(deviceLinkingHandler.getAccessToken(), this.loadVideoFavoritesDataCallback);
          }
          else {
            this.build();
          }
        }
      }
      else {
        console.log("Error - retrieveAccessToken failed");
        alert("There was an error configuring your Fire TV App. Please relaunch and try again");
        app.exit();
      }
    }.bind(this);

    /**
     * Entitlement callback
     * 
     * @param {Object} result the response from loadEntitlementData()
     */
    this.loadEntitlementDataCallback = function(result) {
      // Save Entitlement Data
      if (result && result.length > 0) {
        app.data.entitlementData = result;
      }

      // Video Favorites
      if (this.settingsParams.video_favorites) {
        app.data.loadVideoFavoritesData(deviceLinkingHandler.getAccessToken(), this.loadVideoFavoritesDataCallback);
      }
      else {
        this.build();
      }
    }.bind(this);

    /**
     * Video Favorites callback
     * 
     * @param {Object} result the response from loadVideoFavoritesData()
     */
    this.loadVideoFavoritesDataCallback = function(result) {
      // Save Video Favorites Data
      if (result && result.response.length > 0) {
        app.data.videoFavoritesData = result.response;
      }
      
      this.build();
    }.bind(this);

    /**
     * Set the application's current view
     * @param {Object} view the current view
     */
    this.selectView = function(view) {
      this.currentView = view;
    };

    /**
     * User has pressed the back button
     */
    this.exitApp = function() {
      if (confirm("Are you sure you want to exit?")) {
        window.open('', '_self').close();
      }
      buttons.resync();
    };

    /**
     * Forced Exit
     */
    this.exit = function() {
      window.open('', '_self').close();
    };

    /**
     * All button events route through here, send them to current view
     * Views are switched based on the type of key press - up and down
     * key events will make the left-nav menu the focus while left and
     * right control the oneDView. When the video player has focus it
     * will handle all key events
     * @param {Event} e
     */
    this.handleButton = function(e) {
      if (this.currentView) {
        this.currentView.handleControls(e);
      } else if (e.type === 'buttonpress' && e.keyCode == buttons.BACK) {
        this.exitApp();
      }
    };

    /**
     * Handle touch events
     */
    this.handleTouch = function(e) {
      if (e.type === 'swipe') {
        if ($("#left-nav-list-container").hasClass('leftnav-menulist-collapsed')) {
          this.currentView = this.oneDView;
        } else {
          this.currentView = this.leftNavView;
        }
      }
      this.currentView.handleControls(e);
    };

    /**
     *
     * Device Linking View Object
     *
     */
    this.initializeDeviceLinkingView = function() {
      var deviceLinkingView = this.deviceLinkingView = new DeviceLinkingView();

      deviceLinkingView.on('exit', function() {
        console.log("device.linking.view.exit.event");
        this.exitApp();
      }, this);

      deviceLinkingView.on('loadComplete', function() {
        this.settingsParams.browse = false;
        this.hideContentLoadingSpinner();
      }, this);

      deviceLinkingView.on('linkingSuccess', function(result) {
        console.log('linking.success');

        var pin = result.pin;

        this.settingsParams.linked = true;
        this.settingsParams.browse = false;
        this.settingsParams.watchAVOD = false;

        // Set Consumer ID
        deviceLinkingHandler.setConsumerId(result);

        // Store successfully linked PIN
        deviceLinkingHandler.setDevicePin(pin);

        this.build();
      }, this);

      deviceLinkingView.on('linkingFailure', function() {
        console.log('linking.failure');
        alert("Please reload the app!");
      }, this);

      // SVOD (Device Linking)
      deviceLinkingView.on('startBrowse', function() {
        this.settingsParams.browse = true;
        this.build();
      }, this);

      // SVOD / AVOD Hybrid (Subscribe To Watch Ad-Free)
      deviceLinkingView.on('watchAVOD', function() {
        this.showContentLoadingSpinner(true);
        this.settingsParams.watchAVOD = true;
        this.build();
      }, this);

      deviceLinkingView.render(this.$appContainer);
    };

    /**************************
     *
     * About View Object
     *
     **************************/
    this.intializeAboutView = function() {
      var aboutView = this.aboutView = new AboutView();

      // Events
      aboutView.on('bounce', function() {
        this.aboutView.hide();
        this.transitionToLeftNavView();
      }, this);

      aboutView.render(this.$appContainer, this.settingsParams.about);
    };

    this.transitionToAboutView = function() {
      this.selectView(this.aboutView);
      this.aboutView.show();
      this.leftNavView.collapse();
    };

    /***************************
     *
     * Left Nav View Object
     *
     **************************/
    this.initializeLeftNavView = function() {

      var leftNavView = this.leftNavView = new LeftNavView();

      if (this.showSearch) {
        this.searchInputView = new SearchInputView();
      }

      /**
       * Event Handler - Select menu item
       * @param {Number} index the index of the selected item
       */
      leftNavView.on('select', function(index) {
        // Home
        if (index === this.settingsParams.nav.home) {
          this.transitionToPlaylistView(app.data.root_playlist_id, null, false);
          // Reset ancestorPlaylistData
          app.data.ancestorPlaylistData = [];
        }
        // Search
        else if (index === this.settingsParams.nav.search) {
          // show the spinner
          this.showContentLoadingSpinner(true);

          // @LEGACY
          // set the current selected (left nav items)
          app.data.setCurrentCategory(index);
          
          // if on OneDView (videos) update it with Search results
          if (this.oneDView) {
            this.oneDView.remove();

            this.oneDView.updateCategoryFromSearch(this.searchInputView.currentSearchQuery);
          }
          // if on NestedCategoriesOneDView, remove it and transition to OneDView
          else if (this.nestedCategoriesOneDView) {
            this.nestedCategoriesOneDView.remove();
            // also set to null because we're transitioning to oneDView
            this.nestedCategoriesOneDView = null;

            this.initializeOneDView(this.searchInputView.currentSearchQuery);
          }
          
          // set the selected view
          this.selectView(this.oneDView);

          // hide the leftNav
          this.leftNavView.collapse();
        }
        // About
        else if (this.settingsParams.about && (index === this.settingsParams.nav.about)) {
          this.transitionToAboutView();
        }
        // Library / Favorites (Playlists only displayed in NestedCategories view)
        else {
          // show the spinner
          this.showContentLoadingSpinner(true);

          // if on OneDView (videos), update it with respective content
          if (this.oneDView) {
            if (this.oneDView.sliderView) {
              this.oneDView.sliderView.remove();
            }
            this.oneDView.remove();

            // update the content
            this.oneDView.updateCategory();
          }
          // If on NestedCategoriesOneDView, remove it and transition to OneDView
          else if (this.nestedCategoriesOneDView) {
            this.nestedCategoriesOneDView.remove();
            // also set to null because we're transitioning to oneDView
            this.nestedCategoriesOneDView = null;

            this.initializeOneDView();
          }

          // @LEGACY
          app.data.setCurrentCategory(index);

          // set the selected view
          this.selectView(this.oneDView);

          // hide the leftNav
          this.leftNavView.collapse();

          if (this.showSearch) {
            this.leftNavView.searchUpdated = false;
            this.searchInputView.reset();
          }
        }
      }, this);

      /**
       * Event Handler - deselect leftnav view
       */
      leftNavView.on('deselect', function() {
        this.transitionFromLefNavToOneD();
      }, this);

      /**
       * Event Handler - exit the application
       */
      leftNavView.on('exit', function() {
        this.transitionFromLefNavToOneD();
      }, this);

      /**
       * Event Handler - search query
       */
      if (this.showSearch) {
        this.searchInputView.on('searchQueryEntered', function() {
          if (this.leftNavView.currSelectedIndex === this.settingsParams.nav.search) {
            this.leftNavView.searchUpdated = true;
            this.leftNavView.confirmNavSelection();
          }
        }, this);
      }

      leftNavView.on('makeActive', function() {
        this.transitionToExpandedLeftNavView();
      }, this);

      /**
       * Event Handler - Change index of currently selected menu item
       * @param {Number} index the index of the selected item
       */
      leftNavView.on('indexChange', function(index) {
        //set the newly selected category index
        if (index === this.settingsParams.nav.search) {
          this.searchInputView.select();
        }
        else {
          if (this.showSearch) {
            this.searchInputView.deselect();
          }
        }
      }, this);

      var successCallback = function(categoryItems) {
        var leftNavData = categoryItems;

        // Since Categories and Playlists are not displayed in Left Nav, set "startIndex" to -1
        var startIndex = -1;

        // About
        if (this.settingsParams.about) {
          var aboutIndex = this.settingsParams.nav.search + 1;

          leftNavData.unshift('About');

          if (this.settingsParams.linked && this.settingsParams.entitlements && this.settingsParams.video_favorites) {
            aboutIndex = this.settingsParams.nav.search + 3;
          }
          else if (this.settingsParams.linked && (this.settingsParams.entitlements || this.settingsParams.video_favorites)) {
            aboutIndex = this.settingsParams.nav.search + 2;        
          }

          this.settingsParams.nav.about = aboutIndex;
        }
        // Favorites
        if (this.settingsParams.video_favorites && this.settingsParams.linked) {
          leftNavData.unshift('Favorites');
          this.settingsParams.nav.favorites = (this.settingsParams.entitlements) ? this.settingsParams.nav.search + 2 : this.settingsParams.nav.search + 1;
        }
        // Entitlements / My Library
        if (this.settingsParams.entitlements && this.settingsParams.linked) {
          leftNavData.unshift('My Library');
          this.settingsParams.nav.library  = this.settingsParams.nav.search + 1;
        }
        // Add Search
        if (this.showSearch) {
          leftNavData.unshift(this.searchInputView);
        }
        // Add Home
        if (this.settingsParams.playlists_only === true) {
          leftNavData.unshift('Home');
        }
        
        // @LEGACY
        app.data.setCurrentCategory(startIndex);

        leftNavView.render(this.$appContainer, leftNavData, startIndex, this.settingsParams.nav);
      }.bind(this);

      leftNavView.updateCategoryItems = function() {
        app.data.getCategoryItems(successCallback);
      }.bind(this);

      this.leftNavView.updateCategoryItems();
    };


    /**
     * Nested Playlists One D View
     *
     * @param {string} the Playlist ID
     */
    this.initializeNestedCategories = function(playlist_id, playlist_title) {
      console.log('initializeNestedCategories');

      /**
       * Set default values for arguments
       * 
       * App init uses playlist_id = root_playlist_id and playlist_parent_id = `null`
       * Subsequent calls use passed arguments (and bypass `select` event)
       */
      var _playlist_id    = playlist_id || this.settingsParams.root_playlist_id;
      var _playlist_title = playlist_title || "Categories";

      // Create nestedCategoriesOneDView
      var nestedCategoriesOneDView = this.nestedCategoriesOneDView = new OneDViewCategories();

      /**
       * Event handler - select shoveler item
       * @param {number} index the index of the selected item
       */
      nestedCategoriesOneDView.on('select', function(index, fromSlider) {
        if (fromSlider) {
          this.verifyVideo(index, fromSlider);
        } else {
          // Set the current Playlist index
          app.data.setCurrentPlaylistIndex(index);

          // Get the current Playlist data
          var currPlaylistData = this.playlistData[index];

          /** 
           * Add the current Playlist Parent ID and Title to this.ancestorPlaylistData
           * this.ancestorPlaylistData is used when a user presses "Back"
           */
          app.data.setCurrentPlaylistParentData(currPlaylistData.parent_id, currPlaylistData.title);

          /**
           * Set the current Playlist ID
           * The current Playlist ID is used to query Playlist Children or Videos, respectively
           */ 
          app.data.setCurrentPlaylistId(currPlaylistData.id);

          /**
           * Set the current Playlist Title
           * The current Playlist Title is used as the nestedCategoriesOneDView Title
           */
          app.data.setCurrentPlaylistTitle(currPlaylistData.title);

          /**
           * Transition to Video or Playlist Child view, respectively
           */
          if (currPlaylistData.playlist_item_count > 0) {
            this.transitionToVideos(app.data.currentPlaylistId);
          }
          else {
            this.transitionToPlaylistView(app.data.currentPlaylistId, app.data.currentPlaylistTitle, false);
          }
        }
      }, this);

      /**
       * Go back to the left-nav menu list
       */
      nestedCategoriesOneDView.on('bounce', function() {
        this.transitionToLeftNavView();
      }, this);

      /**
       * Handle `Back` button press
       * Transition to Parent Playlist or Exit App
       */
      nestedCategoriesOneDView.on('exit', function() {
        // If there is ancestorsPlaylistData
        if (app.data.ancestorPlaylistData.length !== 0) {
          this.transitionToPlaylistView(null, null, true);  
        }
        else {
          this.exitApp();
        }
      }, this);

      /**
       * Event handler - Load complete
       * @param {Number} index the index of the selected item
       */
      nestedCategoriesOneDView.on('loadComplete', function() {
        this.hideContentLoadingSpinner();
        // handleDeviceOrientation();
        this.nestedCategoriesOneDView.expand();
      }, this);

      /**
       * Success Callback handler for Playlist Child data request
       * @param {Object} playlist data
       */
      var successCallback = function(playlistData) {
        console.log('nestedCatsOneDView callback fired', playlistData);

        // Store the current Playlist Data on the app object
        // @TODO - refactor
        this.playlistData = playlistData;

        var showSlider = function() {
          // Show Slider on Home screen only
          if (app.data.ancestorPlaylistData.length === 0) {
            return true;
          }
          return false;
        }

        // Define OneDView args
        var OneDViewPlaylistArgs = {
          $el: app.$appContainer,
          title: _playlist_title,
          rowData: playlistData,
          displaySliderParam: showSlider()
        };

        // Render nestedCategoriesOneDView
        nestedCategoriesOneDView.render(OneDViewPlaylistArgs);
      }.bind(this);

      /**
       * Load Playlist Children
       * 
       * On init, get initial Playlist Child data from the data model using Root Playlist ID
       * Subsequent calls on `select` and `exit` events
       */
      nestedCategoriesOneDView.loadPlaylistChildren = function(playlist_id, callback) {
        console.log('nestedCatsOneDView.loadPlaylistChildren');

        app.data.getPlaylistChildren(playlist_id, callback);
      }.bind(this);

      this.nestedCategoriesOneDView.loadPlaylistChildren(_playlist_id, successCallback);
    };


    /**
     * Transition To Playlist View
     *
     * @param {string}  the playlist id
     * @param {string}  the playlist title
     * @param {boolean} true if called from `exit` event. handles ancestorPlaylistData.
     */
    this.transitionToPlaylistView = function(playlist_id, playlist_title, exit) {
      console.log('transitionToPlaylistView');

      this.transitionFromLefNavToOneD();

      // Defaults
      var _playlist_id    = playlist_id || null;
      var _playlist_title = playlist_title || null;

      this.showContentLoadingSpinner(true);

      // Handle calls from `exit` event
      if (exit && app.data.ancestorPlaylistData.length > 0) {
        var ancestors_length = app.data.ancestorPlaylistData.length;
        var index = (ancestors_length === 1) ? 0 : ancestors_length - 1;
        
        /**
         * Set the Parent Playlist ID and Title
         * 
         * Since there is no `parent_title` property from the API, 
         * we use (index - 1) to obtain parent title from ancestorPlaylistData[]
         */ 
        _playlist_id    = app.data.ancestorPlaylistData[index].playlist_parent_id;
        _playlist_title = (app.data.ancestorPlaylistData[index - 1]) ? app.data.ancestorPlaylistData[index - 1].playlist_title : null;

        // Remove invalid Ancestors
        app.data.ancestorPlaylistData.pop();
      }

      // Remove nestedCategoriesOneDView
      if (this.nestedCategoriesOneDView) {
        if (this.nestedCategoriesOneDView.sliderView) {
          this.nestedCategoriesOneDView.sliderView.remove();
        }

        if (this.nestedCategoriesOneDView.shovelerView) {
          this.nestedCategoriesOneDView.shovelerView.remove();
        }

        this.nestedCategoriesOneDView.remove();
        this.nestedCategoriesOneDView = null;
      }
      
      // Remove oneDView
      if (this.oneDView) {
        if (this.oneDView.sliderView) {
          this.oneDView.sliderView.remove();
        }

        if (this.oneDView.shovelerView) {
          this.oneDView.shovelerView.remove();
        }
        this.oneDView.remove();
        this.oneDView = null;
      }

      // Remove leftNavView
      if (this.leftNavView) {
        this.leftNavView.remove();
        this.leftNavView = null;
      }

      // Reset the currentCategory to -1 for leftNavView
      app.data.setCurrentCategory(-1);

      // Reset for initializeLeftNavView
      app.data.categoryData = [];

      this.initializeLeftNavView();
      
      this.initializeNestedCategories(_playlist_id, _playlist_title);

      this.leftNavView.collapse();

      this.nestedCategoriesOneDView.on('loadComplete', function() {
        this.selectView(this.nestedCategoriesOneDView);
      }, this);
    };


    /**
     * Transition to Videos
     *
     * @param {string} the Playlist ID to load
     */
    this.transitionToVideos = function(playlist_id) {
      console.log('transitionToVideos');

      this.showContentLoadingSpinner(true);

      if (this.nestedCategoriesOneDView) {
        if (this.nestedCategoriesOneDView.sliderView) {
          this.nestedCategoriesOneDView.sliderView.remove();
        }

        if (this.nestedCategoriesOneDView.shovelerView) {
          this.nestedCategoriesOneDView.shovelerView.remove();
        }

        this.nestedCategoriesOneDView.remove();
        this.nestedCategoriesOneDView = null;
      }

      if (this.leftNavView) {
        this.leftNavView.remove();
        this.leftNavView = null;
      }

      // Reset the currentCategory to -1 for leftNavView
      app.data.setCurrentCategory(-1);

      // initializeLeftNavView() calls getPlaylistData() directly rather than legacy loadData()
      // Reset `categoryData` manually
      app.data.categoryData = [];
      this.initializeLeftNavView();
      this.initializeOneDView();
      this.selectView(this.oneDView);
      this.leftNavView.collapse();
    };


    /***************************
     *
     * One D View
     *
     **************************/
    this.initializeOneDView = function(searchTerm) {
      // create and set up the 1D view
      var oneDView = this.oneDView = new OneDView();

      /**
       * Event Handler - Select shoveler item
       * @param {Number} index the index of the selected item
       */
      oneDView.on('select', function(index, fromSlider) {
        if (fromSlider) {
          this.verifyVideo(index, fromSlider);
        } else {
          app.data.setCurrentItem(index);
          this.verifyVideo(index, fromSlider);
        }
      }, this);

      /**
       * Event Handler - No content found for oneD event
       */
      oneDView.on('noContent', function(index) {
        window.setTimeout(function() {
          this.transitionToLeftNavView();
          this.leftNavView.setHighlightedElement();
        }.bind(this), 10);
      }, this);

      /**
       * Go back to the left-nav menu list
       * @param {String} direction keypress direction
       */
      oneDView.on('bounce', function() {
        this.transitionToLeftNavView();
      }, this);

      /**
       * Go back to the Parent Playlist if the user presses back
       */
      oneDView.on('exit', function() {
        if (this.settingsParams.playlists_only === true) {
          this.transitionToPlaylistView(null, null, true);
        } else {
          this.exitApp();
        }
      }, this);

      /**
       * Event Handler - Load Complete
       * @param {Number} index the index of the selected item
       */
      oneDView.on('loadComplete', function() {
        this.hideContentLoadingSpinner();
        // handleDeviceOrientation();
        this.oneDView.expand();
      }, this);

      /**
       * Event Handler - Make In-App-Purchase shoveler item
       * @param {Number} sku is the sku of the selected item
       */
      oneDView.on('makeIAP', function(sku) {
        iapHandler.purchaseItem(sku);
      }, this);

      oneDView.on('link', function() {
        this.transitionToDeviceLinking();
      }, this);

      /**
       * Event Handler - Add / Delete Video Favorite
       *
       * @param {Number} the index of the selected item
       */
      oneDView.on('videoFavorite', function(index) {
        this.handleFavorites(index);
      }, this);

      this.transitionToDeviceLinking = function() {
        this.showContentLoadingSpinner(true);
        console.log('transition.to.device.linking.view');

        if (this.oneDView.sliderView) this.oneDView.sliderView.remove();
        this.oneDView.shovelerView.remove();
        this.oneDView.remove();
        this.oneDView = null;

        this.leftNavView.remove();
        this.leftNavView = null;

        this.initializeDeviceLinkingView();
        this.selectView(this.deviceLinkingView);
      }.bind(this);

      /**
       * Success Callback handler for category data request
       * @param {Object} categoryData
       */
      var successCallback = function(categoryData) {
        // @TODO Refactor
        // these are the videos (app.categoryData)
        this.categoryData = categoryData;

        var playlistTitle = "";
        if (this.leftNavView.currSelectedIndex === this.settingsParams.nav.search) {
          playlistTitle = "Search";
        }
        else if (this.leftNavView.currSelectedIndex === this.settingsParams.nav.favorites) {
          playlistTitle = "Favorites";
        }
        else if (this.leftNavView.currSelectedIndex === this.settingsParams.nav.library) {
          playlistTitle = "My Library";
        }
        else {
          playlistTitle = app.data.playlistData[app.data.currentPlaylistIndex].title;
        }

        /* @LEGACY
         * Here we assume that a client has, so called, the "Featured" list by default
         */
        var showSlider = function() {
          // Show Slider on Featured Playlist
          // if (app.data.currentCategory === this.settingsParams.nav.playlist) {
          //   return true;
          // }
          return false;
        }.bind(this);

        // IAP
        if (this.settingsParams.IAP === true) {
          // add video ids to iapHandler
          var video_ids = _.map(this.categoryData, function(v) {
            return v.id;
          });

          iapHandler.state.allVideoIds = video_ids;

          // add reference of oneDView to iapHandler
          iapHandler.oneDView = oneDView;

          // get the available items from amazon
          iapHandler.checkAvailableItems(function() {
            renderOneDView();
          });
        } else {
          renderOneDView();
        }

        function renderOneDView() {
          var oneDViewArgs = {
            $el: app.$appContainer,
            title: playlistTitle,
            rowData: app.categoryData, // @TODO refactor
            displayButtonsParam: app.settingsParams.displayButtons,
            displaySliderParam: false
          };
          if (showSlider()) {
            oneDViewArgs.displaySliderParam = true;
            oneDView.render(oneDViewArgs);
          } else {
            oneDView.render(oneDViewArgs);
          }
        }

      }.bind(this);

      /**
       * Get data if the search feature is used
       */
      oneDView.updateCategoryFromSearch = function(searchTerm) {
        app.data.getDataFromSearch(searchTerm, successCallback);
      }.bind(this);

      oneDView.updateCategory = function(searchTerm) {
        // Video Favorites
        if (this.settingsParams.video_favorites && this.settingsParams.nav.favorites && this.leftNavView.currSelectedIndex === this.settingsParams.nav.favorites) {
          // Load Video Favorites Data
          app.data.loadVideoFavoritesData(deviceLinkingHandler.getAccessToken, function(result) {
            app.data.videoFavoritesData = result.response;
            // Load Video Favorites
            app.data.getVideoFavoritesData(app.data.videoFavoritesData, successCallback);
          });
        }
        // Entitlements / My Library
        else if (this.settingsParams.nav.library && this.leftNavView.currSelectedIndex === this.settingsParams.nav.library) {
          app.data.getEntitlementData(app.data.entitlementData, successCallback);
        }
        // Search
        else if (searchTerm && this.settingsParams.nav.search && this.leftNavView.currSelectedIndex === this.settingsParams.nav.search) {
          console.log('searchTerm && search curr selected - calling getDataFromSearch');
          app.data.getDataFromSearch(searchTerm, successCallback);
        }
        // Playlist
        else {
          app.data.getPlaylistData(app.data.currentPlaylistId, successCallback);
        }
      }.bind(this);

      this.oneDView.updateCategory(searchTerm);
    };

    /**
     * Handle Favorites — Create, Delete, Success, Errors
     *
     * @param {Number} index the current video's index
     */
    this.handleFavorites = function(index) {
      var currVideo = _this.categoryData[index];
      var token     = deviceLinkingHandler.getAccessToken();

      var createFavoriteCallback = function(result) {
        // Add New Video from videoData (async)
        app.data.loadVideoFavoritesData(token, loadVideoFavoritesDataCallback);

        // Update current OneDView Video Item with Favorite ID
        _this.categoryData[index].video_favorite_id = result.response._id;

        // Update OneDView reference to app.categoryData (reference OneDView.rowData created on render())
        app.oneDView.rowData = _this.categoryData;

        // Update the ButtonView
        app.oneDView.buttonView.update(true);
      };

      var deleteFavoriteCallback = function(result) {
        // Update videoFavoritesData (async)
        app.data.loadVideoFavoritesData(token, loadVideoFavoritesDataCallback);

        // Update current OneDView Video Item
        _this.categoryData[index].video_favorite_id = null;

        // Update OneDView reference to app.categoryData (reference OneDView.rowData created on render())
        app.oneDView.rowData = _this.categoryData;

        // Update the ButtonView
        app.oneDView.buttonView.update(true);
      };

      var errorCallback = function() {
        console.log('create/delete video favorite', arguments);
        alert('Error: Update Video Favorite status. Please try again.');
        _this.transitionFromAlertToOneD();
      };

      var loadVideoFavoritesDataCallback = function(result) {
        // Save Updated Video Favorites Data
        if (result && result.response) {
          app.data.videoFavoritesData = result.response;
        }
      };

      // Add to Favorites
      if (currVideo.video_favorite_id === null) {
        app.data.createVideoFavorite(currVideo, index, token, createFavoriteCallback, errorCallback);
      }
      // Remove from Favorites
      else {
        // Delete Video from videoData
        app.data.deleteVideoFavorite(currVideo.video_favorite_id, token, deleteFavoriteCallback, errorCallback);
      }
    };


    /**
     * Hide content loading spinner
     */
    this.hideContentLoadingSpinner = function() {
      $('#app-loading-spinner').hide();

      if ($('#app-overlay').css('display') !== 'none') {
        $('#app-overlay').fadeOut(250);
      }
    };

    /**
     * Show content loading spinner
     * @param {Boolean} showOverlay if true show the app overlay
     */
    this.showContentLoadingSpinner = function(showOverlay) {

      $('#app-loading-spinner').show();

      if (showOverlay) {
        $('#app-overlay').show();
      }
    };

    /**
     * Hide application header bar - typically used
     * when another view takes over the screen (i.e. player)
     */
    this.hideHeaderBar = function() {
      $("#app-header-bar").hide();
    };

    /**
     * Show application header bar
     */
    this.showHeaderBar = function() {
      $("#app-header-bar").show();
    };

    /***********************************
     *
     * Application Transition Methods
     *
     ***********************************/
    /**
     * Set the UI appropriately for the left-nav view
     */
    this.transitionToLeftNavView = function() {
      this.selectView(this.leftNavView);
      this.leftNavView.setHighlightedElement();

      //change size of selected slider and shoveler item
      if (this.oneDView) {
        this.oneDView.shrink();  
      }

      if (this.nestedCategoriesOneDView) {
        this.nestedCategoriesOneDView.shrink();
      }
    };

    /**
     * For touch there is no need to select the chosen left-nav
     * item, so we go directly to the expanded view
     */
    this.transitionToExpandedLeftNavView = function() {
      this.selectView(this.leftNavView);

      //expand the left nav
      this.leftNavView.expand();

      //change size of selected shoveler item
      if (this.oneDView) {
        this.oneDView.shrink();
      }

      if (this.nestedCategoriesOneDView) {
        this.nestedCategoriesOneDView.shrink();
      }

    };

    /**
     * Transition from left nav to the oneD view
     */
    this.transitionFromLefNavToOneD = function() {
      if (this.oneDView) {
        if (this.oneDView.noItems) {
          this.leftNavView.setHighlightedElement();
          return;
        }

        this.leftNavView.collapse();
        this.selectView(this.oneDView);
        //change size of selected slider item
        this.oneDView.expand();
      }

      if (this.nestedCategoriesOneDView) {
        this.leftNavView.collapse();
        this.selectView(this.nestedCategoriesOneDView);
        //change size of selected slider item
        this.nestedCategoriesOneDView.expand();
      }
      
    };

    /**
     * Transition from player view to Nested Categories one-D view
     */
    this.transitionFromPlayerToNestedCategoriesOneD = function() {
      this.selectView(this.nestedCategoriesOneDView);
      this.playerView.off('videoStatus', this.handleVideoStatus, this);
      this.playerView.remove();
      this.playerView = null;
      this.nestedCategoriesOneDView.show();
      this.leftNavView.show();
      this.nestedCategoriesOneDView.shovelerView.show();
      this.showHeaderBar();
    };

    /**
     * Transition from player view to one-D view
     */
    this.transitionFromPlayerToOneD = function() {
      this.selectView(this.oneDView);
      this.playerView.off('videoStatus', this.handleVideoStatus, this);
      this.playerView.remove();
      this.playerView = null;
      this.oneDView.show();
      this.leftNavView.show();
      this.oneDView.shovelerView.show();
      this.showHeaderBar();
    };

    this.transitionFromAlertToOneD = function() {
      this.selectView(this.oneDView);
      buttons.resync();
    };

    /**
     * Check if a video is time-limited. Save its index.
     *
     * @param  {Object} the current video
     * @return {Boolean}
     */
    this.isTimeLimited = function(video) {
      var _v = (this.settingsParams.videos_time_limited && this.settingsParams.videos_time_limited.length > 0) ? this.settingsParams.videos_time_limited : null;

      if (_v) {
        for (var i = 0; i < _v.length; i++) {
          if (video.id === _v[i].id) {
            // save current videos_time_limited index
            app.data.currVideoTimedIndex = i;
            return true;  
          }
        }
      }
      return false;
    };

    /**
     * Do Video Time Limit
     *
     * @param {integer} the video's index
     * @param {boolean} if selected video was from the slider
     * @param {string}  a valid access token
     * @param {boolean} true if from Playlist Player
     */
    this.doTimeLimit = function(index, fromSlider, accessToken, playlistPlayer) {
      var _v = this.settingsParams.videos_time_limited[app.data.currVideoTimedIndex];

      if (_v && _v.watched === false) {
        // clear existing timers
        if (app.data.videoTimerId) {
          this.clearVideoTimer(app.data.videoTimerId, false);  
        }
        
        // start the timer
        this.startVideoTimer(_v);

        // play the video
        if (playlistPlayer && this.playerView) {
          this.playerView.transitionToNextVideo(index, accessToken);
        }
        else {
          this.transitionToPlayer(index, fromSlider, accessToken);
        }
      }
      else {
        // Exit if called from playlistPlayer and already watched
        if (playlistPlayer && this.playerView) {
          this.playerView.exit();
        }
        alert('You have watched the maximum allowed time for this video. Please subscribe for full access.');
        this.transitionFromAlertToOneD();  
      }
    };

    /**
     * Start Video Timer
     *
     * @param {Object} the timed video object
     */
    this.startVideoTimer = function(videoTimed) {
      app.data.videoTimerId = window.setInterval(timerHandler, 1000);

      function timerHandler() {
        // update amount of time watched
        if (videoTimed.time_watched < videoTimed.time_limit) {
          videoTimed.time_watched++;
        }
        else {
          videoTimed.watched = true;

          _this.clearVideoTimer(app.data.videoTimerId, true);
        }
      }
    };

    /**
     * Clear and reset the video timer. Optionally exit the current playerView
     *
     * @param {number}  Timer ID to remove
     * @param {boolean} true to exit the current playerView
     */
    this.clearVideoTimer = function(videoTimerId, exitPlayerView) {
      // clear the current timer
      window.clearInterval(videoTimerId);

      // reset the timer var
      app.data.videoTimerId = null;

      // reset the currVideoTimedIndex
      app.data.currVideoTimedIndex = null;

      // stop the video and exit
      if (exitPlayerView && this.playerView) {
        this.playerView.trigger('exit');
        alert('You have watched the maximum allowed time for this video. Please subscribe for full access.');
        this.transitionFromAlertToOneD();
      }
    };

    /**
     * Verifies video playability and calls appropriate method
     * @param {integer} the video's index
     * @param {boolean} if selected video was from the slider
     */
    this.verifyVideo = function(index, fromSlider) {
      var video;

      if (fromSlider) {
        video = app.data.sliderData[index];
      } else {
        video = this.categoryData[index];
      }

      // IAP and Free
      if (iapHandler.canPlayVideo(video) === false) {
        return false;
      }
      // Device Linking
      else if (this.settingsParams.device_linking === true) {

        // SVOD Device Linking. Validate Entitlement.
        if (this.settingsParams.linked === true) {

          // Access Token check
          if (deviceLinkingHandler.hasValidAccessToken() === true) {

            var accessToken = deviceLinkingHandler.getAccessToken();
            
            // Entitlement check
            deviceLinkingHandler.isEntitled(video.id, accessToken, function(result) {
              if (result === true) {
                // Handle Time-Limited Videos
                if (this.settingsParams.limit_videos_by_time && !this.settingsParams.subscribe_no_limit_videos_by_time && this.isTimeLimited(video) === true) {
                  return this.doTimeLimit(index, fromSlider, accessToken, false);
                }
                return this.transitionToPlayer(index, fromSlider, accessToken);
              }
              else {
                alert('You are not authorized to access this content.');
                return this.transitionFromAlertToOneD();
              }
            }.bind(this));

          }
          else {
            console.log('No valid access token, refreshing');

            // Refresh Access Token
            var oauth = deviceLinkingHandler.getOauthData();

            deviceLinkingHandler.refreshAccessToken(this.settingsParams.client_id, this.settingsParams.client_secret, oauth.refresh_token, function(result) {
              if (result !== false) {
                deviceLinkingHandler.setOauthData(result);

                var accessToken = deviceLinkingHandler.getAccessToken();

                // Entitlement check
                deviceLinkingHandler.isEntitled(video.id, accessToken, function(result) {
                  if (result === true) {
                    // Handle Time-Limited Videos
                    if (this.settingsParams.limit_videos_by_time && !this.settingsParams.subscribe_no_limit_videos_by_time && this.isTimeLimited(video) === true) {
                      return this.doTimeLimit(index, fromSlider, accessToken, false);
                    }
                    return this.transitionToPlayer(index, fromSlider, accessToken);
                  }
                  else {
                    alert('You are not authorized to access this content.');
                    return this.transitionFromAlertToOneD();
                  }
                }.bind(this));
              }
              else {
                console.log('Error - refreshAccessToken');
                alert('Authentication Error: Please try again.');
                return this.transitionFromAlertToOneD();
              }
            }.bind(this));  
          }
        }
        // Device is not linked.
        else {
          // If user is browsing, allow free videos.
          if (this.settingsParams.browse) {
            // Restrict all Paywall videos
            if (video.hasPaywall() === true) {
              alert('You are not authorized to access this content. Device is not linked. Please subscribe for access.');
              this.transitionFromAlertToOneD();
              return false;
            }
            // Enforce Time-Limited videos
            else if (this.settingsParams.limit_videos_by_time && this.isTimeLimited(video) === true) {
              return this.doTimeLimit(index, fromSlider, accessToken, false);
            }
            // AVOD / Free
            else {
              return this.transitionToPlayer(index, fromSlider, accessToken);
            }
          }
          // Device Linking is enabled, but device is not Linked (settings.linked set on `app.dataLoaded` callback)
          else {
            // Subscription has expired. Clear local storage and force re-link
            deviceLinkingHandler.clearLocalStorage();
            alert('Authentication Error: You are not authorized to access this content. Device is not linked. Please relaunch and link again.');
            this.transitionFromAlertToOneD();
            return false;
          }
        }
      }
      else {
        // canPlayVideo === true && device_linking === false - transitionToPlayer
        return this.transitionToPlayer(index, fromSlider, accessToken);
      }
    };

    /**
     * Opens a player view and starts video playing in it.
     * @param {Object} itemData data for currently selected item
     */
    this.transitionToPlayer = function(index, fromSlider, accessToken) {
      // Create the PlayerView
      var playerView;
      this.playerSpinnerHidden = false;

      if (this.settingsParams.PlaylistView && this.settingsParams.autoplay && !fromSlider) {
        playerView = this.playerView = new this.settingsParams.PlaylistView(this.settingsParams);
      } else {
        playerView = this.playerView = new this.settingsParams.PlayerView(this.settingsParams);
      }

      if (this.oneDView) {
        this.oneDView.hide();  
      }

      if (this.nestedCategoriesOneDView) {
        this.nestedCategoriesOneDView.hide();
      }
      
      this.leftNavView.hide();
      this.hideHeaderBar();

      //start the loader
      this.showContentLoadingSpinner(true);

      playerView.on('exit', function() {
        // Clear and reset video timer
        if (app.data.videoTimerId) {
          this.clearVideoTimer(app.data.videoTimerId, false);
        }
        
        this.hideContentLoadingSpinner();
        if (this.oneDView) {
          this.transitionFromPlayerToOneD();
        }
        if (this.nestedCategoriesOneDView) {
          this.transitionFromPlayerToNestedCategoriesOneD();
        }
      }, this);

      playerView.on('indexChange', function(index) {
        if (this.oneDView) {
          this.oneDView.changeIndex(index);  
        }
      }, this);


      this.selectView(playerView);

      playerView.on('videoStatus', this.handleVideoStatus, this);

      playerView.on('videoError', function() {
        // Clear and reset video timer
        if (app.data.videoTimerId) {
          this.clearVideoTimer(app.data.videoTimerId, false);
        }
      }, this);

      // stream video first gets the stream and then renders the player
      if (fromSlider) {
        this.start_stream(playerView, this.$appContainer, app.data.sliderData, index, accessToken);
      } else {
        this.start_stream(playerView, this.$appContainer, this.categoryData, index, accessToken);
      }
    };

    this.start_stream = function(playerView, container, items, index, accessToken) {
      var video = items[index];
      var url_base = this.settingsParams.player_endpoint + 'embed/' + video.id + '.json';
      var uri = new URI(url_base);
      uri.addSearch({
        autoplay: this.settingsParams.autoplay
      });
      if (typeof accessToken !== 'undefined' && accessToken) {
        uri.addSearch({ access_token: accessToken });
      } 
      else {
        uri.addSearch({ app_key: this.settingsParams.app_key });
      }

      var consumer = iapHandler.state.currentConsumer;

      if (typeof consumer !== 'undefined' && consumer && consumer.access_token) {
        uri.addSearch({
          access_token: consumer.access_token
        });
      }

      $.ajax({
        url: uri.href(),
        type: 'GET',
        dataType: 'json',
        context: this,
        success: function(player_json) {
          var playerJson = player_json.response.body;
          var outputs = player_json.response.body.outputs;

          for (var i = 0; i < outputs.length; i++) {
            var output = outputs[i];
            video.url = (this.settingsParams.ssl_videos) ? utils.makeSSL(output.url) : output.url;
            if (output.name === 'hls' || output.name === 'm3u8') {
              video.format = 'application/x-mpegURL';
            } else if (output.name === 'mp4') {
              video.format = 'video/mp4';
            }

            // add ad schedule to video json
            if (player_json.response.body.advertising) {
              video.ad_schedule = [];
              var schedule = player_json.response.body.advertising.schedule;
              for (var i = 0; i < schedule.length; i++) {
                // add each ad tag in, make played be false
                var seconds = schedule[i].offset / 1000;
                video.ad_schedule.push({
                  offset: seconds,
                  tag: schedule[i].tag,
                  played: false
                });
              }
            }

            playerView.render(container, items, index, playerJson);
          }
        },
        error: function() {
          // Clear and reset video timer
          if (app.data.videoTimerId) {
            this.clearVideoTimer(app.data.videoTimerId, false);
          }
          alert("There was an error playing this video. Please try again.");
          this.hideContentLoadingSpinner();
          this.transitionFromPlayerToOneD();
        }
      });
    };

    /**
     * Apps player status handler, currently just checks for playing and hides spinner and turns off the handler.
     */
    this.handleVideoStatus = function(currTime, duration, type) {
      if (!this.playerSpinnerHidden && type === "playing") {
        this.hideContentLoadingSpinner();
        this.playerSpinnerHidden = true;
      } else if (type === "canplay") {
        this.playerView.playVideo();
      } else if (type === "ended") {
        this.hideContentLoadingSpinner();

        if (this.oneDView) {
          this.transitionFromPlayerToOneD();  
        }

        if (this.nestedCategoriesOneDView) {
          this.transitionFromPlayerToNestedCategoriesOneD();
        }
      }
    };

    // set up button handlers
    buttons.on('buttonpress', this.handleButton, this);
    buttons.on('buttonrepeat', this.handleButton, this);
    buttons.on('buttonrelease', this.handleButton, this);

    touches.on('touch', this.handleTouch, this);
    touches.on('swipe', this.handleTouch, this);

    //initialize the model and get the first data set
    this.data = new this.settingsParams.Model(this.settingsParams);
    this.data.loadData(this.dataLoaded);
  };

  exports.App = App;
}(window));
