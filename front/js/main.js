/* front/js/main.js */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Pega as informações da sessão (o "crachá")
    const logado = sessionStorage.getItem('wms_logado');
    const role = sessionStorage.getItem('wms_role');
    const username = sessionStorage.getItem('wms_username');

    // 2. SEGURANÇA: Se não estiver logado, barra o acesso
    if (logado !== 'true') {
        window.location.href = 'login.html';
        return;
    }

    // 3. IDENTIDADE: Troca o "Carregando.." pelos dados reais
    const nameElement = document.getElementById('sb-user-name');
    const roleElement = document.getElementById('sb-user-role');

    if (nameElement) nameElement.innerText = username || "Usuário";
    if (roleElement) roleElement.innerText = role || "Acessando...";

    // 4. CONTROLE DE ACESSO: Restrições para Estoquista
    if (role === 'estoquista') {
        const btnAnalytics = document.getElementById('btn-analytics');
        if (btnAnalytics) btnAnalytics.remove();
        
        document.querySelectorAll('.btn-admin-only').forEach(el => el.remove());
        console.log("🔒 Permissões de Estoquista aplicadas.");
    }
});