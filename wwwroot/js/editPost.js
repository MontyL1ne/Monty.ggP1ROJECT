// editPost.js — инлайн-редактирование постов и проверка прав

import { apiUpdatePost } from "./postsApi.js";
import { openFullscreen } from "./fullscreen.js";
import { showConfirm } from "./customConfirm.js";

const MAX_POST_LENGTH = 1200;
let activeEditPostDiv = null;

let originalContent = {};
let isPostChanged = false;  // Инициализируем переменную для отслеживания изменений

const categoryConfig = [
    { name: "Вещи", sub: ["Одежда", "Обувь", "Аксессуары", "Мебель"] },
    { name: "Электроника", sub: ["Смартфоны", "Планшеты", "Готовые компьютеры", "Бытовая техника"] },
    { name: "Недвижимость", sub: [] },
    { name: "Транспорт", sub: ["Автомобили", "Мотоциклы", "Велосипеды", "Запчасти"] }
];

// безопасно пробуем вытащить текущего пользователя
function safeGetCurrentUser() {
    try {
        if (typeof getCurrentUser === "function") {
            return getCurrentUser();
        }
    } catch {
        // ignore
    }
    return null;
}

// Проверяем, является ли пользователь MontyLine
export function isMontyUser() {
    const u = safeGetCurrentUser();
    if (!u || !u.username) return false;
    return u.username.toLowerCase() === "montyline";
}

