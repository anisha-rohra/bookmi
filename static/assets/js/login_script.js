// Toggles sign in/create box
$('.login-msg a').click(function () {
	$('form').animate({
		height: "toggle",
		opacity: "toggle"
	}, "slow");
});

// Resize about layer
$('#create').click(function () {
	$('#page-2').css('top', '100px');
})

// Resize about layer
$('#signin').click(function () {
	$('#page-2').css('top', '0px');
})

$('.intro-down').click(function() {
	$('html,body').animate({scrollTop: $(this).offset().top}, 500);
});

$('#intro-return').click(function() {
	$('html,body').animate({scrollTop: 0}, 500);
});

$(window).scroll(function() {

	if($(window).scrollTop() > $(".form").offset().top) {
		$("#intro-return").show();
	}
	if($(window).scrollTop() < $(".form").offset().top) {
		$("#intro-return").hide();
	}
});

function onSignIn(googleUser) {
  var id_token = googleUser.getAuthResponse().id_token;
  // Send token to backend
  $.post("/tokensignin", {idtoken: id_token, _csrf:
		$('meta[name="csrf-token"]').attr('content')}, function (data, status) {
  	window.location.href = data.goto; // Return url to go to
  });
}
