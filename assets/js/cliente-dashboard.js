document.addEventListener('DOMContentLoaded', () => {
    initClientDashboard();
});

async function initClientDashboard() {
    if (!window.supabaseClient) return;

    // 1. Check Session
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    if (!session) {
        window.location.href = 'login.html';
        return;
    }

    // 2. Initial Fetch
    fetchData(session.user);

    // 3. Real-time Subscription for Status Updates
    window.supabaseClient
        .channel('dashboard-changes')
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'leads_wizard',
            filter: `user_id=eq.${session.user.id}`
        }, (payload) => {
            console.log("🔄 [Dashboard] Real-time update detected:", payload.new);
            fetchData(session.user); // Re-fetch and update UI
            showStatusChangeFeedback(payload.new.status);
        })
        .subscribe();

    // 4. Listen for auth changes
    window.supabaseClient.auth.onAuthStateChange((event, session) => {
        if (!session) window.location.href = 'login.html';
    });

    // 5. Admin Check for Sidebar
    checkAdminAccess(session.user);
}

async function checkAdminAccess(user) {
    console.log("🔍 [Auth] Verificando permisos en Dashboard para:", user.id);
    try {
        const { data: profile, error } = await window.supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();

        if (error) {
            console.error("❌ [Auth] Error en Dashboard:", error);
        }

        const role = profile?.role || user.user_metadata?.role || 'client';

        // 🦸‍♂️ SUPERADMIN BYPASS: Si es tu email, forzamos rol admin para desbloquearte
        let finalRole = role;
        if (user.email === 'israel.madrigal@pluser.es') {
            finalRole = 'admin';
            console.log("👑 [Auth] Superadmin detectado por email. Acceso concedido.");
        }

        console.log("🛡️ [Auth] Dashboard - Rol detectado:", finalRole);

        if (finalRole === 'admin') {
            console.log("➡️ [Auth] Admin detectado en Dashboard Clientes. Redirigiendo a Torre de Control...");
            window.location.href = 'admin_dashboard.html';
            return;
        }
    } catch (e) {
        console.error("❌ [Auth] Excepción en Dashboard check:", e);
    }
}

function showStatusChangeFeedback(newStatus) {
    if (newStatus === 'pending_pickup') {
        const toast = document.createElement('div');
        toast.className = 'fixed top-6 left-1/2 -translate-x-1/2 z-[100] animate-fade-in-down';
        toast.innerHTML = `
            <div class="glass-panel p-4 rounded-[2rem] border border-orange-500/30 bg-orange-500/10 backdrop-blur-xl flex items-center gap-4 shadow-2xl shadow-orange-500/20">
                <div class="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center text-white animate-bounce">
                    <span class="material-symbols-outlined">local_shipping</span>
                </div>
                <div>
                    <h4 class="text-[10px] font-black uppercase text-orange-500 tracking-widest">¡Logística Activada!</h4>
                    <p class="text-[9px] font-bold text-slate-300">Tu recogida está disponible para rastreo.</p>
                </div>
            </div>
        `;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 5000);
    } else if (newStatus === 'in_transit') {
        const toast = document.createElement('div');
        toast.className = 'fixed top-6 left-1/2 -translate-x-1/2 z-[100] animate-fade-in-down';

        // Intentar obtener el ETA del payload si existe
        const eta = payload.new.estimated_trip_minutes || '...';

        toast.innerHTML = `
            <div onclick="window.openTrackingModal()" class="glass-panel p-4 rounded-[2rem] border border-brandPurple/30 bg-brandPurple/10 backdrop-blur-xl flex items-center gap-4 shadow-2xl shadow-brandPurple/20 cursor-pointer hover:scale-105 transition-all">
                <div class="w-10 h-10 rounded-full bg-brandPurple flex items-center justify-center text-white animate-bounce">
                    <span class="material-symbols-outlined">local_shipping</span>
                </div>
                <div>
                    <h4 class="text-[10px] font-black uppercase text-brandPurple tracking-widest">¡Conductor en Camino!</h4>
                    <p class="text-[9px] font-bold text-slate-300">Llegada estimada en ${eta} min. Pulsa para rastrear.</p>
                </div>
            </div>
        `;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 8000);

        // Opcional: Abrir modal automáticamente después de un pequeño delay
        setTimeout(() => window.openTrackingModal(), 1500);

    } else if (newStatus === 'confirmed') {
        const toast = document.createElement('div');
        toast.className = 'fixed top-6 left-1/2 -translate-x-1/2 z-[100] animate-fade-in-down';
        toast.innerHTML = `
            <div class="glass-panel p-4 rounded-[2rem] border border-blue-500/30 bg-blue-500/10 backdrop-blur-xl flex items-center gap-4 shadow-2xl shadow-blue-500/20">
                <div class="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white animate-bounce">
                    <span class="material-symbols-outlined">verified</span>
                </div>
                <div>
                    <h4 class="text-[10px] font-black uppercase text-blue-500 tracking-widest">¡Reserva Confirmada!</h4>
                    <p class="text-[9px] font-bold text-slate-300">Tu servicio ha sido validado por el equipo.</p>
                </div>
            </div>
        `;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 5000);
    }
}

