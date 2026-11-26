/* Izmjera 57 — čarobnjak „Tlocrt → DXF”: postavke, pregled kota, pitanja, rezultat. */
(function () {
'use strict';
const C = window.IzmjeraTlocrtCore; if (!C) return;
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SETKEY = 'izmjera-tlocrt-settings';

/* ---------- prepoznavanje rukopisa (ML Kit preko Android mosta) ---------- */
const Ink = {
  cb: {}, seq: 0, status: '',
  ok() { return !!(window.AndroidApp && window.AndroidApp.recognizeInk); },
  prepare() { try { if (this.ok() && window.AndroidApp.prepareInk) window.AndroidApp.prepareInk(); } catch (e) { } },
  run(strokes) {
    return new Promise(res => {
      const id = 'r' + (++this.seq); this.cb[id] = res;
      setTimeout(() => { if (this.cb[id]) { delete this.cb[id]; res([]); } }, 15000);
      try { window.AndroidApp.recognizeInk(id, JSON.stringify(strokes)); } catch (e) { delete this.cb[id]; res([]); }
    });
  }
};
window.IzmjeraInk = {
  result(id, json) { const f = Ink.cb[id]; delete Ink.cb[id]; let a = []; try { a = JSON.parse(json || '[]'); } catch (e) { } if (f) f(Array.isArray(a) ? a : []); },
  status(s) { Ink.status = String(s || ''); if (W.open) renderStatus(); }
};
function inkStrokes(raw, rot) {
  const pts = raw.flat(); const b = C.bbox(pts), cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
  return raw.map(st => { const out = []; for (const p of st) { const q = C.rotP({ x: p.x - cx, y: p.y - cy }, rot); out.push(Math.round((q.x + 500) * 10) / 10, Math.round((q.y + 500) * 10) / 10); } return out; });
}
/* v2.63: prekrižena nula (Ø) – krug i ravna crta preko njega, crtana u dva poteza */
function isCrossedZero(raw) {
  if (!raw || raw.length < 2 || raw.length > 3) return false;
  const bb = st => C.bbox(st), plen = st => { let L = 0; for (let i = 1; i < st.length; i++) L += Math.hypot(st[i].x - st[i - 1].x, st[i].y - st[i - 1].y); return L; };
  const S = raw.filter(st => st.length > 1).map(st => ({ st, b: bb(st), L: plen(st) })); if (S.length !== raw.length) return false;
  const lines = S.filter(o => { const a = o.st[0], z = o.st[o.st.length - 1]; return Math.hypot(z.x - a.x, z.y - a.y) >= 0.88 * o.L; });
  const loops = S.filter(o => !lines.includes(o)); if (lines.length !== 1 || !loops.length) return false;
  const lb = C.bbox(loops.flatMap(o => o.st)), D = Math.max(lb.w, lb.h), dm = Math.min(lb.w, lb.h); if (!(D > 0) || dm < 0.35 * D) return false;
  const Lp = loops.reduce((t, o) => t + o.L, 0); if (Lp < 2.2 * D) return false;
  if (loops.length === 1) { const st = loops[0].st, a = st[0], z = st[st.length - 1]; if (Math.hypot(z.x - a.x, z.y - a.y) > 0.4 * D) return false; }
  const ln = lines[0], p0 = ln.st[0], p1 = ln.st[ln.st.length - 1], len = Math.hypot(p1.x - p0.x, p1.y - p0.y); if (len < 0.75 * dm) return false;
  const cx = (lb.x0 + lb.x1) / 2, cy = (lb.y0 + lb.y1) / 2, ux = (p1.x - p0.x) / len, uy = (p1.y - p0.y) / len, t = Math.max(0, Math.min(len, (cx - p0.x) * ux + (cy - p0.y) * uy));
  if (Math.hypot(p0.x + ux * t - cx, p0.y + uy * t - cy) > 0.25 * dm) return false; /* crta prolazi kroz sredinu kruga */
  return t > 0.15 * len && t < 0.85 * len; /* i viri s obje strane */
}
async function recognizeLabel(l) {
  if (!l.rawStrokes || !l.rawStrokes.length) return '';
  if (isCrossedZero(l.rawStrokes)) return 'Ø';
  const tries = [0]; if (l.aspect < 1.1) tries.push(Math.PI / 2, -Math.PI / 2);
  let best = '', bs = -1;
  for (const r of tries) {
    const cands = await Ink.run(inkStrokes(l.rawStrokes, r));
    cands.slice(0, 5).forEach((t, k) => {
      const c = C.cleanOcr(t), p = C.parseLabel(c), digits = (c.match(/\d/g) || []).length / Math.max(1, c.replace(/\s/g, '').length);
      const sc = (p.kind !== 'nepoznato' ? 3 : 0) + (p.uncertain ? -1 : 0) + digits - k * 0.3 - (r ? 0.2 : 0);
      if (sc > bs) { bs = sc; best = c; }
    });
  }
  return best;
}

/* ---------- stanje ---------- */
const W = { open: false, step: 1, floor: null, m: null, st: null, sel: -1, q: null, out: null, view: null, busy: false };
function loadSettings() { try { return { ...C.DEFAULTS, ...JSON.parse(localStorage.getItem(SETKEY) || '{}') }; } catch (e) { return { ...C.DEFAULTS }; } }
function saveSettings(s) { try { localStorage.setItem(SETKEY, JSON.stringify(s)); } catch (e) { } }
function persist() {
  const t = W.floor.tlocrt = W.floor.tlocrt || {};
  t.v = 6; t.labels = W.st.labels; t.answers = W.st.answers; t.decisions = W.st.decisions; t.openings = W.st.openings; t.rec = W.st.rec; t.wallT = W.st.wallT; t.wallView = W.st.wallView; t.niches = W.st.niches; t.nicheKind = W.st.nicheKind; t.stairs = W.st.stairs; t.columns = W.st.columns; t.offPick = W.st.offPick; t.north = W.st.north; t.wallSplit = W.st.wallSplit; t.roomSwap = W.st.roomSwap; t.bigNo = W.st.bigNo || null; t.jogShare = W.st.jogShare || {};
  try { window.IzmjeraApp && window.IzmjeraApp.save(); } catch (e) { }
}

/* ---------- DOM ---------- */
function ensureDom() {
  if ($('tlWiz')) return;
  const d = document.createElement('div'); d.id = 'tlWiz'; d.hidden = true;
  d.innerHTML = '<div class="tl-head"><b>Tlocrt → DXF</b><span class="tl-ver">v2.85</span><span id="tlFloor"></span><div class="tl-steps" id="tlSteps"></div><button id="tlClose" class="tl-btn">✕ Zatvori</button></div><div id="tlFlow" hidden style="background:#12305e;padding:6px 12px"></div>' +
    '<div class="tl-body"><div class="tl-view"><canvas id="tlCanvas"></canvas><div class="tl-zoom"><button id="tlFit" class="tl-btn" title="Prikaži sve">⤢</button></div><div id="tlWallPop" class="tl-pop" hidden></div></div><div class="tl-panel" id="tlPanel"></div></div>';
  document.body.appendChild(d);
  $('tlClose').onclick = close; $('tlFit').onclick = () => { W.view = null; draw(); };
  setupCanvas();
  window.addEventListener('resize', () => { if (W.open) draw(); });
}

function open(opts) {
  const app = window.IzmjeraApp; if (!app) return;
  ensureDom(); W.flow = !!(opts && opts.flow);
  W.floor = app.currentFloor(); W.projectName = app.projectName();
  let t = W.floor.tlocrt || {};
  if ((t.v || 1) < 6) t = {}; // starija verzija: odgovori i očitanja ne odgovaraju novom prepoznavanju
  W.st = { settings: loadSettings(), labels: t.labels || {}, answers: t.answers || {}, decisions: t.decisions || {}, openings: t.openings || {}, rec: t.rec || {}, wallT: t.wallT || {}, wallView: t.wallView || {}, niches: t.niches || {}, nicheKind: t.nicheKind || {}, stairs: t.stairs || {}, columns: t.columns || {}, offPick: t.offPick || {}, north: t.north != null ? t.north : null, wallSplit: t.wallSplit || [], roomSwap: t.roomSwap || {}, bigNo: t.bigNo || null, jogShare: t.jogShare || {} }; W.bigUndo = null; W.bigCache = null; dropOldEstimates(W.st);
  W.m = null; W.out = null; W.q = null; W.sel = -1; W.view = null;
  $('tlFloor').textContent = W.projectName + ' · ' + (W.floor.name || 'Etaža');
  $('tlWiz').hidden = false; W.open = true; Ink.prepare();
  if (W.flow && window.IzmjeraNacrti) IzmjeraNacrti.bar($('tlFlow'), 'tl'); else $('tlFlow').hidden = true;
  go(W.flow && W.floor.tlocrt && W.floor.tlocrt.done ? 4 : 1);
}
function close() { W.open = false; $('tlWiz').hidden = true; }

/* različite debljine (d=…) na istom ravnom zidu → automatski prijelom na spoju s poprečnim zidom */
function autoSplit() {
  if (!W.m) return; let sp; try { sp = C.autoSplits(W.m, W.st); } catch (e) { return; }
  const have = W.st.wallSplit || [], E = W.m.E, same = (a, b) => a.o === b.o && Math.abs(a.c - b.c) < 2 * E && Math.abs(a.at - b.at) < 2 * E;
  const add = sp.filter(s => !have.some(h => same(h, s))); if (!add.length) return;
  W.st.wallSplit = have.concat(add);
  try { W.m = C.analyze(W.floor, { splits: W.st.wallSplit }); } catch (e) { return; }
  W.m.labels.forEach(l => { const k = l.ocrKey || l.sig; if (W.st.rec[k] != null) l.rec = W.st.rec[k]; }); W.out = null; persist();
}
/* v2.36: mjere koje se razlikuju za cm-dva (npr. pločice u jednoj sobi) – prostorije ostaju točno po mjerama, razlika ide u debljinu zida */
function softSplit() {
  const lim = Number(W.st.settings.uskl); if (!W.m || !(lim > 0)) return; const E = W.m.E, same = (a, b) => a.o === b.o && Math.abs(a.c - b.c) < 2 * E && Math.abs(a.at - b.at) < 2 * E;
  const an = sp => { const m = C.analyze(W.floor, { splits: sp }); m.labels.forEach(l => { const k = l.ocrKey || l.sig; if (W.st.rec[k] != null) l.rec = W.st.rec[k]; }); return m; };
  /* ručno upisana debljina / „pogled” zida vrijedi i za oba dijela prelomljenog zida (ključ zida se prelomom mijenja) */
  const carry = (m0, m1, st) => { const out = { wallT: Object.assign({}, st.wallT || {}), wallView: Object.assign({}, st.wallView || {}) };
    for (const f of ['wallT', 'wallView']) for (const w0 of m0.walls) { const v = (st[f] || {})[C.wallKey(w0)]; if (v == null) continue;
      for (const w1 of m1.walls) { if (w1.o !== w0.o || Math.abs(w1.c - w0.c) > 2 * E || w1.e0 < w0.e0 - E || w1.e1 > w0.e1 + E) continue; const k1 = C.wallKey(w1); if (out[f][k1] == null) out[f][k1] = v; } }
    return Object.assign({}, st, out); };
  { /* v2.66: stari automatski prijelomi unutarnjih zidova (zub u prostoriji) se brišu – unutarnji zid se ne lomi sam */
    /* v2.75: vanjski se gleda uz sam prijelom (dugi zid koji tek dalje postane vanjski nije vanjski na tom mjestu); prijelom s odabranom raspodjelom (jogShare) ostaje */
    const extAt = (h, u) => { let lo = false, hi = false; for (const q of W.m.walls) { if (q.obj || q.view || q.o !== h.o || u < q.e0 - 0.5 * E || u > q.e1 + 0.5 * E) continue; if (q.c < h.c - E) lo = true; if (q.c > h.c + E) hi = true; } return !(lo && hi); };
    const ext = h => W.m.walls.some(w => w.o === h.o && w.exterior && Math.abs(w.c - h.c) < 2 * E && h.at >= w.e0 - 2 * E && h.at <= w.e1 + 2 * E) && (extAt(h, h.at - 3 * E) || extAt(h, h.at + 3 * E));
    const shared = h => { const js = W.st.jogShare || {}; return Object.keys(js).some(k => { const [ax, c, at] = k.split(':'); return (ax === 'X') === (h.o === 'V') && Math.abs(+c - h.c) < 2 * E && Math.abs(+at - h.at) < 2 * E; }); };
    const keep = (W.st.wallSplit || []).filter(h => !(h.auto && h.soft) || h.user || shared(h) || ext(h)); if (keep.length < (W.st.wallSplit || []).length) { W.st.wallSplit = keep; try { W.m = an(keep); } catch (e) { } W.out = null; persist(); } }
  let sp = (W.st.wallSplit || []).slice(), m = W.m, st = W.st, info, added = 0, t0 = Date.now(); try { info = C.fitInfo(m, st); } catch (e) { return; }
  for (let round = 0; round < 6 && info.bad.length && Date.now() - t0 < 4000; round++) {
    const cands = C.softCands(m, st, info).filter(c => !sp.some(h => same(h, c))); let best = null;
    for (const c of cands) { if (Date.now() - t0 > 4000) break; const sp2 = sp.concat([c]); let m2, st2, i2; try { m2 = an(sp2); st2 = carry(m, m2, st); i2 = C.fitInfo(m2, st2); } catch (e) { continue; }
      if (i2.jogs.some(g => g.soft && g.step > lim + 0.05)) continue; if (!(i2.small < info.small * 0.6 - 0.05) || i2.score > info.score + 0.5) continue; if (!best || i2.small < best.i.small) best = { sp: sp2, m: m2, st: st2, i: i2 }; }
    if (!best) break; sp = best.sp; m = best.m; st = best.st; info = best.i; added++; }
  if (!added) return; W.st.wallT = st.wallT; W.st.wallView = st.wallView; W.st.wallSplit = sp; W.m = m; W.out = null; persist();
}

/* v2.42: dva odvojena zida na istoj crti skice (npr. desni zid sobe i desni zid ulaza, a između njih hodnik) s mjerama koje se jako razlikuju – svaki dobiva svoju os */
function gapSplit() {
  if (!W.m) return; const E = W.m.E, same = (a, b) => a.o === b.o && Math.abs(a.c - b.c) < 2 * E && Math.abs(a.at - b.at) < 2 * E;
  const an = sp => { const m = C.analyze(W.floor, { splits: sp }); m.labels.forEach(l => { const k = l.ocrKey || l.sig; if (W.st.rec[k] != null) l.rec = W.st.rec[k]; }); return m; };
  const carry = (m0, m1, st) => { const out = { wallT: Object.assign({}, st.wallT || {}), wallView: Object.assign({}, st.wallView || {}) };
    for (const f of ['wallT', 'wallView']) for (const w0 of m0.walls) { const v = (st[f] || {})[C.wallKey(w0)]; if (v == null) continue;
      for (const w1 of m1.walls) { if (w1.o !== w0.o || Math.abs(w1.c - w0.c) > 2 * E || w1.e0 < w0.e0 - E || w1.e1 > w0.e1 + E) continue; const k1 = C.wallKey(w1); if (out[f][k1] == null) out[f][k1] = v; } }
    return Object.assign({}, st, out); };
  const big = (info) => info.B.cons.filter(c => c.kind === 'measure' && Number.isFinite(c.dev) && Math.abs(c.dev) > Math.max(3, 2 * (Number(W.st.settings.uskl) || 3)));
  let sp = (W.st.wallSplit || []).slice(), m = W.m, st = W.st, info, added = 0, t0 = Date.now(); try { info = C.fitInfo(m, st); } catch (e) { return; }
  for (let round = 0; round < 4 && Date.now() - t0 < 4000; round++) {
    const bad = big(info); if (!bad.length) break; const cands = [];
    for (const ax of ['X', 'Y']) { const o = ax === 'X' ? 'V' : 'H';
      m.axes[ax].forEach((A, i) => { const L = A.line; if (!L || L.view || !bad.some(c => c.ax === ax && (c.i === i || c.j === i))) return;
        const ws = m.walls.filter(w => w.line === L && !w.view && !w.obj).sort((a, b) => a.e0 - b.e0);
        for (let k = 1; k < ws.length; k++) { const g0 = ws[k - 1].e1, g1 = ws[k].e0; if (g1 - g0 < 4 * E) continue; const c = { o, c: Math.round(L.c * 10) / 10, at: Math.round((g0 + g1) / 2 * 10) / 10, auto: true, gap: true }; if (!sp.some(h => same(h, c)) && !cands.some(h => same(h, c))) cands.push(c); }
        /* v2.81: i praznina unutar jednog zida (prolaz između dva dijela zgrade) – prijelom na krajevima praznine */
        const rs = (L.runs || []).slice().sort((a, b) => a.a0 - b.a0); for (let k = 1; k < rs.length; k++) { if (rs[k].a0 - rs[k - 1].a1 < 4 * E) continue; for (const at of [rs[k - 1].a1, rs[k].a0]) { const c = { o, c: Math.round(L.c * 10) / 10, at: Math.round(at * 10) / 10, auto: true, gap: true }; if (!sp.some(h => same(h, c)) && !cands.some(h => same(h, c))) cands.push(c); } } }); }
    let best = null;
    for (const c of cands.slice(0, 10)) { if (Date.now() - t0 > 4000) break; const sp2 = sp.concat([c]); let m2, st2, i2; try { m2 = an(sp2); st2 = carry(m, m2, st); i2 = C.fitInfo(m2, st2); } catch (e) { continue; }
      if (!(i2.score < info.score * 0.5)) continue; if (!best || i2.score < best.i.score) best = { sp: sp2, m: m2, st: st2, i: i2 }; }
    if (!best) break; sp = best.sp; m = best.m; st = best.st; info = best.i; added++; }
  if (!added) return; W.st.wallT = st.wallT; W.st.wallView = st.wallView; W.st.wallSplit = sp; W.m = m; W.out = null; persist();
}

/* v2.62: velike razlike mjera u nizu prostorija (npr. dubine 763 / 789 uz isti vanjski zid) – prijedlog prijeloma zidova:
   fasada ostaje ravna, prostorije ostaju po izmjeri, a mijenja se debljina zida po prostoriji. Primjenjuje se tek kad korisnik potvrdi. */
function bigSplitCalc() {
  if (!W.m) return null; const E = W.m.E, same = (a, b) => a.o === b.o && Math.abs(a.c - b.c) < 2 * E && Math.abs(a.at - b.at) < 2 * E;
  const an = sp => { const m = C.analyze(W.floor, { splits: sp }); m.labels.forEach(l => { const k = l.ocrKey || l.sig; if (W.st.rec[k] != null) l.rec = W.st.rec[k]; }); return m; };
  const carry = (m0, m1, st) => { const out = { wallT: Object.assign({}, st.wallT || {}), wallView: Object.assign({}, st.wallView || {}) };
    for (const f of ['wallT', 'wallView']) for (const w0 of m0.walls) { const v = (st[f] || {})[C.wallKey(w0)]; if (v == null) continue;
      for (const w1 of m1.walls) { if (w1.o !== w0.o || Math.abs(w1.c - w0.c) > 2 * E || w1.e0 < w0.e0 - E || w1.e1 > w0.e1 + E) continue; const k1 = C.wallKey(w1); if (out[f][k1] == null) out[f][k1] = v; } }
    return Object.assign({}, st, out); };
  const lim = Number(W.st.settings.uskl) || 3, t00 = Date.now();
  const devMax = info => Math.max(0, ...info.B.cons.filter(c => c.kind === 'measure' && Number.isFinite(c.dev) && Math.abs(c.dev) <= 40).map(c => Math.abs(c.dev)));
  const base = Object.assign({}, W.st, { decisions: {}, settings: Object.assign({}, W.st.settings, { uskl: 15 }) });
  let m = W.m, st = base, info; try { info = C.fitInfo(m, st); } catch (e) { return null; }
  const before = devMax(info), nOver = inf => inf.B.cons.filter(c => c.kind === 'measure' && Number.isFinite(c.dev) && Math.abs(c.dev) > lim + 0.05).length, nB = nOver(info), sc0 = info.score; if (before <= Math.max(lim, 3) + 0.05) return null;
  const sp0 = (W.st.wallSplit || []).slice(); let sp = sp0.slice();
  const redo = sp2 => { const m2 = an(sp2), st2 = carry(m, m2, st), i2 = C.fitInfo(m2, st2); m = m2; st = st2; info = i2; sp = sp2; };
  try {
    for (let r = 0; r < 3 && Date.now() - t00 < 6000; r++) { const cands = C.softCands(m, st, info).filter(c => !sp.some(h => same(h, c))); if (!cands.length) break; redo(sp.concat(cands)); if (devMax(info) <= lim) break; }
    if (sp.length === sp0.length) return null;
    const rowsOf = () => { const sT = info.B.softT || {}, rows = [];
      for (const w of m.walls) { const k = C.wallKey(w); if (sT[k] == null || w.view || w.obj) continue; const t0 = (st.wallT && st.wallT[k]) || w.tLabel || (w.exterior ? W.st.settings.ext : W.st.settings.int), t1 = Math.round(sT[k] * 10) / 10; if (Math.abs(t1 - t0) < 0.5) continue; rows.push({ w, k, t0, t1 }); }
      return rows; };
    /* nerazumna debljina (tanje od 8 cm ili promjena veća od 20 cm) – tu se ne lomi, prostorija se prilagodi */
    for (let r = 0; r < 4 && Date.now() - t00 < 8000; r++) { const badR = rowsOf().filter(x => x.t1 < 8 || Math.abs(x.t1 - x.t0) > 20); if (!badR.length) break;
      const keep = sp.filter(h => sp0.some(q => same(q, h)) || !badR.some(x => h.o === x.w.o && Math.abs(h.c - x.w.c) < 3 * E && (Math.abs(h.at - x.w.e0) < 2 * E || Math.abs(h.at - x.w.e1) < 2 * E))); if (keep.length === sp.length) break; redo(keep); }
    /* nepotrebni prijelomi (skok < 0,5 cm) se maknu */
    { const need = sp.filter(h => sp0.some(q => same(q, h)) || !info.jogs.some(g => g.soft && g.o === h.o && Math.abs(g.c - h.c) < 2 * E && Math.abs(g.at - h.at) < 2 * E && g.step < 0.5)); if (need.length < sp.length) redo(need); }
    const after = devMax(info), rows = rowsOf().filter(x => x.t1 >= 8 && Math.abs(x.t1 - x.t0) <= 20);
    const nA = nOver(info); if (!rows.length || sp.length === sp0.length || !(info.score < sc0 * 0.6) || !(nA < nB)) return null;
    { let o2 = null; try { o2 = C.build(m, Object.assign({}, W.st, { wallSplit: sp, wallT: st.wallT, wallView: st.wallView })); } catch (e) { }
      if (o2 && o2.sol) { const X = o2.sol.X.x, Y = o2.sol.Y.x; for (const x of rows) { const w = x.w, A = w.o === 'H' ? X : Y, B = w.o === 'H' ? Y : X, a0 = A[w.end[0]], a1 = A[w.end[1]], c = B[w.lineAxis]; if ([a0, a1, c].every(Number.isFinite)) x.pos = { a0, a1, c }; } } }
    return { nB, nA, sp, wallT: st.wallT, wallView: st.wallView, rows, before, after, m };
  } catch (e) { return null; }
}
function lim0() { return Number(W.st.settings.uskl) || 3; }
/* v2.67: razlika mjera na spoju – korisnik bira koliko ide na vanjski, a koliko na unutarnji zid (skok unutarnjeg zida samo na strani poprečnog zida) */
function jogGroups() {
  const m = W.m; if (!m) return []; let info; try { info = C.fitInfo(m, W.st); } catch (e) { return []; } const E = m.E, out = [];
  const soft = info.jogs.filter(g => g.soft && (g.ext || g.inT)); const used = new Set();
  for (const g of soft) { if (!g.ext || used.has(g)) continue; used.add(g); const grp = { at: g.at, o: g.o, ax: g.ax, ext: g, int: null, cand: null };
    const p2 = soft.find(x => x !== g && !x.ext && x.o === g.o && Math.abs(x.at - g.at) < 2 * E); if (p2) { grp.int = p2; used.add(p2); }
    else { /* unutarnji zid s istim spojem (poprečni zid dolazi s jedne strane) – može preuzeti dio razlike */
      const po = g.o === 'H' ? 'V' : 'H';
      for (const L of [...new Set(m.walls.map(w => w.line).filter(Boolean))]) { if (L.o !== g.o || L.view || Math.abs(L.c - g.c) < 3 * E || m.walls.some(w => w.line === L && w.exterior)) continue; const lo = Math.min(...L.runs.map(r => r.a0)), hi = Math.max(...L.runs.map(r => r.a1)); if (!(g.at > lo + 2 * E && g.at < hi - 2 * E)) continue;
        let sp = false, sn = false; for (const p of m.walls) { if (p.o !== po || p.view || p.obj || Math.abs(p.c - g.at) > 2 * E) continue; if (Math.abs(p.e0 - L.c) < 1.5 * E && p.e1 > L.c + 1.5 * E) sp = true; else if (Math.abs(p.e1 - L.c) < 1.5 * E && p.e0 < L.c - 1.5 * E) sn = true; else if (p.e0 < L.c - 1.5 * E && p.e1 > L.c + 1.5 * E) sp = sn = true; }
        if (sp === sn) continue; /* soba između: unutarnji zid mora biti s druge strane prostorija od vanjskog – najbliži paralelni */ if (!grp.cand || Math.abs(L.c - g.c) < Math.abs(grp.cand.c - g.c)) grp.cand = { o: L.o, c: Math.round(L.c * 10) / 10, at: Math.round(g.at * 10) / 10 }; } }
    if (grp.int || grp.cand) out.push(grp); }
  return out; }
function jogKey(g) { return g.ax + ':' + Math.round(g.c) + ':' + Math.round(g.at); }
function jogUI() {
  const box = $('tlJog'); if (!box) return; const G = jogGroups(); if (!G.length) { box.innerHTML = ''; return; }
  const sideW = g => g.o === 'V' ? 'okomitog' : 'vodoravnog';
  box.innerHTML = G.map((g, k) => { const D = (g.ext.dt || 0) + (g.int ? g.int.dt || 0 : 0), a = g.ext.dt || 0, b = g.int ? g.int.dt || 0 : 0;
    return '<div class="tl-big" style="background:#f0f9ff;border-color:#93c5fd"><b>🧱 Razlika ' + C.fmt(Math.round(D * 10) / 10, 1) + ' cm na spoju ' + sideW(g) + ' zida</b><p style="margin:4px 0">Sad: vanjski zid ' + C.fmt(Math.round(a * 10) / 10, 1) + ' cm, unutarnji zid ' + C.fmt(Math.round(b * 10) / 10, 1) + ' cm (skok unutarnjeg zida je samo na strani poprečnog zida – u susjednoj prostoriji nema zuba). Kamo ide razlika?</p>' +
      '<div class="tl-actions" style="flex-wrap:wrap"><button class="tl-btn" data-jg="' + k + '" data-r="0">Sve na vanjski</button><button class="tl-btn" data-jg="' + k + '" data-r="0.5">Pola-pola</button><button class="tl-btn" data-jg="' + k + '" data-r="1">Sve na unutarnji</button><button class="tl-btn" data-jg="' + k + '" data-r="x">✎ Upiši cm na unutarnji…</button></div></div>'; }).join('');
  box.querySelectorAll('[data-jg]').forEach(b => b.onclick = () => { const g = G[+b.dataset.jg], D = (g.ext.dt || 0) + (g.int ? g.int.dt || 0 : 0); let r = b.dataset.r;
    if (r === 'x') { const v = prompt('Koliko cm razlike ide na unutarnji zid (ukupno ' + C.fmt(Math.round(D * 10) / 10, 1) + ' cm)?', C.fmt(Math.round(D / 2 * 10) / 10, 1)); if (v == null) return; const x = parseFloat(String(v).replace(',', '.')); if (!(x >= 0)) return; r = D > 0 ? Math.min(1, x / D) : 0.5; } else r = +r;
    W.st.jogShare = W.st.jogShare || {}; let sp = (W.st.wallSplit || []).slice();
    if (!g.int && g.cand && r > 0) { sp.push(Object.assign({}, g.cand, { auto: true, soft: true, user: true })); }
    W.st.wallSplit = sp; try { W.m = C.analyze(W.floor, { splits: sp }); W.m.labels.forEach(l => { const kk = l.ocrKey || l.sig; if (W.st.rec[kk] != null) l.rec = W.st.rec[kk]; }); } catch (e) { }
    const ik = g.int ? jogKey(g.int) : g.cand ? (g.ax + ':' + Math.round(g.cand.c) + ':' + Math.round(g.cand.at)) : null; W.st.jogShare[jogKey(g.ext)] = 1 - r; if (ik) W.st.jogShare[ik] = r;
    W.out = null; persist(); const sc = $('tlPanel').scrollTop; stepResult(); draw(); $('tlPanel').scrollTop = sc; });
}
function bigSplitSig() { const t = W.st; return JSON.stringify([t.labels, t.wallSplit, t.wallT, t.wallView, t.rec && Object.keys(t.rec).length, t.settings && t.settings.uskl]); }
function bigSplitUI() {
  const box = $('tlBig'); if (!box) return; const sig = bigSplitSig();
  if (W.st.bigNo === sig) { box.innerHTML = ''; W.bigP = null; return; }
  if (!W.bigCache || W.bigCache.sig !== sig) { let r = null; try { r = bigSplitCalc(); } catch (e) { } W.bigCache = { sig, r }; }
  const r = W.bigCache.r; W.bigP = null; if (!r) { box.innerHTML = W.bigUndo ? '<div class="tl-big"><b>🧱 Zidovi su prelomljeni</b><div class="tl-actions"><button id="tlBigUndo" class="tl-btn">↩ Vrati kako je bilo</button></div></div>' : ''; bindBig(); return; }
  const side = w => w.exterior ? ({ 'H-1': 'gornji vanjski', 'H1': 'donji vanjski', 'V-1': 'lijevi vanjski', 'V1': 'desni vanjski' }[w.o + (w.outSide || 0)] || 'vanjski') : 'unutarnji';
  W.bigP = r.rows.map((x, n) => ({ w: x.w, pos: x.pos, n: n + 1 }));
  box.innerHTML = '<div class="tl-big"><b>🧱 Prelomiti zidove umjesto mijenjanja prostorija?</b>' +
    '<p>Mjere prostorija uz iste zidove ne slažu se (do <b>' + C.fmt(Math.round(r.before * 10) / 10, 1) + ' cm</b>, ' + r.nB + ' mjera izvan ±' + C.fmt(lim0(), 1) + ' cm). Ako prelomim zidove, fasada ostaje ravna, prostorije ostaju po izmjeri, a mijenja se debljina zida:</p>' +
    '<ul>' + r.rows.map((x, n) => '<li><b>Z' + (n + 1) + '</b> ' + side(x.w) + ' zid: ' + C.fmt(x.t0, 1) + ' → <b>' + C.fmt(x.t1, 1) + ' cm</b> (' + (x.t1 > x.t0 ? '+' : '') + C.fmt(Math.round((x.t1 - x.t0) * 10) / 10, 1) + ')</li>').join('') + '</ul>' +
    (r.nA ? '<p>Nakon prijeloma izvan ±' + C.fmt(lim0(), 1) + ' cm ostaje još <b>' + r.nA + '</b> mjera (najviše ' + C.fmt(Math.round(r.after * 10) / 10, 1) + ' cm) – te mjere provjeri, tamo se zid ne može razumno prelomiti.</p>' : '') + '<p class="tl-note">Oznake Z1, Z2… vidiš na tlocrtu (narančasto). Ako odbiješ, prostorije se smanje/povećaju kao dosad.</p>' +
    '<div class="tl-actions"><button id="tlBigOk" class="tl-btn primary">✓ Prelomi zidove</button><button id="tlBigNo" class="tl-btn">✕ Ne, prilagodi prostorije</button></div></div>';
  bindBig(); draw();
}
function bindBig() {
  if ($('tlBigOk')) $('tlBigOk').onclick = () => { const r = W.bigCache && W.bigCache.r; if (!r) return; W.bigUndo = { wallSplit: (W.st.wallSplit || []).slice(), wallT: Object.assign({}, W.st.wallT), wallView: Object.assign({}, W.st.wallView) };
    W.st.wallSplit = r.sp; W.st.wallT = r.wallT; W.st.wallView = r.wallView; W.m = r.m; W.out = null; W.bigP = null; persist(); stepResult(); draw(); };
  if ($('tlBigNo')) $('tlBigNo').onclick = () => { W.st.bigNo = bigSplitSig(); W.bigP = null; persist(); const sc = $('tlPanel').scrollTop; stepResult(); draw(); $('tlPanel').scrollTop = sc; };
  if ($('tlBigUndo')) $('tlBigUndo').onclick = () => { const u = W.bigUndo; if (!u) return; W.st.wallSplit = u.wallSplit; W.st.wallT = u.wallT; W.st.wallView = u.wallView; W.bigUndo = null; W.st.bigNo = null;
    try { W.m = C.analyze(W.floor, { splits: W.st.wallSplit }); W.m.labels.forEach(l => { const k = l.ocrKey || l.sig; if (W.st.rec[k] != null) l.rec = W.st.rec[k]; }); } catch (e) { } W.out = null; persist(); W.st.bigNo = bigSplitSig(); persist(); stepResult(); draw(); };
}

function go(step) {
  if (step === 3 && !W.forceQ) step = 4; /* v1.99: pitanja su u vođenom mjerenju (📏 Mjeri) – ovdje odmah rezultat */
  if (step >= 3) { autoSplit(); gapSplit(); softSplit(); }
  W.step = step; if ($('tlWallPop')) $('tlWallPop').hidden = true; W.selWall = null;
  $('tlSteps').innerHTML = [[1, 'Postavke'], [2, 'Kote'], [4, 'Rezultat']].map(([k, n], i) => '<span class="' + (k === step || (step === 3 && k === 4) ? 'on' : k < step ? 'done' : '') + '">' + (i + 1) + '. ' + n + '</span>').join('');
  [null, stepSettings, stepLabels, stepQuestions, stepResult][step]();
  draw();
}
function panel(html) { $('tlPanel').innerHTML = html; $('tlPanel').scrollTop = 0; }

/* ---------- 1. postavke ---------- */
function stepSettings() {
  const s = W.st.settings;
  panel('<h3>Debljine zidova i usklađivanje</h3>' +
    '<p class="tl-note">Debljine vrijede kad uz zid nije upisana mjera (npr. „d=25” na sloju Kote).</p>' +
    '<label class="tl-field">Vanjski zidovi (cm)<input id="tlExt" type="number" inputmode="decimal" value="' + s.ext + '"></label>' +
    '<div class="tl-chips" data-for="tlExt">' + [20, 25, 30, 38, 40, 50].map(v => '<button class="tl-chip">' + v + '</button>').join('') + '</div>' +
    '<label class="tl-field">Unutarnji zidovi (cm)<input id="tlInt" type="number" inputmode="decimal" value="' + s.int + '"></label>' +
    '<div class="tl-chips" data-for="tlInt">' + [8, 10, 12, 15, 20, 25].map(v => '<button class="tl-chip">' + v + '</button>').join('') + '</div>' +
    '<label class="tl-field">Najveće usklađivanje mjere (± %)<input id="tlTol" type="number" inputmode="decimal" step="0.1" value="' + s.tol + '"></label>' +
    '<label class="tl-field">Male razlike mjera prebaci u debljinu zida – do (cm)<input id="tlUskl" type="number" inputmode="decimal" step="0.5" value="' + (s.uskl != null ? s.uskl : 3) + '"></label>' +
    '<p class="tl-note">Npr. soba 400 a ispod dvije sobe s pregradom 397: obje ostaju točno po mjerama, a zid se na spoju s pregradom prelomi (razlika u debljini). Fasada ostaje ravna. 0 = isključeno (stari način – mjere se ravnaju).</p>' +
    '<div class="tl-actions"><button id="tlGo" class="tl-btn primary">Analiziraj skicu →</button></div>' +
    '<hr><p class="tl-note">Treba samo podloga? Izvezi skicu kakva jest, bez ravnanja (slojevi Nacrt, Kote, Opisi).</p><button id="tlRaw" class="tl-btn">Samo skica u DXF</button>');
  document.querySelectorAll('.tl-chips').forEach(c => c.querySelectorAll('button').forEach(b => b.onclick = () => { $(c.dataset.for).value = b.textContent; }));
  $('tlRaw').onclick = () => saveDxf(C.sketchDxf(W.floor), '_skica');
  $('tlGo').onclick = () => {
    const n = id => { const v = parseFloat(String($(id).value).replace(',', '.')); return Number.isFinite(v) && v > 0 ? v : null; };
    s.ext = n('tlExt') || 30; s.int = n('tlInt') || 12; s.tol = Math.min(10, n('tlTol') || 1); { const u = parseFloat(String($('tlUskl').value).replace(',', '.')); s.uskl = Number.isFinite(u) && u >= 0 ? Math.min(10, u) : 3; } saveSettings(s);
    try { W.m = C.analyze(W.floor, { splits: W.st.wallSplit }); } catch (e) { alert('Analiza nije uspjela: ' + (e.message || e)); return; }
    W.m.labels.forEach(l => { const k = l.ocrKey || l.sig; if (W.st.rec[k] != null) l.rec = W.st.rec[k]; });
    W.view = null; go(2); runOcr();
  };
}

/* ---------- 2. pregled kota ---------- */
const KINDS = [['auto', 'Auto'], ['mjera', 'Mjera'], ['udaljenost', 'Udaljenost do otvora / stupa / zuba'], ['osirina', 'Širina otvora'], ['ovisina', 'Visina otvora'], ['nsirina', 'Širina niše'], ['ndubina', 'Dubina niše'], ['ssirina', 'Širina stupa'], ['sdubina', 'Dubina stupa'], ['stube', 'Broj visina stubišta'], ['visina', 'Visina prostorije'], ['hgr', 'hgr – donji rub grede od poda'], ['pod', 'Kota poda prostorije'], ['dijagonala', 'Dijagonala prostorije'], ['otvor', 'Otvor š/v'], ['prostorija', 'Mjere prostorije (a×b)'], ['parapet', 'Parapet'], ['debljina', 'Debljina zida'], ['zanemari', 'Zanemari']];
function labelRow(l) {
  const ov = W.st.labels[l.sig] || {}, val = ov.value != null ? ov.value : (l.text != null ? l.text : (l.rec || ''));
  const p = C.parseLabel(val, { cm: ov.value == null && l.cm }); if (p.kind === 'nepoznato' && p.guess > 0 && String(val).trim() !== '' && (ov.value != null || l.src === 'text')) { p.kind = 'mjera'; p.v = p.guess; } /* v2.68: mali upisani broj (3 cm) */
  const ak = C.autoKind(l, p), kind = ov.kind && ov.kind !== 'auto' ? ov.kind : ak;
  const bad = kind === 'nepoznato' || (p.uncertain && !ov.value);
  const orient = ov.orient || 'auto';
  return '<div class="tl-row' + (W.sel === l.id ? ' sel' : '') + (bad ? ' bad' : '') + (kind === 'zanemari' ? ' off' : '') + '" data-id="' + l.id + '">' +
    '<span class="tl-n">' + l.n + '</span>' +
    '<input class="tl-val" inputmode="text" value="' + esc(val) + '" placeholder="' + (l.src === 'ink' && l.rec == null && Ink.ok() ? 'čitam…' : 'upiši') + '">' +
    '<select class="tl-kind">' + KINDS.map(([k, n]) => '<option value="' + k + '"' + ((ov.kind || 'auto') === k ? ' selected' : '') + '>' + (k === 'auto' ? 'Auto: ' + kindName(ak) : n) + '</option>').join('') + '</select>' +
    '<button class="tl-or" title="Smjer mjere">' + (orient === 'H' ? '↔' : orient === 'V' ? '↕' : '⟲') + '</button>' +
    (kind === 'prostorija' ? '<button class="tl-or tl-swap" title="Zamijeni vodoravnu i okomitu mjeru">⇄</button>' : (kind === 'mjera' || kind === 'udaljenost') ? '<button class="tl-or tl-pin" title="Dodijeli dodirom: dodirni dva mjesta na crtežu (zid, rub otvora)"' + (ov.pin ? ' style="background:#17457f;color:#fff"' : '') + '>' + (ov.pin ? '✕📌' : '📌') + '</button>' : '') +
    '<div class="tl-role' + (roleWarn(l, kind) || sizeWarn(l) ? ' warn' : '') + '">' + esc(roleText(l, kind)) + (sizeWarn(l) ? ' · ⚠ ' + esc(sizeWarn(l)) : '') + '</div></div>';
}
/* kako je program shvatio broj */
function isIgnored(l) { return !!(W.st && W.st.decisions && W.st.decisions[l.sig] === 'ignore'); }
function blkW(l, kind) { return !!(l.blkc && !l.pin && (kind === 'mjera' || kind === 'osirina')); } /* v2.65: širina upisana u blok prozora/vrata – pripada svom otvoru, ne zidu */
function roleText(l, kind) {
  if (isIgnored(l)) return '⚠ zanemarena u Pitanjima – dodirni ovaj redak teksta za vraćanje';
  if (blkW(l, kind)) return 'širina otvora (upisana u prozor/vrata)';
  if (kind === 'ssirina' || kind === 'sdubina') return 'stup: ' + (kind === 'ssirina' ? 'širina (vodoravno)' : 'dubina (okomito)');
  if (kind === 'zanemari') return l.chevOnly ? 'strelica (pripada broju)' : 'zanemareno';
  if (kind === 'osirina' || kind === 'ovisina') return 'otvor: ' + (kind === 'osirina' ? 'širina' : 'visina') + (l.role ? ' (uz poprečnu crtu)' : '');
  if (kind === 'parapet') return 'parapet prozora';
  if (kind === 'nisa') return 'niša: širina' + (l.role ? ' (uz poprečnu crtu)' : '');
  if (kind === 'nsirina') return 'niša/zadebljanje: širina (zub u zidu)';
  if (kind === 'ndubina') return 'niša: dubina / zadebljanje: koliko strši';
  if (kind === 'debljina') return l.dlead ? 'debljina zida do kojeg vodi crtica' : 'debljina najbližeg zida (bez crtice do zida)';
  if (kind === 'visina') return 'visina prostorije (upisuje se ispod površine)';
  if (kind === 'hgr') return 'hgr – visina od poda do donjeg ruba grede (visina grede = h − hgr)';
  if (kind === 'dijagonala') return 'dijagonala prostorije – provjera pravog kuta (rezultat u „Za provjeru”)';
  if (kind === 'stube') return l.span && l.span.stair != null ? 'stubište: broj visina' : '⚠ broj visina – nije pronađeno stubište';
  if (kind === 'otvor') return 'otvor širina/visina';
  if (kind === 'prostorija') { const sp = l.span; if (!sp || !sp.room) return '⚠ mjere prostorije – natpis nije unutar prostorije'; return 'prostorija: ↔ ' + C.fmt(sp.h) + ' / ↕ ' + C.fmt(sp.v) + (sp.auto ? (l.roomAsk ? ' – ⚠ nije sigurno, ⇄ za zamjenu' : ' (prema obliku na skici)') : ' (odabrano)'); }
  if (kind !== 'mjera' && kind !== 'udaljenost') return 'nije pročitano – upiši broj';
  if (l.span && l.span.pin) return '📌 dodijeljeno dodirom: ' + (l.span.off ? 'od zida do ruba otvora' : 'od zida do zida' + (l.span.ax === 'X' ? ' ↔' : ' ↕')) + ' (✕ za poništenje)';
  const sp = l.span; let t = l.edim != null ? 'nacrtana kotna crta' : l.leader != null ? 'pokazna crta od ugla' : l.chev ? 'strelice: od zida do zida' : '';
  if (!sp) return (t ? t + ' – ' : '') + '⚠ nije pridružena zidu – gumbom ⟲/↔/↕ desno odredi smjer (vodoravno/okomito) ili odaberi Zanemari';
  if (sp.off) return 'udaljenost od zida do otvora/niše/zuba' + (l.edim != null ? ' (nacrtana kota)' : '');
  if (sp.nlead) return 'od zida do lica zuba/proširenja (daje njegovu dubinu)';
  if (sp.nrel) return 'od ruba otvora do zuba/proširenja';
  if (sp.stair != null) return 'stubište: ' + (sp.part === 'w' ? 'širina kraka' : 'duljina kraka');
  if (sp.col != null) return 'udaljenost stupa od zida' + (l.leader != null ? ' (u smjeru strelice)' : '');
  if (sp.wall) t = 'duljina zida uz koji je napisano' + (sp.wrapLo || sp.wrapHi ? ', do vanjskog ugla' : '');
  else if (!t) t = sp.type === 'vanjska' ? 'vanjska mjera pročelja' : 'od zida do zida';
  if (l.edim != null || l.leader != null) t += (sp.offI < 0 || sp.offJ > 0) ? ', od vanjskog lica/ugla' : '';
  return t + (sp.ax === 'X' ? ' ↔' : ' ↕');
}
/* broj napisan puno većim ili manjim slovima od ostalih (npr. pri drugom zumu) – lakše se krivo pročita ili spoji */
function labelSize(l) { if (l.src !== 'ink' || !l.strokes || !l.strokes.length) return null; const v = l.strokes.map(st => { const b = C.bbox(st); return Math.max(b.w, b.h); }).sort((a, b) => a - b); return v[v.length >> 1]; }
function sizeWarn(l) {
  const m = W.m; if (!m) return ''; if (!m._sizeMed) { const v = m.labels.map(labelSize).filter(x => x > 0).sort((a, b) => a - b); m._sizeMed = v.length >= 4 ? v[v.length >> 1] : -1; }
  const med = m._sizeMed, z = labelSize(l); if (!(med > 0) || !(z > 0)) return '';
  if (z > 3 * med) return 'napisan puno većim brojkama od ostalih – provjeri očitanje'; if (z < 0.33 * med) return 'napisan puno sitnijim brojkama od ostalih – provjeri očitanje'; return '';
}
function roleWarn(l, kind) { return isIgnored(l) || (!blkW(l, kind) && (kind === 'mjera' || kind === 'udaljenost') && !l.span); }
function kindName(k) { return { hgr: 'hgr grede', mjera: 'mjera', otvor: 'otvor š/v', osirina: 'širina otvora', ovisina: 'visina otvora', nisa: 'niša', nsirina: 'širina niše', udaljenost: 'udaljenost do otvora/zuba', ndubina: 'dubina niše', ssirina: 'širina stupa', sdubina: 'dubina stupa', stube: 'broj visina', prostorija: 'mjere prostorije', visina: 'visina prostorije', pod: 'kota poda', dijagonala: 'dijagonala', parapet: 'parapet', debljina: 'debljina', zanemari: 'strelica', nepoznato: '?' }[k] || k; }
function stepLabels() {
  const m = W.m, n = m.labels.length;
  try { W._B = C.buildConstraints(m, W.st); } catch (e) { W._B = null; }
  const dn = W._B ? W._B.notes.filter(x => x.kind === 'debljina') : [];
  const nWalls = m.walls.length, nOps = m.openings.length;
  panel('<h3>Kote (' + n + ')</h3><div id="tlInk" class="tl-note"></div>' +
    '<p class="tl-note">Prepoznato: ' + nWalls + ' zidova, ' + nOps + ' otvora' + (m.segs.some(s => s.stair) ? ', stubište' : '') + '. Dodirni broj na crtežu ili u popisu i provjeri vrijednost. Dodirni zid za debljinu, prijelom (zid sa skokom) ili „linija u pogledu”. Crvene retke treba popraviti. ⟲ = smjer automatski, ↔ vodoravna, ↕ okomita mjera.</p>' +
    (dn.length ? '<p class="tl-ok">✓ ' + dn.map(x => esc(x.text)).join('<br>✓ ') + '</p>' : '') +
    '<div class="tl-list" id="tlList">' + (n ? m.labels.filter(l => !l.syn0).map(labelRow).join('') : '<p>Na sloju Kote nema upisanih mjera. Program će pitati za sve razmake.</p>') + '</div>' +
    '<div class="tl-actions sticky"><button id="tlBack" class="tl-btn">← Postavke</button><button id="tlNextEmpty" class="tl-btn">Sljedeća neriješena</button><button id="tlGo" class="tl-btn primary">Dalje →</button></div>');
  renderStatus();
  const list = $('tlList');
  list.querySelectorAll('.tl-row').forEach(row => {
    const l = W.m.labels[+row.dataset.id], ov = () => (W.st.labels[l.sig] = W.st.labels[l.sig] || {});
    row.querySelector('.tl-val').addEventListener('focus', () => select(l.id, false));
    row.querySelector('.tl-val').addEventListener('change', e => { ov().value = e.target.value.trim(); if (isIgnored(l)) delete W.st.decisions[l.sig]; persist(); refreshRow(l); });
    row.querySelector('.tl-role').addEventListener('click', () => { if (!isIgnored(l)) return; delete W.st.decisions[l.sig]; persist(); refreshRow(l); select(l.id, false); });
    row.querySelector('.tl-val').addEventListener('keydown', e => { if (e.key === 'Enter') { e.target.blur(); nextUnresolved(); } });
    row.querySelector('.tl-kind').addEventListener('change', e => { ov().kind = e.target.value; persist(); refreshRow(l); });
    const sw = row.querySelector('.tl-swap'); if (sw) sw.addEventListener('click', () => { const sp = l.span; const cur = (W.st.roomSwap && W.st.roomSwap[l.sig]) || (sp && sp.mode) || 'ab'; W.st.roomSwap[l.sig] = cur === 'ab' ? 'ba' : 'ab'; persist(); refreshRow(l); select(l.id, false); });
    const pn = row.querySelector('.tl-pin'); if (pn) pn.addEventListener('click', () => { const o = ov(); if (o.pin) { delete o.pin; persist(); refreshRow(l); return; } W.pinMode = { id: l.id, sig: l.sig, pts: [] }; select(l.id, false); pinBanner(); });
    row.querySelector('.tl-or').addEventListener('click', () => { const o = ov(); o.orient = o.orient === 'H' ? 'V' : o.orient === 'V' ? 'auto' : 'H'; persist(); refreshRow(l); select(l.id, false); });
    row.addEventListener('click', e => { if (e.target === row || e.target.classList.contains('tl-n')) select(l.id, false); });
  });
  $('tlBack').onclick = () => go(1); $('tlGo').onclick = () => { W.st.skipAll = false; go(3); };
  $('tlNextEmpty').onclick = nextUnresolved;
}
function pinBanner() { let b = $('tlPinBanner'); const pm = W.pinMode; if (!pm) { if (b) b.remove(); draw(); return; }
  if (!b) { b = document.createElement('div'); b.id = 'tlPinBanner'; b.className = 'tl-pinb'; $('tlWiz').querySelector('.tl-view').appendChild(b); }
  b.innerHTML = '📌 Kota #' + W.m.labels[pm.id].n + ': dodirni ' + (pm.pts.length ? '<b>drugo</b>' : '<b>prvo</b>') + ' mjesto – zid (stranu zida koju mjeriš) ili rub otvora. <button class="tl-btn" id="tlPinX">Odustani</button>';
  $('tlPinX').onclick = () => { W.pinMode = null; pinBanner(); }; draw(); }
function refreshRow(l) { const row = document.querySelector('.tl-row[data-id="' + l.id + '"]'); if (!row) return; try { const tmp = document.createElement('div'); tmp.innerHTML = labelRow(l); if (row.parentNode) row.replaceWith(tmp.firstChild); } catch (e) { } stepLabelsRebind(l); draw(); }
function stepLabelsRebind() { const P = $('tlPanel'), keepP = P.scrollTop, keep = $('tlList').scrollTop; stepLabels(); $('tlList').scrollTop = keep; P.scrollTop = keepP; } /* nakon izmjene kote popis ostaje na istom mjestu */
function select(id, scroll) {
  W.sel = id; document.querySelectorAll('.tl-row').forEach(r => r.classList.toggle('sel', +r.dataset.id === id));
  const row = document.querySelector('.tl-row[data-id="' + id + '"]'); if (row && scroll) { row.scrollIntoView({ block: 'center' }); const i = row.querySelector('.tl-val'); i.focus(); i.select && i.select(); }
  focusOn(W.m.labels[id]); draw();
}
function nextUnresolved() {
  const ls = W.m.labels; const start = W.sel; for (let k = 1; k <= ls.length; k++) {
    const l = ls[(start + k + ls.length) % ls.length]; const row = document.querySelector('.tl-row[data-id="' + l.id + '"]');
    if (row && row.classList.contains('bad')) { select(l.id, true); return; }
  }
  if (ls.length) alert('Sve kote imaju vrijednost.');
}
function renderStatus() {
  const el = $('tlInk'); if (!el) return;
  if (!Ink.ok()) { const miss = W.m ? W.m.labels.filter(l => l.src === 'ink' && l.rec == null && !((W.st.labels[l.sig] || {}).value != null)).length : 0; el.innerHTML = miss ? '⚠ Na kompjuteru nema čitanja rukopisa – ' + miss + ' kota nije pročitano na tabletu, upiši ih. (Na tabletu: ⋯ → 💻 Za kompjuter pročita sve.)' : '✓ Kote su pročitane na tabletu — provjeri vrijednosti.'; return; }
  const s = Ink.status;
  el.innerHTML = s.startsWith('err') ? '⚠ Prepoznavanje rukopisa: ' + esc(s.slice(4)) + ' (za prvo preuzimanje modela treba internet)' : s === 'downloading' ? '⏳ Preuzimam model za rukopis (samo prvi put, treba internet)…' : W.ocrBusy ? '⏳ Čitam rukom pisane brojeve… (' + W.ocrDone + '/' + W.ocrTotal + ')' : '✓ Rukopis pročitan — provjeri vrijednosti.';
}
async function runOcr() {
  if (!Ink.ok() && W.m && !W.ocrBusy) { let n = 0; for (const l of W.m.labels) if (l.src === 'ink' && l.rec == null && isCrossedZero(l.rawStrokes)) { l.rec = 'Ø'; W.st.rec[l.ocrKey || l.sig] = 'Ø'; n++; } if (n) persist(); } /* kompjuter: Ø se prepozna i bez čitača rukopisa */
  if (!Ink.ok() || W.ocrBusy) return; const todo = W.m.labels.filter(l => l.src === 'ink' && l.rec == null && l.rawStrokes && l.rawStrokes.length);
  if (!todo.length) return; W.ocrBusy = true; W.ocrDone = 0; W.ocrTotal = todo.length; renderStatus();
  for (const l of todo) {
    if (!W.open || !W.m || !W.m.labels.includes(l)) break;
    l.rec = await recognizeLabel(l); W.st.rec[l.ocrKey || l.sig] = l.rec; W.ocrDone++;
    if (W.step === 2) { const row = document.querySelector('.tl-row[data-id="' + l.id + '"]'); const ov = W.st.labels[l.sig]; if (row && !(ov && ov.value != null)) refreshRow(l); renderStatus(); }
  }
  W.ocrBusy = false; persist(); renderStatus(); if (W.step === 2) draw();
}

/* ---------- 3. pitanja ---------- */
function stepQuestions() {
  let q, forced = W.forceQ; W.forceQ = null; try { q = forced || C.nextQuestion(W.m, W.st); } catch (e) { alert('Greška pri izračunu: ' + e.message); go(2); return; }
  W.q = q;
  if (!q) { go(4); return; }
  if (W.st.skipAll) { autoAnswer(q); persist(); setTimeout(stepQuestions, 0); return; }
  let h = '<h3>Pitanje</h3><p class="tl-q">' + esc(q.text) + '</p><p class="tl-note">' + esc(q.hint) + '</p>';
  if (q.type === 'gap') {
    h += '<label class="tl-field">Razmak (cm)<input id="tlAns" type="number" inputmode="decimal" min="0" placeholder="' + q.est + '"></label>' +
      '<div class="tl-actions"><button id="tlSame" class="tl-btn">Ista linija (0) — to je jedan zid</button></div>' +
      '<div class="tl-actions"><button id="tlOk" class="tl-btn primary">Potvrdi</button><button id="tlSkip" class="tl-btn">Preskoči (procjena ' + C.fmt(q.est) + ')</button></div>';
  } else if (q.type === 'viol' && q.chain) {
    const lb = q.label; h += '<p class="tl-note">' + C.fmt(lb.va) + ' + ' + C.fmt(lb.w) + ' + ' + C.fmt(lb.vb) + ' = ' + C.fmt(q.value) + ' cm, a prema ukupnim mjerama treba biti ' + C.fmt(q.should, 1) + ' cm.</p>' +
      '<label class="tl-field">Udaljenost #' + lb.n + ' (cm)<input id="tlChA" type="number" inputmode="decimal" value="' + lb.va + '"></label>' +
      '<label class="tl-field">Udaljenost #' + lb.n2 + ' (cm)<input id="tlChB" type="number" inputmode="decimal" value="' + lb.vb + '"></label><div class="tl-note" id="tlChSum"></div>' +
      '<div class="tl-actions"><button id="tlChOk" class="tl-btn primary">Spremi ispravak</button><button id="tlAcc" class="tl-btn">Prihvati odstupanje</button><button id="tlIgn" class="tl-btn">Zanemari zbroj</button></div>';
  } else if (q.type === 'viol') {
    h += '<label class="tl-field">Ispravna vrijednost (cm)<input id="tlAns" type="number" inputmode="decimal" value="' + q.value + '"></label>' +
      '<div class="tl-actions"><button id="tlOk" class="tl-btn primary">Spremi ispravak</button><button id="tlIgn" class="tl-btn">Zanemari ovu kotu</button><button id="tlAcc" class="tl-btn">Prihvati odstupanje</button></div>';
  } else if (q.type === 'nd') {
    h += '<label class="tl-field">Dubina niše (cm)<input id="tlAns" type="number" inputmode="decimal" placeholder="' + q.est + '"></label>' +
      '<div class="tl-chips" data-for="tlAns">' + [5, 10, 15, 20, 25, 30].map(v => '<button class="tl-chip">' + v + '</button>').join('') + '</div>' +
      '<div class="tl-actions"><button id="tlOk" class="tl-btn primary">Potvrdi</button><button id="tlSkip" class="tl-btn">Preskoči (procjena ' + C.fmt(q.est) + ')</button></div>';
  } else if (q.type === 'st') {
    const S = q.stair, ov = W.st.stairs[q.key] || {}, dirs = S.o === 'H' ? [[-1, '↑ prema gore'], [1, '↓ prema dolje']] : [[-1, '← ulijevo'], [1, '→ udesno']], d0 = ov.dir || S.dir || 0;
    const fld = (id, lab, v, ph) => '<label class="tl-field">' + lab + '<input id="' + id + '" type="number" inputmode="decimal" value="' + (v || '') + '" placeholder="' + (ph || '') + '"></label>';
    h += fld('tlStN', 'Broj visina (stepenica)', S.n || ov.n, 'npr. ' + q.est.n) + fld('tlStL', 'Duljina kraka (cm) – od prve do zadnje visine', S.L || ov.L, 'procjena ' + q.est.L) + fld('tlStW', 'Širina kraka (cm)', S.w || ov.w, 'procjena ' + q.est.w) +
      fld('tlStP', 'Podest / polupodest ispred kraka (cm) – neobavezno', S.podest || ov.podest, '') + fld('tlStH', 'Visina etaže (cm) – neobavezno', S.H || ov.H, '') +
      '<div class="tl-note" id="tlStInfo"></div><div class="tl-field">Smjer penjanja</div><div class="tl-chips" id="tlStDir">' + dirs.map(([k, n]) => '<button class="tl-chip' + (k === d0 ? ' on' : '') + '" data-d="' + k + '">' + n + '</button>').join('') + '</div>' +
      '<div class="tl-actions"><button id="tlStOk" class="tl-btn primary">Potvrdi</button>' + (forced ? '<button id="tlStCancel" class="tl-btn">Odustani</button>' : '<button id="tlSkip" class="tl-btn">Preskoči (procjena iz skice)</button>') + '</div>';
  } else if (q.type === 'rd') {
    h += '<div class="tl-actions"><button id="tlRdAB" class="tl-btn primary">↔ ' + C.fmt(q.a) + ' &nbsp;/&nbsp; ↕ ' + C.fmt(q.b) + '</button><button id="tlRdBA" class="tl-btn primary">↔ ' + C.fmt(q.b) + ' &nbsp;/&nbsp; ↕ ' + C.fmt(q.a) + '</button></div>';
  } else if (q.type === 'od') {
    h += '<div class="tl-actions"><button id="tlOdA" class="tl-btn">Točna je ' + C.fmt(q.a) + '</button><button id="tlOdB" class="tl-btn">Točna je ' + C.fmt(q.b) + '</button></div><div class="tl-actions"><button id="tlOdAvg" class="tl-btn">Uzmi prosjek (' + C.fmt((q.a + q.b) / 2, 1) + ')</button><button id="tlBack2" class="tl-btn">Ispravi u Kotama</button></div>';
  } else if (q.type === 'nk') {
    h += '<div class="tl-actions"><button id="tlNisa" class="tl-btn' + (q.nis.kind === 'nisa' ? ' primary' : '') + '">Niša (udubljenje)</button><button id="tlZad" class="tl-btn' + (q.nis.kind === 'zadebljanje' ? ' primary' : '') + '">Zadebljanje (strši van)</button></div>';
  } else if (q.type === 'ow') {
    const t = (W.st.openings[q.key] || {}).type || q.op.type;
    h += '<div class="tl-chips" id="tlType">' + [['vrata', 'Vrata'], ['prozor', 'Prozor'], ['prolaz', 'Prolaz bez vrata']].map(([k, n]) => '<button class="tl-chip' + (k === t ? ' on' : '') + '" data-t="' + k + '">' + n + '</button>').join('') + '</div>' +
      '<label class="tl-field">Širina otvora (cm)<input id="tlAns" type="number" inputmode="decimal" placeholder="' + q.est + '"></label>' +
      '<div class="tl-chips" data-for="tlAns">' + [70, 80, 90, 100, 120, 250].map(v => '<button class="tl-chip">' + v + '</button>').join('') + '</div>' +
      '<div class="tl-actions"><button id="tlOk" class="tl-btn primary">Potvrdi</button><button id="tlSkip" class="tl-btn">Preskoči (procjena ' + C.fmt(q.est) + ')</button></div>';
  }
  h += '<hr><div class="tl-actions"><button id="tlBack" class="tl-btn">← Kote i zidovi</button><button id="tlAll" class="tl-btn">Preskoči sva preostala pitanja</button></div>';
  panel(h);
  const ans = () => { const v = parseFloat(String(($('tlAns') || {}).value || '').replace(',', '.')); return Number.isFinite(v) && (v > 0 || (v === 0 && q.type === 'gap')) ? v : null; };
  document.querySelectorAll('.tl-chips[data-for]').forEach(c => c.querySelectorAll('button').forEach(b => b.onclick = () => { $(c.dataset.for).value = b.textContent; }));
  if ($('tlType')) $('tlType').querySelectorAll('button').forEach(b => b.onclick = () => { (W.st.openings[q.key] = W.st.openings[q.key] || {}).type = b.dataset.t; $('tlType').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); persist(); draw(); });
  const next = () => { persist(); stepQuestions(); draw(); };
  if ($('tlStOk')) {
    let dsel = +((document.querySelector('#tlStDir .on') || {}).dataset || {}).d || 0;
    const num2 = id => { const v = parseFloat(String($(id).value || '').replace(',', '.')); return Number.isFinite(v) && v > 0 ? v : null; };
    const info = () => { const n = num2('tlStN'), L = num2('tlStL'), H = num2('tlStH'); $('tlStInfo').textContent = n > 1 && L ? 'Gazište: ' + C.fmt(L / (n - 1), 1) + ' cm (' + (n - 1) + ' gazišta)' + (H ? ', visina stepenice ' + C.fmt(H / n, 1) + ' cm' : '') : ''; };
    ['tlStN', 'tlStL', 'tlStH'].forEach(id => $(id).addEventListener('input', info)); info();
    $('tlStDir').querySelectorAll('button').forEach(b => b.onclick = () => { dsel = +b.dataset.d; $('tlStDir').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); });
    $('tlStOk').onclick = () => { const n = num2('tlStN'), L = num2('tlStL'); if (!(n > 1)) { $('tlStN').focus(); return; } if (!L) { $('tlStL').focus(); return; } if (!dsel) { $('tlStDir').scrollIntoView({ block: 'center' }); alert('Odaberi smjer penjanja.'); return; }
      W.st.stairs[q.key] = { n: Math.round(n), L, w: num2('tlStW'), podest: num2('tlStP'), H: num2('tlStH'), dir: dsel }; W.out = null; next(); };
    if ($('tlStCancel')) $('tlStCancel').onclick = () => next();
  }
  for (const [id, v] of [['tlOdA', 'a'], ['tlOdB', 'b'], ['tlOdAvg', 'avg']]) if ($(id)) $(id).onclick = () => { W.st.offPick[q.key] = v; next(); };
  if ($('tlRdAB')) $('tlRdAB').onclick = () => { W.st.roomSwap[q.key] = 'ab'; next(); };
  if ($('tlRdBA')) $('tlRdBA').onclick = () => { W.st.roomSwap[q.key] = 'ba'; next(); };
  if ($('tlNisa')) $('tlNisa').onclick = () => { (W.st.nicheKind = W.st.nicheKind || {})[q.key] = 'nisa'; next(); };
  if ($('tlZad')) $('tlZad').onclick = () => { (W.st.nicheKind = W.st.nicheKind || {})[q.key] = 'zadebljanje'; next(); };
  if ($('tlOk')) $('tlOk').onclick = () => {
    const v = ans(); if (v == null) { $('tlAns').focus(); return; }
    if (q.type === 'gap') W.st.answers[q.key] = v === 0 ? { ax: q.ax, si: q.si, sj: q.sj, value: 0, same: true } : { ax: q.ax, si: q.si, sj: q.sj, value: v };
    else if (q.type === 'viol') { (W.st.labels[q.key] = W.st.labels[q.key] || {}).value = String(v); delete W.st.decisions[q.key]; if (Math.abs(v - q.value) < 1e-9) W.st.decisions[q.key] = 'accept'; }
    else if (q.type === 'ow') { const o = W.st.openings[q.key] = W.st.openings[q.key] || {}; o.w = v; delete o.est; }
    else if (q.type === 'nd') W.st.niches[q.key] = { d: v };
    next();
  };
  if ($('tlBack2')) $('tlBack2').onclick = () => go(2);
  if ($('tlChOk')) { const lb = q.label, rd = id => parseFloat(String($(id).value || '').replace(',', '.'));
    const sum = () => { const a = rd('tlChA'), b = rd('tlChB'); $('tlChSum').textContent = Number.isFinite(a) && Number.isFinite(b) ? 'Zbroj: ' + C.fmt(a + lb.w + b, 1) + ' cm (treba ' + C.fmt(q.should, 1) + ')' : ''; };
    ['tlChA', 'tlChB'].forEach(id => $(id).addEventListener('input', sum)); sum();
    $('tlChOk').onclick = () => { const a = rd('tlChA'), b = rd('tlChB'); if (!(a >= 0) || !(b >= 0)) return; (W.st.labels[lb.sigA] = W.st.labels[lb.sigA] || {}).value = String(a); (W.st.labels[lb.sigB] = W.st.labels[lb.sigB] || {}).value = String(b); next(); }; }
  if ($('tlSame')) $('tlSame').onclick = () => { W.st.answers[q.key] = { ax: q.ax, si: q.si, sj: q.sj, value: 0, same: true }; next(); };
  if ($('tlSkip')) $('tlSkip').onclick = () => { autoAnswer(q); next(); };
  if ($('tlIgn')) $('tlIgn').onclick = () => { W.st.decisions[q.key] = 'ignore'; next(); };
  if ($('tlAcc')) $('tlAcc').onclick = () => { W.st.decisions[q.key] = 'accept'; next(); };
  $('tlBack').onclick = () => go(2);
  $('tlAll').onclick = () => { if (!confirm('Za sve preostale razmake i otvore uzeti procjenu iz skice? Kote malo izvan tolerancije bit će prihvaćene, a one koje jako odstupaju (više od 10 %) zanemarene. Sve će biti označeno na sloju PROVJERA.')) return; W.st.skipAll = true; next(); };
  if ($('tlAns')) setTimeout(() => $('tlAns').focus(), 50);
  focusQuestion(q);
}
const EST_VER = '1.16'; // procjene starijih verzija skice se ne prenose (osi su se možda pomaknule)
function dropOldEstimates(st) {
  for (const k of ['answers', 'openings', 'niches', 'stairs']) { const o = st[k] || {}; for (const key of Object.keys(o)) { const v = o[key]; if (v && v.est && v.ver !== EST_VER) { if (k === 'openings' && v.type) { delete v.w; delete v.est; } else delete o[key]; } } }
}
function autoAnswer(q) {
  if (q.type === 'gap') W.st.answers[q.key] = { ax: q.ax, si: q.si, sj: q.sj, value: q.est, est: true, ver: EST_VER };
  else if (q.type === 'viol') W.st.decisions[q.key] = Math.abs(q.rel) > 10 ? 'ignore' : 'accept';
  else if (q.type === 'ow') { const o = W.st.openings[q.key] = W.st.openings[q.key] || {}; o.w = q.est; o.est = true; o.ver = EST_VER; }
  else if (q.type === 'nd') W.st.niches[q.key] = { d: q.est, est: true, ver: EST_VER };
  else if (q.type === 'nk') (W.st.nicheKind = W.st.nicheKind || {})[q.key] = q.nis.kind;
  else if (q.type === 'od') W.st.offPick[q.key] = 'avg';
  else if (q.type === 'rd') W.st.roomSwap[q.key] = (q.label.span && q.label.span.mode) || 'ab';
  else if (q.type === 'st') W.st.stairs[q.key] = { n: q.est.n, L: q.est.L, w: q.est.w, dir: q.stair.dir || 1, est: true, ver: EST_VER };
}

