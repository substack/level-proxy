var test = require('tape');
var level = require('level');
var levelProxy = require('../');
var os = require('os');
var tmpdir = os.tmpdir ? os.tmpdir() : os.tmpDir();

var a = level(tmpdir + '/level-swap-a-' + Math.random(), { encoding: 'json' });
var b = level(tmpdir + '/level-swap-b-' + Math.random(), { encoding: 'json' });
var db = levelProxy(a);

test(function (t) {
    t.plan(404);
    
    var n = 0;
    var last = {};
    var times = 0;
    
    function next () {
        db.put('x', n + 1, function (err) {
            if (err) t.fail(err);
            read();
            
            if (++ times % 5 === 0) {
                console.log('SWAP');
                db.swap([ a, b ][++ index % 2]);
            }
            n ++;
        });
    }
    read();
    
    function read () {
        if (stop) return;
        
        var ix = index % 2;
        var pending = 2;
        function done () { if (--pending === 0) next() }
        
        a.get('x', function (err, x) {
            if (ix === 0) {
                t.equal(x, n, 'a on');
                last.a = n;
            }
            else {
                t.equal(x, last.a, 'a off');
            }
            done();
        });
        b.get('x', function (err, x) {
            if (ix === 1) {
                t.equal(x, n, 'b on');
                last.b = n;
            }
            else {
                t.equal(x, last.b, 'b off');
            }
            done();
        });
    }
    
    var index = 0;
    var stop = false;
    t.on('end', function () { stop = true });
});
