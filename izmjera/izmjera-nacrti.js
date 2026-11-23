/* Izmjera 57 — „📐 Nacrti”: jedan tok od tlocrta do svih nacrta.
   Koraci: 1. Tlocrti (etažu po etažu) → 2. Pročelja i presjeci → 3. GBP i obujam (legalizacija) → 4. Izvoz nacrta.
   Listovi: M 1:100, A4 uspravno kad stane, inače A3 položeno; na list ide koliko pogleda stane. Okvir i sastavnica kao na nacrtima Projekt 57. */
(function (root) {
'use strict';
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const app = () => root.IzmjeraApp;
const isLegal = () => { const i = root.projectInfo || {}; return Array.isArray(i.vrsta) && i.vrsta.includes('legalizacija'); };
const floors = () => { try { return app().floors(); } catch (e) { return []; } };
const gi = f => { try { return app().allFloors().indexOf(f); } catch (e) { return -1; } };
const sig = f => { const it = (f && f.items) || []; return it.length + ':' + JSON.stringify(it).length; };
function status(f) { const t = f.tlocrt || {}; if (t.done) return t.done === sig(f) ? 'ok' : 'chg'; return t.v >= 6 ? 'wip' : 'new'; }
const ICON = { ok: '✓', chg: '⚠', wip: '✎', new: '○' }, ICOL = { ok: '#15803d', chg: '#b45309', wip: '#1d4ed8', new: '#64748b' };
const STEPS = () => isLegal() ? [['tl', 'Tlocrti'], ['pr', 'Pročelja i presjeci'], ['gbp', 'GBP i obujam'], ['iz', 'Izvoz nacrta']] : [['tl', 'Tlocrti'], ['iz', 'Izvoz nacrta']];

/* ---------- traka toka (koraci + etaže) ---------- */
function bar(host, active) {
  if (!host) return; const cur = app() && app().currentFloor(), fs = floors(), nOk = fs.filter(f => status(f) === 'ok').length;
  let h = '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">' + STEPS().map(([k, n], i) => '<button class="tl-btn" data-nf="' + k + '" style="' + (k === active ? 'background:#fff;color:#12305e;font-weight:bold' : 'background:transparent;color:#fff;border-color:rgba(255,255,255,.5)') + '">' + (i + 1) + '. ' + n + (k === 'tl' ? ' ' + nOk + '/' + fs.length : '') + '</button>').join('') + '</div>';
  if (active === 'tl' && fs.length > 1) h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">' + fs.map(f => { const s = status(f), on = f === cur; return '<button class="tl-btn" data-nfl="' + gi(f) + '" style="' + (on ? 'background:#dbeafe;color:#12305e;font-weight:bold;' : 'background:#fff;color:#12305e;') + '"><span style="color:' + ICOL[s] + '">' + ICON[s] + '</span> ' + esc(f.name || 'Etaža') + '</button>'; }).join('') + '</div>';
  host.innerHTML = h; host.hidden = false;
  host.querySelectorAll('[data-nf]').forEach(b => b.onclick = () => goStep(b.dataset.nf));
  host.querySelectorAll('[data-nfl]').forEach(b => b.onclick = () => { const f = app().allFloors()[+b.dataset.nfl]; if (f && f !== cur) toTl(f); });
}
function closeAll() { try { root.IzmjeraTlocrtUI && IzmjeraTlocrtUI.close(); } catch (e) { } try { root.IzmjeraEnergija && IzmjeraEnergija.close(); } catch (e) { } nfShow(false); }
/* prikaz/skrivanje (inline display:flex inače nadjača atribut hidden) */
function nfShow(on) { const x = $('nfWiz'); if (!x) return; x.hidden = !on; x.style.display = on ? 'flex' : 'none'; }
function toTl(f) { closeAll(); const a = app(); if (f && f !== a.currentFloor()) a.switchFloor(gi(f)); setTimeout(() => IzmjeraTlocrtUI.open({ flow: true }), 30); }
function goStep(k) {
  if (k === 'tl') { const fs = floors(), cur = app().currentFloor(); toTl(fs.includes(cur) ? cur : fs[0]); return; }
  const notOk = floors().filter(f => status(f) !== 'ok');
  if (k !== 'tl' && notOk.length && !confirm('Tlocrt još nije označen kao gotov za: ' + notOk.map(f => f.name).join(', ') + '.\n\nNastaviti ipak?')) return;
  closeAll();
  if (k === 'pr') IzmjeraEnergija.openTab(7, { flow: true }); else if (k === 'gbp') IzmjeraEnergija.openTab(9, { flow: true }); else showExport();
}
/* „✓ Tlocrt gotov” na rezultatu: označi etažu i idi na sljedeću neriješenu ili na sljedeći korak */
function nextLabel() { const fs = floors(), cur = app().currentFloor(), rest = fs.filter(f => f !== cur && status(f) !== 'ok'); if (rest.length) return 'sljedeća etaža (' + rest[0].name + ') →'; const st = STEPS(); return st[1][1].toLowerCase() + ' →'; }
function tlDone() { const a = app(), cur = a.currentFloor(); cur.tlocrt = cur.tlocrt || {}; cur.tlocrt.done = sig(cur); try { a.save(); } catch (e) { } const fs = floors(), i = fs.indexOf(cur), order = fs.slice(i + 1).concat(fs.slice(0, i)), nx = order.find(f => status(f) !== 'ok'); if (nx) toTl(nx); else goStep(STEPS()[1][0]); }
function open() { const fs = floors(); if (!fs.length) return; const cur = app().currentFloor(); if (status(cur) !== 'ok') return toTl(cur); const nx = fs.find(f => status(f) !== 'ok'); if (nx) return toTl(nx); goStep(STEPS()[1][0]); }

/* ---------- listovi ---------- */
const SA = () => root.IzmjeraSastavnica, MMcm = 0.1; /* 1:100 → 1 cm u naravi = 0,1 mm na papiru */
const GEN = { prizemlje: 'PRIZEMLJA', podrum: 'PODRUMA', suteren: 'SUTERENA', potkrovlje: 'POTKROVLJA', galerija: 'GALERIJE', tavan: 'TAVANA' };
const genName = n => { const t = String(n || '').trim(), l = t.toLowerCase(); if (GEN[l]) return GEN[l]; const m = /^(\d+)\.\s*kat$/i.exec(t); if (m) return m[1] + '. KATA'; return t.toUpperCase(); };
/* tlocrt (izlaz izrade tlocrta, cm, y prema dolje) → elementi u mm na papiru */
const TL_GRP = { ZIDOVI_NOSIVI: ['z', 0.5], ZIDOVI_PREGRADNI: ['z', 0.35], DIMNJAK: ['z', 0.35], STUPOVI: ['z', 0.35], OTVORI_VRATA: ['o', 0.18], OTVORI_PROZORI: ['o', 0.18], KOTE: ['k', 0.13], OPISI: ['t', 0.18], STUBISTE: ['s', 0.18], STUBISTE_CRTKANO: ['s', 0.18, 1], POGLED: ['p', 0.13], OSTALO: ['p', 0.13], NADVOJ: ['o', 0.13, 1], GREDE: ['p', 0.13, 1], TERASA: ['p', 0.18], PRAG: ['o', 0.13], KROVNI_PROZOR: ['p', 0.13, 1], OTVOR_PLOCA: ['p', 0.13, 1] };
function planItem(out, name) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; const ext = p => { if (!p || !Number.isFinite(p.x)) return; x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); };
  out.lines.forEach(l => { if (TL_GRP[l.layer]) { ext(l.a); ext(l.b); } }); (out.dims || []).forEach(d => { d.lines.forEach(l => { ext(l.a); ext(l.b); }); d.texts.forEach(ext); }); out.texts.forEach(t => { if (TL_GRP[t.layer]) ext(t); });
  if (!Number.isFinite(x0)) return null;
  return { name, w: (x1 - x0) * MMcm, h: (y1 - y0) * MMcm + 7, draw(S, ox, oy) { /* ox, oy = gornji lijevi kut na papiru */
    const X = x => ox + (x - x0) * MMcm, Y = y => oy - 7 - (y - y0) * MMcm, P = p => [X(p.x), Y(p.y)];
    S.T(ox, oy - 3.5, 2.5, name, { i: 1, b: 1, lay: 'NASLOV' });
    const g = out.grid; if (g) for (let i = 0; i < g.nx; i++) { let j = 0; while (j < g.ny) { if (!g.at(i, j)) { j++; continue; } let j1 = j; while (j1 + 1 < g.ny && g.at(i, j1 + 1)) j1++; S.F([[X(g.xs[i]), Y(g.ys[j])], [X(g.xs[i + 1]), Y(g.ys[j])], [X(g.xs[i + 1]), Y(g.ys[j1 + 1])], [X(g.xs[i]), Y(g.ys[j1 + 1])]], 0.82); j = j1 + 1; } }
    for (const l of out.lines) { const G = TL_GRP[l.layer]; if (G) S.L(P(l.a), P(l.b), G[1], { lay: l.layer, dash: G[2] }); }
    for (const a of out.arcs) { const G = TL_GRP[a.layer]; if (!G) continue; let s0 = Math.atan2(a.from.y - a.c.y, a.from.x - a.c.x), e0 = Math.atan2(a.to.y - a.c.y, a.to.x - a.c.x), d = e0 - s0; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      let q = null; for (let i = 0; i <= 20; i++) { const t = s0 + d * i / 20, p = { x: a.c.x + a.r * Math.cos(t), y: a.c.y + a.r * Math.sin(t) }; if (q) S.L(P(q), P(p), G[1], { lay: a.layer }); q = p; } }
    for (const c of out.circles) { const G = TL_GRP[c.layer]; if (!G) continue; let q = null; for (let i = 0; i <= 28; i++) { const t = 2 * Math.PI * i / 28, p = { x: c.c.x + c.r * Math.cos(t), y: c.c.y + c.r * Math.sin(t) }; if (q) S.L(P(q), P(p), G[1], { lay: c.layer }); q = p; } }
    for (const pl of out.polys) { const G = TL_GRP[pl.layer]; if (!G || !pl.pts || pl.pts.length < 2) continue; for (let i = 0; i < pl.pts.length - 1; i++) S.L(P(pl.pts[i]), P(pl.pts[i + 1]), G[1], { lay: pl.layer, dash: G[2] }); }
    for (const d of out.dims || []) { for (const l of d.lines) S.L(P(l.a), P(l.b), 0.13, { lay: 'KOTE' }); for (const t of d.texts) S.T(X(t.x), Y(t.y) + 0.3, 1.8, t.text, { al: 'c', rot: t.rot || 0, lay: 'KOTE' }); }
    for (const t of out.texts) { const G = TL_GRP[t.layer]; if (!G) continue; S.T(X(t.x), Y(t.y), Math.max(1.6, Math.min(3.5, (t.h || 15) * MMcm)), t.text, { al: t.align === 'l' ? 'l' : 'c', rot: t.rot || 0, b: (t.h || 0) >= 16 && t.layer === 'OPISI' && !/^P =/.test(t.text), lay: t.layer }); }
  } };
}
/* pogled ili presjek iz Pročelja (cm, z prema gore) */
const PV_W = { REZ: 0.5, SRAF: 0.13, OBRIS: 0.35, OTVORI: 0.18, KROV: 0.25, TEREN: 0.25, KOTE: 0.13 };
const STR = { S: 'SJEVERNO', J: 'JUŽNO', I: 'ISTOČNO', Z: 'ZAPADNO', SI: 'SJEVEROISTOČNO', SZ: 'SJEVEROZAPADNO', JI: 'JUGOISTOČNO', JZ: 'JUGOZAPADNO' };
const viewName = n => { const m = /^POGLED\s+([A-ZČĆŽŠĐ]+)$/.exec(String(n || '').trim()); return m && STR[m[1]] ? STR[m[1]] + ' PROČELJE' : n; };
function viewItem(v) {
  const bb = v.bbox, ttl = v.section ? v.name : viewName(v.name); return { name: ttl, w: (bb.u1 - bb.u0) * MMcm, h: (bb.z1 - bb.z0) * MMcm + 7, draw(S, ox, oy) {
    const X = u => ox + (u - bb.u0) * MMcm, Y = z => oy - 7 - (bb.z1 - z) * MMcm;
    S.T(ox, oy - 3.5, 2.5, ttl, { i: 1, b: 1, lay: 'NASLOV' });
    for (const [a, b, lay] of v.lines) S.L([X(a[0]), Y(a[1])], [X(b[0]), Y(b[1])], PV_W[lay] || 0.18, { lay: 'POGLED_' + lay });
    for (const t of v.texts) { if (t.lay === 'NASLOV') continue; S.T(X(t.u), Y(t.z), Math.max(1.6, Math.min(3, (t.h || 15) * MMcm)), t.t, { al: t.al === 'l' ? 'l' : t.al === 'r' ? 'r' : 'c', lay: 'POGLED_' + t.lay }); }
  } };
}
/* slaganje pogleda na listove: A4 kad stane, inače A3; po listu koliko stane (redovi slijeva nadesno) */
function pack(items, title) {
  const sheets = [], gap = 8;
  const fits = (it, sz) => { const A = SA().area(sz[0], sz[1]); return it.w <= A.x1 - A.x0 - 8 && it.h <= A.y1 - A.y0 - 8; };
  let cur = null;
  const newSheet = sz => { const A = SA().area(sz[0], sz[1]); cur = { sz, A, rows: [], items: [], x: A.x0 + 4, y: A.y1 - 4, rowH: 0 }; sheets.push(cur); };
  for (const it of items) {
    const need = fits(it, SA().A4) ? SA().A4 : SA().A3;
    if (!cur || (cur.sz !== need && !(need === SA().A4 && cur.sz === SA().A3))) newSheet(need);
    let placed = false;
    for (let attempt = 0; attempt < 2 && !placed; attempt++) {
      if (cur.x + it.w <= cur.A.x1 - 4 && cur.y - it.h >= cur.A.y0 + 4) { cur.items.push({ it, x: cur.x, y: cur.y }); cur.x += it.w + gap; cur.rowH = Math.max(cur.rowH, it.h); placed = true; }
      else { const ny = cur.y - cur.rowH - gap; if (cur.rowH && ny - it.h >= cur.A.y0 + 4 && cur.A.x0 + 4 + it.w <= cur.A.x1 - 4) { cur.y = ny; cur.x = cur.A.x0 + 4; cur.rowH = 0; } else newSheet(need); }
    }
    if (!placed) { cur.items.push({ it, x: cur.x, y: cur.y }); cur.x += it.w + gap; cur.rowH = Math.max(cur.rowH, it.h); } /* ne stane ni na A3 – ipak 1:100 */
  }
  sheets.forEach(s => { s.title = title; });
  return sheets;
}
/* cijeli popis listova */
function plan() {
  const D = IzmjeraEnergija.nacrtiData(), fs = D.floors, res = [], warn = [];
  fs.forEach((f, i) => { const b = D.built[i]; if (!b || b.err) { warn.push((f.name || 'Etaža') + ': ' + ((b && b.err) || 'tlocrt nije izrađen')); return; } const it = planItem(b.out, 'TLOCRT ' + genName(f.name)); if (!it) return;
    for (const s of pack([it], 'TLOCRT ' + genName(f.name))) res.push(s); });
  if (D.proc && D.proc.views && D.proc.views.length) { const secs = D.proc.views.filter(v => v.section), vws = D.proc.views.filter(v => !v.section);
    if (secs.length) { const ps = pack(secs.map(viewItem), 'PRESJEK'); ps.forEach(s => { s.title = s.items.map(x => x.it.name).join(', ').replace(/PRESJEK /g, '').replace(/^/, 'PRESJEK '); }); res.push(...ps); }
    if (vws.length) { const ps = pack(vws.map(viewItem), 'PROČELJA'); ps.forEach(s => { s.title = s.items.length === 1 ? s.items[0].it.name : 'PROČELJA'; }); res.push(...ps); } }
  else if (isLegal()) warn.push('Pročelja i presjeci nisu izrađeni (korak 2).');
  const lst = res.map((s, k) => ({ no: String(k + 1).padStart(2, '0'), name: s.title, sc: '1:100', sheet: s, fmt: s.sz === SA().A4 ? 'A4' : 'A3' }));
  if (isLegal() && D.leg) { const n0 = lst.length; const legS = IzmjeraLegalizacija.sheets(D.leg, Object.assign(D.legMeta || {}, { listG: String(n0 + 1).padStart(2, '0'), listV: String(n0 + 2).padStart(2, '0') }));
    legS.forEach((S, k) => lst.push({ no: String(n0 + 1 + k).padStart(2, '0'), name: k ? 'ISKAZ POVRŠINA I OBRAČUNSKE VELIČINE ZGRADE - OBUJAM' : 'ISKAZ POVRŠINA I OBRAČUNSKE VELIČINE ZGRADE - GBP', sc: '1:' + S.sc, built: S, fmt: 'A3' })); }
  return { lst, warn };
}
function render(L) {
  const info = root.projectInfo || {}, gr = String(info.gradjevina || '').trim(), top = (gr ? gr.toUpperCase() + ' - ' : '') + 'IZVEDENO STANJE';
  return L.map(x => { if (x.built) return x.built; const s = x.sheet, S = new (SA().Sheet)(s.sz[0], s.sz[1]); S.sc = 100;
    /* skupina pogleda u sredinu korisnog prostora */
    let gx0 = Infinity, gx1 = -Infinity, gy0 = Infinity, gy1 = -Infinity; for (const p of s.items) { gx0 = Math.min(gx0, p.x); gx1 = Math.max(gx1, p.x + p.it.w); gy1 = Math.max(gy1, p.y); gy0 = Math.min(gy0, p.y - p.it.h); }
    const A = s.A, dx = ((A.x0 + A.x1) / 2) - ((gx0 + gx1) / 2), dy = Math.min(((A.y0 + A.y1) / 2) - ((gy0 + gy1) / 2), A.y1 - 4 - gy1);
    for (const p of s.items) p.it.draw(S, p.x + dx, p.y + dy);
    SA().frame(S, { top, sast: SA().fromInfo({ sadrzaj: x.name, mjerilo: x.sc, list: x.no }) }); return S; });
}

