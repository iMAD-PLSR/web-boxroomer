document.addEventListener('DOMContentLoaded', async () => {
    // 1. Auth Check - STRICT
    if (!window.supabaseClient) return;

    const { data: { session } } = await window.supabaseClient.auth.getSession();
    if (!session) {
        window.location.href = 'login.html';
        return;
    }

    loadRealPayments(session.user.id);
});

async function loadRealPayments(userId) {
    const invoicesContainer = document.getElementById('invoices-list-container');
    const cardsContainer = document.getElementById('savedCardsList');

    // Widget Elements
    const planNameEl = document.getElementById('plan-name');
    const planDurationEl = document.getElementById('plan-duration');
    const planStartEl = document.getElementById('plan-start-date');
    const planExpiryEl = document.getElementById('planExpiryDate');
    const planVolEl = document.getElementById('plan-volume');
    const monthlyFeeEl = document.getElementById('monthly-fee');
    const nextChargeEl = document.getElementById('next-charge-date');

    // 1. Buscamos TODOS los contratos/leads del usuario
    let { data: leads, error: leadErr } = await window.supabaseClient
        .from('leads_wizard')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    console.log("📊 [Pagos] Leads cargados:", leads);

    // FALLBACK: Si no hay leads por ID, buscamos por EMAIL de la sesión
    if (!leads || leads.length === 0) {
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        if (session?.user?.email) {
            console.log("🔍 [Pagos] Probando fallback por email:", session.user.email);
            const { data: leadsByEmail } = await window.supabaseClient
                .from('leads_wizard')
                .select('*')
                .eq('email', session.user.email)
                .order('created_at', { ascending: false });

            if (leadsByEmail && leadsByEmail.length > 0) {
                leads = leadsByEmail;
                // Auto-vínculo para el futuro
                leadsByEmail.forEach(async (l) => {
                    if (!l.user_id) {
                        await window.supabaseClient
                            .from('leads_wizard')
                            .update({ user_id: userId })
                            .eq('id', l.id);
                    }
                });
            }
        }
    }

    // 2. Buscamos pagos adicionales (Cargos manuales, tiempo extra, etc.) por EMAIL
    const { data: payments } = await window.supabaseClient
        .from('payments')
        .select('*')
        .eq('client_email', leads[0].email) // Usamos el email del lead principal
        .order('created_at', { ascending: false });

    const servicesContainer = document.getElementById('active-services-list');

    if (leads && leads.length > 0) {
        window.activeLeadId = leads[0].id;

        // CONSOLIDATION LOGIC
        let totalVol = 0;
        let totalMonthly = 0;
        let earliestDate = new Date();
        let latestExpiry = new Date(0);

        // Render Active Services Detail
        if (servicesContainer) {
            servicesContainer.classList.remove('hidden');
            servicesContainer.innerHTML = `<h4 class="text-[8px] font-black text-brandPurple uppercase tracking-widest mb-3">Tus Espacios Activos</h4>`;

            leads.forEach((l, idx) => {
                const created = new Date(l.created_at);
                const expiry = new Date(created);
                expiry.setMonth(expiry.getMonth() + (parseInt(l.duration_months) || 1));

                // --- INFO DE ESTADO Y RENOVACIÓN PROMETIDA ---
                let renewalStatusHTML = `
                    <div class="flex items-center gap-1.5 px-3 py-1 bg-green-500/10 text-green-400 rounded-lg border border-green-500/20">
                        <span class="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                        <span class="text-[8px] font-black uppercase tracking-widest italic">Activo: ${l.duration_months} Meses</span>
                    </div>
                `;

                // Si hay un plan futuro programado, lo mostramos con prioridad
                if (l.next_plan_duration) {
                    const months = l.next_plan_duration;
                    const planName = months === 12 ? 'Anual' : (months === 6 ? '6 Meses' : 'Mensual');

                    // Cálculo de precio futuro para ESTE lead específico
                    const basePrice = (idx === leads.length - 1) ? 39 : (parseFloat(l.volume_m3) * 16);
                    const discount = (months === 12) ? 0.8 : (months === 6 ? 0.9 : 1.0);
                    const nextPrice = basePrice * discount;

                    renewalStatusHTML = `
                        <div class="flex flex-col items-end gap-1">
                             <div class="flex items-center gap-1.5 px-3 py-1 bg-white/5 text-[var(--text-muted)] rounded-lg border border-white/10 opacity-60">
                                <span class="text-[7px] font-black uppercase tracking-widest italic">Actual: ${l.duration_months}m</span>
                             </div>
                             <div class="flex items-center gap-1.5 px-3 py-1 bg-brandPurple text-white rounded-lg shadow-lg shadow-brandPurple/20 animate-fade-in">
                                <span class="material-symbols-outlined text-[10px] filled">event_repeat</span>
                                <span class="text-[8px] font-black uppercase tracking-widest italic ml-1">PRÓXIMO CICLO: ${planName} (${nextPrice.toFixed(2)}€)</span>
                             </div>
                        </div>
                    `;
                }

                servicesContainer.innerHTML += `
                    <div class="flex flex-col gap-4 p-5 bg-white/[0.03] border border-white/5 rounded-[2rem] mb-4 hover:border-brandPurple/20 transition-all duration-300">
                        <div class="flex items-start justify-between">
                            <div class="flex items-center gap-4">
                                <div class="w-12 h-12 rounded-2xl bg-brandPurple/10 flex items-center justify-center text-brandPurple border border-brandPurple/20">
                                    <span class="material-symbols-outlined text-xl">inventory_2</span>
                                </div>
                                <div>
                                    <h4 class="text-[12px] font-black text-[var(--text-main)] uppercase italic tracking-tighter">${l.volume_m3} m³ Almacenaje</h4>
                                    <p class="text-[8px] text-[var(--text-muted)] font-bold uppercase tracking-widest mt-0.5">Vencimiento: ${expiry.toLocaleDateString('es-ES')}</p>
                                </div>
                            </div>
                            ${renewalStatusHTML}
                        </div>
                        <button onclick="window.openRenewalModal('${l.id}')" 
                            class="w-full py-3.5 bg-[var(--icon-bg)] hover:bg-brandPurple/10 text-[var(--text-muted)] hover:text-brandPurple rounded-2xl text-[9px] font-black uppercase tracking-widest border-2 border-dashed border-[var(--card-border)] hover:border-brandPurple/30 transition-all flex items-center justify-center gap-3">
                            <span class="material-symbols-outlined text-sm">settings_backup_restore</span> Gestionar Próxima Renovación
                        </button>
                    </div>
                `;
            });
        }

        leads.forEach(l => {
            const vol = parseFloat(l.volume_m3 || 0);
            totalVol += vol;
            totalMonthly += parseFloat(l.total_monthly || 0);

            const created = new Date(l.created_at);
            if (created < earliestDate) earliestDate = created;

            const expiry = new Date(created);
            expiry.setMonth(expiry.getMonth() + (parseInt(l.duration_months) || 1));
            if (expiry > latestExpiry) latestExpiry = expiry;
        });

        const volStr = totalVol.toFixed(1);
        const monthlyFeeStr = totalMonthly.toLocaleString('es-ES', { minimumFractionDigits: 2 });

        if (planNameEl) planNameEl.innerText = leads.length > 1 ? 'Espacio Consolidado' : (leads[0].pack_type === 'mini' ? 'Pack Mini' : (leads[0].pack_type === 'duo' ? 'Pack Duo' : 'Pack Custom'));
        if (planDurationEl) planDurationEl.innerText = leads.length > 1 ? `${leads.length} Planes Activos` : `${leads[0].duration_months || 1} Meses`;

        if (planStartEl) planStartEl.innerText = `Desde ${earliestDate.toLocaleDateString('es-ES')}`;
        if (planExpiryEl) planExpiryEl.innerText = `Próxima Renovación: ${latestExpiry.toLocaleDateString('es-ES')}`;

        if (planVolEl) planVolEl.innerText = volStr;
        if (monthlyFeeEl) monthlyFeeEl.innerText = monthlyFeeStr;

        // Populate Modal Reference Labels
        const modalVolBase = document.getElementById('modal-volume-base');
        if (modalVolBase) modalVolBase.innerText = volStr;

        const advanceTotalEl = document.getElementById('advance-total-amount');
        if (advanceTotalEl) advanceTotalEl.innerText = `${monthlyFeeStr}€`;

        window.currentMonthlyTotal = totalMonthly;

        // NEXT CHARGE CALCULATION (Billing-Friendly)
        const nextChargeDate = new Date(earliestDate);
        const targetMonth = nextChargeDate.getMonth() + 1 + (payments?.length || 0);

        // Seteamos el mes
        nextChargeDate.setMonth(targetMonth);

        // Si el mes resultante no es el esperado (overflow de días como 30 de feb), 
        // nos quedamos en el último día del mes correcto.
        if (nextChargeDate.getMonth() > (targetMonth % 12)) {
            nextChargeDate.setDate(0);
        }

        if (nextChargeEl) nextChargeEl.innerText = nextChargeDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });

        // DYNAMIC RENEWAL MODAL PRICES
        const baseMonthlyRenewal = 39 + (totalVol > 1 ? (totalVol - 1) * 16 : 0);
        const pMonthly = document.getElementById('price-monthly');
        const p6m = document.getElementById('price-6months');
        const p12m = document.getElementById('price-12months');

        if (pMonthly) pMonthly.innerText = `${baseMonthlyRenewal.toFixed(2)}€/mes`;
        if (p6m) p6m.innerText = `${(baseMonthlyRenewal * 0.9).toFixed(2)}€/mes`;
        if (p12m) p12m.innerText = `${(baseMonthlyRenewal * 0.8).toFixed(2)}€/mes`;

        // Update Global for any JS logic needing it
        window.userTotalVolume = totalVol;
        window.baseMonthlyRenewal = baseMonthlyRenewal;

        // INVOICES LOGIC: Combined view
        invoicesContainer.innerHTML = '';

        // 1. Pagos Adicionales y Cuotas
        if (payments) {
            payments.forEach(p => {
                invoicesContainer.innerHTML += createInvoiceRow(p.concept || `Servicio Adicional`, p.created_at, p.amount, p.id, true, p.notes);
            });
        }

        // 2. Reserva Inicial
        leads.forEach(lead => {
            invoicesContainer.innerHTML += createInvoiceRow(`Reserva Inicial - ${lead.volume_m3}m³`, lead.created_at, lead.total_initial, lead.id, false);
        });
    } else {
        invoicesContainer.innerHTML = `
        <div class="text-center py-10 opacity-50">
             <span class="material-symbols-outlined text-4xl mb-4">receipt_long</span>
             <p class="text-xs font-black uppercase tracking-widest">No hay movimientos registrados</p>
        </div>
        `;
    }

    // CARDS LOGIC: (Implementing placeholder for now)
    const emptyCards = document.getElementById('payment-methods-empty');
    if (emptyCards) emptyCards.style.display = 'block';
    if (cardsContainer) cardsContainer.innerHTML = '';
}

