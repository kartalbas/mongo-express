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
  showExportCode: false,
  showCreateView: false,
  codeTab: 'node',
  viewName: '',

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
    for (const key of Object.keys(stageEditors)) {
      const k = Number(key);
      if (k > index) {
        newEditors[k - 1] = stageEditors[k];
      } else {
        newEditors[k] = stageEditors[k];
      }
    }
    for (const k of Object.keys(stageEditors)) delete stageEditors[k];
    Object.assign(stageEditors, newEditors);
    this.$nextTick(() => this.initEditors());
  },

  updateStageTemplate(index) {
    const stage = this.stages[index];
    stage.content = STAGE_TEMPLATES[stage.type] || '{}';
    const textarea = document.querySelector('#stage-' + index);
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
      const textarea = document.querySelector('#stage-' + i);
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
      content = stageEditors[i] ? stageEditors[i].state.doc.toString() : stage.content;
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
        document.querySelector('#aggregate-results').innerHTML = html;
        if (globalThis.htmx) globalThis.htmx.process(document.querySelector('#aggregate-results'));
      })
      .catch((error) => {
        document.querySelector('#aggregate-results').innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
      });
  },

  previewPipeline() {
    const pipeline = this.buildPipeline();
    const formatted = JSON.stringify(pipeline, null, 2);
    ME.toast(formatted, 'info');
  },

  // F4: Export Aggregation Results
  exportResults(format) {
    const pipeline = this.buildPipeline();
    const csrfToken = document.querySelector('[name="_csrf"]').value;
    fetch(`${ME_SETTINGS.baseHref}db/${encodeURIComponent(ME_SETTINGS.dbName)}/aggregateExport/${encodeURIComponent(ME_SETTINGS.collectionName)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-TOKEN': csrfToken,
      },
      body: JSON.stringify({ pipeline, format }),
    })
      .then((r) => {
        if (!r.ok) return r.json().then((d) => { throw new Error(d.error || 'Export failed'); });
        return r.blob();
      })
      .then((blob) => {
        const ext = format === 'csv' ? 'csv' : 'json';
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${ME_SETTINGS.collectionName}-aggregate.${ext}`;
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch((error) => ME.toast(error.message, 'error'));
  },

  // F5: Export Pipeline as Code
  generateCode() {
    const pipeline = this.buildPipeline();
    const pipelineJson = JSON.stringify(pipeline, null, 2);
    const db = ME_SETTINGS.dbName;
    const coll = ME_SETTINGS.collectionName;

    if (this.codeTab === 'node') {
      return [
        "const { MongoClient } = require('mongodb');",
        '',
        `const client = new MongoClient('mongodb://localhost:27017');`,
        'await client.connect();',
        `const db = client.db('${db}');`,
        '',
        `const pipeline = ${pipelineJson};`,
        '',
        `const results = await db.collection('${coll}').aggregate(pipeline).toArray();`,
        'console.log(results);',
        '',
        'await client.close();',
      ].join('\n');
    }
    if (this.codeTab === 'python') {
      return [
        'from pymongo import MongoClient',
        '',
        "client = MongoClient('mongodb://localhost:27017')",
        `db = client['${db}']`,
        '',
        `pipeline = ${pipelineJson}`,
        '',
        `results = list(db['${coll}'].aggregate(pipeline))`,
        'print(results)',
        '',
        'client.close()',
      ].join('\n');
    }
    if (this.codeTab === 'java') {
      const stages = pipeline.map((s) => {
        const escaped = JSON.stringify(s).replaceAll('"', String.raw`\"`);
        return `Document.parse("${escaped}")`;
      }).join(',\n  ');
      return [
        'import com.mongodb.client.*;',
        'import org.bson.Document;',
        'import java.util.Arrays;',
        '',
        'MongoClient client = MongoClients.create("mongodb://localhost:27017");',
        `MongoDatabase db = client.getDatabase("${db}");`,
        `MongoCollection<Document> coll = db.getCollection("${coll}");`,
        '',
        'List<Document> pipeline = Arrays.asList(',
        `  ${stages}`,
        ');',
        '',
        'coll.aggregate(pipeline).forEach(doc -> System.out.println(doc.toJson()));',
      ].join('\n');
    }
    return '';
  },

  copyCode() {
    const code = this.generateCode();
    globalThis.navigator.clipboard.writeText(code).then(
      () => ME.toast('Copied to clipboard', 'success'),
      () => ME.toast('Failed to copy', 'error'),
    );
  },

  // F12: Create View from Pipeline
  createView() {
    const pipeline = this.buildPipeline();
    const csrfToken = document.querySelector('[name="_csrf"]').value;
    fetch(`${ME_SETTINGS.baseHref}db/${encodeURIComponent(ME_SETTINGS.dbName)}/createView/${encodeURIComponent(ME_SETTINGS.collectionName)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-TOKEN': csrfToken,
      },
      body: JSON.stringify({ viewName: this.viewName, pipeline }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          ME.toast(`View "${this.viewName}" created!`, 'success');
          this.viewName = '';
          this.showCreateView = false;
        } else {
          ME.toast(data.error || 'Failed to create view', 'error');
        }
      })
      .catch((error) => ME.toast(error.message, 'error'));
  },
}));
