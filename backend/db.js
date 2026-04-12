import { createClient } from '@libsql/client';
import 'dotenv/config';

const isProduction = process.env.NODE_ENV === 'production';

// Use Turso in production, local SQLite in development
export const db = createClient(
  isProduction
    ? {
        url: process.env.TURSO_DB_URL,
        authToken: process.env.TURSO_DB_TOKEN,
      }
    : {
        url: 'file:./data.db',
      }
);

export async function initDB() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS creators (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      username TEXT,
      avatar_color TEXT DEFAULT '#6366f1',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      creator_id INTEGER NOT NULL,
      title TEXT,
      published_at TEXT,
      added_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(creator_id) REFERENCES creators(id) ON DELETE CASCADE
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS videos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER,
      creator_id INTEGER NOT NULL,
      platform TEXT NOT NULL,
      url TEXT NOT NULL,
      video_id TEXT,
      title TEXT,
      published_at TEXT,
      added_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(creator_id) REFERENCES creators(id) ON DELETE CASCADE,
      FOREIGN KEY(post_id) REFERENCES posts(id) ON DELETE SET NULL
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS stats_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      video_id INTEGER NOT NULL,
      views INTEGER DEFAULT 0,
      likes INTEGER DEFAULT 0,
      comments INTEGER DEFAULT 0,
      saves INTEGER,
      shares INTEGER,
      er REAL,
      fetched_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(video_id) REFERENCES videos(id) ON DELETE CASCADE
    )
  `);

  console.log('Database initialized');
}
