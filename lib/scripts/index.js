import { Modal } from 'bootstrap';

document.addEventListener('DOMContentLoaded', () => {
  const deleteButtons = document.querySelectorAll('.deleteButton');

  deleteButtons.forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.preventDefault();

      const targetEl = document.getElementById('confirm-deletion');
      if (!targetEl) return;
      const parentForm = btn.closest('form');
      const dbName = btn.dataset.databaseName;

      const modal = new Modal(targetEl, { backdrop: 'static', keyboard: false });

      const confirmInput = document.getElementById('confirmation-input');
      const modalDbName = document.getElementById('modal-database-name');
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
  });
});
