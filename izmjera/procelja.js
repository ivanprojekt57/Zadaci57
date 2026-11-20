/* Izmjera 57 — pročelja (pogledi) iz tlocrta svih etaža, visina i krova. Mjere u cm, z prema gore. */
(function (root) {
'use strict';
const EC = root.IzmjeraEnergijaCalc;
const num = (v, d) => EC.num(v, d);
const VIEWS = [{ n: [0, 1], key: 'dolje' }, { n: [1, 0], key: 'desno' }, { n: [0, -1], key: 'gore' }, { n: [-1, 0], key: 'lijevo' }];

/* floors: [{ name, E, res (calcFloor allHeated) }] odozdo prema gore; Pp = postavke pročelja */
function prepareFloors(floors) {
  let zf = 0; const base = floors[0] && floors[0].res.bbox;
  return floors.map((F, k) => {
    const E = F.E || {}, Hh = EC.floorHeights(E), up = E.iznad || 'grijano';
    const off = { x: E.pomakX != null ? num(E.pomakX, 0) : base.x0 - F.res.bbox.x0, y: E.pomakY != null ? num(E.pomakY, 0) : base.y0 - F.res.bbox.y0 };
    const zBot = zf - (E.ispod && E.ispod !== 'grijano' ? Hh.dIspod : 0);
    const tW = extT(F.res);
    const topOf = (pe, bb) => { const hh = EC.floorHeights(pe), u = pe.iznad || 'grijano', open = u === 'kosi' || (u === 'tavan' && !!pe.bezStropa); let ks = u === 'kosi' || u === 'tavan' ? (pe.kosi || {}) : null; let zt = zf + hh.h + hh.dIznad;
      const base = open ? zf : zf + hh.h + hh.dIznad; if (ks && ks.unos === 'visine') ks = kosiFromH(ks, bb, tW, u === 'kosi' || !!pe.bezStropa);
      if (open) zt = zf + num(ks.nadzid, 100); else if (u === 'tavan') zt = base + num(ks.nadzid, 0); else if (u === 'ravni') zt += num(pe.atika, 0); return { zTop: zt, up: u, kosi: ks, open, tW }; };
    const parts = (F.res.parts || [{ E, bbox: F.res.bbox }]).map((P2, i) => ({ i, name: P2.name, bbox: P2.bbox, AZ: P2.AZ, ...topOf(P2.E, P2.bbox || F.res.bbox) }));
    const kosi = parts[0].kosi, zTop = parts[0].zTop;
    const o = { ...F, zf, zBot, zTop, off, up, kosi, Hh, parts };
    zf = zf + Hh.h + Hh.dIznad;
    return o;
  });
}
const extT = (r) => EC.extT(r), kosiFromH = (k, bb, t, o) => EC.kosiFromH(k, bb, t, o);
/* sastav krova: rog + slojevi iznad (pokrov...) i ispod rogova; debljine okomito na krov (cm) */
function roofBuild(k, heated) {
  k = k || {}; const rog = num(k.rog, 18);
  const L = Array.isArray(k.slojevi) ? k.slojevi : (heated ? DEF_UP.concat([{ n: 'gips-karton', d: 1.25, gdje: 'ispod' }]) : DEF_UP);
  const up = L.filter(l => (l.gdje || 'iznad') !== 'ispod' && num(l.d, 0) > 0), dn = L.filter(l => l.gdje === 'ispod' && num(l.d, 0) > 0);
  const sUp = up.reduce((q, l) => q + num(l.d, 0), 0), sDn = dn.reduce((q, l) => q + num(l.d, 0), 0);
  return { rog, up, dn, sUp, sDn, top: rog + sUp };
}
const DEF_UP = [{ n: 'pokrov (crijep)', d: 3 }, { n: 'letve', d: 3 }, { n: 'kontraletve', d: 5 }];
function fmtD(v) { return String(Math.round(v * 100) / 100).replace('.', ','); }
/* krov kao 3D plohe nad pravokutnikom etaže */
function roofFaces(L) { const F = []; for (const pt of L.parts || []) if (pt.kosi && pt.AZ > 0 && Number.isFinite(pt.bbox.x0)) for (const f of roofFacesPart(L, pt)) F.push(f); return F; }
function roofFacesPart(L, pt) {
  const k = pt.kosi, b0 = pt.bbox, x0 = b0.x0 + L.off.x, x1 = b0.x1 + L.off.x, y0 = b0.y0 + L.off.y, y1 = b0.y1 + L.off.y;
  const a = num(k.nagib, 35) * Math.PI / 180, tg = Math.tan(a), e = num(k.prepust, 40), ze = pt.zTop, vr = k.vrsta || 'dvostresni', Lz = L, rb = roofBuild(k, pt.up === 'kosi'), tUp = rb.top / Math.cos(a); L = { set zr(v) { pt.zr = v + tUp; Lz.zr = Math.max(Lz.zr || -Infinity, v + tUp); } };
  const F = [], R = (pts, wall) => F.push({ pts, wall: !!wall, zb: ze, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, tUp, rb, cosA: Math.cos(a) });
  const X0 = x0 - e, X1 = x1 + e, Y0 = y0 - e, Y1 = y1 + e, zE = ze - e * tg;
  if (vr === 'dvostresni') {
    if ((k.sljeme || 'H') === 'H') { const ym = (y0 + y1) / 2, zr = ze + (ym - y0) * tg;
      R([[X0, Y0, zE], [X1, Y0, zE], [X1, ym, zr], [X0, ym, zr]]); R([[X0, Y1, zE], [X0, ym, zr], [X1, ym, zr], [X1, Y1, zE]]);
      R([[x0, y0, ze], [x0, ym, zr], [x0, y1, ze]], true); R([[x1, y1, ze], [x1, ym, zr], [x1, y0, ze]], true); L.zr = zr; }
    else { const xm = (x0 + x1) / 2, zr = ze + (xm - x0) * tg;
      R([[X0, Y1, zE], [X0, Y0, zE], [xm, Y0, zr], [xm, Y1, zr]]); R([[X1, Y0, zE], [X1, Y1, zE], [xm, Y1, zr], [xm, Y0, zr]]);
      R([[x0, y0, ze], [xm, y0, zr], [x1, y0, ze]], true); R([[x1, y1, ze], [xm, y1, zr], [x0, y1, ze]], true); L.zr = zr; }
  } else if (vr === 'cetverostresni') {
    const lx = X1 - X0, ly = Y1 - Y0;
    if (lx >= ly) { const h = ly / 2, zr = zE + h * tg, ym = (Y0 + Y1) / 2;
      R([[X0, Y0, zE], [X1, Y0, zE], [X1 - h, ym, zr], [X0 + h, ym, zr]]); R([[X1, Y1, zE], [X0, Y1, zE], [X0 + h, ym, zr], [X1 - h, ym, zr]]);
      R([[X0, Y1, zE], [X0, Y0, zE], [X0 + h, ym, zr]]); R([[X1, Y0, zE], [X1, Y1, zE], [X1 - h, ym, zr]]); L.zr = zr; }
    else { const h = lx / 2, zr = zE + h * tg, xm = (X0 + X1) / 2;
      R([[X0, Y1, zE], [X0, Y0, zE], [xm, Y0 + h, zr], [xm, Y1 - h, zr]]); R([[X1, Y0, zE], [X1, Y1, zE], [xm, Y1 - h, zr], [xm, Y0 + h, zr]]);
      R([[X0, Y0, zE], [X1, Y0, zE], [xm, Y0 + h, zr]]); R([[X1, Y1, zE], [X0, Y1, zE], [xm, Y1 - h, zr]]); L.zr = zr; }
  } else { // jednostrešni: viša strana
    const hs = k.visa || 'gore';
    if (hs === 'gore' || hs === 'dolje') { const span = y1 - y0, zH = ze + span * tg, hiY = hs === 'gore' ? y0 : y1, loY = hs === 'gore' ? y1 : y0, HiY = hs === 'gore' ? Y0 : Y1, LoY = hs === 'gore' ? Y1 : Y0;
      R([[X0, LoY, zE], [X1, LoY, zE], [X1, HiY, zH + e * tg], [X0, HiY, zH + e * tg]]);
      R([[x0, hiY, ze], [x1, hiY, ze], [x1, hiY, zH], [x0, hiY, zH]], true); R([[x0, loY, ze], [x0, hiY, ze], [x0, hiY, zH]], true); R([[x1, hiY, ze], [x1, loY, ze], [x1, hiY, zH]], true); L.zr = zH; }
    else { const span = x1 - x0, zH = ze + span * tg, hiX = hs === 'lijevo' ? x0 : x1, loX = hs === 'lijevo' ? x1 : x0, HiX = hs === 'lijevo' ? X0 : X1, LoX = hs === 'lijevo' ? X1 : X0;
      R([[LoX, Y0, zE], [LoX, Y1, zE], [HiX, Y1, zH + e * tg], [HiX, Y0, zH + e * tg]]);
      R([[hiX, y0, ze], [hiX, y1, ze], [hiX, y1, zH], [hiX, y0, zH]], true); R([[loX, y0, ze], [hiX, y0, ze], [hiX, y0, zH]], true); R([[hiX, y1, ze], [loX, y1, ze], [hiX, y1, zH]], true); L.zr = zH; }
  }
  return F;
}
function fmtK(z) { const v = Math.round(z) / 100; return (Math.abs(v) < 0.005 ? '±0,00' : (v > 0 ? '+' : '') + v.toFixed(2).replace('.', ',')); }

/* jedan pogled */
function buildView(Ls, view, Pp, north) {
  const tv0 = (Pp.teren || {})[view.key] || {}, td0 = num(Pp.terenDef, 15), zLow = -Math.max(num(tv0.l, td0), num(tv0.r, tv0.l != null ? num(tv0.l, td0) : td0)) - 5;
  const [nx, ny] = view.n, rx = ny, ry = -nx, U = (x, y) => x * rx + y * ry, D = (x, y) => x * nx + y * ny;
  const rects = [], lines = [], texts = [], openings = [];
  for (const L of Ls) for (const s of L.res.segs) {
    if (s.cls !== 'ext' || s.nxs !== nx || s.nys !== ny) continue;
    const pa = s.o === 'H' ? [s.s0, s.at] : [s.at, s.s0], pb = s.o === 'H' ? [s.s1, s.at] : [s.at, s.s1];
    const ua = U(pa[0] + L.off.x, pa[1] + L.off.y), ub = U(pb[0] + L.off.x, pb[1] + L.off.y);
    const pt = (L.parts && L.parts[s.prt || 0]) || L; rects.push({ u0: Math.min(ua, ub), u1: Math.max(ua, ub), z0: s.z0rel ? L.zBot + s.z0rel : L === Ls[0] ? Math.min(L.zBot, zLow) : L.zBot, z1: pt.zTop, d: Math.round(D(pa[0] + L.off.x, pa[1] + L.off.y)) });
  }
  if (!rects.length) return null;
  // raster: vlasnik ćelije = najbliža ravnina
  const us = [...new Set(rects.flatMap(r => [r.u0, r.u1].map(v => Math.round(v * 10) / 10)))].sort((a, b) => a - b), zs = [...new Set(rects.flatMap(r => [r.z0, r.z1].map(v => Math.round(v * 10) / 10)))].sort((a, b) => a - b);
  const nu = us.length - 1, nz = zs.length - 1, own = new Array(Math.max(0, nu * nz)).fill(null);
  for (let i = 0; i < nu; i++) for (let j = 0; j < nz; j++) { const cu = (us[i] + us[i + 1]) / 2, cz = (zs[j] + zs[j + 1]) / 2; let best = null; for (const r of rects) if (cu > r.u0 && cu < r.u1 && cz > r.z0 && cz < r.z1 && (best == null || r.d > best)) best = r.d; own[i * nz + j] = best; }
  const at = (i, j) => i < 0 || j < 0 || i >= nu || j >= nz ? null : own[i * nz + j];
  const ownerAt = (u, z) => { const i = us.findIndex((v, k) => k < nu && u >= v && u < us[k + 1]), j = zs.findIndex((v, k) => k < nz && z >= v && z < zs[k + 1]); return i < 0 || j < 0 ? null : at(i, j); };
  const segL = []; // obris (granice različitih vlasnika)
  const dmax = (p, q) => Math.max(p == null ? -1e9 : p, q == null ? -1e9 : q);
  for (let i = 0; i <= nu; i++) { let run = null, dd = null; for (let j = 0; j <= nz; j++) { const e = j < nz && at(i - 1, j) !== at(i, j), d0 = j < nz ? dmax(at(i - 1, j), at(i, j)) : null; if (run != null && (!e || d0 !== dd)) { segL.push([[us[i], zs[run]], [us[i], zs[j]], dd]); run = null; } if (e && run == null) { run = j; dd = d0; } } }
  for (let j = 0; j <= nz; j++) { let run = null, dd = null; for (let i = 0; i <= nu; i++) { const e = i < nu && at(i, j - 1) !== at(i, j), d0 = i < nu ? dmax(at(i, j - 1), at(i, j)) : null; if (run != null && (!e || d0 !== dd)) { segL.push([[us[run], zs[j]], [us[i], zs[j]], dd]); run = null; } if (e && run == null) { run = i; dd = d0; } } }
  // krov
  const excl = [], roofL = [], roofPolys = [];
  const eq3 = (p, q) => Math.abs(p[0] - q[0]) < 0.5 && Math.abs(p[1] - q[1]) < 0.5 && Math.abs(p[2] - q[2]) < 0.5;
  for (const L of Ls) { const FF = roofFaces(L), roofs = FF.filter(f => !f.wall);
   for (const f of FF) {
    const P = f.pts.map(p => [U(p[0], p[1]), p[2] + (f.wall ? 0 : f.tUp), D(p[0], p[1])]), P0 = f.pts.map(p => [U(p[0], p[1]), p[2], D(p[0], p[1])]);
    const shared = (i) => { const p = f.pts[i], q = f.pts[(i + 1) % f.pts.length]; return roofs.some(g => g !== f && g.pts.some((r, j) => { const r2 = g.pts[(j + 1) % g.pts.length]; return (eq3(r, p) && eq3(r2, q)) || (eq3(r, q) && eq3(r2, p)); })); };
    const a = f.pts[1].map((v, i) => v - f.pts[0][i]), b = f.pts[2].map((v, i) => v - f.pts[0][i]), N = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], len = Math.hypot(...N) || 1;
    if (!f.wall) { if (N[2] < 0) N.forEach((v, i) => { N[i] = -v; }); } else { const cxm = f.pts.reduce((q, p) => q + p[0], 0) / f.pts.length - f.cx, cym = f.pts.reduce((q, p) => q + p[1], 0) / f.pts.length - f.cy; if (N[0] * cxm + N[1] * cym < 0) N.forEach((v, i) => { N[i] = -v; }); }
    const dot = N[0] * nx + N[1] * ny;
    if (dot / len < -1e-6) continue; // okrenuta od promatrača
    if (f.wall) { if (Math.abs(dot / len) < 1e-6) continue; // zid u ravnini pogleda
      const base = P.filter(p => Math.abs(p[1] - f.zb) < 0.5); if (base.length >= 2) excl.push({ z: f.zb, u0: Math.min(...base.map(p => p[0])), u1: Math.max(...base.map(p => p[0])) });
      for (let k = 0; k < P.length; k++) { const p = P[k], q = P[(k + 1) % P.length]; if (Math.abs(p[1] - f.zb) < 0.5 && Math.abs(q[1] - f.zb) < 0.5) continue; const ln = [[p[0], p[1]], [q[0], q[1]], 'OBRIS']; ln.d = Math.max(p[2], q[2]); roofL.push(ln); } }
    else { const n = P.length, sh = f.pts.map((_, i) => shared(i)), add = (p, q) => { if (Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.5) { const ln = [[p[0], p[1]], [q[0], q[1]], 'KROV']; ln.d = Math.max(p[2], q[2]); roofL.push(ln); } };
      for (let k = 0; k < n; k++) { add(P[k], P[(k + 1) % n]); if (!sh[k]) add(P0[k], P0[(k + 1) % n]); } // gornja ploha + donji rub (streha, zabatni rub)
      for (let k = 0; k < n; k++) if (!sh[k] && !sh[(k + n - 1) % n]) add(P0[k], P[k]); // čelo strehe na kutu
      if (dot / len > 1e-6) { for (const Q of [P, P0]) { const pp = Q.map(p => [p[0], p[1]]); pp.dmax = Math.max(...Q.map(p => p[2])); roofPolys.push(pp); } } }
  } }
  // ukloni vodoravni rub zida ispod zabata
  for (const [a, b, dd] of segL) {
    if (Math.abs(a[1] - b[1]) < 0.01) { let parts = [[Math.min(a[0], b[0]), Math.max(a[0], b[0])]]; for (const x of excl) if (Math.abs(x.z - a[1]) < 0.6) parts = parts.flatMap(([p, q]) => { const r = []; if (x.u0 > p) r.push([p, Math.min(q, x.u0)]); if (x.u1 < q) r.push([Math.max(p, x.u1), q]); return r.filter(([m, n]) => n - m > 0.5); }); for (const [p, q] of parts) { const ln = [[p, a[1]], [q, a[1]], 'OBRIS']; ln.d = dd; lines.push(ln); } }
    else { const ln = [a, b, 'OBRIS']; ln.d = dd; lines.push(ln); }
  }
  for (const ln of roofL) { const [a, b, lay] = ln, n2 = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 10)); let run = null;
    for (let k = 0; k <= n2; k++) { const t = k / n2, p2 = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], tm = Math.min(1, (k + 0.5) / n2), pm = [a[0] + (b[0] - a[0]) * tm, a[1] + (b[1] - a[1]) * tm], ow = k < n2 ? ownerAt(pm[0], pm[1]) : null, hid = k < n2 && ow != null && ow > ln.d + 1;
      if (!hid && k < n2 && run == null) run = p2; if ((hid || k === n2) && run) { const l2 = [run, p2, lay]; l2.d = ln.d; if (Math.hypot(p2[0] - run[0], p2[1] - run[1]) > 0.5) lines.push(l2); run = null; } } }
  // otvori
  const st = num(Pp.stok, 6), opGeom = [];
  for (const L of Ls) for (const o of L.res.ops) {
    if (o.manual || o.nxs !== nx || o.nys !== ny || o.x == null) continue;
    const uc = U(o.x + L.off.x, o.y + L.off.y), z0 = L.zf + (o.kind === 'prozor' ? o.p : 0), z1 = z0 + o.h, w = o.w, u0 = uc - w / 2, u1 = uc + w / 2;
    const own2 = ownerAt(uc, (z0 + z1) / 2), d = Math.round(D(o.x + L.off.x, o.y + L.off.y)); if (own2 == null || Math.abs(own2 - d) > 15) continue;
    openings.push(o); opGeom.push({ key: o.key, fi: L.i, u0, u1, z0, z1, zf: L.zf, win: o.kind === 'prozor', kind: o.kind, w: o.w });
    const R = (a, b, c, e, lay) => { for (const ln of [[[a, b], [c, b], lay], [[c, b], [c, e], lay], [[c, e], [a, e], lay], [[a, e], [a, b], lay]]) { ln.d = d; lines.push(ln); } };
    R(u0, z0, u1, z1, 'OTVORI');
    const door = o.kind !== 'prozor', ib = door ? z0 : z0 + st;
    if (o.krila >= 2) { R(u0 + st, ib, uc - st / 2, z1 - st, 'OTVORI'); R(uc + st / 2, ib, u1 - st, z1 - st, 'OTVORI'); }
    else R(u0 + st, ib, u1 - st, z1 - st, 'OTVORI');
  }
  // krovne plohe okrenute prema promatraču skrivaju zid iza sebe (strehe)
  const inPoly = (pt, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > pt[1]) !== (b[1] > pt[1]) && pt[0] < (b[0] - a[0]) * (pt[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
  const cut = (a, b, poly) => { const ts = [0, 1]; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const p = poly[j], q = poly[i], d = (b[0] - a[0]) * (q[1] - p[1]) - (b[1] - a[1]) * (q[0] - p[0]); if (Math.abs(d) < 1e-9) continue; const t = ((p[0] - a[0]) * (q[1] - p[1]) - (p[1] - a[1]) * (q[0] - p[0])) / d, u2 = ((p[0] - a[0]) * (b[1] - a[1]) - (p[1] - a[1]) * (b[0] - a[0])) / d; if (t > 0 && t < 1 && u2 >= 0 && u2 <= 1) ts.push(t); } ts.sort((x, y) => x - y); const r = []; for (let k = 1; k < ts.length; k++) { const t0 = ts[k - 1], t1 = ts[k]; if (t1 - t0 < 1e-6) continue; const m = (t0 + t1) / 2; if (!inPoly([a[0] + (b[0] - a[0]) * m, a[1] + (b[1] - a[1]) * m], poly)) r.push([[a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0], [a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1]]); } return r; };
  if (roofPolys.length) { let cur = lines; for (const poly of roofPolys) { const nx2 = []; for (const ln of cur) { const [a, b, lay] = ln; if (lay === 'KROV' || (ln.d != null && ln.d > poly.dmax - 1)) { nx2.push(ln); continue; } for (const [p, q] of cut(a, b, poly)) { const l2 = [p, q, lay]; l2.d = ln.d; nx2.push(l2); } } cur = nx2; } lines.length = 0; lines.push(...cur); }
  // teren
  const umin = Math.min(...rects.map(r => r.u0)), umax = Math.max(...rects.map(r => r.u1));
  const tv = (Pp.teren || {})[view.key] || {}, tdef = num(Pp.terenDef, 15), tl = -num(tv.l, tdef), tr = -num(tv.r, tv.l != null ? num(tv.l, tdef) : tdef);
  const ter = u => u <= umin ? tl : u >= umax ? tr : tl + (tr - tl) * (u - umin) / (umax - umin || 1);
  const clipped = [];
  for (const [a, b, lay] of lines) { const fa = a[1] - ter(a[0]), fb = b[1] - ter(b[0]); if (fa < -0.01 && fb < -0.01) continue; if (fa >= -0.01 && fb >= -0.01) { clipped.push([a, b, lay]); continue; } const t = fa / (fa - fb), m = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; clipped.push(fa >= 0 ? [a, m, lay] : [m, b, lay]); }
  const T0 = umin - 200, T1 = umax + 150; clipped.push([[T0, tl], [umin, tl], 'TEREN'], [[umin, tl], [umax, tr], 'TEREN'], [[umax, tr], [T1, tr], 'TEREN']);
  for (let u = T0 + 10; u < T1; u += 30) { const z = ter(u); clipped.push([[u, z], [u - 15, z - 15], 'TEREN']); }
  // visinske kote (desno)
  const kotes = new Map(), addK = (z, t) => { const k = Math.round(z); if (![...kotes.keys()].some(v => Math.abs(v - k) < 20)) kotes.set(k, t); };
  addK(0, '±0,00'); for (const L of Ls) { if (L.zf) addK(L.zf, fmtK(L.zf)); for (const pt of L.parts || [L]) { if (pt.AZ > 0 || pt === L) { addK(pt.zTop, fmtK(pt.zTop)); if (pt.zr) addK(pt.zr, fmtK(pt.zr)); } } }
  const ku = umax + 120, mk = (u, z, t, left) => { clipped.push([[u - 40, z], [u + 60, z], 'KOTE'], [[u, z], [u - 10, z + 14], 'KOTE'], [[u - 10, z + 14], [u + 10, z + 14], 'KOTE'], [[u + 10, z + 14], [u, z], 'KOTE']); texts.push({ u: left ? u - 16 : u + 16, z: z + 6, t, h: 22, lay: 'KOTE', al: left ? 'r' : 'l' }); };
  for (const [z, t] of kotes) mk(ku, z, t);
  mk(umin - 60, tl, fmtK(tl), true); if (Math.abs(tr - tl) > 1) mk(umax + 30, tr, fmtK(tr));
  const zmax = Math.max(...Ls.flatMap(L => (L.parts || [L]).map(pt => pt.zr || pt.zTop)).filter(Number.isFinite));
  const name = 'POGLED ' + EC.strana(nx, ny, north);
  texts.push({ u: (umin + umax) / 2, z: Math.min(tl, tr) - 110, t: 'PROČELJE – ' + EC.strana(nx, ny, north), h: 35, lay: 'NASLOV', al: 'c' });
  const topAt = u => Math.max(...rects.filter(r => Math.abs(u === umin ? r.u0 - umin : r.u1 - umax) < 1).map(r => r.z1));
  const ref = { u0: umin, u1: umax, zb0: tl, zb1: tr, zt0: topAt(umin), zt1: topAt(umax), zmax };
  return { key: view.key, strana: EC.strana(nx, ny, north), name, lines: clipped, texts, openings, opGeom, ref, bbox: { u0: T0 - 120, u1: ku + 120, z0: Math.min(tl, tr) - 150, z1: zmax + 60 } };
}
/* ---------- presjek ---------- */
/* drvena konstrukcija krova u presjeku (poprečno na sljeme): nazidnice, podrožnice, sljemenjača, pajante; [širina, visina] cm */
const TB = { naz: [14, 14], pod: [14, 18], slj: [14, 20], paj: [6, 16] };
function tbDims(k) { const o = {}, d = (k && k.drvoD) || {}; for (const key in TB) { const m = /^\s*(\d+(?:[.,]\d+)?)\s*[\/x×*]\s*(\d+(?:[.,]\d+)?)\s*$/.exec(String(d[key] || '')); o[key] = m ? [+m[1].replace(',', '.'), +m[2].replace(',', '.')] : TB[key]; } return o; }
/* geometrija krova u presjeku poprečno na sljeme: donji rub roga zU(s) (s = globalna koordinata uzduž presjeka) */
function roofGeo(L, pt, cut, U) {
  const k = pt.kosi || {}; if (!pt.kosi) return null; const D = tbDims(k), dv = k.drvo || {}, vr = k.vrsta || 'dvostresni', tg = Math.tan(num(k.nagib, 35) * Math.PI / 180), ze = pt.zTop, tW = pt.tW || 30;
  const bx0 = pt.bbox.x0 + L.off.x, bx1 = pt.bbox.x1 + L.off.x, by0 = pt.bbox.y0 + L.off.y, by1 = pt.bbox.y1 + L.off.y;
  let ax; if (vr === 'jednostresni') ax = ((k.visa || 'gore') === 'gore' || k.visa === 'dolje') ? 'y' : 'x'; else if (vr === 'cetverostresni') ax = (bx1 - bx0) >= (by1 - by0) ? 'y' : 'x'; else ax = (k.sljeme || 'H') === 'H' ? 'y' : 'x';
  if ((ax === 'y') !== (cut.o === 'V')) return null;
  const s0 = ax === 'y' ? by0 : bx0, s1 = ax === 'y' ? by1 : bx1, uS = sv => ax === 'y' ? U(cut.c, sv) : U(sv, cut.c);
  const mono = vr === 'jednostresni', hiAtS0 = mono && (k.visa === 'gore' || k.visa === 'lijevo' || !k.visa), zU = sv => mono ? ze + tg * (hiAtS0 ? s1 - sv : sv - s0) : ze + tg * Math.min(sv - s0, s1 - sv);
  // zasjek roga ("ptičji kljun"): vodoravno sjedište na gredi + okomiti rez na donjoj strani; dubina najviše 1/3 visine roga
  const rog = roofBuild(k, false).rog, sinA = Math.sin(Math.atan(tg)), seat = b => Math.max(0, Math.min(b, (rog / 3) / Math.max(0.05, sinA)));
  const top = (sc, [b, h], ridge) => Math.min(zU(sc - b / 2), zU(sc + b / 2)) + tg * (ridge ? Math.min(b / 2, seat(b)) : seat(b));
  return { k, D, dv, tg, ze, tW, s0, s1, uS, mono, zU, top };
}
function beamBox(lines, G, sc, zTop, [b, h]) { const u0 = Math.min(G.uS(sc - b / 2), G.uS(sc + b / 2)), u1 = Math.max(G.uS(sc - b / 2), G.uS(sc + b / 2)), z1 = zTop, z0 = zTop - h;
  lines.push([[u0, z0], [u1, z0], 'REZ'], [[u1, z0], [u1, z1], 'REZ'], [[u1, z1], [u0, z1], 'REZ'], [[u0, z1], [u0, z0], 'REZ'], [[u0, z0], [u1, z1], 'KROV'], [[u0, z1], [u1, z0], 'KROV']); }
