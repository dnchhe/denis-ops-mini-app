import json
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path


PROJECTS = [
    {
        "id": "money-teeth", "demo": True, "title": "Деньги на зубах", "client": "Клиентский проект",
        "description": "Подписочный клуб и автоматизация клиентского пути", "stage": "Первый этап завершён",
        "status": "waiting-payment", "nextAction": "Проверить поступление остатка оплаты", "deadline": "27 августа",
        "nextMove": "Клиент", "payment": {"total": "Не указано", "paid": "Не указано", "rest": "Уточнить"},
        "risk": "Ожидается остаток оплаты", "firstContact": "Уточнить", "startedAt": "Уточнить",
        "result": "Работающий первый этап подписочного клуба",
        "roadmap": ["Первый этап завершён", "Получить остаток оплаты", "Согласовать следующий этап"],
        "questions": ["Сумма остатка оплаты", "Состав следующего этапа"],
    },
    {
        "id": "natalia", "demo": True, "title": "Воронка Наталии", "client": "Наталия",
        "description": "Воронка для бухгалтерского сопровождения", "stage": "Исследование клиента",
        "status": "client-turn", "nextAction": "Получить разбор пути реального клиента", "deadline": "Уточнить",
        "nextMove": "Клиент", "payment": {"total": "Уточнить", "paid": "Уточнить", "rest": "Уточнить"},
        "risk": "Нет подтверждённого срока следующего ответа", "firstContact": "28 июля 2026", "startedAt": "29 июля 2026",
        "result": "Воронка: лид-магнит → квалификация → консультация → сопровождение",
        "roadmap": ["Путь клиента", "Основной продукт", "Консультация", "Лид-магнит", "Материалы", "Сборка бота"],
        "questions": ["Точный состав сопровождения", "Формат консультации", "Лид-магнит"],
    },
    {
        "id": "mini-app", "demo": True, "title": "Личная Mini App", "client": "Личный проект",
        "description": "Проекты, вакансии и быстрые чек-ины внутри Telegram", "stage": "Прототип",
        "status": "in-progress", "nextAction": "Проверить первый интерфейс на телефоне", "deadline": "После готовности прототипа",
        "nextMove": "Денис", "payment": {"total": "–", "paid": "–", "rest": "–"},
        "risk": "Не перегрузить первую версию", "firstContact": "24 августа 2026", "startedAt": "24 августа 2026",
        "result": "Простая рабочая панель внутри Telegram",
        "roadmap": ["Кликабельный прототип", "База данных", "Telegram", "Hermes", "Переносимый запуск"],
        "questions": ["Визуальная обратная связь", "Состав реальных данных для переноса"],
    },
]

VACANCIES = [
    {"id":"tech-specialist","title":"Технический специалист онлайн-проекта","company":"Демонстрационная вакансия","format":"Удалённо","salary":"100 000 ₽","match":82,"summary":"GetCourse, SaleBot, amoCRM, вебинары и автоматизации","status":"review","url":"#","response":"Отклик ещё не подготовлен","risks":["Нужно уточнить занятость","Возможна работа по выходным"]},
    {"id":"funnel-integrator","title":"Интегратор автоворонок","company":"Демонстрационная вакансия","format":"Проектно","salary":"20 000–45 000 ₽","match":91,"summary":"SaleBot + GetCourse, оплаты, сегментация и сообщения","status":"later","url":"#","response":"Есть подтверждённые кейсы для отклика","risks":["Нужно уточнить точный объём функционала"]},
]

TASKS = [
    ("task-0", "Определить структуру ближайшей версии", "Личная Mini App", 0, "done", "20 мин"),
    ("task-1", "Проверить обновлённый прототип Mini App", "Личная Mini App", 1, "ready", "15 мин"),
    ("task-2", "Дать короткую обратную связь по интерфейсу", "Личная Mini App", 2, "ready", "10 мин"),
    ("task-3", "Проверить поступление оплаты", "Деньги на зубах", 3, "ready", "5 мин"),
]

