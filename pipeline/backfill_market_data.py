"""
Rechnet die Marktdaten (Event Study) fuer BESTEHENDE Storys in
data/stories.json nach -- ohne das Sprachmodell neu zu fragen.

Aufruf (im Projektordner):
    python pipeline/backfill_market_data.py

Welche Storys einen Chart bekommen, steht in data/market_overrides.json
(Schluessel = Story-ID, dazu Ticker, optional Vergleichsmarkt und
Ereignisdatum) und in data/market_topics.json (Themen-Tabelle). Alles
wird bei jedem Aufruf neu berechnet, das Skript ist also beliebig oft
wiederholbar.
Danach: python pipeline/build_frontend.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from pipeline.enrich_market_data import enrich_market_data  # noqa: E402

STORIES_PATH = ROOT / "data" / "stories.json"


def main() -> None:
    stories = json.loads(STORIES_PATH.read_text(encoding="utf-8"))
    done = 0
    for story in stories:
        title = (story.get("title") or "?")[:70]
        try:
            ok = enrich_market_data(story, refresh=True)
        except Exception as exc:  # noqa: BLE001
            print(f"[fehler] {title}: {exc}")
            continue
        if ok:
            done += 1
            n = len((story["market_correlation"].get("event_study") or {}).get("assets", []))
            print(f"[ok]     {title}  ({n} Auswertung(en) mit Event Study)")
        else:
            print(f"[--]     {title}  (kein Ticker oder keine Daten)")
    STORIES_PATH.write_text(json.dumps(stories, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nFertig: {done} Storys mit Event Study / Kursdaten.")
    print("Naechster Schritt: python pipeline/build_frontend.py")


if __name__ == "__main__":
    main()
