/*Toggle these functions and observe their output*/



/* Accessing database */
function do_database(){

	var pg = require('pg');

	pg.defaults.ssl = true; //always keep true!!!

	//determine where the database is
	var conString = "postgres://ujjikxvfoeetmy:9cebcbMX6DYH_S6LvM0sm6utUs@ec2-54-243-47-83.compute-1.amazonaws.com:5432/d2jl3gj15vn53e";

	//eshtablish client connection
	var client = new pg.Client(conString);

	client.connect(function(err) {
	    //error
	    if (err) {
	        return console.error('could not connect to postgres', err);
	    }

	    //success - execute the query and read in the results
	    //feel free to modify this and observer the results
	    //note: the semicolon delimeter is not needed but is semantic in that it tells me when the SQL part ends
	    client.query('SELECT * FROM "Users";', function(err, result) {
	        if (err) {
	            return console.error('error running query', err);
	        }

	        //the 'results.rows' is a JSON object
	        for (i = 0; i < result.rows.length; i++) {
	            console.log(result.rows[i]);
	        }

	        console.log("OK");

	        //kill the client connection
	        client.end();
	    });
	});
}



/* VIEW database tables */
function view_tables(){

	var pg = require('pg');

	pg.defaults.ssl = true; //always keep true!!!


	//determine where the database is
	var conString = "postgres://ujjikxvfoeetmy:9cebcbMX6DYH_S6LvM0sm6utUs@ec2-54-243-47-83.compute-1.amazonaws.com:5432/d2jl3gj15vn53e";


	//eshtablish client connection
	var client = new pg.Client(conString);

	client.connect(function(err) {
	    //error
	    if (err) {
	        return console.error('could not connect to postgres', err);
	    }

	    //find database tables
	    client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';", function(err, result) {
	        if (err) {
	            return console.error('error running query', err);
	        }

	        //the 'results.rows' is a JSON object
	        for (i = 0; i < result.rows.length; i++) {
	            console.log(result.rows[i]);
	        }

	        console.log("OK");

	        //kill the client connection
	        client.end();
	    });
	});
}












do_database();
view_tables();
