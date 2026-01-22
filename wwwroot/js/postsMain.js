// postsMain.js — логика формы создания поста и отображения ленты

import { apiGetPosts, apiCreatePost, apiDeletePost, uploadImagesToServer } from "./postsApi.js";
import { updatePreview, setImagesChangeHandler } from "./preview.js";

import { openFullscreen } from "./fullscreen.js";
import { enableInlineEdit, isMontyUser } from "./editPost.js";
import { showConfirm } from "./customConfirm.js";
import { openPostModal } from "./postModal.js?v=20260121";

document.addEventListener("DOMContentLoaded", () => {
    let selectedImages = [];
    let existingImages = [];
    const MAX_POST_LENGTH = 125;
    const MAX_TITLE_LENGTH = 45;
    let sseActive = false;

    const postForm = document.getElementById("postForm");
    const postTitle = document.getElementById("postTitle");
    const postText = document.getElementById("postText");
    const errorMessage = document.getElementById("error-message");
    const postTitleCounter = document.getElementById("postTitleCounter");
    const postTextCounter = document.getElementById("postTextCounter");
    const postImageInput = document.getElementById("postImage");
    const postsContainer = document.getElementById("postsContainer");
    const cancelPostBtn = document.getElementById("cancelCreatePostBtn");
    const categoryStage1 = document.getElementById("categoryStage1");
    const categoryStage2 = document.getElementById("categoryStage2");
    const categorySelected = document.getElementById("categorySelected");
    const categorySelectedText = document.getElementById("categorySelectedText");
    const categoryResetBtn = document.getElementById("categoryResetBtn");

    const MAX_IMAGES = 10; 
    let imageCounterEl = null;
    let uploadStatusEl = null;
    let selectedCategory = "";
    let selectedSubcategory = "";
    let activeCategory = "";
    const DRAFT_KEY = "postDraft";
    let draftSaveTimer = null;

    const categoryConfig = [
        { name: "Вещи", sub: ["Одежда", "Обувь", "Аксессуары", "Мебель"] },
        { name: "Электроника", sub: ["Смартфоны", "Планшеты", "Готовые компьютеры", "Бытовая техника"] },
        { name: "Недвижимость", sub: [] },
        { name: "Транспорт", sub: ["Автомобили", "Мотоциклы", "Велосипеды", "Запчасти"] }
    ];

    function setCategorySelection(category, subcategory = "") {
        selectedCategory = category || "";
        selectedSubcategory = subcategory || "";

        if (categorySelected && categorySelectedText) {
            const text = selectedSubcategory
                ? `Категория: ${selectedCategory}, ${selectedSubcategory}`
                : `Категория: ${selectedCategory}`;
            categorySelectedText.textContent = text;
        }

        if (categoryStage1) categoryStage1.style.display = "none";
        if (categoryStage2) categoryStage2.style.display = "none";
        if (categorySelected) categorySelected.style.display = "flex";
        updateCancelPostButton();
        scheduleSaveDraft();
    }

    function renderButtons(container, items, onClick) {
        if (!container) return;
        container.innerHTML = "";
        items.forEach((item) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.classList.add("buttonLiquidGlassStyle", "category-btn");

            const icon = document.createElement("img");
            icon.src = "/images/image-add-line.svg";
            icon.alt = "";
            icon.className = "category-btn-icon";

            const label = document.createElement("span");
            label.className = "category-btn-label";
            label.textContent = item;

            btn.appendChild(icon);
            btn.appendChild(label);
            btn.addEventListener("click", () => onClick(item));
            container.appendChild(btn);
        });
    }

    function showMainCategories() {
        activeCategory = "";
        if (categoryStage1) categoryStage1.style.display = "flex";
        if (categoryStage2) categoryStage2.style.display = "none";
        if (categorySelected) categorySelected.style.display = "none";
        renderButtons(categoryStage1, categoryConfig.map(c => c.name), (name) => {
            const cat = categoryConfig.find(c => c.name === name);
            if (cat && Array.isArray(cat.sub) && cat.sub.length > 0) {
                showSubcategories(name);
            } else {
                setCategorySelection(name, "");
            }
        });
    }

    function showSubcategories(categoryName) {
        activeCategory = categoryName;
        if (categoryStage1) categoryStage1.style.display = "none";
        if (categoryStage2) categoryStage2.style.display = "flex";
        if (categorySelected) categorySelected.style.display = "none";

        const cat = categoryConfig.find(c => c.name === categoryName);
        const subs = cat && Array.isArray(cat.sub) ? cat.sub : [];

        const backLabel = "← Назад";
        renderButtons(categoryStage2, [backLabel, ...subs], (name) => {
            if (name === backLabel) {
                showMainCategories();
                return;
            }
            setCategorySelection(categoryName, name);
        });
    }

    function resetCategorySelection() {
        selectedCategory = "";
        selectedSubcategory = "";
        showMainCategories();
        updateCancelPostButton();
        scheduleSaveDraft();
    }

    function renderPostCardImages(postDiv, images, anchorEl) {
        // очищаем/создаём блок картинок
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

        // в карточке всегда показываем только 1 изображение
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

    function bindAvitoHoverPreview({ wrapper, img, zonesHost, images }) {
        if (!wrapper || !img || !zonesHost || !Array.isArray(images) || !images.length) return;

        // если уже было навешано ранее (SSE update), снимаем
        if (wrapper.__avitoCleanup) {
            try { wrapper.__avitoCleanup(); } catch { }
            wrapper.__avitoCleanup = null;
        }

        // --- динамические стили (inline), чтобы не трогать твой CSS ---
        wrapper.style.position = wrapper.style.position || "relative";

        zonesHost.style.position = "absolute";
        zonesHost.style.inset = "0";
        zonesHost.style.display = "grid";
        zonesHost.style.gridTemplateColumns = `repeat(${images.length}, 1fr)`;
        zonesHost.style.zIndex = "5";
        zonesHost.style.background = "transparent";

        // полностью прозрачные зоны
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

        // mouse/pointer move — вычисляем индекс по X координате
        const onPointerMove = (e) => {
            const rect = wrapper.getBoundingClientRect();
            const x = (e.clientX ?? 0) - rect.left;
            const w = Math.max(1, rect.width);
            const ratio = Math.max(0, Math.min(0.999999, x / w));
            const idx = Math.floor(ratio * images.length);
            setIndex(idx);
        };

        // чтобы на телефоне тоже было удобно:
        // тап по картинке/зоне -> следующий кадр
        const onPointerDown = (e) => {
            // не мешаем клику по карточке открыть модалку
            // но картинку переключим
            if (images.length <= 1) return;
            const next = (currentIndex + 1) % images.length;
            currentIndex = next;
            img.src = images[currentIndex];
        };

        const onPointerLeave = () => resetToFirst();

        // важный момент: pointermove будет работать и на десктопе, и на трекпаде
        zonesHost.addEventListener("pointermove", onPointerMove);
        zonesHost.addEventListener("pointerleave", onPointerLeave);
        zonesHost.addEventListener("pointerdown", onPointerDown);

        // иногда люди водят по самому img — тоже поддержим
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

    function normalizePostFromServer(post) {
        let images = [];

        if (Array.isArray(post.images)) {
            images = post.images;
        } else {
            const imagesJson =
                post.imagesJson ??
                post.ImagesJson ??
                null;

            if (imagesJson) {
                try {
                    const parsed = JSON.parse(imagesJson);
                    if (Array.isArray(parsed)) {
                        images = parsed;
                    }
                } catch (e) {
                    console.error("Ошибка парсинга ImagesJson:", e, imagesJson);
                }
            }
        }

        return {
            ...post,
            images,
            title: post.title ?? post.Title ?? "",
            category: post.category ?? post.Category ?? "",
            subcategory: post.subcategory ?? post.Subcategory ?? ""
        };
    }

    function refreshPostTimes() {
        const timeEls = document.querySelectorAll(".post-time");
        timeEls.forEach((el) => {
            const created = el.dataset.createdAt;
            const updated = el.dataset.updatedAt;
            const ts = updated || created;
            if (!ts) return;

            const isEdited = Boolean(updated);
            el.textContent = formatPostDate(ts, isEdited);
        });
    }


    function initPostsStream() {
        if (!window.EventSource) {
            console.warn("SSE не поддерживается этим браузером");
            return;
        }

        const es = new EventSource("/api/posts/stream");
        es.onopen = () => {
            sseActive = true;
        };

        es.onmessage = (event) => {
            try {
                const payload = JSON.parse(event.data);

                // новый пост
                if (payload.type === "created" && payload.post) {
                    const post = normalizePostFromServer(payload.post);
                    const postId = post.id ?? post.Id ?? null;
                    if (!postsContainer) return;

                    if (postId != null) {
                        const exists = postsContainer.querySelector(
                            `[data-post-id="${postId}"]`
                        );
                        if (exists) return;
                    }

                    const el = displayPost(post);
                    postsContainer.prepend(el);
                    refreshPostTimes?.();
                }

                // 🔥 обновление поста (текст + время + фото)
                if (payload.type === "updated" && payload.post) {
                    const post = normalizePostFromServer(payload.post);
                    const postId = post.id ?? post.Id ?? null;
                    if (!postsContainer || postId == null) return;

                    const postDiv = postsContainer.querySelector(
                        `[data-post-id="${postId}"]`
                    );
                    if (!postDiv) return;

                    // --- ТЕКСТ ---
                    const textEl = postDiv.querySelector(".post-text");
                    if (textEl) {
                        const rawTitle = post.title || post.Title || "";
                        textEl.innerHTML = formatPostText(rawTitle);
                    }

                    // --- ВРЕМЯ ---
                    const timeEl = postDiv.querySelector(".post-time");
                    if (timeEl) {
                        const rawCreated =
                            post.createdAt ||
                            post.CreatedAt ||
                            post.time ||
                            post.date ||
                            post.Date;

                        const rawUpdated =
                            post.updatedAt ||
                            post.UpdatedAt ||
                            post.editTime ||
                            post.EditTime;

                        if (rawCreated) {
                            timeEl.dataset.createdAt = rawCreated;
                        }
                        if (rawUpdated) {
                            timeEl.dataset.updatedAt = rawUpdated;
                        } else {
                            delete timeEl.dataset.updatedAt;
                        }

                        const dateToShow = rawUpdated || rawCreated;
                        const isEdited = Boolean(rawUpdated);
                        timeEl.textContent = formatPostDate(dateToShow, isEdited);
                    }

                    // --- ФОТО (главное, что ты просил) ---
                    const images = Array.isArray(post.images) ? post.images : [];
                    renderPostCardImages(postDiv, images, postDiv.querySelector(".post-text"));


                    if (!images.length) {
                        // если картинок больше нет — удаляем блок
                        if (imageContainer) {
                            imageContainer.remove();
                        }
                    } else {
                        // если блока ещё нет — создаём
                        if (!imageContainer) {
                            imageContainer = document.createElement("div");
                            imageContainer.classList.add("post-images");
                            postDiv.appendChild(imageContainer);
                        }

                        // очищаем старые изображения
                        imageContainer.innerHTML = "";

                        // создаём актуальный набор
                        images.forEach((src, index) => {
                            const wrapper = document.createElement("div");
                            wrapper.classList.add("image-wrapper");

                            const img = document.createElement("img");
                            img.src = src;
                            img.alt = "Изображение поста";
                            img.classList.add("post-image");

                            img.addEventListener("click", () => {
                                openFullscreen(images, index);
                            });

                            const fsBtn = document.createElement("button");
                            fsBtn.type = "button";
                            fsBtn.classList.add("fullscreen-btn");
                            const fsIcon = document.createElement("img");
                            fsIcon.src = "/images/fullscreen-fill.svg";
                            fsIcon.alt = "Открыть на весь экран";
                            fsBtn.appendChild(fsIcon);

                            fsBtn.addEventListener("click", (e) => {
                                e.stopPropagation();
                                openFullscreen(images, index);
                            });

                            wrapper.appendChild(img);
                            wrapper.appendChild(fsBtn);
                            imageContainer.appendChild(wrapper);
                        });
                    }

                    refreshPostTimes?.();
                }

                if (payload.type === "deleted" && payload.postId != null) {
                    if (!postsContainer) return;

                    const idStr = String(payload.postId);
                    const el = postsContainer.querySelector(
                        `[data-post-id="${idStr}"]`
                    );
                    if (el) {
                        el.remove();
                    }
                }
            } catch (e) {
                console.error("Ошибка SSE", e, event.data);
            }
        };

        es.onerror = (err) => {
            console.warn("SSE ошибка/разрыв соединения", err);
            sseActive = false;
        };
    }


    function ensureImageCounter() {
        if (imageCounterEl && document.body.contains(imageCounterEl)) {
            return imageCounterEl;
        }

        const previewContainer = document.getElementById("previewContainer");
        if (!previewContainer || !previewContainer.parentNode) return null;

        const div = document.createElement("div");
        div.style.fontSize = "14px";
        div.style.color = "rgba(255,255,255,0.65)";
        div.style.marginBottom = "6px";
        div.style.marginLeft = "2px";
        div.style.userSelect = "none";
        div.style.transition = "opacity 0.25s ease";
        div.style.display = "none";

        previewContainer.parentNode.insertBefore(div, previewContainer);
        imageCounterEl = div;
        return imageCounterEl;
    }

    function ensureUploadStatus() {
        if (uploadStatusEl && document.body.contains(uploadStatusEl)) {
            return uploadStatusEl;
        }

        const previewContainer = document.getElementById("previewContainer");
        if (!previewContainer || !previewContainer.parentNode) return null;

        const div = document.createElement("div");
        div.style.fontSize = "14px";
        div.style.color = "rgba(255,255,255,0.8)";
        div.style.marginBottom = "6px";
        div.style.marginLeft = "2px";
        div.style.userSelect = "none";
        div.style.display = "none";

        previewContainer.parentNode.insertBefore(div, previewContainer);
        uploadStatusEl = div;
        return uploadStatusEl;
    }

    function setUploadStatus(text) {
        const el = ensureUploadStatus();
        if (!el) return;
        if (text) {
            el.textContent = text;
            el.style.display = "block";
        } else {
            el.textContent = "";
            el.style.display = "none";
        }
    }

    //функция для управления видимостью кнопки отмены созд. поста
    function updateCancelPostButton() {
        if (!cancelPostBtn) return;

        const hasText = postText && postText.value.trim().length > 0;
        const hasTitle = postTitle && postTitle.value.trim().length > 0;
        const hasImages = selectedImages.length > 0 || existingImages.length > 0;
        const hasCategory = Boolean(selectedCategory);

        // Если есть хотя бы текст или хотя бы одно изображение — показываем кнопку
        if (hasText || hasTitle || hasImages || hasCategory) {
            cancelPostBtn.style.display = "flex";
        } else {
            cancelPostBtn.style.display = "none";
        }
    }


    // безопасно пробуем вытащить текущего пользователя из другого скрипта
    function safeGetCurrentUser() {
        try {
            if (typeof getCurrentUser === "function") {
                return getCurrentUser();
            }
        } catch {
            // игнорируем
        }
        return null;
    }

    function updateImagesUI() {
        updatePreview(selectedImages, existingImages);

        const total = selectedImages.length + existingImages.length;
        const counter = ensureImageCounter();

        if (counter) {
            if (total > 0) {
                counter.style.display = "block";
                counter.textContent = `${total} / ${MAX_IMAGES}`;
                counter.style.color =
                    total >= MAX_IMAGES
                        ? "rgba(255,120,120,0.9)"
                        : "rgba(255,255,255,0.65)";
            } else {
                counter.style.display = "none";
            }
        }

        if (postImageInput) {
            postImageInput.disabled = total >= MAX_IMAGES;
        }
        updateCancelPostButton();
    }
    setImagesChangeHandler(() => {
        updateImagesUI();
        scheduleSaveDraft();
    });

    if (categoryResetBtn) {
        categoryResetBtn.addEventListener("click", resetCategorySelection);
    }

    // единая функция: обработать нажатие на удаление изображения
    function removeImage(imageUrl) {
        selectedImages = selectedImages.filter((url) => url !== imageUrl);
        updateImagesUI();
        scheduleSaveDraft();
    }

    // обработчик событий для кнопки удаления изображений
    document.addEventListener("click", (e) => {
        if (e.target && e.target.classList.contains("remove-image-btn")) {
            const imageUrl = e.target.dataset.imageUrl;
            if (imageUrl) {
                removeImage(imageUrl);
            }
        }
    });

    // формат красивой даты "только что / 5 мин назад / вчера / dd.MM.yyyy"
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

    function saveDraft() {
        if (!postForm) return;
        const title = postTitle ? postTitle.value.trim() : "";
        const text = postText ? postText.value.trim() : "";
        const images = [...selectedImages, ...existingImages];
        const hasData = title || text || images.length || selectedCategory;

        if (!hasData) {
            localStorage.removeItem(DRAFT_KEY);
            return;
        }

        const draft = {
            title,
            text,
            category: selectedCategory || "",
            subcategory: selectedSubcategory || "",
            images
        };

        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    }

    function scheduleSaveDraft() {
        if (!postForm) return;
        if (draftSaveTimer) clearTimeout(draftSaveTimer);
        draftSaveTimer = setTimeout(saveDraft, 200);
    }

    function restoreDraft() {
        if (!postForm) return;
        const raw = localStorage.getItem(DRAFT_KEY);
        if (!raw) return;
        let draft;
        try {
            draft = JSON.parse(raw);
        } catch {
            return;
        }

        if (postTitle && typeof draft.title === "string") {
            postTitle.value = draft.title;
            postTitle.style.height = "auto";
            postTitle.style.height = postTitle.scrollHeight + "px";
        }
        if (postText && typeof draft.text === "string") {
            postText.value = draft.text;
            postText.style.height = "auto";
            postText.style.height = postText.scrollHeight + "px";
        }

        const imgs = Array.isArray(draft.images) ? draft.images : [];
        selectedImages = [...imgs];
        existingImages = [];
        updateImagesUI();

        if (draft.category) {
            setCategorySelection(draft.category, draft.subcategory || "");
        } else {
            showMainCategories();
        }

        if (postTitleCounter && postTitle) {
            postTitleCounter.textContent = `${postTitle.value.length}/${MAX_TITLE_LENGTH}`;
        }
        if (postTextCounter && postText) {
            postTextCounter.textContent = `${postText.value.length}/${MAX_POST_LENGTH}`;
        }
        updateCancelPostButton();
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

    // Отрисовка одного поста
    function displayPost(post) {
        const postDiv = document.createElement("div");
        postDiv.className = "post";

        const postId = post.id ?? post.Id ?? null;
        if (postId != null) postDiv.dataset.postId = String(postId);
        const authorIdRaw = post.authorId || post.AuthorId || "";
        if (authorIdRaw) postDiv.dataset.authorId = String(authorIdRaw).toLowerCase();

        const authorName =
            post.authorName ||
            post.AuthorName ||
            "MontyLine";

        const rawCreated =
            post.createdAt ||
            post.CreatedAt ||
            post.time ||
            post.date ||
            post.Date;

        const rawUpdated =
            post.updatedAt ||
            post.UpdatedAt ||
            post.editTime ||
            post.EditTime;

        const dateToShow = rawUpdated || rawCreated;
        const isEdited = Boolean(rawUpdated);

        const timeText = formatPostDate(dateToShow, isEdited);

        const rawTitle =
            post.title ||
            post.Title ||
            "";
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

        // картинки карточки: одна + avito-hover
        const images = Array.isArray(post.images) ? post.images : [];
        renderPostCardImages(postDiv, images, postDiv.querySelector(".post-text"));

        postDiv.addEventListener("click", () => {
            openPostModal({ post, formatPostDate, formatPostText });
        });

        return postDiv;
    }

    // Загрузка постов при старте
    async function loadPostsFromServer() {
        if (!postsContainer) return;

        const posts = await apiGetPosts();
        postsContainer.innerHTML = "";

        posts.forEach(post => {
            const postForDisplay = normalizePostFromServer(post);

            const postEl = displayPost(postForDisplay);
            postsContainer.appendChild(postEl);
        });
    }

    // Обработчик формы поста
    if (postForm && postText) {
        postForm.addEventListener("submit", async (event) => {
            event.preventDefault();

            const title = postTitle ? postTitle.value.trim() : "";
            const text = postText.value.trim();

            const existing = Array.isArray(existingImages) ? existingImages : [];
            const selected = Array.isArray(selectedImages) ? selectedImages : [];
            const allImages = [...existing, ...selected];

            if (!title) {
                showConfirm({ text: "Введите название поста." });
                return;
            }
            if (!text) {
                showConfirm({ text: "Введите описание поста." });
                return;
            }
            if (allImages.length === 0) {
                showConfirm({ text: "Добавьте хотя бы одно изображение." });
                return;
            }
            if (!selectedCategory) {
                showConfirm({ text: "Выберите категорию." });
                return;
            }

            let authorName = "Unknown";
            let authorId = "anonymous";

            try {
                const u = safeGetCurrentUser();
                if (u) {
                    if (u.username) authorName = u.username;
                    if (u.email || u.username) {
                        authorId = u.email || u.username;
                    }
                }
            } catch {
                // игнорируем
            }

            const dto = {
                AuthorId: authorId,
                AuthorName: authorName,
                Title: title,
                Text: text,
                Category: selectedCategory,
                Subcategory: selectedSubcategory || null,
                ImagesJson: allImages.length ? JSON.stringify(allImages) : null
            };

            const created = await apiCreatePost(dto);
            if (!created) {
                alert("Не удалось сохранить пост на сервере.");
                return;
            }
            if (!created.title && !created.Title && title) {
                created.title = title;
            }
            if (!created.category && !created.Category && selectedCategory) {
                created.category = selectedCategory;
            }
            if (!created.subcategory && !created.Subcategory && selectedSubcategory) {
                created.subcategory = selectedSubcategory;
            }

            let imagesFromServer = [];
            if (created.imagesJson) {
                try {
                    const parsed = JSON.parse(created.imagesJson);
                    if (Array.isArray(parsed)) {
                        imagesFromServer = parsed;
                    }
                } catch {
                    imagesFromServer = [];
                }
            }

            const postForDisplay = {
                ...created,
                images: Array.isArray(created.images) ? created.images : imagesFromServer
            };

            if (postsContainer) {
                const postId = postForDisplay.id ?? postForDisplay.Id ?? null;
                const exists = postId != null
                    ? postsContainer.querySelector(`[data-post-id="${postId}"]`)
                    : null;
                if (!exists && !sseActive) {
                    postsContainer.prepend(displayPost(postForDisplay));
                }
            }
            postForm.reset();
            selectedImages = [];
            existingImages = [];
            postImageInput.value = "";
            if (postTitle) postTitle.style.height = "auto";
            postText.style.height = "auto";
            resetCategorySelection();
            updateImagesUI();
            localStorage.removeItem(DRAFT_KEY);

            if (cancelPostBtn) cancelPostBtn.style.display = "none";
            setTimeout(loadPostsFromServer, 200);
        });

        if (postTitle) {
            postTitle.addEventListener("input", function () {
                this.style.height = "auto";
                this.style.height = this.scrollHeight + "px";

                if (this.value.length > MAX_TITLE_LENGTH) {
                    this.value = this.value.substring(0, MAX_TITLE_LENGTH);
                    this.style.height = this.scrollHeight + "px";
                }
            if (postTitleCounter) {
                postTitleCounter.textContent = `${this.value.length}/${MAX_TITLE_LENGTH}`;
            }
            updateCancelPostButton();
            scheduleSaveDraft();
        });
        }

        // авто-рост textarea + лимит 1200 символов
        postText.addEventListener("input", function () {
            this.style.height = "auto";
            this.style.height = this.scrollHeight + "px";

            if (this.value.length > MAX_POST_LENGTH) {
                this.value = this.value.substring(0, MAX_POST_LENGTH);
                this.style.height = this.scrollHeight + "px";
                if (errorMessage) errorMessage.style.display = "block";
            } else if (errorMessage) {
                errorMessage.style.display = "none";
            }

            if (postTextCounter) {
                postTextCounter.textContent = `${this.value.length}/${MAX_POST_LENGTH}`;
            }
            updateCancelPostButton();
            scheduleSaveDraft();

            postText.addEventListener("input", function () {
                this.style.height = "auto";
                this.style.height = this.scrollHeight + "px";

                if (this.value.length > MAX_POST_LENGTH) {
                    this.value = this.value.substring(0, MAX_POST_LENGTH);
                    this.style.height = this.scrollHeight + "px";
                    if (errorMessage) errorMessage.style.display = "block";
                } else if (errorMessage) {
                    errorMessage.style.display = "none";
                }
                if (postTextCounter) {
                    postTextCounter.textContent = `${this.value.length}/${MAX_POST_LENGTH}`;
                }
                updateCancelPostButton();
                scheduleSaveDraft();
            });

        });

        // Кнопка отмены создания поста
        if (cancelPostBtn) {
            cancelPostBtn.addEventListener("click", () => {
                const hasText = postText.value.trim().length > 0;
                const hasImages = selectedImages.length > 0 || existingImages.length > 0;
                const hasTitle = postTitle && postTitle.value.trim().length > 0;
                const hasCategory = Boolean(selectedCategory);

                if (!hasText && !hasImages && !hasTitle && !hasCategory) return;

                showConfirm({
                    text: "Отменить создание поста?",
                    onYes: () => {
                        postForm.reset();
                        postText.style.height = "auto";
                        if (postTitle) postTitle.style.height = "auto";

                        selectedImages.length = 0;
                        existingImages.length = 0;

                        resetCategorySelection();
                        updateImagesUI(); 
                        localStorage.removeItem(DRAFT_KEY);
                    }
                });
            });
        }
    }

    // Обработчик выбора файлов
    if (postImageInput) {
        postImageInput.addEventListener("change", async () => {
            const files = Array.from(postImageInput.files || []);
            if (!files.length) return;

            const totalBefore = selectedImages.length + existingImages.length;

            // 🔹 проверка лимита
            if (totalBefore >= MAX_IMAGES) {
                showConfirm({
                    text: `Максимум ${MAX_IMAGES} изображений в одном посте.`,
                    onYes: function () {
                        postImageInput.value = "";  // Очищаем выбранные файлы
                        updateImagesUI();
                    },
                    onNo: function () {
                        postImageInput.value = "";  // Очищаем выбранные файлы
                        updateImagesUI();
                    }
                });
                return;
            }

            // 🔹 если выбранные файлы + уже существующие изображения превышают лимит
            if (totalBefore + files.length > MAX_IMAGES) {
                showConfirm({
                    text: `Можно добавить не более ${MAX_IMAGES} изображений. Сейчас уже ${totalBefore}. Загрузить оставшиеся?`,
                    onYes: function () {
                        const remainingSpace = MAX_IMAGES - totalBefore;
                        const allowedFiles = files.slice(0, remainingSpace);
                        uploadImages(allowedFiles);
                    },
                    onNo: function () {
                        postImageInput.value = "";
                        updateImagesUI();
                    }
                });
                return;
            }

            // 🔹 иначе загружаем изображения
            try {
                uploadImages(files);
            } catch (err) {
                console.error(err);
                showConfirm({
                    text: "Не удалось загрузить изображения. Попробуйте еще раз.",
                    onYes: function () { },
                    onNo: function () { }
                });
            } finally {
                postImageInput.value = "";
            }
        });
    }

    function getCanvasTransform(orientation, width, height) {
        switch (orientation) {
            case 2: return [-1, 0, 0, 1, width, 0];
            case 3: return [-1, 0, 0, -1, width, height];
            case 4: return [1, 0, 0, -1, 0, height];
            case 5: return [0, 1, 1, 0, 0, 0];
            case 6: return [0, 1, -1, 0, height, 0];
            case 7: return [0, -1, -1, 0, height, width];
            case 8: return [0, -1, 1, 0, 0, width];
            default: return [1, 0, 0, 1, 0, 0];
        }
    }

    function readExifOrientation(file) {
        return new Promise((resolve) => {
            try {
                const exif = window.EXIF;
                if (!exif || !file) return resolve(1);
                exif.getData(file, function () {
                    const o = exif.getTag(this, "Orientation");
                    resolve(o || 1);
                });
            } catch {
                resolve(1);
            }
        });
    }

    function loadImageFromFile(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(file);
            img.onload = () => {
                URL.revokeObjectURL(url);
                resolve(img);
            };
            img.onerror = (e) => {
                URL.revokeObjectURL(url);
                reject(e);
            };
            img.src = url;
        });
    }

    function normalizeOutputType(type) {
        if (type === "image/jpeg" || type === "image/png" || type === "image/webp") {
            return type;
        }
        return "image/jpeg";
    }

    async function createOrientedBitmap(file) {
        try {
            if (typeof createImageBitmap !== "function") return null;
            return await createImageBitmap(file, { imageOrientation: "from-image" });
        } catch {
            return null;
        }
    }

    async function autoOrientFile(file) {
        try {
            if (!file || !file.type || !file.type.startsWith("image/")) return file;
            const bitmap = await createOrientedBitmap(file);

            if (bitmap) {
                const canvas = document.createElement("canvas");
                canvas.width = bitmap.width;
                canvas.height = bitmap.height;
                const ctx = canvas.getContext("2d");
                if (!ctx) return file;
                ctx.drawImage(bitmap, 0, 0);

                const outputType = normalizeOutputType(file.type);
                const blob = await new Promise((resolve) =>
                    canvas.toBlob(resolve, outputType, 0.92)
                );
                if (!blob) return file;

                return new File([blob], file.name, { type: blob.type });
            }

            const orientation = await readExifOrientation(file);
            if (!orientation || orientation === 1) return file;

            const img = await loadImageFromFile(file);
            const width = img.naturalWidth || img.width;
            const height = img.naturalHeight || img.height;
            if (!width || !height) return file;

            const canvas = document.createElement("canvas");
            if (orientation >= 5 && orientation <= 8) {
                canvas.width = height;
                canvas.height = width;
            } else {
                canvas.width = width;
                canvas.height = height;
            }

            const ctx = canvas.getContext("2d");
            if (!ctx) return file;

            const [a, b, c, d, e, f] = getCanvasTransform(orientation, width, height);
            ctx.setTransform(a, b, c, d, e, f);
            ctx.drawImage(img, 0, 0);

            const outputType = normalizeOutputType(file.type);
            const blob = await new Promise((resolve) =>
                canvas.toBlob(resolve, outputType, 0.92)
            );
            if (!blob) return file;

            return new File([blob], file.name, { type: blob.type });
        } catch {
            return file;
        }
    }

    async function autoOrientFiles(files) {
        const list = Array.isArray(files) ? files : [];
        const fixed = [];
        for (const file of list) {
            fixed.push(await autoOrientFile(file));
        }
        return fixed;
    }

    // Функция для загрузки изображений
    async function uploadImages(files) {
        const submitBtn = postForm ? postForm.querySelector("button.submit-button") : null;
        setUploadStatus("Обработка изображений...");
        if (postImageInput) postImageInput.disabled = true;
        if (submitBtn) submitBtn.disabled = true;
        try {
            const preparedFiles = await autoOrientFiles(files);
            const uploadedUrls = await uploadImagesToServer(preparedFiles);
            selectedImages.push(...uploadedUrls);  // Добавляем загруженные URL в массив

            updateImagesUI();  // Обновляем интерфейс с изображениями
            updateCancelPostButton();  // Обновляем видимость кнопки отмены
            scheduleSaveDraft();
        } catch (err) {
            console.error(err);
            showConfirm({
                text: "Не удалось загрузить изображения. Попробуйте еще раз.",
                onYes: function () { },
                onNo: function () { }
            });
        } finally {
            if (postImageInput) postImageInput.disabled = false;
            if (submitBtn) submitBtn.disabled = false;
            setUploadStatus("");
        }
    }

    showMainCategories();
    restoreDraft();
    loadPostsFromServer();
    updateImagesUI();
    initPostsStream();
    refreshPostTimes();

    if (postTitleCounter && postTitle) {
        postTitleCounter.textContent = `${postTitle.value.length}/${MAX_TITLE_LENGTH}`;
    }
    if (postTextCounter && postText) {
        postTextCounter.textContent = `${postText.value.length}/${MAX_POST_LENGTH}`;
    }

    setInterval(refreshPostTimes, 60 * 1000);
});
