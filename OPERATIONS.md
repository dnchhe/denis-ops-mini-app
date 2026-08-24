# Эксплуатация Mini App

## Локальный production-запуск

```bash
cd /Users/a1/Hermes/assistant/denis-ops-mini-app
npm test
npm run build
python3 scripts/run_production.py
```

Production API принимает данные только с корректным Telegram `initData` и только от Telegram ID Дениса.

## Автозапуск на этом Mac

Plist подготовлен:

```text
~/Library/LaunchAgents/com.denis.ops-miniapp.plist
```

Из обычного Terminal выполнить:

```bash
cd /Users/a1/Hermes/assistant/denis-ops-mini-app
chmod +x scripts/install_launch_agent.sh
./scripts/install_launch_agent.sh
```

Hermes gateway не может выполнить эту команду изнутри себя: запуск persistent KeepAlive job блокируется механизмом безопасности.

## HTTPS

Временный quick tunnel:

```bash
cloudflared tunnel --url http://127.0.0.1:4173 --no-autoupdate
```

Quick tunnel меняет адрес после перезапуска и не имеет гарантии доступности. Для постоянного Mini App нужен Cloudflare-аккаунт, домен и named tunnel. После получения постоянного URL повторить:

```bash
python3 scripts/configure_telegram.py https://ПОСТОЯННЫЙ-ДОМЕН
```

## База

```text
data/mini_app.sqlite3
```

SQLite работает в WAL-режиме. База и журналы исключены из Git.

## Backup

Cron создаёт резервную копию ежедневно в 03:00 и хранит копии 14 дней.

Ручной запуск:

```bash
python3 ~/.hermes/scripts/mini_app_backup.py
```

Папка:

```text
backups/
```

## Восстановление

Остановить сервер, затем:

```bash
python3 scripts/restore_backup.py backups/mini_app_YYYY-MM-DD_HH-MM-SS.sqlite3
```

Перед заменой автоматически создаётся `pre_restore_*.sqlite3`. Целостность исходной и восстановленной базы проверяется через `PRAGMA integrity_check`.

## Telegram

- меню бота: `Открыть систему`
- чек-ины: 08:00, 14:00, 21:00 по будням
- проверка работы: 11:00 и 16:00 сохранена
- старые дублирующие проверки 08:00, 14:00, 21:00 поставлены на паузу
- вакансии: 12:00, 16:00, 20:00 по будням

## Ограничение текущего этапа

Публичный URL временный. Если процесс tunnel или Mac выключится, Telegram Mini App перестанет открываться до нового tunnel и обновления кнопки.
