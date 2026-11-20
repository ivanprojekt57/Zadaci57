/* Izmjera 57 — izvoz za energetski certifikat: Excel (.xlsx bez vanjskih biblioteka) i PDF tablice. */
(function (root) {
'use strict';
/* ---------- ZIP (bez sažimanja) ---------- */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b) { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
const enc = s => new TextEncoder().encode(s);
function zip(files) {
  const parts = [], cen = []; let off = 0;
  const u16 = v => [v & 255, (v >>> 8) & 255], u32 = v => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
  for (const f of files) {
    const name = enc(f.name), data = f.data, crc = crc32(data);
    const head = [0x50, 0x4b, 3, 4, ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0)];
    parts.push(Uint8Array.from(head), name, data);
    cen.push([0x50, 0x4b, 1, 2, ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(off)], name);
    off += head.length + name.length + data.length;
  }
  let cenLen = 0; const cenParts = []; for (let i = 0; i < cen.length; i += 2) { const h = Uint8Array.from(cen[i]); cenParts.push(h, cen[i + 1]); cenLen += h.length + cen[i + 1].length; }
  const end = Uint8Array.from([0x50, 0x4b, 5, 6, 0, 0, 0, 0, ...u16(files.length), ...u16(files.length), ...u32(cenLen), ...u32(off), 0, 0]);
  const all = parts.concat(cenParts, [end]), len = all.reduce((s, a) => s + a.length, 0), out = new Uint8Array(len); let p = 0; for (const a of all) { out.set(a, p); p += a.length; } return out;
}
/* ---------- XLSX ---------- */
const xe = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
const colName = i => { let s = ''; i++; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
/* sheets: [{ name, cols:[širine], rows:[[ćelija]] }]; ćelija: broj | tekst | {v, b:true} | {f:'A1*B1', v} (formula) */
const cellRef = (c, r) => colName(c) + r;
function xlsx(sheets) {
  const files = [];
  files.push({ name: '[Content_Types].xml', data: enc('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + sheets.map((s, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('') + '</Types>') });
  files.push({ name: '_rels/.rels', data: enc('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>') });
  files.push({ name: 'xl/workbook.xml', data: enc('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + sheets.map((s, i) => '<sheet name="' + xe(s.name.slice(0, 31)) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>').join('') + '</sheets><calcPr fullCalcOnLoad="1"/></workbook>') });
  files.push({ name: 'xl/_rels/workbook.xml.rels', data: enc('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + sheets.map((s, i) => '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>').join('') + '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>') });
  files.push({ name: 'xl/styles.xml', data: enc('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="2" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="2" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>') });
  sheets.forEach((s, si) => {
    let x = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">';
    if (s.cols) x += '<cols>' + s.cols.map((w, i) => '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>').join('') + '</cols>';
    x += '<sheetData>';
    s.rows.forEach((r, ri) => {
      x += '<row r="' + (ri + 1) + '">';
      (r || []).forEach((c, ci) => { if (c == null || c === '') return; const ref = colName(ci) + (ri + 1), o = typeof c === 'object' ? c : { v: c }, b = !!o.b;
        if (o.f) x += '<c r="' + ref + '" s="' + (b ? 3 : 2) + '"><f>' + xe(o.f) + '</f>' + (typeof o.v === 'number' && Number.isFinite(o.v) ? '<v>' + Math.round(o.v * 1e4) / 1e4 + '</v>' : '') + '</c>';
        else if (typeof o.v === 'number' && Number.isFinite(o.v)) x += '<c r="' + ref + '" s="' + (o.int ? (b ? 1 : 0) : b ? 3 : 2) + '"><v>' + (o.int ? Math.round(o.v) : Math.round(o.v * 100) / 100) + '</v></c>';
        else x += '<c r="' + ref + '" t="inlineStr"' + (b ? ' s="1"' : '') + '><is><t xml:space="preserve">' + xe(o.v) + '</t></is></c>'; });
      x += '</row>';
    });
    files.push({ name: 'xl/worksheets/sheet' + (si + 1) + '.xml', data: enc(x + '</sheetData></worksheet>') });
  });
  return zip(files);
}
function saveBytes(bytes, name, mime) {
  if (root.IzmjeraSpremi && root.IzmjeraSpremi.autoBytes(name, mime, bytes)) return;
  const b64 = () => { let bin = ''; for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192)); return btoa(bin); };
  if (root.AndroidApp && root.AndroidApp.exportFile) { root.AndroidApp.exportFile(name, mime, b64()); return; }
  const url = URL.createObjectURL(new Blob([bytes], { type: mime })), a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500);
}
/* ---------- PDF tablice ---------- */
/* blocks: [{h:'naslov'} | {p:'tekst'} | {table:{cols:[{t,w,al}], rows:[[...]], bold:[indeksi redaka]}}] */
function pdfTables(blocks, meta) {
  const P = root.IzmjeraPdf, doc = new P.Doc(), W = 595.276, H = 841.89, set = P.settings(), logo = set.logo ? doc.jpeg(set.logo) : null;
  const hf0 = P.headerFooter(doc, W, H, { logoImg: logo, project: meta.project, floor: meta.floor, title: meta.title, firma: set.firma, date: P.today(), pageNo: 1, pageCount: 1 });
  const L = hf0.left, R = hf0.right, top = hf0.top - 6, bot = hf0.bottom + 8, pages = []; let c = '', y = top;
  const newPage = () => { pages.push(c); c = ''; y = top; };
  const need = h => { if (y - h < bot) newPage(); };
  const wrap = (t, size, maxW) => { const words = String(t).split(/\s+/), lines = []; let cur = ''; for (const w of words) { const n = cur ? cur + ' ' + w : w; if (P.textW(n) * size > maxW && cur) { lines.push(cur); cur = w; } else cur = n; } if (cur) lines.push(cur); return lines.length ? lines : ['']; };
  for (const b of blocks) {
    if (b.h) { need(30); y -= 16; c += b.blue ? 'q 0.09 0.27 0.5 rg ' + P.text(b.h, L, y, 12, { bold: true }) + 'Q\n' : P.text(b.h, L, y, 12, { bold: true }); y -= 6; if (b.blue) { y -= 4; continue; } c += '0.6 w ' + P.f(L) + ' ' + P.f(y) + ' m ' + P.f(R) + ' ' + P.f(y) + ' l S\n'; y -= 4; continue; }
    if (b.p) { for (const ln of wrap(b.p, 9, R - L)) { need(12); y -= 11; c += P.text(ln, L, y, 9); } y -= 2; continue; }
    if (b.table && b.table.style === 'plavo') { y = blueTable(b.table, y); continue; }
    if (b.table) {
      const T = b.table, tw = T.cols.reduce((s, k) => s + k.w, 0), k = (R - L) / tw, xs = []; let x = L; for (const col of T.cols) { xs.push(x); x += col.w * k; }
      const head = () => { need(16); y -= 12; T.cols.forEach((col, i) => { const al = col.al || 'l', xx = al === 'r' ? xs[i] + col.w * k - 3 : xs[i] + 2; c += P.text(col.t, xx, y, 8, { bold: true, align: al }); }); y -= 4; c += '0.4 w ' + P.f(L) + ' ' + P.f(y) + ' m ' + P.f(R) + ' ' + P.f(y) + ' l S\n'; };
      head();
      T.rows.forEach((r, ri) => {
        const bold = (T.bold || []).includes(ri), cells = r.map((v, i) => wrap(v == null ? '' : v, 8, T.cols[i].w * k - 5)), nl = Math.max(...cells.map(z => z.length)), rh = nl * 10 + 3;
        if (y - rh < bot) { newPage(); head(); }
        cells.forEach((lines, i) => { const al = T.cols[i].al || 'l', xx = al === 'r' ? xs[i] + T.cols[i].w * k - 3 : xs[i] + 2; lines.forEach((ln, li) => { c += P.text(ln, xx, y - 10 - li * 10, 8, { bold, align: al }); }); });
        y -= rh; if (bold) { c += '0.3 w ' + P.f(L) + ' ' + P.f(y + 1) + ' m ' + P.f(R) + ' ' + P.f(y + 1) + ' l S\n'; }
      });
      y -= 6; continue;
    }
  }
  function blueTable(T, y0) { /* v2.55: tablica u boji (sažetak): plavo zaglavlje, pruge, podebljani zbroj */
    y = y0; const tw = T.cols.reduce((a, k) => a + k.w, 0), k = (R - L) / tw, xs = []; let x = L; for (const col of T.cols) { xs.push(x); x += col.w * k; }
    const fs = T.size || 8.5, fsH = T.sizeH || 8.5, rect = (x0, y0, w, h, col) => col + ' rg ' + P.f(x0) + ' ' + P.f(y0) + ' ' + P.f(w) + ' ' + P.f(h) + ' re f\n', BL = '0.09 0.27 0.5', LN = '0.84 0.88 0.92 RG 0.5 w ';
    const cellX = (i, al) => al === 'r' ? xs[i] + T.cols[i].w * k - 4 : al === 'c' ? xs[i] + T.cols[i].w * k / 2 : xs[i] + 4;
    const head = () => { const hh = fsH + 9; need(hh + 4); c += 'q ' + rect(L, y - hh, R - L, hh, BL) + '1 1 1 rg '; T.cols.forEach((col, i) => { c += P.text(col.t, cellX(i, col.al || 'l'), y - hh + 5.5, fsH, { bold: true, align: col.al || 'l' }); }); c += 'Q\n'; y -= hh; };
    head();
    T.rows.forEach((r, ri) => { const bold = (T.bold || []).includes(ri), grp = (T.grp || []).includes(ri), rh = fs + 8;
      if (y - rh < bot) { newPage(); head(); }
      const bg = bold ? '0.89 0.93 0.97' : ri % 2 ? '0.957 0.973 0.984' : '1 1 1'; c += 'q ' + rect(L, y - rh, R - L, rh, bg) + LN;
      if (!grp) { xs.slice(1).forEach(xx => { c += P.f(xx) + ' ' + P.f(y) + ' m ' + P.f(xx) + ' ' + P.f(y - rh) + ' l S\n'; }); }
      c += P.f(L) + ' ' + P.f(y - rh) + ' m ' + P.f(R) + ' ' + P.f(y - rh) + ' l S\n'; if (bold) c += BL + ' RG 1.2 w ' + P.f(L) + ' ' + P.f(y) + ' m ' + P.f(R) + ' ' + P.f(y) + ' l S\n';
      c += (grp ? BL + ' rg ' : '0.12 0.16 0.23 rg ');
      r.forEach((v, i) => { const al = T.cols[i].al || 'l'; c += P.text(v == null ? '' : String(v), cellX(i, al), y - rh + 5, fs, { bold: bold || grp || (T.boldCol || []).includes(i), align: al }); }); c += 'Q\n'; y -= rh; });
    return y - 8; }
  pages.push(c);
  pages.forEach((pc, i) => { const hf = P.headerFooter(doc, W, H, { logoImg: logo, project: meta.project, floor: meta.floor, title: meta.title, firma: set.firma, date: P.today(), pageNo: i + 1, pageCount: pages.length }); doc.page(W, H, hf.content + 'q 0 0 0 rg 0 0 0 RG\n' + pc + 'Q\n'); });
  return doc.bytes();
}
root.IzmjeraEnergijaIzvoz = { colName, cellRef, xlsx, zip, crc32, saveBytes, pdfTables };
})(typeof window !== 'undefined' ? window : globalThis);
