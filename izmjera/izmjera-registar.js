/* Izmjera 57 — v2.13: REGISTAR PROJEKATA (Google tablica). Sinkronizacija popisa projekata s tabletom:
   projekti s tableta → redovi u tablici (broj, mapa na Disku, rok u kalendaru dodaje tablica), redovi iz tablice → projekti na tabletu (📎 podloge, 💬 savjetovanje…).
   Novija izmjena pobjeđuje, red po red. Veza: <web app URL>?k=<ključ> (Registar → 🔗 Veza za tablet i mobitel). */
(function () {
'use strict';
const PKEY = 'terenska-izmjera-projects-v13', UK = 'izmjera-registar-url', LK = 'izmjera-registar-last', SK = 'izmjera-registar-since', EK = 'izmjera-registar-err', SHK = 'izmjera-registar-sheet';
const $ = id => document.getElementById(id);
const ls = { get: k => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }, set: (k, v) => { try { if (v === '' || v == null) localStorage.removeItem(k); else localStorage.setItem(k, String(v)); } catch (e) { } } };
const HM = () => (window.IzmjeraApp && IzmjeraApp.home) || null;
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const VR = ['etazni', 'legalizacija', 'energetski', 'statika', 'procjena', 'savjetovanje', 'nadzor', 'tlocrt', 'troskovnik', 'ostalo'];
function cfg() { const u = ls.get(UK); if (!u) return null; try { const x = new URL(u); const k = x.searchParams.get('k'); if (!k) return null; x.search = ''; return { url: x.toString(), k }; } catch (e) { return null; } }
const on = () => !!cfg();
/* HTTP: na tabletu preko Jave (bez CORS ograničenja), u pregledniku fetch */
let hid = 0; const pend = {};
window.__httpCb = (id, code, text) => { const f = pend[id]; if (!f) return; delete pend[id]; f(code, text); };
function post(url, body) {
  return new Promise((res, rej) => {
    if (window.AndroidApp && AndroidApp.http) { const id = 'h' + (++hid); const to = setTimeout(() => { if (pend[id]) { delete pend[id]; rej(new Error('nema odgovora (veza?)')); } }, 90000);
      pend[id] = (code, text) => { clearTimeout(to); if (code >= 200 && code < 300) res(text); else rej(new Error(code < 0 ? 'nema interneta (' + text + ')' : 'greška ' + code)); }; AndroidApp.http(id, url, body); return; }
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body, redirect: 'follow' }).then(r => r.text()).then(res, rej);
  });
}
/* ---------- projekt ↔ stavka ---------- */
const getPs = () => { try { return JSON.parse(localStorage.getItem(PKEY) || '[]'); } catch (e) { return []; } };
const setPs = ps => { const H = HM(); if (H && H.setProjects) H.setProjects(ps); else localStorage.setItem(PKEY, JSON.stringify(ps)); };
function raw(id) { const H = HM(); try { return JSON.parse((H && H.getProjRaw(id)) || 'null'); } catch (e) { return null; } }
const isOpen = id => { const h = $('home'); return !!(h && h.classList.contains('hidden') && window.IzmjeraApp && IzmjeraApp.projectId && IzmjeraApp.projectId() === id); };
function toItem(pr, data) {
  const i = (isOpen(pr.id) ? window.projectInfo : (data && data.info)) || {}, t = i.tijek || {}, s = t.sastanak || {}, p = t.ponuda || {};
  const inv = (i.invIme || s.who || '').trim(); let opis = String(pr.name || ''); if (inv && opis.indexOf(inv + ' – ') === 0) opis = opis.slice(inv.length + 3); if (opis === inv) opis = '';
  const T = window.IzmjeraTijek; const izvor = i.izvor || (pr.thumb ? 'izmjera' : '');
  return { id: pr.id, broj: i.broj || pr.broj || '', inv, opis, vrsta: (i.vrsta || pr.vrsta || []).filter(v => VR.includes(v)), izvor, status: T ? T.statusOf(t, pr.done, izvor) : '',
    adresa: i.adresa || '', kc: i.kc || '', ko: i.ko || '', tel: s.tel || '', mail: s.mail || '', sastanak: s.when || '', sent: p.sent || '', iznos: p.iznos == null ? '' : p.iznos, rok: t.rokP || '', placeno: !!t.placeno,
    napomena: i.napomene || '', calSast: !!s.cal, mod: pr.rmod || 0 };
}
const today = () => new Date().toISOString().slice(0, 10);
function applyItem(it, info) {
  info = info || {}; const t = info.tijek = info.tijek || {}, s = t.sastanak = t.sastanak || {}, p = t.ponuda = t.ponuda || {};
  const setv = (o, k, v) => { if (v === '' || v == null || v === false) delete o[k]; else o[k] = v; };
  setv(info, 'invIme', it.inv); setv(info, 'adresa', it.adresa); setv(info, 'kc', it.kc); setv(info, 'ko', it.ko); setv(info, 'broj', it.broj); setv(info, 'mapa', it.mapa); setv(info, 'izvor', it.izvor); setv(info, 'napomene', it.napomena);
  if (it.vrsta && it.vrsta.length) info.vrsta = it.vrsta.filter(v => VR.includes(v)); else delete info.vrsta;
  setv(s, 'tel', it.tel); setv(s, 'mail', it.mail); if ((s.when || '') !== (it.sastanak || '')) { setv(s, 'when', it.sastanak); if (s.cal && s.cal.when !== s.when && !it.sastanak) delete s.cal; }
  setv(p, 'sent', it.sent); setv(p, 'iznos', it.iznos === '' ? null : it.iznos); setv(t, 'rokP', it.rok); setv(t, 'placeno', !!it.placeno);
  const st = it.status || ''; delete t.status;
  if (st === 'Prihvaćeno') { if (p.ans !== 'da') { p.ans = 'da'; p.ansAt = p.ansAt || today(); } }
  else if (st === 'Odbijeno') { if (p.ans !== 'ne') { p.ans = 'ne'; p.ansAt = p.ansAt || today(); } }
  else if (st === 'Ponuda poslana') { delete p.ans; delete p.ansAt; if (!p.sent) p.sent = today(); }
  else if (st === 'Sastanak') { delete p.ans; delete p.ansAt; }
  if (['U izradi', 'Predano', 'Obavljeno'].includes(st)) t.status = st;
  else if (st && window.IzmjeraTijek && IzmjeraTijek.statusOf(t, false, it.izvor) !== st) t.status = st;
  for (const o of [s, p]) if (!Object.keys(o).length) delete t[o === s ? 'sastanak' : 'ponuda'];
  if (!Object.keys(t).length) delete info.tijek;
  return info;
}
const nameOf = it => [it.inv, it.opis].filter(Boolean).join(' – ') || it.broj || 'Projekt';
function addrOf(info) { return [info.adresa, info.kc ? 'k.č. ' + info.kc : '', info.ko ? 'k.o. ' + info.ko : '', info.invIme].filter(Boolean).join(' · '); }
/* ---------- v2.39: REGISTAR ODVOJEN OD IZMJERA ----------
   Projekti žive samo u tablici (popis se čuva na tabletu za rad bez interneta). Izmjera na tabletu je samo POVEZANA s projektom (pr.regId).
   Mape na Disku radiš sam – tablica ih pronađe. Tablet šalje samo izmjene projekata koje napraviš na tabletu i popis povezanih izmjera. */
