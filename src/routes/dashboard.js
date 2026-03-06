const express = require('express');
const router = express.Router();
const { Op, fn, col, literal } = require('sequelize');
const Venda = require('../models/Vendas');
const moment = require('moment');

router.get('/resumo', async (req, res) => {
    const { filtro } = req.query;
    const hoje = moment('2026-03-05');

    let dataInicio, dataFim;
    let dataInicioAnt, dataFimAnt;

    if (filtro === 'last') {
        // Mês passado completo
        dataInicio    = hoje.clone().subtract(1, 'month').startOf('month').format('YYYY-MM-DD');
        dataFim       = hoje.clone().subtract(1, 'month').endOf('month').format('YYYY-MM-DD');
        // Comparação: 2 meses atrás completo
        dataInicioAnt = hoje.clone().subtract(2, 'months').startOf('month').format('YYYY-MM-DD');
        dataFimAnt    = hoje.clone().subtract(2, 'months').endOf('month').format('YYYY-MM-DD');

    } else if (filtro === 'year') {
        // Ano atual
        dataInicio    = hoje.clone().startOf('year').format('YYYY-MM-DD');
        dataFim       = hoje.clone().endOf('year').format('YYYY-MM-DD');
        // Comparação: ano passado completo
        dataInicioAnt = hoje.clone().subtract(1, 'year').startOf('year').format('YYYY-MM-DD');
        dataFimAnt    = hoje.clone().subtract(1, 'year').endOf('year').format('YYYY-MM-DD');

    } else { // current
        // Mês atual até hoje
        dataInicio    = hoje.clone().startOf('month').format('YYYY-MM-DD');
        dataFim       = hoje.clone().format('YYYY-MM-DD');
        // ✅ CORREÇÃO: mês anterior COMPLETO (não só até o dia 05)
        // Usar o mês inteiro permite comparação real com fevereiro
        dataInicioAnt = hoje.clone().subtract(1, 'month').startOf('month').format('YYYY-MM-DD');
        dataFimAnt    = hoje.clone().subtract(1, 'month').endOf('month').format('YYYY-MM-DD');
    }

    try {
        const resultado = await Venda.findOne({
            attributes: [
                [fn('SUM', literal('quantidade * preco_venda')), 'faturamento'],
                [fn('COUNT', col('id')), 'bipes'],
                [fn('COUNT', col('id')), 'pedidosReais']
            ],
            where: { data_venda: { [Op.between]: [dataInicio, dataFim] } },
            raw: true
        });

        const resultadoAnt = await Venda.findOne({
            attributes: [
                [fn('SUM', literal('quantidade * preco_venda')), 'faturamento'],
                [fn('COUNT', col('id')), 'bipes']
            ],
            where: { data_venda: { [Op.between]: [dataInicioAnt, dataFimAnt] } },
            raw: true
        });

        const faturamento    = parseFloat(resultado.faturamento)    || 0;
        const bipes          = parseInt(resultado.bipes)            || 0;
        const pedidosReais   = parseInt(resultado.pedidosReais)     || 0;
        const faturamentoAnt = parseFloat(resultadoAnt.faturamento) || 0;
        const bipesAnt       = parseInt(resultadoAnt.bipes)         || 0;

        const ticketMedio    = pedidosReais > 0 ? faturamento    / pedidosReais : 0;
        const ticketMedioAnt = bipesAnt     > 0 ? faturamentoAnt / bipesAnt     : 0;

        const faturamentoTendencia = faturamentoAnt > 0
            ? ((faturamento - faturamentoAnt) / faturamentoAnt * 100).toFixed(1)
            : null;

        const ticketTendencia = ticketMedioAnt > 0
            ? ((ticketMedio - ticketMedioAnt) / ticketMedioAnt * 100).toFixed(1)
            : null;

        res.json({
            faturamento,
            bipes,
            pedidosReais,
            ticketMedio:          ticketMedio.toFixed(2),
            faturamentoTendencia,
            ticketTendencia
        });

    } catch (e) {
        console.error('❌ Erro no /resumo:', e);
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