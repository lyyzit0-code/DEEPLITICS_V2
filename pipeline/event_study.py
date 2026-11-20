"""
Event Study fuer die Maerkte-Ansicht.

Frage, die dieses Modul beantwortet: "Hat sich dieser Kurs nach dem
Ereignis anders bewegt, als er es ohne das Ereignis normalerweise getan
haette?" -- statt nur Rohkurse nebeneinander zu zeigen.

Methode (Standard-Marktmodell, MacKinlay 1997):

1. Schaetzfenster: ~120 Handelstage VOR dem Ereignis (mit 10 Tagen
   Abstand, damit Vorab-Reaktionen das "Normal" nicht verfaelschen).
   Hier wird per Regression gelernt, wie der Kurs normalerweise auf den
   Gesamtmarkt (Benchmark, z.B. S&P 500) reagiert:
       Tagesrendite(Kurs) = alpha + beta * Tagesrendite(Benchmark) + Rauschen
2. Ereignisfenster: die Handelstage NACH dem Ereignis. Mit dem
   gelernten alpha/beta und der echten Benchmark-Bewegung wird fuer jeden
   Tag die ERWARTETE Rendite berechnet -- das ist der Gegenfaktische
   Verlauf "so haette sich der Kurs ohne das Ereignis bewegt".
3. Abnormale Rendite = tatsaechliche minus erwartete Rendite; ueber die
   Tage aufsummiert ergibt sich die CAR (kumulierte abnormale Rendite).
   Ein t-Wert sagt, ob die Abweichung groesser ist als das normale
   Rauschen (|t| > 2 ~ "auffaellig").

Zwei bewusste Entscheidungen (Nutzerfeedback 20.11.2026):
 * KEIN Grundtrend (alpha) in der erwarteten Linie. Ein Durchschnittstrend
   der letzten 120 Tage, 15 Tage lang aufaddiert, wirkte wie eine Prognose
   (S&P 500: Linie stieg, obwohl der Kurs davor fiel). Erwartet wird nur
   beta * Bewegung des Vergleichsmarkts. alpha wird weiter geschaetzt, damit
   beta und das Rauschen sauber sind, aber nicht fortgeschrieben.
 * PASSENDER Vergleichsmarkt je Wertart (`benchmark_for`): Rohstoffe gegen
   andere Rohstoffe, Waehrungen gegen den Dollar-Index, Aktien gegen den
   S&P 500 usw. -- der S&P 500 passt fuer Aluminium oder Wechselkurse nicht.
 * Der Wert darf NICHT in seinem eigenen Vergleichsmarkt stecken (sonst laufen
   beide Linien fast parallel, z.B. Oel gegen einen Rohstoff-ETF, der zu
   einem grossen Teil aus Oel besteht). Darum wird der Vergleichsmarkt bei
   Rohstoffen und Aktienindizes als gleichgewichteter Durchschnitt EINER
   GRUPPE ANDERER WERTE selbst gebaut ("basket:..."), ohne den Wert selbst
   und ohne seinen Zwilling (WTI/Brent).

Ist der Kurs selbst die Benchmark und kein anderer Vergleichsmarkt
verfuegbar, gilt das Mean-Adjusted-Modell ohne Trend: erwartet = 0 %.

WICHTIG (ehrliche Einordnung, steht auch so im Frontend): Das ist eine
statistische SCHAETZUNG. Sie zeigt, ob der Kurs ungewoehnlich lief, nicht,
dass das Ereignis die Ursache war -- am selben Tag passiert immer mehr
als eine Sache.

Reine Rechenfunktion `compute_event_study` (kein Netzwerk, testbar) und
darum herum `build_event_study` (holt die Kurse via yfinance).
"""

from __future__ import annotations

import math
import sys
from datetime import date, datetime, timedelta