const RIK = 'izmjera-reg-items', REK = 'izmjera-reg-edits', RLK = 'izmjera-reg-links', MIG = 'izmjera-reg-v3';
const jget = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
const jset = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } };
function items() { const L = jget(RIK, []), E = jget(REK, {}), m = {}; L.forEach(x => m[x.id] = x); Object.values(E).forEach(x => { if (x._del) delete m[x.id]; else m[x.id] = Object.assign({}, m[x.id] || {}, x); }); return Object.values(m); }
const item = id => items().find(x => x.id === id) || null;
function saveItem(it) { const E = jget(REK, {}); it.mod = Date.now(); E[it.id] = Object.assign({}, it); jset(REK, E); soon(); }
function delItem(id) { const E = jget(REK, {}); delete E[id]; jset(REK, E); jset(RIK, jget(RIK, []).filter(x => x.id !== id)); markDeleted(id); }
const newId = () => 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
/* izmjere povezane s projektom */
const linkedIzm = rid => getPs().find(p => p.regId === rid) || null;
function link(pid, rid) { const ps = getPs(), pr = ps.find(p => p.id === pid); if (!pr) return; ps.forEach(p => { if (p.regId === rid && p.id !== pid) delete p.regId; }); if (rid) pr.regId = rid; else delete pr.regId; setPs(ps); fillLinked(); soon(); }
/* broj i mapa iz registra → u izmjeru (za spremanje DXF/PDF u mapu projekta) */
function fillLinked() { const H = HM(); if (!H) return; const byId = {}; items().forEach(x => byId[x.id] = x); const ps = getPs(); let ch = false;
  for (const pr of ps) { const it = pr.regId && byId[pr.regId], want = it ? (it.broj || '') : (pr.regId ? pr.broj || '' : ''); if (!pr.regId) continue; if (!it) continue;
    if ((pr.broj || '') !== want) { if (want) pr.broj = want; else delete pr.broj; ch = true; }
    try { const open = isOpen(pr.id), d = open ? null : raw(pr.id), inf = open ? window.projectInfo : d && d.info; if (!inf) continue;
      if ((inf.broj || '') !== (it.broj || '') || (inf.mapa || '') !== (it.mapa || '')) { if (it.broj) inf.broj = it.broj; else delete inf.broj; if (it.mapa) inf.mapa = it.mapa; else delete inf.mapa; if (d) { d.info = inf; H.storeProject(pr.id, JSON.stringify(d)); } else try { IzmjeraApp.save(); } catch (e) { } } } catch (e) { } }
  if (ch) setPs(ps); }
