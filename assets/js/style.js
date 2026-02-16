/**
 * PARKOREEN - Style Utilities
 * UI theming and visual helpers
 */

// ============================================
// THEME MANAGER
// ============================================
class ThemeManager {
    constructor() {
        this.currentTheme = 'dark';
    }

    /**
     * Initialize theme from storage
     */
    init() {
        const savedTheme = localStorage.getItem('parkoreen_theme');
        if (savedTheme) {
            this.setTheme(savedTheme);
        }
    }

    /**
     * Set theme
     * @param {string} theme - Theme name ('dark' or 'light')
     */
    setTheme(theme) {
        this.currentTheme = theme;
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('parkoreen_theme', theme);
    }

    /**
     * Toggle between themes
     */
    toggle() {
        this.setTheme(this.currentTheme === 'dark' ? 'light' : 'dark');
    }
}

// ============================================
// MODAL MANAGER
// ============================================
class ModalManager {
    constructor() {
        this.activeModal = null;
        this.createContainer();
    }

    createContainer() {
        if (document.getElementById('modal-container')) return;
        
        const container = document.createElement('div');
        container.id = 'modal-container';
        document.body.appendChild(container);
    }

    /**
     * Show a modal dialog
     * @param {Object} options - Modal options
     * @returns {Promise} Resolves with result on close
     */
    show(options) {
        return new Promise((resolve) => {
            const {
                title = '',
                text = '',
                html = null,
                buttons = [{ text: 'OK', value: true, primary: true }],
                closable = true
            } = options;

            const overlay = document.createElement('div');
            overlay.className = 'modal-overlay active';
            overlay.innerHTML = `
                <div class="modal">
                    ${title ? `<h2 class="modal-title">${title}</h2>` : ''}
                    ${text ? `<p class="modal-text">${text}</p>` : ''}
                    ${html ? `<div class="modal-content">${html}</div>` : ''}
                    <div class="modal-actions">
                        ${buttons.map((btn, i) => `
                            <button class="btn ${btn.primary ? 'btn-primary' : btn.danger ? 'btn-danger' : 'btn-secondary'}" 
                                    data-value="${btn.value !== undefined ? btn.value : i}">
                                ${btn.text}
                            </button>
                        `).join('')}
                    </div>
                </div>
            `;

            // Close on overlay click
            if (closable) {
                overlay.addEventListener('click', (e) => {
                    if (e.target === overlay) {
                        this.close(overlay, resolve, null);
                    }
                });
            }

            // Button clicks
            overlay.querySelectorAll('.modal-actions .btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const value = btn.dataset.value;
                    this.close(overlay, resolve, value === 'true' ? true : value === 'false' ? false : value);
                });
            });

            // ESC key
            const handleEsc = (e) => {
                if (e.key === 'Escape' && closable) {
                    document.removeEventListener('keydown', handleEsc);
                    this.close(overlay, resolve, null);
                }
            };
            document.addEventListener('keydown', handleEsc);

            document.getElementById('modal-container').appendChild(overlay);
            this.activeModal = overlay;
        });
    }

    /**
     * Show confirmation dialog
     * @param {string} title - Title text
     * @param {string} text - Message text
     * @returns {Promise<boolean>} Resolves with true/false
     */
    confirm(title, text) {
        return this.show({
            title,
            text,
            buttons: [
                { text: 'Cancel', value: false },
                { text: 'Confirm', value: true, primary: true }
            ]
        });
    }

    /**
     * Show alert dialog
     * @param {string} title - Title text
     * @param {string} text - Message text
     * @returns {Promise} Resolves when closed
     */
    alert(title, text) {
        return this.show({
            title,
            text,
            buttons: [{ text: 'OK', value: true, primary: true }]
        });
    }

    /**
     * Show prompt dialog
     * @param {string} title - Title text
     * @param {string} message - Message to display above input
     * @param {string} defaultValue - Default input value
     * @returns {Promise<string|null>} Resolves with input value or null
     */
    prompt(title, message = '', defaultValue = '') {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'modal-overlay active';
            overlay.innerHTML = `
                <div class="modal">
                    <h2 class="modal-title">${title}</h2>
                    ${message ? `<p class="modal-message" style="margin-bottom: 12px; color: #ccc;">${message}</p>` : ''}
                    <div class="form-group">
                        <input type="text" class="form-input" id="prompt-input" 
                               placeholder="" value="${defaultValue}">
                    </div>
                    <div class="modal-actions">
                        <button class="btn btn-secondary" data-action="cancel">Cancel</button>
                        <button class="btn btn-primary" data-action="confirm">OK</button>
                    </div>
                </div>
            `;

            const input = overlay.querySelector('#prompt-input');
            
            overlay.querySelector('[data-action="cancel"]').addEventListener('click', () => {
                this.close(overlay, resolve, null);
            });

            overlay.querySelector('[data-action="confirm"]').addEventListener('click', () => {
                this.close(overlay, resolve, input.value);
            });

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    this.close(overlay, resolve, input.value);
                }
            });

            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    this.close(overlay, resolve, null);
                }
            });

            document.getElementById('modal-container').appendChild(overlay);
            this.activeModal = overlay;
            
            setTimeout(() => input.focus(), 100);
        });
    }

    /**
     * Close modal
     */
    close(overlay, resolve, value) {
        overlay.classList.remove('active');
        setTimeout(() => {
            overlay.remove();
            this.activeModal = null;
            resolve(value);
        }, 200);
    }

    /**
     * Close active modal
     */
    closeActive() {
        if (this.activeModal) {
            this.activeModal.classList.remove('active');
            setTimeout(() => {
                this.activeModal?.remove();
                this.activeModal = null;
            }, 200);
        }
    }
}

