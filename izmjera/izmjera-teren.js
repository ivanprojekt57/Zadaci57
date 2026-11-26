/* Izmjera 57 — pomoć na terenu: pročitani broj uz svaku kotu, „Što nedostaje?” i fotografije na skici. */
(function () {
'use strict';
const app = window.IzmjeraApp, C = window.IzmjeraTlocrtCore; if (!app || !C) return;
const UI = () => window.IzmjeraTlocrtUI || {};
const $ = id => document.getElementById(id);
const store = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { } } };
const T = { links: store.get('izmjera-teren-veze', '0') === '1', pin: null, crowd: null, wkFails: 0, wkWait: null, on: store.get('izmjera-teren-kote', '1') === '1', sig: '', floor: null, timer: null, m: null, B: null, st: null, ocrBusy: false, hits: [], missing: null, pinHits: [], moving: null };
T.after = [];

/* ---------- stanje čarobnjaka iz etaže (dijeli se s „Tlocrt → DXF”) ---------- */
function tl(floor) { const t = floor.tlocrt = floor.tlocrt || {}; if ((t.v || 1) < 6) { for (const k of Object.keys(t)) delete t[k]; } t.v = 6; for (const k of ['labels', 'answers', 'decisions', 'openings', 'rec', 'wallT', 'wallView', 'niches', 'nicheKind', 'stairs', 'columns', 'offPick']) t[k] = t[k] || {}; return t; }
function stateOf(floor) { const t = tl(floor); const s = (UI().loadSettings && UI().loadSettings()) || { ...C.DEFAULTS }; return { settings: s, labels: t.labels, answers: t.answers, decisions: t.decisions, openings: t.openings, rec: t.rec, wallT: t.wallT, wallView: t.wallView, niches: t.niches, nicheKind: t.nicheKind, stairs: t.stairs, columns: t.columns, offPick: t.offPick }; }
function signature(floor) { let n = 0, p = 0; for (const o of floor.items || []) { if (o.layer !== 'nacrt' && o.layer !== 'kote' && o.layer !== 'pogled') continue; n++; p += o.pts ? o.pts.length : (o.text ? String(o.text).length + 1000 : 1); } return n + ':' + p; }
function rawBox(l) { const m = /^i:(-?\d+),(-?\d+),(-?\d+),(-?\d+)$/.exec(l.sig || ''); if (m) return { x0: +m[1], y0: +m[2], x1: +m[3], y1: +m[4] }; const p = C.rotP({ x: l.cx, y: l.cy }, T.m.theta); return { x0: p.x - 10, y0: p.y - 10, x1: p.x + 10, y1: p.y + 10 }; }
const toRaw = p => C.rotP(p, T.m ? T.m.theta : 0);

function analyzeNow(force) {
  const floor = app.currentFloor(); T.floor = floor; T.sig = signature(floor); T.m = null; T.B = null;
  if (!(floor.items || []).some(o => o.layer === 'kote') && !(force && (floor.items || []).some(o => o.layer === 'nacrt'))) return;
  try { T.m = C.analyze(floor, { splits: (floor.tlocrt && floor.tlocrt.wallSplit) || [] }); } catch (e) { T.m = null; return; }
  T.st = stateOf(floor);
  T.m.labels.forEach(l => { const k = l.ocrKey || l.sig; if (T.st.rec[k] != null) l.rec = T.st.rec[k]; });
  try { T.B = C.buildConstraints(T.m, T.st); } catch (e) { T.B = null; }
  noteNew(floor); if (!T.rk) { T.rk = true; try { rekeyWalls(); } catch (e) { } T.rk = false; } afterAn();
}
/* v1.35: analiza skice ide u pozadini (Web Worker), da ne koči crtanje; ako to ne radi, pokreće se tek kad olovka miruje */
let WK = null, wkId = 0;
function worker() {
  if (WK !== null) return WK;
  try { if (!window.__izCoreSrc || typeof Worker === 'undefined' || !window.Blob || !window.URL) throw 0;
    const src = '(' + window.__izCoreSrc + ')(self);onmessage=function(e){var d=e.data,m=null,err=null;try{m=self.IzmjeraTlocrtCore.analyze(d.floor,d.opts)}catch(x){err=String(x&&x.message||x)}try{postMessage({id:d.id,m:m,err:err})}catch(x){postMessage({id:d.id,m:null,err:"clone"})}}';
    WK = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    WK.onerror = () => { WK = false; T.wkWait = null; schedule(); };
  } catch (e) { WK = false; }
  return WK;
}
function finishAnalysis(floor, sig, m) {
  T.floor = floor; T.sig = sig; T.m = m; T.B = null; if (!m) return;
  T.st = stateOf(floor);
  T.m.labels.forEach(l => { const k = l.ocrKey || l.sig; if (T.st.rec[k] != null) l.rec = T.st.rec[k]; });
  try { T.B = C.buildConstraints(T.m, T.st); } catch (e) { T.B = null; }
  noteNew(floor); if (!T.rk) { T.rk = true; try { rekeyWalls(); } catch (e) { } T.rk = false; } afterAn();
}
/* v2.83: nakon analize (npr. samostalni prijelom zida koji nije u ravnini – izmjera-vodic.js) */
/* v2.83: zid se promijenio (produžen, prelomljen, razdvojen od zida u produžetku) – upisana debljina / „pogled” prelazi na nove dijelove istog zida */
function rekeyWalls() { const m = T.m, f = T.floor; if (!m || !f || !f.tlocrt || f !== app.currentFloor()) return; const t = f.tlocrt, E = m.E; let ch = false;
  const cur = new Map(m.walls.map(w => [C.wallKey(w), w]));
  for (const fld of ['wallT', 'wallView']) { const S = t[fld]; if (!S) continue;
    for (const k of Object.keys(S)) { if (cur.has(k)) continue; const z = /^([HV]):(-?\d+):(-?\d+):(-?\d+)$/.exec(k); if (!z) continue; const o = z[1], c = +z[2], e0 = +z[3], e1 = +z[4];
      const pcs = [...cur].filter(([k1, w]) => w.o === o && !w.obj && Math.abs(w.c - c) <= 2 * E && w.e0 >= e0 - E && w.e1 <= e1 + E && w.e1 - w.e0 >= 2 * E);
      if (pcs.some(([k1]) => S[k1] != null)) continue; /* dijelovi tog zida već imaju svoje upisane vrijednosti – ostaje kako je */
      for (const [k1] of pcs) { S[k1] = S[k]; ch = true; } } }
  if (ch) { app.save(); T.sig = ''; T.mGeo = null; analyzeNow(); app.redraw(); } }
function afterAn() { if (!T.after || !T.after.length) return; clearTimeout(T.afT); T.afT = setTimeout(() => { for (const fn of T.after) { try { fn(); } catch (e) { } } }, 60); }
/* v2.76: „kota se zalijepi” – novoupisana kota na nekoliko sekundi pokaže što mjeri */
function noteNew(floor) { if (!T.m) return; const now = new Set(T.m.labels.filter(l => !l.syn0 && !l.chevOnly && !l.tiny).map(l => l.sig));
  if (T.seen && T.seen.floor === floor) { const fresh = [...now].filter(k => !T.seen.set.has(k)); if (fresh.length && fresh.length <= 3) { T.flash = { sigs: new Set(fresh), until: Date.now() + 6000 }; clearTimeout(T.flashT); T.flashT = setTimeout(() => { T.flash = null; app.redraw(); }, 6100); } }
  T.seen = { floor, set: now }; }
function analyzeBg() {
  const floor = app.currentFloor(), sig = signature(floor);
  if (!(floor.items || []).some(o => o.layer === 'kote')) { finishAnalysis(floor, sig, null); app.redraw(); return; }
  const w = worker();
  if (w) {
    const id = ++wkId; let ok = true;
    w.onmessage = e => { const d = e.data || {}; if (d.id !== wkId) return; T.wkWait = null;
      if (app.currentFloor() !== floor) return;
      if (d.err === 'clone' || (d.err && !d.m && T.wkFails++ > 2)) { /* pozadina ne radi s ovim podacima – ubuduće na glavnoj niti */ WK = false; }
      finishAnalysis(floor, sig, d.err ? null : d.m); app.redraw(); runOcr(); };
    try { w.postMessage({ id, floor: { name: floor.name, items: floor.items, tlocrt: floor.tlocrt }, opts: { splits: (floor.tlocrt && floor.tlocrt.wallSplit) || [] } }); T.wkWait = id; }
    catch (e) { ok = false; WK = false; }
    if (ok) return;
  }
  if (app.busy && app.busy()) { schedule(); return; }
  analyzeNow(); app.redraw(); runOcr();
}
function schedule() { clearTimeout(T.timer); T.timer = setTimeout(() => { if (!worker() && app.busy && app.busy()) { schedule(); return; } analyzeBg(); }, WK === false ? 2500 : 1300); }
async function runOcr() {
  const ui = UI(); if (T.ocrBusy || !T.m || !ui.inkOk || !ui.inkOk() || !ui.recognizeLabel) return;
  const todo = T.m.labels.filter(l => l.src === 'ink' && l.rec == null && !l.chevOnly && !l.tiny && l.rawStrokes && l.rawStrokes.length); if (!todo.length) return;
  T.ocrBusy = true; ui.inkPrepare && ui.inkPrepare(); const floor = T.floor, sig = T.sig; let n = 0;
  for (const l of todo) { if (app.currentFloor() !== floor || signature(floor) !== sig) break; const r = await ui.recognizeLabel(l); l.rec = r; tl(floor).rec[l.ocrKey || l.sig] = r; n++; if (n % 3 === 0) { try { T.B = C.buildConstraints(T.m, T.st); } catch (e) { } app.redraw(); } }
  T.ocrBusy = false; try { T.B = C.buildConstraints(T.m, T.st); } catch (e) { } app.save(); app.redraw();
  if (app.currentFloor() !== floor || signature(floor) !== T.sig) schedule();
}

/* ---------- oblačići s pročitanom vrijednošću ---------- */
function labelState(l) {
  const ov = T.st.labels[l.sig] || {}, I = l.info || {}, val = ov.value != null ? ov.value : (l.text != null ? l.text : l.rec);
  if (T.st.decisions[l.sig] === 'ignore' || ov.kind === 'zanemari') return { val: val || '', col: '#94a3b8', mark: '' };
  if (val == null) return { val: '…', col: '#94a3b8', mark: '' };
  if (!I.kind || I.kind === 'nepoznato' || String(val).trim() === '') return { val: String(val || '?'), col: '#dc2626', mark: '?' };
  if ((I.kind === 'mjera' || I.kind === 'udaljenost') && !l.span) return { val: String(val), col: '#ea580c', mark: '!' };
  return { val: String(val), col: '#16a34a', mark: '' };
}
function drawBubbles(ctx, s) {
  T.hits = []; if (!(T.on || T.links) || !T.m || !app.visible('kote')) return;
  const fs = 12 / s, pad = 3 / s; ctx.save(); ctx.font = '700 ' + fs + 'px Arial'; ctx.textBaseline = 'middle';
  for (const l of T.m.labels) {
    if (l.src !== 'ink' || l.chevOnly || l.tiny) continue; const b = rawBox(l), st = labelState(l), txt = (st.mark ? st.mark + ' ' : '') + st.val;
    const w = ctx.measureText(txt).width + 2 * pad, h = fs + 2 * pad, x = b.x1 + 3 / s, y = b.y0 - h - 1 / s;
    ctx.globalAlpha = 0.92; ctx.fillStyle = '#fff'; ctx.strokeStyle = st.col; ctx.lineWidth = 1.4 / s; rr(ctx, x, y, w, h, 4 / s); ctx.fill(); ctx.stroke();
    ctx.globalAlpha = 1; ctx.fillStyle = st.col; ctx.fillText(txt, x + pad, y + h / 2 + 0.5 / s);
    T.hits.push({ x0: x - 3 / s, y0: y - 3 / s, x1: x + w + 3 / s, y1: y + h + 3 / s, l });
  }
  ctx.restore();
}
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function spanText(l) { const sp = l.span, I = l.info || {}; if (!sp) return (I.kind === 'mjera' || I.kind === 'udaljenost') ? '⚠ ne zna se što mjeri' : (I.kind ? 'vrsta: ' + I.kind : '');
  if (sp.pin) return '📌 dodijeljeno dodirom'; if (sp.room) return 'mjere prostorije'; if (sp.ax) return 'od zida do zida ' + (sp.ax === 'X' ? '↔' : '↕') + (sp.type === 'vanjska' ? ' (vanjska)' : ''); if (sp.off || sp.nrel) return 'udaljenost do otvora/niše'; if (sp.stair != null) return 'stubište'; if (sp.thick != null) return 'debljina zida'; if (sp.col != null) return 'stup'; return 'pridruženo'; }
function editLabel(l) {
  const ov = T.st.labels[l.sig] || {}, cur = ov.value != null ? ov.value : (l.text != null ? l.text : (l.rec || '')), name = '#' + l.n;
  const d = sheet('<div class="tp-head"><b>Kota ' + name + '</b><button data-a="x">✕</button></div><div class="tp-note">Pročitano: „' + esc(l.rec == null ? (l.text != null ? l.text : '…') : l.rec) + '” · ' + esc(spanText(l)) + '</div>' +
    '<input id="tpVal" value="' + esc(cur) + '" autocomplete="off" style="width:100%;font-size:26px;padding:10px;margin:10px 0;border:2px solid #9dbbe0;border-radius:10px;box-sizing:border-box">' +
    '<div class="tp-row" style="flex-wrap:wrap"><button data-a="ok" style="background:#17457f;color:#fff">✓ Spremi</button><button data-a="pin">📌 Dodijeli dodirom</button><button data-a="ign">✕ Zanemari</button>' + (ov.value != null || ov.pin || ov.kind ? '<button data-a="reset">↺ Kako je napisano</button>' : '') + '</div>' +
    '<div class="tp-note">📌: dodirni dva mjesta na crtežu – zid (stranu koju mjeriš) i zid ili rub otvora.</div>');
  const inp = d.querySelector('#tpVal'); setTimeout(() => { try { inp.focus(); inp.select(); } catch (e) { } }, 50);
  const L = () => tl(app.currentFloor()).labels, done = () => { d.remove(); app.save(); schedule(); app.redraw(); };
  const ok = () => { const t = inp.value.trim(), LL = L(); if (t.toLowerCase() === 'x') LL[l.sig] = Object.assign({}, LL[l.sig], { kind: 'zanemari' }); else if (t === '' || t === String(l.rec == null ? '' : l.rec)) { if (LL[l.sig]) { delete LL[l.sig].value; if (LL[l.sig].kind === 'zanemari') delete LL[l.sig].kind; } } else { LL[l.sig] = Object.assign({}, LL[l.sig], { value: t }); if (LL[l.sig].kind === 'zanemari') delete LL[l.sig].kind; delete tl(app.currentFloor()).decisions[l.sig]; } done(); };
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') ok(); });
  d.querySelectorAll('button').forEach(b => b.onclick = () => { const a = b.dataset.a;
    if (a === 'x') { d.remove(); return; } if (a === 'ok') { ok(); return; }
    if (a === 'ign') { const LL = L(); LL[l.sig] = Object.assign({}, LL[l.sig], { kind: 'zanemari' }); done(); return; }
    if (a === 'reset') { const LL = L(); delete LL[l.sig]; done(); return; }
    if (a === 'pin') { const t = inp.value.trim(); if (t && t !== String(l.rec == null ? '' : l.rec)) { const LL = L(); LL[l.sig] = Object.assign({}, LL[l.sig], { value: t }); } d.remove(); T.pin = { sig: l.sig, name, pts: [] }; app.status('📌 Kota ' + name + ': dodirni prvo mjesto – zid ili rub otvora.'); app.redraw(); } });
}
function inReg(p) { const r = T.region; return !r || (p.x >= r.x0 && p.x <= r.x1 && p.y >= r.y0 && p.y <= r.y1); }
function drawRegion(ctx, s) { if (T.regPick && T.regPick.length) { ctx.save(); ctx.fillStyle = '#0ea5e9'; const q = T.regPick[0]; ctx.beginPath(); ctx.arc(q.x, q.y, 7 / s, 0, 7); ctx.fill(); ctx.restore(); }
  const r = T.region; if (!r) return; ctx.save(); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); const B = 1e6; ctx.rect(-B, -B, 2 * B, 2 * B); ctx.rect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0); ctx.fill('evenodd'); ctx.strokeStyle = '#0ea5e9'; ctx.lineWidth = 2 / s; ctx.setLineDash([8 / s, 5 / s]); ctx.strokeRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0); ctx.restore(); }
function textBox(l) { const m = /^t:(-?\d+),(-?\d+):(.*)$/.exec(l.sig || ''); if (!m) return rawBox(l); const x = +m[1], y = +m[2], n = Math.max(1, m[3].length); return { x0: x - 4, y0: y - 22, x1: x + n * 10 + 4, y1: y + 6 }; }
function spanSegs(l) { const m = T.m, sp = l.span, out = []; if (!sp) return out;
  const one = (ax, i, j, c) => { const A = m.axes[ax], a = A && A[i], b = A && A[j]; if (!a || !b) return; out.push([toRaw(ax === 'X' ? { x: a.s, y: c } : { x: c, y: a.s }), toRaw(ax === 'X' ? { x: b.s, y: c } : { x: c, y: b.s })]); };
  if (sp.ax && sp.i != null && sp.j != null) one(sp.ax, sp.i, sp.j, sp.ax === 'X' ? l.cy : l.cx);
  else if (sp.room && sp.h && sp.v) { if (sp.h.ax) one(sp.h.ax, sp.h.i, sp.h.j, sp.h.ax === 'X' ? l.cy : l.cx); if (sp.v.ax) one(sp.v.ax, sp.v.i, sp.v.j, sp.v.ax === 'X' ? l.cy : l.cx); }
  return out; }
function drawFlash(ctx, s) {
  if (!T.flash || !T.m || Date.now() > T.flash.until || !app.visible('kote')) return; ctx.save(); ctx.lineCap = 'round';
  for (const l of T.m.labels) { if (!T.flash.sigs.has(l.sig)) continue; const st = labelState(l), segs = spanSegs(l), b = l.src === 'text' ? textBox(l) : rawBox(l), cx0 = (b.x0 + b.x1) / 2, cy0 = (b.y0 + b.y1) / 2;
    const want = l.info && (l.info.kind === 'mjera' || l.info.kind === 'udaljenost'); let msg = '';
    if (segs.length) { for (const [P0, P1] of segs) { const ux = P1.x - P0.x, uy = P1.y - P0.y, L = Math.hypot(ux, uy) || 1, tk = 9 / s, nx = -uy / L * tk, ny = ux / L * tk;
        ctx.globalAlpha = 0.5; ctx.strokeStyle = '#facc15'; ctx.lineWidth = 9 / s; ctx.beginPath(); ctx.moveTo(P0.x, P0.y); ctx.lineTo(P1.x, P1.y); ctx.stroke();
        ctx.globalAlpha = 1; ctx.strokeStyle = '#a16207'; ctx.lineWidth = 2 / s; ctx.beginPath(); ctx.moveTo(P0.x + nx, P0.y + ny); ctx.lineTo(P0.x - nx, P0.y - ny); ctx.moveTo(P1.x + nx, P1.y + ny); ctx.lineTo(P1.x - nx, P1.y - ny); ctx.stroke(); }
      msg = '✓ ' + spanText(l); }
    else if (l.span && (l.span.off || l.span.nrel)) msg = '✓ udaljenost do otvora';
    else if (want || st.mark) { ctx.globalAlpha = 0.9; ctx.strokeStyle = '#dc2626'; ctx.lineWidth = 2 / s; ctx.setLineDash([6 / s, 4 / s]); ctx.strokeRect(b.x0 - 4 / s, b.y0 - 4 / s, b.x1 - b.x0 + 8 / s, b.y1 - b.y0 + 8 / s); ctx.setLineDash([]); msg = '⚠ ne znam što mjeri – dodirni broj za 📌'; }
    if (msg) { const fs = 12 / s, pad = 4 / s; ctx.font = '700 ' + fs + 'px Arial'; ctx.textBaseline = 'middle'; const w = ctx.measureText(msg).width + 2 * pad, h = fs + 2 * pad, x = cx0 - w / 2, y = b.y1 + 6 / s;
      ctx.globalAlpha = 0.95; ctx.fillStyle = msg[0] === '⚠' ? '#fef2f2' : '#fefce8'; ctx.strokeStyle = msg[0] === '⚠' ? '#dc2626' : '#a16207'; ctx.lineWidth = 1.2 / s; rr(ctx, x, y, w, h, 4 / s); ctx.fill(); ctx.stroke(); ctx.globalAlpha = 1; ctx.fillStyle = msg[0] === '⚠' ? '#b91c1c' : '#713f12'; ctx.fillText(msg, x + pad, y + h / 2 + 0.5 / s); }
    if (l.src === 'text') T.hits.push({ x0: b.x0 - 6 / s, y0: b.y0 - 6 / s, x1: b.x1 + 6 / s, y1: b.y1 + 6 / s, l }); }
  ctx.restore(); }
