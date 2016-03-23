"use strict";
var sequelize_1 = require('../sequelize');
var uuid = require('uuid');
var debug = require('debug')('range-lock');
function generateIntersectsSQL(start, end) {
    return (_a = {},
        _a[start.field] = {
            $lte: end.value,
        },
        _a[end.field] = {
            $gte: start.value,
        },
        _a
    );
    var _a;
}
;
var LockStore = (function () {
    function LockStore(url) {
        var _this = this;
        this.url = url;
        this.ready = false;
        this.connecting = false;
        this.connect(function () {
            debug("LockStore connected to data store at " + url);
            setInterval(function () {
                _this.tidy(function (err) {
                    if (err)
                        debug("tidy err: " + err);
                });
            }, 30000);
        });
    }
    ;
    LockStore.prototype.connect = function (cb) {
        var _this = this;
        if (this.ready) {
            return cb();
        }
        this.connectQueue = this.connectQueue || [];
        if (this.connecting) {
            return this.connectQueue.push(cb);
        }
        this.connecting = true;
        var done = function () {
            cb();
            if (_this.connectQueue.length > 0) {
                for (var i = 0; i < _this.connectQueue.length; i++) {
                    _this.connectQueue[i]();
                }
            }
        };
        try {
            var _a = sequelize_1.default(this.url), Sequelize = _a.Sequelize, sequelize = _a.sequelize, models = _a.models;
            this.db = {
                models: models
            };
            this.ready = true;
            this.connecting = false;
            done();
        }
        catch (err) {
            console.log("FATAL: range-lock LockStore failed to connect to data store");
        }
    };
    ;
    LockStore.prototype.find = function (key, from, to, cb) {
        var now = new Date().getTime();
        this.db.models.Lock.findAll({ where: {
                $and: [
                    {
                        key: key,
                        expiry: {
                            $gt: now
                        },
                    },
                    generateIntersectsSQL({
                        field: 'from',
                        value: from
                    }, {
                        field: 'to',
                        value: to
                    })
                ],
            } }).then(function (results) {
            debug("find for key=" + key + ", from=" + from + ", to=" + to + " got " + results.length + " results");
            cb(null, results);
        }).catch(function (err) {
            return cb(err);
        });
    };
    ;
    LockStore.prototype.create = function (key, from, to, data, ttl, cb) {
        var _this = this;
        var createLock = function () {
            var now = new Date().getTime();
            var nowStr = (now + '');
            var lockID = nowStr.substr(-5) + "-" + nowStr.substr(-10, 5) + "-" + uuid.v4();
            _this.db.models.Lock.count({ where: {
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
                return _this.db.models.Lock.create(obj);
            })
                .then(function (result) {
                if (cb)
                    cb(null, result);
            })
                .catch(function (err) {
                return cb(err);
            });
        };
        createLock();
    };
    ;
    LockStore.prototype.get = function (key, lockID, cb) {
        var now = new Date().getTime();
        this.db.models.Lock.findAll({ where: {
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
    ;
    LockStore.prototype.remove = function (key, lockID, cb) {
        debug("deleting lock with key=" + key + ", id=" + lockID);
        this.db.models.Lock.destroy({ where: {
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
    ;
    LockStore.prototype.tidy = function (cb) {
        var _this = this;
        var now = new Date().getTime();
        this.db.models.Lock.count({ where: {
                expiry: {
                    $lte: now
                }
            } })
            .then(function (count) {
            debug("tidy found " + count + " items to remove");
            return _this.db.models.Lock.destroy({ where: {
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
    ;
    return LockStore;
}());
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = LockStore;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTG9ja1N0b3JlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiTG9ja1N0b3JlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQSwwQkFBNkIsY0FBYyxDQUFDLENBQUE7QUFDNUMsSUFBTSxJQUFJLEdBQUcsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQzdCLElBQU0sS0FBSyxHQUFZLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQztBQUV0RCwrQkFBK0IsS0FBa0MsRUFBRSxHQUFnQztJQUVoRyxNQUFNLENBQUM7UUFDTCxHQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsR0FBRTtZQUNiLElBQUksRUFBRSxHQUFHLENBQUMsS0FBSztTQUNoQjtRQUNELEdBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxHQUFFO1lBQ1gsSUFBSSxFQUFFLEtBQUssQ0FBQyxLQUFLO1NBQ2xCOztLQUNGLENBQUM7O0FBTUwsQ0FBQztBQUFBLENBQUM7QUFjRjtJQVlFLG1CQUFZLEdBQVU7UUFaeEIsaUJBNkxDO1FBaExLLElBQUksQ0FBQyxHQUFHLEdBQUcsR0FBRyxDQUFDO1FBQ2YsSUFBSSxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7UUFDbkIsSUFBSSxDQUFDLFVBQVUsR0FBRyxLQUFLLENBQUM7UUFFeEIsSUFBSSxDQUFDLE9BQU8sQ0FBQztZQUNULEtBQUssQ0FBQywwQ0FBd0MsR0FBSyxDQUFDLENBQUM7WUFHckQsV0FBVyxDQUFDO2dCQUNSLEtBQUksQ0FBQyxJQUFJLENBQUMsVUFBQSxHQUFHO29CQUNYLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQzt3QkFBQyxLQUFLLENBQUMsZUFBYSxHQUFLLENBQUMsQ0FBQTtnQkFDcEMsQ0FBQyxDQUFDLENBQUM7WUFDUCxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUE7UUFDYixDQUFDLENBQUMsQ0FBQztJQUNQLENBQUM7O0lBRUQsMkJBQU8sR0FBUCxVQUFRLEVBQWE7UUFBckIsaUJBNkJD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