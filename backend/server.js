import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import path from 'path';
import 'dotenv/config';

import { initDB } from './db.js';
import creatorsRouter from './routes/creators.js';
import videosRouter from './routes/videos.js';
import statsRouter from './routes/stats.js';
import postsRouter from './routes/posts.js';
import { setupCron } from './cron.js';
import funnelRouter from './routes/funnel.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Init DB then start
initDB().then(() => {
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
