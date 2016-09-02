var auth2;

$(document).ready(function() {
    adjustNav();
    $("#new-msg-form").hide();
    $(".reply-form").hide();
    $('.users-chosen').hide();

    // Google log out api functions
    gapi.load('auth2', initSigninV2);
    function initSigninV2() {
        gapi.auth2.init({
            client_id: '816980302628-7fjmasuvca30gttjarcs4bub7k7t8gtf.apps.googleusercontent.com'
        }).then(function (authInstance) {
        auth2 = gapi.auth2.getAuthInstance();
    });
    }

    // Update inbox notification for number of unread messages
    $.ajax(
    {
        url: "/inbox-notifications",
        type: "GET",
        dataType: "text"
    })
    .done(function( data )
    {
        $('#inbox').text("Inbox ("+ data + ")");
    })
    .fail(function( jqXHR, textStatus )
    {
        alert( "Request failed: " + textStatus );
    });

    // Update request notification for number of requests pending
    $.ajax(
    {
        url: "/request-notifications",
        type: "GET",
        dataType: "text"
    })
    .done(function( data )
    {
        $('#requests').text("Requests ("+ data + ")");
    })
    .fail(function( jqXHR, textStatus )
    {
        alert( "Request failed: " + textStatus );
    });


    /*$(".list-users").hover(

        function() {
            var user = $(this).attr('alt');
            $('#' + user).show();
        },

        function() {
            var user = $(this).attr('alt');
            $('#' + user).hide();
        }
    );*/
    $('#logout-button').click(function (event){
        event.preventDefault();
        signOut();
    });
});

// For signout
function signOut() {
  auth2.signOut().then(function () {
    window.location.href = '/signout';
    });
}



// Gets books from google books API that matches the title
// and author a user searches when adding a book to their swap list
$("#swap-book-search").click(function() {
    $.ajax(
    {
        url: "https://www.googleapis.com/books/v1/volumes?q="
        + $('#swap-title').val()+ "+" + $('#swap-author').val(),
        type: "GET",
        dataType: "text"
    })
    .done(function( data )
    {
        listsSearch(data, '#swap-container');
        $('#swap-container').append("<input type='hidden' name='book' " +
        "id='list-chosen'>");
        $('#swap-container').append("<label id='condition-label' " +
        "for='condition-select'>Condition: </label>")
        var $condition = $('<select/>', {
            name: "condition",
            id: "condition-select"
        });
        $condition.append("<option value='excellent'>excellent</option>");
        $condition.append("<option value='fair'>fair</option>");
        $condition.append("<option value='poor'>poor</option>");
        $('#swap-container').append($condition);
        $('#swap-container').append("<input type='text' name='conDetails' " +
        "id='con-details' placeholder='Details about the condition' maxlength='140'>");
        //$('#swap-container').append("<input type='text' name='condition' placeholder='Condition'>");
        $('#swap-container').append("<input type='submit' value='Submit' class='submit-chosen'>");
    })
    .fail(function( jqXHR, textStatus )
    {
        alert( "Request failed: " + textStatus );
    });
});