EST_DAYS = 120   # Handelstage im Schaetzfenster
GAP_DAYS = 10    # Handelstage Abstand zwischen Schaetzfenster und Ereignis
MIN_EST = 40     # weniger Beobachtungen -> Schaetzung nicht belastbar
PRE_SHOW = 5     # Handelstage VOR dem Ereignis, die im Chart gezeigt werden
POST_MAX = 15    # Handelstage NACH dem Ereignis, die maximal gezeigt werden
MIN_POST = 2     # weniger Tage nach dem Ereignis -> noch nichts zu sehen
EST_CAL_DAYS = 250   # Kalendertage Kursdaten vor dem Ereignis laden
POST_CAL_DAYS = 28   # Kalendertage Kursdaten nach dem Ereignis laden


def _clean(series):
    """Close-Serie -> tz-freier, sortierter, duplikatfreier Tagesindex."""
    import pandas as pd

    idx = pd.DatetimeIndex(series.index)
    if idx.tz is not None:
        idx = idx.tz_localize(None)
    s = series.copy()
    s.index = idx.normalize()
    s = s[~s.index.duplicated(keep="last")].sort_index()
    return s.astype(float).dropna()


def compute_event_study(asset, bench, event_date) -> dict | None:
    """Rechenkern. `asset`/`bench`: pandas-Serien mit Schlusskursen
    (Index = Datum), `bench` darf None sein (dann Mean-Adjusted-Modell).
    `event_date`: date/datetime/'YYYY-MM-DD'. Basis (= 0 %) ist der
    letzte Schlusskurs VOR dem Ereignisdatum. None, wenn nicht genug
    Daten da sind (zu kurze Historie, zu wenige Tage nach dem Ereignis)."""
    import numpy as np
    import pandas as pd

    a = _clean(asset)
    if bench is not None:
        b = _clean(bench)
        df = pd.concat({"a": a, "m": b}, axis=1, join="inner").dropna()
    else:
        df = pd.DataFrame({"a": a})

    ev = pd.Timestamp(event_date).normalize()
    n = len(df)
    base_pos = int(df.index.searchsorted(ev)) - 1  # letzter Handelstag < Ereignisdatum
    if base_pos < 1:
        return None
    post_n = min(POST_MAX, n - 1 - base_pos)
    if post_n < MIN_POST:
        return None

    rets = df.pct_change()
    est_end = base_pos - GAP_DAYS
    est_start = max(1, est_end - EST_DAYS + 1)
    if est_end - est_start + 1 < MIN_EST:
        return None
    est = rets.iloc[est_start: est_end + 1].dropna()
    if len(est) < MIN_EST:
        return None

    y = est["a"].to_numpy()
    model = "mean"
    alpha, beta, r2 = float(y.mean()), 0.0, 0.0
    sd = float(y.std(ddof=1))
    if bench is not None:
        x = est["m"].to_numpy()
        vx = float(x.var(ddof=1))
        if vx > 1e-12:
            beta = float(np.cov(x, y, ddof=1)[0, 1] / vx)
            alpha = float(y.mean() - beta * x.mean())
            resid = y - (alpha + beta * x)
            sd = float(resid.std(ddof=2))
            ss_tot = float(((y - y.mean()) ** 2).sum())
            r2 = 1.0 - float((resid ** 2).sum()) / ss_tot if ss_tot > 0 else 0.0
            model = "market"

    p0 = base_pos + 1
    p1 = base_pos + 1 + post_n
    post = rets.iloc[p0:p1]
    if model == "market":
        exp_ret = beta * post["m"]          # ohne alpha: kein fortgeschriebener Grundtrend
    else:
        exp_ret = pd.Series(0.0, index=post.index)
    ar = post["a"] - exp_ret
    car = float(ar.sum())
    exp_cum = (1.0 + exp_ret).cumprod() - 1.0
    base_close = float(df["a"].iloc[base_pos])
    act_cum = df["a"].iloc[p0:p1] / base_close - 1.0
    diff = float(act_cum.iloc[-1] - exp_cum.iloc[-1])
    t_stat = car / (sd * math.sqrt(post_n)) if sd > 1e-12 else None

    points = []
    for pos in range(max(0, base_pos - PRE_SHOW), base_pos + 1):
        close = float(df["a"].iloc[pos])
        points.append({
            "date": df.index[pos].strftime("%Y-%m-%d"),
            "day": pos - base_pos,
            "close": close,
            "actual": round((close / base_close - 1.0) * 100, 3),
            "expected": 0.0 if pos == base_pos else None,
        })
    for k in range(post_n):
        pos = p0 + k
        close = float(df["a"].iloc[pos])
        points.append({
            "date": df.index[pos].strftime("%Y-%m-%d"),
            "day": pos - base_pos,
            "close": close,
            "actual": round(float(act_cum.iloc[k]) * 100, 3),
            "expected": round(float(exp_cum.iloc[k]) * 100, 3),
        })

    return {
        "model": model,
        "alpha_pct_daily": round(alpha * 100, 4),
        "beta": round(beta, 3),
        "r2": round(r2, 3),
        "n_est": int(len(est)),
        "resid_sd_pct": round(sd * 100, 3),
        "n_post": int(post_n),
        "car_pct": round(car * 100, 3),
        "diff_pct": round(diff * 100, 3),
        "t_stat": round(t_stat, 2) if t_stat is not None else None,
        "points": points,
    }


