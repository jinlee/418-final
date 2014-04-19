#418-final

This is the final project for 15-418. We'll be exploring ways to make javascript parallel.

We'll be doing this by using web workers and hacking on Mozilla's Spidermonkey.

###Get the code from Mozilla

First get the correct build from Mozilla:

```
hg clone -r 177109 http://hg.mozilla.org/mozilla-central mozilla-central
```

Note that to avoid errors, it's best to clone revision `177109`. This is the revision that we worked with. Also this part may take a while... There's a lot of code!

Now you can clone this repo, and put the js/ folder into the top level directory that you just created.

###Get the code from this repo

There are two options here. The hack-ish way is to simply git clone this directory, which gives you the 418-final/ folder. Inside is the js/ folder that needs to be stuck into mozilla-central for the build to work.

So you can do this by copying the contents of 418-final/* (including .git and .gitignore) into mozilla-central/


The second option is to do the following

```
cd mozilla-central
mv js js_backup
git init
git remote add origin https://github.com/jinslee/418-final.git
git pull origin master
```

Now you should be ready to build!

###Building

Building the js shell

```
cd mozilla-central/js/src
autoconf213 # or autoconf2.13 or autoconf-2.13
mkdir build_DBG.OBJ 
cd build_DBG.OBJ 
../configure --enable-debug --disable-optimize
make
```

Now the shell should be located at `mozilla-central/js/src/build_DBG.OBJ/js/src/js`

Run it using `./js -i`


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
