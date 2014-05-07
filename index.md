---
layout: post
title: final report
---

## Summary ##

This project is an attempt to add as many data parallel programming constructs
to javascript as possible.

## Background ##

Javascript has become a dominant language used on the web. However, javascript
is inherently a single threaded programming language. It gets around this
problem by using asynchronous callbacks, but this only hides the problem. This
project is an attempt at actually solving this problem by providing data
parallel programming constructs to javascript.

To do this we employ web workers and Spidermonkey (Mozilla's javascript engine).

## Approach ##

#### Threads ####

The simplest form of parallel programming are threads. Javascript wasn't able to
spawn separate threads until recently when web workers were introduced with the
release of [HTML 5](https://developer.mozilla.org/en-US/docs/Web/Guide/Performance/Using_web_workers).

But the problem was that their usage wasn't as straightforward as spawning a
thread by calling a function such as `spawn_thread`. In fact, using web workers
is rather convoluted. Thus we wanted to provide a simple developer facing api
that abstracts away their usage. Thus we chose to implement `map`, `filter` and
`sort` that uses web workers internally to parallelize the execution. Here's an
example of their usage:

{% highlight javascript %}
var seq = new Seq([1, 2, 3, 4]);
seq.map(function (n)   { return n * n; },
        function (res) { console.log(res); });
// the second function is a callback that runs once the map has finished
// this will log [1, 4, 9, 16]
{% endhighlight %}

More examples can be found in the [Documentation](guide.html) section

#### OpenMP ####

We thought that the threading api was useful, but wanted it even easier for
developers to take existing code and add in parallelism. This is why we turned
to OpenMP style declarations.

In OpenMP, you can declare certain parts of the code to be safe for
parallelization. For example:

{% highlight cpp %}
#pragma omp parallel for
for (int i = 0; i < N; i++) {
    foo(i);
}
{% endhighlight %}

Declares that each iteration of the for loop can be executed in parallel without
affecting the correctness of the program. This kind of declaration allows the
compiler to emit parallel code (pthreads in the case for OpenMP) that take
advantage of this fact.

We wanted to support this kind of parallelization in Javascript. We achieve this
by changing the Spidermonkey's internal parser. We set in place several
'triggers' that changes the parser to generate code using the threading api
mentioned above. Here's a very simple demo of how it works.

Consider the following code, annotated with the special 'triggers'.

{% highlight javascript %}
var arr = [10, 20, 50, 100];
//! array:arr indexer:i
for (var i = 0; i < arr.length; i++) {
    arr[i] *= 100;
}
console.log(arr);
//?
{% endhighlight %}

The two triggers are `//!` and `//?`. The `//!` denotes the beginning of a
forloop that can be executed in parallel. The `//!` also passes in extra
information, such as the name of the array and the variable that's being used to
index over the array. The second trigger, `//?` denotes the end of the what we
call "asynchronous dependency". This is discussed further below.

Using these triggers and extra information, the parser will generate the
following code.

{% highlight javascript %}
var arr = [10, 20, 50, 100];
var __seq = new Seq(arr);
__seq.map(function (__n) {
    __n *= 100;
    return __n;
}, function (res) {
    arr = res;
    console.log(arr);
});
{% endhighlight %}

The first thing to notice is that `arr[i]` has been replaced by `__n`. The
second thing to notice is that the `console.log(arr)` has been placed into the
callback function.

Due to the asynchronous nature of javascript, this needs to be done in order to
ensure correctness. In the original sequential code, the programmer expects
`console.log(arr)` to execute **after** the for loop. But the problem is that
`map` functionality is asynchronous - it returns **before** the workers have
finished their computation.

Thus the programmer needs to tell us of "asynchronous dependencies" in their
code. Basically they need to tell us what part of their code needs to be
executed **after** the `map` has finished executing. That's the reason that we
require the `//?` trigger.

So it's clear that there's quite a bit of extra code and logic that gets
generated. I think this is an indication that this OpenMP style parallelization
is useful. It makes writing parallel code much easier than doing it by hand.

## Limitations ##

TODO!

## Results ##

#### Mandelbrot ####

Here's a mandelbrot set image rendered using our thread library.

![](mandel.png)

table of graph of execution time will be inserted here later.
