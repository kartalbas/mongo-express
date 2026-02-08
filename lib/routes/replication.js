const routes = function (config) {
  const exp = {};

  // Feature 12: Replica Set / Sharding View
  exp.viewReplication = async function (req, res) {
    if (!req.adminDb) {
      req.session.error = 'Admin access required for replication info';
      return res.redirect(res.locals.baseHref);
    }

    const ctx = {
      title: 'Replication & Sharding',
      csrfToken: req.csrfToken(),
      replSet: null,
      replConfig: null,
      shards: null,
      error: null,
      isStandalone: false,
    };

    // Try replica set status
    try {
      ctx.replSet = await req.adminDb.command({ replSetGetStatus: 1 });
    } catch (error) {
      if (error.codeName === 'NoReplicationEnabled' || error.code === 76) {
        ctx.isStandalone = true;
      } else {
        ctx.error = error.message;
      }
    }

    // Try replica set config
    if (ctx.replSet) {
      try {
        const configResult = await req.adminDb.command({ replSetGetConfig: 1 });
        ctx.replConfig = configResult.config;
      } catch {
        // Config may not be available
      }
    }

    // Try sharding info
    try {
      const shardResult = await req.adminDb.command({ listShards: 1 });
      if (shardResult.shards && shardResult.shards.length > 0) {
        ctx.shards = shardResult.shards;
      }
    } catch {
      // Not a sharded cluster - that's fine
    }

    res.render('replication', ctx);
  };

  return exp;
};

export default routes;