/* jednom: stari način (svaki projekt s tableta = red u tablici) → novi */
function migrate() { if (ls.get(MIG)) return; const ps = getPs(), E = jget(REK, {}); const izm = p => !!p.thumb || (!/^r/.test(String(p.id)) && !p.mt && !['podloge', 'savjet'].includes(p.izvor));
  for (const pr of ps) { if (izm(pr)) { if (pr.reg) pr.regId = pr.id; }
    else { pr.hidden3 = true; if (!pr.reg) { try { const it = toItem(pr, raw(pr.id)); it.mod = Date.now(); E[it.id] = it; } catch (e) { } } }
    delete pr.reg; delete pr.rmod; }
  setPs(ps); jset(REK, E); ls.set(MIG, '1'); }
/* ---------- sinkronizacija ---------- */
let busy = false, soonT = null, lastTry = 0, again = false;
const DRK = 'izmjera-reg-dirty'; /* v2.82: ima izmjena (zadaci, projekti) koje još nisu poslane */
function payload(c) { const E = jget(REK, {}), sent = Object.values(E).filter(x => !x._del).map(x => { const o = Object.assign({}, x); if ((jget(RIK, [])).some(y => y.id === x.id)) o.known = true; return o; });
  const del = getDel(), ps = getPs(), links = {}, prev = jget(RLK, {});
  ps.forEach(p => { if (p.regId) links[p.regId] = p.name || 'izmjera'; }); Object.keys(prev).forEach(id => { if (!(id in links)) links[id] = ''; });
  const K = window.IzmjeraKartice, tasks = K ? K.forSync() : null;
  return { sent, del, links, K, body: JSON.stringify({ k: c.k, a: 'sync', items: sent, tasks, del, links, skr: Object.keys(jget('izmjera-zad-skriveno', {})) }) }; }
