/* Izmjera 57 — legalizacija: građevinska (bruto) površina (Pravilnik NN 93/17) i obujam (Pravilnik NN 15/19).
   Ulaz su iste etaže, visine i krov kao za pročelja i presjeke, pa iskaz odgovara nacrtu. Mjere u cm. */
(function (root) {
'use strict';
const EC = () => root.IzmjeraEnergijaCalc, PR = () => root.IzmjeraProcelja;
const num = (v, d) => { const n = parseFloat(String(v == null ? '' : v).replace(',', '.')); return Number.isFinite(n) ? n : d; };
function fm(v, d) { d = d == null ? 2 : d; const s = (Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d), p = s.split('.'); return p[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (d ? ',' + p[1] : ''); }
const USE = { st: ['ZATVORENI PROSTOR', 1], gar: ['ZATVORENI PROSTOR – GARAŽA', 0.25], pom: ['ZATVORENI PROSTOR – POMOĆNI', 0.5] };
const defUse = n => /gara[žz]/i.test(n || '') ? 'gar' : /sprem|ostav|kotlov|praon|tehni|drvarn|radion|podrum/i.test(n || '') ? 'pom' : 'st';
const natOf = n => /balkon|teras/i.test(n || '') && !/natkriv/i.test(n || '') ? false : true;
const upName = s => String(s || '').toUpperCase();

/* --- geometrija: konveksni poligon ∩ poluravnina a·x + b·y + c ≥ 0 --- */
function clip(P, a, b, c) { const out = [], v = p => a * p.x + b * p.y + c; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length], vp = v(p), vq = v(q); if (vp >= 0) out.push(p); if ((vp >= 0) !== (vq >= 0)) { const t = vp / (vp - vq); out.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t }); } } return out; }
function area(P) { let s = 0; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; s += p.x * q.y - q.x * p.y; } return Math.abs(s) / 2; }
function cent(P) { let s = 0, x = 0, y = 0; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length], k = p.x * q.y - q.x * p.y; s += k; x += (p.x + q.x) * k; y += (p.y + q.y) * k; } if (Math.abs(s) < 1e-9) return P.reduce((m, p) => ({ x: m.x + p.x / P.length, y: m.y + p.y / P.length }), { x: 0, y: 0 }); return { x: x / (3 * s), y: y / (3 * s) }; }
const rectP = (x0, y0, x1, y1) => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];

/* krov iznad dijela etaže: visina unutarnje plohe krova od zadanog poda = min linearnih funkcija (h = a·x + b·y + c) */
function roofLins(pt, bb, z0, heated) {
  const k = pt.kosi || {}, al = num(k.nagib, 35) * Math.PI / 180, tg = Math.tan(al), lin = PR().roofBuild(k, heated).sDn / Math.cos(al), H0 = pt.zTop - lin - z0, vr = k.vrsta || 'dvostresni', L = [];
  const add = (a, b, c) => L.push({ a: a * tg, b: b * tg, c: H0 + c * tg });
  if (vr === 'cetverostresni') { add(1, 0, -bb.x0); add(-1, 0, bb.x1); add(0, 1, -bb.y0); add(0, -1, bb.y1); }
  else if (vr === 'jednostresni') { const v = k.visa || 'gore'; if (v === 'gore') add(0, -1, bb.y1); else if (v === 'dolje') add(0, 1, -bb.y0); else if (v === 'lijevo') add(-1, 0, bb.x1); else add(1, 0, -bb.x0); }
  else if ((k.sljeme || 'H') === 'H') { add(0, 1, -bb.y0); add(0, -1, bb.y1); } else { add(1, 0, -bb.x0); add(-1, 0, bb.x1); }
  return L;
}
/* dio poligona gdje je visina ≥ T: površina, ∫visina, crte granice (h = T) */
function underRoof(P, lins, T) { let A = 0, V = 0; const pcs = [], cuts = [];
  lins.forEach((l, i) => { let Q = P; lins.forEach((m, j) => { if (j !== i && Q.length >= 3) Q = clip(Q, m.a - l.a, m.b - l.b, m.c - l.c); }); if (Q.length >= 3) Q = clip(Q, l.a, l.b, l.c - T); if (Q.length < 3) return; const a = area(Q); if (a < 1e-6) return; const g = cent(Q);
    A += a; V += a * (l.a * g.x + l.b * g.y + l.c); pcs.push(Q);
    for (let e = 0; e < Q.length; e++) { const p = Q[e], q = Q[(e + 1) % Q.length], hv = r => l.a * r.x + l.b * r.y + l.c - T; if (Math.abs(hv(p)) < 0.01 && Math.abs(hv(q)) < 0.01 && Math.hypot(q.x - p.x, q.y - p.y) > 0.5) cuts.push([p, q]); } });
  return { A, V, pcs, cuts }; }

