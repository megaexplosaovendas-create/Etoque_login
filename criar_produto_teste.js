const crypto = require('crypto');
const axios = require('axios');

const partnerId = 1223323;
const partnerKey = "shpk7861717a4b716741504d575449464f4f4544715753424a4d6e7161564356";
const accessToken = "55645a6348656341654c61785464777a";
const shopId = 226723333;
const host = "https://openplatform.sandbox.test-stable.shopee.sg";
const path = "/api/v2/product/add_item";

async function criarProduto() {
    const timestamp = Math.floor(Date.now() / 1000);
    const baseString = `${partnerId}${path}${timestamp}${accessToken}${shopId}`;
    const sign = crypto.createHmac('sha256', partnerKey).update(baseString).digest('hex');

    const url = `${host}${path}?partner_id=${partnerId}&timestamp=${timestamp}&sign=${sign}&access_token=${accessToken}&shop_id=${shopId}`;

    // Estrutura mínima aceita pela API V2 no Sandbox
    const body = {
        "item_name": "Fone de Ouvido Teste Mega Explosao",
        "description": "Teste de integracao de estoque via API Nodejs.",
        "item_sku": "WD-015LILÁS", 
        "category_id": 107289, // ID que seu sistema já encontrou como válido
        "brand": { "brand_id": 0, "original_brand_name": "NoBrand" },
        "original_price": 50.00,
        "weight": 0.5,
        "item_status": "NORMAL",
        "description_type": "normal",
        "logistic_info": [{ "enabled": true, "logistic_id": 80003 }], // ID padrão de logística do Sandbox
        "seller_stock": [{ "stock": 10 }] // Aqui corrigimos o erro de 'seller_stock must not null'
    };

    try {
        const response = await axios.post(url, body);
        console.log("🚀 Resposta da Shopee:");
        console.log(JSON.stringify(response.data, null, 2));
    } catch (err) {
        console.error("❌ Erro ao criar:", err.response ? err.response.data : err.message);
    }
}

criarProduto();