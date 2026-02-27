import mongodb from 'mongodb';

const _fetchCollectionNames = async (dbConnection) => {
  const collections = await dbConnection.db.listCollections().toArray();
  return collections.map((c) => c.name).sort();
};

const connect = async function (config) {
  // connectionData gets passed back from this method
  // some fields will not be populated until a connection is established
  const connectionData = {
    clients: [],
    // mainClient:           undefined,
    collections: {},
    connections: {},
  };

  // update the collections list
  connectionData.updateCollections = async function (dbConnection) {
    if (!dbConnection.fullName) {
      console.error('Received db instead of db connection');
      return [];
    }
    const collections = await dbConnection.db.listCollections().toArray();
    const names = [];
    for (const collection of collections) {
      names.push(collection.name);
    }
    connectionData.collections[dbConnection.fullName] = names.sort();
    return collections;
  };

  // update database list (with TTL cache + promise coalescing)
  const REFRESH_TTL = 30_000; // 30 seconds
  let _lastRefresh = 0;
  let _refreshPromise = null;

  const _doRefresh = async () => {
    const newConnections = {};
    const newCollections = {};

    await Promise.all(
      connectionData.clients.map(async (connectionInfo) => {
        const addConnection = (db, dbName) => {
          const fullName = connectionData.clients.length > 1
            ? `${connectionInfo.connectionName}_${dbName}`
            : dbName;
          const newConnection = {
            info: connectionInfo,
            dbName,
            fullName,
            db,
          };
          newConnections[fullName] = newConnection;
          return newConnection;
        };

        if (connectionInfo.adminDb) {
          const allDbs = await connectionInfo.adminDb.listDatabases();
          for (const { name: dbName } of allDbs.databases) {
            if (!dbName) continue;
            if (connectionInfo.info.whitelist.length > 0 && !connectionInfo.info.whitelist.includes(dbName)) {
              continue;
            }
            if (connectionInfo.info.blacklist.length > 0 && connectionInfo.info.blacklist.includes(dbName)) {
              continue;
            }
            const connection = addConnection(connectionInfo.client.db(dbName), dbName);
             
            newCollections[connection.fullName] = await _fetchCollectionNames(connection);
          }
        } else {
          const dbConnection = connectionInfo.client.db();
          const dbName = dbConnection.databaseName;
          const connection = addConnection(dbConnection, dbName);
          newCollections[connection.fullName] = await _fetchCollectionNames(connection);
        }
      }),
    );

    // Atomic swap — readers never see empty intermediate state
    connectionData.connections = newConnections;
    connectionData.collections = newCollections;
    _lastRefresh = Date.now();
  };

  connectionData.updateDatabases = async function (force = false) {
    // Return cached if fresh and not a forced refresh
    if (!force && (Date.now() - _lastRefresh < REFRESH_TTL)) return;

    // Coalesce concurrent calls — reuse in-flight promise
    if (_refreshPromise) return _refreshPromise;

    _refreshPromise = _doRefresh();
    try {
      await _refreshPromise;
    } finally {
      _refreshPromise = null;
    }
  };

  connectionData.getDatabases = () => Object.keys(connectionData.connections).sort();

  // database connections
  const connections = Array.isArray(config.mongodb) ? config.mongodb : [config.mongodb];
  connectionData.clients = await Promise.all(connections.map(async (connectionInfo, index) => {
    const {
      connectionString, connectionName, admin, connectionOptions,
    } = connectionInfo;
    try {
      const client = await mongodb.MongoClient.connect(connectionString, connectionOptions);
      const adminDb = admin ? client.db().admin() : null;
      return {
        connectionName: connectionName || `connection${index}`,
        client,
        adminDb,
        info: connectionInfo,
      };
    } catch (error) {
      let safeString = connectionString;
      try {
        const parsed = new URL(connectionString);
        if (parsed.password) {
          parsed.password = '****';
        }
        safeString = parsed.toString();
      } catch {
        safeString = connectionString.replace(/(\/\/[^:]*:)[^@]*@/, '$1****@');
      }
      console.error(`Could not connect to database using connectionString: ${safeString}`);
      throw error;
    }
  }));
  if (!connectionData.mainClient) {
    const client = connectionData.clients[0];
    connectionData.mainClient = client;
  }

  await connectionData.updateDatabases();

  return connectionData;
};

export default connect;
