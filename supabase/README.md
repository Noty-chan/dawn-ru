# DAWN Supabase

Это отдельная схема DAWN. Она не совместима с комнатами или таблицами других проектов.

## Развёртывание

1. Создать отдельные dev/prod-проекты Supabase.
2. Включить Anonymous Sign-Ins и настроить CAPTCHA до публичного доступа.
3. Применить миграции из `supabase/migrations` через Supabase CLI.
4. В компаньоне указать Project URL и publishable/anon key. Service-role key в браузер не передаётся.

## Модель доступа

- приглашение хранится только как SHA-256 и погашается через `redeem_campaign_invite`;
- чтение ограничено членством в кампании;
- полный снимок Сцены записывают только `owner` и `narrator` через optimistic locking;
- игроки отправляют ограниченные команды в `scene_commands`;
- `event_log` неизменяем из браузера;
- Realtime подписан на `scenes` и `scene_commands`, а RLS фильтрует получателей.
