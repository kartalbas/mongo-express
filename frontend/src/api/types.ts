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

// ─── Auth ───

export interface SessionInfo {
  userId: number;
  username: string;
  mustChangePassword: boolean;
}

export interface LoginResponse {
  user: SessionInfo;
  csrfToken: string;
}

export interface SessionResponse {
  user: SessionInfo;
  csrfToken: string;
}

// ─── Navigation ───

export interface NavDatabase {
  name: string;
  sizeOnDisk: number;
  empty: boolean;
  collections: string[];
}

export interface AppSettings {
  readOnly: boolean;
  gridFSEnabled: boolean;
}

export interface NavResponse {
  databases: NavDatabase[];
  settings: AppSettings;
}

// ─── Monitoring ───

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
