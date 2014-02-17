var level = require('level');
var levelProxy = require('../');

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
