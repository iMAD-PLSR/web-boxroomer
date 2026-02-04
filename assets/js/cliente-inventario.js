document.addEventListener('DOMContentLoaded', async () => {
    // 1. Auth Check - STRICT
    if (!window.supabaseClient) return;

    const { data: { session } } = await window.supabaseClient.auth.getSession();
    if (!session) {
        window.location.href = 'login.html';
        return;
    }

    // 2. Load Inventory Real
    loadUserInventory(session.user.id);
});

async function loadUserInventory(userId) {
    const grid = document.getElementById('inventory-grid-container');
    const loading = document.getElementById('inventory-loading');
    const btnRecover = document.getElementById('btn-recover-all');

    // Widget Elements
    const currentOccEl = document.getElementById('current-occupancy');
    const maxOccEl = document.getElementById('max-occupancy');
    const insAmountEl = document.getElementById('insurance-amount');
    const occBar = document.getElementById('occupancy-bar');

    // 1. Buscamos TODOS los contratos/leads activos del usuario
    const { data: leads } = await window.supabaseClient
        .from('leads_wizard')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (loading) loading.remove();

    // Reset widgets if no leads
    if (!leads || leads.length === 0) {
        if (currentOccEl) currentOccEl.innerText = "0.0";
        if (maxOccEl) maxOccEl.innerText = "0.0";
        if (insAmountEl) insAmountEl.innerText = "0€";
        if (btnRecover) btnRecover.disabled = true;

        grid.innerHTML = `
            <div class="col-span-full flex flex-col items-center justify-center py-20 opacity-50">
                <span class="material-symbols-outlined text-6xl mb-4">inventory_2</span>
                <p class="text-xs font-black uppercase tracking-widest">Sin inventario activo</p>
            </div>
        `;
        return;
    }

    // CONSOLIDATION LOGIC
    let totalVol = 0;
    let anyActive = false;
    leads.forEach(l => {
        totalVol += parseFloat(l.volume_m3 || 0);
        if (l.status === 'active') anyActive = true;
    });

    const currentVol = 0; // Ocupación real (items procesados) aún 0

    if (currentOccEl) currentOccEl.innerText = currentVol.toFixed(1);
    if (maxOccEl) maxOccEl.innerText = totalVol.toFixed(1);
    if (insAmountEl) insAmountEl.innerText = `${(totalVol * 1000).toLocaleString('es-ES')}€`;
    if (occBar) occBar.style.width = '0%';

    // Update Modal Reference Label
    const modalVolRef = document.getElementById('modal-volume-ref');
    if (modalVolRef) modalVolRef.innerText = totalVol.toFixed(1);

    // DYNAMIC RENEWAL MODAL PRICES (Inventory Side)
    const baseMonthlyRenewal = 39 + (totalVol > 1 ? (totalVol - 1) * 16 : 0);
    const pMonthly = document.getElementById('price-monthly');
    const p6m = document.getElementById('price-6months');
    const p12m = document.getElementById('price-12months');

    if (pMonthly) pMonthly.innerText = `${baseMonthlyRenewal.toFixed(2)}€/mes`;
    if (p6m) p6m.innerText = `${(baseMonthlyRenewal * 0.9).toFixed(2)}€/mes`;
    if (p12m) p12m.innerText = `${(baseMonthlyRenewal * 0.8).toFixed(2)}€/mes`;

    // Global Action Link
    window.confirmRenewal = function () {
        const isAuto = document.getElementById('invAutoRenew')?.checked;
        window.showBoxBotToast(`✅ ¡Configuración Guardada! Has actualizado tu plan con éxito. Renovación automática: ${isAuto ? 'ON' : 'OFF'}`);
        if (typeof closeRenewalModal === 'function') closeRenewalModal();
    }

    // DISABLE RECOVERY BUTTON (No hay bultos registrados todavía)
    if (btnRecover) {
        btnRecover.disabled = true;
        btnRecover.title = "No hay objetos en el espacio para recuperar";
    }

    // RENDER STATUS VIEW (Using latest lead as primary logistical reference)
    const latestLead = leads[0];
    const pickupDate = latestLead.pickup_date ? new Date(latestLead.pickup_date).toLocaleDateString('es-ES') : 'Pendiente';

    grid.innerHTML = `
        <div class="col-span-full bg-[var(--card-bg)] border border-[var(--card-border)] rounded-[2.5rem] p-10 text-center animate-fade-in">
            <div class="w-20 h-20 bg-brandPurple/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <span class="material-symbols-outlined text-brandPurple text-4xl">local_shipping</span>
            </div>
            <h3 class="text-2xl font-black text-[var(--text-main)] uppercase italic tracking-tighter mb-2">
                ${leads.length > 1 ? 'Espacio Consolidado' : 'Esperando Recogida'}
            </h3>
            <p class="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest max-w-md mx-auto leading-relaxed">
                Tienes un total de <strong>${totalVol.toFixed(1)} m³</strong> contratados. <br>
                ${leads.length > 1 ? 'Tus diferentes reservas se están procesando.' : `Tus objetos aparecerán aquí una vez sean recogidos el día <strong>${pickupDate}</strong>.`}
            </p>
            <div class="mt-8 flex justify-center gap-4">
                 <button onclick="window.location.href='cliente_dashboard.html'" class="px-6 py-3 bg-[var(--icon-bg)] rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[var(--card-hover)] transition-all">
                    Ver Mis Planes
                 </button>
            </div>
        </div>
    `;
}


// Funciones auxiliares borradas porque NO vamos a generar items falsos.
