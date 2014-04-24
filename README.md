#418-final

This is the final project for 15-418. We'll be exploring ways to make javascript parallel.

We'll be doing this by using web workers and hacking on Mozilla's Spidermonkey.

###Get the code from Mozilla

We worked on Firefox release 28.0. It's best to obtain the same version before swapping in our changes. Otherwise there will most definitely be strange build errors.

The easiest way to obtain this release is to go to <a href="https://ftp.mozilla.org/pub/mozilla.org/firefox/releases/28.0/source/">here</a> and download the source tar.

The other option is to get it from their mercurial repository, but that will take much longer as it comes with all the revisions.

###Get the code from this repo

Now that you have the code for Firefox, you can now swap in the files from this project. The easiest way to do this is to do the following:

```
cd mozilla-release
mv js js_backup
git init
git remote add origin https://github.com/jinslee/418-final.git
git pull origin master
```

Now you are ready to build!

###Building

Building the js shell

```
cd mozilla-release/js/src
autoconf213 # or autoconf2.13 or autoconf-2.13
mkdir build_DBG.OBJ 
cd build_DBG.OBJ 
../configure
make
```

Run the shell using `./js -i`


###Examples

Here are some examples to get you started.
```javascript
var foo = function (n) {
  return n * n;
}

var seq = new Seq([0, 1, 2, 3]);
seq.map(foo); // returns [0, 1, 4, 9]
```

You can also pass in an callback function to be run after the map has finished.
```javascript
var done = function(res) {
  console.log(res);
}
seq.map(foo, done);
```

You can chain multiple calls to map.
```javascript
seq.map(foo);
seq.map(foo, done);
// is the same as
seq.map(foo).map(foo, done);
```

You can pass in an auxiliary data structure using `require`. Be warned though, because of how web workers are designed (they don't share the address space), what you pass into `require` need to be explicitly copied to each worker.
```javascript
var seq = new Seq([3, 2, 1, 0]);
var aux = [10, 20, 30, 40];
seq.require({ name: 'aux', data: aux});
// the map function now has access to the 'aux' variable
seq.map(function (index) { return aux[index]; },
        function (res) { console.log(res); });
// returns the reverse of aux, [40, 30, 20, 10]
```

Here's a non-trivial example using `filter`.
```javascript
var primes = new Seq(_.range(1000)); // _.range(n) returns [0, ..., n - 1]

// a simple prime checker
var isPrime = function (n) {
  if (n === 0 || n === 1) {
    return false;
  }
  for (var i = 2; i < n; i++) {
    if (n % i === 0) {
      return false;
    }
  }
  return true;
}
primes.filter(isPrime, function (res) { console.log(res); }); // returns only primes!
```
