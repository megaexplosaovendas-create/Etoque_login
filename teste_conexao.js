// O caminho deve apontar para onde o serviço realmente está
require('dotenv').config()
const shopee = require('./src/services/shopeeService');

async function testarMVP() {
    const code = "COLE_O_CODE_DA_URL_AQUI";
    const shopId = "COLE_O_SHOP_ID_AQUI";

    try {
        console.log("1. Trocando code pelo token...");
        const tokenData = await shopee.getInitialToken(code, shopId);
        console.log("Tokens recebidos:", tokenData);

        if (tokenData.access_token) {
            console.log("2. Listando anúncios de Ads para validar...");
            const ads = await shopee.getKeywordAdList(shopId, tokenData.access_token);
            console.log("Anúncios encontrados:", ads.data?.ad_list?.length || 0);
        }
    } catch (err) {
        console.error("Erro no teste:", err.response?.data || err.message);
    }
}

testarMVP();