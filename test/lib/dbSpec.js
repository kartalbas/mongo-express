import { expect } from 'chai';

import { createServer } from '../testHttpUtils.js';
import {
  cleanAndCloseDb, initializeDb, testDbName as dbName,
} from '../testMongoUtils.js';

// T-02: Concurrent request handling
describe('Concurrent request handling', () => {
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

  it('should handle multiple concurrent requests without errors', async () => {
    // Fire 10 requests concurrently
    const promises = Array.from({ length: 10 }, () => request.get('/').expect(200));

    const results = await Promise.all(promises);
    for (const res of results) {
      expect(res.text).to.include('Mongo Express');
    }
  });

  it('should handle concurrent requests to different endpoints', async () => {
    const promises = [
      request.get('/').expect(200),
      request.get(`/db/${dbName}`).expect(200),
      request.get('/').expect(200),
      request.get(`/db/${dbName}`).expect(200),
    ];

    const results = await Promise.all(promises);
    expect(results[0].text).to.include('Mongo Express');
    expect(results[1].text).to.include('Viewing Database');
  });

  it('should serve consistent database list across concurrent requests', async () => {
    const promises = Array.from({ length: 5 }, () => request.get('/').expect(200));

    const results = await Promise.all(promises);
    // All responses should contain the test database
    for (const res of results) {
      expect(res.text).to.include(dbName);
    }
  });

  after(() => Promise.all([
    cleanAndCloseDb(client),
    close(),
  ]));
});
