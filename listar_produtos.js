const crypto = require('crypto');
const axios = require('axios');

const partnerId = 1223323;
const partnerKey = "shpk7861717a4b716741504d575449464f4f4544715753424a4d6e7161564356";
const accessToken = "55645a6348656341654c61785464777a";
const shopId = 226723333;
const host = "https://openplatform.sandbox.test-stable.shopee.sg";
const path = "/api/v2/product/get_item_list"; // Mudamos para listar PRODUTOS

async function listarMeusProdutos() {
    const timestamp = Math.floor(Date.now() / 1000);
    const baseString = `${partnerId}${path}${timestamp}${accessToken}${shopId}`;
    const sign = crypto.createHmac('sha256', partnerKey).update(baseString).digest('hex');
    
    // Filtramos apenas por produtos ATIVOS (NORMAL)
    const url = `${host}${path}?partner_id=${partnerId}&timestamp=${timestamp}&sign=${sign}&access_token=${accessToken}&shop_id=${shopId}&item_status=NORMAL`;

    try {
        const response = await axios.get(url);
        console.log("📦 Produtos encontrados no seu Sandbox:");
        console.log(JSON.stringify(response.data.response.item, null, 2));
    } catch (err) {
        console.error("❌ Erro ao buscar produtos:", err.message);
    }
}

listarMeusProdutos();