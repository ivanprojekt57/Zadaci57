/* Izmjera 57 — vođeno mjerenje, provjera uživo, stubište iz bloka, obris s druge etaže, nazivi i visine prostorija,
   jaki kontrast (sunce), „Izvezi sve” i sigurnosne kopije. */
(function () {
'use strict';
const app = window.IzmjeraApp, C = window.IzmjeraTlocrtCore, TR = window.IzmjeraTeren; if (!app || !C || !TR) return;
const $ = id => document.getElementById(id);
const store = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { } } };
const esc = TR.esc, toast = TR.toast, sheet = TR.sheet, T = TR.T;
const num = v => { const x = parseFloat(String(v == null ? '' : v).replace(',', '.')); return Number.isFinite(x) ? x : NaN; };
const fmt = (v, d) => C.fmt(v, d);
const GREEN = '#15803d';
const projVrsta = () => { const v = (window.projectInfo && window.projectInfo.vrsta) || []; return Array.isArray(v) ? v : []; };
const curLayer = () => ($('layer') && $('layer').value) || 'nacrt';

/* ======================= 📏 VOĐENO MJERENJE ======================= */
const V = { on: false, q: null, skip: new Set(), val: '', target: null, left: null, live: null, liveSig: '', room: null, bodEnd: {}, P: null, simSt: null, wtDirect: new Set(), c3: [] };
const HANDLED = new Set(['gap', 'viol', 'ow', 'nd', 'nk', 'od', 'rd', 'st']);
function simState() { const st = JSON.parse(JSON.stringify(T.st)); st.settings = T.st.settings; for (const k of ['answers', 'decisions', 'openings', 'labels', 'niches', 'nicheKind', 'offPick', 'stairs', 'roomSwap']) st[k] = st[k] || {}; return st; }
function autoAns(st, q) {
  if (q.type === 'gap') st.answers[q.key] = { ax: q.ax, si: q.si, sj: q.sj, value: q.est, est: true };
  else if (q.type === 'viol') st.decisions[q.key] = 'accept';
  else if (q.type === 'ow') st.openings[q.key] = Object.assign({}, st.openings[q.key], { w: q.est, est: true });
  else if (q.type === 'nd') st.niches[q.key] = { d: q.est, est: true };
  else if (q.type === 'nk') st.nicheKind[q.key] = q.nis.kind;
  else if (q.type === 'od') st.offPick[q.key] = 'avg';
  else if (q.type === 'rd') st.roomSwap[q.key] = 'ab';
  else if (q.type === 'st') st.stairs[q.key] = { n: q.est.n, L: q.est.L, w: q.est.w, dir: q.stair.dir || 1, est: true };
  else return false; return true;
}
/* sva pitanja (bez preskočenih), redom kako ih postavlja Tlocrt → DXF */
function questions(limit) {
  const out = []; if (!T.m || !T.st) return out; let st; try { st = simState(); } catch (e) { return out; }
  for (let i = 0; i < 150 && out.length < (limit || 999); i++) { let q; try { q = C.nextQuestion(T.m, st); } catch (e) { break; } if (!q) break;
    if (HANDLED.has(q.type) && !V.skip.has(q.key) && !(q.type === 'ow' && blkOnOp(q.op))) out.push(q); if (!autoAns(st, q)) break; }
  V.simSt = st; return out;
}
/* prostorije (nazivi s Opisa) bez svijetle visine h=… */
function needHeights() { const v = projVrsta(); return v.includes('legalizacija') || v.includes('energetski') || labelsOfKind('visina').length > 0; }
function labelVal(l) { const ov = (T.st && T.st.labels[l.sig]) || {}; return ov.value != null ? ov.value : (l.text != null ? l.text : l.rec); }
function labelsOfKind(kind) { if (!T.m) return []; return T.m.labels.filter(l => { const t = labelVal(l); if (t == null) return false; try { return C.parseLabel(String(t)).kind === kind; } catch (e) { return false; } }); }
function roomsNoHeight() {
  if (!T.m) return []; const rooms = (T.m.rooms || []).filter(r => !r.view && String(r.text || '').trim()), hs = labelsOfKind('visina'), has = new Set();
  for (const l of hs) { let b = null, bd = Infinity; for (const r of rooms) { const d = Math.hypot(r.x - l.cx, r.y - l.cy); if (d < bd) { bd = d; b = r; } } if (b) has.add(b); }
  return rooms.filter(r => !has.has(r));
}
const raw = p => TR.toRaw(p);
function opPoint(op) { const w = T.m.walls[op.wall], u = (op.s0 + op.s1) / 2; return raw(w.o === 'H' ? { x: u, y: w.c } : { x: w.c, y: u }); }
/* ---------- prostorije sa skice: zatvorena područja omeđena zidovima (u koordinatama analize) ---------- */
const RM = { m: null, sig: null, list: [] };
function roomsOf(all, withView, Wraw) { /* all: i uske plohe (za alat Zub/niša); withView: i crte Pogleda kao granice (terasa iz obrisa) */
  const m = T.m; if (!m) return [];
  if (!all && RM.m === m && RM.sig === T.sig) return RM.list;
  const OUT = []; if (!all) { RM.m = m; RM.sig = T.sig; RM.list = OUT; }
  const E = m.E || 10, WALL = Wraw || m.walls, W = Wraw || m.walls.filter(w => (withView || !w.view) && !w.obj);
  let xs = [], ys = [];
  for (const w of W) { if (w.o === 'V') { xs.push(w.c); ys.push(w.e0, w.e1); } else { ys.push(w.c); xs.push(w.e0, w.e1); } }
  if (xs.length < 2 || ys.length < 2) return OUT;
  const tolU = Wraw ? 0.35 * E : 0.05; /* nacrtane crte: spojevi rukom nisu na desetinku točni */
  const uq = a => { a.sort((p, q) => p - q); const r = []; for (const v of a) if (!r.length || v - r[r.length - 1] > tolU) r.push(v); return r; };
  xs = uq(xs); ys = uq(ys); xs.unshift(xs[0] - 5 * E); xs.push(xs[xs.length - 1] + 5 * E); ys.unshift(ys[0] - 5 * E); ys.push(ys[ys.length - 1] + 5 * E);
  const nx = xs.length - 1, ny = ys.length - 1, near = (a, v) => { let b = 0, bd = Infinity; a.forEach((x, k) => { const d = Math.abs(x - v); if (d < bd) { bd = d; b = k; } }); return b; };
  const bX = new Int32Array((nx + 1) * ny).fill(-1), bY = new Int32Array(nx * (ny + 1)).fill(-1); // id zida na granici ćelija
  for (const w of W) {
    if (w.o === 'V') { const i = near(xs, w.c); for (let j = 0; j < ny; j++) { const yc = (ys[j] + ys[j + 1]) / 2; if (yc > w.e0 && yc < w.e1) bX[i * ny + j] = w.id; } }
    else { const j = near(ys, w.c); for (let i = 0; i < nx; i++) { const xc = (xs[i] + xs[i + 1]) / 2; if (xc > w.e0 && xc < w.e1) bY[i * (ny + 1) + j] = w.id; } }
  }
  const comp = new Int32Array(nx * ny).fill(-1), comps = [];
  for (let i0 = 0; i0 < nx; i0++) for (let j0 = 0; j0 < ny; j0++) {
    if (comp[i0 * ny + j0] >= 0) continue; const id = comps.length, cells = [], stk = [i0 * ny + j0]; comp[i0 * ny + j0] = id; let out = false;
    const go = (a, b, wl) => { if (a < 0 || b < 0 || a >= nx || b >= ny || wl >= 0) return; const k = a * ny + b; if (comp[k] >= 0) return; comp[k] = id; stk.push(k); };
    while (stk.length) { const k = stk.pop(), i = Math.floor(k / ny), j = k % ny; cells.push(k); if (i === 0 || j === 0 || i === nx - 1 || j === ny - 1) out = true;
      go(i + 1, j, bX[(i + 1) * ny + j]); go(i - 1, j, bX[i * ny + j]); go(i, j + 1, bY[i * (ny + 1) + j + 1]); go(i, j - 1, bY[i * (ny + 1) + j]); }
    comps.push({ id, cells, out });
  }
  const cellOf = p => { let i = -1, j = -1; for (let k = 0; k < nx; k++) if (p.x >= xs[k] && p.x < xs[k + 1]) { i = k; break; } for (let k = 0; k < ny; k++) if (p.y >= ys[k] && p.y < ys[k + 1]) { j = k; break; } return i < 0 || j < 0 ? -1 : comp[i * ny + j]; };
  const names = (m.rooms || []).filter(r => !r.view && String(r.text || '').trim()), hs = labelsOfKind('visina');
  for (const c of comps) {
    if (c.out) continue; let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, area = 0, big = null, bigA = -1; const rects = [], wl = new Map();
    const addW = (id, side, u0, u1) => { if (id < 0) return; let e = wl.get(id); if (!e) wl.set(id, e = { w: WALL[id], sides: new Set(), u0: Infinity, u1: -Infinity }); e.sides.add(side); e.u0 = Math.min(e.u0, u0); e.u1 = Math.max(e.u1, u1); };
    for (const k of c.cells) { const i = Math.floor(k / ny), j = k % ny, a = (xs[i + 1] - xs[i]) * (ys[j + 1] - ys[j]);
      x0 = Math.min(x0, xs[i]); x1 = Math.max(x1, xs[i + 1]); y0 = Math.min(y0, ys[j]); y1 = Math.max(y1, ys[j + 1]); area += a; rects.push([xs[i], ys[j], xs[i + 1], ys[j + 1]]);
      if (a > bigA) { bigA = a; big = { x: (xs[i] + xs[i + 1]) / 2, y: (ys[j] + ys[j + 1]) / 2 }; }
      addW(bX[i * ny + j], 1, ys[j], ys[j + 1]); addW(bX[(i + 1) * ny + j], -1, ys[j], ys[j + 1]); addW(bY[i * (ny + 1) + j], 1, xs[i], xs[i + 1]); addW(bY[i * (ny + 1) + j + 1], -1, xs[i], xs[i + 1]); }
    if (!all && Math.min(x1 - x0, y1 - y0) < 2.2 * E || area < 8 * E * E) continue; // uske trake (npr. između dvije crte istog zida)
    const has = p => cellOf(p) === c.id;
    const nm = names.find(r => has(r)), hasH = hs.some(l => has({ x: l.cx, y: l.cy }));
    if (!all) { const th0 = m.theta || 0; if (zubGroups().some(g => { let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity; for (const o of g.its) for (const q of o.pts) { const a = C.rotP(q, -th0); a0 = Math.min(a0, a.x); a1 = Math.max(a1, a.x); b0 = Math.min(b0, a.y); b1 = Math.max(b1, a.y); } return x0 > a0 - 2 * E && x1 < a1 + 2 * E && y0 > b0 - 2 * E && y1 < b1 + 2 * E; })) continue; } /* ploha označena alatom Zub/niša – nije prostorija */
    const r = { key: [x0, y0, x1, y1].map(Math.round).join(':'), x0, x1, y0, y1, c: big, rects, has, walls: [...wl.values()].filter(e => e.u1 - e.u0 > 0.8 * E), name: nm ? String(nm.text).trim() : null, hasH };
    r.x = nm ? nm.x : big.x; r.y = nm ? nm.y : big.y; OUT.push(r);
  }
  OUT.sort((a, b) => (Math.abs(a.c.y - b.c.y) > 3 * E ? a.c.y - b.c.y : a.c.x - b.c.x));
  OUT.forEach((r, k) => { r.text = r.name || ('Prostorija ' + (k + 1)); });
  return OUT;
}
function nearRoom(r, p) { if (r.has(p)) return true; const E = T.m.E || 10; for (const [dx, dy] of [[E, 0], [-E, 0], [0, E], [0, -E]]) if (r.has({ x: p.x + dx, y: p.y + dy })) return true; return false; }
function axisIdx(ax, s) { const m = T.m; let b = -1, bd = m.E * 0.6; m.axes[ax].forEach((a, i) => { const d = Math.abs(a.s - s); if (d <= bd) { bd = d; b = i; } }); return b; }
function hasSpan(r, ax, a, b) {
  const m = T.m, E = m.E, i = axisIdx(ax, a), j = axisIdx(ax, b);
  for (const l of m.labels) { if (l.gap && l.gap.ax === ax && Math.abs(l.gap.si - a) < 0.6 * E && Math.abs(l.gap.sj - b) < 0.6 * E && nearRoom(r, { x: l.cx, y: l.cy })) return true;
    const sp = l.span; if (!sp || !nearRoom(r, { x: l.cx, y: l.cy })) continue; if (sp.room) return true; /* samo kote upisane u toj prostoriji – susjedna soba može imati drukčiju mjeru */
    if (sp.ax === ax && i >= 0 && j >= 0 && ((sp.i === i && sp.j === j) || (sp.i === j && sp.j === i))) return true; }
  return false;
}
function roomWallAt(r, wid, u) { const e = r.walls.find(x => x.w.id === wid); return !!e && u >= e.u0 - 0.5 * T.m.E && u <= e.u1 + 0.5 * T.m.E; }
function wallOfPt(q, o) { const m = T.m; let w = null, bd = 1.5 * m.E; const u = o === 'H' ? q.x : q.y, v = o === 'H' ? q.y : q.x; for (const x of m.walls) { if (x.view || x.o !== o || u < x.e0 - m.E || u > x.e1 + m.E) continue; const d = Math.abs(v - x.c); if (d < bd) { bd = d; w = x; } } return w ? { w, u } : null; }
function blkWallOf(B) { const th = T.m.theta || 0, q = C.rotP(B.c, -th), d = C.rotP(B.dv, -th), o = Math.abs(d.x) > 0.7 ? 'H' : 'V'; return wallOfPt(q, o); }
function inRoomQ(r, q) {
  const m = T.m, E = m.E;
  if (q.type === 'gap') { const o = q.ax === 'X' ? 'V' : 'H', ok = s => r.walls.some(e => e.w.o === o && Math.abs(e.w.c - s) < 0.6 * E); if (!ok(q.si) || !ok(q.sj)) return false; return nearRoom(r, TR.gapPoint(q)); }
  if (q.type === 'viol' || q.type === 'od' || q.type === 'rd') return nearRoom(r, { x: q.label.cx, y: q.label.cy });
  if (q.type === 'ow') return roomWallAt(r, q.op.wall, (q.op.s0 + q.op.s1) / 2);
  if (q.type === 'nd' || q.type === 'nk') { const n = q.nis, u = (n.s0 + n.s1) / 2; return nearRoom(r, n.o === 'H' ? { x: u, y: n.cW } : { x: n.cW, y: u }); }
  if (q.type === 'st') { const S = q.stair, a = (S.a0 + S.a1) / 2, c = (S.c0 + S.c1) / 2; return nearRoom(r, S.o === 'H' ? { x: a, y: c } : { x: c, y: a }); }
  return false;
}
function blkOnOp(op) { if (!T.m || !op) return false; const E = T.m.E; return blocks().some(b => { const h = blkWallOf(b); return h && h.w.id === op.wall && h.u > op.s0 - E && h.u < op.s1 + E; }); } /* širinu otvora iz bloka pita blok (š/v p=) */
function blocks() { return app.items().filter(o => o.blk && o.blk.main && !/^(stube|krovni|otvorp|terasa|greda|prag|stup)$/.test(o.blk.t) && o.blk.c && o.blk.dv).map(o => o.blk); }
function knownT(w) { const S = TR.tl(app.currentFloor()), k = C.wallKey(w); return !!(w.tLabel || S.wallT[k] || (V.simSt && V.simSt._derivedT && V.simSt._derivedT[k])); }
function blkSteps(B, out, r, ws) { if (!(B.w > 0) && !V.skip.has('blk:' + B.id)) out.push({ type: 'blk', key: 'blk:' + B.id, id: B.id, p: B.c, room: r }); if (!(B.od >= 0 && B.od !== null) && !V.skip.has('bod:' + B.id)) out.push({ type: 'bod', key: 'bod:' + B.id, id: B.id, room: r, ws: ws || 0 }); }
/* v2.68: strana zida s koje se mjeri udaljenost prozora/vrata (±1; 0 = ne zna se) */
function bodWs(q, B) { const base = B.odWs || q.ws || 0; return base && V.oodFlip && V.oodFlip[q.key] ? -base : base; }
function opCorner(op, side, ws) { const m = T.m, w = m.walls[op.wall], E = m.E, cand = [w.e0, w.e1];
  for (const x of m.walls) { if (x.view || x.obj || x.o === w.o || Math.max(Math.abs(x.e0 - w.c), Math.abs(x.e1 - w.c)) < 3 * E || x.c < w.e0 - E || x.c > w.e1 + E || w.c < x.e0 - 1.5 * E || w.c > x.e1 + 1.5 * E) continue; if (ws > 0 && !(x.e1 > w.c + 1.5 * E)) continue; if (ws < 0 && !(x.e0 < w.c - 1.5 * E)) continue; /* v2.62: samo zidovi s te strane zida gdje se mjeri */ cand.push(x.c); }
  const ok = cand.filter(u => side > 0 ? u >= op.s1 - 0.3 * E : u <= op.s0 + 0.3 * E); return ok.length ? (side > 0 ? Math.min(...ok) : Math.max(...ok)) : (side > 0 ? w.e1 : w.e0); }
function oodWs(q) { const sd = (q.e && q.e.sides.has(1)) ? 1 : -1; return V.oodFlip && V.oodFlip[q.key] ? -sd : sd; }
/* v2.62: susjedni otvor na istom zidu između otvora i ugla (za mjeru „od otvora do otvora”) */
function oodNb(q, dir) { if (q.nis) return null; const op = q.op, ws = oodWs(q), uc = opCorner(op, dir, ws); let best = null;
  for (const o of T.m.openings) { if (o === op || o.wall !== op.wall) continue; if (dir > 0 ? !(o.s0 >= op.s1 - 1 && o.s1 <= uc + 1) : !(o.s1 <= op.s0 + 1 && o.s0 >= uc - 1)) continue; if (!best || (dir > 0 ? o.s0 < best.s0 : o.s1 > best.s1)) best = o; }
  return best; }
function opGeo(q, side) { const m = T.m, op = q.op, w = m.walls[op.wall], E = m.E, sd = oodWs(q), P = u => w.o === 'H' ? { x: u, y: w.c + sd * 0.3 * E } : { x: w.c + sd * 0.3 * E, y: u };
  if (Math.abs(side) === 2) { const dir = Math.sign(side), nb = oodNb(q, dir); if (nb) return { A: P(dir > 0 ? nb.s0 : nb.s1), B: P(dir > 0 ? op.s1 : op.s0), nb }; side = dir; }
  const uc = opCorner(op, side, sd), ue = side > 0 ? op.s1 : op.s0; return { A: P(uc), B: P(ue) }; }
function cpSide(q) { if (V.bodEnd[q.key] && q.sides.includes(V.bodEnd[q.key])) return V.bodEnd[q.key]; const b = q.col.bb, ax = q.ax; let best = q.sides[0], bd = Infinity; for (const sd of q.sides) { const w = C.colWall(T.m, b, ax, sd), d = sd < 0 ? (ax === 'X' ? b.x0 : b.y0) - w.c : w.c - (ax === 'X' ? b.x1 : b.y1); if (d < bd) { bd = d; best = sd; } } return best; }
function cpGeo(q, sd) { const b = q.col.bb, w = C.colWall(T.m, b, q.ax, sd); if (!w) return null; if (q.ax === 'X') { const y = (b.y0 + b.y1) / 2; return { A: { x: w.c, y }, B: { x: sd < 0 ? b.x0 : b.x1, y } }; } const x = (b.x0 + b.x1) / 2; return { A: { x, y: w.c }, B: { x, y: sd < 0 ? b.y0 : b.y1 } }; }
function oodSide(q) { if (V.bodEnd[q.key]) return V.bodEnd[q.key]; const op = q.op, ws = oodWs(q); return Math.abs(op.s0 - opCorner(op, -1, ws)) <= Math.abs(opCorner(op, 1, ws) - op.s1) ? -1 : 1; }
const CW = { lijevi: '← Od lijevog ugla', desni: 'Od desnog ugla →', gornji: '↑ Od gornjeg ugla', donji: '↓ Od donjeg ugla' };
function roomOps(r, used, out) { const m = T.m, B = T.B; if (!B || !B.ops) return; const bl = blocks().map(b => ({ b, h: blkWallOf(b) })).filter(x => x.h);
  m.openings.forEach((op, k) => { const o = B.ops[k]; if (!o || o.offset || o.offset2 || o.chain || (m._opRel || []).some(r => r.B.op === o)) return; /* v2.62: izmjereno od susjednog otvora (pita se još samo susjedni, od ugla) */ const u = (op.s0 + op.s1) / 2, key = 'ood:' + op.wall + ':' + Math.round(op.s0) + ':' + Math.round(op.s1);
    if (used.has(key) || V.skip.has(key) || !roomWallAt(r, op.wall, u)) return; if (bl.some(x => x.h.w.id === op.wall && x.h.u > op.s0 - m.E && x.h.u < op.s1 + m.E)) return; /* blok ima svoje pitanje */ if ((V.c3 || []).some(c => (c.A === op && !(c.d3.a > 0)) || (c.B === op && !(c.d3.b > 0)))) return; /* mjeri se kao dio debljine zida (od vrata do zida) */
    used.add(key); out.push({ type: 'ood', key, op, e: r.walls.find(x => x.w.id === op.wall), room: r }); }); }
/* zid između dvije sobe bez otvora: debljina = razmak vrata u hodniku − (vrata→zid u sobi A) − (vrata→zid u sobi B) */
function wt3Store() { const S = TR.tl(app.currentFloor()); return S.wt3 = S.wt3 || {}; }
function wt3Cands(rooms) {
  const m = T.m, E = m.E, out = []; if (!m) return out; const W3 = wt3Store();
  for (const w of m.walls) {
    if (w.view || w.obj || w.exterior) continue; const k = C.wallKey(w), d3 = W3[k] || {};
    if (V.wtDirect.has(k) || (knownT(w) && !(d3.a > 0 || d3.b > 0 || d3.h > 0))) continue;
    if (m.openings.some(op => op.wall === w.id)) continue;
    for (const kEnd of [0, 1]) { if (!w.snapped[kEnd]) continue; const u = kEnd ? w.e1 : w.e0, dir = Math.sign((kEnd ? w.e0 : w.e1) - u) || 1;
      const P = m.walls.find(x => x.o !== w.o && !x.view && Math.abs(x.c - u) < 0.6 * E && w.c > x.e0 - E && w.c < x.e1 + E); if (!P) continue;
      const opsP = m.openings.filter(op => op.wall === P.id), A = opsP.filter(op => op.s1 <= w.c + 0.3 * E).sort((a, b) => b.s1 - a.s1)[0], B = opsP.filter(op => op.s0 >= w.c - 0.3 * E).sort((a, b) => a.s0 - b.s0)[0]; if (!A || !B) continue;
      const pt = (along, off) => w.o === 'H' ? { x: u + off, y: along } : { x: along, y: u + off };
      const rA = rooms.find(r => r.has(pt((A.s0 + A.s1) / 2, dir * 1.5 * E))), rB = rooms.find(r => r.has(pt((B.s0 + B.s1) / 2, dir * 1.5 * E))), rH = rooms.find(r => r.has(pt(w.c, -dir * 1.5 * E))) || null;
      if (!rA || !rB || rA === rB) continue;
      out.push({ w, k, P, u, dir, A, B, rA, rB, rH, pt, d3 }); break; }
  }
  return out;
}
function blkOfOp(op) { if (!T.m || !op) return null; const E = T.m.E; return blocks().find(b => { const h = blkWallOf(b); return h && h.w.id === op.wall && h.u > op.s0 - E && h.u < op.s1 + E; }) || null; }
function c3OfBlk(B) { for (const c of V.c3 || []) for (const [part, op] of [['a', c.A], ['b', c.B]]) { const b = blkOfOp(op); if (b && b.id === B.id) return { c, part }; } return null; }
function c3Pt(c) { return raw(c.w.o === 'H' ? { x: c.u, y: c.w.c } : { x: c.w.c, y: c.u }); }
function wt3Done(c) { const d = c.d3; return d.a > 0 && d.b > 0 && d.h > 0; }
/* v2.38: najveći pravokutni dio prostorije (L-oblik, soba s izbočenjem) – unutarnja mjera se traži tamo gdje se stvarno mjeri, od zida do zida */
function mainSpan(r, ax) { const R = r.rects || []; if (R.length < 2) return null; const lo = ax === 'X' ? 1 : 0, hi = lo + 2, a0 = ax === 'X' ? 0 : 1, a1 = a0 + 2, cuts = [...new Set(R.flatMap(q => [q[lo], q[hi]]))].sort((x, y) => x - y), cand = [];
  for (let k = 0; k < cuts.length - 1; k++) { const b0 = cuts[k], b1 = cuts[k + 1], mid = (b0 + b1) / 2; if (b1 - b0 < 1e-6) continue; const iv = R.filter(q => q[lo] <= mid && q[hi] >= mid).map(q => [q[a0], q[a1]]).sort((x, y) => x[0] - y[0]), mg = [];
    for (const v of iv) { if (mg.length && v[0] <= mg.at(-1)[1] + 0.5) mg.at(-1)[1] = Math.max(mg.at(-1)[1], v[1]); else mg.push(v.slice()); }
    for (const v of mg) { const p = cand.find(c => Math.abs(c.a - v[0]) < 0.5 && Math.abs(c.b - v[1]) < 0.5 && Math.abs(c.b1 - b0) < 0.5); if (p) p.b1 = b1; else cand.push({ a: v[0], b: v[1], b0, b1 }); } }
  let best = null; for (const c of cand) { c.A = (c.b - c.a) * (c.b1 - c.b0); if (!best || c.A > best.A) best = c; } return best; }
/* v2.38: lica izbočenja (dimnjak, stup uz zid, zadebljanje) nisu zidovi prostorije – za njih se ne pita debljina zida ni „razmak između zidova”, nego samo mjere izbočenja */
function zubFaces() { const m = T.m, B = T.B, out = new Set(); if (!m || !B || !B.nis) return out; const E = m.E;
  for (const n of B.nis) { if (n.src !== 'zub' || n.kind !== 'zadebljanje') continue; const c0 = Math.min(n.cW, n.nc != null ? n.nc : n.cW), c1 = Math.max(n.cW, n.nc != null ? n.nc : n.cW);
    for (const w of m.walls) { if (w.exterior) continue; const len = w.e1 - w.e0;
      if (w.o === n.o) { if (w.c >= c0 - 0.6 * E && w.c <= c1 + 0.6 * E && w.e0 >= n.s0 - E && w.e1 <= n.s1 + E && len <= (n.s1 - n.s0) + E) out.add(w.id); }
      else if (w.c >= n.s0 - 0.6 * E && w.c <= n.s1 + 0.6 * E && w.e0 >= c0 - E && w.e1 <= c1 + E) out.add(w.id); } }
  return out; }
function faceAxis(ax, sv, faces) { const m = T.m, o = ax === 'X' ? 'V' : 'H', ws = m.walls.filter(w => w.o === o && Math.abs(w.c - sv) < 0.6 * m.E); if (ws.length) return ws.every(w => faces.has(w.id));
  return ((T.B && T.B.nis) || []).some(n => n.src === 'zub' && n.kind === 'zadebljanje' && (n.o === o ? [n.cW, n.nc] : [n.s0, n.s1]).some(v => v != null && Math.abs(v - sv) < 0.6 * m.E)); }
/* v2.38: balkon/terasa nacrtani u sloju Pogled – Mjeri pita i duljinu (od ruba do ruba), ne samo dubinu */
function viewAxis(ax, sv) { const m = T.m, o = ax === 'X' ? 'V' : 'H', ws = m.walls.filter(w => w.o === o && Math.abs(w.c - sv) < 0.6 * m.E); return ws.length > 0 && ws.every(w => w.view); }
function viewDims() { const m = T.m, out = []; if (!m) return out; const E = m.E, vw = m.walls.filter(w => w.view), sc = scaleNow();
  for (const W of vw) { const perp = vw.filter(p => p.o !== W.o && W.c >= p.e0 - 1.5 * E && W.c <= p.e1 + 1.5 * E), a = perp.find(p => Math.abs(p.c - W.e0) < 1.5 * E), b = perp.find(p => Math.abs(p.c - W.e1) < 1.5 * E); if (!a || !b || a === b) continue;
    const ax = W.o === 'H' ? 'X' : 'Y', si = Math.min(a.c, b.c), sj = Math.max(a.c, b.c), i = axisIdx(ax, si), j = axisIdx(ax, sj);
    if (m.labels.some(l => (l.gap && l.gap.ax === ax && Math.abs(l.gap.si - si) < 0.6 * E && Math.abs(l.gap.sj - sj) < 0.6 * E) || (l.span && l.span.ax === ax && i >= 0 && j >= 0 && ((l.span.i === i && l.span.j === j) || (l.span.i === j && l.span.j === i))))) continue;
    const mid = ((a.e0 + a.e1) / 2 + (b.e0 + b.e1) / 2) / 2, at = W.c + Math.sign(mid - W.c) * 1.4 * E;
    out.push({ type: 'gap', view: true, rest: true, key: 'vdim:' + ax + ':' + Math.round(si) + ':' + Math.round(sj), ax, si, sj, at, est: sc > 0 ? Math.round((sj - si) * sc) : 0, room: REST }); }
  return out; }
