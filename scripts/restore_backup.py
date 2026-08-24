import argparse
import shutil
import sqlite3
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATABASE = ROOT / 'data' / 'mini_app.sqlite3'
BACKUPS = ROOT / 'backups'


def integrity(path):
    with sqlite3.connect(path) as db:
        return db.execute('PRAGMA integrity_check').fetchone()[0]


def main():
    parser = argparse.ArgumentParser(description='Restore Mini App SQLite backup')
    parser.add_argument('backup', type=Path)
    args = parser.parse_args()
    source = args.backup.expanduser().resolve()
    if not source.is_file():
        raise SystemExit(f'Backup not found: {source}')
    if integrity(source) != 'ok':
        raise SystemExit('Selected backup failed integrity check')
    BACKUPS.mkdir(parents=True, exist_ok=True)
    if DATABASE.exists():
        safety = BACKUPS / f'pre_restore_{datetime.now():%Y-%m-%d_%H-%M-%S}.sqlite3'
        shutil.copy2(DATABASE, safety)
    DATABASE.parent.mkdir(parents=True, exist_ok=True)
    temp = DATABASE.with_suffix('.restore.tmp')
    shutil.copy2(source, temp)
    temp.replace(DATABASE)
    if integrity(DATABASE) != 'ok':
        raise SystemExit('Restored database failed integrity check')
    print(f'Restored: {source.name}')


if __name__ == '__main__':
    main()
