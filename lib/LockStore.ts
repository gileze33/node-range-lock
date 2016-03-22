import sequelizeConnect from '../sequelize';
const uuid = require('uuid');
const debug:Function = require('debug')('range-lock');

function LockStore(url:string) {
    this.url = url;
    this.ready = false;
    this.connecting = false;

    let store:any = this;
    this.connect(() => {
        debug(`LockStore connected to data store at ${url}`);

        // make the client tidy up the DB every 30 seconds
        setInterval(() => {
            store.tidy();
        }, 30000)
    });
};

LockStore.prototype.connect = function(cb:Function) {
    if(this.ready) {
        return cb();
    }
    this.connectQueue = this.connectQueue || [];
    if(this.connecting) {
        return this.connectQueue.push(cb);
    }
    this.connecting = true;

    function done() {
        cb();
        if(store.connectQueue.length > 0) {
            for(let i:number=0; i<store.connectQueue.length; i++) {
                store.connectQueue[i]();
            }
        }
    };
    let store:any = this;
    try {
      const {Sequelize, sequelize, models} = sequelizeConnect(this.url);
      store.db = {
        models
      };
      store.ready = true;
      store.connecting = false;
      done();
    } catch (err){
      console.log(`FATAL: range-lock LockStore failed to connect to data store`);
    }
};

 function generateIntersectsSQL(start:{field:string, value:number}, end:{field:string, value:number}) {
    // start and end should both look like = {"field": "xxx", "value": 0}

    start.value = start.value * 1;
    end.value = end.value * 1;
    let orQuery:Object[]  = [{},{},{},{}];
    orQuery[0]['$and'] = {};
    orQuery[0]['$and'][start.field] = {$lte: start.value};
    orQuery[0]['$and'][end.field] = {$gte: end.value};
    orQuery[1]['$and'] = {};
    orQuery[1]['$and'][start.field] = {$gte: start.value};
    orQuery[1]['$and'][start.field] = {$lte: end.value};
    orQuery[1]['$and'][end.field] = {$gte: end.value};
    orQuery[2]['$and'] = {};
    orQuery[2]['$and'][start.field] = {$lte: start.value};
    orQuery[2]['$and'][end.field] = {$gte: start.value};
    orQuery[2]['$and'][end.field] = {$lte: end.value};
    orQuery[3]['$and'] = {};
    orQuery[3]['$and'][start.field] = {$gte: start.value};
    orQuery[3]['$and'][end.field] = {$lte: end.value};

    return orQuery;
    //return '((`'+start.field+'` <= '+start.value+' AND `'+end.field+'` >= '+end.value+') OR (`'+start.field+'` >= '+start.value+' AND `'+start.field+'` <= '+end.value+' AND `'+end.field+'` >= '+end.value+') OR (`'+start.field+'` <= '+start.value+' AND `'+end.field+'` >= '+start.value+' AND `'+end.field+'` <= '+end.value+') OR (`'+start.field+'` >= '+start.value+' AND `'+end.field+'` <= '+end.value+'))';
};
LockStore.prototype.find = function find(key:string, from:number, to:number, cb:Function) {
    let store = this;

    // find any valid entries for this key where the from / to overlaps the passed info
    let now:number = new Date().getTime();
    store.db.models.Lock.findAll({where: {
        key: key,
        expiry:{
          $gt:now
        },
        $or: generateIntersectsSQL({
          field: 'from',
          value: from
        }, {
          field: 'to',
          value: to
        })
      }}).then((results) => {
        debug(`find for key=${key}, from=${from}, to=${to} got ${results.length} results`);
        cb(null, results);
    }).catch(err => {
      return cb(err);
    });
};

LockStore.prototype.create = function create(key, from, to, data, ttl, cb) {
    let store = this;

    // generate a string ID for this lock, check it doesn't exist already and then insert it
    function createLock() {
        const now:number = new Date().getTime();
        const nowStr:string = (now+'');
        const lockID:string = `${nowStr.substr(-5)}-${nowStr.substr(-10, 5)}-${uuid.v4()}`;

        store.db.models.Lock.count({ where: {
            id: lockID
        }}).then(count => {
            if(count > 0) {
                debug(`found conflict for lock id ${lockID}`);
                return createLock();
            }

            let obj:any = {
                key: key,
                from: from,
                to: to,
                expiry: now + ttl,
                data: data,
                id: null
            };
            obj.id = lockID;
            debug(`creating lock with ID ${lockID}`, obj);
            return store.db.models.Lock.create(obj)
        })
        .then(result => {
          if(cb) cb(null, result);
        })
        .catch(err => {
          return cb(err);
        });
    };
    createLock();
};

LockStore.prototype.get = function find(key:string, lockID:string, cb:Function) {
    let store = this;

    // find the specified lock - returns null if not found
    const now:number = new Date().getTime();
    store.db.models.Lock.findAll({where: {
        key: key,
        id: lockID,
        expiry: {
          $gt: now
        }
    }})
    .then(results => {
        if(results.length === 0) {
            debug(`get for key=${key}, id=${lockID} found no valid locks`);
            return cb(null, null);
        }
        let lock:any = results[0];
        debug(`get for key=${key}, id=${lockID} found a valid lock`, lock);
        cb(null, lock);
    })
    .catch(err => {
      return cb(err);
    });
};

LockStore.prototype.remove = function remove(key, lockID, cb) {
    let store = this;

    debug(`deleting lock with key=${key}, id=${lockID}`);

    store.db.models.Lock.destroy({where: {
        key: key,
        id: lockID
    }})
    .then(result => {
        if(cb) cb(null, result);
    })
    .catch(err => {
      return cb(err);
    });
};

LockStore.prototype.tidy = function tidy(cb) {
    // this method will go thru and remove any records where their expiry has passed
    let store = this;

    const now:number = new Date().getTime();

    store.db.models.Lock.count({ where: {
        expiry: {
          $lte: now
        }
    }})
    .then(count => {
        debug(`tidy found ${count} items to remove`);
        return store.db.models.Lock.destroy({where: {
            expiry: {
              $lte: now
            }
        }})
    })
    .then(result => {
      debug(`tidy completed`);
    })
    .catch(err => {
      if(cb) cb(err);
      debug(`tidy got error`, err);

      return;
    })
};

export default LockStore;
