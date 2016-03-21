import Sequelize = require('sequelize');
import Config    = require('./config');
const env        = process.env['NODE_ENV'] || 'development';
const config     = Config[env];

/* istanbul ignore next */
export const sequelize  = (() => {
  if (config.use_env_variable) {
    return new Sequelize(process.env[config.use_env_variable], config);
  }
  return new Sequelize(config.database, config.username, config.password, config);
})();

export default sequelize;