/* ---------- 4. rezultat ---------- */
function stepResult() {
  try { W.out = C.build(W.m, W.st); } catch (e) { alert('Izrada tlocrta nije uspjela: ' + (e.message || e)); go(2); return; }
  const r = W.out.report, adj = r.adjusted.filter(a => !a.accepted);
  W.view = null;
  let h = (W.flow && window.IzmjeraNacrti ? '<div style="margin:0 0 10px"><button id="tlFlowDone" class="tl-btn primary" style="width:100%;font-size:17px;padding:12px">✓ Tlocrt gotov – ' + esc(IzmjeraNacrti.nextLabel()) + '</button></div>' : '') + '<h3>Tlocrt je spreman</h3>' +
    '<p>Korištenih kota: <b>' + r.nCons + '</b><br>Usklađeno: <b>' + adj.length + '</b> kota, najviše <b>' + C.fmt(r.maxAdj, 1) + ' %</b> (dopušteno ±' + C.fmt(W.st.settings.tol, 1) + ' %)</p>';
  const notes = [].concat(r.accepted, r.estimates, r.notes);
  if (adj.length) h += '<details><summary>Usklađene mjere</summary><ul>' + adj.map(a => '<li>#' + a.n + ': ' + C.fmt(a.value) + ' → ' + C.fmt(a.got, 1) + ' (' + C.fmtPct(a.rel) + ')</li>').join('') + '</ul></details>';
  if (notes.length) h += '<details open><summary>Za provjeru (' + notes.length + ')</summary><ul>' + notes.map(n => '<li>' + esc(n) + '</li>').join('') + '</ul></details>';
  h += '<p class="tl-note">U DXF-u: slojevi ' + C.LAYERS.map(l => l[0]).join(', ') + '. SKICA je isključena (uključi je za usporedbu). Mjere su u centimetrima.</p>' +
    '<div class="tl-actions"><button id="tlDxf" class="tl-btn primary">⬇ Izvezi DXF</button><button id="tlPdf" class="tl-btn primary">⬇ Izvezi PDF</button></div>' +
    pdfSettingsHtml() + geoHtml() +
    '<div class="tl-actions"><button id="tlBack" class="tl-btn">← Kote i zidovi</button></div>' +
    (window.IzmjeraEnergija && (IzmjeraEnergija.isEnerg() || IzmjeraEnergija.isLegal()) ? '<div class="tl-actions"><button class="tl-btn primary" id="tlEnerg">' + IzmjeraEnergija.wizTitle() + '</button></div>' : '') +
    ((W.m.stairs || []).length ? '<p class="tl-note">🪜 Stubište nacrtano rukom: u 📏 Mjeri ga zamijeni blokom (jedan dodir) – tada su mjere i položaj točni.</p>' : '');
  { let q0 = null; try { q0 = C.nextQuestion(W.m, W.st); } catch (e) { } if (q0) h = '<div style="background:#fff7ed;border:1px solid #fdba74;border-radius:10px;padding:10px;margin-bottom:10px"><b>⚠ Nisu izmjerene sve mjere</b><br><span style="font-size:14px">Npr.: ' + esc(q0.text || '') + ' – što nedostaje, uzeto je iz skice.</span><div class="tl-actions"><button id="tlMjeri" class="tl-btn primary">📏 Otvori Mjeri</button></div></div>' + h; }
  h = '<div id="tlBig"><p class="tl-note">Provjeravam zidove…</p></div><div id="tlJog"></div>' + h;
  panel(h); setTimeout(bigSplitUI, 30); setTimeout(jogUI, 40);
  document.querySelectorAll('[data-stair]').forEach(b => b.onclick = () => editStair(b.dataset.stair));
  if ($('tlEnerg')) $('tlEnerg').onclick = () => { persist(); close(); IzmjeraEnergija.open(); };
  $('tlDxf').onclick = () => saveDxf(C.toDxf(W.out), '_tlocrt');
  if ($('tlFlowDone')) $('tlFlowDone').onclick = () => { persist(); IzmjeraNacrti.tlDone(); };
  $('tlPdf').onclick = () => { try { exportPlanPdf(W.out); } catch (e) { alert('Izvoz PDF-a nije uspio: ' + (e.message || e)); } };
  bindPdfSettings(); bindGeo();
  $('tlBack').onclick = () => go(2);
  if ($('tlMjeri')) $('tlMjeri').onclick = () => { persist(); close(); setTimeout(() => { const b = document.getElementById('terenMjeri'); if (b) b.click(); }, 200); };
}
/* ---------- v2.58: geodetska podloga – vanjske mjere pročelja, prilagodba po izboru ---------- */
function geoHtml() {
  const g = W.st.geo || {}, F = C.facades ? C.facades(W.m, W.st, W.out) : []; W.geoF = F; if (!F.length) return '';
  let base = {}; if (g.on) { try { const st2 = Object.assign({}, W.st, { geo: Object.assign({}, g, { on: false }) }), o2 = C.build(W.m, st2); for (const f of C.facades(W.m, st2, o2)) base[f.key] = f.len; } catch (e) { } } else for (const f of F) base[f.key] = f.len;
  const v = g.v || {}, has = Object.keys(v).some(k => +v[k] > 0), fmt1 = x => C.fmt(Math.round(x * 10) / 10, 1);
  let mx = 0; const rows = F.map((f, i) => { const gv = +v[f.key], d = gv > 0 ? gv - base[f.key] : null; if (d != null) mx = Math.max(mx, Math.abs(d)); return '<tr><td><b>G' + (i + 1) + '</b> ' + esc(f.name) + '</td><td style="text-align:right">' + fmt1(base[f.key]) + '</td><td><input data-geo="' + esc(f.key) + '" type="text" inputmode="decimal" value="' + (gv > 0 ? String(gv).replace('.', ',') : '') + '" placeholder="cm" style="width:74px"></td><td style="text-align:right;font-weight:700;color:' + (d == null ? '#94a3b8' : Math.abs(d) <= 2 ? '#15803d' : '#b91c1c') + '">' + (d == null ? '–' : (d > 0 ? '+' : '') + fmt1(d)) + '</td>' + (g.on ? '<td style="text-align:right;color:#0e7490;font-weight:700">' + fmt1(f.len) + '</td>' : '') + '</tr>'; }).join('');
  return '<details class="tl-pdfset"' + (has || g.open ? ' open' : '') + '><summary>📐 Geodetska podloga (nije obavezno)</summary>' +
    '<p class="tl-note">Upiši vanjske mjere pročelja s geodetske podloge (cm). Oznake G1, G2… vidiš na tlocrtu. Nacrt se mijenja tek kad stisneš „Prilagodi”.</p>' +
    '<table style="width:100%;font-size:13px;border-collapse:collapse"><tr><th style="text-align:left">Pročelje</th><th style="text-align:right">Nacrt</th><th>Geodet</th><th style="text-align:right">Razlika</th>' + (g.on ? '<th style="text-align:right">Sad</th>' : '') + '</tr>' + rows + '</table>' +
    (has ? '<p class="tl-note">Najveća razlika: <b>' + fmt1(mx) + ' cm</b>.' + (g.on ? ' <b style="color:#15803d">Nacrt je prilagođen geodetskoj podlozi</b> – razlika je raspoređena na unutarnje mjere (vidi „Usklađene mjere”).' : ' Nacrt je ostao kako si ga nacrtao.') + '</p>' : '') +
    '<div class="tl-actions"><button id="tlGeoOn" class="tl-btn' + (g.on ? ' primary' : '') + '"' + (has ? '' : ' disabled') + '>✓ Prilagodi nacrt</button><button id="tlGeoOff" class="tl-btn' + (!g.on ? ' primary' : '') + '">Ostavi kako sam nacrtao</button></div></details>';
}
function bindGeo() {
  const g = () => (W.st.geo = W.st.geo || {});
  document.querySelectorAll('[data-geo]').forEach(inp => inp.onchange = () => { const G = g(); G.v = G.v || {}; const n = parseFloat(String(inp.value).replace(',', '.')); if (n > 0) G.v[inp.dataset.geo] = n; else delete G.v[inp.dataset.geo]; G.open = true; persist(); const sc = $('tlPanel').scrollTop; stepResult(); draw(); $('tlPanel').scrollTop = sc; });
  if ($('tlGeoOn')) $('tlGeoOn').onclick = () => { g().on = true; g().open = true; persist(); const sc = $('tlPanel').scrollTop; stepResult(); draw(); $('tlPanel').scrollTop = sc; };
  if ($('tlGeoOff')) $('tlGeoOff').onclick = () => { g().on = false; g().open = true; persist(); const sc = $('tlPanel').scrollTop; stepResult(); draw(); $('tlPanel').scrollTop = sc; };
  const d = document.querySelector('.tl-pdfset summary'); }
