<p align="center">
  <img src="apps/web/public/icons/icon-192.png" width="110" height="110" alt="AniSync Logo"/>
</p>

<h1 align="center">AniSync</h1>

<p align="center">
  <strong>Единый центр управления вашей медиатекой.</strong><br/>
  Аниме, сериалы, фильмы и автоматический поиск раздач — в одном месте.
</p>

<p align="center">
  <a href="https://anisync.ru">
    <img src="https://img.shields.io/badge/Live_Demo-anisync.ru-6366f1?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Demo" />
  </a>
</p>

<p align="center">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js_15-000000?style=flat-square&logo=nextdotjs&logoColor=white" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript_5-3178C6?style=flat-square&logo=typescript&logoColor=white" />
  <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white" />
  <img alt="Redis" src="https://img.shields.io/badge/Redis_/_BullMQ-DC382D?style=flat-square&logo=redis&logoColor=white" />
  <img alt="License" src="https://img.shields.io/badge/License-MIT-22c55e?style=flat-square" />
</p>

---

## 🚀 О проекте

**AniSync** решает проблему «сотни открытых вкладок». Это современный, быстый и минималистичный PWA-сервис, который объединяет трекинг аниме, отслеживание премьер кино и умную автоматизацию поиска торрентов в единый хаб.

Больше не нужно вручную проверять обновлённые списки, календарь релизов и трекеры — AniSync берет фоновую рутину на себя и присылает уведомления прямо в Telegram.

### ✨ Ключевые фичи

* **🧩 Модульность без лишнего шума:** Включайте только те модули, которыми реально пользуетесь.
* **📱 Полноценный PWA:** Устанавливается как нативное приложение на смартфон или ПК, работает быстро и без задержек.
* **⚡ Мгновенный UI:** Фоновые очереди не блокируют интерфейс — все долгие синхронизации и поиски происходят незаметно для пользователя.
* **🌍 Мультиязычность:** Полная поддержка русского и английского языков (i18n).

---

## 📦 Модули

| Модуль | Описание | Интеграции |
| :--- | :--- | :--- |
| **🎌 Anime** | Двусторонняя синхронизация списка аниме, статусов и прогресса просмотров в реальном времени. | Shikimori · MyAnimeList · AniList |
| **🎬 Releases** | Персональный Watchlist, расписание и даты выхода новых эпизодов сериалов и мировых кинопремьер. | TMDB |
| **🧲 Torrents** | Умный мониторинг и автопоиск торрентов по критериям с фильтрацией мусора и уведомлениями. | Prowlarr · Telegram |

> 🤖 **Smart Torrent Hunting:** Модуль торрентов умеет отсеивать «экранки» (CAM/TS), находит нужные озвучки, фильтрует качество и отправляет прямую magnet-ссылку с постером прямо в ваш Telegram.

---

## 🛠 Архитектура

Проект построен по принципу **Modular Monolith** — три домена объединяет общая база данных, единая система авторизации, центр уведомлений и фоновые очереди задач.

```mermaid
flowchart LR
    U([Пользователь]) <-->|Интерфейс & API| W[Next.js Web]
    W <--> PG[(PostgreSQL)]
    W <--> R[(Redis)]
    
    subgraph Background Services
        S[Scheduler] -->|Задачи по расписанию| R
        WK[Worker] <-->|Обработка очередей| R
        WK <--> PG
    end
    
    WK <-->|Синхронизация & Парсинг| API[Внешние API / Prowlarr / TG]

```

### Разделение процессов

1. **`web`** — реактивный UI и Fast API.
2. **`scheduler`** — генерирует периодические таски (проверка дат, поиск торрентов).
3. **`worker`** — забирает «тяжёлую» работу из **BullMQ** (фоновый импорт, сканирование трекеров, отправка push/TG уведомлений).

---

## 🛠 Технологический стек

* **Frontend & Backend:** Next.js 15 (App Router), React 19, TypeScript
* **State & Query:** TanStack Query, `next-intl` (i18n)
* **UI & Styling:** Tailwind CSS, Radix UI / shadcn/ui
* **Database & ORM:** PostgreSQL, Drizzle ORM
* **Queues & Cache:** Redis, BullMQ
* **PWA:** Serwist
* **Deployment:** Docker Compose (`web`, `worker`, `scheduler`)

---

## 🔗 Попробуйте сами

Готовый к работе инстанс доступен по адресу:

👉 **[anisync.ru](https://anisync.ru)**

---

## 📄 Лицензия

Распространяется под лицензией **MIT**.

© 2025–2026 [Denis Ershov](/LICENSE)