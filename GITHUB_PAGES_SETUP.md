# Перенос интерфейса Mini App на GitHub Pages

## Итоговая схема

- `miniapp.dnchhe.ru` — статический интерфейс на GitHub Pages.
- `api-miniapp.dnchhe.ru` — API через текущий Cloudflare Tunnel на `http://127.0.0.1:4173`.
- SQLite, Telegram-токен и пользовательские данные остаются только на Mac.

## 1. Обновить проект на Mac

Распаковать подготовленный архив поверх репозитория и выполнить:

```bash
cd /Users/a1/Hermes/assistant/denis-ops-mini-app
npm test
npm run build
git status
git add src/app.js backend/server.py scripts/build.mjs scripts/run_production.py tests/test_server.py .github/workflows/deploy-pages.yml GITHUB_PAGES_SETUP.md
git commit -m "Deploy frontend with GitHub Pages"
git push
```

## 2. Добавить API-поддомен в Cloudflare

В текущем туннеле `denis-ops-mini-app` добавить Published application:

- Subdomain: `api-miniapp`
- Domain: `dnchhe.ru`
- Service type: `HTTP`
- URL: `127.0.0.1:4173`

Существующий маршрут `miniapp.dnchhe.ru` пока не удалять.

Проверка:

```bash
curl -i https://api-miniapp.dnchhe.ru/health
```

Ожидается `HTTP 200` и `{"status": "ok"}`.

## 3. Включить GitHub Pages

В репозитории GitHub открыть `Settings` → `Pages` и выбрать:

- Source: `GitHub Actions`

Затем открыть `Actions`, дождаться зелёного запуска `Deploy Mini App to GitHub Pages` и проверить:

```text
https://dnchhe.github.io/denis-ops-mini-app/
```

## 4. Проверить в Telegram до переключения домена

Временно назначить GitHub Pages URL кнопке бота:

```bash
python3 scripts/configure_telegram.py https://dnchhe.github.io/denis-ops-mini-app/
```

Проверить открытие, загрузку реальных данных и одно безопасное изменение.

При необходимости вернуть старый URL:

```bash
python3 scripts/configure_telegram.py https://miniapp.dnchhe.ru
```

## 5. Переключить постоянный домен

Только после успешного теста:

1. В Cloudflare удалить маршрут/DNS-запись туннеля только для `miniapp.dnchhe.ru`. Маршрут `api-miniapp.dnchhe.ru` оставить.
2. Создать DNS-запись `CNAME`: имя `miniapp`, цель `dnchhe.github.io`, Proxy status — `DNS only`.
3. В GitHub `Settings` → `Pages` указать Custom domain: `miniapp.dnchhe.ru`.
4. После выпуска сертификата включить `Enforce HTTPS`.
5. Проверить `https://miniapp.dnchhe.ru` через Wi-Fi и мобильную сеть.

Кнопку Telegram после этого менять не потребуется: постоянный URL останется прежним.
