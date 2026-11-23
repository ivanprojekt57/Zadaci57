/* Izmjera 57 — list A3 u stilu nacrta Projekt 57: okvir, sastavnica, kote s kosom crticom.
   Sve se crta kao popis elemenata u mm na papiru (ishodište dolje lijevo), pa isti list ide u PDF i u DXF. */
(function (root) {
'use strict';
const D = () => root.IzmjeraSastavnicaData || {};
const SW = 420, SH = 297, IN = { x0: 25, y0: 6, x1: 414, y1: 291 };
const MJ = ['siječanj', 'veljača', 'ožujak', 'travanj', 'svibanj', 'lipanj', 'srpanj', 'kolovoz', 'rujan', 'listopad', 'studeni', 'prosinac'];
const datum = d => { d = d || new Date(); return MJ[d.getMonth()] + ', ' + d.getFullYear() + '.'; };

function Sheet(w, h) { this.p = []; this.w = w || SW; this.h = h || SH; } /* A3 položeno (420×297) ili A4 uspravno (210×297) */
Sheet.prototype.L = function (a, b, w, o) { this.p.push(Object.assign({ t: 'L', a, b, w: w || 0.18 }, o || {})); return this; };
Sheet.prototype.T = function (x, y, s, txt, o) { if (txt == null || txt === '') return this; this.p.push(Object.assign({ t: 'T', x, y, s, txt: String(txt) }, o || {})); return this; };
Sheet.prototype.F = function (pts, g) { this.p.push({ t: 'F', pts, g }); return this; };
Sheet.prototype.I = function (img, x, y, w, h) { this.p.push({ t: 'I', img, x, y, w, h }); return this; };
Sheet.prototype.rect = function (x0, y0, x1, y1, w, o) { return this.L([x0, y0], [x1, y0], w, o).L([x1, y0], [x1, y1], w, o).L([x1, y1], [x0, y1], w, o).L([x0, y1], [x0, y0], w, o); };

/* kota kao na nacrtima: pomoćne crte od predmeta (razmak 0,8 mm, prepust 0,8 mm), kosa crtica 45°, kotna crta produžena 1,4 mm, tekst iznad crte (2,0 mm) */
Sheet.prototype.dim = function (A, B, off, txt, o) {
  o = o || {}; const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy); if (L < 0.01) return this;
  const ux = dx / L, uy = dy / L; let nx = -uy, ny = ux; /* normala lijevo od A→B */
  const P = (p, d) => [p[0] + nx * d, p[1] + ny * d], a = P(A, off), b = P(B, off), sg = off >= 0 ? 1 : -1, exo = 0.8, exe = 0.8, ex = 1.4, tk = 1.0, lay = o.lay || 'KOTE';
  if (!o.noExtA) this.L(P(A, sg * exo), P(A, off + sg * exe), 0.13, { lay });
  if (!o.noExtB) this.L(P(B, sg * exo), P(B, off + sg * exe), 0.13, { lay });
  this.L([a[0] - ux * ex, a[1] - uy * ex], [b[0] + ux * ex, b[1] + uy * ex], 0.13, { lay });
  for (const q of [a, b]) this.L([q[0] - (ux + nx) * tk * 0.707, q[1] - (uy + ny) * tk * 0.707], [q[0] + (ux + nx) * tk * 0.707, q[1] + (uy + ny) * tk * 0.707], 0.35, { lay });
  let rot = Math.atan2(uy, ux) * 180 / Math.PI; if (rot > 90.01) rot -= 180; else if (rot < -89.99) rot += 180;
  /* tekst uvijek na „gornjoj” strani crte (gledano kao što se čita) */
  const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], r = rot * Math.PI / 180, upx = -Math.sin(r), upy = Math.cos(r);
  return this.T(m[0] + upx * 0.7, m[1] + upy * 0.7, o.s || 2.0, txt, { al: 'c', rot, lay });
};

