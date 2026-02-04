document.addEventListener('DOMContentLoaded', () => {
    initDriverApp();
});

let currentTab = 'available';
let allTasks = [];

// --- Workday Global State ---
let currentShiftId = localStorage.getItem('activeShiftId');
let isWorkdayActive = !!currentShiftId;
let workdayStartTime = null;
let workdayInterval = null;
let lastDriverCoords = null; // { lat, lon } para cálculos instantáneos

function updateWorkdayButtonUI() {
    const label = document.getElementById('workday-label');
    const btn = document.getElementById('header-workday-toggle');
    const iconContainer = document.getElementById('workday-icon-container');
    const icon = btn ? btn.querySelector('.material-symbols-outlined') : null;

    if (!label) return;

    if (isWorkdayActive) {
        // --- ESTADO: TRABAJANDO (ROJO / FINALIZAR) ---

        // 1. Texto (siempre "JORNADA")
        label.innerText = 'JORNADA';
        label.classList.remove('text-slate-300', 'group-hover:text-white');
        label.classList.add('text-red-400');

        // 2. Icono
        if (icon) icon.innerText = 'stop_circle';

        // 3. Contenedor Icono (Circulo)
        if (iconContainer) {
            iconContainer.classList.remove('bg-slate-700', 'text-slate-300');
            iconContainer.classList.add('bg-red-600', 'text-white', 'shadow-lg', 'shadow-red-900/50');
        }

        // 4. Botón Completo (Fondo sutil rojo)
        if (btn) {
            btn.classList.remove('bg-white/5', 'border-white/10');
            btn.classList.add('bg-red-500/10', 'border-red-500/20');
        }

    } else {
        // --- ESTADO: DESCANSO (GRIS / INICIAR) ---

        // 1. Texto (siempre "JORNADA")
        label.innerText = 'JORNADA';
        label.classList.remove('text-red-400');
        label.classList.add('text-slate-300', 'group-hover:text-white');

        // 2. Icono
        if (icon) icon.innerText = 'play_circle';

        // 3. Contenedor Icono (Circulo)
        if (iconContainer) {
            iconContainer.classList.remove('bg-red-600', 'text-white', 'shadow-lg', 'shadow-red-900/50');
            iconContainer.classList.add('bg-slate-700', 'text-slate-300');
        }

        // 4. Botón Completo (Fondo normal)
        if (btn) {
            btn.classList.remove('bg-red-500/10', 'border-red-500/20');
            btn.classList.add('bg-white/5', 'border-white/10');
        }
    }
}

function requireWorkday() {
    if (!isWorkdayActive) {
        openConfirmModal({
            title: 'Jornada Requerida',
            desc: 'Primero debes INICIAR JORNADA en tu hoja de ruta para poder gestionar servicios.',
            icon: 'lock_open',
            btnText: 'Ir a Mi Ruta',
            onConfirm: () => {
                switchTab('my-route');
            }
        });
        return false;
    }
    return true;
}

const accessLabel = {
    'street': 'Pie de calle',
    'floor': 'Planta alta',
    'office': 'Oficina / Local',
    'storage': 'Trastero / Garaje'
};

const accessIcon = {
    'street': 'door_front',
    'floor': 'stairs',
    'office': 'business',
    'storage': 'garage'
};

const WAREHOUSE_LOCATION = {
    address: "Calle Artes Gráficas 7, 28320 Pinto, Madrid",
    lat: 40.246473,
    lng: -3.693414
};

async function initDriverApp() {
    if (!window.supabaseClient) {
        console.error('❌ Supabase client not initialized');
        return;
    }

    // 1. Auth Check
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    const driverNameEl = document.getElementById('driver-name');

    if (session) {
        // Obtener perfil del conductor
        const { data: profile } = await window.supabaseClient
            .from('profiles')
            .select('full_name, role')
            .eq('id', session.user.id)
            .single();

        driverNameEl.innerText = profile?.full_name || session.user.email || 'Conductor';

        // Verificar que es conductor o admin
        if (profile?.role !== 'driver' && profile?.role !== 'admin' && session.user.email !== 'israel.madrigal@pluser.es') {
            showError('Acceso denegado: Solo para conductores', 'Seguridad');
            window.location.href = 'login.html';
            return;
        }
    } else {
        // Sin sesión, redirigir a login general (hemos eliminado el login por PIN)
        window.location.href = 'login.html';
        return;
    }

    // 2. Initial Fetch
    await fetchTasks();

    // 3. Real-time changes
    window.supabaseClient
        .channel('driver-updates')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'leads_wizard' }, () => {
            console.log('🔄 Actualización en tiempo real detectada');
            fetchTasks();
        })
        .subscribe();
    // 5. Preparar GPS (pero no iniciar auto para evitar bloqueo de browser)
    currentDriverId = session.user.id;

    // 6. Init Header Date
    initHeaderDate();

    // 7. UI Update Workday
    updateWorkdayButtonUI();

    // 8. Auto-activar GPS si hay jornada activa
    if (isWorkdayActive && !isTracking) {
        console.log("📡 Jornada activa detectada, activando GPS automáticamente...");
        toggleGPS();
    }
}

function initHeaderDate() {
    const now = new Date();
    const optionsDay = { weekday: 'long' };
    const optionsDate = { day: 'numeric', month: 'short' };

    const dayName = now.toLocaleDateString('es-ES', optionsDay);
    const dateFull = now.toLocaleDateString('es-ES', optionsDate);

    const dayEl = document.getElementById('header-date-day');
    const dateEl = document.getElementById('header-date-full');

    if (dayEl) dayEl.innerText = dayName; // "jueves"
    if (dateEl) dateEl.innerText = dateFull.replace('.', ''); // "4 feb"
}

// --- GPS TRACKING ---
let locationWatchId = null;
let currentDriverId = null;
let isTracking = false;

function toggleGPS() {
    const btn = document.getElementById('btn-gps-toggle');
    const dot = document.getElementById('gps-status-dot');
    const icon = btn.querySelector('.material-symbols-outlined');

    // Target the icon container specifically
    const iconContainer = btn.querySelector('div');

    if (isTracking) {
        // Stop
        if (locationWatchId) navigator.geolocation.clearWatch(locationWatchId);
        locationWatchId = null;
        isTracking = false;

        // UI Update: Revert to Inactive
        if (iconContainer) {
            iconContainer.classList.add('bg-transparent', 'text-slate-500', 'group-hover:bg-white/5', 'group-hover:text-white');
            iconContainer.classList.remove('bg-green-500/20', 'text-green-400', 'border', 'border-green-500/30');
        }

        icon.innerText = 'location_off';
        dot.classList.add('hidden');

        console.log("🛑 GPS Detenido manualmente");
    } else {
        // Start
        if (!currentDriverId) {
            console.error("No driver ID loaded yet");
            return;
        }

        startLocationTracking(currentDriverId);

        // UI Update: Set to Active
        isTracking = true;

        if (iconContainer) {
            iconContainer.classList.remove('bg-transparent', 'text-slate-500', 'group-hover:bg-white/5', 'group-hover:text-white');
            iconContainer.classList.add('bg-green-500/20', 'text-green-400', 'border', 'border-green-500/30');
        }

        icon.innerText = 'location_on';
        // Dot logic moved to container style, but keep dot for extra visibility if needed
        dot.classList.remove('hidden', 'bg-red-500');
        dot.classList.add('bg-green-500', 'animate-pulse');
    }
}

function startLocationTracking(driverId) {
    if (!navigator.geolocation) {
        alert("Tu dispositivo no soporta geolocalización o está deshabilitada.");
        return;
    }

    // Evitar duplicados
    if (locationWatchId) navigator.geolocation.clearWatch(locationWatchId);

    console.log("📡 Iniciando tracking GPS...");

    locationWatchId = navigator.geolocation.watchPosition(
        async (position) => {
            const { latitude, longitude, heading, speed } = position.coords;
            lastDriverCoords = { lat: latitude, lon: longitude };
            console.log("📍 Ubicación actualizada:", latitude, longitude);

            // Actualizar en Supabase (Upsert)
            const { error } = await window.supabaseClient
                .from('driver_locations')
                .upsert({
                    driver_id: driverId,
                    latitude,
                    longitude,
                    heading: heading || 0,
                    speed: speed || 0,
                    is_active: true,
                    updated_at: new Date().toISOString()
                });

            if (error) console.error("❌ Error enviando ubicación:", error);
        },
        (err) => {
            console.warn("⚠️ Advertencia GPS:", err.message, "(Código:", err.code, ")");

            // Código 1: PERMISSION_DENIED (Fatal)
            if (err.code === 1) {
                isTracking = false;
                if (locationWatchId) navigator.geolocation.clearWatch(locationWatchId);
                locationWatchId = null;

                // Revert UI to Inactive/Error State
                const btn = document.getElementById('btn-gps-toggle');
                if (btn) {
                    const iconContainer = btn.querySelector('div');
                    const icon = btn.querySelector('.material-symbols-outlined');

                    if (icon) icon.innerText = 'location_disabled';

                    // Style container as error
                    if (iconContainer) {
                        iconContainer.classList.remove('bg-green-500/20', 'text-green-400', 'border-green-500/30');
                        iconContainer.classList.add('bg-red-500/10', 'text-red-500', 'border', 'border-red-500/20');
                    }
                }

                // Show instruction modal
                openConfirmModal({
                    title: 'Permiso GPS Denegado',
                    desc: 'El acceso a tu ubicación está bloqueado. Haz clic en el icono 🔒 o ⓘ en la barra de dirección y permite "Ubicación".',
                    icon: 'location_disabled',
                    btnText: 'Entendido',
                    onConfirm: () => { }
                });
            } else {
                // Código 2 (UNAVAILABLE) o 3 (TIMEOUT) -> Transitorios
                // No detenemos el tracking, el navegador seguirá intentando
                console.log("⏳ Esperando señal GPS válida...");
            }
        },
        {
            enableHighAccuracy: true,
            maximumAge: 30000,
            timeout: 27000
        }
    );
}

// Expose globally
window.toggleGPS = toggleGPS;

/**
 * Gestión de Temas (Claro/Oscuro)
 */
function initTheme() {
    const savedTheme = localStorage.getItem('driver-theme') || 'dark';
    if (savedTheme === 'light') {
        document.body.classList.add('light-mode');
        updateThemeIcon(true);
    } else {
        document.body.classList.remove('light-mode');
        updateThemeIcon(false);
    }
}

window.toggleTheme = function () {
    const isLight = document.body.classList.toggle('light-mode');
    localStorage.setItem('driver-theme', isLight ? 'light' : 'dark');
    updateThemeIcon(isLight);
};

