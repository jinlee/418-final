/**
 * This is a library to support threaded processing on javascript
 */

(function() {

    function Latch(next) {
        this.ready = false;
        this.next = next;
        this.required = [];
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

    function Seq(arr) {
        this.arr = arr === undefined ? [] : arr;
        this.required = [];
        this.latch = new Latch();
        this.latch.ready = true;
    }

    /** internal helper functions */
    Seq.prototype.stringify = function (f) {
        var s = '';
        for (var i = 0; i < this.required.length; i++) {
            s += 'var ' + this.required[i].name + ';\n';
        }
        for (var i = 0; i < this.latch.required.length; i++) {
            s += 'var ' + this.latch.required[i].name + ';\n';
        }

        s += 'onmessage = function (msg) {\n';

        for (var i = 0; i < this.required.length; i++) {
            s += this.required[i].name + ' = msg.data.required['+i+'].data;\n';
        }
        for (var i = 0; i < this.latch.required.length; i++) {
            s += this.latch.required[i].name + ' = msg.data._required['+i+'].data;\n';
        }
        s += 'postMessage( (' + f.toString() + ')(msg.data.data) ); }';
        return s;
    }

    Seq.prototype.createWorker = function(f) {
        var worker;
        var fString;
        fString = this.stringify(f);
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
            worker.terminate();
            if (res.data !== undefined) {
                seq.arr[index] = res.data;
            }
            checkDone();
        };
        // run the worker! GO GO GO!
        worker.postMessage({ data: seq.arr[index],
                             required: seq.required,
                             _required: seq.latch.required });
    }


    /** external functions */
    Seq.prototype.require = function (req) {
        this.required.push(req);
    }

    Seq.prototype.requireOnce = function (req) {
        this.latch.required.push(req);
    }

    Seq.prototype.map = function (f, cb) {
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
            if (that.arr.length === 0) {
                if (cb !== undefined) {
                    cb(that.arr);
                }
                newLatch.runNext();
                return;
            }
            for (var i = 0; i < that.arr.length; i++) {
                that.runWorker(f, i, checkDone);
            }
        });
        this.latch = newLatch;
        return this;
    }


    /** internal helper functions for the parser */
    function _() {
    }

    _.range = function (n) {
        var r = new Array(n);
        for (var i = 0; i < n; i++) {
            r[i] = i;
        }
        return r;
    }

    _.makeSeq = function(arr, name) {
        return new Seq(_.range(arr.length), { name: name, data: arr});
    }

    this.Seq = Seq;
    this._ = _;

})();
