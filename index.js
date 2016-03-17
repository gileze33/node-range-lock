"use strict";
var Warlock = require('node-redis-warlock');
var LockStore_1 = require('./lib/LockStore');
var debugLib = require('debug');
var debug = debugLib('range-lock');
var RangeLock = function (redisClient, storeURL) {
    if (!redisClient) {
        throw new Error('You must provide a redis client as the first parameter to RangeLock()');
    }
    debug('Initialising RangeLock with storeURL=' + storeURL);
    this.warlock = Warlock(redisClient);
    this.store = new LockStore_1.default(storeURL);
};
RangeLock.prototype.processLock = function processLock(key, cb) {
    var warlockKey = 'range-lock::' + key;
    var ttl = 1000;
    var maxAttempts = 20;
    var wait = 100;
    this.warlock.optimistic(warlockKey, ttl, maxAttempts, wait, function (err, unlock) {
        if (err) {
            return cb(err);
        }
        debug('warlock locked key=' + warlockKey);
        cb(null, unlock);
    });
};
RangeLock.prototype.set = function set(key, from, to, data, ttl, cb) {
    var self = this;
    self.processLock(key, function (err, unlock) {
        if (err) {
            debug('set::processLock got error for key=' + key);
            return cb(err);
        }
        self.store.find(key, from, to, function (err, results) {
            if (err) {
                unlock();
                debug('set::store.find got error for key=' + key);
                return cb(err);
            }
            if (results.length > 0) {
                unlock();
                var lock = results[0];
                lock.release = self.clear.bind(self, key, lock.id);
                return cb(null, false, lock);
            }
            self.store.create(key, from, to, data, ttl, function (err, lock) {
                if (err) {
                    unlock();
                    debug('set::store.create got error for key=' + key);
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
    var self = this;
    self.processLock(key, function (err, unlock) {
        if (err) {
            debug('get::processLock got error for key=' + key);
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
    var self = this;
    self.processLock(key, function (err, unlock) {
        if (err) {
            debug('invalidate::processLock got error for key=' + key);
            return cb(err);
        }
        self.store.remove(key, lockID, function (err) {
            unlock();
            cb(err);
        });
    });
};
module.exports = RangeLock;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEsSUFBTSxPQUFPLEdBQUcsT0FBTyxDQUFDLG9CQUFvQixDQUFDLENBQUM7QUFDOUMsMEJBQXNCLGlCQUFpQixDQUFDLENBQUE7QUFFeEMsSUFBTSxRQUFRLEdBQUcsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0FBQ2xDLElBQU0sS0FBSyxHQUFHLFFBQVEsQ0FBQyxZQUFZLENBQUMsQ0FBQztBQUVyQyxJQUFJLFNBQVMsR0FBRyxVQUFTLFdBQVcsRUFBRSxRQUFRO0lBQzFDLEVBQUUsQ0FBQSxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQztRQUNkLE1BQU0sSUFBSSxLQUFLLENBQUMsdUVBQXVFLENBQUMsQ0FBQztJQUM3RixDQUFDO0lBRUQsS0FBSyxDQUFDLHVDQUF1QyxHQUFDLFFBQVEsQ0FBQyxDQUFDO0lBRXhELElBQUksQ0FBQyxPQUFPLEdBQUcsT0FBTyxDQUFDLFdBQVcsQ0FBQyxDQUFDO0lBQ3BDLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxtQkFBUyxDQUFDLFFBQVEsQ0FBQyxDQUFDO0FBQ3pDLENBQUMsQ0FBQztBQUVGLFNBQVMsQ0FBQyxTQUFTLENBQUMsV0FBVyxHQUFHLHFCQUFxQixHQUFHLEVBQUUsRUFBRTtJQUUxRCxJQUFJLFVBQVUsR0FBRyxjQUFjLEdBQUMsR0FBRyxDQUFDO0lBQ3BDLElBQUksR0FBRyxHQUFHLElBQUksQ0FBQztJQUNmLElBQUksV0FBVyxHQUFHLEVBQUUsQ0FBQztJQUNyQixJQUFJLElBQUksR0FBRyxHQUFHLENBQUM7SUFDZixJQUFJLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxVQUFVLEVBQUUsR0FBRyxFQUFFLFdBQVcsRUFBRSxJQUFJLEVBQUUsVUFBUyxHQUFHLEVBQUUsTUFBTTtRQUM1RSxFQUFFLENBQUEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO1lBRUws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