function updateThemeIcon(isLight) {
    const icon = document.getElementById('theme-icon');
    const container = document.getElementById('theme-icon-container');

    if (icon) {
        icon.innerText = isLight ? 'dark_mode' : 'light_mode';
    }

    // Actualizar estilos del contenedor según tema DE DESTINO (invertido)
    if (container) {
        if (isLight) {
            // Estamos en CLARO → Mostrar botón oscuro (te lleva a oscuro)
            container.classList.remove('bg-white', 'border-slate-300', 'text-slate-900');
            container.classList.add('bg-slate-800', 'border-slate-700', 'text-slate-200');
        } else {
            // Estamos en OSCURO → Mostrar botón claro (te lleva a claro)
            container.classList.remove('bg-slate-800', 'border-slate-700', 'text-slate-200');
            container.classList.add('bg-white', 'border-slate-300', 'text-slate-900');
        }
    }
}

async function fetchTasks() {
    try {
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        const userId = session?.user?.id;

        // Verificar si es admin
        const { data: profile } = await window.supabaseClient
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single();

        const isAdmin = profile?.role === 'admin' || session?.user?.email === 'israel.madrigal@pluser.es';

        // Query base
        let query = window.supabaseClient
            .from('leads_wizard')
            .select('*');

        // Si NO es admin, filtrar solo estados operativos
        if (!isAdmin) {
            query = query.in('status', ['confirmed', 'pending_pickup', 'in_transit', 'picking_up', 'completed']);
        }
        // Si ES admin, no filtramos nada - ve TODO

        const { data: leads, error } = await query
            .order('pickup_date', { ascending: true })
            .order('route_order', { ascending: true });

        if (error) throw error;

        allTasks = leads || [];

        // "Bandeja": Sin asignar
        const availableTasks = allTasks.filter(l => l.status === 'confirmed');

        // "Mi Ruta": Admin ve TODAS las rutas activas, conductores solo las suyas
        const myRouteTasks = isAdmin
            ? allTasks.filter(l =>
                (l.status === 'pending_pickup' || l.status === 'in_transit' || l.status === 'picking_up')
            )
            : allTasks.filter(l =>
                (l.status === 'pending_pickup' || l.status === 'in_transit' || l.status === 'picking_up') &&
                l.assigned_driver_id === userId
            );

        // "Historial": Admin ve TODO el historial, conductores solo el suyo
        const historyTasks = (isAdmin
            ? allTasks.filter(l => l.status === 'completed')
            : allTasks.filter(l =>
                l.status === 'completed' &&
                l.assigned_driver_id === userId
            )).sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at));

        renderAvailable(availableTasks);
        renderMyRoute(myRouteTasks);
        renderHistory(historyTasks);

        // Update Tab Indicator ("Bolita" verde/naranja)
        updateMyRouteStatusIndicator(myRouteTasks);

        // Auto-switch a "Mi Ruta" si hay servicios activos
        if (myRouteTasks.length > 0 && currentTab === 'available') {
            switchTab('my-route');
        }

    } catch (err) {
        console.error("❌ Error fetching tasks:", err);
    }
}

/**
 * Paso 1: Notificar que el conductor va de camino
 */
async function notifyEnRoute(taskId) {
    if (!requireWorkday()) return;

    const task = allTasks.find(t => t.id === taskId);
    if (!task) return;

    // Verificar si ya hay un servicio activo para este conductor
    const activeTask = allTasks.find(t =>
        (t.status === 'in_transit' || t.status === 'picking_up') &&
        t.assigned_driver_id === task.assigned_driver_id &&
        t.id !== taskId
    );

    if (activeTask) {
        showError(`Ya tienes un servicio activo con ${activeTask.full_name}. Debes finalizarlo antes de iniciar otro trayecto.`, 'Operación Bloqueada');
        return;
    }

    try {
        const address = `${task.pickup_address || task.address}, ${task.pickup_city || task.city}`;
        const etaMinutes = await calculateEstimatedTime(address);

        const { error } = await window.supabaseClient
            .from('leads_wizard')
            .update({
                status: 'in_transit',
                en_route_at: new Date().toISOString(),
                estimated_trip_minutes: etaMinutes
            })
            .eq('id', taskId);

        if (error) throw error;

        // Enviar WhatsApp al cliente
        sendWhatsAppNotification({ ...task, estimated_trip_minutes: etaMinutes });

        await fetchTasks();
    } catch (err) {
        console.error('❌ Error notifying en route:', err);
    }
}

/**
 * Deshacer "En Camino" -> Volver a "Pendiente"
 */
async function revertEnRoute(taskId) {
    console.log('🔄 Deshaciendo "En Camino" para:', taskId);
    try {
        const { error } = await window.supabaseClient
            .from('leads_wizard')
            .update({
                status: 'pending_pickup',
                en_route_at: null,
                estimated_trip_minutes: null
            })
            .eq('id', taskId);

        if (error) throw error;
        await fetchTasks();
    } catch (err) {
        console.error('❌ Error reverting en route:', err);
    }
}

/**
 * Paso 2: Registrar llegada y empezar cronómetro (Picking Up)
 */
async function startPickup(taskId) {
    console.log('📍 Registrando llegada para:', taskId);

    try {
        const { error } = await window.supabaseClient
            .from('leads_wizard')
            .update({
                status: 'picking_up',
                pickup_started_at: new Date().toISOString()
            })
            .eq('id', taskId);

        if (error) throw error;
        await fetchTasks();
    } catch (err) {
        console.error('❌ Error starting pickup:', err);
    }
}

/**
 * Helper: Calcular tiempo estimado de llegada dinámico
 */
async function calculateEstimatedTime(address) {
    return new Promise((resolve) => {
        // Fallback: 25 minutos si algo falla
        const fallbackTime = "25";

        const calculateWithCoords = async (lat, lon) => {
            try {
                // Geocodificar dirección del cliente (OSM Nominatim)
                const geoUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
                const response = await fetch(geoUrl);
                const data = await response.json();

                if (!data || data.length === 0) throw new Error("No geocoding results");

                const clientLat = parseFloat(data[0].lat);
                const clientLon = parseFloat(data[0].lon);

                // Calcular distancia Haversine (km)
                const R = 6371;
                const dLat = (clientLat - lat) * Math.PI / 180;
                const dLon = (clientLon - lon) * Math.PI / 180;
                const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                    Math.cos(lat * Math.PI / 180) * Math.cos(clientLat * Math.PI / 180) *
                    Math.sin(dLon / 2) * Math.sin(dLon / 2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                const distance = R * c;

                // Estimación premium
                let minutes = (distance / 30) * 60 * 1.5 + 5;
                const roundedMinutes = Math.ceil(minutes / 5) * 5;

                console.log(`📍 ETA Instantáneo - Distancia: ${distance.toFixed(2)}km -> Tiempo: ${roundedMinutes}min`);
                resolve(roundedMinutes.toString());
            } catch (err) {
                console.warn("⚠️ Error en geocoding, usando fallback:", err);
                resolve(fallbackTime);
            }
        };

        // 1. Intentar usar la última posición conocida (instantáneo)
        if (lastDriverCoords) {
            return calculateWithCoords(lastDriverCoords.lat, lastDriverCoords.lon);
        }

        // 2. Si no hay coords previas, pedir una vez (fallback lento)
        if (!navigator.geolocation) {
            return resolve(fallbackTime);
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => calculateWithCoords(pos.coords.latitude, pos.coords.longitude),
            (err) => {
                console.warn("⚠️ Timeout o GPS bloqueado, usando fallback:", err.message);
                resolve(fallbackTime);
            },
            { timeout: 3000, enableHighAccuracy: false }
        );
    });
}

/**
 * Helper: Abrir WhatsApp con mensaje dinámico y premium
 */
async function sendWhatsAppNotification(task) {
    const phone = task.phone;
    if (!phone) return;

    const name = task.full_name || 'Cliente';
    const address = `${task.pickup_address || task.address}, ${task.pickup_city || task.city}`;

    // Calcular tiempo dinámico sólo si no viene ya calculado
    const etaMinutes = task.estimated_trip_minutes || await calculateEstimatedTime(address);

    // Mensaje mejorado con emoji corregido y tiempo dinámico
    const message = `Hola ${name}, soy tu conductor de BOXROOMER \uD83D\uDE9B. Acabo de salir hacia tu ubicación para realizar la recogida. Estaré allí en aproximadamente ${etaMinutes} minutos. ¡Hasta ahora!`;

    // Limpiar teléfono
    const cleanPhone = phone.replace(/\D/g, '');
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;

    window.open(url, '_blank');
}

function renderAvailable(tasks) {
    const list = document.getElementById('available-list');
    const count = document.getElementById('count-available');
    if (!list) return;

    count.innerText = tasks.length;

    if (tasks.length === 0) {
        list.innerHTML = `
            <div class="p-12 text-center opacity-30">
                <span class="material-symbols-outlined text-4xl mb-2">inbox</span>
                <p class="text-[10px] font-black uppercase tracking-widest">No hay nuevos servicios</p>
                <p class="text-[8px] text-slate-400 mt-2">Los servicios confirmados aparecerán aquí</p>
            </div>
        `;
        return;
    }

    // Agrupar por fecha
    const groupedByDate = {};
    tasks.forEach(t => {
        const dateKey = t.pickup_date || 'sin-fecha';
        if (!groupedByDate[dateKey]) {
            groupedByDate[dateKey] = [];
        }
        groupedByDate[dateKey].push(t);
    });

    // Ordenar fechas
    const sortedDates = Object.keys(groupedByDate).sort((a, b) => {
        if (a === 'sin-fecha') return 1;
        if (b === 'sin-fecha') return -1;
        return new Date(a) - new Date(b);
    });

    // Renderizar por bloques de fecha
    list.innerHTML = sortedDates.map(dateKey => {
        const tasksForDate = groupedByDate[dateKey];

        // Formatear fecha para el encabezado
        let dateHeader;
        if (dateKey === 'sin-fecha') {
            dateHeader = 'Sin Fecha Asignada';
        } else {
            const date = new Date(dateKey);
            const today = new Date();
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);

            if (date.toDateString() === today.toDateString()) {
                dateHeader = '🔥 HOY';
            } else if (date.toDateString() === tomorrow.toDateString()) {
                dateHeader = '⚡ MAÑANA';
            } else {
                dateHeader = date.toLocaleDateString('es-ES', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long'
                }).toUpperCase();
            }
        }

        const tasksHTML = tasksForDate.map(t => {
            const dateStr = t.pickup_date ? new Date(t.pickup_date).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }) : 'Sin fecha';
            const hasHeavyLoad = t.heavy_load || false;
            const isPickup = t.delivery_mode === 'pickup';
            const typeLabel = isPickup ? 'Recogida' : 'Entrega';
            const typeColor = isPickup ? 'brandPurple' : 'blue-500';

            return `
            <div class="driver-card p-6 rounded-[2.5rem] shadow-sm hover:shadow-xl border-2 ${isPickup ? 'border-brandPurple/10 hover:border-brandPurple/30' : 'border-blue-500/10 hover:border-blue-500/30'} transition-all duration-300">
                <div class="flex items-start justify-between mb-5">
                    <div class="flex items-center gap-4">
                        <div class="w-14 h-14 rounded-2xl ${isPickup ? 'bg-brandPurple/10 text-brandPurple' : 'bg-blue-500/10 text-blue-500'} flex items-center justify-center shrink-0">
                            <span class="material-symbols-outlined text-2xl">${isPickup ? 'inventory_2' : 'local_shipping'}</span>
                        </div>
                        <div>
                            <div class="flex items-center gap-2">
                                 <h3 class="heading-font font-black text-sm uppercase tracking-tighter leading-none">${t.full_name || 'Cliente'}</h3>
                                 <span class="px-2 py-0.5 rounded-md ${isPickup ? 'bg-brandPurple text-white' : 'bg-blue-500 text-white'} text-[7px] font-black uppercase tracking-widest">${typeLabel}</span>
                            </div>
                            <div class="flex items-center gap-1 mt-1.5 text-slate-500">
                                <span class="material-symbols-outlined text-[12px]">location_on</span>
                                <p class="text-[10px] font-bold uppercase truncate w-40">${t.pickup_address || t.address || 'Sin dirección'}</p>
                            </div>
                        </div>
                    </div>
                    <div class="flex flex-col items-end gap-1">
                        <span class="text-[10px] font-black ${isPickup ? 'text-brandPurple bg-brandPurple/5' : 'text-blue-500 bg-blue-500/5'} px-2 py-0.5 rounded-lg">${t.volume_m3 || 0} m³</span>
                    </div>
                </div>
                
                <div class="flex flex-wrap items-center gap-2 mb-6">
                    <!-- Información Logística Core -->
                    <span class="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest ${t.pickup_slot === 'morning' ? 'bg-orange-500/10 text-orange-400' : 'bg-blue-500/10 text-blue-400'} flex items-center gap-1.5 border border-white/5">
                        <span class="material-symbols-outlined text-[14px]">${t.pickup_slot === 'morning' ? 'light_mode' : 'dark_mode'}</span>
                        ${t.pickup_slot === 'morning' ? 'Mañana' : 'Tarde'}
                    </span>
                    
                    <!-- Tipo de Acceso -->
                    ${accessLabel[t.access_type] ? `
                    <span class="status-badge bg-white/5 text-slate-400">
                        <span class="material-symbols-outlined text-[14px] font-variation-settings-fill-1">${accessIcon[t.access_type] || 'stairs'}</span>
                        ${accessLabel[t.access_type]}
                    </span>
                    ` : ''}

                    <!-- Servicios Extra -->
                    ${t.extra_boxes > 0 ? `
                    <span class="status-badge bg-brandPurple/10 text-brandPurple">
                        <span class="material-symbols-outlined text-[14px]">package_2</span>
                        +${t.extra_boxes}
                    </span>` : ''}
                    ${t.extra_packing ? `
                    <span class="status-badge bg-brandPurple/10 text-brandPurple">
                        <span class="material-symbols-outlined text-[14px]">precision_manufacturing</span>
                        Embalar
                    </span>` : ''}
                    ${t.extra_assembly ? `
                    <span class="status-badge bg-brandPurple/10 text-brandPurple">
                        <span class="material-symbols-outlined text-[14px]">build</span>
                        Montar
                    </span>` : ''}
                    ${hasHeavyLoad ? `
                    <span class="status-badge bg-red-500/10 text-red-400 border border-red-500/10">
                        <span class="material-symbols-outlined text-[14px]">fitness_center</span>
                        Mozo
                    </span>` : ''}
                </div>

                <div class="flex gap-3">
                    <button onclick="pickTask('${t.id}')" class="w-full flex items-center justify-center gap-2 bg-brandPurple hover:bg-opacity-80 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.1em] text-white shadow-lg shadow-brandPurple/20 active:scale-95 transition-all">
                        <span class="material-symbols-outlined text-sm">add_task</span> Aceptar Servicio
                    </button>
                </div>
            </div>
        `;
        }).join('');

        return `
            <div class="mb-8">
                <!-- Encabezado de Fecha -->
                <div class="flex items-center gap-3 mb-4 px-2">
                    <div class="flex-1 h-[2px] bg-gradient-to-r from-transparent via-brandPurple/30 to-transparent"></div>
                    <h3 class="heading-font font-black text-xs tracking-wider text-brandPurple">${dateHeader}</h3>
                    <div class="flex-1 h-[2px] bg-gradient-to-r from-transparent via-brandPurple/30 to-transparent"></div>
                </div>
                <!-- Servicios del día -->
                <div class="space-y-3">
                    ${tasksHTML}
                </div>
            </div>
        `;
    }).join('');
}

