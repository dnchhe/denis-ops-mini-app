import hashlib
import hmac
import json
import time
from urllib.parse import parse_qsl


def validate_init_data(init_data: str, bot_token: str, max_age_seconds: int | None = 86400) -> dict:
    if not init_data or not bot_token:
        raise ValueError("Telegram initData and bot token are required")
    values = dict(parse_qsl(init_data, keep_blank_values=True))
    received_hash = values.pop("hash", None)
    if not received_hash:
        raise ValueError("Telegram initData hash is missing")
    data_check_string = "\n".join(f"{key}={values[key]}" for key in sorted(values))
    secret_key = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    expected_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected_hash, received_hash):
        raise ValueError("Telegram initData signature is invalid")
    auth_date = int(values.get("auth_date", "0"))
    if max_age_seconds is not None and (auth_date <= 0 or time.time() - auth_date > max_age_seconds):
        raise ValueError("Telegram initData is expired")
    result = dict(values)
    if values.get("user"):
        result["user"] = json.loads(values["user"])
    return result
