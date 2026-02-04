document.addEventListener('DOMContentLoaded', async () => {
    // 1. Auth & Supabase Check
    if (!window.supabaseClient) {
        console.error("Supabase client not initialized.");
        return;
    }

    const { data: { session } } = await window.supabaseClient.auth.getSession();
    if (!session) {
        window.location.href = 'login.html';
        return;
    }

    // 2. Initial State
    window.currentUser = session.user;
    loadProfileHeader(session.user);
    checkAdminAccess(session.user);
});

async function checkAdminAccess(user) {
    console.log("🔍 [Auth] Verificando permisos de administrador para:", user.id);

    try {
        const { data: profile, error } = await window.supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();

        if (error) {
            console.error("❌ [Auth] Error al consultar perfil:", error);
        }

        const role = profile?.role || user.user_metadata?.role || 'client';

        // 🦸‍♂️ SUPERADMIN BYPASS: Si es tu email, forzamos rol admin para desbloquearte
        let finalRole = role;
        if (user.email === 'israel.madrigal@pluser.es') {
            finalRole = 'admin';
            console.log("👑 [Auth] Superadmin detectado por email. Acceso concedido.");
        }

        console.log("🛡️ [Auth] Rol detectado:", finalRole);

        if (finalRole === 'admin') {
            const nav = document.querySelector('nav.sidebar-nav-pill');
            if (nav) {
                // Evitar duplicados
                if (!document.getElementById('admin-sidebar-link')) {
                    const adminLink = document.createElement('a');
                    adminLink.id = 'admin-sidebar-link';
                    adminLink.href = 'admin_dashboard.html';
                    adminLink.className = 'flex items-center gap-4 px-5 py-4 rounded-2xl text-brandPurple bg-brandPurple/10 border border-brandPurple/20 hover:bg-brandPurple hover:text-white transition-all group mt-6';
                    adminLink.innerHTML = `
                        <span class="material-symbols-outlined">admin_panel_settings</span>
                        <span class="font-black text-[11px] uppercase tracking-widest">Panel Admin</span>
                    `;
                    nav.appendChild(adminLink);
                }
            }

            const mobileNav = document.querySelector('.bottom-nav-pill');
            if (mobileNav && !document.getElementById('admin-mobile-btn')) {
                const adminBtn = document.createElement('button');
                adminBtn.id = 'admin-mobile-btn';
                adminBtn.onclick = () => window.location.href = 'admin_dashboard.html';
                adminBtn.className = 'flex-1 flex flex-col items-center gap-1 py-1 text-brandPurple animate-pulse';
                adminBtn.innerHTML = `
                    <span class="material-symbols-outlined">shield_person</span>
                    <span class="text-[8px] font-black uppercase tracking-widest">Admin</span>
                `;
                mobileNav.insertBefore(adminBtn, mobileNav.lastElementChild);
            }
        }
    } catch (e) {
        console.error("❌ [Auth] Excepción en checkAdminAccess:", e);
    }
}

/**
 * Update Header with Real User Name and Initials
 */