async function sync(manual) {
  const c = cfg(); if (!c) { if (manual) settings(); return; } if (busy) { again = true; return; } busy = true; lastTry = Date.now(); paint('🔄 sinkroniziram…');
  try { migrate();
    const t0 = Date.now(), PL = payload(c), sent = PL.sent, del = PL.del, links = PL.links, K = PL.K;
    const txt = await post(c.url, PL.body);
    let r; try { r = JSON.parse(txt); } catch (e) { throw new Error(/<html|<!DOCTYPE/i.test(txt) ? 'tablica nije objavljena kao Web app (Deploy → Web app, pristup: Anyone)' : 'neispravan odgovor'); }
    if (!r.ok) throw new Error(r.err || 'greška u tablici');
    if (!r.v || r.v < 3) throw new Error('u tablici je stara skripta – zalijepi novu Code.gs i objavi novu verziju (Deploy → Manage deployments → ✏ → New version)');
    if (r.sheet) ls.set(SHK, r.sheet);
    setDel(getDel().filter(id => !del.includes(id)));
    const E2 = jget(REK, {}); for (const x of sent) if (E2[x.id] && (E2[x.id].mod || 0) <= (x.mod || 0)) delete E2[x.id]; for (const id of r.gone || []) delete E2[id]; jset(REK, E2);
    if (r.skr && typeof r.skr === 'object') { const o = jget('izmjera-zad-skriveno', {}); Object.keys(r.skr).forEach(k => o[k] = 1); jset('izmjera-zad-skriveno', o); } /* v2.44: odbačeni prijedlozi isti na mobitelu i tabletu */ jset(RIK, (r.items || []).filter(x => x && x.id)); const lk = {}; Object.keys(links).forEach(id => { if (links[id]) lk[id] = 1; }); jset(RLK, lk);
    fillLinked();
    if (K && r.tasks) K.fromSync(r.tasks, t0); ls.set('izmjera-zad-err', r.tasksErr || '');
    ls.set(LK, Date.now()); ls.set(EK, ''); if ((+ls.get(DRK) || 0) <= t0) ls.set(DRK, ''); setTimeout(() => flush(false), 500);
    paint(); try { const h = $('home'); if (h && !h.classList.contains('hidden')) HM().listProjects(); } catch (e) { }
    if (manual) toast('✓ Registar: ' + (r.items || []).length + ' projekata');
  } catch (e) { ls.set(EK, e.message || String(e)); paint(); if (manual) alert('Sinkronizacija s registrom nije uspjela:\n' + (e.message || e)); }
  finally { busy = false; if (again) { again = false; setTimeout(() => sync(false), 800); } }
}
/* ---------- v2.17: datoteke u mapu projekta na Disku (DXF, PDF, Excel, fotke, kopija projekta) ---------- */
const QK = 'izmjera-disk-red';
const getQ = () => { try { return JSON.parse(localStorage.getItem(QK) || '[]'); } catch (e) { return []; } };
const setQ = q => { try { localStorage.setItem(QK, JSON.stringify(q)); } catch (e) { q.splice(0, Math.max(1, q.length - 3)); try { localStorage.setItem(QK, JSON.stringify(q)); } catch (e2) { } } };
function curBroj() { const i = window.projectInfo || {}; return i.broj || ''; }
/* vrati true ako će datoteka ići na Disk (projekt je u registru) */
function upload(name, mime, b64, opt) { const c = cfg(), broj = (opt && opt.broj) || curBroj(); if (!c || !broj) return false;
  const q = getQ().filter(x => !(x.broj === broj && x.name === name)); q.push(Object.assign({ broj, name, mime, b64, at: Date.now() }, opt && opt.photo ? { photo: opt.photo, b64: '' } : {})); setQ(q); flush(!(opt && opt.quiet)); return true; }
let flushing = false;
async function flush(show) { const c = cfg(); if (!c || flushing) return; const q = getQ(); if (!q.length) return; flushing = true;
  try { while (getQ().length) { const x = getQ()[0]; let r; if (x.photo) { try { x.b64 = String((window.AndroidApp && AndroidApp.loadPhoto && AndroidApp.loadPhoto(x.photo)) || '').replace(/^data:image\/\w+;base64,/, ''); } catch (e) { x.b64 = ''; } if (!x.b64) { setQ(getQ().slice(1)); continue; } }
      try { r = JSON.parse(await post(c.url, JSON.stringify({ k: c.k, a: 'upload', broj: x.broj, name: x.name, mime: x.mime, b64: x.b64 }))); } catch (e) { if (show) toast('📁 Disk: nema veze – poslat ću kasnije (' + x.name + ')'); break; }
      if (!r.ok) { if (show) toast('📁 Disk: ' + (r.err || 'greška') + ' (' + x.name + ')'); if (/nije u registru|nema mapu/.test(r.err || '')) setQ(getQ().slice(1)); break; }
      setQ(getQ().slice(1)); if (show) toast('📁 Spremljeno na Disk: ' + x.broj + ' / Izmjera 57 / ' + x.name); } }
  finally { flushing = false; } }
