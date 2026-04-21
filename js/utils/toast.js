const TOAST_CONFIG = {
    success: { icon: 'bi-check-circle-fill', accent: 'text-success', title: 'Success' },
    error: { icon: 'bi-exclamation-triangle-fill', accent: 'text-danger', title: 'Error' },
    warning: { icon: 'bi-exclamation-circle-fill', accent: 'text-warning', title: 'Warning' },
    info: { icon: 'bi-info-circle-fill', accent: 'text-info', title: 'Info' },
};

function ensureContainer() {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container position-fixed top-0 end-0 p-3';
        container.style.zIndex = '1090';
        document.body.appendChild(container);
    }
    return container;
}

export function showToast(message, type = 'success', options = {}) {
    const cfg = TOAST_CONFIG[type] || TOAST_CONFIG.info;
    const title = options.title || cfg.title;
    const delay = options.delay ?? (type === 'error' ? 6000 : 3500);

    const container = ensureContainer();
    const toast = document.createElement('div');
    toast.className = 'toast border-0 shadow-sm';
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'polite');
    toast.setAttribute('aria-atomic', 'true');
    toast.innerHTML = `
        <div class="toast-header">
            <i class="bi ${cfg.icon} ${cfg.accent} me-2"></i>
            <strong class="me-auto">${title}</strong>
            <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
        <div class="toast-body">${message}</div>
    `;

    container.appendChild(toast);
    const bsToast = new bootstrap.Toast(toast, { delay });
    bsToast.show();
    toast.addEventListener('hidden.bs.toast', () => toast.remove());
    return bsToast;
}

// Also expose on window for non-module scripts
if (typeof window !== 'undefined') {
    window.showToast = showToast;
}
