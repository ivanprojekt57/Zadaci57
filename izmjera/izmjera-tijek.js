/* Izmjera 57 — v2.11: tijek posla po projektu: 📅 sastanak (s kim, kad, gdje → Google kalendar), 📝 bilješke i rokovnik (pisanje olovkom),
   📄 ponuda (poslana / prihvaćena / odbijena). Sprema se u projekt kao data.info.tijek, a sažetak u popis projekata (pr.tj). */
(function () {
'use strict';
const PKEY = 'terenska-izmjera-projects-v13', FK = 'izmjera-filter-tijek';
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const APP = () => window.IzmjeraApp || {}, HM = () => (window.IzmjeraApp && IzmjeraApp.home) || null;
const ST = { sastanak: ['📅', 'Sastanci', '#2563eb'], ponuda: ['⏳', 'Čeka odgovor', '#d97706'], izmjera: ['✅', 'Prihvaćeno', '#15803d'], izrada: ['🛠', 'U izradi', '#4f46e5'], rok: ['⏰', 'Rok ≤ 7 dana', '#dc2626'], naplata: ['💶', 'Nije plaćeno', '#b45309'], odbijeno: ['✖', 'Odbijeno', '#64748b'] };
const XST = { 'Sastanak': 'sastanak', 'Ponuda poslana': 'ponuda', 'Prihvaćeno': 'izmjera', 'Odbijeno': 'odbijeno', 'U izradi': 'izrada', 'Predano': 'predano', 'Obavljeno': 'predano' };
const DANI = ['ned', 'pon', 'uto', 'sri', 'čet', 'pet', 'sub'];
const pad = n => String(n).padStart(2, '0');
const parseWhen = s => { const m = /^(\d{4})-(\d\d)-(\d\d)(?:T(\d\d):(\d\d))?/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 9), +(m[5] || 0)) : null; };
const dayStart = d => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
function whenTxt(s, short) { const d = parseWhen(s); if (!d) return ''; const t = dayStart(new Date()), k = Math.round((dayStart(d) - t) / 864e5), hm = pad(d.getHours()) + ':' + pad(d.getMinutes());
  const day = k === 0 ? 'danas' : k === 1 ? 'sutra' : k === -1 ? 'jučer' : (DANI[d.getDay()] + ' ' + d.getDate() + '.' + (d.getMonth() + 1) + '.' + (short || d.getFullYear() === new Date().getFullYear() ? '' : d.getFullYear() + '.'));
  return day + ' ' + hm; }
const dateTxt = s => { const d = parseWhen(s); return d ? d.getDate() + '.' + (d.getMonth() + 1) + '.' + (d.getFullYear() !== new Date().getFullYear() ? d.getFullYear() + '.' : '') : ''; };
const today = () => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
function stage(t) { if (!t) return ''; if (t.status && XST[t.status]) return XST[t.status]; const p = t.ponuda || {}; if (p.ans === 'ne') return 'odbijeno'; if (p.ans === 'da') return 'izmjera'; if (p.sent) return 'ponuda'; const s = t.sastanak || {}; if (s.when || s.who) return 'sastanak'; return ''; }
function summ(t) { const s = (t && t.sastanak) || {}, p = (t && t.ponuda) || {}; const o = { st: stage(t), when: s.when || '', who: s.who || '', where: s.where || '', sent: p.sent || '', ans: p.ans || '', ansAt: p.ansAt || '' }; if (t && t.rokP) o.rok = t.rokP; if (t && t.placeno) o.placeno = true; if (p.iznos !== undefined && p.iznos !== '') o.iznos = p.iznos; return o; }
/* status za registar (tablicu) */
function statusOf(t, done, izvor) { if (t && t.status) return t.status; if (done) return izvor === 'savjet' ? 'Obavljeno' : 'Predano'; const st = stage(t); return { sastanak: 'Sastanak', ponuda: 'Ponuda poslana', izmjera: 'Prihvaćeno', odbijeno: 'Odbijeno' }[st] || ''; }
function getPs() { try { return JSON.parse(localStorage.getItem(PKEY) || '[]'); } catch (e) { return []; } }
function setSumm(id, t, extra) { try { const ps = getPs(), pr = ps.find(p => p.id === id); if (!pr) return; const s = summ(t); if (s.st || s.when || s.rok || s.iznos !== undefined || s.placeno) pr.tj = s; else delete pr.tj; if (extra) Object.assign(pr, extra); const st = t && t.status; if (st === 'Predano' || st === 'Obavljeno') pr.done = true; else if (st && pr.done) delete pr.done; pr.rmod = Date.now(); localStorage.setItem(PKEY, JSON.stringify(ps)); } catch (e) { } try { window.IzmjeraRegistar && IzmjeraRegistar.soon(); } catch (e) { } }
const isOpen = id => { const h = $('home'); return !!(h && h.classList.contains('hidden') && APP().projectId && APP().projectId() === id); };
function loadT(id) {
  if (isOpen(id)) { const i = window.projectInfo || {}; return { name: APP().projectName ? APP().projectName() : '', info: i, t: JSON.parse(JSON.stringify(i.tijek || {})) }; }
  const H = HM(); let data = null; try { data = JSON.parse(H.getProjRaw(id) || 'null'); } catch (e) { }
  if (!data) return null; return { name: data.name || '', info: data.info || {}, t: JSON.parse(JSON.stringify((data.info && data.info.tijek) || {})), data };
}
function saveT(id, t, L) {
  if (isOpen(id)) { window.projectInfo = window.projectInfo || {}; window.projectInfo.tijek = t; try { APP().save && APP().save(); } catch (e) { } }
  else { const H = HM(), d = L.data; d.info = d.info || {}; d.info.tijek = t; if (L.izvor !== undefined) { if (L.izvor) d.info.izvor = L.izvor; else delete d.info.izvor; } d.savedAt = Date.now(); H.storeProject(id, JSON.stringify(d)); }
  if (isOpen(id) && L.izvor !== undefined) { if (L.izvor) window.projectInfo.izvor = L.izvor; else delete window.projectInfo.izvor; try { APP().save && APP().save(); } catch (e) { } }
  const sx = t.sastanak || {}; setSumm(id, t, { izvor: L.izvor !== undefined ? (L.izvor || undefined) : ((L.info && L.info.izvor) || undefined), tel: sx.tel || undefined, mail: sx.mail || undefined });
}
/* ---------- Google kalendar ---------- */
function toCal(t, name) { const s = t.sastanak || {}, d = parseWhen(s.when); if (!d) { alert('Prvo upiši kad je sastanak (datum i sat).'); return false; }
  const b = d.getTime(), e = b + (+(s.dur || 60)) * 60000, title = 'Sastanak' + (s.who ? ': ' + s.who : '') + (name ? ' – ' + name : ''),
    desc = [s.tel ? 'Tel: ' + s.tel : '', s.who ? 'S kim: ' + s.who : '', name ? 'Projekt (Izmjera 57): ' + name : '', s.notes ? '\n' + s.notes : ''].filter(Boolean).join('\n');
  try { if (window.AndroidApp && window.AndroidApp.addCalendar) { window.AndroidApp.addCalendar(title, s.where || '', desc, b, e); return true; } } catch (er) { }
  const z = x => { const q = new Date(x); return q.getUTCFullYear() + pad(q.getUTCMonth() + 1) + pad(q.getUTCDate()) + 'T' + pad(q.getUTCHours()) + pad(q.getUTCMinutes()) + '00Z'; };
  const url = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(title) + '&dates=' + z(b) + '/' + z(e) + '&location=' + encodeURIComponent(s.where || '') + '&details=' + encodeURIComponent(desc);
  openUri(url); return true; }
