// Modern Toast Notification System
class ToastNotification {
    constructor() {
        this.container = this.createContainer();
        this.toasts = [];
    }

    createContainer() {
        let container = document.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
        }
        return container;
    }

    getIcon(type) {
        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };
        return icons[type] || icons.info;
    }

    getTitle(type) {
        const titles = {
            success: 'Success',
            error: 'Error',
            warning: 'Warning',
            info: 'Information'
        };
        return titles[type] || titles.info;
    }

    show(message, type = 'info', duration = 6000) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        const icon = this.getIcon(type);
        const title = this.getTitle(type);

        toast.innerHTML = `
            <div class="toast-icon">${icon}</div>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close" aria-label="Close">×</button>
            <div class="toast-progress"></div>
        `;

        // Close button functionality
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => this.remove(toast));

        // Add to container
        this.container.appendChild(toast);
        this.toasts.push(toast);

        // Auto remove after duration
        const timeout = setTimeout(() => {
            this.remove(toast);
        }, duration);

        // Store timeout for manual removal
        toast.dataset.timeout = timeout;

        // Pause progress on hover
        toast.addEventListener('mouseenter', () => {
            const progress = toast.querySelector('.toast-progress');
            if (progress) {
                progress.style.animationPlayState = 'paused';
            }
            clearTimeout(timeout);
        });

        toast.addEventListener('mouseleave', () => {
            const progress = toast.querySelector('.toast-progress');
            if (progress) {
                progress.style.animationPlayState = 'running';
            }
            const newTimeout = setTimeout(() => {
                this.remove(toast);
            }, 2000);
            toast.dataset.timeout = newTimeout;
        });

        return toast;
    }

    remove(toast) {
        if (!toast || !toast.parentNode) return;

        // Clear timeout
        if (toast.dataset.timeout) {
            clearTimeout(parseInt(toast.dataset.timeout));
        }

        // Add removing class for exit animation
        toast.classList.add('removing');

        // Remove from array and DOM after animation
        setTimeout(() => {
            const index = this.toasts.indexOf(toast);
            if (index > -1) {
                this.toasts.splice(index, 1);
            }
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }

    clear() {
        this.toasts.forEach(toast => this.remove(toast));
    }
}

// Initialize toast system
const toastSystem = new ToastNotification();

// Replace the old showAlert function
function showAlert(message, type = 'info') {
    // Hide validation warning if showing
    hideValidationWarning();

    // Show toast notification
    toastSystem.show(message, type);
}

// Add hideAlerts function for compatibility
function hideAlerts() {
    toastSystem.clear();
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ToastNotification, showAlert, hideAlerts };
}