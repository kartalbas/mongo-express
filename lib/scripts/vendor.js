import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap';
import Alpine from 'alpinejs';
import htmx from 'htmx.org';
import { createIcons, Plus, Trash2, Eye, EyeOff, Download, Upload, Search, Save, Moon, Sun, Link, Pencil, RefreshCw, Minimize2, ChevronUp, ChevronDown, LogOut, Tag, ArrowLeft, Terminal, Activity, Users, GitBranch, Layers, Shield, BarChart3 } from 'lucide';

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

const allIcons = { Plus, Trash2, Eye, EyeOff, Download, Upload, Search, Save, Moon, Sun, Link, Pencil, RefreshCw, Minimize2, ChevronUp, ChevronDown, LogOut, Tag, ArrowLeft, Terminal, Activity, Users, GitBranch, Layers, Shield, BarChart3 };

// Initialize Lucide icons
createIcons({ icons: allIcons });

// Re-initialize Lucide icons after htmx content swaps
document.body.addEventListener('htmx:afterSettle', () => {
  createIcons({ icons: allIcons });
});
