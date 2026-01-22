import { openFullscreen } from "./fullscreen.js";
import { enableInlineEdit, isMontyUser } from "./editPost.js";
import { showConfirm } from "./customConfirm.js";
import { apiDeletePost } from "./postsApi.js";

let overlayEl = null;
let modalEl = null;
let bodyEl = null;
let authorNameEl = null;
let metaEl = null;
let actionsEl = null;

let keyHandlerBound = false;
let fullscreenObserverBound = false;
let navGuardBound = false;
let navGuardHandler = null;

function safeGetCurrentUser() {
    try {
        if (typeof getCurrentUser === "function") return getCurrentUser();
    } catch { }
    return null;
}

function canEditPost(post) {
    // совместимость со старым условием
    if (typeof isMontyUser === "function" && isMontyUser()) return true;

    const u = safeGetCurrentUser();
    if (!u) return false;

    const currentId = (u.email || u.username || "").toLowerCase();
    const postAuthorId = String(post.authorId || post.AuthorId || "").toLowerCase();

    return currentId && postAuthorId && currentId === postAuthorId;
}

function updateNavbarHeightVar() {
    const nav = document.querySelector(".navBarMenu") || document.querySelector("nav");
    if (!nav) return;
    const h = Math.ceil(nav.getBoundingClientRect().height || 0);
    document.documentElement.style.setProperty("--navbar-h", `${h}px`);
}


function bindFullscreenCloseObserver() {
    if (fullscreenObserverBound) return;
    fullscreenObserverBound = true;

    const tryBind = () => {
        const fs = document.querySelector(".fullscreen-modal");
        if (!fs) return false;

        // Нам не нужно восстанавливать — пост-модалка всегда остаётся под fullscreen.
        return true;
    };

    if (tryBind()) return;

    let attempts = 0;
    const t = setInterval(() => {
        attempts++;
        if (tryBind() || attempts > 20) clearInterval(t);
    }, 250);
}

function ensureElements() {
    overlayEl = document.getElementById("postModalOverlay");
    modalEl = document.getElementById("postModal");
    bodyEl = document.getElementById("postModalBody");
    authorNameEl = document.getElementById("postModalAuthorName");
    metaEl = document.getElementById("postModalMeta");
    actionsEl = document.getElementById("postModalActions");

    if (!overlayEl || !modalEl || !bodyEl || !authorNameEl || !metaEl || !actionsEl) {
        console.error("PostModal: не найдены элементы в index.html (#postModalOverlay / #postModal / ...)");
        return false;
    }

    // закрытие кликом по фону
    overlayEl.addEventListener("click", (e) => {
        if (e.target === overlayEl) attemptClosePostModal();
    });

    if (!keyHandlerBound) {
        keyHandlerBound = true;
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && overlayEl.style.display === "flex") {
                attemptClosePostModal();
            }
        });
    }

    bindFullscreenCloseObserver();
    return true;
}

function attemptClosePostModal() {
    if (!bodyEl) {
        closePostModal();
        return;
    }

    const postDiv = bodyEl.querySelector(".post-modal-post");
    const hasChanges = postDiv && typeof postDiv.__editHasChanges === "function"
        ? postDiv.__editHasChanges()
        : false;

    if (postDiv && postDiv.classList.contains("editing") && hasChanges) {
        showConfirm({
            text: "Вы не сохранили изменения. Закрыть без сохранения?",
            onYes: () => {
                if (typeof postDiv.__editForceCancel === "function") {
                    postDiv.__editForceCancel();
                }
                closePostModal();
            }
        });
        return;
    }

    if (postDiv && postDiv.classList.contains("editing")) {
        if (typeof postDiv.__editForceCancel === "function") {
            postDiv.__editForceCancel();
        }
    }

    closePostModal();
}

export function closePostModal() {
    if (!overlayEl) return;

    overlayEl.style.display = "none";
    if (bodyEl) bodyEl.innerHTML = "";
    if (actionsEl) actionsEl.innerHTML = "";
    document.body.style.overflow = "";
    unbindNavGuard();
}

