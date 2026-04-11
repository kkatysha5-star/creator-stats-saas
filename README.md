# Creator Stats

Веб-приложение для отслеживания статистики видео на YouTube, TikTok и Instagram.

## Функциональность

- Добавление видео по ссылке — статистика подтягивается автоматически
- Просмотры, лайки, комментарии, сохранения, репосты (где доступны)
- ER (engagement rate) по каждому ролику и по каждому креатору
- Фильтрация по периоду публикации (этот месяц / прошлый / квартал / всё время)
- Фильтрация по платформе и креатору
- Автообновление статистики каждые 6 часов
- Управление списком креаторов

---

## Локальный запуск

### 1. Установить зависимости

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2. Настроить переменные окружения

```bash
cp backend/.env.example backend/.env
```

Откройте `backend/.env` и заполните API ключи (инструкция ниже).

### 3. Запустить

В двух терминалах:

```bash
# Терминал 1 — бэкенд
cd backend && npm run dev

# Терминал 2 — фронтенд
cd frontend && npm run dev
```

Открыть: http://localhost:5173

---

## Получение API ключей

### YouTube (обязательно, бесплатно, ~10 минут)

1. Перейдите на https://console.cloud.google.com
2. Создайте проект (или выберите существующий)
3. Перейдите в **APIs & Services → Library**
4. Найдите **YouTube Data API v3** → Enable
5. Перейдите в **APIs & Services → Credentials → Create Credentials → API Key**
6. Скопируйте ключ в `YOUTUBE_API_KEY` в файле `.env`

Лимит: 10 000 unit/день бесплатно (~1 000 запросов видео).

---

### TikTok Research API (~2 недели на верификацию)

1. Зарегистрируйтесь на https://developers.tiktok.com
2. Создайте приложение → подайте заявку на **Research API**
3. После одобрения получите `client_key` и `client_secret`
4. Получите access token через OAuth 2.0 Client Credentials:

```bash
curl -X POST "https://open.tiktokapis.com/v2/oauth/token/" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_key=YOUR_KEY&client_secret=YOUR_SECRET&grant_type=client_credentials"
```

5. Скопируйте `access_token` в `TIKTOK_ACCESS_TOKEN`

---

### Instagram Graph API (~30 минут, требует бизнес-аккаунты у креаторов)

1. Создайте приложение на https://developers.facebook.com
2. Добавьте продукт **Instagram Graph API**
3. Каждый креатор должен:
   - Иметь Instagram Business или Creator аккаунт
   - Привязать его к Facebook странице
   - Авторизовать ваше приложение
4. Для тестирования используйте Graph API Explorer: https://developers.facebook.com/tools/explorer
5. Получите долгосрочный токен (Long-lived token, действует 60 дней)
6. Скопируйте в `INSTAGRAM_ACCESS_TOKEN`

> Важно: у каждого креатора свой токен. Если у вас несколько инстаграм-аккаунтов — нужно расширить `fetchers.js` для хранения токена per-creator. Обратитесь за помощью.

---

## Деплой на Railway (бесплатно)

### 1. Создать репозиторий на GitHub

```bash
cd creator-stats
git init
git add .
git commit -m "Initial commit"
# Создайте репо на github.com и выполните:
git remote add origin https://github.com/ВАШ_ЛОГИН/creator-stats.git
git push -u origin main
```

### 2. Задеплоить на Railway

1. Зайдите на https://railway.app и войдите через GitHub
2. **New Project → Deploy from GitHub Repo**
3. Выберите репозиторий `creator-stats`
4. Railway автоматически подхватит `railway.toml`

### 3. Добавить переменные окружения в Railway

В панели проекта → **Variables** добавьте:

| Ключ | Значение |
|------|---------|
| `NODE_ENV` | `production` |
| `YOUTUBE_API_KEY` | ваш ключ |
| `TIKTOK_ACCESS_TOKEN` | ваш токен |
| `INSTAGRAM_ACCESS_TOKEN` | ваш токен |

### 4. Получить URL

Railway выдаст URL вида `https://creator-stats-production.up.railway.app` — это и есть адрес вашего приложения.

---

## Структура проекта

```
creator-stats/
├── backend/
│   ├── server.js          # Express сервер
│   ├── db.js              # SQLite база данных
│   ├── fetchers.js        # Запросы к YouTube/TikTok/Instagram API
│   ├── cron.js            # Автообновление каждые 6 часов
│   ├── routes/
│   │   ├── creators.js    # CRUD креаторов
│   │   ├── videos.js      # CRUD видео + ручное обновление
│   │   └── stats.js       # Агрегированная статистика
│   └── .env.example
└── frontend/
    └── src/
        ├── pages/
        │   ├── Dashboard.jsx  # Главный дашборд
        │   ├── Videos.jsx     # Список всех видео
        │   └── Creators.jsx   # Управление креаторами
        ├── components/UI.jsx  # Переиспользуемые компоненты
        └── lib/
            ├── api.js         # Клиент к бэкенду
            └── utils.js       # Форматирование чисел, дат
```

---

## Частые вопросы

**Почему сохранения/репосты показывают «—»?**
YouTube не отдаёт эти данные через публичный API. TikTok и Instagram отдают — но только после настройки соответствующих API ключей.

**Как часто обновляется статистика?**
Автоматически каждые 6 часов. Можно обновить вручную кнопкой «↻ Обновить данные» на дашборде или кнопкой ↻ у конкретного ролика.

**Можно ли добавить нескольких пользователей / логин?**
В текущей версии аутентификации нет. Для команды рекомендуется закрыть приложение Basic Auth на уровне Railway (Settings → Add HTTP Auth).
