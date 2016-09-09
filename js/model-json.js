/* Model
 *
 * Model for JSON data
 */

(function(exports) {
  "use strict";

  // the model for the Media Sample Data
  // @param {Object} appSettings are the user-defined settings from the index page
  var JSONMediaModel = function(appSettings) {
    this.settingsParams = appSettings;

    this.categoryData = []; // "Titles" for leftNav-view and old category-based OneDView
    this.categoryTitle = "";
    this.currData = [];
    this.currentCategory = 0;
    this.currentItem = 0;
    this.plans = [];

    // Enhanced Playlists
    this.currentPlaylistTitle = "";
    this.currentPlaylistId = null; 
    this.ancestorPlaylistData = []; // current playlist's ancestor playlist data (old - new)
    this.playlistData = []; // current playlists data (objects)
    this.currentPlaylistIndex = 0; // current playlist's index in playlistData[]

    // @LEGACY
    this.channelsData = [];
    this.currentChannel = 0;

    this.zobjectData = [];
    this.sliderData = [];
    this.entitlementData = {};

    /**
     * This function loads the initial data needed to start the app and calls the provided callback with the data when it is fully loaded
     * @param {function} the callback function to call with the loaded data
     */
    this.loadData = function(dataLoadedCallback) {
      // Important to load any plans as the IAP handler will need to have those available.
      var that = this;

      that.categoryData = [];
      that.categoryTitle = "";
      that.currData = [];
      that.currentCategory = 0;
      that.currentItem = 0;
      that.plans = [];
      that.channelsData = [];
      that.zobjectData = [];
      that.sliderData = [];
      that.entitlementData = {};

      this.getPlans(function(plans) {
        that.plans = plans;
        if (that.settingsParams.playlists_only) {
          that.getPlaylistChildren(that.settingsParams.root_playlist_id, dataLoadedCallback);
        }
        else {
          console.log('Enhanced Playlists are required for this app version');
        }
      });
    }.bind(this);

    this.loadZObjectData = function(callback) {
      console.log('load.zobject.data');
      $.ajax({
        url: this.settingsParams.endpoint + "zobjects/?zobject_type=slider&app_key=" + this.settingsParams.app_key,
        type: 'GET',
        crossDomain: true,
        dataType: 'json',
        context: this,
        cache: true,
        success: function() {
          var data = arguments[0].response;

          for (var i = 0; i < data.length; i++) {
            this.zobjectData.push({
              id: data[i].video_ids[0],
              title: data[i].title,
              desc: data[i].description,
              thumbnail: utils.makeSSL(data[i].pictures[0].url)
            });
          }

          if (this.zobjectData.length > 0) {
            for (i = 0; i < this.zobjectData.length; i++) {
              if (this.zobjectData[i].id) {
                this.loadSliderVideoDetails(this.zobjectData[i].id, this.zobjectData[i].title, this.zobjectData[i].desc, this.zobjectData[i].thumbnail);
              }
            }
          }
        },
        error: function() {
          console.log('loadZObjectData.error');
        },
        complete: function() {
          callback();
        }
      });
    };

    this.loadSliderVideoDetails = function(video_id, title, desc, thumbnail) {
      $.ajax({
        url: this.settingsParams.endpoint + "videos/" + video_id + "?app_key=" + this.settingsParams.app_key,
        type: 'GET',
        crossDomain: true,
        dataType: 'json',
        context: this,
        cache: true,
        success: function() {
          var video = arguments[0].response;
          var args = {
            "id": video._id,
            "title": title,
            "pubDate": video.published_at,
            "thumbURL": thumbnail,
            "imgURL": thumbnail,
            // parse videoURL at playtime
            "description": desc,
            "seconds": video.duration,
            "subscription_required": video.subscription_required,
            "rental_required": video.rental_required,
            "purchase_required": video.purchase_required,
            "pass_required": video.pass_required
          };

          var formatted_video = new Video(args);
          // console.log(formatted_video);
          this.sliderData.push(formatted_video);
        },
        error: function() {
          console.log('loadVideoDetails.error');
          alert("There was an error configuring your Fire TV App. Please exit.");
          app.exit();
        }
      });
    };

    /**
     * Get Playlist Children
     *
     * @param {string}   the ID of the Playlist to get
     * @param {function} the callback function
     */
    this.getPlaylistChildren = function(playlist_id, callback) {
      console.log('getPlaylistChildren');

      $.ajax({
        url: this.settingsParams.endpoint + 'playlists',
        data: {
          'parent_id': playlist_id,
          'app_key'  : this.settingsParams.app_key,
          'per_page' : 100,
          'order'    : 'desc',
          'sort'     : 'priority'
        },
        type: 'GET',
        crossDomain: true,
        dataType: 'json',
        context: this,
        cache: false,
        success: function(res) {
          // format playlist children
          this.formatPlaylistChildren(res);
        },
        error: function() {
          console.log('getPlaylistChildren.error', arguments);
        },
        complete: function() {
          callback(this.playlistData);
        }
      });
    };

    /**
     * Format Playlist Children
     *
     * @param {object} playlist data
     */
    this.formatPlaylistChildren = function(jsonData) {
      console.log('formatPlaylistChildren');

      var data = jsonData.response;
      var _playlistData = [];

      for (var i = 0; i < data.length; i++) {
        var args = {
          id: data[i]._id,
          description: data[i].description,
          parent_id: data[i].parent_id,
          playlist_item_count: data[i].playlist_item_count,
          title: data[i].title,
          imgURL: (data[i].thumbnails && data[i].thumbnails.length > 0) ? data[i].thumbnails[0].url : ''
        };
        var formatted_playlist = new PlaylistChild(args);
        _playlistData.push(formatted_playlist);
      }
      this.playlistData = _playlistData;
    };

    /**
     * Set Current Playlist Parent ID
     *
     * @param {string} ID of current playlist parent 
     */
    this.setCurrentPlaylistParentData = function(playlist_parent_id, playlist_title) {
      console.log('setCurrentPlaylistParentData');

      this.ancestorPlaylistData.push({
        "playlist_parent_id" : playlist_parent_id,
        "playlist_title"     : playlist_title
      });
    };

    /**
     * Set Current Playlist ID
     *
     * @param {string} the current playlist id
     */
    this.setCurrentPlaylistId = function(id) {
      console.log('setCurrentPlaylistId', id);
      this.currentPlaylistId = id;
    };

    /**
     * Set Current Playlist Title
     *
     * @param {string} the current playlist title
     */
    this.setCurrentPlaylistTitle = function(title) {
      console.log('setCurrentPlaylistTitle');
      this.currentPlaylistTitle = title;
    };

    /**
     * Set Current Playlist Index
     *
     * @param {number} the current playlist
     */
    this.setCurrentPlaylistIndex = function(index) {
      console.log('setCurrentPlaylistIndex', index);
      this.currentPlaylistIndex = index;
    };


    /**
     * Load Entitlement data
     * 
     * @param {string}   a valid Access Token
     * @param {function} the callback function
     */
    this.loadEntitlementData = function(accessToken, callback) {
      var resp;

      $.ajax({
        url: this.settingsParams.endpoint + "consumer/videos/",
        type: "GET",
        crossDomain: true,
        dataType: 'json',
        context: this,
        cache: false,
        data: {
          "access_token" : accessToken,
          "dpt" : true,
          "order" : "desc",
          "per_page" : this.settingsParams.per_page,
          "sort" : "created_at"
        },
        success: function(result) {
          resp = result;
        },
        error: function(xhr) {
          console.log('Error: loadEntitlementData', xhr);
        },
        complete: function() {
          callback(resp);
        }
      });
    };

    /**
     * Get video by ID
     * @param {string}   Video ID
     * @param {boolean}  Make an async or sync call
     * @param {function} The callback function
     */
    this.getVideoById = function(video_id, async, callback) {
      $.ajax({
        url: this.settingsParams.endpoint + "videos/" + video_id,
        type: 'GET',
        crossDomain: true,
        dataType: 'json',
        context: this,
        cache: false,
        async: async,
        data: {
          "app_key" : this.settingsParams.app_key
        },
        success: function(result) {
          callback(result);
        },
        error: function(xhr) {
          console.log('error', xhr);
        }
      });
    };

    /**
     * Load plans from api
     */
    this.getPlans = function(callback) {
      Plan.getPlans(this.settingsParams, callback);
    };

    // @LEGACY
    this.setcurrentChannel = function(index) {
      this.currentChannel = index;
    };

    this.setCategoryId = function(id) {
      this.settingsParams.category_id = id;
    };

    this.setPlaylistId = function(id) {
      this.settingsParams.playlist_id = id;
    };

    

    /***************************
     *
     * Category Methods
     *
     ***************************/

    /**
     * Hang onto the index of the currently selected category
     * Used for leftNavView
     * @param {Number} index the index into the categories array
     */
    this.setCurrentCategory = function(index) {
      this.currentCategory = index;
    };



    /***************************
     *
     * Content Item Methods
     *
     ***************************/

    /**
     * Get category titles + playlist title
     */
    this.getCategoryItems = function(callback) {
      callback(this.categoryData);
    };


    /**
     * Get Playlist data
     *  
     * @param {string}   playlist id
     * @param {function} the callback function
     */
    this.getPlaylistData = function(playlist_id, callback) {
      this.currData = [];

      $.ajax({
        url: this.settingsParams.endpoint + 'playlists/'+ playlist_id +'/videos',
        data: {
          app_key: this.settingsParams.app_key,
          per_page: 100,
          dpt: true,
          sort: 'priority',
          order: 'desc'
        },
        type: 'GET',
        crossDomain: true,
        dataType: 'json',
        context: this,
        cache: false,
        success: function(res) {
          console.log('getPlaylistData', res);
          var contentData = res;
          this.currData = this.formatVideos(contentData);
        },
        error: function() {
          console.log('getPlaylistData.error', arguments);
        },
        complete: function() {
          console.log('getPlaylistData.complete currData', this.currData);
          callback(this.currData);
        }
      });
    };


    /**
     * Get Entitlement video data recursively
     * 
     * @param {object}   the entitlement data
     * @param {function} the callback function
     * @param {integer}  the starting index 
     * @param {array}    the retrieved video data
     */
    this.getEntitlementData = function(jsonData, callback, counter, videoData) {
      this.currData = [];
      var j = counter || 0;
      var videoData = videoData || [];
      var video_id = (jsonData.response) ? jsonData.response[j].video_id : null;

      if (video_id) {
        // For each video, get video details and save them
        $.ajax({
          url: this.settingsParams.endpoint + "videos/" + video_id,
          type: 'GET',
          crossDomain: true,
          dataType: 'json',
          context: this,
          cache: false,
          data: {
            "app_key" : this.settingsParams.app_key,
            "dpt" : true
          },
          success: function(result) {
            videoData.push(result.response);

            if (j < (jsonData.response.length - 1)) {
              j++;

              return this.getEntitlementData(jsonData, callback, j, videoData);
            }

            this.currData = this.formatVideos(videoData);

            return callback(this.currData);
          },
          error: function(xhr) {
            console.log('error', xhr);
          }
        });
      }
      else {
        return callback(this.currData);
      }
    };

    //  Format Zype videos
    this.formatVideos = function(jsonData) {
      var videos = jsonData.response || jsonData;

      // set up the formatted video array
      // do we want to do it this way, or do we just want to change the variables that are being used down the road (def want to change the variables down the road)
      var formattedVideos = [];

      for (var i = 0; i < videos.length; i++) {
        var args = {
          "id": videos[i]._id,
          "title": videos[i].title,
          "pubDate": videos[i].published_at,
          "thumbURL": this.parse_thumbnails(videos[i]),
          "imgURL": this.parse_thumbnails(videos[i]),
          // parse videoURL at playtime
          "description": videos[i].description,
          "seconds": videos[i].duration,
          "subscription_required": videos[i].subscription_required,
          "rental_required": videos[i].rental_required,
          "purchase_required": videos[i].purchase_required,
          "pass_required": videos[i].pass_required
        };

        var video = new Video(args);
        formattedVideos.push(video);
      }
      // return the formatted video array
      return formattedVideos;
    };

    this.parse_thumbnails = function(video) {
      if (video.images && this.settingsParams.related_images) {
        return utils.makeSSL(video.images[0].url);
      } else {
        for (var i = 0; i < video.thumbnails.length; i++) {
          if (video.thumbnails[i].width > 400) {
            return utils.makeSSL(video.thumbnails[i].url);
          }
        }
      }
    };

    /**
     * Get and return data for a search term
     * @param {string} term to search for
     * @param {Function} searchCallback method to call with returned requested data
     */
    this.getDataFromSearch = function(searchTerm, searchCallback) {
      this.currData = [];

      $.ajax({
        url: this.settingsParams.endpoint + "videos/?app_key=" + this.settingsParams.app_key + "&per_page=100&dpt=true&sort=created_at&order=asc&q=" + searchTerm,
        type: 'GET',
        crossDomain: true,
        dataType: 'json',
        context: this,
        cache: true,
        success: function() {
          var contentData = arguments[0];
          this.currData = this.formatVideos(contentData);
        },
        error: function() {
          console.log(arguments);
          alert("There was a search error. Please try again.");
        },
        complete: function() {
          searchCallback(this.currData);
        }
      });
    };

    /**
     * Store the refrerence to the currently selected content item
     * @param {Number} index the index of the selected item
     */
    this.setCurrentItem = function(index) {
      console.log('setCurrentItem', index);
      this.currentItem = index;
      this.currentItemData = this.currData[index];
    };




    /***************************
     *
     * Utilility Methods
     *
     ***************************/
    /**
     * Sort the data array alphabetically
     * This method is just a simple sorting example - but the
     * data can be sorted in any way that is optimal for your application
     */
    this.sortAlphabetically = function(arr) {
      arr.sort();
    };

    /**
     * Convert unix timestamp to date
     * @param {Number} d unix timestamp
     * @return {Date}
     */
    this.unixTimestampToDate = function(d) {

      var unixTimestamp = new Date(d * 1000);

      var year = unixTimestamp.getFullYear();
      var months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      var month = months[unixTimestamp.getMonth()];
      var date = unixTimestamp.getDate();
      var hour = unixTimestamp.getHours();
      var minute = unixTimestamp.getMinutes();
      var second = unixTimestamp.getSeconds();

      return date + ',' + month + ' ' + year + ' ' + hour + ':' + minute + ':' + second;
    };

  }; // JSONMediaModel

  exports.JSONMediaModel = JSONMediaModel;

})(window);
