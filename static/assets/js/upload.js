var d = new Date();
// Parse and post file

$("document").ready(function(){
  var label = $('#upload-input').text();
  var valid_upload = false;
  $('input[type=file]').change(function () {
    var file = this.files[0];
    var type = file.type;
    // If file selected is not an image
    if (type.indexOf("image/") != 0) {
      $('p.err').html("Please select an image file.");
      $('p.err').show();
      $('#submit-upload').hide();
    // If file is too big
  } else if (file.size > 5000000) {
    $('p.err').html("File is too big. Please select a smaller one.");
    $('#submit-upload').hide();
  } else {
      // Removes C:/fakepath
      var filename = $('input[type=file]').val().split('\\').pop();
    }
    // Let's truncate it if it's too big
    if (filename && filename.length > 25) {
      filename = truncate(filename, 25, '...');
    }
    if (filename) {
      $('#upload-input').text(filename);
      $('#submit-upload').show();
      $('p.err').hide();
    } else {
      $('#upload-input').text(label);
      $('#submit-upload').hide();
      $('p.err').hide();
    }
  });
  // Attach our own AJAX submit function instead of default
  $('#dispPicForm').on('submit', function (event) {
    event.stopPropagation();
    event.preventDefault();
    // Grabs the first file present, should only be one
    var file_data = $('#image-upload')[0].files[0];
    if (file_data) {
      var data = new FormData();
      data.append('image', file_data);
      data.append('_csrf', $('meta[name="csrf-token"]').attr('content'));
    }
    $.ajax({
      url: '/upload?&id=' + $('#user_id').val() + '&_csrf=' +
      $('meta[name="csrf-token"]').attr('content'),
      type: 'POST',
      data: data,
      cache: false,
      dataType: 'json',
      processData: false, // Don't process the files
      contentType: false, // Set content type to false as jQuery will tell the
                          // server its a query string request
      xhr: function() {  // Custom XMLHttpRequest for progress bar
        var myXhr = $.ajaxSettings.xhr();
        if(myXhr.upload){ // Check if upload property exists
          myXhr.upload.addEventListener('progress',progressHandlingFunction, false);
          // For handling the progress of the upload
        }
        // Open first, before setting the request headers.
        // myXhr.open(myXhr.method, myXhr.url, true);
        // myXhr.setRequestHeader('csrf-token', $('meta[name="csrf-token"]').attr('content'));
        return myXhr;
      },
      beforeSend: function () {
        // Disable elements and show progress bar
        $('#upload-input').hide();
        $('#submit-upload').hide();
        $('p.err').hide();
        $('progress').show();
      },
      success: function(data) {
        console.log(data)
        // Return to default
        $('#upload-input').text(label);
        $('progress').hide();
        $('#upload-input').show();
        $('#submit-upload').hide();
        $('p.err').html(data.result);
        if (data.success) {
          d = new Date();
          // Refresh the image
          $('#profile-pic').attr("src", data.link + "?" + d.getMilliseconds());
        }
        $('p.err').show();
      },
      error: function (res) {
        console.log("Response failed: " + res);
        console.log(res)
      }
    });
  });
})
// Truncates string to length with sep in the middle
var truncate = function (str, len, sep) {
  if (str.length <= len) {
    return str;
  }

  sep = sep || '...';
  var sep_len = sep.length;
  var char_len = len - sep.length;
  var front_len = Math.ceil(char_len/2);
  var back_len = Math.floor(char_len/2);

  return(str.substr(0, front_len) + sep + str.substr(str.length - back_len));
}

// Helper for progress bar
function progressHandlingFunction(e){
  if(e.lengthComputable){
    $('progress').attr({value:e.loaded,max:e.total});
  }
}