/* --- proračun ---
   inc: [{ i, name, E, res (calcFloor allHeated), out }] odozdo prema gore; PL: postavke legalizacije projekta */
function compute(inc, PL) {
  PL = PL || {}; const Ls = PR().prepareFloors(inc), FL = [];
  inc.forEach((F, k) => {
    const r = F.res, L = Ls[k], g = r.grid, { xs, ys, nx, ny } = g, T = r.T, Z = r.Z, OWN = r.OWN, lg = (F.E && F.E.leg) || {}, lvl = (F.E && F.E.roomLvl) || {};
    const pod75 = lg.pod75 != null ? !!lg.pod75 : (F.E.ispod === 'tlo' && /podrum|suteren/i.test(F.name || ''));
    const fl = { name: F.name, NAME: upName(F.name), i: F.i, pod75, zf: L.zf, gbp: { st: 0, gar: 0, pom: 0, h2: 0 }, volH: [], roof: null, open: [], cellsG: [], cellsV: [], piecesG: [], piecesV: [], cutsG: [], cutsV: [], bb: r.bbox, rooms: [] };
    const hG = new Map(), roofAcc = { A: 0, V: 0, A0: 0 }, labG = new Int8Array(nx * ny).fill(-1), labV = new Int8Array(nx * ny).fill(-1), CODE = { st: 0, gar: 1, pom: 2, h2: 3, roof: 4 };
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) { const c = i * ny + j; if (!Z[c]) continue;
      const rm = OWN[c] >= 0 ? OWN[c] : T[c] >= 0 ? T[c] : -1, ro = rm >= 0 ? r.rooms[rm] : null, pi = rm >= 0 && r.roomPart ? (r.roomPart[rm] || 0) : 0, rp = (r.parts && r.parts[pi]) || r.parts[0], pt = L.parts[pi] || L.parts[0], Hh = EC().floorHeights((rp && rp.E) || F.E || {});
      const P = rectP(xs[i], ys[j], xs[i + 1], ys[j + 1]), a = (xs[i + 1] - xs[i]) * (ys[j + 1] - ys[j]);
      if (pt.up === 'kosi' || pt.open) { /* potkrovlje bez stropa: visine iz krova */
        const lins = roofLins(pt, (rp && rp.bbox) || r.bbox, L.zf, pt.up === 'kosi' /* v2.71: kao u presjeku – otvoreno krovište (bez stropa) nema gips-karton ispod rogova */), V = underRoof(P, lins, 119.5); let G = underRoof(P, lins, 199.5);
        /* v2.71: zid (ćelija bez prostorije) ulazi u GBP cijeli ako je uz unutarnje lice zida svijetla visina ≥ 2,0 m – granica 2,0 m ne ide kroz zid */
        if (T[c] < 0 && G.A < a - 1e-6) { const hAt = q => Math.min(...lins.map(l => l.a * q.x + l.b * q.y + l.c)); if (Math.max(...P.map(hAt)) >= 199.5) G = { A: a, V: 0, pcs: [P], cuts: [] }; }
        if (!fl.secRoof) fl.secRoof = { lins, bb: (rp && rp.bbox) || r.bbox, sl: ((pt.kosi || {}).sljeme || 'H'), vr: (pt.kosi || {}).vrsta || 'dvostresni', T, g };
        fl.gbp.st += G.A; fl.gbp.h2 += a - G.A; roofAcc.A += V.A; roofAcc.V += V.V; roofAcc.A0 += a; labG[c] = labV[c] = CODE.roof;
        fl.piecesG.push(...G.pcs.map(q => ({ poly: q, z: 'st' }))); if (G.A < a - 1) fl.cutsG.push(...G.cuts); /* granica 2,0 m samo gdje stvarno dijeli ćeliju */ fl.piecesV.push(...V.pcs.map(q => ({ poly: q, z: 'v' }))); if (V.A < a - 1) fl.cutsV.push(...V.cuts); continue; }
      const hr = ro ? num((lvl[ro.key] || {}).h, ro.h || 0) : 0, use = ro ? (((lg.use || {})[ro.key]) || defUse(ro.name)) : 'st';
      const zg = hr > 0 && hr < 200 ? 'h2' : pod75 ? use : 'st'; fl.gbp[zg] += a; labG[c] = CODE[zg]; labV[c] = 0;
      const H = pt.up === 'ravni' ? Hh.h : Hh.h + Hh.dIznad, kH = Math.round(H * 10) / 10; hG.set(kH, (hG.get(kH) || 0) + a); }
    fl.volH = [...hG.entries()].map(([H, A]) => ({ H, A })).sort((a, b) => b.A - a.A);
    if (roofAcc.A0 > 0) fl.roof = { A: roofAcc.A, V: roofAcc.V, hs: roofAcc.A > 0 ? roofAcc.V / roofAcc.A : 0, Aall: roofAcc.A0 };
    fl.labG = labG; fl.labV = labV; fl.grid = g;
    /* otvoreni dijelovi: prostorije „vanjski prostor” i blokovi terasa/balkon/lođa/nadstrešnica */
    r.rooms.forEach((ro, t) => { if (ro.kind !== 'vanjski') return; const pcs = []; let A = 0; for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) if (T[i * ny + j] === t && !Z[i * ny + j]) { pcs.push(rectP(xs[i], ys[j], xs[i + 1], ys[j + 1])); A += (xs[i + 1] - xs[i]) * (ys[j + 1] - ys[j]); }
      if (A > 0) { const key = 'r:' + ro.key, nat = (lg.nat || {})[key] != null ? !!lg.nat[key] : natOf(ro.name || 'Lođa'); fl.open.push({ key, name: ro.name || 'Lođa', A, nat, pcs, nad: false }); } });
    ((F.out && F.out.terase) || []).forEach((tb, n) => { const key = 't:' + (tb.id || n), nm = tb.naziv || 'Terasa', nat = (lg.nat || {})[key] != null ? !!lg.nat[key] : natOf(nm); fl.open.push({ key, name: nm, A: tb.A, nat, pcs: tb.polys, nad: /nadstre/i.test(nm) }); });
    fl.open.forEach(o => { o.Av = !o.nat ? 0 : o.nad ? Math.max(0, o.A - 60000) : o.A; });
    fl.G = fl.gbp.st + fl.gbp.gar * 0.25 + fl.gbp.pom * 0.5;
    fl.V = fl.volH.reduce((s, q) => s + q.A * q.H, 0) + (fl.roof ? fl.roof.V : 0) + fl.open.reduce((s, o) => s + o.Av * 100, 0);
    FL.push(fl);
    /* tavan (negrijani prostor pod krovom iznad stropa) – zatvoreni dio zgrade */
    if (L.parts.some(pt => pt.up === 'tavan' && !pt.open && pt.kosi) && PL.tavan !== false) {
      const tv = { name: (F.name || '') + ' – tavan', NAME: 'TAVAN', tavan: true, i: F.i, gbp: { st: 0, gar: 0, pom: 0, h2: 0 }, volH: [], roof: null, open: [], piecesG: [], piecesV: [], cutsG: [], cutsV: [], bb: r.bbox, grid: g, labG: new Int8Array(nx * ny).fill(-1), labV: new Int8Array(nx * ny).fill(-1) };
      const acc = { A: 0, V: 0, A0: 0 };
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) { const c = i * ny + j; if (!Z[c]) continue; const rm = OWN[c] >= 0 ? OWN[c] : T[c], pi = rm >= 0 && r.roomPart ? (r.roomPart[rm] || 0) : 0, rp = (r.parts && r.parts[pi]) || r.parts[0], pt = L.parts[pi] || L.parts[0], Hh = EC().floorHeights((rp && rp.E) || F.E || {}); if (!(pt.up === 'tavan' && pt.kosi)) continue;
        const P = rectP(xs[i], ys[j], xs[i + 1], ys[j + 1]), a = (xs[i + 1] - xs[i]) * (ys[j + 1] - ys[j]), lins = roofLins(pt, (rp && rp.bbox) || r.bbox, L.zf + Hh.h + Hh.dIznad, false), G = underRoof(P, lins, 199.5), V = underRoof(P, lins, 119.5);
        if (!tv.secRoof) { tv.secRoof = { lins, bb: (rp && rp.bbox) || r.bbox, sl: ((pt.kosi || {}).sljeme || 'H'), vr: (pt.kosi || {}).vrsta || 'dvostresni', T, g, slab: true }; tv.zf = L.zf + Hh.h + Hh.dIznad; }
        if (PL.tavanGbp !== false) { tv.gbp.st += G.A; tv.gbp.h2 += a - G.A; tv.piecesG.push(...G.pcs.map(q => ({ poly: q, z: 'st' }))); tv.cutsG.push(...G.cuts); } else tv.gbp.h2 += a;
        acc.A += V.A; acc.V += V.V; acc.A0 += a; tv.labG[c] = tv.labV[c] = 4; tv.piecesV.push(...V.pcs.map(q => ({ poly: q, z: 'v' }))); tv.cutsV.push(...V.cuts); }
      if (acc.A0 > 0) { tv.roof = { A: acc.A, V: acc.V, hs: acc.A > 0 ? acc.V / acc.A : 0, Aall: acc.A0 }; tv.G = tv.gbp.st; tv.V = acc.V; FL.push(tv); } }
  });
  const G = FL.reduce((s, f) => s + f.G, 0), V = FL.reduce((s, f) => s + f.V, 0);
  return { floors: FL, G, V, Ls };
}
/* v2.72: obujam pod krovom zapisan kao A × h(uz vanjsko lice zida) + A × Δh/2 (kao ručni iskaz) */
function eaveH(f) { const S = f.secRoof; if (!S || !f.roof) return null; const bb = S.bb, hAt = q => Math.min(...S.lins.map(l => l.a * q.x + l.b * q.y + l.c));
  let he = Math.min(hAt({ x: bb.x0, y: bb.y0 }), hAt({ x: bb.x1, y: bb.y0 }), hAt({ x: bb.x0, y: bb.y1 }), hAt({ x: bb.x1, y: bb.y1 })); if (f.roof.Aall - f.roof.A > 100) he = Math.max(he, 120);
  he = Math.round(he) ; const dh = Math.round(2 * (f.roof.hs - he)); return dh > 0 ? { he, dh } : null; }
