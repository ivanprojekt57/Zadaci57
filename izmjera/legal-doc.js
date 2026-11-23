/* Izmjera 57 — legalizacija: punjenje korisnikovih predložaka (Excel snimke izvedenog stanja i Word izjave statičara).
   Predložak se ne mijenja, nastaje nova datoteka. Polja se traže po natpisima (PODNOSITELJ ZAHTJEVA:, Broj etaža: …), ne po fiksnim ćelijama. */
(function (root) {
'use strict';
const I = () => root.IzmjeraIzvjesce, te = new TextEncoder();
const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main', XDR = 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing', A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const NSR = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships', NSP = 'http://schemas.openxmlformats.org/package/2006/relationships';
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const xmlParse = t => new DOMParser().parseFromString(t, 'application/xml'), ser = d => te.encode(new XMLSerializer().serializeToString(d));
const resolve = (base, t) => { if (t.startsWith('/')) return t.slice(1); const p = base.split('/'); p.pop(); for (const x of t.split('/')) { if (x === '..') p.pop(); else if (x !== '.') p.push(x); } return p.join('/'); };
const relsOf = f => { const p = f.split('/'), n = p.pop(); return p.concat('_rels', n + '.rels').join('/'); };
const norm = s => String(s || '').trim().toLowerCase();

/* ---------- Excel ---------- */
const sheetBy = (B, re) => B.sheets.find(s => re.test(s.name.trim()));
function cellsOf(B, s) { return I().readCells(B, s.name); }
const rc = ref => { const m = /^([A-Z]+)(\d+)$/.exec(ref); return { c: I().colNum(m[1]), r: +m[2] }; };
/* vrijednost uz natpis: prva ćelija desno u istom redu koja u predlošku ima sadržaj (ili zadani stupac) */
function valueRef(cells, label, dflt) { const L = rc(label); let best = null; for (const [ref, v] of Object.entries(cells)) { const p = rc(ref); if (p.r === L.r && p.c > L.c && v !== '' && v != null && (!best || p.c < rc(best).c)) best = ref; } return best || (I().colName(dflt || L.c + 2) + L.r); }
function findLabel(cells, re) { const hit = Object.entries(cells).filter(([, v]) => typeof v === 'string' && re.test(v.trim())).sort((a, b) => rc(a[0]).r - rc(b[0]).r || rc(a[0]).c - rc(b[0]).c); return hit.length ? hit[0][0] : null; }
function hideRows(B, s, rows, hide) { const doc = B.docs.get(s.target); for (const r of doc.getElementsByTagNameNS(NS, 'row')) if (rows.includes(+r.getAttribute('r'))) { if (hide) r.setAttribute('hidden', '1'); else r.removeAttribute('hidden'); } B.dirty.add(s.target); }
async function drawingOf(B, s) { const rl = await B.doc(relsOf(s.target)); if (!rl) return null; const r = [...rl.getElementsByTagNameNS(NSP, 'Relationship')].find(x => /\/drawing$/.test(x.getAttribute('Type'))); if (!r) return null; const p = resolve(s.target, r.getAttribute('Target')); return { path: p, doc: await B.doc(p) }; }
/* tekstualni okvir (oblik s tekstom): odlomci se zamijene, oblikovanje prvog teksta ostaje */
function shapes(dd) { return [...dd.getElementsByTagNameNS(XDR, 'sp')].filter(sp => sp.getElementsByTagNameNS(XDR, 'txBody')[0]); }
const shapeText = sp => [...sp.getElementsByTagNameNS(A, 't')].map(t => t.textContent).join('');
function setShape(sp, paras) {
  const tb = sp.getElementsByTagNameNS(XDR, 'txBody')[0], ps = [...tb.getElementsByTagNameNS(A, 'p')], doc = sp.ownerDocument;
  const rpr0 = tb.getElementsByTagNameNS(A, 'rPr')[0], ppr0 = ps.length ? ps[0].getElementsByTagNameNS(A, 'pPr')[0] : null;
  ps.forEach(p => p.parentNode.removeChild(p));
  for (const para of paras) { const p = doc.createElementNS(A, 'a:p'); if (ppr0) p.appendChild(ppr0.cloneNode(true));
    const runs = Array.isArray(para) ? para : para === '' ? [] : [[para, false]];
    for (const [t, bold] of runs) { const r = doc.createElementNS(A, 'a:r'), rp = rpr0 ? rpr0.cloneNode(true) : doc.createElementNS(A, 'a:rPr'); if (bold) rp.setAttribute('b', '1'); else rp.removeAttribute('b'); r.appendChild(rp); const tt = doc.createElementNS(A, 'a:t'); tt.textContent = t; r.appendChild(tt); p.appendChild(r); }
    if (!runs.length && rpr0) { const e = doc.createElementNS(A, 'a:endParaRPr'); for (const at of [...rpr0.attributes]) e.setAttribute(at.name, at.value); e.removeAttribute('b'); p.appendChild(e); }
    tb.appendChild(p); }
}
/* slika „stane” u okvir (bijeli rub), za kopiju plana i uvjerenja */
async function containToFrame(src, aspect) { const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(Error('Slika se ne može učitati.')); i.src = src; });
  const a = aspect || 0.72, Wd = a >= 1 ? 2000 : Math.round(2000 * a), Hd = a >= 1 ? Math.round(2000 / a) : 2000, cv = document.createElement('canvas'); cv.width = Wd; cv.height = Hd; const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, Wd, Hd);
  const s = Math.min(Wd / im.width, Hd / im.height), w = im.width * s, h = im.height * s; g.drawImage(im, (Wd - w) / 2, (Hd - h) / 2, w, h); return cvBytes(cv); }
