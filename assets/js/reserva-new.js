// Supabase Client is accessed via window.supabaseClient (set in supabase-client.js)

let selectedStep = 1;
let selectMode = 'packs'; // 'packs' or 'manual'
let selectedVolume = 0;
let selectedPack = null;
let selectedDuration = null; // 3, 6, or 12
let sliderDebounce = null; // Timer key for chat suppression
let mozoExtraCost = 35; // Coste dinámico del mozo extra
let isPaid = false; // Flag to lock wizard after payment
let lastCpChecked = null; // Prevent repeated CP feedback messages
let pendingLead = null; // Stores consolidation data if exists
let isConsolidationActive = false; // Flag to track if consolidation benefits apply

// Pricing Constants (Synced with calculator.js)
const PRICES = {
    PACK_MINI: { 3: 139, 6: 199, 12: 319 },
    PACK_DUO: { 3: 199, 6: 309, 12: 529 },
    BASE_M1: 39,
    ADDITIONAL_M2: 16
};

// ZONA 0 Allowlist (Transport Included)
// Includes Madrid Capital (280XX - implicit logic in isZona0) and:
// Pinto, Valdemoro, Getafe, Leganés, Fuenlabrada, Parla, San Martín de la Vega, Ciempozuelos,
// Alcorcón, Móstoles, Pozuelo, Majadahonda, Boadilla, Las Rozas, Coslada, San Fernando, Rivas, Alcobendas, Sanse
const ZONA_0_PREFIXES = [
    '28320', '2834', '2890', '2891', '2894', '2898', '28330', '28350', '2899', // South
    '2892', '2893', '2822', '28660', '2823', // West/Southwest
    '2882', '2883', '2852', // East
    '2810', '2870' // North
];

function isZona0(cp) {
    if (!cp) return false;
    if (cp.startsWith('280')) return true; // Madrid Capital
    return ZONA_0_PREFIXES.some(prefix => cp.startsWith(prefix)); // Metropolitan Belt
}

document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log("🏁 [Reserva] DOM Loaded. Initializing...");

        // Late binding of supabase client
        if (!window.supabaseClient) console.warn("⚠️ [Reserva] window.supabaseClient is null/undefined at start.");

        initStep1();

        // Initialize address autocomplete immediately on page load
        setTimeout(() => {
            initAutocomplete();
        }, 500);

        // Check if we just returned from OAuth
        checkOAuthCallback();
    } catch (e) {
        console.error("🔥 [Reserva] CRITICAL INIT ERROR:", e);
    }
});

function initStep1() {
    console.log("🚀 [initStep1] Starting initialization...");
    const range = document.getElementById('reserva-range');
    const manualInput = document.getElementById('manual-m3-input');

    if (range) {
        // Remove previous listeners to avoid duplicates if re-run (good practice)
        const newRange = range.cloneNode(true);
        range.parentNode.replaceChild(newRange, range);

        newRange.addEventListener('input', (e) => {
            console.log("🎚️ [Slider Input] Value:", e.target.value);
            updateM3(parseFloat(e.target.value));
            // Interaction implies manual override? 
            // If user drags slider > 2, auto switch manual happens inside updateM3? Or should we trigger here?
            // Let's keep logic simple. visual sync happens in updateM3.
        });
    }

    if (manualInput) {
        manualInput.addEventListener('change', applyManualM3);
        manualInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') applyManualM3();
        });
    }

    // Check URL parameters for pre-selection (Robust Parsing)
    const urlParams = new URLSearchParams(window.location.search);
    const packParam = urlParams.get('pack'); // 'mini' | 'duo'
    const volParam = urlParams.get('vol');
    const monthsParam = urlParams.get('months');

    console.log("🔍 [URL Params] Pack:", packParam, "Vol:", volParam, "Months:", monthsParam);

    let targetVol = 1.5; // Default fallback
    let mode = 'packs';  // Default fallback

    if (packParam === 'mini') {
        targetVol = 1.0;
        mode = 'packs';
    } else if (packParam === 'duo') {
        targetVol = 2.0;
        mode = 'packs';
    } else if (volParam) {
        targetVol = parseFloat(volParam);
        if (isNaN(targetVol)) targetVol = 1.5;

        // Logic: >2 => Manual. <=2 => Packs (unless explicitly manual? lets infer form volume)
        // If it comes from calculator, we want to respect the visual context.
        // Calculator allows precise inputs.
        if (targetVol > 2.0) {
            mode = 'manual';
        } else {
            // For small volumes from calculator, sticking to Packs view is usually cleaner 
            // as it highlights the "Pack" offer.
            // UNLESS it's a non-standard volume like 1.5. 
            // Pack Mini is 1.0, Duo is 2.0. But 1.5 also fits efficiently into Duo logic visual.
            if (targetVol <= 2.0) {
                mode = 'packs';
            } else {
                mode = 'manual';
            }
        }
    } else {
        // No params: Default state -> FORCE PACK DUO (2.0)
        targetVol = 2.0;
        mode = 'packs';
    }

    console.log("🎯 [Init Logic] TargetVol:", targetVol, "Mode:", mode);

    // Sequence: Update Logic -> Update Visuals
    // 1. Force the Update (Logic & Slider)
    updateM3(targetVol, true); // Silent init

    // 2. Force the Duration
    const duration = monthsParam ? parseInt(monthsParam) : (selectedDuration || 3);
    setDuration(duration, true); // Silent init

    // 3. Force the Visual Mode (Tab Visibility)
    setTimeout(() => {
        setSelectMode(mode, true); // Silent init
        console.log("✅ [initStep1] Initialization Complete. Mode set to:", mode);
    }, 50);

    // Load saved address from "profile" if exists
    loadSavedAddress();

    // Consolidation Check
    checkPendingPickup().then((hasPending) => {
        setTimeout(() => {
            if (hasPending && pendingLead) {
                isConsolidationActive = true;
                const dateStr = new Date(pendingLead.pickup_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
                addAiMessage(`¡Hola de nuevo! Veo que ya tenemos una recogida pendiente para el **${dateStr}**. ✨ ¡Qué alegría que necesites más espacio! Como todavía no hemos hecho el viaje, podemos **consolidarlo todo en el mismo trayecto**. 🚛 Solo te cobraremos la diferencia de m³ y te ahorrarás cualquier gestión logística extra. ¡Es la ventaja de ser ya cliente! 😊`);

                // Pre-fill Plan Duration from pending lead
                if (pendingLead.duration_months || pendingLead.plan_months) {
                    setDuration(pendingLead.duration_months || pendingLead.plan_months, true);
                }

                // Pre-fill logistics to match pending lead
                if (pendingLead.pickup_address) localStorage.setItem('boxroomer_address', pendingLead.pickup_address);
                if (pendingLead.pickup_cp) localStorage.setItem('boxroomer_cp', pendingLead.pickup_cp);
                if (pendingLead.pickup_city) localStorage.setItem('boxroomer_city', pendingLead.pickup_city);

                // Pre-fill Access & Cargo types if exist in lead
                if (pendingLead.access_type) setAccessType(pendingLead.access_type, true);
                if (pendingLead.heavy_load !== undefined) setLoadType(pendingLead.heavy_load ? 'heavy' : 'standard', true);

                selectedDate = pendingLead.pickup_date;
                selectedSlot = pendingLead.pickup_slot;
            } else {
                addAiMessage("¡Hola! ¡Bienvenido a **BOXROOMER**! 👋 Soy **BoxBot**, tu asistente inteligente. Estamos en el **Paso 1: Configura tu Espacio**. Estoy aquí para ir dándote consejos e información de lo que vas seleccionando para que tu reserva sea perfecta. ¿Qué tienes pensado guardar hoy? ✨");
            }
        }, 800);
    });
}

async function checkPendingPickup() {
    if (!window.supabaseClient) return false;

    try {
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        if (!session) return false;

        // Search for a lead associated with the user that hasn't been picked up yet
        const { data, error } = await window.supabaseClient
            .from('leads_wizard')
            .select('*')
            .eq('email', session.user.email)
            .in('status', ['pending_call', 'confirmed'])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) throw error;

        if (data) {
            pendingLead = data;
            console.log("📦 [Reserva] Recogida pendiente detectada para consolidación:", pendingLead);
            return true;
        }
    } catch (e) {
        console.error("Error checking pending pickup:", e);
    }
    return false;
}

function loadSavedAddress() {
    const savedAddr = localStorage.getItem('boxroomer_address');
    const savedCP = localStorage.getItem('boxroomer_cp');
    const savedCity = localStorage.getItem('boxroomer_city');

    if (savedAddr) {
        const addrInput = document.getElementById('pickup-address');
        const cpInput = document.getElementById('pickup-cp');
        const cityInput = document.getElementById('pickup-city');

        if (addrInput) addrInput.value = savedAddr;
        if (cpInput) cpInput.value = savedCP || '';
        if (cityInput) cityInput.value = savedCity || '';

        // Add change detection for consolidation
        [addrInput, cpInput, cityInput].forEach(el => {
            if (el) {
                el.addEventListener('change', () => {
                    if (isConsolidationActive && pendingLead) {
                        const isChanged = (addrInput.value !== pendingLead.pickup_address) ||
                            (cpInput.value !== pendingLead.pickup_cp) ||
                            (cityInput.value !== pendingLead.pickup_city);

                        if (isChanged) {
                            breakConsolidation("dirección de recogida");
                        }
                    }
                });
            }
        });
    }
}

function breakConsolidation(reason) {
    if (!isConsolidationActive) return;
    isConsolidationActive = false;
    addAiMessage(`⚠️ **Atención**: Al cambiar la ${reason}, no podremos unificar este pedido con tu recogida pendiente. Se gestionará como una **nueva reserva independiente** con sus costes logísticos estándar. 🚛`);

    // Refresh Step 2 to unlock calendar if we are there
    if (selectedStep === 2) initStep2();
    updateSummary();
}

// Photon Autocomplete (Free OpenStreetMap Alternative)
let autocompleteTimeout = null;
let selectedSuggestionIndex = -1;

function initAutocomplete() {
    const input = document.getElementById('pickup-address');
    if (!input) return;

    // Prevent duplicate initialization
    if (window.autocompleteInitialized) return;
    window.autocompleteInitialized = true;

    // Create dropdown container attached to body (to avoid z-index issues)
    let dropdown = document.getElementById('photon-dropdown');
    if (!dropdown) {
        dropdown = document.createElement('div');
        dropdown.id = 'photon-dropdown';
        dropdown.className = 'photon-autocomplete-dropdown';
        document.body.appendChild(dropdown); // Append to body instead of input parent
    }

    // Function to position dropdown below input
    function positionDropdown() {
        const rect = input.getBoundingClientRect();
        dropdown.style.position = 'fixed'; // Use fixed to escape all parent containers
        dropdown.style.top = `${rect.bottom + 8}px`;
        dropdown.style.left = `${rect.left}px`;
        dropdown.style.width = `${rect.width}px`;
    }

    // Listen to input changes
    input.addEventListener('input', (e) => {
        const query = e.target.value.trim();

        // Clear previous timeout
        if (autocompleteTimeout) clearTimeout(autocompleteTimeout);

        // Hide dropdown if query is too short
        if (query.length < 3) {
            dropdown.style.display = 'none';
            return;
        }

        // Position dropdown before showing
        positionDropdown();

        // Debounce API calls
        autocompleteTimeout = setTimeout(() => {
            fetchAddressSuggestions(query, dropdown);
        }, 300);
    });

    // Reposition on scroll or resize to keep it attached to input
    window.addEventListener('scroll', () => {
        if (dropdown.style.display === 'block') positionDropdown();
    }, true);

    window.addEventListener('resize', () => {
        if (dropdown.style.display === 'block') positionDropdown();
    });

    // Handle keyboard navigation
    input.addEventListener('keydown', (e) => {
        const items = dropdown.querySelectorAll('.photon-suggestion-item');

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedSuggestionIndex = Math.min(selectedSuggestionIndex + 1, items.length - 1);
            updateSelectedSuggestion(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedSuggestionIndex = Math.max(selectedSuggestionIndex - 1, -1);
            updateSelectedSuggestion(items);
        } else if (e.key === 'Enter' && selectedSuggestionIndex >= 0) {
            e.preventDefault();
            items[selectedSuggestionIndex].click();
        } else if (e.key === 'Escape') {
            dropdown.style.display = 'none';
        }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });
}