function extractNavUrl(el) {
    if (!el) return "";
    if (el.tagName === "A" && el.href) return el.href;

    const onClickAttr = el.getAttribute("onclick") || "";
    const match = onClickAttr.match(/location\.href\s*=\s*['"]([^'"]+)['"]/);
    if (match && match[1]) return match[1];
    return "";
}

function bindNavGuard() {
    if (navGuardBound) return;
    const nav = document.querySelector(".navBarMenu");
    if (!nav) return;

    navGuardHandler = (e) => {
        if (!overlayEl || overlayEl.style.display !== "flex") return;

        const postDiv = bodyEl ? bodyEl.querySelector(".post-modal-post") : null;
        const hasChanges = postDiv && typeof postDiv.__editHasChanges === "function"
            ? postDiv.__editHasChanges()
            : false;

        if (!postDiv || !postDiv.classList.contains("editing") || !hasChanges) return;

        const target = e.target ? e.target.closest("button, a") : null;
        if (!target) return;

        e.preventDefault();
        e.stopPropagation();

        const url = extractNavUrl(target);

        showConfirm({
            text: "Вы не сохранили изменения. Закрыть без сохранения?",
            onYes: () => {
                if (typeof postDiv.__editForceCancel === "function") {
                    postDiv.__editForceCancel();
                }
                closePostModal();
                if (url) {
                    window.location.href = url;
                }
            }
        });
    };

    nav.addEventListener("click", navGuardHandler, true);
    navGuardBound = true;
}

function unbindNavGuard() {
    if (!navGuardBound) return;
    const nav = document.querySelector(".navBarMenu");
    if (nav && navGuardHandler) {
        nav.removeEventListener("click", navGuardHandler, true);
    }
    navGuardHandler = null;
    navGuardBound = false;
}