async function fetchData(user) {
    try {
        console.log("🔍 [Dashboard] Fetching data for user:", user.id);

        // Get Profile
        const { data: profile } = await window.supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();

        // Get ALL active/pending leads for consolidation
        let { data: leads, error: leadErr } = await window.supabaseClient
            .from('leads_wizard')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        // FALLBACK: If not found by user_id, try by email
        if (!leads || leads.length === 0) {
            console.log("⚠️ [Dashboard] Not found by ID, trying by email:", user.email);
            const { data: leadsEmail, error: errEmail } = await window.supabaseClient
                .from('leads_wizard')
                .select('*')
                .eq('email', user.email)
                .order('created_at', { ascending: false });

            if (!errEmail && leadsEmail && leadsEmail.length > 0) {
                leads = leadsEmail;
                handleAutoLinkID(user.id, leads[0].id);
            }
        }

        // Get ALL extra payments by email (for consolidation)
        const { data: payments } = await window.supabaseClient
            .from('payments')
            .select('*')
            .eq('client_email', user.email)
            .order('created_at', { ascending: false });

        if (leadErr) throw leadErr;

        console.log("📦 [Dashboard] Data retrieved:", { profile, leadsCount: leads?.length || 0, paymentsCount: payments?.length || 0 });

        updateUI(user, profile, leads);
        renderTimeline(leads, payments); // Pass both for consolidation
    } catch (err) {
        console.error("🔥 [Dashboard] Data error:", err);
    }
}

function updateUI(user, profile, leads) {
    // Update Name
    const displayName = profile?.full_name || user.user_metadata?.full_name || 'Usuario';
    const nameEl = document.getElementById('user-display-name');
    if (nameEl) nameEl.innerText = displayName.split(' ')[0];

    // Update Initials in all mini-profiles
    const initials = displayName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    document.querySelectorAll('.rounded-xl.bg-gradient-to-br, .w-9.h-9.rounded-full').forEach(el => {
        if (el.innerText.length <= 3) el.innerText = initials;
    });

    const statusTextEl = document.getElementById('dashboard-status-text');
    const volEl = document.getElementById('dashboard-volume');
    const dateEl = document.getElementById('dashboard-date-info');
    const planNameEl = document.getElementById('dashboard-plan-name');
    const btnRecover = document.getElementById('btn-dashboard-recover');

    if (!leads || leads.length === 0) {
        if (volEl) volEl.innerText = "0 m³";
        if (statusTextEl) statusTextEl.innerText = "Sin Actividad";
        if (btnRecover) btnRecover.disabled = true;
        return;
    }

    // CONSOLIDATION LOGIC
    let totalVol = 0;
    let anyActive = false;
    let anyPending = false;

    leads.forEach(l => {
        totalVol += parseFloat(l.volume_m3 || 0);
        if (l.status === 'active') anyActive = true;
        if (l.status === 'pending_pickup' || l.status === 'in_transit') anyPending = true;
    });

    if (volEl) volEl.innerText = `${totalVol.toFixed(1)} m³`;

    // Status Logic Integrated
    let statusLabel = 'PROCESANDO';
    let statusColorClass = 'bg-orange-400';
    let isPulse = false;
    let canRecover = false;

    // Highest priority status for display
    if (anyActive) {
        statusLabel = 'EN ALMACÉN';
        statusColorClass = 'bg-green-400';
        canRecover = true;
    } else if (leads.some(l => l.status === 'in_transit')) {
        statusLabel = 'CONDUCTOR EN CAMINO';
        statusColorClass = 'bg-blue-500';
        isPulse = true;
    } else if (anyPending) {
        statusLabel = 'RECOGIDA PENDIENTE';
        statusColorClass = 'bg-orange-400';
        isPulse = true;
    } else if (leads[0].status === 'confirmed' || leads[0].status === 'completed') {
        statusLabel = 'CONFIRMADO';
        statusColorClass = 'bg-blue-400';
    }

    if (btnRecover) {
        btnRecover.disabled = !canRecover;
        btnRecover.title = canRecover ? "" : "No hay objetos en el espacio para recuperar";
    }

    if (statusTextEl) {
        statusTextEl.innerText = statusLabel;
        const dotSibling = statusTextEl.previousElementSibling;
        if (dotSibling) {
            dotSibling.className = `w-2 h-2 rounded-full shadow-[0_0_12px_rgba(255,255,255,0.3)] ${statusColorClass} ${isPulse ? 'animate-pulse' : ''}`;
        }
    }

    // Dynamic Tracking Button for Pending Pickup
    renderTrackingButton(anyPending, leads);

    if (planNameEl) {
        planNameEl.innerText = leads.length > 1 ? 'Espacio Consolidado' : `Plan ${totalVol.toFixed(1)}m³`;
    }

    if (dateEl) {
        const d = new Date(leads[leads.length - 1].created_at); // Earliest contract
        dateEl.innerText = `Desde: ${d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}`;
    }
}