// Helper to create invoice row
function createInvoiceRow(title, date, amount, id, isMonthly, notes) {
    const d = new Date(date);
    const dateStr = d.toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' });
    const amountStr = parseFloat(amount || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 });
    const statusBadge = `<span class="w-1.5 h-1.5 rounded-full bg-green-500"></span><span class="text-[8px] text-green-400 font-black uppercase tracking-[0.2em]">Pagado</span>`;
    const icon = isMonthly ? 'calendar_today' : 'verified';

    return `
    <div class="group bg-[var(--card-bg)] hover:bg-[var(--card-hover)] border border-[var(--card-border)] p-6 rounded-[2.5rem] flex items-center justify-between transition-all duration-300 shadow-lg hover:shadow-xl overflow-hidden relative animate-fade-in mb-4 last:mb-0">
        <div class="flex items-center gap-6 relative z-10">
            <div class="w-14 h-14 rounded-2xl bg-[var(--icon-bg)] flex items-center justify-center border border-[var(--card-border)] group-hover:bg-brandPurple/10 group-hover:border-brandPurple/30 transition-all">
                <span class="material-symbols-outlined text-[var(--text-muted)] group-hover:text-brandPurple transition-colors">${icon}</span>
            </div>
            <div>
                <h4 class="text-sm font-black text-[var(--text-main)] uppercase italic tracking-tighter text-left">${title}</h4>
                <div class="flex items-center gap-3 mt-1.5">
                    <span class="text-[9px] text-[var(--text-muted)] font-bold uppercase tracking-widest">${dateStr}</span>
                    <span class="w-1 h-1 rounded-full bg-[var(--card-border)]"></span>
                    <span class="text-[9px] text-[var(--text-muted)] font-bold uppercase tracking-widest">REF: ${id.substring(0, 8)}</span>
                </div>
                ${notes ? `<p class="text-[10px] text-brandPurple/60 font-medium italic mt-1">"${notes}"</p>` : ''}
            </div>
        </div>
         <div class="flex items-center gap-8 relative z-10">
            <div class="text-right">
                <p class="text-sm font-black text-[var(--text-main)] tracking-widest leading-none">${amountStr} €</p>
                <div class="flex items-center justify-end gap-1.5 mt-2">
                    ${statusBadge}
                </div>
            </div>
             <button onclick="window.downloadInvoice('${id}', ${isMonthly})"
                class="w-12 h-12 rounded-2xl bg-[var(--icon-bg)] border border-[var(--card-border)] flex items-center justify-center text-[var(--text-muted)] hover:text-brandPurple hover:bg-brandPurple/10 transition-all">
                <span class="material-symbols-outlined text-lg">download</span>
            </button>
        </div>
    </div>`;
}