function roomSteps(r, qs, used) {
  const out = [], take = f => { for (const q of qs) if (!used.has(q) && f(q) && inRoomQ(r, q)) { used.add(q); out.push(q); } };
  const E0 = T.m.E, faces = V.faces || new Set();
  for (const ax of ['X', 'Y']) { const sp = mainSpan(r, ax), a = sp ? sp.a : (ax === 'X' ? r.x0 : r.y0), b = sp ? sp.b : (ax === 'X' ? r.x1 : r.y1), key = 'rdim:' + ax + ':' + Math.round(a) + ':' + Math.round(b);
    if (!V.skip.has(key) && !hasSpan(r, ax, a, b)) out.push({ type: 'rdim', key, ax, si: a, sj: b, room: r, band: sp ? [sp.b0, sp.b1] : null }); }
  take(q => q.type === 'viol' || q.type === 'rd');
  /* ista mjera se ne traži dvaput: razmak između ista dva zida koji je već „unutarnja mjera” prostorije */
  for (const q of qs) if (!used.has(q) && q.type === 'gap' && out.some(d => d.type === 'rdim' && d.ax === q.ax && Math.abs(d.si - q.si) < E0 && Math.abs(d.sj - q.sj) < E0) && inRoomQ(r, q)) used.add(q);
  const gq = []; for (const q of qs) if (!used.has(q) && q.type === 'gap' && inRoomQ(r, q)) { used.add(q); gq.push(q); } /* v2.76: dužine zidova idu u obilazak prostorije zajedno s otvorima */
  /* otvori, niše, zubovi: redom „u krug” po prostoriji (od vrata, u smjeru kazaljke), za svaki odmah mjere pa udaljenost */
  const m = T.m, th = m.theta || 0, G = new Map(), opKey = op => 'o:' + op.wall + ':' + Math.round(op.s0), opPt = op => { const w = m.walls[op.wall], u = (op.s0 + op.s1) / 2; return w.o === 'H' ? { x: u, y: w.c } : { x: w.c, y: u }; };
  const gAdd = (key, p, q, door) => { let g = G.get(key); if (!g) G.set(key, g = { p, steps: [], door: false }); g.steps.push(q); if (door) g.door = true; };
  for (const B of blocks()) { if (used.has('b:' + B.id)) continue; const h = blkWallOf(B); if (!h || !roomWallAt(r, h.w.id, h.u)) continue; used.add('b:' + B.id); const st0 = [], eW = r.walls.find(x => x.w.id === h.w.id); blkSteps(B, st0, r, eW ? (eW.sides.has(1) ? 1 : -1) : 0); const pB = C.rotP(B.c, -th); st0.forEach(q => gAdd('b:' + B.id, pB, q, B.t === 'vrata')); }
  for (const q of qs) { if (used.has(q) || !/^(ow|nd|nk|od|st)$/.test(q.type) || !inRoomQ(r, q)) continue; used.add(q); const b = q.op && blkOfOp(q.op);
    const p = q.op ? opPt(q.op) : q.nis ? (q.nis.o === 'H' ? { x: (q.nis.s0 + q.nis.s1) / 2, y: q.nis.cW } : { x: q.nis.cW, y: (q.nis.s0 + q.nis.s1) / 2 }) : q.label ? { x: q.label.cx, y: q.label.cy } : q.stair ? { x: (q.stair.a0 + q.stair.a1) / 2, y: (q.stair.c0 + q.stair.c1) / 2 } : r.c;
    gAdd(b ? 'b:' + b.id : q.op ? opKey(q.op) : q.nis ? 'n:' + Math.round(q.nis.s0) + ':' + Math.round(q.nis.cW) : q.key, p, q, q.op && q.op.type === 'vrata'); }
  if (T.B && T.B.nis) for (const n of T.B.nis) { const w = m.walls[n.wall]; if (!w) continue; const u = (n.s0 + n.s1) / 2, p = n.o === 'H' ? { x: u, y: n.cW } : { x: n.cW, y: u }; if (!roomWallAt(r, n.wall, u) && !nearRoom(r, p)) continue;
    const gk = 'n:' + Math.round(n.s0) + ':' + Math.round(n.cW), e = r.walls.find(x => x.w.id === n.wall);
    if (!(n.w > 0) && !used.has('nw:' + n.key) && !V.skip.has('nw:' + n.key)) { used.add('nw:' + n.key); gAdd(gk, p, { type: 'nw', key: 'nw:' + n.key, nkey: n.key, op: n, e, room: r }); }
    if (!n.corner && !n.offset && !n.opPos && e && !used.has('nod:' + n.key) && !V.skip.has('nod:' + n.key)) { used.add('nod:' + n.key); gAdd(gk, p, { type: 'ood', key: 'nod:' + n.key, op: n, nis: true, e, room: r }); } }
  /* samostojeći stup / dimnjak: veličina pa udaljenost od dva okomita zida */
  if (T.B && T.B.cols) for (const c of T.B.cols) { const b = c.bb, p = { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 }; if (!r.has(p)) continue; const gk = 'col:' + c.key;
    for (const [ax, have] of [['X', c.w > 0], ['Y', c.h > 0]]) { const key = 'cs' + ax + ':' + c.key; if (have || used.has(key) || V.skip.has(key)) continue; used.add(key); gAdd(gk, p, { type: 'cs', key, ax, col: c, room: r }); }
    for (const ax of ['X', 'Y']) { const key = 'cp' + ax + ':' + c.key; if (c.pos[ax] || used.has(key) || V.skip.has(key)) continue; const sides = [-1, 1].filter(sd => C.colWall(T.m, b, ax, sd)); if (!sides.length) continue; used.add(key); gAdd(gk, p, { type: 'cp', key, ax, col: c, sides, room: r }); } }
  { const tmp = []; roomOps(r, used, tmp); tmp.forEach(q => gAdd(opKey(q.op), opPt(q.op), q, q.op.type === 'vrata')); }
  const c3 = V.c3 || [], hs = [];
  for (const c of c3) { for (const [part, rr] of [['a', c.rA], ['b', c.rB], ['h', c.rH]]) { const key = 'wt3:' + c.k + ':' + part; if (rr !== r || c.d3[part] > 0 || used.has(key) || V.skip.has(key)) continue; if (part !== 'h') { const b = blkOfOp(part === 'a' ? c.A : c.B); if (b && !(b.od >= 0 && b.od !== null) && !V.skip.has('bod:' + b.id)) continue; } /* udaljenost od ugla bloka (od tog zida) = ova mjera */ used.add(key); const q = { type: 'wt3', key, part, c, room: r };
      if (part === 'h') hs.push(q); else { const op = part === 'a' ? c.A : c.B, b = blkOfOp(op); gAdd(b ? 'b:' + b.id : opKey(op), opPt(op), q, op.type === 'vrata'); } } }
  for (const q of gq) { let gp = null; try { gp = TR.gapPoint(q); } catch (e) { } const a = q.ax === 'X' ? (q.si + q.sj) / 2 : (gp ? gp.x : (r.x0 + r.x1) / 2), b = q.ax === 'X' ? (gp ? gp.y : (r.y0 + r.y1) / 2) : (q.si + q.sj) / 2; gAdd('g:' + q.key, { x: a, y: b }, q, false); }
  const wts = [];
  for (const e of r.walls) { const w = e.w, k = C.wallKey(w); if (used.has('w:' + k) || V.skip.has('wt:' + k) || knownT(w) || faces.has(w.id)) continue; { const c = c3.find(x => x.k === k); if (c && !(wt3Done(c) || ['a', 'b', 'h'].some(pp => V.skip.has('wt3:' + k + ':' + pp)))) continue; } used.add('w:' + k); const q = { type: 'wt', key: 'wt:' + k, wk: k, w, e, room: r }; wts.push(q);
    const u = (Math.max(e.u0, w.e0) + Math.min(e.u1, w.e1)) / 2; gAdd('w:' + k, w.o === 'H' ? { x: u, y: w.c } : { x: w.c, y: u }, q, false); }
  /* redom „u krug” po prostoriji: od vrata u smjeru kazaljke – za svaki zid dužina, otvori na njemu s mjerama i udaljenošću, pa debljina */
  { const cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2, ang = g => Math.atan2(g.p.y - cy, g.p.x - cx), rank = { gap: -1, blk: 0, ow: 0, nk: 1, nw: 1.5, nd: 2, cs: 1, cp: 3, bod: 3, ood: 3, od: 3, wt3: 4, st: 5, wt: 6 };
    /* strana prostorije (gore, desno, dolje, lijevo = smjer kazaljke) i položaj uzduž nje; na svakoj strani: dužina zida, otvori redom, debljina */
    const side = g => { const p = g.p, d = [p.y - r.y0, r.x1 - p.x, r.y1 - p.y, p.x - r.x0]; let k = 0; for (let i = 1; i < 4; i++) if (d[i] < d[k]) k = i; return k; }, along = (g, k) => k === 0 ? g.p.x : k === 1 ? g.p.y : k === 2 ? -g.p.x : -g.p.y, cls = g => g.steps[0].type === 'gap' ? 0 : g.steps[0].type === 'wt' ? 2 : 1;
    for (const g of G.values()) { g.k = side(g); g.t = along(g, g.k); g.c = cls(g); }
    let gs = [...G.values()].sort((a, b) => a.k - b.k || a.c - b.c || a.t - b.t || ang(a) - ang(b)); const dg = gs.find(g => g.door); if (dg) { const d0 = gs.findIndex(g => g.k === dg.k); if (d0 > 0) gs = gs.slice(d0).concat(gs.slice(0, d0)); }
    for (const g of gs) g.steps.sort((a, b) => (rank[a.type] || 0) - (rank[b.type] || 0)).forEach(q => out.push(q)); hs.forEach(q => out.push(q)); }
  wts.forEach(q => { q.word = wtWord(q); }); const cnt = {}; wts.forEach(q => cnt[q.word] = (cnt[q.word] || 0) + 1); const idx = {}; wts.forEach(q => { if (cnt[q.word] > 1) { idx[q.word] = (idx[q.word] || 0) + 1; q.part = idx[q.word] + '/' + cnt[q.word]; } });
  if (needHeights() && !r.hasH && !V.skip.has('vis:' + r.key)) out.push({ type: 'vis', key: 'vis:' + r.key, room: r });
  if (!r.name && !V.skip.has('nm:' + r.key)) out.push({ type: 'nm', key: 'nm:' + r.key, room: r });
  return out;
}
const REST = { key: 'rest', text: 'Ostalo' };
function plan() {
  TR.analyzeNow(true); for (let k = 0; k < 3 && autoStep(); k++); const faces = V.faces = zubFaces(), qs = questions().filter(q => !(q.type === 'gap' && faces.size && (faceAxis(q.ax, q.si, faces) || faceAxis(q.ax, q.sj, faces)))), rooms = roomsOf(), used = new Set(), per = new Map(); V.c3 = wt3Cands(rooms);
  const cur = V.room && V.room.key !== 'rest' ? (rooms.find(x => x.key === V.room.key) || rooms.find(x => V.room.c && x.has(V.room.c))) : null;
  for (const r of cur ? [cur, ...rooms.filter(x => x !== cur)] : rooms) per.set(r.key, roomSteps(r, qs, used));
  const rest = qs.filter(q => !used.has(q)).map(q => Object.assign(q, { rest: true }));
  for (const q of viewDims()) if (!V.skip.has(q.key) && !rest.some(x => x.key === q.key)) rest.unshift(q);
  for (const B of blocks()) if (!used.has('b:' + B.id)) blkSteps(B, rest, REST);
  for (const c of V.c3) { const key = 'wt3:' + c.k + ':h'; if (!c.rH && !(c.d3.h > 0) && !V.skip.has(key)) rest.push({ type: 'wt3', key, part: 'h', c, room: REST }); }
  if (needHeights()) for (const r of roomsNoHeight()) { if (rooms.some(x => x.has(r))) continue; const key = 'vis:' + r.text + ':' + Math.round(r.x) + ':' + Math.round(r.y); if (!V.skip.has(key)) rest.push({ type: 'vis', key, room: r }); }
  return { rooms, per, rest, cur };
}
function remaining() { const P = plan(); let n = P.rest.length; for (const v of P.per.values()) n += v.length; return n; }
function scaleNow() { try { const o = {}; const s = TR.blkScale(o); return s > 0 ? s : (o.s > 0 ? o.s : NaN); } catch (e) { return NaN; } }
function scrWord(a, b) { const A = app.screen(raw(a)), B = app.screen(raw(b)), dx = B.x - A.x, dy = B.y - A.y; return Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'lijevi' : 'desni') : (dy < 0 ? 'gornji' : 'donji'); }
function scrHor(a, b) { const A = app.screen(raw(a)), B = app.screen(raw(b)); return Math.abs(B.x - A.x) >= Math.abs(B.y - A.y); }
function wtWord(q) { const w = q.w, r = q.room, cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2; return scrWord({ x: cx, y: cy }, w.o === 'H' ? { x: cx, y: w.c } : { x: w.c, y: cy }); }
function bodEnd(B, ws) { if (V.bodEnd[B.id]) return V.bodEnd[B.id]; if (B.end) return (B.end > 0 ? 1 : -1) * (B.odNb ? 2 : B.odIz ? 3 : 1); const cc = c3OfBlk(B); if (cc) { const P0 = c3Pt(cc.c), d = sd => { const q = TR.blkCorner(B, sd, ws); return Math.hypot(q.x - P0.x, q.y - P0.y); }; return d(-1) <= d(1) ? -1 : 1; } const a = TR.blkCorner(B, -1, ws), b = TR.blkCorner(B, 1, ws); return Math.hypot(a.x - B.c.x, a.y - B.c.y) <= Math.hypot(b.x - B.c.x, b.y - B.c.y) ? -1 : 1; }
function targetOf(q) {
  if (q.type === 'gap' && q.view) { const a = q.ax === 'X' ? { x: q.si, y: q.at } : { x: q.at, y: q.si }, b = q.ax === 'X' ? { x: q.sj, y: q.at } : { x: q.at, y: q.sj }; return { kind: 'dim', a: raw(a), b: raw(b), p: raw({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }), A: a, B: b }; }
  if (q.type === 'gap') { const gp = Object.assign({}, TR.gapPoint(q)); { /* v2.38: kota uz balkon/terasu u Pogledu stoji kod te crte, ne negdje u kući */ const m = T.m, o = q.ax === 'X' ? 'V' : 'H'; for (const sv of [q.si, q.sj]) if (viewAxis(q.ax, sv)) { const w = m.walls.find(x => x.o === o && x.view && Math.abs(x.c - sv) < 0.6 * m.E); if (w) { if (q.ax === 'X') gp.y = (w.e0 + w.e1) / 2; else gp.x = (w.e0 + w.e1) / 2; break; } } } const a = q.ax === 'X' ? { x: q.si, y: gp.y } : { x: gp.x, y: q.si }, b = q.ax === 'X' ? { x: q.sj, y: gp.y } : { x: gp.x, y: q.sj };
    /* v2.62: oba zida između kojih se mjeri istaknuta cijelom duljinom */ const o = q.ax === 'X' ? 'V' : 'H', segs = T.m.walls.filter(w => w.o === o && !w.view && (Math.abs(w.c - q.si) < 1 || Math.abs(w.c - q.sj) < 1)).map(w => o === 'H' ? [raw({ x: w.e0, y: w.c }), raw({ x: w.e1, y: w.c })] : [raw({ x: w.c, y: w.e0 }), raw({ x: w.c, y: w.e1 })]);
    return { kind: 'dim', a: raw(a), b: raw(b), p: raw(gp), A: a, B: b, segs }; }
  if (q.type === 'viol' || q.type === 'od' || q.type === 'rd') { const l = q.label; return { kind: 'pt', p: raw({ x: l.cx, y: l.cy }), r: 26 }; }
  if (q.type === 'ow') return { kind: 'pt', p: opPoint(q.op), r: 22 };
  if (q.type === 'nd' && q.nis.nc != null && Math.abs(q.nis.nc - q.nis.cW) > 1) { const n = q.nis, u = (n.s0 + n.s1) / 2, a = n.o === 'H' ? { x: u, y: n.cW } : { x: n.cW, y: u }, b = n.o === 'H' ? { x: u, y: n.nc } : { x: n.nc, y: u }; return { kind: 'dim', a: raw(a), b: raw(b), p: raw({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }), A: a, B: b, r: 14 }; }
  if (q.type === 'nd' || q.type === 'nk') { const n = q.nis, u = (n.s0 + n.s1) / 2; return { kind: 'pt', p: raw(n.o === 'H' ? { x: u, y: n.cW } : { x: n.cW, y: u }), r: 22 }; }
  if (q.type === 'st') { const S = q.stair, a = (S.a0 + S.a1) / 2, c = (S.c0 + S.c1) / 2; return { kind: 'pt', p: raw(S.o === 'H' ? { x: a, y: c } : { x: c, y: a }), r: 30 }; }
  if (q.type === 'blk') return { kind: 'pt', p: q.p, r: 24 };
  if (q.type === 'rdim') { const r = q.room, c0 = r.c, sh = q.ax === 'X' ? { x: c0.x, y: c0.y - 0.2 * (r.y1 - r.y0) } : { x: c0.x + 0.22 * (r.x1 - r.x0), y: c0.y }, inB = v => !q.band || (v > q.band[0] + 1 && v < q.band[1] - 1), bm = q.band ? (q.band[0] + q.band[1]) / 2 : 0, y0 = r.has(sh) ? sh : c0, y = q.band && !inB(q.ax === 'X' ? y0.y : y0.x) ? (inB(q.ax === 'X' ? c0.y : c0.x) ? c0 : { x: bm, y: bm }) : y0 /* kota malo ustranu od naziva u sredini, ali unutar dijela koji se mjeri */, a = q.ax === 'X' ? { x: q.si, y: y.y } : { x: y.x, y: q.si }, b = q.ax === 'X' ? { x: q.sj, y: y.y } : { x: y.x, y: q.sj }; return { kind: 'dim', a: raw(a), b: raw(b), p: raw({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }), A: a, B: b }; }
  if (q.type === 'bod') { const M = TR.blkMain(q.id); if (!M) return null; const B = M.blk, ws = bodWs(q, B), end = bodEnd(B, ws), nbG = Math.abs(end) === 2 && TR.blkNb ? TR.blkNb(B, Math.sign(end), ws) : Math.abs(end) === 3 && TR.blkIz ? TR.blkIz(B, Math.sign(end), ws) : null, cr = nbG ? nbG.P : TR.blkCorner(B, Math.sign(end), ws), s = B.s || scaleNow() || 3, Wd = TR.blkWd(B, s), e = { x: B.c.x + B.dv.x * Math.sign(end) * Wd / 2, y: B.c.y + B.dv.y * Math.sign(end) * Wd / 2 }; const cc = c3OfBlk(B), w3 = cc && cc.c.w, wl = w3 ? [raw(w3.o === 'H' ? { x: w3.e0, y: w3.c } : { x: w3.c, y: w3.e0 }), raw(w3.o === 'H' ? { x: w3.e1, y: w3.c } : { x: w3.c, y: w3.e1 })] : null; return { kind: 'dim', a: cr, b: e, p: { x: (cr.x + e.x) / 2, y: (cr.y + e.y) / 2 }, r: 14, wall: wl }; }
  if (q.type === 'wt') { const w = q.w, u = (Math.max(q.e.u0, w.e0) + Math.min(q.e.u1, w.e1)) / 2, sd = q.e.sides.has(1) ? 1 : -1, E = T.m.E, a = w.o === 'H' ? { x: u, y: w.c } : { x: w.c, y: u }, b = w.o === 'H' ? { x: u, y: w.c + sd * 2.2 * E } : { x: w.c + sd * 2.2 * E, y: u }; return { kind: 'pt', p: raw(b), r: 20, wall: [raw(w.o === 'H' ? { x: Math.max(q.e.u0, w.e0), y: w.c } : { x: w.c, y: Math.max(q.e.u0, w.e0) }), raw(w.o === 'H' ? { x: Math.min(q.e.u1, w.e1), y: w.c } : { x: w.c, y: Math.min(q.e.u1, w.e1) })], at: raw(a) }; }
  if (q.type === 'nm') return { kind: 'pt', p: raw(q.room.c), r: 30 };
  if (q.type === 'wt3') { const c = q.c, E = T.m.E, ea = c.A.s1, eb = c.B.s0; let a, b;
    if (q.part === 'a') { a = c.pt(ea, c.dir * 0.4 * E); b = c.pt(c.w.c, c.dir * 0.4 * E); } else if (q.part === 'b') { a = c.pt(eb, c.dir * 0.4 * E); b = c.pt(c.w.c, c.dir * 0.4 * E); } else { a = c.pt(ea, -c.dir * 0.4 * E); b = c.pt(eb, -c.dir * 0.4 * E); }
    const w = c.w, wl = [raw(w.o === 'H' ? { x: w.e0, y: w.c } : { x: w.c, y: w.e0 }), raw(w.o === 'H' ? { x: w.e1, y: w.c } : { x: w.c, y: w.e1 })];
    return { kind: 'dim', a: raw(a), b: raw(b), p: raw({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }), A: a, B: b, r: 14, wall: wl }; }
  if (q.type === 'nw') { const n = q.op, E = T.m.E, sd = (q.e && q.e.sides.has(1)) ? 1 : -1, P = u => n.o === 'H' ? { x: u, y: n.cW + sd * 0.4 * E } : { x: n.cW + sd * 0.4 * E, y: u }, a = P(n.s0), b = P(n.s1); return { kind: 'dim', a: raw(a), b: raw(b), p: raw({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }), A: a, B: b, r: 14 }; }
  if (q.type === 'cs') { const b = q.col.bb, E = T.m.E, a = q.ax === 'X' ? { x: b.x0, y: b.y0 - 0.5 * E } : { x: b.x0 - 0.5 * E, y: b.y0 }, c = q.ax === 'X' ? { x: b.x1, y: b.y0 - 0.5 * E } : { x: b.x0 - 0.5 * E, y: b.y1 }; return { kind: 'dim', a: raw(a), b: raw(c), p: raw({ x: (a.x + c.x) / 2, y: (a.y + c.y) / 2 }), A: a, B: c, r: 14 }; }
  if (q.type === 'cp') { const g = cpGeo(q, cpSide(q)); if (!g) return null; return { kind: 'dim', a: raw(g.A), b: raw(g.B), p: raw({ x: (g.A.x + g.B.x) / 2, y: (g.A.y + g.B.y) / 2 }), A: g.A, B: g.B, r: 14 }; }
  if (q.type === 'ood') { const g = opGeo(q, oodSide(q)); return { kind: 'dim', a: raw(g.A), b: raw(g.B), p: raw({ x: (g.A.x + g.B.x) / 2, y: (g.A.y + g.B.y) / 2 }), A: g.A, B: g.B, r: 14 }; }
  if (q.type === 'vis') return { kind: 'pt', p: raw({ x: q.room.x, y: q.room.y }), r: 30 };
  return null;
}
function qText(q) {
  switch (q.type) {
    case 'rdim': { const s = scaleNow(), est = s > 0 ? Math.round((q.sj - q.si) * s) : null, hor = scrHor(q.ax === 'X' ? { x: q.si, y: 0 } : { x: 0, y: q.si }, q.ax === 'X' ? { x: q.sj, y: 0 } : { x: 0, y: q.sj });
      return { t: (hor ? '↔ Unutarnja mjera lijevo–desno' : '↕ Unutarnja mjera gore–dolje'), h: 'Od zida do zida (narančasta crta)' + (est ? ', procjena iz skice ' + est + ' cm' : '') + '.' }; }
    case 'bod': { const M = TR.blkMain(q.id), B = M && M.blk; if (!B) return { t: '', h: '' }; const ws = bodWs(q, B), end = bodEnd(B, ws), isV = B.t === 'vrata', two = Math.abs(end) === 2, three = Math.abs(end) === 3, izC = three && TR.blkIz ? TR.blkIz(B, Math.sign(end), ws) : null;
      const cs = [[-1, TR.blkEndWord(B, -1)], [1, TR.blkEndWord(B, 1)]]; for (const d of [-1, 1]) { const nb = TR.blkNb ? TR.blkNb(B, d, ws) : null; if (nb) { const wd = TR.blkEndWord(B, d), ar = wd.startsWith('←') ? ['← ', ''] : wd.startsWith('↑') ? ['↑ ', ''] : wd.startsWith('↓') ? ['↓ ', ''] : ['', ' →']; cs.push([2 * d, ar[0] + 'Od ' + (nb.t === 'vrata' ? 'susjednih vrata' : 'susjednog prozora') + ar[1]]); } }
      for (const d of [-1, 1]) { const iz = TR.blkIz ? TR.blkIz(B, d, ws) : null; if (iz) { const wd = TR.blkEndWord(B, d), ar = wd.startsWith('←') ? ['← ', ''] : wd.startsWith('↑') ? ['↑ ', ''] : wd.startsWith('↓') ? ['↓ ', ''] : ['', ' →']; cs.push([3 * d, ar[0] + 'Od izbočenja' + ar[1]]); } } /* v2.79 */
      return { t: (isV ? (B.bk ? '▭ Otvor' : '🚪 Vrata') : '🪟 Prozor') + (B.w > 0 ? ' ' + TR.blkText(B) : '') + ' – udaljenost ' + (two ? 'od susjednog otvora' : three ? 'od izbočenja' : 'od ugla'), h: (two ? 'Od ruba susjednog prozora/vrata do ruba ' + (isV ? 'vrata' : 'prozora') + ' (zelena crta). Susjedni mora imati svoju udaljenost od ugla. ' : three ? 'Od lica izbočenja do ruba ' + (isV ? 'vrata' : 'prozora') + ' (zelena crta). ' + (izC && izC.ext ? 'Do ugla dodajem izbočenje ' + fmt(izC.ext) + ' cm. ' : 'Izbočenje još nema mjeru – izmjeri ga u ovoj prostoriji, pa se ' + (isV ? 'vrata smjeste' : 'prozor smjesti') + '. ') : 'Od ugla prostorije do ruba ' + (isV ? 'vrata' : 'prozora') + ' (zelena crta), mjereno s ove strane zida. ') + (c3OfBlk(B) ? 'Od označenog zida bez otvora – iz toga računam i njegovu debljinu. ' : '') + 'Odaberi od čega mjeriš:', corner: cs, cur: end, flip: !!ws, wallOf: c3OfBlk(B), zero: !two && !three }; }
    case 'wt': { const S = T.st && T.st.settings || C.DEFAULTS, def = q.w.exterior ? S.ext : S.int, word = (q.word || wtWord(q));
      return { t: 'Debljina zida – ' + word + (q.w.exterior ? ' (vanjski)' : '') + (q.part ? ', dio ' + q.part : ''), h: 'Izmjeri u otvoru vrata ili prozora (s žbukom). Zadano ' + fmt(def) + ' cm.', pre: String(def), quick: q.w.exterior ? [25, 30, 38, 40, 45, 50] : [8, 10, 12, 15, 20, 25] }; }
    case 'ood': { const nm = q.nis ? (q.op.kind === 'zadebljanje' ? 'izbočenja' : 'niše') : q.op.type === 'prozor' ? 'prozora' : q.op.type === 'vrata' ? 'vrata' : 'otvora', mid = (q.op.s0 + q.op.s1) / 2, w = T.m.walls[q.op.wall], ws = oodWs(q), at = s => { const u = opCorner(q.op, s, ws); return w.o === 'H' ? { x: u, y: w.c } : { x: w.c, y: u }; }, M = w.o === 'H' ? { x: mid, y: w.c } : { x: w.c, y: mid };
      const nbW = o => o.type === 'prozor' ? 'susjednog prozora' : o.type === 'vrata' ? 'susjednih vrata' : 'susjednog otvora', cs = [[-1, CW[scrWord(M, at(-1))]], [1, CW[scrWord(M, at(1))]]];
      for (const d of [-1, 1]) { const nb = oodNb(q, d); if (nb) { const wd = scrWord(M, at(d)), ar = { lijevi: ['← ', ''], desni: ['', ' →'], gornji: ['↑ ', ''], donji: ['↓ ', ''] }[wd] || ['', '']; cs.push([2 * d, ar[0] + 'Od ' + nbW(nb) + ar[1]]); } }
      const cur = oodSide(q), two = Math.abs(cur) === 2;
      return { t: (q.nis ? (q.op.kind === 'zadebljanje' ? '▨ Izbočenje' : '⊔ Niša') : q.op.type === 'prozor' ? '🪟 Prozor' : q.op.type === 'vrata' ? '🚪 Vrata' : 'Otvor') + ' – udaljenost ' + (two ? 'od susjednog otvora' : 'od ugla'), h: (two ? 'Od ruba susjednog otvora do ruba ' + nm + ' (narančasta crta). Susjedni otvor mora imati svoju udaljenost od ugla.' : 'Od ugla do ruba ' + nm + ' (narančasta crta), mjereno s ove strane zida.') + ' Odaberi od čega mjeriš:', corner: cs, cur, flip: !q.nis, zero: !q.nis && !two }; }
    case 'wt3': { const c = q.c, nmo = op => op.type === 'prozor' ? 'prozora' : 'vrata', n = { a: 1, b: 2, h: 3 }[q.part], hd = 'Debljina zida ' + c.rA.text + ' / ' + c.rB.text + ' (' + n + '/3)';
      if (q.part === 'h') return { t: hd + ' – razmak između otvora', h: (c.rH ? 'U prostoriji ' + c.rH.text : 'Izvana') + ': od ruba jednih do ruba drugih ' + (c.A.type === 'prozor' && c.B.type === 'prozor' ? 'prozora' : 'vrata') + ' (narančasta crta). Iz tri mjere računam debljinu zida.', direct: true };
      const op = q.part === 'a' ? c.A : c.B; return { t: hd + ' – od ' + nmo(op) + ' do zida', h: 'Zid bez otvora (označen) ne možeš izmjeriti izravno. Izmjeri od ruba ' + nmo(op) + ' do tog zida (narančasta crta).', direct: true }; }
    case 'cs': { const sc = scaleNow(), b = q.col.bb, est = sc > 0 ? Math.round((q.ax === 'X' ? b.x1 - b.x0 : b.y1 - b.y0) * sc) : null, hor = scrHor(q.ax === 'X' ? { x: b.x0, y: 0 } : { x: 0, y: b.y0 }, q.ax === 'X' ? { x: b.x1, y: 0 } : { x: 0, y: b.y1 });
      return { t: '▨ Stup / dimnjak – ' + (hor ? 'širina lijevo–desno' : 'širina gore–dolje'), h: 'Stranica stupa (narančasta crta)' + (est ? ', procjena iz skice ' + est + ' cm' : '') + '.' }; }
    case 'cp': { const b = q.col.bb, M = { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 }, at = sd => q.ax === 'X' ? { x: M.x + sd * 50, y: M.y } : { x: M.x, y: M.y + sd * 50 };
      return { t: '▨ Stup / dimnjak – udaljenost od zida', h: 'Od zida do najbliže stranice stupa (narančasta crta), da se zna gdje stoji. Odaberi od kojeg zida mjeriš:', corner: q.sides.map(sd => [sd, SIDEW[scrWord(M, at(sd))]]), cur: cpSide(q) }; }
    case 'nw': { const sc = scaleNow(), est = sc > 0 ? Math.round((q.op.s1 - q.op.s0) * sc) : null; if (q.op.kind === 'zadebljanje') { const n = q.op, hor = scrHor(n.o === 'H' ? { x: n.s0, y: n.cW } : { x: n.cW, y: n.s0 }, n.o === 'H' ? { x: n.s1, y: n.cW } : { x: n.cW, y: n.s1 }); return { t: '▨ Izbočenje – stranica ' + (hor ? 'lijevo–desno' : 'gore–dolje'), h: 'Duljina označene stranice izbočenja (narančasta crta)' + (est ? ', procjena iz skice ' + est + ' cm' : '') + '.' }; } return { t: (q.op.kind === 'zadebljanje' ? '▨ Izbočenje (stup, dimnjak)' : '⊔ Niša') + ' – širina uz zid', h: 'Koliko je široko uz zid (narančasta crta)' + (est ? ', procjena iz skice ' + est + ' cm' : '') + '.' }; }
    case 'nm': { const c = nameCounts(), list = NAZIVI.slice().sort((a, b) => (c[b] || 0) - (c[a] || 0)).slice(0, 14); return { t: 'Naziv prostorije', h: 'Dodirni naziv ili ✎ upiši svoj (ili preskoči).', btns: list.map(n => [n, n]).concat([['__upis', '✎ Upiši naziv…']]), names: true }; }
    case 'gap': if (q.view) { const hor = scrHor(q.ax === 'X' ? { x: q.si, y: 0 } : { x: 0, y: q.si }, q.ax === 'X' ? { x: q.sj, y: 0 } : { x: 0, y: q.sj }); return { t: '▭ Balkon / terasa (Pogled) – duljina ' + (hor ? 'lijevo–desno' : 'gore–dolje'), h: 'Od ruba do ruba onoga što je nacrtano u Pogledu (narančasta crta)' + (q.est ? ', procjena iz skice ' + fmt(q.est) + ' cm' : '') + '.' }; }
      if (viewAxis(q.ax, q.si) !== viewAxis(q.ax, q.sj)) return { t: '▭ Balkon / terasa (Pogled) – udaljenost ruba od zida' + (q.rest ? ' (nije obavezno)' : ''), h: 'Od zida do ruba balkona/terase (narančasta crta), da se zna gdje stoji. Procjena iz skice: ' + fmt(q.est) + ' cm.', keys: ['0'], zero: true };
      if (viewAxis(q.ax, q.si) && viewAxis(q.ax, q.sj)) return { t: '▭ Balkon / terasa (Pogled) – ' + (q.ax === 'X' ? 'vodoravna' : 'okomita') + ' mjera', h: 'Od ruba do ruba (narančasta crta). Procjena iz skice: ' + fmt(q.est) + ' cm.' };
      const close = q.est > 0 && q.est < 45 ? ' Dva istaknuta zida na skici su skoro u istoj liniji (razmak ~' + fmt(q.est) + ' cm): ako su u istoj ravnini, stisni „Isti zid (0)”, a ako je jedan uvučen, upiši koliko.' : '';
      if (q.rest) return { t: (q.ax === 'X' ? '↔ Vodoravni' : '↕ Okomiti') + ' razmak između zidova (nije obavezno)', h: 'Mjera između dva istaknuta zida (narančasto).' + (close || ' Povezuje zidove različitih prostorija. Ako je ne možeš izmjeriti (npr. kroz vrata ili izvana), preskoči – uzet će se procjena iz skice ' + fmt(q.est) + ' cm.'), keys: ['0'], zero: true };
      return { t: (q.ax === 'X' ? '↔ Vodoravni' : '↕ Okomiti') + ' razmak između zidova', h: 'Svijetla mjera između dva istaknuta zida (narančasto).' + (close || ' Procjena iz skice: ' + fmt(q.est) + ' cm.'), keys: ['0'], zero: true };
    case 'viol': return { t: 'Kota #' + q.label.n + ' (' + fmt(q.value) + ') se ne slaže', h: (q.should > 0 ? 'Prema ostalim mjerama trebala bi biti oko ' + fmt(q.should, 0) + ' cm. ' : '') + 'Izmjeri ponovno i upiši – ili prihvati.', pre: String(q.value) };
    case 'ow': return { t: 'Širina otvora', h: (q.op.type === 'prozor' ? 'Prozor' : q.op.type === 'vrata' ? 'Vrata' : 'Otvor') + ' bez širine. Procjena ' + fmt(q.est) + ' cm.' };
    case 'nd': { const n = q.nis; if (n.kind === 'zadebljanje') { const u = (n.s0 + n.s1) / 2, nc = n.nc != null ? n.nc : n.cW + 1, hor = scrHor(n.o === 'H' ? { x: u, y: n.cW } : { x: n.cW, y: u }, n.o === 'H' ? { x: u, y: nc } : { x: nc, y: u }); return { t: '▨ Izbočenje – stranica ' + (hor ? 'lijevo–desno' : 'gore–dolje'), h: 'Duljina druge stranice izbočenja (narančasta crta). Procjena ' + fmt(q.est) + ' cm.' }; }
      return { t: '⊔ Niša – dubina', h: 'Koliko je niša duboka, od lica zida do dna niše (narančasta crta). Procjena ' + fmt(q.est) + ' cm.' }; }
    case 'nk': return { t: 'Zub u zidu', h: 'Je li to niša (udubljenje) ili zadebljanje (strši van)?', btns: [['nisa', 'Niša'], ['zadebljanje', 'Zadebljanje']] };
    case 'od': return { t: 'Udaljenost otvora izmjerena dvaput', h: 'S dvije strane zida: ' + fmt(q.a) + ' i ' + fmt(q.b) + ' cm. Koja je točna?', btns: [['a', fmt(q.a)], ['b', fmt(q.b)], ['avg', 'Prosjek']] };
    case 'rd': return { t: 'Mjere prostorije', h: 'Koja mjera ide vodoravno?', btns: [['ab', '↔ ' + fmt(q.a) + ' / ↕ ' + fmt(q.b)], ['ba', '↔ ' + fmt(q.b) + ' / ↕ ' + fmt(q.a)]] };
    case 'st': return { t: '🪜 Stubište nacrtano rukom', h: 'Rukom nacrtano stubište program ne čita pouzdano. Zamijeni ga blokom: crte stubišta se brišu, a blok dobije isti položaj, smjer i broj stuba. Mjere (gazište, širinu, položaj od zida) zatim upiši u bloku.', btns: [['stblk', '🪜 Zamijeni blokom']] };
    case 'blk': { const M = TR.blkMain(q.id), B = M && M.blk; return { t: (B && B.t === 'vrata' ? (B.bk ? '▭ Otvor (bez krila)' : '🚪 Vrata') : '🪟 Prozor') + ' bez mjera', h: 'Širina/visina' + (B && B.t === 'prozor' ? ' i parapet, npr. 120/140 p=90' : ', npr. 90/205 (dvokrilna nesimetrična: 80+40/205)') + '.', keys: B && B.t === 'vrata' ? ['+', '/'] : ['/', ' p='] }; }
    case 'vis': return { t: 'Svijetla visina – ' + q.room.text, h: 'Od poda do stropa (cm).', keys: [], same: true };
  }
  return { t: q.text || '', h: '' };
}
function addTyped(text, rawMid, dir, pin, layer) {
  const L = String(text).length, fs = app.typeFs ? app.typeFs() : 18, k = fs / 18, it = { type: 'text', layer: layer || 'kote', color: '#0000ff', x: Math.round((rawMid.x - L * 5 * k) * 10) / 10, y: Math.round((rawMid.y + 7 * k) * 10) / 10, text: String(text), dir }; if (fs !== 18) it.fs = fs;
  if (pin) it.pin = pin; app.items().push(it); return it;
}
function answer(v, extra) {
  const q = V.q; if (!q) return; const f = app.currentFloor(), S = TR.tl(f); app.snapshot();
  try { V.prev = { key: q.key, room: V.room, items: JSON.stringify(app.items()), tl: JSON.stringify(S), text: qText(q).t }; } catch (e) { V.prev = null; } /* za „↺ Ponovi zadnju mjeru” */
  if (q.type === 'gap') { if (v === 0 || extra === 'same') S.answers[q.key] = { ax: q.ax, si: q.si, sj: q.sj, value: 0, same: true };
    else if (v < 10) S.answers[q.key] = { ax: q.ax, si: q.si, sj: q.sj, value: v }; /* mali razmak: samo odgovor (broj ispod 10 se ne čita kao kota) */
    else { const tg = V.target, dx = tg.b.x - tg.a.x, dy = tg.b.y - tg.a.y, dir = Math.abs(dx) >= Math.abs(dy) ? 'H' : 'V', it = addTyped(fmt(v), { x: (tg.a.x + tg.b.x) / 2, y: (tg.a.y + tg.b.y) / 2 }, dir, null);
      it.gap = { ax: q.ax, si: Math.round(q.si * 100) / 100, sj: Math.round(q.sj * 100) / 100 }; } }
  else if (q.type === 'viol') { if (extra === 'accept') S.decisions[q.key] = 'accept'; else if (extra === 'ignore') S.decisions[q.key] = 'ignore'; else { (S.labels[q.key] = S.labels[q.key] || {}).value = String(v); delete S.decisions[q.key]; if (Math.abs(v - q.value) < 1e-9) S.decisions[q.key] = 'accept'; } }
  else if (q.type === 'ow') { const o = S.openings[q.key] = S.openings[q.key] || {}; o.w = v; delete o.est; }
  else if (q.type === 'nd') S.niches[q.key] = Object.assign({}, S.niches[q.key], { d: v });
  else if (q.type === 'nw') S.niches[q.nkey] = Object.assign({}, S.niches[q.nkey], { w: v });
  else if (q.type === 'cs' || q.type === 'cp') { const k = q.col.key, C0 = S.columns = S.columns || {}, o = C0[k] = Object.assign({}, C0[k]); if (q.type === 'cs') o[q.ax === 'X' ? 'w' : 'h'] = v; else { const sd = cpSide(q); o.pos = Object.assign({}, o.pos, { [q.ax]: { side: sd, v } }); delete V.bodEnd[q.key]; } }
  else if (q.type === 'nk') (S.nicheKind = S.nicheKind || {})[q.key] = extra;
  else if (q.type === 'st' && extra === 'stblk') stReplace(q.stair);
  else if (q.type === 'od') S.offPick[q.key] = extra;
  else if (q.type === 'rd') (S.roomSwap = S.roomSwap || {})[q.key] = extra;
  else if (q.type === 'blk') { const M = TR.blkMain(q.id); if (M) { const B = M.blk, m0 = /^(\d+(?:[.,]\d+)?)\s*\+\s*(\d+(?:[.,]\d+)?)(.*)$/.exec(String(extra || '').trim()); if (m0) { B.w1 = num(m0[1]); B.dvo = true; B.bk = false; extra = String(Math.round((num(m0[1]) + num(m0[2])) * 10) / 10) + m0[3]; } else if (B.w1) delete B.w1; const m = /^(\d+(?:[.,]\d+)?)\s*(?:[\/x×*]\s*(\d+(?:[.,]\d+)?))?(?:\s*p\s*=?\s*(-?\d+(?:[.,]\d+)?))?$/i.exec(String(extra || '').trim()); if (!m) { toast('Upiši npr. 120/140 p=90'); return false; }
      B.w = num(m[1]); B.h = m[2] ? num(m[2]) : null; B.p = m[3] != null ? num(m[3]) : null; try { store.set('izmjera-blk-' + B.t, JSON.stringify({ w: B.w, h: B.h || (B.t === 'vrata' ? 205 : 140), p: B.p, dvo: B.dvo })); } catch (e) { } TR.blkScale(B); TR.blkBuild(B, false); if (TR.blkWideWarn) TR.blkWideWarn(B); } }
  else if (q.type === 'rdim') { const tg = V.target, dir = scrHor(tg.A, tg.B) ? 'H' : 'V', rawDir = Math.abs(tg.b.x - tg.a.x) >= Math.abs(tg.b.y - tg.a.y) ? 'H' : 'V', it = addTyped(fmt(v), { x: (tg.a.x + tg.b.x) / 2, y: (tg.a.y + tg.b.y) / 2 }, rawDir, null);
    it.gap = { ax: q.ax, si: Math.round(q.si * 100) / 100, sj: Math.round(q.sj * 100) / 100 }; void dir; }
  else if (q.type === 'bod') { const M = TR.blkMain(q.id); if (M) { const B = M.blk, ws = bodWs(q, B), en = bodEnd(B, ws); B.od = v; B.end = en > 0 ? 1 : -1; B.odNb = Math.abs(en) === 2; { const iz = Math.abs(en) === 3 && TR.blkIz ? TR.blkIz(B, B.end, ws) : null; if (iz) B.odIz = { key: iz.key, dim: iz.dim }; else delete B.odIz; } if (ws) B.odWs = ws; delete V.bodEnd[q.id]; if (V.oodFlip) delete V.oodFlip[q.key]; { const cc = !B.odNb && !B.odIz && c3OfBlk(B); if (cc) { const P0 = c3Pt(cc.c), q0 = TR.blkCorner(B, B.end); if (Math.hypot(q0.x - P0.x, q0.y - P0.y) < 1.5 * T.m.E) { const W3 = wt3Store(); W3[cc.c.k] = Object.assign({}, W3[cc.c.k], { [cc.part]: v }); } } } TR.blkPlaceOd(B); TR.blkBuild(B, false); } }
  else if (q.type === 'wt') { S.wallT[q.wk] = v; V.lastT = v; }
  else if (q.type === 'wt3') { const c = q.c, W3 = wt3Store(), d = W3[c.k] = Object.assign({}, W3[c.k], { [q.part]: v });
    if (q.part !== 'h') { const op = q.part === 'a' ? c.A : c.B, k = T.m.openings.indexOf(op), o = T.B && T.B.ops && T.B.ops[k], side = c.w.c >= (op.s0 + op.s1) / 2 ? 1 : -1, e = (q.part === 'a' ? c.rA : c.rB).walls.find(x => x.w.id === c.P.id);
      if (o && !o.offset && !o.offset2 && e) { const g = opGeo({ op, e }, side), a = raw(g.A), b = raw(g.B), dir = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y) ? 'H' : 'V'; addTyped(fmt(v), { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, dir, { a: { x: Math.round(a.x * 10) / 10, y: Math.round(a.y * 10) / 10 }, b: { x: Math.round(b.x * 10) / 10, y: Math.round(b.y * 10) / 10 }, outer: false }); } }
    if (d.a > 0 && d.b > 0 && d.h > 0) { const t = Math.round((d.h - d.a - d.b) * 10) / 10; if (t >= 3 && t <= 80) { S.wallT[c.k] = t; toast('🧱 Debljina zida ' + c.rA.text + ' / ' + c.rB.text + ': ' + fmt(t) + ' cm (' + fmt(d.h) + ' − ' + fmt(d.a) + ' − ' + fmt(d.b) + ')'); } else toast('⚠ Iz tri mjere izlazi ' + fmt(t) + ' cm – to ne može biti debljina zida. Upiši debljinu izravno.'); } }
  else if (q.type === 'ood') { const g = opGeo(q, oodSide(q)), a = raw(g.A), b = raw(g.B), dir = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y) ? 'H' : 'V'; addTyped(fmt(v), { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, dir, { a: { x: Math.round(a.x * 10) / 10, y: Math.round(a.y * 10) / 10 }, b: { x: Math.round(b.x * 10) / 10, y: Math.round(b.y * 10) / 10 }, outer: false }); delete V.bodEnd[q.key]; }
  else if (q.type === 'nm') { const c = raw(q.room.c), it = addTyped(extra, { x: c.x, y: c.y }, 'H', null, 'opisi'); it.color = '#64748b'; /* v2.25: nazivi prostorija sivi */ const n = nameCounts(); n[extra] = (n[extra] || 0) + 1; store.set('izmjera-nazivi', JSON.stringify(n)); }
  else if (q.type === 'vis') { const c = raw({ x: q.room.x, y: q.room.y }); addTyped('h=' + fmt(v), { x: c.x, y: c.y + 26 }, 'H'); V.lastH = v; store.set('izmjera-zadnja-visina', String(v)); }
  app.save(); T.sig = ''; T.mGeo = null; return true;
}
function allHeights(v) { app.snapshot(); for (const r of roomsNoHeight()) { const c = raw({ x: r.x, y: r.y }); addTyped('h=' + fmt(v), { x: c.x, y: c.y + 26 }, 'H'); } V.lastH = v; store.set('izmjera-zadnja-visina', String(v)); app.save(); T.sig = ''; }
/* v2.83: zid nacrtan vidljivo uvučen/izbačen u odnosu na zid u produžetku (npr. desni zid donje sobe uži od sobe iznad), a program ga je zbog male razlike
   spojio u istu crtu – ako i mjere kažu da zidovi nisu u ravnini, i to na istu stranu kao na skici, crta se sama prelomi (ne pita se, ne treba „Prihvati”) */