# Vergleichsmaerkte je Wertart
BENCH_DOLLAR = "DX-Y.NYB"     # US-Dollar-Index (CAD ist darin nur zu ca. 9 % enthalten)
BASKET_PREFIX = "basket:"
# Gruppen fuer selbstgebaute Vergleichsmaerkte (Wert selbst wird immer weggelassen)
PEER_GROUPS = {
    "commodity": ["CL=F", "BZ=F", "NG=F", "GC=F", "SI=F", "HG=F", "ZC=F", "ZW=F", "ZS=F", "KC=F", "SB=F", "CT=F"],
    "equity": ["^GSPC", "^GDAXI", "^FTSE", "^N225", "^HSI", "^STOXX50E", "^GSPTSE"],
}
# Zwillinge: gleicher Markt, darum ebenfalls aus dem Vergleich ausschliessen
_TWINS = {"CL=F": {"BZ=F"}, "BZ=F": {"CL=F"}}
MIN_PEERS = 3


def benchmark_for(ticker: str, story_benchmark: str | None) -> list[str]:
    """Vergleichsmaerkte fuer diesen Wert, beste Wahl zuerst (Rueckfaelle
    dahinter). Der S&P 500 passt nur fuer Aktien, nicht fuer Rohstoffe oder
    Waehrungen; und der Wert darf nicht selbst im Vergleichsmarkt stecken."""
    sb = story_benchmark or "^GSPC"
    if ticker.endswith("=X"):
        cands = [BENCH_DOLLAR]
    elif ticker.endswith("=F"):
        cands = [BASKET_PREFIX + "commodity"]
    elif ticker == "^GSPC":
        cands = [BASKET_PREFIX + "equity"]
    else:
        cands = [sb]
    if not ticker.endswith("=F") and sb not in cands and sb != ticker:
        cands.append(sb)
    return [c for c in cands if c != ticker]


_CLOSE_CACHE: dict = {}


def _fetch_close(ticker: str, start: date, end: date):
    """Schlusskurse via yfinance (end exklusiv), je Lauf zwischengespeichert.
    None bei jedem Fehler."""
    key = (ticker, start, end)
    if key not in _CLOSE_CACHE:
        _CLOSE_CACHE[key] = _fetch_close_uncached(ticker, start, end)
    return _CLOSE_CACHE[key]


def _peer_basket(group: str, exclude: set, start: date, end: date):
    """Gleichgewichteter Durchschnitt der Tagesrenditen aller Werte der
    Gruppe OHNE `exclude`, als Kursreihe (Start = 100). None, wenn zu wenige
    Werte Daten liefern."""
    import pandas as pd

    rets = []
    for sym in PEER_GROUPS.get(group, []):
        if sym in exclude:
            continue
        c = _fetch_close(sym, start, end)
        if c is None:
            continue
        r = _clean(c).pct_change().dropna()
        if len(r) >= MIN_EST:
            rets.append(r)
    if len(rets) < MIN_PEERS:
        return None
    df = pd.concat(rets, axis=1)
    mean = df.mean(axis=1)[df.notna().sum(axis=1) >= MIN_PEERS]
    if len(mean) < MIN_EST:
        return None
    return 100.0 * (1.0 + mean).cumprod()


