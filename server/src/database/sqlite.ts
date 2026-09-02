import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { getAppConfig } from '../config/app.config';

let database: Database.Database | null = null;

function resolveDatabasePath(): string {
  const { sqlitePath } = getAppConfig();
  return path.resolve(process.cwd(), sqlitePath);
}

function ensureParentDir(filePath: string): void {
  const dirPath = path.dirname(filePath);
  fs.mkdirSync(dirPath, { recursive: true });
}

function initialize(databaseInstance: Database.Database): void {
  databaseInstance.exec(`
    CREATE TABLE IF NOT EXISTS ai_tasks (
      task_id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      result_json TEXT,
      error TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);
}

export function getSqliteDb(): Database.Database {
  if (database) {
    return database;
  }

  const dbPath = resolveDatabasePath();
  ensureParentDir(dbPath);
  database = new Database(dbPath);
  initialize(database);
  return database;
}
