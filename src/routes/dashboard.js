const express = require('express');
const router = express.Router();
const { Op, fn, col, literal } = require('sequelize');
const Venda = require('../models/Vendas');
const moment = require('moment');

router.get('/resumo', async (req, res) => {
    const { filtro } = req.query;
    const hoje = moment(); // ✅ dinâmico — não mais data fixa

    let dataInicio, dataFim, dataInicioAnt, dataFimAnt;

    if (filtro === 'last') {
        dataInicio    = hoje.clone().subtract(1, 'month').startOf('month').format('YYYY-MM-DD');
        dataFim       = hoje.clone().subtract(1, 'month').endOf('month').format('YYYY-MM-DD');
        dataInicioAnt = hoje.clone().subtract(2, 'months').startOf('month').format('YYYY-MM-DD');
        dataFimAnt    = hoje.clone().subtract(2, 'months').endOf('month').format('YYYY-MM-DD');
    } else if (filtro === 'year') {
        dataInicio    = hoje.clone().startOf('year').format('YYYY-MM-DD');
        dataFim       = hoje.clone().endOf('year').format('YYYY-MM-DD');
        dataInicioAnt = hoje.clone().subtract(1, 'year').startOf('year').format('YYYY-MM-DD');
        dataFimAnt    = hoje.clone().subtract(1, 'year').endOf('year').format('YYYY-MM-DD');
    } else { // current
        dataInicio    = hoje.clone().startOf('month').format('YYYY-MM-DD');
        dataFim       = hoje.clone().format('YYYY-MM-DD');
        dataInicioAnt = hoje.clone().subtract(1, 'month').startOf('month').format('YYYY-MM-DD');
        dataFimAnt    = hoje.clone().subtract(1, 'month').endOf('month').format('YYYY-MM-DD');
    }

    try {
        const [resultado, resultadoAnt] = await Promise.all([
            Venda.findOne({
                attributes: [
                    [fn('SUM', literal('quantidade * preco_venda')), 'faturamento'],
                    [fn('COUNT', col('id')), 'bipes']
                ],
                where: { data_venda: { [Op.between]: [dataInicio, dataFim] } },
                raw: true
            }),
            Venda.findOne({
                attributes: [
                    [fn('SUM', literal('quantidade * preco_venda')), 'faturamento'],
                    [fn('COUNT', col('id')), 'bipes']
                ],
                where: { data_venda: { [Op.between]: [dataInicioAnt, dataFimAnt] } },
                raw: true
            })
        ]);

        const faturamento    = parseFloat(resultado?.faturamento)    || 0;
        const bipes          = parseInt(resultado?.bipes)            || 0;
        const faturamentoAnt = parseFloat(resultadoAnt?.faturamento) || 0;
        const bipesAnt       = parseInt(resultadoAnt?.bipes)         || 0;

        const ticketMedio    = bipes     > 0 ? faturamento    / bipes    : 0;
        const ticketMedioAnt = bipesAnt  > 0 ? faturamentoAnt / bipesAnt : 0;

        const faturamentoTendencia = faturamentoAnt > 0
            ? ((faturamento - faturamentoAnt) / faturamentoAnt * 100).toFixed(1)
            : null;

        const ticketTendencia = ticketMedioAnt > 0
            ? ((ticketMedio - ticketMedioAnt) / ticketMedioAnt * 100).toFixed(1)
            : null;

        res.json({
            faturamento,
            bipes,
            pedidosReais: bipes,
            ticketMedio:          ticketMedio.toFixed(2),
            faturamentoTendencia,
            ticketTendencia
        });

    } catch (e) {
        console.error('❌ Erro no /resumo:', e);
        res.status(500).json({ erro: e.message });
    }
});

// -------------------------------------------------------
//   GET /api/dashboard/skus-ativos
//   Total SKUs + % sem saída nos últimos 30 dias
//   Migrado de atualizarKpiSkusAtivos() no front-end
// -------------------------------------------------------
router.get('/skus-ativos', async (req, res) => {
    try {
        const hoje            = moment();
        const trintaDiasAtras = hoje.clone().subtract(30, 'days').format('YYYY-MM-DD');
        const hojeStr         = hoje.clone().format('YYYY-MM-DD');

        const [totalSkus, skusComSaida] = await Promise.all([
            // Total de SKUs ativos cadastrados
            Product.count({ where: { status: 'ativo' } }),

            // SKUs únicos que tiveram venda nos últimos 30 dias
            Venda.count({
                distinct: true,
                col: 'item_id',
                where: { data_venda: { [Op.between]: [trintaDiasAtras, hojeStr] } }
            })
        ]);

        const semSaida            = totalSkus - skusComSaida;
        const porcentagemSemSaida = totalSkus > 0
            ? ((semSaida / totalSkus) * 100).toFixed(1)
            : '0.0';

        res.json({
            totalSkus,
            skusComSaida,
            semSaida,
            porcentagemSemSaida
        });

    } catch (e) {
        console.error('❌ Erro em /skus-ativos:', e);
        res.status(500).json({ erro: e.message });
    }
});


// -------------------------------------------------------
//   GET /api/dashboard/grafico-diario
// -------------------------------------------------------
router.get('/grafico-diario', async (req, res) => {
    const { filtro } = req.query;
    const hoje = moment();

    const dataInicio = filtro === 'last'
        ? hoje.clone().subtract(1, 'month').startOf('month').format('YYYY-MM-DD')
        : hoje.clone().startOf('month').format('YYYY-MM-DD');

    const dataFim = filtro === 'last'
        ? hoje.clone().subtract(1, 'month').endOf('month').format('YYYY-MM-DD')
        : hoje.clone().endOf('month').format('YYYY-MM-DD');

    try {
        const vendasDia = await Venda.findAll({
            attributes: [
                [fn('DAY', col('data_venda')), 'dia'],
                [fn('SUM', literal('quantidade * preco_venda')), 'total']
            ],
            where: { data_venda: { [Op.between]: [dataInicio, dataFim] } },
            group: [fn('DAY', col('data_venda'))],
            raw: true
        });

        const obj = {};
        vendasDia.forEach(v => obj[v.dia] = parseFloat(v.total));
        res.json(obj);
    } catch (e) {
        res.status(500).json({ erro: e.message });
    }
});



// -------------------------------------------------------
//   GET /api/dashboard/grafico-anual
// -------------------------------------------------------
router.get('/grafico-anual', async (req, res) => {
    try {
        const anoAtual = moment().year();
        const vendasMes = await Venda.findAll({
            attributes: [
                [fn('MONTH', col('data_venda')), 'mes'],
                [fn('SUM', literal('quantidade * preco_venda')), 'total']
            ],
            where: { data_venda: { [Op.gte]: `${anoAtual}-01-01` } },
            group: [fn('MONTH', col('data_venda'))],
            raw: true
        });

        const obj = {};
        vendasMes.forEach(v => obj[v.mes] = parseFloat(v.total));
        res.json(obj);
    } catch (e) {
        res.status(500).json({ erro: e.message });
    }
});



module.exports = router;