function openUri(u) { try { if (window.AndroidApp && window.AndroidApp.openUri) { window.AndroidApp.openUri(u); return; } } catch (e) { } try { window.open(u, '_blank'); } catch (e) { } }
/* ---------- rokovnik (pisanje i crtanje olovkom) ---------- */
const PW = 1400, PH = 990;
function paper(g, k, ox, oy, kind) { g.save(); g.fillStyle = '#fffef8'; g.fillRect(ox, oy, PW * k, PH * k); const st = kind === 'crte' ? 45 : 30; g.strokeStyle = '#dbe7f5'; g.lineWidth = 1;
  g.beginPath(); for (let y = st; y < PH; y += st) { g.moveTo(ox, oy + y * k); g.lineTo(ox + PW * k, oy + y * k); } if (kind !== 'crte') for (let x = st; x < PW; x += st) { g.moveTo(ox + x * k, oy); g.lineTo(ox + x * k, oy + PH * k); } g.stroke();
  if (kind === 'crte') { g.strokeStyle = '#fca5a5'; g.beginPath(); g.moveTo(ox + 90 * k, oy); g.lineTo(ox + 90 * k, oy + PH * k); g.stroke(); } g.restore(); }
function strokeDraw(g, s, k, ox, oy) { const P = s.p; if (!P || !P.length) return; g.strokeStyle = s.c; g.fillStyle = s.c; g.lineCap = 'round'; g.lineJoin = 'round';
  if (P.length === 1) { g.beginPath(); g.arc(ox + P[0][0] * k, oy + P[0][1] * k, Math.max(.6, s.w * k / 2), 0, 7); g.fill(); return; }
  for (let i = 1; i < P.length; i++) { const a = P[i - 1], b = P[i]; g.lineWidth = Math.max(.6, s.w * k * (0.55 + 0.9 * ((b[2] == null ? 50 : b[2]) / 100))); g.beginPath(); g.moveTo(ox + a[0] * k, oy + a[1] * k); g.lineTo(ox + b[0] * k, oy + b[1] * k); g.stroke(); } }
