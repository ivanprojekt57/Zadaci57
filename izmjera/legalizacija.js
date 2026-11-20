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
        const lins = roofLins(pt, (rp && rp.bbox) || r.bbox, L.zf, true), G = underRoof(P, lins, 200), V = underRoof(P, lins, 120);
        fl.gbp.st += G.A; fl.gbp.h2 += a - G.A; roofAcc.A += V.A; roofAcc.V += V.V; roofAcc.A0 += a; labG[c] = labV[c] = CODE.roof;
        fl.piecesG.push(...G.pcs.map(q => ({ poly: q, z: 'st' }))); fl.cutsG.push(...G.cuts); fl.piecesV.push(...V.pcs.map(q => ({ poly: q, z: 'v' }))); fl.cutsV.push(...V.cuts); continue; }
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
        const P = rectP(xs[i], ys[j], xs[i + 1], ys[j + 1]), a = (xs[i + 1] - xs[i]) * (ys[j + 1] - ys[j]), lins = roofLins(pt, (rp && rp.bbox) || r.bbox, L.zf + Hh.h + Hh.dIznad, false), G = underRoof(P, lins, 200), V = underRoof(P, lins, 120);
        if (PL.tavanGbp !== false) { tv.gbp.st += G.A; tv.gbp.h2 += a - G.A; tv.piecesG.push(...G.pcs.map(q => ({ poly: q, z: 'st' }))); tv.cutsG.push(...G.cuts); } else tv.gbp.h2 += a;
        acc.A += V.A; acc.V += V.V; acc.A0 += a; tv.labG[c] = tv.labV[c] = 4; tv.piecesV.push(...V.pcs.map(q => ({ poly: q, z: 'v' }))); tv.cutsV.push(...V.cuts); }
      if (acc.A0 > 0) { tv.roof = { A: acc.A, V: acc.V, hs: acc.A > 0 ? acc.V / acc.A : 0, Aall: acc.A0 }; tv.G = tv.gbp.st; tv.V = acc.V; FL.push(tv); } }
  });
  const G = FL.reduce((s, f) => s + f.G, 0), V = FL.reduce((s, f) => s + f.V, 0);
  return { floors: FL, G, V, Ls };
}
/* --- tekstovi (formule) --- */
const m2 = a => a / 1e4, nm = f => f.NAME.toLowerCase();
function gbpTerms(f) { const t = []; if (f.gbp.st > 1) t.push(fm(m2(f.gbp.st))); if (f.gbp.gar > 1) t.push(fm(m2(f.gbp.gar)) + ' × 0,25'); if (f.gbp.pom > 1) t.push(fm(m2(f.gbp.pom)) + ' × 0,50'); return t; }
function gbpLine(f) { const t = gbpTerms(f); return 'GBP ukupno: ' + nm(f) + ' = ' + (t.length ? t.join(' + ') + (t.length > 1 || /×/.test(t[0]) ? ' = ' + fm(m2(f.G)) : '') : '0,00') + ' m²'; }
function volTerms(f) { const t = []; for (const q of f.volH) t.push(fm(m2(q.A)) + ' × ' + fm(q.H / 100)); if (f.roof && f.roof.A > 0) t.push(fm(m2(f.roof.A)) + ' × ' + fm(f.roof.hs / 100)); for (const o of f.open) if (o.Av > 0) t.push(fm(m2(o.Av)) + ' × 1,00'); return t; }
function volLine(f) { const t = volTerms(f); return 'OBUJAM ukupno: ' + nm(f) + ' = ' + (t.length ? t.join(' + ') + ' = ' + fm(f.V / 1e6) : '0,00') + ' m³'; }
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

