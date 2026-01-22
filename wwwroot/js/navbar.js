const NAVBAR_URL = "/partials/navbar.html";

function ensureContainer() {
    let container = document.getElementById("navbar-container");
    if (container) return container;
    container = document.createElement("div");
    container.id = "navbar-container";
    document.body.insertBefore(container, document.body.firstChild);
    return container;
}

function normalizePath(pathname) {
    const p = (pathname || "").toLowerCase();
    if (p === "/" || p.endsWith("/index.html") || p.endsWith("/pages/index.html")) {
        return "index";
    }
    if (p.endsWith("/basket.html") || p.endsWith("/pages/basket.html")) {
        return "basket";
    }
    if (p.endsWith("/profile.html") || p.endsWith("/pages/profile.html")) {
        return "profile";
    }
    if (p.endsWith("/announcements.html") || p.endsWith("/pages/announcements.html")) {
        return "announcements";
    }
    return "";
}

function setActiveNav(activeKey) {
    const buttons = document.querySelectorAll("[data-nav]");
    buttons.forEach((btn) => {
        const key = btn.getAttribute("data-nav");
        const isActive = key && key === activeKey;

        if (btn.classList.contains("navButton") || btn.classList.contains("navButton-active")) {
            btn.classList.remove("navButton", "navButton-active");
            btn.classList.add(isActive ? "navButton-active" : "navButton");
            btn.disabled = isActive;
            return;
        }

        if (btn.classList.contains("miniNavButton") || btn.classList.contains("miniNavButton-active")) {
            btn.classList.remove("miniNavButton", "miniNavButton-active");
            btn.classList.add(isActive ? "miniNavButton-active" : "miniNavButton");
            btn.disabled = isActive;
        }
    });
}

function ensureFadeOverlay() {
    let overlay = document.getElementById("navFadeOverlay");
    if (overlay) return overlay;
    overlay = document.createElement("div");
    overlay.id = "navFadeOverlay";
    document.body.appendChild(overlay);
    return overlay;
}

function extractNavUrl(el) {
    if (!el) return "";
    if (el.tagName === "A" && el.href) return el.href;
    const onClickAttr = el.getAttribute("onclick") || "";
    const match = onClickAttr.match(/location\.href\s*=\s*['"]([^'"]+)['"]/);
    if (match && match[1]) return match[1];
    return "";
}

function bindNavFade() {
    const navMenu = document.querySelector(".navBarMenu");
    if (!navMenu || navMenu.__fadeBound) return;
    navMenu.__fadeBound = true;

    navMenu.addEventListener("click", (e) => {
        const btn = e.target ? e.target.closest("button, a") : null;
        if (!btn || btn.disabled) return;

        // если пользователь не авторизован — авторизация сама откроет меню
        try {
            if (typeof getCurrentUser === "function" && !getCurrentUser()) {
                return;
            }
        } catch { }

        const rawUrl = extractNavUrl(btn);
        if (!rawUrl || rawUrl === "#") return;

        const nextUrl = new URL(rawUrl, window.location.origin);
        if (nextUrl.href === window.location.href) return;

        e.preventDefault();
        e.stopPropagation();

        ensureFadeOverlay();
        document.body.classList.add("nav-fade-active");

        setTimeout(() => {
            window.location.href = nextUrl.href;
        }, 180);
    });
}

const container = ensureContainer();

try {
    const response = await fetch(NAVBAR_URL, { cache: "no-cache" });
    if (response.ok) {
        const html = await response.text();
        container.innerHTML = html;
        setActiveNav(normalizePath(window.location.pathname));
        bindNavFade();
        document.dispatchEvent(new CustomEvent("navbar:loaded"));
    } else {
        console.warn("Navbar: не удалось загрузить", NAVBAR_URL);
    }
} catch (e) {
    console.warn("Navbar: ошибка загрузки", e);
}
