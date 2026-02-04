/**
 * BOXROOMER - Admin Clientes Logic
 * Conecta el panel de administración con Supabase para gestión en tiempo real.
 */

let allClients = [];
let currentFilter = 'TODOS';
let currentClientId = null;

// Mapeo de estados DB -> UI
const STATUS_MAP = {
    'pending_call': 'PENDIENTE_LLAMADA',
    'confirmed': 'ACTIVOS',
    'active': 'ACTIVOS',
    'pending_pickup': 'PENDIENTE_LLAMADA',
    'completed': 'INACTIVOS',
    'rejected': 'CANCELADO'
};

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Verificar Auth de Admin
    if (!window.supabaseClient) {
        console.error("Supabase client not initialized");
        return;
    }

    const { data: { session } } = await window.supabaseClient.auth.getSession();
    if (!session) {
        window.location.href = 'login.html';
        return;
    }

    // Verificar rol de admin en profiles
    const { data: profile } = await window.supabaseClient
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle();

    const role = profile?.role || session.user.user_metadata?.role || 'client';

    // 🦸‍♂️ SUPERADMIN BYPASS
    let finalRole = role;
    if (session.user.email === 'israel.madrigal@pluser.es') {
        finalRole = 'admin';
        console.log("👑 [Auth] Superadmin detectado por email en Clientes.");
    }

    if (finalRole !== 'admin') {
        console.warn("⛔ Acceso denegado: Solo administradores pueden acceder a la Torre de Control.");
        window.location.href = 'cliente_dashboard.html';
        return;
    }

    // 2. Cargar Datos
    await loadClientsData();
    setupSearch();
});

