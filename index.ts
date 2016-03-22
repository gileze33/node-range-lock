const Warlock = require('node-redis-warlock');
import {LockStore, ILockStore} from './lib/LockStore';

const debugLib = require('debug');
const debug = debugLib('range-lock');

interface IRangeLock {
  warlock: any;
  store: ILockStore

  processLock?: {(key:string, cb:Function):void};
  set?: {(key:string, from:number, to:number, data:string, ttl:number, cb:Function):void};
  get?: {(key:string, lockID:string, cb:Function):void};
  clear?: {(key:string, lockID:string, cb:Function):void};
}

function RangeLock(redisClient:any, storeURL:string):void {
    if(!redisClient) {
        throw new Error('You must provide a redis client as the first parameter to RangeLock()');
    }

    debug(`Initialising RangeLock with storeURL=${storeURL}`);

    this.warlock = Warlock(redisClient);
    this.store = new LockStore(storeURL);
};

RangeLock.prototype.processLock = function processLock(key:string, cb:Function):void {
    // set a lock optimistically
    const warlockKey:string = `range-lock::${key}`;
    const ttl:number = 1000;
    const maxAttempts:number = 20; // Max number of times to try setting the lock before erroring
    const wait:number = 100; // Time to wait before another attempt if lock already in place
    this.warlock.optimistic(warlockKey, ttl, maxAttempts, wait, (err:any, unlock:any) => {
        if(err) {
            //debug('warlock return an error attempting to obtain a lock on key='+key, err);
            return cb(err);
        }

        debug(`warlock locked key=${warlockKey}`);
        cb(null, unlock);
    });
};

RangeLock.prototype.set = function set(key:string, from:number, to:number, data:string, ttl:number, cb:Function):void {
    // attempt to set a lock
    let self:IRangeLock = this;

    self.processLock(key, (err, unlock) => {
        if(err) {
            debug(`set::processLock got error for key=${key}`);
            return cb(err);
        }

        self.store.find(key, from, to, (err, results) => {
            if(err) {
                unlock();
                debug(`set::store.find got error for key=${key}`);
                return cb(err);
            }

            if(results.length > 0) {
                // a lock already exists for the key during the specified range
                unlock();

                let lock = results[0];
                lock.release = self.clear.bind(self, key, lock.id);
                return cb(null, false, lock);
            }

            self.store.create(key, from, to, data, ttl, (err, lock) => {
                if(err) {
                    unlock();
                    debug(`set::store.create got error for key=${key}`);
                    return cb(err);
                }

                lock.release = self.clear.bind(self, key, lock.id);
                cb(null, true, lock);
                unlock();
            });
        });
    });
};

RangeLock.prototype.get = function get(key:string, lockID:string, cb:Function):void {
    // validate a specific lockID is still valid
    let self:IRangeLock = this;

    self.processLock(key, (err, unlock) => {
        if(err) {
            debug(`get::processLock got error for key=${key}`);
            return cb(err);
        }

        self.store.get(key, lockID, (err, lock) => {
            unlock();

            if(lock) lock.release = self.clear.bind(self, key, lock.id);
            cb(err, lock);
        });
    });
};

RangeLock.prototype.clear = function invalidate(key:string, lockID:string, cb:Function):void {
    // invalidate a specific lockID
    let self:IRangeLock = this;

    self.processLock(key, (err, unlock) => {
        if(err) {
            debug(`invalidate::processLock got error for key=${key}`);
            return cb(err);
        }

        self.store.remove(key, lockID, (err) => {
            unlock();

            cb(err);
        });
    });
};

module.exports = RangeLock;
