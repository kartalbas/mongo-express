import { Modal } from 'bootstrap';
import editor from './editor.js';

const doc = editor(document.querySelector('#document'), {
  readOnly: ME_SETTINGS.readOnly,
});

globalThis.onBackClick = function () {
  if (doc.isClean()) {
    globalThis.history.back();
  } else if (document.querySelector('#discardChanges')) {
    globalThis.history.back();
  } else {
    const warning = document.createElement('div');
    warning.id = 'discardChanges';
    warning.className = 'alert alert-warning';
    warning.innerHTML = '<strong>Document has changed! Are you sure you wish to go back?</strong>';
    document.querySelector('#pageTitle').parentNode.append(warning);
    for (const btn of document.querySelectorAll('.backButton')) {
      btn.textContent = 'Back & Discard Changes';
    }
  }

  return false;
};

globalThis.onSubmitClick = function () {
  const existing = document.querySelector('#discardChanges');
  if (existing) existing.remove();

  const csrfToken = document.querySelector('[name="_csrf"]').value;

  fetch(`${ME_SETTINGS.baseHref}checkValid`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-CSRF-TOKEN': csrfToken,
    },
    body: new URLSearchParams({ document: doc.getValue() }),
  })
    .then((response) => response.text())
    .then((data) => {
      if (data === 'Valid') {
        const invalid = document.querySelector('#documentInvalidJSON');
        if (invalid) invalid.remove();
        document.querySelector('#documentEditForm').submit();
      } else if (!document.querySelector('#documentInvalidJSON')) {
        const alert = document.createElement('div');
        alert.id = 'documentInvalidJSON';
        alert.className = 'alert alert-danger';
        alert.innerHTML = '<strong>Invalid JSON</strong>';
        document.querySelector('#pageTitle').parentNode.append(alert);
      }
    });
  return false;
};

// F1: Clone Document - store doc in sessionStorage and navigate to collection page
globalThis.cloneDocument = function () {
  const docText = doc.getValue();
  globalThis.sessionStorage.setItem('meCloneDocument', docText);
  // Navigate to collection page with clone flag
  const { baseHref, dbName, collectionName } = ME_SETTINGS;
  globalThis.location.href = `${baseHref}db/${dbName}/${collectionName}?clone=1`;
};

// Register handlers immediately — script loads at bottom of page so DOM is ready
// Clone button handler
for (const btn of document.querySelectorAll('.cloneDocumentBtn')) {
  btn.addEventListener('click', () => globalThis.cloneDocument());
}

for (const btn of document.querySelectorAll('.deleteButtonDocument')) {
  btn.addEventListener('click', (e) => {
    const form = btn.closest('form');
    e.stopPropagation();
    e.preventDefault();

    if (ME_SETTINGS.confirmDelete) {
      const targetEl = document.querySelector('#confirm-document-delete');
      const modal = new Modal(targetEl, { backdrop: 'static', keyboard: false });
      const deleteBtn = targetEl.querySelector('#delete');
      const onDelete = () => {
        form.submit();
        deleteBtn.removeEventListener('click', onDelete);
      };
      deleteBtn.addEventListener('click', onDelete);
      modal.show();
    } else {
      form.submit();
    }
  });
}
