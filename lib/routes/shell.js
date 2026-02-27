import { BSON } from 'mongodb';

const { EJSON } = BSON;

// Whitelist of allowed collection methods
const READ_METHODS = new Set([
  'find', 'findOne', 'count', 'countDocuments', 'estimatedDocumentCount',
  'distinct', 'aggregate', 'indexes', 'stats',
]);

const WRITE_METHODS = new Set([
  'insertOne', 'insertMany', 'updateOne', 'updateMany',
  'replaceOne', 'deleteOne', 'deleteMany',
  'createIndex', 'dropIndex',
]);

const routes = function (config) {
  const exp = {};

  // Feature 15: MongoDB Shell
  exp.viewShell = function (req, res) {
    res.render('shell', {
      title: 'Shell: ' + req.dbName,
      csrfToken: req.csrfToken(),
    });
  };

  // Maximum allowed command length to prevent abuse
  const MAX_COMMAND_LENGTH = 10_000;
  // Maximum number of results from cursor-returning methods (configurable via config)
  const MAX_CURSOR_RESULTS = config.options.shellMaxResults || 100;
  // Command execution timeout in ms (configurable via config, default 30s)
  const COMMAND_TIMEOUT_MS = config.options.shellCommandTimeout || 30_000;

  exp.executeShell = async function (req, res) {
    try {
      const { command } = req.body;
      if (!command || typeof command !== 'string') {
        return res.json({ error: 'No command provided' });
      }

      if (command.length > MAX_COMMAND_LENGTH) {
        return res.json({ error: `Command too long (max ${MAX_COMMAND_LENGTH} characters)` });
      }

      const trimmed = command.trim();

      // Helper: wrap a promise with a timeout
      const withTimeout = (promise) => Promise.race([
        promise,
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('COMMAND_TIMEOUT')), COMMAND_TIMEOUT_MS);
        }),
      ]);

      // Handle "show dbs"
      if (/^show\s+dbs$/i.test(trimmed)) {
        if (!req.adminDb) {
          return res.json({ error: 'Admin access required' });
        }
        const result = await withTimeout(req.adminDb.command({ listDatabases: 1 }));
        return res.json({ result: result.databases });
      }

      // Handle "show collections"
      if (/^show\s+collections$/i.test(trimmed)) {
        const collections = await withTimeout(req.db.listCollections().toArray());
        return res.json({ result: collections.map((c) => c.name) });
      }

      // Handle "db.transaction([...commands])" — run multiple commands in a transaction
      const txnMatch = /^db\.transaction\((\[[\S\s]+])\)$/s.exec(trimmed);
      if (txnMatch) {
        if (config.options.readOnly) {
          return res.json({ error: 'Read-only mode' });
        }
        let commands;
        try {
          commands = JSON.parse(txnMatch[1]);
        } catch {
          return res.json({ error: 'Invalid transaction argument: expected a JSON array of command strings' });
        }
        if (!Array.isArray(commands) || commands.length === 0) {
          return res.json({ error: 'Transaction requires an array of command strings' });
        }
        if (commands.length > 50) {
          return res.json({ error: 'Transaction limited to 50 commands' });
        }

        const session = req.db.client.startSession();
        const results = [];
        try {
          await withTimeout(session.withTransaction(async () => {
            for (const cmd of commands) {
              if (typeof cmd !== 'string') {
                throw new TypeError('Each transaction command must be a string');
              }
              const cmdMatch = /^db\.([A-Z_a-z]\w{0,120})\.([A-Z_a-z]\w{0,60})\((.*)\)$/s.exec(cmd.trim());
              if (!cmdMatch) {
                throw new Error(`Unsupported command in transaction: ${cmd.slice(0, 80)}`);
              }
              const [, cName, meth, aStr] = cmdMatch;
              if (!READ_METHODS.has(meth) && !WRITE_METHODS.has(meth)) {
                throw new Error(`Method "${meth}" is not allowed`);
              }
              let tArgs = [];
              if (aStr && aStr.trim()) {
                tArgs = JSON.parse('[' + aStr + ']');
              }
              let r = req.db.collection(cName)[meth](...tArgs);
              if (meth === 'find') r = await r.limit(MAX_CURSOR_RESULTS).toArray();
              else if (meth === 'aggregate') r = await r.toArray();
              else r = await r;
              results.push(r);
            }
          }));
          // Serialize results
          const serialized = JSON.parse(EJSON.stringify(EJSON.serialize(results)));
          return res.json({ result: serialized });
        } catch (error) {
          if (error.message === 'COMMAND_TIMEOUT') {
            return res.json({ error: `Transaction timed out after ${COMMAND_TIMEOUT_MS / 1000}s` });
          }
          return res.json({ error: 'Transaction failed: ' + error.message });
        } finally {
          await session.endSession();
        }
      }

      // Handle "db.runCommand({...})"
      const runCmdMatch = /^db\.runCommand\((.+)\)$/s.exec(trimmed);
      if (runCmdMatch) {
        if (config.options.readOnly) {
          return res.json({ error: 'Read-only mode' });
        }
        let cmdObj;
        try {
          cmdObj = JSON.parse(runCmdMatch[1]);
        } catch {
          return res.json({ error: 'Invalid runCommand argument: could not parse as JSON' });
        }
        if (typeof cmdObj !== 'object' || cmdObj === null || Array.isArray(cmdObj)) {
          return res.json({ error: 'runCommand argument must be a JSON object' });
        }
        const result = await withTimeout(req.db.command(cmdObj));
        return res.json({ result });
      }

      // Handle "db.<collection>.<method>(...)"
      // Only allow safe identifier names for collection and method (alphanumeric + underscore)
      const collMethodMatch = /^db\.([A-Z_a-z]\w{0,120})\.([A-Z_a-z]\w{0,60})\((.*)\)$/s.exec(trimmed);
      if (collMethodMatch) {
        const [, collName, method, argsStr] = collMethodMatch;
        const collection = req.db.collection(collName);

        // Check if method is allowed
        const isRead = READ_METHODS.has(method);
        const isWrite = WRITE_METHODS.has(method);

        if (!isRead && !isWrite) {
          return res.json({ error: `Method "${method}" is not allowed` });
        }

        if (isWrite && config.options.readOnly) {
          return res.json({ error: 'Read-only mode: write operations are disabled' });
        }

        if ((method === 'deleteOne' || method === 'deleteMany') && config.options.noDelete) {
          return res.json({ error: 'Delete operations are disabled' });
        }

        // Parse arguments
        let args = [];
        if (argsStr && argsStr.trim()) {
          try {
            // Wrap in array brackets for JSON parsing
            args = JSON.parse('[' + argsStr + ']');
          } catch {
            return res.json({ error: 'Invalid arguments: could not parse as JSON' });
          }
        }

        // Execute the method with timeout
        let result = collection[method](...args);

        // Handle cursor-returning methods
        if (method === 'find') {
          result = await withTimeout(result.limit(MAX_CURSOR_RESULTS).toArray());
        } else if (method === 'aggregate') {
          result = await withTimeout(result.toArray());
        } else {
          result = await withTimeout(result);
        }

        // Serialize BSON types
        try {
          result = JSON.parse(EJSON.stringify(EJSON.serialize(result)));
        } catch {
          // If serialization fails, return as-is
        }

        return res.json({ result });
      }

      return res.json({ error: 'Unrecognized command. Supported: show dbs, show collections, db.runCommand({...}), db.<collection>.<method>(...)' });
    } catch (error) {
      if (error.message === 'COMMAND_TIMEOUT') {
        return res.json({ error: `Command timed out after ${COMMAND_TIMEOUT_MS / 1000}s` });
      }
      console.error('Shell execution error:', error);
      res.json({ error: 'Command execution failed' });
    }
  };

  return exp;
};

export default routes;
