const { DataTypes } = require('sequelize');
const sequelize = require('../config/db'); // 🟢 Apenas uma importação é necessária

const User = sequelize.define('User', {
    username: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false
    },
    role: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'estoquista'
    },
    // 👇 ADICIONADO PARA RASTREIO 👇
    last_login: {
        type: DataTypes.DATE,
        allowNull: true
    },
    last_logout: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    // Garante que o Sequelize não tente criar colunas 'createdAt' e 'updatedAt' 
    // se você não as tiver na tabela do banco.
    timestamps: false,
    tableName: 'users'
});

module.exports = User;