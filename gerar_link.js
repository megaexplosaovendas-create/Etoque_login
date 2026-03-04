const crypto = require('crypto');

const partnerId = 1223323;
const partnerKey = "shpk7861717a4b716741504d575449464f4f4544715753424a4d6e7161564356";
const redirectUrl = "https://megaaxnen.com.br"; 

// NOVO Domínio de Sandbox da Shopee
const host = "https://openplatform.sandbox.test-stable.shopee.sg";
const path = "/api/v2/shop/auth_partner";

const timestamp = Math.floor(Date.now() / 1000);
const baseString = `${partnerId}${path}${timestamp}`;
const sign = crypto.createHmac('sha256', partnerKey).update(baseString).digest('hex');

const url = `${host}${path}?partner_id=${partnerId}&timestamp=${timestamp}&sign=${sign}&redirect=${encodeURIComponent(redirectUrl)}`;

console.log("\n🔗 NOVO LINK DE AUTORIZAÇÃO:");
console.log(url);