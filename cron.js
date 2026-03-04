const cron = require('node-cron');
// O caminho deve apontar para onde o serviço realmente está
const shopee = require('./src/services/shopeeService');
const db = require('./config/db'); // Sua conexão com MySQL

async function jobGerenciadorAds() {
    console.log("Checando horários de Ads...");
    const agora = new Date();
    const hora = agora.getHours();
    
    // Define a ação com base na hora
    let acaoDesejada = null;
    if (hora === 0) acaoDesejada = 'paused';   // Pausa meia-noite
    if (hora === 8) acaoDesejada = 'ongoing';  // Ativa as 08h

    if (!acaoDesejada) return;

    // Busca suas 6 lojas cadastradas no MySQL
    const [lojas] = await db.query("SELECT shop_id, access_token FROM shopee_tokens");

    for (const loja of lojas) {
        try {
            const ads = await shopee.getKeywordAdList(loja.shop_id, loja.access_token);
            if (ads.data?.ad_list) {
                for (const ad of ads.data.ad_list) {
                    await shopee.updateKeywordAdStatus(loja.shop_id, loja.access_token, ad.ad_id, acaoDesejada);
                }
            }
        } catch (err) {
            console.error(`Erro na loja ${loja.shop_id}:`, err.message);
        }
    }
}

// Agenda para rodar todo início de hora (00min)
cron.schedule('0 * * * *', () => {
    jobGerenciadorAds();
});