function autoStep() {
  if (V.asBusy || !T.m || !T.st) return false; const f = app.currentFloor(), S = TR.tl(f), sp0 = (S.wallSplit || []).slice(), m0 = T.m, E = m0.E;
  const sig = (f.name || '') + '|' + T.sig + '|' + JSON.stringify(sp0) + '|' + JSON.stringify(S.labels || {}) + '|' + JSON.stringify(S.answers || {}); if (V.asSig === sig) return false; V.asSig = sig;
  const same = (a, b) => a.o === b.o && Math.abs(a.c - b.c) < 2 * E && Math.abs(a.at - b.at) < 2 * E, cands = [];
  for (const ax of ['X', 'Y']) m0.axes[ax].forEach((A, i) => { const L = A.line; if (!L || L.view || !L.segs || L.segs.length < 2) return; const rs = (L.runs || []).slice().sort((a, b) => a.a0 - b.a0);
    for (let k = 1; k < rs.length; k++) { const g0 = rs[k - 1].a1, g1 = rs[k].a0; if (g1 - g0 < 2 * E) continue; const mid = (g0 + g1) / 2;
      const side = lo => { let w = 0, s = 0; for (const sg of L.segs) { if (lo ? sg.a1 > mid : sg.a0 < mid) continue; const l = sg.a1 - sg.a0 + 1; w += l; s += l * sg.c; } return w ? s / w : null; }, cA = side(true), cB = side(false);
      if (cA == null || cB == null || Math.abs(cB - cA) < 1.2 * E) continue;
      for (const at of [g1, g0]) { const c = { o: ax === 'X' ? 'V' : 'H', c: Math.round(L.c * 10) / 10, at: Math.round(at * 10) / 10, auto: true, gap: true, step: true, sk: true }; if (sp0.some(h => same(h, c)) || cands.some(h => same(h.c, c))) continue; cands.push({ c, ax, i, dir: Math.sign(cB - cA) }); } } });
  if (!cands.length) return false;
  const lim = Math.max(2, Number((T.st.settings || {}).uskl) || 3), bigLim = Math.max(5, 2 * lim), big = info => info.B.cons.filter(c => c.kind === 'measure' && Number.isFinite(c.dev) && Math.abs(c.dev) > bigLim);
  let i0; try { i0 = C.fitInfo(m0, T.st); } catch (e) { return false; } const b0 = big(i0); if (!b0.length) return false;
  const an = sp => { const m = C.analyze(f, { splits: sp }); m.labels.forEach(l => { const k = l.ocrKey || l.sig; if (T.st.rec && T.st.rec[k] != null) l.rec = T.st.rec[k]; }); return m; };
  const carry = m1 => { const out = { wallT: Object.assign({}, T.st.wallT || {}), wallView: Object.assign({}, T.st.wallView || {}) };
    for (const k of ['wallT', 'wallView']) for (const w0 of m0.walls) { const v = (T.st[k] || {})[C.wallKey(w0)]; if (v == null) continue; for (const w1 of m1.walls) { if (w1.o !== w0.o || Math.abs(w1.c - w0.c) > 2 * E || w1.e0 < w0.e0 - E || w1.e1 > w0.e1 + E) continue; const k1 = C.wallKey(w1); if (out[k][k1] == null) out[k][k1] = v; } }
    return Object.assign({}, T.st, out); };
  const t0 = Date.now(); let best = null;
  for (const x of cands) { if (Date.now() - t0 > 3000) break; if (!b0.some(c => c.ax === x.ax && (c.i === x.i || c.j === x.i))) continue;
    const sp = sp0.concat([x.c]); let m2, st2, i2; try { m2 = an(sp); st2 = carry(m2); i2 = C.fitInfo(m2, st2); } catch (e) { continue; }
    const g = (i2.jogs || []).find(j => j.o === x.c.o && Math.abs(j.at - x.c.at) < 2 * E); if (!g || Math.abs(g.d) < 3 || Math.sign(g.d) !== x.dir) continue;
    if (!(i2.score < i0.score * 0.5) || !(big(i2).length < b0.length)) continue; if (!best || i2.score < best.score) best = { sp, st2, score: i2.score, x, d: g.d }; }
  if (!best) return false;
  V.asBusy = true; try { best.x.c.user = true; S.wallSplit = best.sp; S.wallT = best.st2.wallT; S.wallView = best.st2.wallView; app.save(); T.sig = ''; T.mGeo = null; TR.analyzeNow(true); } finally { V.asBusy = false; }
  V.asSig = (f.name || '') + '|' + T.sig + '|' + JSON.stringify(S.wallSplit) + '|' + JSON.stringify(S.labels || {}) + '|' + JSON.stringify(S.answers || {});
  toast('↔ ' + (best.x.c.o === 'V' ? 'Okomiti' : 'Vodoravni') + ' zidovi koje si nacrtao malo pomaknute nisu u ravnini ni po mjerama (razlika ≈ ' + Math.round(Math.abs(best.d)) + ' cm) – razdvojio sam ih. Ako je ipak jedan ravan zid: ✂ Razreži pa dodir na oznaku prijeloma.');
  app.redraw(); return true; }
/* v2.81: „↔ Zid ima skok” – zidovi nacrtani u istoj crti, a u stvarnosti nisu u ravnini: traži prijelom crte zida (u praznini između dijelova ili na spoju s poprečnim zidom) s kojim kota sjedne */
function stepFix(q) {
  const f = app.currentFloor(), S = TR.tl(f), sp0 = (S.wallSplit || []).slice(); if (!T.m || !T.st) { toast('Pričekaj analizu skice pa pokušaj ponovno.'); step(true); return; }
  const an = sp => { const m = C.analyze(f, { splits: sp }); m.labels.forEach(l => { const k = l.ocrKey || l.sig; if (T.st.rec && T.st.rec[k] != null) l.rec = T.st.rec[k]; }); return m; };
  const carry = (m0, m1) => { const out = { wallT: Object.assign({}, T.st.wallT || {}), wallView: Object.assign({}, T.st.wallView || {}) }, E = m0.E;
    for (const k of ['wallT', 'wallView']) for (const w0 of m0.walls) { const v = (T.st[k] || {})[C.wallKey(w0)]; if (v == null) continue; for (const w1 of m1.walls) { if (w1.o !== w0.o || Math.abs(w1.c - w0.c) > 2 * E || w1.e0 < w0.e0 - E || w1.e1 > w0.e1 + E) continue; const k1 = C.wallKey(w1); if (out[k][k1] == null) out[k][k1] = v; } }
    return Object.assign({}, T.st, out); };
  let i0; try { i0 = C.fitInfo(T.m, T.st); } catch (e) { toast('Ne mogu provjeriti – pokušaj ponovno.'); step(true); return; }
  const c0 = i0.B.cons.find(c => c.kind === 'measure' && c.label && c.label.sig === q.key && Number.isFinite(c.dev)); if (!c0) { toast('↔ Ova kota ne mjeri od zida do zida – prijelom ne pomaže.'); step(true); return; }
  const lim = Math.max(2, Number((T.st.settings || {}).uskl) || 3), t0 = Date.now(); let best = null;
  for (const cand of C.stepCands(T.m, c0)) { if (Date.now() - t0 > 3500) break; const sp = sp0.concat([cand]); let m2, st2, i2; try { m2 = an(sp); st2 = carry(T.m, m2); i2 = C.fitInfo(m2, st2); } catch (e) { continue; }
    const c2 = i2.B.cons.find(c => c.kind === 'measure' && c.label && c.label.sig === q.key && Number.isFinite(c.dev)); if (!c2 || Math.abs(c2.dev) > Math.max(lim, 0.25 * Math.abs(c0.dev))) continue; if (!(i2.score < i0.score * 0.6)) continue;
    if (!best || i2.score < best.score) best = { sp, st2, score: i2.score, cand, dev: c2.dev }; }
  if (!best) { toast('↔ Prijelom zida ne pomaže ovoj koti – provjeri mjeru (ili nacrtaj zid gdje stvarno je).'); step(true); return; }
  app.snapshot && app.snapshot(); best.cand.user = true; S.wallSplit = best.sp; S.wallT = best.st2.wallT; S.wallView = best.st2.wallView; app.save(); T.sig = ''; T.mGeo = null; TR.analyzeNow(true); app.redraw();
  toast('↔ Zid je prelomljen – kota #' + q.label.n + ' (' + fmt(q.value) + ') sad sjeda. Prijelom maknuti: ✂ Razreži i dodir na oznaku.'); step(true); }
function panelEl() { let p = $('vdPanel'); if (!p) { p = document.createElement('div'); p.id = 'vdPanel'; document.body.appendChild(p); } return p; }
function suggestNext(P) {
  const open = P.rooms.filter(r => (P.per.get(r.key) || []).length); if (!open.length) return null; const L = V.lastDone;
  if (L && L.walls) { const ids = new Set(L.walls.map(e => e.w.id)), nb = open.filter(r => r.walls.some(e => ids.has(e.w.id))); const pool = nb.length ? nb : open; return pool.slice().sort((a, b) => Math.hypot(a.c.x - L.c.x, a.c.y - L.c.y) - Math.hypot(b.c.x - L.c.x, b.c.y - L.c.y))[0]; }
  return open[0];
}
/* v2.76: kratka provjera na kraju prostorije – mjere i površina iz izračuna, upozorenje ako oblik jako odstupa od skice */
function roomCheckData(r) {
  const UI = window.IzmjeraTlocrtUI; if (!UI || !UI.buildFloor) return null; let b; try { b = UI.buildFloor(app.currentFloor()); } catch (e) { return null; } const m = b.m, sol = b.out && b.out.sol; if (!sol) return null;
  const map = (ax, v) => { const P = m.axes[ax].map((a, i) => [a.s, sol[ax].x[i]]).filter(p => Number.isFinite(p[1])).sort((a, c) => a[0] - c[0]); if (P.length < 2) return NaN; let i = 0; while (i < P.length - 2 && v > P[i + 1][0]) i++; const [s0, x0] = P[i], [s1, x1] = P[i + 1]; return s1 === s0 ? x0 : x0 + (v - s0) * (x1 - x0) / (s1 - s0); };
  const cx0 = map('X', r.c.x), cy0 = map('Y', r.c.y), WS = b.out.walls || []; /* unutarnje mjere: od središta prostorije do najbližih lica zidova lijevo/desno i gore/dolje */
  let L = -Infinity, Rr = Infinity, U = -Infinity, Dn = Infinity; for (const w of WS) { if (w.y0 <= cy0 && w.y1 >= cy0) { if (w.x1 <= cx0 + 0.5) L = Math.max(L, w.x1); if (w.x0 >= cx0 - 0.5) Rr = Math.min(Rr, w.x0); } if (w.x0 <= cx0 && w.x1 >= cx0) { if (w.y1 <= cy0 + 0.5) U = Math.max(U, w.y1); if (w.y0 >= cy0 - 0.5) Dn = Math.min(Dn, w.y0); } }
  const W = Rr - L, H = Dn - U;
  const cx = map('X', r.c.x), cy = map('Y', r.c.y); let room = null, bd = Infinity; for (const R of b.out.rooms || []) { if (R.outside || !R.center) continue; const d = Math.hypot(R.center.x - cx, R.center.y - cy); if (d < bd) { bd = d; room = R; } }
  const rect = r.rects && r.rects.length && Math.abs(r.rects.reduce((a, q) => a + (q[2] - q[0]) * (q[3] - q[1]), 0) - (r.x1 - r.x0) * (r.y1 - r.y0)) < 0.05 * (r.x1 - r.x0) * (r.y1 - r.y0);
  const warn = []; const sk = (r.x1 - r.x0) / Math.max(1e-6, r.y1 - r.y0), ms = W / Math.max(1e-6, H);
  if (W > 0 && H > 0 && rect && (ms / sk > 1.7 || sk / ms > 1.7)) warn.push('Oblik se jako razlikuje od skice (na skici ' + (sk >= 1 ? 'šira' : 'uža') + ', izmjereno ' + fmt(W) + ' × ' + fmt(H) + ') – provjeri nisu li ↔ i ↕ zamijenjene ili je tipfeler.');
  if (!(W > 40) || !(H > 40)) { if (Number.isFinite(W) && Number.isFinite(H)) warn.push('Neka mjera prostorije je premala (' + fmt(W) + ' × ' + fmt(H) + ' cm).'); }
  if (W > 3000 || H > 3000) warn.push('Neka mjera prostorije je prevelika (' + fmt(W) + ' × ' + fmt(H) + ' cm) – tipfeler?');
  const A = room && room.area > 0 ? room.area / 1e4 : NaN; if (A > 0 && rect && W > 0 && H > 0 && Math.abs(A - W * H / 1e4) > 0.25 * A) warn.push('Površina iz tlocrta (' + fmt2(A) + ' m²) ne odgovara mjerama ' + fmt(W) + ' × ' + fmt(H) + '.');
  return { W, H, A, rect, warn };
}
function fmt2(v) { return (Math.round(v * 100) / 100).toFixed(2).replace('.', ','); }
function roomCheck(r, P) {
  const D = roomCheckData(r); if (!D) return false; const p = panelEl(), nm = r.text || r.name || 'Prostorija'; V.q = null; V.target = null; V.pick = false;
  p.innerHTML = '<div class="vd-head"><b>✓ ' + esc(nm) + ' – provjera</b><button data-rc="x">✕</button></div>' +
    '<div class="vd-q" style="font-size:20px">' + (D.rect && Number.isFinite(D.W) && Number.isFinite(D.H) ? '↔ ' + fmt(D.W) + ' · ↕ ' + fmt(D.H) + ' cm' : D.rect ? 'Mjere se ne mogu očitati' : 'Prostorija nije pravokutna') + (D.A > 0 ? '<br><span style="font-size:16px">P = ' + fmt2(D.A) + ' m²</span>' : '') + '<div style="font-size:12px;color:#5b6b80;font-weight:400">unutarnje mjere kako će biti na tlocrtu</div></div>' +
    (D.warn.length ? '<div class="vd-h" style="color:#b91c1c">⚠ ' + D.warn.map(esc).join('<br>⚠ ') + '</div>' : '<div class="vd-h" style="color:#166534">Mjere se slažu sa skicom.</div>') +
    '<div class="vd-row"><button data-rc="ok" class="pri">✓ U redu je</button><button data-rc="re">↺ Premjeri</button><button data-rc="off" title="Više ne prikazuj provjeru na kraju prostorije (uključuje se u ⚙ ili ovdje)">Preskoči provjere</button></div>';
  const go = () => { pickPanel(V.P || plan()); };
  p.querySelectorAll('[data-rc]').forEach(b => b.onclick = () => { const a = b.dataset.rc;
    if (a === 'x') { stop(); return; }
    if (a === 'off') { store.set('izmjera-provjera-sobe', '0'); toast('Provjera na kraju prostorije isključena. (Uključi: 📏 Mjeri → ⚙ na popisu prostorija)'); go(); return; }
    if (a === 're') { try { TR.T.links = true; localStorage.setItem('izmjera-teren-veze', '1'); const vz = $('terenVeze'); vz && vz.classList.add('active'); } catch (e) { } if (r.c) app.centerOn(raw(r.c)); toast('↺ Dodirni kotu koju treba ispraviti (🔗 Veze uključene) – ili odaberi prostoriju ponovno.'); go(); return; }
    go(); });
  if (r.c) { const cv = $('canvas'), sc = app.screen(raw(r.c)); if (!(sc.x > cv.clientWidth * 0.1 && sc.x < cv.clientWidth * 0.65)) app.centerOn(raw(r.c)); }
  T.rcRoom = r; app.redraw(); return true;
}
function pickPanel(P) {
  const p = panelEl(); V.q = null; V.target = null; V.pick = true; const sug = suggestNext(P); V.sug = sug ? sug.key : null;
  const nAll = P.rest.length + [...P.per.values()].reduce((a, v) => a + v.length, 0);
  if (!nAll) { V.pick = false; p.innerHTML = '<div class="vd-head"><b>📏 Mjerenje</b><button data-a="x">✕</button></div><div class="vd-done">✓ Sve potrebno je izmjereno' + (V.skip.size ? ' (preskočeno: ' + V.skip.size + ')' : '') + '.</div><div class="vd-row">' + (V.skip.size ? '<button data-a="unskip">Vrati preskočeno</button>' : '') + '<button data-a="miss">❓ Što nedostaje</button><button data-a="x" class="pri">Gotovo</button></div>'; bindPanel(); app.redraw(); return; }
  const btn = (key, text, n) => '<button data-r="' + esc(key) + '" class="vd-room' + (n ? '' : ' ok') + (key === V.sug ? ' sug' : '') + '">' + (key === V.sug ? '➜ ' : '') + esc(text) + ' <span>' + (n ? n : '✓') + '</span></button>';
  p.innerHTML = '<div class="vd-head"><b>📏 Mjerenje' + (V.lastDone ? ' – ✓ ' + esc(V.lastDone.text) : '') + '</b><span class="vd-left">još ' + nAll + '</span><button data-a="x">✕</button></div>' +
    '<div class="vd-q">' + (P.rooms.length ? 'Koju prostoriju mjeriš' + (V.lastDone ? ' sljedeću' : '') + '?' : 'Mjerenje') + '</div>' +
    '<div class="vd-h">' + (P.rooms.length ? 'Dodirni prostoriju na skici ili je odaberi s popisa. Redom se mjeri: unutarnje mjere, pa u krug po prostoriji od vrata (u smjeru kazaljke): dužine zidova, otvori (mjere i udaljenost od ugla) i debljine' + (needHeights() ? ', visina' : '') + ', naziv – na kraju kratka provjera.' : 'Na skici nema zatvorenih prostorija – pitanja idu redom.') + '</div>' +
    '<div class="vd-rooms">' + P.rooms.map(r => btn(r.key, r.text, (P.per.get(r.key) || []).length)).join('') + (P.rest.length ? btn('rest', P.rooms.length ? 'Ostalo (između prostorija)' : 'Kreni', P.rest.length) : '') + '</div>' +
    (V.skip.size ? '<div class="vd-row"><button data-a="unskip">Vrati preskočeno (' + V.skip.size + ')</button></div>' : '') +
    (store.get('izmjera-provjera-sobe', '1') !== '1' ? '<div class="vd-row"><button data-rcon="1">✓ Uključi provjeru na kraju prostorije</button></div>' : '');
  bindPanel(); { const b = p.querySelector('[data-rcon]'); if (b) b.onclick = () => { store.set('izmjera-provjera-sobe', '1'); toast('Provjera na kraju prostorije uključena.'); pickPanel(P); }; } app.redraw();
}
function pickRoom(key) { const P = V.P || plan(); V.room = key === 'rest' ? REST : P.rooms.find(r => r.key === key) || null; V.pick = false; if (V.room && V.room.c) { const cv = $('canvas'), s = app.screen(raw(V.room.c)); if (!(s.x > cv.clientWidth * 0.1 && s.x < cv.clientWidth * 0.65 && s.y > cv.clientHeight * 0.1 && s.y < cv.clientHeight * 0.9)) app.centerOn(raw(V.room.c)); } step(); }
function step(noCenter) {
  if (!V.on) return; const P = V.P = plan(), p = panelEl(); V.val = '';
  if (V.room && V.room.key !== 'rest') { if (P.cur) V.room = P.cur; else V.room = null; }
  const list = V.room ? (V.room.key === 'rest' ? P.rest : (P.per.get(V.room.key) || [])) : null;
  if (V.room && !list.length) { V.lastDone = V.room; V.room = null; if (V.lastDone.key !== 'rest' && store.get('izmjera-provjera-sobe', '1') === '1' && roomCheck(V.lastDone, P)) return; }
  if (!V.room) { if (!P.rooms.length && P.rest.length && !V.lastDone) { V.room = REST; return step(noCenter); } pickPanel(P); return; }
  V.pick = false; const q = V.q = list[0], Q = qText(q); V.target = targetOf(q); V.fresh = false; if (Q.pre) { V.val = Q.pre; V.fresh = true; } if (q.type === 'vis' && V.lastH == null) { const lh = num(store.get('izmjera-zadnja-visina', '')); if (lh > 0) V.lastH = lh; }
  const pad = !Q.btns;
  p.innerHTML = '<div class="vd-head"><b>📏 ' + esc(V.room.text) + '</b><span class="vd-left">još ' + list.length + '</span>' + laserBtn() + (V.prev ? '<button data-a="back" title="Ponovi zadnju mjeru: ' + esc(V.prev.text || '') + '">↺</button>' : '') + '<button data-a="rooms" title="Druga prostorija">🏠</button><button data-a="x">✕</button></div>' +
    '<div class="vd-q">' + esc(Q.t) + '</div><div class="vd-h">' + esc(Q.h) + '</div>' +
    (Q.corner ? '<div class="vd-row" style="flex-wrap:wrap">' + Q.corner.map(([k, n]) => '<button data-c="' + k + '"' + (k === Q.cur ? ' class="pri"' : '') + '>' + esc(n) + '</button>').join('') + (Q.flip ? '<button data-flip="1" title="Mjerio sam s druge strane zida">⇄ Druga strana zida</button>' : '') + '</div>' : '') +
    (pad ? '<div class="vd-val" id="vdVal">' + esc(V.val || ' ') + '</div>' + (Q.zero ? '<div class="vd-row vd-quick"><button data-q="0" style="flex:1">⌐ Uz ugao (0)</button>' + ((Q.keys || []).some(k => k.trim() === '0') ? '<button data-k="0" style="flex:1">Isti zid (0)</button>' : '') + '</div>' : '') + (Q.quick ? '<div class="vd-row vd-quick">' + Q.quick.map(k => '<button data-q="' + k + '">' + k + '</button>').join('') + '</div>' : '') + '<div class="vd-pad">' + ['7', '8', '9', '4', '5', '6', '1', '2', '3', ',', '0', '⌫'].map(k => '<button data-k="' + k + '">' + k + '</button>').join('') + '</div>' +
      ((Q.keys || []).filter(k => !(Q.zero && k.trim() === '0')).length ? '<div class="vd-row">' + Q.keys.filter(k => !(Q.zero && k.trim() === '0')).map(k => '<button data-k="' + k + '">' + k.trim() + '</button>').join('') + '</div>' : '') : '') +
    (Q.btns ? '<div class="vd-row' + (Q.names ? ' vd-names' : '') + '">' + Q.btns.map(([k, n]) => '<button data-b="' + esc(k) + '"' + (Q.names ? '' : ' class="pri"') + '>' + esc(n) + '</button>').join('') + '</div>' : '') +
    '<div class="vd-row">' + (pad ? '<button data-a="ok" class="pri">✓ Upiši</button>' : '') + (pad && laserOn() && laserTrig() ? '<button data-a="lzr" class="pri" style="background:#dc2626;border-color:#dc2626">🔴 Izmjeri</button>' : '') +
    (q.type === 'viol' ? '<button data-a="acc">Prihvati</button><button data-a="ign">Zanemari kotu</button>' + (!q.chain ? '<button data-a="skok" title="Zidovi na skici leže na istoj crti, a u stvarnosti nisu u ravnini (odvojen dio, uvučena ili izbačena fasada)">↔ Zid ima skok</button>' : '') : '') +
    (q.type === 'vis' && V.lastH > 0 ? '<button data-a="sameH">Kao prethodna (' + fmt(V.lastH) + ')</button><button data-a="allH">Ista za sve</button>' : '') +
    (q.type === 'blk' || q.type === 'bod' ? '<button data-a="blkm">Postavke…</button>' : '') +
    (q.type === 'wt3' ? '<button data-a="wtd">Znam debljinu</button>' : '') +
    '<button data-a="skip">Preskoči</button></div>';
  bindPanel(); app.redraw();
  if (!noCenter && V.target) { const cv = $('canvas'), s = app.screen(V.target.p); if (!(s.x > cv.clientWidth * 0.12 && s.x < cv.clientWidth * 0.6 && s.y > cv.clientHeight * 0.15 && s.y < cv.clientHeight * 0.85)) app.centerOn(V.target.p); }
}
function bindPanel() {
  const p = panelEl(), q = V.q, upd = () => { const e = $('vdVal'); if (e) e.textContent = V.val || ' '; };
  p.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { const k = b.dataset.k; if (k === '⌫') V.val = V.fresh ? '' : V.val.slice(0, -1); else if (k === '0' && b.textContent.startsWith('Isti')) { answer(0, 'same'); step(); return; } else V.val = (V.fresh ? '' : V.val) + k; V.fresh = false; upd(); });
  p.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { answer(num(b.dataset.q)); step(); });
  p.querySelectorAll('[data-flip]').forEach(b => b.onclick = () => { const v = V.fresh ? '' : V.val; V.oodFlip = V.oodFlip || {}; V.oodFlip[q.key] = !V.oodFlip[q.key]; delete V.bodEnd[q.key]; if (q.id) delete V.bodEnd[q.id]; step(true); V.val = v; upd(); });
  p.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { const v = V.fresh ? '' : V.val; V.bodEnd[q.type === 'ood' || q.type === 'cp' ? q.key : q.id] = +b.dataset.c; step(true); V.val = v; upd(); });
  p.querySelectorAll('[data-r]').forEach(b => b.onclick = () => pickRoom(b.dataset.r));
  p.querySelectorAll('[data-b]').forEach(b => b.onclick = () => { if (b.dataset.b === '__upis') { const v = prompt('Naziv prostorije:', ''); if (!v || !v.trim()) return; answer(null, v.trim().slice(0, 60)); step(); return; } answer(null, b.dataset.b); step(); }); /* v2.65: i vlastiti naziv */
  p.querySelectorAll('[data-a]').forEach(b => b.onclick = () => { const a = b.dataset.a;
    if (a === 'x') { stop(); return; }
    if (a === 'rooms') { V.room = null; V.lastDone = null; step(); return; }
    if (a === 'laser') { window.IzmjeraLaser && IzmjeraLaser.toggle(); return; }
    if (a === 'lzr') { window.IzmjeraLaser && IzmjeraLaser.trigger(); return; }
    if (a === 'back') { goBack(); return; }
    if (a === 'unskip') { V.skip.clear(); step(); return; }
    if (a === 'miss') { stop(); $('terenMissing') && $('terenMissing').click(); return; }
    if (a === 'skip') { if (q) V.skip.add(q.key); step(); return; }
    if (a === 'acc') { answer(null, 'accept'); step(); return; }
    if (a === 'ign') { answer(null, 'ignore'); step(); return; }
    if (a === 'skok') { b.disabled = true; b.textContent = 'Tražim…'; setTimeout(() => { stepFix(q); }, 30); return; }
    if (a === 'sameH') { answer(V.lastH); step(); return; }
    if (a === 'allH') { const v = V.val ? num(V.val) : V.lastH; if (v > 0) { allHeights(v); step(); } return; }
    if (a === 'blkm') { TR.blkMenu(q.id); return; }
    if (a === 'wtd') { V.wtDirect.add(q.c.k); if (V.room !== q.c.rA && q.c.rA) V.room = q.c.rA; step(); return; }
    if (a === 'ok') { if (q.type === 'blk') { if (answer(null, V.val) !== false) step(); return; } const v = num(V.val); if (!(v > 0) && !(v === 0 && (q.type === 'gap' || q.type === 'bod' || q.type === 'ood'))) { toast('Upiši broj.'); return; } answer(v); step(); } });
}
function keyH(e) { if (!V.on || !V.q || (document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))) return; const k = e.key;
  if (/^[0-9]$/.test(k) || k === ',' || k === '.' || k === '/') { V.val = (V.fresh ? '' : V.val) + (k === '.' ? ',' : k); V.fresh = false; const el = $('vdVal'); if (el) el.textContent = V.val; e.preventDefault(); }
  else if (k === 'Backspace') { V.val = V.val.slice(0, -1); const el = $('vdVal'); if (el) el.textContent = V.val || ' '; e.preventDefault(); }
  else if (k === 'Enter') { const ok = panelEl().querySelector('[data-a="ok"]'); if (ok) ok.click(); e.preventDefault(); } }
