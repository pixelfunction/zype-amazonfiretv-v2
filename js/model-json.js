/* Model
 *
 * Model for JSON data
 */

(function (exports) {
    "use strict";

    // the model for the Media Sample Data
    // {Object} appSettings are the user-defined settings from the index page
    var JSONMediaModel = function (appSettings) {
         this.mediaData       = [];
         this.categoryData    = ['Featured'];
         this.categoryTitle   = '';
         this.currData = [];
         this.currentCategory = 0;
         this.currentItem     = 0;
         this.defaultTheme    = "default";
         this.currentlySearchData = false;
         this.months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
         this.settingsParams = appSettings;
         this.plans = [];

         this.categoriesData = [];
         this.currentNestedCategory = 0;

         this.zobjectData = [];
         this.sliderData = [];

        /**
         * This function loads the initial data needed to start the app and calls the provided callback with the data when it is fully loaded
         * @param {function} the callback function to call with the loaded data
         */

        this.loadData = function (dataLoadedCallback) {
          // Important to load any plans as the IAP handler will need to have those available.
          var that = this;

          this.getPlans(function(plans) {
            that.plans = plans;
            that.loadCategoryData(dataLoadedCallback);
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
                  thumbnail: data[i].pictures[0].url
                });
              }
            },
            error: function() {
              console.log('loadZObjectData.error');
            },
            complete: function() {
              for (var i = 0; i < this.zobjectData.length; i++) {
                this.loadSliderVideoDetails(this.zobjectData[i].id, this.zobjectData[i].thumbnail);
              }
              callback();
            }
          });
        };

        this.loadSliderVideoDetails = function(video_id, thumbnail) {
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
                "title": video.title,
                "pubDate": video.published_at,
                "thumbURL": thumbnail,
                "imgURL": thumbnail,
                // parse videoURL at playtime
                "description": video.description,
                "seconds": video.duration,
                "subscription_required": video.subscription_required,
                "rental_required": video.rental_required,
                "purchase_required": video.purchase_required,
                "pass_required": video.pass_required
              }
              
              if (args.description == null) {
                  args.description = "";
              }
              
              var video = new Video(args);
              console.log(video);
              this.sliderData.push(video);
            },
            error: function() {
              console.log('loadVideoDetails.error');
            }
          });
        };

        this.loadCategoryData = function(categoryDataLoadedCallback){
          console.log('load.category.data');
          $.ajax({
            url: this.settingsParams.endpoint + "categories/" + this.settingsParams.category_id + "/?app_key=" + this.settingsParams.app_key,
            type: 'GET',
            crossDomain: true,
            dataType: 'json',
            context : this,
            cache : true,
            success:function() {
              var contentData = arguments[0];
              this.getCategoryRowValues(contentData);
              this.getPlaylistTitle();
            },
            error:function() {
              var contentData = {response: {title: 'Videos', values: ['All Videos']}}
              this.getCategoryRowValues(contentData);
              this.getPlaylistTitle();
            },
            complete:function() {
              console.log('loadData.complete');
              this.loadZObjectData(categoryDataLoadedCallback);
              // categoryDataLoadedCallback();
            }
          });
        };

       /**
        * Handles requests that contain json data
        * @param {Object} jsonData data returned from request
        */
        this.getCategoryRowValues = function (jsonData) {
            this.categoryData = jsonData.response.values;
            this.categoryTitle = jsonData.response.title;
         }.bind(this);

         this.getPlaylistRowValue = function(jsonData) {
           var playlistTitle = jsonData.response.title;
           this.categoryData.unshift(playlistTitle);
         }.bind(this);

       /**
        * Load plans from api
        */
        this.getPlans = function(callback) {
          Plan.getPlans(this.settingsParams, callback);
        };

        /**
         * Get the nested categories data
         * @param {function} the callback function
         */
        this.getCategories = function(callback) {

          if (this.categoriesData.length > 0) {
            callback(this.categoriesData);
            return;
          }

          $.ajax({
            url: this.settingsParams.endpoint + "zobjects/?app_key=" + this.settingsParams.app_key + "&zobject_type=channels&per_page=100&sort=priority&order=asc",
            type: 'GET',
            crossDomain: true,
            dataType: 'json',
            context: this,
            cache: true,
            success: function() {
              var contentData = arguments[0].response;
              var formattedCategories = [];
              for (var i = 0; i < contentData.length; i++) {
                var args = {
                  id: contentData[i]._id,
                  title: contentData[i].title,
                  playlist_id: contentData[i].playlist_id,
                  category_id: contentData[i].category_id,
                  description: contentData[i].description
                };
                if (contentData[i].pictures && contentData[i].pictures.length > 0) {
                  args.imgUrl = contentData[i].pictures[0].url;
                }
                var c = new Category(args);
                formattedCategories.push(c)
              }
              this.categoriesData = formattedCategories;
            },
            error: function() {
              console.log(arguments);
            },
            complete: function() {
              console.log('loadData.complete');
              callback(this.categoriesData);
            }
          });
        };

        this.setCurrentNestedCategory = function(index) {
          this.currentNestedCategory = index;
        };

        this.setCategoryId = function(id) {
          this.settingsParams.category_id = id;
        };

        this.setPlaylistId = function(id) {
          this.settingsParams.playlist_id = id;
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
        this.sortAlphabetically = function (arr) {
            arr.sort();
        };

       /**
        * Convert unix timestamp to date
        * @param {Number} d unix timestamp
        * @return {Date}
        */
        this.unixTimestampToDate = function (d) {

            var unixTimestamp = new Date(d*1000);

            var year   = unixTimestamp.getFullYear();
            var month  = this.months[unixTimestamp.getMonth()];
            var date   = unixTimestamp.getDate();
            var hour   = unixTimestamp.getHours();
            var minute = unixTimestamp.getMinutes();
            var second = unixTimestamp.getSeconds();

            return date + ',' + month + ' ' + year + ' ' + hour + ':' + minute + ':' + second ;
        };

       /***************************
        *
        * Media Data Methods
        *
        ***************************/
        /**
         * For single views just send the whole media object
         */
         this.getAllMedia = function () {
             return mediaData;
         },

       /***************************
        *
        * Category Methods
        *
        ***************************/
        /**
         * Hang onto the index of the currently selected category
         * @param {Number} index the index into the categories array
         */
         this.setCurrentCategory = function (index) {
             this.currentCategory = index;
         },

       /***************************
        *
        * Content Item Methods
        *
        ***************************/

        /**
         * Return the category items for the left-nav view
         */
        this.getPlaylistTitle = function() {
          if (this.settingsParams.playlist_id) {
            $.ajax({
              url: this.settingsParams.endpoint + "playlists/" + this.settingsParams.playlist_id + "/?app_key=" + this.settingsParams.app_key,
              type: 'GET',
              crossDomain: true,
              dataType: 'json',
              context: this,
              cache: true,
              async: false,
              success: function() {
                var contentData = arguments[0];
                this.categoryData.unshift(contentData.response.title);
              },
              error: function() {
                this.categoryData.unshift('New Releases');
              }
            });
          }
        };

         /**
          * Get category titles
          */
         this.getCategoryItems = function(callback) {
           callback(this.categoryData);
         };

        /**
         * Get and return data for a selected category
         * @param {Function} categoryCallback method to call with returned requested data
         */
         this.getCategoryData = function (categoryCallback) {
             this.currData = [];
             var categoryValue = this.categoryData[this.currentCategory];
            //  we want to push all the videos with this category value into this.currData()

            if (this.settingsParams.category_id) {
              var category_url = this.settingsParams.endpoint + "videos/?app_key=" + this.settingsParams.app_key + "&category[" + this.categoryTitle + "]=" + categoryValue + "&per_page="+ this.settingsParams.per_page+"&dpt=true&sort=episode&order=asc";
            } else {
              var category_url = this.settingsParams.endpoint + "videos/?app_key=" + this.settingsParams.app_key + "&per_page=25&dpt=true&sort=created_at&order=asc"
            }

            $.ajax({
              url: category_url,
              type: 'GET',
              crossDomain: true,
              dataType: 'json',
              context : this,
              cache: false
            }).fail(function( msg ) {
              console.log( msg );
            }).done(function( msg ) {
              this.currData = this.formatVideos(msg);
            }).always(function() {
              categoryCallback(this.currData);
            });

         };

         this.getPlaylistData = function(categoryCallback) {
           this.currData = [];
           var categoryValue = this.categoryData[this.currentCategory];
          //  we want to push all the videos with this category value into this.currData()

          if (this.settingsParams.playlist_id) {
            var playlist_url = this.settingsParams.endpoint + "playlists/" + this.settingsParams.playlist_id + "/videos/?app_key=" + this.settingsParams.app_key;
          } else {
            var playlist_url = this.settingsParams.endpoint + "videos/?app_key=" + this.settingsParams.app_key + "&per_page=10&dpt=true&sort=created_at&order=desc"
          }

          $.ajax({
              url: playlist_url,
              type: 'GET',
              crossDomain: true,
              dataType: 'json',
              context : this,
              cache : true,
              success:function() {
                var contentData = arguments[0];
                this.currData = this.formatVideos(contentData);
              },
              error:function() {
                  console.log(arguments);
              },
              complete:function() {
                categoryCallback(this.currData);
              }
          });
         }

        //  Format Zype videos
        this.formatVideos = function(jsonData) {
          var videos = jsonData.response;
          // set up the formatted video array
          // do we want to do it this way, or do we just want to change the variables that are being used down the road (def want to change the variables down the road)
          var formattedVideos = [];

          for (var i=0; i < videos.length; i++) {
            var args = {
                "id": videos[i]._id,
                "title": videos[i].title,
                "pubDate": videos[i].published_at,
                "thumbURL": this.parse_thumbnails(videos[i].thumbnails),
                "imgURL": this.parse_thumbnails(videos[i].thumbnails),
                // parse videoURL at playtime
                "description": videos[i].description,
                "seconds": videos[i].duration,
                "subscription_required": videos[i].subscription_required,
                "rental_required": videos[i].rental_required,
                "purchase_required": videos[i].purchase_required,
                "pass_required": videos[i].pass_required
              };
            if (args.description == null) {
              args.description = "";
            }
              
              
            var video = new Video(args);
            formattedVideos.push(video)
          }
          // return the formatted video array
          return formattedVideos;
        }

        this.parse_thumbnails = function (thumbnails) {
          for(var i=0; i < thumbnails.length; i++) {
            if (thumbnails[i].width > 400) {
              return thumbnails[i].url;
            }
          }
        }

        /**
         * Get and return data for a search term
         * @param {string} term to search for
         * @param {Function} searchCallback method to call with returned requested data
         */
         this.getDataFromSearch = function (searchTerm, searchCallback) {
           this.currData = [];

           $.ajax({
             url: this.settingsParams.endpoint + "videos/?app_key=" + this.settingsParams.app_key + "&per_page=100&dpt=true&sort=created_at&order=asc&q=" + searchTerm,
             type: 'GET',
             crossDomain: true,
             dataType: 'json',
             context : this,
             cache : true,
             success:function() {
               var contentData = arguments[0];
               this.currData = this.formatVideos(contentData);
             },
             error:function() {
                 console.log(arguments);
             },
             complete:function() {
               searchCallback(this.currData);
             }
           })
         };

       /**
        * Store the refrerence to the currently selected content item
        * @param {Number} index the index of the selected item
        */
        this.setCurrentItem = function (index) {
          this.currentItem = index;
          this.currentItemData = this.currData[index];
        }

    };

    exports.JSONMediaModel = JSONMediaModel;

})(window);
