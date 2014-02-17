var test = require('tape');
var level = require('level');
var levelProxy = require('../');
var os = require('os');
var tmpdir = os.tmpdir ? os.tmpdir() : os.tmpDir();

var through = require('through');
var through2 = require('through2');

var a = level(tmpdir + '/level-swap-a-' + Math.random(), { encoding: 'json' });
var b = level(tmpdir + '/level-swap-b-' + Math.random(), { encoding: 'json' });

test('setup', function (t) {
    var pending = 2;
    a.batch([
        { type: 'put', key: 'a', value: 3 },
        { type: 'put', key: 'b', value: 4 },
        { type: 'put', key: 'c', value: 5 },
    ], done);

    b.batch([
        { type: 'put', key: 'x', value: 7 },
        { type: 'put', key: 'y', value: 8 },
        { type: 'put', key: 'z', value: 9 },
    ], done);
    
    function done () { if (--pending === 0) t.end() }
});

test('stream swapping', function (t) {
    t.plan(12 * 6);
    
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
    
    function brows (rows) {
        t.deepEqual(rows, [
            { key: 'x', value: 7 },
            { key: 'y', value: 8 },
            { key: 'z', value: 9 }
        ]);
    }
    
    function bkeys (keys) {
        t.deepEqual(keys, [ 'x', 'y', 'z' ]);
    }
    
    function bvalues (values) {
        t.deepEqual(values, [ 7, 8, 9 ]);
    }
    
    var db = levelProxy();
    expectA();
    
    setTimeout(function () {
        db.swap(a);
        expectA();
        
        db.swap(b);
        expectB();
        setTimeout(function () {
            expectB();
            db.swap(a);
            expectA();
            
            db.swap(null);
            expectB();
            setTimeout(function () {
                db.swap(b);
            }, 50);
        }, 50);
    }, 50);
    
    function expectA () {
        collect(db.createReadStream(), arows);
        collect2(db.createReadStream(), arows);
        db.createReadStream().pipe(concat(arows));
        db.createReadStream().pipe(concat2(arows));
        
        collect(db.createKeyStream(), akeys);
        collect2(db.createKeyStream(), akeys);
        db.createKeyStream().pipe(concat(akeys));
        db.createKeyStream().pipe(concat2(akeys));
        
        collect(db.createValueStream(), avalues);
        collect2(db.createValueStream(), avalues);
        db.createValueStream().pipe(concat(avalues));
        db.createValueStream().pipe(concat2(avalues));
    }
    
    function expectB () {
        collect(db.createReadStream(), brows);
        collect2(db.createReadStream(), brows);
        db.createReadStream().pipe(concat(brows));
        db.createReadStream().pipe(concat2(brows));
        
        collect(db.createKeyStream(), bkeys);
        collect2(db.createKeyStream(), bkeys);
        db.createKeyStream().pipe(concat(bkeys));
        db.createKeyStream().pipe(concat2(bkeys));
        
        collect(db.createValueStream(), bvalues);
        collect2(db.createValueStream(), bvalues);
        db.createValueStream().pipe(concat(bvalues));
        db.createValueStream().pipe(concat2(bvalues));
    }
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
