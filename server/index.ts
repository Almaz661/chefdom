import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { runMigrations } from './db/migrate';
import { runSeed } from './db/seed';

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health-check для Render и для пользователя.
// Проверяется после деплоя: GET https://chefdom.onrender.com/api/health
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'chefdom',
    ts: new Date().toISOString(),
  });
});

const PORT = Number(process.env.PORT) || 3000;

async function start(): Promise<void> {
  console.log('[boot] старт ШефДом!');
  console.log('[boot] запуск миграций...');
  await runMigrations();

  console.log('[boot] запуск seed...');
  await runSeed();

  app.listen(PORT, () => {
    console.log(`[boot] сервер слушает порт ${PORT}`);
  });
}

start().catch((err) => {
  console.error('[boot] фатальная ошибка при старте:', err);
  process.exit(1);
});
