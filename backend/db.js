import { createClient } from '@libsql/client';
import 'dotenv/config';

const isProduction = process.env.NODE_ENV === 'production';

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
      video_plan_count INTEGER DEFAULT 0,
      video_plan_period TEXT DEFAULT 'month',
      reach_plan INTEGER DEFAULT 0,
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

  // Таблица периодов воронки
  await db.execute(`
    CREATE TABLE IF NOT EXISTS funnel_periods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      creator_id INTEGER NOT NULL,
      label TEXT NOT NULL,
      date_from TEXT NOT NULL,
      date_to TEXT,
      is_active INTEGER DEFAULT 1,
      payout REAL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(creator_id) REFERENCES creators(id) ON DELETE CASCADE
    )
  `);

  // Еженедельные снимки воронки (накопительные)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS funnel_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      period_id INTEGER NOT NULL,
      recorded_at TEXT DEFAULT (datetime('now')),
      visits INTEGER DEFAULT 0,
      cart INTEGER DEFAULT 0,
      orders INTEGER DEFAULT 0,
      note TEXT,
      FOREIGN KEY(period_id) REFERENCES funnel_periods(id) ON DELETE CASCADE
    )
  `);

  // Добавляем новые колонки если их ещё нет (миграция)
  try { await db.execute('ALTER TABLE creators ADD COLUMN video_plan_count INTEGER DEFAULT 0'); } catch {}
  try { await db.execute('ALTER TABLE creators ADD COLUMN video_plan_period TEXT DEFAULT \'month\''); } catch {}
  try { await db.execute('ALTER TABLE creators ADD COLUMN reach_plan INTEGER DEFAULT 0'); } catch {}
  try { await db.execute('ALTER TABLE creators ADD COLUMN daily_rate INTEGER DEFAULT 0'); } catch {}
  try { await db.execute('ALTER TABLE creators ADD COLUMN email TEXT'); } catch {}
  try { await db.execute('ALTER TABLE creators ADD COLUMN user_id INTEGER'); } catch {}

  // Таблица пользователей
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      google_id TEXT UNIQUE,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      avatar TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Воркспейсы (один КЗ = один воркспейс)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      owner_id INTEGER NOT NULL,
      plan TEXT DEFAULT 'free',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Члены воркспейса с ролями
  await db.execute(`
    CREATE TABLE IF NOT EXISTS workspace_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      role TEXT NOT NULL DEFAULT 'creator',
      joined_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(workspace_id, user_id)
    )
  `);

  // Инвайты (многоразовые, как в Telegram)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS invites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id INTEGER NOT NULL,
      role TEXT DEFAULT 'creator',
      token TEXT UNIQUE NOT NULL,
      label TEXT,
      use_count INTEGER DEFAULT 0,
      expires_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
    )
  `);

  // Добавляем workspace_id в существующие таблицы
  try { await db.execute('ALTER TABLE creators ADD COLUMN workspace_id INTEGER DEFAULT 1'); } catch {}
  try { await db.execute('ALTER TABLE posts ADD COLUMN workspace_id INTEGER DEFAULT 1'); } catch {}
  try { await db.execute('ALTER TABLE videos ADD COLUMN workspace_id INTEGER DEFAULT 1'); } catch {}
  try { await db.execute('ALTER TABLE funnel_periods ADD COLUMN workspace_id INTEGER DEFAULT 1'); } catch {}

  // Триал
  try { await db.execute('ALTER TABLE workspaces ADD COLUMN trial_ends_at TEXT'); } catch {}

  // Ошибки парсинга
  try { await db.execute('ALTER TABLE videos ADD COLUMN last_error TEXT'); } catch {}

  // Многоразовые инвайты
  try { await db.execute('ALTER TABLE invites ADD COLUMN label TEXT'); } catch {}
  try { await db.execute('ALTER TABLE invites ADD COLUMN use_count INTEGER DEFAULT 0'); } catch {}
  try { await db.execute('ALTER TABLE invites ADD COLUMN expires_at TEXT'); } catch {}
  try { await db.execute('ALTER TABLE workspace_members ADD COLUMN invite_id INTEGER'); } catch {}

  // Удаляем старое поле used если оно ещё есть (игнорируем ошибку)
  // SQLite не поддерживает DROP COLUMN до версии 3.35, поэтому оставляем

  // Дата старта расчётного периода на самом креаторе (резерв если нет воронки)
  try { await db.execute('ALTER TABLE creators ADD COLUMN period_start TEXT'); } catch {}

  // Email+password auth
  try { await db.execute('ALTER TABLE users ADD COLUMN password_hash TEXT'); } catch {}

  // Email verification + password reset
  try { await db.execute('ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0'); } catch {}
  try { await db.execute('ALTER TABLE users ADD COLUMN email_verify_token TEXT'); } catch {}
  try { await db.execute('ALTER TABLE users ADD COLUMN reset_password_token TEXT'); } catch {}
  try { await db.execute('ALTER TABLE users ADD COLUMN reset_password_expires INTEGER'); } catch {}

  // Trial email tracking
  try { await db.execute("ALTER TABLE workspaces ADD COLUMN emails_sent TEXT DEFAULT ''"); } catch {}

  // Настройки видимости для роли creator
  try { await db.execute('ALTER TABLE workspaces ADD COLUMN creator_sees_all_creators INTEGER DEFAULT 1'); } catch {}
  try { await db.execute('ALTER TABLE workspaces ADD COLUMN creator_sees_funnel INTEGER DEFAULT 0'); } catch {}
  try { await db.execute('ALTER TABLE workspaces ADD COLUMN creator_sees_own_only INTEGER DEFAULT 0'); } catch {}
  try { await db.execute('ALTER TABLE funnel_periods ADD COLUMN total_views_override INTEGER'); } catch {}

  // Биллинг ЮКасса
  await db.execute(`
    CREATE TABLE IF NOT EXISTS pending_payments (
      payment_id TEXT PRIMARY KEY,
      email TEXT,
      full_name TEXT,
      plan_id TEXT,
      workspace_id TEXT,
      is_existing_user INTEGER,
      created_at TEXT
    )
  `);
  try { await db.execute('ALTER TABLE pending_payments ADD COLUMN workspace_id TEXT'); } catch {}
  try { await db.execute('ALTER TABLE workspaces ADD COLUMN subscription_active INTEGER DEFAULT 0'); } catch {}
  try { await db.execute('ALTER TABLE workspaces ADD COLUMN payment_method_id TEXT'); } catch {}
  try { await db.execute('ALTER TABLE workspaces ADD COLUMN next_billing_date TEXT'); } catch {}

  // Фикс: видео добавленные через /posts не получали workspace_id — исправляем через creator
  try {
    await db.execute(`
      UPDATE videos
      SET workspace_id = (SELECT workspace_id FROM creators WHERE creators.id = videos.creator_id)
      WHERE (workspace_id IS NULL OR workspace_id = 1)
        AND creator_id IS NOT NULL
        AND EXISTS (SELECT 1 FROM creators WHERE creators.id = videos.creator_id AND creators.workspace_id > 1)
    `);
  } catch {}

  console.log('Database initialized');
}
