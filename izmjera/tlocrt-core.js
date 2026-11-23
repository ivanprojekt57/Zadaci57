/* Izmjera 57 — Tlocrt iz skice (jezgra: analiza skice, usklađivanje mjera, DXF).
   Bez sučelja; isti kod radi u aplikaciji i u testovima (Node). */
(function izCore(root) {
'use strict';

/* ---------------- pomoćne funkcije ---------------- */
const hyp = Math.hypot;
const DEG = Math.PI / 180;
function median(a) { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
function rotP(p, a) { const c = Math.cos(a), s = Math.sin(a); return { x: p.x * c - p.y * s, y: p.x * s + p.y * c }; }
function bbox(pts) { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const p of pts) { if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x; if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y; } return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 }; }
function pathLen(pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += hyp(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); return L; }
function distToSeg(p, a, b) { const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1; const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)); return hyp(p.x - a.x - t * dx, p.y - a.y - t * dy); }
/* Ramer–Douglas–Peucker; vraća indekse zadržanih točaka */
function rdpIdx(pts, eps) {
  const n = pts.length; if (n < 3) return n ? [...Array(n).keys()] : [];
  const keep = new Uint8Array(n); keep[0] = keep[n - 1] = 1; const st = [[0, n - 1]];
  while (st.length) { const [a, b] = st.pop(); let md = -1, mi = -1; for (let i = a + 1; i < b; i++) { const d = distToSeg(pts[i], pts[a], pts[b]); if (d > md) { md = d; mi = i; } } if (md > eps) { keep[mi] = 1; st.push([a, mi], [mi, b]); } }
  const out = []; for (let i = 0; i < n; i++) if (keep[i]) out.push(i); return out;
}
function angDiff(a, b) { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }
function fmt(v, dec) { if (!Number.isFinite(v)) return '?'; const d = dec == null ? (Math.abs(v - Math.round(v)) < 0.05 ? 0 : 1) : dec; return v.toFixed(d).replace('.', ','); }
function fmtPct(v) { return (v >= 0 ? '+' : '') + v.toFixed(1).replace('.', ',') + ' %'; }

/* Union-find */
function UF(n) { const p = [...Array(n).keys()]; const f = i => p[i] === i ? i : (p[i] = f(p[i])); return { find: f, union(a, b) { a = f(a); b = f(b); if (a !== b) p[a] = b; } }; }

/* Gaussova eliminacija */
function solveLinear(A, b) {
  const n = b.length; const M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let piv = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    if (Math.abs(M[piv][c]) < 1e-30) continue; [M[c], M[piv]] = [M[piv], M[c]];
    for (let r = 0; r < n; r++) { if (r === c) continue; const f = M[r][c] / M[c][c]; if (!f) continue; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  return M.map((r, i) => Math.abs(r[i]) < 1e-30 ? 0 : r[n] / r[i]);
}

/* ---------------- tumačenje teksta kota ---------------- */
function cleanOcr(t) {
  let s = String(t || '').trim(); if (!s) return '';
  if (/^[ØøΦφϕ∅⌀]$/.test(s)) return 'Ø'; /* v2.63: prekrižena nula = 0 (prozor/vrata uz zid) */
  const digitish = (s.match(/[0-9OoIlSZBgq|]/g) || []).length;
  if (digitish >= Math.max(1, s.replace(/\s/g, '').length * 0.5)) {
    s = s.replace(/[Oo]/g, '0').replace(/[Il|!]/g, '1').replace(/[Zz]/g, '2').replace(/S/g, '5').replace(/B/g, '8').replace(/[gq]/g, '9').replace(/s/g, '5');
  }
  return s.replace(/\s+/g, ' ');
}
function num(s) { const v = parseFloat(String(s).replace(',', '.')); return Number.isFinite(v) ? v : NaN; }
let CM_ONLY = false;
function toCm(v, raw) { return v; } /* v2.12: sve mjere su u cm (i „16,8” = 16,8 cm) – metri izbačeni */
/* Vraća {kind:'mjera'|'otvor'|'parapet'|'debljina'|'nepoznato', ...} */
function parseLabel(text, opt) { if (opt && opt.cm) { CM_ONLY = true; try { return parseLabel(text); } finally { CM_ONLY = false; } }
  const t = cleanOcr(text); if (!t) return { kind: 'nepoznato' };
  let m;
  if (t === 'Ø') return { kind: 'mjera', v: 0, zero: true };
  if (/^0+(?:[.,]0+)?$/.test(t)) return { kind: 'mjera', v: 0, zero: true, plain: true };
  if ((m = /^h\s*[-_]?\s*[g9]r\s*[=:]\s*(\d+(?:[.,]\d+)?)$/i.exec(String(text || '').trim().replace(/\s+/g, ' ')) || /^h\s*[-_]?\s*9r\s*[=:]\s*(\d+(?:[.,]\d+)?)$/i.exec(t))) return { kind: 'hgr', v: num(m[1]) }; /* v2.49: visina od poda do donjeg ruba grede */
  if ((m = /^h\s*[=:]\s*(\d+(?:[.,]\d+)?)$/i.exec(t))) return { kind: 'visina', v: toCm(num(m[1]), m[1]) };
  if ((m = /^p[o0]d\s*[=:]?\s*([+\-–]?\s*\d+(?:[.,]\d+)?)$/i.exec(t))) { const r = m[1].replace(/[–\s]/g, c => c === '–' ? '-' : ''); return { kind: 'pod', v: num(r) }; }
  if ((m = /^[\/\\|1l\-–—_~]{0,2}\s*(d|cl|c1|a)\s*[=:]\s*(\d+(?:[.,]\d+)?)$/i.exec(t)) || (m = /^(d)\s*(\d+(?:[.,]\d+)?)$/i.exec(t))) { const v = toCm(num(m[2]), m[2]); if ((m[1] === 'D' && v >= 100) || v >= 150) return { kind: 'dijagonala', v }; return { kind: 'debljina', t: v }; }
  if ((m = /^n\s*[=:]\s*(\d{1,2})$/i.exec(t)) || (m = /^(\d{1,2})\s*(?:v|vis|x|×)$/i.exec(t))) return { kind: 'stube', n: +m[1] };
  if ((m = /^[<(\[]?\s*(\d+(?:[.,]\d+)?)\s*[x×X*]\s*(\d+(?:[.,]\d+)?)\s*[>)\]]?$/.exec(t))) { const a = toCm(num(m[1]), m[1]), b = toCm(num(m[2]), m[2]); if (a >= 30 && b >= 30) return { kind: 'prostorija', a, b }; }
  if ((m = /^(\d+(?:[.,]\d+)?)\s*\+\s*(\d+(?:[.,]\d+)?)\s*[\/\\]\s*(\d+(?:[.,]\d+)?)/.exec(t))) { /* nesimetrična dvokrilna vrata: 80+40/205 */
    const a = toCm(num(m[1]), m[1]), b = toCm(num(m[2]), m[2]), o = { kind: 'otvor', w: Math.round((a + b) * 10) / 10, h: toCm(num(m[3]), m[3]), split: a / (a + b) };
    const p = /p\s*[=:]?\s*(\d+(?:[.,]\d+)?)/i.exec(t.replace(m[0], ' ')); if (p) o.p = toCm(num(p[1]), p[1]); return o; }
  if ((m = /(\d+(?:[.,]\d+)?)\s*[\/\\]\s*(\d+(?:[.,]\d+)?)/.exec(t))) {
    const o = { kind: 'otvor', w: toCm(num(m[1]), m[1]), h: toCm(num(m[2]), m[2]) };
    const p = /p\s*[=:]?\s*(\d+(?:[.,]\d+)?)/i.exec(t.replace(m[0], ' ')); if (p) o.p = toCm(num(p[1]), p[1]);
    return o;
  }
  if ((m = /^p\s*[=:]?\s*(\d+(?:[.,]\d+)?)$/i.exec(t))) return { kind: 'parapet', p: toCm(num(m[1]), m[1]) };
  const d = t.replace(/[<>()\[\]{}←→↔\-–—_~^"'`.,]+$/g, '').replace(/^[<>()\[\]{}←→↔\-–—_~^"'`]+/g, '').trim();
  if (/^\d+(?:[.,]\d+)?(?:\s*\+\s*\d+(?:[.,]\d+)?)+$/.test(d)) { // 30+124 = jedna mjera, zbroj dijelova
    const parts = d.split('+').map(x => x.trim()).map(x => toCm(num(x), x)); const v = Math.round(parts.reduce((a, b) => a + b, 0) * 10) / 10; if (v > 0) return { kind: 'mjera', v, parts }; }
  if ((m = /^(\d+(?:[.,]\d+)?)$/.exec(d))) { const v = toCm(num(m[1]), m[1]); if (v >= 10) return { kind: 'mjera', v }; if (v > 0) return { kind: 'nepoznato', guess: v }; }
  if ((m = /(\d{2,4}(?:[.,]\d+)?)/.exec(t))) { const v = toCm(num(m[1]), m[1]); if (v > 0) return { kind: 'mjera', v, uncertain: true }; }
  return { kind: 'nepoznato' };
}

/* ---------------- 1. ANALIZA SKICE ---------------- */
const isStBlk = o => !!(o && o.blk && (o.blk.t === 'stube' || /^(krovni|otvorp|terasa|greda|prag|stup)$/.test(o.blk.t || '') || o.blk.bk || o.blk.kl || (o.blk.t === 'vrata' && o.blk.main) || (!o.blk.t && o.blk.id && !o.blk.main && o.type !== 'text'))); /* v2.05: i vrata iz bloka – otvor, krilo i luk idu izravno iz postavki bloka (ne prepoznaju se iz crta) */ /* + otvor bez krila (crtice špaleta) – otvor se dodaje izravno iz bloka */ /* stubište iz bloka 🪜 nije zid – crta se iz svojih postavki */
function strokesOf(items, layer) {
  return (items || []).filter(o => o && o.layer === layer && o.type !== 'text' && Array.isArray(o.pts) && o.pts.length > 1 && !isStBlk(o))
    .map(o => o.pts.map(p => ({ x: +p.x, y: +p.y })));
}
function dominantAngle(strokes, eps) {
  const segs = [];
  for (const st of strokes) { const id = rdpIdx(st, eps); for (let i = 1; i < id.length; i++) { const a = st[id[i - 1]], b = st[id[i]], L = hyp(b.x - a.x, b.y - a.y); if (L > eps) segs.push({ a: Math.atan2(b.y - a.y, b.x - a.x), L }); } }
  let th = 0;
  for (let it = 0; it < 3; it++) {
    let C = 0, S = 0;
    for (const s of segs) { if (it > 0) { const d = Math.abs(angDiff(4 * s.a, 4 * th)) / 4; if (d > 15 * DEG) continue; } C += s.L * s.L * Math.cos(4 * s.a); S += s.L * s.L * Math.sin(4 * s.a); }
    if (C || S) th = Math.atan2(S, C) / 4;
  }
  return th;
}

/* ---------- stubište iz bloka: geometrija u lokalnim cm (u = smjer penjanja prvog kraka, v = strana okreta) ---------- */
const ST_DEF = { vrsta: 'ravno', b: 90, n: 17, g: 27, oko: 10, D: 160, d0: 20, kut: 360, okret: 1 };
function stairGeo(P0) {
  const P = Object.assign({}, ST_DEF), q = P0 || {}; for (const k in q) if (q[k] != null && q[k] !== '') P[k] = q[k];
  const nn = v => { const x = parseFloat(String(v).replace(',', '.')); return Number.isFinite(x) ? x : NaN; };
  const b = Math.max(40, nn(P.b) || 90); let g = Math.max(15, nn(P.g) || 27), n = Math.max(2, Math.round(nn(P.n) || 17)), t = n - 1; const sg = nn(P.okret) < 0 ? -1 : 1, oko = Math.max(0, nn(P.oko) || 0);
  const V = (u, v) => ({ u, v: v * sg }), segs = [], S = (a, c) => segs.push([V(a[0], a[1]), V(c[0], c[1])]);
  const steps = (k0, k1, f) => { for (let k = k0; k <= k1; k++) f(k); };
  const runs = []; let arrow = [], txtAt = null, n1 = nn(P.n1), vr = P.vrsta;
  const n2 = nn(P.n2); /* gazišta u 2. kraku: ako su zadana oba kraka, broj visina = 1. + zavojne + 2. + 1 */
  const fix = w => { if (Number.isFinite(n2) && n2 >= 1) { const a = Number.isFinite(n1) && n1 >= 0 ? Math.round(n1) : Math.round(n2); t = a + w + Math.round(n2); n = t + 1; } };
  const winders = (pv, e0, e1, box, cnt) => { // zavojne stube (trokuti): zrake iz unutarnjeg kuta, jednaki kutovi od ulaznog prema izlaznom rubu
    const N = Math.max(2, cnt || 3), phs = []; for (let k = 1; k < N; k++) phs.push(Math.PI / 2 * k / N);
    for (const ph of phs) { const d = [e0[0] * Math.cos(ph) + e1[0] * Math.sin(ph), e0[1] * Math.cos(ph) + e1[1] * Math.sin(ph)]; let tt = Infinity;
      for (const [ax, val] of box) { const dd = d[ax]; if (Math.abs(dd) < 1e-9) continue; const t2 = (val - pv[ax]) / dd; if (t2 > 1e-6 && t2 < tt) tt = t2; }
      if (Number.isFinite(tt)) S(pv, [pv[0] + d[0] * tt, pv[1] + d[1] * tt]); } };
  if (vr === 'spiralno') {
    const R = Math.max(60, nn(P.D) || 160) / 2, r0 = Math.max(0, (nn(P.d0) || 20) / 2), kut = Math.max(90, Math.min(720, nn(P.kut) || 360)) * Math.PI / 180, da = kut / Math.max(1, t);
    const pt = (r, a) => [r * Math.cos(a), r * Math.sin(a)];
    for (let k = 0; k <= t; k++) S(pt(r0, k * da), pt(R, k * da));
    const arc = (r, a0, a1) => { const m = Math.max(8, Math.ceil(Math.abs(a1 - a0) / 0.12)); for (let i = 0; i < m; i++) S(pt(r, a0 + (a1 - a0) * i / m), pt(r, a0 + (a1 - a0) * (i + 1) / m)); };
    arc(R, 0, kut); if (r0 > 1) arc(r0, 0, Math.PI * 2);
    const rm = (r0 + R) / 2, am = Math.max(8, Math.ceil(kut / 0.12)); for (let i = 0; i <= am; i++) arrow.push(V(...pt(rm, kut * i / am)));
    txtAt = V(...pt(rm, kut / 2));
  } else if (vr === 'ravno' || !vr) {
    if (nn(P.L1) > 0 && t > 0) g = nn(P.L1) / t; /* duljina kraka ÷ broj gazišta */
    const L1 = t * g; steps(0, t, k => S([k * g, -b / 2], [k * g, b / 2])); S([0, -b / 2], [L1, -b / 2]); S([0, b / 2], [L1, b / 2]);
    arrow = [V(0, 0), V(L1, 0)]; runs.push({ o: V(0, 0), d: V(1, 0), n: t + 1, k0: 0 }); txtAt = V(L1 / 2, 0);
  } else if (vr === 'L' || vr === 'L3') {
    const w3 = vr === 'L3', nz = w3 ? Math.max(2, Math.min(8, Math.round(nn(P.nz)) || 3)) : 1; fix(nz); const rest = t - nz; let t1 = Number.isFinite(n1) && n1 >= 0 && n1 < rest ? Math.round(n1) : Math.floor(rest / 2); const t2 = Math.max(1, rest - t1); if (nn(P.L1) > 0 && t1 > 0) g = nn(P.L1) / t1; else if (nn(P.L2) > 0) g = nn(P.L2) / t2; const L1 = t1 * g;
    steps(0, t1, k => S([k * g, -b / 2], [k * g, b / 2])); S([0, -b / 2], [L1, -b / 2]); S([0, b / 2], [L1, b / 2]);
    S([L1 + b, -b / 2], [L1 + b, b / 2]); S([L1, -b / 2], [L1 + b, -b / 2]); // vanjski rub kuta
    steps(0, t2, k => S([L1, b / 2 + k * g], [L1 + b, b / 2 + k * g])); S([L1, b / 2], [L1, b / 2 + t2 * g]); S([L1 + b, b / 2], [L1 + b, b / 2 + t2 * g]);
    if (w3) winders([L1, b / 2], [0, -1], [1, 0], [[0, L1 + b], [1, -b / 2]], nz);
    arrow = [V(0, 0), V(L1 + b / 2, 0), V(L1 + b / 2, b / 2 + t2 * g)];
    runs.push({ o: V(0, 0), d: V(1, 0), n: t1 + 1, k0: 0 }, { o: V(L1 + b / 2, b / 2), d: V(0, 1), n: t2 + 1, k0: t1 + nz }); txtAt = V(L1 / 2, 0);
  } else { // U i U3: povratno stubište, drugi krak usporedno natrag
    const w3 = vr === 'U3', mid = w3 && oko >= 15 ? 1 : 0; fix(w3 ? 6 + mid : 1); const rest = t - (w3 ? 6 + mid : 1); let t1 = Number.isFinite(n1) && n1 >= 0 && n1 < rest ? Math.round(n1) : Math.floor(rest / 2); { const t2x = Math.max(1, rest - t1); if (nn(P.L1) > 0 && t1 > 0) g = nn(P.L1) / t1; else if (nn(P.L2) > 0) g = nn(P.L2) / t2x; } const t2 = Math.max(1, rest - t1), L1 = t1 * g, c2 = b + oko, vTop = 1.5 * b + oko;
    steps(0, t1, k => S([k * g, -b / 2], [k * g, b / 2])); S([0, -b / 2], [L1, -b / 2]); S([0, b / 2], [L1, b / 2]);
    steps(0, t2, k => S([L1 - k * g, b / 2 + oko], [L1 - k * g, vTop])); S([L1 - t2 * g, b / 2 + oko], [L1, b / 2 + oko]); S([L1 - t2 * g, vTop], [L1, vTop]);
    S([L1 + b, -b / 2], [L1 + b, vTop]); S([L1, -b / 2], [L1 + b, -b / 2]); S([L1, vTop], [L1 + b, vTop]);
    if (w3) { S([L1, b / 2], [L1 + b, b / 2]); if (oko > 0) S([L1, b / 2 + oko], [L1 + b, b / 2 + oko]);
      winders([L1, b / 2], [0, -1], [1, 0], [[0, L1 + b], [1, -b / 2]]); winders([L1, b / 2 + oko], [1, 0], [0, 1], [[0, L1 + b], [1, vTop]]); }
    arrow = [V(0, 0), V(L1 + b / 2, 0), V(L1 + b / 2, c2), V(L1 - t2 * g, c2)];
    runs.push({ o: V(0, 0), d: V(1, 0), n: t1 + 1, k0: 0 }, { o: V(L1, c2), d: V(-1, 0), n: t2 + 1, k0: t1 + (w3 ? 6 + mid : 1) }); txtAt = V(L1 / 2, 0);
  }
  const H = nn(P.H), h = H > 0 ? H / n : NaN;
  const text = n + ' vis.' + (h > 0 ? ' × ' + fmt(h, 1) : '') + ' / ' + (vr === 'spiralno' ? '' : 'gaz. ' + fmt(g, 1));
  return { segs, arrow, runs, text, txtAt, n, g, b, h, H: H > 0 ? H : null };
}
/* v2.35: prikaz stubišta po etaži – presjek (do crte presjeka puno, dalje crtkano) ili cijelo; na etaži gdje se sastaju dva stubišta skriva se što bi se preklapalo */
function stairMode(P, iz) { const v = P && P.prikaz; return v === 'presjek' || v === 'cijelo' ? v : (iz ? 'cijelo' : 'presjek'); }
function stairShape(P0) { const G = stairGeo(P0), A = G.arrow, cum = [0]; for (let i = 1; i < A.length; i++) cum.push(cum[i - 1] + Math.hypot(A[i].u - A[i - 1].u, A[i].v - A[i - 1].v)); const Lar = cum.at(-1) || 0;
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity; for (const [a, b] of G.segs) for (const q of [a, b]) { u0 = Math.min(u0, q.u); u1 = Math.max(u1, q.u); v0 = Math.min(v0, q.v); v1 = Math.max(v1, q.v); }
  const t = Math.max(1, G.n - 1), ncv = parseFloat(String((P0 && P0.nc) != null ? P0.nc : '').replace(',', '.')), nc = Math.max(1, Math.min(t - 1, Math.round(Number.isFinite(ncv) ? ncv : 5)));
  const leg0 = cum[1] || 0, sCut = (nc + 0.5) * G.g <= leg0 - 1 && (P0 && P0.vrsta) !== 'spiralno' ? (nc + 0.5) * G.g : Lar * (nc + 0.5) / t;
  const param = q => { let bd = Infinity, bs = 0; for (let i = 1; i < A.length; i++) { const a = A[i - 1], b = A[i], du = b.u - a.u, dv = b.v - a.v, l2 = du * du + dv * dv || 1; let k = ((q.u - a.u) * du + (q.v - a.v) * dv) / l2; k = Math.max(0, Math.min(1, k)); const pu = a.u + k * du, pv = a.v + k * dv, d = Math.hypot(q.u - pu, q.v - pv); if (d < bd - 1e-6) { bd = d; bs = cum[i - 1] + k * Math.sqrt(l2); } } return bs; };
  const at = s => { for (let i = 1; i < A.length; i++) if (s <= cum[i] || i === A.length - 1) { const a = A[i - 1], b = A[i], l = (cum[i] - cum[i - 1]) || 1, k = Math.max(0, Math.min(1, (s - cum[i - 1]) / l)); return { p: { u: a.u + k * (b.u - a.u), v: a.v + k * (b.v - a.v) }, d: { u: (b.u - a.u) / l, v: (b.v - a.v) / l } }; } return { p: { u: 0, v: 0 }, d: { u: 1, v: 0 } }; };
  const inBox = q => q.u >= u0 - 2 && q.u <= u1 + 2 && q.v >= v0 - 2 && q.v <= v1 + 2;
  return { G, Lar, sCut, nc, param, at, inBox }; }
/* others: [{ mode, sh: stairShape, fromW: w → {u,v} }] ostala stubišta na istoj etaži; toW: {u,v} → svijet */
function stairView(P0, mode, toW, others) { const sh = stairShape(P0), G = sh.G, oth = others || [], cut = mode === 'presjek';
  const hid = w => mode === 'cijelo' && oth.some(o => o.mode === 'presjek' && (() => { const q = o.fromW(w); return o.sh.inBox(q) && o.sh.param(q) <= o.sh.sCut; })());
  const dashOff = w => oth.some(o => o.mode === 'cijelo' && o.sh.inBox(o.fromW(w)));
  const cls = q => { const w = toW(q); if (hid(w)) return 0; if (cut && sh.param(q) > sh.sCut) return dashOff(w) ? 0 : 2; return 1; };
  const solid = [], dash = [], pieces = (a, b, step, out) => { const l = Math.hypot(b.u - a.u, b.v - a.v), n = Math.max(1, Math.ceil(l / step)); let cur = null, st = a;
    for (let i = 0; i < n; i++) { const p0 = { u: a.u + (b.u - a.u) * i / n, v: a.v + (b.v - a.v) * i / n }, p1 = { u: a.u + (b.u - a.u) * (i + 1) / n, v: a.v + (b.v - a.v) * (i + 1) / n }, c = cls({ u: (p0.u + p1.u) / 2, v: (p0.v + p1.v) / 2 });
      if (c !== cur) { if (cur != null) out(cur, st, p0); cur = c; st = p0; } }
    out(cur, st, b); };
  for (const [a, b] of G.segs) pieces(a, b, 4, (c, p, q) => { if (c === 1) solid.push([p, q]); else if (c === 2) dash.push([p, q]); });
  /* strelica uvijek u smjeru penjanja; kod presjeka završava na crti presjeka */
  const arrows = []; { const A = G.arrow; if (A.length > 1) { let poly = [];
    const flush = () => { if (poly.length > 1) arrows.push(poly); poly = []; };
    const sEnd = cut ? sh.sCut : sh.Lar, N = Math.max(2, Math.ceil(sEnd / 4)); for (let i = 0; i <= N; i++) { const s = sEnd * i / N, p = sh.at(s).p; if (!cut && hid(toW(p))) { flush(); continue; } poly.push(p); } flush();
    for (const a of arrows) { /* pojednostavi: zadrži samo lomove */ const r = [a[0]]; for (let i = 1; i < a.length - 1; i++) { const p = r.at(-1), q = a[i], n2 = a[i + 1], c = (q.u - p.u) * (n2.v - q.v) - (q.v - p.v) * (n2.u - q.u); if (Math.abs(c) > 0.5) r.push(q); } r.push(a.at(-1)); a.splice(0, a.length, ...r); } } }
  const headAt = arrows.length && (cut || !hid(toW(sh.at(sh.Lar).p))) ? arrows.length - 1 : -1;
  const dot = G.arrow.length && !hid(toW(G.arrow[0])) ? G.arrow[0] : null;
  let brk = null; if (cut) { const { p, d } = sh.at(sh.sCut), n = { u: -d.v, v: d.u }, hw = G.b / 2 + 4, P = (s, t) => ({ u: p.u + d.u * s + n.u * t, v: p.v + d.v * s + n.v * t }); brk = [P(-6, -hw), P(-1, -4), P(-6, 1), P(2, 4), P(6, hw)]; }
  return { solid, dash, arrows, headAt, dot, brk, sh }; }
/* v2.37: daleki ostaci crteža (zaboravljeni pravokutnik daleko od kuće, bez kota) ne smiju napuhati mjerilo tolerancija.
   Vraća indekse poteza glavne skupine: skupina s najviše kota (ili najdulja), plus sve što joj je blizu (do pola njezine veličine). */
function mainStrokeIdx(strokes, labelPts) {
  const n = strokes.length, all = strokes.map((_, i) => i); if (n < 3) return { idx: all, far: 0 };
  const bbs = strokes.map(s => bbox(s)), len = strokes.map(pathLen);
  const gap = (a, b) => Math.hypot(Math.max(0, a.x0 - b.x1, b.x0 - a.x1), Math.max(0, a.y0 - b.y1, b.y0 - a.y1));
  const box = idx => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const i of idx) { const b = bbs[i]; if (b.x0 < x0) x0 = b.x0; if (b.y0 < y0) y0 = b.y0; if (b.x1 > x1) x1 = b.x1; if (b.y1 > y1) y1 = b.y1; } return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 }; };
  let keep = all, far = 0; /* far: daleke crte bez ijedne kote – za napomenu u izvještaju */
  for (let iter = 0; iter < 4; iter++) {
    const B = box(keep), g = Math.max(B.w, B.h, 1) * 0.12, par = new Map(keep.map(i => [i, i])), find = i => { while (par.get(i) !== i) { par.set(i, par.get(par.get(i))); i = par.get(i); } return i; };
    for (let a = 0; a < keep.length; a++) for (let b = a + 1; b < keep.length; b++) if (gap(bbs[keep[a]], bbs[keep[b]]) <= g) { const ra = find(keep[a]), rb = find(keep[b]); if (ra !== rb) par.set(ra, rb); }
    const comp = new Map(); for (const i of keep) { const r = find(i); if (!comp.has(r)) comp.set(r, []); comp.get(r).push(i); }
    if (comp.size < 2) break;
    const cs = [...comp.values()].map(idx => { const b = box(idx), m = Math.max(b.w, b.h, 1) * 0.1; return { idx, b, L: idx.reduce((q, i) => q + len[i], 0), lab: (labelPts || []).filter(p => p.x >= b.x0 - m && p.x <= b.x1 + m && p.y >= b.y0 - m && p.y <= b.y1 + m).length }; });
    cs.sort((a, b) => (b.lab - a.lab) || (b.L - a.L)); const main = cs[0], Dm = Math.max(main.b.w, main.b.h, 1);
    const near = c => c === main || gap(c.b, main.b) <= 0.5 * Dm, next = cs.filter(near).flatMap(c => c.idx);
    if (next.length === keep.length) break; for (const c of cs) if (!near(c) && !c.lab) far += c.idx.length; keep = next;
  }
  return { idx: keep.slice().sort((a, b) => a - b), far };
}
function analyze(floor, opts) {
  opts = opts || {};
  const items = floor.items || [];
  const raw = { nacrt: strokesOf(items, 'nacrt'), kote: strokesOf(items, 'kote'), opisi: strokesOf(items, 'opisi'), pogled: strokesOf(items, 'pogled') };
  const texts = items.filter(o => o && o.type === 'text' && o.layer !== 'biljeske' && Number.isFinite(o.x) && Number.isFinite(o.y));
  /* v2.69: prozor/vrata s udaljenošću 0 od ugla (iz postavki bloka) nema napisanu kotu – dodaj nevidljivu „0” od ugla do ruba otvora, inače se otvor postavi samo po skici (i dva prozora se preklope) */
  const syn0 = new Set(); { const hasPin = new Set(texts.filter(t => t.blk && t.pin).map(t => t.blk.id));
    for (const o of items) { const B = o && o.blk; if (!B || !B.main || !(B.t === 'prozor' || B.t === 'vrata') || B.od !== 0 || !B.end || B.odNb || !B.odP || !B.c || hasPin.has(B.id)) continue;
      const dx = B.c.x - B.odP.x, dy = B.c.y - B.odP.y, L = Math.hypot(dx, dy); if (!(L > 0.5)) continue; const k = Math.min(1, L / 4) / L, bP = { x: B.odP.x + dx * k, y: B.odP.y + dy * k };
      const t = { type: 'text', layer: 'kote', x: B.odP.x - 5, y: B.odP.y + 7, text: '0', blk: { id: B.id }, pin: { a: { x: B.odP.x, y: B.odP.y }, b: bP, outer: !!B.odOut }, syn0: true }; texts.push(t); syn0.add(B.id); } }
  const allN = raw.nacrt.flat();
  if (allN.length < 2) throw Error('Na sloju Nacrt nema nacrtanih zidova.');
  const labPts = texts.map(t => ({ x: t.x, y: t.y })).concat(raw.kote.filter(st => st.length).map(st => { const b = bbox(st); return { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 }; }));
  const mainSet = mainStrokeIdx(raw.nacrt, labPts), mainIdx = mainSet.idx, far = mainSet.far; /* v2.37: mjerilo tolerancija samo iz glavne skupine crta */
  const bb0 = bbox(mainIdx.flatMap(i => raw.nacrt[i])), D0 = Math.max(bb0.w, bb0.h, 1);
  const theta = dominantAngle(raw.nacrt, D0 * 0.012);
  const R = p => rotP(p, -theta);
  const sk = { nacrt: raw.nacrt.map(s => s.map(R)), kote: raw.kote.map(s => s.map(R)), opisi: raw.opisi.map(s => s.map(R)), pogled: raw.pogled.map(s => s.map(R)) };
  const nb = bbox(mainIdx.flatMap(i => sk.nacrt[i])), D0b = Math.max(nb.w, nb.h, 1);
  /* v2.61: kod jako dugih zgrada (hangar, niz prostorija) mjerilo iz najduže stranice daje preveliku toleranciju –
     zidovi metar jedan od drugoga se stapaju, a razmaci postaju golema vrata. Ograniči je veličinom rukom pisanih brojeva. */
  const glyphSz = (() => { const v = sk.kote.filter(st => st.length > 1).map(st => { const b = bbox(st); return Math.max(b.w, b.h); }).filter(x => x > 0 && x < 0.08 * D0b); return v.length >= 8 ? median(v) : 0; })();
  /* bez rukom pisanih kota (sve nacrtano alatom Linija): najmanji razmak paralelnih ravnih zidova koji se preklapaju */
  const lineGap = (() => { if (glyphSz) return 0; const L = sk.nacrt.map(st => { const p = st[0], q = st[st.length - 1], dx = q.x - p.x, dy = q.y - p.y, len = hyp(dx, dy); if (len < 0.04 * D0b) return null; for (let k = 1; k < st.length - 1; k += Math.max(1, st.length >> 4)) if (distToSeg(st[k], p, q) > 0.01 * len + 0.5) return null;
      if (Math.abs(dy) < 0.02 * len) return { o: 'H', c: (p.y + q.y) / 2, a0: Math.min(p.x, q.x), a1: Math.max(p.x, q.x) }; if (Math.abs(dx) < 0.02 * len) return { o: 'V', c: (p.x + q.x) / 2, a0: Math.min(p.y, q.y), a1: Math.max(p.y, q.y) }; return null; }).filter(Boolean);
    if (L.length < 6) return 0;
    const lenAll = sk.nacrt.reduce((t, st) => t + pathLen(st), 0), lenL = L.reduce((t, l) => t + l.a1 - l.a0, 0); if (lenL < 0.8 * lenAll) return 0; /* samo kad je skica (skoro) sva crtana ravnalom */
    let g = Infinity;
    for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) { const A = L[i], B = L[j]; if (A.o !== B.o) continue; const d = Math.abs(A.c - B.c), ov = Math.min(A.a1, B.a1) - Math.max(A.a0, B.a0); if (d > 0.002 * D0b && ov > -0.1 * D0b && d < g) g = d; }
    return g < Infinity ? g : 0; })();
  const D = glyphSz ? Math.min(D0b, Math.max(glyphSz / 0.012, D0b * 0.25)) : lineGap ? Math.min(D0b, Math.max(lineGap * 20, D0b * 0.1)) : D0b;
  const E = Math.max(3, D * 0.012);           // tolerancija skice
  const maxGap = D * 0.3;                      // najveći otvor u zidu

  /* --- rastavljanje poteza na ravne dijelove i lukove --- */
  const segs = [], arcs = [], diag = [], circles = [];
  // sloj Pogled (balkon, terasa, vanjske stube): ide istim ravnanjem, ali postaje linija, ne zid
  const winBlk = new Map(), doorBlk = new Set(), zubK = new Map(), zubG = new Map(); /* zubK: potez označen alatom Zub/niša → 'izb' (izbočenje: stup, dimnjak) ili 'nisa' */ (items || []).filter(o => o && o.layer === 'nacrt' && o.type !== 'text' && Array.isArray(o.pts) && o.pts.length > 1 && !isStBlk(o)).forEach((o, i) => { if (o.blk && o.blk.t === 'prozor') winBlk.set(i, o.blk.id || i); if (o.blk && !o.blk.t && o.blk.id) doorBlk.add(i); if (o.blk && o.blk.t === 'vrata') doorBlk.add(i); if (o.zub) { zubK.set(i, o.zub); if (o.zubId) zubG.set(i, o.zubId); } });
  const strokesAll = sk.nacrt.map(st => ({ st, view: false })).concat(sk.pogled.map(st => ({ st, view: true })));
  strokesAll.forEach(({ st, view }, si) => {
    if (pathLen(st) < E * 0.8) return;
    { // zatvoreni mali krug = simbol (dimnjak), ne zid
      const b = bbox(st), sz = Math.max(b.w, b.h), cl = hyp(st[0].x - st.at(-1).x, st[0].y - st.at(-1).y);
      const fi = rdpIdx(st, Math.max(1, sz * 0.05)); let turn = 0;
      for (let k = 1; k < fi.length - 1; k++) { const a = st[fi[k - 1]], q = st[fi[k]], c = st[fi[k + 1]]; turn += angDiff(Math.atan2(c.y - q.y, c.x - q.x), Math.atan2(q.y - a.y, q.x - a.x)); }
      if (sz < 0.15 * D && cl < 0.35 * sz && Math.abs(turn) > 260 * DEG && Math.min(b.w, b.h) > 0.5 * sz) { circles.push({ pts: st, c: { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 }, r: sz / 2, view }); return; }
    }
    const fine = rdpIdx(st, E * 0.35);
    // rez na oštrim kutovima
    const cuts = [0];
    for (let k = 1; k < fine.length - 1; k++) {
      const a = st[fine[k - 1]], b = st[fine[k]], c = st[fine[k + 1]];
      const t = Math.abs(angDiff(Math.atan2(c.y - b.y, c.x - b.x), Math.atan2(b.y - a.y, b.x - a.x)));
      if (t > 55 * DEG) cuts.push(k);
    }
    cuts.push(fine.length - 1);
    for (let q = 0; q < cuts.length - 1; q++) {
      let fi = fine.slice(cuts[q], cuts[q + 1] + 1), fi0 = null; const pts = st.slice(fi[0], fi[fi.length - 1] + 1);
      if (pts.length < 2) continue;
      // mali, pravilan luk (npr. krilo dvokrilnih vrata) grubo pojednostavljenje svede na 3 točke – provjeri ga finije
      if (fi.length === 3 && pts.length >= 12 && doorBlk.has(si)) { const off = fi[0], f2 = rdpIdx(pts, E * 0.12).map(k => k + off); if (f2.length >= 5) { const ch = hyp(pts[0].x - pts.at(-1).x, pts[0].y - pts.at(-1).y); let sg = 0; for (const z of pts) sg = Math.max(sg, distToSeg(z, pts[0], pts.at(-1))); if (ch > E * 1.5 && sg > ch * 0.15) { fi0 = fi; fi = f2; } } }
      // je li luk?
      if (fi.length >= 4) {
        let sum = 0, abs = 0;
        for (let k = 1; k < fi.length - 1; k++) { const a = st[fi[k - 1]], b = st[fi[k]], c = st[fi[k + 1]]; const t = angDiff(Math.atan2(c.y - b.y, c.x - b.x), Math.atan2(b.y - a.y, b.x - a.x)); sum += t; abs += Math.abs(t); }
        const chord = hyp(pts[0].x - pts.at(-1).x, pts[0].y - pts.at(-1).y);
        let sag = 0; for (const p of pts) sag = Math.max(sag, distToSeg(p, pts[0], pts.at(-1)));
        let maxSeg = 0; for (let k = 1; k < fi.length; k++) maxSeg = Math.max(maxSeg, hyp(st[fi[k]].x - st[fi[k - 1]].x, st[fi[k]].y - st[fi[k - 1]].y));
        // grubo pojednostavljenje može luk prikazati jednim dugim komadom: provjeri finije ako je luk izrazito zakrivljen
        if (maxSeg >= 0.45 * pathLen(pts) && sag > chord * 0.14) { const ff = rdpIdx(pts, E * 0.15); let m2 = 0, s2 = 0, a2 = 0; for (let k = 1; k < ff.length; k++) m2 = Math.max(m2, hyp(pts[ff[k]].x - pts[ff[k - 1]].x, pts[ff[k]].y - pts[ff[k - 1]].y)); for (let k = 1; k < ff.length - 1; k++) { const p0 = pts[ff[k - 1]], p1 = pts[ff[k]], p2 = pts[ff[k + 1]]; const t = angDiff(Math.atan2(p2.y - p1.y, p2.x - p1.x), Math.atan2(p1.y - p0.y, p1.x - p0.x)); s2 += t; a2 += Math.abs(t); } if (m2 < 0.45 * pathLen(pts) && Math.abs(s2) > 45 * DEG && Math.abs(s2) > 0.8 * a2) { maxSeg = m2; sum = s2; abs = a2; } }
        if (maxSeg < 0.45 * pathLen(pts) && Math.abs(sum) > 40 * DEG && Math.abs(sum) > 0.75 * abs && chord > E * 1.5 && sag > chord * 0.12 && pathLen(pts) < D * 0.65) { arcs.push({ pts, stroke: si, view }); continue; }
      }
      if (fi0) fi = fi0; /* nije luk: dalje s običnim pojednostavljenjem */
      // vrata nacrtana jednim potezom (krilo + luk, ponekad i crta uz zid): odreži ravne krajeve i provjeri je li ostatak luk
      if (fi.length >= 5) {
        const arcOf = f => { if (f.length < 4) return null; const p2 = st.slice(f[0], f.at(-1) + 1); let sm = 0, ab = 0, mx = 0;
          for (let k = 1; k < f.length - 1; k++) { const a = st[f[k - 1]], b = st[f[k]], c = st[f[k + 1]]; const t = angDiff(Math.atan2(c.y - b.y, c.x - b.x), Math.atan2(b.y - a.y, b.x - a.x)); sm += t; ab += Math.abs(t); }
          for (let k = 1; k < f.length; k++) mx = Math.max(mx, hyp(st[f[k]].x - st[f[k - 1]].x, st[f[k]].y - st[f[k - 1]].y));
          const ch = hyp(p2[0].x - p2.at(-1).x, p2[0].y - p2.at(-1).y); let sg = 0; for (const q of p2) sg = Math.max(sg, distToSeg(q, p2[0], p2.at(-1)));
          return mx < 0.45 * pathLen(p2) && Math.abs(sm) > 40 * DEG && Math.abs(sm) > 0.75 * ab && ch > E * 1.5 && sg > ch * 0.12 && pathLen(p2) < D * 0.65 ? { p2, ch } : null; };
        let dn = null;
        for (let a0 = 0; a0 <= 2 && !dn; a0++) for (let b0 = 0; b0 <= 2 && !dn; b0++) { if (!a0 && !b0) continue; const f = fi.slice(a0, fi.length - b0), r = arcOf(f); if (!r) continue;
          const head = st.slice(fi[0], f[0] + 1), tail = st.slice(f.at(-1), fi.at(-1) + 1), okL = x => x.length < 2 || pathLen(x) <= 1.4 * r.ch;
          if (okL(head) && okL(tail)) dn = r; }
        if (dn) { arcs.push({ pts: dn.p2, stroke: si, view }); continue; } // krilo vrata nije zid
      }
      const co = rdpIdx(pts, E);
      // dijelovi istog smjera unutar jednog poteza = jedan zid (potez nacrtan malo nakrivo)
      const parts = [];
      for (let k = 1; k < co.length; k++) {
        const i0 = co[k - 1], i1 = co[k], a = pts[i0], b = pts[i1];
        const L = hyp(b.x - a.x, b.y - a.y);
        const ang = Math.atan2(b.y - a.y, b.x - a.x);
        const dh = Math.abs(angDiff(2 * ang, 0)) / 2, dv = Math.abs(angDiff(2 * ang, Math.PI)) / 2;
        const o = dh < 20 * DEG ? 'H' : dv < 20 * DEG ? 'V' : 'D';
        const prev = parts.at(-1);
        if (prev && o !== 'D' && (prev.o === o || (L < E * 1.2 && prev.o !== 'D'))) { prev.i1 = i1; continue; }
        if (prev && o === 'D' && L < E * 1.2 && prev.o !== 'D') { prev.i1 = i1; continue; }
        parts.push({ o, i0, i1 });
      }
      for (const pr of parts) {
        const part = pts.slice(pr.i0, pr.i1 + 1), a = part[0], b = part.at(-1);
        const L = hyp(b.x - a.x, b.y - a.y); if (L < E * 1.2) continue;
        if (pr.o === 'H') segs.push({ o: 'H', c: part.reduce((s, p) => s + p.y, 0) / part.length, a0: Math.min(a.x, b.x), a1: Math.max(a.x, b.x), stroke: si, p0: a, p1: b, view });
        else if (pr.o === 'V') segs.push({ o: 'V', c: part.reduce((s, p) => s + p.x, 0) / part.length, a0: Math.min(a.y, b.y), a1: Math.max(a.y, b.y), stroke: si, p0: a, p1: b, view });
        else { part.view = view; part.stroke = si; diag.push(part); }
      }
    }
  });
  /* v1.45: simbol vrata nacrtan kao dva poteza (krilo + luk). Krilo (kratka ravna crta koja se dodiruje s lukom) nije zid;
     spljošten luk koji se raspao na kosi dio i kratku ravnu crtu ipak je luk ako ga dodiruje krilo. */
  { const segEndPts = sg => sg.o === 'H' ? [{ x: sg.a0, y: sg.c }, { x: sg.a1, y: sg.c }] : [{ x: sg.c, y: sg.a0 }, { x: sg.c, y: sg.a1 }];
    const near = (p, q, t) => hyp(p.x - q.x, p.y - q.y) < t;
    const arcStrokes = new Set(arcs.map(a => a.stroke));
    const dStrokes = new Set(diag.map(d => d.stroke));
    for (const si of dStrokes) { if (arcStrokes.has(si) || strokesAll[si].view) continue; const st = strokesAll[si].st, b = bbox(st); if (Math.max(b.w, b.h) > 0.16 * D) continue;
      const ch = hyp(st[0].x - st.at(-1).x, st[0].y - st.at(-1).y); if (ch < 1.5 * E) continue; let sg = 0; for (const q of st) sg = Math.max(sg, distToSeg(q, st[0], st.at(-1))); if (sg < 0.15 * ch) continue;
      const fi = rdpIdx(st, E * 0.35); let sm = 0, ab = 0; for (let k = 1; k < fi.length - 1; k++) { const a = st[fi[k - 1]], q = st[fi[k]], c = st[fi[k + 1]]; const t = angDiff(Math.atan2(c.y - q.y, c.x - q.x), Math.atan2(q.y - a.y, q.x - a.x)); sm += t; ab += Math.abs(t); }
      if (Math.abs(sm) < 45 * DEG || Math.abs(sm) < 0.7 * ab) continue;
      const leaf = segs.find(x => x.stroke !== si && !x.view && Math.hypot(x.a1 - x.a0, 0) <= 1.6 * ch && segEndPts(x).some(e => near(e, st[0], 2.5 * E) || near(e, st.at(-1), 2.5 * E)));
      if (!leaf) continue;
      for (let k = segs.length - 1; k >= 0; k--) if (segs[k].stroke === si) segs.splice(k, 1);
      for (let k = diag.length - 1; k >= 0; k--) if (diag[k].stroke === si) diag.splice(k, 1);
      arcs.push({ pts: st, stroke: si, view: false }); arcStrokes.add(si); }
    // krilo i luk u istom potezu: odreži ravno krilo s početka ili kraja poteza pa provjeri je li ostatak luk
    { const bySt = new Map(); segs.forEach(sg => { if (sg.view) return; if (!bySt.has(sg.stroke)) bySt.set(sg.stroke, []); bySt.get(sg.stroke).push(sg); });
      for (const [si, ss] of bySt) { if (arcStrokes.has(si) || winBlk.has(si)) continue; const st = strokesAll[si].st, b = bbox(st); /* prozor iz bloka 🪟 nije krilo s lukom */ if (Math.max(b.w, b.h) > 0.16 * D || st.length < 8) continue;
        const arcOk = q => { if (q.length < 5) return null; const ch = hyp(q[0].x - q.at(-1).x, q[0].y - q.at(-1).y); if (ch < 1.5 * E) return null; let sg = 0; for (const z of q) sg = Math.max(sg, distToSeg(z, q[0], q.at(-1))); if (sg < 0.15 * ch) return null;
          const fi = rdpIdx(q, E * 0.3); let sm = 0, ab = 0; for (let k = 1; k < fi.length - 1; k++) { const a = q[fi[k - 1]], c0 = q[fi[k]], c = q[fi[k + 1]]; const t = angDiff(Math.atan2(c.y - c0.y, c.x - c0.x), Math.atan2(c0.y - a.y, c0.x - a.x)); sm += t; ab += Math.abs(t); }
          return Math.abs(sm) > 45 * DEG && Math.abs(sm) > 0.6 * ab ? ch : null; };
        let hit = null;
        for (const sg of ss) { const L = sg.a1 - sg.a0; for (const [end, from] of [[st[0], 0], [st.at(-1), 1]]) { const ep = segEndPts(sg); if (!ep.some(e => near(e, end, 1.5 * E))) continue;
            const far = near(ep[0], end, 1.5 * E) ? ep[1] : ep[0]; let bi = 0, bd = Infinity; st.forEach((q, k) => { const d = hyp(q.x - far.x, q.y - far.y); if (d < bd) { bd = d; bi = k; } });
            let rest = from === 0 ? st.slice(bi) : st.slice(0, bi + 1);
            // mala kuka na drugom kraju (povratak uz zid) se ignorira
            for (let cut = 0; cut <= 2 && !hit; cut++) { const r = cut ? (from === 0 ? rest.slice(0, rest.length - Math.round(rest.length * 0.1 * cut)) : rest.slice(Math.round(rest.length * 0.1 * cut))) : rest; const ch = arcOk(r); if (ch && L >= 0.35 * ch && L <= 1.6 * ch) hit = { r }; } } if (hit) break; }
        if (!hit) continue;
        for (let k = segs.length - 1; k >= 0; k--) if (segs[k].stroke === si) segs.splice(k, 1);
        for (let k = diag.length - 1; k >= 0; k--) if (diag[k].stroke === si) diag.splice(k, 1);
        arcs.push({ pts: hit.r, stroke: si, view: false }); arcStrokes.add(si); } }
    // krila: kratka ravna crta (drugi potez) kojoj je kraj na kraju luka
    for (const a of arcs) { if (a.view) continue; const ch = hyp(a.pts[0].x - a.pts.at(-1).x, a.pts[0].y - a.pts.at(-1).y), ends = [a.pts[0], a.pts.at(-1)];
      const ab = doorBlk.has(a.stroke); /* luk iz bloka 🚪: krilo je samo crta istog bloka, nikad zid uz vrata */
      for (let k = segs.length - 1; k >= 0; k--) { const x = segs[k]; if (x.stroke === a.stroke || x.view) continue; if (ab && !doorBlk.has(x.stroke)) continue; if (!ab && doorBlk.has(x.stroke)) continue; const L = x.a1 - x.a0; if (L > 1.6 * ch || L > 0.2 * D || L < 0.3 * ch) continue;
        const ep = segEndPts(x); let ok = false;
        for (let i = 0; i < 2 && !ok; i++) for (let j = 0; j < 2 && !ok; j++) if (near(ep[i], ends[j], 2.5 * E)) { const d = hyp(ep[1 - i].x - ends[1 - j].x, ep[1 - i].y - ends[1 - j].y); ok = d > 0.35 * ch && d < 1.15 * ch; }
        if (ok) { x.leaf = true; segs.splice(k, 1); a.leafSeg = x; } } }
  }
  /* v1.47: prozor nacrtan kao mali pravokutnik preko zida – njegove stranice nisu zidovi, nego oznaka prozora */
  const winRects = [];
  { const by = new Map(); segs.forEach(sg => { if (sg.view) return; if (!by.has(sg.stroke)) by.set(sg.stroke, []); by.get(sg.stroke).push(sg); });
    const small = [...by.entries()].filter(([si]) => { const b = bbox(strokesAll[si].st); return Math.max(b.w, b.h) <= 0.14 * D && Math.max(b.w, b.h) >= 1.5 * E && Math.min(b.w, b.h) >= 0.6 * E; }) /* ravna crta (zid) nije dio pravokutnika */.map(([si, ss]) => ({ si, ss, b: bbox(strokesAll[si].st) }));
    const groups = small.map(g => [[g.si], g.ss, g.b]); // pravokutnik iz jednog poteza ili iz dva (npr. dvije „zagrade” s obje strane zida)
    for (let i = 0; i < small.length; i++) for (let j = i + 1; j < small.length; j++) { const a = small[i].b, c = small[j].b; if (a.x0 - E > c.x1 || c.x0 - E > a.x1 || a.y0 - E > c.y1 || c.y0 - E > a.y1) continue;
      if (winBlk.has(small[i].si) && winBlk.has(small[j].si) && winBlk.get(small[i].si) !== winBlk.get(small[j].si)) continue; /* v2.68: dva različita prozora iz bloka (jedan do drugog) se ne spajaju u jedan */ const u = { x0: Math.min(a.x0, c.x0), y0: Math.min(a.y0, c.y0), x1: Math.max(a.x1, c.x1), y1: Math.max(a.y1, c.y1) }; if (Math.max(u.x1 - u.x0, u.y1 - u.y0) > 0.14 * D) continue; groups.push([[small[i].si, small[j].si], small[i].ss.concat(small[j].ss), null]); }
    const usedS = new Set();
    for (const [sis, ss] of groups) { if (sis.some(x => usedS.has(x))) continue; const si = sis[0];
      for (const o of ['H', 'V']) { const par = ss.filter(x => x.o === o && x.a1 - x.a0 > 1.5 * E); if (par.length < 2) continue;
        par.sort((a, c) => a.c - c.c); const A = par[0], Bq = par.at(-1), t = Bq.c - A.c; if (t < 0.6 * E) continue; const s0 = Math.min(A.a0, Bq.a0), s1 = Math.max(A.a1, Bq.a1), L = s1 - s0; if (t > 1.2 * L || L < 2 * E) continue;
        // zid (drugi potez) prolazi između dviju dugih stranica ili mu je prekid na mjestu pravokutnika
        const wl = segs.filter(q => !sis.includes(q.stroke) && !q.view && q.o === o && q.c > A.c - 0.3 * t && q.c < Bq.c + 0.3 * t && q.a1 - q.a0 > 0.8 * L && (Math.min(q.a1, s1) - Math.max(q.a0, s0) > 0.3 * L || Math.abs(q.a1 - s0) < 2 * E || Math.abs(q.a0 - s1) < 2 * E));
        if (!wl.length) continue;
        const cw = wl.reduce((a, q) => a + q.c, 0) / wl.length;
        winRects.push({ o, c: cw, s0, s1, t, stroke: si }); sis.forEach(x => usedS.add(x));
        for (let k = segs.length - 1; k >= 0; k--) if (sis.includes(segs[k].stroke)) segs.splice(k, 1);
        for (let k = diag.length - 1; k >= 0; k--) if (sis.includes(diag[k].stroke)) diag.splice(k, 1);
        break; } } }
  /* v2.69: ostatak crteža prozora iz bloka 🪟 (velik prozor koji nije prepoznat kao pravokutnik) nije zid ni zub – otvor dolazi iz bloka */
  for (let k = segs.length - 1; k >= 0; k--) if (winBlk.has(segs[k].stroke)) segs.splice(k, 1);
  // mali potez s kutom (npr. dimnjak, stup u kutu) → objekt bez debljine zida
  { const by = new Map(); segs.forEach(sg => { if (!by.has(sg.stroke)) by.set(sg.stroke, []); by.get(sg.stroke).push(sg); });
    const arcStrokes = new Set(arcs.map(a => a.stroke));
    for (const [si, ss] of by) { if (strokesAll[si].view || arcStrokes.has(si)) continue; const b = bbox(strokesAll[si].st); if (Math.max(b.w, b.h) < 0.18 * D && ss.some(x => x.o === 'H') && ss.some(x => x.o === 'V')) ss.forEach(x => x.obj = true); } }
  const segEnd = (s, k) => s.o === 'H' ? { x: k ? s.a1 : s.a0, y: s.c } : { x: s.c, y: k ? s.a1 : s.a0 };
  /* izbočenje (Zub/niša → ▨) koje ne dodiruje nijedan zid = samostojeći stup/dimnjak: crte su objekt, ne zid ni niša */
  { const gs = new Map(); for (const sg of segs) { const g = zubG.get(sg.stroke); if (g && zubK.get(sg.stroke) === 'izb') { if (!gs.has(g)) gs.set(g, []); gs.get(g).push(sg); } }
    for (const ss of gs.values()) { if (!ss.some(x => x.o === 'H') || !ss.some(x => x.o === 'V')) continue; const bb = bbox(ss.flatMap(x => [x.p0, x.p1]));
      const touch = segs.some(w2 => !ss.includes(w2) && !w2.view && !w2.leaf && !w2.stair && w2.a1 - w2.a0 > 1.5 * E && (w2.o === 'H' ? (w2.c > bb.y0 - 1.5 * E && w2.c < bb.y1 + 1.5 * E && w2.a1 > bb.x0 - E && w2.a0 < bb.x1 + E) : (w2.c > bb.x0 - 1.5 * E && w2.c < bb.x1 + 1.5 * E && w2.a1 > bb.y0 - E && w2.a0 < bb.y1 + E)));
      if (!touch) ss.forEach(x => { x.obj = true; x.zubCol = true; }); } }
  /* niša nacrtana kao „zub” u zidnoj crti: kratka paralelna crta + dva kratka okomita kraka do zida */
  const niches = [];
  // kotna crta s križićima (≥2 kratke ravne crtice preko nje) nije oznaka prozora i ne briše zub
  const xSeg = (p, q, r, s2) => { const d = (q.x - p.x) * (s2.y - r.y) - (q.y - p.y) * (s2.x - r.x); if (Math.abs(d) < 1e-9) return false; const t = ((r.x - p.x) * (s2.y - r.y) - (r.y - p.y) * (s2.x - r.x)) / d, u = ((r.x - p.x) * (q.y - p.y) - (r.y - p.y) * (q.x - p.x)) / d; return t >= 0 && t <= 1 && u >= 0 && u <= 1; };
  const ticked = st => { let n = 0; for (const s2 of sk.kote) { if (s2 === st) continue; const b = bbox(s2), L2 = pathLen(s2); if (Math.max(b.w, b.h) > 2.5 * E || L2 < 0.4 * E || hyp(s2[0].x - s2.at(-1).x, s2[0].y - s2.at(-1).y) / L2 < 0.75) continue; let hit = false; for (let j = 1; j < st.length && !hit; j += Math.max(1, Math.floor(st.length / 40))) { const j2 = Math.min(st.length - 1, j + Math.max(1, Math.floor(st.length / 40)) - 1); hit = xSeg(st[j - 1], st[j2], s2[0], s2.at(-1)); } if (hit && ++n >= 2) return true; } return false; };
  const kStraight = sk.kote.filter(st => { const L = pathLen(st), ch = hyp(st[0].x - st.at(-1).x, st[0].y - st.at(-1).y); return L > 0.06 * D && ch / L > 0.85 && !ticked(st); });
  const segHitByKote = sg => kStraight.some(st => { const a = st[0], b = st.at(-1), p = sg.p0, q = sg.p1; const d = (b.x - a.x) * (q.y - p.y) - (b.y - a.y) * (q.x - p.x); if (Math.abs(d) < 1e-9) return false; const t = ((p.x - a.x) * (q.y - p.y) - (p.y - a.y) * (q.x - p.x)) / d, u = ((p.x - a.x) * (b.y - a.y) - (p.y - a.y) * (b.x - a.x)) / d; return t >= 0.05 && t <= 0.95 && u >= -0.05 && u <= 1.05; }); // kota koja samo završava na zubu ga ne poništava
  for (const N of segs) {
    if (N.view || N.leaf || N.stair || N.niche || N.zubCol || winBlk.has(N.stroke) || segHitByKote(N)) continue; /* v2.69: stranica prozora iz bloka 🪟 nije zub */ const Ln = N.a1 - N.a0, zN = zubK.get(N.stroke); if ((Ln > 0.3 * D && !zN) || Ln < 1.5 * E) continue;
    const stubs = [0, 1].map(k => { const ea = k ? N.a1 : N.a0; let best = null, bd = Infinity;
      for (const S2 of segs) { if (S2 === N || S2.o === N.o || S2.view || S2.leaf || S2.niche || S2.zubCol) continue; if (S2.a1 - S2.a0 > 0.1 * D && !(zN && zubK.has(S2.stroke))) continue; if (Math.abs(S2.c - ea) > 1.8 * E) continue;
        const d0 = Math.abs(S2.a0 - N.c), d1 = Math.abs(S2.a1 - N.c), d = Math.min(d0, d1); if (d > 1.8 * E) continue; if (d < bd) { bd = d; best = { S: S2, far: d0 < d1 ? S2.a1 : S2.a0 }; } }
      return best; });
    // zub u kutu (proširenje zida uz okomiti zid): jedan krak je sam taj zid
    let corner = null;
    if (!!stubs[0] !== !!stubs[1]) { const k = stubs[0] ? 1 : 0, other = stubs[1 - k], ea = k ? N.a1 : N.a0, lo = Math.min(N.c, other.far), hi = Math.max(N.c, other.far);
      const Wp = segs.find(S2 => S2 !== N && S2.o !== N.o && !S2.view && !S2.leaf && !S2.niche && !S2.obj && S2.a1 - S2.a0 > 0.1 * D && Math.abs(S2.c - ea) < 1.8 * E && S2.a0 < lo + 2 * E && S2.a1 > hi - E);
      if (Wp) { stubs[k] = { S: null, far: other.far }; corner = { k, c: Wp.c }; } }
    if (!stubs[0] || !stubs[1]) continue;
    if ((stubs[0].S && segHitByKote(stubs[0].S)) || (stubs[1].S && segHitByKote(stubs[1].S))) continue; // okvir prozora presječen oznakom
    const f0 = stubs[0].far, f1 = stubs[1].far, sd = Math.sign(f0 - N.c); if (sd !== Math.sign(f1 - N.c)) continue;
    const reach = Math.max(Math.abs(f0 - N.c), Math.abs(f1 - N.c)) + 2 * E;
    // zid: najbliža paralelna crta na strani krakova, uz ili preko zuba
    let cW = null; for (const W2 of segs) { if (W2 === N || W2.o !== N.o || W2.view || W2.leaf || W2.niche || W2.obj || W2.a1 - W2.a0 < 0.5 * Ln || W2.stroke === N.stroke && W2.a1 - W2.a0 < 0.1 * D || (zN && W2.stroke !== N.stroke && zubK.has(W2.stroke))) continue; /* v2.68: druga stranica nacrtanog izbočenja nije zid */ const off = (W2.c - N.c) * sd; if (off < 0.3 * E || off > reach) continue;
      if (!(Math.abs(W2.a1 - N.a0) < 2.5 * E || Math.abs(W2.a0 - N.a1) < 2.5 * E || (W2.a0 < N.a0 - E && W2.a1 > N.a1 + E) || (zN && W2.a0 < N.a0 + E && W2.a1 > N.a1 - E))) continue; if (cW == null || Math.abs(W2.c - N.c) < Math.abs(cW - N.c)) cW = W2.c; }
    if (cW == null) continue; const depth = Math.abs(cW - N.c); if (depth > Math.min(0.08 * D, 3.5 * E) && !zN) continue; /* v2.28: niša najviše ~3,5 debljine zida dubine */
    N.niche = true; N.obj = false; for (const sb of stubs) if (sb.S) { sb.S.niche = true; sb.S.obj = false; }
    niches.push({ o: N.o, cW, room: -Math.sign(N.c - cW), s0: N.a0, s1: N.a1, depthS: depth, nc: N.c, src: 'zub', corner, forceKind: zN ? (zN === 'izb' ? 'zadebljanje' : 'nisa') : null });
    if (corner && circles.some(ci => Math.abs(ci.c.x - (N.o === 'H' ? (N.a0 + N.a1) / 2 : (N.c + cW) / 2)) < 0.6 * Ln + E && Math.abs(ci.c.y - (N.o === 'H' ? (N.c + cW) / 2 : (N.a0 + N.a1) / 2)) < 0.6 * Ln + E)) { niches.pop(); N.niche = false; N.obj = true; for (const sb of stubs) if (sb.S) { sb.S.niche = false; sb.S.obj = true; } } // dimnjak u kutu (kružić)
  }
  /* samostojeći stup: mali zatvoreni objekt koji ne dodiruje nijedan zid */
  const columns = [];
  { const objs = segs.filter(sg => sg.obj && !sg.niche && !sg.view), used = new Set();
    const near = (a, b) => !(a.x1 < b.x0 - 1.5 * E || b.x1 < a.x0 - 1.5 * E || a.y1 < b.y0 - 1.5 * E || b.y1 < a.y0 - 1.5 * E);
    const sbb = sg => bbox([sg.p0, sg.p1]);
    for (const sg of objs) { if (used.has(sg)) continue; const grp = [sg]; used.add(sg); let bb = sbb(sg), grown = true;
      while (grown) { grown = false; for (const o2 of objs) { if (used.has(o2)) continue; if (near(bb, sbb(o2))) { grp.push(o2); used.add(o2); bb = bbox(grp.flatMap(x => [x.p0, x.p1])); grown = true; } } }
      if (!grp.some(x => x.o === 'H') || !grp.some(x => x.o === 'V')) continue;
      const touches = segs.some(w2 => !w2.obj && !w2.view && !w2.leaf && !w2.niche && !w2.stair && (w2.o === 'H' ? (w2.c > bb.y0 - 2 * E && w2.c < bb.y1 + 2 * E && w2.a1 > bb.x0 - 2 * E && w2.a0 < bb.x1 + 2 * E) : (w2.c > bb.x0 - 2 * E && w2.c < bb.x1 + 2 * E && w2.a1 > bb.y0 - 2 * E && w2.a0 < bb.y1 + 2 * E)));
      if (touches) continue;
      grp.forEach(x => { x.col = true; }); columns.push({ bb, c: { x: (bb.x0 + bb.x1) / 2, y: (bb.y0 + bb.y1) / 2 } });
    } }
  /* krilo vrata: kratka ravna crta koja dodiruje luk i dugačka je kao polumjer */
  for (const a of arcs) {
    if (a.view) continue;
    const ch = hyp(a.pts[0].x - a.pts.at(-1).x, a.pts[0].y - a.pts.at(-1).y), r = ch / Math.SQRT2;
    for (const s of segs) {
      if (s.leaf || s.view || s.niche) continue; const L = s.a1 - s.a0; if (L < 0.5 * r || L > 1.6 * r) continue;
      const P = a.pts[0], Q = a.pts.at(-1), ends = [segEnd(s, 0), segEnd(s, 1)];
      // jedan kraj krila dodiruje luk, drugi (šarka) je ~r udaljen od oba kraja luka
      const ok = [0, 1].some(k => { const e = ends[k], h = ends[1 - k]; const touch = [P, Q].some(q => hyp(e.x - q.x, e.y - q.y) < Math.max(1.8 * E, 0.25 * r)); return touch && Math.abs(hyp(h.x - P.x, h.y - P.y) - r) < 0.4 * r + E && Math.abs(hyp(h.x - Q.x, h.y - Q.y) - r) < 0.4 * r + E; });
      if (ok) { s.leaf = true; a.leaf = s; break; }
    }
  }
  /* kratke crte unutar područja luka = dijelovi simbola vrata (krila), ne zidovi */
  for (const a of arcs) {
    if (a.view) continue; const ch = hyp(a.pts[0].x - a.pts.at(-1).x, a.pts[0].y - a.pts.at(-1).y), b = bbox(a.pts), pad = 0.35 * ch;
    const inB = p => p.x >= b.x0 - pad && p.x <= b.x1 + pad && p.y >= b.y0 - pad && p.y <= b.y1 + pad;
    for (const sg of segs) { if (sg.view || sg.niche || (sg.leaf && !sg.doorPart && sg.stroke !== a.stroke)) continue; if ((sg.stroke === a.stroke && sg.a1 - sg.a0 < 1.5 * ch) || (sg.a1 - sg.a0 < 0.9 * ch && inB(segEnd(sg, 0)) && inB(segEnd(sg, 1)))) { sg.leaf = true; sg.doorPart = true; sg.arcRef = sg.arcRef || a; } }
    for (const sg of segs) if (sg.leaf && !sg.doorPart && a.leaf === sg) { sg.doorPart = true; sg.arcRef = a; }
  }
  /* stubište: ≥3 paralelne kratke crte u pravilnom razmaku */
  const stairs = [];
  for (const o of ['H', 'V']) {
    const c = segs.filter(s => s.o === o && !s.leaf && (s.a1 - s.a0) < 0.3 * D).sort((p, q) => p.c - q.c);
    let used = new Set();
    for (let i = 0; i < c.length; i++) {
      if (used.has(c[i])) continue; const grp = [c[i]];
      for (let j = i + 1; j < c.length; j++) {
        const last = grp.at(-1), s = c[j]; const gap = s.c - last.c; if (gap > Math.min(0.09 * D, 4 * E)) break; /* v2.28: gazište najviše ~4 debljine zida (prije samo 0,09·dijagonala – daleki crtež je to jako povećao) */ if (gap < E * 0.8) continue;
        if (!!s.view !== !!grp[0].view) continue; /* zid (Nacrt) i crte u Pogledu nisu isto stubište */
        const la = last.a1 - last.a0, sa = s.a1 - s.a0, ov = Math.min(last.a1, s.a1) - Math.max(last.a0, s.a0);
        if (ov < 0.6 * Math.min(la, sa) || Math.max(la, sa) > 1.5 * Math.min(la, sa)) continue;
        if (grp.length >= 2) { const g0 = grp[1].c - grp[0].c; if (gap > 2.2 * g0 || gap < g0 / 2.2) continue; }
        grp.push(s);
      }
      if (grp.length >= 3) { grp.forEach(s => { s.stair = true; used.add(s); }); stairs.push({ o, segs: grp }); }
    }
  }
  stairs.forEach((S, si) => {
    const g = S.segs; S.n = g.length; S.c0 = g[0].c; S.c1 = g.at(-1).c; S.a0 = median(g.map(x => x.a0)); S.a1 = median(g.map(x => x.a1));
    const po = S.o === 'H' ? 'V' : 'H', run = S.c1 - S.c0;
    // hodna linija sa strelicom (smjer penjanja) i bočne crte stubišta
    let walk = null; for (const s2 of segs) { if (s2.o !== po || s2.leaf || s2.stair) continue; if (s2.c < S.a0 + 0.15 * (S.a1 - S.a0) || s2.c > S.a1 - 0.15 * (S.a1 - S.a0)) continue; const ov = Math.min(s2.a1, S.c1) - Math.max(s2.a0, S.c0); if (ov < 0.5 * run || s2.a1 - s2.a0 > 2.5 * run + 6 * E) continue; if (!walk || s2.a1 - s2.a0 > walk.a1 - walk.a0) walk = s2; }
    S.dir = 0;
    if (walk) { walk.stair = true; walk.walk = true; S.walk = { c: walk.c, a0: walk.a0, a1: walk.a1 };
      const tip = [walk.a0, walk.a1].map(e => { const P = S.o === 'H' ? { x: walk.c, y: e } : { x: e, y: walk.c }; return diag.filter(d => d.some(q => hyp(q.x - P.x, q.y - P.y) < 2.5 * E)).length + segs.filter(s3 => s3 !== walk && s3.stroke !== walk.stroke && !s3.stair && s3.a1 - s3.a0 < 3 * E && hyp((s3.p0.x + s3.p1.x) / 2 - P.x, (s3.p0.y + s3.p1.y) / 2 - P.y) < 2.5 * E).length; });
      if (tip[0] !== tip[1]) S.dir = tip[1] > tip[0] ? 1 : -1;
      diag.forEach(d => { const near = [walk.a0, walk.a1].some(e => { const P = S.o === 'H' ? { x: walk.c, y: e } : { x: e, y: walk.c }; return d.every(q => hyp(q.x - P.x, q.y - P.y) < 3 * E); }); if (near) d.stairArrow = true; }); }
    for (const s2 of segs) { if (s2.o !== po || !s2.view || s2.stair) continue; if (Math.abs(s2.c - S.a0) > 1.5 * E && Math.abs(s2.c - S.a1) > 1.5 * E) continue; const ov = Math.min(s2.a1, S.c1) - Math.max(s2.a0, S.c0); if (ov > 0.5 * run) s2.stair = true; }
    { const bx0 = (S.o === 'H' ? S.a0 : S.c0) - 1.5 * E, bx1 = (S.o === 'H' ? S.a1 : S.c1) + 1.5 * E, by0 = (S.o === 'H' ? S.c0 : S.a0) - 1.5 * E, by1 = (S.o === 'H' ? S.c1 : S.a1) + 1.5 * E, inB = p => p.x > bx0 && p.x < bx1 && p.y > by0 && p.y < by1;
      for (const s2 of segs) if (s2.view && !s2.stair && inB(s2.p0) && inB(s2.p1)) s2.stair = true; }
    S.key = 's:' + Math.round((S.a0 + S.a1) / 2) + ':' + Math.round((S.c0 + S.c1) / 2) + ':' + S.o; S.id = si;
  });
  const cross = [];
  const segXX = (p, q, r, s2) => { const d = (q.x - p.x) * (s2.y - r.y) - (q.y - p.y) * (s2.x - r.x); if (Math.abs(d) < 1e-9) return false; const t = ((r.x - p.x) * (s2.y - r.y) - (r.y - p.y) * (s2.x - r.x)) / d, u = ((r.x - p.x) * (q.y - p.y) - (r.y - p.y) * (q.x - p.x)) / d; return t >= 0 && t <= 1 && u >= 0 && u <= 1; };
  sk.kote.forEach((st, ki) => {
    const L = pathLen(st), a = st[0], b = st.at(-1), ch = hyp(a.x - b.x, a.y - b.y); if (L < 0.06 * D || ch / L < 0.85) return;
    const ang = Math.atan2(b.y - a.y, b.x - a.x), dh = Math.abs(angDiff(2 * ang, 0)) / 2, dv = Math.abs(angDiff(2 * ang, Math.PI)) / 2;
    const o = dh < 20 * DEG ? 'H' : dv < 20 * DEG ? 'V' : null; if (!o) return;
    const c = o === 'H' ? st.reduce((s2, p) => s2 + p.y, 0) / st.length : st.reduce((s2, p) => s2 + p.x, 0) / st.length;
    const a0 = o === 'H' ? Math.min(a.x, b.x) : Math.min(a.y, b.y), a1 = o === 'H' ? Math.max(a.x, b.x) : Math.max(a.y, b.y);
    if (columns.some(cl => [a, b].some(p => p.x > cl.bb.x0 - 1.5 * E && p.x < cl.bb.x1 + 1.5 * E && p.y > cl.bb.y0 - 1.5 * E && p.y < cl.bb.y1 + 1.5 * E))) return; // kota do stupa
    // križić/kvačica na oba kraja = nacrtana kota, ne oznaka otvora
    const endTick = e => sk.kote.some((s2, k2) => { if (k2 === ki) return false; const b2 = bbox(s2); if (Math.max(b2.w, b2.h) > 3 * E || hyp((b2.x0 + b2.x1) / 2 - e.x, (b2.y0 + b2.y1) / 2 - e.y) > 2.5 * E) return false;
      const P = rdpIdx(s2, 1).map(i => s2[i]), dx = (b.x - a.x) / (hyp(b.x - a.x, b.y - a.y) || 1), dy = (b.y - a.y) / (hyp(b.x - a.x, b.y - a.y) || 1), ext = [{ x: a.x - dx * 1.5 * E, y: a.y - dy * 1.5 * E }, ...st, { x: b.x + dx * 1.5 * E, y: b.y + dy * 1.5 * E }];
      for (let i = 1; i < P.length; i++) for (let j = 1; j < ext.length; j++) if (segXX(P[i - 1], P[i], ext[j - 1], ext[j])) return true; return false; });
    if (endTick(a) && endTick(b)) return;
    const hit = segs.filter(sg => sg.o !== o && !sg.leaf && !sg.stair && !sg.view && !sg.niche && !sg.col && sg.c >= a0 - E && sg.c <= a1 + E && c >= sg.a0 - E && c <= sg.a1 + E);
    if (!hit.length) return;
    const main = hit.reduce((x, y) => (y.a1 - y.a0) > (x.a1 - x.a0) ? y : x);
    const sills = hit.filter(sg => sg !== main && Math.abs(sg.c - main.c) < 0.2 * D && (sg.a1 - sg.a0) < 0.8 * (main.a1 - main.a0));
    if (sills.length) {
      const b0 = Math.min(...sills.map(x => x.a0)), b1 = Math.max(...sills.map(x => x.a1)), lo = Math.min(main.c, ...sills.map(x => x.c)), hi = Math.max(main.c, ...sills.map(x => x.c));
      sills.forEach(x => x.box = true);
      const pad = Math.max(2.5 * E, 0.35 * (hi - lo));
      segs.forEach(sg => { if (sg.o === o && sg.c >= b0 - 2 * E && sg.c <= b1 + 2 * E && sg.a0 >= lo - pad && sg.a1 <= hi + pad && (sg.a1 - sg.a0) < 0.2 * D) sg.box = true; });
    }
    // crta mora prijeći zid s obje strane (inače je to nacrtana kota uz zid)
    const over = Math.min(main.c - a0, a1 - main.c), endsAt = hit.length === 1 && over > -2 * E;
    if (over < 0.25 * Math.min(L, 4 * E) && !sills.length && !endsAt) return;
    const cr = { o, c, a0, a1, ki, pts: st, box: sills.length > 0 };
    if (sills.length) { cr.bs0 = Math.min(...sills.map(x => x.a0)); cr.bs1 = Math.max(...sills.map(x => x.a1)); }
    cross.push(cr);
  });
  const wallSegs = segs.filter(s => !s.leaf && !s.stair && !s.box && !s.niche && !s.col);
  if (!wallSegs.length) throw Error('Nisu pronađeni ravni zidovi na sloju Nacrt.');

  /* --- linije zidova (grupiranje po koordinati) i neprekinuti dijelovi --- */
  const lines = { H: [], V: [] };
  for (const o of ['H', 'V']) for (const view of [false, true]) {
    const ss = wallSegs.filter(s => s.o === o && !!s.view === view).sort((a, b) => a.c - b.c);
    let cur = null;
    for (const s of ss) {
      // isti pravac: blizu, ili malo dalje ali kao nastavak (bez preklapanja duž zida)
      const cont = cur && s.c - cur.last <= 2.5 * E && cur.segs.every(q => s.a0 >= q.a1 - E || s.a1 <= q.a0 + E);
      if (cur && (s.c - cur.last <= E || cont)) { cur.segs.push(s); cur.last = s.c; } else { cur = { o, segs: [s], last: s.c, view }; lines[o].push(cur); }
    }
    for (const L of lines[o]) {
      if (L.runs) continue;
      let w = 0, sum = 0; for (const s of L.segs) { const l = s.a1 - s.a0 + 1; w += l; sum += l * s.c; } L.c = sum / w;
      const sorted = [...L.segs].sort((a, b) => a.a0 - b.a0); L.runs = [];
      for (const s of sorted) { const r = L.runs.at(-1); if (r && s.a0 <= r.a1 + 0.8 * E) r.a1 = Math.max(r.a1, s.a1); else L.runs.push({ a0: s.a0, a1: s.a1 }); }
    }
  }
  /* ručni prijelom zida (zid na skici ravan, a u stvarnosti ima skok): linija se dijeli na dva dijela s vlastitim osima */
  const jogPairs = [];
  for (const sp of (opts && opts.splits) || []) {
    if (sp.off) continue; /* automatski prijelom koji je korisnik maknuo */
    const arr = lines[sp.o]; if (!arr) continue; let L = null, bd = 2 * E;
    for (const L2 of arr) { if (L2.view) continue; const lo = Math.min(...L2.runs.map(r => r.a0)), hi = Math.max(...L2.runs.map(r => r.a1)); const d = Math.abs(L2.c - sp.c); if (d < bd && sp.at > lo + 0.5 * E && sp.at < hi - 0.5 * E) { bd = d; L = L2; } }
    if (!L) continue;
    const A = [], Bq = [];
    for (const sg of L.segs) { if (sg.a1 <= sp.at) A.push(sg); else if (sg.a0 >= sp.at) Bq.push(sg); else { A.push({ ...sg, a1: sp.at }); Bq.push({ ...sg, a0: sp.at }); } }
    if (!A.length || !Bq.length) continue;
    const runsOf = ss => { const r = []; for (const sg of [...ss].sort((a, b) => a.a0 - b.a0)) { const q = r.at(-1); if (q && sg.a0 <= q.a1 + 0.8 * E) q.a1 = Math.max(q.a1, sg.a1); else r.push({ a0: sg.a0, a1: sg.a1 }); } return r; };
    const L1 = { o: sp.o, segs: A, last: L.last, view: false, c: L.c, runs: runsOf(A), splitAt: sp.at, splitPart: 0 }, L2 = { o: sp.o, segs: Bq, last: L.last, view: false, c: L.c, runs: runsOf(Bq), splitAt: sp.at, splitPart: 1 };
    if (L.splitFrom) { L1.splitFrom = L2.splitFrom = L.splitFrom; }
    arr.splice(arr.indexOf(L), 1, L1, L2);
    for (const pr of jogPairs) for (const k of [0, 1]) if (pr[k] === L) pr[k] = pr[2].at <= sp.at ? L1 : L2; /* v2.62: više prijeloma na istoj crti – raniji skok veže se na pravi dio */
    jogPairs.push([L1, L2, sp]);
  }
  const perp = o => o === 'H' ? 'V' : 'H';
  const spans = (L, v, pad) => L.runs.some(r => v >= r.a0 - pad && v <= r.a1 + pad);
  function snapEnd(o, c, e, view, other) { // kraj zida (orijentacija o, linija c, koordinata kraja e) → najbliža okomita linija
    let best = null, bd = 3.5 * E;
    for (const P of lines[perp(o)]) { if (P.view && !view) continue; const d = Math.abs(P.c - e); if (other != null && Math.abs(P.c - other) < d) continue; /* kratki komad zida (npr. 10 cm do prozora): kraj se ne lijepi za zid na drugom kraju */ if (d <= bd && spans(P, c, 3.5 * E)) { bd = d; best = P; } }
    return best;
  }
  /* zidovi = dijelovi na istoj liniji spojeni preko otvora */
  const walls = [];
  for (const o of ['H', 'V']) for (const L of lines[o]) {
    const rs = L.runs.map(r => ({ ...r, s0: snapEnd(o, L.c, r.a0, L.view, L.runs.length > 1 ? r.a1 : null), s1: snapEnd(o, L.c, r.a1, L.view, L.runs.length > 1 ? r.a0 : null) }));
    let cur = null;
    for (const r of rs) {
      if (cur) {
        const g0 = cur.s1 ? cur.s1.c : cur.a1, g1 = r.s0 ? r.s0.c : r.a0, gap = g1 - g0;
        const crossing = lines[perp(o)].some(P => !P.view && P.c > g0 + E && P.c < g1 - E && spans(P, L.c, 0.5 * E));
        const bounded = cur.s1 && r.s0 && cur.s1 !== r.s0 && !cur.s1.view && !r.s0.view && spans(cur.s1, L.c, 0.5 * E) && spans(r.s0, L.c, 0.5 * E) && gap > 4 * E; /* v2.41: s obje strane kraj na poprečnom zidu (hodnik između dvije sobe) – nije otvor, nego dva zida */
        if (!L.view && gap <= maxGap && !crossing && !bounded) { if (gap > E * 0.8) cur.gaps.push({ s0: g0, s1: g1 }); cur.a1 = r.a1; cur.s1 = r.s1; continue; }
        walls.push(cur);
      }
      cur = { o, line: L, a0: r.a0, a1: r.a1, s0: r.s0, s1: r.s1, gaps: [] };
    }
    if (cur) walls.push(cur);
  }
  /* slobodni krajevi: pogledaj naprijed do okomitog zida (otvor uz ugao) */
  for (const w of walls) for (const k of [0, 1]) {
    if (k === 0 ? w.s0 : w.s1) continue;
    if (w.line.view) continue;
    const e = k === 0 ? w.a0 : w.a1, dir = k === 0 ? -1 : 1; let best = null, bd = maxGap;
    for (const P of lines[perp(w.o)]) { if (P.view) continue; const d = (P.c - e) * dir; if (d > 0 && d < bd && spans(P, w.line.c, 1.5 * E)) { bd = d; best = P; } }
    if (best && bd <= 3.5 * E) { if (k === 0) w.s0 = best; else w.s1 = best; }
    else if (best && bd > 0.8 * E) {
      // samo ako na tom potezu nema drugog zida iste linije
      if (k === 0) { w.gaps.unshift({ s0: best.c, s1: e }); w.s0 = best; } else { w.gaps.push({ s0: e, s1: best.c }); w.s1 = best; }
    }
  }
  /* osi: X (vertikalne linije + slobodni krajevi vodoravnih zidova), Y analogno */
  const axes = { X: [], Y: [] };
  const axisOfLine = new Map();
  for (const L of lines.V) { axisOfLine.set(L, axes.X.length); axes.X.push({ s: L.c, kind: 'line', line: L }); }
  for (const L of lines.H) { axisOfLine.set(L, axes.Y.length); axes.Y.push({ s: L.c, kind: 'line', line: L }); }
  const jogs = jogPairs.map(([L1, L2, sp]) => ({ ax: sp.o === 'V' ? 'X' : 'Y', i: axisOfLine.get(L1), j: axisOfLine.get(L2), o: sp.o, c: sp.c, at: sp.at, soft: !!sp.soft, gap: !!sp.gap }));
  function freeAxis(ax, s) {
    let best = -1, bd = E; axes[ax].forEach((a, i) => { const d = Math.abs(a.s - s); if (d <= bd) { bd = d; best = i; } });
    if (best >= 0) return best; axes[ax].push({ s, kind: 'end' }); return axes[ax].length - 1;
  }
  for (const w of walls) {
    const ax = w.o === 'H' ? 'X' : 'Y';
    w.lineAxis = axisOfLine.get(w.line);
    w.end = [w.s0 ? axisOfLine.get(w.s0) : freeAxis(ax, w.a0), w.s1 ? axisOfLine.get(w.s1) : freeAxis(ax, w.a1)];
    w.snapped = [!!w.s0, !!w.s1];
    w.e0 = axes[ax][w.end[0]].s; w.e1 = axes[ax][w.end[1]].s;
    if (w.e1 < w.e0) { [w.e0, w.e1] = [w.e1, w.e0]; w.end.reverse(); w.snapped.reverse(); }
    w.c = w.line.c;
  }
  // izbaci prekratke zidove nastale spajanjem
  const W = walls.filter(w => w.e1 - w.e0 > E * 0.8);
  for (const w of W) { const inn = w.line.segs.filter(sg => sg.a1 >= w.e0 - E && sg.a0 <= w.e1 + E); w.obj = inn.length > 0 && inn.every(sg => sg.obj); }
  W.forEach((w, i) => { w.id = i; w.view = !!w.line.view; });
  /* vanjski zidovi: na barem jednoj strani nema drugog paralelnog zida */
  for (const w of W) {
    let ext = false;
    if (w.view) { w.exterior = false; continue; }
    for (const f of [0.15, 0.5, 0.85]) {
      const u = w.e0 + (w.e1 - w.e0) * f; let lo = false, hi = false;
      for (const q of W) { if (q === w || q.obj || q.view || q.o !== w.o || u < q.e0 - 0.5 * E || u > q.e1 + 0.5 * E) continue; if (q.c < w.c - E) lo = true; if (q.c > w.c + E) hi = true; }
      if (!lo || !hi) { ext = true; w.outSide = !lo ? -1 : 1; break; }
    }
    w.exterior = ext;
  }
  /* otvori iz prekida */
  const openings = [];
  for (const w of W) for (const g of w.gaps) openings.push({ wall: w.id, s0: g.s0, s1: g.s1, src: 'prekid', type: 'prolaz' });
  for (const o of items) { if (!(o && o.layer === 'nacrt' && o.blk && o.blk.main && (o.blk.bk || o.blk.kl || o.blk.t === 'vrata') && o.blk.c && o.blk.dv)) continue; /* vrata / otvor bez krila / klizna iz bloka 🚪 */
    const c = R(o.blk.c), d = R(o.blk.dv), ow = Math.abs(d.x) >= Math.abs(d.y) ? 'H' : 'V', u = ow === 'H' ? c.x : c.y, v = ow === 'H' ? c.y : c.x, hw = (o.blk.dW > 0 ? o.blk.dW : 30) / 2;
    let bw = null, bd = 3 * E; for (const w of W) { if (w.view || w.o !== ow || u < w.e0 - E || u > w.e1 + E) continue; const dd = Math.abs(v - w.c); if (dd < bd) { bd = dd; bw = w; } }
    if (bw && !o.blk.bk && !o.blk.kl) { const B = o.blk, nr = B.nv ? R(B.nv) : null, side = nr ? Math.sign(ow === 'H' ? nr.y : nr.x) * (B.sw || 1) : 0, sdU = Math.sign(ow === 'H' ? d.x : d.y) || 1, op = { wall: bw.id, s0: Math.max(bw.e0, u - hw), s1: Math.min(bw.e1, u + hw), src: 'blok', type: 'vrata', side: side || undefined, blkDoor: true };
      if (B.dvo) { const f1 = B.w1 > 0 && B.w > 0 && B.w1 < B.w ? B.w1 / B.w : 0.5, hF = (Math.abs(B.dv.x) >= Math.abs(B.dv.y) ? -B.dv.x : B.dv.y) > 0 ? 1 : -1; op.double = true; op.split = hF * sdU > 0 ? 1 - f1 : f1; } else op.hinge = (B.hg ? 1 : -1) * sdU > 0;
      openings.push(op); continue; }
    if (bw) { const kl = !!o.blk.kl, nr = o.blk.nv ? R(o.blk.nv) : null, sd = nr ? Math.sign(ow === 'H' ? nr.y : nr.x) * (o.blk.sw || 1) : 0; openings.push(kl ? { wall: bw.id, s0: Math.max(bw.e0, u - hw), s1: Math.min(bw.e1, u + hw), src: 'blok', type: 'vrata', kl: true, side: sd || undefined, hinge: !!o.blk.hg } : { wall: bw.id, s0: Math.max(bw.e0, u - hw), s1: Math.min(bw.e1, u + hw), src: 'blok', type: 'prolaz', bk: true }); } }
  for (const r of winRects) { // pravokutnik preko zida → prozor na tom zidu
    let bw = null, bd = Infinity; for (const w of W) { if (w.o !== r.o || w.view || w.obj) continue; if (r.s1 < w.e0 - E || r.s0 > w.e1 + E) continue; const d = Math.abs(w.c - r.c); if (d < bd && d < r.t + 2 * E) { bd = d; bw = w; } }
    if (!bw) continue; const s0 = Math.max(bw.e0, r.s0), s1 = Math.min(bw.e1, r.s1); if (s1 - s0 < E) continue;
    const ex = openings.find(op => op.wall === bw.id && Math.min(op.s1, s1) - Math.max(op.s0, s0) > 0.4 * Math.min(op.s1 - op.s0, s1 - s0));
    if (ex) { ex.s0 = Math.min(ex.s0, s0); ex.s1 = Math.max(ex.s1, s1); ex.type = 'prozor'; ex.src = 'pravokutnik'; }
    else openings.push({ wall: bw.id, s0, s1, src: 'pravokutnik', type: 'prozor' }); }
  /* lukovi → vrata */
  for (const a of arcs) {
    if (a.view) { a.free = true; continue; }
    const cen = { x: a.pts.reduce((s, p) => s + p.x, 0) / a.pts.length, y: a.pts.reduce((s, p) => s + p.y, 0) / a.pts.length };
    const ch = hyp(a.pts[0].x - a.pts.at(-1).x, a.pts[0].y - a.pts.at(-1).y);
    let best = null, bd = Infinity;
    for (const op of openings) { if (op.src === 'pravokutnik') continue;
      const w = W[op.wall], mid = (op.s0 + op.s1) / 2, width = op.s1 - op.s0;
      const pu = w.o === 'H' ? cen.x : cen.y, pv = w.o === 'H' ? cen.y : cen.x;
      const d = hyp(pu - mid, pv - w.c); if (d < width + 2 * E && Math.abs(pv - w.c) < 1.5 * width + E && d < bd) { bd = d; best = op; }
    }
    if (best && !best.arc) { attachArc(best, a); continue; }
    // vrata nacrtana na neprekinutom zidu: kraj luka leži na zidu
    let bw = null, bdist = Math.max(1.8 * E, 0.2 * ch);
    for (const w of W) for (const q of [a.pts[0], a.pts.at(-1)]) {
      if (w.view) continue;
      const pu = w.o === 'H' ? q.x : q.y, pv = w.o === 'H' ? q.y : q.x;
      if (pu < w.e0 - E || pu > w.e1 + E) continue; const d = Math.abs(pv - w.c); if (d < bdist) { bdist = d; bw = w; }
    }
    if (bw) {
      const us = a.pts.map(p => bw.o === 'H' ? p.x : p.y); let s0 = Math.min(...us), s1 = Math.max(...us);
      if (s1 - s0 < ch * 0.4) { const m = (s0 + s1) / 2; s0 = m - ch / (2 * Math.SQRT2); s1 = m + ch / (2 * Math.SQRT2); }
      const op = { wall: bw.id, s0: Math.max(bw.e0, s0), s1: Math.min(bw.e1, s1), src: 'luk', type: 'vrata' }; attachArc(op, a); openings.push(op);
    } else a.free = true;
  }
  function attachArc(op, a) {
    const w = W[op.wall]; op.arc = a; op.type = 'vrata'; a.used = true;
    let far = null, fd = -1; for (const p of a.pts) { const pv = w.o === 'H' ? p.y : p.x, d = Math.abs(pv - w.c); if (d > fd) { fd = d; far = p; } }
    const pv = w.o === 'H' ? far.y : far.x, pu = w.o === 'H' ? far.x : far.y;
    op.side = pv >= w.c ? 1 : -1;
    op.hinge = Math.abs(pu - op.s0) <= Math.abs(pu - op.s1) ? 0 : 1;
  }
  for (const op of openings) {
    if (!op.arc) continue; const w = W[op.wall];
    const hs = segs.filter(sg => sg.doorPart && sg.o !== w.o && (sg.arcRef === op.arc || sg.stroke === op.arc.stroke || hyp((sg.p0.x + sg.p1.x) / 2 - (op.arc.pts[0].x + op.arc.pts.at(-1).x) / 2, (sg.p0.y + sg.p1.y) / 2 - (op.arc.pts[0].y + op.arc.pts.at(-1).y) / 2) < 1.5 * hyp(op.arc.pts[0].x - op.arc.pts.at(-1).x, op.arc.pts[0].y - op.arc.pts.at(-1).y)) && (Math.abs(sg.a0 - w.c) < 2.5 * E || Math.abs(sg.a1 - w.c) < 2.5 * E)).map(sg => sg.c).sort((x, y) => x - y);
    if (hs.length >= 2 && hs.at(-1) - hs[0] > 3 * E) { op.s0 = hs[0]; op.s1 = hs.at(-1); op.double = true; }
    else if (hs.length) { const h = hs[0]; if (Math.abs(h - op.s0) <= Math.abs(h - op.s1)) { op.s0 = h; op.hinge = 0; } else { op.s1 = h; op.hinge = 1; } }
  }
  for (let i = 0; i < openings.length; i++) for (let j = openings.length - 1; j > i; j--) {
    const a = openings[i], b = openings[j]; if (a.wall !== b.wall || !a.arc || !b.arc) continue;
    if (Math.min(a.s1, b.s1) - Math.max(a.s0, b.s0) > -2 * E) { a.s0 = Math.min(a.s0, b.s0); a.s1 = Math.max(a.s1, b.s1); a.double = true; openings.splice(j, 1); }
  }
  for (const n of niches) {
    let bw = null, bd = 2 * E; for (const w of W) { if (w.o !== n.o || w.view || w.obj) continue; const mid = (n.s0 + n.s1) / 2; if (mid < w.e0 - E || mid > w.e1 + E) continue; const d = Math.abs(w.c - n.cW); if (d < bd) { bd = d; bw = w; } }
    if (!bw) continue; n.wall = bw.id;
    n.kind = 'nisa'; if ((bw.exterior && bw.outSide && n.room === bw.outSide) || n.corner) { n.kind = 'zadebljanje'; n.room = -n.room; } // zub u kutu uvijek strši u prostoriju
    for (let k = openings.length - 1; k >= 0; k--) { const o = openings[k]; if (o.wall === bw.id && !o.arc && Math.abs(o.s0 - n.s0) < 2.5 * E && Math.abs(o.s1 - n.s1) < 2.5 * E) openings.splice(k, 1); }
  }
  openings.forEach((o, i) => { o.id = i; o.key = 'o:' + Math.round((o.s0 + o.s1) / 2) + ':' + Math.round(W[o.wall].c) + ':' + W[o.wall].o; });

  /* --- natpisi kota: grupiranje poteza u brojeve --- */
  const glyph = [], dimLines = [], crossSet = new Set(cross.map(c => c.ki)), cand = [];
  sk.kote.forEach((st, i) => {
    const b = bbox(st), L = pathLen(st), ch = hyp(st[0].x - st.at(-1).x, st[0].y - st.at(-1).y);
    if ((L > 0.12 * D && ch / L > 0.85) || crossSet.has(i)) { dimLines.push(st); if (!crossSet.has(i)) cand.push({ st, i }); }
    else glyph.push({ st, b, raw: raw.kote[i], i });
  });
  const hMed0 = Math.max(E, median(glyph.map(g => Math.max(g.b.w, g.b.h)).filter(v => v < 0.08 * D)) || E * 2);
  // ravna crta srednje duljine (i kraća od 0.12D) koja ima kvačice na krajevima = nacrtana kota
  for (const g of glyph) { const L = pathLen(g.st), ch = hyp(g.st[0].x - g.st.at(-1).x, g.st[0].y - g.st.at(-1).y); if (L > 2.5 * hMed0 && ch / L > 0.9) g.lineCand = true; }
  const edims = [], leaders = [];
  const orient = (a, b) => { const ang = Math.atan2(b.y - a.y, b.x - a.x), dh = Math.abs(angDiff(2 * ang, 0)) / 2, dv = Math.abs(angDiff(2 * ang, Math.PI)) / 2; return dh < 20 * DEG ? 'H' : dv < 20 * DEG ? 'V' : null; };
  for (const cnd of cand.concat(glyph.filter(g => g.lineCand))) {
    const st = cnd.st, a = st[0], b = st.at(-1), o = orient(a, b); if (!o) continue;
    const ends = [a, b], ticks = [];
    for (const g of glyph) {
      if (g.st === st || g.tick) continue; const sz = Math.max(g.b.w, g.b.h); if (sz > 1.8 * hMed0) continue;
      const gl = pathLen(g.st), gch = hyp(g.st[0].x - g.st.at(-1).x, g.st[0].y - g.st.at(-1).y); if (gch / Math.max(1e-6, gl) < 0.8) continue; // kvačica je ravna crtica
      // kvačica prelazi crtu (s obje strane), inače je to npr. crtica do natpisa
      const lc = o === 'H' ? (a.y + b.y) / 2 : (a.x + b.x) / 2, lo2 = o === 'H' ? g.b.y0 : g.b.x0, hi2 = o === 'H' ? g.b.y1 : g.b.x1, ext2 = hi2 - lo2;
      const u0 = o === 'H' ? g.b.x0 : g.b.y0, u1 = o === 'H' ? g.b.x1 : g.b.y1, la0 = o === 'H' ? Math.min(a.x, b.x) : Math.min(a.y, b.y), la1 = o === 'H' ? Math.max(a.x, b.x) : Math.max(a.y, b.y);
      if (ext2 > 0.3 * hMed0 && (lc - lo2 < 0.15 * ext2 || hi2 - lc < 0.15 * ext2) && (u1 - la1 > 0.9 * hMed0 || la0 - u0 > 0.9 * hMed0)) continue;
      const k = ends.findIndex(e => hyp((g.b.x0 + g.b.x1) / 2 - e.x, (g.b.y0 + g.b.y1) / 2 - e.y) < Math.max(0.9 * hMed0, sz * 0.8)); if (k >= 0) ticks.push({ g, k });
    }
    let c = o === 'H' ? (a.y + b.y) / 2 : (a.x + b.x) / 2, a0 = o === 'H' ? Math.min(a.x, b.x) : Math.min(a.y, b.y), a1 = o === 'H' ? Math.max(a.x, b.x) : Math.max(a.y, b.y);
    if (!ticks.some(t => t.k === 0) || !ticks.some(t => t.k === 1)) {
      // križići („×”) na crti, ne nužno na krajevima
      const xs = []; for (const g of glyph) { if (g.st === st || g.tick) continue; const sz = Math.max(g.b.w, g.b.h); if (sz > 1.8 * hMed0 || sz < 0.3 * hMed0) continue;
        const pc = o === 'H' ? (g.b.y0 + g.b.y1) / 2 : (g.b.x0 + g.b.x1) / 2, pu = o === 'H' ? (g.b.x0 + g.b.x1) / 2 : (g.b.y0 + g.b.y1) / 2, ext = o === 'H' ? g.b.h : g.b.w;
        if (Math.abs(pc - c) > 0.35 * Math.max(ext, 0.5 * hMed0) || pu < a0 - hMed0 || pu > a1 + hMed0 || ext < 0.5 * Math.max(g.b.w, g.b.h)) continue; xs.push({ g, pu }); }
      if (xs.length < 2) continue; xs.sort((p1, p2) => p1.pu - p2.pu); const t0 = xs[0], t1 = xs.at(-1); if (t1.pu - t0.pu < 2 * hMed0) continue;
      ticks.length = 0; for (const x of xs) { if (Math.abs(x.pu - t0.pu) < 1.2 * hMed0) ticks.push({ g: x.g, k: 0 }); else if (Math.abs(x.pu - t1.pu) < 1.2 * hMed0) ticks.push({ g: x.g, k: 1 }); } a0 = t0.pu; a1 = t1.pu;
    }
    ticks.forEach(t => t.g.tick = true); if (cnd.lineCand !== undefined) cnd.isDim = true;
    edims.push({ o, c, a0, a1, pts: st });
    if (!dimLines.includes(st)) dimLines.push(st);
  }
  // pokazna crta: veći lomljeni potez od ugla zida do broja
  for (const g of glyph) {
    if (g.tick || g.isDim) continue; const sz = Math.max(g.b.w, g.b.h); if (sz < 1.5 * hMed0) continue;
    const id = rdpIdx(g.st, hMed0 * 0.3); if (id.length < 2 || id.length > 9) continue;
    // dugi krakovi moraju biti vodoravni/okomiti; kratki krakovi na kraju su strelica
    const legMin = (columns.some(c0 => [g.st[0], g.st.at(-1)].some(p => p.x > c0.bb.x0 - 2 * E && p.x < c0.bb.x1 + 2 * E && p.y > c0.bb.y0 - 2 * E && p.y < c0.bb.y1 + 2 * E)) ? 1.2 : 2) * hMed0;
    let ok = true, longLegs = 0, lastLong = 0; for (let k = 1; k < id.length; k++) { const p = g.st[id[k - 1]], q = g.st[id[k]]; if (hyp(q.x - p.x, q.y - p.y) > legMin) { longLegs++; lastLong = k; if (!orient(p, q)) ok = false; } }
    let legLen = 0; for (let k = 1; k <= lastLong; k++) { const p = g.st[id[k - 1]], q = g.st[id[k]]; const L2 = hyp(q.x - p.x, q.y - p.y); if (L2 > legMin) legLen += L2; }
    const s0 = g.st[id[0]], s1 = g.st[id.at(-1)], nearWall = p => W.some(w => !w.view && Math.abs((w.o === 'H' ? p.y : p.x) - w.c) < 3 * E && (w.o === 'H' ? p.x : p.y) > w.e0 - 4 * E && (w.o === 'H' ? p.x : p.y) < w.e1 + 4 * E);
    const nearCol = p => columns.some(c => p.x > c.bb.x0 - 2 * E && p.x < c.bb.x1 + 2 * E && p.y > c.bb.y0 - 2 * E && p.y < c.bb.y1 + 2 * E);
    const fromCol = nearCol(s0) || nearCol(s1);
    if (!fromCol && (sz < 3 * hMed0 || id.length < 3)) continue;
    let firstLong = 1; while (firstLong < id.length && hyp(g.st[id[firstLong]].x - g.st[id[firstLong - 1]].x, g.st[id[firstLong]].y - g.st[id[firstLong - 1]].y) <= legMin) firstLong++;
    const lead0 = firstLong - 1 > 0 && hyp(g.st[id[firstLong - 1]].x - g.st[0].x, g.st[id[firstLong - 1]].y - g.st[0].y) < 2 * hMed0 ? id[firstLong - 1] : 0; // kratki početni krak od ugla
    if (!ok || longLegs < 1 || legLen < 0.75 * pathLen(g.st.slice(lead0, id[lastLong] + 1)) || legLen < (fromCol ? 1.5 : 3.5) * hMed0) continue;
    if (!nearWall(s0) && !nearWall(s1) && !fromCol) continue;
    g.leader = { pts: id.slice(0, lastLong + 1).map(k => g.st[k]), tail: id.slice(lastLong).map(k => g.st[k]) };
  }
  for (let k = glyph.length - 1; k >= 0; k--) { const g = glyph[k]; if (g.tick || g.isDim) glyph.splice(k, 1); else if (g.leader) { leaders.push(g.leader); glyph.splice(k, 1); } }
  const hMed = Math.max(E, median(glyph.map(g => Math.max(g.b.w, g.b.h)).filter(v => v < 0.08 * D)) || E * 2);
  // strelica „<” / „>” (dva kraka, simetrična oko vodoravne ili okomite osi)
  for (const g of glyph) {
    const sz = Math.max(g.b.w, g.b.h); if (sz > 7 * hMed) continue;
    const id = rdpIdx(g.st, Math.max(1, sz * 0.15)); if (id.length !== 3) continue;
    const v = g.st[id[1]], p1 = g.st[id[0]], p2 = g.st[id[2]];
    const l1 = hyp(p1.x - v.x, p1.y - v.y), l2 = hyp(p2.x - v.x, p2.y - v.y); if (Math.min(l1, l2) < 0.3 * sz || Math.max(l1, l2) > 2.2 * Math.min(l1, l2)) continue;
    const a1 = Math.atan2(p1.y - v.y, p1.x - v.x), a2 = Math.atan2(p2.y - v.y, p2.x - v.x), open = Math.abs(angDiff(a1, a2));
    if (open < 30 * DEG || open > 150 * DEG) continue;
    const dir = { x: (p1.x - v.x) / l1 + (p2.x - v.x) / l2, y: (p1.y - v.y) / l1 + (p2.y - v.y) / l2 }, da = Math.atan2(dir.y, dir.x);
    const off = Math.min(...[0, 90, 180, -90].map(t => Math.abs(angDiff(da, t * DEG))));
    if (off > 25 * DEG) continue;
    g.chev = { v, dir: { x: dir.x / hyp(dir.x, dir.y), y: dir.y / hyp(dir.x, dir.y) }, ax: Math.abs(dir.x) > Math.abs(dir.y) ? 'H' : 'V' };
  }
  // strelica ne smije biti presječena drugim potezom (npr. krakovi znamenke „4”)
  const crossPoly = (P1, P2) => { for (let i = 1; i < P1.length; i++) for (let j = 1; j < P2.length; j++) { const p = P1[i - 1], q = P1[i], r = P2[j - 1], s3 = P2[j]; const d = (q.x - p.x) * (s3.y - r.y) - (q.y - p.y) * (s3.x - r.x); if (Math.abs(d) < 1e-9) continue; const t = ((r.x - p.x) * (s3.y - r.y) - (r.y - p.y) * (s3.x - r.x)) / d, u = ((r.x - p.x) * (q.y - p.y) - (r.y - p.y) * (q.x - p.x)) / d; if (t > 0.08 && t < 0.92 && u > 0.02 && u < 0.98) return true; } return false; };
  for (const g of glyph) { if (!g.chev) continue; const P1 = rdpIdx(g.st, 1).map(k => g.st[k]);
    for (const h of glyph) { if (h === g) continue; const b = h.b; if (b.x1 < g.b.x0 || b.x0 > g.b.x1 || b.y1 < g.b.y0 || b.y0 > g.b.y1) continue; if (crossPoly(P1, rdpIdx(h.st, 1).map(k => h.st[k]))) { g.chev = null; break; } } }
  const segX = (p, q, r, s2) => { const d = (q.x - p.x) * (s2.y - r.y) - (q.y - p.y) * (s2.x - r.x); if (Math.abs(d) < 1e-9) return false; const t = ((r.x - p.x) * (s2.y - r.y) - (r.y - p.y) * (s2.x - r.x)) / d, u = ((r.x - p.x) * (q.y - p.y) - (r.y - p.y) * (q.x - p.x)) / d; return t >= 0 && t <= 1 && u >= 0 && u <= 1; };
  const ctr = b => ({ x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 });
  const wallSegsXY = W.filter(w => !w.view && !w.obj).map(w => w.o === 'H' ? [{ x: w.e0, y: w.c }, { x: w.e1, y: w.c }] : [{ x: w.c, y: w.e0 }, { x: w.c, y: w.e1 }]);
  // brojevi s dviju strana zida ili kotne crte nisu isti natpis
  const separated = (a, b) => dimLines.some(dl => segX(ctr(a), ctr(b), dl[0], dl.at(-1))) || leaders.some(ld => ld.pts.some((p, k) => k > 0 && segX(ctr(a), ctr(b), ld.pts[k - 1], p))) || wallSegsXY.some(([p, q]) => { if (!segX(ctr(a), ctr(b), p, q)) return false; const h = p.y === q.y, c0 = h ? p.y : p.x, clear = r => (h ? r.y1 : r.x1) < c0 || (h ? r.y0 : r.x0) > c0; return clear(a) && clear(b); }); /* zid razdvaja samo ako ga nijedan dio broja ne prelazi */
  // crtica od zida do natpisa „d=…” (debljina tog zida)
  for (const g of glyph) {
    if (g.chev) continue; const L = pathLen(g.st), p0 = g.st[0], p1 = g.st.at(-1), ch = hyp(p0.x - p1.x, p0.y - p1.y); if (L < 0.9 * hMed0 || L > 5 * hMed0 || ch / L < 0.88) continue;
    for (const [pw, pf] of [[p0, p1], [p1, p0]]) {
      const w = W.find(w2 => !w2.view && !w2.obj && Math.abs((w2.o === 'H' ? pw.y : pw.x) - w2.c) < 0.8 * E && (w2.o === 'H' ? pw.x : pw.y) > w2.e0 - E && (w2.o === 'H' ? pw.x : pw.y) < w2.e1 + E); if (!w) continue;
      const ang = Math.atan2(pf.y - pw.y, pf.x - pw.x), off = w.o === 'H' ? Math.abs(Math.sin(ang)) : Math.abs(Math.cos(ang)); if (off < 0.4) continue;
      g.dash = { wall: w.id, o: w.o, c: w.c, p: pw, free: pf }; break;
    }
  }
  const uf = UF(glyph.length);
  for (let i = 0; i < glyph.length; i++) for (let j = i + 1; j < glyph.length; j++) {
    const a = glyph[i].b, b = glyph[j].b; const dx = Math.max(0, a.x0 - b.x1, b.x0 - a.x1), dy = Math.max(0, a.y0 - b.y1, b.y0 - a.y1);
    const ovy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0), ovx = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
    const sameLine = (dy === 0 && ovy >= 0.6 * Math.min(a.h, b.h) && dx <= Math.max(0.9 * hMed, 0.6 * Math.min(a.h, b.h))) || (dx === 0 && ovx >= 0.6 * Math.min(a.w, b.w) && dy <= Math.max(0.9 * hMed, 0.6 * Math.min(a.w, b.w)));
    // blizu, ali samo ako se preklapaju po jednoj osi (brojevi napisani „u kut” jedan drugome ostaju odvojeni)
    const close = Math.max(dx, dy) <= 0.6 * hMed && (ovx >= 0.3 * Math.min(a.w, b.w) || ovy >= 0.3 * Math.min(a.h, b.h) || (dx === 0 && dy === 0));
    if ((close || sameLine) && !separated(a, b)) uf.union(i, j);
  }
  glyph.forEach((g, i) => { if (!g.dash) return; let bj = -1, bd = 1.5 * hMed; glyph.forEach((h, j) => { if (j === i || h.dash || h.chev) return; const b = h.b, f = g.dash.free; const d = Math.max(0, b.x0 - f.x, f.x - b.x1, b.y0 - f.y, f.y - b.y1); if (d < bd) { bd = d; bj = j; } }); if (bj >= 0) uf.union(i, bj); });
  let groups = new Map(); glyph.forEach((g, i) => { const r = uf.find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(g); });
  // skupina od samih strelica pripaja se broju prema kojem strelica pokazuje
  groups = [...groups.values()];
  for (const g of groups.filter(x => x.every(y => y.chev))) {
    const c = g[0].chev; let best = null, bd = 4 * hMed;
    for (const h of groups) { if (h === g || !h.length || h.every(y => y.chev)) continue; const b = bbox(h.flatMap(x => x.st)), q = ctr(b); const along = (q.x - c.v.x) * c.dir.x + (q.y - c.v.y) * c.dir.y, side = Math.abs((q.x - c.v.x) * c.dir.y - (q.y - c.v.y) * c.dir.x); const gap = Math.max(0, c.ax === 'H' ? Math.max(b.x0 - c.v.x, c.v.x - b.x1) : Math.max(b.y0 - c.v.y, c.v.y - b.y1)); if (along > 0 && side < 1.5 * hMed + (c.ax === 'H' ? b.h : b.w) / 2 && gap < bd) { bd = gap; best = h; } }
    if (best) { best.push(...g); g.length = 0; }
  }
  // „strelica” mora imati par na drugoj strani broja; sama je zapravo znamenka (npr. 7 napisana okomito)
  for (const g of groups) { const chs = g.filter(x => x.chev); if (!chs.length || chs.length === g.length) continue;
    const ok = chs.some(a => chs.some(b => b !== a && a.chev.ax === b.chev.ax && a.chev.dir.x * b.chev.dir.x + a.chev.dir.y * b.chev.dir.y < -0.5));
    if (ok) continue;
    // jedna strelica vrijedi samo ako je broj u smjeru u koji je okrenuta (npr. „<600”)
    const tb = bbox(g.filter(x => !x.chev).flatMap(x => x.st)), tc = { x: (tb.x0 + tb.x1) / 2, y: (tb.y0 + tb.y1) / 2 };
    for (const x of chs) { const c = x.chev, along = (tc.x - c.v.x) * c.dir.x + (tc.y - c.v.y) * c.dir.y, side = Math.abs((tc.x - c.v.x) * c.dir.y - (tc.y - c.v.y) * c.dir.x); if (!(along > 0.5 * hMed && side < 0.8 * along)) x.chev = null; } }
  // tekst izvan para strelica (npr. „d=15 <165>”) je drugi natpis
  for (const g of [...groups]) { const chs = g.filter(x => x.chev); if (chs.length < 2) continue; const ax = chs[0].chev.ax; if (chs.some(x => x.chev.ax !== ax)) continue;
    const vs = chs.map(x => ax === 'H' ? x.chev.v.x : x.chev.v.y), lo = Math.min(...vs), hi = Math.max(...vs); if (hi - lo < hMed) continue;
    const out = g.filter(x => { if (x.chev) return false; const c = ax === 'H' ? (x.b.x0 + x.b.x1) / 2 : (x.b.y0 + x.b.y1) / 2; return c < lo - 0.2 * hMed || c > hi + 0.2 * hMed; });
    if (!out.length || out.length === g.length) continue; const rest = g.filter(x => !out.includes(x)); g.length = 0; g.push(...rest);
    const left = out.filter(x => (ax === 'H' ? (x.b.x0 + x.b.x1) / 2 : (x.b.y0 + x.b.y1) / 2) < lo), right = out.filter(x => !left.includes(x)); if (left.length) groups.push(left); if (right.length) groups.push(right); }
  for (const g of [...groups]) {
    const hs = g.filter(x => x.chev && x.chev.ax === 'H'), vs = g.filter(x => x.chev && x.chev.ax === 'V'); if (!hs.length || !vs.length) continue;
    const cH = ctr(bbox(hs.flatMap(x => x.st))), cV = ctr(bbox(vs.flatMap(x => x.st))), gH = [], gV = [];
    for (const x of g) { if (x.chev) { (x.chev.ax === 'H' ? gH : gV).push(x); continue; } const c = ctr(x.b); (Math.abs(c.y - cH.y) / Math.max(1, Math.abs(c.x - cV.x)) < 1 ? gH : gV).push(x); }
    g.length = 0; g.push(...gH); groups.push(gV);
  }
  const labels = [];
  for (const g of groups) {
    if (!g.length) continue;
    const pts = g.flatMap(x => x.st), b = bbox(pts), rb = bbox(g.flatMap(x => x.raw)), ch = g.find(x => x.chev);
    const txt = g.filter(x => !x.chev), dg = g.find(x => x.dash);
    labels.push({ ocrKey: null, dlead: dg ? dg.dash : null, src: 'ink', strokes: g.map(x => x.st), rawStrokes: txt.map(x => x.raw), bb: b, cx: (b.x0 + b.x1) / 2, cy: (b.y0 + b.y1) / 2, aspect: (txt.length ? bbox(txt.flatMap(x => x.st)) : b).w / Math.max(1, (txt.length ? bbox(txt.flatMap(x => x.st)) : b).h), chev: ch ? ch.chev.ax : null, chevOnly: !txt.length, sig: 'i:' + [rb.x0, rb.y0, rb.x1, rb.y1].map(Math.round).join(',') });
  }
  const rooms = [];
  const blkC = new Map(), blkD = new Map(); for (const o of items) if (o && o.blk && o.blk.main && o.blk.c && o.blk.t !== 'stube' && !/^(krovni|otvorp|terasa|greda|prag|stup)$/.test(o.blk.t || '')) { blkC.set(o.blk.id, o.blk.c); if (o.blk.dv) blkD.set(o.blk.id, o.blk.dv); } /* natpis mjera prozora/vrata iz bloka ide točno uz svoj otvor */
  for (const t of texts) {
    const fk = (t.fs || 18) / 18, p = R({ x: t.x + String(t.text).length * 5 * fk, y: t.y - 7 * fk });
    if (t.layer === 'kote') {
      const w = String(t.text).length * 10 * fk, h = 20 * fk;
      labels.push({ syn0: !!t.syn0, src: 'text', cm: !!(t.blk || t.lz), text: String(t.text), bb: { x0: p.x - w / 2, x1: p.x + w / 2, y0: p.y - h / 2, y1: p.y + h / 2, w, h }, cx: p.x, cy: p.y, aspect: t.dir === 'V' ? 0.05 : 99, typed: true, tdir: t.dir === 'V' || t.dir === 'H' ? t.dir : null, tfix: !!t.dirFix, chev: /[<>]/.test(String(t.text)) ? 'auto' : null, blkc: t.blk && blkC.has(t.blk.id) ? R(blkC.get(t.blk.id)) : null, tsv: R(t.dir === 'V' ? { x: 0, y: 1 } : { x: -1, y: 0 }), /* smjer čitanja natpisa (za 80+40: prvi broj na početku teksta) */ sig: 't:' + Math.round(t.x) + ',' + Math.round(t.y) + ':' + t.text, pin: t.pin && t.pin.a && t.pin.b ? Object.assign({ a: R(t.pin.a), b: R(t.pin.b), outer: !!t.pin.outer, blk: !t.pin.od }, t.pin.od ? { od: true, sa: t.pin.sa || null, sb: t.pin.sb || null } : {}) : null, gap: t.gap && Number.isFinite(t.gap.si) && Number.isFinite(t.gap.sj) ? { ax: t.gap.ax, si: t.gap.si, sj: t.gap.sj } : null, dg: t.dg && t.dg.a && t.dg.b ? { a: R(t.dg.a), b: R(t.dg.b) } : null });
    } else if (t.layer === 'opisi') rooms.push({ text: String(t.text), x: p.x, y: p.y });
    else if (t.layer === 'pogled') rooms.push({ text: String(t.text), x: p.x, y: p.y, view: true });
  }
  labels.forEach(l => { if (l.src === 'ink') l.ocrKey = l.sig + '#' + (l.rawStrokes || []).length; });
  labels.forEach(l => { if (l.src === 'ink' && !l.chevOnly && l.strokes.length === 1 && Math.max(l.bb.w, l.bb.h) < 0.75 * hMed) l.tiny = true; }); // točkica/petljica, nije broj
  labels.sort((a, b) => (a.cy - b.cy) || (a.cx - b.cx));
  labels.forEach((l, i) => { l.id = i; l.n = i + 1; });
  // brojevi uz poprečnu crtu otvora: lijevo/gore = širina, desno/dolje = visina
  cross.forEach((cl, ci) => {
    const pick = { w: null, h: null }, gap = { w: Infinity, h: Infinity };
    for (const l of labels) {
      if (l.chev) continue; if (l.typed && !(/^\s*\d+(?:[.,]\d+)?\s*$/.test(l.text) && num(l.text) < 250)) continue; const b = l.bb;
      const ov = cl.o === 'V' ? Math.min(b.y1, cl.a1) - Math.max(b.y0, cl.a0) : Math.min(b.x1, cl.a1) - Math.max(b.x0, cl.a0); if (ov < 0) continue;
      let part = null, g;
      if (cl.o === 'V') { if (b.x1 <= cl.c + E * 0.5) { part = 'w'; g = cl.c - b.x1; } else if (b.x0 >= cl.c - E * 0.5) { part = 'h'; g = b.x0 - cl.c; } }
      else { if (b.y1 <= cl.c + E * 0.5) { part = 'w'; g = cl.c - b.y1; } else if (b.y0 >= cl.c - E * 0.5) { part = 'h'; g = b.y0 - cl.c; } }
      if (part && g < 2 * hMed && g < gap[part]) { gap[part] = g; pick[part] = l; }
    }
    if (pick.h && !pick.w) { pick.w = pick.h; pick.h = null; } // samo jedan broj (etažni elaborat) = širina, bez obzira na stranu
    for (const part of ['w', 'h']) if (pick[part]) pick[part].role = { cross: ci, part };
  });
  niches.forEach((n, ni) => {
    if (n.wall == null) return; const lo = Math.min(n.cW, n.nc), hi = Math.max(n.cW, n.nc), rect = n.o === 'H' ? { x0: n.s0, x1: n.s1, y0: lo, y1: hi } : { x0: lo, x1: hi, y0: n.s0, y1: n.s1 }, zs = Math.sign(n.nc - n.cW) || 1, dDir = n.o === 'H' ? 'V' : 'H';
    // brojevi uz zub: smjer pisanja odlučuje (uzduž zida = širina, poprijeko = dubina); bliži zubu ima prednost
    const cands = [];
    for (const l of labels) { if (l.role || l.chev || l.nrole || l.chevOnly) continue; const b = l.bb, dist = Math.max(0, rect.x0 - b.x1, b.x0 - rect.x1, rect.y0 - b.y1, b.y0 - rect.y1); if (dist > 1.2 * hMed) continue;
      const v = n.o === 'H' ? l.cy : l.cx, u = n.o === 'H' ? l.cx : l.cy, bv0 = n.o === 'H' ? b.y0 : b.x0, bv1 = n.o === 'H' ? b.y1 : b.x1, far = (v - n.cW) * zs < -0.2 * hMed ? 0.6 * hMed : 0;
      const along = u > n.s0 - 0.5 * hMed && u < n.s1 + 0.5 * hMed; // širina mora stajati uz sam zub
      const inBand = (v > lo && v < hi) || (dist === 0 && bv0 < hi - 0.15 * (hi - lo) && bv1 > lo + 0.15 * (hi - lo));
      cands.push({ l, score: dist + far, dir: l.typed ? null : l.aspect >= 1.3 ? 'H' : l.aspect <= 0.77 ? 'V' : null, inBand, along }); }
    cands.sort((a, b) => a.score - b.score);
    const d = cands.find(c => c.dir === dDir || (!c.dir && c.inBand)); let w = cands.find(c => c !== d && c.along && (c.dir === n.o || (!c.dir && !c.inBand)));
    if (d) d.l.nrole = { ni, part: 'd' }; if (w) w.l.nrole = { ni, part: 'w' };
  });
  // broj uz nacrtanu kotnu liniju
  edims.forEach((dl, di) => {
    let best = null, bd = 2.2 * hMed;
    for (const l of labels) { if (l.role || l.edim != null) continue; const b = l.bb; const ov = dl.o === 'V' ? Math.min(b.y1, dl.a1) - Math.max(b.y0, dl.a0) : Math.min(b.x1, dl.a1) - Math.max(b.x0, dl.a0); if (ov < 0.3 * (dl.o === 'V' ? b.h : b.w)) continue; const g = dl.o === 'V' ? Math.max(0, b.x0 - dl.c, dl.c - b.x1) : Math.max(0, b.y0 - dl.c, dl.c - b.y1); if (g < bd) { bd = g; best = l; } }
    if (best) { best.edim = di; best.chev = null; best.chevOnly = false; dl.label = best; }
  });
  // broj na kraju pokazne crte
  leaders.forEach((ld, li) => {
    const ends = [ld.pts[0], ld.pts.at(-1)]; let best = null, bd = 1.8 * hMed, bk = -1;
    for (const l of labels) { if (l.role || l.edim != null || l.leader != null) continue; for (const k of [0, 1]) { const e = ends[k], b = l.bb; const d = Math.max(0, b.x0 - e.x, e.x - b.x1, b.y0 - e.y, e.y - b.y1); if (d < bd) { bd = d; best = l; bk = k; } } }
    if (!best) return;
    const T = ends[bk], S = ends[1 - bk];
    const p1a = bk === 1 ? ld.pts[1] : ld.pts.at(-2), lastLeg = { x: T.x - (bk === 1 ? ld.pts.at(-2) : ld.pts[1]).x, y: T.y - (bk === 1 ? ld.pts.at(-2) : ld.pts[1]).y };
    const ax = ld.pts.length === 2 ? (Math.abs(lastLeg.x) > Math.abs(lastLeg.y) ? 'H' : 'V') : (best.aspect >= 1 ? 'H' : 'V');
    const d = Math.sign(ax === 'H' ? best.cx - S.x : best.cy - S.y) || 1;
    const p1 = bk === 1 ? ld.pts[1] : ld.pts.at(-2), side = Math.sign(ax === 'H' ? p1.y - S.y : p1.x - S.x);
    Object.assign(ld, { S, ax, d, side, label: best }); best.leader = li; best.chev = null; best.chevOnly = false;
  });

  // stup: brojevi uz stranice = veličina; kota s križićima ili pokazna crta do stupa = udaljenost od zida
  columns.forEach((col, ci) => {
    const b0 = col.bb;
    edims.forEach(dl => { const ends = [dl.a0, dl.a1]; for (const k of [0, 1]) { const e = ends[k], inC = dl.o === 'H' ? (Math.abs(e - b0.x0) < 3 * E || Math.abs(e - b0.x1) < 3 * E) && dl.c > b0.y0 - 2 * E && dl.c < b0.y1 + 2 * E : (Math.abs(e - b0.y0) < 3 * E || Math.abs(e - b0.y1) < 3 * E) && dl.c > b0.x0 - 2 * E && dl.c < b0.x1 + 2 * E; if (inC) { dl.col = ci; dl.colEnd = k; } } });
    leaders.forEach(ld => { if (!ld.S) return; const p = ld.S; if (p.x > b0.x0 - 2 * E && p.x < b0.x1 + 2 * E && p.y > b0.y0 - 2 * E && p.y < b0.y1 + 2 * E) ld.col = ci; });
    for (const l of labels) { if (l.role || l.edim != null || l.leader != null || l.nrole || l.chev) continue; const b = l.bb;
      const gx = Math.max(0, b.x0 - b0.x1, b0.x0 - b.x1), gy = Math.max(0, b.y0 - b0.y1, b0.y0 - b.y1); if (Math.max(gx, gy) > 1.5 * hMed) continue;
      const ovx = Math.min(b.x1, b0.x1) - Math.max(b.x0, b0.x0), ovy = Math.min(b.y1, b0.y1) - Math.max(b.y0, b0.y0);
      if (gy > 0 && ovx > -0.5 * hMed && col.wl == null) { l.crole = { ci, part: 'w' }; col.wl = l; } else if (gx > 0 && ovy > -0.5 * hMed && col.hl == null) { l.crole = { ci, part: 'h' }; col.hl = l; }
      else if (gx === 0 && gy === 0) { const lx = (b.x0 + b.x1) / 2, ly = (b.y0 + b.y1) / 2; /* broj dira stup: strana po središtu broja */ if ((lx < b0.x0 || lx > b0.x1) && col.hl == null) { l.crole = { ci, part: 'h' }; col.hl = l; } else if ((ly < b0.y0 || ly > b0.y1) && col.wl == null) { l.crole = { ci, part: 'w' }; col.wl = l; } } }
  });
  // stubište: kote i brojevi uz krak
  stairs.forEach((S, si) => {
    const pad = 0.6 * hMed, nearA = v => Math.abs(v - S.a0) < 1.5 * E || Math.abs(v - S.a1) < 1.5 * E, nearC = v => Math.abs(v - S.c0) < 2.5 * E || Math.abs(v - S.c1) < 2.5 * E;
    edims.forEach(dl => { if (dl.col != null || dl.stair != null) return;
      if (dl.o === S.o && (nearA(dl.a0) || nearA(dl.a1)) && dl.c > S.c0 - 3 * E && dl.c < S.c1 + 3 * E) { dl.stair = si; dl.spart = 'w'; }
      else if (dl.o !== S.o && nearC(dl.a0) && nearC(dl.a1) && dl.c > S.a0 - 3 * E && dl.c < S.a1 + 3 * E) { dl.stair = si; dl.spart = 'L'; } });
    const x0 = S.o === 'H' ? S.a0 : S.c0, x1 = S.o === 'H' ? S.a1 : S.c1, y0 = S.o === 'H' ? S.c0 : S.a0, y1 = S.o === 'H' ? S.c1 : S.a1;
    for (const l of labels) {
      if (l.edim != null) { if (edims[l.edim].stair === si) { l.stairIn = si; l.spart = edims[l.edim].spart; } continue; }
      if (l.leader != null || l.role || l.chev || l.stairIn != null) continue;
      if (l.cx > x0 - pad && l.cx < x1 + pad && l.cy > y0 - pad && l.cy < y1 + pad) { l.stairIn = si; const runDir = S.o === 'H' ? 'V' : 'H', txtDir = l.aspect >= 1 ? 'H' : 'V'; l.spart = txtDir === runDir ? 'L' : 'w'; }
    }
  });
  const stairBlk = items.filter(o => isStBlk(o) && o.blk.t === 'stube' && o.blk.main && o.blk.c && o.blk.dv).map(o => ({ id: o.blk.id, P: o.blk.P || {}, iz: o.blk.iz || null, s: o.blk.s || o.blk.sFix || 0, pos: o.blk.pos || null, c: R(o.blk.c), dv: R(o.blk.dv) }));
  const krovBlk = items.filter(o => o && o.blk && /^(krovni|otvorp|terasa|greda|prag|stup)$/.test(o.blk.t || '') && o.blk.main && o.blk.c && o.blk.dv).map(o => ({ id: o.blk.id, t: o.blk.t, P: o.blk.P || {}, c: R(o.blk.c), dv: R(o.blk.dv), s: o.blk.s || o.blk.sFix || 0 }));
  return { far, krovBlk, winRects, stairs, stairBlk, theta, D, E, hMed, maxGap, sk, segs, wallSegs, arcs, diag, circles, cross, niches, columns, edims, leaders, dimLines, lines, walls: W, axes, jogs, openings, labels, rooms, texts, raw: floor };
}

/* ---------------- 2. MJERE → OGRANIČENJA → USKLAĐIVANJE ---------------- */
const DEFAULTS = { ext: 30, int: 12, tol: 1, uskl: 3 };

function isView(w, st) { return !!(w.view || (st && st.wallView && st.wallView[wallKey(w)])); }
function wallT(m, w, st) { if (w.obj || isView(w, st)) return 0; { const sf = st._softT && st._softT[wallKey(w)]; if (sf) return sf; } /* v2.37: debljina prilagođena zbog male razlike mjera ima prednost */ if (w.tLabel) return w.tLabel; const ov = st.wallT && st.wallT[wallKey(w)]; if (ov) return ov; const dt = st._derivedT && st._derivedT[wallKey(w)]; if (dt) return dt; return w.exterior ? st.settings.ext : st.settings.int; }
/* v2.58: vanjski dijelovi zidova (pročelja): samo onaj dio zida koji je stvarno na rubu zgrade, krajevi na najbližim osima */
function geoSides(m) { const E = m.E, out = [];
  for (const w of m.walls) { if (!w.exterior || w.view || w.obj || !w.end) continue; const ax = w.o === 'H' ? 'X' : 'Y', A = m.axes[ax], N = 48, ext = [];
    for (let k = 0; k <= N; k++) { const u = w.e0 + (w.e1 - w.e0) * k / N; let lo = false, hi = false; for (const q of m.walls) { if (q === w || q.obj || q.view || q.o !== w.o || u < q.e0 - 0.5 * E || u > q.e1 + 0.5 * E) continue; if (q.c < w.c - E) lo = true; if (q.c > w.c + E) hi = true; } ext.push(!lo ? -1 : !hi ? 1 : 0); }
    let k = 0; while (k <= N) { if (!ext[k]) { k++; continue; } const sd = ext[k], k0 = k; while (k <= N && ext[k] === sd) k++; const u0 = w.e0 + (w.e1 - w.e0) * Math.max(0, k0 - 0.5) / N, u1 = w.e0 + (w.e1 - w.e0) * Math.min(N, k - 0.5) / N; if (u1 - u0 < 1.5 * E) continue;
      const near = u => { let b = -1, bd = Infinity; A.forEach((a, i) => { const d = Math.abs(a.s - u); if (d < bd) { bd = d; b = i; } }); return b; }, i = near(u0), j = near(u1); if (i < 0 || j < 0 || i === j) continue;
      out.push({ w, ax, i: A[i].s <= A[j].s ? i : j, j: A[i].s <= A[j].s ? j : i, side: sd, key: wallKey(w) + (k0 > 0 || k <= N ? '@' + Math.round(A[i].s) : '') }); } }
  return out; }
/* v2.58: pročelja (vanjski zidovi) s duljinom vanjskog lica u cm iz rješenja – za usporedbu s geodetskom podlogom */
function facades(m, st, out) { if (!out || !out.sol) return []; const X = out.sol.X.x, Y = out.sol.Y.x, L = [];
  for (const G of geoSides(m)) { const w = G.w, A = w.o === 'H' ? X : Y, B = w.o === 'H' ? Y : X, ta = axisT(m, G.ax, G.i, st), tb = axisT(m, G.ax, G.j, st), t = wallT(m, w, st);
    const a0 = A[G.i] - ta / 2, a1 = A[G.j] + tb / 2, c = B[w.lineAxis] + G.side * t / 2; if (!Number.isFinite(a0) || !Number.isFinite(a1) || !Number.isFinite(c)) continue;
    L.push({ key: G.key, o: w.o, len: a1 - a0, a0, a1, c, side: G.side, p: w.o === 'H' ? { x: (a0 + a1) / 2, y: c } : { x: c, y: (a0 + a1) / 2 } }); }
  const names = { 'H-1': 'Gornje', 'H1': 'Donje', 'V-1': 'Lijevo', 'V1': 'Desno' }, cnt = {};
  L.sort((p, q) => (p.o + p.side).localeCompare(q.o + q.side) || (p.o === 'H' ? p.p.x - q.p.x : p.p.y - q.p.y));
  for (const f of L) { const k = f.o + f.side; cnt[k] = (cnt[k] || 0) + 1; f.n = cnt[k]; }
  for (const f of L) { const k = f.o + f.side, tot = L.filter(q => q.o + q.side === k).length; f.name = (names[k] || k) + ' pročelje' + (tot > 1 ? ' ' + f.n : ''); }
  return L; }
function wallKey(w) { return w.o + ':' + Math.round(w.c) + ':' + Math.round(w.e0) + ':' + Math.round(w.e1); }
function axisT(m, ax, i, st) { // tipična debljina zida koji leži na osi
  const o = ax === 'X' ? 'V' : 'H'; const ts = m.walls.filter(w => w.o === o && w.lineAxis === i).map(w => wallT(m, w, st)); return ts.length ? Math.max(...ts) : 0;
}
function perpWallT(m, w, k, st) { // debljina okomitog zida na kraju k
  if (!w.snapped[k]) return 0; const ax = w.o === 'H' ? 'X' : 'Y', i = w.end[k], o = w.o === 'H' ? 'V' : 'H';
  let t = 0; for (const q of m.walls) if (q.o === o && q.lineAxis === i && w.c >= q.e0 - m.E * 1.5 && w.c <= q.e1 + m.E * 1.5) t = Math.max(t, wallT(m, q, st));
  return t || axisT(m, ax, i, st);
}

function labelInfo(m, l, st) {
  const ov = (st.labels && st.labels[l.sig]) || {};
  let text = ov.value != null ? ov.value : (l.text != null ? l.text : (l.rec || ''));
  const p = parseLabel(text, { cm: ov.value == null && l.cm });
  if (p.kind === 'nepoznato' && p.guess > 0 && ((ov.value != null && String(ov.value).trim() !== '') || (ov.value == null && l.src === 'text'))) { p.kind = 'mjera'; p.v = p.guess; } // mali broj koji je korisnik sam upisao/potvrdio
  let kind = ov.kind && ov.kind !== 'auto' ? ov.kind : autoKind(l, p);
  if (['osirina', 'ovisina', 'nsirina', 'ndubina', 'ssirina', 'sdubina', 'udaljenost'].includes(kind) && !(p.v > 0) && p.guess > 0) p.v = p.guess;
  if (kind === 'pod' && p.kind !== 'pod') { const mm = /([+\-–]?)\s*(\d+(?:[.,]\d+)?)/.exec(String(text)); if (mm) { p.v = (mm[1] && mm[1] !== '+' ? -1 : 1) * num(mm[2]); } }
  return { text, parsed: p, kind, orient: ov.orient && ov.orient !== 'auto' ? ov.orient : (l.tfix && l.tdir ? l.tdir : null) };
}
function autoKind(l, p) {
  if (p.kind === 'visina' || p.kind === 'dijagonala' || p.kind === 'hgr') return p.kind;
  if (p.zero && !l.chevOnly) return 'mjera'; /* v2.63: Ø / 0 = otvor uz zid */
  if (l.chevOnly || (l.tiny && !(p.v > 0))) return 'zanemari';
  if (l.nrole && (p.kind === 'mjera' || (p.kind === 'nepoznato' && p.guess))) return l.nrole.part === 'w' ? 'nsirina' : 'ndubina';
  if (l.crole && (p.kind === 'mjera' || (p.kind === 'nepoznato' && p.guess))) return l.crole.part === 'w' ? 'ssirina' : 'sdubina';
  if (l.role && p.kind === 'nisa') return 'nisa';
  if (l.role && (p.kind === 'mjera' || (p.kind === 'nepoznato' && p.guess))) return l.role.part === 'w' ? 'osirina' : 'ovisina';
  return p.kind;
}

/* raspon kote u smjeru dir ('H' = vodoravna mjera) */
function spanFor(m, l, dir, st) {
  const u = dir === 'H' ? l.cx : l.cy, v = dir === 'H' ? l.cy : l.cx, bo = dir === 'H' ? 'V' : 'H', ax = dir === 'H' ? 'X' : 'Y';
  let lo = null, hi = null;
  for (const w of m.walls) {
    if (w.o !== bo || v < w.e0 - 0.5 * m.E || v > w.e1 + 0.5 * m.E) continue;
    if (w.c < u && (!lo || w.c > lo.c)) lo = w; if (w.c > u && (!hi || w.c < hi.c)) hi = w;
  }
  if (lo && hi) {
    const tl = wallT(m, lo, st), th = wallT(m, hi, st);
    return { ax, dir, i: lo.lineAxis, j: hi.lineAxis, type: 'unutarnja', tA: tl, tB: th, sketch: hi.c - lo.c, v, add: tl / 2 + th / 2 };
  }
  // vanjska mjera: najbliže pročelje paralelno s kotom
  let f = null, fd = Infinity;
  for (const w of m.walls) { if (w.o !== dir || u < w.e0 - m.E || u > w.e1 + m.E) continue; const d = Math.abs(w.c - v); if (d < fd) { fd = d; f = w; } }
  if (!f || fd > 0.35 * m.D) return null;
  const ta = perpWallT(m, f, 0, st), tb = perpWallT(m, f, 1, st);
  return { ax, dir, i: f.end[0], j: f.end[1], type: 'vanjska', tA: ta, tB: tb, sketch: f.e1 - f.e0, v, add: -(ta / 2 + tb / 2), facade: f };
}

function buildConstraints(m, st) {
  const cons = [], notes = [], roomAmb = [];
  const infos = m.labels.map(l => labelInfo(m, l, st));
  /* natpis bloka vrata/prozora sa samo širinom (npr. „80”) je mjera otvora, ne kota */
  m.labels.forEach((l, k) => { const I = infos[k]; if (l.blkc && !l.pin && I && (I.kind === 'mjera' || (I.kind === 'osirina' && !l.role)) && I.parsed && I.parsed.v > 0) infos[k] /* v2.38: i kad je natpis bloka (samo širina) označen kao „širina otvora” */ = Object.assign({}, I, { kind: 'otvor', parsed: { kind: 'otvor', w: I.parsed.v, h: null } }); });
  // procjena mjerila (cm po jedinici skice)
  const ratios = [];
  const r1 = [], r2 = [];
  m.labels.forEach((l, k) => { const I = infos[k]; if (I.kind !== 'mjera' || !(I.parsed.v > 0) || l.role) return; const fixed = (l.chev !== 'auto' && l.chev) || I.orient; const dir = fixed || (l.aspect >= 0.9 ? 'H' : 'V'); const s = spanFor(m, l, dir, st); if (s && s.sketch > 0) (fixed ? r1 : r2).push({ r: I.parsed.v / s.sketch, v: I.parsed.v }); });
  // pouzdano mjerilo: kote sa strelicama ili zadanim smjerom; inače sve
  /* male mjere (udaljenosti do otvora 10–60) često nisu od zida do zida – za mjerilo radije veće kote */
  const big = a => { const b = a.filter(x => x.v >= 100); return (b.length >= 3 ? b : a).map(x => x.r); };
  let scale = median(big(r1.length ? r1 : r2)) || st.settings.fallbackScale || 1;
  // otvori: polaze od analize, dopunjuju se natpisima
  const ops = m.openings.map(o => ({ ...o, w: null, h: null, p: null, label: null }));
  const opLabels = [];
  // niše: zub (iz analize) i oznaka N š/v uz poprečnu crtu
  const nis = [];
  (m.niches || []).forEach((n, ni) => { if (n.wall == null) return; const o = { ...n, key: 'n:' + Math.round((n.s0 + n.s1) / 2) + ':' + Math.round(n.cW) + ':' + n.o, w: null, d: null, h: null };
    const kv = (st.nicheKind && st.nicheKind[o.key]) || n.forceKind; if (kv && kv !== o.kind) { o.kind = kv; o.room = -o.room; }
    m.labels.forEach((l, k) => { if (!l.nrole || l.nrole.ni !== ni) return; const I = infos[k]; const nv = v => v > 1000 ? Math.round(v) / 100 : v; /* "36,2" uz stup/nišu = cm, ne 36 m */ if (I.kind === 'nsirina' && I.parsed.v > 0) o.w = nv(I.parsed.v); if (I.kind === 'ndubina' && I.parsed.v > 0) o.d = nv(I.parsed.v); });
    nis.push(o); });
  // samostojeći stupovi: veličina iz brojeva uz stranice, položaj iz kota do zida
  m.walls.forEach(w => { delete w.tLabel; });
  // stubište: krak (broj visina, duljina, širina) iz natpisa ili odgovora
  const stairs = (m.stairs || []).map(S => ({ id: S.id, key: S.key, o: S.o, a0: S.a0, a1: S.a1, c0: S.c0, c1: S.c1, nLines: S.n, dir: S.dir, walk: S.walk, n: null, L: null, w: null, podest: null, H: null }));
  const cols = (m.columns || []).map((c, ci) => ({ ci, bb: c.bb, w: null, h: null, pos: {}, key: 'c:' + Math.round(c.c.x) + ':' + Math.round(c.c.y) }));
  m.labels.forEach((l, k) => { if (!l.crole || !cols[l.crole.ci]) return; const I = infos[k], c = cols[l.crole.ci]; const nv = v => v > 1000 ? Math.round(v) / 100 : v; if (I.kind === 'ssirina' && I.parsed.v > 0) c.w = nv(I.parsed.v); if (I.kind === 'sdubina' && I.parsed.v > 0) c.h = nv(I.parsed.v); });
  for (const c of cols) { const ov = st.columns && st.columns[c.key]; if (ov) { if (ov.w > 0 && !c.w) c.w = ov.w; if (ov.h > 0 && !c.h) c.h = ov.h;
    /* vođeno mjerenje: udaljenost stupa od zida (side −1 = zid s manje strane, +1 = s veće) */
    for (const ax of ['X', 'Y']) { const q = ov.pos && ov.pos[ax]; if (!q || !(q.v >= 0) || c.pos[ax]) continue; const W = colWall(m, c.bb, ax, q.side); if (W) c.pos[ax] = { ax, axis: W.lineAxis, w: W, dir: q.side < 0 ? 1 : -1, edge: q.side < 0 ? 0 : 1, value: q.v, vod: true }; } } }
  (m.cross || []).forEach((cl, ci) => {
    { // N80 / dubina → niša, ne otvor
      let nl = null, other = null; m.labels.forEach((l, k) => { if (!l.role || l.role.cross !== ci) return; if (infos[k].kind === 'nisa') nl = { l, I: infos[k] }; else other = { l, I: infos[k] }; });
      if (nl) {
        let W1 = null; for (const w of m.walls) { if (w.o === cl.o || w.obj || isView(w, st)) continue; if (cl.c < w.e0 - m.E || cl.c > w.e1 + m.E || w.c < cl.a0 - m.E || w.c > cl.a1 + m.E) continue; if (!W1 || (w.e1 - w.e0) > (W1.e1 - W1.e0)) W1 = w; }
        if (W1) { const hw = (nl.I.parsed.w || 60) / scale / 2, room = W1.exterior && W1.outSide ? -W1.outSide : ((cl.a1 - W1.c) >= (W1.c - cl.a0) ? 1 : -1);
          nis.push({ o: W1.o, wall: W1.id, cW: W1.c, room, s0: cl.c - hw, s1: cl.c + hw, center: cl.c, src: 'crta', key: 'nc:' + Math.round(cl.c) + ':' + Math.round(W1.c), w: nl.I.parsed.w || null, h: nl.I.parsed.h || null, d: other && other.I.parsed.v > 0 ? other.I.parsed.v : null }); }
        if (other) other.l.nrole = { cross: ci, part: 'd' };
        return;
      }
    }
    const mine = {}; m.labels.forEach((l, k) => { if (!l.role || l.role.cross !== ci) return; const I = infos[k]; if (I.kind === 'osirina' || I.kind === 'ovisina') mine[I.kind === 'osirina' ? 'w' : 'h'] = { l, v: I.parsed.v }; });
    let W0 = null; for (const w of m.walls) { if (w.o === cl.o || w.obj || isView(w, st)) continue; if (cl.c < w.e0 - m.E || cl.c > w.e1 + m.E || w.c < cl.a0 - m.E || w.c > cl.a1 + m.E) continue; if (!W0 || (w.e1 - w.e0) > (W0.e1 - W0.e0)) W0 = w; }
    if (!W0) return;
    let op = null, bd = 0.12 * m.D; for (const o of ops) { if (o.wall !== W0.id || o.cross != null) continue; const d = Math.abs((o.s0 + o.s1) / 2 - cl.c); if (d < bd) { bd = d; op = o; } }
    const wv = mine.w && mine.w.v > 0 ? mine.w.v : null, hw = (wv || 90) / scale / 2;
    if (!op) { op = { wall: W0.id, s0: cl.bs0 != null ? cl.bs0 : cl.c - hw, s1: cl.bs1 != null ? cl.bs1 : cl.c + hw, src: 'crta', type: 'prozor', key: 'oc:' + Math.round(cl.c) + ':' + Math.round(W0.c) }; op.id = ops.length; ops.push(op); }
    op.cross = ci; op.center = cl.c; if (wv) op.w = wv; if (mine.h && mine.h.v > 0) op.h = mine.h.v; op.label = (mine.w || mine.h || {}).l || op.label;
    op.type = op.arc ? 'vrata' : 'prozor';
  });
  // debljine zidova prije svih mjera (o njima ovise lica zidova)
  m.labels.forEach((l, k) => { const I = infos[k]; if (I.kind !== 'debljina' || !(I.parsed.t > 0) || (st.decisions && st.decisions[l.sig] === 'ignore')) return;
    if (l.dlead) { const dl = l.dlead, pu = dl.o === 'H' ? dl.p.x : dl.p.y; let bw2 = null, bd2 = 1.5 * m.E; for (const w of m.walls) { if (w.o !== dl.o || pu < w.e0 - m.E || pu > w.e1 + m.E) continue; const d = Math.abs(w.c - dl.c); if (d < bd2) { bd2 = d; bw2 = w; } } if (bw2) { bw2.tLabel = I.parsed.t; l._thick = { thick: bw2.id }; return; } }
    let bw = null, bd = 0.1 * m.D; for (const w of m.walls) { const pu = w.o === 'H' ? l.cx : l.cy, pv = w.o === 'H' ? l.cy : l.cx; if (pu < w.e0 - m.E || pu > w.e1 + m.E) continue; const d = Math.abs(pv - w.c); if (d < bd) { bd = d; bw = w; } }
    if (bw) { bw.tLabel = I.parsed.t; l._thick = { thick: bw.id, guess: true }; } });
  // natpisi otvora prije kota: kratke kote uz zid (npr. 10 od ugla) moraju vidjeti i otvor koji postoji samo kao natpis
  m.labels.forEach((l, k) => { const I = infos[k]; if (I.kind === 'otvor' && !(st.decisions && st.decisions[l.sig] === 'ignore')) opLabels.push({ l, I }); });
  // parapeti uz najbliži natpis otvora ili poprečnu crtu
  m.labels.forEach((l, k) => { const I = infos[k]; if (I.kind !== 'parapet') return; let b = null, bd = 6 * m.hMed; for (const o of opLabels) { const d = hyp(o.l.cx - l.cx, o.l.cy - l.cy); if (d < bd) { bd = d; b = o; } }
    let bc = null, bdc = 8 * m.hMed; for (const o of ops) { if (o.cross == null) continue; const cl = m.cross[o.cross], pu = cl.o === 'V' ? l.cx : l.cy, pv = cl.o === 'V' ? l.cy : l.cx; const d = Math.abs(pu - cl.c) + Math.max(0, cl.a0 - pv, pv - cl.a1); if (d < bdc) { bdc = d; bc = o; } }
    if (bc && (!b || bdc < bd)) { bc.p = I.parsed.p; bc.type = 'prozor'; } else if (b && b.I.parsed.p == null) b.I.parsed.p = I.parsed.p; });
  for (const { l, I } of opLabels) {
    let best = null, bd = l.blkc ? 3 * m.E : 0.15 * m.D; const LP = l.blkc || { x: l.cx, y: l.cy };
    for (const o of ops) { const w = m.walls[o.wall], mid = (o.s0 + o.s1) / 2; const pu = w.o === 'H' ? LP.x : LP.y, pv = w.o === 'H' ? LP.y : LP.x; const d = hyp(pu - mid, pv - w.c); if (d < bd && !o.label) { bd = d; best = o; } }
    if (!best && l.blkc) { bd = 0.15 * m.D; for (const o of ops) { const w = m.walls[o.wall], mid = (o.s0 + o.s1) / 2; const pu = w.o === 'H' ? l.cx : l.cy, pv = w.o === 'H' ? l.cy : l.cx; const d = hyp(pu - mid, pv - w.c); if (d < bd && !o.label) { bd = d; best = o; } } }
    if (!best) { // natpis uz zid bez prekida → novi otvor
      let bw = null, bdw = 0.12 * m.D; for (const w of m.walls) { const pu = w.o === 'H' ? l.cx : l.cy, pv = w.o === 'H' ? l.cy : l.cx; if (pu < w.e0 || pu > w.e1) continue; const d = Math.abs(pv - w.c); if (d < bdw) { bdw = d; bw = w; } }
      if (!bw) { notes.push({ kind: 'otvor', label: l, text: 'Otvor #' + l.n + ' nije pridružen zidu.' }); continue; }
      const pu = bw.o === 'H' ? l.cx : l.cy, hw = Math.min((I.parsed.w || 80) / scale / 2, 0.3 * (bw.e1 - bw.e0));
      best = { wall: bw.id, s0: Math.max(bw.e0, pu - hw), s1: Math.min(bw.e1, pu + hw), src: 'natpis', type: I.parsed.h >= 195 && I.parsed.p == null ? 'vrata' : 'prozor', key: 'ol:' + l.sig }; /* visina ≥ 195 bez parapeta = vrata (120/180 je prozor) */
      best.id = ops.length; ops.push(best);
    }
    best.label = l; best.w = I.parsed.w; best.h = I.parsed.h; best.p = I.parsed.p;
    if (I.parsed.split > 0 && I.parsed.split < 1) { let sp = I.parsed.split; const bw = m.walls[best.wall]; if (l.tsv && bw) { const along = bw.o === 'H' ? l.tsv.x : l.tsv.y; if (along > 0) sp = 1 - sp; /* 1. broj = krilo na početku teksta */ } best.split = sp; best.double = true; }
    if (!best.bk && !best.kl && (best.type !== 'vrata' || best.p != null)) best.type = best.p != null ? 'prozor' : (best.arc ? 'vrata' : (best.type === 'prolaz' ? 'vrata' : best.type));
    if (best.src === 'prekid' && !best.arc && best.p == null && best.h > 0 && !(st.openings && st.openings[best.key] && st.openings[best.key].type)) best.type = best.h >= 195 ? 'vrata' : 'prozor'; /* prekid zida s natpisom 120/180 = prozor */
  }
  m._opRel = [];
  m.labels.forEach((l, k) => {
    const I = infos[k]; l.info = I; l.span = null;
    if (I.kind === 'zanemari' || (st.decisions && st.decisions[l.sig] === 'ignore')) return;
    if (I.kind === 'stube') { let S = l.stairIn != null ? stairs[l.stairIn] : null; if (!S) { let bd = 0.15 * m.D; for (const s2 of stairs) { const cx = s2.o === 'H' ? (s2.a0 + s2.a1) / 2 : (s2.c0 + s2.c1) / 2, cy = s2.o === 'H' ? (s2.c0 + s2.c1) / 2 : (s2.a0 + s2.a1) / 2, d = hyp(cx - l.cx, cy - l.cy); if (d < bd) { bd = d; S = s2; } } }
      if (S && I.parsed.n > 1) { S.n = I.parsed.n; l.span = { stair: S.id, part: 'n' }; } else notes.push({ kind: 'kota', label: l, text: 'Broj visina #' + l.n + ' nije pridružen stubištu.' }); return; }
    if (I.kind === 'mjera' && l.stairIn != null && stairs[l.stairIn] && I.parsed.v > 0) { const S = stairs[l.stairIn]; if (l.spart === 'w') S.w = I.parsed.v; else S.L = I.parsed.v; l.span = { stair: S.id, part: l.spart }; return; }
    if (I.kind === 'mjera' || I.kind === 'udaljenost') {
      const v = I.parsed.v; const ovz = st.labels && st.labels[l.sig];
      if (!(v > 0)) { /* v2.63: nula – samo prekrižena nula (Ø) ili upisana 0; obična rukom pisana „0” može biti slučajan kružić */
        if (!(v === 0 && I.parsed.zero && (!I.parsed.plain || l.typed || (ovz && ovz.value != null)))) return; }
      const forceOff = I.kind === 'udaljenost';
      const putOff = (op, off) => { const o0 = op.offset, isPin = x => !!(x && x.label && (x.label.pin || st.labels && st.labels[x.label.sig] && st.labels[x.label.sig].pin));
        if (isPin(off) && !(o0 && isPin(o0) && o0.dir !== off.dir)) { if (o0 && !isPin(o0) && o0.dir !== off.dir) op.offset2 = o0; op.offset = off; return; } if (isPin(o0)) { if (o0.dir !== off.dir) op.offset2 = off; return; } /* dodjela dodirom ima prednost */
        if (o0 && o0.dir === off.dir && o0.axis === off.axis && o0.side !== off.side) op.offSame = off; else if (o0 && o0.dir !== off.dir) op.offset2 = off;
        else if (o0 && o0.dir === off.dir && o0.axis !== off.axis && o0.ax === off.ax) { // isti rub otvora izmjeren do dva različita zida → veza između tih zidova
          const a1 = o0.axis, a2 = off.axis, add = -(o0.t / 2 - off.t / 2 + o0.value), i = off.dir > 0 ? a2 : a1, j = off.dir > 0 ? a1 : a2;
          cons.push({ ax: off.ax, i, j, target: off.value + add, value: off.value, add, kind: 'measure', nodim: true, label: off.label, accepted: st.decisions && st.decisions[off.label.sig] === 'accept' }); }
        else op.offset = off; };
      if (l.gap && !(st.labels && st.labels[l.sig] && st.labels[l.sig].pin)) { const g0 = l.gap, ax = g0.ax === 'Y' ? 'Y' : 'X'; const al = ax === 'X' ? l.cy : l.cx; let i = findAxis(m, ax, g0.si, al), j = findAxis(m, ax, g0.sj, al); // kota upisana vođenim mjerenjem: točno između ta dva zida
        if (i >= 0 && j >= 0 && i !== j) { if (m.axes[ax][i].s > m.axes[ax][j].s) [i, j] = [j, i]; const tI = axisT(m, ax, i, st), tJ = axisT(m, ax, j, st), offI = tI / 2, offJ = -tJ / 2;
          const sp = { ax, dir: ax === 'X' ? 'H' : 'V', i, j, type: 'eksp', offI, offJ, add: offI - offJ, sketch: m.axes[ax][j].s - m.axes[ax][i].s, v: ax === 'X' ? l.cy : l.cx, pin: true, vod: true };
          if (!(v > 0)) { cons.push({ ax, i, j, target: 0, value: 0, add: 0, kind: 'same', key: l.sig }); l.span = sp; return; }
          cons.push({ ax, i, j, target: v + sp.add, value: v, add: sp.add, kind: 'measure', label: l, span: sp, accepted: st.decisions && st.decisions[l.sig] === 'accept' }); l.span = sp; return; } }
      if (v === 0 && !((ovz && ovz.pin) || l.pin)) { const zp = zeroPin(m, l, ops); if (zp) { const r = pinSpan(m, st, zp, 0, l, ops.concat(nis), putOff, cons); if (r) { l.span = r; return; } }
        notes.push({ kind: 'kota', label: l, text: 'Kota #' + l.n + ' (0): ne vidim kraj prozora/vrata uz zid blizu nje – dodijeli je dodirom.' }); return; }
      const pin = (st.labels && st.labels[l.sig] && st.labels[l.sig].pin) || l.pin; // korisnik je dodirom odabrao što kota mjeri (ili kota „od ugla” iz postavki prozora/vrata)
      if (pin) { const r = pinSpan(m, st, pin, v, l, ops.concat(nis), putOff, cons); if (r) { l.span = r; return; } notes.push({ kind: 'kota', label: l, text: 'Kota #' + l.n + ' (' + fmt(v) + '): na dodirnutim mjestima ne vidim zid ili rub otvora – dodijeli je ponovno.' }); return; }
      const cdl = l.edim != null ? m.edims[l.edim] : l.leader != null ? m.leaders[l.leader] : null;
      if (cdl && cdl.col != null && cols[cdl.col]) {
        const ps = l.edim != null ? colEdim(m, cdl) : colLeader(m, cdl);
        if (ps) { ps.value = v; ps.label = l; cols[cdl.col].pos[ps.ax] = ps; l.span = { col: cdl.col }; return; }
        notes.push({ kind: 'kota', label: l, text: 'Kota #' + l.n + ' (' + fmt(v) + '): ne vidim do kojeg zida mjeri udaljenost stupa.' }); return;
      }
      if (l.leader != null && m.leaders[l.leader] && m.leaders[l.leader].S) { const ld = m.leaders[l.leader], S0 = ld.S;
        const nz = nis.find(n => { const pc = n.o === 'H' ? S0.y : S0.x, pu = n.o === 'H' ? S0.x : S0.y; return n.src === 'zub' && (ld.ax === 'H') === (n.o === 'V') && Math.abs(pc - n.nc) < 2.5 * m.E && pu > n.s0 - 2.5 * m.E && pu < n.s1 + 2.5 * m.E; });
        if (nz) { nz.lead = { value: v, d: ld.d, label: l }; l.span = { nlead: nz.key }; return; } }
      // nacrtana kota od zida do otvora, zuba (niše/zadebljanja/proširenja) ili do lica zuba
      if (l.edim != null && forceOff) { const r = edimObj(m, m.edims[l.edim], ops, nis, st, v, l, putOff); if (r) { l.span = r; return; } }
      if (l.edim != null || l.leader != null) {
        const sp = l.edim != null ? edimSpan(m, m.edims[l.edim], st) : leaderSpan(m, m.leaders[l.leader], st);
        if (!sp && l.edim != null) { const r = edimObj(m, m.edims[l.edim], ops, nis, st, v, l, putOff); if (r) { l.span = r; return; } }
        if (sp) { l.span = sp; cons.push({ ax: sp.ax, i: sp.i, j: sp.j, target: v + sp.add, value: v, add: sp.add, kind: 'measure', label: l, span: sp, accepted: st.decisions && st.decisions[l.sig] === 'accept' }); return; }
        notes.push({ kind: 'kota', label: l, text: 'Kota #' + l.n + ' (' + fmt(v) + '): kotna/pokazna crta ne dodiruje zid' + (forceOff ? ' ni otvor/zub' : '') + '.' }); return;
      }
      if (!l.chev) { // broj uz zid: duljina tog dijela zida ili udaljenost do otvora (smjer ↔/↕ ograničava zid)
        const wa = wallAdj(m, l, st, ops.concat(nis), v, scale, null, I.orient, forceOff);
        if (wa && wa.kind === 'off') { putOff(wa.op, wa.off); l.span = { off: true }; return; } // (ista udaljenost s druge strane zida → offSame)
        if (wa && wa.kind === 'lead') { wa.n.lead = { value: v, label: l }; l.span = { nlead: wa.n.key }; return; }
        if (wa && wa.kind === 'rel') { const n = wa.n, zw = m.walls[n.wall];
          if (n.d > 0 && zw) { putOff(wa.op, { ax: zw.o === 'H' ? 'Y' : 'X', axis: zw.lineAxis, t: wallT(m, zw, st), dir: -wa.dir, value: v + n.d, label: l, side: wa.side }); l.span = { nrel: n.key }; return; }
          n.opRel = { op: wa.op, k: wa.k, dir: wa.dir, value: v, label: l }; l.span = { nrel: n.key }; return; }
        if (forceOff) { notes.push({ kind: 'kota', label: l, text: 'Kota #' + l.n + ' (' + fmt(v) + '): uz taj zid nema otvora ni zuba do kojeg bi bila udaljenost.' }); return; }
        if (wa && wa.kind === 'len') { l.span = wa.span; cons.push({ ax: wa.span.ax, i: wa.span.i, j: wa.span.j, target: v + wa.span.add, value: v, add: wa.span.add, kind: 'measure', label: l, span: wa.span, accepted: st.decisions && st.decisions[l.sig] === 'accept' }); return; }
      }
      let best = null, bc = Infinity;
      for (const dir of ['H', 'V']) {
        if (I.orient && I.orient !== dir) continue; if (l.chev && l.chev !== 'auto' && !I.orient && l.chev !== dir) continue; const s = spanFor(m, l, dir, st); if (!s) continue;
        let cost = Math.abs(Math.log(Math.max(1, v + s.add) / Math.max(1e-6, s.sketch * scale)));
        const aspDir = l.typed ? (l.tdir || null) : (l.aspect >= 0.9 ? 'H' : 'V'); if (aspDir && aspDir !== dir) cost += 0.25;
        if (cost < bc) { bc = cost; best = s; }
      }
      if (!best) { notes.push({ kind: 'kota', label: l, text: 'Kota #' + l.n + ' (' + fmt(v) + ') nije pridružena nijednom zidu – u Kotama promijeni smjer (↔/↕) ili je zanemari.' }); return; }
      l.span = best;
      cons.push({ ax: best.ax, i: best.i, j: best.j, target: v + best.add, value: v, add: best.add, kind: 'measure', label: l, span: best, accepted: st.decisions && st.decisions[l.sig] === 'accept' });
    } else if (I.kind === 'prostorija') { // 380x420 u prostoriji: obje svijetle mjere
      const a = I.parsed.a, b = I.parsed.b, sH = spanFor(m, l, 'H', st), sV = spanFor(m, l, 'V', st);
      if (!sH || !sV || sH.type !== 'unutarnja' || sV.type !== 'unutarnja') { notes.push({ kind: 'kota', label: l, text: 'Mjere prostorije #' + l.n + ' (' + fmt(a) + '×' + fmt(b) + '): natpis nije unutar prostorije omeđene zidovima.' }); return; }
      const sw = st.roomSwap && st.roomSwap[l.sig]; let mode = sw, margin = 9;
      if (!mode) { const r = Math.log(Math.max(1e-6, sH.sketch) / Math.max(1e-6, sV.sketch)), e1 = Math.abs(Math.log(a / b) - r), e2 = Math.abs(Math.log(b / a) - r); mode = e1 <= e2 ? 'ab' : 'ba'; margin = Math.abs(e1 - e2); }
      const vh = mode === 'ab' ? a : b, vv = mode === 'ab' ? b : a, acc = st.decisions && st.decisions[l.sig] === 'accept';
      const cH = { ax: sH.ax, i: sH.i, j: sH.j, target: vh + sH.add, value: vh, add: sH.add, kind: 'measure', label: l, span: sH, accepted: acc, room: 'h' }, cV = { ax: sV.ax, i: sV.i, j: sV.j, target: vv + sV.add, value: vv, add: sV.add, kind: 'measure', label: l, span: sV, accepted: acc, room: 'v' };
      cons.push(cH, cV); l.span = { room: true, h: vh, v: vv, mode, auto: !sw };
      if (!sw && a !== b && margin < 0.18) roomAmb.push({ l, cH, cV });
    } else if (I.kind === 'otvor') return;
    else if (I.kind === 'debljina') { l.span = l._thick || null; return;
      if (l.dlead) { const dl = l.dlead, pu = dl.o === 'H' ? dl.p.x : dl.p.y; let bw2 = null, bd2 = 1.5 * m.E; for (const w of m.walls) { if (w.o !== dl.o || pu < w.e0 - m.E || pu > w.e1 + m.E) continue; const d = Math.abs(w.c - dl.c); if (d < bd2) { bd2 = d; bw2 = w; } }
        if (bw2 && I.parsed.t > 0) { bw2.tLabel = I.parsed.t; l.span = { thick: bw2.id }; return; } }
      let bw = null, bd = 0.1 * m.D; for (const w of m.walls) { const pu = w.o === 'H' ? l.cx : l.cy, pv = w.o === 'H' ? l.cy : l.cx; if (pu < w.e0 - m.E || pu > w.e1 + m.E) continue; const d = Math.abs(pv - w.c); if (d < bd) { bd = d; bw = w; } }
      if (bw && I.parsed.t > 0) { bw.tLabel = I.parsed.t; l.span = { thick: bw.id, guess: true }; }
    }
  });
  for (const S of stairs) { const ov = st.stairs && st.stairs[S.key]; if (!ov) continue; for (const k of ['n', 'L', 'w', 'podest', 'H']) if (ov[k] > 0 && (!S[k] || !ov.est)) { S[k] = ov[k]; if (ov.est) S.est = true; } /* ručni ispravak ima prednost pred brojem sa skice */ if (ov.dir) S.dir = ov.dir; S.done = true; }
  for (const n of nis) { const ov = st.niches && st.niches[n.key]; if (ov) { if (ov.d > 0 && !n.d) { n.d = ov.d; n.dEst = !!ov.est; } if (ov.w > 0 && !n.w) n.w = ov.w; } }
  /* v2.58: geodetska podloga – vanjske mjere pročelja s geodetske podloge (samo kad je uključeno „Prilagodi”): imaju prednost, razlika ide u ostale mjere */
  if (st.geo && st.geo.on && st.geo.v) for (const G of geoSides(m)) { const v = +st.geo.v[G.key]; if (!(v > 0)) continue;
    const add = -(axisT(m, G.ax, G.i, st) / 2 + axisT(m, G.ax, G.j, st) / 2); cons.push({ ax: G.ax, i: G.i, j: G.j, target: v + add, value: v, add, kind: 'geo', prio: true, key: 'geo:' + G.key }); }
  // kote između strelica <…> su ukupne mjere prostorije: imaju prednost pri usklađivanju
  cons.forEach(c => { if (c.label && c.label.chev && !c.chain) c.prio = true; });
  // lanac kota uz zid: udaljenost + otvor/niša + udaljenost = duljina tog dijela zida
  // ista udaljenost s obje strane zida (npr. kuhinja / hodnik): mala razlika = prosjek, velika = pitanje
  { // v2.14: lanac otvor–otvor (Od–do): drugi otvor se postavlja od ruba prvoga kad je prvi već smješten (iz udaljenosti od zida ili lanca)
    for (const o of ops) delete o.chain; let go = true, guard = 0;
    while (go && guard++ < 20) { go = false;
      for (const r of m._opRel || []) { if (r.done) continue; for (const [X, Y] of [[r.A, r.B], [r.B, r.A]]) { const ox = X.op, oy = Y.op; if (oy.offset || oy.chain || !(ox.offset || ox.chain)) continue;
          oy.chain = { ref: ox, kX: X.k, kY: Y.k, sgn: Math.sign(Y.pos - X.pos) || 1, v: r.v, label: r.l }; r.done = true; go = true; break; } } }
    for (const r of m._opRel || []) if (!r.done) notes.push({ kind: 'kota', label: r.l, text: 'Kota #' + r.l.n + ' (' + fmt(r.v) + ') između dva otvora: izmjeri i udaljenost jednog od njih do zida.' }); }
  for (const o of ops.concat(nis)) { if (!o.offSame || !o.offset) continue; const a = o.offset, b = o.offSame, k = 'od:' + o.key, pick = st.offPick && st.offPick[k], avg = (a.value + b.value) / 2;
    if (pick === 'avg' || (!pick && Math.abs(a.value - b.value) <= Math.max(6, 0.08 * Math.max(a.value, b.value)))) { o.offset = Object.assign({}, a, { value: avg }); notes.push({ kind: 'odm', text: 'Udaljenost otvora od zida izmjerena s obje strane zida (#' + a.label.n + ' ' + fmt(a.value) + ', #' + b.label.n + ' ' + fmt(b.value) + ') → uzeto ' + fmt(avg, 1) + ' cm' }); }
    else if (pick === 'b') o.offset = b; else if (pick !== 'a') o.offDisagree = { a, b, key: k }; }
  for (const n of nis) { if (!n.corner || !n.offset || n.offset2) continue; // zub u kutu: kut je „udaljenost 0” s druge strane
    const q = m.walls.find(q2 => q2.o !== n.o && !isView(q2, st) && Math.abs(q2.c - n.corner.c) < 2 * m.E); if (!q) continue;
    const dir = n.corner.k === 0 ? 1 : -1; if (dir === n.offset.dir) continue; n.offset2 = { ax: n.offset.ax, axis: q.lineAxis, t: wallT(m, q, st), dir, value: 0, label: n.offset.label, side: n.offset.side }; }
  for (const o of ops.concat(nis)) {
    const a = o.offset, b = o.offset2, ck = 'chain:' + o.key; if (!a || !b || !(o.w > 0) || a.ax !== b.ax || (st.decisions && st.decisions[ck] === 'ignore')) continue;
    const lo = a.dir > 0 ? a : b, hi = a.dir > 0 ? b : a; if (lo.axis === hi.axis) continue;
    const offI = lo.t / 2, offJ = -hi.t / 2, val = lo.value + o.w + hi.value, sp = { ax: lo.ax, dir: lo.ax === 'X' ? 'H' : 'V', i: lo.axis, j: hi.axis, type: 'eksp', offI, offJ, add: offI - offJ, sketch: m.axes[lo.ax][hi.axis].s - m.axes[lo.ax][lo.axis].s, v: 0 };
    cons.push({ ax: lo.ax, i: lo.axis, j: hi.axis, target: val + sp.add, value: val, add: sp.add, kind: 'measure', chain: true, label: { sig: ck, n: lo.label.n, n2: hi.label.n, sigA: lo.label.sig, sigB: hi.label.sig, va: lo.value, vb: hi.value, w: o.w, cx: lo.label.cx, cy: lo.label.cy, bb: lo.label.bb }, span: sp, accepted: st.decisions && st.decisions[ck] === 'accept' });
  }
  for (const o of ops) { const ov = st.openings && st.openings[o.key]; if (ov) { if (ov.type) o.type = ov.type; if (ov.w > 0 && !o.label && !ov.est) o.w = ov.w; if (ov.est) o.est = true; } }
  // odgovori korisnika (razmaci)
  for (const [k, a] of Object.entries(st.answers || {})) {
    const ax = a.ax, i = findAxis(m, ax, a.si), j = findAxis(m, ax, a.sj); if (i < 0 || j < 0 || i === j) continue;
    const sgn = m.axes[ax][j].s >= m.axes[ax][i].s ? 1 : -1;
    if (a.same || !(a.value > 0)) { cons.push({ ax, i, j, target: 0, value: 0, add: 0, kind: 'same', key: k }); continue; }
    const add = axisT(m, ax, i, st) / 2 + axisT(m, ax, j, st) / 2;
    cons.push({ ax, i, j, target: sgn * (a.value + add), value: a.value, add, kind: a.est ? 'estimate' : 'answer', key: k });
  }
  // isti dio zida izmjeren s obje strane: razlika = debljina okomitog zida na kraju gdje se zid lomi
  if (!st._derivedDone) {
    const lens = cons.filter(c => c.kind === 'measure' && c.span && c.span.wall && c.span.side), der = {}, dnotes = [];
    for (let a = 0; a < lens.length; a++) for (let b = a + 1; b < lens.length; b++) {
      const A = lens[a].span, Bs = lens[b].span; if (A.wall !== Bs.wall || A.side === Bs.side || A.i !== Bs.i || A.j !== Bs.j) continue;
      const diff = Math.abs(lens[a].value - lens[b].value), ends = [];
      if (A.wrapLo !== Bs.wrapLo && A.wLo) ends.push(A.wLo); if (A.wrapHi !== Bs.wrapHi && A.wHi) ends.push(A.wHi);
      if (!ends.length || diff < 2 || diff > 80 * ends.length) continue;
      for (const w of ends) if (!(st.wallT && st.wallT[wallKey(w)]) && !w.tLabel) { der[wallKey(w)] = Math.round(diff / ends.length * 10) / 10; dnotes.push({ kind: 'debljina', text: 'Debljina zida izračunata iz mjera izvana i iznutra (' + fmt(Math.max(lens[a].value, lens[b].value)) + ' − ' + fmt(Math.min(lens[a].value, lens[b].value)) + '): ' + fmt(diff / ends.length, 1) + ' cm' }); }
    }
    if (Object.keys(der).length) { const R2 = buildConstraints(m, Object.assign({}, st, { _derivedT: der, _derivedDone: true })); R2.notes.push(...dnotes); R2.derivedT = Object.assign({}, R2.derivedT || {}, der); return R2; }
  }
  const rf = cons.filter(c => c.kind === 'measure' && c.span && Math.abs(c.span.sketch) > m.E).map(c => (c.value + c.add) / Math.abs(c.span.sketch));
  if (rf.length) scale = median(rf);
  // prostorija skoro kvadratna: koji raspored mjera bolje paše uz ostale kote
  for (const R of roomAmb) {
    const score = () => { const sx = solveAxis(m, 'X', cons, scale), sy = solveAxis(m, 'Y', cons, scale); let q = 0; for (const c of cons) { if (c.kind !== 'measure') continue; const X = (c.ax === 'X' ? sx : sy).x; const got = X[c.j] - X[c.i] - c.add; q += ((got - c.value) / Math.max(1, c.value)) ** 2; } return q; };
    const swap = () => { const h = R.cH.value, v2 = R.cV.value; R.cH.value = v2; R.cH.target = v2 + R.cH.add; R.cV.value = h; R.cV.target = h + R.cV.add; };
    const s1 = score(); swap(); const s2 = score();
    if (s2 < s1 * 0.6 && s1 > 1e-5) { R.l.span.mode = R.l.span.mode === 'ab' ? 'ba' : 'ab'; R.l.span.h = R.cH.value; R.l.span.v = R.cV.value; }
    else { swap(); if (!(s1 < s2 * 0.6 && s2 > 1e-5)) R.l.roomAsk = true; }
  }
  jogFlush(m, st);
  /* skok vanjskog zida, a jednoj strani debljina nije upisana: izračunaj je tako da fasada bude ravna (sekanta – mjere ovise o debljini) */
  if (!st._jogDone && (m.jogs || []).some(g => g.der)) {
    const L = m.jogs.filter(g => g.der).map(g => ({ g, D: g.der, key: wallKey(g.der.w) }));
    const raw = (it, cs, sc) => { const x = solveAxis(m, it.g.ax, cs, sc).x, d = x[it.g.j] - x[it.g.i]; return it.D.unk === 'i' ? it.D.tk + 2 * it.D.o * d : it.D.tk - 2 * it.D.o * d; };
    const r0 = L.map(it => raw(it, cons, scale)), tm = {}, tmS = {}; L.forEach((it, k) => (it.D.soft ? tmS : tm)[it.key] = r0[k]);
    const P = buildConstraints(m, Object.assign({}, st, { _derivedT: Object.assign({}, st._derivedT || {}, tm), _softT: Object.assign({}, st._softT || {}, tmS), _derivedDone: true, _jogDone: true, _jogProbe: true }));
    const r1 = L.map(it => raw(it, P.cons, P.scale)), der = {}, derS = {}, dn = [];
    L.forEach((it, k) => { const t0 = it.D.tu, t1 = r0[k], g0 = r0[k] - t0, g1 = r1[k] - t1; let t = Math.abs(g1 - g0) > 1e-6 ? t1 - g1 * (t1 - t0) / (g1 - g0) : t1; t = Math.round(t * 10) / 10; if (Math.abs(t - it.D.tk) <= 1) t = it.D.tk;
      if (t >= 8 && t <= 90 && Math.abs(t - t0) > 0.5) { (it.D.soft ? derS : der)[it.key] = t; dn.push({ kind: 'debljina', text: it.D.soft ? 'Mala razlika mjera (' + fmt(Math.abs(t - it.D.tk), 1) + ' cm): prostorije su točno po mjerama, a ' + (it.D.w && it.D.w.exterior ? 'vanjski zid' : 'zid') + ' je na tom dijelu ' + fmt(t) + ' cm umjesto ' + fmt(it.D.tk) + ' cm. ' + (it.D.w && it.D.w.exterior ? 'Fasada ostaje ravna.' : 'Skok je na spoju s poprečnim zidom, druga strana zida ostaje ravna.') : t === it.D.tk ? 'Debljina vanjskog zida uzeta ' + fmt(t) + ' cm, ista kao susjedni dio – fasada ravna.' : 'Debljina vanjskog zida izračunata ' + fmt(t) + ' cm, da fasada bude ravna (uz zid ' + fmt(it.D.tk) + ' cm).' }); } });
    if (Object.keys(der).length || Object.keys(derS).length) { const R3 = buildConstraints(m, Object.assign({}, st, { _derivedT: Object.assign({}, st._derivedT || {}, der), _softT: Object.assign({}, st._softT || {}, derS), _derivedDone: true, _jogDone: true })); R3.notes.push(...dn); R3.derivedT = Object.assign({}, R3.derivedT || {}, der, derS); R3.softT = Object.assign({}, R3.softT || {}, derS); return R3; }
    jogFlush(m, st);
  }
  return { cons, notes, scale, ops, infos, nis, cols, stairs };
}
/* rub unije pravokutnika iz rešetke (terasa iz obrisa): zajednički bridovi se poništavaju, kolinearni se spajaju */
function regEdges(rects) { const k = v => Math.round(v * 10) / 10, H = new Map(), V = new Map(), tog = (M, key, a0, a1) => { const L = M.get(key) || []; L.push([a0, a1]); M.set(key, L); };
  for (const q of rects || []) { const [x0, y0, x1, y1] = q.map(k); tog(H, y0, Math.min(x0, x1), Math.max(x0, x1)); tog(H, y1, Math.min(x0, x1), Math.max(x0, x1)); tog(V, x0, Math.min(y0, y1), Math.max(y0, y1)); tog(V, x1, Math.min(y0, y1), Math.max(y0, y1)); }
  const out = [], run = (M, hor) => { for (const [c, L] of M) { const ev = new Map(); for (const [a, b] of L) { ev.set(a, (ev.get(a) || 0) + 1); ev.set(b, (ev.get(b) || 0) - 1); } /* parnost pokrivenosti: brid gdje je pokriven neparan broj puta */
      const xs = [...new Set(L.flat())].sort((p, q) => p - q); for (let i = 0; i < xs.length - 1; i++) { const m0 = (xs[i] + xs[i + 1]) / 2; let n = 0; for (const [a, b] of L) if (a < m0 && b > m0) n++; if (n % 2 === 1) { const last = out.length && out[out.length - 1]; const A = hor ? [xs[i], c] : [c, xs[i]], B = hor ? [xs[i + 1], c] : [c, xs[i + 1]]; if (last && last._k === (hor ? 'H' : 'V') + c && Math.abs((hor ? last[1][0] : last[1][1]) - xs[i]) < 0.05) last[1] = B; else { const e = [A, B]; e._k = (hor ? 'H' : 'V') + c; out.push(e); } } } } };
  run(H, true); run(V, false); return out.map(e => [e[0], e[1]]); }
/* najbliži zid lijevo/desno (X) ili gore/dolje (Y) od stupa, koji ga „vidi” */
function colWall(m, b, ax, side) { const mo = ax === 'X' ? 'V' : 'H', lo = ax === 'X' ? b.x0 : b.y0, hi = ax === 'X' ? b.x1 : b.y1, r0 = ax === 'X' ? b.y0 : b.x0, r1 = ax === 'X' ? b.y1 : b.x1; let W = null, bd = Infinity;
  for (const w of m.walls) { if (w.o !== mo || w.obj || w.view || w.e1 < r0 - m.E || w.e0 > r1 + m.E) continue; const d = side < 0 ? lo - w.c : w.c - hi; if (d > 0.3 * m.E && d < bd) { bd = d; W = w; } } return W; }
/* kota s križićima od zida do stupa */
function colEdim(m, dl) {
  const mo = dl.o === 'H' ? 'V' : 'H', ax = dl.o === 'H' ? 'X' : 'Y', b = m.columns[dl.col].bb;
  const e = dl.colEnd ? dl.a0 : dl.a1, ce = dl.colEnd ? dl.a1 : dl.a0;
  let W = null, bd = 4 * m.E; for (const w of m.walls) { if (w.o !== mo || w.obj || w.view) continue; if (dl.c < w.e0 - 3 * m.E || dl.c > w.e1 + 3 * m.E) continue; const d = Math.abs(w.c - e); if (d < bd) { bd = d; W = w; } }
  if (!W) return null; const lo = ax === 'X' ? b.x0 : b.y0, hi = ax === 'X' ? b.x1 : b.y1;
  return { ax, axis: W.lineAxis, w: W, dir: Math.sign((lo + hi) / 2 - W.c) || 1, edge: Math.abs(ce - lo) <= Math.abs(ce - hi) ? 0 : 1 };
}
/* pokazna crta od stupa: od stranice stupa u smjeru strelice do prvog zida */
function colLeader(m, ld) {
  if (!ld.S) return null; const mo = ld.ax === 'H' ? 'V' : 'H', ax = ld.ax === 'H' ? 'X' : 'Y', b = m.columns[ld.col].bb;
  const su = ld.ax === 'H' ? (ld.d > 0 ? b.x1 : b.x0) : (ld.d > 0 ? b.y1 : b.y0), sv = ld.ax === 'H' ? ld.S.y : ld.S.x;
  let W = null, bd = Infinity; for (const w of m.walls) { if (w.o !== mo || w.obj || w.view) continue; if (sv < w.e0 - m.E || sv > w.e1 + m.E) continue; const d = (w.c - su) * ld.d; if (d > -m.E && d < bd) { bd = d; W = w; } }
  if (!W) return null; return { ax, axis: W.lineAxis, w: W, dir: -ld.d, edge: ld.d > 0 ? 1 : 0 };
}
/* lice zida na kraju mjere: uz zid (unutar njegove duljine) = bliže lice; na produžetku zida (vanjski ugao) = dalje lice */
function faceOff(m, w, pos, towardSign, st) { const t = wallT(m, w, st); const inside = pos >= w.e0 - m.E && pos <= w.e1 + m.E; return (inside ? towardSign : -towardSign) * t / 2; }
function edimSpan(m, dl, st) {
  const mo = dl.o === 'H' ? 'V' : 'H', ax = dl.o === 'H' ? 'X' : 'Y';
  const near = e => { let b = null, bd = 3 * m.E; for (const w of m.walls) { if (w.o !== mo) continue; const d = Math.abs(w.c - e); if (d < bd) { bd = d; b = w; } } return b; };
  const A = near(dl.a0), B = near(dl.a1); if (!A || !B || A.lineAxis === B.lineAxis) return null;
  const offI = faceOff(m, A, dl.c, 1, st), offJ = faceOff(m, B, dl.c, -1, st);
  return { ax, dir: dl.o, i: A.lineAxis, j: B.lineAxis, type: 'eksp', offI, offJ, add: offI - offJ, sketch: B.c - A.c, v: dl.c };
}
function leaderSpan(m, ld, st) {
  if (!ld || !ld.S) return null;
  const mo = ld.ax === 'H' ? 'V' : 'H', ax = ld.ax === 'H' ? 'X' : 'Y', E = m.E;
  const su = ld.ax === 'H' ? ld.S.x : ld.S.y, sv = ld.ax === 'H' ? ld.S.y : ld.S.x;
  let W1 = null, bd = 2.5 * E; for (const w of m.walls) { if (w.o !== mo || w.obj) continue; if (sv < w.e0 - 3 * E || sv > w.e1 + 3 * E) continue; const d = Math.abs(w.c - su); if (d < bd) { bd = d; W1 = w; } }
  if (!W1) return null;
  // zraka uz vanjsku stranu ugla (iza kraja zida u smjeru pokazne crte)
  let rv = sv + ld.side * 3 * E;
  if (ld.side > 0 && Math.abs(W1.e1 - sv) < 6 * E) rv = Math.max(rv, W1.e1 + 2 * E);
  if (ld.side < 0 && Math.abs(W1.e0 - sv) < 6 * E) rv = Math.min(rv, W1.e0 - 2 * E);
  let W2 = null, b2 = Infinity;
  for (const w of m.walls) { if (w.o !== mo || w === W1 || w.obj) continue; if (rv < w.e0 - 0.5 * E || rv > w.e1 + 0.5 * E) continue; const d = (w.c - su) * ld.d; if (d > E && d < b2) { b2 = d; W2 = w; } }
  if (!W2) return null;
  let A = W1, B = W2, oA = faceOff(m, W1, rv, ld.d, st), oB = faceOff(m, W2, rv, -ld.d, st);
  if (ld.d < 0) { [A, B] = [B, A]; [oA, oB] = [oB, oA]; }
  return { ax, dir: ld.ax, i: A.lineAxis, j: B.lineAxis, type: 'eksp', offI: oA, offJ: oB, add: oA - oB, sketch: B.c - A.c, v: rv };
}
/* broj napisan uz zid (bez strelica): dio zida između dva spoja = duljina; između spoja i otvora = udaljenost otvora */
function wallAdj(m, l, st, ops, v, scale, Wforce, odir, forceOff) {
  // kratak broj (jedna-dvije znamenke) nema pouzdan smjer: probaj najbliže zidove obje orijentacije, prednost ima udaljenost do otvora
  const single = !odir && !l.typed && Math.max(l.bb.w, l.bb.h) < 1.7 * m.hMed && ((l.strokes || []).length <= 1 || ((l.strokes || []).length === 2 && l.aspect > 0.7 && l.aspect < 1.4));
  const tdir = odir || (l.typed || single ? null : (l.aspect >= 1 ? 'H' : 'V')); let W = Wforce || null, wd = 2 * m.hMed;
  if (!W && single) { const cands = []; for (const w of m.walls) { const u = w.o === 'H' ? l.cx : l.cy; if (u < w.e0 - m.E || u > w.e1 + m.E || w.view || w.obj) continue; const d = w.o === 'H' ? Math.max(0, l.bb.y0 - w.c, w.c - l.bb.y1) : Math.max(0, l.bb.x0 - w.c, w.c - l.bb.x1); if (d < wd) cands.push({ w, d }); }
    cands.sort((a, b) => a.d - b.d); let first = null; for (const c of cands) { const r = wallAdj(m, l, st, ops, v, scale, c.w, null, forceOff); if (r && r.kind === 'off') return r; if (r && !first) first = r; } return first; }
  for (const w of m.walls) {
    if (Wforce) break; if (tdir && w.o !== tdir) continue; const u = w.o === 'H' ? l.cx : l.cy; if (u < w.e0 - m.E || u > w.e1 + m.E) continue;
    const d = w.o === 'H' ? Math.max(0, l.bb.y0 - w.c, w.c - l.bb.y1) : Math.max(0, l.bb.x0 - w.c, w.c - l.bb.x1); if (d < wd) { wd = d; W = w; }
  }
  if (!W) return null;
  let u = W.o === 'H' ? l.cx : l.cy, uu = null; const side = ((W.o === 'H' ? l.cy : l.cx) >= W.c) ? 1 : -1, ax = W.o === 'H' ? 'X' : 'Y', E = m.E;
  const pts = [];
  for (const q of m.walls) {
    if (q === W || q.o === W.o || q.c < W.e0 - E || q.c > W.e1 + E || W.c < q.e0 - 1.5 * E || W.c > q.e1 + 1.5 * E) continue;
    const toward = side > 0 ? q.e1 > W.c + E : q.e0 < W.c - E; if (!toward) continue;
    pts.push({ pos: q.c, axis: q.lineAxis, t: wallT(m, q, st), kind: 'j', w: q });
  }
  for (const k of [0, 1]) {
    const pos = k ? W.e1 : W.e0; if (pts.some(p => Math.abs(p.pos - pos) < 1.5 * E)) continue;
    let tw = true, qq = null; if (W.snapped[k]) { qq = m.walls.find(q2 => q2.o !== W.o && q2.lineAxis === W.end[k] && W.c >= q2.e0 - 1.5 * E && W.c <= q2.e1 + 1.5 * E); if (qq) tw = side > 0 ? qq.e1 > W.c + E : qq.e0 < W.c - E; }
    pts.push({ pos, axis: W.end[k], t: perpWallT(m, W, k, st), kind: 'j', wrap: !tw, w: qq });
  }
  for (const o of ops) { if (o.wall !== W.id) continue; const c = o.center != null ? o.center : (o.s0 + o.s1) / 2, hw = (o.s1 - o.s0) / 2; if (o.kind && u > c - hw && u < c + hw) continue; /* broj iznad niše mjeri nešto drugo */ pts.push({ pos: c - hw, op: o, kind: 'o' }, { pos: c + hw, op: o, kind: 'o' }); if (u > c - hw && u < c + hw) { uu = u < c ? c - hw - 0.01 : c + hw + 0.01; } } // broj napisan malo preko otvora: pripada bližoj strani
  if (uu != null) u = uu;
  // lice zuba/proširenja na okomitom zidu (npr. dimnjak u kutu) je prepreka uz ovaj zid
  for (const n of ops) { if (!n.kind || n.o === W.o || n.nc == null) continue; if (W.c < Math.min(n.s0, n.s1) - 2 * E || W.c > Math.max(n.s0, n.s1) + 2 * E || n.nc < W.e0 - E || n.nc > W.e1 + E) continue;
    for (let k2 = pts.length - 1; k2 >= 0; k2--) if (pts[k2].kind === 'j' && Math.abs(pts[k2].pos - n.cW) < 2 * E) pts[k2].behindZub = n;
    pts.push({ pos: n.nc, kind: 'z', n }); }
  let lo = null, hi = null; for (const p of pts) { if (p.pos <= u && (!lo || p.pos > lo.pos)) lo = p; if (p.pos >= u && (!hi || p.pos < hi.pos)) hi = p; }
  if (!lo || !hi) return null;
  // između ugla/zida i otvora/niše: to je udaljenost do otvora (ukupne mjere pišu se u <…>)
  // zub ispred zida: pravi kraj je lice zuba
  if (lo.kind === 'j' && lo.behindZub && pts.some(p => p.kind === 'z' && p.n === lo.behindZub && p.pos <= u)) lo = pts.find(p => p.kind === 'z' && p.n === lo.behindZub);
  if (hi.kind === 'j' && hi.behindZub && pts.some(p => p.kind === 'z' && p.n === hi.behindZub && p.pos >= u)) hi = pts.find(p => p.kind === 'z' && p.n === hi.behindZub);
  if ((lo.kind === 'z') !== (hi.kind === 'z')) { const z = lo.kind === 'z' ? lo : hi, o2 = lo.kind === 'z' ? hi : lo, dir = o2 === lo ? 1 : -1;
    if (o2.kind === 'o' && !o2.op.kind) return { kind: 'rel', n: z.n, op: o2.op, k: dir > 0 ? 1 : 0, dir, side };
    if (o2.kind === 'j') return { kind: 'lead', n: z.n };
    return null; }
  if (lo.kind === 'j' && hi.kind === 'j' && forceOff) { // korisnik je odabrao „udaljenost”: najbliži otvor/zub uz taj zid
    let best = null; for (const p of pts) if (p.kind === 'o' && (!best || Math.abs(p.pos - u) < Math.abs(best.pos - u))) best = p; if (!best) return null;
    const dir = best.pos > u ? 1 : -1; let j = null; for (const p of pts) if (p.kind === 'j' && (p.pos - best.pos) * dir < 0 && (!j || Math.abs(p.pos - best.pos) < Math.abs(j.pos - best.pos))) j = p; if (!j) return null;
    return { kind: 'off', op: best.op, off: { ax, axis: j.axis, t: j.t, dir, value: v, label: l, side } };
  }
  if (lo.kind === 'j' && hi.kind === 'j') {
    if (lo.axis === hi.axis) return null;
    // uz zid: lice okomitog zida prema broju; ako se zid lomi na drugu stranu, mjeri se do vanjskog ugla
    const offI = (lo.wrap ? -1 : 1) * lo.t / 2, offJ = (hi.wrap ? 1 : -1) * hi.t / 2;
    return { kind: 'len', span: { ax, dir: W.o, i: lo.axis, j: hi.axis, type: 'eksp', offI, offJ, sketch: hi.pos - lo.pos, v: W.o === 'H' ? l.cy : l.cx, add: offI - offJ, wall: W, side, wLo: lo.w, wHi: hi.w, wrapLo: !!lo.wrap, wrapHi: !!hi.wrap } };
  }
  if ((lo.kind === 'j') !== (hi.kind === 'j')) {
    const j = lo.kind === 'j' ? lo : hi, o = lo.kind === 'j' ? hi.op : lo.op;
    return { kind: 'off', op: o, off: { ax, axis: j.axis, t: j.t, dir: lo.kind === 'j' ? 1 : -1, value: v, label: l, side } };
  }
  return null;
}
/* nacrtana kota s jednim krajem na zidu, drugim na rubu otvora / zuba ili na licu zuba */
/* dodjela dodirom: dvije točke na skici → zid–zid ili zid–rub otvora */
function pinTarget(m, st, p, dir, ops) {
  const E = m.E, tol = 3.5 * E, pu = dir === 'H' ? p.x : p.y, pv = dir === 'H' ? p.y : p.x;
  let bo = null, bdo = tol;
  for (const o of ops) { const w = m.walls[o.wall]; if (!w || w.o !== dir || Math.abs(pv - w.c) > tol) continue; for (const [k, e] of [[0, o.s0], [1, o.s1]]) { const d = Math.abs(pu - e); if (d < bdo) { bdo = d; bo = { kind: 'o', op: o, k, pos: e, side: Math.sign(pv - w.c) || 1 }; } } }
  let bw = null, bdw = tol; const po = dir === 'H' ? 'V' : 'H';
  for (const w of m.walls) { if (w.o !== po || w.obj || isView(w, st) || pv < w.e0 - E || pv > w.e1 + E) continue; const d = Math.abs(pu - w.c); if (d < bdw) { bdw = d; bw = { kind: 'w', w, pos: w.c, side: Math.abs(pu - w.c) < 0.25 * E ? 0 : Math.sign(pu - w.c), band: Math.abs(pu - w.c) < 0.6 * E }; } }
  if (bo && (!bw || bdo < bdw * 0.8)) return bo; return bw || bo;
}
/* v2.63: rukom pisana Ø uz kraj prozora/vrata = otvor je uz zid (udaljenost 0) – napravi „dodir” od ugla do ruba otvora */
function zeroPin(m, l, ops) { const E = m.E, R = Math.max(4 * E, 1.6 * Math.max(l.bb.w, l.bb.h)); let best = null;
  for (const op of ops) { const w = m.walls[op.wall]; if (!w || op.niche) continue;
    for (const dir of [-1, 1]) { const e = dir < 0 ? op.s0 : op.s1, P = w.o === 'H' ? { x: e, y: w.c } : { x: w.c, y: e }, d = hyp(P.x - l.cx, P.y - l.cy); if (d > R || (best && d >= best.d)) continue;
      const cand = [w.e0, w.e1]; for (const x of m.walls) { if (x.view || x.obj || x.o === w.o || x.c < w.e0 - E || x.c > w.e1 + E || w.c < x.e0 - 1.5 * E || w.c > x.e1 + 1.5 * E) continue; cand.push(x.c); }
      let uc = null; for (const c of cand) { if ((dir < 0 ? c > e + E : c < e - E)) continue; if (Math.abs(c - e) > 5 * E) continue; if (uc == null || Math.abs(c - e) < Math.abs(uc - e)) uc = c; }
      if (uc == null) continue; best = { d, w, e, uc }; } }
  if (!best) return null; const w = best.w, sd = Math.sign((w.o === 'H' ? l.cy - w.c : l.cx - w.c)) || 1, Q = u => w.o === 'H' ? { x: u, y: w.c + sd * 0.3 * E } : { x: w.c + sd * 0.3 * E, y: u };
  return { a: Q(best.uc), b: Q(best.e), outer: false }; }
function pinSpan(m, st, pin, v, l, ops, putOff, cons) {
  const a = pin.a, b = pin.b; if (!a || !b) return null; const dir = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y) ? 'H' : 'V', ax = dir === 'H' ? 'X' : 'Y';
  const A = pinTarget(m, st, a, dir, ops); let B = pinTarget(m, st, b, dir, ops);
  /* v2.68: udaljenost upisana u prozor/vrata (od ugla do ruba) – drugi kraj je UVIJEK rub tog otvora, i kad je blizu crte drugog zida (inače postane mjera zid–zid i razvuče prostorije) */
  if (pin.blk && l && l.blkc) { const E = m.E; let bo = null, bd = 6 * E; for (const o of ops) { const w = m.walls[o.wall]; if (!w || o.niche || w.o !== dir) continue; const mid = (o.s0 + o.s1) / 2, cu = dir === 'H' ? l.blkc.x : l.blkc.y, cv = dir === 'H' ? l.blkc.y : l.blkc.x, d = Math.hypot(mid - cu, w.c - cv); if (d < bd) { bd = d; const pu = dir === 'H' ? b.x : b.y, k = Math.abs(pu - o.s0) <= Math.abs(pu - o.s1) ? 0 : 1, pv = dir === 'H' ? b.y : b.x; bo = { kind: 'o', op: o, k, pos: k ? o.s1 : o.s0, side: Math.sign(pv - w.c) || 1 }; } } if (bo) B = bo; }
  if (!A || !B) return null;
  /* v2.14 alat Od–do: strana zida zapamćena pri dodiru (near = rub prema drugoj točki = svijetla mjera, far = suprotni rub) */
  const xs = (X, Y, sd) => { if (X.kind !== 'w' || !sd) return; const tw = Math.sign(Y.pos - X.pos) || 1; X.side = sd === 'far' ? -tw : tw; X.band = false; X.xs = true; };
  if (pin.od) { xs(A, B, pin.sa); xs(B, A, pin.sb); }
  if (A.kind === 'w' && B.kind === 'w') { if (A.w.lineAxis === B.w.lineAxis) return null; const [P, Q] = A.pos <= B.pos ? [A, B] : [B, A], tP = wallT(m, P.w, st), tQ = wallT(m, Q.w, st);
    /* dodir na vanjskoj strani vanjskog zida, ali unutar crte zida, a drugi kraj je unutra → svijetla mjera (unutarnje lice); vanjsko lice samo ako su oba kraja izvana ili je dodir izvan zida */
    const outT = X => X.w.exterior && X.w.outSide && X.side === X.w.outSide; const oP = outT(P), oQ = outT(Q);
    if (oP !== oQ && !P.xs && !Q.xs) { const X = oP ? P : Q; if (X.band) X.side = 0; }
    const offI = (P.side || 1) * tP / 2, offJ = (Q.side || -1) * tQ / 2, sp = { ax, dir, i: P.w.lineAxis, j: Q.w.lineAxis, type: 'eksp', offI, offJ, add: offI - offJ, sketch: Q.pos - P.pos, v: dir === 'H' ? (a.y + b.y) / 2 : (a.x + b.x) / 2, pin: true };
    cons.push({ ax, i: sp.i, j: sp.j, target: v + sp.add, value: v, add: sp.add, kind: 'measure', label: l, span: sp, accepted: st.decisions && st.decisions[l.sig] === 'accept' }); return sp; }
  const W0 = A.kind === 'w' ? A : B.kind === 'w' ? B : null, O = A.kind === 'o' ? A : B.kind === 'o' ? B : null;
  if (W0 && O) { const dirO = Math.sign(O.pos - W0.pos) || 1, near = dirO > 0 ? 0 : 1, outer = W0.xs ? W0.side === -dirO : pin.outer; putOff(O.op, { ax, axis: W0.w.lineAxis, t: wallT(m, W0.w, st) * (outer ? -1 : 1), dir: dirO, value: v, label: l, side: O.side, far: O.k !== near }); return { off: true, pin: true }; }
  /* od ruba otvora do ruba drugog otvora na istom zidu (npr. razmak između dvoja vrata) – razriješi se kad jedan od njih ima udaljenost od zida */
  if (A.kind === 'o' && B.kind === 'o' && A.op !== B.op && A.op.wall === B.op.wall) { (m._opRel = m._opRel || []).push({ A, B, v, l, ax }); return { off: true, pin: true, rel: true }; }
  return null;
}
function edimObj(m, dl, ops, nis, st, v, l, putOff) {
  const E = m.E, mo = dl.o === 'H' ? 'V' : 'H', ax = dl.o === 'H' ? 'X' : 'Y';
  const wallAt = e => { let b = null, bd = 3 * E; for (const w of m.walls) { if (w.o !== mo || w.obj || isView(w, st) || dl.c < w.e0 - 3 * E || dl.c > w.e1 + 3 * E) continue; const d = Math.abs(w.c - e); if (d < bd) { bd = d; b = w; } } return b; };
  const objAt = e => { let best = null, bd = 3 * E;
    for (const o of ops) { const w = m.walls[o.wall]; if (!w || w.o !== dl.o || Math.abs(dl.c - w.c) > 0.15 * m.D) continue; for (const s2 of [o.s0, o.s1]) { const d = Math.abs(s2 - e); if (d < bd) { bd = d; best = { o, kind: 'op', c: w.c }; } } }
    for (const n of nis) { if (n.o === dl.o) { if (Math.abs(dl.c - n.cW) > 0.15 * m.D) continue; for (const s2 of [n.s0, n.s1]) { const d = Math.abs(s2 - e); if (d < bd) { bd = d; best = { o: n, kind: 'nis', c: n.cW }; } } }
      else if (n.nc != null && dl.c > n.s0 - 3 * E && dl.c < n.s1 + 3 * E) { const d = Math.abs(n.nc - e); if (d < bd) { bd = d; best = { o: n, kind: 'depth' }; } } }
    return best; };
  for (const [ew, eo] of [[dl.a0, dl.a1], [dl.a1, dl.a0]]) { const w = wallAt(ew), ob = objAt(eo); if (!w || !ob) continue;
    if (ob.kind === 'depth') { ob.o.lead = { value: v, label: l }; return { nlead: ob.o.key }; }
    putOff(ob.o, { ax, axis: w.lineAxis, t: wallT(m, w, st), dir: Math.sign(eo - ew) || 1, value: v, label: l, side: Math.sign(dl.c - ob.c) || 1 }); return { off: true }; }
  // od ruba otvora do zuba (lice zuba → dubina; rub zuba → položaj zuba)
  const opAt = e => { let best = null, bd = 3 * E; for (const o of ops) { const w = m.walls[o.wall]; if (!w || w.o !== dl.o || Math.abs(dl.c - w.c) > 0.15 * m.D) continue; [[o.s0, 0], [o.s1, 1]].forEach(([s2, k]) => { const d = Math.abs(s2 - e); if (d < bd) { bd = d; best = { o, k }; } }); } return best; };
  for (const [ea, eb] of [[dl.a0, dl.a1], [dl.a1, dl.a0]]) { const a = opAt(ea), ob = objAt(eb); if (!a || !ob || ob.kind === 'op') continue; const rel = { op: a.o, k: a.k, dir: Math.sign(eb - ea) || 1, value: v, label: l };
    if (ob.kind === 'depth') { ob.o.opRel = rel; return { nrel: ob.o.key }; } ob.o.opPos = rel; return { nrel: ob.o.key }; }
  return null;
}
function findAxis(m, ax, s, along) { /* v2.37: along = položaj kote uzduž zida – kad je crta prelomljena (dva dijela na istom mjestu), bira se dio uz koji kota stoji */
  let b = -1, bd = m.E * 0.6, bc = false; m.axes[ax].forEach((a, i) => { const d = Math.abs(a.s - s); if (d > m.E * 0.6) return;
    const cov = along != null && !!(a.line && a.line.runs && a.line.runs.some(r => along >= r.a0 - m.E && along <= r.a1 + m.E));
    if (b < 0 || (cov && !bc) || (cov === bc && d <= bd)) { bd = d; b = i; bc = cov; } }); return b; }

/* skok vanjskog zida (dvije debljine): vanjsko lice (fasada) ostaje ravno, razlika debljine ide unutra */
function jogFlush(m, st) {
  for (const g of m.jogs || []) {
    g.ft = null; g.der = null; g.inT = 0; { const sh = st.jogShare && st.jogShare[g.ax + ':' + Math.round(g.c) + ':' + Math.round(g.at)]; g.w = sh == null ? null : sh <= 0.001 ? 1 : 1e-8 / sh; } if (st._jogProbe) continue; const A = m.axes[g.ax], Li = A[g.i] && A[g.i].line, Lj = A[g.j] && A[g.j].line; if (!Li || !Lj) continue;
    const near = L => { let b = null, bd = Infinity; for (const w of m.walls) { if (w.line !== L || w.view || w.obj) continue; const d = Math.min(Math.abs(w.e0 - g.at), Math.abs(w.e1 - g.at)); if (d < bd) { bd = d; b = w; } } return bd <= 3 * m.E ? b : null; };
    const wi = near(Li), wj = near(Lj); g.ext = !!(wi && wj && wi.exterior && wj.exterior);
    /* v2.65: unutarnji zid prelomljen na spoju s poprečnim zidom – skok ide samo na stranu gdje je poprečni zid (tamo ga skriva kut), druga strana zida ostaje ravna (nema zuba u prostoriji) */
    /* v2.75: vanjski/unutarnji gleda se uz sam spoj (dugi zid može tek dalje postati vanjski) */
    const extAt = w => { if (!w.exterior) return false; const E = m.E, mid = (w.e0 + w.e1) / 2, u = g.at + Math.sign(mid - g.at) * Math.min(3 * E, Math.abs(mid - g.at)); let lo = false, hi = false;
      for (const q of m.walls) { if (q === w || q.obj || q.view || q.o !== w.o || u < q.e0 - 0.5 * E || u > q.e1 + 0.5 * E) continue; if (q.c < w.c - E) lo = true; if (q.c > w.c + E) hi = true; } return !(lo && hi); };
    let inT = 0; if (wi && wj && !g.ext && g.soft && !extAt(wi) && !extAt(wj)) { const E = m.E, po = Li.o === 'H' ? 'V' : 'H'; let sp = false, sn = false;
      for (const p of m.walls) { if (p.o !== po || p.view || p.obj || Math.abs(p.c - g.at) > 2 * E) continue; if (Math.abs(p.e0 - g.c) < 1.5 * E && p.e1 > g.c + 1.5 * E) sp = true; else if (Math.abs(p.e1 - g.c) < 1.5 * E && p.e0 < g.c - 1.5 * E) sn = true; else if (p.e0 < g.c - 1.5 * E && p.e1 > g.c + 1.5 * E) { sp = sn = true; } }
      if (sp !== sn) inT = sp ? -1 : 1; }
    g.inT = inT;
    if (!inT && (!wi || !wj || !wi.exterior || !wj.exterior || !wi.outSide || wi.outSide !== wj.outSide)) continue;
    const flip = st.jogFace && st.jogFace[g.ax + ':' + Math.round(g.c) + ':' + Math.round(g.at)] === 'in'; const o = (inT || wi.outSide) * (flip ? -1 : 1);
    const ti = wallT(m, wi, st), tj = wallT(m, wj, st); if (!(ti > 0 && tj > 0)) continue;
    const known = w => !!(w.tLabel || (st.wallT && st.wallT[wallKey(w)]) || (st._derivedT && st._derivedT[wallKey(w)]) || (st._softT && st._softT[wallKey(w)])), ki = known(wi), kj = known(wj);
    g.der = null;
    /* v2.36/2.37: mala razlika mjera – fasada ostaje ravna, kraći dio zida dobije prilagođenu debljinu (i kad je debljina upisana: 1–2 cm tu nije bitno, mjere prostorija jesu) */
    const softDer = () => { const li = wi.e1 - wi.e0, lj = wj.e1 - wj.e0; g.der = li >= lj ? { unk: 'j', w: wj, tk: ti, tu: tj, o, soft: true } : { unk: 'i', w: wi, tk: tj, tu: ti, o, soft: true }; };
    if (ki && kj) { if (Math.abs(ti - tj) < 0.5) { if (g.soft && !flip) softDer(); continue; } g.ft = o * (ti - tj) / 2; g.flush = flip ? 'in' : 'out'; }
    else if (ki !== kj && !flip) g.der = ki ? { unk: 'j', w: wj, tk: ti, tu: tj, o } : { unk: 'i', w: wi, tk: tj, tu: ti, o };
    else if (!ki && !kj && g.soft && !flip) softDer();
  }
}
function solveAxis(m, ax, cons, scale, skip) {
  const A = m.axes[ax], n = A.length; if (!n) return { x: [], comp: [] };
  const M = Array.from({ length: n }, () => new Float64Array(n)), b = new Float64Array(n);
  const add = (i, j, t, w) => { M[i][i] += w; M[j][j] += w; M[i][j] -= w; M[j][i] -= w; b[i] -= w * t; b[j] += w * t; };
  const order = [...A.keys()].sort((p, q) => A[p].s - A[q].s);
  const jg = (m.jogs || []).filter(g => g.ax === ax), isJog = (i, j) => jg.some(g => (g.i === i && g.j === j) || (g.i === j && g.j === i));
  for (let k = 1; k < n; k++) { const i = order[k - 1], j = order[k], t = (A[j].s - A[i].s) * scale; if (!isJog(i, j)) add(i, j, t, 1e-6 / Math.max(1, t) ** 2); }
  for (const g of jg) if (g.ft != null) add(g.i, g.j, g.ft, 1); else add(g.i, g.j, 0, g.w || 1e-8); /* v2.67: g.w = korisnikov udio razlike (st.jogShare) */ /* skok zida: vanjski – ravna fasada; inače bez mjere pola-pola, a odrede ga mjere */
  const i0 = order[0]; M[i0][i0] += 1; b[i0] += A[i0].s * scale;
  cons.forEach((c, k) => { if (c.ax !== ax || k === skip) return; add(c.i, c.j, c.target, (c.prio ? 1e4 : 1) / Math.max(1, Math.abs(c.target)) ** 2); /* ukupne mjere <…> drže se; razlika ide u ostale */ });
  const x = solveLinear(M.map(r => Array.from(r)), Array.from(b));
  const uf = UF(n); cons.forEach((c, k) => { if (c.ax === ax && k !== skip) uf.union(c.i, c.j); }); for (const g of jg) uf.union(g.i, g.j);
  return { x, comp: A.map((_, i) => uf.find(i)) };
}

function violations(cons, sol, tol, ax) {
  const out = [];
  cons.forEach((c, k) => { if (c.kind !== 'measure' || (ax && c.ax !== ax)) return; const X = sol[c.ax].x; const got = X[c.j] - X[c.i] - c.add; const r = got - c.value; c.got = got; c.dev = r; c.rel = r / c.value * 100; if (Math.abs(r) > tol / 100 * c.value + 0.05 && !c.accepted) out.push(k); });
  return out;
}

/* Sljedeće pitanje: nedostajući razmak → mjera izvan ±tol → širina otvora */
function nextQuestion(m, st) {
  const B = buildConstraints(m, st), tol = st.settings.tol;
  const sol = { X: solveAxis(m, 'X', B.cons, B.scale), Y: solveAxis(m, 'Y', B.cons, B.scale) };
  // 1. neodređeni dijelovi
  for (const ax of ['X', 'Y']) {
    const A = m.axes[ax], comp = sol[ax].comp; if (A.length < 2) continue;
    const cnt = new Map(); B.cons.forEach(c => { if (c.ax === ax) cnt.set(comp[c.i], (cnt.get(comp[c.i]) || 0) + 1); });
    const sizes = new Map(); comp.forEach(c => sizes.set(c, (sizes.get(c) || 0) + 1));
    let main = null, best = -1; for (const c of new Set(comp)) { const sc = (cnt.get(c) || 0) * 1000 + sizes.get(c); if (sc > best) { best = sc; main = c; } }
    const order = [...A.keys()].sort((p, q) => A[p].s - A[q].s);
    let pair = null, pd = Infinity;
    for (let k = 1; k < order.length; k++) { const i = order[k - 1], j = order[k]; if (comp[i] === comp[j]) continue; if (comp[i] !== main && comp[j] !== main) continue; const d = A[j].s - A[i].s; if (d < pd) { pd = d; pair = [i, j]; } }
    if (!pair) { for (let k = 1; k < order.length; k++) { const i = order[k - 1], j = order[k]; if (comp[i] !== comp[j]) { pair = [i, j]; break; } } }
    if (pair) {
      const [i, j] = pair, key = 'gap:' + ax + ':' + Math.round(A[i].s) + ':' + Math.round(A[j].s);
      const add = axisT(m, ax, i, st) / 2 + axisT(m, ax, j, st) / 2;
      const est = Math.max(1, Math.round((A[j].s - A[i].s) * B.scale - add));
      return { type: 'gap', key, ax, i, j, si: A[i].s, sj: A[j].s, est, text: (ax === 'X' ? 'Vodoravni' : 'Okomiti') + ' razmak između označenih linija nije izmjeren.', hint: 'Upiši svijetlu mjeru između zidova (cm). Procjena iz skice: ' + fmt(est) + ' cm.' };
    }
  }
  // 1a. prostorija skoro kvadratna, a ostale mjere ne odlučuju koja je mjera vodoravna
  for (const l of m.labels) if (l.roomAsk && !(st.roomSwap && st.roomSwap[l.sig])) { const p = l.info.parsed;
    return { type: 'rd', key: l.sig, label: l, a: p.a, b: p.b, text: 'Mjere prostorije #' + l.n + ': ' + fmt(p.a) + ' × ' + fmt(p.b) + ' – koja je vodoravna (↔ na skici)?', hint: 'Prostorija je na skici skoro kvadratna, a ostale kote ne pokazuju koja mjera ide kamo.' }; }
  // 1b. ista udaljenost otvora s dvije strane zida jako se razlikuje
  for (const o of B.ops.concat(B.nis || [])) { const dd = o.offDisagree; if (!dd) continue;
    return { type: 'od', key: dd.key, a: dd.a.value, b: dd.b.value, na: dd.a.label.n, nb: dd.b.label.n, label: dd.a.label, text: 'Kote #' + dd.a.label.n + ' (' + fmt(dd.a.value) + ') i #' + dd.b.label.n + ' (' + fmt(dd.b.value) + ') mjere udaljenost istog otvora od istog zida, s dvije strane zida, a jako se razlikuju.', hint: 'Mala razlika (štok, lajsna, pločice) uzima se kao prosjek. Ovdje je razlika ' + fmt(Math.abs(dd.a.value - dd.b.value)) + ' cm – provjeri je li broj dobro pročitan (ispravi ga u Kotama) ili odaberi koja je točna.' }; }
  // 2. mjere izvan tolerancije
  const viol = violations(B.cons, sol, tol);
  if (viol.length) {
    // nađi mjeru čije uklanjanje najviše popravlja ostale
    let bestK = viol[0], bestScore = Infinity, bestGot = null;
    const cand = B.cons.map((c, k) => k).filter(k => B.cons[k].kind === 'measure' && !B.cons[k].accepted && B.cons[k].ax === B.cons[viol[0]].ax);
    for (const k of cand) {
      const c = B.cons[k], s2 = solveAxis(m, c.ax, B.cons, B.scale, k);
      if (s2.comp[c.i] !== s2.comp[c.j]) continue; // bez nje nema provjere
      let worst = 0; B.cons.forEach((d, q) => { if (q === k || d.kind !== 'measure' || d.ax !== c.ax || d.accepted) return; const got = s2.x[d.j] - s2.x[d.i] - d.add; worst = Math.max(worst, Math.abs(got - d.value) / d.value * 100 / tol); });
      const got = s2.x[c.j] - s2.x[c.i] - c.add;
      const score = (worst <= 1 ? 0 : worst) + (c.prio ? 10 : 0); // prvo se pita za kotu koja nije ukupna mjera <…>
      if (score < bestScore - 1e-9) { bestScore = score; bestK = k; bestGot = got; }
    }
    const c = B.cons[bestK]; const should = bestGot != null ? bestGot : c.got;
    if (c.chain) return { type: 'viol', chain: true, key: c.label.sig, label: c.label, value: c.value, should, rel: (should - c.value) / c.value * 100, text: 'Kote #' + c.label.n + ' + širina otvora + #' + c.label.n2 + ' (ukupno ' + fmt(c.value) + ') ne slažu se s ostalim mjerama.', hint: 'Prema ostalim mjerama ukupno bi trebalo biti ' + fmt(should) + ' cm (' + fmtPct((should - c.value) / c.value * 100) + '). Ispravi jednu od tih kota u popisu Kota, ili prihvati/zanemari ovaj zbroj.' };
    return { type: 'viol', key: c.label.sig, label: c.label, value: c.value, should, rel: (should - c.value) / c.value * 100, text: 'Kota #' + c.label.n + ' (' + fmt(c.value) + ') ne slaže se s ostalim mjerama.', hint: 'Prema ostalim mjerama trebala bi biti ' + fmt(should) + ' cm (' + fmtPct((should - c.value) / c.value * 100) + '), a dopušteno je ±' + fmt(tol, 1) + ' %. Ispravi je ako je krivo pročitana, ili je zanemari.' };
  }
  // 2b. udaljenost otvora od zida + širina otvora ne stane u prostoriju → ispravi udaljenost
  for (const o of B.ops) {
    const f = o.offset; if (!f || o.offset2 || !(o.w > 0) || f.label.sig == null || (st.decisions && st.decisions[f.label.sig] === 'accept')) continue;
    const w = m.walls[o.wall], Xs = f.ax === 'X' ? sol.X.x : sol.Y.x, face = Xs[f.axis] + f.dir * f.t / 2; let other = null, bd = Infinity;
    for (const q of m.walls) { if (q.o === w.o || isView(q, st) || q.obj || w.c < q.e0 - m.E || w.c > q.e1 + m.E || q.lineAxis === f.axis) continue; if (f.side && !(f.side > 0 ? q.e1 > w.c + m.E : q.e0 < w.c - m.E)) continue; /* samo zidovi na strani gdje je mjereno */ const d = (Xs[q.lineAxis] - Xs[f.axis]) * f.dir; if (d > 0 && d < bd) { bd = d; other = q; } }
    if (!other) continue; const avail = (Xs[other.lineAxis] - f.dir * wallT(m, other, st) / 2 - face) * f.dir, need = f.value + o.w;
    if (avail > 0 && need > avail + Math.max(1, tol / 100 * avail)) { const should = Math.max(0, Math.round((avail - o.w) * 10) / 10);
      return { type: 'viol', key: f.label.sig, label: f.label, value: f.value, should, rel: (should - f.value) / f.value * 100, text: 'Udaljenost #' + f.label.n + ' (' + fmt(f.value) + ') + širina otvora (' + fmt(o.w) + ') veća je od prostora (' + fmt(avail, 1) + ' cm).', hint: 'Otvor bi ušao u zid. Prema ukupnim mjerama udaljenost može biti najviše ' + fmt(should) + ' cm. Ispravi je, ili prihvati (otvor se tada stavlja uz zid).' }; }
  }
  // 3a. zub u unutarnjem zidu: niša ili zadebljanje?
  for (const n of B.nis || []) {
    const w = m.walls[n.wall]; if (!w || w.exterior || n.corner || n.forceKind || n.src === 'crta' || (st.nicheKind && st.nicheKind[n.key])) continue;
    return { type: 'nk', key: n.key, nis: n, text: 'Zub u unutarnjem zidu' + (n.w ? ' (širina ' + fmt(n.w) + ')' : '') + ': je li to niša ili zadebljanje?', hint: 'Niša = udubljenje u zidu. Zadebljanje = dio zida koji strši u prostoriju (npr. pilastar, instalacijski kanal).' + (n.d && n.d >= wallT(m, w, st) ? ' Upisana dubina ' + fmt(n.d) + ' cm veća je od debljine zida (' + fmt(wallT(m, w, st)) + ' cm), pa je vjerojatno zadebljanje.' : '') };
  }
  // 3b. niše bez dubine
  for (const n of B.nis || []) {
    if (n.d || n.lead || n.opRel) continue; const est = Math.max(5, Math.round((n.depthS || 10) * B.scale));
    return { type: 'nd', key: n.key, nis: n, est, text: (n.kind === 'zadebljanje' ? 'Zadebljanje zida bez upisane debljine' : 'Niša bez upisane dubine') + (n.w ? ' (širina ' + fmt(n.w) + ')' : '') + '.', hint: 'Upiši dubinu niše (cm). Procjena iz skice: ' + fmt(est) + ' cm.' };
  }
  // 3c. stubište: broj visina i duljina kraka
  for (const S of B.stairs || []) {
    if (S.done || (S.n && S.L && S.w && S.dir)) continue;
    const ax = S.o === 'H' ? 'Y' : 'X', axw = S.o === 'H' ? 'X' : 'Y', X = sol[ax].x, Xw = sol[axw].x;
    const estL = Math.max(50, Math.round(Math.abs(warp(m, ax, X, S.c1) - warp(m, ax, X, S.c0)))), estW = Math.max(60, Math.round(Math.abs(warp(m, axw, Xw, S.a1) - warp(m, axw, Xw, S.a0))));
    return { type: 'st', key: S.key, stair: S, est: { n: S.n || S.nLines + 1, L: S.L || estL, w: S.w || estW }, text: 'Stubište: upiši podatke kraka.', hint: 'Duljina kraka = tlocrtna duljina od prve do zadnje visine (čela). Gazišta = broj visina − 1, sva jednaka. Podest/polupodest = od zadnje visine do zida ispred kraka (ako je izmjeren). Visina etaže je neobavezna (za visinu stepenice).' };
  }
  // 3. otvori bez širine
  for (const o of B.ops) {
    if (o.w || o.label || (st.openings && st.openings[o.key] && (st.openings[o.key].w || st.openings[o.key].est))) continue;
    if (o.type === 'prolaz' && !o.arc) continue;
    const w = m.walls[o.wall], X = w.o === 'H' ? sol.X.x : sol.Y.x, ax = w.o === 'H' ? 'X' : 'Y';
    const est = Math.max(40, Math.round(Math.abs(warp(m, ax, X, o.s1) - warp(m, ax, X, o.s0))));
    return { type: 'ow', key: o.key, op: o, est, text: (o.type === 'vrata' ? 'Vrata' : 'Otvor') + ' bez upisane širine.', hint: 'Upiši širinu otvora (cm). Procjena iz skice: ' + fmt(est) + ' cm.' };
  }
  return null;
}

/* preslikavanje koordinate skice u cm (po dijelovima linearno između osi) */
function warp(m, ax, X, s) {
  const A = m.axes[ax]; if (!A.length) return s; const pts = A.map((a, i) => [a.s, X[i]]).sort((p, q) => p[0] - q[0]);
  const sc = m._scale || 1;
  if (s <= pts[0][0]) return pts[0][1] + (s - pts[0][0]) * sc;
  if (s >= pts.at(-1)[0]) return pts.at(-1)[1] + (s - pts.at(-1)[0]) * sc;
  for (let k = 1; k < pts.length; k++) if (s <= pts[k][0]) { const [a0, b0] = pts[k - 1], [a1, b1] = pts[k]; const t = (s - a0) / ((a1 - a0) || 1); return b0 + t * (b1 - b0); }
  return s;
}

/* ---------------- 3. IZRADA TLOCRTA (geometrija u cm, y prema dolje) ---------------- */
function build(m, st) {
  const B = buildConstraints(m, st);
  if (B.derivedT && Object.keys(B.derivedT).length) st = Object.assign({}, st, { _derivedT: Object.assign({}, st._derivedT || {}, B.derivedT), _softT: Object.assign({}, st._softT || {}, B.softT || {}) }); /* v2.36: izračunata debljina (ravna fasada) i u crtežu */
  m._scale = B.scale;
  const sol = { X: solveAxis(m, 'X', B.cons, B.scale), Y: solveAxis(m, 'Y', B.cons, B.scale) };
  const tol = st.settings.tol;
  violations(B.cons, sol, tol);
  const X = sol.X.x, Y = sol.Y.x;
  const wx = s => warp(m, 'X', X, s), wy = s => warp(m, 'Y', Y, s); const sbA = new Map();
  const out = { lines: [], arcs: [], texts: [], polys: [], circles: [], report: { adjusted: [], estimates: [], notes: B.notes.map(n => n.text), accepted: [] } };
  if (m.far) out.report.notes.push('Daleko od tlocrta ' + (m.far === 1 ? 'je 1 crta' : 'ima ' + m.far + ' crta') + ' bez kota (vjerojatno ostaci crtanja). Ne utječu na mjere tlocrta, ali ih obriši ako nisu dio objekta.'); /* v2.37 */
  for (const g of m.jogs || []) { const d = sol[g.ax].x[g.j] - sol[g.ax].x[g.i]; if (Math.abs(d) < 0.5 || g.gap) continue; /* v2.42: zidovi razdvojeni prolazom – nisu prelomljeni zid */ if (g.soft) { /* v2.37: vanjski zid s ravnom fasadom opisan je već napomenom o debljini */ if (g.ft == null && !g.der) out.report.notes.push('Mala razlika mjera (' + fmt(Math.abs(d), 1) + ' cm): prostorije su točno po mjerama, a zid između njih ima mali zub.'); continue; } if (g.ft != null) { out.report.notes.push('Vanjski zid u dvije debljine: fasada ravna, zub ' + fmt(Math.abs(2 * d), 1) + ' cm je unutra.'); continue; } out.report.notes.push('Prelomljeni zid: ' + (g.o === 'V' ? 'donji dio pomaknut ' + (d > 0 ? 'desno' : 'lijevo') : 'desni dio pomaknut ' + (d > 0 ? 'prema dolje' : 'prema gore')) + ' za ' + fmt(Math.abs(d), 1) + ' cm (os zida).'); }
  const L = (layer, a, b) => out.lines.push({ layer, a, b });
  const T = (layer, x, y, text, h, rot, al) => out.texts.push({ layer, x, y, text: String(text), h: h || 12, rot: rot || 0, align: al || 'c' });

  /* zidovi kao pravokutnici */
  const rects = [];
  const objRects = [];
  for (const w of m.walls) {
    if (w.obj || isView(w, st)) { // dimnjak / stup / linija u pogledu: samo crta
      const i0 = w.snapped[0] ? perpWallT(m, w, 0, st) / 2 : 0, i1 = w.snapped[1] ? perpWallT(m, w, 1, st) / 2 : 0;
      const a = w.o === 'H' ? { x: X[w.end[0]] + i0, y: Y[w.lineAxis] } : { x: X[w.lineAxis], y: Y[w.end[0]] + i0 }, b = w.o === 'H' ? { x: X[w.end[1]] - i1, y: Y[w.lineAxis] } : { x: X[w.lineAxis], y: Y[w.end[1]] - i1 };
      if (!w.obj) { L('POGLED', a, b); w._t = 0; continue; }
      L('DIMNJAK', a, b); objRects.push({ x0: Math.min(a.x, b.x) - 0.3, x1: Math.max(a.x, b.x) + 0.3, y0: Math.min(a.y, b.y) - 0.3, y1: Math.max(a.y, b.y) + 0.3, layer: 'DIMNJAK' }); w._t = 0; continue;
    }
    const t = wallT(m, w, st), lay = (w.exterior || t >= 20) ? 'ZIDOVI_NOSIVI' : 'ZIDOVI_PREGRADNI';
    const ext0 = w.snapped[0] ? perpWallT(m, w, 0, st) / 2 : 0, ext1 = w.snapped[1] ? perpWallT(m, w, 1, st) / 2 : 0;
    if (w.o === 'H') { const y = Y[w.lineAxis], x0 = X[w.end[0]] - ext0, x1 = X[w.end[1]] + ext1; rects.push({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), y0: y - t / 2, y1: y + t / 2, layer: lay, w }); }
    else { const x = X[w.lineAxis], y0 = Y[w.end[0]] - ext0, y1 = Y[w.end[1]] + ext1; rects.push({ y0: Math.min(y0, y1), y1: Math.max(y0, y1), x0: x - t / 2, x1: x + t / 2, layer: lay, w }); }
    w._t = t; w._layer = lay;
  }
  /* otvori */
  const holes = [];
  const chainDepth = o => { let d = 0, q = o; while (q && q.chain && d < 20) { q = q.chain.ref; d++; } return d; };
  for (const o of [...B.ops].sort((a, b) => chainDepth(a) - chainDepth(b))) {
    const w = m.walls[o.wall], t = w._t, horiz = w.o === 'H';
    const map = horiz ? wx : wy, ov = st.openings && st.openings[o.key];
    let c = (map(o.s0) + map(o.s1)) / 2, est = map(o.s1) - map(o.s0);
    let width = o.w || (ov && ov.w) || est;
    if (!o.w && !(ov && ov.w && !ov.est)) { if (o.type !== 'prolaz' || o.arc) out.report.estimates.push('Širina otvora procijenjena iz skice: ' + fmt(width) + ' cm'); else width = est; }
    const wa = horiz ? X[w.end[0]] : Y[w.end[0]], wb = horiz ? X[w.end[1]] : Y[w.end[1]];
    // otvor uz kraj zida (prekid do okomitog zida) drži uz taj zid
    if (o.src === 'prekid') {
      const lo = Math.min(wa, wb), hi = Math.max(wa, wb);
      if (Math.abs(map(o.s0) - lo) < 1 && est > 0) c = lo + perpWallT(m, w, 0, st) / 2 + width / 2 + Math.max(0, (est - perpWallT(m, w, 0, st) / 2 - width) / 2);
      if (Math.abs(map(o.s1) - hi) < 1 && est > 0) c = hi - perpWallT(m, w, 1, st) / 2 - width / 2 - Math.max(0, (est - perpWallT(m, w, 1, st) / 2 - width) / 2);
    }
    if (o.center != null) c = map(o.center);
    if (o.offset) { const f = o.offset, Xs = f.ax === 'X' ? X : Y, face = Xs[f.axis] + f.dir * f.t / 2, edge = face + f.dir * f.value; c = f.far ? edge - f.dir * width / 2 : edge + f.dir * width / 2; o._off = { face, edge, f }; }
    else if (o.chain && o.chain.ref._c != null) { const ch = o.chain, R0 = ch.ref, e = R0._c + (ch.kX ? 1 : -1) * R0._w / 2, edge = e + ch.sgn * ch.v; c = ch.kY ? edge - width / 2 : edge + width / 2; }
    { // otvor ne smije ući u okomiti zid; ako je širok kao prostor (±3 cm) ide točno od zida do zida
      const mid = (o.s0 + o.s1) / 2, Xs = horiz ? X : Y; let lo = null, hi = null;
      for (const q of m.walls) { if (q.o === w.o || isView(q, st) || q.obj || w.c < q.e0 - m.E || w.c > q.e1 + m.E) continue; if (q.c <= mid && (!lo || q.c > lo.c)) lo = q; if (q.c >= mid && (!hi || q.c < hi.c)) hi = q; }
      if (lo && hi && lo !== hi) { // kod prijeloma zida (skok) otvor ide do užeg od dva dijela – ostatak zida ostaje
        const same = (q0, q) => q.o === q0.o && Math.abs(q.c - q0.c) < 0.5 * m.E && !isView(q, st) && !q.obj && w.c >= q.e0 - m.E && w.c <= q.e1 + m.E;
        const f0 = Math.max(...m.walls.filter(q => same(lo, q)).map(q => Xs[q.lineAxis] + wallT(m, q, st) / 2)), f1 = Math.min(...m.walls.filter(q => same(hi, q)).map(q => Xs[q.lineAxis] - wallT(m, q, st) / 2)), span = f1 - f0;
        if (span > 0) {
          if (width >= span - Math.max(3, 0.02 * span)) { if (Math.abs(width - span) > 0.05) out.report.notes.push('Otvor širine ' + fmt(width) + ' postavljen od zida do zida (svijetla mjera ' + fmt(span, 1) + ' cm)'); width = span; c = (f0 + f1) / 2; o._full = true; }
          else { if (c - width / 2 < f0) c = f0 + width / 2; if (c + width / 2 > f1) c = f1 - width / 2; } } }
    }
    const a = c - width / 2, b = c + width / 2, line = horiz ? Y[w.lineAxis] : X[w.lineAxis];
    holes.push(horiz ? { x0: a, x1: b, y0: line - t / 2 - 0.01, y1: line + t / 2 + 0.01, w } : { y0: a, y1: b, x0: line - t / 2 - 0.01, x1: line + t / 2 + 0.01, w });
    const P = (u, v) => horiz ? { x: u, y: v } : { x: v, y: u };
    const side = o.side || (w.outSide ? -w.outSide : 1), f0 = line - t / 2, f1 = line + t / 2;
    const rect = (lay, u0, v0, u1, v1) => { L(lay, P(u0, v0), P(u1, v0)); L(lay, P(u1, v0), P(u1, v1)); L(lay, P(u1, v1), P(u0, v1)); L(lay, P(u0, v1), P(u0, v0)); };
    if (o.type === 'vrata') {
      // štok uz obje špalete, krilo kao ploča 4 cm, luk otvaranja
      const sw = Math.min(5, width / 6), fs = side > 0 ? f1 : f0, fo = side > 0 ? f0 : f1;
      const sd = t <= 25 ? t : 10, sIn = fs - side * sd;
      rect('OTVORI_VRATA', a, fs, a + sw, sIn); rect('OTVORI_VRATA', b - sw, fs, b, sIn);
      if (o.kl) { /* klizna: krilo 4 cm ispred lica zida, preklapa špalete; strelica smjera */ const k0 = fs + side * 1, k1 = fs + side * 5, ov = Math.min(6, width / 8); rect('OTVORI_VRATA', a - ov, k0, b + ov, k1); const am = fs + side * 12, dr = o.hinge ? 1 : -1, c0 = (a + b) / 2 - dr * width * 0.3, c1 = (a + b) / 2 + dr * width * 0.3; L('OTVORI_VRATA', P(c0, am), P(c1, am)); L('OTVORI_VRATA', P(c1, am), P(c1 - dr * 6, am - 3)); L('OTVORI_VRATA', P(c1, am), P(c1 - dr * 6, am + 3)); } else {
      const sp = o.split > 0 && o.split < 1 ? o.split : 0.5, leaves = o.double ? [[a + sw, 1, (width - 2 * sw) * sp], [b - sw, -1, (width - 2 * sw) * (1 - sp)]] : [[o.hinge ? b - sw : a + sw, o.hinge ? -1 : 1, width - 2 * sw]], lt = 4;
      for (const [hu, dirU, len] of leaves) { const Lk = Math.max(10, len);
        rect('OTVORI_VRATA', hu, fs, hu + dirU * lt, fs + side * Lk);
        out.arcs.push({ layer: 'OTVORI_VRATA', c: P(hu, fs), r: Lk, from: P(hu, fs + side * Lk), to: P(hu + dirU * Lk, fs) }); } }
    } else if (o.type === 'prozor') {
      // presjek: štok uz špalete, krilo sa staklom, crta u ravnini lica zida
      const es = w.outSide || -side, fe = line + es * t / 2, q = d => fe - es * d;
      const fd = 7, r = t >= 15 ? Math.min(15, Math.max(4, t * 0.3)) : Math.max(0, (t - fd) / 2), d1 = r, d2 = Math.min(t, r + fd), sw = Math.min(6, width / 6);
      const lay = 'OTVORI_PROZORI';
      rect(lay, a, q(d1), a + sw, q(d2)); rect(lay, b - sw, q(d1), b, q(d2));
      L(lay, P(a + sw, q(d1 + 1)), P(b - sw, q(d1 + 1))); L(lay, P(a + sw, q(d2 - 1)), P(b - sw, q(d2 - 1)));
      L(lay, P(a + sw, q((d1 + d2) / 2 - 0.6)), P(b - sw, q((d1 + d2) / 2 - 0.6))); L(lay, P(a + sw, q((d1 + d2) / 2 + 0.6)), P(b - sw, q((d1 + d2) / 2 + 0.6)));
      // crta u ravnini lica zida (bez istaknute klupčice)
      if (d1 > 0.5) L(lay, P(a, q(0)), P(b, q(0)));
      if (t - d2 > 0.5) L(lay, P(a, q(t)), P(b, q(t)));
    }
    if ((o.type === 'vrata' || o.type === 'prolaz') && w._layer === 'ZIDOVI_NOSIVI') { L('NADVOJ', P(a, f0), P(b, f0)); L('NADVOJ', P(a, f1), P(b, f1)); } // nadvoj iznad otvora u nosivom zidu
    if (o.w || o.h) {
      const txt = fmt(o.w || width) + (o.h ? '/' + fmt(o.h) : '') + (o.p != null ? '  P=' + fmt(o.p) : '');
      const off = (side > 0 ? f0 : f1) - (side > 0 ? 1 : -1) * 22, p = P(c, off);
      T(o.type === 'prozor' ? 'OTVORI_PROZORI' : 'OTVORI_VRATA', p.x, p.y + (horiz ? 4 : 0), txt, 10, horiz ? 0 : 90);
    }
    if (o._off && !(g0 => g0.f.value === 0 && g0.f.label && g0.f.label.syn0)(o._off)) { const g = o._off, off = line + g.f.side * (t / 2 + 28); out._offDims = out._offDims || []; out._offDims.push({ dir: horiz ? 'H' : 'V', u0: Math.min(g.face, g.edge), u1: Math.max(g.face, g.edge), v: off, text: fmt(g.f.value) }); }
    o._c = c; o._w = width;
  }
  for (const n of B.nis || []) {
    const w = m.walls[n.wall]; if (!w || w._t == null) continue; const t = w._t, horiz = w.o === 'H', map = horiz ? wx : wy, line = horiz ? Y[w.lineAxis] : X[w.lineAxis];
    let c = map(n.center != null ? n.center : (n.s0 + n.s1) / 2), width = n.w || Math.abs(map(n.s1) - map(n.s0));
    const roomS = n.room || (w.outSide ? -w.outSide : 1), face0 = line + roomS * t / 2;
    if (n.d && n.opRel && n.opRel.op._c != null) { const r = n.opRel, edgeX = r.op._c + (r.k ? 1 : -1) * r.op._w / 2, dd0 = Math.abs(face0 - (edgeX + r.dir * r.value)); if (Math.abs(dd0 - n.d) > 2) out.report.notes.push('Zub/proširenje: dubina ' + fmt(n.d) + ', a prema koti #' + r.label.n + ' (od otvora) ' + fmt(dd0, 1) + ' cm – provjeri.'); }
    if (!n.d && n.opRel && n.opRel.op._c != null) { const r = n.opRel, edgeX = r.op._c + (r.k ? 1 : -1) * r.op._w / 2, zf = edgeX + r.dir * r.value, dd0 = Math.abs(face0 - zf); if (dd0 > 0.5) { n.d = Math.round(dd0 * 10) / 10; n.dFromLead = true; } }
    if (n.opPos && n.opPos.op._c != null) { const r = n.opPos, edgeX = r.op._c + (r.k ? 1 : -1) * r.op._w / 2; c = edgeX + r.dir * (r.value + width / 2); n.offset = null; n._cornerAligned = true; n.corner = null; }
    if (!n.d && n.lead) { // pokazna crta od zuba do suprotnog zida: dubina = svijetla mjera − upisani broj
      let q = null, bq = Infinity; const mid = (n.s0 + n.s1) / 2; for (const q2 of m.walls) { if (q2.o !== w.o || q2 === w || isView(q2, st) || q2.obj || mid < q2.e0 - m.E || mid > q2.e1 + m.E) continue; const d = (q2.c - n.cW) * roomS; if (d > m.E && d < bq) { bq = d; q = q2; } }
      if (q) { const face2 = (horiz ? Y : X)[q.lineAxis] - roomS * wallT(m, q, st) / 2, dd0 = Math.abs(face2 - face0) - n.lead.value; if (dd0 > 0) { n.d = Math.round(dd0 * 10) / 10; n.dFromLead = true; } } }
    if (n.corner) { let q = null; for (const q2 of m.walls) if (q2.o !== w.o && !isView(q2, st) && Math.abs(q2.c - n.corner.c) < 2 * m.E && (!q || Math.abs(q2.c - n.corner.c) < Math.abs(q.c - n.corner.c))) q = q2;
      if (q) { const sgn = n.corner.k === 0 ? 1 : -1, cf = (horiz ? X : Y)[q.lineAxis] + sgn * wallT(m, q, st) / 2; c = cf + sgn * width / 2; n.offset = null; n._cornerAligned = true; } }
    let depth = n.kind === 'zadebljanje' ? (n.d || 10) : Math.min(n.d || 10, Math.max(1, t - 1));
    const nm = n.kind === 'zadebljanje' ? 'zadebljanja' : 'niše';
    if (!n.w) out.report.estimates.push('Širina ' + nm + ' procijenjena iz skice: ' + fmt(width) + ' cm');
    if (!n.d || n.dEst) out.report.estimates.push((n.kind === 'zadebljanje' ? 'Debljina zadebljanja' : 'Dubina niše') + ' procijenjena: ' + fmt(depth) + ' cm');
    if (n.offset) { const f = n.offset, Xs = f.ax === 'X' ? X : Y, fc = Xs[f.axis] + f.dir * f.t / 2, edge = fc + f.dir * f.value; c = edge + f.dir * width / 2; out._offDims = out._offDims || []; out._offDims.push({ dir: horiz ? 'H' : 'V', u0: Math.min(fc, edge), u1: Math.max(fc, edge), v: line + f.side * (t / 2 + 28), text: fmt(f.value) }); }
    else if (!n._cornerAligned) out.report.estimates.push('Položaj niše uzet iz skice (nema mjere od zida)');
    const room = n.room || (w.outSide ? -w.outSide : 1), face = line + room * t / 2, a = c - width / 2, b = c + width / 2;
    if (n.kind === 'zadebljanje') { // istaknuti dio zida prema prostoriji
      const dd = n.d || 10, f2 = face + room * dd, v0 = Math.min(face, f2) - 0.01, v1 = Math.max(face, f2) + 0.01, lay = w._layer || 'ZIDOVI_NOSIVI';
      rects.push(horiz ? { x0: a, x1: b, y0: v0, y1: v1, layer: lay, w } : { y0: a, y1: b, x0: v0, x1: v1, layer: lay, w });
      const P2 = (u, v) => horiz ? { x: u, y: v } : { x: v, y: u }, tp2 = P2(c, f2 + room * 14);
      T('OPISI', tp2.x, tp2.y + (horiz ? 4 : 0), 'zadebljanje ' + fmt(width) + '/' + fmt(dd), 9, horiz ? 0 : 90);
      out._nisDims = out._nisDims || []; if (n.w) out._nisDims.push({ dir: horiz ? 'H' : 'V', u0: a, u1: b, v: f2 + room * 30, text: fmt(n.w) });
      continue;
    }
    const back = face - room * depth;
    const v0 = Math.min(face, back) - (room > 0 ? 0 : 0.01), v1 = Math.max(face, back) + (room > 0 ? 0.01 : 0);
    holes.push(horiz ? { x0: a, x1: b, y0: v0, y1: v1, w } : { y0: a, y1: b, x0: v0, x1: v1, w });
    const P = (u, v) => horiz ? { x: u, y: v } : { x: v, y: u }, tp = P(c, face + room * 14);
    T('OPISI', tp.x, tp.y + (horiz ? 4 : 0), 'niša ' + fmt(width) + '/' + fmt(depth) + (n.h ? '/' + fmt(n.h) : ''), 9, horiz ? 0 : 90);
    out._nisDims = out._nisDims || []; if (n.w) out._nisDims.push({ dir: horiz ? 'H' : 'V', u0: a, u1: b, v: face + room * 30, text: fmt(n.w) });
  }
  /* samostojeći stupovi */
  const colCircles = new Set();
  for (const c of B.cols || []) {
    const b = c.bb, ew = Math.abs(wx(b.x1) - wx(b.x0)), eh = Math.abs(wy(b.y1) - wy(b.y0)), cw = c.w || ew, chh = c.h || eh, size = { X: cw, Y: chh };
    if (!c.w || !c.h) out.report.estimates.push('Veličina stupa procijenjena iz skice: ' + fmt(cw, 0) + '/' + fmt(chh, 0) + ' cm');
    const lo = {};
    for (const ax of ['X', 'Y']) {
      const Xs = ax === 'X' ? X : Y, map = ax === 'X' ? wx : wy, ctr = map(ax === 'X' ? (b.x0 + b.x1) / 2 : (b.y0 + b.y1) / 2), p = c.pos[ax];
      if (p) { const t = wallT(m, p.w, st), face = Xs[p.axis] + p.dir * t / 2, edgeV = face + p.dir * p.value; lo[ax] = p.dir > 0 ? edgeV : edgeV - size[ax]; p._face = face; p._edge = edgeV; }
      else { lo[ax] = ctr - size[ax] / 2; out.report.estimates.push('Položaj stupa (' + (ax === 'X' ? 'vodoravno' : 'okomito') + ') uzet iz skice – nema mjere od zida'); }
    }
    const x0 = lo.X, x1 = lo.X + cw, y0 = lo.Y, y1 = lo.Y + chh;
    L('STUPOVI', { x: x0, y: y0 }, { x: x1, y: y0 }); L('STUPOVI', { x: x1, y: y0 }, { x: x1, y: y1 }); L('STUPOVI', { x: x1, y: y1 }, { x: x0, y: y1 }); L('STUPOVI', { x: x0, y: y1 }, { x: x0, y: y0 });
    objRects.push({ x0, x1, y0, y1, layer: 'STUPOVI' });
    for (const ci of m.circles || []) { if (ci.c.x > b.x0 && ci.c.x < b.x1 && ci.c.y > b.y0 && ci.c.y < b.y1) { colCircles.add(ci); const r = ci.r / Math.min(b.w, b.h) * Math.min(cw, chh); out.circles.push({ layer: 'STUPOVI', c: { x: (x0 + x1) / 2, y: (y0 + y1) / 2 }, r: Math.max(1, Math.min(r, Math.min(cw, chh) / 2 - 1)) }); } }
    T('OPISI', (x0 + x1) / 2, y1 + 36, 'stup ' + fmt(cw, 0) + '/' + fmt(chh, 0), 9);
    out._colDims = out._colDims || [];
    if (c.w) out._colDims.push({ dir: 'H', u0: x0, u1: x1, v: y1 + 16, text: fmt(c.w) });
    if (c.h) out._colDims.push({ dir: 'V', u0: y0, u1: y1, v: x1 + 16, text: fmt(c.h) });
    for (const ax of ['X', 'Y']) { const p = c.pos[ax]; if (!p) continue; out._colDims.push({ dir: ax === 'X' ? 'H' : 'V', u0: Math.min(p._face, p._edge), u1: Math.max(p._face, p._edge), v: ax === 'X' ? (y0 + y1) / 2 : (x0 + x1) / 2, text: fmt(p.value) }); }
    c._rect = { x0, x1, y0, y1 };
  }
  /* unija zidova bez otvora → obrisi */
  const grid = rasterize(rects, holes);
  out.grid = grid;
  emitBoundary(grid, (layer, a, b) => L(layer, a, b));
  /* prostorije i površine */
  const gridR = rasterize(rects.concat(objRects), []);
  const roomsRes = findRooms(gridR);
  const used = new Set(), roomNames = {};
  for (const r of m.rooms) {
    const p = { x: wx(r.x), y: wy(r.y) };
    if (r.view) { T('POGLED', p.x, p.y, r.text, 16); continue; }
    const id = roomAt(gridR, roomsRes, p);
    const room = id >= 0 ? roomsRes.rooms[id] : null;
    if (room && used.has(id)) { T('OPISI', p.x, p.y, r.text, 16); continue; }
    if (room) { used.add(id); roomNames[id] = r.text; }
    const c = room ? room.center : p;
    T('OPISI', c.x, c.y - 4, r.text, 16); if (room) { T('OPISI', c.x, c.y + 18, 'P = ' + fmt(room.area / 10000, 2) + ' m²', 11); room._pT = out.texts.at(-1); }
  }
  // visina prostorije (h=…) i dijagonala (D=…) upisane u prostoriju
  const roomBox = rid => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; const g = gridR; for (let i = 0; i < g.nx; i++) for (let j = 0; j < g.ny; j++) { const c = roomsRes.id[i * g.ny + j]; if (c < 0 || roomsRes.map.get(c) !== rid) continue; x0 = Math.min(x0, g.xs[i]); x1 = Math.max(x1, g.xs[i + 1]); y0 = Math.min(y0, g.ys[j]); y1 = Math.max(y1, g.ys[j + 1]); } return Number.isFinite(x0) ? { x0, y0, x1, y1 } : null; };
  const roomName = rid => { const r = m.rooms.find(r2 => !r2.view && roomAt(gridR, roomsRes, { x: wx(r2.x), y: wy(r2.y) }) === rid); return r ? r.text : 'prostorija'; };
  const dgRooms = {}, dgWarps = [], dgTexts = [];
  m.labels.forEach((l, k) => { const I = B.infos[k]; if (!I || (I.kind !== 'visina' && I.kind !== 'dijagonala' && I.kind !== 'pod' && I.kind !== 'hgr') || !(I.kind === 'pod' ? Number.isFinite(I.parsed.v) : I.parsed.v > 0) || (st.decisions && st.decisions[l.sig] === 'ignore')) return;
    const rid = roomAt(gridR, roomsRes, { x: wx(l.cx), y: wy(l.cy) }); if (rid < 0) { out.report.notes.push((I.kind === 'visina' ? 'Visina' : I.kind === 'hgr' ? 'hgr' : 'Dijagonala') + ' #' + l.n + ' nije unutar nijedne prostorije.'); return; }
    const room = roomsRes.rooms[rid], nm = roomName(rid); l.span = { room: rid };
    if (I.kind === 'pod') { room.pod = I.parsed.v; T('OPISI', room.center.x, room.center.y + 46, 'pod ' + (I.parsed.v > 0 ? '+' : '') + fmt(I.parsed.v) + ' cm', 10); return; }
    if (I.kind === 'hgr') { room.hgr = I.parsed.v; T('OPISI', room.center.x, room.center.y + 58, 'h gr = ' + fmt(I.parsed.v) + ' cm', 10); return; }
    if (I.kind === 'visina') { room.h = I.parsed.v; T('OPISI', room.center.x, room.center.y + 34, 'h = ' + fmt(I.parsed.v) + ' cm', 10); return; }
    if (l.dg) { (dgRooms[rid] = dgRooms[rid] || []).push({ D: I.parsed.v, a: { x: wx(l.dg.a.x), y: wy(l.dg.a.y) }, b: { x: wx(l.dg.b.x), y: wy(l.dg.b.y) }, n: l.n }); return; }
    const bx = roomBox(rid); if (!bx) return; const w = bx.x1 - bx.x0, h = bx.y1 - bx.y0, D = I.parsed.v, cosA = (w * w + h * h - D * D) / (2 * w * h);
    if (Math.abs(cosA) > 1) { out.report.notes.push('Dijagonala ' + fmt(D) + ' u prostoriji „' + nm + '” ne odgovara širini ' + fmt(w, 1) + ' i dužini ' + fmt(h, 1) + ' – provjeri mjere.'); return; }
    const ang = Math.acos(cosA) / DEG, dev = ang - 90, shift = Math.sin(dev * DEG) * Math.min(w, h), ideal = Math.hypot(w, h);
    room.diag = { D, ang };
    L('KOTE', { x: bx.x0, y: bx.y0 }, { x: bx.x1, y: bx.y1 });
    const rot = -Math.atan2(h, w) / DEG; T('KOTE', (bx.x0 + bx.x1) / 2, (bx.y0 + bx.y1) / 2 - 4, 'D = ' + fmt(D) + (Math.abs(dev) >= 0.05 ? '  (kut ' + fmt(ang, 1) + '°)' : ''), 10, rot);
    out.report.notes.push('„' + nm + '”: dijagonala ' + fmt(D) + ', za pravi kut bila bi ' + fmt(ideal, 1) + ' → kut zidova ' + fmt(ang, 1) + '° (' + (Math.abs(dev) < 0.05 ? 'pravokutna' : 'odstupanje ' + fmt(Math.abs(shift), 1) + ' cm na ' + fmt(Math.min(w, h), 0) + ' cm') + '). Tlocrt je nacrtan pravokutno.');
  });
  /* v2.09: dijagonale nacrtane od kuta do kuta → stvarni oblik prostorije (4 stranice + 1 ili 2 dijagonale, najmanji kvadrati) */
  for (const rid in dgRooms) { const room = roomsRes.rooms[rid], nm = roomName(+rid), bx = roomBox(+rid), DG = dgRooms[rid]; if (!bx) continue;
    const w = bx.x1 - bx.x0, h = bx.y1 - bx.y0, Q = [{ x: bx.x0, y: bx.y0 }, { x: bx.x1, y: bx.y0 }, { x: bx.x1, y: bx.y1 }, { x: bx.x0, y: bx.y1 }];
    if (Math.abs(room.area - w * h) > 0.03 * w * h) { out.report.notes.push('„' + nm + '”: dijagonale vrijede samo za pravokutnu (četverokutnu) prostoriju – ova ima više kutova, tlocrt nije iskrivljen.'); continue; }
    const near = p => { let bi = -1, bd = Infinity; Q.forEach((q, i) => { const d = hyp(q.x - p.x, q.y - p.y); if (d < bd) { bd = d; bi = i; } }); return [bi, bd]; };
    const eqs = [[0, 1, w], [1, 2, h], [2, 3, w], [3, 0, h]], dgs = []; let bad = false;
    for (const g of DG) { const [ia, da] = near(g.a), [ib, db] = near(g.b), tol = Math.max(40, 0.3 * Math.min(w, h)); if (Math.abs(ia - ib) !== 2 || da > tol || db > tol) { out.report.notes.push('„' + nm + '”: dijagonala ' + fmt(g.D) + ' ne spaja dva nasuprotna kuta – povuci je od kuta do kuta.'); bad = true; continue; } if (dgs.some(x => x.i === Math.min(ia, ib))) { out.report.notes.push('„' + nm + '”: ista dijagonala upisana dvaput, uzeta prva.'); continue; } dgs.push({ i: Math.min(ia, ib), j: Math.max(ia, ib), D: g.D }); eqs.push([ia, ib, g.D]); }
    if (!dgs.length) continue;
    /* nepomičan ostaje zid prema većem dijelu zgrade (iza njega je najviše zidova) */
    const mass = [0, 0, 0, 0], MG = 50, pos = v => Math.max(0, v); for (const r of rects) { const W0 = r.x1 - r.x0, H0 = r.y1 - r.y0; mass[0] += pos(Math.min(r.y1, bx.y0 - MG) - r.y0) * W0; mass[1] += pos(r.x1 - Math.max(r.x0, bx.x1 + MG)) * H0; mass[2] += pos(r.y1 - Math.max(r.y0, bx.y1 + MG)) * W0; mass[3] += pos(Math.min(r.x1, bx.x0 - MG) - r.x0) * H0; }
    let fe = 0; for (let e = 1; e < 4; e++) if (mass[e] > mass[fe] + 1e-6) fe = e;
    const fixd = [fe, (fe + 1) % 4], free = [(fe + 2) % 4, (fe + 3) % 4];
    const Pq = Q.map(q => ({ x: q.x, y: q.y })), res = () => eqs.map(([i, j, Lq]) => hyp(Pq[i].x - Pq[j].x, Pq[i].y - Pq[j].y) - Lq);
    for (let it = 0; it < 40; it++) { const r0 = res(), vars = [], J = r0.map(() => []); for (const f of free) for (const c of ['x', 'y']) vars.push([f, c]);
      vars.forEach(([f, c], vi) => { const o = Pq[f][c]; Pq[f][c] = o + 0.01; const r1 = res(); Pq[f][c] = o; r1.forEach((v, k) => { J[k][vi] = (v - r0[k]) / 0.01; }); });
      const n = vars.length, A = Array.from({ length: n }, () => Array(n).fill(0)), g = Array(n).fill(0); for (let k = 0; k < r0.length; k++) for (let a = 0; a < n; a++) { g[a] += J[k][a] * r0[k]; for (let b = 0; b < n; b++) A[a][b] += J[k][a] * J[k][b]; }
      for (let a = 0; a < n; a++) A[a][a] += 1e-6; const M = A.map((row, a) => [...row, -g[a]]);
      for (let c = 0; c < n; c++) { let pv = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[pv][c])) pv = r; [M[c], M[pv]] = [M[pv], M[c]]; if (Math.abs(M[c][c]) < 1e-12) continue; for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; } }
      let step = 0; vars.forEach(([f, c], vi) => { const dv = Math.abs(M[vi][vi]) > 1e-12 ? M[vi][n] / M[vi][vi] : 0; Pq[f][c] += dv; step = Math.max(step, Math.abs(dv)); }); if (step < 1e-4) break; }
    const rr = res(), worst = Math.max(...rr.map(Math.abs)), angAt = i => { const p0 = Pq[(i + 3) % 4], p1 = Pq[i], p2 = Pq[(i + 1) % 4], a = Math.atan2(p0.y - p1.y, p0.x - p1.x), b = Math.atan2(p2.y - p1.y, p2.x - p1.x); let d = Math.abs(a - b) / DEG; if (d > 180) d = 360 - d; return d; };
    const angs = [0, 1, 2, 3].map(angAt), disp = Pq.map((q, i) => ({ x: q.x - Q[i].x, y: q.y - Q[i].y })), mx = Math.max(...disp.map(d => hyp(d.x, d.y)));
    if (worst > 3) out.report.notes.push('„' + nm + '”: dijagonale i stranice se ne slažu do ' + fmt(worst, 1) + ' cm – provjeri mjere (uzet je najbolji spoj).');
    if (dgs.length < 2) out.report.notes.push('„' + nm + '”: izmjerena je samo jedna dijagonala – za sigurniji oblik izmjeri i drugu.');
    room.diag = { D: dgs.map(d => d.D), ang: angs };
    for (const d of dgs) { L('KOTE', Q[d.i], Q[d.j]); const tq = d.i === 0 ? 0.3 : 0.7, mq = { x: Q[d.i].x + tq * (Q[d.j].x - Q[d.i].x), y: Q[d.i].y + tq * (Q[d.j].y - Q[d.i].y) }; T('KOTE', mq.x, mq.y - 4, 'D = ' + fmt(d.D), 10, 0); dgTexts.push({ t: out.texts.at(-1), a: Q[d.i], b: Q[d.j] }); }
    if (mx < 0.3) { out.report.notes.push('„' + nm + '”: prema dijagonalama prostorija je pravokutna.'); continue; }
    const ar = Math.abs(Pq.reduce((a, q, i) => { const r = Pq[(i + 1) % 4]; return a + q.x * r.y - r.x * q.y; }, 0)) / 2; room.area = ar; if (room._pT) room._pT.text = 'P = ' + fmt(ar / 10000, 2) + ' m²';
    const thk = e => { let t = 0; for (const r of rects) { const ov = e % 2 ? (r.y0 < bx.y1 - 1 && r.y1 > bx.y0 + 1) : (r.x0 < bx.x1 - 1 && r.x1 > bx.x0 + 1); if (!ov) continue; const t2 = e === 0 ? (r.y1 >= bx.y0 - 1 && r.y0 < bx.y0 ? bx.y0 - r.y0 : 0) : e === 1 ? (r.x0 <= bx.x1 + 1 && r.x1 > bx.x1 ? r.x1 - bx.x1 : 0) : e === 2 ? (r.y0 <= bx.y1 + 1 && r.y1 > bx.y1 ? r.y1 - bx.y1 : 0) : (r.x1 >= bx.x0 - 1 && r.x0 < bx.x0 ? bx.x0 - r.x0 : 0); if (t2 <= 80) t = Math.max(t, t2); } return t; };
    dgWarps.push({ x0: bx.x0, y0: bx.y0, x1: bx.x1, y1: bx.y1, d: disp, m: [thk(0), thk(1), thk(2), thk(3)] });
    out.report.notes.push('„' + nm + '”: prema dijagonalama kutovi su ' + angs.map(a => fmt(a, 1) + '°').join(', ') + ' – tlocrt je iskrivljen (pomak do ' + fmt(mx, 1) + ' cm), ' + ['gornji', 'desni', 'donji', 'lijevi'][fe] + ' zid ostaje na mjestu.');
  }
  out._dgWarps = dgWarps; out._dgTexts = dgTexts;
  roomsRes.rooms.forEach((room, id) => { if (!used.has(id) && room.area > 1e4) T('OPISI', room.center.x, room.center.y, 'P = ' + fmt(room.area / 10000, 2) + ' m²', 11); });
  out.rooms = roomsRes.rooms; out.gridR = gridR; out.roomsRes = roomsRes; out.roomNames = roomNames; /* za energetski proračun */

  for (const S of B.stairs || []) drawStair(S);
  for (const SB of m.stairBlk || []) drawStairBlk(SB);
  const gAx = []; for (const KB of (m.krovBlk || []).slice().sort((a, b) => (a.t === 'stup') - (b.t === 'stup'))) { /* krovni prozor, otvor u ploči, terasa/balkon, greda, prag */ const P = KB.P || {}, t = KB.t || 'krovni', nn = v => { const x = parseFloat(String(v == null ? '' : v).replace(',', '.')); return Number.isFinite(x) ? x : NaN; }, dflt = (v, d) => nn(v) > 0 ? nn(v) : d;
    const A = { x: wx(KB.c.x), y: wy(KB.c.y) }, ux = Math.abs(KB.dv.x) >= Math.abs(KB.dv.y), U = ux ? { x: 1, y: 0 } : { x: 0, y: 1 }, Vv = { x: -U.y, y: U.x }, Pw = (u, v) => ({ x: A.x + u * U.x + v * Vv.x, y: A.y + u * U.y + v * Vv.y }), ang = ux ? 0 : 90;
    const box = (lay, w, d) => { const c = [Pw(-w / 2, -d / 2), Pw(w / 2, -d / 2), Pw(w / 2, d / 2), Pw(-w / 2, d / 2)]; for (let i = 0; i < 4; i++) L(lay, c[i], c[(i + 1) % 4]); return c; };
    if (t === 'krovni') { const w = dflt(P.w, 78), h = dflt(P.h, 118), ng = nn(P.nag), d = ng > 0 && ng < 90 ? h * Math.cos(ng * Math.PI / 180) : h; box('KROVNI_PROZOR', w, d); T('KROVNI_PROZOR', A.x, A.y, 'KP ' + fmt(w, 0) + '/' + fmt(h, 0) + (P.p != null && P.p !== '' ? ' p=' + fmt(nn(P.p), 0) : ''), 8, ang); }
    else if (t === 'otvorp') { const w = dflt(P.w, 100), h = dflt(P.h, 250), c = box('OTVOR_PLOCA', w, h); L('OTVOR_PLOCA', c[0], c[2]); L('OTVOR_PLOCA', c[1], c[3]); T('OTVOR_PLOCA', A.x, A.y - 6, 'otvor u ploči ' + fmt(w, 0) + '/' + fmt(h, 0), 8, ang); }
    else if (t === 'terasa') { const k = nn(P.k); let Ar, polys; if (Array.isArray(P.reg) && P.reg.length) { for (const [a, b] of regEdges(P.reg)) L('TERASA', Pw(a[0], a[1]), Pw(b[0], b[1])); Ar = P.reg.reduce((a, q) => a + Math.abs((q[2] - q[0]) * (q[3] - q[1])), 0) / 1e4; polys = P.reg.map(q => [Pw(q[0], q[1]), Pw(q[2], q[1]), Pw(q[2], q[3]), Pw(q[0], q[3])]); } else { const w = dflt(P.w, 300), h = dflt(P.h, 150); Ar = w * h / 1e4; polys = [box('TERASA', w, h)]; }
      (out.terase = out.terase || []).push({ id: KB.id, naziv: P.naziv || 'Terasa', A: Ar * 1e4, polys }); /* v2.58: za legalizaciju (otvoreni dijelovi) */ T('TERASA', A.x, A.y, (P.naziv || 'Terasa') + ' P=' + fmt(Ar, 2) + ' m²' + (k > 0 ? ' k=' + fmt(k, 2) : ''), 10, 0); }
    else if (t === 'greda') { /* v2.49: krajevi grede iz skice (hvatanje na zidove), dvije crtkane crte u širini grede; visina = h ili h prostorije − hgr */
      const bg = dflt(P.b, 25), s0 = KB.s > 0 ? KB.s : 3, hl = dflt(P.L, 300) / 2 / s0, E = sg => ({ x: wx(KB.c.x + sg * KB.dv.x * hl), y: wy(KB.c.y + sg * KB.dv.y * hl) });
      let a = E(-1), b = E(1); const inW = q => rects.some(r => q.x > r.x0 + 0.5 && q.x < r.x1 - 0.5 && q.y > r.y0 + 0.5 && q.y < r.y1 - 0.5);
      const clip = (p, o) => { if (!inW(p)) return p; let lo = 0, hi = 1; for (let i = 0; i < 24; i++) { const k = (lo + hi) / 2, q = { x: p.x + (o.x - p.x) * k, y: p.y + (o.y - p.y) * k }; if (inW(q)) lo = k; else hi = k; } return { x: p.x + (o.x - p.x) * hi, y: p.y + (o.y - p.y) * hi }; };
      const a2 = clip(a, b), b2 = clip(b, a); a = a2; b = b2; const len = Math.hypot(b.x - a.x, b.y - a.y) || 1, u = { x: (b.x - a.x) / len, y: (b.y - a.y) / len }, nv = { x: -u.y, y: u.x }, off = (p, k) => ({ x: p.x + nv.x * k, y: p.y + nv.y * k });
      L('GREDE', off(a, -bg / 2), off(b, -bg / 2)); L('GREDE', off(a, bg / 2), off(b, bg / 2)); gAx.push({ a, b, u, len });
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, rid = roomAt(gridR, roomsRes, mid), room = rid >= 0 ? roomsRes.rooms[rid] : null, rh = room && room.h > 0 ? room.h : NaN, hgr = nn(P.d) > 0 ? nn(P.d) : (room && room.hgr > 0 ? room.hgr : NaN);
      let hg = nn(P.h); if (!(hg > 0) && rh > 0 && hgr > 0 && rh > hgr) hg = rh - hgr;
      if (!(hg > 0)) out.report.notes.push('Greda ' + fmt(bg, 0) + ' cm: nema visine – upiši h grede, ili h i hgr prostorije (hgr=… u prostoriju ili u gredu).');
      let ga = Math.atan2(u.y, u.x) * 180 / Math.PI; if (ga > 90) ga -= 180; if (ga <= -90) ga += 180; const tq = off(mid, -bg / 2 - 6);
      T('GREDE', tq.x, tq.y, 'GREDA ' + fmt(bg, 0) + '/' + (hg > 0 ? fmt(hg, 0) : '?') + (hgr > 0 ? ' hgr=' + fmt(hgr, 0) : ''), 8, ga); }
    else if (t === 'stup') { /* v2.49: stup – uz zid poravnat s licem zida, na gredi na osi grede */
      const ok = P.f === 'ok', sa = ok ? dflt(P.D, 30) : dflt(P.a, 30), sb = ok ? sa : dflt(P.b, sa), ex = ux ? sa : sb, ey = ux ? sb : sa; let c = { x: A.x, y: A.y };
      let bd = Math.max(ex, ey) / 2 + 8, gS = null; for (const g of gAx) { const dx = c.x - g.a.x, dy = c.y - g.a.y, k = dx * g.u.x + dy * g.u.y, v = -dx * g.u.y + dy * g.u.x; if (k < -5 || k > g.len + 5 || Math.abs(v) > bd) continue; bd = Math.abs(v); const kk = Math.max(0, Math.min(g.len, k)); gS = { x: g.a.x + g.u.x * kk, y: g.a.y + g.u.y * kk }; }
      if (gS) c = gS; else { let bx = { d: 12, v: null }, by = { d: 12, v: null }; for (const r of rects) { if (c.y > r.y0 - ey / 2 && c.y < r.y1 + ey / 2 && (r.y1 - r.y0) > (r.x1 - r.x0)) { for (const [f, sd] of [[r.x0, -1], [r.x1, 1]]) { const tx = f + sd * ex / 2, d = Math.abs(c.x - tx); if (d < bx.d && Math.sign(c.x - f) === sd) bx = { d, v: tx }; } }
          if (c.x > r.x0 - ex / 2 && c.x < r.x1 + ex / 2 && (r.x1 - r.x0) >= (r.y1 - r.y0)) { for (const [f, sd] of [[r.y0, -1], [r.y1, 1]]) { const ty = f + sd * ey / 2, d = Math.abs(c.y - ty); if (d < by.d && Math.sign(c.y - f) === sd) by = { d, v: ty }; } } }
        if (bx.v != null) c.x = bx.v; if (by.v != null) c.y = by.v; }
      const x0 = c.x - ex / 2, x1 = c.x + ex / 2, y0 = c.y - ey / 2, y1 = c.y + ey / 2;
      if (ok) { out.circles.push({ layer: 'STUPOVI', c: { x: c.x, y: c.y }, r: sa / 2 }); const k = sa / 2 * 0.7071; L('STUPOVI', { x: c.x - k, y: c.y - k }, { x: c.x + k, y: c.y + k }); L('STUPOVI', { x: c.x + k, y: c.y - k }, { x: c.x - k, y: c.y + k }); }
      else { L('STUPOVI', { x: x0, y: y0 }, { x: x1, y: y0 }); L('STUPOVI', { x: x1, y: y0 }, { x: x1, y: y1 }); L('STUPOVI', { x: x1, y: y1 }, { x: x0, y: y1 }); L('STUPOVI', { x: x0, y: y1 }, { x: x0, y: y0 }); L('STUPOVI', { x: x0, y: y0 }, { x: x1, y: y1 }); L('STUPOVI', { x: x1, y: y0 }, { x: x0, y: y1 }); }
      objRects.push({ x0, x1, y0, y1, layer: 'STUPOVI' }); T('OPISI', c.x, y1 + 14, ok ? 'stup Ø' + fmt(sa, 0) : 'stup ' + fmt(ex, 0) + '/' + fmt(ey, 0), 8); }
    else if (t === 'prag') { const Lp = dflt(P.L, 90), dh = nn(P.dh); L('PRAG', Pw(-Lp / 2, 0), Pw(Lp / 2, 0)); const q = Pw(0, -8); T('PRAG', q.x, q.y, (dh > 0 ? '+' : '') + (Number.isFinite(dh) ? fmt(dh, 0) : '?') + ' cm', 8, ang); } }
  /* kote */
  const allX = rects.flatMap(r => [r.x0, r.x1]), allY = rects.flatMap(r => [r.y0, r.y1]);
  const bx0 = Math.min(...allX), bx1 = Math.max(...allX), by0 = Math.min(...allY), by1 = Math.max(...allY);
  /* kota: prava AutoCAD kota (DIMENSION) s grafikom u bloku */
  out.dims = [];
  function dim(dir, u0, u1, v, written, layer, ext, noChk) {
    const P = (u, w) => dir === 'H' ? { x: u, y: w } : { x: w, y: u };
    const geo0 = Math.abs(u1 - u0), text = fmt(Math.round(geo0 * 10) / 10), wv = num(written); // kota pokazuje stvarnu nacrtanu duljinu
    const d = { layer, dir, lines: [], texts: [], dl0: P(u0, v), dl1: P(u1, v) };
    const DL = (a, b) => d.lines.push({ a, b });
    DL(P(u0, v), P(u1, v));
    for (const u of [u0, u1]) { const a = P(u, v), k = 5; DL({ x: a.x - k, y: a.y + k }, { x: a.x + k, y: a.y - k }); }
    if (ext) for (const [u, from] of ext) { const s = from < v ? 1 : -1; DL(P(u, from + s * 3), P(u, v + s * 5)); }
    d.p1 = ext ? P(u0, ext[0][1]) : P(u0, v); d.p2 = ext ? P(u1, ext[1][1]) : P(u1, v);
    const tp = P((u0 + u1) / 2, v - 4); d.tp = tp; d.texts.push({ x: tp.x, y: tp.y, text, h: 12, rot: dir === 'H' ? 0 : 90 });
    d.text = text; d.geo = geo0; d.written = written;
    out.dims.push(d);
    if (!noChk && Number.isFinite(wv) && Math.abs(geo0 - wv) >= 0.5) { const q = dir === 'H' ? { x: tp.x, y: tp.y + 18 } : { x: tp.x + 16, y: tp.y }; T('PROVJERA', q.x, q.y, 'izmjereno ' + fmt(wv) + ' → ' + text, 8, dir === 'H' ? 0 : 90); }
    return tp;
  }
  let stackX = 0, stackY = 0;
  B.cons.forEach(c => {
    const Xs = c.ax === 'X' ? X : Y, dir = c.ax === 'X' ? 'H' : 'V', vmap = c.ax === 'X' ? wy : wx;
    const lo = Math.min(Xs[c.i], Xs[c.j]), hi = Math.max(Xs[c.i], Xs[c.j]);
    const got = hi - lo - c.add;
    if (c.kind === 'same' || c.kind === 'geo') return; /* geodetske mjere se ne kotiraju posebno – vide se kao ukupne vanjske mjere */
    if (c.chain || c.nodim) return;
    if (c.kind === 'measure') {
      const s = c.span, v = vmap(s.v);
      let u0, u1, ext = null;
      if (s.type === 'eksp') { u0 = Xs[s.i] + s.offI; u1 = Xs[s.j] + s.offJ; if (u1 < u0) [u0, u1] = [u1, u0]; }
      else if (s.type === 'unutarnja') { u0 = lo + s.tA / 2; u1 = hi - s.tB / 2; }
      else if (s.type === 'zidV') { u0 = lo - s.tA / 2; u1 = hi + s.tB / 2; }
      else { u0 = lo - s.tA / 2; u1 = hi + s.tB / 2; const f = s.facade, fv = (c.ax === 'X' ? Y : X)[f.lineAxis], ft = wallT(m, f, st); const face = v < fv ? fv - ft / 2 : fv + ft / 2; ext = [[u0, face], [u1, face]]; }
      const tp = dim(dir, u0, u1, v, fmt(c.value), 'KOTE', ext, true);
      const dev = got - c.value;
      if (Math.abs(dev) >= 0.5) {
        const t = 'izmjereno ' + fmt(c.value) + ' → ' + fmt(got, 1) + ' (' + fmtPct(dev / c.value * 100) + ')';
        const q = dir === 'H' ? { x: tp.x, y: tp.y + 18 } : { x: tp.x + 16, y: tp.y };
        T('PROVJERA', q.x, q.y, t, 8, dir === 'H' ? 0 : 90);
        out.report.adjusted.push({ n: c.label.n, value: c.value, got, rel: dev / c.value * 100, accepted: c.accepted });
      }
      if (c.accepted && Math.abs(dev) > tol / 100 * c.value + 0.05) out.report.accepted.push('Kota #' + c.label.n + ' prihvaćena izvan tolerancije (' + fmtPct(dev / c.value * 100) + ')');
    } else {
      // izmjereno naknadno / procjena: kote iznad i lijevo od zgrade
      const ti = axisT(m, c.ax, c.i, st) / 2, tj = axisT(m, c.ax, c.j, st) / 2;
      const a0 = Xs[c.i] <= Xs[c.j] ? lo + ti : lo + tj, a1 = Xs[c.i] <= Xs[c.j] ? hi - tj : hi - ti;
      const v = dir === 'H' ? by0 - 60 - 30 * (stackX++ % 3) : bx0 - 60 - 30 * (stackY++ % 3);
      const tp = dim(dir, a0, a1, v, fmt(c.value), c.kind === 'estimate' ? 'PROVJERA' : 'KOTE', null, c.kind === 'estimate');
      if (c.kind === 'estimate') { out.report.estimates.push('Razmak procijenjen iz skice: ' + fmt(c.value) + ' cm'); T('PROVJERA', tp.x + (dir === 'V' ? 14 : 0), tp.y + (dir === 'H' ? 14 : 0), 'procjena', 8, dir === 'H' ? 0 : 90); }
    }
  });
  for (const d of out._offDims || []) dim(d.dir, d.u0, d.u1, d.v, d.text, 'KOTE');
  for (const d of out._nisDims || []) dim(d.dir, d.u0, d.u1, d.v, d.text, 'KOTE');
  for (const d of out._colDims || []) dim(d.dir, d.u0, d.u1, d.v, d.text, 'KOTE');
  for (const d of out._stairDims || []) dim(d.dir, d.u0, d.u1, d.v, d.text, 'KOTE');
  // ukupne vanjske mjere
  dim('H', bx0, bx1, by1 + 120, fmt(Math.round(bx1 - bx0), 0), 'KOTE', [[bx0, by1], [bx1, by1]]);
  dim('V', by0, by1, bx1 + 120, fmt(Math.round(by1 - by0), 0), 'KOTE', [[by0, bx1], [by1, bx1]]);

  /* stubište, ostale crte, skica */
  const W2 = p => ({ x: wx(p.x), y: wy(p.y) });
  /* v2.38: stubište u tlocrtu stoji uz LICE zida (kao na skici / po zadanom razmaku), a ne tamo gdje ga razvuče skica – inače uđe u zid */
  function sbOrigin(SB) { if (sbA.has(SB)) return sbA.get(SB); const G = stairGeo(SB.P), ux = Math.abs(SB.dv.x) >= Math.abs(SB.dv.y), U = ux ? { x: Math.sign(SB.dv.x) || 1, y: 0 } : { x: 0, y: Math.sign(SB.dv.y) || 1 }, Vv = { x: -U.y, y: U.x };
    const A = { x: wx(SB.c.x), y: wy(SB.c.y) }; let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const [a, b] of G.segs) for (const q of [a, b]) { const x = q.u * U.x + q.v * Vv.x, y = q.u * U.y + q.v * Vv.y; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const sc = SB.s > 0 ? SB.s : (B.scale || 1), bs = { x0: SB.c.x + x0 / sc, x1: SB.c.x + x1 / sc, y0: SB.c.y + y0 / sc, y1: SB.c.y + y1 / sc }, W = m.walls.filter(w => !w.obj && !isView(w, st));
    const fit = (o, lo, hi, a0, a1, rel0, rel1, Rr, p) => { const cen = (lo + hi) / 2; let L = null, Rw = null; for (const w of W) { if (w.o !== o || w.e1 < a0 + m.E || w.e0 > a1 - m.E) continue; if (w.c <= cen && (!L || w.c > L.c)) L = w; if (w.c >= cen && (!Rw || w.c < Rw.c)) Rw = w; }
      const fL = L ? Rr[L.lineAxis] + wallT(m, L, st) / 2 : null, fR = Rw ? Rr[Rw.lineAxis] - wallT(m, Rw, st) / 2 : null;
      if (p && p.off != null) { if (p.side < 0 && fL != null) return fL + p.off - rel0; if (p.side > 0 && fR != null) return fR - p.off - rel1; }
      const gL = L ? (lo - L.c) * sc - wallT(m, L, st) / 2 : null, gR = Rw ? (Rw.c - hi) * sc - wallT(m, Rw, st) / 2 : null, near = g => g != null && Math.abs(g) <= 12;
      if (near(gL) && (!near(gR) || Math.abs(gL) <= Math.abs(gR))) return fL + Math.max(0, gL) - rel0; if (near(gR)) return fR - Math.max(0, gR) - rel1;
      return null; };
    const ax = fit('V', bs.x0, bs.x1, bs.y0, bs.y1, x0, x1, X, SB.pos && SB.pos.x), ay = fit('H', bs.y0, bs.y1, bs.x0, bs.x1, y0, y1, Y, SB.pos && SB.pos.y);
    if (ax != null) A.x = ax; if (ay != null) A.y = ay; sbA.set(SB, A); return A; }
  function drawStairBlk(SB) {
    const G = stairGeo(SB.P), A = sbOrigin(SB), ux = Math.abs(SB.dv.x) >= Math.abs(SB.dv.y), U = ux ? { x: Math.sign(SB.dv.x) || 1, y: 0 } : { x: 0, y: Math.sign(SB.dv.y) || 1 }, Vv = { x: -U.y, y: U.x };
    const Pw = q => ({ x: A.x + q.u * U.x + q.v * Vv.x, y: A.y + q.u * U.y + q.v * Vv.y });
    const frm = (S2) => { const A2 = sbOrigin(S2), ux2 = Math.abs(S2.dv.x) >= Math.abs(S2.dv.y), U2 = ux2 ? { x: Math.sign(S2.dv.x) || 1, y: 0 } : { x: 0, y: Math.sign(S2.dv.y) || 1 }, V2 = { x: -U2.y, y: U2.x }; return w => ({ u: (w.x - A2.x) * U2.x + (w.y - A2.y) * U2.y, v: (w.x - A2.x) * V2.x + (w.y - A2.y) * V2.y }); };
    const oth = (m.stairBlk || []).filter(o => o !== SB).map(o => ({ mode: stairMode(o.P, o.iz), sh: stairShape(o.P), fromW: frm(o) }));
    const VW = stairView(SB.P, stairMode(SB.P, SB.iz), Pw, oth);
    for (const [a, b] of VW.solid) L('STUBISTE', Pw(a), Pw(b));
    for (const [a, b] of VW.dash) L('STUBISTE_CRTKANO', Pw(a), Pw(b));
    if (VW.brk) for (let i = 1; i < VW.brk.length; i++) L('STUBISTE', Pw(VW.brk[i - 1]), Pw(VW.brk[i]));
    VW.arrows.forEach((ar, k) => { for (let i = 1; i < ar.length; i++) L('STUBISTE', Pw(ar[i - 1]), Pw(ar[i]));
      if (k === VW.headAt && ar.length > 1) { const e = Pw(ar.at(-1)), f = Pw(ar.at(-2)), dx = e.x - f.x, dy = e.y - f.y, l = Math.hypot(dx, dy) || 1, ex = dx / l, ey = dy / l; L('STUBISTE', e, { x: e.x - 10 * ex - 5 * ey, y: e.y - 10 * ey + 5 * ex }); L('STUBISTE', e, { x: e.x - 10 * ex + 5 * ey, y: e.y - 10 * ey - 5 * ex }); } });
    if (VW.dot) out.circles.push({ layer: 'STUBISTE', c: Pw(VW.dot), r: 3 });
    if (G.txtAt) { const tp = Pw({ u: G.txtAt.u, v: G.txtAt.v + 12 }); T('STUBISTE', tp.x, tp.y, G.text, 8, ux ? 0 : 90); }
    for (const r of G.runs) { const o = Pw(r.o), d = { x: r.d.u * U.x + r.d.v * Vv.x, y: r.d.u * U.y + r.d.v * Vv.y }, runY = Math.abs(d.y) > 0.5, lat = runY ? o.x : o.y;
      (out.stairsG = out.stairsG || []).push({ runY, start: runY ? o.y : o.x, arrival: (runY ? o.y : o.x) + (runY ? Math.sign(d.y) : Math.sign(d.x)) * (r.n - 1) * G.g, cLo: lat - G.b / 2, cHi: lat + G.b / 2, n: r.n, dir: runY ? Math.sign(d.y) : Math.sign(d.x), H: G.H, tr: G.g, podest: 0, k0: r.k0, nTot: G.n }); }
  }
  function drawStair(S) {
    const runY = S.o === 'H', Rr = runY ? Y : X, Cc = runY ? X : Y, mapR = runY ? wy : wx, mapC = runY ? wx : wy, P = (r, c) => runY ? { x: c, y: r } : { x: r, y: c };
    const rDir = runY ? 'V' : 'H', cDir = runY ? 'H' : 'V', E = m.E;
    const n = S.n || S.nLines + 1, dir = S.dir || 1, w = S.w || Math.abs(mapC(S.a1) - mapC(S.a0)), L0 = S.L || Math.abs(mapR(S.c1) - mapR(S.c0));
    if (!S.n || !S.L || !S.w || S.est) out.report.estimates.push('Stubište: ' + [!S.n || S.est ? 'broj visina' : null, !S.L || S.est ? 'duljina kraka' : null, !S.w || S.est ? 'širina' : null].filter(Boolean).join(', ') + ' procijenjeno iz skice');
    // bok stubišta uz zid
    const po = S.o === 'H' ? 'V' : 'H', faceOf = (q, sgn) => Cc[q.lineAxis] + sgn * wallT(m, q, st) / 2;
    const sideWall = edge => m.walls.find(q => q.o === po && !isView(q, st) && !q.obj && Math.abs(q.c - edge) < 2 * E && Math.min(q.e1, S.c1) - Math.max(q.e0, S.c0) > 0.3 * (S.c1 - S.c0));
    let cLo, cHi, wHi = sideWall(S.a1), wLo = sideWall(S.a0);
    if (wHi && wLo && !S.w) { cHi = faceOf(wHi, -1); cLo = faceOf(wLo, 1); }
    else if (wHi) { cHi = faceOf(wHi, -1); cLo = cHi - w; } else if (wLo) { cLo = faceOf(wLo, 1); cHi = cLo + w; } else { const cm0 = mapC((S.a0 + S.a1) / 2); cLo = cm0 - w / 2; cHi = cm0 + w / 2; }
    // položaj u smjeru penjanja: od podesta do zida ispred, inače prema skici
    const arrSk = dir > 0 ? S.c1 : S.c0; let arrival, start;
    let ahead = null; if (S.podest) { let bd = Infinity; for (const q of m.walls) { if (q.o !== S.o || isView(q, st) || q.obj) continue; const cm1 = (S.a0 + S.a1) / 2; if (cm1 < q.e0 - E || cm1 > q.e1 + E) continue; const d = (q.c - arrSk) * dir; if (d > -E && d < bd) { bd = d; ahead = q; } } }
    if (ahead) { const face = Rr[ahead.lineAxis] - dir * wallT(m, ahead, st) / 2; arrival = face - dir * S.podest; start = arrival - dir * L0; S._face = face; }
    else { const mid = mapR((S.c0 + S.c1) / 2); start = mid - dir * L0 / 2; arrival = mid + dir * L0 / 2; }
    const tr = n > 1 ? L0 / (n - 1) : L0;
    for (let k = 0; k < n; k++) { const r = start + dir * k * tr; L('STUBISTE', P(r, cLo), P(r, cHi)); }
    if (!wLo) L('STUBISTE', P(start, cLo), P(arrival, cLo)); if (!wHi) L('STUBISTE', P(start, cHi), P(arrival, cHi));
    const wReal = cHi - cLo, cm = (cLo + cHi) / 2, tip = arrival + dir * Math.min(15, (S.podest || 0) * 0.5);
    L('STUBISTE', P(start, cm), P(tip, cm)); L('STUBISTE', P(tip, cm), P(tip - dir * 10, cm - 5)); L('STUBISTE', P(tip, cm), P(tip - dir * 10, cm + 5));
    out.circles.push({ layer: 'STUBISTE', c: P(start, cm), r: 3 });
    const txt = n + ' vis.' + (S.H ? ' × ' + fmt(S.H / n, 1) : '') + ' / ' + (n - 1) + ' gaz. × ' + fmt(tr, 1);
    const tp = P((start + arrival) / 2, cm + Math.min(12, w / 4)); T('STUBISTE', tp.x, tp.y, txt, 8, runY ? 90 : 0);
    (out.stairsG = out.stairsG || []).push({ runY, start, arrival, cLo, cHi, n, dir, H: S.H || null, tr, podest: S.podest || 0 }); /* za presjek */
    out._stairDims = out._stairDims || [];
    out._stairDims.push({ dir: rDir, u0: Math.min(start, arrival), u1: Math.max(start, arrival), v: cLo + Math.min(14, w / 4), text: fmt(L0) });
    out._stairDims.push({ dir: cDir, u0: cLo, u1: cHi, v: start - dir * 14, text: fmt(wReal) });
    if (ahead) out._stairDims.push({ dir: rDir, u0: Math.min(arrival, S._face), u1: Math.max(arrival, S._face), v: cLo + Math.min(14, w / 4), text: fmt(S.podest) });
  }
  const doorStrokes = new Set(m.arcs.filter(a => a.used).map(a => a.stroke));
  for (const d of m.diag) if (!doorStrokes.has(d.stroke) && !d.stairArrow) out.polys.push({ layer: d.view ? 'POGLED' : 'OSTALO', pts: d.map(W2) });
  for (const a of m.arcs) if (!a.used) out.polys.push({ layer: a.view ? 'POGLED' : 'OSTALO', pts: a.pts.map(W2) });
  for (const c of m.circles || []) { if (colCircles.has(c)) continue; const near = m.walls.some(w => w.obj && hyp((w.o === 'H' ? (w.e0 + w.e1) / 2 : w.c) - c.c.x, (w.o === 'H' ? w.c : (w.e0 + w.e1) / 2) - c.c.y) < 0.2 * m.D); out.polys.push({ layer: c.view ? 'POGLED' : near ? 'DIMNJAK' : 'OSTALO', pts: c.pts.map(W2) }); }
  for (const k of ['nacrt', 'kote', 'opisi', 'pogled']) for (const st2 of m.sk[k] || []) out.polys.push({ layer: 'SKICA', pts: st2.map(W2), color: k });
  for (const t of m.texts) { if (t.syn0) continue; const p = rotP({ x: t.x, y: t.y }, -m.theta); T('SKICA', wx(p.x), wy(p.y), t.text, 14, 0, 'l'); }
  for (const n of B.notes) if (n.label) { const p = { x: wx(n.label.cx), y: wy(n.label.cy) }; out.circles.push({ layer: 'PROVJERA', c: p, r: 25 }); }
  if (dgWarps.length) applyDgWarp(out, dgWarps, rects, holes);
  out.bounds = { x0: bx0, y0: by0, x1: bx1, y1: by1 };
  out.walls = rects; out.holes = holes; out.sol = sol; out.B = B;
  const maxAdj = out.report.adjusted.filter(a => !a.accepted).reduce((s, a) => Math.max(s, Math.abs(a.rel)), 0);
  out.report.maxAdj = maxAdj; out.report.nCons = B.cons.filter(c => c.kind === 'measure').length;
  return out;
}

/* rasterizacija pravokutnika na nepravilnu mrežu */
/* v2.09: iskrivljenje tlocrta prema dijagonalama – bilinearno unutar prostorije, rub se prenosi na ostatak zgrade */
function applyDgWarp(out, WS, rects, holes) {
  const cl = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const W = p => { let x = p.x, y = p.y; for (const w of WS) { const ww = (w.x1 - w.x0) || 1, hh = (w.y1 - w.y0) || 1, M = w.m || [0, 0, 0, 0], u = cl((p.x - w.x0) / ww, -M[3] / ww, 1 + M[1] / ww), v = cl((p.y - w.y0) / hh, -M[0] / hh, 1 + M[2] / hh), d = w.d; x += (1 - u) * (1 - v) * d[0].x + u * (1 - v) * d[1].x + u * v * d[2].x + (1 - u) * v * d[3].x; y += (1 - u) * (1 - v) * d[0].y + u * (1 - v) * d[1].y + u * v * d[2].y + (1 - u) * v * d[3].y; } return { x, y }; };
  const cuts = (a, b) => { const ts = [0, 1]; for (const w of WS) { const M = w.m || [0, 0, 0, 0]; for (const X of [w.x0, w.x1, w.x0 - M[3], w.x1 + M[1]]) if ((a.x - X) * (b.x - X) < 0) ts.push((X - a.x) / (b.x - a.x)); for (const Y of [w.y0, w.y1, w.y0 - M[0], w.y1 + M[2]]) if ((a.y - Y) * (b.y - Y) < 0) ts.push((Y - a.y) / (b.y - a.y)); } ts.sort((p, q) => p - q); return ts.map(t => ({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) })); };
  const nl = []; for (const l of out.lines) { const ps = cuts(l.a, l.b); for (let i = 1; i < ps.length; i++) nl.push(Object.assign({}, l, { a: W(ps[i - 1]), b: W(ps[i]) })); } out.lines = nl;
  for (const t of out.texts) { const q = W(t); t.x = q.x; t.y = q.y; }
  for (const p of out.polys) p.pts = p.pts.map(W);
  for (const c of out.circles) c.c = W(c.c);
  for (const a of out.arcs) { a.c = W(a.c); a.from = W(a.from); a.to = W(a.to); }
  const inBox = p => WS.some(w => p.x > w.x0 - 30 && p.x < w.x1 + 30 && p.y > w.y0 - 30 && p.y < w.y1 + 30);
  for (const d of out.dims || []) { if (!inBox({ x: (d.dl0.x + d.dl1.x) / 2, y: (d.dl0.y + d.dl1.y) / 2 })) { const H = d.dir === 'H', P = (u, v) => H ? { x: u, y: v } : { x: v, y: u }, U = q => H ? q.x : q.y, V = q => H ? q.y : q.x, p1 = W(d.p1), p2 = W(d.p2), dv = ((V(W(d.dl0)) - V(d.dl0)) + (V(W(d.dl1)) - V(d.dl1))) / 2, v = V(d.dl0) + dv, u0 = U(p1), u1 = U(p2), was = String(d.text) === fmt(Math.round(d.geo * 10) / 10);
      d.p1 = p1; d.p2 = p2; d.dl0 = P(u0, v); d.dl1 = P(u1, v); d.lines = [{ a: d.dl0, b: d.dl1 }]; for (const u of [u0, u1]) { const a = P(u, v), k = 5; d.lines.push({ a: { x: a.x - k, y: a.y + k }, b: { x: a.x + k, y: a.y - k } }); } for (const [pp, u] of [[p1, u0], [p2, u1]]) { const s0 = V(pp) < v ? 1 : -1; if (Math.abs(V(pp) - v) > 4) d.lines.push({ a: P(u, V(pp) + s0 * 3), b: P(u, v + s0 * 5) }); }
      d.geo = Math.abs(u1 - u0); if (was) d.text = fmt(Math.round(d.geo * 10) / 10); d.tp = P((u0 + u1) / 2, v - 4); for (const t of d.texts) { t.x = d.tp.x; t.y = d.tp.y; if (was) t.text = d.text; } continue; }
    const L0 = d.dl0, L1 = d.dl1; d.lines = d.lines.map(l => ({ a: W(l.a), b: W(l.b) })); for (const t of d.texts) { const q = W(t); t.x = q.x; t.y = q.y; } d.p1 = W(d.p1); d.p2 = W(d.p2); d.dl0 = W(L0); d.dl1 = W(L1); d.tp = W(d.tp);
    const dx = d.dl1.x - d.dl0.x, dy = d.dl1.y - d.dl0.y, ang = Math.atan2(-dy, dx) / DEG, base = d.dir === 'H' ? 0 : 90;
    if (Math.abs(Math.sin((ang - base) * DEG)) > 1e-3) { d.ang = ang; const g = Math.abs(((d.p2.x - d.p1.x) * dx + (d.p2.y - d.p1.y) * dy) / (Math.hypot(dx, dy) || 1)); const was = String(d.text) === fmt(Math.round(d.geo * 10) / 10); d.geo = g; if (was) { d.text = fmt(Math.round(g * 10) / 10); for (const t of d.texts) t.text = d.text; } let r = ang; while (r > 90) r -= 180; while (r <= -90) r += 180; for (const t of d.texts) t.rot = r; } }
  for (const g of out._dgTexts || []) { const a = W(g.a), b = W(g.b); let r = -Math.atan2(b.y - a.y, b.x - a.x) / DEG; if (r > 90) r -= 180; if (r < -90) r += 180; g.t.rot = r; }
  for (const r of out.rooms || []) if (r.center) r.center = W(r.center);
  out.wallQ = rects.map(r => [W({ x: r.x0, y: r.y0 }), W({ x: r.x1, y: r.y0 }), W({ x: r.x1, y: r.y1 }), W({ x: r.x0, y: r.y1 })]);
  out.holeQ = holes.map(r => [W({ x: r.x0, y: r.y0 }), W({ x: r.x1, y: r.y0 }), W({ x: r.x1, y: r.y1 }), W({ x: r.x0, y: r.y1 })]);
  out.report.notes.push('Tlocrt je iskrivljen prema izmjerenim dijagonalama (' + WS.length + ' prostorij' + (WS.length === 1 ? 'a' : 'e') + ').');
}
function rasterize(rects, holes) {
  const r2 = v => Math.round(v * 100) / 100;
  const xs = [...new Set(rects.concat(holes).flatMap(r => [r2(r.x0), r2(r.x1)]))].sort((a, b) => a - b);
  const ys = [...new Set(rects.concat(holes).flatMap(r => [r2(r.y0), r2(r.y1)]))].sort((a, b) => a - b);
  const nx = xs.length - 1, ny = ys.length - 1, cell = new Array(Math.max(0, nx * ny)).fill(null);
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
    const cx = (xs[i] + xs[i + 1]) / 2, cy = (ys[j] + ys[j + 1]) / 2; let lay = null;
    for (const r of rects) if (cx > r.x0 && cx < r.x1 && cy > r.y0 && cy < r.y1) { lay = r.layer; if (lay === 'ZIDOVI_NOSIVI') break; }
    if (lay) for (const h of holes) if (cx > h.x0 && cx < h.x1 && cy > h.y0 && cy < h.y1) { lay = null; break; }
    cell[i * ny + j] = lay;
  }
  return { xs, ys, nx, ny, at: (i, j) => (i < 0 || j < 0 || i >= nx || j >= ny) ? null : cell[i * ny + j] };
}
function emitBoundary(g, out) {
  const { xs, ys, nx, ny } = g;
  // vertikalni rubovi
  for (let i = 0; i <= nx; i++) { let run = null; for (let j = 0; j <= ny; j++) { let lay = null; if (j < ny) { const a = g.at(i - 1, j), b = g.at(i, j); if (!!a !== !!b) lay = a || b; } if (run && run.lay !== lay) { out(run.lay, { x: xs[i], y: ys[run.j] }, { x: xs[i], y: ys[j] }); run = null; } if (lay && !run) run = { lay, j }; } }
  for (let j = 0; j <= ny; j++) { let run = null; for (let i = 0; i <= nx; i++) { let lay = null; if (i < nx) { const a = g.at(i, j - 1), b = g.at(i, j); if (!!a !== !!b) lay = a || b; } if (run && run.lay !== lay) { out(run.lay, { x: xs[run.i], y: ys[j] }, { x: xs[i], y: ys[j] }); run = null; } if (lay && !run) run = { lay, i }; } }
}
function findRooms(g) {
  const { xs, ys, nx, ny } = g, id = new Int32Array(Math.max(0, nx * ny)).fill(-1), rooms = []; let comp = 0;
  const outside = new Set();
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
    if (g.at(i, j) || id[i * ny + j] >= 0) continue;
    const q = [[i, j]]; id[i * ny + j] = comp; let area = 0, touches = false, big = null, bigA = -1;
    while (q.length) { const [a, b] = q.pop(); const ca = (xs[a + 1] - xs[a]) * (ys[b + 1] - ys[b]); area += ca; if (ca > bigA) { bigA = ca; big = [a, b]; } if (a === 0 || b === 0 || a === nx - 1 || b === ny - 1) touches = true; for (const [da, db] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const u = a + da, v = b + db; if (u < 0 || v < 0 || u >= nx || v >= ny) continue; if (g.at(u, v) || id[u * ny + v] >= 0) continue; id[u * ny + v] = comp; q.push([u, v]); } }
    rooms.push({ area, outside: touches, center: { x: (xs[big[0]] + xs[big[0] + 1]) / 2, y: (ys[big[1]] + ys[big[1] + 1]) / 2 } }); comp++;
  }
  // samo unutarnje prostorije
  const map = new Map(), res = []; rooms.forEach((r, k) => { if (!r.outside) { map.set(k, res.length); res.push(r); } });
  return { rooms: res, id, map, nx, ny };
}
function roomAt(g, R, p) {
  const i = g.xs.findIndex((x, k) => k < g.nx && p.x >= x && p.x < g.xs[k + 1]), j = g.ys.findIndex((y, k) => k < g.ny && p.y >= y && p.y < g.ys[k + 1]);
  if (i < 0 || j < 0) return -1; const c = R.id[i * g.ny + j]; return c >= 0 && R.map.has(c) ? R.map.get(c) : -1;
}

/* ---------------- 4. DXF (R12 / AC1009, centimetri) ---------------- */
const LAYERS = [
  ['ZIDOVI_NOSIVI', 7], ['ZIDOVI_PREGRADNI', 8], ['OTVORI_VRATA', 3], ['OTVORI_PROZORI', 4], ['KOTE', 5], ['OPISI', 1],
  ['STUBISTE', 6], ['STUBISTE_CRTKANO', 6], ['KROVNI_PROZOR', 4], ['OTVOR_PLOCA', 1], ['TERASA', 82], ['GREDE', 5], ['PRAG', 30], ['POGLED', 42], ['DIMNJAK', 40], ['STUPOVI', 7], ['OSTALO', 9], ['PROVJERA', 30], ['NADVOJ', 3], ['SKICA', -252]
];
function dxfText(s) { let o = ''; for (const ch of String(s)) { const c = ch.codePointAt(0); if (c > 126 || c < 32) o += '\\U+' + c.toString(16).toUpperCase().padStart(4, '0'); else o += ch; } return o; }
function toDxf(out, opts) {
  opts = opts || {};
  const n = v => (Math.round(v * 1000) / 1000).toString();
  const lines = [];
  const g = (code, val) => { lines.push(String(code), String(val)); };
  const P = p => ({ x: p.x, y: -p.y });
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; const ext = p => { const q = P(p); x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); };
  out.lines.forEach(l => { ext(l.a); ext(l.b); }); (out.dims || []).forEach(d => d.lines.forEach(l => { ext(l.a); ext(l.b); })); if (!Number.isFinite(x0)) { x0 = y0 = 0; x1 = y1 = 100; }
  g(0, 'SECTION'); g(2, 'HEADER');
  g(9, '$ACADVER'); g(1, 'AC1009'); g(9, '$DWGCODEPAGE'); g(3, 'ANSI_1250');
  g(9, '$INSBASE'); g(10, 0); g(20, 0); g(30, 0);
  g(9, '$EXTMIN'); g(10, n(x0)); g(20, n(y0)); g(30, 0); g(9, '$EXTMAX'); g(10, n(x1)); g(20, n(y1)); g(30, 0);
  g(9, '$LIMMIN'); g(10, n(x0)); g(20, n(y0)); g(9, '$LIMMAX'); g(10, n(x1)); g(20, n(y1));
  g(9, '$TEXTSIZE'); g(40, 12); g(9, '$LTSCALE'); g(40, 1); g(9, '$LUNITS'); g(70, 2); g(9, '$LUPREC'); g(70, 0);
  g(9, '$DIMSCALE'); g(40, 1); g(9, '$DIMASZ'); g(40, 5); g(9, '$DIMTSZ'); g(40, 5); g(9, '$DIMTXT'); g(40, 12); g(9, '$DIMEXO'); g(40, 3); g(9, '$DIMEXE'); g(40, 5); g(9, '$DIMGAP'); g(40, 2); g(9, '$DIMTAD'); g(70, 1); g(9, '$DIMTIH'); g(70, 0); g(9, '$DIMTOH'); g(70, 0); g(9, '$DIMSTYLE'); g(2, 'IZMJERA');
  g(0, 'ENDSEC');
  g(0, 'SECTION'); g(2, 'TABLES');
  g(0, 'TABLE'); g(2, 'LTYPE'); g(70, 2); g(0, 'LTYPE'); g(2, 'CONTINUOUS'); g(70, 0); g(3, 'Solid line'); g(72, 65); g(73, 0); g(40, 0);
  g(0, 'LTYPE'); g(2, 'DASHED'); g(70, 0); g(3, '__ __ __'); g(72, 65); g(73, 2); g(40, 15); g(49, 10); g(49, -5); g(0, 'ENDTAB');
  g(0, 'TABLE'); g(2, 'LAYER'); g(70, LAYERS.length + 1);
  g(0, 'LAYER'); g(2, '0'); g(70, 0); g(62, 7); g(6, 'CONTINUOUS');
  for (const [name, col] of LAYERS) { g(0, 'LAYER'); g(2, name); g(70, 0); g(62, col); g(6, /^(STUBISTE_CRTKANO|NADVOJ|KROVNI_PROZOR|OTVOR_PLOCA|TERASA|GREDE)$/.test(name) ? 'DASHED' : 'CONTINUOUS'); }
  g(0, 'ENDTAB');
  g(0, 'TABLE'); g(2, 'STYLE'); g(70, 1); g(0, 'STYLE'); g(2, 'STANDARD'); g(70, 0); g(40, 0); g(41, 1); g(50, 0); g(71, 0); g(42, 12); g(3, 'arial.ttf'); g(4, ''); g(0, 'ENDTAB');
  g(0, 'TABLE'); g(2, 'DIMSTYLE'); g(70, 1);
  g(0, 'DIMSTYLE'); g(2, 'IZMJERA'); g(70, 0); g(3, ''); g(4, ''); g(5, ''); g(6, ''); g(7, '');
  g(40, 1); g(41, 5); g(42, 3); g(43, 7); g(44, 5); g(45, 0); g(46, 0); g(47, 0); g(48, 0); g(140, 12); g(141, 0); g(142, 5); g(143, 2.54); g(144, 1); g(145, 0); g(146, 1); g(147, 2);
  g(71, 0); g(72, 0); g(73, 0); g(74, 0); g(75, 0); g(76, 0); g(77, 1); g(78, 8); g(170, 0); g(171, 2); g(172, 1); g(173, 0); g(174, 0); g(175, 0); g(176, 0); g(177, 0); g(178, 0);
  g(0, 'ENDTAB');
  g(0, 'ENDSEC');
  const dims = (opts.realDims === false ? [] : (out.dims || []));
  g(0, 'SECTION'); g(2, 'BLOCKS');
  dims.forEach((d, k) => {
    const name = '*D' + (k + 1);
    g(0, 'BLOCK'); g(8, '0'); g(2, name); g(70, 1); g(10, 0); g(20, 0); g(30, 0); g(3, name);
    for (const l of d.lines) { const a = P(l.a), b = P(l.b); g(0, 'LINE'); g(8, '0'); g(62, 0); g(10, n(a.x)); g(20, n(a.y)); g(30, 0); g(11, n(b.x)); g(21, n(b.y)); g(31, 0); }
    for (const t of d.texts) { const p = P(t); g(0, 'TEXT'); g(8, '0'); g(62, 0); g(10, n(p.x)); g(20, n(p.y)); g(30, 0); g(40, n(t.h)); g(1, dxfText(t.text)); if (t.rot) g(50, n(t.rot)); g(72, 1); g(11, n(p.x)); g(21, n(p.y)); g(31, 0); }
    g(0, 'ENDBLK'); g(8, '0');
  });
  g(0, 'ENDSEC');
  g(0, 'SECTION'); g(2, 'ENTITIES');
  const skicaCol = { nacrt: 250, kote: 5, opisi: 1, pogled: 42 };
  dims.forEach((d, k) => {
    const p1 = P(d.p1), p2 = P(d.p2), dl = P(d.dl1), tp = P(d.tp);
    const auto = String(Math.round(d.geo)) === String(d.text).replace(',', '.').replace(/\.0$/, '');
    g(0, 'DIMENSION'); g(8, d.layer); g(2, '*D' + (k + 1)); g(3, 'IZMJERA');
    g(10, n(dl.x)); g(20, n(dl.y)); g(30, 0); g(11, n(tp.x)); g(21, n(tp.y)); g(31, 0);
    g(70, 0); if (!auto) g(1, dxfText(d.text));
    g(13, n(p1.x)); g(23, n(p1.y)); g(33, 0); g(14, n(p2.x)); g(24, n(p2.y)); g(34, 0);
    g(50, d.ang != null ? d.ang : (d.dir === 'H' ? 0 : 90));
  });
  if (opts.realDims === false) for (const d of out.dims || []) { for (const l of d.lines) out.lines.push({ layer: d.layer, a: l.a, b: l.b }); for (const t of d.texts) out.texts.push({ layer: d.layer, ...t }); }
  for (const l of out.lines) { const a = P(l.a), b = P(l.b); if (Math.hypot(a.x - b.x, a.y - b.y) < 1e-4) continue; g(0, 'LINE'); g(8, l.layer); g(10, n(a.x)); g(20, n(a.y)); g(30, 0); g(11, n(b.x)); g(21, n(b.y)); g(31, 0); }
  for (const a of out.arcs) {
    const c = P(a.c), f = P(a.from), t = P(a.to); let s = Math.atan2(f.y - c.y, f.x - c.x) / DEG, e = Math.atan2(t.y - c.y, t.x - c.x) / DEG;
    if (((e - s) % 360 + 360) % 360 > 180) [s, e] = [e, s];
    g(0, 'ARC'); g(8, a.layer); g(10, n(c.x)); g(20, n(c.y)); g(30, 0); g(40, n(a.r)); g(50, n((s + 360) % 360)); g(51, n((e + 360) % 360));
  }
  for (const c of out.circles) { const p = P(c.c); g(0, 'CIRCLE'); g(8, c.layer); g(10, n(p.x)); g(20, n(p.y)); g(30, 0); g(40, n(c.r)); }
  for (const p of out.polys) {
    if (!p.pts || p.pts.length < 2) continue; g(0, 'POLYLINE'); g(8, p.layer); if (p.color && skicaCol[p.color]) g(62, skicaCol[p.color]); g(66, 1); g(10, 0); g(20, 0); g(30, 0); g(70, 0);
    const step = Math.max(1, Math.floor(p.pts.length / 400));
    p.pts.forEach((q, i) => { if (i % step && i !== p.pts.length - 1) return; const r = P(q); g(0, 'VERTEX'); g(8, p.layer); g(10, n(r.x)); g(20, n(r.y)); g(30, 0); });
    g(0, 'SEQEND'); g(8, p.layer);
  }
  for (const t of out.texts) {
    const p = P(t); g(0, 'TEXT'); g(8, t.layer); g(10, n(p.x)); g(20, n(p.y)); g(30, 0); g(40, n(t.h)); g(1, dxfText(t.text)); if (t.rot) g(50, n(t.rot));
    if (t.align !== 'l') { g(72, 1); g(11, n(p.x)); g(21, n(p.y)); g(31, 0); }
  }
  g(0, 'ENDSEC'); g(0, 'EOF');
  return lines.join('\r\n') + '\r\n';
}

/* izvoz same skice (bez obrade) */
function sketchDxf(floor) {
  const out = { lines: [], arcs: [], texts: [], polys: [], circles: [] };
  const map = { nacrt: 'SKICA_NACRT', kote: 'SKICA_KOTE', opisi: 'SKICA_OPISI', pogled: 'SKICA_POGLED' };
  for (const o of floor.items || []) {
    if (!o || !map[o.layer]) continue;
    if (o.type === 'text') { const fk = (o.fs || 18) / 18; out.texts.push(o.dir === 'V' ? { layer: map[o.layer], x: o.x + String(o.text).length * 5 * fk, y: o.y - 7 * fk, text: o.text, h: 14 * fk, align: 'c', rot: 90 } : { layer: map[o.layer], x: o.x, y: o.y, text: o.text, h: 14 * fk, align: 'l' }); }
    else if (o.pts && o.pts.length > 1) { if (o.pts.length === 2) out.lines.push({ layer: map[o.layer], a: o.pts[0], b: o.pts[1] }); else out.polys.push({ layer: map[o.layer], pts: o.pts }); }
  }
  const saved = LAYERS.slice(); LAYERS.length = 0; LAYERS.push(['SKICA_NACRT', 7], ['SKICA_KOTE', 5], ['SKICA_OPISI', 1], ['SKICA_POGLED', 42]);
  try { return toDxf(out); } finally { LAYERS.length = 0; LAYERS.push(...saved); }
}

/* zid nacrtan jednom ravnom crtom, a na njemu natpisi različitih debljina (d=20 … d=50): prijelom na spoju s poprečnim zidom između njih */
function autoSplits(m, st) {
  const res = [], byW = new Map();
  m.labels.forEach(l => { let I; try { I = labelInfo(m, l, st); } catch (e) { return; } if (I.kind !== 'debljina' || !(I.parsed.t > 0) || (st.decisions && st.decisions[l.sig] === 'ignore')) return;
    let bw = null, pos = null;
    if (l.dlead) { const dl = l.dlead, pu = dl.o === 'H' ? dl.p.x : dl.p.y; let bd = 1.5 * m.E; for (const w of m.walls) { if (w.o !== dl.o || pu < w.e0 - m.E || pu > w.e1 + m.E) continue; const d = Math.abs(w.c - dl.c); if (d < bd) { bd = d; bw = w; pos = pu; } } }
    if (!bw) { let bd = 0.1 * m.D; for (const w of m.walls) { const pu = w.o === 'H' ? l.cx : l.cy, pv = w.o === 'H' ? l.cy : l.cx; if (pu < w.e0 - m.E || pu > w.e1 + m.E) continue; const d = Math.abs(pv - w.c); if (d < bd) { bd = d; bw = w; pos = pu; } } }
    if (!bw) return; if (!byW.has(bw)) byW.set(bw, []); byW.get(bw).push({ t: I.parsed.t, pos }); });
  for (const [w, arr] of byW) { arr.sort((a, b) => a.pos - b.pos);
    for (let k = 1; k < arr.length; k++) { const a = arr[k - 1], b = arr[k]; if (Math.abs(a.t - b.t) < 3) continue; const mid = (a.pos + b.pos) / 2;
      let best = null, bd = Infinity; for (const p of m.walls) { if (p.o === w.o || p.c <= a.pos + 0.5 * m.E || p.c >= b.pos - 0.5 * m.E) continue; if (Math.min(Math.abs(p.e0 - w.c), Math.abs(p.e1 - w.c)) > 1.5 * m.E) continue; const d = Math.abs(p.c - mid); if (d < bd) { bd = d; best = p; } }
      if (best) res.push({ o: w.o, c: Math.round(w.c * 10) / 10, at: Math.round(best.c * 10) / 10, auto: true }); } }
  return res;
}

/* v2.36: male razlike mjera (pločice, žbuka) ne razvlače prostorije – zid se prelomi na spoju s pregradom i razlika ide u debljinu */
function fitInfo(m, st) { const B = buildConstraints(m, st), sol = { X: solveAxis(m, 'X', B.cons, B.scale), Y: solveAxis(m, 'Y', B.cons, B.scale) }; violations(B.cons, sol, st.settings.tol);
  const lim = Number(st.settings.uskl) || 3; let score = 0, small = 0; const bad = []; B.cons.forEach(c => { if (c.kind !== 'measure' || !Number.isFinite(c.dev)) return; const a = Math.abs(c.dev); score += c.dev * c.dev; if (a <= 2 * lim + 0.05) { small += c.dev * c.dev; if (a > 0.3) bad.push(c); } }); /* velike razlike su prave greške (pitanja) – ne skrivaju se u zidu */
  const jogs = (m.jogs || []).map(g => { const d = sol[g.ax].x[g.j] - sol[g.ax].x[g.i]; return { o: g.o, c: g.c, at: g.at, ax: g.ax, soft: g.soft, ext: !!g.ext, inT: g.inT || 0, d, step: Math.abs(d) * (g.ext ? 2 : 1), dt: Math.abs(d) * (g.ext || g.inT ? 2 : 1) }; });
  return { score, small, bad, jogs, B, sol }; }
function softCands(m, st, info) { const out = [], E = m.E, seen = new Set();
  for (const c of info.bad) { const A = m.axes[c.ax], o = c.ax === 'X' ? 'V' : 'H', lb = c.label || {}, pos = o === 'V' ? lb.cy : lb.cx;
    for (const i of [c.i, c.j]) { const L = A[i] && A[i].line; if (!L || L.view) continue; if (!m.walls.some(w => w.line === L && w.exterior)) continue; /* v2.66: unutarnji zid se ne lomi sam – razlika ide na vanjski zid (fasada ravna) */ const lo = Math.min(...L.runs.map(r => r.a0)), hi = Math.max(...L.runs.map(r => r.a1));
      for (const p of m.walls) { if (p.o === o || p.view || p.obj) continue; if (Math.min(Math.abs(p.e0 - L.c), Math.abs(p.e1 - L.c)) > 1.5 * E) continue; if (p.c <= lo + 1.5 * E || p.c >= hi - 1.5 * E) continue;
        if (L.splitAt != null && Math.abs(L.splitAt - p.c) < 2 * E) continue; const k = o + ':' + Math.round(L.c) + ':' + Math.round(p.c); if (seen.has(k)) continue; seen.add(k);
        out.push({ o, c: Math.round(L.c * 10) / 10, at: Math.round(p.c * 10) / 10, auto: true, soft: true, near: Number.isFinite(pos) ? Math.abs(pos - p.c) : 0 }); } } }
  return out.sort((a, b) => a.near - b.near).slice(0, 14).map(({ near, ...r }) => r); }
const API = { facades, fitInfo, softCands, regEdges, colWall, stairGeo, stairMode, stairShape, stairView, ST_DEF, isView, wallKey, autoSplits, analyze, build, nextQuestion, buildConstraints, parseLabel, autoKind, cleanOcr, toDxf, sketchDxf, DEFAULTS, fmt, fmtPct, rotP, bbox, warp, LAYERS };
if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.IzmjeraTlocrtCore = API;
try { if (root && !root.__izCoreSrc) root.__izCoreSrc = izCore.toString(); } catch (e) { } /* za pozadinsku analizu (Web Worker) */
})(typeof window !== 'undefined' ? window : globalThis);
