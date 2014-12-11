var inherits = require('inherits');
var EventEmitter = require('events/');
var PassThrough = require('readable-stream').PassThrough;
var through = require('through2');
var copy = require('shallow-copy');
var jsonEncoding = {
    encode: function (obj) { return JSON.stringify(obj) },
    decode: function (s) { return JSON.parse(s) }
};

var EVENT_KEYS = [ 'put', 'del', 'batch' ];

module.exports = LevelProxy;
inherits(LevelProxy, EventEmitter);

function LevelProxy (db) {
    var self = this;
    if (!(this instanceof LevelProxy)) return new LevelProxy(db);
    this._proxyQueue = [];
    this._proxyListeners = {};
    this._proxyIterators = [];
    this.db = {
        open: function (opts, cb) {
            return self.open(down(opts), cb);
        },
        batch: function (rows, opts, cb) {
            return self.batch(rows, down(opts), cb)
        },
        get: function (key, opts, cb) {
            return self.get(key, down(opts), cb)
        },
        put: function (key, value, opts, cb) {
            return self.put(key, value, down(opts), cb)
        },
        del: function (key, opts, cb) {
            return self.del(key, down(opts), cb)
        },
        iterator: function (opts) {
            return self.iterator(down(opts));
        },
        close: function (cb) {
            return self.close(cb);
        },
        approximateSize: function (start, end, cb) {
            return self.approximateSize(start, end, cb);
        },
        getProperty: function (key) {
            return self.getProperty(key);
        },
        destroy: function (p, cb) {
            return self.destroy(p, cb);
        },
        repair: function (p, cb) {
            return self.repair(p, cb);
        }
    };
    if (db) this.swap(db);
    
    function down (opts) {
        if (!opts || typeof opts !== 'object') return opts;
        var opts_ = copy(opts);
        delete opts_.keyEncoding;
        delete opts_.valueEncoding;
        delete opts_.encoding;
        return opts_;
    }
}

LevelProxy.prototype.swap = function swap (db) {
    var self = this;
    if (this._proxyDb) {
        this._proxyUnlisten(this._proxyDb);
        if (db) this._proxyListen(db);
    }
    else if (db) {
        this._proxyListen(db);
        var queue = this._proxyQueue.splice(0);
        for (var i = 0; i < queue.length; i++) {
            var q = queue[i];
            if (typeof q.method === 'function') {
                q.method.apply(db, q.args);
            }
            else db[q.method].apply(db, q.args);
        }
        var its = this._proxyIterators.splice(0);
        for (var i = 0; i < its.length; i++) {
            var it = its[i];
            var itf = db.iterator || (db.db && db.db.iterator);
            var realIt = itf.call(db.db || db, it._proxyOptions);
            it._proxyI = realIt;
            var pn = it._proxyNext.splice(0);
            for (var j = 0; j < pn.length; j++) {
                realIt.next(pn[j]);
            }
            var pe = it._proxyEnd.splice(0);
            for (var j = 0; j < pe.length; j++) {
                realIt.end(pe[j]);
            }
        }
        if (this._proxyQueue.length || this._proxyIterators.length) {
            // in case more methods slipped into the queue on the same tick:
            return swap.call(this, db);
        }
    }
    this._proxyDb = db;
    if (db) this.emit('swap', db);
};

LevelProxy.prototype._proxyListen = function (db) {
    var self = this;
    this._proxyListeners = {};
    for (var i = 0; i < EVENT_KEYS.length; i++) (function (key) {
        self._proxyListeners[key] = f;
        try { db.on(key, f) }
        catch (err) {}
        function f () {
            var args = [].slice.call(arguments);
            args.unshift(key);
           self.emit.apply(self, args);
        }
    })(EVENT_KEYS[i]);
};

LevelProxy.prototype._proxyUnlisten = function (db) {
    for (var i = 0; i < EVENT_KEYS.length; i++) {
        var key = EVENT_KEYS[i];
        db.removeListener(key, this._proxyListeners[key]);
    }
};

LevelProxy.prototype._proxyMethod = function (fname, args) {
    var opts = {
        get: args[1], // key, opts
        put: args[2], // key, value, opts
        del: args[1], // key, opts
    }[fname] || args[1];
    if (typeof opts !== 'object') opts = null;
    
    var cb = args[args.length-1];
    if (typeof cb !== 'function') cb = null;
    
    var keyEncoding, valueEncoding, encoding;
    if (opts) {
        opts = copy(opts);
        args[{ put: 2 }[fname] || 1] = opts;
        
        if (opts.keyEncoding === 'json') {
            keyEncoding = jsonEncoding;
            delete opts.keyEncoding;
        }
        else if (opts.keyEncoding && typeof opts.keyEncoding !== 'string') {
            keyEncoding = opts.keyEncoding;
            delete opts.keyEncoding;
        }
        if (opts.valueEncoding === 'json') {
            valueEncoding = jsonEncoding;
            delete opts.valueEncoding;
        }
        else if (opts.valueEncoding && typeof opts.valueEncoding !== 'string') {
            valueEncoding = opts.valueEncoding;
            delete opts.valueEncoding;
        }
        if (opts.encoding === 'json') {
            encoding = jsonEncoding;
            delete opts.encoding;
        }
        else if (opts.encoding && typeof opts.encoding !== 'string') {
            encoding = opts.encoding;
            delete opts.encoding;
        }
    }
    var customEncoding = keyEncoding || valueEncoding || encoding;
    if (customEncoding && fname === 'batch') {
        args[0] = args[0].map(function (x) {
            var row = copy(x);
            if (keyEncoding) row.key = keyEncoding.encode(x.key)
            if (valueEncoding) row.value = valueEncoding.encode(x.value)
            else if (encoding) row.value = encoding.encode(x.value)
            return row;
        });
    }
    else if (keyEncoding) {
        args[0] = keyEncoding.encode(args[0]);
    }
    if (fname === 'get' && valueEncoding && cb) {
        args[args.length - 1] = function (err, value) {
            if (err) cb(err)
            else cb(null, valueEncoding.decode(value));
        };
    }
    if (this._proxyDb) this._proxyDb[fname].apply(this._proxyDb, args)
    else this._proxyQueue.push({ method: fname, args: args })
};

