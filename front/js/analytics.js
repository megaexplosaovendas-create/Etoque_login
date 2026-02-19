// --- VARIÁVEIS GLOBAIS ---
let trendChart, distributionChart, chartLogistica;
let localInventory = [];
let localHistory = {};
let localLogs = [];
const META_DIARIA = 500;

// --- INICIALIZAÇÃO E ESCUTAS ---

// Escuta Estoque e Histórico (Firebase)
db.ref('estoque_v20').on('value', (snapshot) => {
    const data = snapshot.val();
    localInventory = (data && data.produtos) ? data.produtos : [];
    localHistory = (data && data.historico) ? data.historico : {}; -
        refreshActiveSection();
});

// Escuta Bipagem (Logs)
db.ref('log_bipagem').orderByChild('data_hora').limitToLast(100).on('value', (snapshot) => {
    localLogs = [];
    snapshot.forEach(child => { localLogs.unshift(child.val()); });

    refreshActiveSection();
});

var vendasHistorico = [];
window.vendasHistorico = vendasHistorico;

// --- 2. FUNÇÃO DE BUSCA (MYSQL) ---
async function carregarHistoricoVendas() {
    try {
        console.log("1. Buscando dados no servidor...");
        const response = await fetch(`/api/vendas?t=${Date.now()}`);
        const dados = await response.json();

        if (Array.isArray(dados) && dados.length > 0) {
            window.vendasHistorico = dados;
            localStorage.setItem('vendasHistorico', JSON.stringify(dados));
            console.log("2. Dados salvos! Total:", window.vendasHistorico.length);

            // AGORA SIM chamamos o ranking
            await renderizarTop10();
        } else {
            console.warn("O servidor não retornou nenhuma venda.");
        }
    } catch (erro) {
        console.error("Erro na comunicação com o servidor:", erro);
    }
}

// Assim que a página de análise carregar, ele tenta desenhar o Top 10
window.addEventListener('load', () => {
    setTimeout(renderizarTop10, 300); // Um pequeno delay para garantir que os dados do Firebase/Local chegaram
});



// --- NAVEGAÇÃO ---

function showSection(sectionId) {
    // Alterna visibilidade das seções
    document.querySelectorAll('.analytics-section').forEach(s => s.classList.remove('active'));
    document.getElementById(sectionId).classList.add('active');

    // Atualiza os dados da seção aberta
    refreshActiveSection();
}

function refreshActiveSection() {
    const activeSection = document.querySelector('.analytics-section.active').id;
    const selDate = document.getElementById('reportDate').value || getToday();

    if (activeSection === 'executivo') {
        atualizarDashboardExecutivo();
    } else if (activeSection === 'logistica') {
        updateSecaoLogistica();
    } else if (activeSection === 'performance') {
        if (activeSection === 'performance') {
            renderizarTop10();
        }
    }

}

// --- LÓGICA DASHBOARD EXECUTIVO ---

function atualizarDashboardExecutivo() {
    if (!localInventory || !localHistory) return;
    const hoje = getToday();

    // KPIs Estratégicos
    const itensEmRisco = localInventory.filter(p => {
        const qtd = Number(p.qty !== undefined ? p.qty : p.estoque_atual);
        return qtd > 0 && qtd < 5;
    }).length;

    const trintaDiasAtras = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const itensInativos = localInventory.filter(p => {
        const log = localLogs.find(l => l.codigo_lido === p.sku);
        return !log || new Date(log.data_hora).getTime() < trintaDiasAtras;
    }).length;

    const bipesHoje = localLogs.filter(l => l.data_hora.startsWith(hoje)).length;

    const totalSaidasHoje = (localHistory[hoje] && localHistory[hoje].total) || 0;
    const estoqueTotal = localInventory.reduce((acc, p) => acc + Number(p.qty || p.estoque_atual || 0), 0);
    const giro = estoqueTotal > 0 ? ((totalSaidasHoje / estoqueTotal) * 100).toFixed(2) : "0.00";

    // Update UI
    document.getElementById('dashGiro').innerText = giro + "%";
    document.getElementById('dashRuptura').innerText = itensEmRisco;
    document.getElementById('dashBipesHoje').innerText = bipesHoje;
    document.getElementById('dashInativos').innerText = itensInativos;

    updateTrendChart(localHistory);
}

// --- LÓGICA LOGÍSTICA / EXPEDIÇÃO ---

function updateSecaoLogistica() {
    const hoje = getToday();
    const logsHoje = localLogs.filter(l => l.data_hora.startsWith(hoje));

    const total = logsHoje.length;
    const ok = logsHoje.filter(l => l.status === 'ok').length;
    const taxa = total > 0 ? ((ok / total) * 100).toFixed(1) : 100;

    // UI Bipes
    document.getElementById('totalBipesHoje').innerText = total;
    document.getElementById('totalOkHoje').innerText = ok;
    document.getElementById('taxaAssertividade').innerText = taxa + "%";

    // Alerta Visual de Assertividade
    const cardAssert = document.getElementById('cardAssertividade');
    const txtStatus = document.getElementById('txtErroStatus');
    if (taxa < 95) {
        cardAssert.style.borderLeft = "5px solid #ef4444";
        txtStatus.innerText = "Atenção: Alta taxa de erro";
        txtStatus.style.color = "#ef4444";
    } else {
        cardAssert.style.borderLeft = "5px solid #10b981";
        txtStatus.innerText = "Operação saudável";
        txtStatus.style.color = "#64748b";
    }

    // Progresso Meta
    const progresso = Math.min((total / META_DIARIA) * 100, 100).toFixed(1);
    document.getElementById('metaProgresso').innerText = progresso + "%";
    document.getElementById('barraMeta').style.width = progresso + "%";

    // Ritmo
    document.getElementById('ritmoBipagem').innerText = calcularRitmo(logsHoje);

    renderizarGraficoBarras(logsHoje);
    renderizarTabelaLogs(logsHoje);
}