/* fotke projekta i kopija projekta – pri izlasku iz projekta (najviše svakih 10 min po projektu) */
function backupProject(id) { const c = cfg(); if (!c) return; try { const H = HM(), raw = H.getProjRaw(id); if (!raw) return; const d = JSON.parse(raw), i = d.info || {}; if (!i.broj) return;
    const lk = 'izmjera-disk-kopija-' + id, last = +ls.get(lk) || 0; if (Date.now() - last < 10 * 60000) return; ls.set(lk, Date.now());
    const b64 = btoa(unescape(encodeURIComponent(raw))), nm = (i.broj + ' ' + (d.name || 'projekt')).replace(/[\\/:*?"<>|]+/g, '-') + ' (kopija Izmjera).json';
    upload(nm, 'application/json', b64, { broj: i.broj, quiet: true });
    const sent = i.diskFoto || [], ids = []; for (const f of d.floors || []) for (const o of f.items || []) if (o.type === 'photo' && o.id && !sent.includes(o.id)) ids.push([o.id, o.n, f.name]);
    if (ids.length && window.AndroidApp && AndroidApp.loadPhoto) { for (const [pid, n, fl] of ids) { upload('Foto ' + (n || pid) + ' – ' + (fl || '') + '.jpg', 'image/jpeg', '', { broj: i.broj, photo: pid, quiet: true }); sent.push(pid); }
      i.diskFoto = sent; d.info = i; H.storeProject(id, JSON.stringify(d)); } } catch (e) { } }
function soon() { if (!on()) return; ls.set(DRK, String(Date.now())); clearTimeout(soonT); soonT = setTimeout(() => sync(false), 1500); }
/* v2.82: kad se aplikacija zatvori ili ode u pozadinu prije slanja – pošalji odmah (na računalu sendBeacon, preživi zatvaranje kartice) */
function flushNow() { const c = cfg(); if (!c || !ls.get(DRK)) return; clearTimeout(soonT);
  if (window.AndroidApp && AndroidApp.http) { sync(false); return; }
  try { if (navigator.sendBeacon && navigator.sendBeacon(c.url, new Blob([payload(c).body], { type: 'text/plain;charset=utf-8' }))) return; } catch (e) { }
  sync(false); }
document.addEventListener('visibilitychange', () => { if (document.hidden) flushNow(); else if (on() && navigator.onLine !== false && Date.now() - Math.max(+ls.get(LK) || 0, lastTry) > 20000) sync(false); });
window.addEventListener('pagehide', flushNow); window.addEventListener('online', () => { if (on()) sync(false); });
function toast(t) { try { if (window.AndroidApp && AndroidApp.toast) { AndroidApp.toast(t); return; } } catch (e) { } const s = $('status'); if (s) s.textContent = t; }
/* ---------- izgled: gumb u lijevoj traci + postavke ---------- */
function ago(ms) { if (!ms) return 'još nije'; const m = Math.round((Date.now() - ms) / 60000); return m < 1 ? 'upravo' : m < 60 ? 'prije ' + m + ' min' : m < 1440 ? 'prije ' + Math.round(m / 60) + ' h' : new Date(ms).toLocaleDateString('hr'); }
function paint(msg) {
  const side = $('homeSide'); if (!side) return; let b = $('regBtn');
  if (!b) { b = document.createElement('button'); b.id = 'regBtn'; b.type = 'button'; b.className = 'hv2-file'; b.onclick = () => on() ? sync(true) : settings();
    const g = document.createElement('button'); g.id = 'regSet'; g.type = 'button'; g.className = 'hv2-file'; g.textContent = '⚙ Registar – postavke'; g.onclick = settings; g.style.fontWeight = '600';
    const sec = [...side.querySelectorAll('.hv2-sec')].find(x => x.textContent === 'DATOTEKE'); if (sec) { sec.after(b); b.after(g); } else { side.appendChild(b); side.appendChild(g); } }
  const err = ls.get(EK);
  b.innerHTML = on() ? '<span>☁</span><span style="display:flex;flex-direction:column;align-items:flex-start;gap:2px"><span>Google tablica</span><small style="font:600 11px Arial;color:' + (err ? '#b91c1c' : '#64748b') + '">' + esc(msg || (err ? '⚠ ' + err.slice(0, 60) : 'sinkronizirano ' + ago(+ls.get(LK)))) + '</small></span>' : '<span>🔗</span><span>Poveži registar projekata</span>';
  const g = $('regSet'); if (g) g.style.display = on() ? '' : 'none';
}
function settings() {
  const old = $('regOv'); if (old) old.remove(); const ov = document.createElement('div'); ov.id = 'regOv'; ov.style.cssText = 'position:fixed;inset:0;z-index:92;background:#0f2a4a99;overflow:auto;padding:16px';
  const BT = 'min-height:46px;padding:8px 14px;border-radius:10px;border:1px solid #cbd5e1;background:#fff;color:#0f2a4a;font:700 15px Arial', sh = ls.get(SHK);
  ov.innerHTML = '<div style="max-width:640px;margin:4vh auto;background:#f8fafc;border-radius:18px;overflow:hidden;font:15px Arial;color:#0f2a4a;box-shadow:0 12px 40px #0006"><div style="background:linear-gradient(135deg,#0f2a4a,#17457f);color:#fff;padding:16px 18px"><div style="font:700 12px Arial;color:#9fb6d3;letter-spacing:.6px">GOOGLE TABLICA</div><div style="font:800 21px Arial">🔄 Registar projekata</div></div><div style="padding:16px 18px">' +
    '<p style="margin:0 0 10px;color:#475569">Zalijepi vezu iz tablice (izbornik <b>Registar → 🔗 Veza za tablet i mobitel</b>).</p><textarea id="regUrl" rows="3" style="width:100%;box-sizing:border-box;padding:10px;font-size:14px;border:1px solid #cbd5e1;border-radius:10px" placeholder="https://script.google.com/macros/s/…/exec?k=…">' + esc(ls.get(UK)) + '</textarea>' +
    (on() ? '<p style="font-size:13px;color:#64748b">Zadnja sinkronizacija: ' + ago(+ls.get(LK)) + (ls.get(EK) ? ' · <span style="color:#b91c1c">⚠ ' + esc(ls.get(EK)) + '</span>' : '') + '</p>' : '') +
    '<p style="font-size:13px;color:#475569;line-height:1.45;margin:12px 0">Projekti se vode u tablici. Mape na Disku radiš sam – tablica ih sama pronađe i doda (svaki sat). Izmjere ostaju na tabletu; s projektom ih povežeš gumbom <b>📐</b> u kartici Projekti.</p>' + (sh ? '<div style="display:flex;gap:8px;flex-wrap:wrap"><button data-a="sheet" style="' + BT + '">📊 Otvori tablicu</button></div>' : '') +
    '</div><div style="display:flex;gap:8px;justify-content:flex-end;padding:12px 18px;background:#eef3f9;border-top:1px solid #e2e8f0">' + (on() ? '<button data-a="off" style="' + BT + ';margin-right:auto;color:#b91c1c">Odspoji</button>' : '') + '<button data-a="x" style="' + BT + '">Zatvori</button><button data-a="ok" style="' + BT + ';background:#17457f;color:#fff;border:0">Spremi i sinkroniziraj</button></div></div>';
  document.body.appendChild(ov);

  ov.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a;
    if (a === 'x') ov.remove();
    if (a === 'sheet') { const u = ls.get(SHK); try { if (window.AndroidApp && AndroidApp.openUri) AndroidApp.openUri(u); else window.open(u, '_blank'); } catch (er) { } }

    if (a === 'off') { if (!confirm('Odspojiti registar? Projekti na tabletu ostaju.')) return; ls.set(UK, ''); ls.set(EK, ''); ov.remove(); paint(); }
    if (a === 'ok') { const u = ov.querySelector('#regUrl').value.trim(); const wasOn = on(); ls.set(UK, u); if (!cfg()) { alert('Veza nije ispravna – treba izgledati ovako:\nhttps://script.google.com/macros/s/…/exec?k=…'); return; }

      ov.remove(); paint(); sync(true); } });
}
/* automatski: pri pokretanju, pri povratku na početni zaslon (najviše svakih 5 min) */
setInterval(() => { try { paint(); const h = $('home'), hv = h && !h.classList.contains('hidden'), zad = hv && window.IzmjeraKartice && IzmjeraKartice.tab() === 'zad', gap = Date.now() - Math.max(+ls.get(LK) || 0, lastTry);
  if (on() && navigator.onLine !== false && !document.hidden && ((ls.get(DRK) && gap > 15000) || (zad && gap > 60000) || (hv && gap > 5 * 60000))) sync(false); } catch (e) { } }, 3000); /* v2.82: na popisu zadataka svake minute, neposlano odmah */
const DK = 'izmjera-reg-del'; function getDel() { try { return JSON.parse(localStorage.getItem(DK) || '[]'); } catch (e) { return []; } } function setDel(a) { try { localStorage.setItem(DK, JSON.stringify(a)); } catch (e) { } }
function markDeleted(id) { const a = getDel(); if (!a.includes(id)) a.push(id); setDel(a); soon(); }
window.IzmjeraRegistar = { markDeleted, sync: () => sync(true), soon, on, settings, toItem, applyItem, upload, flush, backupProject, items, item, saveItem, delItem, newId, linkedIzm, link, migrate, sheetUrl: () => ls.get(SHK) };
try { migrate(); } catch (e) { }
})();
