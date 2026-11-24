/* Izmjera 57 – v2.78 „put projekta”: koraci u zaglavlju (Skica → Mjere → Provjera → Proračun → Predaja),
   alatna traka prema koraku, mirniji ⋯ i Više, ekran Predaja sa „Sve za predaju” (ZIP). */
(function () {
  'use strict';
  const $ = id => document.getElementById(id), A = () => window.IzmjeraApp, EN = () => window.IzmjeraEnergija, NC = () => window.IzmjeraNacrti, VD = () => window.IzmjeraVodic, TR = () => window.IzmjeraTeren, EX = () => window.IzmjeraEnergijaIzvoz;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const store = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { } } };
  const toast = t => { try { TR().toast(t); } catch (e) { } };
  const isLeg = () => { try { return !!EN().isLegal(); } catch (e) { return false; } }, isEn = () => { try { return !!EN().isEnerg(); } catch (e) { return false; } };
  const pname = () => { try { return A().projectName() || ''; } catch (e) { return ''; } };
  const floors = () => { try { return NC().floors() || []; } catch (e) { try { return A().allFloors() || []; } catch (e2) { return []; } } };
  const ui2 = () => document.body.classList.contains('ui2');

  /* ---------- koraci ---------- */
  function steps() {
    const s = [['skica', '✏️', 'Skica'], ['mjere', '📏', 'Mjere'], ['provjera', '🔎', 'Provjera']];
    if (isLeg() && isEn()) s.push(['racun', '🏠', 'Pročelja, GBP, energ.']); else if (isLeg()) s.push(['racun', '🏠', 'Pročelja i GBP']); else if (isEn()) s.push(['racun', '⚡', 'Energetika']);
    s.push(['predaja', '📄', 'Predaja']); return s;
  }
  const modeKey = () => 'izmjera-put-mode:' + pname();
  let mode = null, open = null; /* mode: skica | mjere; open: predaja (ekran ispod zaglavlja) */
  const left = () => { try { const n = VD().left(); return n == null ? -1 : n; } catch (e) { return -1; } };
  const hasNacrt = f => (f.items || []).some(o => o.layer === 'nacrt');
  function done() {
    const fs = floors(), sk = fs.length > 0 && fs.every(hasNacrt), n = left(); let pv = false; try { pv = fs.length > 0 && fs.every(f => NC().status(f) === 'ok'); } catch (e) { }
    const I = window.projectInfo || {}; return { skica: sk, mjere: sk && n === 0, provjera: pv, racun: pv && !!store.get('izmjera-put-racun:' + pname(), ''), predaja: !!I.predaja };
  }
  function provN() { const el = $('ui2ProvN'); return el && !el.hidden ? +el.textContent || 0 : 0; }

  /* ---------- zaglavlje ---------- */
  function header() {
    if ($('putSteps')) return true; const fl = $('ui2Floor'); if (!fl) return false;
    const d = document.createElement('div'); d.id = 'putSteps'; fl.after(d);
    d.addEventListener('click', e => { const b = e.target.closest('[data-st]'); if (!b) return; e.stopPropagation(); go(b.dataset.st, b); });
    return true;
  }
  let hsig = '';
  function renderHeader() {
    const d = $('putSteps'); if (!d) return; const D = done(), n = left(), pv = provN(), S = steps();
    const act = open || mode; const fsN = floors().length; let okN = 0; try { okN = floors().filter(f => NC().status(f) === 'ok').length; } catch (e) { }
    const sig = JSON.stringify([S, D, n, pv, act, okN, fsN]); if (sig === hsig) return; hsig = sig;
    d.innerHTML = S.map(([k, ic, lb], i) => { const dn = D[k] && k !== act; let bd = '';
      if (k === 'mjere' && n > 0) bd = '<i>još ' + n + '</i>'; else if (k === 'provjera') bd = pv ? '<i>' + pv + '</i>' : fsN > 1 ? '<i class="g">' + okN + '/' + fsN + '</i>' : '';
      return (i ? '<span class="put-sep">›</span>' : '') + '<button type="button" class="put-st' + (k === act ? ' on' : '') + (dn ? ' done' : '') + '" data-st="' + k + '" title="' + esc(lb) + '"><span class="put-n">' + (dn ? '✓' : i + 1) + '</span><span class="put-lb">' + ic + ' ' + esc(lb) + '</span>' + bd + '</button>'; }).join('');
    /* ime projekta umjesto „Izlaz” */
    const bh = $('backhome'); if (bh) { const t = [...bh.childNodes].reverse().find(x => x.nodeType === 3); const nm = ' ' + (pname() || 'Izlaz'); if (t && t.textContent !== nm) t.textContent = nm; bh.title = 'Natrag na popis projekata'; }
  }
  function go(k, anchor) {
    if (k === 'skica' || k === 'mjere') { closePredaja(); setMode(k, true); return; }
    if (k === 'provjera') { provPop(anchor); return; }
    if (k === 'racun') { closePredaja(); store.set('izmjera-put-racun:' + pname(), '1'); try { EN().open(); } catch (e) { toast('Proračun se ne može otvoriti.'); } return; }
    if (k === 'predaja') openPredaja();
  }

  /* ---------- način rada: Skica / Mjere ---------- */
  const isOn = el => !!el && (el.classList.contains('active') || el.classList.contains('is-active') || el.getAttribute('aria-pressed') === 'true');
  const qbtn = t => [...document.querySelectorAll('#ui2Quick button')].find(b => (b.dataset.t || b.title || '').split(' (')[0] === t);
  const layer = l => { const L = $('layer'); if (L && L.value === l) return; const o = document.querySelector('[data-activate-layer="' + l + '"]'); if (o) o.click(); };
  function setMode(m, user) {
    if (!ui2()) return; mode = m; store.set(modeKey(), m); document.body.classList.toggle('put-skica', m === 'skica'); document.body.classList.toggle('put-mjere', m === 'mjere');
    if (user) {
      if (m === 'skica') { for (const [id, t] of [['typeBtn', 'Tipkaj'], ['odBtn', 'Od–do'], ['diagBtn', 'Dijagonala']]) if (isOn($(id))) { const b = qbtn(t); if (b) b.click(); }
        if (isOn($('terenDb'))) $('terenDb').click(); if (isOn($('terenMjeri'))) $('terenMjeri').click(); setTimeout(() => layer('nacrt'), 60); }
      else { for (const t of ['Prostorija', 'Prozor', 'Vrata', 'Zub/niša', 'Ostalo']) { const b = qbtn(t); if (b && b.classList.contains('on')) b.click(); } if (isOn($('terenSplit'))) $('terenSplit').click();
        setTimeout(() => { layer('kote'); let cf = null; try { cf = A().currentFloor(); } catch (e) { } if (left() !== 0 && cf && hasNacrt(cf) && !isOn($('terenMjeri')) && $('terenMjeri')) $('terenMjeri').click(); }, 120); }
    }
    applyBar(); hsig = ''; renderHeader();
  }
  /* alatna traka: skupine po koraku, novi gumbi (Razreži, Foto, Debljina, Veze, Brojevi, Laser) */
  const SVG = d => '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>';
  const IC = { cut: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4L8.1 15.9M14.5 14.5L20 20M8.1 8.1L12 12"/>', foto: '<path d="M3 8h4l2-3h6l2 3h4v11H3z"/><circle cx="12" cy="13" r="3.5"/>', brick: '<rect x="3" y="5" width="18" height="14"/><path d="M3 12h18M9 5v7M15 12v7"/>', link: '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>', num: '<path d="M4 9h16M4 15h16M10 3L8 21M16 3l-2 18"/>', laser: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M10 6h4"/><circle cx="12" cy="13" r="2"/>' };
  const extra = []; /* [gumb, fnOn, fnShow] */
  function mkBtn(label, ic, onClick, fnOn, fnShow) { const b = document.createElement('button'); b.type = 'button'; b.title = label; b.dataset.t = label; b.className = 'put-qb'; b.innerHTML = '<span style="display:flex;flex-direction:column;align-items:center;gap:1px;line-height:1">' + SVG(IC[ic]) + '<span style="font:600 10px Arial">' + esc(label) + '</span></span>'; b.style.cssText = 'min-width:50px;min-height:50px;padding:3px 2px;flex:none';
    b.onclick = e => { e.stopPropagation(); try { onClick(); } catch (er) { } setTimeout(syncExtra, 60); setTimeout(syncExtra, 300); }; extra.push([b, fnOn, fnShow]); return b; }
  function syncExtra() { for (const [b, on, sh] of extra) { const v = !!(on && on()); b.classList.toggle('on', v); b.style.background = v ? '#17457f' : '#fff'; b.style.color = v ? '#fff' : '#17457f'; if (sh) b.classList.toggle('put-hid', !sh()); } }
  const grpBy = t => [...document.querySelectorAll('#ui2Quick > .ui2-grp')].find(g => { const x = g.querySelector('.ui2-gt'); return x && (x.dataset.t0 || x.textContent.trim()) === t; });
  let barOk = false;
  function buildBar() {
    if (barOk) return true; const qb = $('ui2Quick'); if (!qb) return false; const cr = grpBy('Crtanje'), ur = grpBy('Uređivanje'), bl = grpBy('Blokovi'), mj = grpBy('Mjerenje'), vi = $('ui2More') && $('ui2More').closest('.ui2-grp'); if (!cr || !ur || !bl || !mj) return false; barOk = true;
    cr.dataset.put = 'skica'; bl.dataset.put = 'skica'; mj.dataset.put = 'mjere'; ur.dataset.put = 'oba'; if (vi) vi.dataset.put = 'oba';
    ur.querySelector('.ui2-gt').dataset.t0 = 'Uređivanje';
    ur.querySelector('.ui2-gr').appendChild(mkBtn('Razreži', 'cut', () => $('terenSplit') && $('terenSplit').click(), () => isOn($('terenSplit')), () => mode !== 'mjere'));
    bl.querySelector('.ui2-gr').appendChild(mkBtn('Foto', 'foto', () => $('ui2Foto') && $('ui2Foto').click(), () => isOn(document.querySelector('[data-tool="photo"]'))));
    mj.querySelector('.ui2-gr').appendChild(mkBtn('Debljina', 'brick', () => $('terenDb') && $('terenDb').click(), () => isOn($('terenDb'))));
    const pr = document.createElement('div'); pr.className = 'ui2-grp'; pr.dataset.g = mj.dataset.g || '2'; pr.dataset.put = 'mjere'; pr.innerHTML = '<div class="ui2-gt">Prikaz</div><div class="ui2-gr"></div>';
    const g = pr.querySelector('.ui2-gr'); g.appendChild(mkBtn('Veze', 'link', () => $('terenVeze') && $('terenVeze').click(), () => isOn($('terenVeze'))));
    g.appendChild(mkBtn('Brojevi', 'num', () => $('terenKote') && $('terenKote').click(), () => isOn($('terenKote'))));
    g.appendChild(mkBtn('Laser', 'laser', () => { const b = $('laserBtn'); if (b) b.click(); else toast('📡 Laser radi samo u aplikaciji na tabletu.'); }, () => { try { return IzmjeraLaser.L.s === 'on'; } catch (e) { return false; } }, () => !!(window.AndroidApp && AndroidApp.laserConnect)));
    const sp = document.createElement('span'); sp.className = 'put-gsep'; sp.style.cssText = 'width:1px;align-self:stretch;background:#b8cde5;margin:0 2px;flex:none'; mj.after(sp); sp.after(pr);
    /* Tekst samo u Skici */ const tx = qbtn('Tekst'); if (tx) tx.dataset.putOnly = 'skica';
    setInterval(syncExtra, 1200); syncExtra(); return true;
  }
  function applyBar() {
    if (!buildBar()) return; const qb = $('ui2Quick'), m = mode || 'skica', kids = [...qb.children]; let first = true;
    for (const el of kids) { if (!el.classList.contains('ui2-grp')) continue; const p = el.dataset.put || 'oba', vis = p === 'oba' || p === m; el.classList.toggle('put-hid', !vis);
      const prev = el.previousElementSibling; if (prev && prev.tagName === 'SPAN') prev.classList.toggle('put-hid', !vis || first); if (vis) first = false; }
    const t = grpBy('Uređivanje'); if (t) t.querySelector('.ui2-gt').textContent = m === 'mjere' ? 'Ispravak' : 'Uređivanje';
    qb.querySelectorAll('[data-put-only]').forEach(b => b.classList.toggle('put-hid', b.dataset.putOnly !== m));
    document.querySelectorAll('#ui2Lay button').forEach(b => { if ((b.dataset.t || b.title || '').split(' (')[0] === 'Kote') b.classList.toggle('put-hid', m === 'skica'); });
    syncExtra();
  }

  /* ---------- Provjera (skočni izbornik) ---------- */
  function provPop(anchor) {
    let P = $('putProvPop'); if (P && !P.hidden) { P.hidden = true; return; } if (!P) { P = document.createElement('div'); P.id = 'putProvPop'; P.className = 'ui2-pop'; document.body.appendChild(P); }
    let nM = 0, nP = 0; try { const l = TR().collectMissing(true); nM = l ? l.length : 0; } catch (e) { } try { nP = VD().pvCount(); } catch (e) { }
    const fs = floors(); let ok = 0; try { ok = fs.filter(f => NC().status(f) === 'ok').length; } catch (e) { }
    P.innerHTML = '<div class="ui2-sec">Prije odlaska s objekta</div><div class="ui2-mrow"><button type="button" data-p="m">❓ Što nedostaje – mjere (' + nM + ')</button></div><div class="ui2-mrow"><button type="button" data-p="c">🔎 Provjera crteža – rupe, dvostruke crte, kote u zraku (' + nP + ')</button></div>' +
      '<div class="ui2-sec">U uredu</div><div class="ui2-mrow"><button type="button" data-p="t">📐 Tlocrt po etažama – provjera i izračun (' + ok + '/' + fs.length + ' gotovo)</button></div>';
    P.querySelector('[data-p="m"]').onclick = () => { P.hidden = true; const b = $('terenMissing'); if (b) b.click(); };
    P.querySelector('[data-p="c"]').onclick = () => { P.hidden = true; const b = $('terenProvjera'); if (b) b.click(); };
    P.querySelector('[data-p="t"]').onclick = () => { P.hidden = true; closePredaja(); try { NC().open(); } catch (e) { } };
    document.querySelectorAll('.ui2-pop').forEach(x => { if (x !== P) x.hidden = true; });
    P.hidden = false; const r = (anchor || $('putSteps')).getBoundingClientRect(); P.style.position = 'fixed'; P.style.top = (r.bottom + 6) + 'px'; P.style.left = Math.max(6, Math.min(innerWidth - 470, r.left)) + 'px'; P.style.zIndex = 70;
    setTimeout(() => document.addEventListener('click', function cl(e) { if (!P.contains(e.target)) { P.hidden = true; document.removeEventListener('click', cl, true); } }, true), 0);
  }

  /* ---------- ⋯ i Više ---------- */
  function sheet(html) { try { return TR().sheet(html); } catch (e) { return null; } }
  function filesSheet() {
    const L = [['save', '💾 Spremi sada'], ['open', '📂 Otvori datoteku (.json)'], ['backup', '⬇ Izvezi kopiju ovog projekta (.json)'], ['terenIzvoz', '📦 Izvezi sve – DXF, PDF, skica, fotografije i projekt (ZIP)'], ['terenKopija', null]].filter(([id]) => $(id));
    const d = sheet('<div class="tp-head"><b>💾 Spremi / kopija / otvori</b><button data-a="x">✕</button></div><div class="tp-row" style="flex-direction:column;align-items:stretch;gap:6px">' + L.map(([id, t]) => '<button data-id="' + id + '" style="min-height:46px;text-align:left;padding:8px 12px">' + esc(t || $(id).textContent.trim()) + '</button>').join('') + '</div>');
    if (!d) return; d.querySelector('[data-a=x]').onclick = () => d.remove(); d.querySelectorAll('[data-id]').forEach(b => b.onclick = () => { d.remove(); const o = $(b.dataset.id); if (o) o.click(); });
  }
  function setSheet() {
    const L = ['penMode', 'terenFsZum'].filter(id => $(id)); const d = sheet('<div class="tp-head"><b>⚙ Postavke crtanja</b><button data-a="x">✕</button></div><div class="tp-row" id="putSetR" style="flex-direction:column;align-items:stretch;gap:6px"></div><div class="tp-note">Debljina i boja olovke: drži prst na gumbu Olovka. Veličina gumice: drži na Gumici.</div>');
    if (!d) return; d.querySelector('[data-a=x]').onclick = () => d.remove(); const R = d.querySelector('#putSetR');
    const draw = () => { R.innerHTML = L.map(id => '<button data-id="' + id + '" style="min-height:46px;text-align:left;padding:8px 12px">' + esc($(id).textContent.trim() || $(id).title) + '</button>').join(''); R.querySelectorAll('[data-id]').forEach(b => b.onclick = () => { const o = $(b.dataset.id); if (o) o.click(); setTimeout(draw, 80); }); }; draw();
  }
  function menuTick() {
    const hr = $('ui2HdrRow'); if (hr && !$('putZad') && $('terenZadatak')) { const b = document.createElement('button'); b.id = 'putZad'; b.type = 'button'; b.textContent = '✅ Zadatak'; b.onclick = e => { e.stopPropagation(); document.querySelectorAll('.ui2-pop').forEach(x => x.hidden = true); $('terenZadatak').click(); }; const ref = $('tjTopBtn'); if (ref && ref.parentNode === hr) ref.after(b); else hr.appendChild(b); }
    const fc = document.querySelector('#ui2Menu .files-group .controls'); if (fc && !$('putFiles')) { const b = document.createElement('button'); b.id = 'putFiles'; b.type = 'button'; b.textContent = '💾 Spremi / kopija / otvori'; b.onclick = e => { e.stopPropagation(); document.querySelectorAll('.ui2-pop').forEach(x => x.hidden = true); filesSheet(); }; fc.insertBefore(b, fc.firstChild); }
    const zr = document.querySelector('#ui2Menu .ui2-row:not(#ui2HdrRow)'); if (zr && !$('putSet')) { const b = document.createElement('button'); b.id = 'putSet'; b.type = 'button'; b.textContent = '⚙ Postavke crtanja'; b.onclick = e => { e.stopPropagation(); document.querySelectorAll('.ui2-pop').forEach(x => x.hidden = true); setSheet(); }; zr.appendChild(b); }
  }

  /* ---------- Predaja ---------- */
  function closePredaja() { const d = $('putPredaja'); if (d) d.remove(); if (open === 'predaja') { open = null; hsig = ''; renderHeader(); } }
  function openPredaja() {
    let d = $('putPredaja'); if (!d) { d = document.createElement('div'); d.id = 'putPredaja'; document.body.appendChild(d); }
    const th = ($('appTop') && $('appTop').getBoundingClientRect().bottom) || 48; d.style.top = th + 'px';
    open = 'predaja'; hsig = ''; renderHeader(); document.querySelectorAll('.ui2-pop').forEach(x => x.hidden = true);
    d.innerHTML = '<div class="pp-col" style="flex:1.25"><h2>📄 Predaja</h2><p class="pp-sub">Provjeravam što je gotovo…</p></div>'; setTimeout(() => fillPredaja(d), 30);
  }
  const VR = () => { const T = (window.IzmjeraPodaci && IzmjeraPodaci.TYPES) || [], v = (window.projectInfo && projectInfo.vrsta) || []; return v.map(k => (T.find(t => t[0] === k) || [, k])[1]).join(', '); };
  async function fillPredaja(d) {
    let info = { ok: false }; try { info = await EN().predajaInfo(); } catch (e) { }
    let P = { lst: [], warn: [] }; try { P = NC().plan(); } catch (e) { P = { lst: [], warn: ['Nacrti se ne mogu složiti: ' + (e.message || e)] }; }
    if (!$('putPredaja')) return; const fs = floors(); const it = (ok, t, sm, btn, act) => '<div class="pp-it"><span class="pp-ok' + (ok ? '' : ' wa') + '">' + (ok ? '✓' : '!') + '</span><b>' + esc(t) + (sm ? '<br><small>' + esc(sm) + '</small>' : '') + '</b>' + (btn ? '<button class="pp-sb" data-act="' + act + '">' + esc(btn) + '</button>' : '') + '</div>';
    let h = '<div class="pp-col" style="flex:1.25"><h2>📄 Predaja' + (VR() ? ' – ' + esc(VR().toLowerCase()) : '') + '</h2><p class="pp-sub">Sve što ide van na jednom mjestu. Zeleno je gotovo, narančasto treba dovršiti.</p>';
    const miss = [];
    h += '<h3>NACRTI (M 1:100)</h3>'; let st = []; try { st = fs.map(f => [f, NC().status(f)]); } catch (e) { }
    for (const [f, s] of st) if (s !== 'ok') { h += it(false, 'Tlocrt – ' + (f.name || 'etaža'), s === 'chg' ? 'mijenjan nakon što je označen gotovim' : 'nije označen kao gotov (Provjera → Tlocrt po etažama)', 'Otvori', 'tl'); miss.push('tlocrt ' + (f.name || '')); }
    for (const x of P.lst) h += it(true, x.no + ' ' + x.name, x.fmt + ' · ' + x.sc, '', '');
    for (const w of P.warn || []) { h += it(false, w, '', isLeg() ? 'Otvori' : '', 'racun'); miss.push(w); }
    if (!P.lst.length && !(P.warn || []).length) h += it(false, 'Nema listova', 'nacrtaj i izmjeri tlocrt', '', '');
    if (info.leg) { const L = info.leg;
      h += '<h3>IZRAČUN</h3>' + (L.calc ? it(true, 'GBP i obujam', 'izračunato', 'Otvori', 'gbp') : (miss.push('GBP i obujam'), it(false, 'GBP i obujam', L.err || 'nije izračunato', 'Otvori', 'gbp')));
      h += '<h3>PRILOZI</h3>' + (L.kp ? it(true, 'Kopija katastarskog plana', 'odabrana', 'Promijeni', 'gbp') : (miss.push('kopija plana'), it(false, 'Kopija katastarskog plana', 'nije odabrana (PDF ili slika)', 'Odaberi', 'gbp'))) +
        (L.dgu ? it(true, 'Uvjerenje DGU', L.dgu + ' str.', 'Promijeni', 'gbp') : (miss.push('uvjerenje DGU'), it(false, 'Uvjerenje DGU', 'nije odabrano (PDF ili slika)', 'Odaberi', 'gbp'))) +
        it(L.foto > 0, 'Fotografije', L.foto ? L.foto + ' dodanih, redom u okvire' : 'nema dodanih (idu i fotografije sa skice)', 'Uredi', 'gbp');
      h += '<h3>DOKUMENTI</h3>' + (L.tplS ? it(true, 'Snimka izvedenog stanja', 'tvoj Excel predložak', '', '') : (miss.push('predložak snimke'), it(false, 'Snimka izvedenog stanja', 'učitaj svoj Excel predložak', 'Učitaj', 'gbp'))) +
        (L.tplI ? it(true, 'Izjava statičara', 'tvoj Word predložak', '', '') : (miss.push('predložak izjave'), it(false, 'Izjava statičara', 'učitaj svoj Word predložak', 'Učitaj', 'gbp'))); }
    if (info.en) { const E = info.en; h += '<h3>ENERGETSKI CERTIFIKAT</h3>' + it(E.tables, 'Površine za KI Expert', E.tables ? 'Excel i PDF' : 'proračun nije složen', 'Otvori', 'racun') + (E.tpl ? it(true, 'Izvješće', 'tvoj Excel predložak', 'Otvori', 'izv') : it(false, 'Izvješće', 'učitaj Excel predložak izvješća (nije obavezno za ZIP)', 'Otvori', 'izv')); if (!E.tables) miss.push('proračun'); }
    if (!info.leg && !info.en) { const rs = povRows(); h += '<h3>POVRŠINE PROSTORIJA</h3>' + (rs.length ? rs.filter(r => r.tot).map(r => it(true, r.f, r.n + ' prostorija · ' + fmt2(r.tot) + ' m²', '', '')).join('') : it(false, 'Površine', 'tlocrt još nije izrađen', '', '')); }
    h += '</div><div class="pp-col" style="flex:1"><h2 style="display:flex;align-items:center;gap:8px">Izvoz<span style="flex:1"></span><button class="pp-x" title="Zatvori">✕ Zatvori</button></h2><button class="pp-big" id="ppZip">⬇ Sve za predaju (ZIP)<small>' + esc(zipName()) + ' – ' + esc(zipList()) + '</small></button><div id="ppMsg"></div>' +
      '<button class="pp-big sec" data-act="nacrti">📐 Nacrti – PDF / DXF<small>pregled listova, odabir i izvoz pojedinačno</small></button>' +
      (info.leg ? '<button class="pp-big sec" data-act="snimka">📊 Snimka izvedenog stanja (Excel)</button><button class="pp-big sec" data-act="izjava">📝 Izjava statičara (Word)</button>' : '') +
      (info.en ? '<button class="pp-big sec" data-act="izvR">📊 Izvješće (Excel)</button>' : '') +
      (!info.leg && !info.en ? '<button class="pp-big sec" data-act="pov">📊 Površine prostorija (Excel)</button>' : '') +
      '<button class="pp-big sec" data-act="skAll">🖊 Skica – PDF (sve etaže)<small>skica sa slojevima, kako je nacrtana</small></button><button class="pp-big sec" data-act="skOne">🖊 Skica – PDF (ova etaža)</button>' +
      (miss.length ? '<div class="pp-warn"><b>Prije predaje:</b> nedostaje ' + esc(miss.slice(0, 6).join(', ')) + (miss.length > 6 ? '…' : '') + '. ZIP se može složiti i ovako – složi se ono što je spremno.</div>' : '<div class="pp-okbox">✓ Sve je spremno za predaju.</div>') + '</div>';
    d.innerHTML = h;
    d.querySelector('.pp-x').onclick = () => closePredaja();
    d.querySelectorAll('[data-act]').forEach(b => b.onclick = () => act(b.dataset.act, b));
    $('ppZip').onclick = () => zipAll($('ppZip'));
  }
  async function act(a, b) {
    const save = r => { if (r) EX().saveBytes(r.bytes, r.name, r.mime); };
    if (a === 'tl') { closePredaja(); NC().open(); }
    else if (a === 'racun') { closePredaja(); EN().open(); }
    else if (a === 'gbp') { closePredaja(); EN().openTab(9); }
    else if (a === 'izv') { closePredaja(); EN().openTab(8); }
    else if (a === 'nacrti') { NC().showExport(); }
    else if (a === 'snimka' || a === 'izjava' || a === 'izvR') { const t0 = b.innerHTML; b.disabled = true; b.textContent = 'Slažem…'; try { const r = await (a === 'snimka' ? EN().snimkaBytes() : a === 'izjava' ? EN().izjavaBytes() : EN().izvBytes(n => { b.textContent = 'Slažem… slika ' + n; })); if (!r) alert('Prvo učitaj svoj predložak (Pročelja i GBP → GBP i obujam).'); else save(r); } catch (e) { alert('Nije složeno: ' + (e.message || e)); } b.disabled = false; b.innerHTML = t0; }
    else if (a === 'pov') { try { save(povXlsx()); } catch (e) { alert('Površine nisu složene: ' + (e.message || e)); } }
    else if (a === 'skAll') { const o = $('allfloorpdf'); if (o) o.click(); }
    else if (a === 'skOne') { const o = $('layerpdf'); if (o) o.click(); }
  }
  const fmt2 = v => (Math.round(v * 100) / 100).toFixed(2).replace('.', ',');
  const sanit = s => String(s || '').replace(/[^a-z0-9čćžšđ_-]+/gi, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  function zipName() { const I = window.projectInfo || {}; if (I.mapa && /^\d{4}_\d{2}_/.test(String(I.mapa).split(/[\\/]/).pop())) return sanit(String(I.mapa).split(/[\\/]/).pop()) + '.zip'; const d = new Date(); return d.getFullYear() + '_' + String(d.getMonth() + 1).padStart(2, '0') + '_' + (sanit(pname()) || 'izmjera') + '.zip'; }
  function zipList() { const l = ['nacrti PDF i DXF']; if (isLeg()) l.push('snimka', 'izjava'); if (isEn()) l.push('površine', 'izvješće'); if (!isLeg() && !isEn()) l.push('površine prostorija'); return l.join(' + '); }
  function povRows() { let D; try { D = EN().nacrtiData(); } catch (e) { return []; } const out = []; (D.floors || []).forEach((f, i) => { const b = D.built && D.built[i], o = b && !b.err && b.out; if (!o) return; const rs = (o.rooms || []).map((r, k) => ({ n: (o.roomNames && o.roomNames[k]) || 'Prostorija ' + (k + 1), a: r.area / 1e4, out: r.outside })).filter(r => !r.out && r.a > 0.05); out.push({ f: f.name || 'Etaža', rs, n: rs.length, tot: rs.reduce((s, r) => s + r.a, 0) }); }); return out; }
  function povXlsx() { const R = povRows(), B = v => ({ v, b: true }), rows = [[B('Etaža'), B('Prostorija'), B('Površina m²')]]; let all = 0;
    for (const f of R) { for (const r of f.rs) rows.push([f.f, r.n, Math.round(r.a * 100) / 100]); rows.push(['', B('Ukupno ' + f.f), B(Math.round(f.tot * 100) / 100)]); rows.push([]); all += f.tot; }
    if (R.length > 1) rows.push(['', B('UKUPNO'), B(Math.round(all * 100) / 100)]);
    return { name: (sanit(pname()) || 'izmjera') + '_povrsine_prostorija.xlsx', bytes: EX().xlsx([{ name: 'Površine', cols: [18, 34, 14], rows }]), mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }; }
  async function zipAll(btn) {
    const msg = $('ppMsg'), t0 = btn.innerHTML; btn.disabled = true; const pr = t => { btn.textContent = '⏳ Slažem… ' + t; }; const files = [], warn = [];
    try { pr('nacrti'); await new Promise(r => setTimeout(r, 20)); try { const N = NC().files(); files.push(...N.files); (N.warn || []).forEach(w => warn.push('Nacrti: ' + w)); } catch (e) { warn.push('Nacrti: ' + (e.message || e)); }
      if (!isLeg() && !isEn()) { try { const r = povXlsx(); if (povRows().length) files.push(r); } catch (e) { warn.push('Površine: ' + (e.message || e)); } }
      try { const E = await EN().predajaFiles(pr); files.push(...E.files); warn.push(...E.warn); } catch (e) { warn.push(e.message || String(e)); }
      if (!files.length) { alert('Nema ničega za spremiti – prvo izradi tlocrt.'); return; }
      pr('ZIP'); const z = EX().zip(files.map(f => ({ name: f.name, data: f.bytes instanceof Uint8Array ? f.bytes : new Uint8Array(f.bytes) }))), name = zipName(); EX().saveBytes(z, name, 'application/zip');
      try { window.projectInfo = window.projectInfo || {}; projectInfo.predaja = Date.now(); A().save && A().save(); } catch (e) { }
      if (msg) msg.innerHTML = '<div class="pp-okbox">✓ Spremljeno: <b>' + esc(name) + '</b> – ' + files.length + ' datoteka: ' + esc(files.map(f => f.name).join(', ')) + '</div>' + (warn.length ? '<div class="pp-warn">' + warn.map(esc).join('<br>') + '</div>' : '');
      hsig = ''; renderHeader();
    } finally { btn.disabled = false; btn.innerHTML = t0; }
  }

  /* ---------- pomoć dolje lijevo samo prvi put ---------- */
  function hintOnce() { const st = $('status'); if (!st) return; const first = !store.get('izmjera-put-hint', ''); if (first) { store.set('izmjera-put-hint', '1'); return; }
    const fix = () => { if (/^Svaka etaža ima zasebne slojeve/.test(st.textContent.trim())) st.textContent = ' '; }; fix(); new MutationObserver(fix).observe(st, { childList: true, characterData: true, subtree: true }); }

  /* ---------- CSS ---------- */
  function css() { const s = document.createElement('style'); s.textContent = `
body.ui2 #enOpen,body.ui2 #ui2Left,body.ui2 #ui2Prov,body.ui2 #ui2Dxf,body.ui2 #activeProjectName{display:none!important}
.put-hid{display:none!important}
#putSteps{display:flex;align-items:center;gap:3px;margin-left:10px;min-width:0;overflow-x:auto;scrollbar-width:none}#putSteps::-webkit-scrollbar{display:none}
html body #putSteps .put-st{display:flex;align-items:center;gap:6px;height:38px;min-height:38px!important;padding:0 12px 0 6px!important;border-radius:999px!important;border:1px solid rgba(255,255,255,.18)!important;background:rgba(255,255,255,.07)!important;color:#dbe7f6!important;font:700 13px Arial!important;white-space:nowrap;cursor:pointer;min-width:0!important;width:auto!important;flex:none;box-shadow:none!important}
#putSteps .put-n{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:rgba(255,255,255,.14);font:800 12px Arial}
#putSteps .put-st i{font-style:normal;font-weight:800;color:#fbbf24;margin-left:2px}#putSteps .put-st i.g{color:#9fb6d3}
html body #putSteps .put-st.on{background:#60a5fa!important;color:#0b2140!important;border-color:#60a5fa!important;box-shadow:0 0 10px rgba(96,165,250,.5)!important}
#putSteps .put-st.on .put-n{background:#0b2140;color:#fff}#putSteps .put-st.on i{color:#7c2d12}
html body #putSteps .put-st.done{color:#86efac!important}#putSteps .put-st.done .put-n{background:#166534;color:#fff}
#putSteps .put-sep{color:#5d7ba0;font:700 16px Arial;margin:0 1px;flex:none}
body.sun #putSteps .put-st{color:#17457f!important;background:#fff!important;border-color:#b8cde5!important}
#putSteps.cmp .put-st:not(.on) .put-lb{display:none}html body #putSteps.cmp .put-st:not(.on){padding:0 8px 0 6px!important}
#ui2MorePop .ui2-tiles{grid-template-columns:repeat(2,110px)!important}html body #ui2MorePop .ui2-tiles button{width:110px!important}
#backhome{max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#ui2MorePop #ui2Foto,#ui2MorePop #terenZadatak,#ui2MorePop #terenSplit,#ui2MorePop #penMode,#ui2MorePop #terenSunce,#ui2MorePop #terenIzvoz,#ui2MorePop #terenKopija,#ui2MorePop #terenFsZum{display:none!important}
#ui2Menu #dxfplan,#ui2Menu #save,#ui2Menu #open,#ui2Menu #backup,#ui2Menu #layerpdf,#ui2Menu #allfloorpdf,#ui2Menu #terenKote,#ui2Menu #terenVeze{display:none!important}
html body #ui2Menu .files-group .controls>#putFiles{background:rgba(255,255,255,.05)!important;color:#fff!important}
#putProvPop{background:#0f2a4a!important;border:0!important;color:#fff;padding:10px!important;border-radius:16px!important;box-shadow:0 10px 28px rgba(0,0,0,.35)!important;max-width:min(460px,calc(100vw - 12px))}
#putProvPop .ui2-sec{font:800 9.5px Arial!important;letter-spacing:.9px;color:#9fb6d3!important;text-transform:uppercase;margin:9px 2px 5px!important;display:block}#putProvPop .ui2-sec:first-child{margin-top:0!important}
html body #putProvPop button{width:100%;text-align:left;min-height:44px;padding:8px 12px;border-radius:10px;border:0;background:rgba(255,255,255,.05);box-shadow:inset 0 0 0 1px #2b4a70;color:#fff;font:700 14px Arial;margin:2px 0}
#putPredaja{position:fixed;left:0;right:0;bottom:0;background:#eef3fa;z-index:55;display:flex;gap:18px;padding:18px 22px;font:15px Arial;color:#102b52;box-sizing:border-box;overflow:auto}
#putPredaja .pp-col{background:#fff;border:1px solid #d5e1f0;border-radius:14px;padding:14px 16px;box-shadow:0 2px 8px rgba(15,42,74,.06);align-self:flex-start;min-width:0}
#putPredaja h2{font:800 18px Arial;margin:0 0 6px;color:#0f2a4a}#putPredaja h3{font:800 12.5px Arial;color:#5b6b80;margin:14px 0 6px;letter-spacing:.3px}#putPredaja .pp-sub{color:#5b6b80;font-size:13px;margin:0 0 4px}
#putPredaja .pp-it{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:10px;border:1px solid #e3ebf5;margin:5px 0;background:#fbfdff}
#putPredaja .pp-ok{width:26px;height:26px;border-radius:50%;background:#166534;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-weight:800;flex:0 0 auto}#putPredaja .pp-ok.wa{background:#f59e0b}
#putPredaja .pp-it b{flex:1;min-width:0}#putPredaja .pp-it small{color:#5b6b80;font-weight:400}
#putPredaja .pp-sb{border:1px solid #9dbbe0;background:#fff;color:#17457f;border-radius:9px;padding:7px 11px;font:700 13px Arial;min-height:38px}
#putPredaja .pp-big{display:block;width:100%;text-align:left;border:0;border-radius:12px;padding:14px 16px;margin:8px 0;font:800 16px Arial;background:#17457f;color:#fff;min-height:52px}
#putPredaja .pp-big small{display:block;font:500 12.5px Arial;color:#c8dbf3;margin-top:3px}#putPredaja .pp-big.sec{background:#fff;color:#17457f;border:1px solid #9dbbe0;font-size:15px}#putPredaja .pp-big.sec small{color:#5b6b80}#putPredaja .pp-big:disabled{opacity:.7}
#putPredaja .pp-warn{margin-top:10px;padding:10px 12px;border-radius:10px;background:#fff7ed;border:1px solid #fdba74;color:#7c2d12;font-size:13.5px}
#putPredaja .pp-okbox{margin-top:10px;padding:10px 12px;border-radius:10px;background:#f0fdf4;border:1px solid #86efac;color:#14532d;font-size:13.5px}
#putPredaja .pp-x{min-height:40px;padding:0 14px;border-radius:10px;border:1px solid #9dbbe0;background:#fff;color:#17457f;font:700 14px Arial}
@media (max-width:900px){#putPredaja{flex-direction:column}}`; document.head.appendChild(s); }

  /* ---------- pokretanje ---------- */
  let lastP = null;
  function tick() {
    if (!ui2()) return; if (!header()) return; buildBar(); menuTick();
    const p = pname(); if (p !== lastP) { lastP = p; closePredaja(); const fs = floors(); const m = store.get(modeKey(), '') || 'skica'; setMode(fs.length && !fs.some(hasNacrt) ? 'skica' : m, false); }
    else if (!mode) setMode('skica', false);
    renderHeader();
    { const top = $('appTop'), d = $('putSteps'); if (top && d) { d.classList.remove('cmp'); if (top.scrollWidth > top.clientWidth + 2 || d.scrollWidth > d.clientWidth + 2) d.classList.add('cmp'); } }
    /* zatvori Predaju kad se otvori drugi ekran (Nacrti, tlocrt, proračun) ili izađe iz projekta */
    const work = $('work'); if ($('putPredaja') && work && (work.classList.contains('hidden') || work.offsetParent === null)) closePredaja();
  }
  function init() { css(); hintOnce(); setInterval(tick, 900); setTimeout(tick, 300); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.IzmjeraPut = { setMode, openPredaja, closePredaja, go, steps, done, mode: () => mode, povXlsx, zipName };
})();
