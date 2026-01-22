import { apiGetPosts } from "./postsApi.js";
import { openPostModal } from "./postModal.js";
import { showConfirm, showToast } from "./customConfirm.js";

function safeGetCurrentUser() {
    try {
        if (typeof getCurrentUser === "function") return getCurrentUser();
    } catch { }
    return null;
}

const AVATAR_KEY_PREFIX = "avatar:";
const DEFAULT_AVATAR = "/images/defaultProfilePhoto.png";

function getAvatarKey(userIdLower) {
    if (!userIdLower) return null;
    return `${AVATAR_KEY_PREFIX}${userIdLower}`;
}

function getUserIdentifiers(user) {
    if (!user) return [];
    const list = [];
    if (user.id) list.push(String(user.id).toLowerCase());
    if (user.email) list.push(String(user.email).toLowerCase());
    if (user.username) list.push(String(user.username).toLowerCase());
    if (!user.id) {
        try {
            const rawId = localStorage.getItem("userId");
            if (rawId) list.push(String(rawId).toLowerCase());
        } catch { }
    }
    return [...new Set(list.filter(Boolean))];
}

function loadAvatarByIds(ids) {
    if (!Array.isArray(ids)) return null;
    for (const id of ids) {
        const key = getAvatarKey(id);
        if (!key) continue;
        try {
            const value = localStorage.getItem(key);
            if (value) return value;
        } catch { }
    }
    return null;
}

function saveAvatarForUser(user, dataUrl) {
    const ids = getUserIdentifiers(user);
    if (!ids.length) return;
    ids.forEach((id) => {
        const key = getAvatarKey(id);
        if (!key) return;
        try {
            localStorage.setItem(key, dataUrl);
        } catch { }
    });
}

