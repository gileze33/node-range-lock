"use strict";
var sequelize_1 = require('../sequelize');
var uuid = require('uuid');
var debug = require('debug')('range-lock');
function generateIntersectsSQL(start, end) {
    // start and end should both look like = {"field": "xxx", "value": 0}
    start.value = start.value * 1;
    end.value = end.value * 1;
    var orQuery = [{ $and: {} }, { $and: {} }, { $and: {} }, { $and: {} }];
    orQuery[0]['$and'][start.field] = { $lte: start.value };
    orQuery[0]['$and'][end.field] = { $gte: end.value };
    orQuery[1]['$and'][start.field] = { $gte: start.value };
    orQuery[1]['$and'][start.field] = { $lte: end.value };
    orQuery[1]['$and'][end.field] = { $gte: end.value };
    orQuery[2]['$and'][start.field] = { $lte: start.value };
    orQuery[2]['$and'][end.field] = { $gte: start.value };
    orQuery[2]['$and'][end.field] = { $lte: end.value };
    orQuery[3]['$and'][start.field] = { $gte: start.value };
    orQuery[3]['$and'][end.field] = { $lte: end.value };
    return orQuery;
    // return '((`'+start.field+'` <= '+start.value+' AND `'+end.field+'` >= '+end.value+')
    // OR (`'+start.field+'` >= '+start.value+' AND `'+start.field+'` <= '+end.value+' AND `'+end.field+'` >= '+end.value+')
    // OR (`'+start.field+'` <= '+start.value+' AND `'+end.field+'` >= '+start.value+' AND `'+end.field+'` <= '+end.value+')
    // OR (`'+start.field+'` >= '+start.value+' AND `'+end.field+'` <= '+end.value+'))';
}
;
function LockStore(url) {
    this.url = url;
    this.ready = false;
    this.connecting = false;
    var store = this;
    this.connect(function () {
        debug("LockStore connected to data store at " + url);
        // make the client tidy up the DB every 30 seconds
        setInterval(function () {
            store.tidy();
        }, 30000);
    });
}
exports.LockStore = LockStore;
;
LockStore.prototype.connect = function (cb) {
    if (this.ready) {
        return cb();
    }
    this.connectQueue = this.connectQueue || [];
    if (this.connecting) {
        return this.connectQueue.push(cb);
    }
    this.connecting = true;
    function done() {
        cb();
        if (store.connectQueue.length > 0) {
            for (var i = 0; i < store.connectQueue.length; i++) {
                store.connectQueue[i]();
            }
        }
    }
    ;
    var store = this;
    try {
        var _a = sequelize_1.default(this.url), Sequelize = _a.Sequelize, sequelize = _a.sequelize, models = _a.models;
        store.db = {
            models: models
        };
        store.ready = true;
        store.connecting = false;
        done();
    }
    catch (err) {
        console.log("FATAL: range-lock LockStore failed to connect to data store");
    }
};
LockStore.prototype.find = function find(key, from, to, cb) {
    var store = this;
    // find any valid entries for this key where the from / to overlaps the passed info
    var now = new Date().getTime();
    store.db.models.Lock.findAll({ where: {
            key: key,
            expiry: {
                $gt: now
            },
            $or: generateIntersectsSQL({
                field: 'from',
                value: from
            }, {
                field: 'to',
                value: to
            })
        } }).then(function (results) {
        debug("find for key=" + key + ", from=" + from + ", to=" + to + " got " + results.length + " results");
        cb(null, results);
    }).catch(function (err) {
        return cb(err);
    });
};
LockStore.prototype.create = function create(key, from, to, data, ttl, cb) {
    var store = this;
    // generate a string ID for this lock, check it doesn't exist already and then insert it
    function createLock() {
        var now = new Date().getTime();
        var nowStr = (now + '');
        var lockID = nowStr.substr(-5) + "-" + nowStr.substr(-10, 5) + "-" + uuid.v4();
        store.db.models.Lock.count({ where: {
                id: lockID
            } }).then(function (count) {
            if (count > 0) {
                debug("found conflict for lock id " + lockID);
                return createLock();
            }
            var obj = {
                key: key,
                from: from.toString(10),
                to: to.toString(10),
                expiry: (now + ttl).toString(10),
                data: data
            };
            obj.id = lockID;
            debug("creating lock with ID " + lockID, obj);
            return store.db.models.Lock.create(obj);
        })
            .then(function (result) {
            if (cb)
                cb(null, result);
        })
            .catch(function (err) {
            return cb(err);
        });
    }
    ;
    createLock();
};
LockStore.prototype.get = function find(key, lockID, cb) {
    var store = this;
    // find the specified lock - returns null if not found
    var now = new Date().getTime();
    store.db.models.Lock.findAll({ where: {
            key: key,
            id: lockID,
            expiry: {
                $gt: now
            }
        } })
        .then(function (results) {
        if (results.length === 0) {
            debug("get for key=" + key + ", id=" + lockID + " found no valid locks");
            return cb(null, null);
        }
        var lock = results[0];
        debug("get for key=" + key + ", id=" + lockID + " found a valid lock", lock);
        cb(null, lock);
    })
        .catch(function (err) {
        return cb(err);
    });
};
LockStore.prototype.remove = function remove(key, lockID, cb) {
    var store = this;
    debug("deleting lock with key=" + key + ", id=" + lockID);
    store.db.models.Lock.destroy({ where: {
            key: key,
            id: lockID
        } })
        .then(function (result) {
        if (cb)
            cb(null, result);
    })
        .catch(function (err) {
        return cb(err);
    });
};
LockStore.prototype.tidy = function tidy(cb) {
    // this method will go thru and remove any records where their expiry has passed
    var store = this;
    var now = new Date().getTime();
    store.db.models.Lock.count({ where: {
            expiry: {
                $lte: now
            }
        } })
        .then(function (count) {
        debug("tidy found " + count + " items to remove");
        return store.db.models.Lock.destroy({ where: {
                expiry: {
                    $lte: now
                }
            } });
    })
        .then(function (result) {
        debug("tidy completed");
    })
        .catch(function (err) {
        if (cb)
            cb(err);
        debug("tidy got error", err);
        return;
    });
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTG9ja1N0b3JlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiTG9ja1N0b3JlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQSwwQkFBNkIsY0FBYyxDQUFDLENBQUE7QUFDNUMsSUFBTSxJQUFJLEdBQUcsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQzdCLElBQU0sS0FBSyxHQUFZLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQztBQUV0RCwrQkFBK0IsS0FBa0MsRUFBRSxHQUFnQztJQUNoRyxxRUFBcUU7SUFFckUsS0FBSyxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQztJQUM5QixHQUFHLENBQUMsS0FBSyxHQUFHLEdBQUcsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDO0lBQzFCLElBQUksT0FBTyxHQUFnQixDQUFDLEVBQUMsSUFBSSxFQUFDLEVBQUUsRUFBQyxFQUFDLEVBQUMsSUFBSSxFQUFDLEVBQUUsRUFBQyxFQUFDLEVBQUMsSUFBSSxFQUFDLEVBQUUsRUFBQyxFQUFDLEVBQUMsSUFBSSxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUM7SUFFckUsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFDLElBQUksRUFBRSxLQUFLLENBQUMsS0FBSyxFQUFDLENBQUM7SUFDdEQsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFDLElBQUksRUFBRSxHQUFHLENBQUMsS0FBSyxFQUFDLENBQUM7SUFFbEQsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFDLElBQUksRUFBRSxLQUFLLENBQUMsS0FBSyxFQUFDLENBQUM7SUFDdEQsT0FBTyxDQUFDLENBQUMsQ0FB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