CALENDAR_EVENTS = [
    (24,"task","Прототип Mini App"),(25,"task","Проверка интерфейса"),(27,"payment","Остаток оплаты"),
    (28,"deadline","Контроль проектов"),(30,"focus","Фокус недели"),
]


def _average(values):
    values = [value for value in values if value is not None]
    return round(sum(values) / len(values), 1) if values else None


class Database:
    def __init__(self, path: Path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)

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
                CREATE TABLE IF NOT EXISTS calendar_events(id INTEGER PRIMARY KEY AUTOINCREMENT,day INTEGER NOT NULL,type TEXT NOT NULL,label TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS checkins(id INTEGER PRIMARY KEY AUTOINCREMENT,timestamp TEXT NOT NULL,type TEXT NOT NULL,energy REAL,mood REAL,focus REAL,anxiety REAL,sleep_hours REAL,sleep_quality REAL,distraction TEXT,demo INTEGER NOT NULL DEFAULT 0);
                CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
            """)
            if not db.execute("SELECT 1 FROM tasks LIMIT 1").fetchone():
                db.executemany("INSERT INTO tasks VALUES(?,?,?,?,?,?)", TASKS)
                db.executemany("INSERT INTO projects VALUES(?,?)", [(item["id"], json.dumps(item, ensure_ascii=False)) for item in PROJECTS])
                db.executemany("INSERT INTO vacancies VALUES(?,?)", [(item["id"], json.dumps(item, ensure_ascii=False)) for item in VACANCIES])
                db.executemany("INSERT INTO calendar_events(day,type,label) VALUES(?,?,?)", CALENDAR_EVENTS)
                db.execute("INSERT INTO settings VALUES(?,?)", ("weekly_focus", json.dumps({"title":"Собрать и проверить первую рабочую Mini App","completed":2,"total":5,"progress":40,"deadline":"30 августа"}, ensure_ascii=False)))
                self._seed_demo_checkins(db)

    def _seed_demo_checkins(self, db):
        values = [
            [[2,3,2,3],[3,3,3,2],[4,4,4,2]], [[2,3,2,3],[3,3,2,3],[5,4,4,1]],
            [[3,3,3,2],[3,4,3,2],[4,4,4,1]], [[2,3,2,3],[3,3,3,2],[5,5,4,1]],
            [[3,4,3,2],[3,4,3,2],[4,4,4,1]], [[2,3,2,2],[3,4,3,2],[4,4,4,1]],
            [[3,4,3,2],[3,4,3,2],[4,4,4,1]],
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
            events = [dict(row) for row in db.execute("SELECT day,type,label FROM calendar_events ORDER BY day")]
            focus = json.loads(db.execute("SELECT value FROM settings WHERE key='weekly_focus'").fetchone()["value"])
            history = [dict(row) for row in db.execute("SELECT timestamp,type,energy,mood,focus,anxiety,sleep_hours AS sleepHours,sleep_quality AS sleepQuality,distraction,demo FROM checkins ORDER BY timestamp")]
        return {"currentTask":current,"dayTasks":tasks,"weeklyFocus":focus,"calendarEvents":events,"projects":projects,"vacancies":vacancies,"wellbeingHistory":history,"vacancySearch":{"schedule":["12:00","16:00","20:00"],"weekdaysOnly":True,"lastRun":"Расписание подключено","status":"scheduled"}}

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

    def add_checkin(self, payload):
        with self.connect() as db:
            db.execute("INSERT INTO checkins(timestamp,type,energy,mood,focus,anxiety,sleep_hours,sleep_quality,distraction,demo) VALUES(?,?,?,?,?,?,?,?,?,0)",
                (payload["timestamp"],payload["type"],payload.get("energy"),payload.get("mood"),payload.get("focus"),payload.get("anxiety"),payload.get("sleepHours"),payload.get("sleepQuality"),payload.get("distraction")))

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