// Функция для показа уведомления о том, что изменений не было
function showEditWarningToast() {
    const toast = document.createElement("div");
    toast.classList.add("edit-warning-toast");
    toast.textContent = "Вы не внесли изменения!";
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.add("visible");
    }, 10);

    setTimeout(() => {
        toast.classList.remove("visible");
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Основная функция инлайн-редактирования
function canEditPostForUser(post) {
    if (typeof isMontyUser === "function" && isMontyUser()) return true;
    const u = safeGetCurrentUser();
    if (!u) return false;
    const currentId = (u.email || u.username || "").toLowerCase();
    const postAuthorId = String(post.authorId || post.AuthorId || "").toLowerCase();
    return currentId && postAuthorId && currentId === postAuthorId;
}

export function enableInlineEdit(post, postDiv, formatPostDate) {
    if (!canEditPostForUser(post)) return;

    if (activeEditPostDiv && activeEditPostDiv !== postDiv) {
        showEditWarning();
        activeEditPostDiv.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
    }
    if (activeEditPostDiv === postDiv) return;

    activeEditPostDiv = postDiv;
    postDiv.classList.add("editing");

    const titleEl = postDiv.querySelector(".post-modal-title");
    const textEl = postDiv.querySelector(".post-text");
    const categoryEl = postDiv.querySelector(".post-modal-category");
    const oldTitle = post.title || post.Title || "";
    const oldText = post.text || post.Text || "";
    const oldCategory = post.category || post.Category || "";
    const oldSubcategory = post.subcategory || post.Subcategory || "";
    const originalTitle = titleEl ? oldTitle : (post.title || post.Title || post.text || post.Text || "");
    const originalText = oldText;
    originalContent.text = titleEl ? oldText : (post.title || post.Title || post.text || post.Text || "");
    const menuBtn = postDiv.querySelector(".menu-btn");
    if (menuBtn) menuBtn.style.display = "none";

    const imagesBlock = postDiv.querySelector(".post-images");
    const originalImages = Array.isArray(post.images) ? [...post.images] : [];

    // Текстовый редактор
    const titleInput = document.createElement("textarea");
    titleInput.classList.add("inline-editor");
    titleInput.value = originalTitle;
    titleInput.rows = 2;
    titleInput.style.overflow = "hidden";

    const textarea = document.createElement("textarea");
    textarea.classList.add("inline-editor");
    textarea.value = originalText;
    textarea.rows = 3;
    textarea.style.overflow = "hidden";

    function wrapWithCounter(inputEl, maxValue) {
        const wrapper = document.createElement("div");
        wrapper.className = "edit-field";

        const counter = document.createElement("div");
        counter.className = "edit-field-counter";
        counter.textContent = `${inputEl.value.length}/${maxValue}`;

        wrapper.appendChild(inputEl);
        wrapper.appendChild(counter);
        return { wrapper, counter };
    }

    const titleWrap = wrapWithCounter(titleInput, 45);
    const textWrap = wrapWithCounter(textarea, MAX_POST_LENGTH);

    const autoResize = (el) => {
        el.style.height = "auto";
        el.style.height = el.scrollHeight + "px";
    };

    let statusText;

    titleInput.addEventListener("input", () => {
        autoResize(titleInput);
        titleWrap.counter.textContent = `${titleInput.value.length}/45`;
    });

    textarea.addEventListener("input", () => {
        if (textarea.value.length > MAX_POST_LENGTH) {
            textarea.value = textarea.value.slice(0, MAX_POST_LENGTH);
        }

        autoResize(textarea);

        if (statusText) {
            statusText.textContent = `${textarea.value.length}/${MAX_POST_LENGTH}`;
        }
        textWrap.counter.textContent = `${textarea.value.length}/${MAX_POST_LENGTH}`;
    });

    if (titleEl && titleEl.parentNode) {
        titleEl.parentNode.replaceChild(titleWrap.wrapper, titleEl);
    }
    if (textEl && textEl.parentNode) {
        textEl.parentNode.replaceChild(textWrap.wrapper, textEl);
    }

    requestAnimationFrame(() => {
        autoResize(titleInput);
        autoResize(textarea);
    });

    const categoryEditor = document.createElement("div");
    categoryEditor.className = "post-modal-category-edit";

    const categorySelect = document.createElement("select");
    categorySelect.className = "post-modal-category-select";

    const emptyCat = document.createElement("option");
    emptyCat.value = "";
    emptyCat.textContent = "Категория";
    categorySelect.appendChild(emptyCat);

    categoryConfig.forEach((c) => {
        const opt = document.createElement("option");
        opt.value = c.name;
        opt.textContent = c.name;
        categorySelect.appendChild(opt);
    });

    const subcategorySelect = document.createElement("select");
    subcategorySelect.className = "post-modal-category-select";

    function fillSubcategories(categoryName, selectedValue) {
        subcategorySelect.innerHTML = "";
        const emptySub = document.createElement("option");
        emptySub.value = "";
        emptySub.textContent = "Подкатегория";
        subcategorySelect.appendChild(emptySub);

        const cat = categoryConfig.find(c => c.name === categoryName);
        const subs = cat && Array.isArray(cat.sub) ? cat.sub : [];
        subs.forEach((s) => {
            const opt = document.createElement("option");
            opt.value = s;
            opt.textContent = s;
            subcategorySelect.appendChild(opt);
        });

        if (selectedValue && subs.includes(selectedValue)) {
            subcategorySelect.value = selectedValue;
        } else {
            subcategorySelect.value = "";
        }

        subcategorySelect.style.display = subs.length ? "block" : "none";
    }

    categorySelect.value = oldCategory || "";
    fillSubcategories(oldCategory, oldSubcategory);

    categorySelect.addEventListener("change", () => {
        fillSubcategories(categorySelect.value, "");
    });

    categoryEditor.appendChild(categorySelect);
    categoryEditor.appendChild(subcategorySelect);

    if (categoryEl && categoryEl.parentNode) {
        categoryEl.parentNode.replaceChild(categoryEditor, categoryEl);
    } else {
        postDiv.appendChild(categoryEditor);
    }

    // Панель управления
    const editFooter = document.createElement("div");
    editFooter.classList.add("edit-footer");

    statusText = document.createElement("span");
    statusText.classList.add("edit-status");
    statusText.textContent = `${textarea.value.length}/${MAX_POST_LENGTH}`;

    const btnWrapper = document.createElement("div");
    btnWrapper.classList.add("edit-buttons");

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.classList.add("save-edit-btn", "post-action-btn");
    saveBtn.textContent = "Сохранить";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.classList.add("cancel-edit-btn", "post-action-btn");
    cancelBtn.textContent = "Отмена";

    btnWrapper.appendChild(saveBtn);
    btnWrapper.appendChild(cancelBtn);
    editFooter.appendChild(statusText);
    editFooter.appendChild(btnWrapper);

    postDiv.appendChild(editFooter);

    // Кнопки удаления картинок в режиме редактирования
    if (imagesBlock) {
        const wrappers = imagesBlock.querySelectorAll(".image-wrapper");

        wrappers.forEach((wrapper) => {
            if (wrapper.querySelector(".remove-image-btn")) return;

            const removeBtn = document.createElement("button");
            removeBtn.type = "button";
            removeBtn.className = "remove-image-btn";
            removeBtn.innerHTML = '<img src="/images/delete-bin-5-fill.svg" alt="Удалить">';

            removeBtn.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();

                if (!Array.isArray(post.images)) {
                    post.images = [];
                }

                const allWrappers = Array.from(imagesBlock.querySelectorAll(".image-wrapper"));
                const idx = allWrappers.indexOf(wrapper);

                if (idx >= 0 && idx < post.images.length) {
                    post.images.splice(idx, 1);
                }

                wrapper.remove();
            });

            wrapper.appendChild(removeBtn);
        });
    }

    // Вспомогательная функция выхода из режима редактирования
    function cleanup(newTitle, newText, newCategory, newSubcategory) {
        if (titleEl) {
            const newTitleEl = document.createElement("div");
            newTitleEl.className = "post-modal-title";
            newTitleEl.textContent = newTitle;
            titleWrap.wrapper.replaceWith(newTitleEl);
        }

        const newTextEl = document.createElement("p");
        newTextEl.classList.add("post-text");
        newTextEl.textContent = newText;
        textWrap.wrapper.replaceWith(newTextEl);

        const catText = newCategory
            ? (newSubcategory ? `Категория: ${newCategory}, ${newSubcategory}` : `Категория: ${newCategory}`)
            : "";
        if (catText) {
            const newCatEl = document.createElement("div");
            newCatEl.className = "post-modal-category";
            newCatEl.textContent = catText;
            categoryEditor.replaceWith(newCatEl);
        } else {
            categoryEditor.remove();
        }

        editFooter.remove();

        if (menuBtn) menuBtn.style.display = "";
        postDiv.classList.remove("editing");
        activeEditPostDiv = null;
        delete postDiv.__editHasChanges;
        delete postDiv.__editForceCancel;

        const removeBtns = postDiv.querySelectorAll(".remove-image-btn");
        removeBtns.forEach(btn => btn.remove());
    }

    // Проверка на наличие изменений
    function hasChanges() {
        const currentTitle = titleInput.value.trim();
        const currentText = textarea.value.trim();
        const titleChanged = currentTitle !== originalTitle.trim();
        const textChanged = currentText !== originalText.trim();
        const currentCategory = categorySelect.value.trim();
        const currentSubcategory = subcategorySelect.value.trim();
        const categoryChanged =
            currentCategory !== (oldCategory || "").trim() ||
            currentSubcategory !== (oldSubcategory || "").trim();

        const currentImages = Array.isArray(post.images) ? post.images : [];
        const imagesChanged =
            JSON.stringify(currentImages) !== JSON.stringify(originalImages);

        return titleChanged || textChanged || imagesChanged || categoryChanged;
    }

    // Отмена с подтверждением при наличии изменений
    function requestCancel(e) {
        if (e) e.preventDefault();

        if (hasChanges()) {
            // Если изменения были, показываем окно с подтверждением отмены изменений
            showConfirm({
                text: "Вы точно уверены, что хотите отменить изменения?",
                onYes: function () {
                    resetPost(); // Сбросить изменения
                },
                onNo: function () {
                    // Пользователь продолжает редактировать
                }
            });
        } else {
                    resetPost(); 
        }
    }

    // Функция для сброса поста в исходное состояние
    function resetPost() {
        // Восстановить текст и изображение в исходное состояние
        if (titleEl) {
            titleInput.value = originalTitle;
        } else {
            document.getElementById('postText').value = originalContent.text;
        }
        categorySelect.value = oldCategory || "";
        fillSubcategories(oldCategory, oldSubcategory);

        // Сбросить флаг изменений
        isPostChanged = false; // Переменная isPostChanged теперь определена и используется

        cleanup(originalTitle, originalText, oldCategory, oldSubcategory);
    }

    // Сохранение
    async function applyChanges() {
        const newTitle = titleInput.value.trim();
        const newText = textarea.value.trim();
        if (!newTitle) return;
        if (!newText) return;

        // Проверка, внес ли пользователь изменения
        if (!hasChanges()) {
            // Если изменений нет, показываем уведомление
            showEditWarningToast();
            return;
        }

        post.title = newTitle;
        post.text = newText;
        post.updatedAt = new Date().toISOString();  // Обновляем дату
        post.category = categorySelect.value || "";
        post.subcategory = subcategorySelect.value || "";

        const id = post.id || post.Id;
        if (id) {
            await apiUpdatePost(id, {
                authorId: post.authorId || post.AuthorId || "anonymous",
                authorName: post.authorName || post.AuthorName || "Unknown",
                title: post.title || post.Title || "",
                text: post.text || post.Text || "",
                category: post.category || post.Category || "",
                subcategory: post.subcategory || post.Subcategory || null,
                imagesJson: Array.isArray(post.images) && post.images.length
                    ? JSON.stringify(post.images)
                    : null
            });
        }

        const timeEl = postDiv.querySelector(".post-time");
        if (timeEl && typeof formatPostDate === "function") {
            timeEl.textContent = formatPostDate(post.updatedAt, true);
        }

        cleanup(newTitle, newText, post.category, post.subcategory);
    }

    // Обработчики кнопок
    saveBtn.addEventListener("click", (e) => {
        e.preventDefault();
        applyChanges();
    });

    cancelBtn.addEventListener("click", (e) => {
        requestCancel(e);
    });

    textarea.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            applyChanges();
        }
        if (e.key === "Escape") {
            requestCancel(e);
        }
    });

    postDiv.__editHasChanges = hasChanges;
    postDiv.__editForceCancel = resetPost;
}
