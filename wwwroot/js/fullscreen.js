let modalEl = null;
let contentEl = null;
let imgWrapperEl = null;
let modalImgEl = null;
let imgClipEl = null;
let leftBtnEl = null;
let rightBtnEl = null;
let closeBtnEl = null;
let dotsEl = null;
let navRowEl = null;
let lastNaturalW = 0;
let lastNaturalH = 0;

let currentImages = [];
let currentIndex = 0;
let keyHandlerBound = null;
let isImageFading = false;
let imageLoadSeq = 0;
let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;

// Зум-состояние
let isZoomed = false;
const ZOOM_SCALE = 2;
let lastTapTime = 0;  

// запоминаем старые значения overflow, чтобы корректно вернуть
let prevBodyOverflow = null;
let prevHtmlOverflow = null;

/*Блокировка / возврат скролла страницы*/
let pageScrollY = 0;
let pageScrollX = 0;
let isPageScrollLocked = false;

function disablePageScroll() {
    if (isPageScrollLocked) return;
    isPageScrollLocked = true;

    const body = document.body;
    const html = document.documentElement;


    pageScrollY = window.scrollY || window.pageYOffset || 0;
    pageScrollX = window.scrollX || window.pageXOffset || 0;

    body.style.position = "fixed";
    body.style.top = `-${pageScrollY}px`;
    body.style.left = `-${pageScrollX}px`;
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";
    html.style.overflow = "hidden";
}

function enablePageScroll() {
    if (!isPageScrollLocked) return;
    isPageScrollLocked = false;
    const body = document.body;

    body.style.position = "";
    body.style.top = "";
    body.style.left = "";
    body.style.right = "";
    body.style.width = "";
    body.style.overflow = "";

    html.style.overflow = "";

    window.scrollTo(pageScrollX, pageScrollY);
}

function resetZoom() {
    isZoomed = false;
    if (modalImgEl) {
        modalImgEl.style.transform = "scale(1)";
    }
}

// включить/выключить зум
function toggleZoom() {
    if (!modalImgEl) return;

    if (!isZoomed) {
        modalImgEl.style.transform = `scale(${ZOOM_SCALE})`;
        isZoomed = true;
    } else {
        modalImgEl.style.transform = "scale(1)";
        isZoomed = false;
    }
}

// обработка двойного тапа на мобильных
function handleTouchZoom(e) {
    const now = Date.now();

    // второй тап в течение 300мс — считаем двойным
    if (now - lastTapTime < 300) {
        e.preventDefault();
        e.stopPropagation();
        toggleZoom();
        lastTapTime = 0;
    } else {
        lastTapTime = now;
    }
}


/**
 * Создаёт (или находит, если уже есть) модальное окно и элементы управления
 */