function getAvatarForPost(post) {
    const directUrl = post.authorAvatarUrl || post.AuthorAvatarUrl;
    if (directUrl) return directUrl;
    const rawIds = [
        post.authorId,
        post.AuthorId,
        post.authorName,
        post.AuthorName
    ].filter(Boolean).map(v => String(v).toLowerCase());
    return loadAvatarByIds(rawIds) || DEFAULT_AVATAR;
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
        text: post.text ?? post.Text ?? "",
        category: post.category ?? post.Category ?? "",
        subcategory: post.subcategory ?? post.Subcategory ?? ""
    };
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
            <img class="post-image" src="${images[0]}" alt="Изображение поста">
            <div class="post-hover-zones"></div>
        </div>
    `;

    const wrapper = imageContainer.querySelector(".image-wrapper");
    const img = imageContainer.querySelector(".post-image");
    const zonesHost = imageContainer.querySelector(".post-hover-zones");

    bindAvitoHoverPreview({ wrapper, img, zonesHost, images });
}

function displayPost(post) {
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
                <img class="post-author-avatar" src="/images/ProfileIcon.png" alt="Профиль">
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
    if (avatarImg) avatarImg.src = getAvatarForPost(post);

    const images = Array.isArray(post.images) ? post.images : [];
    renderPostCardImages(postDiv, images, postDiv.querySelector(".post-text"));

    postDiv.addEventListener("click", () => {
        openPostModal({ post, formatPostDate, formatPostText });
    });

    return postDiv;
}

async function loadUserPosts(userIdLower, user) {
    const listEl = document.getElementById("posts-list");
    const emptyEl = document.getElementById("posts-empty");
    if (!listEl) return;

    listEl.innerHTML = "";
    if (emptyEl) emptyEl.style.display = "none";

    const posts = await apiGetPosts();
    const ids = getUserIdentifiers(user);
    const filtered = posts
        .map(normalizePostFromServer)
        .filter((p) => {
            const authorId = String(p.authorId ?? p.AuthorId ?? "").toLowerCase();
            const authorName = String(p.authorName ?? p.AuthorName ?? "").toLowerCase();
            if (authorId && ids.includes(authorId)) return true;
            if (authorName && ids.includes(authorName)) return true;
            return false;
        });

    if (!filtered.length) {
        if (emptyEl) {
            emptyEl.textContent = "У вас пока нет постов.";
            emptyEl.style.display = "block";
        }
        return;
    }

    filtered.forEach((post) => {
        listEl.appendChild(displayPost(post));
    });
}

function setProfileInfo(user) {
    const avatarEl = document.getElementById("avatar");
    const avatarBtn = document.getElementById("avatarEditBtn");
    const avatarInput = document.getElementById("avatarInput");
    const nameEl = document.getElementById("user-name");
    const emailEl = document.getElementById("user-email");
    const emailEditBtn = document.getElementById("emailEditBtn");
    const emailEditForm = document.getElementById("emailEditForm");
    const emailInput = document.getElementById("emailInput");
    const emailSaveBtn = document.getElementById("emailSaveBtn");
    const emailCancelBtn = document.getElementById("emailCancelBtn");
    const emptyEl = document.getElementById("posts-empty");

    if (!user) {
        if (avatarEl) avatarEl.src = DEFAULT_AVATAR;
        if (nameEl) nameEl.textContent = "Вы не авторизованы";
        if (emailEl) emailEl.textContent = "Войдите, чтобы видеть профиль и посты.";
        if (emptyEl) {
            emptyEl.textContent = "Авторизуйтесь, чтобы увидеть ваши посты.";
            emptyEl.style.display = "block";
        }
        if (avatarBtn) avatarBtn.disabled = true;
        if (avatarInput) avatarInput.disabled = true;
        if (emailEditBtn) emailEditBtn.disabled = true;
        if (emailEditForm) emailEditForm.style.display = "none";
        return null;
    }

    if (avatarBtn) avatarBtn.disabled = false;
    if (avatarInput) avatarInput.disabled = false;
    if (emailEditBtn) emailEditBtn.disabled = false;

    if (nameEl) nameEl.textContent = user.username || "Пользователь";
    if (emailEl) {
        const emailText = user.email ? user.email : "Почта не указана";
        emailEl.textContent = emailText;
    }

    const ids = getUserIdentifiers(user);
    if (avatarEl) {
        const saved = user.avatarUrl || loadAvatarByIds(ids);
        avatarEl.src = saved || DEFAULT_AVATAR;
    }

    if (emailEditBtn && emailEditForm && emailInput && emailSaveBtn && emailCancelBtn) {
        if (!emailEditBtn.__bound) {
            emailEditBtn.__bound = true;
            emailEditBtn.addEventListener("click", () => {
                emailInput.value = user.email || "";
                emailEditForm.style.display = "flex";
            });
        }
        if (!emailSaveBtn.__bound) {
            emailSaveBtn.__bound = true;
            emailSaveBtn.addEventListener("click", () => {
                const nextEmail = (emailInput.value || "").trim();
                if (nextEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(nextEmail)) {
                    alert("Введите корректную почту.");
                    return;
                }
                user.email = nextEmail || null;
                try {
                    localStorage.setItem("currentUser", JSON.stringify(user));
                } catch { }
                if (emailEl) {
                    emailEl.textContent = user.email ? user.email : "Почта не указана";
                }
                emailEditForm.style.display = "none";
            });
        }
        if (!emailCancelBtn.__bound) {
            emailCancelBtn.__bound = true;
            emailCancelBtn.addEventListener("click", () => {
                emailEditForm.style.display = "none";
            });
        }
    }

    return ids.length ? ids[0] : null;
}

let avatarBound = false;
let isLoadingPosts = false;
const MAX_AVATAR_BYTES = 200 * 1024;
const AVATAR_MAX_SIDE = 256;

async function renderProfile() {
    const user = safeGetCurrentUser();
    const userIdLower = setProfileInfo(user);
    if (!userIdLower) return;

    const avatarBtn = document.getElementById("avatarEditBtn");
    const avatarInput = document.getElementById("avatarInput");
    const avatarEl = document.getElementById("avatar");

    if (!avatarBound && avatarBtn && avatarInput && avatarEl) {
        avatarBound = true;
        avatarBtn.addEventListener("click", () => avatarInput.click());

        avatarInput.addEventListener("change", () => {
            const file = avatarInput.files && avatarInput.files[0];
            if (!file) return;
            if (!file.type || !file.type.startsWith("image/")) return;
            const onApplyAvatar = (dataUrl) => {
                if (!dataUrl) return;
                uploadAvatarToServer(user, dataUrl)
                    .then((url) => {
                        if (url) {
                            avatarEl.src = url;
                            user.avatarUrl = url;
                            try {
                                localStorage.setItem("currentUser", JSON.stringify(user));
                            } catch { }
                        } else {
                            avatarEl.src = dataUrl;
                            saveAvatarForUser(user, dataUrl);
                        }
                    })
                    .catch(() => {
                        avatarEl.src = dataUrl;
                        saveAvatarForUser(user, dataUrl);
                    });
            };

            if (file.size > MAX_AVATAR_BYTES) {
                showConfirm({
                    text: "Загрузить картинку в более низком разрешении?",
                    onYes: () => {
                        compressAvatar(file)
                            .then(onApplyAvatar)
                            .catch(() => {
                                showConfirm({ text: "Не удалось обработать изображение." });
                            })
                            .finally(() => {
                                avatarInput.value = "";
                            });
                    },
                    onNo: () => {
                        showToast("Фото превышает лимит.");
                        avatarInput.value = "";
                    }
                });
                return;
            }

            compressAvatar(file)
                .then(onApplyAvatar)
                .catch(() => {
                    showToast("Не удалось обработать изображение.");
                })
                .finally(() => {
                    avatarInput.value = "";
                });
        });
    }

    if (user && user.id != null) {
        await refreshUserFromServer(user);
    }

    if (!isLoadingPosts) {
        isLoadingPosts = true;
        try {
            await loadUserPosts(userIdLower, user);
        } finally {
            isLoadingPosts = false;
        }
    }
}

document.addEventListener("DOMContentLoaded", renderProfile);
document.addEventListener("auth:ready", renderProfile);

function compressAvatar(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const img = new Image();
            img.onload = async () => {
                const { width, height } = fitToSquare(img.width, img.height, AVATAR_MAX_SIDE);
                const canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                if (!ctx) {
                    reject();
                    return;
                }
                ctx.drawImage(img, 0, 0, width, height);

                let quality = 0.9;
                let dataUrl = canvas.toDataURL("image/jpeg", quality);
                while (dataUrl.length > MAX_AVATAR_BYTES * 1.37 && quality > 0.5) {
                    quality -= 0.1;
                    dataUrl = canvas.toDataURL("image/jpeg", quality);
                }

                resolve(dataUrl);
            };
            img.onerror = () => reject();
            img.src = reader.result;
        };
        reader.onerror = () => reject();
        reader.readAsDataURL(file);
    });
}

function fitToSquare(w, h, maxSide) {
    const scale = Math.min(maxSide / w, maxSide / h, 1);
    return {
        width: Math.max(1, Math.round(w * scale)),
        height: Math.max(1, Math.round(h * scale))
    };
}

async function refreshUserFromServer(user) {
    if (!user || user.id == null) return;
    try {
        const resp = await fetch(`/api/users/${user.id}`);
        if (!resp.ok) return;
        const data = await resp.json();
        user.email = data.email ?? user.email ?? null;
        user.username = data.userName ?? user.username ?? "Пользователь";
        user.avatarUrl = data.avatarUrl ?? user.avatarUrl ?? null;
        try {
            localStorage.setItem("currentUser", JSON.stringify(user));
        } catch { }

        const avatarEl = document.getElementById("avatar");
        const nameEl = document.getElementById("user-name");
        const emailEl = document.getElementById("user-email");
        if (avatarEl) avatarEl.src = user.avatarUrl || avatarEl.src || DEFAULT_AVATAR;
        if (nameEl) nameEl.textContent = user.username || "Пользователь";
        if (emailEl) {
            emailEl.textContent = user.email ? user.email : "Почта не указана";
        }
    } catch { }
}

async function uploadAvatarToServer(user, dataUrl) {
    if (!user || user.id == null) return null;
    const blob = dataURLtoBlob(dataUrl);
    if (!blob) return null;

    const form = new FormData();
    form.append("avatar", blob, "avatar.jpg");

    try {
        const resp = await fetch(`/api/users/${user.id}/avatar`, {
            method: "POST",
            body: form
        });
        if (!resp.ok) return null;
        const data = await resp.json();
        return data && data.url ? data.url : null;
    } catch {
        return null;
    }
}

function dataURLtoBlob(dataUrl) {
    if (!dataUrl || typeof dataUrl !== "string") return null;
    const parts = dataUrl.split(",");
    if (parts.length < 2) return null;
    const mimeMatch = parts[0].match(/data:(.*?);base64/);
    const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
    const binary = atob(parts[1]);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
}
