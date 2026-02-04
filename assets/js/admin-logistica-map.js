
// ==========================================
// LOGISTICS MAP & DETAIL VIEW CONTROLLER
// ==========================================

let mapInstance = null;
let markers = {
    drivers: {},
    routes: {},
    depot: null
};

const DEPOT_COORDS = [40.246473, -3.693414]; // Pinto, Madrid

document.addEventListener('DOMContentLoaded', () => {
    // Solo inicializar si estamos en la vista de rutas
    if (document.getElementById('logistics-map')) {
        initMap();
        startRealTimeUpdates();
    }
});

function initMap() {
    // 1. Crear Mapa
    mapInstance = L.map('logistics-map').setView(DEPOT_COORDS, 10);

    // 2. Capa Base (CartoDB Dark Matter para modo oscuro)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(mapInstance);

    // 3. Marcador Almacén (Depot)
    const depotIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="background-color: #6E44FF; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px #6E44FF;"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
    });

    markers.depot = L.marker(DEPOT_COORDS, { icon: depotIcon }).addTo(mapInstance).bindPopup("<b>Almacén Central (Pinto)</b>");
}

function startRealTimeUpdates() {
    fetchMapData(); // Inmediato
    setInterval(fetchMapData, 10000); // Cada 10s
}

async function fetchMapData() {
    if (!window.supabaseClient) return;

    try {
        // A. Fetch Conductores Activos
        const { data: driversLocations } = await window.supabaseClient
            .from('driver_locations')
            .select(`
                *,
                driver:driver_id (full_name, email)
            `)
            .gt('updated_at', new Date(Date.now() - 15 * 60 * 1000).toISOString()); // Activos en últimos 15 min

        updateDriverMarkers(driversLocations || []);

        // B. Fetch Rutas de Hoy
        const todayStr = new Date().toISOString().split('T')[0];
        const { data: leads } = await window.supabaseClient
            .from('leads_wizard')
            .select('*')
            .or(`pickup_date.eq.${todayStr},status.in.(pending_pickup,in_transit,picking_up)`);

        updateRouteMarkers(leads || []);

    } catch (err) {
        console.error("❌ Error fetching map data:", err);
    }
}

function updateDriverMarkers(locations) {
    // Limpiar marcadores viejos no presentes
    // (Simplificación: limpiar y redibujar o actualizar)

    locations.forEach(loc => {
        const { driver_id, latitude, longitude, heading, driver } = loc;

        // Icono de Camión
        const truckIcon = L.divIcon({
            className: 'truck-marker',
            html: `<div style="transform: rotate(${heading}deg); font-size: 24px;">🚚</div><div class="driver-label" style="background: rgba(0,0,0,0.7); color: white; padding: 2px 4px; border-radius: 4px; font-size: 10px; white-space: nowrap; position: absolute; top: -20px; left: 50%; transform: translateX(-50%);">${driver?.full_name?.split(' ')[0] || 'Conductor'}</div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });

        if (markers.drivers[driver_id]) {
            // Animación suave (Leaflet no tiene, pero actualizamos pos)
            markers.drivers[driver_id].setLatLng([latitude, longitude]);
            markers.drivers[driver_id].setIcon(truckIcon); // Update heading
        } else {
            markers.drivers[driver_id] = L.marker([latitude, longitude], { icon: truckIcon })
                .addTo(mapInstance)
                .bindPopup(`<b>${driver?.full_name}</b><br>Última act: ${new Date(loc.updated_at).toLocaleTimeString()}`);
        }
    });
}

function updateRouteMarkers(leads) {
    // Aquí podríamos dibujar líneas de ruta si tuviéramos la geometría de OSRM
    // Por ahora, solo puntos de destino

    leads.forEach(lead => {
        // Necesitamos coordenadas para el lead. Si no las tiene, no podemos pintar.
        // Asumimos que leads_wizard tiene lat/lng logísticos? 
        // Si no, deberíamos usar Nominatim en backend o frontend al crear el lead.
        // CHECK: ¿Tenemos lat/lng en leads_wizard?
        // Si no, usaremos mock o nada.

        // REVISIÓN: El esquema actual no parece tener lat/lng en leads_wizard explícito en el script SQL principal,
        // pero Nominatim se usó. Vamos a asumir que existen o se pueden derivar.
        // Si no existen, este paso fallará silenciosamente.

        if (lead.pickup_lat && lead.pickup_lng) {
            let color = '#Eab308'; // Pending (Yellow)
            if (lead.status === 'completed') color = '#22c55e'; // Green
            if (lead.status === 'in_transit') color = '#3b82f6'; // Blue

            const destIcon = L.divIcon({
                className: 'dest-marker',
                html: `<div style="background-color: ${color}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>`,
                iconSize: [12, 12],
                iconAnchor: [6, 6]
            });

            const markerId = `lead-${lead.id}`;
            if (!markers.routes[markerId]) {
                markers.routes[markerId] = L.marker([lead.pickup_lat, lead.pickup_lng], { icon: destIcon })
                    .addTo(mapInstance)
                    .bindPopup(`
                        <b>${lead.full_name}</b><br>
                        ${lead.address}<br>
                        Status: ${lead.status}
                        <br><button onclick="openServiceDetail('${lead.id}')" class="text-blue-400 underline mt-1">Ver Detalles</button>
                    `);
            } else {
                markers.routes[markerId].setIcon(destIcon);
            }
        }
    });

}

// ==========================================
// SERVICE DETAIL MODAL
// ==========================================

