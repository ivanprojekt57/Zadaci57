/* 📡 Laserski metar Leica DISTO (D2…) preko Bluetootha – spajanje, prijem očitanja, upis u polje / vođeno mjerenje */
(() => {
  const A = window.AndroidApp, $ = id => document.getElementById(id);
  const L = { s: 'off', msg: '', trig: false, last: null };
  const toast = m => { try { window.IzmjeraTeren ? IzmjeraTeren.toast(m) : (A && A.toast(m)); } catch (e) { } };
  const fmt = v => String(Math.round(v * 10) / 10).replace('.', ',');
  function paint() {
    const b = $('laserBtn'); if (b) { b.textContent = L.s === 'on' ? (M.on ? '📡 Ručno ✓' : '📡 Laser ✓') : /scan|connecting/.test(L.s) ? '📡 Spajam…' : '📡 Laser'; b.classList.toggle('active', L.s === 'on'); b.style.boxShadow = L.s === 'on' ? 'inset 0 -3px 0 #4ade80' : /scan|connecting/.test(L.s) ? 'inset 0 -3px 0 #fbbf24' : ''; b.title = L.msg || 'Laserski metar'; }
    try { window.IzmjeraVodic && IzmjeraVodic.refresh(); } catch (e) { }
  }
  function status(s, msg, trig) { const was = L.s; if (s !== 'on' && M.on) { M.on = false; M.target = null; } L.s = s; L.msg = msg || ''; L.trig = !!trig; paint(); if (msg && (s !== was || s === 'err' || s === 'perm')) toast('📡 ' + msg); }
  /* očitanje stiže u metrima */
  function value(m) {
    const cm = Math.round(Math.round(m * 1000) / 10); /* v2.83: laser zaokružuje na cijele cm (bez milimetara) */ L.last = cm;
    { /* Tipkaj: otvoreno polje za broj → očitanje se upiše i potvrdi */ const ti = $('typedIn'), bx = $('typedBox');
      if (ti && bx) { const t = fmt(cm), v = ti.value; ti.value = /\d\s*$/.test(v) ? t : v + t; const okb = bx.querySelector('[data-k="ok"]'); if (okb) okb.click(); toast('📡 ' + t + ' upisano'); return; } }
    try { if (window.IzmjeraVodic && IzmjeraVodic.laserFeed(cm)) return; } catch (e) { }
    const el = document.activeElement;
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && !/checkbox|radio|range|color/.test(el.type || '')) {
      const t = fmt(cm), a = el.selectionStart != null ? el.selectionStart : el.value.length, b = el.selectionEnd != null ? el.selectionEnd : el.value.length;
      el.value = el.value.slice(0, a) + t + el.value.slice(b); try { el.setSelectionRange(a + t.length, a + t.length); } catch (e) { }
      el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return;
    }
    if (M.on && M.target) { assign(cm); return; }
    tray.push({ id: Date.now() + Math.random(), v: cm }); if (tray.length > 12) tray.shift(); paintTray(); toast('📡 ' + fmt(cm) + ' cm spremljeno dolje – dodirni ga pa zid' + (M.on ? '' : ' (uključi Ručno mjerenje)'));
  }
  /* ======== ručno mjerenje laserom: dodirni zid → sljedeće očitanje je njegova kota; dugi pritisak u prostoriji → visina ======== */
  const M = { on: false, target: null, sel: null }, tray = [];
  const TR = () => window.IzmjeraTeren, C = () => window.IzmjeraTlocrtCore, app = () => window.IzmjeraApp;
  function setMode(on) { M.on = on; M.target = null; { const sb = $('laserSide'); if (sb) sb.remove(); } if (!on) M.sel = null; paint(); paintTray(); try { app().redraw(); } catch (e) { } if (on) toast('📡 Ručno mjerenje: dodirni zid pa izmjeri. Dugi pritisak u prostoriji = visina. Isključi istim gumbom.'); }
  function addText(text, rawC, dir) { const L0 = String(text).length, fs = app().typeFs ? app().typeFs() : 18, k = fs / 18, it = { type: 'text', layer: 'kote', color: '#0000ff', x: Math.round((rawC.x - L0 * 5 * k) * 10) / 10, y: Math.round((rawC.y + 7 * k) * 10) / 10, text: String(text), dir, lz: 1 }; if (fs !== 18) it.fs = fs; app().items().push(it); return it; }
  function wallAt(p, tol) { const T = TR().T; TR().analyzeNow(true); const m = T.m; if (!m) return null; const th = m.theta || 0, a = C().rotP(p, -th), E = m.E; let best = null, bd = Math.max(1.6 * E, tol || 0);
    for (const w of m.walls) { if (w.view) continue; const u = w.o === 'H' ? a.x : a.y, v = w.o === 'H' ? a.y : a.x; if (u < w.e0 - 0.5 * E || u > w.e1 + 0.5 * E) continue; const d = Math.abs(v - w.c); if (d < bd) { bd = d; best = { w, u: Math.max(w.e0 + E, Math.min(w.e1 - E, u)), side: Math.sign(v - w.c) || 1, th, E }; } }
    return best; }
  function assign(cm) { const t = M.target; if (!t) return; const A = app(); A.snapshot(); const f = fmt(cm);
    if (t.kind === 'wall') { const { w, u, side, th, E } = t, q = w.o === 'H' ? { x: u, y: w.c + side * 1.8 * E } : { x: w.c + side * 1.8 * E, y: u }, rc = C().rotP(q, th), d = C().rotP(w.o === 'H' ? { x: 1, y: 0 } : { x: 0, y: 1 }, th); addText(f, rc, Math.abs(d.x) >= Math.abs(d.y) ? 'H' : 'V'); }
    else if (t.kind === 'h') addText('h=' + f, t.p, 'H');
    M.target = null; { const sb = $('laserSide'); if (sb) sb.remove(); } A.save(); try { TR().T.sig = ''; } catch (e) { } A.redraw(); toast('📡 ' + (t.kind === 'h' ? 'visina ' : 'kota ') + f + ' upisana'); }
  function useChip(cm, id) { const i = tray.findIndex(x => x.id === id); if (i >= 0) tray.splice(i, 1); M.sel = null; assign(cm); paintTray(); }
  /* s koje strane zida je mjera: vanjski zid → Iznutra / Izvana, unutarnji → strana (soba) */
  function sideBar(cx, cy) { let d = $('laserSide'); if (d) d.remove(); const t = M.target; if (!t || t.kind !== 'wall') return; const w = t.w, ext = !!(w.exterior && w.outSide);
    const dirW = sd => { const n = C().rotP(w.o === 'H' ? { x: 0, y: sd } : { x: sd, y: 0 }, t.th); return Math.abs(n.x) >= Math.abs(n.y) ? (n.x < 0 ? '◀ lijevo' : 'desno ▶') : (n.y < 0 ? '▲ gore' : '▼ dolje'); };
    const opts = ext ? [[-w.outSide, '⌂ Iznutra'], [w.outSide, '▢ Izvana']] : [[-1, dirW(-1)], [1, dirW(1)]];
    d = document.createElement('div'); d.id = 'laserSide'; d.style.cssText = 'position:fixed;z-index:61;display:flex;gap:6px;align-items:center;padding:6px 8px;border-radius:14px;background:#0f2a4a;border:1px solid #60a5fa;box-shadow:0 6px 18px rgba(0,0,0,.35)';
    d.innerHTML = '<span style="color:#9fb6d3;font:700 12px Arial">📡 strana:</span>' + opts.map(([v, l]) => '<button data-s="' + v + '" style="min-height:40px;padding:4px 12px;border-radius:10px;font:700 15px Arial;' + (t.side === v ? 'background:#60a5fa;color:#0b2140;border:1px solid #60a5fa' : 'background:rgba(255,255,255,.06);color:#dbe7f5;border:1px solid #24446b') + '">' + l + '</button>').join('');
    document.body.appendChild(d); const bw = d.offsetWidth, bh = d.offsetHeight; d.style.left = Math.max(6, Math.min(innerWidth - bw - 6, cx - bw / 2)) + 'px'; d.style.top = Math.max(6, cy - bh - 46 < 70 ? cy + 40 : cy - bh - 46) + 'px';
    d.querySelectorAll('[data-s]').forEach(b => { b.onpointerdown = e => e.preventDefault(); b.onclick = () => { if (M.target !== t) { d.remove(); return; } t.side = +b.dataset.s; app().redraw(); sideBar(cx, cy); }; }); }
  function onDown(p, e) { const A = app(), cv = $('canvas'), sx = e.clientX, sy = e.clientY, pid = e.pointerId; let moved = false, multi = false, long = false;
    const tm = setTimeout(() => { if (moved || multi) return; long = true; const T = TR().T; TR().analyzeNow(true); M.target = { kind: 'h', p }; try { navigator.vibrate && navigator.vibrate(30); } catch (er) { } A.redraw(); if (M.sel) { const c = tray.find(x => x.id === M.sel); if (c) useChip(c.v, c.id); } else toast('📡 Visina prostorije: izmjeri od poda do stropa'); void T; }, 550);
    const dn = ev => { if (ev.pointerId !== pid) { multi = true; clearTimeout(tm); } }, mv = ev => { if (ev.pointerId === pid && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 12) { moved = true; clearTimeout(tm); } };
    const up = ev => { if (ev.pointerId !== pid) return; clearTimeout(tm); ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'].forEach((n, k) => window.removeEventListener(n, [dn, mv, up, up][k], true));
      if (long || moved || multi || ev.type !== 'pointerup') return; const W = wallAt(p); if (!W) { toast('📡 Dodirni crtu zida (ili dugo pritisni u prostoriji za visinu).'); M.target = null; A.redraw(); return; }
      M.target = Object.assign({ kind: 'wall' }, W); A.redraw(); sideBar(ev.clientX, ev.clientY); if (M.sel) { const c = tray.find(x => x.id === M.sel); if (c) useChip(c.v, c.id); } };
    window.addEventListener('pointerdown', dn, true); window.addEventListener('pointermove', mv, true); window.addEventListener('pointerup', up, true); window.addEventListener('pointercancel', up, true); }
  function hookIn() { const A = app(); if (!A || !A.hooks || !window.IzmjeraTeren) return setTimeout(hookIn, 500);
    A.hooks.tap.unshift((p, e) => { if (document.querySelector('.tp-sheet.nb')) return 'hand'; /* izbornik prozora/vrata otvoren: dodir samo pomiče/zumira */ if (!e) return false; if (L.s === 'on' && e.pointerType === 'touch' && app().typeOn && app().typeOn() && ($('layer') || {}).value === 'kote') return TR().fingerTap(p, e, () => { app().askTyped({ pts: [p] }); }); /* Tipkaj + laser: prst na mjesto broja → polje (utipkaj ili izmjeri) */
      if (!M.on) return false; onDown(p, e); return 'hand'; }); /* 'hand': prsti i dalje pomiču/zumiraju; dodir bez pomaka = odabir zida */
    A.hooks.draw.push((ctx, s) => { const t = M.target; if (!M.on || !t || t.kind !== 'wall') { const sb = $('laserSide'); if (sb) sb.remove(); } if (!M.on || !t) return; ctx.save(); ctx.strokeStyle = '#2563eb'; ctx.fillStyle = '#2563eb';
      if (t.kind === 'wall') { const w = t.w, a = C().rotP(w.o === 'H' ? { x: w.e0, y: w.c } : { x: w.c, y: w.e0 }, t.th), b = C().rotP(w.o === 'H' ? { x: w.e1, y: w.c } : { x: w.c, y: w.e1 }, t.th); ctx.globalAlpha = 0.5; ctx.lineWidth = 9 / s; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.globalAlpha = 1;
        const q = C().rotP(w.o === 'H' ? { x: t.u, y: w.c + t.side * 1.8 * t.E } : { x: w.c + t.side * 1.8 * t.E, y: t.u }, t.th); ctx.font = '700 ' + (14 / s) + 'px Arial'; ctx.textAlign = 'center'; ctx.fillText('📡 čekam mjeru…', q.x, q.y); }
      else { const ph = (Date.now() % 1200) / 1200; ctx.lineWidth = 3 / s; ctx.beginPath(); ctx.arc(t.p.x, t.p.y, (18 + 8 * ph) / s, 0, 7); ctx.stroke(); ctx.font = '700 ' + (14 / s) + 'px Arial'; ctx.textAlign = 'center'; ctx.fillText('📡 visina…', t.p.x, t.p.y - 32 / s); }
      ctx.restore(); });
    setInterval(() => { if (M.on && M.target && M.target.kind === 'h') try { app().redraw(); } catch (e) { } }, 150); }
  hookIn();
  /* spremnik očitanja (dolje na sredini) */
  function paintTray() { let d = $('laserTray'); if (!tray.length) { if (d) d.remove(); return; } if (!d) { d = document.createElement('div'); d.id = 'laserTray'; d.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:58px;z-index:60;display:flex;gap:6px;flex-wrap:wrap;justify-content:center;max-width:70vw;padding:6px 8px;border-radius:14px;background:#0f2a4a;box-shadow:0 6px 18px rgba(0,0,0,.3)'; document.body.appendChild(d); }
    d.innerHTML = '<span style="color:#9fb6d3;font:700 11px Arial;align-self:center">📡</span>' + tray.map(c => '<span data-c="' + c.id + '" style="display:inline-flex;align-items:center;gap:4px;padding:6px 10px;border-radius:999px;font:700 15px Arial;cursor:pointer;' + (M.sel === c.id ? 'background:#60a5fa;color:#0b2140' : 'background:rgba(255,255,255,.08);color:#dbe7f5;border:1px solid #24446b') + '">' + fmt(c.v) + '<b data-x="' + c.id + '" style="opacity:.6;margin-left:2px">×</b></span>').join('');
    d.querySelectorAll('[data-x]').forEach(b => b.onclick = ev => { ev.stopPropagation(); const i = tray.findIndex(x => String(x.id) === b.dataset.x); if (i >= 0) tray.splice(i, 1); if (String(M.sel) === b.dataset.x) M.sel = null; paintTray(); });
    d.querySelectorAll('[data-c]').forEach(b => { b.style.touchAction = 'none'; b.onpointerdown = ev => chipDrag(ev, b); });
    d.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { if (b._dragged) { b._dragged = false; return; } const c = tray.find(x => String(x.id) === b.dataset.c); if (!c) return; if (M.sel === c.id) { M.sel = null; paintTray(); return; } M.sel = c.id; if (!M.on) setMode(true); if (M.target) { useChip(c.v, c.id); return; } paintTray(); toast('📡 ' + fmt(c.v) + ' – sada dodirni zid (ili dugo u prostoriji za visinu)'); }); }
  /* v2.02: broj iz spremnika se može i povući prstom na zid  */
  function chipDrag(ev, b) { const c = tray.find(x => String(x.id) === b.dataset.c); if (!c) return; const sx = ev.clientX, sy = ev.clientY, pid = ev.pointerId; let g = null;
    const mv = e => { if (e.pointerId !== pid) return; if (!g && Math.hypot(e.clientX - sx, e.clientY - sy) < 10) return;
      if (!g) { g = document.createElement('div'); g.textContent = '📡 ' + fmt(c.v); g.style.cssText = 'position:fixed;z-index:70;pointer-events:none;padding:6px 12px;border-radius:999px;background:#60a5fa;color:#0b2140;font:800 16px Arial;box-shadow:0 6px 16px rgba(0,0,0,.35);transform:translate(-50%,-50%);margin-top:-30px'; document.body.appendChild(g); b._dragged = true; }
      g.style.left = e.clientX + 'px'; g.style.top = e.clientY + 'px'; e.preventDefault(); };
    const up = e => { if (e.pointerId !== pid) return; window.removeEventListener('pointermove', mv, true); window.removeEventListener('pointerup', up, true); window.removeEventListener('pointercancel', up, true); if (!g) return; g.remove(); if (e.type !== 'pointerup') return;
      const cv = $('canvas'), r = cv.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return; const p = app().world({ x: e.clientX - r.left, y: e.clientY - 30 - r.top }), W = wallAt(p, 40 / app().scale()); /* točka = mjesto broja (iznad prsta) */
      if (!W) { toast('📡 Pusti broj na crtu zida (broj ostaje dolje).'); return; } if (!M.on) setMode(true); M.target = Object.assign({ kind: 'wall' }, W); useChip(c.v, c.id); };
    window.addEventListener('pointermove', mv, true); window.addEventListener('pointerup', up, true); window.addEventListener('pointercancel', up, true); }
  function toggle() { if (!A || !A.laserConnect) { toast('Laser radi samo u aplikaciji na tabletu.'); return; } if (L.s === 'pick' || L.s === 'err') { if (A.laserList) { A.laserList(); return; } } if (L.s !== 'on') { A.laserConnect(); return; }
    const sh = window.IzmjeraTeren && IzmjeraTeren.sheet; if (!sh) { if (confirm('Odspojiti laserski metar?')) A.laserDisconnect(); return; }
    const d = sh('<div class="tp-head"><b style="flex:1">📡 Laserski metar – spojen</b><button data-a="x">✕</button></div><div class="tp-row" style="flex-direction:column;align-items:stretch">' +
      '<button data-a="m" style="text-align:left;' + (M.on ? 'background:#17457f;color:#fff' : '') + '">✋ <b>Ručno mjerenje</b> ' + (M.on ? '(uključeno – dodirni za isključenje)' : '– dodirni zid, pa izmjeri; dugi pritisak u prostoriji = visina') + '</button>' +
      (L.trig ? '<button data-a="g" style="text-align:left">🔴 <b>Izmjeri</b> iz aplikacije</button>' : '') +
      '<button data-a="d" style="text-align:left">⏏ Odspoji metar</button></div><div class="tp-note">Kad je otvoreno 📏 Mjeri, očitanje ide u trenutno pitanje. Očitanja bez cilja čekaju dolje – dodirni broj pa zid.</div>');
    d.querySelectorAll('[data-a]').forEach(b => b.onclick = () => { const a = b.dataset.a; d.remove(); if (a === 'm') setMode(!M.on); if (a === 'g') trigger(); if (a === 'd') { setMode(false); A.laserDisconnect(); } }); }
  function trigger() { if (!A || !A.laserTrigger) return; if (!A.laserTrigger()) toast('📡 Ovaj metar ne mjeri na naredbu – pritisni tipku na metru.'); }
  /* popis pronađenih / uparenih Bluetooth uređaja – kad se DISTO ne prepozna po imenu */
  function found(list) { const sh = window.IzmjeraTeren && IzmjeraTeren.sheet; if (!sh) return; list = (list || []).slice().sort((a, b) => (b.b ? 1 : 0) - (a.b ? 1 : 0) || (b.r || -999) - (a.r || -999));
    const d = sh('<div class="tp-head"><b style="flex:1">📡 Odaberi laserski metar</b><button data-a="x">✕</button></div>' +
      (list.length ? '<div class="tp-row" style="flex-direction:column;align-items:stretch">' + list.map(o => '<button data-addr="' + o.a + '" style="text-align:left"><b>' + String(o.n).replace(/</g, '&lt;') + '</b> <span style="opacity:.6">' + (o.b ? '· upareno' : (o.r ? '· signal ' + o.r : '')) + ' · ' + o.a + '</span></button>').join('') + '</div>' : '<div class="tp-note">Nije pronađen nijedan Bluetooth uređaj.</div>') +
      '<div class="tp-row"><button data-a="re">🔍 Traži ponovno</button></div><div class="tp-note">Na metru pritisni tipku Bluetooth (znak treperi). Ako je metar upareno u postavkama tableta, odaberi ga ovdje. Tablet: uključi Bluetooth i lokaciju.</div>');
    d.querySelectorAll('[data-a]').forEach(b => b.onclick = () => { d.remove(); if (b.dataset.a === 're') A.laserConnect(); });
    d.querySelectorAll('[data-addr]').forEach(b => b.onclick = () => { d.remove(); A.laserConnectAddr(b.dataset.addr); }); }
  window.IzmjeraLaser = { L, M, tray, status, value, toggle, trigger, setMode, found };
  /* gumb u gornjoj traci (uz Kote) */
  function addBtn() { if ($('laserBtn') || !A || !A.laserConnect) return; const top = $('appTop'), ref = $('terenKote') || $('ui2Dxf'); if (!top || !ref) return setTimeout(addBtn, 800);
    const b = document.createElement('button'); b.id = 'laserBtn'; b.type = 'button'; b.textContent = '📡 Laser'; b.onclick = toggle; ref.parentNode.insertBefore(b, ref); paint();
    try { const st = (A.laserState() || '').split('|'); if (st[0] === 'on') status('on', '', st[1] === 'true'); } catch (e) { } }
  addBtn();
})();
