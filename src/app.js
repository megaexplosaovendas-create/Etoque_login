/************************************************
 * 1. IMPORTAÇÕES E CONFIGURAÇÕES
 ************************************************/
require('dotenv').config();

// Bibliotecas do Servidor
const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs'); // Faltava para o Login

// Banco de Dados e Operadores
const sequelize = require('./config/db');
const { DataTypes, Op } = require('sequelize'); // O 'Op' é essencial para o PDF


// Sessão (Login) - Faltava Tudo Isso!
const session = require('express-session');
const SequelizeStore = require('connect-session-sequelize')(session.Store);

// Modelos (Tabelas)
const Product = require('./models/Product');
const User = require('./models/User');    // Faltava
const Venda = require('./models/Vendas'); // Faltava
const BipagemHistorico = require('./models/BipagemHistorico'); // ✅ Com UM ponto só

// Rotas e Serviços Extras
const ProductRoutes = require('./routes/productRoutes');
const shopeeService = require('./services/shopeeService');


/************************************************
 * 2. INICIALIZAÇÃO DO APP
 ************************************************/
const app = express();

// Configurações Básicas
app.use(cors());
app.use(express.json()); // A linha que estava cortada
app.use(express.urlencoded({ extended: true })); // Importante para formulários normais

// Configuração da Sessão no MySQL (Para manter o login salvo)
const mySessionStore = new SequelizeStore({
    db: sequelize,
});

app.use(session({
    secret: 'segredo_super_secreto_wms', // Pode mudar isso se quiser
    store: mySessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 // 1 dia de duração do login
    }
}));

// Sincroniza a tabela de sessões automaticamente
mySessionStore.sync();

// Correção do erro do ícone (Favicon) que vimos antes
app.get('/favicon.ico', (req, res) => res.status(204).end());

// ... A PARTIR DAQUI VÊM AS SUAS ROTAS (/api/login, /api/vendas, etc) ...
/************************************************
 * CONFIGURAÇÃO DE SESSÃO (MYSQL)
 ************************************************/


// Faz o Express entender que os arquivos do site estão na pasta 'front'
app.use(express.static(path.join(__dirname, '../front')));

// Rota raiz: Se o usuário digitar só o endereço, manda pro Login
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../front/login.html'));
});


app.use(session({
    secret: 'chave-mestra-wms-2026',
    store: mySessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 8, // 8 horas
        secure: false
    }
}));

// Sincroniza a tabela de sessões
mySessionStore.sync();

app.use(session({
    secret: 'chave-mestra-wms-2026', // Use uma frase aleatória sua
    store: mySessionStore,
    resave: false, // Não salva a sessão se não houver mudanças
    saveUninitialized: false, // Não cria sessão para quem não logou
    cookie: {
        maxAge: 1000 * 60 * 60 * 8, // O login dura 8 horas (um turno de trabalho)
        secure: false // Mantenha false se não estiver usando HTTPS (SSL)
    }
}));


// Rota para cadastrar novos funcionários
app.post('/api/register', async (req, res) => {
    try {
        const { username, password, role } = req.body;

        // Verifica se o usuário já existe
        const userExists = await User.findOne({ where: { username } });
        if (userExists) {
            return res.status(400).json({ success: false, message: "Este usuário já existe." });
        }

        // Criptografia da senha
        const hashedPassword = await bcrypt.hash(password, 10);

        // Salva no MySQL
        await User.create({
            username,
            password: hashedPassword,
            role: role || 'estoquista'
        });

        res.json({ success: true, message: "Funcionário cadastrado com sucesso!" });
    } catch (err) {
        res.status(500).json({ success: false, message: "Erro ao cadastrar: " + err.message });
    }
});

// Cria a tabela de sessões no banco automaticamente
mySessionStore.sync();

