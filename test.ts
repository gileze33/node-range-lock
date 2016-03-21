
let redis = null;
let client = null;
let RangeLock = null;
let DB_URL = null;
let rangeLock = null;

describe('setup', () => {
  it('should complete', done => {
    redis = require('redis');
    client = redis.createClient( '6379',  '127.0.0.1', {});
    RangeLock = require('./index.js');
    DB_URL = 'mysql://root:password@127.0.0.1:3306/assetra_locks';
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
