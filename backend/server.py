import json
import mimetypes
import os
import re
import subprocess
from datetime import datetime
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from zoneinfo import ZoneInfo

from backend.auth import validate_init_data
from backend.db import Database

ROOT = Path(__file__).resolve().parent.parent
STATIC_ROOT = ROOT / "dist"
DATA_DIR = Path(os.environ.get("APP_DATA_DIR", ROOT / "data"))
DB = Database(DATA_DIR / "mini_app.sqlite3")
DB.initialize()


def checkin_type(hour):
    if hour < 12:
        return "morning"
    if hour < 18:
        return "day"
    return "evening"


class Handler(BaseHTTPRequestHandler):
    server_version = "DenisMiniApp/0.2"

    def log_message(self, format, *args):
        print(f"{self.address_string()} - {format % args}")

    def _send_json(self, payload, status=HTTPStatus.OK):
        body = json.dumps(payload, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self):
        length = int(self.headers.get("Content-Length", "0"))
        if length > 100_000:
            raise ValueError("Request body is too large")
        raw = self.rfile.read(length)
        return json.loads(raw or b"{}")

    def _authorized(self):
        if os.environ.get("APP_ENV", "development") != "production":
            return True
        token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
        init_data = self.headers.get("X-Telegram-Init-Data", "")
        try:
            parsed = validate_init_data(init_data, token)
        except (ValueError, json.JSONDecodeError):
            return False
        allowed_id = int(os.environ.get("ALLOWED_TELEGRAM_USER_ID", "7905681657"))
        return int(parsed.get("user", {}).get("id", 0)) == allowed_id

    def _require_auth(self):
        if self._authorized():
            return True
        self._send_json({"error": "unauthorized"}, HTTPStatus.UNAUTHORIZED)
        return False

    def do_OPTIONS(self):
        self.send_response(HTTPStatus.NO_CONTENT)
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Telegram-Init-Data")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/health":
            return self._send_json({"status": "ok"})
        if parsed.path.startswith("/api/"):
            if not self._require_auth():
                return
            if parsed.path == "/api/state":
                return self._send_json(DB.get_state())
            if parsed.path == "/api/stats":
                days = max(1, min(365, int(parse_qs(parsed.query).get("days", ["7"])[0])))
                return self._send_json(DB.get_wellbeing_stats(days))
            return self._send_json({"error": "not_found"}, HTTPStatus.NOT_FOUND)
        return self._serve_static(parsed.path)

    def do_POST(self):
        parsed = urlparse(self.path)
        if not parsed.path.startswith("/api/") or not self._require_auth():
            if not parsed.path.startswith("/api/"):
                self._send_json({"error": "not_found"}, HTTPStatus.NOT_FOUND)
            return
        try:
            payload = self._read_json()
            status_match = re.fullmatch(r"/api/tasks/([^/]+)/status", parsed.path)
            complete_match = re.fullmatch(r"/api/tasks/([^/]+)/complete", parsed.path)
            vacancy_match = re.fullmatch(r"/api/vacancies/([^/]+)/status", parsed.path)
            vacancy_update_match = re.fullmatch(r"/api/vacancies/([^/]+)/details", parsed.path)
            comment_delete_match = re.fullmatch(r"/api/comments/(\d+)", parsed.path)
            comment_match = re.fullmatch(r"/api/calendar/(\d+)/comments", parsed.path)
            project_match = re.fullmatch(r"/api/projects/([^/]+)", parsed.path)
            if status_match:
                DB.set_task_status(status_match.group(1), payload["status"])
                return self._send_json(DB.get_state())
            if complete_match:
                result = DB.complete_task(complete_match.group(1))
                return self._send_json({**result, "state": DB.get_state()})
            if vacancy_match:
                vacancy = DB.set_vacancy_status(vacancy_match.group(1), payload["status"])
                return self._send_json({"vacancy": vacancy, "state": DB.get_state()})
            if vacancy_update_match:
                vacancy = DB.update_vacancy(vacancy_update_match.group(1), payload)
                return self._send_json({"vacancy": vacancy, "state": DB.get_state()})
            if comment_delete_match:
                DB.delete_event_comment(int(comment_delete_match.group(1)))
                return self._send_json({"state": DB.get_state()})
            if parsed.path == "/api/settings/weekly_focus":
                focus = {
                    "title": str(payload.get("title", ""))[:200],
                    "deadline": str(payload.get("deadline", ""))[:50],
                    "completed": int(payload.get("completed", 0)),
                    "total": max(1, int(payload.get("total", 1))),
                    "progress": min(100, max(0, int(payload.get("progress", 0)))),
                    "tasks": [{"text": str(task.get("text", ""))[:300], "done": bool(task.get("done"))} for task in payload.get("tasks", []) if isinstance(task, dict)][:20],
                }
                with DB.connect() as db:
                    db.execute("INSERT INTO settings(key,value) VALUES('weekly_focus',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                        (json.dumps(focus, ensure_ascii=False),))
                return self._send_json({"focus": focus, "state": DB.get_state()})
            if comment_match:
                comment = DB.add_event_comment(int(comment_match.group(1)), payload.get("text", ""))
                return self._send_json({"comment": comment, "state": DB.get_state()}, HTTPStatus.CREATED)
            if parsed.path == "/api/projects":
                project = DB.create_project(payload)
                return self._send_json({"project": project, "state": DB.get_state()}, HTTPStatus.CREATED)
            if parsed.path == "/api/activities":
                DB.add_activity(str(payload.get("kind", "note")), str(payload.get("text", "")))
                return self._send_json({"state": DB.get_state()}, HTTPStatus.CREATED)
            if project_match:
                if payload.get("delete"):
                    DB.delete_project(project_match.group(1))
                    return self._send_json({"state": DB.get_state()})
                project = DB.update_project(project_match.group(1), payload)
                return self._send_json({"project": project, "state": DB.get_state()})
            if parsed.path == "/api/vacancy-search/pause":
                status = DB.set_vacancy_search_paused(bool(payload.get("paused")))
                return self._send_json({"status": status, "state": DB.get_state()})
            if parsed.path == "/api/vacancy-search/run":
                lock = DB.path.parent / "vacancy_search.lock"
                if lock.exists():
                    return self._send_json({"error": "already_running"}, HTTPStatus.CONFLICT)
                log_path = DB.path.parent / "vacancy_search_manual.log"
                log_handle = log_path.open("ab")
                subprocess.Popen(
                    [str(Path.home() / ".hermes" / "scripts" / "vacancy_search_scheduled.sh")],
                    stdout=log_handle,
                    stderr=subprocess.STDOUT,
                    start_new_session=True,
                )
                log_handle.close()
                return self._send_json({"status": "started"}, HTTPStatus.ACCEPTED)
            if parsed.path == "/api/checkins":
                now = datetime.now(ZoneInfo("Europe/Moscow"))
                payload.setdefault("timestamp", now.isoformat())
                payload.setdefault("type", checkin_type(now.hour))
                for key in ("energy", "mood", "focus", "anxiety"):
                    value = payload.get(key)
                    if value is None or not 1 <= float(value) <= 5:
                        raise ValueError(f"{key} must be between 1 and 5")
                DB.add_checkin(payload)
                return self._send_json({"stats": DB.get_wellbeing_stats(7), "state": DB.get_state()}, HTTPStatus.CREATED)
            return self._send_json({"error": "not_found"}, HTTPStatus.NOT_FOUND)
        except KeyError as exc:
            return self._send_json({"error": "not_found", "detail": str(exc)}, HTTPStatus.NOT_FOUND)
        except (ValueError, TypeError, json.JSONDecodeError) as exc:
            return self._send_json({"error": "invalid_request", "detail": str(exc)}, HTTPStatus.BAD_REQUEST)

    def _serve_static(self, request_path):
        relative = request_path.lstrip("/") or "index.html"
        target = (STATIC_ROOT / relative).resolve()
        if STATIC_ROOT.resolve() not in target.parents and target != STATIC_ROOT.resolve():
            return self._send_json({"error": "forbidden"}, HTTPStatus.FORBIDDEN)
        if not target.is_file():
            target = STATIC_ROOT / "index.html"
        body = target.read_bytes()
        content_type = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type + ("; charset=utf-8" if content_type.startswith("text/") or content_type in {"application/javascript", "application/json"} else ""))
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-cache")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.end_headers()
        self.wfile.write(body)


def main():
    host = os.environ.get("APP_HOST", "0.0.0.0")
    port = int(os.environ.get("APP_PORT", "4173"))
    server = ThreadingHTTPServer((host, port), Handler)
    print(f"Mini App server: http://{host}:{port} env={os.environ.get('APP_ENV', 'development')} db={DB.path}")
    server.serve_forever()


if __name__ == "__main__":
    main()