/************************************************
 * 3. ROTAS DE SISTEMA (Login e Setup)
 ************************************************/
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        console.log(`🔎 Tentativa de login: Usuário [${username}]`);

        const user = await User.findOne({ where: { username } });

        if (!user) {
            console.log("❌ ERRO: Usuário não encontrado no banco de dados.");
            return res.status(401).json({ success: false, message: "Usuário não existe" });
        }

        console.log("✅ Usuário encontrado. Verificando senha...");

        // Verifica a senha
        const senhaValida = await bcrypt.compare(password, user.password);
        console.log(`🔑 A senha bate? ${senhaValida ? "SIM" : "NÃO"}`);

        if (senhaValida) {
            console.log("🚀 Login autorizado! Atualizando banco...");

            await user.update({ last_login: new Date() });
            registrarLog(user.username, 'LOGIN', 'Acesso realizado.');

            req.session.userId = user.id;
            req.session.role = user.role;
            req.session.username = user.username;

            return res.json({ success: true, role: user.role, username: user.username });
        }

        // Se a senha não bater
        registrarLog(username, 'ERRO_LOGIN', 'Senha incorreta.');
        res.status(401).json({ success: false, message: "Senha incorreta" });

    } catch (err) {
        console.error("🔥 ERRO CRÍTICO NO LOGIN:", err);
        res.status(500).json({ success: false, message: "Erro interno" });
    }
});



app.post('/api/logout', async (req, res) => {
    try {
        // Pega os dados ANTES de destruir a sessão
        const userId = req.session.userId;
        const username = req.session.username; // Pega o nome salvo no login

        if (userId) {
            // 1. Grava a hora da saída na tabela users
            await User.update(
                { last_logout: new Date() },
                { where: { id: userId } }
            );

            // 👇 2. GRAVA O HISTÓRICO NA TABELA LOGS 👇
            if (username) {
                registrarLog(username, 'LOGOUT', 'Usuário clicou em sair.');
            }
        }

        // 3. Destrói a sessão
        req.session.destroy((err) => {
            if (err) {
                return res.status(500).json({ success: false, message: "Erro ao fechar sessão" });
            }

            res.clearCookie('connect.sid');
            return res.json({ success: true, message: "Logout realizado e registrado!" });
        });

    } catch (err) {
        console.error("Erro no logout:", err);
        res.status(500).json({ success: false, message: "Erro ao registrar saída" });
    }
});


// Função para registrar QUALQUER coisa no sistema
async function registrarLog(usuario, acao, detalhes) {
    try {
        // 1. Gera a data atual no fuso horário de Brasília (America/Sao_Paulo)
        const dataLocal = new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
        const agoraBrasilia = new Date(dataLocal);

        // 2. Insere no banco usando a data convertida
        await sequelize.query(
            'INSERT INTO logs (usuario, acao, detalhes, data_hora) VALUES (?, ?, ?, ?)',
            {
                replacements: [usuario || 'Sistema', acao, detalhes, agoraBrasilia],
                type: sequelize.QueryTypes.INSERT
            }
        );

        console.log(`📝 Log gravado [Brasília]: ${acao}`);
    } catch (err) {
        console.error("❌ Erro ao registrar log:", err.message);
    }
}

// ROTA DE SETUP (Cria o admin inicial)
app.get('/setup-admin', async (req, res) => {
    try {
        const passwordHash = await bcrypt.hash('123', 10);
        const [user, created] = await User.findOrCreate({
            where: { username: 'admin' },
            defaults: {
                password: passwordHash,
                role: 'admin'
            }
        });

        if (created) {
            res.send("✅ Usuário Admin criado! Usuário: admin / Senha: 123");
        } else {
            res.send("⚠️ O usuário admin já existe.");
        }
    } catch (err) {
        res.status(500).send("❌ Erro: " + err.message);
    }
});


// Middleware para verificar se é Admin
const checkAdmin = (req, res, next) => {
    // Verificamos a sessão que o Node criou no login
    if (req.session.role === 'admin') {
        return next();
    }
    return res.status(403).json({ message: "Acesso negado: Apenas administradores." });
};

// Aplique o checkAdmin nas rotas de Analytics/Vendas
app.get('/api/vendas', checkAdmin, async (req, res) => {
    const vendas = await Venda.findAll();
    res.json(vendas);
});


app.use(session({
    secret: 'chave-mestra-wms-2026',
    store: mySessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 8,
        secure: false
    }
}));

mySessionStore.sync();

// ... o restante das suas rotas (ProductRoutes, etc)

