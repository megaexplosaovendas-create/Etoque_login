let cancelledDB = [];
let sessionScans = JSON.parse(localStorage.getItem('scans_v4')) || [];
let isLocked = false;
const NOME_ARQUIVO_EXCEL = "cancelados.xlsx";

// URL base da sua API Node.js (Ajuste a porta 3000 se o seu servidor rodar em outra)
const API_URL = "http://localhost:3000";

updateTable();
updateStats();

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playTone(freq, type, duration) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type; osc.frequency.value = freq;
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(); gain.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + duration);
    osc.stop(audioCtx.currentTime + duration);
}

async function sincronizarDados() {
    const statusEl = document.getElementById('dbStatus');
    statusEl.innerText = "⏳ Sincronizando...";
    try {
        const res = await fetch(NOME_ARQUIVO_EXCEL + '?v=' + new Date().getTime());
        if (!res.ok) throw new Error("Arquivo não encontrado!");
        const arrayBuffer = await res.arrayBuffer();
        const wb = XLSX.read(arrayBuffer, { type: 'array' });
        const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

        cancelledDB = data.map(row => {
            let val = row['ID do pedido'] || row['ID do Pedido'] || row['Nº de Rastreio'] || row['Rastreio'];
            return String(val || "").trim().toUpperCase();
        }).filter(v => v !== "");

        statusEl.innerText = `✅ Sucesso: ${cancelledDB.length} itens carregados.`;
        statusEl.style.color = "green";
    } catch (e) {
        statusEl.innerText = "❌ Erro ao baixar planilha: " + e.message;
        statusEl.style.color = "red";
    }
}

function onScanSuccess(decodedText) {
    if (isLocked) return;
    isLocked = true;

    const lido = String(decodedText).trim().toUpperCase();
    let status = 'ok', msg = 'LIBERADO', css = 'bg-ok';

    if (sessionScans.some(s => s.code === lido)) {
        status = 'dup'; msg = 'DUPLICADO'; css = 'bg-dup';
        playTone(600, 'square', 0.2);
    }
    else {
        const encontrado = cancelledDB.some(planilha => {
            return planilha.includes(lido) || lido.includes(planilha);
        });

        if (encontrado) {
            status = 'cancel'; msg = 'CANCELADO!'; css = 'bg-cancel';
            playTone(150, 'sawtooth', 0.8);
        } else {
            playTone(1000, 'sine', 0.2);
        }
    }

    saveScan(lido, status, msg);
    const box = document.getElementById('result-box');
    box.className = css;
    box.innerHTML = `<div>${msg}</div><div style="font-size:0.9rem">${lido}</div>`;

    setTimeout(() => {
        isLocked = false;
        box.className = "bg-idle";
        box.innerHTML = "Aguardando Bipagem";
    }, 1800);
}