function fetchAddressSuggestions(query, dropdown) {
    // Nominatim API (Official OpenStreetMap) - Free and stable
    // Bias results towards Spain and Madrid area
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5&countrycodes=es&viewbox=-3.9,40.2,-3.5,40.6&bounded=1`;

    fetch(url, {
        headers: {
            'User-Agent': 'BOXROOMER/1.0'
        }
    })
        .then(response => response.json())
        .then(data => {
            // Nominatim returns array directly, not wrapped in features
            displaySuggestions(data, dropdown);
        })
        .catch(error => {
            console.warn('Error fetching address suggestions:', error);
            dropdown.style.display = 'none';
        });
}

function displaySuggestions(results, dropdown) {
    dropdown.innerHTML = '';
    selectedSuggestionIndex = -1;

    if (!results || results.length === 0) {
        dropdown.style.display = 'none';
        return;
    }

    results.forEach((result, index) => {
        const addr = result.address || {};
        const item = document.createElement('div');
        item.className = 'photon-suggestion-item';

        // Build address string (Nominatim format)
        let addressStr = '';
        if (addr.road) addressStr += addr.road;
        if (addr.house_number) addressStr += ' ' + addr.house_number;
        if (!addressStr && result.display_name) {
            // Use first part of display_name
            addressStr = result.display_name.split(',')[0];
        }

        let locationStr = '';
        if (addr.postcode) locationStr += addr.postcode;
        if (addr.city || addr.town || addr.village) {
            const city = addr.city || addr.town || addr.village;
            locationStr += (locationStr ? ', ' : '') + city;
        }

        item.innerHTML = `
            <div class="photon-address">${addressStr || 'Dirección'}</div>
            <div class="photon-location">${locationStr}</div>
        `;

        item.addEventListener('click', () => {
            selectAddress(result);
            dropdown.style.display = 'none';
        });

        dropdown.appendChild(item);
    });

    dropdown.style.display = 'block';
}

function updateSelectedSuggestion(items) {
    items.forEach((item, index) => {
        if (index === selectedSuggestionIndex) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    });
}

function selectAddress(result) {
    const addr = result.address || {};
    const input = document.getElementById('pickup-address');
    const cpInput = document.getElementById('pickup-cp');
    const cityInput = document.getElementById('pickup-city');

    // Build full address (Nominatim format)
    let address = '';
    if (addr.road) address += addr.road;
    if (addr.house_number) address += ' ' + addr.house_number;
    if (!address && result.display_name) {
        address = result.display_name.split(',')[0];
    }

    if (input) input.value = address.trim();
    if (cpInput && addr.postcode) cpInput.value = addr.postcode;

    const city = addr.city || addr.town || addr.village || '';
    if (cityInput && city) cityInput.value = city;

    // Trigger CP feedback
    const postCode = addr.postcode || '';
    if (postCode && postCode !== lastCpChecked) {
        lastCpChecked = postCode;
        setTimeout(() => {
            if (isZona0(postCode)) {
                addAiMessage("📍 ¡Perfecto! Detecto que estás en **Zona 0 (Cobertura Gratuita)**. El transporte está totalmente incluido en tu tarifa. ✅");
            } else if (postCode.startsWith('28')) {
                addAiMessage("🚛 Veo que estás en **Zona 1 (Comunidad de Madrid)**. Ten en cuenta que se aplicará un coste por kilometraje (ida y vuelta) desde nuestra base central.");
            } else {
                addAiMessage("🌍 Veo que estás un poco más lejos de nuestra zona habitual. Analizaremos la ruta y te confirmaremos el presupuesto de transporte en la llamada de coordinación.");
            }
        }, 600);
    }

    // Trigger validations
    validateStep2();
    saveAddress();

    addAiMessage("📍 ¡Genial! He autocompletado tu dirección. Revisa que el **CP** y la **Ciudad** sean correctos.");
}

function saveAddress() {
    const addr = document.getElementById('pickup-address')?.value;
    const cp = document.getElementById('pickup-cp')?.value;
    const city = document.getElementById('pickup-city')?.value;

    if (addr) localStorage.setItem('boxroomer_address', addr);
    if (cp) localStorage.setItem('boxroomer_cp', cp);
    if (city) localStorage.setItem('boxroomer_city', city);
}

function resetSelections() {
    // Clear pack selections UI
    document.querySelectorAll('[id^="pack-card-"]').forEach(el => {
        el.classList.remove('selected', 'border-brandPurple', 'shadow-xl', 'ring-2', 'ring-brandPurple/20');
    });

    // Default mode UI
    setSelectMode('packs');

    // Duration buttons neutral
    const durationButtons = ['duration-btn-3', 'duration-btn-6', 'duration-btn-12'];
    durationButtons.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.classList.remove('bg-white', 'text-brandPurple', 'shadow-sm');
            btn.classList.add('text-slate-400');
        }
    });
}

let deliveryMode = 'pickup';
let selectedLoadType = null;
let selectedAccessType = null;
let boxCount = 0;
let customerType = 'individual'; // 'individual' or 'company'

function setCustomerType(type) {
    customerType = type;
    const btnInd = document.getElementById('type-individual');
    const btnComp = document.getElementById('type-company');
    const labelName = document.getElementById('label-name');
    const inputName = document.getElementById('auth-name');
    const labelId = document.getElementById('label-id');
    const inputId = document.getElementById('auth-id');

    if (type === 'individual') {
        btnInd.classList.add('bg-brandPurple', 'text-white', 'shadow-sm');
        btnInd.classList.remove('text-slate-400', 'hover:bg-slate-100');
        btnComp.classList.remove('bg-brandPurple', 'text-white', 'shadow-sm');
        btnComp.classList.add('text-slate-400', 'hover:bg-slate-100');

        if (labelName) labelName.innerText = "Nombre Completo";
        if (inputName) inputName.placeholder = "Ej. Ana García";
        if (labelId) labelId.innerText = "DNI / NIE";
        if (inputId) inputId.placeholder = "Ej. 12345678X";
    } else {
        btnComp.classList.add('bg-brandPurple', 'text-white', 'shadow-sm');
        btnComp.classList.remove('text-slate-400', 'hover:bg-slate-100');
        btnInd.classList.remove('bg-brandPurple', 'text-white', 'shadow-sm');
        btnInd.classList.add('text-slate-400', 'hover:bg-slate-100');

        if (labelName) labelName.innerText = "Razón Social";
        if (inputName) inputName.placeholder = "Ej. Boxroomer Solutions SL";
        if (labelId) labelId.innerText = "CIF de Empresa";
        if (inputId) inputId.placeholder = "Ej. B-00000000";
    }
}

function setDeliveryMode(mode) {
    if (isConsolidationActive && mode === 'dropoff') {
        addAiMessage("💡 Para la consolidación de tu reserva, es necesario mantener el servicio de **Recogida**, para que podamos llevar todo en el mismo viaje y ahorrarte costes.");
        return;
    }
    deliveryMode = mode;
    const pill = document.getElementById('pill-delivery');
    const btnPickup = document.getElementById('mode-pickup');
    const btnDropoff = document.getElementById('mode-dropoff');

    const title = document.getElementById('step2-title');
    const subtitle = document.getElementById('step2-subtitle');

    [btnPickup, btnDropoff].forEach(btn => btn.classList.remove('active', 'selected-pill'));

    if (mode === 'pickup') {
        if (pill) pill.style.transform = 'translateY(-50%) translateX(0)';
        btnPickup.classList.add('active', 'selected-pill');

        document.getElementById('address-section').classList.remove('hidden');
        document.getElementById('access-section').classList.remove('hidden');

        toggleLogisticsSections(true);

        if (title) title.innerHTML = 'Detalles de <span class="text-brandPurple underline decoration-brandPurple/20">Recogida</span>';
        if (subtitle) subtitle.innerText = 'Dinos dónde y cuándo pasamos a por tus pertenencias de forma GRATUITA.';
    } else {
        if (pill) pill.style.transform = `translateY(-50%) translateX(${btnPickup.offsetWidth}px)`;
        btnDropoff.classList.add('active', 'selected-pill');

        document.getElementById('address-section').classList.add('hidden');
        document.getElementById('access-section').classList.add('hidden');

        // Hide all extra services
        toggleLogisticsSections(false);

        if (title) title.innerHTML = 'Entrega en <span class="text-brandPurple underline decoration-brandPurple/20">Almacén</span>';
        if (subtitle) subtitle.innerText = 'Indícanos cuándo vendrás a nuestras instalaciones en Pinto (Madrid).';

        addAiMessage("¡Perfecto! Te esperamos en nuestro centro logístico de **Pinto**. Recuerda que esta modalidad no incluye servicios adicionales de mozos o embalaje. 🏠");
    }
    validateStep2();
}

function toggleLogisticsSections(visible) {
    const sections = [
        'logistics-checklist',   // Detalles de acceso (checklist)
        'extras-section',        // Servicios adicionales (incluye el título)
        'load-section',          // Tipo de carga (mozos)
        'access-section'         // Accesos (selectores rápidos)
    ];

    const action = visible ? 'remove' : 'add';
    sections.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList[action]('hidden');
    });
}

function setLoadType(type, silent = false) {
    selectedLoadType = type;
    const pill = document.getElementById('pill-load');
    const btnStd = document.getElementById('load-standard');
    const btnHeavy = document.getElementById('load-heavy');

    // Update Extra Mozo Label dynamic price
    if (btnHeavy) {
        const label = btnHeavy.querySelector('span.text-brandPurple');
        if (label) label.innerText = `+ Mozo extra (${mozoExtraCost}€)`;
    }

    if (pill) {
        pill.classList.remove('hidden');
        if (type === 'standard') {
            pill.style.transform = 'translateY(-50%) translateX(0)';
        } else {
            const offset = btnStd ? btnStd.offsetWidth : 120;
            pill.style.transform = `translateY(-50%) translateX(${offset}px)`;
        }
    }

    [btnStd, btnHeavy].forEach(btn => {
        if (btn) btn.classList.remove('active', 'selected-pill');
    });

    const selected = (type === 'standard') ? btnStd : btnHeavy;
    if (selected) selected.classList.add('active', 'selected-pill');

    if (type === 'heavy' && !silent) {
        addAiMessage("¡Anotado! 🦾 Al tener muebles grandes o electrodomésticos, enviaré a un **segundo operario** (coste único de 35€) para asegurar que todo se mueve con total seguridad.");
    }

    validateStep2();
}

function setAccessType(type, silent = false) {
    selectedAccessType = type;
    const pill = document.getElementById('pill-access');
    const btnStreet = document.getElementById('access-street');
    const btnElevator = document.getElementById('access-elevator');
    const btnStairs = document.getElementById('access-stairs');

    if (pill) {
        pill.classList.remove('hidden');
        const offsetStreet = btnStreet ? btnStreet.offsetWidth : 100;
        const offsetElevator = btnElevator ? btnElevator.offsetWidth : 100;

        if (type === 'street') {
            pill.style.transform = 'translateY(-50%) translateX(0)';
        } else if (type === 'elevator') {
            pill.style.transform = `translateY(-50%) translateX(${offsetStreet}px)`;
        } else {
            pill.style.transform = `translateY(-50%) translateX(${offsetStreet + offsetElevator}px)`;
        }
    }

    [btnStreet, btnElevator, btnStairs].forEach(btn => {
        if (btn) btn.classList.remove('active', 'selected-pill');
    });

    const selected = document.getElementById(`access-${type}`);
    if (selected) {
        selected.classList.add('active', 'selected-pill');
    }

    if (type === 'street' && !silent) {
        addAiMessage("¡Excelente! A pie de calle es la forma más rápida y económica de realizar la recogida. ⚡");
    }

    validateStep2();
}

function updateBoxCount(delta) {
    boxCount = Math.max(0, boxCount + delta);
    const display = document.getElementById('box-count-display');
    if (display) display.innerText = boxCount;

    if (boxCount > 0 && delta > 0 && boxCount % 10 === 0) {
        addAiMessage(`¡Oído cocina! Con **${boxCount} cajas** sueles cubrir una habitación pequeña o mediana. Recuerda que las **llevaremos directamente en el camión** el día de la recogida. 🚛`);
    } else if (boxCount === 1 && delta > 0) {
        addAiMessage("Perfecto, anotamos las cajas. Te las daremos en mano el día de la recogida para empezar a cargar al instante. 📦");
    }
}


let currentStep = 1;
let selectedDate = null;
let selectedSlot = null; // 'morning' or 'afternoon'

// Madrid Public Holidays 2025/2026
const MADRID_HOLIDAYS = [
    '2025-01-01', '2025-01-06', '2025-04-17', '2025-04-18', '2025-05-01', '2025-02-05',
    '2025-05-15', '2025-07-25', '2025-08-15', '2025-11-01', '2025-11-09', '2025-11-10',
    '2025-12-06', '2025-12-08', '2025-12-25',
    '2026-01-01', '2026-01-06', '2026-03-19', '2026-04-02', '2026-04-03', '2026-05-01',
    '2026-05-02', '2026-05-15', '2026-08-15', '2026-10-12', '2026-11-01', '2026-11-09',
    '2026-12-06', '2026-12-08', '2026-12-25'
];
function goToStep(step) {
    if (isPaid) return; // Point: Block navigation after payment
    if (step < 1 || step > 3) return;

    // AI Scan Transition Effect
    const scanOverlay = document.getElementById('ai-scan-overlay');
    if (scanOverlay) {
        scanOverlay.classList.add('active');
        setTimeout(() => scanOverlay.classList.remove('active'), 800);
    }

    // Point 2: Security check - Only forward
    if (step > currentStep) {
        if (currentStep === 1 && !validateStep1(true)) return;
        if (currentStep === 2 && !validateStep2(true)) return;
    }

    // Recommendation 1: Scan Effect when moving to Step 2
    if (step === 2 && currentStep === 1) {
        addAiMessage("Dando permiso a mis sensores... 🛰️ Analizando volumen para optimizar la ruta de recogida...");

        // Show a temporary scanning indicator/message
        const rightPanel = document.getElementById('reserva-messages');
        const scanDiv = document.createElement('div');
        scanDiv.id = 'scan-overlay';
        scanDiv.className = 'absolute inset-0 bg-brandPurple/5 backdrop-blur-[2px] z-50 flex items-center justify-center animate-pulse';
        scanDiv.innerHTML = '<div class="bg-white p-4 rounded-3xl shadow-2xl border border-brandPurple/20 flex flex-col items-center gap-2"><span class="material-symbols-outlined text-brandPurple animate-spin">sync</span><span class="text-[10px] font-black text-brandPurple tracking-widest">SCANNING LOGISTICS...</span></div>';

        if (rightPanel) {
            rightPanel.parentElement.appendChild(scanDiv);
        }

        setTimeout(() => {
            if (scanDiv) scanDiv.remove();
            setDeliveryMode('pickup'); // Force initialization
            executeStepTransition(step);
        }, 1500);
    } else {
        executeStepTransition(step);
    }
}

function executeStepTransition(step) {
    // Update UI Step content with cascade reset
    document.querySelectorAll('.step-content').forEach(el => {
        el.classList.add('hidden');
        el.classList.remove('reveal', 'active');
    });

    const nextStep = document.getElementById(`wizard-step-${step}`);
    if (nextStep) {
        nextStep.classList.remove('hidden');
        setTimeout(() => {
            nextStep.classList.add('reveal', 'active');
            // Re-trigger staggered items
            nextStep.querySelectorAll('.staggered-item').forEach((item) => {
                item.style.animation = 'none';
                item.offsetHeight; // trigger reflow
                item.style.animation = null;
            });
        }, 10);
    }

    updateStepper(step);
    currentStep = step;

    // Special init for Step 2 or 3
    if (step === 2) {
        initStep2();
    } else if (step === 3) {
        updateSummary();
        checkAuthForStep3();
    }

    // Trigger AI message based on step
    triggerAiStepComment(step);
}

function updateStepper(step) {
    for (let i = 1; i <= 3; i++) {
        const circle = document.getElementById(`step-circle-${i}`);
        if (!circle) continue;
        const label = circle.nextElementSibling;

        if (i <= step) {
            circle.classList.remove('bg-slate-100', 'text-slate-400');
            circle.classList.add('bg-brandPurple', 'text-white', 'shadow-lg');
            if (label) {
                label.classList.remove('text-slate-400');
                label.classList.add('text-brandPurple');
            }
        } else {
            circle.classList.add('bg-slate-100', 'text-slate-400');
            circle.classList.remove('bg-brandPurple', 'text-white', 'shadow-lg');
            if (label) {
                label.classList.add('text-slate-400');
                label.classList.remove('text-brandPurple');
            }
        }
    }
}

function validateStep1(showAlert = false) {
    const isValid = selectedVolume > 0 && selectedDuration !== null;
    const continueBtn = document.getElementById('continue-btn-step-1');

    if (continueBtn) {
        if (isValid) {
            continueBtn.disabled = false;
            continueBtn.classList.remove('opacity-50', 'grayscale', 'cursor-not-allowed');
        } else {
            continueBtn.disabled = true;
            continueBtn.classList.add('opacity-50', 'grayscale', 'cursor-not-allowed');
        }
    }

    if (showAlert && !isValid) {
        addAiMessage("¡Oye! ✋ Antes de continuar, necesitamos que selecciones un **Plan de Duración** y el **Volumen** de tu trastero para poder calcularlo todo correctamente.");
    }

    return isValid;
}

function toggleExtra(id) {
    const checkbox = document.getElementById(id);
    const card = document.getElementById(`card-extra-${id.split('-')[1]}`);

    if (checkbox && card) {
        checkbox.checked = !checkbox.checked;

        if (checkbox.checked) {
            card.classList.add('border-brandPurple', 'bg-brandPurple/5', 'shadow-md', 'scale-[1.01]');
            card.classList.remove('border-slate-50', 'bg-white');
            card.querySelector('.material-symbols-outlined').classList.add('text-brandPurple');
            card.querySelector('.material-symbols-outlined').classList.remove('text-slate-400');

            // Point 4: Warning for packing/assembly extra time
            if (id === 'extra-packing' || id === 'extra-assembly') {
                addAiMessage("💡 Ten en cuenta que incluimos **15 min de cortesía**. El tiempo extra que supere este margen se facturará a **15€ por cada bloque de 15 min** por operario. ¡Mis chicos son rápidos, no te preocupes!");
            }
        } else {
            card.classList.remove('border-brandPurple', 'bg-brandPurple/5', 'shadow-md', 'scale-[1.01]');
            card.classList.add('border-slate-50', 'bg-white');
            card.querySelector('.material-symbols-outlined').classList.remove('text-brandPurple');
            card.querySelector('.material-symbols-outlined').classList.add('text-slate-400');
        }
    }

    validateStep2();
}

function validateStep2(showAlert = false) {
    const addr = document.getElementById('pickup-address')?.value;
    const cp = document.getElementById('pickup-cp')?.value;
    const city = document.getElementById('pickup-city')?.value;
    const btn = document.getElementById('btn-to-step-3');

    // Trigger CP feedback for manual entry
    if (cp && cp.length >= 4 && cp !== lastCpChecked) {
        lastCpChecked = cp;
        setTimeout(() => {
            if (isZona0(cp)) {
                addAiMessage("📍 ¡Genial! Cobertura **Zona 0 (Transporte Gratis)** confirmada. ✅");
            } else if (cp.startsWith('28')) {
                addAiMessage("🚛 Detecto **Zona 1 (Comunidad de Madrid)**. Recuerda que para esta zona se cobra un precio por km (ida y vuelta) desde base. ¡Te lo detallaremos al confirmar!");
            } else {
                addAiMessage("🌍 Veo un CP fuera de zona habitual. Lo revisaremos contigo personalmente para darte la mejor opción logística. 📞");
            }
        }, 800);
    }

    // Section 5: Date & Slot are ALWAYS mandatory
    let isValid = selectedDate !== null && selectedSlot !== null;

    // For Pickup mode, sections 2, 3 and 4 are also mandatory
    if (deliveryMode === 'pickup') {
        isValid = isValid &&
            selectedLoadType !== null &&    // Section 4
            selectedAccessType !== null &&  // Section 3
            (addr && addr.length > 5) &&    // Section 2 (Address)
            (cp && cp.length >= 5) &&
            (city && city.length > 2);
    }

    if (btn) {
        btn.disabled = !isValid;
        if (isValid) {
            btn.classList.remove('opacity-30', 'grayscale');
        } else {
            btn.classList.add('opacity-30', 'grayscale');
        }
    }

    if (showAlert && !isValid) {
        addAiMessage("¡Espera! ✋ Para continuar, necesitamos que completes todos los detalles de la logística (dirección, tipo de carga, acceso y fecha/hora). Recuerda que operamos de **lunes a viernes de 9:00h a 18:00h**.");
    }

    if (isValid) {
        if (window._logisticsReady !== true) {
            if (isConsolidationActive) {
                addAiMessage("¡Consolidación preparada! ✅ He unificado la fecha y dirección con tu recogida pendiente. Pulsa en **'Ir al Resumen'**.");
            } else {
                addAiMessage("¡Logística validada! ✅ He comprobado que todo es correcto. Pulsa en **'Ir al Resumen'** para revisar el desglose final y asegurar tu espacio.");
            }
            window._logisticsReady = true;
        }
    } else {
        window._logisticsReady = false;
    }
    return isValid;
}

function initStep2(manualDateStr = null) {
    const calendarGrid = document.getElementById('calendar-grid');
    if (!calendarGrid) return;

    calendarGrid.innerHTML = '';
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const monthsArr = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    // Recommendation 2: Logistical Cutoff (16:00h)
    const now = new Date();
    let daysIterated = (now.getHours() >= 16) ? 2 : 1;

    let addedDays = 0;

    if (isConsolidationActive && pendingLead) {
        // If consolidating, we force the pending lead's date and disable others visually
        setDeliveryMode('pickup');
        selectedDate = pendingLead.pickup_date;
        selectedSlot = pendingLead.pickup_slot;

        // Add an AI message explaining the lock
        setTimeout(() => {
            addAiMessage("📍 **Logística Unificada**: He fijado la dirección y el horario para coincidir con tu recogida programada. ¡Así lo gestionamos todo juntos! 🚛");
        }, 500);
    }

    // First 5 standard slots
    while (addedDays < 5) {
        const date = new Date();
        date.setDate(date.getDate() + daysIterated);

        const dateStr = date.toISOString().split('T')[0];

        // Skip Saturdays (6), Sundays (0) and Holidays
        if (date.getDay() === 0 || date.getDay() === 6 || MADRID_HOLIDAYS.includes(dateStr)) {
            daysIterated++;
            continue;
        }

        renderCalendarDay(calendarGrid, date, days, monthsArr, dateStr);
        addedDays++;
        daysIterated++;
    }

    // 6th Slot: Intelligent persistence
    // If we have a selectedDate that is NOT one of the 5 standard ones, it becomes the 6th slot.
    // Otherwise, we find the next available standard slot.

    let isSelectedStandard = false;
    const standardDates = [];
    const tempDate = new Date();
    let tempIter = 1;
    while (standardDates.length < 5) {
        const d = new Date();
        d.setDate(d.getDate() + tempIter);
        const dStr = d.toISOString().split('T')[0];
        if (d.getDay() !== 0 && d.getDay() !== 6 && !MADRID_HOLIDAYS.includes(dStr)) {
            standardDates.push(dStr);
        }
        tempIter++;
    }

    if (selectedDate && !standardDates.includes(selectedDate)) {
        // The selected date is "custom/manual", keep it in the 6th slot
        const date = new Date(selectedDate);
        renderCalendarDay(calendarGrid, date, days, monthsArr, selectedDate);
    } else {
        // Use the next available standard day for the 6th slot
        let found = false;
        while (!found) {
            const date = new Date();
            date.setDate(date.getDate() + daysIterated);
            const dateStr = date.toISOString().split('T')[0];
            if (date.getDay() !== 0 && date.getDay() !== 6 && !MADRID_HOLIDAYS.includes(dateStr)) {
                renderCalendarDay(calendarGrid, date, days, monthsArr, dateStr);
                found = true;
            }
            daysIterated++;
        }
    }

    // 7th Slot: "Otro Día" Button
    const otherDateEl = document.createElement('div');
    otherDateEl.className = 'other-date-btn';

    if (isConsolidationActive) {
        otherDateEl.style.opacity = '0.3';
        otherDateEl.style.cursor = 'not-allowed';
        otherDateEl.onclick = null;
    } else {
        otherDateEl.onclick = (e) => {
            const input = otherDateEl.querySelector('input');
            if (input) {
                if (typeof input.showPicker === 'function') {
                    input.showPicker();
                } else {
                    input.click();
                }
            }
        };
    }

    otherDateEl.innerHTML = `
        <div class="flex flex-col items-center justify-center gap-1">
            <span class="material-symbols-outlined text-slate-300">calendar_month</span>
            <span class="text-[10px] font-black uppercase text-slate-400 group-hover:text-brandPurple text-center leading-none">Otro día</span>
        </div>
        <input type="date" id="hidden-date-picker" onchange="handleManualDate(this)">
    `;
    calendarGrid.appendChild(otherDateEl);

    loadSavedAddress();
    validateStep2();
    checkUserAddresses();

    // Reset saved selection if manual input starts
    ['pickup-address', 'pickup-cp', 'pickup-city'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('focus', () => {
                // Clear highlights
                document.querySelectorAll('.saved-addr-item').forEach(card => {
                    card.classList.remove('border-brandPurple', 'bg-brandPurple/5', 'ring-1', 'ring-brandPurple/20');
                    card.querySelector('.status-icon').classList.remove('text-brandPurple');
                });

                // Show save toggle if logged in
                window.supabaseClient?.auth.getSession().then(({ data }) => {
                    if (data.session) {
                        const saveToggle = document.getElementById('save-to-profile-container');
                        if (saveToggle) saveToggle.classList.remove('hidden');
                    }
                });
            });
        }
    });
}

async function checkUserAddresses() {
    if (!window.supabaseClient) return;

    const { data: { session } } = await window.supabaseClient.auth.getSession();
    const container = document.getElementById('saved-addresses-container');
    const list = document.getElementById('saved-addresses-list');

    if (session) {
        // Show "Save to profile" toggle container if logged in
        const saveToggle = document.getElementById('save-to-profile-container');
        if (saveToggle) saveToggle.classList.remove('hidden');

        if (session.user.user_metadata?.saved_addresses) {
            const addresses = session.user.user_metadata.saved_addresses;
            if (addresses.length > 0) {
                container.classList.remove('hidden');
                renderSavedAddresses(addresses, list);
            }
        }
    } else {
        if (container) container.classList.add('hidden');
    }
}

function renderSavedAddresses(addresses, list) {
    if (!list) return;

    const currentAddr = document.getElementById('pickup-address')?.value || '';
    const currentCP = document.getElementById('pickup-cp')?.value || '';

    list.innerHTML = addresses.map((addr, idx) => {
        // Auto-detect match
        const isMatch = (addr.street === currentAddr && addr.cp === currentCP);
        const highlightClasses = isMatch ? 'border-brandPurple bg-brandPurple/5 ring-1 ring-brandPurple/20' : 'border-slate-100 bg-white';
        const iconClasses = isMatch ? 'text-brandPurple' : 'text-slate-200';

        return `
            <div id="saved-addr-item-${idx}" onclick="applySavedAddress(${idx})" class="saved-addr-item group cursor-pointer p-3 rounded-2xl border flex items-center justify-between transition-all ${highlightClasses}">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 group-hover:text-brandPurple group-hover:bg-brandPurple/10 transition-colors">
                        <span class="material-symbols-outlined text-base">location_on</span>
                    </div>
                    <div class="flex-grow">
                        <h4 class="text-[10px] font-black uppercase text-brandDark italic leading-none">${addr.name || 'Dirección'}</h4>
                        <p class="text-[9px] text-slate-400 font-bold mt-1">${addr.street}, ${addr.cp}</p>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <button onclick="event.stopPropagation(); deleteSavedAddress(${idx})" class="w-7 h-7 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all">
                        <span class="material-symbols-outlined text-base">delete</span>
                    </button>
                    <span class="status-icon material-symbols-outlined group-hover:text-brandPurple transition-colors text-lg ${iconClasses}">check_circle</span>
                </div>
            </div>
        `;
    }).join('');

    // Guardamos las direcciones en window para acceder por índice
    window._cachedUserAddresses = addresses;
}

window.applySavedAddress = function (index) {
    const addr = window._cachedUserAddresses ? window._cachedUserAddresses[index] : null;
    if (!addr) return;

    const input = document.getElementById('pickup-address');
    const cpInput = document.getElementById('pickup-cp');
    const cityInput = document.getElementById('pickup-city');

    if (input) input.value = addr.street;
    if (cpInput) cpInput.value = addr.cp;
    if (cityInput) cityInput.value = addr.city;

    // UI Highlight selection
    document.querySelectorAll('.saved-addr-item').forEach(el => {
        el.classList.remove('border-brandPurple', 'bg-brandPurple/5', 'ring-1', 'ring-brandPurple/20');
        el.querySelector('.status-icon').classList.remove('text-brandPurple');
    });

    const selected = document.getElementById(`saved-addr-item-${index}`);
    if (selected) {
        selected.classList.add('border-brandPurple', 'bg-brandPurple/5', 'ring-1', 'ring-brandPurple/20');
        selected.querySelector('.status-icon').classList.add('text-brandPurple');
    }

    // Hide "save to profile" toggle and alias container as this one is already saved
    const saveToggle = document.getElementById('save-to-profile-container');
    const aliasContainer = document.getElementById('address-alias-container');
    const saveCheck = document.getElementById('save-address-check');

    if (saveToggle) saveToggle.classList.add('hidden');
    if (aliasContainer) aliasContainer.classList.add('hidden');
    if (saveCheck) saveCheck.checked = false;

    // Feedback visual
    addAiMessage(`🏠 ¡Perfecto! He aplicado tu dirección: **${addr.name}**. Revisa si los datos son correctos para esta recogida.`);

    // Consolidation break check
    if (isConsolidationActive && pendingLead) {
        const isChanged = (addr.street !== pendingLead.pickup_address) || (addr.cp !== pendingLead.pickup_cp);
        if (isChanged) {
            breakConsolidation("dirección de recogida (desde perfil)");
        }
    }

    validateStep2();
    saveAddress();
};

async function deleteSavedAddress(index) {
    if (!window.supabaseClient) return;
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    if (!session) return;

    const addresses = session.user.user_metadata.saved_addresses || [];
    const addrName = addresses[index]?.name || 'Dirección';

    // Confirm delete using our NEW pretty modal
    const confirmed = await showConfirm(
        'Eliminar Dirección',
        `¿Estás seguro de que quieres eliminar "${addrName}" de tu perfil? Esta acción es permanente.`
    );

    if (!confirmed) return;

    addresses.splice(index, 1);

    const { error } = await window.supabaseClient.auth.updateUser({
        data: { saved_addresses: addresses }
    });

    if (!error) {
        addAiMessage("🗑️ Dirección eliminada correctamente de tu perfil.");
        checkUserAddresses(); // Refresh list
    } else {
        console.error("Error deleting address:", error);
    }
}

window.toggleAliasField = function () {
    const check = document.getElementById('save-address-check');
    const container = document.getElementById('address-alias-container');
    const input = document.getElementById('address-alias');

    if (check && container) {
        if (check.checked) {
            container.classList.remove('hidden');
            // Auto-generate alias if empty or default
            if (input && (!input.value || input.value.startsWith('Recogida '))) {
                const now = new Date();
                const dateStr = now.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
                input.value = `Recogida ${dateStr}`;
            }
        } else {
            container.classList.add('hidden');
        }
    }
};

function renderCalendarDay(container, date, days, months, dateStr) {
    const dayName = days[date.getDay()];
    const dayNum = date.getDate();
    const monthName = months[date.getMonth()];

    const dayEl = document.createElement('div');
    dayEl.id = `date-${dateStr}`;
    dayEl.className = 'flex flex-col items-center justify-center p-3 rounded-2xl border-2 border-slate-50 bg-slate-50 transition-all group';

    // If consolidating, disable click on other dates
    if (isConsolidationActive) {
        dayEl.style.opacity = (selectedDate === dateStr) ? '1' : '0.3';
        dayEl.style.cursor = (selectedDate === dateStr) ? 'default' : 'not-allowed';
        if (selectedDate === dateStr) {
            dayEl.classList.remove('border-slate-50', 'bg-slate-50');
            dayEl.classList.add('border-brandPurple', 'bg-white', 'shadow-md', 'scale-105', 'z-10');
        }
    } else {
        dayEl.onclick = () => selectDate(dateStr);
        dayEl.classList.add('cursor-pointer', 'hover:border-brandPurple/30');
        if (selectedDate === dateStr) {
            dayEl.classList.remove('border-slate-50', 'bg-slate-50');
            dayEl.classList.add('border-brandPurple', 'bg-white', 'shadow-md', 'scale-105', 'z-10');
        }
    }

    dayEl.innerHTML = `
        <span class="text-[10px] font-black uppercase text-slate-400 group-hover:text-brandPurple mb-1">${dayName}</span>
        <span class="text-sm font-black text-brandDark group-hover:text-brandPurple">${dayNum}</span>
        <span class="text-[9px] font-bold text-slate-400 uppercase">${monthName}</span>
    `;
    container.appendChild(dayEl);
}

function handleManualDate(input) {
    if (!input.value) return;

    const date = new Date(input.value);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dateStr = input.value; // YYYY-MM-DD

    // Rule 1: Not Today, Not Past
    if (date <= today) {
        addAiMessage("⚠️ No es posible seleccionar el día de hoy ni fechas pasadas. Selecciona una fecha a partir de mañana.");
        input.value = '';
        return;
    }

    // Rule 2: Not Weekends
    const day = date.getDay();
    if (day === 0 || day === 6) {
        addAiMessage("🏫 Lo sentimos, **no realizamos operaciones los fines de semana**. Por favor, selecciona un día de lunes a viernes.");
        input.value = '';
        return;
    }

    // Rule 3: Not Madrid Holidays
    if (MADRID_HOLIDAYS.includes(dateStr)) {
        addAiMessage("📅 El día seleccionado es **festivo en Madrid**. Por favor, elige otra fecha de servicio.");
        input.value = '';
        return;
    }

    // Check if the date is already visible in the grid (Top 5 or previous manual)
    const existingElement = document.getElementById(`date-${dateStr}`);
    if (existingElement) {
        selectedDate = dateStr;
        selectDate(dateStr);
        addAiMessage(`¡Perfecto! Hemos seleccionado el **${date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}** que ya tenías disponible.`);
        return;
    }

    // Success: Update the whole grid to show this day in the 6th position only if it's NEW
    selectedDate = dateStr;
    initStep2(dateStr);

    addAiMessage(`¡Perfecto! Hemos anotado el **${date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}**.`);
}

function selectDate(dateStr, isManual = false) {
    selectedDate = dateStr;

    // UI Update for grid - Use direct child selector (>) to avoid styling inner divs of .other-date-btn
    document.querySelectorAll('#calendar-grid > div:not(.other-date-btn)').forEach(el => {
        el.classList.remove('border-brandPurple', 'bg-white', 'shadow-md', 'scale-105', 'z-10');
        el.classList.add('border-slate-50', 'bg-slate-50');
    });

    if (!isManual) {
        const selectedEl = document.getElementById(`date-${dateStr}`);
        if (selectedEl) {
            selectedEl.classList.remove('border-slate-50', 'bg-slate-50');
            selectedEl.classList.add('border-brandPurple', 'bg-white', 'shadow-md', 'scale-105', 'z-10');
        }
    } else {
        // Confirmation for manual date
        addAiMessage(`¡Perfecto! Hemos anotado el **${new Date(dateStr).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}**.`);
    }

    validateStep2();
}


function setTimeSlot(slot) {
    if (isConsolidationActive && pendingLead && slot !== pendingLead.pickup_slot) {
        addAiMessage("⏳ El horario ha sido unificado con tu recogida pendiente para que el equipo logístico pueda realizar toda la carga en una sola parada.");
        return;
    }
    selectedSlot = slot;
    const pill = document.getElementById('pill-timeslot');
    const btnMorning = document.getElementById('slot-morning');
    const btnAfternoon = document.getElementById('slot-afternoon');

    if (pill) {
        pill.classList.remove('hidden');
        if (slot === 'morning') {
            pill.style.transform = 'translateY(-50%) translateX(0)';
        } else {
            pill.style.transform = `translateY(-50%) translateX(${btnMorning.offsetWidth}px)`;
        }
    }

    [btnMorning, btnAfternoon].forEach(btn => {
        btn.classList.remove('active', 'selected-pill');
    });

    const selected = (slot === 'morning') ? btnMorning : btnAfternoon;
    selected.classList.add('active', 'selected-pill');

    // BoxBot feedback for Time Slots
    if (slot === 'morning') {
        addAiMessage("¡Oído cocina! El turno de mañana (9:00 - 13:00) es ideal para que tus cosas queden instaladas antes de comer. ☀️");
    } else {
        addAiMessage("Perfecto, turno de tarde (13:00 - 18:00). Recogeremos todo con calma para terminar el día con tu espacio ya liberado. 🌙");
    }

    validateStep2();
}

function triggerAiStepComment(step) {
    const comments = {
        1: "¡Perfecto! Ya tienes configurado tu espacio. Recuerda que siempre puedes volver atrás si necesitas recalcular algo. ✨",
        2: "¡Genial! Pasamos a la logística. 🚛 No te preocupes por la dirección, la dejaremos **guardada en tu perfil** para que no tengas que volver a escribirla. ¡Servicio llave en mano! 🔑",
        3: "Ya casi estamos. He preparado el contrato digital y bloqueado tu fecha en el calendario operativo. Tus cosas estarán vigiladas **24/7 con seguridad avanzada**. 🛡️ **Nota importante:** Tras completar el pago, mi equipo humano se pondrá en contacto contigo por **WhatsApp o teléfono** para confirmar la hora exacta y cualquier detalle de la recogida. ¡Tranquilidad total! ✅"
    };

    if (comments[step]) {
        setTimeout(() => {
            addAiMessage(comments[step]);
        }, 600);
    }
}

function setSelectMode(mode, silent = false) {
    selectMode = mode;
    const pill = document.getElementById('pill-mode');
    const btnPacks = document.getElementById('mode-btn-packs');
    const btnManual = document.getElementById('mode-btn-manual');

    [btnPacks, btnManual].forEach(btn => btn.classList.remove('active', 'selected-pill'));

    if (mode === 'packs') {
        if (pill) pill.style.transform = 'translateY(-50%) translateX(0)';
        btnPacks.classList.add('active', 'selected-pill');

        document.getElementById('view-packs').classList.remove('hidden');
        document.getElementById('view-manual').classList.add('hidden');
    } else {
        if (pill) pill.style.transform = `translateY(-50%) translateX(${btnPacks.offsetWidth}px)`;
        btnManual.classList.add('active', 'selected-pill');

        document.getElementById('view-packs').classList.add('hidden');
        document.getElementById('view-manual').classList.remove('hidden');
    }

    // 2. Sync Logic
    updateSummary();
    validateStep1(); // Ensure validation is run after mode change

    if (mode === 'manual') {
        // Force Sync: Use current selected volume or default to 1.0
        let targetVol = 1.0;
        if (selectedVolume && selectedVolume > 0) {
            targetVol = selectedVolume;
        }

        // Call updateM3 to set slider, text, badge, and prices
        updateM3(targetVol, silent);

        if (!silent) {
            setTimeout(() => {
                const tip = targetVol <= 2 ?
                    "Has entrado en **Manual** manteniendo tu Pack. 📏 Así puedes ver que el volumen y precio coinciden. Si necesitas ajustar, mueve el slider." :
                    "Has activado el **Recuento Manual**. 📏 **TIP:** Aquí puedes ajustar al milímetro tu espacio.";
                addAiMessage(tip);
            }, 600);
        }
    } else {
        if (!silent) {
            setTimeout(() => {
                addAiMessage("Has vuelto a los **Planes Recomendados**. 📦 Estos packs son la forma más fácil de acertar. ¿Cuál crees que te encaja mejor?");
            }, 600);
        }
    }
}

function setDuration(months, silent = false) {
    if (isConsolidationActive && !silent && pendingLead) {
        const prevMonths = pendingLead.duration_months || pendingLead.plan_months;
        if (months !== prevMonths) {
            breakConsolidation("duración del plan");
        }
    }
    selectedDuration = months;
    const pill = document.getElementById('pill-duration');
    const btn3 = document.getElementById('duration-btn-3');
    const btn6 = document.getElementById('duration-btn-6');
    const btn12 = document.getElementById('duration-btn-12');
    const buttons = { 3: btn3, 6: btn6, 12: btn12 };

    // 1. Move the Pill (3 positions)
    if (pill) {
        if (months === 3) pill.style.transform = 'translateY(-50%) translateX(0)';
        else if (months === 6) pill.style.transform = `translateY(-50%) translateX(${btn3.offsetWidth}px)`;
        else if (months === 12) pill.style.transform = `translateY(-50%) translateX(${btn3.offsetWidth + btn6.offsetWidth}px)`;
    }

    // 2. Update Typography & Contrast
    Object.keys(buttons).forEach(key => {
        const btn = buttons[key];
        if (!btn) return;

        if (parseInt(key) === months) {
            btn.classList.add('active', 'selected-pill');
        } else {
            btn.classList.remove('active', 'selected-pill');
        }
    });

    validateStep1();
    updatePrices();

    // Contextual Benefits based on volume/pack
    let contextMsg = "";
    if (selectedPack || (selectedVolume > 0 && selectedVolume <= 2.0)) {
        contextMsg = "👌 Además, mantienes **Recogida y Entrega GRATIS** 🚛 y todo el equipamiento incluido.";
    } else {
        contextMsg = "🛡️ Tu reserva incluye **Seguro Multiriesgo** y gestión digital de inventario.";
    }

    // Chatbot Messages with REAL promotions + Context
    if (!silent) {
        if (months === 3) {
            setTimeout(() => {
                addAiMessage(`Has elegido el **Plan 3 Meses**. 📅 Flexibilidad total para corto plazo. ${contextMsg}`);
            }, 500);
        } else if (months === 6) {
            setTimeout(() => {
                addAiMessage(`¡Excelente! Con el **Plan 6 Meses** tienes **+1 MES GRATIS** 🎁. ${contextMsg}`);
            }, 500);
        } else if (months === 12) {
            setTimeout(() => {
                addAiMessage(`¡Máximo ahorro! El **Plan 12 Meses** te regala **+3 MESES GRATIS** 🚀. ${contextMsg}`);
            }, 500);
        }
    }
}

function selectPack(id, silent = false) {
    selectedPack = id;
    selectedVolume = (id === 1) ? 1.0 : 2.0;

    // Visual cards - Simply toggle 'selected' class and let CSS do the magic
    document.querySelectorAll('.magnetic-card').forEach(el => el.classList.remove('selected'));
    const activeCard = document.getElementById(`pack-card-${id === 1 ? 'mini' : 'duo'}`);
    if (activeCard) {
        activeCard.classList.add('selected');
    }

    // Update range slider too just in case they switch
    const range = document.getElementById('reserva-range');
    if (range) range.value = selectedVolume;

    updateSummary();
    validateStep1();
    // Ensure prices are shown immediately
    updatePrices();

    // BoxBot specific advice for packs (Reinforce inclusions)
    if (!silent) {
        if (id === 1) {
            setTimeout(() => {
                addAiMessage("Has seleccionado el **Pack Mini (1m³)**. 📦 Es un servicio **Todo Incluido**. Olvídate de cargar: Incluye **Recogida y Transporte GRATIS** 🚚, operarios y Seguro a Todo Riesgo.");
            }, 600);
        } else if (id === 2) {
            setTimeout(() => {
                addAiMessage("¡Pack Dúo (2m³)! 📦 Doble espacio con servicio **Llave en Mano**. Incluye **Transporte GRATIS** 🚛, carga por profesionales y Seguro incluido. ¡Tu tranquilidad total!");
            }, 600);
        }
    }
}

function updateM3(val, silent = false) {
    // 1. Magnetic Snap Logic (Assist user in hitting exact pack values)
    // Only apply logic if we are CLOSE, don't force unrelated values.
    if (val >= 0.8 && val <= 1.2) val = 1.0;
    else if (val >= 1.8 && val <= 2.2) val = 2.0;

    // Round to nearest .5
    val = Math.round(val * 2) / 2;

    const prevVolume = selectedVolume;
    selectedVolume = val;

    console.log("📏 [updateM3] New Value:", val);

    // Update Slider Visualization (Cap at 15)
    const range = document.getElementById('reserva-range');
    if (range) {
        // Only update if different to avoid cursor jumping if dragging
        if (parseFloat(range.value) !== val) {
            range.value = Math.min(val, 15);
        }
    }

    // Update Counter Display
    const display = document.getElementById('m3-val');
    if (display) display.innerText = val.toString().replace('.', ',');

    // Manual Badge Logic (Ranges)
    const badge = document.getElementById('manual-pack-badge');
    if (badge) {
        if (val <= 1.0) {
            badge.innerText = 'Pack Mini';
            badge.classList.remove('hidden');
        } else if (val <= 2.0) {
            badge.innerText = 'Pack Dúo';
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }

    // Match Pack logic (Ranges) - FLEXIBLE COMPARISON FOR DUO
    if (val <= 1.0) { // Up to 1.0 is Mini
        selectedPack = 1;
        highlightPackCard(1);
    } else if (val <= 2.0) { // Between 1.0 and 2.0 takes Duo logic visually
        selectedPack = 2;
        highlightPackCard(2);
    } else {
        selectedPack = null;
        highlightPackCard(null);
    }

    updateSummary();
    validateStep1();
    updatePrices();

    // AI Comment for manual volume (Debounced)
    if (!silent) {
        clearTimeout(sliderDebounce);
        sliderDebounce = setTimeout(() => {
            if (val <= 1.0) {
                addAiMessage("¡Coincidencia exacta! 🎯 Con **1m³** tienes el **Pack Mini**. Es un servicio **Todo Incluido** con **Recogida y Transporte GRATIS** 🚚. ¡Lo justo y necesario!");
            } else if (val <= 2.0) {
                addAiMessage("¡Estás en el **Pack Dúo**! ✌️ Tienes hasta **2m³** de espacio. con servicio **Llave en Mano**. Incluye **Transporte GRATIS** 🚛 y Seguro a Todo Riesgo.");
            } else if (val <= 3) {
                addAiMessage(`Veo que has seleccionado **${val}m³**. 🤏 Es un espacio ideal para guardar cajas sueltas, material deportivo o algún mueble pequeño.`);
            } else if (val <= 8) {
                addAiMessage(`Un tamaño de **${val}m³** ya es considerable. 🏠 Aquí te cabría el contenido de una habitación completa o un piso pequeño. ¡Buen cálculo!`);
            } else if (val > 8 && val <= 14) {
                addAiMessage(`¡**${val}m³** es un gran volumen! 🚚 Estamos hablando de una mudanza importante. Recuerda que nuestros equipos de transporte están especializados en grandes cargas.`);
            } else if (val > 14) {
                addAiMessage("¡Vaya! Esa es una cantidad considerable. 🏢 No te preocupes, nuestras naves de Pinto tienen capacidad de sobra y nuestros camiones están preparados para mudanzas de gran volumen.");
            }

            // Random Tip Reinforcement (30% chance on generic selections)
            if (val > 2.0 && Math.random() < 0.3) {
                setTimeout(() => {
                    addAiMessage("💡 **Recuerda:** Si al final ocupas menos de **" + val + "m³**, te devolveremos la diferencia. Y si necesitas más, solo recalculamos al mes siguiente. ¡Cero riesgos!");
                }, 2500);
            }
        }, 1500); // 1.5s wait after slider stops
    }
}

function highlightPackCard(id) {
    document.querySelectorAll('[id^="pack-card-"]').forEach(el => el.classList.remove('selected', 'border-brandPurple', 'shadow-xl', 'ring-2', 'ring-brandPurple/20'));
    if (id) {
        const cardId = id === 1 ? 'pack-card-mini' : 'pack-card-duo';
        const card = document.getElementById(cardId);
        if (card) card.classList.add('selected', 'border-brandPurple', 'shadow-xl', 'ring-2', 'ring-brandPurple/20');
    }
}

function applyManualM3() {
    const input = document.getElementById('manual-m3-input');
    let val = parseFloat(input.value);

    if (isNaN(val)) return;

    // Constraints: integers or .5
    val = Math.round(val * 2) / 2;
    if (val < 1.0) val = 1.0;

    // Delegate all UI and Logic updates to the main function
    updateM3(val);

    // Clear input after applying
    input.value = '';
}

function updatePrices() {
    // Safety check: Default to 3 months if somehow null to ensure UI always works
    if (!selectedDuration) selectedDuration = 3;

    // 1. Update Pack Prices
    const priceMini = PRICES.PACK_MINI[selectedDuration];
    const priceDuo = PRICES.PACK_DUO[selectedDuration];

    const displayMiniTotal = document.getElementById('pack-price-mini');
    const displayMiniMo = document.getElementById('pack-monthly-mini');
    const displayDuoTotal = document.getElementById('pack-price-duo');
    const displayDuoMo = document.getElementById('pack-monthly-duo');

    if (displayMiniMo) {
        displayMiniMo.innerText = `${Math.round(priceMini / selectedDuration)}€`;
        displayMiniMo.classList.remove('opacity-0');
    }
    if (displayMiniTotal) displayMiniTotal.innerText = `Total Pack: ${priceMini}€`;

    if (displayDuoMo) {
        displayDuoMo.innerText = `${Math.round(priceDuo / selectedDuration)}€`;
        displayDuoMo.classList.remove('opacity-0');
    }
    if (displayDuoTotal) displayDuoTotal.innerText = `Total Pack: ${priceDuo}€`;

    // 2. Update Manual Price
    // Ensure selectedVolume is a number and valid
    const vol = parseFloat(selectedVolume);

    if (!isNaN(vol) && vol > 0) {
        let totalPayable = 0;

        if (vol <= 1.0) {
            totalPayable = PRICES.PACK_MINI[selectedDuration];
        } else if (vol <= 2.0) {
            totalPayable = PRICES.PACK_DUO[selectedDuration];
        } else {
            // Generic Calculation (> 2m3)
            const base = PRICES.BASE_M1;
            const extra = PRICES.ADDITIONAL_M2;
            const monthlyBase = base + (vol - 1) * extra;

            // Calculate effective months to pay
            let monthsToPay = selectedDuration;
            if (selectedDuration === 6) monthsToPay = 5;      // 5 + 1 Free
            else if (selectedDuration === 12) monthsToPay = 9; // 9 + 3 Free

            totalPayable = monthlyBase * monthsToPay;
        }

        const manualContainer = document.getElementById('manual-price-container');
        const manualTotal = document.getElementById('manual-price-total');
        const manualMo = document.getElementById('manual-price-monthly');

        if (manualContainer) manualContainer.classList.remove('opacity-0');

        // Animate Price Changes
        const prevMonthly = parseFloat(manualMo?.innerText) || 0;
        const targetMonthly = Math.round(totalPayable / selectedDuration);

        if (manualMo && prevMonthly !== targetMonthly) {
            animateValue('manual-price-monthly', prevMonthly, targetMonthly, 400, true);
        }

        if (manualTotal) {
            manualTotal.innerText = `${Math.round(totalPayable)}€ TOTAL PACK`;
        }
    }
}

function updateSummary() {
    // 0. Recalculate current price (same logic as updatePrices)
    let totalPeriodPrice = 0;
    const vol = parseFloat(selectedVolume) || 1.0;
    const months = selectedDuration || 3;

    if (vol <= 1.0) {
        totalPeriodPrice = PRICES.PACK_MINI[months];
    } else if (vol <= 2.0) {
        totalPeriodPrice = PRICES.PACK_DUO[months];
    } else {
        const base = PRICES.BASE_M1;
        const extra = PRICES.ADDITIONAL_M2;
        const monthlyBase = base + (vol - 1) * extra;

        let monthsToPay = months;
        if (months === 6) monthsToPay = 5;
        else if (months === 12) monthsToPay = 9;

        totalPeriodPrice = monthlyBase * monthsToPay;
    }

    const monthlyRent = Math.round(totalPeriodPrice / months);

    // 1. Plan and Size
    const summarySize = document.getElementById('summary-size');
    const summaryPlan = document.getElementById('summary-plan');

    if (summarySize) summarySize.innerText = `${vol.toString().replace('.', ',')} m³`;

    if (summaryPlan) {
        if (selectedPack === 1) summaryPlan.innerText = `PACK MINI (${months} MESES)`;
        else if (selectedPack === 2) summaryPlan.innerText = `PACK DÚO (${months} MESES)`;
        else summaryPlan.innerText = `PLAN PERSONALIZADO (${months} MESES)`;
    }

    // 2. Logistics
    const summaryDatetime = document.getElementById('summary-datetime');
    const summaryMode = document.getElementById('summary-mode');
    const summaryAddress = document.getElementById('summary-address');

    if (summaryDatetime) {
        const slotText = selectedSlot === 'morning' ? 'Mañana (9:00 - 13:00)' : 'Tarde (13:00 - 18:00)';
        const dateFormatted = selectedDate ? new Date(selectedDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : 'Sin fecha';
        summaryDatetime.innerText = `${dateFormatted} | ${slotText}`;
    }

    if (summaryMode) {
        if (deliveryMode === 'pickup') {
            const extraText = (selectedPack) ? ' (Todo Incluido)' : '';
            summaryMode.innerText = `Recogida GRATIS${extraText}`;
        } else {
            summaryMode.innerText = 'Entrega en Almacén';
        }
    }

    if (summaryAddress) {
        const pintoLink = document.getElementById('pinto-map-link');
        const mozoBadge = document.getElementById('badge-mozo-extra');

        if (deliveryMode === 'pickup') {
            const addr = document.getElementById('pickup-address')?.value || '';
            const cp = document.getElementById('pickup-cp')?.value || '';
            const city = document.getElementById('pickup-city')?.value || '';

            let accessText = '';
            if (selectedAccessType === 'street') accessText = ' (Calle)';
            if (selectedAccessType === 'elevator') accessText = ' (Ascensor)';
            if (selectedAccessType === 'stairs') accessText = ' (Escaleras)';

            summaryAddress.innerText = addr ? `${addr}, ${cp} ${city}${accessText}` : 'Dirección pendiente';
            if (pintoLink) pintoLink.classList.add('hidden');

            // Show mozo badge if heavy load
            if (selectedLoadType === 'heavy' && mozoBadge) mozoBadge.classList.remove('hidden');
            else if (mozoBadge) mozoBadge.classList.add('hidden');
        } else {
            summaryAddress.innerText = "Instalaciones de Pinto, Madrid.";
            if (pintoLink) pintoLink.classList.remove('hidden');
            if (mozoBadge) mozoBadge.classList.add('hidden');
        }
    }

    // 3. Detailed Costs
    const costRent = document.getElementById('cost-rent');
    const costTotalMonthly = document.getElementById('cost-total-monthly');
    const costBoxes = document.getElementById('cost-boxes');
    const summaryBoxQty = document.getElementById('summary-box-qty');
    const sectionOneTime = document.getElementById('section-one-time');

    if (costRent) costRent.innerText = `${monthlyRent},00€`;
    if (costTotalMonthly) costTotalMonthly.innerText = `${monthlyRent},00€`;

    // 4. Consolidation Credits Logic
    let previousPlanCredit = 0;
    const rowCredits = document.getElementById('row-credits');
    const costCreditsDisplay = document.getElementById('cost-credits');

    if (isConsolidationActive && pendingLead && rowCredits && costCreditsDisplay) {
        // Calculate what they "already have" or "already paid" (simplified to the monthly value of their previous plan)
        const prevVol = parseFloat(pendingLead.volume_m3) || 1.0;
        const prevMonths = parseInt(pendingLead.plan_months) || 3;
        let prevTotalPeriodPrice = 0;

        if (prevVol <= 1.0) prevTotalPeriodPrice = PRICES.PACK_MINI[prevMonths];
        else if (prevVol <= 2.0) prevTotalPeriodPrice = PRICES.PACK_DUO[prevMonths];
        else {
            const base = PRICES.BASE_M1;
            const extra = PRICES.ADDITIONAL_M2;
            const monthlyBase = base + (prevVol - 1) * extra;
            let mToPay = prevMonths;
            if (prevMonths === 6) mToPay = 5;
            else if (prevMonths === 12) mToPay = 9;
            prevTotalPeriodPrice = monthlyBase * mToPay;
        }

        previousPlanCredit = Math.round(prevTotalPeriodPrice / prevMonths);

        rowCredits.classList.remove('hidden');
        costCreditsDisplay.innerText = `-${previousPlanCredit},00€`;
    } else if (rowCredits) {
        rowCredits.classList.add('hidden');
    }

    // 5. One-time costs (Boxes & Mozo)
    const rowBoxes = document.getElementById('row-boxes');
    const rowMozo = document.getElementById('row-mozo');
    const rowTotalExtra = document.getElementById('row-total-extra');
    const costTotalExtra = document.getElementById('cost-total-extra');
    const costGrandTotal = document.getElementById('cost-grand-total');

    let hasOneTime = false;
    let totalOneTime = 0;

    // Boxes Logic
    if (boxCount > 0) {
        if (rowBoxes) rowBoxes.classList.remove('hidden');
        if (summaryBoxQty) summaryBoxQty.innerText = boxCount;
        const totalBoxesCost = boxCount * 1.80;
        if (costBoxes) costBoxes.innerText = `${totalBoxesCost.toFixed(2)}€`;
        totalOneTime += totalBoxesCost;
        hasOneTime = true;
    } else {
        if (rowBoxes) rowBoxes.classList.add('hidden');
    }

    // Mozo Extra Logic
    if (deliveryMode === 'pickup' && selectedLoadType === 'heavy') {
        if (rowMozo) rowMozo.classList.remove('hidden');
        totalOneTime += mozoExtraCost;
        hasOneTime = true;

        // Actualizar etiqueta de precio en el resumen
        const costMozoEl = document.getElementById('cost-mozo');
        if (costMozoEl) costMozoEl.innerText = `${mozoExtraCost.toFixed(2)}€`;

    } else {
        if (rowMozo) rowMozo.classList.add('hidden');
    }

    // Subtotal Adicionales Logic
    if (hasOneTime) {
        if (rowTotalExtra) rowTotalExtra.classList.remove('hidden');
        if (costTotalExtra) costTotalExtra.innerText = `${totalOneTime.toFixed(2)}€`;
    } else {
        if (rowTotalExtra) rowTotalExtra.classList.add('hidden');
    }

    // Grand Total Logic (Today's Payment)
    const grandTotal = Math.max(0, monthlyRent - previousPlanCredit + totalOneTime);
    if (costGrandTotal) costGrandTotal.innerText = `${grandTotal.toFixed(2).replace('.', ',')}€`;

    // Show/Hide section
    if (sectionOneTime) {
        if (hasOneTime) sectionOneTime.classList.remove('hidden');
        else sectionOneTime.classList.add('hidden');
    }
}

async function confirmOrder() {
    const legalCheck = document.getElementById('legal-check');
    const authName = document.getElementById('auth-name');
    const authEmail = document.getElementById('auth-email');
    const authPass = document.getElementById('auth-pass');
    const authId = document.getElementById('auth-id');
    const authPhone = document.getElementById('auth-phone');

    // 1. Auth Validation (Enhanced with ID, Phone and Profile)
    let authError = false;
    const fields = [authName, authEmail, authPass, authId, authPhone];

    fields.forEach(f => {
        // Pass is optional if logged in (field hidden/empty), check visibility or session?
        // Actually, if we are logged in, authPass might be null or hidden.
        // Let's rely on standard validation. If session exists, we might skip pass check.
        const isHidden = f && (f.offsetParent === null);
        if (!isHidden && (!f || !f.value.trim())) {
            f?.classList.add('border-red-500');
            authError = true;
        } else {
            f?.classList.remove('border-red-500');
        }
    });

    // Check pass length only if visible
    if (authPass && authPass.offsetParent !== null && authPass.value.length < 8) {
        authPass.classList.add('border-red-500');
        authError = true;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(authEmail.value.trim())) {
        authEmail.classList.add('border-red-500');
        authError = true;
    }

    if (authError) {
        addAiMessage("⚠️ **Atención**: Necesito que completes todos tus datos contacta (incluyendo DNI, Teléfono y contraseña válida) para gestionar la logística.");
        authName.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }

    if (!legalCheck || !legalCheck.checked) {
        addAiMessage("⚠️ Para confirmar tu reserva, es necesario que firmes el contrato y aceptes la política de privacidad.");
        legalCheck.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }

    const btn = document.getElementById('confirm-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-outlined animate-spin">sync</span> Creando Cuenta y Procesando Pago...';

    // Collect all data for Supabase
    const leadData = {
        email: authEmail.value.trim(),
        full_name: authName.value.trim(),
        dni_cif: authId.value.trim(),
        phone: authPhone.value.trim(),
        customer_type: customerType, // 'individual' or 'company'
        volume_m3: selectedVolume,
        duration_months: selectedDuration,
        pack_type: selectedPack === 1 ? 'mini' : (selectedPack === 2 ? 'duo' : 'custom'),
        delivery_mode: deliveryMode,
        pickup_address: document.getElementById('pickup-address')?.value || '',
        pickup_cp: document.getElementById('pickup-cp')?.value || '',
        pickup_city: document.getElementById('pickup-city')?.value || '',
        pickup_date: selectedDate || null,
        pickup_slot: selectedSlot,
        extra_boxes: boxCount,
        extra_packing: document.getElementById('extra-packing')?.checked || false,
        extra_assembly: document.getElementById('extra-assembly')?.checked || false,
        heavy_load: selectedLoadType === 'heavy',
        access_type: selectedAccessType,
        total_monthly: parseFloat((document.getElementById('cost-total-monthly')?.innerText || '0').replace(/[^\d,.-]/g, '').replace(',', '.') || 0),
        total_initial: parseFloat((document.getElementById('cost-grand-total')?.innerText || '0').replace(/[^\d,.-]/g, '').replace(',', '.') || 0),
        is_consolidation: isConsolidationActive,
        consolidated_with: isConsolidationActive && pendingLead ? pendingLead.id : null,
        created_at: new Date().toISOString()
    };

    console.log("📤 [Supabase] Preparing to send lead data:", leadData);

    // Save to Supabase if available
    if (window.supabaseClient) {
        try {
            console.log("🛠️ [Reserva] Starting DB Transaction...");

            // Step A: Handle Auth
            let userId = null;
            const { data: { session } } = await window.supabaseClient.auth.getSession();

            if (session) {
                userId = session.user.id;
                console.log("👤 [Reserva] Existing user detected:", userId);

                // Update Metadata
                const saveNewAddressRequested = document.getElementById('save-address-check')?.checked;
                const aliasValue = document.getElementById('address-alias')?.value || "Recogida Inicial";

                let updatedAddresses = session.user.user_metadata?.saved_addresses || [];

                if (saveNewAddressRequested) {
                    const newAddr = {
                        id: Date.now(),
                        name: aliasValue,
                        street: leadData.pickup_address,
                        cp: leadData.pickup_cp,
                        city: leadData.pickup_city,
                        default: updatedAddresses.length === 0
                    };
                    updatedAddresses.push(newAddr);
                } else if (updatedAddresses.length === 0) {
                    // Fallback for first time if they didn't check but it's the only address
                    updatedAddresses = [{
                        id: Date.now(),
                        name: "Recogida Inicial",
                        street: leadData.pickup_address,
                        cp: leadData.pickup_cp,
                        city: leadData.pickup_city,
                        default: true
                    }];
                }

                await window.supabaseClient.auth.updateUser({
                    data: {
                        dni: leadData.dni_cif,
                        phone: leadData.phone,
                        full_name: leadData.full_name,
                        saved_addresses: updatedAddresses
                    }
                });
            } else {
                console.log("🆕 [Reserva] Creating new user profile...");
                const aliasValue = document.getElementById('address-alias')?.value || "Recogida Inicial";
                const initialAddress = {
                    id: Date.now(),
                    name: aliasValue,
                    street: leadData.pickup_address,
                    cp: leadData.pickup_cp,
                    city: leadData.pickup_city,
                    default: true
                };

                const { data: authData, error: authErr } = await window.supabaseClient.auth.signUp({
                    email: leadData.email,
                    password: authPass.value,
                    options: {
                        data: {
                            full_name: leadData.full_name,
                            dni: leadData.dni_cif,
                            phone: leadData.phone,
                            saved_addresses: [initialAddress]
                        }
                    }
                });

                if (authErr) throw authErr;
                userId = authData.user.id;
                console.log("✅ [Reserva] New user created ID:", userId);
            }

            // Step B: Save Lead in leads_wizard table
            leadData.user_id = userId;
            console.log("💾 [Reserva] Inserting lead data...", leadData);

            const { data: leadResult, error: leadErr } = await window.supabaseClient
                .from('leads_wizard')
                .insert([leadData])
                .select();

            if (leadErr) {
                console.error("❌ [Reserva] Lead Insert Error:", leadErr);
                throw leadErr;
            }

            console.log("🎉 [Reserva] Lead saved successfully:", leadResult);

            // Step C: Update Profile
            if (userId) {
                const profileUpdate = {
                    full_name: leadData.full_name,
                    dni_cif: leadData.dni_cif,
                    phone: leadData.phone
                };

                await window.supabaseClient
                    .from('profiles')
                    .update(profileUpdate)
                    .eq('id', userId);
            }

        } catch (err) {
            console.error("🔥 [Reserva] CRITICAL ERROR:", err);
            addAiMessage(`🛑 **Error crítico**: ${err.message || 'Error al guardar los datos'}. Por favor, revisa la consola para más detalles.`);
            btn.disabled = false;
            btn.innerHTML = 'Reintentar Pago <span class="material-symbols-outlined">refresh</span>';
            return;
        }
    } else {
        console.warn("⚠️ [Reserva] SupabaseClient not found. Simulated success.");
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Final UI Updates (Universal)
    isPaid = true;

    // Send Welcome Email (Premium)
    if (window.EmailService) {
        window.EmailService.send('new_reservation', leadData.email, {
            clientName: leadData.full_name,
            planType: leadData.pack_type,
            volume: leadData.volume_m3
        });
    }

    localStorage.setItem('BOXROOMER_DASHBOARD_DATA', JSON.stringify({
        userName: leadData.full_name.split(' ')[0],
        userEmail: leadData.email,
        status: 'pending_call',
        volume: leadData.volume_m3,
        plan: leadData.pack_type
    }));

    addAiMessage("¡PAGO CONFIRMADO! 💳🎉 Tu reserva ya está registrada en nuestro sistema de forma segura. Te redirijo a tu Área de Cliente...");

    btn.disabled = false;
    btn.innerHTML = 'Ir a mi Espacio <span class="material-symbols-outlined">arrow_forward</span>';
    btn.classList.replace('bg-brandDark', 'bg-green-600');

    setTimeout(() => {
        window.location.href = 'cliente_dashboard.html';
    }, 1500);
}

// --- SOCIAL LOGIN & OAUTH FLOW ---
async function loginWithSocial(provider) {
    if (!window.supabaseClient) {
        alert("El servicio de autenticación no está disponible en este momento.");
        return;
    }

    // 1. Save Current State to LocalStorage (Draft)
    saveReservationDraft();

    // 2. Trigger OAuth
    const { data, error } = await window.supabaseClient.auth.signInWithOAuth({
        provider: provider,
        options: {
            redirectTo: window.location.origin + window.location.pathname + '?oauth_complete=true'
        }
    });

    if (error) {
        console.error("❌ Social Auth Error:", error);
        alert("Error al conectar con " + provider);
    }
}

function saveReservationDraft() {
    const draft = {
        volume: selectedVolume,
        pack: selectedPack,
        duration: selectedDuration,
        deliveryMode: deliveryMode,
        pickup_address: document.getElementById('pickup-address')?.value,
        pickup_cp: document.getElementById('pickup-cp')?.value,
        pickup_city: document.getElementById('pickup-city')?.value,
        pickup_date: selectedDate,
        pickup_slot: selectedSlot,
        boxCount: boxCount,
        heavy_load: selectedLoadType === 'heavy',
        access_type: selectedAccessType,
        extras: {
            packing: document.getElementById('extra-packing')?.checked,
            assembly: document.getElementById('extra-assembly')?.checked
        }
    };
    localStorage.setItem('BOXROOMER_PENDING_RESERVA', JSON.stringify(draft));
}

async function checkOAuthCallback() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('oauth_complete') === 'true') {
            if (!window.supabaseClient) {
                console.error("❌ OAuth callback detected but Supabase client is missing.");
                return;
            }

            const { data: { session } } = await window.supabaseClient.auth.getSession();
            const draft = JSON.parse(localStorage.getItem('BOXROOMER_PENDING_RESERVA'));

            if (session && draft) {
                // Restore state
                const userName = session.user.user_metadata?.full_name || 'Viajero';
                addAiMessage(`¡Hola de nuevo, ${userName}! Estamos finalizando tu reserva automáticamente.`);

                const nameInput = document.getElementById('auth-name');
                const emailInput = document.getElementById('auth-email');

                if (nameInput) nameInput.value = userName;
                if (emailInput) emailInput.value = session.user.email || '';

                // Go to summary step immediately
                goToStep(3);

                // Clear URL params to avoid re-triggering
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        }
    } catch (err) {
        console.error("❌ Error in OAuth Callback:", err);
    }
}

// AI Copilot Messages Logic
function addAiMessage(text) {
    const container = document.getElementById('reserva-messages');
    if (!container) return;

    // Check if we should also show a toast (Mobile only)
    if (window.innerWidth < 1024) {
        showAiToast(text);
    }

    // 1. Create the thinking message (dots)
    const thinkingId = 'thinking-' + Date.now();
    const thinkingDiv = document.createElement('div');
    thinkingDiv.id = thinkingId;
    thinkingDiv.className = 'bot-msg-ai self-start max-w-[90%] mb-4 animate-fadeIn';
    thinkingDiv.innerHTML = `
        <div class="bg-white/5 backdrop-blur-md p-4 rounded-t-3xl rounded-br-3xl border border-white/10 shadow-xl">
            <div class="typing-indicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        </div>
    `;
    container.appendChild(thinkingDiv);
    container.scrollTop = container.scrollHeight;

    // 2. Wait and replace with real content
    setTimeout(() => {
        const thinkingEl = document.getElementById(thinkingId);
        if (!thinkingEl) return;

        // Enhanced Formatting Logic
        let formattedText = text
            .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white bg-white/10 px-2 py-0.5 rounded-lg border border-white/10 font-bold text-[12px] uppercase tracking-wider">$1</strong>') // Bold with softer glass highlight
            .replace(/\n/g, '<br>'); // Support line breaks

        thinkingEl.innerHTML = `
            <div class="bg-white/10 backdrop-blur-md p-5 rounded-t-3xl rounded-br-3xl border border-white/20 shadow-xl reveal active">
                <p class="text-white text-[13px] md:text-sm font-medium leading-relaxed">${formattedText}</p>
            </div>
        `;
        container.scrollTop = container.scrollHeight;
    }, 1200); // 1.2 seconds of "thinking"
}

function showAiToast(text) {
    const container = document.getElementById('ai-toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'ai-smart-toast';

    // Clean text from Markdown for the toast
    const cleanText = text.replace(/\*\*/g, '');

    toast.innerHTML = `
        <div class="w-8 h-8 rounded-full bg-brandPurple flex-shrink-0 flex items-center justify-center animate-glow">
            <span class="material-symbols-outlined text-white text-base">robot_2</span>
        </div>
        <div class="flex-grow">
            <p class="text-white text-[10px] font-bold leading-tight line-clamp-2">${cleanText}</p>
        </div>
        <button onclick="this.parentElement.remove()" class="text-white/40 hover:text-white">
            <span class="material-symbols-outlined text-sm">close</span>
        </button>
    `;

    container.appendChild(toast);

    // Auto remove after 10 seconds
    setTimeout(() => {
        toast.classList.add('hidden-toast');
        setTimeout(() => toast.remove(), 500);
    }, 10000); // Adjusted to 10s as requested
}

// Ensure first validation on load or whenever things change
document.addEventListener('DOMContentLoaded', () => {
    validateStep1();
});

/**
 * Animate a numeric value smoothly
 * @param {string} id - Element ID
 * @param {number} start - Start value
 * @param {number} end - End value
 * @param {number} duration - Animation duration in ms
 * @param {boolean} isEuro - Format as currency
 */
function animateValue(id, start, end, duration = 400, isEuro = false) {
    const obj = document.getElementById(id);
    if (!obj) return;

    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);

        // Easing function: outQuart
        const currentVal = start + (end - start) * (1 - Math.pow(1 - progress, 4));

        if (isEuro) {
            obj.innerText = Math.floor(currentVal) + '€';
        } else {
            // Format as m3 with comma
            obj.innerText = currentVal.toFixed(1).replace('.', ',');
        }

        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}
// --- AUTH CHECK FOR STEP 3 ---
async function checkAuthForStep3() {
    if (!window.supabaseClient) return;

    // Check if we have an active session
    const { data: { session } } = await window.supabaseClient.auth.getSession();

    if (session) {
        console.log("✅ Step 3: User logged in:", session.user.email);

        const nameInput = document.getElementById('auth-name');
        const emailInput = document.getElementById('auth-email');
        const dniInput = document.getElementById('auth-id');
        const phoneInput = document.getElementById('auth-phone');
        const passContainer = document.getElementById('auth-pass')?.closest('.group\\/input');
        const googleBtn = document.querySelector('button[onclick*="loginWithSocial"]');
        const loginLinkDiv = document.querySelector('a[href*="login.html"]')?.parentElement;

        const meta = session.user.user_metadata || {};

        // Pre-fill Name
        if (nameInput) {
            nameInput.value = meta.full_name || 'Usuario';
            nameInput.readOnly = true;
            nameInput.classList.add('bg-slate-100', 'text-slate-500');
        }
        // Pre-fill Email
        if (emailInput) {
            emailInput.value = session.user.email;
            emailInput.readOnly = true;
            emailInput.classList.add('bg-slate-100', 'text-slate-500');
        }
        // Pre-fill DNI (if exists)
        if (dniInput && meta.dni) {
            dniInput.value = meta.dni;
            dniInput.readOnly = true;
            dniInput.classList.add('bg-slate-100', 'text-slate-500');
        }
        // Pre-fill Phone (if exists)
        if (phoneInput && meta.phone) {
            phoneInput.value = meta.phone;
            phoneInput.readOnly = true;
            phoneInput.classList.add('bg-slate-100', 'text-slate-500');
        }

        // Hide Password Field
        if (passContainer) passContainer.style.display = 'none';

        // Hide Google Button
        if (googleBtn) googleBtn.style.display = 'none';

        // Hide "Already have account" link
        if (loginLinkDiv) loginLinkDiv.style.display = 'none';

        // Show Welcome Message if not already there
        const authContainer = document.getElementById('auth-section-container');
        // We assume a container ID or append to the parent of inputs
        if (emailInput && !document.getElementById('welcome-msg-auth')) {
            const msg = document.createElement('div');
            msg.id = 'welcome-msg-auth';
            msg.className = 'mb-4 bg-green-50 border border-green-100 rounded-xl p-3 flex items-center gap-3';
            msg.innerHTML = `
                <div class="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                    <span class="material-symbols-outlined text-sm">person_check</span>
                </div>
                <div>
                    <p class="text-[10px] uppercase font-black text-green-800 tracking-wide">Sesión Iniciada</p>
                    <p class="text-[11px] text-green-700">Cuenta de ${session.user.email}</p>
                </div>
             `;
            // Insert before the grid of inputs
            const grid = emailInput.closest('.grid');
            if (grid) grid.parentElement.insertBefore(msg, grid);
        }
    }
}
// --- REUSABLE CONFIRMATION MODAL ---
function showConfirm(title, message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirmModal');
        const titleEl = document.getElementById('confirmModalTitle');
        const msgEl = document.getElementById('confirmModalMessage');
        const cancelBtn = document.getElementById('confirmCancelBtn');
        const actionBtn = document.getElementById('confirmActionBtn');

        if (!modal) {
            // Fallback if modal HTML is missing for some reason
            resolve(confirm(message));
            return;
        }

        titleEl.innerText = title;
        msgEl.innerText = message;

        modal.classList.remove('hidden');
        modal.classList.add('flex');

        const handleCancel = () => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            cleanup();
            resolve(false);
        };

        const handleConfirm = () => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            cleanup();
            resolve(true);
        };

        const cleanup = () => {
            cancelBtn.removeEventListener('click', handleCancel);
            actionBtn.removeEventListener('click', handleConfirm);
        };

        cancelBtn.addEventListener('click', handleCancel);
        actionBtn.addEventListener('click', handleConfirm);
    });
}