document.addEventListener('keydown', keyH);
/* ---------- 📡 laserski metar (DISTO) ---------- */
const laserOn = () => !!(window.IzmjeraLaser && IzmjeraLaser.L.s === 'on'), laserTrig = () => !!(window.IzmjeraLaser && IzmjeraLaser.L.trig);
function laserBtn() { if (!window.AndroidApp || !window.AndroidApp.laserConnect) return ''; const L = window.IzmjeraLaser ? IzmjeraLaser.L : { s: 'off' }, c = L.s === 'on' ? 'background:#16a34a;color:#fff;border-color:#16a34a' : /scan|connecting/.test(L.s) ? 'background:#fef3c7;border-color:#f59e0b' : ''; return '<button data-a="laser" title="Laserski metar: ' + (L.s === 'on' ? 'spojen' : 'nije spojen – dodirni za spajanje') + '" style="' + c + '">📡</button>'; }
function submitPanel() { const ok = panelEl().querySelector('[data-a="ok"]'); if (ok) ok.click(); }
function laserFeed(cm) {
  if (!V.on || !V.q) return false; const q = V.q, Q = qText(q); if (Q.btns) { toast('📡 ' + fmt(cm) + ' cm – ovdje se bira, ne mjeri.'); return true; }
  const f = fmt(cm), upd = () => { const e = $('vdVal'); if (e) e.textContent = V.val || ' '; };
  if (q.type === 'blk') { const M = TR.blkMain(q.id), B = M && M.blk; /* prozor: širina → visina → parapet; vrata: širina → visina */
    if (!V.val || V.fresh || /p=\S/.test(V.val) && V.val.includes('/')) { V.val = f; V.fresh = false; upd(); toast('📡 širina ' + f + ' – sada visina'); return true; }
    if (!V.val.includes('/')) { V.val += '/' + f; upd(); if (B && B.t === 'vrata') { submitPanel(); return true; } toast('📡 visina ' + f + ' – sada parapet'); return true; }
    V.val += ' p=' + f; upd(); submitPanel(); return true; }
  V.val = f; V.fresh = false; upd(); submitPanel(); return true;
}
function goBack() { const P0 = V.prev; if (!P0) return; try { const it = app.items(); it.splice(0, it.length, ...JSON.parse(P0.items)); const t = TR.tl(app.currentFloor()); Object.keys(t).forEach(k => delete t[k]); Object.assign(t, JSON.parse(P0.tl)); } catch (e) { toast('Vraćanje nije uspjelo.'); return; }
  V.skip.delete(P0.key); V.room = P0.room; V.prev = null; T.sig = ''; app.save(); app.redraw(); toast('↺ Ponovi: ' + (P0.text || 'zadnja mjera')); step(); }
function start() { V.on = true; V.prev = null; V.skip.clear(); V.room = null; V.lastDone = null; V.bodEnd = {}; V.wtDirect = new Set(); document.body.classList.add('vd-on'); $('terenMjeri') && $('terenMjeri').classList.add('active'); TR.analyzeNow(true); if (!T.m) { toast('📏 Prvo nacrtaj zidove prostorija (Nacrt), pa onda mjeri.'); stop(); return; } step(); }
function stop() { V.on = false; V.q = null; V.target = null; V.pick = false; V.room = null; document.body.classList.remove('vd-on'); const p = $('vdPanel'); if (p) p.remove(); $('terenMjeri') && $('terenMjeri').classList.remove('active'); app.redraw(); }

/* ---------- provjera uživo: broj na gumbu i crveni prsten oko kota koje se ne slažu ---------- */
function liveCheck() {
  if (V.live && V.live.f !== app.currentFloor()) { V.live = null; V.liveSig = ''; badge(); app.redraw(); }
  if (V.on || !T.m || !T.st || (app.busy && app.busy())) return; const sig = T.sig + '|' + JSON.stringify(T.st.decisions || {}).length; if (V.liveSig === sig) return; V.liveSig = sig;
  let qs = []; try { const sk = V.skip; V.skip = new Set(); qs = questions(); V.skip = sk; } catch (e) { qs = []; }
  let ex = 0; try { ex = TR.blkMissing().length; } catch (e) { }
  const viol = qs.filter(q => q.type === 'viol').map(q => ({ p: raw({ x: q.label.cx, y: q.label.cy }), n: q.label.n }));
  V.live = { n: qs.length + ex, viol, f: app.currentFloor() }; badge(); app.redraw();
}
function badge() { const b = document.querySelector('#ui2Quick button[title^="Mjeri"]') || $('terenMjeri'); if (!b) return; let s = b.querySelector('.vd-badge'); const L = V.live; if (!L || !L.n) { if (s) s.remove(); return; }
  if (!s) { s = document.createElement('span'); s.className = 'vd-badge'; b.style.position = 'relative'; b.appendChild(s); } s.textContent = L.n > 99 ? '99+' : String(L.n); s.style.background = L.viol.length ? '#dc2626' : '#f59e0b'; }
setInterval(liveCheck, 1500);

/* ======================= 🪜 STUBIŠTE IZ BLOKA ======================= */
const ST = { mode: false, drag: null };
const VRSTE = [['ravno', 'Ravno'], ['L', 'L – podest'], ['L3', 'L – trokuti'], ['U', 'U – podest'], ['U3', 'U – trokuti'], ['spiralno', 'Spiralno']];
function stLast() { try { return Object.assign({}, C.ST_DEF, JSON.parse(store.get('izmjera-stube', '{}'))); } catch (e) { return Object.assign({}, C.ST_DEF); } }
function stItems(id) { return app.items().filter(o => o.blk && o.blk.id === id); }
const FREE = /^(krovni|otvorp|terasa|greda|prag|stup)$/, isFree = t => FREE.test(t || '');
function visB(B) { if (!B.vis) return B; const d = C.rotP({ x: B.vis.x, y: B.vis.y }, stTh()); return Object.assign({}, B, { c: { x: B.c.x + d.x, y: B.c.y + d.y } }); }
function stMain(id) { return app.items().find(o => o.blk && o.blk.id === id && o.blk.main && (o.blk.t === 'stube' || isFree(o.blk.t))); }
/* 🪟 krovni prozor: crtkani pravokutnik š × (v·cos nagiba) u tlocrtu; položaj od dva okomita zida kao stubište */
const KR_DEF = { w: 78, h: 118 };
function krGeo(P0) { const P = Object.assign({}, KR_DEF, P0 || {}), w = Math.max(20, num(P.w) || 78), h = Math.max(20, num(P.h) || 118), ng = num(P.nag), d = ng > 0 && ng < 90 ? h * Math.cos(ng * Math.PI / 180) : h;
  const c = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([u, v]) => ({ u, v })), segs = [[c[0], c[1]], [c[1], c[2]], [c[2], c[3]], [c[3], c[0]], [c[3], c[1]]]; /* v2.38: crtkani okvir + jedna dijagonala */
  const pp = P.p != null && P.p !== '' ? ' p=' + String(P.p).replace('.', ',') : '';
  return { segs, arrow: [], runs: [], w, h, d, text: 'KP ' + fmt(w, 0) + '/' + fmt(h, 0) + pp, txtAt: { u: 0, v: 0 } }; }
/* v2.06: ostali blokovi – otvor u ploči, terasa/balkon/lođa, greda, prag (promjena visine poda) */
const FR_DEF = { otvorp: { w: 100, h: 250 }, terasa: { w: 300, h: 150, naziv: 'Terasa' }, greda: { L: 300, b: 25 }, prag: { L: 90, dh: 15 }, stup: { f: 'kv', a: 30, b: 30, D: 30 } };
const FR_INFO = { krovni: ['🪟', 'Krovni prozor', 'KROVNI_PROZOR'], otvorp: ['⬚', 'Otvor u ploči', 'OTVOR_PLOCA'], terasa: ['🌿', 'Terasa / balkon / lođa', 'TERASA'], greda: ['▬', 'Greda', 'GREDE'], stup: ['▣', 'Stup', 'STUPOVI'], prag: ['⎍', 'Skok u podu', 'PRAG'] };
function frGeo(t, P0) { if (t === 'krovni') return krGeo(P0); const P = Object.assign({}, FR_DEF[t], P0 || {}), R4 = (w, h) => { const c = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(([u, v]) => ({ u, v })); return { c, segs: [[c[0], c[1]], [c[1], c[2]], [c[2], c[3]], [c[3], c[0]]] }; };
  if (t === 'otvorp') { const w = Math.max(20, num(P.w) || 100), h = Math.max(20, num(P.h) || 250), q = R4(w, h); return { segs: q.segs.concat([[q.c[0], q.c[2]], [q.c[1], q.c[3]]]), arrow: [], runs: [], w, h, text: 'otvor u ploči ' + fmt(w, 0) + '/' + fmt(h, 0) }; }
  if (t === 'terasa') { const k = num(P.k), tx = A => (P.naziv || 'Terasa') + ' P=' + fmt(A, 2) + ' m²' + (k > 0 ? ' (k=' + String(P.k).replace('.', ',') + ')' : '');
    if (Array.isArray(P.reg) && P.reg.length) { const A = P.reg.reduce((a, q) => a + Math.abs((q[2] - q[0]) * (q[3] - q[1])), 0) / 1e4; return { segs: C.regEdges(P.reg).map(([a, b]) => [{ u: a[0], v: a[1] }, { u: b[0], v: b[1] }]), arrow: [], runs: [], w: 0, h: 0, A, text: tx(A) }; }
    const w = Math.max(30, num(P.w) || 300), h = Math.max(30, num(P.h) || 150), q = R4(w, h), A = w * h / 1e4; return { segs: q.segs, arrow: [], runs: [], w, h, A, text: tx(A) }; }
  if (t === 'greda') { /* v2.49: na skici jedna crtkana crta (os grede), bez natpisa; u DXF-u dvije crte u širini grede */ const L = Math.max(10, num(P.L) || 300), b = Math.max(5, num(P.b) || 25); return { segs: [[{ u: -L / 2, v: 0 }, { u: L / 2, v: 0 }]], arrow: [], runs: [], w: L, h: Math.max(b, 20), text: '' }; }
  if (t === 'stup') { /* v2.49: stup – četvrtasti (a × b) ili okrugli (Ø) s križem */ if (P.f === 'ok') { const r = Math.max(5, num(P.D) || 30) / 2, sg = []; let pr = null; for (let i = 0; i <= 24; i++) { const an = i / 24 * 2 * Math.PI, q = { u: r * Math.cos(an), v: r * Math.sin(an) }; if (pr) sg.push([pr, q]); pr = q; } const k = r * 0.7071; sg.push([{ u: -k, v: -k }, { u: k, v: k }], [{ u: k, v: -k }, { u: -k, v: k }]); return { segs: sg, arrow: [], runs: [], w: 2 * r, h: 2 * r, text: '' }; }
    const a = Math.max(5, num(P.a) || 30), b = Math.max(5, num(P.b) || a), q = R4(a, b); return { segs: q.segs.concat([[q.c[0], q.c[2]], [q.c[1], q.c[3]]]), arrow: [], runs: [], w: a, h: b, text: '' }; }
  if (t === 'prag') { const L = Math.max(20, num(P.L) || 90), dh = num(P.dh); return { segs: [[{ u: -L / 2, v: 0 }, { u: L / 2, v: 0 }], [{ u: -L / 2, v: -6 }, { u: -L / 2, v: 6 }], [{ u: L / 2, v: -6 }, { u: L / 2, v: 6 }]], arrow: [], runs: [], w: L, h: 12, text: (dh > 0 ? '+' : '') + (Number.isFinite(dh) ? fmt(dh, 0) : '±?') + ' cm' }; }
  return krGeo(P0); }
const geoOf = B => isFree(B.t) ? frGeo(B.t, B.P) : C.stairGeo(B.P);
/* 🌿 terasa: (B) dodir unutar plohe omeđene zidovima i crtama Pogleda → terasa iz obrisa; (A) dodir uz vanjski zid → terasa uz pročelje; inače pravokutnik */
function terPlace(p) { if (curLayer() !== 'nacrt') { toast('🌿 Terasa se postavlja u sloju Nacrt.'); return; } TR.analyzeNow(true); const m = T.m; if (!m) { frPlace('terasa', p); return; } const th = m.theta || 0, a = C.rotP(p, -th), E = m.E, sc = scaleNow() > 0 ? scaleNow() : 3;
  let P = Object.assign({}, FR_DEF.terasa); try { P = Object.assign(P, JSON.parse(store.get('izmjera-fr-terasa', '{}'))); } catch (e) { } delete P.w; delete P.h; delete P.reg;
  const regs = roomsOf(true, true).filter(r => r.has(a)).sort((u, v) => (u.x1 - u.x0) * (u.y1 - u.y0) - (v.x1 - v.x0) * (v.y1 - v.y0)), rg = regs[0];
  if (rg && (rg.walls.some(e => e.w.view) || roomsOf().some(r => r.has(a)))) { const isRoom = !rg.walls.some(e => e.w.view), cx = (rg.x0 + rg.x1) / 2, cy = (rg.y0 + rg.y1) / 2, rd = v => Math.round(v * 10) / 10;
    P.reg = rg.rects.map(q => [rd((q[0] - cx) * sc), rd((q[1] - cy) * sc), rd((q[2] - cx) * sc), rd((q[3] - cy) * sc)]); P.naziv = isRoom ? 'Lođa' : (P.naziv && P.naziv !== 'Lođa' ? P.naziv : 'Terasa');
    const c = raw({ x: cx, y: cy }), dv = C.rotP({ x: 1, y: 0 }, th), id = 't' + Date.now().toString(36), B = { id, t: 'terasa', c: { x: Math.round(c.x * 10) / 10, y: Math.round(c.y * 10) / 10 }, dv, P, sFix: sc };
    app.snapshot(); stBuild(B); app.save(); T.sig = ''; app.redraw(); stMenu(id, true); toast('🌿 ' + P.naziv + ' iz obrisa: ' + fmt(frGeo('terasa', P).A, 2) + ' m² (po skici; točno nakon mjera u DXF-u).'); return; }
  let w = null, bd = 6 * E; for (const q of m.walls) { if (q.view || q.obj || !q.exterior || !q.outSide) continue; const al = q.o === 'H' ? a.x : a.y, pe = q.o === 'H' ? a.y : a.x; if (al < q.e0 - E || al > q.e1 + E) continue; const d = (pe - q.c) * q.outSide; if (d > -1.5 * E && d < bd) { bd = d; w = q; } }
  if (w) { const id = 't' + Date.now().toString(36); P.h = P.h0 > 0 ? P.h0 : 150; P.od = 0; P.end = -1; const B = { id, t: 'terasa', c: p, dv: C.rotP({ x: 1, y: 0 }, th), P, anc: { o: w.o, c: w.c, e0: w.e0, e1: w.e1, out: w.outSide, ht: halfT(w), th } };
    terAnc(B); app.snapshot(); stBuild(B); app.save(); T.sig = ''; app.redraw(); stMenu(id, true); toast('🌿 Terasa uz pročelje – upiši dubinu (i duljinu, ako ne ide cijelim zidom).'); return; }
  frPlace('terasa', p); }
/* terasa uz zid: položaj i smjer iz zida + dubina / duljina / od ugla */
function terEndWord(B, sd) { const A = B.anc; if (!A) return sd < 0 ? 'od početka' : 'od kraja'; const a = A.o === 'H' ? { x: A.e0, y: A.c } : { x: A.c, y: A.e0 }, b = A.o === 'H' ? { x: A.e1, y: A.c } : { x: A.c, y: A.e1 }, q = sd < 0 ? a : b, o = sd < 0 ? b : a; return ({ lijevi: '← od lijevog ugla', desni: 'od desnog ugla →', gornji: '↑ od gornjeg ugla', donji: '↓ od donjeg ugla' })[scrWord(o, q)] || (sd < 0 ? 'od početka' : 'od kraja'); }
function terAnc(B) { const A = B.anc, P = B.P; if (!A) return; const s = B.sFix || scaleNow() || 3, ext = A.ht / s, e0 = A.e0 - ext, e1 = A.e1 + ext, full = (e1 - e0) * s, od = Math.max(0, num(P.od) || 0), wz = num(P.wz) > 0 ? num(P.wz) : Math.max(30, full - od), h = Math.max(20, num(P.h) || 150);
  P.w = Math.round(wz * 10) / 10; const mid = (P.end > 0 ? e1 - (od + wz / 2) / s : e0 + (od + wz / 2) / s), face = A.c + A.out * A.ht / s, pc = face + A.out * (h / 2) / s, q = A.o === 'H' ? { x: mid, y: pc } : { x: pc, y: mid };
  B.c = C.rotP(q, A.th); B.dv = C.rotP(A.o === 'H' ? { x: 1, y: 0 } : { x: 0, y: 1 }, A.th); B.sFix = s; { const g = -A.out * A.ht / s; B.vis = A.ht > 0 ? (A.o === 'H' ? { x: 0, y: Math.round(g * 10) / 10 } : { x: Math.round(g * 10) / 10, y: 0 }) : null; /* v2.33: na skici do crte zida */ } }
/* v2.49: greda – kraj se hvata za zid / stup / drugu gredu (Hvatanje), Orto drži ravno */
function bmEnd(p) { let q = null; try { q = app.snapPt ? app.snapPt(p) : null; } catch (e) { } let best = null, bd = 18 / app.scale(); /* prednost: središte stupa / kraj grede */
  for (const o of app.items()) { if (!(o.blk && o.blk.main && (o.blk.t === 'stup' || o.blk.t === 'greda'))) continue; const B = o.blk, s = B.s || 3, pts = [B.c];
    if (B.t === 'greda') { const h = (num(B.P && B.P.L) || 300) / 2 / s; pts.push({ x: B.c.x - B.dv.x * h, y: B.c.y - B.dv.y * h }, { x: B.c.x + B.dv.x * h, y: B.c.y + B.dv.y * h }); }
    for (const c of pts) { const d = Math.hypot(c.x - p.x, c.y - p.y); if (d < bd) { bd = d; best = { x: c.x, y: c.y }; } } }
  return best || q || p; }
/* v2.49: stup – na gredu → na os grede; uz zid → lice stupa uz lice zida; inače slobodno */
function stupSnap(B) { const s = B.s || stScale(B), P = B.P || {}, G = frGeo('stup', P), tolPx = 22 / app.scale();
  let best = null, bd = tolPx; for (const o of app.items()) { if (!(o.blk && o.blk.main && o.blk.t === 'greda' && o.blk.id !== B.id)) continue; const g = o.blk, h = (num(g.P && g.P.L) || 300) / 2 / (g.s || s), dx = B.c.x - g.c.x, dy = B.c.y - g.c.y, u = dx * g.dv.x + dy * g.dv.y, v = -dx * g.dv.y + dy * g.dv.x;
    if (Math.abs(u) > h + tolPx || Math.abs(v) > bd) continue; bd = Math.abs(v); const uu = Math.max(-h, Math.min(h, u)); best = { c: { x: g.c.x + g.dv.x * uu, y: g.c.y + g.dv.y * uu }, dv: { x: g.dv.x, y: g.dv.y }, why: 'na gredu' }; }
  if (!best) { try { TR.analyzeNow(true); const m = T.m; if (m) { const th = m.theta || 0, a = C.rotP(B.c, -th); let bw = 1.4 * Math.max(G.w, G.h) / s + tolPx;
      for (const w of m.walls) { if (w.view || w.obj) continue; const al = w.o === 'H' ? a.x : a.y, pe = w.o === 'H' ? a.y : a.x; if (al < w.e0 - G.w / s || al > w.e1 + G.w / s) continue; const sd = Math.sign(pe - w.c) || 1, ht = halfT(w) / s, half = (w.o === 'H' ? G.h : G.w) / 2 / s, tgt = w.c + sd * (ht + half), d = Math.abs(pe - tgt);
        if (d < bw) { bw = d; const q = w.o === 'H' ? { x: a.x, y: tgt } : { x: tgt, y: a.y }; best = { c: C.rotP(q, th), dv: C.rotP({ x: 1, y: 0 }, th), why: 'uz zid' }; } } } } catch (e) { } }
  if (best) { B.c = { x: Math.round(best.c.x * 10) / 10, y: Math.round(best.c.y * 10) / 10 }; B.dv = best.dv; } return best ? best.why : ''; }
function stupPlace(p) { if (curLayer() !== 'nacrt') { toast('▣ Stup se postavlja u sloju Nacrt.'); return; } let P = Object.assign({}, FR_DEF.stup); try { P = Object.assign(P, JSON.parse(store.get('izmjera-fr-stup', '{}'))); } catch (e) { }
  const id = 'c' + Date.now().toString(36), B = { id, t: 'stup', c: { x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 }, dv: snapDir({ x: 1, y: 0 }), P }; B.s = stScale(B); const why = stupSnap(B);
  app.snapshot(); stBuild(B); app.save(); T.sig = ''; app.redraw(); toast('▣ Stup ' + (P.f === 'ok' ? 'Ø' + fmt(num(P.D) || 30, 0) : fmt(num(P.a) || 30, 0) + '/' + fmt(num(P.b) || 30, 0)) + (why ? ' – ' + why : ' – slobodno') + '. Dodirni ga za mjere i položaj; povuci za pomak.'); }
function frPlace(t, a, b) {
  if (curLayer() !== 'nacrt') { toast(FR_INFO[t][0] + ' ' + FR_INFO[t][1] + ' se postavlja u sloju Nacrt.'); return; }
  if (t === 'stup') { stupPlace(a); return; }
  if (t === 'greda') { if (!b || Math.hypot(b.x - a.x, b.y - a.y) * app.scale() < 25) { toast('▬ Gredu povuci olovkom od kraja do kraja (kao zid).'); return; }
    a = bmEnd(a); b = bmEnd(b); if (app.ortoOn && app.ortoOn()) { const d = snapDir({ x: b.x - a.x, y: b.y - a.y }), L0 = (b.x - a.x) * d.x + (b.y - a.y) * d.y; b = { x: a.x + d.x * L0, y: a.y + d.y * L0 }; }
    else { const d = snapDir({ x: b.x - a.x, y: b.y - a.y }), dl = Math.hypot(b.x - a.x, b.y - a.y), cr = Math.abs(((b.x - a.x) * d.y - (b.y - a.y) * d.x) / dl); if (cr < 0.087) { const L0 = (b.x - a.x) * d.x + (b.y - a.y) * d.y, q = { x: a.x + d.x * L0, y: a.y + d.y * L0 }, b2 = bmEnd(q); if (Math.hypot(b2.x - q.x, b2.y - q.y) * app.scale() < 12) { const ox = (b2.x - q.x) * (1 - Math.abs(d.x)), oy = (b2.y - q.y) * (1 - Math.abs(d.y)); a = { x: a.x + ox, y: a.y + oy }; b = b2; } else b = q; } } /* skoro ravno → ravno */
    let P = Object.assign({}, FR_DEF.greda); try { P = Object.assign(P, JSON.parse(store.get('izmjera-fr-greda', '{}'))); } catch (e) { } delete P.L;
    const len = Math.hypot(b.x - a.x, b.y - a.y), dv = { x: (b.x - a.x) / len, y: (b.y - a.y) / len }, c = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, id = 'g' + Date.now().toString(36), B = { id, t, c: { x: Math.round(c.x * 10) / 10, y: Math.round(c.y * 10) / 10 }, dv, P };
    const sc = stScale(B); B.sFix = sc; P.L = Math.round(len * sc * 10) / 10; app.snapshot(); stBuild(B); app.save(); T.sig = ''; app.redraw(); toast('▬ Greda ' + fmt(P.L, 0) + ' cm (iz skice). Dodirni je za širinu i visinu (h ili donji rub hgr).'); return; }
  let P = Object.assign({}, t === 'krovni' ? KR_DEF : FR_DEF[t]); try { P = Object.assign(P, JSON.parse(store.get('izmjera-fr-' + t, store.get(t === 'krovni' ? 'izmjera-krovni' : '-', '{}')))); } catch (e) { }
  let c = a, dv = snapDir({ x: 1, y: 0 });
  if (b && Math.hypot(b.x - a.x, b.y - a.y) * app.scale() > 25) { c = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; dv = snapDir({ x: b.x - a.x, y: b.y - a.y }); const sc = stScale({ c, dv, t }), L = Math.round(Math.hypot(b.x - a.x, b.y - a.y) * sc); if (t === 'greda' || t === 'prag') P.L = L; else if (t !== 'krovni') { P.w = L; } }
  const id = t[0] + Date.now().toString(36), B = { id, t, c: { x: Math.round(c.x * 10) / 10, y: Math.round(c.y * 10) / 10 }, dv, P };
  app.snapshot(); stBuild(B); app.save(); T.sig = ''; app.redraw(); stMenu(id, true); }
function krPlace(a) { frPlace('krovni', a); }
const nvOf = dv => ({ x: -dv.y, y: dv.x });
function stScale(B) { if (B && B.sFix > 0) return B.sFix; let s = NaN; try { s = TR.blkScale(B); } catch (e) { } return s > 0 ? s : (B.s > 0 ? B.s : 3); }
function stMap(B, s) { const nv = nvOf(B.dv); return q => ({ x: Math.round((B.c.x + (q.u * B.dv.x + q.v * nv.x) / s) * 10) / 10, y: Math.round((B.c.y + (q.u * B.dv.y + q.v * nv.y) / s) * 10) / 10 }); }
function stBuild(B, list) { const it = list || app.items(); stBuildOne(B, it);
  if (B.t === 'stube') { const rest = it.filter(o => o.blk && o.blk.main && o.blk.t === 'stube' && o.blk.id !== B.id).map(o => { const b = JSON.parse(JSON.stringify(o.blk)); delete b.main; return b; }); for (const b of rest) stBuildOne(b, it); } }