// Parses through a JSON string of books (data) returned from the Google Books
// API to add a radio button for each book, onto the specified container.
// This is a helper function for adding books to a swap/exchange list.
function listsSearch(data, container) {
    var obj = JSON.parse(data);
    $(container).empty();
    $(container).append("<small>Tip: Click on checkmark to select book." +
    " Click on book to read more about it.</small><br>");
    obj.items.forEach(function(item){
        var hasISBN = false;
        var identifier = "#";
        if (item.volumeInfo.industryIdentifiers) {
            item.volumeInfo.industryIdentifiers.forEach(function( isbn ) {
                if (isbn.type == "ISBN_13") {
                        //console.log(isbn.identifier);
                        identifier = isbn.identifier;
                        hasISBN = true;
                    } else if (!hasISBN && isbn.type == "ISBN_10") {
                        // no ISBN_13!!!
                        identifier = isbn.identifier;
                    }
                });
        }

        if (identifier != "#") {
            //$(container).append( "<input type='radio' name='book' value="+ identifier + ">");

            // Get thumbnail of book
            var thumbnail;
            var author = '';
            if (item.volumeInfo.authors != undefined) {
                author = item.volumeInfo.authors[0];
            }
            if (item.volumeInfo.imageLinks && item.volumeInfo.imageLinks.thumbnail) {
                thumbnail = item.volumeInfo.imageLinks.thumbnail;
            } else {
                thumbnail = "/assets/images/placeholder_book.png";
            // use a placeholder thumbnail
            }
            //$(container).append( "<img src=" + thumbnail + "><br>");
            var $link = $('<a/>', {
                href: "/books/" + identifier
            });

            var $image = $('<img/>', {
                src: thumbnail,
                class: "book-thumbnail book-hover",
            });

            $link.append($image);
            var $div = $('<div/>', {
                class: "list-book-option",
                id: "div" + identifier
            });

            var $hidden = $('<div/>', {
                class: "hidden",
                style: "display: none;",
                id: 'hover-' + identifier
            })
            var $author = $('<p/>', {
                class: "author",
                html: author
            })

            var $title = $('<p/>', {
                class: "title",
                html: item.volumeInfo.title
            })
            $hidden.append($author);
            $hidden.append($title);
            $(container).append($div);
            $(container).append($hidden);
            $div.append($link);

            $div.append("<button type='button' id=" + identifier +
            " class='swap-option-button list-not-chosen'>&#10003</button>");
        }
    });

    $('.swap-option-button').click(function () {
        $('#'+ this.id).removeClass("list-not-chosen");
        $('.swap-option-button').not(this).addClass("list-not-chosen");
        $('#list-chosen').val(this.id);
    });
}


// Gets books from google books API that matches the title
// and author a user searches when adding a book to their wishlist
$("#wish-book-search").click(function() {
    $.ajax(
    {
        url: "https://www.googleapis.com/books/v1/volumes?q="
        + $('#wish-title').val()+ "+" + $('#wish-author').val(),
        type: "GET",
        dataType: "text"
    })
    .done(function( data )
    {
        listsSearch(data, '#wish-container');
        $('#wish-container').append("<input type='hidden' name='book' id='list-chosen'>");
        $('#wish-container').append("<input type='submit' value='Submit' class='wish-chosen'>");
    })
    .fail(function( jqXHR, textStatus )
    {
        alert( "Request failed: " + textStatus );
    });
});

// Displays the form for writing a new message
$( "#new-msg-button" ).click(function() {
    $("#new-msg-form").show();
});

// Displays the form to reply to a particular message
$( ".reply-button" ).click(function() {
    var id = "#form-" + this.id;
    $(id).show();
});

/*
 * Changes how the navigation menu is displayed. If the window is <= 768,
 * show a menu button that can be clicked to toggle the visibility of the
 * navigation menu. Otherwise, the button will be hidden and the navigation
 * menu will be displayed.
 */
function adjustNav() {
    if ( $(window).width() <= 1024 ) {
        $("#menu").addClass("smallnav");
        $('#menu-button').removeClass("hide").addClass("show");
    } else {
        $("#menu").removeClass("smallnav");
        $("#menu-button").removeClass("show").addClass("hide");
    }
}

/*
 * Toggle the menu to show/hide when the menu button is clicked
 */
$( "#menu-button" ).click(function() {
    $("#menu ul").toggleClass("open");
    $("#menu").toggleClass("scroll-nav");
});

/*
 * When the size of the window changes, call adjustNav to see if we
 * need to change how the menu is displayed.
 */
$(window).resize(function() {
    adjustNav();
});

/*
 * For selecting books for requests on a user's profile.
 * Makes sure only one book from the Owns List can be selected.
 */
$('.own-option-button').click(function () {
    $('#'+ this.id).removeClass("list-not-chosen");
    $('.own-option-button').not(this).addClass("list-not-chosen");
    $('#own-chosen').val(this.id);
 });

/*
 * For selecting books for requests on a user's profile.
 * Makes sure only one book from the Wish List can be selected.
 */
$('.wish-option-button').click(function () {
    $('#'+ this.id).removeClass("list-not-chosen");
    $('.wish-option-button').not(this).addClass("list-not-chosen");
    $('#want-chosen').val(this.id);
 });
