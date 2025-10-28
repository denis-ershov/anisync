# AniSync

**AniSync** — это современное веб-приложение для отслеживания и синхронизации аниме между различными сервисами (Shikimori, MyAnimeList, AniList).

## 🎯 Основные возможности

### ✅ Реализовано

#### Аутентификация и интеграции
- ✅ Система аутентификации с JWT токенами
- ✅ OAuth 2.0 интеграция с Shikimori (с PKCE)
- ✅ OAuth 2.0 интеграция с MyAnimeList (с PKCE)
- ✅ OAuth 2.0 интеграция с AniList
- ✅ Locale-независимые redirect URI для всех сервисов
- ✅ Выбор главного сервиса для загрузки данных

#### Расписание аниме
- ✅ **Недельное расписание** — отображение аниме на ближайшие 7 дней
- ✅ **Секция "Продолжаю смотреть"** — аниме со статусом "Смотрю" без расписания
- ✅ Поддержка еженедельных релизов (показывает аниме в день недели)
- ✅ Автоматическое добавление запланированных аниме, если релиз выпадает на неделю
- ✅ Фильтрация первых серий новых аниме

#### Управление просмотром
- ✅ **Кнопки +/- для управления эпизодами** в карточках и детальном окне
- ✅ **Синхронизация с Shikimori API** при изменении количества серий
- ✅ **Изменение статуса просмотра** с синхронизацией через API
- ✅ Отображение текущего статуса (Смотрю, Запланировано, Брошено и т.д.)
- ✅ Прогресс-бар просмотра
- ✅ Отображение "?" для аниме с неизвестным количеством серий

#### UI/UX
- ✅ Адаптивный дизайн с поддержкой темной и светлой темы
- ✅ Многязычность (Русский, English) через next-intl
- ✅ Детальные модальные окна с информацией об аниме
- ✅ Улучшенная читаемость названий на обложках (градиенты и тени)
- ✅ Очистка BB-кодов и HTML тегов из описаний
- ✅ Карточки аниме с жанрами, студиями, рейтингами

#### Данные
- ✅ Загрузка полной информации об аниме из Shikimori GraphQL API
- ✅ Поддержка всех статусов аниме (ongoing, completed, released, anons)
- ✅ Информация о студиях, жанрах, рейтингах
- ✅ Даты релизов и расписание новых серий

## 🚀 Планируется

### Высокий приоритет
- [ ] **Автоматическая синхронизация** между сервисами
- [ ] **Изменение рейтинга** с синхронизацией через API
- [ ] **Заметки к аниме** с сохранением через API
- [ ] Поддержка загрузки данных из MyAnimeList
- [ ] Поддержка загрузки данных из AniList
- [ ] **Уведомления** о новых сериях
- [ ] **Фильтры** по жанрам, годам, статусам в расписании

### Средний приоритет
- [ ] Страница профиля со статистикой
- [ ] История просмотра
- [ ] Рекомендации аниме на основе AI
- [ ] Поиск аниме
- [ ] Списки (избранное, не интересует)
- [ ] Календарь релизов

### Низкий приоритет
- [ ] Социальные функции (друзья, активность)
- [ ] Экспорт/импорт списков
- [ ] Интеграция с Discord
- [ ] Мобильное приложение

## 🛠 Технологический стек

### Frontend
- **Next.js 15** — App Router, Server Components
- **React 19** — Hooks, Client Components
- **TypeScript** — Типизация
- **Tailwind CSS** — Стилизация
- **shadcn/ui** — Компоненты UI
- **next-intl** — Интернационализация
- **date-fns** — Работа с датами

### Backend
- **Next.js API Routes** — RESTful API
- **SQLite** (better-sqlite3) — База данных
- **JWT** — Аутентификация
- **OAuth 2.0** — Интеграции с сервисами

### Интеграции
- **Shikimori API** — GraphQL и REST
- **MyAnimeList API** — REST
- **AniList API** — GraphQL

