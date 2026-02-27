import { encode } from 'html-entities';
import renderjson from 'renderjson-2';
import { Modal } from 'bootstrap';
import Alpine from 'alpinejs';
import editor from './editor.js';

function getParameterByName(name) {
  name = name.replace(/\[/, String.raw`\[`).replace(/]/, String.raw`\]`);
  const regex = new RegExp(String.raw`[\?&]` + name + '=([^&#]*)');
  const results = regex.exec(globalThis.location.search);
  return results === null ? '' : decodeURIComponent(results[1].replaceAll('+', ' '));
}

// Pagination rendering
function renderPaginator(containerId, options) {
  const container = document.querySelector(`#${containerId}`);
  if (!container) return;

  const { currentPage, totalPages, onPageClicked } = options;
  if (totalPages <= 1) return;

  const nav = document.createElement('ul');
  nav.className = 'pagination';

  const maxVisible = 7;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let endPage = Math.min(totalPages, startPage + maxVisible - 1);
  if (endPage - startPage < maxVisible - 1) {
    startPage = Math.max(1, endPage - maxVisible + 1);
  }

  // First button
  const firstLi = document.createElement('li');
  firstLi.className = 'page-item' + (currentPage === 1 ? ' disabled' : '');
  const firstA = document.createElement('a');
  firstA.className = 'page-link';
  firstA.href = '#';
  firstA.textContent = '\u00AB\u00AB';
  firstA.title = 'First page';
  firstA.addEventListener('click', (e) => { e.preventDefault(); if (currentPage > 1) onPageClicked(1); });
  firstLi.append(firstA);
  nav.append(firstLi);

  // Previous button
  const prevLi = document.createElement('li');
  prevLi.className = 'page-item' + (currentPage === 1 ? ' disabled' : '');
  const prevA = document.createElement('a');
  prevA.className = 'page-link';
  prevA.href = '#';
  prevA.textContent = '\u00AB';
  prevA.title = 'Previous page';
  prevA.addEventListener('click', (e) => { e.preventDefault(); if (currentPage > 1) onPageClicked(currentPage - 1); });
  prevLi.append(prevA);
  nav.append(prevLi);

  for (let i = startPage; i <= endPage; i++) {
    const li = document.createElement('li');
    li.className = 'page-item' + (i === currentPage ? ' active' : '');
    const a = document.createElement('a');
    a.className = 'page-link';
    a.href = '#';
    a.textContent = i;
    a.addEventListener('click', ((page) => (e) => { e.preventDefault(); onPageClicked(page); })(i));
    li.append(a);
    nav.append(li);
  }

  // Next button
  const nextLi = document.createElement('li');
  nextLi.className = 'page-item' + (currentPage === totalPages ? ' disabled' : '');
  const nextA = document.createElement('a');
  nextA.className = 'page-link';
  nextA.href = '#';
  nextA.textContent = '\u00BB';
  nextA.title = 'Next page';
  nextA.addEventListener('click', (e) => { e.preventDefault(); if (currentPage < totalPages) onPageClicked(currentPage + 1); });
  nextLi.append(nextA);
  nav.append(nextLi);

  // Last button
  const lastLi = document.createElement('li');
  lastLi.className = 'page-item' + (currentPage === totalPages ? ' disabled' : '');
  const lastA = document.createElement('a');
  lastA.className = 'page-link';
  lastA.href = '#';
  lastA.textContent = '\u00BB\u00BB';
  lastA.title = 'Last page';
  lastA.addEventListener('click', (e) => { e.preventDefault(); if (currentPage < totalPages) onPageClicked(totalPages); });
  lastLi.append(lastA);
  nav.append(lastLi);

  container.append(nav);
}

