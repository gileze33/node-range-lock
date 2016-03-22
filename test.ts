import * as url from 'url';
const redis = require('redis');
let client = null;
let RangeLock = null;
let DB_URL = null;
let rangeLock = null;

describe('setup', () => {
  it('should complete', done => {
      if (process.env.REDISTOGO_URL) {
      var parsed = url.parse(process.env.REDISTOGO_URL);

      var obj = {};
      if (parsed.auth) {
        var auth = parsed.auth.split(':');
        obj = {
          auth_pass: auth[1],
        };
      }
      client = redis.createClient(parsed.port, parsed.hostname, obj);
    } else {
      client = redis.createClient();
      client.select(4, function() { /* ... */ });
    }

    const DB_URL_BASE = process.env.DB_URL_BASE || 'mysql://root:@localhost';
    const DB_NAME = process.env.DB_NAME || 'assetra_locks';
    DB_URL = process.env.LOCK_DB_URL || DB_URL_BASE+'/'+DB_NAME;

    RangeLock = require('./index.js');
    rangeLock = new RangeLock(client, DB_URL);
    done();
  });
});

const testKey = 'lock::org_1::asset_1';
const testFrom = new Date().getTime();
const testTo = new Date().getTime() + 60*60*1000;
const testData = "{test:1}";
const testTtl = 60*60*1000;
let lockId = null;

describe('interface', () => {
  it('should set', done => {
    rangeLock.set(testKey, testFrom, testTo, testData, testTtl, (err, data, lock) => {
      if (err) throw err;
      lockId = lock.id;
      done();
    });
  });
  it('should get', done => {
    rangeLock.get(testKey, lockId, (err, lock) => {
      if (err) throw err;

      done()
    });
  });
});
