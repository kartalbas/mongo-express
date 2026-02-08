// Add routes from other files
import collectionRoute from './collection.js';
import databaseRoute from './database.js';
import documentRoute from './document.js';
import gridFSRoute from './gridfs.js';

const index = function (config) {
  const exp = {};

  const configuredDatabaseRoutes = databaseRoute(config);
  const configuredCollectionRoutes = collectionRoute(config);
  const configuredDocumentRoutes = documentRoute(config);
  const configuredGridFSRoute = gridFSRoute(config);

  exp.addDatabase = configuredDatabaseRoutes.addDatabase;
  exp.deleteDatabase = configuredDatabaseRoutes.deleteDatabase;
  exp.viewDatabase = configuredDatabaseRoutes.viewDatabase;

  exp.importCollection = configuredCollectionRoutes.importCollection;
  exp.addCollection = configuredCollectionRoutes.addCollection;
  exp.compactCollection = configuredCollectionRoutes.compactCollection;
  exp.deleteCollection = configuredCollectionRoutes.deleteCollection;
  exp.exportColArray = configuredCollectionRoutes.exportColArray;
  exp.exportCsv = configuredCollectionRoutes.exportCsv;
  exp.exportCollection = configuredCollectionRoutes.exportCollection;
  exp.renameCollection = configuredCollectionRoutes.renameCollection;
  exp.updateCollections = configuredCollectionRoutes.updateCollections;
  exp.viewCollection = configuredCollectionRoutes.viewCollection;
  exp.dropIndex = configuredCollectionRoutes.dropIndex;
  exp.reIndex = configuredCollectionRoutes.reIndex;
  exp.addIndex = configuredCollectionRoutes.addIndex;

  exp.getProperty = configuredDocumentRoutes.getProperty;
  exp.addDocument = configuredDocumentRoutes.addDocument;
  exp.checkValid = configuredDocumentRoutes.checkValid;
  exp.deleteDocument = configuredDocumentRoutes.deleteDocument;
  exp.updateDocument = configuredDocumentRoutes.updateDocument;
  exp.viewDocument = configuredDocumentRoutes.viewDocument;

  exp.addBucket = configuredGridFSRoute.addBucket;
  exp.deleteBucket = configuredGridFSRoute.deleteBucket;
  exp.viewBucket = configuredGridFSRoute.viewBucket;
  exp.addFile = configuredGridFSRoute.addFile;
  exp.getFile = configuredGridFSRoute.getFile;
  exp.deleteFile = configuredGridFSRoute.deleteFile;

  // Homepage route
  exp.index = async function (req, res) {
    const ctx = {
      title: 'Mongo Express',
      csrfToken: req.csrfToken(),
      nodeVersion: process.versions.node,
      v8Version: process.versions.v8,
    };

    if (req.adminDb === undefined) {
      return res.render('index', ctx);
    }

    if (config.mongodb.admin === true) {
      await req.adminDb.serverStatus().then((info) => {
        ctx.info = info;
        if (info && info.uptime) {
          ctx.uptimeDays = Math.floor(info.uptime / 86400);
        }
      }).catch((error) => {
        // TODO: handle error
        console.error(error);
      });
    } else {
      ctx.info = false;
    }
    res.render('index', ctx);
  };

  return exp;
};

export default index;