function renderTrackingButton(isPending, leads = []) {
    let container = document.getElementById('tracking-btn-container');

    // Create container if not exists (in updateUI flow)
    if (!container) {
        const statusCard = document.querySelector('#dashboard-status-text').closest('.glass-panel, .bg-\\[var\\(--card-bg\\)\\]');
        if (statusCard) {
            const btnDiv = document.createElement('div');
            btnDiv.id = 'tracking-btn-container';
            btnDiv.className = 'mt-6';
            statusCard.querySelector('.relative.z-10').appendChild(btnDiv);
            container = btnDiv;
        }
    }

    if (isPending && container) {
        container.innerHTML = `
            <button onclick="event.stopPropagation(); window.openTrackingModal()" class="w-full bg-orange-500 text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-xl shadow-orange-500/20 hover:scale-[1.02] transition-all flex items-center justify-center gap-3 group">
                <span class="material-symbols-outlined text-lg animate-bounce">local_shipping</span>
                Rastrear Recogida
            </button>
        `;
    } else if (container) {
        container.innerHTML = '';
    }
}

// ---------------------------------------------------------
// TRACKING MODAL LOGIC
// ---------------------------------------------------------

let trackingSubscription = null;
let clientCoords = null;

window.openTrackingModal = async function () {
    const modal = document.getElementById('trackingModal');
    if (!modal) return;

    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    // 1. Obtener el lead en tránsito
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    const { data: lead } = await window.supabaseClient
        .from('leads_wizard')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('status', 'in_transit')
        .maybeSingle();

    if (!lead || !lead.assigned_driver_id) {
        console.warn("No hay conductor asignado o no está en camino.");
        return;
    }

    // 2. Geocodificar la dirección del cliente solo una vez
    if (!clientCoords) {
        const address = `${lead.pickup_address || lead.address}, ${lead.pickup_city || lead.city}`;
        try {
            const geoUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
            const resp = await fetch(geoUrl);
            const data = await resp.json();
            if (data && data.length > 0) {
                clientCoords = { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
            }
        } catch (e) {
            console.error("Error geocodificando cliente:", e);
        }
    }

    // 3. Suscribirse a la ubicación real del conductor
    if (trackingSubscription) trackingSubscription.unsubscribe();

    const updateModalETA = async (driverLat, driverLon) => {
        if (!clientCoords) return;

        // Calcular distancia Haversine
        const R = 6371;
        const dLat = (clientCoords.lat - driverLat) * Math.PI / 180;
        const dLon = (clientCoords.lon - driverLon) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(driverLat * Math.PI / 180) * Math.cos(clientCoords.lat * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;

        // Estimación dinámica (30km/h ciudad + tráfico)
        let minutes = (distance / 30) * 60 * 1.5 + 4;
        const roundedMinutes = Math.ceil(minutes);

        // Actualizar UI
        const etaText = document.getElementById('tracking-eta-value');
        if (etaText) etaText.innerText = `${roundedMinutes} min`;

        const distanceText = document.getElementById('tracking-distance-info');
        if (distanceText) distanceText.innerText = `CONDUCTOR A ${distance.toFixed(1)} KM • BOXROOMER LIVE`;
    };

    // Primera carga manual para no esperar a la suscripción
    const { data: loc } = await window.supabaseClient
        .from('driver_locations')
        .select('*')
        .eq('driver_id', lead.assigned_driver_id)
        .maybeSingle();

    if (loc) updateModalETA(loc.latitude, loc.longitude);

    trackingSubscription = window.supabaseClient
        .channel('live-gps')
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'driver_locations',
            filter: `driver_id=eq.${lead.assigned_driver_id}`
        }, (payload) => {
            updateModalETA(payload.new.latitude, payload.new.longitude);
        })
        .subscribe();
}

window.closeTrackingModal = function () {
    const modal = document.getElementById('trackingModal');
    if (modal) {
        modal.classList.add('hidden');
        document.body.style.overflow = '';
        if (trackingSubscription) {
            trackingSubscription.unsubscribe();
            trackingSubscription = null;
        }
    }
}

function addTimelineEventToTracking() {
    // Aquí podríamos inyectar estados reales si tuviéramos una tabla de logística
    console.log("📍 GPS Tracking activo...");
}