function renderMyRoute(tasks) {
    const list = document.getElementById('my-route-list');
    const count = document.getElementById('count-my-route');
    if (!list) return;

    count.innerText = tasks.length;

    // --- Dynamic Summary Calculation ---
    const totalVol = tasks.reduce((acc, t) => acc + parseFloat(t.volume_m3 || 0), 0);
    const stopsCount = tasks.length;
    // Estimate: 30 min per stop + 15 min travel between (rough avg)
    const estimatedHours = ((stopsCount * 45) / 60).toFixed(1);

    document.getElementById('summary-stops').innerText = stopsCount;
    document.getElementById('summary-volume').innerText = `${totalVol.toFixed(1)}m³`;
    document.getElementById('summary-time').innerText = `~${estimatedHours}h`;

    // Verificar si ya hay algún servicio activo en la ruta actual
    const hasAnyActiveTask = tasks.some(t => t.status === 'in_transit' || t.status === 'picking_up');

    if (tasks.length === 0 && isWorkdayActive) {
        list.innerHTML = `
            <div class="p-12 text-center opacity-30">
                <span class="material-symbols-outlined text-4xl mb-2">route</span>
                <p class="text-[10px] font-black uppercase tracking-widest">Ruta completada</p>
                <button onclick="window.open('https://www.google.com/maps/search/?api=1&query=Poligono+Industrial+Pinto+Madrid', '_blank')" class="mt-6 px-6 py-3 bg-blue-600/10 text-blue-400 rounded-2xl text-[9px] font-black uppercase tracking-widest border border-blue-500/20">
                    🏁 Volver a Base (Pinto)
                </button>
            </div>
            <div class="px-2 mt-6">
                <button onclick="toggleWorkday()" class="w-full bg-red-600 text-white py-5 rounded-[2rem] heading-font font-black uppercase text-xs tracking-[0.2em] shadow-xl shadow-red-500/20 flex items-center justify-center gap-3 active:scale-95 transition-all">
                    <span class="material-symbols-outlined text-lg">stop_circle</span>
                    Finalizar Jornada
                </button>
            </div>
        `;
        return;
    }

    let html = "";

    // Si la jornada NO está iniciada, mostrar botón al principio
    if (!isWorkdayActive) {
        html += `
            <div class="px-2 mb-6">
                <div onclick="toggleWorkday()" class="bg-brandPurple/5 border-2 border-dashed border-brandPurple/20 rounded-[2.5rem] p-8 text-center cursor-pointer hover:bg-brandPurple/10 hover:border-brandPurple/40 active:scale-95 transition-all group">
                    <div class="w-16 h-16 bg-brandPurple/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                        <span class="material-symbols-outlined text-brandPurple text-3xl">play_arrow</span>
                    </div>
                    <h3 class="heading-font font-black text-sm uppercase text-slate-200 mb-2">¿Listo para empezar?</h3>
                    <p class="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-6 leading-relaxed">Inicia tu jornada para poder gestionar los servicios de hoy</p>
                    <div class="w-full bg-brandPurple text-white py-5 rounded-[2rem] heading-font font-black uppercase text-xs tracking-[0.2em] shadow-xl shadow-brandPurple/20">
                        Iniciar Jornada
                    </div>
                </div>
            </div>
        `;
    }

    html += tasks.map((t, index) => {
        const hasHeavyLoad = t.heavy_load || false;
        const isInTransit = t.status === 'in_transit';
        const isPickingUp = t.status === 'picking_up';
        const isPending = t.status === 'pending_pickup';
        const hasIncident = t.operational_incident_type != null;
        const isPickup = t.delivery_mode === 'pickup';

        // Determinar colores base según TIPO de servicio
        const typeColor = isPickup ? 'brandPurple' : 'blue-500';
        const defaultBorder = isPickup ? 'border-brandPurple/20' : 'border-blue-500/20';
        const typeLabel = isPickup ? 'Recogida' : 'Entrega';

        // Determinar colores y estilos según el ESTADO (Sobrescribe base)
        let cardBorder = hasIncident ? 'border-red-500/40 shadow-xl shadow-red-500/10' : `${defaultBorder} shadow-sm`;
        let iconBg = hasIncident ? 'bg-red-500' : (isPickup ? 'bg-brandPurple' : 'bg-blue-600');
        let textClass = hasIncident ? 'text-red-500' : (isPickup ? 'text-brandPurple' : 'text-blue-400');
        let statusBadge = '';

        if (hasIncident) {
            statusBadge = `<span class="status-badge bg-red-500/20 text-red-500 border-red-500/20">
                <span class="material-symbols-outlined text-[14px]">report_problem</span>
                ${t.operational_incident_type}
            </span>`;
        } else if (isInTransit) {
            cardBorder = 'border-orange-500/40 shadow-xl shadow-orange-500/10';
            iconBg = 'bg-orange-500';
            textClass = 'text-orange-500';
            const etaInfo = t.estimated_trip_minutes ? `<span class="opacity-60 font-black">(${t.estimated_trip_minutes} min)</span>` : '';
            statusBadge = `<span class="status-badge bg-orange-500/10 text-orange-500 border-orange-500/20 animate-pulse">
                <span class="material-symbols-outlined text-[14px]">local_shipping</span>
                En Camino ${etaInfo}
            </span>`;
        } else if (isPickingUp) {
            cardBorder = 'border-green-500/40 shadow-xl shadow-green-500/10';
            iconBg = 'bg-green-600';
            textClass = 'text-green-500';
            statusBadge = `<span class="status-badge bg-green-500/10 text-green-500 border-green-500/20 animate-pulse">
                <span class="material-symbols-outlined text-[14px] filled">inventory_2</span>
                Cargando
            </span>`;
        }

        const isLocked = isInTransit || isPickingUp;
        const dragClass = isLocked ? 'no-drag' : 'can-drag';

        return `
        <div class="driver-card p-5 rounded-[2.5rem] border-2 ${cardBorder} ${dragClass}" data-id="${t.id}" data-status="${t.status}">
            
            <div class="flex items-center justify-between mb-4">
                <div class="flex items-center gap-3 flex-1 min-w-0">
                    <div class="w-10 h-10 rounded-xl ${iconBg} text-white flex items-center justify-center font-black text-sm shrink-0">
                        ${isPickingUp ? '<span class="material-symbols-outlined">inventory_2</span>' : (isInTransit ? '<span class="material-symbols-outlined">local_shipping</span>' : index + 1)}
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2">
                            <h3 class="heading-font font-black text-[11px] uppercase tracking-tighter leading-none truncate">${t.full_name || 'Cliente'}</h3>
                            <span class="px-2 py-0.5 rounded-md ${isPickup ? 'bg-brandPurple' : 'bg-blue-600'} text-white text-[6px] font-black uppercase tracking-widest">${typeLabel}</span>
                        </div>
                        <p class="text-[9px] font-bold ${textClass} mt-1 uppercase truncate">${t.pickup_address || t.address || 'Dirección no especificada'}</p>
                    </div>
                </div>
                <div class="flex gap-2">
                    <button ${isWorkdayActive && !isPending ? `onclick="${hasIncident ? `revertIncident('${t.id}')` : `openIssueModal('${t.id}')`}"` : ''} 
                        class="w-10 h-10 rounded-xl ${(!isWorkdayActive || isPending) ? 'opacity-20 bg-slate-800/50 text-slate-600 pointer-events-none' : (hasIncident ? 'bg-red-500 text-white shadow-lg shadow-red-500/30' : 'bg-red-500/10 text-red-500')} flex items-center justify-center shrink-0 hover:scale-110 transition-all">
                        <span class="material-symbols-outlined text-lg">${hasIncident ? 'undo' : 'report_problem'}</span>
                    </button>
                    <a ${isWorkdayActive ? `href="tel:${t.phone}"` : ''} class="w-10 h-10 rounded-xl ${isWorkdayActive ? 'bg-blue-600/10 text-blue-500 hover:bg-blue-600/20 shadow-lg shadow-blue-500/5' : 'bg-slate-800/50 text-slate-600 opacity-20'} flex items-center justify-center shrink-0 transition-colors">
                        <span class="material-symbols-outlined text-lg">call</span>
                    </a>
                </div>
            </div>

            <div class="flex items-center gap-2 flex-wrap mb-4">
                <span class="status-badge bg-blue-500/10 text-blue-400">
                    ${t.volume_m3 || 0} m³
                </span>
                <span class="status-badge ${t.pickup_slot === 'morning' ? 'bg-orange-500/10 text-orange-400' : 'bg-indigo-500/10 text-indigo-400'}">
                    <span class="material-symbols-outlined text-[14px]">${t.pickup_slot === 'morning' ? 'light_mode' : 'dark_mode'}</span>
                    ${t.pickup_slot === 'morning' ? 'Mañana' : 'Tarde'}
                </span>
                
                <!-- Info de Acceso y Extras -->
                ${accessLabel[t.access_type] ? `
                <span class="status-badge bg-white/5 text-slate-400">
                    <span class="material-symbols-outlined text-[14px]">${accessIcon[t.access_type] || 'stairs'}</span>
                    ${accessLabel[t.access_type]}
                </span>
                ` : ''}

                ${t.extra_boxes > 0 ? `
                <span class="status-badge bg-brandPurple/10 text-brandPurple">
                    <span class="material-symbols-outlined text-[14px]">package_2</span>
                    +${t.extra_boxes}
                </span>` : ''}

                ${t.extra_packing ? `
                <span class="status-badge bg-brandPurple/10 text-brandPurple">
                    <span class="material-symbols-outlined text-[14px]">precision_manufacturing</span>
                    Embalar
                </span>` : ''}
                
                ${hasHeavyLoad ? `
                <span class="status-badge bg-red-500/10 text-red-400 border border-red-500/10">
                    <span class="material-symbols-outlined text-[14px]">fitness_center</span>
                    Mozo
                </span>` : ''}
                
                ${statusBadge}
            </div>

            <div class="flex flex-col gap-2">
                <div class="grid grid-cols-2 gap-2">
                    <button onclick="openNavigationModal('${(t.pickup_address || t.address || '').replace(/'/g, "\\'")}', '${(t.pickup_city || t.city || '').replace(/'/g, "\\'")}')" 
                        class="flex items-center justify-center gap-2 bg-white/5 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-400 border border-white/5 shadow-sm active:scale-95 transition-all hover:bg-white/10 hover:text-white">
                        <span class="material-symbols-outlined text-sm text-slate-500">near_me</span> Navegar
                    </button>
                    <button onclick="${(isWorkdayActive && isPickingUp) ? `openEvidenceModal('${t.id}')` : ''}" 
                        class="flex items-center justify-center gap-2 bg-white/5 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest ${(isWorkdayActive && isPickingUp) ? 'text-slate-400' : 'text-slate-700 opacity-20 pointer-events-none'} border border-white/5">
                        <span class="material-symbols-outlined text-sm text-slate-500">photo_library</span> Evidencia
                    </button>
                </div>

                <div class="${!isWorkdayActive ? 'opacity-20 grayscale pointer-events-none' : ''} flex flex-col gap-2">

                ${isPickingUp ? `
                    <button onclick="startMultiTrip('${t.id}', ${hasHeavyLoad})" class="w-full flex items-center justify-center gap-2 bg-blue-500/10 text-blue-600 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest border border-blue-500/20 mb-1">
                        <span class="material-symbols-outlined text-sm">repeat</span> Lleno: 2º Viaje
                    </button>
                ` : ''}

                ${isPending ? `
                    <button onclick="notifyEnRoute('${t.id}')" 
                        ${(hasAnyActiveTask || index > 0) ? 'disabled' : ''}
                        class="w-full flex items-center justify-center gap-2 ${(hasAnyActiveTask || index > 0) ? 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50' : 'bg-[#6E44FF] text-white shadow-lg shadow-purple-500/20 active:scale-95'} py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">
                        <span class="material-symbols-outlined text-sm">local_shipping</span> Voy para allá!
                    </button>
                    ${(index > 0 && !hasAnyActiveTask) ? `
                        <p class="text-[7px] text-center font-bold text-slate-500 uppercase tracking-widest mt-1 opacity-60">Sube este servicio al 1º puesto para iniciarlo</p>
                    ` : ''}
                ` : (isInTransit ? `
                    <div class="flex flex-col gap-1 w-full">
                        <button onclick="startPickup('${t.id}')" class="w-full flex items-center justify-center gap-2 bg-orange-500 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-orange-500/20 active:scale-95 transition-all">
                            <span class="material-symbols-outlined text-sm">home_pin</span> He llegado
                        </button>
                        <button onclick="revertEnRoute('${t.id}')" class="w-full text-[8px] font-black text-slate-400 uppercase tracking-widest hover:text-red-500 transition-colors py-1">
                            ↺ Deshacer "En Camino"
                        </button>
                    </div>
                ` : `
                    <button onclick="completePickup('${t.id}')" class="w-full flex items-center justify-center gap-2 bg-green-600 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-green-500/20 active:scale-95 transition-all">
                        <span class="material-symbols-outlined text-sm">task_alt</span> Finalizar Servicio
                    </button>
                `)}
                </div>
            </div>
        </div>
        `;
    }).join('');

    // Si la jornada ESTÁ iniciada, añadir botón de finalizar al final
    if (isWorkdayActive) {
        html += `
            <div class="px-2 mt-8 pt-4 border-t border-white/5">
                <button onclick="toggleWorkday()" class="w-full bg-red-600/10 text-red-500 border border-red-500/20 py-5 rounded-[2rem] heading-font font-black uppercase text-xs tracking-[0.2em] flex items-center justify-center gap-3 active:scale-95 transition-all mb-8">
                    <span class="material-symbols-outlined text-lg">stop_circle</span>
                    Finalizar mi Jornada
                </button>
            </div>
            `;
    }

    list.innerHTML = html;

    // Actualizar Widget
    updateWorkdayWidget();

    // Inicializar SortableJS después de renderizar
    setTimeout(() => {
        initializeSortable();
    }, 100);
}