// 👇 AQUI: Função saveScan 100% atualizada para o MySQL!
async function saveScan(code, status, msg) {
    sessionScans.unshift({ code, status, msg, time: new Date().toLocaleTimeString() });
    localStorage.setItem('scans_v4', JSON.stringify(sessionScans));

    const motorista = document.getElementById('motorista').value || 'Não informado';
    const placa = document.getElementById('placa').value || 'Não informada';

    try {
        const response = await fetch(`${API_URL}/api/logistica/registrar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sku: code,
                status: msg,
                motorista: motorista,
                placa: placa,
                fornecedor: "Padrão"
            })
        });

        const result = await response.json();
        if (result.success) {
            console.log("✅ Salvo no MySQL com ID:", result.id);
        }
    } catch (erro) {
        console.error("❌ Erro de conexão com o banco ao salvar:", erro);
    }

    updateTable();
    updateStats();
}

function updateStats() {
    try {
        const totalEl = document.getElementById('c-total');
        const okEl = document.getElementById('c-ok');
        const cancelEl = document.getElementById('c-cancel');
        const dupEl = document.getElementById('c-dup');

        if (!totalEl || !okEl || !cancelEl || !dupEl) {
            console.error("❌ Um ou mais elementos de estatísticas não encontrados no HTML!");
            console.log("  Procurando por: #c-total, #c-ok, #c-cancel, #c-dup");
            return;
        }

        const total = sessionScans.length;
        const ok = sessionScans.filter(s => s.status === 'ok').length;
        const cancel = sessionScans.filter(s => s.status === 'cancel').length;
        const dup = sessionScans.filter(s => s.status === 'dup').length;

        totalEl.innerText = total;
        okEl.innerText = ok;
        cancelEl.innerText = cancel;
        dupEl.innerText = dup;

        console.log(`📊 Estatísticas atualizadas: Total=${total}, OK=${ok}, Cancelado=${cancel}, Duplicado=${dup}`);
    } catch (error) {
        console.error("❌ Erro ao atualizar estatísticas:", error);
    }
}

function updateTable() {
    try {
        const tableBody = document.querySelector("#historyTable tbody");

        if (!tableBody) {
            console.error("❌ Elemento #historyTable tbody não encontrado no HTML!");
            return;
        }

        if (sessionScans.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#999;">Nenhum registro</td></tr>';
            return;
        }

        tableBody.innerHTML = sessionScans.slice(0, 10).map(s => {
            const cor = s.status === 'cancel' ? 'red' : (s.status === 'dup' ? 'orange' : 'green');
            return `<tr>
                <td>${s.code}</td>
                <td style="color:${cor}; font-weight:bold;">${s.msg}</td>
                <td>${s.time}</td>
            </tr>`;
        }).join('');

        console.log(`📋 Tabela atualizada com ${Math.min(sessionScans.length, 10)} registros visíveis`);
    } catch (error) {
        console.error("❌ Erro ao atualizar tabela:", error);
    }
}

function clearData() {
    if (confirm('Limpar dados da sessão?')) {
        sessionScans = [];
        localStorage.removeItem('scans_v4');
        updateTable();
        updateStats();
    }
}

function gerarPDF() {
    // ... [Código do PDF mantido intacto] ...
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const dataHoje = new Date().toLocaleDateString();

    doc.setFontSize(16);
    doc.text("Relatório de Conferência de Carga", 105, 15, { align: "center" });

    doc.setFontSize(10);
    doc.text(`Motorista: ${document.getElementById('motorista').value || 'Não informado'}`, 15, 25);
    doc.text(`CPF: ${document.getElementById('cpf').value || 'Não informado'}`, 15, 30);
    doc.text(`Placa: ${document.getElementById('placa').value || 'Não informado'}`, 15, 35);

    doc.autoTable({
        head: [['Código', 'Status Final', 'Hora']],
        body: sessionScans.map(s => [s.code, s.msg, s.time]),
        startY: 45,
        headStyles: { fillColor: [44, 62, 80] }
    });

    const finalY = doc.lastAutoTable.finalY + 20;
    doc.text(`São Paulo, ${dataHoje}`, 15, finalY);

    const sigLine = "_____________________";
    doc.text(sigLine, 15, finalY + 25);
    doc.text("Estoque", 15, finalY + 30);

    doc.text(sigLine, 80, finalY + 25);
    doc.text("Motorista", 80, finalY + 30);

    doc.text("___________________", 145, finalY + 25);
    doc.text("CPF", 145, finalY + 30);

    doc.text("_______________", 180, finalY + 25, { align: 'right' });
    doc.text("Placa", 180, finalY + 30, { align: 'right' });

    doc.save(`conferencia_${dataHoje.replace(/\//g, '-')}.pdf`);
}

let barcodeBuffer = "";
let lastKeyTime = Date.now();

document.addEventListener('keydown', (e) => {
    const target = e.target;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

    const currentTime = Date.now();
    if (currentTime - lastKeyTime > 200) {
        barcodeBuffer = "";
    }
    lastKeyTime = currentTime;

    if (e.key === "Enter") {
        if (barcodeBuffer.length > 1) {
            onScanSuccess(barcodeBuffer);
            barcodeBuffer = "";
        }
    } else {
        if (e.key.length === 1) {
            barcodeBuffer += e.key;
        }
    }
});

// 👇 AQUI: Função carregarHistorico com SUPORTE COMPLETO ao formato do banco!
async function carregarDashboardLogistica() {
    console.log("📊 Atualizando Dashboard de Logística...");
    try {
        const response = await fetch('http://localhost:3000/api/logistica/historico');
        const dados = await response.json();

        if (!dados || dados.length === 0) {
            console.warn("⚠️ Nenhum dado de bipagem encontrado para hoje");
            return;
        }

        console.log(`📦 Total de bipes do dia: ${dados.length}`);

        // 1. Atualizar o Total Bipado (VALOR REAL DO DIA)
        const totalBipes = dados.length;
        document.getElementById('totalBipesHoje').innerText = totalBipes;
        console.log(`  ✓ Total bipado atualizado: ${totalBipes}`);

        // 2. Calcular Assertividade (Liberados vs Total)
        const liberados = dados.filter(item => {
            const status = String(item.status || "").toUpperCase();
            return status.includes('LIBERADO') || status === 'OK';
        }).length;

        const taxa = totalBipes > 0 ? ((liberados / totalBipes) * 100).toFixed(1) : 0;
        document.getElementById('taxaAssertividade').innerText = `${taxa}%`;
        console.log(`  ✓ Assertividade: ${liberados}/${totalBipes} = ${taxa}%`);

        // 3. Atualizar a Tabela de Auditoria (logTbody) - MOSTRAR TODOS OS REGISTROS COM SCROLL
        const tbody = document.getElementById('logTbody');

        if (!tbody) {
            console.error("❌ Elemento #logTbody não encontrado!");
            return;
        }

        const tabelaHTML = dados.map((item, index) => {
            // Define a cor do status para facilitar a leitura
            let corStatus = '#10b981'; // Verde para Liberado
            const statusStr = String(item.status || "").toUpperCase();

            if (statusStr.includes('CANCELADO')) corStatus = '#ef4444'; // Vermelho
            else if (statusStr.includes('DUPLICADO')) corStatus = '#f59e0b'; // Laranja

            const horario = item.horario || '--:--';
            const sku = item.sku || 'N/A';
            const status = item.status || 'Desconhecido';

            return `
                <tr style="border-bottom: 1px solid #f0f0f0;">
                    <td style="padding: 8px; font-size: 0.9em;">${horario}</td>
                    <td style="padding: 8px; font-size: 0.9em; font-weight: bold;">${sku}</td>
                    <td style="padding: 8px; color: ${corStatus}; font-weight: bold;">${status}</td>
                </tr>
            `;
        }).join('');

        tbody.innerHTML = tabelaHTML;
        console.log(`  ✓ Tabela atualizada com ${totalBipes} registros visíveis`);

        // 4. Calcular Ritmo (Bipes na última hora)
        const agora = new Date();
        const umaHoraAtras = new Date(agora.getTime() - 60 * 60 * 1000);

        const bipeUltimaHora = dados.filter(item => {
            if (!item.horario) return false;

            try {
                const [horas, minutos, segundos] = item.horario.split(':').map(Number);
                const horaBipe = new Date();
                horaBipe.setHours(horas, minutos, segundos || 0);

                return horaBipe >= umaHoraAtras && horaBipe <= agora;
            } catch (e) {
                return false;
            }
        }).length;

        document.getElementById('ritmoBipagem').innerText = bipeUltimaHora;
        console.log(`  ✓ Ritmo última hora: ${bipeUltimaHora} bipes`);

        // 5. Atualizar cores do card de assertividade
        const cardAssert = document.getElementById('cardAssertividade');
        const txtStatus = document.getElementById('txtErroStatus');

        if (cardAssert && txtStatus) {
            if (taxa < 95) {
                cardAssert.style.borderLeft = "5px solid #ef4444";
                txtStatus.innerText = `⚠️ Atenção: ${(100 - taxa).toFixed(1)}% de erro`;
                txtStatus.style.color = "#ef4444";
            } else {
                cardAssert.style.borderLeft = "5px solid #10b981";
                txtStatus.innerText = "✅ Operação saudável";
                txtStatus.style.color = "#10b981";
            }
        }

        console.log("✅ Dashboard sincronizado com o MySQL!");
    } catch (erro) {
        console.error("❌ Erro ao alimentar analytics:", erro);
        console.error("   Stack trace:", erro.stack);
    }
}

// Inicia a atualização quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    carregarDashboardLogistica();
    // Atualiza automaticamente a cada 30 segundos para manter o dashboard vivo
    setInterval(carregarDashboardLogistica, 30000);
});


const html5QrCode = new Html5Qrcode("reader");
html5QrCode.start({ facingMode: "environment" }, { fps: 15, qrbox: { width: 250, height: 150 } }, onScanSuccess);

window.onload = () => {
    setTimeout(sincronizarDados, 1000);
    carregarHistoricoBanco();
};