document.addEventListener('DOMContentLoaded', () => {
  // Tab activation for advanced query
  if (document.location.href.includes('query=') && getParameterByName('query') !== '') {
    const advancedTab = document.querySelector('#tabs a[href="#advanced"]');
    if (advancedTab) {
      import('bootstrap').then(({ Tab }) => {
        new Tab(advancedTab).show();
      });
    }
  }

  const { limit, skip, totalPages, baseHref, dbName } = ME_SETTINGS;

  // Restore saved page size from localStorage on first load (no limit in URL yet)
  const savedLimit = localStorage.getItem('me_docs_per_page');
  if (savedLimit && !new URLSearchParams(globalThis.location.search).has('limit') && Number(savedLimit) !== Number(limit)) {
    const searchParams = new URLSearchParams(globalThis.location.search);
    searchParams.set('limit', savedLimit);
    searchParams.set('skip', '0');
    globalThis.location.search = searchParams.toString();
    return;
  }

  // Pagination
  const paginatorOptions = {
    currentPage: Math.round(skip / limit) + 1,
    totalPages,
    onPageClicked(page) {
      const searchParams = new URLSearchParams(globalThis.location.search);
      searchParams.set('skip', (page * limit) - limit);
      searchParams.set('limit', limit);
      globalThis.location.search = searchParams.toString();
    },
  };
  renderPaginator('paginator', paginatorOptions);
  renderPaginator('paginator-bottom', paginatorOptions);

  // Page size selector
  for (const select of document.querySelectorAll('.page-size-select')) {
    select.addEventListener('change', () => {
      const newLimit = select.value;
      localStorage.setItem('me_docs_per_page', newLimit);
      const searchParams = new URLSearchParams(globalThis.location.search);
      searchParams.set('limit', newLimit);
      searchParams.set('skip', '0');
      // Sync all selectors before navigating
      for (const other of document.querySelectorAll('.page-size-select')) {
        other.value = newLimit;
      }
      globalThis.location.search = searchParams.toString();
    });
  }

  // Table overflow fade
  const tableWrapper = document.querySelector('.tableWrapper');
  const tableHeaderFooter = document.querySelector('.tableHeaderFooterBars');
  const fadeToWhite = document.querySelector('.fadeToWhite');

  if (tableWrapper && tableHeaderFooter && fadeToWhite) {
    if (tableHeaderFooter.offsetWidth === tableWrapper.offsetWidth) {
      fadeToWhite.remove();
    } else {
      fadeToWhite.style.height = tableWrapper.offsetHeight + 'px';
    }

    tableWrapper.addEventListener('scroll', () => {
      const proximityToRight = tableHeaderFooter.offsetWidth - tableWrapper.scrollLeft - tableWrapper.offsetWidth;
      const opacity = Math.min(Math.max(proximityToRight - 50, 50) - 50, 100) / 100;
      const fadeEl = document.querySelector('#fadeToWhiteID');
      if (fadeEl) fadeEl.style.opacity = Math.min(opacity, 0.6);
    });
  }

  // Lazy loading large properties
  for (const el of document.querySelectorAll('.tooDamnBig')) {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const _id = el.getAttribute('doc_id');
      const prop = el.getAttribute('doc_prop');
      const spinner = `<img src="${baseHref}public/img/gears.gif" />`;
      const leftScroll = tableWrapper ? tableWrapper.scrollLeft : 0;

      el.innerHTML = spinner;

      fetch(`${makeCollectionUrl()}${encodeURIComponent(_id)}/${prop}`)
        .then((response) => response.json())
        .then((propData) => {
          const rendered = renderProp(propData);
          if (typeof rendered === 'string') {
            el.parentNode.innerHTML = rendered;
          } else {
            el.parentNode.innerHTML = '';
            el.parentNode.append(rendered);
          }
          if (tableWrapper) tableWrapper.scrollLeft = leftScroll;
        })
        .catch(() => {
          el.innerHTML = 'Error loading property';
        });
    });
  }

  // Delete document confirmation
  for (const btn of document.querySelectorAll('.deleteButtonDocument')) {
    btn.addEventListener('click', (e) => {
      const form = btn.closest('form');
      e.stopPropagation();
      e.preventDefault();

      const targetEl = document.querySelector('#confirm-deletion-document');
      if (!targetEl) { form.submit(); return; }
      const modal = new Modal(targetEl, { backdrop: 'static', keyboard: false });

      const deleteBtn = targetEl.querySelector('#delete');
      const onDelete = () => {
        form.submit();
        deleteBtn.removeEventListener('click', onDelete);
      };
      deleteBtn.addEventListener('click', onDelete);
      modal.show();
    });
  }

  // Delete list confirmation
  const deleteListBtn = document.querySelector('#deleteListConfirmButton');
  if (deleteListBtn) {
    deleteListBtn.addEventListener('click', () => {
      const form = document.querySelector('#deleteListForm');
      if (form) form.submit();
    });
  }

  // Delete collection confirmation
  for (const btn of document.querySelectorAll('.deleteButtonCollection')) {
    btn.addEventListener('click', (event) => {
      event.preventDefault();

      const targetEl = document.querySelector('#confirm-deletion-collection');
      if (!targetEl) return;
      const parentForm = btn.closest('form');

      const modal = new Modal(targetEl, { backdrop: 'static', keyboard: false });

      const confirmInput = document.querySelector('#confirmation-input');
      const modalName = document.querySelector('#modal-collection-name');
      confirmInput.setAttribute('shouldbe', btn.dataset.collectionName);
      modalName.textContent = btn.dataset.collectionName;

      const onShown = () => {
        confirmInput.focus();
        targetEl.removeEventListener('shown.bs.modal', onShown);
      };
      targetEl.addEventListener('shown.bs.modal', onShown);

      const confirmBtn = document.querySelector('#deleteCollectionConfirmation');
      const onConfirm = () => {
        if (confirmInput.value.toLowerCase() === confirmInput.getAttribute('shouldbe').toLowerCase()) {
          parentForm.submit();
        }
        confirmBtn.removeEventListener('click', onConfirm);
      };
      confirmBtn.addEventListener('click', onConfirm);

      modal.show();
    });
  }

  // Sort buttons
  const nextSort = { 1: -1, '-1': 0, 0: 1, undefined: 1 };
  for (const btn of document.querySelectorAll('.sorting-button')) {
    btn.addEventListener('click', () => {
      const column = btn.dataset.column;
      const direction = nextSort[btn.dataset.direction];

      const sortInput = document.querySelector('input.sort-' + column);
      if (sortInput) {
        sortInput.value = direction;
        sortInput.checked = direction !== 0;
      }

      const activeForm = document.querySelector('#my-tab-content .tab-pane.active form');
      if (activeForm) activeForm.submit();
    });
  }

  // Import file handling
  const importLinks = document.querySelectorAll('.import-file-link');
  const importInputs = document.querySelectorAll('.import-input-file');

  for (const [key, link] of importLinks.entries()) {
    link.addEventListener('click', () => {
      importInputs[key].click();
    });
  }

  for (const input of importInputs) {
    input.addEventListener('change', (event) => {
      const { files } = event.target;
      const collection = event.target.getAttribute('collection-name');
      const data = new FormData();

      for (const [i, file] of files.entries()) {
        data.append(`file_${i}`, file);
      }

      const csrfToken = document.querySelector('[name="_csrf"]').value;

      fetch(`${baseHref}db/${dbName}/import/${collection}`, {
        method: 'POST',
        headers: { 'X-CSRF-TOKEN': csrfToken },
        body: data,
      })
        .then((response) => response.text().then((text) => {
          if (!response.ok) {
            // Strip HTML tags if the server returned an HTML error page
            const cleanText = text.replaceAll(/<[^>]*>/g, '').trim();
            throw new Error(cleanText || `Import failed (${response.status})`);
          }
          ME.toast(text, 'success');
          globalThis.location.reload();
        }))
        .catch((error) => {
          ME.toast(error?.message || 'Import failed', 'error');
        });
    });
  }
});

