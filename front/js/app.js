/**
 * 📦 ARQUIVO: front/js/app.js
 * Integrado com as rotas: /add, /edit/:item_id, /delete/:item_id
 */


// --- TOPO DO ARQUIVO APP.JS ---


// --- SISTEMA DE LOG EM TEMPO REAL PARA UPLOAD ---
(function () {
    const logDiv = document.getElementById('log');
    if (!logDiv) return;

    const originalLog = console.log;

    console.log = function (...args) {
        originalLog.apply(console, args);

        const message = args.map(arg => typeof arg === 'object' ? (Array.isArray(arg) ? `Array(${arg.length})` : JSON.stringify(arg)) : arg).join(' ');

        // 1. DETECTA O TOTAL (Enviado pelo seu código) E CRIA A LINHA FINAL
        if (message.includes('Total de unidades lidas')) {
            const numero = message.match(/\d+/);
            const qtd = numero ? numero[0] : '0';
            window.gerarResumoFinalLog(qtd);
            return;
        }

        // 2. FILTRO DA LISTA (VERDE/VERMELHO)
        const termosPermitidos = ['[Lido no PDF]', 'Não encontrado', '❌', '⚠️'];
        const ehInutil = message.includes('Dados carregados');

        if (termosPermitidos.some(term => message.includes(term)) && !ehInutil) {
            const linha = document.createElement('div');

            // Estilo Padrão (Igual ao que você já gosta)
            linha.style.padding = "4px 8px";
            linha.style.marginBottom = "2px";
            linha.style.fontSize = "1.05em";
            linha.style.borderLeft = "4px solid #0f766e";
            linha.style.backgroundColor = "rgba(15, 118, 110, 0.05)";

            // Cores: Erro (Vermelho) vs Sucesso (Branco/Verde)
            if (message.includes('❌') || message.includes('Não encontrado')) {
                linha.style.color = "#ef4444";
                linha.style.borderLeftColor = "#ef4444";
            } else {
                linha.style.color = "#ffffff";
                linha.style.borderLeftColor = "#10b981";
            }

            const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            linha.innerHTML = `<span style="opacity: 0.5; font-size: 0.9em;">[${hora}]</span> > ${message}`;

            logDiv.insertBefore(linha, logDiv.firstChild);

            if (logDiv.childNodes.length > 50) logDiv.removeChild(logDiv.lastChild);
        }
    };

    // 3. O RESUMO SIMPLES (LINHA AZUL CIANO)
    window.gerarResumoFinalLog = function (quantidade) {
        const linha = document.createElement('div');

        // Estilo igual aos outros, mas destacado em AZUL CLARO e NEGRITO
        linha.style.padding = "8px 10px"; // Um pouco mais alto para destaque sutil
        linha.style.marginBottom = "5px";
        linha.style.marginTop = "5px";
        linha.style.fontSize = "1.1em"; // Letra levemente maior
        linha.style.fontWeight = "bold";
        linha.style.borderLeft = "4px solid #22d3ee"; // Azul Ciano
        linha.style.backgroundColor = "rgba(34, 211, 238, 0.1)"; // Fundo azul bem leve
        linha.style.color = "#22d3ee"; // Texto Azul Ciano

        const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        // Texto simples e direto
        linha.innerHTML = `<span style="opacity: 0.7; font-size: 0.8em;">[${hora}]</span> > 🏁 LEITURA CONCLUÍDA | Total: ${quantidade} itens`;

        logDiv.insertBefore(linha, logDiv.firstChild);
    };
})();


async function logout() {
    // 1. Pega o nome do usuário ANTES de limpar a memória
    const usuarioLogado = sessionStorage.getItem('username') || 'Usuário';

    try {
        // 2. Avisa o servidor que o usuário está saindo
        // Usamos 'await' para garantir que o log seja salvo antes de mudar de página
        await fetch('http://localhost:3000/api/log-operacao', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                usuario: usuarioLogado,
                acao: 'LOGOUT',
                detalhes: 'Usuário clicou no botão Sair.'
            })
        });
        console.log("Log de saída registrado.");
    } catch (err) {
        console.error("Erro ao registrar log de saída:", err);
    }

    // 3. Agora sim, limpa o crachá e sai
    sessionStorage.clear();
    window.location.href = 'login.html';
}


// Garante que o botão "Novo Produto" do HTML consiga encontrar a função
window.openModal = function () {
    console.log("Abrindo modal para novo item...");
    const modal = document.getElementById('modal');

    if (modal) {
        // Exibe o modal
        modal.style.display = 'flex';

        // LIMPEZA CRUCIAL: Limpa o ID de edição para o sistema entender que é um NOVO produto
        if (document.getElementById('editIndex')) document.getElementById('editIndex').value = "";

        // Limpa os outros campos
        if (document.getElementById('inpName')) document.getElementById('inpName').value = "";
        if (document.getElementById('inpAliases')) document.getElementById('inpAliases').value = "";
        if (document.getElementById('inpQty')) document.getElementById('inpQty').value = "";

        // Altera o título para não confundir com edição
        if (document.getElementById('modalTitle')) document.getElementById('modalTitle').innerText = "Novo Produto";

        // Coloca o cursor no nome automaticamente
        setTimeout(() => {
            if (document.getElementById('inpName')) document.getElementById('inpName').focus();
        }, 100);
    } else {
        console.error("Erro: Elemento 'modal' não encontrado no HTML.");
    }
};



const API_URL = '/products';


// --- 1. INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
    carregarProdutos();
});

// --- 2. CONEXÃO COM O BACKEND ---

// BUSCAR (GET /products)
// 1. Declare a variável globalmente no topo do arquivo
let listaProdutos = [];

async function carregarProdutos() {
    try {
        const res = await fetch(API_URL);
        const dados = await res.json();

        // 1. Preenche a lista oficial
        listaProdutos = dados.map(p => ({
            ...p,
            item_id: (p.item_id || p.id || "").toString().trim(),
            nome_produto: p.nome_produto || p.display || "Sem Nome",
            estoque_atual: Number(p.estoque_atual || 0)
        }));

        // 2. MÁGICA: Remove os erros que já foram cadastrados no banco
        sincronizarErrosComEstoque();

        console.log("📦 Dados carregados e sincronizados");

        // 3. Desenha a tela
        render();

        // 4. Desenha o painel de erros já atualizado (sem os que foram cadastrados)
        if (typeof gerenciarPainelErros === 'function') {
            gerenciarPainelErros([]);
        }

    } catch (error) {
        console.error("Erro ao carregar:", error);
    }
}

