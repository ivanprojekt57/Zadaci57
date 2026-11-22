/* Izmjera 57 — zajednički vektorski PDF (A4, slojevi, zaglavlje i podnožje s logom, hrvatska slova). */
(function (root) {
'use strict';
const LOGO_KEY = 'izmjera-pdf-logo', FIRMA_KEY = 'izmjera-pdf-firma';
// Helvetica: WinAnsi + č ć đ na slobodnim mjestima 128–133
const MAP = { 'č': 128, 'Č': 129, 'ć': 130, 'Ć': 131, 'đ': 132, 'Đ': 133, 'š': 0x9a, 'Š': 0x8a, 'ž': 0x9e, 'Ž': 0x8e, '–': 0x96, '—': 0x97, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '„': 0x84, '•': 0x95, '…': 0x85, '™': 0x99 };
const DIFF = '[128 /ccaron /Ccaron /cacute /Cacute /dcroat /Dcroat]';
function str(t) { let o = ''; for (const ch of String(t == null ? '' : t)) { let n = MAP[ch] != null ? MAP[ch] : ch.codePointAt(0); if (n === 10 || n === 13 || n === 9) n = 32; if (n > 255 || (n >= 127 && n < 160 && MAP[ch] == null)) { o += '?'; continue; } if (n === 40 || n === 41 || n === 92) o += '\\' + ch; else if (n >= 32 && n <= 126) o += ch; else o += '\\' + n.toString(8).padStart(3, '0'); } return '(' + o + ')'; }
function f(n) { const v = Number(n); if (!Number.isFinite(v)) return '0'; const s = v.toFixed(3); return s.replace(/\.?0+$/, '') || '0'; }
// približna širina teksta (Helvetica), u jedinicama veličine fonta
function textW(t, bold) { const FT = root.IzmjeraPdfFont; if (FT) { const W = FT[bold ? 'B' : 'R'].w; let w = 0; for (const ch of String(t || '')) { let n = MAP[ch] != null ? MAP[ch] : ch.codePointAt(0); if (n < 32 || n > 255) n = 63; w += (W[n - 32] || 556) / 1000; } return w; }
  let w = 0; for (const ch of String(t || '')) { if ('il.,:;|!\'’ '.includes(ch)) w += 0.28; else if ('fjrtI()[]-/'.includes(ch)) w += 0.36; else if ('mwMW'.includes(ch)) w += 0.85; else if (ch >= 'A' && ch <= 'Z' || 'ČĆŠŽĐ'.includes(ch)) w += 0.68; else w += 0.556; } return w * (bold ? 1.06 : 1); }
function jpegSize(bin) { let i = 2; while (i < bin.length) { if (bin.charCodeAt(i) !== 0xff) { i++; continue; } const mk = bin.charCodeAt(i + 1); const len = (bin.charCodeAt(i + 2) << 8) + bin.charCodeAt(i + 3); if (mk >= 0xc0 && mk <= 0xcf && mk !== 0xc4 && mk !== 0xc8 && mk !== 0xcc) return { h: (bin.charCodeAt(i + 5) << 8) + bin.charCodeAt(i + 6), w: (bin.charCodeAt(i + 7) << 8) + bin.charCodeAt(i + 8) }; i += 2 + len; } return null; }

function Doc() {
  this.objs = []; this.pages = []; this.ocgs = []; this.imgs = [];
  const fnt = name => '<< /Type /Font /Subtype /Type1 /BaseFont /' + name + ' /Encoding << /Type /Encoding /BaseEncoding /WinAnsiEncoding /Differences ' + DIFF + ' >> >>';
  this.catalog = this.add(''); this.pagesId = this.add('');
  const FT = root.IzmjeraPdfFont; /* v2.57: ugrađeni font (Liberation Sans) – č ć đ se vide u svakom pregledniku */
  if (FT) { const emb = (k, nm) => { const F = FT[k], bin = atob(F.b64), ff = this.add('<< /Length ' + bin.length + ' /Length1 ' + bin.length + ' >>\nstream\n' + bin + '\nendstream'),
      fd = this.add('<< /Type /FontDescriptor /FontName /' + nm + ' /Flags 32 /FontBBox [' + F.bbox.join(' ') + '] /ItalicAngle 0 /Ascent ' + F.asc + ' /Descent ' + F.desc + ' /CapHeight ' + F.cap + ' /StemV ' + (k === 'B' ? 120 : 80) + ' /FontFile2 ' + ff + ' 0 R >>');
      return this.add('<< /Type /Font /Subtype /TrueType /BaseFont /' + nm + ' /FirstChar 32 /LastChar 255 /Widths [' + F.w.join(' ') + '] /Encoding << /Type /Encoding /BaseEncoding /WinAnsiEncoding /Differences ' + DIFF + ' >> /FontDescriptor ' + fd + ' 0 R >>'); };
    this.F1 = emb('R', 'IZMJRA+LiberationSans'); this.F2 = emb('B', 'IZMJRB+LiberationSans-Bold'); }
  else { this.F1 = this.add(fnt('Helvetica')); this.F2 = this.add(fnt('Helvetica-Bold')); }
}
Doc.prototype.add = function (o) { this.objs.push(o); return this.objs.length; };
Doc.prototype.layer = function (name) { const id = this.add('<< /Type /OCG /Name ' + str(name) + ' >>'); this.ocgs.push(id); return '/OC' + this.ocgs.length; };
Doc.prototype.jpeg = function (dataUrl) {
  try { const m = /^data:image\/jpe?g;base64,(.*)$/i.exec(dataUrl || ''); if (!m) return null; const bin = atob(m[1]), sz = jpegSize(bin); if (!sz) return null;
    const id = this.add('<< /Type /XObject /Subtype /Image /Width ' + sz.w + ' /Height ' + sz.h + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + bin.length + ' >>\nstream\n' + bin + '\nendstream');
    this.imgs.push(id); return { name: '/Im' + this.imgs.length, w: sz.w, h: sz.h }; } catch (e) { return null; }
};
Doc.prototype.page = function (W, H, content) {
  const sid = this.add('<< /Length ' + content.length + ' >>\nstream\n' + content + 'endstream');
  const props = this.ocgs.map((id, i) => '/OC' + (i + 1) + ' ' + id + ' 0 R').join(' '), xo = this.imgs.map((id, i) => '/Im' + (i + 1) + ' ' + id + ' 0 R').join(' ');
  this.pages.push(this.add('<< /Type /Page /Parent ' + this.pagesId + ' 0 R /MediaBox [0 0 ' + f(W) + ' ' + f(H) + '] /Resources << /Font << /F1 ' + this.F1 + ' 0 R /F2 ' + this.F2 + ' 0 R >>' + (xo ? ' /XObject << ' + xo + ' >>' : '') + (props ? ' /Properties << ' + props + ' >>' : '') + ' >> /Contents ' + sid + ' 0 R >>'));
};
Doc.prototype.bytes = function () {
  this.objs[this.pagesId - 1] = '<< /Type /Pages /Kids [' + this.pages.map(id => id + ' 0 R').join(' ') + '] /Count ' + this.pages.length + ' >>';
  const oc = this.ocgs.map(id => id + ' 0 R').join(' ');
  this.objs[this.catalog - 1] = '<< /Type /Catalog /Pages ' + this.pagesId + ' 0 R' + (oc ? ' /OCProperties << /OCGs [' + oc + '] /D << /Order [' + oc + '] /ON [' + oc + '] >> >>' : '') + ' >>';
  let out = '%PDF-1.5\n%âãÏÓ\n'; const offs = [];
  this.objs.forEach((o, i) => { offs.push(out.length); out += (i + 1) + ' 0 obj\n' + o + '\nendobj\n'; });
  const x = out.length; out += 'xref\n0 ' + (this.objs.length + 1) + '\n0000000000 65535 f \n'; for (const o of offs) out += String(o).padStart(10, '0') + ' 00000 n \n';
  out += 'trailer\n<< /Size ' + (this.objs.length + 1) + ' /Root ' + this.catalog + ' 0 R >>\nstartxref\n' + x + '\n%%EOF\n';
  const b = new Uint8Array(out.length); for (let i = 0; i < out.length; i++) b[i] = out.charCodeAt(i) & 255; return b;
};

// tekst: x,y u točkama, align 'l'|'c'|'r', rot u stupnjevima (suprotno od kazaljke)
function text(t, x, y, size, opt) {
  opt = opt || {}; const bold = !!opt.bold, w = textW(t, bold) * size, al = opt.align || 'l', r = (opt.rot || 0) * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
  const dx = al === 'c' ? -w / 2 : al === 'r' ? -w : 0;
  const F = '/' + (bold ? 'F2' : 'F1') + ' ';
  let body = str(t) + ' Tj';
  if (/[²³]/.test(String(t))) body = String(t).split(/([²³])/).filter(Boolean).map(seg => seg === '²' || seg === '³' ? F + f(size * 0.62) + ' Tf ' + f(size * 0.38) + ' Ts (' + (seg === '²' ? '2' : '3') + ') Tj ' + F + f(size) + ' Tf 0 Ts' : str(seg) + ' Tj').join(' '); // eksponent kao mala uzdignuta znamenka (ne ovisi o fontu preglednika)
  const k = opt.italic ? 0.2126 : 0; /* kurziv: nagib slova 12° (kao pismo sastavnice) */
  return 'BT ' + F + f(size) + ' Tf ' + f(c) + ' ' + f(s) + ' ' + f(c * k - s) + ' ' + f(s * k + c) + ' ' + f(x + dx * c) + ' ' + f(y + dx * s) + ' Tm ' + body + ' ET\n';
}
function settings() { let logo = null, firma = ''; try { logo = localStorage.getItem(LOGO_KEY); firma = localStorage.getItem(FIRMA_KEY) || ''; } catch (e) {} return { logo, firma }; }
function setLogo(dataUrl) { try { if (dataUrl) localStorage.setItem(LOGO_KEY, dataUrl); else localStorage.removeItem(LOGO_KEY); return true; } catch (e) { return false; } }
function setFirma(t) { try { localStorage.setItem(FIRMA_KEY, String(t || '')); } catch (e) {} }
// slika (bilo koji format) → JPEG dataURL, najviše 700 px
function imageToJpeg(file) {
  return new Promise((res, rej) => { const fr = new FileReader(); fr.onerror = () => rej(Error('Ne mogu pročitati sliku')); fr.onload = () => { const im = new Image(); im.onerror = () => rej(Error('Neispravna slika')); im.onload = () => {
    const k = Math.min(1, 700 / Math.max(im.width, im.height)), cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(im.width * k)); cv.height = Math.max(1, Math.round(im.height * k));
    const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(im, 0, 0, cv.width, cv.height); res(cv.toDataURL('image/jpeg', 0.9)); }; im.src = fr.result; }; fr.readAsDataURL(file); });
}
/* zaglavlje i podnožje; vraća {content, top, bottom} = slobodni prostor za crtež */
function headerFooter(doc, W, H, o) {
  const m = 28, hh = 44, fh = 22; let c = 'q 0 0 0 rg 0 0 0 RG\n';
  const logo = o.logoImg; let tx = m;
  if (logo) { const bw = 120, bh = 34, k = Math.min(bw / logo.w, bh / logo.h), lw = logo.w * k, lh = logo.h * k; c += 'q ' + f(lw) + ' 0 0 ' + f(lh) + ' ' + f(m) + ' ' + f(H - m - lh + 2) + ' cm ' + logo.name + ' Do Q\n'; }
  const xr = W - m;
  c += text(o.project || 'Izmjera', xr, H - m - 10, 12, { bold: true, align: 'r' });
  c += text(o.floor || '', xr, H - m - 24, 10, { align: 'r' });
  c += '0.35 g\n' + text(o.title || '', xr, H - m - 36, 8, { align: 'r' }) + '0 g\n';
  if (!logo && o.firma) c += text(o.firma, tx, H - m - 10, 10, { bold: true });
  c += '0.6 w ' + f(m) + ' ' + f(H - m - hh) + ' m ' + f(W - m) + ' ' + f(H - m - hh) + ' l S\n';
  c += '0.4 w ' + f(m) + ' ' + f(m + fh - 6) + ' m ' + f(W - m) + ' ' + f(m + fh - 6) + ' l S\n';
  c += '0.3 g\n' + text([o.firma, o.date].filter(Boolean).join('  ·  '), m, m + 4, 8) + text('Stranica ' + o.pageNo + ' / ' + o.pageCount, W - m, m + 4, 8, { align: 'r' }) + '0 g\n';
  c += 'Q\n';
  return { content: c, top: H - m - hh - 6, bottom: m + fh, left: m, right: W - m };
}
function today() { const d = new Date(); return d.getDate() + '. ' + (d.getMonth() + 1) + '. ' + d.getFullYear() + '.'; }
function save(bytes, name) {
  if (root.IzmjeraSpremi && root.IzmjeraSpremi.autoBytes(name, 'application/pdf', bytes)) return;
  if (root.AndroidApp && root.AndroidApp.exportPdf) { let bin = ''; for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192)); root.AndroidApp.exportPdf(name, btoa(bin)); return; }
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' })); const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500);
}
function fileName(s) { return String(s || 'Izmjera').replace(/[^a-z0-9čćžšđ_-]+/gi, '_').replace(/^_+|_+$/g, '') || 'Izmjera'; }
root.IzmjeraPdf = { Doc, text, str, f, textW, headerFooter, settings, setLogo, setFirma, imageToJpeg, today, save, fileName };
})(typeof window !== 'undefined' ? window : globalThis);