function ensureModal() {
    if (modalEl && modalImgEl && contentEl) {
        return;
    }

    // Пытаемся использовать существующую разметку, если она есть
    modalEl = document.getElementById("fullscreenModal");
    modalImgEl = document.getElementById("fullscreenImage");

    if (!modalEl) {
        modalEl = document.createElement("div");
        modalEl.id = "fullscreenModal";
        document.body.appendChild(modalEl);
    }

    // Базовые стили модалки
    Object.assign(modalEl.style, {
        position: "fixed",
        inset: "0",
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(0, 0, 0, 0.55)",
        backdropFilter: "blur(10px)",
        display: "none",
        justifyContent: "center",
        alignItems: "center",
        zIndex: "9999",
        opacity: "0",
        transition: "opacity 0.2s ease-out"
    });

    // Контейнер для контента (картинка + стрелки)
    contentEl = document.createElement("div");
    Object.assign(contentEl.style, {
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "12px",
        maxWidth: "100vw",
        padding: "0 16px",
        boxSizing: "border-box",
        opacity: "0",
        transform: "translateY(10px)",
        transition: "opacity 0.2s ease-out, transform 0.2s ease-out" // 🔹 плавный подъём
    });

    // Обёртка для изображения
    imgWrapperEl = document.createElement("div");
    Object.assign(imgWrapperEl.style, {
        position: "relative",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        maxWidth: "90vw",
        maxHeight: "80vh",
        overflow: "visible",
    });

    // Сам IMG — если не существует, создаём
    if (!modalImgEl) {
        modalImgEl = document.createElement("img");
        modalImgEl.id = "fullscreenImage";
    }

    // Внутренний контейнер для обрезки и рамки
    imgClipEl = document.createElement("div");
    Object.assign(imgClipEl.style, {
        position: "relative",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        width: "100%",
        height: "100%",
        borderRadius: "10px",
        border: "1px solid rgba(255,255,255,0.2)",
        boxShadow: "0 0 15px rgba(0,0,0,0.9)",
        overflow: "hidden",
    });

    Object.assign(modalImgEl.style, {
        maxWidth: "100%",
        maxHeight: "100%",
        width: "100%",
        height: "100%",
        objectFit: "contain",
        display: "block",
        opacity: "1",
        transition: "opacity 0.18s ease-out, transform 0.2s ease-out", // 👈 fade + зум
});

    imgClipEl.appendChild(modalImgEl);
    imgWrapperEl.appendChild(imgClipEl);

    // Точки-индикаторы (над фото)
    dotsEl = document.createElement("div");
    Object.assign(dotsEl.style, {
        position: "absolute",
        top: "-26px",
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        gap: "8px",
        alignItems: "center",
        justifyContent: "center",
        zIndex: "10001",
        pointerEvents: "none",
    });
    imgWrapperEl.appendChild(dotsEl);

    // Кнопка закрытия (вверху справа, вне контента)
    closeBtnEl = createRoundButton("/images/fullscreen-exit-fill.svg");

    // Левая и правая кнопки — по бокам от картинки
    leftBtnEl = createRoundButton("/images/arrow-left-line.svg");
    rightBtnEl = createRoundButton("/images/arrow-right-line.svg");

    // Ряд навигации (для мобилок — под фото)
    navRowEl = document.createElement("div");
    Object.assign(navRowEl.style, {
        display: "none",
        alignItems: "center",
        justifyContent: "center",
        gap: "16px",
        marginTop: "12px",
    });
    navRowEl.appendChild(leftBtnEl);
    navRowEl.appendChild(rightBtnEl);

    Object.assign(leftBtnEl.style, {
        position: "relative",
    });
    Object.assign(rightBtnEl.style, {
        position: "relative",
    });

    // Собираем структуру
    contentEl.appendChild(leftBtnEl);
    contentEl.appendChild(imgWrapperEl);
    contentEl.appendChild(rightBtnEl);

    // Очищаем модалку и вставляем всё заново, чтобы не было дублей
    modalEl.innerHTML = "";
    modalEl.appendChild(contentEl);
    modalEl.appendChild(closeBtnEl);

    // Клик по фону — закрыть (но не по контенту)
    modalEl.addEventListener("click", (e) => {
        if (e.target === modalEl) {
            closeFullscreen();
        }
    });

    // Кнопка закрытия
    closeBtnEl.addEventListener("click", (e) => {
        e.stopPropagation();
        closeFullscreen();
    });

    // Кнопки влево/вправо
    leftBtnEl.addEventListener("click", (e) => {
        e.stopPropagation();
        showImage(currentIndex - 1);
    });

    rightBtnEl.addEventListener("click", (e) => {
        e.stopPropagation();
        showImage(currentIndex + 1);
    });

    // Адаптация под мобильные (подстройка размеров)
    function applyResponsiveLayout() {
        const isMobile = window.innerWidth <= 768;

        if (isMobile) {
            // Картинка
            imgWrapperEl.style.maxWidth = "90vw";
            imgWrapperEl.style.maxHeight = "60vh";
            if (dotsEl) dotsEl.style.top = "-20px";

            contentEl.style.gap = "8px";
            contentEl.style.padding = "0 8px";
            contentEl.style.flexDirection = "column";

            // Стрелки под фото
            if (navRowEl) {
                navRowEl.style.display = "flex";
                if (!navRowEl.contains(leftBtnEl)) navRowEl.appendChild(leftBtnEl);
                if (!navRowEl.contains(rightBtnEl)) navRowEl.appendChild(rightBtnEl);
                if (!contentEl.contains(navRowEl)) contentEl.appendChild(navRowEl);
            }

            Object.assign(leftBtnEl.style, {
                position: "relative",
                left: "0",
                top: "0",
                transform: "none",
            });

            Object.assign(rightBtnEl.style, {
                position: "relative",
                right: "0",
                top: "0",
                transform: "none",
            });

            Object.assign(closeBtnEl.style, {
                position: "fixed",
                top: "18px",
                right: "18px",
                left: "auto",
                bottom: "auto",
                transform: "none",
            });
        } else {
            // Десктоп — картинка больше
            imgWrapperEl.style.maxWidth = "90vw";
            imgWrapperEl.style.maxHeight = "80vh";
            if (dotsEl) dotsEl.style.top = "-26px";

            contentEl.style.gap = "16px";
            contentEl.style.padding = "0 16px";
            contentEl.style.flexDirection = "row";

            // Стрелки возвращаем к контенту
            Object.assign(leftBtnEl.style, {
                position: "relative",
                left: "0",
                top: "0",
                transform: "none",
            });

            Object.assign(rightBtnEl.style, {
                position: "relative",
                right: "0",
                top: "0",
                transform: "none",
            });

            if (navRowEl) {
                navRowEl.style.display = "none";
                if (contentEl.contains(navRowEl)) {
                    contentEl.removeChild(navRowEl);
                }
            }
            if (!contentEl.contains(leftBtnEl)) contentEl.insertBefore(leftBtnEl, imgWrapperEl);
            if (!contentEl.contains(rightBtnEl)) contentEl.appendChild(rightBtnEl);

            // 🔹 Кнопка закрытия — классика: правый верхний угол
            Object.assign(closeBtnEl.style, {
                position: "fixed",
                top: "18px",
                right: "18px",
                left: "auto",
                bottom: "auto",
                transform: "none",
            });
        }
    }

    modalImgEl.addEventListener("dblclick", (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleZoom();
    });
    modalImgEl.addEventListener("touchend", handleTouchZoom);
    if (window.innerWidth <= 768) {
        imgWrapperEl.addEventListener("touchstart", handleSwipeStart, { passive: true });
        imgWrapperEl.addEventListener("touchend", handleSwipeEnd, { passive: true });
    }

    applyResponsiveLayout();
    window.addEventListener("resize", applyResponsiveLayout);


    applyResponsiveLayout();
    window.addEventListener("resize", applyResponsiveLayout);
    window.addEventListener("resize", () => {
        if (lastNaturalW > 0 && lastNaturalH > 0) {
            updateImageSize(lastNaturalW, lastNaturalH);
        }
    });
}

