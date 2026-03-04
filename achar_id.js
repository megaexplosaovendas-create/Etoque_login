const crypto = require('crypto');
const axios = require('axios');

const partnerId = 1223323;
const partnerKey = "shpk7861717a4b716741504d575449464f4f4544715753424a4d6e7161564356";
const accessToken = "55645a6348656341654c61785464777a";
const shopId = 226723333;
const host = "https://openplatform.sandbox.test-stable.shopee.sg";
const path = "/api/v2/product/get_item_list";

async function rastrear() {
    const timestamp = Math.floor(Date.now() / 1000);
    const baseString = `${partnerId}${path}${timestamp}${accessToken}${shopId}`;
    const sign = crypto.createHmac('sha256', partnerKey).update(baseString).digest('hex');
    
    // Tentamos buscar produtos ATIVOS e também os NÃO LISTADOS
    const url = `${host}${path}?partner_id=${partnerId}&timestamp=${timestamp}&sign=${sign}&access_token=${accessToken}&shop_id=${shopId}&item_status=NORMAL&item_status=UNLISTED`;

    try {
        const response = await axios.get(url);
        if (response.data.response && response.data.response.item && response.data.response.item.length > 0) {
            console.log("🎯 NOVO ID ENCONTRADO:");
            console.log(JSON.stringify(response.data.response.item, null, 2));
        } else {
            console.log("❓ A Shopee não encontrou nenhum produto com esse acesso.");
            console.log("Resposta do servidor:", JSON.stringify(response.data, null, 2));
        }
    } catch (err) {
        console.error("❌ Erro técnico:", err.message);
    }
}
rastrear();