/* --- tekstovi (formule) --- */
const m2 = a => a / 1e4, nm = f => f.NAME.toLowerCase();
function gbpTerms(f) { const t = []; if (f.gbp.st > 1) t.push(fm(m2(f.gbp.st))); if (f.gbp.gar > 1) t.push(fm(m2(f.gbp.gar)) + ' × 0,25'); if (f.gbp.pom > 1) t.push(fm(m2(f.gbp.pom)) + ' × 0,50'); return t; }
function gbpLine(f) { const t = gbpTerms(f); return 'GBP ukupno: ' + nm(f) + ' = ' + (t.length ? t.join(' + ') + (t.length > 1 || /×/.test(t[0]) ? ' = ' + fm(m2(f.G)) : '') : '0,00') + ' m²'; }
function volTermsV(f) { const t = []; for (const q of f.volH) t.push([fm(m2(q.A)) + ' × ' + fm(q.H / 100), q.A * q.H]);
  if (f.roof && f.roof.A > 0) { const e = eaveH(f); if (e) { const A = Math.round(m2(f.roof.A) * 100) / 100, v1 = A * e.he / 100, v2 = f.roof.V / 1e6 - v1; t.push([fm(A) + ' × ' + fm(e.he / 100), v1 * 1e6]); t.push([fm(A) + ' × ' + fm(e.dh / 100) + '/2', v2 * 1e6]); } else t.push([fm(m2(f.roof.A)) + ' × ' + fm(f.roof.hs / 100), f.roof.V]); }
  for (const o of f.open) if (o.Av > 0) t.push([fm(m2(o.Av)) + ' × 1,00', o.Av * 100]); return t; }