/* u 🔗 Veze i upisani (tipkani) brojevi se mogu dodirnuti za ispravak / 📌 */
function textHits(s) { if (!T.links || !T.m || !app.visible('kote')) return; for (const l of T.m.labels) if (l.src === 'text' && !l.syn0) { const b = textBox(l); T.hits.push({ x0: b.x0 - 4 / s, y0: b.y0 - 4 / s, x1: b.x1 + 4 / s, y1: b.y1 + 4 / s, l }); } }
function drawPinPts(ctx, s) { if (!T.pin) return; ctx.save(); ctx.fillStyle = '#f97316'; for (const p of T.pin.pts) { ctx.beginPath(); ctx.arc(p.x, p.y, 7 / s, 0, 7); ctx.fill(); } ctx.restore(); }
/* 🔗 veze: uz svaku kotu crta onoga što program misli da mjeri */
function drawLinks(ctx, s) {
  if (!T.links || !T.m || !app.visible('kote')) return; const m = T.m; computeCrowd();
  ctx.save(); ctx.lineCap = 'round';
  const seg = (ax, i, j, c, col) => { const A = m.axes[ax], a = A[i], b = A[j]; if (!a || !b) return; const p0 = ax === 'X' ? { x: a.s, y: c } : { x: c, y: a.s }, p1 = ax === 'X' ? { x: b.s, y: c } : { x: c, y: b.s }, P0 = toRaw(p0), P1 = toRaw(p1), tk = 6 / s, ux = P1.x - P0.x, uy = P1.y - P0.y, L = Math.hypot(ux, uy) || 1, nx = -uy / L * tk, ny = ux / L * tk;
    ctx.strokeStyle = col; ctx.globalAlpha = 0.8; ctx.lineWidth = 2.2 / s; ctx.beginPath(); ctx.moveTo(P0.x, P0.y); ctx.lineTo(P1.x, P1.y); ctx.moveTo(P0.x + nx, P0.y + ny); ctx.lineTo(P0.x - nx, P0.y - ny); ctx.moveTo(P1.x + nx, P1.y + ny); ctx.lineTo(P1.x - nx, P1.y - ny); ctx.stroke(); };
  for (const l of m.labels) { if (l.chevOnly || l.tiny) continue; const st = labelState(l), sp = l.span, col = st.mark === '?' ? '#dc2626' : st.mark === '!' ? '#ea580c' : '#16a34a';
    if (sp && sp.ax && sp.i != null && sp.j != null) seg(sp.ax, sp.i, sp.j, sp.ax === 'X' ? l.cy : l.cx, sp.pin ? '#2563eb' : col);
    else if (sp && sp.room && sp.h && sp.v) { if (sp.h.ax) seg(sp.h.ax, sp.h.i, sp.h.j, sp.h.ax === 'X' ? l.cy : l.cx, col); if (sp.v.ax) seg(sp.v.ax, sp.v.i, sp.v.j, sp.v.ax === 'X' ? l.cy : l.cx, col); }
    else if (!sp && l.info && (l.info.kind === 'mjera' || l.info.kind === 'udaljenost') && !(T.st && T.st.decisions && T.st.decisions[l.sig] === 'ignore')) { const b = rawBox(l); /* v2.37: tanki puni krug umjesto debelog crtkanog */ ctx.globalAlpha = 0.55; ctx.strokeStyle = '#dc2626'; ctx.setLineDash([]); ctx.lineWidth = 1.2 / s; ctx.beginPath(); ctx.arc((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, Math.max(b.x1 - b.x0, b.y1 - b.y0) / 2 + 8 / s, 0, 7); ctx.stroke(); } }
  // natpisi otvora (š/v): crtica do otvora kojem su pridruženi
  for (const o of (T.B && T.B.ops) || []) { const l = o.label, w = m.walls[o.wall]; if (!l || !w) continue; const mid = (o.s0 + o.s1) / 2, P = toRaw(w.o === 'H' ? { x: mid, y: w.c } : { x: w.c, y: mid }), Q = toRaw({ x: l.cx, y: l.cy });
    ctx.globalAlpha = 0.85; ctx.strokeStyle = '#0891b2'; ctx.lineWidth = 2 / s; ctx.setLineDash([4 / s, 3 / s]); ctx.beginPath(); ctx.moveTo(Q.x, Q.y); ctx.lineTo(P.x, P.y); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = '#0891b2'; ctx.beginPath(); ctx.arc(P.x, P.y, 5 / s, 0, 7); ctx.fill(); }
  // kote preblizu zidu ili drugoj koti
  ctx.globalAlpha = 1; ctx.strokeStyle = '#b45309'; ctx.lineWidth = 1.6 / s; ctx.setLineDash([3 / s, 3 / s]); for (const b of T.crowd.list) ctx.strokeRect(b.x0 - 4 / s, b.y0 - 4 / s, b.x1 - b.x0 + 8 / s, b.y1 - b.y0 + 8 / s); ctx.setLineDash([]);
  ctx.restore();
}
function computeCrowd() {
  if (T.crowd && T.crowd.sig === T.sig && T.crowd.m === T.m) return; const list = [], floor = app.currentFloor(), segs = [];
  for (const o of floor.items || []) if (o.layer === 'nacrt' && o.pts && o.pts.length > 1) for (let k = 1; k < o.pts.length; k += 1) segs.push([o.pts[k - 1], o.pts[k]]);
  const boxes = T.m.labels.filter(l => l.src === 'ink' && !l.chevOnly && !l.tiny).map(l => ({ l, b: rawBox(l) }));
  const hitSeg = (b, a, c) => { const x0 = b.x0, x1 = b.x1, y0 = b.y0, y1 = b.y1; if (Math.max(a.x, c.x) < x0 || Math.min(a.x, c.x) > x1 || Math.max(a.y, c.y) < y0 || Math.min(a.y, c.y) > y1) return false; for (let t = 0; t <= 1; t += 0.1) { const x = a.x + (c.x - a.x) * t, y = a.y + (c.y - a.y) * t; if (x > x0 && x < x1 && y > y0 && y < y1) return true; } return false; };
  for (const { b } of boxes) { const w = b.x1 - b.x0, h = b.y1 - b.y0, sb = { x0: b.x0 + w * 0.12, x1: b.x1 - w * 0.12, y0: b.y0 + h * 0.12, y1: b.y1 - h * 0.12 };
    let bad = segs.some(([a, c]) => hitSeg(sb, a, c));
    if (!bad) bad = boxes.some(o => o.b !== b && Math.min(o.b.x1, b.x1) - Math.max(o.b.x0, b.x0) > 0.3 * Math.min(w, o.b.x1 - o.b.x0) && Math.min(o.b.y1, b.y1) - Math.max(o.b.y0, b.y0) > 0.3 * Math.min(h, o.b.y1 - o.b.y0));
    if (bad) list.push(b); }
  T.crowd = { sig: T.sig, m: T.m, list };
}

/* ---------- Što nedostaje? ---------- */
function collectMissing(silent) {
  analyzeNow(); if (!T.m) { if (!silent) toast('Nema dovoljno za provjeru: treba nacrtati zidove (Nacrt) i upisati kote.'); return null; } /* v2.33: bez prozora koji zaustavlja aplikaciju; brojač gore pita tiho */
  const m = T.m, out = [], seen = new Set(), add = (p, text, kind) => { const k = kind + ':' + Math.round(p.x / 8) + ':' + Math.round(p.y / 8); if (seen.has(k)) return; seen.add(k); out.push({ p: toRaw(p), text, kind }); };
  for (const l of m.labels) { if (l.src !== 'ink' || l.chevOnly || l.tiny) continue; const st = labelState(l), c = { x: l.cx, y: l.cy };
    if (st.mark === '?') add(c, 'Kota #' + l.n + ': broj nije pročitan – upiši ga ili zanemari.', 'kota');
    else if (st.mark === '!') add(c, 'Kota #' + l.n + ' (' + st.val + '): ne zna se kojem zidu pripada.', 'kota'); }
  // simulacija pitanja s procjenama da se nađu svi nedostaci (ništa se ne sprema)
  const st = JSON.parse(JSON.stringify(T.st)); st.settings = T.st.settings; let q, n = 0;
  while (n++ < 80) { try { q = C.nextQuestion(m, st); } catch (e) { break; } if (!q) break;
    if (q.type === 'gap') { const p = gapPoint(q); add(p, (q.ax === 'X' ? 'Vodoravni' : 'Okomiti') + ' razmak između zidova nije izmjeren (procjena ' + C.fmt(q.est) + ' cm).', 'gap'); st.answers[q.key] = { ax: q.ax, si: q.si, sj: q.sj, value: q.est, est: true }; }
    else if (q.type === 'viol') { add({ x: q.label.cx, y: q.label.cy }, q.text + (q.should > 0 ? ' Prema ostalima oko ' + C.fmt(q.should, 0) + ' cm' : '') + ' – izmjeri ponovno.', 'viol'); st.decisions[q.key] = 'accept'; }
    else if (q.type === 'od') { add({ x: q.label.cx, y: q.label.cy }, q.text, 'viol'); st.offPick[q.key] = 'avg'; }
    else if (q.type === 'ow') { const w = m.walls[q.op.wall], u = (q.op.s0 + q.op.s1) / 2; add(w.o === 'H' ? { x: u, y: w.c } : { x: w.c, y: u }, q.text, 'otvor'); st.openings[q.key] = { w: q.est, est: true }; }
    else if (q.type === 'nd' || q.type === 'nk') { const nn = q.nis, u = (nn.s0 + nn.s1) / 2; add(nn.o === 'H' ? { x: u, y: nn.cW } : { x: nn.cW, y: u }, q.type === 'nd' ? q.text : 'Zub u zidu: niša ili zadebljanje? (odlučuje se u uredu)', 'nisa'); if (q.type === 'nd') st.niches[q.key] = { d: q.est, est: true }; else st.nicheKind[q.key] = nn.kind; }
    else if (q.type === 'st') { const S = q.stair, a = (S.a0 + S.a1) / 2, c = (S.c0 + S.c1) / 2; const miss = [!S.n ? 'broj visina' : null, !S.L ? 'duljina kraka' : null, !S.w ? 'širina' : null].filter(Boolean); add(S.o === 'H' ? { x: a, y: c } : { x: c, y: a }, 'Stubište: ' + (miss.length ? 'nedostaje ' + miss.join(', ') : 'provjeri podatke') + ' (n=… uz krak).', 'stube'); st.stairs[q.key] = { n: q.est.n, L: q.est.L, w: q.est.w, dir: S.dir || 1, est: true }; }
    else break; }
  // v1.36: za legalizaciju i energetski certifikat još i visine otvora, parapeti i visina etaže
  const vr = (window.projectInfo && window.projectInfo.vrsta) || [];
  if (Array.isArray(vr) && (vr.includes('legalizacija') || vr.includes('energetski'))) {
    const floor = app.currentFloor(), EO = (floor.energija && floor.energija.otvori) || {}; let B2 = null; try { B2 = C.buildConstraints(m, st); } catch (e) { }
    for (const o of (B2 && B2.ops) || []) { if (o.type === 'prolaz' && !o.arc) continue; const w = m.walls[o.wall]; if (!w) continue;
      const ov = EO[o.key] || {}, hasH = o.h > 0 || num0(ov.h) > 0, isWin = o.type === 'prozor', hasP = o.p != null || (ov.p != null && ov.p !== '');
      const defP = window.projectEnergija && window.projectEnergija.defaults && window.projectEnergija.defaults.pProzor, needP = vr.includes('legalizacija') && !(defP != null && defP !== ''); /* parapet treba samo za pročelja (legalizacija); energetici treba samo površina */
      const miss = [!hasH ? 'visina' : null, isWin && !hasP && needP ? 'parapet' : null].filter(Boolean); if (!miss.length) continue;
      const u = (o.s0 + o.s1) / 2; add(w.o === 'H' ? { x: u, y: w.c } : { x: w.c, y: u }, (isWin ? 'Prozor' : o.type === 'vrata' ? 'Vrata' : 'Otvor') + (o.w ? ' ' + C.fmt(o.w) : '') + ': nedostaje ' + miss.join(' i ') + ' (upiši uz otvor npr. ' + (isWin ? '120/140 p=90' : '90/205') + ').', 'otvor'); }
    const hasRoomH = m.labels.some(l => { const t = l.text != null ? l.text : l.rec; try { return t && C.parseLabel(String(t)).kind === 'visina'; } catch (e) { return false; } });
    if (!hasRoomH && !(floor.energija && num0(floor.energija.h) > 0)) { const bb = C.bbox(m.sk.nacrt.flat()); add({ x: (bb.x0 + bb.x1) / 2, y: (bb.y0 + bb.y1) / 2 }, 'Svijetla visina etaže nije upisana – napiši h=… (cm) u barem jednu prostoriju.', 'gap'); }
  }
  for (const b of blkMissing()) out.push({ p: b.p, text: b.text, kind: 'otvor' });
  return out;
}
function num0(v) { const x = parseFloat(String(v == null ? '' : v).replace(',', '.')); return Number.isFinite(x) ? x : 0; }
function gapPoint(q) {
  const m = T.m, o = q.ax === 'X' ? 'V' : 'H', wi = m.walls.filter(w => w.o === o && Math.abs(w.c - q.si) < 1), wj = m.walls.filter(w => w.o === o && Math.abs(w.c - q.sj) < 1);
  let best = null; for (const a of wi) for (const b of wj) { const lo = Math.max(a.e0, b.e0), hi = Math.min(a.e1, b.e1); if (hi > lo && (!best || hi - lo > best.hi - best.lo)) best = { lo, hi }; }
  /* v2.62: zidovi se ne preklapaju (npr. dva dijela pročelja skoro u istoj liniji) – oznaka između njihovih najbližih krajeva, ne na sredini crteža */
  let near = null; if (!best) for (const a of wi) for (const b of wj) { const g = Math.max(a.e0, b.e0) - Math.min(a.e1, b.e1), at = a.e1 <= b.e0 ? (a.e1 + b.e0) / 2 : b.e1 <= a.e0 ? (b.e1 + a.e0) / 2 : (Math.max(a.e0, b.e0) + Math.min(a.e1, b.e1)) / 2; if (!near || g < near.g) near = { g, at }; }
  if (!best && !near) { const one = wi.concat(wj).sort((a, b) => (b.e1 - b.e0) - (a.e1 - a.e0))[0]; if (one) near = { at: (one.e0 + one.e1) / 2 }; } /* zid samo s jedne strane – oznaka uz njega */
  const all = C.bbox(m.sk.nacrt.flat()), v = best ? (best.lo + best.hi) / 2 : near ? near.at : (q.ax === 'X' ? (all.y0 + all.y1) / 2 : (all.x0 + all.x1) / 2), u = (q.si + q.sj) / 2;
  return q.ax === 'X' ? { x: u, y: v } : { x: v, y: u };
}
/* v1.53: popis za energetski certifikat prije odlaska s objekta (fotografije, sjever, sustavi, voda) */
function certMissing() {
  if (!isEnergProj()) return [];
  const E = window.projectEnergija || {}, sus = E.sustavi || {}, fs = app.floors(), photos = fs.flatMap(f => (f.items || []).filter(o => o.type === 'photo')), cnt = k => photos.filter(o => o.cert === k).length, out = [];
  if (!cnt('naslovna')) out.push('Fotografija cijele zgrade (označi kao „Naslovna”).');
  const pr = photos.filter(o => o.cert === 'procelje'), st = [...new Set(pr.map(o => o.strana).filter(Boolean))];
  if (pr.length < 2) out.push('Fotografije pročelja: ' + (pr.length ? 'samo ' + pr.length + '.' : 'nema ih.') + ' Uslikaj sve strane i označi „Pročelje” + stranu.');
  const bez = pr.filter(o => !o.strana).map(o => o.n); if (bez.length) out.push('Pročelje bez strane svijeta: foto ' + bez.join(', ') + '.');
  if (pr.length >= 2 && st.length) out.push('Pročelja uslikana sa strana: ' + st.join(', ') + ' – provjeri jesu li sve.');
  if (!cnt('stolarija')) out.push('Fotografija prozora izbliza (okvir i staklo) – „Stolarija”.');
  if (!cnt('kotao')) out.push('Fotografija kotla / izvora grijanja.');
  if (!cnt('plocica')) out.push('Fotografija natpisne pločice kotla (aplikacija pročita snagu i godinu).');
  const hl = sus.hladjenje && sus.hladjenje.vrsta; if (hl && hl !== 'Nema' && !cnt('klima')) out.push('Fotografija klima uređaja.');
  const north = E.north != null || fs.some(f => (f.tlocrt && f.tlocrt.north != null) || (f.energija && f.energija.north != null)); if (!north) out.push('Sjever nije zadan (Energetika → Etaže).');
  if (!(sus.grijanje && sus.grijanje.vrsta)) out.push('Vrsta grijanja (Energetika → Sustavi).'); if (!(sus.ptv && sus.ptv.vrsta)) out.push('Priprema tople vode (Energetika → Sustavi).'); if (!hl) out.push('Hlađenje: ima li klime? (Energetika → Sustavi).');
  const D = E.defaults || {}; if (!D.okvir || !D.staklo) out.push('Stolarija: okvir i vrsta stakla (Energetika → Otvori).');
  if (!((E.sastav || {}).zid_vanjski || {}).mat) out.push('Materijal vanjskog zida i izolacija (Energetika → Konstrukcije).');
  if (!(E.voda && E.voda.ukucana > 0)) out.push('Broj ukućana (Energetika → Sustavi → Voda).');
  if (!(E.voda && ['wc', 'umivaonik', 'sudoper', 'kada'].some(k => E.voda[k] > 0))) out.push('Izljevna mjesta: WC, umivaonici, sudoperi, kade/tuševi (Energetika → Sustavi → Voda).');
  return out;
}
function showMissing() {
  const all = collectMissing(); if (!all) return; const list = T.region ? all.filter(it => inReg(it.p)) : all; T.missing = list; app.redraw();
  let p = $('terenPanel'); if (!p) { p = document.createElement('div'); p.id = 'terenPanel'; document.body.appendChild(p); }
  p.innerHTML = '<div class="tp-head"><b>' + (list.length ? 'Što nedostaje (' + list.length + (T.region ? ' u dijelu, ukupno ' + all.length : '') + ')' : (T.region ? 'U ovom dijelu je sve izmjereno ✓' : 'Sve potrebno je izmjereno ✓')) + '</b><button id="tpReg">' + (T.region ? 'Cijeli crtež' : '◫ Samo dio') + '</button><button id="tpRe">Osvježi</button><button id="tpClose">✕</button></div>' +
    (list.length ? '<ol>' + list.map((it, i) => '<li data-i="' + i + '"><span class="tp-n tp-' + it.kind + '">' + (i + 1) + '</span>' + esc(it.text) + '</li>').join('') + '</ol>' : '<p>Za svaki zid i otvor postoji mjera. Brojeve ipak provjeri u oblačićima.</p>') +
    '<p class="tp-note">Crveni brojevi na skici pokazuju mjesto. Dodirni stavku za skok na nju.</p>' + (() => { const cm = certMissing(); return isEnergProj() ? '<b>Za energetski certifikat' + (cm.length ? ' (' + cm.length + ')' : ' ✓') + '</b>' + (cm.length ? '<ul class="tp-cert">' + cm.map(t => '<li>' + esc(t) + '</li>').join('') + '</ul>' : '<p>Fotografije i podaci za certifikat su na broju.</p>') : ''; })();
  p.hidden = false;
  $('tpClose').onclick = () => { p.hidden = true; T.missing = null; T.region = null; T.regPick = null; app.status(''); app.redraw(); };
  $('tpRe').onclick = showMissing;
  $('tpReg').onclick = () => { if (T.region) { T.region = null; showMissing(); app.redraw(); return; } T.regPick = []; p.hidden = true; app.status('◫ Dio crteža: dodirni dva suprotna kuta pravokutnika oko dijela koji provjeravaš.'); };
  p.querySelectorAll('li').forEach(li => li.onclick = () => { const it = list[+li.dataset.i]; app.centerOn(it.p); T.flash = it; setTimeout(() => { T.flash = null; app.redraw(); }, 1500); });
}
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function drawMissing(ctx, s) {
  if (!T.missing) return; const r = 11 / s; ctx.save(); ctx.font = '700 ' + (12 / s) + 'px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  T.missing.forEach((it, i) => { const big = T.flash === it; ctx.fillStyle = big ? '#f97316' : '#dc2626'; ctx.beginPath(); ctx.arc(it.p.x, it.p.y, big ? r * 1.6 : r, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillText(String(i + 1), it.p.x, it.p.y + 0.5 / s); });
  ctx.restore();
}

/* ---------- fotografije ---------- */
const FOTO_LS = 'izmjera-foto-';
window.IzmjeraFoto = {
  pending: null,
  get(id) { try { if (window.AndroidApp && window.AndroidApp.loadPhoto) { const d = window.AndroidApp.loadPhoto(id); if (d) return d; } } catch (e) { } return store.get(FOTO_LS + id, null); },
  done(id, ok, msg) { const p = this.pending; this.pending = null; if (!ok) { if (msg) alert(msg); return; } if (p && p.id === id) { if (p.cb) p.cb(id); else placePhoto(p); } },
  list(floor) { return (floor.items || []).filter(o => o.type === 'photo'); }
};
/* v1.53: oznaka fotografije za certifikat (ide na pravo mjesto u izvješću) */
const FOTO_TAGS = [['naslovna', 'Naslovna'], ['procelje', 'Pročelje'], ['stolarija', 'Stolarija'], ['kotao', 'Kotao / grijanje'], ['plocica', 'Pločica kotla'], ['klima', 'Klima'], ['ptv', 'Bojler / PTV'], ['brojilo', 'Brojilo'], ['ostalo', 'Ostalo']];
const STRANE8 = ['S', 'SI', 'I', 'JI', 'J', 'JZ', 'Z', 'SZ'];
window.IzmjeraFoto.TAGS = FOTO_TAGS;
const isEnergProj = () => { const v = (window.projectInfo && window.projectInfo.vrsta) || []; return Array.isArray(v) && v.includes('energetski'); };
/* čitanje natpisne pločice (ML Kit na tabletu) */
window.IzmjeraOcr = { cb: {}, done(id, ok, text) { const f = this.cb[id]; delete this.cb[id]; if (f) f(ok, text); },
  run(photoId) { return new Promise((res, rej) => { if (!(window.AndroidApp && window.AndroidApp.recognizeText)) { rej(Error('Čitanje teksta radi samo u aplikaciji na tabletu.')); return; } const id = 'o' + Date.now(); this.cb[id] = (ok, t) => ok ? res(t) : rej(Error(t || 'Čitanje nije uspjelo.')); window.AndroidApp.recognizeText(id, photoId); }); } };
const BRANDS = ['Vaillant', 'Viessmann', 'Bosch', 'Junkers', 'Buderus', 'Ariston', 'Immergas', 'Beretta', 'Baxi', 'Protherm', 'Ferroli', 'Wolf', 'Hoval', 'Riello', 'Sime', 'Saunier Duval', 'Chaffoteaux', 'Radiant', 'Fondital', 'Thermona', 'Daikin', 'Mitsubishi', 'LG', 'Samsung', 'Panasonic', 'Toshiba', 'Gorenje', 'Centrometal', 'Tim Sistem', 'Herz', 'Fröling', 'Windhager', 'Kronoterm', 'Nibe', 'Stiebel Eltron', 'Weishaupt', 'Elco', 'Unical', 'Termomont', 'Ekotermo'];
function parsePlocica(text) {
  const t = String(text || ''), r = {}, low = t.toLowerCase();
  const b = BRANDS.find(x => new RegExp('\\b' + x.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b').test(low)); if (b) { r.proizvodjac = b; const line = t.split(/\n/).find(l => l.toLowerCase().includes(b.toLowerCase()) && l.trim().length > b.length + 2); if (line) r.model = line.trim().slice(0, 60); }
  const kw = []; const re = /(\d{1,3}(?:[.,]\d{1,2})?)\s*(?:[-–…]|\.\.)?\s*(\d{1,3}(?:[.,]\d{1,2})?)?\s*kW/gi; let m; while ((m = re.exec(t))) for (const g of [m[1], m[2]]) { const v = g ? parseFloat(g.replace(',', '.')) : NaN; if (v > 0 && v < 1000) kw.push(v); }
  const pl = t.split(/\n/).filter(l => /^\s*(P|Pn|Nennw|Nazivna|Toplinski uč|Heat output)/i.test(l) && /kW/i.test(l)), kwP = []; for (const l of pl) { let q; const r2 = /(\d{1,3}(?:[.,]\d{1,2})?)\s*kW|(\d{1,3}(?:[.,]\d{1,2})?)\s*[-–]/gi; while ((q = r2.exec(l))) { const v = parseFloat((q[1] || q[2]).replace(',', '.')); if (v > 0 && v < 1000) kwP.push(v); } }
  if (kwP.length) r.snaga = Math.max(...kwP); else if (kw.length) r.snaga = Math.max(...kw);
  const yNow = new Date().getFullYear(), ys = (t.match(/\b(19[7-9]\d|20[0-4]\d)\b/g) || []).map(Number).filter(y => y <= yNow); if (ys.length) r.god = Math.max(...ys);
  return r;
}
window.IzmjeraFoto.parsePlocica = parsePlocica;
function fotoTagHtml(o) { return '<div class="tp-lab">Za certifikat</div><div class="tp-row" id="tpTags">' + FOTO_TAGS.map(([k, n]) => '<button data-tag="' + k + '" style="' + (o.cert === k ? 'background:#1e40af;color:#fff' : '') + '">' + n + '</button>').join('') + '</div>' +
  '<div class="tp-row" id="tpStr" style="display:' + (o.cert === 'procelje' ? 'flex' : 'none') + '">' + STRANE8.map(k => '<button data-str="' + k + '" style="min-width:48px;' + (o.strana === k ? 'background:#1e40af;color:#fff' : '') + '">' + k + '</button>').join('') + '</div>' +
  '<div class="tp-row" id="tpOcr"' + (o.cert === 'plocica' ? '' : ' hidden') + '><button data-ocr="1">📖 Pročitaj pločicu</button></div>'; }
function bindFotoTags(d, o) {
  const paint = (sel, key, val) => d.querySelectorAll(sel).forEach(x => { const on = x.dataset[key] === val; x.style.background = on ? '#1e40af' : ''; x.style.color = on ? '#fff' : ''; });
  d.querySelectorAll('[data-tag]').forEach(b => b.onclick = () => { o.cert = o.cert === b.dataset.tag ? '' : b.dataset.tag; paint('[data-tag]', 'tag', o.cert); d.querySelector('#tpStr').style.display = o.cert === 'procelje' ? 'flex' : 'none'; d.querySelector('#tpOcr').style.display = o.cert === 'plocica' ? 'flex' : 'none'; app.save(); });
  d.querySelectorAll('[data-str]').forEach(b => b.onclick = () => { o.strana = o.strana === b.dataset.str ? '' : b.dataset.str; paint('[data-str]', 'str', o.strana); app.save(); });
  const ob = d.querySelector('[data-ocr]'); if (ob) ob.onclick = async () => { ob.disabled = true; ob.textContent = 'Čitam…';
    try { const txt = await window.IzmjeraOcr.run(o.id), r = parsePlocica(txt), E = window.projectEnergija = window.projectEnergija || {}; E.sustavi = E.sustavi || {}; const g = E.sustavi.grijanje = E.sustavi.grijanje || {};
      const lines = [r.proizvodjac ? 'Proizvođač: ' + r.proizvodjac : null, r.model ? 'Oznaka: ' + r.model : null, r.snaga ? 'Snaga: ' + r.snaga + ' kW' : null, r.god ? 'Godina: ' + r.god : null].filter(Boolean);
      if (!lines.length) alert('Na pločici nisam prepoznao snagu, godinu ni proizvođača.\n\nPročitani tekst:\n' + String(txt).slice(0, 600));
      else if (confirm('Pročitano s pločice:\n' + lines.join('\n') + '\n\nUpisati u Energetika → Sustavi (grijanje)?')) { if (r.snaga) g.snaga = r.snaga; if (r.god) g.god = r.god; const nap = [r.proizvodjac, r.model && r.model !== r.proizvodjac ? r.model : ''].filter(Boolean).join(' – '); if (nap && !(g.nap || '').includes(nap)) g.nap = [g.nap, nap].filter(Boolean).join('; '); if (!o.note) o.note = lines.join(', '); app.save(); }
    } catch (e) { alert(e.message || e); }
    ob.disabled = false; ob.textContent = '📖 Pročitaj pločicu'; };
}
function newId() { return 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function placePhoto(p) { const items = app.items(), n = 1 + Math.max(0, ...items.filter(o => o.type === 'photo').map(o => o.n || 0)); app.commit({ type: 'photo', layer: 'opisi', x: p.x, y: p.y, id: p.id, n, note: '' }); if (isEnergProj()) { const o = app.items().find(q => q.type === 'photo' && q.id === p.id); if (o) setTimeout(() => viewPhoto(o), 60); } }
function askPhoto(p) {
  const id = newId(), dlg = sheet('<b>Fotografija na ovom mjestu</b><div class="tp-row"><button data-m="camera">📷 Kamera</button><button data-m="gallery">🖼 Galerija</button><button data-m="x">Odustani</button></div>');
  dlg.querySelectorAll('button').forEach(b => b.onclick = () => { dlg.remove(); const mode = b.dataset.m; if (mode === 'x') return;
    if (window.AndroidApp && window.AndroidApp.takePhoto) { window.IzmjeraFoto.pending = { id, x: p.x, y: p.y }; window.AndroidApp.takePhoto(id, mode); return; }
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; if (mode === 'camera') inp.setAttribute('capture', 'environment');
    inp.onchange = async () => { const f = inp.files && inp.files[0]; if (!f) return; try { const d = await window.IzmjeraPdf.imageToJpeg(f); store.set(FOTO_LS + id, d); placePhoto({ id, x: p.x, y: p.y }); } catch (e) { alert(e.message || e); } }; inp.click(); });
}
function sheet(html) { const d = document.createElement('div'); d.className = 'tp-sheet'; d.innerHTML = '<div class="tp-card">' + html + '</div>'; const t0 = Date.now(); d.addEventListener('click', e => { if (e.target === d && Date.now() - t0 > 450) d.remove(); }); d.addEventListener('click', e => { if (Date.now() - t0 < 400) { e.stopPropagation(); e.preventDefault(); } }, true); /* v2.38: izbornik se otvori pod olovkom – isti dodir ne smije odmah odabrati gumb */ /* kratki dodir: „click” od istog dodira ne smije odmah zatvoriti izbornik */ document.body.appendChild(d); return d; }
function drawPins(ctx, s) {
  T.pinHits = []; if (!app.visible('opisi')) return; const r = 11 / s; ctx.save(); ctx.font = '700 ' + (11 / s) + 'px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const o of app.items()) { if (o.type !== 'photo') continue; ctx.fillStyle = T.moving === o ? '#2563eb' : '#f97316'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 / s;
    ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(o.x - r * 0.6, o.y - r * 1.2); ctx.arc(o.x, o.y - r * 1.8, r, Math.PI * 0.8, Math.PI * 2.2); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.fillText(String(o.n || '•'), o.x, o.y - r * 1.8 + 0.5 / s); T.pinHits.push({ x0: o.x - r * 1.3, x1: o.x + r * 1.3, y0: o.y - r * 3, y1: o.y + r * 0.3, o }); }
  ctx.restore();
}
function viewPhoto(o) {
  const data = window.IzmjeraFoto.get(o.id);
  const d = sheet('<div class="tp-head"><b>Foto ' + (o.n || '') + '</b><button data-a="x">✕</button></div>' + (data ? '<img class="tp-img" src="' + data + '">' : '<p>Slika nije pronađena na ovom uređaju.</p>') +
    fotoTagHtml(o) + '<label class="tp-lab">Napomena<input id="tpNote" value="' + esc(o.note || '') + '" placeholder="npr. brojilo, vlaga, detalj prozora"></label><div class="tp-row"><button data-a="save">Spremi</button><button data-a="move">Premjesti</button><button data-a="del">Izbriši</button></div>');
  bindFotoTags(d, o);
  d.querySelectorAll('button[data-a]').forEach(b => b.onclick = () => { const a = b.dataset.a;
    if (a === 'save') { o.note = $('tpNote').value.trim(); app.save(); }
    if (a === 'move') { T.moving = o; app.redraw(); if (window.IzmjeraApp) setTimeout(() => alert('Dodirni novo mjesto na skici.'), 50); }
    if (a === 'del') { if (!confirm('Izbrisati fotografiju ' + (o.n || '') + ' sa skice?')) return; app.snapshot(); const it = app.items(), i = it.indexOf(o); if (i >= 0) it.splice(i, 1); app.save(); app.redraw(); }
    d.remove(); });
}

/* zidovi za alate na skici (prijelom, prozor, vrata) – i kad još nema nijedne kote */
function geoM() {
  /* samo zidovi nacrtani rukom/linijom – prozori i vrata iz blokova se ne smiju pročitati kao zidovi (inače se sljedeći blok zalijepi na njih) */
  const f = app.currentFloor(), items = (f.items || []).filter(o => !o.blk), key = (f.name || '') + '|' + signature({ items }) + '|' + JSON.stringify((f.tlocrt && f.tlocrt.wallSplit) || []);
  if (T.mGeo && T.geoKey === key) return T.mGeo;
  try { T.mGeo = C.analyze({ name: f.name, items, tlocrt: f.tlocrt }, { splits: (f.tlocrt && f.tlocrt.wallSplit) || [] }); } catch (e) { T.mGeo = null; }
  T.geoKey = key; if (T.mGeo && !T._reat) setTimeout(() => { if (T._reat) return; T._reat = true; try { blkReattachAll(); } catch (e) { } finally { T._reat = false; } }, 0); return T.mGeo;
}
/* v2.20: prozor/vrata čiji je zid obrisan ili pomaknut → sami se premjeste na najbliži usporedni zid (do 3 E) */
function blkReattachAll() { const m = geoM(); if (!m) return; const E = m.E || 10; let n = 0;
  const along = (c, dv) => { let best = null; for (const o of app.items()) { if (o.layer !== 'nacrt' || o.blk || o.type === 'text' || o.type === 'photo' || !Array.isArray(o.pts) || o.pts.length < 2) continue; const P = o.pts;
      for (let i = 1; i < P.length; i++) { const a = P[i - 1], b = P[i], dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy); if (L < 1e-3) continue; if (Math.abs((dx * dv.x + dy * dv.y) / L) < 0.94) continue;
        const t = ((c.x - a.x) * dx + (c.y - a.y) * dy) / (L * L); if (t < 0 || t > 1) continue; const q = { x: a.x + dx * t, y: a.y + dy * t }, d = Math.hypot(c.x - q.x, c.y - q.y); if (!best || d < best.d) best = { d, q }; } } return best; };
  for (const o of app.items().slice()) { const B = o.blk; if (!B || !B.main || !B.c || !B.dv) continue; const h = along(B.c, B.dv); if (!h || h.d < 0.6 * E || h.d > 3 * E) continue; // na crti je, ili nema usporedne crte blizu
    const B2 = Object.assign({}, B); delete B2.main; delete B2.v; delete B2.dW; delete B2.s; delete B2.odP; B2.c = { x: br1(h.q.x), y: br1(h.q.y) }; const W0 = blkWall(B2.c); if (W0) { B2.E = W0.E; B2.e0 = W0.e0; B2.e1 = W0.e1; } blkBuild(B2, false); n++; }
  if (n) { app.save(); T.sig = ''; app.redraw(); toast('🚪 ' + (n === 1 ? 'Otvor je premješten' : n + ' otvora premješteno') + ' na novi zid.'); } }
function toast(msg) { let t = $('izToast'); if (!t) { t = document.createElement('div'); t.id = 'izToast'; t.style.cssText = 'position:fixed;left:50%;bottom:calc(var(--ui2-st,26px) + var(--ui2-qb,78px) + 70px);transform:translateX(-50%);z-index:9999;background:rgba(30,41,59,.88);color:#fff;padding:7px 14px;border-radius:10px;font-size:14px;max-width:50vw;box-shadow:0 2px 8px rgba(0,0,0,.2);pointer-events:none'; document.body.appendChild(t); } t.textContent = msg; t.style.display = 'block'; clearTimeout(t._h); t._h = setTimeout(() => { t.style.display = 'none'; }, 3500); }
/* ---------- blokovi: 🪟 prozor i 🚪 vrata dodirom na zid (crte kao ručno nacrtane; mjere odmah ili kasnije) ---------- */
T.blkMode = null;
const BLK_DEF = { prozor: { w: 120, h: 140 }, vrata: { w: 90, h: 205 } };
function blkLast(t) { try { return Object.assign({}, BLK_DEF[t], JSON.parse(store.get('izmjera-blk-' + t) || '{}')); } catch (e) { return Object.assign({}, BLK_DEF[t]); } }
function blkAsk() { return store.get('izmjera-blk-pitaj') !== '0'; }
function blkScale(B) { if (!T.B && T.m && (app.currentFloor().items || []).some(o => o.layer === 'kote')) { try { T.B = C.buildConstraints(T.m, T.st || stateOf(app.currentFloor())); } catch (e) { } } const s = T.B && T.B.scale; if (s > 0.2 && s < 20) { if (B) B.s = Math.round(s * 1000) / 1000; return s; } if (B && B.s > 0) return B.s; const m = geoM(); return m && m.E > 0 ? 100 / (5.5 * m.E) : 1; } /* cm po jedinici skice (bez kota: procjena iz veličine skice) */
/* nacrtana dužina znaka: prozor kraći od stvarne širine (skica nije u mjerilu), ali dovoljno dug da ga analiza prepozna */
function blkDW(B, W) { if (B.t !== 'prozor') return W; let d = Math.min(W, Math.max(0.6 * W, 2.3 * (B.E || 10))); try { const m = geoM(); if (m && m.D > 0) d = Math.min(d, 0.13 * m.D); } catch (e) { } return d; } /* v2.41: predugačak znak analiza više ne prepoznaje kao prozor (nego kao zub) */
/* slobodni dio zida oko bloka (od spoja do spoja), u jedinicama skice */
function blkSpan(B) { const m = geoM(); if (!m) return Infinity; const th = m.theta || 0, E = m.E, q = C.rotP(B.c, -th), o = Math.abs(C.rotP(B.dv, -th).x) > 0.7 ? 'H' : 'V', uc = o === 'H' ? q.x : q.y, vc = o === 'H' ? q.y : q.x;
  let w = null, bd = 3 * E; for (const x of m.walls) { if (x.view || x.o !== o || uc < x.e0 - E || uc > x.e1 + E) continue; const d = Math.abs(vc - x.c); if (d < bd) { bd = d; w = x; } } if (!w) return Infinity;
  const cand = [w.e0, w.e1]; for (const x of m.walls) { if (x.view || x.o === o || Math.max(Math.abs(x.e0 - w.c), Math.abs(x.e1 - w.c)) < 3 * E) continue; /* kratke crte (stranice nacrtanog prozora) nisu ugao */ if (x.c < w.e0 - E || x.c > w.e1 + E) continue; if (w.c < x.e0 - 1.5 * E || w.c > x.e1 + 1.5 * E) continue; cand.push(x.c); }
  const lo = Math.max(...cand.filter(u => u <= uc), -Infinity), hi = Math.min(...cand.filter(u => u >= uc), Infinity); return Number.isFinite(lo) && Number.isFinite(hi) ? hi - lo - E : Infinity; }
/* širina za crtanje: kad je soba nacrtana većim mjerilom nego ostatak, znak ne smije preko cijelog zida */
function blkWd(B, s) { const W = blkW(B, s); let sp = Infinity; try { sp = blkSpan(B); } catch (e) { } return Math.max(Math.min(W, (B.t === 'vrata' ? 0.85 : 0.7) * sp), Math.min(W, 2.5 * (B.E || 10))); }
/* v2.41: upozorenje kad je upisana širina otvora veća od slobodnog dijela zida */
function blkWideWarn(B) { try { if (!(B && B.w > 0)) return; const s = B.s || blkScale(B), sp = blkSpan(B); if (!(sp > 0 && sp < Infinity && s > 0)) return; const L = Math.round((sp + (geoM() ? geoM().E : 0)) * s); if (B.w > L * 1.05) toast('⚠ ' + (B.t === 'vrata' ? 'Vrata' : 'Prozor') + ' ' + B.w + ' cm – zid je dug samo oko ' + L + ' cm. Provjeri širinu (dodirni ' + (B.t === 'vrata' ? 'vrata' : 'prozor') + ' za ispravak).'); } catch (e) { } }
function blkW(B, s) { return B.w > 0 ? B.w / s : B.wpx > 0 ? B.wpx : BLK_DEF[B.t].w / s; } /* širina na skici: izmjerena, nacrtana potezom ili zadana */
function blkItems(id) { return app.items().filter(o => o.blk && o.blk.id === id); }
function blkMain(id) { return app.items().find(o => o.blk && o.blk.id === id && o.blk.main); }
/* nađi zid ispod dodira (u okviru analize) */
function blkWall(p) {
  const m = geoM(); if (!m) return null; const th = m.theta || 0, q = C.rotP(p, -th), E = m.E; let w = null, bd = Math.max(3 * E, Math.min(36 / app.scale(), 6 * E));
  for (const x of m.walls) { if (x.view) continue; const u = x.o === 'H' ? q.x : q.y, v = x.o === 'H' ? q.y : q.x; if (u < x.e0 - E || u > x.e1 + E) continue; const d = Math.abs(v - x.c); if (d < bd) { bd = d; w = x; } }
  if (!w) return null; const u = w.o === 'H' ? q.x : q.y, v = w.o === 'H' ? q.y : q.x;
  const dv = C.rotP(w.o === 'H' ? { x: 1, y: 0 } : { x: 0, y: 1 }, th), nv = C.rotP(w.o === 'H' ? { x: 0, y: 1 } : { x: 1, y: 0 }, th), c = C.rotP(w.o === 'H' ? { x: u, y: w.c } : { x: w.c, y: u }, th);
  const e0 = C.rotP(w.o === 'H' ? { x: w.e0, y: w.c } : { x: w.c, y: w.e0 }, th), e1 = C.rotP(w.o === 'H' ? { x: w.e1, y: w.c } : { x: w.c, y: w.e1 }, th);
  // točno na nacrtanu crtu (rukom crtani zid nije savršeno ravan ni paralelan s osi analize)
  let c2 = c, dv2 = dv, nv2 = nv; const ns = nearStroke(p, bd); if (ns && Math.abs(ns.d.x * dv.x + ns.d.y * dv.y) > Math.cos(20 * Math.PI / 180)) { const sg = (ns.d.x * dv.x + ns.d.y * dv.y) < 0 ? -1 : 1; c2 = ns.q; dv2 = { x: ns.d.x * sg, y: ns.d.y * sg }; nv2 = { x: -dv2.y, y: dv2.x }; if (nv2.x * nv.x + nv2.y * nv.y < 0) nv2 = { x: -nv2.x, y: -nv2.y }; }
  return { w, c: c2, dv: dv2, nv: nv2, side: v >= w.c ? 1 : -1, E, e0, e1, o: w.o };
}
/* najbliža točka na nacrtanoj crti zida (bez blokova) i smjer te crte */
function nearStroke(p, maxd) { let best = null, bd = maxd;
  for (const o of app.items()) { if (o.layer !== 'nacrt' || o.blk || o.type === 'text' || o.type === 'photo' || !Array.isArray(o.pts) || o.pts.length < 2) continue; const P = o.pts;
    for (let i = 1; i < P.length; i++) { const a = P[i - 1], b = P[i], dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy; if (L2 < 1e-6) continue; let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2; t = Math.max(0, Math.min(1, t)); const q = { x: a.x + dx * t, y: a.y + dy * t }, d = Math.hypot(p.x - q.x, p.y - q.y);
      if (d < bd) { // smjer: s nekoliko susjednih točaka, da drhtaj ruke ne zakrene blok
        const a2 = P[Math.max(0, i - 6)], b2 = P[Math.min(P.length - 1, i + 5)], L = Math.hypot(b2.x - a2.x, b2.y - a2.y) || 1; bd = d; best = { q: { x: Math.round(q.x * 10) / 10, y: Math.round(q.y * 10) / 10 }, d: { x: (b2.x - a2.x) / L, y: (b2.y - a2.y) / L } }; } } }
  return best; }
const vadd = (a, b, k) => ({ x: a.x + b.x * k, y: a.y + b.y * k }), br1 = v => Math.round(v * 10) / 10;
function linePts(a, b) { const n = Math.max(2, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 3)), out = []; for (let i = 0; i <= n; i++) out.push({ x: br1(a.x + (b.x - a.x) * i / n), y: br1(a.y + (b.y - a.y) * i / n) }); return out; }
/* crte bloka iz podataka (središte, smjer zida, normala, širina u jedinicama skice) */
function blkStrokes(B) {
  const s = B.s || blkScale(B), W = blkWd(B, s), E = B.E || 10, P = B.c, dv = B.dv, nv = B.nv, out = [], pen = pts => ({ type: 'pen', layer: 'nacrt', color: BLK_COL, width: 2, pts });
  if (B.t === 'prozor') { const W2 = blkDW(B, W), d = 0.62 * E, a = vadd(vadd(P, dv, -W2 / 2), nv, -d), b = vadd(vadd(P, dv, W2 / 2), nv, -d), c = vadd(vadd(P, dv, W2 / 2), nv, d), e = vadd(vadd(P, dv, -W2 / 2), nv, d);
    out.push(pen([...linePts(a, b), ...linePts(b, c).slice(1), ...linePts(c, e).slice(1), ...linePts(e, a).slice(1)]));
    /* v2.26: fiksno ostakljenje = crta po sredini; staklena opeka = mreža */ if (B.pv === 'fix' || B.pv === 'opeka') out.push(pen(linePts(vadd(P, dv, -W2 / 2), vadd(P, dv, W2 / 2))));
    if (B.pv === 'opeka') { const n = Math.max(3, Math.round(W2 / (1.1 * E))); for (let i = 1; i < n; i++) { const q = vadd(P, dv, -W2 / 2 + W2 * i / n); out.push(pen(linePts(vadd(q, nv, -d), vadd(q, nv, d)))); } }
    return out; }
  if (B.kl) { /* klizna vrata: crtice špaleta, krilo uz zid na strani klizanja, strelica smjera */ const d = 1.0 * E, sw = B.sw || 1, dir = B.hg ? 1 : -1; for (const sg of [-1, 1]) { const q = vadd(P, dv, sg * W / 2), o = pen(linePts(vadd(q, nv, -d), vadd(q, nv, d))); o.width = 3; out.push(o); }
    const v = sw * 0.6 * E, a = vadd(vadd(P, dv, -W / 2), nv, v), b = vadd(vadd(P, dv, W / 2), nv, v), lf = pen(linePts(a, b)); lf.width = 4; out.push(lf);
    const v2 = sw * 1.3 * E, t0 = vadd(vadd(P, dv, -dir * W * 0.3), nv, v2), t1 = vadd(vadd(P, dv, dir * W * 0.3), nv, v2), hd = 0.6 * E; out.push(pen(linePts(t0, t1))); out.push(pen([...linePts(vadd(vadd(t1, dv, -dir * hd), nv, hd * 0.6), t1), ...linePts(t1, vadd(vadd(t1, dv, -dir * hd), nv, -hd * 0.6)).slice(1)])); return out; }
  if (B.bk) { const d = 1.0 * E; for (const sg of [-1, 1]) { const q = vadd(P, dv, sg * W / 2), o = pen(linePts(vadd(q, nv, -d), vadd(q, nv, d))); o.width = 3; out.push(o); } return out; } /* otvor bez krila: samo dvije crtice špaleta */
  // vrata: krilo okomito na zid s jedne strane (šarka), luk do druge strane; dvokrilna = dva krila
  const sw = B.sw || 1, f1 = B.dvo && B.w1 > 0 && B.w1 < B.w ? B.w1 / B.w : 0.5, hF = (Math.abs(dv.x) >= Math.abs(dv.y) ? -dv.x : dv.y) > 0 ? 1 : -1, leafs = B.dvo ? [[hF, W * f1], [-hF, W * (1 - f1)]] : [[B.hg ? 1 : -1, W]]; /* nesimetrična: 1. krilo (prvi broj u 80+40) na strani gdje natpis počinje */
  for (const [hs, L] of leafs) { const hinge = vadd(P, dv, hs * W / 2), tip = vadd(hinge, nv, sw * L), arc = [];
    for (let i = 0; i <= 40; i++) { const a = i / 40 * Math.PI / 2, p = vadd(vadd(hinge, nv, sw * L * Math.cos(a)), dv, -hs * L * Math.sin(a)); arc.push({ x: br1(p.x), y: br1(p.y) }); }
    out.push(pen(linePts(hinge, tip))); out.push(pen(arc)); }
  return out;
}
const BLK_V = 8, BLK_FS = 18, BLK_COL = '#15803d', BLK_LAB = '#166534'; /* natpisi mjera prozora/vrata: veličina i boja; boja crta prozora/vrata */
/* stari natpisi (veći) – jednom preslaži blokove na etaži */
function blkMigrate() { const it = app.items(), ids = new Set(); for (const o of it) if (o.blk && !/^(stube|krovni|otvorp|terasa|greda|prag|stup)$/.test(o.blk.t) && ((o.blk.main && o.blk.v !== BLK_V) || (o.type === 'text' ? o.fs !== BLK_FS || o.color !== BLK_LAB : o.color !== BLK_COL))) ids.add(o.blk.id);
  if (!ids.size) return; for (const id of ids) { const M = blkMain(id); if (M) blkBuild(M.blk, false); } }
function blkText(B) { if (!(B.w > 0)) return ''; let t = (B.dvo && B.w1 > 0 && B.w1 < B.w ? B.w1 + '+' + Math.round((B.w - B.w1) * 10) / 10 : B.w) + (B.h > 0 ? '/' + B.h : ''); if (B.p != null && B.p !== '') t += ' p=' + B.p; return t; }
/* ponovno složi blok (crte + natpis mjera + kota od ugla) */
/* strana prema van (izvan kuće) za natpis prozora: +1 = smjer B.nv, −1 = suprotno, 0 = ne zna se (unutarnji zid) */
function blkOutSign(B) { try { const m = geoM(); if (!m) return 0; const th = m.theta || 0, E = m.E, q = C.rotP(B.c, -th), nr = C.rotP(B.nv, -th), o = Math.abs(C.rotP(B.dv, -th).x) > 0.7 ? 'H' : 'V', uc = o === 'H' ? q.x : q.y, vc = o === 'H' ? q.y : q.x;
  /* gledano točno na mjestu otvora: ima li paralelnog zida s obje strane (unutarnji zid) ili samo s jedne (vanjski) */
  let lo = false, hi = false; for (const x of m.walls) { if (x.view || x.obj || x.o !== o || uc < x.e0 - 0.5 * E || uc > x.e1 + 0.5 * E) continue; if (x.c < vc - 1.5 * E) lo = true; if (x.c > vc + 1.5 * E) hi = true; }
  if (lo === hi) return 0; const outS = lo ? 1 : -1, nc = o === 'H' ? nr.y : nr.x; if (Math.abs(nc) < 0.5) return 0; return Math.sign(nc) === outS ? 1 : -1; } catch (e) { return 0; } }
function blkBuild(B, snap) {
  if (snap) app.snapshot(); const it = app.items();
  for (let i = it.length - 1; i >= 0; i--) if (it[i].blk && it[i].blk.id === B.id) it.splice(i, 1);
  const st = blkStrokes(B), dW0 = blkWd(B, B.s || blkScale(B)); st.forEach((o, i) => { o.blk = i ? (B.bk || B.kl ? { id: B.id, bk: true } : { id: B.id }) : Object.assign({}, B, { main: true, v: BLK_V, dW: Math.round(dW0 * 10) / 10 }); it.push(o); });
  const s = B.s || blkScale(B), W = blkWd(B, s), E = B.E || 10, out = (B.t === 'vrata' ? (blkOutSign(B) || -(B.sw || 1)) : (blkOutSign(B) || B.ls || 1)), dir = Math.abs(B.dv.x) >= Math.abs(B.dv.y) ? 'H' : 'V';
  /* natpis: središte teksta točno na pc (isto kao što ga čita analiza: x + duljina·5, y − 7) */
  const FS = BLK_FS, k = FS / 18, lab = (pc, t, two) => { const o = { type: 'text', layer: 'kote', color: BLK_LAB, fs: FS, x: br1(pc.x - t.length * 5 * k), y: br1(pc.y + 7 * k), text: t, dir, blk: { id: B.id } }; if (two === 'frac') o.frac = true; else if (two) o.two = true; return o; };
  const txt = blkText(B), two = / p=/.test(txt), frac = /\//.test(txt), tl0 = frac ? Math.max(...txt.split(/[\/ ]+/).map(x => x.length)) : two ? Math.max(...txt.split(/ (?=p=)/).map(x => x.length)) : txt.length, half = B.t === 'prozor' || B.bk ? 0.62 * E : 0;
  /* arhitektonski natpis: širina iznad crte, visina ispod, p= ispod toga – sve na sredini otvora, s vanjske strane */
  if (txt) { /* v1.99: kao na nacrtima – crta okomito na otvor (preko zida, van), širina iznad crte, visina ispod; parapet unutra uz zid */
    const pw = /^(\S+?)(?:\/(\S+))?(?:\s|$)/.exec(txt) || [], tlw = Math.max(String(pw[1] || '').length, String(pw[2] || '').length), dOut = half + 12 * k + tlw * 5.5 * k, Cc = vadd(B.c, B.nv, out * dOut), L0 = lab(Cc, txt, null), a0 = vadd(B.c, B.nv, -out * (half + 6 * k)), a1 = vadd(B.c, B.nv, out * (dOut + tlw * 5.5 * k + 6 * k));
    L0.arch = { x0: br1(a0.x), y0: br1(a0.y), x1: br1(a1.x), y1: br1(a1.y) }; it.push(L0); } /* š/v u prvom redu, p= ispod – na sredini prozora */
  if (B.od > 0 && B.end) { const edge = vadd(B.c, B.dv, (B.end > 0 ? 1 : -1) * blkDW(B, W) / 2), endP = B.odP || (B.end > 0 ? B.e1 : B.e0), mid = { x: (edge.x + endP.x) / 2, y: (edge.y + endP.y) / 2 }, ov = txt && Math.abs((mid.x - B.c.x) * B.dv.x + (mid.y - B.c.y) * B.dv.y) < 24 * k + String(B.od).length * 5 * k, L = lab(vadd(mid, B.nv, (ov ? -out : out) * (half + (ov && B.p != null && B.p !== '' ? 40 : 15) * k)), String(B.od)); L.pin = { a: B.odIz && B.odIz.cor ? { x: B.odIz.cor.x, y: B.odIz.cor.y } : { x: br1(endP.x), y: br1(endP.y) }, b: { x: br1(edge.x), y: br1(edge.y) }, outer: !!B.odOut }; if (B.odIz && B.odIz.key) L.pin.izb = { key: B.odIz.key, dim: B.odIz.dim }; it.push(L); }
  app.save(); T.sig = ''; app.redraw();
}
/* brzi izbor smjera vrata: 4 strelice oko vrata (gdje stoji otvoreno krilo); veliki izbornik ostaje za kasnije */
function blkQuick(id) {
  blkQuickClose(); const M = blkMain(id); if (!M) return; const B = M.blk, cv = document.getElementById('canvas') || document.querySelector('canvas'), r = cv.getBoundingClientRect();
  const sc = app.screen(B.c), s0 = app.screen({ x: B.c.x + B.dv.x, y: B.c.y + B.dv.y }), n0 = app.screen({ x: B.c.x + B.nv.x, y: B.c.y + B.nv.y });
  const nrm = v => { const L = Math.hypot(v.x, v.y) || 1; return { x: v.x / L, y: v.y / L }; }, du = nrm({ x: s0.x - sc.x, y: s0.y - sc.y }), dn = nrm({ x: n0.x - sc.x, y: n0.y - sc.y }), R = 46;
  const t0 = Date.now(), box = document.createElement('div'); box.id = 'blkQuick'; box.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;z-index:9000';
  const ARW = (x, y) => { const a = Math.atan2(y, x) * 180 / Math.PI; return a > -67.5 && a <= -22.5 ? '↗' : a > -112.5 && a <= -67.5 ? '↑' : a > -157.5 && a <= -112.5 ? '↖' : a > 22.5 && a <= 67.5 ? '↘' : a > 67.5 && a <= 112.5 ? '↓' : a > 112.5 && a <= 157.5 ? '↙' : a > -22.5 && a <= 22.5 ? '→' : '←'; };
  for (const a of [-1, 1]) for (const b of [-1, 1]) {
    const x = sc.x + (a * du.x + b * dn.x) * R, y = sc.y + (a * du.y + b * dn.y) * R, cur = (B.sw || 1) === b && ((B.hg ? 1 : -1) === a);
    const bt = document.createElement('button'); bt.type = 'button'; bt.textContent = ARW(a * du.x + b * dn.x, a * du.y + b * dn.y);
    bt.style.cssText = 'position:fixed;left:' + (r.left + x - 24) + 'px;top:' + (r.top + y - 24) + 'px;width:48px;height:48px;border-radius:50%;font-size:26px;line-height:1;border:2px solid #16a34a;background:' + (cur ? '#16a34a;color:#fff' : 'rgba(255,255,255,.95);color:#166534') + ';box-shadow:0 2px 8px rgba(0,0,0,.25)';
    bt.onclick = ev => { ev.stopPropagation(); if (Date.now() - t0 < 450) return; B.sw = b; B.ls = -b; B.hg = a > 0 ? 1 : 0; blkBuild(B, false); blkQuickClose(); if (blkAsk()) blkMenu(id, true); };
    box.appendChild(bt); }
  const ok = document.createElement('button'); ok.type = 'button'; ok.textContent = '✓'; ok.title = 'Ostavi ovako';
  ok.style.cssText = 'position:fixed;left:' + (r.left + sc.x - 18) + 'px;top:' + (r.top + sc.y - 18) + 'px;width:36px;height:36px;border-radius:50%;font-size:18px;border:2px solid #1e40af;background:#fff;color:#1e40af';
  ok.onclick = ev => { ev.stopPropagation(); if (Date.now() - t0 < 450) return; /* v2.21b: klik istog dodira (ispod prsta) ne zatvara strelice */ blkQuickClose(); if (blkAsk()) blkMenu(id, true); }; box.appendChild(ok);
  document.body.appendChild(box); toast('🚪 Odaberi strelicom gdje stoji otvoreno krilo (strana otvaranja i šarke).');
}
function blkQuickClose() { const q = $('blkQuick'); if (q) q.remove(); }
/* najbliži ugao s obje strane prozora/vrata: kraj zida ili spoj s poprečnim zidom (sobni ugao) */
function blkCorner(B, side, ws) { if (ws === undefined) ws = B.odWs || 0; /* v2.68: ws = strana zida s koje se mjeri (±1), 0 = bilo koja */
  const m = geoM(); if (!m) return side > 0 ? B.e1 : B.e0; const th = m.theta || 0, E = m.E, q = C.rotP(B.c, -th), s = B.s || blkScale(B), W = blkW(B, s);
  const o = Math.abs(C.rotP(B.dv, -th).x) > 0.7 ? 'H' : 'V', uc = o === 'H' ? q.x : q.y, vc = o === 'H' ? q.y : q.x;
  let w = null, bd = 3 * E; for (const x of m.walls) { if (x.view || x.o !== o || uc < x.e0 - E || uc > x.e1 + E) continue; const d = Math.abs(vc - x.c); if (d < bd) { bd = d; w = x; } }
  if (!w) return side > 0 ? B.e1 : B.e0;
  const cand = [w.e0, w.e1]; for (const x of m.walls) { if (x.view || x.o === o || Math.max(Math.abs(x.e0 - w.c), Math.abs(x.e1 - w.c)) < 3 * E) continue; /* kratke crte (stranice nacrtanog prozora) nisu ugao */ if (x.c < w.e0 - E || x.c > w.e1 + E) continue; if (w.c < x.e0 - 1.5 * E || w.c > x.e1 + 1.5 * E) continue; if (ws > 0 && !(x.e1 > w.c + 1.5 * E)) continue; if (ws < 0 && !(x.e0 < w.c - 1.5 * E)) continue; cand.push(x.c); }
  const lim = uc + side * (W / 2 - 0.3 * E); const ok = cand.filter(u => side > 0 ? u >= lim : u <= lim); const u = ok.length ? (side > 0 ? Math.min(...ok) : Math.max(...ok)) : (side > 0 ? w.e1 : w.e0);
  return C.rotP(o === 'H' ? { x: u, y: w.c } : { x: w.c, y: u }, th);
}
function blkPlace(p, t) {
  const W0 = blkWall(p); if (!W0 && t === 'prozor' && window.IzmjeraVodic && IzmjeraVodic.krPlace) { IzmjeraVodic.krPlace(p); return; } /* dodir u prostoriji (ne na zid) = krovni prozor */ if (!W0) { toast((t === 'prozor' ? '🪟' : '🚪') + ' Dodirni zid na koji ide ' + (t === 'prozor' ? 'prozor.' : 'vrata.') + ' (Zid mora biti nacrtan; ponovno gumb za kraj.)'); return; }
  blkScale(); const last = blkLast(t), B = { id: 'b' + Date.now().toString(36), t, c: { x: br1(W0.c.x), y: br1(W0.c.y) }, dv: W0.dv, nv: W0.nv, E: W0.E, e0: W0.e0, e1: W0.e1, sw: W0.side, ls: -W0.side, hg: 0, dvo: !!last.dvo, bk: t === 'vrata' && !!last.bk && !last.kl, kl: t === 'vrata' && !!last.kl }; if (t === 'prozor' && last.pv) B.pv = last.pv; T.lastBlk = B.id; blkScale(B);
  if (t === 'vrata' && !B.bk) { blkBuild(B, true); blkQuick(B.id); return; }
  if (blkAsk()) { blkBuild(B, true); blkMenu(B.id, true); } else { blkBuild(B, true); app.status((t === 'prozor' ? '🪟 Prozor' : '🚪 Vrata') + ' postavljen' + (t === 'vrata' ? 'a' : '') + ' – mjere kasnije: uključi gumb i dodirni ' + (t === 'prozor' ? 'prozor.' : 'vrata.')); }
}
/* vrata potezom: od šarke (na zidu) preko strane na koju se otvaraju do drugog kraja vrata */
function blkPlaceDrag(pts, t) {
  const S = pts[0], U = pts[pts.length - 1], W0 = blkWall(S) || blkWall(U); if (!W0) { toast('🚪 Potez počni na zidu (kod šarki).'); return; }
  const m = geoM(), th = m.theta || 0, E = W0.E, w = W0.w, uv = p => { const q = C.rotP(p, -th); return w.o === 'H' ? [q.x, q.y] : [q.y, q.x]; };
  const [uS] = uv(S), [uU] = uv(U); let vFar = 0; for (const p of pts) { const [, v] = uv(p); if (Math.abs(v - w.c) > Math.abs(vFar)) vFar = v - w.c; }
  // dvokrilna: potez se u sredini vrati do zida (dvije „grbe” – po jedna za svako krilo)
  const vs = pts.map(p => uv(p)[1] - w.c), mxv = Math.max(...vs.map(Math.abs)), n = vs.length; let dvo = false;
  if (mxv > 2 * E && n > 6) for (let i = Math.floor(n * 0.2); i < Math.ceil(n * 0.8); i++) { if (Math.abs(vs[i]) > Math.max(1.3 * E, 0.3 * mxv)) continue;
    if (vs.slice(0, i).some(v => Math.abs(v) > 0.6 * mxv) && vs.slice(i + 1).some(v => Math.abs(v) > 0.6 * mxv)) { dvo = true; break; } }
  const along = Math.abs(uU - uS) >= 2 * E, sw = vFar >= 0 ? 1 : -1, s = blkScale(), Wpx = along ? Math.abs(uU - uS) : BLK_DEF[t].w / s;
  const dir = along ? Math.sign(uU - uS) : 1, uC = uS + dir * Wpx / 2, cA = w.o === 'H' ? { x: uC, y: w.c } : { x: w.c, y: uC }, c = C.rotP(cA, th);
  const last = blkLast(t), B = { id: 'b' + Date.now().toString(36), t, c: { x: br1(c.x), y: br1(c.y) }, dv: W0.dv, nv: W0.nv, E, e0: W0.e0, e1: W0.e1, sw, ls: -sw, hg: dir > 0 ? 0 : 1, dvo, wpx: along ? br1(Wpx) : null }; T.lastBlk = B.id;
  blkScale(B); blkBuild(B, true); if (blkAsk()) blkMenu(B.id, true); else toast(dvo ? '🚪🚪 Dvokrilna vrata postavljena.' : '🚪 Vrata postavljena – mjere kasnije: dodirni ih s uključenim 🚪 Vrata.');
}
function blkDragStart(p) {
  const cv = document.getElementById('canvas') || document.querySelector('canvas'); T.vdrag = { pts: [p] };
  const mv = e => { const r = cv.getBoundingClientRect(); T.vdrag.pts.push(app.world({ x: e.clientX - r.left, y: e.clientY - r.top })); app.redraw(); };
  const up = e => { window.removeEventListener('pointermove', mv, true); window.removeEventListener('pointerup', up, true); window.removeEventListener('pointercancel', up, true);
    const d = T.vdrag; T.vdrag = null; if (!d) return; const a = d.pts[0], L = d.pts.reduce((acc, q, i) => i ? acc + Math.hypot(q.x - d.pts[i - 1].x, q.y - d.pts[i - 1].y) : 0, 0);
    if (L < 14 / app.scale()) blkPlace(a, 'vrata'); else blkPlaceDrag(d.pts, 'vrata'); app.redraw(); };
  window.addEventListener('pointermove', mv, true); window.addEventListener('pointerup', up, true); window.addEventListener('pointercancel', up, true);
}
function blkHit(p, only) { const E = (geoM() && geoM().E) || 10; let best = null, bd = Infinity;
  for (const o of app.items()) { if (!o.blk || !o.blk.main || /^(stube|krovni|otvorp|terasa|greda|prag|stup)$/.test(o.blk.t) || (only && o.blk.t !== only)) continue; const B = o.blk, s = B.s || blkScale(), W = blkWd(B, s); const rel = { x: p.x - B.c.x, y: p.y - B.c.y }, u = rel.x * B.dv.x + rel.y * B.dv.y, v = rel.x * B.nv.x + rel.y * B.nv.y;
    const ok = B.t === 'vrata' ? Math.abs(u) <= W / 2 + 0.5 * E && v * (B.sw || 1) > -1.5 * E && Math.abs(v) <= (B.dvo ? W / 2 : W) + 0.5 * E : Math.abs(u) <= W / 2 + 0.4 * E && Math.abs(v) <= 1.6 * E;
    if (ok) { const d = Math.hypot(u, v); if (d < bd) { bd = d; best = B.id; } } }
  return best; }
/* koji je ugao „prvi”/„drugi” – opis prema tome kako je skica trenutno okrenuta na ekranu */
/* v2.65: susjedni prozor/vrata na istom zidu između ovog otvora i ugla – mjera „od susjednog otvora” (rub do ruba) */
function blkNb(B, side, ws) { const s0 = B.s || blkScale(B), W0 = blkWd(B, s0), my = blkDW(B, W0) / 2, E = B.E || 10, cor = blkCorner(B, side, ws), lim = (cor.x - B.c.x) * B.dv.x + (cor.y - B.c.y) * B.dv.y; let best = null;
  for (const o of app.items()) { const N = o.blk; if (!N || !N.main || N.id === B.id || !N.c || !(N.t === 'prozor' || N.t === 'vrata')) continue;
    const dx = N.c.x - B.c.x, dy = N.c.y - B.c.y, along = dx * B.dv.x + dy * B.dv.y, perp = Math.abs(dx * B.dv.y - dy * B.dv.x); if (perp > 2 * E || along * side <= my || Math.abs(along) > Math.abs(lim) + E) continue;
    const ns = N.s || blkScale(N), half = blkDW(N, blkWd(N, ns)) / 2, edge = along - side * half; if (!best || Math.abs(edge) < Math.abs(best.u)) best = { u: edge, id: N.id, t: N.t }; }
  return best ? { P: { x: B.c.x + B.dv.x * best.u, y: B.c.y + B.dv.y * best.u }, id: best.id, t: best.t } : null; }
/* v2.79: izbočenje (stup, dimnjak) uz ugao između otvora i ugla – mjera „od izbočenja” (laser ne može do zida). Vraća lice izbočenja na crti zida i koju stranicu izbočenja treba dodati do ugla. */
function blkIz(B, side, ws) { if (ws === undefined) ws = B.odWs || 0;
  try { if (!T.m) analyzeNow(true); const m = T.m, NB = T.B && T.B.nis; if (!m || !NB || !NB.length) return null;
    const th = m.theta || 0, E = m.E, q = C.rotP(B.c, -th), o = Math.abs(C.rotP(B.dv, -th).x) > 0.7 ? 'H' : 'V', uc = o === 'H' ? q.x : q.y;
    const s = B.s || blkScale(B), edge = uc + side * blkDW(B, blkWd(B, s)) / 2, Pc = blkCorner(B, side, ws), cr = C.rotP(Pc, -th), ucor = o === 'H' ? cr.x : cr.y, wc = o === 'H' ? cr.y : cr.x;
    let best = null;
    for (const n of NB) { if (n.kind !== 'zadebljanje') continue; let face, dim;
      if (n.o === o) { /* izbočenje na istom zidu, prislonjeno uz ugao */ if (Math.abs(n.cW - wc) > 1.5 * E) continue; if (ws && n.nc != null && Math.abs(n.nc - n.cW) > 0.5 && Math.sign(n.nc - n.cW) !== ws) continue;
        const near = side > 0 ? Math.min(n.s0, n.s1) : Math.max(n.s0, n.s1), far = side > 0 ? Math.max(n.s0, n.s1) : Math.min(n.s0, n.s1); if (Math.abs(far - ucor) > 2.5 * E) continue; face = near; dim = 'w'; }
      else { /* izbočenje na zidu ugla, prislonjeno uz ovaj zid – do ugla se doda njegova dubina */ if (n.nc == null || Math.abs(n.cW - ucor) > 2.5 * E) continue; const lo = Math.min(n.s0, n.s1), hi = Math.max(n.s0, n.s1); if (wc < lo - 2.5 * E || wc > hi + 2.5 * E) continue;
        const mid = (lo + hi) / 2; if (ws && Math.abs(mid - wc) > E && Math.sign(mid - wc) !== ws) continue; face = n.nc; dim = 'd'; }
      if ((face - edge) * side < -0.5 * E || (ucor - face) * side < 0.5 * E) continue; /* mora biti između ruba otvora i ugla */
      const dist = Math.abs(face - edge); if (!best || dist < best.dist) best = { dist, face, dim, n }; }
    if (!best) return null; const S0 = tl(app.currentFloor()), nz = (S0.niches || {})[best.n.key] || {}, ext = nz[best.dim] > 0 && !nz.est ? nz[best.dim] : null;
    return { P: C.rotP(o === 'H' ? { x: best.face, y: wc } : { x: wc, y: best.face }, th), Pc, key: best.n.key, dim: best.dim, ext }; } catch (e) { return null; } }
/* v2.68: riječ za stranu zida (ws ±1) na ekranu: lijeva/desna/gornja/donja */
function blkWsWord(B, ws) { const m = geoM(), th = (m && m.theta) || 0, o = Math.abs(C.rotP(B.dv, -th).x) > 0.7 ? 'H' : 'V', n = C.rotP(o === 'H' ? { x: 0, y: ws } : { x: ws, y: 0 }, th), a = app.screen(B.c), b = app.screen(vadd(B.c, n, 10)), dx = b.x - a.x, dy = b.y - a.y;
  return Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'lijeva' : 'desna') : (dy < 0 ? 'gornja' : 'donja'); }