function placeholder(text, aspect) { const a = aspect || 0.72, Wd = 1200, Hd = Math.round(1200 / a), cv = document.createElement('canvas'); cv.width = Wd; cv.height = Hd; const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, Wd, Hd); g.strokeStyle = '#999'; g.lineWidth = 4; g.strokeRect(6, 6, Wd - 12, Hd - 12); g.fillStyle = '#777'; g.font = '44px Arial'; g.textAlign = 'center'; text.split('\n').forEach((t, k, arr) => g.fillText(t, Wd / 2, Hd / 2 - (arr.length - 1) * 32 + k * 64)); return cvBytes(cv); }
async function cvBytes(cv) { const b = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.88)); return new Uint8Array(await b.arrayBuffer()); }

/* d: { inv, invAdr, invOib, td, gradjevina, kc, lokAdr, datum, uvod:[...], opis:[...], inst:[...], gbp:[[naziv, m2]], vol:[[naziv, m3]], katnost, visina, namjena, polozaj, listovi:[[br, naziv, mjerilo]], kp, dgu:[], foto:[] (dataURL) } */
async function fillSnimka(u8, d) {
  const IZ = I(), B = await IZ.openTemplate(u8), warn = [];
  /* naslovnica */
  const nas = sheetBy(B, /^naslovnica/i) || B.sheets[0], nc = cellsOf(B, nas), put = {};
  const lab = (re, vals) => { const L = findLabel(nc, re); if (!L) { warn.push('Na naslovnici nema natpisa ' + re.source); return; } const v0 = valueRef(nc, L), p = rc(v0), col = I().colName(p.c); vals.forEach((v, k) => { if (v != null) put[col + (p.r + k)] = v; }); };
  lab(/^PODNOSITELJ ZAHTJEVA|^INVESTITOR/i, [d.inv, d.invAdr, d.invOib ? 'OIB: ' + d.invOib : '']);
  lab(/^T\.D\./i, [d.td]); lab(/^GRAĐEVINA/i, [d.gradjevina]); lab(/^LOKACIJA/i, [d.kc, d.lokAdr]);
  const dt = findLabel(nc, /^Zaprešić,|,\s*(siječanj|veljača|ožujak|travanj|svibanj|lipanj|srpanj|kolovoz|rujan|listopad|studeni|prosinac)\s+\d{4}/i); if (dt) put[dt] = d.datum;
  IZ.setCells(B, put, nas.name);
  /* iskaz površina */
  const isk = sheetBy(B, /^2\.6/); if (isk) { const c = cellsOf(B, isk), set = {};
    const block = (re, rows, unit) => { const L = findLabel(c, re); if (!L) return; const r0 = rc(L).r; let uk = null; for (let r = r0 + 1; r < r0 + 14; r++) { if (Object.entries(c).some(([ref, v]) => rc(ref).r === r && /^ukupno/i.test(String(v)))) { uk = r; break; } } if (!uk) return;
      const lr = Object.entries(c).filter(([ref, v]) => rc(ref).r > r0 && rc(ref).r < uk && typeof v === 'string' && /:\s*$/.test(v)).map(([ref]) => ref), slots = lr.length ? lr : [];
      const cl = slots.length ? I().colName(rc(slots[0]).c) : 'D', cv = I().colName((slots.length ? rc(slots[0]).c : 4) + 1), cu = I().colName((slots.length ? rc(slots[0]).c : 4) + 2), used = [];
      rows.forEach(([n, v], k) => { const r = slots[k] ? rc(slots[k]).r : null; if (!r) { warn.push('Premalo redaka za etaže u iskazu (' + n + ')'); return; } set[cl + r] = n + ':'; set[cv + r] = Math.round(v * 100) / 100; set[cu + r] = unit; used.push(r); });
      const extra = slots.map(s => rc(s).r).filter(r => !used.includes(r)); extra.forEach(r => { set[cl + r] = ''; set[cv + r] = ''; set[cu + r] = ''; }); IZ.setCells(B, set, isk.name); hideRows(B, isk, extra, true); hideRows(B, isk, used, false); };
    block(/^Građevinska bruto površina/i, d.gbp, 'm2'); block(/^Obujam zgrade/i, d.vol, 'm3');
    const one = (re, v) => { if (v == null) return; const L = findLabel(c, re); if (L) IZ.setCells(B, { [valueRef(c, L)]: v }, isk.name); };
    one(/^Broj etaža/i, d.katnost); one(/^Maksimalna visina/i, d.visina); one(/^Namjena zgrade/i, d.namjena); one(/^Položaj u prostoru/i, d.polozaj); }
  /* popis grafičkih priloga */
  const gp = sheetBy(B, /^3\.?\s*GRAF/i); let lastRow = null; if (gp && d.listovi) { const c = cellsOf(B, gp), H = findLabel(c, /^LIST BR/i); if (H) { const h = rc(H), cn = findLabel(c, /NAZIV GRAFI/i), cm = findLabel(c, /^MJERILO/i), set = {};
      const rows = Object.keys(c).map(rc).filter(p => p.r > h.r && p.c === h.c).map(p => p.r).sort((a, b) => a - b), n = Math.max(rows.length, d.listovi.length);
      for (let k = 0; k < n; k++) { const r = rows[k] || (h.r + 1 + k), L = d.listovi[k]; set[I().colName(h.c) + r] = L ? L[0] : ''; if (cn) set[I().colName(rc(cn).c) + r] = L ? ' ' + L[1] : ''; if (cm) set[I().colName(rc(cm).c) + r] = L ? L[2] : ''; if (L) lastRow = r; }
      IZ.setCells(B, set, gp.name);
      /* broj stranica: fotodokumentacija broji listove iz zadnjeg retka popisa */
      if (lastRow) for (const s of B.sheets) { const doc = B.docs.get(s.target); if (!doc) continue; let ch = false; for (const f of doc.getElementsByTagNameNS(NS, 'f')) { const t = f.textContent, nt = t.replace(/('?3\.[^'!]*GRAF[^'!]*'?!\$?)([A-Z]+)\$?(\d+)/gi, (m, pre, col, row) => +row > h.r && col === I().colName(h.c) ? pre + col + lastRow : m); if (nt !== t) { f.textContent = nt; ch = true; } } if (ch) B.dirty.add(s.target); } } }
  /* tekstovi u okvirima */
  const txt = async (re, pick, paras) => { const s = sheetBy(B, re); if (!s || !paras) return; const dr = await drawingOf(B, s); if (!dr || !dr.doc) return; const sp = shapes(dr.doc).filter(x => shapeText(x).trim()); const t = pick(sp); if (!t) { warn.push('Tekst nije pronađen na listu ' + s.name); return; } setShape(t, paras); B.dirty.add(dr.path); };
  await txt(/^2\.?\s*TEHNI/i, sp => sp.find(x => /Ovaj elaborat|izrađen u skladu/i.test(shapeText(x))) || sp[0], d.uvod);
  await txt(/^2\.4/, sp => sp.find(x => /čestic|građevina je|zgrada/i.test(shapeText(x)) && !/priključen/i.test(shapeText(x))) || sp[0], d.opis);
  await txt(/^2\.4/, sp => sp.find(x => /priključen|instalacij/i.test(shapeText(x))), d.inst);
  { const s = sheetBy(B, /^2\.6/), dr = s && await drawingOf(B, s); if (dr && dr.doc) { for (const sp of shapes(dr.doc)) for (const t of sp.getElementsByTagNameNS(A, 't')) { if (d.listGbp) t.textContent = t.textContent.replace(/nacrtu broj \d+/, m => /bruto/i.test(shapeText(sp)) ? 'nacrtu broj ' + d.listGbp : m); if (d.listVol) t.textContent = t.textContent.replace(/nacrtu broj \d+/, m => /obujm/i.test(shapeText(sp)) && !/bruto/i.test(shapeText(sp)) ? 'nacrtu broj ' + d.listVol : m); } B.dirty.add(dr.path); } }
  /* slike */
  const imgs = await IZ.images(B), big = im => { const e = im.pic.getElementsByTagNameNS(A, 'ext'); for (const x of e) if (x.hasAttribute('cx')) return +x.getAttribute('cx') > 1500000; return false; };
  const kp = imgs.filter(im => /^1\.?\s*OP|^1\.1/i.test(im.sheet) && big(im)); for (const im of kp.slice(0, 1)) IZ.replaceImage(B, im, d.kp ? await containToFrame(d.kp, im.aspect) : await placeholder('Ovdje umetni\nizvod iz katastarskog plana', im.aspect), 'jpeg');
  const dg = imgs.filter(im => /^1\.2/.test(im.sheet) && big(im)).sort((a, b) => a.row - b.row); for (let k = 0; k < dg.length; k++) IZ.replaceImage(B, dg[k], d.dgu && d.dgu[k] ? await containToFrame(d.dgu[k], dg[k].aspect) : await placeholder('Ovdje umetni\nUvjerenje DGU\n(stranica ' + (k + 1) + ')', dg[k].aspect), 'jpeg');
  const fo = imgs.filter(im => /^4\.?\s*FOTO/i.test(im.sheet) && big(im)).sort((a, b) => a.row - b.row || a.col - b.col);
  for (let k = 0; k < fo.length; k++) { const src = (d.foto || [])[k]; if (src) IZ.replaceImage(B, fo[k], await IZ.photoToFrame(src, fo[k].aspect, fo[k].rot), 'jpeg'); else IZ.replaceImage(B, fo[k], await placeholder('Fotografija ' + (k + 1), fo[k].aspect), 'jpeg'); }
  if ((d.foto || []).length > fo.length) warn.push('U predlošku je ' + fo.length + ' mjesta za fotografije, a odabrano je ' + d.foto.length + ' – ušlo je prvih ' + fo.length + '.');
  return { bytes: await IZ.buildTemplate(B), warn };
}

