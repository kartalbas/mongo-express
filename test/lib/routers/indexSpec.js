import { expect } from 'chai';

import { createServer } from '../../testHttpUtils.js';
import { cleanAndCloseDb, initializeDb, testDbName } from '../../testMongoUtils.js';

describe('Router index', () => {
  let request;
  let close;
  let db;
  before(() => initializeDb()
    .then((newDb) => {
      db = newDb;
      return createServer();
    }).then((server) => {
      request = server.request;
      close = server.close;
    }));

  it('GET / should return html', () => request.get('/').expect(200)
    .then((res) => {
      expect(res.text).to.match(/<title>Home - Mongo Express<\/title>/);
      expect(res.text).to.include('Databases');
      const dbName = testDbName;
      expect(res.text).to.include(dbName);
    }));

  after(() => Promise.all([
    cleanAndCloseDb(db),
    close(),
  ]));
});
