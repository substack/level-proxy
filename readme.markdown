# level-proxy

proxy a leveldb reference so you can swap backend instances on the fly

[![build status](https://secure.travis-ci.org/substack/level-proxy.png)](http://travis-ci.org/substack/level-proxy)

This is useful for modules that need to switch out references transparently,
like automatically upgrading an ordinary vanilla reference into a multilevel
handle. You could probably also use this module to implement even crazier
things, like a transparent hash ring.

# example

In this example, we'll create 2 db handles proxied by the level-proxy handle
`db`: `a` and `b`. The handles will swap into being the active handle every 3
seconds.

``` js
var level = require('level');
var levelSwap = require('level-proxy');

var a = level('/tmp/db-a');
var b = level('/tmp/db-b');
var db = levelSwap(a);

var n = 0;
setInterval(function () { db.put('x', n++) }, 250);

setInterval(function () {
    a.get('x', function (err, x) { console.log('a.x=', x) });
    b.get('x', function (err, x) { console.log('b.x=', x) });
}, 1000);

var index = 0;
setInterval(function () {
    db.swap([ a, b ][++ index % 2]);
}, 3000);
```

output:

```
$ node example/swap.js
a.x= 2
b.x= 22
a.x= 6
b.x= 22
a.x= 10
b.x= 22
a.x= 10
b.x= 14
a.x= 10
b.x= 18
^C
```

You can proxy streaming methods with buffering too:

``` js
var level = require('level');
var levelProxy = require('level-proxy');

var a = level('/tmp/stream-a');
var b = level('/tmp/stream-b');

a.batch([
    { type: 'put', key: 'a', value: 3 },
    { type: 'put', key: 'b', value: 4 },
    { type: 'put', key: 'c', value: 5 },
]);

b.batch([
    { type: 'put', key: 'x', value: 7 },
    { type: 'put', key: 'y', value: 8 },
    { type: 'put', key: 'z', value: 9 },
]);

var db = levelProxy();

setInterval(function () {
    var s = db.createKeyStream();
    var keys = [];
    s.on('data', function (key) { keys.push(key) })
    s.on('end', function () { console.log(keys) });
}, 1000);

var index = 0;
setInterval(function () {
    db.swap([ a, b ][++ index % 2]);
}, 3000);
```

output:

```
$ node example/stream.js
[ 'x', 'y', 'z' ]
[ 'x', 'y', 'z' ]
[ 'x', 'y', 'z' ]
[ 'x', 'y', 'z' ]
[ 'x', 'y', 'z' ]
[ 'a', 'b', 'c' ]
[ 'a', 'b', 'c' ]
[ 'a', 'b', 'c' ]
[ 'x', 'y', 'z' ]
[ 'x', 'y', 'z' ]
[ 'x', 'y', 'z' ]
[ 'a', 'b', 'c' ]
^C
```

# methods

``` js
var levelProxy = require('level-proxy');
```

## var db = levelProxy(initDb)

Create a new proxied database handle `db`, including events. All the leveldown
methods are available on the `db` instance and all method calls will be queued
when a database handle isn't yet available so you can start using the handle
immediately.

You can optionally give an initial `initDb` handle to use, which is the same as
calling `db.swap(initDb)` after creating an instance.

## db.swap(newDb)

Swap out the db's internal proxy for a leveldb handle `newDb`.

Any buffered method calls that have queued up will fire on `newDb` on the same
tick.

This event triggers a `'swap'` event with the `newDb` reference.

## db.get(), db.put(), db.batch(), db.createReadStream(), ...

All of these methods behave the same as with an ordinary level db handle.

## db.db.iterator(), ...

leveldown methods such as `db.db.iterator()` are also proxied.

# install

With [npm](https://npmjs.org) do:

```
npm install level-proxy
```

# license

MIT
