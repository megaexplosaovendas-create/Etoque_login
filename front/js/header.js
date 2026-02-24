/* header.js */

// 1. Função de busca no Header
const searchInput = document.querySelector('.search-input-header');

if (searchInput) {
    searchInput.addEventListener('keyup', (e) => {
        const term = e.target.value.toLowerCase();
        console.log("Buscando por:", term);
        // Aqui você pode chamar a sua função render() do estoque se quiser filtrar
        // render(); 
    });
}

// 2. Atalho de teclado (Opcional: foca na busca ao apertar '/')
document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== searchInput) {
        e.preventDefault();
        searchInput.focus();
    }
});

/* No seu sidebar.js ou app.js */
function toggleSidebar() {
    const sidebar = document.getElementById('mainSidebar');
    sidebar.classList.toggle('collapsed');
}