/* v2.76: „Mjerim iz:” – prostorija s obje strane zida prozora/vrata (ili Vani) */
function blkSides(B) { try { const VD = window.IzmjeraVodic; if (!VD || !VD.roomsOf) return null; if (!T.m) analyzeNow(true); const m = T.m; if (!m) return null; const th = m.theta || 0, E = m.E || 10, q = C.rotP(B.c, -th), o = Math.abs(C.rotP(B.dv, -th).x) > 0.7 ? 'H' : 'V', uc = o === 'H' ? q.x : q.y, vc = o === 'H' ? q.y : q.x;
  let w = null, bd = 3 * E; for (const x of m.walls) { if (x.view || x.o !== o || uc < x.e0 - E || uc > x.e1 + E) continue; const d = Math.abs(vc - x.c); if (d < bd) { bd = d; w = x; } } const c0 = w ? w.c : vc, rooms = VD.roomsOf() || [];
  return [-1, 1].map(ws => { const p = o === 'H' ? { x: uc, y: c0 + ws * 1.5 * E } : { x: c0 + ws * 1.5 * E, y: uc }, r = rooms.find(x => x.has(p)) || null; return { ws, room: r, out: !r, name: r ? (r.name || 'prostorija bez imena') : 'Vani' }; }); } catch (e) { return null; } }