// --- GRÁFICOS E TABELAS OPERACIONAIS ---
function renderizarGraficoChartJS(historico30Dias) {
    const ctx = document.getElementById('graficoVendas').getContext('2d');

    // 1. GERAR LABELS DE DATAS REAIS (O fim do "Dia 30")
    const labelsDatas = [];
    for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        labelsDatas.push(d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
    }

    // 2. LIMPAR GRÁFICO ANTERIOR (Evita sobreposição)
    if (window.meuGrafico) {
        window.meuGrafico.destroy();
    }

    // 3. CRIAR O NOVO GRÁFICO
    window.meuGrafico = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labelsDatas,
            datasets: [{
                label: 'Unidades Vendidas',
                data: historico30Dias,
                backgroundColor: '#3498db',
                borderRadius: 5,
                hoverBackgroundColor: '#2980b9'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#2c3e50',
                    titleFont: { size: 14 },
                    callbacks: {
                        label: (context) => ` Vendas: ${context.raw} unidades`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1, color: '#999' },
                    grid: { color: '#eee' }
                },
                x: {
                    ticks: { color: '#999', font: { size: 10 } },
                    grid: { display: false }
                }
            }
        }
    });
}

function renderizarTabelaLogs(logs) {
    const tbody = document.getElementById('logTbody');
    tbody.innerHTML = logs.slice(0, 15).map(l => {
        const hora = new Date(l.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const cor = l.status === 'ok' ? '#10b981' : '#ef4444';
        return `<tr><td>${hora}</td><td>${l.codigo_lido}</td><td style="color:${cor}; font-weight:bold;">${l.status.toUpperCase()}</td></tr>`;
    }).join('');
}

// --- FUNÇÕES UTILITÁRIAS ---

function getToday() {
    return new Date().toISOString().split('T')[0];
}

function calcularRitmo(logs) {
    if (logs.length < 2) return logs.length;
    const horas = logs.map(l => new Date(l.data_hora).getHours());
    const intervalo = (Math.max(...horas) - Math.min(...horas)) || 1;
    return (logs.length / intervalo).toFixed(1);
}

// Gráfico de Tendência (Dashboard)
function updateTrendChart(history) {
    const labels = []; const values = [];
    for (let i = 14; i >= 0; i--) {
        let d = new Date(); d.setDate(d.getDate() - i);
        let iso = d.toISOString().split('T')[0];
        labels.push(iso.slice(8, 10) + "/" + iso.slice(5, 7));
        values.push((history && history[iso]) ? (history[iso].total || 0) : 0);
    }
    const ctx = document.getElementById('trendChart').getContext('2d');
    if (trendChart) trendChart.destroy();
    trendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{ label: 'Vendas', data: values, borderColor: '#0f766e', tension: 0.4, fill: true, backgroundColor: 'rgba(15, 118, 110, 0.1)' }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}


function desenharGrafico(historico30Dias) {
    const container = document.getElementById('containerBarras');
    if (!container) {
        console.error("Erro: containerBarras não encontrado no HTML!");
        return;
    }

    // 1. LIMPEZA: Remove o gráfico anterior
    container.innerHTML = "";

    // 2. ESCALA: Descobre qual o maior valor para as barras não sumirem
    const maxVendas = Math.max(...historico30Dias, 1);

    // 3. LOOP: Cria as 30 colunas (da mais antiga para a de hoje)
    for (let i = 29; i >= 0; i--) {
        const qtd = historico30Dias[29 - i] || 0;

        // --- CÁLCULO DA DATA ---
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dia = String(d.getDate()).padStart(2, '0');
        const mes = String(d.getMonth() + 1).padStart(2, '0');
        const dataFormatada = `${dia}/${mes}`;

        // --- ESTRUTURA DA COLUNA ---
        const coluna = document.createElement('div');
        coluna.style.display = "flex";
        coluna.style.flexDirection = "column";
        coluna.style.alignItems = "center";
        coluna.style.flex = "1";
        coluna.style.height = "100%";
        coluna.style.justifyContent = "flex-end";

        // --- A BARRA ---
        const barra = document.createElement('div');
        const alturaPercent = (qtd / maxVendas) * 100;

        barra.style.width = "80%";
        barra.style.height = `${alturaPercent}%`;
        barra.style.backgroundColor = qtd > 0 ? "#3498db" : "#f1f1f1";
        barra.style.borderRadius = "2px 2px 0 0";
        barra.style.transition = "height 0.3s ease"; // Efeito visual de subida

        // Texto ao passar o mouse (Tooltip)
        barra.title = `${dataFormatada}: ${qtd} vendas`;

        // --- A DATA (LEGENDA) ---
        const legenda = document.createElement('span');
        legenda.style.fontSize = "8px";
        legenda.style.marginTop = "5px";
        legenda.style.color = "#999";
        legenda.style.fontWeight = "bold";

        // Exibe a data de 3 em 3 dias para não embolar, mas sempre mostra HOJE
        if (i % 3 === 0 || i === 0) {
            legenda.innerText = dataFormatada;
        }

        coluna.appendChild(barra);
        coluna.appendChild(legenda);
        container.appendChild(coluna);
    }
}


// --- FUNÇÃO 1: BUSCA OS DADOS ---

// ======================================================
// 1. FUNÇÃO MESTRA: ANALISAR PRODUTO (Híbrida)
// ======================================================
async function analisarProduto() {
    const sku = document.getElementById('skuSearchInput').value.trim();
    if (!sku) return alert("Digite um SKU!");

    try {
        console.log("📡 Buscando dados para:", sku);
        const response = await fetch(`/api/analytics/sku/${encodeURIComponent(sku)}`);

        if (!response.ok) throw new Error(`Erro do Servidor: ${response.status}`);

        const data = await response.json();
        if (data.error) alert("Aviso: " + data.error);

        // SALVA DADOS PARA O SIMULADOR
        window.dadosProdutoOriginal = data;

        // --- 1. LIGAR A VISIBILIDADE ---
        safeDisplay('skuResultGrid', 'grid');
        safeDisplay('detalhesAvancadosSKU', 'block');
        safeDisplay('financeiroGrid', 'grid');
        safeDisplay('estrategaGrid', 'grid');
        safeDisplay('valorGrid', 'grid'); // <--- NOVO GRID LIGADO AQUI
        safeDisplay('cardGraficoPicos', 'block');

        // --- 2. PREENCHER DADOS BÁSICOS ---
        setTexIfExist('skuVendaHoje', data.vendasHoje || 0);
        setTexIfExist('skuVendaSemana', data.vendasSemana || 0);
        setTexIfExist('skuVendaMes', data.vendasMes || 0);
        setTexIfExist('resFornecedor', data.fornecedor || "Não informado");
        setTexIfExist('resDataChegada', data.dataChegada || "--/--/--");
        setTexIfExist('resRanking', data.ranking || "-");

        // --- 3. CÁLCULOS FINANCEIROS ---
        const vMes = parseFloat(data.vendasMes) || 0;
        const precoVenda = parseFloat(data.precoMedio) || 0;
        const precoCusto = parseFloat(data.precoCusto) || 0;
        const ads = parseFloat(data.investimentoAds) || 0;
        const views = parseInt(data.visualizacoes) || 0;

        const faturamento = data.faturamentoTotal || (vMes * precoVenda);
        const custoTotalProdutos = vMes * precoCusto;
        const taxaMarketplace = faturamento * 0.18;
        const lucroReal = faturamento - custoTotalProdutos - ads - taxaMarketplace;

        const roas = ads > 0 ? (faturamento / ads).toFixed(2) : "0.00";
        const investimentoTotal = custoTotalProdutos + ads;
        const roi = investimentoTotal > 0 ? ((lucroReal / investimentoTotal) * 100).toFixed(1) : 0;
        const conversao = views > 0 ? ((vMes / views) * 100).toFixed(2) : 0;
        const custoAdsUnitario = ads / (vMes || 1);
        const pontoEquilibrio = (precoCusto + custoAdsUnitario) / (1 - 0.18);

        // --- 4. APLICAR VALORES NA TELA ---
        setTexIfExist('skuLucroReal', lucroReal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
        setTexIfExist('skuInvestimentoAds', ads.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
        setTexIfExist('skuROAS', roas);
        setTexIfExist('skuROI', roi + "%");
        setTexIfExist('skuConversao', conversao + "%");
        setTexIfExist('skuPontoEquilibrio', pontoEquilibrio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));

        // --- PREENCHE O NOVO GRID (VALOR E FATURAMENTO) ---
        setTexIfExist('skuPrecoMedio', precoVenda.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
        setTexIfExist('skuFaturamento', faturamento.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));

        // O card de custo precisa ser tratado com carinho por causa do botão de editar
        const elCusto = document.getElementById('skuCustoCompra');
        if (elCusto) elCusto.innerText = precoCusto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });


        // --- 5. CANAIS ---
        if (data.canais) {
            setTexIfExist('vShopee', data.canais.shopee);
            setTexIfExist('vML', data.canais.ml);
            setTexIfExist('vTikTok', data.canais.tiktok);
        }

        // --- 6. GRÁFICO ---
        if (data.historico30Dias) {
            renderizarGraficoChartJS(data.historico30Dias);
            const maxVendas = Math.max(...data.historico30Dias);
            setTexIfExist('txtMelhorDia', `Pico: ${maxVendas} vendas`);
        }

    } catch (error) {
        console.error("❌ Erro:", error);
        alert("Erro ao processar dados. Verifique o console.");
    }
}

