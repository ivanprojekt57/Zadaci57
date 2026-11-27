/* Izmjera 57 — v1.43: novi raspored gumba (može se vratiti na klasični: ⋯ → Klasični izgled) */
(function () {
'use strict';
const $ = id => document.getElementById(id), app = () => window.IzmjeraApp;
const KEY = 'izmjera-ui', get = () => '2', set = v => { try { localStorage.setItem(KEY, v); } catch (e) { } };
const css = document.createElement('style'); css.textContent = `
body.ui2 .navigation-group{display:none!important}
body.ui2 #undo,body.ui2 #redo{display:none!important}
body.ui2 .files-group{display:none!important}
body.ui2 .floor-panel{display:none!important}
body.ui2 .ui2-pop .floor-panel,body.ui2 .ui2-pop .files-group{display:block!important;margin:0;box-shadow:none;border:0}
body.ui2 .ui2-pop .files-group .controls{display:flex!important;flex-wrap:wrap;gap:6px}
body.ui2 .ui2-pop .files-group .controls>button{flex:1 1 40%!important;width:auto!important;min-height:44px}
body.ui2 .ui2-pop .files-group .controls>.dxf-btn{flex:1 1 100%!important}
body:not(.ui2) .ui2-top{display:none!important}
body.ui2 #fullscreen,body.ui2 #orientationToggle,body.ui2 #lockDrawing{display:none}
body.ui2 .ui2-pop #fullscreen,body.ui2 .ui2-pop #orientationToggle,body.ui2 .ui2-pop #lockDrawing{display:inline-flex}
.ui2-top{display:none}
body.ui2 .ui2-top{display:inline-flex;align-items:center;gap:6px}
.ui2-btn{min-height:40px;padding:6px 12px;border-radius:10px;border:1px solid #b8cde5;background:#fff;color:#17457f;font:700 15px Arial;cursor:pointer;white-space:nowrap}
.ui2-btn.primary{background:#17457f;color:#fff;border-color:#17457f}
.ui2-save{font:600 13px Arial;color:#15803d;margin-left:10px;white-space:nowrap}
.ui2-save.dirty{color:#b45309}
.ui2-pop{position:fixed;z-index:65;background:#fff;border:1px solid #b8cde5;border-radius:14px;box-shadow:0 10px 30px #0003;padding:10px;max-height:calc(100vh - 80px);overflow:auto;min-width:280px}
.ui2-pop[hidden]{display:none}
.ui2-pop .ui2-row{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;padding-top:8px;border-top:1px solid #e5edf6}
html body.ui2.fullscreen .toolbar,html body.ui2-compact.fullscreen .toolbar{display:none!important}
body.ui2.fullscreen #work:not(.hidden){margin-left:0!important;width:100%!important;height:calc(100dvh - 46px)!important}
#ui2Quick{flex-wrap:wrap!important;justify-content:center;overflow:visible!important}


/* v2.08 početni zaslon (prijedlog 2): svijetlo – lijevo traka (Novi projekt, vrste, datoteke), desno „Nastavi” i popis */
#home{--hv-et:#3b82f6;--hv-le:#f59e0b;--hv-en:#22c55e;--hv-st:#e11d48;--hv-os:#92400e;--hv-pr:#0891b2;--hv-sv:#475569;--hv-ne:#94a3b8;--hv-na:#ea580c;--hv-tl:#1e3a5f;--hv-tr:#be185d;--hv-id:#65a30d}
body:has(#home:not(.hidden)){background:#f8fafc!important}
#home{background:#f8fafc!important;color:#0f2a4a}
#home.hv2:not(.hidden){display:flex!important;align-items:stretch;min-height:100dvh;padding:0!important;max-width:none!important}
#homeSide{width:280px;flex:none;background:#e8eef7;border-right:1px solid #d3deec;padding:20px 16px;display:flex;flex-direction:column;gap:8px;box-sizing:border-box}
#homeMain{flex:1;min-width:0;padding:22px 28px;box-sizing:border-box}
#homeSide .brand-home{display:flex;align-items:center;gap:10px;margin:0 0 10px}#homeSide .brand-home img{width:46px!important;height:46px!important;border-radius:10px}
#homeSide .brand-home-title{font:800 18px Arial!important;letter-spacing:1.5px;color:#0f2a4a!important}#homeSide .brand-home-subtitle{font:11px Arial!important;color:#64748b!important}
#homeSide #newproject{background:#2563eb!important;color:#fff!important;border:0!important;border-radius:14px!important;padding:16px!important;font:800 17px Arial!important;box-shadow:0 4px 12px rgba(37,99,235,.3)!important;width:100%}
.hv2-sec{font:800 11px Arial;color:#94a3b8;letter-spacing:.8px;margin:12px 4px 2px}
#homeSide #vrstaFilter{display:flex!important;flex-direction:column!important;gap:2px!important;margin:0!important;max-width:none!important}
#homeSide #vrstaFilter button{display:flex!important;align-items:center;justify-content:space-between;gap:10px;width:100%;text-align:left;padding:11px 12px!important;border-radius:10px!important;border:0!important;background:transparent!important;color:#334155!important;font:600 14px Arial!important;box-shadow:none!important}
#homeSide #vrstaFilter button::before{content:"";width:10px;height:10px;border-radius:3px;background:var(--c,transparent);flex:none}#homeSide #vrstaFilter button[data-f=""]::before,#homeSide #vrstaFilter button[data-done]::before{display:none}
#homeSide #vrstaFilter button span{margin-left:auto;color:#94a3b8!important;font-weight:700;opacity:1!important}
#homeSide #vrstaFilter button[style*="background:#1e40af"],#homeSide #vrstaFilter button[style*="background:#15803d"]{background:#fff!important;color:#0f2a4a!important;font-weight:800!important;box-shadow:0 1px 4px rgba(0,0,0,.06)!important}
#vrstaFilter [data-f="etazni"]{--c:var(--hv-et)}#vrstaFilter [data-f="legalizacija"]{--c:var(--hv-le)}#vrstaFilter [data-f="energetski"]{--c:var(--hv-en)}#vrstaFilter [data-f="statika"]{--c:var(--hv-st)}#vrstaFilter [data-f="ostalo"]{--c:var(--hv-os)}#vrstaFilter [data-f="procjena"]{--c:var(--hv-pr)}#vrstaFilter [data-f="savjetovanje"]{--c:var(--hv-sv)}#vrstaFilter [data-f="nadzor"]{--c:var(--hv-na)}#vrstaFilter [data-f="tlocrt"]{--c:var(--hv-tl)}#vrstaFilter [data-f="troskovnik"]{--c:var(--hv-tr)}#vrstaFilter [data-f="idejni"]{--c:var(--hv-id)}#vrstaFilter [data-f="nema"]{--c:var(--hv-ne)}
#homeSide .hv2-file{display:flex!important;align-items:center;gap:8px;width:100%;text-align:left;padding:11px 12px!important;border-radius:10px!important;border:0!important;background:transparent!important;color:#334155!important;font:700 14px Arial!important;box-shadow:none!important;white-space:normal}
#homeSide .hv2-file:active{background:#fff!important}
#homeContinue{max-width:none!important;margin:0 0 16px!important}
#homeContinue .go{display:flex!important;align-items:center;gap:20px;width:100%;text-align:left;background:linear-gradient(135deg,#0f2a4a,#17457f)!important;color:#fff!important;border:0!important;border-radius:18px!important;padding:16px!important;box-shadow:0 6px 18px rgba(15,42,74,.25)!important;font:800 15px Arial!important}
#homeContinue .go .hv2-th{width:120px;height:78px;flex:none;border-radius:10px;background:#fff center/contain no-repeat}#homeContinue .go{padding:10px 14px!important;gap:16px!important;border-radius:14px!important}#homeContinue{margin:0 0 10px!important}
.hv2-swf{display:flex!important;gap:10px;align-items:center}.hv2-swf #projectSearch{flex:1}.hv2-swf #homeTools{margin:0!important;flex:none;display:flex;align-items:center;gap:6px}
#homeContinue .go .hv2-tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}#homeContinue .go .hv2-k{font:700 12px Arial;color:#9fb6d3;letter-spacing:.6px}
#homeContinue .go span{font:800 21px Arial;color:#fff}#homeContinue .go small{font:14px Arial!important;color:#c7d6ea!important;margin:0!important;text-align:left!important;align-self:flex-start!important;display:block!important}#homeSide .brand-home-title *{color:#2563eb!important}#homeContinue .go .hv2-b{margin-left:auto;flex:none;background:#60a5fa;color:#0b2140;padding:11px 20px;border-radius:12px;font:800 16px Arial}
#homeMain #projectSearch{background:#fff!important;border:1px solid #d3deec!important;color:#0f2a4a!important;border-radius:12px!important;padding:13px 14px!important;font-size:15px!important;box-sizing:border-box}#projectSearch::placeholder{color:#94a3b8}
#homeMain #projectSearch,#homeMain #homeTools{max-width:none!important}#homeMain #projectSearch{width:100%}#homeMain .hv2-sw{max-width:none!important;margin:0 0 6px!important}
#homeTools,#homeTools *{color:#64748b!important}#homeTools select{background:#fff!important;border:1px solid #d3deec!important;color:#0f2a4a!important}
#home .project-list{max-width:none!important}
#home .pc{max-width:none!important;background:#fff!important;border:0!important;border-radius:12px!important;box-shadow:0 1px 3px rgba(15,42,74,.08)!important;border-left:5px solid var(--pc,#94a3b8)!important;margin:0 0 8px!important;padding:8px 12px!important}
#home .pc-th{width:84px!important;height:60px!important;background-color:#f1f5f9!important;border:0!important;border-radius:8px!important}
#home .pc-n{color:#0f2a4a!important;font:800 16px Arial!important}#home .pc-a{color:#64748b!important}#home .pc-s{color:#64748b!important;font-size:12px!important}#home .pc-s b{color:#15803d!important}
#home .pc-t span{background:color-mix(in srgb,var(--pc,#94a3b8) 14%,#fff)!important;color:var(--pc,#475569)!important;font-weight:700!important}
#home .pc-m{background:#f1f5f9!important;color:#334155!important;border:0!important}
#home .pcv-etazni{--pc:var(--hv-et)}#home .pcv-legalizacija{--pc:var(--hv-le)}#home .pcv-energetski{--pc:var(--hv-en)}#home .pcv-statika{--pc:var(--hv-st)}#home .pcv-ostalo{--pc:var(--hv-os)}#home .pcv-procjena{--pc:var(--hv-pr)}#home .pcv-savjetovanje{--pc:var(--hv-sv)}#home .pcv-nadzor{--pc:var(--hv-na)}#home .pcv-tlocrt{--pc:var(--hv-tl)}#home .pcv-troskovnik{--pc:var(--hv-tr)}#home .pcv-idejni{--pc:var(--hv-id)}#home .pcv-nema{--pc:var(--hv-ne)}
#home p{color:#64748b!important}
@media (min-width:761px){#home.hv2{height:100dvh;overflow:hidden!important}#homeSide{overflow-y:auto}#homeMain{display:flex;flex-direction:column;height:100dvh}#homeMain>*{flex:none}#homeMain>#homeTools{align-self:flex-end}#homeMain>#projectlist{flex:1 1 auto;align-content:start;min-height:0;overflow-y:auto;padding:2px 4px 20px 2px;margin:0 -4px 0 -2px}}
@media (max-width:760px){#home.hv2{flex-direction:column}#homeSide{width:auto;border-right:0;border-bottom:1px solid #d3deec}#homeSide #vrstaFilter{flex-direction:row!important;flex-wrap:wrap!important}#homeSide #vrstaFilter button{width:auto}#homeContinue .go .hv2-th{width:110px;height:80px}#homeContinue .go{gap:12px}#homeContinue .go .hv2-b{display:none}#homeContinue .go span{font-size:20px}#homeContinue .go small{font-size:12px!important;white-space:normal}}
/* v1.93 izgled: gornja traka + alatna traka = jedan tamni blok, svijetloplava crta između; dolje sve tamno */
body:not(.sun) #appTop{background:#0f2a4a!important;border-bottom:0!important}
body:not(.sun) #appTop button{background:rgba(255,255,255,.06)!important;border:1px solid #24446b!important;color:#dbe7f5!important}
body:not(.sun) #appTop #ui2Dxf{background:#60a5fa!important;color:#0b2140!important;border-color:#60a5fa!important;box-shadow:0 0 10px rgba(96,165,250,.5)}
body:not(.sun) #appTop #terenVeze.active{background:rgba(96,165,250,.22)!important;border-color:#60a5fa!important;color:#dbeafe!important;box-shadow:inset 0 -3px 0 #60a5fa!important}
body.sun #appTop #terenVeze.active{background:#dbeafe!important;border-color:#2563eb!important;color:#1e3a8a!important}
body:not(.sun) #appTop #terenKote.active{background:rgba(45,212,191,.18)!important;border-color:#2dd4bf!important;color:#99f6e4!important}
body:not(.sun) #appTop #terenMissing{box-shadow:inset 0 -3px 0 #f87171}body:not(.sun) #appTop #enOpen{box-shadow:inset 0 -3px 0 #fbbf24}
body:not(.sun) #activeProjectName{color:#fff!important}body:not(.sun) #ui2Save{color:#4ade80!important}
body:not(.sun) #ui2Quick{top:0!important;left:0!important;transform:none!important;width:100%!important;max-width:100%!important;border-radius:0 0 16px 16px!important;border:0!important}
body:not(.sun) #ui2Quick::before{content:"";position:absolute;left:0;right:0;top:0;height:2px;background:#60a5fa;pointer-events:none}
body:not(.sun) .ui2-float:not(#ui2Quick){background:#0f2a4a!important;border-color:#0f2a4a!important;box-shadow:0 6px 18px rgba(0,0,0,.25)!important}
body:not(.sun) .ui2-float:not(#ui2Quick) button{background:rgba(255,255,255,.06)!important;border:1px solid #24446b!important;color:#dbe7f5!important}
body:not(.sun) #status{left:0!important;margin-left:0!important;right:0!important;padding-left:12px!important;background:#0f2a4a!important;color:#9fb6d3!important;border-top:0!important}
body:not(.sun) #status:not(.hidden)::after{color:#fff!important;background:url("brand-logo.png") no-repeat 3px center/22px 22px,radial-gradient(circle at 14px center,#fff 13px,transparent 14px)!important}
/* v1.91 izgled E2: tamna traka, bijele ikone, crta u boji skupine; uključen gumb ispunjen bojom (☀ jaki kontrast vraća svijetlu traku) */
body:not(.sun) #ui2Quick{background:#0f2a4a!important;border-color:#0f2a4a!important;box-shadow:0 6px 18px rgba(0,0,0,.25)!important}
body:not(.sun) #ui2Quick>span{background:#2b4a70!important}
body:not(.sun) #ui2Quick button{border:1px solid transparent!important;border-radius:12px!important}
body:not(.sun) #ui2Quick button:not(.on){background:rgba(255,255,255,.05)!important;color:#dbe7f5!important;box-shadow:inset 0 -3px 0 var(--gc)}
/* v2.24: uključen gumb = samo obrub u boji skupine (ne puni se) */ body:not(.sun) #ui2Quick button.on{background:rgba(255,255,255,.10)!important;color:#fff!important;box-shadow:inset 0 0 0 3px var(--gc),0 0 10px rgba(0,0,0,.25)!important}body:not(.sun) #ui2Quick button.on svg{color:var(--gc)}
.ui2-grp[data-g="0"],.ui2-grp[data-g="6"]{--gc:#94a3b8}.ui2-grp[data-g="2"]{--gc:#fb923c}.ui2-grp[data-g="3"]{--gc:#fde047}.ui2-grp[data-g="4"]{--gc:#4ade80}.ui2-grp[data-g="5"]{--gc:#60a5fa}
.ui2-grp[data-g="1"] button:nth-child(1){--gc:#e5e7eb}.ui2-grp[data-g="1"] button:nth-child(2){--gc:#60a5fa}.ui2-grp[data-g="1"] button:nth-child(3){--gc:#f87171}.ui2-grp[data-g="1"] button:nth-child(4){--gc:#94a3b8}.ui2-grp[data-g="1"] button:nth-child(5){--gc:#fb923c}
body:not(.sun) .ui2-gt{color:var(--gc)!important;opacity:.9}body:not(.sun) .ui2-grp[data-g="1"] .ui2-gt{color:#9fb6d3!important}

.ui2-grp{display:flex;flex-direction:column;align-items:center;flex:none;gap:1px}.ui2-gt{font:700 9px Arial;letter-spacing:.4px;text-transform:uppercase;color:#5b7ba3;white-space:nowrap;line-height:11px;height:11px}.ui2-gr{display:flex;gap:inherit;gap:6px}
body.ui2-compact .ui2-gr{gap:3px}body.ui2-compact .ui2-gt{font-size:8px}
body.ui2-compact #ui2Quick{gap:3px;padding:4px}
body.ui2-compact #ui2Quick button{min-width:41px!important;padding:2px 1px!important}
#ui2Quick .ui2-gr{gap:4px!important}#ui2Un{gap:6px!important;align-items:center}#ui2Un>button{min-width:44px!important;min-height:44px!important;width:44px;height:44px;font-size:18px!important;padding:0!important}#ui2Un>button.ui2-unt{width:47px;height:47px;min-width:47px!important;min-height:47px!important;border-radius:12px!important;background:rgba(255,255,255,.05)!important;color:#dbe7f5!important;border:1px solid transparent!important;box-shadow:inset 0 -3px 0 #2dd4bf!important}html body #ui2Un>button.ui2-unt.on{background:rgba(45,212,191,.12)!important;color:#fff!important;box-shadow:inset 0 0 0 3px #2dd4bf!important}#ui2Un>button.ui2-unt.on svg{color:#2dd4bf}.ui2-unsep{width:1px;align-self:stretch;margin:4px 2px;background:#2b4a70}#ui2LayChip{position:absolute;left:14px;z-index:4;padding:4px 11px;border-radius:999px;background:#0f2a4a;font:800 12px Arial;border:2px solid #e5e7eb;pointer-events:none;letter-spacing:.3px}#ui2LayFrame{position:absolute;inset:0;pointer-events:none;z-index:3}#vdPanel.vd-min>:not(.vd-head){display:none!important}#vdPanel.vd-min{width:auto!important;min-width:0!important;padding:8px 10px!important}#vdPanel.vd-min .vd-head{gap:10px;white-space:nowrap;margin:0!important}#vdPanel.vd-min::after{content:'⏸ nastavlja se kad ugasiš alat';display:block;font:600 12px Arial;color:#9a3412;margin-top:4px}#ui2Hint{position:fixed;z-index:80;display:none;padding:6px 10px;border-radius:10px;background:rgba(15,42,74,.82);color:#e2e8f0;font:500 12px/1.35 Arial;border-left:4px solid var(--hc,#4ade80);box-shadow:0 2px 8px rgba(0,0,0,.18);left:12px;bottom:calc(var(--ui2-st,26px) + 12px)}.ui2-pvn[hidden]{display:none!important}.ui2-pvn{display:inline-block;min-width:18px;padding:0 5px;margin-left:4px;border-radius:9px;background:#f97316;color:#fff;font-size:12px;text-align:center}#ui2Prov.on{background:#dc2626!important;color:#fff!important}#ui2Quick button{min-width:47px!important;width:47px}#ui2Prov.on{background:#dc2626!important;color:#fff!important;border-color:#dc2626!important}
body.ui2-compact #ui2Quick button span span{font-size:9px!important}
body.ui2-compact #ui2Quick>span{margin:0!important}
.ui2-float{position:absolute;z-index:6;display:none;gap:6px;background:rgba(255,255,255,.92);border:1px solid #b8cde5;border-radius:14px;padding:6px;box-shadow:0 4px 14px #0002}
body.ui2 .ui2-float{display:flex}
.ui2-float button{min-width:48px;min-height:48px;border-radius:10px;border:1px solid #b8cde5;background:#fff;color:#17457f;font:700 20px Arial;cursor:pointer}
/* crtanje: stranica se ne smije pomicati (inače se gornja traka ili dno sakriju ispod sistemske crte) */
html.ui2-draw,html.ui2-draw body{overflow:hidden!important;height:100%!important;overscroll-behavior:none}
body.ui2 #status{white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis;max-height:27px;box-sizing:border-box}
/* uspravno (portret): gornja traka samo s ikonama, da sve stane */
body.ui2-compact #activeProjectName{display:none!important}
body.ui2-compact .app-top{gap:4px!important;padding:3px 5px!important}
body.ui2-compact .app-top button{padding:5px 8px!important;min-width:40px}
body.ui2-compact .ui2-ic{font-size:0!important}
body.ui2-compact .ui2-ic svg,body.ui2-compact .ui2-ic .top-icon,body.ui2-compact .ui2-ic>span{display:none!important}
body.ui2-compact .ui2-ic::before{content:attr(data-ic);font-size:18px;line-height:20px}
body.ui2-compact #ui2Floor{max-width:150px;overflow:hidden;text-overflow:ellipsis}
body.ui2-compact .toolbar:not(.hidden){display:flex!important;flex-wrap:nowrap!important;align-items:stretch;justify-content:flex-start!important}
body.ui2-compact .toolbar .layer-panel{flex:0 0 200px!important;width:200px!important;max-width:200px!important;margin:0!important}
body.ui2-compact .toolbar .drawing-group{flex:1 1 0!important;width:auto!important;min-width:0;margin:0!important}
body.ui2-compact .drawing-group .drawing-controls{display:flex!important;flex-wrap:wrap;gap:6px;align-items:center}
body.ui2-compact .drawing-group .drawing-row{margin:0!important;flex:0 1 auto}
body.ui2-compact .drawing-group .drawing-tools{display:flex!important}
body.ui2-compact .drawing-group .drawing-tools button{min-width:84px}
body.ui2-compact #ui2Toggles{margin-top:0!important;flex:1 1 100%;grid-template-columns:repeat(4,minmax(0,1fr))!important}
body.ui2 .drawing-group .drawing-tools{display:grid!important;grid-template-columns:repeat(3,1fr);gap:6px}
body.ui2 .drawing-group .drawing-tools button{min-height:44px;padding:4px 2px;font-size:13px}
body.ui2 #ui2Toggles{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:6px;margin-top:6px}
body.ui2 #ui2Toggles button{width:100%!important;min-width:0!important;min-height:40px;font-size:12px;line-height:1.15;padding:4px 4px;margin:0!important;white-space:normal;overflow:hidden}
body.ui2 .ui2-undorow{display:none!important}
#ui2Quick,#ui2Quick *,.ui2-float,.ui2-float *,.ui2-pop,.ui2-pop *{-webkit-user-select:none!important;user-select:none!important;-webkit-touch-callout:none!important}
/* v1.72: lijevi panel maknut – sve je u gornjoj traci i u „⋯ Više” */
html body.ui2 .toolbar,html body.ui2 .toolbar:not(.hidden){display:none!important}
body.ui2 #work:not(.hidden){margin-left:0!important;width:100%!important;height:calc(100dvh - var(--ui2-top,46px) - var(--ui2-st,27px))!important}
html body.ui2.fullscreen #appTop{display:none!important}
body.ui2.fullscreen #work:not(.hidden){height:calc(100dvh - var(--ui2-st,27px))!important}
#ui2ToolPop{min-width:220px}
#ui2ToolPop .ui2-sec{font:700 12px Arial;color:#5b6b80;text-transform:uppercase;margin:6px 0 5px}
#ui2ToolPop .pen-settings,#ui2ToolPop .ui2-mrow{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
#ui2ToolPop select{min-height:40px;font-size:15px;min-width:110px}
#ui2ToolPop #penMode{min-height:44px;padding:6px 12px;border-radius:10px;border:1px solid #b8cde5;background:#fff;color:#17457f;font:700 14px Arial;width:auto!important;margin:0!important}
#ui2MorePop{min-width:300px;max-width:min(560px,calc(100vw - 12px))}
#ui2MorePop .ui2-sec{font:700 12px Arial;color:#5b6b80;text-transform:uppercase;letter-spacing:.04em;margin:10px 0 5px}
#ui2MorePop .ui2-sec:first-child{margin-top:0}
#ui2MorePop .layer-panel{display:block!important;margin:0!important;box-shadow:none!important;border:0!important;background:none!important;padding:0!important;width:auto!important;max-width:none!important}
#ui2MorePop .layer-panel>.group-title{display:none}
#ui2MorePop .layer-list{display:grid!important;grid-template-columns:1fr 1fr;gap:6px}
#ui2MorePop .pen-settings,#ui2MorePop .ui2-mrow{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
#ui2MorePop .ui2-mrow button,#ui2MorePop #penMode{min-height:44px;padding:6px 12px;border-radius:10px;border:1px solid #b8cde5;background:#fff;color:#17457f;font:700 14px Arial;width:auto!important;margin:0!important}
#ui2MorePop select{min-height:40px;font-size:15px;min-width:110px}
#ui2Sel{left:50%;transform:translateX(-50%);flex-wrap:wrap;justify-content:center;max-width:calc(100% - 16px)}
#ui2Sel button{min-height:44px;font:700 14px Arial;padding:4px 10px}
`;
document.head.appendChild(css);

let built = false, homes = {};
function pop(id) { let p = $(id); if (!p) { p = document.createElement('div'); p.id = id; p.className = 'ui2-pop'; p.hidden = true; document.body.appendChild(p); p.addEventListener('click', e => e.stopPropagation()); } return p; }
function openPop(p, anchor) { closePops(p); p.hidden = !p.hidden; if (p.hidden) return; const r = anchor.getBoundingClientRect(); /* v2.27: gumb dolje (donja traka) → izbornik se otvara iznad njega */ if (r.top > innerHeight / 2) { p.style.maxHeight = Math.max(200, r.top - 16) + 'px'; p.style.top = Math.max(6, r.top - 6 - Math.min(p.offsetHeight, r.top - 16)) + 'px'; } else { p.style.maxHeight = ''; p.style.top = (r.bottom + 6) + 'px'; } const w = p.offsetWidth; p.style.left = Math.max(6, Math.min(innerWidth - w - 6, r.left + r.width / 2 - w / 2)) + 'px'; }
function closePops(except) { document.querySelectorAll('.ui2-pop').forEach(p => { if (p !== except) p.hidden = true; }); }
document.addEventListener('click', () => closePops());

function build() {
  if (built) return; const top = $('appTop'), acts = top && top.querySelector('.top-actions'), work = $('work'); if (!top || !acts || !work) return; built = true;
  // gornja traka: etaža ▾, spremljeno, DXF, ⋯
  const fl = document.createElement('button'); fl.id = 'ui2Floor'; fl.className = 'ui2-btn ui2-top'; fl.style.marginLeft = '8px'; fl.onclick = e => { e.stopPropagation(); place(); openPop(pop('ui2FloorPop'), fl); };
  const sv = document.createElement('span'); sv.id = 'ui2Save'; sv.className = 'ui2-save ui2-top';
  $('projInfo').after(fl); const nm = $('activeProjectName'); if (nm) nm.after(sv); else fl.after(sv);
  const dx = document.createElement('button'); dx.id = 'ui2Dxf'; dx.className = 'ui2-btn primary ui2-top'; dx.textContent = '📐 Nacrti'; dx.title = 'Nacrti: tlocrti po etažama, pročelja i presjeci, izvoz svih nacrta'; dx.onclick = () => { if (window.IzmjeraNacrti) IzmjeraNacrti.open(); else $('dxfplan').click(); };
  const mn = document.createElement('button'); mn.id = 'ui2MenuBtn'; mn.className = 'ui2-btn ui2-top'; mn.textContent = '⋯'; mn.title = 'Datoteke i postavke'; mn.style.fontSize = '20px'; mn.onclick = e => { e.stopPropagation(); place(); openPop(pop('ui2Menu'), mn); };
  const pvb = document.createElement('button'); pvb.id = 'ui2Prov'; pvb.className = 'ui2-btn ui2-top'; pvb.textContent = '🔎 Provjera'; pvb.title = 'Provjera crteža: rupe, dvostruke crte, kote u zraku'; pvb.onclick = () => { const b = $('terenProvjera'); if (b) b.click(); setTimeout(() => pvb.classList.toggle('on', !!($('terenProvjera') && $('terenProvjera').classList.contains('active'))), 50); };
  acts.appendChild(pvb); acts.appendChild(dx); acts.appendChild(mn);
  // plutajući gumbi na crtežu
  const un = document.createElement('div'); un.className = 'ui2-float'; un.style.cssText = 'right:10px;bottom:10px'; un.innerHTML = '<button title="Poništi">↶</button><button title="Vrati">↷</button>';
  un.children[0].onclick = () => $('undo').click(); un.children[1].onclick = () => $('redo').click();
  const nv = document.createElement('div'); nv.className = 'ui2-float'; nv.style.cssText = 'left:10px;bottom:10px'; nv.innerHTML = '<button title="Cijeli crtež">⤢</button><button title="Zakreni lijevo 90°">↺</button><button title="Zakreni desno 90°">↻</button><button title="Vrati na 0°" style="font-size:15px">0°</button><button title="Pomicanje (ruka)">✋</button><button title="Više / manje gumba" class="ui2-nvx" style="min-width:30px;font-size:16px">›</button>';
  const nb = nv.children; nb[0].onclick = () => { try { app().fit(); } catch (e) { } }; nb[1].onclick = () => $('rotleft').click(); nb[2].onclick = () => $('rotright').click(); nb[3].onclick = () => $('rotreset').click(); nb[4].onclick = () => { const h = document.querySelector('.hand-button'); if (h) h.click(); };
  { /* v1.94: dolje lijevo samo ⤢ (cijeli crtež) – ostalo (zakretanje, ruka) skriveno iza › */ let open = false; try { open = localStorage.getItem('izmjera-nav-open') === '1'; } catch (e) { }
    const setN = o => { open = o; for (let k = 1; k <= 4; k++) nb[k].style.display = o ? '' : 'none'; nb[5].textContent = o ? '‹' : '›'; try { localStorage.setItem('izmjera-nav-open', o ? '1' : '0'); } catch (e) { } };
    nb[5].onclick = () => setN(!open); setN(false); nb[5].style.display = 'none'; /* v2.06: ostaje samo ⤢ */ }
  if (getComputedStyle(work).position === 'static') work.style.position = 'relative'; work.appendChild(un); work.appendChild(nv);
  // v1.64: najčešći alati za crtanje gore na crtežu (iste funkcije kao u lijevom panelu)
  const SV = (d, w) => '<svg viewBox="0 0 24 24" width="' + (w || 24) + '" height="' + (w || 24) + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>';
  const IC = {
    pen: SV('<path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="M14 6l3 3"/>'),
    line: SV('<path d="M5 19L19 5"/><circle cx="5" cy="19" r="1.6" fill="currentColor"/><circle cx="19" cy="5" r="1.6" fill="currentColor"/>'),
    erase: SV('<path d="M8 20h12"/><path d="M4.5 14.5l8.8-8.8a2 2 0 012.8 0l3.2 3.2a2 2 0 010 2.8L13 18H8z"/><path d="M9.5 9.5l5 5"/>'),
    select: SV('<rect x="3" y="3" width="13" height="13" rx="1" stroke-dasharray="2.5 2.5"/><path d="M12 12l9 4-4 1-1 4z" fill="currentColor"/>'),
    nacrt: SV('<path d="M3 20V4h10v7h8v9z" stroke-width="2.4"/>'),
    kote: SV('<path d="M3 12h18"/><path d="M7 8l-4 4 4 4M17 8l4 4-4 4"/>'),
    full: SV('<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/><path d="M9 9l-5-5M15 9l5-5M15 15l5 5M9 15l-5 5" stroke-width="1.4"/>'),
    text: SV('<path d="M5 6V4h14v2M12 4v16M9 20h6"/>'),
    del: SV('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/><path d="M10 11v6M14 11v6"/>'),
    opisi: SV('<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>'),
    pogled: SV('<path d="M4 9s3-4.5 8-4.5S20 9 20 9s-3 4.5-8 4.5S4 9 4 9z"/><circle cx="12" cy="9" r="2"/><path d="M3 19h18" stroke-dasharray="3 2.6"/>'),
    prozor: SV('<path d="M2 12h3M19 12h3"/><rect x="5" y="8.5" width="14" height="7" rx="0.8"/><path d="M5 12h14" stroke-width="1.4"/>'),
    vrata: SV('<path d="M2 20h3M19 20h3"/><path d="M5 20V6"/><path d="M5 6a14 14 0 0114 14" stroke-dasharray="0"/>'),
    snap: SV('<path d="M6 4v8a6 6 0 0012 0V4"/><path d="M6 4h3v8a3 3 0 006 0V4h3"/><path d="M6 8h3M15 8h3"/>'),
    orto: SV('<path d="M5 4v15h15"/><path d="M5 14h5v5"/>'),
    type: SV('<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10"/>'),
    mjeri: SV('<path d="M3 17l14-14 4 4-14 14z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/>'),
    prov: SV('<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5.5 5.5"/><circle cx="10.5" cy="10.5" r="1.6" fill="currentColor" stroke="none"/>'),
    ostalo: SV('<rect x="3.5" y="3.5" width="7" height="7" stroke-dasharray="2 1.6"/><path d="M3.5 17h7M3.5 15v4M10.5 15v4"/><path d="M17 4v7M13.5 7.5h7"/><rect x="13.5" y="14" width="7" height="6"/>'),
    soba: SV('<rect x="4" y="5" width="16" height="14" stroke-width="2.4"/><path d="M2 3l3 3M22 21l-3-3" stroke-width="1.3"/>'),
    zub: SV('<path d="M3 4v16h18V4"/><path d="M13 4v6h8"/><path d="M15 4l6 6M13 6l4 4" stroke-width="1.3"/>'),
    stube: SV('<path d="M3 20h5v-5h5v-5h5V5h3"/>'),
    foto: SV('<path d="M3 8h4l2-3h6l2 3h4v11H3z"/><circle cx="12" cy="13" r="3.5"/>'),
    od: SV('<path d="M3 12h18 M3 8v8 M21 8v8"/><path d="M7 12l-3 0 M17 12h3"/><circle cx="3" cy="12" r="1.6"/><circle cx="21" cy="12" r="1.6"/>'),
    diag: SV('<rect x="4" y="5" width="16" height="14"/><path d="M4 19L20 5" stroke-dasharray="2.5 2"/>'),
    more: SV('<circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/>')
  };
  /* v2.21: Uređivanje uz Crtanje; v2.07: s lijeva na desno redom rada; Hvatanje i Orto idu dolje desno (zadnja skupina), Zaslon u Više */
  const QB = [['[data-activate-layer="nacrt"]', IC.nacrt, 'Nacrt'], ['[data-activate-layer="kote"]', IC.kote, 'Kote'], ['[data-activate-layer="opisi"]', IC.opisi, 'Opisi'], ['[data-activate-layer="pogled"]', IC.pogled, 'Pogled'], ['[data-activate-layer="biljeske"]', IC.opisi, 'Bilješke'], null,
    ['[data-tool="pen"]', IC.pen, 'Olovka'], ['[data-tool="line"]', IC.line, 'Linija'], ['#terenProstorija', IC.soba, 'Prostorija'], ['#terenZub', IC.zub, 'Zub/niša'], null, /* v2.32: Zub/niša u Crtanje, Gumica u Uređivanje */
    ['[data-tool="select"]', IC.select, 'Odabir'], ['[data-tool="erase"]', IC.erase, 'Gumica'], ['[data-tool="text"]', IC.text, 'Tekst'], null, /* v2.25: Foto je u Više */
    ['#terenProzor', IC.prozor, 'Prozor'], ['#terenVrata', IC.vrata, 'Vrata'], ['#terenOstalo', IC.ostalo, 'Ostalo', () => isOn('#terenOstalo') || isOn('#terenStube')], null, /* v2.25: Stubište je u Ostalo */
    ['#terenMjeri', IC.mjeri, 'Mjeri'], ['#typeBtn', IC.type, 'Tipkaj'], ['#odBtn', IC.od, 'Od–do'], ['#diagBtn', IC.diag, 'Dijagonala'], null, ['#ui2More', IC.more, 'Više', () => !pop('ui2MorePop').hidden || isOn('[data-tool="photo"]')], null,
    ['#snapBtn', IC.snap, 'Hvatanje'], ['#ortoBtn', IC.orto, 'Orto']];
  const qb = document.createElement('div'); qb.className = 'ui2-float'; qb.id = 'ui2Quick'; qb.style.cssText = 'left:50%;top:8px;transform:translateX(-50%);align-items:center;max-width:calc(100% - 16px);width:max-content';
  /* v2.24: ALAT – uvijek samo jedan; ugašen alat → Olovka. Sloj se mijenja sam (Crtanje/Blokovi → Nacrt, Tipkaj/Od–do/Dijagonala → Kote i natrag, Tekst → Opisi). Mjeri (vodič) je način rada i ostaje uključen. */
  const OVER = ['#terenProstorija', '#terenProzor', '#terenVrata', '#terenStube', '#terenZub', '#terenOstalo', '#typeBtn', '#odBtn', '#diagBtn'], BASE = ['[data-tool="pen"]', '[data-tool="line"]', '[data-tool="erase"]', '[data-tool="select"]', '[data-tool="text"]', '[data-tool="photo"]'];
  const KOTE = ['#typeBtn', '#odBtn', '#diagBtn'], NACRT = ['[data-tool="pen"]', '[data-tool="line"]', '[data-tool="erase"]', '#terenProstorija', '#terenProzor', '#terenVrata', '#terenStube', '#terenZub', '#terenOstalo'];
  const isOn = sel => { const o = document.querySelector(sel); return !!o && (o.classList.contains('active') || o.classList.contains('is-active') || o.getAttribute('aria-pressed') === 'true'); };
  const curLayer = () => ($('layer') && $('layer').value) || 'nacrt', setLayer = l => { if (curLayer() === l) return; const o = document.querySelector('[data-activate-layer="' + l + '"]'); if (o) o.click(); };
  let prevLayer = null; const pen = () => { if (!isOn(BASE[0])) { const o = document.querySelector(BASE[0]); if (o) o.click(); } };
  const toolClick = sel => { if (sel === '#terenOstalo' && isOn('#terenStube')) { document.querySelector('#terenStube').click(); pen(); return; } const o = document.querySelector(sel); if (!o) return; const isT = OVER.includes(sel) || BASE.includes(sel); if (!isT) { o.click(); return; }
    const was = isOn(sel), wasK = OVER.filter(x => KOTE.includes(x) && isOn(x)).length > 0;
    if (was && OVER.includes(sel)) { if (KOTE.includes(sel) && prevLayer) { setLayer(prevLayer); prevLayer = null; } if (isOn(sel)) o.click(); pen(); return; }
    if (was) { if (sel !== BASE[0]) pen(); return; }
    for (const x of OVER) if (x !== sel && isOn(x)) document.querySelector(x).click();
    if (wasK && !KOTE.includes(sel) && prevLayer) { setLayer(prevLayer); prevLayer = null; }
    if (KOTE.includes(sel)) { if (!prevLayer) prevLayer = curLayer(); setLayer('kote'); } else if (NACRT.includes(sel)) setLayer('nacrt'); else if (sel === '[data-tool="text"]') setLayer('opisi'); /* sloj prije alata – promjena sloja vraća alat na olovku */
    if (OVER.includes(sel)) pen();
    if (!isOn(sel)) o.click(); };
  /* Olovka ne svijetli dok je uključen drugi alat (Vrata, Od–do…) – ona je samo osnova ispod */
  const penLit = () => !OVER.some(isOn) && isOn(BASE[0]);
  const qbs = [];
  /* skupine gumba s malim naslovom iznad (Slojevi, Pomoć, Uređivanje…) */
  const GRP = ['Slojevi', 'Crtanje', 'Uređivanje', 'Blokovi', 'Mjerenje', '', ''], GCOL = [1, 5, 3, 4, 2, 6, 2]; /* boje skupina (data-g) kao prije */
  let gi = 0, grow = null; const newGrp = () => { const g = document.createElement('div'); g.className = 'ui2-grp'; g.dataset.g = GCOL[gi] != null ? GCOL[gi] : gi; const t = document.createElement('div'); t.className = 'ui2-gt'; t.textContent = GRP[gi] || ''; grow = document.createElement('div'); grow.className = 'ui2-gr'; g.appendChild(t); g.appendChild(grow); qb.appendChild(g); };
  newGrp();
  for (const q of QB) { if (!q) { const sp = document.createElement('span'); sp.style.cssText = 'width:1px;align-self:stretch;background:#b8cde5;margin:0 2px;flex:none'; qb.appendChild(sp); gi++; newGrp(); continue; }
    const b = document.createElement('button'); b.type = 'button'; b.title = q[2]; b.innerHTML = '<span style="display:flex;flex-direction:column;align-items:center;gap:1px;line-height:1">' + q[1] + '<span style="font:600 10px Arial">' + q[2] + '</span></span>'; b.style.cssText = 'min-width:50px;min-height:50px;padding:3px 2px;flex:none';
    const lay = (/data-activate-layer="(\w+)"/.exec(q[0]) || [])[1]; let lpT = null, lpDone = false;
    if (q[0] === '#ui2More') b.id = 'ui2More';
    // dugi pritisak: sloj = prikaži/sakrij; Olovka/Gumica = postavke (Više)
    const tk = (/"(pen|erase|line)"/.exec(q[0]) || [])[1];
    if (lay || tk) { b.addEventListener('pointerdown', () => { lpDone = false; clearTimeout(lpT); lpT = setTimeout(() => { lpDone = true; if (lay) { const cb = $('show-' + lay); if (cb) { cb.checked = !cb.checked; cb.dispatchEvent(new Event('change', { bubbles: true })); cb.dispatchEvent(new Event('input', { bubbles: true })); try { app().redraw(); } catch (e) { } syncQ(); } } else openTool(tk, b); }, 550); });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, () => clearTimeout(lpT))); b.addEventListener('contextmenu', e => e.preventDefault()); }
    b.onclick = e => { if (lpDone) { lpDone = false; e.stopPropagation(); return; } if (q[0] === '#ui2More') { e.stopPropagation(); openMore(b); setTimeout(syncQ, 30); return; } toolClick(q[0]); setTimeout(syncQ, 30); setTimeout(syncQ, 200); }; grow.appendChild(b); qbs.push([b, q[0], q[3], lay]); }
  const syncQ = () => { { /* v2.24: dok je uključen drugi alat, vodič Mjeri se smanji na naslovnu traku; vrati se kad se alat ugasi */ const vp = $('vdPanel'); if (vp) vp.classList.toggle('vd-min', OVER.some(isOn) || BASE.slice(1).some(isOn)); }
    for (const [b, sel, fn, lay] of qbs) { const o = sel === '#ui2More' ? b : document.querySelector(sel); const on = fn ? fn() : sel === '[data-tool="pen"]' ? penLit() : !!o && (o.classList.contains('active') || o.classList.contains('is-active') || o.getAttribute('aria-pressed') === 'true'); b.style.background = on ? '#17457f' : '#fff'; b.style.color = on ? '#fff' : '#17457f'; b.classList.toggle('on', !!on); b.style.display = o ? '' : 'none';
      if (lay) { const cb = $('show-' + lay), hid = cb && !cb.checked; b.style.opacity = hid ? '0.45' : ''; b.title = q2t(b) + (hid ? ' (skriven – drži za prikaz)' : ' (drži za sakrij)'); } }
    const sa = $('selectionActions'); if (sa) { if (sa.parentNode !== selF) selF.appendChild(sa); selF.style.display = sa.hidden ? 'none' : 'flex'; selF.style.top = '58px'; /* v2.25: traka je dolje */ }
    const st = $('status'), tp = $('appTop'); if (st) document.documentElement.style.setProperty('--ui2-st', st.offsetHeight + 'px'); if (tp && tp.offsetHeight) document.documentElement.style.setProperty('--ui2-top', tp.offsetHeight + 'px'); if (qb.offsetHeight) document.documentElement.style.setProperty('--ui2-qb', qb.offsetHeight + 'px'); if (window.__ctxR) window.__ctxR(); };
  const q2t = b => (b.dataset.t || (b.dataset.t = b.title));
  // označeno (Odabir): Kopiraj, Zrcali, Izbriši… plutaju ispod gornje trake
  const selF = document.createElement('div'); selF.className = 'ui2-float'; selF.id = 'ui2Sel'; selF.style.display = 'none'; work.appendChild(selF);
  // ⋯ Više: slojevi, debljina/boja, gumica, Razreži, olovka/prsti
  // ⋯ Više: slojevi, olovka (debljina/boja), gumica, Razreži, olovka/prsti – elementi žive u „utorima”, dugi pritisak ih posudi
  const slot = {}, buildMore = () => { const M = pop('ui2MorePop'); if (M.dataset.ok) return M; M.dataset.ok = '1';
      const sec = t => { const h = document.createElement('div'); h.className = 'ui2-sec'; h.textContent = t; M.appendChild(h); }, mk = (k, el) => { const r = document.createElement('div'); r.className = 'ui2-mrow'; if (el) r.appendChild(el); slot[k] = { r, el }; M.appendChild(r); };
      const lp = document.querySelector('.layer-panel'); if (lp) { sec('Slojevi – dodir: aktivni sloj · oko: prikaži/sakrij'); M.appendChild(lp); }
      const ps = document.querySelector('.pen-settings'); if (ps) { sec('Olovka i linija – debljina, boja'); mk('pen', ps); }
      const es = $('eraserSize'); if (es) { sec('Gumica – veličina'); mk('erase', es.closest('label') || es); }
      sec('Alati i unos'); const r2 = document.createElement('div'); r2.className = 'ui2-mrow'; const sp = $('terenSplit'); if (sp) r2.appendChild(sp); M.appendChild(r2); const pm = $('penMode'); if (pm) { slot.mode = { r: r2, el: pm }; r2.appendChild(pm); }
      const r3 = document.createElement('div'); r3.className = 'ui2-mrow'; ['terenZadatak', 'fullscreen', 'terenSunce', 'terenObris', 'terenIzvoz', 'terenKopija', 'terenSjever', 'terenFsZum'].map($).filter(Boolean).forEach(x => r3.appendChild(x)); if (r3.children.length) { sec('Prikaz i projekt'); M.appendChild(r3); }
      return M; };
  const homeAll = () => { for (const k in slot) if (slot[k].el && slot[k].el.parentNode !== slot[k].r) slot[k].r.appendChild(slot[k].el); };
  const openMore = anchor => { const M = buildMore(); homeAll(); openPop(M, anchor); setTimeout(syncQ, 30); };
  const openTool = (tk, anchor) => { buildMore(); homeAll(); const P = pop('ui2ToolPop'); P.innerHTML = '';
    const sec = t => { const h = document.createElement('div'); h.className = 'ui2-sec'; h.textContent = t; P.appendChild(h); }, put = k => { if (slot[k] && slot[k].el) { const r = document.createElement('div'); r.className = 'ui2-mrow'; r.appendChild(slot[k].el); P.appendChild(r); } };
    if (tk === 'erase') { sec('Gumica – veličina'); put('erase'); }
    else { sec((tk === 'line' ? 'Linija' : 'Olovka') + ' – debljina, boja'); put('pen'); if (tk === 'pen' && slot.mode) { sec('Unos'); put('mode'); } }
    P.hidden = true; openPop(P, anchor); };
  { /* v2.32: Mjeri (način rada) odvojen tankom crtom od alata za kote */ const mb = qbs.find(x => x[1] === '#terenMjeri'); if (mb) { const sp = document.createElement('span'); sp.className = 'ui2-msep'; mb[0].after(sp); } const ms = document.createElement('style'); ms.textContent = '.ui2-msep{width:1px;align-self:stretch;margin:4px 3px;background:#2b4a70;flex:none}'; document.head.appendChild(ms); }
  qb.addEventListener('selectstart', e => e.preventDefault()); qb.addEventListener('contextmenu', e => e.preventDefault());
  work.appendChild(qb); syncQ(); document.addEventListener('click', () => setTimeout(syncQ, 30), true); setInterval(syncQ, 1500);
  { /* v2.07: dolje desno – Hvatanje, Orto | ⤢ ↶ ↷ (iste veličine kao gornji gumbi ili manji) */ un.id = 'ui2Un'; const grps = qb.querySelectorAll('.ui2-grp'), last = grps[grps.length - 1], sn = last ? [...last.querySelectorAll('button')] : [];
    const fit = nv.children[0]; un.insertBefore(fit, un.firstChild); const sp = document.createElement('span'); sp.className = 'ui2-unsep'; un.insertBefore(sp, fit); sn.reverse().forEach(b => { b.classList.add('ui2-unt'); un.insertBefore(b, un.firstChild); }); if (last) { const prev = last.previousElementSibling; last.remove(); if (prev && prev.tagName === 'SPAN') prev.remove(); } nv.style.display = 'none'; }
  { /* gore: ✓ Provjeri (Što nedostaje + Provjera crteža) s brojem, ☀ sunce */ const pv = $('ui2Prov'), ms = $('terenMissing'); if (pv) { if (ms) ms.style.display = 'none'; pv.innerHTML = '✓ Provjeri <span id="ui2ProvN" class="ui2-pvn" hidden></span>';
      pv.onclick = e => { e.stopPropagation(); const P = pop('ui2ProvPop'); const nM = (() => { try { const l = window.IzmjeraTeren.collectMissing(true); return l ? l.length : 0; } catch (er) { return 0; } })(), nP = (() => { try { return window.IzmjeraVodic.pvCount(); } catch (er) { return 0; } })();
        P.innerHTML = '<div class="ui2-sec">Prije odlaska s objekta</div><div class="ui2-mrow"><button type="button" data-p="m">❓ Što nedostaje – mjere (' + nM + ')</button></div><div class="ui2-mrow"><button type="button" data-p="c">🔎 Provjera crteža – rupe, dvostruke crte, kote u zraku (' + nP + ')</button></div>';
        P.querySelector('[data-p="m"]').onclick = () => { P.hidden = true; const b = $('terenMissing'); if (b) b.click(); }; P.querySelector('[data-p="c"]').onclick = () => { P.hidden = true; const b = $('terenProvjera'); if (b) b.click(); setTimeout(() => pv.classList.toggle('on', !!($('terenProvjera') && $('terenProvjera').classList.contains('active'))), 60); }; openPop(P, pv); };
      let lastSig = ''; setInterval(() => { try { const T0 = window.IzmjeraTeren && window.IzmjeraTeren.T; if (!T0 || !T0.m || T0.sig === lastSig || !document.documentElement.classList.contains('ui2-draw')) return; lastSig = T0.sig; const l = window.IzmjeraTeren.collectMissing(true), n = (l ? l.length : 0) + (window.IzmjeraVodic && window.IzmjeraVodic.pvCount ? window.IzmjeraVodic.pvCount() : 0), el = $('ui2ProvN'); if (el) { el.textContent = n; el.hidden = !n; } } catch (er) { } }, 2500);
      const su = document.createElement('button'); su.id = 'ui2Sun'; su.className = 'ui2-btn ui2-top'; su.textContent = '☀'; su.title = 'Jaki kontrast za rad na suncu'; su.onclick = () => { const b = $('terenSunce'); if (b) b.click(); }; pv.before(su); } }
  { /* sloj: oznaka u kutu crteža i obojen rub */ const LC = { nacrt: '#e5e7eb', kote: '#60a5fa', opisi: '#f87171', pogled: '#94a3b8' }, LN = { nacrt: 'NACRT', kote: 'KOTE', opisi: 'OPISI', pogled: 'POGLED' };
    const chip = document.createElement('div'); chip.id = 'ui2LayChip'; work.appendChild(chip); const frm = document.createElement('div'); frm.id = 'ui2LayFrame'; work.appendChild(frm); let lk = '';
    const syncL = () => { const L = $('layer'), v = (L && L.value) || 'nacrt'; if (v === lk) { chip.style.top = (qb.offsetTop + qb.offsetHeight + 10) + 'px'; return; } lk = v; const c = LC[v] || '#e5e7eb'; chip.textContent = '● ' + (LN[v] || v.toUpperCase()); chip.style.borderColor = c; chip.style.color = v === 'nacrt' ? '#e5e7eb' : c; frm.style.boxShadow = 'inset 0 0 0 4px ' + c + (v === 'nacrt' ? ', inset 0 0 0 5px #94a3b8' : ''); chip.style.top = (qb.offsetTop + qb.offsetHeight + 10) + 'px'; };
    syncL(); setInterval(syncL, 400); document.addEventListener('click', () => setTimeout(syncL, 40), true); }
  { /* kratke upute: oblačić uz aktivni gumb umjesto dugog teksta dolje */ const st = $('status'); if (st) { const bub = document.createElement('div'); bub.id = 'ui2Hint'; work.appendChild(bub); let tm = null, last = st.textContent;
      const shortSt = () => { try { const A = window.IzmjeraApp, f = A && A.currentFloor ? A.currentFloor() : null, L = $('layer'), ln = { nacrt: 'Nacrt', kote: 'Kote', opisi: 'Opisi', pogled: 'Pogled' }[(L && L.value) || 'nacrt'] || ''; return (f && f.name ? f.name + ' · ' : '') + 'sloj ' + ln; } catch (e) { return ''; } };
      new MutationObserver(() => { const t = st.textContent.trim(); if (!t || t === last || st.dataset.ui2 === '1') return; last = t; if (t.length < 70 && !/^[^\\w\\s]{1,3}\\s/.test(t) && !/dodirni|povuci|odaberi/i.test(t)) return;
        const on = [...qb.querySelectorAll('button.on')].filter(b => !/Nacrt|Kote|Opisi|Pogled/.test(b.title)).pop(), r = on ? on.getBoundingClientRect() : qb.getBoundingClientRect(); { /* v2.25: kratko (do prve crtice/točke); dodir pokaže cijelu uputu */ const full = t.length > 230 ? t.slice(0, 227) + '…' : t, m = /^(.{12,90}?)(\s[–—-]\s|\.\s|\s\(|;\s)/.exec(t), sh = m ? m[1] + ' …' : full; bub.textContent = sh; bub.dataset.full = full; bub.dataset.sh = sh; }
        /* v2.21: manji, dolje lijevo – ne prekriva gumbe; rub u boji skupine aktivnog gumba */ bub.style.display = 'block'; bub.style.maxWidth = Math.min(340, innerWidth - 24) + 'px'; { const g = on && on.closest('.ui2-grp'); bub.style.setProperty('--hc', g ? getComputedStyle(g).getPropertyValue('--gc') || '#4ade80' : '#4ade80'); }
        st.dataset.ui2 = '1'; st.textContent = shortSt(); last = st.textContent; st.dataset.ui2 = '0'; clearTimeout(tm); tm = setTimeout(() => { bub.style.display = 'none'; }, 5000); }).observe(st, { childList: true, characterData: true, subtree: true }); bub.onclick = () => { if (bub.dataset.full && bub.textContent !== bub.dataset.full) { bub.textContent = bub.dataset.full; clearTimeout(tm); tm = setTimeout(() => { bub.style.display = 'none'; }, 9000); } else bub.style.display = 'none'; }; } }
  { /* v2.22: okvir za upis (Od–do, Tipkaj, Dijagonala) uvijek vidljiv iznad tipkovnice; uputa se makne da se ne preklapa */
    const IDS = ['typedBox', 'diagBox', 'odMenu'], fix = () => { const vh = window.visualViewport ? visualViewport.height : innerHeight, q = $('ui2Quick'), uu = $('ui2Un'), minT = uu ? uu.getBoundingClientRect().bottom + 8 : 60, kb = vh < innerHeight - 80, qTop = q && !kb ? Math.min(q.getBoundingClientRect().top, ($('ui2Ctx') && $('ui2Ctx').offsetHeight) ? $('ui2Ctx').getBoundingClientRect().top : 1e9) : vh;
      for (const id of IDS) { const d = $(id); if (!d) continue; const r = d.getBoundingClientRect(), stH = ($('status') && $('status').offsetHeight) || 0, maxB = Math.min(vh - stH - 8, qTop - 8); if (r.bottom > maxB || r.top < minT - 8) { const top = Math.max(minT, Math.min(r.top, maxB - r.height)); d.style.top = top + 'px'; const un = $('ui2Un'), ur = un && un.getBoundingClientRect(); if (ur && ur.height && top + r.height > ur.top && r.right > ur.left) d.style.left = Math.max(8, ur.left - r.width - 12) + 'px'; } const h = $('ui2Hint'); if (h && id !== 'odMenu') h.style.display = 'none'; } };
    if (window.visualViewport) visualViewport.addEventListener('resize', fix); addEventListener('resize', fix);
    /* v2.22: mala tipkovnica s brojevima ispod okvira (Od–do, Tipkaj, Dijagonala) – Androidova se ne otvara */
    const addPad = box => { const inp = box.querySelector('input'); if (!inp || box.querySelector('.iz-pad')) return; inp.setAttribute('inputmode', 'none'); box.style.width = Math.max(box.offsetWidth, 230) + 'px'; box.style.boxSizing = 'border-box'; box.style.flexWrap = 'wrap';
      const pad = document.createElement('div'); pad.className = 'iz-pad'; pad.style.cssText = 'flex-basis:100%;display:grid;grid-template-columns:repeat(3,64px);gap:5px;justify-content:center;margin-top:4px';
      pad.innerHTML = ['7', '8', '9', '4', '5', '6', '1', '2', '3', ',', '0', '⌫'].map(k => '<button type="button" data-p="' + k + '" style="height:46px;min-width:0;font:700 21px Arial;border:1px solid #cbd5e1;border-radius:10px;background:#f8fafc;color:#0f2a4a;padding:0">' + k + '</button>').join('');
      pad.querySelectorAll('button').forEach(b => { b.addEventListener('pointerdown', e => e.preventDefault()); b.onclick = e => { e.stopPropagation(); const k = b.dataset.p, v = inp.value, s0 = inp.selectionStart != null ? inp.selectionStart : v.length, s1 = inp.selectionEnd != null ? inp.selectionEnd : v.length;
        if (k === '⌫') { if (s1 > s0) { inp.value = v.slice(0, s0) + v.slice(s1); inp.setSelectionRange(s0, s0); } else if (s0 > 0) { inp.value = v.slice(0, s0 - 1) + v.slice(s0); inp.setSelectionRange(s0 - 1, s0 - 1); } }
        else { inp.value = v.slice(0, s0) + k + v.slice(s1); inp.setSelectionRange(s0 + 1, s0 + 1); } inp.dispatchEvent(new Event('input', { bubbles: true })); inp.focus(); }; });
      box.appendChild(pad); };
    new MutationObserver(ms => { const nn = ms.flatMap(m => [...m.addedNodes]).filter(n => IDS.includes(n.id)); if (!nn.length) return; nn.forEach(n => { if (n.id !== 'odMenu') addPad(n); }); [0, 120, 400, 900].forEach(t => setTimeout(fix, t)); }).observe(document.body, { childList: true }); }
  { /* v2.25 novi raspored (N1): alati dolje u sredini, Hvatanje/Orto/Cijeli/Natrag/Napr. gore desno uz naslovnu traku, slojevi lebde lijevo (S3) */
    const lay = document.createElement('div'); lay.id = 'ui2Lay'; const g1 = qb.querySelector('.ui2-grp[data-g="1"]'); if (g1) { const sp = g1.nextElementSibling; lay.appendChild(g1); if (sp && sp.tagName === 'SPAN') sp.remove(); } work.appendChild(lay);
    const DOT = ['#475569', '#2563eb', '#dc2626', '#64748b', '#d97706']; lay.querySelectorAll('button').forEach((b, i) => b.style.setProperty('--dot', DOT[i] || '#475569'));
    const L = { 'Cijeli crtež': ['⤢', 'Cijeli'], 'Poništi': ['↶', 'Natrag'], 'Vrati': ['↷', 'Napr.'] };
    [...un.querySelectorAll('button')].forEach(b => { const l = L[b.title]; if (l) b.innerHTML = '<span><i>' + l[0] + '</i><span>' + l[1] + '</span></span>'; });
    const st2 = document.createElement('style'); st2.textContent = `
body.ui2 #work #ui2Quick{top:auto!important;bottom:0!important;left:50%!important;transform:translateX(-50%)!important;width:max-content!important;max-width:calc(100% - 16px)!important;border-radius:18px 18px 0 0!important;flex-wrap:nowrap!important;padding:5px 8px 6px!important}
body.ui2 #work #ui2Quick::before{display:none!important}
body:not(.sun) #ui2Quick{box-shadow:0 -6px 14px rgba(0,0,0,.14)!important}
body:not(.sun) #appTop{border-bottom:2px solid #4f8fe0!important}body:not(.sun) #status{border-top:2px solid #4f8fe0!important}
#ui2LayChip{display:none!important}
#ui2Lay{position:absolute;left:12px;top:12px;z-index:7}#ui2Lay .ui2-gt{display:none!important}#ui2Lay .ui2-gr{flex-direction:column!important;gap:4px!important}
html body #ui2Lay button{width:auto!important;min-width:96px!important;min-height:32px!important;height:32px;padding:0 10px!important;border-radius:10px!important;border:0!important;background:transparent!important;color:#334155!important;box-shadow:none!important;justify-content:flex-start}
html body #ui2Lay button>span{flex-direction:row!important;gap:8px!important}html body #ui2Lay button svg{display:none}html body #ui2Lay button>span>span{font:700 13px Arial!important}
#ui2Lay button>span::before{content:"";width:9px;height:9px;border-radius:50%;background:var(--dot);flex:none}
html body #ui2Lay button.on{background:#0f2a4a!important;color:#fff!important;box-shadow:0 4px 12px rgba(0,0,0,.22)!important}html body #ui2Lay button.on>span::before{background:var(--gc)}
body.ui2 #work #ui2Un{top:0!important;right:0!important;left:auto!important;bottom:auto!important;border-radius:0 0 0 16px!important;padding:5px 8px 7px!important;gap:5px!important;flex-direction:row!important}
html body #ui2Un>button,html body #ui2Un>button.ui2-unt{width:auto!important;min-width:0!important;height:32px!important;min-height:32px!important;padding:0 10px!important;border-radius:9px!important;font:700 12.5px Arial!important;box-shadow:inset 0 0 0 1px #2b4a70!important;background:rgba(255,255,255,.04)!important;color:#fff!important;border:0!important}
html body #ui2Un>button.ui2-unt.on{box-shadow:inset 0 0 0 2px #2dd4bf!important;background:#17457f!important}
#ui2Un>button>span{display:flex!important;flex-direction:row!important;align-items:center;gap:6px!important}#ui2Un>button svg{width:16px!important;height:16px!important;color:#2dd4bf}#ui2Un>button>span>span{font:700 12.5px Arial!important}#ui2Un>button i{font-style:normal;font-size:15px;color:#cbd5e1}
#ui2Un .ui2-unsep{display:none}
#ui2Hint{left:50%!important;transform:translateX(-50%);top:12px!important;bottom:auto!important;position:absolute!important;cursor:pointer;background:rgba(255,255,255,.92)!important;color:#1e293b!important;font:500 12.5px/1.35 Arial!important;box-shadow:0 2px 10px rgba(15,42,74,.18)!important}
#vdPanel{top:${(46 + 56)}px!important;max-height:calc(100dvh - 102px - var(--ui2-qb,78px) - 12px)!important}#vdPanel .vd-head{gap:5px!important}#vdPanel .vd-head button{min-width:38px!important;min-height:38px!important;padding:0 4px!important}#vdPanel .vd-head b{font-size:15px!important;min-width:0;line-height:1.2;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}#vdPanel .vd-left{white-space:nowrap}#vdPanel>.vd-row:last-child{position:sticky;bottom:-10px;z-index:2;background:#fff;margin-bottom:-10px;padding:6px 0 10px}#vdPanel .vd-pad{gap:4px!important}#vdPanel .vd-pad button{min-height:40px!important;font-size:19px!important;border-radius:10px!important}#vdPanel .vd-val{box-sizing:border-box!important;height:46px!important;min-height:46px!important;line-height:34px!important;padding-top:4px!important;padding-bottom:4px!important;margin:6px 0!important;overflow:hidden}#vdPanel .vd-quick button{min-height:38px!important}#vdPanel .vd-q{margin-top:4px!important}
#ui2Sel{z-index:8}`;
    document.head.appendChild(st2); }
  { /* v2.41: gore desno samo ikone – Hvatanje, Orto | Natrag, Naprijed; gumb Cijeli maknut (zumira se s dva prsta / dvoklik) */
    const SV = { snap: '<path d="M6 4v8a6 6 0 0012 0V4"/><path d="M6 4h3v8a3 3 0 006 0V4h3"/><path d="M6 8h3M15 8h3"/>', orto: '<path d="M5 4v15h15"/><path d="M5 14h5v5"/>',
      undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 010 11H11"/>', redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 000 11H13"/>' };
    const svg = k => '<span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + SV[k] + '</svg></span>';
    const bs = [...un.querySelectorAll(':scope>button')], tg = bs.filter(b => b.classList.contains('ui2-unt'));
    bs.forEach(b => { if (b.title === 'Cijeli crtež') b.style.display = 'none'; else if (b.title === 'Poništi') { b.innerHTML = svg('undo'); b.classList.add('ui2-ico'); } else if (b.title === 'Vrati') { b.innerHTML = svg('redo'); b.classList.add('ui2-ico'); } });
    if (tg[0]) { tg[0].innerHTML = svg('snap'); if (!tg[0].title) tg[0].title = 'Hvatanje'; }
    if (tg[1]) { tg[1].innerHTML = svg('orto'); if (!tg[1].title) tg[1].title = 'Orto'; }
    const sep = un.querySelector('.ui2-unsep'); if (sep) sep.classList.add('ui2-unsep2');
    const st3 = document.createElement('style'); st3.textContent = `
html body #ui2Un>button,html body #ui2Un>button.ui2-unt{width:42px!important;min-width:42px!important;height:38px!important;min-height:38px!important;padding:0!important;justify-content:center}
#ui2Un>button>span{justify-content:center}html body #ui2Un>button svg{width:22px!important;height:22px!important;color:#2dd4bf}html body #ui2Un>button.ui2-ico svg{color:#cbd5e1}
#ui2Un .ui2-unsep.ui2-unsep2{display:block!important;width:1px;align-self:stretch;background:#2b4a70;margin:3px 4px}`;
    document.head.appendChild(st3); }
  { /* v2.25: gornja traka mirnija – Podaci, kalendar, Kote, Veze i ☀ prelaze u ⋯; ispod naslova vrsta i broj projekta */
    const mv = ['projInfo', 'tjTopBtn', 'terenKote', 'terenVeze', 'ui2Sun'], LB = { projInfo: '📝 Podaci', tjTopBtn: '📅 Sastanak i ponuda', terenKote: '🔢 Kote', terenVeze: '🔗 Veze', ui2Sun: '☀ Jaki kontrast' };
    const hdr = () => { const M = pop('ui2Menu'); let r = $('ui2HdrRow'); if (!r) { r = document.createElement('div'); r.id = 'ui2HdrRow'; r.className = 'ui2-row'; r.style.cssText = 'margin:0 0 8px;padding:0 0 8px;border-top:0;border-bottom:1px solid #e5edf6'; }
      if (r.parentNode !== M) M.insertBefore(r, M.firstChild); for (const id of mv) { const b = $(id); if (!b) continue; if (b.parentNode !== r) r.appendChild(b); if (LB[id] && b.textContent !== LB[id]) b.textContent = LB[id]; } };
    const mnb = $('ui2MenuBtn'); if (mnb) mnb.onclick = e => { e.stopPropagation(); place(); hdr(); openPop(pop('ui2Menu'), mnb); };
    const hs = document.createElement('style'); hs.textContent = '#ui2HdrRow button{height:46px;max-height:46px;overflow:hidden;min-height:44px;padding:6px 12px;border-radius:10px;border:1px solid #b8cde5;background:#fff;color:#17457f;font:700 14px Arial;flex:1 1 40%}#ui2HdrRow button.active{background:#dbeafe;border-color:#2563eb}html body #ui2HdrRow button{font-size:14px!important;color:#17457f!important;background:#fff!important;width:auto!important}html body #ui2HdrRow button.active{background:#dbeafe!important}#ui2HdrRow button::before,#ui2HdrRow button::after{display:none!important}#activeProjectName small{display:block;font:500 11px Arial;opacity:.7;margin-top:1px;white-space:nowrap}#activeProjectName{line-height:1.15;text-align:center}'; document.head.appendChild(hs);
    setTimeout(() => { place(); hdr(); }, 300);
    const sub = () => { const n = $('activeProjectName'); if (!n) return; const I = window.projectInfo || {}, T = (window.IzmjeraPodaci && IzmjeraPodaci.TYPES) || [], v = (I.vrsta || []).map(k => (T.find(t => t[0] === k) || [, k])[1]).join(', '), t = [v, I.broj].filter(Boolean).join(' · ');
      let sm = n.querySelector('small'); if (!t) { if (sm) sm.remove(); return; } if (!sm) { sm = document.createElement('small'); n.appendChild(sm); } if (sm.textContent !== t) sm.textContent = t; };
    setInterval(sub, 1500); }
  { /* v2.26 brzi izbor: red iznad donje trake za uključeni alat (Vrata, Prozor, Od–do, Ostalo) */
    const cx = document.createElement('div'); cx.id = 'ui2Ctx'; work.appendChild(cx); let sig = '';
    (window.__ctxP = window.__ctxP || []).push(() => { if (!isOn('#odBtn')) return null; const d = window.__odDef || '';
      return { t: '↔ Od–do:', items: [['Automatski', ''], ['Unutarnji rub', 'near'], ['Vanjski rub', 'far']].map(([l, k]) => ({ l, on: d === k, fn: () => { window.__odDef = k || null; } })) }; });
    const render = () => { let R = null; for (const f of window.__ctxP) { try { R = f(); } catch (e) { R = null; } if (R) break; }
      const sg = R ? JSON.stringify([R.t, R.items.map(i => [i.l, !!i.on, !!i.dis, !!i.sep])]) : ''; if (sg === sig) return; sig = sg; cx.innerHTML = ''; if (R && !R.items.length) R = null; cx.style.display = R ? 'flex' : 'none'; if (!R) return;
      const h = document.createElement('span'); h.className = 'cx-t'; h.textContent = R.t; cx.appendChild(h);
      for (const it of R.items) { if (it.sep) { const sp = document.createElement('span'); sp.className = 'cx-sep'; cx.appendChild(sp); continue; } const b = document.createElement('button'); b.type = 'button'; b.textContent = it.l; if (it.on) b.classList.add('on'); if (it.dis) { b.disabled = true; b.title = 'Najprije postavi ' + (it.tip || ''); } else if (it.tip) b.title = it.tip;
        b.onclick = e => { e.stopPropagation(); try { it.fn(); } catch (er) { } sig = ''; render(); setTimeout(() => { sig = ''; render(); }, 120); }; cx.appendChild(b); } };
    window.__ctxR = render;
    const cs = document.createElement('style'); cs.textContent = `#ui2Ctx{position:absolute;left:50%;transform:translateX(-50%);bottom:var(--ui2-qb,78px);z-index:7;display:none;align-items:center;gap:6px;background:#0f2a4a;border-radius:14px 14px 0 0;padding:6px 10px;box-shadow:0 -4px 12px rgba(0,0,0,.12);max-width:calc(100% - 16px);overflow-x:auto;white-space:nowrap}
#ui2Ctx .cx-t{font:600 12.5px Arial;color:#9fb6d3;margin-right:2px}#ui2Ctx .cx-sep{width:1px;height:22px;background:#2b4a70;margin:0 2px;flex:none}
#ui2Ctx button{height:32px;padding:0 12px;border-radius:9px;border:0;background:rgba(255,255,255,.04);color:#fff;font:700 13px Arial;box-shadow:inset 0 0 0 1px #2b4a70;flex:none}
#ui2Ctx button.on{box-shadow:inset 0 0 0 2px #4ade80;background:#17457f}#ui2Ctx button:disabled{opacity:.4}body.sun #ui2Ctx{background:#fff;border:1px solid #b8cde5}body.sun #ui2Ctx button{color:#17457f}`; document.head.appendChild(cs); }
  { /* v2.26 gornja traka: etaže kao kartice (▾ za uređivanje), spremljeno = točka, „📏 još N” do mjerenja */
    const fl = $('ui2Floor'), sel = $('floor'), tabs = document.createElement('div'); tabs.id = 'ui2Tabs'; if (fl) { fl.before(tabs); fl.textContent = '▾'; fl.title = 'Etaže: dodaj, preimenuj, kopiraj'; fl.classList.add('ui2-flm'); }
    const pick = i => { const r = document.querySelectorAll('#floorManager .floor-pick')[i]; if (r) r.click(); else if (sel) { sel.value = String(i); sel.dispatchEvent(new Event('change', { bubbles: true })); } setTimeout(syncT, 60); };
    let tsig = ''; const syncT = () => { if (!sel) return; const o = [...sel.options], sg = o.map(x => x.textContent).join('|') + '#' + sel.value; if (sg === tsig) return; tsig = sg; tabs.innerHTML = '';
      o.forEach((x, i) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = x.textContent; if (x.value === sel.value) b.className = 'on'; b.onclick = e => { e.stopPropagation(); if (x.value !== sel.value) pick(i); }; tabs.appendChild(b); });
      const ad = document.createElement('button'); ad.type = 'button'; ad.textContent = '＋'; ad.title = 'Nova etaža'; ad.onclick = e => { e.stopPropagation(); const b = $('addfloor'); if (b) b.click(); setTimeout(syncT, 200); }; tabs.appendChild(ad); };
    setInterval(syncT, 700); syncT();
    const lf = document.createElement('button'); lf.id = 'ui2Left'; lf.className = 'ui2-btn ui2-top'; lf.title = 'Koliko je još za izmjeriti – dodir otvara Mjeri'; lf.onclick = e => { e.stopPropagation(); const b = $('terenMjeri'); if (b && !b.classList.contains('active')) b.click(); setTimeout(syncQ, 50); };
    const pv = $('ui2Prov'); if (pv) pv.before(lf);
    setInterval(() => { try { const n = window.IzmjeraVodic && IzmjeraVodic.left ? IzmjeraVodic.left() : -1; lf.style.display = n < 0 ? 'none' : ''; const t = n === 0 ? '📏 ✓ sve' : '📏 još ' + n; if (lf.textContent !== t) lf.textContent = t; lf.classList.toggle('ok', n === 0); } catch (e) { } }, 1200);
    const ts = document.createElement('style'); ts.textContent = `#ui2Tabs{display:inline-flex;align-items:center;gap:2px;padding:3px;border-radius:10px;margin-left:8px;max-width:340px;overflow-x:auto;white-space:nowrap}
body:not(.sun) #ui2Tabs{background:rgba(255,255,255,.06);box-shadow:inset 0 0 0 1px #24446b}body.sun #ui2Tabs{background:#eef4fb;box-shadow:inset 0 0 0 1px #b8cde5}
html body #ui2Tabs button{min-height:30px!important;height:30px;padding:0 10px!important;border-radius:8px!important;border:0!important;background:transparent!important;font:600 13px Arial!important;opacity:.75;flex:none;box-shadow:none!important}
body:not(.sun) #ui2Tabs button{color:#dbe7f5!important}body.sun #ui2Tabs button{color:#17457f!important}
html body #ui2Tabs button.on{opacity:1;font-weight:800!important;background:#17457f!important;color:#fff!important;box-shadow:inset 0 0 0 2px #60a5fa!important}
html body #ui2Floor.ui2-flm{margin-left:2px!important;min-width:30px;padding:6px 8px!important}
#ui2Save{font-size:0!important;margin-left:8px!important}#ui2Save::before{content:"●";font-size:16px;color:#4ade80}#ui2Save.dirty::before{color:#fb923c}
#ui2Left.ok{color:#4ade80!important}`; document.head.appendChild(ts); }
  setTimeout(() => { /* v2.29: Više i ⋯ – tamne pločice (manji prozori) */
    const M = buildMore(), grid = document.createElement('div'); grid.className = 'ui2-tiles'; const hd = document.createElement('div'); hd.className = 'ui2-sec'; hd.textContent = 'Brzo';
    M.insertBefore(grid, M.firstChild); M.insertBefore(hd, grid);
    for (const id of ['ui2Foto', 'terenZadatak', 'terenSplit', 'penMode', 'terenSunce', 'terenObris', 'terenSjever', 'terenFsZum', 'terenIzvoz', 'terenKopija']) { const b = $(id); if (b) grid.appendChild(b); }
    if (slot.mode) slot.mode.r = grid;
    [...M.querySelectorAll('.ui2-sec')].forEach(h => { const n = h.nextElementSibling; if (/^(Foto|Alati i unos|Prikaz i projekt)$/.test(h.textContent) && (!n || !n.children.length || n.classList.contains('ui2-mrow') && !n.querySelector('button,select,input,label'))) { if (n && n.classList.contains('ui2-mrow')) n.remove(); h.remove(); } });
    [...M.querySelectorAll('.ui2-mrow')].forEach(r => { if (!r.children.length && !Object.values(slot).some(x => x.r === r)) r.remove(); });
    /* v2.31: slojevi su lijevo, olovka/gumica na dugi pritisak – u Više samo pločice */ [...M.querySelectorAll('.ui2-sec')].forEach(h => { if (/^(Slojevi|Olovka|Gumica)/.test(h.textContent)) { h.classList.add('ui2-hid'); const n = h.nextElementSibling; if (n && n.classList.contains('ui2-mrow')) n.classList.add('ui2-hid'); } }); [...M.querySelectorAll('.ui2-sec')].forEach(h => { if (/^Slojevi/.test(h.textContent)) h.textContent = 'Slojevi · oko = prikaži/sakrij'; if (/^Olovka/.test(h.textContent)) h.textContent = 'Olovka · gumica'; if (/^Gumica/.test(h.textContent)) { const r = h.nextElementSibling, pr = M.querySelector('.ui2-sec + .ui2-mrow .pen-settings'); h.remove(); if (r && pr) { const row = pr.closest('.ui2-mrow'); row.appendChild(r.firstElementChild || r); if (slot.erase) slot.erase.r = row; r.remove && r.parentNode && !r.children.length && r.remove(); } } });
    const ds = document.createElement('style'); ds.textContent = `
#ui2MorePop,#ui2Menu{background:#0f2a4a!important;border:0!important;color:#fff;padding:10px!important;min-width:0!important;width:max-content;max-width:min(440px,calc(100vw - 12px))!important;box-shadow:0 10px 28px rgba(0,0,0,.35)!important;border-radius:16px!important}
#ui2MorePop .ui2-sec,#ui2Menu .ui2-sec,#ui2Menu .group-title{font:800 9.5px Arial!important;letter-spacing:.9px;color:#9fb6d3!important;text-transform:uppercase;margin:9px 2px 5px!important;display:block}
#ui2MorePop .ui2-sec:first-child{margin-top:0!important}#ui2MorePop .layer-panel,#ui2MorePop .ui2-sec.ui2-hid,#ui2MorePop .ui2-mrow.ui2-hid{display:none!important}
.ui2-tiles{display:grid!important;grid-template-columns:repeat(4,100px);gap:5px!important;border:0!important;padding:0!important;margin:0!important}#ui2HdrRow,#ui2Menu .ui2-row{display:flex!important;flex-wrap:wrap;gap:5px!important;border:0!important;padding:0!important;margin:0!important}
html body #ui2HdrRow button,html body #ui2Menu .ui2-row button{height:34px!important;min-height:0!important;max-height:34px;width:auto!important;margin:0!important;padding:0 11px!important;border-radius:9px!important;border:0!important;background:rgba(255,255,255,.05)!important;box-shadow:inset 0 0 0 1px #2b4a70!important;color:#fff!important;font:700 12px Arial!important;white-space:nowrap!important;flex:none!important;display:inline-flex!important;align-items:center;justify-content:center;line-height:1!important}
html body .ui2-tiles button{height:58px!important;min-height:0!important;max-height:58px;width:100px!important;margin:0!important;padding:3px 5px!important;border-radius:11px!important;border:0!important;background:rgba(255,255,255,.05)!important;box-shadow:inset 0 0 0 1px #2b4a70!important;color:#fff!important;font:700 11px/1.2 Arial!important;white-space:normal!important;overflow:hidden;text-align:center;display:flex;align-items:center;justify-content:center;flex:none!important}
html body .ui2-tiles button.active,html body .ui2-tiles button.on,html body #ui2HdrRow button.active,html body #ui2Menu .ui2-row button.active,html body .ui2-tiles button[aria-pressed="true"]{box-shadow:inset 0 0 0 2px #fde047!important;background:#17457f!important}
#ui2MorePop .layer-list{grid-template-columns:repeat(5,auto)!important;gap:4px!important}
#ui2MorePop .layer-line{display:flex;align-items:center;gap:2px;background:rgba(255,255,255,.05);border-radius:9px;box-shadow:inset 0 0 0 1px #2b4a70;padding:0 2px 0 0}
html body #ui2MorePop .layer-activate{background:transparent!important;color:#fff!important;border:0!important;min-height:32px!important;padding:0 6px!important;font:700 12px Arial!important}html body #ui2MorePop .layer-activate.is-active{color:#fde047!important}
#ui2MorePop .layer-swatch{width:8px!important;height:8px!important;border-radius:50%!important}
html body #ui2MorePop .layer-eye{min-width:26px!important;min-height:26px!important;border:0!important;background:transparent!important;filter:invert(1) brightness(1.4);transform:scale(.8)}
#ui2MorePop .ui2-mrow{gap:6px!important}#ui2MorePop .pen-settings{background:none!important;border:0!important;padding:0!important;color:#dbe7f5;gap:8px!important;font:700 12px Arial}
#ui2MorePop select{min-height:32px!important;font:700 13px Arial!important;background:#17457f;color:#fff;border:1px solid #2b4a70;border-radius:8px;min-width:0!important;padding:0 6px}
#ui2MorePop input[type=color]{width:34px;height:30px;border:0;background:none}
#ui2Menu .files-group{background:none!important;border:0!important;padding:0!important;margin:0!important;box-shadow:none!important}
#ui2Menu .files-group .controls{display:flex!important;flex-wrap:wrap;gap:5px!important}
html body #ui2Menu .files-group .controls>button{flex:none!important;width:auto!important;min-height:34px!important;height:34px;padding:0 11px!important;border-radius:9px!important;border:0!important;background:rgba(255,255,255,.05)!important;box-shadow:inset 0 0 0 1px #2b4a70!important;color:#fff!important;font:700 12px Arial!important}
html body #ui2Menu .files-group .controls>.dxf-btn{background:#60a5fa!important;color:#0f2a4a!important;box-shadow:none!important;flex:none!important}
#ui2Menu #ui2HdrRow{margin-bottom:2px!important}`; document.head.appendChild(ds);
    const hdrSec = () => { const R = $('ui2HdrRow'); if (R && !(R.previousElementSibling && R.previousElementSibling.classList.contains('ui2-sec'))) { const h = document.createElement('div'); h.className = 'ui2-sec'; h.textContent = 'Projekt'; R.before(h); } const ex = document.querySelector('#ui2Menu .ui2-row:not(#ui2HdrRow)'); if (ex && !(ex.previousElementSibling && ex.previousElementSibling.classList.contains('ui2-sec'))) { const h = document.createElement('div'); h.className = 'ui2-sec'; h.textContent = 'Zaslon'; ex.before(h); } };
    setInterval(hdrSec, 1000); setTimeout(hdrSec, 400); }, 0);
  { /* v2.26 dugi pritisak na alat = kratko objašnjenje (Olovka/Linija/Gumica i slojevi zadržavaju svoje: postavke / prikaži-sakrij) */
    const TIP = { 'Prostorija': 'Povuci pravokutnik od kuta do kuta – nacrta 4 ravna zida.', 'Odabir': 'Označi crte ili tekst pa ih pomakni, kopiraj, zrcali ili izbriši.', 'Tekst': 'Dodirni gdje ide tekst (sloj Opisi).', 'Prozor': 'Dodirni zid gdje je prozor. Gore iznad trake biraš vrstu: prozor, fiksno ostakljenje, staklena opeka.', 'Vrata': 'Dodirni zid gdje su vrata ili povuci luk od šarki. Gore biraš jednokrilna, dvokrilna, klizna ili otvor.', 'Zub/niša': 'Dodirni izbočenje ili nišu u zidu.', 'Ostalo': 'Stubište, krovni prozor, otvor u ploči, terasa, greda, prag.', 'Mjeri': 'Vodič redom pita sve mjere prostorije po prostoriju.', 'Tipkaj': 'Dodirni zid pa upiši mjeru.', 'Od–do': 'Dodirni dvije točke i upiši razmak. Dodir na kotu mijenja stranu zida.', 'Dijagonala': 'Nacrtaj dijagonalu prostorije i upiši duljinu.', 'Više': 'Foto, olovka i gumica, prikaz i ostalo.' };
    for (const [b, sel] of qbs) { const k = b.title.split(' (')[0]; if (!TIP[k]) continue; let t0 = null, done = false;
      b.addEventListener('pointerdown', () => { done = false; clearTimeout(t0); t0 = setTimeout(() => { done = true; const h = $('ui2Hint'); if (h) { h.textContent = '💡 ' + k + ': ' + TIP[k]; h.dataset.full = ''; h.style.display = 'block'; clearTimeout(h._t); h._t = setTimeout(() => { h.style.display = 'none'; }, 5000); } }, 600); });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, () => clearTimeout(t0)));
      b.addEventListener('click', e => { if (done) { done = false; e.stopImmediatePropagation(); e.preventDefault(); } }, true); b.addEventListener('contextmenu', e => e.preventDefault()); } }
  { /* v2.31: baterija olovke u gornjoj traci (ako je tablet javlja); ispod 20 % narančasto + jednom upozorenje */
    const pb = document.createElement('span'); pb.id = 'ui2Pen'; pb.className = 'ui2-top'; pb.style.display = 'none'; pb.title = 'Baterija olovke'; const lf = $('ui2Left'); if (lf) lf.before(pb);
    let warned = false; const upd = () => { if (window.AndroidApp && AndroidApp.penBatteryAsync) { try { AndroidApp.penBatteryAsync(); } catch (e) { } } }; window.__penBat = r => { try { const [src, v, nm, ch] = String(r).split('|'), n = parseInt(v, 10); if (!(n >= 0)) { pb.style.display = 'none'; return; }
        pb.style.display = ''; pb.textContent = '✒ ' + n + '%' + (ch === 'c' ? ' ⚡' : ''); pb.title = 'Baterija olovke' + (nm ? ' (' + nm + ')' : ''); pb.classList.toggle('low', n <= 20 && ch !== 'c');
        if (n <= 15 && ch !== 'c' && !warned) { warned = true; const t = window.IzmjeraTeren && IzmjeraTeren.toast; if (t) t('✒ Olovka ima još ' + n + ' % baterije – stavi je puniti.'); } if (n > 25) warned = false; } catch (e) { } };
    setTimeout(upd, 3000); setInterval(upd, 120000);
    const ps = document.createElement('style'); ps.textContent = '#ui2Pen{display:inline-flex;align-items:center;height:34px;padding:0 10px;border-radius:9px;font:700 13px Arial;color:#dbe7f5;box-shadow:inset 0 0 0 1px #24446b;background:rgba(255,255,255,.06);white-space:nowrap}#ui2Pen.low{color:#0f2a4a;background:#fb923c;box-shadow:none}body.sun #ui2Pen{color:#17457f;background:#fff;box-shadow:inset 0 0 0 1px #b8cde5}'; document.head.appendChild(ps); }
  { /* v2.25: Foto u izborniku Više */ const M = buildMore(); const ph = document.createElement('button'); ph.type = 'button'; ph.id = 'ui2Foto'; ph.textContent = '📷 Foto'; ph.onclick = e => { e.stopPropagation(); closePops(); toolClick('[data-tool="photo"]'); setTimeout(syncQ, 50); };
    const nz = document.createElement('button'); nz.type = 'button'; const nzT = () => { const on = window.IzmjeraVodic && IzmjeraVodic.nzOn ? IzmjeraVodic.nzOn() : true; nz.textContent = (on ? '☑' : '☐') + ' Neizmjereno na crtežu (narančasto)'; }; nzT(); nz.onclick = e => { e.stopPropagation(); if (window.IzmjeraVodic && IzmjeraVodic.nzOn) IzmjeraVodic.nzOn(!IzmjeraVodic.nzOn()); nzT(); };
    const r = document.createElement('div'); r.className = 'ui2-mrow'; r.appendChild(ph); const h = document.createElement('div'); h.className = 'ui2-sec'; h.textContent = 'Foto'; M.insertBefore(r, M.firstChild); M.insertBefore(h, r); }
  { /* v2.25 zaštita od dlana: dok je olovka na ekranu (i 0,6 s poslije) dodir prstom/dlanom na gumbe ne radi; velik dodir (dlan) nikad ne pritisne gumb. Olovka radi normalno. */
    let penUntil = 0, penDown = false, blockUntil = 0; const ZONE = '#ui2Quick, #ui2Un, #ui2Lay, #appTop, #ui2Sel, #ui2Ctx, .ui2-pop';
    const isPalm = e => e.pointerType === 'touch' && (penDown || Date.now() < penUntil || Math.max(e.width || 0, e.height || 0) > 46);
    document.addEventListener('pointerdown', e => { if (e.pointerType === 'pen') { penDown = true; penUntil = Infinity; return; } if (e.target.closest && e.target.closest(ZONE) && isPalm(e)) { blockUntil = Date.now() + 700; e.preventDefault(); e.stopPropagation(); } }, true);
    const up = e => { if (e.pointerType === 'pen') { penDown = false; penUntil = Date.now() + 600; } }; document.addEventListener('pointerup', up, true); document.addEventListener('pointercancel', up, true);
    document.addEventListener('pointermove', e => { if (e.pointerType === 'pen' && !penDown) penUntil = Math.max(penUntil === Infinity ? 0 : penUntil, Date.now() + 400); }, true); /* olovka lebdi iznad ekrana */
    document.addEventListener('click', e => { if (Date.now() < blockUntil && e.pointerType !== 'pen' && e.pointerType !== 'mouse' && e.target.closest && e.target.closest(ZONE)) { e.preventDefault(); e.stopPropagation(); } }, true); }
  { /* v2.33: vlastita tipkovnica s brojevima i u svim ostalim prozorima (terasa, stubište, otvori…) – Androidova se ne otvara za brojeve */
    const SKIP = '#vdPanel, #typedBox, #diagBox, #odMenu, .iz-pad, .tb-pad', isNum = el => el && el.tagName === 'INPUT' && !el.closest(SKIP) && (/^(decimal|numeric)$/.test(el.getAttribute('inputmode') || '') || el.type === 'number' || el.dataset.izNum === '1') && !(el.closest('div') && el.closest('div').querySelector('.tb-pad'));
    const conv = root => { (root.querySelectorAll ? root.querySelectorAll('input') : []).forEach(el => { if (el.dataset.izNum || !isNum(el)) return; el.dataset.izNum = '1'; if (el.type === 'number') { el.type = 'text'; } el.setAttribute('inputmode', 'none'); }); };
    new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1) conv(n.tagName === 'INPUT' ? n.parentNode || n : n); }).observe(document.body, { childList: true, subtree: true });
    const pad = document.createElement('div'); pad.id = 'izNumPad'; pad.innerHTML = ['7', '8', '9', '4', '5', '6', '1', '2', '3', ',', '0', '⌫', '−', '→', '✓'].map(k => '<button type="button" data-k="' + k + '"' + (k === '✓' ? ' class="ok"' : '') + '>' + k + '</button>').join(''); document.body.appendChild(pad);
    const ps = document.createElement('style'); ps.textContent = '#izNumPad{position:fixed;z-index:100000;display:none;grid-template-columns:repeat(3,62px);gap:5px;background:#0f2a4a;border-radius:14px;padding:8px;box-shadow:0 10px 28px rgba(0,0,0,.35)}#izNumPad.on{display:grid}#izNumPad button{height:46px;border:0;border-radius:10px;background:rgba(255,255,255,.07);box-shadow:inset 0 0 0 1px #2b4a70;color:#fff;font:700 20px Arial;padding:0}#izNumPad button.ok{background:#4ade80;color:#0f2a4a;box-shadow:none}'; document.head.appendChild(ps);
    let cur = null; const place = el => { const r = el.getBoundingClientRect(), w = pad.offsetWidth || 210, h = pad.offsetHeight || 290, dlg = el.closest('.tp-card,.tp-sheet>div,.ui2-pop') || el, dr = dlg.getBoundingClientRect();
      let x = dr.right + 10, y = Math.max(8, Math.min(innerHeight - h - 8, r.top - 40)); if (x + w > innerWidth - 8) { x = dr.left - w - 10; } if (x < 8) { x = Math.max(8, Math.min(innerWidth - w - 8, r.left)); y = r.bottom + 8 + h > innerHeight - 8 ? Math.max(8, r.top - h - 8) : r.bottom + 8; } pad.style.left = x + 'px'; pad.style.top = y + 'px'; };
    document.addEventListener('focusin', e => { const el = e.target; if (!(el && el.dataset && el.dataset.izNum === '1')) return; cur = el; pad.classList.add('on'); place(el); });
    document.addEventListener('focusout', e => { if (e.target === cur) setTimeout(() => { const a = document.activeElement; if (a && a.dataset && a.dataset.izNum === '1') return; if (!cur || a !== cur || !cur.isConnected) { pad.classList.remove('on'); cur = null; } }, 120); });
    pad.addEventListener('pointerdown', e => e.preventDefault());
    pad.addEventListener('click', e => { const b = e.target.closest('button'); if (!b || !cur) return; e.stopPropagation(); const k = b.dataset.k, el = cur, v = el.value, s0 = el.selectionStart != null ? el.selectionStart : v.length, s1 = el.selectionEnd != null ? el.selectionEnd : v.length;
      if (k === '✓') { el.dispatchEvent(new Event('change', { bubbles: true })); el.blur(); pad.classList.remove('on'); cur = null; return; }
      if (k === '→') { const vis = () => [...document.querySelectorAll('input[data-iz-num="1"]')].filter(x => x.offsetParent), i = vis().indexOf(el); el.dispatchEvent(new Event('change', { bubbles: true })); setTimeout(() => { const nx = vis()[i + 1]; if (nx) { nx.focus(); cur = nx; pad.classList.add('on'); place(nx); } else { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); pad.classList.remove('on'); cur = null; } }, 30); return; }
      let nv = v, cp = s0; if (k === '⌫') { if (s1 > s0) { nv = v.slice(0, s0) + v.slice(s1); } else if (s0 > 0) { nv = v.slice(0, s0 - 1) + v.slice(s0); cp = s0 - 1; } } else { const ch = k === '−' ? '-' : k; nv = v.slice(0, s0) + ch + v.slice(s1); cp = s0 + 1; }
      el.value = nv; try { el.setSelectionRange(cp, cp); } catch (er) { } el.dispatchEvent(new Event('input', { bubbles: true })); el.focus(); });
    addEventListener('resize', () => { if (cur) place(cur); }); }
  // prekidači 2×2
  const tg = document.createElement('div'); tg.id = 'ui2Toggles'; homes.toggles = [];
  for (const id of ['penMode', 'snapBtn', 'ortoBtn', 'typeBtn']) { const b = $(id); if (!b) continue; homes.toggles.push({ b, parent: b.parentNode, next: b.nextSibling }); }
  homes.tg = tg; const ur = $('undo') && $('undo').parentNode; if (ur && ur.classList.contains('drawing-row')) ur.classList.add('ui2-undorow');
  setInterval(tick, 800); window.addEventListener('resize', () => { compactTick(); drawTick(); }); window.addEventListener('scroll', () => { if (document.documentElement.classList.contains('ui2-draw') && window.scrollY) window.scrollTo(0, 0); }, { passive: true }); compactTick();
}
function place() { // premjesti etaže/datoteke u skočne izbornike (ili natrag)
  const ui2 = document.body.classList.contains('ui2'), fp = document.querySelector('.floor-panel'), fg = document.querySelector('.files-group');
  if (!homes.fp && fp) homes.fp = { parent: fp.parentNode, next: fp.nextSibling }; if (!homes.fg && fg) homes.fg = { parent: fg.parentNode, next: fg.nextSibling };
  const extra = ['fullscreen', 'orientationToggle', 'lockDrawing'].map($).filter(Boolean); if (!homes.ex) homes.ex = extra.map(b => ({ b, parent: b.parentNode, next: b.nextSibling }));
  if (ui2) {
    const P = pop('ui2FloorPop'); if (fp && fp.parentNode !== P) P.appendChild(fp);
    const M = pop('ui2Menu'); if (fg && fg.parentNode !== M) { M.innerHTML = ''; M.appendChild(fg); const row = document.createElement('div'); row.className = 'ui2-row'; extra.forEach(b => row.appendChild(b)); M.appendChild(row); }
    const dg = document.querySelector('.drawing-group .drawing-controls'); if (dg && homes.tg && !homes.tg.isConnected) { dg.appendChild(homes.tg); homes.toggles.forEach(t => homes.tg.appendChild(t.b)); }
  } else {
    if (fp && homes.fp && fp.parentNode !== homes.fp.parent) homes.fp.parent.insertBefore(fp, homes.fp.next && homes.fp.next.parentNode === homes.fp.parent ? homes.fp.next : null);
    if (fg && homes.fg && fg.parentNode !== homes.fg.parent) homes.fg.parent.insertBefore(fg, homes.fg.next && homes.fg.next.parentNode === homes.fg.parent ? homes.fg.next : null);
    (homes.ex || []).forEach(h => h.parent.appendChild(h.b));
    (homes.toggles || []).slice().reverse().forEach(h => { if (h.b.parentNode !== h.parent) h.parent.insertBefore(h.b, h.next && h.next.parentNode === h.parent ? h.next : null); }); if (homes.tg) homes.tg.remove();
    addClassicBtn();
  }
}
function addClassicBtn() { return; const fg = document.querySelector('.files-group .controls'); if (!fg || $('ui2Back')) return; const b = document.createElement('button'); b.id = 'ui2Back'; b.textContent = '✨ Novi izgled'; b.onclick = () => setMode('2'); fg.appendChild(b); }
const ICONS = { backhome: '◀', projInfo: '📝', terenKote: '🔢', terenVeze: '🔗', terenMissing: '❓', ui2Dxf: '📐', ui2Save: '✓' };
function compactTick() {
  const on = innerHeight > innerWidth && innerWidth < 1000; document.body.classList.toggle('ui2-compact', on);
  for (const id of Object.keys(ICONS).concat(['enOpen'])) { const b = $(id); if (!b) continue; b.classList.add('ui2-ic');
    let ic = ICONS[id]; if (id === 'enOpen') ic = (b.textContent.trim().split(/\s+/)[0] || '⚡'); if (id === 'ui2Save') ic = b.classList.contains('dirty') ? '●' : '✓'; if (b.dataset.ic !== ic) b.dataset.ic = ic; if (!b.title) b.title = b.textContent.trim(); }
}
function drawTick() { const w = $('work'), on = !!(w && !w.classList.contains('hidden') && w.offsetParent !== null); document.documentElement.classList.toggle('ui2-draw', on); if (on && (window.scrollY || document.documentElement.scrollTop)) window.scrollTo(0, 0); }
function tick() { compactTick(); drawTick();
  const a = app(); if (!a) return; const fl = $('ui2Floor'); try { const f = a.currentFloor(); if (fl && f && !fl.classList.contains('ui2-flm')) fl.textContent = '▤ ' + (f.name || 'Etaža') + ' ▾'; } catch (e) { }
  const sv = $('ui2Save'); if (sv) { const st = a.saveState ? a.saveState() : 'ok'; sv.textContent = st === 'dirty' ? '● sprema se…' : '✓ spremljeno'; sv.classList.toggle('dirty', st === 'dirty'); }
}
function setMode(v) { set(v); document.body.classList.toggle('ui2', v === '2'); const b = $('ui2Back'); if (b) b.hidden = v === '2'; place(); if (v !== '2') addClassicBtn(); window.dispatchEvent(new Event('resize')); tick(); }
function init() { build(); setMode(get()); }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
window.IzmjeraIzgled = { setMode };
})();
/* v2.08: početni zaslon – raspored s bočnom trakom (jednom), „Nastavi” sa sličicom zadnjeg projekta */
(function homeV2() { const $ = id => document.getElementById(id);
  const build = () => { const H = $('home'); if (!H || H.classList.contains('hv2')) return !!H; const head = H.querySelector('.home-head'), np = $('newproject'), vf = $('vrstaFilter'), pl = $('projectlist'); if (!head || !np || !vf || !pl || !$('homeContinue')) return false;
    const side = document.createElement('div'); side.id = 'homeSide'; const mn = document.createElement('div'); mn.id = 'homeMain';
    const kids = [...H.children]; const brand = head.querySelector('.brand-home'); if (brand) side.appendChild(brand); side.appendChild(np);
    const sec = t => { const d = document.createElement('div'); d.className = 'hv2-sec'; d.textContent = t; side.appendChild(d); }; sec('VRSTA'); side.appendChild(vf); sec('DATOTEKE');
    for (const id of ['importproject', 'saveFolderBtn']) { const b = $(id); if (b) { b.classList.add('hv2-file'); side.appendChild(b); } } const fi = $('importfile'); if (fi) side.appendChild(fi);
    const sw = $('projectSearch') && $('projectSearch').parentElement; if (sw) sw.classList.add('hv2-sw');
    for (const k of kids) if (k !== head && k !== vf) mn.appendChild(k); head.style.display = 'none'; mn.insertBefore(head, mn.firstChild);
    H.appendChild(side); H.appendChild(mn); H.classList.add('hv2');
    { const ht = $('homeTools'); if (sw && ht) { sw.appendChild(ht); sw.classList.add('hv2-swf'); } } /* v2.16: Poredaj u istom redu kao pretraga */
    setTimeout(() => { try { window.IzmjeraApp && IzmjeraApp.home && IzmjeraApp.home.listProjects(); } catch (e) { } }, 0); return true; };
  const hero = () => { const c = $('homeContinue'), g = c && c.querySelector('.go'); if (!g || g.dataset.hv2) return; g.dataset.hv2 = '1'; const nm = g.querySelector('span'), sm = g.querySelector('small'); if (!nm) return;
    const card = [...document.querySelectorAll('#projectlist .pc')].find(x => (x.querySelector('.pc-n') || {}).firstChild && x.querySelector('.pc-n').firstChild.textContent === nm.textContent);
    const th = document.createElement('div'); th.className = 'hv2-th'; if (card) { const t = card.querySelector('.pc-th'); if (t && t.style.backgroundImage) th.style.backgroundImage = t.style.backgroundImage; } if (!th.style.backgroundImage) { th.textContent = card && card.querySelector('.tj-iz') ? (card.querySelector('.tj-iz').textContent.startsWith('💬') ? '💬' : '📎') : '📐'; th.style.cssText += ';display:flex;align-items:center;justify-content:center;font-size:54px;background:#ffffff18'; }
    const tx = document.createElement('div'); tx.className = 'hv2-tx'; tx.innerHTML = '<div class="hv2-k">NASTAVI GDJE SI STAO</div>'; tx.appendChild(nm); const info = document.createElement('small'); const a = card && card.querySelector('.pc-a'), st = card && card.querySelector('.pc-s');
    const stt = st ? [...st.childNodes].filter(n => !(n.classList && n.classList.contains('tj'))).map(n => n.textContent).join('').replace(/^\s*·\s*/, '') : ''; info.textContent = [a && a.textContent, stt || (sm && sm.textContent)].filter(Boolean).join(' · '); tx.appendChild(info); if (sm) sm.remove();
    const bt = document.createElement('span'); bt.className = 'hv2-b'; bt.textContent = '▶ Nastavi'; g.replaceChildren(th, tx, bt); };
  /* v2.38: jedna traka dolje preko cijele širine (alati u sredini, lijevo uputa, desno znak) – boje ostaju iste; kutovi su bez gumba pa dlan ne smeta */
  { const b2 = document.createElement('style'); b2.textContent = `body.ui2{--ui2-st:0px!important}
html body.ui2 #ui2Quick#ui2Quick#ui2Quick{left:0!important;right:0!important;transform:none!important;width:100%!important;max-width:100%!important;border-radius:0!important;justify-content:center!important;box-shadow:0 -3px 12px rgba(0,0,0,.18)!important;border-top:2px solid #4f8fe0!important;box-sizing:border-box!important}
html body.ui2 #status#status:not(.hidden){position:fixed!important;left:0!important;right:0!important;bottom:0!important;height:var(--ui2-qb,78px)!important;max-height:none!important;min-height:0!important;background:transparent!important;border:0!important;pointer-events:none!important;z-index:9!important;display:flex!important;align-items:center!important;padding:0 calc(50vw + var(--ui2-qw,820px) / 2 + 8px) 0 12px!important;white-space:normal!important;overflow:hidden!important;font-size:12px!important;line-height:1.3!important;box-sizing:border-box!important;text-overflow:clip!important}
html body.ui2 #status#status:not(.hidden)::after{position:absolute!important;right:12px!important;top:50%!important;transform:translateY(-50%)!important;margin:0!important}
html body.ui2.ui2-narrow #status:not(.hidden){display:none!important}`; document.head.appendChild(b2);
    const fitBar = () => { try { const q = document.getElementById('ui2Quick'); if (!q) return; let w = 0; for (const c of q.children) w += c.getBoundingClientRect().width; w += 60; document.documentElement.style.setProperty('--ui2-qw', Math.round(w) + 'px'); document.body.classList.toggle('ui2-narrow', innerWidth - w < 300); } catch (e) { } };
    setInterval(fitBar, 1500); addEventListener('resize', fitBar); setTimeout(fitBar, 600); }
  const tick = () => { try { if (build()) hero(); } catch (e) { } };
  setInterval(tick, 500); document.addEventListener('DOMContentLoaded', tick); tick(); })();
