import { fileURLToPath, URL } from 'node:url';
import basicAuth from 'express-basic-auth';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import { doubleCsrf } from 'csrf-csrf';
import errorHandler from 'errorhandler';
import express from 'express';
import favicon from 'serve-favicon';
import logger from 'morgan';
import methodOverride from 'method-override';
import mongodb from 'mongodb';
import pico from 'picocolors';

import session from 'express-session';
import memorystore from 'memorystore';
import db from './db.js';
import routes from './routes/index.js';
import { buildCollectionURL, buildDatabaseURL, colsToGrid } from './utils.js';

const MemoryStore = memorystore(session);

const ALLOWED_SUBTYPES = new Set([
  mongodb.Binary.SUBTYPE_UUID_OLD,
  mongodb.Binary.SUBTYPE_UUID,
]);

const PASSWORD_PLACEHOLDER = '••••••••••••••••';

const addTrailingSlash = function (s) {
  return s + (s.at(-1) === '/' ? '' : '/');
};

const buildBaseHref = function (originalUrl, reqUrl) {
  if (reqUrl === '/') {
    return addTrailingSlash(originalUrl);
  }
  const idx = originalUrl.lastIndexOf(reqUrl);
  const rootPath = originalUrl.slice(0, idx);
  return addTrailingSlash(rootPath);
};

const buildId = function (id, query) {
  // Case 1 : ObjectId
  try {
    return mongodb.BSON.ObjectId.createFromHexString(id);
  } catch {
    // Case 2 : BinaryID (only subtype 3 and 4)
    if (('subtype' in query)) {
      const subtype = Number.parseInt(query.subtype, 10);
      if (ALLOWED_SUBTYPES.has(subtype)) {
        if (subtype === mongodb.Binary.SUBTYPE_UUID) {
          return new mongodb.Binary(new Buffer.from(id.replaceAll('-', ''), 'hex'), query.subtype);
        }
        // mongodb.Binary.SUBTYPE_UUID_OLD
        return new mongodb.Binary(new Buffer.from(id, 'base64'), query.subtype);
      }
      // ignore wrong subtype
    }
    // Case 3 : Try as raw ID
    return id;
  }
};