function volTerms(f) { return volTermsV(f).map(x => x[0]); }
function volLine(f) { const t = volTermsV(f); if (!t.length) return 'OBUJAM ukupno: ' + nm(f) + ' = 0,00 m³';
  return 'OBUJAM ukupno: ' + nm(f) + ' = ' + t.map(x => x[0]).join(' + ') + ' = ' + (t.length > 1 ? t.map(x => fm(x[1] / 1e6)).join(' + ') + ' = ' : '') + fm(f.V / 1e6) + ' m³'; }
function notes(f, kind) { const n = []; if (kind === 'g') { if (f.gbp.h2 > 100) n.push('dio svijetle visine manje od 2,0 m (' + fm(m2(f.gbp.h2)) + ' m²) ne ulazi u GBP'); if (f.open.length) n.push('otvoreni dijelovi (' + f.open.map(o => o.name.toLowerCase()).join(', ') + ') ne ulaze u GBP'); if (f.pod75) n.push('etaža je 75 % ili više ispod terena'); }
  else { if (f.roof && f.roof.Aall - f.roof.A > 100) n.push('pod krovom: prosječna visina ' + fm(f.roof.hs / 100) + ' m; dio niži od 1,2 m (' + fm(m2(f.roof.Aall - f.roof.A)) + ' m²) ne ulazi u obujam'); for (const o of f.open) n.push(o.name + ' ' + (o.nat ? (o.nad ? 'natkriveno – računa se iznad 6 m²' : 'natkriveno – do 1,0 m visine') : 'nenatkriveno – ne računa se')); }
  return n; }
function opisText(R) { const g = R.floors.filter(f => f.G > 0 || !f.tavan), pad = s => s + ':';
  let t = 'Građevinska bruto površina i obujam zgrade izračunati su u skladu s Pravilnikom o načinu izračuna građevinske (bruto) površine zgrade (NN 93/17) i Pravilnikom o načinu utvrđivanja obujma i površine građevina u svrhu obračuna komunalnog doprinosa (NN 15/19).\n\nGrađevinska bruto površina:\n';
  for (const f of g) t += '\t' + pad(nm(f)) + '\t' + fm(m2(f.G)) + ' m²\n'; t += '\tukupno:\t' + fm(m2(R.G)) + ' m²\n\nObujam zgrade:\n';
  for (const f of R.floors) t += '\t' + pad(nm(f)) + '\t' + fm(f.V / 1e6) + ' m³\n'; t += '\tukupno:\t' + fm(R.V / 1e6) + ' m³\n'; return t; }

