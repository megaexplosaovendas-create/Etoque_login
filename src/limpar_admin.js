const User = require('./models/User');
const bcrypt = require('bcryptjs');
const sequelize = require('./config/db');

async function fix() {
    try {
        console.log("🚀 Gerando hash oficial de 60 caracteres...");

        // 1. O próprio Bcrypt gera o hash (IMPOSSÍVEL ser o tamanho errado)
        const hashCorreto = await bcrypt.hash('admin123', 10);
        
        console.log(`📏 Tamanho gerado pelo Node: ${hashCorreto.length}`);

        // 2. Atualizamos o banco
        await User.update(
            { password: hashCorreto },
            { where: { username: 'admin' } }
        );

        // 3. Verificação final no MySQL
        const [results] = await sequelize.query(
            "SELECT username, LENGTH(password) as tamanho FROM users WHERE username = 'admin'"
        );

        console.log("-----------------------------------------");
        console.log(`👤 Usuário: ${results[0].username}`);
        console.log(`📏 Tamanho no Banco: ${results[0].tamanho}`);
        
        if (results[0].tamanho === 60) {
            console.log("✅ AGORA SIM! O tamanho é 60. Pode logar!");
        } else {
            console.log("❌ O banco ainda está fazendo algo estranho.");
        }

    } catch (err) {
        console.error("🔥 Erro:", err.message);
    } finally {
        process.exit();
    }
}

fix();