// CRIAR (POST /products/add)
async function criarProdutoBackend(produto) {
    // 1. Pegamos o usuário que está na memória do navegador AGORA
    const usuarioLogado = sessionStorage.getItem('username') || 'Desconhecido';

    try {
        const res = await fetch(`${API_URL}/add`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // 2. Enviamos o objeto produto + o usuário dinâmico
            body: JSON.stringify({
                ...produto,
                usuario: usuarioLogado
            })
        });

        const resposta = await res.json();
        // ... restante do seu código
    } catch (error) {
        console.error("Erro de rede:", error);
    }
}

// ATUALIZAR ESTOQUE (PUT /products/edit/:item_id)
async function deletarProdutoBackend(item_id) {
    // 1. Pega o nome do usuário logado
    const usuarioLogado = sessionStorage.getItem('username') || 'Admin';

    if (!confirm(`Tem certeza que deseja excluir o item ${item_id}?`)) return;

    try {
        // 👇 O SEGREDO: Passamos o usuário na URL (?usuario=...)
        const url = `http://localhost:3000/api/delete/${item_id}?usuario=${encodeURIComponent(usuarioLogado)}`;

        const res = await fetch(url, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
        });

        const resposta = await res.json();

        if (res.ok && resposta.success) {
            showToast('Produto excluído.', 'success');
            carregarProdutos();
        }
    } catch (error) {
        console.error("Erro ao deletar:", error);
    }
}


// --- 3. BOTÃO SALVAR ---
async function saveProduct() {
    const idOriginal = document.getElementById('editIndex').value;
    const nome = document.getElementById('inpName').value;

    // Se for uma EDIÇÃO, mostramos o modal de confirmação primeiro
    if (idOriginal) {
        document.getElementById('confirmMessage').innerText = `Deseja salvar as alterações de "${nome}"?`;
        document.getElementById('confirmModal').style.display = 'flex';

        // Configuramos o botão "Sim"
        document.getElementById('btnConfirmYes').onclick = async () => {
            document.getElementById('confirmModal').style.display = 'none';
            await executarEnvioDados(); // Função que realmente envia
        };

        // Configuramos o botão "Não"
        document.getElementById('btnConfirmNo').onclick = () => {
            document.getElementById('confirmModal').style.display = 'none';
        };
        return; // Para a execução aqui até o usuário clicar em algo
    }

    // Se for produto NOVO, envia direto
    await executarEnvioDados();
}

// Criamos essa função separada para não repetir código
async function executarEnvioDados() {
    // 1. Pega os dados do formulário
    const idOriginal = document.getElementById('editIndex').value;
    const nome = document.getElementById('inpName').value;
    const aliases = document.getElementById('inpAliases').value;
    const qty = document.getElementById('inpQty').value;

    // 2. PEGA O USUÁRIO (Garante que não seja nulo)
    const usuarioLogado = sessionStorage.getItem('username') || 'Anonimo';

    const produto = {
        nome_produto: nome,
        item_id: idOriginal || nome.toUpperCase().replace(/\s+/g, '-'),
        localizacao: aliases,
        estoque_atual: Number(qty),
        usuario: usuarioLogado // Manda no corpo também por segurança
    };

    try {
        // 👇 AQUI ESTÁ O SEGREDO: Colamos o usuário no Link da API
        let urlBase = idOriginal ? `${API_URL}/edit/${idOriginal}` : `${API_URL}/add`;
        const urlFinal = `${urlBase}?usuario=${encodeURIComponent(usuarioLogado)}`;

        const method = idOriginal ? 'PUT' : 'POST';

        console.log(`📤 Enviando requisição para: ${urlFinal}`); // Debug para você ver

        const res = await fetch(urlFinal, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(produto)
        });

        const resposta = await res.json();

        if (res.ok && resposta.success) {
            showToast('Sucesso!', 'success');
            closeModal();
            carregarProdutos();
        } else {
            alert('Erro no servidor: ' + resposta.message);
        }
    } catch (e) {
        console.error(e);
        showToast('Erro de conexão.', 'error');
    }
}


// --- 4. RENDERIZAÇÃO E UTILITÁRIOS ---

