// Theme-based logo switching utility
function updateLogosForTheme() {
    const currentTheme = document.documentElement.getAttribute('data-bs-theme') || 'light';
    const logos = document.querySelectorAll('[data-light-logo][data-dark-logo]');
    
    logos.forEach(logo => {
        if (currentTheme === 'dark') {
            logo.src = logo.dataset.darkLogo;
        } else {
            logo.src = logo.dataset.lightLogo;
        }
    });
}

// Update logos when DOM is loaded
document.addEventListener('DOMContentLoaded', updateLogosForTheme);

// Update logos when theme changes (for auto theme)
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    if (savedTheme === 'auto') {
        // Theme might have changed, update logos
        setTimeout(updateLogosForTheme, 100);
    }
});