async function pickTask(taskId) {
    if (!requireWorkday()) return;

    openConfirmModal({
        title: '¿Aceptar este servicio?',
        desc: 'Se añadirá automáticamente a tu hoja de ruta de hoy.',
        icon: 'add_task',
        btnText: 'Añadir a mi ruta',
        onConfirm: async () => {
            try {
                const { data: { session } } = await window.supabaseClient.auth.getSession();
                const { error } = await window.supabaseClient
                    .from('leads_wizard')
                    .update({
                        assigned_driver_id: session.user.id,
                        assigned_at: new Date().toISOString(),
                        status: 'pending_pickup'
                    })
                    .eq('id', taskId);

                if (error) throw error;
                if (navigator.vibrate) navigator.vibrate(50);
                switchTab('my-route');
                await fetchTasks();
            } catch (err) {
                console.error("❌ Error picking task:", err);
                showError('Error al aceptar el servicio: ' + err.message);
            }
        }
    });
}

async function startPickup(taskId) {
    if (!requireWorkday()) return;

    openConfirmModal({
        title: '¿He llegado al destino?',
        desc: 'Se activará el cronómetro y el cliente sabrá que ya estás cargando.',
        icon: 'home_pin',
        btnText: 'Confirmar Llegada',
        type: 'warning',
        onConfirm: async () => {
            console.log('👉 Iniciando carga para:', taskId);
            try {
                const { error } = await window.supabaseClient
                    .from('leads_wizard')
                    .update({
                        status: 'picking_up',
                        pickup_started_at: new Date().toISOString()
                    })
                    .eq('id', taskId);

                if (error) throw error;
                if (navigator.vibrate) navigator.vibrate([50, 100, 50]);
                await fetchTasks();
                console.log('✅ Recogida iniciada');
            } catch (err) {
                console.error("❌ Error starting pickup:", err);
                showError('Error al iniciar recogida: ' + err.message);
            }
        }
    });
}

let completionTimer = null;
let currentCompletionTaskId = null;

async function completePickup(taskId) {
    if (!requireWorkday()) return;
    const task = allTasks.find(t => t.id === taskId);
    if (!task) return;

    if (!task.pickup_started_at) {
        showError('No se puede completar un servicio que no ha sido iniciado correctamente.');
        return;
    }

    currentCompletionTaskId = taskId;
    const modal = document.getElementById('completionModal');

    // Pre-rellenar datos si existen
    document.getElementById('completion-dni').value = task.dni_cif || task.dni || '';
    document.getElementById('completion-name').value = task.full_name || '';

    // Iniciar cronómetro y cálculo de cargos con info del mozo
    const hasMozo = task.heavy_load || false;
    startCompletionCalculations(task.pickup_started_at, hasMozo);

    // Configurar acción del botón de guardado
    document.getElementById('btn-submit-completion').onclick = () => submitServiceCompletion(taskId);

    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    // Inicializar el Pad de Firma
    setTimeout(initSignaturePad, 300);
}

let isSigning = false;
let hasSigned = false;