function render() {
    const tbody = document.getElementById('tbody');
    const termo = document.getElementById('search').value.toLowerCase();
    const filtroStatus = document.getElementById('filterOrder').value;

    tbody.innerHTML = '';

    // 1. Filtragem por texto e SKU
    let filtrados = listaProdutos.filter(p =>
        p.nome_produto.toLowerCase().includes(termo) ||
        p.item_id.toLowerCase().includes(termo) ||
        (p.localizacao || "").toLowerCase().includes(termo)
    );

    // 2. Filtro de Visão (Isolamento)
    if (filtroStatus === 'esgotados') {
        filtrados = filtrados.filter(p => p.estoque_atual <= 0);
    } else if (filtroStatus === 'repor') {
        filtrados = filtrados.filter(p => p.estoque_atual > 0 && p.estoque_atual < 6);
    }

    // 3. Lógica de Ordenação
    if (filtroStatus === 'nome') {
        filtrados.sort((a, b) => a.nome_produto.localeCompare(b.nome_produto));
    } else if (filtroStatus === 'maior_estoque') {
        filtrados.sort((a, b) => b.estoque_atual - a.estoque_atual);
    } else if (filtroStatus === 'estoque_baixo') {
        filtrados.sort((a, b) => a.estoque_atual - b.estoque_atual);
    } else if (filtroStatus === 'recentes') {
        filtrados.sort((a, b) => {
            // b - a garante que o mais novo (data maior) fique no topo
            return new Date(b.updatedAt) - new Date(a.updatedAt);
        });
    }


    // 4. Construção da Tabela
    filtrados.forEach(p => {
        const tr = document.createElement('tr');
        let statusColor = p.estoque_atual <= 0 ? "#ef4444" : (p.estoque_atual < 6 ? "#f59e0b" : "#10b981");
        let statusText = p.estoque_atual <= 0 ? "ESGOTADO" : (p.estoque_atual < 6 ? "REPOR" : "OK");

        tr.innerHTML = `
            <td><strong>${p.nome_produto}</strong><br><small>${p.item_id}</small></td>
            <td style="text-align:center; font-weight:bold; font-size:1.1em;">${p.estoque_atual}</td>
            <td><span style="background:${statusColor}; color:white; padding:3px 8px; border-radius:4px; font-size:0.8em;">${statusText}</span></td>
            <td style="text-align:center; white-space: nowrap;">
                <button onclick="preencherModal('${p.item_id}')" class="action-btn" title="Editar">✏️</button>
                <button onclick="deleteProduct('${p.item_id}')" class="action-btn" style="background:#fee2e2; color:#ef4444; border:none; margin-left:5px;" title="Apagar">🗑️</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    if (typeof atualizarAlertasEstoque === "function") atualizarAlertasEstoque();
}

function render() {
    const tbody = document.getElementById('tbody');
    const searchInput = document.getElementById('search');
    const filterSelect = document.getElementById('filterOrder');

    // VERIFICAÇÃO DE SEGURANÇA:
    // Se não existir tbody ou os filtros nesta página, interrompe a função
    // para não quebrar o restante do script.
    if (!tbody || !searchInput || !filterSelect) {
        return;
    }

    const termo = searchInput.value.toLowerCase();
    const filtroStatus = filterSelect.value;

    tbody.innerHTML = '';

    let filtrados = listaProdutos.filter(p =>
        p.nome_produto.toLowerCase().includes(termo) ||
        p.item_id.toLowerCase().includes(termo) ||
        (p.localizacao || "").toLowerCase().includes(termo)
    );

    if (filtroStatus === 'esgotados') {
        filtrados = filtrados.filter(p => p.estoque_atual <= 0);
    } else if (filtroStatus === 'repor') {
        filtrados = filtrados.filter(p => p.estoque_atual > 0 && p.estoque_atual < 6);
    }

    // Ordenação
    if (filtroStatus === 'nome') {
        filtrados.sort((a, b) => a.nome_produto.localeCompare(b.nome_produto));
    } else if (filtroStatus === 'maior_estoque') {
        filtrados.sort((a, b) => b.estoque_atual - a.estoque_atual);
    }

    filtrados.forEach(p => {
        const tr = document.createElement('tr');

        if (p.estoque_atual <= 0) {
            tr.style.backgroundColor = "#ff8888";
        } else if (p.estoque_atual < 6) {
            tr.style.backgroundColor = "#fffbeb";
        }

        let statusColor = p.estoque_atual <= 0 ? "#ef4444" : (p.estoque_atual < 6 ? "#f59e0b" : "#10b981");
        let statusText = p.estoque_atual <= 0 ? "ESGOTADO" : (p.estoque_atual < 6 ? "REPOR" : "OK");

        tr.innerHTML = `
            <td><strong>${p.nome_produto}</strong><br><small>${p.item_id}</small></td>
            <td style="text-align:center; font-weight:bold; font-size:1.1em;">${p.estoque_atual}</td>
            <td><span style="background:${statusColor}; color:white; padding:3px 8px; border-radius:4px; font-size:0.8em;">${statusText}</span></td>
            <td style="text-align:center; white-space: nowrap;">
                <button onclick="preencherModal('${p.item_id}')" class="action-btn" title="Editar">✏️</button>
                <button onclick="deleteProduct('${p.item_id}')" class="action-btn" style="background:#fee2e2; color:#ef4444; border:none; margin-left:5px;" title="Apagar">🗑️</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    if (typeof atualizarAlertasEstoque === "function") atualizarAlertasEstoque();
}


function closeModal() {
    document.getElementById('modal').style.display = 'none';
}

function showToast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const div = document.createElement('div');
    div.className = 'toast';
    div.innerHTML = `<strong>${type.toUpperCase()}</strong> <span>${msg}</span>`;
    container.appendChild(div);
    setTimeout(() => div.remove(), 3000);

}

// Esta função sincroniza tudo o que está no banco com a tela
window.sincronizarDados = async function (silencioso = false) {
    if (!silencioso) console.log("🔍 1. Buscando dados no servidor...");

    try {
        const response = await fetch('/api/vendas');

        if (!response.ok) {
            if (!silencioso) console.error("❌ Erro na rota /api/vendas. Status:", response.status);
            return;
        }

        const dadosAtualizados = await response.json();

        if (Array.isArray(dadosAtualizados) && dadosAtualizados.length > 0) {
            window.vendasHistorico = dadosAtualizados;

            // A MUDANÇA ESTÁ AQUI: Só mostra o Total se NÃO for silencioso
            if (!silencioso) {
                console.log("✅ 2. Dados sincronizados! Total no banco:", window.vendasHistorico.length);
            }

            if (typeof renderizarTop10 === 'function') renderizarTop10();
            if (typeof atualizarGraficos === 'function') atualizarGraficos();
        }

    } catch (err) {
        console.error("❌ Erro ao sincronizar dados:", err);
    }
}

async function processPDF(input) {
    const files = input.files;
    if (!files.length) return;

    const seletor = document.getElementById('dataLancamento');
    const dataEscolhida = seletor && seletor.value ? seletor.value : new Date().toISOString().split('T')[0];

    // Resetamos os contadores para cada novo upload de PDF
    let totalItensAbatidos = 0;
    let itensNaoEncontrados = [];

    console.log('📄 Iniciando processamento de PDF...');

    for (const file of files) {
        const reader = new FileReader();
        reader.onload = async function () {
            const typedarray = new Uint8Array(this.result);
            try {
                const pdf = await pdfjsLib.getDocument(typedarray).promise;

                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const content = await page.getTextContent();

                    let rows = {};
                    let rowKeys = [];
                    content.items.forEach(item => {
                        let y = item.transform[5];
                        let foundKey = rowKeys.find(key => Math.abs(key - y) < 5);
                        if (foundKey !== undefined) rows[foundKey].push(item.str);
                        else { rows[y] = [item.str]; rowKeys.push(y); }
                    });

                    rowKeys.sort((a, b) => b - a);

                    for (let y of rowKeys) {
                        let lineText = rows[y].join(' ');
                        let match = lineText.match(/(.*?)\s+(?:x|X|×|☑|v)\s*(\d+)\s*$/);

                        if (match) {
                            let skuExtraido = match[1].trim();
                            let qtdVenda = parseInt(match[2]);

                            // MANTÉM SUA FUNÇÃO ORIGINAL DE DÉBITO UM POR UM
                            const encontrado = await identificarEBaixarEstoque(skuExtraido, qtdVenda, file.name, dataEscolhida);

                            if (encontrado) {
                                totalItensAbatidos += qtdVenda;
                                // Mostra cada SKU lido deste PDF no console
                                console.log(`✅ [Lido no PDF] SKU: ${skuExtraido} | Qtd: ${qtdVenda}`);
                            } else {
                                let erroExistente = itensNaoEncontrados.find(e => e.sku === skuExtraido);
                                if (erroExistente) {
                                    erroExistente.qtd += qtdVenda;
                                } else {
                                    itensNaoEncontrados.push({
                                        sku: skuExtraido,
                                        qtd: qtdVenda
                                    });
                                }
                            }
                        }
                    }
                }

                // ✅ MANTÉM REGISTRO DE ERROS (Apenas deste PDF)
                if (itensNaoEncontrados.length > 0) {
                    // 🚩 ADICIONE ESTA LINHA ABAIXO:
                    window.listaSkusNaoEncontrados = itensNaoEncontrados;

                    console.warn(`⚠️ SKUs deste PDF não encontrados no estoque:`, itensNaoEncontrados);
                    gerenciarPainelErros(itensNaoEncontrados);
                }


                // ✅ ATUALIZAÇÃO DA TELA
                if (typeof carregarProdutos === 'function') carregarProdutos();

                const usuarioLogado = sessionStorage.getItem('username') || 'Desconhecido';
                registrarLogViaFetch(usuarioLogado, 'UPLOAD_PDF', `Processou PDF: ${file.name} | Total: ${totalItensAbatidos} itens.`);


                if (totalItensAbatidos > 0) {
                    // Alerta visual focado apenas no arquivo atual
                    showToast(`✅ PDF Processado: ${totalItensAbatidos} unidades lidas.`, 'success');

                    console.log(`--- Resumo do Arquivo ---`);
                    console.log(`📦 Total de unidades lidas neste PDF: ${totalItensAbatidos}`);
                    console.log(`--------------------------`);

                    // Chamada silenciosa (true) para não imprimir o acumulado do banco
                    if (typeof sincronizarDados === 'function') {
                        sincronizarDados(true);
                    }
                }

            } catch (err) {
                console.error("❌ Erro no PDF:", err);
                showToast("Erro ao processar arquivo.", "error");
            }
        };
        reader.readAsArrayBuffer(file);
    }
    input.value = "";
}


