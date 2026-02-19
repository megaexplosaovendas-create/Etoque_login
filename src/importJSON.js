const fs = require('fs');
const path = require('path');
const Product = require('./models/Product');
const db = require('./config/db');

const sequelize = db.sequelize || db; 

async function importJSON() {
    try {
        // 'force: true' apaga a tabela e cria do zero para garantir uma lista limpa
        await sequelize.sync({ force: true }); 
        console.log('--- Banco de dados resetado e sincronizado ---');

        const filePath = path.join(__dirname, '../produtos.json');
        
        if (!fs.existsSync(filePath)) {
            console.error(`Erro: O arquivo ${filePath} não foi encontrado.`);
            process.exit(1);
        }

        const rawData = fs.readFileSync(filePath, 'utf-8');
        const produtos = JSON.parse(rawData);

        console.log(`Iniciando importação de ${produtos.length} itens...`);

        for (const p of produtos) {
            try {
                // Usamos findOrCreate para evitar erro se houver duplicatas no próprio JSON
                const [product, created] = await Product.findOrCreate({
                    where: { item_id: p.id },
                    defaults: {
                        model_id: 0,
                        nome_produto: p.display,
                        estoque_atual: p.qty,
                        estoque_promocional: 0,
                        localizacao: (p.aliases && p.aliases.length > 0) ? p.aliases.join(', ') : ''
                    }
                });

                if (created) {
                    console.log(`✅ Importado: ${p.display}`);
                } else {
                    console.log(`⚠️  Ignorado (ID duplicado no JSON): ${p.id}`);
                }
            } catch (innerErr) {
                console.error(`❌ Erro ao inserir item ${p.id}:`, innerErr.message);
                // O loop continua para o próximo item
            }
        }

        console.log('🚀 Processo de importação finalizado!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Erro fatal ao importar JSON:', err);
        process.exit(1);
    }
}

importJSON();