function initSignaturePad() {
    const canvas = document.getElementById('signature-pad');
    const placeholder = document.getElementById('signature-placeholder');
    if (!canvas) return;

    // Ajustar tamaño al contenedor
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#0A0510';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    hasSigned = false;

    function startPosition(e) {
        isSigning = true;
        placeholder.classList.add('hidden');
        draw(e);
    }

    function finishedPosition() {
        isSigning = false;
        ctx.beginPath();
        hasSigned = true;
    }

    function draw(e) {
        if (!isSigning) return;

        const pos = getMousePos(canvas, e);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
    }

    function getMousePos(canvas, evt) {
        const rect = canvas.getBoundingClientRect();
        const clientX = evt.touches ? evt.touches[0].clientX : evt.clientX;
        const clientY = evt.touches ? evt.touches[0].clientY : evt.clientY;
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    }

    // Eventos Mouse (Desktop)
    canvas.addEventListener('mousedown', startPosition);
    canvas.addEventListener('mouseup', finishedPosition);
    canvas.addEventListener('mousemove', draw);

    // Eventos Touch (Móvil) - Usamos passive: false para poder bloquear el scroll mientras se firma
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        startPosition(e.touches[0]);
    }, { passive: false });

    canvas.addEventListener('touchend', (e) => {
        e.preventDefault();
        finishedPosition();
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        draw(e.touches[0]);
    }, { passive: false });
}

window.clearSignature = function () {
    const canvas = document.getElementById('signature-pad');
    const placeholder = document.getElementById('signature-placeholder');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    placeholder.classList.remove('hidden');
    hasSigned = false;
};

window.handlePhotoSelect = function (input, index) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        const preview = document.getElementById(`preview-${index}`);
        const placeholder = document.getElementById(`placeholder-${index}`);
        const img = preview.querySelector('img');

        reader.onload = function (e) {
            img.src = e.target.result;
            preview.classList.remove('hidden');
            placeholder.classList.add('hidden');
        };

        reader.readAsDataURL(input.files[0]);
    }
};

