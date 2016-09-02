var http = require('http');
var fs = require('fs');
var path = require('path');
var pg = require('pg');
var session = require('express-session');
var bcrypt = require('bcryptjs'); // For password encryption
var nunjucks = require('nunjucks'); // For templating
var request = require('request');
var async = require('async');
var cookieParser = require('cookie-parser');
var csrf = require('csurf');
var express = require('express');
var validator = require('validator');
var bodyParser = require('body-parser'); // Parsing forms req.body...
var multer = require('multer'); // For image upload
var compress = require('compression') // Faster loading

const readChunk = require('read-chunk'); // both used to read file type
const fileType = require('file-type');

var app = express();
app.use(compress());
var admin_app = require ('./admin');

//var googleKey ='AIzaSyBvPUwZhzKRoBkvNqX6GPTSAyDpeV797Rs';
var googleKey = 'AIzaSyDd-Jiz5EX3lj8xePw8Copf3EWs63RMOY0';
//var googleKey = 'AIzaSyDyes6z_WmYjvn5l201uoBV9qTUemOgb-E';

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({
	extended: true
}));

// For uploading file
var upload = multer({ dest: 'uploads/' })

// Serve static html files from views folder
app.use(express.static('static', {
	maxAge: 86400000
}));

// Keep track of sessions
app.use(session({
	secret: 'hello this is a secret message',
	resave: false,
	saveUninitialized: false,
}));

app.use(csrf());

// Passes session through to view
// Pass csrf through to view
app.use(function(req,res,next){
	res.locals.csrfToken = req.csrfToken();
	res.locals.session = req.session;
	if (!req.session.errors) {req.session.errors = []};
	next();
});

// Get uploads
var type = upload.single('image');
app.post('/upload', type, function (req, res, next) {
	var uid = req.query.id; // File types accepted
	var types = ["jpg", "jpeg", "png", "bmp", "gif", "tif", "webp"];
	// Send back result and link to image if successful
	var ret = { success: false, result: "", link: null };
	// Verify that user is not trying to post to another user's profile
	if (!req.file) {
		ret.result = "File not uploaded, try again.";
		return res.json(ret);
	} else if (req.file.size > 5242880) { // 5MB
		ret.result = "File is too large, please use a smaller image.";
		fs.unlink(file_sys, function (err) {if (err) console.log("Unlink err: " + err)});
		return res.json(ret);
	} else {
		var sys_path = __dirname + "/static";
		// File location on system
		var file_sys = __dirname + '/' + req.file.path;
		if (uid != req.session.userid && !req.session.admin) {
			ret.result = "You cannot change another user's profile.";
			fs.unlink(file_sys, function (err) { if (err) console.log("Unlink err: " + err)});
			return res.json(ret);
		}
		// Verify that the file is an image we'll just read 50 bits to confirm
		// Increase number if images not recognized
		const buffer = readChunk.sync(req.file.path, 0, 262);
		var ft = fileType(buffer);
		// Check for null buffer
		if (ft == null) {
			ret.result = "File unrecognized, try another.";
			fs.unlink(file_sys, function (err) { if (err) console.log("Unlink err: " + err)});
			return res.json(ret);
		}
		var ext = ft.ext;
		var html_path = "/assets/images/profile/" + uid + "." + ext;
		sys_path = sys_path + html_path ;
		// Move file
		fs.rename(__dirname + '/' + req.file.path, sys_path, function (err) {
			if (err) {
				console.log("Error moving file: " + err);
				ret.result = "File not uploaded, try again";
				fs.unlink(file_sys, function (err) {
					if (err) {
						console.log("Unlink err: " + err);
					}
				});
				return res.json(ret);
			} else {
				// Need to query database to get and delete old file
				client.query('SELECT profile_pic FROM "Users" WHERE id=$1', [uid],
					function(err, qres) {
						if (err || qres.rows.length != 1) {
							console.log("Database select error: " + err);
						}
						// Remove old file if it exists or is not the new file
						if (qres.rows[0].profile_pic && qres.rows[0].profile_pic != html_path) {
							fs.unlink(__dirname + "/static/" + qres.rows[0].profile_pic, function (err) {
								if (err) {
									console.log("Unlink err: " + err);
								}
							});
						}
						client.query('UPDATE "Users" SET profile_pic=$1 WHERE id=$2',
							[html_path, uid], function (err) {
								if (err) {
									console.log("Database update error: " + err);
									ret.result = "Database error."
									fs.unlink(sys_path, function (err) { if (err) console.log("Unlink err: " + err)});
									return res.json(ret);
								} else {
									ret.success = true;
									ret.result = "Picture updated.";
									ret.link = html_path;
									return res.json(ret);
								}
							});
					});
			}
		});
	}
});

app.use('/admin', admin_app);

// Establish database connection
pg.defaults.ssl = true; //always keep true!!!
var conString = "postgres://ujjikxvfoeetmy:9cebcbMX6DYH_S6LvM0sm6utUs@ec2-54-243-47-83.compute-1.amazonaws.com:5432/d2jl3gj15vn53e";
client = new pg.Client(conString);
client.connect(function(err) {
	//error
	if (err) {
		return console.error('could not connect to postgres', err);
	}
});

// Configure nunjucks to find html in views folder, escape dangerous chars in html
nunjucks.configure('views', {
	autoescape: true,
	express   : app
});

// Sign in request
app.post('/signin', function (req, res) {
	var redirect;
	if (!req.query.redirect) {
		redirect = '/';
	} else {
		redirect = req.query.redirect;
	}
	// Use pg prepared query to prevent sql injection
	var username = [req.body.username];
	if (username.length > 20) {
		res.render("signin.html", {
			error: "Username or password is not correct",
			title: "Bookmi Login"});
		return;
	}
	var query = 'SELECT * FROM "Users" WHERE "username" = $1;';
	client.query(query, username, function (err, qres) {
		if (err) {
			return console.log("error running query", err);
		} else if (qres.rows.length === 1 && bcrypt.compareSync(req.body.password,
			qres.rows[0].password)) {
			// Successful sign in - save session data
			req.session.username = qres.rows[0].username;
			req.session.userid = qres.rows[0].id;
			req.session.admin = qres.rows[0].user_type === "admin";
			req.session.errors = [];
			res.redirect(redirect);
		} else {
			res.render("signin.html", {
				error: "Username or password is not correct",
				title: "Bookmi Login"});
		}
	});
});

// Process google sign in
app.post('/tokensignin', function (req, res) {
	// We make a request to the google endpoint to check validity
	request("https://www.googleapis.com/oauth2/v3/tokeninfo?id_token=" + req.body.idtoken,
		function (rreq, rres, err) {
			// Successful xauthentication
			if (rres.statusCode == 200) {
				// Need to parse json string
				var u = JSON.parse(rres.body);
				// Check if email is already in use
				client.query('SELECT * FROM "Users" WHERE email = $1;', [u.email],
				function (err, qres) {
					if (err) {
						console.log("Database error: " + err);
					} else if (qres.rows.length == 0) {
						// Create new user using a helper to get the username, store return
						// from google in session temporarily.
						req.session.third_party = {
							'firstname': u.given_name,
							'lastname': u.family_name,
							'email': u.email,
							'profile_pic': u.picture
						};
						res.json({'goto': '/welcome'})
					} else {
						// Sign in user
						req.session.userid = qres.rows[0].id;
						req.session.username = qres.rows[0].username;
						res.json({'goto': '/'})
					}
				});
			}
		}
		);
});

// Helper for google login if user does not already exist
app.get('/welcome', function (req, res) {
	// Verify if user has gone through google auth
	if (req.session.third_party) {
		res.render('third_party_signin.html');
	} else {
		res.redirect('/');
	}
});