async function registrarLogViaFetch(usuario, acao, detalhes) {
    // 1. Garante o nome do usuário
    const usuarioLogado = usuario || sessionStorage.getItem('username') || 'Sistema';

    try {
        // 👇 AQUI ESTAVA O ERRO!
        // Antes estava: `${API_URL}/log-operacao` (que virava /products/log-operacao)
        // Agora usamos o endereço FIXO e CERTO:
        await fetch('http://localhost:3000/api/log-operacao', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                usuario: usuarioLogado,
                acao,
                detalhes
            })
        });
    } catch (err) {
        console.error("Erro ao enviar log:", err);
    }
}


// Função auxiliar para enviar logs de ações manuais do Front para o Back
async function registrarLogManualBackend(usuario, acao, detalhes) {
    try {
        await fetch(`${API_URL}/log-operacao`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuario, acao, detalhes })
        });
    } catch (err) {
        console.error("Erro ao enviar log manual:", err);
    }
}

let ultimasFalhasDetectadas = []; // Variável global para consulta
// Note que agora incluí o terceiro parâmetro: dataEscolhida

async function executarBaixaPorTexto(texto, nomeArquivo) {
    let baixasRealizadas = 0;
    const log = document.getElementById('log');

    // Normalização "Ninja": remove lixo e padroniza 0/O e 1/I
    const normalizar = (t) => t.toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .replace(/O/g, '0')
        .replace(/I/g, '1')
        .replace(/L/g, '1');

    const dnaPDF = normalizar(texto);

    for (const produto of listaProdutos) {
        if (!produto.item_id) continue;

        const skuOriginal = produto.item_id.toString();
        const skuDNA = normalizar(skuOriginal);

        // BUSCA EXATA (Para evitar os erros do PDF 8)
        if (dnaPDF.includes(skuDNA)) {
            baixasRealizadas++;
            const novaQtd = Number(produto.estoque_atual) - 1;
            await atualizarEstoqueBackend(produto.item_id, novaQtd);

            if (log) log.innerText = `> [${nomeArquivo}] Baixa: ${produto.nome_produto} (-1)\n` + log.innerText;
        }
    }

    console.log(`✅ TOTAL FINAL: ${baixasRealizadas}`);
    if (baixasRealizadas > 0) {

        await registrarLogManualBackend(usuarioLogado, 'PROCESSAR_PDF', `Arquivo: ${nomeArquivo} | Baixas: ${baixasRealizadas} itens.`);
        showToast(`${baixasRealizadas} itens processados!`, 'success');
        carregarProdutos();
    }
}

