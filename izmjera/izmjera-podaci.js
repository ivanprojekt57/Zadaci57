/* Izmjera 57 — podaci o projektu (građevina, investitor, napomene). Spremaju se u projekt kao data.info. */
(function () {
'use strict';
const FIELDS = [
  ['Građevina', [['adresa', 'Adresa građevine'], ['kc', 'Katastarska čestica (k.č.)'], ['ko', 'Katastarska općina (k.o.)'], ['god', 'Godina izgradnje', 'numeric']]],
  ['Investitor', [['invIme', 'Ime i prezime / naziv'], ['invAdresa', 'Adresa'], ['invOib', 'OIB', 'numeric']]]
];
const TYPES = [['etazni', 'Etažni elaborat'], ['legalizacija', 'Legalizacija'], ['energetski', 'Energetski certifikat'], ['statika', 'Statika'], ['procjena', 'Procjena'], ['savjetovanje', 'Savjetovanje'], ['nadzor', 'Nadzor'], ['tlocrt', 'Izrada tlocrta'], ['troskovnik', 'Troškovnik'], ['ostalo', 'Ostalo']];
const typeName = k => (TYPES.find(t => t[0] === k) || [k, k])[1];
const FKEY = 'izmjera-filter-vrsta';
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function clean(info) {
  const o = {}; if (!info || typeof info !== 'object') return o;
  for (const [, fs] of FIELDS) for (const [k] of fs) if (typeof info[k] === 'string' && info[k].trim()) o[k] = info[k].trim().slice(0, 300);
  if (typeof info.napomene === 'string' && info.napomene.trim()) o.napomene = info.napomene.slice(0, 5000);
  for (const k of ['izvor', 'broj', 'mapa']) if (typeof info[k] === 'string' && info[k]) o[k] = info[k];
  if (info.tijek && typeof info.tijek === 'object') o.tijek = info.tijek;
  if (Array.isArray(info.vrsta)) { const v = info.vrsta.filter(k => TYPES.some(t => t[0] === k)); if (v.length) o.vrsta = [...new Set(v)]; }
  return o;
}
function summary(info) { return [info.adresa, info.kc ? 'k.č. ' + info.kc : '', info.ko ? 'k.o. ' + info.ko : '', info.invIme].filter(Boolean).join(' · '); }
function oibOk(s) { if (!/^\d{11}$/.test(s)) return false; let a = 10; for (let i = 0; i < 10; i++) { a = (a + +s[i]) % 10; if (!a) a = 10; a = (a * 2) % 11; } return (11 - a) % 10 === +s[10]; }
function ensureDom() {
  let d = document.getElementById('infoOverlay'); if (d) return d;
  d = document.createElement('section'); d.id = 'infoOverlay'; d.hidden = true;
  d.style.cssText = 'position:fixed;inset:0;z-index:40;background:#0008;overflow:auto;padding:16px';
  document.body.appendChild(d); return d;
}
/* name: naziv projekta, info: trenutni podaci, onSave(info) */
function showForm(name, info, onSave) {
  const d = ensureDom(); info = info || {};
  let h = '<div style="max-width:620px;margin:3vh auto;background:#fff;border-radius:14px;padding:18px;font-size:16px">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><h2 style="margin:0;font-size:20px">Podaci o projektu</h2><button id="infoClose">Zatvori</button></div>' +
    '<p style="margin:4px 0 12px;color:#475569">' + esc(name) + '</p>' +
    '<h3 style="margin:14px 0 6px;font-size:16px;color:#1e3a8a">Vrsta projekta</h3><div id="infoVrsta" style="display:flex;flex-wrap:wrap;gap:6px">' +
    TYPES.map(([k, n]) => '<button type="button" data-v="' + k + '" class="' + ((info.vrsta || []).includes(k) ? 'on' : '') + '" style="padding:8px 12px;border-radius:999px;border:1px solid #93c5fd;' + ((info.vrsta || []).includes(k) ? 'background:#1e40af;color:#fff' : 'background:#eff6ff;color:#1e3a8a') + '">' + n + '</button>').join('') +
    '</div><p style="font-size:12px;color:#64748b;margin:4px 0 0">Može ih biti više (npr. etažni elaborat i legalizacija).</p>';
  for (const [title, fs] of FIELDS) {
    h += '<h3 style="margin:14px 0 6px;font-size:16px;color:#1e3a8a">' + title + '</h3>';
    for (const [k, lab, im] of fs) h += '<label style="display:block;margin:6px 0"><span style="display:block;font-size:13px;color:#475569">' + lab + '</span><input data-k="' + k + '" value="' + esc(info[k] || '') + '"' + (im ? ' inputmode="' + im + '"' : '') + ' style="width:100%;box-sizing:border-box;padding:10px;font-size:16px;border:1px solid #cbd5e1;border-radius:8px"></label>';
  }
  h += '<div id="infoOibMsg" style="font-size:13px;color:#b45309;min-height:16px"></div>' +
    '<h3 style="margin:14px 0 6px;font-size:16px;color:#1e3a8a">Napomene</h3><textarea data-k="napomene" rows="6" style="font-family:inherit;width:100%;box-sizing:border-box;padding:10px;font-size:16px;border:1px solid #cbd5e1;border-radius:8px">' + esc(info.napomene || '') + '</textarea>' +
    '<p style="font-size:12px;color:#64748b">Podaci se spremaju samo u projekt (na tabletu i u izvezenoj kopiji JSON). Ne ulaze u DXF ni PDF.</p>' +
    '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px"><button id="infoCancel">Odustani</button><button id="infoSave" style="background:#1e40af;color:#fff">Spremi</button></div></div>';
  d.innerHTML = h; d.hidden = false;
  const close = () => { d.hidden = true; d.innerHTML = ''; };
  const oib = d.querySelector('[data-k="invOib"]'), msg = d.querySelector('#infoOibMsg');
  const chk = () => { const v = oib.value.trim(); msg.textContent = v && !oibOk(v) ? 'Provjeri OIB – kontrolna znamenka ne odgovara (ili nema 11 znamenki).' : ''; };
  oib.addEventListener('input', chk); chk();
  d.querySelector('#infoClose').onclick = close; d.querySelector('#infoCancel').onclick = close;
  d.querySelectorAll('#infoVrsta [data-v]').forEach(b => b.onclick = () => { const on = !b.classList.contains('on'); b.classList.toggle('on', on); b.style.background = on ? '#1e40af' : '#eff6ff'; b.style.color = on ? '#fff' : '#1e3a8a'; });
  d.querySelector('#infoSave').onclick = () => { const o = {}; d.querySelectorAll('[data-k]').forEach(el => { o[el.dataset.k] = el.value; }); o.vrsta = [...d.querySelectorAll('#infoVrsta .on')].map(b => b.dataset.v); onSave(clean(o)); close(); };
}
const PKEY = 'terenska-izmjera-projects-v13';
function setSummary(id, info) {
  setTimeout(() => { try { window.IzmjeraRegistar && IzmjeraRegistar.soon(); } catch (e) { } }, 0);
  try { const ps = JSON.parse(localStorage.getItem(PKEY) || '[]'); const pr = ps.find(p => p.id === id); if (pr) { pr.addr = summary(info); if (info.vrsta && info.vrsta.length) pr.vrsta = info.vrsta; else delete pr.vrsta; pr.rmod = Date.now(); localStorage.setItem(PKEY, JSON.stringify(ps)); } } catch (e) { }
}
function store(id, raw) {
  let ok = false; try { localStorage.setItem('terenska-project-' + id, raw); ok = true; } catch (e) { }
  const nat = !!(window.AndroidApp && window.AndroidApp.saveProject); if (nat) { try { window.AndroidApp.saveProject(id, raw); } catch (e) { } }
  if (!ok && !nat) throw Error('Memorija je puna.');
}
function refreshList() { const q = document.getElementById('projectSearch'); if (q) q.dispatchEvent(new Event('input')); }
/* s početnog zaslona: projekt nije otvoren, mijenja se spremljeni JSON */
function edit(id) {
  let data; try { data = JSON.parse(localStorage.getItem('terenska-project-' + id) || 'null'); } catch (e) { data = null; }
  try { const n = window.AndroidApp && window.AndroidApp.loadProject ? window.AndroidApp.loadProject(id) : ''; if (n) { const nd = JSON.parse(n); if (nd && Array.isArray(nd.floors) && (!data || (nd.savedAt || 0) > (data.savedAt || 0))) data = nd; } } catch (e) { }
  if (!data) { alert('Podaci projekta nisu pronađeni.'); return; }
  showForm(data.name || '', data.info, info => {
    for (const k of ['tijek', 'izvor', 'broj', 'mapa']) if (data.info && data.info[k] != null) info[k] = data.info[k]; data.info = info;
    try { store(id, JSON.stringify(data)); } catch (e) { alert('Spremanje nije uspjelo: ' + (e.message || e)); return; }
    setSummary(id, info); refreshList();
  });
}
/* iz otvorenog projekta */
function editCurrent() {
  showForm(document.getElementById('project').value || '', window.projectInfo, info => {
    for (const k of ['tijek', 'izvor', 'broj', 'mapa']) if (window.projectInfo && window.projectInfo[k] != null) info[k] = window.projectInfo[k]; window.projectInfo = info; try { window.IzmjeraApp && IzmjeraApp.save ? IzmjeraApp.save() : saveLocal(); } catch (e) { } try { window.IzmjeraEnergija && IzmjeraEnergija.syncButton(); } catch (e) { }
    try { const app = window.IzmjeraApp, id = app && app.projectId ? app.projectId() : null; if (id) setSummary(id, info); } catch (e) { }
  });
}
/* filtar po vrsti projekta na početnom zaslonu */
function getFilter() { try { return localStorage.getItem(FKEY) || ''; } catch (e) { return ''; } }
function match(pr) { const f = getFilter(); if (!f) return true; if (f === 'nema') return !(pr.vrsta && pr.vrsta.length); return !!(pr.vrsta && pr.vrsta.includes(f)); }
function tags(pr) { return (pr.vrsta || []).map(typeName); }
function renderFilter() {
  const q = document.getElementById('projectSearch'); if (!q) return;
  let bar = document.getElementById('vrstaFilter');
  if (!bar) { bar = document.createElement('div'); bar.id = 'vrstaFilter'; bar.style.cssText = 'max-width:900px;margin:0 auto 12px;display:flex;flex-wrap:wrap;gap:6px'; const host = q.parentElement; host.parentElement.insertBefore(bar, host.nextSibling); }
  let ps = []; try { ps = JSON.parse(localStorage.getItem(PKEY) || '[]'); } catch (e) { }
  try { if (window.IzmjeraKartice && IzmjeraKartice.countPs) ps = IzmjeraKartice.countPs(ps); } catch (e) { } /* v2.40: brojevi za karticu koja je otvorena */
  const f = getFilter(), cnt = k => k === '' ? ps.length : k === 'nema' ? ps.filter(p => !(p.vrsta && p.vrsta.length)).length : ps.filter(p => p.vrsta && p.vrsta.includes(k)).length;
  bar.innerHTML = [['', 'Sve'], ...TYPES, ['nema', 'Bez vrste']].map(([k, n]) => '<button type="button" data-f="' + k + '" style="padding:7px 12px;border-radius:999px;border:1px solid #93c5fd;' + (f === k ? 'background:#1e40af;color:#fff' : 'background:#fff;color:#1e3a8a') + '">' + n + ' <span style="opacity:.7">' + cnt(k) + '</span></button>').join('');
  bar.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { try { localStorage.setItem(FKEY, b.dataset.f); } catch (e) { } refreshList(); });
}
window.IzmjeraPodaci = { edit, editCurrent, clean, summary, oibOk, match, tags, renderFilter, TYPES };
try { refreshList(); } catch (e) { } // prvi prikaz popisa bio je prije učitavanja ove datoteke
})();