app.post('/welcome', function (req, res) {
	// Verify if user has gone through google auth
	if (!req.session.third_party) {
		res.redirect('/');
		return;
	}
	// Check if username is taken
	client.query('SELECT * FROM "Users" WHERE "username"=$1;', [req.body.username],
	function (err, qres) {
		if (err) {
			cosole.log("Database error: " + err);
			res.render('third_party_signin.html', {err: "Database error, please try again."});
		} else if (qres.rows.length > 0) {
			res.render('third_party_signin.html', {err: "Username is taken, please try again"});
		} else {
			var u = req.session.third_party;
			// Just using a random hash of a random password:
			// 3r34345gt45t4r23rerg!@31234r234r23$!@#!@312312334123#$#$
			// TODO: make changes to db or randomize this..?
			var hash = "$2a$06$AI8K0UJOfIGEzFjQ8TuMY.bgd5HgVJux4UKOtn7sxnLMy2sEa9Ej2";
			// Make sure and sign in
			client.query('INSERT INTO "Users" (firstname, lastname, username, ' +
			'password, email, user_type, age, gender, location, profile_pic, created) ' +
			'VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, current_date) RETURNING id;',
				[u.firstname, u.lastname, req.body.username, hash, u.email, "user", 0, "-",
				"Unk", u.profile_pic], function(err, qres) {
					if (err || qres.rows[0] == undefined) {
						console.log("Database error inserting: " + err);
					} else {
						req.session.id = qres.rows[0].id;
						req.session.username = req.body.username;
						res.redirect('/');
					}
				})
		};
	});
})

// Sign up function
app.post('/signup', function (req, res) {
	// Check if user is already signed in
	if (req.session.username !== undefined) {
		res.redirect('/');
		return;
	}

	// TODO: Restrict and verify this info
	var username = req.body.reg_username;
	var first_name = req.body.first_name;
	var last_name = req.body.last_name;
	var password = req.body.reg_password;
	var email = req.body.reg_email;

	//Save error msg to return
	var err_msg = "";

	// Truncate names if too long
	if (first_name.length > 30) {
		first_name = first_name.substring(0, 30);
	}
	if (last_name.length > 30) {
		last_name = last_name.substring(0, 30);
	}

	// Verify that password exiss
	if (password.length < 8) {
		err_msg = "Passwords must be minimum 8 characters.";
		res.render("signin.html", {
			error: err_msg,
			title: "Bookmi Login"
		});
	// Verify sign up information
} else if (password != req.body.reg_pwd_confirm) {
	err_msg = "Passwords did not match.";
	res.render("signin.html", {
		error: err_msg,
		title: "Bookmi Login"
	});
} else if (username.length > 20) {
	err_msg = "Username is too long. Max 20 characters.";
	res.render("signin.html", {
		error: err_msg,
		title: "Bookmi Login"
	});
} else if (!validator.isEmail(email) || email.length > 30) {
	err_msg = "Email is not valid";
	res.render("signin.html", {
		error: err_msg,
		title: "Bookmi Login"
	});
} else if (first_name.length == 0 || last_name.length == 0) {
	err_msg = "Please enter your name";
	res.render("signin.html", {
		error: err_msg,
		title: "Bookmi Login"
	});
} else {
		// Check database for user
		var rows = 0;
		client.query('SELECT * FROM "Users" WHERE "username" = $1 OR "email" = $2;',
		[username, email], function (err, qres) {
			if (err) {
				return console.log("error running query", err);
				err_msg = "Database error, please try again later.";
			} else if (qres.rows.length != 0) {
				// User name exists already
				err_msg = "Username or email already exists.";
				res.render("signin.html", {
					error: err_msg,
					title: "Bookmi Login"
				});
			} else {

				async.parallel([
					function(callback) {
				    	var hash = bcrypt.hashSync(password, 10); // Generate hash using pwd and x iterations for salt
				        // TODO: Change gender to - and location to something else later
				        client.query('INSERT INTO "Users" (firstname, lastname, ' +
								'username, password, email, user_type, age, gender, location) ' +
								'VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id;',
				        	[first_name, last_name, username, hash, email, "user", 0, "-", "Unknown"],
									function(err, result) {
				        		if (err) {
				        			console.log(err);
				        			err_msg = "Database error, please try again later.";
				        			res.render("signin.html", {
				        				error: err_msg,
				        				title: "Bookmi Login"
				        			});
				        		} else {
				        			req.session.username = username;
				        			req.session.errors = [];
				        			callback();

				        		}
				        	});
				    }
				    ], function(err) {
						// Save userid of new user, after finishing insert
						// Can actually just call RETURN, fix later TODO
						var query = 'SELECT * FROM "Users" WHERE "username" = $1;';
						client.query(query, [req.session.username], function (err, qres) {
							if (err) {
								return console.log("error running query", err);
							} else {
								req.session.userid = qres.rows[0].id;
								res.render("about.html", {title: "About Bookmi"})
							}
						});
					});
			}
		});
	}
});

// Send user to about if signed in, login page if not
app.get('/', function (req, res) {
	if (req.session.username !== undefined) {
		//res.redirect('/recommendations');
		res.redirect('/recommendations');
	} else {
		res.render('signin.html', {title: 'Bookmi'});
	}
});

// Sign out function
app.all('/signout', function (req, res) {
	req.session.destroy();
	res.redirect('/');
});

//Forces user to login
app.get("/*", function(req, res, next) {
	if (req.session.username !== undefined || req.url === '/') {
		next();
	} else {
		req.session.redirect = req.url;
		res.redirect('/');
	}
})

// About page
app.get('/about', function (req, res) {
	res.render('about.html', {title: 'About Bookmi'});
});

// Recommendations (main user page)
function getRecForUser (user, callback) {
	// Randomly find a book owned/wished by the user
	if (!user) {
		callback(null, null);
	}
	// Get one book from lists
	getBookOwnedWished(user, function(book) {
		if (book) {
			// Get book details book.book
			reqByISBN(book.book, function(book) {
				if (book && book.totalItems > 0) {
					// Get info for book
					book.items[0].volumeInfo.pic = getBookPic(book.items[0].volumeInfo);
					book.items[0].volumeInfo.ISBN = getISBN(book.items[0]);
					//console.log(book.items[0].volumeInfo)
					// Get category and search for more books
					try {
						getRecommendations(book.items[0].volumeInfo.categories[0], true, function(books) {
							if (!books) {
								callback(null, null);
							}
						// Get books pictures and isbn for books
						for (var i = 0; i < books.length; i++) {
							books[i].volumeInfo.pic = getBookPic(books[i].volumeInfo);
							books[i].volumeInfo.ISBN = getISBN(books[i]);
						}
						callback(book, books);
					})
					} catch (err) {
						callback(null, null);
					}

				} else {
					callback(null, null);
				}
			});
		} else {
			// Display error
			callback(null, null);
		}
	});
}

// Given an user id, searches in the Owns and Wishes table and randomly returns one book.
function getBookOwnedWished(uid, callback) {
	var book = null;
	client.query('SELECT "book" FROM "Owns" WHERE "user"=$1 UNION SELECT "book"' +
	' FROM "Wishes" WHERE "user"=$1',
		[uid], function (err, qres) {
			if (err) {
				console.log("Error querying database.");
				console.log(err);
				callback(book); // null
			}
			var ind = Math.floor(Math.random() * qres.rows.length);
			callback(qres.rows[ind]);
			return;
		});
}

