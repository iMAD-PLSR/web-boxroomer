/**
 * BOXROOMER - Supabase Client Initializer
 * Este script debe cargarse DESPUES de supabase-config.js y ANTES de cualquier script que use supabase.
 */

(function () {
    // 1. Verificar si el SDK de Supabase está cargado
    if (!window.supabase) {
        console.error("❌ [Supabase Client] SDK not found. Make sure to include the Supabase CDN script.");
        return;
    }

    // 2. Verificar si la configuración existe
    if (!window.SUPABASE_CONFIG || window.SUPABASE_CONFIG.URL === 'https://your-project-url.supabase.co') {
        console.warn("⚠️ [Supabase Client] Configuration not set or using placeholders. Running in Demo Mode.");
        window.supabaseClient = null;
        return;
    }

    // 3. Inicializar el cliente global
    try {
        window.supabaseClient = window.supabase.createClient(
            window.SUPABASE_CONFIG.URL,
            window.SUPABASE_CONFIG.ANON_KEY
        );
        console.log("✅ [Supabase Client] Initialized successfully.");
    } catch (error) {
        console.error("❌ [Supabase Client] Error initializing:", error);
    }
})();

/**
 * Función Global de Cierre de Sesión
 */
window.handleLogout = async function (redirectPath = 'login.html') {
    console.log("🚪 [Auth] Cerrando sesión...");
    try {
        if (window.supabaseClient) {
            await window.supabaseClient.auth.signOut();
        }
    } catch (error) {
        console.error("Error during sign out:", error);
    } finally {
        // Limpieza extra por si acaso
        localStorage.removeItem('supabase.auth.token');
        // Redirigir
        window.location.href = redirectPath;
    }
};