const addDoc = editor(document.querySelector('#document'), {
  readOnly: ME_SETTINGS.readOnly,
  completions: { operators: true, fields: ME_SETTINGS.columns || [] },
});

const addIndexDoc = editor(document.querySelector('#index'), {
  readOnly: ME_SETTINGS.readOnly,
});

globalThis.checkValidJSON = function (csrfToken) {
  fetch(`${ME_SETTINGS.baseHref}checkValid`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-CSRF-TOKEN': csrfToken,
    },
    body: new URLSearchParams({ document: addDoc.getValue(), _csrf: csrfToken }),
  })
    .then((response) => response.text())
    .then((data) => {
      if (data === 'Valid') {
        const invalid = document.querySelector('#documentInvalidJSON');
        if (invalid) invalid.remove();
        document.querySelector('#addDocumentForm').submit();
      } else if (!document.querySelector('#documentInvalidJSON')) {
        const alert = document.createElement('div');
        alert.id = 'documentInvalidJSON';
        alert.className = 'alert alert-danger';
        alert.innerHTML = '<strong>Invalid JSON</strong>';
        document.querySelector('#document-modal-body').parentNode.append(alert);
      }
    });
  return false;
};

globalThis.checkValidIndexJSON = function () {
  const csrfToken = document.querySelector('[name="_csrf"]').value;
  fetch(`${ME_SETTINGS.baseHref}checkValid`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-CSRF-TOKEN': csrfToken,
    },
    body: new URLSearchParams({ document: addIndexDoc.getValue(), _csrf: csrfToken }),
  })
    .then((response) => response.text())
    .then((data) => {
      if (data === 'Valid') {
        const invalid = document.querySelector('#indexInvalidJSON');
        if (invalid) invalid.remove();
        document.querySelector('#addIndexForm').submit();
      } else if (!document.querySelector('#indexInvalidJSON')) {
        const alert = document.createElement('div');
        alert.id = 'indexInvalidJSON';
        alert.className = 'alert alert-danger';
        alert.innerHTML = '<strong>Invalid JSON</strong>';
        document.querySelector('#index-modal-body').parentNode.append(alert);
      }
    });
  return false;
};

