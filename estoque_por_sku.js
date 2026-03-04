const crypto = require('crypto');
const axios = require('axios');

const partnerId = 1223323;
const partnerKey = "shpk7861717a4b716741504d575449464f4f4544715753424a4d6e7161564356";
const accessToken = "55645a6348656341654c61785464777a";
const shopId = 226723333;
const host = "https://openplatform.sandbox.test-stable.shopee.sg";
const path = "/api/v2/product/update_stock_by_sku"; // Endpoint diferente!

async function atualizarPeloSku() {
    const timestamp = Math.floor(Date.now() / 1000);
    const baseString = `${partnerId}${path}${timestamp}${accessToken}${shopId}`;
    const sign = crypto.createHmac('sha256', partnerKey).update(baseString).digest('hex');
    const url = `${host}${path}?partner_id=${partnerId}&timestamp=${timestamp}&sign=${sign}&access_token=${accessToken}&shop_id=${shopId}`;

    const body = {
        "stock_set_list": [
            {
                "item_sku": "WD-015LILÁS", // O SKU que você cadastrou no painel
                "normal_stock": 666
            }
        ]
    };

    try {
        const res = await axios.post(url, body);
        console.log("📡 Resposta da tentativa por SKU:");
        console.log(JSON.stringify(res.data, null, 2));
    } catch (err) {
        console.error("❌ Erro:", err.response ? err.response.data : err.message);
    }
}
atualizarPeloSku();