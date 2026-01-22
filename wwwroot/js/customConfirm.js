// customConfirm.js — динамическое модальное окно подтверждения

let confirmModal = null;
let confirmTextEl = null;
let confirmYesBtn = null;
let confirmNoBtn = null;


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

function ensureModalCreated() {
    if (confirmModal) return;

    const modal = document.createElement("div");
    modal.id = "cancelModal";
    modal.className = "cancel-modal";
    modal.style.display = "none";

    const windowEl = document.createElement("div");
    windowEl.className = "cancel-modal-window";

    const textEl = document.createElement("p");
    textEl.className = "cancel-modal-text";
    textEl.textContent = "Вы уверены?";

    const btns = document.createElement("div");
    btns.className = "cancel-modal-buttons";

    const yesBtn = document.createElement("button");
    yesBtn.id = "cancelModalYes";
    yesBtn.className = "modal-btn modal-yes";
    const yesIcon = document.createElement("img");
    yesIcon.src = "/images/check-line.svg";
    yesIcon.alt = "Да";
    yesBtn.appendChild(yesIcon);

    const noBtn = document.createElement("button");
    noBtn.id = "cancelModalNo";
    noBtn.className = "modal-btn modal-no";
    const noIcon = document.createElement("img");
    noIcon.src = "/images/close-line.svg";
    noIcon.alt = "Нет";
    noBtn.appendChild(noIcon);

    btns.appendChild(yesBtn);
    btns.appendChild(noBtn);

    windowEl.appendChild(textEl);
    windowEl.appendChild(btns);
    modal.appendChild(windowEl);

    document.body.appendChild(modal);

    confirmModal = modal;
    confirmTextEl = textEl;
    confirmYesBtn = yesBtn;
    confirmNoBtn = noBtn;
}

/**
 * Универсальное модальное окно подтверждения
 * @param {Object} options
 * @param {string} options.text - текст вопроса
 * @param {Function} options.onYes - коллбек при подтверждении
 * @param {Function} options.onNo - коллбек при отмене
 */
export function showConfirm({
    text = "Вы уверены?",
    onYes = null,
    onNo = null
} = {}) {
    ensureModalCreated();

    const modal = confirmModal;
    const textEl = confirmTextEl;
    const yesBtn = confirmYesBtn;
    const noBtn = confirmNoBtn;

    if (!modal || !textEl || !yesBtn || !noBtn) return;

    textEl.textContent = text;

    const handleYes = (e) => {
        e.preventDefault();
        cleanup();
        if (typeof onYes === "function") onYes();
    };

    const handleNo = (e) => {
        e.preventDefault();
        cleanup();
        if (typeof onNo === "function") onNo();
    };

    const handleKey = (e) => {
        if (e.key === "Escape") {
            e.preventDefault();
            cleanup();
            if (typeof onNo === "function") onNo();
        }
    };

    const handleBackdrop = (e) => {
        if (e.target === modal) {
            cleanup();
            if (typeof onNo === "function") onNo();
        }
    };

    function cleanup() {
        modal.style.display = "none";
        yesBtn.removeEventListener("click", handleYes);
        noBtn.removeEventListener("click", handleNo);
        document.removeEventListener("keydown", handleKey);
        modal.removeEventListener("click", handleBackdrop);
    }

    yesBtn.addEventListener("click", handleYes);
    noBtn.addEventListener("click", handleNo);
    document.addEventListener("keydown", handleKey);
    modal.addEventListener("click", handleBackdrop);

    modal.style.display = "flex";
}
