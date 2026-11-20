/* Deeplitics v7 — App-Logik. Reines Frontend, KEINE API-Aufrufe, KEIN
   localStorage (Cowork-Artefakt-Vorgabe): Profil/Verlauf/Gespeichert
   leben nur im Speicher dieser Sitzung und setzen sich beim Neuladen
   zurueck (Nutzer wird darauf im Profil-Panel hingewiesen). */
(function () {
  "use strict";

  var STORIES = window.__STORIES__ || [];
  var SOURCE_BIAS = window.__SOURCE_BIAS__ || {};

  var CATEGORIES = {
    security:     { de: "Sicherheit & Militär",     en: "Security & Military" },
    diplomacy:    { de: "Diplomatie",                en: "Diplomacy" },
    trade:        { de: "Handel & Wirtschaft",       en: "Trade & Economy" },
    rights:       { de: "Migration & Bürgerrechte",  en: "Migration & Rights" },
    conflict:     { de: "Konflikt & Krieg",          en: "Conflict & War" },
    surveillance: { de: "Überwachung & Innenpolitik",en: "Surveillance & Domestic" }
  };

  var STR = {
    de: {
      brand: "Deeplitics", allTopics: "Alle Themen", noStories: "Keine Storys für diese Auswahl.",
      readMore: "Weiterlesen", readLess: "Weniger anzeigen", sources: n => n + (n===1 ? " Quelle" : " Quellen"),
      historien: "Historien", uebersicht: "Übersicht", stakeholdersTab: "Stakeholders", maerkte: "Märkte", theorieTab: "Theorie",
      noTheory: "Keine spezifische politikwissenschaftliche Theorie für diese Story identifiziert — bewusst leer statt erfunden.",
      quotes: "Zitate", sourcesHead: "Quellen", primarySources: "Primärquellen",
      cuiBono: "Wer profitiert?", noMarket: "Keine belastbare Marktkorrelation gefunden — dieses Feld bleibt bewusst leer statt eine erfunden zu zeigen.",
      marketQualitative: "Einschätzung aus Allgemeinwissen, keine live abgefragten Kursdaten.",
      wikipedia: "Wikipedia-Artikel öffnen", keyFigure: "Zentrale Figur dieser Story",
      profile: "Profil", newAvatar: "Neuer Avatar", language: "Sprache", appearance: "Darstellung",
      dark: "Dunkel", light: "Hell", contentPrefs: "Inhaltspräferenzen",
      history: "Leseverlauf", saved: "Gespeichert", sessionNote: "Profil, Verlauf und gespeicherte Storys gelten nur für diese Sitzung und werden beim Neuladen zurückgesetzt.",
      emptyHistory: "Noch nichts gelesen. Öffne eine Story, und sie taucht hier auf.",
      emptySaved: "Noch nichts gespeichert. Tippe auf das Lesezeichen-Symbol einer Story.",
      back: "Zurück", close: "Schließen", save: "Speichern", saved_: "Gespeichert",
      langNote: "Die Story-Inhalte sind aktuell nur auf Deutsch verfügbar.",
      profitsFrom: "Profitiert davon", losesFrom: "Verliert dabei / ist dagegen",
      noProfiteers: "Kein eindeutig benannter Profiteur in dieser Story.",
      noLosers: "Kein eindeutig benannter Verlierer in dieser Story.",
      counterLabel: "Gegenperspektive",
      standLabel: function (d) { return "Stand: " + d; }
    },
    en: {
      brand: "Deeplitics", allTopics: "All topics", noStories: "No stories for this selection.",
      readMore: "Read more", readLess: "Show less", sources: n => n + (n===1 ? " source" : " sources"),
      historien: "Threads", uebersicht: "Overview", stakeholdersTab: "Stakeholders", maerkte: "Markets", theorieTab: "Theory",
      noTheory: "No specific political-science theory identified for this story — deliberately left empty rather than invented.",
      quotes: "Quotes", sourcesHead: "Sources", primarySources: "Primary sources",
      cuiBono: "Who benefits?", noMarket: "No reliable market correlation found — left honestly empty instead of inventing one.",
      marketQualitative: "Assessment from general knowledge, not live market data.",
      wikipedia: "Open Wikipedia article", keyFigure: "Key figure in this story",
      profile: "Profile", newAvatar: "New avatar", language: "Language", appearance: "Appearance",
      dark: "Dark", light: "Light", contentPrefs: "Content preferences",
      history: "Reading history", saved: "Saved", sessionNote: "Profile, history and saved stories only last for this session and reset on reload.",
      emptyHistory: "Nothing read yet. Open a story and it will show up here.",
      emptySaved: "Nothing saved yet. Tap a story's bookmark icon.",
      back: "Back", close: "Close", save: "Save", saved_: "Saved",
      langNote: "Story content is currently only available in German.",
      profitsFrom: "Benefits from this", losesFrom: "Loses out / is against",
      noProfiteers: "No clearly named beneficiary in this story.",
      noLosers: "No clearly named loser in this story.",
      counterLabel: "Counter-view",
      standLabel: function (d) { return "As of: " + d; }
    }
  };

  var state = {
    theme: "dark",
    lang: "de",
    activeCats: new Set(Object.keys(CATEGORIES)),
    history: [],
    saved: new Set(),
    avatarSeed: Math.random(),
    view: "home",
    currentStoryId: null,
    activeTab: 0,
    activeThread: {},
    // Tipp-Animation der Begrüßung: nur EINMAL beim ersten Laden abspielen,
    // nicht bei jedem Re-Render (z.B. Kategorie-Filter-Klick), sonst würde
    // der Spruch bei jedem Klick neu getippt werden.
    greetingText: null,
    greetingTyped: false,
    introGridPlayed: false
  };

  function t(key) { return STR[state.lang][key]; }
  function catLabel(key) { var c = CATEGORIES[key]; return c ? c[state.lang] : key; }

  /* Kleine Rubriken-Icons (Nutzer-Feedback 27.08.2026: "fuege fuer die
     einzelnen Rubriken kleine Logos hinzu, um das Ganze anschaulicher zu
     machen"). Gleicher Stil wie die uebrigen Inline-Icons der App (24x24
     viewBox, stroke="currentColor", abgerundete Linien, s. CLOSE_ICON/
     BACK_ICON weiter unten) -- bewusst sehr reduziert (max. 2 Pfade), damit
     sie auch bei 12-16px auf einem Chip noch klar lesbar bleiben. */
  var CATEGORY_ICONS = {
    security: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 3 5 5.5v5c0 4.8 3 8.1 7 9.3 4-1.2 7-4.5 7-9.3v-5L12 3Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    diplomacy: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8.2" stroke="currentColor" stroke-width="1.6"/><ellipse cx="12" cy="12" rx="3.6" ry="8.2" stroke="currentColor" stroke-width="1.4"/><path d="M3.8 12h16.4" stroke="currentColor" stroke-width="1.4"/></svg>',
    trade: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 17 9.5 11.3 13 14.8 20 7.4" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M14.5 7.4H20v5.5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    rights: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 4v16M6 20h12M4 8h16" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="6.2" cy="11.6" r="2.3" stroke="currentColor" stroke-width="1.4"/><circle cx="17.8" cy="11.6" r="2.3" stroke="currentColor" stroke-width="1.4"/></svg>',
    conflict: '<svg viewBox="0 0 24 24" fill="none"><path d="M4.5 4.5l15 15M19.5 4.5l-15 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M9.7 9.7 8.2 8.2M14.3 9.7l1.5-1.5M9.7 14.3l-1.5 1.5M14.3 14.3l1.5 1.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
    surveillance: '<svg viewBox="0 0 24 24" fill="none"><path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="12" cy="12" r="2.7" stroke="currentColor" stroke-width="1.5"/></svg>'
  };
  function catIcon(key) { return CATEGORY_ICONS[key] || ""; }

  /* ---------------- utils ---------------- */
  function escapeHtml(s) {
    if (s == null) return "";
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function linkify(text, story) {
    if (!text) return "";
    var esc = escapeHtml(text);
    return esc.replace(/\[\[([^\]]+)\]\]/g, function (m, name) {
      var ent = findEntity(story, name);
      if (!ent) return escapeHtml(name);
      return '<span class="lk" data-entity="' + escapeHtml(name) + '">' + escapeHtml(name) + "</span>";
    });
  }

  function findEntity(story, name) {
    if (!story || !story.entities) return null;
    for (var i = 0; i < story.entities.length; i++) {
      if (story.entities[i].name === name) return story.entities[i];
    }
    return null;
  }

  function fmtDate(iso) {
    if (!iso) return "";
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return d.toLocaleDateString(state.lang === "de" ? "de-DE" : "en-US", { day: "2-digit", month: "short", year: "numeric" });
    } catch (e) { return iso; }
  }

  /* ---------------- icons ---------------- */
  var ICON = {
    person: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8.2" r="3.6" fill="#fff" fill-opacity=".92"/><path d="M4.5 20c.8-4 3.7-6.2 7.5-6.2s6.7 2.2 7.5 6.2" stroke="#fff" stroke-opacity=".92" stroke-width="1.8" stroke-linecap="round"/></svg>',
    organization: '<svg viewBox="0 0 24 24" fill="none"><path d="M5 21V6l7-3 7 3v15" stroke="#fff" stroke-opacity=".92" stroke-width="1.7" stroke-linejoin="round"/><path d="M9 21v-6h6v6M9 10h.01M12 10h.01M15 10h.01M9 13.5h.01M15 13.5h.01" stroke="#fff" stroke-opacity=".92" stroke-width="1.7" stroke-linecap="round"/></svg>',
    country: '<svg viewBox="0 0 24 24" fill="none"><path d="M6 3v18" stroke="#fff" stroke-opacity=".92" stroke-width="1.8" stroke-linecap="round"/><path d="M6 4h11l-2.5 3L17 10H6" fill="#fff" fill-opacity=".92"/></svg>',
    concept: '<svg viewBox="0 0 24 24" fill="none"><path d="M9 18h6M10 21h4" stroke="#fff" stroke-opacity=".92" stroke-width="1.7" stroke-linecap="round"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.4.3.6.8.6 1.3V16h6v-.9c0-.5.2-1 .6-1.3A6 6 0 0 0 12 3Z" fill="none" stroke="#fff" stroke-opacity=".92" stroke-width="1.7"/></svg>',
    /* Schlichter Kreis statt Flamme (Nutzer-Feedback 24.08.2026, Bauhaus-
       Richtung): ein einfaches geometrisches Motiv statt eines
       gegenstaendlichen Icons passt besser zur flachen, kraeftigen Palette. */
    event: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="7.5" fill="#fff" fill-opacity=".9"/></svg>'
  };
  function typeIcon(type) { return ICON[type] || ICON.concept; }

  var TYPE_LABEL = {
    de: { person: "Person", organization: "Organisation", country: "Land", concept: "Konzept", event: "Ereignis" },
    en: { person: "Person", organization: "Organization", country: "Country", concept: "Concept", event: "Event" }
  };
  function typeLabel(type) { return (TYPE_LABEL[state.lang] && TYPE_LABEL[state.lang][type]) || type; }

  function fmtTlDate(raw) {
    if (!raw) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      var d = new Date(raw + "T00:00:00");
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString(state.lang === "de" ? "de-DE" : "en-US", { day: "2-digit", month: "short", year: "numeric" });
      }
    }
    return raw; // reines Jahr o.ae. unveraendert
  }

  var BOOKMARK_OUT = '<svg viewBox="0 0 24 24" fill="none"><path d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4-7 4V4.5a1 1 0 0 1 1-1Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
  var BOOKMARK_IN = '<svg viewBox="0 0 24 24" fill="none"><path d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4-7 4V4.5a1 1 0 0 1 1-1Z" fill="currentColor"/></svg>';
  var EXTERNAL = '<svg viewBox="0 0 24 24" fill="none"><path d="M9 6h9v9M18 6 6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var CLOSE_ICON = '<svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>';
  var BACK_ICON = '<svg viewBox="0 0 24 24" fill="none"><path d="M15 5 8 12l7 7" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  /* ---------------- avatars (random, no upload) ---------------- */
  function seededRand(seed) {
    var x = Math.sin(seed * 999) * 10000;
    return x - Math.floor(x);
  }
  function avatarSVG(seed, size) {
    size = size || 40;
    var hues = [ (seed * 360) % 360, (seed * 360 + 55) % 360 ];
    var c1 = "hsl(" + hues[0].toFixed(0) + " 78% 62%)";
    var c2 = "hsl(" + hues[1].toFixed(0) + " 78% 45%)";
    var rot = Math.floor(seededRand(seed + 1) * 360);
    var blobs = "";
    for (var i = 0; i < 3; i++) {
      var r = 8 + seededRand(seed + i + 2) * 10;
      var cx = 15 + seededRand(seed + i + 5) * 70;
      var cy = 15 + seededRand(seed + i + 9) * 70;
      blobs += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="#fff" fill-opacity="' + (0.10 + i*0.05) + '"/>';
    }
    return '<svg viewBox="0 0 100 100" width="'+size+'" height="'+size+'" xmlns="http://www.w3.org/2000/svg">' +
      '<defs><linearGradient id="g' + Math.round(seed*1e6) + '" x1="0" y1="0" x2="1" y2="1" gradientTransform="rotate(' + rot + ' .5 .5)">' +
      '<stop offset="0" stop-color="' + c1 + '"/><stop offset="1" stop-color="' + c2 + '"/></linearGradient></defs>' +
      '<rect width="100" height="100" fill="url(#g' + Math.round(seed*1e6) + ')"/>' + blobs + '</svg>';
  }

  /* ---------------- media (image + graceful fallback) ---------------- */
  function fallbackGradientVars(catKey) {
    var c = "var(--cat-" + (catKey || "diplomacy") + ")";
    return 'style="--cat-c1:' + c + '; --cat-c2: color-mix(in srgb, ' + c + ' 55%, #000 30%);"';
  }
  function mediaTag(url, opts) {
    opts = opts || {};
    var iconType = opts.iconType || "concept";
    var catKey = opts.catKey || "diplomacy";
    var cls = opts.cls || "";
    var alt = escapeHtml(opts.alt || "");
    var img = url ? '<img src="' + escapeHtml(url) + '" alt="' + alt + '" onerror="this.style.display=\'none\'">' : "";
    return '<div class="media ' + cls + '" ' + fallbackGradientVars(catKey) + '>' +
      '<span class="fallback">' + typeIcon(iconType) + '</span>' + img + '</div>';
  }

  /* ---------------- greeting ---------------- */
  var GREETINGS = {
    de: {
      night:   ["Nachteule? Wir auch.", "Um diese Zeit liest man Krimis oder Weltpolitik. Willkommen bei Letzterem.", "Die Welt schläft nie — du offenbar auch nicht.", "Ruhige Stunden, unruhige Weltlage.", "Mitternacht ist vorbei, die Krisenherde nicht.", "Kein Schlaf? Dann wenigstens gut informiert.", "Die Nacht ist still, die Nachrichtenlage nicht.", "Um diese Uhrzeit ist jeder Gedanke tiefer — auch die Politik.", "Irgendwo zwischen Traum und Tagesordnung.", "Wer jetzt noch wach ist, hat sich den Überblick verdient."],
      early:   ["Schon wach? Hier ist, was die Nacht über passiert ist.", "Kaffee eingeschenkt? Gut, dann legen wir los.", "Der Tag ist noch jung, die Nachrichtenlage nicht.", "Früher Vogel, frühe Einordnung.", "Die Sonne ist kaum auf, die Weltpolitik längst wach.", "Ruhig hier, unruhig da draußen — ein kurzer Überblick.", "Bevor der Tag dich einholt: die wichtigsten Linien in Kürze.", "Erste Tasse Kaffee, erste Einordnung des Tages."],
      morning: ["Guten Morgen — hier ist dein Überblick.", "Ausgeschlafen? Die Politik war es nicht.", "Ein neuer Tag, die alten Konflikte.", "Auf geht's, die Welt hat sich weitergedreht.", "Der Vormittag gehört dir — nimm dir fünf Minuten für den Kontext.", "Guten Morgen. Was gestern begann, ist heute noch nicht vorbei.", "Kurzer Espresso, kurzer Überblick — dann geht's weiter.", "Die Nachrichtenlage hat schon Frühschicht."],
      noon:    ["Mittagspause? Perfekt für etwas Weltgeschehen.", "Die Hälfte des Tages ist geschafft — hier der Zwischenstand.", "Zeit für eine Prise Politik zum Mittagessen.", "Kurze Pause, langer Blick auf das, was gerade zählt.", "Der Vormittag ist vorbei — die Weltlage hat trotzdem nicht pausiert.", "Zwölf Uhr, Zeit für den Zwischenstand."],
      after:   ["Der Nachmittag ist da, die Schlagzeilen auch.", "Zwischen Terminen: ein Blick auf das große Ganze.", "Tief durchatmen und eintauchen.", "Das Nachmittagstief lässt sich am besten mit etwas Kontext überbrücken.", "Noch ein paar Stunden bis Feierabend — und noch ein paar offene Fragen zur Weltlage.", "Kurz durchatmen, dann tiefer einsteigen."],
      evening: ["Feierabend. Zeit zu verstehen, was heute wirklich passiert ist.", "Der Tag neigt sich, die Analyse beginnt.", "Jetzt wird's ruhiger — genug Zeit für die tieferen Zusammenhänge.", "Der Bildschirm der Arbeit ist zu, der der Weltpolitik geht jetzt auf.", "Abendlicht, Klartext: was heute wirklich zählt.", "Der Tag ist fast rum — die wichtigsten Linien noch nicht."],
      late:    ["Der Abend gehört dir — und ein bisschen der Weltpolitik.", "Bevor der Tag endet: ein Blick hinter die Kulissen.", "Noch wach? Die Diplomatie ist es auch.", "Die letzten Stunden des Tages, für die wichtigsten Fragen.", "Kein Fernsehprogramm heute — dafür die Weltlage in Ruhe.", "Der Abend ist ruhig, die Lage bleibt komplex."]
    },
    en: {
      night:   ["Night owl? Same here.", "At this hour it's either crime novels or world politics. Welcome to the latter.", "The world never sleeps — clearly, neither do you.", "Quiet hours, restless world.", "Midnight's long gone. The crises haven't noticed.", "Can't sleep? At least stay informed.", "The night is still. The news cycle isn't.", "Everything feels deeper at this hour — even politics.", "Somewhere between a dream and the day's agenda.", "Still up? You've earned the overview."],
      early:   ["Already up? Here's what happened overnight.", "Coffee poured? Good, let's get into it.", "The day is young, the news cycle isn't.", "Early bird, early context.", "The sun's barely up. World politics has been awake for hours.", "Quiet in here, loud out there — a quick overview.", "Before the day catches up with you: the main threads, briefly.", "First coffee, first read on the day."],
      morning: ["Good morning — here's your overview.", "Well rested? Politics wasn't.", "A new day, the same old conflicts.", "Off we go, the world kept turning overnight.", "The morning is yours — five minutes for context first.", "Good morning. What started yesterday isn't over yet.", "Quick espresso, quick overview, then onward.", "The news cycle is already on its morning shift."],
      noon:    ["Lunch break? Perfect timing for some world affairs.", "Halfway through the day — here's where things stand.", "A pinch of politics with lunch.", "Short break, long look at what actually matters right now.", "Morning's over. The world didn't pause either.", "Noon check-in: here's the state of things."],
      after:   ["The afternoon is here, so are the headlines.", "Between meetings: a look at the bigger picture.", "Take a breath, then dive in.", "The afternoon slump is best cured with a bit of context.", "A few hours left before the day's done — and a few open questions about the world.", "Quick breath, deeper dive."],
      evening: ["Day's done. Time to understand what actually happened today.", "The day winds down, the analysis begins.", "Things are quieter now — plenty of time for the deeper connections.", "Work's closed for the day. World politics just opened.", "Evening light, straight talk: what actually mattered today.", "The day's almost over. The main threads aren't."],
      late:    ["The evening is yours — and a little bit of world politics too.", "Before the day ends: a look behind the scenes.", "Still up? So is diplomacy.", "The last hours of the day, for the questions that matter most.", "No TV tonight — just the state of the world, at your own pace.", "The evening is quiet. The situation stays complicated."]
    }
  };
  function greetingBucket(hour) {
    if (hour >= 23 || hour < 5) return "night";
    if (hour < 8) return "early";
    if (hour < 11) return "morning";
    if (hour < 14) return "noon";
    if (hour < 17) return "after";
    if (hour < 20) return "evening";
    return "late";
  }
  function pickGreeting() {
    var now = new Date();
    var bucket = greetingBucket(now.getHours());
    var pool = GREETINGS[state.lang][bucket];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  /* ---------------- rendering: home ---------------- */

  /* Tippt `text` Zeichen für Zeichen in `el`, mit blinkendem Cursor, ruft
     `onDone` nach dem letzten Zeichen auf. Geschwindigkeit skaliert leicht
     mit der Textlänge, damit auch lange Sprüche nicht ewig brauchen. */
  function typewriteText(el, text, onDone) {
    el.textContent = "";
    var cursor = document.createElement("span");
    cursor.className = "type-cursor";
    el.appendChild(cursor);
    var speed = Math.max(14, Math.min(32, 1100 / Math.max(1, text.length)));
    var i = 0;
    function step() {
      if (i < text.length) {
        cursor.insertAdjacentText("beforebegin", text.charAt(i));
        i++;
        setTimeout(step, speed);
      } else {
        cursor.remove();
        if (onDone) onDone();
      }
    }
    step();
  }

  /* Rubriken-Filterzeile auf der Startseite (Nutzer-Feedback 27.08.2026:
     "wenn man auf die Rubriken klickt, sollen die Nachrichten dieser
     Rubrik nicht ausgeblendet werden, sondern hervorgehoben werden! wenn
     ich auf Sicherheit klicke, sollen nur noch Sicherheitsnachrichten
     angezeigt werden"). Vorher: ein Klick auf eine noch aktive Rubrik
     ENTFERNTE genau diese aus der Auswahl -- ein Klick auf "Sicherheit"
     blendete Sicherheit also aus, das Gegenteil von "nur noch
     Sicherheitsnachrichten". Jetzt: exklusive Auswahl -- ein Klick auf
     eine Rubrik zeigt NUR NOCH diese (der Chip selbst wird hervorgehoben,
     nicht ausgeblendet), ein zweiter Klick auf denselben Chip oder auf
     "Alle Themen" setzt wieder auf alle zurueck. Das separate
     Mehrfachauswahl-Menü im Profil (data-catcheck, Inhaltspräferenzen)
     bleibt unveraendert fuer alle, die mehrere Rubriken kombinieren wollen. */
  function renderPrefRow() {
    var el = document.getElementById("prefRow");
    var allKeys = Object.keys(CATEGORIES);
    var allActive = state.activeCats.size === allKeys.length;
    var html = '<button class="pref-chip all' + (allActive ? " active" : "") + '" data-cat="__all__" style="' +
      (allActive ? "background:var(--accent);color:#141210" : "") + '">' + escapeHtml(t("allTopics")) + "</button>";
    allKeys.forEach(function (key) {
      var active = !allActive && state.activeCats.has(key);
      // 55/45-Abdunklung wie bei .cat-chip: die Kategorie-Töne sind
      // kräftiger als der Rest der Palette, ohne das wäre weißer Text auf
      // aktiven Chips kaum lesbar.
      html += '<button class="pref-chip' + (active ? " active" : "") + '" data-cat="' + key + '" style="' +
        (active ? "background:color-mix(in srgb, var(--cat-" + key + ") 55%, #000 45%)" : "") + '">' +
        catIcon(key) + escapeHtml(catLabel(key)) + "</button>";
    });
    el.innerHTML = html;
    el.querySelectorAll(".pref-chip").forEach(function (btn) {
      btn.onclick = function () {
        var key = btn.getAttribute("data-cat");
        if (key === "__all__") {
          state.activeCats = new Set(allKeys);
        } else if (state.activeCats.size === 1 && state.activeCats.has(key)) {
          // Erneuter Klick auf die schon exklusiv aktive Rubrik: zurueck zu "alle".
          state.activeCats = new Set(allKeys);
        } else {
          state.activeCats = new Set([key]);
        }
        renderHome();
      };
    });
  }

  /* `onDone` läuft NACH der Tipp-Animation (nur beim allerersten Aufruf --
     bei jedem weiteren Aufruf ist der Text schon getippt, `onDone` feuert
     dann sofort synchron). So kann `renderHome()` Filterzeile/Grid erst
     NACH dem Tippen einblenden lassen, ohne bei jedem Kategorie-Klick neu
     zu tippen oder zu warten. */
  function storyCounts() {
    return STORIES.filter(function (s) { return state.activeCats.has(s.theme_category); }).length;
  }

  function renderGreeting(onDone) {
    document.getElementById("greetEyebrow").textContent = new Date().toLocaleDateString(
      state.lang === "de" ? "de-DE" : "en-US", { weekday: "long", day: "numeric", month: "long" }
    );
    var n = storyCounts();
    document.getElementById("greetSub").textContent = state.lang === "de"
      ? n + " Storys aufbereitet, mit Historie, Akteuren und ehrlicher Markteinordnung."
      : n + " stories broken down, with history, stakeholders and honest market context.";
    if (!state.greetingText) state.greetingText = pickGreeting();
    var el = document.getElementById("greetTitle");
    if (!state.greetingTyped) {
      state.greetingTyped = true;
      typewriteText(el, state.greetingText, onDone);
    } else {
      el.textContent = state.greetingText;
      if (onDone) onDone();
    }
  }

  function cardHtml(story, idx, animate) {
    var img = mediaTag(story.image_url, { iconType: "event", catKey: story.theme_category, cls: "card-media", alt: story.title });
    var isSaved = state.saved.has(story.id);
    var nSources = (story.article_urls || story.sources || []).length;
    var cls = "card" + (animate ? " fade-in" : "");
    var style = "--cat-color: var(--cat-" + story.theme_category + ")" +
      (animate ? "; animation-delay:" + Math.min((idx || 0) * 45, 420) + "ms" : "");
    return '<div class="' + cls + '" data-id="' + story.id + '" style="' + style + '">' +
      '<div style="position:relative">' + img +
        '<span class="cat-chip">' + catIcon(story.theme_category) + escapeHtml(catLabel(story.theme_category)) + '</span>' +
        '<button class="save-btn' + (isSaved ? " saved" : "") + '" data-save="' + story.id + '">' + (isSaved ? BOOKMARK_IN : BOOKMARK_OUT) + '</button>' +
      '</div>' +
      '<div class="card-body">' +
        '<h3 class="card-title">' + escapeHtml(story.title) + '</h3>' +
        '<p class="card-dek">' + escapeHtml(stripLinks(story.one_line)) + '</p>' +
        '<div class="card-meta"><span>' + t("sources")(nSources) + '</span></div>' +
      '</div></div>';
  }
  function stripLinks(text) { return (text || "").replace(/\[\[([^\]]+)\]\]/g, "$1"); }

  function renderStoryGridBody(animate) {
    var grid = document.getElementById("storyGrid");
    var visible = STORIES.filter(function (s) { return state.activeCats.has(s.theme_category); });
    if (!visible.length) {
      grid.innerHTML = '<div class="empty-state">' + t("noStories") + "</div>";
    } else {
      grid.innerHTML = visible.map(function (s, i) { return cardHtml(s, i, animate); }).join("");
    }
    grid.querySelectorAll(".card").forEach(function (card) {
      card.addEventListener("click", function (e) {
        if (e.target.closest("[data-save]")) return;
        openDetail(card.getAttribute("data-id"));
      });
    });
    grid.querySelectorAll("[data-save]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        toggleSave(btn.getAttribute("data-save"));
      });
    });
  }

  function renderHome() {
    document.getElementById("brandLabel").textContent = t("brand");
    renderGreeting(function () {
      // Filterzeile + Grid bauen sich erst NACH dem Tipp-Effekt gestaffelt
      // auf (nur beim ersten Laden, s. `state.introGridPlayed`) -- danach
      // (z.B. bei Kategorie-Filter-Klicks) rendert alles sofort, ohne
      // erneute Animation.
      renderPrefRow();
      renderStoryGridBody(!state.introGridPlayed);
      state.introGridPlayed = true;
    });
  }

  function toggleSave(id) {
    if (state.saved.has(id)) state.saved.delete(id); else state.saved.add(id);
    if (state.view === "home") renderHome();
    if (state.view === "saved") renderSavedView();
    var overlayBtn = document.querySelector("#detailOverlay [data-save-detail]");
    if (overlayBtn) {
      var saved = state.saved.has(id);
      overlayBtn.classList.toggle("saved", saved);
      overlayBtn.innerHTML = (saved ? BOOKMARK_IN : BOOKMARK_OUT);
    }
  }

  /* ---------------- detail view ---------------- */
  function getStory(id) { return STORIES.find(function (s) { return s.id === id; }); }

  function openDetail(id) {
    var story = getStory(id);
    if (!story) return;
    if (state.history.indexOf(id) === -1) state.history.unshift(id); else { state.history.splice(state.history.indexOf(id),1); state.history.unshift(id); }
    state.currentStoryId = id;
    state.activeTab = 0;
    document.getElementById("detailOverlay").innerHTML = detailHtml(story);
    document.getElementById("detailOverlay").classList.add("open");
    document.body.style.overflow = "hidden";
    wireDetail(story);
    document.getElementById("detailOverlay").scrollTop = 0;
  }
  function closeDetail() {
    document.getElementById("detailOverlay").classList.remove("open");
    document.body.style.overflow = "";
  }

  var DEFAULT_TAB = 1; /* Übersicht ist der Startpunkt: links Historien, rechts Stakeholders/Märkte */

  function detailHtml(story) {
    var cat = story.theme_category;
    var hero = mediaTag(story.image_url, { iconType: "event", catKey: cat, cls: "detail-hero", alt: story.title });
    var isSaved = state.saved.has(story.id);
    return '<div style="--cat-color: var(--cat-' + cat + ')">' +
      '<div class="overlay-topbar">' +
        '<button class="pill-btn" id="btnBack">' + BACK_ICON + t("back") + '</button>' +
        '<button class="icon-btn' + (isSaved ? " saved" : "") + '" data-save-detail>' + (isSaved ? BOOKMARK_IN : BOOKMARK_OUT) + '</button>' +
      '</div>' +
      '<div style="position:relative">' + hero + '</div>' +
      '<div class="detail-content">' +
        '<div class="detail-eyebrow"><span class="detail-cat-chip">' + catIcon(cat) + escapeHtml(catLabel(cat)) + '</span>' +
          '<span>' + t("sources")((story.article_urls||story.sources||[]).length) + '</span></div>' +
        '<h1 class="detail-title">' + escapeHtml(story.title) + '</h1>' +
        '<p class="detail-dek">' + linkify(story.one_line, story) + '</p>' +
        tabbarHtml() +
        '<div class="tab-viewport"><div class="tab-track" id="tabTrack">' +
          '<div class="tab-pane">' + threadsHtml(story) + '</div>' +
          '<div class="tab-pane">' + overviewHtml(story) + '</div>' +
          '<div class="tab-pane">' + stakeholdersHtml(story) + '</div>' +
          '<div class="tab-pane">' + marketHtml(story) + '</div>' +
          '<div class="tab-pane">' + theoryPaneHtml(story) + '</div>' +
        '</div></div>' +
        quotesAndSourcesHtml(story) +
      '</div>' +
    '</div>';
  }

  function tabbarHtml() {
    var tabs = [t("historien"), t("uebersicht"), t("stakeholdersTab"), t("maerkte"), t("theorieTab")];
    return '<div class="tabbar" id="detailTabbar">' + tabs.map(function (label, i) {
      return '<button class="tab-btn' + (i===DEFAULT_TAB?" active":"") + '" data-tab="' + i + '">' + escapeHtml(label) + "</button>";
    }).join("") + "</div>";
  }

  function overviewHtml(story) {
    return '<ul class="summary-list">' + (story.summary||[]).map(function(b){ return "<li><span class=\"li-text\">" + linkify(b, story) + "</span></li>"; }).join("") + '</ul>' +
      (story.deep_dive ? (
        '<div class="readmore-toggle"><button class="pill-btn" id="btnReadMore">' + t("readMore") + '</button></div>' +
        '<div class="readmore-box" id="readMoreBox"><div><div class="deep-dive">' + linkify(story.deep_dive, story) + '</div></div></div>'
      ) : '');
  }

  function threadsHtml(story) {
    var threads = story.historical_threads || [];
    if (!threads.length) return '<div class="market-empty">—</div>';
    var activeIdx = state.activeThread[story.id] || 0;
    var tabs = threads.map(function (th, i) {
      return '<button class="thread-tab' + (i===activeIdx?" active":"") + '" data-thread="' + i + '">' + escapeHtml(th.label || th.title || ("Linie " + (i+1))) + "</button>";
    }).join("");
    var entries = threads[activeIdx].entries || [];
    var timeline = '<div class="timeline">' + entries.map(function (en, i) {
      return '<div class="tl-item" data-tl="' + i + '"><span class="tl-dot"></span>' +
        (en.date || en.year ? '<div class="tl-year">' + escapeHtml(fmtTlDate(en.date || en.year)) + '</div>' : '') +
        '<div class="tl-one">' + escapeHtml(en.one_line || "") + (en.extended ? '<span class="tl-toggle-hint">+</span>' : '') + '</div>' +
        (en.extended ? '<div class="tl-ext">' + escapeHtml(en.extended) + '</div>' : '') +
      '</div>';
    }).join("") + '</div>';
    return (threads.length > 1 ? '<div class="thread-tabs">' + tabs + '</div>' : '') + timeline;
  }

  var CHECK_ICON = '<svg viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var MINUS_ICON = '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M8 12h8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';

  /* Pro/Con-Karte je Akteur. `item.counter` (Nutzer-Feedback 27.08.2026:
     "diskutiere jeweils die Sinnhaftigkeit der Massnahmen eines
     Politikers, bringe immer Perspektive und Gegenperspektive ein") ist
     die Gegenperspektive zu `item.reason` -- neu vom Pipeline-Schema
     geliefert (s. synthesize_story.py), bei aelteren, vor diesem Update
     erzeugten Storys noch nicht vorhanden. Daher optional rendern statt
     die Karte kaputt zu machen, ganz im Stil des Projekts: leer lassen
     statt etwas zu erfinden. */
  function stakeCardHtml(item, side, story) {
    var ent = findEntity(story, item.entity);
    var img = mediaTag(ent && ent.image_url, { iconType: ent ? ent.type : "concept", catKey: story.theme_category, cls: "stake-avatar", alt: item.entity });
    return '<button class="stake-card ' + side + '" data-entity-open="' + escapeHtml(item.entity) + '">' + img +
      '<div class="stake-body"><div class="stake-name">' + escapeHtml(item.entity) + '</div>' +
      '<div class="stake-reason">' + escapeHtml(item.reason || "") + '</div>' +
      (item.counter ? '<div class="stake-counter"><span class="stake-counter-label">' + t("counterLabel") + '</span><span>' + escapeHtml(item.counter) + '</span></div>' : '') +
      '</div></button>';
  }

  function stakeholdersHtml(story) {
    var sh = story.stakeholders;
    if (!sh || (!(sh.pro||[]).length && !(sh.con||[]).length)) return '<div class="market-empty">—</div>';
    var pro = sh.pro || [], con = sh.con || [];
    var html = '<div class="stake-columns">' +
      '<div class="stake-section"><div class="stake-heading pro">' + CHECK_ICON + t("profitsFrom") + '</div>' +
      '<div class="stake-list">' + (pro.length ? pro.map(function (it) { return stakeCardHtml(it, "pro", story); }).join("") : '<div class="stake-empty">' + t("noProfiteers") + '</div>') + '</div></div>' +
      '<div class="stake-section"><div class="stake-heading con">' + MINUS_ICON + t("losesFrom") + '</div>' +
      '<div class="stake-list">' + (con.length ? con.map(function (it) { return stakeCardHtml(it, "con", story); }).join("") : '<div class="stake-empty">' + t("noLosers") + '</div>') + '</div></div>' +
      '</div>' +
      (sh.note ? '<div class="stake-note">' + escapeHtml(sh.note) + '</div>' : '');
    return html;
  }

  function entitiesHtml(story) {
    var ents = story.entities || [];
    if (!ents.length) return '<div class="market-empty">—</div>';
    return '<div class="entity-grid">' + ents.map(function (e) {
      var img = mediaTag(e.image_url, { iconType: e.type, catKey: story.theme_category, cls: "entity-avatar", alt: e.name });
      return '<div class="entity-chip" data-entity-open="' + escapeHtml(e.name) + '">' + img +
        '<div class="entity-name">' + escapeHtml(e.name) + '</div>' +
        '<div class="entity-role">' + escapeHtml(e.role_in_story || "") + '</div></div>';
    }).join("") + '</div>';
  }

  function marketHtml(story) {
    var mc = story.market_correlation;
    // Kein Feld oder das Modell hat ehrlich KEINEN Zusammenhang gefunden
    // (has_correlation=false) -- das ist ein vollwertiges Ergebnis, kein
    // Fehlerzustand, s. noMarket-Text.
    if (!mc || !mc.has_correlation) {
      return '<div class="market-empty">' + t("noMarket") + (mc && mc.explanation ? '<div style="margin-top:10px;font-size:13.5px;">' + escapeHtml(mc.explanation) + '</div>' : '') + '</div>';
    }
    // has_correlation=true, aber KEINE Kurve/Datenpunkte (Lite-Modus --
    // qualitative Einschaetzung aus Allgemeinwissen statt Live-Recherche,
    // s. synthesize_story.py::STORY_JSON_SCHEMA_HINT_MARKET_LITE). Vorher
    // landete das faelschlich im "keine Korrelation gefunden"-Zweig oben,
    // obwohl das Modell durchaus einen Zusammenhang sieht (Nutzer-Feedback
    // 24.08.2026: "keine korrelation bei einem riesigen handelsstreit mit
    // 50% Zoellen? I doubt it."). Eigener Zweig: Text prominent, klar als
    // Einschaetzung statt Live-Daten gekennzeichnet, kein Chart (den gibt's
    // erst mit echten Kurszahlen aus research_depth="full").
    if (!mc.series || !mc.series.length) {
      return '<div class="chart-card">' +
        (mc.explanation ? '<div class="chart-sub">' + escapeHtml(mc.explanation) + '</div>' : '') +
        '<div class="market-note-badge">' + t("marketQualitative") + '</div>' +
        (mc.note ? '<div class="chart-note">' + escapeHtml(mc.note) + '</div>' : '') +
      '</div>';
    }
    // Event Study: tatsaechlich vs. erwartet ohne Ereignis (s. drawMarketChart)
    if (mcView.sid !== story.id) mcView = { sid: story.id, variant: 0, win: null };
    var es = mcStudy(story);
    if (es && es.assets && es.assets.length) {
      var assetTabs = es.assets.length > 1 ? '<div class="mc-assets">' + es.assets.map(function (a, i) {
        return '<button class="mc-asset-btn' + (i === 0 ? ' active' : '') + '" data-mc-asset="' + i + '">' + escapeHtml(marketLabel(a.ticker)) + '</button>';
      }).join("") + '</div>' : '';
      var theory = [];
      (mc.unmeasured || []).forEach(function (x) { theory.push(escapeHtml(x)); });
      (es.skipped || []).forEach(function (tk) { theory.push(mcL("<b>" + escapeHtml(marketLabel(tk)) + "</b>: Dafür waren keine ausreichenden Kursdaten verfügbar, die Wirkung bleibt hier Theorie.", "<b>" + escapeHtml(marketLabel(tk)) + "</b>: no sufficient price data available, so this effect remains theory here.")); });
      var theoryHtml = theory.length ? '<div class="mc-theory"><div class="mc-label">' + mcL("Weitere Überlegungen – nicht mit Kursen belegt", "Further considerations – not backed by prices") + '</div><ul>' + theory.map(function (x) { return '<li>' + x + '</li>'; }).join("") + '</ul></div>' : '';
      var evTitle = mc.event_description || (story.title ? String(story.title) : "");
      var evDate = es.event_date ? mcDate(es.event_date, true) : "";
      var varHtml = '';
      if (mc.event_study_alt) {
        varHtml = '<div class="mc-label" style="margin-top:12px">' + mcL("Bezugstag wählen", "Pick reference day") + '</div><div class="mc-assets">' +
          [0, 1].map(function (v) { return '<button class="mc-asset-btn' + (mcView.variant === v ? ' active' : '') + '" data-mc-var="' + v + '">' + escapeHtml(mcVariantLabel(story, v)) + '</button>'; }).join("") + '</div>';
      }
      var maxPost = Math.max.apply(null, es.assets.map(function (x) { return x.n_post; }));
      var winOpts = [3, 5].filter(function (w) { return w < maxPost; });
      var winHtml = winOpts.length ? '<div class="mc-label" style="margin-top:10px">' + mcL("Zeitraum (Zoom)", "Time range (zoom)") + '</div><div class="mc-assets">' +
        winOpts.concat([0]).map(function (w) { var on = (w === 0 ? mcView.win === null : mcView.win === w); return '<button class="mc-asset-btn' + (on ? ' active' : '') + '" data-mc-win="' + w + '">' + (w === 0 ? mcL("alles (" + maxPost + " Tage)", "all (" + maxPost + " days)") : mcL("erste " + w + " Tage", "first " + w + " days")) + '</button>'; }).join("") + '</div>' : '';
      var headHtml = '<div class="mc-label">' + mcL("Ereignis und Märkte", "Event and markets") + '</div>' +
        '<div class="mc-head">' + mcL("Untersucht wird, wie sich Märkte seit diesem Ereignis entwickelt haben:", "This section examines how markets have moved since this event:") +
        '<div class="mc-head-ev">' + escapeHtml(evTitle) + (evDate ? ' <span>(' + escapeHtml(evDate) + ')</span>' : '') + '</div></div>';
      return '<div class="chart-card" id="mcCard">' +
        headHtml +
        varHtml +
        '<div class="mc-label" style="margin-top:14px">' + mcL("Was die Kurse seit dem Ereignis zeigen", "What prices show since the event") + '</div>' +
        observationHtml(es) +
        '<div class="mc-label" style="margin-top:16px">' + mcL("Verlauf im Detail – Wert wählen", "Detail – pick an asset") + '</div>' +
        assetTabs +
        winHtml +
        '<div class="mc-small" id="mcAbout" style="margin:8px 0"></div>' +
        marketLegendEventStudy() +
        '<div style="position:relative"><svg id="mcChart" viewBox="0 0 480 290" width="100%" style="overflow:visible;display:block;touch-action:pan-y"></svg>' +
        '<div class="tooltip" id="mcTooltip"></div></div>' +
        '<div id="mcSummary"></div>' +
        '<div class="mc-small" id="mcMethod"></div>' +
        (mc.explanation ? '<div class="mc-label" style="margin-top:18px">' + mcL("Einordnung und mögliche Erklärungen (Theorie)", "Interpretation and possible explanations (theory)") + '</div><div class="chart-sub"><p style="margin:0 0 8px">' + interpretationLead(es) + '</p>' + escapeHtml(mc.explanation) + '</div>' : '') +
        theoryHtml +
        (mc.note ? '<div class="chart-note">' + escapeHtml(mc.note) + '</div>' : '') +
      '</div>';
    }
    var legend = mc.series.length > 1 ? '<div class="legend-row">' + mc.series.map(function (s, i) {
      var col = SERIES_COLORS[i % 3] === "accent" ? "var(--cat-color)" : SERIES_COLORS[i % 3];
      return '<div class="legend-item"><span class="legend-swatch" style="background:' + col + '"></span>' + escapeHtml(marketLabel(s.label)) + '</div>';
    }).join("") + '</div>' : '';
    return '<div class="chart-card">' +
      (mc.explanation ? '<div class="chart-sub">' + escapeHtml(mc.explanation) + '</div>' : '') +
      legend +
      '<div style="position:relative"><svg id="mcChart" viewBox="0 0 480 270" width="100%" style="overflow:visible;display:block"></svg>' +
      '<div class="tooltip" id="mcTooltip"></div></div>' +
      (mc.note ? '<div class="chart-note">' + escapeHtml(mc.note) + '</div>' : '') +
    '</div>';
  }

  var BIAS_CLASS = { left: "bias-left", "center-left": "bias-center-left", center: "bias-center", "center-right": "bias-center-right", right: "bias-right" };

  var DOMAIN_LABELS = {
    "npr.org": "NPR", "aljazeera.com": "Al Jazeera", "cbsnews.com": "CBS News",
    "reuters.com": "Reuters", "apnews.com": "AP News", "bbc.co.uk": "BBC", "bbci.co.uk": "BBC",
    "nbcnews.com": "NBC News", "foxnews.com": "Fox News", "cnn.com": "CNN",
    "washingtonpost.com": "Washington Post", "nytimes.com": "NYT", "wsj.com": "WSJ",
    "theguardian.com": "The Guardian", "politico.com": "Politico", "axios.com": "Axios",
    "thehill.com": "The Hill", "dw.com": "DW", "france24.com": "France24",
    "themoscowtimes.com": "Moscow Times", "irishtimes.com": "Irish Times",
    "timesofisrael.com": "Times of Israel", "csis.org": "CSIS",
    "defensenews.com": "Defense News", "aei.org": "AEI", "usnews.com": "US News",
    "fortune.com": "Fortune", "pbs.org": "PBS", "senate.gov": "US-Senat",
    "congress.gov": "Congress.gov", "state.gov": "US State Dept.",
    "whitehouse.gov": "White House", "hrw.org": "Human Rights Watch"
  };
  function hostLabel(url) {
    try {
      var h = new URL(url).hostname.replace(/^www\./, "");
      for (var domain in DOMAIN_LABELS) { if (h === domain || h.indexOf("." + domain) === h.length - domain.length - 1) return DOMAIN_LABELS[domain]; }
      var base = h.split(".").slice(0, -1).join(".") || h;
      base = base.split(".")[0];
      return base.charAt(0).toUpperCase() + base.slice(1);
    } catch (e) { return "Quelle"; }
  }
  function biasForLabel(label) {
    var keys = Object.keys(SOURCE_BIAS);
    for (var i = 0; i < keys.length; i++) {
      if (keys[i].toLowerCase().indexOf(label.toLowerCase()) === 0) return SOURCE_BIAS[keys[i]];
    }
    return null;
  }

  function quotesAndSourcesHtml(story) {
    var quotes = story.quotes || [];
    var urls = story.article_urls || [];
    var primary = story.primary_sources || [];
    var html = "";
    if (quotes.length) {
      html += '<h2 class="section-heading">' + t("quotes") + '</h2>';
      quotes.forEach(function (q) {
        html += '<div class="quote-card"><p class="quote-text">“' + escapeHtml(q.text) + '”</p><div class="quote-attr">' + escapeHtml(q.attribution || "") + (q.context ? " · " + escapeHtml(q.context) : "") + '</div></div>';
      });
    }
    if (urls.length) {
      html += '<h2 class="section-heading">' + t("sourcesHead") + '</h2><div class="source-row">';
      urls.forEach(function (url) {
        var label = hostLabel(url);
        var bias = biasForLabel(label);
        var biasCls = BIAS_CLASS[bias] || "bias-unknown";
        html += '<button class="source-btn" data-open="' + escapeHtml(url || "") + '"><span class="bias-dot ' + biasCls + '"></span>' + escapeHtml(label) + EXTERNAL + '</button>';
      });
      html += '</div>';
    }
    if (primary.length) {
      html += '<h2 class="section-heading">' + t("primarySources") + '</h2>';
      primary.forEach(function (p) {
        html += '<div class="primary-source-card"><div class="primary-source-title">' + escapeHtml(p.title || "") + '</div>' +
          (p.note ? '<div class="primary-source-desc">' + escapeHtml(p.note) + '</div>' : '') +
          '<button class="source-btn" data-open="' + escapeHtml(p.url || "") + '">' + escapeHtml(p.issuer || "Dokument öffnen") + EXTERNAL + '</button></div>';
      });
    }
    return html;
  }

  function theoryPaneHtml(story) {
    var theory = story.political_theory;
    if (!theory || !theory.theory) return '<div class="market-empty">' + t("noTheory") + '</div>';
    var points = theory.points || [];
    var lead = points.length ? points[0] : "";
    var rest = points.slice(1);
    return '<div class="theory-concept">' + linkify(theory.theory, story) + '</div>' +
      (lead ? '<p class="theory-lead">' + linkify(lead, story) + '</p>' : '') +
      (rest.length ? (
        '<div class="readmore-toggle"><button class="pill-btn" id="btnTheoryMore">' + t("readMore") + '</button></div>' +
        '<div class="readmore-box" id="theoryReadMoreBox"><div><ul class="theory-points">' +
          rest.map(function (p) { return "<li>" + linkify(p, story) + "</li>"; }).join("") +
        '</ul></div></div>'
      ) : '');
  }

  function wireDetail(story) {
    document.getElementById("btnBack").onclick = closeDetail;
    var saveBtn = document.querySelector("[data-save-detail]");
    if (saveBtn) saveBtn.onclick = function () { toggleSave(story.id); };

    document.querySelectorAll("#detailTabbar .tab-btn").forEach(function (btn) {
      btn.onclick = function () { setActiveTab(parseInt(btn.getAttribute("data-tab"), 10)); };
    });
    setActiveTab(DEFAULT_TAB, true);

    wireThreadTabs(story);
    wireTimelineToggle();

    var readMoreBtn = document.getElementById("btnReadMore");
    if (readMoreBtn) {
      readMoreBtn.onclick = function () {
        var box = document.getElementById("readMoreBox");
        var open = box.classList.toggle("open");
        readMoreBtn.textContent = open ? t("readLess") : t("readMore");
      };
    }
    var theoryMoreBtn = document.getElementById("btnTheoryMore");
    if (theoryMoreBtn) {
      theoryMoreBtn.onclick = function () {
        var box = document.getElementById("theoryReadMoreBox");
        var open = box.classList.toggle("open");
        theoryMoreBtn.textContent = open ? t("readLess") : t("readMore");
      };
    }

    document.querySelectorAll("[data-entity-open]").forEach(function (chip) {
      chip.onclick = function () {
        var ent = findEntity(story, chip.getAttribute("data-entity-open"));
        if (ent) openEntityModal(ent, story);
      };
    });
    document.querySelectorAll(".lk").forEach(function (span) {
      span.onclick = function () {
        var ent = findEntity(story, span.getAttribute("data-entity"));
        if (ent) openEntityModal(ent, story);
      };
    });
    document.querySelectorAll("[data-open]").forEach(function (btn) {
      btn.onclick = function () {
        var url = btn.getAttribute("data-open");
        if (url) window.open(url, "_blank", "noopener,noreferrer");
      };
    });
    drawMarketChart(story);
    wireSwipe(document.getElementById("tabTrack"));
    syncTabHeight();
    observeActivePane();
    // Bilder (Entity-Avatare in Stakeholders etc.) koennen den Pane
    // nachtraeglich hoeher machen, sobald sie geladen sind -- Hoehe dann
    // nochmal neu abgleichen.
    document.querySelectorAll("#tabTrack img").forEach(function (img) {
      if (!img.complete) img.addEventListener("load", syncTabHeight, { once: true });
    });
  }

  var TAB_COUNT = 5;
  function setActiveTab(i, silent) {
    state.activeTab = i;
    document.querySelectorAll("#detailTabbar .tab-btn").forEach(function (b, idx) {
      b.classList.toggle("active", idx === i);
    });
    var track = document.getElementById("tabTrack");
    if (track) track.style.transform = "translateX(-" + (i * (100 / TAB_COUNT)) + "%)";
    syncTabHeight();
    observeActivePane();
  }

  /* Der Tab-Carousel (.tab-viewport > .tab-track > 5x .tab-pane) legt alle
     5 Tabs nebeneinander (display:flex) und verschiebt per translateX --
     OHNE das hier wuerde .tab-viewport per Flexbox-Zeilenhoehe automatisch
     so hoch wie der HOECHSTE der 5 Panes (meist "Historien" mit langen
     Zeitleisten), auch wenn z.B. "Uebersicht" viel kuerzer ist. Das war die
     grosse Luecke zwischen Uebersicht-Inhalt und der Zitate-Sektion danach
     (Nutzer-Feedback 24.08.2026). Fix: Hoehe des Viewports explizit auf die
     Hoehe des GERADE aktiven Panes setzen, mit CSS-Transition fuers
     Umschalten (s. .tab-viewport in index.template.html). */
  function syncTabHeight() {
    var track = document.getElementById("tabTrack");
    if (!track) return;
    var active = track.children[state.activeTab];
    var viewport = track.parentElement;
    if (active && viewport) viewport.style.height = active.scrollHeight + "px";
  }

  /* syncTabHeight() allein reicht nicht: es wird nur bei Tab-WECHSEL und
     nach Bild-Load aufgerufen, aber NICHT wenn sich der Inhalt INNERHALB
     des gerade offenen Panes aendert -- genau das passiert bei "Weiterlesen"
     (readMoreBtn/theoryMoreBtn togglen eine .readmore-box), beim Wechseln
     zwischen Zeitlinien-Threads (wireThreadTabs ersetzt pane.innerHTML) und
     beim Aufklappen einzelner Zeitleisten-Eintraege (wireTimelineToggle
     togglet .tl-item.expanded). Der Viewport blieb dann auf der alten, zu
     kleinen Hoehe stehen und schnitt den neu sichtbaren Text ab -- das war
     sowohl der nicht-funktionierende "Weiterlesen"-Button als auch die
     Luecken/abgeschnittene Formatierung auf Mobile als auch die Zitate, die
     nicht direkt am ausgeklappten Inhalt klebten (Nutzer-Feedback
     27.08.2026). Fix: ein ResizeObserver auf dem GERADE AKTIVEN Pane-Element
     selbst -- der feuert automatisch bei JEDER Groessenaenderung dieses
     Elements, egal wodurch ausgeloest (Klassen-Toggle, innerHTML-Ersatz,
     Bild-Load etc.), ohne dass jede einzelne Stelle im Code einzeln
     `syncTabHeight()` aufrufen muesste. */
  var tabResizeObserver = (typeof ResizeObserver !== "undefined")
    ? new ResizeObserver(function () { syncTabHeight(); })
    : null;
  function observeActivePane() {
    if (!tabResizeObserver) return;
    tabResizeObserver.disconnect();
    var track = document.getElementById("tabTrack");
    if (!track) return;
    var active = track.children[state.activeTab];
    if (active) tabResizeObserver.observe(active);
  }

  function wireSwipe(track) {
    if (!track) return;
    var startX = null;
    track.parentElement.addEventListener("touchstart", function (e) { startX = e.touches[0].clientX; }, { passive: true });
    track.parentElement.addEventListener("touchend", function (e) {
      if (startX == null) return;
      var dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 40) {
        var next = state.activeTab + (dx < 0 ? 1 : -1);
        next = Math.max(0, Math.min(TAB_COUNT - 1, next));
        setActiveTab(next);
      }
      startX = null;
    }, { passive: true });
  }

  function wireThreadTabs(story) {
    document.querySelectorAll(".thread-tab").forEach(function (btn) {
      btn.onclick = function () {
        state.activeThread[story.id] = parseInt(btn.getAttribute("data-thread"), 10);
        var pane = document.querySelectorAll(".tab-pane")[0];
        pane.innerHTML = threadsHtml(story);
        wireThreadTabs(story);
        wireTimelineToggle();
      };
    });
  }
  function wireTimelineToggle() {
    document.querySelectorAll(".tl-item").forEach(function (item) {
      item.querySelector(".tl-one").onclick = function () { item.classList.toggle("expanded"); };
    });
  }

  /* ---------------- entity modal ---------------- */
  function openEntityModal(ent, story) {
    var cat = story.theme_category;
    var heroUrl = ent.context_image_url || ent.image_url;
    var hero = mediaTag(heroUrl, { iconType: ent.type, catKey: cat, cls: "entity-modal-hero", alt: ent.name });
    var isKey = (ent.profile || "").length > 300;
    var html = '<div style="--cat-color: var(--cat-' + cat + ')">' +
      '<div style="position:relative">' + hero +
        '<button class="icon-btn entity-modal-close" id="btnEntityClose" style="background:rgba(0,0,0,.4);color:#fff;border-color:transparent">' + CLOSE_ICON + '</button>' +
      '</div>' +
      '<div class="entity-modal-body">' +
        '<div class="entity-modal-type">' + escapeHtml(typeLabel(ent.type)) + (isKey ? ' · ' + t("keyFigure") : '') + '</div>' +
        '<h2 class="entity-modal-name">' + escapeHtml(ent.name) + '</h2>' +
        (ent.role_in_story ? '<p class="entity-modal-role">' + escapeHtml(ent.role_in_story) + '</p>' : '') +
        '<p class="entity-modal-bio">' + escapeHtml(ent.profile || "") + '</p>' +
        (ent.wikipedia_url ? '<button class="pill-btn" id="btnEntityWiki">' + t("wikipedia") + EXTERNAL + '</button>' : '') +
      '</div></div>';
    document.getElementById("entityModal").innerHTML = html;
    document.getElementById("entityModal").classList.add("open");
    document.getElementById("entityScrim").classList.add("open");
    document.getElementById("btnEntityClose").onclick = closeEntityModal;
    document.getElementById("entityScrim").onclick = closeEntityModal;
    var wikiBtn = document.getElementById("btnEntityWiki");
    if (wikiBtn) wikiBtn.onclick = function () { window.open(ent.wikipedia_url, "_blank", "noopener,noreferrer"); };
  }
  function closeEntityModal() {
    document.getElementById("entityModal").classList.remove("open");
    document.getElementById("entityScrim").classList.remove("open");
  }

  /* ---------------- market chart v3 ----------------
     Zwei Darstellungen:
     (1) Event Study (mc.event_study, s. pipeline/event_study.py): Prozent
         seit dem Ereignis, TATSAECHLICHER Verlauf gegen den GESCHAETZTEN
         Verlauf ohne Ereignis, dazwischen die Abweichung als Flaeche.
     (2) Rueckfall ohne Event Study (nur mc.series): Prozent-Veraenderung
         der Rohkurse seit dem Ereignistag/Beginn.
     Beide mit runden Achsenwerten, Klarnamen statt Tickern, Endwerten. */
  var MARKET_NAMES = {
    "CADUSD=X": "Kanad. Dollar (CAD/USD)", "USDCAD=X": "US-Dollar (in kanad. $)",
    "EURUSD=X": "Euro/US-Dollar", "USDJPY=X": "US-Dollar/Yen", "CNY=X": "US-Dollar/Yuan",
    "BZ=F": "Brent-Rohöl", "CL=F": "WTI-Rohöl", "GC=F": "Gold", "NG=F": "Erdgas",
    "HG=F": "Kupfer", "ZW=F": "Weizen",
    "^GSPC": "S&P 500", "^IXIC": "Nasdaq", "^DJI": "Dow Jones", "^VIX": "VIX (Schwankung)",
    "^GSPTSE": "S&P/TSX (Kanada)", "^STOXX50E": "Euro Stoxx 50", "^GDAXI": "DAX",
    "^FTSE": "FTSE 100", "^N225": "Nikkei 225", "^TNX": "US-Rendite 10 J.",
    "LMT": "Lockheed Martin", "RTX": "RTX", "GM": "General Motors", "F": "Ford",
    "XOM": "ExxonMobil", "CVX": "Chevron", "TSLA": "Tesla", "AAPL": "Apple",
    "MUV2.DE": "Munich Re", "SREN.SW": "Swiss Re",
    "basket:commodity": "Durchschnitt anderer Rohstoffe (ohne diesen Wert)", "basket:equity": "Durchschnitt anderer Aktienindizes weltweit (ohne diesen Wert)", "DX-Y.NYB": "US-Dollar-Index",
    "RHM.DE": "Rheinmetall", "TSM": "TSMC", "NVDA": "Nvidia", "^HSI": "Hang Seng",
    "ALI=F": "Aluminium", "LBR=F": "Bauholz", "HRC=F": "Stahl (Walzstahl)", "DC=F": "Milchpreis",
    "KMB": "Kimberly-Clark", "NUE": "Nucor (Stahl)", "SOXX": "Chip-Aktien (ETF)"
  };
  /* Kurz erklaert: Was ist das eigentlich? (Anzeige im Block "Warum dieser Wert?") */
  var MARKET_INFO = {
    "CADUSD=X": "Preis von 1 kanadischem Dollar in US-Dollar (Börsenschreibweise CAD/USD). Fällt die Linie, wird der kanadische Dollar schwächer.",
    "^GSPTSE": "Leitindex der Börse Toronto: bildet die größten kanadischen Unternehmen ab.",
    "^GSPC": "S&P 500: Index der 500 größten US-Unternehmen, Maßstab für die US-Börse.",
    "GM": "Einer der größten US-Autokonzerne (Chevrolet, Cadillac, GMC) mit Werken in Kanada und Mexiko und Lieferketten über die Grenze.",
    "F": "US-Autokonzern mit Werken in Kanada und Mexiko und Lieferketten über die Grenze.",
    "ALI=F": "Aluminium-Terminkontrakt (Future): Börsenpreis für Aluminium.",
    "LBR=F": "Bauholz-Terminkontrakt (Future): Börsenpreis für Nutzholz.",
    "HRC=F": "Walzstahl-Terminkontrakt (Future): Börsenpreis für Stahl.",
    "DC=F": "Milch-Terminkontrakt (Future): Börsenpreis für Milch (Klasse III).",
    "CL=F": "WTI-Rohöl: wichtigste US-Ölsorte (Terminkontrakt).",
    "BZ=F": "Brent-Rohöl: wichtigste Ölsorte für den Weltmarkt (Terminkontrakt).",
    "GC=F": "Gold (Terminkontrakt): gilt als sicherer Hafen in Krisen.",
    "XOM": "Größter US-Ölkonzern.",
    "KMB": "US-Hersteller von Papier- und Hygieneprodukten (Kleenex, Huggies), hier als Beispiel für Konsumgüter.",
    "NUE": "Größter US-Stahlproduzent, hier als Beispiel für die US-Stahlbranche.",
    "SOXX": "iShares Semiconductor ETF: Fonds auf große Chip-Unternehmen, hier als Beispiel für die Technologiebranche.",
    "^TNX": "Rendite zehnjähriger US-Staatsanleihen. Sinkt sie, sind Anleihen gefragt (Zeichen von Unsicherheit)."
  };
  function eventLabelText(mc, story) {
    var l = (mc && mc.event_label) || "";
    if (!l) {
      l = (story && story.title ? String(story.title) : "").split(/[:\u2013\u2014-]/)[0].trim();
      if (l.length > 26) l = l.slice(0, 25).replace(/\s+\S*$/, "") + "\u2026";
    }
    return l || mcL("Auslöser", "Trigger");
  }
  function renderAbout(story, idx) {
    var box = document.getElementById("mcAbout");
    var mc = story.market_correlation, es = mcStudy(story), a = es.assets[idx];
    if (!box || !a) return;
    var html = '<b>' + escapeHtml(marketLabel(a.ticker)) + '</b>';
    if (MARKET_INFO[a.ticker]) html += ' \u2013 ' + escapeHtml(MARKET_INFO[a.ticker]);
    if (a.reason) html += '<div style="margin-top:4px"><b>' + mcL("Warum hier?", "Why here?") + '</b> ' + escapeHtml(a.reason) + '</div>';
    box.innerHTML = html;
  }
  function marketLabel(l) { return MARKET_NAMES[l] || l; }

  var SERIES_COLORS = ["accent", "#4a90d9", "#3fa37a"];
  var SERIES_DASH = ["", "7 4", "2 4"];

  function mcL(de, en) { return state.lang === "de" ? de : en; }
  function fmtNum(v, d) {
    var s = Math.abs(v).toFixed(d);
    return state.lang === "de" ? s.replace(".", ",") : s;
  }
  function fmtPct(v, d) {
    if (Math.abs(v) < Math.pow(10, -d) / 2) return fmtNum(0, d) + " %";
    return (v > 0 ? "+" : "−") + fmtNum(v, d) + " %";
  }
  function fmtSigned(v, d) { return (v < 0 ? "−" : "") + fmtNum(v, d); }
  function mcDate(iso, withYear) {
    var d = new Date(iso + "T00:00:00Z");
    var o = { day: "2-digit", month: "2-digit", timeZone: "UTC" };
    if (withYear) o.year = "numeric";
    return d.toLocaleDateString(state.lang === "de" ? "de-DE" : "en-GB", o);
  }

  /* Runde Achsenwerte: 1/2/2.5/5 x 10^n, beide Raender auf Schritte gerundet. */
  function niceScale(vMin, vMax, want) {
    want = want || 5;
    if (vMax - vMin < 1e-9) { vMin -= 0.5; vMax += 0.5; }
    var raw = (vMax - vMin) / (want - 1);
    var mag = Math.pow(10, Math.floor(Math.log10(raw)));
    var steps = [1, 2, 2.5, 5, 10], step = mag * 10;
    for (var i = 0; i < steps.length; i++) { if (steps[i] * mag >= raw) { step = steps[i] * mag; break; } }
    var lo = Math.floor(vMin / step + 1e-9) * step, hi = Math.ceil(vMax / step - 1e-9) * step;
    var ticks = [];
    for (var v = lo; v <= hi + step * 1e-6; v += step) ticks.push(Math.abs(v) < step * 1e-6 ? 0 : v);
    var dec = 0;
    while (dec < 4 && Math.abs(step * Math.pow(10, dec) - Math.round(step * Math.pow(10, dec))) > 1e-6) dec++;
    return { min: lo, max: hi, ticks: ticks, dec: dec };
  }
  function tickLabel(v, dec) { return v === 0 ? "0 %" : fmtPct(v, dec); }

  /* Ansicht: Bezugstag (0 = Meldung/Ereignistag, 1 = Ankuendigung) und Zeitfenster (null = alles) */
  var mcView = { sid: null, variant: 0, win: null };
  function mcStudy(story) {
    var mc = story.market_correlation;
    return (mcView.variant === 1 && mc.event_study_alt) ? mc.event_study_alt : mc.event_study;
  }
  /* Asset auf ein Zeitfenster (Handelstage nach dem Ereignis) zuschneiden; t-Wert neu */
  function mcWindowed(a, win) {
    if (!win || win >= a.n_post) return a;
    var pts = a.points.filter(function (p) { return p.day <= win; });
    var last = pts[pts.length - 1];
    if (!last || last.day < 1) return a;
    var diff = last.actual - (last.expected || 0);
    var t = a.resid_sd_pct > 1e-9 ? diff / (a.resid_sd_pct * Math.sqrt(last.day)) : null;
    var c = {}; for (var k in a) c[k] = a[k];
    c.points = pts; c.n_post = last.day; c.diff_pct = Math.round(diff * 1000) / 1000; c.t_stat = t === null ? null : Math.round(t * 100) / 100;
    return c;
  }
  function mcVariantLabel(story, v) {
    var mc = story.market_correlation;
    if (v === 1) return (mc.event_study_alt.label || mcL("Ankündigung", "Announcement")) + " (" + mcDate(mc.event_study_alt.event_date, false) + ")";
    var es = mc.event_study;
    return mcL(es.event_date_source === "story_date" ? "Meldung" : "Ereignistag", es.event_date_source === "story_date" ? "Report" : "Event day") + " (" + mcDate(es.event_date, false) + ")";
  }

  /* Rein beschreibender, VERDICHTETER Text aus den Kursdaten (keine Theorie).
     Aehnliche Werte werden zusammengefasst (gleiche Richtung, kein auffaelliger
     Ausreisser), nur Auffaelliges/Ausreisser bekommt einen eigenen Satz. */
  function mcNames(list) {
    var n = list.map(function (x) { return "<b>" + escapeHtml(marketLabel(x.a.ticker)) + "</b>"; });
    if (n.length < 2) return n.join("");
    return n.slice(0, -1).join(", ") + mcL(" und ", " and ") + n[n.length - 1];
  }
  function mcRange(vals, signed) {
    var abs = vals.map(function (v) { return Math.abs(v); }), lo = Math.min.apply(null, abs), hi = Math.max.apply(null, abs);
    return lo.toFixed(1) === hi.toFixed(1) ? fmtNum(hi, 1) : fmtNum(lo, 1) + mcL(" bis ", " to ") + fmtNum(hi, 1);
  }
  function mcAssetInfo(es) {
    var rows = [];
    es.assets.forEach(function (a) {
      var last = a.points[a.points.length - 1];
      if (!last) return;
      rows.push({ a: a, act: last.actual, exp: (last.expected === null || last.expected === undefined) ? 0 : last.expected, diff: a.diff_pct, day: last.day,
        hit: a.t_stat !== null && a.t_stat !== undefined && Math.abs(a.t_stat) >= 2 });
    });
    var abs = rows.map(function (r) { return Math.abs(r.act); }).sort(function (x, y) { return x - y; });
    var med = abs.length ? abs[Math.floor(abs.length / 2)] : 0;
    rows.forEach(function (r) { r.outlier = r.hit || (rows.length >= 3 && Math.abs(r.act) >= 5 && Math.abs(r.act) >= 2.5 * med); });
    return rows;
  }
  function observationHtml(es) {
    var rows = mcAssetInfo(es);
    if (!rows.length) return "";
    var day = rows[0].day, flat = function (v) { return Math.abs(v) < 0.05; };
    var down = [], up = [], still = [], singles = [];
    rows.forEach(function (r) {
      if (r.outlier) singles.push(r);
      else if (flat(r.act)) still.push(r); else if (r.act < 0) down.push(r); else up.push(r);
    });
    var parts = [];
    if (down.length) parts.push(mcL((down.length > 1 ? "gefallen sind " : "gefallen ist ") + mcNames(down) + " (um " + mcRange(down.map(function (r) { return r.act; })) + " %)",
      "fallen: " + mcNames(down) + " (by " + mcRange(down.map(function (r) { return r.act; })) + " %)"));
    if (up.length) parts.push(mcL((up.length > 1 ? "gestiegen sind " : "gestiegen ist ") + mcNames(up) + " (um " + mcRange(up.map(function (r) { return r.act; })) + " %)",
      "risen: " + mcNames(up) + " (by " + mcRange(up.map(function (r) { return r.act; })) + " %)"));
    if (still.length) parts.push(mcL("praktisch unverändert blieb " + mcNames(still), "practically unchanged: " + mcNames(still)));
    var html = "";
    if (parts.length) {
      var rest = down.concat(up, still);
      var exps = rest.map(function (r) { return r.exp; }), diffs = rest.map(function (r) { return Math.abs(r.diff); });
      var eLo = Math.min.apply(null, exps), eHi = Math.max.apply(null, exps), dMax = Math.max.apply(null, diffs);
      var expTxt = (flat(eLo) && flat(eHi)) ? mcL("praktisch keine Veränderung", "practically no change")
        : (eLo.toFixed(1) === eHi.toFixed(1) ? fmtPct(eLo, 1) : mcL("zwischen ", "between ") + fmtPct(eLo, 1) + mcL(" und ", " and ") + fmtPct(eHi, 1));
      html += '<p>' + mcL("Seit dem Ereignis (Tag +" + day + ") " + parts.join("; ") + ". ", "Since the event (day +" + day + ") " + parts.join("; ") + ". ") +
        mcL("Nach dem üblichen Marktmuster waren " + expTxt + " zu erwarten; die Abweichungen betragen höchstens " + fmtNum(dMax, 1) + " Prozentpunkte und liegen im Rahmen der üblichen Schwankung.",
            "By the usual market pattern " + expTxt + " was expected; deviations are at most " + fmtNum(dMax, 1) + " percentage points, within usual fluctuation.") + '</p>';
    }
    singles.forEach(function (r) {
      var act = r.act, exp = r.exp, diff = r.diff;
      var verb = flat(act) ? mcL("blieb praktisch unverändert", "stayed practically unchanged")
        : mcL((act > 0 ? "stieg" : "fiel") + " um " + fmtNum(Math.abs(act), 1) + " %", (act > 0 ? "rose " : "fell ") + fmtNum(Math.abs(act), 1) + " %");
      var expT = flat(exp) ? mcL("praktisch keine Veränderung", "practically no change") : fmtPct(exp, 1);
      var cmp = flat(diff) ? mcL("wie erwartet", "as expected") : mcL(fmtNum(Math.abs(diff), 1) + " Prozentpunkte " + (diff > 0 ? "stärker" : "schwächer") + " als erwartet", fmtNum(Math.abs(diff), 1) + " pp " + (diff > 0 ? "stronger" : "weaker") + " than expected");
      var verdict = r.hit ? mcL("auffällig", "notable") : mcL("trotzdem im Rahmen der üblichen Schwankung dieses Werts", "still within this asset's usual fluctuation");
      html += '<p><b>' + escapeHtml(marketLabel(r.a.ticker)) + '</b> ' + verb + mcL(" (erwartet: ", " (expected: ") + expT + "; " + cmp + "; " + verdict + ").</p>";
    });
    // Kurzfristig auffaellig, auf 15 Tage aber im Rauschen? (sensibler fuer Sofortreaktionen)
    var short = [];
    es.assets.forEach(function (a, i) {
      if (rows[i] && rows[i].hit) return;
      [3, 5].some(function (w) {
        if (w >= a.n_post) return false;
        var v = mcWindowed(a, w);
        if (v.t_stat !== null && v.t_stat !== undefined && Math.abs(v.t_stat) >= 2) {
          short.push({ a: a, w: w, diff: v.diff_pct, t: v.t_stat }); return true;
        }
        return false;
      });
    });
    if (short.length) {
      html += '<p>' + mcL("Kurzfristig fällt auf: ", "Short-term: ") + short.map(function (s) {
        return "<b>" + escapeHtml(marketLabel(s.a.ticker)) + "</b>" + mcL(" weicht in den ersten " + s.w + " Tagen " + fmtNum(Math.abs(s.diff), 1) + " Prozentpunkte " + (s.diff > 0 ? "nach oben" : "nach unten") + " vom Erwartungsverlauf ab",
          " deviates " + fmtNum(Math.abs(s.diff), 1) + " pp " + (s.diff > 0 ? "upwards" : "downwards") + " in the first " + s.w + " days");
      }).join(mcL("; ", "; ")) + mcL(". Über das ganze Zeitfenster geht das im üblichen Schwanken unter. Hinweis: Je mehr Zeitfenster man prüft, desto leichter entstehen Zufallstreffer.", ". Over the whole window this disappears in normal fluctuation. Note: the more windows are checked, the easier random hits become.") + '</p>';
    }
    return '<div class="mc-obs">' + html + '</div>';
  }
  /* Einleitender Satz der Einordnung: knuepft an die Beobachtungen an */
  function interpretationLead(es) {
    var rows = mcAssetInfo(es), hits = rows.filter(function (r) { return r.hit; });
    if (!hits.length) return mcL("Die Kursbewegungen bleiben im Rahmen der üblichen Schwankung, ein Effekt des Ereignisses lässt sich daraus nicht belegen. Theoretisch sind folgende Zusammenhänge plausibel:",
      "Price moves stay within usual fluctuation, so no effect of the event can be demonstrated from them. In theory the following connections are plausible:");
    return mcL("Auffällig vom Erwartungsverlauf weicht " + (hits.length > 1 ? "ab: " : "ab: ") + hits.map(function (r) { return escapeHtml(marketLabel(r.a.ticker)); }).join(", ") + ". Bei den übrigen Werten ist ein Effekt aus den Kursen nicht belegbar. Mögliche theoretische Hintergründe:",
      "Notably off the expected path: " + hits.map(function (r) { return escapeHtml(marketLabel(r.a.ticker)); }).join(", ") + ". For the other assets no effect can be demonstrated from prices. Possible theoretical background:");
  }
  function ensureMarketStyle() {
    if (document.getElementById("mcStyle")) return;
    var st = document.createElement("style");
    st.id = "mcStyle";
    st.textContent =
      ".mc-assets{display:flex;gap:6px;flex-wrap:wrap;margin:2px 0 12px}" +
      ".mc-asset-btn{border:1px solid var(--border);background:transparent;color:var(--ink-secondary);border-radius:var(--radius-s);padding:7px 12px;font-size:13px;font-weight:600;cursor:pointer}" +
      ".mc-asset-btn.active{background:var(--cat-color);color:#fff;border-color:transparent}" +
      ".mc-tiles{display:flex;gap:10px;flex-wrap:wrap;margin:14px 0 10px}" +
      ".mc-tile{flex:1 1 92px;border:1px solid var(--border);border-radius:var(--radius-s);padding:10px 12px}" +
      ".mc-tile-l{font-size:11.5px;font-weight:600;color:var(--ink-muted);margin-bottom:3px}" +
      ".mc-tile-v{font-size:18px;font-weight:700;letter-spacing:-.01em}" +
      ".mc-verdict{font-size:13px;line-height:1.5;color:var(--ink);padding:10px 12px;border-radius:var(--radius-s);border:1px solid var(--border)}" +
      ".mc-verdict.hit{border-color:var(--cat-color);background:color-mix(in srgb, var(--cat-color) 10%, transparent)}" +
      ".mc-label{font-size:11.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-muted);margin:0 0 6px}" +
      ".mc-head{font-size:14.5px;line-height:1.5;color:var(--ink-secondary)}" +
      ".mc-head-ev{margin-top:4px;font-size:17px;font-weight:700;color:var(--ink)}" +
      ".mc-head-ev span{font-weight:500;font-size:14px;color:var(--ink-muted)}" +
      ".mc-obs{font-size:14px;line-height:1.55;color:var(--ink-secondary)}" +
      ".mc-obs-head{font-weight:600;color:var(--ink);margin-bottom:6px}" +
      ".mc-obs p{margin:0 0 8px}" +
      ".mc-theory{margin:14px 0 4px;padding:12px 14px;border:1px dashed var(--border);border-radius:var(--radius-s);font-size:13.5px;line-height:1.55;color:var(--ink-secondary)}" +
      ".mc-theory ul{margin:4px 0 0;padding-left:18px}" +
      ".mc-small{font-size:12.5px;color:var(--ink-muted);line-height:1.55;margin:10px 0 4px}" +
      ".mc-legend-line{display:inline-block;vertical-align:middle;margin-right:6px}";
    document.head.appendChild(st);
  }

  function marketLegendEventStudy() {
    function line(dash, cssColor, w) {
      return '<svg class="mc-legend-line" width="26" height="8" aria-hidden="true"><line x1="0" y1="4" x2="26" y2="4" style="stroke:' + cssColor + '" stroke-width="' + w + '"' + (dash ? ' stroke-dasharray="' + dash + '"' : '') + '/></svg>';
    }
    return '<div class="legend-row">' +
      '<div class="legend-item">' + line("", "var(--cat-color)", 3) + mcL("Tatsächlich", "Actual") + '</div>' +
      '<div class="legend-item">' + line("6 4", "var(--ink-secondary)", 2.2) + mcL("Erwartet ohne Ereignis (Schätzung)", "Expected without the event (estimate)") + '</div>' +
    '</div>';
  }

  function renderEventSummary(story, idx) {
    var mc = story.market_correlation, es = mcStudy(story), a0 = es.assets[idx], a = a0 && mcWindowed(a0, mcView.win);
    var box = document.getElementById("mcSummary"), meth = document.getElementById("mcMethod");
    if (!box || !a) return;
    renderAbout(story, idx);
    var last = a.points[a.points.length - 1];
    var name = marketLabel(a.ticker);
    var accent = "var(--cat-color)";
    var hit = a.t_stat !== null && a.t_stat !== undefined && Math.abs(a.t_stat) >= 2;
    var tNum = (a.t_stat === null || a.t_stat === undefined) ? "" : fmtSigned(a.t_stat, 1);
    var verdict = "";
    if (tNum !== "") {
      verdict = hit
        ? mcL("Auffällig (t = " + tNum + "): Die Abweichung ist größer als das übliche Auf und Ab dieses Kurses.",
              "Notable (t = " + tNum + "): the gap is larger than this price's usual ups and downs.")
        : mcL("Im Rahmen der üblichen Schwankung (t = " + tNum + "): Aus diesem Kursverlauf allein lässt sich keine Wirkung des Ereignisses ablesen.",
              "Within normal fluctuation (t = " + tNum + "): this price path alone does not show an effect of the event.");
    }
    var base = a.points.filter(function (p) { return p.day === 0; })[0];
    var dateInfo = mcL("Stichtag: ", "Event date: ") + mcDate(es.event_date, true) +
      (es.event_date_source === "story_date" ? mcL(" (Datum der Meldung, nicht zwingend der Tag des Ereignisses)", " (date of the report, not necessarily the day of the event)") : (es.event_date_source === "announce" ? mcL(" (Tag der Ankündigung)", " (day of the announcement)") : "")) +
      (base ? mcL(" · Basis (0 %) ist der Schlusskurs vom ", " · baseline (0 %) is the close of ") + mcDate(base.date, true) : "") + ".";
    var n = a.n_post;
    box.innerHTML =
      '<div class="mc-tiles">' +
        '<div class="mc-tile"><div class="mc-tile-l">' + mcL("Tatsächlich (Tag +" + n + ")", "Actual (day +" + n + ")") + '</div><div class="mc-tile-v" style="color:' + accent + '">' + fmtPct(last.actual, 1) + '</div></div>' +
        '<div class="mc-tile"><div class="mc-tile-l">' + mcL("Erwartet (Tag +" + n + ")", "Expected (day +" + n + ")") + '</div><div class="mc-tile-v" style="color:var(--ink-secondary)">' + fmtPct(last.expected, 1) + '</div></div>' +
        '<div class="mc-tile"><div class="mc-tile-l">' + mcL("Abweichung", "Difference") + '</div><div class="mc-tile-v">' + fmtPct(a.diff_pct, 1).replace(" %", mcL(" Pkt.", " pp")) + '</div></div>' +
      '</div>' +
      (verdict ? '<div class="mc-verdict' + (hit ? ' hit' : '') + '">' + escapeHtml(verdict) + '</div>' : '') +
      '<div class="mc-small">' + escapeHtml(dateInfo) + '</div>';
    if (meth) {
      var bench = a.benchmark ? marketLabel(a.benchmark) : "";
      var txt;
      if (a.model === "market" && bench) {
        txt = mcL(
          "So gelesen: Die gestrichelte Linie schätzt, wie sich " + name + " ohne das Ereignis bewegt hätte. Als Vergleichsmarkt dient: " + bench + ". Die Linie folgt ihm so stark wie in den " + a.n_est + " Handelstagen davor (Faktor " + fmtSigned(a.beta, 2) + ", R² = " + fmtNum(a.r2, 2) + "). Einen eigenen Trend nimmt sie nicht an.",
          "How to read: the dashed line estimates how " + name + " would have moved without the event. The reference market is: " + bench + ". The line follows it as strongly as in the " + a.n_est + " trading days before (factor " + fmtSigned(a.beta, 2) + ", R² = " + fmtNum(a.r2, 2) + "). It assumes no trend of its own.");
        if (a.r2 < 0.1) txt += mcL(" " + name + " hängt kaum mit " + bench + " zusammen; deshalb verläuft die Linie fast flach: Ohne Ereignis erwarten wir hier keine bestimmte Bewegung.", " " + name + " is barely related to " + bench + ", so the line is almost flat: without the event no particular move is expected.");
      } else {
        txt = mcL(
          "So gelesen: Für " + name + " war kein Vergleichsmarkt verfügbar. Die gestrichelte Linie zeigt deshalb nur „keine Veränderung“ (0 %) als Maßstab.",
          "How to read: no reference market was available for " + name + ". The dashed line therefore only shows “no change” (0 %) as the yardstick.");
      }
      txt += mcL(" Das zeigt, ob der Kurs ungewöhnlich lief. Es beweist nicht, dass das Ereignis die Ursache ist.", " This shows whether the price moved unusually. It does not prove that the event was the cause.");
      meth.textContent = txt;
    }
  }

  function drawEventStudy(story, idx) {
    var mc = story.market_correlation, es = mcStudy(story), a0 = es.assets[idx], a = a0 && mcWindowed(a0, mcView.win);
    var svg = document.getElementById("mcChart");
    if (!svg || !a || !a.points || a.points.length < 2) return;
    var pts = a.points;
    var W = 480, H = 290, padL = 46, padR = 64, padT = 30, padB = 42;
    var dMin = pts[0].day, dMax = pts[pts.length - 1].day;
    var vals = [0];
    pts.forEach(function (p) {
      vals.push(p.actual);
      if (p.expected !== null && p.expected !== undefined) vals.push(p.expected);
    });
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    var pad = (hi - lo) * 0.1 || 0.5;
    var sc = niceScale(lo - pad, hi + pad, 5);
    var plotW = W - padL - padR;
    function X(d) { return padL + (d - dMin) / ((dMax - dMin) || 1) * plotW; }
    function Y(v) { return padT + (1 - (v - sc.min) / (sc.max - sc.min)) * (H - padT - padB); }
    var cs = getComputedStyle(document.documentElement);
    var accent = cs.getPropertyValue("--cat-" + story.theme_category).trim() || "#0a84ff";
    var expCol = cs.getPropertyValue("--ink-secondary").trim() || "#9a9a9a";

    var body = "";
    // Bereich nach dem Ereignis leicht hinterlegt
    body += '<rect x="' + X(0).toFixed(1) + '" y="' + padT + '" width="' + (X(dMax) - X(0)).toFixed(1) + '" height="' + (H - padT - padB) + '" fill="' + accent + '" fill-opacity="0.05"/>';
    // Gitter + Y-Beschriftung
    sc.ticks.forEach(function (v) {
      var yy = Y(v).toFixed(1);
      body += '<line x1="' + padL + '" y1="' + yy + '" x2="' + (W - padR) + '" y2="' + yy + '" stroke="var(--border)" stroke-width="' + (v === 0 ? 0 : 1) + '"/>';
      body += '<text x="' + (padL - 7) + '" y="' + (Y(v) + 4).toFixed(1) + '" text-anchor="end" font-size="12" fill="var(--ink-muted)">' + tickLabel(v, sc.dec) + '</text>';
    });
    body += '<line x1="' + padL + '" y1="' + Y(0).toFixed(1) + '" x2="' + (W - padR) + '" y2="' + Y(0).toFixed(1) + '" stroke="var(--ink-muted)" stroke-width="1.4"/>';
    // Ereignislinie
    var ex = X(0).toFixed(1);
    body += '<line x1="' + ex + '" y1="' + padT + '" x2="' + ex + '" y2="' + (H - padB) + '" stroke="var(--ink-muted)" stroke-width="1.4" stroke-dasharray="3 3"/>';
    body += '<text x="' + ex + '" y="' + (padT - 10) + '" text-anchor="' + (X(0) < padL + 90 ? "start" : "middle") + '" font-size="12.5" font-weight="600" fill="var(--ink-secondary)">' + escapeHtml((es.event_date_source === "announce" && es.label) ? es.label : eventLabelText(mc, story)) + '</text>';
    // X-Achse: Handelstage
    var tick = (dMax - dMin) <= 8 ? 1 : 5;
    var t0 = Math.ceil(dMin / tick) * tick;
    for (var d = t0; d <= dMax; d += tick) {
      var lab = d === 0 ? "0" : (d > 0 ? "+" : "−") + Math.abs(d);
      body += '<text x="' + X(d).toFixed(1) + '" y="' + (H - padB + 16) + '" text-anchor="middle" font-size="12" fill="var(--ink-muted)">' + lab + '</text>';
    }
    body += '<text x="' + (padL + plotW / 2).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle" font-size="12" fill="var(--ink-muted)">' + mcL("Handelstage seit dem Ereignis", "Trading days since the event") + '</text>';

    // Abweichungsflaeche zwischen tatsaechlich und erwartet
    var post = pts.filter(function (p) { return p.day >= 0 && p.expected !== null && p.expected !== undefined; });
    var poly = post.map(function (p) { return X(p.day).toFixed(1) + "," + Y(p.actual).toFixed(1); })
      .concat(post.slice().reverse().map(function (p) { return X(p.day).toFixed(1) + "," + Y(p.expected).toFixed(1); })).join(" ");
    body += '<polygon points="' + poly + '" fill="' + accent + '" fill-opacity="0.17" stroke="none"/>';
    // Erwartet (gestrichelt) + tatsaechlich
    var ePath = post.map(function (p, i) { return (i === 0 ? "M" : "L") + X(p.day).toFixed(1) + "," + Y(p.expected).toFixed(1); }).join(" ");
    body += '<path d="' + ePath + '" fill="none" stroke="' + expCol + '" stroke-width="2.2" stroke-dasharray="6 4" stroke-linecap="round"/>';
    var aPath = pts.map(function (p, i) { return (i === 0 ? "M" : "L") + X(p.day).toFixed(1) + "," + Y(p.actual).toFixed(1); }).join(" ");
    body += '<path d="' + aPath + '" fill="none" stroke="' + accent + '" stroke-width="2.8" stroke-linejoin="round" stroke-linecap="round"/>';
    pts.forEach(function (p) {
      body += '<circle cx="' + X(p.day).toFixed(1) + '" cy="' + Y(p.actual).toFixed(1) + '" r="2.6" fill="var(--bg-elevated)" stroke="' + accent + '" stroke-width="1.8"/>';
    });
    // Endwerte rechts
    var last = pts[pts.length - 1];
    var yA = Y(last.actual), yE = Y(last.expected);
    if (Math.abs(yA - yE) < 15) {
      var mid = (yA + yE) / 2;
      if (yA <= yE) { yA = mid - 8; yE = mid + 8; } else { yA = mid + 8; yE = mid - 8; }
    }
    var xl = (X(dMax) + 9).toFixed(1);
    body += '<text x="' + xl + '" y="' + (yA + 4).toFixed(1) + '" font-size="14" font-weight="700" fill="' + accent + '">' + fmtPct(last.actual, 1) + '</text>';
    body += '<text x="' + xl + '" y="' + (yE + 4).toFixed(1) + '" font-size="13" font-weight="600" fill="' + expCol + '">' + fmtPct(last.expected, 1) + '</text>';
    // Hover-Elemente (anfangs versteckt)
    body += '<g id="mcHover" style="display:none"><line id="mcHx" y1="' + padT + '" y2="' + (H - padB) + '" stroke="var(--ink-muted)" stroke-width="1"/>' +
      '<circle id="mcHa" r="4.5" fill="' + accent + '" stroke="var(--bg-elevated)" stroke-width="2"/>' +
      '<circle id="mcHe" r="4" fill="' + expCol + '" stroke="var(--bg-elevated)" stroke-width="2"/></g>';
    body += '<rect id="mcOverlay" x="' + padL + '" y="' + padT + '" width="' + plotW + '" height="' + (H - padT - padB) + '" fill="transparent" style="cursor:crosshair"/>';
    svg.innerHTML = body;

    var tooltip = document.getElementById("mcTooltip");
    var overlay = document.getElementById("mcOverlay");
    var hov = document.getElementById("mcHover");
    function show(clientX) {
      var rect = svg.getBoundingClientRect();
      var sx = (clientX - rect.left) / rect.width * W;
      var day = dMin + (sx - padL) / plotW * (dMax - dMin);
      var best = pts[0];
      pts.forEach(function (p) { if (Math.abs(p.day - day) < Math.abs(best.day - day)) best = p; });
      var px = X(best.day), ya = Y(best.actual);
      var hasE = best.expected !== null && best.expected !== undefined;
      var ye = hasE ? Y(best.expected) : ya;
      var hx = document.getElementById("mcHx"), ha = document.getElementById("mcHa"), he = document.getElementById("mcHe");
      hx.setAttribute("x1", px); hx.setAttribute("x2", px);
      ha.setAttribute("cx", px); ha.setAttribute("cy", ya);
      he.setAttribute("cx", px); he.setAttribute("cy", ye); he.style.display = hasE ? "" : "none";
      hov.style.display = "";
      var dayTxt = best.day === 0 ? mcL("Basis", "Baseline") : mcL("Tag ", "Day ") + (best.day > 0 ? "+" : "−") + Math.abs(best.day);
      tooltip.innerHTML = '<b>' + dayTxt + ' · ' + mcDate(best.date, false) + '</b><br>' +
        mcL("Tatsächlich ", "Actual ") + '<b>' + fmtPct(best.actual, 2) + '</b>' +
        (hasE && best.day !== 0 ? '<br>' + mcL("Erwartet ", "Expected ") + '<b>' + fmtPct(best.expected, 2) + '</b>' : '');
      var left = px / W * rect.width;
      left = Math.max(70, Math.min(rect.width - 70, left));
      var top = Math.min(ya, ye) / H * rect.height - 70;
      if (top < 0) top = Math.max(ya, ye) / H * rect.height + 14;
      tooltip.style.transform = "translateX(-50%)";
      tooltip.style.left = left + "px";
      tooltip.style.top = top + "px";
      tooltip.classList.add("show");
    }
    function hide() { hov.style.display = "none"; tooltip.classList.remove("show"); }
    overlay.addEventListener("mousemove", function (e) { show(e.clientX); });
    overlay.addEventListener("mouseleave", hide);
    overlay.addEventListener("touchstart", function (e) { e.stopPropagation(); show(e.touches[0].clientX); }, { passive: true });
    overlay.addEventListener("touchmove", function (e) { e.stopPropagation(); show(e.touches[0].clientX); }, { passive: true });
    overlay.addEventListener("touchend", function (e) { e.stopPropagation(); }, { passive: true });
  }

  /* Rueckfall ohne Event Study: Rohkurse -> Prozent seit Ereignistag/Beginn */
  function drawSeriesChart(story) {
    var mc = story.market_correlation;
    var svg = document.getElementById("mcChart");
    if (!svg || !mc || !mc.series || !mc.series.length) return;
    var evDate = mc.event_date || "";
    var evT = evDate ? Date.parse(evDate) : NaN;
    var series = [];
    mc.series.forEach(function (s) {
      var pts = (s.points || []).filter(function (p) {
        return p && typeof p.value === "number" && isFinite(p.value) && isFinite(Date.parse(p.date));
      });
      if (pts.length < 2) return;
      var baseIdx = 0;
      if (evDate && isFinite(evT)) {
        // Basis = letzter Schluss VOR dem Ereignisdatum (gleich wie in der Event Study)
        for (var k = 0; k < pts.length; k++) { if (Date.parse(pts[k].date) < evT) baseIdx = k; }
      }
      var base = pts[baseIdx].value;
      if (!base) return;
      series.push({
        label: marketLabel(s.label),
        points: pts.map(function (p) { return { t: Date.parse(p.date), date: p.date, value: (p.value / base - 1) * 100 }; })
      });
    });
    if (!series.length) return;

    var W = 480, H = 270, padL = 46, padR = 64, padT = 28, padB = 32;
    var tMin = Infinity, tMax = -Infinity, vMin = 0, vMax = 0;
    series.forEach(function (s) {
      s.points.forEach(function (p) {
        if (p.t < tMin) tMin = p.t; if (p.t > tMax) tMax = p.t;
        if (p.value < vMin) vMin = p.value; if (p.value > vMax) vMax = p.value;
      });
    });
    var pad = (vMax - vMin) * 0.1 || 0.5;
    var sc = niceScale(vMin - pad, vMax + pad, 5);
    var plotW = W - padL - padR;
    function X(t) { return padL + (t - tMin) / ((tMax - tMin) || 1) * plotW; }
    function Y(v) { return padT + (1 - (v - sc.min) / (sc.max - sc.min)) * (H - padT - padB); }
    var cs = getComputedStyle(document.documentElement);
    var accent = cs.getPropertyValue("--cat-" + story.theme_category).trim() || "#0a84ff";
    function colorOf(i) { return SERIES_COLORS[i % 3] === "accent" ? accent : SERIES_COLORS[i % 3]; }

    var body = "";
    sc.ticks.forEach(function (v) {
      var yy = Y(v).toFixed(1);
      body += '<line x1="' + padL + '" y1="' + yy + '" x2="' + (W - padR) + '" y2="' + yy + '" stroke="var(--border)" stroke-width="' + (v === 0 ? 0 : 1) + '"/>';
      body += '<text x="' + (padL - 7) + '" y="' + (Y(v) + 4).toFixed(1) + '" text-anchor="end" font-size="12" fill="var(--ink-muted)">' + tickLabel(v, sc.dec) + '</text>';
    });
    body += '<line x1="' + padL + '" y1="' + Y(0).toFixed(1) + '" x2="' + (W - padR) + '" y2="' + Y(0).toFixed(1) + '" stroke="var(--ink-muted)" stroke-width="1.4"/>';
    if (evDate && isFinite(evT) && evT >= tMin && evT <= tMax) {
      var ex = X(evT).toFixed(1);
      body += '<line x1="' + ex + '" y1="' + padT + '" x2="' + ex + '" y2="' + (H - padB) + '" stroke="var(--ink-muted)" stroke-width="1.4" stroke-dasharray="3 3"/>';
      body += '<text x="' + ex + '" y="' + (padT - 9) + '" text-anchor="' + (X(evT) < padL + 90 ? "start" : "middle") + '" font-size="12.5" font-weight="600" fill="var(--ink-secondary)">' + escapeHtml(eventLabelText(mc, story)) + '</text>';
    }
    body += '<text x="' + padL + '" y="' + (H - 8) + '" font-size="12" fill="var(--ink-muted)">' + mcDate(new Date(tMin).toISOString().slice(0, 10), false) + '</text>';
    body += '<text x="' + (W - padR) + '" y="' + (H - 8) + '" text-anchor="end" font-size="12" fill="var(--ink-muted)">' + mcDate(new Date(tMax).toISOString().slice(0, 10), false) + '</text>';

    var allDots = [], ends = [];
    series.forEach(function (s, si) {
      var color = colorOf(si), dash = SERIES_DASH[si % 3];
      var path = s.points.map(function (p, i) { return (i === 0 ? "M" : "L") + X(p.t).toFixed(1) + "," + Y(p.value).toFixed(1); }).join(" ");
      body += '<path d="' + path + '" fill="none" stroke="' + color + '" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"' + (dash ? ' stroke-dasharray="' + dash + '"' : '') + '/>';
      s.points.forEach(function (p) { allDots.push({ x: X(p.t), y: Y(p.value), color: color, date: p.date, label: s.label, value: p.value }); });
      var lp = s.points[s.points.length - 1];
      ends.push({ y: Y(lp.value), color: color, text: fmtPct(lp.value, 1) });
    });
    // Endwerte rechts, ueberlappungsfrei (Mindestabstand 15 px)
    ends.sort(function (p, q) { return p.y - q.y; });
    for (var i = 1; i < ends.length; i++) { if (ends[i].y - ends[i - 1].y < 15) ends[i].y = ends[i - 1].y + 15; }
    ends.forEach(function (e) {
      body += '<text x="' + (W - padR + 9) + '" y="' + (e.y + 4).toFixed(1) + '" font-size="13.5" font-weight="700" fill="' + e.color + '">' + e.text + '</text>';
    });
    body += allDots.map(function (d, idx) {
      return '<circle cx="' + d.x.toFixed(1) + '" cy="' + d.y.toFixed(1) + '" r="3" fill="var(--bg-elevated)" stroke="' + d.color + '" stroke-width="2" data-idx="' + idx + '"/>';
    }).join("");
    svg.innerHTML = body;
    svg.addEventListener("touchstart", function (e) { e.stopPropagation(); }, { passive: true });
    svg.addEventListener("touchend", function (e) { e.stopPropagation(); }, { passive: true });

    var tooltip = document.getElementById("mcTooltip");
    svg.querySelectorAll("circle").forEach(function (c) {
      c.style.cursor = "pointer";
      c.addEventListener("mouseenter", function () {
        var d = allDots[parseInt(c.getAttribute("data-idx"), 10)];
        tooltip.textContent = mcDate(d.date, false) + " · " + d.label + ": " + fmtPct(d.value, 2);
        var rect = svg.getBoundingClientRect();
        tooltip.style.transform = "translateX(-50%)";
        tooltip.style.left = Math.max(80, Math.min(rect.width - 80, (d.x / W) * rect.width)) + "px";
        tooltip.style.top = (((d.y / H) * rect.height) - 40) + "px";
        tooltip.classList.add("show");
      });
      c.addEventListener("mouseleave", function () { tooltip.classList.remove("show"); });
    });
  }

  function drawMarketChart(story) {
    var mc = story.market_correlation;
    if (!mc) return;
    ensureMarketStyle();
    var es = mcStudy(story);
    if (es && es.assets && es.assets.length) {
      var current = 0;
      var svg = document.getElementById("mcChart");
      if (svg) {
        svg.addEventListener("touchstart", function (e) { e.stopPropagation(); }, { passive: true });
        svg.addEventListener("touchend", function (e) { e.stopPropagation(); }, { passive: true });
      }
      var paint = function () {
        drawEventStudy(story, current);
        renderEventSummary(story, current);
        document.querySelectorAll("[data-mc-asset]").forEach(function (b) {
          b.classList.toggle("active", parseInt(b.getAttribute("data-mc-asset"), 10) === current);
        });
      };
      document.querySelectorAll("[data-mc-asset]").forEach(function (b) {
        b.onclick = function () { current = parseInt(b.getAttribute("data-mc-asset"), 10); paint(); };
      });
      document.querySelectorAll("[data-mc-win]").forEach(function (b) {
        b.onclick = function () {
          var w = parseInt(b.getAttribute("data-mc-win"), 10);
          mcView.win = w === 0 ? null : w;
          document.querySelectorAll("[data-mc-win]").forEach(function (x) { x.classList.toggle("active", x === b); });
          paint();
        };
      });
      document.querySelectorAll("[data-mc-var]").forEach(function (b) {
        b.onclick = function () {
          mcView.variant = parseInt(b.getAttribute("data-mc-var"), 10); mcView.win = null;
          var card = document.getElementById("mcCard");
          if (card) { card.outerHTML = marketHtml(story); drawMarketChart(story); }
        };
      });
      paint();
      return;
    }
    drawSeriesChart(story);
  }

  /* ---------------- profile panel ---------------- */
  function renderProfilePanel() {
    var panel = document.getElementById("profilePanel");
    var html = '<div class="profile-head"><div class="profile-avatar-lg">' + avatarSVG(state.avatarSeed, 48) + '</div>' +
      '<div><div class="profile-name">' + t("profile") + '</div><button class="profile-shuffle" id="btnShuffleAvatar">' + t("newAvatar") + '</button></div></div>' +
      '<div class="profile-section"><div class="profile-label">' + t("language") + '</div>' +
      '<div class="seg-control"><button class="seg-btn' + (state.lang==="de"?" active":"") + '" data-lang="de">Deutsch</button>' +
      '<button class="seg-btn' + (state.lang==="en"?" active":"") + '" data-lang="en">English</button></div>' +
      (state.lang === "en" ? '<div style="font-size:11.5px;color:var(--ink-muted);margin-top:8px;">' + t("langNote") + '</div>' : '') + '</div>' +
      /* Kein Hell-Modus-Umschalter mehr (Nutzer-Feedback 24.08.2026:
         "verbiete den light mode") -- state.theme bleibt fest "dark", s.
         state-Init oben und init(). */
      '<div class="profile-section"><div class="profile-label">' + t("contentPrefs") + '</div>' +
      Object.keys(CATEGORIES).map(function (key) {
        return '<label class="check-row"><input type="checkbox" data-catcheck="' + key + '"' + (state.activeCats.has(key) ? " checked" : "") + '>' + escapeHtml(catLabel(key)) + '</label>';
      }).join("") + '</div>' +
      '<div class="profile-section">' +
        '<button class="menu-link" id="btnGoHistory"><span>' + t("history") + ' (' + state.history.length + ')</span><span class="chev">›</span></button>' +
        '<button class="menu-link" id="btnGoSaved"><span>' + t("saved") + ' (' + state.saved.size + ')</span><span class="chev">›</span></button>' +
      '</div>' +
      '<div class="session-note">' + t("sessionNote") + '</div>';
    panel.innerHTML = html;

    document.getElementById("btnShuffleAvatar").onclick = function () { state.avatarSeed = Math.random(); updateAvatarButtons(); renderProfilePanel(); };
    panel.querySelectorAll("[data-lang]").forEach(function (b) { b.onclick = function () { state.lang = b.getAttribute("data-lang"); fullRerender(); }; });
    panel.querySelectorAll("[data-catcheck]").forEach(function (cb) {
      cb.onchange = function () {
        var key = cb.getAttribute("data-catcheck");
        if (cb.checked) {
          state.activeCats.add(key);
        } else if (state.activeCats.size > 1) {
          state.activeCats.delete(key);
        } else {
          cb.checked = true; // mindestens eine Kategorie muss aktiv bleiben
        }
        if (state.view === "home") renderHome();
      };
    });
    document.getElementById("btnGoHistory").onclick = function () { closeProfile(); openList("history"); };
    document.getElementById("btnGoSaved").onclick = function () { closeProfile(); openList("saved"); };
  }

  function updateAvatarButtons() {
    document.getElementById("btnProfile").innerHTML = avatarSVG(state.avatarSeed, 36);
  }

  /* Kein setTheme()/Hell-Modus mehr -- data-theme wird nur noch einmal in
     init() fest auf "dark" gesetzt, s. Kommentar in renderProfilePanel(). */

  var profileOpen = false;
  function toggleProfile() {
    profileOpen = !profileOpen;
    document.getElementById("profilePanel").classList.toggle("open", profileOpen);
    document.getElementById("profileScrim").classList.toggle("open", profileOpen);
    if (profileOpen) renderProfilePanel();
  }
  function closeProfile() {
    profileOpen = false;
    document.getElementById("profilePanel").classList.remove("open");
    document.getElementById("profileScrim").classList.remove("open");
  }

  /* ---------------- history / saved list views ---------------- */
  function openList(kind) {
    state.view = kind;
    document.getElementById("homeView").style.display = "none";
    document.getElementById("listView").style.display = "";
    document.getElementById("listTitle").textContent = kind === "history" ? t("history") : t("saved");
    var ids = kind === "history" ? state.history : Array.from(state.saved);
    var body = document.getElementById("listBody");
    if (!ids.length) {
      body.innerHTML = '<div class="empty-state">' + (kind === "history" ? t("emptyHistory") : t("emptySaved")) + "</div>";
      return;
    }
    body.innerHTML = ids.map(function (id) {
      var s = getStory(id);
      if (!s) return "";
      var thumb = mediaTag(s.image_url, { iconType: "event", catKey: s.theme_category, cls: "list-thumb", alt: s.title });
      return '<div class="list-row" data-id="' + id + '">' + thumb +
        '<div><div class="card-title-sm">' + escapeHtml(s.title) + '</div><div class="list-meta">' + escapeHtml(catLabel(s.theme_category)) + '</div></div></div>';
    }).join("");
    body.querySelectorAll(".list-row").forEach(function (row) {
      row.onclick = function () { openDetail(row.getAttribute("data-id")); };
    });
  }
  function goHome() {
    state.view = "home";
    document.getElementById("homeView").style.display = "";
    document.getElementById("listView").style.display = "none";
    closeDetail();
  }

  function fullRerender() {
    updateAvatarButtons();
    renderLastUpdated();
    if (state.view === "home") renderHome();
    else if (state.view === "history" || state.view === "saved") openList(state.view);
    if (document.getElementById("profilePanel").classList.contains("open")) renderProfilePanel();
  }

  /* ---------------- init ---------------- */
  function renderLastUpdated() {
    var el = document.getElementById("lastUpdated");
    if (!el) return;
    var iso = window.__BUILD_DATE__;
    var label = iso;
    try {
      var d = new Date(iso + "T00:00:00");
      if (!isNaN(d.getTime())) {
        label = d.toLocaleDateString(state.lang === "de" ? "de-DE" : "en-US", { day: "numeric", month: "long", year: "numeric" });
      }
    } catch (e) {}
    el.textContent = t("standLabel")(label);
  }

  function init() {
    document.documentElement.setAttribute("data-theme", state.theme);
    updateAvatarButtons();
    document.getElementById("btnProfile").onclick = toggleProfile;
    document.getElementById("profileScrim").onclick = closeProfile;
    document.getElementById("btnHome").onclick = goHome;
    document.getElementById("entityScrim").onclick = closeEntityModal;
    renderLastUpdated();
    renderHome();
    window.addEventListener("resize", syncTabHeight);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
