# level-swap

proxy a leveldb reference so you can swap backend instances on the fly

This is useful for modules that need to switch out references transparently,
like automatically upgrading an ordinary vanilla reference into a multilevel
handle. You could probably also use this module to implement even crazier
things, like a transparent hash ring.

# example

In this example, we'll create 2 db handles proxied by the level-swap handle
`db`: `a` and `b`. The handles will swap into being the active handle every 3
seconds.

``` js
var level = require('level');
var levelSwap = require('level-swap');

var a = level('/tmp/level-swap/a');
var b = level('/tmp/level-swap/b');
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

# methods

``` js
var levelSwap = require('level-swap');
```

## var db = levelSwap(initDb)

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