// Refresh CodeMirror on modal show
const addDocModal = document.querySelector('#addDocument');
if (addDocModal) {
  addDocModal.addEventListener('shown.bs.modal', () => {
    addDoc.refresh();
    addDoc.focus();
  });
}

const addIndexModal = document.querySelector('#addIndex');
if (addIndexModal) {
  addIndexModal.addEventListener('shown.bs.modal', () => {
    addIndexDoc.refresh();
    addIndexDoc.focus();
  });
}

if (ME_SETTINGS.collapsibleJSON) {
  document.addEventListener('DOMContentLoaded', () => {
    for (const el of document.querySelectorAll('div.tableContent pre')) {
      const text = el.textContent.trim();
      if (text) {
        const rendered = renderjson(JSON.parse(text));
        el.innerHTML = '';
        el.append(rendered);
      }
    }
  });
  renderjson.set_show_to_level(ME_SETTINGS.collapsibleJSONDefaultUnfold);
}

function makeCollectionUrl() {
  const st = ME_SETTINGS;
  return `${st.baseHref}db/${encodeURIComponent(st.dbName)}/${encodeURIComponent(st.collectionName)}/`;
}

globalThis.loadDocument = function (url) {
  const selection = globalThis.getSelection().toString();
  if (selection === '') {
    globalThis.location.href = url;
  }
};