/* --- PDF: A3 položeno, list GBP i list obujam; skice svih etaža u istom mjerilu --- */
function toPdf(R, meta) {
  const P = root.IzmjeraPdf, doc = new P.Doc(), f = P.f, W = 1190.55, H = 841.89, cmPt = 72 / 2.54, set = P.settings(), logo = set.logo ? doc.jpeg(set.logo) : null;
  const FL = R.floors, cols = FL.length > 4 ? 3 : 2, rowsN = Math.ceil(FL.length / cols) || 1;
  const pages = [['g', 'GRAĐEVINSKA BRUTO POVRŠINA (GBP)', 'Pravilnik o načinu izračuna građevinske (bruto) površine zgrade (NN 93/17)', 'UKUPNO GRAĐEVINSKA BRUTO POVRŠINA (GBP) = ' + FL.filter(x => x.G > 0).map(x => fm(m2(x.G))).join(' + ') + ' = ' + fm(m2(R.G)) + ' m²'],
    ['v', 'OBUJAM ZGRADE', 'Pravilnik o načinu utvrđivanja obujma i površine građevina u svrhu obračuna komunalnog doprinosa (NN 15/19)', 'UKUPNO OBUJAM ZGRADE = ' + FL.map(x => fm(x.V / 1e6)).join(' + ') + ' = ' + fm(R.V / 1e6) + ' m³']];
  pages.forEach(([kind, title, prav, total], pn) => {
    const hf = P.headerFooter(doc, W, H, { logoImg: logo, project: meta.project, floor: kind === 'g' ? 'Iskaz površina – GBP' : 'Iskaz površina – obujam', title: 'Legalizacija – snimka izvedenog stanja', firma: set.firma, date: P.today(), pageNo: pn + 1, pageCount: 2 });
    let c = hf.content + 'q 0 0 0 RG 0 0 0 rg 1 J 1 j\n'; const L = hf.left, Rr = hf.right, top = hf.top - 8, botBand = hf.bottom + 92, cw = (Rr - L) / cols, ch = (top - botBand) / rowsN;
    let mx = 0, my = 0; FL.forEach(fl => { mx = Math.max(mx, fl.bb.x1 - fl.bb.x0); my = Math.max(my, fl.bb.y1 - fl.bb.y0); });
    const sc = [100, 150, 200, 250, 300, 400, 500].find(s => (mx + 260) * cmPt / s <= cw && (my + 320) * cmPt / s <= ch) || 500, k = cmPt / sc;
    FL.forEach((fl, n) => { const col = n % cols, row = Math.floor(n / cols), x0 = L + col * cw, yTop = top - row * ch, S = sketch(fl, kind), bb = fl.bb, bw = bb.x1 - bb.x0, bh = bb.y1 - bb.y0;
      const ox = x0 + cw / 2 - (bb.x0 + bw / 2) * k, X = p => ox + p.x * k, Y = p => yTop - 52 - (p.y - bb.y0) * k;
      c += P.text('skica tlocrta: ', x0 + 10, yTop - 14, 9) + P.text(fl.NAME, x0 + 10 + P.textW('skica tlocrta: ') * 9, yTop - 14, 9, { bold: true });
      const poly = (pts, op) => pts.map((p, i) => f(X(p)) + ' ' + f(Y(p)) + (i ? ' l' : ' m')).join(' ') + ' h ' + op + '\n';
      /* ispune */
      for (const z of Object.keys(S.zones).sort((a, b) => (/h2r|v12/.test(b) ? 1 : 0) - (/h2r|v12/.test(a) ? 1 : 0))) { const o = S.zones[z], g0 = z === 'st' || z === 'v' ? '0.93' : z === 'gar' || z === 'pom' ? '0.85' : z === 'h2' || z === 'h2r' || z === 'v12' ? '0.98' : null; if (!g0) continue; c += g0 + ' g\n'; for (const p of o.polys) c += poly(p, 'f'); }
      c += '0.93 g\n'; for (const p of kind === 'g' ? fl.piecesG : fl.piecesV) c += poly(p.poly, 'f');
      for (const o of S.open) { c += (o.nat ? '0.96' : '1') + ' g\n'; for (const p of o.pcs) c += poly(p, 'f'); c += '0 g 0.5 w [3 2] 0 d\n'; for (const p of o.pcs) c += poly(p, 'S'); c += '[] 0 d\n'; }
      c += '0 g 0 G\n';
      for (const e of S.edges) c += f(e.out ? 1.1 : 0.5) + ' w ' + f(X(e.a)) + ' ' + f(Y(e.a)) + ' m ' + f(X(e.b)) + ' ' + f(Y(e.b)) + ' l S\n';
      if (S.cuts.length) { c += '0.6 w [4 2] 0 d\n'; for (const [a, b] of S.cuts) c += f(X(a)) + ' ' + f(Y(a)) + ' m ' + f(X(b)) + ' ' + f(Y(b)) + ' l S\n'; c += '[] 0 d\n'; }
      /* kote ukupne širine i visine */
      const dy = Y({ y: bb.y0 }) + 16, dx = X({ x: bb.x0 }) - 16; c += '0.4 w ' + f(X({ x: bb.x0 })) + ' ' + f(dy) + ' m ' + f(X({ x: bb.x1 })) + ' ' + f(dy) + ' l S ' + f(dx) + ' ' + f(Y({ y: bb.y0 })) + ' m ' + f(dx) + ' ' + f(Y({ y: bb.y1 })) + ' l S\n';
      for (const xx of [bb.x0, bb.x1]) c += f(X({ x: xx }) - 3) + ' ' + f(dy - 3) + ' m ' + f(X({ x: xx }) + 3) + ' ' + f(dy + 3) + ' l S\n'; for (const yy of [bb.y0, bb.y1]) c += f(dx - 3) + ' ' + f(Y({ y: yy }) - 3) + ' m ' + f(dx + 3) + ' ' + f(Y({ y: yy }) + 3) + ' l S\n';
      c += P.text(String(Math.round(bw)), (X({ x: bb.x0 }) + X({ x: bb.x1 })) / 2, dy + 3, 7.5, { align: 'c' }) + P.text(String(Math.round(bh)), dx - 3, (Y({ y: bb.y0 }) + Y({ y: bb.y1 })) / 2, 7.5, { align: 'c', rot: 90 });
      /* nazivi zona */
      for (const z in S.zones) { const o = S.zones[z], lb = zoneLabel(z, o, fl, kind); if (!lb || o.A < 2000) continue; if (kind === 'v' && z !== 'v') continue; const px = X(o), py = Y(o); c += P.text(lb[0], px, py + 3, 6.5, { bold: true, align: 'c' }) + (lb[1] ? P.text(lb[1], px, py - 6, 6.5, { align: 'c' }) : ''); if (kind === 'v') break; }
      for (const o of S.open) { const cc = cent(o.pcs.reduce((m, p) => p.length > m.length ? p : m, o.pcs[0] || [])); if (!o.pcs.length) continue; c += P.text('OTVORENI PROSTOR', X(cc), Y(cc) + 3, 5.5, { bold: true, align: 'c' }) + P.text((o.nat ? 'NATKRIVENO' : 'NENATKRIVENO') + (kind === 'v' && o.nat ? ' P=' + fm(m2(o.A)) + ' m²' : ''), X(cc), Y(cc) - 4, 5.5, { align: 'c' }); }
      /* formula ispod skice */
      let fy = Y({ y: bb.y1 }) - 16; const line = kind === 'g' ? gbpLine(fl) : volLine(fl), parts = wrapF(line, 9, cw - 30);
      parts.forEach((ln, li) => { c += P.text(ln, x0 + cw / 2, fy - li * 11, 9, { align: 'c', bold: li === parts.length - 1 }); }); fy -= parts.length * 11 + 2;
      for (const nt of notes(fl, kind)) { c += P.text('– ' + nt, x0 + cw / 2, fy, 7, { align: 'c' }); fy -= 9; }
    });
    /* donja traka: naslov, pravilnik, ukupno */
    c += '0.6 w ' + f(L) + ' ' + f(botBand - 4) + ' m ' + f(Rr) + ' ' + f(botBand - 4) + ' l S\n';
    c += P.text(title, (L + Rr) / 2, botBand - 24, 16, { align: 'c' }) + P.text(prav, (L + Rr) / 2, botBand - 37, 8, { align: 'c' });
    const tl = wrapF(total, 12, Rr - L - 40); tl.forEach((ln, i) => { c += P.text(ln, (L + Rr) / 2, botBand - 58 - i * 14, 12, { align: 'c', bold: i === tl.length - 1 }); });
    if (kind === 'v') { const hz = R.floors.filter(x => !x.tavan).map(x => x.name + ' ' + fm((x.zf || 0) / 100) + ' m').join(' · '); c += P.text('Kote poda etaža (kao u presjeku, ±0,00 = pod najniže etaže): ' + hz, L + 6, hf.bottom + 6, 7); }
    c += P.text('M 1:' + sc, Rr, hf.bottom + 6, 8, { align: 'r' }) + 'Q\n';
    doc.page(W, H, c);
  });
  return doc.bytes();
  function wrapF(t, size, maxW) { const w = t.split(' '), out = []; let cur = ''; for (const x of w) { const nx = cur ? cur + ' ' + x : x; if (P.textW(nx) * size > maxW && cur) { out.push(cur); cur = (/^[=+]$/.test(x) ? '' : '') + x; } else cur = nx; } if (cur) out.push(cur); return out; }
}

