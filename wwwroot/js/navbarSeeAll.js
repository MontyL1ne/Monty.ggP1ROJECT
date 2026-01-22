
document.addEventListener("DOMContentLoaded", () => {
    const navButtons5 = document.getElementById("navButtons5");
    const navBarSeeAll2 = document.getElementById("navBarSeeAll2");

    if (!navButtons5 || !navBarSeeAll2) return;

    let isVisible = false;

    const icons = [
        "/images/play-square-fill.svg",
        "/images/play-square-fill2.svg"
    ];

    // по умолчанию скрыто
    navBarSeeAll2.style.display = "none";

    // иконка у круглой кнопки
    navButtons5.style.backgroundImage = `url('${icons[0]}')`;
    navButtons5.style.backgroundRepeat = "no-repeat";
    navButtons5.style.backgroundSize = "contain";

    // клик по кнопке — показать/спрятать меню
    navButtons5.addEventListener("click", (e) => {
        e.stopPropagation();
        isVisible = !isVisible;

        navBarSeeAll2.style.display = isVisible ? "flex" : "none";
        navButtons5.style.backgroundImage = isVisible
            ? `url('${icons[1]}')`
            : `url('${icons[0]}')`;
    });

    // клик вне меню — спрятать его
    window.addEventListener("click", (event) => {
        if (
            isVisible &&
            event.target !== navButtons5 &&
            !navBarSeeAll2.contains(event.target)
        ) {
            isVisible = false;
            navBarSeeAll2.style.display = "none";
            navButtons5.style.backgroundImage = `url('${icons[0]}')`;
        }
    });
});
