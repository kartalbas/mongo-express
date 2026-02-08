import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import nunjucks from 'nunjucks';
import fileUpload from 'express-fileupload';
import * as swigFilters from './filters.js';
import router from './router.js';

const middleware = async function (config) {
  const app = express();

  app.locals.assets = JSON.parse(fs.readFileSync(fileURLToPath(new URL('../build-assets.json', import.meta.url))));

  // Set up Nunjucks
  const viewsPath = fileURLToPath(new URL('views', import.meta.url));
  const env = nunjucks.configure(viewsPath, {
    autoescape: true,
    express: app,
    watch: process.env.NODE_ENV !== 'production',
    noCache: process.env.NODE_ENV !== 'production',
  });

  // Port all custom filters
  for (const name of Object.keys(swigFilters)) {
    env.addFilter(name, swigFilters[name]);
  }

  // Compatibility filters
  env.addFilter('url_encode', (input) => encodeURIComponent(input));
  env.addFilter('date', (input, format) => {
    if (!input) return '';
    const d = new Date(input);
    if (format === 'r') return d.toUTCString();
    return d.toISOString();
  });
  env.addFilter('toBool', (input) => !!input);

  // App configuration
  app.set('views', viewsPath);
  app.set('view engine', 'html');
  app.set('view options', { layout: false });

  // Handle file upload
  app.use(fileUpload({
    limits: { fileSize: 50 * 1024 * 1024 },
  }));

  app.use('/', await router(config));

  app.set('read_only', config.options.readOnly || false);
  app.set('fullwidth_layout', config.options.fullwidthLayout || false);
  app.set('me_confirm_delete', config.options.confirmDelete || false);
  app.set('me_collapsible_json', config.options.collapsibleJSON || false);
  app.set('me_collapsible_json_default_unfold', config.options.collapsibleJSONDefaultUnfold || false);
  app.set('me_no_export', config.options.noExport || false);
  app.set('gridFSEnabled', config.options.gridFSEnabled || false);
  app.set('no_delete', config.options.noDelete || false);

  return app;
};

export default middleware;
