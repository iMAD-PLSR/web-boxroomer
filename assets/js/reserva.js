/**
 * BOXROOMER - Reserva Wizard Logic
 */

let selectedStep = 1;
let selectMode = 'packs'; // 'packs' or 'manual'
let selectedVolume = 0;
let selectedPack = null;
let selectedDuration = null; // 3, 6, or 12
let sliderDebounce = null; // Timer key for chat suppression
let isPaid = false; // Flag to lock wizard after payment
let lastCpChecked = null; // Prevent repeated CP feedback messages

// Pricing Constants (Synced with calculator.js)
const PRICES = {
    PACK_MINI: { 3: 139, 6: 199, 12: 319 },
    PACK_DUO: { 3: 199, 6: 309, 12: 529 },
    BASE_M1: 39,
    ADDITIONAL_M2: 16,
    EXTRA_MOVER: 35
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
    initStep1();
    // Initialize address autocomplete immediately on page load
    // This ensures it works even if the field has a saved value
    setTimeout(() => {
        initAutocomplete();
    }, 500);
});

function initStep1() {
    const range = document.getElementById('reserva-range');
    const manualInput = document.getElementById('manual-m3-input');

    if (range) {
        range.addEventListener('input', (e) => {
            updateM3(parseFloat(e.target.value));
        });
    }

    if (manualInput) {
        manualInput.addEventListener('change', applyManualM3);
        manualInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') applyManualM3();
        });
    }

    // Check URL parameters for pre-selection
    const urlParams = new URLSearchParams(window.location.search);
    const packParam = urlParams.get('pack');
    const durParam = urlParams.get('duration');
    const m3Param = urlParams.get('m3');

    if (packParam) {
        selectPack(parseInt(packParam));
    }
    if (durParam) {
        setDuration(parseInt(durParam));
    }
    if (m3Param) {
        setSelectMode('manual');
        updateM3(parseFloat(m3Param));
    }

    // If no pack or m3 selected, ensure UI is reset
    if (!selectedPack && !selectedVolume) {
        resetSelections();
    }

    // Default to 3 months if not set (ensures prices are visible)
    if (!selectedDuration) {
        setDuration(3);
    }

    // Load saved address from "profile" if exists
    loadSavedAddress();

    // Dynamic initial greeting with thinking effect
    setTimeout(() => {
        addAiMessage("¡Hola! ¡Bienvenido a **BOXROOMER**! 👋 Soy **BoxBot**, tu asistente inteligente. Estamos en el **Paso 1: Configura tu Espacio**. Estoy aquí para ir dándote consejos e información de lo que vas seleccionando para que tu reserva sea perfecta. ¿Qué tienes pensado guardar hoy? ✨");
    }, 800);
}

function loadSavedAddress() {
    const savedAddr = localStorage.getItem('boxroomer_address');
    const savedCP = localStorage.getItem('boxroomer_cp');
    const savedCity = localStorage.getItem('boxroomer_city');

    if (savedAddr) {
        // We'll fill them when we reach step 2 or if they exist in DOM
        const addrInput = document.getElementById('pickup-address');
        const cpInput = document.getElementById('pickup-cp');
        const cityInput = document.getElementById('pickup-city');

        if (addrInput) addrInput.value = savedAddr;
        if (cpInput) cpInput.value = savedCP || '';
        if (cityInput) cityInput.value = savedCity || '';
    }
}

// Photon Autocomplete (Free OpenStreetMap Alternative)
let autocompleteTimeout = null;
let selectedSuggestionIndex = -1;

