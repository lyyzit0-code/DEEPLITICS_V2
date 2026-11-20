"""
Verifizierte Marktdaten via yfinance + Event Study.

Dieses Modul ERGAENZT nur das BESTEHENDE `market_correlation`-Feld einer
Story (kein zweites Datenmodell). Das Modell nennt in seiner JSON-Antwort
optional ein paar echte Yahoo-Finance-Ticker (`tickers`), ein Ereignisdatum
(`event_date`) und einen Vergleichsmarkt (`benchmark`); hier werden dafuer
ECHTE Kursdaten geholt und ausgewertet.

Neu (Event Study, s. event_study.py):
  * Statt Rohkursen werden Prozent-Veraenderungen seit dem Ereignis gezeigt.
  * Zusaetzlich wird per Marktmodell geschaetzt, wie sich der Kurs OHNE das
    Ereignis bewegt haette ("erwarteter Verlauf") -- das Ergebnis steht in
    `market_correlation.event_study` (Frontend: app.js::drawMarketChart).
  * `market_correlation.series` (Rohkurse) wird weiter befuellt: als
    Rueckfall fuer Faelle, in denen die Event Study nicht berechnet werden
    kann (zu wenig Historie, Ereignis zu frisch), und fuer alle, die das
    alte Format lesen.

Woher kommen die Ticker? (Reihenfolge = Prioritaet)
  1. `data/market_overrides.json` fuer genau diese Story (von Hand,
     Schluessel = Story-ID; kann auch das Urteil "Marktbezug ja" samt
     Begruendung setzen und das Ereignisdatum festlegen),
  2. `market_correlation.tickers` aus der Modell-Antwort (neue Storys),
  3. `data/market_topics.json`: Themen-Tabelle (Stichwoerter -> Ticker),
     greift automatisch, wenn das Modell Marktbezug bejaht, aber keine
     Ticker genannt hat.

Ereignisdatum: `market_correlation.event_date` (vom Modell), sonst das
Datum der Story (`generated_at`) -- dann wird das im Chart offen als
"Datum der Meldung" ausgewiesen.

Laeuft NACH der Synthese (s. run_pipeline.py), pro Story, mit try/except
drumherum: ein yfinance-Ausfall darf nie den Lauf oder die Story zum
Absturz bringen, die Story bleibt dann bei ihrer qualitativen Einschaetzung.
"""

from __future__ import annotations

import json
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from pipeline.event_study import build_event_study, parse_date

MAX_TICKERS_PER_STORY = 7
LOOKBACK_DAYS = 10   # nur fuer den Rohkurs-Rueckfall
LOOKAHEAD_DAYS = 15  # nur fuer den Rohkurs-Rueckfall
DEFAULT_BENCHMARK = "^GSPC"

OVERRIDES_PATH = Path(__file__).resolve().parent.parent / "data" / "market_overrides.json"
TOPICS_PATH = Path(__file__).resolve().parent.parent / "data" / "market_topics.json"

VERIFIED_NOTE = (
    "Welche Märkte betroffen sind, ist eine Einschätzung aus Allgemeinwissen. "
    "Die Kurse selbst sind echte Tagesschlusskurse (Yahoo Finance)."
)


def _load_overrides() -> dict:
    try:
        raw = json.loads(OVERRIDES_PATH.read_text(encoding="utf-8"))
        return {k: v for k, v in raw.items() if isinstance(v, dict) and not k.startswith("_")}
    except FileNotFoundError:
        return {}
    except Exception as exc:  # noqa: BLE001
        print(f"[warn] {OVERRIDES_PATH.name} nicht lesbar: {exc}", file=sys.stderr)
        return {}


def _topic_match(story: dict) -> dict:
    """Erste Regel aus data/market_topics.json, deren Stichwoerter im Text der
    Story vorkommen (Titel + Kurzfassung + Zusammenfassung). {} wenn keine."""
    try:
        rules = json.loads(TOPICS_PATH.read_text(encoding="utf-8")).get("rules", [])
    except FileNotFoundError:
        return {}
    except Exception as exc:  # noqa: BLE001
        print(f"[warn] {TOPICS_PATH.name} nicht lesbar: {exc}", file=sys.stderr)
        return {}
    text = " ".join(str(story.get(k, "")) for k in ("title", "one_line", "summary")).lower()
    for rule in rules:
        any_kw = [k.lower() for k in rule.get("any", [])]
        all_kw = [k.lower() for k in rule.get("all", [])]
        if any_kw and not any(k in text for k in any_kw):
            continue
        if all_kw and not all(k in text for k in all_kw):
            continue
        if any_kw or all_kw:
            return rule
    return {}


