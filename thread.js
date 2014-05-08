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

        var s = this.stringifyInit()

        // create on message function
        s += 'onmessage = function (msg) {\n';

        s += this.stringifyLoop(f);

		// when done, post back to master, transferring back array
		s += 'postMessage( intArr.buffer, [intArr.buffer]);\n';

        // end of for loop
        s += '}';

        return s;
    }

    Seq.prototype.stringifyInit = function() {

        // declare variables
        // var name;
        var s = '';
        for (var i = 0; i < this.required.length; i++) {
            s += 'var ' + this.required[i].name + ';\n';
        }
        for (var i = 0; i < this.latch.required.length; i++) {
            s += 'var ' + this.latch.required[i].name + ';\n';
        }

        return s;
    }

    Seq.prototype.stringifyLoop = function (f){

        // initialize vars
        // var name = data;
        var s = '';

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

        return s;

    }

    Seq.prototype.stringifySort = function(f, compF){

        var s = this.stringifyInit();

        // create on message function
        s += 'onmessage = function (msg) {\n';

        s += this.stringifyLoop(f);

        s += "console.log(\"sorter doing sort stuff\");"

        // use array sort
        s += '[].sort.call(intArr,' + compF.toString() + ');\n'

        s += "console.log(\"sorter finished sorting stuff\");"

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

		var subLen = Math.floor(seq.arr.length/this.max);
		var offset = subLen;;
		var newArr = []

		for(var i = 0; i < seq.arr.length; i++){

			// reached the partition boundary
			if(i == offset){

				// create new partition if remaining array
				// elements can fill it
				if(offset < seq.arr.length-1){
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

        fString = this.stringify(f);

        try {
            var blob = new Blob([fString], { type: 'text/javascript' });
            worker = new Worker(window.URL.createObjectURL(blob));
        } catch (err) {
            throw err;
        }
        return worker;
    }

    Seq.prototype.createSorter = function(f, compF){

        fString = this.stringifySort(f, compF);

        console.log("sort function: \n" + fString);

        try {
            var blob = new Blob([fString], { type: 'text/javascript' });
            worker = new Worker(window.URL.createObjectURL(blob));
        } catch (err) {
            throw err;
        }
        return worker;
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

    Seq.prototype.getArr = function(){

        var seq = this;

        var sublen = Math.floor(seq.arr.length/seq.max);
        var offset = sublen;

        var intArrs = [];

        // change the partitioned arrays from buffers to arrays
        for(var i = 0; i < seq.max; i++){

            var intBuf = seq.partArr[i];

            var intArr = new Int32Array(intBuf)

            // create array from buffer
            intArrs.push(intArr)
        }

        for(var i = 0; i < seq.arr.length; i++){

            var index = i%sublen;
            var subArr = Math.floor(i/sublen);
            
            // hit the last array
            if(subArr == seq.max){
                
                subArr = seq.max - 1;
                index = sublen + index;
            }

            seq.arr[i] = intArrs[subArr][index];
        }

        return seq.arr;
    }

    Seq.prototype.sortRes = function(compF){

        var seq = this;

        var sublen = Math.floor(seq.arr.length/seq.max);
        var offset = sublen;

        var inputArrs = [];
        var outputArrs = [];

        var left;
        var right;

        // change the partitioned arrays from buffers to arrays
        for(var i = 0; i < seq.max; i++){

            var intBuf = seq.partArr[i];

            var intArr = new Int32Array(intBuf)

            // create array from buffer
            inputArrs.push(intArr)
        }

        // merge down to 1
        while(inputArrs.length > 1){

            // pull out the arrays and merge them
            while(inputArrs.length > 1){

                left = inputArrs.pop();
                right = inputArrs.pop();

                // add the merged output
                outputArrs.push(merge(left, right, compF));
            }

            // output becomes input
            inputArrs = outputArrs;
        }

        var res = [];

        // there can only be one HIGHLANDERRRR
        for(var i = 0; i < inputArrs[0].length; i++){
            res.push(inputArrs[0][i])
        }

        seq.arr = res;

        return res;
    }

    function merge(left, right, compF){

        var result = [];
        var leftInd = 0;
        var rightInd = 0;

        var leftLen = left.length;
        var rightLen = right.length;

        var leftEl;
        var rightEl;

        // iterate through the arrays
        while(leftInd < leftLen || rightInd < rightLen){

            // if both have elements, merge
            if(leftInd < leftLen && rightInd < rightLen){

                leftEl = left[leftInd];
                rightEl = right[rightInd];

                // choose the 'smaller' element
                if(compF(leftEl, rightEl) < 0){
                    leftInd++;
                    result.push(leftEl);
                }else{
                    rightInd++;
                    result.push(rightEl);
                }
            // push on remainder of left
            }else if(leftInd < leftLen){

                result.push(left[leftInd++]);

            // push on remainder of right
            }else{

                result.push(right[rightInd++]);
            }
        }

        return new Int32Array(result);
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

    Seq.prototype.mapsort = function(f, compF, cb){
        var seq = this;
        var numResponse = 0;
        var newLatch = new Latch();

        console.log("sorting\n");

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

                // sort the responses into a single array
                var sorted = seq.sortRes(compF);

                if (cb !== undefined) {
                    //console.log(seq.arr.toString());

                    cb(sorted);
                }
                newLatch.runNext();
            }
        }

        this.latch.register(function() {

            console.log("about to do stuff");

            // if there's nothing in sequence, just run callbacks
            if (seq.arr.length === 0) {
                if (cb !== undefined) {
                    cb(seq.arr);
                }
                newLatch.runNext();
                return;
            }

            console.log("spawning workers");

            // spawn workers
            var max = seq.arr.length < seq.max ? seq.arr.length : seq.max;
            for (var i = 0; i < max; i++) {
                console.log("spawning");

                var sorter = seq.createSorter(f, compF);
                seq.runWorker(f, i, handleRes, checkDone, sorter);
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