LevelProxy.prototype._proxyStream = function (fname, args) {
    var opts = args[0] && typeof args[0] === 'object' ? args[0] : null;
    
    var keyEncoding, valueEncoding, encoding;
    if (opts) {
        opts = copy(opts);
        args[0] = opts;
        
        if (opts.keyEncoding && typeof opts.keyEncoding !== 'string') {
            keyEncoding = opts.keyEncoding;
            opts.keyEncoding = 'binary';
        }
        if (opts.valueEncoding && typeof opts.valueEncoding !== 'string') {
            valueEncoding = opts.valueEncoding;
            opts.valueEncoding = 'binary';
        }
        if (opts.encoding && typeof opts.encoding !== 'string') {
            encoding = opts.encoding;
            opts.encoding = 'binary';
        }
    }
    var customEncoding = keyEncoding || valueEncoding || encoding;
    if (keyEncoding && opts.start) opts.start = keyEncoding.encode(opts.start);
    if (keyEncoding && opts.end) opts.end = keyEncoding.encode(opts.end);
    if (keyEncoding && opts.lt) opts.lt = keyEncoding.encode(opts.lt);
    if (keyEncoding && opts.lte) opts.lte = keyEncoding.encode(opts.lte);
    if (keyEncoding && opts.gt) opts.gt = keyEncoding.encode(opts.gt);
    if (keyEncoding && opts.gte) opts.gte = keyEncoding.encode(opts.gte);
    
    if (customEncoding) {
        return this._proxyStream(fname, [opts].concat([].slice.call(args, 1)))
            .pipe(through({ objectMode: true }, function (row, enc, next) {
                if (keyEncoding) row.key = keyEncoding.decode(row.key);
                if (valueEncoding) row.value = valueEncoding.decode(row.value);
                this.push(row);
                next();
            }))
        ;
    }
    
    if (this._proxyDb) return this._proxyDb[fname].apply(this._proxyDb, args);
    
    var outer = new PassThrough({ objectMode: true });
    outer._options = args[0];
    
    this._proxyQueue.push({
        method: function () {
            var db = this;
            var s = db[fname].apply(db, arguments);
            if (!s || typeof s !== 'object' || typeof s.pipe !== 'function') {
                var err = new Error('stream method is not a stream');
                return outer.emit('error', err);
            }
            s.pipe(outer);
        },
        args: args
    });
    return outer;
};

LevelProxy.prototype.createReadStream = function () {
    return this._proxyStream('createReadStream', arguments);
};

LevelProxy.prototype.createKeyStream = function () {
    return this._proxyStream('createKeyStream', arguments);
};

LevelProxy.prototype.createValueStream = function () {
    return this._proxyStream('createValueStream', arguments);
};

LevelProxy.prototype.open = function (fn) {
    process.nextTick(fn);
};

LevelProxy.prototype.close = function () {
    this._proxyMethod('close', arguments);
};

LevelProxy.prototype.put = function () {
    this._proxyMethod('put', arguments);
};

LevelProxy.prototype.get = function () {
    this._proxyMethod('get', arguments);
};

LevelProxy.prototype.del = function () {
    this._proxyMethod('del', arguments);
};

LevelProxy.prototype.batch = function () {
    this._proxyMethod('batch', arguments);
};

LevelProxy.prototype.approximateSize = function () {
    this._proxyMethod('approximateSize', arguments);
};

LevelProxy.prototype.getProperty = function () {
    this._proxyMethod('getProperty', arguments);
};

LevelProxy.prototype.destroy = function () {
    this._proxyMethod('destroy', arguments);
};

LevelProxy.prototype.repair = function () {
    this._proxyMethod('repair', arguments);
};

LevelProxy.prototype.isOpen = function () {
    return true;
};

LevelProxy.prototype.iterator = function (opts) {
    var db = this._proxyDb;
    if (db && db.iterator) {
        return db.iterator.apply(db, arguments);
    }
    if (db && db.db && db.db.iterator) {
        return db.db.iterator.apply(db.db, arguments);
    }
    
    var i = new IteratorProxy(opts);
    this._proxyIterators.push(i);
    return i;
};

function IteratorProxy (opts) {
    this._proxyOptions = opts;
    this._proxyNext = [];
    this._proxyEnd = [];
}

IteratorProxy.prototype.next = function (cb) {
    if (this._proxyI) return this._proxyI.next(cb);
    this._proxyNext.push(cb);
};

IteratorProxy.prototype.end = function (cb) {
    if (this._proxyI) return this._proxyI.end(cb);
    this._proxyEnd.push(cb);
};
