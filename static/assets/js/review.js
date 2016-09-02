var filled = "/assets/images/filled_star.png";
var empty = "/assets/images/star.png"
var review_set = false;
$(document).ready(function() {
    // Hide review form
	$('#book-review').hide();

    // Unhide reviews when stars are clicked
    $('.star-rev').click(function () {
        $('#book-review').show();
        var alt = $(this).attr("alt");
        $('#rev-rating').val(alt);
        changeStars(5, empty);
        changeStars(alt, filled);
        review_set = true;
    });

    //
    $('.star-rev').hover(
        function() {
            if (!review_set){
                var alt = $(this).attr("alt");
                changeStars(alt, filled);
            }
        }, 
        function() {
            if (!review_set){
                var alt = $(this).attr("alt");
                changeStars(alt, empty);
            }
        });

    // Change star up to and including num to link
    function changeStars(num, link) {
        for (var i = 0; i <= 5; i++) {
            if (i <= num) {
                $("#star-" + i).attr("src", link);
            }
        }
    }
});
    