// Given a book item from google's API, gets recommendations
function getRecommendations(category, withSubject, callback) {
	if (!category) {callback(null)}; // Just using the first category
	if (withSubject) {
		var query = 'subject:' + '' + category + '' + '&maxResults=40'
	} else {
		var query = category + '&maxResults=40'
	}
	reqBook(query, function(books) { // Get up to 40 items
		if (books) {
			var bookCount = books.totalItems; // Get total items
			if ((!books || bookCount < 10) && withSubject == true) {
				// We should try to search without subject due to google api error
				getRecommendations(category, false, function(books) {
					callback(books);
				})

			} else if (bookCount <= 10) { // If we have 5 or less, just return the items
				callback(books.items);

			} else {
				// Randomly get elements from the results
				var items = filterISBN(books.items);
				var itemsCount = items.length;
				var ret = [];
				var index;
				// Keep going until we have 5 items
				while (ret.length < 10) {
					// Check if we still have items left in books
					if (items.length == 0) {break;}
					index = Math.floor(Math.random() * itemsCount);
					// Check if book is in category and add to return
					if (items[index].volumeInfo.categories != undefined &&
						items[index].volumeInfo.categories[0] == category) {
						ret.push(items[index]);
					items.splice(index, 1);
				} else {
					items.splice(index, 1);
				}
				itemsCount -= 1;
			}
			callback(ret);
		}
	} else {
			// Error occured
			callback(null);
		}
	});
}

// Given an array of books, filters the books by only those with ISBNs
function filterISBN(books) {
	if (!books) {return null};
	var isbn;
	for (var i = 0; i < books.length; ) {
		isbn = getISBN(books[i]);
		if (getISBN(books[i]) == -1) {
			books.splice(i, 1); // Remove book without isbn
		} else {
			i++;
		}
	}
	return books;
}

app.get('/recommendations', function(req, res) {
	var query = 'SELECT * FROM (SELECT username, \'own\' AS "action", own_date AS "date", \'-\' ' +
	'AS "participant", book as "book", \'-\' AS "message" FROM "Users", "Owns" ' +
	'WHERE "Users".id = "Owns".user UNION SELECT username, \'wish\' AS "action", ' +
	'wish_date AS "date", \'-\' AS "participant", book as "book", \'-\' AS "message" ' +
	'FROM "Users", "Wishes" WHERE "Users".id = "Wishes".user UNION SELECT ' +
	'username, \'comment\' AS "action", comment_date AS "date", \'-\' AS ' +
	'"participant", book as "book", message AS "message" FROM "Users", ' +
	'"Comments" WHERE "Users".id = "Comments".user UNION SELECT "Users1".username ' +
	'as "user", \'exchange\' as "action", date_exchange as "date", ' +
	'"Users2".username as "participant", want_book as "book", \'-\' as "message" ' +
	'FROM (SELECT id as ex1_id, requestor as ex1_requestor, requested as '+
	'ex1_requested, want_book,date_exchange FROM "Exchanges" WHERE ' +
	'status_requestor = \'completed\' OR status_requestor = \'rated\' OR ' +
	'status_requested = \'rated\') as t1, (SELECT id as ex2_id, requestor ' +
	'as ex2_requestor, requested as ex2_requested FROM "Exchanges") as t2, ' +
	'"Users" as "Users1", "Users" as "Users2" WHERE ex1_id = ex2_id AND ' +
	'(ex1_requestor = "Users1".id AND ex2_requested = "Users2".id) UNION ' +
	'SELECT sender as "user", \'follow\' as "action", follow_date as "date", ' +
	'recip as "participant", \'-\' as "book", \'-\' as message FROM (SELECT ' +
	'username as sender, sender as f1_sender, recipient as f1_recipient, ' +
	'follow_date FROM "Follows", "Users" WHERE "Users".id = sender) as a, ' +
	'(SELECT sender as f2_sender, recipient as f2_recipient, username as recip ' +
	'FROM "Follows", "Users" WHERE "Users".id = recipient) as b WHERE f1_sender ' +
	'= f2_sender AND f1_recipient = f2_recipient UNION SELECT comtr as "user", ' +
	'\'review\' as "action", comment_date as "date", comtee as "participant", ' +
	'\'-\' as "book", message FROM (SELECT "ExchangeReviews".id as er1_id, ' +
	'username as comtr, commenter as er1_commenter, commentee as er1_commentee, ' +
	'message, comment_date FROM "ExchangeReviews", "Users" WHERE "Users".id = ' +
	'commenter) as a, (SELECT "ExchangeReviews".id as er2_id, commenter as ' +
	'er2_commenter, commentee as er2_commentee, username as comtee FROM ' +
	'"ExchangeReviews", "Users" WHERE "Users".id = commentee) as b WHERE er1_id ' +
	'= er2_id) as t WHERE username in (SELECT username FROM "Follows", "Users" ' +
	'WHERE "Follows".recipient="Users".id AND sender = $1) ORDER BY "date" DESC LIMIT 8;';

	var basedOn;
	var results = [];
	var recs;

	async.parallel([

		function(callback) {
			getRecForUser(req.session.userid, function (own, books) {
				recs = books;
				if (own != null && own.items != null && own.items[0].volumeInfo != null) {
					basedOn = own.items[0].volumeInfo
				}
				callback();
			})
		},

		function(callback) {
			client.query(query, [req.session.userid], function(err, result) {

				async.forEach(result.rows, function(entry, callback) {
					var followerID;
					var participantID;
					var book = [];

					async.parallel([

						function(callback2) {
							client.query('SELECT * FROM "Users" WHERE username = $1', [entry.username], function(err, result) {
								followerID = result.rows[0].id;
								callback2();
							});
						},

						function(callback2) {
							if (entry.participant != '-') {
								client.query('SELECT * FROM "Users" WHERE username = $1', [entry.participant], function(err, result) {
									participantID = result.rows[0].id;
									callback2();
								});
							} else {
								callback2();
							}
						},

						function(callback2) {
							if (entry.book != '-') {
								reqBook("isbn:" + entry.book, function (obj) {
									if (obj.totalItems > 0) {
										var book2 = obj.items[0].volumeInfo;
										var title = book2.title;
										var authors = book2.authors;
										var bookInfo = { book2: entry.book, name: title, author: authors };
										book.push(bookInfo);
									}
									callback2();
								});
							} else {
								callback2();
							}
						}

					], function(err) {
							var current = {};
							current.followerID = followerID;
							current.participantID = participantID;
							current.follower = entry.username;
							var d = new Date(entry.date);
							current.date = d.toUTCString();
							switch(entry.action) {
								case "wish":
								current.action = "Wished"
								if (entry.book && book[0]) {
									current.details = "For " + book[0].name + " by " + book[0].author;
								}
								break;
								case "own":
								current.action = "Owns"
								if (entry.book && book[0]) {
									current.details = "Added " + book[0].name + " by " + book[0].author + " to their Exchange List";
								}
								break;
								case "follow":
								current.action = "Follow"
								current.details = "Started following " + entry.participant;
								break;
								case "review":
								current.action = "Reviewed";
								current.details = "Rated and reviewed " + entry.participant;
								break;
								case "comment":
								if (book[0]) {
									current.action = "Commented";
									current.details = "Commented on " + book[0].name + " by " + book[0].author;
								}
								break;
							}
							results.push(current);
							callback();
						});

				}, function(err) {

					callback();
				});
			});
		}], function(err) {
			res.render('recommendations.html',
				{'title': 'Recommendations', 'basedOn': basedOn, 'recommendations': recs, 'results': results});
			return;
		});
});