def _clean_tickers(raw) -> list[str]:
    out: list[str] = []
    for t in raw or []:
        if isinstance(t, str) and t.strip() and t.strip() not in out:
            out.append(t.strip())
    return out


def _story_date(story: dict) -> date:
    """Datum der Story (generated_at), Fallback heute."""
    d = parse_date(story.get("generated_at"))
    return d or datetime.now(timezone.utc).date()


def _series_from_study(study: dict) -> list[dict]:
    """Rohkurs-Serien (altes Format) aus den Event-Study-Punkten."""
    out = []
    for a in study["assets"]:
        out.append({
            "label": a["ticker"],
            "raw_unit": "",
            "points": [{"date": p["date"], "value": round(p["close"], 4)} for p in a["points"]],
            "source_url": f"https://finance.yahoo.com/quote/{a['ticker']}",
        })
    return out


def _fetch_raw_series(ticker: str, event: date) -> dict | None:
    """Rueckfall: Rohkurse im Fenster um das Ereignis (ohne Event Study)."""
    try:
        import yfinance as yf
    except ImportError:
        return None
    try:
        start = (event - timedelta(days=LOOKBACK_DAYS)).strftime("%Y-%m-%d")
        end = (event + timedelta(days=LOOKAHEAD_DAYS + 1)).strftime("%Y-%m-%d")
        hist = yf.Ticker(ticker).history(start=start, end=end, interval="1d")
        if hist is None or hist.empty or "Close" not in hist.columns:
            return None
        points = [
            {"date": idx.strftime("%Y-%m-%d"), "value": round(float(c), 4)}
            for idx, c in hist["Close"].items()
        ]
        if len(points) < 2:
            return None
        return {
            "label": ticker,
            "raw_unit": "",
            "points": points,
            "source_url": f"https://finance.yahoo.com/quote/{ticker}",
        }
    except Exception as exc:  # noqa: BLE001
        print(f"    [warn] yfinance-Abruf für Ticker '{ticker}' fehlgeschlagen: {exc}", file=sys.stderr)
        return None


def _series_is_from_yahoo(mc: dict) -> bool:
    series = mc.get("series") or []
    return bool(series) and all(
        isinstance(s, dict) and str(s.get("source_url", "")).startswith("https://finance.yahoo.com")
        for s in series
    )


def _apply_override_judgement(story: dict, override: dict) -> bool:
    """Hat die Override-Datei fuer diese Story ein eigenes Urteil
    ("explanation"), obwohl das Modell keinen Marktbezug (oder gar keine
    Analyse) geliefert hat, wird has_correlation=True gesetzt. True, wenn
    das hier passiert ist (dann kann der Aufrufer es bei Misserfolg
    zuruecknehmen)."""
    mc = story.get("market_correlation")
    if override.get("explanation") and not (isinstance(mc, dict) and mc.get("has_correlation")):
        story["market_correlation"] = {
            "has_correlation": True, "explanation": override["explanation"], "series": [], "note": "",
        }
        return True
    return False


def enrich_market_data(story: dict, refresh: bool = False) -> bool:
    """Siehe _enrich_market_data; zusaetzlich: ein per Override gesetztes
    Urteil "Marktbezug ja" wird zurueckgenommen, wenn keine Kursdaten
    kommen (sonst stuende eine Behauptung ohne Beleg da)."""
    original = story.get("market_correlation")
    forced = _apply_override_judgement(story, _load_overrides().get(str(story.get("id", "")), {}))
    ok = _enrich_market_data(story, refresh)
    if forced and not ok:
        story["market_correlation"] = original
    return ok


