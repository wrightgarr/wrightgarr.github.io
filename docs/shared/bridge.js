/* Mémo bridge — shared by Leçons, Lecture and Cartes.
   1. memoOpen(app, hash): open another section (via the Mémo tab bar, or directly when a section is opened on its own).
   2. memoSwitcher: a "Leçon · Lecture · Cartes" switcher for the subject you are on, built from shared/links.json.
   3. Fires "memo:navigate" whenever the page's address changes, including history.replaceState. */
(function () {
  'use strict';
  const BASE = (function () {
    const s = document.currentScript && document.currentScript.src;
    return s ? s.replace(/bridge\.js(\?.*)?$/, "") : "../shared/";
  })();

  /* ---------- 1. Opening another section ---------- */
  function shell() {
    try {
      if (window.parent && window.parent !== window && window.parent.memoShell) return window.parent.memoShell;
    } catch (e) {}
    return null;
  }
  window.memoEmbedded = !!shell();
  window.memoOpen = function (app, hash) {
    const s = shell();
    if (s) { s.open(app, hash); return; }
    location.href = "../" + app + "/index.html" + (hash ? "#" + hash : "");
  };

  /* ---------- 3. Address-change event ---------- */
  ["pushState", "replaceState"].forEach(fn => {
    const orig = history[fn];
    if (typeof orig !== "function") return;
    history[fn] = function () {
      const r = orig.apply(this, arguments);
      try { window.dispatchEvent(new Event("memo:navigate")); } catch (e) {}
      return r;
    };
  });
  window.addEventListener("hashchange", () => window.dispatchEvent(new Event("memo:navigate")));

  /* ---------- 2. Subject switcher ---------- */
  let LINKS = null;
  const linksReady = fetch(BASE + "links.json", { cache: "no-cache" })
    .then(r => r.ok ? r.json() : null).then(j => { LINKS = j; return j; }).catch(() => null);

  const APPS = [
    { id: "lecons", label: "Leçon", icon: '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>' },
    { id: "lecture", label: "Lecture", icon: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20"/><path d="M8 7h6"/><path d="M8 11h8"/>' },
    { id: "cartes", label: "Cartes", icon: '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>' }
  ];
  const svg = (paths, cls) => '<svg viewBox="0 0 24 24" class="' + (cls || "h-4 w-4") + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>';
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function subjectsFor(ctx) {
    if (!LINKS || !ctx) return [];
    if (ctx.app === "lecons" && ctx.subject) return LINKS.subjects[ctx.subject] ? [ctx.subject] : [];
    if (ctx.app === "lecture" && ctx.moduleId) {
      const m = LINKS.modules[ctx.moduleId];
      return m ? m.subjects.filter(n => LINKS.subjects[n]) : [];
    }
    if (ctx.app === "cartes" && ctx.deckId) {
      return Object.keys(LINKS.subjects).map(Number)
        .filter(n => LINKS.subjects[n].cartes.some(d => d.id === ctx.deckId))
        .sort((a, b) => (LINKS.subjects[b].cartes.find(d => d.id === ctx.deckId).main ? 1 : 0) -
                        (LINKS.subjects[a].cartes.find(d => d.id === ctx.deckId).main ? 1 : 0));
    }
    return [];
  }

  // Destinations for one app, given the subjects in context.
  function targetsFor(appId, subs, ctx) {
    const out = [], seen = {};
    subs.forEach(n => {
      const s = LINKS.subjects[n];
      const kicker = s.level + " · Subject " + n;
      if (appId === "lecons") {
        out.push({ hash: "subject-" + n, title: s.title, kicker: kicker });
      } else if (appId === "lecture") {
        s.lecture.forEach(id => {
          if (seen[id]) return; seen[id] = true;
          const m = LINKS.modules[id];
          out.push({ hash: id, title: m.title, kicker: m.level + " · Reading " + m.number + " — for Subject " + n });
        });
      } else {
        s.cartes.forEach(d => {
          if (seen[d.id]) return; seen[d.id] = true;
          out.push({ hash: d.main ? "subject-" + n : "deck-" + d.id, title: d.title, kicker: kicker + (d.main ? "" : " · extra deck") });
        });
      }
    });
    if (ctx.app === appId) return out.filter(t => !isCurrent(t, ctx));
    return out;
  }
  function isCurrent(t, ctx) {
    if (ctx.app === "lecture") return t.hash === ctx.moduleId;
    if (ctx.app === "lecons") return t.hash === "subject-" + ctx.subject;
    if (ctx.app === "cartes") return t.hash === "deck-" + ctx.deckId || false;
    return false;
  }

  /* Chooser sheet when there is more than one destination */
  function choose(title, targets, appId) {
    close();
    const wrap = document.createElement("div");
    wrap.id = "memo-chooser";
    wrap.className = "fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 sm:items-center";
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-modal", "true");
    wrap.innerHTML =
      '<div class="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl" style="padding-bottom:max(1.25rem,env(safe-area-inset-bottom))">' +
        '<div class="flex items-center justify-between gap-3">' +
          '<h2 class="text-base font-semibold tracking-tight text-slate-900">' + esc(title) + '</h2>' +
          '<button type="button" data-close class="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200" aria-label="Close">' +
            svg('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>') + '</button>' +
        '</div>' +
        '<div class="mt-4 grid gap-2">' +
          targets.map((t, i) =>
            '<button type="button" data-i="' + i + '" class="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left hover:border-indigo-300 hover:bg-indigo-50">' +
              '<span class="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600">' + svg(APPS.find(a => a.id === appId).icon) + '</span>' +
              '<span class="min-w-0"><span class="block truncate text-[11px] font-semibold text-indigo-600">' + esc(t.kicker) + '</span>' +
              '<span class="block text-sm font-semibold leading-snug text-slate-900">' + esc(t.title) + '</span></span>' +
            '</button>').join("") +
        '</div>' +
      '</div>';
    wrap.addEventListener("click", e => {
      if (e.target === wrap || e.target.closest("[data-close]")) { close(); return; }
      const b = e.target.closest("[data-i]");
      if (b) { close(); go(appId, targets[Number(b.dataset.i)].hash); }
    });
    document.addEventListener("keydown", escClose);
    document.body.appendChild(wrap);
    const first = wrap.querySelector("[data-i]");
    if (first) first.focus();
  }
  function escClose(e) { if (e.key === "Escape") close(); }
  function close() {
    const w = document.getElementById("memo-chooser");
    if (w) w.remove();
    document.removeEventListener("keydown", escClose);
  }
  function go(appId, hash) {
    if (appId === current.app) {
      if (location.hash.replace(/^#/, "") === hash) window.dispatchEvent(new HashChangeEvent("hashchange"));
      else location.hash = hash;
    } else {
      window.memoOpen(appId, hash);
    }
  }

  let current = {};
  let host = null;
  function render() {
    if (!host) return;
    const ctx = current;
    const subs = subjectsFor(ctx);
    if (!ctx.app || !subs.length) { host.innerHTML = ""; host.hidden = true; return; }
    host.hidden = false;
    const main = LINKS.subjects[subs[0]];
    const label = subs.length === 1
      ? main.level + " · Subject " + subs[0] + " — " + main.title
      : "Grammar: Subject " + subs[0] + " · " + main.title + " +" + (subs.length - 1) + " more";
    host.innerHTML =
      '<p class="truncate px-1 text-[11px] font-medium text-slate-500">' + esc(label) + '</p>' +
      '<div class="mt-1.5 grid grid-cols-3 gap-1 rounded-2xl bg-slate-200/70 p-1" role="group" aria-label="This subject in other sections">' +
        APPS.map(a => {
          const isHere = a.id === ctx.app;
          const targets = isHere ? [] : targetsFor(a.id, subs, ctx);
          const disabled = !isHere && !targets.length;
          const cls = isHere
            ? "bg-white text-indigo-700 shadow-sm"
            : disabled ? "text-slate-400 cursor-not-allowed" : "text-slate-600 hover:bg-white/70 hover:text-slate-900";
          const note = isHere ? "" : disabled ? "none yet" : (targets.length > 1 ? targets.length + " options" : "");
          return '<button type="button" data-app="' + a.id + '" class="flex flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-2 text-xs font-semibold transition ' + cls + '"' +
            (isHere ? ' aria-current="page"' : "") + (disabled ? ' disabled aria-disabled="true"' : "") + '>' +
            '<span class="flex items-center gap-1.5">' + svg(a.icon) + a.label + '</span>' +
            (note ? '<span class="text-[10px] font-medium opacity-70">' + note + '</span>' : "") +
          '</button>';
        }).join("") +
      '</div>';
  }
  function onClick(e) {
    const b = e.target.closest("button[data-app]");
    if (!b || b.disabled) return;
    const appId = b.dataset.app;
    if (appId === current.app) return;
    const subs = subjectsFor(current);
    const targets = targetsFor(appId, subs, current);
    if (!targets.length) return;
    if (targets.length === 1) { go(appId, targets[0].hash); return; }
    const a = APPS.find(x => x.id === appId);
    choose(appId === "lecture" ? "Readings for this subject" : appId === "cartes" ? "Flashcard decks for this subject" : "Lessons for this " + (current.app === "lecture" ? "reading" : "subject"), targets, a.id);
  }

  window.memoSwitcher = {
    // Insert the switcher before `ref` (or append to `parent`); returns the host element.
    mount(parent, ref, extraClass) {
      if (host && host.isConnected) return host;
      host = document.createElement("div");
      host.className = "memo-switcher " + (extraClass || "mt-3");
      host.hidden = true;
      host.addEventListener("click", onClick);
      if (ref) parent.insertBefore(host, ref); else parent.appendChild(host);
      render();
      return host;
    },
    set(ctx) {
      current = ctx || {};
      linksReady.then(render);
      render();
    }
  };
})();
