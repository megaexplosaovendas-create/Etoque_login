
const { Sequelize } = require('sequelize');
const path = require('path');

// ✅ Garante que o Node suba uma pasta para achar o seu .env (C:\Users\Jone\Desktop\...)
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS, 
  {
    host: process.env.DB_HOST,
    dialect: 'mysql',
    port: process.env.DB_PORT || 3306,
    logging: false,
    dialectOptions: {
      connectTimeout: 60000 // 
    }
  }
);

// Teste rápido de console para você ver se as variáveis carregaram
console.log('--- Verificação de Ambiente ---');
console.log('Banco:', process.env.DB_NAME);
console.log('Host:', process.env.DB_HOST);
console.log('-------------------------------');

module.exports = sequelize;