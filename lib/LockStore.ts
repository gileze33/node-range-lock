import sequelizeConnect from '../sequelize';
const uuid = require('uuid');
const debug:Function = require('debug')('range-lock');

function generateIntersectsSQL(start:{field:string, value:number}, end:{field:string, value:number}) {
   // start and end should both look like = {"field": "xxx", "value": 0}
   return {
     [start.field]: {
       $lte: end.value,
     },
     [end.field]: {
       $gte: start.value,
     },
   };

   // return '((`'+start.field+'` <= '+start.value+' AND `'+end.field+'` >= '+end.value+')
   // OR (`'+start.field+'` >= '+start.value+' AND `'+start.field+'` <= '+end.value+' AND `'+end.field+'` >= '+end.value+')
   // OR (`'+start.field+'` <= '+start.value+' AND `'+end.field+'` >= '+start.value+' AND `'+end.field+'` <= '+end.value+')
   // OR (`'+start.field+'` >= '+start.value+' AND `'+end.field+'` <= '+end.value+'))';
};

interface Ilock {
  key: string;
  from: string;
  to: string;
  expiry: string;
  id?: string;
  data: string;
}
interface IConnectCB {
  (): void;
}

class LockStore {
  url: string;
  ready: boolean;
  connecting: boolean;
  connectQueue:IConnectCB[];
  db: {
    models:{
      Lock:any; // sequelize model Obj
    }
  }


  constructor(url:string) {
      this.url = url;
      this.ready = false;
      this.connecting = false;

      this.connect(() => {
          debug(`LockStore connected to data store at ${url}`);

          // make the client tidy up the DB every 30 seconds
          setInterval(() => {
              this.tidy(err => {
                if (err) debug(`tidy err: ${err}`)
              });
          }, 30000)
      });
  };

  connect(cb:IConnectCB):void|number {
      if(this.ready) {
          return cb();
      }
      this.connectQueue = this.connectQueue || [];
      if(this.connecting) {
          return this.connectQueue.push(cb);
      }
      this.connecting = true;

      const done = () => {
          cb();
          if(this.connectQueue.length > 0) {
              for(let i:number=0; i<this.connectQueue.length; i++) {
                  this.connectQueue[i]();
              }
          }
      };
      try {
        const {Sequelize, sequelize, models} = sequelizeConnect(this.url);
        this.db = {
          models
        };
        this.ready = true;
        this.connecting = false;
        done();
      } catch (err){
        console.log(`FATAL: range-lock LockStore failed to connect to data store`);
      }
  };

  find(key:string, from:number, to:number, cb:Function):void {
      // find any valid entries for this key where the from / to overlaps the passed info
      let now:number = new Date().getTime();
      this.db.models.Lock.findAll({where: {
        $and: [
          {
            key: key,
            expiry:{
              $gt:now
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
      }}).then((results) => {
        debug(`find for key=${key}, from=${from}, to=${to} got ${results.length} results`);
        cb(null, results);
      }).catch(err => {
        return cb(err);
      });
  };

  create(key:string, from:number, to:number, data:string, ttl:number, cb:Function):void {
      // generate a string ID for this lock, check it doesn't exist already and then insert it
      const createLock = () => {
          const now:number = new Date().getTime();
          const nowStr:string = (now+'');
          const lockID:string = `${nowStr.substr(-5)}-${nowStr.substr(-10, 5)}-${uuid.v4()}`;

          this.db.models.Lock.count({ where: {
              id: lockID
          }}).then(count => {
              if(count > 0) {
                  debug(`found conflict for lock id ${lockID}`);
                  return createLock();
              }

              let obj:Ilock = {
                  key: key,
                  from: from.toString(10),
                  to: to.toString(10),
                  expiry: (now + ttl).toString(10),
                  data: data
              };
              obj.id = lockID;
              debug(`creating lock with ID ${lockID}`, obj);
              return this.db.models.Lock.create(obj)
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

  get(key:string, lockID:string, cb:Function):void {
      // find the specified lock - returns null if not found
      const now:number = new Date().getTime();
      this.db.models.Lock.findAll({where: {
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
          let lock:Ilock = results[0];
          debug(`get for key=${key}, id=${lockID} found a valid lock`, lock);
          cb(null, lock);
      })
      .catch(err => {
        return cb(err);
      });
  };

  remove(key:string, lockID:string, cb:Function):void {
      debug(`deleting lock with key=${key}, id=${lockID}`);

      this.db.models.Lock.destroy({where: {
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

  tidy(cb:Function):void {
      // this method will go thru and remove any records where their expiry has passed
      const now:number = new Date().getTime();

      this.db.models.Lock.count({ where: {
          expiry: {
            $lte: now
          }
      }})
      .then(count => {
          debug(`tidy found ${count} items to remove`);
          return this.db.models.Lock.destroy({where: {
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
}
export default LockStore
