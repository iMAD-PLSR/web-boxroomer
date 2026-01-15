/**
 * BoxRoomer Theme Engine
 * Gestiona el cambio entre Modo Claro y Oscuro
 */
const ThemeEngine = {
    init() {
        const savedTheme = localStorage.getItem('boxroomer-theme') || 'light';
        this.setTheme(savedTheme);
    },

    toggle() {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        this.setTheme(newTheme);
    },

    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('boxroomer-theme', theme);

        // Actualizar iconos de los botones de tema si existen
        const icons = document.querySelectorAll('.theme-toggle-icon');
        icons.forEach(icon => {
            icon.textContent = theme === 'light' ? 'dark_mode' : 'light_mode';
        });
    }
};

// Inicializar al cargar
document.addEventListener('DOMContentLoaded', () => ThemeEngine.init());