// ======================================================
// 2. FUNÇÃO DO GRÁFICO (Chart.js)
// ======================================================
function renderizarGraficoChartJS(historico) {
    const canvas = document.getElementById('graficoVendas');

    // Verificações de segurança
    if (!canvas) return console.warn("Canvas 'graficoVendas' não encontrado.");
    if (typeof Chart === 'undefined') return console.error("Biblioteca Chart.js não carregada.");

    const ctx = canvas.getContext('2d');

    // Destrói gráfico antigo para não sobrepor
    if (window.meuGrafico) window.meuGrafico.destroy();

    // Gera datas dinâmicas (Hoje - 29 dias)
    const labels = [];
    for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        labels.push(d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
    }

    // Cria o gráfico
    window.meuGrafico = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Vendas',
                data: historico,
                backgroundColor: '#3498db',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1 } },
                x: { grid: { display: false }, ticks: { font: { size: 10 } } }
            }
        }
    });
}

// ======================================================
// 3. FUNÇÕES AUXILIARES (Segurança)
// ======================================================

// Evita erro se o ID do texto não existir
function setTexIfExist(id, valor) {
    const el = document.getElementById(id);
    if (el) {
        el.innerText = valor;
    } else {
        // Opcional: console.log(`Aviso: ID '${id}' não encontrado para preencher.`);
    }
}

