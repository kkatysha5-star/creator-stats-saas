import express from 'express';
import cors from 'cors';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import path from 'path';
import 'dotenv/config';

import { initDB } from './db.js';
import { TursoSessionStore } from './session_store.js';
import passport from './config/auth.js';
import { attachWorkspace } from './middleware/auth.js';
import { trackSuspiciousActivity } from './telegram.js';

import authRouter from './routes/auth.js';
import workspacesRouter from './routes/workspaces.js';
import creatorsRouter from './routes/creators.js';
import videosRouter from './routes/videos.js';
import statsRouter from './routes/stats.js';
import postsRouter from './routes/posts.js';
import funnelRouter from './routes/funnel.js';
import { setupCron } from './cron.js';
import { clearInstagramCache } from './fetchers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.set('trust proxy', 1);

// Helmet — безопасные HTTP-заголовки
app.use(helmet({
  contentSecurityPolicy: false, // отключаем CSP — мешает SPA
}));

// CORS — только свой домен
const allowedOrigin = process.env.FRONTEND_URL;
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || !allowedOrigin || origin === allowedOrigin) return cb(null, true);
    cb(new Error('CORS: origin not allowed'));
  },
  credentials: true,
}));

// Rate limiting: общий — 100 req/min с одного IP
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    trackSuspiciousActivity(ip, '429 Rate Limit', req.path);
    res.status(429).json({ error: 'Слишком много запросов. Попробуйте через минуту.' });
  },
});

// Rate limiting: auth — 10 req/min
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    trackSuspiciousActivity(ip, '429 Auth Rate Limit', req.path);
    res.status(429).json({ error: 'Слишком много попыток авторизации.' });
  },
});

app.use('/api', generalLimiter);
app.use('/api/auth', authLimiter);
app.use('/auth', authLimiter);

// Логирование подозрительных 403
app.use((req, res, next) => {
  const origJson = res.json.bind(res);
  res.json = function (body) {
    if (res.statusCode === 403) {
      const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
      trackSuspiciousActivity(ip, '403 Forbidden', req.path);
    }
    return origJson(body);
  };
  next();
});

app.use(cookieParser());
app.use(express.json());

app.use(session({
  store: new TursoSessionStore(),
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  name: 'cs.sid',
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'none',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  }
}));

app.use(passport.initialize());
app.use(passport.session());
app.use(attachWorkspace);

initDB().then(() => {
  app.use('/api/auth', authRouter);
  app.use('/api/workspaces', workspacesRouter);

  // Сброс Instagram-кэша для тестирования (только после авторизации)
  app.post('/api/debug/clear-instagram-cache', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    clearInstagramCache();
    res.json({ ok: true, message: 'Instagram cache cleared' });
  });

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
