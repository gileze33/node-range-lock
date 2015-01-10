var orm = require('orm');
var uuid = require('uuid');
var debug = require('debug')('range-lock');
var entities = require('./LockStore/entities');

var LockStore = function(url) {
    this.url = url;
    this.ready = false;
    this.connecting = false;

    var store = this;
    this.connect(function() {
        debug('LockStore connected to data store at ' + url);

        // make the client tidy up the DB every 30 seconds
        setInterval(function() {
            store.tidy();
        }, 30000)
    });
};

LockStore.prototype.connect = function(cb) {
    if(this.ready) {
        return cb();
    }

    this.connectQueue = this.connectQueue || [];

    if(this.connecting) {
        return this.connectQueue.push(cb);
    }
    this.connecting = true;

    var done = function() {
        cb();

        if(store.connectQueue.length > 0) {
            for(var i=0; i<store.connectQueue.length; i++) {
                store.connectQueue[i]();
            }
        }
    };

    var store = this;
    orm.connect(this.url, function(err, db) {
        if(err) {
            console.log('FATAL: range-lock LockStore failed to connect to data store');
            throw err;
        }

        store.db = db;

        entities.define(store.db, store.db.models, function(err) {
            if(err) {
                console.log('FATAL: range-lock LockStore connected but failed to init data store');
                throw err;
            }

            store.ready = true;
            store.connecting = false;
            done();
        });
    });
};

var generateIntersectsSQL = function generateIntersectsSQL(start, end) {
    // start and end should both look like = {"field": "xxx", "value": 0}
    
    start.value = start.value * 1;
    end.value = end.value * 1;

    return '((`'+start.field+'` <= '+start.value+' AND `'+end.field+'` >= '+end.value+') OR (`'+start.field+'` >= '+start.value+' AND `'+start.field+'` <= '+end.value+' AND `'+end.field+'` >= '+end.value+') OR (`'+start.field+'` <= '+start.value+' AND `'+end.field+'` >= '+start.value+' AND `'+end.field+'` <= '+end.value+') OR (`'+start.field+'` >= '+start.value+' AND `'+end.field+'` <= '+end.value+'))';
};
LockStore.prototype.find = function find(key, from, to, cb) {
    var store = this;

    // find any valid entries for this key where the from / to overlaps the passed info
    var now = new Date().getTime();
    store.db.models.lock.find({
        key: key,
        expiry: orm.gt(now)
    }).where(generateIntersectsSQL({
        field: 'from',
        value: from
    }, {
        field: 'to',
        value: to
    })).run(function(err, results) {
        if(err) {
            return cb(err);
        }

        debug('find for key='+key+', from='+from+', to='+to+' got '+results.length+' results');
        cb(null, results);
    });
};

LockStore.prototype.create = function create(key, from, to, data, ttl, cb) {
    var store = this;

    // generate a string ID for this lock, check it doesn't exist already and then insert it
    var createLock = function createLock() {
        var now = new Date().getTime();
        var nowStr = (now+'');
        var lockID = nowStr.substr(-5) + '-' + nowStr.substr(-10, 5) + '-' + uuid.v4();

        store.db.models.lock.count({
            id: lockID
        }, function(err, count) {
            if(err) {
                return cb(err);
            }

            if(count > 0) {
                debug('found conflict for lock id '+lockID);
                return createLock();
            }

            var obj = {
                key: key,
                from: from,
                to: to,
                expiry: now + ttl,
                data: data
            };

            debug('creating lock with ID '+lockID, obj);

            obj.id = lockID;
            store.db.models.lock.create(obj, function(err, result) {
                if(cb) cb(err, result);
            });
        });
    };
    createLock();
};

LockStore.prototype.get = function find(key, lockID, cb) {
    var store = this;

    // find the specified lock - returns null if not found
    var now = new Date().getTime();
    store.db.models.lock.find({
        key: key,
        id: lockID,
        expiry: orm.gt(now)
    }).run(function(err, results) {
        if(err) {
            return cb(err);
        }

        if(results.length === 0) {
            debug('get for key='+key+', id='+lockID+' found no valid locks');
            return cb(null, null);
        }

        var lock = results[0];

        debug('get for key='+key+', id='+lockID+' found a valid lock', lock);
        cb(null, lock);
    });
};

LockStore.prototype.remove = function remove(key, lockID, cb) {
    var store = this;

    debug('deleting lock with key='+key+', id='+lockID);

    store.db.models.lock.find({
        key: key,
        id: lockID
    }).remove(function(err, result) {
        if(cb) cb(err, result);
    });
};

LockStore.prototype.tidy = function tidy(cb) {
    // this method will go thru and remove any records where their expiry has passed
    var store = this;

    var now = new Date().getTime();

    store.db.models.lock.count({
        expiry: orm.lte(now)
    }, function(err, count) {
        if(err) {
            if(cb) cb(err);
            debug('tidy got error', err);

            return;
        }

        debug('tidy found '+count+' items to remove');

        store.db.models.lock.find({
            expiry: orm.lte(now)
        }).remove(function(err, result) {
            if(cb) cb(err);

            debug('tidy completed');
        });
    });
};

module.exports = LockStore;