// Evita erro se o ID da div não existir
function safeDisplay(id, tipo) {
    const el = document.getElementById(id);
    if (el) {
        el.style.display = tipo;
    }
}


// --- FUNÇÃO 2: DESENHA O GRÁFICO (O que estava faltando!) ---
function renderizarGraficoChartJS(historico30Dias) {
    console.log("📊 Tentando iniciar o gráfico...");
    console.log("📦 Dados recebidos do servidor:", historico30Dias);

    const canvas = document.getElementById('graficoVendas');

    if (!canvas) {
        console.error("❌ ERRO: Não encontrei nenhum elemento com o ID 'graficoVendas' no HTML!");
        return;
    }

    if (typeof Chart === 'undefined') {
        console.error("❌ ERRO: A biblioteca Chart.js não foi carregada! Verifique o script no HTML.");
        return;
    }

    const ctx = canvas.getContext('2d');

    // Limpa o lixo anterior
    if (window.meuGraficoAnalytics) {
        console.log("🧹 Destruindo gráfico antigo...");
        window.meuGraficoAnalytics.destroy();
    }

    const labelsDatas = [];
    for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        labelsDatas.push(d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
    }

    try {
        window.meuGraficoAnalytics = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labelsDatas,
                datasets: [{
                    label: 'Vendas',
                    data: historico30Dias,
                    backgroundColor: '#3498db'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
        console.log("✅ SUCESSO: O gráfico deve estar visível agora!");
    } catch (err) {
        console.error("❌ ERRO CRÍTICO ao criar o Chart.js:", err);
    }
}


// Função para desenhar as barrinhas do gráfico
function renderizarBarrasHistorico(historico) {
    const container = document.getElementById('containerBarras');
    if (!container) return;

    // 1. Limpa o que tinha antes
    container.innerHTML = '';

    // 2. Garante que temos 30 dias (mesmo que vazios)
    const dados = (historico && historico.length > 0) ? historico : new Array(30).fill(0);

    // 3. Acha o maior valor para as barras serem proporcionais
    const maxVal = Math.max(...dados, 1);

    // 4. Cria cada barra
    dados.forEach((qtd, i) => {
        const alturaPercentual = (qtd / maxVal) * 100;
        const barra = document.createElement('div');

        // Estilo visual
        barra.style.flex = "1";
        barra.style.height = alturaPercentual > 0 ? `${alturaPercentual}%` : "4px";
        barra.style.backgroundColor = qtd > 0 ? "#3498db" : "#e0e0e0";
        barra.style.borderRadius = "2px 2px 0 0";
        barra.style.transition = "height 0.4s ease-in-out";
        barra.style.minWidth = "3px";

        barra.title = `Dia ${i + 1}: ${qtd} vendas`;
        container.appendChild(barra);
    });
}

// 1. Função para Identificar Produtos Zumbis (Inativos +30 dias)
function calcularInatividade() {
    const trintaDiasAtras = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const container = document.getElementById('inativosList');

    // Filtramos produtos que possuem estoque mas não aparecem nos bipes recentes
    const inativos = localInventory.filter(prod => {
        const qtd = Number(prod.qty || prod.estoque_atual || 0);
        if (qtd <= 0) return false; // Se não tem estoque, não é "zumbi"

        // Busca o último log desse SKU
        const ultimoLog = localLogs.find(l => l.codigo_lido === prod.sku);
        if (!ultimoLog) return true; // Nunca bipado mas tem estoque = Inativo

        return new Date(ultimoLog.data_hora).getTime() < trintaDiasAtras;
    });

    if (inativos.length === 0) {
        container.innerHTML = "<p style='text-align:center; padding:20px;'>✅ Nenhum item parado há mais de 30 dias.</p>";
        return;
    }

    container.innerHTML = inativos.map(p => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; border-bottom:1px solid #f0fdfa;">
            <div>
                <span style="font-weight:600; display:block; color:var(--text);">${p.name}</span>
                <small style="color:#64748b;">Estoque: ${p.qty || p.estoque_atual} un | SKU: ${p.sku}</small>
            </div>
            <span class="badge-inactive">ESTOQUE PARADO</span>
        </div>
    `).join('');
}



function calcularCurvaABC() {
    let vendasPorSKU = {};
    let totalGeral = 0;

    // 1. Soma todas as vendas do histórico (últimos 30 dias)
    Object.values(localHistory).forEach(dia => {
        if (dia.items) {
            Object.values(dia.items).forEach(item => {
                const sku = item.sku || item.name;
                vendasPorSKU[sku] = (vendasPorSKU[sku] || 0) + (item.qty || 0);
                totalGeral += (item.qty || 0);
            });
        }
    });

    // 2. Transforma em array e ordena do mais vendido para o menos vendido
    let ranking = Object.entries(vendasPorSKU)
        .sort((a, b) => b[1] - a[1]);

    // 3. Calcula a porcentagem acumulada e classifica
    let acumulado = 0;
    const abcResult = ranking.map(([sku, qtd]) => {
        acumulado += qtd;
        const perc = (acumulado / totalGeral) * 100;
        let classe = 'C';
        if (perc <= 80) classe = 'A';
        else if (perc <= 95) classe = 'B';

        return { sku, qtd, classe };
    });

    console.log("📊 Curva ABC Processada:", abcResult);
    return abcResult;
}


let ultimoLogCount = 0;

function monitorarNovasExpedicoes() {
    // Escuta apenas o último registro inserido no banco
    db.ref('log_bipagem').limitToLast(1).on('value', (snapshot) => {
        const logs = snapshot.val();
        if (!logs) return;

        // Pega a quantidade de itens no snapshot (geralmente 1 por causa do limit)
        const currentCount = Object.keys(logs).length;

        // Se o contador subiu, significa que um novo bipe entrou no sistema
        if (ultimoLogCount > 0 && currentCount >= ultimoLogCount) {
            console.log("⚡ Novo bipe detectado na expedição!");

            // Aqui você dispara a atualização visual
            if (typeof updateSecaoLogistica === "function") {
                updateSecaoLogistica();
            }

            // Dica: Você pode adicionar um som de "beep" aqui para o supervisor ouvir
        }
        ultimoLogCount = currentCount;
    });
}


// 1. DISPARAR BUSCA ASSIM QUE A PÁGINA CARREGAR
document.addEventListener('DOMContentLoaded', () => {
    carregarHistoricoVendas();
});

// 2. REVISAR O REFRESH ACTIVE (Para não dar erro se o MySQL atrasar)
function refreshActiveSection() {
    // ... seu código que detecta a seção ativa ...

    const activeSection = document.querySelector('.section.active')?.id;

    if (activeSection === 'performance') {
        // Se os dados do MySQL já chegaram, renderiza. 
        // Se não chegaram, o próprio carregarHistoricoVendas chamará quando terminar.
        if (vendasHistorico.length > 0) {
            renderizarTop10();
        }
    }

    // Atualiza outros gráficos do dashboard (Firebase)
    atualizarDashboardExecutivo();
}



// ... suas outras funções (renderizarTop10, etc)

/**
 * Renderiza o Ranking Top 10 de Produtos
 * Busca dados DIRETAMENTE do MySQL via /api/vendas
 */
async function renderizarTop10() {
    const listaUl = document.getElementById('topProductsList');
    const seletor = document.getElementById('periodoTop10');
    if (!listaUl || !seletor) return;

    // 1. LIMPEZA E PREPARAÇÃO
    listaUl.innerHTML = '<li style="padding:30px; text-align:center; color:#94a3b8;">Carregando...</li>';
    const periodo = seletor.value;

    try {
        // 2. BUSCA OS DADOS DO BANCO (VIA API)
        console.log("🔍 Buscando vendas do banco de dados...");
        const response = await fetch(`/api/vendas?t=${Date.now()}`);

        if (!response.ok) {
            throw new Error(`Erro na requisição: ${response.status}`);
        }

        const dados = await response.json();
        console.log(`✅ Recebidas ${dados.length} vendas do banco`);

        if (!Array.isArray(dados) || dados.length === 0) {
            listaUl.innerHTML = `<li style="padding:30px; text-align:center; color:#94a3b8; font-size:0.9em;">
                Nenhum dado de venda encontrado.<br><small>Importe vendas para ver o ranking.</small>
            </li>`;
            return;
        }

        // 3. SALVA NA MEMÓRIA GLOBAL (para outras funções)
        window.vendasHistorico = dados;
        localStorage.setItem('vendasHistorico', JSON.stringify(dados));

        const somaVendas = {};
        const agora = new Date();
        agora.setHours(23, 59, 59, 999);

        // 4. PROCESSAMENTO E SOMA ACUMULATIVA
        dados.forEach((venda) => {
            // Validação básica
            if (!venda.item_id || !venda.data_venda) {
                console.warn("⚠️ Venda incompleta:", venda);
                return;
            }

            // Normalização: Remove espaços e coloca em caixa alta para não duplicar
            const id = String(venda.item_id).trim().toUpperCase();
            const qtd = Number(venda.quantidade) || 0;

            if (qtd === 0) return; // Ignora vendas com quantidade 0

            // Tratamento de Data (Sequelize retorna como YYYY-MM-DD)
            let dtVenda;
            try {
                const dataStr = String(venda.data_venda).trim();

                // Se vier como YYYY-MM-DD (padrão Sequelize)
                if (dataStr.includes('-') && !dataStr.includes('/')) {
                    dtVenda = new Date(dataStr + "T12:00:00Z");
                }
                // Se vier como DD/MM/YYYY
                else if (dataStr.includes('/')) {
                    const [d, m, y] = dataStr.split(' ')[0].split('/');
                    dtVenda = new Date(y, m - 1, d, 12, 0, 0);
                } else {
                    dtVenda = new Date(dataStr.split('T')[0] + "T12:00:00Z");
                }

                // Validação de data
                if (isNaN(dtVenda.getTime())) {
                    console.warn("⚠️ Data inválida:", venda.data_venda);
                    return;
                }
            } catch (e) {
                console.error("❌ Erro ao processar data:", venda.data_venda, e);
                return;
            }

            // Lógica de Filtro por Período
            let incluir = false;
            if (periodo === 'mes') {
                incluir = true; // Exibe tudo
            } else if (periodo === 'hoje') {
                const hoje = new Date();
                hoje.setHours(0, 0, 0, 0);
                const vendaDate = new Date(dtVenda);
                vendaDate.setHours(0, 0, 0, 0);
                incluir = vendaDate.getTime() === hoje.getTime();
            } else if (periodo === 'semana') {
                const limite = new Date();
                limite.setDate(agora.getDate() - 7);
                limite.setHours(0, 0, 0, 0);
                incluir = (dtVenda >= limite);
            }

            // Acumula a quantidade se passou no filtro
            if (incluir) {
                somaVendas[id] = (somaVendas[id] || 0) + qtd;
            }
        });

        // 5. CRIAÇÃO DO RANKING (ORDENAÇÃO)
        const ranking = Object.entries(somaVendas)
            .map(([id, total]) => ({ id, total }))
            .sort((a, b) => b.total - a.total) // Do maior para o menor
            .slice(0, 10);

        console.log(`📊 Top 10 processado (${ranking.length} produtos):`, ranking);

        if (ranking.length === 0) {
            listaUl.innerHTML = `<li style="padding:30px; text-align:center; color:orange;">Sem vendas detectadas para este período.</li>`;
            return;
        }

        // 6. LIMPEZA ANTES DE RENDERIZAR
        listaUl.innerHTML = '';

        // 7. RENDERIZAÇÃO VISUAL
        ranking.forEach((item, index) => {
            const li = document.createElement('li');
            const corPosicao = index < 3 ? 'var(--primary, #3b82f6)' : '#94a3b8';
            const medalha = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}º`;

            // Estilo da linha
            li.style = `
                display: flex; 
                justify-content: space-between; 
                padding: 12px 10px; 
                border-bottom: 1px solid #f1f5f9; 
                align-items: center; 
                cursor: pointer;
                transition: background 0.2s;
            `;

            // Efeito de Hover e Clique
            li.onmouseover = () => li.style.backgroundColor = "#f8fafc";
            li.onmouseout = () => li.style.backgroundColor = "transparent";

            li.onclick = () => {
                const inputBusca = document.getElementById('skuSearchInput');
                if (inputBusca) {
                    inputBusca.value = item.id;
                    // Dispara a análise individual automaticamente
                    if (typeof analisarProduto === 'function') analisarProduto();
                    window.scrollTo({ top: inputBusca.offsetTop - 100, behavior: 'smooth' });
                }
            };

            li.innerHTML = `
                <div style="display: flex; align-items: center; gap: 12px; overflow: hidden;">
                    <span style="font-weight: 800; color: ${corPosicao}; width: 25px; text-align: center;">${medalha}</span>
                    <span style="font-size: 0.9em; color: #334155; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px;" title="${item.id}">
                        ${item.id}
                    </span>
                </div>
                <div style="text-align: right;">
                    <b style="color: #1e293b; font-size: 1em;">${item.total}</b>
                    <small style="color: #94a3b8; font-size: 0.75em; display: block;">unidades</small>
                </div>
            `;
            listaUl.appendChild(li);
        });

        console.log("✅ Top 10 renderizado com sucesso!");

    } catch (erro) {
        console.error("❌ Erro ao renderizar Top 10:", erro);
        listaUl.innerHTML = `<li style="padding:30px; text-align:center; color:#ef4444; font-size:0.9em;">
            ⚠️ Erro ao carregar dados<br>
            <small>${erro.message}</small>
        </li>`;
    }
}