/* nazidnice crta zid (na sredini vanjskog zida, zid ide do donjeg ruba nazidnice); ovdje sljemenjača, podrožnice, pajante */
function timber(L, pt, cut, U, lines, texts) {
  const k = pt.kosi || {}, dv = k.drvo || {}; if (!(dv.naz || dv.pod || dv.slj || dv.paj)) return null;
  const G = roofGeo(L, pt, cut, U); if (!G) return null; const { D, tg, ze, tW, s0, s1, uS, mono } = G;
  const sm = mono ? null : (s0 + s1) / 2;
  if (dv.slj && sm != null) beamBox(lines, G, sm, G.top(sm, D.slj, true), D.slj);
  const pods = mono ? [(s0 + s1) / 2] : [(s0 + tW + sm) / 2, (s1 - tW + sm) / 2];
  if (dv.pod) for (const sc of pods) beamBox(lines, G, sc, G.top(sc, D.pod), D.pod);
  if (dv.paj && !mono) { const base = pt.open ? L.zf : L.zf + L.Hh.h + L.Hh.dIznad, pz = num(k.pajZ, NaN), zp = pz > 0 ? base + pz + D.paj[1] : G.top(pods[0], D.pod) - (dv.pod ? 0 : 0), d = (zp - ze) / tg, sa = s0 + d, sb = s1 - d; if (sb - sa > 40) { const ua = uS(sa), ub = uS(sb);
      lines.push([[ua, zp], [ub, zp], 'REZ'], [[ua, zp - D.paj[1]], [ub, zp - D.paj[1]], 'REZ'], [[ua, zp], [ua, zp - D.paj[1]], 'REZ'], [[ub, zp], [ub, zp - D.paj[1]], 'REZ']); } }
  const nm = [dv.naz && 'nazidnica ' + D.naz.join('/'), dv.pod && 'podrožnica ' + D.pod.join('/'), dv.slj && !mono && 'sljemenjača ' + D.slj.join('/'), dv.paj && !mono && 'pajante 2×' + D.paj.join('/')].filter(Boolean);
  return nm;
}
/* materijali u presjeku: 'nema' | 'opeka' (kose crte) | 'ab' (armirani beton: kose crte + točke) | 'izol' (cik-cak) | 'zbuka' */
const MATS = [['nema', 'bez šrafure'], ['opeka', 'opeka'], ['ab', 'armirani beton'], ['beton', 'beton'], ['kamen', 'kamen'], ['izol', 'toplinska izolacija'], ['zbuka', 'žbuka / estrih']];
function fill(lines, u0, z0, u1, z1, mat) {
  if (u1 - u0 < 0.5 || z1 - z0 < 0.5) return; mat = mat || 'opeka';
  if (mat === 'opeka') hatch(lines, u0, z0, u1, z1, 12);
  else if (mat === 'ab' || mat === 'beton') { if (mat === 'ab') hatch(lines, u0, z0, u1, z1, 16); const st = 9; let r = 0; for (let z = z0 + st / 2; z < z1; z += st, r++) for (let u = u0 + (r % 2 ? st : st / 2); u < u1; u += st * 1.6) lines.push([[u - 0.6, z], [u + 0.6, z], 'SRAF']); }
  else if (mat === 'kamen') { hatch(lines, u0, z0, u1, z1, 20); const tmp = []; hatch(tmp, -u1, z0, -u0, z1, 20); for (const [a, b, l] of tmp) lines.push([[-a[0], a[1]], [-b[0], b[1]], l]); }
  else if (mat === 'izol') { const w = u1 - u0, h = z1 - z0; if (w <= h) { const n = Math.max(2, Math.round(h / (w * 0.8))), st = h / n; for (let k2 = 0; k2 < n; k2++) { const za = z0 + k2 * st; lines.push([[u0, za], [u1, za + st / 2], 'SRAF'], [[u1, za + st / 2], [u0, za + st], 'SRAF']); } }
    else { const n = Math.max(2, Math.round(w / (h * 0.8))), st = w / n; for (let k2 = 0; k2 < n; k2++) { const ua = u0 + k2 * st; lines.push([[ua, z0], [ua + st / 2, z1], 'SRAF'], [[ua + st / 2, z1], [ua + st, z0], 'SRAF']); } } }
}
/* slojevi vanjskog zida (izvana prema unutra); sloj bez debljine dobije ostatak do debljine iz tlocrta */
function wallLayers(Pp, T) { const sl = (Array.isArray(Pp.zidSl) ? Pp.zidSl : []).filter(l => l && (num(l.d, 0) > 0 || l.d == null || l.d === '')); if (!sl.length) return null;
  const fixed = sl.reduce((q, l) => q + (num(l.d, 0) > 0 ? num(l.d, 0) : 0), 0), free = sl.filter(l => !(num(l.d, 0) > 0)); let rest = T - fixed;
  const out = sl.map(l => ({ n: l.n, mat: l.mat || 'nema', d: num(l.d, 0) > 0 ? num(l.d, 0) : Math.max(0, rest / Math.max(1, free.length)) }));
  if (!free.length && Math.abs(rest) > 0.5) { const k2 = out.findIndex(l => l.mat === 'opeka' || l.mat === 'ab' || l.mat === 'beton' || l.mat === 'kamen'); out[k2 >= 0 ? k2 : out.length - 1].d += rest; }
  return out.filter(l => l.d > 0.2); }
