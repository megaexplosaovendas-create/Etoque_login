const { DataTypes } = require('sequelize');
const sequelize = require('../config/db'); // 🚩 Ajuste o caminho para onde está sua conexão real

const HistoricoPedido = sequelize.define('HistoricoPedido', {
    quantidade: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    data_registro: {
        type: DataTypes.DATEONLY,
        allowNull: false
    }
}, {
    tableName: 'historico_pedidos',
    timestamps: false
});

module.exports = HistoricoPedido;