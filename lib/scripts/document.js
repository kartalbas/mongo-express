import { Modal } from 'bootstrap';
import editor from './editor.js';

const doc = editor(document.querySelector('#document'), {
  readOnly: ME_SETTINGS.readOnly,
});

globalThis.onBackClick = function () {
  if (doc.isClean()) {
    globalThis.history.back();
  } else if (!document.getElementById('discardChanges')) {
    const warning = document.createElement('div');
    warning.id = 'discardChanges';
    warning.className = 'alert alert-warning';
    warning.innerHTML = '<strong>Document has changed! Are you sure you wish to go back?</strong>';
    document.getElementById('pageTitle').parentNode.appendChild(warning);
    document.querySelectorAll('.backButton').forEach((btn) => {
      btn.textContent = 'Back & Discard Changes';
    });
  } else {
    globalThis.history.back();
  }

  return false;
};

globalThis.onSubmitClick = function () {
  const existing = document.getElementById('discardChanges');
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
        const invalid = document.getElementById('documentInvalidJSON');
        if (invalid) invalid.remove();
        document.getElementById('documentEditForm').submit();
      } else if (!document.getElementById('documentInvalidJSON')) {
        const alert = document.createElement('div');
        alert.id = 'documentInvalidJSON';
        alert.className = 'alert alert-danger';
        alert.innerHTML = '<strong>Invalid JSON</strong>';
        document.getElementById('pageTitle').parentNode.appendChild(alert);
      }
    });
  return false;
};

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.deleteButtonDocument').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const form = btn.closest('form');
      e.stopPropagation();
      e.preventDefault();

      if (ME_SETTINGS.confirmDelete) {
        const targetEl = document.getElementById('confirm-document-delete');
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
  });
});
