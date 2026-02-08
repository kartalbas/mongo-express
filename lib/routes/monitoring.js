const routes = function (config) {
  const exp = {};

  // Feature 10: Real-time Performance Monitoring
  exp.viewMonitoring = async function (req, res) {
    if (!req.adminDb) {
      req.session.error = 'Admin access required for monitoring';
      return res.redirect(res.locals.baseHref);
    }

    // Get database list for profiler database selector
    let dbNames = [];
    try {
      const dbs = await req.adminDb.listDatabases();
      dbNames = (dbs.databases || [])
        .map((d) => d.name)
        .filter((n) => n !== 'local' && n !== 'config');
    } catch {
      // may not have listDatabases permission
    }

    res.render('monitoring', {
      title: 'Server Monitoring',
      csrfToken: req.csrfToken(),
      dbNames,
    });
  };

  // JSON API endpoint for polling from JS
  exp.getMetrics = async function (req, res) {
    try {
      if (!req.adminDb) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const status = await req.adminDb.serverStatus();

      const metrics = {
        timestamp: Date.now(),
        host: status.host || '',
        version: status.version || 'unknown',
        uptime: status.uptime || 0,
        connections: {
          current: status.connections?.current || 0,
          available: status.connections?.available || 0,
          totalCreated: status.connections?.totalCreated || 0,
        },
        opcounters: {
          insert: status.opcounters?.insert || 0,
          query: status.opcounters?.query || 0,
          update: status.opcounters?.update || 0,
          delete: status.opcounters?.delete || 0,
          getmore: status.opcounters?.getmore || 0,
          command: status.opcounters?.command || 0,
        },
        memory: {
          resident: status.mem?.resident || 0,
          virtual: status.mem?.virtual || 0,
          mapped: status.mem?.mapped || 0,
        },
        network: {
          bytesIn: status.network?.bytesIn || 0,
          bytesOut: status.network?.bytesOut || 0,
          numRequests: status.network?.numRequests || 0,
        },
        globalLock: {
          currentQueueTotal: status.globalLock?.currentQueue?.total || 0,
          currentQueueReaders: status.globalLock?.currentQueue?.readers || 0,
          currentQueueWriters: status.globalLock?.currentQueue?.writers || 0,
          activeClientsTotal: status.globalLock?.activeClients?.total || 0,
          activeClientsReaders: status.globalLock?.activeClients?.readers || 0,
          activeClientsWriters: status.globalLock?.activeClients?.writers || 0,
        },
        extraInfo: {
          pageFaults: status.extra_info?.page_faults || 0,
        },
        repl: status.repl ? {
          setName: status.repl.setName,
          isWritablePrimary: status.repl.isWritablePrimary || status.repl.ismaster,
          hosts: status.repl.hosts,
        } : null,
      };

      // Current operations - include full detail
      let currentOps = [];
      try {
        const opsResult = await req.adminDb.command({ currentOp: 1, $all: true });
        currentOps = (opsResult.inprog || []).slice(0, 100).map((op) => ({
          opid: String(op.opid ?? ''),
          type: op.type || op.op || '',
          ns: op.ns || '',
          microsecs: op.microsecs_running || (op.secs_running ? op.secs_running * 1000000 : 0),
          desc: op.desc || '',
          active: op.active || false,
          waitingForLock: op.waitingForLock || false,
          client: op.client || op.client_s || '',
          appName: op.appName || '',
          command: op.command ? JSON.stringify(op.command, null, 2) : '',
          planSummary: op.planSummary || '',
          numYields: op.numYields || 0,
          locks: op.locks ? JSON.stringify(op.locks) : '',
        }));
      } catch {
        // currentOp may not be available
      }

      res.json({ metrics, currentOps });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  };

  // Profiler data endpoint - reads from system.profile collection
  exp.getProfilerData = async function (req, res) {
    try {
      if (!req.adminDb) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const dbName = req.query.db;
      if (!dbName) {
        return res.status(400).json({ error: 'db parameter required' });
      }

      const db = req.adminDb.db(dbName);

      // Get current profiler status
      let profilerStatus = { was: 0, slowms: 100 };
      try {
        profilerStatus = await db.command({ profile: -1 });
      } catch {
        // may not have permission
      }

      // Read from system.profile
      const sortField = req.query.sort || 'ts';
      const sortDir = req.query.dir === 'asc' ? 1 : -1;
      const filterType = req.query.type || '';
      const minMs = Number.parseInt(req.query.minMs, 10) || 0;
      const limit = Math.min(Number.parseInt(req.query.limit, 10) || 50, 200);

      const filter = {};
      if (filterType) filter.op = filterType;
      if (minMs > 0) filter.millis = { $gte: minMs };

      let slowQueries = [];
      try {
        const sortObj = {};
        sortObj[sortField] = sortDir;
        const cursor = db.collection('system.profile')
          .find(filter)
          .sort(sortObj)
          .limit(limit);
        const docs = await cursor.toArray();

        slowQueries = docs.map((doc) => ({
          ts: doc.ts ? new Date(doc.ts).toISOString() : '',
          op: doc.op || '',
          ns: doc.ns || '',
          millis: doc.millis || 0,
          planSummary: doc.planSummary || '',
          keysExamined: doc.keysExamined || 0,
          docsExamined: doc.docsExamined || 0,
          nreturned: doc.nreturned || 0,
          responseLength: doc.responseLength || 0,
          client: doc.client || '',
          appName: doc.appName || '',
          command: doc.command ? JSON.stringify(doc.command, null, 2) : '',
          execStats: doc.execStats ? JSON.stringify(doc.execStats, null, 2) : '',
        }));
      } catch {
        // system.profile may not exist (profiler off)
      }

      res.json({
        profilerLevel: profilerStatus.was || 0,
        slowms: profilerStatus.slowms || 100,
        slowQueries,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  };

  // Set profiler level
  exp.setProfilerLevel = async function (req, res) {
    try {
      if (!req.adminDb) {
        return res.status(403).json({ error: 'Admin access required' });
      }
      if (config.options.readOnly) {
        return res.status(403).json({ error: 'Read-only mode' });
      }

      const dbName = req.body.db;
      const level = Number.parseInt(req.body.level, 10);
      const slowms = Number.parseInt(req.body.slowms, 10) || 100;

      if (!dbName) return res.status(400).json({ error: 'db required' });
      if (![0, 1, 2].includes(level)) return res.status(400).json({ error: 'level must be 0, 1, or 2' });

      const db = req.adminDb.db(dbName);
      await db.command({ profile: level, slowms });

      res.json({ ok: true, level, slowms });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  };

  return exp;
};

export default routes;