// Exchange List
app.get('/swap', function (req, res) {
	var bookList = []; // List of books this user owns
  // Get all books that this user owns according to the db
  client.query('SELECT * FROM "Owns" WHERE "user" = $1;',
  	[req.session.userid], function (err, qres) {
  		if (err) {
  			return console.log("error running query", err);
  		} else {
      // For each book, look up the isbn on google API to get the
      // author and title of the book, and then push it onto bookList.
      async.forEach(qres.rows, function(row, callback) {
      	var bookTitle = "Could not retrieve title.";
      	var bookAuthor = "Could not retrieve author";
      	var isbn = row.book;
      	var condition = row.condition;
        // Get book info from google API
        reqBook("isbn:" + isbn, function (obj) {
        	if (obj.items) {
        		bookTitle = obj.items[0].volumeInfo.title;
        		bookAuthor = obj.items[0].volumeInfo.authors;
        	}
        	var details;
        	details = {
        		title: bookTitle, author: bookAuthor, condition: condition,
        		conDetails: row.details, isbn: isbn
        	};
        	bookList.push(details);
        	callback();
        });
    	}, function(err) {
    		if (err) return next(err);
    		res.render('swap.html', {title: 'Swap list', books: bookList});
    	});
  	}
	});
});

// Add a book onto exchange list
app.post('/swap', function (req, res) {
	var isbn = req.body.book;
	var condition = req.body.condition;
	var details = req.body.conDetails;
	client.query('INSERT INTO "Owns" VALUES ($1, $2, $3, $4);',
		[req.session.userid, isbn, condition, details], function(err, result) {
			if (err) {
				console.log(err);
				res.redirect('/swap');
			} else {
				console.log("New book inserted: " + isbn);
				res.redirect('/swap');
			}
		});
});

// Delete a book from exchange list
app.post('/swap-delete', function (req, res) {
	var books = req.body.selectedBooks;
	if (books) {
    // More than one book selected
    if (books.constructor === Array) {
    	var i;
    	for (i = 0; i < books.length; i++) {
    		deleteBook(books[i], '"Owns"', req.session.userid);
    	}
    }
    // One book selected
    else {
    	deleteBook(books, '"Owns"', req.session.userid);
    }
}
res.redirect('/swap');
});

// Helper function for removing a book with the specified isbn from
// the specified table for the user with the specified userid
function deleteBook(isbn, table, userid) {
	client.query('DELETE FROM '+ table +' WHERE "book" = $1 AND "user" = $2;',
		[isbn, userid], function(err, result) {
		if (err) {
			console.log(err);
			err_msg = "Database error, please try again later.";
		}
	});
}

// Wish List
app.get('/wishlist', function (req, res) {
	var bookList = []; //List of book on this user's wishlist
	client.query('SELECT * FROM "Wishes" WHERE "user" = $1;',
		[req.session.userid], function (err, qres) {
			if (err) {
				return console.log("error running query", err);
			} else {
	      // For each book on the user's wishlist, get the title author
	      // from the Google Books API and then push it onto bookList
	      async.forEach(qres.rows, function(row, callback) {
	      	var bookTitle = "Could not retrieve title";
	      	var bookAuthor = "Could not retrieve author";
	      	var isbn = row.book;
	        // Get book info from google API
	        reqBook("isbn:" + isbn, function (obj) {
	        	if (obj.items) {
	        		bookTitle = obj.items[0].volumeInfo.title;
	        		bookAuthor = obj.items[0].volumeInfo.authors;
	        	}
	        	var details;
	        	details = {title: bookTitle, author: bookAuthor, isbn: isbn};
	        	bookList.push(details);
	        	callback();

	        });
	    }, function(err) {
	    	if (err) return next(err);
	    	res.render('wishlist.html', {title: 'Wish List', books: bookList});
	    });
  	}
	});
});

// Add book to wish list
app.post('/wishlist', function (req, res) {
	var isbn = req.body.book;
	client.query('INSERT INTO "Wishes" VALUES ($1, $2);',
		[req.session.userid, isbn], function(err, result) {
			if (err) {
				console.log(err);
				res.redirect('/swap');
			} else {
				res.redirect('/wishlist');
			}
		});
});

// Delete book(s) from wish list
app.post('/wish-delete', function (req, res) {
	var books = req.body.selectedBooks;
	if (books) {
    // More than one book selected
    if (books.constructor === Array) {
    	var i;
    	for (i = 0; i < books.length; i++) {
    		deleteBook(books[i], '"Wishes"', req.session.userid);
    	}
    }
    // One book selected
    else {
    	deleteBook(books, '"Wishes"', req.session.userid);
    }
}
res.redirect('/wishlist');
});

// Community
app.get('/community', function (req, res) {
  var followings = []; // users that current user follows
  var followers = []; // users that follow current user
  var search = req.query.search;
  var search2 = '%' + req.query.search + '%';
  var results = [];
  var show = false;

  async.parallel([

		// Get all users that the current user is following
		function(callback) {
			client.query('SELECT "id", "username", "profile_pic" FROM "Users", ' +
			'"Follows" WHERE "id" = "recipient" AND "sender" = $1;',
				[req.session.userid], function(err, qres) {
					if (err) {
						console.log(err);
					} else {
						var i;
						for (i = 0; i < qres.rows.length; i++) {
							if (!qres.rows[i].profile_pic) {
								qres.rows[i].profile_pic = "assets/images/profile_pic.png";
							}
							followings.push(qres.rows[i]);
						}
					}
					callback();
				});
		},

    // Get all users that follow the current user
    function(callback) {
    	client.query('SELECT "id", "username", "profile_pic" FROM "Users", ' +
			'"Follows" WHERE "id" = "sender" AND "recipient" = $1;',
    		[req.session.userid], function(err, qres) {
    			if (err) {
    				console.log(err);
    			} else {
    				var i;
    				for (i = 0; i < qres.rows.length; i++) {
    					if (!qres.rows[i].profile_pic) {
    						qres.rows[i].profile_pic = "assets/images/profile_pic.png";
    					}
    					followers.push(qres.rows[i]);
    				}
    			}
    			callback();
    		});
    },

		// search users works for username, firstname OR lastname NOT firstname + lastname
		function(callback) {
			if (search) {
				client.query('SELECT * FROM "Users" WHERE "username" ILIKE $1 OR ' +
				'"firstname" ILIKE $1 OR "lastname" ILIKE $1;', [search2], function (err, result) {
					show = true;
					async.forEach(result.rows, function(entry, callback2) {
						var current = {};
						current.profile_pic = getProfilePic(entry.profile_pic);
						current.id = entry.id;
						current.firstname = entry.firstname;
						current.lastname = entry.lastname;
						current.username = entry.username;
						results.push(current);
						callback2();
					}, function(err) {
						callback();
					});
				});
			} else {
				callback();
			}
		},

		], function(err) {
			if (err) {
				console.log(err);
			}
			res.render('community.html',
				{title: 'Community',
				followings,
				followers,
				searches: results,
				show: show
			});
		});
});

// Display user profile
app.get('/profile', function (req, res) {
	var uid = req.session.userid;
	client.query('SELECT * FROM "Users" WHERE "id" = $1;', [uid], function (err, qres) {
		if (err) {
			return console.log("error running query", err);
		} else if (qres.rows.length === 1) {
			var u = qres.rows[0];
			console.log(req.session.errors)
			res.render("profile.html",
				{title: "Edit profile: " + qres.rows[0].username,
				'errors': req.session.errors,
				user: {
					id: u.id,
					username: u.username,
					firstname: u.firstname,
					lastname: u.lastname,
					email: u.email,
					age: u.age,
					gender: u.gender,
					location: u.location,
					utype: u.user_type,
					profile_pic: u.profile_pic
				}
			});
      		// Reset errors after printing
      		req.session.errors = [];
      	} else {
      		res.redirect('/');
      		console.log("Database error");
      	}
      });
});

