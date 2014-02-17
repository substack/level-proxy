var inherits = require('inherits');
var EventEmitter = require('events').EventEmitter;

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
        this._proxyListen(db);
    }
    else {
        this._proxyListen(db);
        var queue = this._proxyQueue.splice(0);
        for (var i = 0; i < queue.length; i++) {
            var q = queue[i];
            q.method.apply(self, q.args);
        }
        if (this._proxyQueue.length) {
            // in case more methods slipped into the queue on the same tick:
            return swap.call(this, db);
        }
    }
    this._proxyDb = db;
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

LevelProxy.prototype._proxyMethod = function (f, args) {
    if (this._proxyDb) f.apply(this._proxyDb, args)
    else this._proxyQueue.push({ method: f, args: args })
};

LevelProxy.prototype.open = function open () {
    this._proxyMethod(open, arguments);
};

LevelProxy.prototype.close = function close () {
    this._proxyMethod(close, arguments);
};

LevelProxy.prototype.put = function put () {
    this._proxyMethod(put, arguments);
};

LevelProxy.prototype.get = function get () {
    this._proxyMethod(get, arguments);
};

LevelProxy.prototype.del = function del () {
    this._proxyMethod(del, arguments);
};

LevelProxy.prototype.batch = function batch () {
    this._proxyMethod(batch, arguments);
};

LevelProxy.prototype.approximateSize = function approximateSize () {
    this._proxyMethod(approximateSize, arguments);
};

LevelProxy.prototype.getProperty = function getProperty () {
    this._proxyMethod(getProperty, arguments);
};

LevelProxy.prototype.destroy = function destroy () {
    this._proxyMethod(destroy, arguments);
};

LevelProxy.prototype.repair = function repair () {
    this._proxyMethod(repair, arguments);
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
