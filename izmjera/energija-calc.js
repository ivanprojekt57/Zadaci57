/* Izmjera 57 — energetski certifikat: proračun površina i volumena iz izrađenog tlocrta (vanjske mjere). */
(function (root) {
'use strict';
const STRANE = ['S', 'SI', 'I', 'JI', 'J', 'JZ', 'Z', 'SZ'];
const ROOM_KINDS = [['grijano', 'Grijano'], ['stubiste', 'Negrijano stubište'], ['garaza', 'Garaža'], ['spremiste', 'Spremište / ostava'], ['kotlovnica', 'Kotlovnica'], ['podrum', 'Negrijani podrum'], ['tavan', 'Tavan'], ['negrijano', 'Ostalo negrijano'], ['vanjski', 'Vanjski prostor (lođa, atrij)']];
const ROOM_NAME = Object.fromEntries(ROOM_KINDS);
const ISPOD = [['grijano', 'Grijana etaža'], ['tlo', 'Tlo'], ['garaza', 'Garaža'], ['podrum', 'Negrijani podrum'], ['vanjski', 'Vanjski zrak (prolaz, konzola)'], ['negrijano', 'Ostali negrijani prostor']];
const IZNAD = [['grijano', 'Grijana etaža'], ['tavan', 'Negrijani tavan'], ['ravni', 'Ravni krov'], ['kosi', 'Kosi krov (potkrovlje)'], ['negrijano', 'Ostali negrijani prostor']];
const OPEN_KINDS = [['prozor', 'Prozor'], ['balkonska', 'Balkonska vrata'], ['ulazna', 'Ulazna vrata'], ['negrijano', 'Vrata prema negrijanom'], ['krovni', 'Krovni prozor']];
const OPEN_NAME = Object.fromEntries(OPEN_KINDS);
/* nazivi elemenata (redoslijed u tablicama) */
const EL = {
  zid_vanjski: 'Vanjski zid', zid_tlo: 'Zid prema tlu', zid_susjed_g: 'Zid prema susjednoj zgradi (grijanoj)', zid_susjed_n: 'Zid prema susjednoj zgradi (negrijanoj)',
  zid_stubiste: 'Zid prema negrijanom stubištu', zid_garaza: 'Zid prema garaži', zid_spremiste: 'Zid prema spremištu', zid_kotlovnica: 'Zid prema kotlovnici', zid_podrum: 'Zid prema negrijanom podrumu', zid_tavan: 'Zid prema tavanu', zid_negrijano: 'Zid prema ostalom negrijanom',
  pod_tlo: 'Pod na tlu', pod_garaza: 'Pod prema garaži', pod_podrum: 'Pod prema negrijanom podrumu', pod_vanjski: 'Pod prema vanjskom zraku', pod_negrijano: 'Pod prema ostalom negrijanom',
  strop_tavan: 'Strop prema tavanu', krov_ravni: 'Ravni krov', krov_kosi: 'Kosi krov', strop_negrijano: 'Strop prema ostalom negrijanom'
};
const EL_ORDER = Object.keys(EL);
const SASTAV_KAT = [['zid_vanjski', 'Vanjski zid'], ['zid_negrijano', 'Zid prema negrijanom'], ['zid_tlo', 'Zid prema tlu'], ['zid_susjed', 'Zid prema susjednoj zgradi'], ['pod_tlo', 'Pod na tlu'], ['pod_negrijano', 'Pod prema negrijanom / garaži'], ['pod_vanjski', 'Pod prema vanjskom zraku'], ['strop_tavan', 'Strop prema tavanu'], ['krov_ravni', 'Ravni krov'], ['krov_kosi', 'Kosi krov']];
const sastavKat = el => el.startsWith('zid_susjed') ? 'zid_susjed' : el === 'zid_vanjski' || el === 'zid_tlo' ? el : el.startsWith('zid_') ? 'zid_negrijano' : el === 'pod_tlo' || el === 'pod_vanjski' ? el : el.startsWith('pod_') ? 'pod_negrijano' : el === 'strop_negrijano' ? 'strop_tavan' : el;

function defaultRoomKind(name) {
  const n = String(name || '').toLowerCase();
  if (/gara[žz]/.test(n)) return 'garaza'; if (/kotlov/.test(n)) return 'kotlovnica'; if (/tavan/.test(n)) return 'tavan';
  if (/podrum/.test(n)) return 'podrum'; if (/(spremi|ostava|šupa|supa|drvarnic)/.test(n)) return 'spremiste';
  if (/(lođ|lodj|terasa|balkon|atrij|dvori)/.test(n)) return 'vanjski';
  return 'grijano';
}
function roomKey(out, k) { const n = out.roomNames && out.roomNames[k]; if (n) return 'n:' + n.trim(); const c = out.rooms[k].center; return 'p:' + Math.round(c.x / 20) + ':' + Math.round(c.y / 20); }
function strana(nx, ny, north) { // nx,ny = vanjska normala u koordinatama tlocrta (y prema dolje)
  const ang = Math.atan2(nx, -ny) * 180 / Math.PI - (north || 0); const k = ((Math.round(ang / 45) % 8) + 8) % 8; return STRANE[k];
}
function num(v, d) { const x = parseFloat(String(v == null ? '' : v).replace(',', '.')); return Number.isFinite(x) ? x : d; }
function konstrD(k) { if (!k) return 0; if (k.mode === 'slojevi') return (k.sl || []).reduce((s, l) => s + num(l.d, 0), 0); return num(k.d, 0); }
/* bruto visina etaže (cm) */
function floorHeights(E) {
  const h = num(E.h, 260), dI = konstrD(E.konstr), dP = E.ispod && E.ispod !== 'grijano' ? num(E.dIspod, 0) : 0;
  const base = E.konstr && E.konstr.mode === 'kota' ? num(E.konstr.H, h + 20) : h + dI;
  return { h, dIznad: E.konstr && E.konstr.mode === 'kota' ? base - h : dI, dIspod: dP, Hb: base + dP };
}

/* debljina vanjskog zida iz rastera (prvi zid u srednjem redu i stupcu) */
function extT(res) { const g = res && res.grid; if (!g || !res.T) return 30; const { xs, ys, nx, ny } = g, T = res.T, run = (n, at, w) => { let d = 0, on = false; for (let k = 0; k < n; k++) { const t = T[at(k)]; if (t === -2) { d += w(k); on = true; } else if (on) break; } return d; };
  const a = run(nx, i => i * ny + (ny >> 1), i => xs[i + 1] - xs[i]), b = run(ny, j => (nx >> 1) * ny + j, j => ys[j + 1] - ys[j]); const v = [a, b].filter(x => x >= 8 && x <= 90); return v.length ? Math.min(...v) : 30; }
/* krov zadan visinama (mjereno iznutra uz zid i do sljemena, do roga ili do daske na rogovima) → nagib i nadzid (nadzid = donji rub roga na vanjskom licu zida, od poda) */
function kosiFromH(k, bb, tW, open) {
  const hz = num(k.hZid, NaN), hs = num(k.hSlj, NaN); if (!(hz >= 0) || !(hs > hz) || !bb || !Number.isFinite(bb.x0)) return k;
  const vr = k.vrsta || 'dvostresni', W = bb.x1 - bb.x0, Hh = bb.y1 - bb.y0;
  let run = vr === 'jednostresni' ? (((k.visa || 'gore') === 'gore' || k.visa === 'dolje') ? Hh : W) - 2 * tW : vr === 'cetverostresni' ? Math.min(W, Hh) / 2 - tW : ((k.sljeme || 'H') === 'H' ? Hh : W) / 2 - tW;
  if (!(run > 20)) return k; const tg = (hs - hz) / run, a = Math.atan(tg), dRog = k.ref === 'daska' ? num(k.rog, 18) / Math.cos(a) : 0;
  return Object.assign({}, k, { nagib: Math.round(a * 1800 / Math.PI) / 10, nadzid: Math.round((hz - dRog - tW * tg) * 10) / 10, _iz: true });
}
/* glavni proračun jedne etaže. out = rezultat C.build, E = postavke etaže (floor.energija), P = postavke projekta */
function calcFloor(out, E, P, north, opts) {
  opts = opts || {};
  E = E || {}; P = P || {}; const g = out.gridR, R = out.roomsRes; if (!g || !R) throw Error('Tlocrt nema podatke o prostorijama.');
  const { xs, ys, nx, ny } = g, N = nx * ny;
  const rooms = out.rooms.map((r, k) => { const key = roomKey(out, k), name = (out.roomNames && out.roomNames[k]) || ''; let kind = (E.rooms && E.rooms[key]) || defaultRoomKind(name); if (opts.allHeated && kind !== 'vanjski') kind = 'grijano'; /* pročelja: cijela zgrada */ return { k, key, name, kind, area: r.area, center: r.center, h: r.h, pod: r.pod }; });
  // dijelovi etaže s vlastitom visinom i krovom (npr. garaža, ulaz); 0 = glavni dio
  const PARTS = [{ name: 'Glavni dio', E }].concat((E.dijelovi || []).map(d => ({ name: d.naziv || 'Dio', E: { ...E, h: d.h != null && d.h !== '' ? d.h : E.h, konstr: d.konstr || E.konstr, iznad: d.iznad || E.iznad, kosi: d.kosi || {}, atika: d.atika }, rooms: d.rooms || [] })));
  const roomPart = rooms.map(r => { const k = PARTS.findIndex((P2, i) => i > 0 && P2.rooms.includes(r.key)); return k > 0 ? k : 0; });
  const cellRoom = c => { const comp = R.id[c]; return comp >= 0 && R.map.has(comp) ? R.map.get(comp) : -1; };
  const T = new Int16Array(N), RI = new Int16Array(N).fill(-1); // T: -2 zid, -1 vani, ≥0 prostorija; RI: prostorija i kad je „vanjski prostor”
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) { const c = i * ny + j; if (g.at(i, j)) T[c] = -2; else { const r = cellRoom(c); RI[c] = r; T[c] = r >= 0 && rooms[r].kind !== 'vanjski' ? r : -1; } }
  const heated = r => r >= 0 && rooms[r].kind === 'grijano';
  const Z = new Uint8Array(N), OWN = new Int16Array(N).fill(-1);
  for (let c = 0; c < N; c++) if (T[c] >= 0 && heated(T[c])) { Z[c] = 1; OWN[c] = T[c]; }
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const cw = i => xs[i + 1] - xs[i], ch = j => ys[j + 1] - ys[j];
  // zid pripada grijanom dijelu ako je preko zida (najviše 90 cm) grijana prostorija
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
    const c = i * ny + j; if (T[c] !== -2) continue;
    for (const [di, dj] of DIRS) { let a = i, b = j, d = 0, hit = false; while (true) { a += di; b += dj; if (a < 0 || b < 0 || a >= nx || b >= ny) break; const t = T[a * ny + b]; if (t === -2) { d += di ? cw(a) : ch(b); if (d > 90) break; continue; } hit = heated(t); if (hit && OWN[c] < 0) OWN[c] = t; break; } if (hit) { Z[c] = 1; break; } }
  }
  for (let pass = 0; pass < 3; pass++) for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) { // uglovi
    const c = i * ny + j; if (Z[c] || T[c] !== -2) continue; const z = (a, b) => a >= 0 && b >= 0 && a < nx && b < ny && Z[a * ny + b];
    if ((z(i - 1, j) || z(i + 1, j)) && (z(i, j - 1) || z(i, j + 1))) { Z[c] = 2; for (const [a, b] of [[i - 1, j], [i + 1, j], [i, j - 1], [i, j + 1]]) if (z(a, b) && OWN[a * ny + b] >= 0) { OWN[c] = OWN[a * ny + b]; break; } }
  }
  // što je s druge strane ruba grijanog dijela
  const beyond = (i, j, di, dj) => { let a = i + di, b = j + dj; while (a >= 0 && b >= 0 && a < nx && b < ny) { const t = T[a * ny + b]; if (t !== -2) return t; a += di; b += dj; } return -1; };
  const clsOf = t => t < 0 ? 'ext' : rooms[t].kind;
  // krov zadan visinama: nagib i nadzid iz obrisa dijela (prethodni prolaz po grijanim ćelijama) i debljine vanjskog zida
  const PB = PARTS.map(() => ({ x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity }));
  if (PARTS.some(P2 => P2.E.kosi && P2.E.kosi.unos === 'visine')) for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) { const c = i * ny + j; if (!Z[c]) continue; const q = PB[OWN[c] >= 0 ? roomPart[OWN[c]] : 0]; q.x0 = Math.min(q.x0, xs[i]); q.x1 = Math.max(q.x1, xs[i + 1]); q.y0 = Math.min(q.y0, ys[j]); q.y1 = Math.max(q.y1, ys[j + 1]); }
  const tWx = extT({ grid: g, T });
  PARTS.forEach((P2, pi) => { const pe = P2.E, hh = floorHeights(pe); let ks = pe.iznad === 'kosi' ? (pe.kosi || {}) : null; if (ks && ks.unos === 'visine') ks = kosiFromH(ks, PB[pi], tWx, true); P2.Hh = hh; P2.kosi = ks; P2.Hwall = ks ? num(ks.nadzid, 100) + hh.dIspod : hh.Hb; });
  const edges = [];
  let AZ = 0, x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  const PA = PARTS.map(() => ({ AZ: 0, x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity }));
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
    const c = i * ny + j; if (!Z[c]) continue; AZ += cw(i) * ch(j); x0 = Math.min(x0, xs[i]); x1 = Math.max(x1, xs[i + 1]); y0 = Math.min(y0, ys[j]); y1 = Math.max(y1, ys[j + 1]);
    const prt = OWN[c] >= 0 ? roomPart[OWN[c]] : 0, q = PA[prt]; q.AZ += cw(i) * ch(j); q.x0 = Math.min(q.x0, xs[i]); q.x1 = Math.max(q.x1, xs[i + 1]); q.y0 = Math.min(q.y0, ys[j]); q.y1 = Math.max(q.y1, ys[j + 1]);
    for (const [di, dj] of DIRS) {
      const a = i + di, b = j + dj, inG = a >= 0 && b >= 0 && a < nx && b < ny;
      if (inG && Z[a * ny + b]) { // granica dva dijela različite visine: viši dio ima vanjski zid iznad nižega
        const on = OWN[a * ny + b], pn = on >= 0 ? roomPart[on] : 0; if (pn !== prt && PARTS[prt].Hwall > PARTS[pn].Hwall + 1) { const z0rel = PARTS[pn].Hwall; if (di) edges.push({ o: 'V', nxs: di, nys: 0, at: di > 0 ? xs[i + 1] : xs[i], s0: ys[j], s1: ys[j + 1], cls: 'ext', prt, z0rel }); else edges.push({ o: 'H', nxs: 0, nys: dj, at: dj > 0 ? ys[j + 1] : ys[j], s0: xs[i], s1: xs[i + 1], cls: 'ext', prt, z0rel }); }
        continue; }
      const t = !inG ? -1 : T[a * ny + b] === -2 ? beyond(a, b, di, dj) : T[a * ny + b];
      const cls = clsOf(t);
      if (cls === 'grijano') continue; // (ne bi se smjelo dogoditi)
      if (di) edges.push({ o: 'V', nxs: di, nys: 0, at: di > 0 ? xs[i + 1] : xs[i], s0: ys[j], s1: ys[j + 1], cls, prt });
      else edges.push({ o: 'H', nxs: 0, nys: dj, at: dj > 0 ? ys[j + 1] : ys[j], s0: xs[i], s1: xs[i + 1], cls, prt });
    }
  }
  // spajanje rubova u dijelove pročelja
  edges.sort((p, q) => p.o.localeCompare(q.o) || (p.nxs + p.nys) - (q.nxs + q.nys) || p.at - q.at || p.cls.localeCompare(q.cls) || p.prt - q.prt || p.s0 - q.s0);
  const segs = [];
  for (const e of edges) { const L = segs.at(-1); if (L && L.o === e.o && L.nxs === e.nxs && L.nys === e.nys && Math.abs(L.at - e.at) < 0.05 && L.cls === e.cls && L.prt === e.prt && (L.z0rel || 0) === (e.z0rel || 0) && Math.abs(L.s1 - e.s0) < 0.05) L.s1 = e.s1; else segs.push({ ...e }); }
  /* v2.50: pročelja se dijele na dijelove – samo na mjestima okomitih unutarnjih zidova (crtica, može se spojiti) i ručni rezovi (u cm) */
  { const segCut = E.segCut || {}, keyOf = s => s.o + ':' + Math.round(s.at) + ':' + Math.round((s.s0 + s.s1) / 2) + ':' + (s.nxs + s.nys);
    const near = (arr, v) => { let k = 0, bd = Infinity; arr.forEach((x, i) => { const d = Math.abs(x - v); if (d < bd) { bd = d; k = i; } }); return k; };
    const profile = s => { const H = s.o === 'H', A = H ? xs : ys, B = H ? ys : xs, nA = H ? nx : ny, nB = H ? ny : nx, ou = H ? s.nys : s.nxs, kb = near(B, s.at), step = -ou, out = [];
      for (let i = 0; i < nA; i++) { if (A[i] < s.s0 - 0.05 || A[i + 1] > s.s1 + 0.05) continue; let k = ou > 0 ? kb - 1 : kb, d = 0, room = -1;
        while (k >= 0 && k < nB) { const t = T[H ? i * ny + k : k * ny + i]; if (t !== -2) { room = t; break; } d += B[k + 1] - B[k]; k += step; }
        out.push({ a: A[i], b: A[i + 1], d, room }); }
      return out; };
    const ns = []; let pn = 0;
    for (const s of segs) { pn++; if (s.cls !== 'ext') { ns.push(Object.assign(s, { lab: String(pn) })); continue; }
      const pkey = keyOf(s), cfg = segCut[pkey] || {}, off = cfg.off || [], man = (cfg.man || []).map(v => num(v, NaN)).filter(v => v > 4 && v < s.s1 - s.s0 - 4), pr = profile(s);
      const dmin = Math.min(...pr.filter(q => q.room >= 0).map(q => q.d), Infinity), isW = q => q.room < 0 || q.d > dmin + 8, runs = [];
      for (const q of pr) { const ty = isW(q) ? 'W' : q.room, L = runs.at(-1); if (L && L.ty === ty && Math.abs(L.b - q.a) < 0.05) L.b = q.b; else runs.push({ ty, a: q.a, b: q.b }); }
      const auto = []; for (let k = 1; k + 1 < runs.length; k++) { const r = runs[k]; if (r.ty !== 'W' || runs[k - 1].ty === 'W' || runs[k + 1].ty === 'W' || runs[k - 1].ty === runs[k + 1].ty) continue; const pos = Math.round(((r.a + r.b) / 2 - s.s0) * 10) / 10; auto.push({ pos, auto: true, on: !off.some(v => Math.abs(v - pos) < 3) }); }
      const cuts = auto.concat(man.map(pos => ({ pos, auto: false, on: true }))).sort((a, b) => a.pos - b.pos), info = { pkey, s0: s.s0, s1: s.s1, o: s.o, at: s.at, nxs: s.nxs, nys: s.nys, cuts, pn };
      const pts = [0].concat(cuts.filter(c => c.on).map(c => c.pos).filter((v, i, a) => !i || v - a[i - 1] > 2), [s.s1 - s.s0]), np = pts.length - 1;
      for (let k = 0; k < np; k++) { const a = s.s0 + pts[k], b = s.s0 + pts[k + 1], tally = {}; for (const q of pr) { const ov = Math.min(b, q.b) - Math.max(a, q.a); if (ov > 0 && q.room >= 0 && !isW(q)) tally[q.room] = (tally[q.room] || 0) + ov; }
        const rk = Object.keys(tally).sort((x, y) => tally[y] - tally[x])[0];
        ns.push(Object.assign({}, s, { s0: a, s1: b, pkey, np, off0: Math.round(pts[k] * 10) / 10, lab: pn + (np > 1 ? String.fromCharCode(97 + k) : ''), roomName: rk != null && rooms[rk] ? rooms[rk].name : '', cutInfo: info })); } }
    segs.splice(0, segs.length, ...ns); }
  PARTS.forEach((P2, i) => { Object.assign(P2, PA[i]); P2.bbox = { x0: PA[i].x0, x1: PA[i].x1, y0: PA[i].y0, y1: PA[i].y1 }; });
  const Hh = PARTS[0].Hh, kosi = PARTS[0].kosi, Hwall = PARTS[0].Hwall;
  const ukop = E.ukop || {}, dU = Math.max(0, num(ukop.d, 0)), uStrane = ukop.strane || [];
  const segOv = E.segOv || {};
  segs.forEach((s, n) => {
    s.n = n + 1; s.L = s.s1 - s.s0; s.strana = strana(s.nxs, s.nys, north); s.key = s.pkey ? (s.np > 1 ? s.pkey + '@' + Math.round(s.off0) : s.pkey) : s.o + ':' + Math.round(s.at) + ':' + Math.round((s.s0 + s.s1) / 2) + ':' + (s.nxs + s.nys);
    s.H = PARTS[s.prt].Hwall - (s.z0rel || 0); s.A = s.L * s.H; s.Atlo = 0; s.part = null;
    if (s.cls === 'ext') { // ručna oznaka pročelja: susjedna zgrada ili negrijani prostor koji nije nacrtan (cijelo ili samo dio duljine)
      let ov = segOv[s.key]; if (ov == null && s.np > 1 && segOv[s.pkey]) { ov = segOv[s.pkey]; ov = { k: typeof ov === 'string' ? ov : ov.k }; } /* dio naslijedi oznaku cijelog pročelja */ if (typeof ov === 'string') ov = { k: ov }; ov = ov || {}; s.ov = ov;
      const elOf = { susjed_g: 'zid_susjed_g', susjed_n: 'zid_susjed_n', negrijano: 'zid_negrijano', garaza: 'zid_garaza', stubiste: 'zid_stubiste' }[ov.k];
      const Lp = num(ov.L, 0) * 100; // upisano u m
      if (elOf && Lp > 0 && Lp < s.L - 1 && !(s.np > 1)) { s.el = 'zid_vanjski'; s.part = { el: elOf, L: Lp, A: Lp * s.H }; }
      else s.el = elOf || 'zid_vanjski';
    }
    else s.el = 'zid_' + (s.cls === 'negrijano' ? 'negrijano' : s.cls);
    if (s.el === 'zid_vanjski' && dU > 0 && uStrane.includes(s.strana)) { const hu = Math.min(dU, s.H); s.Atlo = (s.L - (s.part ? s.part.L : 0)) * hu; }
  });
  // otvori na omotaču
  const ops = [], ovO = E.otvori || {}, D = P.defaults || {};
  const cellAt = (x, y) => { if (x < xs[0] || x >= xs[nx] || y < ys[0] || y >= ys[ny]) return -1; let i = 0, j = 0; while (i < nx - 1 && x >= xs[i + 1]) i++; while (j < ny - 1 && y >= ys[j + 1]) j++; return i * ny + j; };
  for (const o of (out.B && out.B.ops) || []) {
    if (o._c == null || !(o._w > 0)) continue; const w = o.wallRef || null; const wl = out.walls.find(r => r.w && r.w.id === o.wall); if (!wl) continue;
    const horiz = wl.w.o === 'H', line = horiz ? (wl.y0 + wl.y1) / 2 : (wl.x0 + wl.x1) / 2, t = horiz ? wl.y1 - wl.y0 : wl.x1 - wl.x0;
    const pA = horiz ? { x: o._c, y: line - t / 2 - 2 } : { x: line - t / 2 - 2, y: o._c }, pB = horiz ? { x: o._c, y: line + t / 2 + 2 } : { x: line + t / 2 + 2, y: o._c };
    const cA = cellAt(pA.x, pA.y), cB = cellAt(pB.x, pB.y), zA = cA >= 0 && Z[cA] === 1 && T[cA] >= 0, zB = cB >= 0 && Z[cB] === 1 && T[cB] >= 0;
    if (zA === zB) continue; // unutarnji otvor
    const sgn = zA ? 1 : -1, cO = zA ? cB : cA, tO = cO < 0 ? -1 : T[cO], cls = clsOf(tO === -2 ? -1 : tO);
    const nxs = horiz ? 0 : sgn, nys = horiz ? sgn : 0, face = line + sgn * t / 2, st = strana(nxs, nys, north);
    const roomIn = T[zA ? cA : cB], rn = roomIn >= 0 ? rooms[roomIn].name.toLowerCase() : '';
    const ov = ovO[o.key] || {};
    const seg = segs.find(s => s.nxs === nxs && s.nys === nys && Math.abs(s.at - face) < 3 && o._c >= s.s0 - 1 && o._c <= s.s1 + 1) || null;
    const segUnh = seg && seg.cls === 'ext' && !seg.part && /^zid_(negrijano|garaza|stubiste)$/.test(seg.el); // pročelje označeno kao zid prema negrijanom
    let kind = ov.vrsta || (o.type === 'prozor' ? 'prozor' : cls !== 'ext' || segUnh ? 'negrijano' : /(ulaz|hodnik|predsob|vjetrobran)/.test(rn) ? 'ulazna' : 'balkonska');
    const hDef = kind === 'prozor' ? num(D.hProzor, 140) : kind === 'balkonska' ? num(D.hBalk, 220) : num(D.hVrata, 205);
    const h = num(ov.h, null) || o.h || hDef, hEst = !(num(ov.h, null) || o.h);
    const isWin = kind === 'prozor', pDef = isWin ? num(D.pProzor, 90) : 0, par = ov.p != null && ov.p !== '' ? num(ov.p, pDef) : o.p != null ? o.p : pDef, pEst = isWin && ov.p == null && o.p == null;
    const krila = num(ov.krila, 0) || (o.double ? 2 : isWin && o._w >= num(D.dvokrilniOd, 110) ? 2 : 1);
    const rec = { nxs, nys, p: par, pEst, krila, x: horiz ? o._c : face, y: horiz ? face : o._c, key: o.key, kind, w: o._w, h, hEst, A: o._w * h, strana: cls === 'ext' && !segUnh && kind !== 'negrijano' ? st : '—', cls, seg: seg ? seg.n : null, okvir: ov.okvir || D.okvir || '', staklo: ov.staklo || D.staklo || '', roleta: ov.roleta != null ? !!ov.roleta : !!D.roleta, room: roomIn >= 0 ? rooms[roomIn].name : '' };
    if (seg) seg.Aotv = (seg.Aotv || 0) + rec.A;
    ops.push(rec);
  }
  for (const k of E.krovni || []) { const w = num(k.w, 0), h = num(k.h, 0), n = Math.max(1, Math.round(num(k.n, 1))); if (w > 0 && h > 0) ops.push({ key: 'krovni', kind: 'krovni', w, h, n, A: w * h * n, strana: k.strana || '—', cls: 'ext', okvir: k.okvir || D.okvir || '', staklo: k.staklo || D.staklo || '', roleta: !!k.roleta, manual: true }); }
  // retci rezultata (cm² → m² na kraju)
  const rows = [], add = (el, str, A, note) => { if (A > 0.5) rows.push({ el, strana: str || '—', A, note: note || '' }); };
  for (const s of segs) {
    const Aotv = s.Aotv || 0, strOf = el => el === 'zid_vanjski' || el.startsWith('zid_susjed') ? s.strana : '—';
    let Arest = s.A - s.Atlo;
    if (s.part) { add(s.part.el, strOf(s.part.el), s.part.A); Arest -= s.part.A; }
    if (s.Atlo > 0) add('zid_tlo', s.strana, s.Atlo);
    add(s.el, strOf(s.el), Arest - Aotv);
    s.Aneto = Arest - Aotv;
  }
  const Ptlo = segs.filter(s => s.cls === 'ext').reduce((a, s) => a + s.L, 0);
  if (E.ispod && E.ispod !== 'grijano') add('pod_' + E.ispod, '—', AZ, E.ispod === 'tlo' ? 'opseg ' + (Ptlo / 100).toFixed(2).replace('.', ',') + ' m' : '');
  let Vroof = 0, VeSum = 0;
  PARTS.forEach((P2, pi) => { if (!(P2.AZ > 0)) return; const pe = P2.E, A0 = P2.AZ, ks = P2.kosi, tag = PARTS.length > 1 ? P2.name : ''; let Vr = 0;
    if (pe.iznad === 'tavan') add('strop_tavan', '—', A0, tag); else if (pe.iznad === 'ravni') add('krov_ravni', '—', A0, tag); else if (pe.iznad === 'negrijano') add('strop_negrijano', '—', A0, tag);
    else if (ks) { const bx = P2.bbox, a = num(ks.nagib, 35) * Math.PI / 180, ridgeH = (ks.sljeme || 'H') === 'H', Lr = ridgeH ? bx.x1 - bx.x0 : bx.y1 - bx.y0, b = ridgeH ? bx.y1 - bx.y0 : bx.x1 - bx.x0, tg = Math.tan(a), vr = ks.vrsta || 'dvostresni';
      add('krov_kosi', '—', A0 / Math.cos(a), ('nagib ' + num(ks.nagib, 35) + '° ' + tag).trim());
      if (vr === 'dvostresni') { const tri = b * b * tg / 4; const n1 = ridgeH ? [1, 0] : [0, 1]; add('zid_vanjski', strana(n1[0], n1[1], north), tri, 'zabat'); add('zid_vanjski', strana(-n1[0], -n1[1], north), tri, 'zabat'); Vr = Lr * b * b * tg / 4; }
      else if (vr === 'cetverostresni') { Vr = b * b * tg / 4 * Math.max(Lr - b / 3, b * 2 / 3); }
      else { const hs = ks.visa || 'gore', nH = { gore: [0, -1], dolje: [0, 1], lijevo: [-1, 0], desno: [1, 0] }[hs] || [0, -1], span = nH[0] ? bx.x1 - bx.x0 : bx.y1 - bx.y0, len = nH[0] ? bx.y1 - bx.y0 : bx.x1 - bx.x0;
        add('zid_vanjski', strana(nH[0], nH[1], north), len * span * tg, 'viša strana jednostrešnog krova'); const tri = span * span * tg / 2;
        add('zid_vanjski', strana(nH[1] ? 1 : 0, nH[0] ? 1 : 0, north), tri, 'zabat'); add('zid_vanjski', strana(nH[1] ? -1 : 0, nH[0] ? -1 : 0, north), tri, 'zabat'); Vr = len * span * span * tg / 2; } }
    P2.Vroof = Vr; Vroof += Vr; VeSum += A0 * (ks ? P2.Hwall : P2.Hh.Hb) + Vr; });
  for (const r of E.dodatno || []) { const A = num(r.A, 0) * 1e4; if (A > 0 && EL[r.el]) add(r.el, r.strana || '—', A, 'ručno'); }
  const Ak = rooms.filter(r => r.kind === 'grijano').reduce((a, r) => a + r.area, 0), Aall = rooms.reduce((a, r) => a + r.area, 0);
  const Ve = VeSum; /* po dijelovima: potkrovlje do nadzida + prostor pod krovom */
  return { rooms, segs, ops, rows, AZ, Ak, Aall, Ve, Vroof, Hh, Hwall, Ptlo, bbox: { x0, x1, y0, y1 }, parts: PARTS.map((P2, i) => ({ i, name: P2.name, E: P2.E, AZ: P2.AZ, bbox: P2.bbox, Hh: P2.Hh, Hwall: P2.Hwall, kosi: P2.kosi, rooms: i ? P2.rooms : null })), roomPart, Z, T, RI, OWN, grid: g };
}
/* zbroj za cijelu zgradu: po elementu i strani svijeta */
function summarize(floorsRes) {
  const map = new Map(), opMap = new Map(); let Ve = 0, Ak = 0;
  for (const F of floorsRes) {
    Ve += F.res.Ve; Ak += F.res.Ak;
    for (const r of F.res.rows) { const k = r.el + '|' + r.strana; const o = map.get(k) || { el: r.el, strana: r.strana, A: 0, po: {} }; o.A += r.A; o.po[F.name] = (o.po[F.name] || 0) + r.A; map.set(k, o); }
    for (const o of F.res.ops) { const k = o.kind + '|' + o.strana; const q = opMap.get(k) || { kind: o.kind, strana: o.strana, A: 0, n: 0 }; q.A += o.A; q.n += o.n || 1; opMap.set(k, q); }
  }
  const sOrd = s => { const i = STRANE.indexOf(s); return i < 0 ? 9 : i; };
  const rows = [...map.values()].sort((a, b) => EL_ORDER.indexOf(a.el) - EL_ORDER.indexOf(b.el) || sOrd(a.strana) - sOrd(b.strana));
  const ops = [...opMap.values()].sort((a, b) => OPEN_KINDS.findIndex(k => k[0] === a.kind) - OPEN_KINDS.findIndex(k => k[0] === b.kind) || sOrd(a.strana) - sOrd(b.strana));
  const Aenv = rows.reduce((s, r) => s + r.A, 0) + ops.reduce((s, o) => s + o.A, 0);
  return { rows, ops, Ve, Ak, A: Aenv, f0: Ve > 0 ? Aenv / Ve * 100 : 0 }; // f0 u 1/m (A u cm², Ve u cm³ → ×100)
}
root.IzmjeraEnergijaCalc = { extT, kosiFromH, STRANE, ROOM_KINDS, ROOM_NAME, ISPOD, IZNAD, OPEN_KINDS, OPEN_NAME, EL, EL_ORDER, SASTAV_KAT, sastavKat, defaultRoomKind, roomKey, strana, floorHeights, konstrD, calcFloor, summarize, num };
})(typeof window !== 'undefined' ? window : globalThis);
