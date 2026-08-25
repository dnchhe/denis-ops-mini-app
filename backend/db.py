import json
import sqlite3
import uuid
from datetime import datetime, timedelta
from pathlib import Path


def _money_value(raw):
    if raw is None:
        return None
    digits = "".join(ch for ch in str(raw) if ch.isdigit())
    return int(digits) if digits else None


PROJECTS = [
    {
        "id": "money-teeth", "demo": True, "title": "Деньги на зубах", "client": "Клиентский проект",
        "description": "Подписочный клуб и автоматизация клиентского пути",
        "status": "waiting", "url": "",
        "nextAction": "Проверить поступление остатка оплаты", "nextMove": "Клиент",
        "deadlineText": "27 августа", "deadlineDate": "2026-08-27",
        "createdAt": "2026-08-10T12:00:00+03:00",
        "payment": {"total": None, "paid": None},
        "prepaid": False, "started": True,
        "result": "Работающий первый этап подписочного клуба",
        "risk": "Ожидается остаток оплаты",
        "roadmap": [
            {"text": "Первый этап завершён", "done": True},
            {"text": "Получить остаток оплаты", "done": False},
            {"text": "Согласовать следующий этап", "done": False},
        ],
        "items": [
            {"kind": "question", "text": "Сумма остатка оплаты", "done": False},
            {"kind": "question", "text": "Состав следующего этапа", "done": False},
        ],
    },
    {
        "id": "natalia", "demo": True, "title": "Воронка Наталии", "client": "Наталия",
        "description": "Воронка для бухгалтерского сопровождения",
        "status": "waiting", "url": "",
        "nextAction": "Получить разбор пути реального клиента", "nextMove": "Клиент",
        "deadlineText": "", "deadlineDate": None,
        "createdAt": "2026-07-29T12:00:00+03:00",
        "payment": {"total": None, "paid": None},
        "prepaid": False, "started": False,
        "result": "Воронка: лид-магнит → квалификация → консультация → сопровождение",
        "risk": "Нет подтверждённого срока следующего ответа",
        "roadmap": [
            {"text": "Путь клиента", "done": False},
            {"text": "Основной продукт", "done": False},
            {"text": "Консультация", "done": False},
            {"text": "Лид-магнит", "done": False},
            {"text": "Материалы", "done": False},
            {"text": "Сборка бота", "done": False},
        ],
        "items": [{"kind": "question", "text": "Точный состав сопровождения", "done": False}],
    },
    {
        "id": "mini-app", "demo": True, "title": "Личная Mini App", "client": "Личный проект",
        "description": "Проекты, вакансии и быстрые чек-ины внутри Telegram",
        "status": "active", "url": "",
        "nextAction": "Проверить обновлённый интерфейс на телефоне", "nextMove": "Денис",
        "deadlineText": "", "deadlineDate": None,
        "createdAt": "2026-08-24T12:00:00+03:00",
        "payment": {"total": None, "paid": None},
        "prepaid": False, "started": True,
        "result": "Простая рабочая панель внутри Telegram",
        "risk": "Не перегрузить первую версию",
        "roadmap": [
            {"text": "Кликабельный прототип", "done": True},
            {"text": "База данных", "done": True},
            {"text": "Telegram", "done": True},
            {"text": "Постоянный адрес", "done": False},
            {"text": "Реальные данные", "done": False},
        ],
        "items": [],
    },
]

VACANCIES = [
    {"id":"tech-specialist","title":"Технический специалист онлайн-проекта","company":"Демонстрационная вакансия","format":"Удалённо","salary":"100 000 ₽","match":82,"summary":"GetCourse, SaleBot, amoCRM, вебинары и автоматизации","status":"review","url":"#","response":"Отклик ещё не подготовлен","risks":["Нужно уточнить занятость","Возможна работа по выходным"]},
    {"id":"funnel-integrator","title":"Интегратор автоворонок","company":"Демонстрационная вакансия","format":"Проектно","salary":"20 000–45 000 ₽","match":91,"summary":"SaleBot + GetCourse, оплаты, сегментация и сообщения","status":"later","url":"#","response":"Есть подтверждённые кейсы для отклика","risks":["Нужно уточнить точный объём функционала"]},
]