function startCompletionCalculations(startTimeStr, hasMozo) {
    const startTime = new Date(startTimeStr);
    const timeEl = document.getElementById('time-elapsed');
    const chargeEl = document.getElementById('extra-charge-preview');
    const mozoAlert = document.getElementById('mozo-charge-alert');
    const freeMsg = document.getElementById('free-time-msg');

    if (completionTimer) clearInterval(completionTimer);

    // Mostrar/Ocultar alerta de mozo
    if (hasMozo) {
        mozoAlert.classList.remove('hidden');
    } else {
        mozoAlert.classList.add('hidden');
    }

    completionTimer = setInterval(() => {
        const now = new Date();
        const diffMs = now - startTime;

        // Formatear tiempo HH:MM:SS
        const hours = Math.floor(diffMs / 3600000);
        const minutes = Math.floor((diffMs % 3600000) / 60000);
        const seconds = Math.floor((diffMs % 60000) / 1000);
        timeEl.innerText = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} `;

        // Lógica de cargos extra según PLAN_DE_IMPLANTACION (Ajustada a 15 min cortesía)
        const diffMinutes = Math.floor(diffMs / 60000);
        const FREE_MINUTES = 15;
        const BASE_EXTRA_CHARGE = 15; // 15€ cada 15 min por operario
        const UNIT_MINUTES = 15;

        let extraCharge = 0;
        if (diffMinutes > FREE_MINUTES) {
            const extraUnits = Math.ceil((diffMinutes - FREE_MINUTES) / UNIT_MINUTES);
            const multiplier = hasMozo ? 2 : 1; // Doble si hay mozo
            extraCharge = extraUnits * BASE_EXTRA_CHARGE * multiplier;

            // Ocultar mensaje de "gratis" si ya hay cargo
            freeMsg.classList.add('hidden');
        } else {
            freeMsg.classList.remove('hidden');
        }

        chargeEl.innerText = extraCharge.toFixed(2) + '€';
    }, 1000);
}

function closeCompletionModal() {
    document.getElementById('completionModal').classList.add('hidden');
    document.body.style.overflow = '';
    if (completionTimer) clearInterval(completionTimer);
}

async function submitServiceCompletion(taskId) {
    const notes = document.getElementById('completion-notes').value;
    const dni = document.getElementById('completion-dni').value;
    const receiverName = document.getElementById('completion-name').value;

    if (!dni || dni.length < 5) {
        showError('Es obligatorio introducir el DNI/NIE de quien recibe o entrega los bultos.');
        return;
    }

    if (!hasSigned) {
        showError('Es necesaria la firma del cliente para finalizar el servicio.');
        return;
    }

    const btn = document.getElementById('btn-submit-completion');
    btn.disabled = true;
    btn.innerText = 'Guardando...';

    try {
        const task = allTasks.find(t => t.id === taskId);
        const startTime = new Date(task.pickup_started_at);
        const endTime = new Date();
        const diffMinutes = Math.floor((endTime - startTime) / 60000);

        // A. CAPTURAR Y SUBIR EVIDENCIAS (Firma y Fotos)
        const evidenceUrls = { photos: [] };

        try {
            // 1. Subir Firma
            const canvas = document.getElementById('signature-pad');
            const signatureBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
            const signaturePath = `signatures/${taskId}_${Date.now()}.png`;

            const { data: sigData, error: sigErr } = await window.supabaseClient.storage
                .from('evidences')
                .upload(signaturePath, signatureBlob, {
                    contentType: 'image/png',
                    cacheControl: '3600',
                    upsert: false
                });

            if (!sigErr) evidenceUrls.signature = signaturePath;

            // 2. Subir Fotos
            for (let i = 1; i <= 3; i++) {
                const input = document.querySelector(`input[onchange*="handlePhotoSelect(this, ${i})"]`);
                if (input && input.files[0]) {
                    const photoFile = input.files[0];
                    const photoPath = `photos/${taskId}_${i}_${Date.now()}.jpg`;
                    const { data: photoData, error: photoErr } = await window.supabaseClient.storage
                        .from('evidences')
                        .upload(photoPath, photoFile, {
                            contentType: photoFile.type || 'image/jpeg',
                            cacheControl: '3600',
                            upsert: false
                        });

                    if (!photoErr) {
                        evidenceUrls.photos.push(photoPath);
                        console.log(`✅ Foto ${i} subida: ${photoPath}`);
                    } else {
                        console.error(`❌ Error subiendo Foto ${i}:`, photoErr);
                    }
                }
            }
        } catch (storageErr) {
            console.error("❌ Error crítico en subida de evidencias:", storageErr);
            // No bloqueamos el proceso, pero lo registramos
        }

        // B. ACTUALIZAR EL LEAD
        const { error: leadErr } = await window.supabaseClient
            .from('leads_wizard')
            .update({
                status: 'completed',
                completed_at: endTime.toISOString(),
                operational_incident_type: null,
                driver_notes: notes,
                receiver_dni: dni,
                receiver_name: receiverName,
                total_work_minutes: diffMinutes,
                operational_evidence: {
                    ...(task.operational_evidence || {}),
                    ...evidenceUrls,
                    final_time_minutes: diffMinutes,
                    final_extra_charge: (diffMinutes > COURTESY_MINUTES) ? (Math.ceil((diffMinutes - COURTESY_MINUTES) / UNIT_MINUTES) * UNIT_PRICE * (task.heavy_load ? 2 : 1)) : 0
                }
            })
            .eq('id', taskId);

        if (leadErr) throw leadErr;

        // 2. Lógica de cargos extra según PLAN_DE_IMPLANTACION:
        // "Descuenta los 15 min de cortesía iniciales y divide el resto en bloques de 15 min facturables (15€)"
        const COURTESY_MINUTES = 15;
        const UNIT_PRICE = 15;
        const UNIT_MINUTES = 15;

        if (diffMinutes > COURTESY_MINUTES) {
            const billableMinutes = diffMinutes - COURTESY_MINUTES;
            const extraUnits = Math.ceil(billableMinutes / UNIT_MINUTES);
            const multiplier = task.heavy_load ? 2 : 1; // Doble si hay mozo extra
            const amount = extraUnits * UNIT_PRICE * multiplier;

            // Registrar el pago automático por tiempo extra
            await window.supabaseClient.from('payments').insert({
                client_id: taskId,
                client_email: task.email,
                client_name: task.full_name,
                amount: amount,
                concept: `Cargo Extra Tiempo: ${billableMinutes} min adicionales`,
                payment_type: 'time_extra',
                status: 'completed', // Pasa directamente al cobro
                created_by: 'system-driver'
            });
        }

        if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 100]);

        closeCompletionModal();
        await fetchTasks();

        showSuccess('Servicio completado y registrado correctamente');

    } catch (err) {
        console.error("❌ Error submitting completion:", err);
        showError('Error al finalizar: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.innerText = 'Finalizar y Guardar';
    }
}

function viewTaskDetails(taskId) {
    const task = allTasks.find(t => t.id === taskId);
    if (!task) return;

    const dateStr = task.pickup_date ? new Date(task.pickup_date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }) : 'Sin fecha';

    const modalContent = `
            < div class="space-y-4" >
            <div class="text-center pb-4 border-b border-slate-100">
                <h2 class="heading-font font-black text-lg uppercase tracking-tighter">${task.full_name || 'Cliente'}</h2>
                <p class="text-xs text-slate-500 mt-1">${task.email || ''}</p>
                ${task.phone ? `<p class="text-xs text-blue-600 font-bold mt-1">${task.phone}</p>` : ''}
            </div>

            <div class="space-y-3">
                <div>
                    <p class="text-[8px] font-black uppercase text-slate-400 mb-1">Dirección de Recogida</p>
                    <p class="text-sm font-bold">${task.pickup_address || task.address || 'No especificada'}</p>
                    <p class="text-xs text-slate-500">${task.pickup_city || task.city || ''} ${task.pickup_postal_code || task.postal_code || ''}</p>
                </div>

                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <p class="text-[8px] font-black uppercase text-slate-400 mb-1">Fecha</p>
                        <p class="text-sm font-bold">${dateStr}</p>
                    </div>
                    <div>
                        <p class="text-[8px] font-black uppercase text-slate-400 mb-1">Horario</p>
                        <p class="text-sm font-bold">${task.pickup_slot === 'morning' ? '🌅 Mañana (09:00-14:00)' : '🌙 Tarde (15:00-18:00)'}</p>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <p class="text-[8px] font-black uppercase text-slate-400 mb-1">Volumen</p>
                        <p class="text-sm font-bold text-brandPurple">${task.volume_m3 || 0} m³</p>
                    </div>
                    <div>
                        <p class="text-[8px] font-black uppercase text-slate-400 mb-1">Tipo de Carga</p>
                        <p class="text-sm font-bold ${task.heavy_load ? 'text-red-600' : 'text-green-600'}">${task.heavy_load ? '💪 Pesada (Mozo)' : '📦 Estándar'}</p>
                    </div>
                </div>

                <div class="bg-slate-50 rounded-xl p-3">
                    <p class="text-[8px] font-black uppercase text-slate-500 mb-2">Tipo de Acceso</p>
                    <p class="text-sm font-bold text-slate-700">${accessLabel[task.access_type] || 'No especificado'}</p>
                </div>

                <div class="grid grid-cols-2 gap-3">
                    <div class="bg-slate-50 rounded-xl p-3">
                        <p class="text-[8px] font-black uppercase text-slate-400 mb-1">Cajas Extra</p>
                        <p class="text-sm font-bold">${task.extra_boxes || 0} ud.</p>
                    </div>
                    <div class="bg-slate-50 rounded-xl p-3">
                        <p class="text-[8px] font-black uppercase text-slate-400 mb-1">Modo Entrega</p>
                        <p class="text-sm font-bold uppercase text-[10px]">${task.delivery_mode === 'pickup' ? 'Recogida' : 'Almacén'}</p>
                    </div>
                </div>

                ${(task.extra_packing || task.extra_assembly) ? `
                <div class="flex flex-wrap gap-2">
                    ${task.extra_packing ? '<span class="px-2 py-1 rounded bg-blue-50 text-blue-600 text-[8px] font-black uppercase">Embalaje</span>' : ''}
                    ${task.extra_assembly ? '<span class="px-2 py-1 rounded bg-indigo-50 text-indigo-600 text-[8px] font-black uppercase">Desmontaje</span>' : ''}
                </div>
                ` : ''}

                ${task.admin_notes ? `
                <div class="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                    <p class="text-[8px] font-black uppercase text-yellow-700 mb-1">⚠️ Notas del Admin</p>
                    <p class="text-xs text-yellow-900">${task.admin_notes}</p>
                </div>
                ` : ''}
            </div>

            <button onclick="closeModal()" class="w-full bg-brandDark text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest mt-4">
                Cerrar
            </button>
        </div >
            `;

    document.getElementById('modal-content').innerHTML = modalContent;
    document.getElementById('taskModal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('taskModal').classList.add('hidden');
}

function renderHistory(tasks) {
    const list = document.getElementById('history-list');
    const count = document.getElementById('count-history');
    if (!list) return;

    count.innerText = tasks.length;

    if (tasks.length === 0) {
        list.innerHTML = `
            <div class="p-12 text-center opacity-30">
                <span class="material-symbols-outlined text-4xl mb-2">history</span>
                <p class="text-[10px] font-black uppercase tracking-widest">Sin tareas completadas hoy</p>
            </div>
            `;
        return;
    }

    list.innerHTML = tasks.map(t => {
        const timeStr = t.completed_at ? new Date(t.completed_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '--:--';
        const isPickup = t.delivery_mode === 'pickup';

        return `
            <div onclick="showServiceDetails('${t.id}')" class="driver-card p-5 rounded-[2.5rem] border-2 border-white/5 opacity-80 hover:opacity-100 hover:border-brandPurple/30 transition-all cursor-pointer">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl ${isPickup ? 'bg-brandPurple/10 text-brandPurple' : 'bg-blue-500/10 text-blue-500'} flex items-center justify-center">
                            <span class="material-symbols-outlined text-xl">check_circle</span>
                        </div>
                        <div>
                            <h3 class="heading-font font-black text-[12px] uppercase tracking-tighter leading-none">${t.full_name || 'Cliente'}</h3>
                            <div class="flex items-center gap-1 mt-1 text-slate-500">
                                <span class="material-symbols-outlined text-[10px]">location_on</span>
                                <p class="text-[9px] font-bold uppercase truncate w-32">${t.pickup_address || t.address}</p>
                            </div>
                        </div>
                    </div>
                    <div class="text-right">
                         <span class="px-2 py-0.5 rounded-md ${isPickup ? 'bg-brandPurple/10 text-brandPurple' : 'bg-blue-500/10 text-blue-500'} text-[7px] font-black uppercase tracking-widest block mb-1">
                            ${isPickup ? 'RECOGIDA' : 'ENTREGA'}
                         </span>
                        <p class="text-[10px] font-black text-slate-400">${timeStr}</p>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function switchTab(tab) {
    currentTab = tab;
    document.getElementById('section-available').classList.toggle('hidden', tab !== 'available');
    document.getElementById('section-my-route').classList.toggle('hidden', tab !== 'my-route');
    document.getElementById('section-history').classList.toggle('hidden', tab !== 'history');

    // Tab visuals & Pill Animation
    const tabs = ['available', 'my-route', 'history'];
    const pill = document.getElementById('tab-pill');

    tabs.forEach((t, index) => {
        const btn = document.getElementById(`tab-${t}`);
        if (btn) {
            const isActive = tab === t;
            btn.classList.toggle('active', isActive);

            if (isActive && pill) {
                pill.style.left = `calc(${index * 33.33}% + 6px)`;
            }
        }
    });

    if (tab === 'my-route') {
        updateWorkdayWidget();
    }
}

function showError(message, title = 'Atención') {
    openConfirmModal({
        title: title,
        desc: message,
        icon: 'error',
        type: 'warning',
        btnText: 'Entendido',
        onConfirm: () => { }
    });
}

function showSuccess(message, title = '¡Éxito!') {
    openConfirmModal({
        title: title,
        desc: message,
        icon: 'check_circle',
        type: 'success',
        btnText: 'Genial',
        onConfirm: () => { }
    });
}

function logout() {
    openConfirmModal({
        title: '¿Cerrar sesión?',
        desc: 'Se cerrará tu acceso operativo actual.',
        icon: 'logout',
        btnText: 'Cerrar Sesión',
        type: 'warning',
        onConfirm: async () => {
            await window.supabaseClient.auth.signOut();
            window.location.href = 'driver_login.html';
        }
    });
}
// --- MODAL DE CONFIRMACIÓN PERSOALIZADO ---

window.openConfirmModal = function (options) {
    const modal = document.getElementById('confirmModal');
    const sheet = document.getElementById('confirmModalSheet');
    const title = document.getElementById('confirm-title');
    const desc = document.getElementById('confirm-desc');
    const icon = document.getElementById('confirm-icon');
    const iconContainer = document.getElementById('confirm-icon-container');
    const btnYes = document.getElementById('confirm-btn-yes');

    // Configurar contenido
    title.innerText = options.title || '¿Estás seguro?';
    desc.innerText = options.desc || 'Confirma para continuar';
    icon.innerText = options.icon || 'help';
    btnYes.innerText = options.btnText || 'Confirmar';

    // Configurar colores si se pasan
    if (options.type === 'success') {
        iconContainer.className = "w-20 h-20 rounded-[2rem] bg-green-50 flex items-center justify-center mx-auto mb-6 text-green-500";
        btnYes.className = "w-full bg-green-600 text-white py-5 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-xl shadow-green-500/20 active:scale-95 transition-all";
    } else if (options.type === 'warning') {
        iconContainer.className = "w-20 h-20 rounded-[2rem] bg-orange-50 flex items-center justify-center mx-auto mb-6 text-orange-500";
        btnYes.className = "w-full bg-orange-500 text-white py-5 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-xl shadow-orange-500/20 active:scale-95 transition-all";
    } else {
        iconContainer.className = "w-20 h-20 rounded-[2rem] bg-blue-50 flex items-center justify-center mx-auto mb-6 text-blue-500";
        btnYes.className = "w-full bg-[#6E44FF] text-white py-5 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-xl shadow-[#6E44FF]/20 active:scale-95 transition-all";
    }

    // Acción del botón
    btnYes.onclick = async () => {
        await options.onConfirm();
        closeConfirmModal();
    };

    // Mostrar modal
    modal.classList.remove('hidden');
    setTimeout(() => {
        sheet.style.transform = 'translateY(0)';
    }, 10);
};

window.closeConfirmModal = function () {
    const modal = document.getElementById('confirmModal');
    const sheet = document.getElementById('confirmModalSheet');

    sheet.style.transform = 'translateY(100%)';
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
};

// --- SORTABLEJS PARA DRAG & DROP ROBUSTO ---

let sortableInstance = null;

function initializeSortable() {
    const myRouteList = document.getElementById('my-route-list');
    if (!myRouteList) return;

    // Destruir instancia anterior si existe
    if (sortableInstance) {
        sortableInstance.destroy();
    }

    // Inicializar SortableJS
    sortableInstance = Sortable.create(myRouteList, {
        animation: 200,
        ghostClass: 'dragging',
        chosenClass: 'drag-over',
        dragClass: 'dragging',
        filter: '.no-drag',
        preventOnFilter: false,
        delay: 50, // Pequeño delay para permitir scroll en móvil
        delayOnTouchOnly: true, // Solo en táctil para no penalizar desktop
        handle: '.can-drag',
        forceFallback: true, // Forzar fallback para mejor control de eventos
        fallbackTolerance: 3, // Tolerancia al mover antes de iniciar drag
        onMove: function (evt) {
            // No permitir mover un elemento por encima de uno que ya esté iniciado
            const targetStatus = evt.related.getAttribute('data-status');
            if (targetStatus === 'in_transit' || targetStatus === 'picking_up') {
                return false;
            }
        },
        onEnd: async function (evt) {
            console.log('🎯 SORTABLE - oldIndex:', evt.oldIndex, 'newIndex:', evt.newIndex);

            if (evt.oldIndex === evt.newIndex) {
                console.log('⚠️ Mismo índice, cancelando');
                return;
            }

            try {
                const { data: { session } } = await window.supabaseClient.auth.getSession();
                const userId = session?.user?.id;

                // Obtener el nuevo orden de los IDs desde el DOM
                const cards = Array.from(myRouteList.querySelectorAll('.driver-card'));
                const newOrder = cards.map(card => card.getAttribute('data-id'));

                console.log('📋 Nuevo orden de IDs:', newOrder);

                // Actualizar base de datos
                console.log('💾 Actualizando BD...');
                for (let i = 0; i < newOrder.length; i++) {
                    await window.supabaseClient
                        .from('leads_wizard')
                        .update({ route_order: i + 1 })
                        .eq('id', newOrder[i]);
                }

                console.log('✅ BD actualizada');
                if (navigator.vibrate) navigator.vibrate(50);

                // Esperar un momento y recargar
                await new Promise(resolve => setTimeout(resolve, 300));
                await fetchTasks();

                console.log('🔄 Recarga completada');
            } catch (err) {
                console.error("❌ Error reordering route:", err);
            }
        }
    });

    console.log('✅ SortableJS inicializado');
}

window.optimizeMyRoute = async function () {
    try {
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        const userId = session?.user?.id;

        const myTasks = allTasks.filter(l =>
            (l.status === 'pending_pickup' || l.status === 'in_transit') &&
            l.assigned_driver_id === userId
        );

        if (myTasks.length < 2) {
            openConfirmModal({
                title: 'Aviso',
                desc: 'Necesitas al menos 2 paradas para optimizar.',
                icon: 'info',
                btnText: 'Entendido',
                onConfirm: () => { }
            });
            return;
        }

        openConfirmModal({
            title: 'Optimizar Ruta',
            desc: '¿Quieres que la IA recalcule el orden más eficiente de tus paradas?',
            icon: 'bolt',
            btnText: 'Optimizar Ahora',
            onConfirm: async () => {
                // Optimización simple por dirección (alfabética) para la demo
                // Empieza y termina en Pinto (Artes Gráficas 7)
                myTasks.sort((a, b) => (a.pickup_address || '').localeCompare(b.pickup_address || ''));

                for (let i = 0; i < myTasks.length; i++) {
                    await window.supabaseClient
                        .from('leads_wizard')
                        .update({ route_order: i + 1 })
                        .eq('id', myTasks[i].id);
                }

                await fetchTasks();
                if (navigator.vibrate) navigator.vibrate([30, 10, 30]);
            }
        });
    } catch (err) {
        console.error("❌ Error optimizing route:", err);
    }
};

window.viewFullRouteMap = async function () {
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    const userId = session?.user?.id;

    // Filtrar tareas asignadas a este conductor que no estén completadas
    const myTasks = allTasks.filter(l =>
        (l.status === 'pending_pickup' || l.status === 'in_transit' || l.status === 'picking_up') &&
        l.assigned_driver_id === userId
    ).sort((a, b) => (a.route_order || 999) - (b.route_order || 999));

    if (myTasks.length === 0) {
        openConfirmModal({
            title: 'Ruta Vacía',
            desc: 'No tienes servicios asignados en tu ruta actual.',
            icon: 'map',
            btnText: 'Entendido',
            onConfirm: () => { }
        });
        return;
    }

    // Generar URL de Google Maps con nombres de paradas numerados
    const baseUrl = 'https://www.google.com/maps/dir/?api=1';

    // Origen: Almacén
    const origin = encodeURIComponent(`ALMACÉN BOXROOMER: ${WAREHOUSE_LOCATION.address}`);

    // Destino: última parada (numerada)
    const lastIdx = myTasks.length - 1;
    const lastTask = myTasks[lastIdx];
    const destination = encodeURIComponent(`${lastIdx + 1}. ${lastTask.pickup_address || lastTask.address}, ${lastTask.pickup_city || lastTask.city}`);

    // Waypoints: todas las paradas intermedias (numeradas)
    let waypoints = '';
    if (myTasks.length > 1) {
        waypoints = myTasks.slice(0, -1)
            .map((t, i) => encodeURIComponent(`${i + 1}. ${t.pickup_address || t.address}, ${t.pickup_city || t.city}`))
            .join('|');
    }

    // Construir URL (sin espacios internos que rompan Google Maps)
    let url = `${baseUrl}&origin=${origin}&destination=${destination}`;
    if (waypoints) {
        url += `&waypoints=${waypoints}`;
    }
    url += '&travelmode=driving';

    console.log('🗺️ Abriendo mapa de ruta con nombres numerados');
    window.open(url, '_blank');
};

window.removeFromRoute = async function (taskId) {
    openConfirmModal({
        title: '¿Quitar de la ruta?',
        desc: 'El servicio volverá a la bandeja de pendientes para que otro conductor pueda aceptarlo.',
        icon: 'delete',
        btnText: 'Eliminar de mi ruta',
        type: 'warning',
        onConfirm: async () => {
            try {
                const { error } = await window.supabaseClient
                    .from('leads_wizard')
                    .update({
                        assigned_driver_id: null,
                        assigned_at: null,
                        status: 'confirmed',
                        route_order: 999
                    })
                    .eq('id', taskId);

                if (error) throw error;
                await fetchTasks();
                if (navigator.vibrate) navigator.vibrate([10, 50, 10]);
            } catch (err) {
                console.error("❌ Error removing task:", err);
            }
        }
    });
};

// --- New Operational Functions (Premium Recommendation) ---

let currentTaskIdForAction = null;

window.openIssueModal = function (taskId) {
    currentTaskIdForAction = taskId;
    document.getElementById('issueModal').classList.remove('hidden');
};

window.submitIssue = async function (type) {
    if (!currentTaskIdForAction) return;

    const issues = {
        'no_en_casa': 'Cliente Ausente / No responde',
        'acceso_bloqueado': 'Acceso Bloqueado / Imposible',
        'material_necesario': 'Material Extra Necesario',
        'otro': 'Otro (Revisar observaciones)'
    };

    try {
        const task = allTasks.find(t => t.id === currentTaskIdForAction);

        const updateData = {
            operational_incident_type: issues[type],
            operational_incident_at: new Date().toISOString()
        };

        // Lógica de "Cliente Ausente": Liberar ruta y crear penalización
        if (type === 'no_en_casa' && task) {
            updateData.status = 'confirmed'; // Vuelve a estar disponible para reprogramar
            updateData.assigned_driver_id = null; // Liberamos al conductor
            updateData.assigned_at = null;

            // Crear cargo automático por transporte fallido
            await window.supabaseClient.from('payments').insert({
                client_id: task.id,
                client_email: task.email,
                client_name: task.full_name,
                amount: 45, // Coste base de transporte por intento fallido
                concept: 'Recogida fallida (Cliente Ausente) - Cargo por Transporte',
                payment_type: 'extra_transport',
                status: 'pending',
                notes: 'Generado automáticamente por incidencia de conductor',
                created_by: 'system-driver'
            });
        }

        const { error } = await window.supabaseClient
            .from('leads_wizard')
            .update(updateData)
            .eq('id', currentTaskIdForAction);

        if (error) throw error;

        document.getElementById('issueModal').classList.add('hidden');
        await fetchTasks();

        let feedback = `Incidencia reportada: ${issues[type]}.`;
        if (type === 'no_en_casa') {
            feedback = "Servicio liberado de tu ruta. Se ha generado un cargo por transporte fallido para validación de central.";
        }
        if (type === 'otro') feedback += " Por favor, llama a Torre de Control ahora.";

        showSuccess(feedback, 'Incidencia Reportada');

    } catch (err) {
        console.error("❌ Error reporting issue:", err);
        showError("Error al reportar la incidencia. Revisa tu conexión.");
    }
};

window.closeIssueModal = function () {
    document.getElementById('issueModal').classList.add('hidden');
};

window.revertIncident = async function (taskId) {
    openConfirmModal({
        title: '¿Anular Incidencia?',
        desc: '¿Estás seguro de que quieres anular el reporte de incidencia actual?',
        icon: 'undo',
        type: 'warning',
        btnText: 'Anular Reporte',
        onConfirm: async () => {
            console.log(`🔄 Anulando incidencia para ${taskId} `);
            try {
                const { error } = await window.supabaseClient
                    .from('leads_wizard')
                    .update({
                        operational_incident_type: null,
                        operational_incident_at: null
                    })
                    .eq('id', taskId);

                if (error) throw error;
                await fetchTasks();
                showSuccess("Incidencia anulada correctamente.");
            } catch (err) {
                console.error("❌ Error reverting issue:", err);
                showError("No se pudo anular la incidencia.");
            }
        }
    });
};

// --- Real Evidence & Camera Management ---
let currentCaptureTarget = null;
let currentEvidences = {}; // Stores base64 or temporary URLs

window.openEvidenceModal = function (taskId) {
    currentTaskIdForAction = taskId;

    // Reset modal state
    const slots = ['before_1', 'before_2', 'after_1', 'after_2'];
    slots.forEach(s => {
        document.getElementById(`${s}_placeholder`).classList.remove('hidden');
        document.getElementById(`${s}_preview`).classList.add('hidden');
    });

    currentEvidences = {};
    document.getElementById('evidenceModal').classList.remove('hidden');
};

window.triggerCamera = function (target) {
    currentCaptureTarget = target;
    document.getElementById('cameraInput').click();
};

window.handleImageUpload = function (event) {
    const file = event.target.files[0];
    if (!file || !currentCaptureTarget) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        const imageData = e.target.result;

        // Save to temporary state
        currentEvidences[currentCaptureTarget] = imageData;

        // Update UI
        const placeholder = document.getElementById(`${currentCaptureTarget}_placeholder`);
        const preview = document.getElementById(`${currentCaptureTarget}_preview`);
        const img = preview.querySelector('img');

        placeholder.classList.add('hidden');
        preview.classList.remove('hidden');
        img.src = imageData;

        if (navigator.vibrate) navigator.vibrate(50);
    };
    reader.readAsDataURL(file);

    // Reset input for next capture
    event.target.value = '';
};

window.removeEvidence = function (target) {
    delete currentEvidences[target];

    const placeholder = document.getElementById(`${target}_placeholder`);
    const preview = document.getElementById(`${target}_preview`);

    preview.classList.add('hidden');
    placeholder.classList.remove('hidden');
};

window.saveEvidences = async function () {
    if (!currentTaskIdForAction) return;

    console.log(`💾 Guardando evidencias para ${currentTaskIdForAction}...`, Object.keys(currentEvidences));

    try {
        const { error } = await window.supabaseClient
            .from('leads_wizard')
            .update({
                operational_evidence: currentEvidences // Guardamos el objeto con las fotos
            })
            .eq('id', currentTaskIdForAction);

        if (error) throw error;

        document.getElementById('evidenceModal').classList.add('hidden');
        showSuccess("Evidencias guardadas correctamente en la nube.");
    } catch (err) {
        console.error("❌ Error saving evidences:", err);
        showError("Error al subir las fotos. Revisa tu conexión.");
    }
};

// --- Multi-Trip & Work Timer Logic ---

window.startMultiTrip = async function (taskId, isHeavyLoad) {
    if (isHeavyLoad) {
        openConfirmModal({
            title: '¿Se queda el mozo?',
            desc: 'Si el mozo se queda trabajando en el domicilio, el cronómetro seguirá corriendo. Si se va con el camión, se pausará.',
            icon: 'person_search',
            btnText: 'Sí, se queda trabajando',
            onConfirm: async () => {
                await setTripStatus(taskId, true); // Segundo viaje, cronómetro sigue
            }
        });

        // Modificar el botón de cancelar para que sea "No, se viene conmigo"
        const cancelBtn = document.querySelector('#confirmModal button:last-child');
        const oldText = cancelBtn.innerText;
        cancelBtn.innerText = 'No, se viene conmigo';
        const oldOnclick = cancelBtn.onclick;
        cancelBtn.onclick = async () => {
            cancelBtn.innerText = oldText;
            cancelBtn.onclick = oldOnclick;
            closeConfirmModal();
            await setTripStatus(taskId, false); // Segundo viaje, cronómetro pausa
        };
    } else {
        // Sin mozo extra, el viaje al almacén siempre pausa el cronómetro
        await setTripStatus(taskId, false);
    }
};

async function setTripStatus(taskId, keepTimerRunning) {
    console.log(`🔄 Iniciando segundo viaje para ${taskId}. ¿Cronómetro sigue ? ${keepTimerRunning}`);

    const updateData = {
        current_trip_count: 2,
        notes: keepTimerRunning ? '[INFO: 2º Viaje en curso - Mozo trabajando]' : '[INFO: 2º Viaje en curso - Servicio Pausado]'
    };

    if (!keepTimerRunning) {
        // Aquí guardaríamos el tiempo acumulado hasta ahora para pausar
        // total_work_minutes: calculo...
    }

    try {
        const { error } = await window.supabaseClient
            .from('leads_wizard')
            .update(updateData)
            .eq('id', taskId);

        if (error) throw error;
        await fetchTasks();
        showSuccess("Estado de 2º viaje registrado. Avisa cuando estés de vuelta.");
    } catch (err) {
        console.error("❌ Error setting multi-trip:", err);
    }
}

// --- Workday Management ---
// (Variables moved to top)

// --- Navigation Helper (Moved out of toggleWorkday) ---
/**
 * Navegación Inteligente (Nativa)
 * En lugar de un modal, usamos las capacidades del SO para abrir los mapas
 */
window.openNavigationModal = function (address, city) {
    const fullAddress = `${address}, ${city}`;
    const encodedAddress = encodeURIComponent(fullAddress);

    // 1. Intentar usar el Share API nativo (iOS/Android) para ver apps de mapas instaladas
    if (navigator.share && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
        navigator.share({
            title: 'Navegar a destino',
            text: fullAddress,
            url: `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`
        }).catch(err => {
            // Si el share falla o se cancela, abrimos Google Maps directo
            window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, '_blank');
        });
    } else {
        // 2. Fallback para Android (Geo URI abre selector nativo)
        if (/Android/i.test(navigator.userAgent)) {
            window.open(`geo:0,0?q=${encodedAddress}`, '_blank');
        }
        // 3. Fallback para iOS (Apple Maps link)
        else if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
            window.open(`maps://?q=${encodedAddress}`, '_blank');
        }
        // 4. Desktop: Google Maps estándar
        else {
            window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, '_blank');
        }
    }
}