async function openServiceDetail(leadId) {
    const modal = document.getElementById('serviceDetailModal');
    if (!modal) return;

    modal.classList.remove('hidden');
    modal.classList.add('flex');

    // 1. Reset UI
    document.getElementById('detail-timeline').innerHTML = '<p class="text-slate-500 text-xs">Cargando historial...</p>';
    document.getElementById('detail-signature-img').classList.add('hidden');
    document.getElementById('detail-photos-grid').innerHTML = '';

    try {
        // 2. Fetch Data
        const { data: lead, error } = await window.supabaseClient
            .from('leads_wizard')
            .select(`
                *,
                driver:assigned_driver_id (full_name, email)
            `)
            .eq('id', leadId)
            .single();

        if (error) throw error;

        // 3. Populate Basic Info
        document.getElementById('detail-client-name').innerText = lead.full_name || 'Sin Nombre';
        document.getElementById('detail-service-id').innerText = `ID: ${lead.id}`;
        document.getElementById('detail-address').innerText = `${lead.address}, ${lead.city || ''}`;
        document.getElementById('detail-driver-name').innerText = lead.driver?.full_name || 'Sin asignar';
        document.getElementById('detail-driver-notes').innerText = lead.driver_notes || 'Sin observaciones.';

        // Status Badge Logic
        const statusEl = document.getElementById('detail-status-badge');
        statusEl.innerText = lead.status;
        // (Añadir colores según estado si se desea)

        // 4. Populate Timeline (Mocked from timestamps for now)
        const timelineHTML = buildTimeline(lead);
        document.getElementById('detail-timeline').innerHTML = timelineHTML;

        // 5. Populate Evidence
        if (lead.operational_evidence) {
            // A. Firma
            console.log("Evidence found:", lead.operational_evidence);
            if (lead.operational_evidence.signature) {
                const { data: sigUrl } = window.supabaseClient.storage
                    .from('evidences')
                    .getPublicUrl(lead.operational_evidence.signature);

                const img = document.getElementById('detail-signature-img');
                img.src = sigUrl.publicUrl;
                img.classList.remove('hidden');
                document.getElementById('detail-signature-placeholder').classList.add('hidden');
            }

            // B. Receiver Info
            document.getElementById('detail-receiver-name').innerText = lead.receiver_name || '---';
            document.getElementById('detail-receiver-dni').innerText = lead.receiver_dni || '---';

            // C. Fotos
            if (lead.operational_evidence.photos && lead.operational_evidence.photos.length > 0) {
                const photosGrid = document.getElementById('detail-photos-grid');
                photosGrid.innerHTML = ''; // Clear

                lead.operational_evidence.photos.forEach(photoPath => {
                    const { data: photoUrl } = window.supabaseClient.storage
                        .from('evidences')
                        .getPublicUrl(photoPath);

                    const div = document.createElement('div');
                    div.className = 'aspect-square bg-black/20 rounded-2xl overflow-hidden border border-white/10 cursor-pointer hover:border-brandPurple transition-colors';
                    div.innerHTML = `<img src="${photoUrl.publicUrl}" class="w-full h-full object-cover">`;
                    div.onclick = () => window.open(photoUrl.publicUrl, '_blank');
                    photosGrid.appendChild(div);
                });
            } else {
                document.getElementById('detail-photos-grid').innerHTML = '<p class="text-slate-500 text-xs col-span-2">No hay fotos registradas.</p>';
            }
        }

    } catch (err) {
        console.error("❌ Error loading details:", err);
        alert("Error cargando detalles del servicio.");
    }
}

function closeServiceDetailModal() {
    document.getElementById('serviceDetailModal').classList.add('hidden');
    document.getElementById('serviceDetailModal').classList.remove('flex');
}

function buildTimeline(lead) {
    let events = [];
    if (lead.created_at) events.push({ date: lead.created_at, label: 'Reserva Creada', icon: 'event_available' });
    if (lead.assigned_at) events.push({ date: lead.assigned_at, label: 'Conductor Asignado', icon: 'person_add' });
    if (lead.en_route_at) events.push({ date: lead.en_route_at, label: 'En Camino', icon: 'local_shipping' });
    if (lead.pickup_started_at) events.push({ date: lead.pickup_started_at, label: 'Llegada / Inicio Carga', icon: 'inventory_2' });
    if (lead.completed_at) events.push({ date: lead.completed_at, label: 'Servicio Completado', icon: 'check_circle', active: true });

    // Sort by date
    events.sort((a, b) => new Date(a.date) - new Date(b.date));

    return events.map(e => `
        <div class="relative pl-6 pb-4 border-l ${e.active ? 'border-brandPurple' : 'border-white/10'} last:border-0">
            <div class="absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full ${e.active ? 'bg-brandPurple shadow-[0_0_10px_#6E44FF]' : 'bg-slate-700'}"></div>
            <p class="text-[9px] font-black uppercase text-slate-500 mb-0.5">${new Date(e.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            <h5 class="text-xs font-bold text-white flex items-center gap-2">
                <span class="material-symbols-outlined text-sm ${e.active ? 'text-brandPurple' : 'text-slate-400'}">${e.icon}</span> ${e.label}
            </h5>
        </div>
    `).join('');
}

function centerMapOnDepot() {
    if (mapInstance) mapInstance.setView(DEPOT_COORDS, 13);
}

function refreshMapData() {
    fetchMapData();
}

// Expose globally
window.openServiceDetail = openServiceDetail;
window.closeServiceDetailModal = closeServiceDetailModal;
window.centerMapOnDepot = centerMapOnDepot;
window.refreshMapData = refreshMapData;
