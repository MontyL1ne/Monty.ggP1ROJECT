// preview.js — предпросмотр изображений при создании/редактировании поста
import { openFullscreen } from "./fullscreen.js";

// Коллбек, который задаётся снаружи (в postsMain.js)
let onImagesChanged = null;

/**
 * Позволяет внешнему коду подписаться на изменения списка картинок
 * @param {(selected: string[], existing: string[]) => void} handler
 */
export function setImagesChangeHandler(handler) {
    if (typeof handler === "function") {
        onImagesChanged = handler;
    } else {
        onImagesChanged = null;
    }
}

/**
 * Обновление предпросмотра картинок в форме создания / редактирования поста
 * @param {string[]} selectedImages - новые изображения, добавленные пользователем
 * @param {string[]} existingImages - уже существующие изображения (при редактировании поста)
 */
export function updatePreview(selectedImages = [], existingImages = []) {
    const previewContainer = document.getElementById("previewContainer");
    if (!previewContainer) return;

    previewContainer.innerHTML = "";

    // ВАЖНО: не создаём копии, работаем с самими массивами,
    // чтобы изменения отражались в postsMain.js
    const safeSelected = Array.isArray(selectedImages) ? selectedImages : [];
    const safeExisting = Array.isArray(existingImages) ? existingImages : [];

    const allImages = [...safeSelected, ...safeExisting];

    previewContainer.classList.add("preview-grid");

    /**
     * Создаёт одну квадратную миниатюру
     * @param {string} src - URL картинки
     * @param {number} globalIndex - индекс в общем массиве allImages (для fullscreen)
     * @param {() => void} onRemove - коллбек удаления
     */
    function createThumb(src, globalIndex, onRemove) {
        const wrapper = document.createElement("div");
        wrapper.classList.add("preview-thumb");

        const img = document.createElement("img");
        img.src = src;
        img.alt = "Предпросмотр изображения";

        // Открытие в fullscreen по клику
        img.addEventListener("click", (e) => {
            e.stopPropagation();
            if (allImages.length > 0) {
                openFullscreen(allImages, globalIndex);
            }
        });

        // Кнопка удаления
        const removeBtn = document.createElement("button");
        removeBtn.classList.add("remove-image-btn");

        const icon = document.createElement("img");
        icon.src = "/images/delete-bin-5-fill.svg";
        icon.alt = "Удалить";

        removeBtn.appendChild(icon);

        removeBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (typeof onRemove === "function") {
                onRemove();
            }
        });

        wrapper.appendChild(img);
        wrapper.appendChild(removeBtn);
        previewContainer.appendChild(wrapper);
    }

    // Новые изображения (selectedImages)
    safeSelected.forEach((src, index) => {
        const globalIndex = index;
        createThumb(src, globalIndex, () => {
            // удаляем из массива, который пришёл извне
            safeSelected.splice(index, 1);

            // уведомляем внешний код, что список изменился
            if (typeof onImagesChanged === "function") {
                onImagesChanged(safeSelected, safeExisting);
            } else {
                // fallback — просто перерисовать превью
                updatePreview(safeSelected, safeExisting);
            }
        });
    });

    // Существующие изображения (existingImages)
    safeExisting.forEach((src, index) => {
        const globalIndex = safeSelected.length + index;
        createThumb(src, globalIndex, () => {
            safeExisting.splice(index, 1);

            if (typeof onImagesChanged === "function") {
                onImagesChanged(safeSelected, safeExisting);
            } else {
                updatePreview(safeSelected, safeExisting);
            }
        });
    });
}
