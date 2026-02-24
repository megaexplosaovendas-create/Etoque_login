/* front/js/login.js */

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');

    if (loginForm) {
        loginForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const userField = document.getElementById('user');
            const passwordField = document.getElementById('password');

            const user = userField.value;
            const pass = passwordField.value;

            try {
                // Chamada para o seu servidor Node.js
                const response = await fetch('http://localhost:3000/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: user, password: pass })
                });

                const data = await response.json();

                if (data.success) {
                    // ✅ GRAVA O "CRACHÁ" COMPLETO NA SESSÃO
                    sessionStorage.setItem('wms_logado', 'true');
                    sessionStorage.setItem('wms_username', user); // Nome digitado
                    sessionStorage.setItem('wms_role', data.role);   // Cargo vindo do Banco (Sequelize)

                    // Redireciona para o Dashboard
                    window.location.href = 'index.html';
                } else {
                    alert('Erro: ' + (data.message || 'Credenciais inválidas'));
                }
            } catch (err) {
                console.error('Erro na conexão:', err);
                alert('O servidor está desligado ou inacessível.');
            }
        });
    }
});