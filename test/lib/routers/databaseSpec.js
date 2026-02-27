import { expect } from 'chai';

import { createServer } from '../../testHttpUtils.js';
import {
  initializeDb, cleanAndCloseDb, testCollectionName as collectionName, testDbName as dbName,
} from '../../testMongoUtils.js';

describe('Router database', () => {
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

  it('GET /db/<dbName> should return html', () => request.get(`/db/${dbName}`).expect(200)
    .then((res) => {
      expect(res.text).to.include('Viewing Database');
      expect(res.text).to.include(collectionName);
    }));

  it('POST / should add a new db');
  it('DEL /<dbName> should delete the db');

  after(() => Promise.all([
    cleanAndCloseDb(db),
    close(),
  ]));
});
