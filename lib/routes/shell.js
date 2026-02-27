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
  // Maximum number of results from cursor-returning methods
  const MAX_CURSOR_RESULTS = 100;

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

      // Handle "show dbs"
      if (/^show\s+dbs$/i.test(trimmed)) {
        if (!req.adminDb) {
          return res.json({ error: 'Admin access required' });
        }
        const result = await req.adminDb.command({ listDatabases: 1 });
        return res.json({ result: result.databases });
      }

      // Handle "show collections"
      if (/^show\s+collections$/i.test(trimmed)) {
        const collections = await req.db.listCollections().toArray();
        return res.json({ result: collections.map((c) => c.name) });
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
        const result = await req.db.command(cmdObj);
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

        // Execute the method
        let result = collection[method](...args);

        // Handle cursor-returning methods
        if (method === 'find') {
          result = await result.limit(MAX_CURSOR_RESULTS).toArray();
        } else if (method === 'aggregate') {
          result = await result.toArray();
        } else {
          result = await result;
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
      console.error('Shell execution error:', error);
      res.json({ error: 'Command execution failed' });
    }
  };

  return exp;
};

export default routes;