// ==================================================================
// ROTA 1: Autocomplete (Busca por SKU, Nome ou Variação/Localização)
// ==================================================================

app.get('/api/analytics/sku/:sku', async (req, res) => {
    try {
        const { sku } = req.params;
        const skuLimpo = sku.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

        // 1. Busca Inteligente (Pai, Limpo, Localização) - Mantendo sua lógica de busca
        const produto = await Product.findOne({
            where: {
                [Op.or]: [
                    { item_id: sku },
                    { item_id: skuLimpo },
                    { localizacao: { [Op.like]: `%${skuLimpo}%` } },
                    sequelize.where(sequelize.fn('REPLACE', sequelize.col('item_id'), '-', ''), skuLimpo)
                ]
            }
        });

        // 2. Lista de SKUs para buscar vendas
        let listaDeSKUs = [sku];
        if (produto) {
            listaDeSKUs.push(produto.item_id);
            if (produto.localizacao) {
                const apelidos = produto.localizacao.split(/[\s,/]+/).map(s => s.trim());
                listaDeSKUs = [...listaDeSKUs, ...apelidos];
            }
        }
        const skusParaBuscar = [...new Set(listaDeSKUs)].filter(s => s);

        // 3. Busca Vendas dos últimos 30 dias
        const trintaDiasAtras = new Date();
        trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);

        const vendas = await Venda.findAll({
            where: {
                item_id: { [Op.in]: skusParaBuscar },
                data_venda: { [Op.gte]: trintaDiasAtras }
            },
            order: [['data_venda', 'ASC']]
        });

        // --- 4. CÁLCULOS CORRIGIDOS (AQUI ESTÁ A MUDANÇA!) ---

        // Função para somar quantidades de uma lista de vendas
        // Pega cada venda 'v' e soma 'v.quantidade'. Começa do zero.
        const somarQtd = (lista) => lista.reduce((total, v) => total + (v.quantidade || 1), 0);

        const hojeISO = new Date().toISOString().split('T')[0];
        const limiteSemanaISO = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        // Filtra as vendas por data e depois SOMA A QUANTIDADE
        const vHoje = somarQtd(vendas.filter(v => v.data_venda === hojeISO));
        const vSemana = somarQtd(vendas.filter(v => v.data_venda >= limiteSemanaISO));
        const vMes = somarQtd(vendas); // Soma tudo que veio na query (30 dias)

        // --- 5. MONTAGEM DO OBJETO ---
        const p = produto || {
            item_id: sku, nome_produto: "Produto não cadastrado",
            preco_venda: 0, preco_custo: 0, investimento_ads: 0, visualizacoes: 0, estoque_atual: 0, createdAt: null
        };

        // --- 6. FINANCEIRO (Agora usa vMes que é a soma real de itens) ---
        const precoVenda = parseFloat(p.preco_venda) || 0;
        const precoCusto = parseFloat(p.preco_custo) || 0;
        const adsTotal = parseFloat(p.investimento_ads) || 0;
        const visualizacoes = parseInt(p.visualizacoes) || 0;

        const faturamentoTotal = vMes * precoVenda;
        const custoMercadoria = vMes * precoCusto;
        const taxaMkt = faturamentoTotal * 0.18;
        const lucroReal = faturamentoTotal - custoMercadoria - adsTotal - taxaMkt;

        const roas = adsTotal > 0 ? (faturamentoTotal / adsTotal).toFixed(2) : "0.00";
        const investimentoTotal = custoMercadoria + adsTotal;
        const roi = investimentoTotal > 0 ? ((lucroReal / investimentoTotal) * 100).toFixed(1) : 0;

        // --- 7. GRÁFICO E GIRO (Também corrigidos para quantidade) ---
        const giro = p.estoque_atual > 0 ? (vMes / p.estoque_atual) : 0;
        const previsao = (vMes / 30) > 0 ? Math.round(p.estoque_atual / (vMes / 30)) : 999;

        // --- NO BACKEND (app.js do Servidor) ---
        const hist30 = new Array(30).fill(0);
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        vendas.forEach(v => {
            const dataVenda = new Date(v.data_venda + 'T12:00:00'); // Força meio-dia para evitar fuso
            dataVenda.setHours(0, 0, 0, 0);

            const diffMs = hoje.getTime() - dataVenda.getTime();
            const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

            if (diffDias >= 0 && diffDias < 30) {
                hist30[29 - diffDias] += (v.quantidade || 1);
            }
        });

        res.json({
            sku: p.item_id || sku,
            nome: p.nome_produto,
            localizacao: p.localizacao,

            vendasHoje: vHoje,   // Agora deve mostrar a soma de unidades
            vendasSemana: vSemana,
            vendasMes: vMes,     // Agora deve mostrar 10 (se estiverem no prazo)

            estoqueAtual: p.estoque_atual,
            ranking: vMes > 50 ? "A" : (vMes > 10 ? "B" : "C"),

            // Dados Financeiros
            precoMedio: precoVenda,
            precoCusto: precoCusto,
            investimentoAds: adsTotal,
            faturamentoTotal: faturamentoTotal,
            lucroReal: lucroReal,
            roas: roas,
            roi: roi,
            visualizacoes: visualizacoes,

            // Logística
            fornecedor: p.fornecedor,
            dataChegada: p.createdAt ? new Date(p.createdAt).toLocaleDateString('pt-BR') : "N/D",
            diasRestantes: previsao,
            giroEstoque: giro.toFixed(2),

            historico30Dias: hist30, // Gráfico corrigido

            canais: {
                shopee: Math.round(vMes * 0.7),
                ml: Math.round(vMes * 0.2),
                tiktok: Math.round(vMes * 0.1)
            }
        });

    } catch (error) {
        console.error("❌ Erro SKU:", error);
        res.status(500).json({ error: "Erro interno" });
    }
});

