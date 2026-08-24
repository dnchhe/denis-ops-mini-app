import hashlib
import hmac
import json
import tempfile
import unittest
from pathlib import Path
from urllib.parse import urlencode

from backend.auth import validate_init_data
from backend.db import Database


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

        self.assertEqual(after["sampleSize"], before + 1)
        self.assertEqual(after["peakEnergyType"], "evening")


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


if __name__ == "__main__":
    unittest.main()
