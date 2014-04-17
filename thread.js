/**
 * This is a library to support threaded processing on javascript
 */

(function() {

    function Latch(next) {
	this.ready = false;
	this.next = next;
    }

    Latch.prototype.register = function (nextFunc) {
	if (this.ready) {
	    nextFunc();
	    return;
	}
	this.next = nextFunc;
    }

    Latch.prototype.runNext = function () {
	this.ready = true;
	if (this.next !== undefined) {
	    this.next();
	}
    }

    function Seq(arr, required) {
	this.arr = arr === undefined ? [] : arr;
	// TODO support later
	this.required = required === undefined ? null : required;
	this.latch = new Latch();
	this.latch.ready = true;
    }

    /** internal helper functions */
    Seq.prototype.stringify = function (f) {
	return 'onmessage = function (msg) {' +
	       '    postMessage( (' + f.toString() + ')(msg.data) );' +
	       '}';
    }

    Seq.prototype.createWorker = function(f) {
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

    Seq.prototype.runWorker = function (f, index, checkDone) {
	var seq = this;
	var worker = this.createWorker(f);
	worker.onmessage = function (res) {
	    console.log("heard back from index " + index);
	    worker.terminate();
	    if (res.data !== undefined) {
		seq.arr[index] = res.data;
	    }
	    checkDone();
	};
	// run the worker! GO GO GO!
	worker.postMessage(seq.arr[index]);
    }

    /** external functions */
    Seq.prototype.map = function (f, cb) {
	if (this.arr.length === 0) {
	    if (cb !== undefined) {
		cb(this.arr);
	    }
	    return this;
	}

	var that = this;
	var numResponse = 0;
	var newLatch = new Latch();
	var checkDone = function() {
	    if (++numResponse === that.arr.length) {
		if (cb !== undefined) {
		    cb(that.arr);
		}
		newLatch.runNext();
	    }
	}

	this.latch.register(function() {
	    for (var i = 0; i < that.arr.length; i++) {
		that.runWorker(f, i, checkDone);
	    }
	});
	this.latch = newLatch;
	return this;
    }

    this.Seq = Seq;

})();
