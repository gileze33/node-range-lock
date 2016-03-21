/* TODO integrate with models/connection/config.
 * HOWEVER must still accept url as a param at construction
 */

import Sequelize = require('sequelize');
/* url including uname, password & database
 */
function sequelizeConnect(url: string){
  let sqlOpts:any = {
    'autoMigrateOldSchema': true
  };
  if (process.env['NODE_ENV'] != 'production'){
    sqlOpts.logging = require('debug')('orm:sql')
  }
  const sequelize = new Sequelize(url, sqlOpts);

  //TODO contracts
  /*interface Lock extends ILock {};
  export interface LockInstance extends Sequelize.Instance<LockInstance, Lock>, Lock {} */
  const Lock = sequelize.define('lock', {
    id: {
      type: Sequelize.STRING,
      allowNull: false,
      primaryKey: true
    },
    key: {
      type: Sequelize.STRING,
    },
    from: {
      type: Sequelize.STRING,
    },
    to: {
      type: Sequelize.STRING,
    },
    expiry: {
      type: Sequelize.STRING,
    },
    data: {
      type: Sequelize.STRING,
    }
  }, {
    tableName: 'lock',
  });

  return new Promise((resolve, reject) => {
    sequelize.query('select 1')
    .then(() =>{
      return Lock.findAll({
        where:{
          id:{$lt:"1", $gt:"2"}
        }
      });
    })
    .then(()=>{
      resolve({
        Sequelize,
        sequelize,
        models: {
          Lock
        }
      })
    })
    .catch(err=> { //?
      reject(err)
    })
  });
};

export default sequelizeConnect;
