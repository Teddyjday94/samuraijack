/* Back to the Past: scenery interludes (pinned, scroll-driven scenes). */
(() => {
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);

/* ============ SCENES ============ */
// Each .vista is a tall block with a sticky 100vh stage. --p runs 0 to 1 while the stage is pinned.
// Work only happens while a scene is on screen (IntersectionObserver gates the loop).
const vistas = $$('.vista').map(el => ({ el, kind: el.className.match(/v-(\w+)/)[1], cv: $('.vista-fx', el), img: $('.vista-img', el), pin: $('.vista-pin', el), p: 0, on: false, parts: [] }));
if (!vistas.length) return;

function progress(v) {
  const r = v.el.getBoundingClientRect(), span = r.height - innerHeight;
  return clamp(-r.top / Math.max(1, span), 0, 1);
}
function sizeCanvas(v) {
  const d = Math.min(devicePixelRatio || 1, 2), w = v.pin.clientWidth, h = v.pin.clientHeight;
  if (v.cv.width !== Math.round(w * d) || v.cv.height !== Math.round(h * d)) { v.cv.width = Math.round(w * d); v.cv.height = Math.round(h * d); }
  return { d, w, h };
}
function applyVars(v) {
  v.el.style.setProperty('--p', v.p.toFixed(4));
  if (v.kind === 'tree' && v.img) {
    const over = Math.max(0, v.img.offsetWidth - v.pin.clientWidth);
    v.el.style.setProperty('--pan', (-over * v.p).toFixed(1) + 'px');
  }
}

// --- per-scene drawing ---
// A camera flying down a curving tube. Rings sit one unit apart along a winding path; each ring is
// cut into wedges whose angle twists with depth, so the walls read as a spiral checker. Fog darkens
// the depths until the exit light opens at the far end.
const TUBE = { N: 38, M: 14, R: 1.55 };
const tubePath = n => [Math.sin(n * .21) * 1.3 + Math.sin(n * .067) * 1.9, Math.cos(n * .17) * .9 + Math.sin(n * .05) * .7];
const LIGHT = [242, 240, 237], DARK = [9, 9, 9], FOG = [14, 14, 16];
const shade = (col, k) => `rgb(${col.map((x, i) => Math.round(x + (FOG[i] - x) * k)).join(',')})`;
function portal(v, c, w, h, t) {
  const cx = w / 2, cy = h / 2, F = Math.max(w, h) * .55;
  const cam = t * .12 + v.p * 8.5;                   // slow drift, plus scroll carrying you forward
  const [ox, oy] = tubePath(cam + 1.2);              // the camera looks slightly ahead along the bend
  const twist = t * .12;
  const exit = clamp((v.p - .62) / .38, 0, 1);       // how close you are to the way out
  c.fillStyle = shade(DARK, 1); c.fillRect(0, 0, w, h);
  const base = Math.floor(cam), rings = [];
  for (let k = 0; k <= TUBE.N; k++) {
    const n = base + k, z = n - cam;
    if (z < .12) continue;
    const [px, py] = tubePath(n);
    rings.push({ n, z, x: cx + (px - ox) * F / z, y: cy + (py - oy) * F / z, r: TUBE.R * F / z });
  }
  // near rings first (largest), far rings drawn on top: each visible band is the tube wall between two rings.
  // Where the tunnel bends, a far ring sits off-centre and would spill past the nearer walls, so every ring
  // is clipped to the opening of the ring in front of it (clips stack, so it stays inside every opening).
  c.save();
  let farOpening = null;
  for (const g of rings) {
    if (g.r < .6) continue;
    const fog = Math.pow(clamp(g.z / TUBE.N, 0, 1), .7) * (1 - exit * .35);
    // solid alternating rings: each band of wall is one hoop, black or white
    c.fillStyle = g.n % 2 ? shade(LIGHT, fog) : shade(DARK, fog);
    c.beginPath(); c.arc(g.x, g.y, g.r, 0, Math.PI * 2); c.fill();
    // a thin bright lip on each hoop gives the rings a crisp edge as they rush past
    c.strokeStyle = `rgba(255,255,255,${(.35 * (1 - fog)).toFixed(3)})`; c.lineWidth = Math.max(.5, g.r * .012);
    c.beginPath(); c.arc(g.x, g.y, g.r, 0, Math.PI * 2); c.stroke();
    // everything farther in can only be seen through this ring's opening
    c.beginPath(); c.arc(g.x, g.y, g.r, 0, Math.PI * 2); c.clip();
    farOpening = g;
  }
  // the far end: a dark throat that becomes the exit light as you near it (still inside the clip)
  const far = farOpening;
  if (far) {
    const rr = Math.max(far.r * 1.2, 6) * (1 + exit * exit * 14);
    const g = c.createRadialGradient(far.x, far.y, 0, far.x, far.y, rr);
    g.addColorStop(0, `rgba(255,255,255,${.25 + exit * .75})`); g.addColorStop(.5, `rgba(240,238,235,${exit * .7})`); g.addColorStop(1, 'rgba(240,238,235,0)');
    c.fillStyle = g; c.beginPath(); c.arc(far.x, far.y, rr, 0, Math.PI * 2); c.fill();
  }
  c.restore();
  // as you reach the exit, its light floods past the walls too
  if (far && exit > .5) {
    const k = (exit - .5) / .5, rr = Math.hypot(w, h) * k;
    const g = c.createRadialGradient(far.x, far.y, 0, far.x, far.y, Math.max(1, rr));
    g.addColorStop(0, `rgba(250,248,245,${.9 * k})`); g.addColorStop(1, 'rgba(250,248,245,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  }
  // streaks of light rushing past along the walls
  if (!v.streaks) v.streaks = Array.from({ length: 70 }, () => ({ a: rand(0, 6.3), d: rand(.6, .95), z: rand(.5, TUBE.N) }));
  const speed = .02 + Math.abs(v.vel || 0) * .004;
  c.lineCap = 'round';
  for (const s of v.streaks) {
    s.z -= speed * 3; if (s.z < .3) { s.z = TUBE.N; s.a = rand(0, 6.3); }
    const n0 = cam + s.z, n1 = n0 + 1.4, p0 = tubePath(n0), p1 = tubePath(n1), rad = TUBE.R * s.d;
    const x0 = cx + (p0[0] - ox + Math.cos(s.a + twist) * rad) * F / s.z, y0 = cy + (p0[1] - oy + Math.sin(s.a + twist) * rad) * F / s.z;
    const x1 = cx + (p1[0] - ox + Math.cos(s.a + twist) * rad) * F / (s.z + 1.4), y1 = cy + (p1[1] - oy + Math.sin(s.a + twist) * rad) * F / (s.z + 1.4);
    c.strokeStyle = `rgba(255,255,255,${(1 - s.z / TUBE.N) * .55})`; c.lineWidth = Math.min(4, 9 / s.z);
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
  }
  // vignette sells the depth; the exit light finally floods the frame
  const vg = c.createRadialGradient(cx, cy, Math.min(w, h) * .3, cx, cy, Math.hypot(w, h) * .6);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)');
  c.fillStyle = vg; c.fillRect(0, 0, w, h);
  const flash = clamp((v.p - .9) / .1, 0, 1);
  if (flash > 0) { c.fillStyle = `rgba(245,243,240,${flash})`; c.fillRect(0, 0, w, h); }
}

function petals(v, c, w, h, t) {
  if (!v.parts.length) v.parts = Array.from({ length: Math.round(clamp(w / 14, 40, 110)) }, () => ({ x: rand(0, w), y: rand(0, h), z: rand(.4, 1.6), a: rand(0, 6.3), s: rand(.6, 1.4), hue: Math.random() }));
  c.clearRect(0, 0, w, h);
  const wind = 1 + v.vel * .02;
  for (const q of v.parts) {
    q.x -= (1.1 + Math.sin(t * .7 + q.a) * .5) * q.z * q.s * wind; q.y += (.35 + Math.sin(t + q.a) * .45) * q.z; q.a += .03 * q.s;
    if (q.x < -20) { q.x = w + 20; q.y = rand(-20, h * .8); } if (q.y > h + 20) { q.y = -20; q.x = rand(0, w + 40); }
    c.save(); c.translate(q.x, q.y); c.rotate(q.a); c.globalAlpha = .55 + q.z * .25;
    c.fillStyle = q.hue < .55 ? '#e0245a' : q.hue < .85 ? '#ff4f7a' : '#ffd0dc';
    const r = 3.2 * q.z; c.beginPath(); c.ellipse(0, 0, r, r * .55 * Math.abs(Math.cos(q.a * 1.7)) + .6, 0, 0, Math.PI * 2); c.fill(); c.restore();
  }
}

// --- meditation: a painted field that continues the photo, plus layered foreground grass ---
const mixRGB = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
const rgb = (a, al = 1) => `rgba(${a[0]},${a[1]},${a[2]},${al})`;
// one tapered, curved blade from a base point; lean is the tip's sideways offset
function blade(c, x, y, len, wid, lean) {
  const tx = x + lean, ty = y - len;
  c.beginPath();
  c.moveTo(x - wid, y);
  c.quadraticCurveTo(x - wid * .4 + lean * .25, y - len * .55, tx, ty);
  c.quadraticCurveTo(x + wid * .6 + lean * .3, y - len * .5, x + wid, y);
  c.closePath(); c.fill();
}
// sample the photo's edge columns row by row (Jack sits in the middle, so skip it)
function samplePhoto(img) {
  const s = document.createElement('canvas'); s.width = 48; s.height = 96;
  const x = s.getContext('2d'); x.drawImage(img, 0, 0, 48, 96);
  const d = x.getImageData(0, 0, 48, 96).data, rows = [];
  for (let r = 0; r < 96; r++) {
    let R = 0, G = 0, B = 0, n = 0;
    for (const col of [0, 1, 2, 3, 4, 5, 6, 7, 40, 41, 42, 43, 44, 45, 46, 47]) { const i = (r * 48 + col) * 4; R += d[i]; G += d[i + 1]; B += d[i + 2]; n++; }
    rows.push([R / n, G / n, B / n]);
  }
  return rows;
}
function paintField(v) {
  const bg = $('.med-bg', v.el), frame = $('.med-frame', v.el), img = v.img;
  if (!bg || !img || !img.complete || !img.naturalWidth) return false;
  const d = Math.min(devicePixelRatio || 1, 2), w = bg.clientWidth, h = bg.clientHeight;
  if (!w || !h) return false;
  bg.width = Math.round(w * d); bg.height = Math.round(h * d);
  const c = bg.getContext('2d'); c.setTransform(d, 0, 0, d, 0, 0);
  const rows = v.rows || (v.rows = samplePhoto(img));
  const top = frame.offsetTop, fh = frame.offsetHeight;
  const DEEP = [8, 38, 30], LUSH = [96, 206, 92];
  // field color at height y: the photo's own rows where it sits, extended darker above and brighter below
  const colorAt = y => {
    if (y < top) return mixRGB(rows[0], DEEP, clamp((top - y) / Math.max(1, top), 0, 1) * .55);
    if (y > top + fh) return mixRGB(rows[95], LUSH, clamp((y - top - fh) / Math.max(1, h - top - fh), 0, 1) * .25);
    return rows[clamp(Math.floor((y - top) / fh * 96), 0, 95)];
  };
  for (let y = 0; y < h; y += 2) { c.fillStyle = rgb(colorAt(y)); c.fillRect(0, y, w, 2); }
  // painted blades, far (small, top) to near (large, bottom), leaning up-left like the photo
  const n = Math.round(w * h / 140), list = [];
  for (let i = 0; i < n; i++) list.push(rand(0, h + 30));
  list.sort((a, b) => a - b);
  const scale = h / 900;
  for (const y of list) {
    const k = clamp(y / h, 0, 1), len = (7 + k * 34) * scale * rand(.7, 1.3), wid = (.8 + k * 2.6) * scale;
    const base = colorAt(clamp(y, 0, h - 1)), roll = Math.random();
    const col = roll < .16 ? mixRGB(base, [196, 246, 140], rand(.35, .6))   // sunlit tips
      : roll < .5 ? mixRGB(base, [4, 30, 22], rand(.15, .35))              // shadowed blades
      : mixRGB(base, [150, 230, 120], rand(0, .18));
    c.fillStyle = rgb(col, .9);
    blade(c, rand(-10, w + 10), y, len, wid, -len * rand(.25, .7));
  }
  // soft wind streaks, the light bands the original painting has
  c.globalCompositeOperation = 'soft-light';
  for (let i = 0; i < 7; i++) {
    const y = rand(h * .25, h), g = c.createLinearGradient(0, y - 40, 0, y + 40);
    g.addColorStop(0, 'rgba(255,255,220,0)'); g.addColorStop(.5, 'rgba(255,255,220,.35)'); g.addColorStop(1, 'rgba(255,255,220,0)');
    c.fillStyle = g; c.save(); c.translate(w / 2, y); c.rotate(-.08); c.fillRect(-w, -40, w * 2, 80); c.restore();
  }
  c.globalCompositeOperation = 'source-over';
  return true;
}
function grass(v, c, w, h, t) {
  const key = w + 'x' + h;
  if (v.fieldKey !== key && paintField(v)) v.fieldKey = key;
  if (v.img && !v.img._hooked) { v.img._hooked = 1; v.img.addEventListener('load', () => { v.fieldKey = null; }); }
  if (!v.parts.length) {
    // three depths of foreground grass: back (short, dim), mid, front (tall, rich)
    const layer = (n, hMin, hMax, wid, depth) => Array.from({ length: n }, () => ({ x: rand(-20, w + 20), hgt: rand(hMin, hMax), wid: wid * rand(.75, 1.25), ph: rand(0, 6.3), lean: rand(-.35, .05), depth, tint: Math.random() }));
    v.parts = [
      ...layer(Math.round(w / 4.5), .07, .15, 2.2, 0),
      ...layer(Math.round(w / 6.5), .12, .24, 3.2, 1),
      ...layer(Math.round(w / 11), .2, .36, 4.6, 2)
    ];
    v.flies = Array.from({ length: 18 }, () => ({ x: rand(0, w), y: rand(h * .35, h * .85), a: rand(0, 6.3), s: rand(.3, 1) }));
  }
  c.clearRect(0, 0, w, h);
  const rise = .6 + v.p * .4;                          // the grass rises into frame as the scene opens
  const PAL = [
    { lo: '#06261b', hi: '#1d7a4a', sun: '#3f9a5c', rib: 'rgba(170,240,150,.18)' },
    { lo: '#052016', hi: '#2a9a56', sun: '#58b86a', rib: 'rgba(190,250,160,.26)' },
    { lo: '#03170f', hi: '#38b461', sun: '#78d27c', rib: 'rgba(210,255,170,.32)' }
  ];
  for (let layer = 0; layer < 3; layer++) {
    const pal = PAL[layer], g = c.createLinearGradient(0, h, 0, h - h * .4 * rise);
    g.addColorStop(0, pal.lo); g.addColorStop(1, pal.hi);
    for (const b of v.parts) {
      if (b.depth !== layer) continue;
      const len = h * b.hgt * rise;
      const wind = Math.sin(t * 1.1 + b.x * .005 + b.ph) * .5 + Math.sin(t * .37 + b.x * .0016) * .8; // ripple + slow gust
      const lean = (b.lean + wind * .22) * len;
      c.fillStyle = b.tint < .12 ? pal.sun : g;          // a few blades catch direct sun
      blade(c, b.x, h + 4, len, b.wid, lean);
      if (layer) { // a faint midrib catches the light on nearer blades
        c.strokeStyle = pal.rib; c.lineWidth = .8; c.beginPath(); c.moveTo(b.x, h); c.quadraticCurveTo(b.x + lean * .28, h - len * .55, b.x + lean * .92, h - len * .94); c.stroke();
      }
    }
  }
  for (const f of v.flies) {
    f.a += .01 * f.s; f.x += Math.cos(f.a * 1.3) * .5; f.y += Math.sin(f.a) * .35;
    if (f.x < 0) f.x = w; if (f.x > w) f.x = 0;
    const glow = .35 + .65 * Math.abs(Math.sin(t * 1.6 + f.a * 3));
    const g = c.createRadialGradient(f.x, f.y, 0, f.x, f.y, 9);
    g.addColorStop(0, `rgba(220,255,170,${.85 * glow})`); g.addColorStop(1, 'rgba(220,255,170,0)');
    c.fillStyle = g; c.beginPath(); c.arc(f.x, f.y, 9, 0, Math.PI * 2); c.fill();
  }
}

function mist(v, c, w, h, t) {
  if (!v.parts.length) v.parts = Array.from({ length: 9 }, (_, i) => ({ y: .35 + i * .07, x: rand(0, 1), r: rand(.25, .5), s: rand(.004, .012) * (i % 2 ? 1 : -1), a: rand(.08, .18) }));
  c.clearRect(0, 0, w, h);
  for (const m of v.parts) {
    m.x += m.s * .1; if (m.x > 1.4) m.x = -.4; if (m.x < -.4) m.x = 1.4;
    const x = m.x * w, y = (m.y - v.p * .18) * h, r = m.r * w;
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(226,240,236,${m.a})`); g.addColorStop(1, 'rgba(226,240,236,0)');
    c.save(); c.translate(x, y); c.scale(1, .28); c.translate(-x, -y); c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); c.restore();
  }
  // a few birds crossing the valley
  c.strokeStyle = 'rgba(20,40,36,.7)'; c.lineWidth = 1.6;
  for (let i = 0; i < 5; i++) {
    const bx = ((t * 26 + i * 170) % (w + 200)) - 100, by = h * (.2 + i * .035) + Math.sin(t + i) * 6, fl = Math.sin(t * 7 + i) * 4;
    c.beginPath(); c.moveTo(bx - 7, by - fl); c.quadraticCurveTo(bx - 3, by - 3, bx, by); c.quadraticCurveTo(bx + 3, by - 3, bx + 7, by - fl); c.stroke();
  }
}
const DRAW = { portal, tree: petals, med: grass, valley: mist };

let running = false, lastY = scrollY;
function loop(now) {
  const t = now / 1000, dy = scrollY - lastY; lastY = scrollY;
  let any = false;
  for (const v of vistas) {
    if (!v.on) continue; any = true;
    v.vel = (v.vel || 0) * .9 + dy * .1;
    v.p = progress(v); applyVars(v);
    const { d, w, h } = sizeCanvas(v), c = v.cv.getContext('2d');
    c.setTransform(d, 0, 0, d, 0, 0);
    DRAW[v.kind](v, c, w, h, t);
  }
  running = any; if (any) requestAnimationFrame(loop);
}
if (!RM && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver(es => {
    es.forEach(e => { const v = vistas.find(x => x.el === e.target); v.on = e.isIntersecting; if (v.on) { v.p = progress(v); applyVars(v); } });
    if (!running && vistas.some(v => v.on)) { running = true; requestAnimationFrame(loop); }
  }, { rootMargin: '100px 0px' });
  vistas.forEach(v => io.observe(v.el));
  addEventListener('resize', () => vistas.forEach(v => { v.parts = []; applyVars(v); }));
} else {
  vistas.forEach(v => { v.p = .5; applyVars(v); });
}

})();
