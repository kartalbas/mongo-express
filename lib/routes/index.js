// Add routes from other files
import collectionRoute from './collection.js';
import databaseRoute from './database.js';
import documentRoute from './document.js';
import gridFSRoute from './gridfs.js';
import monitoringRoute from './monitoring.js';
import replicationRoute from './replication.js';
import usersRoute from './users.js';
import shellRoute from './shell.js';

const index = function (config) {
  const exp = {};

  const configuredDatabaseRoutes = databaseRoute(config);
  const configuredCollectionRoutes = collectionRoute(config);
  const configuredDocumentRoutes = documentRoute(config);
  const configuredGridFSRoute = gridFSRoute(config);
  const configuredMonitoringRoutes = monitoringRoute(config);
  const configuredReplicationRoutes = replicationRoute(config);
  const configuredUsersRoutes = usersRoute(config);
  const configuredShellRoutes = shellRoute(config);

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

  // Feature 1: Aggregation Pipeline
  exp.viewAggregate = configuredCollectionRoutes.viewAggregate;
  exp.runAggregatePipeline = configuredCollectionRoutes.runAggregatePipeline;

  // Feature 2: Explain Plan
  exp.explainQuery = configuredCollectionRoutes.explainQuery;

  // Feature 4: Schema Analysis
  exp.schemaAnalysis = configuredCollectionRoutes.schemaAnalysis;

  // Feature 5: Validation Rules
  exp.viewValidation = configuredCollectionRoutes.viewValidation;
  exp.updateValidation = configuredCollectionRoutes.updateValidation;

  // Feature 7: Bulk Delete
  exp.bulkDelete = configuredCollectionRoutes.bulkDelete;

  // Feature 8: Index Stats
  exp.indexStats = configuredCollectionRoutes.indexStats;

  exp.getProperty = configuredDocumentRoutes.getProperty;
  exp.addDocument = configuredDocumentRoutes.addDocument;
  exp.checkValid = configuredDocumentRoutes.checkValid;
  exp.deleteDocument = configuredDocumentRoutes.deleteDocument;
  exp.updateDocument = configuredDocumentRoutes.updateDocument;
  exp.viewDocument = configuredDocumentRoutes.viewDocument;

  // Feature 6: Inline Cell Editing
  exp.patchDocument = configuredDocumentRoutes.patchDocument;

  exp.addBucket = configuredGridFSRoute.addBucket;
  exp.deleteBucket = configuredGridFSRoute.deleteBucket;
  exp.viewBucket = configuredGridFSRoute.viewBucket;
  exp.addFile = configuredGridFSRoute.addFile;
  exp.getFile = configuredGridFSRoute.getFile;
  exp.deleteFile = configuredGridFSRoute.deleteFile;

  // Feature 10: Monitoring
  exp.viewMonitoring = configuredMonitoringRoutes.viewMonitoring;
  exp.getMetrics = configuredMonitoringRoutes.getMetrics;
  exp.getProfilerData = configuredMonitoringRoutes.getProfilerData;
  exp.setProfilerLevel = configuredMonitoringRoutes.setProfilerLevel;

  // Feature 12: Replication
  exp.viewReplication = configuredReplicationRoutes.viewReplication;

  // Feature 11: User Management
  exp.viewUsers = configuredUsersRoutes.viewUsers;
  exp.addUser = configuredUsersRoutes.addUser;
  exp.updateUser = configuredUsersRoutes.updateUser;
  exp.deleteUser = configuredUsersRoutes.deleteUser;

  // Feature 15: Shell
  exp.viewShell = configuredShellRoutes.viewShell;
  exp.executeShell = configuredShellRoutes.executeShell;

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