window.copyAddressToClipboard = function () {
    const text = document.getElementById('nav-address-display').innerText;
    navigator.clipboard.writeText(text).then(() => {
        showSuccess("Dirección copiada al portapapeles");
    });
}


window.toggleWorkday = async function () {
    try {
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        if (!session || !session.user) throw new Error("No hay sesión activa");

        if (!isWorkdayActive) {
            openConfirmModal({
                title: '¿Iniciar Jornada?',
                desc: 'Vas a registrar el inicio de tu actividad operativa para hoy.',
                icon: 'play_circle',
                btnText: 'Comenzar Ahora',
                onConfirm: async () => {
                    const { data, error } = await window.supabaseClient
                        .from('driver_shifts')
                        .insert([{
                            driver_id: session.user.id,
                            started_at: new Date().toISOString()
                        }])
                        .select()
                        .single();

                    if (error) throw error;

                    isWorkdayActive = true;
                    currentShiftId = data.id;
                    workdayStartTime = new Date(data.started_at);
                    localStorage.setItem('activeShiftId', currentShiftId);

                    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
                    await fetchTasks();
                    updateWorkdayButtonUI();

                    // Auto-activar GPS al iniciar jornada
                    if (!isTracking) {
                        toggleGPS();
                    }

                    console.log("🚀 Jornada Iniciada en BD:", currentShiftId);
                }
            });
        } else {
            // Check for active tasks before allowing stop
            const activeTasks = allTasks.filter(t =>
                (t.status === 'in_transit' || t.status === 'picking_up' || t.status === 'at_warehouse') &&
                t.assigned_driver_id === session.user.id
            );

            if (activeTasks.length > 0) {
                openConfirmModal({
                    title: 'Servicio en Curso',
                    desc: 'No puedes finalizar la jornada mientras tienes servicios activos. Completa o pausa tu servicio actual primero.',
                    icon: 'warning',
                    btnText: 'Entendido',
                    onConfirm: () => { } // Close modal
                });
                return;
            }

            openConfirmModal({
                title: '¿Finalizar Jornada?',
                desc: 'Se registrará el fin de tu turno. Asegúrate de haber completado todos tus servicios.',
                icon: 'stop_circle',
                btnText: 'Finalizar y Salir',
                onConfirm: async () => {
                    // Update ends_at
                    const { error } = await window.supabaseClient
                        .from('driver_shifts')
                        .update({ ended_at: new Date().toISOString() })
                        .eq('id', currentShiftId);

                    if (error) throw error;

                    isWorkdayActive = false;
                    currentShiftId = null;
                    workdayStartTime = null;
                    localStorage.removeItem('activeShiftId');

                    if (workdayInterval) clearInterval(workdayInterval);

                    updateWorkdayButtonUI();

                    if (navigator.vibrate) navigator.vibrate(200);
                    await fetchTasks();
                    console.log("🏁 Jornada Finalizada en BD");
                }
            });
        }
    } catch (err) {
        console.error("Error toggleWorkday:", err);
        showError(err.message || "Error al cambiar estado de jornada");
    }
};

