import { openPostModal } from "./postModal.js";

const AVATAR_KEY_PREFIX = "avatar:";
const DEFAULT_AVATAR = "/images/defaultProfilePhoto.png";

function safeGetCurrentUser() {
    try {
        if (typeof getCurrentUser === "function") return getCurrentUser();
    } catch { }
    return null;
}

function getCurrentUserId() {
    const u = safeGetCurrentUser();
    if (u && u.id != null) return u.id;
    try {
        const raw = localStorage.getItem("userId");
        if (raw) return Number(raw);
    } catch { }
    return null;
}
function getAvatarKey(userIdLower) {
    if (!userIdLower) return null;
    return `${AVATAR_KEY_PREFIX}${userIdLower}`;
}

function loadAvatar(userIdLower) {
    const key = getAvatarKey(userIdLower);
    if (!key) return null;
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

function getAvatarForPost(post) {
    const directUrl = post.authorAvatarUrl || post.AuthorAvatarUrl;
    if (directUrl) return directUrl;
    const rawId = post.authorId || post.AuthorId || post.authorName || post.AuthorName || "";
    const id = String(rawId).toLowerCase();
    return loadAvatar(id) || DEFAULT_AVATAR;
}

const avatarFetchCache = new Map();

async function fetchAvatarByUserId(userId) {
    if (!userId) return null;
    if (avatarFetchCache.has(userId)) return avatarFetchCache.get(userId);

    const p = fetch(`/api/users/${userId}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => (data && data.avatarUrl ? data.avatarUrl : null))
        .catch(() => null);

    avatarFetchCache.set(userId, p);
    return p;
}

function tryResolveAvatarAsync(post, avatarImg) {
    if (!avatarImg) return;
    const directUrl = post.authorAvatarUrl || post.AuthorAvatarUrl;
    if (directUrl) return;

    const rawId = post.authorId || post.AuthorId || "";
    const userId = String(rawId).trim();
    if (!/^\d+$/.test(userId)) return;

    fetchAvatarByUserId(userId).then((url) => {
        if (url) {
            avatarImg.src = url;
        }
    });
}

async function loadFavoritesFromServer(userId) {
    if (!userId) return [];
    try {
        const resp = await fetch(`/api/favorites/${userId}`);
        if (!resp.ok) return [];
        const data = await resp.json();
        return Array.isArray(data) ? data : [];
    } catch {
        return [];
    }
}
function formatPostDate(dateValue, edited = false) {
    if (!dateValue) return "";

    let date;
    if (dateValue instanceof Date) {
        date = dateValue;
    } else if (typeof dateValue === "number") {
        date = new Date(dateValue);
    } else if (typeof dateValue === "string") {
        let s = dateValue.trim();
        if (!s.endsWith("Z") && !s.includes("+")) {
            s = s + "Z";
        }
        date = new Date(s);
    } else {
        return String(dateValue);
    }

    if (isNaN(date.getTime())) {
        return String(dateValue);
    }

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffH = Math.floor(diffMs / 3600000);
    const diffD = Math.floor(diffMs / 86400000);

    let result;
    if (diffMin < 1) {
        result = "только что";
    } else if (diffMin < 60) {
        result = `${diffMin} мин назад`;
    } else if (diffH < 24) {
        result = `${diffH} ч назад`;
    } else if (diffD === 1) {
        result = "вчера";
    } else {
        result = date.toLocaleDateString("ru-RU", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        });
    }

    if (edited) {
        result += " (ред.)";
    }

    return result;
}

function formatPostText(rawText) {
    if (!rawText) return "";

    let text = rawText
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    text = text.replace(/\*(.+?)\*/g, "<em>$1</em>");
    text = text.replace(/https?:\/\/\S+/g, (match) =>
        `<a href="${match}" target="_blank" rel="noopener noreferrer">${match}</a>`
    );
    text = text.replace(/\n/g, "<br>");

    return text;
}

function normalizePostFromServer(post) {
    let images = [];
    if (Array.isArray(post.images)) {
        images = post.images;
    } else {
        const imagesJson = post.imagesJson ?? post.ImagesJson ?? null;
        if (imagesJson) {
            try {
                const parsed = JSON.parse(imagesJson);
                if (Array.isArray(parsed)) images = parsed;
            } catch { }
        }
    }

    return {
        ...post,
        images,
        title: post.title ?? post.Title ?? "",
        text: post.text ?? post.Text ?? ""
    };
}

function bindAvitoHoverPreview({ wrapper, img, zonesHost, images }) {
    if (!wrapper || !img || !zonesHost || !Array.isArray(images) || !images.length) return;

    if (wrapper.__avitoCleanup) {
        try { wrapper.__avitoCleanup(); } catch { }
        wrapper.__avitoCleanup = null;
    }

    wrapper.style.position = wrapper.style.position || "relative";

    zonesHost.style.position = "absolute";
    zonesHost.style.inset = "0";
    zonesHost.style.display = "grid";
    zonesHost.style.gridTemplateColumns = `repeat(${images.length}, 1fr)`;
    zonesHost.style.zIndex = "5";
    zonesHost.style.background = "transparent";

    zonesHost.innerHTML = "";
    for (let i = 0; i < images.length; i++) {
        const z = document.createElement("div");
        z.className = "post-hover-zone";
        z.style.background = "transparent";
        z.style.cursor = "pointer";
        z.style.userSelect = "none";
        zonesHost.appendChild(z);
    }

    let currentIndex = 0;

    const setIndex = (idx) => {
        const next = Math.max(0, Math.min(images.length - 1, idx));
        if (next === currentIndex) return;
        currentIndex = next;
        img.src = images[currentIndex];
    };

    const resetToFirst = () => {
        currentIndex = 0;
        img.src = images[0];
    };

    const onPointerMove = (e) => {
        const rect = wrapper.getBoundingClientRect();
        const x = (e.clientX ?? 0) - rect.left;
        const w = Math.max(1, rect.width);
        const ratio = Math.max(0, Math.min(0.999999, x / w));
        const idx = Math.floor(ratio * images.length);
        setIndex(idx);
    };

    const onPointerDown = () => {
        if (images.length <= 1) return;
        const next = (currentIndex + 1) % images.length;
        currentIndex = next;
        img.src = images[currentIndex];
    };

    const onPointerLeave = () => resetToFirst();

    zonesHost.addEventListener("pointermove", onPointerMove);
    zonesHost.addEventListener("pointerleave", onPointerLeave);
    zonesHost.addEventListener("pointerdown", onPointerDown);

    img.addEventListener("pointermove", onPointerMove);
    img.addEventListener("pointerleave", onPointerLeave);

    wrapper.__avitoCleanup = () => {
        zonesHost.removeEventListener("pointermove", onPointerMove);
        zonesHost.removeEventListener("pointerleave", onPointerLeave);
        zonesHost.removeEventListener("pointerdown", onPointerDown);

        img.removeEventListener("pointermove", onPointerMove);
        img.removeEventListener("pointerleave", onPointerLeave);
    };
}

function renderPostCardImages(postDiv, images, anchorEl) {
    let imageContainer = postDiv.querySelector(".post-images");

    if (!images || !images.length) {
        if (imageContainer) imageContainer.remove();
        return;
    }

    if (!imageContainer) {
        imageContainer = document.createElement("div");
        imageContainer.className = "post-images";
        if (anchorEl && typeof anchorEl.insertAdjacentElement === "function") {
            anchorEl.insertAdjacentElement("afterend", imageContainer);
        } else {
            postDiv.appendChild(imageContainer);
        }
    }

    imageContainer.innerHTML = `
        <div class="image-wrapper">
            <img class="post-image" src="${images[0]}" alt="РР·РѕР±СЂР°Р¶РµРЅРёРµ РїРѕСЃС‚Р°">
            <div class="post-hover-zones"></div>
        </div>
    `;

    const wrapper = imageContainer.querySelector(".image-wrapper");
    const img = imageContainer.querySelector(".post-image");
    const zonesHost = imageContainer.querySelector(".post-hover-zones");

    bindAvitoHoverPreview({ wrapper, img, zonesHost, images });
}

function displayFavorite(post) {
    const postDiv = document.createElement("div");
    postDiv.className = "post";

    const postId = post.id ?? post.Id ?? null;
    if (postId != null) postDiv.dataset.postId = String(postId);
    const authorIdRaw = post.authorId || post.AuthorId || "";
    if (authorIdRaw) postDiv.dataset.authorId = String(authorIdRaw).toLowerCase();

    const authorName = post.authorName || post.AuthorName || "MontyLine";

    const rawCreated = post.createdAt || post.CreatedAt || post.time || post.date || post.Date;
    const rawUpdated = post.updatedAt || post.UpdatedAt || post.editTime || post.EditTime;
    const dateToShow = rawUpdated || rawCreated;
    const isEdited = Boolean(rawUpdated);
    const timeText = formatPostDate(dateToShow, isEdited);

    const rawTitle = post.title || post.Title || "";
    const textHtml = formatPostText(rawTitle);

    postDiv.innerHTML = `
        <div class="post-header">
            <div class="post-author">
                <img class="post-author-avatar" src="/images/ProfileIcon.png" alt="РџСЂРѕС„РёР»СЊ">
                <span class="post-author-name">${authorName}</span>
            </div>
            <small class="post-time"
                   data-created-at="${rawCreated ?? ""}"
                   ${rawUpdated ? `data-updated-at="${rawUpdated}"` : ""}>
                ${timeText}
            </small>
        </div>

        <p class="post-text">${textHtml}</p>
    `;

    const avatarImg = postDiv.querySelector(".post-author-avatar");
    if (avatarImg) {
        avatarImg.src = getAvatarForPost(post);
        tryResolveAvatarAsync(post, avatarImg);
    }

    const images = Array.isArray(post.images) ? post.images : [];
    renderPostCardImages(postDiv, images, postDiv.querySelector(".post-text"));

    postDiv.addEventListener("click", () => {
        openPostModal({ post, formatPostDate, formatPostText });
    });

    return postDiv;
}

async function renderFavorites() {
    const container = document.getElementById("favoritesContainer");
    const emptyEl = document.getElementById("favoritesEmpty");
    if (!container) return;

    const userId = getCurrentUserId();
    if (!userId) {
        container.innerHTML = "";
        if (emptyEl) {
            emptyEl.textContent = "РђРІС‚РѕСЂРёР·СѓР№С‚РµСЃСЊ, С‡С‚РѕР±С‹ РІРёРґРµС‚СЊ РёР·Р±СЂР°РЅРЅРѕРµ.";
            emptyEl.style.display = "block";
        }
        return;
    }

    const items = await loadFavoritesFromServer(userId);
    container.innerHTML = "";

    if (!items.length) {
        if (emptyEl) {
            emptyEl.textContent = "Р’ РёР·Р±СЂР°РЅРЅРѕРј РїРѕРєР° РїСѓСЃС‚Рѕ.";
            emptyEl.style.display = "block";
        }
        return;
    }

    if (emptyEl) emptyEl.style.display = "none";
    items.map(normalizePostFromServer).forEach((post) => {
        container.appendChild(displayFavorite(post));
    });
}

document.addEventListener("DOMContentLoaded", () => {
    const emptyEl = document.getElementById("favoritesEmpty");
    if (emptyEl) {
        emptyEl.style.margin = "20px 0";
        emptyEl.style.color = "rgba(255,255,255,0.8)";
        emptyEl.style.fontSize = "16px";
        emptyEl.style.textAlign = "center";
    }

    renderFavorites();

    document.addEventListener("favorites:updated", () => {
        renderFavorites();
    });

    document.addEventListener("auth:ready", () => {
        renderFavorites();
    });
});