TASKS = [
    ("task-1", "Проверить обновлённый прототип Mini App", "Личная Mini App", 1, "ready", "15 мин"),
    ("task-2", "Проверить поступление оплаты", "Деньги на зубах", 2, "ready", "5 мин"),
]

CALENDAR_EVENTS = [
    (25,"task","Проверка интерфейса"),(27,"payment","Остаток оплаты"),
    (28,"deadline","Контроль проектов"),(31,"focus","Фокус недели"),
]


def _average(values):
    values = [value for value in values if value is not None]
    return round(sum(values) / len(values), 1) if values else None


def _legacy_to_new(payload):
    """Convert pre-0.3 project payloads to the current schema."""
    legacy_status = {"waiting-payment": "waiting", "client-turn": "waiting", "in-progress": "active"}
    payment = payload.get("payment") or {}
    new_payment = {
        "total": _money_value(payment.get("total")) if not isinstance(payment.get("total"), (int, float)) else int(payment["total"]),
        "paid": _money_value(payment.get("paid")) if not isinstance(payment.get("paid"), (int, float)) else int(payment["paid"]),
    }
    roadmap = payload.get("roadmap") or []
    if roadmap and isinstance(roadmap[0], str):
        roadmap = [{"text": step, "done": index == 0 and bool(payload.get("stage"))} for index, step in enumerate(roadmap)]
    items = [{"kind": "question", "text": text, "done": False} for text in payload.get("questions", [])]
    return {
        **payload,
        "status": legacy_status.get(payload.get("status"), payload.get("status", "active")),
        "url": payload.get("url", ""),
        "deadlineText": payload.get("deadline", ""),
        "deadlineDate": None,
        "createdAt": payload.get("createdAt") or datetime.now().astimezone().isoformat(),
        "payment": new_payment,
        "prepaid": bool(new_payment["paid"]),
        "started": payload.get("status") == "in-progress",
        "roadmap": roadmap,
        "items": items,
    }


