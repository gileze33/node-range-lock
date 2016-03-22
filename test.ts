import * as url from 'url';
import assert = require('assert');

let redis:any = null;
let client:any = null;
let RangeLock:any = null;
let DB_URL:string = null;
let rangeLock:any = null;
let lockRelease:Function = null;

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

    RangeLock = require('./index.js');
    rangeLock = new RangeLock(client, DB_URL);
    done();
  });
});

const testKey:string = 'lock::org_1::asset_1';
const testFrom:number = new Date().getTime();
const testTo:number = new Date().getTime() + 60*60*1000;
const testData:string = JSON.stringify({test:1});
const testTtl:number = 2*60*1000;
let lockId:string = null;

describe('interface', () => {
  it('should set', done => {
    rangeLock.set(testKey, testFrom, testTo, testData, testTtl, (err, success, lock) => {
      if (err) throw err;
      assert(success === true, 'success !== true');
      assert(typeof lock.id == 'string', 'malformed lock id');
      assert(typeof lock.release == 'function', 'malformed lock release');
      assert(lock.expiry == parseInt(lock.expiry.toString(10)), 'malformed lock expiry');
      lockId = lock.id;
      done();
    });
  });
  it('should get', done => {
    rangeLock.get(testKey, lockId, (err, lock) => {
      if (err) throw err;
      assert.doesNotThrow(() => {
        console.log(lock.data)
        let obj = JSON.parse(lock.data);
      });
      assert(typeof lock.release == 'function', 'malformed lock release');
      lockRelease = lock.release
      done()
    });
  });
  it('should return releasable locks', done => {
    lockRelease((err) => {
      if (err) throw err;
      done()
    });
  });

});