// Torna a função global para o onchange do HTML
window.renderizarTop10 = renderizarTop10;

// Inicializa o ranking automaticamente ao carregar a página
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (typeof renderizarTop10 === 'function') {
            renderizarTop10();
        }
    }, 500);
});


// A função de busca atualizada com Modo Silencioso:
window.sincronizarDados = async function (silencioso = false) {
    try {
        // Se não for silencioso, avisa que começou a busca
        if (!silencioso) console.log("🔍 Buscando vendas atualizadas...");

        const res = await fetch('/api/vendas');
        const dadosNovos = await res.json();

        if (dadosNovos && Array.isArray(dadosNovos)) {
            window.vendasHistorico = dadosNovos;

            // AQUI ESTÁ O SEGREDO: Só loga o total do banco se NÃO for silencioso
            if (!silencioso) {
                console.log("✅ Total acumulado no banco:", window.vendasHistorico.length);
            }

            // O Top 10 e os gráficos atualizam sempre, mas "em silêncio" no console
            if (typeof renderizarTop10 === 'function') renderizarTop10();
            if (typeof atualizarGraficos === 'function') atualizarGraficos();
        }
    } catch (err) {
        console.error("❌ Erro ao sincronizar:", err);
    }
};

async function buscarSugestoes(termo) {
    console.log("➡️ Digitação detectada:", termo);

    // Só busca se tiver 2 ou mais letras
    if (!termo || termo.length < 2) {
        const datalist = document.getElementById('skuSuggestions');
        if (datalist) datalist.innerHTML = '';
        return;
    }

    try {
        const response = await fetch(`/api/products/search?q=${encodeURIComponent(termo)}`);

        console.log("📡 Resposta do Servidor (Status):", response.status);
        const dados = await response.json();

        // Se o banco retornou erro (por causa de nomes de colunas, etc)
        if (dados.error) {
            console.error("❌ Erro no Banco:", dados.message);
            return;
        }

        const datalist = document.getElementById('skuSuggestions');
        if (!datalist) {
            console.error("❌ Erro: Elemento <datalist id='skuSuggestions'> não encontrado!");
            return;
        }

        datalist.innerHTML = ''; // Limpa as opções antigas

        // Percorre os produtos retornados do banco
        dados.forEach(prod => {
            const option = document.createElement('option');
            // Usando seus nomes de coluna reais: item_id e nome_produto
            option.value = prod.item_id;
            option.label = prod.nome_produto;
            datalist.appendChild(option);
        });

        console.log("✅ Datalist atualizado com", dados.length, "opções.");

    } catch (error) {
        console.error("❌ Erro na comunicação:", error);
    }
}