function atualizarAlertasEstoque() {
    const shortageList = document.getElementById('shortageList');
    if (!shortageList) return;

    // Filtra produtos com estoque menor que 6
    const criticos = listaProdutos.filter(p => p.estoque_atual < 6);

    shortageList.innerHTML = "";

    if (criticos.length > 0) {
        criticos.forEach(p => {
            const li = document.createElement('li');
            // --- ESTILO DE CLIQUE ---
            li.style.cursor = "pointer";
            li.style.transition = "background 0.2s";
            li.style.padding = "8px";
            li.style.borderBottom = "1px solid #fecaca";

            // Efeito visual ao passar o mouse
            li.onmouseover = () => li.style.background = "#fee2e2";
            li.onmouseout = () => li.style.background = "transparent";

            // --- AÇÃO DE CLIQUE: Chama a função que já existe para abrir o modal ---
            li.onclick = () => preencherModal(p.item_id);

            const icone = p.estoque_atual <= 0 ? "🔴" : "⚠️";
            const corTexto = p.estoque_atual <= 0 ? "#b91c1c" : "#d97706";

            li.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; pointer-events: none;">
                    <strong style="color: ${corTexto}">${icone} ${p.nome_produto}</strong>
                    <span style="font-weight: bold;">${p.estoque_atual} un</span>
                </div>
                <small style="color: #666; font-size: 0.85em; pointer-events: none;">SKU: ${p.item_id} (Clique para editar)</small>
            `;
            shortageList.appendChild(li);
        });
    } else {
        shortageList.innerHTML = '<li style="color:#16a34a; font-style:italic;">✅ Nenhum item em falta</li>';
    }

    // No final do try do registrarVendaNoFirebase:
    if (typeof carregarHistoricoVendas === 'function') {
        carregarHistoricoVendas();
    }
}
// --- IDENTIFICAÇÃO INTELIGENTE (Resolve SKUs não encontrados) ---

// ======================================================
// VERSÃO HÍBRIDA: BUSCA PERFEITA + CONEXÃO MYSQL
// ======================================================
async function identificarEBaixarEstoque(skuRaw, qtd, nomeArquivo, dataManual) {
    // 1. NORMALIZAÇÃO (Sua regra de O/0 e I/1)
    const normalizar = (t) => t.toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .replace(/O/g, '0')
        .replace(/I/g, '1');

    const skuBusca = normalizar(skuRaw); // Ex: "CUB0DLED04"

    // 2. ORDENAÇÃO POR TAMANHO (O segredo para não confundir D-Y05 com D-Y05PRO)
    // Colocamos os SKUs mais longos do banco no topo da lista de busca.
    const listaOrdenada = [...listaProdutos].sort((a, b) =>
        (b.item_id || "").length - (a.item_id || "").length
    );

    // 3. BUSCA DE PRECISÃO
    // 2. BUSCA POR APELIDOS (Variantes Manuais)
    const produto = listaOrdenada.find(p => {
        // Transforma "SKU1, SKU2, SKU3" em uma lista real ['SKU1', 'SKU2', 'SKU3']
        const apelidos = (p.item_id || "").split(',').map(s => normalizar(s.trim()));
        const locs = (p.localizacao || "").split(',').map(s => normalizar(s.trim()));

        const todosOsNomesDoProduto = [...apelidos, ...locs];

        // Se o que o PDF leu for IGUAL a qualquer um dos apelidos -> MATCH PERFEITO
        return todosOsNomesDoProduto.includes(skuBusca);
    });

    if (produto) {
        console.log(`✅ MATCH! PDF: "${skuRaw}" -> Banco: "${produto.item_id}"`);

        // 4. OBJETO PARA A API (Sempre usando o ID oficial do banco)
        const dadosVenda = {
            item_id: produto.item_id,
            quantidade: qtd,
            data_venda: dataManual,
            hora_venda: new Date().toLocaleTimeString('pt-BR'),
            plataforma: 'UpSeller (PDF)',
            cliente_nome: 'Venda PDF'
        };

        try {
            const response = await fetch('http://localhost:3000/api/vendas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dadosVenda)
            });

            if (response.ok) {
                produto.estoque_atual = Number(produto.estoque_atual) - qtd;
                return true;
            }
        } catch (err) {
            console.error("❌ Erro na API:", err);
        }
        return false;
    } else {
        console.warn(`❌ SKU NÃO ENCONTRADO: ${skuRaw}`);
        return false;
    }
}

async function registrarVendaNoMysql(sku, quantidade, dataVenda) {
    try {
        // Faz a chamada para o seu servidor Node.js
        const response = await fetch('/api/vendas', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                item_id: sku,           // Ex: "D-3142"
                quantidade: quantidade, // Ex: 7
                data_venda: dataVenda   // Data do seletor
            })
        });

        const resultado = await response.json();

        if (response.ok) {
            console.log(`✅ Analytics: Venda de ${sku} registrada no MySQL.`);
        } else {
            console.error(`❌ Erro Analytics:`, resultado.error);
        }
    } catch (err) {
        console.error("❌ Erro de conexão ao registrar no MySQL:", err);
    }
}

// --- FUNÇÃO PARA RENDERIZAR OS ITENS NÃO ENCONTRADOS NA SIDEBAR ---
function renderErrorList(items) {
    const list = document.getElementById('errorList');
    if (!list) return;

    if (items.length === 0) {
        list.innerHTML = '<li style="color:#166534; font-style:italic;">✅ Tudo identificado!</li>';
        return;
    }

    list.innerHTML = items.map(err => `
        <li style="border-bottom: 1px solid #fecaca; padding: 8px 0; display: flex; justify-content: space-between; align-items: center;">
            <span style="color:#b91c1c; font-weight: bold; font-family: monospace;">SKU não encontrado: ${err.sku}</span>
            <button onclick="copiarTexto('${err.sku}')" style="cursor:pointer; background:#fff1f2; border:1px solid #fca5a5; color:#991b1b; border-radius:4px; padding:2px 8px; font-size:10px;">COPIAR</button>
        </li>
    `).join('');
}


// --- FUNÇÃO AUXILIAR PARA COPIAR O SKU ---
function copiarSKU(texto) {
    navigator.clipboard.writeText(texto).then(() => {
        showToast(`SKU "${texto}" copiado!`, "info");
    }).catch(err => {
        console.error('Erro ao copiar:', err);
    });
}


// Função para copiar o SKU para a área de transferência
function copiarTexto(texto) {
    if (!texto) return;

    // Tenta usar a API moderna de clipboard
    navigator.clipboard.writeText(texto).then(() => {
        showToast(`SKU "${texto}" copiado!`, "info");
    }).catch(err => {
        // Fallback para navegadores antigos ou sem permissão
        const input = document.createElement('input');
        input.value = texto;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        showToast(`SKU "${texto}" copiado!`, "info");
    });
}

// --- CSS EXTRA PARA A LISTA (Opcional, adicione no seu style.css ou tag <style>) ---
/* #errorList {
    max-height: 300px;
    overflow-y: auto;
    padding-right: 5px;
}
#errorList::-webkit-scrollbar { width: 4px; }
#errorList::-webkit-scrollbar-thumb { background: #fca5a5; border-radius: 10px; }
*/
function ordenarProdutos(criterio) {
    if (criterio === 'nome') {
        listaProdutos.sort((a, b) => a.nome_produto.localeCompare(b.nome_produto));
    } else if (criterio === 'nome_desc') {
        listaProdutos.sort((a, b) => b.nome_produto.localeCompare(a.nome_produto));
    }
    else if (criterio === 'esgotados') {
        // Coloca quem tem zero ou menos no topo
        listaProdutos.sort((a, b) => a.estoque_atual - b.estoque_atual);
    } else if (criterio === 'repor') {
        // Coloca quem está entre 1 e 5 no topo
        listaProdutos.sort((a, b) => {
            const aRepor = (a.estoque_atual > 0 && a.estoque_atual < 6) ? 0 : 1;
            const bRepor = (b.estoque_atual > 0 && b.estoque_atual < 6) ? 0 : 1;
            return aRepor - bRepor;
        });
    } else if (criterio === 'estoque_baixo') {
        listaProdutos.sort((a, b) => a.estoque_atual - b.estoque_atual);
    } else if (criterio === 'maior_estoque') {
        listaProdutos.sort((a, b) => b.estoque_atual - a.estoque_atual);
    } else if (criterio === 'mais_vendidos') {
        listaProdutos.sort((a, b) => (b.vendas_qtd || 0) - (a.vendas_qtd || 0));
    } else if (criterio === 'recentes') {
        listaProdutos.sort((a, b) => {
            // Converte para string e remove espaços, depois compara
            let valA = String(a.item_id || "").trim();
            let valB = String(b.item_id || "").trim();

            // Usa a lógica natural (reconhece números dentro da string)
            return valB.localeCompare(valA, undefined, { numeric: true, sensitivity: 'base' });
        });
    }

    render();
}

// TORNA AS FUNÇÕES DISPONÍVEIS PARA O HTML (Escopo Global)

window.preencherModal = function (id) {
    console.log("Abrindo edição para o SKU:", id);

    // Procura o produto na sua lista global
    const p = listaProdutos.find(prod => prod.item_id === id);

    if (p) {
        // Abre o modal
        const modal = document.getElementById('modal');
        if (modal) modal.style.display = 'flex';

        // Preenche os campos (Certifique-se que os IDs batem com seu HTML)
        if (document.getElementById('editIndex')) document.getElementById('editIndex').value = p.item_id;
        if (document.getElementById('inpName')) document.getElementById('inpName').value = p.nome_produto;
        if (document.getElementById('inpAliases')) document.getElementById('inpAliases').value = p.localizacao || "";
        if (document.getElementById('inpQty')) document.getElementById('inpQty').value = p.estoque_atual;

        if (document.getElementById('modalTitle')) document.getElementById('modalTitle').innerText = "Editar Produto";
    } else {
        console.error("Erro: Produto não encontrado na lista.");
    }
};

window.deleteProduct = async function (id) {
    if (!confirm(`📦 Deseja ARQUIVAR o produto ${id}?\nEle sumirá da lista, mas os dados no Analytics serão preservados.`)) return;

    try {
        const idProtegido = encodeURIComponent(id);
        const url = `http://localhost:3000/api/produtos/archive/${idProtegido}`;

        const res = await fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' }
        });

        if (res.ok) {
            showToast('✅ Produto arquivado!', 'success');
            if (typeof carregarProdutos === "function") carregarProdutos();
        } else {
            // --- AQUI ESTÁ A MUDANÇA MÁGICA ---
            // O servidor mandou um erro 500. Vamos ler o que ele escreveu.
            const erroTexto = await res.text();

            console.error("❌ O Servidor respondeu:", erroTexto);

            // O alert vai mostrar o erro exato (Ex: "Product is not defined" ou "db is not defined")
            alert(`ERRO DO SERVIDOR:\n\n${erroTexto.substring(0, 300)}`);
        }
    } catch (error) {
        console.error("Erro na requisição:", error);
        alert('Erro de conexão (O servidor Node está rodando?).');
    }
};

