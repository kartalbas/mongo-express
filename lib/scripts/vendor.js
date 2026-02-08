import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap';
import Alpine from 'alpinejs';
import htmx from 'htmx.org';
import { createIcons, Plus, Trash2, Eye, EyeOff, Download, Upload, Search, Save, Moon, Sun, Link, Pencil, RefreshCw, Minimize2, ChevronUp, ChevronDown, LogOut, Tag, ArrowLeft } from 'lucide';

// Expose htmx globally
globalThis.htmx = htmx;

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

// Start Alpine
Alpine.start();

// Initialize Lucide icons
createIcons({
  icons: { Plus, Trash2, Eye, EyeOff, Download, Upload, Search, Save, Moon, Sun, Link, Pencil, RefreshCw, Minimize2, ChevronUp, ChevronDown, LogOut, Tag, ArrowLeft },
});

// Re-initialize Lucide icons after htmx content swaps
document.body.addEventListener('htmx:afterSettle', () => {
  createIcons({
    icons: { Plus, Trash2, Eye, EyeOff, Download, Upload, Search, Save, Moon, Sun, Link, Pencil, RefreshCw, Minimize2, ChevronUp, ChevronDown, LogOut, Tag, ArrowLeft },
  });
});