function stInv(B, s) { const V = visB(B), nv = nvOf(B.dv); return w => { const dx = w.x - V.c.x, dy = w.y - V.c.y; return { u: (dx * B.dv.x + dy * B.dv.y) * s, v: (dx * nv.x + dy * nv.y) * s }; }; }
function stBuildOne(B, it) {
  for (let i = it.length - 1; i >= 0; i--) if (it[i].blk && it[i].blk.id === B.id) it.splice(i, 1);
  const G = geoOf(B), s = B.s = (it === app.items() ? stScale(B) : (B.sFix || B.s || 3)), M = stMap(visB(B), s), line = (a, b, main) => Object.assign({ type: 'line', layer: 'nacrt', color: GREEN, width: 2, pts: [M(a), M(b)], blk: main ? Object.assign({}, B, { main: true }) : { id: B.id, t: B.t || 'stube' } }, B.t === 'krovni' || B.t === 'otvorp' || B.t === 'greda' || B.t === 'terasa' ? { dash: true } : {});
  if (B.t === 'stube') { /* v2.35: presjek / cijelo, strelica uvijek u smjeru penjanja */
    const oth = it.filter(o => o.blk && o.blk.main && o.blk.t === 'stube' && o.blk.id !== B.id).map(o => ({ mode: C.stairMode(o.blk.P, o.blk.iz), sh: C.stairShape(o.blk.P), fromW: stInv(o.blk, o.blk.s || s) }));
    const VW = C.stairView(B.P, C.stairMode(B.P, B.iz), M, oth), items = [];
    for (const [a, b] of VW.solid) items.push(line(a, b, !items.length));
    for (const [a, b] of VW.dash) items.push(Object.assign(line(a, b, !items.length), { dash: true }));
    if (VW.brk) for (let i = 1; i < VW.brk.length; i++) items.push(line(VW.brk[i - 1], VW.brk[i], !items.length));
    VW.arrows.forEach((ar, k) => { items.push({ type: 'line', layer: 'nacrt', color: GREEN, width: 1.5, pts: ar.map(M), blk: { id: B.id, t: 'stube' } });
      if (k === VW.headAt) { const e = ar.at(-1), f = ar.at(-2), du = e.u - f.u, dv = e.v - f.v, l = Math.hypot(du, dv) || 1, a = du / l, b = dv / l, h = 12;
        items.push(line(e, { u: e.u - h * a - h * 0.5 * b, v: e.v - h * b + h * 0.5 * a }), line(e, { u: e.u - h * a + h * 0.5 * b, v: e.v - h * b - h * 0.5 * a })); } });
    if (!items.length) items.push(line(G.segs[0][0], G.segs[0][0], true));
    if (!items.some(o => o.blk && o.blk.main)) items[0].blk = Object.assign({}, B, { main: true });
    for (const o of items) it.push(o); return; }
  const items = G.segs.map(([a, b], i) => line(a, b, i === 0));
  if (G.arrow.length > 1) { items.push({ type: 'line', layer: 'nacrt', color: GREEN, width: 1.5, pts: G.arrow.map(M), blk: { id: B.id, t: 'stube' } });
    const e = G.arrow.at(-1), f = G.arrow.at(-2), du = e.u - f.u, dv = e.v - f.v, l = Math.hypot(du, dv) || 1, a = du / l, b = dv / l, h = 12;
    items.push(line(e, { u: e.u - h * a - h * 0.5 * b, v: e.v - h * b + h * 0.5 * a }), line(e, { u: e.u - h * a + h * 0.5 * b, v: e.v - h * b - h * 0.5 * a })); }
  for (const o of items) it.push(o);
}
function krHit(p) { return stHit(p, 'krovni'); }
function frHit(p) { return stHit(p, 'free'); }
function stHit(p, only) { let best = null;
  for (const o of app.items()) { if (!(o.blk && o.blk.main && (o.blk.t === 'stube' || isFree(o.blk.t))) || (only && (only === 'free' ? !isFree(o.blk.t) : o.blk.t !== only))) continue; const B = o.blk, s = B.s || stScale(B), nv = nvOf(B.dv), dx = p.x - B.c.x, dy = p.y - B.c.y, u = (dx * B.dv.x + dy * B.dv.y) * s, v = (dx * nv.x + dy * nv.y) * s, G = geoOf(B);
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity; for (const [a, b] of G.segs) for (const q of [a, b]) { u0 = Math.min(u0, q.u); u1 = Math.max(u1, q.u); v0 = Math.min(v0, q.v); v1 = Math.max(v1, q.v); }
    /* v2.61: dodir u pikselima zaslona (ne samo 15 cm) i manji blok ima prednost – stup na gredi se može odabrati, tanka greda pogoditi */
    const m = Math.max(15, 22 / (app.scale() || 1) * s); if (u >= u0 - m && u <= u1 + m && v >= v0 - m && v <= v1 + m) { const ext = (u1 - u0) * (v1 - v0 + 1), dd = Math.max(0, u0 - u, u - u1) + Math.max(0, v0 - v, v - v1); if (!best || dd < best.dd - 1e-9 || (Math.abs(dd - best.dd) < 1e-9 && ext < best.ext)) best = { id: B.id, dd, ext }; } }
  return best ? best.id : null; }
function snapDir(d) { const m = TR.geoM(), th = (m && m.theta) || 0; let best = null, bd = -2; for (const k of [0, 1, 2, 3]) { const v = C.rotP({ x: Math.cos(k * Math.PI / 2), y: Math.sin(k * Math.PI / 2) }, th), dot = v.x * d.x + v.y * d.y; if (dot > bd) { bd = dot; best = v; } } return { x: Math.round(best.x * 1e4) / 1e4, y: Math.round(best.y * 1e4) / 1e4 }; }
function stPlace(a, d) {
  if (curLayer() !== 'nacrt') { toast('🪜 Stubište se postavlja u sloju Nacrt.'); return; }
  const dv = snapDir(d || { x: 1, y: 0 }), id = 's' + Date.now().toString(36), P = stLast(); delete P.okret0;
  const B = { id, t: 'stube', c: { x: Math.round(a.x * 10) / 10, y: Math.round(a.y * 10) / 10 }, dv, P };
  app.snapshot(); stBuild(B); app.save(); app.redraw(); stMenu(id, true);
}
/* okvir stubišta u koordinatama analize (ravnina zidova) */
const stTh = () => (T.m && T.m.theta) || ((TR.geoM() || {}).theta) || 0;
function stBox(B) { const G = geoOf(B), M = stMap(B, B.s || stScale(B)), th = stTh(); let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [a, b] of G.segs) for (const q of [a, b]) { const r = C.rotP(M(q), -th); x0 = Math.min(x0, r.x); x1 = Math.max(x1, r.x); y0 = Math.min(y0, r.y); y1 = Math.max(y1, r.y); }
  return { x0, x1, y0, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 }; }
function stShift(B, dx, dy) { const d = C.rotP({ x: dx, y: dy }, stTh()); B.c = { x: Math.round((B.c.x + d.x) * 10) / 10, y: Math.round((B.c.y + d.y) * 10) / 10 }; }
function stWalls(bx) { const m = T.m; if (!m) return null; const E = m.E, c = { x: bx.cx, y: bx.cy }, room = roomsOf().find(r => r.has(c)), W = room ? room.walls.map(e => e.w) : m.walls.filter(w => !w.view && !w.obj), out = {};
  const pick = (o, lo, hi, cen, a0, a1) => { let L = null, R = null; for (const w of W) { if (w.o !== o || w.e1 < a0 - E || w.e0 > a1 + E) continue; if (w.c <= cen && (!L || w.c > L.c)) L = w; if (w.c >= cen && (!R || w.c < R.c)) R = w; } return [L, R]; };
  [out.xL, out.xR] = pick('V', bx.x0, bx.x1, bx.cx, bx.y0, bx.y1); [out.yL, out.yR] = pick('H', bx.y0, bx.y1, bx.cy, bx.x0, bx.x1); return out; }
function halfT(w) { const S = TR.tl(app.currentFloor()), st = (T.st && T.st.settings) || C.DEFAULTS, t = w.tLabel || S.wallT[C.wallKey(w)] || (w.exterior ? st.ext : st.int) || 0; return t / 2; }
/* položaj od zidova: B.pos = { x: {side:-1|1, off}, y: {...} } – vrijedi i nakon okretanja / promjene mjera */
function stApplyPos(B) { if (!B.pos) return; TR.analyzeNow(true); if (!T.m) return; const s = B.s || stScale(B), bx = stBox(B), W = stWalls(bx); if (!W) return; let dx = 0, dy = 0;
  const px = B.pos.x, py = B.pos.y;
  let vx = 0, vy = 0; /* v2.33: na skici je zid jedna crta (os zida) – crtež bloka se primakne do crte za pola debljine zida; podaci (DXF) ostaju točni */
  if (px && px.off != null) { const w = px.side < 0 ? W.xL : W.xR; if (w) { dx = px.side < 0 ? w.c + (halfT(w) + px.off) / s - bx.x0 : w.c - (halfT(w) + px.off) / s - bx.x1; vx = (px.side < 0 ? -1 : 1) * halfT(w) / s; } }
  if (py && py.off != null) { const w = py.side < 0 ? W.yL : W.yR; if (w) { dy = py.side < 0 ? w.c + (halfT(w) + py.off) / s - bx.y0 : w.c - (halfT(w) + py.off) / s - bx.y1; vy = (py.side < 0 ? -1 : 1) * halfT(w) / s; } }
  stShift(B, dx, dy); B.vis = (vx || vy) ? { x: Math.round(vx * 10) / 10, y: Math.round(vy * 10) / 10 } : null; }
const SIDEW = { lijevi: '← od lijevog zida', desni: 'od desnog zida →', gornji: '↑ od gornjeg zida', donji: '↓ od donjeg zida' };
function stMoveStart(p, id, e) { const M0 = stMain(id); if (!M0) return; const c0 = Object.assign({}, M0.blk.c), cv = $('canvas'), sx = e.clientX, sy = e.clientY, pid = e.pointerId; let moved = false, multi = false;
  const dn = ev => { if (ev.pointerId !== pid) multi = true; };
  const mv = ev => { if (ev.pointerId !== pid || multi) return; if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 10) return; if (!moved) { moved = true; app.snapshot(); }
    const r = cv.getBoundingClientRect(), q = app.world({ x: ev.clientX - r.left, y: ev.clientY - r.top }), M = stMain(id); if (!M) return; const B = JSON.parse(JSON.stringify(M.blk)); delete B.main; delete B.pos;
    B.c = { x: Math.round((c0.x + q.x - p.x) * 10) / 10, y: Math.round((c0.y + q.y - p.y) * 10) / 10 }; stBuild(B); app.redraw(); };
  const up = ev => { if (ev.pointerId !== pid) return; window.removeEventListener('pointerdown', dn, true); window.removeEventListener('pointermove', mv, true); window.removeEventListener('pointerup', up, true); window.removeEventListener('pointercancel', up, true);
    if (moved && M0.blk.t === 'stup') { const Mx = stMain(id); if (Mx) { const B = JSON.parse(JSON.stringify(Mx.blk)); delete B.main; delete B.pos; const why = stupSnap(B); stBuild(B); app.redraw(); app.save(); T.sig = ''; toast('▣ Stup pomaknut – ' + (why || 'slobodno') + '.'); } }
    else if (moved) { app.save(); T.sig = ''; toast((isFree(M0.blk.t) ? FR_INFO[M0.blk.t][0] + ' ' + FR_INFO[M0.blk.t][1] + ' – pomaknuto' : '🪜 Stubište pomaknuto') + '. Točan razmak od zida: dodirni ga → Položaj.'); } else if (!multi && ev.type === 'pointerup') stMenu(id); };
  window.addEventListener('pointerdown', dn, true); window.addEventListener('pointermove', mv, true); window.addEventListener('pointerup', up, true); window.addEventListener('pointercancel', up, true); }
/* v2.35: isto stubište na etažu iznad – tamo se crta cijelo (Auto), na istom mjestu; ponovno kopiranje zamijeni staru kopiju */
function stCopyUp(id) { const M = stMain(id); if (!M) return; const fs = app.floors(), fi = app.floorIndex(), F = fs[fi + 1]; if (!F) return; F.items = F.items || [];
  const src = JSON.parse(JSON.stringify(M.blk)); delete src.main; const oldIds = new Set(F.items.filter(o => o.blk && o.blk.main && o.blk.src === src.id).map(o => o.blk.id));
  for (let i = F.items.length - 1; i >= 0; i--) if (F.items[i].blk && oldIds.has(F.items[i].blk.id)) F.items.splice(i, 1);
  const B = Object.assign(src, { id: 's' + Date.now().toString(36), src: src.id, iz: fs[fi].name || 'etaža ispod', sFix: M.blk.s || stScale(M.blk) }); B.P = Object.assign({}, B.P); delete B.P.prikaz; delete B.pos;
  stBuild(B, F.items); app.save(); toast('🪜 Stubište kopirano na „' + (F.name || 'etažu iznad') + '” – tamo se crta cijelo.' + (oldIds.size ? ' (stara kopija zamijenjena)' : '')); }
function stMenu(id, fresh) {
  const M = stMain(id); if (!M) return; const B = JSON.parse(JSON.stringify(M.blk)); delete B.main; const P = B.P = Object.assign({}, C.ST_DEF, B.P || {});
  if (!fresh) app.snapshot();
  const fld = (k, lab, ph, show) => show ? '<label class="tp-lab" style="flex:1 1 130px">' + lab + '<input data-p="' + k + '" inputmode="decimal" value="' + esc(P[k] != null ? String(P[k]).replace('.', ',') : '') + '" placeholder="' + esc(ph) + '"></label>' : '';
  const KR = isFree(B.t), DEF = B.t === 'krovni' ? KR_DEF : FR_DEF[B.t] || {}; if (KR) { for (const k of Object.keys(C.ST_DEF)) if (!(M.blk.P && k in M.blk.P)) delete P[k]; for (const k in DEF) if (P[k] == null) P[k] = DEF[k]; }
  const render = () => { if (KR) { renderKr(); return; } const vr = P.vrsta, G = C.stairGeo(P), h = G.h, bl = h > 0 ? 2 * h + G.g : NaN;
    d.querySelector('.tp-card').innerHTML = '<div class="tp-head"><b style="flex:1">🪜 Stubište</b><button data-a="ok" style="background:#17457f;color:#fff">✓ Spremi</button><button data-a="x">✕</button></div>' +
      '<div class="tp-row">' + VRSTE.map(([k, n]) => '<button data-v="' + k + '" style="' + (k === vr ? 'background:#17457f;color:#fff' : '') + '">' + n + '</button>').join('') + '</div>' +
      (vr !== 'ravno' ? '<div class="tp-row"><span style="align-self:center;font-weight:700">Okret:</span><button data-o="-1" style="' + (num(P.okret) < 0 ? 'background:#17457f;color:#fff' : '') + '">↰ lijevo</button><button data-o="1" style="' + (num(P.okret) >= 0 ? 'background:#17457f;color:#fff' : '') + '">↱ desno</button></div>' : '') +
      '<div class="tp-row" style="align-items:flex-end">' + fld('n', 'Broj visina (stuba)', '17', true) + fld('H', 'Visina etaže (cm)', 'npr. 280', true) + fld('g', 'Gazište (cm)', '27', vr !== 'spiralno') + fld('b', 'Širina kraka (cm)', '90', vr !== 'spiralno') +
      fld('n1', 'Gazišta u 1. kraku' + (vr === 'L3' || vr === 'U3' ? ' (0 = odmah trokuti)' : ' (0 = odmah podest)'), 'pola', vr !== 'ravno' && vr !== 'spiralno') + fld('n2', 'Gazišta u 2. kraku', 'ostatak', vr !== 'ravno' && vr !== 'spiralno') + fld('nz', 'Broj trokuta (zavojnih)', '3', vr === 'L3') + fld('L1', vr === 'ravno' ? 'Duljina kraka (cm)' : 'Duljina 1. kraka (cm)', 'nije mjereno', vr !== 'spiralno') + fld('L2', 'Duljina 2. kraka (cm)', 'nije mjereno', vr !== 'ravno' && vr !== 'spiralno') + fld('oko', 'Razmak krakova (cm)', '10', vr === 'U' || vr === 'U3') + fld('D', 'Promjer (cm)', '160', vr === 'spiralno') + fld('d0', 'Stup u sredini (cm)', '20', vr === 'spiralno') + fld('kut', 'Kut okreta (°)', '360', vr === 'spiralno') + '</div>' +
      ((num(P.L1) > 0 || num(P.L2) > 0) && vr !== 'spiralno' ? '<div class="tp-note" style="margin-top:8px">📏 Gazište iz duljine kraka: <b>' + fmt(G.g, 1) + ' cm</b> (duljina od prve do zadnje visine ÷ broj gazišta u tom kraku). Polje Gazište se tada ne koristi.</div>' : '') +
      '<div class="tp-note" style="margin-top:8px">' + (h > 0 ? 'Visina stube h = <b>' + fmt(h, 1) + ' cm</b>' + (vr !== 'spiralno' ? ' · 2h + g = <b>' + fmt(bl, 1) + ' cm</b> ' + (bl >= 59 && bl <= 65 ? '✓ udobno (59–65)' : '⚠ izvan 59–65') : '') : 'Upiši visinu etaže pa se izračuna visina stube.') + '</div>' +
      '<div class="tp-row"><button data-a="flip">⇅ Okreni smjer penjanja</button><button data-a="rot">↻ Zakreni 90°</button><button data-a="del">🗑 Izbriši</button></div>' +
      prikazUI() + posUI() +
      '<div class="tp-note">Zelena strelica pokazuje smjer penjanja; točka je prva stuba. Stube idu u DXF (sloj STUBISTE) i u presjek.</div>';
    bind(); };
  const prikazUI = () => { const pk = P.prikaz === 'presjek' || P.prikaz === 'cijelo' ? P.prikaz : 'auto', md = C.stairMode(P, B.iz), fs = app.floors(), up = fs[app.floorIndex() + 1];
    return '<div class="tp-head" style="margin-top:10px"><b style="flex:1">👁 Prikaz na ovoj etaži</b></div><div class="tp-row">' + [['auto', 'Auto'], ['presjek', '✂ Presjek'], ['cijelo', '▦ Cijelo']].map(([k, n]) => '<button data-pk="' + k + '" style="' + (k === pk ? 'background:#17457f;color:#fff' : '') + '">' + n + '</button>').join('') + '</div>' +
      (md === 'presjek' ? '<div class="tp-row" style="align-items:flex-end">' + fld('nc', 'Punih stuba do crte presjeka', '5', true) + '</div>' : '') +
      '<div class="tp-note">Auto: stubište nacrtano na ovoj etaži ide gore → <b>presjek</b> (par stuba puno, ostatak crtkano); kopirano s etaže ispod → <b>cijelo</b>. Kad se na etaži sastanu oba, ne preklapaju se.' + (B.iz ? ' Ovo je kopija s etaže „' + esc(B.iz) + '”.' : '') + ' Sad: <b>' + (md === 'presjek' ? 'presjek' : 'cijelo') + '</b>.</div>' +
      '<div class="tp-row">' + (up ? '<button data-a="kopiraj" style="border-color:#16a34a;color:#166534">⬆ Kopiraj na „' + esc(up.name || 'etažu iznad') + '” (cijelo, isti položaj)</button>' : '<span class="tp-note" style="margin:0">Za kopiranje na kat dodaj etažu iznad (+ gore).</span>') + '</div>'; };
  const renderKr = () => { if (B.t !== 'krovni') { renderFr(); return; } const G = krGeo(P);
    d.querySelector('.tp-card').innerHTML = '<div class="tp-head"><b style="flex:1">🪟 Krovni prozor</b><button data-a="ok" style="background:#17457f;color:#fff">✓ Spremi</button><button data-a="x">✕</button></div>' +
      '<div class="tp-row" style="align-items:flex-end">' + fld('w', 'Širina (cm)', '78', true) + fld('h', 'Visina (cm)', '118', true) + fld('nag', 'Nagib krova (°)', 'prazno = bez', true) + fld('p', 'Donji rub od poda (cm)', 'npr. 100', true) + '</div>' +
      '<div class="tp-note">U tlocrtu crtkano: ' + fmt(G.w, 0) + ' × ' + fmt(G.d, 0) + ' cm' + (G.d !== G.h ? ' (visina ' + fmt(G.h, 0) + ' projicirana s nagibom)' : '') + '. Širina ide uzduž gumba ↻.</div>' +
      '<div class="tp-row"><button data-a="rot">↻ Zakreni 90°</button><button data-a="del">🗑 Izbriši</button></div>' + posUI() +
      '<div class="tp-note">Krovni prozor ide u DXF na sloj KROVNI_PROZOR (crtkano). Pomakni ga povlačenjem dok je uključen gumb Prozor.</div>';
    bind(); };
  const renderFr = () => { const t = B.t, G = frGeo(t, P), I = FR_INFO[t];
    const REG = t === 'terasa' && Array.isArray(P.reg), ANC = t === 'terasa' && !!B.anc;
    const flds = t === 'otvorp' ? fld('w', 'Širina (cm)', '100', true) + fld('h', 'Duljina (cm)', '250', true)
      : REG ? fld('k', 'Koeficijent (etažni)', 'npr. 0,25', true)
      : ANC ? fld('h', 'Dubina od pročelja (cm)', '150', true) + fld('wz', 'Duljina uzduž zida (cm)', 'cijeli zid', true) + fld('od', 'Od ugla (cm)', '0', true) + fld('k', 'Koeficijent (etažni)', 'npr. 0,25', true)
      : t === 'terasa' ? fld('w', 'Širina (cm)', '300', true) + fld('h', 'Dubina (cm)', '150', true) + fld('k', 'Koeficijent (etažni)', 'npr. 0,25', true)
      : t === 'greda' ? fld('b', 'Širina grede (cm)', '25', true) + fld('h', 'Visina grede (cm)', 'prazno = h − hgr', true) + fld('d', 'hgr – donji rub od poda (cm)', 'npr. 230', true) + fld('L', 'Duljina (cm)', '300', true)
      : t === 'stup' ? (P.f === 'ok' ? fld('D', 'Promjer Ø (cm)', '30', true) : fld('a', 'Širina (cm)', '30', true) + fld('b', 'Dubina (cm)', '30', true))
      : fld('L', 'Duljina praga (cm)', '90', true) + fld('dh', 'Razlika visine poda (cm, + gore / − dolje)', 'npr. 15', true);
    const nz = t === 'terasa' ? '<div class="tp-row">' + ['Terasa', 'Balkon', 'Lođa', 'Nadstrešnica', 'Trijem'].map(n => '<button data-nz="' + n + '" style="' + (P.naziv === n ? 'background:#17457f;color:#fff' : '') + '">' + n + '</button>').join('') + '</div>' : '';
    const note = { otvorp: 'Otvor u stropnoj/podnoj ploči (npr. za stubište na katu): crtkano s križem. DXF: sloj OTVOR_PLOCA.', terasa: REG ? 'Iz nacrtanog obrisa (zidovi + crte Pogleda): ' + fmt(G.A, 2) + ' m² po skici. Oblik mijenjaš crtama, mjere upisuješ kao obične kote. DXF: sloj TERASA.' : ANC ? 'Uz pročelje: ' + fmt(G.w, 0) + ' × ' + fmt(G.h, 0) + ' cm = ' + fmt(G.A, 2) + ' m². DXF: sloj TERASA.' : 'Vanjska površina, crtkano s nazivom i površinom (' + fmt(G.A, 2) + ' m²). DXF: sloj TERASA. Ne ulazi u prostorije.', greda: 'Na skici jedna crtkana crta, u DXF-u dvije crte u širini grede (sloj GREDE). Visina grede: upiši je, ili upiši samo hgr (donji rub od poda) – onda je visina grede = h prostorije − hgr. Možeš i upisati tekst „hgr=230” u prostoriju pa vrijedi za sve grede u njoj.', stup: 'Stup ide u DXF na sloj STUPOVI (s križem). Povuci ga uz zid ili na gredu – sam se zalijepi.', prag: 'Stepenik / promjena visine poda: crta s oznakom razlike. DXF: sloj PRAG.' }[t];
    d.querySelector('.tp-card').innerHTML = '<div class="tp-head"><b style="flex:1">' + I[0] + ' ' + I[1] + '</b><button data-a="ok" style="background:#17457f;color:#fff">✓ Spremi</button><button data-a="x">✕</button></div>' + nz +
      (t === 'stup' ? '<div class="tp-row">' + [['kv', '▢ Četvrtasti'], ['ok', '◯ Okrugli']].map(([k, n]) => '<button data-sf="' + k + '" style="' + ((P.f || 'kv') === k ? 'background:#17457f;color:#fff' : '') + '">' + n + '</button>').join('') + '</div>' : '') +
      '<div class="tp-row" style="align-items:flex-end">' + flds + '</div><div class="tp-note">' + note + '</div>' +
      (ANC ? '<div class="tp-row"><span style="align-self:center;font-weight:700">Od ugla:</span>' + [-1, 1].map(sd => '<button data-te="' + sd + '" style="' + ((P.end > 0 ? 1 : -1) === sd ? 'background:#16a34a;color:#fff' : '') + '">' + terEndWord(B, sd) + '</button>').join('') + '</div>' : '') +
      '<div class="tp-row">' + (REG || ANC ? '' : '<button data-a="rot">↻ Zakreni 90°</button>') + '<button data-a="del">🗑 Izbriši</button></div>' + (REG || ANC ? '' : posUI() + '<div class="tp-note">Pomakni ga povlačenjem dok je uključen gumb ➕ Ostalo.</div>');
    bind(); d.querySelectorAll('[data-te]').forEach(b => b.onclick = () => { P.end = +b.dataset.te; apply(); render(); }); d.querySelectorAll('[data-nz]').forEach(b => b.onclick = () => { P.naziv = b.dataset.nz; apply(); render(); }); d.querySelectorAll('[data-sf]').forEach(b => b.onclick = () => { P.f = b.dataset.sf; apply(); render(); }); };
  const apply = keep => { if (B.anc || (B.P && B.P.reg)) keep = null; const c0 = keep ? stBox(Object.assign({}, B, { P: keep.P, dv: keep.dv, c: keep.c })) : null;
    if (c0) { const c1 = stBox(B); let dx = c0.cx - c1.cx, dy = c0.cy - c1.cy; /* promjena oblika/okret: drži se ruba bližeg zidu (ili sredine), pa ostani unutar prostorije */
      try { TR.analyzeNow(true); const W = T.m ? stWalls(c0) : null; if (W && !B.pos) { const E = T.m.E;
        const anc = (lo, hi, L, R, nlo, nhi) => { const gL = L ? lo - L.c : Infinity, gR = R ? R.c - hi : Infinity; if (Math.min(gL, gR) > 6 * E) return null; return gL <= gR ? lo - nlo : hi - nhi; };
        const ax = anc(c0.x0, c0.x1, W.xL, W.xR, c1.x0, c1.x1), ay = anc(c0.y0, c0.y1, W.yL, W.yR, c1.y0, c1.y1); if (ax != null) dx = ax; if (ay != null) dy = ay;
        const fit = (d, lo, hi, L, R) => { const m0 = L ? L.c + 0.3 * E : -Infinity, m1 = R ? R.c - 0.3 * E : Infinity; if (hi - lo > m1 - m0) return d; if (lo + d < m0) return m0 - lo; if (hi + d > m1) return m1 - hi; return d; };
        dx = fit(dx, c1.x0, c1.x1, W.xL, W.xR); dy = fit(dy, c1.y0, c1.y1, W.yL, W.yR); } } catch (e) { }
      stShift(B, dx, dy); }
    if (B.anc) terAnc(B); else stApplyPos(B); const it = app.items(); for (let i = it.length - 1; i >= 0; i--) if (it[i].blk && it[i].blk.id === id) it.splice(i, 1); stBuild(B); app.save(); app.redraw(); };
  const snap0 = () => ({ P: JSON.parse(JSON.stringify(P)), dv: Object.assign({}, B.dv), c: Object.assign({}, B.c) });
  const posUI = () => { TR.analyzeNow(true); if (!T.m) return ''; const bx = stBox(B), W = stWalls(bx) || {}, s = B.s || stScale(B), c = { x: bx.cx, y: bx.cy }, pos = B.pos || {};
    const gap = (ax, sd) => { const w = W[ax + (sd < 0 ? 'L' : 'R')]; if (!w) return null; const g = ax === 'x' ? (sd < 0 ? bx.x0 - w.c : w.c - bx.x1) : (sd < 0 ? bx.y0 - w.c : w.c - bx.y1); return Math.round(g * s - halfT(w)); };
    const row = ax => { const sides = [-1, 1].filter(sd => W[ax + (sd < 0 ? 'L' : 'R')]); if (!sides.length) return ''; const cur = pos[ax] ? pos[ax].side : (B._sd && sides.includes(B._sd[ax])) ? B._sd[ax] : (sides.length > 1 && Math.abs(gap(ax, 1)) < Math.abs(gap(ax, -1)) ? 1 : sides[0]);
      const word = sd => SIDEW[scrWord(c, ax === 'x' ? { x: c.x + sd * 50, y: c.y } : { x: c.x, y: c.y + sd * 50 })];
      return '<div class="tp-row" style="align-items:center;flex-wrap:nowrap">' + sides.map(sd => '<button data-ps="' + ax + ':' + sd + '" style="' + (sd === cur ? 'background:#17457f;color:#fff' : '') + ';padding:6px 8px">' + word(sd) + '</button>').join('') +
        '<input data-pv="' + ax + ':' + cur + '" inputmode="decimal" style="width:80px;font-size:18px;padding:5px 6px" placeholder="' + (gap(ax, cur) != null ? gap(ax, cur) : '') + '" value="' + (pos[ax] && pos[ax].off != null ? String(pos[ax].off).replace('.', ',') : '') + '"><span>cm</span></div>'; };
    return '<div class="tp-head" style="margin-top:10px"><b style="flex:1">📍 Položaj od zida</b><button data-a="kut">⌐ U kut</button><button data-a="free">Slobodno</button></div>' + row('x') + row('y') +
      '<div class="tp-note">Upiši razmak od zida (0 = uz zid). Prazno = slobodno, kako je nacrtano. Stubište možeš i odvući prstom/olovkom dok je uključen gumb Stubište.</div>'; };
  const bind = () => { const c = d.querySelector('.tp-card');
    c.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { const k0 = snap0(); P.vrsta = b.dataset.v; apply(k0); render(); });
    c.querySelectorAll('[data-pk]').forEach(b => b.onclick = () => { const v = b.dataset.pk; if (v === 'auto') delete P.prikaz; else P.prikaz = v; apply(); render(); });
    c.querySelectorAll('[data-o]').forEach(b => b.onclick = () => { const k0 = snap0(); P.okret = +b.dataset.o; apply(k0); render(); });
    c.querySelectorAll('[data-p]').forEach(inp => inp.onchange = () => { const k0 = snap0(), k = inp.dataset.p, v = String(inp.value).trim(); if (v === '') delete P[k]; else P[k] = num(v); if (k === 'n') delete P.n2; /* broj visina upisan ručno → 2. krak je ostatak */ if (P.n2 != null && !KR) P.n = C.stairGeo(P).n; apply(k0); render(); });
    c.querySelectorAll('[data-ps]').forEach(b => b.onclick = () => { const [ax, sd] = b.dataset.ps.split(':'); (B._sd = B._sd || {})[ax] = +sd; const inp = c.querySelector('[data-pv^="' + ax + ':"]'), v = inp ? num(inp.value) : NaN, pos = B.pos || {};
      const off = pos[ax] && pos[ax].off != null ? pos[ax].off : (Number.isFinite(v) ? v : null); if (off != null) { B.pos = pos; pos[ax] = { side: +sd, off }; } apply(); render(); });
    c.querySelectorAll('[data-pv]').forEach(inp => inp.onchange = () => { const [ax, sd] = inp.dataset.pv.split(':'), v = num(inp.value); const pos = B.pos = B.pos || {}; if (Number.isFinite(v)) pos[ax] = { side: +sd, off: v }; else delete pos[ax]; if (!Object.keys(pos).length) delete B.pos; apply(); render(); });
    c.querySelectorAll('[data-a]').forEach(b => b.onclick = () => { const a = b.dataset.a;
      if (a === 'kut') { TR.analyzeNow(true); const bx = stBox(B), W = stWalls(bx) || {}, sdx = W.xL && W.xR ? ((bx.x0 - W.xL.c) <= (W.xR.c - bx.x1) ? -1 : 1) : (W.xL ? -1 : 1), sdy = W.yL && W.yR ? ((bx.y0 - W.yL.c) <= (W.yR.c - bx.y1) ? -1 : 1) : (W.yL ? -1 : 1); B.pos = { x: { side: sdx, off: 0 }, y: { side: sdy, off: 0 } }; apply(); render(); return; }
      if (a === 'free') { delete B.pos; apply(); render(); return; }
      if (a === 'kopiraj') { c.querySelectorAll('[data-p]').forEach(inp => { const v = String(inp.value).trim(); if (v === '') delete P[inp.dataset.p]; else P[inp.dataset.p] = num(v); }); apply(); stCopyUp(id); render(); return; }
      if (a === 'x' || a === 'ok') { c.querySelectorAll('[data-p]').forEach(inp => { const v = String(inp.value).trim(); if (v === '') delete P[inp.dataset.p]; else P[inp.dataset.p] = num(v); }); apply(); store.set(KR ? 'izmjera-fr-' + B.t : 'izmjera-stube', JSON.stringify(KR ? Object.fromEntries(Object.entries(P).filter(([k]) => !/^(p|d)$/.test(k) || B.t === 'greda')) : Object.fromEntries(Object.entries(P).filter(([k]) => k !== 'prikaz')))); T.sig = ''; d.remove(); return; }
      if (a === 'flip') { const G = C.stairGeo(P); const end = G.arrow.at(-1), nv = nvOf(B.dv), s = B.s || stScale(B); const k0 = snap0(); if (P.vrsta === 'ravno' && end) { B.c = { x: B.c.x + (end.u * B.dv.x + end.v * nv.x) / s, y: B.c.y + (end.u * B.dv.y + end.v * nv.y) / s }; } B.dv = { x: -B.dv.x, y: -B.dv.y }; apply(k0); render(); return; }
      if (a === 'rot') { const k0 = snap0(); B.dv = { x: -B.dv.y, y: B.dv.x }; apply(k0); render(); return; }
      if (a === 'del') { const it = app.items(); for (let i = it.length - 1; i >= 0; i--) if (it[i].blk && it[i].blk.id === id) it.splice(i, 1); app.save(); app.redraw(); d.remove(); toast(KR ? '🗑 ' + FR_INFO[B.t][1] + ' – izbrisano. (Poništi ↶ vraća)' : '🗑 Stubište izbrisano. (Poništi ↶ vraća)'); } }); };
  const d = sheet(''); d.style.background = 'transparent'; d.style.pointerEvents = 'none'; d.classList.add('nb'); const cd = d.querySelector('.tp-card'); cd.style.maxWidth = 'min(520px,100%)'; cd.style.pointerEvents = 'auto'; cd.style.boxShadow = '0 10px 30px rgba(0,0,0,.35)';
  { const cv = $('canvas'), r = cv.getBoundingClientRect(), sp = app.screen(B.c), x = r.left + sp.x, y = r.top + sp.y; // izbornik na stranu, da se stubište vidi
    if (innerWidth > innerHeight) { d.style.alignItems = 'flex-start'; d.style.justifyContent = x > innerWidth / 2 ? 'flex-start' : 'flex-end'; } else d.style.alignItems = y > innerHeight / 2 ? 'flex-start' : 'flex-end'; }
  render();
}
/* rukom nacrtano stubište → blok 🪜 (isti smjer, broj crta, širina i duljina; crte unutar stubišta se brišu) */
function stReplace(S) { if (!S || !T.m) return; const m = T.m, th = m.theta || 0, sc = scaleNow() > 0 ? scaleNow() : 3, dir = S.dir < 0 ? -1 : 1, H = S.o === 'H', nL = Math.max(3, S.nLines || S.n || 3);
  const run = S.c1 - S.c0, wid = S.a1 - S.a0, ac = (S.a0 + S.a1) / 2, cs = dir > 0 ? S.c0 : S.c1, start = raw(H ? { x: ac, y: cs } : { x: cs, y: ac }), dv = snapDir(C.rotP(H ? { x: 0, y: dir } : { x: dir, y: 0 }, th));
  const n = S.n > 1 && S.n !== S.nLines ? S.n : nL, P = Object.assign({}, C.ST_DEF, { vrsta: 'ravno', n, g: Math.round((S.L > 0 ? S.L : run * sc) / Math.max(1, nL - 1) * 10) / 10, b: Math.round((S.w > 0 ? S.w : wid * sc)) });
  const E = m.E, bx0 = (H ? S.a0 : S.c0) - 1.2 * E, bx1 = (H ? S.a1 : S.c1) + 1.2 * E, by0 = (H ? S.c0 : S.a0) - 1.2 * E, by1 = (H ? S.c1 : S.a1) + 1.2 * E, inB = q => { const a = C.rotP(q, -th); return a.x > bx0 && a.x < bx1 && a.y > by0 && a.y < by1; };
  const it = app.items(); for (let i = it.length - 1; i >= 0; i--) { const o = it[i]; if ((o.layer === 'nacrt' || o.layer === 'pogled') && !o.blk && o.pts && o.pts.length > 1 && o.pts.every(inB)) it.splice(i, 1); }
  const id = 's' + Date.now().toString(36), B = { id, t: 'stube', c: { x: Math.round(start.x * 10) / 10, y: Math.round(start.y * 10) / 10 }, dv, P }; stBuild(B); app.save(); T.sig = ''; T.mGeo = null; app.redraw(); toast('🪜 Stubište zamijenjeno blokom – dodirni ga (gumb Stubište) za mjere i položaj.'); }
