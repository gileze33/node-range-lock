import * as url from 'url';
import assert = require('assert');

let redis:any = null;
let client:any = null;
let RangeLock:any = null;
let DB_URL:string = null;
let rangeLock:any = null;

describe('setup', () => {
  it('should complete', done => {
      redis = require('redis');
      if (process.env.REDISTOGO_URL) {
      let parsed = url.parse(process.env.REDISTOGO_URL);

      var obj = {};
      if (parsed.auth) {
        var auth:string[] = parsed.auth.split(':');
        obj = {
          auth_pass: auth[1],
        };
      }
      client = redis.createClient(parsed.port, parsed.hostname, obj);
    } else {
      client = redis.createClient();
      client.select(4, function() { /* ... */ });
    }

    const DB_URL_BASE:string = process.env.DB_URL_BASE || 'mysql://root:@localhost';
    const DB_NAME:string = process.env.DB_NAME || 'lock';
    DB_URL = process.env.LOCK_DB_URL || DB_URL_BASE+'/'+DB_NAME;

    RangeLock = require('../index');
    rangeLock = new RangeLock(client, DB_URL);
    done();
  });
});

const testKey:string = 'lock::org_1::asset_1';
let testFrom:number = new Date().getTime();
let testTo:number = new Date().getTime() + 60*60*1000;
const testData:string = JSON.stringify({test:1});
const testTtl:number = 2*60*1000;

describe('interface', () => {
  let lockId:string = null;
  let lockReleaseFromGet:Function = null;
  let lockReleaseFromSet:Function = null;
  it('should set', done => {
    rangeLock.set(testKey, testFrom, testTo, testData, testTtl, (err, success, lock) => {
      if (err) throw err;
      assert(success === true, 'success !== true');
      assert(typeof lock.id == 'string', 'malformed lock id');
      assert(typeof lock.release == 'function', 'malformed lock release');
      assert(lock.expiry == parseInt(lock.expiry.toString(10)), 'malformed lock expiry');
      lockId = lock.id;
      lockReleaseFromSet = lock.release;
      done();
    });
  });
  it('should get', done => {
    rangeLock.get(testKey, lockId, (err, lock) => {
      if (err) throw err;
      assert.doesNotThrow(() => {
        let obj = JSON.parse(lock.data);
      });
      assert(typeof lock.release == 'function', 'malformed lock release');
      lockReleaseFromGet = lock.release;
      done();
    });
  });
  it('should return releasable locks from set', done => {
    lockReleaseFromSet((err) => {
      if (err) throw err;
      done();
    });
  });
  it('should return releasable locks from get', done => {
    lockReleaseFromGet((err) => {
      if (err) throw err;
      done();
    });
  });
});