/* --- crtež skice: rubovi između različitih zona na rasteru + komadi pod krovom --- */
function sketch(f, kind) { const g = f.grid, { xs, ys, nx, ny } = g, lab = kind === 'g' ? f.labG : f.labV, E = [];
  const L = (i, j) => (i < 0 || j < 0 || i >= nx || j >= ny) ? -1 : lab[i * ny + j];
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) { const a = L(i, j); if (a < 0) continue;
    const b1 = L(i + 1, j), b2 = L(i, j + 1), b3 = L(i - 1, j), b4 = L(i, j - 1);
    if (b1 !== a) E.push({ a: { x: xs[i + 1], y: ys[j] }, b: { x: xs[i + 1], y: ys[j + 1] }, out: b1 < 0 }); if (b2 !== a) E.push({ a: { x: xs[i], y: ys[j + 1] }, b: { x: xs[i + 1], y: ys[j + 1] }, out: b2 < 0 });
    if (b3 < 0) E.push({ a: { x: xs[i], y: ys[j] }, b: { x: xs[i], y: ys[j + 1] }, out: true }); if (b4 < 0) E.push({ a: { x: xs[i], y: ys[j] }, b: { x: xs[i + 1], y: ys[j] }, out: true }); }
  /* spoji kolinearne susjedne rubove */
  const key = p => Math.round(p.x * 10) + ',' + Math.round(p.y * 10), merged = [], used = new Set();
  const byEnd = new Map(); E.forEach((e, n) => { for (const p of [e.a, e.b]) { const k = key(p); (byEnd.get(k) || byEnd.set(k, []).get(k)).push(n); } });
  E.forEach((e, n) => { if (used.has(n)) return; used.add(n); let a = e.a, b = e.b; const hor = Math.abs(a.y - b.y) < 0.01;
    const grow = (end, other) => { for (;;) { const cand = (byEnd.get(key(end)) || []).find(m => !used.has(m) && E[m].out === e.out && (Math.abs(E[m].a.y - E[m].b.y) < 0.01) === hor); if (cand == null) return end; used.add(cand); const q = E[cand]; end = key(q.a) === key(end) ? q.b : q.a; } };
    b = grow(b); a = grow(a); merged.push({ a, b, out: e.out }); });
  const zones = {}; const addZ = (z, poly) => { const A = area(poly), c = cent(poly), o = zones[z] || (zones[z] = { A: 0, x: 0, y: 0, polys: [] }); o.A += A; o.x += c.x * A; o.y += c.y * A; o.polys.push(poly); };
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) { const a = lab[i * ny + j]; if (a < 0 || a === 4) continue; const z = kind === 'g' ? ['st', 'gar', 'pom', 'h2'][a] : 'v'; addZ(z, rectP(xs[i], ys[j], xs[i + 1], ys[j + 1])); }
  for (const p of kind === 'g' ? f.piecesG : f.piecesV) addZ(p.z === 'v' ? 'v' : p.z, p.poly);
  if (kind === 'g') { for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) if (lab[i * ny + j] === 4) { /* dio < 2 m pod krovom – za šrafuru: cijela ćelija, komadi ≥ 2 m se crtaju preko */ addZ('h2r', rectP(xs[i], ys[j], xs[i + 1], ys[j + 1])); } }
  else { for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) if (lab[i * ny + j] === 4) addZ('v12', rectP(xs[i], ys[j], xs[i + 1], ys[j + 1])); }
  for (const z in zones) { const o = zones[z]; if (o.A > 0) { o.x /= o.A; o.y /= o.A; } }
  return { edges: merged, cuts: kind === 'g' ? f.cutsG : f.cutsV, zones, open: f.open }; }
function zoneLabel(z, o, f, kind) { const A = m2(o.A);
  if (kind === 'v') return z === 'v' ? [f.tavan ? 'TAVAN h ≥ 1,2 m' : 'ZATVORENI PROSTOR', 'P=' + fm(((f.roof ? f.roof.A : 0) + f.volH.reduce((s, q) => s + q.A, 0)) / 1e4) + ' m²'] : null;
  if (z === 'st') return [f.tavan ? 'TAVAN h ≥ 2,0 m' : 'ZATVORENI PROSTOR', 'P=' + fm(m2(f.gbp.st)) + ' m²'];
  if (z === 'gar') return ['ZATVORENI PROSTOR – GARAŽA', 'P=' + fm(A) + ' m² × k=0,25 = ' + fm(A * 0.25) + ' m²'];
  if (z === 'pom') return ['ZATVORENI PROSTOR – POMOĆNI', 'P=' + fm(A) + ' m² × k=0,50 = ' + fm(A * 0.5) + ' m²'];
  if (z === 'h2') return ['ZATVORENI PROSTOR h<2m', ''];
  if (z === 'h2r') return null;
  return null; }

