/* Izmjera 57 — v2.59: rad na kompjuteru.
   Tablet: „💻 Za kompjuter” pročita rukom pisane kote svih etaža i spremi projekt kao JSON.
   Kompjuter (ista aplikacija u Chromeu): otvaranje te datoteke (gumb ili povlačenjem), miš i tipkovnica umjesto dodira. */
(function () {
'use strict';
const $ = id => document.getElementById(id);
const A = window.AndroidApp;
const isPc = !A;
const clean = s => String(s || 'izmjera').replace(/[^a-z0-9čćžšđ_-]/gi, '_');

/* ---------- tablet: izvoz za kompjuter ---------- */
function overlay(html) {
  let d = $('pcOv'); if (!d) { d = document.createElement('div'); d.id = 'pcOv'; d.style.cssText = 'position:fixed;inset:0;z-index:100001;background:#0008;display:flex;align-items:center;justify-content:center;padding:16px'; document.body.appendChild(d); }
  d.style.display = 'flex'; d.innerHTML = '<div style="background:#fff;border-radius:14px;padding:18px 20px;max-width:520px;width:100%;font:16px Arial;color:#102b52;line-height:1.45">' + html + '</div>'; d.hidden = false; return d;
}
async function pcExport() {
  const app = window.IzmjeraApp, TU = window.IzmjeraTlocrtUI; if (!app) return;
  try { app.save(); } catch (e) { }
  const floors = (app.allFloors ? app.allFloors() : app.floors()) || [];
  let total = 0, done = 0, empty = 0;
  if (TU && TU.inkOk && TU.inkOk()) {
    try { TU.inkPrepare(); } catch (e) { }
    const per = floors.map(f => { try { return TU.inkTodoCount(f); } catch (e) { return 0; } }); total = per.reduce((a, b) => a + b, 0);
    if (total) {
      const show = () => overlay('<b style="font-size:18px">💻 Pripremam za kompjuter</b><p style="margin:10px 0 4px">Čitam rukom pisane kote… <b>' + done + ' / ' + total + '</b></p><div style="height:8px;background:#e2e8f0;border-radius:5px;overflow:hidden"><div style="height:100%;width:' + Math.round(done / total * 100) + '%;background:#1e40af"></div></div><p style="font-size:13px;color:#475569;margin:10px 0 0">Na kompjuteru nema čitanja rukopisa, zato se kote pročitaju ovdje.</p>');
      show();
      for (let i = 0; i < floors.length; i++) { if (!per[i]) continue; try { const r = await TU.prepRec(floors[i], () => { done++; show(); }); empty += r.empty; } catch (e) { } }
      try { app.save(); } catch (e) { }
    }
  }
  const name = clean(($('project') && $('project').value) || (app.projectName && app.projectName())) + '_za_PC.json';
  const json = JSON.stringify(app.pack(), null, 2);
  const d = $('pcOv'); if (d) d.remove();
  let saved = false; try { saved = !!(window.IzmjeraSpremi && IzmjeraSpremi.autoText(name, 'application/json', json)); } catch (e) { }
  if (!saved) { if (A && A.exportJson) A.exportJson(name, json); else { const url = URL.createObjectURL(new Blob([json], { type: 'application/json' })), a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); } }
  const read = total - empty;
  const box = overlay('<b style="font-size:18px">💻 Spremljeno za kompjuter</b><p style="margin:10px 0">Datoteka: <b>' + name.replace(/</g, '&lt;') + '</b>' + (saved ? ' (u mapi projekta)' : '') + '</p>' +
    (total ? '<p style="margin:0 0 10px">Pročitano kota: <b>' + read + ' / ' + total + '</b>' + (empty ? '<br><span style="color:#b91c1c">' + empty + ' nije pročitano – upisat ćeš ih na kompjuteru.' + (read === 0 ? ' (Čitanje rukopisa prvi put treba internet.)' : '') + '</span>' : '') + '</p>' : '<p style="margin:0 0 10px">✓ Sve rukom pisane kote već su pročitane.</p>') +
    '<p style="margin:0 0 14px;font-size:14px;color:#475569">Na kompjuteru otvori <b>Izmjera 57</b> i povuci ovu datoteku u prozor (ili <b>📂 Otvori izmjeru s tableta</b>). Tamo uredi kote i izvezi DXF. Promjene na kompjuteru ne vraćaju se na tablet.</p>' +
    '<div style="text-align:right"><button id="pcOk" style="background:#1e40af;color:#fff;border:0;border-radius:9px;padding:10px 18px;font:700 16px Arial">U redu</button></div>');
  box.querySelector('#pcOk').onclick = () => { box.remove(); };
}
function bindTablet() { const b = $('pcExport'); if (b && !b.dataset.pc) { b.dataset.pc = '1'; b.onclick = e => { e.preventDefault(); pcExport(); }; } }

/* ---------- kompjuter ---------- */
async function openFile(file) {
  if (!file) return;
  if (!/\.json$/i.test(file.name) && file.type !== 'application/json') { alert('To nije izmjera (.json). Na tabletu u crtežu: ⋯ → 💻 Za kompjuter.'); return; }
  if (file.size > 40 * 1024 * 1024) { alert('Datoteka je prevelika (najviše 40 MB).'); return; }
  const raw = await file.text();
  if (window.receiveImportedJson) window.receiveImportedJson(raw, { pc: true });
}
function pickFile() { let inp = $('pcFile'); if (!inp) { inp = document.createElement('input'); inp.type = 'file'; inp.id = 'pcFile'; inp.accept = '.json,application/json'; inp.hidden = true; inp.onchange = () => { const f = inp.files && inp.files[0]; inp.value = ''; openFile(f); }; document.body.appendChild(inp); } inp.click(); }
function homeVisible() { const h = $('home'); return !h || !(h.hidden || getComputedStyle(h).display === 'none'); }
function addHomeButton() {
  if ($('pcOpen')) return; const np = $('newproject'); if (!np) return;
  const b = document.createElement('button'); b.id = 'pcOpen'; b.type = 'button'; b.innerHTML = '📂 Otvori izmjeru s tableta<small>ili povuci .json datoteku u prozor</small>'; b.onclick = pickFile;
  np.after(b);
}
function setupPc() {
  document.documentElement.classList.add('iz-pc');
  /* preuzimanje datoteka (DXF, JSON…) uvijek s pravim nazivom – poveznica se prije klika stavi u stranicu */
  { const ck = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { if (this.download && !this.isConnected) { this.style.display = 'none'; document.body.appendChild(this); try { return ck.call(this); } finally { setTimeout(() => this.remove(), 0); } } return ck.call(this); }; }
  const st = document.createElement('style');
  st.textContent = '.iz-pc #izNumPad,.iz-pc .iz-pad,.iz-pc #pcExport,.iz-pc #saveFolderBtn{display:none!important}' +
    '#pcOpen{display:block;width:100%;box-sizing:border-box;margin:10px 0 0;padding:12px 14px;border:2px dashed #1e40af;border-radius:14px;background:#fff;color:#1e3a8a;font:700 16px Arial;text-align:left;cursor:pointer}#pcOpen small{display:block;font:400 12px Arial;color:#64748b;margin-top:3px}#pcOpen:hover{background:#eff6ff}' +
    '#pcDrop{position:fixed;inset:0;z-index:100002;background:rgba(30,64,175,.18);display:none;align-items:center;justify-content:center;pointer-events:none}#pcDrop div{background:#fff;border:3px dashed #1e40af;border-radius:18px;padding:28px 40px;font:700 22px Arial;color:#1e3a8a}' +
    '.iz-pc canvas{cursor:crosshair}';
  document.head.appendChild(st);
  const drop = document.createElement('div'); drop.id = 'pcDrop'; drop.innerHTML = '<div>📂 Pusti datoteku za otvaranje izmjere</div>'; document.body.appendChild(drop);
  let depth = 0; const hasFile = e => e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files');
  addEventListener('dragenter', e => { if (!hasFile(e)) return; e.preventDefault(); depth++; drop.style.display = 'flex'; });
  addEventListener('dragover', e => { if (!hasFile(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
  addEventListener('dragleave', e => { if (!hasFile(e)) return; depth = Math.max(0, depth - 1); if (!depth) drop.style.display = 'none'; });
  addEventListener('drop', e => { if (!hasFile(e)) return; e.preventDefault(); depth = 0; drop.style.display = 'none'; const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (!homeVisible() && !confirm('Otvoriti izmjeru iz datoteke „' + (f && f.name) + '”?\n\nTrenutni crtež je spremljen.')) return; try { window.IzmjeraFlush && IzmjeraFlush(); } catch (er) { } openFile(f); });
  /* tipkovnica: Ctrl+Z / Ctrl+Y u crtežu */
  addEventListener('keydown', e => {
    const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    { const vp = $('vdPanel'); if (vp && vp.offsetParent && !e.ctrlKey && !e.metaKey && !e.altKey) { /* 📏 Mjeri: brojevi s tipkovnice */
      const key = /^[0-9]$/.test(e.key) ? e.key : (e.key === ',' || e.key === '.') ? ',' : e.key === 'Backspace' ? '⌫' : null;
      const bt = key ? vp.querySelector('[data-k="' + key + '"]') : e.key === 'Enter' ? vp.querySelector('[data-a="ok"]') : null;
      if (bt) { e.preventDefault(); bt.click(); return; } } }
    if (!(e.ctrlKey || e.metaKey)) return; const k = e.key.toLowerCase();
    if (homeVisible() || ($('tlWiz') && !$('tlWiz').hidden)) return;
    if (k === 'z' && !e.shiftKey) { const b = $('undo'); if (b) { e.preventDefault(); b.click(); } }
    else if (k === 'y' || (k === 'z' && e.shiftKey)) { const b = $('redo'); if (b) { e.preventDefault(); b.click(); } }
  });
  addHomeButton(); new MutationObserver(() => addHomeButton()).observe(document.body, { childList: true, subtree: true });
}

if (isPc) setupPc(); else { bindTablet(); document.addEventListener('DOMContentLoaded', bindTablet); }
window.IzmjeraPC = { isPc, pcExport, openFile };
})();
