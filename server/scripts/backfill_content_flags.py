#!/usr/bin/env python3
"""
Backfill the `adult`, `certification` (movies) and `content_rating` (TV) columns
for titles that were ingested before the content-flag migration.

Usage:
    python scripts/backfill_content_flags.py            # every title
    python scripts/backfill_content_flags.py --limit 50 # first 50 titles
"""

import argparse
import sys
import time
import logging
from pathlib import Path

from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).resolve().parent))
from ingest import get_conn, tmdb_get, fetch_content_flags  # noqa: E402

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("backfill")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=None, help="only process the first N titles")
    args = parser.parse_args()

    conn = get_conn()
    cur = conn.cursor(dictionary=True)
    try:
        cur.execute("SELECT id, tmdb_id, media_type, title FROM titles ORDER BY id")
        rows = cur.fetchall()
        if args.limit:
            rows = rows[: args.limit]

        log.info("Backfilling content flags for %d titles…", len(rows))
        done = 0
        for r in rows:
            tid = r["tmdb_id"]
            details = tmdb_get(f"/{r['media_type']}/{tid}", params={"language": "en-US"})
            if details is None:
                log.warning("Skipping %s %s: no detail", r["media_type"], tid)
                continue
            adult, cert, cr = fetch_content_flags(r["media_type"], tid, details)
            cur.execute(
                """
                UPDATE `titles`
                SET `adult` = %s, `certification` = %s, `content_rating` = %s
                WHERE `id` = %s
                """,
                (bool(adult), cert, cr, r["id"]),
            )
            done += 1
            conn.commit()  # commit each title so a later failure can't undo this work
            if done % 25 == 0:
                log.info("Progress: %d/%d", done, len(rows))
            time.sleep(0.2)  # be nice to the API

        log.info("Backfill complete (%d titles updated).", done)
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()
