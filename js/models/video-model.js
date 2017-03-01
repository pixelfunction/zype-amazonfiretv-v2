/* Model
 *
 * Model for Video
 */

var Video = function(args) {
  this.id = args.id;
  this.title = args.title;
  this.pubDate = args.pubDate || "";
  this.thumbURL = utils.makeSSL(args.thumbURL);
  this.imgURL = utils.makeSSL(args.imgURL);
  this.imgWidth = args.imgWidth;
  this.imgHeight = args.imgHeight;
  this.description = args.description || "";
  this.seconds = args.seconds || "";
  this.subscription_required = args.subscription_required;
  this.rental_required = args.rental_required;
  this.purchase_required = args.purchase_required;
  this.pass_required = args.pass_required;
  this.ad_schedule = [];
  this.video_favorite_id = args.video_favorite_id || null;
};

Video.prototype = {
  constructor: Video,
  hasPaywall: function() {
    return this.subscription_required || this.rental_required || this.purchase_required || this.pass_required;
  }
};
