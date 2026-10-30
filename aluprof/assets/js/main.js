/* ALUPROF — анимации и поведение страницы. Без внешних библиотек.
   Производительность: нативный скролл, позиции блоков кешируются (пересчёт только при resize),
   сцены считаются только когда меняется скролл, 3D — до 30 кадров/с и только в видимой области. */
(function () {
  'use strict';

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  const doc = document.documentElement;
  // Safari тяжело даются анимации, привязанные к скроллу, — там включаем упрощённый режим
  const ua = navigator.userAgent;
  const SAFARI = /Safari/.test(ua) && !/Chrome|Chromium|CriOS|Edg|OPR|Android|FxiOS/.test(ua);
  if (SAFARI) doc.classList.add('is-safari');
  const body = document.body;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => 1 - Math.pow(1 - t, 3);
  const easeIO = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  let VW = window.innerWidth, VH = window.innerHeight, SY = window.scrollY;
  const small = () => VW < 860;
  const absTop = el => { let y = 0; while (el) { y += el.offsetTop; el = el.offsetParent; } return y; };

  /* ---------------- якорные ссылки ---------------- */
  $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    if (id.length < 2) return;
    const t = $(id); if (!t) return;
    e.preventDefault();
    body.classList.remove('menu-open');
    window.scrollTo({ top: absTop(t), behavior: reduce ? 'auto' : 'smooth' });
  }));

  /* ---------------- разбивка заголовков на слова ---------------- */
  $$('[data-split]').forEach(el => {
    let i = 0;
    const walk = node => {
      Array.from(node.childNodes).forEach(n => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(p => {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span'); w.className = 'w';
            const s = document.createElement('span'); s.textContent = p; s.style.setProperty('--i', i++);
            w.appendChild(s); frag.appendChild(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && n.tagName !== 'BR') walk(n);
      });
    };
    walk(el);
  });

  /* ---------------- кеш позиций ---------------- */
  const layout = [];      // функции пересчёта позиций
  const scenes = [];      // функции, зависящие от скролла
  const tweens = [];      // плавное догоняние значений — анимации идут ровно, даже если колесо мыши прыгает
  const SMOOTH = reduce ? 1 : 0.14;
  function measure() {
    VW = window.innerWidth; VH = window.innerHeight;
    layout.forEach(fn => fn());
    tick(true);
  }

  /* ---------------- появление ---------------- */
  let pending = [];
  function armReveals() {
    pending = $$('[data-reveal], [data-split], .pstep').map(el => ({ el, top: 0 }));
    layout.push(() => pending.forEach(p => { p.top = absTop(p.el); }));
    pending.forEach(p => { p.top = absTop(p.el); });
    scenes.push(() => {
      if (!pending.length) return;
      const lim = SY + VH * 0.9;
      pending = pending.filter(p => { if (p.top < lim) { p.el.classList.add('is-in'); return false; } return true; });
    });
  }

  /* ---------------- счётчики ---------------- */
  const fmtNum = (v, sp) => sp ? v.toLocaleString('ru-RU').replace(/ /g, ' ') : String(v);
  const cio = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      const el = en.target; cio.unobserve(el);
      const to = parseFloat(el.dataset.count), from = parseFloat(el.dataset.from || 0), sp = el.dataset.format === 'space';
      if (reduce) { el.textContent = fmtNum(to, sp); return; }
      const t0 = performance.now();
      const step = now => {
        const t = clamp((now - t0) / 1600, 0, 1);
        el.textContent = fmtNum(Math.round(lerp(from, to, ease(t))), sp);
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }, { threshold: 0.4 });
  $$('[data-count]').forEach(el => cio.observe(el));

  /* ---------------- шапка ---------------- */
  const header = $('.header');
  const themed = $$('[data-theme]').map(el => ({ el, top: 0, bottom: 0, light: el.dataset.theme === 'light' }));
  layout.push(() => themed.forEach(t => { t.top = absTop(t.el); t.bottom = t.top + t.el.offsetHeight; }));
  let lastY = SY, lastLight = null, lastScrolled = null;
  scenes.push(() => {
    if (!header) return;
    const scrolled = SY > 40;
    if (scrolled !== lastScrolled) { header.classList.toggle('is-scrolled', scrolled); lastScrolled = scrolled; }
    if (SY > lastY + 4 && SY > 400 && !body.classList.contains('menu-open')) header.classList.add('is-hidden');
    else if (SY < lastY - 4) header.classList.remove('is-hidden');
    lastY = SY;
    const probe = SY + 42;
    let light = false;
    for (const t of themed) if (probe >= t.top && probe < t.bottom) { light = t.light; break; }
    if (light !== lastLight) { header.classList.toggle('is-light', light); lastLight = light; }
  });
  const burger = $('.burger');
  if (burger) burger.addEventListener('click', () => {
    const open = body.classList.toggle('menu-open');
    burger.setAttribute('aria-expanded', open);
    header.classList.remove('is-hidden');
  });
  $$('.mobile-menu a').forEach(a => a.addEventListener('click', () => body.classList.remove('menu-open')));

  /* ---------------- блок с позицией и прогрессом ---------------- */
  function tracked(el) {
    const o = { el, top: 0, h: 0 };
    layout.push(() => { o.top = absTop(el); o.h = el.offsetHeight; });
    o.vis = () => SY + VH > o.top - 100 && SY < o.top + o.h + 100;
    o.prog = () => clamp((SY - o.top) / ((o.h - VH) || 1), 0, 1);
    return o;
  }

  // карточки систем стопкой
  const stack = $('.stack');
  if (stack && !SAFARI) {
    const items = $$('.stack__item', stack).map(el => ({ el, sys: el.firstElementChild, shade: $('.sys__shade', el), top: 0, last: -1 }));
    const st = tracked(stack);
    layout.push(() => {
      // статичные позиции элементов (sticky не влияет на offsetTop родителя-обёртки)
      let y = absTop(stack);
      items.forEach(it => { it.top = y; y += it.el.offsetHeight + parseFloat(getComputedStyle(it.el).marginBottom); });
    });
    items.forEach(it => { it.cur = 0; it.tgt = 0; });
    scenes.push(() => {
      if (!st.vis()) return;
      const stickTop = small() ? 76 : 96;
      items.forEach((it, i) => {
        const next = items[i + 1];
        it.tgt = next ? ease(clamp((SY + VH - next.top) / (VH - stickTop), 0, 1)) : 0;
      });
    });
    tweens.push(() => {
      let moving = false;
      items.forEach(it => {
        const d = it.tgt - it.cur;
        if (Math.abs(d) < 0.0005) { if (it.cur === it.tgt) return; it.cur = it.tgt; } else { it.cur += d * SMOOTH; moving = true; }
        const e = it.cur;
        it.sys.style.transform = `translate3d(0,${(-e * 40).toFixed(1)}px,0)`;
        if (it.shade) it.shade.style.opacity = (e * 0.55).toFixed(3);
      });
      return moving;
    });
  }

  // изогнутая лента применения
  $$('.hscroll').forEach(sec => {
    if (SAFARI) return;
    const track = $('.hscroll__track', sec), count = $('.hscroll__count', sec), num = $('.hscroll__num', sec);
    const cards = $$('.app-card', track).map(el => ({ el, img: el.firstElementChild, x: 0, w: 0 }));
    const t = tracked(sec);
    let dist = 0;
    layout.push(() => {
      dist = Math.max(0, track.scrollWidth - VW);
      sec.style.height = (VH + dist * 1.1) + 'px';
      cards.forEach(c => { c.x = c.el.offsetLeft; c.w = c.el.offsetWidth; });
    });
    let cur = 0, tgt = 0;
    scenes.push(() => { if (t.vis()) tgt = t.prog(); });
    tweens.push(() => {
      const d = tgt - cur;
      if (Math.abs(d) < 0.0002) { if (cur === tgt) return false; cur = tgt; } else cur += d * SMOOTH;
      const p = cur, shift = p * dist;
      track.style.transform = `translate3d(${-shift}px,0,0)`;
      count.style.setProperty('--p', p.toFixed(3));
      if (num) num.textContent = String(Math.min(cards.length, 1 + Math.floor(p * cards.length * 0.999))).padStart(2, '0');
      cards.forEach(c => {
        const k = clamp((c.x - shift + c.w / 2 - VW / 2) / VW, -1.2, 1.2);
        c.el.style.transform = `perspective(1400px) rotateY(${(-k * 24).toFixed(1)}deg)`;
      });
      return cur !== tgt;
    });
  });

  // параллакс
  $$('[data-speed]').forEach(el => {
    const sp = parseFloat(el.dataset.speed), t = tracked(el.parentElement);
    scenes.push(() => { if (t.vis()) el.style.transform = `translate3d(0,${((t.top + t.h / 2 - SY - VH / 2) * sp).toFixed(1)}px,0)`; });
  });

  // манифест
  $$('[data-words]').forEach(el => {
    el.innerHTML = el.textContent.trim().split(/\s+/).map(w => `<span class="wd">${w}</span>`).join(' ');
    const ws = $$('.wd', el), t = tracked(el);
    let last = -1;
    scenes.push(() => {
      const p = clamp((SY + VH * 0.85 - t.top) / (t.h + VH * 0.35), 0, 1);
      const n = Math.round(p * ws.length);
      if (n === last) return; last = n;
      ws.forEach((w, i) => w.classList.toggle('on', i < n));
    });
  });

  // таймлайн
  $$('.tl').forEach(tl => {
    const items = $$('.tl__item', tl), t = tracked(tl);
    scenes.push(() => {
      const p = clamp((SY + VH * 0.8 - t.top) / (VH * 0.6), 0, 1);
      tl.style.setProperty('--p', p.toFixed(3));
      items.forEach((it, i) => it.classList.toggle('is-on', p >= i / items.length + 0.02));
    });
  });

  // производство: активный этап и запуск анимаций только у видимых схем
  const psteps = $$('.pstep').map(el => ({ el, top: 0, h: 0, play: false }));
  const pnav = $$('.prod__nav button');
  if (psteps.length) {
    layout.push(() => psteps.forEach(s => { s.top = absTop(s.el); s.h = s.el.offsetHeight; }));
    pnav.forEach(b => b.addEventListener('click', () => { const s = psteps[+b.dataset.go]; if (s) window.scrollTo({ top: s.top - 110, behavior: 'smooth' }); }));
    let lastBest = -1;
    scenes.push(() => {
      let best = 0, bd = 1e9;
      psteps.forEach((s, i) => {
        const d = Math.abs(s.top + s.h / 2 - SY - VH / 2); if (d < bd) { bd = d; best = i; }
        const play = SY + VH > s.top && SY < s.top + s.h;
        if (play !== s.play) { s.play = play; s.el.classList.toggle('is-play', play); }
      });
      if (best !== lastBest) { lastBest = best; pnav.forEach((b, i) => b.classList.toggle('is-active', i === best)); }
    });
  }

  // детали: липкое фото
  const dsItems = $$('.ds__item').map(el => ({ el, top: 0, h: 0 }));
  if (dsItems.length) {
    const imgs = $$('.ds__frame img'), numEl = $('.ds__num');
    layout.push(() => dsItems.forEach(s => { s.top = absTop(s.el); s.h = s.el.offsetHeight; }));
    let last = 0;
    scenes.push(() => {
      let cur = 0;
      dsItems.forEach((s, i) => { if (s.top + s.h * 0.35 < SY + VH * 0.6) cur = i; });
      if (cur === last) return; last = cur;
      dsItems.forEach((s, i) => s.el.classList.toggle('is-on', i === cur));
      imgs.forEach((im, i) => { im.classList.toggle('is-on', i === cur); im.classList.toggle('is-past', i < cur); });
      if (numEl) numEl.textContent = '0' + (cur + 1);
    });
  }

  // география: маршрут рисуется по скроллу
  const geoWrap = $('.geo__pin-wrap');
  if (geoWrap) {
    const route = $('.geo__route', geoWrap), cityB = $('.geo__city--b', geoWrap), cards = $$('.geo__card', geoWrap);
    const len = route.getTotalLength();
    route.style.strokeDasharray = len; route.style.strokeDashoffset = len;
    const t = tracked(geoWrap);
    scenes.push(() => {
      if (!t.vis()) return;
      const p = small() ? clamp((SY + VH - t.top) / VH, 0, 1) : t.prog();
      const e = easeIO(clamp((p - 0.08) / 0.6, 0, 1));
      route.style.strokeDashoffset = (len * (1 - e)).toFixed(1);
      cityB.style.opacity = clamp((e - 0.85) / 0.15, 0, 1).toFixed(2);
      if (cards[1]) cards[1].classList.toggle('is-on', e > 0.9);
    });
  }

  function measureDraw() { $$('.draw').forEach(p => { try { if (!p.style.getPropertyValue('--len')) p.style.setProperty('--len', Math.ceil(p.getTotalLength())); } catch (e) {} }); }

  // процесс сотрудничества: линия заполняется по скроллу
  $$('.coop').forEach(el => {
    const t = tracked(el), steps = $$('.coop__step', el);
    scenes.push(() => {
      if (!t.vis()) return;
      const p = clamp((SY + VH * 0.75 - t.top) / (t.h * 0.9), 0, 1);
      el.style.setProperty('--p', p.toFixed(3));
      steps.forEach((s, i) => s.classList.toggle('is-on', p >= (i + 0.3) / steps.length));
    });
  });
  // слайдер истории
  $$('.hslider__nav button').forEach(b => b.addEventListener('click', () => {
    const tr = b.closest('.wrap').querySelector('.hslider__track'), card = tr.querySelector('.hcard');
    tr.scrollBy({ left: (+b.dataset.hs) * (card.offsetWidth + 18), behavior: 'smooth' });
  }));

  // FAQ: открыт только один пункт
  $$('.faq').forEach(f => {
    const items = $$('.faq__item', f);
    items.forEach(it => $('.faq__q', it).addEventListener('click', () => {
      const open = !it.classList.contains('is-open');
      items.forEach(o => { o.classList.remove('is-open'); $('.faq__q', o).setAttribute('aria-expanded', 'false'); });
      if (open) { it.classList.add('is-open'); $('.faq__q', it).setAttribute('aria-expanded', 'true'); }
      setTimeout(measure, 600);
    }));
  });

  /* ---------------- футер: надпись на всю ширину ---------------- */
  const big = $('.footer__big');
  function fitBig() {
    if (!big) return;
    big.style.fontSize = '100px';
    const inner = big.firstElementChild;
    const w = inner ? inner.offsetWidth : 0;
    if (w) big.style.fontSize = (100 * big.clientWidth / w).toFixed(2) + 'px';
  }

  /* ---------------- 3D: герой — детали отрисованы слоями один раз; при загрузке профиль «раскрывается» ---------------- */
  const heroStage = $('.hero__stage');
  const heroLayers = [];
  const heroMouse = { x: 0, y: 0, tx: 0, ty: 0, active: false };
  let heroInit = false, heroFull = null;
  function initHero() {
    if (heroInit || !heroStage || !window.Profile3D) return;
    heroInit = true;
    const view = { length: 64, yaw: -0.62, pitch: 0.42, roll: -0.08, scale: 0.72, env: 'dark', offsetX: -0.05, offsetY: 0.04 };
    const keys = ['int', 'pa', 'glass', 'ext', 'gsk'];
    const probe = new window.Profile3D(document.createElement('canvas'), view);
    // дальние детали — первыми, ближние — сверху
    keys.sort((a, b) => probe.depth(b, 1) - probe.depth(a, 1));
    // собранный вид — одним холстом (правильные перекрытия), детали — слоями для раскрытия
    const full = document.createElement('canvas'); full.className = 'full';
    heroStage.appendChild(full);
    heroFull = new window.Profile3D(full, view); heroFull.render();
    keys.forEach((key, i) => {
      const cv = document.createElement('canvas');
      heroStage.appendChild(cv);
      const pr = new window.Profile3D(cv, Object.assign({}, view, { only: [key] }));
      pr.render();
      const L = { cv, key, pr, d: pr.screenDelta(key, 1) };
      cv.style.transitionDelay = ({ ext: 0, int: 0, gsk: 0.12, glass: 0.18, pa: 0.25 }[key] || 0) + 's';
      pr.onresize = () => { L.d = pr.screenDelta(key, 1); setOpen(); };
      heroLayers.push(L);
    });
    if (!reduce && window.matchMedia('(hover: hover)').matches) {
      window.addEventListener('pointermove', e => {
        if (SY > VH) return;
        heroMouse.tx = e.clientX / VW - 0.5; heroMouse.ty = e.clientY / VH - 0.5; heroMouse.active = true;
      }, { passive: true });
    }
  }
  let heroOpen = false;
  function setOpen() {
    const k = heroOpen ? 1 : 0;
    heroLayers.forEach(l => { l.cv.style.transform = `translate3d(${(l.d[0] * k).toFixed(1)}px,${(l.d[1] * k).toFixed(1)}px,0)`; });
  }
  function openHero() { if (!heroStage) return; initHero(); if (heroFull) { heroFull.resize(); heroFull.render(); } heroLayers.forEach(l => { l.pr.resize(); l.pr.render(); l.d = l.pr.screenDelta(l.key, 1); }); void heroStage.offsetWidth; heroOpen = true; if (heroStage) heroStage.classList.add('is-open'); setOpen(); }
  function heroFrame() {
    if (!heroStage || !heroMouse.active) return;
    const dx = heroMouse.tx - heroMouse.x, dy = heroMouse.ty - heroMouse.y;
    if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) { heroMouse.active = false; return; }
    heroMouse.x += dx * 0.07; heroMouse.y += dy * 0.07;
    heroStage.style.transform = `rotateY(${(heroMouse.x * 12).toFixed(2)}deg) rotateX(${(-heroMouse.y * 8).toFixed(2)}deg)`;
  }

  /* ---------------- 3D: разборка — детали отрисованы по слоям один раз, при скролле только сдвиг ---------------- */
  const exSec = $('.explode');
  if (exSec && window.Profile3D) {
    const view = { length: 120, yaw: -0.62, pitch: 0.44, roll: 0.05, scale: 0.86, env: 'light', maxDpr: 1.5 };
    const layers = $$('.explode__stage canvas', exSec).map(cv => {
      const key = cv.dataset.part;
      const pr = new window.Profile3D(cv, Object.assign({}, view, { only: [key] }));
      pr.render();
      return { cv, key, pr, d: pr.screenDelta(key, 1) };
    });
    layers.forEach(l => { l.pr.onresize = () => { l.d = l.pr.screenDelta(l.key, 1); dirty = true; }; });
    const stage = $('.explode__stage', exSec);
    const exT = tracked(exSec);
    const callouts = $$('.callout', exSec).sort((a, b) => a.dataset.step - b.dataset.step);
    const exBar = $('.explode__progress', exSec);
    let lastIdx = -2, cur = 0, tgt = 0;
    window.addEventListener('load', () => layers.forEach(l => { l.pr.resize(); l.pr.render(); l.d = l.pr.screenDelta(l.key, 1); dirty = true; }));
    if (SAFARI) {
      // без привязки к скроллу: профиль один раз разбирается, когда блок появляется на экране
      callouts.forEach(c => c.classList.add('is-on'));
      const io2 = new IntersectionObserver(es => es.forEach(e => {
        if (!e.isIntersecting) return; io2.disconnect();
        layers.forEach(l => { l.pr.resize(); l.pr.render(); l.d = l.pr.screenDelta(l.key, 1); l.cv.style.transform = `translate3d(${(l.d[0] * 0.82).toFixed(1)}px,${(l.d[1] * 0.82).toFixed(1)}px,0)`; });
        if (exBar) exBar.style.setProperty('--p', 1);
      }), { threshold: 0.35 });
      io2.observe(exSec);
    } else
    scenes.push(() => { if (exT.vis()) tgt = exT.prog(); });
    if (!SAFARI) tweens.push(() => {
      const dd = tgt - cur;
      if (Math.abs(dd) < 0.0002) { if (cur === tgt) return false; cur = tgt; } else cur += dd * SMOOTH;
      const p = cur;
      const ex = p < 0.12 ? 0 : p < 0.62 ? easeIO((p - 0.12) / 0.5) : p < 0.86 ? 1 : 1 - easeIO((p - 0.86) / 0.14);
      layers.forEach(l => { l.cv.style.transform = `translate3d(${(l.d[0] * ex * 0.82).toFixed(1)}px,${(l.d[1] * ex * 0.82).toFixed(1)}px,0)`; });
      const idx = p < 0.18 ? -1 : p < 0.34 ? 0 : p < 0.48 ? 1 : p < 0.62 ? 2 : p < 0.9 ? 3 : -1;
      if (idx !== lastIdx) { lastIdx = idx; callouts.forEach((c, i) => { c.classList.toggle('is-on', idx >= 0 && i <= idx); c.classList.toggle('is-active', i === idx); }); }
      if (exBar) exBar.style.setProperty('--p', p.toFixed(3));
      return cur !== tgt;
    });
  }

  /* ---------------- главный цикл ---------------- */
  let dirty = true;
  function tick(force) { if (force) dirty = true; }
  window.addEventListener('scroll', () => { dirty = true; }, { passive: true });
  function loop(now) {
    if (!document.hidden) {
      if (dirty) { SY = window.scrollY; scenes.forEach(fn => fn()); dirty = false; }
      heroFrame();
      for (let i = 0; i < tweens.length; i++) tweens[i]();
    }
    requestAnimationFrame(loop);
  }
  let rt;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { measure(); fitBig(); }, 150); });
  window.addEventListener('load', () => {
    measure(); measureDraw(); fitBig();
    const t = location.hash && location.hash.length > 1 ? document.querySelector(location.hash) : null;
    window.scrollTo(0, t ? absTop(t) : 0);
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { measure(); fitBig(); });

  /* ---------------- прелоадер ---------------- */
  function startPage() {
    body.classList.remove('is-loading');
    doc.classList.add('is-ready');
    initHero();
    // раскрываем, когда страница, шрифты и раскладка точно готовы (важно при перезагрузке)
    const ready = [new Promise(r => document.readyState === 'complete' ? r() : window.addEventListener('load', r, { once: true }))];
    if (document.fonts && document.fonts.ready) ready.push(document.fonts.ready);
    Promise.all(ready).then(() => setTimeout(openHero, reduce ? 0 : 700));
    armReveals();
    measure();
  }
  function ssGet(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function ssSet(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }
  const pre = $('.preloader');
  if (pre && !reduce && !ssGet('alp-seen')) {
    const line = $('.pl__line', pre), cnt = $('.pl__count', pre);
    requestAnimationFrame(() => pre.classList.add('is-on'));
    const s = performance.now(), T = 1500;
    let loaded = document.readyState === 'complete';
    window.addEventListener('load', () => { loaded = true; });
    const step = now => {
      // ждём загрузку страницы, но не дольше 4 секунд
      const limit = loaded || now - s > 4000 ? 1 : 0.9;
      const t = Math.min(limit, (now - s) / T), e = easeIO(t);
      line.style.setProperty('--p', e.toFixed(3));
      cnt.textContent = Math.round(e * 100) + '%';
      if (t < 1) requestAnimationFrame(step);
      else setTimeout(() => { pre.classList.add('is-done'); startPage(); ssSet('alp-seen', '1'); setTimeout(() => pre.remove(), 1200); }, 200);
    };
    requestAnimationFrame(step);
  } else {
    if (pre) pre.remove();
    startPage();
  }
  setTimeout(() => { measureDraw(); fitBig(); }, 60);
  requestAnimationFrame(loop);

  /* ---------------- форма ---------------- */
  $$('form[data-form]').forEach(form => {
    const phone = form.querySelector('input[name="phone"]');
    if (phone) {
      phone.addEventListener('focus', () => { if (!phone.value) phone.value = '+998 '; });
      phone.addEventListener('input', () => {
        let d = phone.value.replace(/\D/g, '');
        if (!d.startsWith('998')) d = '998' + d;
        d = d.slice(0, 12);
        const p = [d.slice(0, 3), d.slice(3, 5), d.slice(5, 8), d.slice(8, 10), d.slice(10, 12)];
        phone.value = '+' + p[0] + (p[1] ? ' ' + p[1] : '') + (p[2] ? ' ' + p[2] : '') + (p[3] ? '-' + p[3] : '') + (p[4] ? '-' + p[4] : '');
      });
    }
    form.addEventListener('submit', async e => {
      e.preventDefault();
      let ok = true;
      $$('[required]', form).forEach(inp => {
        const f = inp.closest('.field');
        const bad = inp.name === 'phone' ? inp.value.replace(/\D/g, '').length < 12 : !inp.value.trim();
        f.classList.toggle('is-error', bad); if (bad) ok = false;
      });
      if (!ok) { const first = form.querySelector('.is-error input'); if (first) first.focus(); return; }
      const btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      const data = Object.fromEntries(new FormData(form).entries());
      // Адрес обработчика задаётся в data-endpoint (серверный скрипт, который пересылает заявку в Telegram и на почту).
      const endpoint = form.dataset.endpoint;
      try { if (endpoint) await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); } catch (err) {}
      form.closest('.form').classList.add('is-sent');
      btn.disabled = false;
    });
  });
})();