async function loadClientsData() {
    const tableBody = document.getElementById('clients-table-body');
    tableBody.innerHTML = `
        <tr>
            <td colspan="6" class="p-12 text-center opacity-40">
                <div class="flex flex-col items-center gap-4">
                    <span class="material-symbols-outlined animate-spin text-4xl text-brandPurple">sync</span>
                    <p class="text-[10px] font-black uppercase tracking-widest text-slate-500">Unificando Usuarios y Clientes...</p>
                </div>
            </td>
        </tr>
    `;

    try {
        // 1. Cargar Perfiles (Usuarios registrados)
        const { data: profiles, error: pError } = await window.supabaseClient
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });

        if (pError) throw pError;

        // 2. Cargar Leads (Datos comerciales/contratos)
        const { data: leads, error: lError } = await window.supabaseClient
            .from('leads_wizard')
            .select('*');

        if (lError) throw lError;

        // 3. Unificar datos y Calcular Totales
        // Paso A: Agrupar leads por email para sumar volúmenes
        const leadsGrouped = {};
        (leads || []).forEach(l => {
            const email = l.email ? l.email.toLowerCase() : null;
            if (!email) return;
            if (!leadsGrouped[email]) leadsGrouped[email] = [];
            leadsGrouped[email].push(l);
        });

        // Paso B: Procesar Usuarios Registrados (Profiles)
        const processedEmails = new Set();
        const nonClientRoles = ['admin', 'driver'];

        allClients = profiles
            .filter(p => !nonClientRoles.includes(p.role)) // ⚠️ FILTRO: Solo clientes reales
            .map(p => {
                const email = p.email ? p.email.toLowerCase() : '';
                processedEmails.add(email);

                const userLeads = leadsGrouped[email] || [];

                // Calculamos volumen SOLO de contratos activos/pendientes (excluyendo cancelados/históricos)
                const activeLeads = userLeads.filter(l => !['rejected', 'completed', 'cancelled'].includes(l.status));

                // Datos principales (Tomamos el lead más reciente como referencia para plan/dirección)
                const mainLead = activeLeads.length > 0 ? activeLeads[0] : (userLeads[0] || {});

                // Suma total de volumen
                const totalVolume = activeLeads.reduce((sum, l) => sum + (parseFloat(l.volume_m3) || 0), 0);

                // Determinar nombre del plan
                let planDisplay = mainLead.pack_type || (p.role === 'client' ? 'Sin Plan' : (p.role === 'admin' ? 'Administrador' : 'Conductor'));
                if (activeLeads.length > 1) planDisplay = `Multi-Plan (${activeLeads.length})`;

                let status = 'INACTIVOS';
                if (activeLeads.some(l => l.status === 'confirmed' || l.status === 'active')) status = 'ACTIVOS';
                else if (activeLeads.some(l => l.status === 'pending_call')) status = 'PENDIENTE_LLAMADA';
                else if (p.role === 'admin' || p.role === 'driver') status = 'STAFF';
                else if (userLeads.length > 0) status = STATUS_MAP[mainLead.status] || 'INACTIVOS';
                else status = 'ACTIVOS'; // Usuario registrado sin leads (por defecto activo como usuario)

                return {
                    id: p.id,
                    real_lead_id: mainLead.id,
                    name: p.full_name || email.split('@')[0],
                    email: p.email,
                    dni: mainLead.dni_cif || '---',
                    company: (mainLead.customer_type === 'business') ? 'Empresa' : (p.role === 'admin' ? 'Staff' : 'Particular'),
                    role: p.role,
                    status: status,
                    db_status: mainLead.status || 'registered',
                    plan: planDisplay,
                    volume: totalVolume > 0 ? `${parseFloat(totalVolume.toFixed(2))} m³` : '---',
                    months: mainLead.plan_months || '---',
                    address: mainLead.address || mainLead.pickup_address || 'No especificada',
                    phone: p.phone || mainLead.phone || '---',
                    delivery_mode: mainLead.delivery_mode || 'pickup',
                    pickup_date: mainLead.pickup_date,
                    pickup_slot: mainLead.pickup_slot,
                    access_type: mainLead.access_type,
                    extra_boxes: mainLead.extra_boxes || 0,
                    extra_packing: mainLead.extra_packing || false,
                    extra_assembly: mainLead.extra_assembly || false,
                    heavy_load: mainLead.heavy_load || false,
                    admin_notes: mainLead.admin_notes || '',
                    created_at: p.created_at
                };
            });

        // Paso C: Procesar Prospectos (Guests) - Emails en Leads que NO están en Profiles
        Object.keys(leadsGrouped).forEach(email => {
            if (processedEmails.has(email)) return; // Ya procesado como usuario registrado

            const userLeads = leadsGrouped[email];
            const activeLeads = userLeads.filter(l => !['rejected', 'completed', 'cancelled'].includes(l.status));
            const mainLead = activeLeads.length > 0 ? activeLeads[0] : userLeads[0];
            const totalVolume = activeLeads.reduce((sum, l) => sum + (parseFloat(l.volume_m3) || 0), 0);

            allClients.push({
                id: 'GUEST-' + mainLead.id.substring(0, 8),
                real_lead_id: mainLead.id,
                name: mainLead.full_name || 'Prospecto',
                email: mainLead.email,
                dni: mainLead.dni_cif || '---',
                company: mainLead.customer_type === 'business' ? 'Empresa' : 'Particular (Lead)',
                role: 'guest',
                status: STATUS_MAP[mainLead.status] || 'PENDIENTE_LLAMADA',
                db_status: mainLead.status,
                plan: activeLeads.length > 1 ? `Multi-Pack (${activeLeads.length})` : (mainLead.pack_type || 'Presupuesto'),
                volume: totalVolume > 0 ? `${parseFloat(totalVolume.toFixed(2))} m³` : '---',
                months: mainLead.plan_months || '---',
                address: mainLead.address || '---',
                phone: mainLead.phone || '---',
                delivery_mode: mainLead.delivery_mode || 'pickup',
                pickup_date: mainLead.pickup_date,
                pickup_slot: mainLead.pickup_slot,
                access_type: mainLead.access_type,
                extra_boxes: mainLead.extra_boxes || 0,
                extra_packing: mainLead.extra_packing || false,
                extra_assembly: mainLead.extra_assembly || false,
                heavy_load: mainLead.heavy_load || false,
                created_at: mainLead.created_at
            });
        });

        // Ordenar por fecha de creación (más reciente primero)
        allClients.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        renderClients();

    } catch (err) {
        console.error("Error combinando usuarios:", err);
        tableBody.innerHTML = `<tr><td colspan="6" class="p-12 text-center text-red-400">Error: ${err.message}</td></tr>`;
    }
}

