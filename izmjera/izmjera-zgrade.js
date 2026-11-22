/* Izmjera 57 — v2.64: više zgrada na istom terenu (kuća, garaža, pomoćna…).
   Gornja traka: 🏠 Zgrada ▾ prije etaža (vidi se kad ima više zgrada); popis zgrada: otvori, preimenuj, premjesti etažu, obriši, nova zgrada. */
(function () {
'use strict';
const $ = id => document.getElementById(id);
const Z = () => window.IzmjeraApp && IzmjeraApp.zg;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ico = n => /gara/i.test(n) ? '🚗' : /pomo|spremi|drvar|šupa|supa|radion/i.test(n) ? '🛠' : /bazen/i.test(n) ? '🏊' : /posl|hal/i.test(n) ? '🏭' : '🏠';
const etaze = n => n === 1 ? '1 etaža' : n >= 2 && n <= 4 ? n + ' etaže' : n + ' etaža';
function css() { if ($('zgCss')) return; const st = document.createElement('style'); st.id = 'zgCss'; st.textContent =
  'html body #zgBtn{height:34px!important;min-height:34px!important;padding:0 11px!important;border-radius:9px!important;border:2px solid #f59e0b!important;box-shadow:none!important;opacity:1!important;background:#3b2a0a!important;color:#fde68a!important;font:800 13px Arial!important;margin-left:8px;white-space:nowrap;flex:none}' +
  'html body.sun #zgBtn{background:#fff7ed!important;color:#9a3412!important}' +
  '#zgDd{position:fixed;z-index:100003;background:#fff;color:#0f172a;border:1px solid #cbd5e1;border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.28);padding:8px;width:min(360px,calc(100vw - 24px));font:15px Arial}' +
  '#zgDd .r{display:flex;align-items:center;gap:6px;padding:4px;border-radius:10px;margin:2px 0}#zgDd .r.on{background:#eff6ff;box-shadow:inset 0 0 0 1px #93c5fd}' +
  '#zgDd .r .nm{flex:1;text-align:left;background:none;border:0;font:700 15px Arial;color:#0f2a4a;padding:9px 6px;cursor:pointer}#zgDd .r .nm small{font:400 12px Arial;color:#64748b;margin-left:6px}' +
  '#zgDd .r .ed{border:1px solid #cbd5e1;background:#fff;border-radius:8px;width:38px;height:36px;font-size:16px}' +
  '#zgDd .menu[hidden]{display:none}#zgDd .menu{margin:0 0 6px 34px;display:flex;flex-wrap:wrap;gap:6px}#zgDd .menu button{border:1px solid #cbd5e1;background:#f8fafc;border-radius:8px;padding:7px 10px;font:600 13px Arial;color:#0f2a4a}#zgDd .menu .del{color:#b91c1c;border-color:#fecaca;background:#fef2f2}' +
  '#zgDd .add{display:block;width:100%;margin-top:6px;border:2px dashed #94a3b8;border-radius:10px;padding:10px;background:#fff;color:#1e3a8a;font:700 15px Arial}' +
  '#zgDd .hint{font-size:12px;color:#64748b;margin:8px 4px 2px}' +
  '#zgNew{display:block;width:100%;margin-top:6px}';
  document.head.appendChild(st); }
function closeDd() { const d = $('zgDd'); if (d) d.remove(); document.removeEventListener('pointerdown', outside, true); }
function outside(e) { const d = $('zgDd'); if (d && !d.contains(e.target) && e.target.id !== 'zgBtn') closeDd(); }
function nameAsk(def) { const v = prompt('Naziv zgrade (npr. Kuća, Garaža, Pomoćna zgrada):', def || ''); return v && v.trim() ? v.trim().slice(0, 60) : null; }
function addNew() { const z = Z(); if (!z) return; const L = z.list(); if (L.length === 1 && /^Zgrada \d+$/.test(L[0].name)) { const n0 = nameAsk(L[0].name === 'Zgrada 1' ? 'Kuća' : L[0].name); if (n0 == null) return; z.rename(L[0].id, n0); }
  const n = nameAsk(L.length === 1 ? 'Garaža' : 'Pomoćna zgrada'); if (n == null) return; closeDd(); z.add(n); sync(true); }
function openDd(anchor) {
  css(); closeDd(); const z = Z(); if (!z) return; const L = z.list(), cur = z.cur(), d = document.createElement('div'); d.id = 'zgDd';
  const fName = (IzmjeraApp.currentFloor() || {}).name || 'etaža';
  d.innerHTML = L.map(b => '<div class="r' + (b.id === cur ? ' on' : '') + '" data-id="' + esc(b.id) + '"><button class="nm" data-open="' + esc(b.id) + '">' + ico(b.name) + ' ' + esc(b.name) + '<small>' + etaze(b.n) + '</small></button><button class="ed" data-ed="' + esc(b.id) + '" title="Preimenuj, premjesti etažu, obriši">✎</button></div><div class="menu" data-m="' + esc(b.id) + '" hidden>' +
    '<button data-ren="' + esc(b.id) + '">✎ Preimenuj</button>' + (b.id !== cur ? '<button data-mv="' + esc(b.id) + '">⇢ Premjesti etažu „' + esc(fName) + '” ovamo</button>' : '') + (L.length > 1 ? '<button class="del" data-del="' + esc(b.id) + '">🗑 Obriši zgradu</button>' : '') + '</div>').join('') +
    '<button class="add" data-add="1">＋ Nova zgrada na ovom terenu</button><div class="hint">Svaka zgrada ima svoje etaže i skice. Tlocrt, pročelja, energetika i GBP/obujam rade po zgradi; „📦 Izvezi sve” može sve zgrade staviti u jedan DXF.</div>';
  document.body.appendChild(d);
  const r = (anchor && anchor.getBoundingClientRect()) || { left: 12, bottom: 60 }; d.style.left = Math.max(8, Math.min(innerWidth - d.offsetWidth - 8, r.left)) + 'px'; d.style.top = (r.bottom + 6) + 'px';
  d.querySelectorAll('[data-open]').forEach(b => b.onclick = () => { closeDd(); if (b.dataset.open !== z.cur()) z.open(b.dataset.open); sync(true); });
  d.querySelectorAll('[data-ed]').forEach(b => b.onclick = () => { const m = d.querySelector('[data-m="' + CSS.escape(b.dataset.ed) + '"]'); if (m) m.hidden = !m.hidden; });
  d.querySelectorAll('[data-ren]').forEach(b => b.onclick = () => { const id = b.dataset.ren, x = z.list().find(q => q.id === id); const n = nameAsk(x && x.name); if (n == null) return; z.rename(id, n); openDd(anchor); sync(true); });
  d.querySelectorAll('[data-mv]').forEach(b => b.onclick = () => { const id = b.dataset.mv, x = z.list().find(q => q.id === id); const fi = IzmjeraApp.allFloors().indexOf(IzmjeraApp.currentFloor());
    if (!z.moveFloor(fi, id)) { alert('Ova etaža je jedina u svojoj zgradi – zgrada mora imati barem jednu etažu. Ako je cijela zgrada kriva, preimenuj je.'); return; } closeDd(); sync(true); toast('Etaža „' + fName + '” je sada u zgradi „' + (x ? x.name : '') + '”.'); });
  d.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { const id = b.dataset.del, x = z.list().find(q => q.id === id); if (!x) return;
    if (!confirm('Obrisati zgradu „' + x.name + '” i sve njezine etaže (' + x.n + ') s nacrtima, kotama i opisima? Ovo se ne može poništiti.')) return; closeDd(); z.remove(id); sync(true); });
  d.querySelector('[data-add]').onclick = addNew;
  setTimeout(() => document.addEventListener('pointerdown', outside, true), 0);
}
function toast(t) { try { const s = $('status'); if (s) s.textContent = t; } catch (e) { } }
let sig = '';
function sync(force) {
  const z = Z(); if (!z) return; css(); const tabs = $('ui2Tabs'); const L = z.list(), cur = z.cur(), b = L.find(x => x.id === cur) || L[0];
  let btn = $('zgBtn'); if (!btn && tabs) { btn = document.createElement('button'); btn.id = 'zgBtn'; btn.type = 'button'; btn.title = 'Zgrade na ovom terenu'; btn.onclick = e => { e.stopPropagation(); if ($('zgDd')) closeDd(); else openDd(btn); }; tabs.before(btn);
    const sun = document.body.classList.contains('sun'); for (const [k, v] of [['border', '2px solid #f59e0b'], ['background', sun ? '#fff7ed' : '#3b2a0a'], ['color', sun ? '#9a3412' : '#fde68a'], ['font', '800 13px Arial'], ['box-shadow', 'none'], ['height', '34px'], ['padding', '0 11px'], ['border-radius', '9px']]) btn.style.setProperty(k, v, 'important'); }
  const s2 = L.map(x => x.id + ':' + x.name + ':' + x.n).join('|') + '#' + cur; if (!force && s2 === sig) return; sig = s2;
  if (btn) { btn.style.display = L.length > 1 ? '' : 'none'; btn.textContent = (b ? ico(b.name) + ' ' + b.name : '🏠') + ' ▾'; }
  const ad = $('addfloor'); if (ad && !$('zgNew')) { const nb = document.createElement('button'); nb.id = 'zgNew'; nb.type = 'button'; nb.textContent = '🏠 Zgrade na terenu…'; nb.title = 'Kuća, garaža, pomoćna… – svaka sa svojim etažama'; nb.onclick = e => { e.stopPropagation(); if (Z().list().length < 2) addNew(); else openDd($('zgBtn') && $('zgBtn').offsetParent ? $('zgBtn') : nb); }; const box = ad.parentElement; if (box) box.after(nb); else ad.after(nb); }
}
setInterval(() => { try { sync(false); } catch (e) { } }, 800);
document.addEventListener('DOMContentLoaded', () => sync(true));
window.IzmjeraZgrade = { sync, openDd, addNew };
})();
