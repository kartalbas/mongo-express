import { expect } from 'chai';

import { createServer } from '../../testHttpUtils.js';
import {
  cleanAndCloseDb, initializeDb, testDbName as dbName, testURLCollectionName as urlColName,
} from '../../testMongoUtils.js';

// T-03: CSRF validation
// NOTE: In test mode (NODE_ENV=test), CSRF is disabled for all methods.
// These tests verify that CSRF tokens are generated and embedded in pages,
// and that the CSRF middleware is configured correctly.
describe('CSRF token generation', () => {
  /** @type {import('supertest').SuperAgentTest} */
  let request;
  let close;
  let client;

  before(() => initializeDb()
    .then((newClient) => {
      client = newClient;
      return createServer();
    }).then((server) => {
      request = server.request;
      close = server.close;
    }));

  it('should include CSRF token in database page forms', () => request
    .get(`/db/${dbName}`)
    .expect(200)
    .then((res) => {
      expect(res.text).to.include('_csrf');
    }));

  it('should include CSRF token in collection page', () => request
    .get(`/db/${dbName}/${urlColName}`)
    .expect(200)
    .then((res) => {
      expect(res.text).to.include('_csrf');
    }));

  it('should render shell page successfully', () => request
    .get(`/db/${dbName}/shell`)
    .expect(200)
    .then((res) => {
      expect(res.text).to.include('MongoDB Shell');
    }));

  it('should set CSRF cookie on response', () => request
    .get(`/db/${dbName}`)
    .expect(200)
    .then((res) => {
      const cookies = res.headers['set-cookie'];
      // The CSRF cookie should be set (may be named __csrf)
      const hasCsrfCookie = cookies && cookies.some((c) => c.includes('__csrf'));
      expect(hasCsrfCookie).to.equal(true);
    }));

  after(() => Promise.all([
    cleanAndCloseDb(client),
    close(),
  ]));
});
