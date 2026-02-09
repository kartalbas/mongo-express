import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap';
import Alpine from 'alpinejs';
import htmx from 'htmx.org';
import { createIcons, Plus, Trash2, Eye, EyeOff, Download, Upload, Search, Save, Moon, Sun, Link, Pencil, RefreshCw, Minimize2, ChevronUp, ChevronDown, LogOut, Tag, ArrowLeft, Terminal, Activity, Users, GitBranch, Layers, Shield, BarChart3, CircleCheck, CircleX, Info, AlertTriangle } from 'lucide';
import { Toast, Modal } from 'bootstrap';

// Expose htmx and Alpine globally
globalThis.htmx = htmx;
globalThis.Alpine = Alpine;

// Alpine.js dark mode component
Alpine.data('darkMode', () => ({
  isDark: localStorage.getItem('bsTheme') === 'dark',
  init() {
    if (this.isDark) {
      this.applyTheme('dark');
    }
  },
  toggle() {
    this.isDark = !this.isDark;
    this.applyTheme(this.isDark ? 'dark' : 'light');
    localStorage.setItem('bsTheme', this.isDark ? 'dark' : 'light');
  },
  applyTheme(theme) {
    const nav = document.getElementById('navbar');
    if (theme === 'dark') {
      document.body.dataset.bsTheme = 'dark';
      nav.classList.remove('navbar-light', 'bg-light');
      nav.classList.add('navbar-dark', 'bg-dark');
    } else {
      document.body.dataset.bsTheme = 'light';
      nav.classList.remove('navbar-dark', 'bg-dark');
      nav.classList.add('navbar-light', 'bg-light');
    }
  },
}));

// NOTE: Alpine.start() is NOT called here.
// It is called in layout.html AFTER all page scripts have loaded,
// so page-specific Alpine.data() components are registered before
// Alpine processes the DOM.

const allIcons = { Plus, Trash2, Eye, EyeOff, Download, Upload, Search, Save, Moon, Sun, Link, Pencil, RefreshCw, Minimize2, ChevronUp, ChevronDown, LogOut, Tag, ArrowLeft, Terminal, Activity, Users, GitBranch, Layers, Shield, BarChart3, CircleCheck, CircleX, Info, AlertTriangle };

// Initialize Lucide icons
createIcons({ icons: allIcons });

// Re-initialize Lucide icons after htmx content swaps
document.body.addEventListener('htmx:afterSettle', () => {
  createIcons({ icons: allIcons });
});

// Toast notification system
const TOAST_CONFIG = {
  success: { bg: 'bg-success', label: 'Success', icon: 'circle-check', delay: 5000 },
  error:   { bg: 'bg-danger',  label: 'Error',   icon: 'circle-x',     delay: 8000 },
  info:    { bg: 'bg-info',    label: 'Info',     icon: 'info',         delay: 5000 },
  warning: { bg: 'bg-warning', label: 'Warning',  icon: 'alert-triangle', delay: 8000 },
};

globalThis.ME = {
  toast(message, type = 'info') {
    const config = TOAST_CONFIG[type] || TOAST_CONFIG.info;

    // Console output
    if (type === 'error' || type === 'warning') {
      console.error(`[${config.label}]`, message);
    } else {
      console.log(`[${config.label}]`, message);
    }

    const container = document.getElementById('toast-container');
    if (!container) return;

    const toastEl = document.createElement('div');
    toastEl.className = 'toast';
    toastEl.setAttribute('role', 'alert');
    toastEl.setAttribute('aria-live', 'assertive');
    toastEl.setAttribute('aria-atomic', 'true');

    toastEl.innerHTML = `
      <div class="toast-header ${config.bg} text-white">
        <i data-lucide="${config.icon}" class="lucide me-2"></i>
        <strong class="me-auto">${config.label}</strong>
        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
      <div class="toast-body">${message}</div>
    `;

    container.appendChild(toastEl);
    createIcons({ icons: allIcons, nameAttr: 'data-lucide' });

    const toast = new Toast(toastEl, { delay: config.delay });
    toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
    toast.show();
  },

  confirm(message) {
    return new Promise((resolve) => {
      const modalEl = document.getElementById('me-confirm-modal');
      if (!modalEl) { resolve(false); return; }

      document.getElementById('me-confirm-message').textContent = message;
      const modal = new Modal(modalEl, { backdrop: 'static', keyboard: false });

      const okBtn = document.getElementById('me-confirm-ok');

      function cleanup() {
        okBtn.removeEventListener('click', onOk);
        modalEl.removeEventListener('hidden.bs.modal', onHidden);
      }

      let confirmed = false;

      function onOk() {
        confirmed = true;
        modal.hide();
      }

      function onHidden() {
        cleanup();
        resolve(confirmed);
      }

      okBtn.addEventListener('click', onOk);
      modalEl.addEventListener('hidden.bs.modal', onHidden);
      modal.show();
    });
  },
};