/* materijal sloja ploče po nazivu */
/* dio crte ispod pravca z = f(u) */
function clipBelow(ln, f) { const [a, b, lay] = ln, ga = a[1] - f(a[0]), gb = b[1] - f(b[0]); if (ga <= 0.01 && gb <= 0.01) return ln; if (ga > 0.01 && gb > 0.01) return null; const t = ga / (ga - gb), m = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; return ga > 0 ? [m, b, lay] : [a, m, lay]; }
function slMat(n) { n = String(n || '').toLowerCase(); return /\bab\b|armiran|ploč|ploc/.test(n) ? 'ab' : /beton/.test(n) ? 'beton' : /izol|eps|xps|stiropor|vuna/.test(n) ? 'izol' : /žbuk|zbuk|estrih|obloga|pod/.test(n) ? 'zbuka' : 'nema'; }
function hatch(lines, u0, z0, u1, z1, sp) { // kose crte šrafure unutar pravokutnika
  if (u1 - u0 < 1 || z1 - z0 < 1) return; sp = sp || 12;
  for (let k = Math.floor((u0 - z1) / sp) * sp; k <= u1 - z0; k += sp) { // u - z = k
    const pts = []; for (const [u, z] of [[k + z0, z0], [k + z1, z1]]) pts.push([u, z]);
    let a = [k + z0, z0], b = [k + z1, z1]; // presjek s pravokutnikom
    if (a[0] < u0) a = [u0, u0 - k]; if (b[0] > u1) b = [u1, u1 - k]; if (a[0] > u1 || b[0] < u0 || a[1] > z1 || b[1] < z0) continue;
    if (b[0] - a[0] > 0.5) lines.push([a, b, 'SRAF']);
  }
}
function buildSection(Ls, cut, Pp, idx) {
  const lines = [], texts = [], f = cut.o === 'H' ? [0, cut.look || 1] : [cut.look || 1, 0], nx = -f[0], ny = -f[1], rx = ny, ry = -nx, U = (x, y) => x * rx + y * ry;
  const R4 = (u0, z0, u1, z1, lay) => { lines.push([[u0, z0], [u1, z0], lay], [[u1, z0], [u1, z1], lay], [[u1, z1], [u0, z1], lay], [[u0, z1], [u0, z0], lay]); };
  const D = Pp.defaults || {}, kotes = new Map(), addK = (z, t) => { const k = Math.round(z); if (![...kotes.keys()].some(v => Math.abs(v - k) < 12)) kotes.set(k, t); };
  let umin = Infinity, umax = -Infinity, zmax = 0, any = false; const S2 = {};
  for (const L of Ls) {
    const res = L.res, g = res.grid; if (!g) continue; const { xs, ys, nx: gx, ny: gy } = g, E = L.E || {}, lv = E.roomLvl || {};
    const cf = cut.o === 'H' ? cut.c - L.off.y : cut.c - L.off.x, arr = cut.o === 'H' ? ys : xs, n2 = cut.o === 'H' ? gy : gx;
    let row = -1; for (let k = 0; k < n2; k++) if (cf >= arr[k] && cf < arr[k + 1]) { row = k; break; } if (row < 0) continue;
    const cellOf = k => cut.o === 'H' ? k * gy + row : row * gy + k, sArr = cut.o === 'H' ? xs : ys, nS = cut.o === 'H' ? gx : gy;
    const toU = sv => cut.o === 'H' ? U(sv + L.off.x, 0) : U(0, sv + L.off.y);
    // intervali duž crte presjeka
    const iv = []; for (let k = 0; k < nS; k++) { const c = cellOf(k), t = res.T[c], key = t === -2 ? 'w' : t >= 0 ? 'r' + t : 'o', last = iv.at(-1); if (last && last.key === key) last.s1 = sArr[k + 1]; else iv.push({ key, t, s0: sArr[k], s1: sArr[k + 1], c }); }
    const partOfCell = c => { const o = res.OWN ? res.OWN[c] : -1; return o >= 0 && res.roomPart ? res.roomPart[o] : 0; };
    const P0 = L.parts || [L]; any = true;
    // stubište: profil kad crta ide uzduž kraka, presjek stube kad ide poprijeko; otvor u ploči iznad kraka
    const holes = [], Hst = L.Hh.h + L.Hh.dIznad;
    for (const sg of (L.out && L.out.stairsG) || []) {
      const along = (cut.o === 'V') === sg.runY, cc = along ? cf : null, H = sg.H > 0 ? sg.H : Hst, n = Math.max(2, sg.n), hR = H / Math.max(n, sg.nTot || 0), t = 15;
      const r0 = sg.start, dir = sg.dir || 1, zf = L.zf + (sg.k0 || 0) * hR; /* drugi krak počinje na visini podesta */
      if (along) { if (cc < sg.cLo || cc > sg.cHi) continue;
        const uAt = r => sg.runY ? U(cut.c, r + L.off.y) : U(r + L.off.x, cut.c), pts = [];
        for (let k = 0; k < n; k++) { const r = r0 + dir * k * sg.tr; pts.push([uAt(r), zf + k * hR], [uAt(r), zf + (k + 1) * hR]); if (k < n - 1) pts.push([uAt(r + dir * sg.tr), zf + (k + 1) * hR]); }
        for (let k = 1; k < pts.length; k++) lines.push([pts[k - 1], pts[k], 'REZ']);
        const ua = uAt(r0), ub = uAt(r0 + dir * (n - 1) * sg.tr), slope = ((n - 1) * hR) / (Math.abs(ub - ua) || 1), off = t * Math.sqrt(1 + slope * slope);
        const zU = u => zf + (u - ua) / ((ub - ua) || 1) * (n - 1) * hR - off, uStart = ua + (ub - ua) * (off / ((n - 1) * hR || 1));
        lines.push([[uStart, zf], [ub, zU(ub)], 'REZ'], [[ub, zU(ub)], [ub, zf + (n - 1) * hR], 'REZ']);
        umin = Math.min(umin, ua, ub); umax = Math.max(umax, ua, ub);
        // otvor u ploči: gdje bi do ploče bilo manje od 210 cm
        const need = H - 210 - 20; let kOpen = n; for (let k = 0; k < n; k++) if (((sg.k0 || 0) + k) * hR > need) { kOpen = k; break; }
        const uo = uAt(r0 + dir * Math.max(0, kOpen - 1) * sg.tr); holes.push([Math.min(uo, ub), Math.max(uo, ub)]);
        texts.push({ u: ua + (ub - ua) * 0.3, z: zf + 25, t: n + ' × ' + String(Math.round(hR * 10) / 10).replace('.', ',') + ' / ' + (n - 1) + ' × ' + String(Math.round(sg.tr * 10) / 10).replace('.', ','), h: 14, lay: 'KOTE', al: 'c' });
      } else { const rr = cut.o === 'H' ? cf : cf; const lo = Math.min(r0, r0 + dir * (n - 1) * sg.tr), hi = Math.max(r0, r0 + dir * (n - 1) * sg.tr); if (rr < lo - sg.tr || rr > hi) continue;
        const k = Math.max(0, Math.min(n - 1, Math.ceil(((rr - r0) * dir) / sg.tr - 1e-6))), zt = zf + (k + 0) * hR + hR, ca = sg.runY ? U(sg.cLo + L.off.x, 0) : U(0, sg.cLo + L.off.y), cb = sg.runY ? U(sg.cHi + L.off.x, 0) : U(0, sg.cHi + L.off.y);
        const u0 = Math.min(ca, cb), u1 = Math.max(ca, cb), zb = Math.max(zf, zt - hR - t); R4(u0, zb, u1, zt, 'REZ'); hatch(lines, u0, zb, u1, zt);
        if (zt - zf > H - 230) holes.push([u0, u1]); }
    }
    const minus = (a, b) => { let parts = [[a, b]]; for (const [h0, h1] of holes) parts = parts.flatMap(([p, q]) => { const r = []; if (h0 > p) r.push([p, Math.min(q, h0)]); if (h1 < q) r.push([Math.max(p, h1), q]); return r.filter(([m2, n2]) => n2 - m2 > 0.5); }); return parts; };
    // otvori (i unutarnji) presječeni crtom
    const opsHere = [];
    for (const o of (L.out && L.out.B && L.out.B.ops) || []) { if (o._c == null || !(o._w > 0)) continue; const wl = L.out.walls.find(r => r.w && r.w.id === o.wall); if (!wl) continue; const horiz = wl.w.o === 'H';
      if ((cut.o === 'H') === horiz) continue; // zid usporedan s presjekom
      const along = o._c, line = horiz ? (wl.y0 + wl.y1) / 2 : (wl.x0 + wl.x1) / 2; if (Math.abs(along - cf) > o._w / 2) continue;
      const ov = (E.otvori || {})[o.key] || {}, isWin = o.type === 'prozor', hh = num(ov.h, null) || o.h || (isWin ? num(D.hProzor, 140) : num(D.hVrata, 205)), pp = isWin ? (ov.p != null && ov.p !== '' ? num(ov.p, 90) : o.p != null ? o.p : num(D.pProzor, 90)) : 0;
      opsHere.push({ s: line, win: isWin, h: hh, p: pp }); }
    // otvori u zidovima iza crte presjeka (u smjeru pogleda) – vide se u pogledu, ako ih ne zaklanja drugi zid
    { const look = cut.look || 1, idxOf = (arr, v) => { let lo = 0, hi = arr.length - 2; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (arr[m] <= v) lo = m; else hi = m - 1; } return lo; };
      for (const o of (L.out && L.out.B && L.out.B.ops) || []) { if (o._c == null || !(o._w > 0)) continue; const wl = L.out.walls.find(r => r.w && r.w.id === o.wall); if (!wl) continue; const horiz = wl.w.o === 'H';
        if ((cut.o === 'H') !== horiz) continue; const line = horiz ? (wl.y0 + wl.y1) / 2 : (wl.x0 + wl.x1) / 2, th = horiz ? Math.abs(wl.y1 - wl.y0) : Math.abs(wl.x1 - wl.x0);
        if ((line - cf) * -look <= th / 2) continue; // iza leđa ili presječen
        // zaklanja li drugi zid: hodaj rasterom od crte presjeka do zida otvora (na sredini otvora)
        const sArrN = cut.o === 'H' ? ys : xs, sc = o._c, iS = idxOf(sArr, sc), a0 = Math.min(cf, line), a1 = Math.max(cf, line); let hid = false;
        for (let k = idxOf(sArrN, a0); k <= idxOf(sArrN, a1); k++) { const mid = (sArrN[k] + sArrN[k + 1]) / 2; if (Math.abs(mid - line) <= th / 2 + 1) continue; const c = cut.o === 'H' ? iS * gy + k : k * gy + iS; if (res.T[c] === -2 && (mid - cf) * -look > 0) { hid = true; break; } }
        if (hid) continue;
        const ov = (E.otvori || {})[o.key] || {}, isWin = o.type === 'prozor', hh = num(ov.h, null) || o.h || (isWin ? num(D.hProzor, 140) : num(D.hVrata, 205)), pp = isWin ? (ov.p != null && ov.p !== '' ? num(ov.p, 90) : o.p != null ? o.p : num(D.pProzor, 90)) : 0;
        const ua = toU(sc - o._w / 2), ub = toU(sc + o._w / 2), v0 = Math.min(ua, ub), v1 = Math.max(ua, ub), z0 = L.zf + pp, z1 = z0 + hh;
        lines.push([[v0, z0], [v1, z0], 'OTVORI'], [[v1, z0], [v1, z1], 'OTVORI'], [[v1, z1], [v0, z1], 'OTVORI'], [[v0, z1], [v0, z0], 'OTVORI']);
        if (isWin) lines.push([[v0 + 5, z0 + 5], [v1 - 5, z0 + 5], 'OTVORI'], [[v1 - 5, z0 + 5], [v1 - 5, z1 - 5], 'OTVORI'], [[v1 - 5, z1 - 5], [v0 + 5, z1 - 5], 'OTVORI'], [[v0 + 5, z1 - 5], [v0 + 5, z0 + 5], 'OTVORI']);
        else lines.push([[v0 + 5, z0], [v0 + 5, z1 - 5], 'OTVORI'], [[v0 + 5, z1 - 5], [v1 - 5, z1 - 5], 'OTVORI'], [[v1 - 5, z1 - 5], [v1 - 5, z0], 'OTVORI']);
        texts.push({ u: (v0 + v1) / 2, z: z1 + 8, t: Math.round(o._w) + '/' + Math.round(hh), h: 13, lay: 'KOTE', al: 'c' }); } }
    for (const it of iv) {
      const u0 = Math.min(toU(it.s0), toU(it.s1)), u1 = Math.max(toU(it.s0), toU(it.s1));
      if (it.key === 'o') continue; umin = Math.min(umin, u0); umax = Math.max(umax, u1);
      const pt = P0[partOfCell(it.c)] || P0[0], zb = L === Ls[0] ? L.zBot : L.zf; let zt = pt.zTop; zmax = Math.max(zmax, zt);
      if (it.key === 'w') {
        const ii = iv.indexOf(it), outLo = ii === 0 || iv[ii - 1].key === 'o', outHi = ii === iv.length - 1 || iv[ii + 1].key === 'o', ext = outLo || outHi;
        // slojevi vanjskog zida i nosivi sloj (opeka/beton/kamen; inače najdeblji)
        const LY = ext ? wallLayers(Pp, Math.abs(it.s1 - it.s0)) : null, mat = Pp.zidMat || 'opeka', T0 = Math.abs(it.s1 - it.s0), dirO = outLo ? 1 : -1, sOut = outLo ? it.s0 : it.s1, sAt = d => sOut + dirO * d;
        let nos0 = 0, nos1 = T0; if (LY) { let ni = LY.findIndex(l => ['opeka', 'ab', 'beton', 'kamen'].includes(l.mat)); if (ni < 0) ni = LY.reduce((m2, l, k2) => l.d > LY[m2].d ? k2 : m2, 0); let acc = 0; LY.forEach((l, k2) => { if (k2 === ni) { nos0 = acc; nos1 = acc + l.d; } acc += l.d; }); }
        // stropna AB ploča ove etaže: naliježe na nosivi dio zida
        const pi = partOfCell(it.c), pE = (res.parts && res.parts[pi] ? res.parts[pi].E : L.E) || {}, pH = (res.parts && res.parts[pi] ? res.parts[pi].Hh : L.Hh) || L.Hh;
        let AB = null; if ((pE.iznad || 'grijano') !== 'kosi' && !pt.open) { const sT = L.zf + pH.h + pH.dIznad, kc = pE.konstr || {};
          if (kc.mode === 'slojevi' && (kc.sl || []).some(l => num(l.d, 0) > 0)) { let acc = 0; for (const l of kc.sl) { const d = num(l.d, 0); if (!(d > 0)) continue; if ((l.mat || slMat(l.n)) === 'ab') { AB = [sT - acc - d, sT - acc]; break; } acc += d; } }
          else { const d = kc.mode === 'ploca' ? num(kc.d, pH.dIznad) : Math.min(pH.dIznad, 25); if (d > 0) AB = [sT - d, sT]; } }
        // nazidnica na sredini nosivog dijela vanjskog zida: zid ide do njenog donjeg ruba, rog naliježe zasjekom
        let clipF = null, slopeSeg = null;
        if (ext && pt.kosi && pt.kosi.drvo && pt.kosi.drvo.naz) { const G = roofGeo(L, pt, cut, U); if (G) { const off = cut.o === 'H' ? L.off.x : L.off.y, sc = sAt((nos0 + nos1) / 2) + off, tz = G.top(sc, G.D.naz); beamBox(lines, G, sc, tz, G.D.naz); zt = tz - G.D.naz[1];
          // vanjski gornji kut zida ispod roga: odreži ga po donjem rubu roga
          const sO = sOut + off, zO = G.zU(sO); if (zO < zt - 0.5) { const sI = sAt(T0) + off, uO = G.uS(sO), uI = G.uS(sI), zI = G.zU(sI), f = u => zO + (zI - zO) * (u - uO) / ((uI - uO) || 1);
            clipF = f; const ux = uO + (uI - uO) * Math.min(1, (zt - zO) / ((zI - zO) || 1)); slopeSeg = [[uO, zO], [ux, Math.min(zt, f(ux))]]; } } }
        const n0 = lines.length;
        const op = opsHere.find(o => o.s >= it.s0 - 2 && o.s <= it.s1 + 2);
        const pieces = !op ? [[zb, zt]] : op.win ? [[zb, L.zf + op.p], [L.zf + op.p + op.h, zt]] : [[L.zf + op.h, zt]];
        const band = (a, b, adjB, adjT) => { lines.push([[u0, a], [u0, b], 'REZ'], [[u1, a], [u1, b], 'REZ']); if (!adjB || !LY) lines.push([[u0, a], [u1, a], 'REZ']); if (!adjT || !LY) lines.push([[u0, b], [u1, b], 'REZ']); if (!LY) fill(lines, u0, a, u1, b, mat);
          else { let d0 = 0; LY.forEach((l, li) => { const ua = toU(sAt(d0)), ub = toU(sAt(d0 + l.d)); fill(lines, Math.min(ua, ub), a, Math.max(ua, ub), b, l.mat); if (li < LY.length - 1) lines.push([[ub, a], [ub, b], 'REZ']); d0 += l.d; }); } };
        const abBand = (a, b) => { // ploča preko zida: bez slojeva do vanjskog ruba; sa slojevima samo nosivi dio i prema unutra, vanjski slojevi prolaze
          const dFrom = LY ? nos0 : 0, uOut = toU(sAt(0)), uA = toU(sAt(dFrom)), uIn = toU(sAt(T0));
          if (LY) { let d0 = 0; LY.forEach(l => { if (d0 + 0.01 >= nos0) return; const ua = toU(sAt(d0)), ub = toU(sAt(d0 + l.d)); fill(lines, Math.min(ua, ub), a, Math.max(ua, ub), b, l.mat); lines.push([[ub, a], [ub, b], 'REZ']); d0 += l.d; }); lines.push([[uOut, a], [uOut, b], 'REZ']); }
          else lines.push([[uOut, a], [uOut, b], 'REZ']);
          fill(lines, Math.min(uA, uIn), a, Math.max(uA, uIn), b, 'ab'); lines.push([[uA, a], [uIn, a], 'REZ'], [[uA, b], [uIn, b], 'REZ']); };
        for (const [a, b] of pieces) { if (b - a <= 0.5) continue;
          if (!AB || b <= AB[0] + 0.3 || a >= AB[1] - 0.3) { if (!AB || ext || b <= AB[0] + 0.3) band(a, b); continue; }
          if (a < AB[0] - 0.3) band(a, AB[0], false, true); abBand(Math.max(a, AB[0]), Math.min(b, AB[1])); if (ext && b > AB[1] + 0.3) band(AB[1], b, true, false); }
        if (clipF) { const tmp = lines.splice(n0); for (const ln of tmp) { const c2 = clipBelow(ln, clipF); if (c2) lines.push(c2); } lines.push([slopeSeg[0], slopeSeg[1], 'REZ']); }
        if (op && op.win) { const zm1 = L.zf + op.p, zm2 = zm1 + op.h, um = (u0 + u1) / 2; lines.push([[um - 2, zm1], [um - 2, zm2], 'OTVORI'], [[um + 2, zm1], [um + 2, zm2], 'OTVORI']); }
        continue; }
      // prostorija
      const ro = res.rooms[it.t], lvl = lv[ro.key] || {}, pod = num(lvl.pod, ro.pod || 0), ptE = (res.parts && res.parts[partOfCell(it.c)] ? res.parts[partOfCell(it.c)].Hh : L.Hh), partH = ptE.h, dI = ptE.dIznad;
      const ceil = L.zf + (lvl.h != null && lvl.h !== '' ? pod + num(lvl.h, partH) : (ro.h ? pod + ro.h : partH)), slabTop = L.zf + partH + dI;
      // skok poda unutar prostorije (crta podjele): dijelovi s različitim podom
      const sk = lvl.skok, pieces = [];
      if (sk && (sk.o === 'H' || sk.o === 'V') && Number.isFinite(+sk.c)) { const pa = sk.a != null && sk.a !== '' ? num(sk.a, pod) : pod, pb = num(sk.b, pa);
        if ((sk.o === 'V') === (cut.o === 'H')) { const sc = +sk.c; if (sc > it.s0 + 1 && sc < it.s1 - 1) { pieces.push({ s0: it.s0, s1: sc, pod: pa }, { s0: sc, s1: it.s1, pod: pb }); } else pieces.push({ s0: it.s0, s1: it.s1, pod: sc >= it.s1 - 1 ? pa : pb }); }
        else pieces.push({ s0: it.s0, s1: it.s1, pod: cf < +sk.c ? pa : pb }); }
      else pieces.push({ s0: it.s0, s1: it.s1, pod });
      let prevZ = null, prevU = null;
      for (const pc of pieces) { const a0 = toU(pc.s0), a1 = toU(pc.s1), v0 = Math.min(a0, a1), v1 = Math.max(a0, a1), zp = L.zf + pc.pod;
        lines.push([[v0, zp], [v1, zp], 'REZ']); addK(zp, fmtK(zp));
        if (L === Ls[0] && L.zBot < zp - 0.5) { R4(v0, L.zBot, v1, zp, 'REZ'); fill(lines, v0, L.zBot, v1, zp, 'ab'); }
        if (prevZ != null && Math.abs(prevZ - zp) > 0.5) { const us = prevU; lines.push([[us, Math.min(prevZ, zp)], [us, Math.max(prevZ, zp)], 'REZ']); }
        prevZ = zp; prevU = a1;
        if ((pieces.length > 1 || pc.pod !== pod) && !lvl.galerija) texts.push({ u: (v0 + v1) / 2, z: zp + 20, t: 'pod ' + (pc.pod > 0 ? '+' : '') + Math.round(pc.pod) + ' · sv.v. ' + Math.round((L.zf + (lvl.h != null && lvl.h !== '' ? pod + num(lvl.h, partH) : (ro.h ? pod + ro.h : partH))) - zp), h: 14, lay: 'KOTE', al: 'c' }); }
      const up = (L.E && res.parts && res.parts[partOfCell(it.c)] ? res.parts[partOfCell(it.c)].E.iznad : (L.E || {}).iznad) || 'grijano';
      const ptO = P0[partOfCell(it.c)] || P0[0]; if (!lvl.galerija && up !== 'kosi' && !ptO.open) { const b0 = Math.min(ceil, slabTop - 5), kE = ((res.parts && res.parts[partOfCell(it.c)] ? res.parts[partOfCell(it.c)].E : L.E) || {}).konstr || {};
        const SL = kE.mode === 'slojevi' && (kE.sl || []).some(l => num(l.d, 0) > 0) ? kE.sl.filter(l => num(l.d, 0) > 0) : null;
        for (const [p0, p1] of minus(u0, u1)) { lines.push([[p0, b0], [p1, b0], 'REZ'], [[p0, slabTop], [p1, slabTop], 'REZ']);
          const vEdge = (z0, z1, isAB) => { for (const pu of [p0, p1]) if (!isAB || (Math.abs(pu - u0) > 0.5 && Math.abs(pu - u1) > 0.5)) lines.push([[pu, z0], [pu, z1], 'REZ']); }; // AB ploča se nastavlja u zid
          if (!SL) { fill(lines, p0, b0, p1, slabTop, 'ab'); vEdge(b0, slabTop, true); }
          else { let z = slabTop; SL.forEach((l, li) => { const z2 = Math.max(b0, z - num(l.d, 0)), m3 = l.mat || slMat(l.n); fill(lines, p0, z2, p1, z, m3); vEdge(z2, z, m3 === 'ab'); if (li < SL.length - 1 && z2 > b0 + 0.3) lines.push([[p0, z2], [p1, z2], 'REZ']); z = z2; }); } }
        addK(slabTop, fmtK(slabTop)); }
      texts.push({ u: (u0 + u1) / 2, z: L.zf + pod + (ceil - L.zf - pod) / 2 + 12, t: ro.name || '', h: 18, lay: 'NASLOV', al: 'c' });
      if (!lvl.galerija && !ptO.open && pieces.length < 2 && pieces[0].pod === pod) texts.push({ u: (u0 + u1) / 2, z: L.zf + pod + (ceil - L.zf - pod) / 2 - 14, t: 'sv.v. ' + Math.round(ceil - L.zf - pod), h: 16, lay: 'KOTE', al: 'c' });
    }
    if (L.zf) addK(L.zf, fmtK(L.zf));
    // krov presječen ravninom
    for (const pt of P0) { if (!pt.kosi || !(pt.AZ > 0) || !Number.isFinite(pt.bbox.x0)) continue;
      const tn = timber(L, pt, cut, U, lines, texts); if (tn && tn.length) S2.drvo = tn;
      for (const fc of roofFacesPart(L, pt)) { const P = fc.pts, hits = [];
        for (let k = 0; k < P.length; k++) { const a = P[k], b = P[(k + 1) % P.length], va = cut.o === 'H' ? a[1] : a[0], vb = cut.o === 'H' ? b[1] : b[0];
          if ((va - cut.c) * (vb - cut.c) > 0 || va === vb) continue; const t = (cut.c - va) / (vb - va); if (t < 0 || t > 1) continue; hits.push([U(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t), a[2] + (b[2] - a[2]) * t]); }
        if (hits.length < 2) continue; const [a, b] = hits;
        if (fc.wall) { lines.push([a, b, 'REZ']); continue; }
        const rb = fc.rb, cA = fc.cosA, tk = fc.tUp, sh = d => [[a[0], a[1] + d / cA], [b[0], b[1] + d / cA]];
        // rog (i slojevi iznad) cijelom dužinom, slojevi ispod samo unutar zgrade
        let acc = rb.rog; lines.push([...sh(0), 'REZ'], [...sh(rb.rog), 'REZ']); for (const l of rb.up.slice().reverse()) { acc += num(l.d, 0); lines.push([...sh(acc), acc >= rb.top - 0.01 ? 'REZ' : 'KROV']); }
        if (Math.abs(a[0] - b[0]) > 1) lines.push([[a[0], a[1]], [a[0], a[1] + tk], 'REZ'], [[b[0], b[1]], [b[0], b[1] + tk], 'REZ']);
        if (rb.dn.length) { const bu = [U(pt.bbox.x0 + L.off.x, pt.bbox.y0 + L.off.y), U(pt.bbox.x1 + L.off.x, pt.bbox.y1 + L.off.y)], wu0 = cut.o === 'H' ? Math.min(...bu) : Math.min(...bu), wu1 = Math.max(...bu);
          const clip = (p, q) => { const lo = Math.max(Math.min(p[0], q[0]), wu0), hi = Math.min(Math.max(p[0], q[0]), wu1); if (hi - lo < 1) return null; const zAt = u => Math.abs(q[0] - p[0]) < 1e-6 ? p[1] : p[1] + (q[1] - p[1]) * (u - p[0]) / (q[0] - p[0]); return [[lo, zAt(lo)], [hi, zAt(hi)]]; };
          let dd = 0; for (const l of rb.dn) { dd += num(l.d, 0); const c2 = clip(...sh(-dd)); if (c2) lines.push([...c2, dd >= rb.sDn - 0.01 ? 'REZ' : 'KROV']); } }
        if (!S2.sastav) S2.sastav = rb;
        zmax = Math.max(zmax, a[1] + tk, b[1] + tk); umin = Math.min(umin, a[0], b[0]); umax = Math.max(umax, a[0], b[0]); addK(Math.max(a[1], b[1]) + tk, fmtK(Math.max(a[1], b[1]) + tk)); } }
  }
  if (!any || !Number.isFinite(umin)) return null;
  const td = num(Pp.terenDef, 15), tz = -td; addK(0, '±0,00');
  lines.push([[umin - 200, tz], [umax + 200, tz], 'TEREN']); for (let u = umin - 190; u < umax + 200; u += 30) lines.push([[u, tz], [u - 15, tz - 15], 'TEREN']);
  const ku = umax + 120; let lastZ = -1e9, flip = false; for (const [z, t] of [...kotes].sort((p, q) => p[0] - q[0])) { flip = z - lastZ < 30 ? !flip : false; lastZ = z; lines.push([[ku - 40, z], [ku + 60, z], 'KOTE'], [[ku, z], [ku - 10, z + 14], 'KOTE'], [[ku - 10, z + 14], [ku + 10, z + 14], 'KOTE'], [[ku + 10, z + 14], [ku, z], 'KOTE']); texts.push(flip ? { u: ku - 46, z: z - 20, t, h: 22, lay: 'KOTE', al: 'r' } : { u: ku + 16, z: z + 6, t, h: 22, lay: 'KOTE', al: 'l' }); }
  const nm = cut.name || String.fromCharCode(65 + idx) + '–' + String.fromCharCode(65 + idx);
  texts.push({ u: (umin + umax) / 2, z: tz - 110, t: 'PRESJEK ' + nm, h: 35, lay: 'NASLOV', al: 'c' });
  let zLow = tz - 150;
  if (S2.sastav) { const rb = S2.sastav, rows = ['SASTAV KROVA (odozgo):'].concat(rb.up.map(l => (l.n || 'sloj') + ' ' + fmtD(num(l.d, 0)) + ' cm'), ['rogovi ' + fmtD(rb.rog) + ' cm'], rb.dn.map(l => (l.n || 'sloj') + ' ' + fmtD(num(l.d, 0)) + ' cm'), ['ukupno ' + fmtD(rb.top + rb.sDn) + ' cm'], S2.drvo ? ['', 'DRVENA KONSTRUKCIJA (b/h cm):'].concat(S2.drvo) : []);
    rows.forEach((t, k) => { if (t) texts.push({ u: umin - 150, z: tz - 175 - k * 26, t, h: k && !/:$/.test(t) ? 18 : 20, lay: k && !/:$/.test(t) ? 'KOTE' : 'NASLOV', al: 'l' }); }); zLow = tz - 175 - rows.length * 26 - 20; }
  return { key: 'presjek' + idx, strana: nm, name: 'PRESJEK ' + nm, section: true, lines, texts, openings: [], bbox: { u0: umin - 320, u1: ku + 120, z0: zLow, z1: zmax + 60 } };
}
function build(floors, Pp, north) {
  const Ls = prepareFloors(floors); const views = [];
  for (const v of VIEWS) { const r = buildView(Ls, v, Pp || {}, north); if (r) views.push(r); }
  ((Pp || {}).presjeci || []).forEach((c, i) => { const r = buildSection(Ls, c, Pp || {}, i); if (r) views.push(r); });
  return { views, levels: Ls };
}
/* DXF: pogledi jedan do drugog */
const LAY = { REZ: ['PRESJEK_REZ', 7], SRAF: ['PRESJEK_SRAFURA', 8], OBRIS: ['POGLED_OBRIS', 7], OTVORI: ['POGLED_OTVORI', 4], KROV: ['POGLED_KROV', 1], TEREN: ['POGLED_TEREN', 8], KOTE: ['POGLED_KOTE', 5], NASLOV: ['POGLED_NASLOV', 7] };
function toDxf(res) {
  const C = root.IzmjeraTlocrtCore, out = { lines: [], arcs: [], texts: [], polys: [], circles: [], dims: [] }; let x = 0;
  for (const v of res.views) { const dx = x - v.bbox.u0; for (const [a, b, lay] of v.lines) out.lines.push({ layer: LAY[lay][0], a: { x: a[0] + dx, y: -a[1] }, b: { x: b[0] + dx, y: -b[1] } }); for (const t of v.texts) out.texts.push({ layer: LAY[t.lay][0], x: t.u + dx, y: -t.z, text: t.t, h: t.h, rot: 0, align: t.al === 'l' ? 'l' : 'c' }); x += v.bbox.u1 - v.bbox.u0 + 300; }
  const saved = C.LAYERS.slice(); C.LAYERS.length = 0; C.LAYERS.push(...Object.values(LAY));
  try { return C.toDxf(out); } finally { C.LAYERS.length = 0; C.LAYERS.push(...saved); }
}
/* PDF: svaki pogled na svojoj stranici, M 1:100 (ili sitnije ako ne stane) */
function toPdf(res, meta) {
  const P = root.IzmjeraPdf, doc = new P.Doc(), set = P.settings(), logo = set.logo ? doc.jpeg(set.logo) : null, f = P.f, cmPt = 72 / 2.54, n = res.views.length;
  const LW = { REZ: 0.7, SRAF: 0.15, OBRIS: 0.6, OTVORI: 0.3, KROV: 0.45, TEREN: 0.35, KOTE: 0.25 };
  res.views.forEach((v, i) => {
    const W = 841.89, H = 595.276, hf = P.headerFooter(doc, W, H, { logoImg: logo, project: meta.project, floor: v.section ? v.name.replace('PRESJEK', 'Presjek') : v.name.replace('POGLED', 'Pročelje'), title: meta.title, firma: set.firma, date: P.today(), pageNo: i + 1, pageCount: n });
    const bw = v.bbox.u1 - v.bbox.u0, bh = v.bbox.z1 - v.bbox.z0, aw = hf.right - hf.left - 10, ah = hf.top - hf.bottom - 30;
    let sc = [100, 150, 200, 250, 500].find(s => bw * cmPt / s <= aw && bh * cmPt / s <= ah) || 0, k = sc ? cmPt / sc : Math.min(aw / bw, ah / bh);
    const ox = (hf.left + hf.right) / 2 - (v.bbox.u0 + bw / 2) * k, oy = (hf.bottom + hf.top) / 2 - (v.bbox.z0 + bh / 2) * k - 6;
    let c = hf.content + 'q 0 0 0 RG 1 J 1 j\n';
    for (const lay of Object.keys(LW)) { const L2 = v.lines.filter(l => l[2] === lay); if (!L2.length) continue; c += f(LW[lay]) + ' w\n' + L2.map(([a, b]) => f(ox + a[0] * k) + ' ' + f(oy + a[1] * k) + ' m ' + f(ox + b[0] * k) + ' ' + f(oy + b[1] * k) + ' l S').join('\n') + '\n'; }
    c += '0 g\n'; for (const t of v.texts) c += P.text(t.t, ox + t.u * k, oy + t.z * k, Math.max(6, t.h * k * 0.9), { align: t.al === 'l' ? 'l' : t.al === 'r' ? 'r' : 'c', bold: t.lay === 'NASLOV' });
    c += P.text(sc ? 'M 1:' + sc : 'nije u mjerilu', hf.right, hf.bottom + 4, 8, { align: 'r' }) + 'Q\n';
    doc.page(W, H, c);
  });
  return doc.bytes();
}
root.IzmjeraProcelja = { MATS, kosiFromH, extT, roofBuild, DEF_UP, build, toDxf, toPdf, prepareFloors, roofFaces, VIEWS };
})(typeof window !== 'undefined' ? window : globalThis);