function stTap(p) { const h = stHit(p); if (h) { stMenu(h); return; } stPlace(p, null); }
function stDragStart(p) {
  const cv = $('canvas'); ST.drag = { pts: [p] };
  const mv = e => { const r = cv.getBoundingClientRect(); ST.drag.pts.push(app.world({ x: e.clientX - r.left, y: e.clientY - r.top })); app.redraw(); };
  const up = () => { window.removeEventListener('pointermove', mv, true); window.removeEventListener('pointerup', up, true); window.removeEventListener('pointercancel', up, true);
    const dd = ST.drag; ST.drag = null; if (!dd) return; const a = dd.pts[0], b = dd.pts.at(-1), L = Math.hypot(b.x - a.x, b.y - a.y);
    if (L < 14 / app.scale()) stTap(a); else stPlace(a, { x: (b.x - a.x) / L, y: (b.y - a.y) / L }); app.redraw(); };
  window.addEventListener('pointermove', mv, true); window.addEventListener('pointerup', up, true); window.addEventListener('pointercancel', up, true);
}

/* ======================= ◰ ZUB / NIŠA: mala zatvorena ploha → izbočenje (stup, dimnjak) ili udubljenje (niša) ======================= */
const ZB = { mode: false };
function zubStrokesIn(r) { const E = T.m.E, th = T.m.theta || 0, out = []; app.items().forEach(o => { if (o.layer !== 'nacrt' || o.blk || o.type === 'text' || !o.pts || o.pts.length < 2) return;
    if (o.pts.every(q => { const a = C.rotP(q, -th); return a.x > r.x0 - 1.5 * E && a.x < r.x1 + 1.5 * E && a.y > r.y0 - 1.5 * E && a.y < r.y1 + 1.5 * E; })) out.push(o); }); return out; }
function zubGroups() { const g = new Map(); for (const o of app.items()) if (o.zub && o.zubId) { if (!g.has(o.zubId)) g.set(o.zubId, { id: o.zubId, k: o.zub, its: [] }); g.get(o.zubId).its.push(o); } return [...g.values()]; }
function zubHit(p) { for (const g of zubGroups()) { let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; for (const o of g.its) for (const q of o.pts) { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); } const m = 12 / app.scale(); if (p.x > x0 - m && p.x < x1 + m && p.y > y0 - m && p.y < y1 + m) return g; } return null; }
/* v2.20: plohe izravno iz nacrtanih crta (analiza spaja dvije bliske usporedne crte u debeli zid pa mala ploha u kutu nestane) */
function rawWalls() { const th = T.m.theta || 0, out = []; const add = (o, a, b) => { const A = C.rotP(a, -th), B = C.rotP(b, -th), dx = B.x - A.x, dy = B.y - A.y; if (Math.abs(dy) <= 0.2 * Math.abs(dx)) out.push({ o: 'H', c: (A.y + B.y) / 2, e0: Math.min(A.x, B.x), e1: Math.max(A.x, B.x) }); else if (Math.abs(dx) <= 0.2 * Math.abs(dy)) out.push({ o: 'V', c: (A.x + B.x) / 2, e0: Math.min(A.y, B.y), e1: Math.max(A.y, B.y) }); };
  for (const o of app.items()) { if (o.layer !== 'nacrt' || o.blk || o.type === 'text' || !o.pts || o.pts.length < 2) continue; const P = o.pts; if (P.length === 2) { add(o, P[0], P[1]); continue; }
    let s = 0; const dir = (i, j) => { const a = C.rotP(P[i], -th), b = C.rotP(P[j], -th); return Math.abs(b.x - a.x) >= Math.abs(b.y - a.y) ? 'H' : 'V'; };
    for (let i = 1; i < P.length; i++) { if (i === P.length - 1 || dir(i - 1, i) !== dir(i, i + 1)) { add(o, P[s], P[i]); s = i; } } }
  return out.filter(w => w.e1 - w.e0 > 0.5).map((w, i) => Object.assign(w, { id: i })); }
function zubTap(p) {
  TR.analyzeNow(true); if (!T.m) { toast('Prvo nacrtaj zidove.'); return; }
  const g0 = zubHit(p); let its = g0 ? g0.its : null, cur = g0 ? g0.k : null;
  if (!its) { const a = C.rotP(p, -(T.m.theta || 0)), rs = roomsOf(true, false, rawWalls()).filter(x => x.has(a)).sort((u, v) => (u.x1 - u.x0) * (u.y1 - u.y0) - (v.x1 - v.x0) * (v.y1 - v.y0)), r = rs[0]; if (!r) { toast('◰ Dodirni unutar male zatvorene plohe (omeđene crtama).'); return; } its = zubStrokesIn(r); if (!its.length) { toast('◰ Ta ploha nema svojih crta (omeđena je samo zidovima prostorije).'); return; } }
  const d = sheet('<div class="tp-head"><b style="flex:1">◰ Što je ova ploha?</b><button data-a="x">✕</button></div>' +
    '<div class="tp-row" style="flex-direction:column;align-items:stretch">' +
    '<button data-k="izb" style="text-align:left;' + (cur === 'izb' ? 'background:#17457f;color:#fff' : '') + '">▨ <b>Izbočenje</b> – stup, dimnjak, zadebljanje zida (puno, nije prostorija)</button>' +
    '<button data-k="nisa" style="text-align:left;' + (cur === 'nisa' ? 'background:#17457f;color:#fff' : '') + '">⊔ <b>Udubljenje</b> – niša u zidu (dio prostorije)</button>' +
    '<button data-k="" style="text-align:left">▢ <b>Prostorija / ništa</b> – makni oznaku</button></div>' +
    (nisAt(p) ? '<div class="tp-row"><button data-m="1">✎ Ispravi upisane mjere</button></div>' : '') +
    '<div class="tp-note">Označene crte (' + its.length + ') ostaju na skici; u DXF-u ploha postaje zid/stup ili niša. Mjere pita Mjeri.</div>');
  { const mb = d.querySelector('[data-m]'); if (mb) mb.onclick = () => { const n = nisAt(p); d.remove(); if (n) nisEdit(n); }; }
  d.querySelectorAll('[data-a]').forEach(b => b.onclick = () => d.remove());
  d.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { app.snapshot(); const k = b.dataset.k, id = (g0 && g0.id) || ('z' + Date.now().toString(36)); for (const o of its) { if (k) { o.zub = k; o.zubId = id; } else { delete o.zub; delete o.zubId; } } app.save(); T.sig = ''; T.mGeo = null; app.redraw(); d.remove();
    toast(k === 'izb' ? '▨ Označeno kao izbočenje (stup/dimnjak).' : k === 'nisa' ? '⊔ Označeno kao udubljenje (niša).' : 'Oznaka maknuta.'); });
}
/* prelazak na Kote/Opisi/Pogled isključi Prozor, Vrata i Stube (ostanu uključeni pa dodir na kotu javlja grešku) */
(() => { const L = $('layer'); if (!L) return; L.addEventListener('change', () => { if (L.value === 'nacrt') return;
  if (T.blkMode) { const b = $(T.blkMode === 'prozor' ? 'terenProzor' : 'terenVrata'); if (b) b.click(); if (T.blkMode) T.blkMode = null; ['terenProzor', 'terenVrata'].forEach(x => $(x) && $(x).classList.remove('active')); }
  if (ST.mode) { ST.mode = false; $('terenStube') && $('terenStube').classList.remove('active'); }
  if (ZB.mode) { ZB.mode = false; $('terenZub') && $('terenZub').classList.remove('active'); } offModes(); }); })();
/* ======================= 🧭 SJEVER: strelica na skici → strane svijeta za energetski ======================= */
const NS = { mode: false, drag: null };
function northTl() { return TR.tl(app.currentFloor()); }
function northSet(on) { NS.mode = on; const b = $('terenSjever'); if (b) b.classList.toggle('active', on); if (on) { toast('🧭 Povuci od bilo koje točke prema SJEVERU (npr. prema strelici s kopije katastra). Dodir bez povlačenja = makni sjever.'); try { const pop = $('ui2MorePop'); if (pop) pop.hidden = true; } catch (e) { } } }
function northStart(p, e) { const cv = $('canvas'); NS.drag = { a: p, b: p }; const pid = e.pointerId;
  const mv = ev => { if (ev.pointerId !== pid) return; const r = cv.getBoundingClientRect(); NS.drag.b = app.world({ x: ev.clientX - r.left, y: ev.clientY - r.top }); app.redraw(); };
  const up = ev => { if (ev.pointerId !== pid) return; window.removeEventListener('pointermove', mv, true); window.removeEventListener('pointerup', up, true); window.removeEventListener('pointercancel', up, true);
    const d = NS.drag; NS.drag = null; northSet(false); const dx = d.b.x - d.a.x, dy = d.b.y - d.a.y, t = northTl(); app.snapshot();
    if (Math.hypot(dx, dy) * app.scale() < 25) { delete t.north; delete t.northAt; app.save(); app.redraw(); toast('🧭 Sjever maknut.'); return; }
    const th = ((TR.geoM() || {}).theta || 0) * 180 / Math.PI, phi = Math.atan2(dx, -dy) * 180 / Math.PI; let n = Math.round(((phi - th) % 360 + 360) % 360); if (n >= 359.5) n = 0;
    t.north = n; t.northAt = { x: Math.round(d.a.x * 10) / 10, y: Math.round(d.a.y * 10) / 10 }; app.save(); T.sig = ''; app.redraw(); toast('🧭 Sjever: ' + n + '° (od „gore” tlocrta, u smjeru kazaljke). Energetika iz toga računa strane svijeta pročelja i prozora.'); };
  window.addEventListener('pointermove', mv, true); window.addEventListener('pointerup', up, true); window.addEventListener('pointercancel', up, true); }
function northDraw(ctx, s) { const t = northTl(), th = (TR.geoM() || {}).theta || 0; let a = null, ang = null;
  if (NS.drag) { a = NS.drag.a; const dx = NS.drag.b.x - a.x, dy = NS.drag.b.y - a.y; if (Math.hypot(dx, dy) * s < 5) return; ang = Math.atan2(dx, -dy); }
  else if (t && t.north != null) { if (!app.visible('nacrt')) return; a = t.northAt; if (!a) { const it = app.items().flatMap(o => o.pts || []); if (!it.length) return; a = { x: Math.max(...it.map(q => q.x)) + 40 / s, y: Math.min(...it.map(q => q.y)) + 40 / s }; } ang = t.north * Math.PI / 180 + th; }
  else return;
  const L = 46 / s, ux = Math.sin(ang), uy = -Math.cos(ang), nx = -uy, ny = ux, tip = { x: a.x + ux * L, y: a.y + uy * L };
  ctx.save(); ctx.fillStyle = '#b91c1c'; ctx.strokeStyle = '#b91c1c'; ctx.lineWidth = 2 / s;
  ctx.beginPath(); ctx.moveTo(tip.x, tip.y); ctx.lineTo(a.x + nx * 9 / s - ux * 8 / s, a.y + ny * 9 / s - uy * 8 / s); ctx.lineTo(a.x, a.y); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(tip.x, tip.y); ctx.lineTo(a.x - nx * 9 / s - ux * 8 / s, a.y - ny * 9 / s - uy * 8 / s); ctx.lineTo(a.x, a.y); ctx.closePath(); ctx.stroke();
  ctx.font = '800 ' + (16 / s) + 'px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('S', tip.x + ux * 12 / s, tip.y + uy * 12 / s); ctx.restore(); }
/* ======================= v2.06: ➕ Ostalo (blokovi), ▭ Prostorija, 🔎 Provjera, veza kote ======================= */
const FRM = { mode: false, t: 'greda' }, RMR = { mode: false, drag: null }, PV = { on: false, list: [], sig: '' };
function offModes(except) { if (except !== 'fr' && FRM.mode) { FRM.mode = false; $('terenOstalo') && $('terenOstalo').classList.remove('active'); } if (except !== 'rm' && RMR.mode) { RMR.mode = false; $('terenProstorija') && $('terenProstorija').classList.remove('active'); }
  if (except) { if (ST.mode) { ST.mode = false; $('terenStube') && $('terenStube').classList.remove('active'); } if (ZB.mode) { ZB.mode = false; $('terenZub') && $('terenZub').classList.remove('active'); } if (T.blkMode || T.delMode || T.splitMode) { T.blkMode = null; T.delMode = false; T.splitMode = false; ['terenProzor', 'terenVrata', 'terenDel', 'terenSplit'].forEach(x => $(x) && $(x).classList.remove('active')); } } }
/* v2.26: brzi izbor za Ostalo (i Stubište) iznad trake */
(window.__ctxP = window.__ctxP || []).push(() => { try { const st = $('terenStube'), stOn = !!(st && st.classList.contains('active')); if (!FRM.mode && !stOn) return null; if (document.getElementById('frPop')) return { t: '', items: [] };
  const pickFr = k => { if (stOn) st.click(); offModes('fr'); FRM.mode = true; FRM.t = k; store.set('izmjera-fr-zadnji', k); $('terenOstalo') && $('terenOstalo').classList.add('active'); const sh = document.getElementById('frPop'); if (sh) sh.remove(); };
  return { t: 'Ostalo:', items: [{ l: 'Stubište', on: stOn, fn: () => { if (stOn) return; const sh = document.getElementById('frPop'); if (sh) sh.remove(); FRM.mode = false; $('terenOstalo') && $('terenOstalo').classList.remove('active'); st && st.click(); } }]
    .concat(Object.entries(FR_INFO).map(([k, [ic, n]]) => ({ l: n.split(' / ')[0], on: !stOn && FRM.t === k, fn: () => pickFr(k) })))
    .concat(!stOn && FRM.t === 'stup' ? (() => { let P = {}; try { P = JSON.parse(store.get('izmjera-fr-stup', '{}')); } catch (e) { } const f = P.f || 'kv', setF = v => { P.f = v; store.set('izmjera-fr-stup', JSON.stringify(P)); toast(v === 'ok' ? '◯ Okrugli stup Ø' + fmt(num(P.D) || 30, 0) + ' – mjere mijenjaš dodirom na stup.' : '▢ Četvrtasti stup ' + fmt(num(P.a) || 30, 0) + '/' + fmt(num(P.b) || 30, 0) + ' – mjere mijenjaš dodirom na stup.'); };
      return [{ l: '▢ Četvrtasti', on: f === 'kv', fn: () => setF('kv') }, { l: '◯ Okrugli', on: f === 'ok', fn: () => setF('ok') }]; })() : []) }; } catch (e) { return null; } });
/* v2.29: Ostalo – tamne pločice iznad gumba (umjesto velikog prozora) */
const FR_IC = {"st": "<path d=\"M3 20h4v-4h4v-4h4V8h4V4\"/>", "krovni": "<path d=\"M1 14L6 4l17 15\"/><path d=\"M11 8.4l7.8 6.9\" stroke-width=\"3\"/><path d=\"M11 8.4L9.4 20\"/><path d=\"M9.4 20q6-.3 9.4-4.7\" stroke-width=\"1.3\" stroke-dasharray=\"1.6 1.6\"/>", "otvorp": "<rect x=\"4\" y=\"4\" width=\"16\" height=\"16\" stroke-dasharray=\"3 2\"/><path d=\"M4 4l16 16M20 4L4 20\"/>", "terasa": "<path d=\"M4 4h16v8H4z\"/><path d=\"M4 12v8h16v-8\" stroke-dasharray=\"2.5 2\"/><path d=\"M6 20v-3M10 20v-3M14 20v-3M18 20v-3\" stroke-width=\"1.3\"/>", "greda": "<path d=\"M2 9h20M2 15h20\" stroke-dasharray=\"4 2.5\"/>", "stup": "<rect x=\"3\" y=\"7\" width=\"10\" height=\"10\"/><path d=\"M3 11l4-4M3 15l8-8M5 17l8-8M9 17l4-4\" stroke-width=\"1.3\"/><circle cx=\"18.5\" cy=\"12\" r=\"4\"/>", "prag": "<path d=\"M2 16h8v-5h12\"/>"}, frSv = d => '<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>';
function frChooser() { const old = document.getElementById('frPop'); if (old) old.remove(); const host = document.createElement('div'); host.id = 'frPop'; host.className = 'fr-pop';
  const items = ($('terenStube') ? [['st', 'Stubište']] : []).concat(Object.entries(FR_INFO).map(([k, v]) => [k, v[1].split(' / ')[0] === 'Terasa' ? 'Terasa / balkon' : v[1]]));
  host.innerHTML = items.map(([k, n]) => '<button type="button" data-t="' + k + '" class="' + (k === FRM.t ? 'on' : '') + '">' + frSv(FR_IC[k] || '') + '<span>' + n + '</span></button>').join('');
  if (!document.getElementById('frPopCss')) { const cs = document.createElement('style'); cs.id = 'frPopCss'; cs.textContent = '.fr-pop{position:fixed;z-index:70;background:#0f2a4a;border-radius:16px;padding:10px;display:grid;grid-template-columns:repeat(4,96px);gap:6px;box-shadow:0 10px 28px rgba(0,0,0,.3)}.fr-pop button{height:78px;border-radius:12px;border:0;background:rgba(255,255,255,.05);box-shadow:inset 0 0 0 1px #2b4a70;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;color:#fff;font:700 11.5px Arial;text-align:center;padding:2px 4px;line-height:1.15}.fr-pop button svg{color:#4ade80;flex:none}.fr-pop button.on{box-shadow:inset 0 0 0 2px #4ade80;background:#17457f}'; document.head.appendChild(cs); }
  document.body.appendChild(host); const qb = [...document.querySelectorAll('#ui2Quick button')].find(b => /^Ostalo/.test(b.title)) || $('terenOstalo'), r = qb ? qb.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight - 80, width: 0 };
  const w = host.offsetWidth, h = host.offsetHeight; host.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + 'px'; host.style.top = Math.max(8, r.top - h - 10) + 'px';
  const t0 = Date.now(), close = ev => { if (Date.now() - t0 < 400 || host.contains(ev.target)) return; document.removeEventListener('pointerdown', close, true); host.remove(); }; setTimeout(() => document.addEventListener('pointerdown', close, true), 50);
  host.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { const k = b.dataset.t; document.removeEventListener('pointerdown', close, true); host.remove();
    if (k === 'st') { FRM.mode = false; $('terenOstalo') && $('terenOstalo').classList.remove('active'); const st = $('terenStube'); if (st && !st.classList.contains('active')) st.click(); return; }
    FRM.t = k; store.set('izmjera-fr-zadnji', FRM.t); toast(FRM.t === 'greda' ? '▬ Greda: povuci olovkom od kraja do kraja, kao zid (hvata se za zidove, stupove i grede). Ponovno Ostalo za kraj.' : FRM.t === 'stup' ? '▣ Stup: dodiruj gdje idu stupovi – uz zid se zalijepi, na gredi ide na sredinu grede. Oblik biraš gore (Četvrtasti / Okrugli).' : FR_INFO[FRM.t][1] + ': dodirni skicu gdje ide' + (/prag/.test(FRM.t) ? ' (ili povuci olovkom od kraja do kraja)' : '') + '. Ponovno Ostalo za kraj.'); }); }
function dragStart(p, e, done) { const cv = $('canvas'), pid = e.pointerId; let b = p;
  const mv = ev => { if (ev.pointerId !== pid) return; const r = cv.getBoundingClientRect(); b = app.world({ x: ev.clientX - r.left, y: ev.clientY - r.top }); RMR.drag = { a: p, b, kind: RMR.mode ? 'rm' : 'fr' }; app.redraw(); };
  const up = ev => { if (ev.pointerId !== pid) return; window.removeEventListener('pointermove', mv, true); window.removeEventListener('pointerup', up, true); window.removeEventListener('pointercancel', up, true); RMR.drag = null; if (ev.type === 'pointerup') done(p, b); app.redraw(); };
  window.addEventListener('pointermove', mv, true); window.addEventListener('pointerup', up, true); window.addEventListener('pointercancel', up, true); }
/* ▭ Prostorija: pravokutnik → 4 ravna zida, krajevi uhvaćeni na postojeće zidove; strana koja već postoji kao zid se ne crta dvaput */
/* v2.61: Prostorija se ravna po zakretu skice samo ako ga stvarno nose zidovi – jedan kosi zid (ili prvi nacrtani) više ne zakreće pravokutnike */
function roomTheta(m) { const th = m ? m.theta || 0 : 0; if (Math.abs(th) < 0.2 * Math.PI / 180) return th; let sT = 0, s0 = 0, nT = 0;
  for (const o of app.items()) { if (o.layer !== 'nacrt' || o.blk || !Array.isArray(o.pts) || o.pts.length < 2) continue; for (let k = 1; k < o.pts.length; k++) { const p = o.pts[k - 1], q = o.pts[k], L = Math.hypot(q.x - p.x, q.y - p.y); if (!L) continue; const a = Math.atan2(q.y - p.y, q.x - p.x), dev = t => { let d = ((a - t) % (Math.PI / 2) + Math.PI / 2) % (Math.PI / 2); return Math.min(d, Math.PI / 2 - d); }; if (dev(th) < 3 * Math.PI / 180) { sT += L; nT++; } if (dev(0) < 3 * Math.PI / 180) s0 += L; } }
  return nT >= 3 && sT > 2 * s0 ? th : 0; }
function roomRect(a, b) { if (curLayer() !== 'nacrt') { toast('▭ Prostorija se crta u sloju Nacrt.'); return; } if (Math.hypot(b.x - a.x, b.y - a.y) * app.scale() < 30) { toast('▭ Povuci pravokutnik od jednog kuta prostorije do suprotnog.'); return; }
  let m = null; try { TR.analyzeNow(true); m = T.m; } catch (e) { } const th = roomTheta(m), A = C.rotP(a, -th), Bq = C.rotP(b, -th); let x0 = Math.min(A.x, Bq.x), x1 = Math.max(A.x, Bq.x), y0 = Math.min(A.y, Bq.y), y1 = Math.max(A.y, Bq.y);
  const tol = 22 / app.scale(), walls = m ? m.walls.filter(w => !w.view && !w.obj) : [];
  const snapV = (x, ya, yb) => { let best = x, bd = tol; for (const w of walls) if (w.o === 'V' && w.e1 > ya - tol && w.e0 < yb + tol) { const d = Math.abs(w.c - x); if (d < bd) { bd = d; best = w.c; } } return best; };
  const snapH = (y, xa, xb) => { let best = y, bd = tol; for (const w of walls) if (w.o === 'H' && w.e1 > xa - tol && w.e0 < xb + tol) { const d = Math.abs(w.c - y); if (d < bd) { bd = d; best = w.c; } } return best; };
  x0 = snapV(x0, y0, y1); x1 = snapV(x1, y0, y1); y0 = snapH(y0, x0, x1); y1 = snapH(y1, x0, x1);
  const covered = (o, c, s0, s1) => walls.some(w => w.o === o && Math.abs(w.c - c) < 0.6 * (m ? m.E : 5) && w.e0 <= s0 + tol && w.e1 >= s1 - tol);
  const last = app.items().slice().reverse().find(o => o.layer === 'nacrt' && (o.type === 'line' || o.type === 'pen') && !o.blk), col = last ? last.color : '#000000', wd = last && last.width ? last.width : 3;
  const sides = [['H', y0, x0, x1, [{ x: x0, y: y0 }, { x: x1, y: y0 }]], ['V', x1, y0, y1, [{ x: x1, y: y0 }, { x: x1, y: y1 }]], ['H', y1, x0, x1, [{ x: x1, y: y1 }, { x: x0, y: y1 }]], ['V', x0, y0, y1, [{ x: x0, y: y1 }, { x: x0, y: y0 }]]];
  app.snapshot(); let n = 0; for (const [o, c, s0, s1, pts] of sides) { if (covered(o, c, s0, s1)) continue; app.items().push({ type: 'line', layer: 'nacrt', color: col, width: wd, pts: pts.map(q => { const w = C.rotP(q, th); return { x: Math.round(w.x * 10) / 10, y: Math.round(w.y * 10) / 10 }; }) }); n++; }
  app.save(); T.sig = ''; T.mGeo = null; app.redraw(); toast('▭ Prostorija: ' + n + ' nova zida' + (n < 4 ? ' (' + (4 - n) + ' već postoje)' : '') + '. Mjere upiši u Mjeri ili Tipkaj.'); }
/* 🔎 Provjera crteža: rupe na kraju zida, dvije crte preblizu, kote koje ne diraju ništa */
/* v2.28: prozor/vrata (njihov okvir su dvije crte) i nacrtani zub nisu „dvije crte jedna uz drugu” */
function pvSkip(x, y) { try { const P0 = raw({ x, y }), E = T.m.E, sc = scaleNow() || 1; for (const o of app.items()) { if (o.blk && o.blk.main && o.blk.c) { const B = o.blk, hw = (TR.blkWd ? TR.blkWd(B, B.s || sc) : 40) / 2 + E; if (Math.hypot(P0.x - B.c.x, P0.y - B.c.y) < Math.max(hw, 2 * E)) return true; }
    if (o.zub && Array.isArray(o.pts) && o.pts.length) { let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; for (const q of o.pts) { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); } if (P0.x > x0 - 1.5 * E && P0.x < x1 + 1.5 * E && P0.y > y0 - 1.5 * E && P0.y < y1 + 1.5 * E) return true; } } } catch (e) { } return false; }
function pvCompute() { TR.analyzeNow(true); const m = T.m; PV.list = []; if (!m) return; const E = m.E, sc = scaleNow() > 0 ? scaleNow() : 0, W = m.walls.filter(w => !w.view && !w.obj), add = (x, y, t) => { if (!PV.list.some(q => Math.hypot(q.a.x - x, q.a.y - y) < 2 * E)) PV.list.push({ a: { x, y }, p: raw({ x, y }), t }); };
  for (const w of W) { const sg = (w.line && w.line.segs) || []; if (!sg.length) continue; const r0 = Math.min(...sg.map(q => q.a0)), r1 = Math.max(...sg.map(q => q.a1));
    /* kraj zida: nacrtana crta ne dolazi do zida – program ju je sam produžio (ili ostaje slobodna uz drugi zid) */
    for (const [e, rr, sg0] of [[w.e0, r0, -1], [w.e1, r1, 1]]) { const gap = (e - rr) * sg0; /* v2.28: samo kad je program crtu stvarno PRODUŽIO (ne kad crta malo prelazi zid) */ if (gap > 1.2 * E && gap < Math.min(0.3 * m.D, 12 * E)) add(w.o === 'H' ? rr : w.c, w.o === 'H' ? w.c : rr, '○ Crta zida ne dolazi do zida – program ju je produžio za ≈ ' + (sc ? Math.round(gap * sc) + ' cm' : 'malo') + '. Produži crtu do zida da DXF sigurno spoji kako treba.'); }
    /* dvije crte jedna uz drugu spojene u jedan zid */
    for (let i = 0; i < sg.length; i++) for (let j = i + 1; j < sg.length; j++) { const A = sg[i], B = sg[j], dc = Math.abs(A.c - B.c), ov = Math.min(A.a1, B.a1) - Math.max(A.a0, B.a0); if (dc > 0.3 * E && ov > 1.5 * E) { const u = (Math.max(A.a0, B.a0) + Math.min(A.a1, B.a1)) / 2; if (pvSkip(w.o === 'H' ? u : w.c, w.o === 'H' ? w.c : u)) continue; add(w.o === 'H' ? u : w.c, w.o === 'H' ? w.c : u, '═ Dvije crte jako blizu (' + (sc ? Math.round(dc * sc) + ' cm' : '') + ' razmaka) – program ih je spojio u jedan zid. Ako je to jedan zid, obriši višak; ako su dva lica zida, nacrtaj samo jedno.'); } } }
  /* slobodan kraj blizu drugog zida (nije produžen) */
  for (const w of W) for (const e of [w.e0, w.e1]) { let joined = false, near = Infinity;
    for (const q of W) { if (q === w) continue; if (q.o !== w.o) { const dc = Math.abs(q.c - e), inR = w.c >= q.e0 - 1.2 * E && w.c <= q.e1 + 1.2 * E; if (dc < 1.2 * E && inR) joined = true; else if (inR) near = Math.min(near, dc); } else if (Math.abs(q.c - w.c) < 0.8 * E && (Math.abs(q.e0 - e) < 1.5 * E || Math.abs(q.e1 - e) < 1.5 * E)) joined = true; }
    if (!joined && near < 6 * E) add(w.o === 'H' ? e : w.c, w.o === 'H' ? w.c : e, '○ Kraj zida stoji slobodno ' + (sc ? '≈ ' + Math.round(near * sc) + ' cm ' : '') + 'od drugog zida – ako ga treba dirati, produži crtu.'); }
  try { for (const n of (T.B && T.B.notes) || []) { const l = n.label; if (!l || n.kind !== 'kota' || !/ne vidim|ne dodiruje|nije pridružena|nema otvora/.test(n.text)) continue; add(l.cx, l.cy, '✎ ' + n.text); } } catch (e) { }
  PV.sig = T.sig; }
