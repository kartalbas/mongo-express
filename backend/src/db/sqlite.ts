import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { migration001Users } from './migrations/001-users.js';

let db: DatabaseSync | null = null;

interface Migration {
  id: string;
  up(db: DatabaseSync): void;
}

const migrations: Migration[] = [
  { id: '001-users', up: migration001Users },
];

export function getDb(): DatabaseSync {
  if (!db) {
    throw new Error('SQLite not initialized. Call initSqlite() first.');
  }
  return db;
}

export function initSqlite(dataDir: string): DatabaseSync {
  // Ensure data directory exists
  fs.mkdirSync(dataDir, { recursive: true });

  const dbPath = path.join(dataDir, 'monko.db');
  db = new DatabaseSync(dbPath);

  // Enable WAL mode for better concurrent read performance
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');

  // Create migrations tracking table
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Run pending migrations
  runMigrations(db);

  console.log(`SQLite initialized at ${dbPath}`);
  return db;
}

function runMigrations(database: DatabaseSync): void {
  const applied = new Set<string>();
  const rows = database.prepare('SELECT id FROM _migrations').all() as { id: string }[];
  for (const row of rows) {
    applied.add(row.id);
  }

  for (const migration of migrations) {
    if (!applied.has(migration.id)) {
      console.log(`Running migration: ${migration.id}`);
      migration.up(database);
      database.prepare('INSERT INTO _migrations (id) VALUES (?)').run(migration.id);
      console.log(`Migration ${migration.id} applied`);
    }
  }
}

export function closeSqlite(): void {
  if (db) {
    db.close();
    db = null;
  }
}
