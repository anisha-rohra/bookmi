// Used for book_review.html to show stars

var filled = "/assets/images/filled_star.png";
var empty = "/assets/images/star.png"
$(document).ready(function() {

	$('form').hover(function() {
		var id = $(this).attr('id');

    $('.star-rev' + id).click(function () {
        var alt = $(this).attr("alt");
				$('#rev-rating' + id).val(alt);
        changeStars(5, empty, id);
        changeStars(alt, filled, id);
    });

	});

  // Change star up to and including num to link
  function changeStars(num, link, id) {
      for (var i = 0; i <= 5; i++) {
          if (i <= num) {
              $("#star" + i + "-" + id).attr("src", link);
          }
      }
  }
});
