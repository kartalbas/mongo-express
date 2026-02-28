import { Router } from 'express';
import { getConnectionData } from '../services/mongodb.js';
import { sendResponse } from '../i18n/index.js';
import type { Config } from '../config.js';
import type { NavDatabase } from '../types/index.js';

export function createNavRoutes(config: Config) {
  const router = Router();

  // GET /api/nav
  router.get('/', async (_req, res, next) => {
    try {
      const connData = getConnectionData();

      // Refresh database list (uses TTL cache)
      await connData.updateDatabases();

      const databases: NavDatabase[] = [];
      const adminDb = connData.mainClient?.adminDb;

      if (adminDb) {
        // If admin, get sizes
        try {
          const dbList = await adminDb.listDatabases();
          for (const dbInfo of dbList.databases) {
            const name = dbInfo.name;
            if (!name) continue;
            databases.push({
              name,
              sizeOnDisk: dbInfo.sizeOnDisk ?? 0,
              empty: Boolean(dbInfo.empty),
              collections: connData.collections[name] ?? [],
            });
          }
        } catch {
          // Fallback to cached data
          for (const dbName of connData.getDatabases()) {
            databases.push({
              name: dbName,
              sizeOnDisk: 0,
              empty: false,
              collections: connData.collections[dbName] ?? [],
            });
          }
        }
      } else {
        // Non-admin: only show connected database
        for (const dbName of connData.getDatabases()) {
          databases.push({
            name: dbName,
            sizeOnDisk: 0,
            empty: false,
            collections: connData.collections[dbName] ?? [],
          });
        }
      }

      sendResponse(res, 200, {
        databases: databases.sort((a, b) => a.name.localeCompare(b.name)),
        settings: {
          readOnly: config.readOnly,
          gridFSEnabled: config.gridFSEnabled,
        },
      }, null);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