// Plan Selection Global State
window.selectedRenewalPlan = '12months';

window.selectRenewalPlan = function (plan, event) {
    window.selectedRenewalPlan = plan;
    const cards = document.querySelectorAll('.plan-card');
    cards.forEach(card => {
        card.classList.remove('bg-brandPurple/5', 'border-brandPurple');
        card.classList.add('bg-[var(--icon-bg)]', 'border-transparent');

        const labels = card.querySelectorAll('p, div');
        labels.forEach(l => {
            l.classList.remove('text-brandPurple', 'text-brandPurple/60');
            if (l.tagName === 'P') l.classList.add('text-[var(--text-muted)]');
        });
    });

    // Usar el evento pasado o el global si existe
    const target = event?.currentTarget || event?.target?.closest('.plan-card');
    if (target) {
        target.classList.remove('bg-[var(--icon-bg)]', 'border-transparent');
        target.classList.add('bg-brandPurple/5', 'border-brandPurple');

        const pHeader = target.querySelector('p:first-child');
        const pFooter = target.querySelector('p:last-child');
        if (pHeader) { pHeader.classList.remove('text-[var(--text-muted)]'); pHeader.classList.add('text-brandPurple'); }
        if (pFooter) { pFooter.classList.remove('text-slate-500'); pFooter.classList.add('text-brandPurple/60'); }
    }
};