describe('overlaps', () => {
  let lockReleases:Function[] = [];
  let initialLockId:string = null

  it('should set initial T+1hr>T+4hr', done => {
    testFrom = new Date().getTime() + 60*60*1000;
    testTo = new Date().getTime() + 4*60*60*1000;
    rangeLock.set(testKey, testFrom, testTo, testData, testTtl, (err, success, lock) => {
      if (err) throw err;
      assert(success === true, 'success !== true');
      assert(typeof lock.id == 'string', 'malformed lock id');
      assert(typeof lock.release == 'function', 'malformed lock release');
      assert(lock.expiry == parseInt(lock.expiry.toString(10)), 'malformed lock expiry');
      initialLockId = lock.id;
      lockReleases[0] = lock.release;
      done();
    });
  });
  it('should not set overlapping T+2hr>T+5hr', done => {
    testFrom = new Date().getTime() + 2*60*60*1000;
    testTo = new Date().getTime() + 5*60*60*1000;
    rangeLock.set(testKey, testFrom, testTo, testData, testTtl, (err, success, lock) => {
      if (err) throw err;
      assert(success === false, 'success !== false');
      assert(typeof lock.id == 'string', 'malformed lock id');
      assert(lock.id == initialLockId, 'lock id not from blocking lock');
      assert(typeof lock.release == 'function', 'malformed lock release');
      assert(lock.expiry == parseInt(lock.expiry.toString(10)), 'malformed lock expiry');
      lockReleases[1] = lock.release;
      done();
    });
  });
  it('should not set contained T+2hr>T+3hr', done => {
    testFrom = new Date().getTime() + 2*60*60*1000;
    testTo = new Date().getTime() + 3*60*60*1000;
    rangeLock.set(testKey, testFrom, testTo, testData, testTtl, (err, success, lock) => {
      if (err) throw err;
      assert(success === false, 'success !== false');
      assert(typeof lock.id == 'string', 'malformed lock id');
      assert(lock.id == initialLockId, 'lock id not from blocking lock');
      assert(typeof lock.release == 'function', 'malformed lock release');
      assert(lock.expiry == parseInt(lock.expiry.toString(10)), 'malformed lock expiry');
      lockReleases[2] = lock.release;
      done();
    });
  });
  it('should not set containing T+0hr>T+5hr', done => {
    testFrom = new Date().getTime();
    testTo = new Date().getTime() + 5*60*60*1000;
    rangeLock.set(testKey, testFrom, testTo, testData, testTtl, (err, success, lock) => {
      if (err) throw err;
      assert(success === false, 'success !== false');
      assert(typeof lock.id == 'string', 'malformed lock id');
      assert(lock.id == initialLockId, 'lock id not from blocking lock');
      assert(typeof lock.release == 'function', 'malformed lock release');
      assert(lock.expiry == parseInt(lock.expiry.toString(10)), 'malformed lock expiry');
      lockReleases[3] = lock.release;
      done();
    });
  });
  it('should set later T+5hr>T+6hr', done => {
    testFrom = new Date().getTime() + 5*60*60*1000;
    testTo = new Date().getTime() + 6*60*60*1000;
    rangeLock.set(testKey, testFrom, testTo, testData, testTtl, (err, success, lock) => {
      if (err) throw err;
      assert(success === true, 'success !== true');
      assert(typeof lock.id == 'string', 'malformed lock id');
      assert(lock.id != initialLockId, 'lock id from blocking lock');
      assert(typeof lock.release == 'function', 'malformed lock release');
      assert(lock.expiry == parseInt(lock.expiry.toString(10)), 'malformed lock expiry');
      initialLockId = lock.id;
      lockReleases[0] = lock.release;
      done();
    });
  });
  it('should return releasable locks', done => {
    function releaseNext(){
      const release:Function = lockReleases.pop();
      if (!release) {
        return done();
      } else {
        return release(err => {
          if (err) throw err;
          releaseNext()
        });
      }
    }
    releaseNext();
  });
});

describe('cancelling & relocking', () => {
  let lockId:string = null;
  let lockReleaseFromGet:Function = null;
  let lockReleaseFromSet:Function = null;
  it('should set', done => {
    rangeLock.set(testKey, testFrom, testTo, testData, testTtl, (err, success, lock) => {
      if (err) throw err;
      assert(success === true, 'success !== true');
      assert(typeof lock.id == 'string', 'malformed lock id');
      assert(typeof lock.release == 'function', 'malformed lock release');
      assert(lock.expiry == parseInt(lock.expiry.toString(10)), 'malformed lock expiry');
      lockId = lock.id;
      lockReleaseFromSet = lock.release;
      done();
    });
  });
  it('should return releasable locks from set', done => {
    lockReleaseFromSet((err) => {
      if (err) throw err;
      done();
    });
  });
  it('should not get', done => {
    rangeLock.get(testKey, lockId, (err, lock) => {
      if (err) throw err;
      assert(lock === null, 'lock should be null');
      if (lock){
        return lock.release((err) => {
          if (err) throw err;
          done();
        });
      }
      done();
    });
  });
  it('should re-set', done => {
    rangeLock.set(testKey, testFrom, testTo, testData, testTtl, (err, success, lock) => {
      if (err) throw err;
      assert(success === true, 'success !== true');
      assert(typeof lock.id == 'string', 'malformed lock id');
      assert(typeof lock.release == 'function', 'malformed lock release');
      assert(lock.expiry == parseInt(lock.expiry.toString(10)), 'malformed lock expiry');
      lockId = lock.id;
      lockReleaseFromSet = lock.release;
      done();
    });
  });
  it('should return releasable locks from re-set', done => {
    lockReleaseFromSet((err) => {
      if (err) throw err;
      done();
    });
  });
});
