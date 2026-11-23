/* Izmjera 57 — Energetski certifikat: unos po etažama, prostorije, otvori, konstrukcije, sustavi, rezultat i izvoz. */
(function () {
'use strict';
const EC = window.IzmjeraEnergijaCalc, EX = window.IzmjeraEnergijaIzvoz, $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const m2 = v => (v / 1e4).toFixed(2).replace('.', ','), m3 = v => (v / 1e6).toFixed(2).replace('.', ','), n1 = v => (Math.round(v * 10) / 10).toString().replace('.', ',');
const num = (v, d) => EC.num(v, d);
const OKVIRI = ['PVC', 'Drvo', 'Aluminij', 'Drvo-aluminij', 'Čelik', 'Ostalo'], STAKLA = ['Jednostruko', 'Dvostruko', 'Dvostruko Low-E', 'Trostruko', 'Ostalo'];
const MATERIJALI = ['Puna opeka', 'Šuplja opeka / blok', 'Porobeton (Ytong)', 'Armirani beton', 'Kamen', 'Drvo / montažno', 'Sitnorebrasti strop', 'Ostalo'];
const IZOLACIJE = ['Nema', 'EPS (stiropor)', 'XPS', 'Kamena vuna', 'Staklena vuna', 'Ostalo'];
const GRIJANJE = ['Plinski kotao (klasični)', 'Plinski kondenzacijski kotao', 'Kotao na lož ulje', 'Kotao na drva', 'Kotao na pelete', 'Dizalica topline zrak-voda', 'Dizalica topline (ostale)', 'Električno (grijalice / TA peć)', 'Klima uređaji (split)', 'Daljinsko grijanje', 'Peć na drva', 'Ostalo'];
const PTV = ['Isti kotao kao grijanje', 'Električni bojler', 'Plinski protočni bojler', 'Dizalica topline za PTV', 'Solarni kolektori + dogrijavanje', 'Ostalo'];
const HLAD = ['Nema', 'Split klima uređaji', 'Dizalica topline (reverzibilna)', 'Ostalo'];
const VENT = ['Prirodna (prozori)', 'Mehanička odsisna (kupaonica/kuhinja)', 'Mehanička s rekuperacijom', 'Ostalo'];
const SEG_KINDS = [['vanjski', 'Vanjski zid'], ['negrijano', 'Prema negrijanom prostoru'], ['garaza', 'Prema garaži'], ['stubiste', 'Prema negrijanom stubištu'], ['susjed_g', 'Susjedna zgrada (grijana)'], ['susjed_n', 'Susjedna zgrada (negrijana)']];
const segOvOf = s => { const o = (E(S.fi).segOv || {})[s.key]; if (o == null && s && s.ov) return s.ov; return typeof o === 'string' ? { k: o } : (o || {}); };
function setSegOv(s, k, L) { const e = E(S.fi); e.segOv = e.segOv || {}; if ((!k || k === 'vanjski') && !(s.np > 1 && e.segOv[s.pkey])) delete e.segOv[s.key]; else e.segOv[s.key] = L > 0 && !(s.np > 1) ? { k: k || 'vanjski', L } : { k: k || 'vanjski' }; }
/* v2.50: rezovi pročelja (E.segCut[pkey] = { off: [isključeni okomiti zidovi], man: [ručni rezovi] }, sve u cm od početka pročelja) */
function cutCfg(info) { const e = E(S.fi); e.segCut = e.segCut || {}; return e.segCut[info.pkey] = e.segCut[info.pkey] || {}; }
function cutClean(info) { const e = E(S.fi), c = e.segCut && e.segCut[info.pkey]; if (c && !(c.off || []).length && !(c.man || []).length) delete e.segCut[info.pkey]; }
function cutAdd(info, pos) { pos = Math.round(pos * 10) / 10; if (!(pos > 4 && pos < info.s1 - info.s0 - 4)) return false; const c = cutCfg(info); c.man = (c.man || []).filter(v => Math.abs(v - pos) > 2).concat(pos).sort((a, b) => a - b); return true; }
function cutToggle(info, cut) { const c = cutCfg(info); if (cut.auto) { const off = c.off || []; c.off = cut.on ? off.concat(cut.pos) : off.filter(v => Math.abs(v - cut.pos) >= 3); } else c.man = (c.man || []).filter(v => Math.abs(v - cut.pos) > 0.5); cutClean(info); }
const sideW = (info, end) => info.o === 'H' ? (end ? 'desnog' : 'lijevog') : (end ? 'donjeg' : 'gornjeg');
const cm = v => String(Math.round(v * 10) / 10).replace('.', ',');
function segTitle(s) { return 'Pročelje ' + esc(s.lab || String(s.n)) + ' · ' + esc(s.strana) + ' · ' + cm(s.L) + ' cm' + (s.roomName ? ' <span style="color:#64748b;font-weight:400">(iza: ' + esc(s.roomName) + ')</span>' : ''); }
function segEditor(s, idp) { const ov = segOvOf(s), k = ov.k || 'vanjski';
  return '<div class="tl-chips">' + SEG_KINDS.map(([kk, n]) => '<button class="tl-chip' + (kk === k ? ' on' : '') + '" data-' + idp + 'k="' + kk + '" data-seg="' + esc(s.key) + '">' + n + '</button>').join('') + '</div>' +
    (k !== 'vanjski' && ov.L != null && !(s.np > 1) ? '<label class="tl-field">Samo dio duljine (m) – staro; bolje prereži zid ✂ ispod<input data-' + idp + 'l="1" data-seg="' + esc(s.key) + '" inputmode="decimal" value="' + esc(String(ov.L).replace('.', ',')) + '"></label>' : '') + cutEditor(s, idp); }
function cutEditor(s, idp) { const info = s.cutInfo; if (!info) return ''; const fe = S.cutEnd ? 1 : 0, ds = esc(s.key);
  if (!S.cutOpen) return '<div style="margin-top:8px"><button class="tl-btn" data-' + idp + 'co="1" data-seg="' + ds + '">✂ Prereži / spoji dijelove…</button></div>';
  let h = '<div class="tl-field" style="margin-top:8px">✂ Prereži ovaj dio (' + cm(s.L) + ' cm)</div><div class="tl-chips">' + [0, 1].map(v => '<button class="tl-chip' + (v === fe ? ' on' : '') + '" data-' + idp + 'ce="' + v + '" data-seg="' + ds + '">od ' + sideW(info, v) + ' kraja</button>').join('') + '</div>' +
    '<div style="display:flex;gap:6px;align-items:center;margin:4px 0"><input data-' + idp + 'cv="1" data-seg="' + ds + '" inputmode="decimal" placeholder="cm" style="width:90px"> cm <button class="tl-btn" data-' + idp + 'ca="1" data-seg="' + ds + '">Dodaj rez</button><button class="tl-btn" data-' + idp + 'ct="1" data-seg="' + ds + '">✂ Reži dodirom</button></div>';
  if (info.cuts.length) h += '<div class="tl-note" style="margin:4px 0 2px">Rezovi na pročelju ' + info.pn + ' (od ' + sideW(info, 0) + ' kraja):</div>' + info.cuts.map((c, i) => '<div style="display:flex;align-items:center;gap:6px;font-size:13px;margin:2px 0"><span style="flex:1">' + (c.auto ? 'Okomiti zid' : '✂ Rez') + ' na ' + cm(c.pos) + ' cm' + (c.auto && !c.on ? ' <i style="color:#94a3b8">(spojeno)</i>' : '') + '</span><button class="tl-btn" data-' + idp + 'cx="' + i + '" data-seg="' + ds + '">' + (c.auto ? (c.on ? 'Spoji' : 'Razdvoji') : 'Ukloni') + '</button></div>').join('');
  return h; }
function bindSegEditor(root, idp, after) { const res = S.res[S.fi]; const segBy = key => res.segs.find(x => x.key === key);
  root.querySelectorAll('[data-' + idp + 'k]').forEach(bt => bt.onclick = () => { const s = segBy(bt.dataset.seg), ov = segOvOf(s); setSegOv(s, bt.getAttribute('data-' + idp + 'k'), ov.L); refresh(); after(s); });
  root.querySelectorAll('[data-' + idp + 'l]').forEach(inp => inp.onchange = () => { const s = segBy(inp.dataset.seg), ov = segOvOf(s); setSegOv(s, ov.k, num(inp.value, 0)); refresh(); after(s); });
  root.querySelectorAll('[data-' + idp + 'co]').forEach(bt => bt.onclick = () => { S.cutOpen = true; after(segBy(bt.dataset.seg)); });
  root.querySelectorAll('[data-' + idp + 'ce]').forEach(bt => bt.onclick = () => { S.cutEnd = bt.getAttribute('data-' + idp + 'ce') === '1'; after(segBy(bt.dataset.seg)); });
  const addV = s => { const inp = root.querySelector('[data-' + idp + 'cv][data-seg="' + CSS.escape(s.key) + '"]'), v = num(inp && inp.value, NaN); if (!(v > 0 && v < s.L)) { if (inp) inp.style.borderColor = '#dc2626'; return; } const pos = s.off0 + (S.cutEnd ? s.L - v : v); if (cutAdd(s.cutInfo, pos)) { save(); refresh(); after(segAtPos(s.cutInfo, pos - 1) || s); } };
  root.querySelectorAll('[data-' + idp + 'ca]').forEach(bt => bt.onclick = () => addV(segBy(bt.dataset.seg)));
  root.querySelectorAll('[data-' + idp + 'cv]').forEach(inp => inp.onchange = () => { if (inp.value) addV(segBy(inp.dataset.seg)); });
  root.querySelectorAll('[data-' + idp + 'ct]').forEach(bt => bt.onclick = () => { const s = segBy(bt.dataset.seg); S.cutTap = s.cutInfo.pkey; hidePop(); const pp = $('enPop'); pp.innerHTML = '<div class="tl-pop-head"><b>✂ Dodirni pročelje ' + s.cutInfo.pn + ' gdje ga režeš</b><button class="tl-btn" id="enPx">✕</button></div><p class="tl-note">Rez se lijepi za rub prozora/vrata i okomiti zid. Točnu mjeru poslije možeš popraviti.</p>'; pp.hidden = false; $('enPx').onclick = () => { S.cutTap = null; hidePop(); }; });
  root.querySelectorAll('[data-' + idp + 'cx]').forEach(bt => bt.onclick = () => { const s = segBy(bt.dataset.seg), info = s.cutInfo, c = info.cuts[+bt.getAttribute('data-' + idp + 'cx')]; cutToggle(info, c); save(); refresh(); after(segAtPos(info, Math.max(0.5, c.pos - 1)) || s); }); }
function segAtPos(info, pos) { const r = S.res[S.fi]; return r && r.segs.find(x => x.pkey === info.pkey && pos >= x.off0 - 0.01 && pos <= x.off0 + x.L + 0.01); }
const S = { open: false, tab: 1, fi: 0, built: [], res: [], view: null, pop: null };
const TABS = ['Etaže', 'Prostorije', 'Otvori', 'Konstrukcije', 'Sustavi i foto', 'Rezultat', 'Pročelja', 'Izvješće', 'GBP i obujam'];
const visTabs = () => (isEnerg() ? [1, 2, 3, 4, 5, 6, 8] : [1, 2, 3]).concat(isLegal() ? [7, 9] : []);
function P() { if (!window.projectEnergija || typeof window.projectEnergija !== 'object') window.projectEnergija = {}; const p = window.projectEnergija; p.defaults = p.defaults || {}; p.sastav = p.sastav || {}; p.sustavi = p.sustavi || {}; p.foto = p.foto || {}; return p; }
const floors = () => (window.IzmjeraApp && IzmjeraApp.floors()) || [];
function E(i) { const f = floors()[i]; if (!f) return {}; if (!f.energija) f.energija = {}; return f.energija; }
function save() { try { IzmjeraApp.save(); } catch (e) { } }
function getPath(o, p) { return p.split('.').reduce((a, k) => a == null ? undefined : a[k], o); }
function setPath(o, p, v) { const ks = p.split('.'); let a = o; ks.slice(0, -1).forEach(k => { if (a[k] == null || typeof a[k] !== 'object') a[k] = {}; a = a[k]; }); if (v === null || v === '' || v === undefined) delete a[ks.at(-1)]; else a[ks.at(-1)] = v; }
function isLegal() { const i = window.projectInfo || {}; return Array.isArray(i.vrsta) && i.vrsta.includes('legalizacija'); }
function onlyLegal() { return isLegal() && !isEnerg(); }
const IZNAD_L = [['grijano', 'Druga etaža'], ['tavan', 'Tavan (krov iznad)'], ['kosi', 'Potkrovlje – kosi krov bez ploče'], ['ravni', 'Ravni krov'], ['negrijano', 'Ostalo']];
const ISPOD_L = [['grijano', 'Druga etaža'], ['tlo', 'Tlo'], ['podrum', 'Podrum'], ['garaza', 'Garaža'], ['vanjski', 'Vanjski zrak (prolaz, konzola)'], ['negrijano', 'Ostalo']];
function isEnerg() { const i = window.projectInfo || {}; return Array.isArray(i.vrsta) && i.vrsta.includes('energetski'); }
function wizTitle() { return isEnerg() && isLegal() ? '⚡ Energetika i pročelja' : isEnerg() ? '⚡ Energetika' : '🏠 Pročelja'; }
function syncButton() { const b = $('enOpen'); if (b) { b.hidden = !(isEnerg() || isLegal()); b.textContent = wizTitle(); } }

/* ---------- izrada i proračun ---------- */
function buildAll() {
  const fs = floors(); S.built = fs.map(f => { try { if (!(f.items || []).some(o => o.layer === 'nacrt')) return { err: 'Etaža nema nacrt.' }; return IzmjeraTlocrtUI.buildFloor(f); } catch (e) { return { err: e.message || String(e) }; } });
  // početne vrijednosti
  const ok = S.built.map((b, i) => !b.err && E(i).ukljuci !== false), idx = ok.map((v, i) => v ? i : -1).filter(i => i >= 0), lo = idx[0], hi = idx.at(-1);
  fs.forEach((f, i) => { const e = E(i), b = S.built[i]; if (b.err || e.init) return; e.init = 1;
    const hs = (b.out.rooms || []).map(r => r.h).filter(v => v > 0).sort((a, b2) => a - b2); e.h = hs.length ? hs[hs.length >> 1] : 260;
    e.konstr = { mode: 'ploca', d: 20 }; e.ispod = i === lo ? 'tlo' : 'grijano'; e.dIspod = 30; e.iznad = i === hi ? 'tavan' : 'grijano'; });
  save(); recalc();
}
function northOf(i) { const b = S.built[i]; const n = b && b.st && b.st.north; if (n != null) return { v: n, src: 'tlocrt' }; const e = E(i); if (e.north != null) return { v: num(e.north, 0), src: 'ručno' }; if (P().north != null) return { v: num(P().north, 0), src: 'ručno' }; return { v: 0, src: 'nema' }; }
function recalc() {
  S.res = S.built.map((b, i) => { if (b.err || E(i).ukljuci === false) return null; try { return EC.calcFloor(b.out, E(i), P(), northOf(i).v); } catch (e) { return { err: e.message || String(e) }; } });
  S.resAll = S.built.map((b, i) => { if (b.err || E(i).ukljuci === false) return null; try { return EC.calcFloor(b.out, E(i), P(), northOf(i).v, { allHeated: true }); } catch (e) { return { err: e.message || String(e) }; } });
  S.proc = null; S.leg = null;
}
function included() { return floors().map((f, i) => ({ i, name: f.name || 'Etaža ' + (i + 1), res: S.res[i] })).filter(x => x.res && !x.res.err); }

/* ---------- DOM ---------- */
function ensureDom() {
  if ($('enWiz')) return;
  const d = document.createElement('div'); d.id = 'enWiz'; d.className = 'tl-wiz-like'; d.hidden = true;
  d.innerHTML = '<div class="tl-head"><b>⚡ Energetski certifikat</b><span id="enProj" style="font-size:13px;color:#c4d8f1"></span><div class="tl-steps" id="enTabs"></div><button id="enClose" class="tl-btn">✕ Zatvori</button></div>' +
    '<div class="tl-body"><div class="tl-view"><canvas id="enCanvas"></canvas><div class="tl-zoom"><button id="enFit" class="tl-btn">⤢</button></div><div id="enPop" class="tl-pop" hidden></div><div id="enLegend" class="en-legend"></div></div><div class="tl-panel" id="enPanel"></div></div>';
  document.body.appendChild(d);
  $('enClose').onclick = close; $('enFit').onclick = () => { S.view = null; draw(); };
  const cv = $('enCanvas'); let down = null, moved = false; const ptr = new Map(); let g = null;
  cv.addEventListener('pointerdown', e => { ptr.set(e.pointerId, { x: e.offsetX, y: e.offsetY }); down = { x: e.offsetX, y: e.offsetY }; moved = false; g = null; try { cv.setPointerCapture(e.pointerId); } catch (er) { }
    S.edgeDrag = null; if (ptr.size === 1 && S.tab === 7 && S.opSel && S.view && !S.cutPick) { const v = curView(), og = v && (v.opGeom || []).find(o => o.key === S.opSel); if (og) { const u = (e.offsetX - S.view.ox) / S.view.s, z = (S.view.oy - e.offsetY) / S.view.s, tol = 16 / S.view.s;
      if (u >= og.u0 - tol && u <= og.u1 + tol) { if (Math.abs(z - og.z1) < tol) S.edgeDrag = { edge: 't', g: og, z: og.z1 }; else if (og.win && Math.abs(z - og.z0) < tol) S.edgeDrag = { edge: 'b', g: og, z: og.z0 }; } } } });
  cv.addEventListener('pointermove', e => { if (!ptr.has(e.pointerId) || !S.view) return; const prev = ptr.get(e.pointerId), p = { x: e.offsetX, y: e.offsetY }; ptr.set(e.pointerId, p);
    if (S.edgeDrag && ptr.size === 1) { moved = true; const d = S.edgeDrag, z = (S.view.oy - p.y) / S.view.s; d.z = d.edge === 't' ? Math.max(d.g.z0 + 20, z) : Math.min(d.g.z1 - 20, Math.max(d.g.zf, z)); draw(); return; }
    if (ptr.size === 1) { if (Math.hypot(p.x - down.x, p.y - down.y) > 6) moved = true; if (moved) { S.view.ox += p.x - prev.x; S.view.oy += p.y - prev.y; draw(); } }
    else if (ptr.size === 2) { moved = true; const [a, b] = [...ptr.values()], dd = Math.hypot(a.x - b.x, a.y - b.y), c = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; if (g) { const w = inv(g.c); S.view.s *= dd / (g.d || 1); S.view.ox = c.x - w.x * S.view.s; S.view.oy = c.y - w.y * S.view.s; draw(); } g = { d: dd, c }; } });
  const up = e => { if (!ptr.has(e.pointerId)) return; ptr.delete(e.pointerId);
    if (S.edgeDrag && !ptr.size) { const d = S.edgeDrag; S.edgeDrag = null; if (d.edge === 't') setOp(d.g, d.z - d.g.z0, null); else setOp(d.g, d.g.z1 - d.z, d.z - d.g.zf); const sc = $('enPanel').scrollTop; go(7); $('enPanel').scrollTop = sc; return; } if (!ptr.size && !moved) tap({ x: e.offsetX, y: e.offsetY }); if (!ptr.size) g = null; };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', e => { e.preventDefault(); if (!S.view) return; const f = e.deltaY < 0 ? 1.15 : 1 / 1.15; S.view.ox = e.offsetX - (e.offsetX - S.view.ox) * f; S.view.oy = e.offsetY - (e.offsetY - S.view.oy) * f; S.view.s *= f; draw(); }, { passive: false });
  window.addEventListener('resize', () => { if (S.open) draw(); });
}
function open() {
  if (!window.IzmjeraTlocrtUI || !IzmjeraTlocrtUI.buildFloor) { alert('Nedostaje modul tlocrta.'); return; }
  ensureDom(); $('enWiz').hidden = false; S.open = true; $('enProj').textContent = ((window.IzmjeraApp && IzmjeraApp.projectName()) || '') + (() => { try { const Z = IzmjeraApp.zg, L = Z.list(); if (L.length < 2) return ''; const b = L.find(x => x.id === Z.cur()); return b ? ' – ' + b.name : ''; } catch (e) { return ''; } })(); S.leg = null; S.proc = null;
  S.fi = Math.max(0, floors().indexOf(IzmjeraApp.currentFloor())); S.view = null; S.pop = null;
  buildAll(); if (S.built[S.fi] && S.built[S.fi].err) { const k = S.built.findIndex(b => !b.err); if (k >= 0) S.fi = k; }
  go(S.tab || 1);
}
function close() { S.open = false; S.flow = false; $('enWiz').hidden = true; const fh = $('enFlow'); if (fh) fh.hidden = true; save(); }
/* v2.74: otvaranje iz toka „📐 Nacrti” */
function openTab(t, o) { S.tab = t; open(); S.flow = !!(o && o.flow); if (S.flow) go(t); }
function nacrtiData() { buildAll(); recalc(); const R = legCalc(); let legMeta = null; try { legMeta = R ? legMeta0() : null; } catch (e) { } return { floors: floors(), built: S.built, proc: isLegal() ? procBuild() : null, leg: isLegal() ? R : null, legMeta }; }
function go(t) {
  const vt = visTabs(); if (!vt.includes(t)) t = vt[0]; S.tab = t; hidePop();
  const hd = $('enWiz').querySelector('.tl-head b'); if (hd) hd.textContent = S.flow ? '📐 Nacrti' : wizTitle();
  { let fh = $('enFlow'); if (!fh) { fh = document.createElement('div'); fh.id = 'enFlow'; fh.style.cssText = 'background:#12305e;padding:6px 12px'; $('enWiz').querySelector('.tl-head').after(fh); } if (S.flow && window.IzmjeraNacrti) IzmjeraNacrti.bar(fh, t === 9 ? 'gbp' : 'pr'); else fh.hidden = true; }
  $('enTabs').innerHTML = vt.map((k, i) => '<span data-t="' + k + '" class="' + (k === t ? 'on' : '') + '" style="cursor:pointer">' + (i + 1) + '. ' + TABS[k - 1] + '</span>').join('');
  $('enTabs').querySelectorAll('[data-t]').forEach(s => s.onclick = () => go(+s.dataset.t));
  [null, tabEtaze, tabProstorije, tabOtvori, tabKonstrukcije, tabSustavi, tabRezultat, tabProcelja, tabIzvjesce, tabLegal][t]();
  draw();
}
const panel = h => { $('enPanel').innerHTML = h; };
const refresh = () => { recalc(); save(); draw(); updateInfo(); };
function floorPicker() {
  const fs = floors();
  return '<label class="tl-field">Etaža<select id="enFloor" class="en-sel">' + fs.map((f, i) => '<option value="' + i + '"' + (i === S.fi ? ' selected' : '') + '>' + esc(f.name || 'Etaža ' + (i + 1)) + (S.built[i] && S.built[i].err ? ' (nema tlocrta)' : E(i).ukljuci === false ? ' (nije u proračunu)' : '') + '</option>').join('') + '</select></label>';
}
function bindFloorPicker() { const s = $('enFloor'); if (s) s.onchange = () => { S.fi = +s.value; S.view = null; go(S.tab); }; }
/* polja povezana s objektom (E etaže ili P projekta) */
function fNum(root, path, label, ph, unit) { const v = getPath(root === 'P' ? P() : E(S.fi), path); return '<label class="tl-field">' + label + (unit ? ' (' + unit + ')' : '') + '<input data-root="' + root + '" data-path="' + path + '" data-num="1" type="text" inputmode="decimal" value="' + esc(v != null ? String(v).replace('.', ',') : '') + '" placeholder="' + esc(ph || '') + '"></label>'; }
function fChk(root, path, label) { const v = getPath(root === 'P' ? P() : E(S.fi), path); return '<label class="tl-check" style="margin:4px 0"><input type="checkbox" data-root="' + root + '" data-path="' + path + '" data-re="1"' + (v ? ' checked' : '') + '> ' + label + '</label>'; }
function fTxt(root, path, label, ph) { const v = getPath(root === 'P' ? P() : E(S.fi), path); return '<label class="tl-field">' + label + '<input data-root="' + root + '" data-path="' + path + '" value="' + esc(v || '') + '" placeholder="' + esc(ph || '') + '"></label>'; }
function fSel(root, path, label, opts, def, re) { const v = getPath(root === 'P' ? P() : E(S.fi), path) || def || ''; return '<label class="tl-field">' + label + '<select class="en-sel" data-root="' + root + '" data-path="' + path + '"' + (re ? ' data-re="1"' : '') + '>' + opts.map(o => { const [k, n] = Array.isArray(o) ? o : [o, o]; return '<option value="' + esc(k) + '"' + (k === v ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('') + '</select></label>'; }
function bindFields() {
  $('enPanel').querySelectorAll('[data-path]').forEach(el => {
    const ev = el.tagName === 'SELECT' || el.type === 'checkbox' ? 'change' : 'change';
    el.addEventListener(ev, () => {
      const root = el.dataset.root === 'P' ? P() : E(S.fi); let v = el.type === 'checkbox' ? el.checked : el.value;
      if (el.dataset.num) { v = String(v).trim() === '' ? null : num(v, null); }
      setPath(root, el.dataset.path, v); refresh(); if (el.dataset.re) go(S.tab);
    });
  });
}
function updateInfo() { const el = $('enFloorInfo'); if (el) el.innerHTML = floorInfoHtml(); }
function floorInfoHtml() {
  const r = S.res[S.fi], b = S.built[S.fi]; if (b && b.err) return '<p class="tl-note" style="color:#b91c1c">' + esc(b.err) + '</p>'; if (!r) return '<p class="tl-note">' + (onlyLegal() ? 'Etaža nije uključena u pročelja.' : 'Etaža nije uključena u proračun.') + '</p>'; if (r.err) return '<p class="tl-note" style="color:#b91c1c">' + esc(r.err) + '</p>';
  const nn = northOf(S.fi);
  if (onlyLegal()) return '<div class="en-info">Bruto visina etaže: <b>' + n1(r.Hh.Hb) + ' cm</b>' + (E(S.fi).iznad === 'kosi' ? ' · zidovi do nadzida: <b>' + n1(r.Hwall) + ' cm</b>' : '') + '<br>Tlocrtna površina (vanjske mjere): <b>' + m2(r.AZ) + ' m²</b> · neto: <b>' + m2(r.Ak) + ' m²</b>' +
    (nn.src === 'nema' ? '<br><span style="color:#5b6b80">Sjever nije zadan – pročelja se nazivaju (J, I, S, Z) kao da je sjever gore.</span>' : '<br>Sjever: ' + n1(nn.v) + '° (' + nn.src + ')') + '</div>';
  return '<div class="en-info">Bruto visina etaže: <b>' + n1(r.Hh.Hb) + ' cm</b>' + (E(S.fi).iznad === 'kosi' ? ' · zidovi do nadzida: <b>' + n1(r.Hwall) + ' cm</b>' : '') + '<br>Tlocrtna površina (vanjske mjere): <b>' + m2(r.AZ) + ' m²</b> · grijana neto (Ak): <b>' + m2(r.Ak) + ' m²</b><br>Bruto volumen etaže: <b>' + m3(r.Ve) + ' m³</b>' +
    (nn.src === 'nema' ? '<br><span style="color:#b45309">⚠ Sjever nije zadan – strane svijeta računaju se kao da je sjever gore. Upiši ga ispod.</span>' : '<br>Sjever: ' + n1(nn.v) + '° (' + nn.src + ')') + '</div>';
}

/* ---------- 1. Etaže ---------- */
/* sastav krova (rog + slojevi) za presjek i pročelja; tag = 'E' (etaža) ili indeks dijela */
function krovHtml(ks, tag, heated) {
  const PR = window.IzmjeraProcelja; if (!PR || !isLegal()) return ''; const rb = PR.roofBuild(ks, heated), L = Array.isArray(ks.slojevi) ? ks.slojevi : rb.up.concat(rb.dn.map(l => ({ ...l, gdje: 'ispod' })));
  let h = '<div class="en-det" style="padding:6px 10px"><b>Sastav krova</b> <span class="tl-note">(za presjek i debljinu krova na pročeljima)</span>' +
    '<label class="tl-field">Visina roga (cm)<input data-kr="' + tag + '" data-kf="rog" inputmode="decimal" value="' + esc(ks.rog != null ? ks.rog : '') + '" placeholder="18"></label>';
  h += '<div class="tl-note">Slojevi odozgo prema dolje' + (Array.isArray(ks.slojevi) ? '' : ' (zadano – promijeni po potrebi)') + ':</div>';
  L.forEach((l, i) => { h += '<div style="display:flex;gap:6px;align-items:center;margin:4px 0"><input data-kr="' + tag + '" data-ki="' + i + '" data-kf="n" value="' + esc(l.n || '') + '" placeholder="naziv sloja" style="flex:2;min-width:0;font-size:16px;padding:7px;border-radius:8px;border:2px solid #9dbbe0"><input data-kr="' + tag + '" data-ki="' + i + '" data-kf="d" inputmode="decimal" value="' + esc(l.d != null ? l.d : '') + '" placeholder="cm" style="width:64px;font-size:16px;padding:7px;border-radius:8px;border:2px solid #9dbbe0"><select class="en-sel" data-kr="' + tag + '" data-ki="' + i + '" data-kf="gdje" style="width:auto"><option value="iznad"' + ((l.gdje || 'iznad') !== 'ispod' ? ' selected' : '') + '>iznad rogova</option><option value="ispod"' + (l.gdje === 'ispod' ? ' selected' : '') + '>ispod rogova</option></select><button class="tl-btn" data-kr="' + tag + '" data-ki="' + i + '" data-kdel="1">✕</button></div>'; });
  h += '<div class="tl-actions"><button class="tl-btn" data-kr="' + tag + '" data-kadd="1">＋ Sloj</button></div><div class="tl-note">Ukupno: ' + String(Math.round((rb.top + rb.sDn) * 100) / 100).replace('.', ',') + ' cm (rog ' + rb.rog + ' + iznad ' + rb.sUp + ' + ispod ' + rb.sDn + '). Izolacija između rogova ne povećava debljinu.</div></div>';
  return h;
}
function bindKrov(getKs, heatedOf, again) {
  const cur = tag => { const ks = getKs(tag); if (!Array.isArray(ks.slojevi)) { const rb = IzmjeraProcelja.roofBuild(ks, heatedOf(tag)); ks.slojevi = rb.up.map(l => ({ n: l.n, d: l.d })).concat(rb.dn.map(l => ({ n: l.n, d: l.d, gdje: 'ispod' }))); } return ks.slojevi; };
  $('enPanel').querySelectorAll('[data-kr]').forEach(el => {
    const tag = el.dataset.kr;
    if (el.dataset.kadd) el.onclick = () => { cur(tag).push({ n: '', d: '', gdje: 'iznad' }); again(); };
    else if (el.dataset.kdel) el.onclick = () => { cur(tag).splice(+el.dataset.ki, 1); again(); };
    else el.onchange = () => { const ks = getKs(tag), f = el.dataset.kf;
      if (f === 'rog') { const v = num(el.value, null); if (v == null) delete ks.rog; else ks.rog = v; }
      else { const l = cur(tag)[+el.dataset.ki]; if (f === 'd') l.d = num(el.value, null); else if (f === 'gdje') { if (el.value === 'ispod') l.gdje = 'ispod'; else delete l.gdje; } else l.n = el.value; }
      again(); };
  });
}
function partsHtml() {
  const e = E(S.fi), ds = e.dijelovi || [], r = S.resAll[S.fi]; if (!r || r.err) return '';
  let h = '<div class="en-box"><div class="en-box-h">Dijelovi etaže s drugom visinom ili krovom</div><p class="tl-note">Npr. garaža ili ulaz uz kuću s nižim krovom. Ostale prostorije su glavni dio.</p>';
  ds.forEach((d, i) => { const ks = d.kosi || {};
    h += '<div class="en-det" style="padding:6px 10px"><div style="display:flex;gap:6px;align-items:center"><input data-dp="' + i + '" data-f="naziv" value="' + esc(d.naziv || '') + '" placeholder="naziv (npr. Garaža)" style="flex:1;font-size:16px;padding:8px;border-radius:8px;border:2px solid #9dbbe0"><button class="tl-btn" data-dpdel="' + i + '">✕</button></div>' +
      '<div class="tl-chips">' + r.rooms.map(ro => '<button class="tl-chip' + ((d.rooms || []).includes(ro.key) ? ' on' : '') + '" data-dr="' + i + '" data-k="' + esc(ro.key) + '">' + esc(ro.name || '(bez naziva)') + '</button>').join('') + '</div>' +
      '<div class="en-grid"><label class="tl-field">Svijetla visina (cm)<input data-dp="' + i + '" data-f="h" inputmode="decimal" value="' + esc(d.h != null ? d.h : '') + '" placeholder="' + esc(e.h || 260) + '"></label><label class="tl-field">Ploča iznad (cm)<input data-dp="' + i + '" data-f="d" inputmode="decimal" value="' + esc(d.konstr && d.konstr.d != null ? d.konstr.d : '') + '" placeholder="20"></label></div>' +
      '<label class="tl-field">Iznad<select class="en-sel" data-dp="' + i + '" data-f="iznad">' + EC.IZNAD.map(([k, n]) => '<option value="' + k + '"' + ((d.iznad || 'ravni') === k ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></label>' +
      ((d.iznad || 'ravni') === 'tavan' || d.iznad === 'kosi' ? '<div class="en-grid"><label class="tl-field">Krov<select class="en-sel" data-dk="' + i + '" data-f="vrsta">' + [['jednostresni', 'Jednostrešni'], ['dvostresni', 'Dvostrešni'], ['cetverostresni', 'Četverostrešni']].map(([k, n]) => '<option value="' + k + '"' + ((ks.vrsta || 'jednostresni') === k ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></label><label class="tl-field">Nagib (°)<input data-dk="' + i + '" data-f="nagib" inputmode="decimal" value="' + esc(ks.nagib != null ? ks.nagib : '') + '" placeholder="15"></label><label class="tl-field">Nadzid (cm)<input data-dk="' + i + '" data-f="nadzid" inputmode="decimal" value="' + esc(ks.nadzid != null ? ks.nadzid : '') + '" placeholder="0"></label><label class="tl-field">Prepust (cm)<input data-dk="' + i + '" data-f="prepust" inputmode="decimal" value="' + esc(ks.prepust != null ? ks.prepust : '') + '" placeholder="40"></label>' +
        ((ks.vrsta || 'jednostresni') === 'jednostresni' ? '<label class="tl-field">Viša strana<select class="en-sel" data-dk="' + i + '" data-f="visa">' + ['gore', 'dolje', 'lijevo', 'desno'].map(v => '<option' + ((ks.visa || 'gore') === v ? ' selected' : '') + '>' + v + '</option>').join('') + '</select></label>' : (ks.vrsta === 'dvostresni' ? '<label class="tl-field">Sljeme<select class="en-sel" data-dk="' + i + '" data-f="sljeme"><option value="H"' + ((ks.sljeme || 'H') === 'H' ? ' selected' : '') + '>vodoravno</option><option value="V"' + (ks.sljeme === 'V' ? ' selected' : '') + '>okomito</option></select></label>' : '')) + '</div>' + krovHtml(ks, String(i), d.iznad === 'kosi') : '') + '</div>'; });
  return h + '<button class="tl-btn" id="enDpAdd">＋ Dodaj dio etaže</button></div>';
}
function bindParts() {
  const P2 = () => E(S.fi).dijelovi = E(S.fi).dijelovi || [], again = () => { const sc = $('enPanel').scrollTop; refresh(); go(1); $('enPanel').scrollTop = sc; };
  if ($('enDpAdd')) $('enDpAdd').onclick = () => { P2().push({ naziv: '', rooms: [], iznad: 'ravni', kosi: { vrsta: 'jednostresni', nagib: 15, nadzid: 0 } }); again(); };
  $('enPanel').querySelectorAll('[data-dpdel]').forEach(b => b.onclick = () => { P2().splice(+b.dataset.dpdel, 1); again(); });
  $('enPanel').querySelectorAll('[data-dr]').forEach(b => b.onclick = () => { const d = P2()[+b.dataset.dr]; d.rooms = d.rooms || []; const k = b.dataset.k, i = d.rooms.indexOf(k); if (i >= 0) d.rooms.splice(i, 1); else { d.rooms.push(k); P2().forEach((o, j) => { if (j !== +b.dataset.dr) o.rooms = (o.rooms || []).filter(x => x !== k); }); } again(); });
  $('enPanel').querySelectorAll('[data-dp]').forEach(el => el.onchange = () => { const d = P2()[+el.dataset.dp], f = el.dataset.f, v = el.value; if (f === 'naziv') d.naziv = v; else if (f === 'iznad') d.iznad = v; else if (f === 'h') { const x = num(v, null); if (x == null) delete d.h; else d.h = x; } else if (f === 'd') { const x = num(v, null); if (x == null) delete d.konstr; else d.konstr = { mode: 'ploca', d: x }; } again(); });
  $('enPanel').querySelectorAll('[data-dk]').forEach(el => el.onchange = () => { const d = P2()[+el.dataset.dk]; d.kosi = d.kosi || {}; const f = el.dataset.f; d.kosi[f] = ['vrsta', 'visa', 'sljeme'].includes(f) ? el.value : num(el.value, null); if (d.kosi[f] == null) delete d.kosi[f]; again(); });
  bindKrov(tag => { if (tag === 'E') { const e = E(S.fi); return e.kosi = e.kosi || {}; } const d = P2()[+tag]; return d.kosi = d.kosi || {}; }, tag => tag === 'E' ? E(S.fi).iznad === 'kosi' : P2()[+tag].iznad === 'kosi', () => { save(); S.proc = null; again(); });
}
function tabEtaze() {
  const e = E(S.fi), b = S.built[S.fi], k = e.konstr || {}, mode = k.mode || 'ploca';
  let h = '<h3>Etaža</h3>' + floorPicker();
  if (b && b.err) { panel(h + '<p class="tl-note" style="color:#b91c1c">' + esc(b.err) + '</p><p class="tl-note">Otvori ovu etažu i napravi Tlocrt → DXF (barem do Rezultata), pa se vrati ovdje. ' + (onlyLegal() ? 'Ako etažu ne trebaš u pročeljima, isključi je:' : 'Ako etaža nije dio grijane zgrade (npr. tavan), isključi je:') + '</p><label class="tl-check"><input type="checkbox" id="enUklErr"' + (e.ukljuci !== false ? ' checked' : '') + '> ' + (onlyLegal() ? 'Uključi etažu u pročelja' : 'Etaža je dio grijane zgrade') + '</label>'); bindFloorPicker(); $('enUklErr').onchange = ev => { if (ev.target.checked) delete E(S.fi).ukljuci; else E(S.fi).ukljuci = false; save(); go(1); }; return; }
  h += '<label class="tl-check"><input type="checkbox" id="enUkl"' + (e.ukljuci !== false ? ' checked' : '') + '> ' + (onlyLegal() ? 'Uključi etažu u pročelja i presjeke' : 'Etaža je dio grijane zgrade (uključi u proračun)') + '</label>';
  const bindUkl = () => { $('enUkl').onchange = ev => { if (ev.target.checked) delete E(S.fi).ukljuci; else E(S.fi).ukljuci = false; refresh(); go(1); }; };
  if (e.ukljuci === false) { panel(h); bindFloorPicker(); bindUkl(); return; }
  h += '<div id="enFloorInfo">' + floorInfoHtml() + '</div>';
  h += '<div class="en-box"><div class="en-box-h">Pod i strop ove etaže</div>';
  h += fSel('E', 'iznad', 'Iznad etaže je', onlyLegal() ? IZNAD_L : EC.IZNAD, 'grijano', true);
  if (e.iznad === 'kosi' || (e.iznad === 'tavan' && isLegal())) {
    if (e.iznad === 'tavan') h += '<p class="tl-note">Krov iznad tavana:</p>';
    const ks0 = e.kosi || {}, open0 = e.iznad === 'kosi' || !!e.bezStropa;
    if (e.iznad === 'tavan' && isLegal()) h += fChk('E', 'bezStropa', 'Nema stropne ploče – krov je odmah iznad prostorije');
    h += fSel('E', 'kosi.vrsta', 'Vrsta krova', [['dvostresni', 'Dvostrešni'], ['jednostresni', 'Jednostrešni'], ['cetverostresni', 'Četverostrešni']], 'dvostresni', true);
    h += fSel('E', 'kosi.unos', 'Krov zadajem', [['nagib', 'nagibom i nadzidom'], ['visine', 'visinama (uz zid i do sljemena)']], 'nagib', true);
    if (ks0.unos === 'visine') { const od = open0 ? 'od poda prostorije' : 'od poda tavana (gornji rub stropne ploče)';
      h += fNum('E', 'kosi.hZid', 'Visina do krova uz zid, iznutra – ' + od, '', 'cm') + fNum('E', 'kosi.hSlj', 'Visina do sljemena – ' + od, '', 'cm') + fSel('E', 'kosi.ref', 'Mjereno do', [['rog', 'donjeg ruba roga'], ['daska', 'daske na rogovima (između rogova)']], 'rog', true);
      try { const PR = window.IzmjeraProcelja, rr = S.resAll && S.resAll[S.fi], bb = rr && !rr.err && rr.bbox; const r = PR && bb ? PR.kosiFromH(ks0, bb, PR.extT(rr), open0) : null;
        h += '<p class="tl-note">' + (r && r._iz ? 'Izračunato: nagib <b>' + String(r.nagib).replace('.', ',') + '°</b>, nadzid (donji rub roga na vanjskom licu zida) <b>' + String(r.nadzid).replace('.', ',') + ' cm</b>.' : 'Upiši obje visine (sljeme više od visine uz zid).') + '</p>'; } catch (er) { } }
    else h += fNum('E', 'kosi.nagib', 'Nagib krova', '35', '°') + fNum('E', 'kosi.nadzid', e.iznad === 'tavan' && !e.bezStropa ? 'Nadzid tavana (iznad stropa)' : 'Visina nadzida', e.iznad === 'tavan' && !e.bezStropa ? '0' : '100', 'cm');
    h += isLegal() ? fNum('E', 'kosi.prepust', 'Prepust krova (streha)', '40', 'cm') : '';
    if (isLegal()) { const dv0 = ks0.drvo || {}, dimF = (key, ph) => dv0[key] ? '<label class="tl-field" style="margin:0 0 6px 30px">Presjek b/h (cm)<input data-root="E" data-path="kosi.drvoD.' + key + '" value="' + esc((ks0.drvoD || {})[key] || '') + '" placeholder="' + ph + '" inputmode="decimal" style="max-width:140px"></label>' : '';
      h += '<div class="tl-field">Drvena konstrukcija u presjeku</div>' + fChk('E', 'kosi.drvo.naz', 'Nazidnice') + dimF('naz', '14/14') + fChk('E', 'kosi.drvo.pod', 'Podrožnice') + dimF('pod', '14/18') + fChk('E', 'kosi.drvo.slj', 'Sljemenjača') + dimF('slj', '14/20') + fChk('E', 'kosi.drvo.paj', 'Pajante (kliješta)') + dimF('paj', '6/16') +
        (dv0.paj ? '<label class="tl-field" style="margin:0 0 6px 30px">Visina pajante – donji rub, ' + (open0 ? 'od poda prostorije' : 'od poda tavana') + ' (cm, prazno = u visini podrožnica)<input data-root="E" data-path="kosi.pajZ" data-num="1" value="' + esc(ks0.pajZ != null ? String(ks0.pajZ).replace('.', ',') : '') + '" inputmode="decimal" style="max-width:140px"></label>' : ''); }
    const vr = (e.kosi || {}).vrsta || 'dvostresni';
    if (vr === 'dvostresni') h += fSel('E', 'kosi.sljeme', 'Sljeme na tlocrtu ide', [['H', 'vodoravno (lijevo–desno)'], ['V', 'okomito (gore–dolje)']], 'H');
    if (vr === 'jednostresni') h += fSel('E', 'kosi.visa', 'Viša strana krova (na tlocrtu)', [['gore', 'gore'], ['dolje', 'dolje'], ['lijevo', 'lijevo'], ['desno', 'desno']], 'gore');
    h += krovHtml(e.kosi || {}, 'E', e.iznad === 'kosi');
    h += '<p class="tl-note">Krov se računa kao jednak nagib na pravokutnom tlocrtu (zabati iz širine zgrade). Za složeni krov dodaj ili ispravi površine ručno ispod.</p>';
  }
  h += fSel('E', 'ispod', 'Ispod etaže je', onlyLegal() ? ISPOD_L : EC.ISPOD, 'grijano', true);
  if (e.ispod && e.ispod !== 'grijano') h += fNum('E', 'dIspod', 'Debljina poda / ploče ispod', '30', 'cm');
  h += '</div>' + partsHtml() + '<div class="en-box"><div class="en-box-h">Visine</div>';
  h += fNum('E', 'h', 'Svijetla visina', '260', 'cm');
  h += '<div class="tl-field">Konstrukcija iznad (do poda iduće etaže / do vrha stropa)</div><div class="tl-chips" id="enKMode">' + [['ploca', 'Debljina ploče'], ['slojevi', 'Slojevi'], ['kota', 'Kota do kote']].map(([m, n]) => '<button class="tl-chip' + (m === mode ? ' on' : '') + '" data-m="' + m + '">' + n + '</button>').join('') + '</div>';
  if (mode === 'ploca') h += fNum('E', 'konstr.d', 'Debljina (pod + ploča + strop)', '20', 'cm');
  else if (mode === 'kota') h += fNum('E', 'konstr.H', 'Visina od kote poda do kote poda iznad', '290', 'cm');
  else { h += '<div class="en-layers">' + (k.sl || []).map((l, i) => '<div class="en-layer"><input data-sl="' + i + '" data-f="n" value="' + esc(l.n || '') + '" placeholder="sloj (npr. estrih)"><input data-sl="' + i + '" data-f="d" inputmode="decimal" value="' + esc(l.d != null ? String(l.d).replace('.', ',') : '') + '" placeholder="cm" style="width:70px"><button class="tl-btn" data-del="' + i + '">✕</button></div>').join('') + '</div><button class="tl-btn" id="enSlAdd">＋ Dodaj sloj</button><p class="tl-note">Ukupno: <b>' + n1(EC.konstrD(k)) + ' cm</b></p>'; }
  h += '</div>';
  if (isLegal()) { const inc0 = floors().map((f, i) => i).filter(i => !(S.built[i] && S.built[i].err) && E(i).ukljuci !== false); if (inc0.length > 1 && inc0[0] !== S.fi) h += '<div class="en-box"><div class="en-box-h">Položaj prema najnižoj etaži (pročelja)</div><p class="tl-note">Prazno = poravnato po lijevom gornjem uglu tlocrta. Upiši pomak ako etaža ne stoji točno iznad.</p><div class="en-grid">' + fNum('E', 'pomakX', 'Pomak udesno', 'auto', 'cm') + fNum('E', 'pomakY', 'Pomak prema dolje (na tlocrtu)', 'auto', 'cm') + '</div></div>'; }
  if (isEnerg()) h += '<hr><div class="tl-field">Zid prema tlu (ukopani dio)</div>' + fNum('E', 'ukop.d', 'Dubina ukopa ispod terena', '0', 'cm') + '<div class="tl-chips" id="enUkop">' + EC.STRANE.map(s => '<button class="tl-chip' + (((e.ukop || {}).strane || []).includes(s) ? ' on' : '') + '" data-s="' + s + '">' + s + '</button>').join('') + '</div><p class="tl-note">Označi strane na kojima je zid ukopan.</p>';
  const nn = northOf(S.fi); if (nn.src !== 'tlocrt') h += fNum('E', 'north', 'Sjever na tlocrtu (° od „gore”, u smjeru kazaljke)', '0', '');
  if (isEnerg()) h += '<hr><div class="tl-field">Ručno dodane površine (što program ne vidi)</div><div id="enDod">' + (e.dodatno || []).map((r, i) => '<div class="en-layer"><select data-dd="' + i + '" data-f="el" class="en-sel">' + EC.EL_ORDER.map(k2 => '<option value="' + k2 + '"' + (k2 === r.el ? ' selected' : '') + '>' + esc(EC.EL[k2]) + '</option>').join('') + '</select><select data-dd="' + i + '" data-f="strana" class="en-sel" style="width:70px">' + ['—'].concat(EC.STRANE).map(s => '<option' + (s === (r.strana || '—') ? ' selected' : '') + '>' + s + '</option>').join('') + '</select><input data-dd="' + i + '" data-f="A" inputmode="decimal" value="' + esc(r.A != null ? String(r.A).replace('.', ',') : '') + '" placeholder="m²" style="width:70px"><button class="tl-btn" data-ddel="' + i + '">✕</button></div>').join('') + '</div><button class="tl-btn" id="enDodAdd">＋ Dodaj površinu</button>';
  if (isEnerg()) h += '<p class="tl-note">Na crtežu: dodirni prostoriju za grijano/negrijano, a crveni dio pročelja za „susjedna zgrada”.</p>';
  panel(h); bindFloorPicker(); bindFields(); bindParts();
  $('enKMode').querySelectorAll('[data-m]').forEach(bt => bt.onclick = () => { const k2 = E(S.fi).konstr = E(S.fi).konstr || {}; k2.mode = bt.dataset.m; if (k2.mode === 'slojevi' && !(k2.sl || []).length) k2.sl = [{ n: 'Podne obloge + estrih', d: 8 }, { n: 'AB ploča', d: 16 }, { n: 'Žbuka', d: 2 }]; refresh(); go(1); });
  $('enPanel').querySelectorAll('[data-sl]').forEach(inp => inp.onchange = () => { const sl = E(S.fi).konstr.sl, r = sl[+inp.dataset.sl]; r[inp.dataset.f] = inp.dataset.f === 'd' ? num(inp.value, 0) : inp.value; refresh(); go(1); });
  $('enPanel').querySelectorAll('[data-del]').forEach(bt => bt.onclick = () => { E(S.fi).konstr.sl.splice(+bt.dataset.del, 1); refresh(); go(1); });
  if ($('enSlAdd')) $('enSlAdd').onclick = () => { E(S.fi).konstr.sl.push({ n: '', d: null }); go(1); };
  if ($('enUkop')) $('enUkop').querySelectorAll('[data-s]').forEach(bt => bt.onclick = () => { const u = E(S.fi).ukop = E(S.fi).ukop || {}; u.strane = u.strane || []; const i = u.strane.indexOf(bt.dataset.s); if (i >= 0) u.strane.splice(i, 1); else u.strane.push(bt.dataset.s); bt.classList.toggle('on', i < 0); refresh(); });
  $('enPanel').querySelectorAll('[data-dd]').forEach(inp => inp.onchange = () => { const r = E(S.fi).dodatno[+inp.dataset.dd]; r[inp.dataset.f] = inp.dataset.f === 'A' ? num(inp.value, 0) : inp.value; refresh(); });
  $('enPanel').querySelectorAll('[data-ddel]').forEach(bt => bt.onclick = () => { E(S.fi).dodatno.splice(+bt.dataset.ddel, 1); refresh(); go(1); });
  if ($('enDodAdd')) $('enDodAdd').onclick = () => { (E(S.fi).dodatno = E(S.fi).dodatno || []).push({ el: 'zid_vanjski', strana: '—', A: null }); go(1); };
  bindUkl();
}

/* ---------- 2. Prostorije ---------- */
function kontrolaHtml() {
  const inc = included(); if (!inc.length) return '';
  let h = '<h3>Kontrola</h3><table class="en-tab"><tr><th>Etaža</th><th>Sve prostorije</th><th>Grijano (Ak)</th><th>Negrijano</th></tr>';
  let a = 0, b = 0; const warn = [];
  for (const F of inc) { const r = F.res; a += r.Aall; b += r.Ak; h += '<tr><td>' + esc(F.name) + '</td><td>' + m2(r.Aall) + '</td><td>' + m2(r.Ak) + '</td><td>' + m2(r.Aall - r.Ak) + '</td></tr>';
    for (const ro of r.rooms) { const n = ro.name.toLowerCase(); if (ro.kind !== 'grijano' && /(soba|kuhinj|boravak|kupaon|wc|hodnik|blagova|ured|dnevn)/.test(n)) warn.push(F.name + ': „' + ro.name + '” je označena kao negrijana'); if (ro.kind === 'grijano' && /(gara|tavan|kotlov|šupa|drvarn)/.test(n)) warn.push(F.name + ': „' + ro.name + '” je označena kao grijana'); if (!ro.name && ro.area > 2e4) warn.push(F.name + ': prostorija bez naziva (' + m2(ro.area) + ' m²) – ' + EC.ROOM_NAME[ro.kind]); }
    if (r.AZ > 0 && (r.Ak / r.AZ < 0.55 || r.Ak / r.AZ > 0.95)) warn.push(F.name + ': grijana neto površina je ' + Math.round(r.Ak / r.AZ * 100) + ' % tlocrtne – provjeri prostorije i debljine zidova'); }
  h += '<tr class="b"><td>Ukupno</td><td>' + m2(a) + '</td><td>' + m2(b) + '</td><td>' + m2(a - b) + '</td></tr></table>';
  if (warn.length) h += '<ul class="en-warn">' + warn.map(w => '<li>' + esc(w) + '</li>').join('') + '</ul>'; else h += '<p class="tl-note">✓ Nema neobičnih oznaka.</p>';
  return h;
}
function lvlHtml(r) {
  const lv = E(S.fi).roomLvl || {};
  return '<h3>Visine prostorija (za presjek)</h3><p class="tl-note">Pod: pomak poda prostorije u cm (npr. −17 ako je boravak niži za stepenicu; na skici može i natpis <b>pod=-17</b>). Visina: svijetla visina od poda te prostorije (prazno = visina etaže; na skici <b>h=</b>). Galerija: nema stropa iznad.</p>' +
    r.rooms.map(ro => { const L = lv[ro.key] || {}; return '<div class="en-seg"><b style="flex:1 1 120px">' + esc(ro.name || '(bez naziva)') + '</b><label class="en-sm">pod<input data-lv="' + esc(ro.key) + '" data-f="pod" inputmode="decimal" value="' + esc(L.pod != null ? L.pod : '') + '" placeholder="' + esc(ro.pod != null ? ro.pod : 0) + '" style="width:64px"></label><label class="en-sm">visina<input data-lv="' + esc(ro.key) + '" data-f="h" inputmode="decimal" value="' + esc(L.h != null ? L.h : '') + '" placeholder="' + esc(ro.h || '') + '" style="width:70px"></label><label class="en-sm"><input type="checkbox" data-lv="' + esc(ro.key) + '" data-f="galerija"' + (L.galerija ? ' checked' : '') + '> galerija</label>' + skokHtml(ro, L) + '</div>'; }).join('');
}
/* skok poda unutar prostorije: crta podjele i pod svakog dijela */
function skokHtml(ro, L) {
  const k = esc(ro.key), sk = L.skok;
  if (!sk) return '<button class="tl-btn" data-skadd="' + k + '" style="min-height:36px;padding:4px 10px">✂ skok poda</button>';
  const A = sk.o === 'V' ? 'lijevo' : 'gore', B = sk.o === 'V' ? 'desno' : 'dolje';
  return '<div style="flex:1 1 100%;display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:4px;padding:4px 6px;border-radius:8px;background:#fff7ed"><span class="en-sm">✂ skok poda:</span><label class="en-sm">' + A + ' pod<input data-sk="' + k + '" data-f="a" inputmode="decimal" value="' + esc(sk.a != null ? sk.a : '') + '" placeholder="' + esc(L.pod != null ? L.pod : (ro.pod || 0)) + '" style="width:60px"></label><label class="en-sm">' + B + ' pod<input data-sk="' + k + '" data-f="b" inputmode="decimal" value="' + esc(sk.b != null ? sk.b : '') + '" placeholder="npr. -17" style="width:60px"></label><button class="tl-btn" data-skmove="' + k + '" style="min-height:36px;padding:4px 10px">✎ crta</button><button class="tl-btn" data-skdel="' + k + '" style="min-height:36px;padding:4px 10px">✕</button></div>';
}
function bindLvl() {
  const lvO = k => { const e = E(S.fi); e.roomLvl = e.roomLvl || {}; return e.roomLvl[k] = e.roomLvl[k] || {}; };
  $('enPanel').querySelectorAll('[data-skadd],[data-skmove]').forEach(b => b.onclick = () => { S.stepPick = { key: b.dataset.skadd || b.dataset.skmove, pts: [] }; go(S.tab); draw(); });
  $('enPanel').querySelectorAll('[data-skdel]').forEach(b => b.onclick = () => { delete lvO(b.dataset.skdel).skok; S.proc = null; save(); const sc = $('enPanel').scrollTop; go(S.tab); $('enPanel').scrollTop = sc; draw(); });
  $('enPanel').querySelectorAll('[data-sk]').forEach(el => el.onchange = () => { const o = lvO(el.dataset.sk).skok; if (!o) return; const v = num(el.value, null); if (v == null) delete o[el.dataset.f]; else o[el.dataset.f] = v; S.proc = null; save(); });
  if (S.stepPick) { const ro = ((isEnerg() ? S.res : S.resAll)[S.fi] || { rooms: [] }).rooms.find(r => r.key === S.stepPick.key); const box = document.createElement('div'); box.className = 'en-box'; box.style.cssText = 'position:sticky;top:0;z-index:2;border-color:#ea580c'; box.innerHTML = '<div class="en-box-h">✂ Skok poda – ' + esc(ro ? ro.name || '' : '') + '</div><p class="tl-note">Na crtežu dodirni <b>' + (S.stepPick.pts.length ? 'drugi' : 'prvi') + '</b> kraj crte gdje je stepenica u podu (unutar prostorije). Crta se izravna vodoravno ili okomito.</p><button class="tl-btn" id="enSkX">Odustani</button>'; $('enPanel').prepend(box); $('enSkX').onclick = () => { S.stepPick = null; go(S.tab); draw(); }; }
  $('enPanel').querySelectorAll('[data-lv]').forEach(el => el.onchange = () => { const e = E(S.fi); e.roomLvl = e.roomLvl || {}; const o = e.roomLvl[el.dataset.lv] = e.roomLvl[el.dataset.lv] || {}; const f = el.dataset.f; if (el.type === 'checkbox') { if (el.checked) o[f] = true; else delete o[f]; } else { const v = num(el.value, null); if (v == null) delete o[f]; else o[f] = v; } refresh(); }); }
function tabProstorije() {
  if (!isEnerg()) { const r2 = S.resAll[S.fi]; let h2 = '<h3>Prostorije</h3>' + floorPicker(); if (!r2 || r2.err) { panel(h2 + '<p class="tl-note">Etaža nije u proračunu.</p>'); bindFloorPicker(); return; } panel(h2 + lvlHtml(r2)); bindFloorPicker(); bindLvl(); return; }
  const r = S.res[S.fi]; let h = '<h3>Prostorije</h3>' + floorPicker();
  if (!r || r.err) { panel(h + '<p class="tl-note">Etaža nije u proračunu.</p>' + kontrolaHtml()); bindFloorPicker(); return; }
  h += '<p class="tl-note">Grijane prostorije čine grijani dio zgrade. Zidovi prema negrijanima (stubište, garaža…) računaju se posebno.</p><div class="tl-list">' +
    r.rooms.map(ro => '<div class="tl-row"><span style="flex:1"><b>' + esc(ro.name || '(bez naziva)') + '</b><br><small>' + m2(ro.area) + ' m²</small></span><select class="en-sel" data-room="' + esc(ro.key) + '" style="max-width:190px">' + EC.ROOM_KINDS.map(([k, n]) => '<option value="' + k + '"' + (k === ro.kind ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></div>').join('') + '</div>';
  h += '<hr><h3>Pročelja (vanjski zidovi)</h3><p class="tl-note">Ako uz zid postoji negrijana prostorija koju nisi nacrtao (garaža, stubište, hodnik zgrade) ili susjedna zgrada, označi to ovdje ili dodirom na pročelje na crtežu.</p>' +
    '<p class="tl-note">Pročelje je samo podijeljeno na mjestima okomitih zidova (crtica na crtežu). Dodirni dio za vrstu zida, spajanje ili ✂ rez.</p>' +
    r.segs.filter(sg => sg.cls === 'ext').map(sg => '<div class="en-seg" data-sgo="' + esc(sg.key) + '" style="cursor:pointer;display:flex;align-items:center;gap:6px"><span class="en-n" style="background:' + (COL[sg.el] || '#ea580c') + '">' + esc(sg.lab || String(sg.n)) + '</span><b>' + esc(sg.strana) + '</b> ' + cm(sg.L) + ' cm' + (sg.roomName ? ' · ' + esc(sg.roomName) : '') + '<span style="margin-left:auto;font-size:13px;' + (sg.el !== 'zid_vanjski' ? 'color:' + (COL[sg.el] || '#ea580c') + ';font-weight:700' : '') + '">' + esc((SEG_KINDS.find(x => x[0] === (segOvOf(sg).k || 'vanjski')) || ['', 'Vanjski zid'])[1]) + (sg.part ? ' (dio)' : '') + '</span></div>').join('');
  if (isLegal()) h += '<hr>' + lvlHtml(r);
  h += '<hr>' + kontrolaHtml();
  panel(h); bindFloorPicker(); bindLvl(); $('enPanel').querySelectorAll('[data-sgo]').forEach(el => el.onclick = () => { const sg = S.res[S.fi].segs.find(x => x.key === el.dataset.sgo); if (sg) segPop(sg); });
  $('enPanel').querySelectorAll('[data-room]').forEach(s => s.onchange = () => { const e = E(S.fi); e.rooms = e.rooms || {}; e.rooms[s.dataset.room] = s.value; refresh(); go(2); });
}

/* ---------- 3. Otvori ---------- */
function tabOtvori() {
  const D = P().defaults, iE = isEnerg(), iL = isLegal(), r = iE ? S.res[S.fi] : S.resAll[S.fi];
  let h = '<h3>Zadano za sve otvore</h3><div class="en-grid">' + fNum('P', 'defaults.hProzor', 'Visina prozora', '140', 'cm') + fNum('P', 'defaults.hBalk', 'Visina balk. vrata', '220', 'cm') + fNum('P', 'defaults.hVrata', 'Visina vrata', '205', 'cm') + (iL ? fNum('P', 'defaults.pProzor', 'Parapet prozora', '90', 'cm') + fNum('P', 'defaults.dvokrilniOd', 'Prozor dvokrilni od širine', '110', 'cm') : '') + '</div>' + (!iE ? '<hr><h3>Otvori na pročeljima</h3>' + floorPicker() : '') + (iE ?
    '<div class="en-grid">' + fSel('P', 'defaults.okvir', 'Okvir', [''].concat(OKVIRI).map(v => [v, v || '—'])) + fSel('P', 'defaults.staklo', 'Staklo', [''].concat(STAKLA).map(v => [v, v || '—'])) + '</div><label class="tl-check"><input type="checkbox" data-root="P" data-path="defaults.roleta"' + (D.roleta ? ' checked' : '') + '> Rolete / kutije za rolete</label>' +
    '<div class="tl-actions"><button class="tl-btn" id="enApplyAll">Primijeni zadano na sve otvore (briše pojedinačne izmjene okvira/stakla/roleta)</button></div><hr><h3>Otvori na omotaču</h3>' + floorPicker() : '');
  if (!r || r.err) { panel(h + '<p class="tl-note">Etaža nije u proračunu.</p>'); bindFloorPicker(); bindFields(); applyAllBind(); return; }
  const ops = r.ops.filter(o => !o.manual);
  h += '<p class="tl-note">Narančasto = procjena (nije izmjereno, uzeta zadana vrijednost). ' + (iE ? 'Unutarnja vrata između grijanih prostorija se ne broje.' : 'Prikazani su samo otvori u vanjskim zidovima.') + '</p>';
  h += ops.length ? ops.map((o, i) => '<div class="en-op" data-i="' + i + '"><div class="en-op-h"><b>' + (i + 1) + '. ' + esc(o.room || '') + '</b> · ' + esc(o.strana) + ' · ' + n1(o.w) + ' × ' + n1(o.h) + ' = ' + m2(o.A) + ' m²</div><div class="en-op-f">' +
    '<select class="en-sel" data-o="' + esc(o.key) + '" data-f="vrsta">' + EC.OPEN_KINDS.filter(k => k[0] !== 'krovni').map(([k, n]) => '<option value="' + k + '"' + (k === o.kind ? ' selected' : '') + '>' + n + '</option>').join('') + '</select>' +
    '<label class="en-sm">v<input data-o="' + esc(o.key) + '" data-f="h" inputmode="decimal" value="' + n1(o.h) + '" title="visina (cm)" style="width:64px;' + (o.hEst ? 'border-color:#f97316;background:#fff7ed' : '') + '"></label>' +
    (iL && o.kind === 'prozor' ? '<label class="en-sm">p<input data-o="' + esc(o.key) + '" data-f="p" inputmode="decimal" value="' + n1(o.p) + '" title="parapet (cm)" style="width:56px;' + (o.pEst ? 'border-color:#f97316;background:#fff7ed' : '') + '"></label>' : '') +
    (iL ? '<select class="en-sel" data-o="' + esc(o.key) + '" data-f="krila">' + [[1, 'jednokrilni'], [2, 'dvokrilni']].map(([k, n]) => '<option value="' + k + '"' + (k === o.krila ? ' selected' : '') + '>' + n + '</option>').join('') + '</select>' : '') +
    (!iE ? '</div></div>' : '') + (!iE ? '' : '<select class="en-sel" data-o="' + esc(o.key) + '" data-f="okvir">' + [''].concat(OKVIRI).map(v => '<option value="' + v + '"' + (v === o.okvir ? ' selected' : '') + '>' + (v || 'okvir') + '</option>').join('') + '</select>' +
    '<select class="en-sel" data-o="' + esc(o.key) + '" data-f="staklo">' + [''].concat(STAKLA).map(v => '<option value="' + v + '"' + (v === o.staklo ? ' selected' : '') + '>' + (v || 'staklo') + '</option>').join('') + '</select>' +
    '<label class="tl-check" style="margin:0"><input type="checkbox" data-o="' + esc(o.key) + '" data-f="roleta"' + (o.roleta ? ' checked' : '') + '> roleta</label></div></div>')).join('') : '<p class="tl-note">Na ovoj etaži nema otvora na omotaču.</p>';
  const kr = E(S.fi).krovni || [];
  if (iE) h += '<hr><div class="tl-field">Krovni prozori</div>' + kr.map((k, i) => '<div class="en-layer"><select class="en-sel" data-k="' + i + '" data-f="strana" style="width:70px">' + EC.STRANE.map(s => '<option' + (s === k.strana ? ' selected' : '') + '>' + s + '</option>').join('') + '</select><input data-k="' + i + '" data-f="w" inputmode="decimal" value="' + esc(k.w || '') + '" placeholder="š cm" style="width:64px"><input data-k="' + i + '" data-f="h" inputmode="decimal" value="' + esc(k.h || '') + '" placeholder="v cm" style="width:64px"><input data-k="' + i + '" data-f="n" inputmode="numeric" value="' + esc(k.n || 1) + '" placeholder="kom" style="width:50px"><button class="tl-btn" data-kdel="' + i + '">✕</button></div>').join('') + '<button class="tl-btn" id="enKrAdd">＋ Krovni prozor</button>';
  panel(h); bindFloorPicker(); bindFields(); applyAllBind();
  $('enPanel').querySelectorAll('[data-o]').forEach(el => el.onchange = () => { const e = E(S.fi); e.otvori = e.otvori || {}; const o = e.otvori[el.dataset.o] = e.otvori[el.dataset.o] || {}; const f = el.dataset.f; o[f] = el.type === 'checkbox' ? el.checked : (f === 'h' || f === 'p' || f === 'krila') ? num(el.value, null) : el.value; if (o[f] === '' || o[f] == null) delete o[f]; refresh(); go(3); });
  $('enPanel').querySelectorAll('[data-k]').forEach(el => el.onchange = () => { const k = E(S.fi).krovni[+el.dataset.k]; k[el.dataset.f] = el.dataset.f === 'strana' ? el.value : num(el.value, null); refresh(); });
  $('enPanel').querySelectorAll('[data-kdel]').forEach(bt => bt.onclick = () => { E(S.fi).krovni.splice(+bt.dataset.kdel, 1); refresh(); go(3); });
  if ($('enKrAdd')) $('enKrAdd').onclick = () => { (E(S.fi).krovni = E(S.fi).krovni || []).push({ strana: 'J', w: null, h: null, n: 1 }); go(3); };
}
function applyAllBind() { const b = $('enApplyAll'); if (b) b.onclick = () => { if (!confirm('Postaviti zadani okvir, staklo i rolete na sve otvore svih etaža?')) return; floors().forEach((f, i) => { const o = E(i).otvori || {}; for (const k of Object.keys(o)) { delete o[k].okvir; delete o[k].staklo; delete o[k].roleta; } }); refresh(); go(3); }; }

/* ---------- 4. Konstrukcije ---------- */
function usedKat() { const s = new Set(); for (const F of included()) for (const r of F.res.rows) s.add(EC.sastavKat(r.el)); return s; }
function tabKonstrukcije() {
  const used = usedKat(), all = S.showAllKat;
  let h = '<h3>Sastav konstrukcija</h3><p class="tl-note">Za svaku vrstu građevnog dijela upiši materijal, debljinu i izolaciju (što si vidio na terenu). Prikazane su vrste koje postoje u ovoj zgradi.</p>';
  for (const [k, n] of EC.SASTAV_KAT) { if (!all && !used.has(k)) continue; const p = 'sastav.' + k + '.';
    h += '<details class="en-det"' + (used.has(k) ? ' open' : '') + '><summary>' + esc(n) + (used.has(k) ? '' : ' <small>(nema u zgradi)</small>') + '</summary>' + fSel('P', p + 'mat', 'Nosivi materijal', [''].concat(MATERIJALI).map(v => [v, v || '—'])) + fNum('P', p + 'd', 'Debljina nosivog dijela', '', 'cm') + fSel('P', p + 'izol', 'Izolacija', [''].concat(IZOLACIJE).map(v => [v, v || '—'])) + fNum('P', p + 'izolD', 'Debljina izolacije', '', 'cm') + fSel('P', p + 'izvor', 'Podatak', [['', '—'], ['izmjereno', 'Izmjereno / viđeno'], ['projekt', 'Iz projekta'], ['procjena', 'Procjena']]) + fTxt('P', p + 'nap', 'Napomena', 'npr. žbuka 2 cm, fasada 2010.') + '</details>'; }
  h += '<div class="tl-actions"><button class="tl-btn" id="enAllKat">' + (all ? 'Prikaži samo postojeće' : 'Prikaži sve vrste') + '</button></div>';
  panel(h); bindFields(); $('enAllKat').onclick = () => { S.showAllKat = !all; go(4); };
}

/* ---------- 5. Sustavi i foto ---------- */
function photoCount() { let n = 0; for (const f of floors()) n += (f.items || []).filter(o => o.type === 'photo').length; return n; }
function fotoList() { const st = new Set(); for (const F of included()) for (const s of F.res.segs) if (s.el === 'zid_vanjski') st.add(s.strana); return [...EC.STRANE.filter(s => st.has(s)).map(s => ['fasada_' + s, 'Fasada ' + s]), ['krov', 'Krov'], ['prozori', 'Prozori (izvana i okvir/staklo izbliza)'], ['ulazna', 'Ulazna vrata'], ['kotao', 'Kotao / izvor grijanja'], ['plocica', 'Natpisna pločica kotla'], ['ptv', 'Bojler / priprema PTV'], ['klima', 'Klima / dizalica topline (vanjska jedinica)'], ['brojilo_plin', 'Plinsko brojilo'], ['brojilo_struja', 'Električno brojilo'], ['radijatori', 'Ogrjevna tijela'], ['oie', 'Solarni kolektori / fotonapon']]; }
function tabSustavi() {
  let h = '<h3>Sustavi</h3>' + fSel('P', 'sustavi.grijanje.vrsta', 'Grijanje', [''].concat(GRIJANJE).map(v => [v, v || '—'])) + '<div class="en-grid">' + fNum('P', 'sustavi.grijanje.god', 'Godina ugradnje', '', '') + fNum('P', 'sustavi.grijanje.snaga', 'Snaga', '', 'kW') + '</div>' + fTxt('P', 'sustavi.grijanje.nap', 'Napomena (proizvođač, model, ogrjevna tijela…)', '') +
    fSel('P', 'sustavi.ptv.vrsta', 'Priprema potrošne tople vode', [''].concat(PTV).map(v => [v, v || '—'])) + fNum('P', 'sustavi.ptv.vol', 'Volumen spremnika', '', 'l') +
    fSel('P', 'sustavi.hladjenje.vrsta', 'Hlađenje', [''].concat(HLAD).map(v => [v, v || '—'])) + fNum('P', 'sustavi.hladjenje.n', 'Broj unutarnjih jedinica', '', '') +
    fSel('P', 'sustavi.ventilacija.vrsta', 'Ventilacija', [''].concat(VENT).map(v => [v, v || '—'])) +
    '<div class="en-grid">' + fNum('P', 'sustavi.solar.m2', 'Solarni kolektori', '', 'm²') + fNum('P', 'sustavi.pv.kw', 'Fotonapon', '', 'kW') + '</div>' + fTxt('P', 'sustavi.nap', 'Ostale napomene o sustavima', '');
  h += '<hr><h3>Potrošnja vode (za izvješće)</h3><div class="en-grid">' + fNum('P', 'voda.ukucana', 'Broj ukućana', '', '') + fNum('P', 'voda.wc', 'WC', '', 'kom') + fNum('P', 'voda.umivaonik', 'Umivaonik', '', 'kom') + fNum('P', 'voda.sudoper', 'Sudoper', '', 'kom') + fNum('P', 'voda.kada', 'Kada / tuš', '', 'kom') + fNum('P', 'voda.psuda', 'Perilica suđa', '', 'kom') + fNum('P', 'voda.prublja', 'Perilica rublja', '', 'kom') + '</div>';
  const ph = floors().flatMap(f => (f.items || []).filter(o => o.type === 'photo')), tags = (window.IzmjeraFoto && IzmjeraFoto.TAGS) || [];
  h += '<hr><h3>Fotografije za certifikat</h3><p class="tl-note">U projektu je ' + ph.length + ' fotografija. Na skici dodirni fotografiju i označi što je na njoj (Naslovna, Pročelje + strana, Stolarija, Kotao…) – tako idu na pravo mjesto u izvješću.</p><table class="en-tab"><tr><th>Oznaka</th><th class="r">kom</th></tr>' + tags.map(([k, n]) => { const c = ph.filter(o => o.cert === k); return '<tr><td>' + esc(n) + (k === 'procelje' && c.length ? ' <small>(' + esc([...new Set(c.map(o => o.strana || '?'))].join(', ')) + ')</small>' : '') + '</td><td class="r">' + (c.length || '<span style="color:#b45309">0</span>') + '</td></tr>'; }).join('') + '<tr><td>Bez oznake</td><td class="r">' + ph.filter(o => !o.cert).length + '</td></tr></table>';
  panel(h); bindFields();
}

/* ---------- 6. Rezultat i izvoz ---------- */
function totals() { return EC.summarize(included()); }
function tabRezultat() {
  const inc = included(), T = totals(), errs = S.built.map((b, i) => b.err && E(i).ukljuci !== false ? (floors()[i].name || 'Etaža') + ': ' + b.err : null).filter(Boolean);
  let h = '<h3>Zgrada ukupno</h3>';
  for (let k = 0; k + 1 < inc.length; k++) { const A = inc[k], B2 = inc[k + 1], d = A.res.AZ - B2.res.AZ; if ((E(A.i).iznad || 'grijano') === 'grijano' && d > 1e4) errs.push(A.name + ' je za ' + m2(d) + ' m² veća od etaže iznad – taj dio stropa/krova (terasa, ravni krov) dodaj ručno u Etaže → Ručno dodane površine.'); if ((E(B2.i).ispod || 'grijano') === 'grijano' && -d > 1e4) errs.push(B2.name + ' je za ' + m2(-d) + ' m² veća od etaže ispod – dio poda iznad vanjskog zraka/negrijanog dodaj ručno.'); }
  if (errs.length) h += '<ul class="en-warn">' + errs.map(e => '<li>' + esc(e) + '</li>').join('') + '</ul>';
  if (!inc.length) { panel(h + '<p class="tl-note">Nijedna etaža nije u proračunu.</p>'); return; }
  h += '<table class="en-tab"><tr><td>Bruto obujam grijanog dijela Ve</td><td class="r"><b>' + m3(T.Ve) + ' m³</b></td></tr><tr><td>Ploština korisne površine Ak</td><td class="r"><b>' + m2(T.Ak) + ' m²</b></td></tr><tr><td>Oplošje grijanog dijela A</td><td class="r"><b>' + m2(T.A) + ' m²</b></td></tr><tr><td>Faktor oblika f₀ = A/Ve</td><td class="r"><b>' + T.f0.toFixed(3).replace('.', ',') + ' m⁻¹</b></td></tr></table>';
  h += '<h3>Etaže</h3><table class="en-tab"><tr><th>Etaža</th><th>Ispod (pod)</th><th>Iznad (strop/krov)</th><th></th></tr>' + inc.map(F => { const e = E(F.i); return '<tr><td>' + esc(F.name) + '</td><td>' + esc((EC.ISPOD.find(x => x[0] === (e.ispod || 'grijano')) || [, ''])[1]) + '</td><td>' + esc((EC.IZNAD.find(x => x[0] === (e.iznad || 'grijano')) || [, ''])[1]) + '</td><td><button class="tl-btn" data-edf="' + F.i + '" style="min-height:34px;padding:3px 10px">Uredi</button></td></tr>'; }).join('') + '</table>';
  h += '<h3>Građevni dijelovi</h3><table class="en-tab"><tr><th>Element</th><th>Strana</th><th class="r">m²</th></tr>' + T.rows.map(r => '<tr><td>' + esc(EC.EL[r.el]) + '</td><td>' + esc(r.strana) + '</td><td class="r">' + m2(r.A) + '</td></tr>').join('') + '</table>';
  h += '<h3>Otvori</h3><table class="en-tab"><tr><th>Vrsta</th><th>Strana</th><th class="r">kom</th><th class="r">m²</th></tr>' + T.ops.map(o => '<tr><td>' + esc(EC.OPEN_NAME[o.kind]) + '</td><td>' + esc(o.strana) + '</td><td class="r">' + o.n + '</td><td class="r">' + m2(o.A) + '</td></tr>').join('') + '</table>';
  h += '<p class="tl-note">Površine zidova su neto (bez otvora). Mjere su vanjske (do vanjskog lica zida). U Excelu su prva dva lista „KI Expert površine” (po stranama: duljina × visina, otvori o1, o2… s š/v/kom, ostali dijelovi, Ak, Af, h, H, Ve) i „KI Expert otvori” (naziv, orijentacija, Aw, n) – za prepisivanje u KI Expert.</p>';
  h += '<div class="tl-actions"><button class="tl-btn primary" id="enXlsx">⬇ Excel</button><button class="tl-btn primary" id="enPdf">⬇ PDF</button></div>' + '<hr>' + kontrolaHtml();
  panel(h);
  $('enPanel').querySelectorAll('[data-edf]').forEach(bt => bt.onclick = () => { S.fi = +bt.dataset.edf; S.view = null; go(1); });
  $('enXlsx').onclick = () => { try { exportXlsx(); } catch (e) { alert('Izvoz nije uspio: ' + (e.message || e)); } };
  $('enPdf').onclick = () => { try { exportPdf(); } catch (e) { alert('Izvoz nije uspio: ' + (e.message || e)); } };
}
function infoRows() { const i = window.projectInfo || {}; return [['Projekt', (window.IzmjeraApp && IzmjeraApp.projectName()) || ''], ['Adresa građevine', i.adresa || ''], ['k.č. / k.o.', [i.kc, i.ko].filter(Boolean).join(' / ')], ['Godina izgradnje', i.god || ''], ['Investitor', [i.invIme, i.invAdresa].filter(Boolean).join(', ')]]; }
function dataTables() {
  const inc = included(), T = totals(), P0 = P();
  const fl = inc.map(F => [F.name, E(F.i).h, F.res.Hh.Hb, EC.ISPOD.find(x => x[0] === (E(F.i).ispod || 'grijano'))[1], EC.IZNAD.find(x => x[0] === (E(F.i).iznad || 'grijano'))[1], F.res.AZ / 1e4, F.res.Ak / 1e4, F.res.Ve / 1e6]);
  const per = T.rows.map(r => [EC.EL[r.el], r.strana, ...inc.map(F => (r.po[F.name] || 0) / 1e4), r.A / 1e4]);
  const ops = []; inc.forEach(F => F.res.ops.forEach((o, i) => ops.push([F.name, o.room || '', EC.OPEN_NAME[o.kind], o.strana, o.w, o.h, o.n || 1, o.A / 1e4, o.okvir || '', o.staklo || '', o.roleta ? 'da' : 'ne', o.hEst ? 'visina procijenjena' : ''])));
  const kon = EC.SASTAV_KAT.filter(([k]) => usedKat().has(k) || P0.sastav[k]).map(([k, n]) => { const s = P0.sastav[k] || {}; return [n, s.mat || '', s.d != null ? s.d : '', s.izol || '', s.izolD != null ? s.izolD : '', s.izvor || '', s.nap || '']; });
  const sus = P0.sustavi, sv = [['Grijanje', [sus.grijanje && sus.grijanje.vrsta, sus.grijanje && sus.grijanje.god ? 'god. ' + sus.grijanje.god : '', sus.grijanje && sus.grijanje.snaga ? sus.grijanje.snaga + ' kW' : '', sus.grijanje && sus.grijanje.nap].filter(Boolean).join(', ')], ['Potrošna topla voda', [sus.ptv && sus.ptv.vrsta, sus.ptv && sus.ptv.vol ? sus.ptv.vol + ' l' : ''].filter(Boolean).join(', ')], ['Hlađenje', [sus.hladjenje && sus.hladjenje.vrsta, sus.hladjenje && sus.hladjenje.n ? sus.hladjenje.n + ' jed.' : ''].filter(Boolean).join(', ')], ['Ventilacija', (sus.ventilacija && sus.ventilacija.vrsta) || ''], ['Solarni kolektori', sus.solar && sus.solar.m2 ? sus.solar.m2 + ' m²' : ''], ['Fotonapon', sus.pv && sus.pv.kw ? sus.pv.kw + ' kW' : ''], ['Napomena', sus.nap || '']];
  const foto = fotoList().map(([k, n]) => [n, P0.foto[k] ? 'da' : 'NE']);
  return { inc, T, fl, per, ops, kon, sv, foto };
}
/* ---------- KI Expert: površine složene kao ručni proračun (po stranama, otvori o1…, ostali dijelovi) ---------- */
const STR_DUGO = { S: 'Sjever', SI: 'Sjeveroistok', I: 'Istok', JI: 'Jugoistok', J: 'Jug', JZ: 'Jugozapad', Z: 'Zapad', SZ: 'Sjeverozapad' };
const STR_RED = ['I', 'Z', 'S', 'J', 'SI', 'SZ', 'JI', 'JZ'], OP_RED = ['prozor', 'krovni', 'balkonska', 'negrijano', 'ulazna'];
/* v2.55: sažetak na početku ispisa – Ak, Af, Ve; zidovi neto po stranama (vanjski i prema negrijanom); otvori po površini */
function sazData() { const K = kiData(), T = K.T, sIdx = st => { const i = STR_RED.indexOf(st); return i < 0 ? 99 : i; };
  const wr = T.rows.filter(r => r.el.startsWith('zid_') && r.el !== 'zid_susjed_g'), W = new Map(); for (const r of wr) { const o = W.get(r.el) || { el: r.el, po: {}, uk: 0 }; if (r.strana && r.strana !== '—') o.po[r.strana] = (o.po[r.strana] || 0) + r.A / 1e4; o.uk += r.A / 1e4; W.set(r.el, o); }
  for (const F of K.inc) for (const sg of F.res.segs) { if (sg.cls !== 'ext' || !sg.el || !sg.el.startsWith('zid_') || sg.el === 'zid_vanjski' || sg.el === 'zid_susjed_g' || !sg.strana || sg.strana === '—' || !W.has(sg.el)) continue; const o = W.get(sg.el), A = (sg.Aneto != null ? sg.Aneto : sg.A - (sg.Aotv || 0)) / 1e4; if (A > 0) o.po[sg.strana] = (o.po[sg.strana] || 0) + A; } /* pročelje označeno kao zid prema negrijanom – zna se strana */
  const walls = [...W.values()].sort((a, b) => EC.EL_ORDER.indexOf(a.el) - EC.EL_ORDER.indexOf(b.el)), G = new Map();
  for (const o of K.ops) { const g = G.get(o.naziv) || { naziv: o.naziv, kind: o.kind, Aw: o.Aw, mj: new Set(), po: {}, neg: 0, n: 0 }; g.mj.add(Math.round(o.w) + ' × ' + Math.round(o.h)); if (o.strana === '—') g.neg += o.n; else g.po[o.strana] = (g.po[o.strana] || 0) + o.n; g.n += o.n; G.set(o.naziv, g); }
  const ops = [...G.values()].sort((a, b) => +a.naziv.slice(1) - +b.naziv.slice(1)), strane = [...new Set([...walls.flatMap(w => Object.keys(w.po)), ...ops.flatMap(o => Object.keys(o.po))])].sort((a, b) => sIdx(a) - sIdx(b));
  return { Ak: T.Ak / 1e4, Af: K.fl.reduce((a, f) => a + f.Af, 0), Ve: T.Ve / 1e6, walls, ops, strane, neg: ops.some(o => o.neg > 0) }; }
function sazPdfBlocks() { const Z = sazData(), f = v => v.toFixed(2).replace('.', ','), dash = '–', bl = [{ h: 'Sažetak površina', blue: true }, { p: 'Zgrada ukupno, sve etaže. Mjere su vanjske, zidovi su neto (bez otvora). Kako je izračunata svaka površina piše u nastavku ispisa.' }];
  bl.push({ table: { style: 'plavo', size: 13, sizeH: 8.5, cols: [{ t: 'Ploština korisne površine Ak', w: 34, al: 'c' }, { t: 'Ploština poda grijanog dijela Af', w: 34, al: 'c' }, { t: 'Bruto obujam grijanog dijela Ve', w: 34, al: 'c' }], rows: [[f(Z.Ak) + ' m²', f(Z.Af) + ' m²', f(Z.Ve) + ' m³']], boldCol: [0, 1, 2] } });
  if (Z.walls.length) { const tot = Z.strane.map(st => Z.walls.reduce((a, w) => a + (w.po[st] || 0), 0));
    bl.push({ h: 'Zidovi – neto površine (m²)', blue: true }, { table: { style: 'plavo', cols: [{ t: 'Zid', w: 40 }, ...Z.strane.map(st => ({ t: st, w: 11, al: 'r' })), { t: 'Ukupno', w: 14, al: 'r' }], boldCol: [Z.strane.length + 1], rows: [...Z.walls.map(w => [EC.EL[w.el], ...Z.strane.map(st => w.po[st] ? f(w.po[st]) : dash), f(w.uk)]), ['Ukupno', ...tot.map(v => v ? f(v) : dash), f(Z.walls.reduce((a, w) => a + w.uk, 0))]], bold: [Z.walls.length] } });
    bl.push({ p: 'Zidovi prema grijanom (susjedna grijana zgrada, grijani prostor) nisu u ovoj tablici.' }); }
  if (Z.ops.length) { const tn = Z.strane.map(st => Z.ops.reduce((a, o) => a + (o.po[st] || 0), 0)), cat = k => k === 'prozor' || k === 'krovni' ? 'Prozori' : k === 'balkonska' ? 'Balkonska vrata' : 'Vrata', nc = 5 + Z.strane.length + (Z.neg ? 1 : 0), rows = [], grp = []; let lc = '';
    for (const o of Z.ops) { const c0 = cat(o.kind); if (c0 !== lc) { grp.push(rows.length); rows.push([c0, ...Array(nc).fill('')]); lc = c0; } rows.push([o.naziv, EC.OPEN_NAME[o.kind], [...o.mj].join(', '), f(o.Aw), ...Z.strane.map(st => o.po[st] ? String(o.po[st]) : dash), ...(Z.neg ? [o.neg ? String(o.neg) : dash] : []), String(o.n), f(o.Aw * o.n)]); }
    rows.push(['Ukupno', '', '', '', ...tn.map(v => v ? String(v) : dash), ...(Z.neg ? [String(Z.ops.reduce((a, o) => a + o.neg, 0))] : []), String(Z.ops.reduce((a, o) => a + o.n, 0)), f(Z.ops.reduce((a, o) => a + o.Aw * o.n, 0))]);
    bl.push({ h: 'Otvori (iste površine su u jednom retku)', blue: true }, { table: { style: 'plavo', cols: [{ t: 'Naziv', w: 9 }, { t: 'Vrsta', w: 25 }, { t: 'š × v (cm)', w: 18, al: 'r' }, { t: 'm²/kom', w: 11, al: 'r' }, ...Z.strane.map(st => ({ t: st, w: 6, al: 'r' })), ...(Z.neg ? [{ t: 'Neg.', w: 8, al: 'r' }] : []), { t: 'kom', w: 7, al: 'r' }, { t: 'Ukupno m²', w: 13, al: 'r' }], rows, grp, bold: [rows.length - 1] } });
    bl.push({ p: (Z.neg ? 'Neg. = otvor u zidu prema negrijanom (stubište, garaža, negrijani prostor). ' : '') + 'Mjere otvora su građevinske mjere, u cm.' }); }
  return bl; }
function sazSheet() { const Z = sazData(), B = v => ({ v, b: true }), rows = [[B('Sažetak površina – zgrada ukupno (vanjske mjere, zidovi neto bez otvora)')], [], [B('Ak m²'), B('Af m²'), B('Ve m³')], [r2(Z.Ak), r2(Z.Af), r2(Z.Ve)], [], [B('Zid'), ...Z.strane.map(B), B('Ukupno m²')]];
  Z.walls.forEach(w => rows.push([EC.EL[w.el], ...Z.strane.map(st => w.po[st] ? r2(w.po[st]) : ''), r2(w.uk)])); rows.push([], [B('Naziv'), B('Vrsta'), B('š × v cm'), B('m²/kom'), ...Z.strane.map(B), ...(Z.neg ? [B('Neg.')] : []), B('kom'), B('ukupno m²')]);
  Z.ops.forEach(o => rows.push([o.naziv, EC.OPEN_NAME[o.kind], [...o.mj].join(', '), o.Aw, ...Z.strane.map(st => o.po[st] ? { v: o.po[st], int: true } : ''), ...(Z.neg ? [o.neg ? { v: o.neg, int: true } : ''] : []), { v: o.n, int: true }, r2(o.Aw * o.n)]));
  return { name: 'Sažetak', cols: [40, 22, 16, 10, ...Z.strane.map(() => 8), 8, 8, 12], rows }; }
const r2 = v => Math.round(v * 100) / 100;
function kiData() {
  const inc = included(), T = totals();
  const sIdx = st => { const i = STR_RED.indexOf(st); return i < 0 ? 99 : i; };
  // otvori: iste dimenzije, vrsta i strana = jedan naziv (o1, o2…), kom zbrojeni
  const og = new Map();
  for (const F of inc) for (const o of F.res.ops) { const st = o.strana && o.strana !== '—' ? o.strana : '—', w = Math.round(o.w), h = Math.round(o.h), k = st + '|' + o.kind + '|' + w + '|' + h;
    const g = og.get(k) || { strana: st, kind: o.kind, w, h, n: 0, okvir: o.okvir, staklo: o.staklo, roleta: o.roleta, fl: new Set() }; g.n += o.n || 1; g.fl.add(F.name); og.set(k, g); }
  const ops = [...og.values()].sort((a, b) => sIdx(a.strana) - sIdx(b.strana) || b.w * b.h - a.w * a.h); ops.forEach(o => { o.Aw = r2(o.w * o.h / 1e4); });
  /* v2.55: ista vrsta i ista površina = isti naziv (o1, o2…) na svim stranama; redom prozori, krovni, balkonska, prema negrijanom, ulazna na kraju */
  const kOrd = k => { const i = OP_RED.indexOf(k); return i < 0 ? 9 : i; }, gk = o => o.kind + '|' + Math.round(o.Aw * 100), gN = new Map();
  [...ops].sort((a, b) => kOrd(a.kind) - kOrd(b.kind) || b.Aw - a.Aw).forEach(o => { if (!gN.has(gk(o))) gN.set(gk(o), 'o' + (gN.size + 1)); }); ops.forEach(o => { o.naziv = gN.get(gk(o)); });
  // vanjski zidovi po stranama (bruto = duljina × visina, otvori se oduzimaju)
  const walls = {}, other = [], flat = [];
  for (const F of inc) {
    for (const sg of F.res.segs) {
      const Lp = sg.L - (sg.part ? sg.part.L : 0);
      if (sg.el === 'zid_vanjski') { const Abr = sg.A - (sg.Atlo || 0) - (sg.part ? sg.part.A : 0); if (Lp > 1 && Abr > 1) { const ws = walls[sg.strana] = walls[sg.strana] || [], H = r2(Abr / Lp / 100), ex = sg.np > 1 ? ws.find(x => x.fl === F.name && x.H === H && x.pk === sg.pkey) : null; if (ex) ex.L = r2(ex.L + Lp / 100); else ws.push({ fl: F.name, L: r2(Lp / 100), H, pk: sg.pkey }); } }
      else other.push({ el: sg.el, fl: F.name, L: r2(sg.L / 100), H: r2(sg.H / 100), Aotv: r2((sg.Aotv || 0) / 1e4) });
      if (sg.part) other.push({ el: sg.part.el, fl: F.name, L: r2(sg.part.L / 100), H: r2(sg.H / 100), Aotv: 0 });
      if (sg.Atlo > 0 && Lp > 1) other.push({ el: 'zid_tlo', fl: F.name, L: r2(Lp / 100), H: r2(sg.Atlo / Lp / 100), Aotv: 0 });
    }
    for (const r of F.res.rows) {
      if (r.el === 'zid_vanjski' && r.note) (walls[r.strana] = walls[r.strana] || []).push({ fl: F.name + ' – ' + r.note, A: r2(r.A / 1e4) });
      else if (r.el.startsWith('zid_') && r.note === 'ručno') other.push({ el: r.el, fl: F.name + ' – ručno', A: r2(r.A / 1e4), Aotv: 0 });
      else if (!r.el.startsWith('zid_')) flat.push({ el: r.el, fl: F.name, A: r2(r.A / 1e4), note: r.note || '' });
    }
  }
  const strane = [...new Set([...Object.keys(walls), ...ops.filter(o => o.strana !== '—').map(o => o.strana)])].sort((a, b) => sIdx(a) - sIdx(b));
  const fl = inc.map(F => ({ name: F.name, Ak: r2(F.res.Ak / 1e4), Af: r2(F.res.AZ / 1e4), h: r2(EC.num(E(F.i).h, 260) / 100), H: r2(F.res.Hh.Hb / 100), Ve: r2(F.res.Ve / 1e6), opseg: F.res.Ptlo ? r2(F.res.Ptlo / 100) : null }));
  return { inc, T, ops, walls, other, flat, strane, fl };
}
function kiSheets() {
  const K = kiData(), B = v => ({ v, b: true }), C = EX.cellRef, rows = [], R = () => rows.length + 1, info = window.projectInfo || {};
  const sum = (col, a, b) => 'SUM(' + C(col, a) + ':' + C(col, b) + ')';
  rows.push([B('Površine za KI Expert – vanjske mjere zgrade')]); rows.push([((window.IzmjeraApp && IzmjeraApp.projectName()) || '') + (info.adresa ? ', ' + info.adresa : '')]); rows.push([]);
  rows.push([B('Etaža'), B('Ak m²'), B('Af m²'), B('h m'), B('H m'), B('Ve m³'), B('opseg m')]);
  const f0r = R(); K.fl.forEach(f => { const r = R(); rows.push([f.name, f.Ak, f.Af, f.h, f.H, f.Ve, f.opseg == null ? '' : f.opseg]); });
  const f1r = R() - 1; rows.push([B('Ukupno'), { f: sum(1, f0r, f1r), v: K.fl.reduce((a, f) => a + f.Ak, 0), b: true }, { f: sum(2, f0r, f1r), v: K.fl.reduce((a, f) => a + f.Af, 0), b: true }, '', '', { f: sum(5, f0r, f1r), v: K.fl.reduce((a, f) => a + f.Ve, 0), b: true }]);
  rows.push(['Oplošje A m²', r2(K.T.A / 1e4)]); rows.push(['f0 = A/Ve 1/m', Math.round(K.T.f0 * 1000) / 1000]); rows.push(['Ve = Af × H (bruto obujam; kod kosog krova + prostor pod krovom)']); rows.push([]);
  rows.push([B('VANJSKI ZIDOVI')]);
  for (const st of K.strane) {
    const W = K.walls[st] || [], O = K.ops.filter(o => o.strana === st);
    rows.push([B(STR_DUGO[st] || st)]);
    rows.push([B('Etaža'), B('duljina m'), B('visina m'), B('bruto m²'), '', B('Otvor'), B('š m'), B('v m'), B('P m²'), B('kom'), B('Puk m²')]);
    const a = R(), n = Math.max(W.length, O.length, 1);
    for (let i = 0; i < n; i++) { const r = R(), w = W[i], o = O[i], row = [];
      if (w) { if (w.A != null) row.push(w.fl, '', '', w.A); else row.push(w.fl, w.L, w.H, { f: C(1, r) + '*' + C(2, r), v: r2(w.L * w.H) }); } else row.push('', '', '', '');
      row.push('');
      if (o) row.push(o.naziv, r2(o.w / 100), r2(o.h / 100), { f: C(6, r) + '*' + C(7, r), v: o.Aw }, { v: o.n, int: true }, { f: C(8, r) + '*' + C(9, r), v: r2(o.Aw * o.n) });
      rows.push(row); }
    const b = R() - 1, br = W.reduce((s, w) => s + (w.A != null ? w.A : w.L * w.H), 0), ot = O.reduce((s, o) => s + o.Aw * o.n, 0), rb = R();
    rows.push([B('Bruto'), '', '', { f: sum(3, a, b), v: r2(br), b: true }, '', B('Otvori'), '', '', '', '', { f: sum(10, a, b), v: r2(ot), b: true }]);
    rows.push([B('Neto (bez otvora)'), '', '', { f: C(3, rb) + '-' + C(10, rb), v: r2(br - ot), b: true }]); rows.push([]);
  }
  const els = EC.EL_ORDER.filter(el => el !== 'zid_vanjski' && (K.other.some(o => o.el === el) || K.flat.some(o => o.el === el)));
  if (els.length) rows.push([B('OSTALI GRAĐEVNI DIJELOVI')]);
  for (const el of els) {
    rows.push([B(EC.EL[el])]);
    const Wl = K.other.filter(o => o.el === el), Fl = K.flat.filter(o => o.el === el);
    if (Wl.length) { rows.push([B('Etaža'), B('duljina m'), B('visina m'), B('bruto m²'), B('otvori m²'), B('neto m²')]); const a = R();
      Wl.forEach(w => { const r = R(); if (w.A != null) rows.push([w.fl, '', '', w.A, 0, { f: C(3, r) + '-' + C(4, r), v: w.A }]); else rows.push([w.fl, w.L, w.H, { f: C(1, r) + '*' + C(2, r), v: r2(w.L * w.H) }, w.Aotv, { f: C(3, r) + '-' + C(4, r), v: r2(w.L * w.H - w.Aotv) }]); });
      const b = R() - 1; rows.push([B('Ukupno'), '', '', '', '', { f: sum(5, a, b), v: r2(Wl.reduce((s, w) => s + (w.A != null ? w.A : w.L * w.H - w.Aotv), 0)), b: true }]); }
    if (Fl.length) { rows.push([B('Etaža'), B('m²'), B('napomena')]); const a = R(); Fl.forEach(f => rows.push([f.fl, f.A, f.note])); const b = R() - 1; if (Fl.length > 1) rows.push([B('Ukupno'), { f: sum(1, a, b), v: r2(Fl.reduce((s, f) => s + f.A, 0)), b: true }]); }
    rows.push([]);
  }
  const kiOps = [[B('Naziv otvora'), B('Uw W/m²K'), B('Orijentacija'), B('Aw m²'), B('n'), B('ukupno m²'), B('Vrsta'), B('š cm'), B('v cm'), B('Okvir'), B('Staklo'), B('Roleta'), B('Etaža')]];
  K.ops.forEach(o => { const r = kiOps.length + 1; kiOps.push([o.naziv, '', STR_DUGO[o.strana] || 'prema negrijanom', o.Aw, { v: o.n, int: true }, { f: C(3, r) + '*' + C(4, r), v: r2(o.Aw * o.n) }, EC.OPEN_NAME[o.kind], { v: o.w, int: true }, { v: o.h, int: true }, o.okvir || '', o.staklo || '', o.roleta ? 'da' : 'ne', [...o.fl].join(', ')]); });
  if (K.ops.length) kiOps.push([B('Ukupno'), '', '', '', { f: 'SUM(E2:E' + (K.ops.length + 1) + ')', v: K.ops.reduce((s, o) => s + o.n, 0), b: true }, { f: 'SUM(F2:F' + (K.ops.length + 1) + ')', v: r2(K.ops.reduce((s, o) => s + o.Aw * o.n, 0)), b: true }]);
  return { K, sheets: [{ name: 'KI Expert površine', cols: [26, 11, 11, 12, 11, 16, 9, 9, 10, 7, 11], rows }, { name: 'KI Expert otvori', cols: [13, 11, 16, 9, 6, 11, 22, 7, 7, 12, 14, 8, 20], rows: kiOps }] };
}
function kiPdfBlocks() {
  const K = kiData(), f = v => typeof v === 'number' ? v.toFixed(2).replace('.', ',') : v == null ? '' : String(v), bl = [{ h: 'Površine za KI Expert' }];
  bl.push({ table: { cols: [{ t: 'Etaža', w: 24 }, { t: 'Ak m²', w: 13, al: 'r' }, { t: 'Af m²', w: 13, al: 'r' }, { t: 'h m', w: 10, al: 'r' }, { t: 'H m', w: 10, al: 'r' }, { t: 'Ve m³', w: 14, al: 'r' }, { t: 'opseg m', w: 13, al: 'r' }], rows: K.fl.map(x => [x.name, f(x.Ak), f(x.Af), f(x.h), f(x.H), f(x.Ve), x.opseg == null ? '' : f(x.opseg)]) } });
  for (const st of K.strane) { const W = K.walls[st] || [], O = K.ops.filter(o => o.strana === st), br = W.reduce((s, w) => s + (w.A != null ? w.A : w.L * w.H), 0), ot = O.reduce((s, o) => s + o.Aw * o.n, 0);
    bl.push({ h: 'Vanjski zid – ' + (STR_DUGO[st] || st) + ': bruto ' + f(br) + ' - otvori ' + f(ot) + ' = neto ' + f(br - ot) + ' m²' });
    bl.push({ table: { cols: [{ t: 'Etaža', w: 30 }, { t: 'duljina m', w: 14, al: 'r' }, { t: 'visina m', w: 14, al: 'r' }, { t: 'bruto m²', w: 14, al: 'r' }], rows: W.map(w => w.A != null ? [w.fl, '', '', f(w.A)] : [w.fl, f(w.L), f(w.H), f(w.L * w.H)]) } });
    if (O.length) bl.push({ table: { cols: [{ t: 'Otvor', w: 12 }, { t: 'š m', w: 11, al: 'r' }, { t: 'v m', w: 11, al: 'r' }, { t: 'P m²', w: 12, al: 'r' }, { t: 'kom', w: 9, al: 'r' }, { t: 'Puk m²', w: 13, al: 'r' }], rows: O.map(o => [o.naziv, f(o.w / 100), f(o.h / 100), f(o.Aw), String(o.n), f(o.Aw * o.n)]) } }); }
  const els = EC.EL_ORDER.filter(el => el !== 'zid_vanjski' && (K.other.some(o => o.el === el) || K.flat.some(o => o.el === el)));
  if (els.length) bl.push({ h: 'Ostali građevni dijelovi' }, { table: { cols: [{ t: 'Dio', w: 34 }, { t: 'Etaža', w: 20 }, { t: 'duljina × visina', w: 22 }, { t: 'm² (neto)', w: 13, al: 'r' }, { t: 'napomena', w: 20 }], rows: els.flatMap(el => [...K.other.filter(o => o.el === el).map(w => [EC.EL[el], w.fl, w.A != null ? '' : f(w.L) + ' × ' + f(w.H), f(w.A != null ? w.A : w.L * w.H - w.Aotv), w.Aotv ? 'otvori ' + f(w.Aotv) : '']), ...K.flat.filter(o => o.el === el).map(x => [EC.EL[el], x.fl, '', f(x.A), x.note])]) } });
  if (K.ops.length) bl.push({ h: 'Otvori za KI Expert' }, { table: { cols: [{ t: 'Naziv', w: 11 }, { t: 'Orijentacija', w: 17 }, { t: 'Aw m²', w: 11, al: 'r' }, { t: 'n', w: 7, al: 'r' }, { t: 'ukupno m²', w: 13, al: 'r' }, { t: 'Vrsta', w: 20 }, { t: 'š × v cm', w: 15 }], rows: K.ops.map(o => [o.naziv, STR_DUGO[o.strana] || 'prema negrijanom', f(o.Aw), String(o.n), f(o.Aw * o.n), EC.OPEN_NAME[o.kind], o.w + ' × ' + o.h]) } });
  return bl;
}
/* ---------- 8. Izvješće: popunjavanje lista „Podaci” u vlastitom Excel predlošku ---------- */
const IZ = () => window.IzmjeraIzvjesce;
const TPL_DB = 'izmjera-izvjesce', TPL_KEY = 'predlozak';
function tplDb() { return new Promise((res, rej) => { const r = indexedDB.open(TPL_DB, 1); r.onupgradeneeded = () => r.result.createObjectStore('f'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
async function tplGet() { try { const db = await tplDb(); return await new Promise(res => { const q = db.transaction('f').objectStore('f').get(TPL_KEY); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); }); } catch (e) { return null; } }
async function tplPut(v) { const db = await tplDb(); await new Promise((res, rej) => { const t = db.transaction('f', 'readwrite'); t.objectStore('f').put(v, TPL_KEY); t.oncomplete = res; t.onerror = () => rej(t.error); }); }
function pickFile(accept) { return new Promise(res => { const i = document.createElement('input'); i.type = 'file'; i.accept = accept; i.style.display = 'none'; document.body.appendChild(i); i.onchange = () => { const f = i.files && i.files[0]; i.remove(); res(f || null); }; i.click(); }); }
async function fileBytes(f) { return new Uint8Array(await f.arrayBuffer()); }
const OKV_TXT = { 'PVC': 'PVC profili', 'Drvo': 'drveni profili', 'Aluminij': 'aluminijski profili', 'Drvo-aluminij': 'drvo-aluminijski profili', 'Čelik': 'čelični profili' };
const STK_TXT = { 'Jednostruko': 'jednostrukim ostakljenjem', 'Dvostruko': 'dvostrukim ostakljenjem', 'Dvostruko Low-E': 'dvostrukim Low-E ostakljenjem', 'Trostruko': 'trostrukim ostakljenjem' };
const GRIJ_TXT = { 'Plinski kotao (klasični)': ['centralno putem plinskog kotla', 'plin'], 'Plinski kondenzacijski kotao': ['centralno putem plinskog kondenzacijskog kotla', 'plin'], 'Kotao na lož ulje': ['centralno putem kotla na lož ulje', 'lož ulje'], 'Kotao na drva': ['centralno putem kotla na drva', 'drva'], 'Kotao na pelete': ['centralno putem kotla na pelete', 'peleti'], 'Dizalica topline zrak-voda': ['centralno putem dizalice topline zrak-voda', 'električna energija'], 'Dizalica topline (ostale)': ['centralno putem dizalice topline', 'električna energija'], 'Električno (grijalice / TA peć)': ['lokalno električnim grijalicama', 'električna energija'], 'Klima uređaji (split)': ['lokalno split klima uređajima', 'električna energija'], 'Daljinsko grijanje': ['centralno iz toplinske mreže (toplana)', 'toplana'], 'Peć na drva': ['lokalno pećima na drva', 'drva'] };
const PTV_TXT = { 'Isti kotao kao grijanje': 'putem kotla za grijanje', 'Električni bojler': 'putem električnog bojlera', 'Plinski protočni bojler': 'putem plinskog protočnog bojlera', 'Dizalica topline za PTV': 'putem dizalice topline', 'Solarni kolektori + dogrijavanje': 'putem solarnih kolektora s dogrijavanjem' };
function appVals() {
  const i = window.projectInfo || {}, p = P(), sz = (p.sastav || {}).zid_vanjski || {}, D = p.defaults || {}, sus = p.sustavi || {}, g = sus.grijanje && sus.grijanje.vrsta, pt = sus.ptv && sus.ptv.vrsta, hl = sus.hladjenje && sus.hladjenje.vrsta;
  const names = floors().map(f => String(f.name || '').trim().toLowerCase()).filter(Boolean);
  const dn = new Date(), datum = p.izv && p.izv.datum0 || (p.izv = p.izv || {}, p.izv.datum0 = dn.getFullYear() + '-' + String(dn.getMonth() + 1).padStart(2, '0') + '-' + String(dn.getDate()).padStart(2, '0'));
  return { datum, ukucana: (p.voda && p.voda.ukucana) || null, adresa: i.adresa, kc: i.kc, ko: i.ko, god: i.god, narucitelj: i.invIme, narAdresa: i.invAdresa, narOib: i.invOib, katnost: names.join(' + '),
    zidovi: sz.mat ? sz.mat.toLowerCase() + (sz.d ? ' ' + sz.d + ' cm' : '') : '', fasada: sz.izol && sz.izol !== 'Nema' ? 'ETICS sustav (' + sz.izol + (sz.izolD ? ' ' + sz.izolD + ' cm' : '') + ')' : '',
    otvori: [OKV_TXT[D.okvir], STK_TXT[D.staklo] ? 's ' + STK_TXT[D.staklo] : ''].filter(Boolean).join(' '), grijanje: g && GRIJ_TXT[g] ? GRIJ_TXT[g][0] : '', energent: g && GRIJ_TXT[g] ? GRIJ_TXT[g][1] : '',
    ptv: pt === 'Isti kotao kao grijanje' && g && GRIJ_TXT[g] ? GRIJ_TXT[g][0].replace(/^(centralno|lokalno) /, '') : PTV_TXT[pt] || '', hladjenje: hl ? (hl === 'Nema' ? 'nije izvedeno' : 'je izvedeno (' + hl.toLowerCase() + ')') : '' };
}
function izvState() { const p = P(); p.izv = p.izv || {}; p.izv.f = p.izv.f || {}; return p.izv; }
function izvValues() { const z = izvState(), sug = IZ().suggest(z.ki, z.kd, appVals()), out = {}, src = {};
  for (const [c, , , keep] of IZ().FIELDS) { if (z.f[c] != null && z.f[c] !== '') { out[c] = z.f[c]; src[c] = 'upisano'; } else if (sug[c] == null && !keep) { out[c] = ''; src[c] = 'prazno'; } else if (sug[c] != null) { out[c] = sug[c]; src[c] = z.kd && /^K/.test(c) ? 'KI izvještaj' : z.ki && ['B1', 'B2', 'B4', 'B7', 'B20', 'C20', 'B21', 'C21', 'B22', 'B23', 'B24', 'B25', 'K5', 'K6', 'K7'].includes(c) && (!z.kd || !/^K/.test(c)) ? 'KI XML' : 'aplikacija'; } }
  return { out, src }; }
/* --- izvješće: fotografije, tablice, mjere, listovi, provjera --- */
const ULOGE = [['', 'ne mijenjaj'], ['naslovna', 'Foto: naslovna'], ['procelje', 'Foto: pročelje'], ['stolarija', 'Foto: stolarija'], ['kotao', 'Foto: kotao'], ['klima', 'Foto: klima'], ['ptv', 'Foto: bojler / PTV'], ['brojilo', 'Foto: brojilo'], ['ostalo', 'Foto: ostalo'], ['tab_slojevi', 'Tablica: slojevi (KI)'], ['tab_otvori', 'Tablica: otvori (KI)'], ['tab_u', 'Tablica: U po dijelovima (KI)'], ['tab_rez', 'Tablica: rezultati proračuna (KI)']];
function defaultUloga(img, all) {
  const n = img.sheet.toLowerCase(), photo = /jpe?g/.test(img.ext), same = all.filter(x => x.sheet === img.sheet);
  if (/op[cć]i/.test(n)) { if (!photo) return ''; const first = same.filter(x => /jpe?g/.test(x.ext)).sort((a, b) => a.row - b.row)[0]; return first === img ? 'naslovna' : 'procelje'; }
  if (/ovojnic/.test(n)) return photo ? '' : 'tab_slojevi';
  if (/stolarij/.test(n)) { if (!photo) return 'tab_otvori'; const first = same.filter(x => /jpe?g/.test(x.ext)).sort((a, b) => a.row - b.row)[0]; return first === img ? 'stolarija' : 'procelje'; }
  if (/rezultat/.test(n)) { const so = same.slice().sort((a, b) => a.row - b.row); return so[0] === img ? 'tab_u' : so.length > 1 && so.at(-1) === img ? 'tab_rez' : ''; }
  if (/grijanj/.test(n)) return photo ? 'kotao' : '';
  if (/hla[dđ]/.test(n)) return photo ? 'klima' : '';
  return '';
}
function ulogeGet(tpl) { try { return JSON.parse(localStorage.getItem('izmjera-izv-uloge:' + tpl.name) || '{}'); } catch (e) { return {}; } }
function ulogeSet(tpl, u) { try { localStorage.setItem('izmjera-izv-uloge:' + tpl.name, JSON.stringify(u)); } catch (e) { } }
function projPhotos() { const out = []; floors().forEach((f, fi) => (f.items || []).forEach(o => { if (o.type === 'photo') out.push({ o, fi, floor: f.name || '' }); })); return out; }
/* pridruživanje: fotografije iste oznake redom u okvire iste uloge (pročelja redom po stranama S, I, J, Z…) */
function assignSlots(imgs, uloge) {
  const ph = projPhotos(), byTag = {}; for (const p of ph) if (p.o.cert) (byTag[p.o.cert] = byTag[p.o.cert] || []).push(p);
  const ord = ['S', 'I', 'J', 'Z', 'SI', 'JI', 'JZ', 'SZ']; if (byTag.procelje) byTag.procelje.sort((a, b) => (ord.indexOf(a.o.strana) + 1 || 99) - (ord.indexOf(b.o.strana) + 1 || 99));
  const used = {}, res = [];
  for (const im of imgs) { const u = uloge[im.key] != null ? uloge[im.key] : defaultUloga(im, imgs); if (!u) { res.push({ im, u }); continue; }
    if (u.startsWith('tab_')) { res.push({ im, u }); continue; }
    const k = used[u] || 0, p = (byTag[u] || [])[k]; used[u] = k + 1; res.push({ im, u, p }); }
  return res;
}
const f2 = (v, d) => v == null || v === '' ? '' : (typeof v === 'number' ? v.toFixed(d == null ? 2 : d) : String(v)).replace('.', ',');
function kiTableBlocks(kd, u, part, parts) {
  if (u === 'tab_otvori') return [{ title: '1.3.3. Otvori (prozirni i neprozirni elementi) zgrade', cols: [{ t: 'Naziv otvora', w: 22 }, { t: 'Uw [W/m²K]', w: 16, al: 'r' }, { t: 'Orijentacija', w: 22 }, { t: 'Aw [m²]', w: 16, al: 'r' }, { t: 'n', w: 10, al: 'r' }], rows: (kd.otvori || []).map(o => [o.naziv, f2(o.Uw), o.orij, f2(o.Aw), f2(o.n)]) }];
  if (u === 'tab_u') return [{ cols: [{ t: 'Naziv građevnog dijela', w: 46 }, { t: 'A [m²]', w: 14, al: 'r' }, { t: 'U [W/m²K]', w: 14, al: 'r' }, { t: 'U max [W/m²K]', w: 16, al: 'r' }, { t: 'OK', w: 8, al: 'c' }], rows: (kd.uTab || []).map(r => [r.naziv, f2(r.A), f2(r.U), f2(r.Umax), r.U != null && r.Umax != null ? (r.U <= r.Umax ? '✓' : '✗') : '']) }];
  if (u === 'tab_rez') return (kd.rez || []).length ? [{ cols: [{ t: kd.rezNaslov || 'Rezultati proračuna', w: 55 }, { t: '', w: 45 }], rows: kd.rez.map(r => [r[0], String(r[1]).replace(/m 2\b/g, 'm²').replace(/m 3\b/g, 'm³').replace(/m -1\b/g, 'm⁻¹').replace(/\s+,/g, ',')]) }] : null;
  if (u === 'tab_slojevi') {
    const els = kd.elementi || [], tot = els.reduce((a, e) => a + e.slojevi.length + 3, 0), per = tot / parts; let acc = 0; const mine = els.filter(e => { const k = Math.min(parts - 1, Math.floor((acc + (e.slojevi.length + 3) / 2) / per)); acc += e.slojevi.length + 3; return k === part; });
    return mine.map(e => ({ title: e.title, cols: [{ t: 'R.b.', w: 6, al: 'c' }, { t: 'Materijal', w: 40 }, { t: 'd [cm]', w: 10, al: 'r' }, { t: 'λ [W/mK]', w: 10, al: 'r' }, { t: 'μ [-]', w: 11, al: 'r' }, { t: 'sd [m]', w: 10, al: 'r' }, { t: 'ρ [kg/m³]', w: 11, al: 'r' }],
      rows: e.slojevi.map(l => [l.rb, l.mat, f2(l.d, 3), f2(l.lam, 3), f2(l.mu), f2(l.sd), f2(l.rho)]), foot: Object.keys(e.po).length ? Object.entries(e.po).map(([o, a], i) => ['', (i ? '' : 'Definirane ploštine [m²]: ') + o, '', '', '', '', f2(a)]) : [['', 'Definirana ploština [m²]', '', '', '', '', f2(e.A)]] }));
  }
  return null;
}
const tabOk = (kd, u) => !!kd && (u === 'tab_otvori' ? (kd.otvori || []).length : u === 'tab_u' ? (kd.uTab || []).length : u === 'tab_slojevi' ? (kd.elementi || []).length : u === 'tab_rez' ? (kd.rez || []).length : 0) > 0;
/* provjera prepisanog u KI Expert prema izmjeri */
const KI_EL = [[/vanjsk/, 'zid_vanjski'], [/zid.*tlu|tlu.*zid/, 'zid_tlo'], [/pod.*tlu|tlu.*pod/, 'pod_tlo'], [/zid.*gara|zid.*gra[zž]/, 'zid_garaza'], [/pod.*gara/, 'pod_garaza'], [/strop.*tavan|tavan/, 'strop_tavan'], [/ravn.*krov/, 'krov_ravni'], [/kos.*krov/, 'krov_kosi'], [/susjed/, 'zid_susjed_g'], [/stubi/, 'zid_stubiste'], [/zid.*negrij/, 'zid_negrijano'], [/pod.*negrij|pod.*podrum/, 'pod_negrijano']];
function kiEl(e) { const n = String(e.naziv || '').toLowerCase(), g = String(e.grupa || '').toLowerCase(); return KI_EL.find(([re]) => re.test(n)) || KI_EL.find(([re]) => re.test(g)); }
function kiCheck(kd) {
  if (!kd || !S.res.some(Boolean)) return null; const T = totals(), rows = [], add = (n, ki, me) => { if (ki == null && !me) return; rows.push({ n, ki, me }); };
  add('Oplošje A (m²)', kd.A, T.A / 1e4); add('Obujam Ve (m³)', kd.Ve, T.Ve / 1e6); add('Ak (m²)', kd.Ak, T.Ak / 1e4);
  const sd = { S: 'Sjever', SI: 'Sjeveroistok', I: 'Istok', JI: 'Jugoistok', J: 'Jug', JZ: 'Jugozapad', Z: 'Zapad', SZ: 'Sjeverozapad' }, me = {}, ki = {};
  for (const r of T.rows) if (r.el === 'zid_vanjski') me[sd[r.strana] || r.strana] = (me[sd[r.strana] || r.strana] || 0) + r.A / 1e4;
  for (const e of kd.elementi || []) if ((kiEl(e) || [])[1] === 'zid_vanjski') { if (Object.keys(e.po).length) for (const [o, a] of Object.entries(e.po)) ki[o] = (ki[o] || 0) + a; else ki['?'] = (ki['?'] || 0) + e.A; }
  for (const o of new Set([...Object.keys(me), ...Object.keys(ki)])) add('Vanjski zid – ' + o + ' (m², neto)', ki[o] || 0, me[o] || 0);
  const om = {}, ok = {}; for (const o of T.ops) if (o.strana !== '—') om[sd[o.strana] || o.strana] = (om[sd[o.strana] || o.strana] || 0) + o.A / 1e4; for (const o of kd.otvori || []) ok[o.orij] = (ok[o.orij] || 0) + o.Aw * o.n;
  for (const o of new Set([...Object.keys(om), ...Object.keys(ok)])) add('Otvori – ' + o + ' (m²)', ok[o] || 0, om[o] || 0);
  const ek = {}, em = {}; for (const e of kd.elementi || []) { const m = kiEl(e); if (m && m[1] !== 'zid_vanjski') ek[m[1]] = (ek[m[1]] || 0) + e.A; }
  for (const r of T.rows) if (r.el !== 'zid_vanjski') { const k = r.el.startsWith('zid_susjed') ? 'zid_susjed_g' : /^zid_(spremiste|kotlovnica|podrum|tavan)$/.test(r.el) ? 'zid_negrijano' : r.el; em[k] = (em[k] || 0) + r.A / 1e4; }
  delete em.zid_susjed_g; /* zid prema grijanoj susjednoj zgradi nije dio ovojnice u KI Expertu */
  for (const k of new Set([...Object.keys(ek), ...Object.keys(em)])) add((EC.EL[k] || k) + ' (m²)', ek[k] || 0, em[k] || 0);
  for (const r of rows) { const d = (r.ki || 0) - (r.me || 0), base = Math.max(Math.abs(r.ki || 0), Math.abs(r.me || 0), 1e-9); r.d = d; r.pct = d / base * 100; r.warn = r.ki == null ? false : Math.abs(r.pct) > 2 && Math.abs(d) > 0.3; }
  return rows;
}
/* mjere energetske učinkovitosti prema stanju */
const MJERE = [['zid', 'Toplinska izolacija vanjskih zidova'], ['strop', 'Izolacija stropa prema tavanu'], ['pod', 'Izolacija poda prema tlu'], ['stolarija', 'Zamjena stolarije']];
function mjeraTip(t) { t = String(t || '').toLowerCase(); return /stolarij/.test(t) ? 'stolarija' : /tavan|strop/.test(t) ? 'strop' : /pod\b|poda|podu/.test(t) ? 'pod' : /zid/.test(t) ? 'zid' : null; }
function mjeraDefault(tip, kd) {
  const p = P(), sa = p.sastav || {}, D = p.defaults || {}, u = (kd && kd.uTab) || [], bad = re => u.some(r => re.test(r.naziv.toLowerCase()) && r.U != null && r.Umax != null && r.U > r.Umax);
  const noIzol = k => { const s = sa[k] || {}; return !s.izol || s.izol === 'Nema' || (+s.izolD || 0) < 6; };
  if (tip === 'zid') return { on: u.length ? bad(/vanjsk/) : noIzol('zid_vanjski'), d: 12 };
  if (tip === 'strop') return { on: u.length ? bad(/tavan|strop/) : (T0().rows.some(r => r.el === 'strop_tavan') && noIzol('strop_tavan')), d: 20 };
  if (tip === 'pod') return { on: u.length ? bad(/pod/) : (T0().rows.some(r => r.el === 'pod_tlo') && noIzol('pod_tlo')), d: 10 };
  if (tip === 'stolarija') { const uw = (kd && kd.otvori || []).map(o => o.Uw).filter(x => x != null); return { on: uw.length ? Math.max(...uw) > 1.4 : (D.staklo && !/Trostruko|Low-E/.test(D.staklo)) || D.okvir === 'Drvo' && D.staklo !== 'Trostruko' }; }
  return { on: false };
}
function T0() { try { return totals(); } catch (e) { return { rows: [], ops: [] }; } }
function mjeraOpis(tip, m) {
  const okv = { PVC: 'PVC', Drvo: 'drvene', Aluminij: 'aluminijske', 'Drvo-aluminij': 'drvo-aluminijske', 'Čelik': 'čelične' }[(P().defaults || {}).okvir] || '';
  if (tip === 'zid') return 'Mjerom se predviđa ugradnja ekspandiranog polistirena (EPS) debljine ' + (m.d || 12) + ' cm na sve vanjske zidove (ETICS sustav).';
  if (tip === 'strop') return 'Mjerom se predviđa ugradnja mineralne vune debljine ' + (m.d || 20) + ' cm na strop prema negrijanom tavanu.';
  if (tip === 'pod') return 'Mjerom se predviđa ugradnja ekspandiranog polistirena (EPS) debljine ' + (m.d || 10) + ' cm na pod prema tlu te izvedba novog cementnog estriha.';
  if (tip === 'stolarija') return 'Mjerom se predviđa zamjena postojeće ' + (okv ? okv + ' ' : '') + 'stolarije novom stolarijom od PVC profila s troslojnim IZO ostakljenjem.';
  return '';
}
function mjeraPov(tip, kd) { const els = (kd && kd.elementi) || [], sum = re => els.filter(e => { const m = kiEl(e); return m && re.test(m[1]); }).reduce((a, e) => a + e.A, 0), T = T0(), app = el => T.rows.filter(r => r.el === el).reduce((a, r) => a + r.A, 0) / 1e4;
  if (tip === 'zid') return sum(/^zid_vanjski$/) || app('zid_vanjski'); if (tip === 'strop') return sum(/^strop_tavan$/) || app('strop_tavan'); if (tip === 'pod') return sum(/^pod_tlo$/) || app('pod_tlo');
  if (tip === 'stolarija') return (kd && kd.Awuk) || T.ops.filter(o => o.strana !== '—').reduce((a, o) => a + o.A, 0) / 1e4; return 0; }
function umaxOf(tip, kd) { const u = (kd && kd.uTab) || [], re = { zid: /vanjsk/, strop: /tavan|strop/, pod: /pod/ }[tip]; if (tip === 'stolarija') return 1.4; const r = re && u.find(x => re.test(x.naziv.toLowerCase())); return r ? r.Umax : null; }
/* sve izmjene predloška osim lista Podaci */
async function applyReport(B, z, tpl, progress) {
  const I = IZ(), names = B.sheets.map(s => s.name), kd = z.kd || {}, M = z.mjere || {}, sus = P().sustavi || {}, voda = P().voda || {};
  // 1. mjere
  const tipovi = {}; let anyOn = false;
  for (const n of names) { const c = I.findCells(B, n, /^Mjerom se predviđa/)[0]; if (!c) continue; const tip = mjeraTip(c.v); if (!tip || tipovi[tip]) continue; tipovi[tip] = n;
    const m = Object.assign({}, mjeraDefault(tip, kd), M[tip] || {}); if (!m.on) continue; anyOn = true; const vals = {};
    vals[c.ref] = m.opis || mjeraOpis(tip, m);
    const ut = I.findCells(B, n, /^Predviđenom (sanacijom|zamjenom)/)[0], um = m.Umax || umaxOf(tip, kd); if (ut && m.U) vals[ut.ref] = (tip === 'stolarija' ? 'Predviđenom zamjenom stolarije postiže se koeficijent prolaska topline od ' : 'Predviđenom sanacijom postiže se koeficijent prolaska topline od ') + f2(+m.U) + ' W/m²K' + (um ? ', što je ispod dopuštenih ' + f2(um) + ' W/m²K.' : '.');
    const cells = I.readCells(B, n), pv = I.findCells(B, n, /^povr[sš]ina$/i)[0], A = m.A || mjeraPov(tip, kd);
    if (pv && A) { let r = pv.row + 1; const below = cells[I.colName(pv.col) + r]; if (typeof below === 'string' && below.trim()) r++; vals[I.colName(pv.col) + r] = Math.round(A * 100) / 100; }
    const kw = I.findCells(B, n, /^kWh\/god$/i).find(x => typeof cells[I.colName(x.col) + (x.row + 1)] === 'number' && typeof cells[I.colName(x.col) + (x.row + 2)] === 'number'); if (kw) { if (m.Qp) vals[I.colName(kw.col) + (kw.row + 1)] = +m.Qp; if (m.Qn) vals[I.colName(kw.col) + (kw.row + 2)] = +m.Qn; }
    I.setCells(B, vals, n); }
  // 2. zaključak nakon mjera
  const sa = names.find(n => /sa\s+mjer/i.test(n)), nk = z.nakon || {};
  if (sa && anyOn) { const vals = {}, cells = I.readCells(B, sa), rows = I.findCells(B, sa, /nakon primjen/i).filter(c => /kWh/.test(c.v)).sort((a, b) => a.row - b.row);
    rows.forEach((rw, k) => { const v = k === 0 ? [nk.rQ, nk.QH] : [nk.rE, nk.Ep]; const inRow = Object.keys(cells).filter(r => +/\d+$/.exec(r)[0] === rw.row).map(r => ({ r, v: cells[r], col: I.colNum(r) })).sort((a, b) => a.col - b.col);
      const raz = inRow.find(x => typeof x.v === 'string' && /^[A-G]\+?$/.test(x.v.trim())), num = inRow.find(x => typeof x.v === 'number'); if (raz && v[0]) vals[raz.r] = v[0]; if (num && v[1]) vals[num.r] = +v[1]; });
    const co = I.findCells(B, sa, /^Nakon primjenjenih predloženih mjera količina CO2/i)[0]; if (co && nk.CO2) vals[co.ref] = 'Nakon primjenjenih predloženih mjera količina CO2 bi iznosila ' + f2(+nk.CO2) + ' (kgm2/a).';
    I.setCells(B, vals, sa); }
  // 3. voda
  const VL = [[/^wc$/i, 'wc'], [/^umivaonik/i, 'umivaonik'], [/^sudoper/i, 'sudoper'], [/^(kada|tuš|kada\s*\/\s*tuš)/i, 'kada'], [/^perilica su/i, 'psuda'], [/^perilica rub/i, 'prublja']];
  const anyVoda = VL.some(([, k]) => +voda[k] > 0);
  for (const n of names) { const kom = I.findCells(B, n, /^kom$/i)[0]; if (!kom) continue; const vals = {};
    for (const [re, k] of VL) { const c = I.findCells(B, n, re).find(x => x.row > kom.row && x.col < kom.col); if (c && anyVoda) vals[I.colName(kom.col) + c.row] = +(voda[k] || 0); }
    if (Object.keys(vals).length) I.setCells(B, vals, n); }
  // 4. listovi
  const hl = sus.hladjenje && sus.hladjenje.vrsta, auto = {};
  for (const n of names) { if (/hla[dđ].*ima/i.test(n) && hl) auto[n] = hl !== 'Nema'; if (/hla[dđ].*nema/i.test(n) && hl) auto[n] = hl === 'Nema'; if (/sa\s+mjer/i.test(n)) auto[n] = anyOn; if (/bez\s+mjer/i.test(n)) auto[n] = !anyOn; }
  for (const [tip, n] of Object.entries(tipovi)) auto[n] = !!Object.assign({}, mjeraDefault(tip, kd), M[tip] || {}).on;
  const ov = z.sheets || {}; for (const n of names) { const v = ov[n] != null ? ov[n] : auto[n]; if (v != null) I.setHidden(B, n, !v); }
  // 5. slike
  const imgs = await I.images(B), uloge = ulogeGet(tpl), asg = assignSlots(imgs, uloge), parts = asg.filter(a => a.u === 'tab_slojevi').length; let pi = 0, done = 0;
  for (const a of asg) { if (!a.u) continue; try {
      if (a.u.startsWith('tab_')) { if (!tabOk(kd, a.u)) continue; const bl = kiTableBlocks(kd, a.u, a.u === 'tab_slojevi' ? pi++ : 0, Math.max(1, parts)); if (!bl || !bl.length) continue; I.replaceImage(B, a.im, await I.tableToFrame(bl, a.im.aspect, a.im.rot), 'png'); }
      else if (a.p) { const src = window.IzmjeraFoto && IzmjeraFoto.get(a.p.o.id); if (!src) continue; I.replaceImage(B, a.im, await I.photoToFrame(src, a.im.aspect, a.im.rot), 'jpeg'); }
      if (progress) progress(++done); } catch (e) { console.warn('slika', a.im.key, e); } }
}
async function tabIzvjesce() {
  if (!IZ()) { panel('<p class="tl-note">Modul izvješća nije učitan.</p>'); return; }
  const z = izvState(), tpl = await tplGet(); if (S.tab !== 8) return;
  if (tpl && (!S.tplB || S.tplFor !== tpl.at)) { try { S.tplB = await IZ().openTemplate(tpl.bytes, 'Podaci'); S.tplCells = IZ().readCells(S.tplB); S.tplImgs = await IZ().images(S.tplB); S.tplFor = tpl.at; S.tplErr = null; } catch (e) { S.tplB = null; S.tplCells = {}; S.tplImgs = []; S.tplErr = e.message || String(e); } if (S.tab !== 8) return; }
  const cur = tpl ? S.tplCells || {} : {}, { out, src } = izvValues(), fmtV = v => v == null ? '' : typeof v === 'object' && v.date ? v.date : typeof v === 'number' ? String(v).replace('.', ',') : String(v);
  const curTxt = (c, v) => { if (v == null || v === '') return ''; if (c === 'B5' && typeof v === 'number') { const d = new Date((v - 25569) * 86400000); return d.toISOString().slice(0, 10); } return fmtV(v); };
  const sec = (id, title, body, open) => '<details class="en-det" id="' + id + '"' + (open || (S.izOpen || {})[id] ? ' open' : '') + '><summary><b>' + title + '</b></summary>' + body + '</details>';
  let h = '<h3>Izvješće (tvoj Excel predložak)</h3><p class="tl-note">Aplikacija popuni tvoj Excel izvješća: list <b>Podaci</b>, fotografije, tablice iz KI Experta, mjere i vodu, te sakrije listove koji ne trebaju. Predložak se ne mijenja – nastaje nova datoteka.</p>';
  h += '<table class="en-tab"><tr><td>Predložak izvješća</td><td>' + (tpl ? '✓ ' + esc(tpl.name) : '<b style="color:#b45309">nije odabran</b>') + '</td><td><button class="tl-btn" id="izTpl" style="min-height:38px">' + (tpl ? 'Promijeni' : 'Odaberi .xlsx') + '</button></td></tr>' +
    '<tr><td>KI Expert XML</td><td>' + (z.ki ? '✓ ' + esc(z.kiName || 'učitan') + ' · QH,nd ' + fmtV(z.ki.QHnd) + ' (' + esc(z.ki.razredQ) + ') · Eprim ' + fmtV(z.ki.Eprim) + ' (' + esc(z.ki.razredE) + ')' : 'nije učitan') + '</td><td><button class="tl-btn" id="izXml" style="min-height:38px">Učitaj XML</button></td></tr>' +
    '<tr><td>KI Expert izvještaj (Word)</td><td>' + (z.kd ? '✓ ' + esc(z.kdName || 'učitan') + ' · A ' + fmtV(z.kd.A) + ' m² · HTr ' + fmtV(z.kd.HTr) + ' W/K' : 'nije učitan') + '</td><td><button class="tl-btn" id="izDocx" style="min-height:38px">Učitaj .docx</button></td></tr></table>';
  if (S.tplErr && tpl) h += '<p class="en-warn">' + esc(S.tplErr) + '</p>';
  // provjera
  const ck = z.kd ? kiCheck(z.kd) : null;
  if (ck) { const nw = ck.filter(r => r.warn).length; h += sec('izSecCk', 'Provjera: KI Expert ↔ izmjera ' + (nw ? '<span style="color:#b91c1c">⚠ ' + nw + ' razlika</span>' : '✓'), '<p class="tl-note">Uspoređuje ono što je upisano u KI Expert (Word izvještaj) s površinama iz tlocrta. Razlika veća od 2 % je označena – najčešće krivo prepisan otvor ili zaboravljena strana.</p><table class="en-tab"><tr><th>Veličina</th><th class="r">KI Expert</th><th class="r">Izmjera</th><th class="r">Razlika</th></tr>' + ck.map(r => '<tr style="' + (r.warn ? 'background:#fee2e2' : '') + '"><td>' + (r.warn ? '⚠ ' : '') + esc(r.n) + '</td><td class="r">' + f2(r.ki) + '</td><td class="r">' + f2(r.me) + '</td><td class="r">' + (r.ki == null ? '' : (r.d >= 0 ? '+' : '') + f2(r.d) + ' (' + (r.pct >= 0 ? '+' : '') + r.pct.toFixed(1).replace('.', ',') + ' %)') + '</td></tr>').join('') + '</table>', nw > 0); }
  // podaci
  let ph2 = '<p class="tl-note">Opisna polja (B10–B19) koja ostaviš prazna zadržavaju tekst iz predloška (sivo); ostala prazna polja se brišu, da ne ostanu podaci prošlog projekta.</p><table class="en-tab"><tr><th>Ćelija</th><th>Podatak</th><th>Vrijednost</th><th>Izvor</th></tr>';
  for (const [c, lab, typ, keep] of IZ().FIELDS) { const v = out[c], ph = keep ? curTxt(c, cur[c]) : '';
    const inp = typ === 'date' ? '<input type="date" data-iz="' + c + '" value="' + esc((z.f[c] && z.f[c].date) || (v && v.date) || '') + '" style="width:100%;font-size:16px;padding:6px">' : '<input data-iz="' + c + '"' + (typ === 'num' ? ' inputmode="decimal"' : '') + ' value="' + esc(z.f[c] != null ? fmtV(z.f[c]) : fmtV(v)) + '" placeholder="' + esc(ph ? 'iz predloška: ' + ph : keep ? '' : 'ostaje prazno') + '" style="width:100%;box-sizing:border-box;font-size:16px;padding:6px">';
    ph2 += '<tr><td>' + c + '</td><td>' + esc(lab) + '</td><td style="min-width:220px">' + inp + '</td><td><small>' + esc(src[c] || (ph ? 'predložak' : '')) + '</small></td></tr>'; }
  ph2 += '</table><div class="tl-actions"><button class="tl-btn" id="izReset">Vrati prijedloge</button></div><p class="tl-note">Razredi (C20, C21) uzimaju se iz XML-a (1=A+ … 8=G) – provjeri ih.</p>';
  const b27 = out.B27 != null && out.B27 !== '' ? out.B27 : cur.B27; if (!(+b27 > 0)) ph2 = '<p class="en-warn">Broj ukućana (B27) nije upisan – potrošnja vode u izvješću bit će 0. Upiši ga ovdje ili u Sustavi → Potrošnja vode.</p>' + ph2;
  h += sec('izSecPod', 'List Podaci', ph2);
  // slike
  if (tpl && S.tplImgs && S.tplImgs.length) { const ul = ulogeGet(tpl), asg = assignSlots(S.tplImgs, ul), stale = asg.filter(a => a.u && (a.u.startsWith('tab_') ? !tabOk(z.kd, a.u) : !a.p)).length;
    let b = '<p class="tl-note">Za svaku sliku u predlošku odaberi što ide na njeno mjesto (pamti se za ovaj predložak). Fotografije označi na skici (dodirni fotografiju → Za certifikat). Tablice se crtaju iz Word izvještaja KI Experta.</p>' + (stale ? '<p class="en-warn">' + stale + ' mjesta nema svoju fotografiju ili tablicu – tamo ostaje slika iz predloška (prošlog projekta)!</p>' : '') + '<table class="en-tab"><tr><th>List</th><th>Red</th><th>Što ide</th><th>Bit će</th></tr>';
    for (const a of asg) { const im = a.im; b += '<tr><td>' + esc(im.sheet) + '</td><td>' + im.row + '</td><td><select data-ul="' + esc(im.key) + '" style="font-size:15px;padding:4px">' + ULOGE.map(([k, n]) => '<option value="' + k + '"' + (k === a.u ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></td><td><small>' + (!a.u ? 'slika iz predloška' : a.u.startsWith('tab_') ? (tabOk(z.kd, a.u) ? 'tablica iz KI izvještaja' : '<span style="color:#b91c1c">' + (z.kd ? 'tablica nije pronađena u KI izvještaju' : 'učitaj KI .docx') + '</span>') : a.p ? 'foto ' + (a.p.o.n || '') + (a.p.o.strana ? ' (' + a.p.o.strana + ')' : '') + ' · ' + esc(a.p.floor) : '<span style="color:#b91c1c">nema fotografije</span>') + '</small></td></tr>'; }
    h += sec('izSecImg', 'Fotografije i tablice' + (stale ? ' <span style="color:#b91c1c">⚠</span>' : ''), b + '</table>'); }
  // mjere
  if (tpl && S.tplB) { const kd = z.kd || {}, M = z.mjere = z.mjere || {}, nk = z.nakon = z.nakon || {}, have = MJERE.filter(([t]) => S.tplB.sheets.some(sh => IZ().findCells(S.tplB, sh.name, /^Mjerom se predviđa/).some(c => mjeraTip(c.v) === t)));
    if (have.length) { let b = '<p class="tl-note">Prijedlog prema stanju (U iz KI Experta ili sastav konstrukcija). Uključene mjere popune svoje listove (opis, površina, U nakon, potrebna energija prije/poslije), ostali listovi mjera se sakriju. U nakon mjere i energiju poslije dobiješ iz KI Experta.</p>';
      for (const [t, n] of have) { const m = Object.assign({}, mjeraDefault(t, kd), M[t] || {}), A = m.A || mjeraPov(t, kd);
        b += '<div style="border:1px solid #dbe5f0;border-radius:10px;padding:8px 10px;margin:8px 0"><label class="tl-check"><input type="checkbox" data-mj="' + t + '" data-k="on"' + (m.on ? ' checked' : '') + '> <b>' + n + '</b></label>' + (m.on ? '<div class="en-grid">' + (t !== 'stolarija' ? '<label class="tl-field">Debljina (cm)<input data-mj="' + t + '" data-k="d" inputmode="decimal" value="' + esc(m.d || '') + '"></label>' : '') + '<label class="tl-field">Površina (m²)<input data-mj="' + t + '" data-k="A" inputmode="decimal" value="' + esc(f2(A)) + '"></label><label class="tl-field">U nakon (W/m²K)<input data-mj="' + t + '" data-k="U" inputmode="decimal" value="' + esc(m.U ? f2(+m.U) : '') + '" placeholder="iz KI Experta"></label><label class="tl-field">Q prije (kWh/god)<input data-mj="' + t + '" data-k="Qp" inputmode="decimal" value="' + esc(m.Qp || '') + '"></label><label class="tl-field">Q poslije (kWh/god)<input data-mj="' + t + '" data-k="Qn" inputmode="decimal" value="' + esc(m.Qn || '') + '"></label></div><label class="tl-field">Opis mjere<input data-mj="' + t + '" data-k="opis" value="' + esc(m.opis || mjeraOpis(t, m)) + '"></label>' : '') + '</div>'; }
      b += '<h4>Nakon svih mjera (za zaključak)</h4><div class="en-grid"><label class="tl-field">QH,nd nakon<input data-nk="QH" inputmode="decimal" value="' + esc(nk.QH || '') + '"></label><label class="tl-field">Razred QH,nd<input data-nk="rQ" value="' + esc(nk.rQ || '') + '"></label><label class="tl-field">Eprim nakon<input data-nk="Ep" inputmode="decimal" value="' + esc(nk.Ep || '') + '"></label><label class="tl-field">Razred Eprim<input data-nk="rE" value="' + esc(nk.rE || '') + '"></label><label class="tl-field">CO2 nakon (kg/m²a)<input data-nk="CO2" inputmode="decimal" value="' + esc(nk.CO2 || '') + '"></label></div>';
      h += sec('izSecMj', 'Mjere energetske učinkovitosti', b); } }
  // listovi
  if (tpl && S.tplB) { const ov = z.sheets = z.sheets || {}; let b = '<p class="tl-note">Skriveni listovi se ne ispisuju kad cijeli Excel spremiš u PDF. Automatski: hlađenje IMA/NEMA prema Sustavima, zaključak SA/BEZ mjera i listovi mjera prema odabranim mjerama. Ručni odabir ima prednost.</p><table class="en-tab">';
    for (const sh of S.tplB.sheets) { const v = ov[sh.name]; b += '<tr><td>' + esc(sh.name) + '</td><td><select data-sh="' + esc(sh.name) + '" style="font-size:15px;padding:4px"><option value=""' + (v == null ? ' selected' : '') + '>automatski</option><option value="1"' + (v === true ? ' selected' : '') + '>prikaži</option><option value="0"' + (v === false ? ' selected' : '') + '>sakrij</option></select></td></tr>'; }
    h += sec('izSecSh', 'Listovi u izvješću', b + '</table>'); }
  h += '<div class="tl-actions"><button class="tl-btn primary" id="izGo"' + (tpl ? '' : ' disabled') + '>⬇ Popunjeno izvješće (.xlsx)</button></div><p class="tl-note">Kad otvoriš izvješće u Excelu, „Spremi kao PDF → cijela radna knjiga” ne ispisuje skrivene listove. List Podaci ostaje vidljiv – njega izostavi kao i dosad.</p>';
  panel(h);
  const P2 = $('enPanel');
  P2.querySelectorAll('details.en-det[id]').forEach(d => d.addEventListener('toggle', () => { S.izOpen = S.izOpen || {}; S.izOpen[d.id] = d.open; }));
  P2.querySelectorAll('[data-iz]').forEach(el => el.addEventListener('change', () => { const c = el.dataset.iz, typ = (IZ().FIELDS.find(f => f[0] === c) || [])[2]; let v = el.value.trim();
    if (v === '') delete z.f[c]; else if (typ === 'num') { const n = IZ().hrNum(v); z.f[c] = n != null ? n : v; } else if (typ === 'date') z.f[c] = { date: v }; else z.f[c] = v; save(); }));
  P2.querySelectorAll('[data-ul]').forEach(el => el.addEventListener('change', () => { const u = ulogeGet(tpl); u[el.dataset.ul] = el.value; ulogeSet(tpl, u); go(8); }));
  P2.querySelectorAll('[data-mj]').forEach(el => el.addEventListener('change', () => { const t = el.dataset.mj, k = el.dataset.k, M = z.mjere = z.mjere || {}; M[t] = M[t] || {}; if (k === 'on') { M[t].on = el.checked; save(); go(8); return; } let v = el.value.trim(); if (k !== 'opis') { const n = IZ().hrNum(v); v = v === '' ? null : n != null ? n : v; } if (v == null || v === '') delete M[t][k]; else M[t][k] = v; save(); }));
  P2.querySelectorAll('[data-nk]').forEach(el => el.addEventListener('change', () => { const k = el.dataset.nk, nk = z.nakon = z.nakon || {}; let v = el.value.trim(); if (/^r/.test(k)) v = v.toUpperCase(); else { const n = IZ().hrNum(v); v = v === '' ? null : n != null ? n : v; } if (v == null || v === '') delete nk[k]; else nk[k] = v; save(); }));
  P2.querySelectorAll('[data-sh]').forEach(el => el.addEventListener('change', () => { const ov = z.sheets = z.sheets || {}; if (el.value === '') delete ov[el.dataset.sh]; else ov[el.dataset.sh] = el.value === '1'; save(); }));
  if ($('izReset')) $('izReset').onclick = () => { if (!confirm('Obrisati ručno upisane vrijednosti lista Podaci i vratiti prijedloge?')) return; z.f = {}; save(); go(8); };
  $('izTpl').onclick = async () => { const f = await pickFile('.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/octet-stream'); if (!f) return;
    try { const b = await fileBytes(f); await IZ().openTemplate(b, 'Podaci'); await tplPut({ name: f.name, bytes: b, at: Date.now() }); S.tplB = null; go(8); } catch (e) { alert('Predložak nije učitan: ' + (e.message || e)); } };
  $('izXml').onclick = async () => { const f = await pickFile('.xml,text/xml,application/xml,application/octet-stream'); if (!f) return;
    try { z.ki = IZ().parseKiXml(await f.text()); z.kiName = f.name; save(); go(8); } catch (e) { alert('XML nije učitan: ' + (e.message || e)); } };
  $('izDocx').onclick = async () => { const f = await pickFile('.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/octet-stream'); if (!f) return;
    try { const d = await IZ().parseKiDocx(await fileBytes(f)); if (d.A == null && !(d.elementi || []).length) throw Error('u dokumentu nisu pronađeni podaci (oplošje, obujam, slojevi…)'); z.kd = d; z.kdName = f.name; save(); S.izOpen = Object.assign(S.izOpen || {}, { izSecCk: true }); go(8); } catch (e) { alert('Izvještaj nije učitan: ' + (e.message || e)); } };
  $('izGo').onclick = async () => { const bt = $('izGo'); bt.disabled = true; bt.textContent = 'Pripremam…';
    try { const t = await tplGet(); const B = await IZ().openTemplate(t.bytes, 'Podaci'); IZ().setCells(B, izvValues().out);
      await applyReport(B, z, t, n => { bt.textContent = 'Pripremam… slika ' + n; });
      const bytes = await IZ().buildTemplate(B), base = String((window.IzmjeraApp && IzmjeraApp.projectName()) || 'izvjesce').replace(/[^a-z0-9čćžšđ_-]+/gi, '_');
      EX.saveBytes(bytes, 'Izvjesce_' + base + '.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); }
    catch (e) { alert('Izvješće nije napravljeno: ' + (e.message || e)); }
    bt.disabled = false; bt.textContent = '⬇ Popunjeno izvješće (.xlsx)'; };
}
function fileBase() { return String((window.IzmjeraApp && IzmjeraApp.projectName()) || 'izmjera').replace(/[^a-z0-9čćžšđ_-]+/gi, '_') + '_energetski'; }
function exportXlsx() {
  const D = dataTables(), B = v => ({ v, b: true }), T = D.T;
  const sheets = [
    sazSheet(), ...kiSheets().sheets,
    { name: 'Zbirno', cols: [44, 9, 14], rows: [[B('Građevni dijelovi – zgrada ukupno (vanjske mjere, zidovi neto bez otvora)')], [], [B('Element'), B('Strana'), B('Površina m²')], ...T.rows.map(r => [EC.EL[r.el], r.strana, r.A / 1e4]), [], [B('Otvori'), B('Strana'), B('kom'), B('Površina m²')], ...T.ops.map(o => [EC.OPEN_NAME[o.kind], o.strana, { v: o.n, int: true }, o.A / 1e4]), [], [B('Ve (m³)'), '', T.Ve / 1e6], [B('Ak (m²)'), '', T.Ak / 1e4], [B('A (m²)'), '', T.A / 1e4], [B('f0 = A/Ve (1/m)'), '', Math.round(T.f0 * 1000) / 1000]] },
    { name: 'Po etažama', cols: [44, 9, ...D.inc.map(() => 14), 14], rows: [[B('Element'), B('Strana'), ...D.inc.map(F => B(F.name)), B('Ukupno')], ...D.per] },
    { name: 'Etaže', cols: [18, 12, 12, 26, 26, 14, 14, 14], rows: [[B('Etaža'), B('h svijetla cm'), B('H bruto cm'), B('Ispod'), B('Iznad'), B('Tlocrt m²'), B('Ak m²'), B('Ve m³')], ...D.fl] },
    { name: 'Otvori', cols: [14, 20, 22, 8, 9, 9, 6, 10, 14, 16, 8, 20], rows: [[B('Etaža'), B('Prostorija'), B('Vrsta'), B('Strana'), B('š cm'), B('v cm'), B('kom'), B('m²'), B('Okvir'), B('Staklo'), B('Roleta'), B('Napomena')], ...D.ops] },
    { name: 'Konstrukcije', cols: [30, 24, 12, 18, 12, 18, 40], rows: [[B('Građevni dio'), B('Materijal'), B('Debljina cm'), B('Izolacija'), B('Izolacija cm'), B('Podatak'), B('Napomena')], ...D.kon] },
    { name: 'Opći podaci', cols: [26, 60], rows: [...infoRows(), [], ...D.sv.map(r => [B(r[0]), r[1]]), [], [B('Fotografije'), ''], ...D.foto] }
  ];
  EX.saveBytes(EX.xlsx(sheets), fileBase() + '.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}
function exportPdf() {
  const D = dataTables(), T = D.T, f2 = v => typeof v === 'number' ? (Number.isInteger(v) ? String(v) : v.toFixed(2).replace('.', ',')) : v == null ? '' : String(v);
  const blocks = [...sazPdfBlocks(), { h: 'Podaci o građevini' }, { table: { cols: [{ t: '', w: 30 }, { t: '', w: 70 }], rows: infoRows() } },
    ...kiPdfBlocks(),
    { h: 'Zgrada ukupno' }, { table: { cols: [{ t: 'Veličina', w: 60 }, { t: 'Vrijednost', w: 40, al: 'r' }], rows: [['Bruto obujam grijanog dijela Ve', m3(T.Ve) + ' m³'], ['Ploština korisne površine Ak', m2(T.Ak) + ' m²'], ['Oplošje grijanog dijela A', m2(T.A) + ' m²'], ['Faktor oblika f0 = A/Ve', T.f0.toFixed(3).replace('.', ',') + ' 1/m']] } },
    { h: 'Građevni dijelovi (vanjske mjere, zidovi neto bez otvora)' }, { table: { cols: [{ t: 'Element', w: 50 }, { t: 'Strana', w: 12 }, ...D.inc.map(F => ({ t: F.name, w: 16, al: 'r' })), { t: 'Ukupno m²', w: 18, al: 'r' }], rows: D.per.map(r => r.map(f2)) } },
    { h: 'Otvori zbirno' }, { table: { cols: [{ t: 'Vrsta', w: 40 }, { t: 'Strana', w: 15 }, { t: 'kom', w: 12, al: 'r' }, { t: 'm²', w: 18, al: 'r' }], rows: T.ops.map(o => [EC.OPEN_NAME[o.kind], o.strana, String(o.n), m2(o.A)]) } },
    { h: 'Etaže' }, { table: { cols: [{ t: 'Etaža', w: 18 }, { t: 'h cm', w: 9, al: 'r' }, { t: 'H cm', w: 9, al: 'r' }, { t: 'Ispod', w: 22 }, { t: 'Iznad', w: 22 }, { t: 'Tlocrt m²', w: 13, al: 'r' }, { t: 'Ak m²', w: 12, al: 'r' }, { t: 'Ve m³', w: 12, al: 'r' }], rows: D.fl.map(r => r.map(f2)) } },
    { h: 'Popis otvora' }, { table: { cols: [{ t: 'Etaža', w: 14 }, { t: 'Prostorija', w: 18 }, { t: 'Vrsta', w: 18 }, { t: 'Str.', w: 7 }, { t: 'š', w: 8, al: 'r' }, { t: 'v', w: 8, al: 'r' }, { t: 'kom', w: 6, al: 'r' }, { t: 'm²', w: 9, al: 'r' }, { t: 'Okvir', w: 13 }, { t: 'Staklo', w: 15 }, { t: 'Rol.', w: 6 }], rows: D.ops.map(r => r.slice(0, 11).map((v, i) => i === 4 || i === 5 ? n1(v) : f2(v))) } },
    { h: 'Sastav konstrukcija' }, { table: { cols: [{ t: 'Dio', w: 24 }, { t: 'Materijal', w: 20 }, { t: 'cm', w: 7, al: 'r' }, { t: 'Izolacija', w: 16 }, { t: 'cm', w: 7, al: 'r' }, { t: 'Podatak', w: 13 }, { t: 'Napomena', w: 25 }], rows: D.kon.map(r => r.map(v => String(v))) } },
    { h: 'Sustavi' }, { table: { cols: [{ t: '', w: 30 }, { t: '', w: 70 }], rows: D.sv } },
    { h: 'Fotografije' }, { table: { cols: [{ t: 'Što', w: 70 }, { t: 'Uslikano', w: 30 }], rows: D.foto } }];
  const bytes = EX.pdfTables(blocks, { project: (window.IzmjeraApp && IzmjeraApp.projectName()) || 'Izmjera', floor: 'Energetski certifikat', title: 'Iskaz površina i volumena' });
  window.IzmjeraPdf.save(bytes, fileBase() + '.pdf');
}

/* ---------- v2.73: Legalizacija – snimka izvedenog stanja (tvoj Excel) i izjava statičara (tvoj Word) ---------- */
const LD_KEYS = { snimka: 'leg-snimka', izjava: 'leg-izjava' };
async function ldTplGet(k) { try { const db = await tplDb(); return await new Promise(res => { const q = db.transaction('f').objectStore('f').get(LD_KEYS[k]); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); }); } catch (e) { return null; } }
async function ldTplPut(k, v) { const db = await tplDb(); await new Promise((res, rej) => { const t = db.transaction('f', 'readwrite'); t.objectStore('f').put(v, LD_KEYS[k]); t.oncomplete = res; t.onerror = () => rej(t.error); }); }
function LD() { const p = P(); p.legDoc = p.legDoc || {}; return p.legDoc; }
const LD_CH = {
  zid: [['blok opeke', 'blok opeka'], ['pune opeke', 'puna opeka'], ['armiranog betona', 'AB'], ['betonskih blokova', 'beton. blokovi'], ['kamena', 'kamen'], ['drva', 'drvo']],
  strop: [['ab', 'AB ploča'], ['nema', 'nema stropa'], ['drveni', 'drveni grednik'], ['sitnorebrasti', 'sitnorebrasti']],
  pokrov: [['glinenog crijepa', 'crijep'], ['lima', 'lim'], ['betonskog crijepa', 'betonski crijep'], ['valovitih ploča', 'valovite ploče'], ['bitumenske šindre', 'šindra']],
  temelj: [['trakastim temeljima', 'trakasti'], ['temeljnoj ploči', 'ploča'], ['temeljima samcima', 'samci']],
  stol: [['drvena', 'drvena'], ['PVC', 'PVC'], ['aluminijska', 'aluminij']],
  inst: [['voda', 'voda'], ['struja', 'struja'], ['plin', 'plin'], ['kanal', 'kanalizacija']]
};
const MJ = ['siječanj', 'veljača', 'ožujak', 'travanj', 'svibanj', 'lipanj', 'srpanj', 'kolovoz', 'rujan', 'listopad', 'studeni', 'prosinac'];
const splitAdr = s => { s = String(s || '').trim(); const i = s.lastIndexOf(','); return i > 0 ? [s.slice(0, i).trim(), s.slice(i + 1).trim()] : [s, '']; };
const GEN = { prizemlje: 'PRIZEMLJA', podrum: 'PODRUMA', suteren: 'SUTERENA', potkrovlje: 'POTKROVLJA', galerija: 'GALERIJE', tavan: 'TAVANA' };
const genName = n => { const t = String(n || '').trim(), l = t.toLowerCase(); if (GEN[l]) return GEN[l]; const m = /^(\d+)\.\s*kat$/i.exec(t); if (m) return m[1] + '. KATA'; return t.toUpperCase(); };
function ldData(R, full) {
  const LG = window.IzmjeraLegalizacija, fm = LG.fm, i = window.projectInfo || {}, ld = LD(), now = new Date();
  const gr = (i.gradjevina || '').trim() || 'ZGRADA', gl = gr.toLowerCase(), kc = [i.kc ? 'k.č.br. ' + i.kc : '', i.ko ? 'k.o. ' + i.ko : ''].filter(Boolean).join(', ');
  const FL = R.floors.filter(f => !f.tavan), bb = FL.reduce((b, f) => ({ x0: Math.min(b.x0, f.bb.x0), y0: Math.min(b.y0, f.bb.y0), x1: Math.max(b.x1, f.bb.x1), y1: Math.max(b.y1, f.bb.y1) }), { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });
  const dims = fm((bb.x1 - bb.x0) / 100) + ' × ' + fm((bb.y1 - bb.y0) / 100), katnost = FL.map(f => String(f.name || '').toLowerCase()).join(' + ');
  const ri = LG.roofInfo(R), visina = ri.H > 0 ? fm(ri.H / 100) + ' m' : '';
  const zid = ld.zid || 'blok opeke', strop = ld.strop || (R.floors.some(f => f.secRoof) ? 'nema' : 'ab'), pokrov = ld.pokrov || 'glinenog crijepa', temelj = ld.temelj || 'trakastim temeljima', stol = ld.stol || 'drvena', inst = ld.inst || {};
  let tW = null; try { const r0 = S.resAll && S.resAll.find(x => x && !x.err); if (r0) tW = Math.round(EC.extT(r0)); } catch (e) { }
  const vrsta = (() => { const f = R.floors.find(x => x.secRoof); const v = f ? f.secRoof.vr : null; return v === 'jednostresni' ? 'jednostrešna' : v === 'cetverostresni' ? 'četverostrešna' : v ? 'dvostrešna' : null; })();
  const stropTxt = { ab: 'Stropna konstrukcija izvedena je kao armiranobetonska ploča.', nema: 'Zgrada nema stropne konstrukcije – drveno krovište vidljivo je iz prostorije.', drveni: 'Stropna konstrukcija izvedena je kao drveni grednik.', sitnorebrasti: 'Stropna konstrukcija izvedena je kao sitnorebrasti strop.' }[strop];
  const krovTxt = vrsta ? 'Krovna konstrukcija je drvena, ' + vrsta + (ri.nagib ? ', nagiba približno ' + ri.nagib + '°' : '') + '. Krovni pokrov izveden je od ' + pokrov + '.' : 'Krov je ravan.';
  /* prostorije po etažama */
  const roomTxt = []; procIncluded().forEach(F => { const rs = (F.res.rooms || []).filter(r => r.kind !== 'vanjski' && r.name); if (!rs.length) return; const A = r => fm((r.area || 0) / 1e4);
    roomTxt.push(rs.length === 1 ? F.name + ' se sastoji od jedne prostorije – ' + rs[0].name.toLowerCase() + ' (neto površine ' + A(rs[0]) + ' m²).' : F.name + ' se sastoji od sljedećih prostorija: ' + rs.map(r => r.name.toLowerCase() + ' (' + A(r) + ' m²)').join(', ') + '.'); });
  const auto = {
    uvod: ['Ovaj elaborat je izrađen u skladu sa Zakonom o postupanju s nezakonito izgrađenim zgradama (NN 86/12, 143/13, 65/17, 14/19, 48/26) u svrhu ishođenja Rješenja o izvedenom stanju za nezakonito izgrađenu zgradu na zemljištu označenom kao ' + kc + '.', '', 'Na navedenoj čestici se nalazi ' + gl + '.', '', 'Za predmetnu zgradu nije izdana građevinska dozvola niti drugi akt kojim se dokazuje zakonitost građenja.'].join('\n'),
    opis: ['Na predmetnoj čestici ' + kc + (i.adresa ? ', na adresi ' + i.adresa : '') + ', nalazi se ' + gl + '.', '', 'Predmetna građevina je slobodnostojeća ' + gl + ' katnosti ' + katnost + ', tlocrtnih vanjskih dimenzija ' + dims + ' m.', ''].concat(roomTxt.length ? roomTxt.flatMap(t => [t, '']) : [])
      .concat(['Prema vizualnom pregledu, nosivi zidovi izvedeni su od ' + zid + (tW ? ' debljine ' + tW + ' cm' : '') + '. ' + stropTxt, krovTxt, '', 'Vanjska stolarija je ' + stol + '.']).join('\n'),
    inst: (() => { const L = [['voda', 'javnu vodoopskrbnu mrežu'], ['struja', 'elektroenergetsku mrežu'], ['plin', 'javnu plinsku mrežu'], ['kanal', 'javnu kanalizacijsku mrežu']].filter(([k]) => inst[k]); const Z = gr.charAt(0) + gl.slice(1);
      return L.length ? L.map(([, t]) => Z + ' je priključena na ' + t + '.').join('\n\n') : Z + ' nije priključena na komunalnu infrastrukturu – u zgradi nema instalacija vodovoda, kanalizacije, plina ni elektroinstalacija.'; })()
  };
  const txt = k => (ld[k + 'Txt'] != null ? ld[k + 'Txt'] : auto[k]), paras = t => t.split('\n');
  const uvodP = paras(txt('uvod')).map((t, k) => k === 0 && kc && t.endsWith(kc + '.') ? [[t.slice(0, t.length - kc.length - 1), false], [kc + '.', true]] : t);
  const datum = ld.datum || 'Zaprešić, ' + MJ[now.getMonth()] + ' ' + now.getFullYear() + '.';
  const big = Math.max(bb.x1 - bb.x0, bb.y1 - bb.y0) < 1200 ? '1:50' : '1:100', lists = [];
  FL.forEach(f => lists.push(['TLOCRT ' + genName(f.name), big])); if (R.floors.some(f => f.secRoof)) lists.push(['TLOCRT KROVNIH PLOHA', big]); lists.push(['PRESJEK A-A', big], ['PROČELJA', big]);
  const gbpNo = lists.length + 1, volNo = lists.length + 2; lists.push(['ISKAZ POVRŠINA I OBRAČUNSKE VELIČINE ZGRADE - GBP', ld.scLeg || big], ['ISKAZ POVRŠINA I OBRAČUNSKE VELIČINE ZGRADE - OBUJAM', ld.scLeg || big]);
  const pad = n => String(n).padStart(2, '0');
  const [iu, ig] = splitAdr(i.invAdresa), [ou, og] = splitAdr(i.adresa), Gc = gr.charAt(0) + gl.slice(1);
  return { auto, d: {
    inv: (i.invIme || '').toUpperCase(), invAdr: i.invAdresa || '', invOib: i.invOib || '', td: i.td || i.broj || '', gradjevina: gr.toUpperCase(), kc, lokAdr: i.adresa || '', datum,
    uvod: uvodP, opis: paras(txt('opis')), inst: paras(txt('inst')).concat(['']),
    gbp: R.floors.filter(f => f.G > 0).map(f => [String(f.name).toLowerCase(), f.G / 1e4]), vol: R.floors.map(f => [String(f.name).toLowerCase(), f.V / 1e6]),
    katnost, visina, namjena: ld.namjena || gl, polozaj: ld.polozaj || 'unutar građevinskog područja',
    listovi: lists.map((l, k) => [pad(k + 1), l[0], l[1]]), listGbp: pad(gbpNo), listVol: pad(volNo),
    ...(full && window.IzmjeraNacrti ? (() => { const L = IzmjeraNacrti.lists(); if (!L || !L.length) return {}; const g = L.find(x => /- GBP$/.test(x[1])), v = L.find(x => /- OBUJAM$/.test(x[1])); return { listovi: L, listGbp: g ? g[0] : pad(gbpNo), listVol: v ? v[0] : pad(volNo) }; })() : {}),
    kp: ld.kp || null, dgu: ld.dgu || [], foto: ldPhotos(),
    /* izjava */
    invUlica: iu, invGrad: ig, invPosta: '', invOib2: i.invOib, objUlica: ou, objGrad: og, kcBroj: i.kc || '', ko: i.ko || '', tdIzj: ld.tdIzj || '', datumIzj: datum.replace(/\.$/, '') + '. godine',
    izNamjena: Gc, izTlocrt: 'Građevina je tlocrtno pravilnog oblika, najvećih tlocrtnih gabaritnih dimenzija ' + dims.replace(' × ', ' x ') + ' m', izKatnost: katnost,
    izVisina: ri.he != null ? 'Visina zgrade do nazidnice iznosi ' + fm(ri.he / 100) + ' m, a do sljemena ' + fm(ri.H / 100) + ' m' : (visina ? 'Visina zgrade iznosi ' + visina : null),
    izTemelj: 'Građevina je, prema dostupnim podacima, temeljena na ' + temelj, izZidovi: 'Glavnu nosivu vertikalnu konstrukciju čine zidovi od ' + zid + (tW ? ' debljine ' + tW + ' cm' : ''),
    izStrop: stropTxt.replace(/\.$/, ''), izKrov: vrsta ? 'Krov građevine je izveden kao ' + vrsta.replace(/a$/, 'o') + ' drveno krovište' + (ri.nagib ? ' nagiba ' + ri.nagib + '°' : '') + ', pokriven ' + pokrov.replace(/^glinenog /, 'glinenim ').replace(/^betonskog /, 'betonskim ').replace(/crijepa$/, 'crijepom').replace(/^lima$/, 'limom') : 'Krov građevine je ravan'
  } };
}
function ldPhotos() { const out = []; for (const p of projPhotos()) { const s = window.IzmjeraFoto && IzmjeraFoto.get(p.o.id); if (s) out.push(s); } return out.concat(LD().foto || []); }
function pickImages(multi) { return new Promise(res => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*,.pdf'; i.multiple = !!multi; i.style.display = 'none'; document.body.appendChild(i); i.onchange = () => { const f = [...(i.files || [])]; i.remove(); res(f); }; i.click(); }); }
async function imgToData(f, max) { if (/pdf$/i.test(f.type) || /\.pdf$/i.test(f.name)) throw Error('PDF se ne može umetnuti kao slika – spremi stranicu kao sliku (snimka zaslona ili „Spremi kao JPG”) pa odaberi nju.');
  const url = URL.createObjectURL(f); try { const im = await new Promise((res, rej) => { const x = new Image(); x.onload = () => res(x); x.onerror = () => rej(Error('Slika se ne može učitati.')); x.src = url; }); const k = Math.min(1, (max || 1800) / Math.max(im.width, im.height)), cv = document.createElement('canvas'); cv.width = Math.round(im.width * k); cv.height = Math.round(im.height * k); const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(im, 0, 0, cv.width, cv.height); return cv.toDataURL('image/jpeg', 0.82); } finally { URL.revokeObjectURL(url); } }
function legDocHtml(R) {
  const ld = LD(), i = window.projectInfo || {}, chip = (grp, val, on, lbl) => '<button class="tl-chip' + (on ? ' on' : '') + '" data-ldc="' + grp + '" data-v="' + esc(val) + '">' + esc(lbl) + '</button>';
  const miss = [['invIme', 'investitor'], ['invAdresa', 'adresa investitora'], ['gradjevina', 'naziv građevine'], ['td', 'T.D.'], ['adresa', 'adresa građevine'], ['kc', 'k.č.'], ['ko', 'k.o.']].filter(([k]) => !String(i[k] || '').trim()).map(x => x[1]);
  let h = '<div class="en-box" id="ldBox"><div class="en-box-h">📄 Snimka izvedenog stanja i izjava statičara</div><p class="tl-note">Aplikacija popuni tvoj Excel snimke i tvoj Word izjave podacima iz izmjere i iz Podataka o projektu. Predlošci se učitaju jednom i pamte se na uređaju.</p>';
  h += '<div class="tl-actions"><button class="tl-btn" id="ldTplS">📊 Predložak snimke (Excel): <span id="ldTplSn">…</span></button><button class="tl-btn" id="ldTplI">📝 Predložak izjave (Word): <span id="ldTplIn">…</span></button></div>';
  h += '<div class="tl-note" style="margin:6px 0">' + (miss.length ? '<span style="color:#b45309">U Podacima o projektu nedostaje: ' + esc(miss.join(', ')) + '.</span> ' : '✓ Podaci o projektu su upisani. ') + '<button class="tl-btn" id="ldInfo">✎ Podaci o projektu</button></div>';
  h += '<div style="display:grid;grid-template-columns:auto 1fr;gap:6px 10px;align-items:center;margin:6px 0">' +
    '<span>T.D. izjave</span><input id="ldTdI" value="' + esc(ld.tdIzj || '') + '" placeholder="2026 / Prezime-I" style="font-size:16px;padding:6px">' +
    '<span>Datum</span><input id="ldDat" value="' + esc(ld.datum || '') + '" placeholder="Zaprešić, ' + MJ[new Date().getMonth()] + ' ' + new Date().getFullYear() + '." style="font-size:16px;padding:6px">' +
    '<span>Namjena (2.8)</span><input id="ldNam" value="' + esc(ld.namjena || '') + '" placeholder="' + esc((i.gradjevina || 'zgrada').toLowerCase()) + '" style="font-size:16px;padding:6px"></div>';
  const row = (t, grp, cur, multi) => '<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:4px 0"><span style="min-width:110px">' + t + '</span>' + LD_CH[grp].map(([v, l]) => chip(grp, v, multi ? !!(ld.inst || {})[v] : cur === v, l)).join('') + '</div>';
  h += row('Nosivi zidovi', 'zid', ld.zid || 'blok opeke') + row('Strop', 'strop', ld.strop || (R.floors.some(f => f.secRoof) ? 'nema' : 'ab')) + row('Pokrov', 'pokrov', ld.pokrov || 'glinenog crijepa') + row('Temelji', 'temelj', ld.temelj || 'trakastim temeljima') + row('Stolarija', 'stol', ld.stol || 'drvena') + row('Instalacije', 'inst', null, true);
  const D0 = ldData(R);
  for (const [k, t] of [['uvod', '2.1 Uvod'], ['opis', '2.4 Arhitektonski opis'], ['inst', '2.5 Instalacije']]) h += '<div style="margin-top:8px"><b>' + t + '</b> ' + (ld[k + 'Txt'] != null ? '<button class="tl-btn" data-ldr="' + k + '">↺ Složi iz izmjere</button>' : '<span class="tl-note">(složeno iz izmjere – možeš mijenjati)</span>') + '<textarea data-ldt="' + k + '" rows="' + (k === 'opis' ? 9 : 4) + '" style="width:100%;font-size:15px;padding:6px;box-sizing:border-box">' + esc(ld[k + 'Txt'] != null ? ld[k + 'Txt'] : D0.auto[k]) + '</textarea></div>';
  const nP = projPhotos().length, nE = (ld.foto || []).length;
  h += '<div style="margin-top:8px"><b>Slike</b><div class="tl-actions"><button class="tl-btn" id="ldKp">🗺 Kopija plana: ' + (ld.kp ? '✓' : 'nije odabrana') + '</button><button class="tl-btn" id="ldDgu">📜 Uvjerenje DGU: ' + ((ld.dgu || []).length ? (ld.dgu.length + ' str.') : 'nije odabrano') + '</button><button class="tl-btn" id="ldFoto">📷 Dodaj fotografije</button>' + (nE ? '<button class="tl-btn" id="ldFotoX">✕ Makni dodane (' + nE + ')</button>' : '') + '</div><div class="tl-note">Fotografije: ' + nP + ' sa skice + ' + nE + ' dodanih, redom u okvire lista Fotodokumentacija. Kopiju plana i uvjerenje odaberi kao sliku (JPG/PNG).</div></div>';
  h += '<div class="tl-actions" style="margin-top:8px"><button class="tl-btn" id="ldSnimka" style="background:#1e3a8a;color:#fff">⬇ Snimka izvedenog stanja (Excel)</button><button class="tl-btn" id="ldIzjava" style="background:#1e3a8a;color:#fff">⬇ Izjava statičara (Word)</button></div><div id="ldMsg" class="tl-note"></div></div>';
  return h;
}
function legDocBind(R) {
  const ld = LD(), re = () => { save(); const sc = $('enPanel').scrollTop; go(9); $('enPanel').scrollTop = sc; };
  ldTplGet('snimka').then(t => { const e = $('ldTplSn'); if (e) e.textContent = t ? t.name : 'nije učitan'; }); ldTplGet('izjava').then(t => { const e = $('ldTplIn'); if (e) e.textContent = t ? t.name : 'nije učitan'; });
  const tpl = k => async () => { const f = await pickFile(k === 'snimka' ? '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document'); if (!f) return; await ldTplPut(k, { name: f.name, bytes: await fileBytes(f) }); re(); };
  $('ldTplS').onclick = tpl('snimka'); $('ldTplI').onclick = tpl('izjava');
  $('ldInfo').onclick = () => { if (window.IzmjeraPodaci && IzmjeraPodaci.editCurrent) IzmjeraPodaci.editCurrent(() => re()); else alert('Podatke o projektu upiši na početnom zaslonu projekta.'); };
  $('ldTdI').onchange = e => { ld.tdIzj = e.target.value.trim(); save(); }; $('ldDat').onchange = e => { ld.datum = e.target.value.trim(); save(); }; $('ldNam').onchange = e => { ld.namjena = e.target.value.trim(); save(); };
  $('ldBox').querySelectorAll('[data-ldc]').forEach(b => b.onclick = () => { const g = b.dataset.ldc, v = b.dataset.v; if (g === 'inst') { ld.inst = ld.inst || {}; ld.inst[v] = !ld.inst[v]; } else ld[g] = v; re(); });
  $('ldBox').querySelectorAll('[data-ldt]').forEach(t => t.onchange = () => { ld[t.dataset.ldt + 'Txt'] = t.value; re(); });
  $('ldBox').querySelectorAll('[data-ldr]').forEach(b => b.onclick = () => { delete ld[b.dataset.ldr + 'Txt']; re(); });
  const msg = t => { const e = $('ldMsg'); if (e) e.innerHTML = t; };
  $('ldKp').onclick = async () => { const f = await pickImages(false); if (!f.length) return; try { ld.kp = await imgToData(f[0], 2200); re(); } catch (e) { alert(e.message); } };
  $('ldDgu').onclick = async () => { const f = await pickImages(true); if (!f.length) return; try { ld.dgu = []; for (const x of f.slice(0, 4)) ld.dgu.push(await imgToData(x, 2200)); re(); } catch (e) { alert(e.message); } };
  $('ldFoto').onclick = async () => { const f = await pickImages(true); if (!f.length) return; try { ld.foto = ld.foto || []; for (const x of f) ld.foto.push(await imgToData(x, 1600)); re(); } catch (e) { alert(e.message); } };
  if ($('ldFotoX')) $('ldFotoX').onclick = () => { ld.foto = []; re(); };
  const base = String((window.IzmjeraApp && IzmjeraApp.projectName()) || 'izmjera').replace(/[^a-z0-9čćžšđ_-]+/gi, '_');
  $('ldSnimka').onclick = async () => { const t = await ldTplGet('snimka'); if (!t) { alert('Prvo učitaj svoj Excel predložak snimke (gumb „Predložak snimke”).'); return; } msg('Slažem snimku…');
    try { const r = await IzmjeraLegalDoc.fillSnimka(t.bytes, ldData(legCalc(), true).d); EX.saveBytes(r.bytes, 'Snimka_izvedenog_stanja_' + base + '.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); msg('✓ Snimka je spremljena.' + (r.warn.length ? '<br><span style="color:#b45309">' + r.warn.map(esc).join('<br>') + '</span>' : '')); } catch (e) { msg(''); alert('Snimka nije složena: ' + (e.message || e)); } };
  $('ldIzjava').onclick = async () => { const t = await ldTplGet('izjava'); if (!t) { alert('Prvo učitaj svoj Word predložak izjave (gumb „Predložak izjave”).'); return; } msg('Slažem izjavu…');
    try { const r = await IzmjeraLegalDoc.fillIzjava(t.bytes, ldData(legCalc()).d); EX.saveBytes(r.bytes, 'Izjava_' + base + '.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'); msg('✓ Izjava je spremljena.' + (r.warn.length ? '<br><span style="color:#b45309">' + r.warn.map(esc).join('<br>') + '</span>' : '')); } catch (e) { msg(''); alert('Izjava nije složena: ' + (e.message || e)); } };
}
function legMeta0() { return { gradjevina: (window.projectInfo || {}).gradjevina || '' }; }
function legMeta() { const D0 = ldData(legCalc()).d; return { gradjevina: (window.projectInfo || {}).gradjevina || '', listG: D0.listGbp, listV: D0.listVol }; }
/* ---------- 9. Legalizacija: GBP (NN 93/17) i obujam (NN 15/19) ---------- */
function legCalc() { if (S.leg) return S.leg; const inc = procIncluded(); if (!inc.length || !window.IzmjeraLegalizacija) return null; try { S.leg = IzmjeraLegalizacija.compute(inc, P().leg || {}); } catch (e) { S.leg = { err: e.message || String(e) }; } return S.leg; }
function legE() { const e = E(S.fi); return e.leg = e.leg || {}; }
/* v2.64: više zgrada na terenu – zbroj GBP i obujma po zgradama (svaka zgrada pamti svoj zadnji izračun) */
function zgTotals(R) { const Z = window.IzmjeraApp && IzmjeraApp.zg; if (!Z) return null; const L = Z.list(); if (L.length < 2) return null;
  try { P().legSum = { G: R.G, V: R.V, at: Date.now() }; save(); } catch (e) { }
  const cur = Z.cur(); return L.map(b => { const s = b.id === cur ? { G: R.G, V: R.V } : (Z.energyOf(b.id) || {}).legSum; return { name: b.name, s }; }); }
function zgTotalHtml(R, fm) { const T = zgTotals(R); if (!T) return ''; const ok = T.filter(x => x.s), miss = T.filter(x => !x.s), G = ok.reduce((a, x) => a + x.s.G, 0), V = ok.reduce((a, x) => a + x.s.V, 0);
  return '<div class="en-box"><div class="en-box-h">Ukupno na čestici (sve zgrade)</div><table class="en-tab" style="width:100%;font-size:13px"><tr><th style="text-align:left">Zgrada</th><th style="text-align:right">GBP m²</th><th style="text-align:right">Obujam m³</th></tr>' +
    T.map(x => '<tr><td>' + esc(x.name) + '</td>' + (x.s ? '<td style="text-align:right">' + fm(x.s.G / 1e4) + '</td><td style="text-align:right">' + fm(x.s.V / 1e6) + '</td>' : '<td colspan="2" style="text-align:right;color:#b45309">otvori GBP i obujam u toj zgradi</td>') + '</tr>').join('') +
    '<tr style="font-weight:800;background:#dbeafe"><td>Ukupno' + (miss.length ? ' (bez ' + miss.length + ')' : '') + '</td><td style="text-align:right">' + fm(G / 1e4) + '</td><td style="text-align:right">' + fm(V / 1e6) + '</td></tr></table></div>'; }
function tabLegal() {
  const R = legCalc(), LG = window.IzmjeraLegalizacija, fm = LG ? LG.fm : String, pl = P().leg || {};
  let h = '<h3>GBP i obujam</h3><p class="tl-note">Po Pravilniku o izračunu GBP (NN 93/17) i Pravilniku o obujmu za komunalni doprinos (NN 15/19). Visine etaža i krov su iste kao u presjeku (kartica Etaže / Pročelja), pa iskaz odgovara nacrtu.</p>';
  if (!R || R.err) { panel(h + '<p class="tl-note" style="color:#b91c1c">' + esc(R && R.err ? R.err : 'Nema etaža s izrađenim tlocrtom.') + '</p>'); return; }
  h += floorPicker(); const FS = R.floors.filter(f => f.i === S.fi), lg = legE();
  if (!FS.length) { panel(h + '<p class="tl-note">Etaža nije u proračunu.</p>'); bindFloorPicker(); return; }
  const f0 = FS[0], res = S.resAll[S.fi];
  h += '<div class="en-box"><label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="lgPod"' + (f0.pod75 ? ' checked' : '') + '> Etaža je 75 % ili više ispod terena (k = 0,25 garaža, 0,50 pomoćni)</label>';
  if (f0.pod75 && res && !res.err) { h += '<div class="tl-note" style="margin-top:6px">Namjena prostorija za GBP:</div>' + res.rooms.filter(ro => ro.kind !== 'vanjski').map(ro => { const u = (lg.use || {})[ro.key] || LG.defUse(ro.name); return '<div style="display:flex;align-items:center;gap:6px;margin:3px 0"><span style="flex:1">' + esc(ro.name || 'Prostorija') + '</span>' + [['st', 'k = 1'], ['gar', 'Garaža 0,25'], ['pom', 'Pomoćno 0,50']].map(([k, n]) => '<button class="tl-chip' + (u === k ? ' on' : '') + '" data-lgu="' + esc(ro.key) + '" data-v="' + k + '">' + n + '</button>').join('') + '</div>'; }).join(''); }
  h += '</div>';
  if (f0.open.length) h += '<div class="en-box"><div class="en-box-h">Otvoreni dijelovi</div>' + f0.open.map(o => '<div style="display:flex;align-items:center;gap:6px;margin:3px 0"><span style="flex:1">' + esc(o.name) + ' · ' + fm(o.A / 1e4) + ' m²</span><button class="tl-chip' + (o.nat ? ' on' : '') + '" data-lgo="' + esc(o.key) + '" data-v="1">Natkriveno</button><button class="tl-chip' + (!o.nat ? ' on' : '') + '" data-lgo="' + esc(o.key) + '" data-v="0">Nenatkriveno</button></div>').join('') + '<p class="tl-note">Balkone, terase, lođe i nadstrešnice dodaješ u tlocrtu (Ostalo → Terasa / balkon) ili kao prostoriju „Vanjski prostor”. Natkriveni ulaze u obujam do 1,0 m visine, nadstrešnica ispred ulaza tek iznad 6 m².</p></div>';
  for (const f of FS) h += '<div class="en-box"><div class="en-box-h">' + esc(f.name) + '</div><div style="font-weight:700;margin:2px 0">' + esc(LG.gbpLine(f)) + '</div>' + LG.notes(f, 'g').map(t => '<div class="tl-note">– ' + esc(t) + '</div>').join('') + '<div style="font-weight:700;margin:8px 0 2px">' + esc(LG.volLine(f)) + '</div>' + LG.notes(f, 'v').map(t => '<div class="tl-note">– ' + esc(t) + '</div>').join('') + '</div>';
  h += '<div class="en-box"><div class="en-box-h">Zgrada ukupno</div><table class="en-tab" style="width:100%;font-size:13px"><tr><th style="text-align:left">Etaža</th><th style="text-align:right">GBP m²</th><th style="text-align:right">Obujam m³</th></tr>' + R.floors.map(f => '<tr><td>' + esc(f.name) + '</td><td style="text-align:right">' + fm(f.G / 1e4) + '</td><td style="text-align:right">' + fm(f.V / 1e6) + '</td></tr>').join('') + '<tr style="font-weight:800"><td>Ukupno</td><td style="text-align:right">' + fm(R.G / 1e4) + '</td><td style="text-align:right">' + fm(R.V / 1e6) + '</td></tr></table>';
  if (R.floors.some(f => f.tavan) || R.Ls.some(L => L.parts.some(p => p.up === 'tavan'))) h += '<label style="display:flex;gap:8px;align-items:center;margin-top:6px"><input type="checkbox" id="lgTv"' + (pl.tavan !== false ? ' checked' : '') + '> Tavan je zatvoreni dio zgrade (ulazi u obujam)</label><label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="lgTvG"' + (pl.tavanGbp !== false ? ' checked' : '') + '> Tavan visine ≥ 2,0 m ulazi i u GBP</label>';
  h += '</div>' + zgTotalHtml(R, fm);
  h += legDocHtml(R);
  h += '<div class="tl-actions"><button class="tl-btn" id="lgPdf">📄 PDF (2 lista A3)</button><button class="tl-btn" id="lgDxf">📐 DXF</button><button class="tl-btn" id="lgTxt">📋 Tekst za opis (2.6)</button></div>';
  panel(h); bindFloorPicker(); legDocBind(R);
  const re = () => { S.leg = null; save(); const sc = $('enPanel').scrollTop; go(9); $('enPanel').scrollTop = sc; };
  $('lgPod').onchange = e => { legE().pod75 = e.target.checked; re(); };
  $('enPanel').querySelectorAll('[data-lgu]').forEach(b => b.onclick = () => { const l = legE(); l.use = l.use || {}; l.use[b.dataset.lgu] = b.dataset.v; re(); });
  $('enPanel').querySelectorAll('[data-lgo]').forEach(b => b.onclick = () => { const l = legE(); l.nat = l.nat || {}; l.nat[b.dataset.lgo] = b.dataset.v === '1'; re(); });
  const tv = $('lgTv'), tg = $('lgTvG'); if (tv) tv.onchange = () => { const p = P(); p.leg = p.leg || {}; p.leg.tavan = tv.checked; re(); }; if (tg) tg.onchange = () => { const p = P(); p.leg = p.leg || {}; p.leg.tavanGbp = tg.checked; re(); };
  const base = fileBase().replace(/_energetski$/, '') + '_GBP_obujam', proj = (window.IzmjeraApp && IzmjeraApp.projectName()) || 'Izmjera';
  $('lgPdf').onclick = () => { try { window.IzmjeraPdf.save(LG.toPdf(legCalc(), legMeta()), base + '.pdf'); } catch (e) { alert('Izvoz nije uspio: ' + (e.message || e)); } };
  $('lgDxf').onclick = () => { try { const txt = LG.toDxf(legCalc(), legMeta()), name = base + '.dxf'; if (window.IzmjeraSpremi && IzmjeraSpremi.autoText(name, 'application/octet-stream', txt)) return; if (window.AndroidApp && AndroidApp.exportText) { AndroidApp.exportText(name, txt); return; } const u = URL.createObjectURL(new Blob([txt], { type: 'application/dxf' })), a = document.createElement('a'); a.href = u; a.download = name; a.click(); } catch (e) { alert('Izvoz nije uspio: ' + (e.message || e)); } };
  $('lgTxt').onclick = () => { const R0 = legCalc(), T0 = zgTotals(R0); let t = LG.opisText(R0); if (T0) { const ok = T0.filter(x => x.s); t += '\nUkupno na čestici:\n' + ok.map(x => '\t' + x.name + ':\tGBP ' + fm(x.s.G / 1e4) + ' m²,\tobujam ' + fm(x.s.V / 1e6) + ' m³').join('\n') + '\n\tukupno:\tGBP ' + fm(ok.reduce((a, x) => a + x.s.G, 0) / 1e4) + ' m²,\tobujam ' + fm(ok.reduce((a, x) => a + x.s.V, 0) / 1e6) + ' m³\n'; } const done = () => toastEn('Tekst je kopiran – zalijepi ga u tehnički opis.'); try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, () => fallback()); else fallback(); } catch (e) { fallback(); }
    function fallback() { const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (e) { alert(t); } ta.remove(); } };
}
function toastEn(t) { const p = $('enPop'); if (!p) { alert(t); return; } p.innerHTML = '<div class="tl-pop-head"><b>' + esc(t) + '</b><button class="tl-btn" id="enPx">✕</button></div>'; p.hidden = false; $('enPx').onclick = hidePop; setTimeout(() => { if (p.innerHTML.includes(t)) hidePop(); }, 3000); }
function drawLeg(cx, res) {
  const R = legCalc(); if (!R || R.err) return false; const f = R.floors.find(x => x.i === S.fi && !x.tavan); if (!f) return false; const { xs, ys, nx, ny } = f.grid;
  const COLZ = ['#dbeafe', '#fde68a', '#fed7aa', '#e2e8f0', '#e2e8f0'];
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) { const c = i * ny + j, t = res.T[c], z = f.labG[c]; let col = z >= 0 ? COLZ[z] : t === -2 ? null : null; if (!col) continue; const a = tr({ x: xs[i], y: ys[j] }), q = tr({ x: xs[i + 1], y: ys[j + 1] }); cx.fillStyle = col; cx.fillRect(a.x, a.y, q.x - a.x + 0.6, q.y - a.y + 0.6); }
  cx.fillStyle = '#dbeafe'; for (const p of f.piecesG) { cx.beginPath(); p.poly.forEach((v, n) => { const q = tr(v); n ? cx.lineTo(q.x, q.y) : cx.moveTo(q.x, q.y); }); cx.closePath(); cx.fill(); }
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) if (res.T[i * ny + j] === -2 && f.labG[i * ny + j] >= 0) { const a = tr({ x: xs[i], y: ys[j] }), q = tr({ x: xs[i + 1], y: ys[j + 1] }); cx.fillStyle = 'rgba(15,42,74,.35)'; cx.fillRect(a.x, a.y, q.x - a.x + 0.6, q.y - a.y + 0.6); }
  for (const o of f.open) { cx.fillStyle = o.nat ? 'rgba(234,88,12,.25)' : 'rgba(100,116,139,.15)'; cx.strokeStyle = o.nat ? '#ea580c' : '#64748b'; cx.setLineDash([6, 4]); cx.lineWidth = 2; for (const p of o.pcs) { cx.beginPath(); p.forEach((v, n) => { const q = tr(v); n ? cx.lineTo(q.x, q.y) : cx.moveTo(q.x, q.y); }); cx.closePath(); cx.fill(); cx.stroke(); } cx.setLineDash([]); }
  cx.strokeStyle = '#dc2626'; cx.lineWidth = 2.5; cx.setLineDash([8, 5]); for (const [a0, b0] of f.cutsG) { const a = tr(a0), b = tr(b0); cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(b.x, b.y); cx.stroke(); } cx.setLineDash([]);
  cx.textAlign = 'center'; for (const ro of res.rooms) { const p = tr(ro.center); cx.fillStyle = '#102b52'; cx.font = 'bold 12px Arial'; cx.fillText(ro.name || '', p.x, p.y - 4); } cx.textAlign = 'start';
  $('enLegend').innerHTML = '<span style="background:#dbeafe"></span>zatvoreno k=1 <span style="background:#fde68a"></span>garaža 0,25 <span style="background:#fed7aa"></span>pomoćno 0,50 <span style="background:#e2e8f0"></span>h < 2,0 m <span style="background:#fdba74"></span>otvoreno natkriveno <span style="background:#dc2626"></span>granica h = 2,0 m';
  return true;
}
/* ---------- 7. Pročelja ---------- */
function procIncluded() { return floors().map((f, i) => ({ i, name: f.name || 'Etaža ' + (i + 1), E: E(i), res: S.resAll && S.resAll[i], out: S.built[i] && S.built[i].out })).filter(x => x.res && !x.res.err); }
function PP() { const p = P(); p.procelja = p.procelja || {}; p.procelja.teren = p.procelja.teren || {}; return p.procelja; }
function procBuild() { if (S.proc) return S.proc; const inc = procIncluded(); if (!inc.length || !window.IzmjeraProcelja) return null; try { S.proc = IzmjeraProcelja.build(inc, PP(), northOf(inc[0].i).v); } catch (e) { S.proc = { err: e.message || String(e) }; } return S.proc; }
function tabProcelja() {
  const R = procBuild(), pp = PP();
  let h = '<h3>Pročelja</h3>';
  if (!R || R.err || !R.views.length) { panel(h + '<p class="tl-note" style="color:#b91c1c">' + esc(R && R.err ? R.err : 'Nema etaža s izrađenim tlocrtom.') + '</p>'); return; }
  if (!R.views.some(v => v.key === S.pv)) S.pv = R.views[0].key;
  if (S.cutPick) { panel(h + '<div class="en-box"><div class="en-box-h">Crta presjeka</div><p class="tl-note">Na tlocrtu (' + esc(procIncluded()[0].name) + ') dodirni <b>' + (S.cutPick.pts.length ? 'drugi' : 'prvi') + '</b> kraj crte presjeka. Crta se izravna vodoravno ili okomito.</p><button class="tl-btn" id="prCutX">Odustani</button></div>'); $('prCutX').onclick = () => { S.cutPick = null; S.view = null; go(7); }; return; }
  h += '<div class="tl-chips">' + R.views.map(v => '<button class="tl-chip' + (v.key === S.pv ? ' on' : '') + '" data-pv="' + v.key + '">' + esc(v.section ? 'Presjek ' + v.strana : v.strana) + '</button>').join('') + '<button class="tl-chip" id="prCutAdd">＋ Presjek</button></div>';
  const v = R.views.find(x => x.key === S.pv), tv = pp.teren[v.key] || {};
  if (v.section) { const ci = +v.key.replace('presjek', '');
    h += '<div class="en-box"><div class="en-box-h">Presjek ' + esc(v.strana) + '</div><p class="tl-note">Presijecaju se zidovi (šrafura), ploče, otvori i krov. Visine prostorija (pod, visina, galerija) su u kartici Prostorije. Stubište: profil kad crta ide uzduž kraka (s otvorom u ploči iznad), presječena stuba kad ide poprijeko.</p><div class="tl-actions"><button class="tl-btn" id="prCutFlip">⇅ Gledaj na drugu stranu</button><button class="tl-btn" id="prCutMove">✎ Pomakni crtu</button><button class="tl-btn" id="prCutDel">✕ Obriši</button></div></div>';
    const MT = IzmjeraProcelja.MATS, zm = pp.zidMat, zs = Array.isArray(pp.zidSl) ? pp.zidSl : [];
    h += '<div class="en-box"' + (zm ? '' : ' style="border-color:#f59e0b;background:#fffbeb"') + '><div class="en-box-h">' + (zm ? 'Zidovi u presjeku' : '❓ Od čega su zidovi?') + '</div><div class="tl-chips">' + MT.filter(m => ['nema', 'opeka', 'ab', 'beton', 'kamen'].includes(m[0])).map(([k2, n2]) => '<button class="tl-chip' + (k2 === zm ? ' on' : '') + '" data-zm="' + k2 + '">' + esc(n2) + '</button>').join('') + '</div>' +
      '<p class="tl-note">Stropne ploče su armirani beton; kad su u Etaže → Konstrukcija iznad upisani slojevi, crta se svaki sloj (AB ploča šrafirano).</p>' +
      '<div class="tl-field" style="margin-top:6px">Slojevi vanjskog zida (izvana prema unutra) – nije obavezno</div>' +
      zs.map((l, i) => '<div style="display:flex;gap:6px;align-items:center;margin:4px 0"><input data-zs="' + i + '" data-f="n" value="' + esc(l.n || '') + '" placeholder="naziv" style="flex:2;min-width:0"><input data-zs="' + i + '" data-f="d" inputmode="decimal" value="' + esc(l.d != null ? String(l.d).replace('.', ',') : '') + '" placeholder="ostatak" style="width:76px"><select class="en-sel" data-zs="' + i + '" data-f="mat" style="width:auto">' + MT.map(([k2, n2]) => '<option value="' + k2 + '"' + ((l.mat || 'nema') === k2 ? ' selected' : '') + '>' + esc(n2) + '</option>').join('') + '</select><button class="tl-btn" data-zsdel="' + i + '">✕</button></div>').join('') +
      '<div class="tl-actions"><button class="tl-btn" id="prZsAdd">＋ Sloj</button>' + (zs.length ? '' : '<button class="tl-btn" id="prZsEx">Primjer: žbuka 2 + EPS 10 + opeka (ostatak) + žbuka 2</button>') + '</div>' +
      '<p class="tl-note">Sloj s praznom debljinom dobije ostatak, tako da je zbroj uvijek jednak debljini zida iz tlocrta. Slojevi se crtaju samo na vanjskim zidovima; unutarnji zidovi imaju materijal odozgo.</p></div>';
    h += '<div class="tl-actions"><button class="tl-btn primary" id="prDxf">⬇ DXF (pročelja i presjeci)</button><button class="tl-btn primary" id="prPdf">⬇ PDF</button></div>';
    panel(h); bindViewChips();
    const zRe = () => { S.proc = null; save(); const sc = $('enPanel').scrollTop; go(7); $('enPanel').scrollTop = sc; };
    $('enPanel').querySelectorAll('[data-zm]').forEach(b2 => b2.onclick = () => { PP().zidMat = b2.dataset.zm; zRe(); });
    $('enPanel').querySelectorAll('[data-zs]').forEach(el => el.onchange = () => { const L2 = PP().zidSl, r2 = L2[+el.dataset.zs], f2 = el.dataset.f; r2[f2] = f2 === 'd' ? (String(el.value).trim() === '' ? null : num(el.value, null)) : el.value; zRe(); });
    $('enPanel').querySelectorAll('[data-zsdel]').forEach(b2 => b2.onclick = () => { PP().zidSl.splice(+b2.dataset.zsdel, 1); zRe(); });
    $('prZsAdd').onclick = () => { const p2 = PP(); p2.zidSl = Array.isArray(p2.zidSl) ? p2.zidSl : []; p2.zidSl.push({ n: '', d: null, mat: 'opeka' }); zRe(); };
    if ($('prZsEx')) $('prZsEx').onclick = () => { PP().zidSl = [{ n: 'žbuka', d: 2, mat: 'zbuka' }, { n: 'opeka', d: null, mat: zm && zm !== 'nema' ? zm : 'opeka' }, { n: 'EPS', d: 10, mat: 'izol' }, { n: 'žbuka', d: 2, mat: 'zbuka' }].reverse(); zRe(); };
    $('prCutFlip').onclick = () => { const c = PP().presjeci[ci]; c.look = -(c.look || 1); S.proc = null; S.view = null; save(); go(7); };
    $('prCutMove').onclick = () => { S.cutPick = { idx: ci, pts: [] }; S.fi = procIncluded()[0].i; S.view = null; go(7); };
    $('prCutDel').onclick = () => { PP().presjeci.splice(ci, 1); S.proc = null; S.pv = 'dolje'; save(); go(7); };
    bindExports(); return; }
  h += '<div class="en-box"><div class="en-box-h">Teren uz pročelje ' + esc(v.strana) + '</div><p class="tl-note">Koliko je pod najniže etaže (±0,00) iznad terena, gledano na pročelje: lijevi i desni kraj.</p><div class="en-grid">' +
    '<label class="tl-field">Lijevo (cm)<input data-tv="l" inputmode="decimal" value="' + esc(tv.l != null ? tv.l : '') + '" placeholder="' + esc(pp.terenDef != null ? pp.terenDef : 15) + '"></label><label class="tl-field">Desno (cm)<input data-tv="r" inputmode="decimal" value="' + esc(tv.r != null ? tv.r : '') + '" placeholder="kao lijevo"></label></div></div>';
  h += '<div class="en-box"><div class="en-box-h">Zadano</div><div class="en-grid">' + fNum('P', 'procelja.terenDef', 'Pod iznad terena (ulaz)', '15', 'cm') + fNum('P', 'procelja.stok', 'Debljina štoka u pogledu', '6', 'cm') + '</div></div>';
  h += fotoHtml(v) + opSelHtml(v);
  const ops = R.views.reduce((a, x) => a + x.openings.length, 0), est = procIncluded().reduce((a, F) => a + F.res.ops.filter(o => o.hEst || o.pEst).length, 0);
  h += '<p class="tl-note">Visine etaža i krov uzimaju se iz kartice Etaže (Iznad etaže je: kosi krov / tavan s krovom / ravni krov). Otvori: visina, parapet i krila iz kartice Otvori' + (est ? ' – <b style="color:#b45309">' + est + ' otvora ima procijenjenu visinu ili parapet</b>' : '') + '.</p>';
  h += '<p class="tl-note">Prikazano: ' + R.views.length + ' pročelja, ' + ops + ' otvora. Krov se računa nad pravokutnikom etaže; garažu ili ulaz s drugim krovom dodaj u kartici Etaže → Dijelovi etaže. Debljinu krova (rog i slojevi) upiši u Etaže → Sastav krova.</p>';
  h += '<div class="tl-actions"><button class="tl-btn primary" id="prDxf">⬇ DXF (sva pročelja)</button><button class="tl-btn primary" id="prPdf">⬇ PDF</button></div>';
  panel(h); bindViewChips();
  $('enPanel').querySelectorAll('[data-tv]').forEach(inp => inp.onchange = () => { const t = PP().teren[S.pv] = PP().teren[S.pv] || {}; const v2 = num(inp.value, null); if (v2 == null) delete t[inp.dataset.tv]; else t[inp.dataset.tv] = v2; S.proc = null; save(); draw(); });
  bindFields(); $('enPanel').querySelectorAll('[data-path^="procelja."]').forEach(el => el.addEventListener('change', () => { S.proc = null; draw(); }));
  bindFoto(v); bindOpSel(v);
  bindExports();
}
/* ---------- v1.36: fotografija pročelja kao podloga ---------- */
function FO() { const pp = PP(); pp.foto = pp.foto || {}; return pp.foto; }
function fotoHtml(v) {
  const f = FO()[v.key];
  let h = '<div class="en-box"><div class="en-box-h">📷 Fotografija pročelja ' + esc(v.strana) + '</div>';
  if (!f || !f.id) return h + '<p class="tl-note">Slikaj pročelje što ravnije (cijelo, s uglovima zgrade). Zatim označiš 4 kuta zida i slika se izravna ispod crteža – onda dodirom na otvor povlačiš njegov gornji/donji rub do slike (visina i parapet).</p><div class="tl-actions"><button class="tl-btn" data-fnew="camera">📷 Kamera</button><button class="tl-btn" data-fnew="gallery">🖼 Galerija</button></div></div>';
  return h + '<label class="tl-check"><input type="checkbox" id="fOn"' + (f.on !== false ? ' checked' : '') + '> Prikaži sliku ispod crteža</label>' +
    '<label class="tl-field">Prozirnost slike<input type="range" id="fOp" min="15" max="100" value="' + Math.round((f.op || 0.55) * 100) + '"></label>' +
    (f.pts ? '' : '<p class="tl-note" style="color:#b45309">Još nisu označeni kutovi zida.</p>') +
    '<div class="tl-actions"><button class="tl-btn" id="fCal">⌖ Označi kutove</button><button class="tl-btn" data-fnew="camera">📷 Nova</button><button class="tl-btn" data-fnew="gallery">🖼</button><button class="tl-btn" id="fDel">✕</button></div>' +
    '<p class="tl-note">Dodirni otvor na crtežu pa povuci njegov gornji ili donji rub do slike.</p></div>';
}
function bindFoto(v) {
  $('enPanel').querySelectorAll('[data-fnew]').forEach(b => b.onclick = () => pickFoto(b.dataset.fnew, id => { FO()[v.key] = { id, on: true, op: 0.55 }; save(); S.fRect = null; calibrate(v); }));
  if ($('fOn')) $('fOn').onchange = e => { FO()[v.key].on = e.target.checked; save(); draw(); };
  if ($('fOp')) $('fOp').oninput = e => { FO()[v.key].op = +e.target.value / 100; draw(); }; if ($('fOp')) $('fOp').onchange = () => save();
  if ($('fCal')) $('fCal').onclick = () => calibrate(v);
  if ($('fDel')) $('fDel').onclick = () => { if (!confirm('Ukloniti fotografiju s ovog pročelja?')) return; delete FO()[v.key]; S.fRect = null; save(); go(7); };
}
function pickFoto(mode, cb) {
  const id = 'pr' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  if (window.AndroidApp && window.AndroidApp.takePhoto && window.IzmjeraFoto) { window.IzmjeraFoto.pending = { id, cb: () => cb(id) }; window.AndroidApp.takePhoto(id, mode); return; }
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; if (mode === 'camera') inp.setAttribute('capture', 'environment');
  inp.onchange = async () => { const f = inp.files && inp.files[0]; if (!f) return; try { const d = await window.IzmjeraPdf.imageToJpeg(f); try { localStorage.setItem('izmjera-foto-' + id, d); } catch (e) { S.fMem = S.fMem || {}; S.fMem[id] = d; } cb(id); } catch (e) { alert(e.message || e); } }; inp.click();
}
function fotoData(id) { if (S.fMem && S.fMem[id]) return S.fMem[id]; try { if (window.IzmjeraFoto) { const d = window.IzmjeraFoto.get(id); if (d) return d; } } catch (e) { } try { return localStorage.getItem('izmjera-foto-' + id); } catch (e) { return null; } }
function fmtZ(z) { const v = Math.round(z) / 100; return (Math.abs(v) < 0.005 ? '±0,00' : (v > 0 ? '+' : '') + v.toFixed(2).replace('.', ',')); }
/* označavanje 4 kuta zida na slici (lupa dok se vuče) */
function calibrate(v) {
  const f = FO()[v.key]; if (!f) return; const data = fotoData(f.id); if (!data) { alert('Slika nije pronađena na ovom uređaju.'); return; }
  const rf = v.ref, d = document.createElement('div'); d.style.cssText = 'position:fixed;inset:0;z-index:90;background:#0f172a;display:flex;flex-direction:column';
  const names = ['1 lijevi donji kut zida (uz teren, ' + fmtZ(rf.zb0) + ')', '2 desni donji kut (' + fmtZ(rf.zb1) + ')', '3 desni gornji kut zida, ispod strehe (' + fmtZ(rf.zt1) + ')', '4 lijevi gornji kut zida (' + fmtZ(rf.zt0) + ')'];
  d.innerHTML = '<div style="padding:8px 12px;color:#fff;font:14px Arial;display:flex;gap:10px;align-items:center;flex-wrap:wrap"><b>Označi kutove zida – pročelje ' + esc(v.strana) + '</b><span style="color:#cbd5e1">Povuci brojeve na kutove zida (gledano prema pročelju). ' + names.join(' · ') + '</span><span style="flex:1"></span><button class="tl-btn" id="fcOk">✓ Gotovo</button><button class="tl-btn" id="fcX">Odustani</button></div><div id="fcWrap" style="position:relative;flex:1 1 auto;min-height:200px;width:100%;overflow:hidden;touch-action:none"><img id="fcImg" style="position:absolute;left:0;top:0;user-select:none;-webkit-user-drag:none" draggable="false"><svg id="fcSvg" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none"></svg><canvas id="fcLoupe" width="160" height="160" style="position:absolute;display:none;width:160px;height:160px;border:3px solid #f97316;border-radius:50%;pointer-events:none;background:#000"></canvas></div>';
  document.body.appendChild(d);
  const img = d.querySelector('#fcImg'), wrap = d.querySelector('#fcWrap'), svg = d.querySelector('#fcSvg'), lp = d.querySelector('#fcLoupe');
  let k = 1, ox = 0, oy = 0, pts = null; const hs = [];
  img.onload = () => {
    const W = wrap.clientWidth, H = wrap.clientHeight, iw = img.naturalWidth, ih = img.naturalHeight; k = Math.min(W / iw, H / ih) * 0.96; ox = (W - iw * k) / 2; oy = (H - ih * k) / 2;
    img.style.width = iw * k + 'px'; img.style.height = ih * k + 'px'; img.style.left = ox + 'px'; img.style.top = oy + 'px';
    pts = f.pts ? f.pts.map(p => p.slice()) : [[iw * 0.15, ih * 0.85], [iw * 0.85, ih * 0.85], [iw * 0.85, ih * 0.25], [iw * 0.15, ih * 0.25]];
    for (let i = 0; i < 4; i++) { const hd = document.createElement('div'); hd.textContent = String(i + 1); hd.style.cssText = 'position:absolute;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;border:3px solid #f97316;background:rgba(249,115,22,.25);color:#fff;font:bold 16px Arial;display:flex;align-items:center;justify-content:center;touch-action:none;cursor:move';
      hd.onpointerdown = e => { e.preventDefault(); hd.setPointerCapture(e.pointerId); const sx = e.clientX, sy = e.clientY, p0 = pts[i].slice();
        hd.onpointermove = ev => { pts[i] = [Math.max(0, Math.min(iw, p0[0] + (ev.clientX - sx) / k)), Math.max(0, Math.min(ih, p0[1] + (ev.clientY - sy) / k))]; place(); loupe(i); };
        hd.onpointerup = hd.onpointercancel = () => { hd.onpointermove = null; lp.style.display = 'none'; }; };
      wrap.appendChild(hd); hs.push(hd); }
    place();
  };
  function place() { hs.forEach((hd, i) => { hd.style.left = ox + pts[i][0] * k + 'px'; hd.style.top = oy + pts[i][1] * k + 'px'; });
    svg.innerHTML = '<polygon points="' + pts.map(p => (ox + p[0] * k) + ',' + (oy + p[1] * k)).join(' ') + '" fill="rgba(249,115,22,.12)" stroke="#f97316" stroke-width="2"/>'; }
  function loupe(i) { const c = lp.getContext('2d'), z = 3, sx = pts[i][0], sy = pts[i][1]; c.clearRect(0, 0, 160, 160); c.save(); c.beginPath(); c.arc(80, 80, 80, 0, 7); c.clip(); c.drawImage(img, sx - 80 / (z * k) * k / k / 1, sy - 80 / (z * k), 160 / (z * k), 160 / (z * k), 0, 0, 160, 160); c.restore(); c.strokeStyle = '#f97316'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(80, 60); c.lineTo(80, 100); c.moveTo(60, 80); c.lineTo(100, 80); c.stroke();
    const px = ox + sx * k, py = oy + sy * k; lp.style.display = 'block'; lp.style.left = Math.max(4, Math.min(wrap.clientWidth - 164, px - 80)) + 'px'; lp.style.top = (py - 260 > 4 ? py - 260 : py + 80) + 'px'; }
  d.querySelector('#fcX').onclick = () => d.remove();
  d.querySelector('#fcOk').onclick = () => { f.pts = pts.map(p => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10]); f.on = true; S.fRect = null; save(); d.remove(); S.view = null; go(7); };
  img.src = data;
}
/* homografija: 4 para točaka (a → b) */
function homog(a, b) {
  const A = [], B = []; for (let i = 0; i < 4; i++) { const [x, y] = a[i], [X, Y] = b[i]; A.push([x, y, 1, 0, 0, 0, -X * x, -X * y]); B.push(X); A.push([0, 0, 0, x, y, 1, -Y * x, -Y * y]); B.push(Y); }
  for (let c = 0; c < 8; c++) { let m = c; for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[m][c])) m = r; [A[c], A[m]] = [A[m], A[c]]; [B[c], B[m]] = [B[m], B[c]]; const pv = A[c][c] || 1e-12;
    for (let r = 0; r < 8; r++) if (r !== c) { const fct = A[r][c] / pv; if (!fct) continue; for (let q = c; q < 8; q++) A[r][q] -= fct * A[c][q]; B[r] -= fct * B[c]; } }
  const h = B.map((v, i) => v / A[i][i]); return (x, y) => { const w = h[6] * x + h[7] * y + 1; return [(h[0] * x + h[1] * y + h[2]) / w, (h[3] * x + h[4] * y + h[5]) / w]; };
}
/* izravnana slika za pogled (u cm koordinatama pogleda) */
function fotoRect(v) {
  const f = FO()[v.key]; if (!f || !f.id || !f.pts || f.on === false) return null; const rf = v.ref, key = f.id + JSON.stringify(f.pts) + JSON.stringify(rf);
  if (S.fRect && S.fRect.k === key) return S.fRect.ready ? S.fRect : null;
  const data = fotoData(f.id); if (!data) return null; S.fRect = { k: key, ready: false };
  const im = new Image(); im.onload = () => { if (!S.fRect || S.fRect.k !== key) return;
    const H = homog([[rf.u0, rf.zb0], [rf.u1, rf.zb1], [rf.u1, rf.zt1], [rf.u0, rf.zt0]], f.pts), bx = { u0: rf.u0 - 200, u1: rf.u1 + 200, z0: Math.min(rf.zb0, rf.zb1) - 80, z1: Math.max(rf.zmax || 0, rf.zt0, rf.zt1) + 120 };
    const ppc = Math.min(2, 2200 / (bx.u1 - bx.u0)), W = Math.max(1, Math.round((bx.u1 - bx.u0) * ppc)), Hh = Math.max(1, Math.round((bx.z1 - bx.z0) * ppc));
    const sc = document.createElement('canvas'); sc.width = im.naturalWidth; sc.height = im.naturalHeight; const sg = sc.getContext('2d'); sg.drawImage(im, 0, 0); const src = sg.getImageData(0, 0, sc.width, sc.height).data, iw = sc.width, ih = sc.height;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = Hh; const g = cv.getContext('2d'), out = g.createImageData(W, Hh), od = out.data;
    for (let j = 0; j < Hh; j++) { const z = bx.z1 - (j + 0.5) / ppc; for (let i = 0; i < W; i++) { const u = bx.u0 + (i + 0.5) / ppc, [x, y] = H(u, z), xi = x | 0, yi = y | 0; if (x < 0 || y < 0 || xi >= iw || yi >= ih) continue; const si = (yi * iw + xi) * 4, di = (j * W + i) * 4; od[di] = src[si]; od[di + 1] = src[si + 1]; od[di + 2] = src[si + 2]; od[di + 3] = 255; } }
    g.putImageData(out, 0, 0); S.fRect = { k: key, ready: true, cv, bx }; draw(); };
  im.src = data; return null;
}
/* odabrani otvor: visina i parapet */
function opSelHtml(v) {
  const g = S.opSel && (v.opGeom || []).find(o => o.key === S.opSel); if (!g) return '';
  const h = Math.round(g.z1 - g.z0), p = Math.round(g.z0 - g.zf);
  return '<div class="en-box" style="border-color:#f97316"><div class="en-box-h">' + (g.win ? 'Prozor' : 'Vrata') + ' ' + Math.round(g.w) + ' cm</div><div class="en-grid"><label class="tl-field">Visina (cm)<input id="osH" inputmode="decimal" value="' + h + '"></label>' + (g.win ? '<label class="tl-field">Parapet (cm)<input id="osP" inputmode="decimal" value="' + p + '"></label>' : '') + '</div><p class="tl-note">Povuci gornji' + (g.win ? ' ili donji' : '') + ' rub otvora na crtežu (narančaste crtice).</p><button class="tl-btn" id="osX">Gotovo</button></div>';
}
function setOp(g, h, p) { const e = E(g.fi); e.otvori = e.otvori || {}; const o = e.otvori[g.key] = e.otvori[g.key] || {}; if (h != null) o.h = Math.max(20, Math.round(h)); if (g.win && p != null) o.p = Math.max(0, Math.round(p)); S.proc = null; S.res = null; refresh(); save(); }
function bindOpSel(v) {
  const g = S.opSel && (v.opGeom || []).find(o => o.key === S.opSel); if (!g) return;
  $('osH').onchange = e => { setOp(g, num(e.target.value, null), null); go(7); };
  if ($('osP')) $('osP').onchange = e => { setOp(g, null, num(e.target.value, null)); go(7); };
  $('osX').onclick = () => { S.opSel = null; go(7); };
}
function bindViewChips() {
  $('enPanel').querySelectorAll('[data-pv]').forEach(b => b.onclick = () => { S.pv = b.dataset.pv; S.view = null; go(7); });
  if ($('prCutAdd')) $('prCutAdd').onclick = () => { PP().presjeci = PP().presjeci || []; S.cutPick = { idx: PP().presjeci.length, pts: [] }; S.fi = procIncluded()[0].i; S.view = null; go(7); };
}
function bindExports() {
  const base = fileBase().replace(/_energetski$/, '') + '_procelja';
  $('prDxf').onclick = () => { try { const txt = IzmjeraProcelja.toDxf(procBuild()), name = base + '.dxf'; if (window.IzmjeraSpremi && IzmjeraSpremi.autoText(name, 'application/octet-stream', txt)) return; if (window.AndroidApp && AndroidApp.exportText) { AndroidApp.exportText(name, txt); return; } const u = URL.createObjectURL(new Blob([txt], { type: 'application/dxf' })), a = document.createElement('a'); a.href = u; a.download = name; a.click(); } catch (e) { alert('Izvoz nije uspio: ' + (e.message || e)); } };
  $('prPdf').onclick = () => { try { const by = IzmjeraProcelja.toPdf(procBuild(), { project: (window.IzmjeraApp && IzmjeraApp.projectName()) || 'Izmjera', title: 'Pročelja' }); window.IzmjeraPdf.save(by, base + '.pdf'); } catch (e) { alert('Izvoz nije uspio: ' + (e.message || e)); } };
}
function drawProcelja(cx, r) {
  const R = procBuild(); if (!R || R.err) return; const v = R.views.find(x => x.key === S.pv) || R.views[0]; if (!v) return;
  const b = v.bbox; if (!S.view) { const s0 = Math.min((r.width - 40) / (b.u1 - b.u0), (r.height - 40) / (b.z1 - b.z0)); S.view = { s: s0, ox: r.width / 2 - (b.u0 + b.u1) / 2 * s0, oy: r.height / 2 + (b.z0 + b.z1) / 2 * s0 }; }
  const sc = S.view.s, ox = S.view.ox, oy = S.view.oy;
  if (!v.section) { const fr = fotoRect(v), f = FO()[v.key]; if (fr) { cx.save(); cx.globalAlpha = f.op || 0.55; cx.drawImage(fr.cv, ox + fr.bx.u0 * sc, oy - fr.bx.z1 * sc, (fr.bx.u1 - fr.bx.u0) * sc, (fr.bx.z1 - fr.bx.z0) * sc); cx.restore(); } }
  const C2 = { OBRIS: ['#111827', 2], OTVORI: ['#0891b2', 1.2], KROV: ['#b91c1c', 1.6], TEREN: ['#6b7280', 1], KOTE: ['#2563eb', 1], REZ: ['#111827', 2.4], SRAF: ['#94a3b8', 0.6] };
  for (const [a, q, lay] of v.lines) { const cc = C2[lay] || ['#111827', 1]; cx.strokeStyle = cc[0]; cx.lineWidth = cc[1]; cx.beginPath(); cx.moveTo(ox + a[0] * sc, oy - a[1] * sc); cx.lineTo(ox + q[0] * sc, oy - q[1] * sc); cx.stroke(); }
  for (const t of v.texts) { cx.fillStyle = t.lay === 'KOTE' ? '#2563eb' : '#111827'; cx.font = (t.lay === 'NASLOV' ? 'bold ' : '') + Math.max(10, t.h * sc) + 'px Arial'; cx.textAlign = t.al === 'l' ? 'left' : t.al === 'r' ? 'right' : 'center'; cx.fillText(t.t, ox + t.u * sc, oy - t.z * sc); }
  cx.textAlign = 'start';
  const g = S.opSel && (v.opGeom || []).find(o => o.key === S.opSel);
  if (g) { const d = S.edgeDrag, z0 = d && d.edge === 'b' ? d.z : g.z0, z1 = d && d.edge === 't' ? d.z : g.z1, X0 = ox + g.u0 * sc, X1 = ox + g.u1 * sc, Y0 = oy - z0 * sc, Y1 = oy - z1 * sc;
    cx.strokeStyle = '#f97316'; cx.lineWidth = 2.5; cx.strokeRect(X0, Y1, X1 - X0, Y0 - Y1); cx.lineWidth = 6; cx.beginPath(); cx.moveTo(X0 - 10, Y1); cx.lineTo(X1 + 10, Y1); if (g.win) { cx.moveTo(X0 - 10, Y0); cx.lineTo(X1 + 10, Y0); } cx.stroke();
    cx.fillStyle = '#c2410c'; cx.font = 'bold 13px Arial'; cx.fillText('h ' + Math.round(z1 - z0) + (g.win ? ' · p ' + Math.round(z0 - g.zf) : ''), X1 + 14, (Y0 + Y1) / 2); }
}
function curView() { const R = procBuild(); return R && !R.err ? R.views.find(x => x.key === S.pv) || R.views[0] : null; }

/* ---------- crtež ---------- */
const COL = { zid_vanjski: '#dc2626', zid_tlo: '#92400e', zid_susjed_g: '#6b7280', zid_susjed_n: '#9ca3af', zid_negrijano: '#ea580c', zid_stubiste: '#ea580c', zid_garaza: '#ea580c' };
const ROOMCOL = { grijano: '#fde7c7', vanjski: null };
function tr(p) { return { x: p.x * S.view.s + S.view.ox, y: p.y * S.view.s + S.view.oy }; }
function inv(p) { return { x: (p.x - S.view.ox) / S.view.s, y: (p.y - S.view.oy) / S.view.s }; }
function draw() {
  const cv = $('enCanvas'); if (!cv || !S.open) return; const r = cv.getBoundingClientRect(), d = window.devicePixelRatio || 1;
  cv.width = Math.max(1, Math.round(r.width * d)); cv.height = Math.max(1, Math.round(r.height * d)); const cx = cv.getContext('2d'); cx.setTransform(d, 0, 0, d, 0, 0); cx.fillStyle = '#fff'; cx.fillRect(0, 0, r.width, r.height);
  $('enLegend').innerHTML = '';
  const vk = S.tab === 7 && !S.cutPick ? 'pv:' + S.pv : 'plan:' + S.fi; if (S.viewKind !== vk) { S.view = null; S.viewKind = vk; }
  if (S.tab === 7 && !S.cutPick) { drawProcelja(cx, r); return; }
  const res = (isEnerg() ? S.res : S.resAll)[S.fi], b = S.built[S.fi];
  if (!b || b.err || !res || res.err) { cx.fillStyle = '#64748b'; cx.font = '16px Arial'; cx.fillText(b && b.err ? b.err : 'Etaža nije u proračunu.', 20, 40); return; }
  const g = res.grid, { xs, ys, nx, ny } = g;
  if (!S.view) { const w = xs[nx] - xs[0], h = ys[ny] - ys[0], s = Math.min((r.width - 60) / w, (r.height - 60) / h); S.view = { s, ox: r.width / 2 - (xs[0] + w / 2) * s, oy: r.height / 2 - (ys[0] + h / 2) * s }; }
  if (S.tab === 9 && drawLeg(cx, res)) return;
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) { const c = i * ny + j, t = res.T[c]; let col = null;
    if (t === -2) col = res.Z[c] ? '#6b4f35' : '#94a3b8'; else if (t >= 0) { const k = res.rooms[t].kind; col = !isEnerg() ? '#f1f5f9' : k === 'grijano' ? '#fde7c7' : k === 'vanjski' ? null : '#dbeafe'; }
    if (!col) continue; const a = tr({ x: xs[i], y: ys[j] }), q = tr({ x: xs[i + 1], y: ys[j + 1] }); cx.fillStyle = col; cx.fillRect(a.x, a.y, q.x - a.x + 0.6, q.y - a.y + 0.6); }
  cx.lineCap = 'round';
  for (const s of res.segs) { const a = tr(s.o === 'H' ? { x: s.s0, y: s.at } : { x: s.at, y: s.s0 }), q = tr(s.o === 'H' ? { x: s.s1, y: s.at } : { x: s.at, y: s.s1 }); if (S.selSeg === s.key) { cx.strokeStyle = 'rgba(14,116,144,.35)'; cx.lineWidth = 16; cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(q.x, q.y); cx.stroke(); } cx.strokeStyle = COL[s.el] || '#ea580c'; cx.lineWidth = 5; cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(q.x, q.y); cx.stroke();
    if (s.Atlo > 0) { cx.strokeStyle = '#92400e'; cx.setLineDash([4, 4]); cx.lineWidth = 9; cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(q.x, q.y); cx.stroke(); cx.setLineDash([]); }
    const m = { x: (a.x + q.x) / 2 + s.nxs * 16, y: (a.y + q.y) / 2 + s.nys * 16 }; cx.fillStyle = COL[s.el] || '#ea580c'; cx.beginPath(); cx.arc(m.x, m.y, 11, 0, 7); cx.fill(); cx.fillStyle = '#fff'; cx.font = 'bold 10px Arial'; cx.textAlign = 'center'; cx.fillText(s.cls === 'ext' ? (s.lab || s.n) + (s.strana === '—' || (s.lab || '').length > 2 ? '' : s.strana) : '', m.x, m.y + 4);
    if (s.part) { const f = s.part.L / s.L, q2 = { x: a.x + (q.x - a.x) * f, y: a.y + (q.y - a.y) * f }; cx.strokeStyle = '#ea580c'; cx.lineWidth = 5; cx.setLineDash([7, 4]); cx.beginPath(); cx.moveTo(a.x + s.nxs * 4, a.y + s.nys * 4); cx.lineTo(q2.x + s.nxs * 4, q2.y + s.nys * 4); cx.stroke(); cx.setLineDash([]); } }
  { const seen = new Set(); for (const sg of res.segs) { const info = sg.cutInfo; if (!info || seen.has(info.pkey)) continue; seen.add(info.pkey); /* v2.50: crtice rezova */
      for (const c of info.cuts) { const P0 = tr(info.o === 'H' ? { x: info.s0 + c.pos, y: info.at } : { x: info.at, y: info.s0 + c.pos }), dx = info.o === 'H' ? 0 : 1, dy = info.o === 'H' ? 1 : 0; cx.strokeStyle = c.on ? '#0d2f5e' : '#94a3b8'; cx.lineWidth = c.on ? 3 : 2; cx.setLineDash(c.on ? [] : [3, 3]); cx.beginPath(); cx.moveTo(P0.x - dx * 12, P0.y - dy * 12); cx.lineTo(P0.x + dx * 12, P0.y + dy * 12); cx.stroke(); cx.setLineDash([]); if (!c.auto) { cx.fillStyle = '#0d2f5e'; cx.beginPath(); cx.arc(P0.x + dx * 12 * (info.nxs || 0) + 0, P0.y + dy * 12 * (info.nys || 0), 3.5, 0, 7); cx.fill(); } } } }
  for (const o of res.ops) { if (o.x == null) continue; const p = tr(o); cx.fillStyle = o.kind === 'prozor' ? '#0891b2' : '#16a34a'; cx.fillRect(p.x - 5, p.y - 5, 10, 10); }
  cx.textAlign = 'center';
  for (const ro of res.rooms) { const p = tr(ro.center); cx.fillStyle = '#102b52'; cx.font = 'bold 12px Arial'; cx.fillText(ro.name || '', p.x, p.y - 4); cx.font = '11px Arial'; cx.fillStyle = ro.kind === 'grijano' ? '#b45309' : '#1d4ed8'; cx.fillText((isEnerg() ? EC.ROOM_NAME[ro.kind] + ' · ' : '') + m2(ro.area) + ' m²', p.x, p.y + 11); }
  cx.textAlign = 'start';
  { const lv = E(S.fi).roomLvl || {}; // crte skoka poda
    res.rooms.forEach((ro, t) => { const sk = (lv[ro.key] || {}).skok; if (!sk) return; let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) if (res.RI ? res.RI[i * ny + j] === t : res.T[i * ny + j] === t) { x0 = Math.min(x0, xs[i]); x1 = Math.max(x1, xs[i + 1]); y0 = Math.min(y0, ys[j]); y1 = Math.max(y1, ys[j + 1]); } if (!Number.isFinite(x0)) return;
      const a = tr(sk.o === 'H' ? { x: x0, y: sk.c } : { x: sk.c, y: y0 }), q = tr(sk.o === 'H' ? { x: x1, y: sk.c } : { x: sk.c, y: y1 }); cx.strokeStyle = '#ea580c'; cx.lineWidth = 3; cx.setLineDash([8, 5]); cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(q.x, q.y); cx.stroke(); cx.setLineDash([]);
      cx.fillStyle = '#ea580c'; cx.font = 'bold 12px Arial'; const m = { x: (a.x + q.x) / 2, y: (a.y + q.y) / 2 }; if (sk.b != null) cx.fillText((sk.o === 'H' ? '↓' : '→') + ' pod ' + sk.b, m.x + (sk.o === 'V' ? 6 : 0), m.y + (sk.o === 'H' ? 16 : 0)); });
    for (const p0 of (S.stepPick && S.stepPick.pts) || []) { const p1 = tr(p0); cx.fillStyle = '#ea580c'; cx.beginPath(); cx.arc(p1.x, p1.y, 8, 0, 7); cx.fill(); } }
  if (S.tab === 7) { const bb = { x0: xs[0], x1: xs[nx], y0: ys[0], y1: ys[ny] };
    (PP().presjeci || []).forEach((c, i) => { if (S.cutPick && S.cutPick.idx === i) return; const a = tr(c.o === 'H' ? { x: bb.x0 - 80, y: c.c } : { x: c.c, y: bb.y0 - 80 }), q = tr(c.o === 'H' ? { x: bb.x1 + 80, y: c.c } : { x: c.c, y: bb.y1 + 80 }); cx.strokeStyle = '#dc2626'; cx.lineWidth = 2.5; cx.setLineDash([12, 5, 3, 5]); cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(q.x, q.y); cx.stroke(); cx.setLineDash([]); cx.fillStyle = '#dc2626'; cx.font = 'bold 16px Arial'; cx.fillText(String.fromCharCode(65 + i), a.x - 6, a.y - 6); });
    for (const p0 of (S.cutPick && S.cutPick.pts) || []) { const p1 = tr(p0); cx.fillStyle = '#dc2626'; cx.beginPath(); cx.arc(p1.x, p1.y, 8, 0, 7); cx.fill(); }
    return; }
  if (isEnerg()) $('enLegend').innerHTML = '<span style="background:#fde7c7"></span>grijano <span style="background:#dbeafe"></span>negrijano <span style="background:#dc2626"></span>vanjski zid <span style="background:#ea580c"></span>prema negrijanom <span style="background:#6b7280"></span>susjedna zgrada <span style="background:#92400e"></span>prema tlu';
}
function segPop(sg) { const p = $('enPop'); if (!p) return; S.cutOpen = false; S.selSeg = sg.key;
  const show = s2 => { if (S.tab === 6 || S.tab === 2) { const pnl = $('enPanel').scrollTop; go(S.tab); $('enPanel').scrollTop = pnl; } const nb = S.res[S.fi].segs.find(x => x.key === s2.key) || s2; S.selSeg = nb.key; p.innerHTML = '<div class="tl-pop-head"><b>' + segTitle(nb) + '</b><button class="tl-btn" id="enPx">✕</button></div>' + segEditor(nb, 'p'); p.hidden = false; $('enPx').onclick = hidePop; bindSegEditor(p, 'p', show); draw(); };
  p.innerHTML = '<div class="tl-pop-head"><b>' + segTitle(sg) + '</b><button class="tl-btn" id="enPx">✕</button></div>' + segEditor(sg, 'p'); p.hidden = false; $('enPx').onclick = hidePop; bindSegEditor(p, 'p', show); draw(); }
function hidePop() { const p = $('enPop'); if (p) p.hidden = true; if (S.selSeg) { S.selSeg = null; try { draw(); } catch (e) { } } }
function tap(pt) {
  if (S.stepPick && S.view) { const w = inv(pt), sp = S.stepPick; sp.pts.push(w);
    if (sp.pts.length < 2) { const sc = $('enPanel').scrollTop; go(S.tab); $('enPanel').scrollTop = sc; draw(); return; }
    const [a, b] = sp.pts, o = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y) ? 'H' : 'V', c = Math.round(o === 'H' ? (a.y + b.y) / 2 : (a.x + b.x) / 2);
    const e = E(S.fi); e.roomLvl = e.roomLvl || {}; const L = e.roomLvl[sp.key] = e.roomLvl[sp.key] || {}, old = L.skok || {}; L.skok = { o, c, a: old.o === o ? old.a : undefined, b: old.o === o ? old.b : undefined }; if (L.skok.a == null) delete L.skok.a; if (L.skok.b == null) delete L.skok.b;
    S.stepPick = null; S.proc = null; save(); go(S.tab); draw(); return; }
  if (S.tab === 7 && S.cutPick && S.view) { const w = inv(pt), cp = S.cutPick; cp.pts.push(w);
    if (cp.pts.length < 2) { go(7); return; }
    const [a, b] = cp.pts, o = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y) ? 'H' : 'V', c = Math.round(o === 'H' ? (a.y + b.y) / 2 : (a.x + b.x) / 2), L = PP().presjeci = PP().presjeci || [], old = L[cp.idx];
    L[cp.idx] = { o, c, look: old && old.o === o ? old.look || 1 : 1, name: old ? old.name : undefined };
    S.pv = 'presjek' + cp.idx; S.cutPick = null; S.proc = null; S.view = null; save(); go(7); return; }
  if (S.tab === 7 && S.view) { const v = curView(); if (!v || v.section) return; const u = (pt.x - S.view.ox) / S.view.s, z = (S.view.oy - pt.y) / S.view.s, tol = 12 / S.view.s;
    const g = (v.opGeom || []).find(o => u >= o.u0 - tol && u <= o.u1 + tol && z >= o.z0 - tol && z <= o.z1 + tol); const nk = g ? g.key : null; if (nk !== S.opSel) { S.opSel = nk; const sc = $('enPanel').scrollTop; go(7); $('enPanel').scrollTop = sc; } return; }
  if (S.tab === 7 || !isEnerg()) return;
  const res = S.res[S.fi]; if (!res || res.err || !S.view) return; const w = inv(pt), tol = 14 / S.view.s;
  if (S.cutTap) { const sg0 = res.segs.find(x => x.pkey === S.cutTap); S.cutTap = null; if (sg0) { const info = sg0.cutInfo, u = info.o === 'H' ? w.x : w.y, v = info.o === 'H' ? w.y : w.x;
      if (Math.abs(v - info.at) < 3 * tol && u > info.s0 && u < info.s1) { let pos = u - info.s0, bdd = 12 / S.view.s; /* lijepi se za rub otvora i okomiti zid */
        for (const o of res.ops) { if (o.x == null || o.nxs !== info.nxs || o.nys !== info.nys) continue; const c0 = info.o === 'H' ? o.x : o.y; for (const e of [c0 - o.w / 2, c0 + o.w / 2]) { const d = Math.abs(e - u); if (d < bdd) { bdd = d; pos = e - info.s0; } } }
        for (const c of info.cuts) if (c.auto) { const d = Math.abs(info.s0 + c.pos - u); if (d < bdd) { bdd = d; pos = c.pos; } }
        if (cutAdd(info, pos)) { save(); refresh(); const sc = $('enPanel').scrollTop; go(S.tab); $('enPanel').scrollTop = sc; const nb = segAtPos(info, pos - 1); if (nb) segPop(nb); return; } } }
    hidePop(); return; }
  // crtica reza (okomiti zid / ručni rez)
  { let bc = null, bdc = 10 / S.view.s; const seen = new Set(); for (const sg of res.segs) { const info = sg.cutInfo; if (!info || seen.has(info.pkey)) continue; seen.add(info.pkey);
      for (const c of info.cuts) { const P0 = info.o === 'H' ? { x: info.s0 + c.pos, y: info.at } : { x: info.at, y: info.s0 + c.pos }, d = Math.hypot(P0.x - w.x, P0.y - w.y); if (d < bdc) { bdc = d; bc = { info, c }; } } }
    if (bc) { const { info, c } = bc, p = $('enPop'); p.innerHTML = '<div class="tl-pop-head"><b>' + (c.auto ? 'Okomiti zid' : '✂ Rez') + ' na pročelju ' + info.pn + ' · ' + cm(c.pos) + ' cm od ' + sideW(info, 0) + ' kraja</b><button class="tl-btn" id="enPx">✕</button></div><p class="tl-note">' + (c.auto ? (c.on ? 'Ovdje je pročelje podijeljeno jer tu dolazi unutarnji zid.' : 'Dijelovi su spojeni.') : 'Ručni rez.') + '</p><button class="tl-btn" id="enCx">' + (c.auto ? (c.on ? 'Spoji dijelove' : 'Razdvoji') : 'Ukloni rez') + '</button>';
      p.hidden = false; $('enPx').onclick = hidePop; $('enCx').onclick = () => { cutToggle(info, c); save(); refresh(); const sc = $('enPanel').scrollTop; go(S.tab); $('enPanel').scrollTop = sc; hidePop(); }; return; } }
  // dio pročelja
  let best = null, bd = tol;
  for (const s of res.segs) { const u = s.o === 'H' ? w.x : w.y, v = s.o === 'H' ? w.y : w.x; if (u < s.s0 - tol || u > s.s1 + tol) continue; const d = Math.abs(v - s.at); if (d < bd) { bd = d; best = s; } }
  const p = $('enPop');
  if (best && best.cls === 'ext') { segPop(best); return; }
  // prostorija
  const { xs, ys, nx, ny } = res.grid; let i = -1, j = -1; for (let a = 0; a < nx; a++) if (w.x >= xs[a] && w.x < xs[a + 1]) i = a; for (let a = 0; a < ny; a++) if (w.y >= ys[a] && w.y < ys[a + 1]) j = a;
  if (i < 0 || j < 0) { hidePop(); return; } const t = res.RI[i * ny + j], ro = t >= 0 ? res.rooms[t] : null;
  if (!ro) { hidePop(); return; }
  p.innerHTML = '<div class="tl-pop-head"><b>' + esc(ro.name || 'Prostorija') + ' · ' + m2(ro.area) + ' m²</b><button class="tl-btn" id="enPx">✕</button></div><div class="tl-chips">' + EC.ROOM_KINDS.map(([k, n]) => '<button class="tl-chip' + (k === ro.kind ? ' on' : '') + '" data-k="' + k + '">' + n + '</button>').join('') + '</div>';
  p.hidden = false; $('enPx').onclick = hidePop;
  p.querySelectorAll('[data-k]').forEach(bt => bt.onclick = () => { const e = E(S.fi); e.rooms = e.rooms || {}; e.rooms[ro.key] = bt.dataset.k; refresh(); hidePop(); go(S.tab); });
}
/* za „Izvezi sve”: pročelja i presjeci (samo legalizacija) */
function procFiles() { if (!isLegal()) return null; buildAll(); recalc(); const R = procBuild(); if (!R || R.err || !R.views || !R.views.length) return null;
  return { dxf: IzmjeraProcelja.toDxf(R), pdf: IzmjeraProcelja.toPdf(R, { project: (window.IzmjeraApp && IzmjeraApp.projectName()) || 'Izmjera', title: 'Pročelja' }) }; }
window.IzmjeraEnergija = { open, openTab, nacrtiData, close, syncButton, isEnerg, isLegal, wizTitle, procFiles, _S: S };
try { syncButton(); } catch (e) { }
})();