function initAutocomplete() {
    const input = document.getElementById('pickup-address');
    if (!input) return;

    // Create dropdown container for suggestions
    let dropdown = document.getElementById('photon-dropdown');
    if (!dropdown) {
        dropdown = document.createElement('div');
        dropdown.id = 'photon-dropdown';
        dropdown.className = 'photon-autocomplete-dropdown';
        input.parentElement.appendChild(dropdown);
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

        // Debounce API calls
        autocompleteTimeout = setTimeout(() => {
            fetchAddressSuggestions(query, dropdown);
        }, 300);
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

function setDeliveryMode(mode) {
    deliveryMode = mode;
    const pill = document.getElementById('pill-delivery');
    const btnPickup = document.getElementById('mode-pickup');
    const btnDropoff = document.getElementById('mode-dropoff');

    const title = document.getElementById('step2-title');
    const subtitle = document.getElementById('step2-subtitle');

    if (mode === 'pickup') {
        if (pill) pill.style.transform = 'translateY(-50%) translateX(0)';
        btnPickup.classList.add('text-brandPurple');
        btnPickup.classList.remove('text-slate-400');
        btnDropoff.classList.add('text-slate-400');
        btnDropoff.classList.remove('text-brandPurple');

        document.getElementById('address-section').classList.remove('hidden');
        document.getElementById('access-section').classList.remove('hidden');

        // Restore boxes, packing and assembly cards invisibility
        toggleLogisticsSections(true);

        title.innerHTML = 'Detalles de <span class="text-brandPurple underline decoration-brandPurple/20">Recogida</span>';
        subtitle.innerText = 'Dinos dónde y cuándo pasamos a por tus pertenencias de forma GRATUITA.';
    } else {
        if (pill) pill.style.transform = `translateY(-50%) translateX(${btnPickup.offsetWidth}px)`;
        btnDropoff.classList.add('text-brandPurple');
        btnDropoff.classList.remove('text-slate-400');
        btnPickup.classList.add('text-slate-400');
        btnPickup.classList.remove('text-brandPurple');

        document.getElementById('address-section').classList.add('hidden');
        document.getElementById('access-section').classList.add('hidden');

        // Hide boxes, packing and assembly cards
        toggleLogisticsSections(false);

        title.innerHTML = 'Entrega en <span class="text-brandPurple underline decoration-brandPurple/20">Almacén</span>';
        subtitle.innerText = 'Indícanos cuándo vendrás a nuestras instalaciones en Pinto (Madrid).';
    }
    validateStep2();
}

function toggleLogisticsSections(visible) {
    const boxes = document.getElementById('extra-boxes-item');
    const packing = document.getElementById('card-extra-packing');
    const assembly = document.getElementById('card-extra-assembly');
    const load = document.getElementById('load-section');

    const action = visible ? 'remove' : 'add';
    if (boxes) boxes.classList[action]('hidden');
    if (packing) packing.classList[action]('hidden');
    if (assembly) assembly.classList[action]('hidden');
    if (load) load.classList[action]('hidden');
}

function setLoadType(type) {
    selectedLoadType = type;
    const pill = document.getElementById('pill-load');
    const btnStd = document.getElementById('load-standard');
    const btnHeavy = document.getElementById('load-heavy');

    if (pill) {
        pill.classList.remove('hidden');
        if (type === 'standard') {
            pill.style.transform = 'translateY(-50%) translateX(0)';
        } else {
            pill.style.transform = `translateY(-50%) translateX(${btnStd.offsetWidth}px)`;
        }
    }

    [btnStd, btnHeavy].forEach(btn => {
        btn.classList.remove('text-brandPurple', 'font-black');
        btn.classList.add('text-slate-400');
    });

    const selected = (type === 'standard') ? btnStd : btnHeavy;
    selected.classList.add('text-brandPurple', 'font-black');
    selected.classList.remove('text-slate-400');

    if (type === 'heavy') {
        addAiMessage("¡Anotado! 🦾 Al tener muebles grandes o electrodomésticos, enviaré a un **segundo operario** (coste único de 35€) para asegurar que todo se mueve con total seguridad.");
    }

    validateStep2();
}

function setAccessType(type) {
    selectedAccessType = type;
    const pill = document.getElementById('pill-access');
    const btnStreet = document.getElementById('access-street');
    const btnElevator = document.getElementById('access-elevator');
    const btnStairs = document.getElementById('access-stairs');

    if (pill) {
        pill.classList.remove('hidden');
        if (type === 'street') {
            pill.style.transform = 'translateY(-50%) translateX(0)';
        } else if (type === 'elevator') {
            pill.style.transform = `translateY(-50%) translateX(${btnStreet.offsetWidth}px)`;
        } else {
            pill.style.transform = `translateY(-50%) translateX(${btnStreet.offsetWidth + btnElevator.offsetWidth}px)`;
        }
    }

    [btnStreet, btnElevator, btnStairs].forEach(btn => {
        btn.classList.remove('text-brandPurple', 'font-black');
        btn.classList.add('text-slate-400');
    });

    const selected = document.getElementById(`access-${type}`);
    if (selected) {
        selected.classList.add('text-brandPurple', 'font-black');
        selected.classList.remove('text-slate-400');
    }

    if (type === 'street') {
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
            addAiMessage("¡Logística validada! ✅ He comprobado que todo es correcto. Pulsa en **'Ir al Resumen'** para revisar el desglose final y asegurar tu espacio.");
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
    // If it's past 16h, the first available day is not tomorrow, but the day after tomorrow.
    const now = new Date();
    let daysIterated = (now.getHours() >= 16) ? 2 : 1;

    let addedDays = 0;

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
}

function renderCalendarDay(container, date, days, months, dateStr) {
    const dayName = days[date.getDay()];
    const dayNum = date.getDate();
    const monthName = months[date.getMonth()];

    const dayEl = document.createElement('div');
    dayEl.id = `date-${dateStr}`;
    dayEl.onclick = () => selectDate(dateStr);
    dayEl.className = 'flex flex-col items-center justify-center p-3 rounded-2xl border-2 border-slate-50 bg-slate-50 cursor-pointer transition-all hover:border-brandPurple/30 group';

    // If this is the selected date, highlight it
    if (selectedDate === dateStr) {
        dayEl.classList.remove('border-slate-50', 'bg-slate-50');
        dayEl.classList.add('border-brandPurple', 'bg-white', 'shadow-md', 'scale-105', 'z-10');
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
        btn.classList.remove('text-brandPurple');
        btn.classList.add('text-slate-400');
    });

    const selected = (slot === 'morning') ? btnMorning : btnAfternoon;
    selected.classList.add('text-brandPurple');
    selected.classList.remove('text-slate-400');

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

function setSelectMode(mode) {
    selectMode = mode;
    const pill = document.getElementById('pill-mode');
    const btnPacks = document.getElementById('mode-btn-packs');
    const btnManual = document.getElementById('mode-btn-manual');

    if (mode === 'packs') {
        if (pill) pill.style.transform = 'translateY(-50%) translateX(0)';
        btnPacks.classList.add('text-brandPurple');
        btnPacks.classList.remove('text-slate-400');
        btnManual.classList.add('text-slate-400');
        btnManual.classList.remove('text-brandPurple');

        document.getElementById('view-packs').classList.remove('hidden');
        document.getElementById('view-manual').classList.add('hidden');
    } else {
        if (pill) pill.style.transform = `translateY(-50%) translateX(${btnPacks.offsetWidth}px)`;
        btnManual.classList.add('text-brandPurple');
        btnManual.classList.remove('text-slate-400');
        btnPacks.classList.add('text-slate-400');
        btnPacks.classList.remove('text-brandPurple');

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
        updateM3(targetVol);

        setTimeout(() => {
            const tip = targetVol <= 2 ?
                "Has entrado en **Manual** manteniendo tu Pack. 📏 Así puedes ver que el volumen y precio coinciden. Si necesitas ajustar, mueve el slider." :
                "Has activado el **Recuento Manual**. 📏 **TIP:** Aquí puedes ajustar al milímetro tu espacio.";
            addAiMessage(tip);
        }, 600);
    } else {
        setTimeout(() => {
            addAiMessage("Has vuelto a los **Planes Recomendados**. 📦 Estos packs son la forma más fácil de acertar. ¿Cuál crees que te encaja mejor?");
        }, 600);
    }
}

function setDuration(months) {
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
            btn.classList.add('text-white', 'selected-pill');
            btn.classList.remove('text-slate-400');
        } else {
            btn.classList.add('text-slate-400');
            btn.classList.remove('text-white', 'selected-pill');
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

function selectPack(id) {
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

function updateM3(val) {
    // 1. Magnetic Snap Logic (Assist user in hitting exact pack values)
    if (val >= 0.8 && val <= 1.3) val = 1.0;
    else if (val >= 1.8 && val <= 2.3) val = 2.0;

    // Round to nearest .5
    val = Math.round(val * 2) / 2;

    const prevVolume = selectedVolume;
    selectedVolume = val;

    // Update Slider Visualization (Cap at 15)
    const range = document.getElementById('reserva-range');
    if (range) {
        range.value = Math.min(val, 15);
    }

    // Update Counter Display with Animation
    const m3ValDisplay = document.getElementById('m3-val');
    if (m3ValDisplay) {
        animateValue('m3-val', prevVolume, selectedVolume, 400, false);
    }

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

    // Match Pack logic (Ranges)
    if (val <= 1.0) {
        selectedPack = 1;
        highlightPackCard(1);
    } else if (val <= 2.0) {
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


    // 4. One-time costs (Boxes & Mozo)
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
        totalOneTime += PRICES.EXTRA_MOVER;
        hasOneTime = true;
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
    const grandTotal = monthlyRent + totalOneTime;
    if (costGrandTotal) costGrandTotal.innerText = `${grandTotal.toFixed(2)}€`;

    // Show/Hide section
    if (sectionOneTime) {
        if (hasOneTime) sectionOneTime.classList.remove('hidden');
        else sectionOneTime.classList.add('hidden');
    }
}

function confirmOrder() {
    const terms = document.getElementById('terms-check');
    if (!terms || !terms.checked) {
        addAiMessage("⚠️ Para confirmar tu reserva inteligente, es necesario que aceptes las condiciones generales.");
        return;
    }

    // Success simulation
    const btn = document.getElementById('confirm-btn');
    const backBtn = document.getElementById('btn-back-to-step-2');
    const stepperContainer = document.querySelector('.flex.items-center.justify-between.md\\:justify-center.gap-2.md\\:gap-8.mb-8');

    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-outlined animate-spin">sync</span> Procesando Pago...';

    setTimeout(() => {
        isPaid = true; // LOCK NAVIGATION

        // UI Changes
        if (backBtn) backBtn.classList.add('hidden');
        if (terms) terms.disabled = true;

        // Hide stepper to avoid confusion
        if (stepperContainer) stepperContainer.classList.add('opacity-30', 'pointer-events-none');

        addAiMessage("¡PAGO CONFIRMADO! 💳🎉 Tu reserva ya es oficial. En breve recibirás un email con el contrato y los próximos pasos. ¡Nos vemos en la recogida!");

        btn.disabled = false;
        btn.innerHTML = 'Salir del Asistente <span class="material-symbols-outlined">logout</span>';
        btn.classList.replace('bg-brandDark', 'bg-green-600');
        btn.onclick = () => window.location.href = '../index.html'; // Or wherever Home is
    }, 2500);
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
