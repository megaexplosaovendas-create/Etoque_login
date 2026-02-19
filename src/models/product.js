const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Product = sequelize.define('Product', {
    item_id: {
        type: DataTypes.STRING,
        primaryKey: true,
        unique: true,
        allowNull: false
    },
    model_id: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    nome_produto: {
        type: DataTypes.STRING
    },
    preco_venda: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.00
    },
    preco_custo: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.00
    },
    investimento_ads: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.00
    },
    estoque_atual: { // ⚠️ Esse é o nome correto do campo de estoque
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    estoque_promocional: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    localizacao: {
        type: DataTypes.STRING
    },
    fornecedor: {
        type: DataTypes.STRING,
        defaultValue: "Não informado"
    },
    curva_abc: {
        type: DataTypes.STRING,
        defaultValue: "C"
    },
    visualizacoes: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    status: {
        type: DataTypes.STRING,
        defaultValue: "ativo"
    },
    // 👇 ADICIONE ISSO PARA SINCRONIZAR COM O BANCO 👇
    imagem_url: {
        type: DataTypes.STRING,
        allowNull: true
    }
}, {
    tableName: 'produtos',
    freezeTableName: true,
    timestamps: true
});

module.exports = Product;