function blkGuidedWs(B, S) { try { const V = window.IzmjeraVodic && IzmjeraVodic.V; if (!V || !V.on || !V.room || V.room.key === 'rest' || !S) return 0; const h = S.find(x => x.room && (x.room.key === V.room.key || (V.room.c && x.room.has(V.room.c)))); return h ? h.ws : 0; } catch (e) { return 0; } }
function blkEndWord(B, side) {
  const a = app.screen(B.c), b = app.screen(vadd(B.c, B.dv, side * 10)), dx = b.x - a.x, dy = b.y - a.y;
  return Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? '← Od lijevog ugla' : 'Od desnog ugla →') : (dy < 0 ? '↑ Od gornjeg ugla' : '↓ Od donjeg ugla');
}
/* dok je izbornik otvoren: oba ugla na skici, odabrani zeleno s crtom do prozora/vrata i upisanom mjerom */
function blkEndsUI(B, d) {
  const old = $('blkEnds'); if (old) old.remove();
  const cv = document.getElementById('canvas') || document.querySelector('canvas'), NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg'); svg.id = 'blkEnds'; svg.setAttribute('style', 'position:fixed;left:0;top:0;width:100vw;height:100vh;pointer-events:none'); d.insertBefore(svg, d.firstChild); const card = d.querySelector('.tp-card'); if (card) { card.style.position = 'relative'; card.style.zIndex = '1'; }
  d.style.background = 'transparent'; d.style.pointerEvents = 'none'; d.classList.add('nb'); if (card) { card.style.pointerEvents = 'auto'; card.style.boxShadow = '0 10px 30px rgba(0,0,0,.35)'; } /* v2.04: skica ostaje živa – zum i pomak prstima dok je izbornik otvoren */
  if (card) card.style.maxWidth = 'min(480px,100%)';
  const sc0 = app.screen(B.c), r0 = cv.getBoundingClientRect(), wx = r0.left + sc0.x, wy = r0.top + sc0.y, horiz = innerWidth > innerHeight && innerWidth - 500 > 260;
  if (horiz) d.style.justifyContent = wx > innerWidth / 2 ? 'flex-start' : 'flex-end'; else d.style.alignItems = wy > innerHeight / 2 ? 'flex-start' : 'flex-end';
  const btns = () => d.querySelectorAll('button[data-e]').forEach(b => { const on = +b.dataset.e === (B.end > 0 ? 1 : -1) * (B.odNb ? 2 : B.odIz ? 3 : 1); b.style.background = on ? '#16a34a' : '#fff'; b.style.color = on ? '#fff' : '#17457f'; b.style.borderColor = on ? '#16a34a' : '#b8cde5'; });
  const pick = side => { B.end = Math.sign(side); B.odNb = Math.abs(side) === 2; if (Math.abs(side) === 3) { const iz = blkIz(B, Math.sign(side)); if (iz) B.odIz = { key: iz.key, dim: iz.dim, cor: { x: br1(iz.Pc.x), y: br1(iz.Pc.y) } }; } else delete B.odIz; btns(); draw(); };
  d.querySelectorAll('button[data-e]').forEach(b => b.onclick = () => pick(+b.dataset.e));
  const draw = () => {
    if (!d.isConnected) { svg.remove(); clearInterval(tm); return; }
    const r = cv.getBoundingClientRect(), S = q => { const z = app.screen(q); return { x: r.left + z.x, y: r.top + z.y }; }, s = B.s || blkScale(B), W = blkWd(B, s), sel = B.end > 0 ? 1 : -1;
    const inp = d.querySelector('#tbOd'), v = inp ? inp.value.trim() : ''; let h = '';
    { const fr = SS && B.odWs ? SS.find(x => x.ws === B.odWs) : null, th = (T.m && T.m.theta) || 0; if (fr && fr.room) for (const R of fr.room.rects) { const pts = [[R[0], R[1]], [R[2], R[1]], [R[2], R[3]], [R[0], R[3]]].map(([x, y]) => S(C.rotP({ x, y }, th))); h += '<polygon points="' + pts.map(z => z.x + ',' + z.y).join(' ') + '" fill="#0f766e" fill-opacity="0.13" stroke="none"/>'; } }
    for (const side of [-1, 1]) {
      const nb = on0 => on0 && B.odNb ? blkNb(B, side) : on0 && B.odIz ? blkIz(B, side) : null, nbP = nb(side === sel), P = S(nbP ? nbP.P : blkCorner(B, side)), Q = S(vadd(B.c, B.dv, side * blkDW(B, W) / 2)), on = side === sel, col = on ? '#16a34a' : '#64748b';
      h += '<line x1="' + P.x + '" y1="' + P.y + '" x2="' + Q.x + '" y2="' + Q.y + '" stroke="' + col + '" stroke-width="' + (on ? 6 : 3) + '" stroke-linecap="round"' + (on ? '' : ' stroke-dasharray="6 7"') + ' opacity="' + (on ? 0.85 : 0.6) + '"/>';
      h += '<g data-side="' + side + '" style="pointer-events:auto;cursor:pointer"><circle cx="' + P.x + '" cy="' + P.y + '" r="' + (on ? 17 : 14) + '" fill="' + (on ? '#16a34a' : '#fff') + '" stroke="' + col + '" stroke-width="3"/>' +
        '<text x="' + P.x + '" y="' + (P.y + 5) + '" text-anchor="middle" font="700 14px Arial" font-weight="700" font-size="14" fill="' + (on ? '#fff' : '#334155') + '">' + (on ? '✓' : '') + '</text></g>';
      if (on && v) { const mx = (P.x + Q.x) / 2, my = (P.y + Q.y) / 2 - 16, t = v.replace(/[<>&]/g, '') + ' cm';
        h += '<rect x="' + (mx - t.length * 5 - 6) + '" y="' + (my - 13) + '" width="' + (t.length * 10 + 12) + '" height="24" rx="6" fill="#16a34a"/><text x="' + mx + '" y="' + (my + 5) + '" text-anchor="middle" font-size="16" font-weight="700" fill="#fff">' + t + '</text>'; }
    }
    svg.innerHTML = h; svg.querySelectorAll('g[data-side]').forEach(g => g.onclick = ev => { ev.stopPropagation(); pick(+g.dataset.side); });
  };
  // ako su uglovi pod izbornikom ili izvan ekrana – pomakni skicu u slobodni dio
  try { const rc = cv.getBoundingClientRect(), cr = card.getBoundingClientRect(), s = B.s || blkScale(B), W = blkW(B, s);
    const pts = [blkCorner(B, -1), blkCorner(B, 1)].map(q => { const z = app.screen(q); return { x: rc.left + z.x, y: rc.top + z.y }; });
    const fr = { l: rc.left + 30, t: rc.top + 110, r: rc.right - 30, b: rc.bottom - 90 };
    if (horiz) { if (cr.left > innerWidth / 2) fr.r = Math.min(fr.r, cr.left - 20); else fr.l = Math.max(fr.l, cr.right + 20); } else { if (cr.top > innerHeight / 2) fr.b = Math.min(fr.b, cr.top - 20); else fr.t = Math.max(fr.t, cr.bottom + 20); }
    const inF = z => z.x > fr.l && z.x < fr.r && z.y > fr.t && z.y < fr.b;
    if (fr.r - fr.l > 120 && fr.b - fr.t > 80 && !pts.every(inF) && app.centerOn) {
      const M = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 }, Mw = app.world({ x: M.x - rc.left, y: M.y - rc.top });
      const cc = app.world({ x: rc.width / 2, y: rc.height / 2 }), fc = app.world({ x: (fr.l + fr.r) / 2 - rc.left, y: (fr.t + fr.b) / 2 - rc.top });
      app.centerOn({ x: Mw.x + cc.x - fc.x, y: Mw.y + cc.y - fc.y }); } } catch (e) { }
  const SS = blkSides(B); const tm = setInterval(draw, 200); btns(); draw();
  const od = d.querySelector('#tbOd'); if (od) od.addEventListener('input', draw);
}
function blkMenu(id, fresh) {
  const M = blkMain(id); if (!M) return; const B = M.blk, isV = B.t === 'vrata', last = blkLast(B.t);
  const val = B.w > 0 ? blkText(B) : '', ph = last.w + '/' + last.h + (B.t === 'prozor' && last.p != null ? ' p=' + last.p : '');
  const BS = 'min-height:44px;padding:6px 10px;margin:0';
  const S2 = blkSides(B), gws = blkGuidedWs(B, S2); if (gws && B.odWs === undefined) { B.odWs = gws; B.odOut = false; } /* vođeno mjerenje: zna se u kojoj si prostoriji */
  const fromRow = B => { if (!S2) return '<div class="tp-row" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:4px 0"><button data-a="ws" style="' + BS + ';' + (B.odWs ? 'background:#0f766e;color:#fff;border-color:#0f766e' : '') + '">⇄ Strana zida: ' + (B.odWs ? blkWsWord(B, B.odWs) : 'bilo koja') + '</button><button data-a="out" style="' + BS + ';' + (B.odOut ? 'background:#c2410c;color:#fff;border-color:#c2410c' : '') + '">' + (B.odOut ? '🏠 Mjereno izvana' : '🏠 Mjereno iznutra') + '</button></div>';
    const on = x => x ? B.odWs === x.ws : B.odWs === 0, st = v => v ? 'background:#0f766e;color:#fff;border-color:#0f766e' : '';
    return '<div class="tp-row" id="tbFrom" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:4px 0;padding:3px;border:2px solid transparent;border-radius:10px"><b style="font-size:14px">📍 Mjerim iz:</b>' + S2.map(x => '<button data-a="from" data-ws="' + x.ws + '" style="' + BS + ';' + st(on(x)) + '">' + (x.out ? '🌳 ' : '🏠 ') + esc(x.name) + '</button>').join('') + '<button data-a="from" data-ws="0" style="' + BS + ';' + st(on(null)) + '">Svejedno</button>' + (gws ? '<span style="font-size:12px;color:#5b6b80">vođeno mjerenje – prostorija koju mjeriš</span>' : '') + '</div>'; };
  const d = sheet('<div class="tp-head" style="display:flex;align-items:center;gap:8px;margin-bottom:4px"><b style="flex:1">' + (isV ? '🚪 Vrata' : '🪟 Prozor') + '</b><button data-a="ok" style="background:#17457f;color:#fff;font-weight:700;' + BS + ';padding:6px 18px">✓ Spremi</button><button data-a="x" style="' + BS + '">✕</button></div>' +
    '<div class="tp-row" style="display:flex;gap:6px;align-items:center;flex-wrap:nowrap;margin:2px 0"><input id="tbVal" value="' + esc(val) + '" placeholder="' + esc(ph) + '" inputmode="none" autocomplete="off" style="flex:1;min-width:0;font-size:22px;padding:6px 10px;border:2px solid #9dbbe0;border-radius:10px;box-sizing:border-box">' +
    (isV ? ['+', '/', '⌫'] : ['/', ' p=', '⌫']).map(k => '<button data-k="' + k + '" style="' + BS + ';min-width:44px">' + (k.trim() || k) + '</button>').join('') + '</div>' +
    /* v2.22: vlastita tipkovnica s brojevima (Androidova se ne otvara) – piše u označeno polje (mjera ili Od ugla) */
    '<div class="tb-pad" style="display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin:6px 0">' + ['7', '8', '9', '4', '5', '6', '1', '2', '3', ',', '0', '⌫'].map(k => '<button data-k="' + k + '" style="height:40px;margin:0;font:700 20px Arial;border:1px solid #cbd5e1;border-radius:10px;background:#f8fafc;color:#0f2a4a">' + k + '</button>').join('') + '</div>' +
    '<div class="tp-row" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:4px 0"><button data-a="last" style="' + BS + '">↺ ' + esc(ph) + '</button><span style="font-size:13px;color:#5b6b80">š/v' + (isV ? '' : ' p=parapet') + ', prazno = kasnije</span></div>' +
    '<div class="tp-row" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:4px 0"><b style="font-size:14px">Od ugla</b><input id="tbOd" inputmode="none" value="' + esc(typeof B.od === 'number' ? B.od : '') + '" placeholder="cm" style="width:90px;font-size:20px;padding:6px 8px;border:2px solid #9dbbe0;border-radius:10px;box-sizing:border-box"><button data-e="-1" style="' + BS + '">' + blkEndWord(B, -1) + '</button><button data-e="1" style="' + BS + '">' + blkEndWord(B, 1) + '</button>' + [-1, 1].map(sd => { const nb = blkNb(B, sd); if (!nb) return ''; const w = blkEndWord(B, sd), ar = /^[←↑↓]/.test(w) ? w.slice(0, 2) : '', ar2 = /→$/.test(w) ? ' →' : ''; return '<button data-e="' + 2 * sd + '" style="' + BS + '">' + ar + 'Od susjed' + (nb.t === 'vrata' ? 'nih vrata' : 'nog prozora') + ar2 + '</button>'; }).join('') + [-1, 1].map(sd => { const iz = blkIz(B, sd); if (!iz) return ''; const w = blkEndWord(B, sd), ar = /^[←↑↓]/.test(w) ? w.slice(0, 2) : '', ar2 = /→$/.test(w) ? ' →' : ''; return '<button data-e="' + 3 * sd + '" style="' + BS + '">' + ar + 'Od izbočenja' + ar2 + '</button>'; }).join('') + '</div>' + fromRow(B) +
    '<div class="tp-row" style="display:flex;gap:6px;flex-wrap:wrap;margin:4px 0">' + (isV ? '<button data-a="sw" style="' + BS + '">⇅ Otvaranje</button><button data-a="hg" style="' + BS + '">⇄ Šarke</button><button data-a="dvo" style="' + BS + ';' + (B.dvo ? 'background:#1e40af;color:#fff' : '') + '">Dvokrilna</button><button data-a="bk" style="' + BS + ';' + (B.bk ? 'background:#1e40af;color:#fff' : '') + '">▭ Bez krila (otvor)</button><button data-a="kl" style="' + BS + ';' + (B.kl ? 'background:#1e40af;color:#fff' : '') + '">⇹ Klizna</button>' : '<button data-a="ls" style="' + BS + '">⇅ Natpis na drugu stranu</button>' + [['', 'Prozor'], ['fix', 'Fiksno ostakljenje'], ['opeka', 'Staklena opeka']].map(([k, n]) => '<button data-a="pv' + k + '" style="' + BS + ';' + ((B.pv || '') === k ? 'background:#1e40af;color:#fff' : '') + '">' + n + '</button>').join('')) +
    '<button data-a="later" style="' + BS + '">Kasnije</button><button data-a="snap" style="' + BS + '">📍 Na zid</button><button data-a="del" style="' + BS + '">🗑</button></div>' +
    '<label class="tl-check" style="display:flex;gap:8px;align-items:center;margin:4px 0 0;font-size:14px"><input type="checkbox" id="tbAsk"' + (blkAsk() ? ' checked' : '') + ' style="width:20px;height:20px"> Pitaj mjere odmah pri postavljanju</label>');
  if (!B.end) B.end = -1; blkEndsUI(B, d);
  const inp = d.querySelector('#tbVal'); if (!fresh || blkAsk()) setTimeout(() => { try { inp.focus(); } catch (e) { } }, 60);
  d.querySelector('#tbAsk').onchange = e => store.set('izmjera-blk-pitaj', e.target.checked ? '1' : '0');
  let cur = inp; const odI = d.querySelector('#tbOd'), mark = () => { for (const x of [inp, odI]) if (x) x.style.borderColor = x === cur ? '#17457f' : '#9dbbe0'; }; [inp, odI].forEach(x => x && x.addEventListener('focus', () => { cur = x; mark(); })); mark();
  d.querySelectorAll('[data-k]').forEach(b => { b.addEventListener('pointerdown', e => e.preventDefault()); b.onclick = () => { const k = b.dataset.k, t = /^[\d,]$/.test(k) || k === '⌫' ? cur : inp; if (k === '⌫') t.value = t.value.slice(0, -1); else t.value += k; t.focus(); cur = t; mark(); }; });
  const parse = () => { const t = inp.value.trim().replace(',', '.'); if (!t) return {}; const m = /^(\d+(?:\.\d+)?)(?:\s*\+\s*(\d+(?:\.\d+)?))?\s*(?:[\/x×*]\s*(\d+(?:\.\d+)?))?(?:\s*p\s*=?\s*(-?\d+(?:\.\d+)?))?$/i.exec(t); if (!m) return null; return { w: m[2] ? Math.round((+m[1] + +m[2]) * 10) / 10 : +m[1], w1: m[2] ? +m[1] : null, h: m[3] ? +m[3] : null, p: m[4] != null ? +m[4] : null }; };
  const apply = (close) => { const r = parse(); if (r === null) { alert('Upiši npr. 120/140 ili 120/140 p=90'); return false; } const od = parseFloat(d.querySelector('#tbOd').value.replace(',', '.'));
    Object.assign(B, { w: r.w || null, h: r.h || null, p: r.p, od: od >= 0 ? od : null, w1: r.w1 || null }); if (r.w1 && B.t === 'vrata') { B.dvo = true; B.bk = false; } if (typeof B.od === 'number' && !B.end) B.end = -1;
    if (r.w) store.set('izmjera-blk-' + B.t, JSON.stringify({ w: r.w, h: r.h || BLK_DEF[B.t].h, p: r.p, dvo: B.dvo, bk: !!B.bk, kl: !!B.kl }));
    blkPlaceOd(B);
    blkBuild(B, true); blkWideWarn(B); if (close) d.remove(); return true; };
  d.querySelectorAll('button[data-a]').forEach(b => b.onclick = () => { const a = b.dataset.a;
    if (a === 'x' || a === 'later') { d.remove(); return; }
    if (a === 'ok') { const odv = parseFloat(d.querySelector('#tbOd').value.replace(',', '.')); if (S2 && S2.every(x => x.room) && B.odWs === undefined && odv >= 0 && odv !== B.od && !d._asked) { d._asked = 1; const fr = d.querySelector('#tbFrom'); if (fr) { fr.style.borderColor = '#dc2626'; fr.style.background = '#fef2f2'; } toast('📍 Zid je između dvije prostorije – dodirni iz koje mjeriš (ili Svejedno), pa ✓ Spremi.'); return; } apply(true); return; }
    if (a === 'last') { inp.value = ph; return; }
    if (a === 'del') { app.snapshot(); const it = app.items(); for (let i = it.length - 1; i >= 0; i--) if (it[i].blk && it[i].blk.id === id) it.splice(i, 1); app.save(); T.sig = ''; app.redraw(); d.remove(); return; }
    if (a === 'snap') { const m = geoM(); if (m) { const th = m.theta || 0, q = C.rotP(B.c, -th), o = Math.abs(B.dv.x) * Math.abs(Math.cos(th)) + Math.abs(B.dv.y) * Math.abs(Math.sin(th)) > 0.7 ? 'H' : 'V'; let w = null, bd = 12 * m.E;
        for (const x of m.walls) { if (x.view || x.o !== o) continue; const u = o === 'H' ? q.x : q.y, v = o === 'H' ? q.y : q.x; if (u < x.e0 - m.E || u > x.e1 + m.E) continue; const d = Math.abs(v - x.c); if (d < bd) { bd = d; w = x; } }
        if (w) { const c = C.rotP(o === 'H' ? { x: q.x, y: w.c } : { x: w.c, y: q.y }, th); B.c = { x: br1(c.x), y: br1(c.y) }; B.e0 = C.rotP(o === 'H' ? { x: w.e0, y: w.c } : { x: w.c, y: w.e0 }, th); B.e1 = C.rotP(o === 'H' ? { x: w.e1, y: w.c } : { x: w.c, y: w.e1 }, th); blkBuild(B, true); toast('📍 Vraćeno na zid.'); } else toast('📍 U blizini nema zida u tom smjeru.'); } d.remove(); return; }

    if (a === 'end') B.end = B.end > 0 ? -1 : 1; if (a === 'sw') B.sw = -(B.sw || 1); if (a === 'hg') { if (B.dvo && B.w1 > 0 && B.w1 < B.w) B.w1 = Math.round((B.w - B.w1) * 10) / 10; else B.hg = B.hg ? 0 : 1; } if (a === 'dvo') { B.dvo = !B.dvo; if (B.dvo) { B.bk = false; B.kl = false; } } if (a === 'bk' || a === 'kl') { B[a] = !B[a]; if (B[a]) { B.dvo = false; B[a === 'bk' ? 'kl' : 'bk'] = false; } try { const L0 = JSON.parse(store.get('izmjera-blk-vrata') || '{}'); L0.bk = !!B.bk; L0.kl = !!B.kl; store.set('izmjera-blk-vrata', JSON.stringify(L0)); } catch (e) { } } if (a === 'ls') B.ls = -(B.ls || 1); if (/^pv/.test(a)) { B.pv = a.slice(2) || undefined; try { const L0 = JSON.parse(store.get('izmjera-blk-prozor') || '{}'); L0.pv = B.pv || ''; store.set('izmjera-blk-prozor', JSON.stringify(L0)); } catch (e) { } } if (a === 'out') B.odOut = !B.odOut; if (a === 'from') { const ws = +b.dataset.ws, x = S2 && S2.find(z => z.ws === ws); if (ws) { B.odWs = ws; B.odOut = !!(x && x.out); } else { B.odWs = 0; B.odOut = false; } } if (a === 'ws') { B.odWs = !B.odWs ? 1 : B.odWs > 0 ? -1 : 0; if (!B.odWs) delete B.odWs; }
    if (apply(false)) { d.remove(); blkMenu(id); } });
}
/* udaljenost od ugla → pomakni blok uz zid */
function blkPlaceOd(B) { blkScale(B); if (typeof B.od === 'number' && B.od >= 0 && B.end) { const s = B.s || blkScale(B), W0 = blkW(B, s), nb = B.odNb ? blkNb(B, B.end > 0 ? 1 : -1) : null, iz = !nb && B.odIz ? blkIz(B, B.end > 0 ? 1 : -1) : null, endP = nb ? nb.P : iz ? iz.P : blkCorner(B, B.end > 0 ? 1 : -1); if (B.odNb && !nb) B.odNb = false; if (B.odIz) { if (iz) B.odIz = { key: iz.key, dim: iz.dim, cor: { x: br1(iz.Pc.x), y: br1(iz.Pc.y) } }; else delete B.odIz; } let W = W0; try { const Wd = blkWd(B, s); if (Wd > 0 && Wd < W0) W = B.t === 'prozor' ? blkDW(B, Wd) : Wd; } catch (e) { } /* v2.41: znak je skraćen (širi od zida) → od ugla se računa s nacrtanom širinom, da prozor ostane na zidu */ B.odP = { x: br1(endP.x), y: br1(endP.y) }; const toC = (B.od / s + W / 2) * (B.end > 0 ? -1 : 1); B.c = vadd(endP, B.dv, toC); B.c = { x: br1(B.c.x), y: br1(B.c.y) }; } }
/* prozori i vrata bez upisanih mjera (za „Što nedostaje”) */
function blkMissing() { return app.items().filter(o => o.blk && o.blk.main && !/^(stube|krovni|otvorp|terasa|greda|prag|stup)$/.test(o.blk.t) && !(o.blk.w > 0)).map(o => ({ p: o.blk.c, text: (o.blk.t === 'vrata' ? 'Vrata' : 'Prozor') + ' bez mjera – uključi ' + (o.blk.t === 'vrata' ? '🚪 Vrata' : '🪟 Prozor') + ' i dodirni ga.', blk: o.blk.id })); }