async function updateWorkdayWidget() {
    const widget = document.getElementById('workday-status-widget');
    const timeText = document.getElementById('workday-elapsed-time');
    // Sincronizar botón del Header: ELIMINADO para evitar conflictos con updateWorkdayButtonUI
    // La UI del botón se gestiona exclusivamente en updateWorkdayButtonUI()

    if (!widget || !timeText) return;

    if (!isWorkdayActive) {
        widget.classList.add('hidden');
        if (workdayInterval) clearInterval(workdayInterval);
        return;
    }

    // Recuperar hora de inicio si se refresca la página
    if (!workdayStartTime && currentShiftId) {
        try {
            const { data } = await window.supabaseClient
                .from('driver_shifts')
                .select('started_at')
                .eq('id', currentShiftId)
                .single();
            if (data) workdayStartTime = new Date(data.started_at);
        } catch (e) { }
    }

    if (!workdayStartTime) return;

    widget.classList.remove('hidden');
    if (workdayInterval) clearInterval(workdayInterval);

    const updateTimer = () => {
        const now = new Date();
        const diffMs = now - workdayStartTime;
        const h = Math.floor(diffMs / 3600000);
        const m = Math.floor((diffMs % 3600000) / 60000);

        const startStr = workdayStartTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        timeText.innerText = `Inicio: ${startStr}(${h}h ${m}m)`;
    };

    updateTimer();
    workdayInterval = setInterval(updateTimer, 60000); // Actualizar cada minuto
}

document.addEventListener('DOMContentLoaded', () => {
    updateWorkdayWidget();
});

/**
 * Muestra el detalle de un servicio completado (Historial)
 */
window.showServiceDetails = function (taskId) {
    const task = allTasks.find(t => t.id === taskId);
    if (!task) return;

    // Poblar Datos Básicos
    document.getElementById('detail-client-name').innerText = task.full_name || 'Cliente';
    document.getElementById('detail-address').innerText = task.pickup_address || task.address;
    document.getElementById('detail-date').innerText = task.completed_at ? new Date(task.completed_at).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '...';
    document.getElementById('detail-receiver').innerText = task.receiver_name || '...';
    document.getElementById('detail-dni').innerText = task.receiver_dni || '...';
    document.getElementById('detail-notes').innerText = task.driver_notes || 'Sin notas adicionales.';

    // Estilo según tipo
    const isPickup = task.delivery_mode === 'pickup';
    const detailIconContainer = document.getElementById('detail-type-icon');
    const detailIconSpan = document.getElementById('detail-icon-span');

    if (detailIconContainer) {
        detailIconContainer.className = `w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${isPickup ? 'bg-brandPurple/10 text-brandPurple' : 'bg-blue-500/10 text-blue-500'}`;
    }
    if (detailIconSpan) {
        detailIconSpan.innerText = isPickup ? 'inventory_2' : 'local_shipping';
    }

    // Evidencias (Fotos y Firma)
    const storageUrl = 'https://cpkrxkhoeedzhtmkhwim.supabase.co/storage/v1/object/public/evidences/';
    const evidence = task.operational_evidence || {};

    // Tiempos y Costes (Recalcular si faltan)
    let totalMinutes = evidence.final_time_minutes || task.total_work_minutes || 0;

    // Si es 0 pero tenemos los timestamps, calculamos al vuelo
    if (totalMinutes === 0 && task.pickup_started_at && task.completed_at) {
        const start = new Date(task.pickup_started_at);
        const end = new Date(task.completed_at);
        totalMinutes = Math.max(0, Math.floor((end - start) / 60000));
    }

    let extraCharge = evidence.final_extra_charge || 0;
    // Si no hay cargo guardado pero hay tiempo de sobra, calculamos según política
    if (extraCharge === 0 && totalMinutes > 15) {
        const billableMinutes = totalMinutes - 15;
        const extraUnits = Math.ceil(billableMinutes / 15);
        const multiplier = task.heavy_load ? 2 : 1;
        extraCharge = extraUnits * 15 * multiplier;
    }

    document.getElementById('detail-total-time').innerText = `${totalMinutes} min`;
    document.getElementById('detail-extra-charge').innerText = `${parseFloat(extraCharge).toFixed(2)} €`;

    // Inyectar Fotos
    const photoGrid = document.getElementById('detail-photos-grid');
    photoGrid.innerHTML = '';
    let foundAnyPhoto = false;

    // 1. Fotos de la entrega (vía Storage)
    if (evidence.photos && Array.isArray(evidence.photos)) {
        evidence.photos.forEach(path => {
            if (path && typeof path === 'string') {
                foundAnyPhoto = true;
                photoGrid.innerHTML += `
                    <div class="aspect-square rounded-xl overflow-hidden bg-white/5 border border-white/10 clickable-photo" onclick="window.open('${storageUrl}${path}', '_blank')">
                        <img src="${storageUrl}${path}" class="w-full h-full object-cover" onerror="this.parentElement.style.display='none'">
                    </div>
                `;
            }
        });
    }

    // 2. Fotos de trayecto/incidencias (vía Base64 u otros slots)
    const extraSlots = ['before_1', 'before_2', 'after_1', 'after_2'];
    extraSlots.forEach(key => {
        if (evidence[key] && typeof evidence[key] === 'string' && evidence[key].length > 100) {
            foundAnyPhoto = true;
            const src = evidence[key].startsWith('data:') ? evidence[key] : `${storageUrl}${evidence[key]}`;
            photoGrid.innerHTML += `
                <div class="aspect-square rounded-xl overflow-hidden bg-white/5 border border-white/10 clickable-photo" onclick="window.open('${src}', '_blank')">
                    <img src="${src}" class="w-full h-full object-cover" onerror="this.parentElement.style.display='none'">
                </div>
            `;
        }
    });

    if (!foundAnyPhoto) {
        photoGrid.innerHTML = `
            <div class="col-span-3 py-4 text-center bg-white/5 rounded-2xl border border-dashed border-white/10">
                <p class="text-[9px] text-slate-500 uppercase font-black tracking-widest italic">No se adjuntaron fotos</p>
            </div>
        `;
    }

    // Firma
    const sigImg = document.getElementById('detail-signature-img');
    const signatureContainer = sigImg.parentElement;

    if (evidence.signature) {
        sigImg.src = `${storageUrl}${evidence.signature}`;
        signatureContainer.classList.remove('hidden');
        signatureContainer.previousElementSibling.classList.remove('hidden'); // El p con el título
    } else {
        signatureContainer.classList.add('hidden');
        signatureContainer.previousElementSibling.classList.add('hidden'); // El p con el título
    }

    // Mostrar Modal
    const modal = document.getElementById('serviceDetailsModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
};
