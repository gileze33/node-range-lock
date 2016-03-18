/* istanbul ignore next */ const DB_URL_BASE = process.env['DB_URL_BASE'] || 'mysql://root:@127.0.0.1';
/* istanbul ignore next */ const DB_NAME = process.env['DB_NAME'] || 'assetra_locks';
/* istanbul ignore next */ const DB_URL = process.env['DB_URL'] || DB_URL_BASE + '/' + DB_NAME;

console.log(`$DBURL was ${process.env['DB_URL']}`)
process.env['DB_URL'] = DB_URL;
console.log(`$DBURL now ${process.env['DB_URL']}`)

import Sequelize = require('sequelize');

interface Config {
  use_env_variable?: string;
  autoMigrateOldSchema?: boolean;

  database?: string;
  username?: string;
  password?: string;

  logging?: Function;
}

export = <{ [env: string]: Config }>{
  'development': {
    'use_env_variable': 'DB_URL',
    'autoMigrateOldSchema': true,
    logging: require('debug')('orm:sql'),
  },
  'test': {
    'use_env_variable': 'DB_URL',
  },
  'staging': {
    'use_env_variable': 'DB_URL',
  },
  'production': {
    'use_env_variable': 'DB_URL',
  },
};
