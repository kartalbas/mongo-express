import { Modal } from 'bootstrap';

document.addEventListener('DOMContentLoaded', () => {
  const deleteButtons = document.querySelectorAll('.deleteButton');

  deleteButtons.forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.preventDefault();

      const targetEl = document.getElementById('confirm-deletion');
      if (!targetEl) return;
      const parentForm = btn.closest('form');
      const collectionName = btn.dataset.collectionName;

      const modal = new Modal(targetEl, { backdrop: 'static', keyboard: false });

      const confirmInput = document.getElementById('confirmation-input');
      const modalName = document.getElementById('modal-collection-name');
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
  });

  // Import file handling
  const importLinks = document.querySelectorAll('.import-file-link');
  const importInputs = document.querySelectorAll('.import-input-file');

  importLinks.forEach((link, key) => {
    link.addEventListener('click', () => {
      importInputs[key].click();
    });
  });

  importInputs.forEach((input) => {
    input.addEventListener('change', (event) => {
      const { files } = event.target;
      const collection = event.target.dataset.collectionName;
      const data = new FormData();

      for (let i = 0; i < files.length; i++) {
        data.append(`file_${i}`, files[i]);
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
  });
});
