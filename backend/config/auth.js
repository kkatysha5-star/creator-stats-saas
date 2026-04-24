import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { db } from '../db.js';
import { sendAlert } from '../telegram.js';

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: `${process.env.FRONTEND_URL}/api/auth/google/callback`,
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const email = profile.emails[0].value;
    const googleId = profile.id;
    const name = profile.displayName;
    const avatar = profile.photos?.[0]?.value;

    // Ищем существующего пользователя
    let userResult = await db.execute({
      sql: 'SELECT * FROM users WHERE google_id = ? OR email = ?',
      args: [googleId, email]
    });

    let user;
    if (userResult.rows.length > 0) {
      // Обновляем google_id если его не было
      user = userResult.rows[0];
      await db.execute({
        sql: 'UPDATE users SET google_id = ?, avatar = ?, name = ? WHERE id = ?',
        args: [googleId, avatar, name, user.id]
      });
    } else {
      // Создаём нового пользователя
      const result = await db.execute({
        sql: 'INSERT INTO users (google_id, email, name, avatar) VALUES (?, ?, ?, ?)',
        args: [googleId, email, name, avatar]
      });
      const newUser = await db.execute({
        sql: 'SELECT * FROM users WHERE id = ?',
        args: [result.lastInsertRowid]
      });
      user = newUser.rows[0];
      sendAlert(`🎉 <b>Новый клиент!</b>\nИмя: ${name}\nEmail: ${email}`);
    }

    return done(null, user);
  } catch (err) {
    return done(err, null);
  }
}));

passport.serializeUser((user, done) => done(null, user.id));

passport.deserializeUser(async (id, done) => {
  try {
    const result = await db.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [id] });
    done(null, result.rows[0] || null);
  } catch (err) {
    done(err, null);
  }
});

export default passport;