app.post('/profile', function (req, res) {
	var uid = req.session.userid;

    // Query db and check
    client.query('SELECT * FROM "Users" WHERE "id" = $1;', [uid], function (err, qres) {
    	if (err || qres.rows.length != 1) {
    		res.redirect('/profile')
    		return console.log("error running query", err);
	    } else if (qres.rows[0].username != req.body.username ) { // Check if username matches
	    	console.log("user != user")
	    	res.redirect('/profile');
	    	return;
	    } else {
	        // Need to validate some info - gender
	        var gender = qres.rows[0].gender;
	        if (req.body.gender == '-' || req.body.gender == 'm' || req.body.gender == 'f') {
	        	gender = req.body.gender;
	        } else {
	        	req.session.errors.push("Gender must be m/f/-")
	        }
	        // Verify age
	        var age = req.body.age;
	        if (!/^\d+/.test(age) || age > 120) {
	        	age = qres.rows[0].age;
	        	req.session.errors.push("Age must be a number less than 120.");
	        }

	        // Verify email
	        var email = req.body.email;
	        if (!validator.isEmail(email)) {
	        	email = qres.rows[0].email;
	        	req.session.errors.push("Please enter a valid email.");
	        }
	        async.parallel([
	        	function(callback) {
	        		if (req.body.password.length > 0) {
	        			if (req.body.password != req.body.pwd_confirm) {
	        				req.session.errors.push("Passwords did not match, please try again.");
	        			} else {
                 			// Change password
                 			var hash = bcrypt.hashSync(req.body.password, 10);
                 			client.query('UPDATE "Users" SET password=$1 WHERE id=$2',
											[hash, uid], function (err) {
                 				if (err) {
                 					req.session.errors.push("Database error, password not updated.");
                 				}
                 			});
                 		}
                 	}
                 	callback();
                 },
      		// Change email
      		function(callback) {
            	// Check if email is the same, no need to change
            	if (email == qres.rows[0].email) {
            		callback();
            	} else {
            		client.query('SELECT * from "Users" WHERE "email"=$1', [email],
								function (err, qres_e) {
            			if (qres_e.rows.length) {
            				req.session.errors.push("New email already in use.");
            			} else {
            				client.query('UPDATE "Users" SET email=$1 WHERE id=$2',
										[email, uid], function (err) {
            					if (err) {
            						req.session.errors.push("Error updating database.");
            						console.log("Error updating database - email");
            					}
            					callback();
            				})
            			}
            		});
            	}
            },
            // Change everything else
            function(callback) {
            	client.query('UPDATE "Users" SET firstname=$1,lastname=$2,' +
							'age=$3,gender=$4,location=$5 WHERE id=$6',
            		[req.body.first_name, req.body.last_name, age, gender,
									req.body.location, uid], function (err, qres_a) {
            			if (err) {
            				req.session.errors.push("Error updating database.");
            				console.log("Error updating database - aux info");
            			}
            			callback();
            		})
            }], function (err){
            	res.redirect('profile');

            });

	    }
	});
});

// Inbox
app.get('/inbox', function (req, res) {
  // Mark all messages to this user as read
  client.query('UPDATE "Messages" SET "message_read" = true WHERE "to" = $1 ' +
  	'AND "message_read" IS FALSE;', [req.session.userid], function (err, qres) {
  		if (err) {
  			return console.log(err);
  		}
  	});

  var convos = [];
	// Find the first message of each convo curr user has with another user
	client.query('SELECT * FROM "Messages" WHERE "prev_id" IS NULL AND ("to"' +
		' = $1 OR "from" = $1);', [req.session.userid], function (err, qres) {
			if (err) {
				return console.log("error running query", err);
			} else {
				async.forEach(qres.rows, function(row, callback) {
				var senderUsername; // user sending the first message
				var msgs = []; // messages between other user and curr user
				var user; // the other user's id
				var otherUsername; // username of the other user
        var otherPic; // profile pic of other user
        var myPic; // profile pic of current user
        if (row.to != req.session.userid) {
        	user = row.to;
        } else {
        	user = row.from;
        }

				// Find the username and profile pic for the other user
				client.query('SELECT id, username, profile_pic FROM "Users" WHERE' +
					' "id" = $1 OR "id" = $2;', [user, req.session.userid],
					function (err, qr) {
						if (err) {
							return console.log("error running query", err);
						} else {
							var id;
							var lastMsg = row.message_date;
							var msgType;
							var sent;
            // Set the message details to be displayed
            if (qr.rows[0].id == user) {
            	otherUsername = qr.rows[0].username;
            	otherPic = getProfilePic(qr.rows[0].profile_pic);
            	myPic = getProfilePic(qr.rows[1].profile_pic);
            } else {
            	otherUsername = qr.rows[1].username;
            	otherPic = getProfilePic(qr.rows[1].profile_pic);
            	myPic = getProfilePic(qr.rows[0].profile_pic);
            }

						//find the username of the user that sent the first message
						if (row.from == req.session.userid) {
							senderUsername = req.session.username;
							msgType = "inbox-sent";
							sent = true;
						} else {
							senderUsername = otherUsername;
							msgType = "inbox-received";
							sent = false;
						}

						//push the first message in the convo into the list
						msgs.push({sender: senderUsername, date: row.message_date,
							content: row.message, mType: msgType, sent});
						var previd = row.id;
						id = "form-" + previd;
						//find the rest of the messages in the convo by checking prev_id
						var replyExists = true;
						async.whilst(function () {return (replyExists);},
							function (inner_callback) {
								client.query('SELECT * FROM "Messages" WHERE "prev_id" = $1',
									[previd], function(err, loopRes) {
										if (loopRes.rows.length > 0) {
											if (loopRes.rows[0].from == req.session.userid) {
												senderUsername = req.session.username;
												msgType = "inbox-sent";
												sent = true;
											} else {
												senderUsername = otherUsername;
												msgType = "inbox-received";
												sent = false;
											}
											msgs.push({sender: senderUsername,
												date: loopRes.rows[0].message_date, sent,
												mType: msgType, content: loopRes.rows[0].message});

											id = "form-" + loopRes.rows[0].id;
											previd = loopRes.rows[0].id;
											lastMsg = loopRes.rows[0].message_date;
										} else {
											replyExists = false;
										}
										inner_callback();
									});
							},
							function (err) {
								convos.push({otherUserID: user, otherUser: otherUsername,
									subject: row.subject, messages: msgs, replyID: id,
									buttonID: previd, userPic: myPic, otherUserPic: otherPic,
									recipientID: user, lastDate: lastMsg});
								callback();
							});
					}
				});
			}, function(err) {
				if (err) return next(err);
        // Sort the convos by most recent
        convos.sort(function(a, b) {
        	var d1 = new Date(a.lastDate);
        	var d2 = new Date(b.lastDate);
        	return (d1 < d2);
        });
        res.render('inbox.html',
        	{title: 'Inbox',
        	conversations: convos
        });
    });
			}
		});

});

// Insert reply to a message
app.post('/inbox/reply', function (req, res) {
	var recipient = req.body.recipient;
	var msg = req.body.message;
	var prevID = req.body.prevID;

	client.query('INSERT INTO "Messages" ("prev_id", "to", "from", "message",'
		+ ' "message_date") VALUES ($1, $2, $3, $4, current_timestamp);',
		[prevID, recipient, req.session.userid, msg], function(err, result) {
			if (err) {
				console.log(err);
				err_msg = "Database error, please try again later.";
				res.redirect('/inbox');
			} else {
				console.log("New reply msg scent from user " + req.session.userid
					+ " for msg " + prevID);
				res.redirect('/inbox');
			}
		});
});