/* ---------- Word ---------- */
const wText = p => [...p.getElementsByTagNameNS(W, 't')].map(t => t.textContent).join('');
function wRuns(p) { return [...p.childNodes].filter(n => n.nodeType === 1 && n.localName === 'r' && n.namespaceURI === W); }
const runText = r => [...r.getElementsByTagNameNS(W, 't')].map(t => t.textContent).join('');
const hasTab = r => r.getElementsByTagNameNS(W, 'tab').length > 0;
function setRunText(r, s) { const ts = [...r.getElementsByTagNameNS(W, 't')]; if (!ts.length) { const t = r.ownerDocument.createElementNS(W, 'w:t'); r.appendChild(t); ts.push(t); } ts[0].textContent = s; ts[0].setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve'); ts.slice(1).forEach(t => t.parentNode.removeChild(t)); }
/* „oznaka:<tab>…<tab>vrijednost” – zamijeni sve iza tabova */
function setAfterTab(p, val) { const rs = wRuns(p); let k = rs.findIndex(hasTab); if (k < 0) return false; while (k + 1 < rs.length && (hasTab(rs[k + 1]) || !runText(rs[k + 1]).trim())) k++; if (k + 1 >= rs.length) { const nr = rs[k].cloneNode(true); for (const x of [...nr.childNodes]) if (x.localName !== 'rPr') nr.removeChild(x); p.appendChild(nr); rs.push(nr); }
  setRunText(rs[k + 1], val); rs.slice(k + 2).forEach(r => r.parentNode.removeChild(r)); return true; }
async function fillIzjava(u8, d) {
  const IZ = I(), z = IZ.readZip(u8), repl = new Map(), warn = [], docs = new Map();
  const get = async n => { if (!docs.has(n)) { const e = z.find(x => x.name === n); docs.set(n, e ? xmlParse(await IZ.entryText(e)) : null); } return docs.get(n); };
  const V = { 'Inv_Ime_x0020_Prezime': d.inv, 'Adresa_Inv_Ulica_x0020_i_x0020_br': d.invUlica, 'Adresa_Inv_Grad': d.invGrad, 'Adresa_Inv_po_x0161_ta': d.invPosta, 'Inv_OIB': d.invOib, 'Objekt_vrsta': d.gradjevina,
    'Adresa_Objekt_Ulica_x0020_i_x0020_br': d.objUlica, 'Adresa_Objekt_Grad': d.objGrad, 'Objekt_Lokacija': d.kcBroj, 'Objekt_K_x002e_O_x002e_': d.ko, 'TD': d.tdIzj, 'Datum': d.datumIzj };
  /* svojstva dokumenta na koja su vezana polja */
  for (const e of z) if (/^customXml\/item\d+\.xml$/.test(e.name)) { const doc = await get(e.name); if (!doc || !doc.getElementsByTagName('documentManagement').length) continue; let ch = false;
    for (const [k, v] of Object.entries(V)) { if (v == null) continue; for (const el of doc.getElementsByTagName('*')) if (el.localName === k) { el.textContent = v; el.removeAttributeNS('http://www.w3.org/2001/XMLSchema-instance', 'nil'); ch = true; } } if (ch) repl.set(e.name, ser(doc)); }
  const parts = z.filter(e => /^word\/(document|header\d*|footer\d*)\.xml$/.test(e.name)).map(e => e.name);
  for (const n of parts) { const doc = await get(n);
    for (const sdt of [...doc.getElementsByTagNameNS(W, 'sdt')]) { const b = sdt.getElementsByTagNameNS(W, 'dataBinding')[0], m = b && /:([A-Za-z0-9_]+)\[1\]$/.exec(b.getAttributeNS(W, 'xpath') || b.getAttribute('w:xpath') || ''); if (!m || V[m[1]] == null) continue;
      const c = sdt.getElementsByTagNameNS(W, 'sdtContent')[0], ts = c ? [...c.getElementsByTagNameNS(W, 't')] : []; if (!ts.length) continue; ts[0].textContent = V[m[1]]; ts[0].setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve'); ts.slice(1).forEach(t => { t.textContent = ''; }); }
    if (n === 'word/document.xml') { const ps = [...doc.getElementsByTagNameNS(W, 'p')], byStart = re => ps.find(p => re.test(wText(p).trim()));
      /* adresa naručitelja na naslovnici: ulica upisana kao običan tekst ispred polja „grad” */
      for (const p of ps) { const bs = [...p.getElementsByTagNameNS(W, 'dataBinding')].map(b => b.getAttribute('w:xpath') || ''); if (bs.some(x => /Adresa_Inv_Grad/.test(x)) && !bs.some(x => /Adresa_Inv_Ulica/.test(x))) { const r = wRuns(p).find(r => runText(r).trim() && !/^[,\s]+$/.test(runText(r))); if (r && d.invUlica) setRunText(r, d.invUlica); } }
      const set = (re, v) => { if (v == null) return; const p = byStart(re); if (!p || !setAfterTab(p, v)) warn.push('U izjavi nije pronađen redak ' + re.source); };
      set(/^namjena zgrade/i, d.izNamjena); set(/^tlocrt zgrade/i, d.izTlocrt); set(/^katnost zgrade/i, d.izKatnost); set(/^temeljenje/i, d.izTemelj); set(/^vertikalni nosivi/i, d.izZidovi); set(/^stropna konstrukcija/i, d.izStrop); set(/^krovište/i, d.izKrov);
      const pv = byStart(/^Visina\b/); if (pv && d.izVisina) { const rs = wRuns(pv); setRunText(rs[0], d.izVisina); rs.slice(1).forEach(r => r.parentNode.removeChild(r)); }
      const pb = byStart(/^Na čestici/); if (pb && d.gradjevina) for (const r of wRuns(pb)) if (/^\s*zgrada\s*$/i.test(runText(r))) setRunText(r, ' ' + d.gradjevina.toLowerCase()); }
    repl.set(n, ser(doc)); }
  return { bytes: IZ.writeZip(z, repl), warn };
}
root.IzmjeraLegalDoc = { fillSnimka, fillIzjava };
})(typeof window !== 'undefined' ? window : globalThis);