/* ---------- prijelom zida na skici (✂): zid nacrtan ravno, a ima skok ili dvije debljine ---------- */
T.splitMode = false;
/* ✂ Razreži: crta (zid, linija) se reže na dva dijela na mjestu dodira, pa se dio može izbrisati */
function cutTap(p) {
  const tol = 16 / app.scale(), it = app.items(); let best = null, bd = tol;
  for (const o of it) { if (!o || o.type === 'text' || !Array.isArray(o.pts) || o.pts.length < 2 || (app.visible && !app.visible(o.layer))) continue;
    for (let i = 1; i < o.pts.length; i++) { const a = o.pts[i - 1], b = o.pts[i], dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy || 1e-9, t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2)), q = { x: a.x + dx * t, y: a.y + dy * t }, d = Math.hypot(p.x - q.x, p.y - q.y);
      if (d < bd) { bd = d; best = { o, i, q }; } } }
  if (!best) return false;
  const { o, i, q } = best, qq = { x: Math.round(q.x * 10) / 10, y: Math.round(q.y * 10) / 10 }, A = o.pts.slice(0, i).concat([qq]), B = [qq].concat(o.pts.slice(i));
  const len = P => P.reduce((s, z, k) => k ? s + Math.hypot(z.x - P[k - 1].x, z.y - P[k - 1].y) : 0, 0); if (len(A) < 2 / app.scale() || len(B) < 2 / app.scale()) { toast('✂ Preblizu kraja crte – dodirni dalje od kraja.'); return true; }
  app.snapshot(); const k = it.indexOf(o), base = Object.assign({}, o); delete base.blk; delete base.pts;
  it.splice(k, 1, Object.assign({}, base, { pts: A }), Object.assign({}, base, { pts: B })); app.save(); T.sig = ''; T.cutMark = { p: qq, at: Date.now() };
  toast('✂ Crta razrezana na dva dijela – višak izbriši Gumicom ili Odabirom.'); app.redraw(); return true;
}
function splitTap(p) {
  const m = geoM(); if (!m) { toast('✂ Nema nacrtanih zidova.'); return; }
  const th = m.theta || 0, q = C.rotP(p, -th), E = m.E; let w = null, bd = Math.max(2.5 * E, 36 / app.scale());
  for (const x of m.walls) { if (x.view) continue; const u = x.o === 'H' ? q.x : q.y, v = x.o === 'H' ? q.y : q.x; if (u < x.e0 - E || u > x.e1 + E) continue; const d = Math.abs(v - x.c); if (d < bd) { bd = d; w = x; } }
  if (!w) { toast('✂ Dodirni zid koji treba prelomiti (ili ponovno ✂ Prelom za kraj).'); return; }
  const u = w.o === 'H' ? q.x : q.y, t = tl(app.currentFloor()); t.wallSplit = t.wallSplit || [];
  const ex = t.wallSplit.findIndex(sp => !sp.off && sp.o === w.o && Math.abs(sp.c - w.c) < 2.5 * E && Math.abs(sp.at - u) < 2 * E);
  if (ex >= 0) { const sp = t.wallSplit[ex]; if (sp.auto) sp.off = true; else t.wallSplit.splice(ex, 1); app.save(); T.sig = ''; app.status('✂ Prijelom uklonjen.'); app.redraw(); return; }
  // prijelom na najbližem spoju s poprečnim zidom (ako je blizu), inače točno gdje je dodirnuto
  let at = null, bj = 4 * E;
  for (const x of m.walls) { if (x.o === w.o || x.view || x.c <= w.e0 + E || x.c >= w.e1 - E || w.c < x.e0 - 1.5 * E || w.c > x.e1 + 1.5 * E) continue; const d = Math.abs(x.c - u); if (d < bj) { bj = d; at = x.c; } }
  if (at == null) { if (u > w.e0 + E && u < w.e1 - E) at = u; else { app.status('✂ Preblizu kraja zida – dodirni malo dalje od ugla.'); return; } }
  t.wallSplit.push({ o: w.o, c: Math.round(w.c * 10) / 10, at: Math.round(at * 10) / 10 }); app.save(); T.sig = '';
  T.mGeo = null; toast('✂ Zid prelomljen – dva dijela su obojena (narančasto / plavo). Uz svaki dio napiši debljinu d=…'); app.redraw();
}
function drawSplits(ctx, s) {
  if (T.cutMark && Date.now() - T.cutMark.at < 2500) { ctx.save(); ctx.fillStyle = '#dc2626'; ctx.beginPath(); ctx.arc(T.cutMark.p.x, T.cutMark.p.y, 6 / s, 0, 7); ctx.fill(); ctx.restore(); setTimeout(() => app.redraw(), 2600); }
  if (T.vdrag && T.vdrag.pts.length > 1) { ctx.save(); ctx.strokeStyle = '#16a34a'; ctx.lineWidth = 3 / s; ctx.setLineDash([8 / s, 6 / s]); ctx.beginPath(); T.vdrag.pts.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)); ctx.stroke(); ctx.restore(); }
  const f = app.currentFloor(), sp = ((f && f.tlocrt && f.tlocrt.wallSplit) || []).filter(x => !x.off && !x.gap); if (!sp.length) return; /* v2.42: razdvajanje osi u prolazu se ne crta */
  const th = (T.m && T.m.theta) || 0, k = 1 / s, L = 16 * k;
  ctx.save(); ctx.lineWidth = 3 * k; ctx.strokeStyle = '#dc2626'; ctx.fillStyle = '#dc2626'; ctx.font = (14 * k) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  for (const x of sp) { const a = x.o === 'H' ? { x: x.at, y: x.c } : { x: x.c, y: x.at }, d = x.o === 'H' ? { x: 0, y: L } : { x: L, y: 0 };
    const P0 = C.rotP({ x: a.x - d.x, y: a.y - d.y }, th), P1 = C.rotP({ x: a.x + d.x, y: a.y + d.y }, th), P = C.rotP(a, th);
    ctx.beginPath(); ctx.moveTo(P0.x, P0.y); ctx.lineTo(P1.x, P1.y); ctx.stroke(); ctx.beginPath(); ctx.arc(P.x, P.y, 5 * k, 0, 7); ctx.fill(); ctx.fillText('✂', P.x + (x.o === 'H' ? 0 : 14 * k), P.y - (x.o === 'H' ? 14 * k : -6 * k)); }
  ctx.restore();
}