// Insert new message
app.post('/inbox', function (req, res) {
	var recipient = req.body.recipient;
	var msgSubj = req.body.msgSubject;
	var msg = req.body.message;

	client.query('SELECT id FROM "Users" WHERE "username" = $1;',
		[recipient], function (err, qres) {
			if (err) {
				return console.log("error running query", err);
			} else if (qres.rows.length === 1) {
				var recipientID = qres.rows[0].id;
				client.query('INSERT INTO "Messages" ("to", "from", "message", ' +
					'"message_date", "subject") VALUES ($1, $2, $3, current_timestamp, $4);',
					[recipientID, req.session.userid, msg, msgSubj], function(err, result) {
						if (err) {
							console.log(err);
							err_msg = "Database error, please try again later.";
							res.redirect('/inbox');
						} else {
							res.redirect('/inbox');
						}
					});
			} else {
				console.log("Database error");
				res.redirect('/inbox');
			}
		});
});

// Get total number of unread messages for this user
app.get('/inbox-notifications', function (req, res) {
	client.query('SELECT COUNT(*) FROM "Messages" WHERE "to" = $1 AND ' +
		'"message_read" IS FALSE', [req.session.userid], function (err, qres) {
			var newMsgs = 0;
			if (err) {
				console.log(err);
			} else {
				newMsgs = qres.rows[0].count;
			}
			res.send(newMsgs);
		});
});

// Get the total number of unseen or not yet responded to requests
app.get('/request-notifications', function(req, res) {
	client.query('SELECT COUNT(*) FROM "Exchanges" WHERE (requestor = $1' +
		' OR requested = $1) AND status_requestor = $2',
		[req.session.userid, "requested"], function(err, result) {
			var newMsgs = 0;
			if (err) {
				console.log(err);
			} else {
				newMsgs = result.rows[0].count;
			}
			res.send(newMsgs);
		});
});

// Search books
app.get('/search-books', function (req, res) {
	var bookList = [];
	var book = req.query['book'];
  // Get books from google API and display relevant information
  reqBook(book, function (obj) {
  	var book, thumbnail;
  	async.forEach(obj.items, function(item, callback) {
  		var hasISBN = false;
  		var identifier = getISBN(item);
  		var numOwners = 0;
  		if (identifier != -1) {
  			async.series([
  				function(inner_callback) {
                // Get the number of users that own this book
                client.query('SELECT COUNT(*) FROM "Owns" WHERE "book" = $1',
                	[identifier], function (err, qres) {
                		if (err) {
                			console.log(err);
                		} else {
                			numOwners = qres.rows[0].count;
                		}
                		thumbnail = getBookPic(item.volumeInfo);
                		inner_callback();
                	});
            }
            ], function(err) {
            	if (err) return next(err);
            	book = {
            		pic: thumbnail, owners: numOwners, isbn: identifier,
            		title : item.volumeInfo.title, author: item.volumeInfo.authors
            	}
            	bookList.push(book);
            	callback();
            });
  		} else {
  			callback();
  		}
  	}, function(err) {
  		if (err) return next(err);
  		res.render('search_books.html',
  			{title: 'Search Books', book_title: req.query['book'],
  			books: bookList
  		});
  	});
  });
});

// Book details
app.get('/books/:isbn', function (req, res) {
	var swapUsers = [];
	var wishUsers = [];
	var book;
	var pic;
	var reviews;
	var recommendations;
	async.parallel([
		function(callback) {
        // Get book details from Google Books API
        var isbn = req.params.isbn;
        reqBook("isbn:" + isbn, function (obj) {
        	if (!obj.items) {
        		res.redirect('/recommendations');
        		return;
        	}

        	book = obj.items[0].volumeInfo;
        	pic = getBookPic(book);
        	var category;
        	if (obj.items[0].volumeInfo.categories) {
        		category = obj.items[0].volumeInfo.categories[0];
        	} else {
        		category = obj.items[0].volumeInfo.title;
        	}
        	getRecommendations(category, true, function(books) {
          	// Get books pictures and isbn for books
          	if (!books) {
          		callback();
          	} else {
          		for (var i = 0; i < books.length; i++) {
          			books[i].volumeInfo.pic = getBookPic(books[i].volumeInfo);
          			books[i].volumeInfo.ISBN = getISBN(books[i]);
          		}
          		recommendations = books;
          		callback();
          	}
          })
        });
    },
    function(callback) {
        // Get users who own this book
        client.query('SELECT "user", "profile_pic" FROM "Owns", "Users" '
        	+ 'WHERE "book" = $1 AND "user" = "id"', [req.params.isbn],
        	function (err, qres) {
        		if (err) {
        			console.log(err);
        		} else {
        			if (qres.rows.length > 0) {
        				var i;
        				for (i = 0; i < qres.rows.length; i++) {
        					var pp = getProfilePic(qres.rows[i].profile_pic);
        					swapUsers.push({userID: qres.rows[i].user, pic: pp});
        				}
        			}
        		}
        		callback();
        	});
    },
    function(callback) {
        // Get users who want this book
        client.query('SELECT "user", "profile_pic" FROM "Wishes", "Users" '
        	+ 'WHERE "book" = $1 AND "user" = "id"', [req.params.isbn],
        	function (err, qres) {
        		if (err) {
        			console.log(err);
        		} else {
        			if (qres.rows.length > 0) {
        				var i;
        				for (i = 0; i < qres.rows.length; i++) {
        					var pp = getProfilePic(qres.rows[i].profile_pic);
        					wishUsers.push({userID: qres.rows[i].user, pic: pp});
        				}
        			}
        		}
        		callback();
        	});
    },
    function(callback) {
      	// Get reviews for this book
      	client.query('SELECT * FROM "Comments" LEFT JOIN "Users" ON ' +
      		'"Comments".user="Users".id WHERE "Comments".book=$1 ORDER BY ' +
      		'"Comments".comment_date DESC;', [req.params.isbn],
      		function (err, qres) {
      			if (err) {
      				console.log("DB select err: " + err);
      				console.log(err);
      			} else {
      				reviews = qres.rows;
      			}
      			callback();
      		}
      		);
      }
      ], function(err) {
      	if (err) {
      		console.log(err);
      	}
      	res.render('book_details.html',
      		{title: 'Book Details', book_title: book.title,
      		thumbnail: pic, author: book.authors, isbn: req.params.isbn,
      		publishedDate: book.publishedDate, publisher: book.publisher,
      		description: book.description, wishes: wishUsers,
      		categories: book.categories, swaps: swapUsers,
      		'reviews': reviews, 'avg_review': getAverageRating(reviews),
      		'recommendations': recommendations
      	});
      });
});

