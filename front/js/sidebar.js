// Toggle the visibility of a dropdown menu
const toggleDropdown = (dropdown, menu, isOpen) => {
  dropdown.classList.toggle("open", isOpen);
  menu.style.height = isOpen ? `${menu.scrollHeight}px` : 0;
};
// Close all open dropdowns
const closeAllDropdowns = () => {
  document
    .querySelectorAll(".dropdown-container.open")
    .forEach((openDropdown) => {
      toggleDropdown(
        openDropdown,
        openDropdown.querySelector(".dropdown-menu"),
        false,
      );
    });
};
// Attach click event to all dropdown toggles
document.querySelectorAll(".dropdown-toggle").forEach((dropdownToggle) => {
  dropdownToggle.addEventListener("click", (e) => {
    e.preventDefault();
    const dropdown = dropdownToggle.closest(".dropdown-container");
    const menu = dropdown.querySelector(".dropdown-menu");
    const isOpen = dropdown.classList.contains("open");
    closeAllDropdowns(); // Close all open dropdowns
    toggleDropdown(dropdown, menu, !isOpen); // Toggle current dropdown visibility
  });
});
// Attach click event to sidebar toggle buttons
document
  .querySelectorAll(".sidebar-toggler, .sidebar-menu-button")
  .forEach((button) => {
    button.addEventListener("click", () => {
      closeAllDropdowns(); // Close all open dropdowns
      document.querySelector(".sidebar").classList.toggle("collapsed"); // Toggle collapsed class on sidebar
    });
  });
// Collapse sidebar by default on small screens
if (window.innerWidth <= 1024)
  document.querySelector(".sidebar").classList.add("collapsed");

const sidebar = document.querySelector(".sidebar");
const searchForm = document.querySelector(".search-form");
const themeTooltip = document.querySelector(".theme-tooltip");
const themeToggleBtn = document.querySelector(".theme-toggle");
const themeIcon = document.querySelector(".theme-icon");
const themeText = document.querySelector(".theme-text");

// Atualiza ícone + texto
const updateThemeUI = () => {
  const isDark = document.body.classList.contains("dark-theme");

  if (themeIcon) themeIcon.textContent = isDark ? "light_mode" : "dark_mode";
  if (themeText) themeText.textContent = isDark ? "Light Mode" : "Dark Mode";
  if (themeTooltip) themeTooltip.textContent = isDark ? "Light Mode" : "Dark Mode";
};

// Aplica tema salvo (ou preferência do sistema)
const savedTheme = localStorage.getItem("theme");
const systemPrefersDark = window.matchMedia(
  "(prefers-color-scheme: dark)",
).matches;

const shouldUseDarkTheme =
  savedTheme === "dark" || (!savedTheme && systemPrefersDark);

document.body.classList.toggle("dark-theme", shouldUseDarkTheme);
updateThemeUI();

// Clique no botão -> alterna tema
if (themeToggleBtn) {
  themeToggleBtn.addEventListener("click", () => {
    const isDark = document.body.classList.toggle("dark-theme");
    localStorage.setItem("theme", isDark ? "dark" : "light");
    updateThemeUI();
  });
}

// Expand sidebar quando clicar na busca
if (searchForm) {
  searchForm.addEventListener("click", () => {
    if (!sidebar) return;

    if (sidebar.classList.contains("collapsed")) {
      sidebar.classList.remove("collapsed");
      const input = searchForm.querySelector("input");
      if (input) input.focus();
    }
  });
}

// Expand sidebar por padrão em telas grandes
if (sidebar && window.innerWidth > 768) {
  sidebar.classList.remove("collapsed");
}