function renderClients(searchQuery = '') {
    const tableBody = document.getElementById('clients-table-body');
    let filtered = allClients;

    // Apply Status Filter
    if (currentFilter !== 'TODOS') {
        filtered = filtered.filter(c => c.status === currentFilter);
    }

    // Apply Search Query
    if (searchQuery) {
        filtered = filtered.filter(c =>
            c.name.toLowerCase().includes(searchQuery) ||
            c.email.toLowerCase().includes(searchQuery) ||
            c.dni.toLowerCase().includes(searchQuery) ||
            c.id.toLowerCase().includes(searchQuery)
        );
    }

    if (filtered.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="p-12 text-center opacity-40">
                    <div class="flex flex-col items-center gap-4">
                        <span class="material-symbols-outlined text-5xl text-slate-600">group_off</span>
                        <p class="text-xs font-black uppercase tracking-widest text-slate-500">No se han encontrado resultados</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = filtered.map(c => {
        const isPendingCall = c.status === 'PENDIENTE_LLAMADA';
        const rowClass = isPendingCall ? 'bg-orange-500/[0.03] border-l-4 border-l-orange-500 animate-pulse-subtle' : 'hover:bg-white/[0.03]';

        return `
            <tr class="${rowClass} border-b border-white/5 transition-colors group">
                <td class="p-4">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-brandPurple to-blue-600 text-white flex items-center justify-center font-black text-xs italic">
                            ${c.name.charAt(0)}
                        </div>
                        <div>
                            <p class="text-white font-bold group-hover:text-brandPurple transition-colors">${c.name}</p>
                            <p class="text-[10px] text-slate-500">${c.email}</p>
                        </div>
                    </div>
                </td>
                <td class="p-4 text-[11px] font-bold text-slate-400 font-mono italic">${c.dni} <span class="block opacity-40 text-[9px] font-sans">#${c.id.slice(0, 8)}</span></td>
                <td class="p-4">
                    <span class="block text-white font-black italic uppercase text-[10px]">${c.plan}</span>
                    <span class="text-[10px] text-slate-500 font-bold uppercase">${c.volume}</span>
                </td>
                <td class="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest">${c.months} Meses</td>
                <td class="p-4">
                    ${getStatusBadge(c.status)}
                    ${c.next_plan ? `<span class="block text-[8px] text-brandPurple font-black mt-1 uppercase">PRÓX: ${c.next_plan}M</span>` : ''}
                </td>
                <td class="p-4 text-right">
                    <button onclick="openClientDetail('${c.id}')" class="w-9 h-9 rounded-xl bg-white/5 border border-white/10 text-slate-500 hover:bg-brandPurple hover:text-white transition-all">
                        <span class="material-symbols-outlined text-lg">visibility</span>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function getStatusBadge(status) {
    const styles = {
        'ACTIVOS': 'bg-green-500/10 text-green-500 border-green-500/20',
        'IMPAGOS': 'bg-red-500/10 text-red-500 border-red-500/20',
        'INACTIVOS': 'bg-white/5 text-slate-500 border-white/10',
        'PENDIENTE_LLAMADA': 'bg-orange-500/10 text-orange-400 border-orange-500/20',
        'CANCELADO': 'bg-red-500/20 text-red-400 border-red-500/30'
    };
    const labels = {
        'ACTIVOS': 'Activo',
        'IMPAGOS': 'Impago',
        'INACTIVOS': 'Inactivo',
        'PENDIENTE_LLAMADA': 'P. Llamada',
        'CANCELADO': 'Cancelado'
    };
    return `<span class="px-2 py-1 rounded-[6px] text-[8px] font-black uppercase tracking-widest border ${styles[status] || styles['INACTIVOS']}">${labels[status] || status}</span>`;
}

window.setFilter = function (filter, btn) {
    currentFilter = filter;
    document.querySelectorAll('.filter-btn').forEach(b => {
        b.classList.remove('bg-white', 'text-brandDark', 'shadow-lg');
        b.classList.add('text-slate-400');
    });
    btn.classList.add('bg-white', 'text-brandDark', 'shadow-lg');
    btn.classList.remove('text-slate-400', 'hover:text-white');
    renderClients();
};

function setupSearch() {
    const searchInput = document.querySelector('input[type="text"]');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            renderClients(query);
        });
    }
}

window.openClientDetail = function (id) {
    currentClientId = id;
    const c = allClients.find(client => client.id === id);
    if (!c) return;

    // Reseteo de estado visual (modo lectura)
    document.getElementById('btn-edit-user').classList.remove('hidden');
    document.getElementById('btn-save-user').classList.add('hidden');
    ['modal-dni', 'modal-company', 'modal-address', 'modal-role'].forEach(fid => {
        const el = document.getElementById(fid);
        if (el) el.disabled = true;
    });

    // Mapeo de DATOS REALES (Evitar placeholders)
    document.getElementById('modal-name').innerText = c.name || 'Sin Nombre';
    document.getElementById('modal-email').innerText = c.email || '';
    document.getElementById('modal-avatar').innerText = (c.name || 'U').charAt(0).toUpperCase();

    // Inputs Editables (Usar .value siempre)
    document.getElementById('modal-role').value = c.role || 'client'; // Cargar rol
    document.getElementById('modal-dni').value = c.dni !== '---' ? c.dni : '';
    document.getElementById('modal-company').value = c.company !== 'Particular' ? c.company : 'Particular';
    document.getElementById('modal-address').value = c.address !== 'No especificada' ? c.address : '';
    document.getElementById('modal-phone').value = c.phone !== '---' ? c.phone : '';
    document.getElementById('modal-admin-notes').value = c.admin_notes || '';

    // Datos del Plan (Solo lectura)
    document.getElementById('modal-plan').innerText = c.plan;

    // Construir texto de volumen limpiamente
    let volumeText = '---';
    if (c.volume && c.volume !== '---') volumeText = `${c.volume}`;
    if (c.months && c.months !== '---') volumeText += ` • Permanencia ${c.months} meses`;

    const volEl = document.getElementById('modal-volume');
    if (volEl) volEl.innerText = volumeText;

    // Lógica visual para Plan y Precio
    const priceElement = document.getElementById('modal-price');
    const contractSection = document.getElementById('contract-section');

    if (c.plan === 'Sin Plan' || c.plan === 'Presupuesto' || c.plan === 'Personalizado') {
        // Usuario sin plan activo o definido
        if (priceElement) {
            priceElement.innerHTML = '<span class="text-sm text-slate-500 font-bold uppercase">Sin cotizar</span>';
        }
        if (contractSection) {
            contractSection.classList.add('opacity-30', 'pointer-events-none', 'grayscale'); // Efecto desactivado
            contractSection.querySelector('h4').innerText = "Sin Contrato Activo";
            contractSection.querySelector('.text-green-500').parentElement.classList.add('hidden'); // Ocultar check firmado
        }
    } else {
        // Usuario con plan
        if (priceElement) {
            // Precio estimado base o real si existiera
            const price = c.plan.includes('Mini') ? '49' : (c.plan.includes('Mediano') ? '99' : (c.plan.includes('Grande') ? '149' : '--'));
            priceElement.innerHTML = `${price}€<span class="text-xs text-slate-500 font-bold tracking-normal italic">/mes</span>`;
        }
        if (contractSection) {
            contractSection.classList.remove('opacity-30', 'pointer-events-none', 'grayscale');
            contractSection.querySelector('h4').innerText = "Contrato Digital";
            contractSection.querySelector('.text-green-500').parentElement.classList.remove('hidden');
        }
    }

    // Render Extras
    const extrasList = document.getElementById('modal-extras-list');
    if (extrasList) {
        let extrasHtml = '';
        if (c.extra_packing) {
            extrasHtml += `<span class="bg-blue-500/10 text-blue-400 text-[8px] font-black px-2 py-1 rounded uppercase tracking-wider border border-blue-500/20 flex items-center gap-1"><span class="material-symbols-outlined text-[10px]">handyman</span> Embalaje</span>`;
        }
        if (c.extra_assembly) {
            extrasHtml += `<span class="bg-indigo-500/10 text-indigo-400 text-[8px] font-black px-2 py-1 rounded uppercase tracking-wider border border-indigo-500/20 flex items-center gap-1"><span class="material-symbols-outlined text-[10px]">home_repair_service</span> Desmontaje</span>`;
        }
        if (c.heavy_load) {
            extrasHtml += `<span class="bg-brandPurple/10 text-brandPurple text-[8px] font-black px-2 py-1 rounded uppercase tracking-wider border border-brandPurple/20 flex items-center gap-1"><span class="material-symbols-outlined text-[10px]">engineering</span> Mozo Extra</span>`;
        }

        if (extrasHtml === '') {
            extrasHtml = '<p class="text-[10px] text-slate-500 font-bold italic opacity-40">Sin servicios adicionales contratados</p>';
        }
        extrasList.innerHTML = extrasHtml;
        const logExtrasList = document.getElementById('modal-log-extras-list');
        if (logExtrasList) logExtrasList.innerHTML = extrasHtml;
    }

    // Populate Logistical Details
    const formatDate = (dateStr) => {
        if (!dateStr) return '-- / -- / ----';
        const d = new Date(dateStr);
        return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    document.getElementById('modal-log-date').innerText = formatDate(c.pickup_date);
    document.getElementById('modal-log-slot').innerText = c.pickup_slot || '--:-- - --:--';
    document.getElementById('modal-log-mode').innerText = c.delivery_mode === 'pickup' ? 'Recogida a domicilio' : 'Entrega en Almacén';
    document.getElementById('modal-log-mode-icon').innerText = c.delivery_mode === 'pickup' ? 'local_shipping' : 'warehouse';
    document.getElementById('modal-log-boxes').innerText = `${c.extra_boxes || 0} ud.`;

    const accessLabel = {
        'street': 'Pie de calle',
        'floor': 'Planta alta',
        'office': 'Oficina / Local',
        'storage': 'Trastero / Garaje'
    };
    document.getElementById('modal-log-access').innerText = accessLabel[c.access_type] || 'No especificado';
    const accessIcon = {
        'street': 'door_front',
        'floor': 'layers',
        'office': 'corporate_fare',
        'storage': 'garage'
    };
    document.getElementById('modal-log-access-icon').innerText = accessIcon[c.access_type] || 'help';

    // Checklist access details
    const updateAccessCheck = (id, active) => {
        const el = document.getElementById(id);
        if (el) {
            if (active) {
                el.classList.remove('opacity-30', 'bg-white/5');
                el.classList.add('bg-brandPurple/10', 'text-brandPurple');
            } else {
                el.classList.remove('bg-brandPurple/10', 'text-brandPurple');
                el.classList.add('opacity-30', 'bg-white/5');
            }
        }
    };


    // Convert current UI status back to select value if possible or mapping
    const statusSelect = document.getElementById('modal-status-select');
    if (statusSelect) statusSelect.value = c.status;

    const badge = document.getElementById('modal-status-badge');
    if (badge) badge.innerHTML = getStatusBadge(c.status);

    const modal = document.getElementById('clientModal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        switchTab('info');
    }

    // Load payments for this lead
    loadClientPayments(id);
    if (typeof loadClientHistory === 'function') loadClientHistory(id);
};

// --- GESTIÓN DE EDICIÓN Y BORRADO ---

window.toggleEditMode = function () {
    const isEditing = document.getElementById('btn-edit-user').classList.contains('hidden');
    // Incluir 'modal-role' en los campos editables
    const inputs = ['modal-dni', 'modal-company', 'modal-address', 'modal-role', 'modal-phone', 'modal-admin-notes'];

    inputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = isEditing; // Si estaba editando (true), ahora deshabilita (true).
    });

    if (isEditing) {
        // Estaba editando -> CANCELAR / GUARDAR
        document.getElementById('btn-edit-user').classList.remove('hidden');
        document.getElementById('btn-save-user').classList.add('hidden');

        // Recargar datos originales para deshacer cambios si no se acaba de guardar
        if (!window.justSaved) openClientDetail(currentClientId);
        window.justSaved = false;
    } else {
        // Estaba viendo -> EDITAR
        document.getElementById('btn-edit-user').classList.add('hidden');
        document.getElementById('btn-save-user').classList.remove('hidden');

        inputs.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.disabled = false;
        });
    }
};

window.saveUserChanges = async function () {
    const dni = document.getElementById('modal-dni').value;
    const company = document.getElementById('modal-company').value;
    const address = document.getElementById('modal-address').value;
    const phone = document.getElementById('modal-phone').value;
    const adminNotes = document.getElementById('modal-admin-notes').value;
    const role = document.getElementById('modal-role').value;
    const btn = document.getElementById('btn-save-user');

    btn.innerText = 'Guardando...';
    btn.disabled = true;

    try {
        const client = allClients.find(c => c.id === currentClientId);

        // 1. Actualizar Datos Comerciales (Leads)
        // Solo si existe registro en leads (si es guest o lead real)
        if (!client.id.startsWith('GUEST-')) {
            const { error: leadError } = await window.supabaseClient
                .from('leads_wizard')
                .update({
                    dni_cif: dni,
                    customer_type: company === 'Empresa' ? 'business' : 'personal',
                    address: address,
                    admin_notes: adminNotes
                })
                .eq('email', client.email);

            if (leadError) throw leadError;
        }

        // 2. Actualizar Rol de Sistema (Profiles) - Solo si ha cambiado y es un usuario registrado
        if (role !== client.role && !client.id.startsWith('GUEST-')) {
            const { error: profileError } = await window.supabaseClient
                .from('profiles')
                .update({ role: role })
                .eq('id', client.id);

            if (profileError) throw profileError;
            client.role = role; // Actualizar local
        }

        // Actualizar UI Local
        client.dni = dni;
        client.company = company;
        client.address = address;

        if (window.showBoxBotToast) {
            window.showBoxBotToast("✅ Datos actualizados correctamente");
        }

        window.justSaved = true; // Flag para evitar recarga
        toggleEditMode(); // Volver a modo lectura
        loadClientsData(); // Recargar tabla de fondo

    } catch (err) {
        console.error("Error al guardar:", err);
        if (window.showBoxBotToast) {
            window.showBoxBotToast("❌ Error al guardar cambios");
        } else {
            alert("Error: " + err.message);
        }
    } finally {
        btn.innerText = 'GUARDAR';
        btn.disabled = false;
    }
};

window.deleteUser = async function () {
    if (!confirm("⛔ ¿ESTÁS SEGURO?\n\nEsta acción eliminará al usuario y todos sus datos de forma permanente. No se puede deshacer.")) return;

    const client = allClients.find(c => c.id === currentClientId);
    if (!client) return;

    // Verificar permiso admin antes de intentar
    const isAdmin = await checkAdminRole();
    if (!isAdmin) {
        alert("⛔ Error: No tienes permisos de SuperAdmin para borrar usuarios.");
        return;
    }

    try {
        // Llamada a la función segura del servidor (RPC)
        const { error } = await window.supabaseClient.rpc('admin_delete_user', {
            target_user_id: client.id
        });

        if (error) throw error;

        alert("🗑️ Usuario eliminado del sistema correctamente.");
        closeClientModal();
        loadClientsData(); // Recargar tabla

    } catch (err) {
        console.error("Error al eliminar usuario:", err);
        // Fallback: Si no es un usuario registrado (solo lead), borrar de leads
        if (client.id.startsWith('GUEST-') || err.message.includes('UUID')) {
            await deleteLeadOnly(client.email);
        } else {
            alert("Error al eliminar: " + err.message);
        }
    }
};

// Función auxiliar para borrar solo leads (sin usuario Auth)
async function deleteLeadOnly(email) {
    try {
        const { error } = await window.supabaseClient
            .from('leads_wizard')
            .delete()
            .eq('email', email);

        if (error) throw error;
        alert("🗑️ Lead eliminado correctamente.");
        closeClientModal();
        loadClientsData();
    } catch (e) {
        alert("No se pudo eliminar: " + e.message);
    }
}

async function checkAdminRole() {
    const { data: { user } } = await window.supabaseClient.auth.getUser();
    if (!user) return false;
    const { data } = await window.supabaseClient.from('profiles').select('role').eq('id', user.id).single();
    return data?.role === 'admin';
}

function leadIdToUserId(leadId) {
    const lead = allClients.find(l => l.id === leadId);
    // En una implementación real, buscaríamos el user_id real del lead
    return null; // Temporal
}

window.notifyClient = function () {
    const client = allClients.find(c => c.id === currentClientId);
    if (!client) return;

    const mode = confirm("¿Deseas notificar vía WhatsApp?\n(Si cancelas, se abrirá el gestor de correo)");
    const message = `Hola ${client.name}, te contactamos desde BOXROOMER. Tu servicio está listo. Puedes ver más detalles en tu área privada. ¡Saludos!`;

    if (mode) {
        const phone = "34600000000"; // En una app real usaríamos client.phone
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
    } else {
        const subject = "Actualización de tu servicio BOXROOMER";
        const body = `Estimado/a ${client.name},\n\nLe contactamos para informarle sobre el estado de su servicio...\n\nAtentamente,\nEquipo BOXROOMER\ncorreo@boxroomer.com`;
        window.location.href = `mailto:${client.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    }
};

// --- CLIENT MODAL UI FUNCTIONS ---

window.closeClientModal = function () {
    const modal = document.getElementById('clientModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
};

window.switchTab = function (tabName) {
    // Actualizar botones
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active', 'border-brandPurple', 'text-white');
        btn.classList.add('border-transparent', 'text-slate-500');
    });

    // Encontrar el botón clickeado por su onclick
    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(btn => {
        if (btn.getAttribute('onclick').includes(`'${tabName}'`)) {
            btn.classList.add('active', 'border-brandPurple', 'text-white');
            btn.classList.remove('border-transparent', 'text-slate-500');
        }
    });

    // Cambiar contenido
    document.querySelectorAll('.tab-content').forEach(content => content.classList.add('hidden'));
    const activeContent = document.getElementById(`tab-${tabName}`);
    if (activeContent) activeContent.classList.remove('hidden');
};

// --- CHARGE MODAL FUNCTIONS ---

window.openChargeModal = function () {
    const modal = document.getElementById('chargeModal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
};

window.closeChargeModal = function () {
    const modal = document.getElementById('chargeModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
};

window.updateChargeAmount = function () {
    const select = document.getElementById('charge-concept');
    const amountInput = document.getElementById('charge-amount');
    const selectedOption = select.options[select.selectedIndex];
    const price = selectedOption.getAttribute('data-price');

    if (price && price !== "0") {
        amountInput.value = price;
    }
};

window.executeCharge = async function () {
    const amount = document.getElementById('charge-amount')?.value;
    const concept = document.getElementById('charge-concept')?.value;
    const notes = document.getElementById('charge-notes')?.value;

    if (!amount || parseFloat(amount) <= 0) {
        alert('⚠️ Debes introducir un importe válido');
        return;
    }

    if (!concept || concept.trim() === '') {
        alert('⚠️ Debes introducir un concepto');
        return;
    }

    if (!currentClientId) {
        alert('⚠️ No hay cliente seleccionado');
        return;
    }

    const client = allClients.find(c => c.id === currentClientId);
    if (!client) {
        alert('⚠️ Cliente no encontrado');
        return;
    }

    // Resolver ID de base de datos REAL (UUID)
    // Para registrados es client.id, para GUEST es client.real_lead_id
    const realDbId = client.real_lead_id || client.id;

    // Validar formato UUID (8-4-4-4-12)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(realDbId)) {
        console.error('❌ ID inválido para base de datos:', realDbId);
        alert('❌ Error: El ID del cliente no es válido para realizar cobros. Contacta con soporte.');
        return;
    }

    try {
        console.log('🚀 Iniciando cargo manual para:', client.email, 'ID:', realDbId);

        // Obtener sesión actual
        const { data: { session } } = await window.supabaseClient.auth.getSession();

        // Crear el registro de pago/factura
        // NOTA: Ponemos status 'completed' por defecto para cargos manuales de admin
        const { data, error } = await window.supabaseClient
            .from('payments')
            .insert({
                client_id: realDbId,
                client_email: client.email,
                client_name: client.name,
                amount: parseFloat(amount),
                concept: concept.trim(),
                notes: notes?.trim() || null,
                payment_type: 'manual_charge',
                status: 'completed', // Cambiado a completado por defecto
                created_at: new Date().toISOString(),
                created_by: session?.user?.email || 'admin'
            })
            .select()
            .single();

        if (error) throw error;

        console.log('✅ Cargo manual creado exitosamente:', data);

        // 3. Notificar por Email (Premium)
        if (window.EmailService) {
            await window.EmailService.send('manual_charge', client.email, {
                clientName: client.name,
                concept: concept.trim(),
                amount: amount
            });
        }

        // Limpiar formulario y cerrar
        document.getElementById('charge-amount').value = '';
        document.getElementById('charge-concept').value = '';
        document.getElementById('charge-notes').value = '';
        closeChargeModal();

        // Usar toast o feedback no intrusivo si existe, si no un alert formal
        if (window.showBoxBotToast) {
            window.showBoxBotToast(`✅ Cargo de ${amount}€ registrado con éxito`);
        } else {
            alert(`✅ Cargo REGISTRADO con éxito.\nImporte: ${amount}€\nConcepto: ${concept}`);
        }

        // Recargar datos del cliente
        if (typeof loadClientPayments === 'function') {
            await loadClientPayments(currentClientId);
        }

    } catch (err) {
        console.error('❌ Error fatal en executeCharge:', err);
        alert('❌ ERROR AL PROCESAR: ' + (err.message || 'Error desconocido del servidor'));
    }
};

window.handleStatusChange = async function (newStatus) {
    if (!currentClientId) return;
    const client = allClients.find(c => c.id === currentClientId);
    if (!client) return;

    if (!confirm(`¿Cambiar el estado de ${client.name} a ${newStatus}?`)) return;

    try {
        // Mapeo simple de UI a DB (si es necesario)
        let dbStatus = newStatus.toLowerCase();
        if (newStatus === 'ACTIVOS') dbStatus = 'active';
        if (newStatus === 'PENDIENTE_LLAMADA') dbStatus = 'pending_call';

        const { error } = await window.supabaseClient
            .from('leads_wizard')
            .update({ status: dbStatus })
            .eq('email', client.email);

        if (error) throw error;

        client.status = newStatus;
        document.getElementById('modal-status-badge').innerHTML = getStatusBadge(newStatus);
        renderClients();
        alert("✅ Estado actualizado correctamente.");
    } catch (err) {
        console.error("Error al actualizar estado:", err);
        alert("Error: " + err.message);
    }
};

// --- HELPERS ---

async function loadClientPayments(uiId) {
    const tableBody = document.getElementById('billing-table-body');
    if (!tableBody) return;

    tableBody.innerHTML = `<tr><td colspan="6" class="p-8 text-center opacity-30">Cargando pagos...</td></tr>`;

    try {
        const client = allClients.find(c => c.id === uiId);
        if (!client) return;

        const realDbId = client.real_lead_id || client.id;
        console.log("💰 Cargando pagos para:", client.email, "(DB ID:", realDbId, ")");

        const { data: payments, error } = await window.supabaseClient
            .from('payments')
            .select('*')
            .eq('client_id', realDbId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!payments || payments.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" class="p-8 text-center opacity-30 uppercase text-[9px] font-black tracking-widest">Sin transacciones registradas</td></tr>`;
            return;
        }

        tableBody.innerHTML = payments.map(p => {
            const date = new Date(p.created_at).toLocaleDateString('es-ES');
            let statusColor = 'text-yellow-500';
            let statusText = 'Pendiente';

            if (p.status === 'completed') { statusColor = 'text-green-500'; statusText = 'Pagado'; }
            if (p.status === 'failed') { statusColor = 'text-red-500'; statusText = 'Error'; }

            return `
                <tr>
                    <td class="p-4 text-[9px] text-slate-500">PAY-${p.id.substring(0, 8).toUpperCase()}</td>
                    <td class="p-4">${date}</td>
                    <td class="p-4">
                        <div class="font-bold text-white">${p.concept}</div>
                        ${p.notes ? `<div class="text-[9px] text-slate-500 italic mt-0.5">${p.notes}</div>` : ''}
                    </td>
                    <td class="p-4 font-black text-white">${p.amount}€</td>
                    <td class="p-4"><span class="${statusColor}">${statusText}</span></td>
                    <td class="p-4 text-right">
                        <button class="text-brandPurple hover:underline opacity-50 cursor-not-allowed">PDF</button>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (err) {
        console.error("❌ Error al cargar pagos:", err);
        tableBody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-red-500 opacity-60">Error al cargar historial de pagos</td></tr>`;
    }
}

async function loadClientHistory(uiId) {
    const historyList = document.getElementById('history-list');
    if (!historyList) return;

    try {
        const client = allClients.find(c => c.id === uiId);
        if (!client) return;

        const realDbId = client.real_lead_id || client.id;

        // Aquí podríamos cargar logs de una tabla de 'activity_logs'
        // Por ahora simulamos los hitos del Lead
        const { data: lead, error } = await window.supabaseClient
            .from('leads_wizard')
            .select('*')
            .eq('id', realDbId)
            .single();

        if (error) throw error;

        let historyHtml = `
            <div class="flex gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                <div class="w-2 h-2 rounded-full bg-green-500 mt-1.5 shrink-0"></div>
                <div>
                    <p class="text-xs font-black text-white uppercase italic tracking-widest">Lead Creado</p>
                    <p class="text-[9px] text-slate-500 font-bold uppercase mt-1">${new Date(lead.created_at).toLocaleString()} • WEB</p>
                </div>
            </div>
        `;

        if (lead.assigned_at) {
            historyHtml = `
                <div class="flex gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                    <div class="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0"></div>
                    <div>
                        <p class="text-xs font-black text-white uppercase italic tracking-widest">Servicio Asignado</p>
                        <p class="text-[9px] text-slate-500 font-bold uppercase mt-1">${new Date(lead.assigned_at).toLocaleString()} • Sistema</p>
                    </div>
                </div>
            ` + historyHtml;
        }

        if (lead.completed_at) {
            historyHtml = `
                <div class="flex gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5 shadow-lg shadow-green-500/5">
                    <div class="w-2 h-2 rounded-full bg-brandPurple mt-1.5 shrink-0"></div>
                    <div>
                        <p class="text-xs font-black text-white uppercase italic tracking-widest">Recogida Completada</p>
                        <p class="text-[9px] text-slate-500 font-bold uppercase mt-1">${new Date(lead.completed_at).toLocaleString()} • Driver</p>
                    </div>
                </div>
            ` + historyHtml;
        }

        historyList.innerHTML = historyHtml;

    } catch (err) {
        console.error("❌ Error al cargar historial:", err);
    }
}

window.handleLogout = async function () {
    if (confirm("¿Cerrar sesión en la Torre de Control?")) {
        await window.supabaseClient.auth.signOut();
        window.location.href = 'login.html';
    }
};

// Cierre de modales al hacer clic fuera del contenido
window.addEventListener('click', function (event) {
    const clientModal = document.getElementById('clientModal');
    const chargeModal = document.getElementById('chargeModal');

    if (event.target === clientModal) closeClientModal();
    if (event.target === chargeModal) closeChargeModal();
});
