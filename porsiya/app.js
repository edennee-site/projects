/* Nomi — трекер калорий по фото. Telegram Mini App, без сборки. */
(function () {
  "use strict";

  // ---------- helpers ----------
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
  const inTg = !!(tg && tg.platform && tg.platform !== "unknown");
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  const r0 = (n) => Math.round(n || 0);
  const r1 = (n) => Math.round((n || 0) * 10) / 10;
  const fmt = (n) => { const v = r0(n); return (v < 0 ? "−" : "") + Math.abs(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "\u2060\u2009\u2060"); };
  const fmtS = (n) => (n > 0 ? "+" : "") + fmt(n);
  const dec = (n) => String(r1(n)).replace(".", ",");
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const icon = (id, cls = "") => `<svg class="${cls}"><use href="#i-${id}"/></svg>`;
  const pad = (n) => String(n).padStart(2, "0");
  const dkey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const fromKey = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
  const todayKey = () => dkey(new Date());
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const monday = (d) => addDays(d, -((d.getDay() + 6) % 7));
  const WD = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
  const WDF = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];
  const MON = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  const MONN = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];
  const MONS = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const plural = (n, a, b, c) => { n = Math.abs(n) % 100; const n1 = n % 10; if (n > 10 && n < 20) return c; if (n1 > 1 && n1 < 5) return b; if (n1 === 1) return a; return c; };
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const raf2 = (f) => requestAnimationFrame(() => requestAnimationFrame(f));
  const haptic = (t = "light") => { try { if (!inTg) return; if (t === "ok") tg.HapticFeedback.notificationOccurred("success"); else if (t === "err") tg.HapticFeedback.notificationOccurred("error"); else if (t === "sel") tg.HapticFeedback.selectionChanged(); else tg.HapticFeedback.impactOccurred(t); } catch (e) {} };
  const dayLabel = (k) => { const tk = todayKey(); if (k === tk) return "Сегодня"; if (k === dkey(addDays(new Date(), -1))) return "Вчера"; const d = fromKey(k); return d.getDate() + " " + MON[d.getMonth()]; };

  const MEALS = [
    { id: "breakfast", n: "Завтрак", i: "breakfast" },
    { id: "lunch", n: "Обед", i: "lunch" },
    { id: "dinner", n: "Ужин", i: "dinner" },
    { id: "snack", n: "Перекус", i: "snack" },
  ];
  const mealByTime = (d = new Date()) => { const h = d.getHours(); if (h >= 5 && h < 11) return "breakfast"; if (h >= 11 && h < 16) return "lunch"; if (h >= 16 && h < 22) return "dinner"; return "snack"; };
  const meal = (id) => MEALS.find((m) => m.id === id) || MEALS[3];

  // категории продуктов → иконки
  const CAT_RULES = [
    ["shaker", /протеин|гейнер/i], ["soup", /суп|шурп|мастав|борщ|бульон|лагман/i], ["dough", /манты|самс|чучвар|пельмен|варени|ханум|блин|сырник/i],
    ["fast", /шаурм|бургер|пицц|хот-дог|фри\b|картофель фри/i], ["dish", /плов|оши|кичири|димлам|долм|нарын|бешбармак|голубц|гуляш|казан|по-флотски|макароны с/i],
    ["fish", /лосос|тунец|рыб|ролл|сёмг|семг/i], ["meat", /шашлык|кури|говядин|баранин|индейк|фарш|мясо|сосиск|тандыр|котлет/i],
    ["egg", /яйц|яичн|омлет|глазунь/i], ["milk", /творог|йогурт|молок|кефир|катык|сузьм|ряженк|сыр|курт|сметан|коктейль/i],
    ["bread", /хлеб|лепёшк|лепешк|лаваш|нон\b/i], ["grain", /рис|гречк|овсян|хлопь|булгур|макарон|картоф|пюре|картошк|каша/i],
    ["fruit", /банан|яблок|апельсин|виноград|хурм|гранат|финик|изюм|груш|арбуз|дын|курага|авокадо|фрукт|мандарин/i],
    ["veg", /огур|помидор|салат|брокколи|ачичук|оливье|цезарь|овощ/i], ["nut", /орех|миндал|фисташ|семечк|арахис|масло/i],
    ["sweet", /печень|шоколад|морожен|торт|мёд|мед\b|сгущ|конфет|десерт|батончик/i], ["drink", /чай|кофе|кола|сок|напит|латте|капучино/i],
  ];
  const CATS = ["dish", "soup", "dough", "meat", "fish", "egg", "milk", "bread", "grain", "fruit", "veg", "nut", "sweet", "drink", "fast", "shaker"];
  const catOf = (n, c) => (c && CATS.includes(c) ? c : (CAT_RULES.find(([, re]) => re.test(n)) || ["dish"])[0]);
  function tint(e) { const p = (e.p || 0) * 4, c = (e.c || 0) * 4, f = (e.f || 0) * 9; if (!p && !c && !f) return "t-n"; const m = Math.max(p, c, f); return m === p ? "t-pro" : m === f ? "t-fat" : "t-carb"; }
  const ficHTML = (e, cls = "") => (e.img ? `<span class="fic ${cls}"><img src="${e.img}" alt=""></span>` : "");

  // ---------- state ----------
  const KEY = "porsiya.v1";
  const defaults = () => ({
    v: 2, onboarded: false,
    profile: { name: "", avatar: "", sex: "m", age: 26, height: 175, weight: 72, goal: "gain", train: { n: 3, min: 60, type: "strength" }, steps: 0, manual: { on: false, k: 0, p: 0, f: 0, c: 0 } },
    days: {}, weights: {}, my: [], combos: [], recent: [],
    settings: { theme: "auto", key: "", model: "gemini-flash-latest", carry: false },
  });
  let S = defaults();
  function migrate(d) {
    const out = Object.assign(defaults(), d);
    out.profile = Object.assign(defaults().profile, d.profile || {});
    out.profile.manual = Object.assign(defaults().profile.manual, (d.profile || {}).manual || {});
    if (!d.profile || !d.profile.train) {
      const a = d.profile && typeof d.profile.activity === "number" ? d.profile.activity : 2;
      out.profile.train = { n: [0, 2, 3, 5][a] || 3, min: 60, type: "strength" };
    }
    out.settings = Object.assign(defaults().settings, d.settings || {});
    ["my", "combos", "recent"].forEach((k) => { if (!Array.isArray(out[k])) out[k] = []; });
    out.v = 2;
    return out;
  }
  function load() { try { const raw = localStorage.getItem(KEY); S = raw ? migrate(JSON.parse(raw)) : defaults(); } catch (e) { S = defaults(); } }
  let saveT = 0;
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { try { pruneThumbs(); localStorage.setItem(KEY, JSON.stringify(S)); } catch (e2) {} }
    clearTimeout(saveT); saveT = setTimeout(cloudPush, 1200);
  }
  function pruneThumbs() { const keys = Object.keys(S.days).sort(); for (const k of keys.slice(0, Math.max(0, keys.length - 7))) S.days[k].forEach((e) => delete e.img); }

  // Telegram CloudStorage: резервная копия без фото
  const CS = inTg && tg.CloudStorage && tg.isVersionAtLeast && tg.isVersionAtLeast("6.9") ? tg.CloudStorage : null;
  function cloudPush() {
    if (!CS) return;
    try {
      const lite = JSON.parse(JSON.stringify(S));
      Object.values(lite.days).forEach((arr) => arr.forEach((e) => delete e.img));
      delete lite.profile.avatar;
      const str = JSON.stringify(lite); const parts = Math.ceil(str.length / 4000);
      if (parts > 60) return;
      for (let i = 0; i < parts; i++) CS.setItem("p" + i, str.slice(i * 4000, (i + 1) * 4000));
      CS.setItem("pn", String(parts));
    } catch (e) {}
  }
  function cloudPull(done) {
    if (!CS) return done();
    let fin = false; const end = () => { if (!fin) { fin = true; done(); } };
    setTimeout(end, 1500);
    try {
      CS.getItem("pn", (err, n) => {
        n = parseInt(n, 10); if (err || !n) return end();
        const keys = Array.from({ length: n }, (_, i) => "p" + i);
        CS.getItems(keys, (err2, vals) => {
          try {
            if (!err2 && vals) {
              const d = JSON.parse(keys.map((k) => vals[k] || "").join(""));
              const cnt = (x) => Object.values(x.days || {}).reduce((a, b) => a + b.length, 0);
              if (!S.onboarded || cnt(d) > cnt(S)) {
                const imgs = {}; Object.values(S.days).forEach((arr) => arr.forEach((e) => { if (e.img) imgs[e.id] = e.img; }));
                const ava = S.profile.avatar;
                S = migrate(d); S.profile.avatar = S.profile.avatar || ava;
                Object.values(S.days).forEach((arr) => arr.forEach((e) => { if (imgs[e.id]) e.img = imgs[e.id]; }));
                localStorage.setItem(KEY, JSON.stringify(S));
              }
            }
          } catch (e) {}
          end();
        });
      });
    } catch (e) { end(); }
  }

  // ---------- nutrition math ----------
  const GOALS = {
    lose: { n: "Похудеть", s: "Мягкий дефицит, мышцы сохраняются", i: "down-trend", adj: -0.15, pk: 2.0 },
    keep: { n: "Держать форму", s: "Поддерживать вес и рельеф", i: "equal", adj: 0, pk: 1.8 },
    gain: { n: "Набрать массу", s: "Небольшой профицит для роста мышц", i: "muscle", adj: 0.1, pk: 1.8 },
  };
  const TTYPES = { strength: { n: "Силовые", met: 5 }, cardio: { n: "Кардио", met: 7.5 }, mixed: { n: "Смешанные", met: 6 } };
  function calcNorm(p = S.profile, plan = p === S.profile ? S.plan : null) {
    const bmr = 10 * p.weight + 6.25 * p.height - 5 * p.age + (p.sex === "f" ? -161 : 5);
    const base = bmr * 1.2;
    const t = p.train || { n: 0, min: 0, type: "strength" };
    const train = (t.n * t.min * TTYPES[t.type || "strength"].met * 3.5 * p.weight) / 200 / 7;
    const steps = p.steps > 0 ? Math.max(0, p.steps - 4000) * 0.0005 * p.weight : 0;
    const tdee = base + train + steps;
    const g = GOALS[p.goal];
    let k = tdee * (1 + g.adj);
    if (p.goal === "lose") k = Math.max(k, tdee - 600);
    if (plan) { const adj = planAdj(plan); k = clamp(tdee + adj, tdee * 0.75, tdee * 1.2); }
    k = Math.round(k / 10) * 10;
    const pr = Math.round(p.weight * g.pk);
    const fa = Math.round(Math.max(p.weight * 0.9, (k * 0.25) / 9));
    const ca = Math.max(0, Math.round((k - pr * 4 - fa * 9) / 4));
    return { k, p: pr, f: fa, c: ca, tdee: Math.round(tdee), bmr: Math.round(bmr), train: Math.round(train), steps: Math.round(steps) };
  }
  // ---------- цель по весу ----------
  const PACE = { lose: [0.35, 0.5, 0.75], gain: [0.15, 0.25, 0.4] };
  const PACE_N = ["Спокойно", "Умеренно", "Быстрее"];
  const planKgWeek = (pl) => (pl.start * PACE[pl.type][pl.pace]) / 100;
  const planAdj = (pl) => (pl.type === "lose" ? -1 : 0.75) * (planKgWeek(pl) * 7700) / 7;
  const curWeight = () => { const e = Object.entries(S.weights).sort((a, b) => a[0].localeCompare(b[0])); return e.length ? e[e.length - 1][1] : S.profile.weight; };
  const weightAt = (k) => { const e = Object.entries(S.weights).filter(([d]) => d <= k).sort((a, b) => a[0].localeCompare(b[0])); return e.length ? e[e.length - 1][1] : null; };
  const addMonths = (d, m) => { const x = new Date(d); x.setMonth(x.getMonth() + m); return x; };
  function planInfo(pl = S.plan) {
    if (!pl) return null;
    const sign = pl.type === "lose" ? -1 : 1, total = Math.abs(pl.target - pl.start), kw = planKgWeek(pl);
    const weeks = Math.max(1, total / kw), sd = fromKey(pl.startDate), end = addDays(sd, Math.round(weeks * 7));
    const now = new Date(), wElapsed = Math.max(0, (now - sd) / 6048e5);
    const expected = pl.start + sign * Math.min(total, kw * wElapsed), cur = curWeight();
    const done = clamp((sign * (cur - pl.start)) / (total || 1), 0, 1);
    const diff = sign * (cur - expected);
    const months = Math.max(1, Math.ceil(weeks / 4.345));
    const ms = Array.from({ length: months }, (_, i) => { const d = addMonths(sd, i + 1), exp = pl.start + sign * Math.min(total, kw * ((d - sd) / 6048e5)); const past = d <= now; const w = past ? weightAt(dkey(d)) : null; return { d, exp: r1(exp), past, cur: !past && (i === 0 || addMonths(sd, i) <= now), ok: past && w != null && sign * (w - exp) >= -0.3, w }; });
    return { sign, total, kw, km: kw * 4.345, weeks, end, expected, cur, done, diff, ms, reached: done >= 1 };
  }
  function norm() { const m = S.profile.manual; return m.on ? { k: m.k, p: m.p, f: m.f, c: m.c } : calcNorm(); }
  const dayEntries = (k) => S.days[k] || [];
  const totals = (k) => dayEntries(k).reduce((a, e) => { a.k += e.k; a.p += e.p; a.f += e.f; a.c += e.c; return a; }, { k: 0, p: 0, f: 0, c: 0 });
  const scaleFood = (f, g) => ({ k: (f.k * g) / 100, p: (f.p * g) / 100, f: (f.f * g) / 100, c: (f.c * g) / 100 });
  // баланс недели: сумма (норма − съедено) за прошедшие дни недели с записями
  function weekBalance(k) {
    const d = fromKey(k), mon = monday(d), nm = norm().k;
    let bal = 0, days = 0;
    for (let x = new Date(mon); dkey(x) !== k; x = addDays(x, 1)) { const kk = dkey(x); if (dayEntries(kk).length) { bal += nm - totals(kk).k; days++; } }
    return { bal, days };
  }
  // норма дня с переносом недобора/перебора прошлых дней недели (до 25%)
  function dayNorm(k) { const nm = norm().k; if (!S.settings.carry) return nm; const wb = weekBalance(k); return Math.round(nm + clamp(wb.bal, -nm * 0.25, nm * 0.25)); }
  // серия: дни подряд, в которых есть хотя бы одна запись
  // ---------- серия, заморозки, очки, достижения ----------
  const isLogged = (k) => dayEntries(k).length > 0;
  const isFrozen = (k) => !!(S.game && S.game.frozen && S.game.frozen.includes(k));
  function streakInfo() {
    const tk = todayKey(), today = isLogged(tk);
    let d = today ? new Date() : addDays(new Date(), -1), n = 0, start = null;
    while (isLogged(dkey(d)) || isFrozen(dkey(d))) { if (isLogged(dkey(d))) { n++; start = dkey(d); } d = addDays(d, -1); }
    const keys = Object.keys(S.days).filter(isLogged).concat((S.game && S.game.frozen) || []).sort();
    let best = 0, run = 0, prev = null;
    keys.forEach((k) => { if (k === prev) return; const cont = prev && dkey(addDays(fromKey(prev), 1)) === k; run = cont ? run + (isLogged(k) ? 1 : 0) : (isLogged(k) ? 1 : 0); best = Math.max(best, run); prev = k; });
    return { n, today, risk: !today && n > 0, best: Math.max(best, n), start, freezes: (S.game && S.game.fz) || 0 };
  }
  const MILES = [3, 7, 14, 30, 60, 100];
  function gameInit() {
    if (!S.game) S.game = { fz: 0, frozen: [], fzAward: "", seen: null };
    // заморозка спасает пропущенные дни, если серия была
    const st0 = streakInfo();
    let y = addDays(new Date(), -1), used = 0;
    if (!isLogged(dkey(y)) && !isFrozen(dkey(y))) {
      let back = y, miss = [];
      while (!isLogged(dkey(back)) && !isFrozen(dkey(back)) && miss.length < 3) { miss.push(dkey(back)); back = addDays(back, -1); }
      if ((isLogged(dkey(back)) || isFrozen(dkey(back))) && miss.length <= S.game.fz) { S.game.frozen.push(...miss); S.game.fz -= miss.length; used = miss.length; }
    }
    if (!S.game.seen2) { S.game.seen2 = {}; achList().forEach((t) => (S.game.seen2[t.id] = t.st)); }
    save();
    return used;
  }
  function awardFreeze() {
    const st = streakInfo();
    if (st.n && st.n % 7 === 0 && S.game.fzAward !== st.start + ":" + st.n && S.game.fz < 2) { S.game.fz++; S.game.fzAward = st.start + ":" + st.n; save(); return true; }
    return false;
  }
  function runs(keys, pred) { let best = 0, cur = 0, prev = null; keys.forEach((k) => { const ok = pred(k); const cont = prev && dkey(addDays(fromKey(prev), 1)) === k; cur = ok ? (cont ? cur + 1 : 1) : 0; if (!ok) cur = 0; best = Math.max(best, cur); prev = k; }); return best; }
  function gameStats() {
    const keys = Object.keys(S.days).filter(isLogged).sort(), nm = norm();
    let photos = 0, entries = 0, inNorm = 0, proDays = 0, xp = 0, todayXp = 0, bfDays = 0, fullDays = 0;
    const T = {}; keys.forEach((k) => (T[k] = totals(k)));
    keys.forEach((k) => {
      const t = T[k], arr = S.days[k];
      entries += arr.length; photos += arr.filter((e) => e.src === "photo").length;
      if (Math.abs(t.k - nm.k) <= nm.k * 0.1) inNorm++; if (t.p >= nm.p * 0.95) proDays++;
      if (arr.some((e) => e.meal === "breakfast")) bfDays++;
      if (["breakfast", "lunch", "dinner"].every((m) => arr.some((e) => e.meal === m))) fullDays++;
    });
    const all = []; if (keys.length) for (let d = fromKey(keys[0]); dkey(d) <= todayKey(); d = addDays(d, 1)) all.push(dkey(d));
    const has = (k) => !!T[k];
    const proRun = runs(all, (k) => has(k) && T[k].p >= nm.p * 0.95);
    const carbRun = runs(all, (k) => has(k) && T[k].c >= nm.c * 0.9);
    const fatRun = runs(all, (k) => has(k) && T[k].f <= nm.f * 1.1);
    const noOver = runs(all, (k) => has(k) && T[k].k <= nm.k * 1.1);
    const surplus = runs(all, (k) => has(k) && T[k].k >= nm.k * 0.95);
    const wk = Object.entries(S.weights).sort((a, b) => a[0].localeCompare(b[0]));
    const w0 = S.plan ? S.plan.start : wk.length ? wk[0][1] : S.profile.weight, wc = curWeight();
    const pi = S.plan ? planInfo() : null;
    const earlyDin = keys.filter((k) => S.days[k].some((e) => e.meal === "dinner") && S.days[k].filter((e) => e.meal === "dinner").every((e) => new Date(e.t).getHours() < 20)).length;
    const lightDin = keys.filter((k) => { const d = S.days[k].filter((e) => e.meal === "dinner").reduce((a, e) => a + e.k, 0); return d > 0 && d <= nm.k / 3; }).length;
    const pro2 = keys.filter((k) => T[k].p >= S.profile.weight * 2).length;
    const wks = {}; keys.forEach((k) => { const w = dkey(monday(fromKey(k))); if (Math.abs(T[k].k - nm.k) <= nm.k * 0.1) wks[w] = (wks[w] || 0) + 1; });
    const goodWeeks = Object.values(wks).filter((v) => v >= 5).length;
    return { earlyDin, lightDin, pro2, goodWeeks, own: S.my.length + S.combos.length, days: keys.length, photos, entries, inNorm, proDays, bfDays, fullDays, weights: wk.length, combos: S.combos.length, proRun, carbRun, fatRun, noOver, surplus, lost: Math.max(0, w0 - wc), gained: Math.max(0, wc - w0), planMs: pi ? pi.ms.filter((m) => m.ok).length : 0, planDone: pi && pi.reached ? 1 : 0, todayXp: 0, };
  }
  // бесконечные этапы: дальше ряд продолжается ×1,5
  function tierAt(base, i) { if (i < base.length) return base[i]; let v = base[base.length - 1]; for (let j = base.length; j <= i; j++) v = Math.round((v * 1.5) / (v >= 10 ? 5 : 0.5)) * (v >= 10 ? 5 : 0.5); return v; }
  function track(id, ic, col, t, val, base, desc, unit) {
    let st = 0; while (val >= tierAt(base, st)) st++;
    const prev = st ? tierAt(base, st - 1) : 0, next = tierAt(base, st);
    return { id, ic, col, t, val, st, prev, next, pct: clamp((val - prev) / (next - prev), 0, 1), d: desc(next), unit, done: st > 0 };
  }
  function achList() {
    const g = gameStats(), best = streakInfo().best, mode = S.plan ? S.plan.type : S.profile.goal;
    const n = (v) => (Number.isInteger(v) ? v : dec(v));
    const L = [
      track("streak", "bolt", "pro", "Серия", best, [3, 7, 14, 30, 60, 100], (x) => `Продержись ${x} ${plural(x, "день", "дня", "дней")} подряд`, "дн."),
      track("diary", "cal", "cal", "Дневник", g.days, [3, 10, 30, 60, 120, 240], (x) => `${x} ${plural(x, "день", "дня", "дней")} с записями`, "дн."),
      track("photo", "cam", "cal", "Фотограф", g.photos, [1, 5, 15, 40, 100], (x) => `${x} ${plural(x, "блюдо", "блюда", "блюд")} по фото`, "фото"),
      track("norm", "target", "carb", "В точку", g.inNorm, [1, 5, 15, 30, 60], (x) => `${x} ${plural(x, "день", "дня", "дней")} в норме калорий`, "дн."),
      track("protein", "protein", "pro", "Белок", g.proRun, [2, 5, 10, 20, 40], (x) => `Закрывай белок ${x} ${plural(x, "день", "дня", "дней")} подряд`, "дн."),
      track("meals", "breakfast", "fat", "Режим", g.fullDays, [1, 7, 21, 50, 100], (x) => `${x} ${plural(x, "день", "дня", "дней")} с завтраком, обедом и ужином`, "дн."),
      track("scale", "scale", "fat", "Весы", g.weights, [1, 4, 10, 25, 50], (x) => x === 1 ? "Запиши свой вес в первый раз" : `Записывай вес: всего ${x} раз`, "раз"),
      track("bf", "breakfast", "pro", "Ранняя пташка", g.bfDays, [3, 7, 21, 50, 100], (x) => `${x} ${plural(x, "завтрак", "завтрака", "завтраков")}`, "дн."),
      track("week", "star", "carb", "Идеальная неделя", g.goodWeeks, [1, 2, 4, 8, 16], (x) => `${x} ${plural(x, "неделя", "недели", "недель")}, где 5 дней в норме`, "нед."),
      track("entries", "edit", "fat", "Летописец", g.entries, [10, 50, 150, 300, 600], (x) => `${x} ${plural(x, "запись", "записи", "записей")} еды`, "зап."),
      track("own", "dish", "pro", "Своя кухня", g.own, [1, 3, 7, 15, 30], (x) => `${x} ${plural(x, "своё блюдо", "своих блюда", "своих блюд")} или набор`, "шт."),
    ];
    const G = mode === "lose" ? [
      track("minus", "down-trend", "carb", "Минус", r1(g.lost), [1, 2, 3, 5, 8, 12], (x) => `Сбрось ${n(x)} кг`, "кг"),
      track("calm", "check", "carb", "Без срывов", g.noOver, [3, 7, 14, 30, 60], (x) => `${x} ${plural(x, "день", "дня", "дней")} подряд без перебора`, "дн."),
      track("fat", "fat", "fat", "Жиры в норме", g.fatRun, [3, 7, 14, 30], (x) => `Держи жиры в норме ${x} ${plural(x, "день", "дня", "дней")} подряд`, "дн."),
    ] : mode === "gain" ? [
      track("plus", "muscle", "carb", "Плюс", r1(g.gained), [0.5, 1, 2, 3, 5, 8], (x) => `Набери ${n(x)} кг`, "кг"),
      track("surplus", "flame", "pro", "Профицит", g.surplus, [3, 7, 14, 30, 60], (x) => `Добирай калории ${x} ${plural(x, "день", "дня", "дней")} подряд`, "дн."),
      track("carbs", "carbs", "carb", "Углеводы", g.carbRun, [3, 7, 14, 30], (x) => `Закрывай углеводы ${x} ${plural(x, "день", "дня", "дней")} подряд`, "дн."),
      track("pro2", "dumbbell", "pro", "Строитель", g.pro2, [3, 7, 14, 30, 60], (x) => `${x} ${plural(x, "день", "дня", "дней")} с белком 2 г на кг веса`, "дн."),
    ] : [
      track("calm", "check", "carb", "Баланс", g.noOver, [3, 7, 14, 30, 60], (x) => `${x} ${plural(x, "день", "дня", "дней")} подряд без перебора`, "дн."),
    ];
    if (S.plan) G.push(track("stage", "flag", "carb", "Этапы цели", g.planMs, [1, 2, 3, 6, 12], (x) => `Пройди ${x} ${plural(x, "месячный этап", "месячных этапа", "месячных этапов")}`, "эт."));
    L.common = L.slice(); L.goal = G; L.mode = mode;
    const all = L.concat(G); all.common = L; all.goal = G; all.mode = mode;
    return all;
  }
  function gameLevel(A) { const st = A.reduce((a, t) => a + t.st, 0); const lv = 1 + Math.floor(st / 3); return { lv, st, inLv: st % 3, need: 3 }; }
  function checkAch() {
    if (!S.game) return null;
    const A = achList();
    if (!S.game.seen2) { S.game.seen2 = {}; A.forEach((t) => (S.game.seen2[t.id] = t.st)); save(); return null; }
    const up = A.find((t) => t.st > (S.game.seen2[t.id] || 0));
    A.forEach((t) => (S.game.seen2[t.id] = Math.max(t.st, S.game.seen2[t.id] || 0))); save();
    if (!up) return null;
    return { ic: up.ic, t: `${up.t} · этап ${up.st}`, d: `Следующий этап: ${up.d.charAt(0).toLowerCase() + up.d.slice(1)}` };
  }
  const status = (k) => { const n = dayEntries(k).length; if (!n) return ""; const v = totals(k).k, nm = norm().k; if (v > nm * 1.1) return "ov"; if (v >= nm * 0.9) return "in"; return "un"; };

  // ---------- numbers ----------
  const lastVals = new Map();
  let quiet = false;
  function countUp(el, to, opts = {}) {
    if (!el) return;
    if (quiet && !opts.force) { if (opts.key) lastVals.set(opts.key, to); el._cu = null; el.textContent = opts.dec ? dec(to) : (opts.sign ? fmtS(to) : fmt(to)); return; }
    const key = opts.key;
    const from = key && lastVals.has(key) ? lastVals.get(key) : (opts.from != null ? opts.from : 0);
    if (key) lastVals.set(key, to);
    const show = (v) => { el.textContent = opts.dec ? dec(v) : (opts.sign ? fmtS(v) : fmt(v)); };
    if (reduced || from === to) { show(to); return; }
    const dur = opts.dur || 850, t0 = performance.now(), ease = (t) => 1 - Math.pow(1 - t, 3.2);
    const tok = {}; el._cu = tok;
    (function step(t) { if (el._cu !== tok) return; const p = clamp((t - t0) / dur, 0, 1); show(from + (to - from) * ease(p)); if (p < 1) requestAnimationFrame(step); })(t0);
  }
  // ряд точек прогресса
  function dotRow(n, cls = "") { return `<div class="drow ${cls}">${Array.from({ length: n }, (_, i) => `<i style="transition-delay:${(i * 0.018).toFixed(3)}s"></i>`).join("")}</div>`; }
  function setDots(row, v, max, opts = {}) {
    if (!row) return;
    const dots = $$("i", row), n = dots.length;
    const on = max ? Math.round(clamp(v / max, 0, 1) * n) : 0;
    const ov = opts.over && max && v > max ? Math.round(clamp((v - max) / max, 0, 1) * n) : 0;
    dots.forEach((d, i) => { d.classList.toggle("on", i < on && !(ov > 0 && i >= n - ov)); d.classList.toggle("ov", ov > 0 && i >= n - ov); });
  }

  // ---------- theme ----------
  function applyTheme(animate) {
    let t = S.settings.theme;
    if (t === "auto") t = (inTg && tg.colorScheme) || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const root = document.documentElement;
    if (animate && root.dataset.theme !== t && document.startViewTransition && !reduced) { document.startViewTransition(() => { root.dataset.theme = t; }); }
    else root.dataset.theme = t;
    const bg = t === "dark" ? "#0E0E14" : "#F3F3F5";
    const mt = $('meta[name="theme-color"]'); if (mt) mt.setAttribute("content", bg);
    if (inTg) { try { tg.setHeaderColor(bg); tg.setBackgroundColor(bg); if (tg.setBottomBarColor) tg.setBottomBarColor(bg); } catch (e) {} }
  }
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (S.settings.theme === "auto") applyTheme(true); });

  // ---------- toast ----------
  let toastT;
  function toast(text, undo, ic) {
    const t = $("#toast");
    t.innerHTML = `<span class="tic ${ic ? "tic-" + ic : ""}">${icon(ic || "check")}</span><span class="tx">${esc(text)}</span>${undo ? '<button id="t-undo">Отменить</button>' : ""}`;
    t.classList.add("show"); clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove("show"), undo ? 4500 : 2300);
    if (undo) $("#t-undo").onclick = () => { undo(); t.classList.remove("show"); haptic("light"); };
  }

  // ---------- routing ----------
  let cur = null;
  let selDay = todayKey();
  const TABS = ["today", "history", "calendar", "profile"];
  function show(id, opts = {}) {
    if (cur === id && !opts.force) return;
    const prev = cur ? $("#s-" + cur) : null;
    cur = id;
    if (prev) prev.classList.remove("active");
    window.scrollTo(0, 0);
    const next = $("#s-" + id);
    quiet = seenScr.has(id) && !opts.force; seenScr.add(id);
    next.classList.toggle("quiet", quiet);
    next.classList.remove("active"); void next.offsetWidth; next.classList.add("active");
    $("#tabbar").classList.toggle("hide", id === "onboard");
    $$(".tab").forEach((b) => b.classList.toggle("on", b.dataset.tab === id));
    const ti = TABS.indexOf(id); if (ti > -1) $("#navp").style.setProperty("--i", ti);
    if (id === "today") { if ($("#v-k") && builtDay === todayKey() && !opts.force) { renderWeek(); updateToday(); } else buildToday(); }
    if (id === "history") renderHistory();
    if (id === "calendar") renderCalendar();
    if (id === "profile") renderProfile();
    if (quiet) raf2(() => { next.classList.remove("quiet"); quiet = false; }); else quiet = false;
    updateBack();
  }
  const seenScr = new Set();
  function updateBack() { if (!inTg) return; try { if (sheetOpen || (cur !== "today" && cur !== "onboard")) tg.BackButton.show(); else tg.BackButton.hide(); } catch (e) {} }
  function goBack() { if (sheetOpen) { if (sheetBack) sheetBack(); else closeSheet(); return; } if (TABS.includes(cur) && cur !== "today") show("today"); }

  // ---------- sheet ----------
  let sheetOpen = false, sheetBack = null, onSheetClose = null;
  function measureHead() { const h = $("#sheet .sh-head"); if (h) $("#sheet").style.setProperty("--hh", h.offsetHeight + "px"); }
  window.addEventListener("resize", measureHead);
  function sheetFoot(html) { const f = $("#sh-foot"); f.innerHTML = html || ""; f.style.display = html ? "" : "none"; }
  function setBack(fn) { sheetBack = fn || null; $("#sheet").classList.toggle("has-back", !!fn); }
  function openSheet(title, body, foot = "", opts = {}) {
    $("#sh-title").textContent = title;
    const b = $("#sh-body"); b.className = "sh-body"; b.innerHTML = body; b.scrollTop = 0;
    sheetFoot(foot); setBack(opts.back);
    onSheetClose = opts.onClose || null;
    measureHead();
    if (!sheetOpen) {
      sheetOpen = true;
      $("#scrim").classList.add("open"); $("#sheet").classList.add("open");
      $("#tabbar").classList.add("hide");
      document.body.style.overflow = "hidden";
      haptic("light");
    }
    updateBack();
  }
  function setSheet(title, body, foot = "", back = null, dir = 1) {
    const b = $("#sh-body");
    $("#sh-title").textContent = title;
    b.className = "sh-body"; void b.offsetWidth; b.classList.add(dir > 0 ? "swap" : "swap-back");
    b.innerHTML = body; b.scrollTop = 0;
    sheetFoot(foot); setBack(back);
  }
  function closeSheet() {
    if (!sheetOpen) return;
    sheetOpen = false; setBack(null);
    $("#scrim").classList.remove("open"); $("#sheet").classList.remove("open"); $("#sheet").style.transform = "";
    if (cur !== "onboard") $("#tabbar").classList.remove("hide");
    document.body.style.overflow = "";
    const cb = onSheetClose; onSheetClose = null; if (cb) cb();
    if (cur === "today") updateToday();
    updateBack();
  }
  function sheetFades() { const b = $("#sh-body"); $("#sheet").classList.toggle("scrolled", b.scrollTop > 2); const rest = b.scrollHeight - b.clientHeight - b.scrollTop; $("#sheet").classList.toggle("more", rest > 2 && !!$("#sh-foot").innerHTML); }
  $("#sh-body").addEventListener("scroll", sheetFades, { passive: true });
  new MutationObserver(() => requestAnimationFrame(sheetFades)).observe($("#sh-body"), { childList: true });
  $("#scrim").addEventListener("click", closeSheet);
  $("#sh-close").addEventListener("click", closeSheet);
  $("#sh-back").addEventListener("click", () => { if (sheetBack) { haptic("light"); sheetBack(); } });
  (function () { // перетаскивание окна вниз
    const sh = $("#sheet"), scrim = $("#scrim"), body = $("#sh-body");
    let y0 = null, t0 = 0, dy = 0, decided = false, drag = false, raf = 0, lastY = 0, lastT = 0, vel = 0;
    const apply = () => { raf = 0; const d = Math.max(0, dy); sh.style.transform = `translate3d(0,${d}px,0)`; scrim.style.opacity = String(Math.max(0, 1 - d / (sh.offsetHeight * 0.9))); };
    sh.addEventListener("touchstart", (e) => {
      if (e.target.closest("input,textarea,.stepper,.chips.scroll,input[type=range],.week")) { y0 = null; return; }
      y0 = lastY = e.touches[0].clientY; t0 = lastT = performance.now(); dy = 0; vel = 0; decided = false; drag = false;
    }, { passive: true });
    sh.addEventListener("touchmove", (e) => {
      if (y0 == null) return;
      const y = e.touches[0].clientY, now = performance.now(); dy = y - y0;
      if (!decided) { if (Math.abs(dy) < 6) return; decided = true; drag = dy > 0 && (!body.contains(e.target) || body.scrollTop <= 0); if (drag) { sh.style.transition = "none"; scrim.style.transition = "none"; y0 = y; dy = 0; } }
      if (!drag) return;
      e.preventDefault();
      vel = (y - lastY) / Math.max(1, now - lastT); lastY = y; lastT = now;
      if (!raf) raf = requestAnimationFrame(apply);
    }, { passive: false });
    const end = () => {
      if (y0 == null) return; y0 = null;
      if (!drag) return; drag = false; if (raf) { cancelAnimationFrame(raf); raf = 0; }
      sh.style.transition = ""; scrim.style.transition = "";
      if (dy > sh.offsetHeight * 0.28 || (vel > 0.45 && dy > 30)) { scrim.style.opacity = ""; closeSheet(); }
      else { sh.style.transform = ""; scrim.style.opacity = ""; }
    };
    sh.addEventListener("touchend", end); sh.addEventListener("touchcancel", end);
  })();

  // segmented control
  const segHTML = (name, items, val, cls = "") => `<div class="seg ${cls}" data-seg="${name}"><span class="knob"></span>${items.map(([v, l]) => `<button data-v="${v}" class="${v === val ? "on" : ""}">${l}</button>`).join("")}</div>`;
  function placeKnob(seg, animate = true) {
    const on = $(".on", seg) || $("button", seg), k = $(".knob", seg); if (!on || !k) return;
    if (!animate) k.style.transition = "none";
    k.style.width = on.offsetWidth + "px"; k.style.transform = `translateX(${on.offsetLeft}px)`;
    if (!animate) { void k.offsetWidth; k.style.transition = ""; }
  }
  function bindSeg(root, name, cb) {
    const seg = $(`[data-seg="${name}"]`, root); if (!seg) return;
    placeKnob(seg, false); requestAnimationFrame(() => placeKnob(seg, false));
    seg.addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b || b.classList.contains("on")) return;
      $$("button", seg).forEach((x) => x.classList.toggle("on", x === b)); placeKnob(seg); haptic("sel"); cb(b.dataset.v);
    });
  }
  window.addEventListener("resize", () => { $$(".seg").forEach((s) => placeKnob(s, false)); placePill(false); });

  // stepper
  const STEP_FMT = {};
  function stepperHTML(field, val, unit, step = 1, cls = "") {
    const show = STEP_FMT[field] ? STEP_FMT[field](val) : dec(val);
    return `<div class="stepper ${cls}" data-step="${field}" data-inc="${step}" data-unit="${unit}"><button data-d="-1" aria-label="Меньше">${icon("minus")}</button><span class="val"><span data-v>${show}</span>${unit ? " " + unit : ""}</span><button data-d="1" aria-label="Больше">${icon("plus")}</button></div>`;
  }
  function bindSteppers(root, obj, limits, onChange) {
    $$("[data-step]", root).forEach((st) => {
      const f = st.dataset.step, inc = parseFloat(st.dataset.inc) || 1;
      const [mn, mx] = limits[f] || [0, 99999];
      const out = $("[data-v]", st);
      const show = () => { out.textContent = STEP_FMT[f] ? STEP_FMT[f](obj[f]) : dec(obj[f]); };
      let hold, rep;
      const bump = (dir) => { const nv = clamp(Math.round((obj[f] + dir * inc) * 10) / 10, mn, mx); if (nv === obj[f]) return; obj[f] = nv; show(); haptic("sel"); onChange && onChange(f, obj[f]); };
      $$("button", st).forEach((b) => {
        const dir = +b.dataset.d;
        const start = (e) => { e.preventDefault(); bump(dir); hold = setTimeout(() => { rep = setInterval(() => bump(dir), 70); }, 380); };
        const stop = () => { clearTimeout(hold); clearInterval(rep); };
        b.addEventListener("pointerdown", start);
        ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => b.addEventListener(ev, stop));
      });
      const val = $(".val", st);
      val.addEventListener("click", () => {
        if ($("input", val)) return;
        const inp = document.createElement("input");
        inp.type = "text"; inp.inputMode = inc < 1 ? "decimal" : "numeric"; inp.value = String(obj[f]).replace(".", ","); inp.className = "val-in";
        out.style.display = "none"; val.prepend(inp); inp.focus(); inp.select();
        const commit = () => { const n = parseFloat(inp.value.replace(",", ".").replace(/\s/g, "")); if (!isNaN(n)) { obj[f] = clamp(Math.round(n * 10) / 10, mn, mx); onChange && onChange(f, obj[f]); } show(); inp.remove(); out.style.display = ""; };
        inp.addEventListener("blur", commit); inp.addEventListener("keydown", (e) => { if (e.key === "Enter") inp.blur(); });
      });
    });
  }
  function setRangeFill(r) { const p = ((r.value - r.min) / (r.max - r.min)) * 100; r.style.setProperty("--p", p + "%"); }

  // ---------- greeting, avatar ----------
  function greet() {
    const h = new Date().getHours(), n = S.profile.name ? ", " + S.profile.name : "";
    if (h >= 5 && h < 12) return "Доброе утро" + n; if (h >= 12 && h < 17) return "Добрый день" + n; if (h >= 17 && h < 23) return "Добрый вечер" + n; return "Доброй ночи" + n;
  }
  function avatarInner() {
    if (S.profile.avatar) return `<img src="${S.profile.avatar}" alt="">`;
    const u = inTg && tg.initDataUnsafe && tg.initDataUnsafe.user;
    if (u && u.photo_url) return `<img src="${esc(u.photo_url)}" alt="">`;
    return esc((S.profile.name || "П").slice(0, 1).toUpperCase());
  }
  const macroTags = (v, noK) => `${noK ? "" : `<span class="mtag k">${fmt(v.k)} ккал</span>`}<span class="mtag p">Б ${r0(v.p)} г</span><span class="mtag f">Ж ${r0(v.f)} г</span><span class="mtag c">У ${r0(v.c)} г</span>`;

  // =====================================================================
  // ONBOARDING
  // =====================================================================
  let ob = { step: 0, d: null };
  const OB_STEPS = 4;
  STEP_FMT.steps = (v) => (v ? fmt(v) : "не знаю");
  function startOnboarding() {
    const u = inTg && tg.initDataUnsafe && tg.initDataUnsafe.user;
    ob = { step: 0, d: JSON.parse(JSON.stringify(S.profile)) };
    if (!S.onboarded) ob.d.goal = null;
    if (!ob.d.name && u && u.first_name) ob.d.name = u.first_name;
    show("onboard", { force: true }); renderOb();
  }
  const optHTML = (attr, v, on, ic, t, s) => `<button class="opt ${on ? "on" : ""}" data-${attr}="${v}"><span class="oi">${icon(ic)}</span><span><b>${t}</b><span class="os">${s}</span></span><span class="rad">${icon("check")}</span></button>`;
  function renderOb() {
    const s = $("#s-onboard"), d = ob.d, st = ob.step;
    const Q = [
      { h: "Какая у тебя цель?", p: "От неё зависит норма калорий. Поменять можно в любой момент." },
      { h: "Немного о тебе", p: "Пол и возраст нужны для расчёта обмена веществ." },
      { h: "Рост и вес", p: "Вес потом можно отмечать в истории, норма пересчитается сама." },
      { h: "Тренировки и шаги", p: "Чем точнее, тем точнее норма. Шаги указывать не обязательно." },
    ];
    let body = "";
    if (st === 0) body = Object.entries(GOALS).map(([k, g]) => optHTML("goal", k, d.goal === k, g.i, g.n, g.s)).join("");
    else if (st === 1) body = `<label class="field"><span>Как к тебе обращаться</span><input id="ob-name" maxlength="20" placeholder="Имя" value="${esc(d.name)}"></label>
        <div class="nrow"><span><b>Пол</b><span class="ns">для формулы расчёта</span></span>${segHTML("sex", [["m", "Мужской"], ["f", "Женский"]], d.sex)}</div>
        <div class="nrow"><span><b>Возраст</b><span class="ns">полных лет</span></span>${stepperHTML("age", d.age, "")}</div>`;
    else if (st === 2) body = `<div class="nrow"><span><b>Рост</b><span class="ns">сантиметры</span></span>${stepperHTML("height", d.height, "см")}</div>
        <div class="nrow"><span><b>Вес</b><span class="ns">килограммы</span></span>${stepperHTML("weight", d.weight, "кг", 0.5)}</div>`;
    else body = trainFields(d);
    s.innerHTML = `<div class="ob">
      <div class="ob-prog">${Array.from({ length: OB_STEPS }, (_, i) => `<i class="${i < st ? "done" : ""}"></i>`).join("")}</div>
      <div class="ob-q s${st} fade-sw"><div class="n">Шаг ${st + 1} из ${OB_STEPS}</div><h2>${Q[st].h}</h2><p>${Q[st].p}</p></div>
      <div class="ob-body">${body}</div>
      ${st === 0 ? (S.onboarded ? `<div class="ob-foot"><button class="btn ghost" id="ob-next">Оставить как есть</button></div>` : "") : `<div class="ob-foot"><button class="back" id="ob-back" aria-label="Назад">${icon("back")}</button><button class="btn" id="ob-next">${st === OB_STEPS - 1 ? "Рассчитать норму" : "Далее"}</button></div>`}
    </div>`;
    raf2(() => { const bars = $$(".ob-prog i", s); if (bars[st]) bars[st].classList.add("done"); });
    $$("[data-goal]", s).forEach((b) => (b.onclick = () => {
      if (ob.lock) return; ob.lock = true;
      d.goal = b.dataset.goal; $$("[data-goal]", s).forEach((x) => x.classList.toggle("on", x === b)); haptic("sel");
      setTimeout(() => { ob.lock = false; ob.step = 1; renderOb(); window.scrollTo({ top: 0, behavior: "smooth" }); }, 420);
    }));
    bindSeg(s, "sex", (v) => (d.sex = v));
    bindTrain(s, d);
    bindSteppers(s, d, { age: [14, 90], height: [130, 220], weight: [35, 200] });
    const nm = $("#ob-name", s); if (nm) nm.oninput = () => (d.name = nm.value.trim());
    if ($("#ob-back", s)) $("#ob-back", s).onclick = () => { ob.step--; haptic("light"); renderOb(); };
    if ($("#ob-next", s)) $("#ob-next", s).onclick = () => { haptic("light"); if (ob.step < OB_STEPS - 1) { ob.step++; renderOb(); window.scrollTo({ top: 0, behavior: "smooth" }); } else showObResult(); };
  }
  function trainFields(d) {
    const t = d.train;
    return `<div class="nrow"><span><b>Тренировки</b><span class="ns">раз в неделю</span></span>${stepperHTML("tn", t.n, "")}</div>
      <div class="collapse ${t.n ? "open" : ""}" id="tr-x"><div>
      <div class="nrow" id="tr-more" style="margin-top:10px"><span><b>Длительность</b><span class="ns">одной тренировки</span></span>${stepperHTML("tmin", t.min, "мин", 15)}</div>
      <div class="nrow col" id="tr-type" style="margin-top:10px"><span><b>Тип тренировок</b></span>${segHTML("ttype", [["strength", "Силовые"], ["cardio", "Кардио"], ["mixed", "Смешанные"]], t.type)}</div></div></div>

      <div class="nrow"><span><b>Шаги</b><span class="ns">в день, по желанию</span></span>${stepperHTML("steps", d.steps, "", 1000)}</div>`;
  }
  function bindTrain(root, d) {
    if (!$('[data-step="tn"]', root)) return;
    const proxy = { get tn() { return d.train.n; }, set tn(v) { d.train.n = v; }, get tmin() { return d.train.min; }, set tmin(v) { d.train.min = v; }, get steps() { return d.steps; }, set steps(v) { d.steps = v; } };
    bindSteppers(root, proxy, { tn: [0, 14], tmin: [15, 180], steps: [0, 30000] }, (f) => {
      if (f === "tn") { $("#tr-x", root).classList.toggle("open", d.train.n > 0); const sg = $('[data-seg="ttype"]', root); if (sg) requestAnimationFrame(() => placeKnob(sg, false)); }
    });
    bindSeg(root, "ttype", (v) => (d.train.type = v));
  }
  function showObResult() {
    const n = calcNorm(ob.d), s = $("#s-onboard"), g = GOALS[ob.d.goal || "keep"];
    const parts = [["Белки", n.p, n.p * 4, "pro"], ["Углеводы", n.c, n.c * 4, "carb"], ["Жиры", n.f, n.f * 9, "fat"]];
    const tot = parts.reduce((a, x) => a + x[2], 0), N = 60;
    let acc = 0; const cut = parts.map((x) => (acc += x[2] / tot, Math.round(acc * N)));
    const dots = Array.from({ length: N }, (_, i) => { const k = cut.findIndex((c) => i < c); return `<i class="k-${parts[k][3]}" style="--r:${(i / N) * 360}deg;transition-delay:${(0.15 + i * 0.018).toFixed(3)}s"></i>`; }).join("");
    s.innerHTML = `<div class="ob ob-res">
      <div class="ob-prog">${Array.from({ length: OB_STEPS }, () => `<i class="done"></i>`).join("")}</div>
      <div class="rs-head"><div class="res-goal">${icon(g.i)}${g.n}</div><h2>Твоя норма готова</h2></div>
      <div class="dring" id="dring">${dots}<div class="dr-c"><div class="num" id="ob-kc">0</div><span>ккал в день</span></div></div>
      <div class="res-legend">${parts.map((x, i) => `<div style="animation-delay:${1.1 + i * 0.1}s"><i class="k-${x[3]}"></i><span>${x[0]}</span><b class="num">${x[1]} г</b><em>${Math.round((x[2] / tot) * 100)}%</em></div>`).join("")}</div>
      <p class="note res-note">Расход около ${fmt(n.tdee)} ккал в день: обмен веществ ${fmt(n.bmr)}${n.train ? ", тренировки " + fmt(n.train) : ""}${n.steps ? ", шаги " + fmt(n.steps) : ""}. Норму можно поправить в профиле.</p>
      <div style="flex:1"></div>
      <div class="ob-foot"><button class="back" id="ob-back" aria-label="Назад">${icon("back")}</button><button class="btn" id="ob-done">Начать</button></div>
    </div>`;
    raf2(() => $("#dring").classList.add("on"));
    setTimeout(() => countUp($("#ob-kc"), n.k, { from: 0, dur: 1400, force: true }), 250);
    haptic("ok");
    $("#ob-back").onclick = () => { ob.step = OB_STEPS - 1; renderOb(); };
    $("#ob-done").onclick = () => {
      const first = !S.onboarded;
      S.profile = Object.assign(S.profile, ob.d);
      if (first) S.weights[todayKey()] = ob.d.weight;
      S.onboarded = true; save(); gameInit(); haptic("ok"); lastVals.clear(); show("today", { force: true });
    };
  }

  // =====================================================================
  // TODAY
  // =====================================================================
  let weekAnchor = null;
  let builtDay = null;
  function buildToday() {
    builtDay = todayKey();
    const s = $("#s-today");
    const now = new Date();
    s.innerHTML = `
      <div class="top"><div><h1>${now.getDate()} ${MON[now.getMonth()]}</h1><div class="date">${cap(WDF[now.getDay()])}</div></div><div class="top-r"><button class="streak" id="t-streak" aria-label="Серия"></button><button class="avatar" id="t-ava" aria-label="Профиль">${avatarInner()}</button></div></div>
      <div class="wk-head"><button class="wk-month" id="wk-month"><span id="wk-mt"></span>${icon("right")}</button><button class="wk-today" id="wk-today">${icon("refresh")}Сегодня</button></div>
      <div class="week" id="week"></div>
      <div class="gap"></div>
      <div class="grad g-cal tap" id="c-cal" role="button">
        <div class="c-head"><span class="c-title"><span class="ic">${icon("flame")}</span>Калории</span><span class="chip" id="cal-chip"></span></div>
        <div class="big"><span class="num" id="v-k">0</span><span class="of" id="v-kn"></span></div>
        ${dotRow(24, "anim")}
        <div class="stats3 two"><div><span>Осталось</span><b class="num" id="v-left">0</b></div><div><span>Запас недели</span><b class="num" id="v-week">0</b></div></div>
      </div>
      <div class="gap"></div>
      <div id="t-goal"></div>
      <div class="row2">
        ${macroCard("pro", "Белки", "protein", "p")}
        ${macroCard("carb", "Углеводы", "carbs", "c")}
      </div>
      <div class="gap"></div>
      <div class="grad g-fat tap" id="c-f" role="button">
        <div class="c-head"><span class="c-title"><span class="ic">${icon("fat")}</span>Жиры</span>${icon("right", "chev")}</div>
        <div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px"><div class="mid"><span class="num" id="v-f">0</span><span class="u">г</span></div><div class="sub" id="s-f"></div></div>
        ${dotRow(24, "anim")}
      </div>
      <div id="t-ins"></div>
      <div class="section-h"><h2 id="m-title">Приёмы пищи</h2><span class="muted" id="m-sum"></span></div>
      <div id="meals"></div>`;
    $("#t-ava").onclick = () => show("profile");
    $("#t-streak").onclick = streakSheet;
    $("#wk-month").onclick = () => { haptic("light"); const d = weekAnchor || fromKey(selDay); calMonth = new Date(d.getFullYear(), d.getMonth(), 1); calSel = selDay; show("calendar"); };
    $("#wk-today").onclick = () => { haptic("light"); selectDay(todayKey()); };
    $("#c-cal").onclick = () => openCalDetail();
    $("#c-p").onclick = () => openMacroDetail("p");
    $("#c-c").onclick = () => openMacroDetail("c");
    $("#c-f").onclick = () => openMacroDetail("f");
    renderWeek();
    updateToday(true);
  }
  function macroCard(kind, label, ic, key) {
    return `<div class="grad g-${kind} tap" id="c-${key}" role="button">
      <div class="c-head"><span class="c-title"><span class="ic">${icon(ic)}</span>${label}</span></div>
      <div class="mid"><span class="num" id="v-${key}">0</span><span class="u">г</span></div>
      <div class="sub" id="s-${key}"></div>
      ${dotRow(12, "anim sm")}
    </div>`;
  }
  function updateToday(first) {
    if (cur !== "today" || !$("#v-k")) return;
    const nm = norm(), t = totals(selDay), kN = dayNorm(selDay), left = kN - t.k, pct = kN ? Math.round((t.k / kN) * 100) : 0;
    const isToday = selDay === todayKey();
    setMonthLabel(weekAnchor || fromKey(selDay));
    const st = streakInfo(), sp = $("#t-streak");
    sp.className = "streak" + (st.today ? " on" : st.risk ? " risk" : "") + (sp.classList.contains("bump") ? " bump" : "");
    sp.innerHTML = `${icon("bolt")}<span class="num">${st.n}</span>`; updBadge();
    $("#wk-today").classList.toggle("show", !isToday);
    $("#cal-chip").textContent = t.k ? pct + "% нормы" : "Норма " + fmt(kN);
    $("#v-kn").textContent = "из " + fmt(kN) + " ккал";
    countUp($("#v-k"), r0(t.k), { key: "k" });
    const lb = $("#v-left"); countUp(lb, left >= 0 ? r0(left) : r0(-left), { key: "left" }); lb.previousElementSibling.textContent = left >= 0 ? "Осталось" : "Сверх нормы";
    const wb = weekBalance(selDay);
    const wl = $("#v-week").previousElementSibling;
    if (S.settings.carry && wb.days) { wl.textContent = "Перенос недели"; countUp($("#v-week"), kN - nm.k, { key: "wk", sign: true }); }
    else if (wb.days) { wl.textContent = wb.bal >= 0 ? "Запас недели" : "Перебор недели"; countUp($("#v-week"), r0(Math.abs(wb.bal)), { key: "wk" }); }
    else { wl.textContent = "Запас недели"; $("#v-week").textContent = "—"; lastVals.delete("wk"); }
    ["p", "c", "f"].forEach((k) => {
      countUp($("#v-" + k), r0(t[k]), { key: k });
      const rest = r0(nm[k] - t[k]);
      $("#s-" + k).textContent = rest > 0 ? `из ${nm[k]} г` : "норма закрыта";
    });
    setDots($("#c-cal .drow"), t.k, kN, { over: true });
    updWater(); renderTodayGoal();
    const av = $("#t-ava"), ai = avatarInner(); if (av && av._ai !== ai) { av.innerHTML = ai; av._ai = ai; }
    setDots($("#c-p .drow"), t.p, nm.p); setDots($("#c-c .drow"), t.c, nm.c); setDots($("#c-f .drow"), t.f, nm.f);
    if (first) raf2(() => $$("#s-today .drow").forEach((r) => r.classList.add("go")));
    $("#t-ins").innerHTML = insightHTML(t, Object.assign({}, nm, { k: kN }), isToday);
    const ib = $("#ins-btn"); if (ib) ib.onclick = () => { const f = window.FOODS.find((x) => x.n === ib.dataset.f); openAdd("search"); portion(Object.assign({}, f), null, +ib.dataset.g); };
    $("#m-title").textContent = isToday ? "Приёмы пищи" : "Приёмы пищи · " + dayLabel(selDay).toLowerCase();
    $("#m-sum").textContent = dayEntries(selDay).length ? fmt(t.k) + " ккал" : "";
    renderMeals();
  }
  function setMonthLabel(d) { const el = $("#wk-mt"); if (el) { const m = addDays(monday(d), 3); el.textContent = cap(MONN[m.getMonth()]) + " " + m.getFullYear(); } }
  function selectDay(k) {
    if (k === selDay) return;
    selDay = k; weekAnchor = fromKey(k);
    const w = $("#week"); const inWeek = w && $(`.day[data-k="${k}"]`, w);
    if (inWeek) { $$(".day", w).forEach((x) => x.classList.toggle("sel", x.dataset.k === k)); placePill(true); } else renderWeek();
    updateToday();
  }
  function renderWeek() {
    const w = $("#week"); if (!w) return;
    const sd = fromKey(selDay); if (!weekAnchor) weekAnchor = sd;
    const base = monday(weekAnchor), tk = todayKey(), now = new Date();
    let html = `<span class="pill" id="wpill"></span>`;
    for (let i = 0; i < 7; i++) {
      const d = addDays(base, i), k = dkey(d), fut = d > now && k !== tk, st = status(k);
      html += `<button class="day ${k === tk ? "today" : ""} ${k === selDay ? "sel" : ""} ${st ? "has st-" + st : ""}" data-k="${k}" ${fut ? "disabled" : ""}><span class="wd">${WD[d.getDay()]}</span><span class="dn">${d.getDate()}</span><span class="mark"></span></button>`;
    }
    w.innerHTML = html; placePill(false);
    w.onclick = (e) => { const b = e.target.closest(".day"); if (!b || b.disabled) return; haptic("sel"); selectDay(b.dataset.k); };
    let x0 = null;
    w.ontouchstart = (e) => { x0 = e.touches[0].clientX; };
    w.ontouchend = (e) => {
      if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) < 50) return;
      const nb = addDays(base, dx < 0 ? 7 : -7); if (nb > new Date()) return;
      weekAnchor = nb; haptic("light");
      w.style.transition = "none"; w.style.opacity = "0"; w.style.transform = `translateX(${dx < 0 ? 20 : -20}px)`;
      renderWeek();
      requestAnimationFrame(() => { w.style.transition = "opacity .35s var(--ease), transform .5s var(--ease-out)"; w.style.opacity = "1"; w.style.transform = "none"; });
      setMonthLabel(nb);
      $("#wk-today").classList.toggle("show", selDay !== todayKey() || !$(`.day[data-k="${todayKey()}"]`, w));
    };
  }
  function placePill(anim) {
    const w = $("#week"), p = $("#wpill"); if (!w || !p) return;
    const sel = $(".day.sel", w);
    if (!sel) { p.style.opacity = "0"; return; }
    p.style.opacity = "1";
    if (!anim) p.style.transition = "none";
    p.style.width = sel.offsetWidth + "px"; p.style.transform = `translateX(${sel.offsetLeft}px)`;
    if (!anim) { void p.offsetWidth; p.style.transition = ""; }
  }

  // ---------- insight ----------
  const PRO_FOODS = ["Куриная грудка варёная", "Творог 5%", "Греческий йогурт", "Протеиновый коктейль (молочный)", "Яйцо варёное", "Тунец консервированный"];
  function insightHTML(t, nm, isToday) {
    if (!dayEntries(selDay).length) return "";
    const h = new Date().getHours(), kLeft = nm.k - t.k, pLeft = nm.p - t.p;
    const wb = weekBalance(selDay);
    let ic = "bulb", col = "cal", title = "", text = "", btn = "";
    if (t.k > nm.k * 1.1) {
      col = "pro"; ic = "flame"; title = "Сверх нормы на " + fmt(t.k - nm.k) + " ккал";
      text = wb.days && wb.bal > 0 ? `С учётом недели всё в порядке: до этого дня ты недобрал ${fmt(wb.bal)} ккал.` : "На результат влияет средний показатель за неделю. Завтра просто держись нормы.";
    } else if (isToday && pLeft > 20) {
      const opts = PRO_FOODS.map((n) => window.FOODS.find((x) => x.n === n)).filter(Boolean).map((f) => { const g = Math.round(clamp((pLeft / f.p) * 100, 60, 250) / 10) * 10; return { f, g, v: scaleFood(f, g) }; })
        .filter((o) => o.v.k <= Math.max(kLeft, 200)).sort((a, b) => b.v.p / b.v.k - a.v.p / a.v.k);
      const o = opts[new Date().getDate() % Math.max(1, Math.min(3, opts.length))] || opts[0];
      col = "pro"; ic = "protein"; title = "Добери " + r0(pLeft) + " г белка";
      text = o ? `${o.f.n}, ${o.g} г: это ${r0(o.v.p)} г белка и ${fmt(o.v.k)} ккал.` : "Добавь к следующему приёму пищи курицу, творог или яйца.";
    } else if (isToday && kLeft > nm.k * 0.35 && h >= 19) {
      col = "carb"; ic = "carbs"; title = "До нормы ещё " + fmt(kLeft) + " ккал";
      text = S.profile.goal === "gain" ? "Для набора массы важно добирать калории. Проще всего: каша на молоке, орехи или банан с арахисовой пастой." : "Если не голоден, не нужно доедать через силу. Главное, чтобы был закрыт белок.";
    } else if (Math.abs(kLeft) <= nm.k * 0.1 && pLeft <= 10) {
      col = "carb"; ic = "check"; title = "Отличный день"; text = "Калории в норме, белок закрыт.";
    } else if (isToday && kLeft > 0) {
      ic = "bulb"; title = "Осталось " + fmt(kLeft) + " ккал";
      const next = h < 11 ? "обед и ужин" : h < 16 ? "ужин и перекус" : "ужин";
      text = `Примерно столько можно съесть на ${next}. Белка осталось ${Math.max(0, r0(pLeft))} г.`;
    } else return "";
    return `<div class="gap"></div><div class="card tip c-${col}"><div class="tip-h"><span class="tip-ic">${icon(ic)}</span><b>${title}</b></div><p>${esc(text)}</p>${btn}</div>`;
  }

  // ---------- meals ----------
  const fresh = new Set();
  function renderMeals() {
    const box = $("#meals"); const list = dayEntries(selDay);
    box.classList.remove("fade-sw"); void box.offsetWidth; box.classList.add("fade-sw");
    if (!list.length) {
      let rep = "";
      if (selDay === todayKey()) {
        const m = mealByTime(), ys = dayEntries(dkey(addDays(new Date(), -1))).filter((e) => e.meal === m);
        if (ys.length) rep = `<button class="btn sm ghost" id="rep-btn">${icon("refresh")}Повторить вчерашний ${meal(m).n.toLowerCase()}</button>`;
      }
      box.innerHTML = `<div class="meal-group"><div class="empty"><div class="em">${icon("dish")}</div><b>${selDay === todayKey() ? "Пока пусто" : "В этот день записей нет"}</b><p>Сфотографируй еду или найди её в базе, калории посчитаются сами.</p>${rep || `<button class="btn sm" id="empty-add">${icon("plus")}Добавить еду</button>`}</div></div>`;
      if ($("#empty-add")) $("#empty-add").onclick = () => { haptic("medium"); openAdd(); };
      if ($("#rep-btn")) $("#rep-btn").onclick = () => {
        const m = mealByTime(), ys = dayEntries(dkey(addDays(new Date(), -1))).filter((e) => e.meal === m);
        addEntries(ys.map((e) => ({ n: e.n, cat: e.cat, g: e.g, k: e.k, p: e.p, f: e.f, c: e.c, img: e.img, src: e.src })), m);
        afterAdd(ys.reduce((a, e) => a + e.k, 0));
      };
      return;
    }
    box.innerHTML = MEALS.map((m) => {
      const items = list.filter((e) => e.meal === m.id).sort((a, b) => a.t - b.t); if (!items.length) return "";
      const sum = items.reduce((a, e) => a + e.k, 0);
      return `<div class="meal-group"><div class="mg-head"><span class="mg-t">${icon(m.i)}<span class="mg-n">${m.n}<em>${fmt(sum)} ккал</em></span></span>${items.length > 1 ? `<button class="mg-save" data-save="${m.id}" aria-label="Сохранить как набор">${icon("star")}</button>` : ""}</div>
        ${items.map((e) => itemHTML(e, fresh.has(e.id))).join("")}</div>`;
    }).join("");
    fresh.clear();
    $$("[data-save]", box).forEach((b) => (b.onclick = (ev) => { ev.stopPropagation(); saveCombo(b.dataset.save); }));
    $$(".item", box).forEach((el) => { el.onclick = () => { if (!el.dataset.sw) editEntry(el.dataset.id); }; bindSwipe(el); });
  }
  function itemHTML(e, isFresh) {
    const tm = new Date(e.t);
    return `<div class="item-wrap"><div class="item-del">${icon("trash")}</div><div class="item ${isFresh ? "fresh" : ""}" data-id="${e.id}">
      ${ficHTML(e)}<span class="it"><b>${esc(e.n)}</b><span>${r0(e.g)} г · Б ${r0(e.p)} · Ж ${r0(e.f)} · У ${r0(e.c)}</span></span>
      <span class="kc">${fmt(e.k)}<span>${pad(tm.getHours())}:${pad(tm.getMinutes())}</span></span></div></div>`;
  }
  function bindSwipe(el) {
    const wrap = el.parentElement; let x0, y0, dx = 0, mode = null;
    el.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; dx = 0; mode = null; delete el.dataset.sw; }, { passive: true });
    el.addEventListener("touchmove", (e) => {
      const mx = e.touches[0].clientX - x0, my = e.touches[0].clientY - y0;
      if (!mode) { if (Math.abs(mx) > 8 && Math.abs(mx) > Math.abs(my)) mode = "x"; else if (Math.abs(my) > 8) mode = "y"; }
      if (mode !== "x") return;
      dx = Math.min(0, mx); el.dataset.sw = "1"; el.classList.add("dragging"); wrap.classList.add("swiping");
      el.style.transform = `translateX(${dx < -140 ? -140 + (dx + 140) * 0.3 : dx}px)`;
      const armed = dx < -90; if (armed !== wrap.classList.contains("armed")) { wrap.classList.toggle("armed", armed); if (armed) haptic("light"); }
    }, { passive: true });
    el.addEventListener("touchend", () => {
      if (mode !== "x") return; el.classList.remove("dragging");
      if (dx < -90) {
        el.style.transform = "translateX(-110%)";
        wrap.style.transition = "height .35s var(--ease), opacity .3s"; wrap.style.height = wrap.offsetHeight + "px";
        requestAnimationFrame(() => { wrap.style.height = "0px"; wrap.style.opacity = "0"; });
        setTimeout(() => deleteEntry(el.dataset.id), 330);
      } else { el.style.transform = ""; setTimeout(() => wrap.classList.remove("swiping", "armed"), 300); }
      setTimeout(() => delete el.dataset.sw, 60);
    });
  }

  // ---------- entry ops ----------
  function mealHour(m) { return { breakfast: 8, lunch: 13, dinner: 19, snack: 16 }[m] || 12; }
  let streakBump = 0;
  function addEntries(arr, m, dayK = selDay) {
    if (dayK === todayKey() && !dayEntries(dayK).length && arr.length) streakBump = 1;
    if (!S.days[dayK]) S.days[dayK] = [];
    const base = dayK === todayKey() ? Date.now() : fromKey(dayK).setHours(mealHour(m), 0, 0, 0);
    arr.forEach((x, i) => {
      const id = uid(); fresh.add(id);
      S.days[dayK].push({ id, n: x.n, cat: catOf(x.n, x.cat), g: r0(x.g), k: r0(x.k), p: r1(x.p), f: r1(x.f), c: r1(x.c), meal: m, t: base + i, img: x.img || undefined, src: x.src || "db" });
      if (x.src !== "photo" && x.src !== "combo") S.recent = [x.n].concat(S.recent.filter((r) => r !== x.n)).slice(0, 12);
    });
    save();
  }
  function findEntry(id) { for (const k in S.days) { const i = S.days[k].findIndex((e) => e.id === id); if (i > -1) return { k, i, e: S.days[k][i] }; } return null; }
  function deleteEntry(id) {
    const f = findEntry(id); if (!f) return;
    const copy = JSON.parse(JSON.stringify(f.e));
    S.days[f.k].splice(f.i, 1); if (!S.days[f.k].length) delete S.days[f.k];
    save(); haptic("medium"); refreshAll();
    toast("Запись удалена", () => { (S.days[f.k] = S.days[f.k] || []).push(copy); fresh.add(copy.id); save(); refreshAll(); });
  }
  function refreshAll() { if (cur === "today") { renderWeek(); updateToday(); } else if (cur === "history") renderHistory(); else if (cur === "calendar") renderCalendar(); }
  function editEntry(id) {
    const f = findEntry(id); if (!f) return;
    const e = f.e;
    const per = e.g ? { k: (e.k / e.g) * 100, p: (e.p / e.g) * 100, f: (e.f / e.g) * 100, c: (e.c / e.g) * 100 } : null;
    const st = { g: e.g || 100, meal: e.meal };
    const body = `<div class="portion">
      <div class="pn">${ficHTML(e)}<div style="min-width:0"><b>${esc(e.n)}</b><span>${dayLabel(f.k)}, ${meal(e.meal).n.toLowerCase()}</span></div></div>
      <div class="kbig"><span class="num" id="pe-k">${fmt(e.k)}</span><span class="u">ккал</span></div>
      <div class="macros" id="pe-m"></div>
      ${per ? `<div class="prow-ln"><span>Порция</span>${stepperHTML("g", st.g, "г", 10)}</div><input type="range" id="pe-r" min="10" max="${Math.max(800, st.g * 2)}" step="5" value="${st.g}">` : ""}
    </div>
    ${mealLine("pe-meal", st.meal)}`;
    openSheet("Запись", body, `<div class="btn-row" style="margin:0"><button class="btn ghost icon-btn" id="pe-del" aria-label="Удалить">${icon("trash")}</button><button class="btn" id="pe-save">Сохранить</button></div>`);
    const upd = () => { const v = per ? scaleFood(per, st.g) : e; $("#pe-k").textContent = fmt(v.k); $("#pe-m").innerHTML = macroTags(v, true); const r = $("#pe-r"); if (r) { r.value = st.g; setRangeFill(r); } };
    upd();
    bindSteppers($("#sh-body"), st, { g: [5, 3000] }, upd);
    const r = $("#pe-r"); if (r) r.oninput = () => { st.g = +r.value; $('[data-step="g"] [data-v]').textContent = st.g; upd(); };
    bindMealLine("pe-meal", (v) => (st.meal = v));
    $("#pe-save").onclick = () => { if (per) Object.assign(e, roundM(scaleFood(per, st.g)), { g: st.g }); e.meal = st.meal; save(); closeSheet(); refreshAll(); toast("Сохранено"); haptic("ok"); };
    $("#pe-del").onclick = () => { closeSheet(); setTimeout(() => deleteEntry(id), 200); };
  }
  const roundM = (v) => ({ k: r0(v.k), p: r1(v.p), f: r1(v.f), c: r1(v.c) });

  // ---------- наборы ----------
  function saveCombo(mealId) {
    const items = dayEntries(selDay).filter((e) => e.meal === mealId), sum = items.reduce((a, e) => a + e.k, 0);
    const def = "Мой " + meal(mealId).n.toLowerCase();
    openSheet("Новый набор", `<label class="field"><span>Название</span><input id="cb-n" maxlength="40" value="${esc(def)}"></label>
      <p class="note">Набор добавляется в один тап из поиска. Удобно для завтрака, который повторяется каждый день.</p>
      <div class="meal-group" style="margin-top:14px">${items.map((e) => `<div class="item" style="pointer-events:none">${ficHTML(e)}<span class="it"><b>${esc(e.n)}</b><span>${r0(e.g)} г</span></span><span class="kc">${fmt(e.k)}</span></div>`).join("")}</div>`,
      `<button class="btn" id="cb-save">Сохранить · ${fmt(sum)} ккал</button>`);
    $("#cb-save").onclick = () => {
      const n = $("#cb-n").value.trim() || def;
      S.combos = S.combos.filter((c) => c.n !== n);
      S.combos.unshift({ id: uid(), n, items: items.map((e) => ({ n: e.n, cat: e.cat, g: e.g, k: e.k, p: e.p, f: e.f, c: e.c })) });
      save(); closeSheet(); haptic("ok"); const a = checkAch(); if (a) celebrate(a); else toast("Набор сохранён");
    };
  }
  function comboSheet(id) {
    const c = S.combos.find((x) => x.id === id); if (!c) return;
    const t = c.items.reduce((a, e) => { a.k += e.k; a.p += e.p; a.f += e.f; a.c += e.c; return a; }, { k: 0, p: 0, f: 0, c: 0 });
    setSheet(c.n, `<div class="portion"><div class="kbig" style="margin-top:0"><span class="num">${fmt(t.k)}</span><span class="u">ккал</span></div><div class="macros">${macroTags(t, true)}</div></div>
      <div class="meal-group" style="margin-top:12px">${c.items.map((e) => `<div class="item" style="pointer-events:none">${ficHTML(e)}<span class="it"><b>${esc(e.n)}</b><span>${r0(e.g)} г</span></span><span class="kc">${fmt(e.k)}</span></div>`).join("")}</div>
      ${mealLine("cb-meal", add.meal)}`,
      `<div class="btn-row" style="margin:0"><button class="btn ghost icon-btn" id="cb-del" aria-label="Удалить набор">${icon("trash")}</button><button class="btn" id="cb-add">Добавить · ${fmt(t.k)} ккал</button></div>`, () => renderAdd(-1));
    bindMealLine("cb-meal", (v) => (add.meal = v));
    $("#cb-add").onclick = () => { addEntries(c.items.map((e) => Object.assign({}, e, { src: "combo" })), add.meal); afterAdd(t.k); };
    $("#cb-del").onclick = () => { S.combos = S.combos.filter((x) => x.id !== id); save(); haptic("medium"); toast("Набор удалён"); renderAdd(-1); };
  }

  // ---------- выбор приёма пищи ----------
  const MEAL_HINT = { breakfast: "утром", lunch: "днём", dinner: "вечером", snack: "между приёмами" };
  const mealLine = (id, cur) => `<div class="mline"><span>Приём пищи</span><button class="mchip" id="${id}" data-v="${cur}">${icon(meal(cur).i)}<b>${meal(cur).n}</b>${icon("down", "mc-ch")}</button></div>`;
  function bindMealLine(id, set) {
    const btn = $("#" + id); if (!btn) return;
    btn.onclick = (e) => { e.stopPropagation(); haptic("light"); mealMenu(btn, btn.dataset.v, (v) => { btn.dataset.v = v; btn.innerHTML = `${icon(meal(v).i)}<b>${meal(v).n}</b>${icon("down", "mc-ch")}`; set(v); }); };
  }
  function mealMenu(anchor, cur, cb) {
    const old = $(".menu"); if (old) old.remove();
    const r = anchor.getBoundingClientRect();
    const m = document.createElement("div"); m.className = "menu";
    m.innerHTML = MEALS.map((x) => `<button data-m="${x.id}" class="${x.id === cur ? "on" : ""}">${icon(x.i)}<span><b>${x.n}</b><em>${MEAL_HINT[x.id]}</em></span>${x.id === cur ? icon("check", "mk") : ""}</button>`).join("");
    document.body.appendChild(m);
    const w = 220, left = Math.min(window.innerWidth - w - 12, Math.max(12, r.right - w));
    const below = r.bottom + 8 + 232 < window.innerHeight;
    m.style.left = left + "px"; m.style.width = w + "px";
    if (below) m.style.top = r.bottom + 8 + "px"; else { m.style.bottom = window.innerHeight - r.top + 8 + "px"; m.classList.add("up"); }
    raf2(() => m.classList.add("on"));
    const close = () => { m.classList.remove("on"); setTimeout(() => m.remove(), 250); document.removeEventListener("pointerdown", out, true); };
    const out = (e) => { if (!m.contains(e.target)) { e.stopPropagation(); close(); } };
    setTimeout(() => document.addEventListener("pointerdown", out, true), 0);
    $$("button", m).forEach((b) => (b.onclick = () => { haptic("sel"); cb(b.dataset.m); close(); }));
  }

  // =====================================================================
  // DETAIL SHEETS
  // =====================================================================
  // ---------- вода ----------
  const waterNorm = () => Math.round((S.profile.weight * 30 + (S.profile.train.n ? 300 : 0)) / 50) * 50;
  const waterOf = (k) => ((S.water || {})[k] || 0);
  function updWater() {
    if (!$("#v-w")) return;
    const ml = waterOf(selDay), wn = waterNorm();
    countUp($("#v-w"), ml / 1000, { key: "w", dec: true });
    $("#s-w").textContent = ml >= wn ? "норма выпита" : `из ${dec(wn / 1000)} л`;
    setDots($("#c-w .drow"), ml, wn);
  }
  function addWater(d) {
    if (!S.water) S.water = {};
    const v = Math.max(0, waterOf(selDay) + d); S.water[selDay] = v; save(); haptic(d > 0 ? "light" : "sel");
    updWater();
    const b = $("#w-plus"); if (b && d > 0) { b.classList.remove("pop"); void b.offsetWidth; b.classList.add("pop"); }
    if (sheetOpen && $("#ws-v")) { $("#ws-v").textContent = dec(v / 1000); setDots($("#ws-dots"), v, waterNorm()); }
  }
  function waterSheet() {
    haptic("light");
    const g = S.settings.glass || 250, wn = waterNorm();
    openSheet("Вода", `<div class="portion" style="text-align:center;padding:28px 22px">
        <div class="kbig" style="justify-content:center;margin-top:0"><span class="num" id="ws-v">${dec(waterOf(selDay) / 1000)}</span><span class="u">из ${dec(wn / 1000)} л</span></div>
        ${dotRow(16, "ink w-dots")}
        <div class="w-acts"><button class="btn ghost icon-btn" id="ws-m" aria-label="Убрать">${icon("minus")}</button><button class="btn" id="ws-p">${icon("plus")}<span id="ws-pl">${g} мл</span></button></div>
      </div>
      <div class="subh">Объём одного нажатия</div>
      ${segHTML("glass", [["200", "200 мл"], ["250", "250 мл"], ["330", "330 мл"], ["500", "500 мл"]], String(g))}
      <p class="note">Норма считается от веса: около 30 мл на килограмм, плюс немного в дни тренировок. Чай и кофе тоже считаются.</p>`);
    $(".w-dots").id = "ws-dots"; setDots($("#ws-dots"), waterOf(selDay), wn);
    bindSeg($("#sh-body"), "glass", (v) => { S.settings.glass = +v; save(); $("#ws-pl").textContent = v + " мл"; });
    $("#ws-p").onclick = () => addWater(S.settings.glass || 250);
    $("#ws-m").onclick = () => addWater(-(S.settings.glass || 250));
  }
  const fmtD = (d) => d.getDate() + " " + MON[d.getMonth()];
  let planTop = false;
  function openGoal(after) {
    haptic("light"); openSheet("Цель по весу", "");
    const back = () => { closeSheet(); if (after) after(); };
    planTop = true; if (S.plan) planDetail(back); else planEdit(back);
  }
  const weighDue = () => { if (!S.plan) return false; const e = Object.keys(S.weights).sort(); const last = e.length ? fromKey(e[e.length - 1]) : null; return !last || (new Date() - last) / 864e5 >= 7; };
  function goalCardHTML() {
    const pi = planInfo();
    if (!pi) return `<button class="card goal-cta" id="goal-open"><span class="gc-ic">${icon("flag")}</span><span class="gc-t"><b>Поставь цель по весу</b><span>Посчитаю норму под цель и разобью путь на месячные этапы</span></span>${icon("right", "chev")}</button>`;
    const pl = S.plan, cm = pi.ms.find((m) => m.cur);
    return `<button class="card goal-card" id="goal-open">
      <div class="gk-row"><span class="gk-ic">${icon(pl.type === "lose" ? "down-trend" : "muscle")}</span>
        <span class="gk-t"><b>${pl.type === "lose" ? "Похудение" : "Набор массы"}</b><span>до ${fmtD(pi.end)}</span></span>
        <span class="gk-p num">${Math.round(pi.done * 100)}<small>%</small></span></div>
      <div class="gk-w"><span><em>Сейчас</em><b class="num">${dec(pi.cur)} кг</b></span>${dotRow(14, "ink gc-dots")}<span style="text-align:right"><em>Цель</em><b class="num">${dec(pl.target)} кг</b></span></div>
      ${weighDue() ? `<div class="gc-m gc-due">${icon("scale")}<span>Пора взвеситься</span><span class="gc-btn" data-weigh>Записать</span></div>` : cm && !pi.reached ? `<div class="gc-m">${icon("flag")}<span>Этап к ${fmtD(cm.d)}: ${dec(cm.exp)} кг</span></div>` : ""}
    </button>`;
  }
  function goalStatus(pi) {
    if (pi.reached) return { t: "Достигнута", cls: "ok" };
    if (pi.diff <= -0.6) return { t: "Отстаёшь на " + dec(-pi.diff) + " кг", cls: "warn" };
    if (pi.diff >= 0.6) return { t: "Впереди на " + dec(pi.diff) + " кг", cls: "ok" };
    return { t: "По плану", cls: "ok" };
  }
  function bindGoalCard(back) {
    const b = $("#goal-open"); if (!b) return;
    if (S.plan) setDots($(".gc-dots"), planInfo().done, 1);
    b.onclick = (e) => { if (e.target.closest("[data-weigh]")) { weightSheet(); return; } if (!back) { openGoal(); return; } haptic("light"); if (S.plan) planDetail(back); else planEdit(back); };
  }
  function planDetail(back) {
    const pi = planInfo(), pl = S.plan, st = goalStatus(pi), nm = norm();
    const body = `
      <div class="d-hero g-carb">
        <div class="c-head"><span class="c-title"><span class="ic">${icon(pi.reached ? "trophy" : pl.type === "lose" ? "down-trend" : "muscle")}</span>${pl.type === "lose" ? "Похудение" : "Набор массы"}</span><span class="chip">${st.t}</span></div>
        <div class="big"><span class="num" id="pd-p">0</span><span class="of">% пути</span></div>
        ${dotRow(24)}
        <div class="stats3"><div><span>Старт</span><b class="num">${dec(pl.start)} кг</b></div><div><span>Сейчас</span><b class="num">${dec(pi.cur)} кг</b></div><div><span>Цель</span><b class="num">${dec(pl.target)} кг</b></div></div>
      </div>
      <div class="gap"></div>
      <div class="card"><div class="card-t">План</div>
        <div class="card-s" style="margin-top:6px">Темп ${PACE_N[pl.pace].toLowerCase()}: около ${dec(pi.km)} кг в месяц. Финиш примерно ${fmtD(pi.end)} ${pi.end.getFullYear()}. Норма под план: ${fmt(nm.k)} ккал в день.</div>
        <div class="msl">${pi.ms.map((m, i) => `<div class="${m.ok ? "ok" : m.past ? "miss" : m.cur ? "cur" : ""}"><span class="mk">${m.ok ? icon("check") : m.cur ? icon("target") : i + 1}</span><span class="ml"><b>${cap(MONN[m.d.getMonth()])}</b><em>до ${fmtD(m.d)}</em></span><span class="mv">${dec(m.exp)} кг${m.past && m.w != null ? `<em>было ${dec(m.w)}</em>` : ""}</span></div>`).join("")}</div>
      </div>
      <p class="note">${pi.diff <= -0.6 && !pi.reached ? "Небольшое отставание нормально: вес колеблется день ото дня. Если отстаёшь уже несколько недель, пересчитай план от текущего веса, этапы сдвинутся." : "Отмечай вес раз в несколько дней утром, чтобы прогресс считался точнее."}</p>
      <div class="list">
        <button class="prow" id="pd-edit"><span class="pi">${icon("edit")}</span><span class="pl"><b>Изменить цель</b></span><span class="pv">${icon("right")}</span></button>
        <button class="prow" id="pd-re"><span class="pi">${icon("refresh")}</span><span class="pl"><b>Пересчитать от текущего веса</b><span>Старт сегодня, цель та же</span></span></button>
        <button class="prow danger" id="pd-del"><span class="pi t-pro">${icon("trash")}</span><span class="pl"><b>Удалить цель</b></span></button>
      </div>`;
    setSheet("Цель по весу", body, "", planTop ? null : back, planTop ? 0 : 1); planTop = false;
    countUp($("#pd-p"), Math.round(pi.done * 100), { from: 0, dur: 900, force: true });
    setDots($(".d-hero .drow"), pi.done, 1);
    $("#pd-edit").onclick = () => planEdit(() => planDetail(back));
    $("#pd-re").onclick = () => { S.plan.start = curWeight(); S.plan.startDate = todayKey(); save(); haptic("ok"); toast("План пересчитан"); planDetail(back); };
    $("#pd-del").onclick = () => { S.plan = null; save(); haptic("medium"); toast("Цель удалена"); back(); };
  }
  function planEdit(back) {
    const cw = curWeight(), ex = S.plan;
    const st = ex ? { type: ex.type, target: ex.target, pace: ex.pace } : { type: S.profile.goal === "lose" ? "lose" : "gain", target: 0, pace: 1 };
    if (!ex) st.target = r1(cw + (st.type === "lose" ? -4 : 3));
    const minW = r1(18.5 * Math.pow(S.profile.height / 100, 2));
    const body = `
      ${segHTML("ptype", [["lose", "Сбросить вес"], ["gain", "Набрать вес"]], st.type)}
      <div class="portion" style="margin-top:8px;display:flex;flex-direction:column;align-items:center;padding:26px 22px">
        <div class="card-s">Сейчас ${dec(cw)} кг · целевой вес</div>
        <div style="margin-top:14px">${stepperHTML("target", st.target, "кг", 0.5, "big")}</div>
      </div>
      <div class="subh">Темп</div>
      ${segHTML("pace", PACE_N.map((n, i) => [String(i), n]), String(st.pace))}
      <div class="gap"></div>
      <div class="card" id="pe-sum"></div>`;
    setSheet(ex ? "Изменить цель" : "Новая цель", body, `<button class="btn" id="pe-save">${ex ? "Сохранить" : "Поставить цель"}</button>`, planTop ? null : back, planTop ? 0 : 1); planTop = false;
    const root = $("#sh-body");
    const upd = () => {
      if (st.type === "lose" && st.target >= cw) st.target = r1(cw - 0.5); if (st.type === "gain" && st.target <= cw) st.target = r1(cw + 0.5);
      $('[data-step="target"] [data-v]').textContent = dec(st.target);
      const pl = { type: st.type, start: cw, startDate: todayKey(), target: st.target, pace: st.pace }, pi = planInfo(pl);
      const k = calcNorm(S.profile, pl).k, months = Math.round(pi.weeks / 4.345 * 10) / 10;
      let warn = "";
      if (st.type === "lose" && st.target < minW) warn = `Это ниже здорового веса для твоего роста (около ${dec(minW)} кг). Лучше выбрать цель повыше.`;
      else if (pi.total > cw * 0.2) warn = "Большая цель. Лучше разбить её на несколько этапов и начать с первого.";
      else if (st.type === "gain" && st.pace === 2) warn = "Быстрый набор чаще идёт в жир. Для мышц обычно хватает умеренного темпа.";
      $("#pe-sum").innerHTML = `<div class="ps-row"><span>В месяц</span><b>${st.type === "lose" ? "−" : "+"}${dec(pi.km)} кг</b></div><div class="ps-row"><span>Срок</span><b>${months < 1 ? "меньше месяца" : "≈ " + dec(months) + " " + plural(Math.ceil(months), "месяц", "месяца", "месяцев")}</b></div><div class="ps-row"><span>Финиш</span><b>${fmtD(pi.end)} ${pi.end.getFullYear()}</b></div><div class="ps-row"><span>Норма в день</span><b>${fmt(k)} ккал</b></div>${warn ? `<div class="ps-warn">${icon("info")}<span>${warn}</span></div>` : ""}`;
    };
    bindSeg(root, "ptype", (v) => { st.type = v; st.target = r1(cw + (v === "lose" ? -4 : 3)); upd(); });
    bindSeg(root, "pace", (v) => { st.pace = +v; upd(); });
    bindSteppers(root, st, { target: [30, 250] }, upd);
    upd();
    $("#pe-save").onclick = () => {
      S.plan = { type: st.type, start: cw, startDate: ex && ex.start === cw ? ex.startDate : todayKey(), target: st.target, pace: st.pace };
      if (ex && ex.type === st.type) { S.plan.start = ex.start; S.plan.startDate = ex.startDate; }
      S.profile.goal = st.type; S.profile.manual.on = false; save(); haptic("ok"); toast("Цель поставлена");
      const a = checkAch(); if (a) celebrate(a);
      if (S.plan) planDetail(back);
    };
  }
  function planCheck() {
    const pi = planInfo(), pl = S.plan, lose = pl.type === "lose";
    let ic = "check", tone = "ok", t = "", txt = "", acts = "";
    if (pi.reached) { ic = "trophy"; t = "Цель достигнута"; txt = `Ты дошёл до ${dec(pl.target)} кг. Можно поставить новую цель или перейти на поддержание формы.`; acts = `<button class="btn ghost" data-pc="keep">Поддерживать вес</button><button class="btn" data-pc="new">Новая цель</button>`; }
    else if (pi.diff <= -0.6) { ic = "info"; tone = "warn"; t = `Отстаёшь на ${dec(-pi.diff)} кг`; txt = `По плану сейчас должно быть ${dec(pi.expected)} кг. Это нормально: вес колеблется. Можно сдвинуть финиш, сохранив темп, или ${pl.pace < 2 ? "ускорить темп" : "оставить как есть"}.${lose ? " Проверь, что все приёмы пищи записаны, включая перекусы и напитки." : " Проверь, что добираешь калории каждый день."}`; acts = `<button class="btn ghost" data-pc="shift">Сдвинуть финиш</button>${pl.pace < 2 ? `<button class="btn" data-pc="faster">Ускорить темп</button>` : `<button class="btn" data-pc="ok">Оставить</button>`}`; }
    else if (pi.diff >= 0.6) { ic = "rocket"; t = `Впереди на ${dec(pi.diff)} кг`; txt = `Отличный темп. ${lose ? "Если чувствуешь сильный голод или упадок сил, лучше немного замедлиться." : "Если растёт живот, стоит немного замедлиться, чтобы набирать именно мышцы."}`; acts = `${pl.pace > 0 ? `<button class="btn ghost" data-pc="slower">Замедлить темп</button>` : ""}<button class="btn" data-pc="ok">Продолжать</button>`; }
    else { t = "Всё по плану"; txt = `Сейчас ${dec(pi.cur)} кг, по плану ${dec(pi.expected)} кг. Норма остаётся прежней, продолжай в том же духе.`; acts = `<button class="btn" data-pc="ok">Отлично</button>`; }
    setSheet("Сверка с целью", `<div class="pc-hero"><span class="pc-ic ${tone}">${icon(ic)}</span><b>${t}</b><p>${txt}</p></div>
      <div class="card"><div class="ps-row"><span>Сейчас</span><b>${dec(pi.cur)} кг</b></div><div class="ps-row"><span>По плану</span><b>${dec(pi.expected)} кг</b></div><div class="ps-row"><span>Цель</span><b>${dec(pl.target)} кг</b></div><div class="ps-row"><span>Пройдено</span><b>${Math.round(pi.done * 100)}%</b></div></div>`, `<div class="btn-row pc-acts" style="margin:0">${acts}</div>`, null, 1);
    $$("[data-pc]").forEach((b) => (b.onclick = () => {
      const a = b.dataset.pc; haptic("ok");
      if (a === "shift") { S.plan.start = pi.cur; S.plan.startDate = todayKey(); toast("Финиш сдвинут"); }
      if (a === "faster") { S.plan.start = pi.cur; S.plan.startDate = todayKey(); S.plan.pace++; toast("Темп ускорен, норма обновлена"); }
      if (a === "slower") { S.plan.start = pi.cur; S.plan.startDate = todayKey(); S.plan.pace--; toast("Темп снижен, норма обновлена"); }
      if (a === "keep") { S.plan = null; S.profile.goal = "keep"; toast("Режим поддержания"); }
      save(); if (a === "new") { S.plan = null; save(); planTop = true; planEdit(closeSheet); return; }
      closeSheet(); if (cur === "today") updateToday(); if (cur === "history") drawWeight();
    }));
  }
  function renderTodayGoal() {
    const box = $("#t-goal"); if (!box) return;
    const html = `${goalCardHTML().replace('id="goal-open"', 'id="goal-open" data-home')}<div class="gap"></div>`;
    if (box._h === html) return; box._h = html; box.innerHTML = html; bindGoalCard(null);
  }
  function streakSheet() {
    haptic("light"); if (S.game && S.game.unread) { S.game.unread = 0; save(); updBadge(); }
    const st = streakInfo(), A = achList(), now = new Date(), LV = gameLevel(A);
    const days = Array.from({ length: 7 }, (_, i) => { const d = addDays(now, i - 6), k = dkey(d); return { d, k, on: isLogged(k), fz: isFrozen(k), today: i === 6 }; });
    const msg = st.today ? `Сегодня отмечено. Завтра будет ${st.n + 1}.` : st.risk ? "Добавь еду сегодня, иначе серия сгорит в полночь." : "Добавь еду сегодня, чтобы начать серию.";
    const card = (t, i) => `<div class="tr ${t.st ? "got" : ""} c-${t.col}" style="animation-delay:${0.08 + i * 0.03}s">
        <span class="tr-ic">${icon(t.ic)}</span>
        <div class="tr-b"><div class="tr-h"><b>${t.t}</b><span class="tr-st">${t.st ? "Этап " + t.st : "Не начато"}</span></div>
          <div class="tr-d">${esc(t.d)}</div>
          <div class="tr-bar"><i style="--w:${(t.pct * 100).toFixed(1)}%"></i></div>
          <div class="tr-n"><span>${t.unit === "кг" ? dec(t.val) : fmt(t.val)} из ${t.unit === "кг" ? dec(t.next) : fmt(t.next)}</span><span>этап ${t.st + 1}</span></div></div></div>`;
    const modeT = A.mode === "lose" ? "Для похудения" : A.mode === "gain" ? "Для набора массы" : "Для формы";
    const body = `
      <div class="d-hero g-pro st-hero">
        <div class="c-head"><span class="st-ic">${icon("bolt")}</span>${st.freezes ? `<span class="chip st-fz">${icon("snow")}${st.freezes}</span>` : ""}</div>
        <div class="big"><span class="num" id="st-n">0</span><span class="of">${plural(st.n, "день", "дня", "дней")} подряд</span></div>
        <p class="st-msg">${msg}</p>
        <div class="st-week">${days.map((x, i) => `<div class="${x.on ? "on" : x.fz ? "fz" : ""} ${x.today ? "today" : ""}" style="animation-delay:${0.15 + i * 0.05}s"><span>${x.on ? icon("bolt") : x.fz ? icon("snow") : ""}</span><em>${WD[x.d.getDay()]}</em></div>`).join("")}</div>
      </div>
      <div class="gap"></div>${goalCardHTML()}
      <div class="gap"></div>
      <div class="card lvl">
        <div class="lv-ring" id="lv-ring">${Array.from({ length: 20 }, (_, i) => `<i class="${i < Math.round((LV.inLv / LV.need) * 20) ? "on" : ""}" style="--r:${i * 18}deg;transition-delay:${0.2 + i * 0.03}s"></i>`).join("")}<span class="num">${LV.lv}</span></div>
        <div class="lv-b"><em>Твой уровень</em><b>${LV.lv} уровень</b><span>${LV.need - LV.inLv} ${plural(LV.need - LV.inLv, "этап", "этапа", "этапов")} до ${LV.lv + 1} уровня · всего ${LV.st} ${plural(LV.st, "этап", "этапа", "этапов")}</span></div>
      </div>
      <div class="subh">Достижения</div>
      <div class="trs">${A.common.map(card).join("")}</div>
      <div class="subh">${modeT}</div>
      <div class="trs">${A.goal.map((t, i) => card(t, i + A.common.length)).join("")}</div>
      <p class="note">Каждый пройденный этап открывает следующий, чуть сложнее. За этапы растёт твой уровень. Неделя без пропусков даёт заморозку: она сохранит серию, если однажды забудешь отметиться.</p>`;
    openSheet("Прогресс и награды", body);
    countUp($("#st-n"), st.n, { from: 0, dur: 900, force: true });
    bindGoalCard(streakSheet);
    raf2(() => { $(".st-hero").classList.add("go"); $$("#sh-body .tr-bar").forEach((b) => b.classList.add("go")); const lr = $("#lv-ring"); if (lr) lr.classList.add("go"); });
  }
  function openCalDetail() {
    haptic("light");
    const nm = Object.assign({}, norm(), { k: dayNorm(selDay) }), t = totals(selDay), list = dayEntries(selDay);
    const byMeal = MEALS.map((m) => ({ m, k: list.filter((e) => e.meal === m.id).reduce((a, e) => a + e.k, 0) }));
    const maxM = Math.max(nm.k / 2.5, ...byMeal.map((x) => x.k));
    const hours = new Array(18).fill(0);
    list.forEach((e) => { const h = new Date(e.t).getHours(); hours[clamp(h - 6, 0, 17)] += e.k; });
    const unit = Math.max(100, Math.round(nm.k / 10 / 50) * 50);
    const mon = monday(fromKey(selDay)), tk = todayKey();
    const wk = Array.from({ length: 7 }, (_, i) => { const d = addDays(mon, i), k = dkey(d); return { d, k, v: totals(k).k, has: dayEntries(k).length > 0 }; });
    const logged = wk.filter((x) => x.has && x.k <= tk);
        const nb = norm().k, rows = 10, wUnit = (nb * 1.3) / rows;
    const wb = weekBalance(selDay);
    const body = `
      <div class="d-hero g-cal">
        <div class="c-head"><span class="c-title"><span class="ic">${icon("flame")}</span>${dayLabel(selDay)}</span><span class="chip">${nm.k ? Math.round((t.k / nm.k) * 100) : 0}% нормы</span></div>
        <div class="big"><span class="num">${fmt(t.k)}</span><span class="of">из ${fmt(nm.k)} ккал</span></div>
        ${dotRow(24)}
      </div>
      <div class="gap"></div>
      <div class="card"><div class="card-t">По приёмам пищи</div>
        ${byMeal.map((x) => `<div class="mbar"><span class="ml">${icon(x.m.i)}${x.m.n}</span>${dotRow(14, "ink")}<span class="mv">${x.k ? fmt(x.k) : "—"}</span></div>`).join("")}
      </div>
      <div class="gap"></div>
      <div class="card"><div class="card-t">По времени суток</div><div class="card-s">Одна точка ≈ ${fmt(unit)} ккал</div>
        <div class="hours" id="d-hours">${hours.map((k, i) => { const on = Math.min(6, Math.ceil(k / unit)); let c = ""; for (let r = 0; r < 6; r++) c += `<i class="${r < on ? "on" : ""}" style="transition-delay:${(i * 0.02 + r * 0.03).toFixed(3)}s"></i>`; return `<div class="hc">${c}</div>`; }).join("")}</div>
        <div class="axis"><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span></div>
      </div>
      <div class="gap"></div>
      <div class="card"><div class="card-t">Баланс недели</div>
        <div class="card-s">${wb.days ? (wb.bal >= 0 ? `В прошлые дни этой недели ты недобрал ${fmt(wb.bal)} ккал. Их можно добавить к сегодняшней норме, недельная сумма не изменится.` : `В прошлые дни этой недели ты съел на ${fmt(-wb.bal)} ккал больше нормы. Можно немного уменьшить порции в оставшиеся дни.`) : logged.length ? "Это первый день недели с записями, баланс появится со следующего дня." : "На этой неделе пока нет записей."}</div>
        <div class="wbal" id="d-wbal">${wk.map((x, i) => { const on = Math.round(Math.min(x.v, nb * 1.3) / wUnit); const ovFrom = Math.round(nb / wUnit); let c = ""; for (let r = 0; r < rows; r++) c += `<i class="${r < on ? (r >= ovFrom ? "ov" : "on") : r < ovFrom ? "" : "x"}" style="transition-delay:${(i * 0.05 + r * 0.025).toFixed(3)}s"></i>`; return `<div class="wb ${x.k === selDay ? "today" : ""}"><div class="dcol">${c}</div><span>${WD[x.d.getDay()]}</span></div>`; }).join("")}</div>
        <div class="legend"><span><i style="background:var(--cal-b)"></i>съедено</span><span><i style="background:var(--g20)"></i>до нормы</span><span><i style="background:var(--pro-b)"></i>сверх нормы</span></div>
      </div>
      `;
    openSheet("Калории", body);
    setDots($(".d-hero .drow"), t.k, nm.k, { over: true });
    $$(".mbar .drow").forEach((r, i) => setDots(r, byMeal[i].k, maxM));
    raf2(() => { $("#d-hours").classList.add("go"); $("#d-wbal").classList.add("go"); });
  }
  const MACRO = {
    p: { n: "Белки", i: "protein", kind: "pro", why: "Белок нужен для роста и восстановления мышц. Норма считается от веса: ", foods: ["Куриная грудка варёная", "Творог 5%", "Греческий йогурт", "Яйцо варёное", "Тунец консервированный", "Протеиновый коктейль (молочный)"] },
    c: { n: "Углеводы", i: "carbs", kind: "carb", why: "Углеводы дают энергию для тренировок и восполняют гликоген в мышцах.", foods: ["Рис варёный", "Гречка варёная", "Овсянка на молоке", "Банан", "Лепёшка (нон)", "Картофель варёный"] },
    f: { n: "Жиры", i: "fat", kind: "fat", why: "Жиры нужны для гормонов и усвоения витаминов. Опускать их ниже нормы не стоит.", foods: ["Грецкие орехи", "Арахисовая паста", "Авокадо", "Лосось", "Яйцо варёное", "Масло оливковое"] },
  };
  function openMacroDetail(k) {
    haptic("light");
    const M = MACRO[k], nm = norm(), t = totals(selDay), list = dayEntries(selDay);
    const srcs = list.filter((e) => e[k] > 0.5).sort((a, b) => b[k] - a[k]).slice(0, 6);
    const kcalShare = t.k ? Math.round((((k === "f" ? 9 : 4) * t[k]) / t.k) * 100) : 0;
    const rest = Math.max(0, nm[k] - t[k]);
    const sug = M.foods.map((n) => window.FOODS.find((x) => x.n === n)).filter(Boolean).slice(0, 4);
    const body = `
      <div class="d-hero g-${M.kind}">
        <div class="c-head"><span class="c-title"><span class="ic">${icon(M.i)}</span>${dayLabel(selDay)}</span><span class="chip">${nm[k] ? Math.round((t[k] / nm[k]) * 100) : 0}% нормы</span></div>
        <div class="big"><span class="num">${r0(t[k])}</span><span class="of">из ${nm[k]} г</span></div>
        ${dotRow(24)}
        <div class="stats3"><div><span>${rest > 0 ? "Осталось" : "Сверх нормы"}</span><b class="num">${r0(rest > 0 ? rest : t[k] - nm[k])} г</b></div><div><span>Доля калорий</span><b class="num">${kcalShare}%</b></div><div><span>На кг веса</span><b class="num">${dec(t[k] / S.profile.weight)} г</b></div></div>
      </div>
      <div class="gap"></div>
      <div class="card"><div class="card-t">Источники за день</div>
        ${srcs.length ? srcs.map((e) => `<div class="src">${ficHTML(e)}<span class="st">${esc(e.n)}</span><span class="sv">${r0(e[k])} г<span>${t[k] ? Math.round((e[k] / t[k]) * 100) : 0}%</span></span></div>`).join("") : `<div class="card-s">Пока нет записей.</div>`}
      </div>
      <div class="gap"></div>
      <div class="card"><div class="card-t">Где взять ${M.n.toLowerCase()}</div><div class="card-s">На стандартную порцию</div>
        ${sug.map((f) => { const v = scaleFood(f, f.g); return `<div class="fitem sug"><span class="ft"><b>${esc(f.n)}</b><span>${f.g} г · ${fmt(v.k)} ккал</span></span><span class="sg-v">${r0(v[k])} г</span></div>`; }).join("")}
      </div>
      <p class="note">${M.why}${k === "p" ? dec(nm.p / S.profile.weight) + " г на кг." : ""}</p>`;
    openSheet(M.n, body);
    setDots($(".d-hero .drow"), t[k], nm[k]);
  }

  // =====================================================================
  // ADD FOOD
  // =====================================================================
  const newAdd = (tab) => ({ tab: tab || "home", meal: selDay === todayKey() ? mealByTime() : "lunch", photo: null, thumb: null, items: [], hint: "", q: "", man: null });
  let add = newAdd();
  function openAdd(tab) { add = newAdd(tab); openSheet("Добавить еду", ""); renderAdd(0); }
  const ADD_T = { home: "Добавить еду", photo: "Фото еды", search: "Найти блюдо", manual: "Ввести вручную" };
  function renderAdd(dir = 0) {
    const home = add.tab === "home";
    const body = home ? addHomeHTML() : `<div id="a-body"></div>`;
    const back = home ? null : () => { add.tab = "home"; add.photo = null; add.items = []; anReq++; renderAdd(-1); };
    if (dir) setSheet(ADD_T[add.tab], body, "", back, dir);
    else { $("#sh-title").textContent = ADD_T[add.tab]; const b = $("#sh-body"); b.className = "sh-body"; b.innerHTML = body; setBack(back); }
    if (home) bindAddHome(); else renderAddBody(false);
  }
  function recentFoods() {
    const seen = new Set(), out = [];
    Object.keys(S.days).sort().reverse().some((k) => { S.days[k].slice().sort((a, b) => b.t - a.t).forEach((e) => { const key = e.n.toLowerCase(); if (!seen.has(key) && e.g) { seen.add(key); out.push({ n: e.n, g: e.g, k: (e.k / e.g) * 100, p: (e.p / e.g) * 100, f: (e.f / e.g) * 100, c: (e.c / e.g) * 100, img: e.img }); } }); return out.length >= 6; });
    return out.slice(0, 6);
  }
  function addHomeHTML() {
    const mine = S.my.slice(0, 12);
    const combos = S.combos.slice(0, 5);
    return `${mealLine("mp-btn", add.meal)}
      <div class="hshot g-cal">
        <span class="hs-ic">${icon("cam")}</span>
        <b>Сфотографируй тарелку</b>
        <span class="hs-s">Нейросеть узнает блюда и посчитает калории и БЖУ</span>
        <div class="hs-acts"><button class="btn white" id="h-cam">${icon("cam")}Камера</button><button class="btn glass icon-btn" id="h-gal" aria-label="Из галереи">${icon("img")}</button></div>
        ${S.settings.key ? "" : `<button class="hs-key" id="h-key">${icon("key")}Для фото нужен ключ Gemini${icon("right")}</button>`}
      </div>
      <button class="mrow" id="h-man"><span class="at-ic">${icon("edit")}</span><span class="mr-t"><b>Ввести вручную</b><span>Можно сохранить блюдо, чтобы добавлять в одно касание</span></span>${icon("right", "chev")}</button>
      ${combos.length || mine.length ? `<div class="subh">Мои блюда</div><div class="flist stagger">${combos.map((c) => { const k = c.items.reduce((a, e) => a + e.k, 0); return `<button class="fitem" data-combo="${c.id}"><span class="ft"><b>${esc(c.n)}</b><span>Набор · ${fmt(k)} ккал</span></span><span class="plus">${icon("right")}</span></button>`; }).join("")}${mine.map((f, i) => { const v = scaleFood(f, f.g); return `<button class="fitem" data-mi="${i}"><span class="ft"><b>${esc(f.n)}</b><span>${r0(f.g)} г · ${fmt(v.k)} ккал</span></span><span class="plus">${icon("plus")}</span></button>`; }).join("")}</div>` : ""}`;
  }
  function bindAddHome() {
    const go = (t) => { haptic("light"); add.tab = t; renderAdd(1); };
    bindMealLine("mp-btn", (v) => (add.meal = v));
    $("#h-cam").onclick = () => $("#f-cam").click();
    $("#h-gal").onclick = () => $("#f-gal").click();
    if ($("#h-key")) $("#h-key").onclick = () => keySheet();
    $("#h-man").onclick = () => go("manual");
    $$(".stagger > *", $("#sh-body")).forEach((el, i) => (el.style.animationDelay = i * 0.03 + "s"));
    $$("#sh-body .fitem").forEach((el) => (el.onclick = () => (el.dataset.combo ? (haptic("light"), comboSheet(el.dataset.combo)) : portion(S.my[+el.dataset.mi]))));
    footBtn("");
  }
  function renderAddBody() {
    if (add.tab === "photo") renderPhoto(); else if (add.tab === "search") renderSearch(); else renderManual();
  }
  function footBtn(label, id, disabled) { sheetFoot(label ? `<button class="btn" id="${id}" ${disabled ? "disabled" : ""}>${label}</button>` : ""); }

  // ----- photo -----
  function renderPhoto() {
    const b = $("#a-body");
    if (!add.photo) {
      b.innerHTML = `<div class="shoot"><span class="tile">${icon("cam")}</span>
        <h4>Сфотографируй тарелку</h4><p>Нейросеть узнает блюда, оценит порции и посчитает КБЖУ. Результат можно поправить.</p>
        <div class="acts"><button class="btn white" id="p-cam">${icon("cam")}Камера</button><button class="btn glass" id="p-gal">${icon("img")}Галерея</button></div></div>
        ${S.settings.key ? `<div class="tips"><div class="tip">${icon("lunch")}<span>Снимай сверху и при хорошем свете, чтобы было видно всю тарелку.</span></div><div class="tip">${icon("edit")}<span>Если в блюде много масла или соуса, напиши это в подсказке после снимка.</span></div></div>`
        : `<div class="gap"></div><div class="alert"><span class="ins-ic t-cal">${icon("key")}</span><div><b>Нужен ключ Gemini</b>Чтобы распознавать фото, добавь бесплатный ключ в профиле. Поиск и ручной ввод работают и без него.<div class="btn-row"><button class="btn sm" id="p-key">Добавить ключ</button></div></div></div>`}`;
      $("#p-cam").onclick = () => $("#f-cam").click();
      $("#p-gal").onclick = () => $("#f-gal").click();
      if ($("#p-key")) $("#p-key").onclick = () => keySheet();
      footBtn(""); return;
    }
    b.innerHTML = `<div class="preview" id="pv"><img src="${add.photo}" alt=""><span class="scan"></span><span class="status" id="pv-st"><span class="spin"></span><span id="pv-tx">Смотрю на тарелку</span></span><button class="retake" id="p-retake">${icon("refresh")}Другое фото</button></div>
      <div class="search" style="margin-top:12px"><input id="p-hint" placeholder="Подсказка: «рис 200 г, масла много»" value="${esc(add.hint)}"><button id="p-re" class="btn sm">Оценить</button></div>
      <div id="p-res" style="margin-top:14px"></div>`;
    const img = $("#pv img"); const loaded = () => $("#pv").classList.add("loaded"); if (img.complete) raf2(loaded); else img.onload = loaded;
    $("#p-hint").oninput = (e) => (add.hint = e.target.value);
    $("#p-re").onclick = () => analyze();
    $("#p-retake").onclick = () => { add.tab = "home"; add.photo = null; add.items = []; anReq++; haptic("light"); renderAdd(-1); };
    if (add.items.length) renderResults(); else if (S.settings.key) analyze(); else noKeyResults();
  }
  function noKeyResults() {
    $("#p-res").innerHTML = `<div class="alert"><span class="ins-ic t-cal">${icon("key")}</span><div><b>Ключ Gemini не добавлен</b>Без ключа фото не распознаётся. Добавь ключ или введи блюдо вручную.<div class="btn-row"><button class="btn sm ghost" id="nk-s">Ввести вручную</button><button class="btn sm" id="nk-p">Добавить ключ</button></div></div></div>`;
    $("#nk-s").onclick = () => { add.tab = "manual"; add.photo = null; renderAdd(1); };
    $("#nk-p").onclick = () => keySheet();
    footBtn("");
  }
  async function onFile(file) {
    if (!file) return;
    try {
      const { full, thumb } = await compress(file, 1024, 120);
      const wasOpen = sheetOpen;
      if (!sheetOpen) { add = newAdd("photo"); openSheet("Фото еды", ""); }
      add.photo = full; add.thumb = thumb; add.items = []; add.tab = "photo"; renderAdd(wasOpen ? 1 : 0);
    } catch (e) { toast("Не удалось открыть фото"); }
  }
  $("#f-cam").addEventListener("change", (e) => { onFile(e.target.files[0]); e.target.value = ""; });
  $("#f-gal").addEventListener("change", (e) => { onFile(e.target.files[0]); e.target.value = ""; });
  function compress(file, max, tmax, square) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        const mk = (m, q, sq) => {
          const c = document.createElement("canvas");
          if (sq) { const s = Math.min(img.width, img.height); c.width = c.height = Math.min(m, s); c.getContext("2d").drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, c.width, c.height); }
          else { const sc = Math.min(1, m / Math.max(img.width, img.height)); c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); }
          return c.toDataURL("image/jpeg", q);
        };
        const out = { full: mk(max, 0.82, square), thumb: tmax ? mk(tmax, 0.72, true) : null };
        URL.revokeObjectURL(url); res(out);
      };
      img.onerror = rej; img.src = url;
    });
  }
  let anReq = 0;
  async function analyze() {
    if (!S.settings.key) return noKeyResults();
    const my = ++anReq, pv = $("#pv");
    pv.classList.add("scanning");
    const phrases = ["Смотрю на тарелку", "Узнаю блюда", "Оцениваю порции", "Считаю КБЖУ"]; let pi = 0;
    $("#pv-tx").textContent = phrases[0];
    const pt = setInterval(() => { pi = (pi + 1) % phrases.length; const tx = $("#pv-tx"); if (tx) tx.textContent = phrases[pi]; }, 1500);
    $("#p-res").innerHTML = ""; footBtn("");
    try {
      const items = await gemini(add.photo, add.hint);
      if (my !== anReq) return;
      add.items = items; haptic(items.length ? "ok" : "err"); renderResults();
    } catch (err) {
      if (my !== anReq) return;
      haptic("err");
      $("#p-res").innerHTML = `<div class="alert"><span class="ins-ic t-pro">${icon("info")}</span><div><b>Не получилось распознать</b>${esc(err.message || err)}<div class="btn-row"><button class="btn sm ghost" id="er-s">Ввести вручную</button><button class="btn sm" id="er-r">Ещё раз</button></div></div></div>`;
      $("#er-r").onclick = analyze; $("#er-s").onclick = () => { add.tab = "manual"; add.photo = null; renderAdd(1); };
    } finally { clearInterval(pt); if (my === anReq && pv) pv.classList.remove("scanning"); }
  }
  async function gemini(dataUrl, hint) {
    const b64 = dataUrl.split(",")[1];
    const prompt = `Ты нутрициолог. На фото еда. Определи каждое отдельное блюдо или продукт, оцени вес порции в граммах по размеру тарелки и приборов, затем калорийность и БЖУ именно этой порции. Учитывай типичное количество масла при домашней готовке (особенно для узбекской и восточной кухни). Названия пиши по-русски, коротко, как в меню. Для каждого укажи категорию из списка: ${CATS.join(", ")}. Если на фото нет еды, верни пустой список.${hint ? "\nПодсказка от пользователя (приоритетна): " + hint : ""}`;
    const body = {
      contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: "image/jpeg", data: b64 } }] }],
      generationConfig: { temperature: 0.2, responseMimeType: "application/json", responseSchema: { type: "OBJECT", properties: { items: { type: "ARRAY", items: { type: "OBJECT", properties: { name: { type: "STRING" }, category: { type: "STRING", enum: CATS }, grams: { type: "NUMBER" }, kcal: { type: "NUMBER" }, protein: { type: "NUMBER" }, fat: { type: "NUMBER" }, carbs: { type: "NUMBER" } }, required: ["name", "grams", "kcal", "protein", "fat", "carbs"] } } }, required: ["items"] } },
    };
    const model = (S.settings.model || "gemini-flash-latest").trim();
    const ctrl = new AbortController(), to = setTimeout(() => ctrl.abort(), 45000);
    let r;
    try { r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": S.settings.key.trim() }, body: JSON.stringify(body), signal: ctrl.signal }); }
    catch (e) { throw new Error(e.name === "AbortError" ? "Слишком долго нет ответа. Проверь интернет и попробуй ещё раз." : "Нет соединения с Gemini. Проверь интернет."); }
    finally { clearTimeout(to); }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const m = (j.error && j.error.message) || "";
      if (r.status === 400 && /API key/i.test(m)) throw new Error("Ключ Gemini не подходит. Проверь его в профиле.");
      if (r.status === 403) throw new Error("Доступ запрещён. Возможно, ключ отключён или Gemini недоступен в твоём регионе.");
      if (r.status === 404) throw new Error("Модель «" + model + "» не найдена. Поменяй модель в профиле на gemini-flash-latest.");
      if (r.status === 429) throw new Error("Исчерпан бесплатный лимит запросов. Попробуй позже или найди блюдо в базе.");
      throw new Error("Ошибка Gemini (" + r.status + "). " + m.slice(0, 140));
    }
    const parts = (((j.candidates || [])[0] || {}).content || {}).parts || [];
    const txt = parts.map((p) => p.text || "").join("");
    let data; try { data = JSON.parse(txt.replace(/^```json|```$/g, "").trim()); } catch (e) { throw new Error("Не удалось прочитать ответ нейросети. Попробуй ещё раз."); }
    return (data.items || []).filter((x) => x && x.name).map((x) => {
      const it = { n: String(x.name).slice(0, 60), cat: catOf(String(x.name), x.category), g: Math.max(1, +x.grams || 100), k: Math.max(0, +x.kcal || 0), p: Math.max(0, +x.protein || 0), f: Math.max(0, +x.fat || 0), c: Math.max(0, +x.carbs || 0) };
      it.per = { k: (it.k / it.g) * 100, p: (it.p / it.g) * 100, f: (it.f / it.g) * 100, c: (it.c / it.g) * 100 };
      return it;
    });
  }
  function renderResults() {
    const box = $("#p-res");
    if (!add.items.length) { box.innerHTML = `<div class="alert"><span class="ins-ic t-n">${icon("info")}</span><div><b>Еды на фото не видно</b>Попробуй снять ближе и при хорошем свете или напиши подсказку.</div></div>`; footBtn(""); return; }
    box.innerHTML = add.items.map((x, i) => `<div class="res-item" style="animation-delay:${i * 0.07}s">
        <div class="res-top">${ficHTML(x)}<input value="${esc(x.n)}" data-name="${i}" aria-label="Название"><button class="del" data-del="${i}" aria-label="Убрать">${icon("x")}</button></div>
        <div class="macros" id="rm-${i}"></div>
        <div class="res-bot"><span class="muted">Порция</span>${stepperHTML("g" + i, x.g, "г", 10)}</div>
      </div>`).join("") + `<div class="res-sum"><span class="muted">Итого</span><b><span class="num" id="r-sum">0</span> <span class="muted" style="font-size:15px">ккал</span></b></div>
      <p class="note" style="padding-top:4px">Оценка по фото примерная, обычно погрешность около 20–30%. Поправь граммы, если знаешь точнее.</p>`;
    const upd = () => {
      let sum = 0;
      add.items.forEach((x, i) => { const v = scaleFood(x.per, x.g); Object.assign(x, { k: v.k, p: v.p, f: v.f, c: v.c }); const m = $("#rm-" + i); if (m) m.innerHTML = macroTags(v); sum += v.k; });
      $("#r-sum").textContent = fmt(sum);
      footBtn(`Добавить ${add.items.length} ${plural(add.items.length, "позицию", "позиции", "позиций")} · ${fmt(sum)} ккал`, "r-add");
      $("#r-add").onclick = commitPhoto;
    };
    const lim = {}; add.items.forEach((x, i) => (lim["g" + i] = [5, 3000]));
    const proxy = new Proxy({}, { get: (_, k) => add.items[+String(k).slice(1)].g, set: (_, k, v) => { add.items[+String(k).slice(1)].g = v; return true; } });
    bindSteppers(box, proxy, lim, upd);
    $$("[data-name]", box).forEach((inp) => (inp.oninput = () => (add.items[+inp.dataset.name].n = inp.value)));
    $$("[data-del]", box).forEach((b) => (b.onclick = () => {
      const i = +b.dataset.del, card = b.closest(".res-item");
      card.style.transition = "opacity .25s, transform .35s var(--ease-out)"; card.style.opacity = "0"; card.style.transform = "scale(.96)"; haptic("light");
      setTimeout(() => { add.items.splice(i, 1); renderResults(); }, 240);
    }));
    upd();
  }
  function commitPhoto() { const arr = add.items.map((x) => ({ n: x.n.trim() || "Блюдо", cat: x.cat, g: x.g, k: x.k, p: x.p, f: x.f, c: x.c, img: add.thumb, src: "photo" })); addEntries(arr, add.meal); afterAdd(arr.reduce((a, x) => a + x.k, 0)); }
  function afterAdd(k) {
    closeSheet(); haptic("ok"); if (cur !== "today") show("today"); else { renderWeek(); updateToday(); }
    const bump = streakBump; streakBump = 0;
    const gotFz = bump ? awardFreeze() : false;
    const ach = checkAch(), st = streakInfo(), g = gameStats();
    if (ach) celebrate(ach);
    else if (bump) {
      setTimeout(() => { toast(gotFz ? `Серия ${st.n} ${plural(st.n, "день", "дня", "дней")}. Получена заморозка` : `Серия: ${st.n} ${plural(st.n, "день", "дня", "дней")} подряд`, null, "bolt"); bumpStreak(); haptic("ok"); }, 450);
    } else toast(`Добавлено · ${fmt(k)} ккал`);
  }
  function bumpStreak() { const sp = $("#t-streak"); if (sp) { sp.classList.remove("bump"); void sp.offsetWidth; sp.classList.add("bump"); } }
  function celebrate(a) {
    S.game.unread = (S.game.unread || 0) + 1; save(); updBadge();
    setTimeout(() => {
      haptic("ok"); bumpStreak();
      const old = $(".ach-ban"); if (old) old.remove();
      const el = document.createElement("button"); el.className = "ach-ban";
      el.innerHTML = `<span class="ab-ic">${icon(a.ic)}</span><span class="ab-t"><em>Новое достижение</em><b>${esc(a.t)}</b></span>${icon("right", "chev")}`;
      document.body.appendChild(el); raf2(() => el.classList.add("on"));
      const close = () => { el.classList.remove("on"); setTimeout(() => el.remove(), 500); };
      const t = setTimeout(close, 4200);
      el.onclick = () => { clearTimeout(t); close(); if (sheetOpen) closeSheet(); setTimeout(streakSheet, sheetOpen ? 300 : 0); };
    }, 500);
  }
  function updBadge() { const sp = $("#t-streak"); if (!sp) return; let b = $(".sbadge", sp); const n = (S.game && S.game.unread) || 0; if (!n) { if (b) b.remove(); return; } if (!b) { b = document.createElement("i"); b.className = "sbadge"; sp.appendChild(b); } b.textContent = n; }


  // ----- search -----
  const allFoods = () => S.my.concat(window.FOODS);
  const normS = (s) => s.toLowerCase().replace(/ё/g, "е").trim();
  function renderSearch() {
    $("#a-body").innerHTML = `<label class="search">${icon("search")}<input id="q" placeholder="Плов, гречка, творог" value="${esc(add.q)}" autocomplete="off" enterkeyhint="search"><button class="clr ${add.q ? "show" : ""}" id="q-clr" aria-label="Очистить">${icon("x")}</button></label><div class="flist" id="fl"></div>`;
    const q = $("#q");
    q.oninput = () => { add.q = q.value; $("#q-clr").classList.toggle("show", !!q.value); listFoods(); };
    $("#q-clr").onclick = () => { q.value = ""; add.q = ""; $("#q-clr").classList.remove("show"); listFoods(); q.focus(); };
    listFoods(); footBtn("");
  }
  function foodRow(f) { const v = scaleFood(f, f.g); return `<button class="fitem" data-n="${esc(f.n)}">${ficHTML(f)}<span class="ft"><b>${esc(f.n)}</b><span>${f.g} г · ${fmt(v.k)} ккал · Б ${r0(v.p)} Ж ${r0(v.f)} У ${r0(v.c)}</span></span><span class="plus">${icon("plus")}</span></button>`; }
  function listFoods() {
    const fl = $("#fl"), q = normS(add.q || "");
    let html = "";
    if (!q) {
      if (S.combos.length) html += `<div class="subh">Мои наборы</div>` + S.combos.map((c) => { const k = c.items.reduce((a, e) => a + e.k, 0); return `<button class="fitem" data-combo="${c.id}"><span class="fic t-cal">${icon("star")}</span><span class="ft"><b>${esc(c.n)}</b><span>${c.items.length} ${plural(c.items.length, "продукт", "продукта", "продуктов")} · ${fmt(k)} ккал</span></span><span class="plus">${icon("right")}</span></button>`; }).join("");
      const rec = S.recent.map((n) => allFoods().find((f) => f.n === n)).filter(Boolean);
      if (rec.length) html += `<div class="subh">Недавние</div>` + rec.slice(0, 6).map(foodRow).join("");
      if (S.my.length) html += `<div class="subh">Мои продукты</div>` + S.my.slice(0, 8).map(foodRow).join("");
      html += `<div class="subh">Популярное</div>` + window.FOODS.slice(0, 16).map(foodRow).join("");
    } else {
      const res = allFoods().filter((f) => normS(f.n).includes(q) || (f.t || []).some((t) => normS(t).includes(q)));
      res.sort((a, b) => { const ia = normS(a.n).indexOf(q), ib = normS(b.n).indexOf(q); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });
      html = res.length ? res.slice(0, 40).map(foodRow).join("") : `<div class="empty"><div class="em">${icon("search")}</div><b>Ничего не нашлось</b><p>Добавь продукт вручную, он сохранится в «Мои продукты».</p><button class="btn sm" id="to-man">Ввести вручную</button></div>`;
    }
    fl.innerHTML = `<div class="stagger">${html}</div>`;
    $$(".stagger > *", fl).forEach((el, i) => (el.style.animationDelay = Math.min(i, 12) * 0.022 + "s"));
    $$(".fitem", fl).forEach((el) => (el.onclick = () => (el.dataset.combo ? (haptic("light"), comboSheet(el.dataset.combo)) : portion(allFoods().find((f) => f.n === el.dataset.n)))));
    if ($("#to-man")) $("#to-man").onclick = () => { add.tab = "manual"; add.man = { n: add.q, k: "", g: "", p: "", f: "", c: "", save: true }; renderAdd(0); };
  }
  function portion(f, backFn, g0) {
    if (!f) return; haptic("light");
    const st = { g: g0 || f.g };
    const body = `<div class="portion">
      <div class="pn">${ficHTML(f)}<div style="min-width:0"><b>${esc(f.n)}</b><span>${fmt(f.k)} ккал на 100 г</span></div></div>
      <div class="kbig"><span class="num" id="po-k">0</span><span class="u">ккал</span></div>
      <div class="macros" id="po-m"></div>
      <div class="prow-ln"><span>Порция</span>${stepperHTML("g", st.g, "г", 10)}</div>
      <input type="range" id="po-r" min="5" max="${Math.max(600, f.g * 3)}" step="5" value="${st.g}">
      <div class="presets">${[["½ порции", 0.5], ["Порция", 1], ["×1,5", 1.5], ["×2", 2]].map(([l, m]) => `<button class="fchip" data-pm="${m}">${l}</button>`).join("")}</div>
    </div>
    ${mealLine("po-meal", add.meal)}`;
    const back = backFn || (() => renderAdd(-1));
    if (sheetOpen) setSheet(f.n, body, `<button class="btn" id="po-add">Добавить</button>`, back, 1); else openSheet(f.n, body, `<button class="btn" id="po-add">Добавить</button>`, { back });
    let first = true;
    const upd = () => {
      const v = scaleFood(f, st.g);
      if (first) { countUp($("#po-k"), r0(v.k), { from: 0, dur: 600 }); first = false; } else { $("#po-k")._cu = null; $("#po-k").textContent = fmt(v.k); }
      $("#po-m").innerHTML = macroTags(v, true);
      const r = $("#po-r"); r.value = st.g; setRangeFill(r);
      $$("[data-pm]").forEach((b) => b.classList.toggle("on", Math.round(f.g * +b.dataset.pm) === st.g));
      $("#po-add").textContent = `Добавить · ${fmt(v.k)} ккал`;
    };
    bindSteppers($("#sh-body"), st, { g: [5, 3000] }, upd);
    $("#po-r").oninput = (e) => { st.g = +e.target.value; $('[data-step="g"] [data-v]').textContent = st.g; upd(); };
    $$("[data-pm]").forEach((b) => (b.onclick = () => { st.g = Math.round(f.g * +b.dataset.pm); $('[data-step="g"] [data-v]').textContent = st.g; haptic("sel"); upd(); }));
    bindMealLine("po-meal", (v) => (add.meal = v));
    $("#po-add").onclick = () => { const v = scaleFood(f, st.g); addEntries([{ n: f.n, cat: f.cat, g: st.g, ...v }], add.meal); afterAdd(v.k); };
    upd();
  }

  // ----- manual -----
  function renderManual() {
    const b = $("#a-body");
    const m = add.man || (add.man = { n: "", k: "", g: "", p: "", f: "", c: "", save: true });
    b.innerHTML = `<label class="field"><span>Название</span><input id="m-n" placeholder="Например, домашний суп" value="${esc(m.n)}" maxlength="60"></label>
      <div class="row2" style="margin-top:10px"><label class="field"><span>Калории</span><input id="m-k" inputmode="decimal" placeholder="0" value="${esc(m.k)}"></label><label class="field"><span>Вес порции, г</span><input id="m-g" inputmode="decimal" placeholder="не обязательно" value="${esc(m.g)}"></label></div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-top:10px">
        <label class="field"><span>Белки, г</span><input id="m-p" inputmode="decimal" placeholder="0" value="${esc(m.p)}"></label>
        <label class="field"><span>Жиры, г</span><input id="m-f" inputmode="decimal" placeholder="0" value="${esc(m.f)}"></label>
        <label class="field"><span>Углев., г</span><input id="m-c" inputmode="decimal" placeholder="0" value="${esc(m.c)}"></label>
      </div>
      <div class="list" style="margin-top:12px"><button class="prow" id="m-save"><span class="pl"><b>Сохранить в «Мои продукты»</b><span>Чтобы потом добавлять в один тап</span></span><span class="toggle ${m.save ? "on" : ""}"></span></button></div>
      <p class="note">Если знаешь только белки, жиры и углеводы, калории посчитаются сами. Данные можно взять с упаковки.</p>`;
    const num = (v) => parseFloat(String(v).replace(",", ".")) || 0;
    const upd = () => {
      ["n", "k", "g", "p", "f", "c"].forEach((k) => (m[k] = $("#m-" + k).value));
      let k = num(m.k); if (!k && (num(m.p) || num(m.f) || num(m.c))) k = num(m.p) * 4 + num(m.f) * 9 + num(m.c) * 4;
      footBtn(k ? `Добавить · ${fmt(k)} ккал` : "Добавить", "m-add", !(m.n.trim() && k));
      if ($("#m-add")) $("#m-add").onclick = () => {
        const g = num(m.g) || 100, it = { n: m.n.trim(), g, k, p: num(m.p), f: num(m.f), c: num(m.c) };
        it.cat = catOf(it.n);
        if (m.save && !S.my.find((x) => x.n === it.n)) S.my.unshift({ n: it.n, cat: it.cat, g, k: (k / g) * 100, p: (it.p / g) * 100, f: (it.f / g) * 100, c: (it.c / g) * 100, t: [] });
        it.src = "manual"; addEntries([it], add.meal); add.man = null; afterAdd(k);
      };
    };
    $$("input", b).forEach((i) => (i.oninput = upd));
    $("#m-save").onclick = () => { m.save = !m.save; $("#m-save .toggle").classList.toggle("on", m.save); haptic("sel"); };
    upd();
  }

  // =====================================================================
  // HISTORY
  // =====================================================================
  let hist = { range: "week", sel: null };
  function renderHistory() {
    const s = $("#s-history");
    s.innerHTML = `<div class="top"><div><h1>История</h1><div class="date">Статистика и вес</div></div></div>
      <div style="margin-top:24px">${segHTML("range", [["week", "7 дней"], ["month", "30 дней"]], hist.range)}</div>
      <div class="gap"></div>
      <div class="card" id="h-card"></div>
      <div class="msum" id="h-stats"></div>
      <div class="gap"></div>
      <div class="card" id="w-card"></div>
      <div class="section-h"><h2>По дням</h2></div>
      <div id="h-days"></div>`;
    bindSeg(s, "range", (v) => { hist.range = v; hist.sel = null; drawHist(true); });
    drawHist(); requestAnimationFrame(drawWeight);
  }
  const histDays = () => { const n = hist.range === "week" ? 7 : 30, end = new Date(); return Array.from({ length: n }, (_, i) => dkey(addDays(end, i - n + 1))); };
  function drawHist(swap) {
    const days = histDays(), nm = norm(), vals = days.map((k) => totals(k));
    const month = hist.range === "month";
    const maxV = Math.max(nm.k * 1.25, ...vals.map((v) => v.k)), rows = month ? 16 : 14, unit = maxV / rows;
    const sel = hist.sel || days[days.length - 1], sv = totals(sel);
    const nrmRow = Math.round(nm.k / unit), step = month ? 7 : 10, gapPx = month ? 3 : 4;
    const card = $("#h-card");
    if (swap) { card.classList.remove("fade-sw"); void card.offsetWidth; card.classList.add("fade-sw"); }
    card.innerHTML = `<div class="c-head"><span class="card-t" id="h-day">${dayLabel(sel)}</span></div>
      <div class="mid" style="margin-top:10px"><span class="num" id="h-val">${fmt(sv.k)}</span><span class="u muted">ккал</span></div>
      <div class="macros" id="h-mac">${macroTags(sv, true)}</div>
      <div class="hbars-wrap">
      <div class="hbars ${month ? "month" : ""}" id="hbars">${days.map((k, i) => {
        const v = vals[i].k, on = Math.round(v / unit); let dots = "";
        for (let r = 0; r < rows; r++) dots += `<i class="${r < on ? (r >= nrmRow ? "ov" : "on") : r < nrmRow ? "" : "x"}"></i>`;
        return `<button class="hb ${k === sel ? "sel" : ""}" data-k="${k}" aria-label="${dayLabel(k)}" style="transition-delay:${(i * (month ? 0.014 : 0.04)).toFixed(3)}s">${dots}</button>`;
      }).join("")}</div></div>
      <div class="hlabels ${month ? "month" : ""}">${days.map((k, i) => { const d = fromKey(k); const lab = month ? (i % 5 === 4 || i === 0 ? d.getDate() : "") : WD[d.getDay()]; return `<span class="${k === sel ? "sel" : ""}">${lab}</span>`; }).join("")}</div>
      <div class="legend"><span><i style="background:var(--cal-b)"></i>съедено</span><span><i style="background:var(--g20)"></i>до нормы ${fmt(nm.k)}</span><span><i style="background:var(--pro-b)"></i>сверх нормы</span></div>`;
    raf2(() => $("#hbars").classList.add("go"));
    lastVals.set("hv", r0(sv.k));
    $$("#hbars .hb").forEach((b, i) => (b.onclick = () => {
      hist.sel = b.dataset.k; haptic("sel");
      $$("#hbars .hb").forEach((x) => x.classList.toggle("sel", x === b));
      $$(".hlabels span").forEach((x, j) => x.classList.toggle("sel", j === i));
      const v = totals(hist.sel);
      $("#h-day").textContent = dayLabel(hist.sel);
      countUp($("#h-val"), r0(v.k), { key: "hv", dur: 500 });
      $("#h-mac").innerHTML = macroTags(v, true);
    }));
    const filled = days.filter((k) => dayEntries(k).length);
    const avg = (f) => (filled.length ? filled.reduce((a, k) => a + totals(k)[f], 0) / filled.length : 0);
    const inNorm = filled.filter((k) => status(k) === "in").length;
    $("#h-stats").innerHTML = `<div class="stat"><span class="sl">В среднем</span><b class="num"><span id="st-a">${filled.length ? 0 : "—"}</span></b><span class="ss">ккал в день</span></div>
      <div class="stat"><span class="sl">Белок</span><b class="num"><span id="st-p">0</span><span class="u">г</span></b><span class="ss">норма ${nm.p} г</span></div>
      <div class="stat"><span class="sl">В норме</span>${filled.length ? `<b class="num">${inNorm}<span class="u">из ${filled.length}</span></b><span class="ss">${plural(filled.length, "дня", "дней", "дней")}</span>` : `<b class="num">—</b><span class="ss">нет записей</span>`}</div>`;
    if (filled.length) { countUp($("#st-a"), r0(avg("k")), { from: 0 }); countUp($("#st-p"), r0(avg("p")), { from: 0 }); }
    const list = days.slice().reverse().filter((k) => dayEntries(k).length);
    $("#h-days").innerHTML = list.length ? `<div class="list">${list.map((k) => {
      const v = totals(k), pc = Math.round((v.k / nm.k) * 100), st = status(k), dl = dayLabel(k);
      return `<button class="prow" data-k="${k}"><span class="pi ${st === "ov" ? "t-pro" : st === "in" ? "t-cal" : "t-n"} pd">${fromKey(k).getDate()}</span><span class="pl"><b>${dl === "Сегодня" || dl === "Вчера" ? dl : cap(WDF[fromKey(k).getDay()])}</b><span>${dayEntries(k).length} ${plural(dayEntries(k).length, "запись", "записи", "записей")} · белки ${r0(v.p)} г</span></span><span class="pv pv2"><b>${fmt(v.k)}</b><span>${pc}% нормы</span></span></button>`;
    }).join("")}</div>` : `<div class="card"><div class="empty"><div class="em">${icon("chart")}</div><b>Здесь появится статистика</b><p>Добавляй еду каждый день, и тут будет видно, сколько ты ешь в среднем.</p></div></div>`;
    $$("#h-days [data-k]").forEach((b) => (b.onclick = () => { selDay = b.dataset.k; weekAnchor = fromKey(selDay); show("today"); }));
  }
  function drawWeight() {
    const box = $("#w-card");
    const ent = Object.entries(S.weights).sort((a, b) => a[0].localeCompare(b[0]));
    const last = ent.length ? ent[ent.length - 1][1] : S.profile.weight;
    const m30 = ent.filter(([k]) => fromKey(k) >= addDays(new Date(), -30));
    const delta = m30.length > 1 ? last - m30[0][1] : 0;
    const pts = ent.slice(-14);
    let chart = "";
    if (pts.length > 1) {
      const W = 320, H = 150, PL = 40, PR = 12, PT = 16, PB = 16;
      const vs = pts.map((p) => p[1]); let mn = Math.min(...vs), mx = Math.max(...vs);
      if (mx - mn < 1) { const c = (mx + mn) / 2; mn = c - 0.5; mx = c + 0.5; }
      const X = (i) => PL + (i / (pts.length - 1)) * (W - PL - PR), Y = (v) => PT + (1 - (v - mn) / (mx - mn)) * (H - PT - PB);
      const xy = pts.map((p, i) => [X(i), Y(p[1])]);
      let d = `M${xy[0][0].toFixed(1)} ${xy[0][1].toFixed(1)}`;
      for (let i = 0; i < xy.length - 1; i++) {
        const p0 = xy[i - 1] || xy[i], p1 = xy[i], p2 = xy[i + 1], p3 = xy[i + 2] || p2;
        const c1y = clamp(p1[1] + (p2[1] - p0[1]) / 6, PT, H - PB), c2y = clamp(p2[1] - (p3[1] - p1[1]) / 6, PT, H - PB);
        d += ` C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)} ${c1y.toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)} ${c2y.toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
      }
      chart = `<div class="wchart" id="wch"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><defs><linearGradient id="wgrad" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--fat-b)" stop-opacity=".28"/><stop offset="1" stop-color="var(--fat-b)" stop-opacity="0"/></linearGradient></defs>
        <line class="wgrid" x1="${PL}" x2="${W - PR}" y1="${PT}" y2="${PT}"/><line class="wgrid" x1="${PL}" x2="${W - PR}" y1="${H - PB}" y2="${H - PB}"/>
        <path class="warea" fill="url(#wgrad)" d="${d} L${xy[xy.length - 1][0].toFixed(1)} ${H - PB} L${xy[0][0].toFixed(1)} ${H - PB} Z"/>
        <path class="wline" d="${d}" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100" vector-effect="non-scaling-stroke"/></svg>
        <span class="wlab" style="top:${(PT / H) * 100}%">${dec(mx)}</span><span class="wlab" style="top:${((H - PB) / H) * 100}%">${dec(mn)}</span>
        ${xy.map((p, i) => `<span class="wdot ${i === xy.length - 1 ? "last" : ""}" style="left:${(p[0] / W) * 100}%;top:${(p[1] / H) * 100}%;transition-delay:${0.5 + i * 0.05}s"></span>`).join("")}</div>
        <div class="axis" style="padding-left:${(PL / W) * 100}%;padding-right:${(PR / W) * 100}%"><span>${fromKey(pts[0][0]).getDate()} ${MONS[fromKey(pts[0][0]).getMonth()]}</span><span>${fromKey(pts[pts.length - 1][0]).getDate()} ${MONS[fromKey(pts[pts.length - 1][0]).getMonth()]}</span></div>`;
    } else chart = `<p class="card-s" style="margin-top:16px">Отмечай вес раз в несколько дней утром натощак, и здесь появится график. Смотри на тренд, а не на отдельные дни.</p>`;
    box.innerHTML = `<div class="c-head"><span class="c-title"><span class="ins-ic t-fat sm">${icon("scale")}</span>Вес</span><button class="btn sm ghost" id="w-add">${icon("plus")}Записать</button></div>
      <div class="w-now"><div class="mid"><span class="num">${dec(last)}</span><span class="u muted">кг</span></div>
      ${delta ? `<span class="mtag ${(delta > 0) === (S.profile.goal !== "lose") ? "c" : "p"}">${delta > 0 ? "+" : "−"}${dec(Math.abs(delta))} кг за 30 дней</span>` : ""}</div>${S.plan ? `<div class="w-goal">${icon("flag")}Цель ${dec(S.plan.target)} кг · ${Math.round(planInfo().done * 100)}% пути</div>` : ""}${chart}`;
    if ($("#wch")) raf2(() => { $("#wch").classList.add("go"); $("#wch .wline").style.strokeDashoffset = 0; });
    $("#w-add").onclick = weightSheet;
  }
  function weightSheet() {
    const ent = Object.entries(S.weights).sort((a, b) => a[0].localeCompare(b[0]));
    const st = { w: ent.length ? ent[ent.length - 1][1] : S.profile.weight };
    openSheet("Вес сегодня", `<div class="portion" style="display:flex;flex-direction:column;align-items:center;padding:30px 22px">
        ${stepperHTML("w", st.w, "кг", 0.1, "big")}
        <p class="note" style="text-align:center;padding:18px 0 0">Лучше взвешиваться утром натощак. ${S.profile.manual.on ? "" : "Норма калорий пересчитается под новый вес."}</p></div>`,
      `<button class="btn" id="ws-save">Сохранить</button>`);
    bindSteppers($("#sh-body"), st, { w: [30, 250] });
    $("#ws-save").onclick = () => {
      S.weights[todayKey()] = st.w; S.profile.weight = st.w; save(); haptic("ok");
      if (cur === "history") drawWeight(); if (cur === "today") updateToday();
      const a = checkAch();
      if (S.plan) { planCheck(); if (a) celebrate(a); return; }
      closeSheet(); toast("Вес записан"); if (a) celebrate(a);
    };
  }

  // =====================================================================
  // CALENDAR
  // =====================================================================
  let calMonth = null, calSel = null;
  function renderCalendar() {
    const s = $("#s-calendar");
    if (!calMonth) { const d = fromKey(selDay); calMonth = new Date(d.getFullYear(), d.getMonth(), 1); }
    if (!calSel) calSel = selDay;
    s.innerHTML = `<div class="top"><div><h1>Календарь</h1><div class="date">Общая картина по дням</div></div></div>
      <div class="gap" style="height:24px"></div>
      <div class="card" id="cal-card"></div>
      <div class="msum" id="cal-sum"></div>
      <div class="gap"></div>
      <div id="cal-day"></div>`;
    drawCal(0);
  }
  function drawCal(dir) {
    const card = $("#cal-card"), y = calMonth.getFullYear(), m = calMonth.getMonth();
    const first = new Date(y, m, 1), start = monday(first), now = new Date(), tk = todayKey();
    const canNext = new Date(y, m + 1, 1) <= now;
    let cells = "";
    for (let i = 0; i < 42; i++) {
      const d = addDays(start, i); if (i >= 35 && d.getMonth() !== m) break;
      const k = dkey(d), out = d.getMonth() !== m, fut = d > now && k !== tk, st = status(k);
      cells += `<button class="cd ${out ? "out" : ""} ${fut ? "fut" : ""} ${k === tk ? "today" : ""} ${k === calSel ? "sel" : ""} ${st}" data-k="${k}">${d.getDate()}<i></i></button>`;
    }
    card.innerHTML = `<div class="cal-head"><b>${cap(MONN[m])} ${y}</b><div class="cal-nav"><button id="cal-p" aria-label="Предыдущий месяц">${icon("back")}</button><button id="cal-n" aria-label="Следующий месяц" ${canNext ? "" : "disabled"}>${icon("right")}</button></div></div>
      <div class="cal-wd">${["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((w) => `<span>${w}</span>`).join("")}</div>
      <div class="cal-grid ${dir > 0 ? "anim" : dir < 0 ? "anim back" : ""}" id="cal-grid">${cells}</div>
      <div class="legend"><span><i style="background:var(--ok)"></i>в норме</span><span><i style="background:var(--pro-b)"></i>сверх нормы</span><span><i style="background:var(--g40)"></i>меньше нормы</span></div>`;
    $("#cal-p").onclick = () => { calMonth = new Date(y, m - 1, 1); haptic("light"); drawCal(-1); };
    $("#cal-n").onclick = () => { calMonth = new Date(y, m + 1, 1); haptic("light"); drawCal(1); };
    $("#cal-grid").onclick = (e) => { const b = e.target.closest(".cd"); if (!b || b.classList.contains("fut")) return; calSel = b.dataset.k; haptic("sel"); if (b.classList.contains("out")) { const d = fromKey(calSel); calMonth = new Date(d.getFullYear(), d.getMonth(), 1); drawCal(d < first ? -1 : 1); return; } $$(".cd", card).forEach((x) => x.classList.toggle("sel", x === b)); drawCalDay(); };
    let x0 = null; const g = $("#cal-grid");
    g.ontouchstart = (e) => (x0 = e.touches[0].clientX);
    g.ontouchend = (e) => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) < 60) return; if (dx < 0 && canNext) $("#cal-n").click(); if (dx > 0) $("#cal-p").click(); };
    // итоги месяца
    const keys = []; for (let d = new Date(first); d.getMonth() === m && d <= now; d = addDays(d, 1)) keys.push(dkey(d));
    const logged = keys.filter((k) => dayEntries(k).length);
    const avg = logged.length ? logged.reduce((a, k) => a + totals(k).k, 0) / logged.length : 0;
    const inN = logged.filter((k) => status(k) === "in").length;
    $("#cal-sum").innerHTML = `<div class="stat"><span class="sl">С записями</span><b class="num">${logged.length}<span class="u">из ${keys.length}</span></b><span class="ss">${plural(keys.length, "дня", "дней", "дней")}</span></div>
      <div class="stat"><span class="sl">В среднем</span><b class="num">${fmt(avg)}</b><span class="ss">ккал в день</span></div>
      <div class="stat"><span class="sl">В норме</span><b class="num">${inN}</b><span class="ss">${plural(inN, "день", "дня", "дней")}</span></div>`;
    if (calSel && fromKey(calSel).getMonth() !== m) calSel = null;
    drawCalDay();
  }
  function drawCalDay() {
    const box = $("#cal-day");
    if (!calSel) { box.innerHTML = ""; return; }
    const k = calSel, t = totals(k), nm = norm(), n = dayEntries(k).length, d = fromKey(k);
    box.classList.remove("fade-sw"); void box.offsetWidth; box.classList.add("fade-sw");
    box.innerHTML = `<div class="card"><div class="c-head cd-head"><div><div class="cd-date">${d.getDate()} ${MON[d.getMonth()]}</div><div class="card-s" style="margin-top:3px">${cap(WDF[d.getDay()])} · ${n ? n + " " + plural(n, "запись", "записи", "записей") : "записей нет"}</div></div>${n ? `<span class="mtag k">${Math.round((t.k / nm.k) * 100)}% нормы</span>` : ""}</div>
      ${n ? `<div class="mid"><span class="num">${fmt(t.k)}</span><span class="u muted">ккал</span></div><div class="macros">${macroTags(t, true)}</div>${dotRow(24, "ink")}` : ""}
      <div class="btn-row" style="margin-top:20px"><button class="btn ${n ? "" : "ghost"}" id="cal-open">${n ? "Открыть день" : "Добавить еду в этот день"}</button></div></div>`;
    if (n) setDots($(".drow", box), t.k, nm.k);
    $("#cal-open").onclick = () => { selDay = k; weekAnchor = fromKey(k); show("today"); if (!n) setTimeout(() => openAdd(), 350); };
  }

  // =====================================================================
  // PROFILE
  // =====================================================================
  function renderProfile() {
    const s = $("#s-profile"), p = S.profile, nm = norm(), auto = calcNorm(), t = p.train;
    const u = inTg && tg.initDataUnsafe && tg.initDataUnsafe.user;
    const trainTxt = t.n ? `${t.n} × ${t.min} мин` : "Нет";
    const allDays = Object.keys(S.days).filter((k) => S.days[k].length);
    const nEntries = allDays.reduce((a, k) => a + S.days[k].length, 0);
    const sti = streakInfo(), streak = sti.n;
    s.innerHTML = `<div class="top"><div><h1>Профиль</h1><div class="date">Настройки и норма</div></div></div>
      <div class="gap" style="height:24px"></div>
      <div class="card p-card">
        <div class="p-row">
          <button class="p-ava" id="pr-ava" aria-label="Сменить фото">${avatarInner()}<span class="p-ava-edit">${icon("cam")}</span></button>
          <div class="p-id"><b>${esc(p.name || "Без имени")}</b><span>${u && u.username ? "@" + esc(u.username) + " · " : ""}${p.sex === "f" ? "Жен." : "Муж."}, ${p.age} · ${p.height} см · ${dec(p.weight)} кг</span></div>
          <button class="p-edit" id="pr-name" aria-label="Изменить имя">${icon("edit")}</button>
        </div>
        <div class="p-stats">
          <div><span>Серия</span><b class="num">${streak}<span class="u">${plural(streak, "день", "дня", "дней")}</span></b></div>
          <div><span>Рекорд</span><b class="num">${sti.best}</b></div>
          <div><span>Записей</span><b class="num">${fmt(nEntries)}</b></div>
        </div>
      </div>
      <div class="gap"></div>
      <div class="grad g-cal">
        <div class="c-head"><span class="c-title"><span class="ic">${icon("flame")}</span>Норма</span><span class="chip" id="pr-chip"></span></div>
        <div class="big"><span class="num" id="pr-k">0</span><span class="of">ккал</span></div>
        <div class="stats3"><div><span>Белки</span><b class="num"><span id="pr-p">0</span> г</b></div><div><span>Жиры</span><b class="num"><span id="pr-f">0</span> г</b></div><div><span>Углеводы</span><b class="num"><span id="pr-c">0</span> г</b></div></div>
        <div class="p-tdee" id="pr-tdee"></div>
      </div>
      <div class="ptitle">Цель</div>
      <div class="list" style="margin-bottom:8px"><button class="prow" id="pr-plan"><span class="pi">${icon("flag")}</span><span class="pl"><b>Цель по весу</b><span>${S.plan ? (S.plan.type === "lose" ? "До " : "До ") + dec(S.plan.target) + " кг · " + Math.round(planInfo().done * 100) + "% пути" : "Не задана"}</span></span><span class="pv">${icon("right")}</span></button></div>
      ${segHTML("goal", [["lose", "Похудеть"], ["keep", "Форма"], ["gain", "Масса"]], p.goal)}
      <div class="ptitle">Параметры</div>
      <div class="list">
        ${prow("pa", "user", "Пол и возраст", (p.sex === "f" ? "Жен." : "Муж.") + ", " + p.age)}
        ${prow("ph", "equal", "Рост", p.height + " см")}
        ${prow("pw", "scale", "Вес", dec(p.weight) + " кг")}
        ${prow("pt", "dumbbell", "Тренировки", trainTxt)}
        ${prow("ps", "steps", "Шаги в день", p.steps ? fmt(p.steps) : "Не указано")}
      </div>
      <div class="ptitle">Расчёт нормы</div>
      <div class="list">
        <button class="prow" id="pc-t"><span class="pl"><b>Учитывать баланс недели</b><span>Недобор прошлых дней переносится на сегодня</span></span><span class="toggle ${S.settings.carry ? "on" : ""}"></span></button>
        <button class="prow" id="pm-t"><span class="pl"><b>Задать вручную</b><span>Если тренер или врач дал свои цифры</span></span><span class="toggle ${p.manual.on ? "on" : ""}"></span></button>
        <div id="pm-f" class="collapse ${p.manual.on ? "open" : ""}"><div><div style="padding:2px 0 16px">
          <div class="row2"><label class="field"><span>Калории</span><input data-m="k" inputmode="numeric" value="${p.manual.k}"></label><label class="field"><span>Белки, г</span><input data-m="p" inputmode="numeric" value="${p.manual.p}"></label></div>
          <div class="row2" style="margin-top:10px"><label class="field"><span>Жиры, г</span><input data-m="f" inputmode="numeric" value="${p.manual.f}"></label><label class="field"><span>Углеводы, г</span><input data-m="c" inputmode="numeric" value="${p.manual.c}"></label></div>
        </div></div></div>
      </div>
      <div class="ptitle">Оформление</div>
      ${segHTML("theme", [["auto", "Авто"], ["light", "Светлая"], ["dark", "Тёмная"]], S.settings.theme)}
      <div class="ptitle">Приложение</div>
      <button class="home-card" id="pr-home"><img src="logo.png" alt="Nomi"><span class="hc-t"><b>Иконка на телефон</b><span>Открывай Nomi в одно касание</span></span><span class="hc-btn">Добавить</span></button>
      <div class="list">
        <button class="prow" id="pr-key"><span class="pi">${icon("key")}</span><span class="pl"><b>Распознавание фото</b><span>${S.settings.key ? "Ключ Gemini добавлен" : "Нужен бесплатный ключ Gemini"}</span></span><span class="pv">${S.settings.key ? `<span class="mtag c">Вкл</span>` : ""}${icon("right")}</span></button>
        <button class="prow" id="d-redo"><span class="pi">${icon("refresh")}</span><span class="pl"><b>Пройти анкету заново</b><span>Пересчитать норму с нуля</span></span><span class="pv">${icon("right")}</span></button>
        <button class="prow danger" id="d-reset"><span class="pi t-pro">${icon("trash")}</span><span class="pl"><b>Удалить все данные</b><span>Записи еды, вес и настройки</span></span></button>
      </div>
      <p class="note" style="text-align:center;margin-top:20px">Nomi · калории и КБЖУ ориентировочные</p>`;
    updNormCard();
    bindSeg(s, "goal", (v) => { if (S.plan && S.plan.type !== v) { S.plan = null; toast("Цель по весу сброшена"); } p.goal = v; if (p.manual.on) { p.manual.on = false; $("#pm-t .toggle").classList.remove("on"); $("#pm-f").classList.remove("open"); } save(); updNormCard(); });
    bindSeg(s, "theme", (v) => { S.settings.theme = v; save(); applyTheme(true); });
    $$(".prow[data-ed]", s).forEach((b) => (b.onclick = () => editParam(b.dataset.ed)));
    $("#pr-ava").onclick = () => $("#f-ava").click();
    $("#pr-name").onclick = nameSheet;
    $("#pm-t").onclick = () => {
      p.manual.on = !p.manual.on;
      if (p.manual.on && !p.manual.k) { const a = calcNorm(); Object.assign(p.manual, { k: a.k, p: a.p, f: a.f, c: a.c }); $$("[data-m]", s).forEach((i) => (i.value = p.manual[i.dataset.m])); }
      save(); haptic("sel"); $("#pm-t .toggle").classList.toggle("on", p.manual.on); $("#pm-f").classList.toggle("open", p.manual.on); updNormCard();
    };
    $$("[data-m]", s).forEach((i) => (i.oninput = () => { p.manual[i.dataset.m] = Math.max(0, parseInt(i.value, 10) || 0); save(); updNormCard(); }));
    $("#pc-t").onclick = () => { S.settings.carry = !S.settings.carry; save(); haptic("sel"); $("#pc-t .toggle").classList.toggle("on", S.settings.carry); lastVals.delete("wk"); };
    $("#pr-key").onclick = keySheet;
    $("#pr-home").onclick = addHome;
    $("#pr-plan").onclick = () => openGoal(renderProfile);
    $("#d-redo").onclick = () => startOnboarding();
    $("#d-reset").onclick = confirmReset;
  }
  function updNormCard() {
    const p = S.profile, nm = norm(), auto = calcNorm(), adj = GOALS[p.goal].adj;
    if (!$("#pr-k")) return;
    $("#pr-chip").textContent = p.manual.on ? "Задана вручную" : GOALS[p.goal].n;
    countUp($("#pr-k"), nm.k, { key: "prk" }); countUp($("#pr-p"), nm.p, { key: "prp" }); countUp($("#pr-f"), nm.f, { key: "prf" }); countUp($("#pr-c"), nm.c, { key: "prc" });
    $("#pr-tdee").textContent = p.manual.on ? "Расчётная норма " + fmt(auto.k) + " ккал" : "Расход около " + fmt(auto.tdee) + " ккал" + (adj ? (adj > 0 ? ". Профицит " : ". Дефицит ") + fmt(Math.abs(auto.k - auto.tdee)) + " ккал" : "");
  }
  const prow = (ed, ic, l, v) => `<button class="prow" data-ed="${ed}"><span class="pi">${icon(ic)}</span><span class="pl"><b>${l}</b></span><span class="pv">${esc(v)}${icon("right")}</span></button>`;
  $("#f-ava").addEventListener("change", async (e) => {
    const f = e.target.files[0]; e.target.value = ""; if (!f) return;
    try { const { full } = await compress(f, 320, 0, true); S.profile.avatar = full; save(); haptic("ok"); renderProfile(); toast("Фото обновлено"); } catch (err) { toast("Не удалось открыть фото"); }
  });
  function addHome() {
    haptic("light");
    if (inTg && tg.addToHomeScreen && tg.isVersionAtLeast && tg.isVersionAtLeast("8.0")) {
      try { tg.addToHomeScreen(); tg.onEvent("homeScreenAdded", () => toast("Nomi добавлен на экран «Домой»")); return; } catch (e) {}
    }
    const ios = /iPhone|iPad/.test(navigator.userAgent);
    openSheet("На экран «Домой»", `<div class="hs-big"><img src="logo.png" alt=""><b>Nomi</b></div>
      <div class="card"><div class="card-t">Как добавить</div><div class="card-s" style="margin-top:8px;line-height:1.6">${inTg ? "Обнови Telegram до последней версии: тогда кнопка добавит иконку сама.<br><br>Или открой меню бота (три точки сверху) и выбери «Добавить на экран „Домой“»." : ios ? "1. Нажми «Поделиться» внизу Safari.<br>2. Выбери «На экран „Домой“».<br>3. Нажми «Добавить»." : "1. Открой меню браузера (три точки).<br>2. Выбери «Добавить на главный экран».<br>3. Подтверди."}</div></div>`, `<button class="btn" id="hs-ok">Понятно</button>`);
    $("#hs-ok").onclick = closeSheet;
  }
  function nameSheet() {
    openSheet("Имя", `<label class="field"><span>Как к тебе обращаться</span><input id="nm-in" maxlength="20" value="${esc(S.profile.name)}" placeholder="Имя"></label>${S.profile.avatar ? `<div class="list" style="margin-top:12px"><button class="prow danger" id="nm-ava"><span class="pi t-pro">${icon("trash")}</span><span class="pl"><b>Удалить фото профиля</b></span></button></div>` : ""}`, `<button class="btn" id="nm-save">Сохранить</button>`);
    setTimeout(() => $("#nm-in") && $("#nm-in").focus(), 350);
    $("#nm-save").onclick = () => { S.profile.name = $("#nm-in").value.trim(); save(); closeSheet(); haptic("ok"); renderProfile(); };
    if ($("#nm-ava")) $("#nm-ava").onclick = () => { S.profile.avatar = ""; save(); closeSheet(); renderProfile(); toast("Фото удалено"); };
  }
  function editParam(which) {
    const p = S.profile;
    const st = { age: p.age, height: p.height, weight: p.weight, sex: p.sex, train: Object.assign({}, p.train), steps: p.steps };
    let body = "";
    if (which === "pa") body = `<div class="nrow"><span><b>Пол</b></span>${segHTML("sx", [["m", "Мужской"], ["f", "Женский"]], st.sex)}</div><div class="nrow"><span><b>Возраст</b></span>${stepperHTML("age", st.age, "")}</div>`;
    if (which === "ph") body = `<div class="nrow"><span><b>Рост</b></span>${stepperHTML("height", st.height, "см")}</div>`;
    if (which === "pw") body = `<div class="nrow"><span><b>Вес</b></span>${stepperHTML("weight", st.weight, "кг", 0.5)}</div>`;
    if (which === "pt" || which === "ps") body = trainFields(st) + `<p class="note">Тренировки и шаги добавляют к норме средний расход за день. Например, 3 силовые по часу дают около ${fmt((3 * 60 * 5 * 3.5 * p.weight) / 200 / 7)} ккал в день.</p>`;
    openSheet({ pa: "Пол и возраст", ph: "Рост", pw: "Вес", pt: "Активность", ps: "Активность" }[which], body, `<button class="btn" id="ep-save">Сохранить</button>`);
    const root = $("#sh-body");
    bindSteppers(root, st, { age: [14, 90], height: [130, 220], weight: [35, 200] });
    bindSeg(root, "sx", (v) => (st.sex = v));
    bindTrain(root, st);
    $("#ep-save").onclick = () => {
      Object.assign(p, { age: st.age, height: st.height, weight: st.weight, sex: st.sex, train: st.train, steps: st.steps });
      if (which === "pw") S.weights[todayKey()] = st.weight;
      save(); closeSheet(); haptic("ok"); renderProfile(); toast("Норма пересчитана");
    };
  }
  function keySheet() {
    const back = sheetOpen && cur !== "profile" ? () => renderAdd(-1) : null;
    const body = `<div class="card"><div class="card-t">Как получить ключ</div>
        <div class="card-s" style="margin-top:8px">1. Открой Google AI Studio и войди в Google-аккаунт.<br>2. Нажми «Create API key» и скопируй ключ.<br>3. Вставь его сюда и нажми «Проверить».</div>
        <div class="btn-row"><button class="btn sm ghost" id="k-link">Открыть AI Studio ${icon("right")}</button></div></div>
      <div class="gap"></div>
      <label class="field"><span>Ключ Gemini API</span><input id="k-in" type="password" placeholder="AIza…" value="${esc(S.settings.key)}" autocomplete="off" spellcheck="false"></label>
      <div class="gap" style="height:10px"></div>
      <label class="field"><span>Модель</span><input id="k-model" value="${esc(S.settings.model)}" spellcheck="false"></label>
      <p class="note">Ключ хранится только на этом устройстве и в твоём Telegram. Фото отправляются в Google для распознавания.</p>`;
    const foot = `<div class="btn-row" style="margin:0"><button class="btn ghost" id="k-test">Проверить</button><button class="btn" id="k-save">Сохранить</button></div>`;
    if (sheetOpen) setSheet("Распознавание фото", body, foot, back, 1); else openSheet("Распознавание фото", body, foot);
    $("#k-link").onclick = () => { const u = "https://aistudio.google.com/apikey"; if (inTg) tg.openLink(u); else window.open(u, "_blank", "noopener"); };
    $("#k-test").onclick = testKey;
    $("#k-save").onclick = () => {
      S.settings.key = $("#k-in").value.trim(); S.settings.model = $("#k-model").value.trim() || "gemini-flash-latest"; save(); haptic("ok");
      toast(S.settings.key ? "Ключ сохранён" : "Ключ удалён");
      if (back) back(); else { closeSheet(); if (cur === "profile") renderProfile(); }
    };
  }
  async function testKey() {
    const key = $("#k-in").value.trim(), model = $("#k-model").value.trim() || "gemini-flash-latest";
    if (!key) { toast("Сначала вставь ключ"); return; }
    const b = $("#k-test"); b.innerHTML = `<span class="spin dark"></span>`;
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body: JSON.stringify({ contents: [{ parts: [{ text: "Ответь одним словом: ок" }] }] }) });
      if (r.ok) { haptic("ok"); toast("Ключ работает"); S.settings.key = key; S.settings.model = model; save(); }
      else { haptic("err"); toast(r.status === 404 ? "Модель не найдена" : r.status === 429 ? "Лимит исчерпан" : "Ключ не подходит"); }
    } catch (e) { haptic("err"); toast("Нет соединения"); }
    b.textContent = "Проверить";
  }
  function confirmReset() {
    openSheet("Удалить всё?", `<div class="alert"><span class="ins-ic t-pro">${icon("trash")}</span><div><b>Это нельзя отменить</b>Записи еды, история веса, наборы, свои продукты и настройки будут удалены.</div></div>`,
      `<div class="btn-row" style="margin:0"><button class="btn ghost" id="rs-no">Отмена</button><button class="btn danger" id="rs-yes">Удалить</button></div>`);
    $("#rs-no").onclick = closeSheet;
    $("#rs-yes").onclick = () => {
      const theme = S.settings.theme; S = defaults(); S.settings.theme = theme; save();
      if (CS) { try { CS.getKeys((e, keys) => { if (keys && keys.length) CS.removeItems(keys); }); } catch (e) {} }
      closeSheet(); lastVals.clear(); haptic("medium"); selDay = todayKey(); weekAnchor = null; calMonth = null; calSel = null; startOnboarding();
    };
  }

  // ---------- nav ----------
  $("#fab").onclick = () => { haptic("medium"); openAdd(); };
  $$(".tab").forEach((b) => (b.onclick = () => {
    const id = b.dataset.tab; haptic("light");
    if (id === "today" && cur === "today") { window.scrollTo({ top: 0, behavior: "smooth" }); if (selDay !== todayKey()) selectDay(todayKey()); return; }
    if (id === "calendar" && cur !== "calendar") { calMonth = null; calSel = null; }
    show(id);
  }));
  let hiddenAt = 0;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") hiddenAt = Date.now();
    else if (cur === "today" && !sheetOpen && Date.now() - hiddenAt > 10 * 60 * 1000) buildToday();
  });

  // ---------- init ----------
  function init() {
    load();
    if (inTg) {
      try {
        tg.ready(); tg.expand(); if (tg.disableVerticalSwipes) tg.disableVerticalSwipes();
        tg.BackButton.onClick(goBack);
        tg.onEvent("themeChanged", () => { if (S.settings.theme === "auto") applyTheme(true); });
        const setTop = () => { const ci = tg.contentSafeAreaInset || {}; document.documentElement.style.setProperty("--tg-top", (ci.top || 0) + "px"); };
        setTop(); tg.onEvent("contentSafeAreaChanged", setTop);
      } catch (e) {}
    }
    applyTheme();
    cloudPull(() => {
      load(); applyTheme(); const fzUsed = S.onboarded ? gameInit() : 0; if (!S.onboarded) startOnboarding(); else show("today");
      if (fzUsed) setTimeout(() => toast(`Заморозка сохранила серию`, null, "snow"), 1400);
      const fonts = document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]) : Promise.resolve();
      fonts.then(() => {
        const wait = Math.max(0, 650 - performance.now());
        setTimeout(() => {
          const ld = $("#loader"); if (ld) { ld.classList.add("out"); setTimeout(() => ld.remove(), 500); }
          setTimeout(() => document.documentElement.classList.remove("boot"), 480);
        }, wait);
      });
    });
  }
  if (/[?&]demo/.test(location.search)) {
    try {
      const d = defaults(); d.onboarded = true; d.profile.name = "Эдем"; d.profile.steps = 7000;
      d.my = [{ n: "Домашний суп мамы", g: 350, k: 52, p: 3.1, f: 2.2, c: 5, t: [] }, { n: "Сырники", g: 150, k: 220, p: 14, f: 9, c: 20, t: [] }];
      const now = new Date(), pick = (n) => window.FOODS.find((f) => f.n === n);
      const mk = (n, g, h, m, off) => { const f = pick(n); if (!f) return null; const v = scaleFood(f, g), t = addDays(now, -off); t.setHours(h, 10, 0, 0); return { id: uid(), n: f.n, cat: catOf(f.n, f.cat), g, k: r0(v.k), p: r1(v.p), f: r1(v.f), c: r1(v.c), meal: m, t: +t }; };
      for (let o = 0; o < 40; o++) {
        if (o > 3 && o % 7 === 5) continue;
        const k = dkey(addDays(now, -o)), h = now.getHours();
        const arr = [];
        if (o > 0 || h >= 8) arr.push(mk("Овсянка на молоке", 300, 8, "breakfast", o), mk("Банан", 120, 8, "breakfast", o), mk("Протеин (порошок)", 30, 9, "breakfast", o));
        if (o > 0 || h >= 13) arr.push(mk(o % 3 ? "Плов" : "Лагман", 300 + (o % 4) * 40, 13, "lunch", o), mk("Лепёшка (нон)", 60 + (o % 3) * 30, 13, "lunch", o));
        if (o > 0 || h >= 16) arr.push(mk("Творог 5%", 180, 16, "snack", o));
        if (o > 0 || h >= 19) arr.push(mk(o % 2 ? "Куриная грудка варёная" : "Манты", o % 2 ? 200 : 250 + (o % 5) * 40, 19, "dinner", o), mk("Рис варёный", 200, 19, "dinner", o));
        if (o % 6 === 2) arr.push(mk("Шоколад", 50, 21, "snack", o));
        const ok = arr.filter(Boolean);
        if (ok.length) d.days[k] = ok;
        if (o % 3 === 0) d.weights[k] = r1(72.6 - (40 - o) * 0.02 + ((o * 7) % 5) * 0.08);
      }
      localStorage.setItem(KEY, JSON.stringify(d));
      history.replaceState(null, "", location.pathname);
    } catch (e) { console.error(e); }
  }
  init();
  window.__porsiya = { get state() { return S; }, show, openAdd };
})();
