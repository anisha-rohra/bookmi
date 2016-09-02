var s = require('../server.js');

exports['testGAPI'] = function (test) {

	s.reqBook(978049538362, function (ret) {
		test.equal(ret.totalItems, 0);
	})

}