/* ---------- v2.76: 🧱 Debljina zida jednim potezom ---------- */
T.dbMode = false;
function dbStart(p) { const cv = $('canvas') || document.querySelector('canvas'); T.dbDrag = { pts: [p] };
  const mv = e => { const r = cv.getBoundingClientRect(); T.dbDrag && T.dbDrag.pts.push(app.world({ x: e.clientX - r.left, y: e.clientY - r.top })); app.redraw(); };
  const up = () => { window.removeEventListener('pointermove', mv, true); window.removeEventListener('pointerup', up, true); window.removeEventListener('pointercancel', up, true); const d = T.dbDrag; T.dbDrag = null; if (d) dbPick(d.pts); app.redraw(); };
  window.addEventListener('pointermove', mv, true); window.addEventListener('pointerup', up, true); window.addEventListener('pointercancel', up, true); }
function dbFloorM(splits) { const f = app.currentFloor(); return C.analyze(f, { splits: splits || (f.tlocrt && f.tlocrt.wallSplit) || [] }); }
function dbPick(pts) {
  let m; try { m = dbFloorM(); } catch (e) { m = null; } if (!m) { toast('🧱 Nema nacrtanih zidova.'); return; }
  const th = m.theta || 0, E = m.E, Q = pts.map(q => C.rotP(q, -th)); let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; for (const q of Q) { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }
  const tap = Math.max(x1 - x0, y1 - y0) < 14 / app.scale(), o = (x1 - x0) >= (y1 - y0) ? 'H' : 'V', vMid = o === 'H' ? (y0 + y1) / 2 : (x0 + x1) / 2, ua = o === 'H' ? x0 : y0, ub = o === 'H' ? x1 : y1;
  let w = null, bd = Math.max(2.5 * E, 36 / app.scale()); for (const x of m.walls) { if (x.view || x.obj || x.o !== o || ub < x.e0 - E || ua > x.e1 + E) continue; const d = Math.abs(vMid - x.c); if (d < bd) { bd = d; w = x; } }
  if (!w) { toast('🧱 Povuci olovkom uzduž zida (ili dodirni zid za cijeli zid).'); return; }
  let a = tap ? w.e0 : Math.max(w.e0, ua), b = tap ? w.e1 : Math.min(w.e1, ub);
  /* krajevi poteza: do najbližeg spoja s poprečnim zidom ako je blizu, uz ugao = do kraja zida, inače točno gdje je potez stao */
  const jn = []; for (const x of m.walls) { if (x.o === w.o || x.view || x.obj || x.c <= w.e0 + E || x.c >= w.e1 - E || w.c < x.e0 - 1.5 * E || w.c > x.e1 + 1.5 * E) continue; jn.push(x.c); }
  const snap = u => { if (Math.abs(u - w.e0) < 3 * E) return w.e0; if (Math.abs(u - w.e1) < 3 * E) return w.e1; let best = null, bj = 4 * E; for (const c of jn) { const d = Math.abs(c - u); if (d < bj) { bj = d; best = c; } } return best != null ? best : u; };
  if (!tap) { a = snap(a); b = snap(b); } if (b - a < 2 * E) { toast('🧱 Potez je prekratak – povuci uzduž cijelog dijela zida.'); return; }
  T.dbSel = { o: w.o, c: w.c, a, b, th, wk: C.wallKey(w), whole: Math.abs(a - w.e0) < 0.5 && Math.abs(b - w.e1) < 0.5 }; app.redraw(); dbAsk(w);
}
function dbAsk(w) {
  const S = T.dbSel, f = app.currentFloor(), t = tl(f), cur = (t.wallT || {})[S.wk] || w.tLabel || '', last = store.get('izmjera-db-last', '');
  const chips = [10, 12, 15, 20, 25, 30, 38, 45], BS = 'min-height:44px;padding:6px 12px;margin:0';
  const d = sheet('<div class="tp-head"><b>🧱 Debljina zida' + (S.whole ? ' (cijeli zid)' : ' (označeni dio)') + '</b><button data-a="x">✕</button></div>' +
    '<div class="tp-row" style="display:flex;gap:6px;align-items:center"><input id="dbVal" inputmode="none" value="' + esc(cur || '') + '" placeholder="' + esc(last || 'cm') + '" style="flex:1;font-size:24px;padding:8px 10px;border:2px solid #9dbbe0;border-radius:10px;box-sizing:border-box"><b>cm</b><button data-a="ok" style="' + BS + ';background:#17457f;color:#fff">✓ Spremi</button></div>' +
    '<div class="tp-row">' + chips.map(c => '<button data-c="' + c + '" style="' + BS + '">' + c + '</button>').join('') + '</div>' +
    '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin:8px 0">' + ['7', '8', '9', '4', '5', '6', '1', '2', '3', ',', '0', '⌫'].map(k => '<button data-k="' + k + '" style="height:40px;margin:0;font:700 20px Arial;border:1px solid #cbd5e1;border-radius:10px;background:#f8fafc;color:#0f2a4a">' + k + '</button>').join('') + '</div>' +
    '<div class="tp-note">Označeno je žuto na skici. Kraj poteza blizu poprečnog zida ide do spoja, inače točno gdje je potez stao (tu se zid prelomi). Dodir na zid bez povlačenja = cijeli zid.' + (cur ? '' : '') + '</div>');
  d.style.background = 'transparent'; d.style.pointerEvents = 'none'; d.style.alignItems = 'flex-end'; const card = d.querySelector('.tp-card'); card.style.pointerEvents = 'auto'; card.style.maxWidth = 'min(460px,100%)'; card.style.boxShadow = '0 10px 30px rgba(0,0,0,.35)';
  const inp = d.querySelector('#dbVal'), close = () => { d.remove(); T.dbSel = null; app.redraw(); };
  d.querySelectorAll('[data-k]').forEach(b => { b.addEventListener('pointerdown', e => e.preventDefault()); b.onclick = () => { const k = b.dataset.k; if (k === '⌫') inp.value = inp.value.slice(0, -1); else inp.value += k; }; });
  d.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { inp.value = b.dataset.c; save(); });
  const save = () => { const v = parseFloat(String(inp.value || inp.placeholder).replace(',', '.')); if (!(v >= 3 && v <= 120)) { toast('🧱 Upiši debljinu u cm (npr. 25).'); return; } dbApply(v); store.set('izmjera-db-last', String(v)); d.remove(); };
  d.querySelector('[data-a=ok]').onclick = save; d.querySelector('[data-a=x]').onclick = close; inp.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
}
function dbApply(v) {
  const S = T.dbSel; T.dbSel = null; if (!S) return; const f = app.currentFloor(), t = tl(f), sp0 = (t.wallSplit || []).slice();
  let m0; try { m0 = dbFloorM(sp0); } catch (e) { return; } const E = m0.E, sp = sp0.slice();
  const w0 = m0.walls.find(x => C.wallKey(x) === S.wk) || m0.walls.find(x => x.o === S.o && Math.abs(x.c - S.c) < E && x.e0 <= S.a + E && x.e1 >= S.b - E);
  for (const u of [S.a, S.b]) { if (!w0 || u <= w0.e0 + 0.5 * E || u >= w0.e1 - 0.5 * E) continue; if (sp.some(h => !h.off && h.o === S.o && Math.abs(h.c - S.c) < 2.5 * E && Math.abs(h.at - u) < 1.5 * E)) continue; sp.push({ o: S.o, c: Math.round(S.c * 10) / 10, at: Math.round(u * 10) / 10, user: true, db: true }); }
  let m1; try { m1 = dbFloorM(sp); } catch (e) { return; }
  const wallT = Object.assign({}, t.wallT || {}), wallView = Object.assign({}, t.wallView || {});
  for (const [F, src] of [[wallT, t.wallT || {}], [wallView, t.wallView || {}]]) for (const a of m0.walls) { const val = src[C.wallKey(a)]; if (val == null) continue; for (const b of m1.walls) { if (b.o !== a.o || Math.abs(b.c - a.c) > 2 * E || b.e0 < a.e0 - E || b.e1 > a.e1 + E) continue; const k = C.wallKey(b); if (F[k] == null) F[k] = val; } }
  let n = 0; for (const b of m1.walls) { if (b.view || b.obj || b.o !== S.o || Math.abs(b.c - S.c) > 2 * E || b.e0 < S.a - E || b.e1 > S.b + E) continue; wallT[C.wallKey(b)] = v; n++; }
  if (!n) { toast('🧱 Nije pronađen taj dio zida – pokušaj ponovno.'); return; }
  t.wallSplit = sp; t.wallT = wallT; t.wallView = wallView; app.save(); T.sig = ''; T.mGeo = null; schedule(); T.dbShowAt = Date.now();
  toast('🧱 Debljina ' + fmtCm(v) + ' cm upisana' + (sp.length > sp0.length ? ' – zid je prelomljen na kraju poteza' : '') + '.'); app.redraw();
}
function fmtCm(v) { return String(Math.round(v * 10) / 10).replace('.', ','); }
/* dok je uključen 🧱: uz svaki zid njegova debljina (upisana = tamno, pretpostavljena iz postavki = sivo) */
function drawDb(ctx, s) {
  if (T.dbDrag && T.dbDrag.pts.length > 1) { ctx.save(); ctx.strokeStyle = '#b45309'; ctx.lineWidth = 4 / s; ctx.globalAlpha = 0.7; ctx.lineCap = 'round'; ctx.beginPath(); T.dbDrag.pts.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)); ctx.stroke(); ctx.restore(); }
  const S = T.dbSel; if (S) { const A = C.rotP(S.o === 'H' ? { x: S.a, y: S.c } : { x: S.c, y: S.a }, S.th), B = C.rotP(S.o === 'H' ? { x: S.b, y: S.c } : { x: S.c, y: S.b }, S.th); ctx.save(); ctx.globalAlpha = 0.55; ctx.strokeStyle = '#facc15'; ctx.lineWidth = 14 / s; ctx.lineCap = 'butt'; ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke(); ctx.globalAlpha = 1; ctx.fillStyle = '#a16207'; for (const P of [A, B]) { ctx.beginPath(); ctx.arc(P.x, P.y, 6 / s, 0, 7); ctx.fill(); } ctx.restore(); }
  if (!T.dbMode) return; let m = T.dbM; const f = app.currentFloor(), key = signature(f) + JSON.stringify((f.tlocrt && f.tlocrt.wallSplit) || []);
  if (!m || T.dbKey !== key) { try { m = T.dbM = dbFloorM(); T.dbKey = key; } catch (e) { return; } }
  const t = tl(f), st = (UI().loadSettings && UI().loadSettings()) || C.DEFAULTS, fs = 12 / s; ctx.save(); ctx.font = '700 ' + fs + 'px Arial'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
  for (const w of m.walls) { if (w.view || w.obj) continue; const k = C.wallKey(w), v = (t.wallT || {})[k] || w.tLabel, mid = (w.e0 + w.e1) / 2, P = C.rotP(w.o === 'H' ? { x: mid, y: w.c } : { x: w.c, y: mid }, m.theta || 0), txt = (v ? '' : '~') + fmtCm(v || (w.exterior ? st.ext : st.int));
    const tw = ctx.measureText(txt).width + 8 / s, h = fs + 6 / s; ctx.fillStyle = v ? '#7c2d12' : '#fff'; ctx.strokeStyle = v ? '#7c2d12' : '#94a3b8'; ctx.lineWidth = 1 / s; rr(ctx, P.x - tw / 2, P.y - h / 2, tw, h, 4 / s); ctx.fill(); ctx.stroke(); ctx.fillStyle = v ? '#fff' : '#64748b'; ctx.fillText(txt, P.x, P.y + 0.5 / s); }
  ctx.restore();
}
/* ---------- veza s crtanjem ---------- */
app.hooks.draw.push((ctx, s) => {
  const floor = app.currentFloor(); if (floor !== T.floor || signature(floor) !== T.sig) { if (floor !== T.floor) { T.m = null; T.missing = null; T.floor = floor; setTimeout(() => { try { blkMigrate(); } catch (e) { } }, 50); } T.sig = signature(floor); schedule(); }
  drawRegion(ctx, s); drawSplits(ctx, s); drawDb(ctx, s); drawLinks(ctx, s); drawBubbles(ctx, s); textHits(s); drawFlash(ctx, s); drawMissing(ctx, s); drawPins(ctx, s); drawPinPts(ctx, s);
});
/* 🗑 Izbriši: označeno (Odabir) briše odmah; inače dodirom briše cijelu crtu, kotu, tekst ili prozor/vrata */
T.delMode = false;
function delTap(p) {
  const tol = 16 / app.scale(), it = app.items(); let best = null, bd = tol;
  for (const o of it) { if (!o || (app.visible && !app.visible(o.layer))) continue;
    if (o.type === 'text') { const w = String(o.text || '').length * 10, cx = o.dir === 'V' ? o.x + 7 : o.x + w / 2, cy = o.dir === 'V' ? o.y - w / 2 : o.y - 7, hw = o.dir === 'V' ? 10 : w / 2 + 4, hh = o.dir === 'V' ? w / 2 + 4 : 10;
      const dx = Math.max(0, Math.abs(p.x - cx) - hw), dy = Math.max(0, Math.abs(p.y - cy) - hh), d = Math.hypot(dx, dy); if (d < bd) { bd = d; best = o; } continue; }
    if (o.type === 'photo') { const d = Math.hypot(p.x - o.x, p.y - o.y); if (d < bd) { bd = d; best = o; } continue; }
    if (!Array.isArray(o.pts) || !o.pts.length) continue;
    for (let i = 0; i < o.pts.length; i++) { const a = o.pts[Math.max(0, i - 1)], b = o.pts[i], dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy, t = L2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2)) : 0, d = Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t); if (d < bd) { bd = d; best = o; } } }
  if (!best) { toast('🗑 Dodirni ono što treba izbrisati (crtu, kotu, tekst, prozor ili vrata).'); return; }
  app.snapshot(); const id = best.blk && best.blk.id; let n = 0;
  for (let i = it.length - 1; i >= 0; i--) if (it[i] === best || (id && it[i].blk && it[i].blk.id === id)) { it.splice(i, 1); n++; }
  app.save(); T.sig = ''; app.redraw(); toast(id ? '🗑 ' + (best.blk.t === 'vrata' || n > 2 ? 'Prozor/vrata izbrisani.' : 'Izbrisano.') : '🗑 Izbrisano. (Poništi ↶ vraća)');
}
function splitTool(p) {
  const f = app.currentFloor(), sp = (f.tlocrt && f.tlocrt.wallSplit) || [], th = ((T.m || T.mGeo) && (T.m || T.mGeo).theta) || 0, r = 18 / app.scale();
  const hit = sp.findIndex(x => { if (x.off) return false; const P = C.rotP(x.o === 'H' ? { x: x.at, y: x.c } : { x: x.c, y: x.at }, th); return Math.hypot(P.x - p.x, P.y - p.y) < r; });
  if (hit >= 0) { const x = sp[hit]; if (x.auto) x.off = true; else sp.splice(hit, 1); app.save(); T.sig = ''; T.mGeo = null; toast('Oznaka loma zida uklonjena.'); app.redraw(); return; }
  if (!cutTap(p)) toast('✂ Dodirni crtu koju treba razrezati.');
}
function blkTool(p, finger) { blkQuickClose();
  const lay = ($('layer') && $('layer').value) || 'nacrt', h = blkHit(p, lay === 'nacrt' ? T.blkMode : null);
  if (h) { blkMenu(h); return; }
  if (lay !== 'nacrt') { toast('Prozori i vrata se postavljaju u sloju Nacrt (gumb N). Ovdje dodir na postojeći otvara njegove postavke.'); return; }
  if (T.blkMode === 'vrata' && !finger) blkDragStart(p); else blkPlace(p, T.blkMode); }
