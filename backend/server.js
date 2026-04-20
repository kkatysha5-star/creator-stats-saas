import express from 'express';
import cors from 'cors';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'url';
import path from 'path';
import 'dotenv/config';

import { initDB } from './db.js';
import { TursoSessionStore } from './session_store.js';
import passport from './config/auth.js';
import { attachWorkspace } from './middleware/auth.js';

import authRouter from './routes/auth.js';
import workspacesRouter from './routes/workspaces.js';
import creatorsRouter from './routes/creators.js';
import videosRouter from './routes/videos.js';
import statsRouter from './routes/stats.js';
import postsRouter from './routes/posts.js';
import funnelRouter from './routes/funnel.js';
import { setupCron } from './cron.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

// Railway работает за прокси
app.set('trust proxy', 1);

app.use(cors({
  origin: process.env.FRONTEND_URL || true,
  credentials: true,
}));

app.use(cookieParser());
app.use(express.json());

// Сессии для Passport
app.use(session({
  store: new TursoSessionStore(),
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true,
    httpOnly: true,
    sameSite: 'none',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 дней
  }
}));

app.use(passport.initialize());
app.use(passport.session());
app.use(attachWorkspace);

initDB().then(() => {
  // Публичные роуты
  app.use('/api/auth', authRouter);
  app.use('/api/workspaces', workspacesRouter);

  // Данные (требуют workspace_id в заголовке)
  app.use('/api/creators', creatorsRouter);
  app.use('/api/videos', videosRouter);
  app.use('/api/stats', statsRouter);
  app.use('/api/posts', postsRouter);
  app.use('/api/funnel', funnelRouter);

  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../frontend/dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    setupCron();
  });
}).catch(err => {
  console.error('Failed to initialize DB:', err);
  process.exit(1);
});