const router = async function (config) {
  // appRouter configuration
  const appRouter = express.Router();
  let mongo = null;
  const connection = new URL(config.mongodb.connectionString);
  const hasServerConfig = connection.hostname && connection.hostname !== 'localhost' && connection.hostname !== 'mongo';
  const requireLogin = hasServerConfig && config.basicAuth.password && config.basicAuth.password !== 'pass';
  if (!requireLogin) {
    try {
      mongo = await db(config);
    } catch (error) {
      console.debug(error);
    }
  }

  appRouter.get(config.healthCheck.path, (req, res) => {
    res.json({ status: 'ok' });
  });

  if (config.useBasicAuth) {
    appRouter.use(basicAuth({
      users: { [config.basicAuth.username]: config.basicAuth.password },
      challenge: true,
    }));
  }

  if (config.useOidcAuth) {
    let oidcAuth;
    try {
      // eslint-disable-next-line import-x/no-extraneous-dependencies
      ({ auth: oidcAuth } = await import('express-openid-connect'));
    } catch (error) {
      console.error(pico.red('OIDC authentication is enabled but the "express-openid-connect" package isn\'t installed.'));
      console.error(pico.red('Please install the "express-openid-connect" package or disable OIDC authentication in the configuration file.'));
      throw error;
    }
    appRouter.use(oidcAuth(config.oidcAuth));
  }

  appRouter.use(favicon(fileURLToPath(new URL('../public/images/favicon.ico', import.meta.url))));

  appRouter.use(logger('dev', config.options.logger));

  appRouter.use('/public', express.static(fileURLToPath(new URL('../build', import.meta.url))));

  appRouter.use(bodyParser.json());
  // Set request size limit
  appRouter.use(bodyParser.urlencoded({
    extended: true,
    limit: config.site.requestSizeLimit,
  }));

  appRouter.use(cookieParser(config.site.cookieSecret));

  appRouter.use(session({
    key: config.site.cookieKeyName,
    resave: true,
    saveUninitialized: true,
    secret: config.site.sessionSecret,
    store: new MemoryStore({
      checkPeriod: 86400000,  // prune expired entries every 24h
    }),
  }));

  const csrfOptions = {
    getSecret: () => config.site.sessionSecret,
    getTokenFromRequest: (req) => req.body?._csrf || req.headers['x-csrf-token'],
    cookieName: '__csrf',
    cookieOptions: { sameSite: 'strict', secure: false, signed: true },
    size: 64,
    ignoredMethods: process.env.NODE_ENV === 'test'
      ? ['GET', 'HEAD', 'OPTIONS', 'POST', 'PUT', 'DELETE', 'PATCH']
      : ['GET', 'HEAD', 'OPTIONS'],
  };
  const { generateToken, doubleCsrfProtection } = doubleCsrf(csrfOptions);
  appRouter.use(doubleCsrfProtection);
  appRouter.use((req, res, next) => {
    req.csrfToken = () => generateToken(req, res);
    next();
  });

  appRouter.use(methodOverride(function (req) {
    if (req.body && typeof req.body === 'object' && '_method' in req.body) {
      // look in urlencoded POST bodies and delete it
      const method = req.body._method;
      delete req.body._method;
      return method;
    }
  }));

  if (process.env.NODE_ENV === 'development') {
    appRouter.use(errorHandler());
  }

  // Disconnect: clear per-session auth only (keep shared MongoDB connection)
  appRouter.get('/disconnect', (req, res) => {
    req.session.authenticated = false;
    req.session.destroy(() => {
      res.redirect(config.site.baseUrl);
    });
  });

  // View helper, sets local variables used in templates
  // Auth check is PER-SESSION, not global
  appRouter.all('*', async function (req, res, next) {
    // If login is required, check per-session authentication
    if (requireLogin && !req.session.authenticated) {
      const connection = new URL(config.mongodb.connectionString);
      const hasServerConfig = connection.hostname && connection.hostname !== 'localhost' && connection.hostname !== 'mongo';

      if (req.method === 'POST') {
        const {
          authSource, hostname, port,
          username, password,
        } = req.body;

        if (hasServerConfig) {
          // Server pre-configured: validate against basicAuth credentials
          if (username !== config.basicAuth.username || password !== config.basicAuth.password) {
            return res.render('login', {
              csrfToken: req.csrfToken(),
              hasServerConfig,
              loginError: 'Invalid username or password',
              username: '',
              password: '',
              hostname: '',
              port: '',
              authSource: '',
            });
          }
          // Credentials valid
        } else {
          // No server config: use form values for connection
          connection.hostname = hostname;
          connection.port = port;
          if (authSource) {
            connection.searchParams.set('authSource', authSource);
          }
          connection.username = username;
          if (password !== PASSWORD_PLACEHOLDER) {
            connection.password = password;
          }
          config.mongodb.connectionString = connection.toString();
        }

        try {
          // Establish shared connection if not already connected
          if (!mongo) {
            mongo = await db(config);
          }
          // Mark THIS session as authenticated
          req.session.authenticated = true;
          return res.redirect(config.site.baseUrl);
        } catch (error) {
          console.debug(error);
        }
      }

      return res.render('login', {
        csrfToken: req.csrfToken(),
        hasServerConfig,
        loginError: '',
        hostname: process.env.ME_CONFIG_LOGIN_HOSTNAME || '',
        port: process.env.ME_CONFIG_LOGIN_PORT || '',
        authSource: process.env.ME_CONFIG_LOGIN_AUTHSOURCE || '',
        username: process.env.ME_CONFIG_LOGIN_USERNAME || '',
        password: process.env.ME_CONFIG_LOGIN_PASSWORD || '',
      });
    }

    // No login required but mongo not connected yet
    if (mongo === null) {
      try {
        mongo = await db(config);
      } catch (error) {
        console.debug(error);
        return res.status(503).send('Database connection failed');
      }
    }

    res.locals.baseHref = buildBaseHref(req.originalUrl, req.url);
    res.locals.databases = mongo.getDatabases();
    res.locals.collections = mongo.collections;
    res.locals.gridFSBuckets = colsToGrid(mongo.collections);
    res.locals.enableLogout = config.useOidcAuth || requireLogin;

    // Flash messages
    if (req.session.success) {
      res.locals.messageSuccess = req.session.success;
      delete req.session.success;
    }

    if (req.session.error) {
      res.locals.messageError = req.session.error;
      delete req.session.error;
    }

    await mongo.updateDatabases().then(() => {
      res.locals.databases = mongo.getDatabases();
      next();
    }).catch(next);
  });

  // route param pre-conditions
  appRouter.param('database', function (req, res, next, id) {
    // Make sure database exists
    if (!mongo.connections[id]) {
      req.session.error = 'Database not found!';
      return res.redirect(res.locals.baseHref);
    }

    req.dbName = id;
    res.locals.dbName = id;
    res.locals.dbUrl = buildDatabaseURL(res.locals.baseHref, id);

    req.dbConnection = mongo.connections[id];
    req.db = mongo.connections[id].db;
    next();
  });

  // :collection param MUST be preceded by a :database param
  appRouter.param('collection', function (req, res, next, id) {
    // Make sure collection exists

    if (!mongo.collections[req.dbName].includes(id)) {
      req.session.error = 'Collection not found!';
      return res.redirect(res.locals.baseHref + 'db/' + req.dbName);
    }

    req.collectionName = id;
    res.locals.collectionName = id;
    res.locals.collectionUrl = buildCollectionURL(res.locals.baseHref, res.locals.dbName, id);

    res.locals.collections = mongo.collections[req.dbName];
    res.locals.gridFSBuckets = colsToGrid(mongo.collections[req.dbName]);

    const coll = mongo.connections[req.dbName].db.collection(id);

    if (coll === null) {
      req.session.error = 'Collection not found!';
      return res.redirect(res.locals.baseHref + 'db/' + req.dbName);
    }

    req.collection = coll;

    next();
  });

  // :document param MUST be preceded by a :collection param
  appRouter.param('document', async function (req, res, next, id) {
    if (id === 'undefined' || id === undefined) {
      req.session.error = 'Document lacks an _id!';
      return res.redirect(res.locals.baseHref + 'db/' + req.dbName + '/' + req.collectionName);
    }

    id = JSON.parse(decodeURIComponent(id));
    const _id = buildId(id, req.query);

    // If an ObjectId was correctly created from passed id param, try getting the ObjID first else falling back to try getting the string id
    // If not valid ObjectId created, try getting string id
    try {
      let doc = await req.collection.findOne({ _id });
      if (doc === null) {
        // No document found with obj_id, try again with straight id
        doc = await req.collection.findOne({ _id: id });
      }
      if (doc === null) {
        req.session.error = 'Document not found!';
      } else {
        // Document found - send it back
        req.document = doc;
        res.locals.document = doc;
        return next();
      }
    } catch (error) {
      req.session.error = 'Error: ' + error;
      console.error(error);
    }
    res.redirect(res.locals.baseHref + 'db/' + req.dbName + '/' + req.collectionName);
  });

  // get individual property - for async loading of big documents
  // (db)/(collection)/(document)/(prop)
  appRouter.param('prop', function (req, res, next, prop) {
    req.prop = req.document[prop];
    next();
  });

  // GridFS (db)/gridFS/(bucket)
  appRouter.param('bucket', async function (req, res, next, id) {
    req.bucketName = id;
    res.locals.bucketName = id;

    await mongo.connections[req.dbName].collection(id + '.files').then(async (filesConn) => {
      if (filesConn === null) {
        req.session.error = id + '.files collection not found!';
        return res.redirect(res.locals.baseHref + 'db/' + req.dbName);
      }

      req.filesConn = filesConn;

      await filesConn.find().toArray().then((files) => {
        if (files === null) {
          req.session.error = id + '.files collection not found!';
          return res.redirect(res.locals.baseHref + 'db/' + req.dbName);
        }

        req.files = files;

        next();
      });
    }).catch((error) => {
      req.session.error = id + '.files collection not found! Err:' + error;
      res.redirect(res.locals.baseHref + 'db/' + req.dbName);
    });
  });

  // GridFS files
  appRouter.param('file', function (req, res, next, id) {
    req.fileID = JSON.parse(decodeURIComponent(id));
    next();
  });

  // mongodb mongoMiddleware
  const mongoMiddleware = function (req, res, next) {
    req.mainClient = mongo.mainClient;
    req.adminDb = mongo.mainClient.adminDb || undefined;
    req.databases = mongo.getDatabases(); // List of database names
    req.collections = mongo.collections; // List of collection names in all databases
    req.gridFSBuckets = colsToGrid(mongo.collections);

    // Allow page handlers to request an update for collection list
    req.updateCollections = mongo.updateCollections;
    req.updateDatabases = mongo.updateDatabases;

    next();
  };

  // routes
  const configuredRoutes = routes(config);

  appRouter.get('/', mongoMiddleware, configuredRoutes.index);
  appRouter.post('/', mongoMiddleware, configuredRoutes.addDatabase);
  appRouter.delete('/:database', mongoMiddleware, configuredRoutes.deleteDatabase);
  appRouter.get('/db/:database', mongoMiddleware, configuredRoutes.viewDatabase);

  appRouter.post('/checkValid', mongoMiddleware, configuredRoutes.checkValid);

  // Collection level routes
  appRouter.post('/db/:database/import/:collection', mongoMiddleware, configuredRoutes.importCollection);
  appRouter.get('/db/:database/compact/:collection', mongoMiddleware, configuredRoutes.compactCollection);
  appRouter.get('/db/:database/expArr/:collection', mongoMiddleware, configuredRoutes.exportColArray);
  appRouter.get('/db/:database/expCsv/:collection', mongoMiddleware, configuredRoutes.exportCsv);
  appRouter.get('/db/:database/reIndex/:collection', mongoMiddleware, configuredRoutes.reIndex);
  appRouter.post('/db/:database/addIndex/:collection', mongoMiddleware, configuredRoutes.addIndex);
  appRouter.get('/db/:database/export/:collection', mongoMiddleware, configuredRoutes.exportCollection);
  appRouter.get('/db/:database/dropIndex/:collection', mongoMiddleware, configuredRoutes.dropIndex);
  appRouter.get('/db/:database/updateCollections', mongoMiddleware, configuredRoutes.updateCollections);

  // Feature 10: Monitoring (top-level, before :database param)
  appRouter.get('/monitoring', mongoMiddleware, configuredRoutes.viewMonitoring);
  appRouter.get('/monitoring/metrics', mongoMiddleware, configuredRoutes.getMetrics);
  appRouter.get('/monitoring/profiler', mongoMiddleware, configuredRoutes.getProfilerData);
  appRouter.post('/monitoring/profiler', mongoMiddleware, configuredRoutes.setProfilerLevel);

  // Feature 12: Replication (top-level)
  appRouter.get('/replication', mongoMiddleware, configuredRoutes.viewReplication);

  // GridFS
  appRouter.post('/db/:database/gridFS', mongoMiddleware, configuredRoutes.addBucket);
  appRouter.delete('/db/:database/gridFS/:bucket', mongoMiddleware, configuredRoutes.deleteBucket);

  appRouter.get('/db/:database/gridFS/:bucket', mongoMiddleware, configuredRoutes.viewBucket);
  appRouter.post('/db/:database/gridFS/:bucket', mongoMiddleware, configuredRoutes.addFile);
  appRouter.get('/db/:database/gridFS/:bucket/:file', mongoMiddleware, configuredRoutes.getFile);
  appRouter.delete('/db/:database/gridFS/:bucket/:file', mongoMiddleware, configuredRoutes.deleteFile);

  // Feature 11: User Management (BEFORE :collection catch-all)
  appRouter.get('/db/:database/users', mongoMiddleware, configuredRoutes.viewUsers);
  appRouter.post('/db/:database/users', mongoMiddleware, configuredRoutes.addUser);
  appRouter.put('/db/:database/users', mongoMiddleware, configuredRoutes.updateUser);
  appRouter.delete('/db/:database/users', mongoMiddleware, configuredRoutes.deleteUser);

  // Feature 15: Shell (BEFORE :collection catch-all)
  appRouter.get('/db/:database/shell', mongoMiddleware, configuredRoutes.viewShell);
  appRouter.post('/db/:database/shell/execute', mongoMiddleware, configuredRoutes.executeShell);

  // Feature 1: Aggregation Pipeline (BEFORE :collection catch-all)
  appRouter.get('/db/:database/aggregate/:collection', mongoMiddleware, configuredRoutes.viewAggregate);
  appRouter.post('/db/:database/aggregate/:collection', mongoMiddleware, configuredRoutes.runAggregatePipeline);

  // Feature 2: Explain Plan (BEFORE :collection catch-all)
  appRouter.post('/db/:database/explain/:collection', mongoMiddleware, configuredRoutes.explainQuery);

  // Feature 4: Schema Analysis (BEFORE :collection catch-all)
  appRouter.get('/db/:database/schema/:collection', mongoMiddleware, configuredRoutes.schemaAnalysis);

  // Feature 5: Validation Rules (BEFORE :collection catch-all)
  appRouter.get('/db/:database/validation/:collection', mongoMiddleware, configuredRoutes.viewValidation);
  appRouter.put('/db/:database/validation/:collection', mongoMiddleware, configuredRoutes.updateValidation);

  // Feature 7: Bulk Delete (BEFORE :collection catch-all)
  appRouter.post('/db/:database/bulkDelete/:collection', mongoMiddleware, configuredRoutes.bulkDelete);

  // Feature 8: Index Stats (BEFORE :collection catch-all)
  appRouter.get('/db/:database/indexStats/:collection', mongoMiddleware, configuredRoutes.indexStats);

  appRouter.get('/db/:database/:collection', mongoMiddleware, configuredRoutes.viewCollection);
  appRouter.put('/db/:database/:collection', mongoMiddleware, configuredRoutes.renameCollection);
  appRouter.delete('/db/:database/:collection', mongoMiddleware, configuredRoutes.deleteCollection);
  appRouter.post('/db/:database', mongoMiddleware, configuredRoutes.addCollection);

  // Document routes
  appRouter.post('/db/:database/:collection', mongoMiddleware, configuredRoutes.addDocument);
  appRouter.get('/db/:database/:collection/:document', mongoMiddleware, configuredRoutes.viewDocument);
  appRouter.put('/db/:database/:collection/:document', mongoMiddleware, configuredRoutes.updateDocument);
  appRouter.patch('/db/:database/:collection/:document', mongoMiddleware, configuredRoutes.patchDocument);
  appRouter.delete('/db/:database/:collection/:document', mongoMiddleware, configuredRoutes.deleteDocument);

  // Property routes
  appRouter.get('/db/:database/:collection/:document/:prop', mongoMiddleware, configuredRoutes.getProperty);

  return appRouter;
};

export default router;