// Other profile page
app.get('/user:id', function (req, res) {

	var user = {};
	var follows = 0;
	var books = 0;
	var want = [];
	var own = [];
	var followers = {};
	var following = false;
	var rating = 0;
	var numberOfRatings;
	var ratings = [];
	var userId = req.params.id;

	async.parallel([

			// Find the user
			function(callback) {
				client.query('SELECT * FROM "Users" WHERE "id" = $1;', [userId], function(err, result) {
					if (err) return callback(err);
					if (!result.rows) {
						result.redirect('/community');
						return;
					}
					user = result.rows[0];
					callback();
				});
			},

			// Set the number of books this user has finished swapping
			function(callback) {
				client.query('SELECT * FROM "Exchanges" WHERE (requestor = $1 OR ' +
				'requested = $1) AND (status_requestor = \'completed\' OR ' +
				'status_requestor = \'rating\' OR status_requestor = \'rated\')',
				[req.session.userid], function(err, result) {
					books = result.rows.length;
					callback();
				});
			},

			// Find the rating
			function(callback) {
				client.query('SELECT AVG(rating) FROM "ExchangeReviews" WHERE commentee = $1',
				[userId], function(err, result) {

					rating = result.rows[0].avg;
					rating = Math.round(rating);

					callback();

				});
			},

			// Find each comment
			function(callback) {
				client.query('SELECT * FROM "ExchangeReviews" WHERE commentee = $1',
				[userId], function(err, result) {

					numberOfRatings = result.rows.length;
					async.forEach(result.rows, function(entry, callback2) {

						client.query('SELECT * FROM "Users" WHERE id = $1',
						[entry.commenter], function(err, result) {
							var current = {};
							current.commenter = result.rows[0].username;
							current.comment = entry.message;
							current.rating = entry.rating;
							ratings.push(current);
							callback2();
						})

					}, function(err) {
						callback();
					});
				});
			},

			// Find the followers of this particular user
			function(callback) {
				client.query('SELECT "sender", "profile_pic" FROM "Follows",' +
				'"Users" WHERE "recipient" = $1 AND '+
					'"sender" = "id";', [userId],
					function(err, result) {
						if (err) return callback(err);
						follows = result.rows.length;
						followers = result.rows;
						callback();
					});
			},

			// Find the owned books from this user
			function(callback) {
				client.query('SELECT * FROM "Owns" WHERE "user" = $1;', [userId],
					function(err, result) {
						if (err) return callback(err);

						// For each book owned, request the book from the google api
						async.forEach(result.rows, function(row, callback2) {

							var isbn = row.book;
							reqBook("isbn:" + isbn, function (obj) {
								if (obj.items) {
									var book = obj.items[0].volumeInfo;
									var title = book.title;
									var condition = row.condition.charAt(0).toUpperCase() + row.condition.slice(1);
									var pic = "NA";
									if (book.imageLinks && book.imageLinks.thumbnail) {
										pic = book.imageLinks.thumbnail;
									}
									current = { book: isbn, profile: pic, name: title, condition: condition,
										conditionDetails: row.details };
										own.push(current);
									}
									callback2();
								});

						}, function(err) {
							callback();
						});
					});
			},

			// Find the wanted books from this user
			function(callback) {
				client.query('SELECT * FROM "Wishes" WHERE "user" = $1;', [userId],
					function(err, result) {
						if (err) return callback(err);

						// For each book wanted, request the book from google api
						async.forEach(result.rows, function(row, callback2) {

							var isbn = row.book;
							reqBook("isbn:" + isbn, function (obj) {
								if (obj.items) {
									var book = obj.items[0].volumeInfo;
									var title = book.title;
									var pic = "NA";
									if (book.imageLinks && book.imageLinks.thumbnail) {
										pic = book.imageLinks.thumbnail;
									}
									current = { book: isbn, profile: pic, name: title };
									want.push(current);
								}
								callback2();
							});
						}, function(err) {
							callback();
						});
					});
			},
      // Display unfollow button if current user (sender) already follows
      // this user (recipient). Otherwise display follow button.
      function(callback) {
      	client.query('SELECT * FROM "Follows" WHERE "sender" = $1 AND "recipient" = $2',
      		[req.session.userid, userId], function(err, qres) {
      			if (err) {
      				console.log(err);
      			} else {
      				if (qres.rows.length > 0) {
      					following = true;
      				}
      			}
      			callback();
      		});
      }

      ], function(err) {
      	if (err) throw err;
      	var error = req.session.error;
      	req.session.error = false;
      	res.render('other_profile.html', {title: user.firstname + '\'s Profile',
				user, follows, books, followers, want, own, following, rating: rating,
				numRating: numberOfRatings, ratings: ratings, error: error});
      });

});

// Make a request
app.post('/user:id', function (req, res) {

	var requestor = req.session.userid;
	var requested = req.params.id;
	var found = false;
	var wantBook = req.body.wantBook;
	var ownBook = req.body.ownBook;

	async.series([

		function(callback) {
			if (!wantBook || !ownBook) {
				req.session.error = true;
				res.redirect('/user' + requested);
			} else {
				callback();
			}
		},

		function(callback) {
			// Figure out if this exact request has already been made to prevent spam
			client.query('SELECT * FROM "Exchanges" WHERE "requestor" = $1 AND' +
			'"requested" = $2 AND "want_book" = $3 AND "own_book" = $4 AND ' +
			'"status_requestor" != $5;', [requestor, requested, wantBook, ownBook,
				'completed'], function(err, result) {
				if (err) return callback(err);

				if (result.rows.length != 0) {
					found = true;
				}
				callback();

			});

		}

		], function(err) {
			if (err) throw err;

		// If this exact request hasn't been made, then insert it into the table
		if (found == false) {

			client.query('INSERT INTO "Exchanges" (requestor, requested, ' +
			'want_book, own_book, status_requestor, status_requested) VALUES' +
			'($1, $2, $3, $4, $5, $6) RETURNING id;',
				[requestor, requested, wantBook, ownBook, 'requested', 'requested'],
				function(err, result) {

					if (err) throw err;

					console.log(result.rows[0]);

				});

		}

		res.redirect('/user' + requested);

	});

});

// Show requests on requests page
app.get('/requests', function (req, res) {

	var user = req.session.userid;
	var foundRequestor = false;
	var foundRequested = false;
	var requestorRequests = [];
	var requestedRequests = [];
	var totalRequests = [];

	// Get all of the requests on the Exchanges table
	client.query('SELECT * FROM "Exchanges" WHERE "requestor" = $1 OR ' +
	'"requested" = $1', [user], function(err, result) {
		requests = result.rows;

		// for each request, get all of the information the resquests.html needs
		async.forEach(requests, function(entry, callback2) {

			var current = {};
			current.exchangeID = entry.id;
			current.current = user;
			var otherID;
			current.rate = false;

			// the IDs are dependent on whether the current user is the requestor
			// or the requested
			if (entry.requestor == user) {
				otherID = entry.requested;
				if (entry.status_requestor == "rating") {
					current.rate = true;
				}
			} else {
				otherID = entry.requestor;
				if (entry.status_requested == "rating") {
					current.rate = true;
				}
			}

			// get the other user's information
			client.query('SELECT * FROM "Users" WHERE "id" = $1', [otherID],
			function(err, result) {

				if (result.rows.length != 0) {

					if (entry.requestor == user) {

						current.requested = result.rows[0].username;
						current.requestedID = entry.requested;
						current.requestor = req.session.username;
						current.requestorID = user;
						current.status = entry.status_requestor;
						current.rejected = false;
						if (current.status_requestor == "rejected") {
							current.rejected = true;
						}

					} else {

						current.requestor = result.rows[0].username;
						current.requestorID = entry.requestor;
						current.requested = req.session.username;
						current.requestedID = user;
						current.status = entry.status_requested;
						current.show = false;
						if (current.status == "requested") {
							current.show = true;
						}

					}

					// request the want-book and the own-book in parallel
					async.parallel([

						function(callback3) {
							var isbn = entry.want_book;
							reqBook("isbn:" + isbn, function (obj) {
								if (obj.items) {
									current.wantBook = obj.items[0].volumeInfo.title + " by ";
									current.wantBook += obj.items[0].volumeInfo.authors;
								}
								callback3();
							});

						}, function(callback3) {

							var isbn = entry.own_book;
							reqBook("isbn:" + isbn, function (obj) {
								if (obj.items) {
									current.ownBook = obj.items[0].volumeInfo.title + " by ";
									current.ownBook += obj.items[0].volumeInfo.authors;
								}
								callback3();
							});
						}

						], function(err) {
							totalRequests.push(current);
							callback2();
						});
				} else {
					callback2();
				}
			});
		}, function(err) {
			res.render('requests.html', {title: 'Requests', requests: totalRequests});
		});
	});
});