async function loadProfileHeader(user) {
    const { data: profile } = await window.supabaseClient
        .from('profiles')
        .select('full_name, role')
        .eq('id', user.id)
        .maybeSingle();

    const fullName = profile?.full_name || user.user_metadata?.full_name || 'Usuario BoxRoomer';
    const role = profile?.role || user.user_metadata?.role || 'client';

    // Initials
    const initials = fullName.split(' ')
        .filter(n => n.length > 0)
        .map(n => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();

    const initialsEl = document.getElementById('profile-initials');
    if (initialsEl) initialsEl.innerText = initials;

    // Name Title
    const nameEl = document.getElementById('profile-name-title');
    if (nameEl) {
        const parts = fullName.split(' ');
        const first = parts[0];
        const rest = parts.slice(1).join(' ') || '';
        nameEl.innerHTML = `${first} <span class="text-brandPurple text-5xl md:text-7xl">${rest}</span>`;
    }

    // Status Badge
    const statusEl = document.getElementById('user-status-badge');
    if (statusEl) {
        statusEl.innerText = role === 'admin' ? 'Administrador' : 'Cliente BoxRoomer';
        if (role === 'admin') {
            statusEl.classList.remove('text-[var(--text-muted)]');
            statusEl.classList.add('text-brandPurple', 'border-brandPurple/30', 'bg-brandPurple/10');
        }
    }

    // Join Date
    const joinEl = document.getElementById('user-join-date');
    if (joinEl && user.created_at) {
        const date = new Date(user.created_at);
        const month = date.toLocaleDateString('es-ES', { month: 'short' });
        const year = date.getFullYear();
        joinEl.innerText = `Alta: ${month.toUpperCase()} ${year}`;
    }
}

// ---------------------------------------------------------
// MODAL SYSTEM
// ---------------------------------------------------------

const modal = document.getElementById('settings-modal');
const modalTitle = document.getElementById('modal-title');
const modalSubtitle = document.getElementById('modal-subtitle');
const modalBody = document.getElementById('modal-body');
const modalFooter = document.getElementById('modal-footer');

window.openModal = function (title, subtitle, contentHTML, showFooter = false) {
    if (!modal) return;
    modalTitle.innerText = title;
    modalSubtitle.innerText = subtitle;
    modalBody.innerHTML = contentHTML;

    if (showFooter && modalFooter) modalFooter.classList.remove('hidden');
    else if (modalFooter) modalFooter.classList.add('hidden');

    modal.classList.add('active');
}

window.closeModal = function () {
    if (modal) modal.classList.remove('active');
}

window.saveAndClose = function () {
    if (!modalFooter) return;
    const btn = modalFooter.querySelector('button');
    const originalText = btn.innerHTML;
    btn.innerHTML = 'Guardando...';
    setTimeout(() => {
        closeModal();
        btn.innerHTML = originalText;
        // In a real app we would update Supabase profile here
        alert('✅ Perfil actualizado correctamente.');
    }, 800);
}


// ---------------------------------------------------------
// SPECIFIC MODALS CONTENT
// ---------------------------------------------------------

window.openProfileModal = function () {
    const user = window.currentUser || {};
    const meta = user.user_metadata || {};

    const name = meta.full_name || '';
    const email = user.email || '';
    const phone = meta.phone || '';
    const dni = meta.dni || '';

    const html = `
        <div class="space-y-6">
            <div class="space-y-2">
                <label class="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest pl-2">Identidad Completa</label>
                <input id="input-profile-name" type="text" value="${name}" class="w-full bg-[var(--icon-bg)] border border-[var(--card-border)] rounded-2xl py-4 px-5 text-sm font-black text-[var(--text-main)] outline-none focus:border-brandPurple focus:bg-[var(--card-bg)]">
            </div>
            <div class="space-y-2">
                <label class="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest pl-2">DNI / NIF</label>
                <input id="input-profile-dni" type="text" value="${dni}" placeholder="Sin registrar" class="w-full bg-[var(--icon-bg)] border border-[var(--card-border)] rounded-2xl py-4 px-5 text-sm font-black text-[var(--text-main)] outline-none focus:border-brandPurple focus:bg-[var(--card-bg)]">
            </div>
            <div class="space-y-2">
                <label class="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest pl-2">Canal Email</label>
                <input type="email" value="${email}" readonly class="w-full bg-[var(--icon-bg)] border border-[var(--card-border)] rounded-2xl py-4 px-5 text-sm font-black text-[var(--text-main)] outline-none focus:border-brandPurple focus:bg-[var(--card-bg)] opacity-60 cursor-not-allowed">
            </div>
            <div class="space-y-2">
                <label class="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest pl-2">Teléfono</label>
                <input id="input-profile-phone" type="tel" value="${phone}" placeholder="+34 ..." class="w-full bg-[var(--icon-bg)] border border-[var(--card-border)] rounded-2xl py-4 px-5 text-sm font-black text-[var(--text-main)] outline-none focus:border-brandPurple focus:bg-[var(--card-bg)]">
            </div>
        </div>
    `;
    openModal('Datos Personales', 'Sincronización de perfil de usuario', html, true);

    // Override Save Button for Profile context
    const footerBtn = document.querySelector('#modal-footer button');
    if (footerBtn) {
        footerBtn.onclick = saveProfileData;
        footerBtn.innerHTML = `Guardar Cambios <span class="material-symbols-outlined text-lg">verified</span>`;
    }
}

/**
 * Real Profile Logic: Save to Supabase Auth Metadata
 */
window.saveProfileData = async function () {
    const btn = document.querySelector('#modal-footer button');
    const originalContent = btn.innerHTML;

    // 1. Get Values
    const name = document.getElementById('input-profile-name').value;
    const dni = document.getElementById('input-profile-dni').value;
    const phone = document.getElementById('input-profile-phone').value;

    // CONSTRAINT: Si ya tenía DNI, no puede dejarlo vacío
    const oldDni = window.currentUser?.user_metadata?.dni;
    if (oldDni && !dni.trim()) {
        window.showBoxBotToast('⚠️ El DNI/CIF es obligatorio para la facturación.');
        return;
    }

    // 2. Loading UI
    btn.disabled = true;
    btn.innerHTML = `<span class="material-symbols-outlined animate-spin text-lg">progress_activity</span> Guardando...`;

    try {
        // 3. Update Supabase
        const { data, error } = await window.supabaseClient.auth.updateUser({
            data: {
                full_name: name,
                dni: dni,
                phone: phone
            }
        });

        if (error) throw error;

        // 4. Update Local Session
        window.currentUser = data.user;
        loadProfileHeader(window.currentUser);

        // 5. Success UI
        btn.classList.remove('bg-brandPurple');
        btn.classList.add('bg-green-500', 'text-white');
        btn.innerHTML = `¡Guardado! <span class="material-symbols-outlined text-lg">check_circle</span>`;

        setTimeout(() => {
            closeModal();
            // Reset for next open
            btn.classList.remove('bg-green-500');
            btn.classList.add('bg-brandPurple');
            btn.innerHTML = originalContent;
            btn.disabled = false;
        }, 1200);

    } catch (err) {
        console.error("Profile save error:", err);
        btn.classList.remove('bg-brandPurple');
        btn.classList.add('bg-red-500', 'text-white');
        btn.innerHTML = `Error <span class="material-symbols-outlined">warning</span>`;

        setTimeout(() => {
            btn.classList.remove('bg-red-500');
            btn.classList.add('bg-brandPurple');
            btn.innerHTML = originalContent;
            btn.disabled = false;
        }, 2000);
    }
}

window.openSecurityModal = function () {
    const html = `
        <div class="space-y-6">
            <div class="p-6 bg-brandPurple/10 rounded-[2.5rem] border border-brandPurple/20 flex gap-4 items-center">
                <div class="w-12 h-12 rounded-2xl bg-brandPurple/20 flex items-center justify-center text-brandPurple">
                    <span class="material-symbols-outlined">shield</span>
                </div>
                <div class="flex-1">
                    <h4 class="text-xs font-black text-brandPurple uppercase italic tracking-tighter">Estado de Seguridad</h4>
                    <p class="text-[9px] text-[var(--text-muted)] font-bold uppercase tracking-widest mt-1">Estándar</p>
                </div>
            </div>

            <!-- Current Password (Optional/Visual in this flow if session is active) -->
            <div class="space-y-2 pt-4">
                <label class="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest pl-2">Contraseña Actual (Opcional)</label>
                <input id="input-sec-current" type="password" placeholder="••••••••" class="w-full bg-[var(--icon-bg)] border border-[var(--card-border)] rounded-2xl py-4 px-5 text-sm font-black text-[var(--text-main)] outline-none focus:border-brandPurple focus:bg-[var(--card-bg)]">
            </div>
            
            <div class="space-y-2">
                <label class="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest pl-2">Nueva Contraseña</label>
                <input id="input-sec-new" type="password" placeholder="Mínimo 6 caracteres" class="w-full bg-[var(--icon-bg)] border border-[var(--card-border)] rounded-2xl py-4 px-5 text-sm font-black text-[var(--text-main)] outline-none focus:border-brandPurple focus:bg-[var(--card-bg)]">
            </div>
        </div>
    `;
    openModal('Seguridad Box', 'Gestión de credenciales', html, true);

    // Override Button
    const footerBtn = document.querySelector('#modal-footer button');
    if (footerBtn) {
        footerBtn.onclick = saveSecurityData;
        footerBtn.innerHTML = `Actualizar Clave <span class="material-symbols-outlined text-lg">lock_reset</span>`;
    }
}

/**
 * Real Security Logic: Update Password
 */
window.saveSecurityData = async function () {
    const btn = document.querySelector('#modal-footer button');
    const originalContent = btn.innerHTML;
    const newPass = document.getElementById('input-sec-new').value;

    if (!newPass || newPass.length < 6) {
        alert("La contraseña debe tener al menos 6 caracteres.");
        return;
    }

    // UI Loading
    btn.disabled = true;
    btn.innerHTML = `<span class="material-symbols-outlined animate-spin text-lg">progress_activity</span> Actualizando...`;

    try {
        const { error } = await window.supabaseClient.auth.updateUser({
            password: newPass
        });

        if (error) throw error;

        // Success UI
        btn.classList.remove('bg-brandPurple');
        btn.classList.add('bg-green-500', 'text-white');
        btn.innerHTML = `¡Clave Actualizada! <span class="material-symbols-outlined text-lg">check_circle</span>`;

        setTimeout(() => {
            closeModal();
            // Reset
            btn.classList.remove('bg-green-500');
            btn.classList.add('bg-brandPurple');
            btn.innerHTML = originalContent;
            btn.disabled = false;
        }, 1200);

    } catch (err) {
        console.error("Password update error:", err);
        btn.classList.remove('bg-brandPurple');
        btn.classList.add('bg-red-500', 'text-white');
        btn.innerHTML = `Error: ${err.message} <span class="material-symbols-outlined">warning</span>`;

        setTimeout(() => {
            btn.classList.remove('bg-red-500');
            btn.classList.add('bg-brandPurple');
            btn.innerHTML = originalContent;
            btn.disabled = false;
        }, 2000);
    }
}

window.openContractsModal = async function () {
    const user = window.currentUser;
    if (!user) return;

    // Loading state
    openModal('Documentación', 'Tus contratos oficiales', `
        <div class="flex items-center justify-center py-12">
            <span class="material-symbols-outlined animate-spin text-3xl text-brandPurple">progress_activity</span>
        </div>
    `, false);

    try {
        const { data: lead } = await window.supabaseClient
            .from('leads_wizard')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        let html = '';
        if (lead) {
            const date = new Date(lead.created_at).toLocaleDateString('es-ES');
            html = `
                <div class="space-y-4">
                    <div class="group bg-[var(--icon-bg)] border border-[var(--card-border)] p-5 rounded-3xl flex items-center justify-between hover:bg-[var(--card-hover)] transition-all">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-2xl bg-brandPurple/10 flex items-center justify-center text-brandPurple border border-brandPurple/20">
                                <span class="material-symbols-outlined text-xl">description</span>
                            </div>
                            <div>
                                <h4 class="text-xs font-black text-[var(--text-main)] uppercase italic tracking-tighter">Contrato de Almacenaje</h4>
                                <p class="text-[9px] text-[var(--text-muted)] font-bold uppercase tracking-widest mt-1">Ref: ${lead.id.substring(0, 8)} • ${date}</p>
                            </div>
                        </div>
                        <button class="w-10 h-10 rounded-xl bg-[var(--app-bg)] border border-[var(--card-border)] flex items-center justify-center text-[var(--text-muted)] hover:text-brandPurple hover:bg-brandPurple/10 transition-all">
                            <span class="material-symbols-outlined text-lg">download</span>
                        </button>
                    </div>
                    <p class="text-[8px] text-center text-[var(--text-muted)] font-bold uppercase tracking-[0.2em] px-4">Los documentos firmados digitalmente tienen plena validez legal conforme a la normativa vigente.</p>
                </div>
            `;
        } else {
            html = `
                <div class="text-center py-12 opacity-50">
                     <span class="material-symbols-outlined text-4xl mb-4">folder_off</span>
                     <p class="text-xs font-black uppercase tracking-widest">No hay contratos activos</p>
                     <p class="text-[10px] text-[var(--text-muted)] mt-2">Los documentos legales aparecerán aquí tras completar tu primera reserva.</p>
                </div>
            `;
        }
        openModal('Documentación', 'Tus contratos oficiales', html, false);
    } catch (e) {
        console.error("Error loading contracts:", e);
        closeModal();
    }
}

// ---------------------------------------------------------
// ADDRESS SYSTEM (Cloud Synced via User Metadata)
// ---------------------------------------------------------

// Initialize data from metadata if available, else localStorage
let userAddresses = [];

// Helper to sync to cloud
async function syncAddressesToCloud(addresses) {
    userAddresses = addresses; // Update local cache
    localStorage.setItem('BOXROOMER_USER_ADDRESSES', JSON.stringify(addresses)); // Keep local copy for speed

    // Cloud Sync
    try {
        await window.supabaseClient.auth.updateUser({
            data: { saved_addresses: addresses }
        });
        console.log("☁️ Addresses synced to Supabase metadata");
    } catch (e) {
        console.error("Sync error:", e);
    }
}

// Init logic needs to run after auth load (hook into main DOMContentLoaded or init)
// We'll lazy load it when opening the modal or using `user`.
// But better: when we loaded profile, we implicitly had metadata. 
// Let's assume window.currentUser is updated.

window.openAddressesModal = function () {
    // Try to refresh from metadata
    if (window.currentUser && window.currentUser.user_metadata?.saved_addresses) {
        userAddresses = window.currentUser.user_metadata.saved_addresses;
    } else {
        // Fallback or empty
        userAddresses = JSON.parse(localStorage.getItem('BOXROOMER_USER_ADDRESSES') || '[]');
    }
    renderAddressesList();
}

window.renderAddressesList = function () {
    let listHTML = `
        <div class="space-y-4">
            <div class="flex items-center justify-between mb-2">
                <button onclick="openAddressForm()" class="flex items-center gap-2 px-4 py-2 bg-brandPurple/10 text-brandPurple rounded-xl text-[9px] font-black uppercase tracking-widest border border-brandPurple/20 hover:bg-brandPurple hover:text-white transition-all">
                    <span class="material-symbols-outlined text-sm">add</span> Añadir Nueva
                </button>
            </div>
            <div class="space-y-3">
    `;

    if (!userAddresses || userAddresses.length === 0) {
        listHTML += `
            <div class="text-center py-8 opacity-50 border border-dashed border-[var(--card-border)] rounded-3xl">
                <span class="material-symbols-outlined text-2xl mb-2">location_off</span>
                <p class="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">No tienes direcciones guardadas</p>
            </div>
        `;
    } else {
        userAddresses.forEach(addr => {
            listHTML += `
                <div class="group flex items-center justify-between p-5 bg-[var(--icon-bg)] border border-[var(--card-border)] rounded-3xl hover:bg-[var(--card-hover)] transition-all">
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 rounded-xl bg-[var(--card-bg)] border border-[var(--card-border)] flex items-center justify-center ${addr.default ? 'text-brandPurple border-brandPurple/30 bg-brandPurple/5' : 'text-[var(--text-muted)]'}">
                            <span class="material-symbols-outlined text-lg">${addr.default ? 'stars' : 'location_on'}</span>
                        </div>
                        <div>
                            <h4 class="text-[11px] font-black text-[var(--text-main)] uppercase italic tracking-tighter">${addr.name}</h4>
                            <p class="text-[9px] text-[var(--text-muted)] font-bold uppercase tracking-widest mt-1">${addr.street}, ${addr.cp} ${addr.city}</p>
                        </div>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="openAddressForm(${addr.id})" class="w-9 h-9 rounded-xl flex items-center justify-center text-[var(--text-muted)] hover:text-brandPurple hover:bg-brandPurple/10 transition-all">
                            <span class="material-symbols-outlined text-sm">edit</span>
                        </button>
                        <button onclick="deleteAddress(${addr.id})" class="w-9 h-9 rounded-xl flex items-center justify-center text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-all">
                            <span class="material-symbols-outlined text-sm">delete</span>
                        </button>
                    </div>
                </div>
            `;
        });
    }

    listHTML += `</div></div>`;
    openModal('Mis Direcciones', 'Gestión de puntos de recogida y entrega', listHTML, false);
}

window.openAddressForm = function (id = null) {
    editingAddressId = id;
    const addr = id ? userAddresses.find(a => a.id === id) : null;

    const formHTML = `
        <div class="space-y-5">
            <div class="space-y-2">
                <label class="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest pl-2">Alias (Ej: Casa)</label>
                <input type="text" id="new-addr-name" value="${addr ? addr.name : ''}" class="w-full bg-[var(--icon-bg)] border border-[var(--card-border)] rounded-2xl py-4 px-5 text-sm font-black text-[var(--text-main)] outline-none focus:border-brandPurple">
            </div>
            <div class="space-y-2 relative">
                <label class="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest pl-2">Calle y Número</label>
                <input type="text" id="new-addr-street" value="${addr ? addr.street : ''}" class="w-full bg-[var(--icon-bg)] border border-[var(--card-border)] rounded-2xl py-4 px-5 text-sm font-medium text-[var(--text-main)] outline-none focus:border-brandPurple" autocomplete="off">
            </div>
            <div class="flex gap-4">
                 <div class="flex-1 space-y-2">
                    <label class="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest pl-2">CP</label>
                    <input type="text" id="new-addr-cp" value="${addr ? addr.cp : ''}" class="w-full bg-[var(--icon-bg)] border border-[var(--card-border)] rounded-2xl py-4 px-5 text-sm font-black text-[var(--text-main)] outline-none focus:border-brandPurple">
                 </div>
                 <div class="flex-[2] space-y-2">
                    <label class="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest pl-2">Ciudad</label>
                    <input type="text" id="new-addr-city" value="${addr ? addr.city : ''}" class="w-full bg-[var(--icon-bg)] border border-[var(--card-border)] rounded-2xl py-4 px-5 text-sm font-black text-[var(--text-main)] outline-none focus:border-brandPurple">
                 </div>
            </div>
            <div class="flex justify-between items-center bg-brandPurple/5 p-4 rounded-3xl border border-brandPurple/10 mt-6">
                <div class="flex items-center gap-3">
                     <span class="material-symbols-outlined text-brandPurple">stars</span>
                     <span class="text-[9px] font-black text-brandPurple uppercase tracking-widest">Principal</span>
                </div>
                <input type="checkbox" id="new-addr-default" ${addr && addr.default ? 'checked' : ''} class="w-5 h-5 accent-brandPurple cursor-pointer">
            </div>

            <div class="pt-6 flex gap-4">
                <button onclick="renderAddressesList()" class="flex-1 py-4 bg-[var(--icon-bg)] border border-[var(--card-border)] rounded-2xl text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--text-main)] transition-all">Cancelar</button>
                <button onclick="saveAddress()" class="flex-[2] py-4 bg-brandPurple text-white rounded-2xl font-black uppercase text-[9px] tracking-[0.3em] shadow-xl shadow-brandPurple/20 hover:scale-[1.02] transition-all">${addr ? 'Actualizar' : 'Guardar'}</button>
            </div>
        </div>
    `;
    openModal(addr ? 'Editar Dirección' : 'Nueva Dirección', '', formHTML, false);

    setTimeout(() => {
        initAddressAutocomplete('new-addr-street', 'new-addr-cp', 'new-addr-city');
    }, 100);
}

window.saveAddress = async function () {
    const name = document.getElementById('new-addr-name').value;
    const street = document.getElementById('new-addr-street').value;
    const cp = document.getElementById('new-addr-cp').value;
    const city = document.getElementById('new-addr-city').value;
    const isDefault = document.getElementById('new-addr-default').checked;

    if (!name || !street || !cp || !city) {
        alert('Por favor, completa todos los campos.');
        return;
    }

    // Clone current array
    let updatedList = [...userAddresses];

    if (isDefault) {
        updatedList.forEach(a => a.default = false);
    }

    if (editingAddressId) {
        const index = updatedList.findIndex(a => a.id === editingAddressId);
        if (index !== -1) {
            updatedList[index] = { ...updatedList[index], name, street, cp, city, default: isDefault };
        }
    } else {
        const newAddr = { id: Date.now(), name, street, cp, city, default: isDefault };
        updatedList.push(newAddr);
    }

    // Sync to Cloud
    await syncAddressesToCloud(updatedList);

    renderAddressesList();
}

window.deleteAddress = async function (id) {
    if (userAddresses.length <= 1) {
        window.showBoxBotToast('⚠️ Debes mantener al menos una dirección activa.');
        return;
    }

    if (confirm('¿Eliminar dirección?')) {
        const updatedList = userAddresses.filter(a => a.id !== id);
        await syncAddressesToCloud(updatedList);
        renderAddressesList();
    }
}


// ---------------------------------------------------------
// NOMINATIM AUTOCOMPLETE (Cleaned up)
// ---------------------------------------------------------
let autocompleteTimeout = null;

function initAddressAutocomplete(inputId, cpId, cityId) {
    const input = document.getElementById(inputId);
    if (!input) return;

    let dropdown = document.getElementById('photon-dropdown');
    if (dropdown) dropdown.remove();

    dropdown = document.createElement('div');
    dropdown.id = 'photon-dropdown';
    dropdown.className = 'photon-autocomplete-dropdown';
    document.body.appendChild(dropdown);

    const positionDropdown = () => {
        const rect = input.getBoundingClientRect();
        dropdown.style.position = 'fixed';
        dropdown.style.top = (rect.bottom + 5) + 'px';
        dropdown.style.left = rect.left + 'px';
        dropdown.style.width = rect.width + 'px';
        dropdown.style.background = 'var(--card-bg)';
        dropdown.style.border = '1px solid var(--card-border)';
        dropdown.style.borderRadius = '1rem';
        dropdown.style.zIndex = '9999';
        dropdown.style.padding = '0.5rem';
        dropdown.style.maxHeight = '200px';
        dropdown.style.overflowY = 'auto';
        dropdown.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5)';
    };

    input.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        if (autocompleteTimeout) clearTimeout(autocompleteTimeout);
        if (query.length < 3) {
            dropdown.style.display = 'none';
            return;
        }
        positionDropdown();
        autocompleteTimeout = setTimeout(() => {
            fetchNominatim(query, dropdown, cpId, cityId, inputId);
        }, 500);
    });

    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });
}

function fetchNominatim(query, dropdown, cpId, cityId, inputId) {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=3&countrycodes=es`;
    fetch(url)
        .then(res => res.json())
        .then(data => {
            dropdown.innerHTML = '';
            if (!data.length) {
                dropdown.style.display = 'none';
                return;
            }
            dropdown.style.display = 'block';
            data.forEach(item => {
                const div = document.createElement('div');
                div.className = 'p-3 hover:bg-[var(--icon-bg)] rounded-xl cursor-pointer text-xs mb-1';
                div.innerText = item.display_name;
                div.onclick = () => {
                    document.getElementById(inputId).value = item.address.road || item.display_name.split(',')[0];
                    if (cpId && item.address.postcode) document.getElementById(cpId).value = item.address.postcode;
                    if (cityId && (item.address.city || item.address.town)) document.getElementById(cityId).value = item.address.city || item.address.town;
                    dropdown.style.display = 'none';
                };
                dropdown.appendChild(div);
            });
        }).catch(e => console.error(e));
}
