import { Modal } from 'bootstrap';

document.addEventListener('DOMContentLoaded', () => {
  const deleteButtons = document.querySelectorAll('.deleteButton');

  for (const btn of deleteButtons) {
    btn.addEventListener('click', (event) => {
      event.preventDefault();

      const targetEl = document.querySelector('#confirm-deletion');
      if (!targetEl) return;
      const parentForm = btn.closest('form');
      const dbName = btn.dataset.databaseName;

      const modal = new Modal(targetEl, { backdrop: 'static', keyboard: false });

      const confirmInput = document.querySelector('#confirmation-input');
      const modalDbName = document.querySelector('#modal-database-name');
      confirmInput.setAttribute('shouldbe', dbName);
      modalDbName.textContent = dbName;

      const onShown = () => {
        confirmInput.focus();
        targetEl.removeEventListener('shown.bs.modal', onShown);
      };
      targetEl.addEventListener('shown.bs.modal', onShown);

      const deleteBtn = targetEl.querySelector('#delete');
      const onDelete = () => {
        if (confirmInput.value.toLowerCase() === confirmInput.getAttribute('shouldbe').toLowerCase()) {
          parentForm.submit();
        }
        deleteBtn.removeEventListener('click', onDelete);
      };
      deleteBtn.addEventListener('click', onDelete);

      modal.show();
    });
  }
});
