// Calculator Logic
const range = document.getElementById('m3-range');
const display = document.getElementById('m3-display');
const finalPrice = document.getElementById('final-price');
const promoLabel = document.getElementById('promo-label');
let currentMonths = 3;

// Function to change duration
function setDuration(months) {
    currentMonths = months;

    // Sliding Pill Logic
    const pill = document.getElementById('pill-duration');
    const container = document.getElementById('dur-toggle-container');
    const activeBtn = document.getElementById('dur-' + months);

    if (pill && container && activeBtn) {
        const left = activeBtn.offsetLeft;
        const width = activeBtn.offsetWidth;
        pill.style.width = width + 'px';
        pill.style.transform = `translateY(-50%) translateX(${left}px)`;
    }

    // Visual update of buttons
    document.querySelectorAll('.dur-btn').forEach(btn => {
        btn.classList.add('text-slate-400');
        btn.classList.remove('text-white', 'active');
    });

    if (activeBtn) {
        activeBtn.classList.add('text-white', 'active');
        activeBtn.classList.remove('text-slate-400');
    }

    calculate();
}

// Main calculation function
function calculate() {
    if (!range) return; // Guard clause if element doesn't exist

    const m3 = parseFloat(range.value);
    display.innerText = m3.toFixed(1).replace('.0', '') + ' m³';

    // Pricing base: 1st m3 = 39. Additional = 16.
    // Pricing Logic
    let totalPayable = 0;
    let promoText = "-";
    let isPack = false;

    if (m3 <= 1) {
        // Pack Mini - FIXED PRICES
        isPack = true;
        if (currentMonths === 3) totalPayable = 139;
        else if (currentMonths === 6) totalPayable = 199;
        else if (currentMonths === 12) totalPayable = 319;
        else totalPayable = 139; // Fallback

        promoText = "PACK MINI";
    } else if (m3 <= 2) {
        // Pack Dúo (covers 1.5 and 2.0) - FIXED PRICES
        isPack = true;
        if (currentMonths === 3) totalPayable = 199;
        else if (currentMonths === 6) totalPayable = 309;
        else if (currentMonths === 12) totalPayable = 529;
        else totalPayable = 199; // Fallback

        promoText = "PACK DÚO";
    }
    else {
        // Standard Formula ( > 2 m3)
        let monthlyBase = 39 + (m3 - 1) * 16;

        if (currentMonths === 6) {
            totalPayable = monthlyBase * 5; // Pay 5 (1 free)
            promoText = "AHORRO 1 MES";
        } else if (currentMonths === 12) {
            totalPayable = monthlyBase * 9; // Pay 9 (3 free)
            promoText = "AHORRO 3 MESES";
        } else {
            totalPayable = monthlyBase * currentMonths;
            promoText = "-"; // No promo for 3 months standard
        }
    }

    // Calculate effective monthly fee seen by user
    const effectiveMonthly = totalPayable / currentMonths;
    finalPrice.innerText = Math.round(effectiveMonthly) + '€';

    // Shipping Text Logic
    const shippingText = document.getElementById('calc-shipping-text');
    const shippingValue = document.getElementById('calc-shipping-value');

    if (isPack) {
        if (shippingText) shippingText.innerText = "RECOGIDA Y ENTREGA";
        if (shippingValue) {
            shippingValue.innerText = "INCLUIDA (PACK)";
            shippingValue.classList.add('text-green-400');
            shippingValue.classList.remove('text-brandPurple');
        }
    } else {
        if (shippingText) shippingText.innerText = "RECOGIDA GRATIS";
        if (shippingValue) {
            shippingValue.innerText = "ENTREGA 39€ (ZONA 0)";
            shippingValue.classList.remove('text-green-400');
            shippingValue.classList.add('text-brandPurple');
        }
    }

    promoLabel.innerText = promoText;

    if (promoText.includes("PACK")) {
        promoLabel.href = "#tarifas";
        promoLabel.style.cursor = "pointer";
    } else {
        promoLabel.removeAttribute("href");
        promoLabel.style.cursor = "default";
    }

    if (promoText === "-") {
        promoLabel.classList.add('opacity-0');
        promoLabel.style.pointerEvents = "none";
    } else {
        promoLabel.classList.remove('opacity-0');
        promoLabel.style.pointerEvents = "auto";
    }
}

// Function helper for scroll (moved from inline)
function scrollToId(id) {
    const element = document.getElementById(id);
    if (element) element.scrollIntoView({ behavior: 'smooth' });
}

// Listeners and Init
document.addEventListener('DOMContentLoaded', () => {
    if (range) {
        range.addEventListener('input', calculate);
        calculate();
    }
});

// Expose functions globally for HTML onclick attributes
window.setDuration = setDuration;
window.calculate = calculate;
window.bookFromCalculator = function () {
    const rangeEl = document.getElementById('m3-range');
    const vol = rangeEl ? rangeEl.value : 1;
    const months = currentMonths || 3;
    // Use clean URL to prevent server redirect stripping params
    const targetUrl = `pages/reserva?vol=${vol}&months=${months}`;
    console.log("👉 [Calculator] Redirecting to:", targetUrl);
    window.location.href = targetUrl;
};
