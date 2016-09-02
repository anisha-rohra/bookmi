// Used for other_profile.html review display

$(document).ready(function() {

  var total = $('#div-profile').attr('alt');

  // Shows the number of filled stars
  for (var i = 0; i < total; i++) {
    $('#div-profile').append('<img class="profile-stars" src="/assets/images/filled_star.png">');
  }

  // Shows the number of empty stars
  for (var i = total; i < 5; i++) {
    $('#div-profile').append('<img class="profile-stars" src="/assets/images/star.png">');
  }

  // For every div in the ratings section, append the number of stars
  $('.ratings').each(function() {

    var number = $(this).attr('alt');
    for (var i = 0; i < number; i++) {
      $(this).append('<img class="profile-stars" src="/assets/images/filled_star.png">');
    }

    for (var i = number; i < 5; i++) {
      $(this).append('<img class="profile-stars" src="/assets/images/star.png">');
    }

  });

});