export function openPostModal({ post, formatPostDate, formatPostText }) {
    if (!ensureElements()) return;
    updateNavbarHeightVar();

    // очистка
    bodyEl.innerHTML = "";
    actionsEl.innerHTML = "";

    // шапка
    authorNameEl.textContent = post.authorName || post.AuthorName || "Unknown";

    const rawCreated = post.createdAt || post.CreatedAt || post.time || post.date || post.Date;
    const rawUpdated = post.updatedAt || post.UpdatedAt || post.editTime || post.EditTime;

    const dateToShow = rawUpdated || rawCreated;
    const edited = Boolean(rawUpdated);

    metaEl.textContent = typeof formatPostDate === "function"
        ? formatPostDate(dateToShow, edited)
        : (edited ? `${dateToShow} (ред.)` : String(dateToShow ?? ""));

    // ===== POST SHELL (нужен для enableInlineEdit) =====
    const postShell = document.createElement("div");
    postShell.className = "post-modal-post";

    // скрытая шапка (для enableInlineEdit)
    const hiddenHeader = document.createElement("div");
    hiddenHeader.className = "post-header";

    const hiddenAuthor = document.createElement("div");
    hiddenAuthor.className = "post-author";

    const hiddenAvatar = document.createElement("img");
    hiddenAvatar.className = "post-author-avatar";
    hiddenAvatar.src = "/images/ProfileIcon.png";
    hiddenAvatar.alt = "Профиль";

    const hiddenName = document.createElement("span");
    hiddenName.className = "post-author-name";
    hiddenName.textContent = post.authorName || post.AuthorName || "Unknown";

    hiddenAuthor.appendChild(hiddenAvatar);
    hiddenAuthor.appendChild(hiddenName);

    const hiddenTime = document.createElement("small");
    hiddenTime.className = "post-time";
    if (rawCreated) hiddenTime.dataset.createdAt = rawCreated;
    if (rawUpdated) hiddenTime.dataset.updatedAt = rawUpdated;

    hiddenTime.textContent = typeof formatPostDate === "function"
        ? formatPostDate(dateToShow, edited)
        : (edited ? `${dateToShow} (ред.)` : String(dateToShow ?? ""));

    hiddenHeader.appendChild(hiddenAuthor);
    hiddenHeader.appendChild(hiddenTime);

    const titleEl = document.createElement("div");
    const rawTitle = post.title || post.Title || "";
    titleEl.textContent = rawTitle;
    titleEl.className = "post-modal-title";

    // фото
    const images = Array.isArray(post.images) ? post.images : [];
    const imagesRow = document.createElement("div");
    imagesRow.className = "post-images";

    function renderImageStack(rowEl, allImages) {
        let current = 0;

        rowEl.style.display = "flex";
        rowEl.style.flexDirection = "row";
        rowEl.style.gap = "14px";
        rowEl.style.maxHeight = "none";
        rowEl.style.height = "auto";
        rowEl.style.overflowX = "auto";
        rowEl.style.overflowY = "hidden";
        rowEl.style.webkitOverflowScrolling = "touch";
        rowEl.style.justifyContent = "flex-start";
        rowEl.style.alignItems = "center";
        rowEl.style.paddingLeft = "50%";
        rowEl.style.paddingRight = "50%";
        rowEl.style.scrollSnapType = "x mandatory";

        rowEl.innerHTML = "";

        const wrappers = allImages.map((src, idx) => {
            const wrapper = document.createElement("div");
            wrapper.className = "image-wrapper";
            wrapper.dataset.index = String(idx);
            wrapper.style.flex = "0 0 auto";
            wrapper.style.transformOrigin = "center center";
            wrapper.style.transition = "transform 0.2s ease, opacity 0.2s ease";
            wrapper.style.borderRadius = "12px";
            wrapper.style.overflow = "hidden";
            wrapper.style.scrollSnapAlign = "center";
            wrapper.style.scrollMarginInline = "50%";

            const img = document.createElement("img");
            img.className = "post-image";
            img.src = src;
            img.alt = "Изображение поста";
            img.style.objectFit = "contain";

            wrapper.appendChild(img);
            rowEl.appendChild(wrapper);
            return wrapper;
        });

        function setCurrent(nextIndex) {
            current = Math.max(0, Math.min(nextIndex, allImages.length - 1));
            wrappers.forEach((wrapper, i) => {
                const dist = Math.abs(i - current);
                if (dist === 0) {
                    wrapper.style.transform = "scale(1.08)";
                    wrapper.style.opacity = "1";
                } else if (dist === 1) {
                    wrapper.style.transform = "scale(0.92)";
                    wrapper.style.opacity = "0.9";
                } else {
                    wrapper.style.transform = "scale(0.88)";
                    wrapper.style.opacity = "0.8";
                }
                wrapper.style.zIndex = String(100 - dist);
            });
            const active = wrappers[current];
            if (active) {
                active.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
            }
        }

        wrappers.forEach((wrapper) => {
            wrapper.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                const idx = Number(wrapper.dataset.index || "0");
                if (idx === current) {
                    openFullscreen(allImages, idx);
                } else {
                    setCurrent(idx);
                }
            });
        });

        let startX = 0;
        let startY = 0;
        let startTime = 0;

        function onTouchStart(e) {
            const t = e.changedTouches && e.changedTouches[0];
            if (!t) return;
            startX = t.clientX;
            startY = t.clientY;
            startTime = Date.now();
        }

        function onTouchEnd(e) {
            const t = e.changedTouches && e.changedTouches[0];
            if (!t) return;
            const dx = t.clientX - startX;
            const dy = t.clientY - startY;
            const dt = Date.now() - startTime;
            const absX = Math.abs(dx);
            const absY = Math.abs(dy);
            if (dt > 800) return;
            if (absX < 40 || absX < absY * 1.2) return;
            if (dx < 0) setCurrent(current + 1);
            else setCurrent(current - 1);
        }

        function onWheel(e) {
            if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) {
                if (e.deltaX > 0) setCurrent(current + 1);
                if (e.deltaX < 0) setCurrent(current - 1);
                return;
            }
            if (e.deltaY > 0) setCurrent(current + 1);
            if (e.deltaY < 0) setCurrent(current - 1);
        }

        rowEl.addEventListener("touchstart", onTouchStart, { passive: true });
        rowEl.addEventListener("touchend", onTouchEnd, { passive: true });
        rowEl.addEventListener("wheel", onWheel, { passive: true });

        setCurrent(0);
    }

    if (images.length) {
        renderImageStack(imagesRow, images);
    } else {
        imagesRow.style.display = "none";
    }

    // текст
    const textEl = document.createElement("p");
    textEl.className = "post-text";
    const rawText = post.text || post.Text || "";

    if (typeof formatPostText === "function") {
        textEl.innerHTML = formatPostText(rawText);
    } else {
        textEl.textContent = rawText;
    }

    const categoryEl = document.createElement("div");
    const cat = post.category || post.Category || "";
    const sub = post.subcategory || post.Subcategory || "";
    if (cat) {
        categoryEl.textContent = sub ? `Категория: ${cat}, ${sub}` : `Категория: ${cat}`;
        categoryEl.className = "post-modal-category";
    } else {
        categoryEl.style.display = "none";
    }

    postShell.appendChild(hiddenHeader);
    if (rawTitle) postShell.appendChild(titleEl);
    postShell.appendChild(imagesRow);
    postShell.appendChild(textEl);
    postShell.appendChild(categoryEl);
    bodyEl.appendChild(postShell);

    // панель упр. меню
    const actionsWrap = document.createElement("div");
    actionsWrap.className = "post-modal-actions-wrap";

    const panel = document.createElement("div");
    panel.className = "post-modal-actions-panel";

    const canManage = canEditPost(post);
    if (canManage) {
        // кнопка меню (серые)
        const menuBtn = document.createElement("button");
        menuBtn.type = "button";
        menuBtn.className = "post-modal-btn post-modal-menu";

        const menuIcon = document.createElement("img");
        menuIcon.src = "/images/menu-fold-fill.svg";   // 1) до открытия
        menuIcon.alt = "Меню";
        menuBtn.appendChild(menuIcon);

        function syncMenuIcon() {
            const opened = actionsWrap.classList.contains("is-open");
            menuIcon.src = opened
                ? "/images/menu-unfold-fill.svg"
                : "/images/menu-fold-fill.svg";
        }

        menuBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            actionsWrap.classList.toggle("is-open");
            syncMenuIcon();
        });

        modalEl.addEventListener("click", () => {
            actionsWrap.classList.remove("is-open");
            syncMenuIcon();
        });

        const editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.className = "post-modal-btn post-modal-edit";
        editBtn.innerHTML = `<img src="/images/PencilFill.svg" alt="Редактировать">`;

        editBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            actionsWrap.classList.remove("is-open");

            enableInlineEdit(post, postShell, formatPostDate);
        });

        // удаление
        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "post-modal-btn post-modal-delete";
        deleteBtn.innerHTML = `<img src="/images/delete-bin-5-fill.svg" alt="Удалить">`;

        deleteBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            actionsWrap.classList.remove("is-open");

            showConfirm({
                text: "Удалить этот пост?",
                onYes: async () => {
                    const id = post.id || post.Id;
                    if (!id) return;

                    const ok = await apiDeletePost(id);
                    if (!ok) {
                        showConfirm({ text: "Не удалось удалить пост на сервере." });
                        return;
                    }

                    closePostModal();

                    const card = document.querySelector(`[data-post-id="${String(id)}"]`);
                    if (card) card.remove();
                }
            });
        });

        panel.appendChild(editBtn);
        panel.appendChild(deleteBtn);

        actionsWrap.appendChild(panel);
        actionsWrap.appendChild(menuBtn);
        actionsEl.appendChild(actionsWrap);
        syncMenuIcon();
    }

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "post-modal-btn post-modal-close";
    closeBtn.innerHTML = `<img src="/images/close-line.svg" alt="Закрыть">`;
    closeBtn.addEventListener("click", attemptClosePostModal);
    actionsEl.appendChild(closeBtn);

    document.addEventListener("keydown", function escHandler(e) {
        if (e.key !== "Escape") return;

        if (overlayEl.style.display !== "flex") {
            document.removeEventListener("keydown", escHandler);
            return;
        }

        if (actionsWrap.classList.contains("is-open")) {
            actionsWrap.classList.remove("is-open");
            return;
        }

        attemptClosePostModal();
        document.removeEventListener("keydown", escHandler);
    });

    overlayEl.style.display = "flex";
    document.body.style.overflow = "hidden";
    bindNavGuard();
}
