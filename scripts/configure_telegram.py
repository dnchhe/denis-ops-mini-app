import json
import sys
import urllib.request
from pathlib import Path


def load_token():
    path = Path.home() / ".hermes" / ".env"
    for line in path.read_text(errors="ignore").splitlines():
        if line.startswith("TELEGRAM_BOT_TOKEN="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise RuntimeError("TELEGRAM_BOT_TOKEN is not configured")


def api(token, method, payload=None):
    data = None if payload is None else json.dumps(payload).encode()
    request = urllib.request.Request(
        f"https://api.telegram.org/bot{token}/{method}",
        data=data,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        result = json.loads(response.read())
    if not result.get("ok"):
        raise RuntimeError(f"Telegram API {method} failed")
    return result["result"]


def main():
    if len(sys.argv) != 2 or not sys.argv[1].startswith("https://"):
        raise SystemExit("Usage: configure_telegram.py https://public-app-url")
    url = sys.argv[1].rstrip("/")
    token = load_token()
    bot = api(token, "getMe")
    api(token, "setChatMenuButton", {
        "chat_id": 7905681657,
        "menu_button": {"type": "web_app", "text": "Открыть систему", "web_app": {"url": url}},
    })
    print(json.dumps({"bot_username": bot.get("username"), "menu_button": "configured", "url": url}, ensure_ascii=False))


if __name__ == "__main__":
    main()
