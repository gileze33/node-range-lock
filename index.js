"use strict";
var Warlock = require('node-redis-warlock');
var LockStore_1 = require('./lib/LockStore');
var debugLib = require('debug');
var debug = debugLib('range-lock');
function RangeLock(redisClient, storeURL) {
    if (!redisClient) {
        throw new Error('You must provide a redis client as the first parameter to RangeLock()');
    }
    debug("Initialising RangeLock with storeURL=" + storeURL);
    this.warlock = Warlock(redisClient);
    this.store = new LockStore_1.LockStore(storeURL);
}
;
RangeLock.prototype.processLock = function processLock(key, cb) {
    // set a lock optimistically
    var warlockKey = "range-lock::" + key;
    var ttl = 1000;
    var maxAttempts = 20; // Max number of times to try setting the lock before erroring
    var wait = 100; // Time to wait before another attempt if lock already in place
    this.warlock.optimistic(warlockKey, ttl, maxAttempts, wait, function (err, unlock) {
        if (err) {
            //debug('warlock return an error attempting to obtain a lock on key='+key, err);
            return cb(err);
        }
        debug("warlock locked key=" + warlockKey);
        cb(null, unlock);
    });
};
RangeLock.prototype.set = function set(key, from, to, data, ttl, cb) {
    // attempt to set a lock
    var self = this;
    self.processLock(key, function (err, unlock) {
        if (err) {
            debug("set::processLock got error for key=" + key);
            return cb(err);
        }
        self.store.find(key, from, to, function (err, results) {
            if (err) {
                unlock();
                debug("set::store.find got error for key=" + key);
                return cb(err);
            }
            if (results.length > 0) {
                // a lock already exists for the key during the specified range
                unlock();
                var lock = results[0];
                lock.release = self.clear.bind(self, key, lock.id);
                return cb(null, false, lock);
            }
            self.store.create(key, from, to, data, ttl, function (err, lock) {
                if (err) {
                    unlock();
                    debug("set::store.create got error for key=" + key);
                    return cb(err);
                }
                lock.release = self.clear.bind(self, key, lock.id);
                cb(null, true, lock);
                unlock();
            });
        });
    });
};
RangeLock.prototype.get = function get(key, lockID, cb) {
    // validate a specific lockID is still valid
    var self = this;
    self.processLock(key, function (err, unlock) {
        if (err) {
            debug("get::processLock got error for key=" + key);
            return cb(err);
        }
        self.store.get(key, lockID, function (err, lock) {
            unlock();
            if (lock)
                lock.release = self.clear.bind(self, key, lock.id);
            cb(err, lock);
        });
    });
};
RangeLock.prototype.clear = function invalidate(key, lockID, cb) {
    // invalidate a specific lockID
    var self = this;
    self.processLock(key, function (err, unlock) {
        if (err) {
            debug("invalidate::processLock got error for key=" + key);
            return cb(err);
        }
        self.store.remove(key, lockID, function (err) {
            unlock();
            cb(err);
        });
    });
};
module.exports = RangeLock;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEsSUFBTSxPQUFPLEdBQUcsT0FBTyxDQUFDLG9CQUFvQixDQUFDLENBQUM7QUFDOUMsMEJBQW9DLGlCQUFpQixDQUFDLENBQUE7QUFFdEQsSUFBTSxRQUFRLEdBQUcsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0FBQ2xDLElBQU0sS0FBSyxHQUFHLFFBQVEsQ0FBQyxZQUFZLENBQUMsQ0FBQztBQVlyQyxtQkFBbUIsV0FBZSxFQUFFLFFBQWU7SUFDL0MsRUFBRSxDQUFBLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDO1FBQ2QsTUFBTSxJQUFJLEtBQUssQ0FBQyx1RUFBdUUsQ0FBQyxDQUFDO0lBQzdGLENBQUM7SUFFRCxLQUFLLENBQUMsMENBQXdDLFFBQVUsQ0FBQyxDQUFDO0lBRTFELElBQUksQ0FBQyxPQUFPLEdBQUcsT0FBTyxDQUFDLFdBQVcsQ0FBQyxDQUFDO0lBQ3BDLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxxQkFBUyxDQUFDLFFBQVEsQ0FBQyxDQUFDO0FBQ3pDLENBQUM7QUFBQSxDQUFDO0FBRUYsU0FBUyxDQUFDLFNBQVMsQ0FBQyxXQUFXLEdBQUcscUJBQXFCLEdBQVUsRUFBRSxFQUFXO0lBQzFFLDRCQUE0QjtJQUM1QixJQUFNLFVBQVUsR0FBVSxpQkFBZSxHQUFLLENBQUM7SUFDL0MsSUFBTSxHQUFHLEdBQVUsSUFBSSxDQUFDO0lBQ3hCLElBQU0sV0FBVyxHQUFVLEVBQUUsQ0FBQyxDQUFDLDhEQUE4RDtJQUM3RixJQUFNLElBQUksR0FBVSxHQUFHLENBQUMsQ0FBQywrREFBK0Q7SUFDeEYsSUFBSSxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsVUFBVSxFQUFFLEdBQUcsRUFBRSxXQUFXLEVBQUUsSUFBSSxFQUFFLFVBQUMsR0FBTyxFQUFFLE1BQVU7UUFDNUUsRUFBRSxDQUFBLENBQUMsR0FB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