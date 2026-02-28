import { hashSync, compareSync } from 'bcryptjs';
import { getDb } from '../db/sqlite.js';
import type { User } from '../types/index.js';

interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  must_change_password: number;
  created_at: string;
  updated_at: string;
}

interface UserPublicRow {
  id: number;
  username: string;
  must_change_password: number;
  created_at: string;
  updated_at: string;
}

function rowToUser(row: unknown): User | undefined {
  if (row === null || row === undefined) return undefined;
  const r = row as UserRow;
  return {
    id: r.id,
    username: r.username,
    password_hash: r.password_hash,
    must_change_password: Boolean(r.must_change_password),
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

export function findUserByUsername(username: string): User | undefined {
  const db = getDb();
  const row: unknown = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  return rowToUser(row);
}

export function findUserById(id: number): User | undefined {
  const db = getDb();
  const row: unknown = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  return rowToUser(row);
}

export function verifyPassword(user: User, password: string): boolean {
  return compareSync(password, user.password_hash);
}

export function createUser(username: string, password: string): User {
  const db = getDb();
  const hash = hashSync(password, 10);
  const result = db.prepare(
    'INSERT INTO users (username, password_hash) VALUES (?, ?)',
  ).run(username, hash);
  const created = findUserById(Number(result.lastInsertRowid));
  if (!created) {
    throw new Error('Failed to create user');
  }
  return created;
}

export function changePassword(userId: number, newPassword: string): void {
  const db = getDb();
  const hash = hashSync(newPassword, 10);
  db.prepare(
    "UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = datetime('now') WHERE id = ?",
  ).run(hash, userId);
}

export function listUsers(): Omit<User, 'password_hash'>[] {
  const db = getDb();
  const rows: unknown[] = db.prepare(
    'SELECT id, username, must_change_password, created_at, updated_at FROM users',
  ).all();
  return rows.map((row) => {
    const r = row as UserPublicRow;
    return {
      id: r.id,
      username: r.username,
      must_change_password: Boolean(r.must_change_password),
      created_at: r.created_at,
      updated_at: r.updated_at,
    };
  });
}
