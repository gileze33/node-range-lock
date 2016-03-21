export function up(queryInterface, Sequelize) {
  return queryInterface.createTable('lock', {
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
    },
    createdAt: {
      type: Sequelize.DATE,
    },
    updatedAt: {
      type: Sequelize.DATE,
    },
  });
}

export function down(queryInterface, Sequelize) {
  return queryInterface.dropTable('lock');
}