function renderTimeline(leads, payments) {
    const container = document.getElementById('live-timeline');
    if (!container) return;

    if (!leads || leads.length === 0) {
        container.innerHTML = `
        <div class="flex flex-col items-center justify-center p-12 text-center opacity-40">
            <span class="material-symbols-outlined text-4xl mb-3">history_toggle_off</span>
            <p class="text-[10px] font-black uppercase tracking-widest">Sin historial reciente</p>
        </div>`;
        return;
    }

    // Combine all events from all leads
    let events = [];
    leads.forEach(l => {
        const created = new Date(l.created_at);

        // Base Event: Creation
        events.push({
            icon: 'assignment_add',
            title: 'Solicitud Registrada',
            desc: `Reserva de ${l.volume_m3}m³ iniciada`,
            date: created
        });

        // Status Based Events
        if (l.status === 'confirmed' || l.status === 'completed' || l.status === 'active' || l.status === 'pending_pickup' || l.status === 'in_transit') {
            events.push({
                icon: 'check_circle',
                title: 'Reserva Confirmada',
                desc: `Pack de ${l.volume_m3}m³ validado`,
                date: new Date(l.created_at)
            });
        }

        if (l.assigned_at) {
            events.push({
                icon: 'person_pin_circle',
                title: 'Conductor Asignado',
                desc: `Tu ruta está programada`,
                date: new Date(l.assigned_at)
            });
        }

        if (l.en_route_at) {
            events.push({
                icon: 'local_shipping',
                title: 'Conductor en Camino',
                desc: `El conductor ha iniciado el trayecto a tu ubicación`,
                date: new Date(l.en_route_at)
            });
        }

        if (l.pickup_started_at) {
            events.push({
                icon: 'home_pin',
                title: 'Conductor ha Llegado',
                desc: `Estamos realizando la carga de tus bultos`,
                date: new Date(l.pickup_started_at)
            });
        }

        if (l.operational_incident_type) {
            const isAbsent = l.operational_incident_type.includes('Ausente');
            events.push({
                icon: isAbsent ? 'person_off' : 'warning',
                title: 'Incidencia en Servicio',
                desc: isAbsent ? 'No hemos podido contactar contigo en el domicilio' : `Contratiempo: ${l.operational_incident_type}`,
                date: new Date(l.operational_incident_at || l.updated_at)
            });
        }

        if (l.completed_at) {
            events.push({
                icon: 'task_alt',
                title: 'Recogida Completada',
                desc: `Servicio finalizado con éxito`,
                date: new Date(l.completed_at)
            });
        }

        if (l.status === 'active') {
            events.push({
                icon: 'warehouse',
                title: 'Entrada en Almacén',
                desc: `Tus ${l.volume_m3}m³ ya están seguros`,
                date: new Date(l.updated_at || l.completed_at || l.created_at)
            });
        }
    });

    // Combined Events: Payments
    if (payments) {
        payments.forEach(p => {
            events.push({
                icon: 'payments',
                title: p.status === 'completed' ? 'Pago Recibido' : 'Pago Pendiente',
                desc: `${p.concept} - ${p.amount}€ ${p.notes ? `(${p.notes})` : ''}`,
                date: new Date(p.created_at)
            });
        });
    }

    // Sort events by date DESC
    events.sort((a, b) => b.date - a.date);

    // Render Unique/Top events or all? Let's show all but limit for UI
    container.innerHTML = events.slice(0, 10).map(e => createTimelineItem(e.icon, e.title, e.desc, e.date)).join('');
}

function createTimelineItem(icon, title, desc, date) {
    return `
    <div class="relative pl-16 group animate-fade-in">
        <div class="absolute left-0 top-0 w-12 h-12 rounded-2xl bg-[var(--app-bg)] border border-[var(--card-border)] flex items-center justify-center z-10 timeline-icon-container">
            <span class="material-symbols-outlined text-brandPurple text-xl">${icon}</span>
        </div>
        <div>
            <h4 class="text-xs font-black text-[var(--text-main)] uppercase tracking-tighter">${title}</h4>
            <p class="text-[10px] text-[var(--text-muted)] font-medium mt-1 uppercase tracking-widest leading-none">${desc}</p>
            <div class="flex items-center gap-2 mt-3">
                <span class="w-1.5 h-1.5 rounded-full bg-brandPurple/30"></span>
                <span class="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest">${date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
        </div>
    </div>`;
}

async function handleAutoLinkID(userId, leadId) {
    try {
        await window.supabaseClient
            .from('leads_wizard')
            .update({ user_id: userId })
            .eq('id', leadId);
        console.log("🔗 [Dashboard] Lead auto-linked to User ID successfully.");
    } catch (e) {
        console.warn("Could not auto-link ID:", e);
    }
}

