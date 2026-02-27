import { Modal } from 'bootstrap';

document.addEventListener('DOMContentLoaded', () => {
  const deleteButtons = document.querySelectorAll('.deleteButton');

  for (const btn of deleteButtons) {
    btn.addEventListener('click', (event) => {
      event.preventDefault();

      const targetEl = document.querySelector('#confirm-deletion');
      if (!targetEl) return;
      const parentForm = btn.closest('form');
      const collectionName = btn.dataset.collectionName;

      const modal = new Modal(targetEl, { backdrop: 'static', keyboard: false });

      const confirmInput = document.querySelector('#confirmation-input');
      const modalName = document.querySelector('#modal-collection-name');
      confirmInput.dataset.shouldbe = collectionName;
      modalName.textContent = collectionName;

      const onShown = () => {
        confirmInput.focus();
        targetEl.removeEventListener('shown.bs.modal', onShown);
      };
      targetEl.addEventListener('shown.bs.modal', onShown);

      const deleteBtn = targetEl.querySelector('#delete');
      const onDelete = () => {
        if (confirmInput.value.toLowerCase() === confirmInput.dataset.shouldbe.toLowerCase()) {
          parentForm.submit();
        }
        deleteBtn.removeEventListener('click', onDelete);
      };
      deleteBtn.addEventListener('click', onDelete);

      modal.show();
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
      const { files, dataset } = event.target;
      const collection = dataset.collectionName;
      const data = new FormData();

      for (const [i, file] of files.entries()) {
        data.append(`file_${i}`, file);
      }

      const csrfToken = document.querySelector('[name="_csrf"]').value;

      fetch(`${ME_SETTINGS.baseHref}db/${ME_SETTINGS.dbName}/import/${collection}`, {
        method: 'POST',
        headers: { 'X-CSRF-TOKEN': csrfToken },
        body: data,
      })
        .then((response) => response.text())
        .then((text) => {
          ME.toast(text, 'success');
        })
        .catch((error) => {
          ME.toast(error?.message || 'Import failed', 'error');
        });
    });
  }
});
