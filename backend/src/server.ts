import { loadConfig } from './config.js';
import { initSqlite, closeSqlite } from './db/sqlite.js';
import { connectMongo, disconnectMongo } from './services/mongodb.js';
import { createApp } from './app.js';

async function main() {
  const config = loadConfig();

  // Initialize SQLite (runs migrations)
  initSqlite(config.dataDir);

  // Connect to MongoDB
  await connectMongo(config);

  // Create and start Express app
  const app = createApp(config);

  const server = app.listen(config.port, () => {
    console.log(`MongoSphere backend listening on port ${String(config.port)}`);
    console.log(`  Environment: ${config.nodeEnv}`);
    console.log(`  CORS origin: ${config.corsOrigin}`);
    console.log(`  Data dir:    ${config.dataDir}`);
  });

  // Graceful shutdown
  const shutdown = (signal: string) => {
    console.log(`\n${signal} received. Shutting down...`);
    server.close(() => {
      void disconnectMongo().then(() => {
        closeSqlite();
        console.log('Shutdown complete.');
        process.exit(0);
      });
    });

    // Force exit after 10 seconds
    setTimeout(() => {
      console.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10_000);
  };

  process.on('SIGTERM', () => { shutdown('SIGTERM'); });
  process.on('SIGINT', () => { shutdown('SIGINT'); });
}

main().catch((error: unknown) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
