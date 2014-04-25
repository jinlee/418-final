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

The simplest form of parallel programming are threads. Web workers were recently
supported with the release of
[HTML 5](https://developer.mozilla.org/en-US/docs/Web/Guide/Performance/Using_web_workers).
But their usage isn't as straightforward as using pthread. We wanted to provide
a simple developer facing api that abstracts away their usage. Thus we chose to
implement `map`, `filter`, and `reduce`. Here's an example of their usage:

``` javascript
var seq = new Seq([10, 30, 50, 70]);
seq.map(function (n)   { return n * n; },
        function (res) { print(res); });
// the second function is a callback that runs once the map has finished
```

More examples can be found in the [Documentation](guide.html) section

#### OpenMP ####

In OpenMP, you can declare certain parts of the code to be safe for
parallelization. For example:

``` c
#pragma omp parallel for
for (int i = 0; i < N; i++) {
    foo(i);
}
```

Declares that each iteration of the for loop can be executed in parallel without
affecting the correctness of the program. This kind of declaration allows the
compiler to emit parallel code (pthreads in the case for OpenMP) that take
advantage of this fact.

We wanted to support this kind of parallelization in Javascript. We achieve this
by changing the Spidermonkey's internal parser. We set in place several
'triggers' that changes the parser to generate code using the threading api
mentioned above. Here's a very simple demo of how it works.

Consider the following code, annotated with the special 'triggers'.

``` javascript
var arr = [10, 20, 50, 100];
//! indexer:i data:arr ret:arr[i]
for (var i = 0; i < arr.length; i++) {
    arr[i] *= 100;
}
//?
print(arr);
```

The two triggers are `//!` and `//?`. The `//!` denotes the beginning of a for
loop that can be executed in parallel. `//?` denotes the end of the for loop.
The `//!` also gives extra information, such as the variable used to index, the
data that the for loop indexer over, and the expression that is equivalent to
the result of this computation. It's not ideal that the programmer provide this
information, but due to the contraints of web workers, this was necessary.

Using these triggers and extra information, the parser will generate the
following code.

``` javascript
var arr = [10, 20, 50, 100];
var __seq = new Seq(_.range(arr.length));
__seq.require({ name: 'arr', data: arr });
seq.map(function (i) {
    arr[i] *= 100;
    return arr[i];
}, function (res) {
    arr = res;
    print(arr);
});
```

As you can see, it's a quite a bit of extra code that gets generated. I think
this is an indication that this OpenMP style parallelization is useful. It makes
writing parallel code much easier than doing it by hand.

## Results ##

TODO!
