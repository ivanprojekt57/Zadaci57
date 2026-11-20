/* Izmjera 57 — izvješće energetskog certifikata: čitanje KI Expert XML-a i izvještaja (.docx) te punjenje lista „Podaci” u korisnikovom Excel predlošku.
   Sve se radi na uređaju; predložak se ne mijenja, nastaje nova datoteka. */
(function (root) {
'use strict';
const td = new TextDecoder('utf-8'), te = new TextEncoder();

/* ---------- ZIP: čitanje (s inflate) i pisanje uz kopiranje nepromijenjenih (već sažetih) zapisa ---------- */
function readZip(u8) {
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength); let eo = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 66000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eo = i; break; }
  if (eo < 0) throw Error('Datoteka nije ispravan .xlsx/.docx (ZIP).');
  const n = dv.getUint16(eo + 10, true); let p = dv.getUint32(eo + 16, true); const out = [];
  for (let k = 0; k < n; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw Error('Oštećen ZIP.');
    const method = dv.getUint16(p + 10, true), time = dv.getUint16(p + 12, true), date = dv.getUint16(p + 14, true), crc = dv.getUint32(p + 16, true), csize = dv.getUint32(p + 20, true), usize = dv.getUint32(p + 24, true);
    const nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true), flags = dv.getUint16(p + 8, true);
    const nameB = u8.subarray(p + 46, p + 46 + nl), name = td.decode(nameB);
    const lnl = dv.getUint16(lo + 26, true), lxl = dv.getUint16(lo + 28, true), ds = lo + 30 + lnl + lxl;
    out.push({ name, nameB, method, time, date, crc, csize, usize, flags, raw: u8.subarray(ds, ds + csize) });
    p += 46 + nl + xl + cl;
  }
  return out;
}
async function inflateRaw(u8) {
  const ds = new DecompressionStream('deflate-raw');
  const buf = await new Response(new Blob([u8]).stream().pipeThrough(ds)).arrayBuffer(); return new Uint8Array(buf);
}
async function entryBytes(e) { return e.method === 0 ? e.raw : e.method === 8 ? inflateRaw(e.raw) : Promise.reject(Error('Nepodržano sažimanje u ZIP-u.')); }
async function entryText(e) { return td.decode(await entryBytes(e)); }
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b) { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
/* entries: zapisi iz readZip; repl: Map(ime → nova Uint8Array) — zamijenjeni se spremaju nesažeti, ostali se kopiraju kakvi jesu */
function writeZip(entries, repl) {
  const parts = [], cen = []; let off = 0;
  for (const e of entries) {
    const nb = e.nameB, r = repl.get(e.name), data = r || e.raw, method = r ? 0 : e.method, crc = r ? crc32(r) : e.crc, cs = data.length, us = r ? r.length : e.usize;
    const flags = (r ? 0 : e.flags & ~8) | 0x800 * 0; /* bez data descriptora */
    const h = new Uint8Array(30 + nb.length), dv = new DataView(h.buffer);
    dv.setUint32(0, 0x04034b50, true); dv.setUint16(4, 20, true); dv.setUint16(6, flags & 0x806, true); dv.setUint16(8, method, true); dv.setUint16(10, e.time, true); dv.setUint16(12, e.date, true);
    dv.setUint32(14, crc, true); dv.setUint32(18, cs, true); dv.setUint32(22, us, true); dv.setUint16(26, nb.length, true); dv.setUint16(28, 0, true); h.set(nb, 30);
    parts.push(h, data);
    const c = new Uint8Array(46 + nb.length), cv = new DataView(c.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, flags & 0x806, true); cv.setUint16(10, method, true); cv.setUint16(12, e.time, true); cv.setUint16(14, e.date, true);
    cv.setUint32(16, crc, true); cv.setUint32(20, cs, true); cv.setUint32(24, us, true); cv.setUint16(28, nb.length, true); cv.setUint32(42, off, true); c.set(nb, 46);
    cen.push(c); off += h.length + data.length;
  }
  const cs = cen.reduce((a, c) => a + c.length, 0), end = new Uint8Array(22), ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, entries.length, true); ev.setUint16(10, entries.length, true); ev.setUint32(12, cs, true); ev.setUint32(16, off, true);
  const all = new Uint8Array(off + cs + 22); let q = 0; for (const x of parts.concat(cen, [end])) { all.set(x, q); q += x.length; } return all;
}

