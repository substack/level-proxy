var level = require('level');
var levelSwap = require('../');

var a = level('/tmp/level-swap/a');
var b = level('/tmp/level-swap/b');

var db = levelSwap(a);
db.on('put', function (key, value) {
    console.log(key, '=>', value);
});

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