function saveDxf(text, suffix) {
  const name = ((W.projectName || 'izmjera') + '_' + (W.floor.name || 'etaza') + suffix).replace(/[^a-z0-9čćžšđ_-]/gi, '_') + '.dxf';
  if (window.IzmjeraSpremi && IzmjeraSpremi.autoText(name, 'application/octet-stream', text)) return;
  if (window.AndroidApp && window.AndroidApp.exportText) { window.AndroidApp.exportText(name, text); return; }
  const url = URL.createObjectURL(new Blob([text], { type: 'application/dxf' })), a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------- PDF tlocrta: A4, mjerilo, zaglavlje s logom ---------- */
function pdfSettingsHtml() {
  const P = window.IzmjeraPdf; if (!P) return ''; const s = P.settings();
  return '<details class="tl-pdfset"><summary>Zaglavlje PDF-a (logo, tvrtka)</summary>' +
    '<div class="tl-logo">' + (s.logo ? '<img id="tlLogoImg" src="' + s.logo + '" alt="logo">' : '<span class="tl-note">Logo nije odabran.</span>') + '</div>' +
    '<div class="tl-actions"><label class="tl-btn tl-file">Odaberi logo…<input id="tlLogoFile" type="file" accept="image/*" hidden></label>' + (s.logo ? '<button id="tlLogoDel" class="tl-btn">Ukloni logo</button>' : '') + '</div>' +
    '<label class="tl-field">Sjever na tlocrtu (° od „gore”, u smjeru kazaljke; prazno = bez strelice)<input id="tlNorth" type="number" inputmode="decimal" value="' + (W.st && W.st.north != null ? W.st.north : '') + '" placeholder="npr. 0 ili 35"></label>' +
    '<label class="tl-field">Tvrtka / izradio (podnožje)<input id="tlFirma" type="text" value="' + esc(s.firma) + '" placeholder="npr. Geodetski ured …"></label>' +
    '<p class="tl-note">Vrijedi i za PDF skice (gumbi PDF u alatnoj traci).</p></details>';
}
function bindPdfSettings() {
  const P = window.IzmjeraPdf; if (!P || !$('tlFirma')) return;
  $('tlFirma').addEventListener('change', e => P.setFirma(e.target.value.trim()));
  $('tlNorth').addEventListener('change', e => { const v = parseFloat(String(e.target.value).replace(',', '.')); W.st.north = Number.isFinite(v) ? ((v % 360) + 360) % 360 : null; persist(); });
  $('tlLogoFile').addEventListener('change', async e => { const fl = e.target.files && e.target.files[0]; if (!fl) return; try { const d = await P.imageToJpeg(fl); if (!P.setLogo(d)) alert('Logo nije spremljen (premalo memorije).'); } catch (er) { alert(er.message || er); } refreshPdfSettings(); });
  if ($('tlLogoDel')) $('tlLogoDel').onclick = () => { P.setLogo(null); refreshPdfSettings(); };
}
function refreshPdfSettings() { const d = document.querySelector('.tl-pdfset'); if (!d) return; const tmp = document.createElement('div'); tmp.innerHTML = pdfSettingsHtml(); const n = tmp.firstChild; n.open = true; d.replaceWith(n); bindPdfSettings(); }
function fmtM(v) { return String(v).replace('.', ','); }
function exportPlanPdf(out, opt) {
  opt = opt || {}; const PN = opt.projectName || W.projectName, FN = opt.floorName != null ? opt.floorName : (W.floor && W.floor.name), NO = opt.north !== undefined ? opt.north : (W.st && W.st.north);
  const P = window.IzmjeraPdf; if (!P) throw Error('Nedostaje izmjera-pdf.js');
  const f = P.f, set = P.settings(), doc = new P.Doc();
  const L = { zid: doc.layer('Zidovi'), otv: doc.layer('Otvori'), kote: doc.layer('Kote'), opis: doc.layer('Opisi'), stub: doc.layer('Stubište'), ost: doc.layer('Ostalo'), nad: doc.layer('Nadvoji') };
  const grp = { ZIDOVI_NOSIVI: 'zid', ZIDOVI_PREGRADNI: 'zid', DIMNJAK: 'zid', STUPOVI: 'zid', OTVORI_VRATA: 'otv', OTVORI_PROZORI: 'otv', GARAZNA_VRATA: 'nad', KOTE: 'kote', OPISI: 'opis', STUBISTE: 'stub', STUBISTE_CRTKANO: 'stub', POGLED: 'ost', OSTALO: 'ost', NADVOJ: 'nad', KROVNI_PROZOR: 'nad', OTVOR_PLOCA: 'nad', TERASA: 'nad', GREDE: 'nad', PRAG: 'ost' };
  const style = { zid: '0 0 0 RG 0.7 w', otv: '0.05 0.05 0.05 RG 0.35 w', kote: '0.12 0.25 0.62 RG 0.25 w', opis: '0 0 0 RG 0.3 w', stub: '0 0 0 RG 0.3 w', ost: '0.45 0.45 0.45 RG 0.3 w', nad: '0.05 0.05 0.05 RG 0.3 w [2.5 1.5] 0 d' };
  const tcol = { zid: '0 g', otv: '0 g', kote: '0.12 0.25 0.62 rg', opis: '0 g', stub: '0 g', ost: '0.4 g' };
  // granice crteža (cm, y prema dolje)
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; const ext = p => { if (!p || !Number.isFinite(p.x)) return; x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); };
  out.lines.forEach(l => { if (grp[l.layer]) { ext(l.a); ext(l.b); } }); (out.dims || []).forEach(d => { d.lines.forEach(l => { ext(l.a); ext(l.b); }); d.texts.forEach(ext); });
  if (!Number.isFinite(x0)) throw Error('Tlocrt je prazan.');
  const mw = x1 - x0 + 40, mh = y1 - y0 + 40, cmPt = 72 / 2.54; // 1 cm papira u točkama
  // A4 uspravno ili položeno, najveće standardno mjerilo koje stane
  let best = null;
  for (const [W, H] of [[595.276, 841.89], [841.89, 595.276]]) { const aw = W - 56 - 8, ah = H - 56 - 44 - 22 - 14;
    for (const sc of [20, 25, 50, 75, 100, 150, 200, 250, 500]) { const k = cmPt / sc; if (mw * k <= aw && mh * k <= ah) { if (!best || sc < best.sc) best = { W, H, sc, k }; break; } } }
  if (!best) { const W = mw > mh ? 841.89 : 595.276, H = mw > mh ? 595.276 : 841.89; best = { W, H, sc: 0, k: Math.min((W - 64) / mw, (H - 136) / mh) }; }
  const { W: PW, H: PH, k } = best, logo = set.logo ? doc.jpeg(set.logo) : null;
  const hf = P.headerFooter(doc, PW, PH, { logoImg: logo, project: PN || 'Izmjera', floor: FN || '', title: 'Tlocrt' + (best.sc ? '  ·  M 1:' + best.sc : '  ·  nije u mjerilu'), firma: set.firma, date: P.today(), pageNo: 1, pageCount: 1 });
  const cxp = (hf.left + hf.right) / 2, cyp = (hf.top + hf.bottom) / 2, mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  const X = x => cxp + (x - mx) * k, Y = y => cyp - (y - my) * k;
  let c = hf.content + 'q 1 J 1 j\n';
  // ispuna zidova (rešetka iz izrade tlocrta)
  const g = out.grid; if (g) { c += '/OC ' + L.zid + ' BDC 0.82 g\n'; for (let i = 0; i < g.nx; i++) for (let j = 0; j < g.ny; j++) { if (!g.at(i, j)) continue; c += f(X(g.xs[i])) + ' ' + f(Y(g.ys[j + 1])) + ' ' + f((g.xs[i + 1] - g.xs[i]) * k) + ' ' + f((g.ys[j + 1] - g.ys[j]) * k) + ' re\n'; } c += 'f EMC\n'; }
  const by = {}; const put = (key, s) => { (by[key] = by[key] || []).push(s); };
  for (const l of out.lines) { const G = grp[l.layer]; if (!G) continue; put(G, f(X(l.a.x)) + ' ' + f(Y(l.a.y)) + ' m ' + f(X(l.b.x)) + ' ' + f(Y(l.b.y)) + ' l S'); }
  for (const a of out.arcs) { const G = grp[a.layer]; if (!G) continue; let s0 = Math.atan2(a.from.y - a.c.y, a.from.x - a.c.x), e0 = Math.atan2(a.to.y - a.c.y, a.to.x - a.c.x), d = e0 - s0; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    let s1 = ''; for (let i = 0; i <= 24; i++) { const t = s0 + d * i / 24, px = a.c.x + a.r * Math.cos(t), py = a.c.y + a.r * Math.sin(t); s1 += f(X(px)) + ' ' + f(Y(py)) + (i ? ' l ' : ' m '); } put(G, s1 + 'S'); }
  for (const ci of out.circles) { const G = grp[ci.layer]; if (!G) continue; let s1 = ''; for (let i = 0; i <= 32; i++) { const t = 2 * Math.PI * i / 32; s1 += f(X(ci.c.x + ci.r * Math.cos(t))) + ' ' + f(Y(ci.c.y + ci.r * Math.sin(t))) + (i ? ' l ' : ' m '); } put(G, s1 + 'S'); }
  for (const p of out.polys) { const G = grp[p.layer]; if (!G || !p.pts || p.pts.length < 2) continue; put(G, p.pts.map((q, i) => f(X(q.x)) + ' ' + f(Y(q.y)) + (i ? ' l' : ' m')).join(' ') + ' S'); }
  for (const d of out.dims || []) for (const l of d.lines) put('kote', f(X(l.a.x)) + ' ' + f(Y(l.a.y)) + ' m ' + f(X(l.b.x)) + ' ' + f(Y(l.b.y)) + ' l S');
  for (const key of Object.keys(L)) { if (!by[key]) continue; c += '/OC ' + L[key] + ' BDC ' + style[key] + '\n' + by[key].join('\n') + '\n[] 0 d EMC\n'; }
  // tekstovi (minimalna čitljiva veličina)
  const tx = {}; const putT = (key, s) => { (tx[key] = tx[key] || []).push(s); };
  for (const t of out.texts) { const G = grp[t.layer]; if (!G) continue; const sz = Math.max(t.h * k, t.h >= 16 ? 8 : t.h >= 11 ? 6 : 5); putT(G, P.text(t.text, X(t.x), Y(t.y), sz, { align: t.align === 'l' ? 'l' : 'c', rot: t.rot || 0, bold: t.h >= 16 && G === 'opis' && !/^P =/.test(t.text) })); }
  for (const d of out.dims || []) for (const t of d.texts) putT('kote', P.text(t.text, X(t.x), Y(t.y) + 0.8, Math.max(t.h * k, 6), { align: 'c', rot: t.rot || 0 }));
  for (const key of Object.keys(L)) { if (!tx[key]) continue; c += '/OC ' + L[key] + ' BDC ' + tcol[key] + '\n' + tx[key].join('') + 'EMC\n'; }
  // mjerna skala (samo u mjerilu) i strelica sjevera
  if (best.sc) { const mPt = 100 * k, maxW = (hf.right - hf.left) * 0.3; let Lm = [10, 5, 2, 1].find(v => v * mPt <= maxW) || 1, step = Lm <= 2 ? 0.5 : 1; const x0p = hf.left + 4, y0p = hf.bottom + 8;
    c += '0 0 0 RG 0.4 w\n'; for (let i = 0; i < Lm / step; i++) { const xa = x0p + i * step * mPt; c += (i % 2 ? '1 g' : '0 g') + ' ' + f(xa) + ' ' + f(y0p) + ' ' + f(step * mPt) + ' 3.5 re B\n'; }
    c += '0 g' + '\n' + P.text('0', x0p, y0p + 6, 6, { align: 'c' }) + P.text(fmtM(Lm) + ' m', x0p + Lm * mPt, y0p + 6, 6, { align: 'c' }) + (Lm >= 2 ? P.text(fmtM(Lm / 2), x0p + Lm / 2 * mPt, y0p + 6, 6, { align: 'c' }) : '') + P.text('M 1:' + best.sc, x0p + Lm * mPt + 14, y0p, 7); }
  if (NO != null) { const a = NO * Math.PI / 180, cx0 = hf.right - 22, cy0 = hf.top - 26, R = 13, pt = (r, t) => f(cx0 + r * Math.sin(t)) + ' ' + f(cy0 + r * Math.cos(t));
    c += '0 0 0 RG 0.5 w ' + f(cx0 + R) + ' ' + f(cy0) + ' m'; for (let i = 1; i <= 24; i++) { const t = 2 * Math.PI * i / 24; c += ' ' + f(cx0 + R * Math.cos(t)) + ' ' + f(cy0 + R * Math.sin(t)) + ' l'; } c += ' S\n';
    c += '0 g ' + pt(R - 1, a) + ' m ' + pt(R * 0.55, a + Math.PI * 0.82) + ' l ' + pt(R * 0.2, a + Math.PI) + ' l ' + pt(R * 0.55, a - Math.PI * 0.82) + ' l h f\n';
    const lp = { x: cx0 + (R + 7) * Math.sin(a), y: cy0 + (R + 7) * Math.cos(a) - 3 }; c += P.text('S', lp.x, lp.y, 9, { bold: true, align: 'c' }); }
  c += 'Q\n';
  doc.page(PW, PH, c);
  if (opt.ret) return doc.bytes();
  P.save(doc.bytes(), P.fileName(PN) + '_' + P.fileName(FN || 'etaza') + '_tlocrt.pdf');
}