window.confirmAdvancePayment = async function () {
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    if (!session) return;

    window.showBoxBotToast('💰 BoxBot está procesando la transacción...');

    const { error } = await window.supabaseClient.from('payments').insert([{
        user_id: session.user.id,
        lead_id: window.activeLeadId,
        amount: window.currentMonthlyTotal,
        description: `Mensualidad adelantada`
    }]);

    if (!error) {
        window.showBoxBotToast('⚡ BoxBot ha procesado tu pago anticipado. Próximo cargo actualizado.');

        // Notificar por Email (Mensualidad)
        if (window.EmailService) {
            window.EmailService.send('monthly_payment', session.user.email, {
                amount: window.currentMonthlyTotal || 0
            });
        }

        loadRealPayments(session.user.id);
        if (typeof closeAdvancePaymentModal === 'function') closeAdvancePaymentModal();
    } else {
        window.showBoxBotToast('❌ Error al procesar el pago. Inténtalo de nuevo.');
    }
}

// Modal Open with Lead context
window.openRenewalModal = async function (leadId) {
    window.managingLeadId = leadId;

    // Buscar info del lead para personalizar el modal
    const { data: lead } = await window.supabaseClient
        .from('leads_wizard')
        .select('*')
        .eq('id', leadId)
        .single();

    if (lead) {
        const volBase = document.getElementById('modal-volume-base');
        if (volBase) volBase.innerText = lead.volume_m3;

        // Calcular precios para ESTE volumen específico
        const base = 39 + (parseFloat(lead.volume_m3) > 1 ? (parseFloat(lead.volume_m3) - 1) * 16 : 0);
        document.getElementById('price-monthly').innerText = `${base.toFixed(2)}€/mes`;
        document.getElementById('price-6months').innerText = `${(base * 0.9).toFixed(2)}€/mes`;
        document.getElementById('price-12months').innerText = `${(base * 0.8).toFixed(2)}€/mes`;

        // Marcar auto-renew según DB
        const autoCheck = document.getElementById('autoRenewCheck');
        if (autoCheck) autoCheck.checked = lead.auto_renew_active !== false;
    }

    document.getElementById('renewalModal').classList.remove('hidden');
};

