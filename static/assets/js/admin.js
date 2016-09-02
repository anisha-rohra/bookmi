// Get URL vars from https://jquery-howto.blogspot.ca/2009/09/get-url-parameters-values-with-jquery.html

$.extend({
  getUrlVars: function(){
    var vars = [], hash;
    var hashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');
    for(var i = 0; i < hashes.length; i++)
    {
      hash = hashes[i].split('=');
      vars.push(hash[0]);
      vars[hash[0]] = hash[1];
    }
    return vars;
  },
  getUrlVar: function(name){
    return $.getUrlVars()[name];
  }
});

var auth2;
$(document).ready(function() {
	$("#new-msg-form").hide();
    // Google log out api functions

    gapi.load('auth2', initSigninV2);
    function initSigninV2() {
      gapi.auth2.init({
        client_id: '816980302628-7fjmasuvca30gttjarcs4bub7k7t8gtf.apps.googleusercontent.com'
      }).then(function (authInstance) {
        auth2 = gapi.auth2.getAuthInstance();
      });
    }


    $('#logout').click(function (event){
      event.preventDefault();
      signOut();
    });

    $('.search-users').submit(function(event) {
      event.preventDefault();
      var query = "/admin/user?q=" + $('#search-field').val();
      window.location.href = query;
    });
    $('.search-rev').submit(function(event) {
      event.preventDefault();
      var query = "/admin/reviews?search=" + $('#search-field').val();
      window.location.href = query;
    });
    // Review delete js
    $('#del-rev-submit').click(function() {
      $('.del-checked').each(function () {
        if ($(this).is(':checked')) {
          $.ajax({
            url: '/admin/reviews/' + $(this).attr('name'),
            type: 'DELETE',
            data: { '_csrf': $('meta[name=csrf-token]').attr("content")}
          });
        }
      })
      location.reload();
    })
});

// For signout
function signOut() {
  auth2.signOut().then(function () {
    window.location.href = '/signout';
  })
}

if ($.getUrlVar('search')) {
  $('#search-field').val($.getUrlVar('search'));
}
