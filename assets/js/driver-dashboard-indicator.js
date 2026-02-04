// Indicador de estado en pestaña "Mi Ruta"
function updateMyRouteStatusIndicator(tasks) {
    const btn = document.getElementById('tab-my-route');
    if (!btn) return;

    // Remove existing dot
    const existingDot = document.getElementById('my-route-dot');
    if (existingDot) existingDot.remove();

    // Prioridad: Working (Verde) > Driving (Naranja)
    const isWorking = tasks.some(t => t.status === 'picking_up');
    const isDriving = tasks.some(t => t.status === 'in_transit');

    if (isWorking || isDriving) {
        const dot = document.createElement('div');
        dot.id = 'my-route-dot';
        // Posición: Arriba a la derecha del botón
        dot.className = `absolute top-2 right-4 w-2.5 h-2.5 rounded-full animate-pulse z-20 ${isWorking ? 'bg-[#00E096] shadow-[0_0_8px_#00E096]' : 'bg-orange-500 shadow-[0_0_8px_orange]'}`;

        // Asegurar que el botón tenga position: relative
        btn.style.position = 'relative';
        btn.appendChild(dot);
    }
}
