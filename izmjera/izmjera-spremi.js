/* Izmjera 57 — stalna mapa za spremanje izvoza (PDF, DXF, Excel, kopija projekta), s podmapom po projektu.
   Mapu na tabletu može na Google Disk slati npr. aplikacija Autosync for Google Drive. */
(function (root) {
'use strict';
const KEY = 'izmjera-spremi';
function cfg() { try { return Object.assign({ auto: true, sub: 'naziv' }, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { return { auto: true, sub: 'naziv' }; } }
function setCfg(c) { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) { } }
const A = () => root.AndroidApp && root.AndroidApp.saveToFolder ? root.AndroidApp : null;
function folder() { try { return A() ? A().getSaveFolder() || '' : ''; } catch (e) { return ''; } }
const clean = s => String(s || '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
function subName() {
  const c = cfg(), info = root.projectInfo || {}, name = (root.IzmjeraApp && IzmjeraApp.projectName && IzmjeraApp.projectName()) || 'Izmjera';
  if (c.sub === 'nema') return '';
  if (c.sub === 'adresa' && info.adresa) return clean(info.adresa);
  if (c.sub === 'kc' && info.kc) return clean('kč ' + info.kc + (info.ko ? ' ' + info.ko : ''));
  return clean(name) || 'Izmjera';
}
function b64ofBytes(bytes) { let bin = ''; for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192)); return btoa(bin); }
function b64ofText(text) { return b64ofBytes(new TextEncoder().encode(text)); }
/* vraća true ako je spremljeno u stalnu mapu; inače false (pozivatelj otvara uobičajeni prozor za spremanje) */
function tryAuto(name, mime, b64) {
  /* v2.17: projekt iz registra → datoteka ide u njegovu mapu na Disku (i u lokalnu mapu ako je odabrana) */
  let disk = false; try { disk = !!(root.IzmjeraRegistar && root.IzmjeraRegistar.upload(name, mime || 'application/octet-stream', b64)); } catch (e) { }
  const a = A(); if (!a || !cfg().auto || !folder()) return disk;
  let r = ''; try { r = a.saveToFolder(subName(), name, mime || 'application/octet-stream', b64); } catch (e) { r = String(e.message || e); }
  if (r === 'ok') { const msg = 'Spremljeno: ' + folder() + (subName() ? ' / ' + subName() : '') + ' / ' + name; try { a.toast(msg); } catch (e) { } try { const st = document.getElementById('status'); if (st) st.textContent = msg; } catch (e) { } return true; }
  try { a.toast('Spremanje u mapu nije uspjelo (' + r + ') – odaberi mjesto ručno.'); } catch (e) { }
  return false;
}
const autoBytes = (name, mime, bytes) => tryAuto(name, mime, b64ofBytes(bytes));
const autoText = (name, mime, text) => tryAuto(name, mime, b64ofText(text));
/* postavke (početni zaslon) */
function showSettings() {
  let d = document.getElementById('saveOverlay'); if (!d) { d = document.createElement('section'); d.id = 'saveOverlay'; d.style.cssText = 'position:fixed;inset:0;z-index:40;background:#0008;overflow:auto;padding:16px'; document.body.appendChild(d); }
  const c = cfg(), f = folder(), has = !!A();
  d.innerHTML = '<div style="max-width:560px;margin:5vh auto;background:#fff;border-radius:14px;padding:18px;font-size:16px"><div style="display:flex;justify-content:space-between;align-items:center"><h2 style="margin:0;font-size:20px">Mapa za spremanje</h2><button id="svClose">Zatvori</button></div>' +
    (has ? '<p>Odabrana mapa: <b>' + (f ? f.replace(/</g, '&lt;') : '– nije odabrana –') + '</b></p><div style="display:flex;gap:8px;flex-wrap:wrap"><button id="svPick" style="background:#1e40af;color:#fff">📁 Odaberi mapu</button>' + (f ? '<button id="svClear">Ukloni</button>' : '') + '</div>' +
      '<label style="display:block;margin:14px 0 6px"><input type="checkbox" id="svAuto"' + (c.auto ? ' checked' : '') + ' style="width:22px;height:22px;vertical-align:-5px"> Spremaj automatski u ovu mapu (bez pitanja)</label>' +
      '<label style="display:block;margin:10px 0 4px;font-size:14px;color:#475569">Podmapa za svaki projekt</label><select id="svSub" style="font-size:16px;padding:8px;border-radius:8px;width:100%"><option value="naziv">Naziv projekta</option><option value="adresa">Adresa građevine (iz Podataka)</option><option value="kc">k.č. i k.o. (iz Podataka)</option><option value="nema">Bez podmape</option></select>' +
      '<p style="font-size:13px;color:#475569;margin-top:14px">PDF, DXF, Excel i kopija projekta (JSON) spremaju se u <i>mapa / podmapa projekta / datoteka</i>. Ista datoteka se prepisuje novom.<br><br><b>Google Disk:</b> instaliraj besplatnu aplikaciju <b>Autosync for Google Drive</b> i u njoj poveži ovu mapu s mapom na Disku. Ona sama šalje nove datoteke kad je tablet na internetu.</p>'
      : '<p>Ova mogućnost radi samo u aplikaciji na tabletu.</p>') + '</div>';
  d.hidden = false;
  const close = () => { d.hidden = true; };
  d.querySelector('#svClose').onclick = close;
  if (has) {
    d.querySelector('#svSub').value = c.sub;
    d.querySelector('#svSub').onchange = e => { const c2 = cfg(); c2.sub = e.target.value; setCfg(c2); };
    d.querySelector('#svAuto').onchange = e => { const c2 = cfg(); c2.auto = e.target.checked; setCfg(c2); };
    d.querySelector('#svPick').onclick = () => { try { A().chooseSaveFolder(); } catch (e) { alert(e.message || e); } };
    const cl = d.querySelector('#svClear'); if (cl) cl.onclick = () => { try { A().clearSaveFolder(); } catch (e) { } showSettings(); };
  }
}
function folderChanged() { const d = document.getElementById('saveOverlay'); if (d && !d.hidden) showSettings(); }
root.IzmjeraSpremi = { autoBytes, autoText, tryAuto, showSettings, folderChanged, folder, cfg };
})(typeof window !== 'undefined' ? window : globalThis);
