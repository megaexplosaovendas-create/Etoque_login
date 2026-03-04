const crypto = require('crypto');
const axios = require('axios');

const partnerId = 1223323;
const partnerKey = "shpk7861717a4b716741504d575449464f4f4544715753424a4d6e7161564356";
const accessToken = "55645a6348656341654c61785464777a";
const shopId = 226723333;
const host = "https://openplatform.sandbox.test-stable.shopee.sg";
const path = "/api/v2/product/get_model_list";

async function checar() {
    const timestamp = Math.floor(Date.now() / 1000);
    const baseString = `${partnerId}${path}${timestamp}${accessToken}${shopId}`;
    const sign = crypto.createHmac('sha256', partnerKey).update(baseString).digest('hex');
    
    const url = `${host}${path}?partner_id=${partnerId}&timestamp=${timestamp}&sign=${sign}&access_token=${accessToken}&shop_id=${shopId}&item_id=885176963`;

    try {
        const response = await axios.get(url);
        const estoqueAtual = response.data.response.model[0].stock_info[0].normal_stock;
        console.log(`📊 No Servidor da Shopee, o estoque atual é: ${estoqueAtual}`);
    } catch (err) {
        console.error("❌ Erro ao checar:", err.message);
    }
}
checar();