// Off-canvas sidebar behavior for mobile screens
document.addEventListener('DOMContentLoaded', () => {
    const sideNav = document.getElementById('side-nav');
    if (!sideNav) return;

    const toggleBtns = document.querySelectorAll('.mobile-nav-toggle');
    const backdrop = sideNav.querySelector('.sidebar-backdrop');

    function closeSidebar() {
        sideNav.classList.remove('sidebar-open');
        toggleBtns.forEach(btn => btn.setAttribute('aria-expanded', 'false'));
    }

    function openSidebar() {
        sideNav.classList.add('sidebar-open');
        toggleBtns.forEach(btn => btn.setAttribute('aria-expanded', 'true'));
    }

    toggleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            sideNav.classList.contains('sidebar-open') ? closeSidebar() : openSidebar();
        });
    });

    if (backdrop) {
        backdrop.addEventListener('click', closeSidebar);
    }

    sideNav.querySelectorAll('nav .nav-link').forEach(link => {
        link.addEventListener('click', closeSidebar);
    });

    window.addEventListener('resize', () => {
        if (window.innerWidth >= 992) closeSidebar();
    });
});
