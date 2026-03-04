const crypto = require('crypto');
const axios = require('axios');

const partnerId = 1223323;
const partnerKey = "shpk7861717a4b716741504d575449464f4f4544715753424a4d6e7161564356";
const accessToken = "55645a6348656341654c61785464777a";
const shopId = 226723333;
const host = "https://openplatform.sandbox.test-stable.shopee.sg";

async function atualizarEstoque() {
    const path = "/api/v2/product/update_stock";
    const timestamp = Math.floor(Date.now() / 1000);
    const baseString = `${partnerId}${path}${timestamp}${accessToken}${shopId}`;
    const sign = crypto.createHmac('sha256', partnerKey).update(baseString).digest('hex');
    const url = `${host}${path}?partner_id=${partnerId}&timestamp=${timestamp}&sign=${sign}&access_token=${accessToken}&shop_id=${shopId}`;

    const body = {
        item_id: 885176963,
        stock_set_list: [{
            model_id: 18500765000,
            normal_stock: 666
        }]
    };

    try {
        const res = await axios.post(url, body);
        console.log("-----------------------------------------");
        if (res.data.response && res.data.response.success_list?.length > 0) {
            console.log("✅ AGORA FOI, JONE! Estoque alterado para 666.");
        } else {
            console.log("⚠️ Resposta do servidor:");
            console.log(JSON.stringify(res.data, null, 2));
        }
    } catch (err) {
        console.error("❌ Erro:", err.message);
    }
}
atualizarEstoque();