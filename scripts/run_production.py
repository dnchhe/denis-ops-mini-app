import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def load_env_value(path: Path, key: str) -> str:
    for line in path.read_text(errors="ignore").splitlines():
        if not line or line.lstrip().startswith("#") or "=" not in line:
            continue
        name, value = line.split("=", 1)
        if name.strip() == key:
            return value.strip().strip('"').strip("'")
    raise RuntimeError(f"{key} is not configured in {path}")


hermes_env = Path.home() / ".hermes" / ".env"
os.environ["TELEGRAM_BOT_TOKEN"] = load_env_value(hermes_env, "TELEGRAM_BOT_TOKEN")
os.environ["APP_ENV"] = "production"
os.environ.setdefault("APP_HOST", "0.0.0.0")
os.environ.setdefault("APP_PORT", "4173")
os.environ.setdefault("ALLOWED_TELEGRAM_USER_ID", "7905681657")
os.environ.setdefault(
    "APP_ALLOWED_ORIGINS",
    "https://miniapp.dnchhe.ru,https://dnchhe.github.io",
)

from backend.server import main

main()
