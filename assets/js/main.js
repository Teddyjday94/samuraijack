/* Back to the Past — an unofficial Samurai Jack fan site. All page logic. */
var STILL = { db: null, assets: null, slots: {}, gallery: [] };

(() => {
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (_) { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }
};
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------- reveal on scroll (transform only; content is visible at rest) ---------- */
if (!RM && 'IntersectionObserver' in window) {
  const els = $$('.reveal');
  const vh = innerHeight;
  els.forEach(el => { if (el.getBoundingClientRect().top < vh) el.classList.add('in'); });
  document.documentElement.classList.add('reveal-ready');
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
  els.forEach(el => { if (!el.classList.contains('in')) io.observe(el); });
} else { $$('.reveal').forEach(el => el.classList.add('in')); }

/* nav highlight */
const links = $$('.nav a.l');
if ('IntersectionObserver' in window) {
  const nio = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) links.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id));
  }), { rootMargin: '-45% 0px -50% 0px' });
  $$('main section').forEach(s => nio.observe(s));
}

/* ============ JACK ⇄ AKU: liquid burn reveal ============ */
// Jack sits on top. A liquid brush that follows the cursor burns holes through him and shows Aku underneath.
// The two drawings are aligned on the face: Aku's green mask lands exactly over Jack's face, on one shared center line.
const morph = { p: 0, e: 0, target: 0, last: 0 };
(() => {
  const el = $('#portrait'), cv = $('#revealCanvas'); if (!el || !cv) return;
  const cx = cv.getContext('2d');
  const JF = { cx: 336, cy: 265, w: 208 }, AF = { cx: 480.5, cy: 211, w: 117 }; // measured face boxes, in each image's own pixels
  const JW = 876, JH = 2000, AW = 827, AH = 1104, K = 1.6;                      // K: Aku's face is drawn 1.6x Jack's
  const sA = K * JF.w / AF.w, ax = JF.cx - AF.cx * sA, ay = JF.cy - AF.cy * sA;
  const half = Math.max(JF.cx - Math.min(0, ax), Math.max(JW, ax + AW * sA) - JF.cx);
  const top = Math.min(0, ay), bottom = Math.max(JH, ay + AH * sA);
  const STAGE = { x0: JF.cx - half, y0: top, w: half * 2, h: bottom - top };
  el.style.setProperty('--pa', (STAGE.w / STAGE.h).toFixed(4));
  const jackImg = new Image(), akuImg = new Image(); let loaded = 0;
  const jackC = document.createElement('canvas'), akuC = document.createElement('canvas'), maskC = document.createElement('canvas'), layer = document.createElement('canvas');
  const jx = jackC.getContext('2d'), axx = akuC.getContext('2d'), mx = maskC.getContext('2d'), lx = layer.getContext('2d');
  let W = 0, H = 0, D = 1, S = 1, face = { x: 0, y: 0 };
  function bake() {
    if (loaded < 2) return;
    D = Math.min(devicePixelRatio || 1, 2); W = el.clientWidth; H = el.clientHeight; if (!W || !H) return;
    for (const c of [cv, jackC, akuC, maskC, layer]) { c.width = Math.round(W * D); c.height = Math.round(H * D); }
    S = Math.min(W / STAGE.w, H / STAGE.h) * D;
    const ox = (W * D - STAGE.w * S) / 2 - STAGE.x0 * S, oy = (H * D - STAGE.h * S) / 2 - STAGE.y0 * S;
    jx.clearRect(0, 0, jackC.width, jackC.height); jx.drawImage(jackImg, ox, oy, JW * S, JH * S);
    axx.clearRect(0, 0, akuC.width, akuC.height); axx.drawImage(akuImg, ox + ax * S, oy + ay * S, AW * sA * S, AH * sA * S);
    face = { x: (ox + JF.cx * S) / D, y: (oy + JF.cy * S) / D };
    el.style.setProperty('--fy', (face.y / H * 100).toFixed(2) + '%');
    if (typeof placeSun === 'function' && HW) placeSun();
  }
  morph.face = () => { const r = el.getBoundingClientRect(); return { x: r.left + face.x, y: r.top + face.y, r: r.width * .37 }; };
  jackImg.onload = akuImg.onload = () => { loaded++; bake(); };
  jackImg.src = 'assets/img/jack.webp'; akuImg.src = 'assets/img/aku.png';
  new ResizeObserver(bake).observe(el);

  // ----- the brush: a trail of wobbling ink blobs that swell, linger and heal -----
  const trail = [], embers = [], plabel = $('.plabel', el);
  let hovering = false, ptr = { x: 0, y: 0 }, lastP = null, full = 0, fullTarget = 0, fullOrigin = { x: 0, y: 0 };
  const LIFE = 1.5;
  function addPoint(x, y) {
    const R = Math.min(W, H) * .17;
    if (lastP && Math.hypot(x - lastP.x, y - lastP.y) < R * .18) return;
    const sp = lastP ? Math.min(1, Math.hypot(x - lastP.x, y - lastP.y) / (R * 1.5)) : 0;
    trail.push({ x, y, r: R * (.75 + sp * .45), t: 0, seed: Math.random() * 10 }); lastP = { x, y };
    if (trail.length > 60) trail.shift();
    for (let i = 0; i < 3; i++) embers.push({ x: x + rand(-R, R) * .6, y: y + rand(-R, R) * .6, vx: rand(-.4, .4), vy: rand(-1.6, -.4), life: 1, c: Math.random() < .5 ? '#ff3b30' : '#ff3b30', r: rand(1, 2.6) });
  }
  const local = e => { const r = el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  el.addEventListener('pointerenter', e => { hovering = true; lastP = null; ptr = local(e); });
  el.addEventListener('pointerleave', () => { hovering = false; lastP = null; });
  el.addEventListener('pointermove', e => { ptr = local(e); if (e.pointerType === 'mouse' || e.buttons) addPoint(ptr.x, ptr.y); if (!RM) { cv.style.setProperty('--ry', ((ptr.x / W - .5) * 12).toFixed(2) + 'deg'); cv.style.setProperty('--rx', ((.5 - ptr.y / H) * 8).toFixed(2) + 'deg'); } });
  el.addEventListener('pointerleave', () => { cv.style.setProperty('--rx', '0deg'); cv.style.setProperty('--ry', '0deg'); });
  // clicking Jack does nothing (and doesn't trigger the sky slash behind him); the brush is the only reveal
  el.addEventListener('click', e => e.stopPropagation());

  function blob(c, b, r, t) {
    const n = 28; c.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = i / n * Math.PI * 2, w = 1 + .13 * Math.sin(a * 3 + t * 3.2 + b.seed) + .07 * Math.sin(a * 7 - t * 4.1 + b.seed * 2);
      const px = b.x + Math.cos(a) * r * w, py = b.y + Math.sin(a) * r * w;
      i ? c.lineTo(px, py) : c.moveTo(px, py);
    }
    c.closePath(); c.fill();
  }
  let T = 0, cover = 0;
  function frame(now) {
    const dt = Math.min(.05, (now - (morph.last || now)) / 1000); morph.last = now; T += dt;
    if (hovering && !RM) addPoint(ptr.x + Math.sin(T * 2.3) * 2, ptr.y + Math.cos(T * 1.9) * 2); // the brush keeps breathing while the cursor rests
    full += (fullTarget - full) * Math.min(1, dt * (fullTarget ? 1.6 : 2.4));
    // mask
    const c = mx; c.setTransform(D, 0, 0, D, 0, 0); c.clearRect(0, 0, W, H); c.fillStyle = '#ffffff';
    let area = 0;
    for (let i = trail.length - 1; i >= 0; i--) {
      const b = trail[i]; b.t += dt; if (b.t > LIFE) { trail.splice(i, 1); continue; }
      const k = b.t / LIFE, grow = 1 - Math.pow(1 - Math.min(1, b.t / .22), 3), r = b.r * grow * (1 - k * k);
      blob(c, b, r, T); area += Math.PI * r * r;
      const nb = trail[i - 1]; // bridge to the previous blob so the stroke reads as one liquid line
      if (nb && Math.hypot(nb.x - b.x, nb.y - b.y) < b.r * 1.6) { c.lineWidth = r * 1.5; c.lineCap = 'round'; c.strokeStyle = '#ffffff'; c.beginPath(); c.moveTo(nb.x, nb.y); c.lineTo(b.x, b.y); c.stroke(); }
    }
    if (full > .002) { const R = Math.hypot(W, H) * 1.1 * (1 - Math.pow(1 - full, 3)); blob(c, { x: fullOrigin.x, y: fullOrigin.y, seed: 1 }, R, T); area += Math.PI * R * R; }
    if (W && H) cover += (Math.min(1, area / (W * H * .9)) - cover) * .1;
    morph.e = Math.max(full, Math.min(.55, cover * 1.3));
    // compose: Aku inside the mask, Jack outside it with a burning edge
    const o = cx; o.setTransform(1, 0, 0, 1, 0, 0); o.clearRect(0, 0, cv.width, cv.height);
    if (loaded < 2) { requestAnimationFrame(frame); return; }
    lx.setTransform(1, 0, 0, 1, 0, 0); lx.globalCompositeOperation = 'source-over'; lx.clearRect(0, 0, layer.width, layer.height);
    lx.drawImage(akuC, 0, 0); lx.globalCompositeOperation = 'destination-in'; lx.drawImage(maskC, 0, 0);
    o.save(); o.shadowColor = 'rgba(255,150,139,.55)'; o.shadowBlur = 26 * D; o.drawImage(layer, 0, 0); o.restore();
    lx.globalCompositeOperation = 'source-over'; lx.clearRect(0, 0, layer.width, layer.height);
    lx.drawImage(jackC, 0, 0);
    // burning rim: a dilated copy of the mask, kept only on Jack's own pixels
    lx.globalCompositeOperation = 'source-atop'; lx.save(); lx.shadowColor = '#ff3b30'; lx.shadowBlur = 18 * D; lx.globalAlpha = .95;
    for (const [dx, dy] of [[0, 0], [5, 0], [-5, 0], [0, 5], [0, -5]]) lx.drawImage(maskC, dx * D, dy * D);
    lx.restore();
    lx.globalCompositeOperation = 'destination-out'; lx.drawImage(maskC, 0, 0);
    o.drawImage(layer, 0, 0);
    // embers
    o.setTransform(D, 0, 0, D, 0, 0);
    for (let i = embers.length - 1; i >= 0; i--) { const p = embers[i]; p.x += p.vx; p.y += p.vy; p.vy -= .02; p.life -= dt * 1.2; if (p.life <= 0) { embers.splice(i, 1); continue; } o.globalAlpha = p.life; o.fillStyle = p.c; o.beginPath(); o.arc(p.x, p.y, p.r, 0, 7); o.fill(); }
    o.globalAlpha = 1;
    // name label switches outright (no crossfade) while any of Aku is burned through
    const showAku = trail.length > 0;
    if (showAku !== plabel._aku) { plabel._aku = showAku; plabel.classList.toggle('aku-on', showAku); }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();

/* ============ HERO CANVAS ============ */
const hero = $('#top'), hc = $('#heroCanvas'), hx = hc.getContext('2d');
const buf = document.createElement('canvas'), bx = buf.getContext('2d');
let HW = 0, HH = 0, DPR = 1;
let px = 0, py = 0, tpx = 0, tpy = 0;
const petals = [];
let slash = null; // {x1,y1,x2,y2,t}
function sizeHero() {
  DPR = Math.min(devicePixelRatio || 1, 2);
  HW = hero.clientWidth; HH = hero.clientHeight; placeSun();
  for (const c of [hc, buf]) { c.width = Math.round(HW * DPR); c.height = Math.round(HH * DPR); }
  petals.length = 0;
  const n = Math.round(clamp(HW / 22, 18, 60));
  for (let i = 0; i < n; i++) petals.push(newPetal(true));
}
function newPetal(any) {
  return { x: any ? rand(-50, HW) : rand(-80, -10), y: rand(-20, HH * .85), r: rand(2.5, 5.5), vx: rand(.6, 1.8), vy: rand(.15, .6), a: rand(0, 6.28), va: rand(-.05, .05), c: Math.random() < .55 ? '#f5f3f0' : '#e0241b', z: rand(.5, 1.3) };
}
function ridge(ctx, w, h, base, amp, seed, color, shift) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(-40 + shift, h);
  for (let x = -40; x <= w + 40; x += 24) {
    const u = (x + seed * 97) / w;
    const y = base - amp * (0.55 * Math.sin(u * 6.1 + seed) + 0.3 * Math.sin(u * 13.7 + seed * 2.3) + 0.15 * Math.sin(u * 29 + seed));
    ctx.lineTo(x + shift, y);
  }
  ctx.lineTo(w + 40 + shift, h); ctx.closePath(); ctx.fill();
}
function drawJack(ctx, x, y, s, t, flip) {
  ctx.save(); ctx.translate(x, y); ctx.scale(flip ? -s : s, s);
  const w = Math.sin(t * 2.2) * 4, w2 = Math.sin(t * 2.2 + 1) * 5;
  ctx.fillStyle = '#0b0b0b';
  // hakama
  ctx.beginPath(); ctx.moveTo(-11, -58); ctx.lineTo(11, -58); ctx.lineTo(20 + w * .3, 0); ctx.lineTo(4, 0); ctx.lineTo(0, -20); ctx.lineTo(-4, 0); ctx.lineTo(-19, 0); ctx.closePath(); ctx.fill();
  // robe tail in wind
  ctx.beginPath(); ctx.moveTo(10, -88); ctx.quadraticCurveTo(26 + w, -70, 34 + w2, -52); ctx.lineTo(14, -56); ctx.closePath(); ctx.fill();
  // torso
  ctx.beginPath(); ctx.moveTo(-14, -92); ctx.lineTo(14, -92); ctx.lineTo(11, -56); ctx.lineTo(-11, -56); ctx.closePath(); ctx.fill();
  // sleeves
  ctx.beginPath(); ctx.moveTo(-14, -92); ctx.lineTo(-22, -64); ctx.lineTo(-12, -62); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(14, -92); ctx.lineTo(24 + w * .4, -66); ctx.lineTo(13, -63); ctx.closePath(); ctx.fill();
  // neck/head/topknot
  ctx.fillRect(-3.5, -100, 7, 10);
  ctx.beginPath(); ctx.arc(0, -107, 9.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(1, -120, 4.5, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-1, -123); ctx.quadraticCurveTo(10 + w, -128, 16 + w2, -122); ctx.lineTo(2, -119); ctx.closePath(); ctx.fill();
  // sword at hip
  ctx.save(); ctx.translate(-6, -60); ctx.rotate(-0.42);
  ctx.fillRect(-40, -2.2, 52, 4.4); ctx.fillRect(12, -3.6, 3, 7.2); ctx.fillRect(15, -1.8, 13, 3.6);
  ctx.restore();
  ctx.restore();
}
const SKY_DAY = ['#0a0a0a', '#120707', '#1d0908', '#2c0b09', '#3f0d0b', '#57100d', '#73130f'];
const SKY_AKU = ['#030303', '#050505', '#080707', '#0c0909', '#120b0a', '#190c0b', '#220d0b'];
const RIDGE_DAY = ['#2a2a2a', '#1a1a1a', '#0e0e0e'], RIDGE_AKU = ['#141414', '#0d0d0d', '#070707'];
function hex2rgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
function mix(a, b, t) { const A = hex2rgb(a), B = hex2rgb(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`; }
let sunC = { x: 0, y: 0, r: 100 };
function placeSun() {
  const f = morph.face ? morph.face() : null, hr = hero.getBoundingClientRect();
  if (f) sunC = { x: f.x - hr.left, y: f.y - hr.top + f.r * .7, r: f.r };
}
function paintHero(t) {
  const W = HW, H = HH, c = bx, E = morph.e;
  c.setTransform(DPR, 0, 0, DPR, 0, 0);
  const bh = H * 0.66 / SKY_DAY.length;
  SKY_DAY.forEach((col, i) => { c.fillStyle = mix(col, SKY_AKU[i], E); c.fillRect(0, i * bh + py * (i * .6), W, bh + 2 + Math.abs(py) * 6); });
  c.fillStyle = mix(SKY_DAY[6], SKY_AKU[6], E); c.fillRect(0, H * .66 - 2, W, H);
  // sun, eclipsed by Aku's moon as the morph progresses
  const sx = sunC.x, sy = sunC.y, sr = sunC.r;
  if (E > .02) { const g = c.createRadialGradient(sx, sy, sr, sx, sy, sr * 1.7); g.addColorStop(0, `rgba(255,150,139,${.45 * E})`); g.addColorStop(1, 'rgba(255,150,139,0)'); c.fillStyle = g; c.beginPath(); c.arc(sx, sy, sr * 1.7, 0, 7); c.fill(); }
  c.fillStyle = mix('#e0241b', '#ff3b30', E); c.beginPath(); c.arc(sx, sy, sr, 0, Math.PI * 2); c.fill();
  c.save(); c.beginPath(); c.arc(sx, sy, sr, 0, 7); c.clip();
  c.fillStyle = mix('#73130f', '#220d0b', E);
  for (let i = 0; i < 5; i++) { const yy = sy + sr * .15 + i * sr * .17; c.fillRect(sx - sr, yy, sr * 2, 3 + i * 2.2); }
  const mx = sx + (1 - E) * sr * 2.3, my = sy - (1 - E) * sr * .5;
  c.fillStyle = '#060606'; c.beginPath(); c.arc(mx, my, sr * .985, 0, 7); c.fill();
  c.restore();
  // distant birds (they flee the eclipse)
  c.strokeStyle = mix('#262626', '#101010', E); c.lineWidth = 1.6;
  for (let i = 0; i < 4; i++) {
    const bxp = ((t * (18 + E * 60) + i * 140) % (W + 200)) - 100, byp = H * .22 + i * 18 + Math.sin(t + i) * 6;
    const f = Math.sin(t * 6 + i) * 4;
    c.beginPath(); c.moveTo(bxp - 7, byp - f); c.quadraticCurveTo(bxp - 3, byp - 3, bxp, byp); c.quadraticCurveTo(bxp + 3, byp - 3, bxp + 7, byp - f); c.stroke();
  }
  ridge(c, W, H, H * .7, H * .09, 1.3, mix(RIDGE_DAY[0], RIDGE_AKU[0], E), px * -14);
  ridge(c, W, H, H * .78, H * .1, 4.1, mix(RIDGE_DAY[1], RIDGE_AKU[1], E), px * -26);
  ridge(c, W, H, H * .87, H * .07, 7.7, mix(RIDGE_DAY[2], RIDGE_AKU[2], E), px * -42);
  // foreground grass band
  c.fillStyle = '#080808';
  c.beginPath(); c.moveTo(0, H);
  for (let x = 0; x <= W + 10; x += 9) { const h = 10 + ((x * 7) % 20); c.lineTo(x + px * -90 + Math.sin(t * 2 + x * .03) * 4, H - h); c.lineTo(x + 4 + px * -90, H - 2); }
  c.lineTo(W + 10, H); c.closePath(); c.fill();
  // petals turn to embers under Aku
  for (const p of petals) {
    c.save(); c.translate(p.x + px * -30 * p.z, p.y); c.rotate(p.a); c.fillStyle = E > .5 ? (p.c === '#f5f3f0' ? '#ff3b30' : '#5a0d0a') : p.c; c.globalAlpha = .9;
    c.beginPath(); c.ellipse(0, 0, p.r * p.z, p.r * .45 * p.z * (1 - E * .4), 0, 0, Math.PI * 2); c.fill(); c.restore();
  }
}
function stepPetals() {
  for (let i = 0; i < petals.length; i++) {
    const p = petals[i];
    p.x += p.vx * p.z * 1.4; p.y += p.vy + Math.sin(p.a) * .3; p.a += p.va;
    if (p.x > HW + 30 || p.y > HH + 10) petals[i] = newPetal(false);
  }
}
let heroT = 0, heroVisible = true, lastHero = 0;
function heroFrame(now) {
  const dt = Math.min(50, now - (lastHero || now)); lastHero = now;
  if (heroVisible) {
    heroT += dt / 1000;
    px += (tpx - px) * .06; py += (tpy - py) * .06;
    stepPetals();
    paintHero(heroT);
    compose(now);
  }
  requestAnimationFrame(heroFrame);
}
function compose(now) {
  const W = hc.width, H = hc.height;
  if (!buf.width || !buf.height) return; // hero not laid out yet (hidden tab, zero-size pane)
  hx.setTransform(1, 0, 0, 1, 0, 0);
  if (!slash) { hx.drawImage(buf, 0, 0); return; }
  const e = (now - slash.t) / 1000;
  const { x1, y1, x2, y2 } = slash;
  // line in device px
  const ax = x1 * DPR, ay = y1 * DPR, bxp = x2 * DPR, byp = y2 * DPR;
  const dx = bxp - ax, dy = byp - ay, L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;
  // split offset: rises fast then eases back
  const off = e < .12 ? 0 : (e < .5 ? Math.sin((e - .12) / .38 * Math.PI / 2) * 14 : 14 * Math.max(0, 1 - (e - .5) / .7)) * DPR;
  const far = (W + H) * 2;
  const half = (side) => {
    hx.save(); hx.beginPath();
    hx.moveTo(ax - dx / L * far, ay - dy / L * far); hx.lineTo(ax + dx / L * far, ay + dy / L * far);
    hx.lineTo(ax + dx / L * far + nx * far * side, ay + dy / L * far + ny * far * side);
    hx.lineTo(ax - dx / L * far + nx * far * side, ay - dy / L * far + ny * far * side);
    hx.closePath(); hx.clip();
    hx.drawImage(buf, nx * off * side * .5 + dx / L * off * side, ny * off * side * .5 + dy / L * off * side);
    hx.restore();
  };
  hx.fillStyle = '#0e0e0e'; hx.fillRect(0, 0, W, H);
  half(1); half(-1);
  // blade light
  const draw = clamp(e / .12, 0, 1), fade = clamp(1 - (e - .15) / .5, 0, 1);
  if (fade > 0) {
    hx.strokeStyle = `rgba(255,255,255,${fade})`; hx.lineWidth = 3 * DPR; hx.lineCap = 'round';
    hx.shadowColor = 'rgba(252,252,252,.9)'; hx.shadowBlur = 18 * DPR;
    hx.beginPath(); hx.moveTo(ax, ay); hx.lineTo(ax + dx * draw, ay + dy * draw); hx.stroke(); hx.shadowBlur = 0;
  }
  if (e < .08) { hx.fillStyle = `rgba(255,255,255,${.35 * (1 - e / .08)})`; hx.fillRect(0, 0, W, H); }
  if (e > 1.3) slash = null;
}
function doSlash(x, y) {
  const ang = rand(-0.55, 0.55) + (Math.random() < .5 ? 0 : Math.PI);
  const len = Math.max(HW, HH) * .8;
  slash = { x1: x - Math.cos(ang) * len / 2, y1: y - Math.sin(ang) * len / 2, x2: x + Math.cos(ang) * len / 2, y2: y + Math.sin(ang) * len / 2, t: performance.now() };
  $$('.letterbox').forEach(l => { l.style.height = '13%'; setTimeout(() => l.style.height = '', 700); });
  sfx.slash();
}
hero.addEventListener('pointermove', e => { const r = hero.getBoundingClientRect(); tpx = (e.clientX - r.left) / r.width - .5; tpy = (e.clientY - r.top) / r.height - .5; });
hero.addEventListener('pointerleave', () => { tpx = 0; tpy = 0; });
hero.addEventListener('click', e => { if (RM) return; const r = hero.getBoundingClientRect(); doSlash(e.clientX - r.left, e.clientY - r.top); });
sizeHero(); paintHero(0); compose(0);
addEventListener('resize', () => { sizeHero(); if (RM) { paintHero(0); compose(0); } });
if ('IntersectionObserver' in window) new IntersectionObserver(es => { heroVisible = es[0].isIntersecting; }).observe(hero);
if (!RM) requestAnimationFrame(heroFrame);

/* ---------- tiny synth for sound effects (only after user interaction) ---------- */
const sfx = (() => {
  let ac = null;
  const ctx = () => { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) {} } return ac; };
  function noise(dur, f0, f1, vol) {
    const a = ctx(); if (!a) return;
    const n = a.createBufferSource(), b = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    n.buffer = b;
    const f = a.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.4;
    f.frequency.setValueAtTime(f0, a.currentTime); f.frequency.exponentialRampToValueAtTime(f1, a.currentTime + dur);
    const g = a.createGain(); g.gain.setValueAtTime(vol, a.currentTime); g.gain.exponentialRampToValueAtTime(.001, a.currentTime + dur);
    n.connect(f); f.connect(g); g.connect(a.destination); n.start();
  }
  function tone(freq, dur, type, vol) {
    const a = ctx(); if (!a) return;
    const o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.setValueAtTime(freq, a.currentTime);
    g.gain.setValueAtTime(vol, a.currentTime); g.gain.exponentialRampToValueAtTime(.001, a.currentTime + dur);
    o.connect(g); g.connect(a.destination); o.start(); o.stop(a.currentTime + dur);
  }
  return {
    slash() { noise(.22, 6000, 900, .25); },
    clank() { tone(880, .12, 'square', .05); noise(.08, 3000, 2000, .1); },
    boom() { tone(90, .4, 'sawtooth', .12); noise(.35, 600, 80, .3); },
    laugh() { [0, .22, .44].forEach((d, i) => setTimeout(() => tone(150 - i * 18, .2, 'sawtooth', .07), d * 1000)); }
  };
})();

/* ============ TIMELINE ============ */
const ERAS = [
  { when: 'Before history', t: 'The birth of evil', bg: '#1b1b1b', scene: 'void',
    b: 'A great mass of darkness drifts through space. The gods Odin, Ra and Vishnu defeat it, but one fragment falls to Earth and grows in the dark into Aku. A good Emperor, guided by those same gods, receives a sword forged from his own righteousness and seals Aku away.',
    s: 'Seen in: “The Birth of Evil,” parts 1 and 2 (Season 3)' },
  { when: 'The prince’s childhood', t: 'The eclipse', bg: '#202020', scene: 'eclipse',
    b: 'During a solar eclipse Aku breaks free, burns the kingdom and takes the Emperor prisoner. The Empress sends their young son away, so that one day he can return with his father’s sword.',
    s: 'Seen in: Episode I, “The Beginning”' },
  { when: 'The training years', t: 'The world as a dojo', bg: '#404040', scene: 'train',
    b: 'The boy travels for years, learning from masters across Africa, Europe, the Middle East and Asia. He trains as an archer with Robin Hood’s band in Sherwood. Body, mind and spirit are all part of the lesson.',
    s: 'Seen in: Episode I, and in flashbacks throughout' },
  { when: 'The homecoming', t: 'The prince returns', bg: '#2f2f2f', scene: 'duel',
    b: 'Now a grown warrior, he reclaims the sword and cuts through Aku’s forces. The blade is the one thing Aku cannot withstand, and for a moment it looks as if the story will end here.',
    s: 'Seen in: Episode I, “The Beginning”' },
  { when: 'One instant', t: 'Thrown through time', bg: '#282828', scene: 'portal', rift: true,
    b: 'Before the final strike, Aku tears open a portal in time and hurls the samurai into the distant future, where Aku’s rule is complete.',
    s: 'Seen in: Episode I, “The Beginning”' },
  { when: 'The far future', t: 'A samurai called Jack', bg: '#323232', scene: 'city',
    b: 'He lands in a neon city of aliens, robots and bounty hunters. A group of young people greets him as “Jack,” and the name sticks. From then on he hunts for any way back to the past: time portals, wishing wells, wizards, and anyone who might help.',
    s: 'Seen in: Episode II, “The Samurai Called Jack,” onward' },
  { when: 'Fifty years later', t: 'The samurai without a sword', bg: '#2b2b2b', scene: 'lost',
    b: 'Time does not age Jack. Fifty years on he still looks young, but he has lost his sword, Aku has destroyed every time portal, and a silent rider called the Omen follows him. He rides alone in armor, fighting with guns and blades that are not his own.',
    s: 'Seen in: Episode XCII (Season 5 premiere)' },
  { when: 'Fifty years later', t: 'The Daughters of Aku', bg: '#252525', scene: 'daughters',
    b: 'A cult that worships Aku has trained seven sisters since birth for one purpose: to kill Samurai Jack. One of them, Ashi, survives her first fight with him. Traveling with him, she learns the world is not what she was told.',
    s: 'Seen in: Season 5' },
  { when: 'Fifty years later', t: 'The sword returns', bg: '#3b3b3b', scene: 'sword',
    b: 'Jack confronts his own guilt and despair, and meditates until he is ready. His father and the gods return the sword to him. Jack and Ashi rally old allies, including an aging Scotsman and his daughters, for one last war.',
    s: 'Seen in: Season 5' },
  { when: 'Back to the past', t: 'The ending', bg: '#313131', scene: 'end',
    b: 'Ashi, who carries Aku’s power, opens a portal and brings Jack home to the moment he left. Aku is destroyed. Because the dark future never happens, Ashi fades away during their wedding. In the last scene Jack sits in a forest, and a ladybug lands on his finger.',
    s: 'Seen in: Episode CI, the series finale (May 2017)' }
];
const track = $('#track'), eraCanvas = $('#eraCanvas'), ex = eraCanvas.getContext('2d');
let eraI = 0, eraT0 = performance.now();
ERAS.forEach((e, i) => {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'node'; b.role = 'tab'; b.id = 'era-' + i; b.setAttribute('aria-controls', 'eraPanel');
  b.innerHTML = `<i></i><small>${String(i + 1).padStart(2, '0')}</small><span>${e.t}</span>`;
  b.addEventListener('click', () => setEra(i));
  track.appendChild(b);
});
// rift marker between portal (4) and city (5)
const rift = document.createElement('div'); rift.className = 'rift'; rift.innerHTML = '<span>TIME PORTAL</span>'; track.appendChild(rift);
function placeRift() { const n = track.children[5]; if (n) rift.style.left = (n.offsetLeft - 8) + 'px'; }
function setEra(i, focus) {
  const prev = eraI; eraI = (i + ERAS.length) % ERAS.length; const e = ERAS[eraI];
  $$('.node', track).forEach((n, k) => { n.classList.toggle('on', k === eraI); n.setAttribute('aria-selected', k === eraI); n.tabIndex = k === eraI ? 0 : -1; });
  $('#eraWhen').textContent = e.when; $('#eraTitle').textContent = e.t; $('#eraBody').textContent = e.b; $('#eraSeen').textContent = e.s;
  $('#timeline').style.setProperty('--era-bg', e.bg);
  if ((prev <= 4) !== (eraI <= 4) && !RM) { const c = $('#eraCard'); c.classList.remove('glitch'); void c.offsetWidth; c.classList.add('glitch'); }
  eraT0 = performance.now();
  if (focus) track.children[eraI].focus();
  const sc = track.parentElement, nd = track.children[eraI];
  if (nd.offsetLeft < sc.scrollLeft || nd.offsetLeft + nd.offsetWidth > sc.scrollLeft + sc.clientWidth) sc.scrollTo({ left: nd.offsetLeft - 16, behavior: RM ? 'auto' : 'smooth' });
  renderSlots();
  drawEra(performance.now());
}
track.addEventListener('keydown', ev => {
  if (ev.key === 'ArrowRight') { ev.preventDefault(); setEra(eraI + 1, true); }
  if (ev.key === 'ArrowLeft') { ev.preventDefault(); setEra(eraI - 1, true); }
});
$('#eraPrev').onclick = () => setEra(eraI - 1);
$('#eraNext').onclick = () => setEra(eraI + 1);

function sizeEra() { const r = eraCanvas.getBoundingClientRect(); const d = Math.min(devicePixelRatio || 1, 2); eraCanvas.width = Math.max(1, Math.round(r.width * d)); eraCanvas.height = Math.max(1, Math.round(r.height * d)); }
function drawEra(now) {
  const W = eraCanvas.width, H = eraCanvas.height, c = ex, t = (now - eraT0) / 1000, T = now / 1000;
  const e = ERAS[eraI]; const k = Math.min(1, t / .6); const ease = 1 - Math.pow(1 - k, 3);
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, W, H);
  const s = W / 640;
  c.save(); c.scale(s, s); const w = 640, h = H / s;
  const ground = (col, y) => { c.fillStyle = col; c.fillRect(0, y, w, h - y); };
  switch (e.scene) {
    case 'void': {
      c.fillStyle = '#0c0c0c'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 70; i++) { c.fillStyle = `rgba(241,241,241,${.3 + .5 * Math.abs(Math.sin(T + i))})`; c.fillRect((i * 97) % w, (i * 53) % h, 2, 2); }
      const r = 90 * ease; c.fillStyle = '#000000'; c.beginPath();
      for (let a = 0; a <= 6.3; a += .2) { const rr = r + Math.sin(a * 5 + T * 2) * 10; c.lineTo(320 + Math.cos(a) * rr, 170 + Math.sin(a) * rr); } c.fill();
      c.fillStyle = '#ff3b30'; c.globalAlpha = ease; c.beginPath(); c.ellipse(292, 165, 12, 6, .2, 0, 7); c.ellipse(348, 165, 12, 6, -.2, 0, 7); c.fill(); c.globalAlpha = 1;
      const fx = 320 + 240 * ease, fy = 170 + 160 * ease; c.fillStyle = '#000000'; c.beginPath(); c.arc(fx, fy, 10, 0, 7); c.fill();
      break; }
    case 'eclipse': {
      c.fillStyle = '#2c2c2c'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#ff3b30'; c.beginPath(); c.arc(320, 150, 90, 0, 7); c.fill();
      c.fillStyle = '#0e0e0e'; c.beginPath(); c.arc(320 + 140 * (1 - ease), 150, 88, 0, 7); c.fill();
      c.fillStyle = '#151515'; c.beginPath(); c.moveTo(0, h); c.lineTo(0, 300); c.lineTo(160, 300); c.lineTo(180, 270); c.lineTo(250, 270); c.lineTo(260, 240); c.lineTo(380, 240); c.lineTo(390, 270); c.lineTo(460, 270); c.lineTo(480, 300); c.lineTo(w, 300); c.lineTo(w, h); c.fill();
      for (let i = 0; i < 9; i++) { const fx = 150 + i * 42, fh = 24 + Math.sin(T * 9 + i * 2) * 10; c.fillStyle = i % 2 ? '#ff3b30' : '#e0241b'; c.beginPath(); c.moveTo(fx - 12, 300); c.quadraticCurveTo(fx, 300 - fh * 2, fx + 12, 300); c.fill(); }
      break; }
    case 'train': {
      c.fillStyle = '#5d5d5d'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#ff3b30'; c.beginPath(); c.arc(520, 90, 40, 0, 7); c.fill();
      ground('#404040', 300);
      // target and arrow
      c.fillStyle = '#f1f1f1'; c.beginPath(); c.arc(540, 250, 34, 0, 7); c.fill();
      c.fillStyle = '#b61610'; c.beginPath(); c.arc(540, 250, 22, 0, 7); c.fill();
      c.fillStyle = '#f1f1f1'; c.beginPath(); c.arc(540, 250, 9, 0, 7); c.fill();
      const ax = 170 + 360 * ((t * .9) % 1.2 > 1 ? 1 : (t * .9) % 1.2);
      c.fillStyle = '#0e0e0e'; c.fillRect(Math.min(ax, 530) - 60, 248, 60, 3);
      c.beginPath(); c.moveTo(Math.min(ax, 530) + 8, 249.5); c.lineTo(Math.min(ax, 530), 244); c.lineTo(Math.min(ax, 530), 255); c.fill();
      drawJack(c, 120, 300, 1.2, T, false);
      break; }
    case 'duel': {
      c.fillStyle = '#ad130e'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#e0241b'; c.fillRect(0, 0, w * ease * .5, h); c.fillStyle = '#0e0e0e'; c.fillRect(w - w * ease * .5, 0, w * .5, h);
      c.fillStyle = '#f1f1f1'; c.fillRect(318, 0, 4, h);
      drawJack(c, 170, 330, 1.6, T, false);
      c.fillStyle = '#ff3b30'; c.beginPath(); c.ellipse(450, 170, 22, 9, .25, 0, 7); c.ellipse(530, 170, 22, 9, -.25, 0, 7); c.fill();
      c.fillStyle = '#ff3b30'; c.beginPath(); c.moveTo(420, 150); c.quadraticCurveTo(450, 100, 475, 152); c.fill(); c.beginPath(); c.moveTo(505, 152); c.quadraticCurveTo(530, 100, 560, 150); c.fill();
      break; }
    case 'portal': {
      c.fillStyle = '#171717'; c.fillRect(0, 0, w, h);
      for (let i = 6; i > 0; i--) { c.strokeStyle = `rgba(255,150,139,${.12 * i})`; c.lineWidth = 3; c.beginPath(); c.ellipse(320, 180, Math.max(0, (30 + i * 22) * ease + Math.sin(T * 3 + i) * 4), (60 + i * 24) * ease, T * .4 * (i % 2 ? 1 : -1), 0, 7); c.stroke(); }
      c.save(); c.translate(320, 180); c.rotate(T * 1.5); const sc = Math.max(.15, 1 - (t % 3) / 3); c.scale(sc, sc); drawJack(c, 0, 60, 1, T, false); c.restore();
      break; }
    case 'city': {
      c.fillStyle = '#323232'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 14; i++) { const bx = i * 48 - 10, bh = 120 + ((i * 71) % 160); c.fillStyle = i % 2 ? '#212121' : '#1b1b1b'; c.fillRect(bx, h - bh * ease, 44, bh);
        for (let j = 0; j < 6; j++) { if ((i + j + Math.floor(T * 2)) % 3 === 0) { c.fillStyle = j % 2 ? '#ff3b30' : '#ff3b30'; c.fillRect(bx + 8 + (j % 2) * 18, h - bh * ease + 14 + j * 18, 8, 6); } } }
      for (let i = 0; i < 3; i++) { const x = (T * 70 + i * 230) % 760 - 60, y = 60 + i * 30; c.fillStyle = '#b61610'; c.beginPath(); c.ellipse(x, y, 22, 6, 0, 0, 7); c.fill(); }
      drawJack(c, 320, h - 10, 1.3, T, false);
      break; }
    case 'lost': {
      c.fillStyle = '#4a4a4a'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 90; i++) { const x = (i * 83 + T * 160) % w, y = (i * 47 + T * 300) % h; c.fillStyle = 'rgba(201,201,201,.55)'; c.fillRect(x, y, 1.5, 10); }
      ground('#262626', 300);
      // the Omen: tall figure on horse, far right
      c.fillStyle = '#0b0b0b'; c.globalAlpha = .4 + .4 * Math.abs(Math.sin(T * .7));
      c.fillRect(500, 200, 60, 40); c.fillRect(505, 240, 6, 60); c.fillRect(548, 240, 6, 60); c.fillRect(518, 130, 22, 72); c.beginPath(); c.moveTo(529, 106); c.lineTo(518, 132); c.lineTo(540, 132); c.fill(); c.globalAlpha = 1;
      drawJack(c, 160, 300, 1.3, T * .4, false);
      break; }
    case 'daughters': {
      c.fillStyle = '#252525'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#f1f1f1'; c.beginPath(); c.arc(500, 80, 36, 0, 7); c.fill(); c.fillStyle = '#252525'; c.beginPath(); c.arc(486, 72, 34, 0, 7); c.fill();
      ground('#121212', 310);
      for (let i = 0; i < 7; i++) { const x = 70 + i * 74, y = 310, up = Math.min(1, Math.max(0, (t - i * .08) * 2.5));
        c.fillStyle = '#080808'; c.beginPath(); c.moveTo(x - 10, y); c.lineTo(x - 6, y - 70 * up); c.lineTo(x + 6, y - 70 * up); c.lineTo(x + 10, y); c.fill();
        c.beginPath(); c.arc(x, y - 78 * up, 8 * up, 0, 7); c.fill(); }
      break; }
    case 'sword': {
      c.fillStyle = '#3b3b3b'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 12; i++) { c.fillStyle = `rgba(255,122,110,${.08 + .06 * Math.sin(T * 2 + i)})`; c.beginPath(); c.moveTo(320, 160); c.arc(320, 160, 400, i * .52 + T * .1, i * .52 + .22 + T * .1); c.fill(); }
      c.save(); c.translate(320, 60 + 100 * ease); c.rotate(Math.PI / 2);
      c.fillStyle = '#f1f1f1'; c.fillRect(-10, -4, 150, 8); c.fillStyle = '#0e0e0e'; c.fillRect(-14, -12, 6, 24); c.fillRect(-50, -5, 36, 10); c.restore();
      ground('#212121', 330);
      break; }
    case 'end': {
      c.fillStyle = '#4f4f4f'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#373737' : '#404040'; c.fillRect(i * 84 + 10, 0, 26, h); }
      ground('#2a2a2a', 320);
      drawJack(c, 300, 320, 1.4, T * .2, false);
      const lx = 260 + Math.cos(T) * 40 * (1 - ease) + 40 * ease, ly = 200 + Math.sin(T * 2) * 30 * (1 - ease) + 60 * ease;
      c.fillStyle = '#bf1912'; c.beginPath(); c.arc(lx, ly, 6, 0, 7); c.fill(); c.fillStyle = '#0e0e0e'; c.fillRect(lx - .6, ly - 6, 1.2, 12); c.beginPath(); c.arc(lx - 2, ly - 1, 1.3, 0, 7); c.arc(lx + 2, ly + 2, 1.3, 0, 7); c.fill();
      break; }
  }
  c.restore();
}
function eraLoop(now) { drawEra(now); requestAnimationFrame(eraLoop); }
sizeEra(); placeRift(); setEra(0);
addEventListener('resize', () => { sizeEra(); placeRift(); drawEra(performance.now()); });
if (!RM) requestAnimationFrame(eraLoop);

/* ============ CAST ============ */
const EMB = {
  jack: '<svg viewBox="0 0 64 64"><rect x="6" y="30" width="44" height="4" fill="#f1f1f1" transform="rotate(-35 32 32)"/><rect x="44" y="22" width="12" height="5" fill="#b61610" transform="rotate(-35 32 32)"/><rect x="41" y="26" width="3" height="12" fill="#ff3b30" transform="rotate(-35 32 32)"/><circle cx="18" cy="16" r="6" fill="#e0241b"/></svg>',
  aku: '<svg viewBox="0 0 64 64"><path d="M32 10c14 0 20 12 18 24-2 14-9 22-18 22s-16-8-18-22C12 22 18 10 32 10z" fill="#0b0b0b"/><path d="M15 22c2-8 6-10 8-15 2 6 5 8 6 14z M49 22c-2-8-6-10-8-15-2 6-5 8-6 14z" fill="#ff3b30"/><path d="M17 31c5-5 11-5 13 0-5 3-9 3-13 0zM47 31c-5-5-11-5-13 0 5 3 9 3 13 0z" fill="#ff3b30"/></svg>',
  scotsman: '<svg viewBox="0 0 64 64"><rect x="8" y="8" width="48" height="48" fill="#b61610"/><g fill="#5d5d5d" opacity=".85"><rect x="8" y="20" width="48" height="6"/><rect x="8" y="38" width="48" height="6"/><rect x="20" y="8" width="6" height="48"/><rect x="38" y="8" width="6" height="48"/></g><g fill="#ff3b30"><rect x="8" y="30" width="48" height="2"/><rect x="30" y="8" width="2" height="48"/></g><rect x="29" y="14" width="6" height="40" fill="#f1f1f1"/><rect x="22" y="44" width="20" height="4" fill="#0e0e0e"/></svg>',
  ashi: '<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="22" fill="#0e0e0e"/><path d="M20 18 C 32 26, 32 38, 20 46 C 44 44, 44 20, 20 18 Z" fill="#f1f1f1"/><circle cx="40" cy="32" r="3" fill="#b61610"/></svg>',
  guardian: '<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="22" fill="none" stroke="#ff3b30" stroke-width="4"/><circle cx="32" cy="32" r="13" fill="none" stroke="#ff3b30" stroke-width="2" opacity=".6"/><rect x="29" y="4" width="6" height="56" fill="#ff3b30"/><rect x="24" y="4" width="16" height="6" fill="#ff3b30"/></svg>',
  emperor: '<svg viewBox="0 0 64 64"><path d="M12 46 L16 20 L26 32 L32 14 L38 32 L48 20 L52 46 Z" fill="#ff3b30"/><rect x="12" y="46" width="40" height="6" fill="#b61610"/><circle cx="32" cy="12" r="3" fill="#f1f1f1"/></svg>',
  scaramouche: '<svg viewBox="0 0 64 64"><rect x="20" y="8" width="24" height="24" fill="#0e0e0e"/><rect x="12" y="30" width="40" height="5" fill="#0e0e0e"/><rect x="20" y="24" width="24" height="4" fill="#b61610"/><circle cx="32" cy="46" r="10" fill="#bababa"/><g fill="#0e0e0e"><circle cx="28" cy="44" r="2"/><circle cx="36" cy="44" r="2"/></g><path d="M44 50 l8 -6 l-2 10 z" fill="#ff3b30"/></svg>',
  x9: '<svg viewBox="0 0 64 64"><rect x="14" y="14" width="36" height="30" rx="2" fill="#383838"/><rect x="18" y="24" width="28" height="7" fill="#b61610"/><rect x="22" y="44" width="20" height="10" fill="#383838"/><path d="M44 46 q8 -6 12 2 q-4 8 -12 2z" fill="#ff3b30"/><circle cx="52" cy="47" r="1.6" fill="#0e0e0e"/></svg>',
  omen: '<svg viewBox="0 0 64 64"><path d="M32 6 L22 26 L24 58 L40 58 L42 26 Z" fill="#0b0b0b"/><path d="M27 24 L32 14 L37 24 Z" fill="#bababa"/><rect x="28" y="28" width="8" height="2" fill="#ff3b30"/></svg>'
};
const CAST = [
  { id: 'jack', n: 'Samurai Jack', jp: 'サムライ・ジャック', side: 'ally', role: 'Prince, wanderer, the one Aku fears', voice: 'Phil LaMarr', first: 'Episode I, “The Beginning”',
    d: 'Son of the Emperor, raised by masters around the world, armed with a sword the gods forged from his father’s goodness. In the future he answers to the name strangers gave him. He is courteous and patient, and he will help anyone in trouble even when it costs him his only chance to go home.' },
  { id: 'aku', n: 'Aku', jp: '悪', side: 'foe', role: 'Shapeshifting master of darkness', voice: 'Mako (Seasons 1 to 4), Greg Baldwin (Season 5)', first: 'Episode I, “The Beginning”',
    d: 'A primordial evil that can become anything. He rules the future through fear, robots and the bounty hunters he pays to kill Jack. He is also petty, theatrical and a little lonely, which makes him one of animation’s best villains. The only thing he truly fears is the samurai’s sword.' },
  { id: 'scotsman', n: 'The Scotsman', jp: 'スコッツマン', side: 'ally', role: 'Loud, red-bearded, peg-legged, loyal', voice: 'John DiMaggio', first: 'Episode XI, “Jack and the Scotsman”',
    d: 'They first meet as rivals and spend the episode chained together, and they part as friends. He boasts, sings, swings a claymore and is devoted to his wife. Fifty years later he leads his many daughters into the war against Aku.' },
  { id: 'ashi', n: 'Ashi', jp: 'アシ', side: 'turned', role: 'Daughter of Aku, then Jack’s partner', voice: 'Tara Strong', first: 'Season 5',
    d: 'One of seven sisters raised by Aku’s cult to kill Jack. Once she sees the world Aku made, she changes sides, and her bond with Jack turns into love. Because she literally carries Aku’s essence, she can do what no one else can: open the way back to the past.' },
  { id: 'guardian', n: 'The Guardian', jp: '守護者', side: 'other', role: 'Keeper of the last time portal', voice: 'Kevin Michael Richardson', first: 'Episode XXXII, “Jack and the Traveling Creatures”',
    d: 'An unbeatable warrior who guards a time portal and waits for the one destined to pass through it. He defeats Jack and tells him he is not yet ready. In Season 5, Aku kills him and destroys the portal.' },
  { id: 'emperor', n: 'The Emperor', jp: '天皇', side: 'ally', role: 'Jack’s father', voice: null, first: 'Episode I, “The Beginning”',
    d: 'A just ruler who once sealed Aku away with the sword the gods forged from his virtue. Captured by Aku when the evil escapes, he gives his son the strength of his example. In Season 5 he and the gods help Jack take back the blade.' },
  { id: 'scaramouche', n: 'Scaramouche', jp: 'スカラムーシュ', side: 'foe', role: 'Robot assassin in a top hat', voice: 'Tom Kenny', first: 'Episode XCII (Season 5 premiere)',
    d: 'A jazz-scatting killing machine who turns his voice into a weapon and talks too much. He is smug, fast, stylish, and one of the first assassins Jack faces after fifty years.' },
  { id: 'x9', n: 'X-9', jp: 'X-9', side: 'foe', role: 'Robot assassin with a conscience', voice: null, first: 'Episode L, “Tale of X-9”',
    d: 'One of the robots Aku built to fight Jack. Unlike the others, he developed feelings. His episode is a noir story told from the robot’s side, about a machine who loved jazz and his dog, Lulu, and who wanted out.' },
  { id: 'omen', n: 'The Omen', jp: '前兆', side: 'other', role: 'Harbinger of death', voice: null, first: 'Season 5',
    d: 'A silent masked rider who appears whenever Jack’s despair is at its worst. He is part spirit and part threat, and he waits for the samurai to give up.' }
];
const roster = $('#roster'), dossier = $('#dossier');
const sideLabel = { ally: ['ally', 'Ally'], foe: ['foe', 'Foe'], turned: ['turned', 'Changed sides'], other: ['neutral', 'Neither'] };
const SLOT_IMG = (window.LOCAL_STILLS && window.LOCAL_STILLS.slots) || {};
CAST.forEach((p, i) => {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'who'; b.dataset.side = p.side; b.dataset.i = i;
  const pic = SLOT_IMG[p.id];
  if (pic) b.classList.add('has-img');
  b.innerHTML = (pic ? `<img class="who-img" src="${pic}" alt="" loading="lazy" draggable="false">` : '') + EMB[p.id] + `<span>${p.n}</span>`; b.setAttribute('aria-label', p.n);
  b.addEventListener('click', () => showWho(i)); roster.appendChild(b);
});
function showWho(i) {
  const p = CAST[i]; const [cls, lab] = sideLabel[p.side];
  $$('.who', roster).forEach(b => b.classList.toggle('on', +b.dataset.i === i));
  dossier.innerHTML = `<div class="big" aria-hidden="true">${EMB[p.id]}</div>
    <div class="slot" data-slot="${p.id}" data-name="${p.n}"></div>
    <div class="dossier-head"><span class="jp">${p.jp}</span><h3>${p.n}</h3><span class="pill ${cls}">${lab}</span></div>
    <p>${p.d}</p>
    <dl><dt>Role</dt><dd>${p.role}</dd>${p.voice ? `<dt>Voice</dt><dd>${p.voice}</dd>` : ''}<dt>First seen</dt><dd>${p.first}</dd></dl>`;
  renderSlots();
  if (!RM) { dossier.classList.remove('swap'); void dossier.offsetWidth; dossier.classList.add('swap'); }
}
$$('.chip').forEach(ch => ch.addEventListener('click', () => {
  $$('.chip').forEach(c => c.classList.toggle('on', c === ch));
  const f = ch.dataset.f;
  $$('.who', roster).forEach(b => { const s = b.dataset.side; b.hidden = !(f === 'all' || s === f || (f === 'ally' && s === 'turned') || (f === 'foe' && s === 'turned')); });
}));
showWho(0);

/* ============ AKU ============ */
const face = $('#akuFace'), figure = $('.aku-figure', face), haBox = $('#ha'), speech = $('#speech');
const LINES = [
  'You dare click upon the face of AKU? Bold. Foolish, but bold.',
  'Samurai! Even across fifty years, you are a pebble in my magnificent shoe.',
  'I could become anything. A dragon. A mountain. A very large bee. And yet I choose this face, for you.',
  'Behold my minions! They are… mostly on break.',
  'The past is closed to you, samurai. I have checked. Twice.',
  'Bring me the samurai and I shall reward you with riches! Moderate riches. Reasonable riches.'
];
let li = 0;
function speak(txt) { speech.innerHTML = txt + '<span class="note">Lines written for this page in Aku’s style, not quoted from the show.</span>'; }
// Aku is the site's own artwork (assets/img/aku.png); everything here is motion and light around it.
const akuLaugh = new Audio('assets/audio/aku-laugh.mp3'); akuLaugh.preload = 'auto'; akuLaugh.volume = .8;
// The laugh is performed by the whole face: each burst of sound throws his head back and stretches it,
// like a jaw dropping, then it snaps back. Loudness comes from the audio itself when the browser allows
// analysis; otherwise a steady HA-HA-HA rhythm stands in.
const laughFx = { ctx: null, an: null, buf: null, on: false, t0: 0, amp: 0, quiet: 0, live: false, lastPeak: 0, ha: 0, dur: 2.4 };
function hookAnalyser() {
  if (laughFx.ctx) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const ctx = new AC(), src = ctx.createMediaElementSource(akuLaugh), an = ctx.createAnalyser();
    an.fftSize = 1024; src.connect(an); an.connect(ctx.destination);
    laughFx.ctx = ctx; laughFx.an = an; laughFx.buf = new Uint8Array(an.fftSize);
  } catch (_) { laughFx.ctx = null; }
}
function haPop() {
  const words = ['HA', 'HA', 'HA!', 'HAHA', 'HA'], i = laughFx.ha++;
  const s = document.createElement('span'); s.textContent = words[i % words.length];
  s.style.left = (12 + (i * 23) % 64 + rand(-5, 5)) + '%'; s.style.top = (32 - (i % 3) * 8 + rand(-4, 4)) + '%';
  haBox.appendChild(s); setTimeout(() => s.remove(), 1300);
}
function laughLoop(now) {
  if (!laughFx.on) return;
  const el = (now - laughFx.t0) / 1000;
  let level = 0;
  if (laughFx.an && laughFx.live) {
    laughFx.an.getByteTimeDomainData(laughFx.buf);
    let sum = 0; for (let i = 0; i < laughFx.buf.length; i++) { const v = (laughFx.buf[i] - 128) / 128; sum += v * v; }
    const raw = Math.sqrt(sum / laughFx.buf.length);
    // a muted or blocked analyser reads silence; after a moment, switch to the rhythm instead
    if (raw < .003) { if (++laughFx.quiet > 18) laughFx.live = false; } else laughFx.quiet = 0;
    // normalise against the loudest moment so far, so a quiet recording still opens the jaw fully;
    // the floor is subtracted so the gaps between HAs fall back toward closed
    laughFx.peak = Math.max(laughFx.peak * .997, raw, .02);
    level = clamp((raw / laughFx.peak - .25) / .75, 0, 1);
  }
  if (!laughFx.live) { // HA-HA-HA at about four syllables a second, fading over the laugh
    const beat = (el * 4.2) % 1, fade = clamp(1 - el / laughFx.dur, 0, 1);
    level = Math.pow(Math.max(0, Math.sin(beat * Math.PI)), 3) * (.55 + .45 * fade) * (el < laughFx.dur ? 1 : 0);
  }
  // fast attack, slower release, so each HA snaps open and eases shut
  laughFx.amp += (level - laughFx.amp) * (level > laughFx.amp ? .6 : .18);
  face.style.setProperty('--amp', laughFx.amp.toFixed(3));
  // a HA pops each time the laugh swells back up after a dip
  if (laughFx.amp > .6 && laughFx.armed && now - laughFx.lastPeak > 200) { laughFx.lastPeak = now; laughFx.armed = false; haPop(); }
  if (laughFx.amp < .35) laughFx.armed = true;
  const done = laughFx.live ? (akuLaugh.ended || akuLaugh.paused) && laughFx.amp < .02 : el > laughFx.dur && laughFx.amp < .02;
  if (done || el > 12) { settle(); return; }
  requestAnimationFrame(laughLoop);
}
function laugh() {
  hookAnalyser();
  if (laughFx.ctx && laughFx.ctx.state === 'suspended') laughFx.ctx.resume();
  let playing = false;
  try { akuLaugh.currentTime = 0; const p = akuLaugh.play(); playing = true; if (p && p.catch) p.catch(() => { laughFx.live = false; sfx.laugh(); }); } catch (_) { sfx.laugh(); }
  if (isFinite(akuLaugh.duration) && akuLaugh.duration > 0) laughFx.dur = Math.min(8, akuLaugh.duration);
  speak(LINES[li++ % LINES.length]);
  face.classList.add('roused', 'laugh'); face.classList.remove('calmed');
  if (RM) { clearTimeout(laugh.t); laugh.t = setTimeout(settle, 1600); return; }
  Object.assign(laughFx, { live: playing && !!laughFx.an, quiet: 0, t0: performance.now(), lastPeak: 0, ha: 0, peak: .02, armed: true });
  if (!laughFx.on) { laughFx.on = true; requestAnimationFrame(laughLoop); }
}
function settle() { laughFx.on = false; laughFx.amp = 0; face.style.setProperty('--amp', 0); face.classList.remove('roused', 'laugh'); }
face.addEventListener('click', laugh);
face.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); laugh(); } });
$('#provoke').onclick = laugh;
$('#calm').onclick = () => { settle(); face.classList.add('calmed'); speak('Hmph. Wise. Leave AKU to his scheming.'); };
// he turns toward the cursor, and his glare brightens the closer it comes
if (!RM) addEventListener('pointermove', e => {
  const r = face.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return;
  const nx = clamp((e.clientX - (r.left + r.width / 2)) / (r.width * .8), -1, 1), ny = clamp((e.clientY - (r.top + r.height * .3)) / (r.height * .8), -1, 1);
  figure.style.setProperty('--ty', (nx * 14).toFixed(2) + 'deg'); figure.style.setProperty('--tx', (-ny * 8).toFixed(2) + 'deg');
  face.style.setProperty('--near', (1 - Math.min(1, Math.hypot(nx, ny))).toFixed(3));
}, { passive: true });

/* ============ ARCHIVE ============ */
const SEASONS = [
  { n: 1, yrs: '2001', net: 'Cartoon Network', count: 13,
    blurb: 'The series premiered on August 10, 2001 with a three-part movie. The first season set the rules: a stranger in a strange future, very little dialogue, long silences and sudden bursts of action.',
    eps: [['I', 'The Beginning', 'Aku escapes, the prince trains, the portal opens.'], ['II', 'The Samurai Called Jack', 'He arrives in the future and gets his name.'], ['III', 'The First Fight', 'Jack against Aku’s beetle drones.'], ['VII', 'Jack and the Three Blind Archers', 'A tower, a wish and three guardians.'], ['VIII', 'Jack vs. Mad Jack', 'Aku turns Jack’s anger into a twin.'], ['XI', 'Jack and the Scotsman', 'Rivals chained together.'], ['XIII', 'Aku’s Fairy Tales', 'Aku tries to win over the children.']] },
  { n: 2, yrs: '2002', net: 'Cartoon Network', count: 13,
    blurb: 'Season two grew more ambitious: an homage to the battle of Thermopylae, a sequel with the Scotsman, and Jack learning to jump.',
    eps: [['XIV', 'Jack Learns to Jump Good', 'Kangaroo-like jumpers teach him to leap.'], ['', 'Jack and the Scotsman II', 'The Scotsman returns, with his wife.'], ['XXV', 'Jack and the Spartans', 'Jack stands with a band of 300-style Spartan warriors.']] },
  { n: 3, yrs: '2002–2003', net: 'Cartoon Network', count: 13,
    blurb: 'The third season is where the mythology deepened, including the two-part origin story of Aku and the sword.',
    eps: [['', 'Jack in Egypt', 'A pharaoh, a demon and a prophecy.'], ['XXXII', 'Jack and the Traveling Creatures', 'Jack finds a time portal, and the Guardian who keeps it.'], ['XXXVII', 'The Birth of Evil, Part 1', 'Odin, Ra, Vishnu, and the darkness that became Aku.'], ['XXXVIII', 'The Birth of Evil, Part 2', 'The Emperor receives the sword.']] },
  { n: 4, yrs: '2003–2004', net: 'Cartoon Network', count: 13,
    blurb: 'The original run ended on September 25, 2004 without an ending. Highlights include duels with ninja and samurai, and a noir episode told from a robot assassin’s point of view.',
    eps: [['', 'Samurai Versus Ninja', 'A fight in light and shadow.'], ['', 'Robo-Samurai Versus Mondo Bot', 'Jack in a giant robot suit against a giant robot.'], ['L', 'Tale of X-9', 'A robot assassin, a dog named Lulu, and jazz.']] },
  { n: 5, yrs: '2017', net: 'Adult Swim · Toonami', count: 10,
    blurb: 'Thirteen years later, Genndy Tartakovsky returned with a darker, serialized final season that aired from March 11 to May 20, 2017. Each episode is numbered as if the fifty lost years had passed.',
    eps: [['XCII', 'Season 5 premiere', 'Fifty years later, Jack is without his sword.'], ['XCIII–C', 'The road back', 'The Daughters of Aku, Ashi’s turn, and the sword’s return.'], ['CI', 'Series finale', 'Back to the past, and a ladybug.']] }
];
const seasonsEl = $('#seasons'), epBody = $('#epBody');
SEASONS.forEach((s, i) => {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'season'; b.role = 'tab';
  b.innerHTML = `<small>${s.yrs}</small><b>Season ${s.n}</b><div class="bar"><i style="width:${s.count / 13 * 100}%"></i></div><small>${s.count} episodes</small>`;
  b.addEventListener('click', () => showSeason(i)); seasonsEl.appendChild(b);
});
function showSeason(i) {
  const s = SEASONS[i];
  $$('.season', seasonsEl).forEach((b, k) => { b.classList.toggle('on', k === i); b.setAttribute('aria-selected', k === i); });
  epBody.innerHTML = `<div class="blurb"><span class="eyebrow">${s.net} · ${s.yrs}</span><h3>Season ${s.n}</h3><p>${s.blurb}</p></div>
    <ul class="eps">${s.eps.map(([n, t, d]) => `<li><span class="num">${n || '·'}</span><span class="t">${t}<span class="d">${d}</span></span></li>`).join('')}</ul>`;
  if (!RM) epBody.animate?.([{ opacity: .3, transform: 'translateX(12px)' }, { opacity: 1, transform: 'none' }], { duration: 350, easing: 'cubic-bezier(.2,.8,.2,1)' });
}
showSeason(0);

/* ============ QUIZ ============ */
const Q = [
  ['Who created Samurai Jack?', ['Genndy Tartakovsky', 'Craig McCracken', 'Butch Hartman', 'Lauren Faust'], 0, 'Tartakovsky had already made Dexter’s Laboratory for Cartoon Network.'],
  ['How did Jack get his name?', ['His father named him', 'People in the future called him “Jack”', 'Aku gave it to him as an insult', 'The Scotsman made it up'], 1, 'In Episode II, a group of young people greets him as “Jack,” and he keeps it.'],
  ['Who voiced Aku in the original four seasons?', ['Phil LaMarr', 'John DiMaggio', 'Mako', 'Tom Kenny'], 2, 'Mako voiced Aku until his death in 2006. Greg Baldwin took over in Season 5.'],
  ['Which gods helped forge the sword in “The Birth of Evil”?', ['Zeus, Thor and Amaterasu', 'Odin, Ra and Vishnu', 'Anubis, Loki and Shiva', 'Apollo, Isis and Freya'], 1, 'The three gods first fought the darkness that became Aku.'],
  ['How many years pass between Season 4 and Season 5’s story?', ['13', '25', '50', '100'], 2, 'Fifty years. Jack has not aged a day.'],
  ['Which channel aired Season 5 in 2017?', ['Cartoon Network', 'Adult Swim (Toonami)', 'Netflix', 'HBO Max'], 1, 'It ran on Adult Swim’s Toonami block from March to May 2017.'],
  ['How many Daughters of Aku hunt Jack?', ['Three', 'Five', 'Seven', 'Twelve'], 2, 'Seven sisters. Ashi is the only one who survives.'],
  ['What has Jack lost when Season 5 begins?', ['His sword', 'His memory', 'His sight', 'His horse'], 0, 'Without the sword, he cannot defeat Aku or go home.'],
  ['Who voices Jack?', ['Phil LaMarr', 'Kevin Michael Richardson', 'Mark Hamill', 'Rob Paulsen'], 0, 'Phil LaMarr voiced Jack in all five seasons.'],
  ['What lands on Jack’s finger in the final scene?', ['A butterfly', 'A ladybug', 'A cherry blossom', 'A firefly'], 1, 'A ladybug, a quiet callback to Ashi.']
];
const qcard = $('#qcard'); let qi = 0, qs = 0;
function showQ() {
  if (qi >= Q.length) return showResult();
  const [q, opts, ans, why] = Q[qi];
  qcard.innerHTML = `<div class="qmeta"><span>QUESTION ${qi + 1} / ${Q.length}</span><span>SCORE ${qs}</span></div>
    <div class="qprog"><i style="width:${qi / Q.length * 100}%"></i></div>
    <h3>${q}</h3><div class="opts">${opts.map((o, k) => `<button class="opt" type="button" data-k="${k}">${o}</button>`).join('')}</div>
    <p class="why" id="why"></p>`;
  $$('.opt', qcard).forEach(b => b.addEventListener('click', () => {
    const k = +b.dataset.k, ok = k === ans; if (ok) qs++;
    $$('.opt', qcard).forEach((x, j) => { x.disabled = true; if (j === ans) x.classList.add('right'); else if (j === k) x.classList.add('wrong'); });
    $('#why').textContent = (ok ? 'Correct. ' : 'Not quite. ') + why;
    const n = document.createElement('button'); n.type = 'button'; n.className = 'btn'; n.textContent = qi + 1 < Q.length ? 'Next question →' : 'See your rank'; n.style.justifySelf = 'start';
    n.onclick = () => { qi++; showQ(); }; qcard.appendChild(n); n.focus({ preventScroll: true });
    if (ok) sfx.clank();
  }));
}
function showResult() {
  const ranks = [[10, 'Master of the blade', 'You could find your way back to the past with your eyes closed.'], [8, 'Samurai', 'You know this world well. Aku should be worried.'], [5, 'Wandering ronin', 'Solid. A few more episodes and you will be ready.'], [0, 'Woolie in training', 'Time for a rewatch, starting from Episode I.']];
  const [, r, t] = ranks.find(([m]) => qs >= m);
  const prevBest = +store.get('sj-quiz', 0) || 0; if (qs > prevBest) store.set('sj-quiz', qs);
  qcard.innerHTML = `<div class="qmeta"><span>TRIAL COMPLETE</span><span>${qs} / ${Q.length}</span></div><div class="qprog"><i style="width:100%"></i></div>
    <span class="rank">${r}</span><p>${t}</p><p class="why">Best on this device: ${Math.max(qs, prevBest)} / ${Q.length}</p>`;
  const b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.textContent = 'Take the trial again'; b.style.justifySelf = 'start';
  b.onclick = () => { qi = 0; qs = 0; showQ(); }; qcard.appendChild(b);
}
showQ();


/* ============ THE BLADE: three.js katana + "Severed Wind" petal field ============ */
(() => {
  const host = $('#bladeStage'), fb = $('#bladeFallback');
  let renderer;
  try { if (!window.THREE) throw 0; renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
  catch (_) { fb.hidden = false; $('#bladeCtl').hidden = true; return; }
  const T = THREE;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  host.appendChild(renderer.domElement);
  const scene = new T.Scene();
  const cam = new T.PerspectiveCamera(26, 16 / 9, .1, 100); cam.position.set(0, .25, 8.2); cam.lookAt(0, 0, 0);

  // environment: a painted sunset with two softboxes, so the steel has something worth reflecting
  const ec = document.createElement('canvas'); ec.width = 1024; ec.height = 512; const eg = ec.getContext('2d');
  const sky = eg.createLinearGradient(0, 0, 0, 512);
  [['#0e0e0e', 0], ['#232323', .25], ['#b91711', .4], ['#e0241b', .48], ['#ff4a3f', .5], ['#262626', .56], ['#080808', 1]].forEach(([c, o]) => sky.addColorStop(o, c));
  eg.fillStyle = sky; eg.fillRect(0, 0, 1024, 512);
  eg.fillStyle = '#ffffff'; eg.fillRect(120, 120, 260, 26); eg.fillRect(600, 90, 300, 14);
  eg.fillStyle = '#ff3b30'; eg.fillRect(820, 330, 140, 12);
  const etex = new T.CanvasTexture(ec); etex.mapping = T.EquirectangularReflectionMapping; etex.encoding = T.sRGBEncoding;
  const pm = new T.PMREMGenerator(renderer); scene.environment = pm.fromEquirectangular(etex).texture;

  scene.add(new T.HemisphereLight(0xffe9e6, 0x191919, .35));
  const key = new T.DirectionalLight(0xf1f1f1, 1.6); key.position.set(3, 4, 5); scene.add(key);
  const rim = new T.PointLight(0xff3b30, 1.4, 12); rim.position.set(-3, -1.2, -2.5); scene.add(rim);
  const glint = new T.PointLight(0xffffff, 0, 2.2); scene.add(glint);

  const L = 3.0, S = x => .1 * Math.pow(Math.max(0, x) / L, 2); // sori: the curve of the blade
  // blade texture: polished body above a frosted, wavy hamon line along the edge
  const bc = document.createElement('canvas'); bc.width = 1024; bc.height = 256; const bg = bc.getContext('2d');
  const V = y => (y + .07) * 4; // world y -> texture v
  bg.fillStyle = '#979797'; bg.fillRect(0, 0, 1024, 256);
  bg.fillStyle = '#fdfdfd'; bg.beginPath(); bg.moveTo(0, 256);
  for (let i = 0; i <= 200; i++) { const u = i / 200, x = u * 3.05, edge = -(.058 - .012 * x / L) + S(x), v = V(edge) + .17 + .045 * Math.sin(u * 70) + .02 * Math.sin(u * 190); bg.lineTo(u * 1024, (1 - v) * 256); }
  bg.lineTo(1024, 256); bg.closePath(); bg.fill();
  bg.fillStyle = 'rgba(255,255,255,.35)'; for (let i = 0; i < 400; i++) bg.fillRect(Math.random() * 1024, 160 + Math.random() * 96, 2, 1);
  const btex = new T.CanvasTexture(bc); btex.encoding = T.sRGBEncoding; btex.repeat.set(1 / 3.05, 4); btex.offset.set(0, .28); btex.anisotropy = 4;

  const shapeOf = (pad) => {
    const sh = new T.Shape(), N = 40;
    sh.moveTo(-pad * .5, -.058 - pad);
    for (let i = 1; i <= N; i++) { const x = i / N * 2.82; sh.lineTo(x, -(.058 - .012 * x / L) - pad + S(x)); }
    sh.quadraticCurveTo(2.97 + pad, -.03 + S(2.95) - pad * .5, 3.0 + pad, S(3) + .04 + pad * .3);
    for (let i = N; i >= 0; i--) { const x = i / N * 2.9; sh.lineTo(x, (.056 - .01 * x / L) + pad + S(x)); }
    sh.closePath(); return sh;
  };
  const sword = new T.Group(), hilt = new T.Group();
  const steel = new T.MeshStandardMaterial({ color: 0xffffff, map: btex, metalness: .96, roughness: .2, envMapIntensity: 1.3 });
  const bladeGeo = new T.ExtrudeGeometry(shapeOf(0), { depth: .014, bevelEnabled: true, bevelThickness: .011, bevelSize: .005, bevelSegments: 2, curveSegments: 16 });
  bladeGeo.translate(0, 0, -.007);
  const blade = new T.Mesh(bladeGeo, steel); hilt.add(blade);
  const gold = new T.MeshStandardMaterial({ color: 0xff3b30, metalness: 1, roughness: .32 });
  const iron = new T.MeshStandardMaterial({ color: 0x252525, metalness: .75, roughness: .45 });
  const habaki = new T.Mesh(new T.BoxGeometry(.08, .13, .05), gold); habaki.position.set(.04, 0, 0); hilt.add(habaki);
  const tsuba = new T.Mesh(new T.CylinderGeometry(.2, .2, .03, 64), iron); tsuba.rotation.z = Math.PI / 2; tsuba.position.x = -.015; hilt.add(tsuba);
  const rimRing = new T.Mesh(new T.TorusGeometry(.2, .009, 10, 64), gold); rimRing.rotation.y = Math.PI / 2; rimRing.position.x = -.015; hilt.add(rimRing);
  // grip wrap: dark cord diamonds over pale ray skin
  const wc = document.createElement('canvas'); wc.width = 256; wc.height = 128; const wg = wc.getContext('2d');
  wg.fillStyle = '#ececec'; wg.fillRect(0, 0, 256, 128); wg.strokeStyle = '#121212'; wg.lineWidth = 34;
  for (let x = -256; x < 512; x += 64) { wg.beginPath(); wg.moveTo(x, 0); wg.lineTo(x + 128, 128); wg.stroke(); wg.beginPath(); wg.moveTo(x + 128, 0); wg.lineTo(x, 128); wg.stroke(); }
  const wtex = new T.CanvasTexture(wc); wtex.encoding = T.sRGBEncoding; wtex.wrapS = wtex.wrapT = T.RepeatWrapping; wtex.repeat.set(2, 5);
  const tsuka = new T.Mesh(new T.CylinderGeometry(.044, .048, .9, 32, 1), new T.MeshStandardMaterial({ map: wtex, roughness: .75, metalness: .05 }));
  tsuka.rotation.z = Math.PI / 2; tsuka.scale.z = .8; tsuka.position.x = -.48; hilt.add(tsuka);
  const kashira = new T.Mesh(new T.CylinderGeometry(.05, .046, .06, 32), gold); kashira.rotation.z = Math.PI / 2; kashira.scale.z = .8; kashira.position.x = -.95; hilt.add(kashira);
  sword.add(hilt);
  // scabbard
  const lacquer = new T.MeshPhysicalMaterial({ color: 0x0b0b0b, roughness: .3, metalness: .15, clearcoat: 1, clearcoatRoughness: .08, transparent: true });
  const sayaGeo = new T.ExtrudeGeometry(shapeOf(.028), { depth: .05, bevelEnabled: true, bevelThickness: .018, bevelSize: .012, bevelSegments: 3, curveSegments: 16 });
  sayaGeo.translate(0, 0, -.025);
  const saya = new T.Group(); const sayaMesh = new T.Mesh(sayaGeo, lacquer); saya.add(sayaMesh);
  const koi = new T.Mesh(new T.BoxGeometry(.05, .2, .1), new T.MeshStandardMaterial({ color: 0x1f1f1f, roughness: .4, transparent: true })); koi.position.set(.06, 0, 0); saya.add(koi);
  sword.add(saya);
  sword.position.x = -1.0; // center the whole sword on the origin
  const rig = new T.Group(); rig.add(sword); scene.add(rig);

  // ----- "Severed Wind": seeded, divergence-free petal field -----
  const MAX = 1500;
  const petalGeo = new T.CircleGeometry(1, 7); petalGeo.scale(1, .5, 1);
  const petalMat = new T.MeshStandardMaterial({ roughness: .55, metalness: 0, side: T.DoubleSide, emissive: 0x131313, emissiveIntensity: .2 });
  const petals = new T.InstancedMesh(petalGeo, petalMat, MAX); petals.instanceMatrix.setUsage(T.DynamicDrawUsage);
  scene.add(petals);
  const P = { pos: new Float32Array(MAX * 3), vel: new Float32Array(MAX * 3), rot: new Float32Array(MAX * 3), spin: new Float32Array(MAX * 3), size: new Float32Array(MAX), ember: new Uint8Array(MAX), tone: new Uint8Array(MAX) };
  const BLOSSOM = [new T.Color('#e0241b'), new T.Color('#f5f3f0'), new T.Color('#b3140f')], EMBER = [new T.Color('#ff3b30'), new T.Color('#ff3b30')];
  const state = { seed: 2001, count: 620, gust: 1, drawn: false, draw: 0 };
  let field = [];
  const mulberry = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const BX = 4.8, BY = 2.3, BZ = 2.4;
  function spawn(i, r, edge) {
    P.pos[i * 3] = edge ? -BX : (r() * 2 - 1) * BX; P.pos[i * 3 + 1] = (r() * 2 - 1) * BY; P.pos[i * 3 + 2] = (r() * 2 - 1) * BZ;
    P.vel[i * 3] = P.vel[i * 3 + 1] = P.vel[i * 3 + 2] = 0;
    for (let k = 0; k < 3; k++) { P.rot[i * 3 + k] = r() * 6.28; P.spin[i * 3 + k] = (r() - .5) * 3; }
    P.size[i] = .016 + r() * .022; P.ember[i] = 0; P.tone[i] = Math.floor(r() * 3);
    petals.setColorAt(i, BLOSSOM[P.tone[i]]);
  }
  function reseed() {
    const r = mulberry(state.seed);
    field = Array.from({ length: 5 }, () => { // vector potential A = Σ a·sin(k·p + ωt + φ)·d ; velocity = curl A
      const k = new T.Vector3(r() - .5, r() - .5, r() - .5).normalize().multiplyScalar(.25 + r() * .65);
      const d = new T.Vector3(r() - .5, r() - .5, r() - .5).normalize();
      return { k, kd: new T.Vector3().crossVectors(k, d), a: .35 + r() * .55, w: .08 + r() * .35, ph: r() * 6.28 };
    });
    for (let i = 0; i < MAX; i++) spawn(i, r, false);
    petals.instanceColor.needsUpdate = true;
    $('#seedVal').textContent = state.seed;
  }
  const tmpV = new T.Vector3(), local = new T.Vector3(), inv = new T.Matrix4(), q = new T.Quaternion(), dummy = new T.Object3D(), up = new T.Vector3();
  // the moving sword and the cursor both stir the air: track their world positions between frames
  const A = new T.Vector3(), B = new T.Vector3(), pA = new T.Vector3(), pB = new T.Vector3(), vA = new T.Vector3(), vB = new T.Vector3();
  const C = new T.Vector3(), pC = new T.Vector3(), vC = new T.Vector3(), rawC = new T.Vector3(), ray = new T.Raycaster(), plane = new T.Plane(new T.Vector3(0, 0, 1), 0), ndc = new T.Vector2();
  let tracked = false, cursorOn = false, lastSpinY = 0, spinGust = 0;
  const WAKE_R = .75, CURSOR_R = 1.15, GRAVITY = .13;
  function stirrers(dt) {
    A.set(-.7, 0, 0); sword.localToWorld(A); B.set(3, S(3), 0); sword.localToWorld(B);
    if (tracked && dt > 0) { vA.subVectors(A, pA).divideScalar(dt).clampLength(0, 9); vB.subVectors(B, pB).divideScalar(dt).clampLength(0, 9); } else { vA.set(0, 0, 0); vB.set(0, 0, 0); }
    pA.copy(A); pB.copy(B);
    // spinning the sword quickly whips up the whole field for a moment
    const spin = tracked && dt > 0 ? Math.abs(rig.rotation.y - lastSpinY) / dt : 0; lastSpinY = rig.rotation.y;
    spinGust += (Math.min(3, spin * 1.4) - spinGust) * Math.min(1, dt * 4);
    // cursor projected onto the plane the sword sits in
    if (cursorOn) {
      ndc.set(hover.x * 2, -hover.y * 2); ray.setFromCamera(ndc, cam);
      if (ray.ray.intersectPlane(plane, tmpV)) {
        C.copy(tmpV);
        if (tracked && dt > 0) { rawC.subVectors(C, pC).divideScalar(dt).clampLength(0, 8); vC.lerp(rawC, .6); } // smoothed pointer velocity
        pC.copy(C);
      }
    } else vC.multiplyScalar(.9);
    tracked = true;
  }
  const seg = new T.Vector3(), rel = new T.Vector3();
  function stepPetals(dt, t) {
    inv.copy(sword.matrixWorld).invert(); sword.getWorldQuaternion(q);
    stirrers(dt);
    seg.subVectors(B, A); const segL2 = seg.lengthSq() || 1;
    const cutting = state.draw > .6;
    for (let i = 0; i < state.count; i++) {
      const o = i * 3; let x = P.pos[o], y = P.pos[o + 1], z = P.pos[o + 2];
      let fx = .35 * state.gust + .15 + spinGust * .45, fy = 0, fz = 0; // prevailing wind, stronger right after a spin
      const turb = state.gust * (1 + spinGust * .5);
      for (const f of field) { const c = f.a * Math.cos(f.k.x * x + f.k.y * y + f.k.z * z + f.w * t + f.ph) * turb; fx += c * f.kd.x; fy += c * f.kd.y; fz += c * f.kd.z; }
      let grip = 0; // how strongly something nearby is moving this petal (speeds up its response)
      // wake: the nearest point on the sword drags petals along and shoves them aside
      rel.set(x - A.x, y - A.y, z - A.z);
      const u = clamp(rel.dot(seg) / segL2, 0, 1);
      const nx = A.x + seg.x * u, ny = A.y + seg.y * u, nz = A.z + seg.z * u;
      const dx = x - nx, dy2 = y - ny, dz = z - nz, dd = Math.hypot(dx, dy2, dz);
      if (dd < WAKE_R) {
        const k = 1 - dd / WAKE_R, k2 = k * k;
        const wx = vA.x + (vB.x - vA.x) * u, wy = vA.y + (vB.y - vA.y) * u, wz = vA.z + (vB.z - vA.z) * u, ws = Math.hypot(wx, wy, wz);
        fx += wx * k2 * 1.6; fy += wy * k2 * 1.6; fz += wz * k2 * 1.6;
        const inv2 = 1 / (dd || 1), shove = ws * k * 1.1 + k2 * .4;
        fx += dx * inv2 * shove; fy += dy2 * inv2 * shove; fz += dz * inv2 * shove;
        grip = Math.max(grip, k * Math.min(1, ws * .5 + .2));
      }
      // cursor gust: petals near the pointer are pushed the way it moves, with a little swirl
      if (cursorOn) {
        const cx = x - C.x, cy = y - C.y, cz = z - C.z, cd = Math.hypot(cx, cy, cz);
        if (cd < CURSOR_R) {
          const k = 1 - cd / CURSOR_R, k2 = k * k, sp = vC.length();
          fx += vC.x * k2 * 1.3 - cy * k * sp * .35; fy += vC.y * k2 * 1.3 + cx * k * sp * .35; fz += vC.z * k2;
          grip = Math.max(grip, k * Math.min(1, sp * .4));
        }
      }
      if (cutting) { // the edge is a boundary condition: shear the flow into two streams
        local.set(x, y, z).applyMatrix4(inv);
        if (local.x > -.05 && local.x < 3.05 && Math.abs(local.z) < .45) {
          const dy = local.y - S(local.x), ad = Math.abs(dy);
          if (ad < .32) {
            const push = (.32 - ad) * 9 * state.draw * (dy >= 0 ? 1 : -1);
            up.set(0, push, local.z * 2).applyQuaternion(q); fx += up.x; fy += up.y; fz += up.z;
            if (ad < .07 && !P.ember[i]) { P.ember[i] = 1; petals.setColorAt(i, EMBER[i % 2]); petals.instanceColor.needsUpdate = true; P.spin[o] *= 3; P.spin[o + 2] *= 3; }
          }
        }
      }
      // petals have mass: they ease toward the air's velocity, faster when the sword or cursor is right on them
      const ease = Math.min(1, dt * (2.2 + grip * 9));
      const vx = P.vel[o] += (fx - P.vel[o]) * ease, vy = P.vel[o + 1] += (fy - P.vel[o + 1]) * ease, vz = P.vel[o + 2] += (fz - P.vel[o + 2]) * ease;
      x += vx * dt; y += vy * dt - GRAVITY * dt; z += vz * dt;
      if (x > BX || Math.abs(y) > BY * 1.2 || Math.abs(z) > BZ * 1.2) { const r = mulberry(state.seed + i + Math.floor(t * 10)); spawn(i, r, true); petals.instanceColor.needsUpdate = true; x = P.pos[o]; y = P.pos[o + 1]; z = P.pos[o + 2]; }
      P.pos[o] = x; P.pos[o + 1] = y; P.pos[o + 2] = z;
      for (let k = 0; k < 3; k++) P.rot[o + k] += P.spin[o + k] * dt;
      dummy.position.set(x, y, z); dummy.rotation.set(P.rot[o], P.rot[o + 1], P.rot[o + 2]); dummy.scale.setScalar(P.size[i] * (P.ember[i] ? .75 : 1));
      dummy.updateMatrix(); petals.setMatrixAt(i, dummy.matrix);
    }
    petals.count = state.count; petals.instanceMatrix.needsUpdate = true;
  }

  // ----- interaction -----
  const rot = { x: .14, y: -.42, tx: .14, ty: -.42, vx: 0, vy: 0 };
  let dragging = false, moved = 0, lx = 0, ly = 0, hover = { x: 0, y: 0 };
  host.addEventListener('pointerdown', e => { dragging = true; moved = 0; lx = e.clientX; ly = e.clientY; host.setPointerCapture(e.pointerId); });
  host.addEventListener('pointermove', e => {
    const r = host.getBoundingClientRect(); hover = { x: (e.clientX - r.left) / r.width - .5, y: (e.clientY - r.top) / r.height - .5 };
    if (!dragging) return;
    const dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
    rot.ty += dx * .008; rot.tx = clamp(rot.tx + dy * .006, -.9, .9); rot.vy = dx * .008;
  });
  const end = () => { if (dragging && moved < 6) toggle(); dragging = false; };
  host.addEventListener('pointerup', end); host.addEventListener('pointercancel', () => { dragging = false; });
  host.addEventListener('pointerleave', () => { hover = { x: 0, y: 0 }; cursorOn = false; });
  host.addEventListener('pointerenter', () => { cursorOn = true; tracked = false; });
  function toggle() { state.drawn = !state.drawn; $('#drawBtn').textContent = state.drawn ? 'Sheathe the blade' : 'Draw the blade'; sfx.slash(); if (state.drawn) glintT = 0; }
  $('#drawBtn').addEventListener('click', toggle);
  $('#seedPrev').onclick = () => { state.seed = Math.max(1, state.seed - 1); reseed(); };
  $('#seedNext').onclick = () => { state.seed += 1; reseed(); };
  $('#seedRand').onclick = () => { state.seed = 1 + Math.floor(Math.random() * 99999); reseed(); };
  $('#petalN').oninput = e => { state.count = +e.target.value; };
  $('#windS').oninput = e => { state.gust = +e.target.value; };

  function size() {
    const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); cam.aspect = w / h;
    cam.position.z = w / h < 1.2 ? 10.5 : 6.6; // pull back on narrow screens so the whole sword fits
    cam.updateProjectionMatrix();
  }
  new ResizeObserver(size).observe(host); size();
  let visible = true, last = 0, t = 0, glintT = 9;
  if ('IntersectionObserver' in window) new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(host);
  const section = $('#blade');
  function frame(now) {
    requestAnimationFrame(frame);
    if (!visible) { last = now; return; }
    const dt = Math.min(.05, (now - (last || now)) / 1000); last = now; t += dt;
    if (!dragging) { rot.ty += rot.vy; rot.vy *= .94; if (!RM) rot.ty += dt * .06; }
    const sp = parseFloat(section.style.getPropertyValue('--sp')) || .5;
    rot.y += (rot.ty - rot.y) * .08; rot.x += (rot.tx - rot.x) * .08;
    rig.rotation.set(rot.x + hover.y * .15, rot.y + (sp - .5) * 1.1 + hover.x * .25, .05);
    rig.position.y = RM ? 0 : Math.sin(t * .9) * .05;
    // draw / sheathe: the scabbard slides off along the blade's line and falls away
    state.draw += ((state.drawn ? 1 : 0) - state.draw) * Math.min(1, dt * 3.2);
    const d = state.draw, e = d * d * (3 - 2 * d);
    saya.position.set(e * 3.4, -e * e * .9, 0); saya.rotation.z = -e * .35;
    lacquer.opacity = 1 - clamp((e - .55) / .45, 0, 1); koi.material.opacity = lacquer.opacity; saya.visible = lacquer.opacity > .01;
    rig.position.x = -e * .25;
    // a light sweeping down the steel after the draw
    glintT += dt;
    if (state.drawn && glintT > 7) glintT = 0;
    const gp = glintT / 1.1;
    if (gp < 1 && state.draw > .5) { tmpV.set(gp * 3.0, S(gp * 3) + .05, .35); sword.localToWorld(tmpV); glint.position.copy(tmpV); glint.intensity = Math.sin(gp * Math.PI) * 7; } else glint.intensity = 0;
    sword.updateMatrixWorld();
    if (!RM || dragging) stepPetals(dt, t);
    renderer.render(scene, cam);
  }
  reseed(); stepPetals(.016, 0); requestAnimationFrame(frame);
})();

/* ============ STILLS ============ */
// Offline: stills come from assets/js/stills.js (edit that file). On claude.ai: uploads + shared db.
function stillSrc(s) { return s.src || ('/_blob/' + s.asset); }
if (window.LOCAL_STILLS) {
  STILL.gallery = (window.LOCAL_STILLS.reel || []).map((x, i) => ({ id: 'local-' + i, src: x.src, caption: x.caption || '' }));
  const sl = window.LOCAL_STILLS.slots || {};
  for (const k in sl) STILL.slots[k] = { src: sl[k], caption: k };
}
renderSlots();
function toast(msg) { let el = $('.toast'); if (!el) { el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); } el.textContent = msg; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; }, 4200); }
const ASSET_ERR = { too_large: 'That file is over 20 MB. Try a smaller image.', unsupported_type: 'Use a PNG, JPEG, GIF or WebP image.', quota_or_state: 'This page has run out of storage for images.', rate_limited: 'Too many uploads at once. Wait a moment and try again.' };
function pickImages(multiple) {
  return new Promise(res => { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/png,image/jpeg,image/gif,image/webp'; inp.multiple = !!multiple; inp.onchange = () => res([...inp.files]); inp.click(); });
}
async function uploadStill(file) {
  try { return await STILL.assets.upload(file); }
  catch (e) { toast(ASSET_ERR[e && e.code] || 'The upload did not go through. Try again.'); return null; }
}
async function setSlot(slot, name) {
  const [f] = await pickImages(false); if (!f) return;
  toast('Uploading…');
  const up = await uploadStill(f); if (!up) return;
  const old = STILL.slots[slot];
  try { await STILL.db.doc('stills/' + slot).set({ asset: up.id, caption: name, at: Date.now() }); toast('Still added to ' + name + '.'); }
  catch (_) { toast('The image uploaded, but saving it to the page failed.'); return; }
  if (old && old.asset && old.asset !== up.id) STILL.assets.delete(old.asset).catch(() => {});
}
async function clearSlot(slot, name) {
  const old = STILL.slots[slot]; if (!old) return;
  try { await STILL.db.doc('stills/' + slot).delete(); if (old.asset) await STILL.assets.delete(old.asset); toast('Removed the still from ' + name + '.'); }
  catch (_) { toast('Could not remove that still. Try again.'); }
}
function slotTools(slot, name) {
  if (!STILL.assets || !STILL.db) return '';
  const has = !!STILL.slots[slot];
  return `<div class="slot-tools"><button class="btn small" type="button" data-set="${slot}" data-name="${name}">${has ? 'Replace still' : 'Add a still of ' + name}</button>${has ? `<button class="btn small ghost" type="button" data-clear="${slot}" data-name="${name}">Remove</button>` : ''}</div>`;
}
function renderSlots() {
  // cast dossier
  const ds = document.querySelector('.dossier .slot');
  if (ds) {
    const slot = ds.dataset.slot, name = ds.dataset.name, s = STILL.slots[slot];
    ds.innerHTML = (s ? `<figure class="slot-still tilt"><img src="${stillSrc(s)}" alt="${name} in Samurai Jack" loading="lazy"></figure>` : '') + slotTools(slot, name);
    ds.querySelectorAll('.tilt').forEach(addTilt);
  }
  // timeline
  const ei = document.getElementById('eraSlotImg'), et = document.getElementById('eraSlotTools');
  if (ei && typeof eraI === 'number') {
    const slot = 'era-' + eraI, s = STILL.slots[slot], name = '“' + ERAS[eraI].t + '”';
    ei.innerHTML = s ? `<img class="era-still" src="${stillSrc(s)}" alt="Scene from ${ERAS[eraI].t}">` : '';
    et.innerHTML = slotTools(slot, name).replace(/^<div class="slot-tools">|<\/div>$/g, '');
  }
}
document.addEventListener('click', e => {
  const s = e.target.closest('[data-set]'), c = e.target.closest('[data-clear]');
  if (s) setSlot(s.dataset.set, s.dataset.name);
  if (c) clearSlot(c.dataset.clear, c.dataset.name);
});

// the map: every still on the page, floating on a sphere around the viewer
const mapStage = $('#mapStage'), mapWorld = $('#mapWorld');
const MAP = { yaw: -8, pitch: -4, zoom: 0, vy: 0, vp: 0, R: 900, fw: 260, cards: [], drag: false, moved: 0, active: false, lx: 0, ly: 0, pts: new Map(), pinch: 0 };
function slotCaption(key) {
  const who = CAST.find(p => p.id === key); if (who) return who.n;
  const m = /^era-(\d+)$/.exec(key); if (m && ERAS[+m[1]]) return ERAS[+m[1]].t;
  return '';
}
// reel frames first, then character and timeline stills, then the prologue panels; each image once
function mapFrames() {
  const seen = new Set(), out = [];
  const add = (img, cap, id) => { if (!img || seen.has(img)) return; seen.add(img); out.push({ img, cap: cap || '', id }); };
  STILL.gallery.forEach(x => add(stillSrc(x), x.caption, x.id));
  Object.keys(STILL.slots).forEach(k => add(stillSrc(STILL.slots[k]), slotCaption(k), 'slot-' + k));
  $$('.panel').forEach(p => { const im = $('.art', p); if (im) add(im.getAttribute('src'), ($('.cap b', p) || {}).textContent, 'panel'); });
  return out;
}
function renderRing() { // name kept: the upload hooks below still call it
  const frames = mapFrames(), n = frames.length;
  MAP.fw = clamp(mapStage.clientWidth * .2, 150, 270);
  const rows = n > 24 ? 3 : n > 10 ? 2 : 1, per = Math.ceil(n / rows);
  // size the sphere so each row wraps around with a small gap between frames
  MAP.R = Math.max(MAP.fw * 2.2, per * MAP.fw * 1.28 / (2 * Math.PI));
  const rowStep = Math.atan((MAP.fw * .625 * 1.35) / MAP.R) * 180 / Math.PI;
  const ROW_PITCH = rows === 3 ? [-rowStep, 0, rowStep] : rows === 2 ? [-rowStep / 2, rowStep / 2] : [0];
  MAP.cards = frames.map((f, i) => {
    const row = i % rows, k = Math.floor(i / rows), h = Math.sin(i * 12.9898) * 43758.5453, j = h - Math.floor(h);
    return { ...f, yaw: k * (360 / per) + row * (180 / per) + (j - .5) * 6, pitch: ROW_PITCH[row] + (j - .5) * 7, r: MAP.R * (.9 + j * .22) };
  });
  mapStage.style.setProperty('--fw', MAP.fw + 'px');
  mapWorld.innerHTML = MAP.cards.map((c, i) =>
    `<button class="mf" type="button" data-k="${i}" style="transform: rotateY(${c.yaw.toFixed(2)}deg) rotateX(${(-c.pitch).toFixed(2)}deg) translateZ(${(-c.r).toFixed(1)}px)" aria-label="Open still: ${c.cap || 'untitled'}"><img src="${c.img}" alt="${c.cap || 'Samurai Jack still'}" loading="lazy" draggable="false">${c.cap ? `<span class="cap3">${c.cap}</span>` : ''}</button>`).join('');
  MAP.els = [...mapWorld.children];
  $('#stillsCount').textContent = n ? `${n} frames in the map` : (STILL.assets ? 'No stills yet. Use Add stills, or drop image files onto the map.' : 'No stills yet.');
}
function openLightbox(c) {
  const lb = document.createElement('div'); lb.className = 'lightbox'; lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-label', 'Still');
  lb.innerHTML = `<figure><img src="${c.img}" alt="${c.cap || 'Samurai Jack still'}"><figcaption><span>${c.cap || ''}</span><span class="slot-tools">${STILL.assets ? '<button class="btn small ghost" type="button" data-del>Remove from reel</button>' : ''}<button class="btn small" type="button" data-close>Close</button></span></figcaption></figure>`;
  const close = () => { lb.remove(); document.removeEventListener('keydown', esc); };
  const esc = e => { if (e.key === 'Escape') close(); };
  lb.addEventListener('click', async e => {
    if (e.target === lb || e.target.closest('[data-close]')) close();
    if (e.target.closest('[data-del]')) {
      try { await STILL.db.doc('gallery/' + c.id).delete(); const a = STILL.gallery.find(x => x.id === c.id); if (a) await STILL.assets.delete(a.asset); toast('Removed from the reel.'); close(); }
      catch (_) { toast('Could not remove that still. Try again.'); }
    }
  });
  document.addEventListener('keydown', esc); document.body.appendChild(lb); lb.querySelector('[data-close]').focus();
}
async function addToReel(files) {
  if (!STILL.assets || !STILL.db) return;
  const imgs = files.filter(f => /^image\/(png|jpeg|gif|webp)$/.test(f.type));
  if (!imgs.length) { toast('Use PNG, JPEG, GIF or WebP images.'); return; }
  let ok = 0;
  for (const f of imgs) {
    toast(`Uploading ${ok + 1} of ${imgs.length}…`);
    const up = await uploadStill(f); if (!up) continue;
    try { await STILL.db.collection('gallery').add({ asset: up.id, caption: f.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '), at: Date.now() }); ok++; }
    catch (_) { toast('An image uploaded, but saving it to the reel failed.'); }
  }
  if (ok) toast(`Added ${ok} still${ok === 1 ? '' : 's'} to the reel.`);
}
// look around: drag with momentum, pinch or the wheel to zoom (the wheel only once you've clicked in, so the page still scrolls)
const zoomBy = d => { MAP.zoom = clamp(MAP.zoom + d, -MAP.R * .6, MAP.R * .55); };
mapStage.addEventListener('pointerdown', e => {
  MAP.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  MAP.drag = true; MAP.moved = 0; MAP.lx = e.clientX; MAP.ly = e.clientY; MAP.vy = MAP.vp = 0; MAP.active = true;
  mapStage.classList.add('grabbing', 'touched');
  if (MAP.pts.size === 2) { const [a, b] = [...MAP.pts.values()]; MAP.pinch = Math.hypot(a.x - b.x, a.y - b.y); }
});
addEventListener('pointermove', e => {
  if (!MAP.drag || !MAP.pts.has(e.pointerId)) return;
  MAP.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (MAP.pts.size === 2) { // pinch to zoom
    const [a, b] = [...MAP.pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
    if (MAP.pinch) zoomBy((d - MAP.pinch) * 1.6); MAP.pinch = d; MAP.moved += 10; return;
  }
  const dx = e.clientX - MAP.lx, dy = e.clientY - MAP.ly; MAP.lx = e.clientX; MAP.ly = e.clientY; MAP.moved += Math.abs(dx) + Math.abs(dy);
  const k = 52 / MAP.fw;                                 // degrees per pixel, so a drag tracks the frames under the finger
  MAP.yaw += dx * k * .5; MAP.pitch = clamp(MAP.pitch - dy * k * .4, -34, 34); MAP.vy = dx * k * .5; MAP.vp = -dy * k * .4;
}, { passive: true });
const mapUp = e => { MAP.pts.delete(e.pointerId); if (MAP.pts.size < 2) MAP.pinch = 0; if (!MAP.pts.size) { MAP.drag = false; mapStage.classList.remove('grabbing'); } };
addEventListener('pointerup', mapUp); addEventListener('pointercancel', mapUp);
mapStage.addEventListener('pointerleave', () => { MAP.active = false; });
mapStage.addEventListener('wheel', e => { if (!MAP.active) return; e.preventDefault(); zoomBy(-e.deltaY * .9); }, { passive: false });
mapStage.addEventListener('keydown', e => {
  const step = { ArrowLeft: [-12, 0], ArrowRight: [12, 0], ArrowUp: [0, 8], ArrowDown: [0, -8] }[e.key];
  if (step) { e.preventDefault(); MAP.vy = step[0] * .14; MAP.vp = step[1] * .14; }
  if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomBy(MAP.R * .15); }
  if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomBy(-MAP.R * .15); }
});
$('#mapIn').onclick = () => zoomBy(MAP.R * .18);
$('#mapOut').onclick = () => zoomBy(-MAP.R * .18);
$('#mapReset').onclick = () => { MAP.goYaw = 0; MAP.goPitch = 0; MAP.goZoom = 0; };
mapWorld.addEventListener('click', e => {
  const b = e.target.closest('.mf'); if (!b || MAP.moved > 6) return;
  const c = MAP.cards[+b.dataset.k]; openLightbox({ img: c.img, cap: c.cap, id: c.id });
});
['dragenter', 'dragover'].forEach(ev => mapStage.addEventListener(ev, e => { if (!STILL.assets) return; e.preventDefault(); mapStage.classList.add('drop'); }));
['dragleave', 'drop'].forEach(ev => mapStage.addEventListener(ev, () => mapStage.classList.remove('drop')));
mapStage.addEventListener('drop', e => { if (!STILL.assets) return; e.preventDefault(); addToReel([...e.dataTransfer.files]); });

// per frame: momentum, a slow drift, and each frame dimmed (or hidden) by how far it faces away
let mapVisible = true;
if ('IntersectionObserver' in window) new IntersectionObserver(es => { mapVisible = es[0].isIntersecting; }).observe(mapStage);
const D2R = Math.PI / 180;
(function mapLoop() {
  requestAnimationFrame(mapLoop);
  if (!mapVisible || !MAP.els) return;
  if (!MAP.drag) {
    MAP.yaw += MAP.vy; MAP.pitch = clamp(MAP.pitch + MAP.vp, -34, 34); MAP.vy *= .94; MAP.vp *= .9;
    if (!RM && Math.abs(MAP.vy) < .02) MAP.yaw += .025;
    if (MAP.goYaw != null) { // recenter: ease back home along the shortest turn
      const dy = ((MAP.goYaw - MAP.yaw) % 360 + 540) % 360 - 180;
      MAP.yaw += dy * .08; MAP.pitch += (MAP.goPitch - MAP.pitch) * .08; MAP.zoom += (MAP.goZoom - MAP.zoom) * .08;
      if (Math.abs(dy) < .2 && Math.abs(MAP.pitch) < .2) MAP.goYaw = null;
    }
  }
  mapWorld.style.transform = `translateZ(${(MAP.persp + MAP.zoom).toFixed(1)}px) rotateX(${MAP.pitch.toFixed(2)}deg) rotateY(${MAP.yaw.toFixed(2)}deg)`;
  mapStage.style.setProperty('--sx', (MAP.yaw * -3).toFixed(1) + 'px'); mapStage.style.setProperty('--sy', (MAP.pitch * 3).toFixed(1) + 'px');
  // where does each frame end up relative to the camera? (same rotation order as the CSS)
  const cy = Math.cos(MAP.yaw * D2R), sy = Math.sin(MAP.yaw * D2R), cp = Math.cos(MAP.pitch * D2R), sp = Math.sin(MAP.pitch * D2R);
  for (let i = 0; i < MAP.cards.length; i++) {
    const c = MAP.cards[i], el = MAP.els[i];
    const th = c.yaw * D2R, ph = c.pitch * D2R;
    const x = -Math.cos(ph) * Math.sin(th), y = -Math.sin(ph), z = -Math.cos(ph) * Math.cos(th);  // unit direction of the frame
    const x2 = x * cy + z * sy, z2 = -x * sy + z * cy;
    const z3 = y * sp + z2 * cp;                                                               // -1 means dead ahead
    const face = -z3;
    if (face < .05) { if (!el.hidden) el.hidden = true; continue; }
    if (el.hidden) el.hidden = false;
    el.style.opacity = clamp((face - .05) * 3, 0, 1).toFixed(2);
    el.style.filter = `brightness(${(.35 + .65 * face).toFixed(2)})`;
  }
})();
function sizeMap() { MAP.persp = parseFloat(getComputedStyle(mapStage).perspective) || 900; }
sizeMap(); renderRing();
addEventListener('resize', () => { sizeMap(); renderRing(); });


(async () => {
  if (!window.claude || typeof window.claude.use !== 'function') return;
  const [db, assets] = await Promise.all([window.claude.use('db'), window.claude.use('assets')]);
  STILL.db = db; STILL.assets = db ? assets : null;
  if (STILL.assets) {
    const bar = $('#stillsBar');
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn small'; b.textContent = 'Add stills';
    b.onclick = () => pickImages(true).then(addToReel); bar.prepend(b);
    $('#stillsLead').textContent = 'Drag to look around and click a frame to open it. Add screenshots from the show with Add stills, or drop image files onto the map. Everyone who opens this page sees them.';
  }
  renderRing(); renderSlots();
  if (!db) return;
  db.collection('stills').onSnapshot(snap => {
    STILL.slots = {}; snap.docs.forEach(d => { const v = d.data(); if (v && v.asset) STILL.slots[d.id] = v; });
    renderSlots();
  }, () => {});
  db.collection('gallery').orderBy('at').onSnapshot(snap => {
    STILL.gallery = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(x => x.asset);
    renderRing();
  }, () => {});
})();

/* ============ 3D TILT + CURSOR ============ */
function addTilt(el) {
  if (RM || el._tilt || !matchMedia('(pointer: fine)').matches) return; el._tilt = 1;
  el.addEventListener('pointermove', e => {
    const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    el.classList.add('live');
    el.style.setProperty('--ry', ((x - .5) * 10).toFixed(2) + 'deg'); el.style.setProperty('--rx', ((.5 - y) * 8).toFixed(2) + 'deg');
    el.style.setProperty('--gx', (x * 100).toFixed(1) + '%'); el.style.setProperty('--gy', (y * 100).toFixed(1) + '%'); el.style.setProperty('--go', 1);
  });
  el.addEventListener('pointerleave', () => { el.classList.remove('live'); el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); el.style.setProperty('--go', 0); });
}
$$('.tilt').forEach(addTilt);
if (!RM && matchMedia('(pointer: fine)').matches) {
  const rc = document.createElement('div'); rc.className = 'ring-cursor'; rc.setAttribute('aria-hidden', 'true'); document.body.appendChild(rc);
  let cx = -100, cy = -100, tx = -100, ty = -100;
  addEventListener('pointermove', e => { tx = e.clientX; ty = e.clientY; rc.classList.toggle('hot', !!e.target.closest('a, button, [role=button], canvas, input, .c3')); });
  (function follow() { cx += (tx - cx) * .2; cy += (ty - cy) * .2; rc.style.transform = `translate(${cx.toFixed(1)}px, ${cy.toFixed(1)}px)`; requestAnimationFrame(follow); })();
}

/* ============ SCROLL MOTION ============ */
if (!RM) {
  const SP = $$('main > section, .sec-head, .panel');
  $$('main > section').forEach(sec => {
    sec.insertAdjacentHTML('afterbegin', '<div class="cut" aria-hidden="true"></div>');
    sec._cut = sec.querySelector('.cut');
  });
  $$('.who').forEach((el, i) => el.style.setProperty('--i', i));
  $$('.season').forEach((el, i) => el.style.setProperty('--i', i));
  $$('.titles li').forEach((el, i) => el.style.setProperty('--i', i));
  const root = document.documentElement;
  let queued = false, lastY = scrollY;
  const drift = document.createElement('canvas'); drift.className = 'drift'; drift.setAttribute('aria-hidden', 'true'); document.body.appendChild(drift);
  const dc = drift.getContext('2d'); let vel = 0;
  const flakes = Array.from({ length: 16 }, () => ({ x: Math.random(), y: Math.random(), r: rand(2.5, 5), a: rand(0, 6), s: rand(.3, 1), c: Math.random() < .5 ? '#ff3b30' : '#ff3b30' }));
  function update() {
    queued = false;
    const vh = innerHeight;
    for (const el of SP) {
      const r = el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) continue;
      const p = clamp((vh - r.top) / (vh + r.height), 0, 1);
      el.style.setProperty('--sp', p.toFixed(3));
      if (el._cut) el._cut.style.setProperty('--cp', clamp((vh - r.top) / (vh * .7), 0, 1).toFixed(3));
    }
    hero.style.setProperty('--hs', clamp(scrollY / hero.offsetHeight, 0, 1).toFixed(3));
    root.style.setProperty('--doc', clamp(scrollY / Math.max(1, root.scrollHeight - vh), 0, 1).toFixed(4));
    if (scrollY < hero.offsetHeight) placeSun();
    vel += (scrollY - lastY) * .04; lastY = scrollY;
  }
  addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(update); } }, { passive: true });
  function sizeCuts() {
    $$('main > section').forEach((sec, i) => {
      const W = sec.clientWidth, c = innerWidth * .036, even = (i + 1) % 2 === 0; // nth-child counts from 1
      sec._cut.style.setProperty('--cw', Math.hypot(W, c) + 'px');
      sec._cut.style.setProperty('--ca', (even ? 1 : -1) * Math.atan2(c, W) + 'rad');
    });
  }
  addEventListener('resize', () => { sizeCuts(); update(); });
  sizeCuts(); update();
  function driftLoop(t) {
    const d = Math.min(devicePixelRatio || 1, 2), W = innerWidth, H = innerHeight;
    if (drift.width !== Math.round(W * d)) { drift.width = Math.round(W * d); drift.height = Math.round(H * d); }
    dc.setTransform(d, 0, 0, d, 0, 0); dc.clearRect(0, 0, W, H);
    vel *= .92;
    if (!heroVisible) for (const f of flakes) {
      f.x += (.0007 + Math.sin(t / 1300 + f.a) * .0004) * f.s; f.y += (.0009 * f.s - vel * .0009); f.a += .02;
      if (f.y > 1.05) { f.y = -.05; f.x = Math.random(); } if (f.y < -.06) { f.y = 1.04; f.x = Math.random(); } if (f.x > 1.05) f.x = -.05;
      dc.save(); dc.translate(f.x * W, f.y * H); dc.rotate(f.a + vel * .05); dc.globalAlpha = .55; dc.fillStyle = f.c;
      dc.beginPath(); dc.ellipse(0, 0, f.r, f.r * .45 * (1 + Math.min(2, Math.abs(vel) * .1)), 0, 0, 7); dc.fill(); dc.restore();
    }
    requestAnimationFrame(driftLoop);
  }
  requestAnimationFrame(driftLoop);
}
})();