window.confirmRenewal = async function () {
    const isAuto = document.getElementById('autoRenewCheck')?.checked;
    const plan = window.selectedRenewalPlan || '12months';
    const leadId = window.managingLeadId;

    if (!leadId) {
        window.showBoxBotToast('⚠️ Error: No se ha seleccionado ningún espacio.');
        return;
    }

    window.showBoxBotToast('⚙️ BoxBot está programando tu renovación...');

    try {
        // Determinamos duración futura
        let duration = 1;
        if (plan === '6months') duration = 6;
        else if (plan === '12months') duration = 12;

        // Guardamos intención solo para ESTE lead
        const { error: updateError } = await window.supabaseClient
            .from('leads_wizard')
            .update({
                next_plan_duration: duration,
                auto_renew_active: isAuto
            })
            .eq('id', leadId);

        if (updateError) {
            console.error("❌ [DB Error] Fallo al actualizar plan:", updateError);
            window.showBoxBotToast('❌ Error de seguridad o base de datos. Revisa los permisos RLS.');
            return;
        }

        window.showBoxBotToast(`✅ ¡Hecho! Este espacio renovará como ${plan === '12months' ? 'Anual' : (plan === '6months' ? 'Semestral' : 'Mensual')}.`);

        // Forzar recarga de los datos para mostrar el badge "PRÓXIMO CICLO"
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        if (session) {
            await loadRealPayments(session.user.id);
        }

        if (typeof closeRenewalModal === 'function') closeRenewalModal();

    } catch (err) {
        console.error("🚨 Error crítico al programar:", err);
        window.showBoxBotToast('❌ Error inesperado. Inténtalo de nuevo.');
    }
}

/**
 * UNIVERSAL Invoice Generation (Leads or Monthly Payments)
 */
