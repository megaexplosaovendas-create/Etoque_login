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
    document.getElementById('c-total').innerText = sessionScans.length;
    document.getElementById('c-ok').innerText = sessionScans.filter(s => s.status === 'ok').length;
    document.getElementById('c-cancel').innerText = sessionScans.filter(s => s.status === 'cancel').length;
    document.getElementById('c-dup').innerText = sessionScans.filter(s => s.status === 'dup').length;
}

function updateTable() {
    const tbody = document.querySelector("#historyTable tbody");
    tbody.innerHTML = sessionScans.slice(0, 10).map(s =>
        `<tr><td>${s.code}</td><td style="color:${s.status === 'cancel' ? 'red' : (s.status === 'dup' ? 'orange' : 'green')}">${s.msg}</td><td>${s.time}</td></tr>`
    ).join('');
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

// 👇 AQUI: Função carregarHistorico com o endereço completo!
async function carregarHistoricoBanco() {
    try {
        const response = await fetch(`${API_URL}/api/logistica/historico`);
        const dados = await response.json();

        sessionScans = [];

        dados.forEach(item => {
            let statusCode = 'ok';
            if (item.status === 'CANCELADO!') statusCode = 'cancel';
            if (item.status === 'DUPLICADO') statusCode = 'dup';

            sessionScans.push({
                code: item.sku,
                status: statusCode,
                msg: item.status,
                time: item.horario 
            });
        });

        updateTable();
        updateStats();

        console.log("✅ Histórico carregado do banco de dados!");
    } catch (erro) {
        console.error("❌ Erro ao carregar histórico do banco:", erro);
    }
}

const html5QrCode = new Html5Qrcode("reader");
html5QrCode.start({ facingMode: "environment" }, { fps: 15, qrbox: { width: 250, height: 150 } }, onScanSuccess);

window.onload = () => {
    setTimeout(sincronizarDados, 1000); 
    carregarHistoricoBanco();           
};