### AI (в разработке)
- **Google Genkit** — AI-рекомендации

## 📁 Структура проекта

```
anisync/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── [locale]/          # Локализованные страницы
│   │   │   ├── page.tsx       # Главная (расписание)
│   │   │   ├── profile/       # Профиль
│   │   │   ├── settings/      # Настройки
│   │   │   └── login/         # Авторизация
│   │   ├── api/               # API endpoints
│   │   │   ├── auth/          # Аутентификация
│   │   │   ├── user/          # Пользовательские данные
│   │   │   └── integrations/  # OAuth интеграции
│   │   └── auth/              # OAuth callbacks
│   ├── components/            # React компоненты
│   │   ├── ui/               # shadcn/ui компоненты
│   │   ├── anime-card.tsx    # Карточка аниме
│   │   ├── anime-detail-modal.tsx  # Детальное окно
│   │   ├── schedule-view.tsx # Расписание
│   │   └── header.tsx        # Шапка сайта
│   ├── lib/                   # Утилиты и сервисы
│   │   ├── services/         # API сервисы
│   │   │   ├── user-service.ts
│   │   │   ├── integration-service.ts
│   │   │   └── shikimori-service.ts
│   │   ├── database.ts       # SQLite
│   │   ├── types.ts          # TypeScript типы
│   │   └── utils/            # Вспомогательные функции
│   └── middleware.ts         # Next.js middleware
├── messages/                  # Переводы
│   ├── en.json               # English
│   └── ru.json               # Русский
├── database.sqlite           # База данных
└── public/                   # Статические файлы
```

## 🚦 Начало работы

### Предварительные требования
- Node.js 18+
- npm или yarn

### Установка

```bash
# Клонировать репозиторий
git clone https://github.com/denis-ershov/anisync.git
cd anisync

# Установить зависимости
npm install

# Настроить переменные окружения
cp .env.example .env.local
# Отредактируйте .env.local и добавьте ключи API
```

### Переменные окружения

```env
# Shikimori OAuth
SHIKIMORI_CLIENT_ID=your_client_id
SHIKIMORI_CLIENT_SECRET=your_client_secret

# MyAnimeList OAuth
MAL_CLIENT_ID=your_client_id
MAL_CLIENT_SECRET=your_client_secret

# AniList OAuth
ANILIST_CLIENT_ID=your_client_id
ANILIST_CLIENT_SECRET=your_client_secret

# JWT Secret
JWT_SECRET=your_random_secret_key

# Base URL
NEXT_PUBLIC_BASE_URL=http://localhost:9002
```

### Запуск

```bash
# Режим разработки
npm run dev

# Production сборка
npm run build
npm start
```

Приложение будет доступно по адресу [http://localhost:9002](http://localhost:9002)

## 📝 API Endpoints

### Аутентификация
- `POST /api/auth/register` — Регистрация
- `POST /api/auth/login` — Вход
- `POST /api/auth/logout` — Выход
- `GET /api/auth/me` — Текущий пользователь

### Интеграции
- `GET /api/integrations/[service]/auth-url` — URL для OAuth
- `GET /auth/[service]/callback` — OAuth callback
- `POST /api/integrations/[service]/disconnect` — Отключение

### Аниме
- `GET /api/user/anime` — Список аниме пользователя
- `PATCH /api/user/anime/[id]/episodes` — Обновление эпизодов/статуса

### Пользователь
- `GET /api/user/settings` — Настройки пользователя
- `PATCH /api/user/settings` — Обновление настроек

## 🎨 Скриншоты

_(Добавьте скриншоты приложения)_

## 📄 Лицензия

MIT

## 🤝 Вклад в проект

Приветствуются pull requests! Для значительных изменений сначала откройте issue для обсуждения.

## 📧 Контакты

- GitHub: [@your-username](https://github.com/denis-ershov)
- Email: [dns.esv@gmail.com](mailto:dns.esv@gmail.com)

---

**AniSync** — синхронизируй свои аниме легко! 🎌