// ✅ NOVA VERSÃO: Busca os erros no seu MySQL via Node.js
async function carregarErrosPersistentes() {
    const errorListUl = document.getElementById('errorList');
    if (!errorListUl) return;

    try {
        // Buscamos na sua nova rota de API
        const res = await fetch('/api/erros-sku');
        const dados = await res.json();

        errorListUl.innerHTML = '';

        if (!dados || dados.length === 0) {
            errorListUl.innerHTML = '<li style="color:#666; font-style:italic;">Nenhum SKU pendente.</li>';
            return;
        }

        dados.forEach(item => {
            const li = document.createElement('li');
            li.style = "display: flex; justify-content: space-between; padding: 8px; border-bottom: 1px solid #eee; align-items: center; background: #fff5f5; margin-bottom: 4px; border-radius: 4px;";

            li.innerHTML = `
                <div>
                    <strong style="color: #c00;">⚠️ ${item.sku}</strong>
                    <br><small style="font-size: 0.75em; color: #888;">${item.createdAt || 'Pendente'}</small>
                </div>
                <button onclick="removerErroBanco('${item.id}')" style="border: none; background: #ff4d4d; color: white; border-radius: 3px; cursor: pointer; padding: 2px 8px;">✕</button>
            `;
            errorListUl.appendChild(li);
        });
    } catch (err) {
        console.error("Erro ao carregar lista de erros:", err);
    }
}

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  FUNÇÃO AUXILIAR: Monitorar SKUs não encontrados                          ║
// ║  ADICIONE esta função ao seu app.js se ainda não tiver                    ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

console.log('👀 Iniciando monitoramento de SKUs não encontrados...');

// 1. MEMÓRIA GLOBAL (Sincronizada com LocalStorage)
let memoriaErrosGlobal = JSON.parse(localStorage.getItem('erros_pendentes_v1')) || [];

function gerenciarPainelErros(novosErros) {
    const errorList = document.getElementById('errorList');
    const painelContainer = document.querySelector('.panel-error');
    if (!errorList) return;

    // 1. ATUALIZA A FRASE E O BOTÃO (Padrão .btn-upload)
    const fraseOriginal = painelContainer.querySelector('p');
    if (fraseOriginal) {
        fraseOriginal.innerHTML = `
            <div style="margin-bottom: 20px;">
                <p style="color: #64748b; font-size: 0.9em; margin-bottom: 12px; text-align: center;">
                    Fazer uma nova leitura dos itens abaixo:
                </p>
                <button onclick="reprocessarTodaLista()" class="btn-upload">
                    🔄 TENTAR NOVAMENTE
                </button>
            </div>
        `;
    }

    // 2. DADOS: Acumula na memória global
    if (novosErros && novosErros.length > 0) {
        novosErros.forEach(item => {
            const existe = memoriaErrosGlobal.find(e => e.sku === item.sku);
            if (existe) {
                existe.qtd += item.qtd;
            } else {
                memoriaErrosGlobal.push({ ...item });
            }
        });
        localStorage.setItem('erros_pendentes_v1', JSON.stringify(memoriaErrosGlobal));
    }

    // 3. RENDERIZAÇÃO DOS CARDS (Mantendo seu layout de ícones)
    errorList.innerHTML = '';

    if (memoriaErrosGlobal.length === 0) {
        errorList.innerHTML = '<li style="color:#94a3b8; text-align:center; padding:20px; font-style:italic;">Aguardando leitura de PDF...</li>';
        return;
    }

    memoriaErrosGlobal.forEach(item => {
        const li = document.createElement('li');
        // Estilo de card para bater com seus 372 SKUs ativos
        li.style = "background: white; border-radius: 12px; border: 1px solid #f1f5f9; padding: 15px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);";

        li.innerHTML = `
            <div class="error-info">
                <span class="sku-title" style="display:block; font-weight:800; color:#1e293b; font-size:1.1em;">${item.sku}</span>
                <span class="sku-qtd" style="color:#94a3b8; font-size:0.8em; font-weight:600; text-transform:uppercase;">Quantidade: ${item.qtd}</span>
            </div>
            
            <div class="error-actions" style="display:flex; gap:10px;">
                <button onclick="navigator.clipboard.writeText('${item.sku}'); showToast('SKU Copiado!', 'success')" 
                        class="btn-icon-only" title="Copiar SKU" style="background:none; border:none; cursor:pointer;">
                    <img src="img/icon-copiar.png" alt="Copiar" style="width:35px; height:35px;">
                </button>
                
                <button onclick="removerErroDaLista('${item.sku}')" 
                        class="btn-icon-only" title="Remover este erro" style="background:none; border:none; cursor:pointer;">
                    <img src="img/icon-excluir.png" alt="Excluir" style="width:35px; height:35px;">
                </button>
            </div>
        `;
        errorList.appendChild(li);
    });
}

