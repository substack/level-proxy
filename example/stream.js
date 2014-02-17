var level = require('level');
var levelSwap = require('../');

var a = level('/tmp/level-swap/a');
var b = level('/tmp/level-swap/b');

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

var db = levelSwap(a);

setInterval(function () {
    var s = db.createReadStream();
    s.on('data', function (r) { process.stdout.write(r.key + ' ') });
    s.on('end', function () { process.stdout.write('\n') })
}, 1000);

var index = 0;
setInterval(function () {
    db.swap([ a, b ][++ index % 2]);
}, 3000);
