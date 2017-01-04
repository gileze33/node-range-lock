import Sequelize = require('sequelize');

export interface ISequelize {
  Sequelize: any; // lib
  sequelize: any; // instance
  models: any   // table models
}

/**
 * @param url including uname, password & database
 */
function sequelizeConnect(url: string): ISequelize{
  let sqlOpts:any = {
    'autoMigrateOldSchema': true,
    'pool':{
      'validate': (client) => {
        if (client.state != 'authenticated') {
          console.error(`DB client not authenticated, state: ${client.state}`)
        }
        if (client.state == 'disconnected') {
          return Sequelize.Promise.reject(new Error(`Found a DB client in state: ${client.state}`));
        }
        return Sequelize.Promise.resolve();
      }
    }
  };
  if (process.env['NODE_ENV'] != 'production'){
    sqlOpts.logging = require('debug')('range-lock:sql')
  }
  const sequelize = new Sequelize(url, sqlOpts);

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
    timestamps: false
  });
  Lock.sync();

  return {
    Sequelize,
    sequelize,
    models: {
      Lock
    }
  }
};

export default sequelizeConnect;
