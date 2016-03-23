"use strict";
var Warlock = require('node-redis-warlock');
var LockStore_1 = require('./lib/LockStore');
var debugLib = require('debug');
var debug = debugLib('range-lock');
var RangeLock = (function () {
    function RangeLock(redisClient, storeURL) {
        if (!redisClient) {
            throw new Error('You must provide a redis client as the first parameter to RangeLock()');
        }
        debug("Initialising RangeLock with storeURL=" + storeURL);
        this.warlock = Warlock(redisClient);
        this.store = new LockStore_1.default(storeURL);
    }
    RangeLock.prototype.processLock = function (key, cb) {
        var warlockKey = "range-lock::" + key;
        var ttl = 1000;
        var maxAttempts = 20;
        var wait = 100;
        this.warlock.optimistic(warlockKey, ttl, maxAttempts, wait, function (err, unlock) {
            if (err) {
                return cb(err);
            }
            debug("warlock locked key=" + warlockKey);
            cb(null, unlock);
        });
    };
    RangeLock.prototype.set = function (key, from, to, data, ttl, cb) {
        var _this = this;
        this.processLock(key, function (err, unlock) {
            if (err) {
                debug("set::processLock got error for key=" + key);
                return cb(err);
            }
            _this.store.find(key, from, to, function (err, results) {
                if (err) {
                    unlock();
                    debug("set::store.find got error for key=" + key);
                    return cb(err);
                }
                if (results.length > 0) {
                    unlock();
                    var lock = results[0];
                    lock.release = _this.clear.bind(_this, key, lock.id);
                    return cb(null, false, lock);
                }
                _this.store.create(key, from, to, data, ttl, function (err, lock) {
                    if (err) {
                        unlock();
                        debug("set::store.create got error for key=" + key);
                        return cb(err);
                    }
                    lock.release = _this.clear.bind(_this, key, lock.id);
                    cb(null, true, lock);
                    unlock();
                });
            });
        });
    };
    RangeLock.prototype.get = function (key, lockID, cb) {
        var _this = this;
        this.processLock(key, function (err, unlock) {
            if (err) {
                debug("get::processLock got error for key=" + key);
                return cb(err);
            }
            _this.store.get(key, lockID, function (err, lock) {
                unlock();
                if (lock)
                    lock.release = _this.clear.bind(_this, key, lock.id);
                cb(err, lock);
            });
        });
    };
    RangeLock.prototype.clear = function (key, lockID, cb) {
        var _this = this;
        this.processLock(key, function (err, unlock) {
            if (err) {
                debug("invalidate::processLock got error for key=" + key);
                return cb(err);
            }
            _this.store.remove(key, lockID, function (err) {
                unlock();
                cb(err);
            });
        });
    };
    return RangeLock;
}());
module.exports = RangeLock;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEsSUFBTSxPQUFPLEdBQUcsT0FBTyxDQUFDLG9CQUFvQixDQUFDLENBQUM7QUFDOUMsMEJBQXNCLGlCQUFpQixDQUFDLENBQUE7QUFFeEMsSUFBTSxRQUFRLEdBQUcsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0FBQ2xDLElBQU0sS0FBSyxHQUFHLFFBQVEsQ0FBQyxZQUFZLENBQUMsQ0FBQztBQUVyQztJQUlFLG1CQUFZLFdBQWUsRUFBRSxRQUFlO1FBQ3hDLEVBQUUsQ0FBQSxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQztZQUNkLE1BQU0sSUFBSSxLQUFLLENBQUMsdUVBQXVFLENBQUMsQ0FBQztRQUM3RixDQUFDO1FBRUQsS0FBSyxDQUFDLDBDQUF3QyxRQUFVLENBQUMsQ0FBQztRQUUxRCxJQUFJLENBQUMsT0FBTyxHQUFHLE9BQU8sQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUNwQyxJQUFJLENBQUMsS0FBSyxHQUFHLElBQUksbUJBQVMsQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUN6QyxDQUFDO0lBRUQsK0JBQVcsR0FBWCxVQUFZLEdBQVUsRUFBRSxFQUFXO1FBRS9CLElBQU0sVUFBVSxHQUFVLGlCQUFlLEdBQUssQ0FBQztRQUMvQyxJQUFNLEdBQUcsR0FBVSxJQUFJLENBQUM7UUFDeEIsSUFBTSxXQUFXLEdBQVUsRUFBRSxDQUFDO1FBQzlCLElBQU0sSUFBSSxHQUFVLEdBQUcsQ0FBQztRQUN4QixJQUFJLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxVQUFVLEVBQUUsR0FBRyxFQUFFLFdBQVcsRUFBRSxJQUFJLEVBQUUsVUFBQyxHQUFPLEVBQUUsTUFBVTtZQUM1RSxFQUFFLENBQUEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO2dCQUVMLE1BQU0sQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDbkIsQ0FBQztZQUVELEtBQUssQ0FBQyx3QkFBc0IsVUFBWSxDQUFDLENBQUM7WUFDMUMsRUFBRSxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsQ0FBQztRQUNyQixDQUFDLENBQUMsQ0FBQztJQUNQLENBQUM7SUFFRCx1QkFBRyxHQUFILFVBQUksR0FBVSxFQUFFLElBQVcsRUFBRSxFQUFTLEVBQUUsSUFBVyxFQUFFLEdBQVUsRUFBRSxFQUFXO1FBQTVFLGlCQXFDQztRQW5DRyxJQUFJLENBQUMsV0FBVyxDQUFDLEdBQUcsRUFBRSxVQUFDLEdBQUcsRUFBRSxNQUFNO1lBQzlCLEVBQUUsQ0FBQSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7Z0JBQ0wsS0FBSyxDQUFDLHdDQUFzQyxHQUFLLENBQUMsQ0FBQztnQkFDbkQsTUFBTSxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUNuQixDQUFDO1lBRUQsS0FBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLElBQUksRUFBRSxFQUFFLEVBQUUsVUFBQyxHQUFHLEVBQUUsT0FBTztnQkFDeEMsRUFBRSxDQUFBLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztvQkFDTCxNQUFNLEVBQUUsQ0FBQztvQkFDVCxLQUFLLENBQUMsdUNBQXFDLEdBQUssQ0FBQyxDQUFDO29CQUNsRCxNQUFNLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUNuQixDQUFDO2dCQUVELEVBQUUsQ0FBQSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFFcEIsTUFBTSxFQUFFLENBQUM7b0JBRVQsSUFBSSxJQUFJLEdBQUcsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDO29CQUN0QixJQUFJLENBQUMsT0FBTyxHQUFHLEtBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUksRUFBRSxHQUFHLEVBQUUsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO29CQUNuRCxNQUFNLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsSUFBSSxDQUFDLENBQUM7Z0JBQ2pDLENBQUM7Z0JBRUQsS0FBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsR0FBRyxFQUFFLElBQUksRUFBRSxFQUFFLEVBQUUsSUFBSSxFQUFFLEdBQUcsRUFBRSxVQUFDLEdBQUcsRUFBRSxJQUFJO29CQUNsRCxFQUFFLENBQUEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO3dCQUNMLE1BQU0sRUFBRSxDQUFDO3dCQUNULEtBQUssQ0FBQyx5Q0FBdUMsR0FBSyxDQUFDLENBQUM7d0JBQ3BELE1BQU0sQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUM7b0JBQ25CLENBQUM7b0JBRUQsSUFBSSxDQUFDLE9BQU8sR0FBRyxLQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFJLEVBQUUsR0FBRyxFQUFFLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztvQkFDbkQsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7b0JBQ3JCLE1BQU0sRUFBRSxDQUFDO2dCQUNiLENBQUMsQ0FBQyxDQUFDO1lBQ1AsQ0FBQyxDQUFDLENBQUM7UUFDUCxDQUFDLENBQUMsQ0FBQztJQUNQLENBQUM7SUFFRCx1QkFBRyxHQUFILFVBQUksR0FBVSxFQUFFLE1BQWEsRUFBRSxFQUFXO1FBQTFDLGlCQWVDO1FBYkcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxHQUFHLEVBQUUsVUFBQyxHQUFHLEVBQUUsTUFBTTtZQUM5QixFQUFFLENBQUEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO2dCQUNMLEtBQUssQ0FBQyx3Q0FBc0MsR0FBSyxDQUFDLENBQUM7Z0JBQ25ELE1BQU0sQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDbkIsQ0FBQztZQUVELEtBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUUsVUFBQyxHQUFHLEVBQUUsSUFBSTtnQkFDbEMsTUFBTSxFQUFFLENBQUM7Z0JBRVQsRUFBRSxDQUFBLENBQUMsSUFBSSxDQUFDO29CQUFDLElBQUksQ0FBQyxPQUFPLEdBQUcsS0FBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSSxFQUFFLEdBQUcsRUFBRSxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7Z0JBQzVELEVBQUUsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFDbEIsQ0FBQyxDQUFDLENBQUM7UUFDUCxDQUFDLENBQUMsQ0FBQztJQUNQLENBQUM7SUFFRCx5QkFBSyxHQUFMLFVBQU0sR0FBVSxFQUFFLE1BQWEsRUFBRSxFQUFXO1FBQTVDLGlCQWNDO1FBWkcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxHQUFHLEVBQUUsVUFBQyxHQUFHLEVBQUUsTUFBTTtZQUM5QixFQUFFLENBQUEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO2dCQUNMLEtBQUssQ0FBQywrQ0FBNkMsR0FBSyxDQUFDLENBQUM7Z0JBQzFELE1BQU0sQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDbkIsQ0FBQztZQUVELEtBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUUsVUFBQyxHQUFHO2dCQUMvQixNQUFNLEVBQUUsQ0FBQztnQkFFVCxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDWixDQUFDLENBQUMsQ0FBQztRQUNQLENBQUMsQ0FBQyxDQUFDO0lBQ1AsQ0FBQztJQUNILGdCQUFDO0FBQUQsQ0FBQyxBQXZHRCxJQXVHQztBQUVELE1BQU0sQ0FBQyxPQUFPLEdBQUcsU0FBUyxDQUFDIn0=