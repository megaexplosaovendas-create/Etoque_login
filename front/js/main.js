document.addEventListener('DOMContentLoaded', () => {
    // 1. Pega as informações que o Login salvou
    const logado = sessionStorage.getItem('wms_logado');
    const role = sessionStorage.getItem('wms_role');

    // 2. SEGURANÇA: Se não estiver logado, volta para o login na hora
    if (logado !== 'true') {
        window.location.href = 'login.html';
        return;
    }

    // 3. CONTROLE DE ACESSO: Se for estoquista, esconde o que é proibido
    if (role === 'estoquista') {
        const btnAnalytics = document.getElementById('btn-analytics');
        
        if (btnAnalytics) {
            btnAnalytics.remove(); // Remove o botão do código
            console.log("🔒 Acesso Restrito: Botão de Analytics removido.");
        }

        // Você também pode esconder botões de 'Deletar' ou 'Editar'
        document.querySelectorAll('.btn-admin-only').forEach(el => el.remove());
    }
});