function renderizarBarrasHistorico(historico) {
    const container = document.getElementById('containerBarras');
    if (!container) {
        console.error("Container do gráfico não encontrado!");
        return;
    }

    // Limpa o gráfico anterior
    container.innerHTML = '';

    // Se não vier histórico (vazio), cria 30 dias de "vendas zero"
    const dados = (historico && historico.length > 0) ? historico : new Array(30).fill(0);

    // Descobre o maior valor para as barras serem proporcionais
    const maxVal = Math.max(...dados, 1);

    dados.forEach((qtd, i) => {
        const alturaPercentual = (qtd / maxVal) * 100;

        const barra = document.createElement('div');

        // Estilo da barra (Azul se vendeu, Cinza se 0)
        barra.style.flex = "1";
        barra.style.height = alturaPercentual > 0 ? `${alturaPercentual}%` : "3px";
        barra.style.backgroundColor = qtd > 0 ? "#3498db" : "#e0e0e0";
        barra.style.borderRadius = "2px 2px 0 0";
        barra.style.transition = "height 0.4s ease";
        barra.style.minWidth = "4px";

        // Tooltip (balãozinho ao passar o mouse)
        barra.title = `Dia ${i + 1}: ${qtd} vendas`;

        container.appendChild(barra);
    });

    // Atualiza o texto do Melhor Dia
    const pico = Math.max(...dados);
    const txtMelhor = document.getElementById('txtMelhorDia');
    if (txtMelhor) txtMelhor.innerText = `Melhor dia: ${pico} vendas`;
}



