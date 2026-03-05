const express = require('express');
const router = express.Router();
const { Op, fn, col, literal } = require('sequelize');
const Venda = require('../models/Vendas');
const moment = require('moment');

router.get('/resumo', async (req, res) => {
    const { filtro } = req.query;
    const hoje = moment('2026-03-05'); // 📅 Ajustado para dia 05 para pegar suas vendas recentes
    let dataInicio, dataFim;

    if (filtro === 'last') {
        dataInicio = hoje.clone().subtract(1, 'month').startOf('month').format('YYYY-MM-DD');
        dataFim = hoje.clone().subtract(1, 'month').endOf('month').format('YYYY-MM-DD');
    } else if (filtro === 'year') {
        dataInicio = hoje.clone().startOf('year').format('YYYY-MM-DD');
        dataFim = hoje.clone().endOf('year').format('YYYY-MM-DD');
    } else { // current
        dataInicio = hoje.clone().startOf('month').format('YYYY-MM-DD');
        dataFim = hoje.clone().format('YYYY-MM-DD');
    }

    try {
        const resultado = await Venda.findOne({
            attributes: [
                // 1. Soma do Faturamento
                [fn('SUM', literal('quantidade * preco_venda')), 'faturamento'],

                // 2. Total de Bipes (Contagem de todas as linhas)
                [fn('COUNT', col('id')), 'bipes'],

                // 3. Total de Pedidos Reais (Se quiser que seja igual aos bipes, use 'id')
                // Se quiser pedidos únicos por transação, use 'DISTINCT' em 'item_id' ou similar
                [fn('COUNT', col('id')), 'pedidosReais']
            ],
            where: {
                data_venda: { [Op.between]: [dataInicio, dataFim] }
            },
            raw: true
        });

        const faturamento = parseFloat(resultado.faturamento) || 0;
        const bipes = parseInt(resultado.bipes) || 0;
        const pedidosReais = parseInt(resultado.pedidosReais) || 0;

        // 🚩 A MATEMÁTICA DO TICKET MÉDIO
        // Agora ele divide o faturamento de R$ 1 milhão pelos ~2.948 bipes
        const ticketMedioCalculado = pedidosReais > 0 ? (faturamento / pedidosReais) : 0;

        res.json({
            faturamento,
            bipes,
            pedidosReais,
            ticketMedio: ticketMedioCalculado.toFixed(2)
        });
    } catch (e) {
        res.status(500).json({ erro: e.message });
    }
});


// Rotas de Gráfico (Diário e Anual) mantidas para o Front-end buscar
router.get('/grafico-diario', async (req, res) => {
    const { filtro } = req.query;
    const hoje = moment('2026-03-04');
    let dataInicio = (filtro === 'last')
        ? hoje.clone().subtract(1, 'month').startOf('month').format('YYYY-MM-DD')
        : hoje.clone().startOf('month').format('YYYY-MM-DD');
    let dataFim = (filtro === 'last')
        ? hoje.clone().subtract(1, 'month').endOf('month').format('YYYY-MM-DD')
        : hoje.clone().endOf('month').format('YYYY-MM-DD');

    const vendasDia = await Venda.findAll({
        attributes: [[fn('DAY', col('data_venda')), 'dia'], [fn('SUM', literal('quantidade * preco_venda')), 'total']],
        where: { data_venda: { [Op.between]: [dataInicio, dataFim] } },
        group: [fn('DAY', col('data_venda'))],
        raw: true
    });
    const obj = {};
    vendasDia.forEach(v => obj[v.dia] = parseFloat(v.total));
    res.json(obj);
});

router.get('/grafico-anual', async (req, res) => {
    const vendasMes = await Venda.findAll({
        attributes: [[fn('MONTH', col('data_venda')), 'mes'], [fn('SUM', literal('quantidade * preco_venda')), 'total']],
        where: { data_venda: { [Op.gte]: '2026-01-01' } },
        group: [fn('MONTH', col('data_venda'))],
        raw: true
    });
    const obj = {};
    vendasMes.forEach(v => obj[v.mes] = parseFloat(v.total));
    res.json(obj);
});

module.exports = router;