/* u načinima ✂ / 🪟 / 🚪 prst služi za pomicanje i zumiranje; kratki dodir prstom (bez pomicanja i drugog prsta) radi isto što i olovka */
function fingerTap(p, e, act) {
  const sx = e.clientX, sy = e.clientY, t0 = Date.now(), id = e.pointerId; let multi = false;
  const dn = ev => { if (ev.pointerId !== id) multi = true; };
  const up = ev => { if (ev.pointerId !== id) return; window.removeEventListener('pointerdown', dn, true); window.removeEventListener('pointerup', up, true); window.removeEventListener('pointercancel', up, true);
    if (!multi && ev.type === 'pointerup' && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 10 && Date.now() - t0 < 500) act(); };
  window.addEventListener('pointerdown', dn, true); window.addEventListener('pointerup', up, true); window.addEventListener('pointercancel', up, true);
  return 'hand';
}
app.hooks.tap.push((p, e) => {
  if (!T.blkMode && !T.splitMode && e && $('layer') && $('layer').value === 'kote' && blkHit(p)) { const sx = e.clientX, sy = e.clientY, t0 = Date.now(), id = e.pointerId, n0 = app.items().length;
    const up = ev => { if (ev.pointerId !== id) return; window.removeEventListener('pointerup', up, true);
      if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 8 && Date.now() - t0 < 450) setTimeout(() => { if ($('typedBox')) return; const it = app.items(); if (it.length > n0) { const o = it[it.length - 1]; if (o && o.layer === 'kote' && o.pts && o.pts.length < 6) { it.pop(); app.save(); app.redraw(); } } const h = blkHit(p); if (h) blkMenu(h); }, 30); };
    window.addEventListener('pointerup', up, true); return false; }
  if (T.dbMode) { dbStart(p); return true; }
  if (T.delMode && e && e.pointerType === 'touch') return fingerTap(p, e, () => delTap(p));
  if (T.delMode) { delTap(p); return true; }
  if ((T.splitMode || T.blkMode) && e && e.pointerType === 'touch') return fingerTap(p, e, () => { if (T.splitMode) splitTool(p); else blkTool(p, true); });
  if (T.splitMode) { splitTool(p); return true; }
  if (T.blkMode) { blkTool(p, false); return true; }
  if (T.regPick) { T.regPick.push(p); if (T.regPick.length < 2) { app.status('◫ Dodirni suprotni kut.'); app.redraw(); return true; } const [a, b] = T.regPick; T.regPick = null; T.region = { x0: Math.min(a.x, b.x), y0: Math.min(a.y, b.y), x1: Math.max(a.x, b.x), y1: Math.max(a.y, b.y) }; app.status('◫ Prikazuje se samo označeni dio. „Cijeli crtež” u popisu vraća sve.'); showMissing(); return true; }
  if (T.pin) { const pp = T.pin; pp.pts.push(p); if (pp.pts.length < 2) { app.status('📌 Kota ' + pp.name + ': dodirni drugo mjesto.'); app.redraw(); return true; }
    const th = T.m ? T.m.theta : 0, A = C.rotP(pp.pts[0], -th), B = C.rotP(pp.pts[1], -th), L = tl(app.currentFloor()).labels; L[pp.sig] = Object.assign({}, L[pp.sig], { pin: { a: { x: Math.round(A.x * 10) / 10, y: Math.round(A.y * 10) / 10 }, b: { x: Math.round(B.x * 10) / 10, y: Math.round(B.y * 10) / 10 } } });
    T.pin = null; T.flash = { sigs: new Set([pp.sig]), until: Date.now() + 6000 }; clearTimeout(T.flashT); T.flashT = setTimeout(() => { T.flash = null; app.redraw(); }, 6100); app.status('📌 Kota ' + pp.name + ' dodijeljena dodirom – žuto je ono što sad mjeri.'); app.save(); schedule(); app.redraw(); return true; }
  if (T.moving) { const o = T.moving; T.moving = null; app.snapshot(); o.x = p.x; o.y = p.y; app.save(); app.redraw(); return true; }
  for (const h of T.pinHits) if (p.x >= h.x0 && p.x <= h.x1 && p.y >= h.y0 && p.y <= h.y1) { viewPhoto(h.o); return true; }
  for (const h of T.hits) if (p.x >= h.x0 && p.x <= h.x1 && p.y >= h.y0 && p.y <= h.y1) { editLabel(h.l); return true; }
  if (T.missing) { const r = 14 / app.scale(); for (const it of T.missing) if (Math.hypot(p.x - it.p.x, p.y - it.p.y) < r) { alert(it.text); return true; } }
  return false;
});
app.hooks.photo.push(p => askPhoto(p));

