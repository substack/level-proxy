var test = require('tape');
var level = require('level');
var levelProxy = require('../');
var os = require('os');
var tmpdir = os.tmpdir ? os.tmpdir() : os.tmpDir();

var through = require('through');
var through2 = require('through2');

var a = level(tmpdir + '/level-swap-a-' + Math.random(), { encoding: 'json' });
var b = level(tmpdir + '/level-swap-b-' + Math.random(), { encoding: 'json' });

test('iterator setup', function (t) {
    t.plan(2);
    
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
    
    function done (err) { t.ifError(err) }
});

test('waiting iterator', function (t) {
    t.plan(6);
    var pa = levelProxy();
    var ia = pa.db.iterator({ gte: 'b', lt: 'z' });
    var expected = [ 'b', '4', 'c', '5' ];
    ia.next(onnext);
    
    function onnext (err, key, value) {
        t.ifError(err);
        t.equal(key.toString('utf8'), expected.shift());
        t.equal(value.toString('utf8'), expected.shift());
        if (expected.length) ia.next(onnext);
    }
    
    setTimeout(function () {
        pa.swap(a);
    }, 20);
});

test('resolved iterator', function (t) {
    t.plan(6);
    var pa = levelProxy();
    pa.swap(a);
    var ia = pa.db.iterator({ gte: 'b', lt: 'z' });
    var expected = [ 'b', '4', 'c', '5' ];
    ia.next(onnext);
    
    function onnext (err, key, value) {
        t.ifError(err);
        t.equal(key.toString('utf8'), expected.shift());
        t.equal(value.toString('utf8'), expected.shift());
        if (expected.length) ia.next(onnext);
    }
});

test('waiting iterator end', function (t) {
    t.plan(4);
    var pa = levelProxy();
    var ia = pa.db.iterator({ gte: 'b', lt: 'z' });
    ia.next(onnext);
    
    function onnext (err, key, value) {
        t.ifError(err);
        t.equal(key.toString('utf8'), 'b');
        t.equal(value.toString('utf8'), '4');
        ia.end(function (err) {
            t.ifError(err);
        });
    }
    setTimeout(function () {
        pa.swap(a);
    }, 20);
});

test('resolved iterator end', function (t) {
    t.plan(4);
    var pa = levelProxy();
    pa.swap(a);
    var ia = pa.db.iterator({ gte: 'b', lt: 'z' });
    ia.next(onnext);
    
    function onnext (err, key, value) {
        t.ifError(err);
        t.equal(key.toString('utf8'), 'b');
        t.equal(value.toString('utf8'), '4');
        ia.end(function (err) {
            t.ifError(err);
        });
    }
});