function pageThumb(pg, W) { const c = document.createElement('canvas'), k = W / PW; c.width = W; c.height = Math.round(PH * k); const g = c.getContext('2d'); paper(g, k, 0, 0, pg && pg.k); for (const s of (pg && pg.s) || []) strokeDraw(g, s, k, 0, 0); return c; }
function rokovnik(t, title, onDone) {
  t.rok = Array.isArray(t.rok) && t.rok.length ? t.rok : [{ k: 'kocke', s: [] }];
  let pi = 0, col = '#0f172a', wd = 3, erase = false, penSeen = false, cur = null, undo = [];
  const ov = document.createElement('div'); ov.id = 'rokOv'; ov.style.cssText = 'position:fixed;inset:0;z-index:95;background:#cbd5e1;display:flex;flex-direction:column;touch-action:none;user-select:none;-webkit-user-select:none';
  const B = 'min-height:46px;min-width:46px;padding:6px 12px;border-radius:10px;border:1px solid #cbd5e1;background:#fff;color:#0f2a4a;font:700 15px Arial';
  ov.innerHTML = '<div style="display:flex;gap:6px;align-items:center;padding:8px 10px;background:#0f2a4a;color:#fff;flex-wrap:wrap">' +
    '<button data-a="back" style="' + B + '">← Gotovo</button><b style="font:800 16px Arial;margin:0 8px;max-width:28vw;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">📝 ' + esc(title) + '</b>' +
    '<button data-a="prev" style="' + B + '">◀</button><span data-a="pg" style="font:700 15px Arial;min-width:64px;text-align:center"></span><button data-a="next" style="' + B + '">▶</button><button data-a="add" style="' + B + '">＋ stranica</button>' +
    '<span style="flex:1"></span>' + ['#0f172a', '#1d4ed8', '#dc2626', '#15803d'].map(c => '<button data-c="' + c + '" style="' + B + ';min-width:44px;padding:0"><span style="display:inline-block;width:22px;height:22px;border-radius:50%;background:' + c + '"></span></button>').join('') +
    '<button data-w="2" style="' + B + '">tanko</button><button data-w="5" style="' + B + '">debelo</button><button data-a="er" style="' + B + '">Gumica</button><button data-a="paper" style="' + B + '">▦/☰</button><button data-a="undo" style="' + B + '">↶</button><button data-a="del" style="' + B + '">🗑</button></div>' +
    '<div style="flex:1;position:relative;overflow:hidden"><canvas style="position:absolute;inset:0;width:100%;height:100%"></canvas></div>';
  document.body.appendChild(ov);
  const cv = ov.querySelector('canvas'), g = cv.getContext('2d'); let k = 1, ox = 0, oy = 0, dpr = 1;
  const fit = () => { const r = cv.getBoundingClientRect(); dpr = window.devicePixelRatio || 1; cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); k = Math.min((r.width - 20) / PW, (r.height - 20) / PH); ox = (r.width - PW * k) / 2; oy = (r.height - PH * k) / 2; draw(); };
  const pg = () => t.rok[pi];
  function draw() { g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, cv.width, cv.height); g.save(); g.shadowColor = 'rgba(0,0,0,.25)'; g.shadowBlur = 10; g.fillStyle = '#fff'; g.fillRect(ox, oy, PW * k, PH * k); g.restore(); paper(g, k, ox, oy, pg().k); for (const s of pg().s) strokeDraw(g, s, k, ox, oy); if (cur) strokeDraw(g, cur, k, ox, oy); sync(); }
  function sync() { ov.querySelector('[data-a=pg]').textContent = (pi + 1) + ' / ' + t.rok.length; ov.querySelectorAll('[data-c]').forEach(b => b.style.outline = !erase && b.dataset.c === col ? '3px solid #60a5fa' : ''); ov.querySelectorAll('[data-w]').forEach(b => { const on = +b.dataset.w === wd; b.style.background = on ? '#dbeafe' : '#fff'; }); const e = ov.querySelector('[data-a=er]'); e.style.background = erase ? '#fde68a' : '#fff'; }
  const P = e => { const r = cv.getBoundingClientRect(); return [Math.round((e.clientX - r.left - ox) / k * 10) / 10, Math.round((e.clientY - r.top - oy) / k * 10) / 10, Math.round((e.pressure || .5) * 100)]; };
  const snap = () => { undo.push(JSON.stringify(pg().s)); if (undo.length > 60) undo.shift(); };
  const eraseAt = p => { const s0 = pg().s, n = s0.filter(s => !s.p.some(q => Math.hypot(q[0] - p[0], q[1] - p[1]) < 14)); if (n.length !== s0.length) { pg().s = n; draw(); } };
  let pid = null;
  cv.addEventListener('pointerdown', e => { if (e.pointerType === 'pen') penSeen = true; if (e.pointerType === 'touch' && penSeen) return; if (pid != null) return; pid = e.pointerId; try { cv.setPointerCapture(pid); } catch (er) { } snap(); const p = P(e); if (erase || e.button === 5 || e.buttons === 32) { cur = null; eraseAt(p); } else cur = { c: col, w: wd, p: [p] }; draw(); e.preventDefault(); });
  cv.addEventListener('pointermove', e => { if (e.pointerId !== pid) return; const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e]; for (const q of evs) { const p = P(q); if (!cur) eraseAt(p); else { const l = cur.p[cur.p.length - 1]; if (Math.hypot(l[0] - p[0], l[1] - p[1]) > 0.8) cur.p.push(p); } } if (cur) draw(); e.preventDefault(); });
  const up = e => { if (e.pointerId !== pid) return; pid = null; if (cur) { pg().s.push(cur); cur = null; } else if (undo.length && undo[undo.length - 1] === JSON.stringify(pg().s)) undo.pop(); draw(); };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  ov.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; const a = b.dataset.a;
    if (b.dataset.c) { col = b.dataset.c; erase = false; } else if (b.dataset.w) { wd = +b.dataset.w; erase = false; }
    else if (a === 'back') { ov.remove(); removeEventListener('resize', fit); onDone && onDone(); return; }
    else if (a === 'prev') { if (pi > 0) { pi--; undo = []; } } else if (a === 'next') { if (pi < t.rok.length - 1) { pi++; undo = []; } }
    else if (a === 'add') { t.rok.splice(pi + 1, 0, { k: pg().k, s: [] }); pi++; undo = []; }
    else if (a === 'er') erase = !erase; else if (a === 'paper') { pg().k = pg().k === 'crte' ? 'kocke' : 'crte'; }
    else if (a === 'undo') { if (undo.length) pg().s = JSON.parse(undo.pop()); }
    else if (a === 'del') { if (pg().s.length && !confirm('Obrisati cijelu stranicu ' + (pi + 1) + '?')) return; if (t.rok.length > 1) { t.rok.splice(pi, 1); pi = Math.max(0, pi - 1); } else t.rok[0] = { k: pg().k, s: [] }; undo = []; }
    draw(); });
  addEventListener('resize', fit); requestAnimationFrame(fit);
}
/* ---------- kartica: sastanak + ponuda ---------- */
function dialog(id, opts) {
  opts = opts || {}; let L = id ? loadT(id) : { name: '', info: {}, t: {} }; if (!L) { alert('Projekt nije pronađen.'); return; }
  const t = L.t; t.sastanak = t.sastanak || {}; t.ponuda = t.ponuda || {}; const s = t.sastanak, p = t.ponuda;
  if (!s.where && L.info && L.info.adresa) s.where = L.info.adresa;
  const old = $('tjOv'); if (old) old.remove();
  const ov = document.createElement('div'); ov.id = 'tjOv'; ov.style.cssText = 'position:fixed;inset:0;z-index:90;background:#0f2a4a99;overflow:auto;padding:16px;box-sizing:border-box';
  const IN = 'width:100%;box-sizing:border-box;padding:11px;font-size:16px;border:1px solid #cbd5e1;border-radius:10px;background:#fff;color:#0f2a4a';
  const BT = 'min-height:46px;padding:8px 14px;border-radius:10px;border:1px solid #cbd5e1;background:#fff;color:#0f2a4a;font:700 15px Arial;white-space:nowrap';
  const lab = (t1, inner) => '<label style="display:block;margin:0 0 10px"><span style="display:block;font:700 12px Arial;color:#64748b;margin-bottom:4px">' + t1 + '</span>' + inner + '</label>';
  function render() {
    const nRok = (t.rok || []).filter(x => x.s && x.s.length).length, calOld = s.cal && s.cal.when !== s.when;
    ov.innerHTML = '<div style="max-width:760px;margin:2vh auto;background:#f8fafc;border-radius:18px;overflow:hidden;font:15px Arial;color:#0f2a4a;box-shadow:0 12px 40px #0006">' +
      '<div style="background:linear-gradient(135deg,#0f2a4a,#17457f);color:#fff;padding:16px 18px;display:flex;align-items:center;gap:10px"><div style="flex:1;min-width:0"><div style="font:700 12px Arial;color:#9fb6d3;letter-spacing:.6px">' + (id ? 'PROJEKT' : 'NOVI PROJEKT') + '</div><div style="font:800 21px Arial;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (L.info && L.info.broj ? '<span style="color:#9fb6d3">' + esc(L.info.broj) + '</span> ' : '') + esc(L.name || 'Novi projekt') + '</div></div>' + (L.info && L.info.mapa ? '<button data-a="mapa" style="' + BT + ';background:#ffffff22;color:#fff;border:0" title="Mapa projekta na Google Disku">📁 Mapa</button>' : '') + '</div><div style="background:#17457f;padding:8px 18px 12px">' + stepper() + '</div>' +
      '<div style="padding:16px 18px">' +
      (id ? '<button data-a="openp" style="width:100%;min-height:58px;margin:0 0 14px;border:0;border-radius:14px;background:#2563eb;color:#fff;font:800 18px Arial;box-shadow:0 4px 12px rgba(37,99,235,.3)">📐 ' + (hasDraw() ? 'Otvori izmjeru' : 'Započni izmjeru') + '</button>' : '') +
      (id ? '' : lab('Naziv projekta', '<input data-k="name" style="' + IN + '" placeholder="npr. Horvat – Ilica 12" value="' + esc(L.name) + '">')) +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;margin:0 0 14px">' + [['izmjera', '📐 Izmjera na terenu'], ['podloge', '📎 Podloge od arhitekta/investitora'], ['savjet', '💬 Savjetovanje']].map(([k, n]) => '<button data-iz="' + k + '" style="' + BT + ';' + ((L.izvor !== undefined ? L.izvor : (L.info.izvor || '')) === k ? 'background:#0f2a4a;color:#fff;border-color:#0f2a4a' : '') + '">' + n + '</button>').join('') + '</div>' +
      '<div style="font:800 13px Arial;color:#2563eb;letter-spacing:.6px;margin:2px 0 10px">📅 SASTANAK</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0 12px">' +
      lab('S kim', '<input data-s="who" style="' + IN + '" placeholder="ime i prezime / tvrtka" value="' + esc(s.who) + '">') +
      lab('Telefon', '<div style="display:flex;gap:6px"><input data-s="tel" inputmode="tel" style="' + IN + '" value="' + esc(s.tel) + '"><button data-a="call" style="' + BT + '" title="Nazovi">📞</button></div>') +
      lab('E-mail', '<div style="display:flex;gap:6px"><input data-s="mail" inputmode="email" style="' + IN + '" value="' + esc(s.mail) + '"><button data-a="mailto" style="' + BT + '" title="Pošalji mail">✉</button></div>') +
      lab('Zadatak', '<button data-a="task" style="' + BT + ';width:100%">✅ ＋ Zadatak za ovaj projekt</button>') +
      lab('Kad', '<div style="display:flex;gap:6px"><input data-s="when" type="datetime-local" style="' + IN + '" value="' + esc(s.when) + '"><select data-s="dur" style="' + IN + ';width:auto">' + [30, 60, 90, 120].map(m => '<option value="' + m + '"' + (+(s.dur || 60) === m ? ' selected' : '') + '>' + (m < 60 ? m + ' min' : (m / 60) + ' h') + '</option>').join('') + '</select></div>') +
      lab('Gdje', '<div style="display:flex;gap:6px"><input data-s="where" style="' + IN + '" placeholder="adresa sastanka" value="' + esc(s.where) + '"><button data-a="map" style="' + BT + '" title="Otvori u kartama">🗺</button></div>') +
      '</div>' +
      '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:2px 0 14px"><button data-a="cal" style="' + BT + ';background:#2563eb;color:#fff;border:0">📅 ' + (s.cal ? 'Ponovno u Google kalendar' : 'Upiši u Google kalendar') + '</button><span style="font-size:13px;color:' + (calOld ? '#b45309' : '#15803d') + '">' + (s.cal ? (calOld ? '⚠ Vrijeme je promijenjeno nakon upisa – upiši ponovno, a stari termin izbriši u kalendaru.' : '✓ upisano u kalendar (' + whenTxt(s.cal.when) + ')') : '') + '</span></div>' +
      lab('Bilješke sa sastanka', '<textarea data-s="notes" rows="5" style="' + IN + ';font-family:inherit" placeholder="dogovoreno, rokovi, cijena, što treba donijeti…">' + esc(s.notes) + '</textarea>') +
      '<div style="display:flex;gap:12px;align-items:center;margin:0 0 16px"><div data-a="rok" style="width:170px;height:120px;flex:none;border-radius:10px;border:1px solid #cbd5e1;overflow:hidden;background:#fff;cursor:pointer" id="tjThumb"></div><div><button data-a="rok" style="' + BT + '">✏️ Otvori rokovnik</button><div style="font-size:13px;color:#64748b;margin-top:6px">' + (nRok ? nRok + (nRok === 1 ? ' stranica' : nRok < 5 ? ' stranice' : ' stranica') + ' s bilješkama' : 'Piši i crtaj olovkom kao u bilježnici.') + '</div></div></div>' +
      '<div style="font:800 13px Arial;color:#d97706;letter-spacing:.6px;margin:6px 0 10px;border-top:1px solid #e2e8f0;padding-top:14px">📄 PONUDA</div>' + ponudaHtml() +
      '<div style="font:800 13px Arial;color:#4f46e5;letter-spacing:.6px;margin:16px 0 10px;border-top:1px solid #e2e8f0;padding-top:14px">🛠 IZRADA I PREDAJA</div>' + izradaHtml() +
      '</div><div style="display:flex;gap:8px;justify-content:flex-end;padding:12px 18px;background:#eef3f9;border-top:1px solid #e2e8f0">' +
      '<button data-a="x" style="' + BT + '">Odustani</button><button data-a="ok" style="' + BT + ';background:#17457f;color:#fff;border:0">' + (id ? 'Spremi' : 'Spremi sastanak') + '</button></div></div>';
    const th = ov.querySelector('#tjThumb'); if (th) { const c = pageThumb((t.rok || [])[0], 170 * 2); c.style.cssText = 'width:100%;height:100%;object-fit:cover'; th.appendChild(c); }
  }
  function hasDraw() { const pr = getPs().find(q => q.id === id); return !!(pr && pr.thumb) || !!(L.data && (L.data.floors || []).some(f => (f.items || []).length)); }
  function stepper() { const st = stage(t), S = [['sastanak', '📅 Sastanak'], ['ponuda', '⏳ Ponuda'], ['izmjera', '✅ Prihvaćeno'], ['izrada', '🛠 U izradi'], ['predano', t.status === 'Obavljeno' ? '✔ Obavljeno' : '📦 Predano']], ix = { sastanak: 0, ponuda: 1, izmjera: 2, odbijeno: 1, izrada: 3, predano: 4 }[st];
    return '<div style="display:flex;gap:6px;flex-wrap:wrap">' + S.map(([k, n], i) => '<span data-fz="' + k + '" style="cursor:pointer;padding:9px 13px;border-radius:999px;font:700 13px Arial;' + (ix != null && i <= ix ? (st === 'odbijeno' && i === 1 ? 'background:#64748b;color:#fff' : 'background:#60a5fa;color:#0b2140') : 'background:#ffffff22;color:#c7d6ea') + '">' + (st === 'odbijeno' && i === 1 ? '✖ Odbijeno' : n) + '</span>').join('') + '<span data-fz="odbijeno" style="cursor:pointer;padding:9px 13px;border-radius:999px;font:700 13px Arial;' + (st === 'odbijeno' ? 'background:#64748b;color:#fff' : 'background:#ffffff22;color:#c7d6ea') + '">✖</span></div>'; }
  function izradaHtml() { const reg = window.IzmjeraRegistar && IzmjeraRegistar.on(), rd = parseWhen(t.rokP), dl = rd ? Math.round((dayStart(rd) - dayStart(new Date())) / 864e5) : null;
    return '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:10px"><span>Rok predaje</span><input data-t="rokP" type="date" value="' + esc(t.rokP) + '" style="' + IN + ';width:auto">' +
      (t.rokP ? '<span style="font-size:13px;color:' + (dl != null && dl <= 3 ? '#b91c1c' : '#64748b') + '">' + (dl == null ? '' : dl < 0 ? 'prošao prije ' + (-dl) + ' d.' : dl === 0 ? 'danas!' : 'za ' + dl + (dl === 1 ? ' dan' : ' dana')) + '</span>' + (reg ? '<span style="font-size:12px;color:#15803d">📅 u kalendar ide s podsjetnikom (registar)</span>' : '<button data-a="rokcal" style="' + BT + '">📅 Rok u kalendar</button>') : '') + '</div>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">' + ['U izradi', 'Predano', 'Obavljeno'].map(x => '<button data-st="' + x + '" style="' + BT + ';' + (t.status === x ? 'background:#4f46e5;color:#fff;border-color:#4f46e5' : '') + '">' + ({ 'U izradi': '🛠 U izradi', 'Predano': '📦 Predano', 'Obavljeno': '✔ Obavljeno (savjet)' })[x] + '</button>').join('') +
      '<span style="flex:1"></span><label style="display:flex;align-items:center;gap:8px;font:700 15px Arial;padding:8px 12px;border-radius:10px;background:' + (t.placeno ? '#dcfce7' : '#fff') + ';border:1px solid #cbd5e1"><input data-t="placeno" type="checkbox"' + (t.placeno ? ' checked' : '') + ' style="width:22px;height:22px">💶 Plaćeno</label></div>'; }
  function ponudaHtml() {
    if (!p.sent) return '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><span style="color:#64748b">Ponuda još nije poslana.</span><button data-a="sent" style="' + BT + ';background:#d97706;color:#fff;border:0">📄 Označi kao poslanu</button></div>';
    const dn = Math.floor((dayStart(new Date()) - dayStart(parseWhen(p.sent))) / 864e5);
    let h = '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:10px"><span>Poslana</span><input data-p="sent" type="date" value="' + esc(p.sent) + '" style="' + IN + ';width:auto"><span>Iznos</span><input data-p="iznos" inputmode="decimal" placeholder="€" value="' + esc(p.iznos == null ? '' : String(p.iznos).replace('.', ',')) + '" style="' + IN + ';width:120px"><span>€</span><button data-a="unsent" style="' + BT + '">↩ nije poslana</button></div>';
    if (!p.ans) h += '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span style="color:' + (dn >= 7 ? '#b45309' : '#64748b') + ';font-weight:' + (dn >= 7 ? 700 : 400) + '">' + (dn <= 0 ? 'Čeka odgovor.' : 'Čeka odgovor ' + dn + (dn === 1 ? ' dan' : ' dana') + (dn >= 7 ? ' – javi se klijentu.' : '.')) + '</span><span style="flex:1"></span><button data-a="da" style="' + BT + ';background:#15803d;color:#fff;border:0">✅ Prihvaćena</button><button data-a="ne" style="' + BT + '">✖ Odbijena</button></div>';
    else h += '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><b style="color:' + (p.ans === 'da' ? '#15803d' : '#64748b') + '">' + (p.ans === 'da' ? '✅ Prihvaćena' : '✖ Odbijena') + (p.ansAt ? ' ' + dateTxt(p.ansAt) : '') + '</b>' + (p.ans === 'da' ? '<span style="color:#64748b">– projekt je u „Za izmjeru”.</span>' : '') + '<span style="flex:1"></span><button data-a="noans" style="' + BT + '">↩ poništi odgovor</button></div>';
    return h; }
  const read = () => { ov.querySelectorAll('[data-s]').forEach(el => { const v = el.value; if (v !== '' && v != null) s[el.dataset.s] = v; else delete s[el.dataset.s]; }); ov.querySelectorAll('[data-p]').forEach(el => { if (el.dataset.p === 'iznos') { const v = el.value.trim().replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'); if (v && isFinite(+v)) p.iznos = +v; else delete p.iznos; } else if (el.value) p[el.dataset.p] = el.value; }); ov.querySelectorAll('[data-t]').forEach(el => { if (el.type === 'checkbox') { if (el.checked) t.placeno = true; else delete t.placeno; } else if (el.value) t[el.dataset.t] = el.value; else delete t[el.dataset.t]; }); const n = ov.querySelector('[data-k=name]'); if (n) L.name = n.value; };
  const clean = () => { for (const o of [s, p, t]) for (const k of Object.keys(o)) if (o[k] === '' || o[k] == null) delete o[k]; if (t.rok && !t.rok.some(x => x.s && x.s.length)) delete t.rok; if (!s.when) delete s.dur; if (!Object.keys(s).length) delete t.sastanak; if (!Object.keys(p).length) delete t.ponuda; };
  const close = () => { ov.remove(); };
  function save() { read(); if (s.where && L.info && s.where === L.info.adresa && !s.who && !s.when && !s.notes && !(t.rok || []).length) delete s.where; clean();
    if (!id) { const nm = (L.name || '').trim() || [s.who, s.where].filter(Boolean).join(' – ') || 'Sastanak ' + today(); const H = HM(), iz = L.izvor; id = H.newBlank(nm, Object.assign({ adresa: s.where || '' }, iz ? { izvor: iz } : {}, s.who ? { invIme: s.who } : {})); L = loadT(id); L.izvor = iz; try { const ps = getPs(), q = ps.find(z => z.id === id); if (q) { q.mt = 1; localStorage.setItem(PKEY, JSON.stringify(ps)); } } catch (e) { } }
    try { saveT(id, t, L); } catch (e) { alert('Spremanje nije uspjelo: ' + (e.message || e)); return false; }
    try { const h = $('home'); if (h && !h.classList.contains('hidden') && HM()) HM().listProjects(); } catch (e) { } return true; }
  ov.addEventListener('click', e => { const fz = e.target.closest('[data-fz]'); if (fz) { read(); const k = fz.dataset.fz; delete t.status;
      if (k === 'sastanak') { delete p.ans; delete p.ansAt; if (p.sent) t.status = 'Sastanak'; }
      else if (k === 'ponuda') { delete p.ans; delete p.ansAt; if (!p.sent) p.sent = today(); }
      else if (k === 'izmjera') { p.ans = 'da'; p.ansAt = p.ansAt || today(); }
      else if (k === 'izrada') t.status = 'U izradi'; else if (k === 'predano') t.status = (L.izvor || (L.info && L.info.izvor)) === 'savjet' ? 'Obavljeno' : 'Predano';
      else if (k === 'odbijeno') { p.ans = 'ne'; p.ansAt = p.ansAt || today(); }
      render(); return; }
    const zb = e.target.closest('[data-iz],[data-st]'); if (zb) { read(); if (zb.dataset.iz) { const cur = L.izvor !== undefined ? L.izvor : (L.info.izvor || ''); L.izvor = cur === zb.dataset.iz ? '' : zb.dataset.iz; } else { t.status = t.status === zb.dataset.st ? undefined : zb.dataset.st; if (!t.status) delete t.status; } render(); return; }
    const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a; read();
    if (a === 'x') return close();
    if (a === 'ok') { if (save()) close(); return; }
    if (a === 'openp') { if (save()) { close(); if (!isOpen(id)) HM().openProject(id); } return; }
    if (a === 'call') { if (s.tel) openUri('tel:' + s.tel.replace(/[^\d+]/g, '')); return; }
    if (a === 'mailto') { if (s.mail) openUri('mailto:' + s.mail); return; }
    if (a === 'task') { if (save()) { close(); const pr = getPs().find(q => q.id === id); if (window.IzmjeraKartice) { IzmjeraKartice.newTask(); setTimeout(() => { const sel = document.querySelector('#zOv [data-k=b]'); if (sel && pr && pr.broj) sel.value = pr.broj; }, 60); } } return; }
    if (a === 'map') { if (s.where) openUri('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(s.where)); return; }
    if (a === 'cal') { if (toCal(t, (L.name || '').trim() || s.who)) { s.cal = { at: Date.now(), when: s.when }; render(); } return; }
    if (a === 'rok') { rokovnik(t, L.name || s.who || 'Sastanak', () => render()); return; }
    if (a === 'mapa') { openUri(L.info.mapa); return; }
    if (a === 'rokcal') { const d = parseWhen(t.rokP); if (d) { d.setHours(9, 0); const b0 = d.getTime(), nm = (L.name || '').trim(); try { if (window.AndroidApp && AndroidApp.addCalendar) AndroidApp.addCalendar('⏰ Rok predaje: ' + nm, (L.info && L.info.adresa) || '', 'Projekt (Izmjera 57): ' + nm, b0, b0 + 1800e3); } catch (e) { } } return; }
    if (a === 'sent') { p.sent = today(); delete p.ans; delete p.ansAt; delete t.status; }
    if (a === 'unsent') { delete p.sent; delete p.ans; delete p.ansAt; delete t.status; }
    if (a === 'da' || a === 'ne') { p.ans = a; p.ansAt = today(); delete t.status; }
    if (a === 'noans') { delete p.ans; delete p.ansAt; delete t.status; }
    render(); });
  ov.addEventListener('change', e => { if (e.target.dataset.s === 'when' || e.target.dataset.p || e.target.dataset.t) { read(); render(); } });
  document.body.appendChild(ov); render();
}
/* ---------- početni zaslon ---------- */
const getF = () => { try { return localStorage.getItem(FK) || ''; } catch (e) { return ''; } };
const rokDays = tj => { const d = tj && tj.rok && parseWhen(tj.rok); return d ? Math.round((dayStart(d) - dayStart(new Date())) / 864e5) : null; };
function fOk(pr, f) { const tj = pr.tj || {}; if (f === 'rok') { const d = rokDays(tj); return d != null && d <= 7 && !pr.done && tj.st !== 'odbijeno' && tj.st !== 'predano'; } if (f === 'naplata') return (pr.done || tj.st === 'predano') && !tj.placeno && !!(pr.reg || tj.iznos || tj.st); return !pr.done && tj.st === f; }
const regTab = () => !window.IzmjeraKartice || IzmjeraKartice.tab() === 'reg';
function match(pr) { const f = getF(); if (!f || !regTab()) return true; return fOk(pr, f); }
const ignoreDone = () => !!getF() && regTab();
function css() { if ($('tjCss')) return; const c = document.createElement('style'); c.id = 'tjCss'; c.textContent =
  '#tijekFilter{display:flex;flex-direction:column;gap:2px}#tijekFilter button{display:flex;align-items:center;gap:10px;width:100%;text-align:left;padding:10px 12px;border-radius:10px;border:0;background:transparent;color:#334155;font:600 14px Arial}#tijekFilter button span{margin-left:auto;color:#94a3b8;font-weight:700}#tijekFilter button.on{background:#fff;color:#0f2a4a;font-weight:800;box-shadow:0 1px 4px rgba(0,0,0,.06)}#tijekFilter button i{font-style:normal;width:18px;text-align:center}' +
  '#newMeet{width:100%;margin-top:6px;padding:12px!important;border-radius:14px!important;border:2px solid #2563eb!important;background:#fff!important;color:#2563eb!important;font:800 15px Arial!important}' +
  '#homeMeet{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 12px}#homeMeet button{display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:12px;border:1px solid #bfdbfe;background:#fff;color:#0f2a4a;font:600 14px Arial;box-shadow:0 1px 3px rgba(15,42,74,.08);max-width:100%}#homeMeet button b{color:#2563eb;white-space:nowrap}#homeMeet button span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#homeMeet .td{border-color:#2563eb;background:#eff6ff}' +
  '.pc-s .tj{font-weight:700;padding:1px 8px;border-radius:999px;margin-right:4px}.tj-iz{background:#f1f5f9;color:#334155}.tj-rok{background:#fef3c7;color:#92400e}.tj-rok3{background:#fee2e2;color:#b91c1c}.tj-np{background:#ffedd5;color:#c2410c}.tj-izrada{background:#e0e7ff;color:#4338ca}.tj-predano{background:#f1f5f9;color:#475569}.tj-sastanak{background:#dbeafe;color:#1d4ed8}.tj-ponuda{background:#fef3c7;color:#b45309}.tj-ponuda.kasni{background:#fee2e2;color:#b91c1c}.tj-izmjera{background:#dcfce7;color:#15803d}.tj-odbijeno{background:#f1f5f9;color:#64748b}';
  document.head.appendChild(c); }
function renderHome() {
  css(); const vf = $('vrstaFilter'), np = $('newproject'); if (!vf || !$('homeSide')) return; /* tek kad je lijeva traka složena */ const ps = getPs().filter(p => !p.done), f = getF();
  if (np && !$('newMeet')) { const b = document.createElement('button'); b.id = 'newMeet'; b.type = 'button'; b.textContent = '📅 Novi sastanak'; b.onclick = () => dialog(null); np.after(b); }
  else if (np && $('newMeet').previousElementSibling !== np) np.after($('newMeet'));
  let box = $('tijekFilter'); if (!box) { box = document.createElement('div'); box.id = 'tijekFilter'; }
  let hd = $('tijekHd'); if (!hd) { hd = document.createElement('div'); hd.id = 'tijekHd'; hd.className = 'hv2-sec'; hd.textContent = 'TIJEK'; }
  const vh = [...document.querySelectorAll('#homeSide .hv2-sec')].find(x => x.textContent === 'VRSTA'); const anchor = vh || vf;
  if (anchor.parentElement && (box.nextElementSibling !== anchor)) { anchor.before(hd); anchor.before(box); }
  const allP = getPs(); box.innerHTML = Object.entries(ST).map(([k, [ic, n, c]]) => { const cnt = allP.filter(p => fOk(p, k)).length; return (k === 'rok' || k === 'naplata') && !cnt && f !== k ? '' : '<button type="button" data-t="' + k + '" class="' + (f === k ? 'on' : '') + '"><i style="color:' + c + '">' + ic + '</i>' + n + '<span>' + cnt + '</span></button>'; }).join('');
  box.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { try { localStorage.setItem(FK, f === b.dataset.t ? '' : b.dataset.t); } catch (e) { } HM() && HM().listProjects(); });
  // nadolazeći sastanci
  const cont = $('homeContinue'); let mt = $('homeMeet'); if (!mt) { mt = document.createElement('div'); mt.id = 'homeMeet'; }
  if (cont && mt.nextElementSibling !== cont) cont.before(mt);
  const t0 = dayStart(new Date()), up = ps.filter(p => p.tj && p.tj.when && p.tj.st === 'sastanak' && (parseWhen(p.tj.when) || 0) >= t0).sort((a, b) => parseWhen(a.tj.when) - parseWhen(b.tj.when)).slice(0, 4);
  mt.innerHTML = up.map(p => '<button type="button" data-id="' + esc(p.id) + '" class="' + (dayStart(parseWhen(p.tj.when)) === t0 ? 'td' : '') + '">📅 <b>' + esc(whenTxt(p.tj.when, true)) + '</b><span>' + esc([p.tj.who || p.name, p.tj.where].filter(Boolean).join(' · ')) + '</span></button>').join('');
  mt.style.display = up.length ? '' : 'none'; mt.querySelectorAll('[data-id]').forEach(b => b.onclick = () => dialog(b.dataset.id));
}
function decorate(card, pr) {
  const s0 = card.querySelector('.pc-s'), nm = card.querySelector('.pc-n'); if (nm && pr.broj && !nm.querySelector('.tjb')) { const b = document.createElement('span'); b.className = 'tjb'; b.textContent = pr.broj + ' '; b.style.cssText = 'color:#64748b;font-weight:700;margin-right:4px'; nm.prepend(b); }
  if (s0 && (pr.izvor === 'podloge' || pr.izvor === 'savjet')) { const z = document.createElement('span'); z.className = 'tj tj-iz'; z.textContent = pr.izvor === 'podloge' ? '📎 podloge' : '💬 savjetovanje'; s0.prepend(z); }
  const rd = rokDays(pr.tj); if (s0 && rd != null && !pr.done && pr.tj.st !== 'predano' && pr.tj.st !== 'odbijeno') { const z = document.createElement('span'); z.className = 'tj ' + (rd <= 3 ? 'tj-rok3' : 'tj-rok'); z.textContent = '⏰ rok ' + dateTxt(pr.tj.rok) + (rd < 0 ? ' (prošao)' : rd === 0 ? ' (danas)' : ''); s0.append(z); }
  if (s0 && pr.tj && (pr.done || pr.tj.st === 'predano') && !pr.tj.placeno && pr.reg) { const z = document.createElement('span'); z.className = 'tj tj-np'; z.textContent = '💶 nije plaćeno'; s0.append(z); }
  if (!pr.thumb && (pr.izvor === 'podloge' || pr.izvor === 'savjet')) { card.onclick = () => dialog(pr.id); card.title = 'Otvori karticu projekta'; }
  const tj = pr.tj; if (!tj || !tj.st) return; const s = s0; if (!s) return; const sp = document.createElement('span'); sp.className = 'tj tj-' + tj.st;
  if (tj.st === 'sastanak') sp.textContent = '📅 ' + (tj.when ? 'sastanak ' + whenTxt(tj.when, true) : 'sastanak');
  else if (tj.st === 'ponuda') { const dn = Math.floor((dayStart(new Date()) - dayStart(parseWhen(tj.sent))) / 864e5); sp.textContent = '⏳ ponuda ' + dateTxt(tj.sent) + (dn > 0 ? ' · ' + dn + (dn === 1 ? ' dan' : ' dana') : ''); if (dn >= 7) sp.classList.add('kasni'); }
  else if (tj.st === 'izmjera') sp.textContent = pr.izvor === 'podloge' || pr.izvor === 'savjet' ? '✅ prihvaćeno' : '📐 za izmjeru';
  else if (tj.st === 'izrada') sp.textContent = '🛠 u izradi';
  else if (tj.st === 'predano') sp.textContent = tj.placeno ? '📦 predano · plaćeno' : '📦 predano';
  else sp.textContent = '✖ odbijeno';
  sp.style.cursor = 'pointer'; sp.onclick = e => { e.stopPropagation(); dialog(pr.id); };
  s.prepend(sp);
  if (!pr.thumb && (tj.st !== 'izmjera' || pr.izvor === 'podloge' || pr.izvor === 'savjet')) { card.onclick = () => dialog(pr.id); card.title = 'Otvori sastanak i ponudu (izmjera: „📐 Otvori izmjeru”)'; }
}
/* gumb u otvorenom projektu (pokraj „Podaci”) */
function topBtn() { if ($('tjTopBtn')) return; const pb = [...document.querySelectorAll('button')].find(b => (b.title || '').startsWith('Podaci o projektu')); if (!pb) return;
  const b = pb.cloneNode(false); b.id = 'tjTopBtn'; b.removeAttribute('onclick'); b.title = 'Sastanak, bilješke, rokovnik i ponuda'; b.innerHTML = '<span class="top-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16 M9 3v4 M15 3v4"/></svg></span>'; b.style.minWidth = '44px'; b.style.marginLeft = '4px';
  b.onclick = () => { const id = APP().projectId && APP().projectId(); if (id) dialog(id); }; pb.after(b); }
setInterval(() => { try { topBtn(); } catch (e) { } }, 1000);
window.IzmjeraTijek = { edit: id => dialog(id), newMeeting: () => dialog(null), renderHome, decorate, match, stage, summ, statusOf, ignoreDone };
try { HM() && HM().listProjects(); } catch (e) { }
})();