// Feature 6: Inline Cell Editing
Alpine.data('inlineEdit', (docId, field) => ({
  editing: false,
  startEdit(el) {
    if (ME_SETTINGS.readOnly) return;
    if (this.editing) return;
    this.editing = true;
    const content = el.querySelector('.tableContent');
    const currentText = content.textContent.trim();
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'form-control form-control-sm';
    input.value = currentText;
    content.dataset.original = content.innerHTML;
    content.innerHTML = '';
    content.append(input);
    input.focus();
    input.select();

    const save = () => {
      if (!this.editing) return;
      this.editing = false;
      const newValue = input.value;
      if (newValue === currentText) {
        content.innerHTML = content.dataset.original;
        return;
      }
      const csrfToken = document.querySelector('[name="_csrf"]').value;
      const url = `${ME_SETTINGS.baseHref}db/${encodeURIComponent(ME_SETTINGS.dbName)}/${encodeURIComponent(ME_SETTINGS.collectionName)}/${docId}`;
      fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': csrfToken,
        },
        body: JSON.stringify({ field, value: newValue }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.success) {
            content.textContent = newValue;
          } else {
            content.innerHTML = content.dataset.original;
            ME.toast(data.error || 'Update failed', 'error');
          }
        })
        .catch(() => {
          content.innerHTML = content.dataset.original;
        });
    };
    input.addEventListener('blur', save);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
      if (e.key === 'Escape') { this.editing = false; content.innerHTML = content.dataset.original; }
    });
  },
}));

// Feature 7: Bulk Select/Delete
Alpine.data('bulkSelect', () => ({
  selectedIds: [],
  toggleRow(event) {
    const val = event.target.value;
    if (event.target.checked) {
      this.selectedIds.push(val);
    } else {
      this.selectedIds = this.selectedIds.filter((id) => id !== val);
    }
  },
  toggleAll(event) {
    const checkboxes = document.querySelectorAll('.bulk-check');
    this.selectedIds = [];
    for (const cb of checkboxes) {
      cb.checked = event.target.checked;
      if (event.target.checked) {
        this.selectedIds.push(cb.value);
      }
    }
  },
  clearSelection() {
    this.selectedIds = [];
    for (const cb of document.querySelectorAll('.bulk-check')) {
      cb.checked = false;
    }
  },
  bulkDeleteSelected() {
    ME.confirm(`Delete ${this.selectedIds.length} document(s)?`).then((ok) => {
      if (!ok) return;
      const csrfToken = document.querySelector('[name="_csrf"]').value;
      fetch(`${ME_SETTINGS.baseHref}db/${encodeURIComponent(ME_SETTINGS.dbName)}/bulkDelete/${encodeURIComponent(ME_SETTINGS.collectionName)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': csrfToken,
        },
        body: JSON.stringify({ ids: this.selectedIds }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.success) {
            globalThis.location.reload();
          } else {
            ME.toast(data.error || 'Bulk delete failed', 'error');
          }
        })
        .catch((error) => {
          ME.toast(error.message || 'Bulk delete failed', 'error');
        });
    });
  },
}));

function renderProp(input) {
  if (
    typeof input === 'string'
    && (
      input.slice(0, 22) === 'data:image/png;base64,'
      || input.slice(0, 22) === 'data:image/gif;base64,'
      || input.slice(0, 22) === 'data:image/jpg;base64,'
      || input.slice(0, 23) === 'data:image/jpeg;base64,'
    )
  ) {
    return `<img src="${encode(input)}" style="max-height:100%; max-width:100%; "/>`;
  }

  if (
    typeof input === 'string'
    && (
      input.slice(0, 22) === 'data:audio/ogg;base64,'
      || input.slice(0, 22) === 'data:audio/wav;base64,'
      || input.slice(0, 22) === 'data:audio/mp3;base64,'
    )
  ) {
    return `<audio controls style="width:45px;" src="${encode(input)}">Your browser does not support the audio element.</audio>`;
  }

  if (
    typeof input === 'string'
    && (
      input.slice(0, 23) === 'data:video/webm;base64,'
      || input.slice(0, 22) === 'data:video/mp4;base64,'
      || input.slice(0, 22) === 'data:video/ogv;base64,'
    )
  ) {
    const videoFormat = input.match(/^data:(.*);base64/)[1];
    return `<video controls><source type="${encode(videoFormat)}" src="${encode(input)}"/>
      + 'Your browser does not support the video element.</video>`;
  }
  if (typeof input === 'object' && (input.toString() === '[object Object]' || input.toString().slice(0, 7) === '[object')) {
    return renderjson(input);
  }

  return encode(input.toString());
}
