/*Кнопка возврата top сайта*/

const scrollBtn = document.getElementById('scrollBtn');

window.addEventListener('scroll', () => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;

    if (docHeight > 0 && scrollTop / docHeight >= 0.5) {
        scrollBtn.classList.add('show');
    } else {
        scrollBtn.classList.remove('show');
    }
});

scrollBtn.addEventListener('click', () => {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
});


//эффект скролл таймаут
function bindPressEffect(selector, activeClass = "fx-active", duration = 300) {
    const elements = document.querySelectorAll(selector);

    elements.forEach(el => {
        let timeoutId = null;

        const start = () => {
            el.classList.add(activeClass);

            if (timeoutId) clearTimeout(timeoutId);

            timeoutId = setTimeout(() => {
                el.classList.remove(activeClass);
                timeoutId = null;
            }, duration);
        };

        const stop = () => {
            el.classList.remove(activeClass);
        };

        // Мышь
        el.addEventListener("mousedown", start);
        el.addEventListener("mouseup", stop);
        el.addEventListener("mouseleave", stop);

        // Тач
        el.addEventListener("touchstart", start, { passive: true });
        el.addEventListener("touchend", stop);
        el.addEventListener("touchcancel", stop);
    });
}

bindPressEffect(".scroll-btn", "fx-active", 250);

bindPressEffect(".navButton-active", "fx-active", 5);
bindPressEffect(".navButton", "fx-active", 5);
bindPressEffect(".miniNavButton-active", "fx-active", 5);
bindPressEffect(".miniNavButton", "fx-active", 5);