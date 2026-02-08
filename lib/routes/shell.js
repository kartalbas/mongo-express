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

  exp.executeShell = async function (req, res) {
    try {
      const { command } = req.body;
      if (!command || typeof command !== 'string') {
        return res.json({ error: 'No command provided' });
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
      const runCmdMatch = trimmed.match(/^db\.runCommand\((.+)\)$/s);
      if (runCmdMatch) {
        if (config.options.readOnly) {
          return res.json({ error: 'Read-only mode' });
        }
        const cmdObj = JSON.parse(runCmdMatch[1]);
        const result = await req.db.command(cmdObj);
        return res.json({ result });
      }

      // Handle "db.<collection>.<method>(...)"
      const collMethodMatch = trimmed.match(/^db\.(\w+)\.(\w+)\((.*)?\)$/s);
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
          result = await result.limit(100).toArray();
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
      console.error(error);
      res.json({ error: error.message });
    }
  };

  return exp;
};

export default routes;
