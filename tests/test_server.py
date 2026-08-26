import hashlib
import hmac
import json
import tempfile
import unittest
from pathlib import Path
from urllib.parse import urlencode

from backend.auth import validate_init_data
from backend.db import Database
from backend.server import allowed_cors_origin


class DatabaseTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db = Database(Path(self.tmp.name) / "app.sqlite3")
        self.db.initialize()

    def tearDown(self):
        self.tmp.cleanup()

    def test_initial_state_is_seeded_once(self):
        first = self.db.get_state()
        self.db.initialize()
        second = self.db.get_state()

        self.assertEqual(len(first["projects"]), 3)
        self.assertEqual(first["dayTasks"], second["dayTasks"])
        self.assertEqual(first["currentTask"]["priority"], 1)

    def test_task_completion_persists_and_returns_next_task(self):
        current = self.db.get_state()["currentTask"]
        result = self.db.complete_task(current["id"])
        reloaded = self.db.get_state()

        self.assertEqual(result["completedTaskId"], current["id"])
        self.assertNotEqual(result["nextTask"]["id"], current["id"])
        self.assertEqual(reloaded["currentTask"]["id"], result["nextTask"]["id"])

    def test_checkin_persists_and_stats_are_recalculated(self):
        before = self.db.get_wellbeing_stats(7)["sampleSize"]
        self.db.add_checkin({
            "timestamp": "2026-08-24T21:00:00+03:00",
            "type": "evening",
            "energy": 5,
            "mood": 4,
            "focus": 4,
            "anxiety": 1,
            "distraction": "none",
        })
        after = self.db.get_wellbeing_stats(7)

        self.assertGreater(before, 0)
        self.assertEqual(after["sampleSize"], 1)
        self.assertEqual(after["averageEnergy"], 5.0)
        self.assertEqual(after["peakEnergyType"], "evening")

    def test_project_crud_persists(self):
        created = self.db.create_project({"title": "Новый клиент", "client": "Иван", "total": 50000, "started": True})
        self.assertEqual(created["status"], "active")
        updated = self.db.update_project(created["id"], {"payment": {"total": 50000, "paid": 20000}})
        self.assertEqual(updated["payment"]["paid"], 20000)
        summary_state = self.db.get_state()
        project = next(p for p in summary_state["projects"] if p["id"] == created["id"])
        self.assertEqual(project["prepaid"], True)
        self.db.delete_project(created["id"])
        remaining = [p["id"] for p in self.db.get_state()["projects"]]
        self.assertNotIn(created["id"], remaining)

    def test_activity_is_saved(self):
        self.db.add_activity("project", "Работаю над воронкой")
        state = self.db.get_state()
        self.assertEqual(state["activities"][0]["text"], "Работаю над воронкой")

    def test_calendar_comment_is_persisted_in_event_state(self):
        event = self.db.get_state()["calendarEvents"][0]
        self.db.add_event_comment(event["id"], "Уточнить время с клиентом")
        updated = next(item for item in self.db.get_state()["calendarEvents"] if item["id"] == event["id"])

        self.assertEqual(updated["comments"][-1]["text"], "Уточнить время с клиентом")


    def test_task_edit_comment_focus_and_delete(self):
        created = self.db.create_task({"title": "Новая задача", "project": "Личная Mini App", "focus": True})
        updated = self.db.update_task(created["id"], {"notes": "Проверить с телефона", "status": "done"})
        self.assertEqual(updated["notes"], "Проверить с телефона")
        self.assertTrue(updated["focus"])
        self.assertEqual(updated["status"], "done")
        self.db.delete_task(created["id"])
        self.assertNotIn(created["id"], [task["id"] for task in self.db.get_state()["dayTasks"]])

    def test_roadmap_and_project_items_can_be_updated_without_other_fields(self):
        project_id = self.db.get_state()["projects"][0]["id"]
        updated = self.db.update_project(project_id, {"roadmap": [{"text": "Этап 1", "done": True}], "items": [{"kind": "comment", "text": "Важно", "done": False}]})
        self.assertEqual(updated["roadmap"][0]["text"], "Этап 1")
        self.assertEqual(updated["items"][0]["kind"], "comment")

    def test_vacancy_response_is_generated(self):
        vacancy_id = self.db.get_state()["vacancies"][0]["id"]
        vacancy = self.db.prepare_vacancy_response(vacancy_id)
        self.assertEqual(vacancy["status"], "preparing")
        self.assertIn("Здравствуйте", vacancy["response"])

    def test_vacancy_search_can_be_paused_and_resumed(self):
        self.db.set_vacancy_search_paused(True)
        self.assertEqual(self.db.get_state()["vacancySearch"]["status"], "paused")
        self.db.set_vacancy_search_paused(False)
        self.assertEqual(self.db.get_state()["vacancySearch"]["status"], "scheduled")


class TelegramAuthTests(unittest.TestCase):
    def test_valid_init_data_is_accepted(self):
        token = "123456:TEST_TOKEN"
        payload = {
            "auth_date": "1787590000",
            "query_id": "AAExample",
            "user": json.dumps({"id": 7905681657, "first_name": "Denis"}, separators=(",", ":")),
        }
        data_check_string = "\n".join(f"{key}={payload[key]}" for key in sorted(payload))
        secret_key = hmac.new(b"WebAppData", token.encode(), hashlib.sha256).digest()
        payload["hash"] = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

        result = validate_init_data(urlencode(payload), token, max_age_seconds=None)

        self.assertEqual(result["user"]["id"], 7905681657)

    def test_invalid_init_data_is_rejected(self):
        with self.assertRaises(ValueError):
            validate_init_data("auth_date=1&hash=bad", "token", max_age_seconds=None)


class CorsTests(unittest.TestCase):
    def test_pages_and_custom_domain_are_allowed(self):
        self.assertEqual(allowed_cors_origin("https://dnchhe.github.io"), "https://dnchhe.github.io")
        self.assertEqual(allowed_cors_origin("https://miniapp.dnchhe.ru"), "https://miniapp.dnchhe.ru")

    def test_unknown_origin_is_rejected(self):
        self.assertIsNone(allowed_cors_origin("https://example.com"))


if __name__ == "__main__":
    unittest.main()
