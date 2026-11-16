/* ALUPROF — 3D-профиль Thermo Silver (рама TRM-001-002). Canvas 2D, без библиотек.
   Лёгкий рендер: без размытия и текстур, только заливки и блики — быстро даже на слабых ноутбуках. */
(function () {
  'use strict';

  // ---------- геометрия сечения (x вправо, y вниз), мм ----------
  const EXT = { key: 'ext', mat: 'alu', contours: [
    [[0,0],[59,0],[59,2.4],[56.6,2.4],[56.6,3.6],[55.2,3.6],[55.2,2.4],[53,2.4],[53,5.2],[50.4,5.2],[50.4,2.4],[38,2.4],[38,15],[39.6,15],[39.6,17],[38,17],[38,21],[33.6,21],[33.6,23.6],[28.4,23.6],[28.4,21],[9.6,21],[9.6,23.6],[4.4,23.6],[4.4,21],[0,21],[0,17],[-1.6,17],[-1.6,15],[0,15]],
    [[2.2,2.2],[35.8,2.2],[35.8,18.8],[2.2,18.8]]
  ]};
  const INT = { key: 'int', mat: 'alu', contours: [
    [[0,43],[4.4,43],[4.4,40.4],[9.6,40.4],[9.6,43],[28.4,43],[28.4,40.4],[33.6,40.4],[33.6,43],[38,43],[38,48],[39.6,48],[39.6,50],[38,50],[38,61.6],[40.4,61.6],[40.4,64],[-2.4,64],[-2.4,61.6],[0,61.6],[0,50],[-1.6,50],[-1.6,48],[0,48]],
    [[2.2,45.2],[35.8,45.2],[35.8,59.6],[2.2,59.6]]
  ]};
  const box = (x, y, w, h) => [[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
  function strip(cx, flag) {
    const p = [[cx-3,21.9],[cx+3,21.9],[cx+1.1,24.4]];
    if (flag) p.push([cx+1.1,29.2],[cx+5.6,29.2],[cx+5.6,34.6],[cx+3.9,34.6],[cx+3.9,30.9],[cx+1.1,30.9]);
    p.push([cx+1.1,39.6],[cx+3,42.1],[cx-3,42.1],[cx-1.1,39.6],[cx-1.1,24.4]);
    return p;
  }
  const PARTS = [
    EXT,
    { key: 'ext', mat: 'alu', contours: [box(2.2, 8.4, 2.6, 3.6)] },
    { key: 'ext', mat: 'alu', contours: [box(33.2, 8.4, 2.6, 3.6)] },
    { key: 'pa', mat: 'red', contours: [strip(7, false)] },
    { key: 'pa', mat: 'red', contours: [strip(31, true)] },
    INT,
    { key: 'int', mat: 'alu', contours: [box(2.2, 50.6, 2.6, 3.6)] },
    { key: 'int', mat: 'alu', contours: [box(33.2, 50.6, 2.6, 3.6)] },
    { key: 'gsk', mat: 'rubber', contours: [[[41,2.4],[47.4,2.4],[47.4,4.2],[46.4,6.8],[44.2,7.6],[42,6.8],[41,4.2]]] },
    { key: 'glass', mat: 'glass', contours: [box(46, 9, 40, 4)] },
    { key: 'glass', mat: 'glass', contours: [box(46, 29, 40, 4)] },
    { key: 'glass', mat: 'rubber', contours: [box(46, 13, 5, 16)] }
  ];
  const SECTION = [PARTS[0], PARTS[3], PARTS[4], PARTS[5], PARTS[8]];
  const CX = 19, CY = 32;
  const EXPLODE = { ext: [0, -34], pa: [0, 0], int: [0, 36], gsk: [12, -56], glass: [44, -14] };

  function area(c) { let a = 0; for (let i = 0; i < c.length; i++) { const p = c[i], q = c[(i+1)%c.length]; a += p[0]*q[1]-q[0]*p[1]; } return a/2; }
  PARTS.forEach(part => {
    part.contours = part.contours.map((c, i) => ((area(c) > 0) === (i === 0) ? c : c.slice().reverse()));
  });

  // материалы: светлый анодированный алюминий, полиамид, EPDM
  const MATS = {
    alu:    { dark: [104, 116, 130], light: [244, 247, 250], spec: 0.9, metal: true },
    red:    { dark: [170, 10, 12],   light: [255, 70, 60],   spec: 0.25 },
    rubber: { dark: [22, 26, 32],    light: [70, 78, 88],    spec: 0.3 },
    glass:  { dark: [90, 140, 170],  light: [200, 230, 245], spec: 1, alpha: 0.5 }
  };

  function Profile3D(canvas, opts) {
    this.c = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true });
    this.state = Object.assign({ maxDpr: 1.25, length: 150, offsetX: 0, offsetY: 0, yaw: -0.65, pitch: 0.42, roll: 0, scale: 1, explode: 0, env: 'dark' }, opts || {});
    this.resize();
    let t; window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => { this.resize(); this.render(); if (this.onresize) this.onresize(); }, 120); });
  }
  Profile3D.prototype.resize = function () {
    const dpr = Math.min(window.devicePixelRatio || 1, this.state && this.state.maxDpr || 1.25);
    this.dpr = dpr;
    this.w = Math.max(1, this.c.offsetWidth); this.h = Math.max(1, this.c.offsetHeight);
    this.c.width = Math.round(this.w * dpr); this.c.height = Math.round(this.h * dpr);
    this.dirty = true;
  };
  Profile3D.prototype.set = function (s) {
    for (const k in s) { if (Math.abs((this.state[k] || 0) - s[k]) > 1e-4) { this.state[k] = s[k]; this.dirty = true; } }
  };

  const L1 = norm([-0.3, -0.85, -0.45]);   // ключевой свет сверху-спереди
  const L2 = norm([0.7, -0.1, -0.7]);      // заполняющий справа
  const H1 = norm([L1[0], L1[1], L1[2] - 1]);

  Profile3D.prototype.render = function () {
    if (!this.dirty) return;
    this.dirty = false;
    const ctx = this.ctx, s = this.state, W = this.w, H = this.h, dpr = this.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const unit = Math.min(W, H) / 150 * s.scale;
    const cy = Math.cos(s.yaw), sy = Math.sin(s.yaw), cp = Math.cos(s.pitch), sp = Math.sin(s.pitch), cr = Math.cos(s.roll), sr = Math.sin(s.roll);
    const camD = 560, L = s.length, ex = s.explode;
    const ox0 = W/2 + s.offsetX*W, oy0 = H/2 + s.offsetY*H;
    const dark = s.env === 'dark';
    const faces = [];

    for (const part of PARTS) {
      if (s.only && s.only.indexOf(part.key) < 0) continue;
      const off = EXPLODE[part.key];
      const ox = off[0]*ex - CX, oy = off[1]*ex - CY, oz = -L/2;
      const mat = MATS[part.mat];
      const capF = [], capB = [];
      for (const c of part.contours) {
        const n = c.length, F = new Array(n), B = new Array(n);
        for (let i = 0; i < n; i++) {
          const x = c[i][0] + ox, y = c[i][1] + oy;
          F[i] = tr(x, y, oz); B[i] = tr(x, y, oz + L);
        }
        capF.push(F); capB.push(B);
        for (let i = 0; i < n; i++) {
          const j = (i + 1) % n;
          const a = F[i], b = F[j], c2 = B[j], d = B[i];
          const ar = (b[3]-a[3])*(c2[4]-a[4]) - (c2[3]-a[3])*(b[4]-a[4]);
          if (ar <= 0) continue; // невидимая грань
          const nn = norm(cross([b[0]-a[0], b[1]-a[1], b[2]-a[2]], [d[0]-a[0], d[1]-a[1], d[2]-a[2]]));
          faces.push({ t: 0, p: [a, b, c2, d], n: nn, mat, z: (a[2]+b[2]+c2[2]+d[2]) / 4 });
        }
      }
      for (const cap of [capF, capB]) {
        const o = cap[0];
        const nn = norm(cross([o[1][0]-o[0][0], o[1][1]-o[0][1], o[1][2]-o[0][2]], [o[2][0]-o[0][0], o[2][1]-o[0][1], o[2][2]-o[0][2]]));
        let z = 0; for (const q of o) z += q[2];
        faces.push({ t: 1, rings: cap, n: nn, mat, z: z / o.length });
      }
    }
    faces.sort((a, b) => b.z - a.z);

    ctx.lineJoin = 'round';
    for (const f of faces) {
      ctx.globalAlpha = f.mat.alpha || 1;
      const col = shade(f.mat, f.n, dark, f.t === 1);
      ctx.beginPath();
      if (f.t === 0) {
        const p = f.p;
        ctx.moveTo(p[0][3], p[0][4]); ctx.lineTo(p[1][3], p[1][4]); ctx.lineTo(p[2][3], p[2][4]); ctx.lineTo(p[3][3], p[3][4]); ctx.closePath();
        if (f.mat.metal) {
          // металлический перелив вдоль профиля: светлая полоса — тень — отражение
          const g = ctx.createLinearGradient(p[0][3], p[0][4], p[3][3], p[3][4]);
          g.addColorStop(0, rgb(col, 1.06)); g.addColorStop(0.32, rgb(col, 0.9)); g.addColorStop(0.62, rgb(col, 1.1)); g.addColorStop(1, rgb(col, 0.86));
          ctx.fillStyle = g;
        } else ctx.fillStyle = rgb(col, 1);
        ctx.fill();
        ctx.strokeStyle = rgb(col, 1); ctx.lineWidth = 0.7; ctx.stroke();
        if (f.mat.metal) { // светлое ребро вдоль профиля
          ctx.beginPath(); ctx.moveTo(p[0][3], p[0][4]); ctx.lineTo(p[3][3], p[3][4]);
          ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 0.8; ctx.stroke();
        }
      } else {
        for (const r of f.rings) { ctx.moveTo(r[0][3], r[0][4]); for (let i = 1; i < r.length; i++) ctx.lineTo(r[i][3], r[i][4]); ctx.closePath(); }
        if (f.mat.metal) {
          const o = f.rings[0]; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
          for (const q of o) { if (q[3] < x0) x0 = q[3]; if (q[3] > x1) x1 = q[3]; if (q[4] < y0) y0 = q[4]; if (q[4] > y1) y1 = q[4]; }
          const g = ctx.createLinearGradient(x0, y0, x1, y1);
          g.addColorStop(0, rgb(col, 1.1)); g.addColorStop(0.45, rgb(col, 0.92)); g.addColorStop(0.55, rgb(col, 0.82)); g.addColorStop(1, rgb(col, 1.04));
          ctx.fillStyle = g;
        } else ctx.fillStyle = rgb(col, 1);
        ctx.fill('evenodd');
        ctx.lineWidth = 1;
        ctx.strokeStyle = f.mat.metal ? 'rgba(255,255,255,0.95)' : f.mat === MATS.red ? 'rgba(255,150,140,0.95)' : 'rgba(110,120,130,0.9)';
        ctx.stroke();
      }
    }

    function tr(x, y, z) {
      const x1 = x*cr - y*sr, y1 = x*sr + y*cr;
      const x2 = x1*cy + z*sy, z2 = -x1*sy + z*cy;
      const y3 = y1*cp - z2*sp, z3 = y1*sp + z2*cp;
      const f = camD / (camD + z3);
      return [x2, y3, z3, ox0 + x2*unit*f, oy0 + y3*unit*f];
    }
  };

  // смещение на экране (px) для разлёта детали на ex — чтобы двигать готовые слои через CSS
  Profile3D.prototype.screenDelta = function (key, ex) {
    const s = this.state, off = EXPLODE[key];
    const unit = Math.min(this.w, this.h) / 150 * s.scale;
    const cy = Math.cos(s.yaw), sy = Math.sin(s.yaw), cp = Math.cos(s.pitch), sp = Math.sin(s.pitch), cr = Math.cos(s.roll), sr = Math.sin(s.roll);
    const x = off[0] * ex, y = off[1] * ex;
    const x1 = x*cr - y*sr, y1 = x*sr + y*cr;
    const x2 = x1*cy, z2 = -x1*sy;
    const y3 = y1*cp - z2*sp;
    return [x2 * unit, y3 * unit];
  };

  // средняя глубина детали (больше — дальше от камеры), для порядка слоёв
  Profile3D.prototype.depth = function (key, ex) {
    const s = this.state, off = EXPLODE[key];
    const cy = Math.cos(s.yaw), sy = Math.sin(s.yaw), cp = Math.cos(s.pitch), sp = Math.sin(s.pitch), cr = Math.cos(s.roll), sr = Math.sin(s.roll);
    let sum = 0, n = 0;
    for (const part of PARTS) {
      if (part.key !== key) continue;
      for (const c of part.contours) for (const q of c) {
        const x = q[0] - CX + off[0]*ex, y = q[1] - CY + off[1]*ex;
        const x1 = x*cr - y*sr, y1 = x*sr + y*cr;
        const z2 = -x1*sy;
        sum += y1*sp + z2*cp; n++;
      }
    }
    return n ? sum / n : 0;
  };

  function shade(mat, n, dark, cap) {
    const d1 = Math.max(0, -(n[0]*L1[0] + n[1]*L1[1] + n[2]*L1[2]));
    const d2 = Math.max(0, -(n[0]*L2[0] + n[1]*L2[1] + n[2]*L2[2]));
    const sp = Math.pow(Math.abs(n[0]*H1[0] + n[1]*H1[1] + n[2]*H1[2]), 24) * mat.spec;
    let k = 0.3 + 0.55 * d1 + 0.2 * d2 + (cap ? 0.1 : 0);
    if (mat.metal) k += Math.max(0, -n[1]) * 0.12; // отражение светлого неба
    k = Math.min(1, k);
    const c = mix(mat.dark, mat.light, k);
    const s = 255 * sp * 0.6;
    return [Math.min(255, c[0] + s), Math.min(255, c[1] + s), Math.min(255, c[2] + s)];
  }
  function rgb(c, k) { return 'rgb(' + Math.min(255, c[0]*k | 0) + ',' + Math.min(255, c[1]*k | 0) + ',' + Math.min(255, c[2]*k | 0) + ')'; }
  function cross(a, b) { return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]; }
  function norm(a) { const m = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0]/m, a[1]/m, a[2]/m]; }
  function mix(a, b, t) { return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t]; }

  Profile3D.prototype.flush = function () { this.ctx.globalAlpha = 1; };
  Profile3D.sectionPaths = function () {
    return SECTION.map(part => ({
      mat: part.mat,
      d: part.contours.map(c => 'M' + c.map(p => (p[0]+3).toFixed(1) + ' ' + (p[1]+1).toFixed(1)).join('L') + 'Z').join('')
    }));
  };

  window.Profile3D = Profile3D;
})();