/* ---------- crtanje ---------- */
let cv, cx;
function setupCanvas() {
  cv = $('tlCanvas'); cx = cv.getContext('2d');
  const ptr = new Map(); let g = null, moved = false, downAt = null;
  const pos = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  cv.addEventListener('pointerdown', e => { e.preventDefault(); cv.setPointerCapture(e.pointerId); ptr.set(e.pointerId, pos(e)); moved = false; downAt = pos(e); g = null; });
  cv.addEventListener('pointermove', e => {
    if (!ptr.has(e.pointerId) || !W.view) return; const prev = ptr.get(e.pointerId), p = pos(e); ptr.set(e.pointerId, p);
    if (ptr.size === 1) { if (Math.hypot(p.x - downAt.x, p.y - downAt.y) > 6) moved = true; if (moved) { W.view.ox += p.x - prev.x; W.view.oy += p.y - prev.y; draw(); } }
    else if (ptr.size === 2) { moved = true; const [a, b] = [...ptr.values()], d = Math.hypot(a.x - b.x, a.y - b.y), c = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; if (g) { const wpt = inv(g.c); W.view.s *= d / (g.d || 1); W.view.ox = c.x - wpt.x * W.view.s; W.view.oy = c.y - wpt.y * W.view.s; draw(); } g = { d, c }; }
  });
  const up = e => { if (!ptr.has(e.pointerId)) return; ptr.delete(e.pointerId); if (!ptr.size) { g = null; if (!moved && (W.step === 2 || W.step === 3) && W.m) tapLabel(pos(e)); } };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', e => { e.preventDefault(); if (!W.view) return; const p = pos(e), f = e.deltaY < 0 ? 1.15 : 1 / 1.15; W.view.ox = p.x - (p.x - W.view.ox) * f; W.view.oy = p.y - (p.y - W.view.oy) * f; W.view.s *= f; draw(); }, { passive: false });
}
function tapLabel(p) {
  const q = inv(p);
  if (W.pinMode) { const pm = W.pinMode; pm.pts.push({ x: Math.round(q.x * 10) / 10, y: Math.round(q.y * 10) / 10 });
    if (pm.pts.length >= 2) { const o = (W.st.labels[pm.sig] = W.st.labels[pm.sig] || {}); o.pin = { a: pm.pts[0], b: pm.pts[1] }; W.pinMode = null; pinBanner(); persist(); const l = W.m.labels[pm.id]; refreshRow(l); select(l.id, false); } else pinBanner(); return; } let best = -1, bd = 30 / W.view.s;
  if (W.step === 2) for (const l of W.m.labels) { if (l.syn0) continue; const b = l.bb, d = Math.max(0, b.x0 - q.x, q.x - b.x1, b.y0 - q.y, q.y - b.y1); if (d < bd) { bd = d; best = l.id; } }
  if (best >= 0) { closeWallPop(); select(best, true); return; }
  // dodir na zub: niša ili zadebljanje
  for (const n of W.m.niches || []) { if (n.wall == null) continue; const u = n.o === 'H' ? q.x : q.y, v = n.o === 'H' ? q.y : q.x; if (u < n.s0 - 6 || u > n.s1 + 6 || v < Math.min(n.cW, n.nc) - 22 / W.view.s || v > Math.max(n.cW, n.nc) + 22 / W.view.s) continue; openNichePop(n); return; }
  // dodir na stubište: ispravak broja visina, duljine, širine…
  for (const S of W.m.stairs || []) { const P = (a, c) => S.o === 'H' ? { x: a, y: c } : { x: c, y: a }, p0 = P(S.a0, S.c0), p1 = P(S.a1, S.c1), pad = 6 / W.view.s;
    if (q.x > Math.min(p0.x, p1.x) - pad && q.x < Math.max(p0.x, p1.x) + pad && q.y > Math.min(p0.y, p1.y) - pad && q.y < Math.max(p0.y, p1.y) + pad) { closeWallPop(); editStair(S.key); return; } }
  // dodir na zid: debljina / linija u pogledu
  let bw = null, bdw = 22 / W.view.s;
  for (const w of W.m.walls) { const pu = w.o === 'H' ? q.x : q.y, pv = w.o === 'H' ? q.y : q.x; if (pu < w.e0 - 4 || pu > w.e1 + 4) continue; const d = Math.abs(pv - w.c); if (d < bdw) { bdw = d; bw = w; } }
  if (bw) openWallPop(bw, q); else closeWallPop();
}
function openNichePop(n) {
  const B = C.buildConstraints(W.m, W.st), o = (B.nis || []).find(x => x.s0 === n.s0 && x.cW === n.cW); if (!o) return;
  W.selWall = null; const p = $('tlWallPop'); p.hidden = false;
  p.innerHTML = '<div class="tl-pop-head"><b>Zub u zidu</b><button class="tl-btn" id="tlWpX">✕</button></div><p class="tl-note">Što je ovo mjesto?</p><div class="tl-chips">' +
    [['nisa', 'Niša (udubljenje)'], ['zadebljanje', 'Zadebljanje / stup']].map(([k, t]) => '<button class="tl-chip' + (o.kind === k ? ' on' : '') + '" data-k="' + k + '">' + t + '</button>').join('') + '</div>';
  $('tlWpX').onclick = closeWallPop;
  p.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { const base = n.kind; if (b.dataset.k === base) delete W.st.nicheKind[o.key]; else W.st.nicheKind[o.key] = b.dataset.k; persist(); openNichePop(n); draw(); });
}
function closeWallPop() { const p = $('tlWallPop'); if (p) p.hidden = true; W.selWall = null; draw(); }
function editStair(key) {
  const B = C.buildConstraints(W.m, W.st), S = (B.stairs || []).find(x => x.key === key); if (!S) return;
  W.forceQ = { type: 'st', key: S.key, stair: S, est: { n: S.n || S.nLines + 1, L: S.L || '', w: S.w || '' }, text: 'Stubište: ispravi podatke kraka.', hint: 'Duljina kraka = tlocrtna duljina od prve do zadnje visine (čela). Gazišta = broj visina − 1. Promjena se odmah primjenjuje na tlocrt.' };
  go(3);
}
function reanalyze() {
  try { W.m = C.analyze(W.floor, { splits: W.st.wallSplit }); } catch (e) { alert('Analiza nije uspjela: ' + (e.message || e)); return; }
  W.m.labels.forEach(l => { const k = l.ocrKey || l.sig; if (W.st.rec[k] != null) l.rec = W.st.rec[k]; });
  W.out = null; persist(); const v = W.view; go(W.step === 3 ? 3 : 2); W.view = v; draw();
}
function openWallPop(w, tap) {
  if (tap) W.wallTap = tap; tap = W.wallTap;
  W.selWall = w; const key = C.wallKey(w), view = C.isView(w, W.st), cur = W.st.wallT[key];
  const def = w.tLabel || (w.exterior ? W.st.settings.ext : W.st.settings.int);
  const p = $('tlWallPop'); p.hidden = false;
  p.innerHTML = '<div class="tl-pop-head"><b>' + (w.obj ? 'Dimnjak / stup' : view ? 'Linija u pogledu' : (w.exterior ? 'Vanjski zid' : 'Unutarnji zid')) + '</b><button class="tl-btn" id="tlWpX">✕</button></div>' +
    (w.view ? '<p class="tl-note">Nacrtano na sloju Pogled.</p>' : '<label class="tl-check"><input type="checkbox" id="tlWpView"' + (view ? ' checked' : '') + '> Linija u pogledu (nije zid: rub balkona, terase, stube…)</label>') +
    (view || w.obj ? '' : '<label class="tl-field">Debljina ovog zida (cm)<input id="tlWpT" type="number" inputmode="decimal" value="' + (cur || '') + '" placeholder="' + def + '"></label><div class="tl-chips" id="tlWpChips">' + [10, 12, 15, 20, 25, 30, 38, 45, 50].map(v => '<button class="tl-chip' + (cur === v ? ' on' : '') + '">' + v + '</button>').join('') + '</div>');
  const save = () => { persist(); W.out = null; draw(); };
  if (!view && !w.obj && !w.view) {
    const split = w.line && w.line.splitAt != null, box = document.createElement('div'); box.className = 'tl-split';
    box.innerHTML = split ? '<p class="tl-note">Ovaj zid je prelomljen (skok). Pomak dijelova računa se iz mjera prostorija; ako nema mjere koja ga određuje, skok se dijeli napola.</p><button class="tl-btn" id="tlWpUnsplit">Ukloni prijelom</button>'
      : '<p class="tl-note">Zid je na skici ravan, a u stvarnosti ima skok (npr. ulaz širi od hodnika) ili drukčiju debljinu na dijelu? Prelomi ga kod spoja s drugim zidom, pa svakom dijelu zadaj debljinu.</p><button class="tl-btn" id="tlWpSplit">✂ Prelomi zid kod najbližeg spoja</button>';
    p.appendChild(box);
    if ($('tlWpSplit')) $('tlWpSplit').onclick = () => {
      const u = tap ? (w.o === 'H' ? tap.x : tap.y) : (w.e0 + w.e1) / 2, E = W.m.E; let at = null, bd = Infinity;
      for (const q of W.m.walls) { if (q.o === w.o || q.view || C.isView(q, W.st) || q.c <= w.e0 + E || q.c >= w.e1 - E || w.c < q.e0 - 1.5 * E || w.c > q.e1 + 1.5 * E) continue; const d = Math.abs(q.c - u); if (d < bd) { bd = d; at = q.c; } }
      if (at == null) { if (u > w.e0 + E && u < w.e1 - E) at = u; else { alert('Dodirni zid bliže mjestu gdje ga treba prelomiti.'); return; } }
      W.st.wallSplit.push({ o: w.o, c: w.c, at }); reanalyze();
    };
    if ($('tlWpUnsplit')) $('tlWpUnsplit').onclick = () => { const at = w.line.splitAt; const hit = sp => sp.o === w.o && sp.at === at && Math.abs(sp.c - w.c) < 2 * W.m.E; W.st.wallSplit.forEach(sp => { if (hit(sp) && sp.auto) sp.off = true; }); W.st.wallSplit = W.st.wallSplit.filter(sp => !hit(sp) || sp.auto); reanalyze(); };
  }
  $('tlWpX').onclick = closeWallPop;
  if ($('tlWpView')) $('tlWpView').onchange = e => { if (e.target.checked) W.st.wallView[key] = true; else delete W.st.wallView[key]; save(); openWallPop(w); };
  if ($('tlWpT')) $('tlWpT').onchange = e => { const v = parseFloat(String(e.target.value).replace(',', '.')); if (v > 0) W.st.wallT[key] = v; else delete W.st.wallT[key]; save(); openWallPop(w); };
  if ($('tlWpChips')) $('tlWpChips').querySelectorAll('button').forEach(b => b.onclick = () => { W.st.wallT[key] = +b.textContent; save(); openWallPop(w); });
  draw();
}
const tr = p => ({ x: p.x * W.view.s + W.view.ox, y: p.y * W.view.s + W.view.oy });
const inv = p => ({ x: (p.x - W.view.ox) / W.view.s, y: (p.y - W.view.oy) / W.view.s });
function fitTo(b, pad) {
  const r = cv.getBoundingClientRect(), w = Math.max(1, r.width - 2 * pad), h = Math.max(1, r.height - 2 * pad);
  const s = Math.min(w / Math.max(1, b.x1 - b.x0), h / Math.max(1, b.y1 - b.y0));
  W.view = { s, ox: r.width / 2 - (b.x0 + b.x1) / 2 * s, oy: r.height / 2 - (b.y0 + b.y1) / 2 * s };
}
function focusOn(l) {
  if (!l || !W.view) return; const r = cv.getBoundingClientRect(), p = tr({ x: l.cx, y: l.cy });
  if (p.x < 40 || p.y < 40 || p.x > r.width - 40 || p.y > r.height - 40) { W.view.ox += r.width / 2 - p.x; W.view.oy += r.height / 2 - p.y; }
}
function focusQuestion(q) { if (q && (q.type === 'viol' || q.type === 'od' || q.type === 'rd')) focusOn(q.label); }
function draw() {
  if (!cv || !W.open) return;
  const r = cv.getBoundingClientRect(), d = window.devicePixelRatio || 1;
  cv.width = Math.max(1, Math.round(r.width * d)); cv.height = Math.max(1, Math.round(r.height * d)); cx.setTransform(d, 0, 0, d, 0, 0);
  cx.fillStyle = '#fff'; cx.fillRect(0, 0, r.width, r.height);
  if (W.step === 4 && W.out) return drawResult();
  if (!W.m) { drawRaw(); return; }
  const m = W.m;
  if (!W.view) { const all = m.sk.nacrt.flat().concat(m.sk.kote.flat()); fitTo(C.bbox(all.length ? all : [{ x: 0, y: 0 }, { x: 1, y: 1 }]), 30); }
  const s = W.view.s;
  const poly = (pts, col, w) => { if (pts.length < 2) return; cx.strokeStyle = col; cx.lineWidth = w; cx.beginPath(); const a = tr(pts[0]); cx.moveTo(a.x, a.y); for (let i = 1; i < pts.length; i++) { const b = tr(pts[i]); cx.lineTo(b.x, b.y); } cx.stroke(); };
  cx.lineCap = 'round'; cx.lineJoin = 'round';
  m.sk.nacrt.forEach(p => poly(p, '#c7ced8', 1.5));
  m.sk.opisi.forEach(p => poly(p, '#f2a7ad', 1.2));
  // izravnani zidovi
  (m.sk.pogled || []).forEach(p => poly(p, '#94a3b8', 1.5));
  for (const w of m.walls) {
    const a = w.o === 'H' ? { x: w.e0, y: w.c } : { x: w.c, y: w.e0 }, b = w.o === 'H' ? { x: w.e1, y: w.c } : { x: w.c, y: w.e1 }, view = C.isView(w, W.st);
    if (W.selWall === w) poly([a, b], '#f97316', 10);
    if (view) { cx.setLineDash([8, 5]); poly([a, b], '#64748b', 2.5); cx.setLineDash([]); }
    else if (w.obj) poly([a, b], '#b45309', 2);
    else poly([a, b], w.exterior ? '#0f2c55cc' : '#4a6a92aa', Math.max(2, Math.min(7, (W.st.wallT[C.wallKey(w)] || (w.exterior ? W.st.settings.ext : W.st.settings.int)) / 8)));
  }
  for (const o of m.openings) { const w = m.walls[o.wall], a = w.o === 'H' ? { x: o.s0, y: w.c } : { x: w.c, y: o.s0 }, b = w.o === 'H' ? { x: o.s1, y: w.c } : { x: w.c, y: o.s1 }; poly([a, b], o.type === 'vrata' ? '#22a35a' : '#e6a700', 5); }
  m.arcs.forEach(a => poly(a.pts, a.used ? '#22a35a' : '#c7ced8', 1.5));
  m.segs.filter(x => x.stair).forEach(x => poly([x.p0, x.p1], '#b04bd0', 1.5));
  m.sk.kote.forEach(p => poly(p, '#2563eb', 1.6));
  (m.cross || []).forEach(c => poly(c.pts, '#0d9488', 3.5));
  (m.edims || []).forEach(e => poly(e.pts, '#db2777', 3.5));
  (m.niches || []).forEach(n => { const P = (u, v) => n.o === 'H' ? { x: u, y: v } : { x: v, y: u }; poly([P(n.s0, n.cW), P(n.s0, n.nc), P(n.s1, n.nc), P(n.s1, n.cW)], '#ea580c', 3.5); });
  (m.leaders || []).forEach(ld => { poly(ld.pts, '#db2777', 3.5); if (ld.tail) poly(ld.tail, '#db2777', 2.5); if (ld.S) { const q = tr(ld.S); cx.fillStyle = '#db2777'; cx.beginPath(); cx.arc(q.x, q.y, 6, 0, 7); cx.fill(); } });
  cx.font = '600 13px Arial'; cx.textBaseline = 'middle';
  for (const t of m.texts) { if (t.syn0) continue; const p = tr(C.rotP({ x: t.x, y: t.y - 7 }, -m.theta)); cx.fillStyle = t.layer === 'kote' ? '#2563eb' : t.layer === 'opisi' ? '#c03945' : '#111'; cx.fillText(t.text, p.x, p.y); }
  // natpisi kota
  let info = null; try { info = C.buildConstraints(m, W.st); } catch (e) { }
  for (const l of m.labels) { if (l.syn0) continue;
    const ov = W.st.labels[l.sig] || {}, val = ov.value != null ? ov.value : (l.text != null ? l.text : (l.rec || ''));
    const p = C.parseLabel(val, { cm: ov.value == null && l.cm }); if (p.kind === 'nepoznato' && p.guess > 0 && String(val).trim() !== '' && (ov.value != null || l.src === 'text')) { p.kind = 'mjera'; p.v = p.guess; }
    const kind = ov.kind && ov.kind !== 'auto' ? ov.kind : C.autoKind(l, p);
    const a = tr({ x: l.bb.x0, y: l.bb.y0 }), b = tr({ x: l.bb.x1, y: l.bb.y1 }), sel = W.step === 2 && W.sel === l.id;
    const col = kind === 'zanemari' ? '#94a3b8' : kind === 'nepoznato' ? '#dc2626' : (kind === 'osirina' || kind === 'ovisina') ? '#0d9488' : '#2563eb';
    cx.strokeStyle = sel ? '#f97316' : col; cx.lineWidth = sel ? 3 : 1.2; cx.setLineDash(sel ? [] : [4, 3]); cx.strokeRect(a.x - 4, a.y - 4, b.x - a.x + 8, b.y - a.y + 8); cx.setLineDash([]);
    cx.fillStyle = sel ? '#f97316' : col; cx.beginPath(); cx.arc(a.x - 4, a.y - 4, 10, 0, 7); cx.fill(); cx.fillStyle = '#fff'; cx.font = '700 11px Arial'; cx.textAlign = 'center'; cx.fillText(String(l.n), a.x - 4, a.y - 4); cx.textAlign = 'start';
    if (l.src === 'ink' && val) { cx.fillStyle = col; cx.font = '700 12px Arial'; cx.fillText(val, b.x + 8, (a.y + b.y) / 2); }
    if (sel && l.span && l.span.room && info) for (const c of info.cons) { if (c.label === l) drawSpan(c.span, '#f97316'); }
    else if (sel && l.span) drawSpan(l.span, '#f97316');
    if (sel && ov.pin) { const pa = tr(ov.pin.a), pb = tr(ov.pin.b); cx.strokeStyle = '#0f766e'; cx.lineWidth = 2; cx.setLineDash([6, 4]); cx.beginPath(); cx.moveTo(pa.x, pa.y); cx.lineTo(pb.x, pb.y); cx.stroke(); cx.setLineDash([]); for (const q2 of [pa, pb]) { cx.fillStyle = '#0f766e'; cx.beginPath(); cx.arc(q2.x, q2.y, 7, 0, 7); cx.fill(); } }
  }
  if (W.pinMode) for (const q2 of W.pinMode.pts) { const pp = tr(q2); cx.fillStyle = '#0f766e'; cx.beginPath(); cx.arc(pp.x, pp.y, 8, 0, 7); cx.fill(); }
  if (W.step === 3 && W.q) drawQuestion(W.q);
}
function drawSpan(sp, col) {
  if (sp && sp.col != null && W.m.columns && W.m.columns[sp.col]) { const b0 = W.m.columns[sp.col].bb, a = tr({ x: b0.x0, y: b0.y0 }), b = tr({ x: b0.x1, y: b0.y1 }); cx.strokeStyle = col; cx.lineWidth = 3; cx.strokeRect(a.x - 4, a.y - 4, b.x - a.x + 8, b.y - a.y + 8); return; }
  if (!sp || !sp.ax || !W.m.axes[sp.ax] || !W.m.axes[sp.ax][sp.i] || !W.m.axes[sp.ax][sp.j]) return;
  const A = W.m.axes[sp.ax], u0 = A[sp.i].s, u1 = A[sp.j].s, v = sp.v;
  const P = (u, w) => sp.ax === 'X' ? { x: u, y: w } : { x: w, y: u };
  const a = tr(P(u0, v)), b = tr(P(u1, v)); cx.strokeStyle = col; cx.lineWidth = 2.5; cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(b.x, b.y); cx.stroke();
  for (const p of [a, b]) { cx.beginPath(); cx.arc(p.x, p.y, 5, 0, 7); cx.fillStyle = col; cx.fill(); }
}
function drawQuestion(q) {
  const m = W.m, all = C.bbox(m.sk.nacrt.flat()), col = '#f97316';
  cx.setLineDash([8, 6]); cx.lineWidth = 3; cx.strokeStyle = col;
  if (q.type === 'gap') {
    for (const s of [q.si, q.sj]) { const a = tr(q.ax === 'X' ? { x: s, y: all.y0 - 20 } : { x: all.x0 - 20, y: s }), b = tr(q.ax === 'X' ? { x: s, y: all.y1 + 20 } : { x: all.x1 + 20, y: s }); cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(b.x, b.y); cx.stroke(); }
    cx.setLineDash([]);
    const ax = q.ax === 'X' ? 'V' : 'H';
    for (const w of m.walls) if (w.o === ax && (Math.abs(w.c - q.si) < 1 || Math.abs(w.c - q.sj) < 1)) { const a = tr(w.o === 'H' ? { x: w.e0, y: w.c } : { x: w.c, y: w.e0 }), b = tr(w.o === 'H' ? { x: w.e1, y: w.c } : { x: w.c, y: w.e1 }); cx.lineWidth = 6; cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(b.x, b.y); cx.stroke(); }
    const mid = (q.si + q.sj) / 2, y = q.ax === 'X' ? all.y0 - 10 : all.x0 - 10, a = tr(q.ax === 'X' ? { x: q.si, y } : { x: y, y: q.si }), b = tr(q.ax === 'X' ? { x: q.sj, y } : { x: y, y: q.sj }), c = tr(q.ax === 'X' ? { x: mid, y } : { x: y, y: mid });
    cx.lineWidth = 2; cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(b.x, b.y); cx.stroke(); cx.fillStyle = col; cx.font = '800 18px Arial'; cx.textAlign = 'center'; cx.fillText('?', c.x, c.y - 12); cx.textAlign = 'start';
  } else if (q.type === 'viol' || q.type === 'od' || q.type === 'rd') {
    cx.setLineDash([]); const l = q.label, a = tr({ x: l.bb.x0, y: l.bb.y0 }), b = tr({ x: l.bb.x1, y: l.bb.y1 }); cx.strokeStyle = '#dc2626'; cx.lineWidth = 3; cx.strokeRect(a.x - 6, a.y - 6, b.x - a.x + 12, b.y - a.y + 12); if (l.span) drawSpan(l.span, '#dc2626');
  } else if (q.type === 'st') {
    cx.setLineDash([]); const S = q.stair, P = (a, c) => S.o === 'H' ? { x: a, y: c } : { x: c, y: a }, a = tr(P(S.a0, S.c0)), b = tr(P(S.a1, S.c1));
    cx.strokeStyle = col; cx.lineWidth = 4; cx.strokeRect(Math.min(a.x, b.x) - 6, Math.min(a.y, b.y) - 6, Math.abs(b.x - a.x) + 12, Math.abs(b.y - a.y) + 12);
  } else if (q.type === 'nd' || q.type === 'nk') {
    cx.setLineDash([]); const n = q.nis, P = (u, v) => n.o === 'H' ? { x: u, y: v } : { x: v, y: u }, a = tr(P(n.s0, n.cW)), b = tr(P(n.s1, n.cW));
    cx.strokeStyle = col; cx.lineWidth = 8; cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(b.x, b.y); cx.stroke(); cx.beginPath(); cx.arc((a.x + b.x) / 2, (a.y + b.y) / 2, Math.max(18, Math.hypot(a.x - b.x, a.y - b.y)), 0, 7); cx.lineWidth = 2; cx.stroke();
  } else if (q.type === 'ow') {
    cx.setLineDash([]); const o = q.op, w = m.walls[o.wall], a = tr(w.o === 'H' ? { x: o.s0, y: w.c } : { x: w.c, y: o.s0 }), b = tr(w.o === 'H' ? { x: o.s1, y: w.c } : { x: w.c, y: o.s1 });
    cx.strokeStyle = col; cx.lineWidth = 8; cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(b.x, b.y); cx.stroke(); cx.beginPath(); cx.arc((a.x + b.x) / 2, (a.y + b.y) / 2, Math.max(18, Math.hypot(a.x - b.x, a.y - b.y)), 0, 7); cx.lineWidth = 2; cx.stroke();
  }
  cx.setLineDash([]);
}
function drawRaw() {
  const pts = (W.floor.items || []).flatMap(o => o.pts || []); if (!pts.length) return;
  if (!W.view) fitTo(C.bbox(pts), 30);
  cx.lineCap = 'round';
  for (const o of W.floor.items) { if (!o.pts || o.pts.length < 2) continue; cx.strokeStyle = o.layer === 'nacrt' ? '#334155' : o.layer === 'kote' ? '#2563eb' : '#c03945'; cx.lineWidth = 1.4; cx.setLineDash(o.dash ? [6, 4] : []); cx.beginPath(); const a = tr(o.pts[0]); cx.moveTo(a.x, a.y); for (const p of o.pts) { const b = tr(p); cx.lineTo(b.x, b.y); } cx.stroke(); } cx.setLineDash([]);
}
const LCOL = { POGLED: '#64748b', ZIDOVI_NOSIVI: '#0b1220', ZIDOVI_PREGRADNI: '#475569', OTVORI_VRATA: '#16a34a', GARAZNA_VRATA: '#16a34a', OTVORI_PROZORI: '#0891b2', KOTE: '#2563eb', OPISI: '#dc2626', STUBISTE: '#a21caf', STUBISTE_CRTKANO: '#a21caf', DIMNJAK: '#b45309', OSTALO: '#cbd5e1', PROVJERA: '#f97316', NADVOJ: '#16a34a', KROVNI_PROZOR: '#0891b2', OTVOR_PLOCA: '#0f766e', TERASA: '#65a30d', GREDE: '#b91c1c', PRAG: '#9333ea', SKICA: null };
function drawResult() {
  const o = W.out; if (!W.view) { const b = o.bounds; fitTo({ x0: b.x0 - 160, y0: b.y0 - 160, x1: b.x1 + 160, y1: b.y1 + 160 }, 16); }
  const s = W.view.s;
  // ispuna zidova
  const fq = (Q, c) => { cx.fillStyle = c; for (const q of Q) { cx.beginPath(); q.forEach((p, i) => { const a = tr(p); i ? cx.lineTo(a.x, a.y) : cx.moveTo(a.x, a.y); }); cx.closePath(); cx.fill(); } };
  if (o.wallQ) { fq(o.wallQ, '#e2e8f0'); fq(o.holeQ || [], '#fff'); } else {
  cx.fillStyle = '#e2e8f0'; for (const r of o.walls) { const a = tr({ x: r.x0, y: r.y0 }); cx.fillRect(a.x, a.y, (r.x1 - r.x0) * s, (r.y1 - r.y0) * s); }
  cx.fillStyle = '#fff'; for (const h of o.holes) { const a = tr({ x: h.x0, y: h.y0 }); cx.fillRect(a.x, a.y, (h.x1 - h.x0) * s, (h.y1 - h.y0) * s); } }
  for (const p of o.polys) { const c = LCOL[p.layer]; if (!c) continue; cx.strokeStyle = c; cx.lineWidth = 1; cx.beginPath(); p.pts.forEach((q, i) => { const a = tr(q); i ? cx.lineTo(a.x, a.y) : cx.moveTo(a.x, a.y); }); cx.stroke(); }
  for (const d of o.dims || []) { const c = LCOL[d.layer]; if (!c) continue; cx.strokeStyle = c; cx.lineWidth = 1.1; for (const l of d.lines) { const a = tr(l.a), b = tr(l.b); cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(b.x, b.y); cx.stroke(); } cx.textAlign = 'center'; for (const t of d.texts) { const p = tr(t); cx.save(); cx.translate(p.x, p.y); cx.rotate(-(t.rot || 0) * Math.PI / 180); cx.fillStyle = c; cx.font = Math.max(8, t.h * s) + 'px Arial'; cx.fillText(t.text, 0, 0); cx.restore(); } cx.textAlign = 'start'; }
  for (const l of o.lines) { const c = LCOL[l.layer]; if (!c) continue; const a = tr(l.a), b = tr(l.b); cx.strokeStyle = c; cx.lineWidth = l.layer.startsWith('ZIDOVI') ? 1.8 : 1.1; if (/^(STUBISTE_CRTKANO|NADVOJ|KROVNI_PROZOR|OTVOR_PLOCA|TERASA|GREDE|GARAZNA_VRATA)$/.test(l.layer)) cx.setLineDash([6, 4]); cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(b.x, b.y); cx.stroke(); cx.setLineDash([]); }
  for (const a of o.arcs) { const c = tr(a.c), f = Math.atan2(a.from.y - a.c.y, a.from.x - a.c.x), t = Math.atan2(a.to.y - a.c.y, a.to.x - a.c.x); let d = t - f; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; cx.strokeStyle = LCOL[a.layer]; cx.lineWidth = 1.1; cx.beginPath(); cx.arc(c.x, c.y, a.r * s, f, f + d, d < 0); cx.stroke(); }
  for (const c of o.circles) { const p = tr(c.c); cx.strokeStyle = LCOL[c.layer]; cx.beginPath(); cx.arc(p.x, p.y, c.r * s, 0, 7); cx.stroke(); }
  cx.textAlign = 'center'; cx.textBaseline = 'alphabetic';
  for (const t of o.texts) { const c = LCOL[t.layer]; if (!c) continue; const p = tr(t); cx.save(); cx.translate(p.x, p.y); cx.rotate(-(t.rot || 0) * Math.PI / 180); cx.fillStyle = c; cx.font = (t.layer === 'OPISI' && t.h >= 14 ? '700 ' : '') + Math.max(8, t.h * s) + 'px Arial'; cx.fillText(t.text, 0, 0); cx.restore(); }
  cx.textAlign = 'start';
  if (W.bigP && W.bigP.length) { cx.font = 'bold 12px Arial'; cx.textAlign = 'center';
    for (const P of W.bigP) { const w = P.w; if (!P.pos) continue; const { a0, a1, c } = P.pos;
      const off = -(w.outSide || 1) * 45, q = w.o === 'H' ? { x: (a0 + a1) / 2, y: c + off } : { x: c + off, y: (a0 + a1) / 2 }, p = tr(q);
      cx.strokeStyle = '#ea580c'; cx.lineWidth = 4; const e0 = tr(w.o === 'H' ? { x: a0, y: c } : { x: c, y: a0 }), e1 = tr(w.o === 'H' ? { x: a1, y: c } : { x: c, y: a1 }); cx.beginPath(); cx.moveTo(e0.x, e0.y); cx.lineTo(e1.x, e1.y); cx.stroke();
      cx.fillStyle = '#ea580c'; cx.beginPath(); cx.arc(p.x, p.y, 12, 0, 7); cx.fill(); cx.fillStyle = '#fff'; cx.fillText('Z' + P.n, p.x, p.y + 4); }
    cx.textAlign = 'start'; }
  if (W.geoF && W.geoF.length && W.st.geo && W.st.geo.open) { cx.font = 'bold 12px Arial'; cx.textAlign = 'center'; W.geoF.forEach((f, n) => { const q = f.o === 'H' ? { x: f.p.x, y: f.p.y + f.side * 70 } : { x: f.p.x + f.side * 70, y: f.p.y }, p = tr(q); cx.fillStyle = '#dc2626'; cx.beginPath(); cx.arc(p.x, p.y, 13, 0, 7); cx.fill(); cx.fillStyle = '#fff'; cx.fillText('G' + (n + 1), p.x, p.y + 4); }); cx.textAlign = 'start'; }
}

