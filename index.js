var inherits = require('inherits');
var EventEmitter = require('events/');
var PassThrough = require('readable-stream').PassThrough;

var EVENT_KEYS = [ 'put', 'del' ];

module.exports = LevelProxy;
inherits(LevelProxy, EventEmitter);

function LevelProxy (db) {
    if (!(this instanceof LevelProxy)) return new LevelProxy(db);
    this._proxyQueue = [];
    this._proxyListeners = {};
    if (db) this.swap(db);
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
        if (this._proxyQueue.length) {
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
        db.on(key, f);
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
    if (this._proxyDb) this._proxyDb[fname].apply(this._proxyDb, args)
    else this._proxyQueue.push({ method: fname, args: args })
};

LevelProxy.prototype._proxyStream = function (fname, args) {
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

LevelProxy.prototype.open = function () {
    this._proxyMethod('open', arguments);
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

LevelProxy.prototype.iterator = function () {
    return new IteratorProxy(this.db);
};

function IteratorProxy () {
    // TODO
}

IteratorProxy.prototype.next = function () {
};

IteratorProxy.prototype.end = function () {
};