def _enrich_market_data(story: dict, refresh: bool = False) -> bool:
    """Veredelt `story['market_correlation']` mit echten Kursdaten und der
    Event Study. Mutiert `story` in-place; True, wenn mindestens ein Ticker
    erfolgreich ausgewertet wurde.

    Eine bereits vorhandene, RECHERCHIERTE `series` (research_depth="full")
    wird nie ueberschrieben. Mit `refresh=True` werden auch Yahoo-Serien
    einer frueheren Version neu berechnet (fuer das Backfill-Skript)."""
    mc = story.get("market_correlation")
    if not isinstance(mc, dict) or not mc.get("has_correlation"):
        return False

    if mc.get("series"):
        if not (refresh and _series_is_from_yahoo(mc)):
            mc.pop("tickers", None)
            return False

    override = _load_overrides().get(str(story.get("id", "")), {})
    topic = {}
    tickers = _clean_tickers(override.get("tickers")) or _clean_tickers(mc.get("tickers"))
    if not tickers:
        topic = _topic_match(story)
        tickers = _clean_tickers(topic.get("tickers"))
    mc.pop("tickers", None)  # internes Zwischenfeld, nie ins finale JSON
    if not tickers:
        return False
    tickers = tickers[:MAX_TICKERS_PER_STORY]

    # Begruendung je Ticker ("Warum steht dieser Wert hier?") -- Prioritaet wie bei den Tickern
    reasons: dict[str, str] = {}
    for src in (topic.get("reasons"), mc.get("ticker_reasons"), override.get("reasons")):
        if isinstance(src, dict):
            reasons.update({str(k): str(v).strip() for k, v in src.items() if isinstance(v, str) and v.strip()})
    mc.pop("ticker_reasons", None)
    event_label = override.get("event_label") or mc.get("event_label") or ""
    event_label = event_label.strip()[:40] if isinstance(event_label, str) else ""
    mc.pop("event_label", None)
    event_desc = override.get("event_description") or mc.get("event_description") or ""
    event_desc = event_desc.strip()[:160] if isinstance(event_desc, str) else ""
    mc.pop("event_description", None)

    # Trennung Theorie / Messung: Wirkungen, die sich NICHT ueber einen Kurs messen lassen,
    # stehen als eigene Liste "unmeasured" (Frontend: "Nur theoretisch ...").
    raw_unm = override.get("unmeasured") or mc.get("unmeasured_effects") or mc.get("unmeasured") or []
    mc["unmeasured"] = [x.strip() for x in raw_unm if isinstance(x, str) and x.strip()][:6] if isinstance(raw_unm, list) else []
    mc.pop("unmeasured_effects", None)
    if isinstance(override.get("explanation_text"), str) and override["explanation_text"].strip():
        mc["explanation"] = override["explanation_text"].strip()

    benchmark = (override.get("benchmark") or mc.get("benchmark") or topic.get("benchmark") or DEFAULT_BENCHMARK)
    benchmark = benchmark.strip() if isinstance(benchmark, str) and benchmark.strip() else DEFAULT_BENCHMARK
    mc.pop("benchmark", None)

    story_day = _story_date(story)
    model_date = parse_date(override.get("event_date")) or parse_date(mc.get("event_date"))
    # Plausibilitaet: ein Ereignis liegt nicht in der Zukunft der Meldung und
    # nicht ewig davor -- sonst hat das Modell sich vertan, dann Story-Datum.
    if model_date and not (story_day - timedelta(days=120) <= model_date <= story_day + timedelta(days=1)):
        model_date = None
    event = model_date or story_day
    date_source = "model" if model_date else "story_date"

    study = None
    try:
        study = build_event_study(tickers, benchmark, event)
    except Exception as exc:  # noqa: BLE001
        print(f"    [warn] Event Study fehlgeschlagen: {exc}", file=sys.stderr)

    if study:
        series = _series_from_study(study)
        for a in study["assets"]:
            for p in a["points"]:
                p.pop("close", None)
        got = {a["ticker"] for a in study["assets"]}
        for a in study["assets"]:
            if reasons.get(a["ticker"]):
                a["reason"] = reasons[a["ticker"]]
        # Angeforderte Werte ohne ausreichende Kursdaten: nicht verschweigen, das Frontend nennt sie
        study["skipped"] = [t for t in tickers if t not in got]
        study["event_date"] = event.isoformat()
        study["event_date_source"] = date_source
        mc["event_study"] = study
    else:
        if mc.get("event_study"):
            return False  # Neuberechnung fehlgeschlagen: bestehende gute Auswertung behalten
        series = [s for s in (_fetch_raw_series(t, event) for t in tickers) if s]

    if not series:
        return False

    mc["series"] = series
    mc["event_date"] = event.isoformat()
    if event_label:
        mc["event_label"] = event_label
    if event_desc:
        mc["event_description"] = event_desc
    mc["event_date_source"] = date_source
    mc["verified_live"] = True
    mc["note"] = VERIFIED_NOTE
    return True


def enrich_all_stories(stories: list[dict], refresh: bool = False) -> list[dict]:
    """Batch ueber eine Story-Liste; ein Fehler darf die anderen nicht stoppen."""
    n_ok = 0
    for story in stories:
        try:
            if enrich_market_data(story, refresh=refresh):
                n_ok += 1
        except Exception as exc:  # noqa: BLE001
            print(f"    [warn] Marktdaten-Anreicherung für '{story.get('title', '?')}' fehlgeschlagen: {exc}", file=sys.stderr)
    if n_ok:
        print(f"[info] {n_ok} Storys mit echten Kursdaten ausgewertet.", file=sys.stderr)
    return stories
