import editor from './editor.js';

const textarea = document.querySelector('#validator');
if (textarea) {
  const validationEditor = editor(textarea, {
    readOnly: ME_SETTINGS.readOnly,
    completions: { operators: true, fields: [] },
  });

  const form = document.querySelector('#validationForm');
  if (form) {
    form.addEventListener('submit', () => {
      textarea.value = validationEditor.state.doc.toString();
    });
  }
}