def _fetch_close_uncached(ticker: str, start: date, end: date):
    """Schlusskurse via yfinance (end exklusiv). None bei jedem Fehler."""
    try:
        import yfinance as yf
    except ImportError:
        print("[info] yfinance nicht installiert -- Event Study uebersprungen.", file=sys.stderr)
        return None
    try:
        hist = yf.Ticker(ticker).history(
            start=start.strftime("%Y-%m-%d"), end=end.strftime("%Y-%m-%d"), interval="1d"
        )
        if hist is None or hist.empty or "Close" not in hist.columns:
            return None
        return hist["Close"]
    except Exception as exc:  # noqa: BLE001 - yfinance-Fehler sind hier nicht-fatal
        print(f"    [warn] yfinance-Abruf fuer '{ticker}' fehlgeschlagen: {exc}", file=sys.stderr)
        return None


def build_event_study(tickers: list[str], benchmark: str | None, event_date: date,
                      today: date | None = None) -> dict | None:
    """Holt Kurse fuer `tickers` (+ Benchmark) und rechnet pro Ticker die
    Event Study. Rueckgabe: {"benchmark": str|None, "assets": [{"ticker",
    ...compute_event_study-Felder...}]} oder None, wenn kein Ticker
    auswertbar war."""
    today = today or date.today()
    start = event_date - timedelta(days=EST_CAL_DAYS)
    end = min(event_date + timedelta(days=POST_CAL_DAYS), today) + timedelta(days=1)

    bench_cache: dict = {}

    def bench_series(sym: str, ticker: str):
        """Vergleichsreihe; Korb-Vergleichsmaerkte werden OHNE den Wert selbst gebaut."""
        if sym.startswith(BASKET_PREFIX):
            ex = {ticker} | _TWINS.get(ticker, set())
            key = (sym, tuple(sorted(ex)))
            if key not in bench_cache:
                bench_cache[key] = _peer_basket(sym[len(BASKET_PREFIX):], ex, start, end)
            return bench_cache[key]
        return _fetch_close(sym, start, end)

    assets = []
    for ticker in tickers:
        close = _fetch_close(ticker, start, end)
        if close is None:
            continue
        res, used = None, None
        for cand in benchmark_for(ticker, benchmark):
            bs = bench_series(cand, ticker)
            if bs is None:
                continue
            try:
                r = compute_event_study(close, bs, event_date)
            except Exception as exc:  # noqa: BLE001
                print(f"    [warn] Event Study fuer '{ticker}' gegen '{cand}' fehlgeschlagen: {exc}", file=sys.stderr)
                continue
            if r is not None:
                res, used = r, cand
                break
        if res is None:  # kein Vergleichsmarkt brauchbar -> Modell ohne Vergleichsmarkt
            try:
                res = compute_event_study(close, None, event_date)
            except Exception as exc:  # noqa: BLE001
                print(f"    [warn] Event Study fuer '{ticker}' fehlgeschlagen: {exc}", file=sys.stderr)
                continue
        if res is None:
            continue
        res["ticker"] = ticker
        res["benchmark"] = used if res["model"] == "market" else None
        assets.append(res)

    if not assets:
        return None
    return {"benchmark": benchmark, "assets": assets}


def parse_date(raw) -> date | None:
    """'YYYY-MM-DD' (oder ISO-Zeitstempel) -> date, sonst None."""
    if isinstance(raw, datetime):
        return raw.date()
    if isinstance(raw, date):
        return raw
    if not isinstance(raw, str) or len(raw) < 10:
        return None
    try:
        return date.fromisoformat(raw[:10])
    except ValueError:
        return None
