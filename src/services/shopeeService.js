const axios = require('axios');
const crypto = require('crypto');

class ShopeeService {
    constructor() {
        this.partnerId = parseInt(process.env.SHOPEE_PARTNER_ID);
        this.partnerKey = process.env.SHOPEE_PARTNER_KEY;
        this.baseUrl = "https://partner.shopeemobile.com";
    }

    // 1. Gera a assinatura (Sign) - O "carimbo" de segurança
    generateSign(path, extras = {}) {
        const timestamp = Math.floor(Date.now() / 1000);
        // A base da assinatura muda dependendo se tem token ou não
        let baseString = `${this.partnerId}${path}${timestamp}`;
        
        if (extras.accessToken) baseString += extras.accessToken;
        if (extras.shopId) baseString += extras.shopId;

        const sign = crypto
            .createHmac('sha256', this.partnerKey)
            .update(baseString)
            .digest('hex');

        return { sign, timestamp };
    }

    // 2. Troca o "Code" pelo Primeiro Token (Usa uma vez por loja)
    async getInitialToken(code, shopId) {
        const path = "/api/v2/auth/token/get";
        const { sign, timestamp } = this.generateSign(path);

        const url = `${this.baseUrl}${path}?partner_id=${this.partnerId}&timestamp=${timestamp}&sign=${sign}`;

        const body = {
            code: code,
            partner_id: this.partnerId,
            shop_id: parseInt(shopId)
        };

        const response = await axios.post(url, body);
        return response.data; // Aqui vem o access_token e o refresh_token
    }

    // 3. Renova o Token (Roda a cada 4 horas automaticamente)
    async refreshAccessToken(refreshToken, shopId) {
        const path = "/api/v2/auth/access_token/get";
        const { sign, timestamp } = this.generateSign(path);

        const url = `${this.baseUrl}${path}?partner_id=${this.partnerId}&timestamp=${timestamp}&sign=${sign}`;

        const body = {
            refresh_token: refreshToken,
            partner_id: this.partnerId,
            shop_id: parseInt(shopId)
        };

        const response = await axios.post(url, body);
        return response.data;
    }

    // 4. Atualiza o Estoque (O que resolve seu problema do 10.000 vs 0)
    async updateStock(shopId, accessToken, itemId, newStock) {
        const path = "/api/v2/product/update_stock";
        const { sign, timestamp } = this.generateSign(path, { accessToken, shopId });

        const url = `${this.baseUrl}${path}?partner_id=${this.partnerId}&timestamp=${timestamp}&sign=${sign}&access_token=${accessToken}&shop_id=${shopId}`;

        const body = {
            item_id: parseInt(itemId),
            stock_set_list: [{ selled_stock_value: parseInt(newStock) }]
        };

        const response = await axios.post(url, body);
        return response.data;
    }
}

module.exports = new ShopeeService();