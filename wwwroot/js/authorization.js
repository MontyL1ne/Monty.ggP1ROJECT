document.addEventListener('DOMContentLoaded', () => {
    
    const registerButton = document.getElementById('registerButton');
    const authorizationButton = document.getElementById('authorizationButton');

    const registrationModal = document.getElementById('registrationModal');
    const authorizationModal = document.getElementById('authorizationModal');

    const closeButton = document.getElementById('closeButton');
    const closeButton2 = document.getElementById('closeButton2');

    const registrationForm = document.getElementById('registrationForm');
    const authForm = document.getElementById('authorizationForm');

    const authStatus = document.getElementById('authStatus');
    const profileButton = document.getElementById('profileButton');

    // кнопки в authChoice
    const choiceRegister = document.getElementById('choiceRegister');
    const choiceLogin = document.getElementById('choiceLogin');
    const authChoice = document.getElementById('authChoice');

    // меню authChoice
    if (choiceRegister) {
        choiceRegister.addEventListener('click', () => {
            if (authChoice) authChoice.style.display = 'none';
            if (registrationModal) registrationModal.style.display = 'flex';
        });
    }

    if (choiceLogin) {
        choiceLogin.addEventListener('click', () => {
            if (authChoice) authChoice.style.display = 'none';
            if (authorizationModal) authorizationModal.style.display = 'flex';
        });
    }

    // закрытие окна выбора по клику по фону
    if (authChoice) {
        authChoice.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    //Генератор id для пользователей
    function getCurrentUser() {
        try {
            return JSON.parse(localStorage.getItem('currentUser'));
        } catch {
            return null;
        }
    }
    function getAdminId() {
        const raw = localStorage.getItem('adminUserId');
        if (!raw) return null;

        const n = Number(raw);
        return Number.isFinite(n) ? n : null;
    }

    function setAdminIdIfNeeded(user) {
        if (!user) return;
        if (!user.username) return;

        const adminId = getAdminId();

        if (adminId === null && user.username.toLowerCase() === 'montyline' && user.id != null) {
            localStorage.setItem('adminUserId', String(user.id));
        }
    }
    function setCurrentUser(user) {
        if (user) {
            localStorage.setItem('currentUser', JSON.stringify(user));
        } else {
            localStorage.removeItem('currentUser');
        }
        updateAuthStatus();
    }

    // UI состояние

    function updateAuthStatus() {
        const user = getCurrentUser();

        // Метка статуса, если есть
        if (authStatus) {
            if (user) {
                console.log("Вы вошли");
                authStatus.textContent = `Вы вошли как: ${user.username}${user.email ? ' (' + user.email + ')' : ''}`;
                authStatus.style.color = '#6bff80';
            } else {
                console.log("Вы не авторизованы");
                authStatus.textContent = 'Вы не авторизованы';
                authStatus.style.color = '#ffffff';
            }
        }

        // Кнопка "Вход"
        if (authorizationButton) {
            authorizationButton.disabled = !!user; // если вошёл — вход не нужен
        }

        // Кнопка "Регистрация" → "Выйти"
        if (registerButton) {
            if (user) {
                registerButton.textContent = 'Выйти';
                registerButton.onclick = () => {
                    setCurrentUser(null);
                    alert('Вы вышли из аккаунта.');
                    window.location.reload();
                };
            } else {
                registerButton.textContent = 'Регистрация';
                registerButton.onclick = () => {
            if (registrationModal) {
                registrationModal.style.display = 'flex';
            }
                };
            }
        }

        const postForm = document.getElementById('postForm');

        if (postForm) {
            postForm.style.display = user ? 'block' : 'none';
        }

        updatePostMenuButtons();
    }

    function updatePostMenuButtons() {
        const user = getCurrentUser();
        const currentId = user ? (user.email || user.username || "").toLowerCase() : "";
        const allMenuBtns = document.querySelectorAll('.menu-btn');
        allMenuBtns.forEach(btn => {
            const postEl = btn.closest('.post');
            const authorId = postEl ? (postEl.dataset.authorId || "").toLowerCase() : "";
            const canManage = currentId && authorId && currentId === authorId;
            btn.style.display = canManage ? 'block' : 'none';
        });
    }

    function updateNavbarHeightVar() {
        const nav = document.querySelector('.navBarMenu') || document.querySelector('nav');
        if (!nav) return;
        const h = Math.ceil(nav.getBoundingClientRect().height || 0);
        document.documentElement.style.setProperty('--navbar-h', `${h}px`);
    }

    // взаимодействием с меню авторизации

    if (closeButton && registrationModal) {
        closeButton.addEventListener('click', () => {
            registrationModal.style.display = 'none';
        });
    }

    if (closeButton2 && authorizationModal) {
        closeButton2.addEventListener('click', () => {
            authorizationModal.style.display = 'none';
        });
    }

    const backBtns = document.querySelectorAll('.auth-back-btn');
    backBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            if (registrationModal) registrationModal.style.display = 'none';
            if (authorizationModal) authorizationModal.style.display = 'none';
            if (authChoice) authChoice.style.display = 'flex';
        });
    });

    const authChoiceClose = document.querySelector('.auth-choice-close');
    if (authChoiceClose && authChoice) {
        authChoiceClose.addEventListener('click', () => {
            authChoice.style.display = 'none';
        });
    }

    window.addEventListener('click', (event) => {
        if (registrationModal && event.target === registrationModal) {
            return;
        }
        if (authorizationModal && event.target === authorizationModal) {
            return;
        }
    });

    if (authorizationButton && authorizationModal) {
        authorizationButton.addEventListener('click', () => {
            authorizationModal.style.display = 'flex';
        });
    }

    // регистрация

    if (registrationForm) {
        registrationForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const usernameInput = document.getElementById('regUsername');
            const emailInput = document.getElementById('regEmail');
            const passwordInput = document.getElementById('regPassword');

            if (!usernameInput || !emailInput || !passwordInput) {
                alert('Ошибка разметки: не найдены поля регистрации.');
                return;
            }

            const username = usernameInput.value.trim();
            const email = emailInput.value.trim();
            const password = passwordInput.value;

            if (!username || !email || !password) {
                alert('Заполните все поля.');
                return;
            }

            // можно добавить простую клиентскую валидацию
            if (password.length < 6) {
                alert('Пароль должен быть не короче 6 символов.');
                return;
            }

            try {
                // Запрос к серверному API
                const response = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        userName: username,
                        email: email,
                        password: password
                    })
                });

                const data = await response.json();

                if (!response.ok || !data.success) {
                    alert(data.message || 'Ошибка регистрации.');
                    return;
                }

                if (data.userName) {
                    localStorage.setItem('userName', data.userName);
                }
                if (data.userId) {
                    localStorage.setItem('userId', data.userId);
                }

                alert('Регистрация успешна! Теперь вы можете войти.');

                window.location.href = '/pages/Profile.html';
            } catch (err) {
                console.error(err);
                alert('Ошибка сети. Попробуйте ещё раз.');
            }
        });
    }


    // авторизация
    if (authForm) {
        authForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const usernameInput = document.getElementById('authUsername');
            const passwordInput = document.getElementById('authPassword');

            if (!usernameInput || !passwordInput) {
                alert('Ошибка разметки: не найдены поля авторизации.');
                return;
            }

            const username = usernameInput.value.trim();
            const password = passwordInput.value;

            if (!username || !password) {
                alert('Введите имя и пароль.');
                return;
            }

            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        userNameOrEmail: username,
                        password: password
                    })
                });

                const data = await response.json();

                if (!response.ok || !data.success) {
                    alert(data.message || 'Неверный логин/email или пароль.');
                    return;
                }

                // формируем currentUser под нашу структуру
                const loggedUser = {
                    id: data.userId,
                    username: data.userName || username,
                    email: null // при желании можно возвращать email с сервера и подставлять сюда
                };

                setAdminIdIfNeeded(loggedUser);
                setCurrentUser(loggedUser);

                alert(`Добро пожаловать, ${loggedUser.username}!`);

                if (authorizationModal) {
                    authorizationModal.style.display = 'none';
                }
                authForm.reset();
            } catch (err) {
                console.error(err);
                alert('Ошибка сети. Попробуйте ещё раз.');
            }
        });
    }

    // кнопка профиля в навбаре, проверка на авторизацию
    function isOpen(el) {
        return el && el.style.display !== 'none';
    }

    function openAuthChoiceMenu() {
        if (!authChoice) return;

        const modalRegOpen = isOpen(registrationModal);
        const modalAuthOpen = isOpen(authorizationModal);

        if (modalRegOpen || modalAuthOpen) {
            if (registrationModal) registrationModal.style.display = 'none';
            if (authorizationModal) authorizationModal.style.display = 'none';
        }

        authChoice.style.display = 'flex';
    }

    if (profileButton) {
        profileButton.addEventListener('click', (e) => {
            const user = getCurrentUser();

            if (user) {
                // уже авторизован — сразу в профиль
                window.location.href = '/pages/Profile.html';
                return;
            }

            // не авторизован
            e.preventDefault();

            openAuthChoiceMenu();
        });
    }

    function showAuthChoiceOnLoad() {
        const user = getCurrentUser();
        if (user) return;
        if (!authChoice) return;

        const path = (window.location.pathname || "").toLowerCase();
        const isIndex =
            path === "/" ||
            path.endsWith("/index.html") ||
            path.endsWith("/pages/index.html");
        if (isIndex) return;

        authChoice.style.display = 'flex';
    }

    const navMenu = document.querySelector('.navBarMenu');
    if (navMenu) {
        navMenu.addEventListener('click', (e) => {
            const user = getCurrentUser();
            if (user) return;

            const btn = e.target ? e.target.closest('button') : null;
            if (!btn || btn.disabled) return;

            const isNav =
                btn.classList.contains('navButton') ||
                btn.classList.contains('miniNavButton') ||
                btn.classList.contains('navButtonEdit');

            if (!isNav) return;

            e.preventDefault();
            e.stopPropagation();
            openAuthChoiceMenu();
        });
    }

    function extractNavUrl(el) {
        if (!el) return "";
        if (el.tagName === "A" && el.href) return el.href;
        const onClickAttr = el.getAttribute("onclick") || "";
        const match = onClickAttr.match(/location\.href\s*=\s*['"]([^'"]+)['"]/);
        if (match && match[1]) return match[1];
        return "";
    }

    document.addEventListener('click', (e) => {
        const user = getCurrentUser();
        if (user) return;

        const el = e.target ? e.target.closest('a, button') : null;
        if (!el) return;

        if (el.disabled) return;

        const href = el.tagName === "A" ? el.getAttribute("href") : "";
        const onClickUrl = extractNavUrl(el);
        const rawUrl = href || onClickUrl;
        if (!rawUrl || rawUrl === "#") return;

        const nextUrl = new URL(rawUrl, window.location.origin);
        if (nextUrl.href === window.location.href) return;
        const path = (nextUrl.pathname || "").toLowerCase();
        const isIndex =
            path === "/" ||
            path.endsWith("/index.html") ||
            path.endsWith("/pages/index.html");
        if (isIndex) return;

        e.preventDefault();
        e.stopPropagation();
        openAuthChoiceMenu();
    }, true);


    /* Хоткей */
    document.addEventListener('keydown', (e) => {
        const authChoice = document.getElementById('authChoice');
        if (authChoice && authChoice.style.display !== 'none') {
            if (e.key === 'Escape') {
                e.stopPropagation();
                e.preventDefault();
                authChoice.style.display = 'none';
            }
        }
    });

    window.getCurrentUser = getCurrentUser;
    window.setCurrentUser = setCurrentUser;

    updateAuthStatus();
    updateNavbarHeightVar();
    window.addEventListener('resize', updateNavbarHeightVar);
    showAuthChoiceOnLoad();

    const postsContainer = document.getElementById('postsContainer');
    if (postsContainer) {
        const obs = new MutationObserver(() => {
            updatePostMenuButtons();
        });
        obs.observe(postsContainer, { childList: true, subtree: true });
    }
});
