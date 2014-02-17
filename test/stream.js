var test = require('tape');
var level = require('level');
var levelProxy = require('../');
var tmpdir = require('os').tmpdir();

var a = level(tmpdir + '/level-swap-a-' + Math.random(), { encoding: 'json' });
var b = level(tmpdir + '/level-swap-b-' + Math.random(), { encoding: 'json' });

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

test(function (t) {
    t.plan(2);
    
    var db = levelProxy();
    collect(db.createReadStream(), function (rows) {
        t.deepEqual(rows, [
            { key: 'a', value: 3 },
            { key: 'b', value: 4 },
            { key: 'c', value: 5 }
        ]);
    });
    
    collect2(db.createReadStream(), function (rows) {
        t.deepEqual(rows, [
            { key: 'a', value: 3 },
            { key: 'b', value: 4 },
            { key: 'c', value: 5 }
        ]);
    });
    
    setTimeout(function () {
        db.swap(a);
    }, 50);
});

function collect (s, cb) {
    var rows = [];
    s.on('data', function (row) { rows.push(row) });
    s.on('end', function () { cb(rows) });
}

function collect2 (s, cb) {
    var rows = [];
    s.on('readable', onread);
    s.on('end', function () { cb(rows) });
    onread();
    
    function onread () {
        var row;
        while ((row = s.read()) !== null) {
            rows.push(row);
        }
    }
}
