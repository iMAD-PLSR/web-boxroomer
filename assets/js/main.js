// Main JS - Component Loader

document.addEventListener("DOMContentLoaded", () => {
    loadComponents();
    createScrollToTopButton();
    initCookieBanner();
    initScrollAnimations();
});

// Scroll Animations Observer
function initScrollAnimations() {
    const observerOptions = {
        threshold: 0.15,
        rootMargin: "0px 0px -50px 0px"
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
            }
        });
    }, observerOptions);

    const reveals = document.querySelectorAll('.reveal');
    reveals.forEach(el => observer.observe(el));
}

async function loadComponents() {
    const headerPlaceholder = document.getElementById("header-placeholder");
    const footerPlaceholder = document.getElementById("footer-placeholder");

    if (headerPlaceholder) {
        const headerPath = headerPlaceholder.dataset.path || "components/header.html";
        await loadComponent(headerPlaceholder, headerPath);

        // Fix links after header is loaded
        fixHeaderLinks(headerPath);
    }

    if (footerPlaceholder) {
        const footerPath = footerPlaceholder.dataset.path || "components/footer.html";
        await loadComponent(footerPlaceholder, footerPath);

        // Fix footer links
        fixFooterLinks(footerPath);
    }
}

async function loadComponent(element, path) {
    try {
        const response = await fetch(path);
        if (response.ok) {
            const html = await response.text();
            element.innerHTML = html;
        } else {
            console.error(`Failed to load component via ${path}`);
        }
    } catch (e) {
        console.error(`Error loading component ${path}:`, e);
    }
}

function fixHeaderLinks(headerPath) {
    const isInSubdir = headerPath.startsWith("../");
    const prefix = isInSubdir ? "../" : "";

    // Fix all home links in header
    const homeLinks = document.querySelectorAll('header [data-home-link]');
    homeLinks.forEach(link => {
        link.href = prefix + "index.html";
    });

    // Fix logo image src
    const logoImg = document.querySelector('[data-logo-img]');
    if (logoImg) {
        logoImg.src = prefix + "assets/images/logo.png";
    }

    // Fix section links (point to index regions)
    const sectionLinks = document.querySelectorAll('[data-section-link]');
    sectionLinks.forEach(link => {
        const fullHref = link.getAttribute('href');
        const hash = fullHref.includes('#') ? fullHref.split('#')[1] : fullHref;
        if (isInSubdir) {
            link.href = "../index.html#" + hash;
        } else {
            link.href = "#" + hash;
        }
    });

    // Fix page links
    const pageLinks = document.querySelectorAll('[data-page-link]');
    pageLinks.forEach(link => {
        const page = link.dataset.pageLink;
        link.href = (isInSubdir ? "" : "pages/") + page;
    });
}

function fixFooterLinks(footerPath) {
    const isInSubdir = footerPath.startsWith("../");
    const prefix = isInSubdir ? "../" : "";

    // Fix home links (including logo)
    const homeLinks = document.querySelectorAll('footer [data-home-link]');
    homeLinks.forEach(link => {
        link.href = prefix + "index.html";
    });

    // Fix footer logo image src
    const logoImg = document.querySelector('[data-footer-logo-img]');
    if (logoImg) {
        logoImg.src = prefix + "assets/images/logo.png";
    }

    // Fix page links
    const pageLinks = document.querySelectorAll('footer [data-page-link]');
    pageLinks.forEach(link => {
        const page = link.dataset.pageLink;
        link.href = (isInSubdir ? "" : "pages/") + page;
    });
}

function createScrollToTopButton() {
    const btn = document.createElement("button");
    btn.id = "scroll-to-top";
    btn.innerHTML = `
        <div class="bg-brandPurple text-white p-4 rounded-2xl shadow-2xl border border-white/20 hover:bg-brandDark hover:scale-110 transition-all duration-300 group">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 group-hover:-translate-y-1 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
        </div>
    `;
    btn.setAttribute("aria-label", "Volver arriba");
    document.body.appendChild(btn);

    // Initial check
    toggleScrollButton(btn);

    window.addEventListener("scroll", () => {
        toggleScrollButton(btn);
    });

    btn.addEventListener("click", () => {
        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    });
}


function toggleScrollButton(btn) {
    if (window.scrollY > 300) {
        btn.classList.add("visible");
    } else {
        btn.classList.remove("visible");
    }
}

// Cookie Banner Logic
function initCookieBanner() {
    if (localStorage.getItem("cookies-accepted")) return;

    const banner = document.createElement("div");
    banner.id = "cookie-banner";
    banner.className = "fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] w-[95%] max-w-lg transition-all duration-500 translate-y-20 opacity-0";
    banner.innerHTML = `
        <div class="bg-white/80 backdrop-blur-xl border border-brandPurple/20 p-6 rounded-[2rem] shadow-2xl flex flex-col md:flex-row items-center gap-6">
            <div class="flex-grow">
                <p class="text-[10px] font-black uppercase tracking-widest text-brandPurple mb-1 italic">Control de Cookies</p>
                <p class="text-xs text-brandDark font-bold leading-relaxed">
                    Usamos cookies para mejorar tu experiencia. ¿Nos dejas seguir haciéndolo?
                </p>
            </div>
            <div class="flex gap-3">
                <button id="accept-cookies" class="bg-brandPurple text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-brandDark transition-all">
                    Aceptar
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(banner);

    // Show with animation
    setTimeout(() => {
        banner.classList.remove("translate-y-20", "opacity-0");
    }, 1000);

    document.getElementById("accept-cookies").addEventListener("click", () => {
        localStorage.setItem("cookies-accepted", "true");
        banner.classList.add("translate-y-20", "opacity-0");
        setTimeout(() => banner.remove(), 500);
    });
}

// Utility scroll functions
function scrollToId(id) {
    const element = document.getElementById(id);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
    }
}
window.scrollToId = scrollToId;