window.downloadInvoice = async function (id, isMonthly = false) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    window.showBoxBotToast('📄 BoxBot está firmando tu factura oficial...');

    let lead, payment, amount, description, date, recordId;

    if (isMonthly) {
        const { data: p } = await window.supabaseClient.from('payments').select('*').eq('id', id).single();
        if (!p) return;
        payment = p;
        amount = parseFloat(p.amount);
        date = p.created_at;
        recordId = p.id;

        // Intentar obtener el lead asociado si existe (opcional para cargos manuales generales)
        if (p.client_id) {
            const { data: l } = await window.supabaseClient.from('leads_wizard').select('*').eq('id', p.client_id).single();
            lead = l;
        }

        description = p.concept || `Servicio Adicional BoxRoomer`;
    } else {
        const { data: l } = await window.supabaseClient.from('leads_wizard').select('*').eq('id', id).single();
        if (!l) return;
        lead = l;
        amount = parseFloat(l.total_initial);

        const covDate = new Date(l.created_at);
        const monthYear = covDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
        const capMonth = monthYear.charAt(0).toUpperCase() + monthYear.slice(1);

        description = `Reserva Inicial - Almacenaje (${capMonth})`;
        date = l.created_at;
        recordId = l.id;
    }

    const { data: profile } = await window.supabaseClient.from('profiles').select('*').eq('id', lead.user_id).maybeSingle();

    const purple = [107, 33, 168];
    const gray = [100, 116, 139];

    // --- HEADER ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(28);
    doc.setTextColor(...purple);
    doc.text("BOXROOMER", 20, 30);

    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.text("FACTURA", 20, 40);

    // Nueva Numeración Robusta: BR-YYYY-MM-XXXX (ej: BR-2026-01-0101)
    const year = new Date(date).getFullYear();
    const month = String(new Date(date).getMonth() + 1).padStart(2, '0');
    const seqNum = isMonthly ? (payment.invoice_number || '101') : (lead.invoice_number || '101');
    const seqNumPadded = String(seqNum).padStart(4, '0');
    const invoiceNum = `BR-${year}-${month}-${seqNumPadded}`;

    doc.text(`Nº: ${invoiceNum}`, 145, 30);
    doc.text(`FECHA: ${new Date(date).toLocaleDateString()}`, 145, 36);

    // --- RECEPTOR ---
    doc.line(20, 50, 190, 50);
    doc.setFontSize(9);
    doc.setTextColor(...gray);
    doc.text("DATOS DEL CLIENTE", 20, 60);
    doc.text("REF. INTERNA", 145, 60);

    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.text(profile?.full_name || lead.full_name || "Cliente BoxRoomer", 20, 70);
    doc.setFontSize(9);
    doc.text(`DNI/CIF: ${profile?.dni_cif || lead.dni_cif || "Pendiente"}`, 20, 76);
    doc.text(`Email: ${lead.email}`, 20, 82);

    doc.setTextColor(...gray);
    doc.text(`#SRV-${recordId.substring(0, 8).toUpperCase()}`, 145, 70);
    doc.setTextColor(0);

    // --- DETALLE ---
    doc.setFillColor(248, 250, 252);
    doc.rect(20, 95, 170, 12, "F");
    doc.setFont("helvetica", "bold");
    doc.text("DESCRIPCIÓN", 25, 103);
    doc.text("TOTAL", 170, 103, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.text(description, 25, 115);
    doc.text(`${amount.toFixed(2)}€`, 170, 115, { align: "right" });

    // --- TOTALES ---
    const base = amount / 1.21;
    const iva = amount - base;

    doc.line(110, 130, 190, 130);
    doc.setFontSize(10);
    doc.text("Base Imponible:", 110, 140);
    doc.text(`${base.toFixed(2)}€`, 185, 140, { align: "right" });

    doc.text("IVA (21%):", 110, 146);
    doc.text(`${iva.toFixed(2)}€`, 185, 146, { align: "right" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("TOTAL FACTURA:", 110, 158);
    doc.text(`${amount.toFixed(2)}€`, 185, 158, { align: "right" });

    // --- FOOTER ---
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(...gray);
    doc.text("Ceiba Business, S.L. - Calle de la Logística 1, Pinto, Madrid.", 105, 270, { align: "center" });
    doc.text("Documento generado automáticamente por BoxBot IA. Firmado digitalmente.", 105, 275, { align: "center" });

    // Download
    doc.save(`Factura_BoxRoomer_${invoiceNum}.pdf`);
    window.showBoxBotToast('✅ Factura generada y descargada.');
}
