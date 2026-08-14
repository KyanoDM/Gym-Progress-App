// Off-canvas sidebar behavior for mobile screens.
// Uses event delegation on document so it keeps working regardless of
// script load order or timing quirks on mobile browsers.
(function () {
    function getSideNav() {
        return document.getElementById('side-nav');
    }

    function closeSidebar() {
        const sideNav = getSideNav();
        if (!sideNav) return;
        sideNav.classList.remove('sidebar-open');
        document.querySelectorAll('.mobile-nav-toggle').forEach(btn => btn.setAttribute('aria-expanded', 'false'));
    }

    function openSidebar() {
        const sideNav = getSideNav();
        if (!sideNav) return;
        sideNav.classList.add('sidebar-open');
        document.querySelectorAll('.mobile-nav-toggle').forEach(btn => btn.setAttribute('aria-expanded', 'true'));
    }

    document.addEventListener('click', (event) => {
        const sideNav = getSideNav();
        if (!sideNav) return;

        if (event.target.closest('.mobile-nav-toggle')) {
            event.preventDefault();
            sideNav.classList.contains('sidebar-open') ? closeSidebar() : openSidebar();
            return;
        }

        if (event.target.closest('.sidebar-backdrop')) {
            closeSidebar();
            return;
        }

        if (event.target.closest('#side-nav > nav .nav-link')) {
            closeSidebar();
        }
    });

    window.addEventListener('resize', () => {
        if (window.innerWidth >= 992) closeSidebar();
    });
})();
