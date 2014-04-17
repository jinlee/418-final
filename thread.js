/**
 * This is a library to support threaded processing on javascript
 */

(function() {

    function Seq(arr, required) {
	this.arr = arr === 'undefined' ? [] : arr;
	// TODO support later
	this.required = required === 'undefined' ? null : required;
    }

    /** internal helper functions */
    Seq.prototype.stringify = function (f) {
	return 'onmessage = function (msg) {' +
	       '    postMessage( (' + f.toString() + ')(msg.data) );' +
	       '}';
    }

    Seq.prototype.createWorker = function(f, cb) {
	var worker;
	var fString = this.stringify(f);
	try {
	    var blob = new Blob([fString], { type: 'text/javascript' });
	    worker = new Worker(window.URL.createObjectURL(blob));
	} catch (err) {
	    throw err;
	}
	return worker;
    }

    Seq.prototype.runWorker = function (f, data, cb) {
	var seq = this;
	var worker = this.createWorker(f, cb);
	worker.onmessage = function (res) {
	    worker.terminate();
	    cb(res.data);
	    seq.arr = res.data;
	};
	// run the worker! GO GO GO!
	worker.postMessage(data);
    }

    /** external functions */
    Seq.prototype.map = function (f, cb) {
	for (var i = 0; i < this.arr.length; i++) {
	    this.runWorker(f, this.arr[i], cb);
	}
    }

    this.Seq = Seq;

})();
