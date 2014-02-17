var test = require('tape');
var level = require('level');
var levelProxy = require('../');
var tmpdir = require('os').tmpdir();

var through = require('through');
var through2 = require('through2');

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
    t.plan(8);
    
    function arows (rows) {
        t.deepEqual(rows, [
            { key: 'a', value: 3 },
            { key: 'b', value: 4 },
            { key: 'c', value: 5 }
        ]);
    }
    
    function akeys (keys) {
        t.deepEqual(keys, [ 'a', 'b', 'c' ]);
    }
    
    function avalues (values) {
        t.deepEqual(values, [ 3, 4, 5 ]);
    }
    
    var db = levelProxy();
    
    collect(db.createReadStream(), arows);
    collect2(db.createReadStream(), arows);
    db.createReadStream().pipe(concat(arows));
    db.createReadStream().pipe(concat2(arows));
    
    collect(db.createKeyStream(), akeys);
    collect2(db.createKeyStream(), akeys);
    db.createKeyStream().pipe(concat(akeys));
    db.createKeyStream().pipe(concat2(akeys));
    
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

function concat (cb) {
    var rows = [];
    return through(write, end);
    function write (row) { rows.push(row) }
    function end () { cb(rows) }
}

function concat2 (cb) {
    var rows = [];
    return through2({ objectMode: true }, write, end);
    function write (row, enc, next) { rows.push(row); next() }
    function end () { cb(rows) }
}
