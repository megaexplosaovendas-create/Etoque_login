const bcrypt = require('bcrypt');
const User = require('./models/User'); 
const sequelize = require('./config/db');

async function criarUsuarioInicial() {
    try {
        console.log("⏳ Iniciando criação do administrador...");
        await sequelize.authenticate();

        const senhaHashed = await bcrypt.hash('admin123', 10);

        // findOrCreate evita erro se você rodar o script mais de uma vez
        const [user, created] = await User.findOrCreate({
            where: { username: 'admin' },
            defaults: {
                password: senhaHashed,
                role: 'admin'
            }
        });

        if (created) {
            console.log("✅ Usuário ADMIN criado com sucesso!");
            console.log("👤 Usuário: admin");
            console.log("🔑 Senha: admin123");
        } else {
            console.log("⚠️ O usuário 'admin' já existia. Senha atualizada para: admin123");
            user.password = senhaHashed;
            await user.save();
        }
        
        process.exit(); // Fecha o script sozinho
    } catch (error) {
        console.error("❌ Erro ao criar usuário:", error.message);
        process.exit();
    }
}

criarUsuarioInicial();