const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Venda = sequelize.define('Venda', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    item_id: {
        type: DataTypes.STRING, // Nota: Se você salvar o SKU aqui, STRING é o ideal.
        allowNull: false
    },
    plataforma: {
        type: DataTypes.STRING(50),
        allowNull: true,
        defaultValue: 'Manual/PDF'
    },
    cliente_nome: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    quantidade: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    data_venda: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    hora_venda: {
        type: DataTypes.TIME,
        allowNull: true
    }

}, {
    tableName: 'vendas',
    freezeTableName: true,
    timestamps: true
});

module.exports = Venda;