/* ---------- brojevi ---------- */
function hrNum(s) { if (s == null) return null; let t = String(s).trim().replace(/\s/g, ''); if (!/^-?[\d.,]+$/.test(t)) return null; if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.'); const v = parseFloat(t); return Number.isFinite(v) ? v : null; }
const RAZRED = { 1: 'A+', 2: 'A', 3: 'B', 4: 'C', 5: 'D', 6: 'E', 7: 'F', 8: 'G' };

/* ---------- KI Expert XML (za ministarstvo) ---------- */
function parseKiXml(text) {
  const doc = new DOMParser().parseFromString(text, 'application/xml'); if (doc.getElementsByTagName('parsererror').length) throw Error('XML nije ispravan.');
  const one = n => doc.getElementsByTagName(n)[0], at = (n, a) => { const e = one(n); return e ? e.getAttribute(a) : null; };
  const Z = one('ZgradaDioZgrade'); if (!Z) throw Error('To nije XML energetskog certifikata (nema ZgradaDioZgrade).');
  const nf = v => { const x = hrNum(v); return x == null ? null : x; };
  const r = {
    adresa: Z.getAttribute('adresa') || '', kc: Z.getAttribute('katastarskaCestica') || '', ko: Z.getAttribute('katastarskaOpcina') || '',
    predmet: at('EP_ProracunskiParametri', 'nazivZone') || '',
    narucitelj: at('EP_PodaciOZgradiDijeluZgrade', 'naruciteljCertifikata') || '', narAdresa: at('EP_PodaciOZgradiDijeluZgrade', 'adresaNaruciteljaCertifikata') || '', narOib: at('EP_PodaciOZgradiDijeluZgrade', 'oibNaruciteljaCertifikata') || '',
    god: at('EP_PodaciOZgradiDijeluZgrade', 'godinaIzgradnje') || '', Ak: nf(at('EP_PodaciOZgradiDijeluZgrade', 'plostinaKorisnePovrsine')), f0: nf(at('EP_PodaciOZgradiDijeluZgrade', 'faktorOblika')),
    QHnd: nf(at('EP_EnergetskiRazredZgrade', 'specGodPotrebnaToplinskaEnergijaZaGrijanje')), Eprim: nf(at('EP_EnergetskiRazredZgrade', 'specGodPrimarnaEnergija')), CO2: nf(at('EP_EnergetskiRazredZgrade', 'specGodEmisijaCO2')),
    razredQ: RAZRED[at('EP_EnergetskiRazredZgrade', 'energetskiRazredId_SpecGodisPotrebaGrijanje')] || '', razredE: RAZRED[at('EP_EnergetskiRazredZgrade', 'energetskiRazredId')] || ''
  };
  return r;
}

/* ---------- KI Expert izvještaj (.docx) ---------- */
const DOCX_KEYS = [
  ['A', /^Oplošje grijanog dijela zgrade/i], ['Ve', /^Obujam grijanog dijela zgrade/i], ['V', /^Obujam grijanog zraka/i], ['f0', /^Faktor oblika zgrade/i],
  ['Ak', /^Ploština korisne površine grijanog dijela zgrade/i], ['Ak2', /^Proračunska ploština korisne površine/i], ['Auk', /^Ukupna ploština pročelja/i], ['Awuk', /^Ukupna ploština prozora/i],
  ['HD', /prema vanjskom okolišu,\s*H/i], ['Hg', /prema tlu,\s*H/i], ['HU', /kroz negrijani prostor,\s*H/i], ['HA', /prema susjednoj zgradi,\s*H/i], ['HTr', /^Ukupni koeficijent transmisijske izmjene topline,\s*H/i]
];
async function parseKiDocx(u8) {
  const z = readZip(u8), e = z.find(x => x.name === 'word/document.xml'); if (!e) throw Error('To nije Word (.docx) datoteka.');
  const doc = new DOMParser().parseFromString(await entryText(e), 'application/xml'), W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  // redovi tablica i odlomci izvan tablica, redom kako su u dokumentu (naslovi 1.3.2.x mogu biti odlomci ili redovi tablice)
  const rows = [], txt = el => [...el.getElementsByTagNameNS(W, 't')].map(t => t.textContent).join('').replace(/\s+/g, ' ').trim();
  const walk = el => { for (const ch of el.childNodes) { if (ch.nodeType !== 1) continue; const ln = ch.localName;
      if (ln === 'tr') { const tcs = [...ch.childNodes].filter(n => n.localName === 'tc' || n.localName === 'sdt'); if (tcs.some(tc => tc.getElementsByTagNameNS(W, 'tbl').length)) { walk(ch); continue; } rows.push(tcs.map(txt).filter((t, i, a) => t && t !== a[i - 1])); }
      else if (ln === 'p') { const t = txt(ch); if (t) rows.push([t]); }
      else walk(ch); } };
  walk(doc.documentElement);
  const res = {};
  for (const cells of rows) { if (cells.length < 2) continue;
    for (const [k, re] of DOCX_KEYS) { if (res[k] != null || !re.test(cells[0])) continue; for (let i = 1; i < cells.length; i++) { const v = hrNum(cells[i]); if (v != null) { res[k] = v; break; } } } }
  // građevni dijelovi sa slojevima i ploštinama (1.3.2.x)
  const el = []; let cur = null, inA = false;
  for (const c of rows) { const t0 = c[0] || '';
    const m = /^1\.3\.2\.\d+\s+(.+)$/.exec(t0); if (m && c.length === 1) { const parts = m[1].split(/\s+\d+\s+-\s+/); cur = { title: m[1], grupa: parts[0], naziv: parts[1] || m[1], slojevi: [], A: 0, po: {} }; el.push(cur); inA = false; continue; }
    if (/^1\.3\.[3-9]/.test(t0)) { cur = null; continue; }
    if (!cur) continue;
    if (/^\d+$/.test(t0) && c.length >= 7) { cur.slojevi.push({ rb: +t0, mat: c[1], d: hrNum(c[2]), lam: hrNum(c[3]), mu: hrNum(c[4]), sd: hrNum(c[5]), rho: hrNum(c[6]) }); inA = false; continue; }
    if (/^Definiran[ae] plo/i.test(t0)) { inA = true; const rest = c.slice(1); if (rest.length === 1) { cur.A = hrNum(rest[0]) || 0; } else for (let i = 0; i + 1 < rest.length; i += 2) { const v = hrNum(rest[i + 1]); if (v != null) { cur.po[rest[i]] = v; cur.A += v; } } continue; }
    if (inA && c.length === 2 && hrNum(c[1]) != null && !/^\d/.test(c[0])) { const v = hrNum(c[1]); cur.po[c[0]] = v; cur.A += v; continue; }
    inA = false; }
  res.elementi = el.filter(x => x.slojevi.length || x.A);
  // otvori (1.3.3)
  const op = []; let hdr = -1;
  rows.forEach((c, i) => { if (/^Naziv otvora$/i.test(c[0] || '') && c.some(x => /Orijentacija/i.test(x))) hdr = i; });
  if (hdr >= 0) for (let i = hdr + 1; i < rows.length; i++) { const c = rows[i]; if (!c.length) continue; if (c.length < 5 || hrNum(c[3]) == null) { if (op.length) break; continue; } op.push({ naziv: c[0], Uw: hrNum(c[1]), orij: c[2], Aw: hrNum(c[3]), n: hrNum(c[4]) || 1 }); }
  res.otvori = op;
  // U po građevnim dijelovima (2.A.1)
  const ut = [], seenU = new Set(); let uh = rows.findIndex(c => /^Naziv građevnog dijela$/i.test(c[0] || '') && c.some(x => /U\s*max/i.test(x)));
  if (uh >= 0) for (let i = uh + 1; i < rows.length; i++) { const c = rows[i]; if (!c.length) continue; if (c.length < 4 || hrNum(c[1]) == null) { if (ut.length) break; continue; } if (seenU.has(c[0])) continue; seenU.add(c[0]); ut.push({ naziv: c[0], A: hrNum(c[1]), U: hrNum(c[2]), Umax: hrNum(c[3]) }); }
  res.uTab = ut;
  // rezultati proračuna (tablica 6 u izvješću)
  const rz = rows.findIndex(c => c.length === 1 && /^Rezultati proračuna potrebne/i.test(c[0])), rez = [];
  if (rz >= 0) for (let i = rz + 1; i < rows.length && rez.length < 30; i++) { const c = rows[i]; if (!c.length) continue; if (c.length !== 2 || !/[=\d]/.test(c[1])) { if (rez.length) break; continue; } rez.push(c); }
  res.rezNaslov = rz >= 0 ? rows[rz][0] : ''; res.rez = rez;
  return res;
}

/* ---------- Excel predložak (cijela radna knjiga) ---------- */
const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main', NSR = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships', NSP = 'http://schemas.openxmlformats.org/package/2006/relationships';
const XDR = 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing', A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
function colNum(ref) { const m = /^([A-Z]+)/.exec(ref)[1]; let n = 0; for (const ch of m) n = n * 26 + ch.charCodeAt(0) - 64; return n; }
function colName(n) { let s = ''; while (n) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
const xmlParse = t => new DOMParser().parseFromString(t, 'application/xml'), ser = d => te.encode(new XMLSerializer().serializeToString(d));
const resolve = (base, t) => { if (t.startsWith('/')) return t.slice(1); const p = base.split('/'); p.pop(); for (const x of t.split('/')) { if (x === '..') p.pop(); else if (x !== '.') p.push(x); } return p.join('/'); };
const relsOf = f => { const p = f.split('/'), n = p.pop(); return p.concat('_rels', n + '.rels').join('/'); };
async function openTemplate(u8, sheetName) {
  const z = readZip(u8), get = n => z.find(e => e.name === n);
  const wbE = get('xl/workbook.xml'), relE = get('xl/_rels/workbook.xml.rels'); if (!wbE || !relE) throw Error('To nije Excel (.xlsx) datoteka.');
  const B = { z, get, docs: new Map(), dirty: new Set(), media: new Map(), drop: new Set() };
  B.doc = async name => { if (!B.docs.has(name)) { const e = get(name); B.docs.set(name, e ? xmlParse(await entryText(e)) : null); } return B.docs.get(name); };
  B.wb = await B.doc('xl/workbook.xml'); const rel = await B.doc('xl/_rels/workbook.xml.rels');
  B.sheets = [...B.wb.getElementsByTagNameNS(NS, 'sheet')].map(sh => { const rid = sh.getAttributeNS(NSR, 'id'), r = [...rel.getElementsByTagNameNS(NSP, 'Relationship')].find(x => x.getAttribute('Id') === rid); return { name: sh.getAttribute('name'), el: sh, target: resolve('xl/workbook.xml', r.getAttribute('Target')) }; });
  const ssE = get('xl/sharedStrings.xml'); B.ss = [];
  if (ssE) { const sd = xmlParse(await entryText(ssE)); B.ss = [...sd.getElementsByTagNameNS(NS, 'si')].map(si => [...si.getElementsByTagNameNS(NS, 't')].map(t => t.textContent).join('')); }
  const sh = B.sheets.find(s => s.name.trim().toLowerCase() === String(sheetName || '').toLowerCase()) || B.sheets[0];
  B.main = sh.name; B.target = sh.target; B.sheet = await B.doc(sh.target); B.wbE = wbE;
  for (const s2 of B.sheets) await B.doc(s2.target);
  return B;
}
const sheetOf = (B, name) => B.sheets.find(s => s.name === name);
function readCells(B, name) {
  const doc = name ? B.docs.get(sheetOf(B, name).target) : B.sheet, o = {};
  for (const c of doc.getElementsByTagNameNS(NS, 'c')) { const r = c.getAttribute('r'), t = c.getAttribute('t'), v = c.getElementsByTagNameNS(NS, 'v')[0], f = c.getElementsByTagNameNS(NS, 'f')[0];
    if (f) o[r] = '=' + f.textContent; else if (t === 's' && v) o[r] = B.ss[+v.textContent] ?? ''; else if (t === 'inlineStr') o[r] = [...c.getElementsByTagNameNS(NS, 't')].map(x => x.textContent).join(''); else if (v) { const n = parseFloat(v.textContent); o[r] = Number.isFinite(n) && t !== 'str' && t !== 'e' ? n : v.textContent; } }
  return o;
}
/* vals: { 'B1': 'tekst' | broj | {date:'2026-09-18'} | '' (briše) } */
function setCells(B, vals, name) {
  const target = name ? sheetOf(B, name).target : B.target, doc = B.docs.get(target), sd = doc.getElementsByTagNameNS(NS, 'sheetData')[0];
  const rowOf = n => { let row = null; for (const r of sd.getElementsByTagNameNS(NS, 'row')) { const k = +r.getAttribute('r'); if (k === n) return r; if (k > n) { row = r; break; } } const nr = doc.createElementNS(NS, 'row'); nr.setAttribute('r', String(n)); sd.insertBefore(nr, row); return nr; };
  for (const [ref, val0] of Object.entries(vals)) {
    if (val0 == null) continue;
    const n = +/\d+$/.exec(ref)[0], row = rowOf(n); let c = [...row.getElementsByTagNameNS(NS, 'c')].find(x => x.getAttribute('r') === ref);
    if (!c) { c = doc.createElementNS(NS, 'c'); c.setAttribute('r', ref); const cn = colNum(ref), nx = [...row.getElementsByTagNameNS(NS, 'c')].find(x => colNum(x.getAttribute('r')) > cn); row.insertBefore(c, nx || null); }
    while (c.firstChild) c.removeChild(c.firstChild);
    if (val0 === '') { c.removeAttribute('t'); continue; } /* prazno: stari podatak iz predloška se briše */
    let val = val0; if (val && typeof val === 'object' && val.date) { const d = new Date(val.date + 'T00:00:00Z'); val = Math.round(d.getTime() / 86400000) + 25569; }
    if (typeof val === 'number') { c.removeAttribute('t'); const v = doc.createElementNS(NS, 'v'); v.textContent = String(Math.round(val * 1e6) / 1e6); c.appendChild(v); }
    else { c.setAttribute('t', 'inlineStr'); const is = doc.createElementNS(NS, 'is'), t = doc.createElementNS(NS, 't'); t.setAttribute('xml:space', 'preserve'); t.textContent = String(val); is.appendChild(t); c.appendChild(is); }
  }
  B.dirty.add(target);
}
/* listovi: skrivanje (ne ispisuju se kad se cijela knjiga sprema u PDF) */
function setHidden(B, name, hidden) { const s = sheetOf(B, name); if (!s) return; if (hidden) s.el.setAttribute('state', 'hidden'); else s.el.removeAttribute('state'); }
function isHidden(B, name) { const s = sheetOf(B, name); return !!(s && s.el.getAttribute('state')); }
/* slike u listovima: mjesto (list, red), datoteka, omjer okvira */
async function images(B) {
  const out = [];
  for (const s of B.sheets) {
    const rl = await B.doc(relsOf(s.target)); if (!rl) continue;
    for (const r of rl.getElementsByTagNameNS(NSP, 'Relationship')) { if (!/\/drawing$/.test(r.getAttribute('Type'))) continue;
      const dPath = resolve(s.target, r.getAttribute('Target')), dd = await B.doc(dPath), drl = await B.doc(relsOf(dPath)); if (!dd || !drl) continue;
      const anchors = [...dd.documentElement.childNodes].filter(n => n.nodeType === 1);
      anchors.forEach((an, ai) => { const pic = an.getElementsByTagNameNS(XDR, 'pic')[0]; if (!pic) return; const blip = pic.getElementsByTagNameNS(A, 'blip')[0]; if (!blip) return;
        const rid = blip.getAttributeNS(NSR, 'embed'), rr = [...drl.getElementsByTagNameNS(NSP, 'Relationship')].find(x => x.getAttribute('Id') === rid); if (!rr) return;
        const fr = an.getElementsByTagNameNS(XDR, 'from')[0], to = an.getElementsByTagNameNS(XDR, 'to')[0], num = (el, tag) => el ? +(el.getElementsByTagNameNS(XDR, tag)[0] || {}).textContent : null;
        const ext = [...pic.getElementsByTagNameNS(A, 'ext')].find(x => x.hasAttribute('cx')), cx = ext ? +ext.getAttribute('cx') : 0, cy = ext ? +ext.getAttribute('cy') : 0;
        const media = resolve(dPath, rr.getAttribute('Target'));
        const xf = pic.getElementsByTagNameNS(A, 'xfrm')[0], rot = xf && xf.getAttribute('rot') ? Math.round(+xf.getAttribute('rot') / 60000) : 0;
        out.push({ key: s.name + '|' + ai, sheet: s.name, i: ai, row: num(fr, 'row') + 1, row1: to ? num(to, 'row') + 1 : null, col: num(fr, 'col') + 1, media, ext: media.split('.').pop().toLowerCase(), aspect: cx && cy ? cx / cy : null, rot, rel: rr, drawing: dPath, pic, name: (pic.getElementsByTagNameNS(XDR, 'cNvPr')[0] || { getAttribute: () => '' }).getAttribute('name') });
      });
    }
  }
  return out;
}
async function mediaBytes(B, path) { const e = B.get(path); return e ? entryBytes(e) : null; }
/* zamjena slike: nova datoteka (jpeg/png), okvir ostaje isti, obrezivanje (srcRect) se uklanja */
let mediaSeq = 0;
function replaceImage(B, img, bytes, ext) {
  const name = 'xl/media/izm' + (++mediaSeq) + '_' + Date.now().toString(36) + '.' + ext; B.media.set(name, bytes);
  img.rel.setAttribute('Target', '../media/' + name.split('/').pop()); B.dirty.add(relsOf(img.drawing));
  const sr = img.pic.getElementsByTagNameNS(A, 'srcRect')[0]; if (sr) sr.parentNode.removeChild(sr); B.dirty.add(img.drawing);
  B.drop.add(img.media);
}
async function buildTemplate(B) {
  // Excel neka sve preračuna pri otvaranju (formule u ostalim listovima čitaju „Podaci”)
  let cp = B.wb.getElementsByTagNameNS(NS, 'calcPr')[0]; if (!cp) { cp = B.wb.createElementNS(NS, 'calcPr'); B.wb.documentElement.appendChild(cp); } cp.setAttribute('fullCalcOnLoad', '1');
  // aktivni list ne smije biti skriven
  const vis = B.sheets.map((s, i) => [s, i]).filter(([s]) => !s.el.getAttribute('state')); const bv = B.wb.getElementsByTagNameNS(NS, 'workbookView')[0];
  if (bv && vis.length) { const at = +(bv.getAttribute('activeTab') || 0); if (!vis.some(([, i]) => i === at)) bv.setAttribute('activeTab', String(vis[0][1])); bv.removeAttribute('firstSheet'); }
  for (const s of B.sheets) { const sv = B.docs.get(s.target) && B.docs.get(s.target).getElementsByTagNameNS(NS, 'sheetView')[0]; if (sv && s.el.getAttribute('state') && sv.getAttribute('tabSelected')) { sv.removeAttribute('tabSelected'); B.dirty.add(s.target); } }
  if (bv && vis.length) { const at = +bv.getAttribute('activeTab'); const sv = B.docs.get(B.sheets[at].target).getElementsByTagNameNS(NS, 'sheetView')[0]; if (sv && !sv.getAttribute('tabSelected')) { sv.setAttribute('tabSelected', '1'); B.dirty.add(B.sheets[at].target); } }
  B.dirty.add('xl/workbook.xml');
  // stare izračunate vrijednosti formula se brišu, da i LibreOffice/Excel prikažu nove brojeve (ne one iz prošlog projekta)
  const strip = x => x.replace(/(<f\b[^>]*\/>|<f\b[^>]*>[\s\S]*?<\/f>)<v>[\s\S]*?<\/v>/g, '$1');
  const repl = new Map(), sheetSet = new Set(B.sheets.map(s => s.target));
  for (const [name, d] of B.docs) { if (!d) continue; if (sheetSet.has(name)) { const x = new XMLSerializer().serializeToString(d), y = strip(x); if (y !== x || B.dirty.has(name)) repl.set(name, te.encode(y)); } else if (B.dirty.has(name)) repl.set(name, ser(d)); }
  // nove slike + vrste datoteka
  let entries = B.z.slice();
  if (B.media.size) {
    const ct = xmlParse(await entryText(B.get('[Content_Types].xml'))), CT = 'http://schemas.openxmlformats.org/package/2006/content-types', have = new Set([...ct.getElementsByTagNameNS(CT, 'Default')].map(d => d.getAttribute('Extension').toLowerCase()));
    for (const [ext, mime] of [['jpeg', 'image/jpeg'], ['png', 'image/png']]) if (!have.has(ext)) { const d = ct.createElementNS(CT, 'Default'); d.setAttribute('Extension', ext); d.setAttribute('ContentType', mime); ct.documentElement.insertBefore(d, ct.documentElement.firstChild); }
    repl.set('[Content_Types].xml', ser(ct));
    // stare slike koje više nitko ne koristi se izbacuju
    const used = new Set(); for (const [name, d] of B.docs) if (d && /\/_rels\/drawing\d+\.xml\.rels$/.test(name)) for (const r of d.getElementsByTagNameNS(NSP, 'Relationship')) used.add(resolve(name.replace('/_rels/', '/').replace(/\.rels$/, ''), r.getAttribute('Target')));
    for (const e of B.z) if (/\/_rels\/drawing\d+\.xml\.rels$/.test(e.name) && !B.docs.has(e.name)) { const d = xmlParse(await entryText(e)); for (const r of d.getElementsByTagNameNS(NSP, 'Relationship')) used.add(resolve(e.name.replace('/_rels/', '/').replace(/\.rels$/, ''), r.getAttribute('Target'))); }
    entries = entries.filter(e => !(B.drop.has(e.name) && !used.has(e.name)));
    const now = new Date(), dt = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    for (const [name, bytes] of B.media) { entries.push({ name, nameB: te.encode(name), method: 0, time: 0, date: dt, crc: 0, csize: 0, usize: 0, flags: 0, raw: bytes }); repl.set(name, bytes); }
  }
  repl.delete('xl/calcChain.xml');
  return writeZip(entries, repl);
}
/* ---------- crtanje slika za izvješće (canvas) ---------- */
function loadImg(src) { return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(Error('Slika se ne može učitati.')); im.src = src; }); }
/* okvir: aspect = širina/visina okvira prije rotacije, rot = rotacija okvira u Excelu (°) → slika se okrene unatrag da u izvješću stoji uspravno */
function frameCanvas(aspect, rot, maxPx) { maxPx = maxPx || 1600; const a = aspect || 4 / 3; const W = a >= 1 ? maxPx : Math.round(maxPx * a), H = a >= 1 ? Math.round(maxPx / a) : maxPx; const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); const r = ((rot || 0) % 360 + 360) % 360, sw = r === 90 || r === 270; g.translate(W / 2, H / 2); g.rotate(-r * Math.PI / 180); return { cv, g, w: sw ? H : W, h: sw ? W : H }; }
async function photoToFrame(src, aspect, rot) { const im = await loadImg(src), F = frameCanvas(aspect, rot), s = Math.max(F.w / im.width, F.h / im.height), dw = im.width * s, dh = im.height * s; F.g.drawImage(im, -dw / 2, -dh / 2, dw, dh); return canvasBytes(F.cv, 'jpeg'); }
async function canvasBytes(cv, ext) { const b = await new Promise(r => cv.toBlob(r, ext === 'png' ? 'image/png' : 'image/jpeg', 0.86)); return new Uint8Array(await b.arrayBuffer()); }
/* tablica kao slika (zaglavlje zeleno kao u KI Expertu); blocks: [{title, cols:[{t,w,al}], rows:[[...]], foot:[[...]]}] */
function tableToFrame(blocks, aspect, rot) {
  const PX = 2, fs = 11 * PX, lh = 14 * PX, padV = 3 * PX, pad = 4 * PX, gap = 12 * PX, Wt = 760 * PX;
  const mc = document.createElement('canvas').getContext('2d');
  const wrap = (text, w, bold) => { mc.font = (bold ? 'bold ' : '') + fs + 'px Arial'; const words = String(text == null ? '' : text).split(' '), out = []; let cur = '';
    for (const wd of words) { const t = cur ? cur + ' ' + wd : wd; if (mc.measureText(t).width > w - 6 * PX && cur) { out.push(cur); cur = wd; } else cur = t; } out.push(cur); return out; };
  // priprema: širine stupaca i visine redaka (dugi tekst se lomi u više redaka)
  const plan = blocks.map(b => { const tw = b.cols.reduce((a, c) => a + c.w, 0), ws = b.cols.map(c => c.w / tw * Wt);
    const rowsAll = [[b.cols.map(c => c.t), '#cdeccd', true], ...b.rows.map((r, i) => [r, i % 2 ? '#f6faf6' : null, false]), ...(b.foot || []).map(r => [r, '#eef5ee', true])];
    return { b, ws, lines: rowsAll.map(([cells, bg, bold]) => { const L = b.cols.map((c, i) => wrap(cells[i], ws[i], bold)); return { L, bg, bold, h: Math.max(...L.map(x => x.length)) * lh + 2 * padV }; }) }; });
  let H = 0; for (const q of plan) H += (q.b.title ? wrap(q.b.title, Wt, true).length * lh + 4 * PX : 0) + q.lines.reduce((a, r) => a + r.h, 0) + gap;
  const tmp = document.createElement('canvas'); tmp.width = Wt + 2 * pad; tmp.height = Math.max(H, lh); const g = tmp.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, tmp.width, tmp.height); g.textBaseline = 'top'; let y = 0;
  for (const q of plan) { const b = q.b;
    if (b.title) { g.font = 'bold ' + fs + 'px Arial'; g.fillStyle = '#111'; g.textAlign = 'left'; for (const l of wrap(b.title, Wt, true)) { g.fillText(l, pad, y + 2 * PX); y += lh; } y += 4 * PX; }
    const xs = []; let x = pad; for (const w of q.ws) { xs.push(x); x += w; } xs.push(pad + Wt);
    for (const r of q.lines) { if (r.bg) { g.fillStyle = r.bg; g.fillRect(pad, y, Wt, r.h); } g.strokeStyle = '#9aa'; g.lineWidth = 1; g.strokeRect(pad, y, Wt, r.h); g.font = (r.bold ? 'bold ' : '') + fs + 'px Arial'; g.fillStyle = '#111';
      r.L.forEach((lines, i) => { const c = b.cols[i], x0 = xs[i], x1 = xs[i + 1]; if (i) { g.beginPath(); g.moveTo(x0, y); g.lineTo(x0, y + r.h); g.stroke(); } g.textAlign = c.al === 'r' ? 'right' : c.al === 'c' ? 'center' : 'left';
        lines.forEach((l, k) => g.fillText(l, c.al === 'r' ? x1 - 3 * PX : c.al === 'c' ? (x0 + x1) / 2 : x0 + 3 * PX, y + padV + k * lh)); });
      y += r.h; }
    y += gap; }
  // smjesti u okvir predloška (ne reže se; vodoravno centrirano, višak je bijel)
  const F = frameCanvas(aspect, rot, 2000), sc = Math.min(F.w / tmp.width, F.h / tmp.height), dw = tmp.width * sc, dh = tmp.height * sc; F.g.drawImage(tmp, -dw / 2, -F.h / 2, dw, dh); return canvasBytes(F.cv, 'png');
}
/* traženje ćelija po tekstu (za mjere, vodu, zaključak) */
function findCells(B, name, re) { const c = readCells(B, name); return Object.entries(c).filter(([, v]) => typeof v === 'string' && re.test(v)).map(([r, v]) => ({ ref: r, v, col: colNum(r), row: +/\d+$/.exec(r)[0] })); }