// --- NO FRONTEND (analytics.js ou similar) ---
function atualizarGrafico(dadosDoBackend) {
    // Criar as datas dinamicamente (05/02, 04/02...)
    const labelsReais = [];
    for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        labelsReais.push(d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
    }

    const ctx = document.getElementById('meuGrafico').getContext('2d');

    // IMPORTANTE: Destruir o gráfico velho para ele não "guardar" as labels antigas
    if (window.instanciaGrafico) {
        window.instanciaGrafico.destroy();
    }

    window.instanciaGrafico = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labelsReais, // <--- Aqui as datas corretas (05/02)
            datasets: [{
                label: 'Vendas',
                data: dadosDoBackend, // O array hist30 que vem do servidor
                backgroundColor: '#3498db'
            }]
        },
        options: {
            plugins: {
                tooltip: {
                    callbacks: {
                        // Isso garante que ao passar o mouse, ele mostre a data e o valor
                        title: (items) => `Data: ${items[0].label}`
                    }
                }
            }
        }
    });
}

// ======================================================
// 🎮 MÓDULO DE SIMULAÇÃO (Custos e Ads)
// ======================================================

// --- 1. MODAL DE CUSTOS (Lápis Azul) ---
function abrirModalCustos() {
    const modal = document.getElementById('modalCustosWrapper');
    if (!modal) return;
    modal.style.display = 'flex';

    // Pega o valor da tela
    const txt = document.getElementById('skuCustoCompra').innerText;
    const val = parseFloat(txt.replace(/[^0-9,-]+/g, "").replace(",", "."));

    document.getElementById('inputFornecedor').value = val || 0;
    document.getElementById('inputEmbalagem').value = 0;
    document.getElementById('inputImposto').value = 0;

    calcularTotalModal();
}

function fecharModalCustos() {
    document.getElementById('modalCustosWrapper').style.display = 'none';
}