// 2. FUNÇÃO DO BOTÃO: Reprocessar toda a lista de uma vez
// 2. REPROCESSAR TODA A LISTA (Botão TENTAR NOVAMENTE)
async function reprocessarTodaLista() {
    if (memoriaErrosGlobal.length === 0) return;

    showToast("🔄 Processando bipes e atualizando financeiro...", "info");
    const dataAtual = document.getElementById('dataLancamento')?.value || new Date().toISOString().split('T')[0];
    let vendasConfirmadas = 0;

    for (let i = memoriaErrosGlobal.length - 1; i >= 0; i--) {
        const item = memoriaErrosGlobal[i];
        
        // 🚩 O SEGREDO: Aqui o sistema tenta fazer o 'Bipe Retroativo'
        const processou = await identificarEBaixarEstoque(item.sku, item.qtd, "REPROCESSAMENTO_PDF", dataAtual);

        if (processou) {
            vendasConfirmadas++;
            memoriaErrosGlobal.splice(i, 1);
        }
    }

    localStorage.setItem('erros_pendentes_v1', JSON.stringify(memoriaErrosGlobal));
    gerenciarPainelErros([]);

    if (vendasConfirmadas > 0) {
        if (typeof sincronizarDados === 'function') await sincronizarDados(true);
        showToast(`💰 ${vendasConfirmadas} vendas integradas ao faturamento!`, "success");
    } else {
        showToast("⚠️ SKUs não encontrados ou já processados.", "error");
    }
}

// 2. SALVAR: Grava a memória atualizada no navegador
localStorage.setItem('erros_pendentes_v1', JSON.stringify(memoriaErrosGlobal));

// 3. LIMPAR E DESENHAR
errorList.innerHTML = '';

memoriaErrosGlobal.forEach(item => {
    const li = document.createElement('li');
    li.className = 'error-card';

    li.innerHTML = `
            <div class="error-info">
                <span class="sku-title">${item.sku}</span>
                <span class="sku-qtd">Quantidade: ${item.qtd}</span>
            </div>
            
            <div class="error-actions">
                <button onclick="navigator.clipboard.writeText('${item.sku}'); showToast('SKU Copiado!', 'success')" 
                        class="btn-icon-only"
                        title="Copiar SKU">
                    <img src="img/icon-copiar.png" alt="Copiar" class="icon-copy-img">
                </button>
                
                <button onclick="removerErroDaLista('${item.sku}')" 
                        class="btn-icon-only"
                        title="Remover este erro da lista">
                    <img src="img/icon-excluir.png" alt="Excluir" class="icon-delete-img">
                </button>
            </div>
        `;
    errorList.appendChild(li);
});


// Função para remover um item quando você terminar de cadastrar
function removerErroDaLista(skuParaRemover) {
    // 1. Remove da memória RAM
    memoriaErrosGlobal = memoriaErrosGlobal.filter(item => item.sku !== skuParaRemover);

    // 2. Remove do "Banco de Dados" do navegador
    localStorage.setItem('erros_pendentes_v1', JSON.stringify(memoriaErrosGlobal));

    // 3. Atualiza a tela (chama a função principal com lista vazia)
    gerenciarPainelErros([]);

    if (typeof showToast === 'function') {
        showToast('Erro removido!', 'info');
    }
}


// 1. RESOLUÇÃO MANUAL (Novo ou Variante)
async function fluxoResolucao(sku, qtd, tipo) {
    let skuVinculo = null;

    if (tipo === 'variante') {
        skuVinculo = prompt(`A qual SKU principal você quer vincular "${sku}"?`);
        if (!skuVinculo) return;
    }

    try {
        // PASSO 1: Adiciona o produto/variante no Banco de Dados
        const res = await fetch('/api/produtos/resolver-pendencia', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ skuOriginal: sku, tipo, skuVinculo })
        });

        if (res.ok) {
            showToast(`✅ SKU ${sku} confirmado! Registrando venda...`, 'success');

            const dataLancamento = document.getElementById('dataLancamento')?.value || new Date().toISOString().split('T')[0];
            
            // PASSO 2: EXECUTAR BAIXA E REGISTRO DE VENDA
            // Certifique-se que essa função 'identificarEBaixarEstoque' faz o INSERT na tabela VENDAS
            const sucessoTotal = await identificarEBaixarEstoque(sku, qtd, "VENDA_PDF_MANUAL", dataLancamento);

            if (sucessoTotal) {
                // PASSO 3: Limpeza de memória e atualização de Dash
                memoriaErrosGlobal = memoriaErrosGlobal.filter(i => i.sku !== sku);
                localStorage.setItem('erros_pendentes_v1', JSON.stringify(memoriaErrosGlobal));
                
                gerenciarPainelErros([]); 
                
                // Forçamos a sincronização para atualizar o faturamento de R$ 509k na tela
                if (typeof sincronizarDados === 'function') await sincronizarDados(true);
                showToast(`🚀 Venda registrada e faturamento atualizado!`);
            }
        }
    } catch (err) {
        console.error("❌ Erro no processamento:", err);
        showToast("Erro ao confirmar produto ou registrar venda.", "error");
    }
}


function sincronizarErrosComEstoque() {
    // 1. Se não houver erros na lista, nem precisa continuar
    if (memoriaErrosGlobal.length === 0) return;

    console.log("🔄 Sincronizando lista de erros com o estoque real...");

    // 2. Filtra a lista de erros: 
    // Mantém apenas os itens que AINDA NÃO existem na listaProdutos (lista oficial do banco)
    const totalAntes = memoriaErrosGlobal.length;

    memoriaErrosGlobal = memoriaErrosGlobal.filter(erro => {
        // Verifica se o SKU do erro existe como item_id na lista oficial
        const jaCadastrado = listaProdutos.some(p => p.item_id === erro.sku);
        return !jaCadastrado; // Retorna true para manter (se não estiver cadastrado)
    });

    // 3. Se algo foi removido, salva e avisa
    if (memoriaErrosGlobal.length !== totalAntes) {
        localStorage.setItem('erros_pendentes_v1', JSON.stringify(memoriaErrosGlobal));
        console.log(`✅ Sincronização concluída: ${totalAntes - memoriaErrosGlobal.length} itens removidos do painel de erros.`);
    }
}