/* ---------- polja lista „Podaci” (kako ih koristi predložak) ---------- */
const FIELDS = [
  ['B1', 'Predmet'], ['B2', 'Adresa'], ['B3', 'Mjesto'], ['B4', 'k.č., k.o.'], ['B5', 'Datum en. pregleda', 'date'], ['B6', 'Katnost'], ['B7', 'Godina izgradnje'], ['B8', 'Godina adaptacije'], ['B9', 'Opis adaptacije'],
  ['B10', 'Podne obloge', '', 'keep'], ['B11', 'Stropovi', '', 'keep'], ['B12', 'Vanjski zidovi', '', 'keep'], ['B13', 'Unutarnja strana zida', '', 'keep'], ['B14', 'Fasada', '', 'keep'], ['B15', 'Vanjski otvori', '', 'keep'], ['B16', 'Sustav grijanja', '', 'keep'], ['B17', 'PTV', '', 'keep'], ['B18', 'Hlađenje', '', 'keep'], ['B19', 'Instalacije', '', 'keep'],
  ['B20', 'QH,nd (kWh/m²a)', 'num'], ['C20', 'Razred QH,nd'], ['B21', 'Eprim (kWh/m²a)', 'num'], ['C21', 'Razred Eprim'], ['B22', 'CO2 (kg/m²a)', 'num'],
  ['B23', 'Naručitelj'], ['B24', 'Adresa naručitelja'], ['B25', 'OIB naručitelja'], ['B26', 'Energent za grijanje'], ['B27', 'Broj ukućana', 'num', 'keep'],
  ['K2', 'Oplošje A (m²)', 'num'], ['K3', 'Obujam Ve (m³)', 'num'], ['K4', 'Obujam grijanog zraka V (m³)', 'num'], ['K5', 'Faktor oblika f0 (1/m)', 'num'], ['K6', 'Ak (m²)', 'num'], ['K7', "Ak' (m²)", 'num'], ['K8', 'Ukupna ploština pročelja Auk (m²)', 'num'], ['K9', 'Ukupna ploština prozora Awuk (m²)', 'num'],
  ['K13', 'HD (W/K)', 'num'], ['K14', 'Hg,avg (W/K)', 'num'], ['K15', 'HU (W/K)', 'num'], ['K16', 'HA (W/K)', 'num'], ['K17', 'HTr (W/K)', 'num']
];
/* prijedlog vrijednosti iz KI XML-a (x), KI izvještaja (d) i aplikacije (a) */
function suggest(x, d, a) {
  x = x || {}; d = d || {}; a = a || {}; const s = {}, put = (k, ...vs) => { for (const v of vs) if (v != null && v !== '') { s[k] = v; return; } };
  put('B1', x.predmet, a.predmet); put('B2', x.adresa, a.adresa); put('B3', a.mjesto, [x.narAdresa, a.narAdresa, a.adresa].map(t => t && t.includes(',') ? t.split(',').pop().replace(/\d{5}/, '').trim() : null).find(Boolean)); put('B4', x.kc ? x.kc + (x.ko ? ', k.o. ' + x.ko : '') : null, a.kc ? a.kc + (a.ko ? ', k.o. ' + a.ko : '') : null);
  put('B5', a.datum ? { date: a.datum } : null); put('B6', a.katnost); { const g = x.god || a.god; put('B7', g != null && /^\d{4}$/.test(String(g).trim()) ? +g : g); } put('B8', '-'); put('B9', '-');
  put('B12', a.zidovi); put('B14', a.fasada); put('B15', a.otvori); put('B16', a.grijanje); put('B17', a.ptv); put('B18', a.hladjenje);
  put('B20', x.QHnd); put('C20', x.razredQ); put('B21', x.Eprim); put('C21', x.razredE); put('B22', x.CO2);
  put('B23', x.narucitelj, a.narucitelj); put('B24', x.narAdresa, a.narAdresa); put('B25', x.narOib, a.narOib); put('B26', a.energent); put('B27', a.ukucana);
  put('K2', d.A); put('K3', d.Ve); put('K4', d.V); put('K5', d.f0, x.f0); put('K6', d.Ak, x.Ak); put('K7', d.Ak2, d.Ak, x.Ak); put('K8', d.Auk); put('K9', d.Awuk);
  put('K13', d.HD); put('K14', d.Hg); put('K15', d.HU); put('K16', d.HA); put('K17', d.HTr);
  return s;
}
root.IzmjeraIzvjesce = { readZip, writeZip, inflateRaw, entryText, hrNum, parseKiXml, parseKiDocx, openTemplate, readCells, setCells, setHidden, isHidden, images, mediaBytes, replaceImage, buildTemplate, findCells, colNum, colName, photoToFrame, tableToFrame, FIELDS, suggest, RAZRED };
})(typeof window !== 'undefined' ? window : globalThis);