/**
 * Создание круглой кнопки в стиле сайта
 */
function createRoundButton(iconSrc) {
    const btn = document.createElement("button");

    Object.assign(btn.style, {
        width: "50px",
        height: "50px",
        borderRadius: "999px",
        border: "1px solid #0000004b",
        background: "rgba(0, 0, 0, 0.35)",
        backdropFilter: "blur(10px)",
        boxShadow: "0 0 15px rgba(0,0,0,0.7)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        cursor: "pointer",
        zIndex: "10000",
        transition: "all 0.25s ease",
        overflow: "visible",
        padding: "0",
        outline: "none",
    });

    const before = document.createElement("div");
    Object.assign(before.style, {
        position: "absolute",
        top: "50%",
        left: "50%",
        width: "56px",
        height: "56px",
        borderRadius: "999px",
        background: "linear-gradient(45deg, rgba(95,95,95,0.3), rgba(0,0,0,0.5))",
        transform: "translate(-50%, -50%) scale(0)",
        opacity: "0.5",
        transition: "transform 0.3s ease",
        zIndex: "0",
        pointerEvents: "none",
    });

    const icon = document.createElement("img");
    icon.src = iconSrc;
    Object.assign(icon.style, {
        width: "22px",
        height: "22px",
        zIndex: "2",
        transition: "transform 0.3s ease",
    });

    btn.addEventListener("mouseenter", () => {
        before.style.transform = "translate(-50%, -50%) scale(1)";
        btn.style.background = "rgba(41, 41, 41, 0.8)";
        icon.style.transform = "scale(1.1)";
    });

    btn.addEventListener("mouseleave", () => {
        before.style.transform = "translate(-50%, -50%) scale(0)";
        btn.style.background = "rgba(0, 0, 0, 0.35)";
        icon.style.transform = "scale(1)";
    });

    btn.appendChild(before);
    btn.appendChild(icon);

    return btn;
}