/* okvir lista, gornja traka s nazivom, donja traka (naslov, propis, ukupno) i sastavnica */
function frame(S, o) {
  o = o || {}; const I = { x0: 25, y0: 6, x1: S.w - 6, y1: S.h - 6 }, X = x => I.x0 + x, Y = y => I.y0 + y, iw = I.x1 - I.x0, ih = I.y1 - I.y0;
  S.rect(0, 0, S.w, S.h, 0.13, { lay: 'OKVIR' }).rect(I.x0, I.y0, I.x1, I.y1, 0.5, { lay: 'OKVIR' });
  if (o.top) { S.L([X(0), Y(ih - 14)], [X(iw), Y(ih - 14)], 0.35, { lay: 'OKVIR' }); S.T(X(iw / 2), Y(ih - 9.4), 3.5, o.top, { al: 'c', i: 1, lay: 'SASTAVNICA' }); }
  if (o.band) { S.L([X(0), Y(42)], [X(210), Y(42)], 0.35, { lay: 'OKVIR' }).L([X(0), Y(28)], [X(210), Y(28)], 0.25, { lay: 'OKVIR' });
    S.T(X(105), Y(34.6), 5, o.band.title, { al: 'c', i: 1, lay: 'SASTAVNICA' }).T(X(105), Y(30.2), 2.0, o.band.sub, { al: 'c', i: 1, lay: 'SASTAVNICA' });
    const tl = wrap(o.band.total || '', 3.25, 200); tl.forEach((t, k) => S.T(X(105), Y(14.5 + (tl.length - 1) * 2.6 - k * 5.2), 3.25, t, { al: 'c', i: 1, lay: 'SASTAVNICA' })); }
  sastavnica(S, I.x1, I.y0, o.sast || {});
  return { x0: I.x0, y0: I.y0 + 42, x1: I.x1, y1: I.y1 - (o.top ? 14 : 0) };
}
function sastavnica(S, rx, by, f) {
  const P = (x, y) => [rx + x, by + y], lay = 'SASTAVNICA', T = (x, y, s, t, al, i) => S.T(rx + x, by + y, s, t, { al: al || 'l', i: i == null ? 1 : i, lay }), Ln = (a, b, c, d, w) => S.L(P(a, b), P(c, d), w || 0.25, { lay });
  Ln(-179, 0, 0, 0, 0.35); Ln(-179, 42, 0, 42, 0.35); Ln(-179, 0, -179, 42, 0.35); Ln(0, 0, 0, 42, 0.35); Ln(-179, 28, 0, 28); Ln(-119, 14, 0, 14); Ln(-119, 0, -119, 42); Ln(-59, 0, -59, 42); Ln(-59, 7, 0, 7); Ln(-29.5, 0, -29.5, 14);
  const d = D();
  if (d.LOGO) S.I('LOGO', rx - 178.6, by + 28.5, 15.1, 13.0);
  T(-162.3, 36.0, 2.0, 'P R O J E K T  5 7  d.o.o.'); T(-162.3, 32.6, 2.0, 'Ulica Pere Devčića 47, Zaprešić');
  T(-177.8, 25.0, 1.75, 'PROJEKTANT: Ivan Lulić, mag.ing.aedif.  G5647');
  if (d.ZIG) S.I('ZIG', rx - 170.5, by + 0.6, 43.0, 21.0);
  T(-117.8, 39.0, 2.0, 'investitor:'); T(-89, 35.0, 2.2, f.inv1, 'c'); T(-89, 31.6, 2.2, f.inv2, 'c');
  T(-117.8, 25.0, 2.0, 'građevina:'); T(-89, 19.5, 2.2, f.gradjevina, 'c');
  T(-117.8, 11.0, 2.0, 'lokacija:'); T(-89, 7.3, 2.2, f.lok1, 'c'); T(-89, 3.9, 2.2, f.lok2, 'c');
  T(-57.8, 39.0, 2.0, 'strukovna odrednica:'); T(-29.5, 32.0, 2.5, f.odrednica || 'SNIMKA IZVEDENOG STANJA', 'c');
  T(-57.8, 25.0, 2.0, 'sadržaj:'); { const sz = (f.sadrzaj || '').length > 30 ? 2.0 : 3.0, sl = wrap(f.sadrzaj || '', sz, 54); sl.forEach((t, k) => T(-29.5, 18.6 + (sl.length - 1) * 1.5 - k * 3.0, sz, t, 'c')); }
  T(-57.8, 11.4, 2.0, 'T.D.:'); T(-42.5, 8.4, 2.5, f.td, 'c'); T(-28.3, 11.4, 2.0, 'mjerilo:'); T(-9.5, 8.4, 2.5, f.mjerilo, 'c');
  T(-57.8, 4.4, 2.0, 'datum:'); T(-40.5, 1.4, 2.2, f.datum || datum(), 'c'); T(-28.3, 4.4, 2.0, 'list broj:'); T(-9.5, 1.4, 3.0, f.list, 'c');
}
function textW(t) { const P = root.IzmjeraPdf; return P ? P.textW(t) : String(t).length * 0.55; }
function wrap(t, s, maxW) { const w = String(t).split(' '), out = []; let cur = ''; for (const x of w) { const nx = cur ? cur + ' ' + x : x; if (textW(nx) * s / 0.716 > maxW && cur) { out.push(cur); cur = x; } else cur = nx; } if (cur) out.push(cur); return out; }

/* podaci za sastavnicu iz podataka o projektu */
function fromInfo(extra) { const i = root.projectInfo || {}, kc = [i.kc ? 'k.č.br. ' + i.kc : '', i.ko ? 'k.o. ' + i.ko : ''].filter(Boolean).join(', ');
  return Object.assign({ inv1: (i.invIme || '').toUpperCase(), inv2: i.invAdresa || '', gradjevina: (i.gradjevina || '').toUpperCase(), lok1: i.adresa || '', lok2: kc, td: i.td || i.broj || '' }, extra || {}); }