function calcularTotalModal() {
    const f = parseFloat(document.getElementById('inputFornecedor').value) || 0;
    const e = parseFloat(document.getElementById('inputEmbalagem').value) || 0;
    const i = parseFloat(document.getElementById('inputImposto').value) || 0;
    const total = f + e + i;
    document.getElementById('previewCustoTotal').innerText = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function salvarNovosCustos() {
    const f = parseFloat(document.getElementById('inputFornecedor').value) || 0;
    const e = parseFloat(document.getElementById('inputEmbalagem').value) || 0;
    const i = parseFloat(document.getElementById('inputImposto').value) || 0;
    const novoCusto = f + e + i;

    // Atualiza Tela
    document.getElementById('skuCustoCompra').innerText = novoCusto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    document.getElementById('avisoSimulacao').style.display = 'inline';

    fecharModalCustos();
    recalcularGeral(); // Chama o recálculo
}

// --- 2. MODAL DE ADS (Lápis Laranja) ---
function abrirModalAds() {
    const modal = document.getElementById('modalAdsWrapper');
    if (!modal) return;
    modal.style.display = 'flex';

    const txt = document.getElementById('skuInvestimentoAds').innerText;
    const val = parseFloat(txt.replace(/[^0-9,-]+/g, "").replace(",", "."));
    document.getElementById('inputAdsManual').value = val || 0;
}

function salvarAdsManual() {
    const novoAds = parseFloat(document.getElementById('inputAdsManual').value) || 0;

    document.getElementById('skuInvestimentoAds').innerText = novoAds.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    if (document.getElementById('avisoAdsSimulado')) {
        document.getElementById('avisoAdsSimulado').style.display = 'block';
    }
    document.getElementById('modalAdsWrapper').style.display = 'none';

    recalcularGeral(); // Chama o recálculo
}

// --- 3. FUNÇÃO MESTRA (O CÉREBRO) ---
function recalcularGeral() {
    const dados = window.dadosProdutoOriginal;
    if (!dados) {
        console.warn("Dados originais não encontrados.");
        return;
    }

    const qtdVendas = parseFloat(dados.vendasMes) || 0;

    // LER VALORES DA TELA
    // Preço (Fixo, mas precisamos ler ele para a conta)
    const precoTxt = document.getElementById('skuPrecoMedio').innerText;
    const preco = parseFloat(precoTxt.replace(/[^0-9,-]+/g, "").replace(",", "."));

    // Custo (Pode ter sido editado)
    const custoTxt = document.getElementById('skuCustoCompra').innerText;
    const custoUnitario = parseFloat(custoTxt.replace(/[^0-9,-]+/g, "").replace(",", "."));

    // Ads (Pode ter sido editado)
    const adsTxt = document.getElementById('skuInvestimentoAds').innerText;
    const adsTotal = parseFloat(adsTxt.replace(/[^0-9,-]+/g, "").replace(",", "."));

    // CÁLCULOS
    const faturamento = qtdVendas * preco; // Faturamento se mantém (já que preço não muda)
    const novoCustoTotalProdutos = qtdVendas * custoUnitario;
    const taxaMarketplace = faturamento * 0.18;

    const lucroReal = faturamento - novoCustoTotalProdutos - adsTotal - taxaMarketplace;
    const investimentoTotal = novoCustoTotalProdutos + adsTotal;

    const roi = investimentoTotal > 0 ? ((lucroReal / investimentoTotal) * 100).toFixed(1) : 0;

    // Ponto de Equilíbrio
    const custoAdsUnitario = adsTotal / (qtdVendas || 1);
    const pontoEquilibrio = (custoUnitario + custoAdsUnitario) / (1 - 0.18);

    // ATUALIZAR TELA
    // O faturamento não precisa atualizar aqui pois o preço não mudou, mas o Custo Total sim
    setTexIfExist('skuCustoTotalProdutos', novoCustoTotalProdutos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));

    setTexIfExist('skuLucroReal', lucroReal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
    setTexIfExist('skuROI', roi + "%");
    setTexIfExist('skuPontoEquilibrio', pontoEquilibrio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));

    // Cor do Lucro
    const elLucro = document.getElementById('skuLucroReal');
    if (elLucro) elLucro.style.color = lucroReal >= 0 ? '#1b5e20' : '#d32f2f';
}

function filtrarCanal(canal) {
    const dados = window.dadosProdutoOriginal;
    if (!dados || !dados.historico30Dias) return;

    // 1. Estilo Visual: Remove classe 'ativo' de todos e coloca no clicado
    document.querySelectorAll('.item-canal').forEach(el => el.classList.remove('ativo'));
    document.getElementById(`btn-${canal}`).classList.add('ativo');

    let historicoFiltrado = [];
    let fatorProporcao = 1;

    // 2. Lógica de Simulação (Enquanto a API não chega)
    // Vamos calcular qual a porcentagem desse canal no total de vendas
    const totalVendas = (dados.canais.shopee + dados.canais.ml + dados.canais.tiktok) || 1;

    if (canal === 'geral') {
        historicoFiltrado = dados.historico30Dias;
    } else {
        // Pega a proporção real (ex: se vendeu 50 na shopee de 100 total, fator = 0.5)
        const vendasCanal = dados.canais[canal] || 0;
        fatorProporcao = vendasCanal / totalVendas;

        // Cria um novo gráfico multiplicando cada dia pelo fator do canal
        historicoFiltrado = dados.historico30Dias.map(valor => Math.round(valor * fatorProporcao));
    }

    // 3. Atualiza o Gráfico com os novos dados
    console.log(`🔎 Filtrando por: ${canal} (Proporção: ${(fatorProporcao * 100).toFixed(0)}%)`);
    renderizarGraficoChartJS(historicoFiltrado);

    // 4. (Opcional) Atualiza o faturamento na tela para o valor do canal
    const preco = parseFloat(document.getElementById('inputPrecoDireto').value) || 0;
    const vendasNoCanal = canal === 'geral' ? dados.vendasMes : dados.canais[canal];
    const faturamentoCanal = vendasNoCanal * preco;

    setTexIfExist('skuFaturamento', faturamentoCanal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
}

