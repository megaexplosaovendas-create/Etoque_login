const { DataTypes } = require('sequelize');

// Aqui você importou como "sequelize"
const sequelize = require('../config/db');

// Então aqui embaixo TEM que ser "sequelize.define"
const BipagemHistorico = sequelize.define('BipagemHistorico', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    sku: {
        type: DataTypes.STRING,
        allowNull: false
    },
    fornecedor: {
        type: DataTypes.STRING,
        defaultValue: 'Não Identificado'
    },
    data_registro: {
        type: DataTypes.DATEONLY
    },
    horario: {
        type: DataTypes.TIME
    },
    motorista: {
        type: DataTypes.STRING
    },
    placa: {
        type: DataTypes.STRING
    },
    status: {
        type: DataTypes.STRING
    }
}, {
    tableName: 'bipagens_historico',
    timestamps: false
});

module.exports = BipagemHistorico;