class Database:
    def __init__(self, path: Path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.vacancy_pause_flag = self.path.parent / "vacancy_search_paused"

    def connect(self):
        connection = sqlite3.connect(self.path)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA journal_mode=WAL")
        connection.execute("PRAGMA foreign_keys=ON")
        return connection

    def initialize(self):
        with self.connect() as db:
            db.executescript("""
                CREATE TABLE IF NOT EXISTS tasks(id TEXT PRIMARY KEY,title TEXT NOT NULL,project TEXT NOT NULL,priority INTEGER NOT NULL,status TEXT NOT NULL,estimate TEXT);
                CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY,payload TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS vacancies(id TEXT PRIMARY KEY,payload TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS calendar_events(id INTEGER PRIMARY KEY AUTOINCREMENT,day INTEGER NOT NULL,type TEXT NOT NULL,label TEXT NOT NULL,date TEXT);
                CREATE TABLE IF NOT EXISTS calendar_comments(id INTEGER PRIMARY KEY AUTOINCREMENT,event_id INTEGER NOT NULL,text TEXT NOT NULL,created_at TEXT NOT NULL,FOREIGN KEY(event_id) REFERENCES calendar_events(id) ON DELETE CASCADE);
                CREATE TABLE IF NOT EXISTS checkins(id INTEGER PRIMARY KEY AUTOINCREMENT,timestamp TEXT NOT NULL,type TEXT NOT NULL,energy REAL,mood REAL,focus REAL,anxiety REAL,sleep_hours REAL,sleep_quality REAL,distraction TEXT,demo INTEGER NOT NULL DEFAULT 0);
                CREATE TABLE IF NOT EXISTS activities(id INTEGER PRIMARY KEY AUTOINCREMENT,timestamp TEXT NOT NULL,kind TEXT NOT NULL,text TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
            """)
            columns = [row["name"] for row in db.execute("PRAGMA table_info(calendar_events)")]
            if "date" not in columns:
                db.execute("ALTER TABLE calendar_events ADD COLUMN date TEXT")
            if not db.execute("SELECT 1 FROM tasks LIMIT 1").fetchone():
                db.executemany("INSERT INTO tasks VALUES(?,?,?,?,?,?)", TASKS)
                db.executemany("INSERT INTO projects VALUES(?,?)", [(item["id"], json.dumps(item, ensure_ascii=False)) for item in PROJECTS])
                db.executemany("INSERT INTO vacancies VALUES(?,?)", [(item["id"], json.dumps(item, ensure_ascii=False)) for item in VACANCIES])
                db.executemany("INSERT INTO calendar_events(day,type,label) VALUES(?,?,?)", CALENDAR_EVENTS)
                db.execute("INSERT INTO settings VALUES(?,?)", ("weekly_focus", json.dumps({"title":"Собрать и проверить первую рабочую Mini App","completed":3,"total":5,"progress":60,"deadline":"31 августа"}, ensure_ascii=False)))
                self._seed_demo_checkins(db)
            else:
                self._migrate_projects(db)

    def _migrate_projects(self, db):
        for row in db.execute("SELECT id,payload FROM projects").fetchall():
            payload = json.loads(row["payload"])
            needs_migration = isinstance((payload.get("payment") or {}).get("total"), str) or (payload.get("roadmap") and isinstance(payload["roadmap"][0], str))
            if needs_migration:
                payload = _legacy_to_new(payload)
                db.execute("UPDATE projects SET payload=? WHERE id=?", (json.dumps(payload, ensure_ascii=False), row["id"]))

    def _seed_demo_checkins(self, db):
        values = [
            [[2,3,2,3],[3,3,3,2],[4,4,4,2]], [[2,3,2,3],[3,3,2,3],[5,4,4,1]],
            [[3,3,3,2],[3,4,3,2],[4,4,4,1]], [[2,3,2,3],[3,3,3,2],[5,5,4,1]],
            [[3,4,3,2],[3,4,3,2],[4,4,4,1]], [[2,3,2,2],[3,4,3,2],[4,4,4,1]],
            [[3,4,3,2],[3,4,3,2],[4,4,4,1]], [[3,4,3,2],[3,4,3,2],[4,4,4,1]],
        ]
        for day_index, day in enumerate(range(18,25)):
            for type_index, checkin_type in enumerate(("morning","day","evening")):
                energy,mood,focus,anxiety = values[day_index][type_index]
                hour = (8,14,21)[type_index]
                db.execute("INSERT INTO checkins(timestamp,type,energy,mood,focus,anxiety,sleep_hours,sleep_quality,distraction,demo) VALUES(?,?,?,?,?,?,?,?,?,1)",
                    (f"2026-08-{day:02d}T{hour:02d}:00:00+03:00",checkin_type,energy,mood,focus,anxiety,[6.5,6,7,6.5,7.5,7,7][day_index] if type_index == 0 else None,[3,3,4,3,4,4,4][day_index] if type_index == 0 else None,"none"))

    def _task_dict(self, row):
        return {"id":row["id"],"title":row["title"],"project":row["project"],"priority":row["priority"],"status":row["status"],"estimate":row["estimate"]}

    def get_state(self):
        with self.connect() as db:
            tasks = [self._task_dict(row) for row in db.execute("SELECT * FROM tasks ORDER BY priority")]
            current = next((task for task in tasks if task["status"] != "done"), {"id":"none","title":"Все задачи на день выполнены","project":"Сегодня","priority":999,"status":"done","estimate":"–"})
            projects = [json.loads(row["payload"]) for row in db.execute("SELECT payload FROM projects ORDER BY rowid")]
            vacancies = [json.loads(row["payload"]) for row in db.execute("SELECT payload FROM vacancies ORDER BY rowid")]
            events = [dict(row) for row in db.execute("SELECT id,day,type,label,date FROM calendar_events ORDER BY day")]
            for event in events:
                event["comments"] = [dict(row) for row in db.execute("SELECT id,text,created_at AS createdAt FROM calendar_comments WHERE event_id=? ORDER BY id", (event["id"],))]
            focus = json.loads(db.execute("SELECT value FROM settings WHERE key='weekly_focus'").fetchone()["value"])
            history = [dict(row) for row in db.execute("SELECT timestamp,type,energy,mood,focus,anxiety,sleep_hours AS sleepHours,sleep_quality AS sleepQuality,distraction,demo FROM checkins ORDER BY timestamp")]
            activities = [dict(row) for row in db.execute("SELECT id,timestamp,kind,text FROM activities ORDER BY id DESC LIMIT 20")]
        vacancy_status = "paused" if self.vacancy_pause_flag.exists() else "scheduled"
        return {"currentTask":current,"dayTasks":tasks,"weeklyFocus":focus,"calendarEvents":events,"projects":projects,"vacancies":vacancies,"wellbeingHistory":history,"activities":activities,"vacancySearch":{"schedule":["12:00","16:00","20:00"],"weekdaysOnly":True,"lastRun":"Расписание подключено","status":vacancy_status}}

    def set_task_status(self, task_id, status):
        if status not in {"ready","in-progress","postponed","blocked","done"}:
            raise ValueError("Unsupported task status")
        with self.connect() as db:
            cursor = db.execute("UPDATE tasks SET status=? WHERE id=?", (status,task_id))
            if cursor.rowcount != 1:
                raise KeyError(task_id)
        return self.get_state()["currentTask"]

    def complete_task(self, task_id):
        self.set_task_status(task_id,"done")
        return {"completedTaskId":task_id,"nextTask":self.get_state()["currentTask"]}

    def set_vacancy_status(self, vacancy_id, status):
        with self.connect() as db:
            row = db.execute("SELECT payload FROM vacancies WHERE id=?", (vacancy_id,)).fetchone()
            if not row: raise KeyError(vacancy_id)
            payload = json.loads(row["payload"]); payload["status"] = status
            db.execute("UPDATE vacancies SET payload=? WHERE id=?", (json.dumps(payload,ensure_ascii=False),vacancy_id))
        return payload

    def update_vacancy(self, vacancy_id, patch):
        clean = {key: str(patch[key])[:2000] for key in ("url","note") if key in patch}
        if not clean:
            raise ValueError("Nothing to update")
        with self.connect() as db:
            row = db.execute("SELECT payload FROM vacancies WHERE id=?", (vacancy_id,)).fetchone()
            if not row:
                raise KeyError(vacancy_id)
            payload = json.loads(row["payload"])
            payload.update(clean)
            db.execute("UPDATE vacancies SET payload=? WHERE id=?", (json.dumps(payload,ensure_ascii=False),vacancy_id))
        return payload

    def delete_event_comment(self, comment_id):
        with self.connect() as db:
            cursor = db.execute("DELETE FROM calendar_comments WHERE id=?", (comment_id,))
            if cursor.rowcount != 1:
                raise KeyError(comment_id)

    def add_event_comment(self, event_id, text):
        normalized = str(text).strip()
        if not normalized:
            raise ValueError("Comment cannot be empty")
        if len(normalized) > 2000:
            raise ValueError("Comment is too long")
        with self.connect() as db:
            if not db.execute("SELECT 1 FROM calendar_events WHERE id=?", (event_id,)).fetchone():
                raise KeyError(event_id)
            cursor = db.execute("INSERT INTO calendar_comments(event_id,text,created_at) VALUES(?,?,?)", (event_id, normalized, datetime.now().astimezone().isoformat()))
            comment_id = cursor.lastrowid
        return {"id": comment_id, "text": normalized}

    def set_vacancy_search_paused(self, paused):
        if paused:
            self.vacancy_pause_flag.write_text("paused\n")
        else:
            self.vacancy_pause_flag.unlink(missing_ok=True)
        return "paused" if paused else "scheduled"

    def add_checkin(self, payload):
        with self.connect() as db:
            db.execute("INSERT INTO checkins(timestamp,type,energy,mood,focus,anxiety,sleep_hours,sleep_quality,distraction,demo) VALUES(?,?,?,?,?,?,?,?,?,0)",
                (payload["timestamp"],payload["type"],payload.get("energy"),payload.get("mood"),payload.get("focus"),payload.get("anxiety"),payload.get("sleepHours"),payload.get("sleepQuality"),payload.get("distraction")))

    def add_activity(self, kind, text):
        normalized = str(text).strip()[:500]
        if not normalized:
            raise ValueError("Activity cannot be empty")
        with self.connect() as db:
            db.execute("INSERT INTO activities(timestamp,kind,text) VALUES(?,?,?)",
                (datetime.now().astimezone().isoformat(), kind, normalized))

    def create_project(self, payload):
        title = str(payload.get("title","")).strip()
        if not title:
            raise ValueError("Title is required")
        project_id = f"p-{uuid.uuid4().hex[:8]}"
        project = {
            "id": project_id, "demo": False,
            "title": title,
            "client": str(payload.get("client","")).strip() or "Без клиента",
            "description": str(payload.get("description","")).strip(),
            "status": "active" if payload.get("started") else "waiting",
            "url": str(payload.get("url","")).strip(),
            "nextAction": "", "nextMove": "Денис",
            "deadlineText": "", "deadlineDate": payload.get("deadlineDate") or None,
            "createdAt": datetime.now().astimezone().isoformat(),
            "payment": {"total": payload.get("total"), "paid": None},
            "prepaid": False, "started": bool(payload.get("started")),
            "result": "", "risk": "",
            "roadmap": [], "items": [],
        }
        with self.connect() as db:
            db.execute("INSERT INTO projects(id,payload) VALUES(?,?)", (project_id, json.dumps(project, ensure_ascii=False)))
        return project

    ALLOWED_PROJECT_FIELDS = {"title","client","description","status","url","nextAction","nextMove","deadlineText","deadlineDate","payment","prepaid","started","result","risk"}

    def update_project(self, project_id, patch):
        clean = {key: patch[key] for key in patch if key in self.ALLOWED_PROJECT_FIELDS}
        if not clean:
            raise ValueError("Nothing to update")
        with self.connect() as db:
            row = db.execute("SELECT payload FROM projects WHERE id=?", (project_id,)).fetchone()
            if not row:
                raise KeyError(project_id)
            payload = json.loads(row["payload"])
            for key, value in clean.items():
                payload[key] = value
            if "payment" in clean and isinstance(clean["payment"], dict):
                total = clean["payment"].get("total")
                paid = clean["payment"].get("paid")
                if paid is not None:
                    payload["prepaid"] = float(paid) > 0
            if "status" in clean:
                payload["started"] = clean["status"] == "active"
            if "roadmap" in patch:
                steps = patch["roadmap"]
                if not isinstance(steps, list) or any(not isinstance(step.get("text"), str) for step in steps):
                    raise ValueError("Invalid roadmap")
                payload["roadmap"] = [{"text": step["text"][:300], "done": bool(step.get("done"))} for step in steps[:50]]
            if "items" in patch:
                items = patch["items"]
                if not isinstance(items, list):
                    raise ValueError("Invalid items")
                payload["items"] = [{"kind": item.get("kind","note")[:20], "text": str(item.get("text",""))[:500], "done": bool(item.get("done"))} for item in items[:100]]
            db.execute("UPDATE projects SET payload=? WHERE id=?", (json.dumps(payload, ensure_ascii=False), project_id))
        return payload

    def delete_project(self, project_id):
        with self.connect() as db:
            cursor = db.execute("DELETE FROM projects WHERE id=?", (project_id,))
            if cursor.rowcount != 1:
                raise KeyError(project_id)

    def get_wellbeing_stats(self, days=7):
        with self.connect() as db:
            latest = db.execute("SELECT MAX(timestamp) AS value FROM checkins").fetchone()["value"]
            if not latest: return {"sampleSize":0,"averageEnergy":None,"averageMood":None,"averageFocus":None,"averageAnxiety":None,"averageSleep":None,"averageSleepQuality":None,"peakEnergyType":None}
            cutoff = (datetime.fromisoformat(latest) - timedelta(days=days-1)).isoformat()
            rows = [dict(row) for row in db.execute("SELECT type,energy,mood,focus,anxiety,sleep_hours,sleep_quality FROM checkins WHERE timestamp>=?",(cutoff,))]
        groups = {}
        for row in rows: groups.setdefault(row["type"],[]).append(row["energy"])
        def energy_average(checkin_type):
            value = _average(groups[checkin_type])
            return float(value) if value is not None else -1.0
        peak = max(groups, key=energy_average) if groups else None
        return {"sampleSize":len(rows),"averageEnergy":_average([r["energy"] for r in rows]),"averageMood":_average([r["mood"] for r in rows]),"averageFocus":_average([r["focus"] for r in rows]),"averageAnxiety":_average([r["anxiety"] for r in rows]),"averageSleep":_average([r["sleep_hours"] for r in rows]),"averageSleepQuality":_average([r["sleep_quality"] for r in rows]),"peakEnergyType":peak}