/* --- v2.72: skica presjeka za list obujma – visine iz formule (u = vodoravno uzduž presjeka, z = visina, cm) --- */
function section(R) { const FL = R.floors, out = { lines: [], dash: [], chain: [], wd: [], tx: [], u0: Infinity, u1: -Infinity, z0: Infinity, z1: -Infinity };
  const ext = (u, z) => { out.u0 = Math.min(out.u0, u); out.u1 = Math.max(out.u1, u); out.z0 = Math.min(out.z0, z); out.z1 = Math.max(out.z1, z); };
  const ln = (a, b, d) => { (d ? out.dash : out.lines).push([a, b]); ext(a.u, a.z); ext(b.u, b.z); };
  const ref = FL.find(f => f.secRoof), ax = ref && ref.secRoof.sl === 'V' ? 'x' : 'y';
  FL.forEach(f => { if (!f.bb) return; const bb = f.bb, u0 = ax === 'y' ? bb.y0 : bb.x0, u1 = ax === 'y' ? bb.y1 : bb.x1, z = f.zf || 0;
    if (f.secRoof) { const S = f.secRoof, cO = ax === 'y' ? (bb.x0 + bb.x1) / 2 : (bb.y0 + bb.y1) / 2, pt = u => ax === 'y' ? { x: cO, y: u } : { x: u, y: cO }, h = u => Math.min(...S.lins.map(l => l.a * pt(u).x + l.b * pt(u).y + l.c));
      const N = 60, P = []; for (let i = 0; i <= N; i++) { const u = u0 + (u1 - u0) * i / N; P.push({ u, z: z + h(u) }); }
      let um = P[0]; for (const q of P) if (q.z > um.z) um = q;
      const brk = [P[0]]; for (let i = 1; i < N; i++) { const d1 = P[i].z - P[i - 1].z, d2 = P[i + 1].z - P[i].z; if (Math.abs(d1 - d2) > 0.01) brk.push(P[i]); } brk.push(P[N]);
      ln({ u: u0, z }, { u: u1, z }); ln({ u: u0, z }, P[0]); ln({ u: u1, z }, P[N]); for (let i = 0; i < brk.length - 1; i++) ln(brk[i], brk[i + 1]);
      const e = eaveH(f), he = e ? e.he : Math.round(h(u0)), hr = e ? e.he + e.dh : Math.round(um.z - z);
      ln({ u: u0, z: z + he }, { u: u1, z: z + he }, true);
      const in12 = P.filter(q => q.z - z >= 120); if (in12.length > 1 && in12.length < P.length) { const a = in12[0], b = in12[in12.length - 1]; ln({ u: a.u, z: z + 120 }, { u: b.u, z: z + 120 }, true); out.tx.push({ u: (a.u + b.u) / 2, z: z + 120, t: 'h = 1,20 m', dy: 1 }); }
      out.chain.push({ a: { u: u0, z }, b: { u: u0, z: z + he }, t: String(he) }, { a: { u: u0, z: z + he }, b: { u: um.u, z: z + hr }, t: String(hr - he) });
      out.wd.push({ u0, u1, z }); out.tx.push({ u: (u0 + u1) / 2, z, t: f.NAME, dy: -2 }); }
    else if (f.volH.length) { const H = f.volH[0].H; ln({ u: u0, z }, { u: u1, z }); ln({ u: u0, z }, { u: u0, z: z + H }); ln({ u: u1, z }, { u: u1, z: z + H }); ln({ u: u0, z: z + H }, { u: u1, z: z + H });
      out.chain.push({ a: { u: u0, z }, b: { u: u0, z: z + H }, t: String(Math.round(H)) }); out.tx.push({ u: (u0 + u1) / 2, z: z + H / 2, t: f.NAME, dy: 0 }); } });
  return isFinite(out.u0) ? out : null; }

