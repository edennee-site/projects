/* Порция — трекер калорий по фото. Telegram Mini App, без сборки. */
(function () {
  "use strict";

  // ---------- helpers ----------
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const tg = window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData !== undefined ? window.Telegram.WebApp : null;
  const inTg = !!(tg && tg.platform && tg.platform !== "unknown");
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  const r0 = (n) => Math.round(n || 0);
  const r1 = (n) => Math.round((n || 0) * 10) / 10;
  const fmt = (n) => r0(n).toLocaleString("ru-RU").replace(/,/g, " ");
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const icon = (id, cls = "") => `<svg class="${cls}"><use href="#i-${id}"/></svg>`;
  const pad = (n) => String(n).padStart(2, "0");
  const dkey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const fromKey = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
  const todayKey = () => dkey(new Date());
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const WD = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
  const WDF = ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];
  const MON = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  const MONS = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
  const plural = (n, a, b, c) => { n = Math.abs(n) % 100; const n1 = n % 10; if (n > 10 && n < 20) return c; if (n1 > 1 && n1 < 5) return b; if (n1 === 1) return a; return c; };
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const haptic = (t = "light") => { try { if (!inTg) return; if (t === "ok") tg.HapticFeedback.notificationOccurred("success"); else if (t === "err") tg.HapticFeedback.notificationOccurred("error"); else if (t === "sel") tg.HapticFeedback.selectionChanged(); else tg.HapticFeedback.impactOccurred(t); } catch (e) {} };

  const MEALS = [
    { id: "breakfast", n: "Завтрак", e: "☀️" },
    { id: "lunch", n: "Обед", e: "🍲" },
    { id: "dinner", n: "Ужин", e: "🌙" },
    { id: "snack", n: "Перекус", e: "🍏" },
  ];
  const mealByTime = (d = new Date()) => { const h = d.getHours(); if (h >= 5 && h < 11) return "breakfast"; if (h >= 11 && h < 16) return "lunch"; if (h >= 16 && h < 22) return "dinner"; return "snack"; };
  const mealName = (id) => (MEALS.find((m) => m.id === id) || MEALS[3]).n;

  // ---------- state ----------
  const KEY = "porsiya.v1";
  const defaults = () => ({
    v: 1,
    onboarded: false,
    profile: { name: "", sex: "m", age: 26, height: 175, weight: 72, goal: "gain", activity: 2, manual: { on: false, k: 2600, p: 140, f: 75, c: 330 } },
    days: {},
    weights: {},
    my: [],
    recent: [],
    settings: { theme: "auto", key: "", model: "gemini-flash-latest" },
  });
  let S = defaults();
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw);
        S = Object.assign(defaults(), d);
        S.profile = Object.assign(defaults().profile, d.profile || {});
        S.profile.manual = Object.assign(defaults().profile.manual, (d.profile || {}).manual || {});
        S.settings = Object.assign(defaults().settings, d.settings || {});
      }
    } catch (e) { S = defaults(); }
  }
  let saveT = 0;
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {
      // если не влезло (много фото) — чистим старые превью
      try { pruneThumbs(); localStorage.setItem(KEY, JSON.stringify(S)); } catch (e2) {}
    }
    clearTimeout(saveT); saveT = setTimeout(cloudPush, 1200);
  }
  function pruneThumbs() {
    const keys = Object.keys(S.days).sort();
    for (const k of keys.slice(0, Math.max(0, keys.length - 7))) S.days[k].forEach((e) => delete e.img);
  }

  // Telegram CloudStorage: резервная копия (без превью фото), чтобы данные жили между устройствами
  const CS = inTg && tg.CloudStorage && tg.isVersionAtLeast && tg.isVersionAtLeast("6.9") ? tg.CloudStorage : null;
  function cloudPush() {
    if (!CS) return;
    try {
      const lite = JSON.parse(JSON.stringify(S));
      Object.values(lite.days).forEach((arr) => arr.forEach((e) => delete e.img));
      const str = JSON.stringify(lite);
      const parts = Math.ceil(str.length / 4000);
      if (parts > 60) return;
      for (let i = 0; i < parts; i++) CS.setItem("p" + i, str.slice(i * 4000, (i + 1) * 4000));
      CS.setItem("pn", String(parts));
    } catch (e) {}
  }
  function cloudPull(done) {
    if (!CS) return done();
    let finished = false;
    const fin = () => { if (!finished) { finished = true; done(); } };
    setTimeout(fin, 1500);
    try {
      CS.getItem("pn", (err, n) => {
        n = parseInt(n, 10);
        if (err || !n) return fin();
        const keys = Array.from({ length: n }, (_, i) => "p" + i);
        CS.getItems(keys, (err2, vals) => {
          try {
            if (!err2 && vals) {
              const d = JSON.parse(keys.map((k) => vals[k] || "").join(""));
              const localCount = Object.values(S.days).reduce((a, b) => a + b.length, 0);
              const cloudCount = Object.values(d.days || {}).reduce((a, b) => a + b.length, 0);
              if (!S.onboarded || cloudCount > localCount) {
                const imgs = {}; Object.values(S.days).forEach((arr) => arr.forEach((e) => { if (e.img) imgs[e.id] = e.img; }));
                S = Object.assign(defaults(), d);
                Object.values(S.days).forEach((arr) => arr.forEach((e) => { if (imgs[e.id]) e.img = imgs[e.id]; }));
                localStorage.setItem(KEY, JSON.stringify(S));
              }
            }
          } catch (e) {}
          fin();
        });
      });
    } catch (e) { fin(); }
  }

  // ---------- nutrition math ----------
  const ACT = [
    { f: 1.2, n: "Почти без движения", s: "Сидячая работа, мало шагов", e: "🪑" },
    { f: 1.375, n: "Немного активности", s: "1–2 тренировки или много ходьбы", e: "🚶" },
    { f: 1.55, n: "Тренировки 3–4 раза", s: "Зал или спорт несколько раз в неделю", e: "🏋️" },
    { f: 1.725, n: "Очень активно", s: "5+ тренировок или физическая работа", e: "🔥" },
  ];
  const GOALS = {
    lose: { n: "Похудеть", s: "Мягкий дефицит, мышцы сохраняются", e: "🍃", adj: -0.15, pk: 2.0 },
    keep: { n: "Держать форму", s: "Поддерживать вес и рельеф", e: "⚖️", adj: 0, pk: 1.8 },
    gain: { n: "Набрать массу", s: "Небольшой профицит для роста мышц", e: "💪", adj: 0.1, pk: 1.8 },
  };
  function calcNorm(p = S.profile) {
    const bmr = 10 * p.weight + 6.25 * p.height - 5 * p.age + (p.sex === "f" ? -161 : 5);
    const tdee = bmr * ACT[p.activity].f;
    const g = GOALS[p.goal];
    let k = tdee * (1 + g.adj);
    if (p.goal === "lose") k = Math.max(k, tdee - 600);
    k = Math.round(k / 10) * 10;
    const pr = Math.round(p.weight * g.pk);
    const fa = Math.round(Math.max(p.weight * 0.9, (k * 0.25) / 9));
    const ca = Math.max(0, Math.round((k - pr * 4 - fa * 9) / 4));
    return { k, p: pr, f: fa, c: ca, tdee: Math.round(tdee) };
  }
  function norm() {
    const m = S.profile.manual;
    if (m.on) return { k: m.k, p: m.p, f: m.f, c: m.c };
    return calcNorm();
  }
  const dayEntries = (k) => S.days[k] || [];
  function totals(k) {
    return dayEntries(k).reduce((a, e) => { a.k += e.k; a.p += e.p; a.f += e.f; a.c += e.c; return a; }, { k: 0, p: 0, f: 0, c: 0 });
  }
  const scaleFood = (f, g) => ({ k: (f.k * g) / 100, p: (f.p * g) / 100, f: (f.f * g) / 100, c: (f.c * g) / 100 });

  // ---------- animated numbers ----------
  const lastVals = new Map();
  function countUp(el, to, opts = {}) {
    if (!el) return;
    const key = opts.key || el.id || el.dataset.key;
    const from = key && lastVals.has(key) ? lastVals.get(key) : (opts.from != null ? opts.from : 0);
    if (key) lastVals.set(key, to);
    const dec = opts.dec || 0;
    const show = (v) => { el.textContent = dec ? v.toFixed(dec).replace(".", ",") : fmt(v); };
    if (reduced || from === to) { show(to); return; }
    const dur = opts.dur || 900;
    const t0 = performance.now();
    const ease = (t) => 1 - Math.pow(1 - t, 4);
    function step(t) {
      const p = clamp((t - t0) / dur, 0, 1);
      show(from + (to - from) * ease(p));
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  function revealSoon(el, cls = "show") { if (!el) return; requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add(cls))); }

  // ---------- theme ----------
  function applyTheme() {
    let t = S.settings.theme;
    if (t === "auto") t = (inTg && tg.colorScheme) || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.dataset.theme = t;
    const bg = t === "dark" ? "#0F0F16" : "#F4F4F6";
    $('meta[name="theme-color"]').setAttribute("content", bg);
    if (inTg) {
      try { tg.setHeaderColor(bg); tg.setBackgroundColor(bg); if (tg.setBottomBarColor) tg.setBottomBarColor(bg); } catch (e) {}
    }
  }
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (S.settings.theme === "auto") applyTheme(); });

  // ---------- toast ----------
  let toastT;
  function toast(text, undo) {
    const t = $("#toast");
    t.innerHTML = `<span class="tic">${icon("check")}</span><span>${esc(text)}</span>${undo ? '<button id="t-undo">Отменить</button>' : ""}`;
    t.classList.add("show");
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove("show"), undo ? 4200 : 2200);
    if (undo) $("#t-undo").onclick = () => { undo(); t.classList.remove("show"); haptic("light"); };
  }

  // ---------- routing ----------
  let cur = null;
  let selDay = todayKey();
  function show(id) {
    const next = $("#s-" + id);
    if (cur === id) return;
    const prev = cur ? $("#s-" + cur) : null;
    cur = id;
    if (prev) { prev.classList.remove("active"); }
    window.scrollTo({ top: 0 });
    next.classList.add("active");
    const dock = $("#dock");
    dock.classList.toggle("hide", id === "onboard");
    $("#nav-history").classList.toggle("on", id === "history");
    $("#nav-profile").classList.toggle("on", id === "profile");
    $("#nav-history").innerHTML = id === "history" ? icon("home") : icon("chart");
    $("#nav-profile").innerHTML = id === "profile" ? icon("home") : icon("user");
    if (id === "today") renderToday(true);
    if (id === "history") renderHistory();
    if (id === "profile") renderProfile();
    updateBack();
  }
  function updateBack() {
    if (!inTg) return;
    try {
      if (sheetOpen || (cur !== "today" && cur !== "onboard")) tg.BackButton.show(); else tg.BackButton.hide();
    } catch (e) {}
  }
  function goBack() {
    if (sheetOpen) { if (sheetBack) sheetBack(); else closeSheet(); return; }
    if (cur === "history" || cur === "profile") show("today");
  }

  // ---------- sheet ----------
  let sheetOpen = false, sheetBack = null, onSheetClose = null;
  function openSheet(title, body, foot = "", opts = {}) {
    $("#sh-title").textContent = title;
    $("#sh-body").innerHTML = body;
    $("#sh-foot").innerHTML = foot;
    $("#sh-foot").style.display = foot ? "" : "none";
    $("#sh-body").scrollTop = 0;
    sheetBack = opts.back || null;
    onSheetClose = opts.onClose || null;
    if (!sheetOpen) {
      sheetOpen = true;
      $("#scrim").classList.add("open");
      $("#sheet").classList.add("open");
      $("#dock").classList.add("hide");
      document.body.style.overflow = "hidden";
      haptic("light");
    }
    updateBack();
  }
  function setSheet(title, body, foot = "", back = null) {
    const b = $("#sh-body");
    b.style.transition = "none"; b.style.opacity = "0"; b.style.transform = "translateX(14px)";
    $("#sh-title").textContent = title;
    b.innerHTML = body; b.scrollTop = 0;
    $("#sh-foot").innerHTML = foot; $("#sh-foot").style.display = foot ? "" : "none";
    sheetBack = back;
    requestAnimationFrame(() => { b.style.transition = "opacity .3s var(--ease), transform .4s var(--ease-out)"; b.style.opacity = "1"; b.style.transform = "none"; });
  }
  function closeSheet() {
    if (!sheetOpen) return;
    sheetOpen = false; sheetBack = null;
    $("#scrim").classList.remove("open");
    $("#sheet").classList.remove("open");
    $("#sheet").style.transform = "";
    if (cur !== "onboard") $("#dock").classList.remove("hide");
    document.body.style.overflow = "";
    const cb = onSheetClose; onSheetClose = null;
    if (cb) cb();
    updateBack();
  }
  $("#scrim").addEventListener("click", closeSheet);
  $("#sh-close").addEventListener("click", closeSheet);
  // свайп вниз для закрытия шторки
  (function () {
    const sh = $("#sheet"); let y0 = null, dy = 0, fromBody = false;
    sh.addEventListener("touchstart", (e) => {
      const body = $("#sh-body");
      fromBody = body.contains(e.target);
      if (fromBody && body.scrollTop > 0) { y0 = null; return; }
      y0 = e.touches[0].clientY; dy = 0;
    }, { passive: true });
    sh.addEventListener("touchmove", (e) => {
      if (y0 == null) return;
      dy = e.touches[0].clientY - y0;
      if (dy > 0) { sh.style.transition = "none"; sh.style.transform = `translateY(${dy}px)`; }
    }, { passive: true });
    sh.addEventListener("touchend", () => {
      if (y0 == null) return;
      sh.style.transition = "";
      if (dy > 110) closeSheet(); else sh.style.transform = "";
      y0 = null;
    });
  })();

  // segmented control helper
  function segHTML(name, items, val) {
    return `<div class="seg" data-seg="${name}"><span class="knob"></span>${items.map(([v, l]) => `<button data-v="${v}" class="${v === val ? "on" : ""}">${l}</button>`).join("")}</div>`;
  }
  function placeKnob(seg, animate = true) {
    const on = $(".on", seg) || seg.querySelector("button");
    const k = $(".knob", seg);
    if (!on || !k) return;
    if (!animate) k.style.transition = "none";
    k.style.width = on.offsetWidth + "px";
    k.style.transform = `translateX(${on.offsetLeft - 4}px)`;
    if (!animate) { void k.offsetWidth; k.style.transition = ""; }
  }
  function bindSeg(root, name, cb) {
    const seg = $(`[data-seg="${name}"]`, root);
    if (!seg) return;
    requestAnimationFrame(() => placeKnob(seg, false));
    seg.addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      $$("button", seg).forEach((x) => x.classList.toggle("on", x === b));
      placeKnob(seg); haptic("sel");
      cb(b.dataset.v);
    });
  }
  window.addEventListener("resize", () => $$(".seg").forEach((s) => placeKnob(s, false)));

  // ---------- greeting ----------
  function greet() {
    const h = new Date().getHours();
    const n = S.profile.name ? ", " + S.profile.name : "";
    if (h >= 5 && h < 12) return "Доброе утро" + n;
    if (h >= 12 && h < 17) return "Добрый день" + n;
    if (h >= 17 && h < 23) return "Добрый вечер" + n;
    return "Доброй ночи" + n;
  }
  function avatarHTML() {
    const u = inTg && tg.initDataUnsafe && tg.initDataUnsafe.user;
    if (u && u.photo_url) return `<img src="${esc(u.photo_url)}" alt="">`;
    return esc((S.profile.name || "П").slice(0, 1).toUpperCase());
  }

  // =====================================================================
  // ONBOARDING
  // =====================================================================
  let ob = { step: 0, d: null };
  const OB_STEPS = 4;
  function startOnboarding() {
    const u = inTg && tg.initDataUnsafe && tg.initDataUnsafe.user;
    ob = { step: 0, d: JSON.parse(JSON.stringify(S.profile)) };
    if (!ob.d.name && u && u.first_name) ob.d.name = u.first_name;
    show("onboard");
    renderOb();
  }
  function renderOb(dir = 1) {
    const s = $("#s-onboard");
    const d = ob.d;
    const st = ob.step;
    const Q = [
      { h: "Какая у тебя цель?", p: "От неё зависит норма калорий. Поменять можно в любой момент." },
      { h: "Немного о тебе", p: "Пол и возраст нужны для точного расчёта обмена веществ." },
      { h: "Рост и вес", p: "Вес потом можно отмечать в истории, норма пересчитается сама." },
      { h: "Сколько ты двигаешься?", p: "Учитываем тренировки и обычную активность за неделю." },
    ];
    let body = "";
    if (st === 0) {
      body = Object.entries(GOALS).map(([k, g], i) => `<button class="opt d${i + 1} ${d.goal === k ? "on" : ""}" data-goal="${k}"><span class="oi">${g.e}</span><span><b>${g.n}</b><span>${g.s}</span></span><span class="rad"></span></button>`).join("");
    } else if (st === 1) {
      body = `<div class="numrow d1"><span><b>Пол</b><span>для формулы расчёта</span></span>${segHTML("sex", [["m", "Мужской"], ["f", "Женский"]], d.sex).replace('class="seg"', 'class="seg" style="width:190px"')}</div>
        <div class="numrow d2"><span><b>Возраст</b><span>полных лет</span></span>${stepperHTML("age", d.age, "")}</div>
        <div class="field d3 fade-up" style="margin-top:8px"><span>Как к тебе обращаться</span><input id="ob-name" maxlength="20" placeholder="Имя" value="${esc(d.name)}"></div>`;
    } else if (st === 2) {
      body = `<div class="numrow d1"><span><b>Рост</b><span>сантиметры</span></span>${stepperHTML("height", d.height, "см")}</div>
        <div class="numrow d2"><span><b>Вес</b><span>килограммы</span></span>${stepperHTML("weight", d.weight, "кг", 0.5)}</div>`;
    } else {
      body = ACT.map((a, i) => `<button class="opt d${i + 1} ${d.activity === i ? "on" : ""}" data-act="${i}"><span class="oi">${a.e}</span><span><b>${a.n}</b><span>${a.s}</span></span><span class="rad"></span></button>`).join("");
    }
    s.innerHTML = `<div class="ob">
      <div class="ob-prog">${Array.from({ length: OB_STEPS }, (_, i) => `<i class="${i < st ? "done" : ""}"></i>`).join("")}</div>
      <div class="ob-q s${st} fade-up"><div class="n">Вопрос ${st + 1} из ${OB_STEPS}</div><h2 class="display">${Q[st].h}</h2><p>${Q[st].p}</p></div>
      <div class="ob-body">${body}</div>
      <div class="ob-foot">${st > 0 ? `<button class="back" id="ob-back">${icon("back")}</button>` : ""}<button class="btn" id="ob-next">${st === OB_STEPS - 1 ? "Рассчитать норму" : "Далее"} ${icon("right")}</button></div>
    </div>`;
    $$(".btn svg", s).forEach((x) => { x.style.width = "18px"; x.style.height = "18px"; });
    requestAnimationFrame(() => { const bars = $$(".ob-prog i", s); if (bars[st]) bars[st].classList.add("done"); });
    $$("[data-goal]", s).forEach((b) => b.onclick = () => { d.goal = b.dataset.goal; $$("[data-goal]", s).forEach((x) => x.classList.toggle("on", x === b)); haptic("sel"); });
    $$("[data-act]", s).forEach((b) => b.onclick = () => { d.activity = +b.dataset.act; $$("[data-act]", s).forEach((x) => x.classList.toggle("on", x === b)); haptic("sel"); });
    bindSeg(s, "sex", (v) => (d.sex = v));
    bindSteppers(s, d, { age: [14, 90], height: [130, 220], weight: [35, 200] });
    const nm = $("#ob-name", s); if (nm) nm.oninput = () => (d.name = nm.value.trim());
    if ($("#ob-back", s)) $("#ob-back", s).onclick = () => { ob.step--; haptic("light"); renderOb(-1); };
    $("#ob-next", s).onclick = () => {
      haptic("light");
      if (ob.step < OB_STEPS - 1) { ob.step++; renderOb(1); window.scrollTo({ top: 0, behavior: "smooth" }); }
      else showObResult();
    };
  }
  function stepperHTML(field, val, unit, step = 1) {
    return `<div class="stepper" data-step="${field}" data-inc="${step}"><button data-d="-1" aria-label="меньше">−</button><span class="val"><span data-v>${String(val).replace(".", ",")}</span>${unit ? " " + unit : ""}</span><button data-d="1" aria-label="больше">+</button></div>`;
  }
  function bindSteppers(root, obj, limits, onChange) {
    $$("[data-step]", root).forEach((st) => {
      const f = st.dataset.step, inc = parseFloat(st.dataset.inc) || 1;
      const [mn, mx] = limits[f] || [0, 9999];
      const out = $("[data-v]", st);
      let hold, rep;
      const bump = (dir) => {
        obj[f] = clamp(Math.round((obj[f] + dir * inc) * 10) / 10, mn, mx);
        out.textContent = String(obj[f]).replace(".", ",");
        haptic("sel");
        onChange && onChange(f, obj[f]);
      };
      $$("button", st).forEach((b) => {
        const dir = +b.dataset.d;
        const start = (e) => { e.preventDefault(); bump(dir); hold = setTimeout(() => { rep = setInterval(() => bump(dir), 70); }, 380); };
        const stop = () => { clearTimeout(hold); clearInterval(rep); };
        b.addEventListener("pointerdown", start);
        ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => b.addEventListener(ev, stop));
      });
      // тап по числу — ввод с клавиатуры
      const val = $(".val", st);
      if (val) val.addEventListener("click", () => {
        if ($("input", val)) return;
        const inp = document.createElement("input");
        inp.type = "text"; inp.inputMode = inc < 1 ? "decimal" : "numeric";
        inp.value = String(obj[f]).replace(".", ",");
        inp.className = "val-in";
        out.style.display = "none"; val.prepend(inp); inp.focus(); inp.select();
        const commit = () => {
          const n = parseFloat(inp.value.replace(",", "."));
          if (!isNaN(n)) { obj[f] = clamp(Math.round(n * 10) / 10, mn, mx); onChange && onChange(f, obj[f]); }
          out.textContent = String(obj[f]).replace(".", ",");
          inp.remove(); out.style.display = "";
        };
        inp.addEventListener("blur", commit);
        inp.addEventListener("keydown", (e) => { if (e.key === "Enter") inp.blur(); });
      });
    });
  }
  function showObResult() {
    const n = calcNorm(ob.d);
    const s = $("#s-onboard");
    const g = GOALS[ob.d.goal];
    const tot = n.p * 4 + n.f * 9 + n.c * 4;
    const C = 2 * Math.PI * 96;
    const parts = [["p", n.p * 4, "var(--pro-b)"], ["c", n.c * 4, "var(--carb-b)"], ["f", n.f * 9, "var(--fat-b)"]];
    let off = 0;
    const gap = 10;
    const arcs = parts.map(([k, v, col]) => {
      const len = Math.max(0, (v / tot) * C - gap);
      const a = `<circle class="ring-seg" cx="115" cy="115" r="96" stroke="${col}" stroke-dasharray="${len} ${C}" stroke-dashoffset="${len}" data-off="${-off}" />`;
      off += (v / tot) * C;
      return a;
    }).join("");
    s.innerHTML = `<div class="ob">
      <div class="ob-prog">${Array.from({ length: OB_STEPS }, () => `<i class="done"></i>`).join("")}</div>
      <div class="result-hero fade-up">
        <div class="muted">${g.e} ${g.n} · твоя норма в день</div>
        <div class="ring-wrap"><svg viewBox="0 0 230 230">${arcs}</svg>
          <div class="center"><div><div class="kc display" id="ob-kc" style="font-size:54px;margin:0">0</div><div class="muted">ккал</div></div></div></div>
      </div>
      <div class="stats fade-up d2">
        <div class="stat"><span>Белки</span><b><span id="ob-p">0</span> г</b></div>
        <div class="stat"><span>Жиры</span><b><span id="ob-f">0</span> г</b></div>
        <div class="stat"><span>Углеводы</span><b><span id="ob-c">0</span> г</b></div>
      </div>
      <p class="note fade-up d3">Расход энергии без цели около ${fmt(n.tdee)} ккал. Норму можно поправить вручную в профиле. Расчёт по формуле Миффлина–Сан Жеора, это ориентир, а не медицинская рекомендация.</p>
      <div style="flex:1"></div>
      <div class="ob-foot"><button class="back" id="ob-back">${icon("back")}</button><button class="btn" id="ob-done">Начать</button></div>
    </div>`;
    requestAnimationFrame(() => requestAnimationFrame(() => $$(".ring-seg", s).forEach((c, i) => { c.style.transitionDelay = i * 0.15 + "s"; c.style.strokeDashoffset = c.dataset.off; })));
    countUp($("#ob-kc"), n.k, { from: 0, dur: 1300 });
    countUp($("#ob-p"), n.p, { from: 0 }); countUp($("#ob-f"), n.f, { from: 0 }); countUp($("#ob-c"), n.c, { from: 0 });
    haptic("ok");
    $("#ob-back").onclick = () => { ob.step = OB_STEPS - 1; renderOb(-1); };
    $("#ob-done").onclick = () => {
      S.profile = Object.assign(S.profile, ob.d);
      if (!S.onboarded) S.weights[todayKey()] = ob.d.weight;
      S.onboarded = true;
      save(); haptic("ok");
      show("today");
    };
  }

  // =====================================================================
  // TODAY
  // =====================================================================
  let weekAnchor = null;
  function renderToday(animate) {
    const s = $("#s-today");
    const now = new Date();
    const sd = fromKey(selDay);
    const isToday = selDay === todayKey();
    const nm = norm();
    const t = totals(selDay);
    const left = nm.k - t.k;
    const pct = nm.k ? t.k / nm.k : 0;
    const title = isToday ? greet() : (WDF[sd.getDay()] + ", " + sd.getDate() + " " + MON[sd.getMonth()]);
    const sub = isToday ? `${WDF[now.getDay()]}, ${now.getDate()} ${MON[now.getMonth()]}` : "Просмотр дня";
    const chip = t.k === 0 ? `<span class="chip">Норма ${fmt(nm.k)}</span>` : left >= 0 ? `<span class="chip"><span class="dot"></span>Осталось ${fmt(left)}</span>` : `<span class="chip"><span class="dot" style="background:#FFD1D8"></span>Сверх нормы ${fmt(-left)}</span>`;

    s.innerHTML = `
      <div class="top fade-up"><div><div class="date">${sub}</div><h1 class="display">${esc(title)}</h1></div><button class="avatar" id="t-ava">${avatarHTML()}</button></div>
      <div class="week fade-up d1" id="week"></div>
      <div class="grad g-cal fade-up d2" id="cal-card">
        <div class="c-head"><span class="c-title">Калории · ${isToday ? "сегодня" : sd.getDate() + " " + MONS[sd.getMonth()]}</span>${chip}</div>
        <div class="big display"><span id="v-k" data-key="k-${selDay}">0</span><small>из ${fmt(nm.k)} ккал</small></div>
        <div class="dots" id="cal-dots"></div>
        <div class="axis"><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span></div>
      </div>
      <div class="row2">
        ${macroCard("pro", "Белки", "bolt", t.p, nm.p, "d3")}
        ${macroCard("carb", "Углеводы", "leaf", t.c, nm.c, "d4")}
      </div>
      <div class="grad g-fat fade-up d5" style="margin-top:10px">
        <div class="c-head"><span class="c-title"><span class="ic-circ">${icon("drop")}</span>Жиры</span><span class="chip">${fatChip(t.f, nm.f)}</span></div>
        <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:12px">
          <div class="mid display" style="margin-top:18px"><span id="v-f" data-key="f-${selDay}">0</span><small>г</small></div>
          <div class="sub" style="padding-bottom:6px">из ${nm.f} г</div>
        </div>
        <div class="bar-dots" id="bd-fat">${barDots(t.f, nm.f)}</div>
      </div>
      ${insightHTML(t, nm, isToday)}
      <div class="section-h fade-up d6"><h2 class="display">Приёмы пищи</h2><span class="muted">${dayEntries(selDay).length ? fmt(t.k) + " ккал" : ""}</span></div>
      <div id="meals"></div>`;

    renderWeek();
    renderCalDots();
    renderMeals();
    countUp($("#v-k"), r0(t.k), { key: "k" });
    countUp($("#v-f"), r0(t.f), { key: "f" });
    countUp($("#v-p"), r0(t.p), { key: "p" });
    countUp($("#v-c"), r0(t.c), { key: "c" });
    revealSoon($("#bd-pro")); revealSoon($("#bd-carb")); revealSoon($("#bd-fat"));
    $("#t-ava").onclick = () => show("profile");
    const ib = $("#ins-btn");
    if (ib) ib.onclick = () => { const f = window.FOODS.find((x) => x.n === ib.dataset.f); openAdd("search"); setTimeout(() => portion(Object.assign({}, f, { g: +ib.dataset.g })), 60); };
  }
  // ---------- подсказка дня ----------
  const PRO_FOODS = ["Куриная грудка варёная", "Творог 5%", "Греческий йогурт", "Протеиновый коктейль (молочный)", "Яйцо варёное", "Тунец консервированный"];
  function insightHTML(t, nm, isToday) {
    const n = dayEntries(selDay).length;
    if (!n) return "";
    const h = new Date().getHours();
    const kLeft = nm.k - t.k, pLeft = nm.p - t.p;
    let ic = "spark", col = "cal", title = "", text = "", btn = "";
    if (t.k > nm.k * 1.1) {
      col = "pro"; ic = "flame"; title = "Сегодня сверх нормы на " + fmt(t.k - nm.k) + " ккал";
      text = "Ничего страшного: на результат влияет средний показатель за неделю. Завтра просто держись нормы.";
    } else if (isToday && pLeft > 20) {
      // подбираем продукт, который закроет белок и влезет в остаток калорий
      const opts = PRO_FOODS.map((nmF) => window.FOODS.find((x) => x.n === nmF)).filter(Boolean).map((f) => {
        const g = Math.round(clamp((pLeft / f.p) * 100, 60, 250) / 10) * 10; const v = scaleFood(f, g); return { f, g, v };
      }).filter((o) => o.v.k <= Math.max(kLeft, 200)).sort((a, b) => b.v.p / b.v.k - a.v.p / a.v.k);
      const o = opts[(new Date().getDate()) % Math.max(1, Math.min(3, opts.length))] || opts[0];
      col = "pro"; ic = "bolt"; title = "Добери " + r0(pLeft) + " г белка";
      text = o ? `${o.f.e} ${o.f.n}, ${o.g} г даст ${r0(o.v.p)} г белка и ${fmt(o.v.k)} ккал.` : "Добавь к следующему приёму пищи курицу, творог или яйца.";
      if (o) btn = `<button class="btn sm" id="ins-btn" data-f="${esc(o.f.n)}" data-g="${o.g}">${icon("plus")} Добавить</button>`;
    } else if (isToday && kLeft > nm.k * 0.35 && h >= 19) {
      col = "carb"; ic = "leaf"; title = "До нормы ещё " + fmt(kLeft) + " ккал";
      text = S.profile.goal === "gain" ? "Для набора массы важно добирать калории. Проще всего: каша на молоке, орехи или банан с арахисовой пастой." : "Если не голоден, не нужно доедать через силу. Главное, чтобы был закрыт белок.";
    } else if (Math.abs(kLeft) <= nm.k * 0.1 && pLeft <= 10) {
      col = "carb"; ic = "check"; title = "Отличный день";
      text = "Калории в норме, белок закрыт. Так держать.";
    } else if (isToday && kLeft > 0) {
      col = "cal"; ic = "spark"; title = "Осталось " + fmt(kLeft) + " ккал";
      const next = h < 11 ? "обед и ужин" : h < 16 ? "ужин и перекус" : "ужин";
      text = `Примерно столько можно съесть на ${next}. Белка осталось ${Math.max(0, r0(pLeft))} г.`;
    } else return "";
    return `<div class="card insight fade-up d6"><span class="ins-ic t-${col}">${icon(ic)}</span><div class="ins-t"><b>${title}</b><span>${esc(text)}</span>${btn}</div></div>`;
  }
  function fatChip(v, n) { return v > n * 1.1 ? "Больше нормы" : v >= n * 0.8 ? "В норме" : "ещё " + Math.max(0, r0(n - v)) + " г"; }
  function macroCard(kind, label, ic, v, n, d) {
    const key = kind === "pro" ? "p" : "c";
    const rest = r0(n - v);
    return `<div class="grad g-${kind} fade-up ${d}">
      <div class="c-head"><span class="c-title"><span class="ic-circ">${icon(ic)}</span>${label}</span></div>
      <div class="mid display"><span id="v-${key}">0</span><small>г</small></div>
      <div class="sub">${rest > 0 ? "из " + n + " г · ещё " + rest : "норма " + n + " г ✓"}</div>
      <div class="bar-dots" id="bd-${kind}">${barDots(v, n)}</div>
    </div>`;
  }
  function barDots(v, n, segs = 10) {
    const on = n ? Math.round(clamp(v / n, 0, 1) * segs) : 0;
    return Array.from({ length: segs }, (_, i) => `<i class="${i < on ? "on" : ""}" style="transition-delay:${0.15 + i * 0.04}s"></i>`).join("");
  }
  function renderWeek() {
    const w = $("#week");
    const sd = fromKey(selDay);
    if (!weekAnchor) weekAnchor = sd;
    const base = addDays(weekAnchor, -((weekAnchor.getDay() + 6) % 7)); // понедельник
    const tk = todayKey();
    let html = `<span class="pill" id="wpill"></span>`;
    for (let i = 0; i < 7; i++) {
      const d = addDays(base, i), k = dkey(d);
      const fut = d > new Date() && k !== tk;
      html += `<button class="day ${k === tk ? "today" : ""} ${k === selDay ? "sel" : ""} ${dayEntries(k).length ? "has" : ""}" data-k="${k}" ${fut ? 'disabled style="opacity:.45"' : ""}><span class="wd">${WD[d.getDay()]}</span><span class="dn">${d.getDate()}</span><span class="mark"></span></button>`;
    }
    w.innerHTML = html;
    placePill(false);
    w.onclick = (e) => {
      const b = e.target.closest(".day"); if (!b || b.disabled) return;
      if (b.dataset.k === selDay) return;
      selDay = b.dataset.k; weekAnchor = fromKey(selDay);
      haptic("sel");
      $$(".day", w).forEach((x) => x.classList.toggle("sel", x === b));
      placePill(true);
      setTimeout(() => renderToday(), 180);
    };
    // свайп недели
    let x0 = null;
    w.ontouchstart = (e) => { x0 = e.touches[0].clientX; };
    w.ontouchend = (e) => {
      if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) < 50) return;
      const nb = addDays(base, dx < 0 ? 7 : -7);
      if (nb > new Date()) return;
      weekAnchor = nb; haptic("light");
      w.style.transition = "none"; w.style.opacity = "0"; w.style.transform = `translateX(${dx < 0 ? 24 : -24}px)`;
      renderWeek();
      requestAnimationFrame(() => { w.style.transition = "opacity .3s, transform .45s var(--ease-out)"; w.style.opacity = "1"; w.style.transform = "none"; });
    };
  }
  function placePill(anim) {
    const w = $("#week"), p = $("#wpill"), sel = $(".day.sel", w);
    if (!p) return;
    if (!sel) { p.style.opacity = "0"; return; }
    p.style.opacity = "1";
    if (!anim) p.style.transition = "none";
    p.style.width = sel.offsetWidth + "px";
    p.style.transform = `translateX(${sel.offsetLeft}px)`;
    if (!anim) { void p.offsetWidth; p.style.transition = ""; }
  }
  function renderCalDots() {
    const el = $("#cal-dots");
    const cols = 18, rows = 5; // 06:00 → 24:00
    const byH = new Array(cols).fill(0);
    dayEntries(selDay).forEach((e) => {
      const h = new Date(e.t).getHours();
      const idx = clamp(h - 6, 0, cols - 1);
      byH[idx] += e.k;
    });
    const unit = Math.max(120, norm().k / 12); // одна точка ≈ 1/12 нормы
    el.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    const nowH = new Date().getHours();
    el.innerHTML = byH.map((k, i) => {
      const on = Math.min(rows, Math.ceil(k / unit));
      let col = "";
      for (let r = 0; r < rows; r++) col += `<i class="${r < on ? "on" : ""}" style="transition-delay:${(i * 0.022 + r * 0.03).toFixed(3)}s"></i>`;
      return `<div class="col ${selDay === todayKey() && i === clamp(nowH - 6, 0, cols - 1) && nowH >= 6 ? "now" : ""}">${col}</div>`;
    }).join("");
    revealSoon(el);
  }
  function renderMeals() {
    const box = $("#meals");
    const list = dayEntries(selDay);
    if (!list.length) {
      // предложить повторить вчерашний приём пищи
      let rep = "";
      if (selDay === todayKey()) {
        const yk = dkey(addDays(new Date(), -1)), m = mealByTime();
        const ys = dayEntries(yk).filter((e) => e.meal === m);
        if (ys.length) rep = `<button class="btn sm repeat" id="rep-btn">Повторить вчерашний ${mealName(m).toLowerCase()} · ${fmt(ys.reduce((a, e) => a + e.k, 0))} ккал</button>`;
      }
      box.innerHTML = `<div class="meal-group fade-up d6"><div class="empty"><div class="em">🍽️</div><b>${selDay === todayKey() ? "Пока пусто" : "В этот день записей нет"}</b>Сфотографируй еду или найди её в базе. Калории посчитаются сами.<br>${rep}</div></div>`;
      if ($("#rep-btn")) $("#rep-btn").onclick = () => {
        const m = mealByTime(); const ys = dayEntries(dkey(addDays(new Date(), -1))).filter((e) => e.meal === m);
        addEntries(ys.map((e) => ({ n: e.n, e: e.e, g: e.g, k: e.k, p: e.p, f: e.f, c: e.c, img: e.img, src: e.src })), m);
        afterAdd(ys.reduce((a, e) => a + e.k, 0));
      };
      return;
    }
    box.innerHTML = MEALS.map((m) => {
      const items = list.filter((e) => e.meal === m.id).sort((a, b) => a.t - b.t);
      if (!items.length) return "";
      const sum = items.reduce((a, e) => a + e.k, 0);
      return `<div class="meal-group fade-up d6"><div class="mg-head"><b>${m.e} ${m.n}</b><span>${fmt(sum)} ккал</span></div>
        ${items.map((e) => itemHTML(e)).join("")}</div>`;
    }).join("");
    $$(".item", box).forEach((el) => { el.onclick = () => { if (!el.dataset.sw) editEntry(el.dataset.id); }; bindSwipe(el); });
  }
  function bindSwipe(el) {
    const wrap = el.parentElement; let x0, y0, dx = 0, mode = null;
    el.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; dx = 0; mode = null; delete el.dataset.sw; }, { passive: true });
    el.addEventListener("touchmove", (e) => {
      const mx = e.touches[0].clientX - x0, my = e.touches[0].clientY - y0;
      if (!mode) { if (Math.abs(mx) > 8 && Math.abs(mx) > Math.abs(my)) mode = "x"; else if (Math.abs(my) > 8) mode = "y"; }
      if (mode !== "x") return;
      dx = Math.min(0, mx); el.dataset.sw = "1";
      el.classList.add("dragging"); wrap.classList.add("swiping");
      el.style.transform = `translateX(${dx < -140 ? -140 + (dx + 140) * 0.3 : dx}px)`;
      const armed = dx < -90; if (armed !== wrap.classList.contains("armed")) { wrap.classList.toggle("armed", armed); if (armed) haptic("light"); }
    }, { passive: true });
    el.addEventListener("touchend", () => {
      if (mode !== "x") return;
      el.classList.remove("dragging");
      if (dx < -90) {
        el.style.transform = "translateX(-110%)";
        wrap.style.transition = "height .3s var(--ease), opacity .3s"; wrap.style.height = wrap.offsetHeight + "px";
        requestAnimationFrame(() => { wrap.style.height = "0px"; wrap.style.opacity = "0"; });
        setTimeout(() => deleteEntry(el.dataset.id), 300);
      } else { el.style.transform = ""; setTimeout(() => wrap.classList.remove("swiping", "armed"), 250); }
      setTimeout(() => delete el.dataset.sw, 50);
    });
  }
  function deleteEntry(id) {
    const f = findEntry(id); if (!f) return;
    const copy = JSON.parse(JSON.stringify(f.e));
    S.days[f.k].splice(f.i, 1); if (!S.days[f.k].length) delete S.days[f.k];
    save(); haptic("medium"); renderToday();
    toast("Удалено", () => { (S.days[f.k] = S.days[f.k] || []).push(copy); save(); renderToday(); });
  }
  function tint(e) { const m = Math.max(e.p * 4, e.c * 4, e.f * 9); return m === e.p * 4 ? "t-pro" : m === e.f * 9 ? "t-fat" : "t-carb"; }
  function itemHTML(e, enter) {
    const time = new Date(e.t);
    return `<div class="item-wrap" data-w="${e.id}"><div class="item-del">${icon("trash")}</div><div class="item ${enter ? "enter" : ""}" data-id="${e.id}">
      <span class="ib ${tint(e)}">${e.img ? `<img src="${e.img}" alt="">` : esc(e.e || "🍽️")}</span>
      <span class="it"><b>${esc(e.n)}</b><span>${r0(e.g)} г · Б ${r0(e.p)} · Ж ${r0(e.f)} · У ${r0(e.c)}</span></span>
      <span class="kc">${fmt(e.k)}<span>${pad(time.getHours())}:${pad(time.getMinutes())}</span></span></div></div>`;
  }

  // ---------- entry ops ----------
  function addEntries(arr, meal, dayK = selDay) {
    if (!S.days[dayK]) S.days[dayK] = [];
    const base = dayK === todayKey() ? Date.now() : fromKey(dayK).setHours(mealHour(meal), 0, 0, 0);
    arr.forEach((x, i) => {
      S.days[dayK].push({ id: uid(), n: x.n, e: x.e || "🍽️", g: r0(x.g), k: r0(x.k), p: r1(x.p), f: r1(x.f), c: r1(x.c), meal, t: base + i, img: x.img || undefined, src: x.src || "db" });
      if (x.src !== "photo") { S.recent = [x.n].concat(S.recent.filter((r) => r !== x.n)).slice(0, 12); }
    });
    save();
  }
  function mealHour(m) { return { breakfast: 8, lunch: 13, dinner: 19, snack: 16 }[m] || 12; }
  function findEntry(id) { for (const k in S.days) { const i = S.days[k].findIndex((e) => e.id === id); if (i > -1) return { k, i, e: S.days[k][i] }; } return null; }
  function editEntry(id) {
    const f = findEntry(id); if (!f) return;
    const e = f.e;
    const per = e.g ? { k: (e.k / e.g) * 100, p: (e.p / e.g) * 100, f: (e.f / e.g) * 100, c: (e.c / e.g) * 100 } : null;
    const st = { g: e.g || 100, meal: e.meal };
    const body = `<div class="portion">
      <div class="pn"><span class="em">${e.img ? `<img src="${e.img}" style="width:52px;height:52px;border-radius:50%;object-fit:cover">` : esc(e.e)}</span><div><b>${esc(e.n)}</b><span class="muted">${mealName(e.meal)}</span></div></div>
      <div class="kbig display"><span id="pe-k">${fmt(e.k)}</span> <span class="muted" style="font-size:18px">ккал</span></div>
      <div class="macros" id="pe-m"></div>
      ${per ? `<div style="display:flex;align-items:center;justify-content:space-between;margin-top:18px"><span>Порция</span>${stepperHTML("g", st.g, "г", 10)}</div>
      <input type="range" id="pe-r" min="10" max="${Math.max(800, st.g * 2)}" step="5" value="${st.g}">` : ""}
    </div>
    <div class="subh">Приём пищи</div>
    <div class="chips" id="pe-meal">${MEALS.map((m) => `<button class="fchip ${m.id === st.meal ? "on" : ""}" data-m="${m.id}">${m.e} ${m.n}</button>`).join("")}</div>`;
    const foot = `<div style="display:flex;gap:8px"><button class="btn ghost" id="pe-del" style="width:54px;padding:0;flex:none">${icon("trash")}</button><button class="btn" id="pe-save">Сохранить</button></div>`;
    openSheet("Запись", body, foot);
    $("#pe-del svg").style.cssText = "width:20px;height:20px";
    const upd = () => {
      const v = per ? scaleFood(per, st.g) : e;
      $("#pe-k").textContent = fmt(v.k);
      $("#pe-m").innerHTML = macroTags(v);
      const r = $("#pe-r"); if (r) { r.value = st.g; setRangeFill(r); }
    };
    upd();
    bindSteppers($("#sh-body"), st, { g: [5, 3000] }, upd);
    const r = $("#pe-r");
    if (r) r.oninput = () => { st.g = +r.value; $('[data-step="g"] [data-v]').textContent = st.g; upd(); };
    $$("#pe-meal .fchip").forEach((b) => b.onclick = () => { st.meal = b.dataset.m; $$("#pe-meal .fchip").forEach((x) => x.classList.toggle("on", x === b)); haptic("sel"); });
    $("#pe-save").onclick = () => {
      if (per) Object.assign(e, roundM(scaleFood(per, st.g)), { g: st.g });
      e.meal = st.meal; save(); closeSheet(); renderToday(); toast("Сохранено"); haptic("ok");
    };
    $("#pe-del").onclick = () => {
      const copy = JSON.parse(JSON.stringify(e));
      S.days[f.k].splice(f.i, 1); if (!S.days[f.k].length) delete S.days[f.k];
      save(); closeSheet(); haptic("medium");
      const el = $(`.item[data-id="${id}"]`);
      if (el) el.classList.add("removing");
      setTimeout(() => renderToday(), 260);
      toast("Удалено", () => { (S.days[f.k] = S.days[f.k] || []).push(copy); save(); renderToday(); });
    };
  }
  const roundM = (v) => ({ k: r0(v.k), p: r1(v.p), f: r1(v.f), c: r1(v.c) });
  const macroTags = (v) => `<span class="mtag k">${fmt(v.k)} ккал</span><span class="mtag p">Б ${r0(v.p)} г</span><span class="mtag f">Ж ${r0(v.f)} г</span><span class="mtag c">У ${r0(v.c)} г</span>`;
  function setRangeFill(r) { const p = ((r.value - r.min) / (r.max - r.min)) * 100; r.style.setProperty("--p", p + "%"); }

  // =====================================================================
  // ADD FOOD
  // =====================================================================
  let add = { tab: "photo", meal: mealByTime(), photo: null, thumb: null, items: [], hint: "", q: "" };
  function openAdd(tab) {
    add = { tab: tab || add.tab || "photo", meal: selDay === todayKey() ? mealByTime() : "lunch", photo: null, thumb: null, items: [], hint: "", q: "" };
    openSheet("Добавить еду", "", "", {});
    renderAdd();
  }
  function addHeader() {
    return `${segHTML("tab", [["photo", "Фото"], ["search", "Поиск"], ["manual", "Вручную"]], add.tab)}
      <div class="chips" id="a-meal" style="margin:14px 0 4px;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none">${MEALS.map((m) => `<button class="fchip ${m.id === add.meal ? "on" : ""}" data-m="${m.id}" style="flex:1 0 auto;padding:0 12px">${m.n}</button>`).join("")}</div>`;
  }
  function renderAdd() {
    const body = `${addHeader()}<div id="a-body" style="margin-top:12px"></div>`;
    $("#sh-title").textContent = "Добавить еду";
    $("#sh-body").innerHTML = body;
    sheetBack = null;
    bindSeg($("#sh-body"), "tab", (v) => { add.tab = v; renderAddBody(true); });
    $$("#a-meal .fchip").forEach((b) => b.onclick = () => { add.meal = b.dataset.m; $$("#a-meal .fchip").forEach((x) => x.classList.toggle("on", x === b)); haptic("sel"); });
    renderAddBody(false);
  }
  function renderAddBody(anim) {
    const b = $("#a-body");
    if (anim) { b.style.transition = "none"; b.style.opacity = "0"; b.style.transform = "translateY(8px)"; }
    if (add.tab === "photo") renderPhoto(); else if (add.tab === "search") renderSearch(); else renderManual();
    if (anim) requestAnimationFrame(() => { b.style.transition = "opacity .3s, transform .4s var(--ease-out)"; b.style.opacity = "1"; b.style.transform = "none"; });
  }
  function footBtn(label, id, disabled) {
    $("#sh-foot").innerHTML = label ? `<button class="btn" id="${id}" ${disabled ? "disabled" : ""}>${label}</button>` : "";
    $("#sh-foot").style.display = label ? "" : "none";
  }

  // ----- photo -----
  function renderPhoto() {
    const b = $("#a-body");
    if (!add.photo) {
      b.innerHTML = `<div class="drop"><span class="lens"></span>
        <h4 class="display">Сфотографируй<br>тарелку</h4><p>Нейросеть узнает блюда, оценит порции и посчитает КБЖУ. Результат можно поправить.</p>
        <div class="acts"><button class="btn white sm" id="p-cam">${icon("cam")} Камера</button><button class="btn sm" id="p-gal" style="background:rgba(255,255,255,.22);color:#fff">${icon("img")} Галерея</button></div></div>
        ${S.settings.key ? `<p class="note">Совет: снимай сверху и при хорошем свете. Если в блюде много масла или соуса, напиши это в подсказке, так оценка будет точнее.</p>` : `<div class="alert">Чтобы распознавать фото, добавь бесплатный ключ Gemini в профиле. Без него работают поиск и ручной ввод. <button class="btn sm" id="p-key" style="margin-top:10px">Добавить ключ</button></div>`}`;
      $$(".acts .btn svg", b).forEach((x) => (x.style.cssText = "width:17px;height:17px"));
      $("#p-cam").onclick = () => $("#f-cam").click();
      $("#p-gal").onclick = () => $("#f-gal").click();
      if ($("#p-key")) $("#p-key").onclick = () => { closeSheet(); show("profile"); setTimeout(() => { const k = $("#pr-key"); if (k) { k.scrollIntoView({ behavior: "smooth", block: "center" }); } }, 450); };
      footBtn("");
      return;
    }
    b.innerHTML = `<div class="preview" id="pv"><img src="${add.photo}" alt=""><span class="scan"></span><span class="status" id="pv-st" style="display:none"></span></div>
      <div class="search" style="margin-top:10px"><input id="p-hint" placeholder="Подсказка: «рис 200 г, масла много»" value="${esc(add.hint)}"><button id="p-re" class="btn sm" style="height:34px">Оценить</button></div>
      <div id="p-res" style="margin-top:12px"></div>`;
    const img = $("#pv img");
    img.onload = () => $("#pv").classList.add("loaded");
    $("#p-hint").oninput = (e) => (add.hint = e.target.value);
    $("#p-re").onclick = () => analyze();
    if (add.items.length) renderResults(); else if (S.settings.key) analyze(); else noKeyResults();
  }
  function noKeyResults() {
    $("#p-res").innerHTML = `<div class="alert">Ключ Gemini не добавлен, поэтому фото пока не распознаётся. Добавь ключ в профиле или найди блюдо через поиск.</div>
      <div style="display:flex;gap:8px;margin-top:10px"><button class="btn ghost" id="nk-s">Найти в базе</button><button class="btn" id="nk-p">Добавить ключ</button></div>`;
    $("#nk-s").onclick = () => { add.tab = "search"; renderAdd(); };
    $("#nk-p").onclick = () => { closeSheet(); show("profile"); };
    footBtn("");
  }
  async function onFile(file) {
    if (!file) return;
    try {
      const { full, thumb } = await compress(file);
      add.photo = full; add.thumb = thumb; add.items = [];
      if (!sheetOpen) openSheet("Добавить еду", "");
      add.tab = "photo"; renderAdd();
    } catch (e) { toast("Не удалось открыть фото"); }
  }
  $("#f-cam").addEventListener("change", (e) => { onFile(e.target.files[0]); e.target.value = ""; });
  $("#f-gal").addEventListener("change", (e) => { onFile(e.target.files[0]); e.target.value = ""; });
  function compress(file) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const mk = (max, q) => {
          const sc = Math.min(1, max / Math.max(img.width, img.height));
          const c = document.createElement("canvas");
          c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          return c.toDataURL("image/jpeg", q);
        };
        const out = { full: mk(1024, 0.82), thumb: mk(120, 0.7) };
        URL.revokeObjectURL(url); res(out);
      };
      img.onerror = rej;
      img.src = url;
    });
  }
  let anReq = 0;
  async function analyze() {
    if (!S.settings.key) return noKeyResults();
    const my = ++anReq;
    const pv = $("#pv"), st = $("#pv-st");
    pv.classList.add("scanning");
    st.style.display = ""; st.innerHTML = `<span class="spin"></span>Смотрю на тарелку…`;
    const phrases = ["Смотрю на тарелку…", "Узнаю блюда…", "Оцениваю порции…", "Считаю КБЖУ…"];
    let pi = 0; const pt = setInterval(() => { pi = (pi + 1) % phrases.length; if (st) st.innerHTML = `<span class="spin"></span>${phrases[pi]}`; }, 1400);
    $("#p-res").innerHTML = "";
    footBtn("");
    try {
      const items = await gemini(add.photo, add.hint);
      if (my !== anReq) return;
      add.items = items;
      haptic(items.length ? "ok" : "err");
      renderResults();
    } catch (err) {
      if (my !== anReq) return;
      haptic("err");
      $("#p-res").innerHTML = `<div class="alert"><b>Не получилось распознать.</b><br>${esc(err.message || err)}</div><div style="display:flex;gap:8px;margin-top:10px"><button class="btn ghost" id="er-s">Найти в базе</button><button class="btn" id="er-r">Ещё раз</button></div>`;
      $("#er-r").onclick = analyze; $("#er-s").onclick = () => { add.tab = "search"; renderAdd(); };
    } finally {
      clearInterval(pt);
      if (my === anReq) { pv.classList.remove("scanning"); st.style.display = "none"; }
    }
  }
  async function gemini(dataUrl, hint) {
    const b64 = dataUrl.split(",")[1];
    const prompt = `Ты нутрициолог. На фото еда. Определи каждое отдельное блюдо или продукт, оцени вес порции в граммах по размеру тарелки и приборов, затем калорийность и БЖУ именно этой порции. Учитывай типичное количество масла при домашней готовке (особенно для узбекской и восточной кухни). Названия пиши по-русски, коротко, как в меню. Подбери один подходящий эмодзи. Если на фото нет еды, верни пустой список.${hint ? "\nПодсказка от пользователя (приоритетна): " + hint : ""}`;
    const body = {
      contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: "image/jpeg", data: b64 } }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            items: { type: "ARRAY", items: { type: "OBJECT", properties: { name: { type: "STRING" }, emoji: { type: "STRING" }, grams: { type: "NUMBER" }, kcal: { type: "NUMBER" }, protein: { type: "NUMBER" }, fat: { type: "NUMBER" }, carbs: { type: "NUMBER" } }, required: ["name", "grams", "kcal", "protein", "fat", "carbs"] } },
          },
          required: ["items"],
        },
      },
    };
    const model = (S.settings.model || "gemini-flash-latest").trim();
    const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 45000);
    let r;
    try {
      r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": S.settings.key.trim() }, body: JSON.stringify(body), signal: ctrl.signal,
      });
    } catch (e) { throw new Error(e.name === "AbortError" ? "Слишком долго нет ответа. Проверь интернет и попробуй ещё раз." : "Нет соединения с Gemini. Проверь интернет."); }
    finally { clearTimeout(to); }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const m = (j.error && j.error.message) || "";
      if (r.status === 400 && /API key/i.test(m)) throw new Error("Ключ Gemini не подходит. Проверь его в профиле.");
      if (r.status === 403) throw new Error("Доступ запрещён. Возможно, ключ отключён или Gemini недоступен в твоём регионе.");
      if (r.status === 404) throw new Error("Модель «" + model + "» не найдена. Поменяй модель в профиле, например на gemini-flash-latest.");
      if (r.status === 429) throw new Error("Исчерпан бесплатный лимит запросов. Попробуй позже или найди блюдо в базе.");
      throw new Error("Ошибка Gemini (" + r.status + "). " + m.slice(0, 140));
    }
    const txt = (((j.candidates || [])[0] || {}).content || {}).parts ? j.candidates[0].content.parts.map((p) => p.text || "").join("") : "";
    let data;
    try { data = JSON.parse(txt.replace(/^```json|```$/g, "").trim()); } catch (e) { throw new Error("Не удалось прочитать ответ нейросети. Попробуй ещё раз."); }
    const items = (data.items || []).filter((x) => x && x.name).map((x) => ({
      n: String(x.name).slice(0, 60), e: x.emoji || "🍽️", g: Math.max(1, +x.grams || 100),
      k: Math.max(0, +x.kcal || 0), p: Math.max(0, +x.protein || 0), f: Math.max(0, +x.fat || 0), c: Math.max(0, +x.carbs || 0),
    }));
    items.forEach((x) => { x.per = { k: (x.k / x.g) * 100, p: (x.p / x.g) * 100, f: (x.f / x.g) * 100, c: (x.c / x.g) * 100 }; });
    return items;
  }
  function renderResults() {
    const box = $("#p-res");
    if (!add.items.length) {
      box.innerHTML = `<div class="alert">Еду на фото не видно. Попробуй снять ближе и при хорошем свете или напиши подсказку.</div>`;
      footBtn(""); return;
    }
    box.innerHTML = add.items.map((x, i) => `<div class="res-item" data-i="${i}" style="animation-delay:${i * 0.07}s">
        <div class="res-top"><span style="font-size:22px">${esc(x.e)}</span><input value="${esc(x.n)}" data-name="${i}"><button class="del" data-del="${i}">${icon("x")}</button></div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px"><div class="macros" style="margin:0" id="rm-${i}"></div></div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px"><span class="muted">Порция</span>${stepperHTML("g" + i, x.g, "г", 10)}</div>
      </div>`).join("") + `<div class="res-sum"><span class="muted">Итого</span><b class="display"><span id="r-sum">0</span> <span class="muted" style="font-size:15px">ккал</span></b></div>
      <p class="note" style="padding-top:0">Оценка по фото примерная, обычно погрешность около 20–30%. Поправь граммы, если знаешь точнее.</p>`;
    const upd = () => {
      let sum = 0;
      add.items.forEach((x, i) => {
        const v = scaleFood(x.per, x.g); Object.assign(x, { k: v.k, p: v.p, f: v.f, c: v.c });
        const m = $("#rm-" + i); if (m) m.innerHTML = macroTags(v);
        sum += v.k;
      });
      $("#r-sum").textContent = fmt(sum);
      footBtn(`Добавить ${add.items.length} ${plural(add.items.length, "позицию", "позиции", "позиций")} · ${fmt(sum)} ккал`, "r-add");
      $("#r-add").onclick = commitPhoto;
    };
    const lim = {}; add.items.forEach((x, i) => (lim["g" + i] = [5, 3000]));
    const proxy = new Proxy({}, { get: (_, k) => add.items[+String(k).slice(1)].g, set: (_, k, v) => { add.items[+String(k).slice(1)].g = v; return true; } });
    bindSteppers(box, proxy, lim, upd);
    $$("[data-name]", box).forEach((inp) => inp.oninput = () => (add.items[+inp.dataset.name].n = inp.value));
    $$("[data-del]", box).forEach((b) => b.onclick = () => {
      const i = +b.dataset.del; const card = b.closest(".res-item");
      card.style.transition = "opacity .25s, transform .3s var(--ease)"; card.style.opacity = "0"; card.style.transform = "scale(.96)";
      haptic("light");
      setTimeout(() => { add.items.splice(i, 1); renderResults(); }, 230);
    });
    upd();
  }
  function commitPhoto() {
    const arr = add.items.map((x) => ({ n: x.n.trim() || "Блюдо", e: x.e, g: x.g, k: x.k, p: x.p, f: x.f, c: x.c, img: add.thumb, src: "photo" }));
    addEntries(arr, add.meal);
    afterAdd(arr.reduce((a, x) => a + x.k, 0));
  }
  function afterAdd(k) {
    closeSheet(); haptic("ok");
    if (cur !== "today") show("today"); else renderToday();
    toast(`Добавлено · ${fmt(k)} ккал`);
  }

  // ----- search -----
  function allFoods() { return S.my.concat(window.FOODS); }
  function norm_s(s) { return s.toLowerCase().replace(/ё/g, "е").trim(); }
  function renderSearch() {
    const b = $("#a-body");
    b.innerHTML = `<label class="search">${icon("search")}<input id="q" placeholder="Плов, гречка, творог…" value="${esc(add.q)}" autocomplete="off"></label><div class="flist" id="fl"></div>`;
    const q = $("#q");
    q.oninput = () => { add.q = q.value; listFoods(); };
    listFoods();
    footBtn("");
  }
  function listFoods() {
    const fl = $("#fl");
    const q = norm_s(add.q || "");
    let html = "";
    const row = (f, i) => {
      const v = scaleFood(f, f.g);
      return `<button class="fitem" data-n="${esc(f.n)}" style="width:100%;text-align:left;animation-delay:${Math.min(i, 10) * 0.025}s"><span class="em">${esc(f.e)}</span><span class="ft"><b>${esc(f.n)}</b><span>${f.g} г · ${fmt(v.k)} ккал · Б ${r0(v.p)} Ж ${r0(v.f)} У ${r0(v.c)}</span></span><span class="plus">${icon("plus")}</span></button>`;
    };
    if (!q) {
      const rec = S.recent.map((n) => allFoods().find((f) => f.n === n)).filter(Boolean);
      if (rec.length) html += `<div class="subh">Недавние</div>` + rec.slice(0, 6).map(row).join("");
      if (S.my.length) html += `<div class="subh">Мои продукты</div>` + S.my.slice(0, 8).map(row).join("");
      html += `<div class="subh">Популярное</div>` + window.FOODS.slice(0, 14).map(row).join("");
    } else {
      const res = allFoods().filter((f) => norm_s(f.n).includes(q) || (f.t || []).some((t) => norm_s(t).includes(q)));
      res.sort((a, b) => norm_s(a.n).indexOf(q) - norm_s(b.n).indexOf(q));
      html = res.length ? res.slice(0, 40).map(row).join("") : `<div class="empty"><div class="em">🔍</div><b>Не нашлось</b>Добавь продукт вручную, он сохранится в «Мои продукты».<br><button class="btn sm" id="to-man" style="margin-top:14px">Ввести вручную</button></div>`;
    }
    fl.innerHTML = html;
    $$(".fitem", fl).forEach((el) => el.onclick = () => portion(allFoods().find((f) => f.n === el.dataset.n)));
    if ($("#to-man")) $("#to-man").onclick = () => { add.tab = "manual"; add.manualName = add.q; renderAdd(); };
  }
  function portion(f) {
    if (!f) return;
    haptic("light");
    const st = { g: f.g };
    const body = `<div class="portion">
      <div class="pn"><span class="em">${esc(f.e)}</span><div><b>${esc(f.n)}</b><span class="muted">на 100 г: ${fmt(f.k)} ккал</span></div></div>
      <div class="kbig display"><span id="po-k">0</span> <span class="muted" style="font-size:18px">ккал</span></div>
      <div class="macros" id="po-m"></div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:18px"><span>Порция</span>${stepperHTML("g", st.g, "г", 10)}</div>
      <input type="range" id="po-r" min="5" max="${Math.max(600, f.g * 3)}" step="5" value="${st.g}">
      <div class="presets">${[["½", 0.5], ["Порция", 1], ["×1,5", 1.5], ["×2", 2]].map(([l, m]) => `<button class="fchip" data-pm="${m}">${l}</button>`).join("")}</div>
    </div>
    <div class="subh">Приём пищи</div>
    <div class="chips" id="po-meal">${MEALS.map((m) => `<button class="fchip ${m.id === add.meal ? "on" : ""}" data-m="${m.id}">${m.e} ${m.n}</button>`).join("")}</div>`;
    setSheet(f.n, body, `<button class="btn" id="po-add">Добавить</button>`, () => { renderAdd(); });
    let first = true;
    const upd = () => {
      const v = scaleFood(f, st.g);
      if (first) { countUp($("#po-k"), r0(v.k), { from: 0, dur: 600 }); first = false; } else $("#po-k").textContent = fmt(v.k);
      $("#po-m").innerHTML = macroTags(v);
      const r = $("#po-r"); r.value = st.g; setRangeFill(r);
      $$("[data-pm]").forEach((b) => b.classList.toggle("on", Math.round(f.g * +b.dataset.pm) === st.g));
      $("#po-add").textContent = `Добавить · ${fmt(v.k)} ккал`;
    };
    bindSteppers($("#sh-body"), st, { g: [5, 3000] }, upd);
    $("#po-r").oninput = (e) => { st.g = +e.target.value; $('[data-step="g"] [data-v]').textContent = st.g; upd(); };
    $$("[data-pm]").forEach((b) => b.onclick = () => { st.g = Math.round(f.g * +b.dataset.pm); $('[data-step="g"] [data-v]').textContent = st.g; haptic("sel"); upd(); });
    $$("#po-meal .fchip").forEach((b) => b.onclick = () => { add.meal = b.dataset.m; $$("#po-meal .fchip").forEach((x) => x.classList.toggle("on", x === b)); haptic("sel"); });
    $("#po-add").onclick = () => { const v = scaleFood(f, st.g); addEntries([{ n: f.n, e: f.e, g: st.g, ...v }], add.meal); afterAdd(v.k); };
    upd();
  }

  // ----- manual -----
  function renderManual() {
    const b = $("#a-body");
    const m = add.man || (add.man = { n: add.manualName || "", k: "", g: "", p: "", f: "", c: "", save: true });
    b.innerHTML = `<div class="stack">
      <label class="field"><span>Название</span><input id="m-n" placeholder="Например, домашний суп" value="${esc(m.n)}" maxlength="60"></label>
      <div class="row2" style="margin-top:10px"><label class="field"><span>Калории, ккал</span><input id="m-k" inputmode="decimal" placeholder="0" value="${esc(m.k)}"></label><label class="field"><span>Вес порции, г</span><input id="m-g" inputmode="decimal" placeholder="необязательно" value="${esc(m.g)}"></label></div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-top:10px">
        <label class="field"><span>Белки, г</span><input id="m-p" inputmode="decimal" placeholder="0" value="${esc(m.p)}"></label>
        <label class="field"><span>Жиры, г</span><input id="m-f" inputmode="decimal" placeholder="0" value="${esc(m.f)}"></label>
        <label class="field"><span>Углев., г</span><input id="m-c" inputmode="decimal" placeholder="0" value="${esc(m.c)}"></label>
      </div>
      <button class="prow" id="m-save" style="width:100%;text-align:left;border:0;margin-top:6px"><span class="pl"><b>Сохранить в «Мои продукты»</b><span>Чтобы потом добавлять в один тап</span></span><span class="toggle ${m.save ? "on" : ""}"></span></button>
    </div>
    <p class="note">Если знаешь только БЖУ, калории посчитаются сами. Данные можно взять с упаковки.</p>`;
    const num = (v) => parseFloat(String(v).replace(",", ".")) || 0;
    const upd = () => {
      ["n", "k", "g", "p", "f", "c"].forEach((k) => (m[k] = $("#m-" + k).value));
      let k = num(m.k);
      if (!k && (num(m.p) || num(m.f) || num(m.c))) k = num(m.p) * 4 + num(m.f) * 9 + num(m.c) * 4;
      footBtn(k ? `Добавить · ${fmt(k)} ккал` : "Добавить", "m-add", !(m.n.trim() && k));
      if ($("#m-add")) $("#m-add").onclick = () => {
        const g = num(m.g) || 100;
        const it = { n: m.n.trim(), e: "🍽️", g, k, p: num(m.p), f: num(m.f), c: num(m.c) };
        if (m.save && !S.my.find((x) => x.n === it.n)) S.my.unshift({ n: it.n, e: "⭐", g, k: (k / g) * 100, p: (it.p / g) * 100, f: (it.f / g) * 100, c: (it.c / g) * 100, t: [] });
        addEntries([it], add.meal); add.man = null; afterAdd(k);
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
    s.innerHTML = `<div class="top fade-up"><div><div class="date">Статистика и вес</div><h1 class="display">История</h1></div></div>
      <div class="fade-up d1" style="margin-top:16px">${segHTML("range", [["week", "Неделя"], ["month", "Месяц"]], hist.range)}</div>
      <div class="card fade-up d2" style="margin-top:10px" id="h-card"></div>
      <div class="stats fade-up d3" id="h-stats"></div>
      <div class="card fade-up d4" style="margin-top:10px" id="w-card"></div>
      <div class="section-h fade-up d5"><h2 class="display">По дням</h2></div>
      <div id="h-days" class="fade-up d5"></div>`;
    bindSeg(s, "range", (v) => { hist.range = v; hist.sel = null; drawHist(); });
    drawHist();
    drawWeight();
  }
  function histDays() {
    const n = hist.range === "week" ? 7 : 30;
    const end = new Date();
    return Array.from({ length: n }, (_, i) => dkey(addDays(end, i - n + 1)));
  }
  function drawHist() {
    const days = histDays();
    const nm = norm();
    const vals = days.map((k) => totals(k));
    const maxV = Math.max(nm.k * 1.25, ...vals.map((v) => v.k));
    const rows = hist.range === "week" ? 16 : 14;
    const unit = maxV / rows;
    const sel = hist.sel || days[days.length - 1];
    const sv = totals(sel), sd = fromKey(sel);
    const card = $("#h-card");
    card.innerHTML = `<div class="c-head"><span class="wc-title">${sel === todayKey() ? "Сегодня" : WDF[sd.getDay()] + ", " + sd.getDate() + " " + MONS[sd.getMonth()]}</span><span class="muted" style="font-size:13px">норма ${fmt(nm.k)}</span></div>
      <div class="mid display" style="color:var(--ink);margin-top:12px"><span id="h-val">${fmt(sv.k)}</span><small class="muted">ккал</small></div>
      <div class="hbars" id="hbars">${days.map((k, i) => {
        const v = vals[i].k; const on = Math.round(v / unit); const over = v > nm.k * 1.1;
        let dots = ""; for (let r = 0; r < rows; r++) dots += `<i class="${r < on ? (over ? "over" : "on") : ""}" style="transition-delay:${(i * (hist.range === "week" ? 0.05 : 0.015) + r * 0.018).toFixed(3)}s${hist.range === "month" ? ";width:4px;height:4px" : ""}"></i>`;
        return `<button class="hb ${k === sel ? "sel" : ""}" data-k="${k}">${dots}</button>`;
      }).join("")}<span class="target" style="bottom:${(nm.k / unit / rows) * 100}%"><span>норма</span></span></div>
      <div class="hlabels">${days.map((k, i) => { const d = fromKey(k); const lab = hist.range === "week" ? WD[d.getDay()] : (i % 5 === 4 || i === 0 ? d.getDate() : ""); return `<span>${lab}</span>`; }).join("")}</div>`;
    $("#hbars").style.gap = hist.range === "week" ? "6px" : "2px";
    $$(".hlabels").forEach((h) => (h.style.gap = hist.range === "week" ? "6px" : "2px"));
    revealSoon($("#hbars"));
    $$("#hbars .hb").forEach((b) => b.onclick = () => {
      hist.sel = b.dataset.k; haptic("sel");
      $$("#hbars .hb").forEach((x) => x.classList.toggle("sel", x === b));
      const d = fromKey(hist.sel), v = totals(hist.sel);
      $("#h-card .wc-title").textContent = hist.sel === todayKey() ? "Сегодня" : WDF[d.getDay()] + ", " + d.getDate() + " " + MONS[d.getMonth()];
      countUp($("#h-val"), r0(v.k), { key: "hv", dur: 500 });
    });
    lastVals.set("hv", r0(sv.k));
    // stats
    const filled = days.filter((k) => dayEntries(k).length);
    const avg = (f) => filled.length ? filled.reduce((a, k) => a + totals(k)[f], 0) / filled.length : 0;
    const inNorm = filled.filter((k) => { const v = totals(k).k; return v >= nm.k * 0.9 && v <= nm.k * 1.1; }).length;
    $("#h-stats").innerHTML = `<div class="stat"><span>В среднем</span><b><span id="st-a">0</span></b><span>ккал в день</span></div>
      <div class="stat"><span>Белок</span><b><span id="st-p">0</span> г</b><span>из ${nm.p} г</span></div>
      <div class="stat"><span>В норме</span><b>${inNorm}<span class="muted" style="font-size:15px"> / ${filled.length}</span></b><span>${plural(filled.length, "день", "дня", "дней")} с записями</span></div>`;
    countUp($("#st-a"), r0(avg("k")), { from: 0 }); countUp($("#st-p"), r0(avg("p")), { from: 0 });
    // day list
    const list = days.slice().reverse().filter((k) => dayEntries(k).length);
    $("#h-days").innerHTML = list.length ? list.map((k) => {
      const d = fromKey(k), v = totals(k), pc = clamp(v.k / nm.k, 0, 1.4);
      return `<button class="item card" data-k="${k}" style="width:100%;text-align:left;margin-bottom:8px;padding:14px 16px">
        <span class="ib t-cal" style="font-size:13px;font-weight:600;color:var(--cal-a)">${d.getDate()}</span>
        <span class="it"><b>${k === todayKey() ? "Сегодня" : WDF[d.getDay()]}</b><span>${dayEntries(k).length} ${plural(dayEntries(k).length, "запись", "записи", "записей")} · Б ${r0(v.p)} г</span></span>
        <span class="kc" style="color:${pc > 1.1 ? "var(--warn)" : "inherit"}">${fmt(v.k)}<span>${Math.round(pc * 100)}% нормы</span></span></button>`;
    }).join("") : `<div class="card"><div class="empty"><div class="em">📊</div><b>Здесь появится статистика</b>Добавляй еду каждый день, и тут будет видно, сколько ты ешь в среднем.</div></div>`;
    $$("#h-days [data-k]").forEach((b) => b.onclick = () => { selDay = b.dataset.k; weekAnchor = fromKey(selDay); show("today"); });
  }
  function drawWeight() {
    const box = $("#w-card");
    const ent = Object.entries(S.weights).sort((a, b) => a[0].localeCompare(b[0]));
    const last = ent.length ? ent[ent.length - 1][1] : S.profile.weight;
    const first30 = ent.filter(([k]) => fromKey(k) >= addDays(new Date(), -30));
    const delta = first30.length > 1 ? last - first30[0][1] : 0;
    const pts = ent.slice(-12);
    let chart = "";
    if (pts.length > 1) {
      const W = 300, H = 110;
      const vs = pts.map((p) => p[1]);
      const mn = Math.min(...vs) - 0.5, mx = Math.max(...vs) + 0.5;
      const xy = pts.map((p, i) => [(i / (pts.length - 1)) * W, H - ((p[1] - mn) / (mx - mn)) * H]);
      // плавная кривая (catmull-rom → безье)
      let d = "M" + xy[0][0].toFixed(1) + " " + xy[0][1].toFixed(1);
      for (let i = 0; i < xy.length - 1; i++) {
        const p0 = xy[i - 1] || xy[i], p1 = xy[i], p2 = xy[i + 1], p3 = xy[i + 2] || p2;
        const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
        d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
      }
      const len = Math.ceil(xy.reduce((a, p, i) => i ? a + Math.hypot(p[0] - xy[i - 1][0], p[1] - xy[i - 1][1]) : 0, 0) * 1.25);
      chart = `<div class="wchart" id="wch"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><defs><linearGradient id="wgrad" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--fat-b)" stop-opacity=".35"/><stop offset="1" stop-color="var(--fat-b)" stop-opacity="0"/></linearGradient></defs>
        <path class="warea" d="${d} L${W} ${H} L0 ${H} Z"/><path class="wline" d="${d}" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100" vector-effect="non-scaling-stroke"/></svg>
        ${xy.map((p, i) => `<span style="position:absolute;left:${(p[0] / W) * 100}%;top:${(p[1] / H) * 100}%;width:9px;height:9px;margin:-4.5px;border-radius:50%;background:var(--card);border:2px solid var(--fat-a);transform:scale(0);transition:transform .4s var(--spring) ${0.5 + i * 0.06}s" class="wdot"></span>`).join("")}</div>
        <div class="axis2"><span>${fromKey(pts[0][0]).getDate()} ${MONS[fromKey(pts[0][0]).getMonth()]}</span><span>${fromKey(pts[pts.length - 1][0]).getDate()} ${MONS[fromKey(pts[pts.length - 1][0]).getMonth()]}</span></div>`;
    } else {
      chart = `<p class="note" style="padding:10px 0 4px">Отмечай вес раз в несколько дней утром натощак, и здесь появится график. Смотри на тренд, а не на отдельные дни.</p>`;
    }
    box.innerHTML = `<div class="c-head"><span class="wc-title" style="display:flex;align-items:center;gap:8px"><span class="ic-circ" style="background:color-mix(in srgb,var(--fat-b) 22%,transparent);color:var(--fat-a)">${icon("scale")}</span>Вес</span><button class="btn sm" id="w-add">${icon("plus")} Записать</button></div>
      <div style="display:flex;align-items:baseline;gap:10px"><div class="mid display" style="margin-top:14px"><span>${String(r1(last)).replace(".", ",")}</span><small class="muted">кг</small></div>
      ${delta ? `<span class="chip" style="background:${delta > 0 ? "color-mix(in srgb,var(--carb-b) 20%,transparent)" : "color-mix(in srgb,var(--fat-b) 22%,transparent)"};color:var(--ink)">${delta > 0 ? "+" : ""}${String(r1(delta)).replace(".", ",")} кг за 30 дней</span>` : ""}</div>${chart}`;
    $("#w-add svg").style.cssText = "width:15px;height:15px";
    if ($("#wch")) {
      requestAnimationFrame(() => requestAnimationFrame(() => { $("#wch").classList.add("show"); $(".wline").style.strokeDashoffset = 0; $$(".wdot").forEach((d) => (d.style.transform = "scale(1)")); }));
    }
    $("#w-add").onclick = weightSheet;
  }
  function weightSheet() {
    const ent = Object.entries(S.weights).sort((a, b) => a[0].localeCompare(b[0]));
    const st = { w: ent.length ? ent[ent.length - 1][1] : S.profile.weight };
    openSheet("Вес сегодня", `<div class="portion" style="text-align:center">
        <div class="kbig display" style="margin:6px 0 14px"><span id="ws-v">${String(st.w).replace(".", ",")}</span> <span class="muted" style="font-size:18px">кг</span></div>
        <div style="display:flex;justify-content:center">${stepperHTML("w", st.w, "кг", 0.1).replace('class="stepper"', 'class="stepper nv"')}</div>
        <p class="note">Лучше взвешиваться утром натощак. ${S.profile.manual.on ? "" : "Норма калорий пересчитается под новый вес."}</p></div>`,
      `<button class="btn" id="ws-save">Сохранить</button>`);
    bindSteppers($("#sh-body"), st, { w: [30, 250] }, () => ($("#ws-v").textContent = String(st.w).replace(".", ",")));
    $("#ws-save").onclick = () => {
      S.weights[todayKey()] = st.w; S.profile.weight = st.w; save(); closeSheet(); haptic("ok"); toast("Вес записан");
      if (cur === "history") drawWeight();
    };
  }

  // =====================================================================
  // PROFILE
  // =====================================================================
  function renderProfile() {
    const s = $("#s-profile");
    const p = S.profile, nm = norm(), auto = calcNorm();
    const u = inTg && tg.initDataUnsafe && tg.initDataUnsafe.user;
    s.innerHTML = `<div class="top fade-up"><div><div class="date">${u && u.username ? "@" + esc(u.username) : "Настройки и норма"}</div><h1 class="display">${esc(p.name || "Профиль")}</h1></div><button class="avatar">${avatarHTML()}</button></div>
      <div class="grad g-cal fade-up d1" style="margin-top:18px">
        <div class="c-head"><span class="c-title">Норма в день</span><span class="chip">${p.manual.on ? "Ручная" : GOALS[p.goal].e + " " + GOALS[p.goal].n}</span></div>
        <div class="big display"><span id="pr-k">0</span><small>ккал</small></div>
        <div class="norm-grid"><div><b>${nm.p}</b><span>белки, г</span></div><div><b>${nm.f}</b><span>жиры, г</span></div><div><b>${nm.c}</b><span>углев., г</span></div><div><b>${fmt(auto.tdee)}</b><span>расход</span></div></div>
      </div>
      <div class="ptitle fade-up d2">Цель</div>
      <div class="fade-up d2">${segHTML("goal", [["lose", "Похудеть"], ["keep", "Форма"], ["gain", "Масса"]], p.goal)}</div>
      <div class="ptitle fade-up d3">Параметры</div>
      <div class="card fade-up d3" style="padding:4px 18px">
        ${prow("Пол и возраст", (p.sex === "f" ? "Женский" : "Мужской") + ", " + p.age, "pa")}
        ${prow("Рост", p.height + " см", "ph")}
        ${prow("Вес", String(p.weight).replace(".", ",") + " кг", "pw")}
        ${prow("Активность", ACT[p.activity].n, "pact")}
      </div>
      <div class="ptitle fade-up d4">Своя норма</div>
      <div class="card fade-up d4" style="padding:4px 18px">
        <button class="prow" id="pm-t" style="width:100%;text-align:left"><span class="pl"><b>Задать вручную</b><span>Если тренер или врач дал свои цифры</span></span><span class="toggle ${p.manual.on ? "on" : ""}"></span></button>
        <div id="pm-f" style="display:${p.manual.on ? "block" : "none"};padding-bottom:12px">
          <div class="row2" style="margin-top:4px"><label class="field"><span>Калории</span><input data-m="k" inputmode="numeric" value="${p.manual.k}"></label><label class="field"><span>Белки, г</span><input data-m="p" inputmode="numeric" value="${p.manual.p}"></label></div>
          <div class="row2"><label class="field"><span>Жиры, г</span><input data-m="f" inputmode="numeric" value="${p.manual.f}"></label><label class="field"><span>Углеводы, г</span><input data-m="c" inputmode="numeric" value="${p.manual.c}"></label></div>
        </div>
      </div>
      <div class="ptitle fade-up d5">Оформление</div>
      <div class="fade-up d5">${segHTML("theme", [["auto", "Авто"], ["light", "Светлая"], ["dark", "Тёмная"]], S.settings.theme)}</div>
      <div class="ptitle fade-up d6">Распознавание фото</div>
      <div class="card fade-up d6" id="pr-key">
        <label class="field"><span>Ключ Gemini API</span><input id="k-in" type="password" placeholder="AIza…" value="${esc(S.settings.key)}" autocomplete="off" spellcheck="false"></label>
        <label class="field" style="margin-top:8px"><span>Модель</span><input id="k-model" value="${esc(S.settings.model)}" spellcheck="false"></label>
        <p class="note">Бесплатный ключ можно получить в <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" id="k-link">Google AI Studio</a>. Ключ хранится только на этом устройстве и в твоём Telegram. Фото отправляются в Google для распознавания.</p>
        <div style="display:flex;gap:8px;margin-top:10px"><button class="btn ghost" id="k-test">Проверить</button><button class="btn" id="k-save">Сохранить</button></div>
      </div>
      <div class="ptitle">Данные</div>
      <div class="card" style="padding:4px 18px">
        <button class="prow" id="d-redo" style="width:100%;text-align:left"><span class="pl"><b>Пройти анкету заново</b><span>Пересчитать норму с нуля</span></span><span class="pv">${icon("right")}</span></button>
        <button class="prow" id="d-reset" style="width:100%;text-align:left;color:var(--warn)"><span class="pl"><b>Удалить все данные</b><span>Записи еды, вес и настройки</span></span></button>
      </div>
      <p class="note" style="text-align:center;margin-top:18px">Порция · калории и КБЖУ ориентировочные</p>`;
    countUp($("#pr-k"), nm.k, { key: "prk" });
    bindSeg(s, "goal", (v) => { p.goal = v; if (p.manual.on) { p.manual.on = false; } save(); renderProfile(); toast("Норма пересчитана"); });
    bindSeg(s, "theme", (v) => { S.settings.theme = v; save(); document.documentElement.style.transition = "none"; applyTheme(); });
    $$(".prow[data-ed]", s).forEach((b) => b.onclick = () => editParam(b.dataset.ed));
    $("#pm-t").onclick = () => {
      p.manual.on = !p.manual.on;
      if (p.manual.on) { const a = calcNorm(); if (!p.manual.k || p.manual.k === 2600) Object.assign(p.manual, { k: a.k, p: a.p, f: a.f, c: a.c }); }
      save(); haptic("sel"); renderProfile();
    };
    $$("[data-m]", s).forEach((i) => i.onchange = () => { p.manual[i.dataset.m] = Math.max(0, parseInt(i.value, 10) || 0); save(); renderProfile(); });
    $("#k-save").onclick = () => { S.settings.key = $("#k-in").value.trim(); S.settings.model = $("#k-model").value.trim() || "gemini-flash-latest"; save(); haptic("ok"); toast(S.settings.key ? "Ключ сохранён" : "Ключ удалён"); };
    $("#k-test").onclick = testKey;
    $("#k-link").onclick = (e) => { if (inTg) { e.preventDefault(); tg.openLink("https://aistudio.google.com/apikey"); } };
    $("#d-redo").onclick = () => startOnboarding();
    $("#d-reset").onclick = () => confirmReset();
  }
  function prow(l, v, ed) { return `<button class="prow" data-ed="${ed}" style="width:100%;text-align:left"><span class="pl"><b>${l}</b></span><span class="pv">${esc(v)} ${icon("right")}</span></button>`; }
  function editParam(which) {
    const p = S.profile; const st = { age: p.age, height: p.height, weight: p.weight, sex: p.sex, activity: p.activity };
    let body = "";
    if (which === "pa") body = `<div class="numrow"><span><b>Пол</b></span>${segHTML("sx", [["m", "Мужской"], ["f", "Женский"]], st.sex).replace('class="seg"', 'class="seg" style="width:190px"')}</div><div class="numrow"><span><b>Возраст</b></span>${stepperHTML("age", st.age, "")}</div>`;
    if (which === "ph") body = `<div class="numrow"><span><b>Рост</b></span>${stepperHTML("height", st.height, "см")}</div>`;
    if (which === "pw") body = `<div class="numrow"><span><b>Вес</b></span>${stepperHTML("weight", st.weight, "кг", 0.5)}</div>`;
    if (which === "pact") body = ACT.map((a, i) => `<button class="opt ${st.activity === i ? "on" : ""}" data-act="${i}"><span class="oi">${a.e}</span><span><b>${a.n}</b><span>${a.s}</span></span><span class="rad"></span></button>`).join("");
    openSheet({ pa: "Пол и возраст", ph: "Рост", pw: "Вес", pact: "Активность" }[which], body, `<button class="btn" id="ep-save">Сохранить</button>`);
    const root = $("#sh-body");
    bindSteppers(root, st, { age: [14, 90], height: [130, 220], weight: [35, 200] });
    bindSeg(root, "sx", (v) => (st.sex = v));
    $$("[data-act]", root).forEach((b) => b.onclick = () => { st.activity = +b.dataset.act; $$("[data-act]", root).forEach((x) => x.classList.toggle("on", x === b)); haptic("sel"); });
    $("#ep-save").onclick = () => {
      Object.assign(p, st);
      if (which === "pw") S.weights[todayKey()] = st.weight;
      save(); closeSheet(); haptic("ok"); renderProfile(); toast("Сохранено");
    };
  }
  async function testKey() {
    const key = $("#k-in").value.trim(), model = $("#k-model").value.trim() || "gemini-flash-latest";
    if (!key) { toast("Сначала вставь ключ"); return; }
    const b = $("#k-test"); b.innerHTML = `<span class="spin" style="border-color:var(--g40);border-top-color:var(--ink)"></span>`;
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body: JSON.stringify({ contents: [{ parts: [{ text: "Ответь одним словом: ок" }] }] }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok) { haptic("ok"); toast("Ключ работает"); S.settings.key = key; S.settings.model = model; save(); }
      else { haptic("err"); toast((r.status === 404 ? "Модель не найдена" : r.status === 429 ? "Лимит исчерпан" : "Ключ не подходит") + ""); console.warn(j); }
    } catch (e) { haptic("err"); toast("Нет соединения"); }
    b.textContent = "Проверить";
  }
  function confirmReset() {
    openSheet("Удалить всё?", `<p style="margin:0 6px 10px;color:var(--g60)">Записи еды, история веса, свои продукты и настройки будут удалены без возможности восстановления.</p>`,
      `<div style="display:flex;gap:8px"><button class="btn ghost" id="rs-no">Отмена</button><button class="btn" id="rs-yes" style="background:var(--warn);color:#fff">Удалить</button></div>`);
    $("#rs-no").onclick = closeSheet;
    $("#rs-yes").onclick = () => {
      const theme = S.settings.theme; S = defaults(); S.settings.theme = theme; save();
      if (CS) { try { CS.getKeys((e, keys) => { if (keys && keys.length) CS.removeItems(keys); }); } catch (e) {} }
      closeSheet(); lastVals.clear(); haptic("medium"); startOnboarding();
    };
  }

  // ---------- nav ----------
  $("#nav-add").onclick = () => { haptic("medium"); openAdd(); };
  $("#nav-history").onclick = () => { haptic("light"); show(cur === "history" ? "today" : "history"); };
  $("#nav-profile").onclick = () => { haptic("light"); show(cur === "profile" ? "today" : "profile"); };
  // переход на новый день, если приложение висело открытым
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && cur === "today") { const tk = todayKey(); if (!S.days[selDay] && selDay !== tk) { selDay = tk; weekAnchor = null; } renderToday(); }
  });

  // ---------- init ----------
  function init() {
    load();
    if (inTg) {
      try {
        tg.ready(); tg.expand();
        if (tg.disableVerticalSwipes) tg.disableVerticalSwipes();
        tg.BackButton.onClick(goBack);
        tg.onEvent("themeChanged", () => { if (S.settings.theme === "auto") applyTheme(); });
        const setTop = () => { const ci = tg.contentSafeAreaInset || {}; document.documentElement.style.setProperty("--tg-top", (ci.top || 0) + "px"); };
        setTop(); tg.onEvent && tg.onEvent("contentSafeAreaChanged", setTop);
      } catch (e) {}
    }
    applyTheme();
    cloudPull(() => {
      load();
      applyTheme();
      if (!S.onboarded) startOnboarding(); else show("today");
    });
  }
  // демо-режим для проверки: ?demo
  if (/[?&]demo/.test(location.search)) {
    try {
      const d = defaults(); d.onboarded = true; d.profile.name = "Эдем";
      const now = new Date();
      const pick = (n) => window.FOODS.find((f) => f.n === n);
      const mk = (n, g, h, meal, dayOff) => { const f = pick(n); const v = scaleFood(f, g); const t = addDays(now, -dayOff); t.setHours(h, 10, 0, 0); return { id: uid(), n: f.n, e: f.e, g, k: r0(v.k), p: r1(v.p), f: r1(v.f), c: r1(v.c), meal, t: +t }; };
      for (let o = 0; o < 12; o++) {
        const k = dkey(addDays(now, -o));
        const arr = [mk("Овсянка на молоке", 300, 8, "breakfast", o), mk("Банан", 120, 8, "breakfast", o), mk("Протеин (порошок)", 30, 9, "breakfast", o)];
        if (o > 0 || now.getHours() >= 13) arr.push(mk(o % 3 ? "Плов" : "Лагман", 320 + (o % 4) * 30, 13, "lunch", o), mk("Лепёшка (нон)", 80, 13, "lunch", o));
        if (o > 0 || now.getHours() >= 16) arr.push(mk("Творог 5%", 180, 16, "snack", o));
        if (o > 0 || now.getHours() >= 19) arr.push(mk(o % 2 ? "Куриная грудка варёная" : "Манты", o % 2 ? 200 : 250, 19, "dinner", o), mk("Рис варёный", 200, 19, "dinner", o));
        d.days[k] = arr;
        if (o % 3 === 0) d.weights[k] = 72.4 - o * 0.08 + (o % 2) * 0.2;
      }
      localStorage.setItem(KEY, JSON.stringify(d));
      history.replaceState(null, "", location.pathname);
    } catch (e) { console.error(e); }
  }
  init();
  window.__porsiya = { get state() { return S; }, show, openAdd, renderToday };
})();
