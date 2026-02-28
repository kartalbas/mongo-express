import { Router } from 'express';
import { z } from 'zod';
import { getConnectionData } from '../services/mongodb.js';
import { getLang, t, sendResponse } from '../i18n/index.js';
import type { ServerMetrics, CurrentOperation, SlowQuery } from '../types/index.js';

const profilerLevelSchema = z.object({
  db: z.string().min(1, 'db is required'),
  level: z.number().int().min(0).max(2),
  slowms: z.number().int().min(0).default(100),
});

const profilerQuerySchema = z.object({
  db: z.string().min(1, 'db parameter required'),
  sort: z.string().default('ts'),
  dir: z.enum(['asc', 'desc']).default('desc'),
  type: z.string().optional(),
  minMs: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

// Helper to safely extract a value from a Document (Record<string, unknown>)
function safeGet<T>(obj: unknown, key: string, fallback: T): T {
  if (obj !== null && obj !== undefined && typeof obj === 'object' && key in obj) {
    return (obj as Record<string, unknown>)[key] as T;
  }
  return fallback;
}

function safeNested<T>(obj: unknown, key1: string, key2: string, fallback: T): T {
  const inner = safeGet<unknown>(obj, key1, null);
  if (inner === null || inner === undefined) return fallback;
  return safeGet(inner, key2, fallback);
}

function mapOperation(op: Record<string, unknown>): CurrentOperation {
  const microsecsRunning = safeGet<number>(op, 'microsecs_running', 0);
  const secsRunning = safeGet<number>(op, 'secs_running', 0);
  const command = safeGet<unknown>(op, 'command', null);
  const locks = safeGet<unknown>(op, 'locks', null);

  return {
    opid: safeGet<string>(op, 'opid', ''),
    type: safeGet<string>(op, 'type', '') || safeGet<string>(op, 'op', ''),
    ns: safeGet<string>(op, 'ns', ''),
    microsecs: microsecsRunning || (secsRunning ? secsRunning * 1_000_000 : 0),
    desc: safeGet<string>(op, 'desc', ''),
    active: safeGet<boolean>(op, 'active', false),
    waitingForLock: safeGet<boolean>(op, 'waitingForLock', false),
    client: safeGet<string>(op, 'client', '') || safeGet<string>(op, 'client_s', ''),
    appName: safeGet<string>(op, 'appName', ''),
    command: command ? JSON.stringify(command, null, 2) : '',
    planSummary: safeGet<string>(op, 'planSummary', ''),
    numYields: safeGet<number>(op, 'numYields', 0),
    locks: locks ? JSON.stringify(locks) : '',
  };
}

export function createMonitoringRoutes() {
  const router = Router();

  // GET /api/monitoring/metrics
  router.get('/metrics', async (req, res, next) => {
    try {
      const lang = getLang(req);
      const connData = getConnectionData();
      const adminDb = connData.mainClient?.adminDb;

      if (!adminDb) {
        sendResponse(res, 403, null, {
          show: true,
          type: 'error',
          message: t(lang, 'be.error.forbiddenMonitoring'),
        });
        return;
      }

      const status = await adminDb.serverStatus() as Record<string, unknown>;

      const metrics: ServerMetrics = {
        timestamp: Date.now(),
        host: safeGet<string>(status, 'host', ''),
        version: safeGet<string>(status, 'version', 'unknown'),
        uptime: safeGet<number>(status, 'uptime', 0),
        connections: {
          current: safeNested<number>(status, 'connections', 'current', 0),
          available: safeNested<number>(status, 'connections', 'available', 0),
          totalCreated: safeNested<number>(status, 'connections', 'totalCreated', 0),
        },
        opcounters: {
          insert: safeNested<number>(status, 'opcounters', 'insert', 0),
          query: safeNested<number>(status, 'opcounters', 'query', 0),
          update: safeNested<number>(status, 'opcounters', 'update', 0),
          delete: safeNested<number>(status, 'opcounters', 'delete', 0),
          getmore: safeNested<number>(status, 'opcounters', 'getmore', 0),
          command: safeNested<number>(status, 'opcounters', 'command', 0),
        },
        memory: {
          resident: safeNested<number>(status, 'mem', 'resident', 0),
          virtual: safeNested<number>(status, 'mem', 'virtual', 0),
          mapped: safeNested<number>(status, 'mem', 'mapped', 0),
        },
        network: {
          bytesIn: safeNested<number>(status, 'network', 'bytesIn', 0),
          bytesOut: safeNested<number>(status, 'network', 'bytesOut', 0),
          numRequests: safeNested<number>(status, 'network', 'numRequests', 0),
        },
        globalLock: (() => {
          const gl = safeGet<unknown>(status, 'globalLock', null);
          return {
            currentQueueTotal: safeNested<number>(gl, 'currentQueue', 'total', 0),
            currentQueueReaders: safeNested<number>(gl, 'currentQueue', 'readers', 0),
            currentQueueWriters: safeNested<number>(gl, 'currentQueue', 'writers', 0),
            activeClientsTotal: safeNested<number>(gl, 'activeClients', 'total', 0),
            activeClientsReaders: safeNested<number>(gl, 'activeClients', 'readers', 0),
            activeClientsWriters: safeNested<number>(gl, 'activeClients', 'writers', 0),
          };
        })(),
        extraInfo: {
          pageFaults: safeNested<number>(status, 'extra_info', 'page_faults', 0),
        },
        repl: safeGet<unknown>(status, 'repl', null) ? {
          setName: safeNested<string>(status, 'repl', 'setName', ''),
          isWritablePrimary: Boolean(
            safeNested<unknown>(status, 'repl', 'isWritablePrimary', null)
            ?? safeNested<unknown>(status, 'repl', 'ismaster', false),
          ),
          hosts: safeNested<string[]>(status, 'repl', 'hosts', []),
        } : null,
      };

      // Current operations
      let currentOps: CurrentOperation[] = [];
      try {
        const opsResult = await adminDb.command({ currentOp: 1, $all: true }) as Record<string, unknown>;
        const inprog = safeGet<Record<string, unknown>[]>(opsResult, 'inprog', []);
        currentOps = inprog.slice(0, 100).map(mapOperation);
      } catch {
        // currentOp may not be available
      }

      sendResponse(res, 200, { metrics, currentOps }, null);
    } catch (error) {
      next(error);
    }
  });

  // GET /api/monitoring/operations
  router.get('/operations', async (req, res, next) => {
    try {
      const lang = getLang(req);
      const connData = getConnectionData();
      const adminDb = connData.mainClient?.adminDb;

      if (!adminDb) {
        sendResponse(res, 403, null, {
          show: true,
          type: 'error',
          message: t(lang, 'be.error.forbidden'),
        });
        return;
      }

      const opsResult = await adminDb.command({ currentOp: 1, $all: true }) as Record<string, unknown>;
      const inprog = safeGet<Record<string, unknown>[]>(opsResult, 'inprog', []);
      const operations = inprog.slice(0, 100).map(mapOperation);

      sendResponse(res, 200, { operations }, null);
    } catch (error) {
      next(error);
    }
  });

  // GET /api/monitoring/profiler
  router.get('/profiler', async (req, res, next) => {
    try {
      const lang = getLang(req);
      const connData = getConnectionData();
      const mainClient = connData.mainClient;

      if (!mainClient?.adminDb) {
        sendResponse(res, 403, null, {
          show: true,
          type: 'error',
          message: t(lang, 'be.error.forbidden'),
        });
        return;
      }

      const parsed = profilerQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        const firstError = parsed.error.errors[0];
        sendResponse(res, 400, null, {
          show: true,
          type: 'error',
          message: firstError?.message ?? t(lang, 'be.validation.failed'),
        });
        return;
      }

      const { db: dbName, sort, dir, type, minMs, limit } = parsed.data;
      const db = mainClient.client.db(dbName);

      // Get current profiler status
      let profilerLevel = 0;
      let slowms = 100;
      try {
        const profilerStatus = await db.command({ profile: -1 }) as Record<string, unknown>;
        profilerLevel = safeGet<number>(profilerStatus, 'was', 0);
        slowms = safeGet<number>(profilerStatus, 'slowms', 100);
      } catch {
        // may not have permission
      }

      // Read from system.profile
      const filter: Record<string, unknown> = {};
      if (type) filter['op'] = type;
      if (minMs > 0) filter['millis'] = { $gte: minMs };

      let slowQueries: SlowQuery[] = [];
      try {
        const sortObj: Record<string, 1 | -1> = { [sort]: dir === 'asc' ? 1 : -1 };
        const docs = await db.collection('system.profile')
          .find(filter)
          .sort(sortObj)
          .limit(limit)
          .toArray();

        slowQueries = docs.map((doc): SlowQuery => {
          const tsVal = safeGet<Date | null>(doc, 'ts', null);
          const command = safeGet<unknown>(doc, 'command', null);
          const execStats = safeGet<unknown>(doc, 'execStats', null);

          return {
            ts: tsVal ? new Date(tsVal).toISOString() : '',
            op: safeGet<string>(doc, 'op', ''),
            ns: safeGet<string>(doc, 'ns', ''),
            millis: safeGet<number>(doc, 'millis', 0),
            planSummary: safeGet<string>(doc, 'planSummary', ''),
            keysExamined: safeGet<number>(doc, 'keysExamined', 0),
            docsExamined: safeGet<number>(doc, 'docsExamined', 0),
            nreturned: safeGet<number>(doc, 'nreturned', 0),
            responseLength: safeGet<number>(doc, 'responseLength', 0),
            client: safeGet<string>(doc, 'client', ''),
            appName: safeGet<string>(doc, 'appName', ''),
            command: command ? JSON.stringify(command, null, 2) : '',
            execStats: execStats ? JSON.stringify(execStats, null, 2) : '',
          };
        });
      } catch {
        // system.profile may not exist
      }

      sendResponse(res, 200, { profilerLevel, slowms, slowQueries }, null);
    } catch (error) {
      next(error);
    }
  });

  // POST /api/monitoring/profiler/level
  router.post('/profiler/level', async (req, res, next) => {
    try {
      const lang = getLang(req);
      const connData = getConnectionData();
      const mainClient = connData.mainClient;

      if (!mainClient?.adminDb) {
        sendResponse(res, 403, null, {
          show: true,
          type: 'error',
          message: t(lang, 'be.error.forbidden'),
        });
        return;
      }

      const parsed = profilerLevelSchema.safeParse(req.body);
      if (!parsed.success) {
        const firstError = parsed.error.errors[0];
        sendResponse(res, 400, null, {
          show: true,
          type: 'error',
          message: firstError?.message ?? t(lang, 'be.validation.failed'),
        });
        return;
      }

      const { db: dbName, level, slowms } = parsed.data;
      const db = mainClient.client.db(dbName);
      await db.command({ profile: level, slowms });

      sendResponse(res, 200, { level, slowms }, {
        show: true,
        type: 'success',
        message: t(lang, 'be.monitoring.profilerSet'),
      });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/monitoring/operations/:opId/kill
  router.post('/operations/:opId/kill', async (req, res, next) => {
    try {
      const lang = getLang(req);
      const connData = getConnectionData();
      const adminDb = connData.mainClient?.adminDb;

      if (!adminDb) {
        sendResponse(res, 403, null, {
          show: true,
          type: 'error',
          message: t(lang, 'be.error.forbidden'),
        });
        return;
      }

      const { opId } = req.params;
      if (!opId) {
        sendResponse(res, 400, null, {
          show: true,
          type: 'error',
          message: t(lang, 'be.error.opIdRequired'),
        });
        return;
      }

      const parsedOpId: string | number = /^\d+$/.test(opId) ? Number(opId) : opId;
      await adminDb.command({ killOp: 1, op: parsedOpId });

      sendResponse(res, 200, null, {
        show: true,
        type: 'success',
        message: t(lang, 'be.monitoring.opKilled'),
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