/* --- v2.72: listovi u stilu nacrta Projekt 57 (okvir, sastavnica, kote s crticom); isti list ide u PDF i DXF --- */
function sheets(R, meta) {
  meta = meta || {}; const SA = root.IzmjeraSastavnica, FL = R.floors, SEC = section(R), res = [];
  const gr = (meta.gradjevina || '').trim(), top = (gr ? gr.toUpperCase() + ' - ' : '') + 'IZVEDENO STANJE';
  const pages = [['g', 'GRAĐEVINSKA BRUTO POVRŠINA', 'Pravilnik o načinu izračuna građevinske (bruto) površine zgrade (NN 93/17)', 'UKUPNO GRAĐEVINSKA BRUTO POVRŠINA (GBP) = ' + FL.filter(x => x.G > 0).map(x => fm(m2(x.G))).join(' + ') + (FL.filter(x => x.G > 0).length > 1 ? ' = ' + fm(m2(R.G)) : '') + ' m²', 'ISKAZ POVRŠINA I OBRAČUNSKE VELIČINE ZGRADE - GBP', meta.listG || '05'],
    ['v', 'OBUJAM ZGRADE', 'Pravilnik o načinu uređivanja obujma građevine za obračun komunalnog doprinosa (NN 15/19)', 'UKUPNO OBUJAM ZGRADE = ' + FL.map(x => fm(x.V / 1e6)).join(' + ') + (FL.length > 1 ? ' = ' + fm(R.V / 1e6) : '') + ' m³', 'ISKAZ POVRŠINA I OBRAČUNSKE VELIČINE ZGRADE - OBUJAM ZGRADE', meta.listV || '06']];
  let mx = 0, my = 0; FL.forEach(fl => { mx = Math.max(mx, fl.bb.x1 - fl.bb.x0); my = Math.max(my, fl.bb.y1 - fl.bb.y0); });
  pages.forEach(([kind, title, prav, total, sadrzaj, list]) => {
    const S = new SA.Sheet(), nCell = FL.length + (kind === 'v' && SEC ? 1 : 0), cols = nCell > 4 ? 3 : nCell > 1 ? 2 : 1, rowsN = Math.ceil(nCell / cols) || 1;
    const A = { x0: SA.IN.x0, y0: SA.IN.y0 + 42, x1: SA.IN.x1, y1: SA.IN.y0 + 271 }, cw = (A.x1 - A.x0) / Math.max(2, cols), ch = (A.y1 - A.y0) / rowsN;
    let sx = mx, sy = my; if (kind === 'v' && SEC) { sx = Math.max(sx, SEC.u1 - SEC.u0); sy = Math.max(sy, SEC.z1 - SEC.z0); }
    const sc = [50, 100, 200, 250, 500].find(s => (sx * 10 / s) + 30 <= cw && (sy * 10 / s) + 48 <= ch) || 500, k = 10 / sc; S.sc = sc;
    const cell = n => { const col = n % cols, row = Math.floor(n / cols); return { x0: A.x0 + col * cw, y1: A.y1 - row * ch }; };
    FL.forEach((fl, n) => { const C0 = cell(n), Sk = sketch(fl, kind), bb = fl.bb, bw = bb.x1 - bb.x0;
      const ox = C0.x0 + cw / 2 - (bb.x0 + bw / 2) * k, oy = C0.y1 - 22, X = x => ox + x * k, Y = y => oy - (y - bb.y0) * k, Pp = p => [X(p.x), Y(p.y)];
      S.T(C0.x0 + 6, C0.y1 - 6, 2.0, 'skica tlocrta: ' + fl.NAME, { i: 1, lay: 'LEG_TEKST' });
      for (const z of Object.keys(Sk.zones).sort((a, b) => (/h2r|v12/.test(b) ? 1 : 0) - (/h2r|v12/.test(a) ? 1 : 0))) { const o = Sk.zones[z], g0 = z === 'st' || z === 'v' ? 0.93 : z === 'gar' || z === 'pom' ? 0.85 : /h2|v12/.test(z) ? 0.98 : null; if (g0 == null) continue; for (const p of o.polys) S.F(p.map(Pp), g0); }
      for (const p of kind === 'g' ? fl.piecesG : fl.piecesV) S.F(p.poly.map(Pp), 0.93);
      for (const o of Sk.open) { for (const p of o.pcs) { S.F(p.map(Pp), o.nat ? 0.96 : 1); for (let i = 0; i < p.length; i++) S.L(Pp(p[i]), Pp(p[(i + 1) % p.length]), 0.18, { dash: 1, lay: 'LEG_OTVORENO' }); } }
      for (const e of Sk.edges) S.L(Pp(e.a), Pp(e.b), e.out ? 0.5 : 0.18, { lay: e.out ? 'LEG_OBRIS' : 'LEG_GRANICE' });
      for (const [a, b] of Sk.cuts) S.L(Pp(a), Pp(b), 0.25, { dash: 1, lay: 'LEG_GRANICA_VISINE' });
      if (kind === 'g') for (const z of ['gar', 'pom', 'h2']) for (const p of (Sk.zones[z] || { polys: [] }).polys) hatchPoly(p, 25).forEach(([a, b]) => S.L(Pp(a), Pp(b), 0.13, { lay: 'LEG_SRAFURA' }));
      S.dim([X(bb.x0), Y(bb.y0)], [X(bb.x1), Y(bb.y0)], 7, String(Math.round(bw))); S.dim([X(bb.x0), Y(bb.y1)], [X(bb.x0), Y(bb.y0)], 7, String(Math.round(bb.y1 - bb.y0)));
      for (const z in Sk.zones) { const o = Sk.zones[z], lb = zoneLabel(z, o, fl, kind); if (!lb || o.A < 2000) continue; if (kind === 'v' && z !== 'v') continue; S.T(X(o.x), Y(o.y) + 0.8, 1.6, lb[0], { al: 'c', lay: 'LEG_TEKST' }); if (lb[1]) S.T(X(o.x), Y(o.y) - 2.4, 1.6, lb[1], { al: 'c', lay: 'LEG_TEKST' }); if (kind === 'v') break; }
      for (const o of Sk.open) { if (!o.pcs.length) continue; const cc = cent(o.pcs.reduce((m, p) => p.length > m.length ? p : m, o.pcs[0])); S.T(X(cc.x), Y(cc.y) + 0.8, 1.4, 'OTVORENI PROSTOR', { al: 'c', lay: 'LEG_TEKST' }).T(X(cc.x), Y(cc.y) - 1.4, 1.4, (o.nat ? 'NATKRIVENO' : 'NENATKRIVENO') + (kind === 'v' && o.nat ? ' P=' + fm(m2(o.A)) + ' m²' : ''), { al: 'c', lay: 'LEG_TEKST' }); }
      let fy = Y(bb.y1) - 7; const parts = SA.wrap(kind === 'g' ? gbpLine(fl) : volLine(fl), 2.5, cw - 10);
      parts.forEach((t, i) => S.T(C0.x0 + cw / 2, fy - i * 4.2, 2.5, (i ? '= ' : '') + t.replace(/^= /, ''), { al: 'c', lay: 'LEG_TEKST' })); fy -= parts.length * 4.2 + 0.5;
      for (const nt of notes(fl, kind)) { S.T(C0.x0 + cw / 2, fy, 1.8, '– ' + nt, { al: 'c', lay: 'LEG_TEKST' }); fy -= 3; } });
    if (kind === 'v' && SEC) { const C0 = cell(FL.length), Q = SEC, ox = C0.x0 + cw / 2 - ((Q.u0 + Q.u1) / 2) * k, oy = C0.y1 - 22 - (Q.z1 - Q.z0) * k, X = u => ox + u * k, Y = z => oy + (z - Q.z0) * k, Pq = p => [X(p.u), Y(p.z)];
      S.T(C0.x0 + 6, C0.y1 - 6, 2.0, 'skica presjeka', { i: 1, lay: 'LEG_TEKST' });
      for (const [a, b] of Q.lines) S.L(Pq(a), Pq(b), 0.5, { lay: 'LEG_OBRIS' }); for (const [a, b] of Q.dash) S.L(Pq(a), Pq(b), 0.18, { dash: 1, lay: 'LEG_GRANICA_VISINE' });
      const xd = X(Q.u0) - 7; for (const c of Q.chain) { const A0 = Pq(c.a), B0 = Pq(c.b); for (const P0 of [A0, B0]) S.L([P0[0] - 0.8, P0[1]], [xd - 0.8, P0[1]], 0.13, { lay: 'KOTE' }); S.dim([xd, A0[1]], [xd, B0[1]], 0, c.t, { noExtA: 1, noExtB: 1 }); }
      for (const w of Q.wd) S.dim([X(w.u1), Y(w.z)], [X(w.u0), Y(w.z)], 6, String(Math.round(w.u1 - w.u0)));
      for (const t of Q.tx) S.T(X(t.u), Y(t.z) + (t.dy > 0 ? 0.8 : t.dy < 0 ? -12 : 0), 1.8, t.t, { al: 'c', lay: 'LEG_TEKST' }); }
    SA.frame(S, { top, band: { title, sub: prav, total }, sast: Object.assign(SA.fromInfo({ gradjevina: gr.toUpperCase() }), meta.sast || {}, { sadrzaj, mjerilo: '1:' + sc, list }) });
    res.push(S); });
  return res;
}
function toPdf(R, meta) { return root.IzmjeraSastavnica.toPdf(sheets(R, meta)); }
function toDxf(R, meta) { return root.IzmjeraSastavnica.toDxf(sheets(R, meta)); }
function hatchPoly(P, sp) { const out = [], xs = P.map(p => p.x + p.y), lo = Math.min(...xs), hi = Math.max(...xs); for (let s = Math.ceil(lo / sp) * sp; s < hi; s += sp) { /* crta x + y = s */ const pts = []; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length], va = a.x + a.y - s, vb = b.x + b.y - s; if ((va <= 0) !== (vb <= 0)) { const t = va / (va - vb); pts.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }); } } if (pts.length >= 2) out.push([pts[0], pts[1]]); } return out; }

root.IzmjeraLegalizacija = { compute, toPdf, toDxf, opisText, gbpLine, volLine, notes, fm, USE, defUse, natOf };
})(typeof window !== 'undefined' ? window : globalThis);