/* --- DXF: oba lista jedan ispod drugog; skice etaža jedna do druge --- */
const LAY = [['LEG_OBRIS', 7], ['LEG_GRANICE', 8], ['LEG_GRANICA_VISINE', 1], ['LEG_OTVORENO', 30], ['LEG_SRAFURA', 9], ['LEG_KOTE', 5], ['LEG_TEKST', 7]];
function toDxf(R) {
  const C = root.IzmjeraTlocrtCore, out = { lines: [], arcs: [], texts: [], polys: [], circles: [], dims: [] }, Lq = (layer, a, b) => out.lines.push({ layer, a, b }), Tx = (layer, x, y, text, h, al) => out.texts.push({ layer, x, y, text, h, rot: 0, align: al || 'c' });
  let mx = 0, my = 0; R.floors.forEach(fl => { mx = Math.max(mx, fl.bb.x1 - fl.bb.x0); my = Math.max(my, fl.bb.y1 - fl.bb.y0); }); const stepX = mx + 600, stepY = my + 1400;
  [['g', 'GRAĐEVINSKA BRUTO POVRŠINA (GBP) – Pravilnik NN 93/17', 'UKUPNO GBP = ' + R.floors.filter(x => x.G > 0).map(x => fm(m2(x.G))).join(' + ') + ' = ' + fm(m2(R.G)) + ' m²'],
   ['v', 'OBUJAM ZGRADE – Pravilnik NN 15/19', 'UKUPNO OBUJAM ZGRADE = ' + R.floors.map(x => fm(x.V / 1e6)).join(' + ') + ' = ' + fm(R.V / 1e6) + ' m³']].forEach(([kind, title, total], s) => {
    const oy0 = s * stepY;
    R.floors.forEach((fl, n) => { const S = sketch(fl, kind), bb = fl.bb, ox = n * stepX - bb.x0, oy = oy0 - bb.y0, M = p => ({ x: p.x + ox, y: p.y + oy });
      Tx('LEG_TEKST', bb.x0 + ox, bb.y0 + oy - 160, 'skica tlocrta: ' + fl.NAME, 25, 'l');
      for (const e of S.edges) Lq(e.out ? 'LEG_OBRIS' : 'LEG_GRANICE', M(e.a), M(e.b));
      for (const [a, b] of S.cuts) Lq('LEG_GRANICA_VISINE', M(a), M(b));
      for (const o of S.open) for (const p of o.pcs) for (let i = 0; i < p.length; i++) Lq('LEG_OTVORENO', M(p[i]), M(p[(i + 1) % p.length]));
      if (kind === 'g') for (const z of ['gar', 'pom', 'h2']) for (const p of (S.zones[z] || { polys: [] }).polys) hatchPoly(p, 25).forEach(([a, b]) => Lq('LEG_SRAFURA', M(a), M(b)));
      const y1 = bb.y0 + oy - 60; Lq('LEG_KOTE', { x: bb.x0 + ox, y: y1 }, { x: bb.x1 + ox, y: y1 }); Tx('LEG_KOTE', (bb.x0 + bb.x1) / 2 + ox, y1 - 10, String(Math.round(bb.x1 - bb.x0)), 15);
      const x1 = bb.x0 + ox - 60; Lq('LEG_KOTE', { x: x1, y: bb.y0 + oy }, { x: x1, y: bb.y1 + oy }); out.texts.push({ layer: 'LEG_KOTE', x: x1 - 10, y: (bb.y0 + bb.y1) / 2 + oy, text: String(Math.round(bb.y1 - bb.y0)), h: 15, rot: 90, align: 'c' });
      for (const z in S.zones) { const o = S.zones[z], lb = zoneLabel(z, o, fl, kind); if (!lb || o.A < 2000) continue; Tx('LEG_TEKST', o.x + ox, o.y + oy - 10, lb[0], 12); if (lb[1]) Tx('LEG_TEKST', o.x + ox, o.y + oy + 12, lb[1], 11); if (kind === 'v') break; }
      for (const o of S.open) { if (!o.pcs.length) continue; const cc = cent(o.pcs[0]); Tx('LEG_TEKST', cc.x + ox, cc.y + oy, 'OTVORENI PROSTOR ' + (o.nat ? 'NATKRIVENO' : 'NENATKRIVENO') + ' P=' + fm(m2(o.A)) + ' m²', 9); }
      const ln = kind === 'g' ? gbpLine(fl) : volLine(fl); Tx('LEG_TEKST', bb.x0 + ox, bb.y1 + oy + 90, ln, 18, 'l');
      notes(fl, kind).forEach((t, i) => Tx('LEG_TEKST', bb.x0 + ox, bb.y1 + oy + 125 + i * 24, '– ' + t, 12, 'l')); });
    Tx('LEG_TEKST', 0, oy0 + my + 420, title, 35, 'l'); Tx('LEG_TEKST', 0, oy0 + my + 480, total, 30, 'l'); });
  const saved = C.LAYERS.slice(); C.LAYERS.length = 0; C.LAYERS.push(...LAY);
  try { return C.toDxf(out); } finally { C.LAYERS.length = 0; C.LAYERS.push(...saved); }
}
function hatchPoly(P, sp) { const out = [], xs = P.map(p => p.x + p.y), lo = Math.min(...xs), hi = Math.max(...xs); for (let s = Math.ceil(lo / sp) * sp; s < hi; s += sp) { /* crta x + y = s */ const pts = []; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length], va = a.x + a.y - s, vb = b.x + b.y - s; if ((va <= 0) !== (vb <= 0)) { const t = va / (va - vb); pts.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }); } } if (pts.length >= 2) out.push([pts[0], pts[1]]); } return out; }

root.IzmjeraLegalizacija = { compute, toPdf, toDxf, opisText, gbpLine, volLine, notes, fm, USE, defUse, natOf };
})(typeof window !== 'undefined' ? window : globalThis);
