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
