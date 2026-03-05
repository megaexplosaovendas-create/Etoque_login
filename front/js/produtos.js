// Exemplo de dados vindos do seu banco
const mockProducts = [
    { nome_produto: "MacbookPro15' 2019", model_id: "SKU 345-091", estoque_atual: 4890, preco_venda: 2700, fornecedor: "Electronics", imagem_url: "https://via.placeholder.com/50" },
    { nome_produto: "Microsoft Surface", model_id: "SKU 345-096", estoque_atual: 3250, preco_venda: 1950, fornecedor: "Electronics", imagem_url: "https://via.placeholder.com/50" }
];

function renderList() {
    const listContainer = document.getElementById('product-list');
    listContainer.innerHTML = mockProducts.map(p => `
        <div class="product-row">
            <div class="col-check"><input type="checkbox"></div>
            <div class="product-info">
                <img src="${p.imagem_url}" class="product-img">
                <div class="product-meta">
                    <b>${p.nome_produto}</b>
                    <span>${p.model_id}</span>
                </div>
            </div>
            <div>
                <span class="val-bold">1.368</span>
                <span class="label-sub">Sales</span>
            </div>
            <div>
                <span class="val-bold">${p.estoque_atual}</span>
                <span class="label-sub">Qty.</span>
            </div>
            <div>
                <span class="val-bold">4.2 / 5.0</span>
                <span class="label-sub">Rating</span>
            </div>
            <div>
                <span class="val-bold">$${p.preco_venda.toLocaleString()}</span>
                <span class="label-sub">Price</span>
            </div>
            <div>
                <span class="tag-badge">${p.fornecedor}</span>
            </div>
            <div class="col-more">
                <button style="border:none; background:none; color:#cbd5e1;">...</button>
            </div>
        </div>
    `).join('');
}

// Funções de Modal
function openModal() { document.getElementById('modal-product').style.display = 'flex'; }
function closeModal() { document.getElementById('modal-product').style.display = 'none'; }

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    renderList();
    
    // Simulação para abrir o modal clicando em algum lugar (você pode por um botão de "Add")
    // openModal(); 
});