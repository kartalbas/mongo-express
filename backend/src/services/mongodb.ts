import { MongoClient } from 'mongodb';
import type { Admin, MongoClientOptions } from 'mongodb';
import type { Config } from '../config.js';
import type { MongoConnectionData, MongoConnectionInfo, DbConnection } from '../types/index.js';

const REFRESH_TTL = 30_000; // 30 seconds

let connectionData: MongoConnectionData | null = null;

export function getConnectionData(): MongoConnectionData {
  if (!connectionData) {
    throw new Error('MongoDB not connected. Call connectMongo() first.');
  }
  return connectionData;
}

export async function connectMongo(config: Config): Promise<MongoConnectionData> {
  const connectionOptions: MongoClientOptions = {
    tls: config.mongodbTls,
    tlsAllowInvalidCertificates: config.mongodbTlsAllowInvalidCerts,
    tlsCAFile: config.mongodbTlsCaFile,
    maxPoolSize: 4,
  };

  let client: MongoClient;
  try {
    client = await MongoClient.connect(config.mongodbUrl, connectionOptions);
  } catch (error) {
    // Redact password from connection string in error logs
    let safeString = config.mongodbUrl;
    try {
      const parsed = new URL(config.mongodbUrl);
      if (parsed.password) {
        parsed.password = '****';
      }
      safeString = parsed.toString();
    } catch {
      safeString = config.mongodbUrl.replace(/(\/\/[^:]*:)[^@]*@/, '$1****@');
    }
    console.error(`Could not connect to MongoDB: ${safeString}`);
    throw error;
  }

  const adminDb: Admin | null = config.mongodbAdmin ? client.db().admin() : null;

  const mainClient: MongoConnectionInfo = {
    connectionName: 'default',
    client,
    adminDb,
    info: {
      connectionString: config.mongodbUrl,
      connectionName: 'default',
      admin: config.mongodbAdmin,
      whitelist: [],
      blacklist: [],
      connectionOptions: connectionOptions as Record<string, unknown>,
    },
  };

  let connections: Record<string, DbConnection> = {};
  let collections: Record<string, string[]> = {};
  let lastRefresh = 0;
  let refreshPromise: Promise<void> | null = null;

  const doRefresh = async (): Promise<void> => {
    const newConnections: Record<string, DbConnection> = {};
    const newCollections: Record<string, string[]> = {};

    if (adminDb) {
      const allDbs = await adminDb.listDatabases();
      for (const { name: dbName } of allDbs.databases) {
        if (!dbName) continue;
        const db = client.db(dbName);
        const dbCollections = await db.listCollections().toArray();
        newConnections[dbName] = {
          info: mainClient,
          dbName,
          fullName: dbName,
          db,
        };
        newCollections[dbName] = dbCollections.map((c) => c.name).sort();
      }
    } else {
      const db = client.db();
      const dbName = db.databaseName;
      const dbCollections = await db.listCollections().toArray();
      newConnections[dbName] = {
        info: mainClient,
        dbName,
        fullName: dbName,
        db,
      };
      newCollections[dbName] = dbCollections.map((c) => c.name).sort();
    }

    connections = newConnections;
    collections = newCollections;
    lastRefresh = Date.now();
  };

  connectionData = {
    clients: [mainClient],
    mainClient,
    get connections() { return connections; },
    set connections(v) { connections = v; },
    get collections() { return collections; },
    set collections(v) { collections = v; },

    async updateDatabases(force = false): Promise<void> {
      if (!force && Date.now() - lastRefresh < REFRESH_TTL) return;
      if (refreshPromise) return refreshPromise;

      refreshPromise = doRefresh();
      try {
        await refreshPromise;
      } finally {
        refreshPromise = null;
      }
    },

    getDatabases(): string[] {
      return Object.keys(connections).sort();
    },

    async updateCollections(dbConnection: DbConnection): Promise<void> {
      const dbCollections = await dbConnection.db.listCollections().toArray();
      collections[dbConnection.fullName] = dbCollections.map((c) => c.name).sort();
    },
  };

  await connectionData.updateDatabases(true);
  console.log(`MongoDB connected (admin=${String(config.mongodbAdmin)})`);
  return connectionData;
}

export async function disconnectMongo(): Promise<void> {
  if (connectionData) {
    for (const clientInfo of connectionData.clients) {
      await clientInfo.client.close();
    }
    connectionData = null;
  }
}
