import session from 'express-session';
import { db } from './db.js';

const _sessionCache = new Map(); // sid → { sess, at }
const SESSION_CACHE_TTL = 5 * 60 * 1000; // 5 минут

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
    const cached = _sessionCache.get(sid);
    if (cached && Date.now() - cached.at < SESSION_CACHE_TTL) {
      return callback(null, cached.sess);
    }
    try {
      const result = await db.execute({
        sql: 'SELECT sess FROM sessions WHERE sid = ? AND expired_at > ?',
        args: [sid, Date.now()]
      });
      if (!result.rows.length) {
        _sessionCache.delete(sid);
        return callback(null, null);
      }
      const sess = JSON.parse(result.rows[0].sess);
      _sessionCache.set(sid, { sess, at: Date.now() });
      callback(null, sess);
    } catch (e) { callback(e); }
  }

  async set(sid, sess, callback) {
    _sessionCache.set(sid, { sess, at: Date.now() });
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
    _sessionCache.delete(sid);
    try {
      await db.execute({ sql: 'DELETE FROM sessions WHERE sid = ?', args: [sid] });
      callback(null);
    } catch (e) { callback(e); }
  }
}
