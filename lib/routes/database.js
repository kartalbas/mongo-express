import * as utils from '../utils.js';

const routes = function (config) {
  const exp = {};

  exp.viewDatabase = async function (req, res) {
    try {
      await req.updateCollections(req.dbConnection);
    } catch (error) {
      console.error('Could not refresh collections:', error);
      req.session.error = 'Could not refresh collections.';
      return res.redirect(req.get('Referrer') || '/');
    }

    let stats = false;
    if (config.mongodb.admin === true) {
      try {
        const data = await req.db.stats();
        stats = {
          avgObjSize: utils.bytesToSize(data.avgObjSize || 0),
          collections: data.collections,
          dataFileVersion: (data.dataFileVersion && data.dataFileVersion.major && data.dataFileVersion.minor
            ? data.dataFileVersion.major + '.' + data.dataFileVersion.minor
            : null),
          dataSize: utils.bytesToSize(data.dataSize),
          extentFreeListNum: (data.extentFreeList && data.extentFreeList.num ? data.extentFreeList.num : null),
          fileSize: (data.fileSize === undefined ? null : utils.bytesToSize(data.fileSize)),
          indexes: data.indexes,
          indexSize: utils.bytesToSize(data.indexSize),
          numExtents: (data.numExtents ? data.numExtents.toString() : null),
          objects: data.objects,
          storageSize: utils.bytesToSize(data.storageSize),
        };
      } catch (error) {
        console.error('Could not get stats:', error);
        req.session.error = 'Could not get database stats.';
        return res.redirect(req.get('Referrer') || '/');
      }
    }

    const ctx = {
      title: 'Viewing Database: ' + req.dbName,
      databases: req.databases,
      colls: req.collections[req.dbName],
      grids: req.gridFSBuckets[req.dbName],
      csrfToken: req.csrfToken(),
      stats,
    };
    res.render('database', ctx);
  };

  exp.addDatabase = async function (req, res) {
    const name = req.body.database;
    if (!utils.isValidDatabaseName(name)) {
      console.error('That database name is invalid.');
      req.session.error = 'That database name is invalid.';
      return res.redirect(req.get('Referrer') || '/');
    }
    const ndb = req.mainClient.client.db(name);

    try {
      await ndb.createCollection('delete_me');
      await req.updateDatabases(true);
      return res.redirect(res.locals.baseHref);
    } catch (error) {
      console.error('Could not create database:', error);
      req.session.error = 'Could not create database.';
      return res.redirect(req.get('Referrer') || '/');
    }
  };

  exp.deleteDatabase = async function (req, res) {
    try {
      await req.db.dropDatabase();
      await req.updateDatabases(true);
      return res.redirect(res.locals.baseHref);
    } catch (error) {
      console.error('Could not delete database:', error);
      req.session.error = 'Failed to delete database.';
      return res.redirect(req.get('Referrer') || '/');
    }
  };

  return exp;
};

export default routes;