// ROTA: DETETIVE DE ÓRFÃOS
// Mostra quais SKUs estão na tabela de Vendas mas NÃO existem na tabela de Produtos
app.get('/api/debug/orfaos', async (req, res) => {
    try {
        // 1. Pega todos os IDs únicos das vendas
        const vendas = await Venda.findAll({
            attributes: [
                [sequelize.fn('DISTINCT', sequelize.col('item_id')), 'sku_venda']
            ],
            raw: true
        });

        const skusVendas = vendas.map(v => v.sku_venda); // Lista: ["D3142", "D-P13CAMUFLADA", ...]

        // 2. Pega todos os IDs dos produtos
        const produtos = await Product.findAll({ attributes: ['item_id'], raw: true });
        const skusProdutos = produtos.map(p => p.item_id);

        // 3. Compara: Quem está na venda e NÃO está no produto?
        const orfaos = skusVendas.filter(sku => !skusProdutos.includes(sku));

        res.json({
            total_orfaos: orfaos.length,
            mensagem: "Estes códigos têm vendas, mas não batem com nenhum produto oficial. Adicione-os na coluna 'localizacao' do produto correto.",
            lista_para_corrigir: orfaos
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});




// ROTA MÁGICA: Auto-corretor de Localização (CORRIGIDO: Tabela Vendas com V maiúsculo)
app.get('/api/fix/auto-associar', async (req, res) => {
    try {
        let corrigidos = 0;
        let erros = [];

        // 1. SQL Corrigido: Usa 'Vendas' com V maiúsculo
        // NOTA: Se der erro na tabela 'produtos', troque para 'Produtos' na linha do LEFT JOIN
        const [vendasOrfas] = await sequelize.query(`
            SELECT DISTINCT v.item_id 
            FROM Vendas v 
            LEFT JOIN produtos p ON v.item_id = p.item_id 
            WHERE p.item_id IS NULL
        `);

        console.log(`🔎 Encontrados ${vendasOrfas.length} códigos de vendas órfãos.`);

        // 2. Para cada venda órfã, tenta achar o pai
        for (const venda of vendasOrfas) {
            const skuOrfao = venda.item_id; // Ex: "D3142"

            // Cria a versão "limpa" (Sem traço, espaço, ponto)
            const skuLimpo = skuOrfao.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

            // Tenta achar um produto oficial que, se limpar, fica igual a esse
            const produtoPai = await Product.findOne({
                where: sequelize.where(
                    sequelize.fn('REPLACE', sequelize.col('item_id'), '-', ''),
                    skuLimpo
                )
            });

            if (produtoPai) {
                let novaLocalizacao = produtoPai.localizacao || "";

                // Só adiciona se já não estiver lá
                if (!novaLocalizacao.includes(skuOrfao)) {
                    novaLocalizacao = novaLocalizacao ? `${novaLocalizacao}, ${skuOrfao}` : skuOrfao;

                    await produtoPai.update({ localizacao: novaLocalizacao });
                    console.log(`✅ Associado: ${skuOrfao} -> Pai: ${produtoPai.item_id}`);
                    corrigidos++;
                }
            } else {
                erros.push(skuOrfao);
            }
        }

        res.json({
            status: "Sucesso!",
            total_processado: vendasOrfas.length,
            corrigidos_automaticamente: corrigidos,
            ficaram_para_fazer_manual: erros.length,
            lista_manual: erros
        });

    } catch (error) {
        console.error("❌ Erro no Auto-Fix:", error);
        res.status(500).json({ error: error.message, dica: "Verifique se a tabela 'produtos' também não começa com maiúscula" });
    }
});

// ==========================================
// ROTA PARA REGISTRAR VENDAS DO ANALYTICS
// ==========================================



// --- ROTA PARA BUSCAR O HISTÓRICO (GET /api/vendas) ---
app.get('/api/vendas', async (req, res) => {
    try {
        const historico = await Venda.findAll({
            order: [['data_venda', 'DESC']]
        });
        res.json(historico);
    } catch (error) {
        console.error("Erro ao buscar vendas:", error);
        res.status(500).json({ error: "Erro ao buscar dados no banco" });
    }
});

// --- ROTA DE ATALHO (GET /api/vendas-historico) ---
// Criamos essa rota apenas para garantir que a sua função antiga não dê erro 404
app.get('/api/vendas-historico', async (req, res) => {
    try {
        const historico = await Venda.findAll({
            order: [['data_venda', 'DESC']]
        });
        res.json(historico);
    } catch (error) {
        res.status(500).json({ error: "Erro no servidor" });
    }
});

app.post('/api/vendas', async (req, res) => {
    try {
        // 1. RECEBE O DADO EXATO QUE O FRONTEND MANDOU
        // Se o frontend mandou "D-P12-D)", nós usamos "D-P12-D)"
        const { item_id, quantidade, data_venda, hora_venda, plataforma, cliente_nome } = req.body;

        // 2. REGISTRA A VENDA (Com o ID original, para não quebrar a chave estrangeira)
        await Venda.create({
            item_id: item_id, // 👈 SEM .replace(), usa o original!
            quantidade: Number(quantidade),
            data_venda,
            hora_venda,
            plataforma,
            cliente_nome
        });

        // 3. BAIXA O ESTOQUE
        // Usamos findByPk (Find By Primary Key) que é mais rápido e seguro
        const produto = await Product.findByPk(item_id);

        if (produto) {
            // O Sequelize tem uma função pronta para diminuir valores (decrement)
            // Ela evita números negativos e erros de cálculo
            await produto.decrement('estoque_atual', { by: Number(quantidade) });
            console.log(`✅ Estoque baixado: ${item_id} (-${quantidade})`);
        } else {
            console.warn(`⚠️ Venda registrada, mas produto ${item_id} não achado para baixar estoque.`);
        }

        res.status(201).json({ success: true, message: "Venda e Estoque processados" });

    } catch (error) {
        console.error("❌ Erro no Servidor (Rota Vendas):", error.message);
        // Retorna o erro exato para ajudar a gente a debugar se precisar
        res.status(500).json({ error: error.message });
    }
});



// ==========================================
// ROTA PARA ARQUIVAR (NO ARQUIVO src/app.js)
// ==========================================
app.put('/api/produtos/archive/:id', async (req, res) => {
    try {
        const productId = req.params.id;
        // 🟢 Pegamos o usuário que veio do Frontend
        const { usuario } = req.body;

        console.log(`📥 Recebido pedido para arquivar: ${productId} por ${usuario}`);

        const [linhasAfetadas] = await Product.update(
            { status: 'inativo' },
            { where: { item_id: productId } }
        );

        if (linhasAfetadas > 0) {
            // 👇 REGISTRO DE AUDITORIA 👇
            // Aqui buscamos o SKU/Nome se quiser detalhes mais ricos, 
            // mas o ID já resolve o rastro básico.
            registrarLog(usuario, 'ARQUIVAR_PRODUTO', `Arquivou o item ID: ${productId}`);

            console.log("✅ Sucesso no banco!");
            return res.json({ message: "Produto arquivado com sucesso!" });
        } else {
            console.warn("⚠️ Produto não encontrado no banco.");
            return res.status(404).json({ message: "Produto não encontrado." });
        }

    } catch (error) {
        console.error("❌ Erro ao arquivar (Sequelize):", error);
        res.status(500).send(error.message);
    }
});


// ==========================================
// ROTA PARA SUGESTÕES (AUTOCOMPLETE)
// ==========================================
app.get('/api/products/search', async (req, res) => {
    try {
        const termo = req.query.q;
        if (!termo) return res.json([]);

        const termoLimpo = termo.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

        const produtos = await Product.findAll({
            where: {
                status: 'ativo', // 👈 REGRA DE OURO: Só traz quem não foi arquivado
                [Op.or]: [
                    { item_id: { [Op.like]: `%${termo}%` } },
                    { nome_produto: { [Op.like]: `%${termo}%` } },
                    { localizacao: { [Op.like]: `%${termoLimpo}%` } },
                    sequelize.where(sequelize.fn('REPLACE', sequelize.col('item_id'), '-', ''), { [Op.like]: `%${termoLimpo}%` })
                ]
            },
            limit: 8,
            attributes: ['item_id', 'nome_produto']
        });

        res.json(produtos);
    } catch (error) {
        console.error("❌ Erro na busca:", error);
        res.status(500).json({ error: "Erro interno" });
    }
});


app.post('/api/add', async (req, res) => {
    try {
        const { nome_produto, item_id, localizacao, estoque_atual } = req.body;

        // 👇 Tenta pegar do Link (query) OU do Corpo (body)
        const usuario = req.query.usuario || req.body.usuario || 'Sistema';

        await Produto.create({ nome_produto, item_id, localizacao, estoque_atual });

        // Grava o Log
        await registrarLog(usuario, 'CRIAR_PRODUTO', `Adicionou: ${item_id}`);

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});



// Procure pela rota de edição:
app.put('/api/edit/:item_id', async (req, res) => {
    try {
        const { item_id } = req.params;

        // 1. Pega os dados do produto do corpo
        const { nome_produto, localizacao, estoque_atual } = req.body;

        // 👇 AQUI ESTÁ A MUDANÇA DE SEGURANÇA 👇
        // O servidor tenta achar o nome em 3 lugares (Link, JSON ou Sessão)
        const usuarioFinal = req.query.usuario || req.body.usuario || req.session.username || 'Sistema';

        // 2. Atualiza o banco
        const [linhasAfetadas] = await Product.update(
            {
                nome_produto: nome_produto,
                localizacao: localizacao,
                estoque_atual: estoque_atual
            },
            { where: { item_id: item_id } }
        );

        if (linhasAfetadas > 0) {
            // 3. Usa o 'usuarioFinal' que garantimos que não está vazio
            await registrarLog(usuarioFinal, 'EDITAR_PRODUTO', `Editou item: ${nome_produto} (ID: ${item_id}) | Estoque: ${estoque_atual}`);

            return res.json({ success: true, message: "Produto atualizado!" });
        }

        res.status(404).json({ success: false, message: "Produto não encontrado" });

    } catch (error) {
        console.error("Erro ao editar:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ROTA DELETE (Substitua a sua atual)
// ROTA DE DELETE (No app.js)
app.delete('/api/delete/:item_id', async (req, res) => {
    try {
        const { item_id } = req.params;

        // 👇 MUDANÇA VITAL: O servidor agora olha PRIMEIRO para a URL (?usuario=...)
        // req.query pega o que você mandou no Frontend via ?usuario=
        const usuarioFinal = req.query.usuario || req.body.usuario || 'Sistema';

        const product = await Product.findOne({ where: { item_id } });

        if (!product) {
            return res.status(404).json({ success: false, message: "Não encontrado" });
        }

        // Deleta do banco
        await product.destroy();

        // Grava o log com o nome que capturamos da URL
        await registrarLog(usuarioFinal, 'ARQUIVAR_PRODUTO', `Removeu o item ID: ${item_id}`);

        res.json({ success: true });
    } catch (err) {
        console.error("Erro no delete:", err);
        res.status(500).json({ success: false });
    }
});

// Rota para o Log de Saída e outras operações manuais
app.post('/api/log-operacao', async (req, res) => {
    try {
        const { usuario, acao, detalhes } = req.body;

        // Grava o log no MySQL
        await registrarLog(usuario || 'Desconhecido', acao, detalhes);

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

// Rota genérica para receber logs de ações do Frontend (como o PDF)
app.post('/api/log-operacao', async (req, res) => {
    try {
        const { usuario, acao, detalhes } = req.body;

        // Aqui sim, chamamos a função que escreve no MySQL
        await registrarLog(usuario, acao, detalhes);

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

// ROTA ESPECIAL PARA LOG DE SAÍDA
// 👇 CORREÇÃO: Usamos 'app' e adicionamos '/api'
app.post('/api/log-saida', async (req, res) => {
    const { usuario, acao, detalhes } = req.body;

    // Chama a função registrarLog que já existe no seu app.js
    // (O 'await' é bom para garantir que dê tempo de salvar antes de fechar)
    await registrarLog(usuario || 'Desconhecido', 'SAIDA_SISTEMA', 'Usuário fechou o navegador');

    res.status(200).send('OK');
});

// 2. A sua rota de salvar
app.post('/logistica/registrar', async (req, res) => {
    try {
        const { sku, status, motorista, placa, fornecedor } = req.body;

        // Pega data e hora exatas do momento da bipagem
        const agora = new Date();
        const dataHoje = agora.toISOString().split('T')[0];
        const horaAgora = agora.toTimeString().split(' ')[0];

        // Salva na tabela bipagens_historico
        const novoRegistro = await BipagemHistorico.create({
            sku: sku,
            status: status,
            motorista: motorista,
            placa: placa,
            fornecedor: fornecedor || "Padrão",
            data_registro: dataHoje,
            horario: horaAgora
        });

        res.json({ success: true, id: novoRegistro.id });
    } catch (error) {
        console.error("Erro ao salvar bipagem:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});


// Rota para buscar o histórico de bipagens
app.get('/api/logistica/historico', async (req, res) => {
    try {
        // ✅ REMOVIDO: limit: 50 - Agora busca TODOS os registros do dia
        // (Se quiser limitar por data, use o filtro abaixo)
        const hoje = new Date().toISOString().split('T')[0]; // Formato YYYY-MM-DD

        const historico = await BipagemHistorico.findAll({
            where: {
                data_registro: hoje // Filtra apenas registros de HOJE
            },
            order: [['id', 'DESC']] // Mais recentes primeiro
        });

        console.log(`📊 Histórico de hoje (${hoje}): ${historico.length} registros total`);
        res.json(historico);
    } catch (error) {
        console.error("Erro ao buscar histórico:", error);
        res.status(500).json({ error: error.message });
    }
});



app.get('/api/logistica/contagem-hoje', async (req, res) => {
    try {
        const hoje = new Date().toISOString().split('T')[0]; // Formato YYYY-MM-DD

        const contagem = await BipagemHistorico.count({
            where: {
                data_registro: hoje // Filtra pela coluna de data que criamos
            }
        });

        console.log(`📊 Contagem de hoje (${hoje}): ${contagem}`);
        res.json({ total: contagem }); // Retorna um objeto JSON
    } catch (error) {
        console.error("Erro na contagem:", error);
        res.status(500).json({ error: error.message });
    }
});


// 2. ROTAS DE API
app.use('/products', ProductRoutes);
// app.use('/vendas', VendaRoutes); // se tiver

// 3. ARQUIVOS ESTÁTICOS (Sempre por último)
app.use(express.static(path.join(__dirname, "../front")));

// 4. INICIALIZAÇÃO
sequelize.sync({ alter: true }).then(() => {
    app.listen(3000, () => console.log(`🚀 Servidor rodando em http://localhost:3000`));
});