function pvToggle() { PV.on = !PV.on; $('terenProvjera') && $('terenProvjera').classList.toggle('active', PV.on); if (PV.on) { pvCompute(); toast(PV.list.length ? '🔎 ' + PV.list.length + ' mjesta za provjeru (crveni krugovi). Dodirni krug za objašnjenje.' : '🔎 Crtež izgleda u redu – nema rupa, dvostrukih crta ni kota u zraku.'); } app.redraw(); }
function pvDraw(ctx, s) { if (!PV.on) return; if (PV.sig !== T.sig) pvCompute(); ctx.save(); ctx.lineWidth = 3 / s; ctx.strokeStyle = '#dc2626'; ctx.fillStyle = 'rgba(220,38,38,.14)'; ctx.font = '800 ' + (12 / s) + 'px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  PV.list.forEach((q, i) => { ctx.beginPath(); ctx.arc(q.p.x, q.p.y, 16 / s, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#dc2626'; ctx.fillText(String(i + 1), q.p.x, q.p.y - 24 / s); ctx.fillStyle = 'rgba(220,38,38,.14)'; }); ctx.restore(); }
function pvHit(p) { if (!PV.on) return null; const r = 22 / app.scale(); return PV.list.find(q => Math.hypot(q.p.x - p.x, q.p.y - p.y) < r) || null; }
/* veza kote: dok je otvoren upis postojeće kote, zelena crta pokazuje od čega do čega je program mjeri */
function kotaBind(ctx, s) { const eo = window.__editKota; if (!eo || !$('typedBox') || !T.m) return; const m = T.m, th = m.theta || 0, fk = (eo.fs || 18) / 18, cx = eo.x + String(eo.text).length * 5 * fk, cy = eo.y - 7 * fk, a = C.rotP({ x: cx, y: cy }, -th);
  const l = m.labels.find(q => q.text === eo.text && Math.hypot(q.cx - a.x, q.cy - a.y) < 4 * m.E); if (!l) return; const sp = l.span; let A = null, Bq = null, msg = '';
  if (sp && sp.facade) { const f = sp.facade; A = f.o === 'H' ? { x: f.e0, y: f.c } : { x: f.c, y: f.e0 }; Bq = f.o === 'H' ? { x: f.e1, y: f.c } : { x: f.c, y: f.e1 }; msg = 'vanjska mjera pročelja'; }
  else if (sp && sp.ax && sp.i != null && sp.j != null) { const bo = sp.dir === 'H' ? 'V' : 'H', v = sp.v != null ? sp.v : (bo === 'V' ? l.cy : l.cx), pick = id => m.walls.filter(w => w.o === bo && w.lineAxis === id).sort((p, q) => (Math.abs(v - (p.e0 + p.e1) / 2) - Math.abs(v - (q.e0 + q.e1) / 2)))[0], wi = pick(sp.i), wj = pick(sp.j);
    if (wi && wj) { A = bo === 'V' ? { x: wi.c, y: v } : { x: v, y: wi.c }; Bq = bo === 'V' ? { x: wj.c, y: v } : { x: v, y: wj.c }; msg = 'od zida do zida' + (wi.view || wj.view ? ' (uključuje crtu Pogleda)' : ''); } }
  ctx.save(); ctx.font = '700 ' + (13 / s) + 'px Arial'; ctx.textAlign = 'center';
  if (!A) { ctx.fillStyle = '#dc2626'; const q = raw({ x: l.cx, y: l.cy }); ctx.fillText('⚠ kota nije vezana ni za što', q.x, q.y - 22 / s); ctx.restore(); return; }
  const P1 = raw(A), P2 = raw(Bq); ctx.strokeStyle = '#16a34a'; ctx.globalAlpha = .85; ctx.lineWidth = 6 / s; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(P1.x, P1.y); ctx.lineTo(P2.x, P2.y); ctx.stroke();
  for (const P of [P1, P2]) { ctx.beginPath(); ctx.arc(P.x, P.y, 7 / s, 0, Math.PI * 2); ctx.fillStyle = '#16a34a'; ctx.fill(); }
  ctx.globalAlpha = 1; ctx.fillStyle = '#166534'; ctx.fillText('🔗 ' + msg, (P1.x + P2.x) / 2, (P1.y + P2.y) / 2 - 12 / s); ctx.restore(); }
function freeDragDraw(ctx, s) { const d = RMR.drag; if (!d) return; ctx.save(); ctx.strokeStyle = d.kind === 'rm' ? '#2563eb' : '#16a34a'; ctx.lineWidth = 2.5 / s; ctx.setLineDash([8 / s, 6 / s]);
  if (d.kind === 'rm') { const th = (T.m && T.m.theta) || 0, A = C.rotP(d.a, -th), B = C.rotP(d.b, -th), q = [{ x: A.x, y: A.y }, { x: B.x, y: A.y }, { x: B.x, y: B.y }, { x: A.x, y: B.y }].map(z => C.rotP(z, th)); ctx.beginPath(); q.forEach((z, i) => i ? ctx.lineTo(z.x, z.y) : ctx.moveTo(z.x, z.y)); ctx.closePath(); ctx.stroke(); }
  else { ctx.beginPath(); ctx.moveTo(d.a.x, d.a.y); ctx.lineTo(d.b.x, d.b.y); ctx.stroke(); } ctx.restore(); }
/* ======================= dodir i crtanje ======================= */
app.hooks.tap.unshift((p, e) => {
  if (NS.mode && e) { northStart(p, e); return true; }
  if (e && e.pointerType === 'touch' && !RMR.mode && !FRM.mode && !ST.mode && !T.blkMode && !T.delMode && !T.splitMode && NISL.length) { const n = nisLblHit(p); if (n) return TR.fingerTap(p, e, () => nisEdit(n)); }
  if (PV.on && e) { const q = pvHit(p); if (q) { toast('🔎 ' + (PV.list.indexOf(q) + 1) + ': ' + q.t); return true; } }
  if (RMR.mode && e) { if (e.pointerType === 'touch') return false; /* v2.38: prsti samo pomiču i zumiraju, prostoriju crta olovka */ dragStart(p, e, roomRect); return true; }
  if (FRM.mode && e) { let k = frHit(p); const kt = k && stMain(k) ? stMain(k).blk.t : ''; if (FRM.t === 'stup' && kt === 'greda') k = null; /* v2.49: stup na gredu */
    if (k && FRM.t === 'greda' && (kt === 'stup' || kt === 'greda')) { /* v2.49: nova greda smije krenuti sa stupa/grede; kratki dodir = izbornik */ const k0 = k; if (e.pointerType === 'touch') return TR.fingerTap(p, e, () => stMenu(k0)); dragStart(p, e, (a, b) => { if (Math.hypot(b.x - a.x, b.y - a.y) * app.scale() < 25) stMenu(k0); else frPlace('greda', a, b); }); return true; }
    if (k) { stMoveStart(p, k, e); return true; } if (FRM.t === 'terasa') { if (e.pointerType === 'touch') return TR.fingerTap(p, e, () => terPlace(p)); terPlace(p); return true; } if (e.pointerType === 'touch') return TR.fingerTap(p, e, () => frPlace(FRM.t, p)); if (FRM.t === 'stup') { stupPlace(p); return true; } dragStart(p, e, (a, b) => frPlace(FRM.t, a, b)); return true; }
  if (ZB.mode) { if (e && e.pointerType === 'touch') return TR.fingerTap(p, e, () => zubTap(p)); zubTap(p); return true; }
  if (T.blkMode === 'prozor' && e) { const k = krHit(p); if (k) { stMoveStart(p, k, e); return true; } } /* krovni prozor: dodir = postavke, povlačenje = pomak */
  if (ST.mode) { const h0 = stHit(p); if (h0 && e) { stMoveStart(p, h0, e); return true; } /* dodir = postavke, povlačenje = pomakni cijelo stubište */ if (e && e.pointerType === 'touch') return TR.fingerTap(p, e, () => stTap(p)); const h = stHit(p); if (h) { stMenu(h); return true; } if (curLayer() !== 'nacrt') { toast('🪜 Stubište se postavlja u sloju Nacrt (gumb Nacrt).'); return true; } stDragStart(p); return true; }
  if (V.on && V.pick && T.m) { const a = C.rotP(p, -(T.m.theta || 0)), r = (V.P ? V.P.rooms : roomsOf()).find(x => x.has(a)); if (!r) return false; if (e && e.pointerType === 'touch') return TR.fingerTap(p, e, () => pickRoom(r.key)); pickRoom(r.key); return true; }
  return false;
});
function fillRoom(ctx, r) { ctx.beginPath(); for (const [x0, y0, x1, y1] of r.rects) { const a = raw({ x: x0, y: y0 }), b = raw({ x: x1, y: y0 }), c = raw({ x: x1, y: y1 }), d = raw({ x: x0, y: y1 }); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath(); } ctx.fill(); }
/* izmjerene mjere izbočenja / niše na skici (širina × dubina) */
/* v2.38: ispravak upisanih mjera izbočenja/niše – dodir prstom na narančastu oznaku (▨ 97×52) ili alat Zub/niša pa dodir na plohu */
function nisAt(p, tol) { const B = T.B, m = T.m; if (!B || !B.nis || !m) return null; const a = C.rotP(p, -(m.theta || 0)), E = tol != null ? tol : m.E;
  return B.nis.find(n => { const c0 = Math.min(n.cW, n.nc != null ? n.nc : n.cW) - E, c1 = Math.max(n.cW, n.nc != null ? n.nc : n.cW) + E, u = n.o === 'H' ? a.x : a.y, v = n.o === 'H' ? a.y : a.x; return u >= n.s0 - E && u <= n.s1 + E && v >= c0 && v <= c1; }) || null; }
function nisLblHit(p) { const r = 26 / app.scale(); return (NISL.find(h => Math.hypot(h.p.x - p.x, h.p.y - p.y) < r) || {}).n || null; }
const NISL = [];
function nisEdit(n) { const S = TR.tl(app.currentFloor()), cur = Object.assign({}, S.niches[n.key] || {}), izb = n.kind === 'zadebljanje', u = (n.s0 + n.s1) / 2, nc = n.nc != null ? n.nc : n.cW + 1;
  const horW = scrHor(n.o === 'H' ? { x: n.s0, y: n.cW } : { x: n.cW, y: n.s0 }, n.o === 'H' ? { x: n.s1, y: n.cW } : { x: n.cW, y: n.s1 }), lw = izb ? 'Stranica ' + (horW ? 'lijevo–desno' : 'gore–dolje') + ' (cm)' : 'Širina uz zid (cm)', ld = izb ? 'Stranica ' + (horW ? 'gore–dolje' : 'lijevo–desno') + ' (cm)' : 'Dubina (cm)';
  const d = sheet('<div class="tp-head"><b style="flex:1">' + (izb ? '▨ Mjere izbočenja' : '⊔ Mjere niše') + '</b><button data-a="ok" class="primary">✓ Spremi</button><button data-a="x">✕</button></div>' +
    '<div class="tp-row" style="align-items:flex-end"><label style="flex:1">' + lw + '<input data-n="w" inputmode="decimal" value="' + (n.w > 0 ? fmt(n.w) : (cur.w > 0 ? fmt(cur.w) : '')) + '"></label><label style="flex:1">' + ld + '<input data-n="d" inputmode="decimal" value="' + (n.d > 0 ? fmt(n.d) : (cur.d > 0 && !cur.est ? fmt(cur.d) : '')) + '"></label></div>' +
    '<div class="tp-note">Upiši ispravljene mjere. Prazno polje = mjera nije upisana, pa će je Mjeri ponovno pitati.</div>');
  d.querySelector('[data-a="x"]').onclick = () => d.remove();
  d.querySelector('[data-a="ok"]').onclick = () => { app.snapshot(); const o = Object.assign({}, S.niches[n.key] || {}); delete o.est; for (const k of ['w', 'd']) { const v = num(d.querySelector('[data-n="' + k + '"]').value); if (v > 0) o[k] = v; else delete o[k]; } if (Object.keys(o).length) S.niches[n.key] = o; else delete S.niches[n.key]; app.save(); T.sig = ''; T.mGeo = null; TR.analyzeNow(true); app.redraw(); d.remove(); toast((izb ? '▨ Izbočenje ' : '⊔ Niša ') + (o.w > 0 ? fmt(o.w) : '?') + '×' + (o.d > 0 ? fmt(o.d) : '?')); if (V.on) step(true); }; }
function nisLabels(ctx) { NISL.length = 0; const B = T.B, m = T.m; if (!B || !B.nis || !m || !app.visible('kote')) return; ctx.save(); ctx.fillStyle = '#ea580c'; ctx.font = '15px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const n of B.nis) { if (!(n.w > 0) && !(n.d > 0)) continue; const u = n.center != null ? n.center : (n.s0 + n.s1) / 2, sg = Math.sign((n.nc != null ? n.nc : n.cW) - n.cW) || 1, dir = (n.kind === 'zadebljanje' ? 1 : -1) * sg, v = (n.kind === 'zadebljanje' && n.nc != null ? n.nc : n.cW) + dir * 16, p = raw(n.o === 'H' ? { x: u, y: v } : { x: v, y: u }); /* uz izbočenje/nišu, na strani prostorije */
    const t = (n.kind === 'zadebljanje' ? '▨ ' : '⊔ ') + (n.w > 0 ? fmt(n.w) : '?') + '×' + (n.d > 0 ? fmt(n.d) : '?'); const w = ctx.measureText(t).width + 8;
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(p.x - w / 2, p.y - 10, w, 20); ctx.fillStyle = '#ea580c'; ctx.fillText(t, p.x, p.y + 1); NISL.push({ p, n }); }
  const box = (t, p) => { const w = ctx.measureText(t).width + 8; ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.fillRect(p.x - w / 2, p.y - 10, w, 20); ctx.fillStyle = '#ea580c'; ctx.fillText(t, p.x, p.y + 1); };
  for (const c of B.cols || []) { const b = c.bb, E = m.E; /* samostojeći stup: veličina i udaljenosti od zidova */
    if (c.w > 0 || c.h > 0) box('▨ ' + (c.w > 0 ? fmt(c.w) : '?') + '×' + (c.h > 0 ? fmt(c.h) : '?'), raw({ x: (b.x0 + b.x1) / 2, y: b.y1 + 2.2 * E }));
    for (const ax of ['X', 'Y']) { const ps = c.pos[ax]; if (!ps || !ps.w || !ps.vod) continue; const wc = ps.w.c, e = ps.dir > 0 ? (ax === 'X' ? b.x0 : b.y0) : (ax === 'X' ? b.x1 : b.y1), mid = (wc + e) / 2;
      const a = raw(ax === 'X' ? { x: wc, y: (b.y0 + b.y1) / 2 } : { x: (b.x0 + b.x1) / 2, y: wc }), z = raw(ax === 'X' ? { x: e, y: (b.y0 + b.y1) / 2 } : { x: (b.x0 + b.x1) / 2, y: e });
      ctx.save(); ctx.strokeStyle = '#ea580c'; ctx.lineWidth = 1.2; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(z.x, z.y); ctx.stroke(); ctx.restore();
      box(fmt(ps.value), raw(ax === 'X' ? { x: mid, y: (b.y0 + b.y1) / 2 - 1.6 * E } : { x: (b.x0 + b.x1) / 2 + 2.4 * E, y: mid })); } }
  ctx.restore(); }
/* v2.26: koliko je još za izmjeriti (za gornju traku) i neizmjereno na crtežu – narančasti iscrtkani trag (samo na ekranu, ne u DXF/PDF) */
const NZ = { sig: '', n: -1, tg: [], busy: false }; let nzOn = false; /* v2.27: narančasti trag isključen (zbunjuje) – ostaje samo broj „još N” */
function nzUpd() { try { if (NZ.busy || !T.sig || NZ.sig === T.sig || !document.documentElement.classList.contains('ui2-draw')) return; NZ.busy = true; const sv = { room: V.room, pick: V.pick, q: V.q, c3: V.c3 };
    const P = V.on && V.P ? V.P : plan(); if (!V.on) Object.assign(V, sv); const all = P.rest.concat(...P.per.values()); NZ.n = all.length; NZ.tg = []; for (const q of all) { try { const t = targetOf(q); if (t) NZ.tg.push(t); } catch (e) { } } NZ.sig = T.sig; app.redraw(); } catch (e) { NZ.n = -1; } finally { NZ.busy = false; } }
setInterval(nzUpd, 2500);
function nzDraw(ctx, s) { if (!nzOn || V.on || !NZ.tg.length || !app.visible('nacrt')) return; ctx.save(); ctx.strokeStyle = 'rgba(234,88,12,.32)'; ctx.fillStyle = 'rgba(234,88,12,.3)'; ctx.lineWidth = 3 / s; ctx.setLineDash([7 / s, 7 / s]); ctx.lineCap = 'round';
  for (const t of NZ.tg) { if (t.kind === 'dim' && t.a && t.b) { ctx.beginPath(); ctx.moveTo(t.a.x, t.a.y); ctx.lineTo(t.b.x, t.b.y); ctx.stroke(); } else if (t.wall && t.wall.length === 2) { ctx.beginPath(); ctx.moveTo(t.wall[0].x, t.wall[0].y); ctx.lineTo(t.wall[1].x, t.wall[1].y); ctx.stroke(); } else if (t.p) { ctx.beginPath(); ctx.arc(t.p.x, t.p.y, 4 / s, 0, Math.PI * 2); ctx.fill(); } }
  ctx.restore(); }
app.hooks.draw.push((ctx, s) => {
  try { nzDraw(ctx, s); } catch (e) { }
  try { nisLabels(ctx); } catch (e) { }
  try { northDraw(ctx, s); } catch (e) { }
  try { pvDraw(ctx, s); kotaBind(ctx, s); freeDragDraw(ctx, s); } catch (e) { }
  if (app.visible('nacrt')) for (const g of zubGroups()) { let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; for (const o of g.its) for (const q of o.pts) { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }
    ctx.save(); ctx.strokeStyle = g.k === 'izb' ? 'rgba(71,85,105,.55)' : 'rgba(37,99,235,.5)'; ctx.lineWidth = 1.2 / s;
    if (g.k === 'izb') { ctx.beginPath(); ctx.rect(x0, y0, x1 - x0, y1 - y0); ctx.clip(); ctx.beginPath(); const st = 7 / s; for (let t = x0 - (y1 - y0); t < x1; t += st) { ctx.moveTo(t, y1); ctx.lineTo(t + (y1 - y0), y0); } ctx.stroke(); }
    else { ctx.fillStyle = 'rgba(37,99,235,.7)'; ctx.font = '700 ' + (11 / s) + 'px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('niša', (x0 + x1) / 2, (y0 + y1) / 2); }
    ctx.restore(); }
  if (V.on && T.m && V.P) { ctx.save();
    if (V.pick) { const t = (Date.now() % 1400) / 1400; ctx.font = '800 ' + (15 / s) + 'px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const r of V.P.rooms) { const n = (V.P.per.get(r.key) || []).length, sug = r.key === V.sug; ctx.fillStyle = n ? (sug ? 'rgba(249,115,22,' + (0.16 + 0.14 * Math.sin(t * 6.283)) + ')' : 'rgba(249,115,22,.08)') : 'rgba(21,128,61,.10)'; fillRoom(ctx, r);
        const c = raw(r.c), txt = n ? String(n) : '✓', w = Math.max(28, ctx.measureText(txt).width * s + 16) / s; ctx.fillStyle = n ? (sug ? '#f97316' : '#fdba74') : '#15803d'; ctx.beginPath(); ctx.arc(c.x, c.y, w / 2, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillText(txt, c.x, c.y + 1 / s); } }
    else if (V.room && V.room.rects) { ctx.fillStyle = 'rgba(249,115,22,.09)'; fillRoom(ctx, V.room); }
    const tw = V.target && V.target.wall; if (tw) { ctx.strokeStyle = '#f97316'; ctx.lineWidth = 7 / s; ctx.globalAlpha = 0.55; ctx.beginPath(); ctx.moveTo(tw[0].x, tw[0].y); ctx.lineTo(tw[1].x, tw[1].y); ctx.stroke(); }
    ctx.restore(); }
  // natpis uz stubište (broj visina, gazište)
  if (app.visible('nacrt')) { ctx.save(); ctx.font = '700 ' + (11 / s) + 'px Arial'; ctx.fillStyle = GREEN; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const o of app.items()) { if (!(o.blk && o.blk.main && o.blk.t === 'stube')) continue; const B = o.blk, G = C.stairGeo(B.P); if (!G.txtAt) continue; const M = stMap(visB(B), B.s || 3), q = M({ u: G.txtAt.u, v: G.txtAt.v + 14 }); ctx.fillText(G.text, q.x, q.y); }
    ctx.font = '700 ' + (10 / s) + 'px Arial'; for (const o of app.items()) { if (!(o.blk && o.blk.main && isFree(o.blk.t))) continue; const B = o.blk, G = frGeo(B.t, B.P); if (!G.text) continue; const q = stMap(visB(B), B.s || 3)({ u: 0, v: B.t === 'prag' ? -14 : 0 }); ctx.fillText(G.text, q.x, q.y); }
    ctx.restore(); }
  if (ST.drag && ST.drag.pts.length > 1) { const a = ST.drag.pts[0], b = ST.drag.pts.at(-1); ctx.save(); ctx.strokeStyle = GREEN; ctx.lineWidth = 3 / s; ctx.setLineDash([8 / s, 5 / s]); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.restore(); }
  // vođeno mjerenje: što se sada mjeri
  const tg = V.on && V.target; if (tg) { ctx.save(); const t = (Date.now() % 1200) / 1200;
    if (tg.segs && tg.segs.length) { ctx.strokeStyle = 'rgba(249,115,22,.45)'; ctx.lineWidth = 9 / s; ctx.lineCap = 'round'; ctx.beginPath(); for (const [p0, p1] of tg.segs) { ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); } ctx.stroke(); ctx.lineCap = 'butt'; }
    if (tg.kind === 'dim') { const a = tg.a, b = tg.b, dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L * 9 / s, ny = dx / L * 9 / s;
      ctx.strokeStyle = '#f97316'; ctx.lineWidth = 4 / s; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.moveTo(a.x + nx, a.y + ny); ctx.lineTo(a.x - nx, a.y - ny); ctx.moveTo(b.x + nx, b.y + ny); ctx.lineTo(b.x - nx, b.y - ny); ctx.stroke(); }
    ctx.strokeStyle = '#f97316'; ctx.lineWidth = 3 / s; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(tg.p.x, tg.p.y, ((tg.r || 18) + 6 * t) / s, 0, 7); ctx.stroke();
    ctx.globalAlpha = 1; ctx.fillStyle = '#f97316'; ctx.font = '800 ' + (16 / s) + 'px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; const bx = tg.p.x, by = tg.p.y - ((tg.r || 18) + 18) / s, txt = V.val ? V.val + ' cm' : '?';
    const w = ctx.measureText(txt).width + 14 / s; ctx.fillRect(bx - w / 2, by - 12 / s, w, 24 / s); ctx.fillStyle = '#fff'; ctx.fillText(txt, bx, by + 1 / s); ctx.restore(); }
  // provjera uživo: kote koje se ne slažu
  if (!V.on && V.live && V.live.viol.length && app.visible('kote')) { ctx.save(); ctx.strokeStyle = '#dc2626'; /* v2.37: tanki puni krug – manje napadno, brojka se vidi */ ctx.setLineDash([]); ctx.lineWidth = 1.2 / s; ctx.globalAlpha = 0.55; for (const v of V.live.viol) { ctx.beginPath(); ctx.arc(v.p.x, v.p.y, 22 / s, 0, 7); ctx.stroke(); } ctx.globalAlpha = 1; ctx.restore(); }
});
setInterval(() => { if (V.on && (V.target || V.pick)) app.redraw(); }, 120);

/* ======================= 📋 OBRIS S DRUGE ETAŽE ======================= */
function copyOutline(si, mode) {
  const fs = app.floors(), src = fs[si]; if (!src) return; let m;
  try { m = C.analyze({ name: src.name, items: (src.items || []).filter(o => !(o.blk && /^(stube|krovni|otvorp|terasa|greda|prag|stup)$/.test(o.blk.t))), tlocrt: src.tlocrt }, { splits: (src.tlocrt && src.tlocrt.wallSplit) || [] }); } catch (e) { alert('Na etaži „' + src.name + '” nema zidova za kopiranje.'); return; }
  const R = p => { const q = C.rotP(p, m.theta); return { x: Math.round(q.x * 10) / 10, y: Math.round(q.y * 10) / 10 }; }, add = [];
  const f0 = app.currentFloor(); let tlCopy = false;
  if (mode === 'isto') { /* v2.76: „isto kao ta etaža” – nacrt, kote, nazivi i pogled na istim mjestima, s pročitanim kotama i debljinama zidova */
    const nid = {}, rid = id => nid[id] || (nid[id] = id + 'k' + Math.random().toString(36).slice(2, 6));
    for (const o of src.items || []) { if (!/^(nacrt|kote|opisi|pogled)$/.test(o.layer) || o.type === 'photo') continue; const c = JSON.parse(JSON.stringify(o)); if (c.blk && c.blk.id) c.blk.id = rid(c.blk.id); add.push(c); }
    tlCopy = !(f0.items || []).some(o => o.layer === 'nacrt' || o.layer === 'kote') && !!src.tlocrt; }
  else if (mode === 'sve') { const nid = {}; for (const o of src.items || []) if (o.layer === 'nacrt' && Array.isArray(o.pts)) { const c = JSON.parse(JSON.stringify(o)); if (c.blk && c.blk.id) { c.blk.id = nid[c.blk.id] || (nid[c.blk.id] = c.blk.id + 'k' + Math.random().toString(36).slice(2, 6)); } add.push(c); } /* v2.32: vrata/prozori dobiju nove oznake (ne dijele ih s donjom etažom) */ }
  else for (const w of m.walls) { if (w.view || w.obj || (mode === 'vanjski' && !w.exterior)) continue; const a = w.o === 'H' ? { x: w.e0, y: w.c } : { x: w.c, y: w.e0 }, b = w.o === 'H' ? { x: w.e1, y: w.c } : { x: w.c, y: w.e1 }; add.push({ type: 'line', layer: 'nacrt', color: '#000000', width: 2, pts: [R(a), R(b)] }); }
  if (!add.length) { alert('Nema zidova za kopiranje.'); return; }
  app.snapshot(); const it = app.items(); for (const o of add) it.push(o);
  const f = app.currentFloor(), sT = src.tlocrt || {}; if (mode !== 'sve' && sT.wallT && Object.keys(sT.wallT).length && !(f.tlocrt && f.tlocrt.wallT && Object.keys(f.tlocrt.wallT).length)) { /* debljine zidova ne prenosimo – ključevi ovise o skici */ }
  if (tlCopy) { const c = JSON.parse(JSON.stringify(src.tlocrt)); delete c.done; f0.tlocrt = c; }
  app.save(); T.sig = ''; T.mGeo = null; app.fit && app.fit(); app.redraw(); toast(mode === 'isto' ? '📋 Etaža je ista kao „' + src.name + '” – s kotama. Promijeni samo ono što je drugačije.' : '📋 Kopirano ' + add.length + ' crta s etaže „' + src.name + '”. Doradi unutarnje zidove.');
}
function outlineDialog() {
  const fs = app.floors(), ci = app.floorIndex(); const others = fs.map((f, i) => ({ f, i })).filter(x => x.i !== ci && (x.f.items || []).some(o => o.layer === 'nacrt'));
  if (!others.length) { alert('Nema druge etaže s nacrtom.'); return; }
  const d = sheet('<div class="tp-head"><b>📋 Kopiraj s druge etaže</b><button data-a="x">✕</button></div><div class="tp-note">Kopira zidove na ovu etažu („' + esc(fs[ci].name) + '”) kao početnu skicu.</div>' +
    '<div class="tp-lab">S etaže</div><div class="tp-row">' + others.map(x => '<button data-f="' + x.i + '">' + esc(x.f.name) + '</button>').join('') + '</div>' +
    '<div class="tp-lab">Što kopirati</div><div class="tp-row"><button data-m="vanjski" style="background:#17457f;color:#fff">Vanjski zidovi (obris)</button><button data-m="zidovi">Svi zidovi (ravno)</button><button data-m="sve">Cijeli nacrt (s prozorima i vratima)</button><button data-m="isto">Isto kao ta etaža (+ kote i nazivi)</button></div>');
  let sel = others[Math.max(0, others.findIndex(x => x.i === ci - 1))].i, mode = 'vanjski';
  const paint = () => { d.querySelectorAll('[data-f]').forEach(b => { const on = +b.dataset.f === sel; b.style.background = on ? '#0f766e' : ''; b.style.color = on ? '#fff' : ''; }); };
  paint(); d.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { sel = +b.dataset.f; paint(); });
  d.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { mode = b.dataset.m; d.remove(); copyOutline(sel, mode); });
  d.querySelector('[data-a="x"]').onclick = () => d.remove();
}
/* prazna etaža: ponudi kopiranje obrisa */
function emptyHint() { const f = app.currentFloor(), fs = app.floors(), empty = !(f.items || []).some(o => o.layer === 'nacrt'), other = fs.some(x => x !== f && (x.items || []).some(o => o.layer === 'nacrt'));
  let b = $('vdObrisHint'); if (empty && other && document.body.classList.contains('ui2')) { if (!b) { b = document.createElement('button'); b.id = 'vdObrisHint'; b.textContent = '📋 Kopiraj s druge etaže (obris ili isto s kotama)'; b.onclick = outlineDialog; ($('work') || document.body).appendChild(b); } b.hidden = false; } else if (b) b.hidden = true; }
setInterval(emptyHint, 1500);