function updateNavButtonsVisibility() {
    if (!leftBtnEl || !rightBtnEl) return;
    const hasMany = Array.isArray(currentImages) && currentImages.length > 1;
    const showLeft = hasMany && currentIndex > 0;
    const showRight = hasMany && currentIndex < currentImages.length - 1;

    leftBtnEl.style.opacity = showLeft ? "1" : "0";
    leftBtnEl.style.pointerEvents = showLeft ? "auto" : "none";
    rightBtnEl.style.opacity = showRight ? "1" : "0";
    rightBtnEl.style.pointerEvents = showRight ? "auto" : "none";
}

function updateDots() {
    if (!dotsEl) return;
    const count = Array.isArray(currentImages) ? currentImages.length : 0;
    if (count <= 1) {
        dotsEl.innerHTML = "";
        return;
    }

    const applyDotState = (dot, isActive) => {
        dot.style.opacity = isActive ? "1" : "0.6";
        dot.style.transform = isActive ? "scale(1.2)" : "scale(1)";
        dot.style.background = isActive ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.45)";
        dot.style.boxShadow = isActive ? "0 0 8px rgba(255,255,255,0.6)" : "none";
    };

    if (dotsEl.children.length !== count) {
        dotsEl.innerHTML = "";
        for (let i = 0; i < count; i++) {
            const dot = document.createElement("span");
            Object.assign(dot.style, {
                width: "8px",
                height: "8px",
                borderRadius: "999px",
                transition: "transform 0.2s ease, opacity 0.2s ease, background 0.2s ease, box-shadow 0.2s ease",
            });
            dotsEl.appendChild(dot);
        }
    }

    for (let i = 0; i < count; i++) {
        const dot = dotsEl.children[i];
        applyDotState(dot, i === currentIndex);
    }
}

function updateImageSize(naturalW, naturalH) {
    if (!imgWrapperEl || !modalImgEl) return;
    const isMobile = window.innerWidth <= 768;
    const maxW = (isMobile ? 0.9 : 0.9) * window.innerWidth;
    const maxH = (isMobile ? 0.6 : 0.8) * window.innerHeight;

    const scale = Math.min(
        maxW / naturalW,
        maxH / naturalH,
        1
    );

    const targetW = Math.round(naturalW * scale);
    const targetH = Math.round(naturalH * scale);

    imgWrapperEl.style.width = `${targetW}px`;
    imgWrapperEl.style.height = `${targetH}px`;
    modalImgEl.style.width = "100%";
    modalImgEl.style.height = "100%";
}

function handleSwipeStart(e) {
    if (isZoomed) return;
    const t = e.changedTouches && e.changedTouches[0];
    if (!t) return;
    touchStartX = t.clientX;
    touchStartY = t.clientY;
    touchStartTime = Date.now();
}

function handleSwipeEnd(e) {
    if (isZoomed) return;
    const t = e.changedTouches && e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    const dt = Date.now() - touchStartTime;

    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    const minDist = 40;
    const maxTime = 800;
    if (dt > maxTime) return;
    if (absX < minDist || absX < absY * 1.2) return;

    if (dx < 0) {
        showImage(currentIndex + 1);
    } else {
        showImage(currentIndex - 1);
    }
}