/* gumbi u gornjoj traci */
function addButtons() {
  const bar = document.querySelector('.app-top .top-actions'); if (!bar || $('terenKote')) return;
  const b1 = document.createElement('button'); b1.id = 'terenKote'; b1.title = 'Uz svaku kotu prikaži pročitani broj'; const upd = () => { b1.innerHTML = '<span>🔢 Kote</span>'; b1.classList.toggle('active', T.on); }; upd();
  b1.onclick = () => { T.on = !T.on; store.set('izmjera-teren-kote', T.on ? '1' : '0'); upd(); if (T.on) { analyzeNow(); runOcr(); } app.redraw(); };
  const b2 = document.createElement('button'); b2.id = 'terenMissing'; b2.title = 'Prije odlaska s objekta: koje mjere nedostaju'; b2.innerHTML = '<span>❓ Što nedostaje</span>'; b2.onclick = showMissing;
  const b3 = document.createElement('button'); b3.id = 'terenVeze'; b3.title = 'Uz svaku kotu prikaži što program misli da mjeri'; const upd3 = () => { b3.innerHTML = '<span>🔗 Veze</span>'; b3.classList.toggle('active', T.links); }; upd3();
  b3.onclick = () => { T.links = !T.links; store.set('izmjera-teren-veze', T.links ? '1' : '0'); upd3(); if (T.links) { schedule(); app.status('🔗 Veze: zeleno = sigurno, narančasto = nije siguran, crveno = nepročitano ili bez zida, smeđi okvir = broj preblizu zidu ili drugom broju (odmakni ga). Dodirni kotu ili oblačić za ispravak ili 📌 dodjelu.'); } app.redraw(); };
  bar.insertBefore(b2, bar.firstChild); bar.insertBefore(b3, bar.firstChild); bar.insertBefore(b1, bar.firstChild);
  const ph = document.querySelector('[data-tool="photo"]');
  if (ph && !$('terenSplit')) { const b4 = document.createElement('button'); b4.id = 'terenSplit'; b4.type = 'button'; b4.title = 'Razreži crtu na dva dijela (pa višak izbriši)'; b4.textContent = '✂ Razreži';
    b4.onclick = () => { T.splitMode = !T.splitMode; b4.classList.toggle('active', T.splitMode); if (T.splitMode) { analyzeNow(); app.status('✂ Razreži: dodirni crtu na mjestu gdje je treba razrezati – postane dvije crte, pa višak izbrišeš Gumicom ili Odabirom. Ponovno ✂ Razreži za kraj.'); } else app.status(''); app.redraw(); };
    ph.parentNode.insertBefore(b4, ph.nextSibling);
    const mk = (id, t, label, tip) => { const b = document.createElement('button'); b.id = id; b.type = 'button'; b.title = tip; b.textContent = label;
      b.onclick = () => { blkQuickClose(); T.delMode = false; $('terenDel') && $('terenDel').classList.remove('active'); T.blkMode = T.blkMode === t ? null : t; T.splitMode = false; $('terenSplit').classList.remove('active'); ['terenProzor', 'terenVrata'].forEach(x => $(x) && $(x).classList.toggle('active', T.blkMode === ($(x).id === 'terenProzor' ? 'prozor' : 'vrata')));
        if (T.blkMode) { analyzeNow(); app.status((t === 'prozor' ? '🪟 Prozor' : '🚪 Vrata') + ': dodirni zid gdje ' + (t === 'prozor' ? 'je prozor' : 'su vrata – ili olovkom povuci luk od šarki, na stranu na koju se otvaraju, do drugog kraja vrata') + '. Dodir na postojeći ' + (t === 'prozor' ? 'prozor' : 'vrata') + ' otvara mjere. Ponovno gumb za kraj.'); } else app.status(''); app.redraw(); };
      return b; };
    const bp = mk('terenProzor', 'prozor', '🪟 Prozor', 'Prozor dodirom na zid'), bv = mk('terenVrata', 'vrata', '🚪 Vrata', 'Vrata dodirom na zid');
    const svg = d => '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px;margin-right:4px">' + d + '</svg>';
    bp.innerHTML = svg('<path d="M2 12h3M19 12h3"/><rect x="5" y="8.5" width="14" height="7" rx="0.8"/><path d="M5 12h14" stroke-width="1.4"/>') + 'Prozor';
    bv.innerHTML = svg('<path d="M2 20h3M19 20h3"/><path d="M5 20V6"/><path d="M5 6a14 14 0 0114 14"/>') + 'Vrata';
    b4.parentNode.insertBefore(bv, b4.nextSibling); b4.parentNode.insertBefore(bp, b4.nextSibling);
    const bd = document.createElement('button'); bd.id = 'terenDel'; bd.type = 'button'; bd.title = 'Izbriši označeno ili dodirom'; bd.textContent = '🗑 Izbriši';
    bd.onclick = () => { const sa = $('selectionActions'); if (sa && !sa.hidden && $('deleteSelection')) { $('deleteSelection').click(); toast('🗑 Označeno izbrisano. (Poništi ↶ vraća)'); return; }
      T.delMode = !T.delMode; bd.classList.toggle('active', T.delMode); if (T.delMode) { T.blkMode = null; T.splitMode = false; ['terenProzor', 'terenVrata', 'terenSplit'].forEach(x => $(x) && $(x).classList.remove('active')); blkQuickClose(); toast('🗑 Dodirni ono što treba izbrisati. Ponovno 🗑 za kraj.'); } app.redraw(); };
    bv.parentNode.insertBefore(bd, bv.nextSibling);
    const bdb = document.createElement('button'); bdb.id = 'terenDb'; bdb.type = 'button'; bdb.title = 'Debljina zida: povuci olovkom uzduž zida (ili dodirni zid) i upiši debljinu'; bdb.textContent = '🧱 Debljina';
    bdb.onclick = () => { T.dbMode = !T.dbMode; bdb.classList.toggle('active', T.dbMode); if (T.dbMode) { T.blkMode = null; T.splitMode = false; T.delMode = false; ['terenProzor', 'terenVrata', 'terenSplit', 'terenDel'].forEach(x => $(x) && $(x).classList.remove('active')); blkQuickClose(); toast('🧱 Povuci uzduž zida dio iste debljine (dodir = cijeli zid), pa upiši cm. Uz zidove piše debljina: smeđe = upisano, ~sivo = pretpostavljeno. Ponovno 🧱 za kraj.'); } else T.dbSel = null; app.redraw(); };
    bd.parentNode.insertBefore(bdb, bd.nextSibling);
    for (const id of ['terenProzor', 'terenVrata', 'terenSplit', 'terenDel']) { const x = $(id); if (!x) continue; const o0 = x.onclick; x.onclick = ev => { if (T.dbMode) { T.dbMode = false; bdb.classList.remove('active'); T.dbSel = null; } return o0 && o0.call(x, ev); }; }
    const off = b4.onclick; b4.onclick = () => { T.blkMode = null; T.delMode = false; $('terenDel') && $('terenDel').classList.remove('active'); ['terenProzor', 'terenVrata'].forEach(x => $(x) && $(x).classList.remove('active')); off(); }; }
}
addButtons(); document.addEventListener('DOMContentLoaded', addButtons);
/* za vođeno mjerenje, stubište i ostale dodatke (izmjera-vodic.js) */
/* v2.26: brzi izbor iznad trake (Vrata: vrsta, strana; Prozor: vrsta) */
(window.__ctxP = window.__ctxP || []).push(() => { try {
  const getL = t => { try { return JSON.parse(store.get('izmjera-blk-' + t) || '{}'); } catch (e) { return {}; } }, setL = (t, o) => store.set('izmjera-blk-' + t, JSON.stringify(Object.assign(getL(t), o)));
  const last = T.lastBlk && blkMain(T.lastBlk), lastOf = t => last && last.blk && last.blk.t === t ? last.blk : null;
  if (T.blkMode === 'vrata') { const L = getL('vrata'), cur = L.kl ? 'kl' : L.bk ? 'bk' : L.dvo ? 'dvo' : 'jk', lb = lastOf('vrata');
    const act = a => { const M = blkMain(T.lastBlk); if (!M) return; const B = M.blk; if (a === 'hg') B.hg = B.hg ? 0 : 1; if (a === 'sw') B.sw = -(B.sw || 1); blkBuild(B, true); };
    return { t: '🚪 Vrata:', items: [['Jednokrilna', 'jk'], ['Dvokrilna', 'dvo'], ['Klizna', 'kl'], ['Otvor bez krila', 'bk']].map(([l, k]) => ({ l, on: cur === k, fn: () => setL('vrata', { dvo: k === 'dvo', bk: k === 'bk', kl: k === 'kl' }) }))
      .concat([{ sep: 1 }, { l: '⇄ Lijeva / desna', dis: !lb, tip: 'zadnja postavljena vrata', fn: () => act('hg') }, { l: '⇅ Unutra / van', dis: !lb, tip: 'zadnja postavljena vrata', fn: () => act('sw') }]) }; }
  if (T.blkMode === 'prozor') { const L = getL('prozor'), cur = L.pv || '', lp = lastOf('prozor');
    return { t: '🪟 Prozor:', items: [['Prozor', ''], ['Fiksno ostakljenje', 'fix'], ['Staklena opeka', 'opeka']].map(([l, k]) => ({ l, on: cur === k, fn: () => { setL('prozor', { pv: k }); if (lp && (lp.pv || '') !== k && Date.now() - parseInt(String(lp.id).slice(1), 36) < 15000) { lp.pv = k; blkBuild(lp, true); } } })) }; }
} catch (e) { } return null; });
window.IzmjeraTeren = { blkIz, blkSides, blkWideWarn, blkPlaceOd, blkEndWord, blkCorner, blkNb, blkWd, T, tl, stateOf, analyzeNow, schedule, collectMissing, gapPoint, labelState, toast, sheet, esc, geoM, blkScale, blkMain, blkBuild, blkText, blkMenu, blkMissing, fingerTap, signature, toRaw };
const css = document.createElement('style'); css.textContent =
  '#terenPanel{position:fixed;right:10px;top:56px;width:340px;max-width:calc(100vw - 20px);max-height:calc(100vh - 80px);overflow:auto;z-index:40;background:#fff;border:2px solid #dc2626;border-radius:12px;padding:10px 12px;box-shadow:0 8px 24px #0003;font:14px Arial;color:#102b52}' +
  '#terenPanel[hidden]{display:none}.tp-head{display:flex;gap:8px;align-items:center;justify-content:space-between}.tp-head b{flex:1}.tp-head button,.tp-row button{min-height:40px;padding:6px 12px;border-radius:9px;border:1px solid #b8cde5;background:#fff;color:#17457f;font-weight:700;font-size:14px}' +
  '#terenPanel ol{padding-left:0;list-style:none;margin:8px 0}#terenPanel li{display:flex;gap:8px;align-items:flex-start;padding:7px 4px;border-bottom:1px solid #e5edf6;cursor:pointer;line-height:1.3}' +
  '.tp-n{flex:none;width:24px;height:24px;border-radius:50%;background:#dc2626;color:#fff;font-weight:800;font-size:12px;display:flex;align-items:center;justify-content:center}.tp-note{font-size:12px;color:#4a6584}' +
  '.tp-sheet{position:fixed;inset:0;z-index:70;background:#0006;display:flex;align-items:center;justify-content:center;padding:16px}.tp-card{background:#fff;border-radius:14px;padding:14px;max-width:min(720px,100%);max-height:100%;overflow:auto;font:15px Arial;color:#102b52}' +
  '.tp-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.tp-img{display:block;max-width:100%;max-height:60vh;margin:8px auto;border-radius:8px}.tp-lab{display:flex;flex-direction:column;gap:4px;font-weight:700;font-size:13px;margin-top:8px}.tp-lab input{font-size:16px;padding:8px;border:2px solid #9dbbe0;border-radius:8px}' +
  '#terenKote.active{background:#dcfce7!important;color:#065f46!important}';
document.head.appendChild(css);
})();
