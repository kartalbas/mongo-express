import { expect } from 'chai';

import { createServer } from '../../testHttpUtils.js';
import {
  cleanAndCloseDb, initializeDb,
  testDbName as dbName, testURLCollectionName as urlColName,
} from '../../testMongoUtils.js';

// Shell regex only allows word characters in collection names, so use a simple name
const shellCollectionName = 'testitems';

describe('Security tests', () => {
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

  // T-01: Query/regex injection
  describe('T-01: Regex injection protection', () => {
    it('should handle regex metacharacters in query value without ReDoS', () => request
      .get(`/db/${dbName}/${urlColName}`)
      .query({ key: 'testItem', value: '(((((((((((((((((((((((((((((a]', type: 'R' })
      .expect(200));

    it('should escape regex special chars and still return results', () => request
      .get(`/db/${dbName}/${urlColName}`)
      .query({ key: 'testItem', value: '.*', type: 'R' })
      .expect(200));

    it('should handle empty regex value', () => request
      .get(`/db/${dbName}/${urlColName}`)
      .query({ key: 'testItem', value: '', type: 'R' })
      .expect(200));
  });

  // T-04: File upload limits
  describe('T-04: File upload limits', () => {
    it('should reject import with no file', () => request
      .post(`/db/${dbName}/import/${urlColName}`)
      .expect(400));

    it('should reject import with bad mime type', () => request
      .post(`/db/${dbName}/import/${urlColName}`)
      .attach('file', Buffer.from('hello'), { filename: 'test.exe', contentType: 'application/octet-stream' })
      .expect(400));

    it('should reject malformed JSON import', () => request
      .post(`/db/${dbName}/import/${urlColName}`)
      .attach('file', Buffer.from('not valid json {{{'), { filename: 'test.json', contentType: 'application/json' })
      .expect(400));

    it('should accept valid JSON import', () => request
      .post(`/db/${dbName}/import/${urlColName}`)
      .attach('file', Buffer.from('[{"imported": true}]'), { filename: 'test.json', contentType: 'application/json' })
      .expect(200)
      .then((res) => {
        expect(res.text).to.include('document(s) inserted');
      }));
  });

  // T-06: Shell command bypass attempts
  describe('T-06: Shell command security', () => {
    it('should reject empty command', () => request
      .post(`/db/${dbName}/shell/execute`)
      .send({ command: '' })
      .expect(200)
      .then((res) => {
        expect(res.body.error).to.equal('No command provided');
      }));

    it('should reject command exceeding max length', () => request
      .post(`/db/${dbName}/shell/execute`)
      .send({ command: 'a'.repeat(10_001) })
      .expect(200)
      .then((res) => {
        expect(res.body.error).to.include('Command too long');
      }));

    it('should reject disallowed methods', () => request
      .post(`/db/${dbName}/shell/execute`)
      .send({ command: `db.${shellCollectionName}.drop()` })
      .expect(200)
      .then((res) => {
        expect(res.body.error).to.include('not allowed');
      }));

    it('should reject unrecognized commands', () => request
      .post(`/db/${dbName}/shell/execute`)
      .send({ command: 'process.exit(1)' })
      .expect(200)
      .then((res) => {
        expect(res.body.error).to.include('Unrecognized command');
      }));

    it('should reject runCommand with non-object argument', () => request
      .post(`/db/${dbName}/shell/execute`)
      .send({ command: 'db.runCommand("shutdown")' })
      .expect(200)
      .then((res) => {
        expect(res.body.error).to.include('must be a JSON object');
      }));

    it('should reject runCommand with array argument', () => request
      .post(`/db/${dbName}/shell/execute`)
      .send({ command: 'db.runCommand([1,2,3])' })
      .expect(200)
      .then((res) => {
        expect(res.body.error).to.include('must be a JSON object');
      }));

    it('should reject invalid JSON arguments', () => request
      .post(`/db/${dbName}/shell/execute`)
      .send({ command: `db.${shellCollectionName}.find({invalid})` })
      .expect(200)
      .then((res) => {
        expect(res.body.error).to.include('Invalid arguments');
      }));

    it('should allow valid find command', () => request
      .post(`/db/${dbName}/shell/execute`)
      .send({ command: `db.${shellCollectionName}.find({})` })
      .expect(200)
      .then((res) => {
        expect(res.body.result).to.be.an('array');
      }));

    it('should allow show collections', () => request
      .post(`/db/${dbName}/shell/execute`)
      .send({ command: 'show collections' })
      .expect(200)
      .then((res) => {
        expect(res.body.result).to.be.an('array');
      }));

    it('should allow countDocuments', () => request
      .post(`/db/${dbName}/shell/execute`)
      .send({ command: `db.${shellCollectionName}.countDocuments({})` })
      .expect(200)
      .then((res) => {
        expect(res.body.result).to.be.a('number');
      }));
  });

  after(() => Promise.all([
    cleanAndCloseDb(client),
    close(),
  ]));
});
