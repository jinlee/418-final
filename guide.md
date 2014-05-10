---
layout: post
title: documentation
---

# Documentation #

### Get the code from Mozilla ###

We worked on Firefox release 28.0. It's best to obtain the same version before
swapping in our changes. Otherwise there will most definitely be strange build
errors.

The easiest way to obtain this release is to go to
<a href="ftp://ftp.mozilla.org/pub/mozilla.org/firefox/releases/28.0/source/">here</a>
and download the source tar.

The other option is to get it from their mercurial repository, but that will
take much longer as it comes with all the revisions.

###Get the code from this repo

Now that you have the code for Firefox, you can now swap in the files from this
project. The easiest way to do this is to do the following:

{% highlight bash %}
cd mozilla-release
mv js js_backup
git init
git remote add origin https://github.com/jinslee/418-final.git
git pull origin master
{% endhighlight %}

Now you are ready to build!

### Building ###

Building the js shell

{% highlight bash %}
cd mozilla-central/js/src
autoconf213 # or autoconf2.13 or autoconf-2.13
mkdir build_DBG.OBJ 
cd build_DBG.OBJ 
../configure
make
{% endhighlight %}

Now the shell can be run using `./js -i`

###Examples

Here are some examples to get you started.

{% highlight javascript %}
var foo = function (n) {
  return n * n;
}

var seq = new Seq([0, 1, 2, 3]);
seq.map(foo); // returns [0, 1, 4, 9]
{% endhighlight %}

You can also pass in the number of web workers that should be spawned. Usually
this should equal the number of cores that you have. If this isn't explicitly
passed in, the library defaults to `2`.

{% highlight javascript %}
var seq = new Seq([0, 1, 2, 3], 4); // 4 web workers will spawn
{% endhighlight %}

You can pass in a callback function to be run after the map has finished.

{% highlight javascript %}
var done = function(res) {
  console.log(res);
}
seq.map(foo, done);
{% endhighlight %}

You can chain multiple calls to map.

{% highlight javascript %}
seq.map(foo);
seq.map(foo, done);
// is the same as
seq.map(foo).map(foo, done);
{% endhighlight %}

You can pass in an auxiliary data structure using `require`. Be warned though,
because of how web workers are designed (they don't share the address space),
what you pass into `require` need to be explicitly copied to each worker.

{% highlight javascript %}
var seq = new Seq([3, 2, 1, 0]);
var aux = [10, 20, 30, 40];
seq.require({ name: 'aux', data: aux});
// the map function now has access to the 'aux' variable
seq.map(function (index) { return aux[index]; },
        function (res) { console.log(res); });
// returns the reverse of aux, [40, 30, 20, 10]
{% endhighlight %}

Here's a non-trivial example using `filter`.

{% highlight javascript %}
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
primes.filter(isPrime, function (res) { console.log(res); });
// only returns primes!
{% endhighlight %}

### Annotations

With annotations, it is easier to take existing code and make it parallel.
Furthremore, in browsers that do not support these annotations, the code
maintains to be correct, although sequential.

Here is an example of their usage:

{% highlight javascript %}
for (var i = 0; i < arr.length; i++) {
    if (arr[i] === 0) {
        arr[i] = 1234;
    }
    arr[i] *= arr[i];
}
{% endhighlight %}

This code can be executed in parallel, and thus you can use annotations to
parallelize as follows:

{% highlight javascript %}
//! :arr
for (var i = 0; i < arr.length; i++) {
    if (arr[i] === 0) {
        arr[i] = 1234;
    }
    arr[i] *= arr[i];
}
//?
{% endhighlight %}

The `//!` denotes the beginning of the for loop. You must also pass in the name
of the array that is being iterated over. The syntax is `:` followed by the
array name.

The `//?` is denoting what we call 'asynchronous dependency'. We will explore
this more later.

With these annotations, the browser will silently use the thread library and run
multithreaded code.

It is also possible to chain multiple for loops:
{% highlight javascript %}
//! :arr
for (var i = 0; i < arr.length; i++) {
    arr[i] *= arr[i];
}

//! :arr
for (var i = 0; i < arr.length; i++) {
    arr[i] -= arr[i];
}
//?
{% endhighlight %}

Under the hood, the first for loop gets executed using `map`, and after it has
finished the second for loop is executed.

The `//?` is used to denote 'asynchronous dependency' in the code. The problem
is that the `map` function is asynchronous - it returns **before** the
computation has finished.

The problem is that in sequential code, code that executes after the for loop
are executing **after** the computation in the for loop has finished. For
example:

{% highlight javascript %}
for (var i = 0; i < arr.length; i++) {
    // some parallel computation
}

for (var i = 0; i < arr.length; i++) {
    // some computation that must be executed sequentially
}
{% endhighlight %}

Here, the second for loop needs to run **after** the first for loop has
finished. Thus the `//?` is a way to denote this dependency of the second for
loop on the first parallel for loop.

So the correct way to annotate this is as follows:

{% highlight javascript %}
//! :arr
for (var i = 0; i < arr.length; i++) {
    // some parallel computation
}

for (var i = 0; i < arr.length; i++) {
    // some computation that must be executed sequentially
}
//?
{% endhighlight %}