// ============================================
// TOAST MANAGER
// ============================================
class ToastManager {
    constructor() {
        this.createContainer();
    }

    createContainer() {
        if (document.querySelector('.toast-container')) return;
        
        const container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    /**
     * Show toast notification
     * @param {string} message - Message to display
     * @param {string} type - Toast type ('success', 'error', 'warning', 'info')
     * @param {number} duration - Duration in ms
     */
    show(message, type = 'info', duration = 3000) {
        const container = document.querySelector('.toast-container');
        
        const icons = {
            success: 'check_circle',
            error: 'error',
            warning: 'warning',
            info: 'info'
        };

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <span class="material-symbols-outlined">${icons[type] || icons.info}</span>
            <span>${message}</span>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    success(message, duration) {
        this.show(message, 'success', duration);
    }

    error(message, duration) {
        this.show(message, 'error', duration);
    }

    warning(message, duration) {
        this.show(message, 'warning', duration);
    }

    info(message, duration) {
        this.show(message, 'info', duration);
    }
}

// ============================================
// LOADING MANAGER
// ============================================
class LoadingManager {
    constructor() {
        this.overlay = null;
    }

    /**
     * Show loading overlay
     * @param {string} message - Loading message
     */
    show(message = 'Loading...') {
        if (this.overlay) return;

        this.overlay = document.createElement('div');
        this.overlay.className = 'modal-overlay active';
        this.overlay.style.cursor = 'wait';
        this.overlay.innerHTML = `
            <div class="modal" style="text-align: center;">
                <div class="spinner" style="margin: 0 auto 16px;"></div>
                <p style="color: var(--text-secondary);">${message}</p>
            </div>
        `;

        document.body.appendChild(this.overlay);
    }

    /**
     * Hide loading overlay
     */
    hide() {
        if (this.overlay) {
            this.overlay.classList.remove('active');
            setTimeout(() => {
                this.overlay?.remove();
                this.overlay = null;
            }, 200);
        }
    }

    /**
     * Update loading message
     * @param {string} message - New message
     */
    update(message) {
        if (this.overlay) {
            const p = this.overlay.querySelector('p');
            if (p) p.textContent = message;
        }
    }
}

// ============================================
// ANIMATION UTILITIES
// ============================================
const AnimationUtils = {
    /**
     * Fade in element
     * @param {HTMLElement} element - Element to fade in
     * @param {number} duration - Duration in ms
     */
    fadeIn(element, duration = 300) {
        element.style.opacity = '0';
        element.style.display = '';
        element.style.transition = `opacity ${duration}ms ease`;
        
        requestAnimationFrame(() => {
            element.style.opacity = '1';
        });
    },

    /**
     * Fade out element
     * @param {HTMLElement} element - Element to fade out
     * @param {number} duration - Duration in ms
     * @returns {Promise} Resolves when animation complete
     */
    fadeOut(element, duration = 300) {
        return new Promise(resolve => {
            element.style.transition = `opacity ${duration}ms ease`;
            element.style.opacity = '0';
            
            setTimeout(() => {
                element.style.display = 'none';
                resolve();
            }, duration);
        });
    },

    /**
     * Slide in element
     * @param {HTMLElement} element - Element to slide in
     * @param {string} direction - Direction ('up', 'down', 'left', 'right')
     * @param {number} duration - Duration in ms
     */
    slideIn(element, direction = 'up', duration = 300) {
        const transforms = {
            up: 'translateY(20px)',
            down: 'translateY(-20px)',
            left: 'translateX(20px)',
            right: 'translateX(-20px)'
        };

        element.style.opacity = '0';
        element.style.transform = transforms[direction];
        element.style.display = '';
        element.style.transition = `opacity ${duration}ms ease, transform ${duration}ms ease`;

        requestAnimationFrame(() => {
            element.style.opacity = '1';
            element.style.transform = 'translate(0, 0)';
        });
    },

    /**
     * Shake element (for errors)
     * @param {HTMLElement} element - Element to shake
     */
    shake(element) {
        element.style.animation = 'none';
        element.offsetHeight; // Trigger reflow
        element.style.animation = 'shake 0.5s ease';
    }
};

// Add shake keyframes if not exists
if (!document.getElementById('animation-styles')) {
    const style = document.createElement('style');
    style.id = 'animation-styles';
    style.textContent = `
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
            20%, 40%, 60%, 80% { transform: translateX(5px); }
        }
    `;
    document.head.appendChild(style);
}

// ============================================
// DOM UTILITIES
// ============================================
const DOMUtils = {
    /**
     * Create element with attributes and children
     * @param {string} tag - Tag name
     * @param {Object} attrs - Attributes
     * @param {Array|string} children - Child elements or text
     * @returns {HTMLElement}
     */
    create(tag, attrs = {}, children = []) {
        const el = document.createElement(tag);
        
        Object.entries(attrs).forEach(([key, value]) => {
            if (key === 'className') {
                el.className = value;
            } else if (key === 'style' && typeof value === 'object') {
                Object.assign(el.style, value);
            } else if (key.startsWith('on') && typeof value === 'function') {
                el.addEventListener(key.slice(2).toLowerCase(), value);
            } else if (key === 'dataset') {
                Object.entries(value).forEach(([k, v]) => el.dataset[k] = v);
            } else {
                el.setAttribute(key, value);
            }
        });

        if (typeof children === 'string') {
            el.textContent = children;
        } else if (Array.isArray(children)) {
            children.forEach(child => {
                if (typeof child === 'string') {
                    el.appendChild(document.createTextNode(child));
                } else if (child instanceof HTMLElement) {
                    el.appendChild(child);
                }
            });
        }

        return el;
    },

    /**
     * Query selector with null check
     * @param {string} selector - CSS selector
     * @param {HTMLElement} parent - Parent element
     * @returns {HTMLElement|null}
     */
    $(selector, parent = document) {
        return parent.querySelector(selector);
    },

    /**
     * Query selector all as array
     * @param {string} selector - CSS selector
     * @param {HTMLElement} parent - Parent element
     * @returns {Array<HTMLElement>}
     */
    $$(selector, parent = document) {
        return Array.from(parent.querySelectorAll(selector));
    },

    /**
     * Remove all children from element
     * @param {HTMLElement} element - Parent element
     */
    empty(element) {
        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }
    }
};

// ============================================
// FORM UTILITIES
// ============================================
const FormUtils = {
    /**
     * Get all form data as object
     * @param {HTMLFormElement} form - Form element
     * @returns {Object} Form data
     */
    getData(form) {
        const formData = new FormData(form);
        const data = {};
        
        formData.forEach((value, key) => {
            if (data[key]) {
                if (!Array.isArray(data[key])) {
                    data[key] = [data[key]];
                }
                data[key].push(value);
            } else {
                data[key] = value;
            }
        });

        return data;
    },

    /**
     * Validate form fields
     * @param {HTMLFormElement} form - Form element
     * @returns {Object} Validation result
     */
    validate(form) {
        const errors = [];
        const inputs = form.querySelectorAll('[required]');

        inputs.forEach(input => {
            if (!input.value.trim()) {
                errors.push({
                    field: input.name || input.id,
                    message: `${input.placeholder || 'This field'} is required`
                });
                input.classList.add('error');
            } else {
                input.classList.remove('error');
            }
        });

        // Email validation
        const emailInputs = form.querySelectorAll('[type="email"]');
        emailInputs.forEach(input => {
            if (input.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value)) {
                errors.push({
                    field: input.name || input.id,
                    message: 'Please enter a valid email address'
                });
                input.classList.add('error');
            }
        });

        return {
            valid: errors.length === 0,
            errors
        };
    },

    /**
     * Set form data from object
     * @param {HTMLFormElement} form - Form element
     * @param {Object} data - Data to set
     */
    setData(form, data) {
        Object.entries(data).forEach(([key, value]) => {
            const input = form.querySelector(`[name="${key}"]`);
            if (input) {
                if (input.type === 'checkbox') {
                    input.checked = !!value;
                } else {
                    input.value = value;
                }
            }
        });
    }
};

// ============================================
// GLOBAL INSTANCES
// ============================================
window.ThemeManager = new ThemeManager();
window.ModalManager = new ModalManager();
window.ToastManager = new ToastManager();
window.LoadingManager = new LoadingManager();
window.AnimationUtils = AnimationUtils;
window.DOMUtils = DOMUtils;
window.FormUtils = FormUtils;
