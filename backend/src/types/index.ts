import type { Request } from 'express';
import type { Admin, MongoClient, Db } from 'mongodb';

// ─── Unified API Response ───

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface ApiNotification {
  show: boolean;
  type: NotificationType;
  message: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  notification: ApiNotification | null;
}

export interface SessionInfo {
  userId: number;
  username: string;
  mustChangePassword: boolean;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  user: SessionInfo;
}

export interface NavDatabase {
  name: string;
  sizeOnDisk: number;
  empty: boolean;
  collections: string[];
}

export interface NavResponse {
  databases: NavDatabase[];
  settings: AppSettings;
}

export interface AppSettings {
  readOnly: boolean;
  gridFSEnabled: boolean;
}

// ─── Monitoring Types ───

export interface ServerMetrics {
  timestamp: number;
  host: string;
  version: string;
  uptime: number;
  connections: {
    current: number;
    available: number;
    totalCreated: number;
  };
  opcounters: {
    insert: number;
    query: number;
    update: number;
    delete: number;
    getmore: number;
    command: number;
  };
  memory: {
    resident: number;
    virtual: number;
    mapped: number;
  };
  network: {
    bytesIn: number;
    bytesOut: number;
    numRequests: number;
  };
  globalLock: {
    currentQueueTotal: number;
    currentQueueReaders: number;
    currentQueueWriters: number;
    activeClientsTotal: number;
    activeClientsReaders: number;
    activeClientsWriters: number;
  };
  extraInfo: {
    pageFaults: number;
  };
  repl: {
    setName: string;
    isWritablePrimary: boolean;
    hosts: string[];
  } | null;
}

export interface CurrentOperation {
  opid: string;
  type: string;
  ns: string;
  microsecs: number;
  desc: string;
  active: boolean;
  waitingForLock: boolean;
  client: string;
  appName: string;
  command: string;
  planSummary: string;
  numYields: number;
  locks: string;
}

export interface MetricsResponse {
  metrics: ServerMetrics;
  currentOps: CurrentOperation[];
}

export interface SlowQuery {
  ts: string;
  op: string;
  ns: string;
  millis: number;
  planSummary: string;
  keysExamined: number;
  docsExamined: number;
  nreturned: number;
  responseLength: number;
  client: string;
  appName: string;
  command: string;
  execStats: string;
}

export interface ProfilerResponse {
  profilerLevel: number;
  slowms: number;
  slowQueries: SlowQuery[];
}

// ─── MongoDB Connection Types ───

export interface MongoConnectionInfo {
  connectionName: string;
  client: MongoClient;
  adminDb: Admin | null;
  info: MongoConnectionConfig;
}

export interface MongoConnectionConfig {
  connectionString: string;
  connectionName: string;
  admin: boolean;
  whitelist: string[];
  blacklist: string[];
  connectionOptions: Record<string, unknown>;
}

export interface MongoConnectionData {
  clients: MongoConnectionInfo[];
  mainClient: MongoConnectionInfo | undefined;
  connections: Record<string, DbConnection>;
  collections: Record<string, string[]>;
  updateDatabases(force?: boolean): Promise<void>;
  getDatabases(): string[];
  updateCollections(dbConnection: DbConnection): Promise<void>;
}

export interface DbConnection {
  info: MongoConnectionInfo;
  dbName: string;
  fullName: string;
  db: Db;
}

// ─── User Types ───

export interface User {
  id: number;
  username: string;
  password_hash: string;
  must_change_password: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Express Extensions ───

declare module 'express-session' {
  interface SessionData {
    userId: number;
    username: string;
  }
}

export interface AuthenticatedRequest extends Request {
  userId: number;
  username: string;
}