/* --- PDF --- */
const MM = 72 / 25.4, FS = s => s * MM / 0.716;
function toPdf(sheets) {
  const P = root.IzmjeraPdf, doc = new P.Doc(), f = P.f, d = D(), imgs = {};
  const img = k => imgs[k] !== undefined ? imgs[k] : (imgs[k] = d[k] ? doc.jpeg(d[k]) : null);
  for (const S of sheets) { let c = 'q 0 0 0 RG 0 0 0 rg 1 J 1 j\n';
    for (const e of S.p) {
      if (e.t === 'F') c += f(e.g) + ' g ' + e.pts.map((p, i) => f(p[0] * MM) + ' ' + f(p[1] * MM) + (i ? ' l' : ' m')).join(' ') + ' h f 0 g\n';
      else if (e.t === 'L') c += f(e.w * MM) + ' w ' + (e.dash ? '[' + f(1.5 * MM) + ' ' + f(0.8 * MM) + '] 0 d ' : '') + f(e.a[0] * MM) + ' ' + f(e.a[1] * MM) + ' m ' + f(e.b[0] * MM) + ' ' + f(e.b[1] * MM) + ' l S' + (e.dash ? ' [] 0 d' : '') + '\n';
      else if (e.t === 'I') { const im = img(e.img); if (im) c += 'q ' + f(e.w * MM) + ' 0 0 ' + f(e.h * MM) + ' ' + f(e.x * MM) + ' ' + f(e.y * MM) + ' cm ' + im.name + ' Do Q\n'; }
      else if (e.t === 'T') c += P.text(e.txt, e.x * MM, e.y * MM, FS(e.s), { align: e.al || 'l', rot: e.rot || 0, bold: !!e.b, italic: !!e.i });
    }
    doc.page(S.w * MM, S.h * MM, c + 'Q\n'); }
  return doc.bytes();
}
/* --- DXF: listovi jedan do drugog, u mjerilu lista (1 mm papira = mjerilo/10 cm) --- */
const LAY = [['OKVIR', 7], ['SASTAVNICA', 7], ['KOTE', 5], ['LEG_OBRIS', 7], ['LEG_GRANICE', 8], ['LEG_GRANICA_VISINE', 1], ['LEG_OTVORENO', 30], ['LEG_SRAFURA', 9], ['LEG_TEKST', 7], ['ZIG', 7]];
function toDxf(sheets) {
  const C = root.IzmjeraTlocrtCore, out = { lines: [], arcs: [], texts: [], polys: [], circles: [], dims: [] }, d = D(); let ox = 0;
  for (const S of sheets) { const k = (S.sc || 100) / 10, M = p => ({ x: ox + p[0] * k, y: -p[1] * k }); /* jezgra DXF-a okreće y */
    for (const e of S.p) {
      if (e.t === 'L') out.lines.push({ layer: e.lay || 'LEG_OBRIS', a: M(e.a), b: M(e.b) });
      else if (e.t === 'T') { const q = M([e.x, e.y]); out.texts.push({ layer: e.lay || 'LEG_TEKST', x: q.x, y: q.y, text: e.txt, h: e.s * k, rot: e.rot || 0, align: e.al || 'l' }); }
      else if (e.t === 'I' && e.img === 'ZIG') { const rx = e.x + 170.5, by = e.y - 0.6; for (const l of d.ZIG_LINES || []) out.lines.push({ layer: 'ZIG', a: M([rx + l[0], by + l[1]]), b: M([rx + l[2], by + l[3]]) }); for (const t of d.ZIG_TEXTS || []) { const q = M([rx + t[0], by + t[1]]); out.texts.push({ layer: 'ZIG', x: q.x, y: q.y, text: t[3], h: t[2] * k, rot: 0, align: 'l' }); } }
    }
    ox += (S.w + 20) * k; }
  const used = new Set(out.lines.map(l => l.layer).concat(out.texts.map(t => t.layer))), known = new Map(LAY.concat(C.LAYERS.map(l => [l[0], l[1]])));
  const lays = LAY.slice(); for (const n of used) if (!lays.some(l => l[0] === n)) lays.push([n, known.get(n) || (/KOTE/.test(n) ? 5 : /OTVORI/.test(n) ? 4 : 7)]);
  const saved = C.LAYERS.slice(); C.LAYERS.length = 0; C.LAYERS.push(...lays);
  try { return C.toDxf(out); } finally { C.LAYERS.length = 0; C.LAYERS.push(...saved); }
}

/* korisni prostor lista (iznad sastavnice, ispod gornje trake) za zadani format */
const area = (w, h) => ({ x0: 25, y0: 6 + 42, x1: w - 6, y1: h - 6 - 14 });
root.IzmjeraSastavnica = { Sheet, frame, fromInfo, toPdf, toDxf, datum, IN, SW, SH, wrap, area, A4: [210, 297], A3: [420, 297] };
})(typeof window !== 'undefined' ? window : globalThis);
