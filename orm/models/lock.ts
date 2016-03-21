import Sequelize = require('sequelize');
import sequelize from '../connection';

/* TODO contracts

import {Lock as ILock} from '@assetra/contracts/shared-data/lock';

interface Lock extends ILock {}
export interface LockInstance extends Sequelize.Instance<LockInstance, Lock>, Lock {}
const Lock = sequelize.define<LockInstance, Lock>('lock', {
 //...
  }, {
});
*/

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

export default Lock;