// Respond to any of the buttons that might be clicked on the requests page
app.post('/requests', function (req, res) {

	var user = req.query.user;
	var exchangeID = req.query.id;

	// if not user, then the accept or reject button has been clicked
	if (!user) {

		var accepted = req.body.accepted;
		var rejected = req.body.rejected;
		var newStatus;
		if (accepted) {
			newStatus = "accepted";
		} else if (rejected) {
			newStatus = "rejected";
		} else {
			newStatus = "completed";
		}

		client.query('UPDATE "Exchanges" SET "status_requested" = $1,' +
		'"status_requestor" = $1 WHERE "id" = $2', [newStatus, exchangeID],
		function(err, result) {

			res.redirect('/requests');
		});

	}

	// otherwise the rating button has been clicked
	else {

		var newStatus = "rating";
		var which;

		async.parallel([

			function(callback) {

				client.query('SELECT * FROM "Exchanges" WHERE "id" = $1',
				[exchangeID], function(err, result) {
					if (result.rows[0].requestor == user) {
						which = "requestor";
					} else {
						which = "requested";
					}
					callback();
				});
			}

			], function(err) {
				// update the correct status to "rating"
				if (which == "requestor") {
					client.query('UPDATE "Exchanges" SET "status_requestor" =' +
					'$1 WHERE "id" = $2', [newStatus, exchangeID], function(err, result) {
						res.redirect('/requests');
					});
				} else {
					client.query('UPDATE "Exchanges" SET "status_requested" = $1 ' +
					'WHERE "id" = $2', [newStatus, exchangeID], function(err, result) {
						res.redirect('/requests');
					});
				}
			});
	}

});

// If the rated button has been clicked
app.post('/rate', function (req, res) {

	var exchangeID = req.query.id;
	var rating = req.body.rating;
	var message = req.body.message;
	var userStatus = req.query.user;
	var user;
	var otherUser;

	async.series([

		// Get the exchange the review refers to
		function(callback) {

			client.query('SELECT * FROM "Exchanges" WHERE "id" = $1',
			[exchangeID], function(err, result) {

				if (userStatus == "requestor") {
					otherUser = result.rows[0].requested;
					user = result.rows[0].requestor;
				} else {
					otherUser = result.rows[0].requestor;
					user = result.rows[0].requested;
				}

				callback();
			});
		},

		// Insert into the ExchangeReviews
		function(callback) {
			client.query('INSERT INTO "ExchangeReviews" (commenter, commentee, ' +
			'message, rating) VALUES ($1, $2, $3, $4) RETURNING id',
			[user, otherUser, message, rating], function(err, result) {
				callback();
			});
		}

		], function(err) {
			// Updated to "rated" where appropriate
			if (userStatus == "requestor") {
				client.query('UPDATE "Exchanges" SET "status_requestor" = $1 WHERE ' +
				'"id" = $2', ["rated", exchangeID], function(err, result) {
					res.redirect('/requests');
				});
			} else {
				client.query('UPDATE "Exchanges" SET "status_requested" = $1 WHERE ' +
				'"id" = $2', ["rated", exchangeID], function(err, result) {
					res.redirect('/requests');
				});
			}
		});
});

// Review a book
app.post('/review/:isbn', function (req, res) {
	var isbn = req.params.isbn;
	var user = req.session.userid;

	var ret_url = '/books/' + isbn;

	var ret = {'title': "Book Details", "error": ""};

	// Verify that a rating exists
	if (req.body.rating < 0 || req.body.rating > 5) {
		req.session.errors.push("Sorry the rating has to be between 0 and 5");
		// Should not occur normally
	}

	var message = "";
	if (req.body.message != undefined) {
		message = req.body.message;
	}

	reqBook("isbn:" + isbn, function (books) {
		if (books.totalItems == 0) {
			ret.error = "We could not find the book you were trying to review." +
			"Please refresh and try again.";
			res.redirect(ret_url);
		} else if (getISBN(books.items[0]) != isbn) {
			req.session.errors.push("We could not find the book you were trying." +
			" to review. Please refresh and try again.")
			res.redirect(ret_url);
		} else {
			// Add to database
			client.query('INSERT INTO "Comments" ("user", "book", "rating",' +
			' "message", "comment_date") VALUES ($1, $2, $3, $4, current_timestamp);',
				[user, isbn, req.body.rating, message], function (err, qres) {
					if (err) {
						console.log("Database insert error: " + err);
						req.session.errors.push("Database insert error: " + err);
					} else {

					}
					res.redirect(ret_url);
				});
		}
	});
});

// Follow a user
app.post('/follow/:id', function (req, res) {
	var userid = req.params.id;
	client.query('INSERT INTO "Follows" VALUES ($1, $2, current_timestamp)',
		[req.session.userid, userid], function(err, result) {
			if (err) {
				console.log(err);
			}
			res.redirect('/user' + userid);
		});
});

// Unfollow a user
app.post('/unfollow/:id', function (req, res) {
	var userid = req.params.id;
	client.query('DELETE FROM "Follows" WHERE "sender" = $1 AND "recipient" = $2',
		[req.session.userid, userid], function(err, result) {
			if (err) {
				console.log(err);
			}
			res.redirect('/user' + userid);
		});
});

// Given a search string, requests the google API for the search string and
// returns the JSON
function reqBook (sstr, callback) {
	var ret = {'totalItems': 0};
	request('https://www.googleapis.com/books/v1/volumes?q=' + sstr + '&key=' + googleKey,
		function (error, response, body) {
			if (error) { // Request error
				console.log("Request error: " + error);
			} else if (response.statusCode != 200) { // HTTP error
				console.log("Request failed: " + response.statusCode);
			} else {
				ret = JSON.parse(body);
			}
			callback(ret);
			return;
		});
}


function reqByISBN (isbn, callback) {
	reqBook("isbn:" + isbn, function (res) {
		if (res == null || res.totalItems == 0) {
			// Couldn't find the book by isbn, let's try a generic lookup
			reqBook(isbn, function (res2) {
				callback(res2);
			})
		} else {
			callback(res);
		}
	})
}

// Given an item, returns the ISBN 13, falls back to 10 if not available. -1
// if none exists
function getISBN(item) {
	// Get ISBN of book
	var hasISBN = false;
	var identifier = -1;
	try {
		if (item.volumeInfo.industryIdentifiers) {
			item.volumeInfo.industryIdentifiers.forEach(function( isbn ) {
				if (isbn.type == "ISBN_13") {
    			identifier = isbn.identifier;
    			hasISBN = true;
    		} else if (!hasISBN && isbn.type == "ISBN_10") {
    			// no ISBN_13!!!
    			identifier = isbn.identifier;
    		}
    	});
		}
	} catch (err) {}
	return identifier;
}

// Get average rating of items with a ratings property
function getAverageRating(objs) {
	var rating = 0;
	var num = objs.length;

	for (var i = 0; i < num; i++) {
		rating += objs[i].rating;
	}
	rating = rating/num;
	return rating;
}

function getBookPic(book) {
	var pic;
	if (book.imageLinks && book.imageLinks.thumbnail) {
		pic = book.imageLinks.thumbnail;
	} else {
		pic = "/assets/images/placeholder_book.png";
	}
	return pic;
}

// Return pic if it is not null. Otherwise, return default
// profile picture.
function getProfilePic(pic) {
	var ret;
	if (pic) {
		ret = pic;
	} else {
		ret = "assets/images/profile_pic.png";
	}
	return ret;
}

// Last route, page not found. TODO: Potential 404 page
app.get('*', function(req, res) {
	res.redirect('/');
});

// Server start
var listener = app.listen(process.env.PORT || 3000, function () {
	console.log('Server running on port ' + listener.address().port);
});
