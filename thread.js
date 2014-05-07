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

    function Seq(arr, max) {
        this.arr = arr === undefined ? [] : arr;
        this.required = [];
        this.latch = new Latch();
        this.latch.ready = true;
        this.max = max === undefined ? 2 : max;
		this.partArr = [];

        this.partition();
    }

    /** internal helper functions */
    
	// Creates code for worker function
	Seq.prototype.stringify = function (f) {

		// declare variables
		// var name;
        var s = '';
        for (var i = 0; i < this.required.length; i++) {
            s += 'var ' + this.required[i].name + ';\n';
        }
        for (var i = 0; i < this.latch.required.length; i++) {
            s += 'var ' + this.latch.required[i].name + ';\n';
        }

		// create on message function
        s += 'onmessage = function (msg) {\n';

		// initialize vars
		// var name = data;
        for (var i = 0; i < this.required.length; i++) {
            s += this.required[i].name + ' = msg.data.required['+i+'].data;\n';
        }
        for (var i = 0; i < this.latch.required.length; i++) {
            s += this.latch.required[i].name + ' = msg.data._required['+i+'].data;\n';
        }

        s += 'var intArr = new Int32Array(msg.data.threadData);\n'

		// worker executes on array elements in a for loop
		s += 'for(var i = 0; i < intArr.length; i++){\n';
					
		// execute function on single list item
		s += 'intArr[i] = ';
		s += '(' + f.toString() + ')(intArr[i]);\n';
		
		s += '}\n';

		// when done, post back to master, transferring back array
		s += 'postMessage( intArr.buffer, [intArr.buffer]);\n';

        // end of for loop
        s += '}';

        return s;
    }

	/**
	 * Partitions the user input array into subArrays for worker threads
	 * to operate on independently
	 */
	Seq.prototype.partition = function (){
        var seq = this

		var subLen = seq.arr.length/this.max;
		var offset = subLen;;
		var newArr = []

		for(var i = 0; i < seq.arr.length; i++){

			// reached the partition boundary
			if(i == offset){

				// create new partition if remaining array
				// elements can fill it
				if(offset < seq.arr.length){
                    var intArr = new Int32Array(newArr);
				    seq.partArr.push(intArr.buffer);
				    newArr = [];
				}

                offset += subLen;
			}

			newArr.push(seq.arr[i]);
		}

        var intArr = new Int32Array(newArr);
		// push on the last
		seq.partArr.push(intArr.buffer);
	}

    Seq.prototype.createWorker = function(f) {
        var worker;
        var fString;

		// copy partitioned array in

        fString = this.stringify(f);

        console.log("function: \n" + fString);

        try {
            var blob = new Blob([fString], { type: 'text/javascript' });
            worker = new Worker(window.URL.createObjectURL(blob));
        } catch (err) {
            throw err;
        }
        return worker;
    }

    Seq.prototype.getArr = function(){

        var seq = this;

        var sublen = seq.arr.length/seq.max;
        var offset = sublen;

        var intArrs = [];

        // change the partitioned arrays from buffers to arrays
        for(var i = 0; i < seq.max; i++){

            var intBuf = seq.partArr[i];

            var intArr = new Int32Array(intBuf)
            //console.log("worker " + i + " result array size " + intArr.length);

            // create array from buffer
            intArrs.push(intArr)
        }

        //console.log("seq len: " + seq.arr.length);

        for(var i = 0; i < seq.arr.length; i++){

            var index = i%sublen;
            var subArr = Math.floor(i/sublen);
            
            // hit the last array
            if(subArr == seq.max){
                
                subArr = seq.max - 1;
                index = sublen + index;
            }

            //console.log("part arr res " + subArr + " " + i + " " + intArr[subArr]);

            seq.arr[i] = intArrs[subArr][index];
        }

        return seq.arr;
    }

    Seq.prototype.runWorker = function (f, index, handleRes, checkDone, worker) {
        var seq = this;
        if (worker === undefined) {
            worker = this.createWorker(f);
        }
        worker.onmessage = function (res) {
            handleRes(worker, res.data, index);
            checkDone();
        };

        var transferArr = seq.partArr[index]

        // run the worker! GO GO GO!
		var data =
		{

			required: seq.required,
			_required: seq.latch.required,
            threadData: transferArr
		};

        worker.postMessage(data, [data.threadData]);
    }

    /** external functions */
    Seq.prototype.require = function (req) {
        this.required.push(req);
    }

    Seq.prototype.requireOnce = function (req) {
        this.latch.required.push(req);
    }

    Seq.prototype.map = function (f, cb) {
        var seq = this;
        var numResponse = 0;
        var newLatch = new Latch();
        var handleRes = function(worker, res, index) {

			// copy array back to master
			
			if (res !== undefined) {
                //console.log("worker " + index + " result " + res.toString());
                seq.partArr[index] = res;
            }

			// terminate this worker once it has finished with its partition
			worker.terminate();
        }
        var checkDone = function() {

			// proceed with callbacks when partitions have finished
            if (++numResponse === seq.max) {

                // copy results into array once all workers have returned
                seq.getArr();

                if (cb !== undefined) {
                    //console.log(seq.arr.toString());

                    cb(seq.arr);
                }
                newLatch.runNext();
            }
        }

        this.latch.register(function() {

			// if there's nothing in sequence, just run callbacks
            if (seq.arr.length === 0) {
                if (cb !== undefined) {
                    cb(seq.arr);
                }
                newLatch.runNext();
                return;
            }

			// spawn workers
            var max = seq.arr.length < seq.max ? seq.arr.length : seq.max;
            for (var i = 0; i < max; i++) {
                seq.runWorker(f, i, handleRes, checkDone);
            }

        });
        this.latch = newLatch;
        return this;
    }

    // not yet adapted
    Seq.prototype.filter = function (f, cb) {
        var seq = this;
        var numResponse = 0;
        var numStarted = 0;
        var temp = new Array(this.arr.length);
        var newLatch = new Latch();
        var handleRes = function(worker, res, index) {
            if (res !== undefined) {
                temp[index] = res;
            } else {
                temp[index] = false;
            }
            if (numStarted < seq.arr.length) {
                seq.runWorker(f, numStarted++, handleRes, checkDone, worker);
            } else {
                worker.terminate();
            }
        }
        var checkDone = function() {
            if (++numResponse === seq.arr.length) {
                var newArr = [];
                for (var i = 0; i < temp.length; i++) {
                    if (temp[i]) {
                        newArr.push(seq.arr[i]);
                    }
                }
                seq.arr = newArr;
                if (cb !== undefined) {
                    cb(seq.arr);
                }
                newLatch.runNext();
            }
        }

        this.latch.register(function() {
            if (seq.arr.length === 0) {
                if (cb !== undefined) {
                    cb(seq.arr);
                }
                newLatch.runNext();
                return;
            }
            var max = seq.arr.length < seq.max ? seq.arr.length : seq.max;
            for (var i = 0; i < max; i++) {
                seq.runWorker(f, i, handleRes, checkDone);
            }
            numStarted = max;
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