/**
 * Показать картинку с индексом i
 */
function showImage(i) {
    if (!currentImages || currentImages.length === 0) return;
    if (!modalImgEl) return;

    resetZoom();

    currentIndex = Math.max(0, Math.min(i, currentImages.length - 1));
    const src = currentImages[currentIndex];
    const loadSeq = ++imageLoadSeq;

    // обновляем стрелки сразу, до загрузки изображения (убираем "мигание")
    updateNavButtonsVisibility();
    updateDots();

    // временно скрываем картинку
    modalImgEl.style.opacity = "0";

    if (!modalImgEl.style.transition) {
        modalImgEl.style.transition = "opacity 0.18s ease-out";
    }

    // предзагрузка в отдельный объект, чтобы получить натуральные размеры
    const tmp = new Image();

    tmp.onload = () => {
        if (loadSeq !== imageLoadSeq) return;
        const naturalW = tmp.naturalWidth || 1;
        const naturalH = tmp.naturalHeight || 1;
        lastNaturalW = naturalW;
        lastNaturalH = naturalH;

        // задаём финальный размер ДО того, как покажем картинку
        updateImageSize(naturalW, naturalH);

        // теперь меняем src уже у видимого img
        modalImgEl.src = src;

        // и плавно показываем
        requestAnimationFrame(() => {
            if (loadSeq !== imageLoadSeq) return;
            modalImgEl.style.opacity = "1";
        });

        // обновляем стрелки
        updateNavButtonsVisibility();
        updateDots();
    };

    // запускаем загрузку
    tmp.src = src;
}

/**
 * Обработчик клавиш (Esc, стрелки)
 */
function keyHandler(e) {
    if (!modalEl || modalEl.style.display === "none") return;

    if (e.key === "Escape") {
        e.preventDefault();
        closeFullscreen();
    } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        showImage(currentIndex - 1);
    } else if (e.key === "ArrowRight") {
        e.preventDefault();
        showImage(currentIndex + 1);
    }
}

/**
 * Открыть полноэкранный просмотр
 * @param {string[]} images - массив URL-ов
 * @param {number} startIndex - индекс стартового изображения
 */
export function openFullscreen(images, startIndex = 0) {
    if (!Array.isArray(images) || images.length === 0) return;

    currentImages = images.slice();
    currentIndex = Math.max(0, Math.min(startIndex, currentImages.length - 1));

    ensureModal();
    if (!modalEl || !modalImgEl || !contentEl) return;

    disablePageScroll(); 

    modalEl.style.display = "flex";
    modalEl.style.opacity = "0";
    contentEl.style.opacity = "0";
    contentEl.style.transform = "translateY(10px)";

    showImage(currentIndex);

    // даём браузеру кадр, затем плавно проявляем
    requestAnimationFrame(() => {
        modalEl.style.opacity = "1";
        contentEl.style.opacity = "1";
        contentEl.style.transform = "translateY(0)";
    });
    // keydown навешиваем один раз
    if (!keyHandlerBound) {
        keyHandlerBound = keyHandler.bind(null);
        document.addEventListener("keydown", keyHandlerBound);
    }
}

/**
 * Закрыть полноэкранный просмотр
 */
export function closeFullscreen() {
    if (!modalEl || !contentEl) {
        enablePageScroll();
        currentImages = [];
        currentIndex = 0;
        return;
    }

    modalEl.style.opacity = "0";
    contentEl.style.opacity = "0";
    contentEl.style.transform = "translateY(10px)";

    setTimeout(() => {
        if (modalEl) {
            modalEl.style.display = "none";
        }

        enablePageScroll();

        currentImages = [];
        currentIndex = 0;
        resetZoom();

        if (keyHandlerBound) {
            document.removeEventListener("keydown", keyHandlerBound);
            keyHandlerBound = null;
        }
        document.dispatchEvent(new CustomEvent("fullscreen:closed"));
    }, 200);
}
