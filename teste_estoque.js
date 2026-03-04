const crypto = require('crypto');
const axios = require('axios');

const partnerId = 1223323;
const partnerKey = "shpk7861717a4b716741504d575449464f4f4544715753424a4d6e7161564356";
const accessToken = "55645a6348656341654c61785464777a";
const shopId = 226723333;
const host = "https://openplatform.sandbox.test-stable.shopee.sg";

async function atualizarEstoqueVariação() {
    // ATENÇÃO: Mudamos o path para 'v2.product.update_stock' com a estrutura de 'model_id'
    const path = "/api/v2/product/update_stock";
    const timestamp = Math.floor(Date.now() / 1000);
    const baseString = `${partnerId}${path}${timestamp}${accessToken}${shopId}`;
    const sign = crypto.createHmac('sha256', partnerKey).update(baseString).digest('hex');
    const url = `${host}${path}?partner_id=${partnerId}&timestamp=${timestamp}&sign=${sign}&access_token=${accessToken}&shop_id=${shopId}`;

    const body = {
        "item_id": 885176963,
        "stock_set_list": [
            {
                "model_id": 18500765000, // O ID da variação que você gerou
                "normal_stock": 666
            }
        ]
    };

    try {
        const response = await axios.post(url, body);
        console.log("🔍 Resposta do Servidor:");
        console.log(JSON.stringify(response.data, null, 2));

        if (response.data.response.success_list && response.data.response.success_list.length > 0) {
            console.log("\n✅ SUCESSO TOTAL! O estoque de 666 foi aplicado à variação.");
        } else {
            console.log("\n⚠️ A lista de sucesso veio vazia. Verifique se o produto está ATIVO no painel.");
        }
    } catch (err) {
        console.error("❌ Erro na chamada:", err.response ? err.response.data : err.message);
    }
}

atualizarEstoqueVariação();