/* ======================= nazivi i visine prostorija (dijalog Tekst) ======================= */
const NAZIVI = ['Kuhinja', 'Dnevni boravak', 'Blagovaonica', 'Soba', 'Spavaća soba', 'Dječja soba', 'Radna soba', 'Kupaonica', 'WC', 'Hodnik', 'Predsoblje', 'Ulaz', 'Ostava', 'Garderoba', 'Praonica', 'Stubište', 'Balkon', 'Lođa', 'Terasa', 'Garaža', 'Kotlovnica', 'Spremište', 'Podrum', 'Tavan', 'Vjetrobran', 'Poslovni prostor', 'Čajna kuhinja'];
/* v2.25: postojeći nazivi prostorija (crveni) → sivi */ setInterval(() => { try { if (!app || !app.items) return; const nm = new Set(NAZIVI.concat(Object.keys(nameCounts()))); let ch = 0; for (const t of app.items()) if (t && t.type === 'text' && t.layer === 'opisi' && /^#(f00|ff0000)$/i.test(t.color || '') && nm.has(String(t.text).trim())) { t.color = '#64748b'; ch++; } if (ch) { app.redraw(); app.save(); } } catch (e) { } }, 2000);
function nameCounts() { try { return JSON.parse(store.get('izmjera-nazivi', '{}')); } catch (e) { return {}; } }
function setupDialog() {
  const dlg = $('dialog'), inp = $('textvalue'), ok = $('confirm'); if (!dlg || !inp || !ok || $('vdNames')) return;
  const box = document.createElement('div'); box.id = 'vdNames'; inp.insertAdjacentElement('afterend', box);
  /* v2.65: tipkovnica prekriva dno prozora – ✓ odmah uz polje, Enter sprema, a prozor se smanji iznad tipkovnice i lista se pomiče */
  { const row = document.createElement('div'); row.id = 'vdTxRow'; row.style.cssText = 'display:flex;gap:8px;align-items:stretch'; inp.before(row); row.appendChild(inp); inp.style.flex = '1'; inp.style.minWidth = '0';
    const qb = document.createElement('button'); qb.type = 'button'; qb.id = 'vdTxOk'; qb.textContent = '✓ Spremi'; qb.style.cssText = 'flex:none;padding:0 16px;border-radius:10px;border:0;background:#1e40af;color:#fff;font:700 16px Arial;min-height:44px'; qb.addEventListener('pointerdown', e => e.preventDefault()); qb.onclick = () => ok.click(); row.appendChild(qb);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); ok.click(); } });
    const fit = () => { if (dlg.style.display === 'none') return; const vv = window.visualViewport, par = (dlg.offsetParent || document.body).getBoundingClientRect(), bot = Math.min(vv ? vv.height + vv.offsetTop : innerHeight, par.bottom); if (dlg.style.top !== '8px') dlg.style.top = '8px'; const r = dlg.getBoundingClientRect(), mh = Math.round(Math.max(150, bot - r.top - 10)) + 'px'; if (dlg.style.maxHeight !== mh) dlg.style.maxHeight = mh; if (dlg.style.overflowY !== 'auto') dlg.style.overflowY = 'auto'; };
    if (window.visualViewport) { visualViewport.addEventListener('resize', fit); visualViewport.addEventListener('scroll', fit); } inp.addEventListener('focus', () => { fit(); setTimeout(fit, 350); setTimeout(fit, 800); }); new MutationObserver(() => { if (dlg.style.display !== 'none') setTimeout(fit, 50); else if (dlg.style.top || dlg.style.maxHeight) { dlg.style.top = ''; dlg.style.maxHeight = ''; } }).observe(dlg, { attributes: true, attributeFilter: ['style'] }); }
  const hv = document.createElement('div'); hv.id = 'vdHrow'; hv.innerHTML = '<span>Sv. visina</span><input id="vdH" inputmode="decimal" placeholder="cm (neobavezno)">'; box.insertAdjacentElement('afterend', hv);
  const fill = () => { const c = nameCounts(), list = NAZIVI.slice().sort((a, b) => (c[b] || 0) - (c[a] || 0)); box.innerHTML = list.map(n => '<button type="button" data-n="' + esc(n) + '">' + esc(n) + '</button>').join(''); box.querySelectorAll('[data-n]').forEach(b => b.onclick = () => { inp.value = b.dataset.n; ok.click(); }); };
  let pend = null; const grab = () => { const lay = curLayer(), t = inp.value.trim(), h = num($('vdH').value); pend = lay === 'opisi' && t ? { t, h: h > 0 ? h : null, n: app.items().length } : null; };
  ok.addEventListener('pointerdown', grab, true); ok.addEventListener('click', () => { if (!pend) grab(); const P = pend; pend = null; $('vdH').value = ''; if (!P) return;
    const c = nameCounts(); c[P.t] = (c[P.t] || 0) + 1; store.set('izmjera-nazivi', JSON.stringify(c));
    setTimeout(() => { const it = app.items(), o = it[it.length - 1]; if (!P.h || !o || o.type !== 'text' || o.text !== P.t) return; const cx = o.x + String(o.text).length * 5, cy = o.y - 7; addTyped('h=' + fmt(P.h), { x: cx, y: cy + 26 }, 'H'); store.set('izmjera-zadnja-visina', String(P.h)); app.save(); app.redraw(); }, 0); }, true);
  const obs = new MutationObserver(() => { const vis = dlg.style.display !== 'none' && getComputedStyle(dlg).display !== 'none', op = curLayer() === 'opisi'; box.hidden = !op; hv.hidden = !op; if (vis && op && !box.dataset.f) { fill(); box.dataset.f = '1'; } if (!vis) box.dataset.f = ''; });
  obs.observe(dlg, { attributes: true, attributeFilter: ['style', 'class'] });
}
setupDialog(); document.addEventListener('DOMContentLoaded', setupDialog);

/* ======================= ☀ JAKI KONTRAST ======================= */
function setSun(on) { document.body.classList.toggle('sun', on); store.set('izmjera-sunce', on ? '1' : '0'); const b = $('terenSunce'); if (b) { b.classList.toggle('active', on); b.textContent = on ? '☀ Jaki kontrast: uključen' : '☀ Jaki kontrast (sunce)'; } }

/* ======================= 📦 IZVEZI SVE i 💾 SIGURNOSNA KOPIJA ======================= */
const clean = s => String(s || 'Izmjera').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) || 'Izmjera';
const fileSafe = s => String(s || 'Izmjera').replace(/[^a-z0-9čćžšđ_-]+/gi, '_').replace(/^_+|_+$/g, '') || 'Izmjera';
const enc = t => new TextEncoder().encode(t);
function dataUrlBytes(d) { const i = String(d || '').indexOf(','); if (i < 0) return null; const bin = atob(d.slice(i + 1)), u = new Uint8Array(bin.length); for (let k = 0; k < bin.length; k++) u[k] = bin.charCodeAt(k); return u; }
/* v2.64: više zgrada – izbor: sve zgrade u jedan DXF (jedna do druge) / samo ova zgrada / svaka zgrada svoja datoteka */
function shiftOut(o, dx, dy) { const seen = new Set(); const walk = v => { if (!v || typeof v !== 'object' || seen.has(v)) return; seen.add(v); if (Array.isArray(v)) { v.forEach(walk); return; }
    if (typeof v.x === 'number' && typeof v.y === 'number') { v.x += dx; v.y += dy; } for (const k in v) { const c = v[k]; if (c && typeof c === 'object') walk(c); } };
  for (const k of ['lines', 'arcs', 'texts', 'polys', 'circles', 'dims']) walk(o[k]); }
function mergedDxf(parts) { /* parts: [{title, out}] – tlocrti poredani slijeva nadesno, naslov iznad svakoga */
  const M = { lines: [], arcs: [], texts: [], polys: [], circles: [], dims: [] }; let cx = 0, prevB = null;
  for (const P of parts) { const o = {}; for (const k of Object.keys(M)) o[k] = JSON.parse(JSON.stringify(P.out[k] || []));
    let b = P.out.bounds; if (!b || !Number.isFinite(b.x0)) { b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }; for (const l of o.lines) for (const q of [l.a, l.b]) { b.x0 = Math.min(b.x0, q.x); b.x1 = Math.max(b.x1, q.x); b.y0 = Math.min(b.y0, q.y); b.y1 = Math.max(b.y1, q.y); } }
    if (!Number.isFinite(b.x0)) continue; if (prevB != null && P.bld !== prevB) cx += 400; prevB = P.bld;
    const dx = cx - b.x0 + 150, dy = -b.y0 + 150; shiftOut(o, dx, dy); for (const k of Object.keys(M)) M[k].push(...o[k]);
    M.texts.push({ layer: 'OPISI', x: cx + 150, y: 40, text: P.title, h: 30, rot: 0, align: 'l' }); cx += (b.x1 - b.x0) + 300 + 150; }
  return C.toDxf(M); }
function exportAsk() { const Z = app.zg, L = Z ? Z.list() : []; if (L.length < 2) { exportAll('ova'); return; }
  const cur = L.find(b => b.id === Z.cur()) || L[0], d = document.createElement('div'); d.id = 'zgEx'; d.style.cssText = 'position:fixed;inset:0;z-index:100004;background:#0008;display:flex;align-items:center;justify-content:center;padding:16px';
  d.innerHTML = '<div style="background:#fff;border-radius:14px;padding:16px 18px;max-width:460px;width:100%;font:15px Arial;color:#0f2a4a"><b style="font-size:18px">📦 Izvezi sve – ' + L.length + ' zgrade na terenu</b><p style="margin:8px 0 10px;color:#475569;font-size:13px">U ZIP idu tlocrti (DXF, PDF), skice, fotografije i projekt.</p>' +
    [['sve', 'Sve zgrade u jedan DXF', 'jedna do druge, s naslovom iznad svake etaže'], ['ova', 'Samo ova zgrada', cur.name], ['svaka', 'Svaka zgrada svoja datoteka', 'mapa i DXF za svaku zgradu']].map(([k, t, s2]) => '<button data-ex="' + k + '" style="display:block;width:100%;text-align:left;margin:6px 0;padding:10px 12px;border:1px solid #cbd5e1;border-radius:10px;background:#f8fafc;font:700 15px Arial;color:#0f2a4a">' + t + '<small style="display:block;font:400 12px Arial;color:#64748b;margin-top:2px">' + s2 + '</small></button>').join('') +
    '<div style="text-align:right;margin-top:8px"><button data-ex="x" style="border:0;background:none;color:#475569;font:600 14px Arial;padding:8px">Odustani</button></div></div>';
  document.body.appendChild(d); d.querySelectorAll('[data-ex]').forEach(b => b.onclick = () => { d.remove(); if (b.dataset.ex !== 'x') exportAll(b.dataset.ex); }); }
async function exportAll(mode) {
  mode = mode || 'ova'; const EX = window.IzmjeraEnergijaIzvoz, UI = window.IzmjeraTlocrtUI; if (!EX || !EX.zip) { alert('Izvoz nije dostupan.'); return; }
  toast('📦 Pripremam sve datoteke…'); await new Promise(r => setTimeout(r, 30));
  const name = fileSafe(app.projectName()), files = [], notes = [], Z = app.zg, L = Z ? Z.list() : [{ id: '', name: '' }], multi = L.length > 1, cur = Z ? Z.cur() : '';
  try { app.save(); } catch (e) { }
  const data = app.pack(); files.push({ name: name + '_projekt.json', data: enc(JSON.stringify(data)) });
  const blds = mode === 'ova' || !multi ? L.filter(b => b.id === cur) : L, allParts = [];
  for (const B of blds) { const pre = multi && mode !== 'ova' ? fileSafe(B.name || 'zgrada') + '/' : '', parts = [];
    for (const f of (Z ? Z.floorsOf(B.id) : app.floors())) { const fn = fileSafe(f.name || 'etaza'), lab = (multi ? B.name + ' – ' : '') + (f.name || '');
      try { const b = UI.buildFloor(f); files.push({ name: pre + fn + '_tlocrt.dxf', data: enc(C.toDxf(b.out)) }); parts.push({ title: lab.toUpperCase(), out: b.out, bld: B.id });
        try { const pdf = UI.planPdfBytes && UI.planPdfBytes(b.out, lab, b.st && b.st.north); if (pdf) files.push({ name: pre + fn + '_tlocrt.pdf', data: pdf }); } catch (e) { notes.push(lab + ': PDF tlocrta nije uspio (' + (e.message || e) + ')'); }
      } catch (e) { notes.push(lab + ': tlocrt nije izrađen – otvori Tlocrt → DXF za tu etažu.'); }
      try { if (C.sketchDxf) files.push({ name: pre + fn + '_skica.dxf', data: enc(C.sketchDxf(f)) }); } catch (e) { }
      let k = 0; for (const o of (f.items || []).filter(x => x.type === 'photo')) { const d = window.IzmjeraFoto && window.IzmjeraFoto.get(o.id), by = d && dataUrlBytes(d); if (by) { k++; files.push({ name: 'fotografije/' + (multi ? fileSafe(B.name) + '_' : '') + fn + '_foto_' + (o.n || k) + '.jpg', data: by }); if (o.note) notes.push('Foto ' + fn + ' ' + (o.n || k) + ': ' + o.note); } } }
    if (multi && mode === 'svaka' && parts.length > 1) try { files.push({ name: pre + fileSafe(B.name) + '_sve_etaze_tlocrt.dxf', data: enc(mergedDxf(parts)) }); } catch (e) { notes.push(B.name + ': zajednički DXF nije uspio (' + (e.message || e) + ')'); }
    allParts.push(...parts); }
  if (multi && mode === 'sve' && allParts.length) try { files.push({ name: name + '_sve_zgrade_tlocrt.dxf', data: enc(mergedDxf(allParts)) }); } catch (e) { notes.push('Zajednički DXF nije uspio (' + (e.message || e) + ')'); }
  try { const pf = window.IzmjeraEnergija && window.IzmjeraEnergija.procFiles && window.IzmjeraEnergija.procFiles(); const cb = L.find(b => b.id === cur), pp = multi ? fileSafe((cb && cb.name) || 'zgrada') + '_' : ''; if (pf) { if (pf.dxf) files.push({ name: name + '_' + pp + 'procelja.dxf', data: enc(pf.dxf) }); if (pf.pdf) files.push({ name: name + '_' + pp + 'procelja.pdf', data: pf.pdf }); } } catch (e) { notes.push('Pročelja: ' + (e.message || e)); }
  files.push({ name: 'PROCITAJ.txt', data: enc('Izmjera 57 – ' + app.projectName() + '\r\nIzvezeno: ' + new Date().toLocaleString('hr-HR') + (multi ? '\r\nZgrade: ' + L.map(b => b.name).join(', ') : '') + '\r\n\r\n' + files.map(f => f.name).join('\r\n') + (notes.length ? '\r\n\r\nNapomene:\r\n' + notes.join('\r\n') : '') + '\r\n') });
  const zip = EX.zip(files), zn = name + (multi && mode === 'ova' ? '_' + fileSafe((L.find(b => b.id === cur) || {}).name || '') : '') + '_sve_' + new Date().toISOString().slice(0, 10) + '.zip';
  EX.saveBytes(zip, zn, 'application/zip');
  toast('📦 Izvezeno ' + files.length + ' datoteka u ' + zn + (notes.length ? ' (' + notes.length + ' napomena u PROCITAJ.txt)' : ''));
}
const BK = { sig: '', when: 0 };
function backup(force) {
  const A = window.AndroidApp, folder = window.IzmjeraSpremi && window.IzmjeraSpremi.folder && window.IzmjeraSpremi.folder();
  let txt; try { txt = JSON.stringify(app.pack()); } catch (e) { return false; }
  const sig = txt.length + ':' + hash(txt); if (!force && sig === BK.sig) return true;
  const day = new Date().toISOString().slice(0, 10), nm = clean(app.projectName()) + '_' + day + '.json';
  if (A && A.saveToFolder && folder) { let r = ''; try { const b64 = btoa(unescape(encodeURIComponent(txt))); r = A.saveToFolder('Sigurnosne kopije', nm, 'application/json', b64); } catch (e) { r = String(e.message || e); }
    if (r === 'ok') { BK.sig = sig; BK.when = Date.now(); store.set('izmjera-kopija-zadnja', String(BK.when)); if (force) toast('💾 Sigurnosna kopija spremljena: ' + folder + ' / Sigurnosne kopije / ' + nm); return true; }
    if (force) alert('Kopija nije spremljena: ' + r); return false; }
  if (force) { if (A) { if (confirm('Mapa za spremanje nije odabrana. Odabrati je sada? (U nju idu i sigurnosne kopije – s aplikacijom Autosync for Google Drive one odlaze i na Google Disk.)')) window.IzmjeraSpremi && window.IzmjeraSpremi.showSettings(); }
    else { const url = URL.createObjectURL(new Blob([txt], { type: 'application/json' })), a = document.createElement('a'); a.href = url; a.download = nm; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1500); } }
  return false;
}
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i += 7) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
setInterval(() => { if (app.busy && app.busy()) return; if (Date.now() - BK.when > 5 * 60 * 1000) backup(false); }, 60 * 1000);
document.addEventListener('visibilitychange', () => { if (document.hidden) backup(false); });
document.addEventListener('click', e => { const b = e.target && e.target.closest && e.target.closest('#backhome'); if (b) try { backup(false); } catch (er) { } }, true); /* v1.99: i pri izlasku na popis projekata */
setTimeout(() => { const A = window.AndroidApp, folder = window.IzmjeraSpremi && window.IzmjeraSpremi.folder && window.IzmjeraSpremi.folder(); if (A && A.saveToFolder && !folder && store.get('izmjera-kopija-podsjetnik', '') !== new Date().toISOString().slice(0, 10)) { store.set('izmjera-kopija-podsjetnik', new Date().toISOString().slice(0, 10)); toast('💾 Za sigurnosne kopije odaberi mapu za spremanje (⋯ Više → Sigurnosna kopija).'); } }, 8000);

/* ======================= gumbi ======================= */
function addButtons() {
  const vr = $('terenVrata'); if (!vr || $('terenStube')) return;
  const mk = (id, html, title, fn) => { const b = document.createElement('button'); b.id = id; b.type = 'button'; b.title = title; b.innerHTML = html; b.onclick = fn; return b; };
  const bs = mk('terenStube', '🪜 Stubište', 'Stubište: povuci olovkom od prve stube u smjeru penjanja (ili dodirni)', () => {
    ST.mode = !ST.mode; bs.classList.toggle('active', ST.mode);
    if (ST.mode) { T.blkMode = null; T.delMode = false; T.splitMode = false; ['terenProzor', 'terenVrata', 'terenDel', 'terenSplit'].forEach(x => $(x) && $(x).classList.remove('active')); toast('🪜 Povuci olovkom od prve stube u smjeru penjanja (ili dodirni). Dodir na postojeće stubište otvara postavke.'); } app.redraw(); });
  vr.insertAdjacentElement('afterend', bs);
  // druge alatke isključuju stube
  ['terenProzor', 'terenVrata', 'terenDel', 'terenSplit'].forEach(x => { const b = $(x); if (b) b.addEventListener('click', () => { if (ST.mode) { ST.mode = false; bs.classList.remove('active'); } }, true); });
  document.querySelectorAll('[data-tool]').forEach(b => b.addEventListener('click', () => { if (ST.mode) { ST.mode = false; bs.classList.remove('active'); } }));
  const bz = mk('terenZub', '◰ Zub/niša', 'Zub/niša: dodirni malu zatvorenu plohu (stup, dimnjak u kutu, niša) i odaberi što je', () => {
    ZB.mode = !ZB.mode; bz.classList.toggle('active', ZB.mode); if (ZB.mode) { if (ST.mode) { ST.mode = false; bs.classList.remove('active'); } T.blkMode = null; T.delMode = false; T.splitMode = false; ['terenProzor', 'terenVrata', 'terenDel', 'terenSplit'].forEach(x => $(x) && $(x).classList.remove('active')); toast('◰ Dodirni plohu omeđenu crtama (npr. dimnjak u kutu) – pa odaberi Izbočenje ili Udubljenje.'); } app.redraw(); });
  bs.insertAdjacentElement('afterend', bz);
  ['terenProzor', 'terenVrata', 'terenDel', 'terenSplit', 'terenStube'].forEach(x => { const b = $(x); if (b) b.addEventListener('click', () => { if (ZB.mode) { ZB.mode = false; bz.classList.remove('active'); } }, true); });
  document.querySelectorAll('[data-tool]').forEach(b => b.addEventListener('click', () => { if (ZB.mode) { ZB.mode = false; bz.classList.remove('active'); } }));
  const bo = mk('terenOstalo', '➕ Ostalo', 'Ostali blokovi: krovni prozor, otvor u ploči, terasa/balkon, greda, stup, prag', () => { if (FRM.mode) { offModes(); return; } offModes('fr'); FRM.mode = true; FRM.t = store.get('izmjera-fr-zadnji', 'greda'); bo.classList.add('active'); frChooser(); });
  bz.insertAdjacentElement('afterend', bo);
  const br = mk('terenProstorija', '▭ Prostorija', 'Prostorija: povuci pravokutnik od kuta do kuta → 4 ravna zida (uhvate se na postojeće)', () => { if (RMR.mode) { offModes(); return; } offModes('rm'); RMR.mode = true; br.classList.add('active'); toast('▭ Povuci od jednog kuta prostorije do suprotnog. Strane koje već postoje kao zid se ne crtaju dvaput. Ponovno gumb za kraj.'); });
  bo.insertAdjacentElement('afterend', br);
  const bp = mk('terenProvjera', '🔎 Provjera', 'Provjera crteža: rupe na kraju zida, dvostruke crte, kote u zraku – crveni krugovi na skici', () => pvToggle());
  br.insertAdjacentElement('afterend', bp);
  ['terenProzor', 'terenVrata', 'terenDel', 'terenSplit', 'terenStube', 'terenZub'].forEach(x => { const b = $(x); if (b) b.addEventListener('click', () => offModes(), true); });
  const bm = mk('terenMjeri', '📏 Mjeri', 'Vođeno mjerenje: kota po kota s brojčanikom', () => { if (V.on) stop(); else start(); });
  bs.insertAdjacentElement('afterend', bm);
  const pm = $('penMode'); const host = pm ? pm.parentNode : bs.parentNode;
  const sun = mk('terenSunce', '☀ Jaki kontrast (sunce)', 'Jači kontrast za rad na suncu', () => setSun(!document.body.classList.contains('sun')));
  const ob = mk('terenObris', '📋 Kopiraj s druge etaže', 'Obris, svi zidovi ili ista etaža s kotama – na ovu etažu', outlineDialog);
  const ex = mk('terenIzvoz', '📦 Izvezi sve', 'Sve etaže: DXF, PDF, skica, fotografije i projekt u jednoj ZIP datoteci', exportAsk);
  const fzOn = () => store.get('izmjera-fs-zum', '1') !== '0', fz = mk('terenFsZum', '', 'Novi upisani brojevi kota: veličina prema zumu (zumirano = manji broj)', () => { store.set('izmjera-fs-zum', fzOn() ? '0' : '1'); fzP(); toast(fzOn() ? '🔍 Novi brojevi: veličina prema zumu (na zaslonu uvijek iste veličine).' : '🔍 Novi brojevi: uvijek ista veličina na crtežu.'); }), fzP = () => { fz.textContent = '🔍 Broj prema zumu: ' + (fzOn() ? 'uključeno' : 'isključeno'); fz.classList.toggle('active', fzOn()); }; fzP();
  const nb = mk('terenSjever', '🧭 Sjever (strane svijeta)', 'Povuci strelicu prema sjeveru – za energetski certifikat (strane pročelja i prozora)', () => northSet(!NS.mode));
  const kp = mk('terenKopija', '💾 Sigurnosna kopija', 'Spremi kopiju projekta u mapu „Sigurnosne kopije” (radi se i sama svakih 5 minuta)', () => backup(true));
  for (const b of [sun, ob, ex, kp, nb, fz]) host.appendChild(b);
  setSun(store.get('izmjera-sunce', '0') === '1');
}
addButtons(); document.addEventListener('DOMContentLoaded', addButtons); setTimeout(addButtons, 500);
/* v2.02: olovka/linija/gumica i Prozor/Vrata/Stubište/Zub/Izbriši nikad istovremeno uključeni */
const TX = { saved: null };
function toolExcl() { const any = !!(T.blkMode || T.delMode || T.splitMode || ST.mode || ZB.mode || NS.mode || FRM.mode || RMR.mode), tb = [...document.querySelectorAll('[data-tool]')];
  if (any) { const on = tb.find(b => b.classList.contains('active')); if (on) { TX.saved = on.dataset.tool; tb.forEach(b => { if (b.dataset.tool === TX.saved) b.classList.remove('active'); }); } }
  else if (TX.saved) { tb.forEach(b => { if (b.dataset.tool === TX.saved) b.classList.add('active'); }); TX.saved = null; } }
document.addEventListener('click', e => { const tb = e.target && e.target.closest && e.target.closest('[data-tool]');
  if (tb) { TX.saved = null; if (T.blkMode || T.delMode || T.splitMode) { T.blkMode = null; T.delMode = false; T.splitMode = false; ['terenProzor', 'terenVrata', 'terenDel', 'terenSplit'].forEach(x => $(x) && $(x).classList.remove('active')); try { TR.blkQuickClose && TR.blkQuickClose(); } catch (er) { } } if (NS.mode) northSet(false); offModes(); }
  setTimeout(toolExcl, 0); setTimeout(toolExcl, 60); }, true);
setInterval(toolExcl, 800);

const css = document.createElement('style'); css.textContent =
  '.vd-rooms{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}.vd-rooms button{min-height:44px;padding:4px 10px;border-radius:12px;border:2px solid #fdba74;background:#fff7ed;color:#9a3412;font:700 14px Arial}.vd-rooms button span{display:inline-block;min-width:22px;margin-left:4px;padding:1px 6px;border-radius:10px;background:#f97316;color:#fff;font-size:12px}.vd-rooms button.ok{border-color:#86efac;background:#f0fdf4;color:#166534}.vd-rooms button.ok span{background:#15803d}.vd-rooms button.sug{border-color:#f97316;box-shadow:0 0 0 3px #fed7aa}.vd-names button{min-height:40px;padding:4px 10px;border-radius:18px;border:1px solid #fca5a5;background:#fff5f5;color:#b91c1c;font:700 14px Arial}.vd-quick{flex-wrap:nowrap!important}.vd-quick button{flex:1 1 0;min-width:0;padding-left:2px;padding-right:2px}' +
  '#vdPanel{position:fixed;right:10px;top:120px;width:330px;max-width:calc(100vw - 20px);max-height:calc(100dvh - 140px);overflow:auto;z-index:45;background:#fff;border:3px solid #f97316;border-radius:16px;padding:10px 12px;box-shadow:0 10px 30px #0004;font:15px Arial;color:#102b52;-webkit-user-select:none;user-select:none}' +
  '@media (orientation:portrait){#vdPanel{left:10px;right:10px;top:auto;bottom:10px;width:auto;max-height:52dvh}}' +
  '.vd-head{display:flex;align-items:center;gap:8px}.vd-head b{flex:1;font-size:16px}.vd-left{font-size:13px;color:#9a3412;font-weight:700}.vd-head button{min-height:40px;min-width:44px;border-radius:10px;border:1px solid #b8cde5;background:#fff;font-weight:700}' +
  '.vd-q{font-weight:800;font-size:18px;margin:8px 0 2px}.vd-h{font-size:13px;color:#4a6584}.vd-val{font:800 30px Arial;text-align:right;border:2px solid #f97316;border-radius:12px;padding:6px 12px;margin:8px 0;min-height:44px;color:#102b52}' +
  '.vd-pad{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.vd-pad button{min-height:52px;font:800 22px Arial;border-radius:12px;border:1px solid #b8cde5;background:#f8fafc;color:#102b52}' +
  '.vd-row{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.vd-row button{flex:1 1 auto;min-height:46px;padding:6px 10px;border-radius:12px;border:1px solid #b8cde5;background:#fff;color:#17457f;font:700 14px Arial}.vd-row button.pri{background:#17457f;color:#fff;border-color:#17457f}' +
  '.vd-done{font-weight:800;color:#15803d;font-size:17px;margin:12px 0}' +
  '.vd-badge{position:absolute;top:-6px;right:-6px;min-width:20px;height:20px;padding:0 5px;border-radius:10px;color:#fff;font:800 11px/20px Arial;text-align:center;box-shadow:0 1px 3px #0005;pointer-events:none}' +
  '#vdObrisHint{position:absolute;left:50%;top:45%;transform:translateX(-50%);z-index:6;min-height:56px;padding:10px 22px;border-radius:14px;border:2px solid #0f766e;background:#f0fdfa;color:#0f766e;font:800 17px Arial;box-shadow:0 6px 18px #0002}' +
  '#vdNames{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0;max-height:150px;overflow:auto}#vdNames button{min-height:40px;padding:4px 12px;border-radius:18px;border:1px solid #fca5a5;background:#fff5f5;color:#b91c1c;font:700 14px Arial}#vdNames[hidden],#vdHrow[hidden]{display:none}' +
  '#vdHrow{display:flex;align-items:center;gap:8px;margin:4px 0 8px}#vdHrow span{font-weight:700}#vdHrow input{width:150px;font-size:18px;padding:6px 8px;border:2px solid #9dbbe0;border-radius:8px}' +
  /* jaki kontrast za sunce */
  'body.sun #canvas{filter:contrast(1.8) saturate(1.5)}body.sun{background:#fff!important}' +
  'body.sun #ui2Quick,body.sun .ui2-float{background:#fff!important;border:2px solid #000!important;box-shadow:none!important}' +
  'body.sun #ui2Quick button,body.sun .ui2-float button{border:2px solid #000!important;font-weight:800!important}body.sun #ui2Quick button:not([style*="23, 69, 127"]):not([style*="#17457f"]){color:#000!important}' +
  'body.sun .app-top,body.sun header{background:#fff!important;color:#000!important}body.sun .app-top button{color:#000!important;border:2px solid #000!important;font-weight:800!important}' +
  'body.sun #status{background:#000!important;color:#fff!important;font-weight:700}body.sun .tp-card,body.sun .ui2-pop{border:2px solid #000}' +
  '#terenSunce.active{background:#fde047!important;color:#000!important}';
document.head.appendChild(css);
/* natpisi koji se na zaslonu crtaju iz blokova/analize – za PDF skice (stubište, krovni prozor, izmjereni stupovi i niše) */
function pdfTexts(floor, cur) { const out = [], put = (t, p, layer, color, fs) => { const k = (fs || 14) / 18; out.push({ type: 'text', layer, color, fs: fs || 14, x: Math.round((p.x - String(t).length * 5 * k) * 10) / 10, y: Math.round((p.y + 7 * k) * 10) / 10, text: String(t), dir: 'H' }); };
  for (const o of floor.items || []) { if (!(o.blk && o.blk.main)) continue; const B = o.blk;
    if (B.t === 'stube') { const G = C.stairGeo(B.P); if (G.txtAt) put(G.text, stMap(visB(B), B.s || 3)({ u: G.txtAt.u, v: G.txtAt.v + 14 }), 'nacrt', GREEN, 11); }
    else if (isFree(B.t) && frGeo(B.t, B.P).text) put(frGeo(B.t, B.P).text, stMap(visB(B), B.s || 3)({ u: 0, v: B.t === 'prag' ? -14 : 0 }), 'nacrt', GREEN, 11); }
  if (cur && T.B && T.m) { const m = T.m, E = m.E;
    for (const n of T.B.nis || []) { if (!(n.w > 0) && !(n.d > 0)) continue; const u = n.center != null ? n.center : (n.s0 + n.s1) / 2, sg = Math.sign((n.nc != null ? n.nc : n.cW) - n.cW) || 1, dir = (n.kind === 'zadebljanje' ? 1 : -1) * sg, v = (n.kind === 'zadebljanje' && n.nc != null ? n.nc : n.cW) + dir * 16;
      put((n.w > 0 ? fmt(n.w) : '?') + 'x' + (n.d > 0 ? fmt(n.d) : '?'), raw(n.o === 'H' ? { x: u, y: v } : { x: v, y: u }), 'kote', '#ea580c', 14); }
    for (const c of T.B.cols || []) { const b = c.bb; if (c.w > 0 || c.h > 0) put('stup ' + (c.w > 0 ? fmt(c.w) : '?') + 'x' + (c.h > 0 ? fmt(c.h) : '?'), raw({ x: (b.x0 + b.x1) / 2, y: b.y1 + 2.2 * E }), 'kote', '#ea580c', 14);
      for (const ax of ['X', 'Y']) { const ps = c.pos[ax]; if (!ps || !ps.w || !ps.vod) continue; const e = ps.dir > 0 ? (ax === 'X' ? b.x0 : b.y0) : (ax === 'X' ? b.x1 : b.y1), mid = (ps.w.c + e) / 2; put(fmt(ps.value), raw(ax === 'X' ? { x: mid, y: (b.y0 + b.y1) / 2 - 1.6 * E } : { x: (b.x0 + b.x1) / 2 + 2.4 * E, y: mid }), 'kote', '#ea580c', 14); } } }
  return out; }
(T.after = T.after || []).push(() => { if (V.on) return; /* vodič to radi sam prije pitanja */ if (autoStep()) app.redraw(); });
window.IzmjeraVodic = { autoStep, roomCheck, roomCheckData, qText, targetOf, stBuild, stCopyUp, pvList: () => (pvCompute(), PV.list), left: () => NZ.n, nzOn: v => { if (v != null) { nzOn = !!v; store.set('izmjera-neizm', v ? '1' : '0'); app.redraw(); } return nzOn; }, pvCount: () => { try { pvCompute(); return PV.list.length; } catch (e) { return 0; } }, stReplace, pdfTexts, krPlace, zubTap, laserFeed, refresh: () => { if (!V.on) return; if (!V.val || V.fresh) step(true); else { const b = panelEl().querySelector('[data-a="laser"]'); if (b) b.outerHTML = laserBtn(); bindPanel(); } }, goBack, roomsOf, plan, start, stop, V, ST, stMenu, copyOutline, exportAll, backup, setSun };
})();
