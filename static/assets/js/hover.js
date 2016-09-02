$(document).ready(function() {
	$('#hover-overlay').hide();
	$(document).on('mousemove', function (e) {
		$('#hover-overlay').css('left', e.pageX + 5);
		$('#hover-overlay').css('top', e.pageY + 5);
	});
})


$(".book-hover-container").on("mouseenter", '.list-book-option', function(event){
	var isbn = $(this).attr("id").substring(3);
	var elem = '#hover-' + isbn + ' ';
	var title = $(elem + '.title').html();
	var author = $(elem + '.author').html();

	$('#hover-overlay-title').html(title);
	$('#hover-overlay-author').html('By: ' + author);
	$('#hover-overlay').show()

}).on("mouseleave", function(event){
	$('#hover-overlay-title').html('');
	$('#hover-overlay-author').html('');
	$('#hover-overlay').hide();
});