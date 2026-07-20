# Миграция: Добавление таблицы user_sessions

## Проблема
Таблица `user_sessions` отсутствует в базе данных, что вызывает ошибку при попытке логина:
```
relation "user_sessions" does not exist
```

## Решение

### Вариант 1: Автоматическая миграция (рекомендуется)
Если у вас есть доступ к базе данных через CLI или инструменты управления:

```bash
npm run db:migrate
```

### Вариант 2: Ручное применение SQL
Выполните следующий SQL в вашей базе данных PostgreSQL:

```sql
CREATE TABLE "user_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_sessions_token_unique" UNIQUE("token")
);

ALTER TABLE "user_sessions" 
ADD CONSTRAINT "user_sessions_user_id_users_id_fk" 
FOREIGN KEY ("user_id") 
REFERENCES "public"."users"("id") 
ON DELETE cascade 
ON UPDATE no action;

CREATE INDEX "user_sessions_user_id_idx" 
ON "user_sessions" USING btree ("user_id");

CREATE INDEX "user_sessions_expires_at_idx" 
ON "user_sessions" USING btree ("expires_at");
```

### Вариант 3: Через Vercel (если используется Vercel Postgres)
1. Откройте Vercel Dashboard
2. Перейдите в ваш проект → Storage → Postgres
3. Откройте SQL Editor
4. Выполните SQL из варианта 2

## Проверка
После применения миграции проверьте, что таблица создана:

```sql
SELECT * FROM user_sessions LIMIT 1;
```

Если запрос выполняется без ошибок, миграция применена успешно.

