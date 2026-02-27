import { expect } from 'chai';
import supertest from 'supertest';

import { createServer } from '../../testHttpUtils.js';
import {
  cleanAndCloseDb, initializeDb, testDbName as dbName,
} from '../../testMongoUtils.js';

// T-05: Session timeout / invalid session handling
describe('Session handling', () => {
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

  it('should handle requests without a session cookie', (done) => {
    // Create a fresh agent without cookies (no session)
    const freshRequest = supertest(request.app);
    freshRequest
      .get('/')
      .expect(200)
      .end(done);
  });

  it('should clear session on disconnect', () => request
    .get('/disconnect')
    .expect(302)
    .then((res) => {
      expect(res.headers.location).to.equal('/');
    }));

  it('should still serve pages after disconnect', () => request
    .get('/')
    .expect(200)
    .then((res) => {
      expect(res.text).to.include('Mongo Express');
    }));

  it('should handle flash messages in session', () => request
    .get(`/db/${dbName}`)
    .expect(200)
    .then((res) => {
      // Page should render without errors (session flash is empty)
      expect(res.text).to.include('Viewing Database');
    }));

  after(() => Promise.all([
    cleanAndCloseDb(client),
    close(),
  ]));
});