/* izrada tlocrta etaže bez čarobnjaka (za energetski proračun): vraća { m, st, out } ili baca grešku */
function buildFloor(floor) {
  const t = floor.tlocrt || {}; if (!t.v || t.v < 6) throw Error('Etaža „' + (floor.name || '') + '” nema izrađen tlocrt (Tlocrt → DXF).');
  const st = { settings: loadSettings(), labels: t.labels || {}, answers: t.answers || {}, decisions: t.decisions || {}, openings: t.openings || {}, rec: t.rec || {}, wallT: t.wallT || {}, wallView: t.wallView || {}, niches: t.niches || {}, nicheKind: t.nicheKind || {}, stairs: t.stairs || {}, columns: t.columns || {}, offPick: t.offPick || {}, north: t.north != null ? t.north : null, wallSplit: t.wallSplit || [], roomSwap: t.roomSwap || {} };
  const m = C.analyze(floor, { splits: st.wallSplit }); m.labels.forEach(l => { const k = l.ocrKey || l.sig; if (st.rec[k] != null) l.rec = st.rec[k]; });
  return { m, st, out: C.build(m, st) };
}
/* v2.59: prije izvoza za kompjuter – rukom pisane kote svih etaža pročitaju se na tabletu (na kompjuteru nema prepoznavanja rukopisa) */
function inkTodo(floor) {
  let t = floor.tlocrt; if (!t || (t.v || 1) < 6) t = { v: 6 }; const rec = t.rec || {};
  let m; try { m = C.analyze(floor, { splits: t.wallSplit }); } catch (e) { return []; }
  return m.labels.filter(l => l.src === "ink" && l.rawStrokes && l.rawStrokes.length && rec[l.ocrKey || l.sig] == null);
}
async function prepRec(floor, prog) {
  if (!floor || !Ink.ok()) return { n: 0, empty: 0 };
  const todo = inkTodo(floor); if (!todo.length) return { n: 0, empty: 0 };
  let t = floor.tlocrt; if (!t || (t.v || 1) < 6) t = floor.tlocrt = { v: 6 }; t.rec = t.rec || {};
  let empty = 0;
  for (const l of todo) { const r = await recognizeLabel(l); if (!r) empty++; else t.rec[l.ocrKey || l.sig] = r; if (prog) prog(); }
  return { n: todo.length, empty };
}
window.IzmjeraTlocrtUI = { prepRec, inkTodoCount: f => inkTodo(f).length, planPdfBytes: (out, floorName, north) => exportPlanPdf(out, { ret: true, floorName, north: north == null ? null : north, projectName: (window.IzmjeraApp && IzmjeraApp.projectName()) || 'Izmjera' }), buildFloor, open, close, recognizeLabel, inkOk: () => Ink.ok(), inkPrepare: () => Ink.prepare(), loadSettings, _state: () => W };
document.addEventListener('DOMContentLoaded', () => { const b = $('dxfplan'); if (b) b.onclick = open; });
if (document.readyState !== 'loading') { const b = $('dxfplan'); if (b) b.onclick = open; }
})();
