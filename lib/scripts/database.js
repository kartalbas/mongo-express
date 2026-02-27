import { Modal } from 'bootstrap';
import Alpine from 'alpinejs';

// F2: CSV Import Preview Modal
function showCsvPreviewModal(preview, collection, csrfToken) {
  // Remove any existing modal
  const existing = document.querySelector('#csvPreviewModal');
  if (existing) existing.remove();

  const types = ['string', 'number', 'boolean', 'date', 'objectid'];
  const typeOptions = (header) => types.map((t) =>
    `<option value="${t}" ${preview.typeMap[header] === t ? 'selected' : ''}>${t}</option>`).join('');

  const headerRows = preview.headers.map((h) => {
    const sample = (preview.sampleRows[0] || {})[h] || '';
    const sel = '<select class="form-select form-select-sm csv-type-select"'
      + ` data-header="${h}" style="font-size:0.75rem;">`
      + `${typeOptions(h)}</select>`;
    return `<tr><td><code>${h}</code></td>`
      + `<td>${sel}</td>`
      + `<td style="font-size:0.75rem;">${sample}</td></tr>`;
  }).join('');

  const modalHtml = `
    <div class="modal fade" id="csvPreviewModal" tabindex="-1">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">CSV Import Preview (${preview.totalRows} rows)</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <table class="table table-sm table-bordered" style="font-size:0.8125rem;">
              <thead><tr><th>Column</th><th>Detected Type</th><th>Sample</th></tr></thead>
              <tbody>${headerRows}</tbody>
            </table>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-sm btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-sm btn-primary" id="csvImportConfirmBtn">Import ${preview.totalRows} rows</button>
          </div>
        </div>
      </div>
    </div>`;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  const modalEl = document.querySelector('#csvPreviewModal');
  const modal = new Modal(modalEl);
  modal.show();

  document.querySelector('#csvImportConfirmBtn').addEventListener('click', () => {
    const typeOverrides = {};
    for (const select of modalEl.querySelectorAll('.csv-type-select')) {
      typeOverrides[select.dataset.header] = select.value;
    }
    fetch(`${ME_SETTINGS.baseHref}db/${ME_SETTINGS.dbName}/csvImport/${collection}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-TOKEN': csrfToken,
      },
      body: JSON.stringify({ previewId: preview.previewId, typeOverrides }),
    })
      .then((r) => r.json())
      .then((data) => {
        modal.hide();
        if (data.success) {
          ME.toast(`${data.insertedCount} document(s) imported from CSV`, 'success');
        } else {
          ME.toast(data.error || 'Import failed', 'error');
        }
      })
      .catch((error) => {
        modal.hide();
        ME.toast(error?.message || 'Import failed', 'error');
      });
  });

  modalEl.addEventListener('hidden.bs.modal', () => modalEl.remove());
}

// F14/F13: Create Collection component (capped & time series toggles)
Alpine.data('createCollection', () => ({
  capped: false,
  timeseries: false,
}));

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
      const file = files[0];
      if (!file) return;

      const csrfToken = document.querySelector('[name="_csrf"]').value;
      const isCsv = file.name.toLowerCase().endsWith('.csv');

      if (isCsv) {
        // F2: CSV Import with Type Detection
        const data = new FormData();
        data.append('file_0', file);
        fetch(`${ME_SETTINGS.baseHref}db/${ME_SETTINGS.dbName}/csvPreview/${collection}`, {
          method: 'POST',
          headers: { 'X-CSRF-TOKEN': csrfToken },
          body: data,
        })
          .then((r) => r.json())
          .then((preview) => {
            if (preview.error) throw new Error(preview.error);
            showCsvPreviewModal(preview, collection, csrfToken);
          })
          .catch((error) => ME.toast(error?.message || 'CSV preview failed', 'error'));
      } else {
        // Existing JSON import flow
        const data = new FormData();
        for (const [i, f] of files.entries()) {
          data.append(`file_${i}`, f);
        }
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
      }
    });
  }
});