// --- CARREGAR ERROS SALVOS AO INICIAR ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Pega os dados salvos no navegador
    const dadosSalvos = localStorage.getItem('erros_pendentes_v1');

    // 2. Se existirem dados, coloca na memória e desenha na tela
    if (dadosSalvos) {
        memoriaErrosGlobal = JSON.parse(dadosSalvos);

        // Passa lista vazia [] apenas para forçar o desenho na tela sem somar nada novo
        gerenciarPainelErros([]);
    }
});



// --- GATILHO DE INICIALIZAÇÃO ---
// Este código roda automaticamente assim que a página termina de carregar
window.addEventListener('load', () => {
    console.log("Sincronizando painel de erros com o LocalStorage...");

    // 1. Tenta recuperar os dados salvos
    const salvos = localStorage.getItem('erros_pendentes_v1');

    if (salvos) {
        // 2. Transforma o texto em lista novamente
        const listaRecuperada = JSON.parse(salvos);

        // 3. Se houver itens na lista, atualiza a memória e manda desenhar
        if (listaRecuperada.length > 0) {
            memoriaErrosGlobal = listaRecuperada;

            // Chamamos com [] apenas para forçar a função a desenhar o que está na memória
            if (typeof gerenciarPainelErros === 'function') {
                gerenciarPainelErros([]);
            }
        }
    }
});



document.addEventListener('DOMContentLoaded', () => {
    // 1. Pega as informações de quem logou
    const logado = sessionStorage.getItem('wms_logado');
    const role = sessionStorage.getItem('wms_role');

    // 2. Trava de segurança: Se não logou, volta pro login
    if (logado !== 'true') {
        window.location.href = 'login.html';
        return;
    }

    // 3. LOGICA DO ADMIN (Onde você cola o código)
    if (role === 'admin') {
        const nav = document.querySelector('.tab-nav');
        if (nav) {
            const linkUser = document.createElement('a');
            linkUser.href = "usuarios.html";
            linkUser.className = "tab-link";
            linkUser.innerHTML = `<span class="material-icons" style="font-size:18px">group_add</span> Equipe`;
            nav.appendChild(linkUser);
        }
        console.log("🔓 Menu de Admin liberado.");
    }

    // 4. LOGICA DO ESTOQUISTA (Opcional, se quiser esconder outras coisas)
    if (role === 'estoquista') {
        // Aqui vai aquele código que remove o Analytics, se você quiser manter
        const btnAnalytics = document.getElementById('link-analytics');
        if (btnAnalytics) btnAnalytics.remove();

        const btnEquipe = document.getElementById('link-usuarios');
        if (btnEquipe) btnEquipe.remove();

    }
    // Dentro do seu DOMContentLoaded
    if (role === 'vendedor') {
        // 1. Remove Analytics
        const btnAnalytics = document.getElementById('link-analytics');
        if (btnAnalytics) btnAnalytics.remove();

        // 2. Remove Mapa
        const btnMapa = document.getElementById('link-mapa');
        if (btnMapa) btnMapa.remove();

        // 3. Remove Bipagem
        const btnBipagem = document.getElementById('link-bipagem');
        if (btnBipagem) btnBipagem.remove();

        const btnFinanceiro = document.getElementById('link-abrirFinanceiro');
        if (btnFinanceiro) btnFinanceiro.remove();

        console.log("💰 Acesso de Vendedor: Abas restritas removidas.");

        const btnAdmin = document.getElementById('link-btn-mod-admin');
        if (btnAdmin) btnAdmin.remove();
    }

})


// 👇 SCRIPT PARA LOGAR SAÍDA/FECHAMENTO DE ABA 👇
window.addEventListener('beforeunload', (event) => {
    const usuario = sessionStorage.getItem('username');

    if (usuario) {
        // Monta o dado
        const dados = JSON.stringify({ usuario: usuario, acao: 'SAIDA_SISTEMA', detalhes: 'Fechou a aba ou navegador' });

        // Usa o fetch com keepalive (Obrigatório para funcionar ao fechar)
        fetch(`${API_URL}/log-saida`, { // Crie essa rota no backend (veja abaixo)
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: dados,
            keepalive: true // <--- ISSO É O QUE FAZ FUNCIONAR
        });
    }
});

;

document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.getElementById('sidebar');
    const content = document.querySelector('.analytics-section');

    // 1. Verifica se existe uma preferência salva
    const sidebarState = localStorage.getItem('sidebar-collapsed');

    // 2. Se não houver nada salvo, definimos como 'true' (minimizada) por padrão
    if (sidebarState === null || sidebarState === 'true') {
        sidebar.classList.add('collapsed');
        sidebar.classList.remove('expanded');
        localStorage.setItem('sidebar-collapsed', 'true');
    } else {
        sidebar.classList.remove('collapsed');
        sidebar.classList.add('expanded');
    }

    // 3. Função para salvar o estado quando você clicar no botão de fechar/abrir
    window.toggleSidebar = function () {
        const isCurrentlyCollapsed = sidebar.classList.toggle('collapsed');
        sidebar.classList.toggle('expanded', !isCurrentlyCollapsed);

        // Salva a escolha para todas as outras páginas
        localStorage.setItem('sidebar-collapsed', isCurrentlyCollapsed);

        console.log("💾 Preferência de layout salva:", isCurrentlyCollapsed ? "Minimizado" : "Expandido");
    };
});

/* front/js/app.js */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Busca os dados que o seu backend enviou no Login
    const userLogado = JSON.parse(localStorage.getItem('usuario'));

    if (userLogado) {
        // 2. Preenche o Card da Sidebar (Estilo Eva Murphy)
        const sbName = document.getElementById('sb-user-name');
        const sbRole = document.getElementById('sb-user-role');
        const sbPhoto = document.getElementById('sb-user-photo');

        // Usando 'username' e 'role' que vêm do seu Model User
        if (sbName) sbName.innerText = userLogado.username;
        if (sbRole) sbRole.innerText = userLogado.role;

        // 3. Preenche a Saudação no Header ("Olá, Username")
        const headerGreeting = document.getElementById('sessao-nome-saudacao');
        if (headerGreeting) headerGreeting.innerText = userLogado.username;

        // 4. Foto: Como seu banco ainda não tem a coluna 'foto', 
        // usamos uma padrão ou a que você definir no localStorage
        if (sbPhoto && userLogado.photo_url) {
            sbPhoto.src = userLogado.photo_url;
        }
    }
});