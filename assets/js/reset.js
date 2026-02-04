/**
 * Utility for Resetting Demo Data
 * Clears all localStorage and sessionStorage keys related to BOXROOMER
 */

const BoxroomerReset = {
    keys: [
        'cookies-accepted',
        'boxroomer_address',
        'boxroomer_cp',
        'boxroomer_city',
        'BOXROOMER_DASHBOARD_DATA',
        'BOXROOMER_CLIENT_HISTORY',
        'BOXROOMER_AUDIT_LOG',
        'BOXROOMER_COUPONS',
        'BOXROOMER_INSURANCE_TIERS',
        'BOXROOMER_USER_ADDRESSES',
        'boxroomer_theme',
        'pill-sidebar-top',
        'pill-sidebar-height',
        'pill-mobile-left',
        'pill-mobile-width'
    ],

    execute: function () {
        // Clear specific keys
        this.keys.forEach(key => localStorage.removeItem(key));

        // Also clear everything that starts with BOXROOMER_ just in case
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('BOXROOMER_') || key.startsWith('boxroomer_')) {
                localStorage.removeItem(key);
            }
        });

        // Clear Session Storage
        sessionStorage.clear();

        // Visual feedback
        this.showSuccessToast();

        setTimeout(() => {
            window.location.href = '../index.html';
        }, 2000);
    },

    showSuccessToast: function () {
        const toast = document.createElement('div');
        toast.className = 'fixed inset-0 z-[1000] flex items-center justify-center pointer-events-none bg-black/60 backdrop-blur-sm animate-fade-in-quick';
        toast.innerHTML = `
            <div class="bg-[#1A1A1A] text-white px-12 py-8 rounded-[3rem] font-black uppercase italic tracking-tighter shadow-[0_0_80px_rgba(115,18,224,0.5)] flex flex-col items-center gap-6 border border-white/10 animate-scale-up">
                <div class="w-20 h-20 bg-brandPurple rounded-full flex items-center justify-center shadow-lg shadow-brandPurple/20">
                    <span class="material-symbols-outlined text-4xl animate-spin">sync</span>
                </div>
                <div class="text-center">
                    <p class="text-2xl leading-none">Sistema Reiniciado</p>
                    <p class="text-[9px] opacity-50 mt-2 tracking-[0.3em] font-bold not-italic">RECONECTANDO CAPAS DE DATOS...</p>
                </div>
            </div>
            <style>
                @keyframes fadeInQuick { from { opacity: 0; } to { opacity: 1; } }
                @keyframes scaleUp { from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: scale(1); } }
                .animate-fade-in-quick { animation: fadeInQuick 0.3s ease-out forwards; }
                .animate-scale-up { animation: scaleUp 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
            </style>
        `;
        document.body.appendChild(toast);
    }
};

window.BoxroomerReset = BoxroomerReset;
