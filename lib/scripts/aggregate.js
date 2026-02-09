import Alpine from 'alpinejs';
import editor from './editor.js';

const STAGE_TEMPLATES = {
  $match: '{\n  \n}',
  $group: '{\n  "_id": "$field",\n  "count": { "$sum": 1 }\n}',
  $sort: '{\n  "field": 1\n}',
  $project: '{\n  "field": 1\n}',
  $unwind: '"$field"',
  $lookup: '{\n  "from": "other_collection",\n  "localField": "field",\n  "foreignField": "field",\n  "as": "joined"\n}',
  $limit: '10',
  $skip: '0',
  $count: '"total"',
  $addFields: '{\n  "newField": "value"\n}',
  $replaceRoot: '{\n  "newRoot": "$field"\n}',
  $bucket: '{\n  "groupBy": "$field",\n  "boundaries": [0, 100, 200],\n  "default": "Other"\n}',
  $sample: '{\n  "size": 10\n}',
  $facet: '{\n  "facetName": [{ "$limit": 10 }]\n}',
  $sortByCount: '"$field"',
};

const stageEditors = {};

Alpine.data('pipeline', () => ({
  stages: [{ type: '$match', content: STAGE_TEMPLATES.$match }],

  init() {
    this.$nextTick(() => this.initEditors());
  },

  addStage() {
    this.stages.push({ type: '$match', content: STAGE_TEMPLATES.$match });
    this.$nextTick(() => this.initEditors());
  },

  removeStage(index) {
    if (stageEditors[index]) {
      delete stageEditors[index];
    }
    this.stages.splice(index, 1);
    // Re-index editors
    const newEditors = {};
    Object.keys(stageEditors).forEach((key) => {
      const k = Number(key);
      if (k > index) {
        newEditors[k - 1] = stageEditors[k];
      } else {
        newEditors[k] = stageEditors[k];
      }
    });
    Object.keys(stageEditors).forEach((k) => delete stageEditors[k]);
    Object.assign(stageEditors, newEditors);
    this.$nextTick(() => this.initEditors());
  },

  updateStageTemplate(index) {
    const stage = this.stages[index];
    stage.content = STAGE_TEMPLATES[stage.type] || '{}';
    const textarea = document.getElementById('stage-' + index);
    if (textarea) {
      textarea.value = stage.content;
    }
    if (stageEditors[index]) {
      delete stageEditors[index];
    }
    this.$nextTick(() => this.initEditors());
  },

  initEditors() {
    for (let i = 0; i < this.stages.length; i++) {
      const textarea = document.getElementById('stage-' + i);
      if (textarea && !stageEditors[i] && textarea.style.display !== 'none') {
        textarea.value = this.stages[i].content;
        stageEditors[i] = editor(textarea, {
          readOnly: false,
          completions: { operators: true, fields: ME_SETTINGS.columns || [] },
        });
      }
    }
  },

  buildPipeline() {
    const pipeline = [];
    for (let i = 0; i < this.stages.length; i++) {
      const stage = this.stages[i];
      let content;
      if (stageEditors[i]) {
        content = stageEditors[i].state.doc.toString();
      } else {
        content = stage.content;
      }
      pipeline.push({ [stage.type]: content });
    }
    return pipeline;
  },

  runPipeline() {
    const pipeline = this.buildPipeline();
    const csrfToken = document.querySelector('[name="_csrf"]').value;
    fetch(`${ME_SETTINGS.baseHref}db/${encodeURIComponent(ME_SETTINGS.dbName)}/aggregate/${encodeURIComponent(ME_SETTINGS.collectionName)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-TOKEN': csrfToken,
      },
      body: JSON.stringify({ pipeline }),
    })
      .then((r) => r.text())
      .then((html) => {
        document.getElementById('aggregate-results').innerHTML = html;
        if (globalThis.htmx) globalThis.htmx.process(document.getElementById('aggregate-results'));
      })
      .catch((err) => {
        document.getElementById('aggregate-results').innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
      });
  },

  previewPipeline() {
    const pipeline = this.buildPipeline();
    const formatted = JSON.stringify(pipeline, null, 2);
    ME.toast(formatted, 'info');
  },
}));
