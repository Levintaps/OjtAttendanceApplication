// Modern Toast Notification System
class ToastNotification {
    constructor() {
        this.container = this.createContainer();
        this.toasts = [];
        this.recentMessages = new Map(); // Track recent messages to prevent duplicates
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
            success: '✔',
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

    isDuplicate(message, type) {
        const key = `${type}:${message}`;
        const now = Date.now();

        // Check if this exact message was shown in the last 2 seconds
        if (this.recentMessages.has(key)) {
            const lastShown = this.recentMessages.get(key);
            if (now - lastShown < 2000) {
                return true; // It's a duplicate
            }
        }

        // Update the timestamp for this message
        this.recentMessages.set(key, now);

        // Clean up old entries (older than 5 seconds)
        for (const [msgKey, timestamp] of this.recentMessages.entries()) {
            if (now - timestamp > 5000) {
                this.recentMessages.delete(msgKey);
            }
        }

        return false;
    }

    show(message, type = 'info', duration = 6000) {
        // Prevent duplicate toasts
        if (this.isDuplicate(message, type)) {
            console.log('Duplicate toast prevented:', message);
            return null;
        }

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

        // Trigger reflow for animation
        toast.offsetHeight;

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
    if (typeof hideValidationWarning === 'function') {
        hideValidationWarning();
    }

    // Show toast notification (with duplicate prevention)
    toastSystem.show(message, type);
}

// Add hideAlerts function for compatibility
function hideAlerts() {
    toastSystem.clear();
}

// Add helper function to hide any validation warnings
function hideValidationWarning() {
    const warnings = document.querySelectorAll('.alert-warning, .validation-message');
    warnings.forEach(warning => {
        if (warning.style) {
            warning.style.display = 'none';
        }
    });
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ToastNotification, showAlert, hideAlerts, hideValidationWarning };
}