import session from 'express-session';
import { db } from './db.js';

// Простой стор сессий на основе Turso/SQLite
export class TursoSessionStore extends session.Store {
  constructor() {
    super();
    this.init();
  }

  async init() {
    try {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS sessions (
          sid TEXT PRIMARY KEY,
          sess TEXT NOT NULL,
          expired_at INTEGER NOT NULL
        )
      `);
    } catch (e) {
      console.error('Session store init error:', e);
    }
  }

  async get(sid, callback) {
    try {
      const result = await db.execute({
        sql: 'SELECT sess FROM sessions WHERE sid = ? AND expired_at > ?',
        args: [sid, Date.now()]
      });
      if (!result.rows.length) return callback(null, null);
      callback(null, JSON.parse(result.rows[0].sess));
    } catch (e) { callback(e); }
  }

  async set(sid, sess, callback) {
    try {
      const expired_at = sess.cookie?.expires
        ? new Date(sess.cookie.expires).getTime()
        : Date.now() + 30 * 24 * 60 * 60 * 1000;

      await db.execute({
        sql: 'INSERT OR REPLACE INTO sessions (sid, sess, expired_at) VALUES (?, ?, ?)',
        args: [sid, JSON.stringify(sess), expired_at]
      });
      callback(null);
    } catch (e) { callback(e); }
  }

  async destroy(sid, callback) {
    try {
      await db.execute({ sql: 'DELETE FROM sessions WHERE sid = ?', args: [sid] });
      callback(null);
    } catch (e) { callback(e); }
  }
}
