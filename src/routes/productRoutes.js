const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const sequelize = require('../config/db'); // Confirme se o caminho está certo
const BipagemHistorico = require('../models/BipagemHistorico');

// --- FUNÇÃO DE LOG ---
async function registrarLog(usuario, acao, detalhes) {
    try {
        const dataLocal = new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
        await sequelize.query(
            'INSERT INTO logs (usuario, acao, detalhes, data_hora) VALUES (?, ?, ?, ?)',
            {
                replacements: [usuario || 'Sistema', acao, detalhes, new Date(dataLocal)],
                type: sequelize.QueryTypes.INSERT
            }
        );
        console.log(`📝 Log: ${acao} | User: ${usuario} | Detalhes: ${detalhes}`);
    } catch (err) {
        console.error("❌ Erro log:", err.message);
    }
}

// 🔹 LISTAR (GET)
router.get('/', async (req, res) => {
    try {
        const products = await Product.findAll({
            where: { status: 'ativo' },
            order: [['updatedAt', 'DESC']]
        });
        return res.json(products);
    } catch (error) {
        return res.status(500).json({ error: error.message })
    }
});

// 🔹 CRIAR (POST) - Com Log de Estoque
router.post('/add', async (req, res) => {
    const { item_id, model_id, nome_produto, estoque_atual, estoque_promocional, localizacao, usuario } = req.body;
    
    // Pega usuário do Link ou Body
    const usuarioFinal = req.query.usuario || usuario || 'Sistema';

    if (!nome_produto || estoque_atual == null) {
        return res.status(400).json({ error: "Dados incompletos" });
    }

    try {
        const product = await Product.create({ item_id, model_id, nome_produto, estoque_atual, estoque_promocional, localizacao });
        
        // 👇 AQUI MUDOU: Mostra o estoque inicial no log
        await registrarLog(usuarioFinal, 'CRIAR_PRODUTO', `Produto: ${nome_produto} | Estoque Inicial: ${estoque_atual}`);
        
        res.json({ success: true, product });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 🔹 EDITAR (PUT) - Com Log de Novo Estoque
router.put('/edit/:item_id', async (req, res) => {
    const { item_id } = req.params;
    const updates = req.body;
    
    // Pega usuário
    const usuarioFinal = req.query.usuario || updates.usuario || 'Sistema';

    try {
        const product = await Product.findOne({ where: { item_id } });
        if (!product) return res.status(404).json({ success: false, error: 'Não encontrado' });

        await product.update(updates);

        // 👇 AQUI MUDOU: Mostra para quanto foi o estoque
        const estoqueMsg = updates.estoque_atual !== undefined ? ` | Novo Estoque: ${updates.estoque_atual}` : '';
        
        await registrarLog(usuarioFinal, 'EDITAR_PRODUTO', `Editou ID: ${item_id}${estoqueMsg}`);

        res.status(200).json({ success: true, product });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 🔹 DELETAR (DELETE) - Correção para pegar o nome
router.delete('/delete/:item_id', async (req, res) => {
    const { item_id } = req.params;
    
    // 👇 AQUI ESTÁ A CORREÇÃO DO "SISTEMA"
    // O backend agora olha com prioridade para o LINK (req.query)
    const usuarioFinal = req.query.usuario || req.body.usuario || 'Sistema';

    try {
        const product = await Product.findOne({ where: { item_id } });
        if (!product) return res.status(404).json({ success: false, error: 'Não encontrado' });

        await product.destroy();

        // Grava log com o nome certo
        await registrarLog(usuarioFinal, 'ARQUIVAR_PRODUTO', `Arquivou item ID: ${item_id}`);

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;