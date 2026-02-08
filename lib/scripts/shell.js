import Alpine from 'alpinejs';
import editor from './editor.js';

let shellEditor = null;

Alpine.data('shellApp', () => ({
  history: [],
  commandHistory: JSON.parse(localStorage.getItem('meShellHistory') || '[]'),
  historyIndex: -1,

  init() {
    this.$nextTick(() => {
      const textarea = document.querySelector('#shell-command');
      if (textarea && !shellEditor) {
        shellEditor = editor(textarea, {
          readOnly: false,
          completions: { operators: true, fields: [] },
        });
      }
    });
  },

  getCommand() {
    if (shellEditor) {
      return shellEditor.state.doc.toString().trim();
    }
    const textarea = document.querySelector('#shell-command');
    return textarea ? textarea.value.trim() : '';
  },

  setCommand(text) {
    if (shellEditor) {
      shellEditor.dispatch({
        changes: { from: 0, to: shellEditor.state.doc.length, insert: text },
      });
    }
  },

  async executeCommand() {
    const command = this.getCommand();
    if (!command) return;

    // Store in history
    this.commandHistory.push(command);
    if (this.commandHistory.length > 100) this.commandHistory.shift();
    localStorage.setItem('meShellHistory', JSON.stringify(this.commandHistory));
    this.historyIndex = -1;

    const csrfToken = document.querySelector('[name="_csrf"]').value;
    try {
      const resp = await fetch(`${ME_SETTINGS.baseHref}db/${encodeURIComponent(ME_SETTINGS.dbName)}/shell/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': csrfToken,
        },
        body: JSON.stringify({ command }),
      });
      const data = await resp.json();

      this.history.push({
        command,
        error: data.error || null,
        result: data.result || null,
        resultText: data.result ? JSON.stringify(data.result, null, 2) : null,
      });
    } catch (err) {
      this.history.push({
        command,
        error: err.message,
        result: null,
        resultText: null,
      });
    }

    // Scroll output to bottom
    this.$nextTick(() => {
      const output = document.getElementById('shell-output');
      if (output) output.scrollTop = output.scrollHeight;
    });

    // Clear input
    this.setCommand('');
  },

  historyBack() {
    if (this.commandHistory.length === 0) return;
    if (this.historyIndex === -1) {
      this.historyIndex = this.commandHistory.length - 1;
    } else if (this.historyIndex > 0) {
      this.historyIndex--;
    }
    this.setCommand(this.commandHistory[this.historyIndex]);
  },

  historyForward() {
    if (this.historyIndex === -1) return;
    if (this.historyIndex < this.commandHistory.length - 1) {
      this.historyIndex++;
      this.setCommand(this.commandHistory[this.historyIndex]);
    } else {
      this.historyIndex = -1;
      this.setCommand('');
    }
  },

  clearOutput() {
    this.history = [];
  },
}));
