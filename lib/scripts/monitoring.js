// Feature 10: Real-time Performance Monitoring (Compass-style)
import Alpine from 'alpinejs';

const MAX_HISTORY = 60;

// Lightweight sparkline renderer on <canvas>
function drawSparkline(canvasId, data, { color = '#3b82f6', fillAlpha = 0.15 } = {}) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.parentElement.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;
  if (w === 0 || h === 0) return;

  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  if (!data || data.length < 2) return;

  const max = Math.max(...data, 1);
  const stepX = w / (data.length - 1);

  let r = 59, g = 130, b = 246;
  if (color.startsWith('#') && color.length === 7) {
    r = Number.parseInt(color.slice(1, 3), 16);
    g = Number.parseInt(color.slice(3, 5), 16);
    b = Number.parseInt(color.slice(5, 7), 16);
  }

  // Fill
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let i = 0; i < data.length; i++) {
    ctx.lineTo(i * stepX, h - (data[i] / max) * h * 0.9);
  }
  ctx.lineTo((data.length - 1) * stepX, h);
  ctx.closePath();
  ctx.fillStyle = `rgba(${r},${g},${b},${fillAlpha})`;
  ctx.fill();

  // Line
  ctx.beginPath();
  for (let i = 0; i < data.length; i++) {
    const x = i * stepX;
    const y = h - (data[i] / max) * h * 0.9;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.lineJoin = 'round';
  ctx.stroke();

  // Current value dot
  const lastX = (data.length - 1) * stepX;
  const lastY = h - (data[data.length - 1] / max) * h * 0.9;
  ctx.beginPath();
  ctx.arc(lastX, lastY, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function pushHistory(arr, value) {
  arr.push(value);
  if (arr.length > MAX_HISTORY) arr.shift();
}

function createMonitoringComponent() {
  return {
    // State
    connected: false,
    paused: false,
    pollInterval: '5000',
    serverInfo: '',
    latest: {},
    deltas: {},
    currentOps: [],
    _prev: null,
    _timer: null,

    // Tabs
    activeTab: 'ops',

    // Operations sorting & filtering
    opsSort: { field: 'microsecs', dir: -1 },
    opsFilter: { type: '', status: '', ns: '' },
    selectedOp: null,

    // Slow queries
    profilerDb: '',
    profilerLevel: '0',
    profilerSlowMs: '100',
    slowQueries: [],
    slowSort: { field: 'ts', dir: 'desc' },
    slowFilter: { type: '', minMs: '', ns: '' },
    selectedSlow: null,

    // History arrays for sparklines
    history: {
      connections: [],
      memory: [],
      netIn: [],
      netOut: [],
      insert: [],
      query: [],
      update: [],
      delete: [],
      getmore: [],
      command: [],
      activeClients: [],
      queue: [],
      pageFaults: [],
    },

    init() {
      this.fetchMetrics();
      this.startPolling();
    },

    destroy() {
      if (this._timer) clearInterval(this._timer);
    },

    startPolling() {
      if (this._timer) clearInterval(this._timer);
      this._timer = setInterval(() => {
        if (!this.paused) this.fetchMetrics();
      }, Number.parseInt(this.pollInterval, 10));
    },

    restartPolling() {
      this.startPolling();
    },

    // ---- Operations sorting ----
    toggleOpsSort(field) {
      if (this.opsSort.field === field) {
        this.opsSort.dir = this.opsSort.dir === 1 ? -1 : 1;
      } else {
        this.opsSort.field = field;
        this.opsSort.dir = field === 'microsecs' ? -1 : 1;
      }
    },

    filteredOps() {
      let ops = [...this.currentOps];
      const f = this.opsFilter;
      if (f.type) ops = ops.filter((o) => o.type === f.type);
      if (f.status === 'active') ops = ops.filter((o) => o.active);
      if (f.status === 'idle') ops = ops.filter((o) => !o.active);
      if (f.ns) {
        const q = f.ns.toLowerCase();
        ops = ops.filter((o) => (o.ns || '').toLowerCase().includes(q));
      }
      const { field, dir } = this.opsSort;
      ops.sort((a, b) => {
        const av = a[field] ?? '';
        const bv = b[field] ?? '';
        if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
        if (typeof av === 'boolean' && typeof bv === 'boolean') return ((av ? 1 : 0) - (bv ? 1 : 0)) * dir;
        return String(av).localeCompare(String(bv)) * dir;
      });
      return ops;
    },

    // ---- Profiler / Slow Queries ----
    async loadProfiler() {
      if (!this.profilerDb) return;
      const baseHref = (globalThis.ME_SETTINGS && globalThis.ME_SETTINGS.baseHref) || '/';
      const params = new URLSearchParams({
        db: this.profilerDb,
        sort: this.slowSort.field,
        dir: this.slowSort.dir,
        type: this.slowFilter.type || '',
        minMs: this.slowFilter.minMs || '0',
        limit: '100',
      });
      try {
        const resp = await fetch(`${baseHref}monitoring/profiler?${params}`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        if (data.error) throw new Error(data.error);
        this.profilerLevel = String(data.profilerLevel || 0);
        this.profilerSlowMs = String(data.slowms || 100);
        this.slowQueries = data.slowQueries || [];
      } catch (err) {
        console.error('Profiler error:', err);
        this.slowQueries = [];
      }
    },

    async setProfiler() {
      if (!this.profilerDb) return;
      const baseHref = (globalThis.ME_SETTINGS && globalThis.ME_SETTINGS.baseHref) || '/';
      const csrfEl = document.querySelector('[name="_csrf"]');
      const headers = { 'Content-Type': 'application/json' };
      if (csrfEl) headers['X-CSRF-TOKEN'] = csrfEl.value;
      try {
        const resp = await fetch(`${baseHref}monitoring/profiler`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            db: this.profilerDb,
            level: this.profilerLevel,
            slowms: this.profilerSlowMs,
          }),
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        // Reload profiler data after setting level
        await this.loadProfiler();
      } catch (err) {
        console.error('Set profiler error:', err);
      }
    },

    filteredSlowQueries() {
      let queries = [...this.slowQueries];
      const f = this.slowFilter;
      if (f.type) queries = queries.filter((q) => q.op === f.type);
      if (f.minMs) {
        const min = Number.parseInt(f.minMs, 10) || 0;
        if (min > 0) queries = queries.filter((q) => q.millis >= min);
      }
      if (f.ns) {
        const q = f.ns.toLowerCase();
        queries = queries.filter((sq) => (sq.ns || '').toLowerCase().includes(q));
      }
      return queries;
    },

    // ---- Metrics Fetch ----
    async fetchMetrics() {
      const baseHref = (globalThis.ME_SETTINGS && globalThis.ME_SETTINGS.baseHref) || '/';
      const url = `${baseHref}monitoring/metrics`;
      try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        if (data.error) throw new Error(data.error);

        this.connected = true;
        const m = data.metrics;

        this.serverInfo = `${m.host} \u00b7 v${m.version}`;

        const interval = this._prev
          ? (m.timestamp - this._prev.timestamp) / 1000
          : 1;
        const dt = Math.max(interval, 0.1);

        if (this._prev) {
          const prev = this._prev;
          this.deltas = {
            networkIn: Math.max(0, (m.network.bytesIn - prev.network.bytesIn) / dt),
            networkOut: Math.max(0, (m.network.bytesOut - prev.network.bytesOut) / dt),
            insert: Math.max(0, Math.round((m.opcounters.insert - prev.opcounters.insert) / dt)),
            query: Math.max(0, Math.round((m.opcounters.query - prev.opcounters.query) / dt)),
            update: Math.max(0, Math.round((m.opcounters.update - prev.opcounters.update) / dt)),
            delete: Math.max(0, Math.round((m.opcounters.delete - prev.opcounters.delete) / dt)),
            getmore: Math.max(0, Math.round((m.opcounters.getmore - prev.opcounters.getmore) / dt)),
            command: Math.max(0, Math.round((m.opcounters.command - prev.opcounters.command) / dt)),
            pageFaults: Math.max(0, Math.round((m.extraInfo.pageFaults - prev.extraInfo.pageFaults) / dt)),
          };
        } else {
          this.deltas = {
            networkIn: 0, networkOut: 0,
            insert: 0, query: 0, update: 0, delete: 0, getmore: 0, command: 0,
            pageFaults: 0,
          };
        }

        this.latest = m;
        this.currentOps = data.currentOps || [];
        this._prev = m;

        pushHistory(this.history.connections, m.connections.current);
        pushHistory(this.history.memory, m.memory.resident);
        pushHistory(this.history.netIn, this.deltas.networkIn);
        pushHistory(this.history.netOut, this.deltas.networkOut);
        pushHistory(this.history.insert, this.deltas.insert);
        pushHistory(this.history.query, this.deltas.query);
        pushHistory(this.history.update, this.deltas.update);
        pushHistory(this.history.delete, this.deltas.delete);
        pushHistory(this.history.getmore, this.deltas.getmore);
        pushHistory(this.history.command, this.deltas.command);
        pushHistory(this.history.activeClients, m.globalLock.activeClientsTotal);
        pushHistory(this.history.queue, m.globalLock.currentQueueTotal);
        pushHistory(this.history.pageFaults, this.deltas.pageFaults);

        this.$nextTick(() => this.drawAllCharts());

        const errEl = document.getElementById('monitoring-error');
        if (errEl) errEl.style.display = 'none';
      } catch (err) {
        this.connected = false;
        const errEl = document.getElementById('monitoring-error');
        if (errEl) {
          errEl.textContent = 'Monitoring error: ' + err.message;
          errEl.style.display = 'block';
        }
      }
    },

    drawAllCharts() {
      const green = '#22c55e';
      const blue = '#3b82f6';
      const purple = '#a855f7';
      const amber = '#f59e0b';
      const red = '#ef4444';
      const cyan = '#06b6d4';
      const rose = '#f43f5e';

      drawSparkline('chart-connections', this.history.connections, { color: blue });
      drawSparkline('chart-memory', this.history.memory, { color: purple });
      drawSparkline('chart-netIn', this.history.netIn, { color: green });
      drawSparkline('chart-netOut', this.history.netOut, { color: amber });
      drawSparkline('chart-op-insert', this.history.insert, { color: green });
      drawSparkline('chart-op-query', this.history.query, { color: blue });
      drawSparkline('chart-op-update', this.history.update, { color: amber });
      drawSparkline('chart-op-delete', this.history.delete, { color: red });
      drawSparkline('chart-op-getmore', this.history.getmore, { color: cyan });
      drawSparkline('chart-op-command', this.history.command, { color: purple });
      drawSparkline('chart-activeClients', this.history.activeClients, { color: blue });
      drawSparkline('chart-queue', this.history.queue, { color: rose });
      drawSparkline('chart-pageFaults', this.history.pageFaults, { color: red });
    },

    // ---- Formatting helpers ----
    fmt(val) {
      if (val === undefined || val === null) return '\u2014';
      if (typeof val === 'number') {
        if (val >= 1_000_000) return (val / 1_000_000).toFixed(1) + 'M';
        if (val >= 1_000) return (val / 1_000).toFixed(1) + 'K';
        return val.toLocaleString();
      }
      return String(val);
    },

    fmtBytes(bytesPerSec) {
      if (bytesPerSec === undefined || bytesPerSec === null || bytesPerSec === 0) return '0 B';
      const units = ['B', 'KB', 'MB', 'GB'];
      let val = bytesPerSec;
      let u = 0;
      while (val >= 1024 && u < units.length - 1) { val /= 1024; u++; }
      return val.toFixed(u === 0 ? 0 : 1) + ' ' + units[u];
    },

    fmtUptime(seconds) {
      if (!seconds) return '\u2014';
      const d = Math.floor(seconds / 86400);
      const h = Math.floor((seconds % 86400) / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      if (d > 0) return `${d}d ${h}h ${m}m`;
      if (h > 0) return `${h}h ${m}m`;
      return `${m}m ${seconds % 60}s`;
    },

    fmtDuration(microsecs) {
      if (!microsecs) return '\u2014';
      if (microsecs < 1000) return microsecs + '\u00b5s';
      if (microsecs < 1_000_000) return (microsecs / 1000).toFixed(1) + 'ms';
      return (microsecs / 1_000_000).toFixed(1) + 's';
    },

    fmtTimestamp(iso) {
      if (!iso) return '\u2014';
      try {
        const d = new Date(iso);
        return d.toLocaleTimeString() + ' ' + d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      } catch {
        return iso;
      }
    },
  };
}

Alpine.data('monitoringApp', createMonitoringComponent);