/* ---------- 4. korak: izvoz ---------- */
function ensureDom() {
  if ($('nfWiz')) return; const d = document.createElement('div'); d.id = 'nfWiz'; d.hidden = true; d.style.cssText = 'position:fixed;inset:0;z-index:60;background:#f1f6fd;display:flex;flex-direction:column;color:#102b52;font-family:Arial,sans-serif';
  d.innerHTML = '<div class="tl-head"><b>📐 Nacrti</b><span id="nfProj" style="font-size:13px;color:#c4d8f1"></span><span style="flex:1"></span><button id="nfClose" class="tl-btn">✕ Zatvori</button></div><div id="nfFlow" style="background:#12305e;padding:6px 12px"></div><div id="nfBody" style="flex:1;overflow:auto;padding:14px 18px"></div>';
  document.body.appendChild(d); $('nfClose').onclick = () => nfShow(false);
}
let LAST = null;
function showExport() {
  ensureDom(); nfShow(true); $('nfProj').textContent = ' ' + ((app() && app().projectName()) || ''); bar($('nfFlow'), 'iz');
  const body = $('nfBody'); body.innerHTML = '<p>Slažem listove…</p>';
  setTimeout(() => { let P; try { P = plan(); } catch (e) { body.innerHTML = '<p style="color:#b91c1c">Nacrti se ne mogu složiti: ' + esc(e.message || e) + '</p>'; return; } LAST = P;
    const info = root.projectInfo || {}, miss = [['invIme', 'investitor'], ['gradjevina', 'naziv građevine'], ['td', 'T.D.'], ['adresa', 'adresa'], ['kc', 'k.č.']].filter(([k]) => !String(info[k] || '').trim()).map(x => x[1]);
    let h = '<h3 style="margin-top:0">Izvoz nacrta</h3><p class="tl-note">Tlocrti, presjeci i pročelja u mjerilu 1:100; list je A4 kad nacrt stane, inače A3. Okvir i sastavnica kao na tvojim nacrtima, podaci iz Podataka o projektu.</p>';
    if (miss.length) h += '<p style="color:#b45309">Za sastavnicu nedostaje: ' + esc(miss.join(', ')) + '. <button class="tl-btn" id="nfInfo">✎ Podaci o projektu</button></p>';
    if (P.warn.length) h += '<p style="color:#b45309">' + P.warn.map(esc).join('<br>') + '</p>';
    h += '<table style="border-collapse:collapse;font-size:15px;margin:8px 0"><tr style="color:#475569"><th></th><th style="text-align:left;padding:4px 10px">List</th><th style="text-align:left;padding:4px 10px">Naziv</th><th style="padding:4px 10px">Mjerilo</th><th style="padding:4px 10px">Format</th></tr>' +
      P.lst.map((x, k) => '<tr style="border-top:1px solid #dbe4f0"><td><input type="checkbox" data-nk="' + k + '" checked style="width:20px;height:20px"></td><td style="padding:6px 10px">' + x.no + '</td><td style="padding:6px 10px">' + esc(x.name) + '</td><td style="padding:6px 10px;text-align:center">' + x.sc + '</td><td style="padding:6px 10px;text-align:center">' + x.fmt + '</td></tr>').join('') + '</table>';
    h += '<div class="tl-actions"><button class="tl-btn primary" id="nfPdf">⬇ Svi nacrti – PDF</button><button class="tl-btn" id="nfDxf">⬇ Svi nacrti – DXF</button></div><p class="tl-note">Brojevi listova idu i u popis grafičkih priloga u snimci izvedenog stanja.</p>';
    body.innerHTML = h;
    if ($('nfInfo')) $('nfInfo').onclick = () => IzmjeraPodaci.editCurrent(() => showExport());
    const chosen = () => { const on = [...body.querySelectorAll('[data-nk]')].filter(c => c.checked).map(c => P.lst[+c.dataset.nk]); return on; };
    const base = String((app() && app().projectName()) || 'izmjera').replace(/[^a-z0-9čćžšđ_-]+/gi, '_');
    $('nfPdf').onclick = () => { try { const L = chosen(); if (!L.length) return; IzmjeraEnergijaIzvoz.saveBytes(SA().toPdf(render(L)), base + '_nacrti.pdf', 'application/pdf'); } catch (e) { alert('PDF nije složen: ' + (e.message || e)); } };
    $('nfDxf').onclick = () => { try { const L = chosen(); if (!L.length) return; IzmjeraEnergijaIzvoz.saveBytes(new TextEncoder().encode(SA().toDxf(render(L))), base + '_nacrti.dxf', 'application/dxf'); } catch (e) { alert('DXF nije složen: ' + (e.message || e)); } };
  }, 30);
}
/* popis listova za snimku izvedenog stanja (bez crtanja) */
function lists() { try { return plan().lst.map(x => [x.no, x.name, x.sc]); } catch (e) { return null; } }
root.IzmjeraNacrti = { open, bar, tlDone, nextLabel, goStep, status, showExport, plan, render, lists };
})(typeof window !== 'undefined' ? window : globalThis);
